# ADR-0007: No `lista` -- grade derivada, bloco justo ao conteudo e overflow como erro de build

**Status:** ACEITO
**Data:** 2026-08-11
**Card:** `F1-06` (W4)
**Depende de:** F1-01 (contrato de no), F1-02 (motor de layout), F0-04 (tokens), F0-09 (fixture canonica)
**Consumida por:** quem for renderizar `lista` no manifesto, e quem for escrever o proximo no com grade

**Guardas executaveis:**

- `just no-lista` -- a aceitacao inteira do card, em ordem
- `just no-lista-determinismo` -- render 2x em processos separados, `cmp` byte a byte
- `just no-lista-snapshot` -- regrava e exige `git diff --exit-code` **e** `git status --porcelain` limpos
- `just no-lista-ausencia` -- ∅-crit: apagar, corromper e nao rastrear um snapshot ficam VERMELHOS
- `just no-lista-mutar` -- quadro vazio, safe area zerada e piso de fonte de 1px ficam VERMELHOS

## Contexto

O card nao pede uma lista bonita: pede os dois extremos. **Um item** e **vinte
itens** sao onde o layout de lista mente. Entre eles, qualquer coisa funciona.

O primeiro extremo produz grade absurda: uma celula que se estica pela safe
area inteira, ou tres colunas com duas vazias, ou uma fonte inflada para
"preencher". O segundo produz as duas falhas que este projeto trata como
opostas: **sair da safe area** (o video perde texto na borda de quem assiste na
TV) e **encolher para caber** (o video fica ilegivel e o build fica verde).

Encolher e a pior das duas, e por um motivo assimetrico: sair da safe area
ainda deixa o texto visivel em algum monitor; encolher abaixo do piso legivel
produz um artefato que passou em todos os gates e que ninguem consegue ler.

## D1 -- A grade e derivada da contagem, nao declarada no manifesto

`NoLista` nao tem campo `colunas`, e nao vai ganhar um por causa deste card
(`schema/manifesto.schema.json` e singleton S-4). A grade e funcao da contagem:

```
colunas = min(3, ceil(itens / 7))       linhas = ceil(itens / colunas)
```

- 1 a 7 itens -> 1 coluna
- 8 a 14 -> 2 colunas
- 15 ou mais -> 3 colunas (20 itens = 3 colunas de 7, 7 e 6)

O preenchimento e **coluna a coluna** (desce a primeira coluna inteira, depois
comeca a segunda), que e a ordem de leitura de lista impressa.

**7 itens por coluna** e heuristica de agrupamento declarada -- Miller (1956),
"sete mais ou menos dois" (<https://psychclassics.yorku.ca/Miller/>), nao norma
herdada. **3 colunas** e teto porque, com quatro, a largura de coluna em 16:9
cai abaixo do que uma frase de lista precisa: a fonte passaria a encolher por
causa da GRADE, e nao do conteudo -- e a mensagem de erro apontaria para o
lugar errado.

Os dois numeros vivem em `src/composicao/nos/lista.tsx`, nao em
`src/design/tokens.ts`. Nao sao token de design (cor, espaco, duracao, fonte,
tamanho): sao a forma da grade. Alem disso `tokens.ts` e singleton S-5, e esta
onda nao pode edita-lo. Se o projeto quiser tokeniza-los, e PREP da onda
seguinte -- registrado no handoff e em AB-336.

## D2 -- O bloco e justo ao conteudo (a resposta ao caso "UM item")

A largura de celula e `min(largura da coluna da safe area, largura medida do
item mais largo)`; a altura do bloco e `linhas * altura de linha + gaps`. O
bloco resultante e centrado no eixo vertical e alinhado no horizontal conforme
`alinhamento`.

Com um item, isso da: 1 coluna, 1 linha, um bloco de 470x31 px numa safe area
de 1786x1004 -- e nao uma celula de 1786x1004 com uma frase no meio.

A fonte **nunca cresce** acima de `typeScale.body`. "Inflar para preencher"
seria a outra forma de grade absurda: um item vira cartaz, dois itens viram
lista, e o mesmo manifesto muda de identidade visual por causa da contagem.

## D3 -- A fonte so desce ate o piso; abaixo do piso, o build PARA

```
piso  = max(MIN_FONT_SIZE_PX, round(altura * typeScale.small))
base  = max(piso, round(altura * typeScale.body))
```

`MIN_FONT_SIZE_PX` (16px) vem de F1-02. O `max` com `typeScale.small` faz o
piso **subir junto com a resolucao**: em 4K, 16px absolutos seriam ilegiveis, e
o piso vira 32px.

O ajuste usa `fitTextToBounds` por coluna, pega o **menor** tamanho entre as
colunas, e entao chama `assertNoOverflow` por coluna nesse tamanho. Se alguma
coluna nao couber, sai `TextOverflowError` com o id do no, o texto truncado, a
fonte e quantos pixels excederam -- e o render para.

Os dois lados da fronteira estao exercitados em
`tests/composicao/no-lista.test.ts`:

| caso | itens | o que o codigo faz |
|---|---|---|
| `vinte-itens` | 20 curtos | cabe na fonte do token (22px), nada encolhe |
| `CASO_QUE_ENCOLHE` | 20 largos | encolhe 22 -> 20px, acima do piso, e cabe |
| `CASO_QUE_NAO_CABE` | 20 enormes | **falha**: `TextOverflowError` em 16px |

A reserva de 1px por linha na altura util nao e detalhe: a altura de linha e
arredondada **para cima** (`ceil`), e sem a reserva o bloco passa da safe area
por ate 3px sem ninguem ver.

## D4 -- O no recusa desenhar fora da propria janela

`frame < 0` ou `frame >= duracao_frames` devolve `null`. O envelope da raiz ja
janela (F1-01, D1b), entao isto e redundancia -- deliberada: um no que desenha
fora da duracao declarada nao aparece como erro, aparece como fantasma sobre o
no seguinte, e a bisseccao acusa o card errado.

A coreografia de entrada tambem cabe na janela. O escalonamento entre itens tem
direito ao orcamento `duracao - saida - entrada`; se nao houver orcamento, o
passo cai a zero e todos entram juntos. A invariante testada e:

> no frame `duracao - saida`, TODA opacidade e 1.

Ou seja: ninguem ainda esta entrando quando o no comeca a sair. Com 20 itens e
12 frames de duracao, o passo e 0 -- o escalonamento encolhe, a janela nao.

## D5 -- Snapshot em dois arquivos, aprovado por processo separado

Por caso aprovado saem `<caso>.html` (o markup, que e o que vira pixel) e
`<caso>.json` (o plano de layout: grade, fonte, safe area, caixas). O HTML e o
byte; o JSON e o que um humano revisa num diff. Um snapshot que ninguem
consegue ler nao e aprovado, e tolerado.

O determinismo e provado em **dois processos** (`tools/no-lista/determinismo.sh`),
nao em duas chamadas na mesma memoria: ordem de chave, semente de hash e
relogio nao sobrevivem ao segundo processo.

O snapshot **nao e pixel de navegador**. AGENTS.md C5 (o Chrome do Studio nao e
o Chrome do render) proibe aprovar pixel vindo do Studio; aqui nao se aprova
pixel nenhum -- aprova-se o markup e a geometria, que sao o que este card
decide. O pixel continua coberto pelo canario de F0-06 (`just det-provar`).

## Consequencias

- Um manifesto com item de lista muito longo passa a **derrubar o build**. Isso
  e intencional: a acao correta e encurtar o item ou dividir em mais nos, e a
  mensagem de erro diz as duas coisas.
- Mudar `typeScale.body`, `typeScale.small`, `spacing` ou `safeArea16x9` muda
  todos os snapshots deste card. Isso e o comportamento desejado de S-5:
  alteracao de token recaptura snapshot.
- O `alinhamento: "direita"` posiciona o bloco a direita da safe area, mas o
  marcador continua a esquerda do texto. Lista com marcador a direita nao foi
  pedida e nao foi feita.

## O que este documento NAO cobre

- Como o no e descoberto e registrado -- ver `docs/adr/0006-composicao-raiz.md`
- A tabela de largura por classe de caractere -- ver `src/composicao/layout/medicao.ts`
- Quebra de linha dentro de um item: **nao existe**. Um item e uma linha. Se
  nao couber em uma linha, o build para. Ver AB-334.
- Transicoes entre cenas -- F1-10
