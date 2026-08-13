# Contrato da W5 — integração, timing canônico e autoria

Commit `PREP-w5`. Publicado **antes** de qualquer worktree da W5 existir, porque
uma worktree materializa apenas o que esta commitado: preparacao deixada no
checkout principal nao chega nos agentes, e a divergencia aparece no merge como
trabalho a refazer.

Cinco agentes rodam esta onda em paralelo. **Nenhum enxerga os outros.** Tudo
que eles precisam em comum esta neste arquivo e nos ADRs renumerados em
`docs/adr/` (a colisao de numeros da W3/W4 foi resolvida no PREP: `0001`..`0021`
unicos, por ordem cronologica de merge — ver a tabela no handoff do PREP).

---

## 1. Mapa arquivo -> dono

A terceira coluna e o que da contratualidade. Sem ela, isto e uma sugestao.

**Os caminhos abaixo NAO existem no disco ainda** — cada card cria os seus no
primeiro commit. Nenhum card escreve fora do proprio mapa.

| Arquivo / diretorio | Dono | Os outros |
|---|---|---|
| `tests/integracao/composicao/**` + `fixtures/snapshots/integrado/**` | F1-12 | nao editam |
| `tests/integracao/resolucao/**` + `tools/offline-guard.*` | F2-07 | nao editam |
| `src/sincronia/timing/**` + `schema/timing.schema.json` | F3-01 | nao editam |
| `src/autoria/contrato/**` | F4-01 | nao editam |
| `docs/autoria/prompts/**` | F4-02 | nao editam |

### Compartilhados nesta onda — so acrescente

- `docs/adr/` — **um arquivo novo por card** com o numero pre-alocado (§8),
  nunca edite o de outro.
- `ledger/inbox/<CARD>.json` — um por card, por construcao.
- `justfile` — bloco proprio no fim do arquivo, delimitado por
  `# === <CARD> ===` … `# === fim <CARD> ===`. Nunca edite receita alheia.
  **As receitas da W5 (§11) sao criadas pelos cards; o PREP nao as criou de
  proposito** — um stub que o gate rodasse deixaria o PREP vermelho.

**Nada mais e compartilhado.** Se um card precisar tocar
`src/design/tokens.ts`, `schema/manifesto.schema.json`, `package.json` ou
`schema/timing.schema.json` (este, do irmao F3-01), ele **para, nao faz, e
escreve no handoff** — vira PREP da onda seguinte. Os singletons (S-1, S-4,
S-5) seguem proibidos, e o schema de timing tem dono nominal nesta onda.

### Dependencia lateral e proibida por construcao

Precisou de algo entregue por outro card **desta mesma onda**? Isso e
dependencia lateral. Pare, entregue o que da, e **nomeie a diferenca no
handoff**. Nao invente o artefato do vizinho nem edite o arquivo dele.

---

## 2. Contrato congelado do timing.json (dono F3-01)

O documento canônico de timing da onda e **`schema/timing.schema.json`**, criado
por F3-01. O que esta abaixo esta **congelado** — os outros quatro cards e os
descendentes constroem em cima disso, e quem divergir esta fora do contrato:

- **Unidade: SEGUNDOS, nunca frames.** O timing descreve tempo de parede do
  audio; conversao para frame e responsabilidade de quem consome, no ponto de
  consumo. (Diferente do timing por palavra do estagio de locucao, F2-03, que e
  milissegundo inteiro ancorado no byte zero do audio — ADR-0010. O timing.json
  e o documento canônico por cena; o asset de F2-03 e a fonte dos dados.)
- **Chave por cena** — a estrutura e um mapa cena -> entrada de timing, e cada
  entrada declara sua **`unidade`** explicitamente (campo `unidade`, nao
  inferido de contexto).
- **Semantica de silencio declarada** — trecho sem locucao e representado de
  forma explicita (campo/estado de silencio), nunca pela ausencia de entrada.
- **mimeType do asset de origem: `application/vnd.editor-video-ia.timing-locucao+json`**
  — herdado do handoff F2-03 (ADR-0010, decisao 1).
- **Consumo por CONTEUDO, nunca por posicao** — o casamento timing<->audio usa
  `casarTimings()`, ligado pelo campo `audio` do documento (endereco por hash
  dos bytes canonicos), jamais por ordem de aparecimento ou indice de cena
  assumido. Um consumidor que case por posicao esta fora do contrato.

---

## 3. Schema do contrato de autoria v1 (dono F4-01)

F4-01 congela a v1 do contrato de autoria (`src/autoria/contrato/**`). Dois
pontos ja decididos, herdados do ledger, **nao podem ser revertidos pelo card**:

- **AB-432 — hash de midia e ADVISORY, nao exigido.** A autoria pode omitir o
  hash de um asset de midia; o schema nao pode reprovar a ausencia do hash. (O
  hash e resolvido a jusante, na fronteira de resolucao.)
- **AB-433 — `texto_alternativo` OBRIGATORIO para no de midia.** Um no de
  midia sem `texto_alternativo` e invalido no schema da autoria; ausencia e
  erro, nao aviso.

---

## 4. Front-matter dos prompts (dono F4-02)

Cada prompt em `docs/autoria/prompts/*.md` **tem de comecar com `versao:`** —
e a base do ∅-crit do card (um prompt sem versao fica VERMELHO).

**Armadilha 9.2 — nunca use `rg -L` em ∅-crit de presenca.** Em ripgrep, `-L`
e `--follow` (seguir symlink), NAO `--files-without-match`. O comando literal
`rg -L "versao:" docs/autoria/prompts/` sai vazio **exatamente quando nenhum
prompt declara versao** — passa quando a propriedade esta ausente. A forma que
exprime a intencao e:

```bash
rg --files-without-match "versao:" docs/autoria/prompts/ -> vazio
```

(com o denominador conferido: `--files-without-match` tambem sai vazio quando
nao existe arquivo nenhum).

---

## 5. Headers volateis candidatos do F2-07 (suite offline)

O F2-07 generaliza a suite offline (rede bloqueada de verdade) para a W5 e
alem. A lista candidata de headers volateis a tratar nas chamadas gravadas
(classe dos itens AB-440/AB-473 — headers que entram no registro e refutam o
diff do determinismo sem defeito do estagio):

`date`, `age`, `server`, `x-request-id`, `server-timing`, `x-search-id`,
`x-cache`, `x-cache-status`, `content-length`, `transfer-encoding`

**Mais `x-client-ip` (AB-475)** — candidato adicionado pela revisao; o card
valida por amostra real se o provedor o devolve e o inclui no campo de volateis
do contrato de cassete (ADR-0007, D6).

A lista e **candidata**: o card e dono de decidi-la por medicao real, com a
sonda negativa de praxe (um volátil fora do campo tem de deixar o diff
VERMELHO).

---

## 6. Ordem de merge da W5

**F3-01 → F4-01 → F4-02 → F1-12 → F2-07**

Motivo: F3-01 (timing canonico) e F4-01 (schema de autoria v1) sao os dois
contratos que os demais consomem; F4-02 (prompts com front-matter) depende do
contrato de autoria; F1-12 (integracao de composicao) e o primeiro consumidor
real; F2-07 (suite offline generalizada) e o ultimo, pois toca na infraestrutura
que os quatro usaram.

Gate completo apos **cada** merge — nunca ao fim da onda. A bisseccao e o
produto, nao a limpeza.

---

## 7. Faixas de id do ledger

Pre-alocadas. **Ids nunca sao reciclados** — o numero e citado no codigo. Um
card que esgotar a faixa para e pede faixa nova; nao invade a do vizinho.

| Card | Faixa |
|---|---|
| F1-12 | 490..499 |
| F2-07 | 500..519 |
| F3-01 | 520..549 |
| F4-01 | 550..569 |
| F4-02 | 570..579 |

A faixa de F3-01 e maior de proposito: o contrato de timing concentra a
incerteza desta onda.

---

## 8. Numeros de ADR pre-alocados

A renumeracao do PREP terminou em `0021` (docs/adr/ tem exatamente `0001`..`0021`
unicos). Os numeros abaixo estao livres e sao deste card:

| Card | ADR |
|---|---|
| F3-01 | 0022 |
| F4-01 | 0023 |
| F4-02 | 0024 |
| F1-12 | 0025 |
| F2-07 | 0026 |

Quem mergear antes escreve o seu; o numero de um card nao pode ser tomado por
outro (ordem de merge §6 garante a sequencia).

---

## 9. Faixas de porta TCP

Studio e preview simultaneos colidem em porta.

| Card | Porta | Card | Porta |
|---|---|---|---|
| F1-12 | 4112 | F3-01 | 4301 |
| F2-07 | 4207 | F4-01 | 4401 |
| | | F4-02 | 4402 |

(qualquer faixa livre vale; estas estao declaradas para os cinco nao colidirem
entre si nem com a W4.)

---

## 10. A pergunta obrigatoria desta onda

Esta e a **onda de integracao**: os cinco cards constroem sobre os mesmos
contratos (timing.json, schema de autoria v1, suite offline), e dois deles
escrevem em `tests/integracao/` (F1-12 e F2-07, em subdiretorios distintos). O
git nao vai ter em que conflitar — e por isso vai **mergear em silencio codigo
que discorda**.

Antes de fechar o handoff, cada agente responde:

> Existe alguma assercao neste diff sobre a **LISTA COMPLETA** de alguma coisa?
> Se sim, ela e verdade contra a sua base e pode ser **falsa depois do merge do
> irmao**. Reescreva como assercao sobre a **presenca do SEU item**, nunca sobre
> a ausencia dos outros.

Concretamente, nesta onda: **nao asserte listas fechadas de cenas, de nos, de
estagios, de prompts ou de headers volateis** — asserte que o **seu** item esta
la.

---

## 11. Receitas previstas da W5 (NAO criadas pelo PREP)

As receitas abaixo entram no justfile nos blocos dos respectivos cards. O PREP
**nao cria stubs** — uma receita vazia que o gate rodasse deixaria o PREP
vermelho. Quem as cria: o proprio card, no seu commit, com corpo que falha por
ausencia ate a implementacao existir.

| Receita prevista | Card | O que faz (a definir pelo card) |
|---|---|---|
| `int-composicao` | F1-12 | gate da integracao de composicao |
| `det-provar-integrado` | F1-12 | determinismo do artefato integrado |
| `timing-testar` | F3-01 | schema + casarTimings |
| `timing-determinismo` | F3-01 | determinismo do timing canonico |
| `autoria-contrato` | F4-01 | schema de autoria v1 + ∅-crit |
| `autoria-cache` | F4-01 | cache de autoria (se o card decidir) |
| `prompts-testar` | F4-02 | ∅-crit do front-matter (`versao:`) |

Convencao de nomes: **hifen, nunca `:`** (o `just` 1.42 le `a:b:` como
"receita a depende de b" e o parse morre — armadilha 9.1, ja tratada no
justfile inteiro).
