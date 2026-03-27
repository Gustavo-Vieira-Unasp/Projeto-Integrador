# Documentação de Casos de Uso — Horta Comunitária Inteligente

**Projeto:** Horta Comunitária Inteligente  
**Versão:** 2.0  
**Data:** 2025  
**Fase:** Especificação Comportamental (SRS — Software Requirements Specification)

> **Nota de leitura:** Em cada passo dos fluxos abaixo, o ator responsável pela ação está explicitado entre colchetes — `[ESP32]`, `[Servidor]`, `[Dashboard]`, `[Administrador]` — para que a fronteira de responsabilidade entre hardware embarcado, backend e interface seja sempre inequívoca.

---

## Sumário

- [UC-01: Monitorar Dados Ambientais em Tempo Real](#uc-01-monitorar-dados-ambientais-em-tempo-real)
- [UC-02: Acionar Irrigação Manual](#uc-02-acionar-irrigação-manual)
- [UC-03: Executar Irrigação Automática por Regra](#uc-03-executar-irrigação-automática-por-regra)

---

## UC-01: Monitorar Dados Ambientais em Tempo Real

| Campo | Descrição |
|---|---|
| **ID** | UC-01 |
| **Nome** | Monitorar Dados Ambientais em Tempo Real |
| **Ator Principal** | ESP32 (Sistema Embarcado) |
| **Atores Secundários** | Servidor Backend, Dashboard Web, Administrador |

### Pré-condições

1. O ESP32 está energizado e com firmware v1.0+ gravado.
2. O ESP32 está conectado à rede Wi-Fi local e o IP do servidor backend está configurado no firmware.
3. O sensor DHT22 (temperatura e umidade do ar) está fisicamente conectado ao pino GPIO 4 do ESP32.
4. O sensor de umidade do solo (capacitivo) está inserido no substrato e conectado ao pino ADC do ESP32.
5. O endpoint `POST /api/v1/readings` do servidor backend está acessível e retornando respostas.
6. O ESP32 possui conectividade MQTT com o broker (porta 1883) ou HTTP com o servidor (porta 8080).

---

### Fluxo Principal (Caminho Feliz)

1. `[ESP32]` O timer interno dispara ao fim do intervalo de leitura configurado (padrão: 60 segundos).
2. `[ESP32]` Chama a biblioteca `DHT.h`: lê `temperatura` (°C) e `umidade_ar` (%) do sensor DHT22 via protocolo 1-Wire.
3. `[ESP32]` Lê o valor analógico do sensor de solo via `analogRead(PIN_SOLO)` e converte para porcentagem de saturação (`umidade_solo`).
4. `[ESP32]` Valida internamente cada leitura contra os limites aceitáveis:
   - `temperatura`: entre −10 °C e 80 °C
   - `umidade_ar`: entre 0 % e 100 %
   - `umidade_solo`: entre 0 % e 100 %
5. `[ESP32]` Monta o payload JSON e o assina com HMAC-SHA256 usando a chave do dispositivo:
   ```json
   {
     "device_id": "esp32-horta-01",
     "timestamp": "2025-06-15T14:32:00Z",
     "temperatura": 28.5,
     "umidade_ar": 65.2,
     "umidade_solo": 42.0
   }
   ```
6. `[ESP32]` Abre conexão TCP com o servidor e envia `POST /api/v1/readings` com o payload, aguardando resposta por até **5 segundos** (timeout configurável).
7. `[Servidor]` Recebe a requisição, valida a assinatura HMAC, confere se `device_id` existe no cadastro e persiste o registro no banco de dados (InfluxDB/PostgreSQL).
8. `[Servidor]` Retorna `HTTP 201 Created` com o corpo `{"id": "read-00892", "accepted": true}`.
9. `[ESP32]` Recebe o `201`, registra o ID de confirmação em log local na flash e fecha a conexão TCP.
10. `[Servidor]` Publica o novo registro no canal WebSocket `ws://servidor/stream/esp32-horta-01`.
11. `[Dashboard]` Recebe o evento WebSocket e atualiza os widgets de temperatura, umidade do ar e umidade do solo na tela do Administrador sem recarregar a página.

---

### Fluxos Alternativos

#### FA-01-A: Administrador não está com o Dashboard aberto

- **Ponto de desvio:** Passo 11 do Fluxo Principal.
- **Comportamento:**
  1. `[Servidor]` Persiste os dados normalmente; não há assinante WebSocket ativo, então o evento é descartado da fila de streaming sem erro.
  2. `[Dashboard]` Quando o Administrador abrir o Dashboard, o frontend envia `GET /api/v1/readings?device_id=esp32-horta-01&limit=100`.
  3. `[Servidor]` Retorna os 100 registros mais recentes com o campo `"source": "history"`.
  4. `[Dashboard]` Exibe os dados históricos com o badge **"Histórico"** em azul, diferenciando de dados ao vivo (badge **"Ao vivo"** em verde).

#### FA-01-B: Administrador altera o intervalo de leitura remotamente

- **Ponto de desvio:** Passo 1 do Fluxo Principal (antes do timer disparar).
- **Comportamento:**
  1. `[Administrador]` No painel de configurações, altera o intervalo de leitura para 30 segundos e clica em **"Salvar"**.
  2. `[Dashboard]` Envia `PUT /api/v1/devices/esp32-horta-01/config` com `{"reading_interval_seconds": 30}`.
  3. `[Servidor]` Valida o valor (mínimo: 10 s, máximo: 3600 s), persiste a configuração e publica no tópico MQTT `horta/esp32-horta-01/config` a mensagem `{"reading_interval_seconds": 30}`.
  4. `[ESP32]` Recebe a mensagem MQTT, atualiza o timer sem reinicialização e publica confirmação em `horta/esp32-horta-01/config/ack` com `{"status": "applied", "new_interval": 30}`.
  5. `[Servidor]` Recebe o ACK e atualiza o status da configuração para `CONFIRMED` no banco.
  6. `[Dashboard]` Exibe: _"Intervalo de leitura atualizado para 30 s em ESP32-Horta-01."_

---

### Fluxos de Exceção

#### FE-01-A: Sensor DHT22 retorna leitura inválida (NaN, 85 °C de curto ou valor fora de faixa)

- **Ponto de desvio:** Passo 2 ou 4 do Fluxo Principal.
- **Causa física:** Mal contato no pino de dados, cabo rompido, sensor danificado por umidade excessiva ou — caracteristicamente — curto entre VCC e DATA que faz o DHT22 retornar `85 °C` como valor fixo de erro.
- **Detecção pelo ESP32:** Após `DHT.read()`, o firmware verifica se o retorno é `isnan(temp)`, se `temp == 85.0` (sentinel de curto do DHT22), se `temp < -10.0` ou se `temp > 80.0`.
- **Comportamento:**
  1. `[ESP32]` Aguarda 2 segundos e tenta ler o DHT22 novamente — repete até **3 tentativas** no total.
  2. `[ESP32]` Se ao menos uma das 3 leituras for válida, usa esse valor no payload e retoma o Fluxo Principal a partir do Passo 4.
  3. `[ESP32]` Se as 3 tentativas falharem, monta o payload com os campos afetados como `null` e inclui o campo de diagnóstico:
     ```json
     {
       "device_id": "esp32-horta-01",
       "timestamp": "2025-06-15T14:32:00Z",
       "temperatura": null,
       "umidade_ar": null,
       "umidade_solo": 42.0,
       "sensor_error": "DHT22_READ_FAIL",
       "attempts": 3
     }
     ```
  4. `[ESP32]` Envia o payload normalmente (Passo 6 do Fluxo Principal). O ciclo de leitura não é interrompido para os sensores restantes.
  5. `[Servidor]` Recebe o registro, persiste com os campos nulos e classifica o evento como `SENSOR_FAULT` na tabela de alertas.
  6. `[Servidor]` Se `sensor_error` aparecer em **3 registros consecutivos** do mesmo dispositivo, dispara notificação push/e-mail ao Administrador: _"Sensor DHT22 em ESP32-Horta-01 com falha de leitura desde [timestamp]. Verifique a fiação do pino DATA."_
  7. `[Dashboard]` Substitui os widgets de temperatura e umidade do ar pelo aviso **"DHT22 — Leitura Indisponível"** em amarelo; os demais widgets (umidade do solo) continuam exibindo valores normalmente.
- **Impacto sistêmico:** O Motor de Regras (UC-03) **suspende** qualquer automação que dependa de `temperatura` ou `umidade_ar` para este dispositivo até que uma leitura válida seja registrada.

---

#### FE-01-B: ESP32 perde conexão Wi-Fi no momento do envio (timeout TCP)

- **Ponto de desvio:** Passo 6 do Fluxo Principal.
- **Causa física:** Instabilidade do roteador, queda de energia no AP, ESP32 saiu de alcance de sinal ou interferência de RF.
- **Detecção pelo ESP32:** A chamada `client.connect()` retorna `false`, ou `client.println()` não recebe resposta dentro dos 5 segundos de timeout — resultando em `ETIMEDOUT` ou `ECONNREFUSED`.
- **Comportamento:**
  1. `[ESP32]` Armazena imediatamente a leitura atual em **buffer circular na flash NVS** (Non-Volatile Storage), com capacidade de até 100 entradas. Cada entrada ocupa ~128 bytes (total: ~12,8 KB de espaço reservado).
  2. `[ESP32]` Inicia rotina de reconexão Wi-Fi: chama `WiFi.reconnect()` a cada **30 segundos**, por até **10 tentativas** (5 minutos no total).
  3. `[ESP32]` Durante a tentativa de reconexão, o timer de leitura continua normando — cada nova leitura válida é armazenada no buffer (não descartada).
  4. `[ESP32]` Ao reconectar com sucesso, envia todas as leituras em buffer em lote via `POST /api/v1/readings/batch` em uma única requisição, com o campo `"batch": true`.
  5. `[Servidor]` Recebe o lote, ordena as entradas por `timestamp`, persiste cada registro individualmente e retorna `HTTP 207 Multi-Status` com o resultado de cada item.
  6. `[ESP32]` Limpa o buffer somente após receber o `207` confirmando persistência. Se receber `5xx`, mantém os itens não confirmados e tentará novamente no próximo ciclo.
  7. `[ESP32]` Se o buffer atingir 100 entradas antes da reconexão, descarta as leituras **mais antigas** (política FIFO) e registra o campo `"buffer_overflow": true` na próxima transmissão bem-sucedida.
  8. `[ESP32]` Se após as 10 tentativas não reconectar, registra `WIFI_RECONNECT_FAIL` na NVS, reinicia apenas o módulo Wi-Fi (`WiFi.begin()`) sem reiniciar o MCU, e recomeça o ciclo de tentativas.
  9. `[Servidor]` Detecta ausência de heartbeat do dispositivo por mais de **2 minutos** e atualiza o status do dispositivo para `OFFLINE`.
  10. `[Dashboard]` Exibe o card do dispositivo com o indicador **"ESP32-Horta-01 — Offline"** em vermelho e o texto _"Última leitura recebida: [timestamp]"_.

---

#### FE-01-C: Servidor backend retorna erro HTTP 5xx

- **Ponto de desvio:** Passo 8 do Fluxo Principal.
- **Causa típica:** Sobrecarga do servidor, falha na conexão com o banco de dados, ou deploy interrompido a meio.
- **Detecção pelo ESP32:** A resposta HTTP tem status code ≥ 500.
- **Comportamento:**
  1. `[ESP32]` Interpreta qualquer `5xx` como falha temporária do servidor (não como erro de dados).
  2. `[ESP32]` Aplica **backoff exponencial com jitter**: aguarda 10 s + jitter aleatório (0–3 s), depois 20 s, 40 s e 80 s — totalizando até 4 retentativas antes de desistir.
  3. `[ESP32]` Cada retentativa reenvia exatamente o mesmo payload com o mesmo `timestamp` original (idempotência garantida pelo par `device_id` + `timestamp` como chave única no servidor).
  4. `[ESP32]` Se todas as 4 retentativas resultarem em `5xx`, armazena a leitura no buffer local (mesmo comportamento do FE-01-B a partir do passo 1) e aguarda o próximo ciclo de leitura (60 s) para nova tentativa.
  5. `[ESP32]` Não exibe nenhuma mensagem ao usuário — o Administrador é informado exclusivamente via Dashboard quando o servidor voltar e os dados chegarem com atraso (campo `"delayed": true` no payload do lote).

---

#### FE-01-D: Servidor rejeita o payload com HTTP 400 (dados corrompidos em trânsito ou assinatura inválida)

- **Ponto de desvio:** Passo 7 ou 8 do Fluxo Principal.
- **Causa típica:** Corrupção de bytes durante transmissão TCP (raro, mas possível em hardware com interferência), ou assinatura HMAC inválida por dessincronização de chave.
- **Detecção pelo Servidor:** Falha na validação de schema JSON ou na verificação da assinatura HMAC.
- **Comportamento:**
  1. `[Servidor]` Retorna `HTTP 400 Bad Request` com o corpo `{"error": "INVALID_PAYLOAD", "detail": "HMAC mismatch"}`.
  2. `[ESP32]` Recebe o `400` e **descarta** a leitura sem retentativas — um `400` indica erro permanente nos dados, não falha temporária.
  3. `[ESP32]` Registra o evento `PAYLOAD_REJECTED` na NVS com o timestamp afetado.
  4. `[Servidor]` Registra o evento de rejeição no log de segurança para auditoria.
  5. `[Dashboard]` Exibe alerta de segurança se houver mais de **5 rejeições em 1 hora** pelo mesmo dispositivo: _"ESP32-Horta-01: múltiplas falhas de autenticação detectadas. Verifique o firmware."_

---

### Pós-condições

| Cenário | Estado do Sistema |
|---|---|
| Execução bem-sucedida | Leitura persistida no banco com ID confirmado; Dashboard atualizado via WebSocket; ESP32 aguarda próximo ciclo (60 s). |
| FE-01-A (DHT22 com falha) | Registro parcial com `null` persistido; alerta após 3 falhas consecutivas; automações de temperatura/umidade_ar suspensas. |
| FE-01-B (Wi-Fi desconectado) | Leituras no buffer NVS; dispositivo "Offline" no Dashboard; dados enviados em lote ao reconectar. |
| FE-01-C (servidor 5xx) | Leitura em buffer após 4 retentativas; nova tentativa no próximo ciclo de 60 s. |
| FE-01-D (payload rejeitado 400) | Leitura descartada; evento de rejeição registrado; alerta de segurança após 5 rejeições/hora. |

---
---

## UC-02: Acionar Irrigação Manual

| Campo | Descrição |
|---|---|
| **ID** | UC-02 |
| **Nome** | Acionar Irrigação Manual |
| **Ator Principal** | Administrador (usuário autenticado via Dashboard Web) |
| **Atores Secundários** | Servidor Backend, Broker MQTT, ESP32, Relé, Bomba d'Água |

### Pré-condições

1. O Administrador possui sessão autenticada no Dashboard Web com token JWT válido (não expirado).
2. O ESP32 está no estado `ONLINE` — o Servidor recebeu heartbeat do dispositivo nos últimos **2 minutos**.
3. O relé e a bomba d'água estão fisicamente conectados ao pino de saída digital do ESP32.
4. O ESP32 está no estado `IDLE` — nenhuma irrigação (manual ou automática) está em execução para aquele dispositivo.
5. O nível do reservatório é suficiente (sensor de boia em estado `OK`), se o sensor estiver presente.

---

### Fluxo Principal (Caminho Feliz)

1. `[Administrador]` Acessa o painel do dispositivo "ESP32-Horta-01" no Dashboard Web.
2. `[Dashboard]` Envia `GET /api/v1/devices/esp32-horta-01/status` ao Servidor para verificar o estado atual.
3. `[Servidor]` Retorna `{"state": "IDLE", "online": true, "last_heartbeat": "14:31:55"}`.
4. `[Dashboard]` Exibe o botão **"Irrigar Agora"** habilitado e o campo de duração (padrão: 60 s; máximo: 300 s).
5. `[Administrador]` Define a duração como 90 segundos e clica em **"Irrigar Agora"**.
6. `[Dashboard]` Exibe modal de confirmação: _"Confirmar irrigação manual de 90 segundos no setor ESP32-Horta-01?"_
7. `[Administrador]` Clica em **"Confirmar"**.
8. `[Dashboard]` Envia ao Servidor `POST /api/v1/devices/esp32-horta-01/commands`:
   ```json
   {
     "command": "IRRIGATE",
     "duration_seconds": 90,
     "triggered_by": "admin@horta.com",
     "request_timestamp": "2025-06-15T14:32:10Z"
   }
   ```
9. `[Servidor]` Valida o token JWT, verifica se o dispositivo está `IDLE`, gera o evento `man-irrig-00381`, persiste com status `PENDING` e publica no tópico MQTT `horta/esp32-horta-01/commands`:
   ```json
   {
     "command": "IRRIGATE",
     "duration_seconds": 90,
     "event_id": "man-irrig-00381"
   }
   ```
10. `[Servidor]` Retorna `HTTP 202 Accepted` com `{"event_id": "man-irrig-00381", "status": "PENDING"}` ao Dashboard.
11. `[ESP32]` Recebe a mensagem MQTT, executa `digitalWrite(PIN_RELAY, HIGH)`, inicia o timer local de 90 segundos e publica em `horta/esp32-horta-01/status`:
    ```json
    {"state": "IRRIGATING", "event_id": "man-irrig-00381", "remaining_seconds": 90}
    ```
12. `[Servidor]` Recebe o status `IRRIGATING` via MQTT subscription e atualiza o evento `man-irrig-00381` para `EXECUTING`.
13. `[Dashboard]` Recebe a atualização via WebSocket e exibe **"Irrigando — 90 s restantes"** com barra de progresso decrescente.
14. `[ESP32]` Ao expirar o timer de 90 segundos, executa `digitalWrite(PIN_RELAY, LOW)` (desliga o relé) e publica:
    ```json
    {"state": "IDLE", "event_id": "man-irrig-00381", "duration_executed": 90}
    ```
15. `[Servidor]` Recebe o status `IDLE`, atualiza o evento para `COMPLETED` e registra o timestamp de conclusão.
16. `[Dashboard]` Exibe **"Irrigação concluída"** com o resumo: _"Duração: 90 s — Acionado por: admin@horta.com — 14:32:10."_

---

### Fluxos Alternativos

#### FA-02-A: Administrador interrompe a irrigação antes do fim

- **Ponto de desvio:** Passo 13 (durante irrigação ativa).
- **Comportamento:**
  1. `[Administrador]` Clica no botão **"Parar Irrigação"**, exibido em vermelho pelo Dashboard durante a irrigação.
  2. `[Dashboard]` Envia `POST /api/v1/devices/esp32-horta-01/commands` com `{"command": "STOP_IRRIGATE", "event_id": "man-irrig-00381"}`.
  3. `[Servidor]` Valida o token e publica `{"command": "STOP_IRRIGATE"}` no tópico MQTT do dispositivo.
  4. `[ESP32]` Recebe o comando, executa `digitalWrite(PIN_RELAY, LOW)` imediatamente, cancela o timer local e publica `{"state": "IDLE", "event_id": "man-irrig-00381", "duration_executed": 47, "stopped_by": "admin"}`.
  5. `[Servidor]` Atualiza o evento para `COMPLETED_EARLY` e registra `"duration_executed": 47`.
  6. `[Dashboard]` Exibe: _"Irrigação interrompida manualmente após 47 s."_

#### FA-02-B: Irrigação manual solicitada enquanto irrigação automática está em execução

- **Ponto de desvio:** Passo 3 do Fluxo Principal.
- **Comportamento:**
  1. `[Servidor]` Detecta que o dispositivo está com `{"state": "IRRIGATING", "triggered_by": "automation_rule_id_7"}` e retorna `HTTP 409 Conflict`:
     ```json
     {
       "error": "IRRIGATION_IN_PROGRESS",
       "triggered_by": "automation",
       "started_at": "14:30:00",
       "remaining_seconds": 45
     }
     ```
  2. `[Dashboard]` Exibe o aviso: _"Não é possível acionar manualmente: irrigação automática em andamento. Tempo restante: 45 s. Clique em 'Forçar Parada' para interromper."_
  3. `[Dashboard]` O botão **"Irrigar Agora"** permanece desabilitado; o botão **"Forçar Parada"** é exibido para que o Administrador possa interromper a automação (segue o FA-02-A a partir do passo 2).

---

### Fluxos de Exceção

#### FE-02-A: ESP32 não confirma o recebimento do comando MQTT (timeout de ACK)

- **Ponto de desvio:** Passo 11 do Fluxo Principal (ESP32 não publica `IRRIGATING`).
- **Causa física:** ESP32 perdeu a conexão Wi-Fi após enviar o último heartbeat, broker MQTT com latência extrema, ou firmware travado em rotina de leitura de sensor.
- **Detecção pelo Servidor:** Aguarda publicação de `{"state": "IRRIGATING"}` no tópico de status por até **8 segundos** após publicar o comando.
- **Comportamento:**
  1. `[Servidor]` Após 8 segundos sem confirmação, atualiza o evento `man-irrig-00381` para `COMMAND_TIMEOUT` e **não reenvia o comando** — reenvio automático poderia acionar a bomba de forma duplicada caso o ESP32 tivesse recebido o primeiro comando e apenas o ACK tivesse se perdido.
  2. `[Servidor]` Notifica o Dashboard via WebSocket: `{"event_id": "man-irrig-00381", "status": "COMMAND_TIMEOUT"}`.
  3. `[Dashboard]` Exibe o alerta em vermelho: **"ESP32-Horta-01 Inalcançável — Irrigação não iniciada."** O botão **"Irrigar Agora"** é desabilitado por **30 segundos** com contagem regressiva visível na interface.
  4. `[Dashboard]` Após os 30 segundos, reenvia automaticamente `GET /api/v1/devices/esp32-horta-01/status`. Se o dispositivo voltou a responder (`ONLINE`), reabilita o botão; se continuar offline, exibe: _"Dispositivo ainda offline. Verifique a conexão Wi-Fi do ESP32."_
  5. `[Servidor]` Registra o evento `COMMAND_UNACKNOWLEDGED` no log de auditoria com: `event_id`, `timestamp`, usuário `admin@horta.com`.

---

#### FE-02-B: Relé aciona mas a bomba não responde (falha física no atuador)

- **Ponto de desvio:** Passo 11 do Fluxo Principal (relé ativado, mas sem fluxo de corrente detectado).
- **Causa física:** Relé com contato oxidado, bomba queimada, fusível no circuito da bomba partido, ou cabo de alimentação rompido.
- **Detecção pelo ESP32:** Sensor de corrente ACS712 detecta corrente < 0,1 A no circuito da bomba após 500 ms do acionamento do relé, indicando que a bomba não está consumindo energia.
- **Comportamento:**
  1. `[ESP32]` Tenta acionar o relé **2 vezes** com intervalo de 1 segundo entre tentativas.
  2. `[ESP32]` Se após as 2 tentativas a corrente ainda for < 0,1 A, executa `digitalWrite(PIN_RELAY, LOW)` imediatamente (segurança: não manter relé ativado sem carga confirmada) e publica:
     ```json
     {
       "state": "ERROR",
       "event_id": "man-irrig-00381",
       "error_code": "ACTUATOR_FAIL",
       "detail": "pump_no_current",
       "relay_attempts": 2
     }
     ```
  3. `[Servidor]` Recebe o erro, atualiza o evento para `ACTUATOR_ERROR` e dispara alerta crítico imediato ao Administrador: _"Falha crítica: bomba d'água em ESP32-Horta-01 não respondeu ao acionamento. Verifique o relé, fusível e a bomba fisicamente."_
  4. `[Servidor]` Marca o dispositivo com a flag `fault: true` no banco. Qualquer tentativa de irrigação enquanto `fault: true` retorna `HTTP 423 Locked` com `{"error": "DEVICE_FAULT", "detail": "Manual reset required"}`.
  5. `[Dashboard]` Exibe em vermelho: **"Falha no atuador — Bomba não respondeu. ESP32-Horta-01 bloqueado."** O botão **"Irrigar Agora"** é desabilitado permanentemente até que um Administrador acesse `Configurações > Dispositivos > ESP32-Horta-01` e clique em **"Limpar Falha"** após confirmar o reparo físico.
  6. `[Servidor]` Ao receber `POST /api/v1/devices/esp32-horta-01/reset-fault` (com token de admin válido e confirmação de reparo), remove a flag `fault` e reabilita o dispositivo.

---

#### FE-02-C: Dashboard perde conexão durante irrigação ativa (usuário fechou o navegador)

- **Ponto de desvio:** Entre os Passos 13 e 16 do Fluxo Principal.
- **Causa típica:** Usuário fechou a aba, queda de internet do lado do cliente, ou timeout de sessão JWT.
- **Comportamento:**
  1. `[ESP32]` A irrigação **continua normalmente**: o timer de 90 s está rodando no firmware e é completamente independente da presença do Dashboard ou da conexão do cliente.
  2. `[ESP32]` Ao final dos 90 s, desliga o relé (`LOW`) e publica o status `IDLE` normalmente no MQTT (Passo 14 do Fluxo Principal).
  3. `[Servidor]` Recebe o status e conclui o evento `man-irrig-00381` como `COMPLETED` (Passo 15).
  4. `[Dashboard]` Na próxima vez que o Administrador abrir o Dashboard, o frontend consulta `GET /api/v1/devices/esp32-horta-01/events?limit=10` e exibe no histórico: _"Irrigação manual de 90 s concluída às 14:33:40 — acionada por admin@horta.com."_

---

#### FE-02-D: Nível do reservatório insuficiente no momento do acionamento

- **Ponto de desvio:** Passo 9 do Fluxo Principal (antes de publicar o comando MQTT).
- **Causa física:** Sensor de boia do reservatório está no estado `LOW` (nível crítico).
- **Comportamento:**
  1. `[Servidor]` Antes de publicar o comando MQTT, consulta o último estado do sensor de nível: `{"reservoir_level": "LOW"}`.
  2. `[Servidor]` Recusa o comando e retorna `HTTP 412 Precondition Failed` com `{"error": "RESERVOIR_LOW", "current_level": "LOW", "threshold": "MEDIUM"}`.
  3. `[Dashboard]` Exibe o aviso em laranja: _"Irrigação bloqueada: nível do reservatório insuficiente. Reabasteça o reservatório antes de irrigar."_ O botão **"Irrigar Agora"** permanece desabilitado enquanto o nível for `LOW`.
  4. `[Servidor]` Quando nova leitura do sensor indicar nível ≥ `MEDIUM`, notifica o Dashboard via WebSocket e o botão é reabilitado automaticamente.

---

### Pós-condições

| Cenário | Estado do Sistema |
|---|---|
| Execução bem-sucedida | Relé desligado; evento `COMPLETED` persistido; histórico atualizado; ESP32 retorna ao estado `IDLE`. |
| FA-02-A (interrupção manual) | Relé desligado imediatamente; evento `COMPLETED_EARLY` com duração real registrada. |
| FE-02-A (ESP32 inalcançável) | Evento `COMMAND_TIMEOUT`; botão bloqueado 30 s; auditoria registrada; relé **não foi acionado**. |
| FE-02-B (falha no atuador) | Relé desligado por segurança; evento `ACTUATOR_ERROR`; dispositivo bloqueado com flag `fault`; Admin notificado. |
| FE-02-C (Dashboard offline) | Irrigação concluída normalmente pelo ESP32; histórico disponível na próxima abertura do Dashboard. |
| FE-02-D (reservatório baixo) | Comando recusado no servidor; relé **não foi acionado**; botão desabilitado até nível ≥ MEDIUM. |

---
---

## UC-03: Executar Irrigação Automática por Regra

| Campo | Descrição |
|---|---|
| **ID** | UC-03 |
| **Nome** | Executar Irrigação Automática por Regra |
| **Ator Principal** | Sistema Automático (Servidor Backend — Motor de Regras) |
| **Atores Secundários** | ESP32, Broker MQTT, Relé, Administrador (notificado) |

### Pré-condições

1. Existe ao menos uma regra de automação no estado `ACTIVE` no banco (ex: _"Se umidade_solo < 30 % → irrigar por 120 s"_), configurada pelo Administrador.
2. A leitura mais recente de `umidade_solo` para o dispositivo é válida (não `null`, não `sensor_error`).
3. O ESP32 está `ONLINE` — heartbeat recebido nos últimos 2 minutos.
4. O ESP32 está no estado `IDLE` — nenhuma irrigação ativa.
5. O timestamp atual está dentro da janela de automação configurada (padrão: 06 h–21 h).
6. O cooldown entre irrigações automáticas foi respeitado — padrão: 30 minutos desde a última conclusão (`COMPLETED` ou `COMPLETED_EARLY`).
7. O dispositivo não possui a flag `fault: true`.

---

### Fluxo Principal (Caminho Feliz)

1. `[Servidor]` O Motor de Regras é acionado por evento: nova leitura de `umidade_solo = 24 %` chegou via `POST /api/v1/readings` para o dispositivo `esp32-horta-01`.
2. `[Servidor]` O Motor carrega todas as regras `ACTIVE` associadas ao dispositivo e avalia cada condição. A Regra #7 (`umidade_solo < 30 %`) é satisfeita.
3. `[Servidor]` Verifica as pré-condições 3 a 7 em sequência. Todas passam.
4. `[Servidor]` Cria o evento de automação `auto-irrig-00472` com status `SCHEDULED` e persiste no banco com os campos: `rule_id: 7`, `trigger_value: 24`, `threshold: 30`, `device_id: esp32-horta-01`.
5. `[Servidor]` Publica no tópico MQTT `horta/esp32-horta-01/commands`:
   ```json
   {
     "command": "IRRIGATE",
     "duration_seconds": 120,
     "triggered_by": "automation_rule_id_7",
     "event_id": "auto-irrig-00472"
   }
   ```
6. `[ESP32]` Recebe a mensagem MQTT, executa `digitalWrite(PIN_RELAY, HIGH)`, inicia o timer local de 120 s e publica em `horta/esp32-horta-01/status`:
   ```json
   {"state": "IRRIGATING", "event_id": "auto-irrig-00472", "remaining_seconds": 120}
   ```
7. `[Servidor]` Recebe o status `IRRIGATING` via MQTT subscription e atualiza o evento para `EXECUTING`.
8. `[Dashboard]` Recebe atualização via WebSocket e exibe o indicador **"Irrigação Automática em andamento — Regra #7 — 120 s"** para qualquer Administrador conectado.
9. `[ESP32]` Ao expirar o timer de 120 s, executa `digitalWrite(PIN_RELAY, LOW)` e publica:
   ```json
   {"state": "IDLE", "event_id": "auto-irrig-00472", "duration_executed": 120, "completed": true}
   ```
10. `[Servidor]` Recebe o status `IDLE`, atualiza o evento para `COMPLETED`, registra o timestamp de conclusão e inicia o temporizador de cooldown de 30 minutos para a Regra #7 no dispositivo `esp32-horta-01`.
11. `[Dashboard]` Registra no histórico: _"Regra #7 executada: umidade_solo=24 % < 30 % → irrigação de 120 s concluída às [timestamp]."_

---

### Fluxos Alternativos

#### FA-03-A: Nova leitura indica umidade acima do limiar antes de a irrigação terminar

- **Ponto de desvio:** Passos 7–9 (durante a execução).
- **Comportamento:**
  1. `[Servidor]` O Motor de Regras recebe nova leitura `umidade_solo = 38 %` enquanto o evento `auto-irrig-00472` está `EXECUTING`.
  2. `[Servidor]` Verifica se a regra de **interrupção antecipada** está habilitada na Regra #7 (campo `early_stop: true`).
  3. Se `early_stop: true`: `[Servidor]` publica `{"command": "STOP_IRRIGATE", "event_id": "auto-irrig-00472"}` no MQTT. `[ESP32]` executa `digitalWrite(PIN_RELAY, LOW)` imediatamente. `[Servidor]` registra o evento como `COMPLETED_EARLY` com a nota: _"Umidade alvo atingida após 67 s de 120 s planejados. Leitura final: 38 %."_
  4. Se `early_stop: false` (padrão): `[Servidor]` ignora a nova leitura durante a execução; a irrigação prossegue pelo tempo completo.

#### FA-03-B: Duas regras satisfeitas simultaneamente para o mesmo dispositivo

- **Ponto de desvio:** Passo 2 do Fluxo Principal.
- **Comportamento:**
  1. `[Servidor]` O Motor de Regras detecta que a Regra #7 (umidade_solo) e a Regra #9 (temperatura alta) são satisfeitas pelo mesmo payload de leitura.
  2. `[Servidor]` Ordena as regras pelo campo `priority` (menor valor = maior prioridade). A Regra #7 (`priority: 1`) supera a Regra #9 (`priority: 2`).
  3. `[Servidor]` Executa a Regra #7 normalmente (Fluxo Principal a partir do Passo 4).
  4. `[Servidor]` Registra a Regra #9 como `SKIPPED_CONFLICT` no log: _"Conflito com regra de maior prioridade #7 em execução."_
  5. `[Dashboard]` Exibe no painel de regras: _"Regra #9 ignorada — conflito de prioridade com Regra #7."_

---

### Fluxos de Exceção

#### FE-03-A: Leitura do sensor de umidade do solo chega como `null` ou com `sensor_error`

- **Ponto de desvio:** Passo 2 do Fluxo Principal.
- **Causa física:** Sensor capacitivo com mal contato, totalmente submerso (leitura saturada inválida), desconectado do pino ADC, ou a UC-01 registrou FE-01-A para o mesmo dispositivo.
- **Detecção pelo Motor de Regras:** A leitura mais recente possui `"umidade_solo": null` ou o registro contém o campo `"sensor_error"`.
- **Comportamento:**
  1. `[Servidor]` O Motor de Regras **não avalia** a condição `umidade_solo < 30 %` — uma leitura inválida jamais é tratada como "solo seco". Esta é uma decisão de segurança explícita: irrigar com dado inválido pode desperdiçar água ou alagar a horta.
  2. `[Servidor]` Registra o evento bloqueado como `RULE_SKIPPED` com motivo `SENSOR_DATA_INVALID` e timestamp.
  3. `[Dashboard]` Exibe no painel de automações: **"Regra #7 — Avaliação suspensa: sensor de solo indisponível desde [timestamp]."**
  4. `[Servidor]` Se `RULE_SKIPPED` ocorrer por **3 ciclos consecutivos** (≥ 15 minutos sem dado válido), dispara alerta ao Administrador: _"Atenção: Regra #7 bloqueada há 15+ minutos por falha no sensor de umidade do solo de ESP32-Horta-01. Verifique o sensor fisicamente."_
  5. `[Servidor]` Retoma a avaliação automaticamente na próxima leitura em que `umidade_solo` chegar com valor válido — sem necessidade de intervenção manual.

---

#### FE-03-B: ESP32 não confirma a execução do comando automático (timeout de ACK)

- **Ponto de desvio:** Passo 6 do Fluxo Principal.
- **Causa física:** ESP32 estava `ONLINE` no heartbeat anterior (pré-condição 3), mas perdeu conexão Wi-Fi entre o heartbeat e o recebimento do comando MQTT — situação comum em redes domésticas instáveis.
- **Detecção pelo Servidor:** Aguarda `{"state": "IRRIGATING"}` no tópico de status por até **10 segundos** após a publicação do comando.
- **Comportamento:**
  1. `[Servidor]` Após 10 s sem confirmação, marca o evento `auto-irrig-00472` como `COMMAND_TIMEOUT`.
  2. `[Servidor]` **Não reenvia o comando automaticamente.** Política de segurança: se o ESP32 recebeu o comando mas só o ACK se perdeu, um reenvio acionaria a bomba duplamente.
  3. `[Servidor]` Atualiza o status do dispositivo para `OFFLINE` e **não ativa o cooldown** — a irrigação não ocorreu de fato.
  4. `[Dashboard]` Exibe: **"Irrigação automática (Regra #7) não executada — ESP32-Horta-01 offline às [timestamp]."**
  5. `[Servidor]` Quando o dispositivo voltar ao estado `ONLINE` (próximo heartbeat recebido), o Motor de Regras reavalia as condições no próximo ciclo (até 5 minutos). Se `umidade_solo` ainda for < 30 %, um **novo evento** de automação é criado e o Fluxo Principal recomeça do Passo 4.

---

#### FE-03-C: Servidor perde conexão com o broker MQTT enquanto a irrigação já está em execução

- **Ponto de desvio:** Entre os Passos 5 e 9 do Fluxo Principal.
- **Causa típica:** Reinicialização do broker MQTT, falha de rede interna entre servidor e broker, ou sobrecarga de mensagens.
- **Comportamento:**
  1. `[ESP32]` Continua executando a irrigação pelo tempo programado (120 s). O timer no firmware é local e **não depende de conexão ativa** com servidor ou broker.
  2. `[Servidor]` Detecta a desconexão do broker via callback `onDisconnect` do cliente MQTT e registra `MQTT_BROKER_DISCONNECTED` com timestamp.
  3. `[Servidor]` Inicia reconexão com backoff exponencial: tenta após 5 s, 10 s, 20 s, 40 s…
  4. `[ESP32]` Ao final dos 120 s, desliga o relé (`LOW`) e tenta publicar `{"state": "IDLE", "event_id": "auto-irrig-00472", "completed": true}`. Se o broker estiver offline, a mensagem fica na fila de retenção do firmware (QoS 1) e será entregue ao reconectar.
  5. `[Servidor]` Ao reconectar ao broker, recebe a mensagem retida e reconcilia o evento `auto-irrig-00472` para `COMPLETED`.
  6. `[Servidor]` Se o broker foi reiniciado sem persistência de mensagens (QoS 0), o evento permanece em `EXECUTING`. Um job de reconciliação verifica eventos em `EXECUTING` com mais de **5 minutos além da duração prevista** e os marca como `STATUS_UNKNOWN`.
  7. `[Dashboard]` Eventos `STATUS_UNKNOWN` são exibidos com o aviso: **"Conclusão não confirmada — verifique o ESP32 fisicamente."** O Administrador pode marcar manualmente como `COMPLETED` ou `FAILED` via painel de eventos.

---

#### FE-03-D: Regra dispararia fora da janela de automação configurada

- **Ponto de desvio:** Passo 3 do Fluxo Principal (verificação de janela horária).
- **Causa:** Leitura chega às 23h45 com `umidade_solo = 24 %`, mas a janela de automação está configurada para 06h–21h.
- **Comportamento:**
  1. `[Servidor]` O Motor de Regras avalia a condição (`24 % < 30 %` → verdadeiro) mas falha na verificação de janela horária.
  2. `[Servidor]` Registra o evento como `RULE_SKIPPED` com motivo `OUTSIDE_TIME_WINDOW` e timestamp.
  3. `[Servidor]` **Não envia nenhum comando ao ESP32** — aguarda o próximo ciclo de avaliação que ocorra dentro da janela. Se às 06h00 a condição ainda for válida (umidade ainda baixa), o Fluxo Principal é executado normalmente a partir do Passo 4.
  4. `[Dashboard]` Exibe no histórico de regras: _"Regra #7 ignorada às 23:45 — fora da janela de automação (06h–21h)."_

---

### Pós-condições

| Cenário | Estado do Sistema |
|---|---|
| Execução bem-sucedida | Relé desligado; evento `COMPLETED` persistido; cooldown de 30 min ativado; histórico com causa registrada. |
| FA-03-A (`early_stop` ativado) | Relé desligado antes do prazo; evento `COMPLETED_EARLY`; cooldown ativado. |
| FE-03-A (sensor inválido) | Nenhum relé acionado; regra suspensa; alerta após 3 ciclos consecutivos; retomada automática com próxima leitura válida. |
| FE-03-B (ESP32 offline) | Evento `COMMAND_TIMEOUT`; relé **não acionado**; cooldown **não ativado**; reavaliação no próximo ciclo online. |
| FE-03-C (broker offline durante execução) | Irrigação concluída autonomamente pelo ESP32; reconciliação via QoS 1 ou job de timeout; `STATUS_UNKNOWN` se não reconciliável. |
| FE-03-D (fora da janela horária) | Regra ignorada; evento `SKIPPED`; reavaliação na próxima janela válida sem intervenção manual. |

---

## Referências e Próximos Passos

Esta especificação serve como contrato comportamental para as próximas etapas do projeto:

1. **RFC de Arquitetura** — os componentes identificados aqui (Motor de Regras, Broker MQTT com QoS 1, banco de séries temporais, job de reconciliação) devem ser detalhados com escolhas de tecnologia justificadas.
2. **Contrato de API (Swagger/OpenAPI)** — endpoints mapeados neste documento:

   | Método | Endpoint | Referência |
   |---|---|---|
   
   | `POST` | `/api/v1/readings` | UC-01, Passo 7 |
   | `POST` | `/api/v1/readings/batch` | UC-01, FE-01-B |
   | `GET` | `/api/v1/readings` | UC-01, FA-01-A |
   | `GET` | `/api/v1/devices/{id}/status` | UC-02, Passo 2 |
   | `PUT` | `/api/v1/devices/{id}/config` | UC-01, FA-01-B |
   | `POST` | `/api/v1/devices/{id}/commands` | UC-02, Passo 8 |
   | `POST` | `/api/v1/devices/{id}/reset-fault` | UC-02, FE-02-B |
   | `GET` | `/api/v1/devices/{id}/events` | UC-02, FE-02-C |

3. **Firmware do ESP32** — cada fluxo de exceção mapeia diretamente para uma rotina de firmware: buffer NVS (FE-01-B), backoff de reconexão (FE-01-B/C), validação de sentinels do DHT22 (FE-01-A), timer local de irrigação independente de rede (FE-02-C, FE-03-C) e detecção de corrente do atuador (FE-02-B).
4. **Testes de Integração** — cada Fluxo de Exceção documentado é um caso de teste obrigatório. Prioridade: FE-01-A (sensor com `85 °C`), FE-02-A (timeout de ACK), FE-03-C (broker offline durante execução) e FE-03-B (ESP32 offline entre heartbeat e comando).