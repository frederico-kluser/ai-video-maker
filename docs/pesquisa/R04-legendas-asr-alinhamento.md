# R04 — Legendas: whisper.cpp, timestamps por palavra, alinhamento forçado

**Escopo desta pesquisa:** fecha a API real de `@remotion/install-whisper-cpp` e `@remotion/captions`, a
mecânica de DTW/`t_dtw` no whisper.cpp, a precisão medida do timestamp por palavra e as alternativas de
alinhamento forçado — inclusive a pergunta cara: **se a locução é TTS, o ASR é necessário?** NÃO responde
estilo visual de legenda, tipografia, layout, nem custo de nuvem em BRL, nem qual TTS o dono vai contratar.

---

## Convenção de contagem de fontes usada neste arquivo

O contrato manda contar fontes independentes e diz que duas páginas do mesmo domínio valem uma. Como quase
toda evidência aqui é sobre a API de um produto específico, aplico a regra assim, explicitamente, para o
leitor poder descontar:

- **Publicadores distintos** (Remotion ≠ ggml/whisper.cpp ≠ ElevenLabs ≠ Microsoft ≠ npm registry) contam
  sempre como fontes distintas.
- Dentro do mesmo publicador, conto como **artefatos primários distintos**: (a) página de documentação
  publicada, (b) arquivo-fonte no repositório oficial, (c) entrada de release/changelog, (d) metadado de
  registry/licença. Um mesmo arquivo em duas tags de versão conta **uma** vez.
- Em cada claim, a linha "Fontes" diz quantos **publicadores** distintos existem. Se for 1, o placar está
  medindo consistência interna do produto, não corroboração independente — e eu digo isso na linha.

Tudo abaixo foi lido com `WebFetch`/`curl` nas datas de **2026-08-10**. Nenhum link foi escrito sem ter
sido aberto.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R04-01 | `@remotion/install-whisper-cpp` 4.0.507 exporta exatamente `installWhisperCpp`, `downloadWhisperModel`, `transcribe`, `toCaptions` (+ `convertToCaptions`, deprecado desde v4.0.216). | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/index.ts |
| R04-02 | O parâmetro `tokenLevelTimestamps` existe em `transcribe()` e é **obrigatório** (sem `?`), tipado como genérico que muda o tipo de retorno. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts |
| R04-03 | Com `tokenLevelTimestamps: true`, o wrapper passa `--dtw <preset>` **e força `--max-len 1`**; `tokensPerItem` vira `never` no tipo. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts |
| R04-04 | O campo `t_dtw` existe: em whisper.cpp é `whisper_token_data.t_dtw`, marcado `[EXPERIMENTAL]`, emitido no JSON com `-ojf`; no Remotion é `WordLevelToken.t_dtw`. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h |
| R04-05 | `t_dtw` está em **centissegundos**; `toCaptions()` faz `t_dtw * 10` para virar ms e devolve `null` quando `t_dtw === -1`. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/to-captions.ts |
| R04-06 | O tipo `Caption` é `{text, startMs, endMs, timestampMs: number\|null, confidence: number\|null}`, e `toCaptions()` põe DTW **só** em `timestampMs`: `startMs`/`endMs` vêm de `offsets` (tempo não-DTW). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/caption.ts |
| R04-07 | `createTikTokStyleCaptions()` existe (desde v4.0.216), recebe `{captions, combineTokensWithinMilliseconds}`, devolve `{pages: TikTokPage[]}` e **segmenta por espaço inicial no `text` + limiar de tempo**. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/captions/create-tiktok-style-captions |
| R04-08 | `createTikTokStyleCaptions()` **nunca lê `timestampMs`** — usa apenas `startMs`/`endMs`, ou seja, descarta o valor de DTW que a própria doc manda preferir. | (1-0) | NÃO VERIFICADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/create-tiktok-style-captions.ts |
| R04-09 | `parseSrt` e `serializeSrt` existem e são exportados; `serializeSrt` recebe `{lines: Caption[][]}` (array **de arrays**), disponível desde v4.0.216. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/captions/serialize-srt |
| R04-10 | As licenças divergem dentro do próprio Remotion: `@remotion/captions` e `@remotion/openai-whisper` são MIT; `@remotion/install-whisper-cpp` é "SEE LICENSE IN LICENSE.md" (Licença Remotion, com Company License) e `@remotion/whisper-web` é `UNLICENSED` no npm. | (2-0) | PROVÁVEL | https://registry.npmjs.org/@remotion%2Finstall-whisper-cpp |
| R04-11 | whisper.cpp tem a flag `-dtw MODEL / --dtw MODEL` e aceita exatamente 12 strings de preset; valor fora da lista aborta com `error: unknown DTW preset`. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp |
| R04-12 | DTW entrou em whisper.cpp **v1.5.5** (2024-04-16, PR #1485); o preset `large.v3.turbo` só existe a partir de **v1.7.2** (2024-11-19, PR #2481); estável mais recente é **v1.9.2** (2026-08-04). | (3-0) | CONFIRMADO | https://github.com/ggml-org/whisper.cpp/releases/tag/v1.5.5 |
| R04-13 | Até whisper.cpp v1.7.4 o leitor de WAV rejeita explicitamente ≠16 kHz, ≠16-bit e ≠(1 ou 2) canais — **estéreo é aceito e mixado**, mono não é obrigatório; e o `transcribe()` do Remotion rejeita, no lado JS, qualquer `inputPath` sem extensão `.wav`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.7.4/examples/common.cpp |
| R04-14 | A partir de v1.7.5 (PR #2759, miniaudio) o whisper-cli decodifica wav/mp3/flac/ogg e reamostra internamente para 16 kHz mono — as mensagens `must be 16 kHz` / `must be 16-bit` sumiram do master —, **mas o README do master ainda afirma** que o whisper-cli "currently runs only with 16-bit WAV files". | (2-1) | EM DISPUTA | https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/common-whisper.cpp |
| R04-15 | `installWhisperCpp()` fixa versão fazendo `git clone` + `git checkout v<versão>` (semver ou hash de commit); a partir de 1.7.4 o binário chamado é `whisper-cli`, antes era `main`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/install-whisper-cpp.ts |
| R04-16 | O whisper-cli **não expõe semente**: a string `seed` não aparece no parser de argumentos nem no help; defaults são `temperature = 0.0f`, `temperature_inc = 0.2f`, `n_threads = min(4, hardware_concurrency)` — e o Remotion **não passa `-t`**. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp |
| R04-17 | Medição independente com collar de 0,2 s em fala sintética anotada à mão: DTW sobre cross-attention (Whisper large-v2) dá F1 **74,7** / mIoU 51,4 e WhisperX (wav2vec2) dá F1 **76,7** / mIoU 61,5 — com ruído, 68,3 vs 59,0. | (2-0) | PROVÁVEL | https://www.isca-archive.org/interspeech_2024/zusag24_interspeech.pdf |
| R04-18 | WhisperX é BSD-2-Clause, roda faster-whisper por baixo e tem modelo de alinhamento default para `pt` (`jonatasgrosman/wav2vec2-large-xlsr-53-portuguese`); palavras sem caracteres no dicionário do modelo (ex.: `2014.`, `£13.60`) não são alinháveis e recebem interpolação. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py |
| R04-19 | Existem ≥4 alinhadores forçados open-source utilizáveis em português, mas a licença do **código** não é a licença do **modelo**: `ctc-forced-aligner` é BSD com modelo default CC-BY-NC 4.0 (veta uso comercial), MFA é MIT com modelo português CC BY 4.0, NeMo é Apache-2.0 (só CTC), stable-ts é MIT mas com desenvolvimento "paused indefinitely". | (3-0) | CONFIRMADO | https://mfa-models.readthedocs.io/en/latest/acoustic/Portuguese/Portuguese%20MFA%20acoustic%20model%20v2_0_0.html |
| R04-20 | ElevenLabs oferece **dois** caminhos diferentes: `POST /v1/text-to-speech/{voice_id}/with-timestamps`, que devolve alinhamento por **caractere** (`characters`, `character_start_times_seconds`, `character_end_times_seconds`), e `POST /v1/forced-alignment`, que recebe áudio+texto e devolve `words` com `start`/`end`/`loss` — este sim por **palavra**, com pt-BR entre os 29 idiomas. | (2-0) | PROVÁVEL | https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps |
| R04-21 | O TTS da Azure emite evento `WordBoundary` nativo com `audio_offset` (ticks de 100 ns), `duration`, `text`, `text_offset` e `word_length` — timestamp por palavra sem nenhum ASR. | (2-0) | PROVÁVEL | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis |
| R04-22 | No Google Cloud TTS, timepoints só existem via tag SSML `<mark>` + `enableTimePointing: SSML_MARK`, apenas na API **v1beta1**, devolvendo `{markName, timeSeconds}` — para timestamp por palavra é preciso envolver cada palavra num `<mark>` manualmente. | (2-0) | PROVÁVEL | https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/text/synthesize |
| R04-23 | O TTS da OpenAI (`POST /v1/audio/speech`) **não** devolve timestamps nem alinhamento: a lista completa de parâmetros gerada do OpenAPI spec é `input, model, voice, instructions, response_format, speed, stream_format` e o retorno é conteúdo binário de áudio. | (1-0) | NÃO VERIFICADO | https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/audio/speech_create_params.py |
| R04-24 | Nos TTS **locais**: Kokoro (Apache-2.0) sintetiza pt-BR (`lang_code='p'`) mas só preenche `start_ts`/`end_ts` quando `lang_code in 'ab'` (inglês) — logo, **sem timestamps para português**; Piper (GPL-3.0) tem alinhamento apenas **experimental e por fonema** (contagem de samples por `phoneme_id`), não por palavra. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py |

---

## 2. Detalhe por claim

### R04-01 — `@remotion/install-whisper-cpp` 4.0.507 exporta `installWhisperCpp`, `downloadWhisperModel`, `transcribe`, `toCaptions`

- **Verdade operacional:** os quatro nomes que o panorama assume existem, e a versão publicada hoje é a
  mesma do monorepo (4.0.507, publicada em 2026-08-07). Há um quinto export, `convertToCaptions`, marcado
  `@deprecated ... as of Remotion v4.0.216. Use the toCaptions() function instead.` — usar o deprecado é
  dívida imediata.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/index.ts
  curl -s https://registry.npmjs.org/@remotion%2Finstall-whisper-cpp | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['dist-tags']['latest'])"
  ```
- **O que quebra se divergir:** o card de "pipeline de transcrição" e qualquer skill que gere o snippet de
  instalação. Se `toCaptions` sumir, quebram também os fixtures de `Caption[]` do card de legenda.
- **Fontes** (2 publicadores: Remotion, npm):
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/index.ts (primária) — lista literal dos exports e o comentário de deprecação.
  - https://www.remotion.dev/docs/install-whisper-cpp/ (primária) — a página de índice do pacote enumera as quatro APIs.
  - https://registry.npmjs.org/@remotion%2Finstall-whisper-cpp (primária) — `latest = 4.0.507`, publicado 2026-08-07.

### R04-02 — `tokenLevelTimestamps` existe e é obrigatório

- **Verdade operacional:** não é uma flag opcional que se "liga se quiser". O tipo é
  `tokenLevelTimestamps: HasTokenLevelTimestamps;` — sem `?`. Ele é o parâmetro genérico que decide se
  `TranscriptionJson<true>` (com `tokens[]` por item) ou `TranscriptionJson<false>` (sem). `toCaptions()`
  **só aceita** `TranscriptionJson<true>`: o input é tipado `whisperCppOutput: TranscriptionJson<true>`.
  Ou seja, no caminho Remotion→captions, `tokenLevelTimestamps: true` é compulsório, não uma otimização.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts | grep -n "tokenLevelTimestamps"
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/to-captions.ts | grep -n "TranscriptionJson"
  ```
- **O que quebra se divergir:** o card de transcrição e o contrato de tipo entre transcrição e renderização
  de legenda. Se virar opcional com default `false`, todo fixture de caption por palavra vira caption por
  segmento silenciosamente.
- **Fontes** (1 publicador: Remotion — isto mede consistência interna do produto, não corroboração independente):
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts (primária) — assinatura completa.
  - https://www.remotion.dev/docs/install-whisper-cpp/transcribe (primária) — "Passes the `--dtw` flag to Whisper.cpp to generate more accurate timestamps, which are being returned under the `t_dtw` field."
  - https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-best-practices/remotion-captions/transcribe-captions.md (primária) — skill oficial do Remotion, usa `tokenLevelTimestamps: true` no snippet canônico.

### R04-03 — `tokenLevelTimestamps: true` dispara `--dtw <preset>` **e** `--max-len 1`

- **Verdade operacional:** este é o detalhe que faz o pipeline inteiro funcionar e que ninguém documenta na
  página. No wrapper público:
  ```ts
  tokensPerItem: tokenLevelTimestamps ? 1 : (tokensPerItem ?? 1),
  ```
  e na montagem de args:
  ```ts
  tokensPerItem ? ['--max-len', tokensPerItem] : null,
  '-ojf', // Output full JSON
  tokenLevelTimestamps ? ['--dtw', modelToDtw(model)] : null,
  ```
  Isto é, com DTW ligado o whisper.cpp roda com `--max-len 1`, de modo que **cada "segmento" do JSON é um
  token**. É por isso que `toCaptions()` produz um `Caption` por palavra (com o espaço à esquerda
  preservado) e não um `Caption` por frase — que é exatamente o contrato de whitespace que
  `createTikTokStyleCaptions()` exige. O mapeamento de preset é `modelToDtw()`, que troca `large-v3-turbo`
  por `large.v3.turbo`, `large-v3` por `large.v3` etc. e devolve o próprio nome do modelo nos demais casos.
  O tipo proíbe combinar: `tokensPerItem?: true extends HasTokenLevelTimestamps ? never : number | null`.
  O Remotion **não** passa `-t` (threads), `-bs`/`-bo` (beam/best-of) nem `--vad`; só há `additionalArgs`
  como escotilha.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts | sed -n '90,200p'
  ```
- **O que quebra se divergir:** se o Remotion parar de forçar `--max-len 1`, o `Caption[]` deixa de ser
  por palavra e o `createTikTokStyleCaptions()` passa a receber frases inteiras — as "páginas" viram
  parágrafos. Quebra: card de legenda TikTok, fixture `captions.json`, gate visual de legenda.
- **Fontes** (1 publicador: Remotion):
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts (primária) — código citado acima.
  - https://www.remotion.dev/docs/install-whisper-cpp/transcribe (primária) — documenta `tokensPerItem` com default `1` e a descrição de `--dtw`.

### R04-04 — `t_dtw` existe nos dois lados

- **Verdade operacional:** no header público do whisper.cpp:
  ```c
  typedef struct whisper_token_data {
      whisper_token id; whisper_token tid;
      float p; float plog; float pt; float ptsum;
      int64_t t0; int64_t t1;
      int64_t t_dtw;      // [EXPERIMENTAL] Token-level timestamps with DTW
      float vlen;
  } whisper_token_data;
  ```
  com o comentário literal `// do not use if you haven't computed token-level timestamps with dtw` e
  `// Roughly corresponds to the moment in audio in which the token was output`. O `whisper-cli` só emite
  esse campo no JSON quando `-ojf` está ligado (`value_f("t_dtw", mt.data.t_dtw, true)`). Do lado JS, o tipo
  `WordLevelToken` do Remotion declara `t_dtw: number`. **"Roughly" é palavra da fonte, não minha**: DTW dá
  o instante aproximado em que o token foi emitido, não o onset do fonema.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h | grep -n -B4 -A4 t_dtw
  curl -s https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp | grep -n t_dtw
  ```
- **O que quebra se divergir:** o card que lê `timestampMs`; a fixture de transcrição; a asserção do gate de
  sincronia palavra-a-palavra.
- **Fontes** (2 publicadores: ggml, Remotion):
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h (primária) — struct e comentário `[EXPERIMENTAL]`.
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp (primária) — emissão no JSON completo.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts (primária) — `type WordLevelToken = { t_dtw: number; ... }`.

### R04-05 — `t_dtw` está em centissegundos; `toCaptions()` multiplica por 10

- **Verdade operacional:** o header do whisper.cpp diz literalmente *"Get the start/end time of the
  specified token, **in centiseconds**"*, e `examples/common-whisper.cpp` confirma com
  `timestamp_to_sample`: `(t*whisper_sample_rate)/100`. Do outro lado:
  ```ts
  timestampMs: item.tokens[0].t_dtw === -1 ? null : item.tokens[0].t_dtw * 10,
  ```
  Consequência dura: **a resolução máxima do timestamp é 10 ms**, não "microscópica". E `-1` é o valor
  sentinela de "DTW não computado" — nesse caso `timestampMs` vira `null`, e qualquer código que assuma
  `number` explode.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h | grep -n "centiseconds"
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/to-captions.ts
  ```
- **O que quebra se divergir:** conversão ms↔frame no componente de legenda; qualquer teste que compare
  `timestampMs` com valor esperado. Se `t_dtw` virar milissegundos numa versão futura, tudo desloca 10×.
- **Fontes** (2 publicadores: ggml, Remotion):
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h (primária) — "in centiseconds".
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/common-whisper.cpp (primária) — `(t*whisper_sample_rate)/100`.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/to-captions.ts (primária) — `t_dtw * 10` e o sentinela `-1`.

### R04-06 — Tipo `Caption`, e onde o DTW efetivamente entra

- **Verdade operacional:** o tipo é exatamente
  ```ts
  export type Caption = {
    text: string;
    startMs: number;
    endMs: number;
    timestampMs: number | null;
    confidence: number | null;
  };
  ```
  Os cinco campos que o panorama assume existem. Mas o mapeamento em `toCaptions()` é assimétrico e é a
  parte que interessa:
  | campo do `Caption` | de onde vem | é DTW? |
  |---|---|---|
  | `startMs` | `item.offsets.from` | **não** |
  | `endMs` | `item.offsets.to` | **não** |
  | `timestampMs` | `item.tokens[0].t_dtw * 10` | **sim** |
  | `confidence` | `item.tokens[0].p` | n/a (probabilidade do token) |
  | `text` | `item.text` (só o primeiro sofre `trimStart()`) | n/a |
  Ou seja: o DTW mora num campo só, e é um **ponto** (instante), não um intervalo. Não existe `endMs`
  derivado de DTW. Quem quiser duração por palavra com precisão DTW precisa derivar do `timestampMs` da
  palavra seguinte — o pacote não faz isso.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/caption.ts
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/to-captions.ts
  ```
  Observação: `https://www.remotion.dev/docs/captions/caption` responde 200 no `curl` mas devolveu 404 ao
  fetcher HTTP em 2026-08-10 — não confie nela como fonte única.
- **O que quebra se divergir:** o componente de destaque palavra-a-palavra; a normalização de legendas; os
  fixtures. Se `confidence` deixar de ser `number | null`, quebra qualquer filtro de baixa confiança.
- **Fontes** (1 publicador: Remotion):
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/caption.ts (primária) — tipo literal.
  - https://www.remotion.dev/docs/install-whisper-cpp/to-captions (primária) — lista `text`, `startMs`, `endMs`, `timestampMs`, `confidence`.

### R04-07 — `createTikTokStyleCaptions()`: assinatura e semântica reais

- **Verdade operacional:** existe, é exportada, e a assinatura confere:
  ```ts
  createTikTokStyleCaptions({captions: Caption[], combineTokensWithinMilliseconds: number}): {pages: TikTokPage[]}
  export type TikTokPage  = { text: string; startMs: number; tokens: TikTokToken[]; durationMs: number };
  export type TikTokToken = { text: string; fromMs: number; toMs: number };
  ```
  `durationMs` é documentado como disponível **a partir de v4.0.261**; a função em si, de v4.0.216.
  A semântica é puramente temporal + lexical: quebra uma página quando o `text` do caption **começa com
  espaço** *e* o acumulado `currentTo - currentFrom` já passou de `combineTokensWithinMilliseconds`. A doc
  é explícita sobre o contrato de whitespace: *"This API expects the whitespace to be included in the
  `text` field before each word. Spaces are used as delimiters"*, e recomenda `white-space: pre` na
  renderização. Sem o espaço à esquerda, tudo vira uma página só.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/create-tiktok-style-captions.ts
  ```
  e a página https://www.remotion.dev/docs/captions/create-tiktok-style-captions.
- **O que quebra se divergir:** o card de legenda animada; a fixture de `pages`; o gate visual. Se algum
  passo intermediário do pipeline fizer `.trim()` no `text` de cada caption, a paginação colapsa — e o
  sintoma é visual, não um erro.
- **Fontes** (1 publicador: Remotion):
  - https://www.remotion.dev/docs/captions/create-tiktok-style-captions (primária) — assinatura, tipos, `AvailableFrom 4.0.216`, `durationMs` de 4.0.261, contrato de whitespace.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/create-tiktok-style-captions.ts (primária) — implementação completa.

### R04-08 — `createTikTokStyleCaptions()` ignora `timestampMs` (o valor de DTW)

- **Verdade operacional:** li o arquivo inteiro (93 linhas). A string `timestampMs` **não aparece**. Toda
  temporização de página e de token sai de `item.startMs` / `item.endMs`:
  ```ts
  currentTokens.push({ text: ..., fromMs: item.startMs, toMs: item.endMs });
  ```
  Como `startMs`/`endMs` vêm dos `offsets` do whisper (R04-06), **o pipeline canônico do Remotion liga o
  DTW, paga o custo dele, e depois renderiza com o timestamp não-DTW**. A própria doc de `transcribe()`
  diz *"Prefer relying on the `t_dtw` value for accurate timestamps over `offsets`"* — e o utilitário de
  paginação do mesmo fornecedor faz o contrário. Isto não é bug de ninguém necessariamente (com
  `--max-len 1` os `offsets` já são por token), mas **destrói a justificativa do panorama** para ligar DTW,
  a menos que se escreva um passo próprio que reescreva `startMs`/`endMs` a partir de `timestampMs`.
- **Como reconferir:**
  ```bash
  # contra o pacote instalado, não contra o GitHub:
  grep -rn "timestampMs" node_modules/@remotion/captions/dist/ | head
  # esperado hoje: nenhuma ocorrência dentro de create-tiktok-style-captions
  ```
- **O que quebra se divergir (ou: o que este achado obriga):** obriga a existir um card explícito
  "reancorar Caption[] em t_dtw antes de paginar" — algo como
  `captions.map(c => ({...c, startMs: c.timestampMs ?? c.startMs}))` com `endMs` = `timestampMs` do
  próximo. Sem esse card, o gate de sincronia mede o DTW e renderiza o não-DTW.
- **Fontes** (1 publicador, 1 artefato — por isso NÃO VERIFICADO apesar de a leitura ser conclusiva):
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/create-tiktok-style-captions.ts (primária) — arquivo completo, sem nenhuma referência a `timestampMs`.
  - Contraponto do mesmo fornecedor: https://www.remotion.dev/docs/install-whisper-cpp/transcribe (primária) — "Prefer relying on the `t_dtw` value for accurate timestamps over `offsets`."

### R04-09 — `parseSrt` / `serializeSrt` existem, com assinatura não óbvia

- **Verdade operacional:** ambos são exportados de `@remotion/captions` (junto com `Caption`,
  `createTikTokStyleCaptions`, `TikTokPage`, `TikTokToken`, `EnsureMaxCharactersPerLineInput/Output` e
  `CaptionsInternals`). Duas pegadinhas de assinatura:
  - `serializeSrt({lines: Caption[][]})` — **array de arrays**, uma linha de SRT por sub-array. Passar
    `Caption[]` gera um bloco por palavra.
  - `parseSrt({input})` devolve `Caption[]` com `confidence: 1` fixo e
    `timestampMs = ((start + end) / 2) * 1000` — ou seja, **importar SRT inventa um `timestampMs` no meio
    do intervalo**. Não é medição, é interpolação.
  - `ensureMaxCharactersPerLine` existe mas **só** dentro de `CaptionsInternals`, não como API pública
    estável.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/index.ts
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/parse-srt.ts
  ```
- **O que quebra se divergir:** o card de export/import de legenda; qualquer teste que faça round-trip
  SRT→Caption[]→SRT (o round-trip **não** é lossless: `confidence` e `timestampMs` são fabricados).
- **Fontes** (1 publicador: Remotion):
  - https://www.remotion.dev/docs/captions/serialize-srt (primária) — `lines: Caption[][]`, `AvailableFrom 4.0.216`.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/index.ts + `parse-srt.ts` + `serialize-srt.ts` (primária) — lista de exports e implementações.

### R04-10 — As licenças dos pacotes de legenda do Remotion não são iguais

- **Verdade operacional:** consultado no registry em 2026-08-10, versão `4.0.507` de todos:
  | pacote | campo `license` no npm |
  |---|---|
  | `@remotion/captions` | `MIT` |
  | `@remotion/openai-whisper` | `MIT` |
  | `@remotion/install-whisper-cpp` | `SEE LICENSE IN LICENSE.md` |
  | `@remotion/whisper-web` | `UNLICENSED` |
  O `LICENSE.md` referenciado **não existe dentro da pasta do pacote** no monorepo (404 em
  `packages/install-whisper-cpp/LICENSE.md`); o que existe é o `LICENSE.md` da raiz, que é a Licença
  Remotion com o esquema de duas faixas: *"Individuals and small companies are allowed to use Remotion to
  create videos for free (even commercial), while a company license is required for for-profit
  organizations of a certain size"* e o aviso *"In Remotion 5.0, the license will slightly change"*.
- **Como reconferir:**
  ```bash
  for p in @remotion/captions @remotion/install-whisper-cpp @remotion/whisper-web @remotion/openai-whisper; do
    curl -s "https://registry.npmjs.org/$(echo $p | sed 's|/|%2F|')" | python3 -c "import sys,json;d=json.load(sys.stdin);v=d['dist-tags']['latest'];print('$p',v,d['versions'][v].get('license'))"
  done
  ```
- **O que quebra se divergir:** este item pertence sobretudo ao cluster de licença (R01), mas condiciona
  aqui a escolha do caminho de transcrição: `@remotion/captions` (MIT) é seguro isolado; o wrapper de
  whisper.cpp **não é MIT**. Um card que "usa só @remotion/captions e chama whisper.cpp por conta própria"
  tem perfil jurídico diferente de um que usa `@remotion/install-whisper-cpp`.
- **Fontes** (2 publicadores: npm, Remotion):
  - https://registry.npmjs.org/@remotion%2Finstall-whisper-cpp (primária) e os outros três registros.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md (primária) — texto Free/Company License.

### R04-11 — `--dtw` e a lista fechada de presets

- **Verdade operacional:** o help imprime literalmente
  `-dtw MODEL --dtw MODEL            [%-7s] compute token-level timestamps`. O parser aceita **exatamente**:
  `tiny`, `tiny.en`, `base`, `base.en`, `small`, `small.en`, `medium`, `medium.en`, `large.v1`, `large.v2`,
  `large.v3`, `large.v3.turbo`. Qualquer outro valor cai em
  `fprintf(stderr, "error: unknown DTW preset '%s'\n", ...)`. Isso corresponde 1:1 ao enum
  `whisper_alignment_heads_preset` do header, que tem também `WHISPER_AHEADS_NONE`,
  `WHISPER_AHEADS_N_TOP_MOST` e `WHISPER_AHEADS_CUSTOM` — **não alcançáveis pela CLI**, só pela API C.
  Nota de nomenclatura que morde: o modelo se chama `large-v3-turbo` (hífen) e o preset se chama
  `large.v3.turbo` (ponto). É por isso que o Remotion tem a função `modelToDtw()`.
  Nota de cobertura: **não há preset para modelos quantizados nem para modelos externos** — DTW depende de
  uma tabela de *alignment heads* por arquitetura de modelo.
- **Como reconferir:**
  ```bash
  ./build/bin/whisper-cli --help | grep -i dtw
  ./build/bin/whisper-cli -m models/ggml-large-v3-turbo.bin --dtw foo -f a.wav   # deve dar "unknown DTW preset"
  ```
- **O que quebra se divergir:** o card que escolhe modelo. Se o card usar um modelo sem preset (ex.: um
  `.bin` quantizado com nome custom), `--dtw` aborta e a transcrição inteira falha — não degrada.
- **Fontes** (2 publicadores: ggml, Remotion):
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp (primária) — help e mapeamento.
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h (primária) — enum completo.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts (primária) — `modelToDtw()` faz a tradução hífen→ponto.

### R04-12 — Linha do tempo de versões do DTW

- **Verdade operacional:**
  | versão | data | o que mudou |
  |---|---|---|
  | v1.5.5 | 2024-04-16 | *"Token level timestamps with DTW by @denersc in .../pull/1485"* — a feature nasce aqui |
  | v1.7.0 | 2024-10-05 | "Fix DTW assert" (#2299) |
  | v1.7.2 | 2024-11-19 | *"Add dtw preset for large-v3-turbo by @rotemdan in .../pull/2481"* + *"When DTW timestamps are enabled, defer new_segment_callback until after DTW compute step"* (#2515) |
  | v1.8.0 | 2025-09-30 | dtw.params no `server.cpp` para v3-large-turbo (#3307) |
  | v1.9.2 | 2026-08-04 | release estável mais recente |
  A doc do Remotion confirma de fora: *"`large-v3-turbo` requires versions built from November 2024 or
  later"*. **A versão 1.5.5 que a doc e a skill oficial do Remotion recomendam não tem o preset de
  `large-v3-turbo`.** Escolher `1.5.5` fecha a porta do turbo.
- **Como reconferir:**
  ```bash
  curl -s "https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=30" \
    | python3 -c "import sys,json;[print(r['tag_name'], r['published_at'][:10]) for r in json.load(sys.stdin)]"
  ```
- **O que quebra se divergir:** o card "instalar whisper.cpp" (qual versão pinar) e o card "escolher
  modelo". Se pinar 1.5.5 e depois alguém trocar o modelo para `large-v3-turbo`, `--dtw large.v3.turbo`
  vira preset desconhecido e a transcrição aborta.
- **Fontes** (2 publicadores: ggml, Remotion):
  - https://github.com/ggml-org/whisper.cpp/releases/tag/v1.5.5 (primária) — nota de release do PR #1485, data 2024-04-16.
  - `api.github.com/repos/ggml-org/whisper.cpp/releases` (primária) — listagem completa com datas e PRs (#2481 em v1.7.2, v1.9.2 em 2026-08-04).
  - https://www.remotion.dev/docs/install-whisper-cpp/transcribe (primária) — "requires versions built from November 2024 or later".

### R04-13 — Requisito de áudio até v1.7.4 (e o guarda do Remotion)

- **Verdade operacional:** em `examples/common.cpp` das tags `v1.5.5` e `v1.7.4`, o leitor de WAV falha com
  quatro mensagens literais:
  ```
  WAV file '%s' must be mono or stereo
  WAV file '%s' must be stereo for diarization
  WAV file '%s' must be %i kHz          (COMMON_SAMPLE_RATE/1000 = 16)
  WAV file '%s' must be 16-bit
  ```
  Três consequências que contrariam o folclore:
  1. **Mono não é obrigatório.** Estéreo é aceito e mixado (`pcmf32[i] = (stereo[2i] + stereo[2i+1])`).
     O `-ac 1` do ffmpeg é higiene, não requisito. A própria doc do Remotion recomenda
     `ffmpeg -i /path/to/audio.mp4 -ar 16000 /path/to/audio.wav -y` — **sem `-ac 1`**.
  2. **16 kHz é obrigatório** nessas versões, e o erro é fatal, não um resample silencioso.
  3. **16-bit PCM é obrigatório**; `.wav` float32 (`pcm_f32le`) é recusado nessas versões.
  Do lado JS, o Remotion adiciona um guarda próprio antes de chamar o binário:
  ```ts
  if (!isWavFile(inputPath)) throw new Error('Invalid inputFile type. The provided file is not a wav file! ...')
  ```
  — e `isWavFile` só olha a **extensão** do caminho. Também há um matcher de stderr para
  `'must be 16 kHz'` que reescreve a mensagem apontando para a doc de resample.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.7.4/examples/common.cpp | grep -n "must be"
  ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,sample_fmt -of default=nw=1 audio.wav
  ```
- **O que quebra se divergir:** o card de preparação de áudio. Se o gerador de locução entregar `.mp3`,
  o `transcribe()` do Remotion **rejeita pela extensão** mesmo que o whisper.cpp instalado saiba decodificar
  (ver R04-14). Fixture necessária: um WAV pcm_s16le 16 kHz.
- **Fontes** (2 publicadores: ggml, Remotion):
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/v1.7.4/examples/common.cpp (primária) — mensagens literais; mesmas em `v1.5.5`.
  - https://www.remotion.dev/docs/webcodecs/resample-audio-16khz (primária) — comando ffmpeg recomendado e `npx remotion ffmpeg`.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts (primária) — `isWavFile` e o matcher de stderr.

### R04-14 — A partir de v1.7.5 o whisper.cpp decodifica e reamostra sozinho — mas o README não conta isso

- **Verdade operacional:** o release v1.7.5 (2025-04-02) traz *"Use miniaudio for direct decoding flac,
  mp3, ogg and wav by @data-man in .../pull/2759"*. No master, `examples/common-whisper.cpp` inicializa o
  decodificador com
  ```c
  ma_decoder_config_init(ma_format_f32, stereo ? 2 : 1, WHISPER_SAMPLE_RATE)
  ```
  isto é, **pede ao miniaudio f32, N canais, 16 kHz** — o miniaudio converte formato/taxa/canais. As quatro
  mensagens `must be ...` do R04-13 **não existem mais** no master. Só que o `README.md` do master ainda
  diz: *"the whisper-cli example currently runs only with 16-bit WAV files"* e mantém o
  `ffmpeg -i input.mp3 -ar 16000 -ac 1 -c:a pcm_s16le output.wav`.
- **O que separa as duas leituras:** o README não foi atualizado depois do PR #2759. O código é a fonte
  mais nova; o README é a fonte mais lida. Não achei nenhuma nota de release que retire explicitamente o
  requisito — por isso **EM DISPUTA** e não CONFIRMADO. Resolvível em 1 minuto na máquina (ver LEDGER-SEED
  `LS-R04-02`).
- **Como reconferir:**
  ```bash
  ./build/bin/whisper-cli -m models/ggml-base.bin -f teste_48k_stereo.mp3 -oj -ojf
  # se transcrever: miniaudio está fazendo o resample; se falhar: o requisito continua
  ```
- **O que quebra se divergir:** o card de preparação de áudio ganha ou perde um passo de ffmpeg. Se o
  resample interno funcionar, o `-ar 16000` vira redundância — **mas o guarda de extensão `.wav` do
  Remotion continua valendo de qualquer jeito** (R04-13), então o passo de ffmpeg não some do pipeline
  Remotion, só deixa de ser obrigatório num pipeline que chame o binário direto.
- **Fontes** (1 publicador: ggml — duas leituras internas conflitantes):
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/common-whisper.cpp (primária, **a favor**) — miniaudio com `WHISPER_SAMPLE_RATE`; sem mensagens `must be`.
  - `api.github.com/repos/ggml-org/whisper.cpp/releases` → v1.7.5 (primária, **a favor**) — PR #2759.
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/README.md (primária, **contra**) — "runs only with 16-bit WAV files".

### R04-15 — Como se fixa a versão do whisper.cpp

- **Verdade operacional:** `installWhisperCpp({to, version})` faz `git clone https://github.com/ggerganov/whisper.cpp.git`
  e depois `git checkout <ref>`, onde `ref = getIsSemVer(version) ? 'v'+version : version` — ou seja,
  **aceita tanto semver quanto hash de commit**, e a doc confirma: *"This can be either a hash of a
  Whisper.cpp commit or a semantic version of an official release"*. Restrições documentadas:
  *"On Windows, a binary is downloaded. Only semantic version format ... is supported"*, *"On Windows,
  there are no binaries newer than `1.6.0` available"*, *"From `1.7.3` and later, `cmake` is required for
  Whisper.cpp to be built"*. O nome do binário muda por versão:
  ```ts
  let cppBin: string[] = ['main'];
  if (compareVersions(whisperCppVersion, '1.7.4') >= 0) { cppBin = ['whisper-cli']; }
  ```
  Como rodamos Linux, a restrição de Windows não morde; a de `cmake` morde.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/install-whisper-cpp.ts | grep -n "checkout\|whisper-cli\|1.7.4"
  cmake --version
  ```
- **O que quebra se divergir:** o card de bootstrap do ambiente. `cmake` vira dependência de sistema a
  partir de 1.7.3 — isso pertence ao gate de "máquina pronta", não ao código.
- **Fontes** (1 publicador: Remotion):
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/install-whisper-cpp.ts (primária) — clone/checkout e a troca `main`→`whisper-cli`.
  - https://www.remotion.dev/docs/install-whisper-cpp/install-whisper-cpp (primária) — semver ou hash, restrições de Windows e `cmake`.

### R04-16 — Determinismo: o que dá para afirmar hoje

- **Verdade operacional — a metade que fecha:** não existe controle de semente na CLI. Rodei
  `grep -in "seed" cli.cpp` sobre o arquivo inteiro do master: **zero ocorrências** — nem no parser de
  argumentos, nem nas 106 linhas de help. E há pedido de usuário para isso (issue #734, fechada sem
  implementar). Os defaults de amostragem são:
  ```cpp
  int32_t n_threads   = std::min(4, (int32_t) std::thread::hardware_concurrency());
  int32_t best_of     = whisper_full_default_params(WHISPER_SAMPLING_GREEDY).greedy.best_of;
  int32_t beam_size   = whisper_full_default_params(WHISPER_SAMPLING_BEAM_SEARCH).beam_search.beam_size;
  float   temperature = 0.0f;
  float   temperature_inc = 0.2f;
  ```
  e `wparams.temperature_inc = params.no_fallback ? 0.0f : params.temperature_inc;` — ou seja, **o
  fallback de temperatura está ligado por default**: se um segmento reprovar nos thresholds
  (`entropy_thold = 2.40f`, `logprob_thold = -1.00f`), o whisper **re-decodifica com temperatura maior**.
  Isso é uma fonte de variação de saída que não depende de aleatoriedade nenhuma, só de o segmento estar
  na fronteira. Quem quer estabilidade liga `--no-fallback`. O Remotion não liga (só via `additionalArgs`).
- **Verdade operacional — a metade que NÃO fecha:** não achei nenhuma fonte primária do whisper.cpp
  afirmando reprodutibilidade bit-a-bit entre execuções, nem entre contagens de threads, nem entre
  backends. A evidência lateral mais próxima é um PR **draft e não merjado** do llama.cpp (mesma
  organização, outro produto) propondo `GGML_DETERMINISTIC=ON` para CUDA, cujo texto afirma *"CPU is
  already deterministic; other GPU backends unchanged"* — e cuja rejeição por um mantenedor
  (*"I don't want to maintain guarantees for bit-for-bit identical results as the batch size is varied"*)
  mostra que **não há garantia de projeto**. Extrapolar isso para whisper.cpp seria exatamente o tipo de
  dedução que o contrato proíbe. Vai para `LS-R04-03`.
- **Como reconferir:**
  ```bash
  for i in 1 2 3; do ./build/bin/whisper-cli -m models/ggml-medium.bin -f loc.wav -oj -ojf -of out$i --dtw medium; done
  sha256sum out1.json out2.json out3.json
  # e depois, variando threads:
  for t in 1 4 8; do ./build/bin/whisper-cli -m models/ggml-medium.bin -f loc.wav -t $t -oj -ojf -of t$t --dtw medium; done
  sha256sum t1.json t4.json t8.json
  ```
- **O que quebra se divergir:** o gate de "render reproduzível". Se a transcrição não for determinística,
  o `captions.json` precisa virar **artefato versionado** (gerado uma vez, commitado, revisado), não um
  passo recomputado a cada render — senão o vídeo muda sozinho entre execuções e o diff visual perde
  sentido. Isso muda a topologia do pipeline, não um parâmetro.
- **Fontes** (2 publicadores: ggml, e o issue do próprio repo como corroboração fraca):
  - https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/examples/cli/cli.cpp (primária) — defaults, ausência total de `seed`, `no_fallback`.
  - https://github.com/ggml-org/whisper.cpp/issues/734 (primária/fraca) — pedido de semente; reporta saídas diferentes entre execuções, sem resposta técnica de mantenedor na página.
  - https://github.com/ggml-org/llama.cpp/pull/16016 (primária, **produto diferente**) — `GGML_DETERMINISTIC`, draft não merjado; citada apenas como contexto, não como prova sobre whisper.cpp.

### R04-17 — Precisão real medida do timestamp por palavra

- **Verdade operacional:** o único benchmark quantitativo que achei com metodologia publicada é o paper do
  CrisperWhisper (Interspeech 2024). Tabela 1, *"Noise robustness of word segmentation performance on
  synthetic data using a collar of 0.2 seconds"*:
  | Modelo | Sintético F1 | Sintético mIoU | Sintético+ruído F1 | +ruído mIoU |
  |---|---|---|---|---|
  | WhisperT (large-v2 + DTW) | 74,7 | 51,4 | 68,3 | 49,8 |
  | WhisperX (large-v2 + wav2vec2) | 76,7 | 61,5 | 59,0 | 44,3 |
  | CrisperWhisper | 84,7 | 63,4 | 79,5 | 60,5 |
  Leitura operacional brutal: **com uma tolerância de ±200 ms, um quarto das palavras erra**. O dataset
  sintético são "200 samples of spontaneous speech transcripts ... synthesized with ElevenLabs ... with
  timestamps were manually annotated" — ou seja, **fala TTS limpa**, o caso mais fácil possível, e ainda
  assim F1 ≈ 75. O paper também registra o mecanismo: o encoder do Whisper opera em janelas de 25 ms com
  passo de 20 ms, então *"each processed state represents 25 ms of audio, which is shifted by 20 ms
  steps"* — **20 ms é o piso físico de resolução do DTW**, independentemente de `t_dtw` ser reportado em
  centissegundos. E registra que WhisperX degrada mais que DTW sob ruído
  (*"attributable to Wav2Vec2.0's lesser noise resilience"*).
- **Ressalva que impede CONFIRMADO:** "WhisperT" no paper é a implementação DTW do
  `whisper-timestamped` (Python, ref. [22] do paper), **não** a do whisper.cpp. Os números indicam a
  ordem de grandeza da família de métodos, não a acurácia específica do binário que vamos rodar.
- **Como reconferir:** https://www.isca-archive.org/interspeech_2024/zusag24_interspeech.pdf, Tabela 1
  (p. 1268) e Seção 2.1.1 (p. 1266). Localmente: gerar locução TTS com timestamps conhecidos, rodar
  whisper.cpp `--dtw` e medir o erro absoluto por palavra (ver `LS-R04-04`).
- **O que quebra se divergir:** o gate de sincronia de legenda. Se o critério de aceite for "±50 ms",
  **nenhum** desses métodos passa e o card está condenado antes de começar. Um critério realista para ASR é
  ±150–250 ms; para TTS com alinhamento nativo, muito melhor (ver R04-20/21).
- **Fontes** (2 publicadores: ISCA/nyra health, m-bain):
  - https://www.isca-archive.org/interspeech_2024/zusag24_interspeech.pdf (primária acadêmica) — Tabela 1, métricas F1/mIoU, definição de collar, mecânica de 25 ms/20 ms.
  - https://raw.githubusercontent.com/m-bain/whisperX/main/README.md (primária) — descreve o método de alinhamento por wav2vec2 e admite que transcrições diferem do Whisper por causa da segmentação VAD.

### R04-18 — WhisperX: licença, português e limite conhecido

- **Verdade operacional:** licença **BSD-2-Clause** (metadado do GitHub). O dicionário
  `DEFAULT_ALIGN_MODELS_TORCH` cobre só `{en, fr, de, es, it}` via torchaudio; português entra pelo
  `DEFAULT_ALIGN_MODELS_HF` com `"pt": "jonatasgrosman/wav2vec2-large-xlsr-53-portuguese"` — modelo de
  terceiro no Hugging Face, **cuja licença é outra coisa e não foi verificada aqui**. Limitação declarada
  no README: *"Transcript words which do not contain characters in the alignment models dictionary e.g.
  '2014.' or '£13.60' cannot be aligned"* — palavras assim recebem `NaN` e depois `interpolate_nans`.
  Para vídeo técnico em português, isso é exatamente o caso mais comum: números, siglas, `npm`, `useState`,
  `H.264`. Também: *"Overlapping speech is not handled particularly well"*.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py | grep -n -A40 "DEFAULT_ALIGN_MODELS_HF"
  curl -s https://api.github.com/repos/m-bain/whisperX | python3 -c "import sys,json;print(json.load(sys.stdin)['license']['spdx_id'])"
  ```
- **O que quebra se divergir:** o card "alternativa de alinhamento". E, mais importante: **o gate de
  legenda tem que ter um caso de teste com número e identificador de código**, porque é ali que o
  alinhamento por wav2vec2 falha em silêncio (interpola em vez de erro).
- **Fontes** (2 publicadores: m-bain, GitHub API como metadado):
  - https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py (primária) — dicionários de modelo, `pt` presente, tratamento de NaN.
  - https://raw.githubusercontent.com/m-bain/whisperX/main/README.md (primária) — limitações declaradas, backend faster-whisper.
  - `api.github.com/repos/m-bain/whisperX` (primária) — `BSD-2-Clause`, último push 2026-07-13.

### R04-19 — Inventário de alinhadores forçados: a licença do código não é a licença do modelo

- **Verdade operacional:**
  | ferramenta | licença do **código** | licença do **modelo** | português | observação decisiva |
  |---|---|---|---|---|
  | WhisperX | BSD-2-Clause | modelo `pt` é de terceiro no HF (não verificada) | sim, `pt` default | falha em tokens sem letras (R04-18) |
  | faster-whisper | MIT | modelos CTranslate2 convertidos do Whisper (MIT) | sim (multilíngue) | `word_timestamps=True`; último push do repo em 2025-11-19 |
  | stable-ts | MIT | usa modelos Whisper | sim | tem `align()` para texto conhecido, **mas o README diz "Development is currently paused indefinitely"** |
  | Montreal Forced Aligner | MIT (PyPI 3.4.1) | `portuguese_mfa` v2.0.0 **CC BY 4.0** | sim, modelo dedicado | treinado em ≈306 h (CV pt 111,25 h + MLS pt 168,45 h + GlobalPhone pt-BR 26,26 h); WER 6,1% / CER 3,5% |
  | NeMo Forced Aligner | Apache-2.0 | checkpoints NeMo | "14+ languages" | **só modelos CTC** ou híbridos em modo CTC; Transducer puro não serve |
  | ctc-forced-aligner | BSD | modelo default **CC-BY-NC 4.0** | MMS cobre 1130+ idiomas | *"make sure to use a different model for commercial usage"* — a licença do modelo veta comercial |
  O padrão que importa: **duas dessas ferramentas têm o risco jurídico no modelo, não no código.** Um card
  que só verifica `LICENSE` do repositório passa verde e o projeto fica ilegal.
  MFA e NFA são alinhadores **de verdade** (texto conhecido → tempos), que é exatamente o formato do nosso
  problema quando a locução é TTS. WhisperX e stable-ts também expõem alinhamento de texto conhecido
  (`align()`).
- **Como reconferir:**
  ```bash
  curl -s https://pypi.org/pypi/montreal-forced-aligner/json | python3 -c "import sys,json;i=json.load(sys.stdin)['info'];print(i['version'],i['license'])"
  curl -s https://raw.githubusercontent.com/MahmoudAshraf97/ctc-forced-aligner/main/README.md | grep -n -i licen
  curl -s https://raw.githubusercontent.com/NVIDIA-NeMo/NeMo/main/LICENSE | head -3
  mfa model download acoustic portuguese_mfa
  ```
- **O que quebra se divergir:** o card "escolher alinhador" e o gate de compliance. Se o dono usar
  `ctc-forced-aligner` com o modelo default num produto comercial, isso é violação de CC-BY-NC.
- **Fontes** (5 publicadores: MFA, PyPI, NVIDIA, MahmoudAshraf97, jianfch/SYSTRAN):
  - https://mfa-models.readthedocs.io/en/latest/acoustic/Portuguese/Portuguese%20MFA%20acoustic%20model%20v2_0_0.html (primária) — CC BY 4.0, corpora e horas, WER 6,1% / CER 3,5%, `mfa model download acoustic portuguese_mfa`.
  - https://pypi.org/pypi/montreal-forced-aligner/json (primária) — versão 3.4.1, licença MIT.
  - https://raw.githubusercontent.com/NVIDIA-NeMo/NeMo/main/tools/nemo_forced_aligner/README.md (primária) — token/word/segment timestamps, só CTC, áudios de 1h+.
  - https://raw.githubusercontent.com/NVIDIA-NeMo/NeMo/main/LICENSE (primária) — Apache 2.0.
  - https://raw.githubusercontent.com/MahmoudAshraf97/ctc-forced-aligner/main/README.md (primária) — BSD no código, CC-BY-NC 4.0 no modelo default, MMS 1130+ idiomas.
  - https://raw.githubusercontent.com/jianfch/stable-ts/main/README.md (primária) — `align()`, suporte a faster-whisper, desenvolvimento pausado.
  - https://raw.githubusercontent.com/SYSTRAN/faster-whisper/master/README.md (primária) — `word_timestamps=True`, `BatchedInferencePipeline`.

### R04-20 — ElevenLabs: dois caminhos, granularidades diferentes

- **Verdade operacional — e esta é a resposta parcial à pergunta cara do cluster:**
  1. **TTS com timestamps.** `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps`
     devolve `alignment` e `normalized_alignment`, cada um com `characters: string[]`,
     `character_start_times_seconds: number[]`, `character_end_times_seconds: number[]`. É
     **por caractere**, não por palavra — para obter palavras é preciso agrupar os caracteres nos espaços,
     o que é trivial mas é código nosso, não da API. Existe a variante de streaming
     `/stream/with-timestamps`. Anunciado em 2024-05-14.
  2. **Alinhamento forçado.** `POST https://api.elevenlabs.io/v1/forced-alignment` recebe `file` + `text`
     e devolve `characters[]` **e** `words[]`, cada palavra com `text`, `start`, `end` e `loss`
     ("average alignment loss/confidence score for this word"), mais um `loss` global. Limites: arquivo
     < 1 GB (a página de capacidades diz 3 GB e até 10 h de áudio / 675.000 caracteres de texto —
     **as duas páginas do mesmo fornecedor divergem no limite de tamanho**), sem diarização. Cobre 29
     idiomas, com "Portuguese (Brazil, Portugal)" explicitamente listado. Preço declarado: *"Same rate as
     the Speech to Text API"*.
  Consequência de projeto: com ElevenLabs, **um projeto pode ter timestamps por palavra sem rodar ASR
  nenhum** — seja pedindo alinhamento junto com a síntese (caractere→palavra) seja mandando áudio+roteiro
  para o endpoint de alinhamento forçado. É nuvem e é pago; o projeto é declaradamente local. Ver
  `PERGUNTA-DONO`.
- **Como reconferir:** https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps e
  https://elevenlabs.io/docs/api-reference/forced-alignment/create e
  https://elevenlabs.io/docs/overview/capabilities/forced-alignment.
- **O que quebra se divergir:** o card "de onde vêm os tempos das palavras". Se o dono aceitar nuvem para
  o áudio, o card de ASR local pode ser **deletado**, não otimizado.
- **Fontes** (1 publicador: ElevenLabs, 3 artefatos — e com uma inconsistência interna no limite de tamanho):
  - https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps (primária) — schema de `alignment`.
  - https://elevenlabs.io/docs/api-reference/forced-alignment/create (primária) — `words[]` com `start`/`end`/`loss`, arquivo < 1 GB.
  - https://elevenlabs.io/docs/overview/capabilities/forced-alignment (primária) — 29 idiomas com pt-BR, 10 h, 675.000 caracteres, 3 GB, preço = STT.
  - https://elevenlabs.io/blog/new-text-to-speech-endpoints-with-timestamps (primária/anúncio) — data 2024-05-14, "timestamps on when each character was spoken".

### R04-21 — Azure TTS: `WordBoundary` nativo por palavra

- **Verdade operacional:** o SDK de fala da Azure emite, durante a síntese, o evento `WordBoundary`:
  *"Signals that a word boundary was received. This event is raised at the beginning of each new spoken
  word, punctuation, and sentence. The event reports the current word's time offset, in ticks, from the
  beginning of the output audio."* Atributos (referência da classe Python
  `SpeechSynthesisWordBoundaryEventArgs`, atualizada na versão 1.21.0 do SDK):
  | atributo | significado |
  |---|---|
  | `audio_offset` | offset em **ticks**; *"A single tick represents one hundred nanoseconds"* → ms = ticks/10.000 |
  | `duration` | duração do áudio do item |
  | `text` | o texto do item |
  | `text_offset` | posição em caracteres no texto/SSML de entrada |
  | `word_length` | comprimento da palavra em caracteres |
  | `boundary_type` | tipo (palavra/pontuação/sentença) |
  Para boundaries de sentença é preciso setar
  `PropertyId.SpeechServiceResponse_RequestSentenceBoundary = 'true'`. A doc **não** declara restrição de
  voz ou locale para o evento.
- **Como reconferir:** https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis
  (seção de eventos) e a referência da classe no mesmo domínio.
- **O que quebra se divergir:** idem R04-20 — se o TTS for Azure, timestamps por palavra são subproduto
  gratuito da síntese e o card de ASR some.
- **Fontes** (1 publicador: Microsoft, 2 artefatos):
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis (primária) — descrição do evento e exemplos em Python/C#.
  - https://learn.microsoft.com/en-us/python/api/azure-cognitiveservices-speech/azure.cognitiveservices.speech.speechsynthesiswordboundaryeventargs (primária) — lista completa de atributos e unidade de tick.

### R04-22 — Google Cloud TTS: timepoints só via `<mark>`, e só em v1beta1

- **Verdade operacional:** não existe "timestamps por palavra" automático. O que existe é:
  `enableTimePointing` no request (*"Whether and what timepoints are returned in the response"*) com o enum
  `TimepointType` = `{TIMEPOINT_TYPE_UNSPECIFIED, SSML_MARK}`, e a resposta traz
  ```json
  { "markName": string, "timeSeconds": number }
  ```
  `SSML_MARK` significa: *"Timepoint information of `<mark>` tags in SSML input will be returned"*. Isto é,
  para ter tempo por palavra o cliente precisa **gerar SSML envolvendo cada palavra num `<mark>`** e depois
  casar `markName` com a palavra. E tudo isso só está documentado na REST **v1beta1** — a referência v1
  não tem timepoints.
- **Como reconferir:** https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/text/synthesize
  (procurar `enableTimePointing`, `Timepoint`, `TimepointType`) e
  https://docs.cloud.google.com/text-to-speech/docs/ssml (seção `<mark>`).
- **O que quebra se divergir:** se o dono escolher Google TTS, o card de locução ganha um sub-passo de
  "gerar SSML com marks por palavra" e uma dependência de API **beta** — mudança de superfície de risco,
  não de parâmetro.
- **Fontes** (1 publicador: Google, 2 artefatos):
  - https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1beta1/text/synthesize (primária) — `enableTimePointing`, `Timepoint{markName,timeSeconds}`, enum.
  - https://docs.cloud.google.com/text-to-speech/docs/ssml (primária) — uso do `<mark>` e do `TimepointType`.

### R04-23 — OpenAI TTS não devolve alinhamento

- **Verdade operacional:** o tipo `SpeechCreateParams`, **gerado do OpenAPI spec da própria OpenAI**
  ("File generated from our OpenAPI spec"), lista exaustivamente: `input`, `model`, `voice`,
  `instructions`, `response_format`, `speed`, `stream_format`. Não há `timestamp_granularities`,
  `alignment`, `timestamps` nem nada equivalente. O método `create` do recurso `audio.speech` tem retorno
  `_legacy_response.HttpxBinaryResponseContent` — **binário puro**. Por contraste, o cliente da mesma
  biblioteca para **transcrição** (`audio.transcriptions`) tem
  `timestamp_granularities: List[Literal["word", "segment"]]`, com a nota *"`response_format` must be set
  `verbose_json` to use timestamp granularities ... generating word timestamps incurs additional latency.
  This option is not available for `gpt-4o-transcribe-diarize`"*. Ou seja: **a OpenAI dá timestamps por
  palavra no ASR, não no TTS.**
- **Ressalva que impede subir de NÃO VERIFICADO:** a página oficial da API reference
  (`platform.openai.com/docs/api-reference/audio/createSpeech`) devolveu **403** ao fetcher em 2026-08-10,
  então só tenho o SDK oficial como artefato. É evidência positiva de ausência (lista gerada do spec), mas
  de um artefato só.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/audio/speech_create_params.py
  curl -s https://raw.githubusercontent.com/openai/openai-python/main/src/openai/resources/audio/speech.py | grep -n "HttpxBinaryResponseContent"
  ```
- **O que quebra se divergir:** o card de locução, se o TTS escolhido for OpenAI: aí **não há atalho**, o
  alinhamento tem de vir de ASR ou de alinhador forçado.
- **Fontes** (1 publicador: OpenAI, 1 artefato utilizável):
  - https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/audio/speech_create_params.py (primária) — lista exaustiva de parâmetros.
  - https://raw.githubusercontent.com/openai/openai-python/main/src/openai/resources/audio/speech.py (primária, mesmo repo) — retorno binário.
  - https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/audio/transcription_create_params.py (primária, mesmo repo) — `timestamp_granularities` **existe no ASR**, comprovando que a ausência no TTS é intencional e não omissão do SDK.

### R04-24 — TTS locais: Kokoro só dá timestamps em inglês; Piper só dá fonema

- **Verdade operacional — Kokoro (Apache-2.0):** o README lista `lang_code` `'p' => Brazilian Portuguese
  pt-br` entre os suportados. Mas em `kokoro/pipeline.py`, o `Result` é
  ```python
  @dataclass
  class Result:
      graphemes: str
      phonemes: str
      tokens: Optional[List[en.MToken]] = None
      output: Optional[KModel.Output] = None
      text_index: Optional[int] = None
  ```
  e `join_timestamps(tokens, pred_dur)` — que preenche `t.start_ts` / `t.end_ts` — só é chamada quando
  `self.lang_code in 'ab'` (inglês americano/britânico) e há `pred_dur` do modelo. Para os demais idiomas
  o `Result` sai **sem `tokens`**, e portanto **sem timestamps**. Para um projeto em pt-BR, isso é o
  desfecho decisivo: Kokoro sintetiza português, mas **não entrega alinhamento em português**.
- **Verdade operacional — Piper (GPL-3.0):** existe `docs/ALIGNMENTS.md`, com "Experimental support".
  O que ele expõe é *"the number of audio samples for each **phoneme id** used during synthesis"* — via
  `PiperVoice.load(..., include_alignments=True)` (requer `pip install piper-tts[alignment]`) ou
  `python3 -m piper.patch_voice_with_alignment /path/to/model.onnx`. O `AudioChunk` ganha `phonemes`,
  `phoneme_ids`, `phoneme_id_samples`, `phoneme_alignments`. É **por fonema, em contagem de samples** —
  para virar palavra é preciso mapear fonemas→palavras via o G2P (espeak-ng), que é trabalho nosso. E os
  campos "will be empty if the voice doesn't support them". O `docs/CLI.md` não lista **nenhuma** flag de
  alinhamento: a feature é só de API (Python/C++), não de linha de comando.
- **Como reconferir:**
  ```bash
  curl -s https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py | grep -n "join_timestamps\|lang_code in\|start_ts"
  curl -s https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/ALIGNMENTS.md
  curl -s https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/CLI.md
  ```
- **O que quebra se divergir:** o card "locução local + legenda sincronizada". Hoje, com TTS local em
  pt-BR, **não existe caminho pronto de timestamp por palavra**: Kokoro exclui pt, Piper dá fonema
  experimental. Logo, o card de alinhamento (ASR ou forced aligner) **não** pode ser deletado no cenário
  100% local — ao contrário do cenário nuvem (R04-20/21).
- **Fontes** (2 publicadores: hexgrad, OHF-Voice; + GitHub API para licenças):
  - https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py (primária) — `join_timestamps`, guarda `lang_code in 'ab'`.
  - https://raw.githubusercontent.com/hexgrad/kokoro/main/README.md (primária) — lista de `lang_code` com `'p' => Brazilian Portuguese pt-br`, pesos Apache.
  - https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/ALIGNMENTS.md (primária) — alinhamento por phoneme id, "Experimental support", extra `[alignment]`.
  - https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/CLI.md (primária) — lista de flags sem nada de alinhamento.
  - `api.github.com/repos/OHF-Voice/piper1-gpl` e `.../hexgrad/kokoro` (primárias) — GPL-3.0 e Apache-2.0.

---

## 3. Refutações — o que o panorama afirma e não se sustenta

Trechos citados de `Roadmap Editor de Vídeo IA.md`, linhas 93–95 e 164–165.

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| *"requerem que o sistema saiba, com resolução de milissegundos, quando um **fonema** se inicia"* | REFUTADO | O `--dtw` do whisper.cpp dá o instante aproximado de um **token de BPE** (subpalavra), não de um fonema. O comentário no header é literal: *"Roughly corresponds to the moment in audio in which the token was output"*. O piso físico é a grade do encoder: janelas de 25 ms com passo de **20 ms**; `t_dtw` é reportado em centissegundos (10 ms). Alinhamento por fonema existe — é MFA/NFA/Piper —, não whisper.cpp. | https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h ; https://www.isca-archive.org/interspeech_2024/zusag24_interspeech.pdf |
| *"A extração produzirá a chave quantitativa t_dtw, que estipula o **instante microscópico**"* | REFUTADO | Existe, mas "microscópico" é falso por duas ordens de grandeza. Resolução reportada: 10 ms; resolução do mecanismo: 20 ms; erro medido: com collar de **200 ms**, F1 ≈ 74,7 em fala TTS limpa. | https://raw.githubusercontent.com/ggml-org/whisper.cpp/master/include/whisper.h ; https://www.isca-archive.org/interspeech_2024/zusag24_interspeech.pdf |
| *"createTikTokStyleCaptions(). Este método **protege os limites da área visual (bounding boxes)** quebrando longas extensões de vocabulário em sucessivas páginas limpas, **nunca permitindo aglomeração (overflow)** no quadro"* | REFUTADO | A função segmenta **exclusivamente por tempo** (`combineTokensWithinMilliseconds`) e por espaço em branco no início do `text`. Não recebe largura, fonte, viewport nem contagem de caracteres; não pode saber de overflow. O que existe para caracteres por linha é `ensureMaxCharactersPerLine`, exportado **apenas** dentro de `CaptionsInternals` — não é API pública nem é chamada por `createTikTokStyleCaptions`. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/create-tiktok-style-captions.ts ; https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/index.ts |
| *"Atribuir esta chave extraída (t_dtw) que flui do objeto Caption do Remotion para orquestrar transições em componentes de destaque"* | EM DISPUTA / meia-verdade | O `t_dtw` chega ao `Caption` — em `timestampMs`. Mas o utilitário que "orquestra" as páginas (`createTikTokStyleCaptions`) **não lê `timestampMs`**: usa `startMs`/`endMs`, que vêm de `offsets`. Sem um passo próprio de reancoragem, o DTW é computado e descartado. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/captions/src/create-tiktok-style-captions.ts ; https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/to-captions.ts |
| *"sugere-se 16kHz a 16-bit para consistência de modelos **base.en ou medium**"* | REFUTADO (para este projeto) | `base.en` é modelo **somente inglês** — o sufixo `.en` marca isso na lista de modelos do próprio pacote (`tiny.en`, `base.en`, `small.en`, `medium.en`). Para locução em pt-BR, `base.en` transcreve errado ou traduz. A skill oficial do Remotion recomenda `medium.en`, que tem o mesmo problema. Modelo multilíngue é obrigatório aqui: `medium`, `large-v3` ou `large-v3-turbo` (este último exigindo whisper.cpp ≥ 1.7.2). | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/download-whisper-model.ts ; https://raw.githubusercontent.com/remotion-dev/skills/main/skills/remotion-best-practices/remotion-captions/transcribe-captions.md |
| *"tokenLevelTimestamps: true força a ativação algorítmica"* (implicando que é opcional) | EM DISPUTA / meia-verdade | O parâmetro é **obrigatório** na assinatura (não tem `?`), e `toCaptions()` só aceita `TranscriptionJson<true>`. Não é uma otimização que se liga: no caminho Remotion→captions é o único caminho tipado. Além disso, ligá-lo **também** força `--max-len 1`, o que muda a granularidade do JSON inteiro — efeito colateral não documentado na página. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/install-whisper-cpp/src/transcribe.ts |
| *"(sem dependência de nuvem): Whisper.cpp"* como único caminho para timestamp por palavra | REFUTADO como exclusividade | Se a locução for gerada por TTS, o texto é conhecido a priori e o problema correto é **alinhamento forçado**, não ASR. Existem ≥5 caminhos que não são whisper.cpp, dois deles sem ASR nenhum (Azure `WordBoundary` e ElevenLabs `/with-timestamps` entregam tempos como subproduto da síntese). O que **não** existe hoje é atalho local em pt-BR (Kokoro exclui pt, Piper dá fonema experimental). | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis ; https://elevenlabs.io/docs/api-reference/forced-alignment/create ; https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py |
| Referências 37–40 do panorama tratadas como leitura suficiente | Nota, não refutação | As quatro URLs existem (200). Mas `https://www.remotion.dev/docs/captions/caption` respondeu **404 ao fetcher HTTP** e 200 ao `curl` na mesma data — ou seja, é frágil como fonte automatizada. Nenhuma das quatro documenta o `--max-len 1` implícito nem o descarte de `timestampMs` pela paginação. | verificado com `curl -o /dev/null -w '%{http_code}'` nas quatro URLs em 2026-08-10 |

---

## 4. Armadilhas (falso verde deste domínio)

- **Ligar `tokenLevelTimestamps: true` e achar que a legenda ficou precisa** → o valor de DTW entra só em
  `timestampMs`, e `createTikTokStyleCaptions()` nunca lê esse campo → *fica vermelho se sumir:* um teste
  que gere `Caption[]` com `timestampMs` propositalmente deslocado de `startMs` em +300 ms e afirme que a
  página renderizada mudou. Hoje esse teste **falha**, e é isso que ele precisa provar.

- **Rodar transcrição uma vez, ver batendo, e chamar de determinístico** → o `whisper-cli` tem fallback de
  temperatura ligado por default (`temperature_inc = 0.2f`, só desligado com `--no-fallback`), e não expõe
  semente → *fica vermelho se sumir:* três execuções seguidas com `sha256sum` do JSON no gate de CI. Se os
  hashes divergirem, `captions.json` tem de virar artefato versionado.

- **Testar com áudio limpo em inglês** → o benchmark mostra que WhisperX cai de F1 76,7 para 59,0 só com
  ruído, e o modelo `.en` é o default da doc → *fica vermelho se sumir:* uma fixture de locução em pt-BR
  contendo número (`H.264`), sigla (`FFmpeg`) e identificador de código (`useCurrentFrame`). É exatamente
  a classe de token que o alinhamento por wav2vec2 declara não conseguir alinhar.

- **Confiar no README do whisper.cpp sobre formato de áudio** → o README ainda diz "16-bit WAV files" mas o
  código do master usa miniaudio e reamostra → *fica vermelho se sumir:* um teste que passe um `.mp3`
  48 kHz estéreo direto ao binário instalado e registre o desfecho no ledger. Note que o guarda de extensão
  do Remotion continua rejeitando `.mp3` independentemente disso.

- **Tratar `timestampMs` como `number`** → é `number | null`, e `toCaptions()` devolve `null` sempre que
  `t_dtw === -1` (DTW não computado para aquele token) → *fica vermelho se sumir:* asserção no
  normalizador de legenda de que nenhum `timestampMs` é `null`, ou um fallback explícito.

- **Verificar licença só do repositório do alinhador** → `ctc-forced-aligner` é BSD no código e CC-BY-NC 4.0
  no modelo default; o modelo `pt` do WhisperX é de terceiro no Hugging Face → *fica vermelho se sumir:*
  uma linha no gate de compliance que exija a licença **do peso do modelo**, não só do pacote.

- **Assumir que "TTS local resolve o alinhamento"** → Kokoro tem `join_timestamps` guardado por
  `lang_code in 'ab'`; em pt-BR o `Result` sai sem `tokens` → *fica vermelho se sumir:* um teste que
  sintetize uma frase em pt-BR com Kokoro e afirme `result.tokens is not None`. Hoje ele falha, e essa
  falha é a justificativa do card de alinhamento.

- **Pinar `1.5.5` porque a doc do Remotion usa isso no exemplo** → 1.5.5 é de abril/2024 e não tem o preset
  `large.v3.turbo` (só a partir de 1.7.2) nem o binário `whisper-cli` (só a partir de 1.7.4) → *fica
  vermelho se sumir:* o pin de versão como constante única no repo, com um teste que roda
  `whisper-cli --help | grep dtw` e valida que o preset do modelo escolhido está na lista aceita.

- **Confundir `large-v3-turbo` (modelo) com `large.v3.turbo` (preset DTW)** → são strings diferentes e o
  binário aborta com `unknown DTW preset` → *fica vermelho se sumir:* usar `modelToDtw()` do Remotion, ou
  replicar a tabela de tradução com teste de tabela.

- **Achar que `serializeSrt(captions)` funciona** → a assinatura é `{lines: Caption[][]}`; passar um array
  simples produz um bloco de SRT por palavra → *fica vermelho se sumir:* um round-trip
  `parseSrt(serializeSrt(...))` no teste (que, aliás, **não** é lossless: `parseSrt` fabrica
  `confidence: 1` e `timestampMs` no ponto médio).

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-R04-01 | `createTikTokStyleCaptions` da versão realmente instalada ignora `timestampMs`? | Assumir que sim e escrever o passo de reancoragem | `grep -rn "timestampMs" node_modules/@remotion/captions/dist/ \| grep -i tiktok` | Se ela passar a usar, o passo de reancoragem vira duplicação e desloca a legenda |
| LS-R04-02 | A versão pinada de whisper.cpp aceita `.mp3`/48 kHz/estéreo sem ffmpeg? | Assumir que **não** e manter o passo de ffmpeg | `ffmpeg -i loc.wav -ar 48000 -ac 2 t.mp3 -y && ./build/bin/whisper-cli -m models/ggml-medium.bin -f t.mp3 -oj` | Se aceitar, o passo de ffmpeg vira opcional (mas o guarda `.wav` do Remotion continua) |
| LS-R04-03 | Duas execuções no mesmo WAV dão JSON idêntico? E variando `-t`? | Assumir **não determinístico** e versionar `captions.json` | `for i in 1 2 3; do ./build/bin/whisper-cli -m M -f loc.wav -oj -ojf -of o$i --dtw medium; done; sha256sum o*.json` e depois `-t 1/4/8` | Se for determinístico, `captions.json` pode ser derivado em vez de versionado — muda a topologia do pipeline |
| LS-R04-04 | Qual o erro absoluto por palavra do `--dtw` **nesta** locução pt-BR e neste modelo? | Assumir mediana ~100–200 ms até medir | Gerar locução TTS com timestamps conhecidos → rodar whisper `--dtw` → medir `abs(t_dtw*10 - t_tts)` por palavra; publicar p50/p90 | Define o limiar do gate de sincronia. Se p90 > 250 ms, legenda palavra-a-palavra não passa e vira legenda por frase |
| LS-R04-05 | Quanto tempo e RAM custa `medium` vs `large-v3-turbo` com `--dtw` nesta máquina? | Assumir `medium` como default | `time ./build/bin/whisper-cli -m models/ggml-medium.bin --dtw medium -f loc.wav` e idem turbo | Decide o modelo default do card de transcrição e se cabe no loop de iteração do agente |
| LS-R04-06 | `cmake` está disponível para build de whisper.cpp ≥ 1.7.3? | Assumir que sim | `cmake --version` | Se faltar, `installWhisperCpp` falha no bootstrap; vira dependência de sistema documentada |
| LS-R04-07 | `--no-fallback` muda a saída na nossa locução? | Assumir que não muda o texto mas estabiliza | Rodar com e sem `--no-fallback` via `additionalArgs` e diffar o JSON | Se estabilizar sem perder qualidade, vira default do card |
| LS-R04-08 | O `.wav` produzido pelo TTS local é pcm_s16le 16 kHz? | Assumir que **não** e sempre passar por ffmpeg | `ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,sample_fmt -of default=nw=1 loc.wav` | Se o TTS já entregar no formato, o passo de conversão sai do caminho quente |
| LS-R04-09 | Alinhamento forçado (MFA `portuguese_mfa` ou ctc-forced-aligner) bate melhor que whisper `--dtw` na nossa locução? | Assumir que sim, porque o texto é conhecido | Alinhar o mesmo WAV+roteiro pelos dois e comparar p50/p90 contra os tempos do TTS | Se bater melhor, o card de ASR vira card de alinhamento e o modelo grande de Whisper sai do pipeline |
| LS-R04-10 | O modelo `pt` do WhisperX (`jonatasgrosman/wav2vec2-large-xlsr-53-portuguese`) tem licença compatível? | Não assumir nada | Abrir o model card no Hugging Face e ler o campo de licença | Bloqueia ou libera o caminho WhisperX para uso comercial |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| A locução vai ser gerada por TTS ou gravada por voz humana? | É decisão de produto e de custo, não fato técnico | **TTS:** o texto é conhecido a priori → alinhamento forçado, ou timestamps nativos do TTS, e o ASR pode sair do pipeline. **Humana:** ASR é obrigatório e o roteiro serve no máximo como *initial prompt* |
| O pipeline pode chamar nuvem para o áudio, ou "roda LOCALMENTE" é regra dura? | É mandato do dono | **Nuvem permitida:** Azure `WordBoundary` ou ElevenLabs `/forced-alignment` dão palavra com precisão muito acima do ASR, e o card de whisper.cpp vira fallback offline. **Local obrigatório:** não há atalho em pt-BR hoje (R04-24) — o card de alinhamento é inevitável |
| Qual é o critério de aceite de sincronia da legenda em milissegundos? | Depende do apetite estético do dono; não há número "correto" | **±50 ms:** nenhum método de ASR passa; obriga TTS com alinhamento nativo ou legenda por frase. **±150–250 ms:** whisper `--dtw` ou alinhador forçado servem. **Sem critério:** o gate vira inspeção visual e o card não fecha |
| O produto é comercial e a empresa se enquadra na Company License do Remotion? | Termo jurídico + porte da entidade | Decide se `@remotion/install-whisper-cpp` (não-MIT) pode ser usado, ou se o projeto chama whisper.cpp direto e usa só `@remotion/captions` (MIT) |
| Uso comercial? (para a escolha do alinhador) | Depende do destino do vídeo | Se sim, `ctc-forced-aligner` com o modelo default (CC-BY-NC 4.0) está fora, e o modelo `pt` do WhisperX precisa de checagem de licença |
| A legenda é palavra-a-palavra (estilo TikTok) ou por frase? | Escolha estética que determina a exigência técnica | **Palavra-a-palavra:** exige timestamp por palavra confiável, gate apertado, e o passo de reancoragem em `timestampMs`. **Por frase:** os `offsets` de segmento bastam e metade deste cluster deixa de condicionar cards |
| Idioma da locução é só pt-BR, ou também inglês? | Escopo de produto | Só pt-BR elimina todos os modelos `.en` e elimina Kokoro como fonte de timestamps. Bilíngue reabre `medium.en`/`large-v3-turbo` e o Kokoro para as partes em inglês |
| Aceita fixar `captions.json` como artefato versionado no git? | É decisão de processo (revisão humana da transcrição) | **Sim:** determinismo deixa de ser problema e a transcrição vira revisável. **Não:** `LS-R04-03` vira bloqueante e o render deixa de ser reproduzível bit-a-bit |

---

## 7. Recomendação para o roadmap

**Ponto de troca barata.** A escolha de *de onde vêm os tempos das palavras* deve ficar atrás de **uma
função e um arquivo**: algo como `src/captions/source.ts` exportando
`getWordTimings(audioPath, script): Promise<Caption[]>`. Hoje a implementação é whisper.cpp `--dtw`; amanhã
pode ser alinhamento forçado (MFA/NFA) ou os timestamps nativos do TTS. **Custo da reversão: 1 arquivo, e
o `captions.json` continua sendo o mesmo formato.** O que **não** pode ficar atrás dessa fronteira é o
`Caption[]` do Remotion — esse é o formato de intercâmbio e deve ser tratado como contrato.

O segundo ponto de troca barata é o **pin de versão do whisper.cpp**: uma constante única
(`WHISPER_CPP_VERSION`), usada por `installWhisperCpp()` e por `transcribe()`. Custo da reversão: 1
variável — mas só se ninguém espalhar `'1.5.5'` como literal pelos cards. Recomendação de valor:
**não pinar 1.5.5**; pinar ≥ 1.7.4 (binário `whisper-cli`, preset turbo disponível, `cmake` já exigido) e
registrar a escolha no ledger com o motivo.

**Ordem de investigação recomendada** (não é ordem de implementação):
1. Fechar `PERGUNTA-DONO` "TTS ou voz humana?" e "nuvem permitida?". Essas duas respostas podem **apagar**
   o card de ASR inteiro. Nenhum trabalho de ASR deve começar antes delas.
2. Se TTS + nuvem permitida → o alinhamento é subproduto da síntese (Azure `WordBoundary`, ElevenLabs
   `/with-timestamps` ou `/forced-alignment`). Card de ASR vira fallback.
3. Se TTS + local obrigatório → **alinhamento forçado, não ASR**. Rodar `LS-R04-09` comparando MFA
   `portuguese_mfa` contra whisper `--dtw` na mesma locução. O texto é conhecido; usar ASR para redescobrir
   um texto que já temos é desperdício e é a fonte de erro.
4. Só se a voz for humana o whisper.cpp `--dtw` é o caminho principal — e aí o card carrega,
   obrigatoriamente, o passo de reancoragem em `timestampMs` (R04-08) e o gate de `LS-R04-04`.

**Skills que devem carregar este conhecimento:**
- a skill de **legendas/captions** (contrato de whitespace do `createTikTokStyleCaptions`, `Caption[]` como
  formato de intercâmbio, `serializeSrt` recebendo `Caption[][]`, `timestampMs` nullable);
- a skill de **transcrição/ASR** (pin de versão ≥ 1.7.4, `--max-len 1` implícito, tabela
  modelo→preset DTW, proibição de modelos `.en` em pt-BR, `--no-fallback`);
- a skill de **áudio/ffmpeg** (`-ar 16000`, pcm_s16le, `-ac 1` como higiene e não requisito, `ffprobe`
  como verificação);
- a skill de **licenças/compliance** (licença do modelo ≠ licença do código; `@remotion/install-whisper-cpp`
  não é MIT).

**Cards que este cluster condiciona:**
- *Preparar áudio para transcrição*: converter locução para WAV pcm_s16le 16 kHz; verificar com `ffprobe`;
  fixture obrigatória com número, sigla e identificador de código em pt-BR.
- *Instalar e pinar whisper.cpp*: constante única de versão; validar que o preset DTW do modelo escolhido
  está na lista aceita pelo binário instalado; registrar `cmake` como dependência de sistema.
- *Transcrever para `Caption[]`*: `tokenLevelTimestamps: true` obrigatório; modelo multilíngue; tratar
  `timestampMs === null`.
- *Reancorar `Caption[]` em `timestampMs`* — **card novo que só existe por causa de R04-08.** Sem ele, o
  DTW é computado e jogado fora.
- *Paginar legenda*: `createTikTokStyleCaptions` com `combineTokensWithinMilliseconds` parametrizado;
  preservar espaço à esquerda; `white-space: pre` no componente; **quebra de linha por largura é trabalho
  nosso**, a função não faz isso.
- *Gate de sincronia de legenda*: limiar em ms vindo da `PERGUNTA-DONO`; medição p50/p90 de `LS-R04-04`.
- *Gate de reprodutibilidade*: três execuções + `sha256sum`; decidir se `captions.json` é derivado ou
  versionado.
- *Gate de compliance de modelo*: checar licença do peso, não só do pacote.
- *Spike de alinhamento forçado* (condicional a TTS): MFA `portuguese_mfa` vs whisper `--dtw`, com a
  métrica de `LS-R04-09`.
