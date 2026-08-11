# R13 — TTS / locução: qualidade, determinismo, timestamps e licença

**Escopo desta pesquisa:** responde *quais motores de TTS devolvem timing junto com o áudio* (e
portanto dispensam o passo de ASR/alinhamento), qual o regime de licença/determinismo/pt-BR de
cada um, e quanto custa. **Não** responde qual voz "soa melhor" (isso é gosto do dono e teste
local), nem mede latência/qualidade nesta máquina.

> **Regra de contagem que apliquei** (mais dura que o contrato, de propósito): conto por
> *hostname*, e **claim sustentado só por documentação do próprio fornecedor nunca passa de
> `PROVÁVEL`**, mesmo com 3 hostnames do mesmo dono. `CONFIRMADO` exige ≥3 fontes com ≥2
> organizações distintas (fornecedor + independente). Onde escrevi `NÃO VERIFICADO` com uma doc
> oficial forte atrás, eu digo isso na linha — não é o mesmo que "não achei nada".
>
> **Data de coleta: 2026-08-10.** Preços e listas de vozes de API são o item que apodrece mais
> rápido deste arquivo.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R13-01 | ElevenLabs expõe `POST /v1/text-to-speech/{voice_id}/with-timestamps`, que devolve `audio_base64` + `alignment` com `characters` / `character_start_times_seconds` / `character_end_times_seconds` — timing por **caractere**, não por palavra. | (3-0) | CONFIRMADO | https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps |
| R13-02 | Cartesia Sonic (WebSocket) aceita `add_timestamps` e `add_phoneme_timestamps` e devolve mensagens `type:"timestamps"` com `word_timestamps.{words,start,end}` e `type:"phoneme_timestamps"` com `phoneme_timestamps.{phonemes,start,end}`, em segundos. | (3-0) | CONFIRMADO | https://docs.cartesia.ai/api-reference/tts/websocket |
| R13-03 | Amazon Polly devolve *speech marks* dos tipos `sentence \| word \| viseme \| ssml` via `SpeechMarkTypes`, em JSON line-delimited, e **na requisição de marks não sai áudio** (`OutputFormat=json`; "No audio output is generated with the request"). | (2-0) | PROVÁVEL | https://docs.aws.amazon.com/polly/latest/dg/using-speechmarks.html |
| R13-04 | O engine `generative` do Polly **não** gera speech marks ("Support for generating speech marks is currently not available"); a única voz generativa pt-BR é `Camila`. | (2-0) | PROVÁVEL | https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html |
| R13-05 | O Google Cloud TTS só oferece timing por `<mark>` de SSML: `enable_time_pointing = [SSML_MARK]` na **v1beta1**, devolvendo `Timepoint{mark_name, time_seconds}`; não existe timing por palavra nativo. | (2-0) | PROVÁVEL | https://github.com/googleapis/googleapis/blob/master/google/cloud/texttospeech/v1beta1/cloud_tts.proto |
| R13-06 | As vozes **Studio** do Google suportam SSML *exceto* `<mark>` — logo Studio não produz timepoint algum. | (1-0) | NÃO VERIFICADO (doc oficial única) | https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types |
| R13-07 | A documentação do Google **se contradiz** sobre SSML em Chirp 3: HD: `list-voices-and-types` diz "Chirp 3: HD voices doesn't support SSML input", enquanto `chirp3-hd` lista `<speak> <say-as> <p> <s> <phoneme> <sub> <break> <audio> <prosody> <voice>` como suportados em requisições síncronas. | (1-1) | EM DISPUTA | https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd |
| R13-08 | O Azure Speech SDK emite `WordBoundary` (campos `AudioOffset` em ticks de 100 ns, `Duration`, `Text`, `TextOffset`, `WordLength`, `BoundaryType ∈ {Word, Punctuation, Sentence}`), `VisemeReceived` (`AudioOffset`, `VisemeId` 0–21, `Animation`) e `BookmarkReached` para `<bookmark>`. | (2-0) | PROVÁVEL | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis |
| R13-09 | Nas vozes HD do Azure, `<bookmark>` e `<mstts:viseme>` são **não suportados** nos dois modelos (DragonHD e Dragon HD Omni); word boundary é declarado só para **Dragon HD Omni**. | (1-0) | NÃO VERIFICADO (doc oficial única) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices |
| R13-10 | O `POST /v1/audio/speech` da OpenAI aceita apenas `model, input, voice, instructions, response_format, speed, stream_format` — **não há** parâmetro de seed nem de timestamp/alinhamento na referência. | (2-0) | PROVÁVEL | https://developers.openai.com/api/docs/api-reference/audio/createSpeech |
| R13-11 | Hume (Octave) devolve timestamps por palavra e por fonema via `include_timestamp_types: ["word","phoneme"]` com `"version": "2"`, em `synthesize_json_streaming` e no WebSocket; tempos em ms (`time.begin` / `time.end`); fonemas em IPA. | (1-0) | NÃO VERIFICADO (doc oficial única) | https://dev.hume.ai/docs/text-to-speech-tts/timestamps |
| R13-12 | O `kokoro` (Python) atribui `start_ts` / `end_ts` por token dentro de `KPipeline.join_timestamps`, ou seja: **um modelo local Apache-2.0 já devolve timing sem ASR**. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py |
| R13-13 | Kokoro-82M é Apache-2.0, 82 M de parâmetros, e `lang_code='p'` é Brazilian Portuguese, resolvido por `EspeakG2P(language='pt-br')` (sem G2P dedicado como o inglês tem). | (2-0) | PROVÁVEL | https://huggingface.co/hexgrad/Kokoro-82M |
| R13-14 | O pt-BR do Kokoro tem exatamente 3 vozes (`pf_dora`, `pm_alex`, `pm_santa`) e o VOICES.md **não publica nota de qualidade nem horas de treino** para elas, ao contrário de outros idiomas. | (1-0) | NÃO VERIFICADO (doc oficial única) | https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md |
| R13-15 | ElevenLabs expõe `seed` (inteiro 0–4294967295) mas a própria referência diz: "our system will make a best effort to sample deterministically… **Determinism is not guaranteed**". | (1-0) | NÃO VERIFICADO (doc oficial única) | https://elevenlabs.io/docs/api-reference/text-to-speech/convert |
| R13-16 | O Polly avisa que atualizações de modelo/dados **mudam o som** das vozes generativas ao longo do tempo ("could result in slight variations to the way the voices sound"), o que quebra reprodutibilidade entre datas. | (1-0) | NÃO VERIFICADO (doc oficial única) | https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html |
| R13-17 | As vozes HD do Azure têm `temperature` (default 1.0 em DragonHD, 0.7 em Omni) e Omni ainda tem `top_p`, `top_k`, `cfg_scale` — o modelo é amostrado, e a doc diz que HD introduz "slight variations in each output" **por design**. | (1-0) | NÃO VERIFICADO (doc oficial única) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices |
| R13-18 | Preços por 1 M de caracteres (2026-08-10): Polly standard **$4.00**, neural **$16.00**, generative **$30**, long-form **$100.00**; OpenAI `tts-1` **$15.00 / 1M characters**, `tts-1-hd` **$30.00 / 1M characters**, `gpt-4o-mini-tts` **$0.60/1M tokens de texto + $12.00/1M tokens de áudio**. | (2-0) | PROVÁVEL | https://aws.amazon.com/polly/pricing/ · https://developers.openai.com/api/docs/pricing |
| R13-19 | ElevenLabs publica preço de API por 1 K de caracteres: **$0.05** (Flash/Turbo) e **$0.10** (Multilingual v2/v3) — ou seja ~**$50 / $100 por 1 M de caracteres** no varejo, 3–6× o Polly neural. | (1-0) | NÃO VERIFICADO (doc oficial única) | https://elevenlabs.io/pricing/api |
| R13-20 | Os pesos do XTTS-v2 estão sob **Coqui Public Model License** (campo `license: coqui-public-model-license` no model card), enquanto o código do Coqui TTS é MPL-2.0 — código e pesos têm licenças diferentes. | (2-0) | PROVÁVEL | https://huggingface.co/coqui/XTTS-v2 |
| R13-21 | Licenças dos modelos locais checadas no artefato oficial: Kokoro-82M **apache-2.0**; Chatterbox (resemble-ai) **MIT**; Dia-1.6B **Apache-2.0**; Sesame CSM-1B **Apache-2.0**; Orpheus 3B ft **apache-2.0** (repo *gated*); OpenAudio S1-mini **cc-by-nc-sa-4.0**; F5-TTS código **MIT** mas checkpoints **CC-BY-NC**; piper-voices **MIT**; `piper1-gpl` (OHF-Voice) **GPL-3.0**. | (2-0) | PROVÁVEL | https://huggingface.co/nari-labs/Dia-1.6B · https://github.com/resemble-ai/chatterbox |
| R13-22 | Chatterbox embute marca d'água neural **Perth** em *todo* áudio gerado, e o Dia-1.6B pede ~10 GB de VRAM e só gera inglês, com voz diferente a cada execução salvo seed/áudio-prompt fixos. | (2-0) | PROVÁVEL | https://huggingface.co/nari-labs/Dia-1.6B |
| R13-23 | Caminho de voz humana + alinhamento existe com fonte pt-BR real: ElevenLabs **Forced Alignment** (29 idiomas incl. "Portuguese (Brazil…)", até 3 GB / 10 h / 675.000 caracteres, cobrado como Speech-to-Text) e, local, WhisperX (`"pt": "jonatasgrosman/wav2vec2-large-xlsr-53-portuguese"`) e MFA (3 modelos acústicos portugueses, dialetos Brazil/Portugal, CC-0 e CC BY 4.0). | (3-0) | CONFIRMADO | https://elevenlabs.io/docs/overview/capabilities/forced-alignment · https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py · https://mfa-models.readthedocs.io/en/latest/acoustic/Portuguese/index.html |
| R13-24 | Consentimento de voz é obrigação contratual explícita em pelo menos três fornecedores: ElevenLabs pede confirmação de "the right and consent to clone the voice"; OpenAI exige *consent recording* do locutor + limite de 20 vozes por organização e **disclosure ao usuário final** de que a voz é IA; Sesame CSM proíbe "speech that mimics real individuals without their explicit consent". | (3-0) | CONFIRMADO | https://developers.openai.com/api/docs/guides/text-to-speech · https://huggingface.co/sesame/csm-1b · https://elevenlabs.io/docs/product-guides/voices/voice-cloning/instant-voice-cloning |
| R13-25 | O Azure tem um botão específico para o problema de siglas/termos técnicos: `parameters="enhancePronunciation=true"` nas vozes NeuralHD, e o exemplo oficial usa literalmente a palavra **Kubernetes**; a doc avisa que "For deterministic pronunciation control, SSML pronunciation elements remain the recommended approach". | (1-0) | NÃO VERIFICADO (doc oficial única) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices |

---

## 2. Detalhe por claim

### R13-01 — ElevenLabs devolve alinhamento por caractere, não por palavra
- **Verdade operacional:** o endpoint devolve três arrays paralelos (`characters`,
  `character_start_times_seconds`, `character_end_times_seconds`) mais `normalized_alignment`
  (o mesmo, sobre o texto já normalizado — números por extenso, siglas expandidas). Palavra é
  **derivada** acumulando caracteres até o espaço; é isso que o Pipecat faz em
  `calculate_word_times()`. `normalized_alignment` é o que casa com o áudio; `alignment` é o que
  casa com o seu texto de entrada — se você quiser destacar a palavra no seu roteiro, precisa dos
  dois e de um mapeamento entre eles.
- **Como reconferir:**
  `curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE/with-timestamps" -H "xi-api-key: $XI" -H "content-type: application/json" -d '{"text":"Kubernetes escala PostgreSQL.","model_id":"eleven_multilingual_v2"}' | jq '.alignment | keys, (.characters|length)'`
- **O que quebra se divergir:** o estágio "locução (TTS) → `audio/<hash>.wav` + `timing.json`"
  do PROGRAMA passa a precisar de ASR; o card do `<HighlightText />` palavra-a-palavra perde a
  fonte de verdade; o schema de `timing.json` precisa de um campo por caractere, não por palavra.
- **Fontes:**
  - https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps (primária) — endpoint, request (`seed`, `model_id`, `language_code` "not supported for multilingual_v2 models", `apply_text_normalization ∈ {auto,on,off}`) e schema de resposta.
  - https://reference-server.pipecat.ai/en/stable/api/pipecat.services.elevenlabs.tts.html (secundária, independente) — `calculate_word_times(alignment_info, cumulative_time) -> list[tuple[str, float]]`, deriva palavra de caractere e trata palavra partida entre chunks.
  - https://docs.livekit.io/agents/models/tts/elevenlabs/ (secundária, independente) — parâmetro `sync_alignment`: "Whether to return word-level alignment data with each audio chunk".

### R13-02 — Cartesia devolve timestamps por palavra E por fonema
- **Verdade operacional:** é o único fornecedor de API comercial que achei que entrega
  **palavra e fonema** no mesmo stream, sem SSML, sem passo extra e sem cobrança separada.
  `pt` está na lista de idiomas do `sonic-3`. Os campos vêm como arrays paralelos
  (`words[]`, `start[]`, `end[]`), em segundos.
- **Como reconferir:** abrir `wss://api.cartesia.ai/tts/websocket`, enviar o payload com
  `"add_timestamps": true, "add_phoneme_timestamps": true`, e confirmar que chegam mensagens
  `{"type":"timestamps"}` e `{"type":"phoneme_timestamps"}` intercaladas com o áudio.
- **O que quebra se divergir:** morre a hipótese de "um único fornecedor cobre highlight de
  palavra *e* boca/viseme"; o card de sincronia fonética (se existir) volta para MFA.
- **Fontes:**
  - https://docs.cartesia.ai/api-reference/tts/websocket (primária) — campos e shapes literais; lista de idiomas com `pt`.
  - https://docs.livekit.io/agents/models/tts/cartesia/ (secundária, independente) — repete `add_timestamps` / `add_phoneme_timestamps` e lista `cartesia/sonic-3` com 43+ idiomas incl. `pt`.
  - https://reference-server.pipecat.ai/en/stable/api/pipecat.services.cartesia.tts.html (secundária, independente) — "Supports word-level timestamps".

### R13-03 / R13-04 — Polly: speech marks existem, mas não no engine que soa melhor
- **Verdade operacional:** `word` + `viseme` + `ssml` (marca `<mark>`) + `sentence`, com `time`
  em ms, `start`/`end` em **offset de bytes** do texto de entrada (não caracteres — texto pt-BR
  com acento tem byte ≠ caractere em UTF-8; isso é uma armadilha real). Você paga **duas**
  chamadas: uma `OutputFormat=json` para os marks, outra `OutputFormat=mp3|pcm` para o áudio,
  ambas cobradas por caractere. E o engine `generative` — o único que soa moderno — **não tem**
  speech marks. Em pt-BR isso significa: ou você usa `neural` (Camila/Vitória/Thiago/Ricardo)
  com marks, ou usa `generative` (só Camila) sem marks.
- **Como reconferir:**
  `aws polly synthesize-speech --engine neural --voice-id Camila --language-code pt-BR --output-format json --speech-mark-types '["word","viseme"]' --text 'Kubernetes escala PostgreSQL' out.json`
  e o mesmo com `--engine generative` (espera-se erro / ausência de marks).
- **O que quebra se divergir:** o custo do estágio de locução dobra silenciosamente (2 chamadas);
  e se alguém escrever um card "usar Polly generative com timing", ele não existe.
- **Fontes:**
  - https://docs.aws.amazon.com/polly/latest/dg/using-speechmarks.html (primária) — os 4 tipos, `--speech-mark-types='["sentence","word","viseme","ssml"]'`.
  - https://docs.aws.amazon.com/polly/latest/dg/API_SynthesizeSpeech.html (primária, mesmo host) — `SpeechMarkTypes` valid values, `MarksNotSupportedForFormatException`, `SsmlMarksNotSupportedForTextTypeException`, `Engine ∈ {standard, neural, long-form, generative}`, `LanguageCode` inclui `pt-BR`, limite de 6000 caracteres (3000 faturáveis) no `SynthesizeSpeech`.
  - https://aws.amazon.com/polly/pricing/ (primária, host distinto) — "for speech or Speech Marks requested" aparece em standard/neural/long-form e **some** na linha generative ("for speech requests").
  - https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html (primária) — "*Support for generating speech marks is currently not available.*"; tabela de vozes com `pt-BR | Camila` como única generativa.

### R13-05 / R13-06 / R13-07 — Google: timing só por `<mark>`, e a doc briga consigo mesma
- **Verdade operacional:** para ter timing no Google você **injeta um `<mark name="w0"/>` antes de
  cada palavra** e chama a v1beta1 com `enable_time_pointing=[SSML_MARK]`. Isso funciona, mas: (a)
  a v1beta1 é *beta*, (b) marcas inflam o SSML e o Google **não** cobra tags SSML? — isso eu não
  confirmei para o Google (a AWS confirma que não cobra tags; ver R13-03), (c) Studio não aceita
  `<mark>`, (d) para Chirp 3: HD a própria doc do Google diz uma coisa numa página e o contrário
  na outra. Chirp 3: HD **tem** pt-BR e tem `custom_pronunciations` (IPA/X-SAMPA) e tags
  `[pause short]` / `[pause long]` / `[pause]` via campo `markup`.
- **Como reconferir:**
  `POST https://texttospeech.googleapis.com/v1beta1/text:synthesize` com
  `{"input":{"ssml":"<speak><mark name='w0'/>Kubernetes <mark name='w1'/>escala</speak>"},"voice":{"languageCode":"pt-BR","name":"pt-BR-Chirp3-HD-<voz>"},"audioConfig":{"audioEncoding":"LINEAR16"},"enableTimePointing":["SSML_MARK"]}`
  e ver se volta `timepoints[]`. Se voltar erro de SSML, a página `list-voices-and-types` está certa.
- **O que quebra se divergir:** se Chirp 3: HD não aceitar SSML, o Google só entrega timing em
  Neural2/WaveNet/Standard — vozes de geração anterior. O card "usar Google como fallback com
  timing" muda de voz e de qualidade.
- **Fontes:**
  - https://github.com/googleapis/googleapis/blob/master/google/cloud/texttospeech/v1beta1/cloud_tts.proto (primária) — `enum TimepointType { TIMEPOINT_TYPE_UNSPECIFIED = 0; SSML_MARK = 1; }`, `repeated TimepointType enable_time_pointing = 4;`, `message Timepoint { string mark_name = 4; double time_seconds = 3; }`, `CustomPronunciations custom_pronunciations = 3`, `VoiceCloneParams voice_clone = 5` com `string voice_cloning_key = 1`.
  - https://docs.cloud.google.com/text-to-speech/docs/ssml (primária) — lista de tags; "A timepoint is a timestamp (in seconds, measured from the beginning of the generated audio)…"; referência à v1beta1.
  - https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types (primária) — "Studio voices support SSML, except for the following tags: `<mark>`, `<emphasis>`, `<prosody pitch>`, and `<lang>`." e "Chirp 3: HD voices doesn't support SSML input, speaking rate and pitch-audio parameters."
  - https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd (primária, contradiz a anterior) — pt-BR na lista; `speaking_rate` 0.25–2.0; `markup` com `[pause]`; `custom_pronunciations` (`phrase`, `phonetic_encoding`, `pronunciation`); "The following SSML tags are supported for synchronous requests with Chirp 3: HD voices".

### R13-08 / R13-09 — Azure: o mais completo em eventos de timing, com buraco nas vozes HD
- **Verdade operacional:** Azure é o único que entrega, no mesmo SDK, **palavra + pontuação +
  sentença + viseme (ID, SVG 2D e 55 blendshapes a 60 fps) + bookmark**, com offset em ticks de
  100 ns. O preço: isso vale para as vozes *neural* clássicas. Nas HD, `<bookmark>` e
  `<mstts:viseme>` são "No" nos dois modelos; `<prosody>`, `<emphasis>`, `<mstts:silence>` também
  são "No"; `<break>` é "Yes" no DragonHD e "No" no Omni. Word boundary está declarado
  explicitamente só para Dragon HD Omni ("Word Boundary Event Support: Enables precise word-level
  timing"). pt-BR tem `pt-BR-Thalita:DragonHDLatestNeural`, `pt-BR-Macerio:DragonHDLatestNeural`,
  16 vozes neural clássicas e variantes `MAI-Voice-2`.
- **Como reconferir:** Python:
  `speech_synthesizer.synthesis_word_boundary.connect(cb)` + `viseme_received.connect(cb)` +
  `bookmark_reached.connect(cb)`, uma vez com `pt-BR-FranciscaNeural` e outra com
  `pt-BR-Thalita:DragonHDLatestNeural`, comparando se os eventos chegam nos dois.
- **O que quebra se divergir:** se word boundary não chegar na voz HD pt-BR escolhida, ou você
  desce para a voz neural clássica (qualidade menor) ou volta o ASR ao pipeline.
- **Fontes:**
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis (primária) — `WordBoundary`, campos `AudioOffset`/`Duration`/`Text`/`TextOffset`/`WordLength`/`BoundaryType`, e `PropertyId.SpeechServiceResponse_RequestSentenceBoundary`.
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis-viseme (primária, mesmo host) — `VisemeReceived`, `e.AudioOffset` em ticks, `e.VisemeId` 0–21, `e.Animation` (SVG ou 55 blendshapes/frame a 60 fps); "SVG is only supported for the `en-US` locale".
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices (primária, mesmo host) — tabela SSML DragonHD × Omni; `temperature`/`top_p`/`top_k`/`cfg_scale`; `enhancePronunciation`.
  - https://raw.githubusercontent.com/Azure-Samples/cognitive-services-speech-sdk/master/samples/python/console/speech_synthesis_sample.py (primária, host distinto) — código oficial com `synthesis_word_boundary.connect`, `viseme_received.connect`, `bookmark_reached.connect`.
  - https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts (primária, mesmo host) — lista pt-BR.

### R13-10 — OpenAI TTS: sem timestamps e sem seed (evidência positiva de ausência)
- **Verdade operacional:** a referência do endpoint **enumera** o corpo inteiro
  (`model, input, voice, instructions, response_format, speed, stream_format`) e nenhum campo é de
  timing ou de seed. `input` tem teto de 4096 caracteres. Modelos: `tts-1`, `tts-1-hd`,
  `gpt-4o-mini-tts`, `gpt-4o-mini-tts-2025-12-15`. Vozes "optimized for English" — a doc recomenda
  `marin` ou `cedar` para melhor qualidade e diz que o suporte a idioma segue o do Whisper
  (português incluso). Escolher OpenAI = escolher o passo de ASR/alinhamento de volta.
- **Como reconferir:** `curl https://api.openai.com/v1/audio/speech -d '{"model":"gpt-4o-mini-tts","input":"teste","voice":"marin","seed":1}'` → esperar erro de parâmetro desconhecido.
- **O que quebra se divergir:** se a OpenAI adicionar alignment, o cálculo de custo/benefício vira;
  hoje o card "OpenAI TTS" obriga um card irmão de alinhamento.
- **Fontes:**
  - https://developers.openai.com/api/docs/api-reference/audio/createSpeech (primária) — enumeração completa dos parâmetros.
  - https://developers.openai.com/api/docs/guides/text-to-speech (primária, mesmo host) — modelos, formatos, disclosure de voz IA, voz custom com consent recording, "At most 20 voices can be created per organization".
  - https://reference-server.pipecat.ai/en/stable/api/pipecat.services.openai.tts.html (secundária, independente) — wrapper expõe só voice/model/sample rate/instructions/speed; nenhuma menção a timing.

### R13-11 — Hume: word + phoneme timestamps, mas fonte única
- **Verdade operacional:** `include_timestamp_types: ["word","phoneme"]` com `"version": "2"`;
  resposta `{"type":"timestamp", …, "timestamp":{"type":"word"|"phoneme","text":…,"time":{"begin":ms,"end":ms}}}`
  intercalada com o áudio. Fonemas em IPA, com "IPA-compatible extensions consistent with the
  eSpeak NG phoneme inventory". Não confirmei suporte a pt-BR nem preço.
- **Como reconferir:** `POST https://api.hume.ai/v0/tts/stream/json` com o corpo acima.
- **O que quebra se divergir:** nada crítico — é candidato B; se o campo tiver outro nome, o card
  de cliente Hume não compila.
- **Fontes:** https://dev.hume.ai/docs/text-to-speech-tts/timestamps (primária, única).

### R13-12 / R13-13 / R13-14 — Kokoro: local, Apache-2.0, com timestamps nativos
- **Verdade operacional:** este é o achado que muda a arquitetura no cenário 100% local. O
  `KPipeline` do pacote `kokoro>=0.9.4` produz tokens com `start_ts`/`end_ts` calculados a partir
  das durações previstas pelo modelo (`join_timestamps`), o que dá highlight palavra-a-palavra sem
  Whisper. Ressalvas duras: (a) `ALIASES = {..., 'pt-br': 'p', ...}` e o `'p'` cai no ramo
  `EspeakG2P(language='pt-br')` — o inglês tem G2P dedicado (misaki), o português não; (b) 3 vozes
  pt-BR e nenhuma nota de qualidade publicada; (c) a rota ONNX/`kokoro-js` **não** expõe o
  alinhamento nativo.
- **Como reconferir:**
  `python -c "from kokoro import KPipeline; p=KPipeline(lang_code='p'); r=list(p('Kubernetes escala PostgreSQL.', voice='pf_dora')); print([(t.text,t.start_ts,t.end_ts) for t in (r[0].tokens or [])])"`
- **O que quebra se divergir:** se `start_ts` vier `None` em pt-BR (é o risco: o caminho
  espeak pode não popular durações do mesmo jeito), o plano "local sem ASR" cai e o Whisper volta.
  **Este é o teste de máquina mais importante deste cluster.**
- **Fontes:**
  - https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py (primária) — `t.start_ts = left / MAGIC_DIVISOR`, `t.end_ts = …` em `join_timestamps`; `ALIASES` com `'pt-br': 'p'`; `EspeakG2P(language='pt-br')`.
  - https://raw.githubusercontent.com/hexgrad/kokoro/main/README.md (primária, mesmo host) — `kokoro>=0.9.4`, `KPipeline(lang_code='a')`, "🇧🇷 'p' => Brazilian Portuguese pt-br", pesos Apache.
  - https://huggingface.co/hexgrad/Kokoro-82M (primária, host distinto) — `license: apache-2.0`, "82 million parameters", v1.0 (2025-01-27) sucedendo v0.19 (2024-12-25).
  - https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md (primária, mesmo host) — `p = Brazilian Portuguese`; vozes `pf_dora`, `pm_alex`, `pm_santa` sem grade.
  - https://ryanwelch.co.uk/blog/kokoro-word-timestamps/ (secundária, independente) — `getattr(token, "start_ts", None)`; observa que "the public ONNX and `kokoro-js` path do not expose the native model alignment output".

### R13-15 / R13-16 / R13-17 — Determinismo: nenhuma API grande promete bit-exato
- **Verdade operacional:** o quadro real é:
  | motor | seed exposto? | promessa |
  |---|---|---|
  | ElevenLabs | **sim** (`seed`, 0–4294967295) | "best effort"; "**Determinism is not guaranteed**" |
  | PlayHT/PlayAI (job API) | **sim** (`seed` ≥ 0; `temperature` 0–2) | nenhuma promessa lida |
  | OpenAI | **não** (não está na referência) | — |
  | Google | não visto no proto/doc | — |
  | Azure | não; expõe o oposto (`temperature`, `top_p`, `top_k`, `cfg_scale`) | HD "introduce slight variations in each output" por design |
  | Polly neural/standard | não | modelo estável, mas sem garantia escrita |
  | Polly generative | não | avisa que updates de modelo mudam o som |
  | locais (Kokoro/Chatterbox/Dia/CSM) | via `torch.manual_seed` no seu código | Dia: "you will get different voices every time you run the model" sem seed fixo |
  A consequência de projeto é única e não depende de resolver isso: **o cache de locução tem de ser
  por hash de (texto normalizado + voice_id + model_id + params + versão do provedor), e o artefato
  cacheado é o par `(áudio, timing)` — nunca só o texto.** Se o áudio muda e o timing não, o vídeo
  dessincroniza sem erro.
- **Como reconferir:** gerar 3× o mesmo texto com o mesmo seed e comparar
  `sha256sum` do PCM e o array de timestamps; guardar o resultado no ledger.
- **O que quebra se divergir:** se algum provedor for de fato bit-exato, dá para reduzir o cache a
  hash de texto; se não for (esperado), o gate de snapshot de vídeo **não pode** re-sintetizar
  áudio — tem de reusar o artefato.
- **Fontes:** https://elevenlabs.io/docs/api-reference/text-to-speech/convert (primária) ·
  https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html (primária) ·
  https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices (primária) ·
  https://docs.play.ht/reference/api-generate-audio (primária: `seed` "If equal to `null` or not provided, a random seed will be used"; `temperature` 0–2) ·
  https://huggingface.co/nari-labs/Dia-1.6B (primária).

### R13-18 / R13-19 — Custo
- **Verdade operacional:** para um vídeo estilo "100 segundos" (~250 palavras ≈ 1.500 caracteres),
  o custo de locução por vídeo é: Polly neural ≈ **$0,024** (e dobra se você pedir speech marks
  numa segunda chamada); OpenAI `tts-1` ≈ **$0,023**; Polly generative ≈ **$0,045**; ElevenLabs
  multilingual ≈ **$0,15**; Kokoro local ≈ **$0**. Em outras palavras: a diferença entre o mais
  barato e o ElevenLabs, em 1.000 vídeos, é ~$130. **O custo de TTS não é o gargalo econômico
  deste programa** — a decisão é qualidade/timing/licença, não preço.
- **Como reconferir:** as páginas abaixo; e para Google, o console de billing (ver LEDGER).
- **O que quebra se divergir:** nada estrutural; muda a linha de orçamento.
- **Fontes:** https://aws.amazon.com/polly/pricing/ (primária) ·
  https://developers.openai.com/api/docs/pricing (primária) ·
  https://elevenlabs.io/pricing/api (primária, única para o número do ElevenLabs; a página lista
  Starter $6/20k, Creator $22/220k, Pro $99/440k, Scale $299/1.98M, Business $990/5.98M caracteres).

### R13-20 / R13-21 / R13-22 — Licença dos modelos locais
- **Verdade operacional:** o mapa de licença separa os modelos em três grupos.
  **Usável comercialmente sem drama:** Kokoro-82M (apache-2.0), Chatterbox (MIT, mas
  *watermark* Perth embutido em todo output), Dia-1.6B (Apache-2.0, só inglês, ~10 GB VRAM),
  Sesame CSM-1B (Apache-2.0, praticamente só inglês: "some capacity for non-English languages due
  to data contamination… but it likely won't do well"), Orpheus 3B ft (apache-2.0, inglês, repo
  *gated* — exige aceitar termos e compartilhar contato), vozes Piper (`rhasspy/piper-voices`, MIT,
  com pt_BR).
  **Bloqueado para uso comercial:** XTTS-v2 (Coqui Public Model License nos pesos), checkpoints do
  F5-TTS (CC-BY-NC), OpenAudio S1-mini (cc-by-nc-sa-4.0).
  **Atenção especial:** o Piper mudou de casa — `rhasspy/piper` era MIT, e o sucessor
  `OHF-Voice/piper1-gpl` (mesmo `pip install piper-tts`) é **GPL-3.0**. Linkar GPL-3.0 dentro de um
  pipeline distribuído é decisão jurídica, não técnica.
- **Como reconferir:** `curl -s https://huggingface.co/api/models/<repo> | jq .cardData.license`
  para cada repo; e o arquivo `COPYING`/`LICENSE` do repositório git.
- **O que quebra se divergir:** o card "fallback local de locução" muda de modelo; e um vídeo
  publicado com pesos NC é problema de publicação, não de build (o PROGRAMA já marca isso como
  risco de licença na publicação).
- **Fontes:**
  - https://huggingface.co/coqui/XTTS-v2 (primária) — `license: coqui-public-model-license`; 17 idiomas com `pt`; clonagem com clipe de 6 s.
  - https://raw.githubusercontent.com/coqui-ai/TTS/dev/README.md (primária, host distinto) — código MPL-2.0.
  - https://github.com/resemble-ai/chatterbox (primária) — MIT.
  - https://raw.githubusercontent.com/resemble-ai/chatterbox/master/README.md (primária, host distinto) — 23 idiomas com `pt`, variantes pt-BR/pt-PT; `pip install chatterbox-tts`; classes `ChatterboxTTS`, `ChatterboxTurboTTS`, `ChatterboxMultilingualTTS`; watermark Perth; Nano 110M roda em CPU "3x realtime on 8 cores".
  - https://huggingface.co/nari-labs/Dia-1.6B (primária) — Apache-2.0, ~10 GB VRAM, só inglês, voz diferente a cada run.
  - https://huggingface.co/sesame/csm-1b (primária) — Apache-2.0, inglês.
  - https://huggingface.co/canopylabs/orpheus-3b-0.1-ft (primária) — `apache-2.0`, gated.
  - https://huggingface.co/fishaudio/openaudio-s1-mini (primária) — `cc-by-nc-sa-4.0`, 13 idiomas com `pt`.
  - https://raw.githubusercontent.com/SWivid/F5-TTS/main/README.md (primária) — código MIT, checkpoints CC-BY-NC "due to the training data Emilia".
  - https://huggingface.co/rhasspy/piper-voices (primária) — `license: mit`, 35 idiomas.
  - https://github.com/OHF-Voice/piper1-gpl (primária) — GPL-3.0, `pip install piper-tts`, phonemização por espeak-ng.
  - https://huggingface.co/bosonai/higgs-audio-v2-generation-3B-base (primária) — `license: other` (ver LICENSE no repo); 4 idiomas; clonagem zero-shot; diálogo multi-speaker.

### R13-23 — O plano B (voz humana ou TTS sem timing) tem ferramenta pt-BR real
- **Verdade operacional:** três caminhos verificados:
  (1) **ElevenLabs Forced Alignment** — você manda áudio + o texto exato e recebe o alinhamento;
  suporta "Portuguese (Brazil, Portugal)"; limites 3 GB / 10 h / 675.000 caracteres; cobrado na
  tarifa de Speech-to-Text. É o caminho de menor esforço para voz humana.
  (2) **WhisperX** — alinhamento por wav2vec2; pt **não** está nos modelos torchaudio default
  (`en, fr, de, es, it`) mas está no dicionário HF: `"pt": "jonatasgrosman/wav2vec2-large-xlsr-53-portuguese"`;
  `<8 GB` de VRAM para large-v2.
  (3) **MFA** — 3 modelos acústicos portugueses (CV v2_0_0 CC-0; MFA v2_0_0 e v2_0_0a CC BY 4.0),
  dialetos Brazil e Portugal, saída em intervalos de palavra e de fone.
  Comparação de ciclo: TTS com timing = 1 chamada, segundos, texto é a fonte de verdade e
  regenerar é grátis. Voz humana = regravar custa uma sessão humana; qualquer correção de roteiro
  invalida o áudio inteiro; alinhamento adiciona 1 passo e ~1 modelo de 1–3 GB no disco. Para um
  gerador **automatizado, dirigido por agentes, com roteiro mudando a cada iteração**, voz humana
  quebra o laço de iteração — é opção para o corte final, não para o loop.
- **Como reconferir:** `whisperx audio.wav --language pt --align_model jonatasgrosman/wav2vec2-large-xlsr-53-portuguese`
  e `mfa model download acoustic portuguese_mfa`.
- **O que quebra se divergir:** se o alinhador pt-BR for ruim, o highlight palavra-a-palavra fica
  visivelmente errado e o card de legenda vira "por sentença".
- **Fontes:**
  - https://elevenlabs.io/docs/overview/capabilities/forced-alignment (primária).
  - https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py (primária) — dicionários literais.
  - https://raw.githubusercontent.com/m-bain/whisperX/main/README.md (primária, mesmo host) — "<8GB gpu memory for large-v2 with beam_size=5".
  - https://mfa-models.readthedocs.io/en/latest/acoustic/Portuguese/index.html (primária, host distinto).
  - https://montreal-forced-aligner.readthedocs.io/en/latest/user_guide/index.html (primária, mesmo host) — definição de forced alignment.

### R13-24 — Direitos de voz: consentimento é cláusula, não etiqueta
- **Verdade operacional:** o padrão de mercado convergiu. ElevenLabs exige, no próprio fluxo de
  clonagem, a confirmação de "the right and consent to clone the voice" e opera Prohibited Use
  Policy. OpenAI exige **gravação de consentimento** do locutor + amostra ≤30 s, limita a 20 vozes
  por organização, restringe voz custom a "eligible customers" e — o item que atinge o vídeo
  publicado — exige *disclosure*: "Our usage policies require you to provide a clear disclosure to
  end users that the TTS voice they are hearing is AI-generated and not a human voice." Sesame e
  Nari (Dia) colocam a proibição no model card. Google expõe `VoiceCloneParams.voice_cloning_key`
  na API, o que implica um fluxo de consentimento fora da API.
  Risco prático em ordem de dano: (1) publicar com voz clonada de pessoa real sem consentimento;
  (2) publicar sem disclosure quando o provedor exige; (3) publicar com pesos NC (XTTS-v2,
  F5-TTS ckpt, OpenAudio) — os três são risco **na publicação**, não no build.
- **Como reconferir:** reler ToS/Prohibited Use do provedor escolhido na data da publicação.
- **O que quebra se divergir:** o gate de publicação precisa de um campo obrigatório
  "voz: sintética/humana + provedor + consentimento em arquivo".
- **Fontes:** https://developers.openai.com/api/docs/guides/text-to-speech (primária) ·
  https://huggingface.co/sesame/csm-1b (primária) ·
  https://elevenlabs.io/docs/product-guides/voices/voice-cloning/instant-voice-cloning (primária) ·
  https://huggingface.co/nari-labs/Dia-1.6B (primária) ·
  https://github.com/googleapis/googleapis/blob/master/google/cloud/texttospeech/v1beta1/cloud_tts.proto (primária).

### R13-25 — Pronúncia de termos técnicos em pt-BR: o que existe de verdade
- **Verdade operacional:** o problema "como o motor lê *Kubernetes*, *PostgreSQL*, *async/await*
  numa frase em português" tem quatro ferramentas verificadas, em ordem de determinismo:
  1. **`<phoneme>` com IPA/X-SAMPA** — Google (aceita IPA e X-SAMPA) e Azure (`Yes` no DragonHD,
     **`No` no Dragon HD Omni**). Determinístico; você escreve a pronúncia.
  2. **Léxico** — Polly `LexiconNames` (até 5 léxicos, aplicados só se o idioma do léxico bate com
     o da voz) e Azure `<lexicon>` (nas vozes HD, "only supports alias").
  3. **`<sub alias="…">`** — funciona em Google, Polly (via SSML) e Azure (`Yes` nas HD). É o
     truque mais portátil: `<sub alias="cubernétis">Kubernetes</sub>`.
  4. **`custom_pronunciations`** — Google Chirp 3: HD, com `phrase` + `phonetic_encoding` +
     `pronunciation`, sem depender de SSML.
  Fora disso: Azure `enhancePronunciation=true` (heurístico, e a própria doc diz que para
  controle determinístico o SSML continua sendo o recomendado); ElevenLabs
  `apply_text_normalization ∈ {auto,on,off}` controla normalização de texto mas não é dicionário
  de pronúncia. **Nenhum modelo local checado (Kokoro, Piper, Chatterbox) aceita SSML** — o
  controle lá é escrever a pronúncia no texto ou editar o dicionário do espeak-ng.
- **Como reconferir:** sintetizar a frase-canário
  `"O Kubernetes orquestra containers e o PostgreSQL usa async/await"` em cada candidato e ouvir.
- **O que quebra se divergir:** o card "dicionário de pronúncia do projeto" muda de formato
  (léxico PLS vs. tabela de `<sub>` vs. tabela `custom_pronunciations`) — e o formato **não** é
  portátil entre provedores.
- **Fontes:** https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices (primária) ·
  https://docs.cloud.google.com/text-to-speech/docs/ssml (primária) ·
  https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd (primária, mesmo host) ·
  https://docs.aws.amazon.com/polly/latest/dg/API_SynthesizeSpeech.html (primária) ·
  https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps (primária).

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "A ancoragem de timing vem do Whisper.cpp com `tokenLevelTimestamps: true` e DTW (`t_dtw`)" — o roadmap trata ASR como **o** mecanismo de sincronia (linhas 87–95 de `Roadmap Editor de Vídeo IA.md`) | REFUTADO como *necessidade* | ASR é **um** caminho, e é o caminho caro. ElevenLabs (caractere), Cartesia (palavra + fonema), Polly (`word`/`viseme`), Azure (`WordBoundary`/`VisemeReceived`), Hume (word/phoneme) e até o **Kokoro local** já devolvem timing junto com o áudio. Whisper só é obrigatório se a voz for humana ou se o TTS escolhido não devolver timing (ex.: OpenAI). | https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps · https://docs.cartesia.ai/api-reference/tts/websocket · https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py |
| O roadmap sugere modelos Whisper `base.en` **ou** `medium` para a transcrição | REFUTADO (para pt-BR) | `base.en` é modelo **English-only**; usá-lo em locução pt-BR produz transcrição/alinhamento lixo. Além disso o WhisperX **não** tem modelo de alinhamento torchaudio default para `pt` — precisa do HF `jonatasgrosman/wav2vec2-large-xlsr-53-portuguese`. | https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py |
| "o vídeo [é] determinístico, repetível e versionável" (linha 6), com a locução implicitamente dentro dessa promessa | EM DISPUTA | O vídeo pode ser determinístico **dado um artefato de áudio**; a *síntese* não é. Nenhuma API grande promete áudio bit-exato: ElevenLabs diz "Determinism is not guaranteed" mesmo com seed; Azure HD "introduce slight variations in each output" por design; Polly avisa que updates de modelo mudam o som das vozes generativas. Determinismo só existe se o áudio+timing forem artefatos cacheados e versionados, nunca regerados no render. | https://elevenlabs.io/docs/api-reference/text-to-speech/convert · https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices · https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html |
| Implícito no roadmap: "TTS é um detalhe de implementação, escolhe-se depois" (o documento nunca nomeia um motor) | REFUTADO | A escolha do motor **decide se existe ou não um estágio de ASR/alinhamento no pipeline**, que é um subsistema inteiro (modelo baixado, GPU, cache, formato `timing.json`). É decisão de arquitetura, não de implementação. | esta seção inteira |
| Implícito: "Polly/Google/Azure são intercambiáveis como 'TTS de nuvem'" | REFUTADO | Não são: Polly dá `word` mas **não no engine generative**; Google dá **só** `<mark>` (v1beta1) e não dá nada nas vozes Studio; Azure dá `WordBoundary`+viseme mas **não** `<bookmark>`/`<mstts:viseme>` nas vozes HD; OpenAI não dá nada. Trocar de provedor troca o formato de timing e, às vezes, a existência dele. | https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html · https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types · https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices |
| Implícito no uso de XTTS/Coqui como "TTS open source óbvio" (assunção comum do domínio, não citada no roadmap) | REFUTADO | Os **pesos** do XTTS-v2 estão sob Coqui Public Model License (o campo do model card é literalmente `coqui-public-model-license`), separada do código MPL-2.0. Não é uma licença permissiva. | https://huggingface.co/coqui/XTTS-v2 · https://raw.githubusercontent.com/coqui-ai/TTS/dev/README.md |
| Assunção de que "Piper é MIT" | EM DISPUTA / mudou | As **vozes** (`rhasspy/piper-voices`) continuam MIT, mas o runtime sucessor `OHF-Voice/piper1-gpl` — que é o que `pip install piper-tts` instala hoje — é **GPL-3.0**. Código e vozes têm licenças diferentes. | https://github.com/OHF-Voice/piper1-gpl · https://huggingface.co/rhasspy/piper-voices |

---

## 4. Armadilhas (falso verde deste domínio)

- **"Recebi `alignment` do ElevenLabs, logo tenho timing de palavra"** → é timing de **caractere**,
  e há dois arrays (`alignment` sobre o texto cru, `normalized_alignment` sobre o texto expandido).
  Se você casar o índice do texto cru com o tempo do normalizado, o highlight desliza progressivamente
  ao longo da frase — erro que só aparece em frases com número ou sigla. → *fica vermelho se sumir:*
  um fixture com `"3 pods do PostgreSQL"` e asserção de que a palavra "PostgreSQL" começa depois de
  "pods" nos **dois** arrays.

- **"Polly devolve word marks, então uma chamada resolve"** → são **duas** chamadas cobradas
  (`OutputFormat=json` não emite áudio) e os offsets `start`/`end` são **em bytes**, não em
  caracteres. Em pt-BR ("ç", "ã", "é") byte ≠ caractere. → *fica vermelho se sumir:* teste que
  fatia o texto pelos offsets de um mark e compara com a palavra esperada, usando texto acentuado.

- **"O Chirp 3: HD aceita SSML — está na doc"** → outra página da mesma doc diz que não aceita.
  Uma das duas está errada e você não sabe qual até chamar a API. → *fica vermelho se sumir:*
  um teste de integração que envia `<mark>` para a voz Chirp 3: HD pt-BR e falha explicitamente
  em vez de cair em fallback silencioso.

- **"Peguei uma voz Azure HD porque soa melhor"** → nas HD você perde `<bookmark>`,
  `<mstts:viseme>`, `<prosody>`, `<emphasis>` e (no Omni) `<break>` e `<phoneme>`. O SSML que você
  escreveu para a voz neural clássica é aceito e **ignorado**, o que é pior que erro. → *fica
  vermelho se sumir:* asserção de que a duração do áudio com e sem `<break time="1s"/>` difere.

- **"Fixei o seed, então o áudio é reprodutível"** → ElevenLabs escreve, em letras miúdas, que não
  é garantido; e nenhum seed protege contra o provedor atualizar o modelo. O cache tem de guardar o
  **artefato**, não a receita. → *fica vermelho se sumir:* gate que compara o `sha256` do wav
  cacheado com o wav no repositório antes do render, e falha se divergir.

- **"Kokoro tem timestamps"** → tem, no caminho **Python/PyTorch**. Na rota ONNX / `kokoro-js`, o
  alinhamento nativo não é exposto. E o pt-BR passa por espeak-ng, não pelo G2P dedicado — não
  testei se `start_ts` é populado nesse ramo. → *fica vermelho se sumir:* o teste do LEDGER-SEED
  L-01 abaixo.

- **"O modelo é open source, então posso publicar"** → XTTS-v2 (CPML), F5-TTS checkpoints
  (CC-BY-NC) e OpenAudio S1-mini (CC-BY-NC-SA) proíbem uso comercial dos **pesos**, mesmo com
  código permissivo. E Chatterbox marca d'água todo output. → *fica vermelho se sumir:* um campo
  `license` obrigatório no manifesto do provedor de voz, checado no gate de publicação.

- **"Vou gravar minha própria voz, aí não tenho problema de licença nem de qualidade"** → você
  ganha isso e perde o laço de iteração: cada correção de roteiro feita por um agente invalida a
  gravação. Num sistema onde o LLM reescreve o script, voz humana transforma "regerar o vídeo" de
  segundos em uma sessão de estúdio. → *fica vermelho se sumir:* medir o tempo de ciclo
  "editar 1 palavra do roteiro → vídeo novo pronto" nos dois modos.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| L-01 | `KPipeline(lang_code='p')` popula `start_ts`/`end_ts` nos tokens em pt-BR (ramo `EspeakG2P`), ou só em inglês? | assumir que **sim**, e ter o WhisperX como fallback armado | `python -c "from kokoro import KPipeline; p=KPipeline(lang_code='p'); r=list(p('O Kubernetes escala o PostgreSQL.', voice='pf_dora')); print([(t.text,t.start_ts,t.end_ts) for t in (r[0].tokens or [])])"` | se vier `None`, o pipeline 100% local volta a precisar de ASR: +1 modelo, +GPU, +estágio |
| L-02 | Qualidade percebida das 3 vozes pt-BR do Kokoro é aceitável para narração técnica? (o VOICES.md não publica grade) | assumir "não sei"; gerar amostra e o dono decide | gerar a frase-canário com `pf_dora`, `pm_alex`, `pm_santa` e ouvir | se for ruim, o cenário local vira Chatterbox-multilingual (MIT, mas com watermark) ou API paga |
| L-03 | O `<mark>` de SSML funciona nas vozes **Chirp 3: HD pt-BR** do Google (doc se contradiz — R13-07)? | assumir que **não**; usar Neural2 se precisar de timepoint no Google | `POST v1beta1/text:synthesize` com `enableTimePointing:["SSML_MARK"]` e voz `pt-BR-Chirp3-HD-*` | se não funcionar, Google só dá timing em vozes de geração anterior |
| L-04 | Preço oficial por 1 M de caracteres das vozes Google (Standard/WaveNet/Neural2/Studio/Chirp 3: HD) — a página de preço é renderizada por JS e não foi lida por fonte primária | não orçar Google até ler a tabela | abrir `https://cloud.google.com/text-to-speech/pricing` no navegador, ou `gcloud billing` / console → SKUs do `texttospeech.googleapis.com` | orçamento errado; e o critério "Google é o barato" pode ser falso |
| L-05 | Preço oficial do Azure Speech TTS por 1 M de caracteres (neural, Neural HD) — a tabela é interativa por região/moeda e não foi lida | idem: não orçar Azure sem a tabela | abrir a página de preço com região/moeda selecionadas, ou usar o Azure Pricing Calculator | idem L-04 |
| L-06 | Azure emite `WordBoundary` para **`pt-BR-Thalita:DragonHDLatestNeural`** (a doc declara word boundary só para Dragon HD **Omni**)? | assumir que **não** nas DragonHD não-Omni; testar Omni | script Python do sample oficial com `synthesis_word_boundary.connect`, trocando a voz | escolher a voz HD errada custa o timing inteiro |
| L-07 | O ElevenLabs com `seed` fixo produz PCM bit-idêntico nesta conta/modelo, hoje? | assumir que **não** | 3× a mesma request com o mesmo seed → `sha256sum` do PCM e diff dos arrays de timestamp | se for idêntico, dá para simplificar o cache; se não (esperado), o artefato tem de ser versionado |
| L-08 | Qualidade do alinhamento pt-BR do WhisperX com `jonatasgrosman/wav2vec2-large-xlsr-53-portuguese` sobre áudio **sintético** (não humano) | assumir aceitável para sentença, duvidoso para palavra | alinhar um wav gerado com timing conhecido (ex.: Cartesia) e comparar erro médio por palavra | se o erro > ~80 ms, o highlight palavra-a-palavra fica visivelmente errado |
| L-09 | PlayHT/PlayAI expõe word timestamps? A doc do job API (`api-generate-audio`) **não** menciona; o WebSocket (`docs.play.ai`) não pôde ser lido (certificado expirado) | tratar como "não tem" | reler `https://docs.play.ai/api-reference/text-to-speech/websocket` quando o cert normalizar | só muda a lista de candidatos |
| L-10 | Rime expõe word timestamps só no WebSocket? (só há evidência secundária via Pipecat/LiveKit; `docs.rime.ai` não foi aberto) | tratar como NÃO VERIFICADO | abrir `https://docs.rime.ai/api-reference/endpoint/websockets-json` | idem |
| L-11 | Higgs Audio v2: qual é o texto da licença `other`? | não usar até ler | ler `LICENSE` em `https://huggingface.co/bosonai/higgs-audio-v2-generation-3B-base/tree/main` | pode ser NC e cair no mesmo balde do XTTS |
| L-12 | Custo real por vídeo com speech marks do Polly (duas chamadas) vs. ElevenLabs (uma chamada com timing) para um script de ~1.500 caracteres | assumir Polly ainda mais barato | medir com `x-amzn-RequestCharacters` nas duas chamadas | muda a ordem do ranking de custo, não a arquitetura |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| O vídeo vai ser publicado comercialmente (monetização, cliente, marca)? | é mandato de negócio | se **sim**, XTTS-v2, checkpoints F5-TTS e OpenAudio S1-mini estão fora (pesos NC), e o ElevenLabs free/atribuição está fora; se **não**, o leque abre |
| O programa aceita depender de uma API paga no caminho crítico do build, ou "roda localmente" é literal (sem rede)? | o PROGRAMA diz "rodando LOCALMENTE" mas não diz se isso proíbe chamada de API | se for literal: **Kokoro** é o único candidato Apache-2.0 com timing nativo, e o pt-BR dele é o risco central (L-01/L-02); se API for aceita, Cartesia/ElevenLabs resolvem timing e qualidade de uma vez |
| Qual é o idioma-alvo primário: pt-BR, inglês, ou os dois? | é decisão de produto | vários modelos locais bons (Dia, CSM, Orpheus) são **só inglês**; se pt-BR for obrigatório, a lista local cai para Kokoro, Piper, Chatterbox-multilingual, XTTS (NC) e OpenAudio (NC) |
| Aceita GPL-3.0 no pipeline (Piper novo)? | é apetite jurídico | se **não**, Piper sai (ou fica preso à versão MIT antiga, sem manutenção) |
| Existe hardware com GPU nesta máquina, e quanta VRAM? | é fato do ambiente do dono | Kokoro (82 M) roda em CPU; Chatterbox 500M, Dia ~10 GB, Orpheus 3B/4B ~16 GB. A resposta elimina metade dos candidatos locais |
| Vai clonar voz de alguém (do dono, de um locutor)? | envolve consentimento de terceiro | se **sim**, precisa de consentimento gravado (OpenAI exige literalmente), de trilha de auditoria e do disclosure "voz gerada por IA" no vídeo publicado |
| O vídeo publicado vai declarar que a voz é sintética? | é política editorial, e a OpenAI exige contratualmente | se **não** declarar, OpenAI TTS está fora por termo de uso, independente de qualidade |
| Qual erro máximo de sincronia é tolerável no highlight palavra-a-palavra (ex.: 30 ms? 100 ms?) | é critério estético do dono | define se dá para usar alinhamento por ASR (erro maior) ou se exige timing nativo do TTS; e define o limiar do gate de snapshot |
| Voz humana entra em algum momento (corte final premium) ou o programa é 100% sintético? | é decisão de produto e orçamento | se entrar, o pipeline precisa do estágio de forced alignment desde o começo (ElevenLabs FA ou MFA), mesmo que o padrão seja TTS com timing |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** o contrato de saída do estágio de locução. Se o estágio produzir
  **sempre** o par `audio/<hash>.wav` + `audio/<hash>.timing.json` com um schema **próprio e
  normalizado** — `[{word, start_s, end_s, char_start, char_end}]` — então trocar de provedor é
  trocar **um** adaptador: o arquivo `providers/<nome>.ts|py` que converte a resposta nativa
  (caracteres do ElevenLabs, `word_timestamps` do Cartesia, speech marks do Polly, eventos do
  Azure, tokens do Kokoro) para esse schema. Custo de reversão contável: **1 arquivo de adaptador
  + 1 fixture de golden timing por provedor**. O que **não** é barato de reverter: deixar o timing
  nativo vazar para dentro dos componentes Remotion — aí a troca de provedor vira refatoração do
  `<HighlightText />`. Escreva o normalizador antes do primeiro provedor.
  O segundo ponto de troca barata é a variável que escolhe o provedor: uma só, lida do manifesto,
  nunca hardcoded em componente.

- **Skills que devem carregar este conhecimento:**
  - a skill de **locução/áudio** (a que executa o estágio TTS): precisa dos claims R13-01 a R13-12
    (quem devolve timing e em que formato), R13-25 (pronúncia de termo técnico) e da regra de cache
    de R13-15/16/17;
  - a skill de **sincronia/legenda** (a que alimenta `<HighlightText />` e o code walkthrough):
    precisa do schema normalizado e da armadilha `alignment` vs `normalized_alignment`;
  - a skill de **publicação/licença**: precisa de R13-20/21/22/24 — pesos NC, watermark Perth,
    consentimento e disclosure de voz IA;
  - a skill de **cache/artefatos**: precisa de R13-15/16/17 — o artefato é o par (áudio, timing),
    a chave é o hash dos parâmetros, e o render nunca re-sintetiza.

- **Cards que este cluster condiciona:**
  1. **Definir o schema `timing.json` normalizado** e escrever o golden fixture com texto pt-BR
     acentuado + sigla técnica. Bloqueia todo o resto. Não depende de escolher provedor.
  2. **Adaptador de provedor #1** — implementar o normalizador para o provedor escolhido pelo dono,
     com teste que casa palavra↔tempo no fixture.
  3. **Teste de máquina L-01/L-02** (Kokoro pt-BR com `start_ts`) antes de qualquer card que
     assuma "locução local sem ASR". Esse teste é curto e decide se existe ou não um subsistema
     inteiro de ASR no programa.
  4. **Estágio de alinhamento como opcional, não como padrão** — o card do WhisperX/MFA existe,
     mas atrás de uma bandeira, ligado só quando o provedor não devolve timing ou quando a voz é
     humana. O roadmap hoje o coloca no caminho crítico; ele deve sair de lá.
  5. **Cache de locução por hash** com o par (áudio, timing) versionado, e gate que recusa render
     se o `sha256` do áudio divergir do registrado.
  6. **Tabela de pronúncia do projeto** (Kubernetes, PostgreSQL, async/await, Docker, nginx…),
     no formato do provedor escolhido — com a nota de que ela **não** é portátil.
  7. **Gate de publicação com campo de licença/consentimento de voz** — provedor, licença dos
     pesos, se é voz clonada, se há disclosure.
  8. **Card de reconferência datado** para preços e listas de voz (R13-18/19 e L-04/L-05):
     rechecar até **2026-11-10**; os números aqui são de 2026-08-10.
