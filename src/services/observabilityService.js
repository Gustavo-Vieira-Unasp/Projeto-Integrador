/**
 * Observabilidade do dashboard: logs estruturados, requestId e métricas locais.
 */

const metrics = {
  fetch_error_total: 0,
  screen_render_ms: {},
  alerts_displayed_total: 0,
  data_source_fallback_total: 0,
};

let currentRequestId = null;

function emit(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: fields.requestId ?? currentRequestId,
    screen: fields.screen ?? null,
    durationMs: fields.durationMs ?? null,
    error: fields.error ?? null,
    ...fields,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  return entry;
}

export function gerarRequestId() {
  currentRequestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return currentRequestId;
}

export function getRequestId() {
  return currentRequestId;
}

export function logInfo(event, fields = {}) {
  return emit('info', event, fields);
}

export function logWarn(event, fields = {}) {
  return emit('warn', event, fields);
}

export function logError(event, fields = {}) {
  metrics.fetch_error_total += 1;
  return emit('error', event, fields);
}

export function registrarFallback(cenario) {
  metrics.data_source_fallback_total += 1;
  return logWarn('data_source_fallback', {
    cenario,
    total: metrics.data_source_fallback_total,
    mensagem: `[DEGRADADO] Sistema operando em modo fallback. Fonte: ${cenario}`,
  });
}

export function recordScreenRender(screen, durationMs) {
  metrics.screen_render_ms[screen] = durationMs;
  return emit('info', 'screen_render', { screen, durationMs });
}

export function recordAlertsDisplayed(count) {
  metrics.alerts_displayed_total += count;
  return emit('info', 'alerts_displayed', { count, total: metrics.alerts_displayed_total });
}

export function getMetrics() {
  return { ...metrics, screen_render_ms: { ...metrics.screen_render_ms } };
}

export function exporMetricsGlobais() {
  if (typeof window !== 'undefined') {
    window.__PHORTA_METRICS__ = getMetrics;
  }
}
