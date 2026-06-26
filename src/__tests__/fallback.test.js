/**
 * fallback.test.js — Prova do sinal de observabilidade de modo degradado (C5)
 *
 * O que este arquivo prova:
 *   1. Quando a Azure cai e o Render responde, data_source_fallback_total incrementa.
 *   2. Quando a Azure responde normalmente, data_source_fallback_total permanece 0.
 *
 * Por que isso importa:
 *   Antes do C5, o sistema entrava em modo degradado silenciosamente.
 *   Este teste garante que o sinal de observabilidade existe e funciona —
 *   e que ele não dispara falso positivo no caminho normal.
 *
 * Estratégia de mock:
 *   Usamos jest.spyOn(global, 'fetch') para interceptar as chamadas HTTP
 *   sem precisar de servidor real. O primeiro mock simula a Azure, o segundo
 *   simula o Render — porque é exatamente nessa ordem que apiService.js tenta.
 */

import { fetchDashboardPayload, setCachedPayload } from '../services/dataService.js';
import { getMetrics } from '../services/observabilityService.js';

const HISTORICO_MINIMO = [
  {
    id: 1,
    dataHora: new Date().toISOString(),
    umidadeSoloPorcentagem: 45,
    temperatura: 22,
    umidadeAr: 60,
    pHSolo: 6.5,
    luzSolar: 70,
    statusIrrigacao: 'DESLIGADO',
    estaChovendo: false,
    vazaoGotejamentoLh: 0,
    controleManualAtivo: false,
    estacao: 'outono',
    condicaoCeu: 'limpo',
  },
];

function respostaOk() {
  return {
    ok: true,
    json: async () => HISTORICO_MINIMO,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  setCachedPayload(null);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Observabilidade — sinal de modo degradado (C5)', () => {

  test('incrementa data_source_fallback_total quando Azure cai e Render responde', async () => {
    const contadorAntes = getMetrics().data_source_fallback_total;

    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('Azure offline — simulação C5'))
      .mockResolvedValueOnce(respostaOk());

    await fetchDashboardPayload();

    const contadorDepois = getMetrics().data_source_fallback_total;
    expect(contadorDepois).toBe(contadorAntes + 1);
  });

  test('mantém data_source_fallback_total zerado quando Azure responde normalmente', async () => {
    const contadorAntes = getMetrics().data_source_fallback_total;

    global.fetch = jest.fn()
      .mockResolvedValueOnce(respostaOk());

    await fetchDashboardPayload();

    const contadorDepois = getMetrics().data_source_fallback_total;
    expect(contadorDepois).toBe(contadorAntes);
  });

});
