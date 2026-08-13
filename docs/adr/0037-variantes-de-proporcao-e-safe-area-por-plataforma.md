# ADR-0037 — Variantes de proporcao: safe areas por plataforma e o zoneamento de UI vertical em 2026

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-04 (W7, variantes de proporcao)
- **Depende de:** F1-12 (suite integrada, fixture canonica), F0-04 (tokens, S-5),
  AB-493 (pintor promovido a `src/composicao/pintura`), F3-02 (bloco de
  legenda, consumido), AB-071/AB-584 (safe area 9:16 provisional)
- **Faixa de ledger:** AB-720..AB-734 (ledger/inbox/F5-04.json)
- **Numero pre-alocado:** docs/contrato-w7.md §10 (F5-04 -> 0037)
- **Porta TCP:** 4504 (docs/contrato-w7.md §11)

## Contexto

O card F5-04 entrega as variantes de proporcao: o MESMO manifesto em novos
canvas (16:9 base e 9:16 vertical), com o ∅-crit do PROGRAMA — "conteudo
fora da safe area de qualquer plataforma tem de ficar vermelho". A emenda do
contrato-w7 §6 manda:

1. consumir o **pintor promovido** (`src/composicao/pintura/**`, AB-493) para
   derivar cada variante do mesmo manifesto — o "corte/recorte por viewport"
   da emenda: a derivacao produz o manifesto que casa com o viewport da
   plataforma, e o contrato publico da pintura (`pintar(manifesto, tempo,
   viewport)`, que recusa viewport != manifesto) garante que a arvore desenhada
   e a da variante;
2. consumir as **safe areas dos tokens** (AB-584): a 9:16 e PROVISIONAL e e a
   autoridade do gate; a pesquisa de 2026 **alimenta, nao substitui**, a
   decisao de tokens;
3. o **invariante do bloco de legenda por plataforma** (pergunta 2 do card):
   o bloco de legenda nao pode estourar a safe area em vertical.

As tres perguntas adversariais do PROGRAMA governam o que segue:

1. **O recorte vertical corta texto?** Nao — e isso e provado: a derivacao
   troca so `width`/`height`; `nos`, `cenas`, `fps` e `schema_version` sao os
   MESMOS objetos (heranca por identidade), e o oraculo C1 confere em bytes
   (regra C1). O texto de cada no chega inteiro a variante (teste por no).
2. **A safe area usada e a da plataforma certa?** Sim — o contrato de
   plataformas (src/entrega/variantes/plataformas.ts) deriva o retangulo
   seguro dos PERCENTUAIS dos tokens: 16:9 -> EBU R 95 (actionSafePct 3.5%,
   conferido contra o absoluto do token em 1920x1080); 9:16 -> provisional
   AB-071 (topPct 12%, bottomPct 20%, rightPct 15%, conferido contra o
   `safeRect` do token em 1080x1920).
3. **A variante herda o mesmo timing, ou recalcula e diverge?** Herda — por
   construcao (derivacao troca so o canvas) e por verificacao em bytes (C1).

E a pergunta 2 do card: **o bloco de legenda estoura a safe area em
vertical?** Nao — a regra C2 consome F3-02 (`alturaDoBlocoDeLegenda` /
`caixaVerticalUtil`) e confere por plataforma, ancorado na base da caixa.

## Decisoes

### 1. A variante e o MESMO manifesto em novo canvas — derivacao pura, pintor consumido

`derivarVariante(manifesto, alvo)` (src/entrega/variantes/derivar.ts) e funcao
pura: clona o manifesto trocando SOMENTE `width`/`height` pelo breakpoint dos
tokens (S-5) — alvo fora de `tokens.breakpoints` e RECUSADO nomeando o token.
O timing, a autoria e o conteudo sao herdados por identidade de objeto; o
oraculo C1 (`verificarHeranca`) confere em bytes que nada recalcula.

O render da variante consome o pintor promovido via `ArvoreIntegrada` com a
fixture derivada (fixtures/snapshots/variantes/entrada.tsx registra as
composicoes `variante-16x9` e `variante-9x16`): a fiacao `fiar` anexa os
assets, e `pintar` desenha a arvore no viewport da plataforma. A derivacao e
o "recorte por viewport": o canvas novo E o recorte, e o manifesto da
variante e o que casa com o viewport que o contrato da pintura exige.

### 2. O oraculo de variantes: tres regras, e o ∅-crit e a C3

`verificarVariante(fonte, variante)` (src/entrega/variantes/verificar.ts)
devolve as violacoes; vazia = variante entregavel:

- **C1 (heranca)** — os campos de conteudo (schema, fps, cenas, nos) da
  variante sao byte a byte os da fonte;
- **C2 (bloco de legenda por plataforma)** — para cada plataforma do
  contrato com o aspecto do canvas: o bloco teorico de `maxLines` linhas
  (F3-02) cabe na caixa vertical util (F3-02), ancorado na base;
- **C3 (conteudo na safe area — o ∅-crit)** — o retangulo de CONTEUDO da
  variante (a imagem do retangulo de conteudo da FONTE sob a derivacao: o
  reflow proporcional dos eixos) tem de caber no retangulo seguro da
  plataforma da variante. Violacao nomeia a plataforma e CADA margem com os
  px.

O ∅-crit dispara em DADO REAL: a variante 9:16 da fixture canonica e
REPROVADA — a imagem do EBU action safe da fonte ([38..1042]x[68..1852] em
1080x1920) nao cabe no retangulo util provisional ([0..918]x[230..1536]):
**direita 124px, topo 162px, base 316px**. O gate `just variantes` EXIGE a
reprovacao (se a verificacao voltar limpa, o gate FALHA — a checagem sumiu,
mutacao) e a variante reprovada NAO vira snapshot aprovado (golden de
variante insegura seria o falso-verde do card).

O oraculo de PIXEL (tools/variantes/oraculo.ts) mede no quadro renderizado:
(a) presenca de conteudo dentro da safe area da plataforma (nao-quadro
chapado); (b) nada de tinta nao-explicada fora — a expectativa e o plano de
camadas (fundo z0, fundo opaco dos nos z10 para cabecalho/texto/codigo,
grade z20, vinheta z20) com blend source-over em 8 bits e tolerancia de 3
por canal. Os probes da variante 9:16 (frames 30 e 300) TEM de acusar
vazamento (o ∅-crit em pixel em dado real); os stills 16:9 aprovados TEM de
passar limpos.

### 3. Safe areas: os tokens mandam; a pesquisa alimenta a revisao

A autoridade do gate sao os tokens (S-5): `safeArea16x9` (EBU R 95) e
`safeArea9x16` (provisional AB-071, autoridade pela emenda AB-584). A
pesquisa obrigatoria do card rodou em 2026-08-13 (search.sh, Tier 1 Brave, 5
sondagens) e documentou o seguinte placar (detalhes e fontes em
ledger/evidencia/AB-723.txt):

| Claim | Placar | Fontes |
|---|---|---|
| As plataformas publicam especificacoes de safe zone | (3-0) | TikTok ads.tiktok.com (3 artigos: creative-best-practices, in-feed, topview), YouTube support.google.com (editor de Shorts), Meta facebook.com/business (help + ads-guide Reels) |
| Nenhuma publica numeros fixos em px/% inline para 1080x1920 — zonas DINAMICAS (etapa, idioma, comprimento de legenda, add-ons) | (2-0) | TikTok ("the longer the caption, the smaller the safe zone"; templates em .zip), YouTube ("non-safe area" guiada no editor); Meta: numeros atras de login (1-0) |
| Faixas secundarias 2026: base 250-280px, topo 100-250px, largura util 900-1080px | (1-0) cada | postplanify 2026-01-09 (900x1492), kreatli 2026-02-01 (1080x1420), trymypost 2026-03-10 (base 280px), quso 2026-06-26 (1080x1190), billo 2026-06-16 (Meta unificada) |

A leitura para a revisao de tokens (AB-071): o provisional e mais
conservador que as fontes secundarias na base (384px vs 250-280px) e
semelhante na largura (918px vs 900px), e menos conservador no topo (230px
vs 250px reportado). A decisao NAO muda nesta onda: **o token continua a
fonte de verdade do gate**, e esta pesquisa e evidencia para a revisao
futura — exatamente o que a emenda AB-584 pede.

### 4. O que a variante 9:16 do canonico revelou (achados registrados)

- **AB-720**: o reflow proporcional do canonico nao cabe no retangulo util
  provisional (direita 124px, topo 162px, base 316px) — a variante 9:16 NAO
  e entregavel com o pintor atual. Destino: F5-07 (W9) + revisao de tokens.
- **AB-721**: o marcador de midia placeholder estoura o EBU R 95 em 16:9
  (13px por lado — o inset usa min(w,h)*5% = 54px onde o graphics safe
  horizontal pede 96px) e o retangulo 9:16 (108-330px). Destino: revisao de
  layout quando a midia real chegar.
- **AB-722**: vinheta e grade (retanguloSeguro 3.5%, F1-11) entram no
  retangulo util 9:16 provisional — o AB-58x previu; a primeira composicao
  vertical real confirma por construcao.

## Consequencias

- O gate `just variantes` (bloco F5-04 do justfile, porta 4504) fica VERDE
  com: typecheck escopado (tsconfig.variantes.json), suite vitest (20
  testes), render 2x deterministico, oraculo de pixel, snapshots por
  variante ENTREGAVEL (16:9) e o ∅-crit em dado real (9:16 reprovada).
- O F5-07 (W9, orquestrador de ponta a ponta) consome a API publica:
  `derivarVariante` + `verificarVariante`/`exigirVarianteSegura` +
  `plataformas` — variante so e entregue depois de `exigirVarianteSegura`;
  a 9:16 do canonico e o caso que a verificacao reprova.
- Nenhum token, schema, no, camada, pintor ou modulo de legenda foi editado:
  tudo foi consumido por import relativo (S-5/S-4/singletons intactos).

## Nao verificado

1. Os numeros das plataformas dentro dos templates .zip oficiais da TikTok
   (in-feed e TopView) nao foram baixados (download nao acessivel no fetch) —
   as fontes secundarias convergem com o provisional, mas o numero PRIMARIO
   da TikTok para 1080x1920 continua pendente de extracao do .zip.
2. Os numeros da Meta (Reels overlay) estao atras de login — a faixa
   secundaria (base 280px) e a melhor estimativa disponivel hoje.
3. O oraculo de pixel modela o fundo opaco dos nos (cabecalho/texto/codigo)
   como um retangulo de opacidade 1 — valido para os frames do gate, que
   sao escolhidos no meio das janelas (opacidade dos nos = 1).
