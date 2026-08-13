# ADR-0040 — Pos-processamento de loudness: alvo congelado do gate do F5-03 (LUFS -23.0, teto -1.0 dBTP, conferencia no codificado)

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-03 (W8, entrega — caminho critico)
- **Numero pre-alocado:** docs/contrato-w8.md §5 (F5-03 -> 0040)
- **Porta TCP reservada:** 4503 (docs/contrato-w8.md §5)
- **Faixa de ledger:** AB-770..AB-789 (ledger/inbox/F5-03.json)
- **Depende de:** F0-04 (tokens — a fonte do alvo), F3-05 (mix, W7 — o
  master que o pos consome), F5-02 (perfis de encode, W7 — o encode de
  conferencia usa perfil `deterministico: true` com fila injetada,
  AB-705), ADR-0027 (legendas canonicas — o mesmo documento alimenta o
  sidecar), ADR-0036 (perfis de encode)
- **Guarda executavel:** `just pos` com exit 0, sonda negativa incluida
  (o gate do proprio card: entregavel fora do alvo fica VERMELHO)

## Contexto

O F5-03 aplica o pos-processamento de loudness no master do mix (F3-05) e
confere o resultado. O card define o ∅-crit: **um entregavel fora do alvo
de LUFS tem de bloquear** (PROGRAMA.html). Este ADR congela o alvo, a
tolerancia e a regra de conferencia — os numeros que o gate usa.

O alvo JA existe em `src/design/tokens.ts` (S-5), e o comentario que o
cerca esta stale: `targetLufs e decisao do dono registrada em ADR (P-09 →
ADR-009)` — o ADR-009 e o **estagio grafico do Manim**, nao loudness. Este
ADR-0040 e a decisao que o comentario pedia. Nenhum arquivo de tokens e
editado: o gate LE os valores COMO ESTAO (leitura S-5, nunca edicao — o
comentario stale permanece no lugar; a correcao dele seria edicao de
singleton, proibida).

Duas perguntas adversariais do card governam este ADR:

1. **A normalizacao foi aplicada duas vezes em algum caminho?** Nao — o
   pos normaliza UMA vez o master do mix; o gate confere a saida e falha
   se o alvo divergir. Dupla normalizacao (na fonte e na entrega) e o
   falso-verde que o ∅-crit persegue.
2. **O *true peak* esta dentro do limite depois da codificacao, ou so
   antes?** Depois — a conferencia e no entregavel CODIFICADO, decodificado
   de volta (decisao 2). Conferir so no PCM pre-encode nao ve o overshoot
   do codec.

## Decisoes

### 1. Alvo do gate: LUFS integrado -23.0, lido dos tokens COMO ESTAO

O alvo de loudness integrada e **-23.0 LUFS** (EBU R 128 broadcast),
lido de `src/design/tokens.ts` (`targetLufs`, leitura S-5) COMO ESTA —
o gate nao duplica o numero em lugar nenhum. O teto e **-1.0 dBTP**
(`maxTruePeakDbtp`), teto, nao alvo. Se o token mudar (decisao do dono de
tokens), o gate segue o token — a re-captura de snapshots e consequencia
de F0-04, nao deste card.

### 2. Conferencia no CODIFICADO, decodificado de volta

O *true peak* e conferido no entregavel codificado — o arquivo de entrega
e decodificado de volta e medido. A regra:

- **integrated loudness**: medida com janela EBU R 128 de **400 ms com
  gating** (absolute gate -70 LUFS + relative gate -10 LU), comparada ao
  alvo -23.0 LUFS com **tolerancia de medicao ±0,3 LU**;
- **true peak**: pico medido (dBTP) no entregavel decodificado
  **<= -1.0 dBTP**, com a mesma tolerancia de medicao aplicada a leitura;
- o gate e **deterministico em VEREDITO** (medida de loudness), nunca em
  bytes do entregavel — o encoder de entrega muda entre versoes e a
  comparacao byte a byte e falso oraculo (AB-396/397, ADR-0035).

### 3. Margem de overshoot de codec (AAC): 1,0 dB, declarada com a regra

O encoder AAC pode superar o pico da fonte no decode (overshoot de
codec — o pico apos a codificacao nao e o pico do PCM de entrada). A
normalizacao deixa **margem de 1,0 dB** declarada: o ganho e aplicado de
forma que o pico pre-encode fique em **<= -2,0 dBTP** (-1.0 dBTP do teto
menos a margem), para que o entregavel decodificado fique dentro do teto.
A conferencia do gate mede o entregavel DECODIFICADO contra -1.0 dBTP —
a margem nunca e somada na conferencia; ela e espaco de manobra no
encode.

O overshoot REAL (pico do decodificado menos pico do pre-encode) e
medido e reportado como tripwire a cada execucao do gate. Se um perfil ou
encoder medir overshoot acima da margem declarada, a margem e
**revisada por ADR** — nunca ajustada em silencio. O valor 1,0 dB e um
envelope conservador para AAC (varia por encoder/build; e declaracao de
contrato, nao medicao).

### 4. Instrumento e pin: ffmpeg 6.1.1 com `ebur128` + node

A medicao usa o **ffmpeg 6.1.1 com o filtro `ebur128`** (instrumento
pinado) e o node pinado. O documento do pos registra as versoes — o
padrao `MixDocument.ferramentas` do F3-05 (W7): determinismo entre
versoes de ferramenta e declarado por pin, nunca assumido, e a receita
`just pos` **falha se a versao corrente divergir do pin**. Bump de versao
do ffmpeg invalida o documento e exige re-verificacao.

### 5. Encode de conferencia: perfil deterministico do F5-02, fila injetada

O encode usado para a conferencia (quando o pos re-encoda o master) usa
os perfis de encode do F5-02 (ADR-0036) com `deterministico: true` — um
perfil `deterministico: false` (NVENC, AB-700) nunca participa de
comparacao de pos. A fila de encode e **injetada** (instancia propria do
card): o dono da fila compartilhada do processo e o F5-07 (AB-705, W9).

## Consequencias

- O gate do F5-03 le `targetLufs` e `maxTruePeakDbtp` de
  `src/design/tokens.ts` por leitura (S-5) — o comentario stale apontando
  para o ADR-009 permanece no arquivo; este ADR e a decisao que ele pedia.
- A normalizacao e aplicada UMA vez no master do mix (F3-05); a conferencia
  e no entregavel decodificado.
- O lado de legenda do F5-03 (queimada + sidecar do MESMO documento,
  ADR-0027) e coberto pelo contrato-w8 §2, nao por este ADR.
- `just pos` falha se: entregavel fora do alvo de LUFS (fora da tolerancia
  ±0,3 LU), true peak acima de -1.0 dBTP no decodificado, pin de
  ferramentas divergindo — todos VERMELHO.

## O que este ADR NAO decide

- **A estrategia de gain staging** (quanto reduzir/levantar o master) — e
  do card, dentro do alvo e do teto; este ADR congela a medicao.
- **Perfis de encode de entrega** — F5-02/ADR-0036.
- **Medicao por janela curta (short-term) ou momentanea** — a conferida e
  a integrada; janelas curtas podem existir como diagnostico, nunca como
  criterio.
- **A politica de volume editorial** — alvo e teto sao do gate; decisao de
  produto e do F5-07 (W9).

## Alternativas descartadas

- **Alvo Netflix (-27 LKFS dialog-gated) ou Spotify (-14 LUFS)** — o
  `tokens.ts` ja documenta as normas e o default conservador e -23.0
  (EBU R 128 broadcast, convergente com AES TD1008 na direcao de video);
  o alvo ja esta nos tokens e este ADR congela a LEITURA dele.
- **Conferir true peak so no PCM pre-encode** — falso verde: o overshoot
  do codec acontece depois da codificacao (pergunta adversarial 2 do
  card).
- **Gate em bytes do entregavel** — falso oraculo: o encoder muda entre
  versoes (AB-396/397).
- **Margem de overshoot somada na conferencia** — desvirtuaria o teto: a
  conferencia mede o entregavel REAL contra -1.0 dBTP; a margem e espaco
  de manobra na normalizacao, nao folga no criterio.
