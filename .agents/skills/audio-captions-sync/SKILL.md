---
name: audio-captions-sync
description: 'Provides the verified chain from voiceover to word timings to on-screen caption to music ducking — where the word times come from, what whisper.cpp really returns, the real Caption type and its pagination contract, volume as a function of the relative frame, the documented causes of A/V drift, and the normative caption legibility numbers that become testable invariants. Use whenever a task touches narration timing, captions, subtitles, word highlighting, background music level, loudness, or "the audio is out of sync", even if the user doesn''t mention whisper, DTW or ducking. Triggers: "legenda", "caption", "subtitle", "sincronia", "out of sync", "dessincronia", "drift", "timestamp por palavra", "word timestamps", "whisper", "whisper.cpp", "DTW", "t_dtw", "transcricao", "ASR", "alinhamento forcado", "forced alignment", "SRT", "ducking", "musica de fundo", "volume", "fade", "loudness", "LUFS", "true peak", "CPS", "caracteres por segundo".'
metadata:
  type: knowledge
  tier: dominio
  verification_signal: curl -sL https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/to-captions.ts | grep -qF 't_dtw * 10' && ffmpeg -hide_banner -h filter=ebur128 >/dev/null && (python3 .agents/scripts/skill_lint.py; test $? -le 1)
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
# Áudio, legenda e sincronia

## Quando carregar

- A tarefa produz ou consome tempo por palavra: transcrição, alinhamento, `Caption[]`, highlight
  palavra-a-palavra, `timing.json`.
- A tarefa mexe em volume, fade, ducking de música sob locução, loudness ou clipping.
- A tarefa escreve ou calibra um gate de sincronia A/V, ou alguém disse "está dessincronizado".
- A tarefa define duração de um nó de texto na timeline (o piso e o teto são normativos, não gosto).
- **Não carregue** para escolher motor de TTS, voz, preço, licença de peso ou consentimento de voz —
  isso é `tts-voiceover`. Não carregue para escrever a linha de comando do FFmpeg — isso é
  `ffmpeg-media-ops`.

## Conhecimento injetado

### A decisão arquitetural: de onde vem o tempo das palavras

**ASR não é o mecanismo de sincronia; é um dos caminhos, e é o caro.** Se a locução é TTS, o texto é
conhecido a priori e usar ASR para redescobri-lo é desperdício e é fonte de erro. Vários motores
devolvem tempo junto com o áudio — **mas cada um numa unidade diferente, e a unidade é o trabalho**:
ElevenLabs `/with-timestamps`, por **caractere** — **(3-0)** — fonte:
`https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps`; Cartesia Sonic
com `add_timestamps`, palavra **e** fonema, em segundos — **(3-0)** — fonte:
`https://docs.cartesia.ai/api-reference/tts/websocket`; Azure `WordBoundary`, `audio_offset` em
ticks de 100 ns ⇒ ms = ticks/10.000 — **(2-0)** — fonte:
`https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis`;
ElevenLabs `/v1/forced-alignment` (áudio + texto ⇒ `words[]` com `start`/`end`/`loss`, pt-BR entre
os 29 idiomas) — **(2-0)** — fonte:
`https://elevenlabs.io/docs/api-reference/forced-alignment/create`; Amazon Polly, speech marks
`word` — porém numa **segunda chamada** (`OutputFormat=json`, sem áudio, cobrada), **ausentes no
engine `generative`**, e com `start`/`end` em **offset de BYTES** do texto — **(2-0)** — fonte: `docs/00-panorama-verificado.md` R13-03·R13-04.

**Três conversões que nenhuma API faz por você, e cada uma desloca o highlight se errada:**
1. **Caractere → palavra** (ElevenLabs): acumular caracteres **até o espaço**; o `startMs` da palavra
   é o do primeiro caractere não-espaço e o `endMs` é o do último. É código nosso, com teste próprio.
2. **`alignment` × `normalized_alignment`** (ElevenLabs): o primeiro indexa o texto cru, o segundo o
   texto expandido pelo normalizador ("3" → "três"). Casar o script com o array errado desliza o
   highlight **ao longo da frase, de forma crescente** — **(3-0)** — fonte: `docs/00-panorama-verificado.md` R13-01.
3. **Byte → caractere** (Polly): em pt-BR acentuado **byte ≠ caractere em UTF-8**, então fatiar o
   script pelo offset do mark corta no meio de "ção". Fatie sobre o buffer UTF-8, nunca sobre a
   `string` do JS — e o sintoma é uma palavra truncada, não uma exceção.

**Condição de escopo que inverte a conclusão:** tudo acima é **nuvem**. Em **TTS local pt-BR não
existe caminho pronto de timestamp por palavra**: no Kokoro `join_timestamps` só é chamada quando
`lang_code in 'ab'` (inglês) e nos demais o `Result` sai sem `tokens`; o Piper tem alinhamento
experimental **por fonema**, em samples, só via API — **(2-0)** — fonte:
`https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py` e
`https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/ALIGNMENTS.md`. Logo: no cenário
100% local o estágio de alinhamento **não pode ser deletado**; no cenário nuvem, pode.

**O caminho que este projeto toma** (declarado no panorama, não inventado aqui): a origem do tempo
fica atrás de **um arquivo** — `src/captions/source.ts` exportando
`getWordTimings(audioPath, script): Promise<Caption[]>`. Custo de reverter para outro provedor: **1 adaptador + 1
fixture de golden timing por provedor**. O `Caption[]` do Remotion é o **formato de intercâmbio** e
**não pode ficar atrás** dessa fronteira — se o timing nativo do provedor vazar para dentro do
componente, trocar de provedor vira refatoração do highlight — `docs/00-panorama-verificado.md §5.1` (linha «Fonte de onde vem o tempo das palavras»).

**O que não é barato de reverter, e por isso decide-se antes:** a escolha da pipeline de áudio
(`@remotion/media <Audio>` × `<Html5Audio>`). As duas quantizam o início de faixa de formas
diferentes (ms via `adelay` numa, amostras via cabeçalho WAV na outra), e o gate de sincronia é
**calibrado** numa delas. Trocar depois exige recalibrar o gate — isso é uma **medição**, não uma
variável. Fonte: `docs/00-panorama-verificado.md §5.2` (linha «Escolha da pipeline de áudio») · R03-25 — **(2-0)**.

**Corolário de cache:** o artefato cacheado é o par `(áudio, timing)`, nunca a receita — decisão de
arquitetura em `docs/00-panorama-verificado.md §5.1` (linha «Provider de TTS»). A evidência que a
motiva é fraca e está em "Não verificado"; a decisão vale mesmo assim porque o custo de errar é
assimétrico: se o áudio for regerado e o timing não, **o vídeo dessincroniza sem erro nenhum**.

### whisper.cpp: a API real (só se a voz for humana ou o TTS não devolver tempo)

- `convertToCaptions` está deprecado em favor de `toCaptions` — usá-lo é dívida imediata — **(3-0)**
  — fonte: `https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/index.ts`.
- `tokenLevelTimestamps` é **obrigatório** na assinatura (sem `?`) e `toCaptions()` só aceita
  `TranscriptionJson<true>` — não é otimização, é o único caminho tipado — **(3-0)** — fonte:
  `https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts`.
- Ligá-lo dispara `--dtw <preset>` **e força `--max-len 1`** — efeito colateral não documentado na
  página. É por isso que cada "segmento" do JSON vira um token e `toCaptions()` produz um `Caption`
  por palavra **com o espaço à esquerda preservado**, que é exatamente o contrato que a paginação
  exige — **(2-0)** — fonte: mesmo `transcribe.ts`.
- `t_dtw` existe, é marcado `[EXPERIMENTAL]` no header do whisper.cpp, está em **centissegundos**, e
  `toCaptions()` faz `t_dtw * 10` para virar ms, devolvendo **`null`** quando `t_dtw === -1` —
  **(3-0)** — fonte: `https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h`
  e `.../packages/install-whisper-cpp/src/to-captions.ts`.
- O comentário upstream é literal — *"Roughly corresponds to the moment in audio in which the token
  was output"*: instante aproximado de um **token de BPE**, não de um fonema. Resolução reportada
  10 ms; piso físico do mecanismo **20 ms** (janelas de 25 ms, passo de 20 ms) — **(2-0)** —
  `whisper.h` + `https://www.isca-archive.org/interspeech_2024/zusag24_interspeech.pdf`.
- `--dtw` aceita uma lista **fechada de 12** presets; fora dela o binário **aborta** com
  `unknown DTW preset` — a transcrição **falha, não degrada**. Modelo quantizado ou de nome custom
  não tem preset. E o modelo chama-se `large-v3-turbo` (hífen) enquanto o preset é `large.v3.turbo`
  (ponto) — por isso existe `modelToDtw()` — **(3-0)** — fonte:
  `https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp`.
- Pin de versão: o preset turbo só existe a partir de **1.7.2** — **(3-0)** — fonte: releases do
  `ggml-org/whisper.cpp` + `https://www.remotion.dev/docs/install-whisper-cpp/transcribe`. Que
  `main` vire `whisper-cli` em **1.7.4** e `cmake` vire requisito em **1.7.3** é **(2-0)**, publicador
  único — `docs/pesquisa/R04-legendas-asr-alinhamento.md §R04-15`. Pinar `1.5.5` (o valor do exemplo da
  doc oficial) **remove capacidade**, não muda um número.
- Modelo com sufixo `.en` é somente inglês: em locução pt-BR ele transcreve errado ou traduz —
  e `medium.en`, que a skill oficial do Remotion recomenda, tem o mesmo defeito. Multilíngue é
  obrigatório. Isto é **linha de refutação do panorama (sem placar próprio; dois artefatos de um
  publicador só)** — fonte: `docs/00-panorama-verificado.md §3.2` (linha «`base.en` ou `medium`»).

### Requisito de áudio da transcrição — e por que os 16 kHz não são os 48 kHz

Até whisper.cpp **v1.7.4** o leitor de WAV recusa ≠16 kHz, ≠16-bit e ≠(1 ou 2) canais, com erro
fatal. **Estéreo é aceito e mixado — mono não é requisito**, o `-ac 1` é higiene; a doc do Remotion
recomenda `ffmpeg -i in -ar 16000 out.wav` sem `-ac 1`. Do lado JS há guarda próprio: `transcribe()`
rejeita `inputPath` cuja **extensão** não seja `.wav`, olhando só a extensão — logo **o passo de
conversão não sai do pipeline Remotion** mesmo com binário que decodifique mp3 — **(2-0)** — fonte:
`https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.7.4/examples/common.cpp` +
`https://www.remotion.dev/docs/webcodecs/resample-audio-16khz`.

**Os 16 kHz e os 48 kHz são de arquivos diferentes** e confundi-los é contradição já registrada:
16 kHz é requisito de **entrada** do whisper.cpp; 48 kHz é o sample rate de **saída** do Remotion,
que já reamostra tudo sozinho. Não existe "taxa uniforme estrita" — **(2-0)** — fonte: `docs/00-panorama-verificado.md §3.1`, contradição `I-03`.

### Determinismo da transcrição — e a topologia que ele decide

O `whisper-cli` **não expõe semente** (`grep -in seed cli.cpp` devolve zero) e o **fallback de
temperatura está ligado por default** (`temperature = 0.0f`, `temperature_inc = 0.2f`): um segmento
que reprova nos thresholds é **re-decodificado com temperatura maior**. Isso é variação sem
aleatoriedade nenhuma. Nenhuma fonte primária afirma reprodutibilidade bit-a-bit entre execuções,
threads ou backends — **(2-0)** — fonte:
`https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp`.

Consequência: se a transcrição não for determinística, `captions.json` tem de ser **artefato
versionado e revisado**, não passo recomputado a cada render — senão o vídeo muda sozinho entre
execuções e o diff visual perde sentido. **Isso muda a topologia do pipeline, não um parâmetro.**

**Precisão medida** (collar de 0,2 s, fala sintética anotada à mão): DTW sobre cross-attention
(large-v2) dá F1 **74,7** / mIoU 51,4; WhisperX (wav2vec2) dá **76,7** / 61,5; com ruído, 68,3 vs
59,0 — **(2-0)** — fonte: `https://www.isca-archive.org/interspeech_2024/zusag24_interspeech.pdf`.
Leitura operacional: **com tolerância de ±200 ms, um quarto das palavras erra, em fala TTS limpa.**
Um critério de aceite de ±50 ms é impossível por ASR; realista é ±150–250 ms.

### O tipo `Caption` real e a paginação

`Caption = {text: string; startMs: number; endMs: number; timestampMs: number|null; confidence: number|null}`.
O mapeamento de `toCaptions()` é **assimétrico**: `startMs`/`endMs` vêm de `offsets` (tempo
**não**-DTW); só `timestampMs` carrega o DTW, e ele é um **ponto**, não um intervalo — não existe
`endMs` derivado de DTW. Quem quiser duração por palavra com precisão DTW precisa derivar do
`timestampMs` da palavra seguinte; o pacote não faz isso — **(2-0)** — fonte:
`https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/caption.ts`.

`createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds})` devolve
`{pages: TikTokPage[]}` e segmenta **por espaço inicial no `text` + limiar de tempo**. A doc exige o
whitespace dentro do `text` e recomenda `white-space: pre` na renderização — **(2-0)** — fonte:
`https://www.remotion.dev/docs/captions/create-tiktok-style-captions`. Um `.trim()` em qualquer
passo intermediário **colapsa a paginação inteira**, e o sintoma é visual, não um erro.

**A função não sabe de overflow.** Não recebe largura, fonte, viewport nem contagem de caracteres —
não pode proteger *bounding box*. O que existe para caracteres por linha é
`ensureMaxCharactersPerLine`, exportado **apenas** dentro de `CaptionsInternals`, sem ser API pública
nem ser chamado pela paginação — **(2-0)** — `docs/00-panorama-verificado.md §3.2` (R04-07).

`serializeSrt({lines: Caption[][]})` recebe **array de arrays** (passar `Caption[]` gera um bloco
por palavra); `parseSrt` devolve `confidence: 1` fixo e `timestampMs = ((start+end)/2)*1000` — ou
seja, **importar SRT inventa um timestamp**. O round-trip não é lossless e SRT não serve como
formato interno — **(2-0)** — `https://www.remotion.dev/docs/captions/serialize-srt`.

### Volume como função do frame — e o frame é relativo

`VolumeProp = number | ((frame: number) => number)` — **(2-0)** — fonte:
`https://github.com/remotion-dev/remotion/blob/main/packages/core/src/volume-prop.ts`.

**O `f` do callback é relativo ao início da mídia, não `useCurrentFrame()`**: um `<Audio>` dentro de
`<Sequence from={90}>` recebe `f=0` no frame 90 da composição (a implementação soma
`cumulatedNegativeFrom` das `<Sequence>` pai) — **(2-0)** — fonte:
`https://www.remotion.dev/docs/audio/volume`. Quem assume frame absoluto acerta por acidente em
cenas que começam no frame 0 — é o falso verde clássico deste domínio.

Com `loop`, `loopVolumeCurveBehavior` default `'repeat'` faz `f` reiniciar a cada iteração; um
fade-out no fim de uma trilha em loop **nunca chega** salvo com `'extend'` — **(2-0)** — fonte:
`https://github.com/remotion-dev/remotion/blob/main/packages/core/src/audio/use-audio-frame.ts`.

Volume negativo é clampado a 0 em silêncio; acima de 1 **amplifica**, e o único erro dispara em
`volume >= 100`. Como o mix é `amix=inputs=N:dropout_transition=0:normalize=0` (o Remotion desliga
de propósito a normalização que o FFmpeg traz ligada), **nada no Remotion impede clipping**: N
faixas em `volume={1}` são **somadas**, não divididas por N, e o `pcm_s16le` satura sem
warning — **(2-0)** — fonte:
`https://github.com/remotion-dev/remotion/blob/main/packages/core/src/volume-safeguard.ts` +
`https://ffmpeg.org/ffmpeg-filters.html`.

### Ducking: envelope autorado × `sidechaincompress`

**A premissa comum está refutada.** "Envelope calculado é determinístico e `sidechaincompress` não é"
é falso: dado o mesmo input e a mesma versão do FFmpeg, o compressor é **função pura** —
`REFUTADO (parcial)`; o "mais determinístico" não tem fonte — `docs/pesquisa/R10-ffmpeg.md §3` (linha do ducking).
No filtro, `threshold`/`level_*` são **lineares** (0.000976563..1), não dB — escrever
`threshold=-20dB` é o erro clássico — **(2-0)** — fonte:
`https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/af_sidechaincompress.c`.

**Recomendação: envelope autorado no manifesto**, avaliado como `volume={(f) => …}` na faixa de
música. Os motivos verdadeiros são de arquitetura, não de determinismo: a curva é **autorável e
revisável em diff** (o revisor vê a mixagem no PR) e deriva do alinhamento de palavras que o
pipeline já produziu — o duck acompanha a fala, não um detector de nível.

**Condições de escopo que limitam a recomendação:**
- O envelope é avaliado **por frame** (`volume=<expr>:eval=frame` no caminho FFmpeg) — a resolução
  temporal do duck é 1 frame: a 30 fps, 33 ms. Um *attack* mais rápido que um frame **não é
  representável**; `sidechaincompress` expressa attack/release em ms. Se o produto exigir attack
  sub-frame, a recomendação inverte.
- O `f` da curva é **relativo à faixa de música**, não à composição (ver acima). Escrever o envelope
  em frames absolutos desloca o duck inteiro.
- A montagem final fora do Remotion (concat, master) é do domínio do FFmpeg — lá o `sidechaincompress`
  é o caminho canônico e não há por que reimplementá-lo.

### Loudness: onde ele mora, e por que não é no Remotion

**Não existe normalização de loudness embutida no render** — a enumeração completa de
`packages/renderer/src/options/` (96 arquivos) não tem loudness, LUFS, limiter nem normalize, e
`loudnorm` só aparece na doc do Recorder como script FFmpeg **externo e destrutivo**: evidência
positiva de ausência — **(2-0)** — fonte:
`https://github.com/remotion-dev/remotion/tree/main/packages/renderer/src/options`. Logo o estágio
de loudness vive no FFmpeg, **antes** (normalizando assets) ou **depois** (masterizando a saída) do
render — a entrada preferencial para o "depois" é `--separate-audio-to`, que tira o áudio do output
principal e o escreve num arquivo à parte, de modo que a masterização seja seguida de um remux com
`-c:v copy` (o vídeo é encodado **uma** vez, no render). Condição de escopo que morde: **a extensão
do caminho passado deriva o `audioCodec`** e conflita com `--audio-codec` se divergirem — **(2-0)** —
fonte: `https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/options/separate-audio.tsx`.

**Não existe alvo único de LUFS.** Cinco publicadores, cinco números, todos corretos no próprio
escopo: EBU R 128 = **−23,0 LUFS**; AES TD1008 = −18 (fala) / −16 (música) / −14 (álbum); Netflix
OTT = −27 LKFS dialog-gated; Spotify = −14 LUFS; Google Assistant = −16 LUFS estéreo — **(5-0)** —
fonte: `docs/00-panorama-verificado.md` R14-12. O alvo é **decisão do dono registrada em ADR**, e o
teto de true peak **−1 dBTP** é o que tem três fontes independentes convergindo (Netflix é mais
restritivo, −2) — **(3-0)** — fonte: `docs/00-panorama-verificado.md` R14-13.

Duas armadilhas que mudam o resultado em silêncio: os defaults do `loudnorm` são I=−24 / TP=−2 /
LRA=7 — que é ATSC A/85, **não** EBU R 128, então `-af loudnorm` puro não cumpre nenhum dos dois
alvos — **(2-0)**; e mesmo recebendo os `measured_*`, o filtro **desliga a normalização linear e cai
para dinâmica** quando `offset_tp > target_tp` ou `measured_lra > target_lra` — **(2-0)** — fonte:
`docs/pesquisa/R10-ffmpeg.md §R10-14` e `§R10-16`. Por isso o **gate mede com `ebur128`** (read-only).

### Sincronia: as causas documentadas de drift

- `atempo` **não é frame-perfect**: *"speeding up 80.000 audio samples by 2x will lead to 40.014
  audio samples"* — por isso o código aplica `atempo` **antes** do `atrim`: o offset residual precisa
  ser **o mesmo para todas as faixas** — **(2-0)** — `https://www.remotion.dev/blog/faster-lambda`.
- **AAC** tem pacotes de exatamente **1024 amostras** e **512 amostras de priming** no início,
  compensadas por offset negativo no container MP4; e o pacote não é auto-contido (a forma de onda
  depende dos pacotes vizinhos) — daí o "pop" ao concatenar — **(2-0)** — mesma fonte.
  **Ressalva (C-07): a Apple publica 2112 amostras de priming** (*"currently fixed at 2112
  samples"*, TN2258) — **(1-0)** · R10-22 · `docs/pesquisa/R10-ffmpeg.md §R10-22`. Os dois números
  existem e medem cadeias diferentes (Remotion/FFmpeg × encoder da Apple): confundi-los produz
  cálculo de offset errado. A divergência é registrada por `ffmpeg-media-ops` e **não muda a
  decisão** — PCM até o master, AAC codificado uma vez só.
- No caminho `<Html5Audio>` o início de cada faixa é `adelay=<ms>` com `(padStart*1000).toFixed(0)`:
  **milissegundos inteiros**. O gate de sincronia nesse caminho não pode exigir tolerância menor que
  ~1 ms — **(2-0)** — fonte:
  `https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/stringify-ffmpeg-filter.ts`.
- **Duas pipelines coexistem** e quantizam diferente: `<Html5Audio>` → asset de mídia → filtros
  FFmpeg (offset em ms via `adelay`); `@remotion/media <Audio>` → extração por frame via
  WebCodecs/Mediabunny → asset `inline-audio` PCM (offset em amostras via cabeçalho WAV). Só o `amix`
  final é comum. Misturar as duas na mesma composição põe duas disciplinas de timing disputando o
  mesmo mix — **(2-0)** — fonte: `docs/00-panorama-verificado.md` R03-25.
- `acceptableTimeShiftInSeconds` (default **0,45 s**) é mecanismo de **Studio/Player**: re-seeka a
  mídia na reprodução ao vivo e **não toca no arquivo renderizado** — **(2-0)** — fonte:
  `https://github.com/remotion-dev/remotion/blob/main/packages/core/src/use-media-playback.ts`.

### Legibilidade de legenda — os números normativos viram invariante

- **Piso e teto de tempo por evento de texto** existem em toda norma consultada: piso de 20 frames
  (Netflix, "5/6 s" ⇒ 0,833 s) a 40 frames (DCMP, "1 s e 10 frames" ⇒ 1,333 s); teto de 6 s (DCMP) a
  7 s (Netflix) — **(2-0)** — fonte: `docs/00-panorama-verificado.md` R14-01·R14-11.
- **O gate se escreve em segundos, nunca em frames**: 20 frames a 60 fps são 0,333 s, quatro vezes
  abaixo do piso real. O invariante é `duracao >= max(0,833 s; caracteres/20)` **e**
  `duracao <= 7 s` — fonte: `docs/00-panorama-verificado.md §9.2`, Camada 4 (R14-01/R14-03).
- **O teto normativo de velocidade de leitura fica abaixo da leitura silenciosa livre** (238 wpm
  não-ficção): DCMP recomenda 130–160 wpm e a Netflix 20 CPS (≈207 wpm derivado). Dimensionar tempo
  de tela pela taxa de leitura livre é proibido — **(3-0)** — fonte:
  `https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf` ·
  `https://dcmp.org/learn/captioningkey/601`.
- **Área segura**: EBU R 95 fixa action safe 3,5% e graphics safe 5% (3,5% de 1920 = 67 px) —
  **(2-0)** — fonte: `https://tech.ebu.ch/docs/r/r095.pdf`. Condição de escopo dura: **R 95 é
  televisão 16:9 e não cobre 9:16** — para vertical não há fonte, só medição.
- Nenhum desses números pode aparecer literal no código de composição: eles vivem num arquivo de
  invariantes, para que trocar de plataforma ou de idioma seja editar valores — fonte: `docs/00-panorama-verificado.md §5.1` (linha «Invariantes de motion design»).

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

1. **Não meça sincronia por exit code.** O render sai `0` com a legenda 300 ms adiantada, fora da
   área segura e com o áudio clipando: nada disso muda o código de saída, e o guarda-corpo de volume
   só dispara em `>= 100`. Mede-se no MP4 final, correlacionando um click track com `ffprobe`.
2. **Não confie em "parece sincronizado" no Studio.** O preview tem re-seek automático que esconde
   até ~0,45 s de desvio e não existe no render: é a evidência mais convincente e mais inútil daqui.
3. **Não ligue `--dtw` e considere a legenda precisa.** O valor entra só em `timestampMs`; sem um
   passo explícito de reancoragem (`startMs := timestampMs`, `endMs := timestampMs` da palavra
   seguinte), o DTW é computado, pago e descartado.
4. **Não rode ASR para redescobrir um texto que você já tem.** Com locução TTS o problema correto é
   alinhamento forçado e o card de ASR pode ser **deletado**, não otimizado — salvo no cenário 100%
   local em pt-BR, onde não há atalho.
5. **Não conserte drift de render mexendo em `acceptableTimeShiftInSeconds`.** É de reprodução ao
   vivo; gasta-se um dia e não muda um byte do arquivo.
6. **Não escreva o gate de duração de legenda em frames.** Em fps alto o mesmo número em frames vira
   um piso quatro vezes menor, e o gate passa a aprovar legenda ilegível.
7. **Não chame `.trim()` no `text` de um `Caption`** em nenhum passo intermediário: a paginação
   depende do espaço à esquerda e colapsa para uma página só, sem erro.
8. **Não trate `timestampMs` como `number`.** É `number | null` sempre que `t_dtw === -1`.
9. **Não use SRT como formato de intercâmbio interno.** `parseSrt` fabrica `confidence` e um
   `timestampMs` no ponto médio: o round-trip parece funcionar e destrói a medição.
10. **Não normalize com `-af loudnorm` sem parâmetros, nem leia o log dele como prova.** O default é
    ATSC, não R 128, e o modo cai para dinâmico em silêncio. Medição é `ebur128`.
11. **Não escreva "o alvo é −14 LUFS (fonte: YouTube)".** Não existe página oficial do YouTube com
    número em LUFS; o −14 documentado é do Spotify.
12. **Não re-sintetize a locução dentro do render.** O artefato versionado é o par (áudio, timing);
    regenerar o áudio sem regenerar o timing dessincroniza sem erro.
13. **Não escreva o envelope como `interpolate(f, [0, fps], [0, 1])` sem `extrapolateRight`.** O
    default de `interpolate()` é `extend` nos dois lados, não `clamp` — **(2-0)**,
    `docs/00-panorama-verificado.md` R02-18 — então a curva passa de 1 logo após a rampa e o `volume`
    **amplifica**: o fade-in canônico vira clipping no meio da cena, sem warning.
14. **Não fatie o script pelo offset de um speech mark do Polly com índice de `string`.** Os offsets
    são em **bytes**: em pt-BR a palavra sai truncada e o alinhamento escorrega do primeiro acento
    em diante.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| Render sai `0` e o MP4 tem áudio | Nenhuma etapa mede offset A/V; a pista existe estando 300 ms fora | Gate que renderiza um click track e mede `start_time`/correlação no MP4 final |
| Fade perfeito numa cena que começa no frame 0 | No frame 0, `f` relativo e `useCurrentFrame()` coincidem | Fixture com áudio dentro de `<Sequence from={90}>` + asserção de RMS do primeiro segundo |
| Preview do Studio "sincronizado" | Re-seek de até 0,45 s mascara o desvio, e não existe no render | Sonda negativa: render com uma faixa deslocada em +400 ms — o gate do MP4 tem de reprovar **enquanto** o preview continua soando certo; se os dois concordarem, o gate está lendo o preview |
| 4 faixas em `volume={1}` sem nenhum warning | `amix` roda com `normalize=0` e o guarda só dispara em `>= 100` | Gate de true peak no áudio final (`ebur128 peak=true` / `volumedetect`) |
| `tokenLevelTimestamps: true` ligado | O DTW entra só em `timestampMs`, que a paginação não consome | Teste que desloca `timestampMs` em +300 ms e exige que a página renderizada mude |
| Transcrição rodada uma vez e batendo | Fallback de temperatura ligado por default, sem semente exposta | Três execuções + `sha256sum` do JSON no gate |
| Legenda coube na tela no clipe de teste | A paginação não conhece largura, fonte nem viewport | Invariante "nenhuma legenda ultrapassa a área segura" sobre frames renderizados |
| `loudnorm` diz que atingiu o alvo | Pode ter atingido em modo dinâmico, alterando a dinâmica | 2ª passada com `print_format=json` exigindo `normalization_type == linear` + `ebur128` |
| Round-trip SRT → `Caption[]` → SRT passa | `parseSrt` fabrica `confidence: 1` e `timestampMs` no ponto médio | Asserção de que `timestampMs` sobreviveu ao round-trip (hoje ela falha) |
| Legenda testada com áudio limpo em inglês | Números, siglas e identificadores são exatamente onde o alinhador interpola em silêncio | Fixture pt-BR com `H.264`, `FFmpeg` e `useCurrentFrame` |

## O que esta skill NÃO cobre

- **Escolha de motor de TTS, voz, preço, licença de pesos, consentimento e disclosure de voz** →
  `tts-voiceover`.
- **Componente de áudio a importar, trim, `toneFrequency`, lint contra `import {Audio} from 'remotion'`** → `remotion-core`.
- **Sample rate de saída, codecs, `--audio-bitrate`, `--muted`, flags de CLI do renderer** → `remotion-render-pipeline`.
- **Sintaxe dos comandos FFmpeg** (two-pass do `loudnorm`, filtergraph do `sidechaincompress`, `bitexact`) → `ffmpeg-media-ops`.
- **Tipografia, contraste, tamanho de fonte, área segura como valor e o arquivo de invariantes** → `motion-design-system`.
- **Como escrever o critério falsificável, a sonda negativa e o autoteste do gate** →
  `falsifiable-gates`; **captura e comparação de golden master de vídeo** → `video-characterization`.
- **Onde o timing entra no schema do manifesto e como o compilador emite as cenas** →
  `timeline-manifest`.

## Não verificado

- **"Nenhuma API de TTS promete áudio bit-exato"** — cada perna é **(1-0)**, doc oficial única: o
  `seed` do ElevenLabs com *"Determinism is not guaranteed"* e as vozes HD do Azure com *"slight
  variations in each output"* — fonte: `docs/00-panorama-verificado.md §8.1` (R13-15/16/17). Não cite isso como
  prova; o corolário de cache acima é precaução, não dedução. Fecha sintetizando a mesma frase 2×
  com o mesmo `seed` e comparando `sha256sum` do WAV.
- **A perna do `verification_signal` que chama o linter não roda hoje**: `.agents/scripts/skill_lint.py`
  não existe neste repositório. Fecha com `ls .agents/scripts/skill_lint.py`.
- **`createTikTokStyleCaptions()` nunca lê `timestampMs`** — leitura conclusiva do arquivo, mas
  **(1-0)**, um publicador e um artefato. Fecha com
  `grep -rn "timestampMs" node_modules/@remotion/captions/dist/ | grep -i tiktok` (esperado: nada).
  Enquanto não fechar, o passo de reancoragem é obrigatório por precaução.
- **Para MP3 o Remotion zera deliberadamente o `start_time` do `ffprobe`** ("that is an inherent
  encoder thing") — **(1-0)**, só o código. Decide se "converter tudo para WAV" é correção ou
  higiene. Fecha com `gh api …/renderer/src/assets/get-audio-channels.ts | base64 -d | head -60`.
- **whisper.cpp ≥ 1.7.5 decodifica mp3/48 kHz/estéreo sozinho** — **(2-1) EM DISPUTA**: o código do
  master usa miniaudio e as mensagens `must be …` sumiram, mas o README do master ainda diz "16-bit
  WAV files". Planeje pelo pior caso. Fecha `AB-048` com:
  `./build/bin/whisper-cli -m models/ggml-medium.bin -f teste_48k_stereo.mp3 -oj -ojf`.
- **42 caracteres por linha, 2 linhas e 20 CPS** — norma proprietária (Netflix) é **fonte única por
  construção**, e o 42 é calibrado para **inglês**; pt-BR tem palavras mais longas e pode exigir
  37–40, o que muda o **quebrador de linha**, não só o número. Fecha por medição na fonte escolhida.
- **Alvo de loudness do YouTube em LUFS** — **zero placar**: nenhuma página oficial publica número.
  Fecha por decisão do dono em ADR, ou medindo "content loudness" no *Stats for nerds* (que mede
  comportamento, não política).
- **Offset A/V real (ms) de uma faixa em `<Sequence from={N}>`, por pipeline** — não medido. Fecha
  `AB-046` com dois renders trocando só o import +
  `ffprobe -show_entries stream=start_time,duration -select_streams a:0 out.mp4` contra um click
  track. É esse número que calibra o gate.
- **Se a soma de N faixas em `volume={1}` clipa de fato** — não medido. Fecha `AB-047` com
  `--separate-audio-to=/tmp/a.wav` + `ffmpeg -i /tmp/a.wav -af volumedetect -f null -`.
- **Granularidade real da curva de volume no arquivo final** (degrau de 1 frame × rampa) — assumido
  degrau de 1 frame. Fecha com fade linear de 1 s a 30 fps + `astats=metadata=1:reset=1`.
- **Se `sidechaincompress` é bit-determinístico nesta máquina** — assumido que sim. Fecha rodando o
  mesmo filtergraph 2× e comparando `md5sum`.
- **Se o TTS local em pt-BR devolve timestamps** — disputa aberta entre duas leituras do mesmo
  arquivo (o mecanismo existe × a guarda `lang_code in 'ab'` o exclui do português). Custo de errar:
  um subsistema inteiro. Fecha `AB-050` com:
  `python -c "from kokoro import KPipeline; p=KPipeline(lang_code='p'); r=list(p('O Kubernetes escala o PostgreSQL.', voice='pf_dora')); print([(t.text,t.start_ts,t.end_ts) for t in (r[0].tokens or [])])"`.
- **Critério de aceite de sincronia em ms** — é decisão do dono (ADR): ±50 ms obriga TTS com
  alinhamento nativo ou legenda por frase; ±150–250 ms libera whisper `--dtw` ou alinhador forçado;
  sem critério, o gate vira inspeção visual e o card não fecha.

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
