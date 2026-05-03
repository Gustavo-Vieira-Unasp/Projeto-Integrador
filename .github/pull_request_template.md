# Pull Request

## Qual problema isso resolve?
<!-- Por que essa mudança é necessária? Qual problema ou necessidade ela atende? -->
O repositório não possuía nenhuma convenção explícita de contribuição, o que tornava difícil auditar mudanças, padronizar commits e garantir qualidade antes do merge. Este PR estabelece as bases do SCM da equipe.

## O que foi feito
<!-- Descreva de forma objetiva o que este PR implementa ou corrige. -->
- Criação do `docs/scm-plan.md` com política de branching, convenção de commits, definição de pronto e papéis da equipe
- Criação do `.github/pull_request_template.md` para padronizar a abertura de PRs
- Criação dos templates de issue `.github/ISSUE_TEMPLATE/bug_report.yml` e `feature_request.yml`

## Issue relacionada
<!-- Informe o número da issue ou UC que este PR atende -->

Closes #

## Tipo de mudança

- [ ] `feat` — nova funcionalidade
- [ ] `docs` — documentação
- [ ] `fix` — correção de bug
- [ ] `hotfix` — correção emergencial em produção
- [ ] `refactor` — refatoração sem mudança de comportamento
- [ ] `chore` — configuração, CI, dependências

## Como foi testado?
<!-- Descreva o passo a passo para o revisor validar as alterações -->

1. Verifique se os arquivos estão nos caminhos corretos (`.github/` e `docs/`)
2. Abra um PR de teste no repositório e confirme que o template é carregado automaticamente
3. Acesse Issues → New Issue e valide que os templates `bug_report` e `feature_request` aparecem como opção

## Checklist — Definição de Pronto

- [ ] A descrição explica o "porquê", não só o "o quê"
- [ ] Há link para a issue ou UC que este PR atende
- [ ] Pelo menos 1 revisor aprovou antes do merge
- [ ] O código compila e o build passa localmente
- [ ] O lint passa sem erros
- [ ] Não há `console.log` de debug, código morto ou credenciais hardcoded
- [ ] A documentação foi atualizada se a mudança afeta contrato ou arquitetura
- [ ] Nenhum dado de sensor ou credencial de hardware está hardcoded

## Evidências (opcional)
<!-- Logs, prints de resposta da API, ou saída do Arduino que comprovem o funcionamento -->
