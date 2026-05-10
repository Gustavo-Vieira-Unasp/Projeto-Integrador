# Test Strategy

## 1.1 Identificação do Projeto

| Campo | Valor |
| :--- | :--- |
| **Equipe** | Gustavo Vieira, Jenifer Gomes, Luís Gabriel, Philipe Gonçalves e Victor Herédia |
| **Versão** | v0.1 |
| **Data** | 07/05/2026 |
| **RFC de arquitetura** | [docs/rfc/rfc-001-arquitetura-mvp.md](rfc/rfc-001-arquitetura-mvp.md) |
| **Marco acadêmico** | Marco 3 |

---

## 1.2 Escopo da Versão (Casos de Uso)

Conforme definido na [RFC de Arquitetura](rfc/rfc-001-arquitetura-mvp.md), a seleção de Casos de Uso (UCs) abaixo prioriza a entrega do valor central do MVP (Minimum Viable Product).

### UCs incluídos na v0.1

* **UC-01 — Monitorar Dados Ambientais em Tempo Real**
  * *Motivo:* Incluído por representar a funcionalidade principal do sistema IoT e o fluxo contínuo de coleta e visualização de dados.

* **UC-02 — Acionar Irrigação Manual**
  * *Motivo:* Incluído por ser uma funcionalidade crítica de controle remoto da irrigação através do dashboard web.

* **UC-03 — Executar Irrigação Automática por Regra**
  * *Motivo:* Incluído por representar a principal automação inteligente do sistema.

### UCs fora do escopo da v0.1 (Data-alvo: v0.2)

* **Monitoramento visual com câmera OV2640**
  * *Motivo:* Complexidade técnica de streaming de imagem e análise de viabilidade de hardware adiados para a **v0.2**.

* **Controle de múltiplas zonas independentes de irrigação**
  * *Motivo:* Simplificação da arquitetura hidráulica e lógica do software para garantir a entrega do MVP na **v0.2**.

* **Aplicativo Mobile Nativo**
  * *Motivo:* Foco total na estabilização da plataforma Web Responsiva inicialmente, com migração para app nativo prevista para a **v0.2**.

---

## 1.3 Matriz de Riscos — Estratégia de Testes

### Mapeamento UC → Risco → Nível → Justificativa

| # | UC · Fluxo (A1.3) | Risco concreto e quantificável | Nível de teste | Trade-off | Justificativa (rejeita outros níveis) |
| - | ----------------- | ------------------------------ | -------------- | --------- | ------------------------------------- |
| 1 | **UC-01** · FP Passo 4 — validação DHT22 | A função de validação pode aceitar `84.9 °C` como leitura legítima porque o sentinel de curto do DHT22 é `85.0 °C` exato; um off-by-one no operador (`< 85` em vez de `<= 84`) deixa passar dado fisicamente impossível, que é persistido no InfluxDB e polui o histórico sem alarme | **Unitário** — `validateDHT22Reading(temp, humidity)` com tabela: `84.9`, `85.0`, `85.1`, `-10.0`, `-10.1`, `NaN` | Executa em < 1 ms, determinístico, isola o boundary exato; perde cobertura do fluxo completo de envio ao servidor | Mock de sensor introduziria variação analógica (±0,5 °C do DHT22) que impede assert determinístico no boundary exato `85.0`; integração exigiria servidor + banco ativos sem contribuir para detectar o off-by-one; sistema não consegue forçar `85.0 °C` de forma reproduzível em CI |
| 2 | **UC-01** · FE-01-B — buffer circular NVS | O buffer aceita 100 entradas (~12,8 KB); na entrada 101 deve descartar a mais antiga (FIFO) e setar `buffer_overflow: true`; se o índice de escrita não fizer wraparound corretamente, a entrada 101 sobrescreve a posição 0 sem setar o flag, e o receptor do lote (`POST /batch`) recebe dados fora de ordem sem saber que houve perda | **Unitário** — módulo `NVSBuffer` com flash mockada; inserir 101 registros e assert: posição 0 contém o registro 2 (não o 1), flag `buffer_overflow: true` presente | Controla exatamente a 101ª entrada sem esperar 100 min de ciclos reais; não valida o envio em lote ao servidor | Testar em hardware exigiria 101 ciclos de 60 s (≈ 100 min) com Wi-Fi derrubado manualmente — não automatizável em CI; integração com servidor não detecta o bug de índice porque o servidor recebe o lote sem saber quantas entradas foram descartadas |
| 3 | **UC-01** · FP Passos 7–10 — persistência + streaming | O servidor pode gravar a leitura no InfluxDB com sucesso (`HTTP 201`) e falhar silenciosamente na publicação WebSocket — sem log de erro — porque o evento de socket é disparado em callback assíncrono não aguardado com `await`; o dashboard fica desatualizado e nenhum alerta é gerado | **Integração** — servidor real + InfluxDB em contêiner + cliente WebSocket de teste; assert: após `201`, evento WebSocket chega em ≤ 2 s | Detecta o acoplamento assíncrono real entre escrita e publicação; aumenta o tempo de setup do CI (~30 s para subir os contêineres) | Mock do socket ocultaria exatamente o bug — o mock não replica o comportamento assíncrono real do pipeline; unitário não exercita o caminho completo de persistência → publicação; sistema exigiria ESP32 físico sem acrescentar nada à detecção do `await` faltante |
| 4 | **UC-02** · FP Passos 9–11 — timeout de ACK do comando MQTT | O servidor publica `IRRIGATE` e aguarda `{"state": "IRRIGATING"}` por 8 s; se o broker entregar com latência de 9 s (fila com mensagens QoS 1 retidas de sessão anterior), o servidor registra `COMMAND_TIMEOUT` e bloqueia o botão por 30 s — mesmo que o relé tenha sido acionado corretamente 1 s depois | **Integração** — servidor + Mosquitto em contêiner com delay de 9 s via `tc netem`; assert: evento `COMMAND_TIMEOUT` gerado e mock do ESP32 sem `digitalWrite(HIGH)` | Reproduz latência real entre dois processos; delay artificial via `tc netem` pode divergir de condições de produção | Unitário não consegue reproduzir latência de rede entre dois processos reais — o bug está no timing entre servidor e broker, não em lógica isolada; sistema com hardware físico torna o delay não determinístico e o assert sobre o estado do relé impraticável em CI |
| 5 | **UC-02** · FE-02-B — detecção de falha no atuador | O ESP32 detecta falha na bomba lendo corrente do ACS712: falha = corrente < 0,1 A após 500 ms; se a conversão ADC→amperes usar a constante errada (66 mV/A do modelo 20A em vez de 185 mV/A do 5A), uma bomba consumindo 0,08 A é lida como 0,28 A e classificada como saudável; o relé fica ativo com bomba sem água | **Unitário** — `readPumpCurrent(adcValue)` com ADC mockado para 0 A, 0,08 A, 0,10 A e 0,12 A; assert: apenas `< 0,1 A` retorna `ACTUATOR_FAIL` | Isola a constante de conversão sem ruído analógico do sensor real; não valida o comportamento do relé após a detecção | Sensor ACS712 real introduz ruído analógico de ±10 mV (≈ ±0,05 A) que impede assert determinístico no limiar exato de 0,1 A; integração ou sistema não isolam a função de conversão ADC→amperes do restante do pipeline de falha |
| 6 | **UC-03** · FP Passo 2 — motor de regras com sensor nulo | O motor avalia `umidade_solo < 30` quando o campo chega como `null`; em JavaScript, `null < 30` é `false` — a regra não dispara irrigação (resultado acidentalmente correto), mas `RULE_SKIPPED` não é gerado e auditoria fica cega para o período de falha do sensor | **Unitário** — `evaluateRule(rule, {umidade_solo: null})`; assert: `{result: 'SKIPPED', reason: 'SENSOR_DATA_INVALID'}`, zero chamadas ao publicador MQTT | Exercita o caso nulo de forma isolada e determinística; não valida a persistência do evento `RULE_SKIPPED` no banco | Integração exigiria banco + broker ativos e não isolaria se o bug está na avaliação da condição ou na gravação do evento; sistema não consegue forçar leitura nula de forma reproduzível sem modificar o firmware |
| 7 | **UC-03** · FA-03-B — conflito de prioridade entre regras | Quando Regra #7 (`priority: 1`) e Regra #9 (`priority: 2`) são satisfeitas pelo mesmo payload, o motor deve executar a #7; se `.sort()` for usado sem comparador explícito, o V8 ordena por string — `priority: 10` vem antes de `priority: 2` — e a regra errada é executada | **Unitário** — `resolveRuleConflicts(rules)` com fixtures: prioridades distintas, iguais e `priority: 2` vs `priority: 10`; assert: ordem estável e regra correta selecionada | Detecta comportamento da engine JS sem infraestrutura; não valida o comando MQTT publicado após a seleção | O comportamento do sort depende da engine JS, não da infraestrutura — integração com banco não reproduz o bug; sistema não permite inspecionar qual regra foi selecionada internamente antes da publicação MQTT |

---

### Resumo por nível

| Nível | Riscos cobertos | Critério de uso neste projeto |
| ----- | --------------- | ----------------------------- |
| **Unitário** | #1, #2, #5, #6, #7 | Lógica pura, cálculo ou política de estrutura de dados exercitável sem I/O real; boundary numérico preciso exige input controlado |
| **Integração** | #3, #4 | Risco emerge do acoplamento entre dois processos reais; mock ocultaria o defeito |
| **Sistema / Aceitação** | — (v0.2) | Exige hardware físico (ESP32, relé, bomba); não automatizável em CI nesta versão; coberto por checklist manual na v0.2 |

---

### Rastreabilidade testes ↔ UCs

| ID do teste | UC (A1.3) | Fluxo | Risco # |
| ----------- | --------- | ----- | ------- |
| `unit.dht22.sentinel-boundary` | UC-01 | FP Passo 4 | #1 |
| `unit.nvs.fifo-wraparound` | UC-01 | FE-01-B | #2 |
| `intg.readings.persist-and-stream` | UC-01 | FP Passos 7–10 | #3 |
| `intg.mqtt.ack-timeout` | UC-02 | FP Passos 9–11 | #4 |
| `unit.actuator.acs712-conversion` | UC-02 | FE-02-B | #5 |
| `unit.rules.null-sensor-skip` | UC-03 | FP Passo 2 | #6 |
| `unit.rules.priority-sort-stable` | UC-03 | FA-03-B | #7 |

---

### Como ler esta matriz

Cada linha responde três perguntas que um dev novo deve conseguir responder só com o conteúdo da tabela:

1. **O que pode quebrar e onde exatamente?** — risco com valores numéricos reais do projeto, não "pode falhar"
2. **Onde testar e por quê não nos outros níveis?** — nível escolhido + justificativa que descarta os demais
3. **Vale o custo desse teste?** — trade-off explicita o que o nível escolhido não cobre

## 1.4 Estratégia de Testes por Nível

*(Espaço reservado para especificações futuras)*.

## 1.5 ADR - Técnica Moderna de Teste

*(Espaço reservado para especificações futuras)*.

## 1.6 Política de Qualidade e Estratégia de Pipeline

### Suíte obrigatória para merge em `main`

* Validação dos endpoints principais da API.
* Testes do fluxo de monitoramento ambiental em tempo real.
* Testes do acionamento manual da irrigação.
* Verificação básica de comunicação entre backend e dashboard.

Falhas em qualquer teste desta suíte devem bloquear o merge até correção.

### Suíte não bloqueadora

Os testes abaixo geram alerta, mas não impedem merge:

* Testes experimentais de performance.
* Verificações visuais não críticas do dashboard.
* Testes de funcionalidades ainda em validação.
* Logs de cobertura parcial de testes.

Esses alertas devem ser analisados pela equipe antes da release final.

### Política de execução nightly e release

Antes de releases oficiais, deve ser executada uma suíte completa de regressão contendo:

* Testes de integração entre ESP32, backend e dashboard.
* Verificação da comunicação MQTT.
* Testes das automações de irrigação.
* Validação dos fluxos críticos da aplicação.

A execução manual da suíte de release é obrigatória antes da publicação de novas versões.

### Política de regressão permanente

Todo bug corrigido deve gerar pelo menos um teste permanente de regressão para evitar problemas futuros no sistema.

### Consistência com o plano SCM

A política de qualidade e regressão deve seguir as regras de proteção de branch e fluxo de versionamento definidos no plano SCM do projeto.

## 1.7 Evidência de Execução - Teste Contratual

*(Espaço reservado para especificações futuras)*.

## 1.8 Lições Aprendidas e Pendências para v0.2

*(Espaço reservado para especificações futuras)*.
