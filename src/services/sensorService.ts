import type {

  CenarioMock,
  PayloadMock,
  ResultadoFetch,
} from '../types/sensor';

import { mockPorCenario, historicoMock } from '../mocks/sensorData';

const USE_MOCK = true;

const API_BASE_URL =
  (typeof window !== 'undefined' &&
    (window as Window & { __API_URL__?: string }).__API_URL__) ||
  'http://localhost:3000';


const DEVICE_ID = 'esp32-horta-01';


function fetchMock(cenario: CenarioMock): ResultadoFetch {
  try {
    const gerador = mockPorCenario[cenario];
    if (!gerador) {
      return { ok: false, erro: `Cenário desconhecido: "${cenario}"` };
    }
    return { ok: true, dados: gerador() };
  } catch (erro) {
    return {
      ok: false,
      erro: `Erro ao gerar mock [${cenario}]: ${String(erro)}`,
    };
  }
}


async function fetchAPI(): Promise<ResultadoFetch> {
  try {
    const url = `${API_BASE_URL}/api/v1/readings?device_id=${DEVICE_ID}&limit=1`;

    const resposta = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        //  obs importantante - HMAC-SHA256 será injetado aqui quando autenticação for implementada
        // 'X-Signature': await gerarHMAC(payload),
      },
    });

    if (!resposta.ok) {
      return {
        ok: false,
        erro: `API respondeu com status ${resposta.status}: ${resposta.statusText}`,
      };
    }

    const json = await resposta.json();

    
    const dados: PayloadMock = adaptarRespostaV1(json);

    return { ok: true, dados };
  } catch (erro) {
    return {
      ok: false,
      erro: `Falha na requisição à API: ${String(erro)}`,
    };
  }
}

/**
 * TODO (P-03): remover este adaptador ao migrar schema para v0.2.
 */
function adaptarRespostaV1(json: unknown): PayloadMock {
  const leituras = Array.isArray(json) ? json : [json];

  const porSensor = Object.fromEntries(
    leituras.map((l: { sensor: string; valor: number }) => [l.sensor, l.valor])
  );

  const primeira = leituras[0] ?? {};

  return {
    device_id:        primeira.device_id ?? DEVICE_ID,
    timestamp:        primeira.timestamp ?? new Date().toISOString(),
    cenario:          'normal',
    temperatura_c:    porSensor['dht22_temp']   ?? porSensor['dht22'] ?? null,
    umidade_ar_pct:   porSensor['dht22_hum']    ?? null,
    umidade_solo_pct: porSensor['capacitivo']   ?? null,
    luminosidade_lux: porSensor['ldr']          ?? null,
    bateria_pct:      porSensor['solar']        ?? null,
  };
}

/**
 * Em modo mock: gera dados realistas para o cenário solicitado.
 * Em modo API:  busca leitura mais recente no servidor.
 *
 * @param cenario — usado apenas em modo mock (padrão: 'normal')
 *
 * @example
 * const resultado = await fetchSensorData();
 * if (resultado.ok) {
 *   console.log(resultado.dados.temperatura_c);
 * } else {
 *   console.error(resultado.erro);
 * }
 */
export async function fetchSensorData(
  cenario: CenarioMock = 'normal'
): Promise<ResultadoFetch> {
  if (USE_MOCK) {
    return fetchMock(cenario);
  }
  return fetchAPI();
}


export async function fetchHistoricoSensores(): Promise<
  ResultadoFetch & { historico?: PayloadMock[] }
> {
  if (USE_MOCK) {
    return { ok: true, dados: historicoMock[0], historico: historicoMock };
  }

  try {
    const url = `${API_BASE_URL}/api/v1/readings?device_id=${DEVICE_ID}&limit=10`;
    const resposta = await fetch(url);

    if (!resposta.ok) {
      return { ok: false, erro: `Histórico API: status ${resposta.status}` };
    }

    const json: unknown[] = await resposta.json();
    const historico = json.map(adaptarRespostaV1);

    return { ok: true, dados: historico[0], historico };
  } catch (erro) {
    return { ok: false, erro: `Falha ao buscar histórico: ${String(erro)}` };
  }
}


export function isMockAtivo(): boolean {
  return USE_MOCK;
}