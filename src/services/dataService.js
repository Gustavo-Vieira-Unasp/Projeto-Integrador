/**
 * dataService.js — Camada unificada de dados do dashboard (A1.8).
 *
 * Canteiro Alface (id A) = telemetria real da API.
 * Demais canteiros = cadastro local, sem leituras até integração Marco 4.
 */

import { buscarDadosDispositivo } from './apiService.js';
import {
  obterTelemetriaMockada,
  obterHistoricoMockado,
  obterCenarioForcado,
  CANTEIRO_API_ID,
  CANTEIRO_REAL,
} from './mockService.js';
import {
  getCanteiros,
  createCanteiro,
  updateCanteiro,
  deleteCanteiro,
  isCanteiroApi,
} from './canteirosService.js';
import { obterAlertasCompletos, filtrarAlertas } from './alertasService.js';
import { gerarRequestId, logInfo, logError, registrarFallback } from './observabilityService.js';

let cachePayload = null;

function taggarLeiturasApi(lista) {
  return (lista || []).map(r => ({ ...r, canteiroId: CANTEIRO_API_ID }));
}

function taggarTelemetriaApi(tel) {
  if (!tel) return tel;
  return { ...tel, canteiroId: CANTEIRO_API_ID };
}

function contarIrrigacoesDoHistorico(historico, corteMs) {
  let total = 0;
  let volume = 0;
  for (const r of historico || []) {
    const ts = new Date(r.dataHora).getTime();
    if (isNaN(ts) || ts < corteMs) continue;
    if (r.statusIrrigacao === 'LIGADO') {
      total += 1;
      volume += r.vazaoGotejamentoLh || 2.0;
    }
  }
  return { total, volume: parseFloat(volume.toFixed(1)) };
}

export async function getTelemetriaAtual(canteiroId = CANTEIRO_API_ID) {
  if (!isCanteiroApi(canteiroId)) return null;
  const payload = await ensurePayload();
  return payload.telemetria || obterTelemetriaMockada(canteiroId);
}

export async function getHistoricoLeituras({ canteiroId, inicio, fim, page = 1, pageSize = 20 } = {}) {
  if (canteiroId && !isCanteiroApi(canteiroId)) {
    return { items: [], total: 0, page, pageSize, totalPages: 1 };
  }

  const payload = await ensurePayload();
  let lista = payload.historico?.length
    ? taggarLeiturasApi(payload.historico)
    : taggarLeiturasApi(obterHistoricoMockado());

  if (inicio) {
    const ini = new Date(inicio).getTime();
    lista = lista.filter(r => new Date(r.dataHora).getTime() >= ini);
  }
  if (fim) {
    const end = new Date(fim).getTime();
    lista = lista.filter(r => new Date(r.dataHora).getTime() <= end);
  }

  lista = [...lista].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

  const total = lista.length;
  const start = (page - 1) * pageSize;
  const items = lista.slice(start, start + pageSize);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
}

export async function getAlertas(filtros = {}) {
  const payload = await ensurePayload();
  const todos = obterAlertasCompletos(payload.telemetria, payload.historico);
  const filtrados = filtrarAlertas(todos, {
    canteiroId: filtros.canteiroId,
    tipo: filtros.tipo,
    periodoDias: filtros.periodoDias || filtros.periodo,
  });
  const page = filtros.page || 1;
  const pageSize = filtros.pageSize || 20;
  const start = (page - 1) * pageSize;
  return {
    items: filtrados.slice(start, start + pageSize),
    total: filtrados.length,
    page,
    pageSize,
  };
}

export async function getRelatorioAgregado({ periodo = 7 } = {}) {
  const payload = await ensurePayload();
  const canteiros = getCanteiros();
  const corte = Date.now() - periodo * 24 * 60 * 60 * 1000;
  const historico = payload.historico?.length
    ? payload.historico
    : obterHistoricoMockado();

  return canteiros.map(c => {
    if (c.fonteApi || isCanteiroApi(c.id)) {
      const { total, volume } = contarIrrigacoesDoHistorico(historico, corte);
      return { canteiroId: c.id, nome: c.nome, total, volume };
    }
    return { canteiroId: c.id, nome: c.nome, total: 0, volume: 0 };
  });
}

export async function getStatusCanteiros() {
  const payload = await ensurePayload();
  const canteiros = getCanteiros();
  const tel = payload.telemetria;
  const apiOffline = payload.cenario === 'offline';

  return canteiros.map(c => {
    if (!c.fonteApi && !isCanteiroApi(c.id)) {
      return {
        ...c,
        semMonitoramento: true,
        ultimaLeitura: null,
        umidade_solo_pct: null,
        temperatura_c: null,
        luminosidade: null,
        alertaAtivo: false,
        offline: false,
      };
    }

    const umid = tel?.umidadeSoloPorcentagem ?? null;
    const temp = tel?.temperatura ?? null;
    const offline = apiOffline || !tel;
    const alertaAtivo = !offline && umid != null && temp != null && (umid < 30 || temp > 35);

    return {
      ...c,
      semMonitoramento: false,
      ultimaLeitura: tel?.dataHora || null,
      umidade_solo_pct: offline ? null : umid,
      temperatura_c: offline ? null : temp,
      luminosidade: offline ? null : (tel?.luzSolar ?? null),
      alertaAtivo,
      offline,
    };
  });
}

export async function fetchDashboardPayload(options = {}) {
  gerarRequestId();
  try {
    logInfo('fetch_start', { source: 'api' });
    const payload = await buscarDadosDispositivo(options);

    if (payload.cenario !== 'normal') {
      registrarFallback(payload.cenario);
    }

    const cenario = obterCenarioForcado();
    if (cenario) payload.cenario = cenario;

    if (!payload.historico?.length) {
      payload.historico = obterHistoricoMockado();
      payload.cenario = cenario || 'offline';
    } else {
      payload.historico = taggarLeiturasApi(payload.historico);
    }

    if (!payload.telemetria) {
      payload.telemetria = obterTelemetriaMockada();
    } else {
      payload.telemetria = taggarTelemetriaApi(payload.telemetria);
    }

    cachePayload = payload;
    logInfo('fetch_success', { records: payload.historico?.length, cenario: payload.cenario });
    return payload;
  } catch (err) {
    logError('fetch_failed', { error: err.message });
    cachePayload = {
      telemetria: taggarTelemetriaApi(obterTelemetriaMockada()),
      historico: taggarLeiturasApi(obterHistoricoMockado()),
      cenario: obterCenarioForcado() || 'offline',
    };
    return cachePayload;
  }
}

async function ensurePayload() {
  if (!cachePayload) await fetchDashboardPayload();
  return cachePayload;
}

export function getCachedPayload() {
  return cachePayload;
}

export function setCachedPayload(payload) {
  cachePayload = payload;
}

export {
  getCanteiros,
  createCanteiro,
  updateCanteiro,
  deleteCanteiro,
  CANTEIRO_REAL,
  CANTEIRO_API_ID,
};

