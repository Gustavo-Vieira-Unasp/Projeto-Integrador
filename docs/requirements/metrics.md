# Métricas de Saúde, Fluxo e Qualidade

Este documento descreve as métricas adotadas no projeto **Horta Comunitária Inteligente** para acompanhar a saúde do processo de desenvolvimento e entrega de software.

O framework utilizado é o **DORA** (*DevOps Research and Assessment*), que permite enxergar o estado atual do fluxo, comparar com ciclos anteriores e priorizar melhorias com base em dados objetivos.

---

## DORA Metrics

| Métrica | Sigla | Meta |
| ------- | ----- | ---- |
| Deploy Frequency | DF | ≥ 1 deploy/semana |
| Lead Time for Changes | LT | < 72 horas |
| Change Failure Rate | CFR | < 45 % |
| Mean Time To Recovery | MTTR | < 1 dia |

---

### Deploy Frequency (DF)

**Definição:** Frequência com que o código é entregue em produção.

**Coleta:** Contagem de disparos do pipeline de deploy na branch `main` via GitHub Actions.

**Meta:** Mínimo de **1 deploy por semana**.

---

### Lead Time (LT)

**Definição:** Tempo médio entre o primeiro commit de uma tarefa e sua chegada em produção.

**Coleta:** `timestamp do merge commit` − `timestamp do primeiro commit da branch`. Extraído via API do Git.

**Meta:** Menor que **72 horas**.

---

### Change Failure Rate (CFR)

**Definição:** Percentual de deploys que resultam em falhas — bugs críticos, rollback ou necessidade de hotfix.

**Coleta:**

```.
CFR = (Número de Hotfixes / Total de Deploys) × 100
```

Hotfixes são identificados por PRs com a label `hotfix`.

**Meta:** Menor que **45 %**.

---

### Mean Time To Recovery (MTTR)

**Definição:** Tempo médio para restaurar o serviço após uma falha em produção.

**Coleta:** Intervalo entre a abertura de um incidente (ou disparo de alerta no monitoramento) e o deploy da correção.

**Meta:** Menor que **1 dia**.

---

## Referências

- [DORA State of DevOps Report](https://dora.dev)
- [Google Cloud — DORA Metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
