# ADR-0042 — O estrito e deterministico: perfil de encode, oraculo de conteudo e o orquestrador de ponta a ponta

- **Status:** aceito
- **Data:** 2026-08-13
- **Card:** F5-07 (W9, o join 7 — orquestrador de ponta a ponta)
- **Numero pre-alocado:** docs/contrato-w9.md §11 (F5-07 -> 0042)
- **Porta TCP reservada:** 4510 (docs/contrato-w9.md §11)
- **Faixa de ledger:** AB-800..AB-829 (ledger/inbox/F5-07.json)
- **Depende de:** F5-01 (pipeline de render, W7 — leitura), F5-02 (perfis de
  encode, W7 — leitura), F5-03 (pos, W8 — leitura), F5-04/F5-05 (variantes/
  thumbnail, W7 — leitura), F5-06 (procedencia, W7 — leitura), F5-09 (cache
  C7, W8 — leitura), F3-05 (mix, W7 — leitura), F2-07 (cassetes offline, W5 —
  leitura), ADR-0032 (tetos medidos da maquina), ADR-0034 (mix), ADR-0035
  (delimitacao da comparacao byte a byte), ADR-0036 (perfis de encode),
  ADR-0040 (pos — pin ffmpeg 6.1.1), ADR-0041 (chave C7), AB-501, AB-635,
  AB-685, AB-700, AB-701, AB-705, AB-745, AB-776, AB-790..795
- **Guarda executavel:** `just produzir --fixture canonico --estrito` com
  exit 0 e `just e2e` com exit 0 (o gate completo do card)

## Contexto

O F5-07 e o join 7: o ponto em que todos os insumos das ondas 0..8 convergem
e o unico lugar em que o pipeline inteiro pode ser provado de verdade. Um
comando (`just produzir --fixture canonico --estrito`) tem de produzir a
LISTA FECHADA de 11 artefatos do contrato-w9 §2 — incluindo o mp4 final
muxado (AB-776) e o relatorio-final atomico.

Tres decisoes deste ADR:

1. **O estrito encoda apenas com perfis `deterministico: true`** (AB-700):
   o perfil `entrega-software` (libx264, CRF 18 — o ponto de partida da
   decisao 8 do ADR-0036) e o perfil do pipeline. NVENC nunca no estrito.
   A escolha e por EVIDENCIA (tamanho + SSIM do MESMO master nos DOIS
   perfis), nunca por igualar numeros de eixos diferentes (AB-701).
2. **O oraculo de conteudo do encode e do PIPELINE**: o piso de entropia
   media do F5-02 (`YAVG medio >= 32`) foi calibrado para os masters
   sinteticos do gate dele; o render da fixture canonica e escuro POR
   DESENHO (fundo dos tokens) e nao passa nesse piso. O pipeline declara o
   proprio oraculo (YAVG MAXIMO por frame do video codificado > 32).
3. **A camada de grafico da fixture canonica e offline commitada**
   (n-009/n-011 -> HASH_DO_GRAFICO, F1-12/AB-501), nao o cassete do F2-02
   (gravado contra outro manifesto, AB-500). A origem e declarada na
   procedencia do store.

## Decisao 1 — o perfil do estrito: `entrega-software` (libx264, CRF 18)

O catalogo do F5-02 (ADR-0036) e a fonte dos perfis; o estrito filtra
`deterministico: true` e usa o eixo CRF de software (libx264). NVENC
(`deterministico: false`, sem garantia entre execucoes — AB-700) pode
existir em caminho NAO-estrito (calibracao/experimento), nunca no gate do
estrito.

### A evidencia (AB-701): tamanho + SSIM do MESMO master nos dois perfis

O MESMO master (o `master.mov` do pipeline, QTRLE/argb, 727 frames,
1920x1080@30) foi encodado nos dois perfis do catalogo com a cadeia
canonica de flags do F5-02 (`-fflags +bitexact -flags +bitexact
-map_metadata -1` depois das entradas). Medicao em
`docs/medicao/estrito-perfil-w9.json` (`tools/medir-perfil-estrito.py`):

| Perfil | Motor | Tamanho | SSIM por frame (min/media/max) |
|---|---|---|---|
| entrega-software | libx264 CRF 18 | 0.55 MiB (574842 B) | 0.9965 / 0.9974 / 1.0 |
| entrega-nvenc | h264_nvenc CQ 23 (vbr) | 0.72 MiB (757757 B) | 0.9964 / 0.9974 / 1.0 |

O SSIM por frame e calculado em uma AMOSTRA DECLARADA de 12 quadros
espacados uniformemente pelo video (a formula de Wang et al. 2004 no
canal Y): o filtro `ssim` nativo deste build (ffmpeg 6.1.1-3ubuntu5)
imprime apenas o resumo, nunca os valores por frame — declarado, nunca
omitido.

**libvmaf esta AUSENTE deste build** (ffmpeg 6.1.1-3ubuntu5 responde
`No such filter: 'libvmaf'` — AB-701, placar 2-0). A metrica disponivel e
SSIM/PSNR nativos; isso e declarado, nunca omitido.

A escolha do `entrega-software` como perfil do estrito combina a
declaracao `deterministico: true` do perfil (medida em 2x encodes =
bytes identicos + framemd5 identico — a sonda S2 do gate re-prova ao
vivo em trecho do MESMO master) com a evidencia de saida acima: para o
MESMO master, o libx264 CRF 18 entrega qualidade equivalente
(SSIM media 0.9974 nos dois) com TAMANHO MENOR (0.55 vs 0.72 MiB) — e
sem a nao-determinancia do NVENC (AB-700). CRF e o ponto de partida da
decisao 8 do ADR-0036; a calibracao formal e deste card e fica
registrada aqui.

### Determinismo testado ao vivo

O gate do card (S2) encoda 2x um trecho de 30 frames do MESMO master com
o perfil do estrito e exige bytes do arquivo IDENTICOS + framemd5
identico (ADR-0036 decisao 3). A declaracao do perfil e o contrato: se
mentir, o gate fica VERMELHO.

## Decisao 2 — oraculo de conteudo do encode do pipeline (C1)

O `verificarSaida` do F5-02 inclui `YAVG medio >= 32` como piso de
entropia. O render da fixture canonica mede YAVG medio ~30 (maximo por
frame ~65): reprovar por isso seria falso-vermelho — o video NAO e
preto, e o piso do F5-02 foi calibrado para os masters sinteticos do
gate dele.

O pipeline usa o `verificarSaida` para a ESTRUTURA (codec, dimensoes,
frames, framemd5, sem metadado volatil) e declara o ORACULO DE CONTEUDO
DO PIPELINE: o YAVG MAXIMO por frame do video codificado (signalstats)
tem de passar de 32 (`PISO_YAVG_MAXIMO_DE_CONTEUDO`). Um video inteiro
preto fica ~16-22 (preto em range limitado) e NAO passa. Calibrado na
execucao deste card (maximo medido ~65).

## Decisao 3 — ordem de execucao por ENTRADA NOMEADA (mix antes do render)

A tabela do contrato-w9 §3 lista o render (6) antes do mix (8), mas o
render consome o PlanoDeAudio (MixDeEmenda) — que so o mix produz. A
regra do contrato e "encadeia pelo nome do artefato, nunca por posicao";
o orquestrador executa na ordem das ENTRADAS NOMEADAS: autoria ->
reparo -> resolucao -> timing -> composicao -> **mix** -> render ->
encode -> pos -> variante/thumbnail -> procedencia -> mux ->
relatorio-final (AB-801).

## Decisao 4 — camada de grafico da fixture: offline commitada, origem declarada

Os cassetes do F2-02 (grafico) e do F2-04 (midia) foram gravados contra
OUTROS manifestos (AB-500); o cassete de grafico nunca commitou os bytes
renderizados (metadata-only, AB-501). A camada offline da FIXTURA
canonica e a do F1-12: `nos_grafico = {n-009: HASH_DO_GRAFICO, n-011:
HASH_DO_GRAFICO}`, com os bytes commitados em
`fixtures/canonico/assets/grafico-integrado.png` (rehash validado — o
mesmo dado que o golden de 727 frames das W7/W8 usou). A origem da
camada e declarada na procedencia do store (nota F1-12/AB-501) — nunca
inventada (AB-808). A camada de midia da fixture NAO existe (os nos
pintam o fallback do manifesto, como no golden); o 9:16 nao e entregavel
(AB-720..722) e nenhum artefato 9:16 existe na lista fechada.

## Decisao 5 — relatorio-final: atomico, por ultimo, com hash + tamanho

O relatorio-final (artefato 11) declara sucesso com hash + tamanho de
CADA artefato 1..10, e so existe depois de o pipeline inteiro terminar:
escrito POR ULTIMO, atomicamente (tmp + rename, S-8). Um processo morto
no meio deixa o relatorio anterior ou nenhum — nunca um relatorio
parcial lido como sucesso (pergunta adversarial 4 do card). O ∅-crit
(conferirPresenca) relê a LISTA FECHADA da constante
(`ARTEFATOS_ESPERADOS_DO_ESTRITO`, contrato-w9 §2) e re-confere os
arquivos da saida contra os hashes declarados: remover, renomear ou
corromper QUALQUER artefato fica VERMELHO nomeando o artefato
(AB-800). O relatorio registra a toolchain (ffmpeg 6.1.1 + node) — o
mesmo pin do MixDocument.ferramentas/PosDocument.1.ferramentas
(contrato-w9 §10); o mux verifica o pin antes de muxar (AB-807).

## Decisao 6 — retomada = re-execucao integral idempotente (C7)

A re-execucao e INTEGRAL e idempotente, chaveada por conteudo (C7,
ADR-0041): rodar de novo nao "retoma do estagio N" — cada estagio
consulta o cache pela chave; entrada mudou => MISS => re-render
(contrato-w9 §4). O gate prova: R1 chave fria (miss forcado — AB-685),
R2 mesma chave (acerto quente, 0 chamadas ao renderer, artefatos byte a
byte identicos), R3 chave mutada (token) com cache frio (MISS
obrigatorio — C12; "acertar a chave pelo motivo errado e detectavel").
`--cache-dir` e exposto (AB-793; raiz default /tmp — nao sobrevive a
reboot); a inspecao sem render via ArmazemDeCache e para relatar, nunca
para pular estagio (AB-795).

## Decisao 7 — fila unica de encode do processo (AB-705)

O orquestrador cria UMA instancia de `criarFilaDeEncode()` e a injeta em
TODOS os encodes do lote (encode do pipeline, conferencia do pos, sonda
de determinismo) — a instancia unica e do processo deste card, e o pos
ja consome fila INJETADA (AB-773). O gate declara os tetos da maquina
(ADR-0032: 4 NVENC + 4 libx264).

## Decisao 8 — AB-745 no caminho ponta a ponta

O relatorio de procedencia (F5-06) descreve o video FINAL: o manifesto
pos-mix referencia as emendas pelo hash NOVO (C3), e a procedencia da
emenda publicada no store carrega o marcador `emenda: audio-fonte=<sha>`
(MARCADOR_DERIVACAO). O e2e prova: para cada cena, o hash citado no
relatorio e o do PlanoDeAudio (o NOVO, distinto do audio-fonte mesmo na
cadencia default — os bytes da fonte carregam chunk LIST do TTS e a
emenda e re-escrita), e um relatorio que citasse a fonte no lugar fica
VERMELHO (AB-805). O caso de estresse (cadencia cortante, gap 0.05)
re-prova com emendas realmente cortadas.

## Consequencias

- `src/pipeline/**` e `tests/e2e/**` nascem neste card; a lista fechada do
  contrato-w9 §2 vive em `src/pipeline/contrato.ts` e e lida pelo ∅-crit —
  o teste nunca a reescreve e nunca digita um nome de artefato a mao
  (contrato-w9 §12, AB-790).
- O estrito e offline (contrato-w9 §8): autoria pulada (--fixture
  canonico), reparo mecanico = validacao estrutural (o reparo de forma do
  F4-03 e para o documento Autoria.1, que nao existe no caminho fixture —
  AB-802), resolucao por cassetes commitados, zero LLM (AB-635).
- A entrada do bundle e gerada em `.cache/pipeline/entrada` (dentro do
  repo: o bundler resolve imports relativos a partir dela — AB-803); a
  saida dos renders fica em /tmp (AB-984).
- O mux usa -c copy com os flags bitexact depois das entradas e o MESMO
  ffmpeg 6.1.1 do pos, com o pin verificado (contrato-w9 §10, AB-807).
- O relatorio-final e deterministico (relogio fixo na epoch — o mesmo
  padrao do relatorio de procedencia): regeneravel byte a byte dos mesmos
  inputs.
