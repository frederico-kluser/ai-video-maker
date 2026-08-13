# ADR-0038 — Thumbnail gerado do MESMO manifesto, com contraste medido no pixel

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-05 (W7, entrega)
- **Depende de:** F1-12 (fixture canonica integrada — o oraculo que o
  thumbnail consome), AB-493 (o pintor promovido para
  `src/composicao/pintura/`, PREP-w7), F1-01 (aritmetica de composicao —
  `planoDeComposicao`), S-1/`src/design/tokens.ts` (cores, contraste,
  safe area — leitura, nunca edicao)
- **Faixa de ledger:** AB-735..AB-744 (ledger/inbox/F5-05.json)
- **Numero pre-alocado:** docs/contrato-w7.md §10 (F5-05 -> 0038)

## Contexto

O card pede um thumbnail do video que seja **gerado do mesmo manifesto** —
nunca digitado a parte — e com um ∅-crit: **thumbnail com contraste abaixo
do minimo tem de falhar**. Tres perguntas adversariais governam o que
segue (PROGRAMA.html, card F5-05):

1. **O texto do thumbnail e legivel no tamanho em que ele aparece de
   fato?** (tamanho pequeno — 16:9; o caso vertical e das variantes do
   F5-04)
2. **E gerado do mesmo manifesto (consome o pintor promovido), ou digitado
   a parte e divergindo?**
3. **O contraste e medido (WCAG) ou so declarado?**

Este ADR registra as decisoes que respondem as tres com codigo executavel,
e o que ficou de fora de proposito (vertical, tokenizacao — ledger).

## Decisoes

### 1. O unico caminho para o pixel do thumbnail e o pintor promovido

O thumbnail nasce de `ArvoreIntegrada`/`pintar`
(`src/composicao/pintura/**`, AB-493) renderizado no frame escolhido — a
MESMA arvore que o render usa. O gate prova isso no pixel: o fundo do
thumbnail tem de ser o fundo dos tokens e as cores do titulo/subtitulo do
manifesto tem de estar na tela (`tests/entrega/thumbnail/gate.ts`, etapa
"conteudo"). Nenhum texto, cor ou geometria e digitado no modulo de
entrega: o texto do thumbnail so pode ter vindo do manifesto.

O pintor promovido **recusa** viewport que nao case com o manifesto (regra
`viewport==manifesto` do contrato da pintura): a escala nao entra no
pintor. O pintor pinta no tamanho do manifesto e o thumbnail e o MESMO
quadro em escala menor (`scale` do `renderStill`). Consequencia para o
F5-07 (W9, consumidor): o thumbnail de uma proporcao diferente do
manifesto NAO e obtido por um viewport alternativo no pintor — e o
problema das variantes (F5-04) e do recorte vertical, fora do alcance
deste card (AB-736).

### 2. O frame e escolhido pela aritmetica do render, nunca a mao

`escolherFrameDoThumbnail` usa o MESMO `planoDeComposicao` (F1-01) do
render: o frame e o meio da janela do **primeiro no `cabecalho`** da
timeline — o titulo do video no momento de maxima visibilidade. A mola de
entrada esta acomodada nesse frame (medido: mola = 1.0 no frame 45 da
fixture canonica, janela [0, 90)). Manifesto sem cabecalho e RECUSADO
(`ThumbnailSemTitulo`) — sem titulo nao ha thumbnail.

### 3. Legibilidade no tamanho de saida: piso WCAG large (24px)

A escala de saida e 2/3 do manifesto (1920x1080 -> 1280x720, o padrao de
thumbnail do YouTube), e a altura do titulo NO TAMANHO DE SAIDA e a conta
`round(alturaDoFrame * typeScale.display) * escala` — 36px na fixture
canonica, acima do piso de texto grande do WCAG (18pt = 24px). Abaixo do
piso o thumbnail nao e entregue: falha dizendo por que (melhor do que
titulo ilegivel em silencio). O piso e normativo (WCAG), nao token de
design — a promocao a token fica em aberto (AB-735).

### 4. Contraste MEDIDO no pixel, com o minimo vindo dos tokens

`medirContrasteDoThumbnail` decodifica o PNG renderizado, mede a regiao
graphics safe dos tokens (margem POR EIXO — a mesma aritmetica do padding
do cabecalho e dos retangulos seguros das camadas; fora dela ficam a
vinheta e a grade, que escurecem a borda de proposito), acha o fundo (cor
dominante) e as tintas, e calcula a razao WCAG de cada tinta contra o
fundo com a **MESMA formula dos tokens** (`contrastRatio` importada).

O minimo de cada tinta vem da declaracao: a tinta que casa um par
registrado em `tokens.ts` herda o minimo do par (AA normal 4.5 quando o
par declara passar AA normal); tinta sem par declarado cai no piso AA
large 3.0. Assim a declaracao e conferida contra a tela e a tela e
conferida contra a declaracao — o contraste e MEDIDO, e o minimo nao e
inventado pelo modulo.

Ruido de anti-aliasing nao e tinta: misturas de borda de glifo com poucos
pixels (maximo medido 172px no render real em 1280x720) ficam fora da
conta por um piso de contagem; cores DECLARADAS nos tokens sao sempre
medidas, mesmo abaixo do piso (o subtitulo de 18px da fixture tem so
~106px solidos e continua na conta — texto pequeno ainda e texto).

### 5. O ∅-crit e exercitado contra os pixels REAIS, nos dois sentidos

O gate renderiza o thumbnail 2x (determinismo: bytes identicos), mede o
conteudo (C1: preto tambem e deterministico), mede o contraste dos pixels
reais (tem de passar) e entao **repinta a tinta mais frequente do
thumbnail real com gray 600 (2.66:1, abaixo do piso) e exige que a medicao
FALHE** — o ∅-crit "contraste abaixo do minimo tem de falhar" executado
no proprio gate, contra os pixels que o pintor produziu. O entregavel
(`output/thumbnail.png`) so sai depois do gate verde.

### 6. Nenhuma assercao sobre listas completas (contrato-w7 §12)

Todas as assercoes do diff sao de PRESENCA: a composicao `thumb` existe
(`selectComposition`), o primeiro cabecalho do SEU manifesto esta na tela,
as tintas do SEU titulo estao no thumbnail, a medicao falha com a SUA
tinta repintada. Nenhuma assercao conta nos, cenas, faixas ou tintas
inteiras — o que o irmao da W7 adicionar depois do merge nao quebra este
gate.

## Consequencias

- `src/entrega/thumbnail/**` e a API publica (frame, escala, legibilidade,
  contraste) — o F5-07 (W9) importa daqui, nunca reimplementa.
- O gate `just thumb` (bloco `# === F5-05 ===` do justfile) roda:
  typecheck, suite do modulo (com guarda de C2), e o script
  `tests/entrega/thumbnail/gate.ts` (determinismo + conteudo + contraste +
  ∅-crit).
- O thumbnail de proporcao vertical (9:16) NAO e deste card: e das
  variantes (F5-04) e do consumo do F5-07 (AB-736).
- Nenhum token foi alterado (S-1/S-5 intactos); escala de saida, piso de
  legibilidade e piso de contagem sao constantes do modulo com citacao e
  ledger (AB-735).
