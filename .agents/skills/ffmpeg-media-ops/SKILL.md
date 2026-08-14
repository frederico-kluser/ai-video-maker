---
name: ffmpeg-media-ops
description: 'Provides the FFmpeg knowledge this program needs outside Remotion — hardware-encoder rate control (no encoder exposes CRF), the alpha container/codec/pix_fmt/player matrix, EBU R 128 two-pass loudness, stream-copy concatenation limits, silence detection, byte-determinism flags and ffprobe as source of truth. Use whenever a task shells out to ffmpeg or ffprobe, transcodes, concatenates, mixes, normalizes loudness, measures duration/fps/sample rate, or writes a reproducibility gate over a media file — even if the user doesn''t mention "ffmpeg". Triggers: "ffmpeg", "ffprobe", "transcode", "encode", "nvenc", "vaapi", "qsv", "encoder de hardware", "crf", "alpha channel", "video com alfa", "prores", "loudnorm", "LUFS", "EBU R128", "ebur128", "true peak", "sidechaincompress", "concat demuxer", "stream copy", "silencedetect", "trim silence", "bitexact", "framemd5", "bytes deterministicos no ffmpeg", "md5 of video", "stream duration", "sample rate", "pix_fmt", "remux"'
metadata:
  type: knowledge
  tier: dominio
  verification_signal: test $(ffmpeg -hide_banner -h encoder=h264_nvenc | grep -ci crf) -eq 0 && test $(ffmpeg -hide_banner -h filter=loudnorm | grep -c 'default -24') -eq 2
---

> **Como resolver as citações desta skill.** As fontes que ela cita foram consolidadas em
> `PROGRAMA.html` (arquivo único, na raiz do repositório) e os documentos originais ficaram
> **congelados no histórico do git**, no commit `8737ad6`. Caminho e número de linha continuam
> exatos — o commit os pina por conteúdo:
>
> - `docs/pesquisa/<arq>.md:<linha>` → `git show 8737ad6:docs/pesquisa/<arq>.md`
> - `docs/00-panorama-verificado.md §<n>` → `git show 8737ad6:docs/00-panorama-verificado.md`
> - `PROGRAMA.md §<seção>` → a aba correspondente de `PROGRAMA.html`
>
> Um id de claim (`R07-06`, `L02-C11`) ou de card (`F2-03`) continua sendo a âncora estável.
> Prefira-o ao caminho de arquivo: ele não desliza.
# FFmpeg — operações de mídia fora do Remotion

Escopo de versão, que vale para o arquivo inteiro: todo claim marcado `6.1.1` foi medido em
`ffmpeg version 6.1.1-3ubuntu5` (`libavcodec 60.31.102`) e precisa ser remedido em outra versão.
Convenção de proveniência: o panorama é citado por **id de claim** (`R10-01`, `AB-008`) ou por
seção (`§9.2`), nunca por `arquivo:linha` — pino de linha não sobrevive a uma edição do alvo.

## Quando carregar

- A tarefa vai montar uma linha de comando `ffmpeg`/`ffprobe`, direta ou por script.
- A tarefa escolhe encoder, rate control, pixel format, container ou codec de áudio.
- A tarefa junta, corta, mixa, normaliza ou mede arquivos de mídia.
- A tarefa escreve um gate que compara dois arquivos de mídia (hash, duração, loudness).
- **Não** carregue para configurar o render do Remotion (`--hardware-acceleration`, `--crf`,
  `--codec`, `combineChunks`): isso é `remotion-render-pipeline`. Nem para o formato de saída
  do Manim nem para o gate `pix_fmt == yuva420p` do handoff: isso é `manim-bridge`.

## Conhecimento injetado

### Encoder de hardware não tem CRF — e a troca não é de `-c:v`

Nenhum encoder de hardware exposto pelo FFmpeg (NVENC, VAAPI, QSV, AMF, VideoToolbox) tem
opção `crf`; CRF é opção dos wrappers de software (`libx264`, `libx265`, `libvpx`) —
**Placar (3-0)** — fonte: `libavcodec/nvenc_h264.c`, `vaapi_encode.h`, `amfenc_h264.c`,
`qsvenc.h`, `videotoolboxenc.c` @ master ·
https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/ffmpeg-with-nvidia-gpu/index.html
· https://www.remotion.dev/docs/hardware-acceleration · `docs/pesquisa/R10-ffmpeg.md:36`.

O mecanismo está na matriz abaixo: CRF é alvo do rate control que roda **dentro** do encoder de
software; no caminho acelerado quem decide a taxa é a implementação da API (NVENC, VAAPI, QSV,
AMF, VideoToolbox) e o wrapper só repassa o vocabulário **daquela** API (`-rc`, `-rc_mode`,
`-q:v`). Não existe para onde traduzir `-crf N`.

E o dano é silencioso: opção privada de encoder que o encoder escolhido não tem **não aborta o
comando**. Medido aqui com um encoder-substituto sem `crf` (`-c:v mpeg4 -crf 18`): exit code
**0**, uma linha de aviso no meio do log (*"Codec AVOption crf … has not been used for any
stream"*) e o encode roda no rate control default. **Placar (1-0)** — execução local (6.1.1),
escopo em **Não verificado** (NV-3: não foi reproduzido com `h264_nvenc` real).

Consequência dura: trocar `libx264` por `h264_nvenc` mantendo `-crf 18` **não é substituição de
encoder, é mudança de contrato de qualidade** — perde-se alvo de qualidade, ganha-se alvo de
bitrate, sem nada ficar vermelho. Daí a decisão de projeto — **sem placar próprio: placar mede
fato, não arquitetura** — de o perfil de encode ser objeto inteiro (`codec`, `rc`, `quality`,
`pixelFormat`, `extraArgs`) num construtor único de linha de comando, nunca flag espalhada pelos
cards — fonte: `R10-01`, **coluna "consequência"**; o (3-0) é do fato acima, não desta decisão.

**Matriz por API** — a coluna "mais próximo de CRF" não é equivalência: os números não são
comparáveis entre APIs nem entre gerações de GPU.

| API | onde existe | vocabulário de rate control | mais próximo de CRF | Placar | fonte |
|---|---|---|---|---|---|
| NVENC (`h264_nvenc`, `hevc_nvenc`, `av1_nvenc`) | Linux/Windows + driver NVIDIA | `-rc constqp\|vbr\|cbr`, `-qp`, `-preset p1..p7`, `-multipass disabled\|qres\|fullres` | `-rc vbr -cq 0..51` (0 = automático) | (2-0) | `libavcodec/nvenc_h264.c` @ master + docs.nvidia.com (SDK 13.0) |
| VAAPI (`h264_vaapi`) | Linux, Intel/AMD sem driver proprietário | `-rc_mode auto\|CQP\|CBR\|VBR\|ICQ\|QVBR\|AVBR`, `-qp 0..52`, `-quality` | `-rc_mode ICQ` ou `QVBR` (depende do driver suportar; default é `auto`) | (2-0) | `libavcodec/vaapi_encode.h` @ master + `-h encoder=h264_vaapi` (6.1.1) |
| QSV (`h264_qsv`) | Intel | `QSV_COMMON_OPTS` = `async_depth`, `preset veryfast..veryslow`, `low_power`, min/max QP, `extbrc`… — **nenhuma opção própria de qualidade constante** | só o genérico `-global_quality` (opção do AVCodecContext, não do wrapper QSV) | (2-0) | `libavcodec/qsvenc.h` @ master + `ffmpeg -h full` (6.1.1) |
| AMF (`h264_amf`) | Windows/AMD | `-rc cqp\|cbr\|vbr_peak\|vbr_latency\|qvbr\|hqvbr\|hqcbr`, `-qvbr_quality_level -1..51` | `-rc qvbr -qvbr_quality_level N` | (1-0) → ver **Não verificado** | `libavcodec/amfenc_h264.c` @ master |
| VideoToolbox | macOS | sem opção de RC nomeada | `-q:v N` (liga `AV_CODEC_FLAG_QSCALE` → `kVTCompressionPropertyKey_Quality`) | (1-0) → ver **Não verificado** | `libavcodec/videotoolboxenc.c` @ master |

Armadilha de versão: **em 6.1.1 o `-rc` do NVENC ainda aceita aliases depreciados**
(`vbr_hq`, `cbr_hq`, `vbr_2pass`, `vbr_minqp`, `ll_2pass_quality`, `ll_2pass_size`,
`cbr_ld_hq`); no `master` a lista de constantes é só `constqp`/`vbr`/`cbr` — um comando
escrito com `-rc vbr_hq` roda na máquina do dev e quebra num build mais novo do CI —
**Placar (2-0)** — fonte: `ffmpeg -h encoder=h264_nvenc` (6.1.1) + `libavcodec/nvenc_h264.c`
@ master · `docs/pesquisa/R10-ffmpeg.md:38`.

### Alfa: container × codec × pix_fmt × quem reproduz

O par certo depende de **quem vai ler o arquivo**, e o Chromium do render não é o mesmo
consumidor que o `<video>` do preview.

| container | codec | pix_fmt com alfa | quem reproduz | Placar | fonte |
|---|---|---|---|---|---|
| WebM | `libvpx` (VP8), `libvpx-vp9` | `yuva420p` (só 8 bits; os formatos 10/12 bits do VP9 **não** têm alfa) | Chrome/Chromium nativamente (o plano A vai no elemento `BlockAdditional`); Firefox **por afirmação do fornecedor** (doc do Remotion, não do Mozilla); Safari **não** — este último só com fonte secundária, não conte como verificado | (3-0) | https://developer.chrome.com/blog/alpha-transparency-in-chrome-video · https://wiki.webmproject.org/alpha-channel · https://www.remotion.dev/docs/transparent-videos |
| MOV | `qtrle` | `argb` (não aceita `yuv*`) | Chromium **não decodifica** (a lista oficial de codecs de vídeo é AV1/VP8/VP9 + H.264/HEVC só no Chrome) | (2-0) | não-decodifica: https://www.chromium.org/audio-video/ + MDN Video codecs (`R07-11`); `argb`: `-h encoder=qtrle` (6.1.1) |
| MOV | `prores_ks` | `yuva444p10le`, exige `-profile 4444` ou `4444xq`; `-alpha_bits` default 16 | não no Chromium; sim no `<OffthreadVideo>` (extrai frame fora do browser com FFmpeg) | (2-0) | `-h encoder=prores_ks` (6.1.1) · https://www.remotion.dev/docs/offthreadvideo |
| sequência PNG | `png` | `rgba`, `rgba64be`, `ya8` | qualquer coisa; é o caminho de fallback e o oráculo de determinismo | (2-0) | `-h encoder=png` (6.1.1) · https://www.remotion.dev/docs/transparent-videos |

Condição de escopo que não pode ser cortada: **o limite do decoder do Chrome vale para preview
e `<video>`, não para o render server-side** — `<OffthreadVideo>` extrai frames "outside the
browser using FFmpeg", e a prop `transparent` troca a extração de BMP para PNG (habilita alfa
e **desacelera** o render) — **Placar (2-0)** — fonte: `R07-12 · R10-13`. O placar é o do
panorama: as duas páginas citadas na pesquisa (`/docs/offthreadvideo` e `/docs/transparent-videos`)
são o **mesmo domínio** e contam como **uma** — cite o id do claim, não o par de URLs, ou você
fabrica um 2-0 inexistente. A doc do `<OffthreadVideo>` lista H.264, H.265, VP8, VP9, AV1 e
ProRes e **não menciona QTRLE** — **Placar (2-0)** — fonte:
`docs/pesquisa/R07-manim-headless-alpha.md:23`; e o `.mov` que o Manim entrega por default com
`-t` é justamente `qtrle`+`argb` — **Placar (2-0)** — fonte: `R07-07`. Escopo obrigatório: "não
mencionado na doc" **não é** "não funciona" — se o `<OffthreadVideo>` lê QTRLE continua pergunta
aberta (`AB-008` é a de NVENC; esta é **`AB-041`**, panorama §7.3). Assuma que não e transcodifique.

### Loudness: R 128, two-pass, e o alvo que não existe

Os defaults do `loudnorm` **não** são EBU R 128: `I=-24` LUFS, `LRA=7`, `TP=-2` dBTP — isso é
ATSC A/85 (broadcast US). A R 128 (revisão R 128-2023, v5) pede **−23,0 LUFS ±1,0 LU**
(±0,2 LU em QC) e True Peak que não exceda **−1 dBTP** — **Placar (2-0)** — fonte:
`R10-14 · R10-15 · R10-16` (a atribuição ATSC é de lá) · `libavfilter/af_loudnorm.c` @ master
(`{"I", …, {.dbl = -24.}}`) · https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf.
Escrever `-af loudnorm` sem parâmetros produz arquivo que não cumpre nem R 128 nem o alvo de
streaming.

Segunda armadilha do mesmo filtro, e ela não está na documentação do alvo: **`loudnorm` devolve
192 kHz se você não fixar `-ar`**. Medido aqui: entrada WAV 48 kHz → saída 192 kHz, sem aviso
(o filtro pede essa taxa para o próprio processamento e ninguém reamostra de volta). O arquivo
fica 4× maior, e se ele for para um encoder AAC depois há uma reamostragem a mais no caminho —
**Placar (1-0)**, execução local (6.1.1), ver **Não verificado** (NV-4). Por isso o `-ar` do
comando abaixo não é decoração.

**Não existe alvo único de loudness.** Cinco publicadores, cinco números, todos corretos no
próprio escopo: EBU R128 −23,0 LUFS; AES TD1008 −18 (fala) / −16 (música) / −14 (álbum);
Netflix OTT −27 LKFS dialog-gated; Spotify −14 LUFS; Google Assistant −16 LUFS estéreo —
**Placar (5-0)** — fonte: `R14-12` · https://support.spotify.com/artists/article/loudness-normalization
· https://developers.google.com/assistant/tools/audio-loudness. O alvo é decisão do dono em ADR,
não constante de card — e "−14 LUFS do YouTube" **não tem página oficial do YouTube/Google que
o publique** — **Placar (0-0)** — fonte: `docs/pesquisa/R10-ffmpeg.md:53`.
Teto de true peak −1 dBTP antes de codec com perdas é recomendação convergente de EBU R128,
AES TD1008 e Spotify (Netflix é mais restritivo: −2 dBTP) — **Placar (3-0)** — fonte: `R14-13`.

**Two-pass é a única forma reproduzível.** 1ª passada mede com `print_format=json`
(`input_i`, `input_tp`, `input_lra`, `input_thresh`); 2ª passada aplica com
`measured_I/measured_TP/measured_LRA/measured_thresh` + `linear=true`. Sem os `measured_*` o
filtro roda em **modo dinâmico** (`"normalization_type" : "dynamic"`): atinge o alvo
**alterando a dinâmica** — **Placar (2-0)** — fonte: `libavfilter/af_loudnorm.c` @ master +
execução local (6.1.1) · `docs/pesquisa/R10-ffmpeg.md:50`.

```
ffmpeg -hide_banner -nostats -i in.wav -af loudnorm=I=-23:TP=-1:LRA=7:print_format=json -f null -
ffmpeg -y -i in.wav -af loudnorm=I=-23:TP=-1:LRA=7:measured_I=…:measured_TP=…:measured_LRA=…:measured_thresh=…:linear=true:print_format=json -ar 48000 out.wav
```

E a armadilha central: **mesmo recebendo os `measured_*`, o filtro desliga a normalização
linear e cai para dinâmica** quando `offset_tp > target_tp` ou `measured_lra > target_lra`. O
log continua dizendo que atingiu o alvo — **Placar (2-0)** — fonte:
`libavfilter/af_loudnorm.c` @ master. O gate tem de exigir `"normalization_type" : "linear"`
na 2ª passada.

Para **medir sem alterar** o áudio o filtro é `ebur128` (não `loudnorm`): expõe `integrated`,
`range`, `lra_low`, `lra_high`, `sample_peak`, `true_peak` como metadados de frame, tem
`peak=true` e `metadata=1`, e seu `target` default é −23 — **Placar (2-0)** — fonte:
`ffmpeg -h filter=ebur128` (6.1.1) + EBU R 128 (medidor ITU-R BS.1770 / Tech 3341).

Ducking: `sidechaincompress` tem duas entradas nomeadas (`main`, `sidechain`) e
`threshold`/`level_in`/`level_sc` são **lineares** (0.000976563..1 e 0.015625..64), **não dB** —
`threshold=-20dB` é erro clássico — **Placar (2-0)** — fonte:
`libavfilter/af_sidechaincompress.c` @ master + `-h filter=sidechaincompress` (6.1.1).
O argumento a favor de um envelope de ganho autorado é **auditabilidade em diff**, não
determinismo: "envelope é mais determinístico" foi refutado **sem medição** — fonte: `R10-20`
(panorama §3.3) · `docs/pesquisa/R10-ffmpeg.md:500`. Que o filtro seja bit-determinístico entre
execuções **não** está medido: ver **Não verificado** (NV-2).

### Concatenação: três caminhos, e o que `-c copy` exige

| caminho | reencoda? | exige | Placar | fonte |
|---|---|---|---|---|
| `-f concat -safe 0 -i list.txt -c copy` | não | *"All files must have the same streams (same codecs, same time base, etc.)"* | (2-0) | `doc/demuxers.texi` @ master |
| `-f concat` + reencode | sim | nada além de decodificável | (2-0) | idem |
| filtro `concat=n=…:v=1:a=1` | **sempre** (opera em frames decodificados) | mesma W/H/SAR; mesmo sample rate e layout de canais; `unsafe=1` desliga só a checagem de W/H/SAR | (2-0) | `libavfilter/avf_concat.c` @ master |

Dois defaults do demuxer que mudam o resultado sem aparecer no comando: `safe` = 1 (o demuxer
recusa caminhos que julga inseguros na lista — é por isso que `-safe 0` aparece em toda receita)
e `auto_convert` = 1, descrito como *"try to perform automatic conversions on packet data to make
the streams concatenable"* — ou seja, mesmo com `-c copy` os bytes do pacote **podem** ser
convertidos — **Placar (2-0)** — fonte: `doc/demuxers.texi` @ master ·
`docs/pesquisa/R10-ffmpeg.md:388`.

Quando `-c copy` **não** é possível: parâmetros divergentes entre os segmentos (codec, time
base, resolução, sample rate) e a emenda de **AAC**. Pacote AAC tem 1024 amostras, não é
auto-contido, e o priming (**512 amostras** na cadeia Remotion/FFmpeg) é compensado por offset
negativo no MP4 — daí o "pop" ao concatenar — **Placar (2-0)** — fonte: `R03-22 · R03-23` ·
https://www.remotion.dev/blog/faster-lambda. A Apple diz que o priming é fixo em 2112 amostras
e que *"there is still no satisfactory and explicit signaling mechanism"* em MP4/ADTS —
**Placar (1-0)** — fonte: https://developer.apple.com/library/archive/technotes/tn2258/_index.html.
Os dois números (512 e 2112) divergem entre as fontes; a decisão segura não depende de qual é o
certo: **manter áudio em WAV/PCM até o master e codificar AAC uma vez só**.

### Silence detection: o filtro não corta

`silencedetect` tem `n`/`noise` (default 0.001 ≈ −60 dBFS), `d`/`duration` (default **2 s**) e
`mono`; loga `silence_start:` / `silence_end: … | silence_duration:` e injeta
`lavfi.silence_start`, `lavfi.silence_end`, `lavfi.silence_duration` (com sufixo `.N` por canal
quando `mono=1`). Ele **não corta nada** — **Placar (2-0)** — fonte:
`libavfilter/af_silencedetect.c` @ master + execução local (6.1.1).

Os defaults são inúteis para respiração em locução (2 s de silêncio mínimo). Algo como
`silencedetect=n=-35dB:d=0.25` é **ponto de partida a calibrar na locução do programa, sem
placar** — não copie como constante de card. Que o filtro só logue é a **propriedade desejada**
aqui: o estágio emite uma lista de cortes auditável e versionável, não uma edição opaca.

### Determinismo: o que muda os bytes, e qual oráculo usar

`-fflags +bitexact` significa *"Only write platform-, build- and time-independent data. This
ensures that file and data checksums are reproducible and match between platforms"*, e
`-map_metadata -1` desliga a cópia automática de metadados (*"A negative file index can be used
to create a dummy mapping that just disables automatic copying"*) — **Placar (2-0)** — fonte:
`doc/formats.texi` e `doc/ffmpeg.texi` @ master.

Medido nesta máquina, **e o escopo é vídeo**: **6.1.1 + libx264 é reprodutível bit a bit entre
execuções**, com threads default, com `-threads 1` e com bitexact. O que quebra a igualdade de
bytes é a **versão** (sem bitexact o MP4 carrega `TAG:encoder=Lavf60.16.100`, a versão do
libavformat), não o paralelismo — **Placar (2-0)** — fonte: `R10-25 · R11-11` · execução local
(6.1.1). **O pipeline completo (vídeo + AAC + MP4) não foi medido** (L-R10-03): não estenda a
conclusão para o master com áudio codificado sem rodar o teste. Que o **x264** seja
determinístico por default (`--non-deterministic` é opt-in) tem só a man page atrás —
**Placar (1-0)**, `R11-12` — fonte: https://manpages.debian.org/testing/x264/x264.1.en.html.

Os três flags canônicos — `-fflags +bitexact -flags +bitexact -map_metadata -1`, depois das
entradas — moram no **construtor único** de linha de comando e não no perfil de encode (perfil
novo nasceria sem eles).

**Eles são opções de saída, não prefixo — e a posição é a armadilha.** Medido aqui: com os três
antes do `-i` (onde um prefixo naturalmente iria) o MP4 sai **com** `TAG:encoder=Lavf60.16.100`
e exit code 0; com os três depois das entradas a tag some e duas execuções dão o mesmo `md5sum`
do arquivo — **Placar (1-0)**, execução local (6.1.1), ver **Não verificado** (NV-5). Aplicados
à entrada eles configuram o demuxer e não fazem nada pela reprodutibilidade da saída, em
silêncio. `-bitexact` como opção de topo não aparece em `doc/ffmpeg.texi` — use as duas formas
explícitas, de formato e de codec — **Placar (1-0)** — fonte: `docs/pesquisa/R10-ffmpeg.md:483`.

**Hash de MP4 é mau oráculo; hash de frame decodificado é bom.** Um produtor que grave a própria
versão dentro do container (o Manim CE grava
`metadata["comment"] = "Rendered with Manim Community v<versão>"` e não configura `bitexact` em
lugar nenhum) faz `sha256` de vídeo piscar vermelho por motivo irrelevante — e a reação humana a
um gate assim é desligá-lo, que é o pior desfecho. O oráculo obrigatório é **comparar frames** —
**Placar (2-0)** — fonte: `R07-21` · `manim/scene/scene_file_writer.py` @ main.

O instrumento tem nome: **`ffmpeg -i out.mp4 -f framemd5 -`** — texto de N linhas, um hash por
frame **decodificado**, imune a container e a metadata, e que responde "mudou?" e "**em qual
frame**?" sem guardar um pixel. Evidência medida: dois MP4 do mesmo conteúdo, um com bitexact e
outro sem, deram `md5sum` de arquivo **diferente** e `framemd5` **idêntico** — **Placar (1-0)** —
fonte: panorama **§9.2, "Camada 1 — Prova de determinismo por `framemd5`"** · execução local
(6.1.1). Condição de escopo que não pode ser cortada: a disponibilidade do muxer é do **build**
(ver **Não verificado**), então o gate confere `ffmpeg -h muxer=framemd5` no ambiente-alvo.

Ao comparar frames com `psnr`/`ssim` do FFmpeg: os filtros **exigem mesma resolução e mesmo
pixel format** e assumem o **mesmo número de frames**, comparados um a um (a validação aborta
com `AVERROR(EINVAL)`). Um frame a mais no começo faz o número despencar por um motivo que
**não é regressão visual** — assertar contagem de frames igual **antes** de medir —
**Placar (2-0)** — fonte: `libavfilter/vf_psnr.c` @ master · `man ffmpeg-filters` (6.1.1).

### Probing: `ffprobe` é a fonte de verdade, com duas ressalvas

- `pix_fmt` com `a` (`yuva420p`, `argb`, `rgba`) é a checagem barata que pega a perda de alfa
  na fronteira certa, **antes** de o vídeo entrar na composição: sem `-t` o Manim cai para
  `yuv420p` e o vídeo entra com fundo preto, sem erro — **Placar (2-0)** — fonte:
  `docs/pesquisa/R07-manim-headless-alpha.md:19` (R07-08) e `:310`.
- `stream=nb_frames` e `stream=duration` respondem `N/A` em MKV; onde a contagem importa só
  `-count_frames` dá número, ao custo de decodificar o arquivo inteiro. E a duração de
  container × duração de stream diverge — as duas ressalvas fecham no mesmo probe
  (`-select_streams v:0 -count_frames -show_entries stream=pix_fmt,nb_read_frames,duration`):
  ver **Não verificado** (NV-1).

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não troque `libx264` por um encoder de hardware mantendo `-crf`.** Nenhum encoder de
  hardware tem `crf` (3-0), e a flag sobrando **não derruba o comando**: exit 0, um aviso
  ("has not been used for any stream") no log e o encode no rate control default (1-0, NV-3).
  A troca é de contrato de qualidade inteiro: ou o comando é gerado a partir de um perfil
  completo, ou o card está errado.
- **Não escreva os flags de bitexact como prefixo do comando.** `-fflags +bitexact
  -flags +bitexact -map_metadata -1` antes do `-i` configuram a **entrada**: o arquivo sai com
  `TAG:encoder=Lavf…` mesmo assim, sem erro nenhum (1-0, NV-5). O hábito de pôr flag global no
  começo da linha é exatamente o que quebra este gate.
- **Não deixe o `loudnorm` escolher a taxa de amostragem.** Sem `-ar` explícito a saída sai em
  **192 kHz** (medido: entrada 48 kHz → saída 192 kHz, sem aviso) (1-0, NV-4) — arquivo 4×
  maior e uma reamostragem extra antes do AAC.
- **Não escreva `-af loudnorm` sem parâmetros** achando que isso é EBU R 128: os defaults são
  ATSC A/85 (−24/−2/7) (2-0). E não escreva o alvo como constante literal em card — não existe
  alvo único (5-0); ele é ADR do dono.
- **Não aplique `loudnorm` em uma passada quando o resultado precisa ser reproduzível.** Sem
  `measured_*` o filtro roda em modo dinâmico (2-0) — o alvo é atingido alterando a dinâmica,
  e comparação A/B por bytes perde sentido. E mesmo o two-pass cai para dinâmico sozinho em
  duas condições nomeadas: verifique `"normalization_type"`, não o log de sucesso.
- **Não use o filtro `concat` esperando "sem perda"** — ele opera em frames decodificados e
  sempre reencoda (2-0). O caminho sem reencode é o **demuxer**.
- **Não concatene com `-c copy` arquivos de parâmetros divergentes.** O demuxer exige "same
  codecs, same time base, etc." (2-0), e ele não falha alto: concatena pacotes felizmente e o
  problema aparece no ouvido, nas emendas. Em AAC, some com o problema mantendo PCM até o
  master (2-0) em vez de tentar costurar.
- **Não confie na duração declarada no container** para derivar número de frames, ponto de
  corte ou sincronia. `format=duration` é o envelope do arquivo, não a duração do stream de
  vídeo (NV-1, 1-0 medido aqui). Onde a contagem importa, conte: `-count_frames`.
- **Não use `md5sum` do MP4 como gate de regressão** (2-0): a igualdade morre em toda
  atualização de FFmpeg pela string de versão no container, e o sinal fica indistinguível de
  regressão real. Compare frames; e se comparar arquivo, exija `-fflags +bitexact
  -flags +bitexact -map_metadata -1` **mais** pin de versão.
- **Não escreva `threshold=-20dB` no `sidechaincompress`** — os limiares são lineares (2-0).
- **Não trate `ffmpeg -encoders | grep nvenc` como prova de que o encoder funciona**: o
  encoder está compilado no build (o 6.1.1 do Ubuntu lista NVENC mesmo sem GPU) e a
  inicialização só falha na hora do encode — isto é observação local **(1-0)** e continua aberto
  como `AB-008` (panorama §7.1), não um claim fechado. Por isso o smoke test de 1 s real é o
  único sinal: nenhuma listagem prova inicialização.
- **Não use aliases de `-rc` do NVENC vistos numa máquina** (`vbr_hq`, `cbr_hq`, `vbr_2pass`):
  são depreciados em 6.1.1 e ausentes no master (2-0). O comando vira específico da máquina.
- **Não peça ao `silencedetect` que corte** — ele só loga (2-0); e com os defaults (`d=2`) ele
  não vê respiração nenhuma.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| O render acelerado terminou e o arquivo abre | Sem bitrate explícito você trocou qualidade por velocidade sem medir; o arquivo fica "significantly larger by default" | Gate de qualidade contra o master em software (SSIM/PSNR) **e** gate de bytes por segundo de vídeo |
| `ffprobe` mostra `yuva420p` no arquivo | Não prova que o alfa chega ao consumidor: o alfa do WebM vive no `BlockAdditional` e um remux ou um `-pix_fmt` no meio do caminho o descarta em silêncio | Teste que compõe o vídeo sobre fundo magenta no Chromium do render e checa que o magenta some |
| O log do `loudnorm` diz que atingiu o alvo | O alvo pode ter sido atingido em modo **dinâmico**, alterando a dinâmica da locução | Gate que exige `"normalization_type" : "linear"` na 2ª passada **e** medição independente com `ebur128` |
| A concatenação com `-c copy` rodou sem erro | O demuxer concatena pacotes sem reclamar; o desalinhamento de priming AAC aparece só nas emendas | Soma das durações esperadas × duração real medida, **mais** correlação nos 200 ms ao redor de cada emenda |
| Os dois renders deram o mesmo MD5 nesta máquina | A igualdade some quando alguém atualiza o FFmpeg (a string `Lavf<versão>` vai no arquivo), e o gate fica indistinguível de regressão real | Comparação de `-f framemd5` (hash de frames decodificados, imune a container e metadata: dois arquivos de bytes diferentes deram o mesmo framemd5) **e** asserção de que `ffmpeg -version` casa com o pin — o md5 do arquivo não é o gate |
| O comando de encode acelerado tem `-crf 18` e roda com exit 0 | O encoder de hardware não tem essa opção; ela vira um aviso no log e o encode usa o rate control default — o alvo de qualidade que você acha que passou nunca existiu | Asserção de que a linha de comando gerada contém `-rc`/`-b:v` (ou `-rc_mode`) e **não** contém `crf`, mais falha do build ao ver "has not been used for any stream" no log do encode |
| O comando tem `-fflags +bitexact` e o hash mudou mesmo assim | Se os flags estiverem antes do `-i`, eles configuram a entrada: a tag `encoder=Lavf…` continua no arquivo e ninguém avisa | `ffprobe -show_entries format_tags=encoder` no artefato tem de voltar **vazio**; se voltar a tag, o comando está montado errado, não o baseline |
| `ffmpeg -encoders` lista `h264_nvenc` | O encoder está compilado no build mesmo sem GPU; a inicialização falha só no encode | Smoke test que encoda 1 segundo real e checa o exit code |
| `silencedetect` achou silêncios | Com `d` alto ele perde respirações; com `n` alto ele come o início de palavras surdas | Revisão humana amostral das N primeiras propostas de corte + teste de que o texto transcrito antes e depois do corte é o mesmo |
| `format=duration` bate com o esperado | É o envelope do container, e num MP4 ele é o máximo entre os streams — o stream de vídeo pode ser mais curto | Asserção sobre `nb_read_frames` (`-count_frames`) e sobre `stream=duration` por stream |

## O que esta skill NÃO cobre

- Flags de render do Remotion (`--hardware-acceleration` e seus valores, `--crf` por codec,
  `--gl`, `--concurrency`, `combineChunks()`, `--for-seamless-aac-concatenation`) →
  `remotion-render-pipeline`.
- Escolha do formato de saída do Manim, `-t`/`--format`, `qtrle` vs WebM, o gate
  `pix_fmt == yuva420p` do handoff e o flicker de alfa por chunk → `manim-bridge`.
- Alinhamento de legenda, ASR, sincronia A/V no Remotion, o ducking autorado (`volume={(f)=>…}`)
  e as duas pipelines de áudio (`<Html5Audio>` × `@remotion/media`) → `audio-captions-sync`.
- Escrita dos gates em si (sonda negativa, tripwire, o que fica vermelho por ausência) →
  `falsifiable-gates`; captura e pinagem de golden master → `video-characterization`.
- Aquisição e licença de mídia de terceiros → `asset-acquisition`.

## Não verificado

- **NV-1 — duração de container × duração de stream.** Medido nesta máquina (6.1.1): num MP4
  com vídeo de 2 s e áudio de 3 s, `format=duration` respondeu `3.000000` enquanto
  `stream=duration` do vídeo respondeu `2.000000`; num MKV, `stream=duration` e `stream=nb_frames`
  responderam `N/A` e só `-count_frames` deu número. **Placar (1-0)** — fonte: execução
  local. Fecha a lacuna: `ffmpeg -y -f lavfi -i "testsrc2=d=2" -f lavfi -i "sine=d=3" -c:v
  libx264 -c:a aac dur.mp4 && ffprobe -v error -show_entries format=duration:stream=duration
  -of default=nw=1 dur.mp4` (e o mesmo com saída `.mkv` + `-count_frames`) em cada container que
  o programa usar, e uma fonte documental (`doc/ffprobe.texi` / `AVFormatContext.duration`) para
  a segunda perna do placar.
- **NV-2 — `sidechaincompress` é bit-determinístico entre execuções?** O panorama refuta o
  folclore inverso ("envelope autorado é mais determinístico") por raciocínio, não por medição:
  ninguém rodou o filtro duas vezes e comparou. **Placar (0-0)** — fonte:
  `docs/pesquisa/R10-ffmpeg.md:548` (L-R10-07). Fecha a lacuna: rodar o mesmo filtergraph 2× e
  `md5sum` nas saídas WAV. Até lá, o argumento a favor do envelope é só arquitetural.
- **NV-3 — `-crf` num encoder que não tem a opção é aviso, não erro.** Medido com um
  encoder-substituto (`-c:v mpeg4 -crf 18` → exit 0 + *"Codec AVOption crf … has not been used
  for any stream"*), **não** com `h264_nvenc` de verdade — esta máquina não tem NVENC utilizável
  (AB-008). **Placar (1-0)**. Fecha a lacuna: numa máquina com GPU, `ffmpeg -f lavfi -i
  testsrc2=d=1 -c:v h264_nvenc -crf 18 out.mp4; echo $?` e conferir se o aviso é o mesmo.
- **NV-4 — `loudnorm` devolve 192 kHz sem `-ar`.** Medido nesta máquina (entrada WAV 48 kHz →
  saída 192 kHz). **Placar (1-0)** — fonte: execução local. Fecha a lacuna: a segunda perna é
  documental — localizar em `libavfilter/af_loudnorm.c` a taxa que o filtro pede em
  `query_formats` e confirmar se vale para os dois modos (linear e dinâmico) ou só para um.
- **NV-5 — posição dos flags de bitexact.** Medido nesta máquina: antes do `-i` a tag
  `encoder=Lavf60.16.100` permanece no MP4; depois das entradas ela some e duas execuções dão
  `md5sum` idêntico. **Placar (1-0)** — fonte: execução local (6.1.1). Fecha a lacuna: a perna
  documental é `doc/ffmpeg.texi` sobre opções por-arquivo de entrada × saída; e repetir com
  `.mkv` e `.webm`, cujos muxers gravam outros campos.
- **AMF e VideoToolbox** (linhas da matriz marcadas 1-0): lidos só no repo master, sem binário
  local com esses encoders para corroborar. Fecha a lacuna: numa máquina com o hardware,
  `ffmpeg -h encoder=h264_amf` e `ffmpeg -h encoder=h264_videotoolbox`.
- **`-global_quality` selecionar ICQ/LA_ICQ no QSV** é folclore comum e não foi lido em fonte
  primária. **Placar (0-0)**. Fecha a lacuna: `ffmpeg -v verbose -i in -c:v h264_qsv
  -global_quality 23 out.mp4 2>&1 | grep -i RateControl` em hardware Intel.
- **Muxers de hash `framemd5`, `streamhash`, `hash` e o muxer `chromaprint` existem neste
  build**, além do filtro `axcorrelate`. **Placar (1-0)** — fonte: `ffmpeg -h muxer=framemd5`
  (6.1.1). Fecha a lacuna: rodar os três muxers no ambiente-alvo (container/CI), já que a
  disponibilidade depende do build, e registrar o resultado antes de escrever gate em cima.
- **Priming AAC = 2112 amostras (Apple TN2258)** contra **512 amostras** na cadeia
  Remotion/FFmpeg. **Placar (1-0)** para o número da Apple. Fecha a lacuna: concatenar dois
  trechos AAC de duração não múltipla de 1024 e medir o offset com `ffprobe -show_packets` nas
  fronteiras.
- **`-bitexact` como opção de topo** não aparece em `doc/ffmpeg.texi`. **Placar (1-0)**. Fecha
  a lacuna: `ffmpeg -h full | grep -n ' -bitexact'`.
- **Qualidade de encoder de hardware no nosso conteúdo** (texto vetorial, bordas duras, fundo
  chapado): o único benchmark público legível usou câmera e jogo. **Placar (0-0, 1 secundária)**.
  Fecha a lacuna: encodar o mesmo master em `libx264 -preset medium` e em `h264_nvenc -rc vbr`
  ao mesmo bitrate e comparar — notando que `libvmaf` **não** existe no FFmpeg deste sistema
  (`Unknown filter 'libvmaf'`, 2-0, `R11-13`), então a métrica disponível hoje é SSIM/PSNR
  nativos, e adotar VMAF é card de infraestrutura.
- **HEVC-com-alfa no Chromium**: só fonte secundária. **Placar (0-0, 1 secundária)**. Fecha a
  lacuna: um `.mp4` HEVC-alfa (`-tag:v hvc1`) num Chromium headless, checando se o alfa some.

## Evolution

On task completion, if this skill was involved, run the memory pipeline
(see `meta-skill-evolution`):
1. **Importance** — non-obvious, non-inferable, non-volatile, and changes how future tasks
   in this area are done?
2. **Verification** — confirmed by a green test/lint/eval or explicit user confirmation?
   Without an external signal, discard.
3. **Conflict** — contradicts an existing passage? Replace it; never append a rival rule.
4. **Gating** — run the skill linter and this skill's eval set. Discard on regression.
5. **Update** — edit this file directly. No learnings file, no buffer.

If nothing important and verified was learned, write nothing — that is the healthy default.
