# SW - 1: Requisitos do Software para o Sistema de Monitoramento e Controle de Estufa Inteligente


## RF-001: Software
*Descrição: *
*Prioridade: 
            * Must have:
            * Should have:
            * Could Have:
*Critério de Aceitação:

---
# HW - 2: Requisitos do Hardware para o Sistema de Monitoramento e Controle de Estufa Inteligente

## RF-001: Unidade de Processamento (ESP32 DevKit)

**Descrição:**  
O sistema DEVE utilizar um microcontrolador capaz de coletar dados dos sensores, processar leituras localmente e transmitir os dados via rede Wi-Fi para a API do sistema.

### Prioridade

**Must Have**

- Conectividade Wi-Fi 2.4GHz integrada compatível com redes 802.11 b/g/n
- Capacidade de leitura simultânea de no mínimo 4 sensores
- Capacidade de envio de dados via HTTP ou MQTT
- Latência máxima de 1s entre leitura e envio do pacote
- Clock mínimo de 160 MHz

**Should Have**

- Mecanismo de segurança Watchdog Timer para recuperação automática
- Atualização OTA (Over The Air)
- Buffer local para dados caso a rede esteja indisponível

**Could Have**

- Modo Deep Sleep para economia de energia

### Critério de Aceitação

- Conexão à rede em menos de 10s após inicialização
- Envio contínuo de dados por 24h com perda inferior a 1%
- Funcionamento contínuo por 48h sem falhas

---

## RF-002: Sensor Capacitivo de Umidade do Solo

**Descrição:**  
O sistema DEVE captar dados sobre a umidade do solo e transmitir tais dados ao controlador central para análise.

### Prioridade

**Must Have**

- Taxa de amostragem de 2 minutos (~720 leituras/dia)
- Latência máxima de 500ms
- Acurácia de ±3%

**Should Have**

- Filtro de média móvel para ruído <100ms
- Grau de proteção IP67

**Could Have**

- Modo de baixo consumo entre leituras

### Critério de Aceitação

- Jitter máximo de 1% no intervalo de leitura
- Delay medido inferior a 500ms
- Precisão mantida após 24h em solos com diferentes condutividades

---

## RF-003: Sensor de Temperatura e Umidade (DHT22)

**Descrição:**  
O sistema DEVE coletar dados ambientais de temperatura e umidade relativa do ar.

### Prioridade

**Must Have**

- Medição entre -40°C e 80°C
- Medição de umidade de 0–100%
- Precisão de ±0.5°C e ±2% UR
- Leitura mínima a cada 2 minutos

**Should Have**

- Média móvel de 3 leituras
- Proteção contra condensação moderada

**Could Have**

- Sistema de alerta para temperaturas críticas

### Critério de Aceitação

- Diferença máxima de ±0.5°C comparado a termômetro de referência
- Operação contínua por 24h

---

## RF-004: Sensor de Luminosidade (LDR)

**Descrição:**  
O sistema DEVE monitorar a intensidade luminosa do ambiente.

### Prioridade

**Must Have**

- Detecção entre 10 lux e 10.000 lux
- Conversão analógica compatível com ESP32
- Tempo de resposta inferior a 200ms

**Should Have**

- Calibração baseada em referência externa
- Filtro de ruído

**Could Have**

- Métrica de exposição solar diária

### Critério de Aceitação

- Variação inferior a 10% comparado a luxímetro
- Detecção de mudança claro/escuro em até 500ms

---

## RF-005: Módulo Relé 5V

**Descrição:**  
O sistema DEVE controlar dispositivos elétricos externos como bombas de irrigação.

### Prioridade

**Must Have**

- Tensão de acionamento 5V
- Corrente mínima suportada de 10A
- Isolamento elétrico entre controle e carga

**Should Have**

- LED indicador de estado
- Proteção contra retorno de corrente

**Could Have**

- Proteção contra sobrecorrente

### Critério de Aceitação

- 100 ciclos de acionamento consecutivos sem falha
- Tempo de resposta inferior a 100ms

---

## RF-006: Mini Bomba de Água 5V

**Descrição:**  
O sistema DEVE realizar irrigação automática.

### Prioridade

**Must Have**

- Alimentação 5V DC
- Vazão mínima de 80 L/h
- Tempo de resposta inferior a 1s

**Should Have**

- Proteção contra funcionamento a seco
- Operação contínua de até 10 minutos

**Could Have**

- Controle de fluxo

### Critério de Aceitação

- Vazão estável durante 5 minutos
- Acionamento correto via sistema

---

## RF-007: Sistema de Alimentação Solar

**Descrição:**  
O sistema DEVE possuir alimentação baseada em energia solar.

### Prioridade

**Must Have**

- Painel solar mínimo de 5W
- Controlador de carga
- Operação por 24h sem luz solar

**Should Have**

- Monitoramento de nível da bateria
- Proteção contra sobrecarga

**Could Have**

- Otimização energética adaptativa

### Critério de Aceitação

- Operação contínua por 48h
- Recarga completa sob condições normais de insolação

---

## RF-008: Caixa Hermética

**Descrição:**  
O sistema DEVE possuir proteção física contra intempéries.

### Prioridade

**Must Have**

- Proteção mínima IP65
- Vedação contra chuva e poeira
- Espaço suficiente para os componentes

**Should Have**

- Passagem selada para cabos
- Sistema de fixação externa

**Could Have**

- Ventilação passiva

### Critério de Aceitação

- Teste de chuva simulada por 30 minutos
- Temperatura interna inferior a 50°C

---

## RF-009: Atuador Elétrico de Janela

**Descrição:**  
O sistema DEVE controlar a abertura ou fechamento automático de uma janela da estufa.

### Prioridade

**Must Have**

- Abertura ou fechamento completo em até 10 segundos
- Controle elétrico via microcontrolador
- Precisão mínima de 80%

**Should Have**

- Proteção IPX6
- Sensor de limite de curso

**Could Have**

- Controle gradual baseado na temperatura

### Critério de Aceitação

- 50 ciclos de abertura/fechamento sem falhas
- Tempo de operação inferior a 10s

---

## RF-010: Protoboard e Jumpers

**Descrição:**  
O sistema DEVE permitir montagem e testes iniciais dos circuitos.

### Prioridade

**Must Have**

- Conexões elétricas estáveis
- Mínimo de 400 pontos de conexão

**Should Have**

- Organização modular

**Could Have**

- Migração futura para PCB

### Critério de Aceitação

- Continuidade elétrica validada
- Operação estável por 24h

---

## NRF-011: Câmera OV2640/2mp (em Análise)

**Descrição:**  
O sistema PODERÁ capturar imagens da horta para monitoramento visual.

### Prioridade

**Must Have**

- Captura de imagens com resolução mínima 1600x1200
- Integração com ESP32-CAM

**Should Have**

- Envio de imagens via Wi-Fi

**Could Have**

- Processamento de imagem para detecção de pragas

### Critério de Aceitação

- Captura de imagem a cada 30 minutos
- Transmissão bem-sucedida em 90% das tentativas

---

### Nota

A câmera é considerada um recurso opcional devido ao aumento de consumo energético e complexidade de processamento, fora a questão de orçamento. A decisão final sobre sua inclusão será tomada após análise de viabilidade técnica e financeira.