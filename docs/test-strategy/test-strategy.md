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

A estratégia abaixo reflete a realidade da v0.1 do projeto Horta Inteligente, alinhada à Matriz de Riscos (Seção 1.3) e ao escopo definido.

### Unit Tests (Nível Unitário)

**Materialização no projeto:** Os testes unitários são aplicados a funções puras e módulos isolados no backend da API e no firmware do ESP32, sem dependências externas (banco, broker, hardware). No contexto da horta inteligente, isso inclui validação de leituras de sensores (`validateDHT22Reading`), lógica de buffer circular (`NVSBuffer`), conversão de corrente do atuador (`readPumpCurrent`), avaliação de regras de automação com entradas nulas (`evaluateRule`) e resolução de conflitos de prioridade entre regras (`resolveRuleConflicts`).

**Exemplo baseado na RFC/Matriz:** Conforme risco #5 (FE-02-B — falha no atuador), o componente `ActuatorController` da RFC possui uma função `readPumpCurrent(adcValue)`. O teste unitário `unit.actuator.acs712-conversion` mocks o valor do ADC para cenários de 0 A, 0,08 A, 0,10 A e 0,12 A, garantindo que a constante de conversão (185 mV/A para o sensor ACS712 5A) classifique corretamente uma bomba com consumo < 0,1 A como `ACTUATOR_FAIL`. Este teste isola a lógica de conversão do ruído analógico do hardware real.

### Integration Tests (Nível de Integração)

**Materialização no projeto:** Os testes de integração verificam a comunicação entre dois ou mais processos/componentes reais do sistema, como a API ↔ Banco de Dados (InfluxDB), API ↔ Broker MQTT (Mosquitto), ou API ↔ Cliente WebSocket. No projeto da horta, esse nível valida fluxos onde o risco emerge do acoplamento entre subsistemas e não seria detectado por mocks.

**Exemplo baseado na RFC/Matriz:** Conforme risco #4 (UC-02, FP Passos 9–11 — timeout de ACK do comando MQTT), o teste `intg.mqtt.ack-timeout` orquestra o servidor backend e um contêiner Mosquitto com latência artificial injetada via `tc netem` (9 segundos de delay). O teste envia um comando `IRRIGATE` e verifica se o servidor corretamente registra `COMMAND_TIMEOUT` mesmo que o mock do ESP32 tenha acionado o relé. O trade-off é que o setup exige contêineres (InfluxDB, Mosquitto, API) e aumenta o tempo de CI (~45 segundos), mas reproduz fielmente o comportamento assíncrono real.

### System Tests (Nível de Sistema)

**Materialização no projeto:** Na v0.1, **este nível não é utilizado de forma automatizada** devido à dependência crítica de hardware físico (ESP32, relé, bomba d'água, sensor DHT22 e de umidade). Testes de sistema exigiriam um ambiente de staging com os dispositivos reais, conexão Wi-Fi estável e simulação de condições ambientais controladas (ex: variar umidade do solo fisicamente), o que inviabiliza execução em CI (Continuous Integration) e torna os testes lentos, frágeis e não determinísticos.

**Justificativa da exclusão na v0.1:** A Matriz de Riscos (Seção 1.3) explicita que, para riscos como #1 (sentinel DHT22) e #5 (conversão ACS712), o nível de sistema não fornece benefício adicional em relação aos testes unitários ou de integração, pois não é possível forçar condições de boundary (exatos 85,0°C ou falha de bomba com 0,08 A) de forma reproduzível em hardware real. Também não há orçamento nem tempo para montar um ambiente de staging dedicado com hardware redundante nesta versão do projeto acadêmico.

**Transição para v0.2:** A partir da v0.2, com a introdução do monitoramento por câmera OV2640 e múltiplas zonas de irrigação, testes de sistema manuais serão definidos como checklist de validação em hardware real antes de releases, mas ainda sem automação em CI.

### Acceptance Tests (Nível de Aceitação)

**Materialização no projeto:** Na v0.1, **este nível é aplicado de forma parcial e manual**, pois o dashboard web responsivo ainda está em desenvolvimento e os critérios de aceitação formais (ex: "o usuário deve visualizar a irrigação sendo acionada no dashboard em até 2 segundos após o comando") dependem da interface completa. O foco da v0.1 é a estabilização da API, do firmware e das regras de automação core.

**Justificativa da exclusão automatizada:** Os Casos de Uso fora do escopo (câmera, múltiplas zonas, app mobile) impactariam a definição dos critérios de aceitação finais. Além disso, testes de aceitação automatizados ponta a ponta (ex: Cypress ou Playwright) exigiriam o dashboard completamente implementado e estável, o que não é verdade na v0.1.

**Estratégia atual:** Os critérios de aceitação definidos no SRS (Documento de Requisitos de Software) são usados como base para validação manual em ambiente de desenvolvimento (ex: verificar se a regra de irrigação automática dispara quando a umidade simulada via API está abaixo do limite). Um checklist manual de aceitação será executado antes do Marco 3.

**Transição para v0.2:** Na v0.2, com o dashboard consolidado, está planejada a introdução de cenários Gherkin (Dado/Quando/Então) automatizados com ferramenta como Cucumber.js, validando fluxos completos de usuário (ex: "Dado que estou logado, quando clico em 'Irrigar Agora', então a bomba liga e o status muda para 'Irrigando'").

---

## 1.5 ADR - Técnica Moderna de Teste

### ADR-001: Adoção de Contract Testing entre ESP32 ↔ API

**Data:** 10/05/2026
**Status:** Aceito
**Artefatos relacionados:** [RFC-001 (Arquitetura MVP)](rfc/rfc-001-arquitetura-mvp.md), Seção 1.3 (Riscos #3 e #4), Política de Qualidade (1.6)

---

#### Contexto

O sistema da Horta Inteligente depende da comunicação entre o dispositivo embarcado (ESP32) e a API backend. Esta comunicação ocorre por dois protocolos:

* **HTTP (POST /api/v1/readings):** Envio de leituras de sensores (DHT22, umidade do solo) em formato JSON.
* **MQTT (tópico `horta/commands`):** Recebimento de comandos de atuadores (IRRIGATE, STOP) pela API.

Atualmente, não há um contrato formal entre as partes. O firmware e o backend evoluem de forma relativamente independente (diferentes desenvolvedores, ciclos de deploy assíncronos). Uma mudança no backend (ex: renomear campo `temperatura` para `temp_celsius` ou alterar de `integer` para `float`) quebraria a integração silenciosamente, causando **perda de dados** (leitura rejeitada com HTTP 400) ou **falha de automação** (comando ignorado por payload inválido). Conforme a Matriz de Riscos (#3 e #4), o risco de acoplamento entre processos justifica a adoção de uma técnica específica de teste.

#### Decisão

Foi adotada a técnica de **Contract Testing** para garantir a compatibilidade entre ESP32 e API ao longo do tempo.

**Implementação concreta:**

1. **Contrato explícito:** Será criado um arquivo `contracts/esp32-api-v1.json` no repositório, utilizando **JSON Schema** (abordagem leve, suportada nativamente em JS/TS e com geradores de código para C++/ESP32).
2. **Versionamento:** O contrato será versionado junto ao código (`/api/v1/readings` → `esp32-api-v1.json`). Qualquer mudança breaking exige nova versão (ex: `v2`).
3. **Testes no backend:** O framework de testes da API (Jest) importará o JSON Schema e validará automaticamente os payloads de exemplo e as respostas geradas. Teste `contract.api.complies-with-schema` garantirá que a API não desvia do contrato.
4. **Geração de código para firmware:** Na pipeline de CI do firmware (PlatformIO), um script validará se as estruturas C++ (ex: `struct SensorReadings`) geram JSON compatível com o contrato. Um teste `contract.firmware.matches-schema` será executado a cada build.

**Exemplo prático (contrato):**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "SensorReading": {
      "type": "object",
      "required": ["sensor_id", "temperature_c", "humidity_pct", "soil_moisture_pct", "timestamp_unix"],
      "properties": {
        "sensor_id": {"type": "string", "pattern": "^esp32_[a-f0-9]{12}$"},
        "temperature_c": {"type": "number", "minimum": -10.0, "maximum": 85.0},
        "humidity_pct": {"type": "number", "minimum": 0.0, "maximum": 100.0},
        "soil_moisture_pct": {"type": "integer", "minimum": 0, "maximum": 100},
        "timestamp_unix": {"type": "integer", "minimum": 1700000000}
      }
    }
  }
}
```

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

## 1.7 Evidência de Execução - Teste Contratual (ADR-001)

Conforme definido no ADR-001 e ancorado na Issue #3 (Riscos #3 e #4), o teste de contrato valida se a comunicação entre o dispositivo IoT (ESP32) e a API de Referência respeita o esquema de dados JSON e as restrições de tipo.

**Especificações do Teste:**

* Arquivo de Teste: docs/test-strategy/contract/test_api_leituras.py

* Alvos:
  * `POST /leituras` (Registro de dados)
  * `GET /health` (Liveness check)

* Cobertura: Status Code (201 Created / 200 OK), Validação de Schema (JSON Schema Draft-07 com CamelCase) e validação de tipos de sensores (`dht22`, `capacitivo`, `ldr`).

Log de Execução (Evidência Automatizada)

```log
============================= test session starts =============================
platform win32 -- Python 3.14.2, pytest-9.0.3, pluggy-1.6.0
rootdir: C:\Users\gusta\Documents\codes\Projeto-Integrador
collected 9 items

docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_healthcheck_endpoint PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_post_leituras_status_code_and_required_fields PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_post_leituras_schema_completo PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_schema_validation_leitura_valida PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_schema_rejeita_valores_invalidos[sensor-sensor_invalido-is not one of] PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_schema_rejeita_valores_invalidos[device_id--should be non-empty] PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_schema_rejeita_valores_invalidos[valor-n\xe3o \xe9 n\xfamero-is not of type] PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_schema_requires_all_mandatory_fields PASSED
docs/test-strategy/contract/test_api_leituras.py::TestContractAPILeituras::test_integration_contrato_api_bate_com_schema PASSED

============================== 9 passed in 8.32s ==============================
```

## 1.8 Lições Aprendidas e Pendências para v0.2

*(Espaço reservado para especificações futuras)*.
