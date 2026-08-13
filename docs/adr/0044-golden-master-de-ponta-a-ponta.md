# ADR-0044 — Golden master de ponta a ponta: manifesto resolvido + frames-chave + envelope de audio

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-08 (W10, critico) — golden master de ponta a ponta
- **Artefatos:** `fixtures/gm/**` (indice + 13 itens), `tools/gm/` (extrair/capturar/gate)
- **Comando de aceitacao:** `just gm-e2e` — 2x identico; qualquer mudanca
  de token, de fonte ou de versao de ferramenta acende o diff
- **Faixa de ledger:** AB-830..AB-849 (ledger/inbox/F5-08.json)
- **Depende de:** F5-07 (pipeline de ponta a ponta, ADR-0042),
  ADR-0041 (chave C7), ADR-0043 (tokens congelados pre-golden),
  ADR-0034 (MixDocument.1), ADR-0040 (PosDocument.1)
- **Consumida por:** F6-04 (W11 — fechamento do ledger usa o golden),
  F6-01/F6-02/F6-03 (W11 — revisao humana e publicacao)

## Contexto

O F5-07 entregou o pipeline de ponta a ponta com gate estrutural (11
artefatos, hash + tamanho, ausencia nomeada). O que faltava e o **oraculo
do conteudo**: como saber que um render futuro nao regrediu em pixel ou
em som? A resposta deste programa e o golden master adaptado (ADR-0001):
snapshot aprovado + prova de determinismo, na piramide de camadas do
`video-characterization`.

A pergunta adversariais do card que moldaram este desenho:

1. **"O golden master compara o MP4 byte a byte? Isso e falso oraculo —
   o encoder muda."** Nao. O golden compara: manifesto resolvido (JSON),
   frames-chave (PNG do master QTRLE — codec deterministico da chave C7,
   ADR-0041/0035) e o envelope de audio (projecao do master.wav do mix).
   O MP4 final entra apenas POR INDICE: o relatorio-final.json participa
   do golden, e ele carrega o hash de cada um dos 11 artefatos — se o
   mp4 mudar de bytes, o relatorio-final muda junto.
2. **"O que ele NAO cobre esta escrito?"** Sim — no indice
   (`fixtures/gm/manifesto.json`, campo `naoCobre`), no README e neste
   ADR: MP4 byte a byte, timing sub-janela da locucao, 9:16 (nao
   entregavel do estrito, ADR-0042 decisao 4), rede (offline-guard) e
   maquina (baseline vale na maquina que capturou).
3. **"Uma regressao de AUDIO sem regressao de VIDEO e detectada?"** Sim —
   o envelope e projecao dos bytes do master.wav (RMS por janela de
   100 ms, por canal). Mudou ganho/ducking/bytes da emenda, mudou o
   envelope, o gate fica VERMELHO — mesmo com os frames identicos.

## Decisoes

### 1. O golden compara QUATRO familias de item, nunca o MP4

`fixtures/gm/` guarda: (a) os quatro manifestos (`manifesto-resolvido`,
`mix-documento`, `pos-documento`, `relatorio-final` — este ultimo e o
INDICE de hashes do proprio pipeline sobre os 11 artefatos); (b) 8
frames-chave em PNG extraidos do **master.mov** (QTRLE/argb) pelo mesmo
ffmpeg pinado do pipeline; (c) o envelope do audio; (d) o indice do
golden (`manifesto.json`, formato GoldenMaster.1) que declara itens,
sha256, frames com motivo, ferramentas, pilha Remotion, chave C7,
commit e maquina.

**Por que o relatorio-final.json participa:** ele e escrito POR ULTIMO e
atomicamente (F5-07) e carrega hash + tamanho de cada um dos 11
artefatos de entrega. Captura-lo da cobertura dos 11 sem capturar os 11:
uma mudanca em `entregavel.m4a`, `thumbnail.png`, `variante-16x9.json`
ou no `entregavel-final.mp4` muda o relatorio-final e o golden acende.

**Por que frames do master.mov e nao do MP4:** o QTRLE e lossless e
deterministico (o render deterministico da chave C7); o MP4 carrega a
versao do encoder — bump de ffmpeg invalidaria 100% dos baselines de
uma vez, indistinguivel de regressao real. A extracao do PNG e feita
pelo MESMO ffmpeg pinado (6.1.1) e foi medida deterministico byte a byte
na captura (duas extracoes do mesmo frame = mesmo sha256).

### 2. A lista de frames-chave e DERIVADA e gravada no indice

A lista e derivada do manifesto da fixture pelas MESMAS funcoes do
render (`planoDeComposicao`): frame 0 (inicio); primeira moldura de cada
cena (fronteiras de transicao — onde a interpolacao esta exercida); meio
das cenas representativas (a que contem no tipo "grafico" e a que contem
"codigo"); ultima moldura (fim). No indice, cada frame carrega o MOTIVO.

O gate usa a lista GRAVADA, nunca re-derivada a cada execucao: se a
fixture mudar de forma (cena nova/removida), os frames gravados
permanecem — a mudanca acende o diff em vez de deslocar a amostragem
para longe da regressao. Uma fixture cujo total de frames encolher abaixo
de um frame gravado falha a extracao — VERMELHO por ausencia.

### 3. O gate prova 2x identico com FRIO + QUENTE

`just gm-e2e` (tools/gm/gate.ts): R1 roda o pipeline com cache FRIO
(cache-dir novo por execucao) — a regeneracao do card; R2 re-roda com o
MESMO cache (quente, 0 chamadas ao renderer) e exige bytes identicos.
O par prova o render deterministico (frio) E a fidelidade do cache
(quente) no mesmo gate. Cache frio em R1 e condicao de correcao: o cache
por conteudo (C7) nao inclui os BYTES das fontes (gap conhecido, ver
decisao 6) — so uma producao fria garante que uma mudanca de fonte flui
para os pixels.

### 4. Versao de ferramenta e verificada POR PIN, sem re-render

S0 do gate: ffmpeg corrente tem de casar o pin 6.1.1 E o registrado no
indice do golden; node corrente tem de casar o registrado; e a chave C7
recomputada da saida da R1 (o MESMO `calcularChaveC7` do F5-09) tem de
casar a do golden. Um bump de Remotion/Chrome muda os componentes
`versoes`/`ferramentas` da chave e o S0 acende; um bump de ffmpeg/node
muda tambem os itens do golden (MixDocument/PosDocument/relatorio-final
registram ferramentas), se re-renderizar.

### 5. Mutacoes de token e de fonte fazem parte do gate (∅-crit provado)

M1 muta `background.primary` (#030712 -> #111827 — gray[900], CALIBRADO
contra os pares declarados de tokens.ts: o pior caso e state.error
#EF4444 / highlight.primary #3B82F6 sobre o fundo mutado, 4.71:1 e 4.82:1
(>= 4.5 AA normal; medido — gray[800] #1F2937 cai para 3.99:1 e o
thumbnail do pipeline FALHA, mutacao invalida)) e exige divergencia dos
itens; M2
muta os bytes de `Inter-Regular.woff2` (recebe os de
JetBrainsMono-Regular.woff2 — fonte valida, tipografia diferente) e exige
divergencia. Cada arquivo mutado e restaurado byte a byte e conferido
por sha256 no final. Sem divergencia, o gate fica VERMELHO: "o golden e
cego a tokens/fontes".

### 6. Gap conhecido e declarado: os bytes das fontes nao entram na chave C7

A chave C7 (ADR-0041) hasheia manifesto, assets do grafico, agregado de
tokens, versoes e pin de ferramentas — os BYTES de `assets/fontes/*.woff2`
nao entram em nenhum componente. Consequencia: uma troca de arquivo de
fonte com o mesmo nome de familia NAO invalida o cache do F5-09 e o
render quente serviria frames velhos. **Nao corrigido aqui (S-5/src fora
do escopo do F5-08):** o golden compensa rodando R1/M1/M2 com cache
frio, e o item fica registrado no ledger (AB-849) para o dono do cache.
O que o F5-09 jah cobre e a familia/estilo/arquivo declarados no token
(`fontFamily`) — trocar a familia declarada muda o agregado de tokens e
a chave.

### 7. O golden vale para a maquina que o capturou — declarado

Sem container, o baseline vale somente na maquina da captura (ffmpeg
6.1.1-3ubuntu5 + chrome-headless-shell 149.0.7790.0 pinados pelo Remotion
4.0.507). O indice registra `captura.maquina` e `captura.commit`. A
limitacao esta no README e no `naoCobre` do indice — ausencia de
verificador registrada, nunca conformidade.

## Consequencias

- `just gm-e2e` custa ~4 producoes (R1 fria + R2 quente + M1 + M2) — o
  oraculo final e caro de proposito; o F5-07 ja provou o resto da cadeia
  no proprio e2e (R1/R2/R3 do F5-07 rodam o pipeline 3x).
- Regenerar o golden (`just gm-capturar`) e re-aprovar o oraculo: so com
  divergencia classificada BUG-A-DIVERGIR e ADR nominal.
- Divergencia da forma literal do PROGRAMA: o PROGRAMA.html e o ADR-0043
  citam `just gm:e2e`; o just 1.42.4 deste repositorio nao aceita
  dois-pontos em nome de receita — o gate e `just gm-e2e` (hifen, a
  convencao das demais receitas). Nomeado aqui e no handoff do F5-08.
