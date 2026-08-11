# RETOMAR AQUI — estado completo da construcao

**Pausado em 2026-08-11** a pedido do usuario (limite de uso). **Nada foi
perdido.** Este arquivo e autossuficiente: quem o ler nao precisa de nenhum
contexto de conversa anterior para continuar.

- **Branch de integracao:** `main`, em `d38fe8f`
- **Gate:** VERDE — `bash tools/gate.sh` → 5 PASS, 0 FAIL, exit 0
- **Diretorio principal:** limpo (sem alteracoes pendentes)
- **Progresso:** 26 de 65 cards mergeados · 1 card commitado em worktree ·
  12 cards com trabalho parcial em worktree · 26 cards nao iniciados
- **13 worktrees abertas**, listadas na secao 6

---

## 1. O que e este projeto

**Editor de Video IA**: um pipeline que transforma um tema ou brief em um video
completo — com narracao, graficos animados, legendas, musica e trilha — sem
edicao manual.

A fonte da verdade sobre **o que construir** e `PROGRAMA.html` na raiz do
repositorio: 3198 linhas, 65 cards de trabalho organizados em 13 ondas, com
criterio de aceitacao executavel e perguntas adversariais para cada card. Abra
no navegador ou leia o HTML direto. **Todo o resto deste arquivo e derivado
dele.**

### A ideia central: o video e uma funcao pura

```
Acima da fronteira: nada e deterministico, tudo e cacheado por hash.
Abaixo da fronteira: tudo e deterministico, e o determinismo e TESTADO.

Nenhuma URL, nenhum tempo relativo, nenhuma decisao pendente
atravessa esta linha.
```

O video e funcao pura de um **manifesto resolvido** mais **assets enderecados
por conteudo (SHA-256)**. Tudo que e impuro — LLM, TTS, download, rede — sobe
para acima da fronteira e e cacheado. Render 2x produz **bytes identicos**, e
isso e um teste que roda, nao uma promessa.

### Os cinco estagios

1. **AUTORIA** — um LLM recebe o tema e produz `manifesto.json`. Nao
   deterministico, cacheado.
2. **RESOLUCAO** — cinco sub-estagios impuros (locucao, grafico, midia, codigo,
   musica). Cada um cacheado por hash, com **cassete** gravado. Produz
   `manifesto-resolvido.json`.
3. **COMPOSICAO** — funcao pura. Zero rede, zero `Date.now()`, zero
   `Math.random()` sem seed. Determinismo testado.
4. **RENDER** — frames e encode. Paralelizavel por faixa.
5. **POS/ENTREGA** — loudness, variantes de proporcao, legenda, thumbnail,
   relatorio de procedencia.

### Stack

Remotion 4.0.507 (React + TypeScript) para composicao e render · Node 24 ·
Python 3.12 para ferramental · `just` 1.42.4 como executor de tarefas ·
vitest + pytest · ffmpeg 6.1.1 · Manim para graficos.

### Enquadramento de uso — ja decidido

**Uso pessoal** (ADR-0003). Isso desbloqueou os cards F2-04, F2-06 e F5-06 e
muda o que e permitido em licenciamento de assets. **A decisao e sobre uso, nao
sobre publicacao** — publicar continua exigindo F6-01 (revisao humana) e I-04
(politica editorial).

---

## 2. Como o trabalho e organizado

### Cards e ondas

Cada card e uma unidade de trabalho com dono unico, arquivos proprios, criterio
de aceitacao executavel e perguntas adversariais. Uma **onda** e um conjunto de
cards sem dependencia entre si, executados **em paralelo, um agente por card,
cada um na sua worktree git isolada**.

Prefixos: `F0`/`F1`/`F2`… = cards de funcionalidade · `T` = ferramental ·
`I` = infra (rodam **direto no branch de integracao**, nunca em worktree).

### Os sete passos de uma onda — nenhum e opcional

1. **Commit `PREP-w<N>` antes de qualquer worktree existir.** Traz stubs,
   contrato da onda (mapa arquivo → dono), faixas de id do ledger, faixas de
   porta TCP e mudancas de ferramenta. *Razao mecanica:* uma worktree
   materializa **apenas o que esta commitado** — preparacao deixada no checkout
   principal nao chega nos agentes.
2. **Preflight por worktree** — prova acesso ao insumo critico com valor
   conhecido, nunca com "criei a pasta".
3. **Lancamento** — N agentes, um por card, um por worktree.
4. **Barreira** — espera todos terminarem. Escrita pelo proprio agente, nunca
   por relogio ou leitura de tela.
5. **Teardown** — tres comandos, do repositorio principal:
   `git worktree remove <path>` · `git branch -D <branch>` · `git worktree prune`.
   Sem o segundo, cada onda deixa N branches orfaos para sempre.
6. **Merges um a um, na ordem declarada.** **Nunca octopus** — um octopus aborta
   inteiro no primeiro conflito e voce perde a atribuicao.
7. **Gate completo apos CADA merge**, nunca ao fim da onda. A bisseccao e o
   produto: com um merge dentro, um gate vermelho **nomeia o card**; com quatro,
   nao nomeia nada.

### Squash-merge

Cada card entra no `main` como **um unico commit** com mensagem descritiva:
`git merge --squash <branch>` seguido de `git commit`.

---

## 3. As 13 ondas — mapa completo

| Onda | Cards | Estado |
|---|---|---|
| **W0** | F0-01, T-01 | ✅ mergeada |
| **W0.5** | I-01 | ✅ mergeada |
| **W1** | F0-02, F0-03, F0-04, F0-05, T-02, T-03, T-04, T-10 | ✅ mergeada |
| **W2** | F0-06, F0-07, F0-08, F0-09, T-05, T-06, T-07, T-08 | ✅ mergeada |
| **W2.5** | I-02 | ✅ mergeada |
| **W3** | F1-01, F1-02, F1-03, F2-01, T-09 | ✅ mergeada |
| **W4** | F1-04…F1-11, F2-02…F2-06 (13 cards) | ⏸️ **EM ANDAMENTO** |
| **W5** | F1-12, F2-07, F3-01, F4-01, F4-02 | ⬜ nao iniciada |
| **W6** | F3-02, F3-03, F3-04, F4-03, F4-04 | ⬜ nao iniciada |
| **W6.5** | I-03 | ⬜ nao iniciada |
| **W7** | F3-05, F5-01, F5-02, F5-04, F5-05, F5-06 | ⬜ nao iniciada |
| **W8** | F5-03, F5-09 | ⬜ nao iniciada |
| **W9** | F5-07 | ⬜ nao iniciada |
| **W9.5** | I-04 | ⬜ nao iniciada |
| **W10** | F5-08, F6-01 | ⬜ nao iniciada |
| **W11** | F6-02, F6-03, F6-04 | ⬜ nao iniciada |
| **W12** | F6-05 | ⬜ nao iniciada |

---

## 4. O que ja foi construido (26 cards mergeados)

Um commit por card, em ordem cronologica. `git log --oneline` mostra todos.

### W0 — vocabulario e esqueleto
- **F0-01** `97dff9c` — vocabulario (28 termos), convencoes, `AGENTS.md`
  (12 ferramentas que mentem, 14 armadilhas, 12 singletons), ADR-0001 (oraculo),
  ADR-0002 (contrato de card).
- **T-01** `74b5b4f` — esqueleto do repositorio, toolchain pinada, `justfile`,
  `.gitignore`.

### W0.5 — infra
- **I-01** `693621b` — ADR-0003: enquadramento de uso **pessoal**.

### W1 — contratos e ferramental
- **F0-02** `b575266` — contrato do manifesto: `schema/manifesto.schema.json`,
  tipos em `src/contratos/`, 12 fixtures invalidas.
- **F0-03** `f432adf` — ledger de incerteza: `tools/validate-ledger.py`,
  selftest, consolidador.
- **F0-04** `cea0110` — `src/design/tokens.ts` (21 testes, espelho Python,
  varredura de literais).
- **F0-05** `9c1acb2` — inventario de reuso do 3b1b, 25 claims, ADR-0004.
- **T-02** `e7d9f88` — validador de grafo, 11 checagens, autoteste, geradores.
- **T-03** `af13f79` — **gate local** `tools/gate.sh`, tres estados, autoteste.
- **T-04** `88cb51e` — `tools/new-task-worktree.sh` + `tools/preflight.sh`.
- **T-10** `3c4283e` — infra de skills: linter, selftest, catalogo gerado.

### W2 — fundacao
- **F0-06** `331fb69` — harness de determinismo: canario, render 2x, snapshot.
- **F0-07** `fcf9548` — **store de conteudo** SHA-256, append-only, escrita
  atomica, procedencia obrigatoria (`src/store/`).
- **F0-08** `5e74cbc` — 9 invariantes estruturais.
- **F0-09** `75a8b51` — **fixture canonica** `fixtures/canonico/`.
- **T-05** `5995a9d` — hooks de seguranca, skill, barreira e nudge (40 selftests).
- **T-06** `324e9be` — verificador de aceitacao com sonda negativa e tripwire.
- **T-07** `76a23b3` — estado derivado, prefixo ininterrupto.
- **T-08** `85d3d7e` — medicao de custo por onda.

### W2.5 — infra
- **I-02** `9e99ad7` — `.env.example`, `docs/contas.md`, ADR-0005 (segredos).

### PREPs de correcao (fora de card, feitos pelo orquestrador)
- `96da4bf` **PREP-gate-verde** — o gate estava VERMELHO desde a W2 e a W4 ia
  ser lancada sobre base vermelha. Tres defeitos: `Procedencia` nao reexportado
  de `src/store/store.ts` (derrubava build+lint+typecheck); `pyproject.toml`
  coletava **zero** testes Python e saia com codigo 5, lido como falha; dois
  erros de ruff.
- `0ee36f9` **PREP-preflight-tres-estados** — `new-task-worktree.sh` recusava
  criar **qualquer** worktree porque o preflight colapsava os tres estados do
  linter de skill em dois: um aviso de "SKILL.md tem 407 linhas" bloqueava a
  onda inteira.

### W3 — os hubs
- **F1-01** `47b2778` — **composicao raiz, contrato de no, descoberta por
  convencao, aritmetica de tempo** (`src/composicao/`). Hub de out-degree 8.
- **F1-02** `f175e7b` — motor de layout: medicao, ajuste, overflow como erro de
  build (`src/composicao/layout/`).
- **F1-03** `6ab5c80` — fontes locais embutidas, asserção de familia resolvida
  (`src/design/fontes/`, `assets/fontes/`).
- **F2-01** `6c6ae78` — **contrato de estagio de resolucao, cassetes,
  orquestrador, guarda de rede** (`src/resolucao/`). Hub de out-degree 7.
- **T-09** `2263a04` — CI espelhado, lido pelo gate local.

### PREP da onda atual
- `d38fe8f` **PREP-w4** — `docs/contrato-w4.md`, `docs/criterios-de-aceitacao-corrigidos.md`,
  fixture canonica corrigida, `tests/fixtures/coerencia-canonica.test.ts`.

---

## 5. O que existe no disco hoje

```
src/composicao/         raiz.tsx, ManifestoRaiz.tsx, contrato-de-no.ts,
                        descoberta.ts, tempo.ts, registro.ts
src/composicao/nos/     cabecalho, texto, lista, midia, codigo, grafico  (STUBS — a W4 preenche)
src/composicao/layout/  medicao.ts, ajuste.ts, overflow.ts
src/contratos/          manifesto.ts (tipos do schema)
src/design/             tokens.ts  ← SINGLETON
src/design/fontes/      resolucao.ts, index.ts
src/resolucao/          contrato.ts, orquestrador.ts, descoberta.ts,
                        manifesto-resolvido.ts, cassete/, rede/
src/store/              store.ts, procedencia.ts   (SHA-256, append-only)
schema/                 manifesto.schema.json  ← SINGLETON
                        manifesto-resolvido.schema.json
fixtures/canonico/      manifesto-valido.json + 8 fixtures invalidas
tools/                  gate.sh, preflight.sh, new-task-worktree.sh,
                        validate-graph.py, validate-ledger.py, espelho-ci.py,
                        verify-acceptance.py, determinismo/, invariantes/, resolucao/
docs/                   contrato-w4.md, contrato-estagio-resolucao.md,
                        criterios-de-aceitacao-corrigidos.md, vocabulario.md,
                        gate.md, falso-verde.md, fixtures.md, contas.md,
                        reuso-3b1b.md, adr/
ledger/                 inbox/<CARD>.json, aberto.json
```

`just --list` mostra **43 receitas**. `bash tools/gate.sh` e o veredito.

---

## 6. As 13 branches e worktrees ABERTAS — a W4

**Container:** `/home/ondokai/Projects/ai-video-maker-worktrees/20260811-094208-3052605/`
**Prefixo de branch:** `do/ai-video-maker/20260811-094208-3052605/onda4-<slug>`

Cada worktree tem `node_modules` como **symlink** para o principal.
**Nao rode `npm install` dentro delas.**

| Worktree / branch (sufixo) | Card | O que o card faz | Estado |
|---|---|---|---|
| `onda4-no-cabecalho` | F1-04 | No: cabecalho e titulo; mola nomeada dos tokens | ✅ **COMMITADO** `6b1e59b` — pronto para merge |
| `onda4-no-texto` | F1-05 | No: texto com destaque palavra a palavra; sem timing degrada para frase | 4 arquivos nao-commitados |
| `onda4-no-lista` | F1-06 | No: lista, grade e bullets; caso "1 item" e caso "20 itens" | 7 arquivos nao-commitados |
| `onda4-no-midia` | F1-07 | No: midia; recebe **hash**, nunca URL; GIF avanca por frame | 4 arquivos nao-commitados |
| `onda4-no-codigo` | F1-08 | No: codigo; consome tokens **pre-computados** | 9 arquivos nao-commitados |
| `onda4-no-grafico` | F1-09 | No: grafico; "alfa nao suportado" falha no **build** | 3 arquivos nao-commitados |
| `onda4-transicoes` | F1-10 | Transicoes e sequencia; **errar aqui erra a duracao de todo video** | 3 arquivos nao-commitados |
| `onda4-camadas` | F1-11 | Camadas globais: fundo, grade, vinheta; nao cobrir safe area | 2 arquivos nao-commitados |
| `onda4-res-grafico` | F2-02 | Resolucao: grafico (Manim headless) | 5 arquivos nao-commitados |
| `onda4-res-locucao` | F2-03 | Resolucao: locucao — audio **e** timing · **caminho critico** | 2 arquivos nao-commitados |
| `onda4-res-midia` | F2-04 | Resolucao: midia externa; decidir hotlink **antes** do downloader | 4 arquivos nao-commitados |
| `onda4-res-codigo` | F2-05 | Resolucao: destaque de codigo; nada de CDN em runtime | 4 arquivos nao-commitados |
| `onda4-res-musica` | F2-06 | Resolucao: musica e efeitos; URLs remotas vao para o store | 4 arquivos nao-commitados |

**Ordem de merge da W4:** os **cinco de resolucao primeiro** (F2-02, F2-03,
F2-04, F2-05, F2-06), **depois os oito de composicao** (F1-04 … F1-11). Motivo:
os de resolucao gravam cassetes que os testes de composicao podem consumir;
mergea-los antes faz um gate vermelho **nomear o card certo**.

O contrato completo da onda — mapa arquivo → dono, faixas de ledger, faixas de
porta TCP, superficie dos dois hubs escrita por extenso — esta em
**`docs/contrato-w4.md`**. Leia antes de relancar qualquer agente.

### O que os agentes tinham descoberto quando foram parados

- **F1-08** achou um bug real do vite: importar um binding chamado `meta` no
  mesmo arquivo que usa `import.meta` quebra. Estava consertando.
- **F2-04** gravou cassete e confirmou que o corpo cru e **sosia** (licencas nao
  reconhecidas preservadas, `"true"` como string, HTML com href `//`).
- **F1-04** commitou e confirmou por baseline que o vermelho que viu era
  pre-existente.

---

## 7. Regras invioláveis

Estao em `AGENTS.md` (carregado em toda sessao). Resumo do que mais quebra:

1. **Zero nao-determinismo abaixo da fronteira.** Em `src/composicao/`: proibido
   `Date.now()`, `Math.random()`, `setTimeout()`, `fetch()`, acesso a rede,
   disco, ambiente ou relogio, e **iteracao sobre objeto sem ordenacao
   explicita**. O gate `just comp-pureza` cobra.
2. **Zero literal de token duplicado.** Toda cor, espacamento, duracao, fonte e
   tamanho vive **exclusivamente** em `src/design/tokens.ts`. `just design-varrer`
   procura literais fora de `src/design/` e reprova. Um literal repetido em dois
   arquivos diverge num merge limpo.
3. **Nos recebem `frame` por prop.** Nao chame `useCurrentFrame()` dentro de um
   componente de no.
4. **Imports relativos dentro de `src/composicao/`.** Veja armadilha 9.3.
5. **Cassete e sosia, nao sucessor.** Um estagio que "conserta" a resposta
   externa esconde o defeito do cassete.

### Singletons — quem os toca

Arquivos que **nenhum card pode editar**. Se um card precisar, ele **para, nao
faz, e escreve no handoff** — a mudanca vira um PREP da onda seguinte, feito por
quem orquestra:

- `src/design/tokens.ts` (S-1)
- `schema/manifesto.schema.json` (S-4)
- `package.json` (S-5)
- `src/Root.tsx` — stub commitado no PREP, um bloco por card, so acrescente (S-3)
- a arvore de cards — escrita **so** por quem orquestra, em branch `PREP-*` (S-11)

### Compartilhados — so acrescente

- `docs/adr/` — **um arquivo novo por card**, nunca edite o de outro
- `ledger/inbox/<CARD>.json` — um por card, por construcao
- `justfile` — bloco proprio delimitado por `# === <CARD> ===` … `# === fim <CARD> ===`

### Dependencia lateral e proibida por construcao

Se um card precisar de algo entregue por outro card **da mesma onda**, ele para,
entrega o que da, e **nomeia a diferenca no handoff**. Nao inventa o artefato do
vizinho nem edita o arquivo dele.

---

## 8. A pergunta obrigatoria das ondas de composicao

Numa onda de composicao, varios cards trabalham sobre o **mesmo artefato**. O
git nao tem em que conflitar — e por isso **mergeia em silencio codigo que
discorda**. Antes de fechar qualquer handoff:

> Existe alguma assercao neste diff sobre a **LISTA COMPLETA** de alguma coisa?
> Se sim, ela e verdade contra a sua base e pode ser **falsa depois do merge do
> irmao**. Reescreva como assercao sobre a **presenca do SEU item**, nunca sobre
> a ausencia dos outros.

**Isto ja aconteceu de verdade neste repositorio.** O teste de fonte remota de
F1-03 varria `src/` inteiro procurando `/\bcdn\b/i`. Passou sozinho. Quando
F2-01 mergeou um comentario que **proibe** URL relativa a protocolo
(`//cdn...`), o teste ficou vermelho — um gate que pune a documentacao da
propria regra, e cujo conserto obvio seria apagar o comentario. Corrigido no
PREP-w4 para casar host real.

---

## 9. Armadilhas ja descobertas — NAO deixe regredir

Todas verificadas empiricamente. Documentadas em
`docs/criterios-de-aceitacao-corrigidos.md`.

### 9.1 `just` nao aceita `:` em nome de receita

O PROGRAMA escreve `just comp:testar`, `just res:offline`, `just det:provar`.
**`just` 1.42.4 recusa `:` em nome de receita, e o erro de parse e GLOBAL:** o
arquivo inteiro deixa de carregar e **nenhuma** receita roda, nem `just build`.

Ficou assim por **duas ondas inteiras** sem ninguem notar, porque
`tools/gate.sh` invoca os comandos **direto**, sem passar pelo `just` — o gate
ficava verde sobre um justfile morto.

**Convencao adotada: hifen.** `comp-testar`, `res-offline`, `fontes-testar`.
(Modulos com `just x::y` tambem funcionam, mas exigem
`set working-directory := '..'`, sem o que todo caminho relativo quebra em
silencio. Recusados para nao reescrever trabalho ja verde.)

### 9.2 `rg -L` NAO e `--files-without-match`

E `--follow` (seguir symlinks). `--files-without-match` **nao tem forma curta**.

O PROGRAMA usa `rg -L "<padrao>" <arquivos>` → vazio como ∅-crit de ausencia em
**seis cards**. O comando esta **invertido nos dois sentidos**: sai **nao-vazio**
quando todo arquivo casa o padrao (e o criterio reprova estando tudo certo), e
sai **vazio** exatamente quando **nenhum** arquivo casa (e o criterio aprova
estando tudo errado). Falso-verde perfeito.

**Use `--files-without-match`, e cheque o denominador** — ele tambem sai vazio
quando nao existe arquivo nenhum.

**Cards ainda afetados (nao corrigidos, porque nao foram executados):**
F4-02 (W5), I-03 (W6.5), F6-02 (W11), F6-05 (W12).

### 9.3 O bundler do Remotion nao le os `paths` do tsconfig

E webpack. `import { tokens } from "src/design/tokens"` **passa no `tsc` e no
`vitest`** e quebra **so no render real**. Dentro de `src/composicao/`, use
imports relativos. A receita `just comp-bundle` existe para pegar essa classe de
bug.

### 9.4 `git diff --exit-code` nao enxerga arquivo nao rastreado

Verificar snapshot so com `git diff --exit-code fixtures/snapshots/<x>/` da
**falso verde** para um snapshot novo. Combine sempre com `git status --porcelain`.

### 9.5 Testes Python `*_test.py` nao eram coletados

`pyproject.toml` declarava `python_files = ["test_*.py"]`, que nao casa
`validar_manifesto_test.py`. O pytest coletava **zero** testes e saia com codigo
5, lido pelo gate como falha — sem distinguir "quebrou" de "nao rodou nada".
Corrigido: aceita as duas grafias. **Consequencia historica: aceitacoes de cards
anteriores foram reportadas sem nunca terem executado** (ledger AB-285).

### 9.6 A fixture canonica mentia em dois lugares

Declarava `duracao_total_frames: 930` contra **727** derivados
(780 de cenas − 53 de fronteiras). E cada fronteira era declaravel dos dois
lados (`transicao_saida` da anterior, `transicao_entrada` da seguinte), com
**tres das quatro discordando** (`wipe 20` × `flip 12`, `clockWipe 18` × `cube 24`).
Como a precedencia faz a **saida mandar**, as entradas divergentes eram inertes:
nao mudavam o tempo, mas mentiam para quem as lesse — `slide`, `flip` e `cube`
*pareciam* exercitados e nunca foram.

Corrigido. `tests/fixtures/coerencia-canonica.test.ts` amarra declarado e
derivado, exige `total == somaCenas - somaTransicoes` (senao alguem faz os
numeros baterem zerando as transicoes) e proibe fronteira declarada dos dois
lados.

---

## 10. Ledger de incerteza — 17 itens ABERTOS

`ledger/aberto.json` · valide com `python3 tools/validate-ledger.py` ·
consolide com `python3 tools/consolidar-ledger.py`.

**Risco alto:**

| Id | Assunto |
|---|---|
| AB-243 / AB-271 / AB-284 | O `just` nao parseia `:` — **ja corrigido**, os tres itens podem ser fechados na proxima consolidacao |
| AB-245 | Type-check do repositorio vermelho — **ja corrigido** no PREP-gate-verde |
| AB-270 | O ∅-crit de licenca usa flag que significa outra coisa (`rg -L`) |
| AB-281 | O bloqueio de rede externo depende de `unshare --net`, ausente em parte dos ambientes |
| AB-285 | Testes `*_test.py` nunca coletados — **ja corrigido**; o que fica e a duvida sobre aceitacoes passadas |

**Risco medio/baixo:** AB-240 (schema deixa transicao ser declarada dos dois
lados), AB-241 (nos de midia precisam de `<Sequence>`), AB-242 (`registro.ts` e
registro central, desvio consciente da Regra 6), AB-244 (fixture 930 vs 727 —
**corrigido**), AB-272 (`public/fontes` e symlink), AB-273 (`fontFamily.serif`
sem sonda), AB-274 (fontes sem subsetting), AB-280 (cassete sem teto de
tamanho), AB-282 (sem regravacao em massa apos bump), AB-283 (corpos nao
deduplicados).

### Faixas de id do ledger — pre-alocadas, nunca recicladas

```
W4   F1-04 310..319 · F1-05 320..329 · F1-06 330..339 · F1-07 340..349
     F1-08 350..359 · F1-09 360..369 · F1-10 370..379 · F1-11 380..389
     F2-02 390..409 · F2-03 410..429 · F2-04 430..449 · F2-05 450..469
     F2-06 470..489
W5   F1-12 490..499 · F2-07 500..519 · F3-01 520..549 · F4-01 550..569 · F4-02 570..579
W6   F3-02 580..599 · F3-03 600..614 · F3-04 615..629 · F4-03 630..649 · F4-04 650..659
W7   F3-05 660..679 · F5-01 680..699 · F5-02 700..719 · F5-04 720..734
     F5-05 735..744 · F5-06 745..769
W8+  F5-03 770..789 · F5-09 790..799 · F5-07 800..829 · F5-08 830..849
     F6-01..F6-05 850..949
inf  I-03 980..989 · I-04 990..999
```

---

## 11. Divida conhecida

1. **Tres ADRs numerados `0006`.** `0006-composicao-raiz.md`,
   `0006-contrato-de-estagio-e-cassete.md` e `0006-fontes-locais-embutidas.md`
   foram criados em paralelo por F1-01, F2-01 e F1-03. O git mergeou limpo
   porque sao **arquivos diferentes** — e exatamente a classe de colisao que a
   secao 8 descreve. **Renumere para 0006/0007/0008 num PREP** e pre-aloque
   faixas de numero de ADR por card nos PREPs seguintes, como ja e feito com o
   ledger.
2. **`ruff` foi instalado no ambiente com `pip install --break-system-packages`.**
   Ja estava declarado em `pyproject.toml`. Num ambiente novo, instale antes de
   rodar o gate — "ferramenta ausente = vermelho" e a regra.
3. **Nomes de receita divergem entre si**: `design-varrer` (hifen) e
   `contrato_gerar` (underscore). Padronizar em hifen quando alguem tiver motivo
   para mexer.
4. **`duracao_total_frames` continua sendo um numero digitado** no schema. O
   teste de coerencia o amarra ao derivado, mas o campo poderia simplesmente nao
   existir.

---

## 12. As ondas que faltam — o que cada card exige

Fonte completa: `PROGRAMA.html`. Resumo operacional:

### W5 — onda de composicao · dois joins convergem
- **F1-12** (join 9, deps F0-06 + F1-04…F1-11) — suite integrada de composicao.
  `just int-composicao` · determinismo 2x · ∅-crit: remover um no da fixture tem
  de ficar vermelho **por ausencia**, nao passar por "menos frames para comparar".
- **F2-07** (join 5, deps F2-02…F2-06) — suite offline de resolucao e **guarda
  de rede**. ∅-crit: estagio novo sem cassete derruba a suite. Pergunta: o guarda
  bloqueia DNS, socket e subprocesso, ou so o cliente HTTP?
- **F3-01** (caminho critico, deps F2-01 + F2-03) — **timing canonico**, tres
  consumidores e uma fonte. ∅-crit: timing com palavra fora de ordem, sobreposta
  ou com duracao negativa tem de ser rejeitado.
- **F4-01** (deps F0-02 + F2-01) — contrato de autoria: saida estruturada e
  cache. O LLM decide narrativa; o sistema decide frames, layout e cor.
- **F4-02** (deps F0-01 + F0-02) — biblioteca de prompt e decomposicao narrativa.
  **∅-crit afetado pela armadilha 9.2.**

### W6 — onda de composicao · todos consomem F3-01/F4-01
**Contratos a congelar no `PREP-w6`, nao negociados em tempo real:** o formato de
`timing.json` (campos, unidade de tempo, semantica de silencio — dono F3-01) · o
nome e a semantica do envelope de ducking · o contrato de erro de F4-03 (o que e
reparavel e o que e rejeicao definitiva).

- **F3-02** — legendas a partir do timing. **O invariante e em SEGUNDOS, nunca em
  frames:** duracao ≥ max(0,833 s; caracteres/20) e ≤ 7 s. Num manifesto
  frame-based, e a regra que mais provavelmente sera reescrita em frames por
  conveniencia — e 20 frames a 60 fps sao 0,333 s, quatro vezes abaixo do piso,
  em silencio.
- **F3-03** — envelope de ducking **calculado**, nao um compressor cuja saida
  muda entre versoes.
- **F3-04** — ritmo: corte de silencio e cadencia. O teste prova que nenhuma
  palavra foi cortada.
- **F4-03** — validacao e reparo do manifesto gerado. Irreparavel e **rejeitado**,
  nunca "melhorado" ate passar.
- **F4-04** — cassete de autoria e suite de rejeicao. So os manifestos bons nao
  testa nada.

### W6.5 — infra
- **I-03** — maquina de render: RAM por worker, ponto de saturacao, sessoes de
  encode, throughput de disco. **Cada numero com o comando que o reproduz.**
  ∅-crit afetado pela armadilha 9.2.

### W7 — entrega e variantes
- **F3-05** — trilha de audio composta. "A musica cobre a locucao?" **meca, nao
  escute**.
- **F5-01** — pipeline de render e paralelismo. ∅-crit: render por faixa +
  concatenacao tem de bater **byte a byte** com o render inteiro — se nao bate, o
  paralelismo e ilusorio.
- **F5-02** — perfis de encode. Hardware e software nao se comparam pelo mesmo
  eixo: um nao tem CRF.
- **F5-04** — variantes de proporcao. Conteudo fora da safe area de qualquer
  plataforma fica vermelho.
- **F5-05** — thumbnail, gerado do mesmo manifesto, nunca digitado a parte.
- **F5-06** — relatorio de procedencia, cobrindo assets **transitivos**.

### W8 — pescoco (o mix final e singleton por natureza)
- **F5-03** (caminho critico) — pos-processamento: loudness e sidecar. **True
  peak conferido depois da codificacao**, nao antes.
- **F5-09** — cache de render e invalidacao **por conteudo, nunca por data** —
  por data e falso verde.

### W9 — o join (mergeia sozinho, de proposito)
- **F5-07** (join 7) — orquestrador de ponta a ponta. Um comando: tema → entrega
  completa. `just produzir --fixture canonico --estrito` → exit 0.

### W9.5 — infra
- **I-04** — canal de publicacao e politica editorial. A pergunta que nenhum
  agente pode responder: o que conta como video publicavel, em nome de quem.

### W10 — o oraculo final
- **F5-08** — golden master de ponta a ponta: manifesto resolvido + frames-chave
  + envelope de audio. **Nao compare o MP4 byte a byte** — o encoder muda; isso e
  falso oraculo.
- **F6-01** — checklist de revisao humana. Entrega sem dossie bloqueia a publicacao.

### W11 — revisao e gates
- **F6-02** — runbook de publicacao. Nasce **ENCERRADO COMO CONSTRUIDO E NAO
  DISPARADO**. ∅-crit afetado pela armadilha 9.2.
- **F6-03** — gates numerados de publicacao. Um veredito CONFERE sem evidencia
  anexada falha.
- **F6-04** — fechamento do ledger: zero itens abertos nas categorias
  bloqueantes, com **allowlist explicita**. Duas excecoes ja sao um padrao, e
  padrao de excecao e o gate morrendo devagar.

### W12 — o corte
- **F6-05** — arquivamento e escopo negativo: congela por escrito o que era vivo,
  o que morreu e o que virou manual. ∅-crit afetado pela armadilha 9.2.

---

## 13. Como retomar

Cole isto numa sessao nova, com o diretorio de trabalho em
`/home/ondokai/Projects/ai-video-maker`:

```
Leia RETOMAR-AQUI.md e PROGRAMA.html. Retome a construcao de onde parou.

Continue a W4: relance um subagente por worktree com trabalho parcial (as 12
listadas na secao 6), mandando cada um CONTINUAR o que ja existe na worktree
dele — nao recomecar do zero —, rodar os gates e commitar. F1-04 ja esta
commitado e so precisa de merge.

Depois mergeie na ordem declarada (resolucao primeiro, composicao depois) com
gate completo entre CADA merge, faca o teardown das worktrees e branches, e siga
para a W5 e as demais ondas ate terminar as 12 restantes, seguindo o protocolo
dos sete passos.
```

### Verificacao rapida antes de comecar

```bash
cd /home/ondokai/Projects/ai-video-maker
git log --oneline -1          # deve ser d38fe8f PREP-w4
git status --short            # deve estar limpo
bash tools/gate.sh            # deve ser VERDE (5 PASS, 0 FAIL)
git worktree list             # deve listar o principal + 13 worktrees onda4-*
just --list | head            # deve listar 43 receitas, sem erro de parse
```

Se `just --list` der erro de parse, alguem reintroduziu `:` em nome de receita —
veja a armadilha 9.1.

### Se preferir descartar a W4 e recomecar limpo

```bash
cd /home/ondokai/Projects/ai-video-maker
for d in ../ai-video-maker-worktrees/20260811-094208-3052605/onda4-*; do
  git worktree remove "$d" --force
done
git branch -D $(git branch --list 'do/*onda4-*' | tr -d ' +')
git worktree prune
```

O `main` em `d38fe8f` continua verde e integro. **A W4 inteira e descartavel sem
afetar as seis ondas ja fechadas** — o unico custo e o trabalho parcial dos 13
agentes.
