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

## 1.3 Matriz de Riscos e Estratégia de Testes por UC

*(Espaço reservado para especificações futuras)*.

## 1.4 Estratégia de Testes por Nível

*(Espaço reservado para especificações futuras)*.

## 1.5 ADR - Técnica Moderna de Teste

*(Espaço reservado para especificações futuras)*.

## 1.6 Política de Qualidade e Estratégia de Pipeline

### Suíte obrigatória para merge em `main`

- Validação dos endpoints principais da API.
- Testes do fluxo de monitoramento ambiental em tempo real.
- Testes do acionamento manual da irrigação.
- Verificação básica de comunicação entre backend e dashboard.

Falhas em qualquer teste desta suíte devem bloquear o merge até correção.

#### Suíte não bloqueadora 

Os testes abaixo geram alerta, mas não impedem merge:

- Testes experimentais de performance.
- Verificações visuais não críticas do dashboard.
- Testes de funcionalidades ainda em validação.
- Logs de cobertura parcial de testes.

Esses alertas devem ser analisados pela equipe antes da release final.

##### Política de execução nightly e release

Antes de releases oficiais, deve ser executada uma suíte completa de regressão contendo:

- Testes de integração entre ESP32, backend e dashboard.
- Verificação da comunicação MQTT.
- Testes das automações de irrigação.
- Validação dos fluxos críticos da aplicação.

A execução manual da suíte de release é obrigatória antes da publicação de novas versões.

###### Política de regressão permanente

Todo bug corrigido deve gerar pelo menos um teste permanente de regressão para evitar problemas futuros no sistema.

###### Consistência com o plano SCM

A política de qualidade e regressão deve seguir as regras de proteção de branch e fluxo de versionamento definidos no plano SCM do projeto.

## 1.7 Evidência de Execução - Teste Contratual

*(Espaço reservado para especificações futuras)*.

## 1.8 Lições Aprendidas e Pendências para v0.2

*(Espaço reservado para especificações futuras)*.
