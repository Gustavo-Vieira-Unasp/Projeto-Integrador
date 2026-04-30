# 🌱 Horta Comunitária Inteligente

<p align="center">
    <em>Sistema embarcado de monitoramento ambiental e irrigação automatizada para hortas comunitárias</em>
</p>

<p align="center">
    <a href="#equipe">Equipe</a> •
    <a href="#tema">Tema</a> •
    <a href="#escopo">Escopo</a> •
    <a href="#arquitetura">Arquitetura</a> •
    <a href="#hardware">Hardware</a> •
    <a href="#casos-de-uso">Casos de Uso</a> •
    <a href="#como-rodar">Como Rodar</a> •
    <a href="#processo">Processo</a> •
    <a href="#métricas">Métricas</a>
</p>

---

## Equipe

| Nome | Papel |
| ---- | ----- |
| **Gustavo Vieira** | Banco de Dados |
| **Jenifer Gomes** | Fullstack|
| **Luís Gabriel** | Análise e Frontend |
| **Philipe Gonçalves** | Hardware |
| **Victor Herédia** | - |

---

## Tema

Sistema IoT de monitoramento e controle automatizado de horta comunitária, utilizando microcontrolador ESP32, sensores ambientais e atuadores físicos integrados a um servidor backend e dashboard web em tempo real.

---

## Escopo

O projeto cobre três grandes frentes:

**Monitoramento ambiental contínuo** — coleta periódica (padrão: 60 s) de temperatura, umidade do ar (DHT22) e umidade do solo (sensor capacitivo), com envio autenticado via HMAC-SHA256 ao servidor e visualização em tempo real no dashboard via WebSocket.

**Irrigação manual** — o administrador aciona a bomba d'água remotamente pelo dashboard, define a duração (máx. 300 s) e acompanha o progresso com barra de progresso. O ESP32 executa o timer localmente, garantindo funcionamento mesmo que o dashboard seja fechado durante a operação.

**Irrigação automática por regras** — o motor de regras do servidor avalia cada nova leitura de sensores e dispara irrigação automaticamente quando as condições configuradas são atendidas (ex.: umidade do solo < 30 %), respeitando janela horária (padrão: 06h–21h) e cooldown entre execuções (padrão: 30 min).

### Fora do escopo (versão atual)

- Câmera OV2640 para monitoramento visual (em análise de viabilidade)
- Controle de múltiplas zonas independentes de irrigação
- Aplicativo mobile nativo

---

## Arquitetura

```.
┌─────────────┐        MQTT / HTTP        ┌──────────────────┐       WebSocket      ┌───────────────┐
│    ESP32    │ ◄───────────────────────► │ Servidor Backend │ ◄──────────────────► │  Dashboard Web│
│  (Firmware) │                           │ + Motor de Regras│                      │  (Admin)      │
└──────┬──────┘                           └────────┬─────────┘                      └───────────────┘
       │                                           │
  Sensores & Atuadores                    InfluxDB / PostgreSQL
  ├── DHT22 (temp + umidade ar)
  ├── Sensor capacitivo de solo
  ├── Relé 5V
  └── Bomba d'água 5V
```

**Componentes principais:**

- **ESP32** — coleta sensores, executa timers de irrigação localmente, armazena leituras em buffer NVS em caso de queda de rede e comunica via MQTT (QoS 1) e HTTP.
- **Servidor Backend** — valida assinaturas HMAC, persiste leituras, executa o motor de regras, publica eventos no broker MQTT e transmite atualizações ao dashboard via WebSocket.
- **Broker MQTT** — intermedia comandos entre servidor e ESP32 com entrega garantida (QoS 1).
- **Dashboard Web** — exibe dados ao vivo, histórico, status dos dispositivos e controles de irrigação manual/automática.

---

## Hardware

| # | Componente | Função | Prioridade |
| - | ---------- | ------ | ---------- |
| RF-001 | ESP32 DevKit | Unidade de processamento central, Wi-Fi 2.4 GHz | Must Have |
| RF-002 | Sensor capacitivo de solo | Umidade do solo (±3 %, 2 min/leitura) | Must Have |
| RF-003 | DHT22 | Temperatura (±0,5 °C) e umidade do ar (±2 %) | Must Have |
| RF-004 | LDR | Luminosidade ambiental (10–10.000 lux) | Must Have |
| RF-005 | Módulo Relé 5V | Acionamento elétrico da bomba d'água | Must Have |
| RF-006 | Mini Bomba d'água 5V | Irrigação (≥ 80 L/h) | Must Have |
| RF-007 | Sistema de alimentação solar | Painel ≥ 5W + controlador de carga, 24h sem sol | Must Have |
| RF-008 | Caixa hermética IP65 | Proteção física contra intempéries | Must Have |
| RF-009 | Atuador elétrico de janela | Ventilação automática da estufa | Must Have |
| RF-010 | Protoboard e jumpers | Montagem e prototipação dos circuitos | Must Have |
| NRF-011 | Câmera OV2640 2MP | Monitoramento visual (em análise) | Could Have |

---

## Casos de Uso

### UC-01 — Monitorar Dados Ambientais em Tempo Real

O ESP32 lê os sensores a cada 60 segundos, assina o payload com HMAC-SHA256 e envia ao servidor via `POST /api/v1/readings`. O servidor persiste os dados e publica via WebSocket para atualização instantânea no dashboard.

**Comportamentos de exceção notáveis:**

- Leitura inválida do DHT22 (incluindo sentinel `85 °C`): até 3 tentativas; campos afetados enviados como `null`; automações que dependem de temperatura umidade do ar são suspensas.
- Queda de Wi-Fi: leituras armazenadas em buffer circular NVS (até 100 entradas, ~12,8 KB); reenvio em lote via `POST /api/v1/readings/batch` ao reconectar.
- Erro 5xx do servidor: backoff exponencial com jitter (10 s → 20 s → 40 s → 80 s), 4 retentativas antes de armazenar localmente.
- Payload rejeitado com 400: descartado sem retentativa; alerta de segurança após 5 rejeições/hora.

---

### UC-02 — Acionar Irrigação Manual

O administrador define a duração (padrão: 60 s, máx: 300 s) e confirma pelo dashboard. O servidor valida o token JWT, verifica se o dispositivo está `IDLE` e publica o comando MQTT. O ESP32 executa o timer localmente, garantindo continuidade mesmo que o dashboard seja fechado.

**Comportamentos de exceção notáveis:**

- ESP32 não confirma o comando em 8 s: evento `COMMAND_TIMEOUT`; botão bloqueado por 30 s; **relé nunca foi acionado**.
- Falha no atuador (bomba sem corrente após 500 ms): relé desligado por segurança; dispositivo bloqueado com flag `fault` até reset manual pelo administrador.
- Reservatório com nível `LOW`: comando recusado com HTTP 412 antes de qualquer acionamento.

---

### UC-03 — Executar Irrigação Automática por Regra

A cada nova leitura, o motor de regras avalia as condições ativas. Se satisfeitas, cria um evento de automação e publica o comando MQTT ao ESP32, respeitando janela horária, cooldown de 30 minutos e ausência de flag `fault`.

**Comportamentos de exceção notáveis:**

- Sensor com leitura inválida (`null`): regra nunca é avaliada como "solo seco" — decisão de segurança explícita para evitar irrigação indevida.
- Duas regras satisfeitas simultaneamente: executa a de maior prioridade; a outra é registrada como `SKIPPED_CONFLICT`.
- Broker MQTT offline durante execução: o ESP32 continua pelo timer local; mensagem de conclusão entregue via QoS 1 ao reconectar; evento marcado como `STATUS_UNKNOWN` se não reconciliável.
- Leitura fora da janela horária: regra ignorada e reavaliada no próximo ciclo dentro da janela, sem intervenção manual.

---

### Endpoints de API

| Método | Endpoint | Referência |
| ------ | -------- | ---------- |
| `POST` | `/api/v1/readings` | UC-01 |
| `POST` | `/api/v1/readings/batch` | UC-01 — FE-01-B |
| `GET` | `/api/v1/readings` | UC-01 — FA-01-A |
| `GET` | `/api/v1/devices/{id}/status` | UC-02 |
| `PUT` | `/api/v1/devices/{id}/config` | UC-01 — FA-01-B |
| `POST` | `/api/v1/devices/{id}/commands` | UC-02 |
| `POST` | `/api/v1/devices/{id}/reset-fault` | UC-02 — FE-02-B |
| `GET` | `/api/v1/devices/{id}/events` | UC-02 — FE-02-C |

---

## Como Rodar

> **Em construção.** As instruções de configuração serão adicionadas conforme o ambiente de desenvolvimento for finalizado.

Pré-requisitos esperados:

- ESP32 com firmware v1.0+ gravado
- Broker MQTT acessível na porta 1883
- Servidor backend na porta 8080
- Banco de dados InfluxDB ou PostgreSQL configurado

---

## Processo

Acompanhe o processo de desenvolvimento clicando [aqui](process.md).

---

## Métricas

Veja as métricas usadas no desenvolvimento clicando [aqui](metrics.md).
