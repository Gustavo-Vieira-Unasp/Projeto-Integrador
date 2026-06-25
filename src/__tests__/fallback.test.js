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

// ---------------------------------------------------------------------------
// Payload mínimo que simula uma resposta válida da API.
// Precisamos de pelo menos um item em historico para fetchDashboardPayload()
// não sobrescrever o cenario com 'offline' (a função força offline quando
// historico vem vazio — ver dataService.js linha: if (!payload.historico?.length)).
// ---------------------------------------------------------------------------
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

// Resposta HTTP mínima válida — simula o que a API real retornaria.
// O campo cenario é adicionado pelo apiService depois de parsear o JSON,
// então aqui só precisamos retornar o array de historico.
function respostaOk(cenario) {
  return {
    ok: true,
    // O apiService chama resposta.json() para obter os dados.
    // Retornamos o array diretamente porque obterHistoricoCompleto()
    // aceita tanto Array quanto { dashboardData: Array }.
    json: async () => HISTORICO_MINIMO,
  };
}

// ---------------------------------------------------------------------------
// Setup e teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  // Limpa todos os mocks entre testes para evitar que um teste contamine o outro.
  jest.clearAllMocks();

  // Reseta o cache do dataService entre testes.
  // O dataService mantém um cachePayload em memória (variável de módulo).
  // Se não resetarmos, o segundo teste reutilizaria o payload do primeiro
  // sem chamar fetch novamente — o que quebraria os asserts.
  setCachedPayload(null);

  // Silencia os logs de console durante os testes para saída limpa.
  // Os logs ainda acontecem (a função é chamada), só não aparecem no terminal.
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restaura todos os spies para não afetar outros arquivos de teste.
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

describe('Observabilidade — sinal de modo degradado (C5)', () => {

  /**
   * CENÁRIO A — Fallback: Azure cai, Render responde.
   *
   * Este é o cenário do incidente real da apresentação.
   * Simulamos a Azure rejeitando a requisição (network error) e o Render
   * respondendo com dados válidos.
   *
   * O fluxo esperado:
   *   fetch(Azure URL) → rejeita com Error
   *   fetch(Render URL) → resolve com payload válido
   *   apiService retorna { cenario: 'render-live', ... }
   *   dataService detecta cenario !== 'normal'
   *   registrarFallback('render-live') é chamado
   *   data_source_fallback_total passa de 0 para 1
   *
   * Assert: contador deve ser exatamente 1 após uma chamada em fallback.
   */
  test('incrementa data_source_fallback_total quando Azure cai e Render responde', async () => {
    // Lemos o valor atual do contador ANTES do teste.
    // Fazemos isso porque o contador é acumulativo na sessão —
    // se outros testes rodarem antes e incrementarem, não queremos falso positivo.
    const contadorAntes = getMetrics().data_source_fallback_total;

    // Arrange — configurar o mock de fetch.
    // mockRejectedValueOnce: primeira chamada (Azure) vai lançar Error.
    // mockResolvedValueOnce: segunda chamada (Render) vai retornar payload válido.
    // A ordem importa: apiService.js tenta PRIMARY_API primeiro, depois FALLBACK_API.
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('Azure offline — simulação C5'))
      .mockResolvedValueOnce(respostaOk());

    // Act — chamar a função que orquestra a busca de dados.
    await fetchDashboardPayload();

    // Assert — o contador deve ter incrementado exatamente 1 vez.
    // Verificamos a diferença (depois - antes) para isolar este teste de
    // qualquer estado residual de outros testes no mesmo processo Jest.
    const contadorDepois = getMetrics().data_source_fallback_total;
    expect(contadorDepois).toBe(contadorAntes + 1);
  });

  /**
   * CENÁRIO B — Caminho normal: Azure responde.
   *
   * Este teste prova que o sinal NÃO dispara falso positivo.
   * Se o contador incrementasse no caminho normal, geraria alertas
   * de infra desnecessários — o que seria pior do que não ter o sinal.
   *
   * O fluxo esperado:
   *   fetch(Azure URL) → resolve com payload válido
   *   apiService retorna { cenario: 'normal', ... }
   *   dataService verifica: cenario === 'normal' → NÃO chama registrarFallback
   *   data_source_fallback_total permanece igual ao valor inicial
   *
   * Assert: contador deve ser igual ao valor antes da chamada (não incrementou).
   */
  test('mantém data_source_fallback_total zerado quando Azure responde normalmente', async () => {
    const contadorAntes = getMetrics().data_source_fallback_total;

    // Arrange — só uma chamada de fetch necessária: Azure responde de primeira.
    global.fetch = jest.fn().mockResolvedValueOnce(respostaOk());

    // Act
    await fetchDashboardPayload();

    // Assert — contador não deve ter mudado.
    const contadorDepois = getMetrics().data_source_fallback_total;
    expect(contadorDepois).toBe(contadorAntes);
  });

});
