# R10 — FFmpeg: hwaccel, alpha, loudness e concatenação

**Escopo desta pesquisa:** o que o FFmpeg realmente oferece (nomes de opção, valores aceitos,
versão) para aceleração por hardware, canal alfa, normalização de loudness, ducking, concatenação,
detecção de silêncio e determinismo de saída. NÃO responde: qual encoder existe *nesta* máquina,
qual a qualidade no *nosso* conteúdo (texto vetorial), nem qual alvo de loudness o dono quer.

---

## Nota de método (leia antes da tabela)

Foram usados dois tipos de artefato do projeto FFmpeg, e eles **não** são contados como a mesma
fonte quando o claim é sobre *diferença entre versões*:

- **repo oficial** — `raw.githubusercontent.com/FFmpeg/FFmpeg`, branch `master`, lido em 2026-08-10
  (`doc/*.texi`, `libavfilter/*.c`, `libavcodec/*.c/h`).
- **binário local** — `ffmpeg version 6.1.1-3ubuntu5`, `libavcodec 60.31.102`, saída de
  `ffmpeg -h encoder=…` / `-h filter=…` e execuções reais. A man page/`-h` é fonte primária
  pelo contrato.

Quando o claim é sobre *comportamento do projeto* (ex.: "existe a opção X"), os dois contam como
**uma** fonte. Quando é sobre *o que mudou entre 6.1.1 e master*, contam como duas.

**Fontes que não abriram** (registrado para ninguém tentar de novo às cegas):
`trac.ffmpeg.org/wiki/HWAccelIntro`, `trac.ffmpeg.org/wiki/Concatenate` e
`code.videolan.org/videolan/x264` responderam com a página de bloqueio do Anubis;
`ffmpeg.org/ffmpeg-filters.html` e `ffmpeg.org/ffmpeg-formats.html` derrubaram a conexão
(ECONNRESET / socket hang up) — as mesmas seções foram lidas no `.texi` do repositório.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R10-01 | Nenhum encoder de hardware exposto pelo FFmpeg (NVENC, VAAPI, QSV, AMF, VideoToolbox) tem uma opção `crf`; CRF é opção dos wrappers de software. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/nvenc_h264.c |
| R10-02 | O FFmpeg expõe NVENC como `h264_nvenc`, `hevc_nvenc` e `av1_nvenc`, com rate control em `-rc constqp\|vbr\|cbr`, `-cq` (0–51), `-qp`, presets `p1`–`p7` e `-multipass disabled\|qres\|fullres`. | (2-0) | PROVÁVEL | https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/ffmpeg-with-nvidia-gpu/index.html |
| R10-03 | No ffmpeg 6.1.1 o `-rc` do NVENC ainda aceita aliases depreciados (`vbr_hq`, `cbr_hq`, `vbr_2pass`, `vbr_minqp`, `ll_2pass_quality`, `ll_2pass_size`, `cbr_ld_hq`); no `master` a lista de constantes é só `constqp`/`vbr`/`cbr`. | (2-0) | PROVÁVEL | `ffmpeg -h encoder=h264_nvenc` (6.1.1) + `libavcodec/nvenc_h264.c` (master) |
| R10-04 | Os encoders VAAPI usam `-rc_mode` com os valores `auto`, `CQP`, `CBR`, `VBR`, `ICQ`, `QVBR`, `AVBR`, mais `-qp` (0–52) e `-quality`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/vaapi_encode.h |
| R10-05 | AMF usa `-rc cqp\|cbr\|vbr_peak\|vbr_latency\|qvbr\|hqvbr\|hqcbr` + `-qvbr_quality_level` (−1..51) + `-qp_i/-qp_p/-qp_b`; VideoToolbox não tem opção de RC nomeada e pede qualidade constante via `-q:v` (`global_quality` / `AV_CODEC_FLAG_QSCALE`). | (1-0) | NÃO VERIFICADO | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/amfenc_h264.c |
| R10-06 | O conjunto de opções próprio dos encoders QSV (`QSV_COMMON_OPTS`) não contém nenhuma opção de qualidade constante; `-global_quality` é opção **genérica** do AVCodecContext (aparece em `ffmpeg -h full`). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/qsvenc.h |
| R10-07 | No único benchmark FFmpeg×hardware que consegui ler com números (Ozer, Streaming Media East 2019), NVENC ficou entre −1,68% e −6,97% de BD-rate VMAF contra x264 `medium` e QuickSync entre +2,36% e +9,41% pior — e **nenhum** dos quatro clipes era conteúdo de texto/vetor/screencast. | (0-0, 1 secundária) | NÃO VERIFICADO | — (só secundária) |
| R10-08 | O Remotion tem a opção `hardwareAcceleration` (`disabled` \| `if-possible` \| `required`), documenta que "The crf option is not compatible with hardware-accelerated encoders", habilita NVENC em Linux/Windows a partir de v4.0.484 e recomenda `--video-bitrate=8M` para H.264 Full HD por causa do arquivo maior. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/hardware-acceleration |
| R10-09 | WebM carrega alfa colocando o plano A codificado no elemento `BlockAdditional`; VP8 e VP9 aceitam `yuva420p`; o Chrome reproduz WebM VP8/VP9 com alfa nativamente desde o Chrome 31. | (3-0) | CONFIRMADO | https://developer.chrome.com/blog/alpha-transparency-in-chrome-video |
| R10-10 | Chrome/Chromium não reproduz HEVC-com-alfa (é extensão da Apple, suportada pelo Safari). | (0-0, 1 secundária) | NÃO VERIFICADO | — (só secundária) |
| R10-11 | No ffmpeg 6.1.1 os caminhos com alfa são: `prores_ks` → `yuva444p10le` com `-profile 4444\|4444xq` e `-alpha_bits` (default 16); `libvpx` e `libvpx-vp9` → `yuva420p`; `qtrle` → `argb` (não aceita yuva); encoder `png` → `rgba`. | (2-0) | PROVÁVEL | `ffmpeg -h encoder=prores_ks` (6.1.1) |
| R10-12 | A codificação de alfa em VP8/VP9 pode depender de frames anteriores, então o alfa pode divergir no início de cada chunk (flicker em render paralelo por chunks). | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/transparent-videos |
| R10-13 | O Remotion consome vídeo com alfa via `<OffthreadVideo>` com a prop `transparent`, que troca a extração de frame de BMP para PNG (mais lento). | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/videos/transparency |
| R10-14 | O filtro `loudnorm` tem `I` (−70..−5, default **−24**), `LRA` (1..50, default **7**) e `TP` (−9..0, default **−2**) — ou seja, os defaults **não** são os da EBU R 128 (−23 LUFS / −1 dBTP). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/af_loudnorm.c |
| R10-15 | O uso em duas passadas do `loudnorm` é: 1ª passada com `print_format=json` produzindo `input_i/input_tp/input_lra/input_thresh`; 2ª passada com `measured_I/measured_TP/measured_LRA/measured_thresh` — sem esses valores o filtro roda em modo dinâmico (`"normalization_type" : "dynamic"`). | (2-0) | PROVÁVEL | `libavfilter/af_loudnorm.c` + execução local (6.1.1) |
| R10-16 | Mesmo recebendo os `measured_*`, o `loudnorm` desliga a normalização linear e cai para dinâmica quando `offset_tp > target_tp` ou `measured_lra > target_lra`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/af_loudnorm.c |
| R10-17 | A EBU R 128 (revisão R 128-2023, v5, novembro/2023) recomenda Target Level de **−23,0 LUFS** com tolerância de ±1,0 LU (±0,2 LU em QC) e True Peak Level que **não deve exceder −1 dBTP**. | (2-0) | PROVÁVEL | https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf |
| R10-18 | Não existe (no que consegui abrir) página oficial do YouTube/Google que publique um alvo em LUFS; o "−14 LUFS" circula só em fontes de terceiros. | (0-0) | NÃO VERIFICADO | — (busca restrita a support.google.com / youtube.com não retornou nada oficial) |
| R10-19 | O filtro `ebur128` mede sem alterar o áudio e expõe `integrated`, `range`, `lra_low`, `lra_high`, `sample_peak`, `true_peak` como metadados de frame; seu `target` default é −23 LUFS. | (2-0) | PROVÁVEL | `ffmpeg -h filter=ebur128` (6.1.1) |
| R10-20 | O filtro `sidechaincompress` existe, tem duas entradas nomeadas (`main`, `sidechain`) e as opções `level_in, mode, threshold, ratio, attack, release, makeup, knee, link, detection, level_sc, mix`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/af_sidechaincompress.c |
| R10-21 | O **concat demuxer** (`-f concat -safe 0`) permite `-c copy`, mas exige que "All files must have the same streams (same codecs, same time base, etc.)"; o **concat filter** opera em frames decodificados e portanto sempre reencoda, exigindo mesma largura/altura/SAR (vídeo) e mesmo sample rate/layout (áudio). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/doc/demuxers.texi |
| R10-22 | Em AAC, a Apple fixa o priming em **2112 samples** e o remainder em menos de 1024 samples, e afirma que MP4/ADTS não têm mecanismo de sinalização satisfatório para esses valores. | (1-0) | NÃO VERIFICADO | https://developer.apple.com/library/archive/technotes/tn2258/_index.html |
| R10-23 | O Remotion tem a flag `--for-seamless-aac-concatenation` (e `Config.setForSeamlessAacConcatenation()`), disponível a partir da v4.0.123. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/config |
| R10-24 | O `silencedetect` tem `n`/`noise` (default 0.001), `d`/`duration` (default 2 s) e `mono`, loga `silence_start:` / `silence_end: … \| silence_duration:` e injeta `lavfi.silence_start`, `lavfi.silence_end`, `lavfi.silence_duration` (com sufixo `.N` por canal quando `mono=1`). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/af_silencedetect.c |
| R10-25 | `-fflags +bitexact` na saída significa "Only write platform-, build- and time-independent data. This ensures that file and data checksums are reproducible and match between platforms", e `-map_metadata -1` desliga a cópia automática de metadados ("A negative file index can be used to create a dummy mapping that just disables automatic copying"). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/doc/formats.texi |

---

## 2. Detalhe por claim

### R10-01 — Nenhum encoder de hardware do FFmpeg tem `crf`

- **Verdade operacional:** trocar `libx264` por `h264_nvenc` mantendo `-crf 18` não é uma
  substituição de encoder, é uma mudança de contrato de qualidade. Você perde o alvo de
  *qualidade* e passa a ter alvo de *bitrate* (ou QP fixo). O mais próximo de CRF é
  `-rc vbr -cq N` no NVENC, `-rc_mode ICQ`/`QVBR` no VAAPI, `-rc qvbr -qvbr_quality_level N`
  no AMF e `-q:v N` no VideoToolbox — nenhum deles é CRF e nenhum deles é comparável entre si.
- **Como reconferir:**
  `ffmpeg -hide_banner -h encoder=h264_nvenc | grep -ci crf` → deve imprimir `0`
  (idem para `h264_vaapi`, `h264_qsv`, `h264_amf`, `h264_videotoolbox`).
- **O que quebra se divergir:** o card de "perfil de encode" e qualquer gate que compare
  arquivos por tamanho; e o card de aceleração por hardware do Remotion, que só faz sentido
  se o pipeline souber trocar CRF por bitrate.
- **Fontes:**
  - `libavcodec/nvenc_h264.c`, `vaapi_encode.h`, `amfenc_h264.c`, `qsvenc.h`,
    `videotoolboxenc.c` no repo master — a string `crf` não aparece em nenhum (primária,
    conta como **uma** fonte: mesmo repositório).
  - https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/ffmpeg-with-nvidia-gpu/index.html
    — documenta preset/tune/bitrate/AQ/lookahead e **não** documenta CRF (primária).
  - https://www.remotion.dev/docs/hardware-acceleration — "The crf option is not compatible
    with hardware-accelerated encoders" (primária, fornecedor do nosso renderer).
  - `ffmpeg -h encoder=h264_nvenc` / `h264_vaapi` em 6.1.1 local: `grep -ci crf` = 0 (primária).

### R10-02 — NVENC: encoders e rate control

- **Verdade operacional:** o vocabulário é `-rc {constqp,vbr,cbr}` + `-cq 0..51` (0 = automático)
  + `-qp` + `-preset p1..p7` + `-multipass {disabled,qres,fullres}` + `-rc-lookahead` +
  `-spatial-aq`/`-temporal-aq` + `-b_ref_mode {disabled,each,middle}`. "Constant quality" via
  `-rc vbr -cq N` **não** é CRF: a NVIDIA a descreve como um subconjunto de VBR.
- **Como reconferir:** `ffmpeg -hide_banner -h encoder=h264_nvenc | sed -n '/-rc /,/-cq/p'`
- **O que quebra se divergir:** o card do perfil de encode acelerado e a fixture de
  "comando de render" (o texto do comando é o artefato).
- **Fontes:**
  - `libavcodec/nvenc_h264.c` (master): `rc` com constantes `constqp`, `vbr`, `cbr`;
    `cq` 0–51 default 0; `preset` p1..p7 + legados `slow`/`medium`/`fast`;
    `multipass` `disabled`/`qres`/`fullres`; `b_ref_mode` `disabled`/`each`/`middle` (primária).
  - docs.nvidia.com, Video Codec SDK 13.0: confirma os três encoders
    (`h264_nvenc`, `hevc_nvenc`, `av1_nvenc`) e as opções `-preset p1..p7`, `-tune hq|ll`,
    `-b:v/-maxrate/-bufsize`, `-rc-lookahead`, `-spatial-aq`/`-aq-strength`, `-temporal-aq`,
    `-b_ref_mode`, `-i_qfactor`/`-b_qfactor` (primária).
- **Metade não fechada:** os valores exatos aceitos por `-tune` no wrapper FFmpeg
  (`hq`, `ll`, `ull`, `lossless`?) **não** foram lidos verbatim em nenhuma fonte — a NVIDIA
  só mostra `hq` e `ll`. Não escreva `-tune ull` num card sem rodar `-h encoder=`.

### R10-03 — Aliases depreciados de `-rc` em 6.1.1

- **Verdade operacional:** um comando escrito com `-rc vbr_hq` roda em 6.1.1 e pode falhar em
  builds mais novos. Isso é uma armadilha de reprodutibilidade entre a máquina do dev e o CI.
- **Como reconferir:** `ffmpeg -hide_banner -h encoder=h264_nvenc | grep -i deprecated`
- **O que quebra se divergir:** o card de "fixar versão do FFmpeg" e o gate que roda o
  comando de render no CI.
- **Fontes:** saída de `-h encoder=h264_nvenc` em 6.1.1 lista `vbr_minqp`,
  `ll_2pass_quality`, `ll_2pass_size`, `vbr_2pass` como `(deprecated)` e ainda oferece
  `cbr_ld_hq`, `cbr_hq`, `vbr_hq` (primária, binário); `nvenc_h264.c` no master lista só
  `constqp`, `vbr`, `cbr` (primária, repo).

### R10-04 — VAAPI: `-rc_mode`

- **Verdade operacional:** VAAPI é o caminho Intel/AMD em Linux sem driver proprietário, e é o
  único dos cinco que expõe explicitamente um modo chamado "constant-quality" (`CQP`) e um
  "intelligent constant-quality" (`ICQ`). Nada disso é CRF; `ICQ`/`QVBR` dependem do driver
  suportar o modo — o FFmpeg escolhe `auto` por padrão.
- **Como reconferir:** `ffmpeg -hide_banner -h encoder=h264_vaapi | sed -n '/-rc_mode/,/blbrc/p'`
- **O que quebra se divergir:** o card de detecção de hwaccel por plataforma.
- **Fontes:** `libavcodec/vaapi_encode.h` — macro `VAAPI_ENCODE_RC_OPTIONS` com
  `VAAPI_ENCODE_RC_MODE(CQP, "Constant-quality")`, `(CBR, "Constant-bitrate")`,
  `(VBR, "Variable-bitrate")`, `(ICQ, "Intelligent constant-quality")`,
  `(QVBR, "Quality-defined variable-bitrate")`, `(AVBR, "Average variable-bitrate")` e `blbrc`
  (primária, repo); `ffmpeg -h encoder=h264_vaapi` em 6.1.1 reproduz a mesma lista com
  `-qp` 0–52 e `-quality` (primária, binário).

### R10-05 — AMF e VideoToolbox

- **Verdade operacional:** AMF tem o vocabulário mais rico de RC (`hqvbr`, `hqcbr`, `qvbr`
  com `qvbr_quality_level` −1..51). VideoToolbox é o oposto: quase não tem opções de RC —
  qualidade constante é pedida pelo caminho genérico `-q:v` (que liga `AV_CODEC_FLAG_QSCALE`
  e vira `kVTCompressionPropertyKey_Quality`), e existe `constant_bit_rate` (macOS 13+).
- **Como reconferir:** numa máquina com o hardware,
  `ffmpeg -h encoder=h264_amf` e `ffmpeg -h encoder=h264_videotoolbox`.
- **O que quebra se divergir:** a matriz de hwaccel por plataforma no card de render.
- **Fontes:** `libavcodec/amfenc_h264.c` e `libavcodec/videotoolboxenc.c` no repo master
  (primária — mas é **uma** fonte só, e o build local não tem AMF nem VideoToolbox para
  corroborar; por isso o rótulo é NÃO VERIFICADO).

### R10-06 — QSV e `-global_quality`

- **Verdade operacional:** `QSV_COMMON_OPTS` só tem `async_depth`, `preset`
  (`veryfast`…`veryslow`), `forced_idr`, `low_power`, `qsv_params`, mais macros
  (`rdo`, `max_frame_size*`, `max_slice_size`, `bitrate_limit`, `mbbrc`, `extbrc`,
  `adaptive_i`, `adaptive_b`, `avbr_accuracy`/`avbr_convergence`, min/max QP). Não há `cq`
  nem `crf`. `-global_quality` existe como opção genérica de encoder no FFmpeg 6.1.1.
- **Metade NÃO VERIFICADA:** que `-global_quality` (sozinho ou com `-look_ahead 1`) selecione
  ICQ/LA_ICQ no QSV — isso é folclore comum, e **não** o li em fonte primária.
- **Como reconferir:** `ffmpeg -hide_banner -h full | grep -n global_quality` e, com hardware
  Intel, `ffmpeg -v verbose -i in -c:v h264_qsv -global_quality 23 out.mp4 2>&1 | grep -i "RateControl"`.
- **O que quebra se divergir:** o card de encode acelerado em máquina Intel.
- **Fontes:** `libavcodec/qsvenc.h` (primária, repo); `ffmpeg -h full` em 6.1.1 lista
  `-global_quality <int> E..VA......` (primária, binário).

### R10-07 — Qualidade NVENC/QSV vs x264 (e por que este número não serve para nós)

- **Verdade operacional:** os números públicos que existem foram medidos em conteúdo de
  câmera e de jogo (Netflix *Dinner Scene*, *Meridian*, futebol Harmonic, GTAV) a 2–5 Mbps
  em 1080p60. BD-rate VMAF medido: NVENC −2,42 / −1,68 / −6,97 contra x264 medium (NVENC
  ligeiramente melhor ou igual), QuickSync +7,72 / +9,41 / −2,31 (majoritariamente pior),
  x264 `veryfast` de +23 a +34 pior que x264 `medium`. **Nosso conteúdo é o caso oposto**:
  texto vetorial, bordas duras, fundo chapado, pouco ruído — o regime em que encoders de
  hardware historicamente sofrem (falta de RDO psicovisual, falta de `--tune stillimage`,
  AQ limitado) e em que x264 tem knobs que o hardware não expõe. Nada disso está medido.
- **Como reconferir (é isto que vira LEDGER):**
  ```
  ffmpeg -y -i manim_sample.mov -c:v libx264 -preset medium -b:v 4M -maxrate 4M -bufsize 8M sw.mp4
  ffmpeg -y -i manim_sample.mov -c:v h264_nvenc -rc vbr -b:v 4M -maxrate 4M -bufsize 8M hw.mp4
  ffmpeg -i hw.mp4 -i manim_sample.mov -lavfi libvmaf=log_path=hw.json -f null -
  ffmpeg -i sw.mp4 -i manim_sample.mov -lavfi libvmaf=log_path=sw.json -f null -
  ```
- **O que quebra se divergir:** o card que escolhe o encoder do render final. Se a diferença
  em texto for grande (>5 VMAF), aceleração por hardware fica proibida no master render e vira
  só preview.
- **Fontes:** Jan Ozer, *Benchmarking FFmpeg's Hardware Codecs*, Streaming Media East 2019
  (secundária) — https://streaminglearningcenter.com/wp-content/uploads/2019/05/SME-2019-FFmpeg-Hardware.pdf
  (li as tabelas de BD-rate diretamente no PDF). Sem primária ⇒ NÃO VERIFICADO.

### R10-08 — Remotion e aceleração por hardware

- **Verdade operacional:** `hardwareAcceleration: "if-possible" | "required" | "disabled"`
  (default `disabled`). macOS → VideoToolbox (ProRes desde 4.0.228, H.264/H.265 desde 4.0.236);
  Linux/Windows → NVENC (H.264/H.265) desde 4.0.484, exigindo driver NVIDIA v525+ e um FFmpeg
  com `h264_nvenc`/`hevc_nvenc`; **não** existe em Lambda/Cloud Run; Linux só x64.
  E o custo declarado: "File size is significantly larger by default when using hardware
  acceleration", com recomendação de `8M` para H.264 Full HD.
- **Como reconferir:** `npx remotion render --help | grep -i hardware` na versão que
  travarmos, e `npx remotion versions`.
- **O que quebra se divergir:** o card de configuração de render e o gate de tamanho de arquivo.
- **Fontes:** https://www.remotion.dev/docs/hardware-acceleration e
  https://www.remotion.dev/docs/encoding (mesmo domínio ⇒ **uma** fonte, primária do fornecedor).

### R10-09 — Alfa em WebM e no Chromium

- **Verdade operacional:** este é o caminho que faz Manim → Remotion funcionar sem passo extra:
  o Chromium que o Remotion pilota decodifica WebM VP8/VP9 com alfa nativamente, então um
  `<OffthreadVideo src="manim.webm" transparent />` compõe sobre o React sem chroma key.
- **Como reconferir:**
  ```
  ffmpeg -y -f lavfi -i "color=c=red@0.5:s=320x240:d=1,format=yuva420p" -c:v libvpx-vp9 -pix_fmt yuva420p a.webm
  ffprobe -v error -show_entries stream=pix_fmt -of csv=p=0 a.webm     # yuva420p
  ```
  e abrir num Chrome sobre fundo colorido.
- **O que quebra se divergir:** o card da ponte Manim→Remotion inteiro; a alternativa
  (ProRes 4444) muda formato de asset, tamanho em disco e o caminho de leitura no Remotion.
- **Fontes:**
  - https://developer.chrome.com/blog/alpha-transparency-in-chrome-video (primária, Chrome;
    página datada de 2013-07-25, recurso desde o Chrome 31 — **atenção à idade da fonte**).
  - https://wiki.webmproject.org/alpha-channel (primária, WebM Project): o canal A é codificado
    em VP8 e colocado no elemento `BlockAdditional`.
  - https://www.remotion.dev/docs/transparent-videos (primária, Remotion):
    "Chrome and Firefox support WebM videos with alpha channels."
  - `ffmpeg -h encoder=libvpx-vp9` em 6.1.1: `yuva420p` está na lista de pixel formats.

### R10-10 — HEVC com alfa no Chrome

- **Verdade operacional:** se alguém propuser HEVC-alfa como formato de intercâmbio, o
  Chromium do Remotion provavelmente não lê. Mas eu **não** achei evidência positiva
  (página oficial que liste os formatos com alfa suportados e não inclua HEVC).
- **Como reconferir:** teste de 10 linhas com um `.mp4` HEVC-alfa (`-tag:v hvc1`) num
  Chromium headless, checando se o alfa some.
- **O que quebra se divergir:** nada hoje — só impede um card ruim de nascer.
- **Fontes:** https://jakearchibald.com/2024/video-with-transparency/ (secundária, 2024-08-05):
  matriz testada dizendo que Safari suporta HEVC-alfa e que VP9-alfa não roda no Safari.

### R10-11 — Matriz de alfa por codec (ffmpeg 6.1.1)

- **Verdade operacional:** saída de `-h encoder=` no binário 6.1.1:
  | codec | pixel formats com alfa | observação |
  |---|---|---|
  | `libvpx` (VP8) | `yuva420p` | alfa 8 bits, 4:2:0 |
  | `libvpx-vp9` | `yuva420p` | os demais formatos 10/12 bits **não** têm alfa |
  | `prores_ks` | `yuva444p10le` | exige `-profile 4444` ou `4444xq`; `-alpha_bits` default 16 |
  | `qtrle` | `argb` | RLE sem perdas; não aceita yuv* |
  | `png` (frames) | `rgba`, `rgba64be`, `ya8` | caminho para `--image-format=png` |
- **Como reconferir:** `ffmpeg -hide_banner -h encoder=prores_ks | grep "Supported pixel formats"`
- **O que quebra se divergir:** o card de export do Manim e o de assets intermediários.
- **Fontes:** binário 6.1.1 (primária); https://www.remotion.dev/docs/transparent-videos
  (primária) confirma o par `prores 4444` + `yuva444p10le` e `vp8/vp9` + `yuva420p`.
- **Não pesquisado:** `apng` e `gif` com alfa — não abri fonte, não escreva card.

### R10-12 — Alfa VP8/VP9 depende de frames anteriores

- **Verdade operacional:** o Remotion documenta que na Lambda (render por chunks) o alfa
  "can look different at the beginning of each chunk" e recomenda ProRes-alfa ou render
  "in one pass locally". Como nós rodamos **local e em uma passada**, o risco cai muito —
  mas a arquitetura de worktrees paralelas pode reintroduzir render por segmento.
- **Como reconferir:** renderizar o mesmo clipe em 1 passada e em 4 segmentos concatenados,
  e comparar o frame de fronteira com `ffmpeg -lavfi alphaextract` + `ssim`.
- **O que quebra se divergir:** o card de paralelização de render por segmento.
- **Fontes:** https://www.remotion.dev/docs/transparent-videos (primária, 1 fonte).

### R10-13 — `<OffthreadVideo transparent>`

- **Verdade operacional:** para o Remotion *consumir* alfa, não basta o Chromium suportar:
  a prop `transparent` troca a extração de frame de BMP para PNG, o que custa tempo de render.
- **Como reconferir:** `npx remotion render` com e sem `transparent` no mesmo composition e
  comparar o tempo total.
- **O que quebra se divergir:** o card do componente que embute saída do Manim, e a estimativa
  de tempo de render.
- **Fontes:** https://www.remotion.dev/docs/videos/transparency e
  https://www.remotion.dev/docs/offthreadvideo (mesmo domínio ⇒ uma fonte, primária).

### R10-14 — Defaults do `loudnorm` não são EBU R 128

- **Verdade operacional:** `loudnorm` se descreve como "EBU R128 loudness normalization", mas
  sai da caixa em I=−24 LUFS, TP=−2 dBTP, LRA=7 — que é o alvo do ATSC A/85 (broadcast US),
  não o da R 128 (−23 / −1). **Escrever `-af loudnorm` sem parâmetros produz um arquivo que
  não cumpre nem R 128 nem o −14 de streaming.** Sempre passe I/TP/LRA explicitamente.
- **Como reconferir:** `ffmpeg -hide_banner -h filter=loudnorm | head -12`
- **O que quebra se divergir:** o card do estágio de loudness e o gate de conformidade
  (que deve medir com `ebur128`, não confiar no default).
- **Fontes:** `libavfilter/af_loudnorm.c` (primária, repo): `{ "I", …, {.dbl = -24.}, -70., -5. }`,
  `{ "LRA", …, {.dbl = 7.}, 1., 50. }`, `{ "TP", …, {.dbl = -2.}, -9., 0. }`;
  `ffmpeg -h filter=loudnorm` em 6.1.1 idem (primária, binário); EBU R 128-2023 pede −23/−1
  (primária, EBU).

### R10-15 — Two-pass do `loudnorm`

- **Verdade operacional:** receita determinística em duas etapas:
  ```
  # passada 1 — medir (não escreve mídia)
  ffmpeg -hide_banner -nostats -i in.wav \
    -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -
  # passada 2 — aplicar com os números medidos
  ffmpeg -y -i in.wav -af \
    loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=…:measured_TP=…:measured_LRA=…:measured_thresh=…:linear=true:print_format=summary \
    -ar 48000 out.wav
  ```
  A 1ª passada devolve JSON com `input_i`, `input_tp`, `input_lra`, `input_thresh`,
  `output_i`, `output_tp`, `output_lra`, `output_thresh`, `normalization_type`, `target_offset`.
  Verificado em execução real (6.1.1): com um seno de 5 s e alvo I=−16, saiu
  `"input_i" : "-21.75"`, `"output_i" : "-16.03"`, `"normalization_type" : "dynamic"`.
- **O que quebra se divergir:** o card do estágio de áudio (o JSON é a interface entre as duas
  passadas) e a fixture que guarda os números medidos por locução.
- **Fontes:** `libavfilter/af_loudnorm.c` (primária, repo — campos do JSON e lógica linear ×
  dinâmica); execução local em 6.1.1 (primária).

### R10-16 — Fallback silencioso de linear para dinâmico

- **Verdade operacional:** esta é a armadilha central do loudnorm. Você passa os `measured_*`
  esperando um ganho **constante** (determinístico, sem alterar a dinâmica), e o filtro decide
  sozinho voltar ao modo dinâmico se `offset_tp > target_tp` ou `measured_lra > target_lra`.
  O resultado ainda "atinge o alvo", mas com compressão dependente do sinal — e um arquivo
  diferente do que você acha que pediu.
- **Como reconferir:** rodar a 2ª passada com `print_format=json` e checar
  `"normalization_type"`: precisa ser `"linear"`. Se vier `"dynamic"`, o gate reprova.
- **O que quebra se divergir:** o gate de determinismo de áudio; se o modo cair para dinâmico,
  o áudio deixa de ser função linear do input e comparações A/B por bytes perdem sentido.
- **Fontes:** `libavfilter/af_loudnorm.c` (primária).

### R10-17 — EBU R 128 (R 128-2023, v5)

- **Verdade operacional:** o documento normativo, lido diretamente:
  item (h) "the Programme Loudness Level shall be normalised to a Target Level of −23.0 LUFS…
  a tolerance of ±1.0 LU is permitted"; item (i) "±0.2 LU is allowed" em QC; item (m)
  "the True Peak Level of a programme shall not exceed −1 dBTP … measured with a meter
  compliant with ITU-R BS.1770 and EBU Tech 3341". Histórico: v1 fev/2010, v5 nov/2023.
- **Como reconferir:** https://tech.ebu.ch/publications/r128 → PDF, páginas 3–4.
- **O que quebra se divergir:** o card de perfil de loudness, se o dono escolher broadcast.
- **Fontes:** PDF normativo da EBU (primária); `ffmpeg -h filter=ebur128` mostra
  `target … (default -23)`, corroborando o número por um caminho independente (primária).

### R10-18 — "−14 LUFS do YouTube"

- **Verdade operacional:** todo mundo repete −14 LUFS; eu não achei página do YouTube ou do
  Google dizendo isso. Busca restrita a `support.google.com`, `youtube.com`, `blog.youtube`
  e `developers.google.com` só devolveu threads de comunidade sobre o YouTube **Music** e
  vídeos de terceiros. Zero resultado não prova ausência — pode existir e eu não achei — mas
  também não autoriza escrever "−14 LUFS (fonte: YouTube)" num card.
- **Como reconferir:** subir um vídeo de teste e ler "Volume / Normalized" no *Stats for nerds*
  (isso mede o comportamento, não a política).
- **O que quebra se divergir:** o valor default de `I=` no estágio de loudness.
- **Fontes:** nenhuma primária. Vira PERGUNTA-DONO + LEDGER-SEED.

### R10-19 — `ebur128` para medir sem alterar

- **Verdade operacional:** para o **gate** (medir sem tocar no áudio) o filtro certo é
  `ebur128`, não `loudnorm`. Ele expõe `integrated`, `range`, `lra_low`, `lra_high`,
  `sample_peak`, `true_peak` como metadados de frame (flag `XR` = export/read) e tem
  `peak=true` para true-peak e `metadata=1` para injetar no filtergraph.
- **Como reconferir:**
  `ffmpeg -nostats -i out.wav -af ebur128=peak=true -f null - 2>&1 | tail -20`
- **O que quebra se divergir:** o gate de loudness (que precisa de um medidor read-only).
- **Fontes:** `ffmpeg -h filter=ebur128` em 6.1.1 (primária); EBU R 128 pede medidor conforme
  ITU-R BS.1770 + Tech 3341, que é o que o `ebur128` implementa (primária, EBU).

### R10-20 — `sidechaincompress` (ducking automático)

- **Verdade operacional:** existe e é o caminho canônico:
  ```
  ffmpeg -i music.wav -i voice.wav -filter_complex \
    "[0:a][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=250:makeup=1:detection=rms[duck]" \
    -map "[duck]" ducked.wav
  ```
  `threshold` e `level_*` são **lineares** (0.000976563..1 e 0.015625..64), não dB — erro
  clássico é escrever `threshold=-20dB`.
- **Contraponto ao "envelope calculado é mais determinístico":** dado o mesmo input e a mesma
  versão do FFmpeg, `sidechaincompress` é uma função pura — é determinístico. O que ele **não**
  é: *inspecionável* e *autorável*. Um envelope calculado a partir do alinhamento de fala
  (por exemplo, ganho em `volume` com expressão por tempo) produz uma curva que o agente pode
  escrever no manifesto, versionar, revisar em diff e reproduzir sem o FFmpeg. Esse é o
  argumento real, e ele é de arquitetura, não de determinismo. Não achei fonte que meça isso.
- **Como reconferir:** rodar o mesmo comando duas vezes e comparar `md5sum` (LEDGER-SEED L07).
- **O que quebra se divergir:** o card de mixagem música×locução.
- **Fontes:** `libavfilter/af_sidechaincompress.c` (primária, repo) e
  `ffmpeg -h filter=sidechaincompress` em 6.1.1 (primária, binário) — listas idênticas.

### R10-21 — Concatenação: demuxer × filter × protocol

- **Verdade operacional:**
  | caminho | reencoda? | exige o quê |
  |---|---|---|
  | `-f concat -safe 0 -i list.txt -c copy` | não | "All files must have the same streams (same codecs, same time base, etc.)" |
  | `-f concat` + reencode | sim | nada além de decodificável |
  | filtro `concat=n=…:v=1:a=1` | **sempre** (opera em frames decodificados) | mesma W/H/SAR; mesmo sample rate e layout de canais; `unsafe=1` desliga a checagem de W/H/SAR |
  Sintaxe do script: primeira linha `ffconcat version 1.0` (opcional), diretivas `file`,
  `duration`, `inpoint`, `outpoint`, `stream`, `file_packet_meta`; opções `safe` (default 1),
  `auto_convert` (default 1, "try to perform automatic conversions on packet data to make the
  streams concatenable"), `segment_time_metadata`.
  Verificado local: dois MP4 de 2,0 s concatenados com `-c copy` deram `4.000000` s.
- **Como reconferir:**
  ```
  printf "file 'a.mp4'\nfile 'b.mp4'\n" > list.txt
  ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4
  ffprobe -v error -show_entries format=duration -of csv=p=0 out.mp4
  ```
- **O que quebra se divergir:** o card de montagem final (juntar cenas) e o de render por
  segmento em worktrees paralelas — se os segmentos não saírem com parâmetros idênticos,
  `-c copy` deixa de ser opção e o custo do estágio muda de ordem de grandeza.
- **Fontes:** `doc/demuxers.texi` (primária, repo); `libavfilter/avf_concat.c` (primária,
  repo — mesma fonte); execução local em 6.1.1 (primária, binário).

### R10-22 — AAC priming / gapless

- **Verdade operacional (Apple TN2258):** "the most common delay used was 2112 audio samples";
  "the priming value is currently fixed at 2112 samples and the remainder will always be less
  than 1024 samples or 1 encoded packet long"; "Apple recommends 3rd party products and devices
  generating AAC bitstreams do so with the assumption that the playback system will **always**
  assume there is an encoding delay of 2112 samples"; e o ponto que dói: "With MPEG-4 and
  ADTS/MPEG-2 bitstreams and file containers, there is still no satisfactory and explicit
  signaling mechanism for either the encoding delay or remainder padding."
  Consequência prática: concatenar dois MP4/AAC com `-c copy` insere silêncio e/ou desloca
  o áudio nas emendas, a menos que a duração de cada trecho seja múltipla do tamanho de
  pacote AAC. O muxer mov/mp4 do FFmpeg tem `-use_editlist` (default `auto`), que é o
  mecanismo por edit list — mas eu **não** verifiquei que ele resolve o priming.
- **Como reconferir:** concatenar dois trechos AAC de duração não múltipla e medir o offset
  com `ffprobe -show_packets` nas fronteiras.
- **O que quebra se divergir:** o card de montagem de áudio; se o problema for real, a
  decisão passa a ser "manter WAV/PCM até o final e codificar AAC uma vez só".
- **Fontes:** https://developer.apple.com/library/archive/technotes/tn2258/_index.html
  (primária, Apple); `doc/muxers.texi` para `-use_editlist` (primária, mas não fecha o claim).

### R10-23 — `--for-seamless-aac-concatenation` (Remotion)

- **Verdade operacional:** a flag existe e é da v4.0.123 (`Config.setForSeamlessAacConcatenation()`
  no arquivo de configuração; a flag de CLI tem precedência). A explicação de *por que* ela
  existe — cortar o áudio no frame AAC mais próximo, pacotes de 1024 samples — apareceu no
  resumo de busca, mas **não** consegui lê-la verbatim na página; trate a mecânica como não
  verificada e a existência da flag como verificada.
- **Como reconferir:** `npx remotion render --help | grep -i seamless` na versão travada.
- **O que quebra se divergir:** o card de render por segmento + montagem.
- **Fontes:** https://www.remotion.dev/docs/config e https://www.remotion.dev/docs/cli/render
  (mesmo domínio ⇒ uma fonte, primária).

### R10-24 — `silencedetect` para cortar respiração

- **Verdade operacional:** os defaults são inúteis para locução (`d=2` s de silêncio mínimo,
  `n=0.001` ≈ −60 dBFS). Para respiração o uso real é algo como
  `silencedetect=n=-35dB:d=0.25`. O filtro **não corta** nada: ele loga
  `silence_start:` / `silence_end: … | silence_duration:` e injeta
  `lavfi.silence_start` / `lavfi.silence_end` / `lavfi.silence_duration` (com sufixo `.N`
  por canal quando `mono=1`). O corte é feito depois, por quem lê o log — o que é bom para
  nós: o programa gera uma **lista de cortes** auditável, não uma edição opaca.
- **Como reconferir:**
  ```
  ffmpeg -hide_banner -nostats -i vo.wav -af silencedetect=n=-35dB:d=0.25 -f null - 2>&1 | grep silence
  ```
  (verificado local em 6.1.1: emitiu `silence_start: 0` e
  `silence_end: 3 | silence_duration: 3`).
- **O que quebra se divergir:** o card de limpeza de locução; o formato do log é a interface
  entre o detector e o cortador.
- **Fontes:** `libavfilter/af_silencedetect.c` (primária, repo — tabela de opções e chaves de
  metadados verbatim); `ffmpeg -h filter=silencedetect` + execução em 6.1.1 (primária, binário).

### R10-25 — Determinismo: `-fflags +bitexact` e `-map_metadata -1`

- **Verdade operacional:** experimento rodado nesta máquina (ffmpeg 6.1.1, libx264,
  `testsrc2` 320×240@30, 2 s):
  | comando | md5 run 1 = md5 run 2? |
  |---|---|
  | `-c:v libx264 -preset ultrafast -crf 23` (threads default) | **sim** |
  | idem + `-fflags +bitexact -flags +bitexact -map_metadata -1` | **sim** (md5 diferente do anterior) |
  | `-preset medium -threads 1` | **sim** |
  Ou seja: **na mesma versão e na mesma máquina, o FFmpeg já é reprodutível bit a bit** —
  a instabilidade que as pessoas atribuem a "threads" não apareceu. O que muda de fato é o
  metadado: sem bitexact o MP4 carrega `TAG:encoder=Lavf60.16.100`; com bitexact essa tag
  some. Essa string é a *versão do libavformat* — ela quebra a igualdade de bytes assim que
  alguém atualiza o FFmpeg, e é exatamente isso que `bitexact` foi feito para remover
  ("Only write platform-, build- and time-independent data").
- **Como reconferir:**
  ```
  for i in 1 2; do ffmpeg -y -f lavfi -i "testsrc2=size=320x240:rate=30:duration=2" \
    -c:v libx264 -preset ultrafast -crf 23 -fflags +bitexact -flags +bitexact \
    -map_metadata -1 out$i.mp4; done; md5sum out1.mp4 out2.mp4
  ffprobe -v error -show_entries format_tags=encoder -of default=nw=1 out1.mp4   # vazio
  ```
- **O que quebra se divergir:** o gate de reprodutibilidade do render (se o gate compara MD5,
  ele precisa do bitexact ou vai quebrar em toda atualização de FFmpeg) e o card de
  containerização/pin de versão.
- **Fontes:** `doc/formats.texi` (primária, repo) para a semântica de `fflags=bitexact`;
  `doc/ffmpeg.texi` (primária, repo) para `-map_metadata` negativo; execução local (primária).
- **Não fechado:** `-bitexact` como opção de topo não aparece em `doc/ffmpeg.texi`; use
  `-fflags +bitexact` (formato) e `-flags +bitexact` (codec) explicitamente.

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "Para acelerar, troque `libx264` por `h264_nvenc` mantendo o `-crf`." | REFUTADO | Nenhum encoder de hardware do FFmpeg tem `crf`; o Remotion diz literalmente que "The crf option is not compatible with hardware-accelerated encoders". O controle vira `-cq`/`-qp`/bitrate. | nvenc_h264.c + docs.nvidia.com + remotion.dev |
| "`-cq` do NVENC é o CRF do NVENC." | REFUTADO (parcial) | `-cq` é um alvo de qualidade **dentro** do modo VBR (a NVIDIA descreve CQ como subconjunto de VBR); não há equivalência numérica com CRF do x264 e nem com o `-cq` de outra geração de GPU. | nvenc_h264.c (`rc` = constqp/vbr/cbr; `cq` 0–51) |
| "`-af loudnorm` já entrega EBU R 128." | REFUTADO | Os defaults são I=−24 LUFS, TP=−2 dBTP, LRA=7 — a R 128-2023 pede −23,0 LUFS ±1,0 LU e True Peak ≤ −1 dBTP. | af_loudnorm.c + EBU R 128-2023 |
| "Uma passada de `loudnorm` basta para bater o alvo." | EM DISPUTA | Sem `measured_*` o filtro roda em modo **dinâmico** (comprova-se pelo campo `"normalization_type" : "dynamic"`), que atinge o alvo alterando a dinâmica. A passada dupla com `linear=true` é o que dá ganho constante — e mesmo ela cai para dinâmico se `offset_tp > target_tp` ou `measured_lra > target_lra`. | af_loudnorm.c + execução local |
| "−14 LUFS é o padrão oficial do YouTube." | NÃO SUSTENTADO | Não achei nenhuma página do YouTube/Google publicando um número em LUFS. É consenso de terceiros, não documentação. Não use "(fonte: YouTube)" em card. | busca restrita a support.google.com / youtube.com sem resultado oficial |
| "O filtro `concat` é a forma sem perda de juntar arquivos." | REFUTADO | O filtro opera em frames decodificados — sempre reencoda. O caminho sem reencode é o **demuxer** `-f concat … -c copy`. | avf_concat.c + doc/demuxers.texi |
| "`-f concat -c copy` sempre funciona." | REFUTADO (parcial) | Só se "All files must have the same streams (same codecs, same time base, etc.)"; além disso, em AAC o priming/remainder não tem sinalização explícita em MP4/ADTS, então a emenda pode ficar com gap ou deslocamento. | doc/demuxers.texi + Apple TN2258 |
| "FFmpeg não é determinístico por causa de multithreading." | REFUTADO nesta versão | ffmpeg 6.1.1 + libx264 produziu MD5 idêntico entre execuções com threads default, com `-threads 1` e com bitexact. O que quebra a igualdade de bytes é a **versão** (tag `encoder=Lavf60.16.100`), não o paralelismo. | execução local (6.1.1) + doc/formats.texi |
| "Ducking por `sidechaincompress` é não determinístico; envelope calculado é determinístico." | REFUTADO (parcial) | Dado o mesmo input e a mesma versão, o compressor é função pura. O ganho real do envelope é ser **autorável, versionável e revisável em diff** — argumento de arquitetura, não de determinismo. | af_sidechaincompress.c (o "mais determinístico" não tem fonte) |
| "Encoder de hardware sempre perde feio para o x264." | EM DISPUTA | O único benchmark com números que li mostra NVENC entre −1,7% e −7,0% de BD-rate VMAF contra x264 `medium` (ou seja, igual ou melhor) em conteúdo de câmera/jogo. Só que nenhum clipe era texto/vetor — o nosso caso está **não medido**. | Ozer 2019 (secundária) |

---

## 4. Armadilhas (falso verde deste domínio)

- **O render acelerado terminou e o arquivo abre** → não é prova de qualidade: o Remotion
  avisa que o arquivo fica "significantly larger by default"; sem bitrate explícito você
  trocou qualidade por velocidade sem medir → *fica vermelho se sumir*: o gate de VMAF
  contra o master em software e o gate de tamanho por segundo de vídeo.
- **`ffprobe` mostra `yuva420p` no arquivo** → não é prova de que o alfa chega ao Chromium:
  o alfa do WebM vive no `BlockAdditional`, e um remux errado ou um `-pix_fmt` no meio do
  caminho o descarta silenciosamente → *fica vermelho se sumir*: um teste que compõe o vídeo
  sobre fundo magenta no Chromium do Remotion e checa que o magenta some.
- **O log do `loudnorm` diz que atingiu o alvo** → não é prova de conformidade: o alvo pode ter
  sido atingido em modo dinâmico, alterando a dinâmica da locução → *fica vermelho se sumir*:
  o gate que exige `"normalization_type" : "linear"` na 2ª passada **e** uma medição
  independente com `ebur128`.
- **A concatenação com `-c copy` rodou sem erro** → não é prova de sincronia: o FFmpeg concatena
  pacotes felizmente e o desalinhamento de priming AAC aparece só no ouvido, nas emendas →
  *fica vermelho se sumir*: um teste que mede a duração somada esperada versus a real e um
  teste de fase/correlação nos 200 ms ao redor de cada emenda.
- **Os dois renders deram o mesmo MD5 na minha máquina** → não é prova de determinismo do
  programa: a igualdade some quando alguém atualiza o FFmpeg (a string `Lavf<versão>` vai no
  arquivo) → *fica vermelho se sumir*: `-fflags +bitexact -flags +bitexact -map_metadata -1`
  no comando de render **e** o pin de versão do FFmpeg no ambiente.
- **`ffmpeg -encoders | grep nvenc` lista `h264_nvenc`** → não é prova de que funciona: o
  encoder está compilado no build (o Ubuntu 6.1.1 lista NVENC mesmo sem GPU); a inicialização
  falha só na hora do encode → *fica vermelho se sumir*: um smoke test que encoda 1 segundo
  real e checa o exit code.
- **`silencedetect` achou silêncios** → não é prova de que o corte é seguro: com `d` alto ele
  perde respirações e com `n` alto ele come o início de palavras surdas → *fica vermelho se
  sumir*: revisão humana amostral das N primeiras propostas de corte, e um teste de que o
  texto transcrito antes e depois do corte é o mesmo.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| L-R10-01 | Qual encoder de hardware existe e **funciona** nesta máquina? | assumir nenhum; render 100% software | `ffmpeg -hide_banner -encoders \| grep -E 'nvenc\|vaapi\|qsv\|amf'` e depois `ffmpeg -f lavfi -i testsrc2=d=1 -c:v h264_nvenc -f null -` (exit 0?) | o card de perfil de render acelerado; a estimativa de tempo total do pipeline |
| L-R10-02 | Qual o VMAF de `h264_nvenc` vs `libx264` no **nosso** conteúdo (texto vetorial Manim) a bitrate igual? | assumir que hardware perde em texto; usar software no master | ver comando em R10-07 | a proibição (ou liberação) de hwaccel no render final |
| L-R10-03 | O pipeline completo (vídeo + AAC + MP4) é byte-determinístico nesta versão? | assumir que sim **com** bitexact; gate por MD5 | rodar o render duas vezes com `-fflags +bitexact -flags +bitexact -map_metadata -1` e `md5sum` | o gate de reprodutibilidade; se falhar, o gate vira comparação perceptual (SSIM/VMAF ≥ limiar) |
| L-R10-04 | O Chromium que o Remotion pilota reproduz o WebM-alfa gerado pelo Manim? | assumir que sim (VP9 + yuva420p) | render de 1 frame com `<OffthreadVideo transparent>` sobre fundo magenta; checar pixel | toda a ponte Manim→Remotion; alternativa é ProRes 4444 (arquivos ~10× maiores) |
| L-R10-05 | O flicker de alfa em fronteira de chunk aparece no nosso render local em uma passada? | assumir que não (render local, uma passada) | renderizar em 1 passada e em 4 segmentos; `alphaextract` + SSIM nos frames de fronteira | o card de paralelização de render por segmento |
| L-R10-06 | O `loudnorm` two-pass converge dentro de ±0,5 LU do alvo na nossa locução TTS? | assumir que sim | 2ª passada com `print_format=json`, comparar `output_i` com o alvo | o gate de loudness e o número de retries do estágio de áudio |
| L-R10-07 | `sidechaincompress` é bit-determinístico entre execuções aqui? | assumir que sim | rodar o mesmo filtergraph 2× e `md5sum` nas saídas WAV | a escolha entre ducking por filtro e ducking por envelope autorado |
| L-R10-08 | A concatenação `-c copy` dos nossos segmentos preserva sincronia A/V (priming AAC)? | assumir que **não**; manter áudio em WAV/PCM até o master | somar durações esperadas × `ffprobe` da saída; inspecionar 200 ms nas emendas | o card de montagem final; muda o formato dos artefatos intermediários |
| L-R10-09 | Custo real (tempo + disco) de ProRes 4444 vs WebM VP9-alfa para 60 s de Manim 1080p | assumir WebM por padrão | encodar os dois e medir `du -h` e `time` | o card de assets intermediários e o orçamento de disco das worktrees paralelas |
| L-R10-10 | Qual versão de FFmpeg o Remotion usa internamente vs a do sistema (6.1.1)? | assumir que são diferentes | `npx remotion versions` e localizar o binário embarcado; `ffmpeg -version` | o pin de versão, o gate de bitexact e a validade de todos os claims 6.1.1 deste arquivo |
| L-R10-11 | `apng` e `gif` preservam alfa utilizável para composição? | não usar; não pesquisado | `ffmpeg -h encoder=apng \| grep "Supported pixel formats"` | só impede um card errado; nenhum artefato depende disso hoje |
| L-R10-12 | `-global_quality` no QSV realmente seleciona ICQ nesta plataforma? | não usar QSV para qualidade constante | `ffmpeg -v verbose … -c:v h264_qsv -global_quality 23 … 2>&1 \| grep -i ratecontrol` | o card de hwaccel em máquina Intel |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| Qual o alvo de loudness do produto: −14 LUFS (prática de streaming, sem fonte oficial), −23 LUFS / −1 dBTP (EBU R 128-2023) ou outro? | É política editorial e de plataforma de destino, não fato técnico; e o −14 não tem documentação oficial que eu tenha achado. | Muda os parâmetros `I`/`TP`/`LRA` do estágio de áudio, o limiar do gate de loudness e se a saída é apta a broadcast. |
| Aceleração por hardware é permitida no render **final**, sabendo que se perde o controle por CRF e o arquivo fica maior? | Depende do apetite por qualidade vs tempo de ciclo e do hardware que o dono tem. | Se "sim": card de perfil acelerado + gate de bitrate. Se "não": hwaccel só em preview, e o pipeline ganha um modo dual. |
| Formato de intercâmbio Manim→Remotion: WebM VP9 `yuva420p` (leve, alfa 4:2:0, risco de fringe em bordas de texto) ou ProRes 4444 `yuva444p10le` (alfa 4:4:4, arquivos muito maiores)? | É trade-off de qualidade de borda × disco × tempo, e o dono é quem paga o disco das worktrees paralelas. | Muda o encoder do Manim, o tamanho dos artefatos, o tempo de render do Remotion (PNG vs BMP) e o card de limpeza de assets. |
| Ducking: `sidechaincompress` automático ou envelope de ganho autorado no manifesto? | Depende de quanto o dono quer poder auditar e ajustar mix por cena, e de quem é o "editor" no fluxo. | Automático: um card, zero autoria, difícil de revisar em diff. Envelope: o manifesto ganha um campo de curva de ganho e o revisor vê a mixagem no PR. |
| Determinismo byte-a-byte é requisito de gate, ou basta equivalência perceptual? | É escolha de rigor de CI: byte-a-byte quebra em toda atualização de FFmpeg mesmo quando nada regrediu. | Byte-a-byte: obriga pin de versão + bitexact em todo comando. Perceptual: obriga VMAF/SSIM no CI e um limiar acordado. |
| Cortar respiração automaticamente por `silencedetect` é aceitável, ou o sistema só **propõe** cortes? | É risco editorial (comer início de palavra) que o dono assume ou não. | Automático: um card de corte. Proposto: dois cards (detector + revisão) e um formato de lista de cortes no manifesto. |
| Podemos fixar a versão do FFmpeg (container/Nix/binário versionado) no projeto? | É decisão de infraestrutura e de manutenção. | Se sim, todos os claims deste arquivo passam a ter validade estável e o gate de MD5 é viável. Se não, todo comando precisa ser tolerante a diferenças de versão e o gate vira perceptual. |
| Áudio intermediário fica em WAV/PCM até o master (uma única codificação AAC no final) ou aceitamos AAC nos segmentos? | Custa disco e muda a arquitetura de artefatos; é chamada de custo × risco. | WAV: elimina o problema de priming AAC de vez. AAC nos segmentos: exige `--for-seamless-aac-concatenation` e um gate de emenda. |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** o **perfil de encode** deve ser uma única estrutura de dados
  (um objeto/`json` com `codec`, `rc`, `quality`, `pixelFormat`, `extraArgs`) consumida por um
  só construtor de linha de comando. Trocar software↔hardware, ou VP9-alfa↔ProRes 4444, deve
  custar **uma constante e um arquivo** — nunca uma varredura de comandos espalhados. O motivo
  é R10-01: hardware e software não compartilham o vocabulário de qualidade, então a troca
  não é "mudar `-c:v`", é mudar um conjunto coerente de flags de uma vez.
  Custo estimado da reversão se isso for centralizado: 1 arquivo, ~1 variável.
  Custo se não for: todo card que chama FFmpeg.
- **Skills que devem carregar este conhecimento:**
  - `ffmpeg-media-ops` (S15) — dona natural: matriz de RC por API, tabela de alfa,
    receita two-pass de loudnorm, os três caminhos de concatenação, bitexact.
  - `remotion-render-pipeline` (S10) — `hardwareAcceleration`, CRF incompatível,
    `--for-seamless-aac-concatenation`, `<OffthreadVideo transparent>`.
  - `manim-bridge` (S11) — o par `yuva420p`/VP9 e o par `yuva444p10le`/ProRes 4444, e o aviso
    de flicker de alfa por chunk.
  - `audio-captions-sync` (S12) — loudnorm two-pass, `ebur128` como medidor read-only,
    `silencedetect` como **gerador de lista de cortes**, ducking.
  - `falsifiable-gates` (S05) — os gates nomeados na seção 4 (VMAF, `normalization_type:
    linear`, MD5 com bitexact, magenta-test de alfa).
- **Cards que este cluster condiciona:**
  1. Construtor único de linha de comando FFmpeg a partir de um perfil de encode declarativo.
  2. Detecção e smoke test de encoders de hardware disponíveis (não confiar em `-encoders`).
  3. Estágio de export do Manim com alfa (escolha de codec + verificação de `pix_fmt`).
  4. Componente Remotion que embute a saída do Manim com alfa e o teste do fundo magenta.
  5. Estágio de loudness em duas passadas, com o JSON da 1ª passada persistido como artefato.
  6. Gate de loudness independente com `ebur128`.
  7. Estágio de mixagem música×locução (ducking) — com a decisão de arquitetura pendente.
  8. Detector de silêncio que emite lista de cortes auditável, não edição direta.
  9. Montagem final: escolha entre `-f concat -c copy` (com verificação de parâmetros
     idênticos) e reencode, mais a política de áudio PCM-até-o-master.
  10. Política de reprodutibilidade: bitexact + `-map_metadata -1` em todo comando, e pin da
      versão do FFmpeg no ambiente.

---

## Apêndice — inventário de fontes abertas

**Primárias**

- FFmpeg, repositório oficial (`raw.githubusercontent.com/FFmpeg/FFmpeg`, master, 2026-08-10):
  `doc/demuxers.texi`, `doc/formats.texi`, `doc/muxers.texi`, `doc/ffmpeg.texi`,
  `libavfilter/af_loudnorm.c`, `libavfilter/af_sidechaincompress.c`,
  `libavfilter/af_silencedetect.c`, `libavfilter/avf_concat.c`, `libavcodec/nvenc_h264.c`,
  `libavcodec/nvenc.h`, `libavcodec/vaapi_encode.h`, `libavcodec/vaapi_encode.c`,
  `libavcodec/amfenc.h`, `libavcodec/amfenc_h264.c`, `libavcodec/qsvenc.h`,
  `libavcodec/videotoolboxenc.c`.
- FFmpeg 6.1.1-3ubuntu5 instalado (saída de `-h encoder=`, `-h filter=`, `-h full`,
  `-encoders`, e execuções reais).
- NVIDIA, *Using FFmpeg with NVIDIA GPU Hardware Acceleration*, Video Codec SDK 13.0 —
  https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/ffmpeg-with-nvidia-gpu/index.html
- Remotion docs — https://www.remotion.dev/docs/hardware-acceleration,
  `/docs/encoding`, `/docs/transparent-videos`, `/docs/videos/transparency`,
  `/docs/cli/render`, `/docs/config` (mesmo domínio ⇒ uma fonte).
- Chrome for Developers, *Alpha transparency in Chrome video* (Chrome 31; página datada
  2013-07-25) — https://developer.chrome.com/blog/alpha-transparency-in-chrome-video
- WebM Project wiki, *Alpha Channel* — https://wiki.webmproject.org/alpha-channel
- Apple, Technical Note TN2258 *AAC Audio – Encoder Delay and Synchronization* —
  https://developer.apple.com/library/archive/technotes/tn2258/_index.html
- EBU R 128-2023 (v5, novembro/2023) —
  https://tech.ebu.ch/publications/r128 e o PDF https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf

**Secundárias**

- Jan Ozer, *Benchmarking FFmpeg's Hardware Codecs*, Streaming Media East 2019 —
  https://streaminglearningcenter.com/wp-content/uploads/2019/05/SME-2019-FFmpeg-Hardware.pdf
- Jake Archibald, *Video with transparency on the web*, 2024-08-05 —
  https://jakearchibald.com/2024/video-with-transparency/
- Espelho não oficial do x264 no GitHub (`github.com/mirror/x264`, `common/base.c`):
  `param->b_deterministic = 1;` e a opção `OPT2("deterministic", "n-deterministic")` —
  indica que o x264 é determinístico por padrão. Fonte oficial (`code.videolan.org`)
  bloqueada; claim fica NÃO VERIFICADO.
