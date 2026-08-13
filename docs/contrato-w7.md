# Contrato da W7 — mix de audio, render integrado e entrega

Commit `PREP-w7`. Publicado **antes** de qualquer worktree da W7 existir,
pela mesma razao do contrato-w6: uma worktree materializa apenas o que esta
commitado, e a divergencia aparece no merge como trabalho a refazer.

Seis agentes rodam esta onda em paralelo. **Nenhum enxerga os outros.**
Tudo que eles precisam em comum esta neste arquivo e nos ADRs pre-alocados
de `docs/adr/` (numeros 0034..0039 livres, por ordem de merge — ver §8).

**O que este PREP ja entrega (fora dos cards):**

- O **pintor promovido** (AB-493): a camada de pintura sai de
  `tests/integracao/composicao/fiar.tsx` e passa a viver em
  `src/composicao/pintura/**` como codigo de producao puro, com o contrato
  publico `pintar(manifesto, tempo, viewport) -> frame`. A suite integrada
  continua o oraculo e importa de la. Ver §1 e o commit do PREP.
- Os **bytes de grafico** (AB-501): `fixtures/canonico/assets/grafico-integrado.png`
  — o mesmo PNG RGBA deterministico da fixture integrada
  (SHA-256 `4dd3497f7719e4aa541f1087413be1522e47f4ac75c44eaceefcc4a8e5c4878c`),
  agora no lugar canonico. O primeiro render integrado do F5-01 tem bytes de
  grafico no repo, sem regravar TTS nem depender de rede.

---

## 1. Mapa arquivo -> dono

A segunda coluna e o que da contratualidade. Sem ela, isto e uma sugestao.

**Os caminhos abaixo NAO existem no disco ainda** — cada card cria os seus
no primeiro commit. Nenhum card escreve fora do proprio mapa. Os contratos
que a W7 CONSUME ja existem e tem dono nominal em ondas anteriores:
timing canonico (F3-01, W5), envelope de ducking (F3-03, W6), ritmo/cadencia
(F3-04, W6), schema de autoria (F4-01, W5) e manifestos S-4 (F0-02/W0,
resolvido F2-01/W3).

| Arquivo / diretorio | Dono | Os outros |
|---|---|---|
| `src/audio/mix/**` | F3-05 | nao editam |
| `src/render/pipeline/**` | F5-01 | nao editam |
| `src/render/encode/**` | F5-02 | nao editam |
| `src/entrega/variantes/**` | F5-04 | nao editam |
| `src/entrega/thumbnail/**` | F5-05 | nao editam |
| `src/entrega/procedencia/**` | F5-06 | nao editam |

Uma fronteira extra, herdada da W6: **`src/composicao/pintura/**` e do PREP**
(nascida neste commit, AB-493). Nenhum card da W7 a edita — os que precisam
do pintor (F5-01, F5-04, F5-05) o **consomem** pelo contrato publico do
§3/C2 e do §12, com imports relativos. Se um card precisar alterar a camada
de pintura, ele **para, nao faz, e escreve no handoff** — vira PREP da onda
seguinte.

### Compartilhados nesta onda — so acrescente

- `docs/adr/` — **um arquivo novo por card** com o numero pre-alocado (§10),
  nunca edite o de outro.
- `ledger/inbox/<CARD>.json` — um por card, por construcao (a W7 abre na
  faixa 660..769, §9).
- `justfile` — bloco proprio no fim do arquivo, delimitado por
  `# === <CARD> ===` … `# === fim <CARD> ===`. Nunca edite receita alheia.
  **As receitas da W7 (§7) sao criadas pelos cards; o PREP nao criou stubs**
  — um stub que o gate rodasse deixaria o PREP vermelho (regra mantida da
  W5, contrato-w5 §11).

**Nada mais e compartilhado.** Os singletons seguem proibidos: S-1
(`src/design/tokens.ts`), S-4 (`schema/manifesto.schema.json`), S-5
(`package.json`) e S-3 (`src/Root.tsx`). Precisa de um deles? Para, nao faz,
e escreve no handoff.

### Dependencia lateral e proibida por construcao

Precisou de algo entregue por outro card **desta mesma onda**? Isso e
dependencia lateral. Pare, entregue o que da, e **nomeie a diferenca no
handoff**. Nao invente o artefato do vizinho nem edite o arquivo dele. O
consumo permitido e apenas dos contratos FECHADOS das ondas anteriores
(timing de F3-01, ducking de F3-03, ritmo de F3-04, autoria de F4-01) e
deste PREP (pintor, bytes de grafico).

---

## 2. C1 — Reconciliação janela visual x fala (AB-583, AB-600)

A fixture canonica tem a cena `c-004` com janela visual de 4 s e locucao de
8,505 s; os audios de `c-004` [14,233..22,738] e `c-005` [18,233..23,588] se
sobrepoem em 4,505 s na timeline absoluta. Este e o contrato que diz quem
manda quando a fala nao cabe na janela. **Congelado, assinado pelos dois
consumidores** (F3-05, que mixa, e F5-01, que posiciona audio no render):

1. **A fala da cena carrega ALÉM da janela visual.** A duracao da locucao e
   a do timing canonico (F3-01) — a janela visual da cena (aritmetica de
   F1-01) nao corta, nao desloca e nao estica a fala. Cena curta com fala
   longa = fala longa, na posicao dela.
2. **Ancoragem: INICIO ABSOLUTO da cena** (AB-600). O audio da cena comeca
   no `frameInicial/fps` da aritmetica de composicao e toca pela duracao
   declarada no timing. O envelope de ducking (ADR-0028) ja cobre fala alem
   da janela: a atenuacao acompanha a fala, nao a janela visual.
3. **Onde duas falas se sobrepoem, a locucao da CENA POSTERIOR MANDA.** A
   cauda da locucao anterior e cortada (ou fadeada) no inicio da posterior.
   O restante da cauda — o trecho em que a fala da anterior ainda tocaria
   depois do inicio da posterior — e coberto pelo **envelope estendido**
   (ADR-0028 cobre fala alem da janela; ADR-0034 registra a decisao do mix).
4. **Sobreposicao residual de fala > 0,1 s no mix e ERRO.** O mix final nao
   pode conter duas locucoes audiveis ao mesmo tempo por mais de 0,1 s. E
   medido nos bytes do mix (F3-05), nunca por escuta.
5. **Os dois consumidores derivam as MESMAS posicoes dos MESMOS inputs:**
   timing canonico + envelope de ducking + cadencia (ritmo) — nenhum
   recalcula a partir da janela visual da cena (§5, C4) e nenhum depende do
   outro (sem dependencia lateral; o que os irmaos calculam nao chega a
   nenhum dos dois — o input comum chega, ja commitado).
6. **A fixture incoerente e CASO DE ESTRESSE DELIBERADO — nao corrigir.**
   `duracao_s` da fixture e medicao dos bytes TTS (F2-03) e nao pode ser
   reescrita a mao: corrigi-la exigiria regravar TTS com rede. A c-004 de 4 s
   com fala de 8,505 s e o proprio caso que o contrato acima resolve, e os
   dois consumidores tem de passar com ela.

---

## 3. C2 — Ponte autoria -> manifesto resolvido (AB-550, AB-631, AB-654)

A ponte entre resolucao e composicao (AB-550) e escopo do **F5-01**, e
responde tambem AB-631 e AB-654 (integridade referencial). Congelado:

- **Campos preenchidos na fronteira resolução/composição, cada um com fonte
  nomeada:**
  - frames do layout -> da composicao (aritmetica de F1-01);
  - cores -> dos tokens (`src/design/tokens.ts`, S-1 — leitura, nunca edicao);
  - hash -> dos bytes dos assets (SHA-256, store de F0-07);
  - licenca -> da procedencia de F0-07 (nunca digitada a mao na ponte).
- **VALIDAÇÃO DE INTEGRIDADE REFERENCIAL obrigatoria:** `cena.nos` so pode
  referenciar no existente no manifesto resolvido. O schema Autoria.1 nao
  valida isso (AB-654) e o reparo da W6 rejeita por politica (AB-631) — a
  ponte fecha o furo no ponto de consumo: manifesto resolvido com cena
  referenciando no inexistente e ERRO, com mensagem nomeando a regra e o
  caminho (ex.: `cena "c-003": referencia no inexistente "n-999" (regra
  integridade-referencial, campo cena.nos)`).
- **Assinante: F5-01.** O ∅-crit do card (§6) cobra a validacao no render:
  cena com no inexistente no manifesto resolvido fica VERMELHO.

---

## 4. C3 — Emenda da locucao (AB-617)

A cadencia (Ritmo.1, F3-04) preserva `audio` = hash do **audio-FONTE**; o
audio EMENDADO (palavras na ordem, ligadas pelas lacunas) nao existe em
bytes ate a W7. Quem o materializa e o **F3-05**. Congelado:

- **O F3-05 publica bytes + hash NOVOS enderecaveis por conteudo** (SHA-256,
  store de F0-07): a emenda ganha identidade propria, distinta da fonte.
- **F5-01 e o relatorio de procedencia F5-06 usam o hash NOVO** da emenda —
  o render posiciona os bytes emendados e a procedencia registra a origem
  deles (§6, F5-06).
- **PROIBIDO reutilizar o hash do audio-fonte** para os bytes emendados: a
  emenda tratada como se fosse a fonte e o falso-verde que o ∅-crit do F3-05
  persegue (§6).

---

## 5. C4 — Ancora absoluta (AB-600)

Toda posicao de audio consumida pelo render e em **SEGUNDOS desde o byte
zero** da composicao — a mesma timeline absoluta do timing canonico
(ADR-0022), do envelope de ducking (ADR-0028) e da cadencia (ADR-0029).
Congelado:

- **F5-01 consome `DuckingEnvelope.1` e `Ritmo.1` pelos campos absolutos**
  (`inicio_s`/`fim_s` do envelope; posicoes em segundos da cadencia).
- **NUNCA recomputa essas posicoes a partir da janela visual da cena.** A
  janela visual nao e fonte de verdade de tempo de audio: a c-004 prova que
  as duas divergem (§2). Recalcular e o erro que o contrato existe para
  impedir.

---

## 6. Emendas de card (deps, escopos e ∅-crits)

O PROGRAMA.html declara as dependencias originais; abaixo, o que a W7
ACRESCENTA ao fechar os contratos C1-C4. Onde o texto do PROGRAMA divergir,
vale este contrato.

- **F3-05** (trilha de audio composta):
  - **ganha a dep F3-04** (alem de F3-03 e F2-06) — consome a cadencia na
    emenda (C3);
  - ∅-crit **novo**: duas locucoes simultaneas no mix por mais de 0,1 s fica
    VERMELHO (C1, item 4);
  - ∅-crit **novo**: emenda enderecada pelo hash do audio-fonte fica
    VERMELHO (C3);
  - mantem o ∅-crit do PROGRAMA: mix sem locucao fica VERMELHO.
- **F5-01** (pipeline de render e paralelismo, hub):
  - **ganha as deps F3-03 e F3-04** (alem de F1-12, F2-07 e I-03) — consome o
    envelope e a cadencia no posicionamento de audio (C4);
  - **escopo da ponte AB-550** (§3): preenche frames/layout/cor/hash/licenca
    com fonte nomeada e valida a integridade referencial `cena.nos`;
  - ∅-crit **novo**: cena com no inexistente no manifesto resolvido fica
    VERMELHO (C2);
  - byte-a-byte (faixa == inteiro) **DELIMITADO ao codec deterministico**
    (PNG/QTRLE): a comparacao de render por faixa + concatenacao contra o
    render inteiro vale onde o encoder e deterministico. O WebM vp9 e o MP4
    final ficam **excluidos por declaracao** (AB-396: vp9 nao-determinista;
    AB-397: vp9 sai `yuv420p` sem alfa; MP4 final: encoder muda, comparacao
    byte a byte e falso oraculo — AB-396/397, destino do cartucho F2-02).
    A exclusao e declarada no codigo com o motivo, nunca silenciosa.
- **F5-02** (perfis de encode): declara, por perfil, se o encode e
  deterministico ou nao. **Goldens so existem em perfis deterministicos** —
  um perfil nao-determinista nunca vira linha de base de bytes; o ∅-crit do
  PROGRAMA (perfil sem alvo de qualidade declarado falha) permanece.
- **F5-04** (variantes de proporcao): consome o **pintor promovido**
  (`src/composicao/pintura/**`, AB-493) para derivar cada variante do mesmo
  manifesto — e as **safe areas dos tokens** (AB-584: 9:16 e provisional,
  token de safe area existente). A pesquisa de safe areas de 2026
  **alimenta, nao substitui**, a decisao de tokens: o token continua sendo a
  fonte de verdade do gate, e a pesquisa vira evidencia (ledger) para
  revisar o token.
- **F5-05** (thumbnail): gerado do mesmo manifesto (consumindo o pintor
  promovido); ∅-crit do PROGRAMA (contraste abaixo do minimo falha) permanece.
- **F5-06** (relatorio de procedencia): o relatorio transitivo inclui a
  **origem dos bytes da emenda do F3-05** — a procedencia registra de onde
  vieram os bytes emendados (o audio-fonte e a operacao que os produziu),
  alem dos assets de midia/grafico/musica ja cobertos.

---

## 7. Receitas pre-registradas (NENHUM stub no justfile)

As receitas abaixo entram no justfile nos blocos dos respectivos cards. O
PREP **nao cria stubs** — uma receita vazia que o gate rodasse deixaria o
PREP vermelho (regra da W5 mantida). Quem as cria: o proprio card, no seu
commit, com corpo que falha por ausencia ate a implementacao existir.

| Receita prevista | Card | O que faz (a definir pelo card) |
|---|---|---|
| `audio-mix` | F3-05 | gate do mix de audio (∅-crits: mix sem locucao, duas locucoes > 0,1 s, emenda com hash da fonte — todos VERMELHO) |
| `render-fixture` | F5-01 | gate do render de ponta a ponta da fixture canonica (∅-crit: faixa != inteiro em codec deterministico) |
| `encode-perfis` | F5-02 | gate dos perfis de encode (∅-crit: perfil sem alvo de qualidade declarado) |
| `variantes` | F5-04 | gate das variantes de proporcao (∅-crit: conteudo fora da safe area) |
| `thumb` | F5-05 | gate do thumbnail (∅-crit: contraste abaixo do minimo) |
| `procedencia` | F5-06 | gate do relatorio de procedencia transitivo (∅-crit: asset sem origem bloqueia) |

Convencao de nomes: **hifen, nunca `:`** — o PROGRAMA.html escreve
`just audio:mix` / `just render:fixture` / `just encode:perfis`, mas o
`just` 1.42 le `a:b:` como "receita a depende de b" e o parse morre
(armadilha 9.1, ja tratada no arquivo inteiro). Valem `audio-mix`,
`render-fixture`, `encode-perfis`, `variantes`, `thumb`, `procedencia`.

---

## 8. Ordem de merge da W7

**I-03 (ja mergeado) → F3-05 → F5-02 → F5-06 → F5-04 → F5-05 → F5-01 (hub por ultimo)**

Motivo: o F3-05 materializa a emenda que C3 torna insumo dos outros; F5-02
(encode) e F5-06 (procedencia) sao independentes entre si e nao consomem
render; F5-04 e F5-05 consomem o pintor promovido do PREP e nenhum artefato
do F5-01; o F5-01 (hub, ponte AB-550) fecha a onda por ultimo porque e o
ponto em que os insumos dos irmaos convergem — com ele por ultimo, um gate
vermelho apos o merge dele nomeia o card certo.

Gate completo apos **cada** merge — nunca ao fim da onda. A bisseccao e o
produto, nao a limpeza.

---

## 9. Faixas de id do ledger

Pre-alocadas. **Ids nunca sao reciclados** — o numero e citado no codigo.
Um card que esgotar a faixa para e pede faixa nova; nao invade a do
vizinho.

| Card | Faixa |
|---|---|
| F3-05 | 660..679 |
| F5-01 | 680..699 |
| F5-02 | 700..719 |
| F5-04 | 720..734 |
| F5-05 | 735..744 |
| F5-06 | 745..769 |

---

## 10. Numeros de ADR pre-alocados

`docs/adr/` tem `0001`..`0032` unicos em disco; `0032` (I-03, mergeado) e
`0033` (I-04, W9.5) ja estao alocados — conferido neste PREP. Os numeros
abaixo estao livres e sao deste card:

| Card | ADR |
|---|---|
| F3-05 | 0034 |
| F5-01 | 0035 |
| F5-02 | 0036 |
| F5-04 | 0037 |
| F5-05 | 0038 |
| F5-06 | 0039 |

Quem mergear antes escreve o seu; o numero de um card nao pode ser tomado
por outro (ordem de merge §8 garante a sequencia).

---

## 11. Faixas de porta TCP

Studio e preview simultaneos colidem em porta. As da W7 continuam a
numeracao das W5/W6 (43xx para audio/sincronia, 45xx para render/entrega):

| Card | Porta | Card | Porta |
|---|---|---|---|
| F3-05 | 4305 | F5-04 | 4504 |
| F5-01 | 4501 | F5-05 | 4505 |
| F5-02 | 4502 | F5-06 | 4506 |

---

## 12. A pergunta obrigatoria desta onda

A W7 e a onda em que F3-05 e F5-01 consomem os MESMOS inputs (fixture
canonica, envelope de ducking, cadencia) e cinco cards tocam a MESMA familia
de caminhos (`src/entrega/**`, `src/render/**`). O git nao vai ter em que
conflitar — e por isso vai **mergear em silencio codigo que discorda**.

Antes de fechar o handoff, cada agente responde:

> Existe alguma assercao neste diff sobre a **LISTA COMPLETA** de alguma
> coisa? Se sim, ela e verdade contra a sua base e pode ser **falsa depois
> do merge do irmao**. Reescreva como assercao sobre a **presenca do SEU
> item**, nunca sobre a ausencia dos outros.

Concretamente, nesta onda: **nao asserte listas fechadas de faixas, de
cenas, de perfis, de variantes, de thumbnails, de assets nem de entradas de
procedencia** — asserte que o **seu** item esta la.

O caso mais caro e o par F3-05/F5-01: os dois consomem a MESMA fixture, o
MESMO envelope e a MESMA cadencia. Um asserta "a fixture inteira tem N
cenas com locucao" e o outro "o mix final tem exatamente M faixas" —
verdadeiros sozinhos, falsos depois do merge do irmao. A assercao correta e
de presenca: "a fala de `c-004` esta em [14,233..22,738] com a cauda cortada
no inicio de `c-005`" — o MESMO numero nos DOIS, derivado dos MESMOS inputs
(C1).

---

## 13. Roteamento de ABs sem acao na W7

Itens de ledger que esta onda NAO fecha — para onde vao, para que o dono
não os reabra por engano:

| AB | O que e | Roteamento |
|---|---|---|
| AB-581 | Calibracao pt-BR do CPS de legenda (20 herdado do ingles) | **contrato congelado** — nenhum card da W7 mexe no token `maxCpsAdult`; vira PREP quando a medicao com leitores pt-BR existir |
| AB-601 / AB-602 / AB-603 | Vocabulario de audio fora de `tokens.ts`; folga/ataque/release e ganho do ducking sem medicao por escuta; fusao de intervalos colados | **dono de tokens decide a migracao**; calibracao por escuta e da W10/F6-01 (revisao humana), nao da W7 |
| AB-604 | Golden do envelope vive em `tests/fixtures`, fora de `fixtures/canonico` | sem acao W7 — o golden ja e lido pelos gates de ducking |
| AB-619 | `GAP_ALVO_S` e politica do modulo de ritmo, nao token | o F5-01 NAO muda o default na W7; sign-off de produto e do F5-07 (W9) quando levar o ritmo ao render ponta a ponta |
| AB-630 / AB-632 / AB-633 / AB-634 | Reparo de autoria: duplicata sem oraculo, taxa por tentativa nao medida, escape com backslash, conjuntos derivados em runtime | **reparo sem destino na W7** — nenhum card da W7 toca `src/autoria/**`; permanecem com o dono de reparo |
| AB-635 | Reparador mecanico vs LLM: a costura existe, a politica nao | politica de pipeline e do **F5-07** (W9) |
| AB-650 | Schema OpenAI podado nao strict-compativel (`const` sem `type`) | **dono F4-01** — a chamada real ja esta no cassete; a correcao do schema e da autoria, nao da W7 |
| AB-652 / AB-655 | Limites da Anthropic pendentes; cassete anthropic gravado do sosia | **pendente credencial** — medicao com credencial real registra evidencia (nunca gate); o F5-06 (W7) consome procedencia de F0-07, que independe disso |
