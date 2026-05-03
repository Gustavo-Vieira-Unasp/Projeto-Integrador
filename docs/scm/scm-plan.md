# SCM Plan — Horta Inteligente

> Documento que governa como o repositório funciona a partir da A1.5.
> Todos os PRs do PI serão avaliados pela aderência a este plano.

---

## 1.1 Política de Branching

### Modelo adotado: GitHub Flow

A equipe adotou o **GitHub Flow** como modelo de branching.

**Por que GitHub Flow e não os outros?**

O GitFlow foi descartado porque ele pressupõe ciclos de release bem definidos e uma branch `develop` permanente — overhead desnecessário para um projeto acadêmico com entregas incrementais e equipe pequena. Manter branches paralelas de longa duração (`develop`, `release`, `hotfix`) em um time de 5+ pessoas aumenta a chance de conflitos sem trazer benefício real nessa escala.

O Trunk-based foi descartado porque exige maturidade alta em testes automatizados e feature flags para proteger a `main` de código incompleto — infraestrutura que a equipe ainda não possui neste estágio do PI.

O GitHub Flow resolve isso com simplicidade: toda contribuição sai de uma branch de curta duração, passa por PR e review, e é mergeada direto na `main` quando aprovada. O ciclo é curto, o histórico é rastreável e o fluxo cabe na rotina de um time acadêmico.

### Nomes de branch permitidos

| Prefixo | Uso | Exemplo |
|---|---|---|
| `feat/<escopo>` | Nova funcionalidade | `feat/endpoint-leituras` |
| `fix/<escopo>` | Correção de bug | `fix/sensor-null-crash` |
| `docs/<escopo>` | Documentação | `docs/scm-plan` |
| `refactor/<escopo>` | Refatoração sem mudança de comportamento | `refactor/servico-sensores` |
| `chore/<escopo>` | Configuração, CI, dependências | `chore/setup-linter` |
| `hotfix/<escopo>` | Correção emergencial em produção | `hotfix/autenticacao-arduino` |

Branches que não seguem esse padrão **não serão aceitas em PR**.

### Quem pode mergear em main

Qualquer membro da equipe pode mergear em `main`, **desde que**:

- O PR tenha pelo menos **1 aprovação** de outro membro da equipe
- Todos os status checks obrigatórios (CI) estejam passando
- O próprio autor **não** seja o único aprovador

---

## 1.2 Proteção da Branch Main

As seguintes regras estão ativas em **Settings → Branches → Branch protection rules** para a branch `main`:

- **Pull Request obrigatório** — push direto em `main` está bloqueado para todos os membros, incluindo administradores
- **Mínimo de 1 aprovação** — escolhemos 1 aprovação porque a equipe tem 5+ membros e exigir 2 travaria o fluxo de entregas incrementais do PI; 1 aprovação já garante que nenhum código entra sem revisão de um segundo par de olhos
- **Status checks obrigatórios** — o CI deve passar antes do merge (lint obrigatório; testes automatizados quando disponíveis)
- **Histórico linear obrigatório** — apenas merges com histórico linear (squash ou rebase) são permitidos, para manter o log da `main` legível
- **Sem force push** — reescrever o histórico da `main` está bloqueado
- **Branch deve estar atualizada** — o PR deve estar up-to-date com a `main` antes do merge

---

## 1.3 Convenção de Commits

### Padrão adotado: Conventional Commits

A equipe segue a especificação **Conventional Commits v1.0.0**.

Referência oficial: [https://www.conventionalcommits.org/pt-br/v1.0.0/](https://www.conventionalcommits.org/pt-br/v1.0.0/)

### Formato

```
<tipo>(<escopo>): <descrição curta em português>

[corpo opcional]

[rodapé opcional]
```

### Tipos permitidos

`feat`, `fix`, `docs`, `refactor`, `chore`, `hotfix`, `test`

### Exemplos reais deste projeto

```
feat(api): adiciona endpoint POST /api/v1/readings para receber leituras do ESP32

fix(sensores): corrige crash ao processar leitura com campo umidade nulo

docs(scm): adiciona plano de SCM, templates de PR e issue ao repositório
```

### Regras

- A descrição deve estar em **português**
- Máximo de **72 caracteres** na linha do título
- Use o corpo do commit para explicar o **porquê** da mudança quando necessário
- Commits fora do padrão serão solicitados para reescrita antes do merge

---

## 1.4 Definição de Pronto (Definition of Done)

Todo PR deve cumprir **todos** os itens abaixo antes de ser mergeado:

- [ ] A descrição do PR explica o **porquê** da mudança, não só o que foi feito
- [ ] O PR tem link para a issue ou UC que ele atende (`Closes #<número>`)
- [ ] Pelo menos **1 membro da equipe** (que não o autor) aprovou formalmente
- [ ] O lint passa sem erros (`npm run lint` ou equivalente)
- [ ] Não há `console.log` de debug, código morto ou credenciais hardcoded
- [ ] A documentação foi atualizada se a mudança afeta contrato de API ou arquitetura
- [ ] Nenhum dado de sensor, credencial de hardware ou token está hardcoded no código
- [ ] Os commits do PR seguem a convenção definida na seção 1.3

---

## 1.5 Papéis

| Responsabilidade | Responsável |
|---|---|
| Revisar PRs | **Todos** — Gustavo, Jenifer, Luís Gabriel, Philipe e Victor. Qualquer membro pode e deve revisar PRs abertos |
| Mergear em `main` após aprovação | O **próprio autor do PR**, após receber a aprovação obrigatória de outro membro |
| Manter o CI rodando | **Todos** — qualquer membro que detectar o CI quebrado deve abrir issue ou PR de correção imediatamente |
| Guardiã das regras de proteção de branch | **Gustavo Vieira** — responsável pela configuração do repositório no GitHub |

> **Nota:** "Todos revisam" não significa "ninguém é responsável". Se um PR ficar aberto por mais de **2 dias úteis** sem revisão, o autor deve mencionar a equipe no canal de comunicação para desbloqueá-lo.
