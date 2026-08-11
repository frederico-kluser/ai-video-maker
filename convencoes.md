# Convencoes de desenvolvimento -- Editor de Video IA

Este documento e normativo. Toda regra aqui e verificavel por script ou gate;
regra que nao pode ser verificada nao e convencao -- e intencao.

## Linguagens e dominios

| Linguagem | Onde | Por que |
|---|---|---|
| TypeScript | `src/composicao/`, `src/render/`, `src/sincronia/`, `src/contratos/` | Motor de composicao (Remotion), tipagem estatica para contratos |
| Python | `tools/`, `tests/`, `.agents/scripts/` | Scripts de ferramenta, validacao, gates, automacao |
| Bash | `tools/` (scripts shell) | Gates, preflight, worktree, CI |
| JSON Schema | `schema/` | Contratos de dados cross-language |

## Naming

| Escopo | Convencao | Exemplo |
|---|---|---|
| Arquivos e diretorios | `kebab-case` | `src/sincronia/legendas/`, `tools/validate-graph.py` |
| Funcoes e variaveis | `camelCase` | `resolveTimeline()`, `duracaoTotal` |
| Componentes React/Remotion | `PascalCase` | `<Cabecalho />`, `<TextoDestaque />` |
| Tipos e interfaces | `PascalCase` | `Manifesto`, `NoContrato`, `TimingEntry` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_CARACTERES_POR_SEGUNDO`, `DURACAO_MINIMA_LEGENDA` |
| IDs de card | `UPPER_SNAKE_CASE` com prefixo de fase | `F0-01`, `T-02`, `I-01` |
| Arquivos de teste | `*.test.ts`, `*.test.py` ou `*_selftest.py` | `contrato.test.ts`, `validate-graph_selftest.py` |

## Hash de conteudo

- Todo asset no store e enderecado por SHA-256 do seu conteudo.
- O hash e representado como hex (64 caracteres, minusculas).
- A chave de cache de um estagio de resolucao inclui **tudo** que muda a saida:
  entrada, versao do estagio, parametros, provedor. A omissao de um parametro
  na chave e um bug -- o cache acerta pelo motivo errado (C12).
- Nenhuma URL sobrevive apos o manifesto-resolvido. A referencia e sempre `hash`.

## Proibicoes absolutas

### Em `src/composicao/` (abaixo da fronteira)

- `Date.now()`, `new Date()`, `performance.now()`
- `Math.random()`, `crypto.getRandomValues()`
- `setTimeout()`, `setInterval()`
- `fetch()`, `XMLHttpRequest`, WebSocket
- Qualquer acesso a `process.env`, `localStorage`, `sessionStorage`
- Import dinamico condicional
- Iteracao sobre `Object.keys()` ou `for...in` sem ordenacao explicita

### Em todo o repositorio

- Literais de token duplicados: cor, espacamento, duracao, fonte, tamanho --
  todo literal de design vive exclusivamente em `src/design/tokens.ts` (e seu
  espelho Python gerado `tokens.py`). O gate `just design:varrer` procura
  literais fora de `src/design/` e falha se achar.
- Chaves de API, tokens ou segredos em qualquer arquivo rastreado. A excecao
  unica e `.env.example` (com valores placeholder).
- URLs hardcoded em `src/` (exceto em comentarios com citacao de fonte).
- Import de `framer-motion` -- usar `motion` ou `motion/react`.

## Commits

- Formato: [Conventional Commits](https://www.conventionalcommits.org/)
- Prefixos: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`
- Um commit por card (squash merge da worktree).
- Mensagem de commit inclui o id do card: `feat(F0-01): vocabulario e convencoes`
- O corpo do commit pode conter o handoff resumido.
- Co-autoria: `Co-Authored-By: Claude <noreply@anthropic.com>`

## Handoff

- Todo card concluido escreve um handoff no formato:
  ```
  ## O que fiz
  ## Arquivos modificados
  ## Premissas assumidas
  ## Para o proximo agente
  ## Bloqueios
  ```
- Campo `destinatarios` e obrigatorio -- lista os ids dos cards que dependem deste.
- Um handoff sem destinatarios e rejeitado pelo gate.
- O handoff e commitado junto com o codigo. E o **unico** canal de comunicacao
  entre ondas.

## Estrutura de um card

Ver `docs/adr/0002-contrato-de-card.md` para o contrato completo.

## Gate e oraculo

- Todo card declara um comando de aceitacao que sai `exit 0`.
- O comando **tem de** falhar (`exit != 0`) se o trabalho nao tiver sido feito
  (sonda negativa). Um runner com filtro que nao casa nada sai verde -- isso e
  falso verde (C2).
- Nenhum estagio do pipeline comeca sem um oraculo capaz de reprova-lo (ADR-0001).

## O que este documento NAO cobre

- Estrutura de diretorios -- ver `estrutura.md`
- Vocabulario -- ver `docs/vocabulario.md`
- Decisoes de arquitetura -- ver `docs/adr/`
- Especificacao de cards -- ver `PROGRAMA.html`
