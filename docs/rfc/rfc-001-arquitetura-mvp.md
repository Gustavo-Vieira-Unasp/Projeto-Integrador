# RFC-XXX: <Título curto da decisão arquitetural> — <Nome do projeto>

> **Como usar este template:**
> Copie este arquivo para `docs/rfc/rfc-001-arquitetura-mvp.md` no repositório da equipe e preencha cada seção. Apague todos os blocos `> Instrução: ...` antes de entregar — eles existem só para te guiar. Veja [`exemplo-rfc.md`](exemplo-rfc.md) para um exemplo completo aplicado a outro projeto.

---

## Cabeçalho

| Campo     | Valor                                        |
| --------- | -------------------------------------------- |
| Status    | Em revisão                                   |
| Versão    | 0.1                                          |
| Autores   | < Gustavo, Philipe Luis G. Victor, Jenifer > |
| Data      | 2026-04-23                                   |
| Marco     | Marco 2 — Projetos conceituais aprovados     |
| Substitui | —                                            |

---

## 1. Contexto e Motivação

> **Instrução:** Em 4 a 8 linhas, descreva o sistema em termos de **capacidades**, não de tecnologias. Responda: o que o sistema faz, para quem, e qual é o cenário físico/operacional em que ele vive (restrições, ambiente, usuários típicos). Não cite ainda nenhuma tecnologia (Node, React, Postgres, etc.) — isso vem na seção 4. Aqui é só "o que" e "por quê", em linguagem de negócio.
> o sistema realiza o monitoramento contínuo das condições ambientais de uma horta comunitéria e executa ações automáticas de irrigação quando necessário. O mesmo é utilizado por cuidadores e administradores responsaveis pelo cultivo, que nem sempre estão presentes no local, uma operação externa e sujeito a variações climáticas, falhas de energia e instabilidade de conectividade. O sistema deve se manter funcionando continuamente mesmo com esses tipos de interrupcao, com objetivo de apoiar o cuidado da horta, reduzir desperdicio de agua e evitando condições inadequadas para as plantas

---

## 2. Escopo deste Marco

> **Instrução:** Liste objetivamente o que **está dentro** desta RFC e o que **fica deliberadamente de fora** (para versões futuras). O objetivo é evitar que o avaliador (ou o cliente) cobre por algo que vocês conscientemente decidiram não entregar agora. Use duas listas curtas: "Dentro" e "Fora".

**Dentro do escopo:**

- Monitoramento contínuo de temperatura, umidade do ar e umidade do solo
- Envio e visualização de dados ambientais em tempo real
- Irrigação manual acionada remotamente pelo administrador
- Irrigação automática baseada em regras definidas no sistema
- Comunicação entre dispositivos embarcados, backend e dashboard
- Controle de atuadores físicos (bomba d’água)

**Fora do escopo (próximas RFCs):**

- Aplicativo mobile nativo
- Processamento avançado de imagem e detecção de pragas
- Integração com visão computacional em tempo real (câmera)
- Controle de múltiplas zonas independentes de irrigação

---

## 3. Requisitos Atendidos

> **Instrução:** Faça uma lista com links relativos para os artefatos da equipe que esta RFC referencia, e indique quais são os **UCs críticos** que a arquitetura promete suportar (mínimo 3). A rastreabilidade entre RFC e Casos de Uso é avaliada — não pule.

- SRS (A1.2): [`docs/requirements/srs.md`](../requirements/srs.md)
- Casos de Uso (A1.3): [`docs/requirements/casos-de-uso.md`](../requirements/casos-de-uso.md)

**UCs críticos suportados por esta RFC:**

- **UC-01** — <Monitoramento em tempo real das condicoes da horta>
- **UC-02** — <Visualização de dados no histórico>
- **UC-03** — <Controle de irrigação (manual e automático)>

---

## 4. Stack Tecnológica

> **Instrução:** Tabela com as escolhas por camada. **Versões pinadas obrigatoriamente** — nada de "latest" ou "mais recente". A coluna "Por quê" tem **no máximo uma frase**; o trade-off detalhado vai no ADR correspondente da seção 6.

| Camada                 | Tecnologia            | Versão       | Por quê (1 frase)                            |
| ---------------------- | --------------------- | ------------ | -------------------------------------------- |
| Microcontrolador       | ESP32                 | ESP-WROOM-32 | Possui Wi-Fi integrado e suporte a sensores  |
| Comunicação IoT        | MQTT                  | 3.1.1        | Protocolo leve e confiável para IoT          |
| Broker MQTT            | Mosquitto             | 2.0          | Implementação estável e amplamente utilizada |
| Backend / API          | Node.js + NestJS      | 20.11 / 10.3 | Estrutura modular e escalável                |
| Comunicação tempo real | WebSocket (Socket.IO) | 4.7          | Atualização em tempo real no dashboard       |
| Frontend               | React                 | 18.2         | Interface reativa e dinâmica                 |
| Banco relacional       | PostgreSQL            | 15           | Armazena dados estruturados                  |
| Banco temporal         | InfluxDB              | 2.7          | Otimizado para séries temporais              |

---

## 5. Arquitetura do Sistema

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

### 5.1 Diagrama de Componentes

> **Instrução:** Mostre os componentes principais e suas conexões. Aceita-se imagem em `assets/`, código Mermaid embutido, PlantUML, ou link público para Draw.io/Figma com screenshot embutida. **Cada seta deve ter um rótulo** indicando o tipo de comunicação (HTTP REST, WebSocket, SQL, Serial, etc.).
> arquitetura em:
> docs/assets/arquitetura.png

```mermaid
flowchart LR
  A[Componente A] -- HTTP REST --> B[Componente B]
  B -- SQL --> C[(Banco)]
```

### 5.2 Fluxo de Dados (Cenários)

> **Instrução:** Descreva **no mínimo 2 cenários** passo a passo, com responsabilidade explícita por passo. Cada cenário deve **citar o UC correspondente** da A1.3.

## Cenário 1: < monitoramento > (atende UC-01)

1. ESP32 coleta dados dos sensores
2. Publica via MQTT (QoS 1)
3. Broker encaminha ao backend
4. backend valida
5. armazena no influxDB
6. envia via webSocket ao dashboard

## Cenário 2: < irrigação manual > (atende UC-03)

1. Usuário aciona ao dashbord
2. Frontend envia HTTP
3. Backend valida
4. Backend publica MQTT
5. ESP32 aciona relé
6. Bomba é acionada

### 5.3 Fronteiras e Responsabilidades

> **Instrução:** Para cada componente principal, diga em uma linha **o que ele é responsável por** e **o que ele NÃO faz**. Definir o que NÃO é responsabilidade é tão importante quanto definir o que é.

| Componente  | Responsável por                                   | NÃO faz                               |
| ----------- | ------------------------------------------------- | ------------------------------------- |
| ESP32       | Coleta sensores, executa atuadores e buffer local | Não processa regras complexas         |
| Broker MQTT | Entrega mensagens                                 | Não processa lógica                   |
| Backend     | Processamento, regras e validação                 | Não interage diretamente com hardware |
| InfluxDB    | Dados de sensores                                 | Não armazena usuários                 |
| PostgreSQL  | Configurações                                     | Não armazena séries temporais         |
| Frontend    | Interface do usuário                              | Não executa lógica crítica            |

---

## 6. Decisões de Arquitetura (ADRs)

> **Instrução:** Mínimo de **2 ADRs** documentando decisões com trade-off real. Cada ADR vai **embutido aqui** (não em arquivo separado). Decisões que não envolvem trade-off (ex: "escolhemos Git porque todo mundo usa") não viram ADR. Escolhas como REST vs WebSocket, SQL vs NoSQL, polling vs push, monolito vs serviços, hospedagem em nuvem vs local, sim — viram ADR. Use o formato abaixo para cada uma.

### ADR-001: Uso de MQTT

**Status:** Aceito  
**Data:** 2026-04-23

**Contexto.**  
A comunicação entre dispositivos IoT e o backend deve ser eficiente, tolerante a falhas e operar em cenários de conectividade instável.

**Opções consideradas:**

1. **Opção A — HTTP**

   - Prós:
     - Simples implementação
     - Amplamente suportado
   - Contras:
     - Maior consumo de banda
     - Modelo request/response pouco eficiente para IoT
     - Não possui garantia de entrega

2. **Opção B — MQTT**
   - Prós:
     - Protocolo leve baseado em publish/subscribe
     - Suporte a QoS (garantia de entrega)
     - Baixo consumo de rede
     - Adequado para conexões instáveis
   - Contras:
     - Necessidade de broker
     - Maior complexidade inicial

**Decisão.**  
Escolhemos MQTT por oferecer melhor eficiência, confiabilidade e suporte a QoS para comunicação IoT.

**Consequências.**

- Positivas:
  - Comunicação eficiente e confiável
  - Menor consumo de rede
- Negativas:
  - Dependência de broker MQTT
  - Maior complexidade de infraestrutura

---

### ADR-002: <Banco híbrido>

**Status:** Aceito
**Data:** AAAA-MM-DD

**Contexto.** O sistema armazena dois tipos de dados distentos: dados contínuos de sensores, no caso, alta frequência, e dados estruturados como usuario e configuracoes. É necessário escolher uma abordagem que atenda ambos os cenários

**Opções consideradas:**

1. ## Opção A — < Apenas PostgreSQL >

   - Prós:
   - Simplicidade de arquitetura
   - Fácil manutenção
   - Forte suporte a relacionamentos

   - Contras:
   - Baixa eficiêencia para séries temporais
   - consultas de histórico lentas a depender de come se acessa
   - escalabilidade limitada para alta frequência de dados

2. ## Opção B — < Apenas InfluxDB >

   - Prós:
   - otimizado para dados de sensores
   - alta performance em leitura e escrita contínua
   - funções nativas para séries temporais

   - Contras:
   - não é muito ideal para dados relacionais
   - dificuldade para modelar usuarios e permições
   - menor flexibilidade geral

3. **Opção C — Híbrido (PostgreSQL + InfluxDB)**
   - Prós:
     - Melhor desempenho para cada tipo de dado
     - Separação clara de responsabilidades
     - Escalabilidade mais eficiente
   - Contras:
     - Maior complexidade de arquitetura
     - Necessidade de gerenciar dois bancos
     - Sincronização mais complexa

**Decisão.**  
Adotar a abordagem híbrida, utilizando PostgreSQL para dados estruturados e InfluxDB para séries temporais, pois atende melhor aos requisitos distintos do sistema

**Consequências.**

- Positivas:

  - melhor desempenho para cada tipo de dado
  - separação clara de responsabilidade
  - escalabilidade mais eficiente

- Negativas:
  - maior complexibilidade de arquitetura
  - necessidade de gerenciar dois bancos
  - Sincronizacao e manutencao mais difíces

---

## 7. Telas (Wireframes)

> **Instrução:** Wireframes das **4 telas principais** do sistema. Aceita-se: imagens PNG/JPG em `assets/wireframes/` embutidas via markdown, link para projeto público no Figma com screenshot de cada tela embutida, ou wireframes desenhados à mão e fotografados (desde que legíveis). **Não precisa ser bonito** — precisa mostrar quais informações aparecem, quais ações o usuário toma, e como navega entre as telas. **Para cada tela, cite qual UC ela atende.**

### 7.1 Tela 1 — < Dashbord > (atende UC-01)

![Tela 1](assets/wireframes/tela-1.png)

**Informações exibidas: sensores em tempo real
**Ações disponíveis: visualizar dados
\*\*Navegação: historico

### 7.2 Tela 2 — <histórico> (atende UC-02)

![Tela 2](assets/wireframes/tela-2.png)

**Informações exibidas: gráficos
**Ações disponíveis: filtrar os dados
\*\*Navegação: pelo proprio dashbord

### 7.3 Tela 3 — < Controle > (atende UC-03)

**Informações exibidas: estado da irrigação da horta
**Ações disponíveis: ligar e desligar
\*\*Navegação: dashbord

### 7.4 Tela 4 — <configurações> (atende UC-XX)

**Informações exibidas: regras
**Ações disponíveis: editar
\*\*Navegação: controle

## 8. Riscos e Mitigações

> **Instrução:** Mínimo de **3 riscos específicos da arquitetura escolhida**. Riscos genéricos como "atraso na entrega" ou "alguém ficar doente" não contam — esses entram no plano de projeto, não na RFC. Aqui ficam riscos diretamente ligados às decisões técnicas que vocês acabaram de tomar.

| Risco                            | Probabilidade | Impacto | Mitigação                                    |
| -------------------------------- | ------------- | ------- | -------------------------------------------- |
| Falha de conectividade           | Alta          | Alto    | Buffer local no ESP32 com envio posterior    |
| Indisponibilidade do broker MQTT | Média         | Alto    | Reconexão automática com backoff exponencial |
| Dados inconsistentes             | Média         | Médio   | Validação e sanitização no backend           |

---

## 9. Fora do Escopo / Próximos Passos

> **Instrução:** Curtinho. O que esta RFC **não** resolve e fica para uma RFC futura ou para a próxima fase do PI. Reforça os limites da seção 2 e dá visibilidade para o que vem depois.

- Aplicativo mobile
- VIsao computacional
- ...

---

## Referências

> **Instrução (opcional):** Links para documentação oficial das tecnologias escolhidas, artigos que embasaram decisões, RFCs de outros projetos que vocês consultaram, etc.

- ...
