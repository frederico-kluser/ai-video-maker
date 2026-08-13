# ADR-0006 — Camadas globais e a safe area que nenhuma sobreposicao cobre

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F1-11
- **Depende de:** ADR-0001 (todo card tem oraculo), F0-06 (harness de
  determinismo), F1-01 (contrato de no e composicao raiz), F1-03 (fontes locais)

## Contexto

O video final tem tres camadas globais: um **fundo** de cor com banho
escalonado, uma **grade** de composicao e uma **vinheta** de borda. O modo de
falha que este card persegue e silencioso e confirmatorio: uma vinheta ou
grade decorativa que avanca para dentro da safe area escurece o texto — o
render sai com exit 0, o quadro tem pixel, o video tem conteudo, e o texto
esta com contraste errado sem nenhum log e nenhum erro.

Pior, as duas respostas naturais ao problema sao falsos verdes:

1. **"A camada renderiza sem erro"** — um componente que devolve quadro vazio
   tambem renderiza sem erro (AGENTS.md, C1).
2. **"Compare o quadro com o render anterior"** — dois renders identicos de
   uma camada que invade a safe area passam com nota maxima (camada 1 do
   oraculo: determinismo prova estabilidade, nao correcao).

A garantia nao pode vir de olhar a imagem: precisa vir de MEDIR, e medir
exige que a camada declare, em numero, o retangulo que pinta.

## Decisao

### 1. O contrato de camada: `planoDePintura` — a camada e literalmente `plano.map(...)`

Toda camada global exporta, alem do componente, uma funcao pura
`plano(props) -> RetanguloPintado[]` que declara os retangulos que ela pinta
naquele frame. O componente nao desenha nada que nao esteja no plano — o
renderizador unico `_pintar.tsx` e literalmente `plano.map(...)`.

Consequencias:

1. "A camada nao cobre a safe area" deixa de ser opiniao sobre a imagem e
   vira aritmetica: `areaDaIntersecao(plano, retanguloSeguro) === 0`.
2. Um retangulo declarado que nao vira pixel e detectavel (o gate exige que
   todo declarado tenha ao menos um pixel diferente).
3. Nenhum componente pode "esconder" um retangulo do teste: o que ele
   desenha e o que o plano declara, por construcao.

Alternativa descartada: medir por "contorno de diferenca" entre renders (o
pixel difuso de uma rampa de opacidade e onde o diff de imagem mais mente —
cada fatia e um retangulo, e o plano mantem a correspondencia exata).

### 2. Dois papeis: `fundo` e `sobreposicao` — e so o segundo e proibido na safe area

- **`fundo`** desenha em `zIndex.background`, abaixo do conteudo. Pode ocupar
  o quadro inteiro: o conteudo esta na frente e a cobre. Mas o gate de pixel
  mede o mesmo: um fundo que suba de z-index para cima do conteudo reprova
  com `INVASAO` — a sonda inversa e coberta pelo cenario de prova.
- **`sobreposicao`** desenha em `zIndex.overlay`, acima do conteudo. Cada
  pixel dela apaga um pixel de conteudo. Nenhum retangulo dela pode tocar a
  safe area — cobrado por dados no teste e por pixel no gate.

### 3. A grade e a vinheta vivem INTEIRAS nas bandas de margem

A grade de composicao "obvia" (linhas atravessando o quadro inteiro) cobre a
safe area por construcao. A vinheta "bonita" (avancando 20-30% para o
centro) tambem. As duas aqui sao desenhadas como **marcas de registro nas
bandas de margem**: a margem entre o quadro e o retangulo seguro e dividida
em quatro bandas (`topo`, `base`, `esquerda`, `direita`) que ladrilham a
margem sem intersecar o conteudo; a grade pinta tracinhos de divisao de
coluna/linha dentro das bandas, e a vinheta pinta uma rampa de fatias
solidas, da borda do quadro ate a fronteira da safe area.

A rampa da vinheta termina em `OPACIDADE_MINIMA_VISIVEL`, nunca em zero: uma
fatia de opacidade zero tem exatamente o pixel de uma fatia que nunca foi
desenhada, e o gate perderia a capacidade de separar "camada correta" de
"componente que devolveu quadro vazio".

Nada de gradiente CSS: `background-image` e proibido em `src/composicao/`
(contrato de F1-01) — a rampa e feita de fatias solidas de cor de token.

### 4. A safe area vem do PERCENTUAL do token, nunca do absoluto

`tokens.safeArea16x9` define margens em percentual (`actionSafePct: 0.035`) e
em pixels absolutos para 1920x1080 (67/38). O contrato deriva a margem do
PERCENTUAL (`round(0.035 * dimensao)`), porque o contrato precisa valer em
qualquer resolucao e o absoluto vale so para 1080p. Em 1920x1080 as duas
pontas coincidem (67.2 -> 67, 37.8 -> 38) e o teste amarra as duas.

Qual percentual: o de **action safe** (3.5%), o MAIOR dos dois retangulos —
ele contem o de graphics safe (5% seria menor, 96/54 px). Proteger o maior
protege os dois; proteger o menor deixaria uma faixa de 29 px onde decoracao
e conteudo se sobrepoem sem gate nenhum perceber.

### 5. O oraculo e a piramide inteira, nao uma camada so

| Camada do oraculo | O que este card entrega |
|---|---|
| Estrutural (ffprobe) | nao se aplica a still; a entropia por arquivo cobre o PNG vazio |
| Determinismo | `camadas-det-provar`: render 2x, bytes identicos, `--gl=swangle` fixo |
| Golden master | `fixtures/snapshots/camadas/*.png` aprovados a partir do RENDER (nunca do Studio), comparados byte a byte pelo gate |
| Invariante | plano geometrico x retangulo seguro, por dados, em teste (72 testes) |
| Sonda negativa | `camadas-invasora` (INVASAO) e `camadas-vazia` (QUADRO VAZIO) — as duas TEM de reprovar com a mensagem certa |

O gate `just no-camadas` responde a pergunta do card em pixel: renderiza as
7 composicoes da prova, exige zero pixels mudados dentro da safe area, todo
pixel mudado dentro de um retangulo declarado, todo retangulo declarado com
pixel — e os dois oraculos de git sobre o diretorio aprovado (`git diff
--exit-code` combinado com `git status --porcelain`, porque o diff nao
enxerga arquivo nao rastreado).

### 6. O ∅-crit e a ausencia

Apagar um snapshot aprovado tem de deixar o gate VERMELHO com o marcador
`SNAPSHOT AUSENTE` — nunca virar "nada a comparar". O teste de ausencia
(`camadas-ausencia`) apaga um snapshot, exige o vermelho com o marcador,
restaura e exige verde de novo. Esta e a unica classe de falha que o resto
da cadeia nao cobre.

## Consequencias

- **S-5 (tokens.ts) nao foi tocado.** Opacidades e contagens que tokens.ts
  nao define vivem em `src/composicao/camadas/tokens-de-camada.ts` (AB-380):
  nenhum valor de cor, espacamento ou duracao foi copiado de tokens — o gate
  design-varrer segue verde.
- **O contrato de camada e 16:9.** A safe area 9:16 (tokens.safeArea9x16,
  provisoria, AB-071) nao tem implementacao no contrato (AB-382).
- **A integracao na raiz de producao e do F1-12 (W5)** — src/Root.tsx e S-3
  (AB-383). Este card entrega o registro, o contrato e o cenario de prova
  com a ordem de z-index que a raiz vai precisar.
- **`just` 1.42 nao aceita ':' em nome de receita** e a receita `det-provar`
  de F0-06 nao aceita argumentos: o equivalente de `just det:provar --no
  camadas` e `just camadas-det-provar` (AB-381).

## Alternativas descartadas

1. **Comparar a imagem por limiar de diff** — o numero certo nao existe sem
   medir o ruido, e um limiar afrouxado e o mecanismo pelo qual um oraculo
   morre (video-characterization). Aqui a comparacao e byte a byte, tolerancia
   zero: os dois renders saem do mesmo cenario deterministico.
2. **Vinheta terminando em opacidade zero** — "mais elegante" e destrutivo
   para a medicao (ver decisao 3).
3. **Grade com linhas no quadro inteiro em opacidade baixa** — cobrir a safe
   area em opacidade 0.1 ainda e cobrir a safe area: o contraste do texto
   muda e nenhum teste de "renderizou" acusa.
4. **`radial-gradient`/`linear-gradient` CSS** — `background-image`, proibido
   em src/composicao/ (F1-01).
5. **Medicao por comparacao de arquivos (`cmp`)** — responde "os arquivos
   diferem", e a pergunta e ONDE eles diferem: dentro ou fora da safe area.
   Sem pixel nao ha resposta, so opiniao sobre a imagem.
