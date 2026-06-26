# Observabilidade — Dashboard PHorta (A1.8)

Instrumentação **real** no frontend via `src/services/observabilityService.js`.

---

## 1. Logs estruturados

Cada evento é emitido como **JSON em uma linha** no console do browser:

```json
{
  "timestamp": "2026-06-14T15:30:00.000Z",
  "level": "info",
  "event": "fetch_success",
  "requestId": "req_1718376600000_abc123",
  "screen": null,
  "durationMs": null,
  "records": 1500,
  "cenario": "normal"
}
```

### Eventos instrumentados

| Evento | Quando |
|--------|--------|
| `app_boot` | Inicialização do dashboard |
| `fetch_start` / `fetch_success` / `fetch_failed` | Ciclo de dados (`dataService`) |
| `route_change` | Troca de hash route |
| `screen_render` | Fim do render de cada tela (com `durationMs`) |
| `alerts_displayed` | Tela Alertas carregada |
| `csv_export` | Export CSV do Histórico |

### Request ID

Gerado em `gerarRequestId()` no início de cada fetch. Propagado em todos os logs subsequentes até o próximo fetch.

---

## 2. Métricas

Expostas via `window.__PHORTA_METRICS__()` no console:

| Métrica | Tipo | Descrição |
|---------|------|-----------|
| `fetch_error_total` | Counter | Falhas de fetch acumuladas |
| `screen_render_ms` | Gauge map | Tempo de render por tela (`principal`, `alertas`, `historico`, `canteiros`) |
| `alerts_displayed_total` | Counter | Total de alertas exibidos |
| `data_source_fallback_total` | Counter | Vezes que o sistema operou em modo degradado (fallback) na sessão atual. `0` = Azure respondendo normalmente. `> 0` = sistema usando Render, cache ou offline. |

### Como inspecionar (local)

```bash
npm run preview
# Abrir http://localhost:3000/#/principal
# DevTools → Console:
window.__PHORTA_METRICS__()
```

---

## 3. Runbook — modo degradado (fallback silencioso)

### Sintoma: dados do dashboard parecem desatualizados mas não há erro visível

Este é o cenário mais crítico: o sistema funciona, mas está servindo dados de uma
fonte secundária. Não há erro na tela — a degradação é invisível para o usuário final.

| Passo | Ação | O que verificar |
|-------|------|-----------------|
| 1 | Abrir DevTools → Console | Procurar logs com `"event":"data_source_fallback"` e `"level":"warn"` |
| 2 | Verificar o campo `cenario` no log | `render-live` = Render ativo; `*-cached` = cache ativo; `offline` = crítico |
| 3 | Verificar contador | `window.__PHORTA_METRICS__()` → checar `data_source_fallback_total > 0` |
| 4 | Verificar Azure | `curl https://horta-api-htggarb3eagagpgm.brazilsouth-01.azurewebsites.net/api/historico/completo?minutosAtras=60` |
| 5 | Se Azure fora | Acionar responsável pela infra Azure. Dados do dashboard podem estar desatualizados — comunicar usuários se necessário |
| 6 | Quando Azure voltar | Sistema retorna automaticamente para `cenario: normal` no próximo ciclo de fetch |

**Log esperado quando em modo degradado:**
```json
{
  "timestamp": "2026-06-25T14:32:00.000Z",
  "level": "warn",
  "event": "data_source_fallback",
  "requestId": "req_1234_abc",
  "cenario": "render-live",
  "total": 1,
  "mensagem": "[DEGRADADO] Sistema operando em modo fallback. Fonte: render-live"
}
```

**Referência de código:**
- Contador: `src/services/observabilityService.js` → `metrics.data_source_fallback_total`
- Registro: `src/services/dataService.js` → `fetchDashboardPayload()` → bloco `if (payload.cenario !== 'normal')`
- Teste de regressão: `src/__tests__/fallback.test.js`

---

## 4. Runbook — erro persistente em produção

### Sintoma: dashboard mostra "Erro ao carregar" ou fica offline

| Passo | Ação | O que verificar |
|-------|------|-----------------|
| 1 | Verificar rede do cliente | API Azure/Render acessível? `curl https://horta-api-.../api/historico/completo?minutosAtras=60` |
| 2 | Verificar cache local | DevTools → Application → IndexedDB `phorta-dashboard` ou localStorage `phorta-snapshot` |
| 3 | Forçar cenário mock | `localStorage.setItem('phorta-cenario-forcado','offline')` + reload — UI deve mostrar simulação |
| 4 | Correlacionar logs | Filtrar console por `requestId` do último `fetch_failed` |
| 5 | Rollback | Promover deploy anterior no Vercel; tag estável: `v0.2.0-dashboard-rc` |
| 6 | Escalar | Se API OK mas dashboard falha → issue com `requestId`, screenshot, `__PHORTA_METRICS__()` |

### Sintoma: tela específica vazia

- **Alertas:** verificar filtros (canteiro/tipo/período); resetar para 7 dias
- **Histórico:** ampliar intervalo de datas; export CSV para validar dados
- **Canteiros:** verificar `localStorage phorta-canteiros`; reset via DevTools se corrompido

---

## 5. Evidência de funcionamento

Log de exemplo capturado em ambiente local (`npm run preview`):

Ver: [`evidencias/observability-local.txt`](evidencias/observability-local.txt)

```
{"timestamp":"2026-06-14T...","level":"info","event":"app_boot","requestId":null,"version":"0.2.0-dashboard-rc"}
{"timestamp":"2026-06-14T...","level":"info","event":"fetch_start","requestId":"req_...","source":"api"}
{"timestamp":"2026-06-14T...","level":"info","event":"fetch_success","requestId":"req_...","records":N,"cenario":"normal"}
{"timestamp":"2026-06-14T...","level":"info","event":"screen_render","requestId":"req_...","screen":"principal","durationMs":45.2}
```

Para screenshot: DevTools → Console com logs JSON visíveis após navegar Principal → Alertas → Histórico.
