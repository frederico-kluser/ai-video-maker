# ADR-0002: Contrato de card

**Status:** ACEITO
**Data:** 2026-08-11
**Decisores:** programa-editor-video-ia
**Supera:** Nenhum (ADR inaugural)

## Contexto

O programa e executado por agentes de IA em git worktrees paralelas. Cada
agente recebe um card -- uma especificacao autocontida de trabalho -- e
produz codigo, testes e um handoff. O card e a unidade de trabalho do
programa.

Sem um contrato de card, cada card teria formato, nivel de detalhe e
criterio de aceitacao diferentes. Um card subespecificado faz o agente
improvisar; um card superespecificado faz o trabalho de tres cards e
viola a propriedade de arquivo.

A pergunta que este ADR responde: **o que e um card, e quais sao seus
campos obrigatorios?**

## Decisao

Todo card segue este contrato. Campos obrigatorios sao verificados pelo
validador de grafo (`T-02`). Campos ausentes ou malformados **falham o gate**.

### Campos obrigatorios

| Campo | Tipo | Descricao |
|---|---|---|
| `id` | string | Identificador unico. Formato: `<FASE>-<NUM>`, ex: `F0-01`, `T-02`, `I-01` |
| `titulo` | string | Resumo de uma linha. O que o card entrega. |
| `onda` | string | Onda a que pertence. Formato: `W<N>` ou `W<N>.5`. Ex: `W0`, `W2.5` |
| `dependencias` | list\[id\] | Ids dos cards que precisam estar concluidos antes deste. Lista vazia para cards raiz. |
| `disciplina` | enum | `tdd` (teste e a especificacao), `caracterizacao` (snapshot aprovado por humano), `ambos` (convivem no mesmo card). Decidida pelo orquestrador, nunca pelo executor. |
| `arquivos` | list\[path\] | Arquivos dos quais este card e dono. Nenhum outro card da mesma onda pode escrever neles. |
| `criterios_aceitacao` | list\[string\] | Lista de comandos que provam o card. Cada criterio inclui `∅-crit` (criterio vazio): o comando que **falha** se o trabalho nao tiver sido feito. |
| `∅-crit` | string | Para cada criterio de aceitacao, o complemento negativo: o comando que prova que o criterio **sabe reprovar**. Ex: "apagar o snapshot aprovado tem de ficar vermelho". |
| `perguntas_refutacao` | list\[string\] | Tres perguntas que, se respondidas de uma forma, refutam a premissa do card. Numeradas (1), (2), (3). |
| `skills_obrigatorias` | list\[string\] | Skills que o agente deve carregar antes de comecar. Nome do diretorio em `.agents/skills/`. |
| `restricoes` | list\[string\] | O que o card NAO deve fazer. Cada restricao nomeia o card dono do que ficou de fora. |

### Tamanho

Um card tem entre **60 e 180 linhas**. Um card de 20 linhas esta subespecificado --
a sessao do agente e amnésica e ele vai improvisar. Um card de 400 linhas esta
fazendo o trabalho de tres -- deve ser dividido.

### Disciplina

A disciplina e decidida pelo orquestrador, nunca pelo executor. Um agente que
escolhe a propria disciplina escolhe a que e mais facil de satisfazer.

- **tdd:** O comportamento nao existe ainda. O teste e a especificacao.
  Escreva o teste primeiro, veja-o falhar, implemente, veja-o passar.
- **caracterizacao:** O comportamento ja existe (ex: saida de API externa).
  O snapshot aprovado e a referencia. Captura-se o comportamento atual e
  compara-se com o snapshot.
- **ambos:** Parte do card e tdd, parte e caracterizacao. Ex: um no de
  composicao tem snapshot aprovado (caracterizacao) e teste de overflow (tdd).

### Criterio vazio (∅-crit)

O criterio vazio e o complemento negativo de cada criterio de aceitacao.
Ele existe para garantir que o criterio **sabe reprovar** -- nao apenas
celebrar.

Exemplos:
- Criterio: `just no:Cabecalho` → exit 0
- ∅-crit: "apagar o snapshot aprovado tem de ficar vermelho"

- Criterio: `just store:testar` → exit 0
- ∅-crit: "mover o store para fora e rodar o teste tem de dar exit 1"

Um criterio sem ∅-crit e invalido. O verificador de aceitacao (`T-06`)
rejeita cards sem ∅-crit.

### Perguntas de refutacao

Tres perguntas, numeradas, que um revisor adversarial faria. Cada pergunta
deve ser respondida pelo card (pela implementacao, nao pelo autor). Se a
resposta for "sim, isso acontece", a premissa do card esta refutada.

Nao sao perguntas retoricas -- sao o mecanismo de revisao adversarial
(`adversarial-review`). Exemplos:

- (1) O glossario define "cassete" e "snapshot" de forma que alguem consiga
  confundi-los? Escreva a frase que os separa.
- (2) A convencao de hash inclui **tudo** que muda a saida? Nomeie um
  parametro que mudaria o resultado e nao esta na chave.
- (3) O ADR-0001 tem guarda executavel, ou e uma intencao?

### Skills obrigatorias

Lista de skills que o agente executor deve carregar. Cada entrada e o nome
do diretorio em `.agents/skills/`. O card `F0-01` (este) nao declara skills
obrigatorias porque e documentacao pura -- mas e a excecao, nao a regra.

Exemplo: `skills_obrigatorias: [falsifiable-gates, project-router, video-characterization]`

### Restricoes (fronteira negativa)

Cada restricao e uma frase no formato: "Nao faca X. X e responsabilidade de
`<CARD>`." Isso garante que o card sabe o que **nao** e seu escopo e nomeia
o dono do que ficou de fora.

Exemplos:
- "Nao crie package.json, tsconfig.json ou .gitignore. Isso e `T-01`."
- "Nao defina o schema do manifesto. Isso e `F0-02`."
- "Nao implemente o harness de determinismo. Isso e `F0-06`."

## Consequencias

### Positivas

1. **Cards sao comparaiveis.** Todo card tem a mesma estrutura, os mesmos
   campos obrigatorios. O validador de grafo (`T-02`) consegue parsear e
   verificar todos eles.

2. **O criterio de aceitacao e executavel.** Nao existe "o video parece
   certo" -- existe um comando que sai `exit 0` ou `exit != 0`.

3. **A fronteira negativa e explicita.** Todo card declara o que NAO faz
   e quem e o dono do que ficou de fora. Isso previne o problema classico
   de dois cards implementarem a mesma coisa de formas diferentes.

### Negativas

1. **Custo de escrita.** Um card bem especificado leva tempo para escrever.
   O orquestrador gasta mais tempo planejando do que um processo ad-hoc.

2. **Rigidez.** Um card que foi mal especificado nao pode ser corrigido
   pelo executor -- ele entrega o que o card pede e registra a divergencia
   no handoff. A correcao exige um novo card (branch `PREP-<slug>`).

## Guarda executavel

O validador de grafo (`T-02`) verifica que todo card parseado tem todos os
campos obrigatorios. O verificador de aceitacao (`T-06`) verifica que todo
criterio de aceitacao tem ∅-crit e que o seletor casa pelo menos um teste.

## O que o sign-off NAO autoriza

- Cards sem ∅-crit -- "o teste passa" sem sonda negativa e intencao, nao card.
- Cards sem perguntas de refutacao -- a revisao adversarial e parte do metodo.
- Cards sem `skills_obrigatorias` -- um agente sem as skills certas e um
  agente que improvisa com conhecimento desatualizado.
- Cards com mais de 180 linhas -- e um sinal de que o card esta fazendo o
  trabalho de dois ou mais cards.

## O que este documento NAO cobre

- Como escrever criterios de aceitacao falsificaveis -- ver skill `falsifiable-gates`
- Como planejar ondas e atribuir cards -- ver skill `wave-planning`
- O formato de handoff -- ver `convencoes.md`
