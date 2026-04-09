# Processo de Desenvolvimento

Este documento descreve o ciclo de trabalho adotado pela equipe do projeto **Horta Comunitária Inteligente**, cobrindo metodologia, critérios de qualidade e fluxo de contribuição via Pull Requests.

---

## Ciclo de Trabalho

A equipe adota um modelo híbrido **Scrum + Kanban**:

- O **Scrum** estrutura o tempo em sprints de **2 semanas** e define cerimônias de alinhamento.
- O **Kanban** controla o fluxo contínuo de tarefas dentro de cada sprint, limitando o trabalho em andamento (WIP) e tornando gargalos visíveis.

---

## Papéis da Equipe

| Papel | Responsabilidade |
| ----- | ---------------- |
| **Product Owner** | Prioriza o backlog e valida entregas com foco no valor do produto |
| **Scrum Master** | Facilita as cerimônias, remove impedimentos e protege o time |
| **Dev Team** | Todos os demais membros — desenvolvimento, hardware e testes |
| **Bombeiro da Sprint** | Membro em rodízio responsável por reviews prioritários (veja PR/Reviews) |

> Os papéis de PO e Scrum Master são rotativos entre os membros da equipe a cada ciclo.

---

## Sprints

- **Duração:** 2 semanas
- **Início:** segunda-feira
- **Encerramento:** sexta-feira da segunda semana, com cerimônias de review e retrospectiva

---

## Cerimônias

### Sprint Planning

- **Quando:** primeira segunda-feira da sprint
- **Duração:** até 2 horas
- **Objetivo:** selecionar itens do backlog que atendam ao DoR, definir o Sprint Goal e distribuir tarefas. O bombeiro da sprint é designado nesta reunião.

### Daily Standup

- **Quando:** diariamente (assíncrono, via canal da equipe)
- **Formato:** cada membro responde três perguntas — o que fez ontem, o que fará hoje e se há algum impedimento.

### Sprint Review

- **Quando:** última sexta-feira da sprint
- **Duração:** até 1 hora
- **Objetivo:** demonstrar o que foi entregue, validar contra o DoD e coletar feedback.

### Retrospectiva

- **Quando:** logo após a Review, na mesma sexta-feira
- **Duração:** até 45 minutos
- **Objetivo:** identificar o que funcionou, o que pode melhorar e definir até 2 ações concretas para a próxima sprint.

---

## Fluxo Kanban

O board é organizado nas seguintes colunas:

| Coluna | Descrição | WIP máx. |
| ------ | --------- | -------- |
| **Backlog** | Itens priorizados aguardando refinamento | — |
| **Pronto para Iniciar** | Itens que atendem ao DoR e podem ser puxados | — |
| **Em Progresso** | Tarefas ativamente em desenvolvimento | 2 por membro |
| **Em Review** | PR aberto aguardando revisão | — |
| **Bloqueado** | Tarefas com impedimento externo identificado | — |
| **Concluído** | Itens que atendem ao DoD e foram mergeados | — |

> Itens na coluna **Bloqueado** devem ter o impedimento descrito no card e ser mencionados no standup diário até sua resolução.

---

## DoR / DoD

### Definition of Ready (DoR)

Uma tarefa está pronta para entrar em sprint quando:

- [ ] Possui título claro e descrição objetiva do que deve ser feito
- [ ] Está associada a um caso de uso (UC-01, UC-02, UC-03) ou requisito de hardware (RF-XXX)
- [ ] Critérios de aceitação estão definidos e mensuráveis
- [ ] Dependências externas estão identificadas (ex.: sensor disponível, endpoint de API definido)
- [ ] Foi estimada pela equipe em pontos ou tamanho de camiseta

### Definition of Done (DoD)

Uma tarefa está concluída quando:

- [ ] O código foi implementado e compila sem erros
- [ ] Testes automatizados relevantes foram escritos e passam na CI
- [ ] O PR foi aprovado por no mínimo um revisor
- [ ] A documentação foi atualizada se houver impacto em endpoints, firmware ou fluxos de UC
- [ ] O item foi demonstrado ou validado em ambiente de staging
- [ ] O card foi movido para **Concluído** no board

---

## PR / Reviews

### Regra do Bombeiro

A cada sprint, um membro assume o papel de **bombeiro** — revisor prioritário da sprint. Sua responsabilidade é garantir que nenhum PR fique parado por mais de 24 horas sem resposta.

A ordem de rodízio segue a lista da equipe de forma sequencial e é confirmada no Sprint Planning. Caso o bombeiro esteja bloqueado, ele deve delegar explicitamente a outro membro via canal da equipe.

### Regras Gerais

- Todo PR requer **no mínimo um revisor** aprovado antes do merge.
- O revisor tem até **24 horas** para concluir o review após a abertura do PR.
- PRs sem review após 24 horas devem ser sinalizados no canal da equipe pelo próprio autor.
- Merges diretos na branch `main` sem PR são proibidos.

### Critérios de Aprovação

**Aprovado quando:**

- O código compila e os testes automatizados passam na CI.
- A lógica está de acordo com o caso de uso ou requisito referenciado no card.
- Não há código morto, logs de debug ou credenciais hardcoded.
- A descrição do PR explica **o quê** foi feito e **por quê**.

**Solicitar alterações quando:**

- Quebra testes existentes sem justificativa documentada.
- Introduz lógica duplicada já existente no projeto.
- Não possui descrição ou referência à tarefa/issue relacionada.
- Impacta um fluxo de UC ou endpoint sem atualizar a documentação correspondente.

### Labels de PR

| Label | Uso |
| ----- | --- |
| `feature` | Nova funcionalidade ou caso de uso |
| `fix` | Correção de bug não crítico |
| `hotfix` | Correção emergencial em produção (entra no cálculo do CFR) |
| `docs` | Alteração exclusiva em documentação |
| `chore` | Tarefas de manutenção, configuração de CI, dependências |
| `firmware` | Alterações exclusivas no código do ESP32 |
| `wip` | Trabalho em progresso — não está pronto para merge |
