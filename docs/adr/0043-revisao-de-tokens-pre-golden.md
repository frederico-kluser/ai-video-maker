# ADR-0043 — Revisao de tokens pre-golden: AB-720..723 decididos com o gate verde e valores congelados para o F5-08 (W10)

- **Status:** aceito
- **Data:** 2026-08-13
- **PREP:** revisao de tokens (AB-720..723) entre a W9 e a W10 — exigido pelo
  revisor de plano antes de o F5-08 (W10) capturar o golden master
  (`fixtures/gm/**`), para o golden nao nascer com tokens provisorios.
- **Faixa de ledger:** AB-720..AB-723 (ledger/inbox/F5-04.json)
- **Arquivo editado de producao:** somente `src/design/tokens.ts` (S-5) —
  e unicamente comentarios; nenhum VALOR de token mudou.
- **Depende de:** ADR-0037 (variantes de proporcao e safe area por
  plataforma), ADR-0040 (pos — targetLufs -23.0 congelado), ADR-0041 (chave
  C7 do cache por conteudo), ADR-0042 (estrito deterministico — decisao 4:
  o 9:16 nao e entregavel e nenhum artefato 9:16 existe na lista fechada),
  AB-071/AB-584 (safe area 9:16 provisional como autoridade do gate),
  AB-723 (pesquisa 2026 de safe zones — ledger/evidencia/AB-723.txt)
- **Consumida por:** F5-08 (W10, golden master — `just gm:e2e`), F6-04 (W11,
  fechamento do ledger), e qualquer revisao futura de safe area.

## Contexto

O revisor de plano registrou: "a revisao de tokens (AB-720..723) tem de
acontecer ANTES do F5-08 (W10) capturar o golden master, senão o golden
nasce velho". Os quatro itens do ledger cobrem as divergencias conhecidas
entre os tokens de safe area e as normas/plataformas:

- **AB-720**: a variante 9:16 do canonico e REPROVADA pelo ∅-crit do F5-04
  (conteudo fora do retangulo util provisional: direita 124px, topo 162px,
  base 316px);
- **AB-721**: o marcador de midia placeholder usa inset
  `round(min(w,h)*graphicsSafePct)` = 54px em 1920x1080, quando o graphics
  safe horizontal da EBU R 95 pede 96px (estoura 13px/lado do action safe
  em 16:9);
- **AB-722**: vinheta e grade (retanguloSeguro 3.5% do F1-11) entram no
  retangulo util 9:16 provisional;
- **AB-723**: pesquisa 2026 das plataformas (TikTok/YouTube/Meta) — zonas
  de UI DINAMICAS sem numero fixo; faixas secundarias: base 250-280px,
  topo 100-250px, largura util 900-1080px.

A pergunta central desta revisao: **os valores dos tokens mudam, ou a
decisao se registra por documentacao?** A resposta, para os quatro itens,
foi: **VALORES INALTERADOS — decisoes registradas com evidencia**. O
raciocinio comum: o estrito da W10 e 16:9-only (ADR-0042, decisao 4 — "o
9:16 nao e entregavel (AB-720..722) e nenhum artefato 9:16 existe na lista
fechada"); os valores 16:9 ja passam todos os gates; e alterar valores
consumidos por snapshots/golden exigiria recaptura em massa no PREP em que
a regra de casa pede re-aprovacao explicita com revisao de diff — o custo
nao se justifica sem que o 9:16 seja entregavel, o que e decisao de layout
futura, nao de tokens.

## Decisoes

### 1. AB-720 — safe area 9:16 permanece PROVISIONAL com a reprovacao documentada

**Decisao:** manter `safeArea9x16` (topo 12%/230px, base 20%/384px, direita
15%/162px, safeRect [0..918]x[230..1536]) EXATAMENTE como esta. A
reprovacao do F5-04 — a variante 9:16 do canonico REPROVADA nomeando as
margens (direita 124px, topo 162px, base 316px) — continua sendo o estado
correto e o teste que a exige (`tests/entrega/variantes.test.ts`, suite
"o ∅-crit: conteudo fora da safe area fica vermelho") permanece VERDE.

**Evidencia:** `npx tsx tools/variantes/provar.ts` (e a suite vitest de
variantes) sai VERDE com a variante 9:16 REPROVADA; o ∅-crit de mutacao
(remover a checagem de safe area deixa a 9:16 aprovada em silencio) exige
que a reprovacao continue.

**Por que nao "consertar" o 9:16:** mudar os percentuais para a faixa
pesquisada (base 250-280px, topo 250px, largura 900px) faria a variante
9:16 do canonico continuar reprovada (o reflow proporcional do EBU action
safe continua nao cabendo em qualquer retangulo util realista — o problema
e o RE-LAYOUT, nao a margem) E invalidaria a documentacao da reprovacao
medida (124/162/316px) que o ADR-0037 e o inbox registram. A decisao do
F5-07 foi 16:9 apenas no estrito; a entrega vertical exige re-layout por
plataforma, decisao de composicao futura — fora do escopo de tokens.

### 2. AB-721 — marcador de midia: divergencia documentada, valor mantido

**Decisao:** manter `graphicsSafePct = 0.05` (EBU R 95 16:9: 96px
horizontal / 54px vertical — valores conformes a norma). A causa do
estouro de 13px/lado NAO e o token: e o CONSUMO no no de midia
(`src/composicao/nos/midia.tsx` — `Math.round(Math.min(width, height) *
safeArea16x9.graphicsSafePct)`), que colapsa as duas dimensoes no menor
lado. Esta PREP NAO pode editar codigo de no (fronteira: somente
tokens.ts); e mudar o token para "consertar" o no (ex.: graphicsSafePct ≈
8.9% para que min(w,h)*pct = 96) quebraria os valores conformes da EBU
R 95 usados em todo o resto (actionSafe/graphicsSafe, retanguloSeguro,
cache C7, golden).

**Evidencia:** o valor do token confere com a EBU R 95 v1.1 (action safe
3.5%, graphics safe 5% — `docs/00-panorama-verificado.md` §1.5, R14-11);
o oraculo de pixel do F5-04 mede o marcador como a unica tinta fora do
action safe em 16:9 (13px por lado) — exatamente o inset de 54px vs os
96px pedidos.

**Condicao de saida documentada:** o marcador e PLACEHOLDER (F1-12 mede o
INTERIOR dele; o oraculo integrado aceitou como tal). Quando a midia real
chegar (asset decodificado no render — decisao F5-07/W9), o marcador sai
da tela e a divergencia desaparece sem nenhuma mudanca de token. Se o
placeholder permanecer alem da W10, a correcao e de NO (inset por dimensao:
`round(width*pct)` e `round(height*pct)`), atribuida a um PREP de layout —
nunca via token.

### 3. AB-722 — vinheta e grade: 16:9-only confirmado e documentado

**Decisao:** confirmar por construcao (geometria) e documentar:
`retanguloSeguro` deriva de `actionSafePct` 3.5% POR DIMENSAO
(`src/composicao/camadas/contrato-de-camada.ts`) e e 16:9-only por decisao
do AB-58x (F1-11). Em canvas 9:16 as bandas de margem das camadas entram
no retangulo util provisional — o oraculo de pixel do F5-04 classifica
essa tinta como EXPLICADA pelas camadas (nao e conteudo), entao nenhum
gate fica falso-verde; a consequencia real e que a vinheta escurece
conteudo dentro da safe area provisional. Como o 9:16 nao e entregavel
(AB-720, ADR-0042 D4), nenhuma acao: a composicao vertical futura exigira
camadas verticais proprias (decisao de layout, nao de token).

**Evidencia:** `npx vitest run tests/composicao/camadas/contrato-de-camada.test.ts
-t 'margemSegura'` VERDE: retanguloSeguro deriva de actionSafePct 3.5%
(16:9), e a interseccao com o retangulo 9:16 provisional nao e vazia em
canvas 1080x1920 — registrado no ADR-0037.

### 4. AB-723 — pesquisa 2026 alimenta a DOCUMENTACAO, nao os valores

**Decisao:** a pesquisa 2026-08-13 (ja FECHADA como evidencia —
`ledger/evidencia/AB-723.txt`) passa a alimentar a documentacao do token:
o comentario de `safeArea9x16` em tokens.ts agora resume as faixas
secundarias (base 250-280px, topo 100-250px, largura util 900-1080px), o
fato de as plataformas publicarem zonas DINAMICAS sem numeros fixos
inline (placar 3-0/2-0) e aponta para este ADR. VALORES INALTERADOS: o
provisional e mais conservador na base (384px vs 250-280px), menos no
topo (230px vs 250px) e otimista na largura (918px vs 900px) — a leitura
e registrada, e a autoridade do gate continua o provisional (AB-584:
"a pesquisa alimenta, nunca substitui").

### 5. Comentario stale do `targetLufs` corrigido (referencia ADR-009 → ADR-0040)

O comentario do `targetLufs` citava "ADR (P-09 → ADR-009)" — o ADR-009 e o
estagio grafico do Manim, nao loudness (constatado pelo proprio ADR-0040,
que registrou a referencia como stale mas nao pôde editar o singleton). O
valor -23.0 LUFS e a decisao de tokens NAO mudam: o ADR-0040 congelou o
alvo e o gate do pos (F5-03) o le COMO ESTA. Apenas o comentario foi
atualizado para apontar para o ADR-0040 e para esta revisao.

## Consequencias

- **Nenhum VALOR de token mudou** — logo: a chave C7 do cache (ADR-0041)
  NAO muda (serializarCanonico hasheia valores, nunca comentarios); o
  golden do F3-01 (`fixtures/canonico/timing-canono.json`) e os artefatos
  das W7/W8 NAO mudam; NENHUM snapshot foi recapturado (nao houve mudanca
  de pixel).
- A reprovacao da variante 9:16 permanece o estado correto e testado.
- O F5-08 (W10) captura o golden master sobre tokens REVISADOS e
  documentados — sem tokens provisorios indecisos.
- Gates verificados apos a revisao: `bash tools/gate.sh` VERDE (5 PASS),
  `just design-varrer` VERDE, `just design-testar` VERDE, suite vitest
  completa VERDE (87 arquivos / 3166 testes), `validate-ledger.py` sem
  erros.

## Nao verificado

1. Os numeros PRIMARIOS da TikTok dentro dos templates .zip oficiais
   (in-feed e TopView) continuam pendentes de extracao (herdado do
   ADR-0037); as faixas secundarias sao (1-0) por numero.
2. A correcao de no do inset do marcador de midia (por dimensao, se o
   placeholder permanecer) NAO foi aplicada: e mudanca de codigo de no,
   fora da fronteira desta PREP — condicao de saida documentada na
   decisao 2.
