---
name: tts-voiceover
description: Provides the voiceover knowledge this program needs — which TTS engines return word timestamps (the criterion that decides whether an ASR stage exists at all), the license/cost/local/pt-BR comparison, the immutable (audio, timing) cache keyed by input hash, seed and determinism limits, SSML prosody portability, the pt-BR pronunciation dictionary for technical terms and acronyms, and voice-rights obligations. Use whenever a task synthesizes speech, picks or swaps a voice provider, writes the voiceover cache key, tunes pauses or pronunciation, or decides whether forced alignment is needed. Triggers: "TTS", "voiceover", "locucao", "narracao", "voz", "speech synthesis", "ElevenLabs", "Cartesia", "Polly", "Azure Speech", "Kokoro", "Piper", "XTTS", "Chatterbox", "SSML", "pronuncia", "phoneme", "voice cloning", "clonagem de voz", "word timestamps", "speech marks", "WordBoundary", "seed", "prosodia", "pausa"
metadata:
  type: knowledge
  tier: dominio
  verification_signal: "curl -sS https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py | grep -c \"lang_code in 'ab'\"   # >=1 enquanto o ramo pt-BR do Kokoro nao alinhar; 0 significa que a guarda caiu e esta skill precisa ser reescrita"
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
# Locução (TTS) — timing, cache, prosódia e direito de voz

O estágio `locução (TTS) → audio/<hash>.wav + timing.json` fica **acima da fronteira de
determinismo**: nada aqui é determinístico e tudo é cacheado — fonte:
`PROGRAMA.md §"Os cinco estágios e a fronteira que organiza o programa"` (o estágio
`locução (TTS) →` e a caixa `A FRONTEIRA`), norma do programa. Esta skill injeta
o que decide o provedor e o que impede a locução de virar entrada variável de um pipeline que se
diz repetível. **O `PROGRAMA.md` é documento vivo e suas linhas deslizam** a cada edição: por isso
nenhuma citação abaixo carrega número de linha — todas ancoram em id de claim, id de card, id de
item de ledger ou título de seção, que sobrevivem à edição.

## Quando carregar

- A tarefa vai sintetizar fala, escolher/trocar provedor de voz, ou escrever o adaptador
  `providers/<nome>` que normaliza a resposta nativa para o `timing.json` do programa.
- A tarefa escreve ou muda a **chave de cache** da locução, ou um gate que decide se o render
  pode reusar um wav já gerado.
- A tarefa mexe em prosódia: SSML, pausas, ênfase, ou pronúncia de sigla/termo técnico em pt-BR.
- A tarefa toca licença de peso de modelo, clonagem de voz, ou o campo de voz do gate de
  publicação.
- **Não** carregue para consumir o `timing.json` já produzido (schema, `<HighlightText />`,
  legenda, whisper.cpp, alinhamento forçado): isso é `audio-captions-sync`. Não carregue para
  ducking, mix, loudness ou concat: isso é `ffmpeg-media-ops`. Não carregue para escrever o
  roteiro ou o dicionário de pronúncia como artefato de autoria: isso é `llm-authoring`.

## Conhecimento injetado

### O critério que decide a arquitetura não é qualidade de voz: é se o motor devolve timing

Escolher o motor **decide se existe ou não um subsistema inteiro de ASR/alinhamento** no
programa (modelo baixado, GPU, cache, estágio a mais) — não é detalhe de implementação —
fonte: `docs/pesquisa/R13-tts-locucao.md:349`.

Por ser arquitetura, a escolha **não é do agente**: ela é decisão de dono reservada ao **ADR-0009**,
e o card `F2-03` produz `audio` **e** `timing` quando o provedor fornece, degradando com item de
ledger quando não — fonte: `PROGRAMA.md §III-14 · card F2-03` (`a escolha está no ADR-0009, não no
código do card`), norma do programa. E a lista de candidatos **já foi ampliada**: `I-01` /
ADR-0003 registrou que o uso deste programa é **pessoal**, logo modelos cujos *pesos* têm licença
não-comercial **entram** — fonte: `PROGRAMA.md §III-14 · card I-01, Entrega, D4`
(`D4 — voz e trilha: leque ampliado`). O que sustenta isso é a condição
de escopo, e ela é vigiada: `AB-950` nasce aberto e reabre P-01/P-03/P-04 no dia em que o uso
deixar de ser pessoal — fonte: `PROGRAMA.md §III-14 · card I-01, campo «A condição de escopo»` e
`PROGRAMA.md §III-14 · card I-01, campo ledger` (`AB-950`).

| motor (condição de escopo) | licença / custo por 1 M de chars | local | pt-BR | timestamps devolvidos | Placar | fonte |
|---|---|---|---|---|---|---|
| ElevenLabs `/text-to-speech/{id}/with-timestamps` | API paga; ~$50–100 (varejo, ver Não verificado) | não | sim (`eleven_multilingual_v2`) | **por caractere**: `characters`, `character_start_times_seconds`, `character_end_times_seconds`; palavra é derivada por você | (3-0) | https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps |
| Cartesia Sonic (só o endpoint **WebSocket** foi lido; o REST não) | API paga (preço não lido) | não | `pt` na lista do `sonic-3` | **palavra e fonema** no mesmo stream: `add_timestamps` + `add_phoneme_timestamps`, em segundos | (3-0) | https://docs.cartesia.ai/api-reference/tts/websocket |
| Polly, engines `standard`/`neural`/`long-form` | $4 / $16 / $100 | não | `neural`: Camila, Vitória, Thiago, Ricardo | `sentence \| word \| viseme \| ssml`, em **chamada separada** (`OutputFormat=json`) que **não emite áudio** | (2-0) | https://docs.aws.amazon.com/polly/latest/dg/using-speechmarks.html |
| Polly, engine `generative` | $30 | não | só `Camila` | **nenhum** — "Support for generating speech marks is currently not available" | (2-0) | https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html |
| Google Cloud TTS | não lido (ver Não verificado) | não | sim | só `<mark>` de SSML, via `enable_time_pointing=[SSML_MARK]` e **só na v1beta1**; `Timepoint{mark_name,time_seconds}` | (2-0) | https://github.com/googleapis/googleapis/blob/master/google/cloud/texttospeech/v1beta1/cloud_tts.proto |
| Azure Speech, **vozes neural clássicas** | não lido (ver Não verificado) | não | 16 vozes | `WordBoundary` (`AudioOffset` em ticks de 100 ns, `Duration`, `Text`, `TextOffset`, `WordLength`, `BoundaryType`) + `VisemeReceived` + `BookmarkReached` | (2-0) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis |
| Azure Speech, **vozes HD** (DragonHD / Dragon HD Omni) | idem | não | `pt-BR-Thalita`, `pt-BR-Macerio` | word boundary declarado **só** para Omni; `<bookmark>` e `<mstts:viseme>` não suportados nos dois | (1-0) → Não verificado | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices |
| OpenAI `POST /v1/audio/speech` | $15 (`tts-1`), $30 (`tts-1-hd`), $0,60/1M tokens de texto + $12/1M de áudio (`gpt-4o-mini-tts`) | não | vozes "optimized for English" | **nada**: o corpo enumerado é `model, input, voice, instructions, response_format, speed, stream_format` — sem timestamp e **sem seed** | (2-0) | https://developers.openai.com/api/docs/api-reference/audio/createSpeech |
| Hume Octave | não lido | não | não confirmado | palavra + fonema (IPA), `include_timestamp_types` com `"version":"2"`, tempos em ms | (1-0) → Não verificado | https://dev.hume.ai/docs/text-to-speech-tts/timestamps |
| Kokoro-82M (`kokoro` Python) | Apache-2.0, ~$0 | **sim**, 82 M, roda em CPU | `lang_code='p'` sintetiza pt-BR via `EspeakG2P(language='pt-br')`; 3 vozes (`pf_dora`, `pm_alex`, `pm_santa`) — a contagem é (1-0), ver Não verificado | **só no ramo inglês** — ver a seção seguinte | (2-0) | https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py |
| Piper (`OHF-Voice/piper1-gpl`, o que `pip install piper-tts` instala hoje) | runtime **GPL-3.0**; vozes `rhasspy/piper-voices` MIT | sim | pt_BR | alinhamento **experimental, por fonema** (samples por `phoneme_id`), só na API Python/C++ — nenhuma flag de CLI | (2-0) | https://github.com/OHF-Voice/piper1-gpl · https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/ALIGNMENTS.md |
| Chatterbox (resemble-ai) | MIT, mas **marca d'água neural Perth em todo áudio gerado** | sim | pt-BR/pt-PT entre 23 idiomas | não documentado | (2-0) | https://github.com/resemble-ai/chatterbox |
| XTTS-v2 · checkpoints F5-TTS · OpenAudio S1-mini | pesos **CPML / CC-BY-NC / CC-BY-NC-SA**, código MPL/MIT: a cláusula morde **só uso comercial** — e o uso aqui é pessoal (`I-01`), então são candidatos válidos | sim | sim | **não lido** — R13 checou licença e idioma, não timing (ver Não verificado) | (2-0) | https://huggingface.co/coqui/XTTS-v2 · https://huggingface.co/fishaudio/openaudio-s1-mini |

Plano B verificado quando o motor escolhido não devolve timing (ou a voz é humana):
ElevenLabs **Forced Alignment** (29 idiomas incl. "Portuguese (Brazil…)", cobrado como
Speech-to-Text), WhisperX com `"pt": "jonatasgrosman/wav2vec2-large-xlsr-53-portuguese"`, e MFA
com 3 modelos acústicos portugueses (CC-0 e CC BY 4.0) — **Placar (3-0)** — fonte:
https://elevenlabs.io/docs/overview/capabilities/forced-alignment ·
https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py ·
https://mfa-models.readthedocs.io/en/latest/acoustic/Portuguese/index.html.

### O buraco de pt-BR do Kokoro — a disputa `D-05` (R13 × R04, sobre o mesmo arquivo)

`docs/pesquisa/R13-tts-locucao.md:34` afirma, com **(2-0)**, que "um modelo local Apache-2.0 já
devolve timing sem ASR". `docs/pesquisa/R04-legendas-asr-alinhamento.md:56` afirma, com **(2-0)**
e lendo **o mesmo arquivo**, que `join_timestamps` só é chamada quando `self.lang_code in 'ab'`
(inglês) — logo, sem timestamps para português.

O panorama **não fecha essa disputa por leitura** — ela é **D-05**, e o que ele determina enquanto
estiver aberta é **planejar pelo pior caso (R04-24)**: as duas leituras são compatíveis se a
conclusão for *"o mecanismo existe e não se aplica a pt-BR"* — fonte:
`docs/00-panorama-verificado.md §4 D-05`. Quem a fecha é **uma linha de comando**,
`AB-050`, e nenhum card que assuma "local sem ASR" pode começar antes dela — fonte:
`docs/00-panorama-verificado.md §7.4 · AB-050`. O R04 é a leitura mais específica porque nomeia a
guarda, e o ramo não-inglês do `KPipeline` produz `Result` **sem `tokens`**, portanto sem
`start_ts`/`end_ts`; o próprio R13 já previa a derrota (era o item L-01 do ledger dele,
`docs/pesquisa/R13-tts-locucao.md:407`).

Consequência de planejamento, com o pior caso assumido: no cenário 100% local em pt-BR **não existe hoje
caminho pronto de timestamp por palavra** — Kokoro exclui pt, Piper dá fonema experimental — e
o card de alinhamento **não** pode ser deletado — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/hexgrad/kokoro/main/kokoro/pipeline.py ·
https://raw.githubusercontent.com/OHF-Voice/piper1-gpl/main/docs/ALIGNMENTS.md.

Escopo preservado: a limitação é **do ramo de idioma**, não do modelo. Kokoro em `lang_code='a'`
(inglês) alinha. E o que alinha é a rota **Python/PyTorch**: `kokoro-js`/ONNX não exporia o
alinhamento nativo nem em inglês — mas isso tem **um só hostname atrás** (um blog independente,
não o repositório) — **(1-0)** → Não verificado — fonte: `docs/pesquisa/R13-tts-locucao.md:191`.

### A locução é imutável: o artefato cacheado é o par `(áudio, timing)`

A chave é `hash(texto normalizado + voice_id + model_id + params + versão do provedor)`, e o que
se guarda é **o par**, nunca só o texto: se o áudio muda e o `timing.json` não, o vídeo
dessincroniza **sem erro** — fonte: `docs/pesquisa/R13-tts-locucao.md:205-208`,
`PROGRAMA.md §I-3` e `PROGRAMA.md §"Pontos de troca barata"` (em ambos, a linha
`Provedor de locução`; norma do programa, ver Não verificado sobre placar).

A regra não depende de resolver o determinismo — depende de ele **não estar provado**:

| motor | expõe seed? | o que o fornecedor promete | Placar |
|---|---|---|---|
| ElevenLabs | sim (`seed`, 0–4294967295) | "best effort"; "Determinism is not guaranteed" | (1-0) → Não verificado |
| PlayHT/PlayAI (job API) | sim (`seed` ≥ 0, `temperature` 0–2) | nada escrito | (1-0) → Não verificado |
| OpenAI | **não** (não está na enumeração do corpo) | — | (2-0) |
| Azure vozes HD | não; expõe o oposto (`temperature`, `top_p`, `top_k`, `cfg_scale`) | "slight variations in each output", por design | (1-0) → Não verificado |
| Polly `generative` | não | avisa que updates de modelo mudam o som da voz | (1-0) → Não verificado |
| locais (Kokoro, Chatterbox, Dia, CSM) | via `torch.manual_seed` no **seu** código | Dia: voz diferente a cada execução sem seed/áudio-prompt fixo | (2-0) |

Três armadilhas dentro da chave de cache, todas silenciosas:

1. **`apply_text_normalization` do ElevenLabs (`auto|on|off`) faz parte da entrada.** Ele muda o
   texto que é falado (números por extenso, siglas expandidas) e, portanto, o áudio e o
   alinhamento. Hash sobre o texto cru sem esse parâmetro colide dois áudios diferentes. O
   **(3-0)** dessa página cobre os arrays de `alignment` (dois secundários independentes a
   corroboram); o parâmetro em si só está na doc do próprio fornecedor — **(1-0)** → Não
   verificado — fonte: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps.
   A regra de pôr o parâmetro no hash não depende do placar: ela é norma deste programa.
2. **A versão do provedor entra no hash.** Nenhum seed protege contra o fornecedor atualizar o
   modelo; o Polly diz isso por escrito para as vozes generativas — **(1-0)** → Não verificado.
3. **Trocar `voice_id` recacheia a série inteira.** Isso é feature, não bug: é o que impede
   metade de uma série sair com outra voz. Ver Conhecimento negativo.

### Prosódia: SSML não é portátil e, na voz errada, é aceito e ignorado

Quatro mecanismos de controle de pronúncia existem, em ordem decrescente de determinismo:
`<phoneme>` com IPA/X-SAMPA — no Google, e no Azure **só no DragonHD** (`No` no Dragon HD Omni) ·
léxico (`LexiconNames` do Polly, até 5, aplicados só se o idioma do léxico casa com o da voz;
`<lexicon>` do Azure, que **nas vozes HD só aceita `alias`**) · `<sub alias="…">` (o mais portátil:
Google + Polly + Azure HD) · `custom_pronunciations` do Google Chirp 3: HD (`phrase`,
`phonetic_encoding`, `pronunciation`, sem depender de SSML). **Nenhum modelo local checado
(Kokoro, Piper, Chatterbox) aceita SSML** — lá o controle é escrever a pronúncia no texto ou
editar o dicionário do espeak-ng — **Placar (1-0)** → ver Não verificado — fonte:
`docs/pesquisa/R13-tts-locucao.md:313-338`.

**O dicionário de pronúncia de termos técnicos em pt-BR é um arquivo de fonte única**, produzido
pela etapa de autoria e **consumido** pela locução — fonte: `PROGRAMA.md §III-14 · card F4-02`
(Entrega: `fonte única, consumido depois pela locução`), norma do programa. Ele **não é portátil entre provedores**: trocar de
provedor troca o formato (léxico PLS × tabela de `<sub>` × `custom_pronunciations` × texto
reescrito) — fonte: `docs/pesquisa/R13-tts-locucao.md:331-333`. Portanto o arquivo guarda o
**termo e a pronúncia pretendida**, e o adaptador do provedor a serializa; nunca guarde SSML
pronto de um provedor como se fosse a fonte.

A frase-canário do domínio, que exercita sigla, produto e barra:
`"O Kubernetes orquestra containers e o PostgreSQL usa async/await"` — fonte:
`docs/pesquisa/R13-tts-locucao.md:330`. Sintetizar e **ouvir** é o único teste; nenhum gate
automático deste programa pega pronúncia errada.

### Custo por vídeo: não é o gargalo, e por isso não é o critério

Para um vídeo de ~100 s (~250 palavras ≈ 1.500 caracteres): Polly neural ≈ **$0,024** (e
**dobra** se você pedir speech marks, porque são duas chamadas cobradas); OpenAI `tts-1` ≈
**$0,023**; Polly generative ≈ **$0,045**; Kokoro local ≈ **$0** — **Placar (2-0)** — fonte:
https://aws.amazon.com/polly/pricing/ · https://developers.openai.com/api/docs/pricing. O número
do ElevenLabs (≈ **$0,15** por vídeo, e a diferença de ~$130 em 1.000 vídeos que se costuma citar)
sai de uma tabela de varejo com **um só hostname** — **(1-0)** → Não verificado. Em qualquer das
duas leituras a ordem de grandeza é a mesma: a decisão é timing/licença/qualidade, não preço.

### Direitos de voz: o risco é na publicação, e nenhum teste técnico o pega

Consentimento é obrigação contratual em pelo menos três fornecedores: ElevenLabs pede
confirmação de "the right and consent to clone the voice"; OpenAI exige **gravação de
consentimento** do locutor, limita a 20 vozes por organização e exige **disclosure ao usuário
final** de que a voz é gerada por IA; Sesame CSM proíbe imitar pessoa real sem consentimento
explícito — **Placar (3-0)** — fonte:
https://developers.openai.com/api/docs/guides/text-to-speech · https://huggingface.co/sesame/csm-1b
· https://elevenlabs.io/docs/product-guides/voices/voice-cloning/instant-voice-cloning.

Ordem de dano, do pior para o menor: (1) publicar voz clonada de pessoa real sem consentimento;
(2) publicar sem disclosure quando o provedor exige — essas duas **independem** do enquadramento de
uso; (3) publicar com pesos NC — esta **só** morde se o uso virar comercial, e no escopo pessoal
atual não morde (`PROGRAMA.md §III-14 · card I-01, D4`). O gate de publicação precisa do campo
`voz: sintética|humana + provedor + licença dos pesos + consentimento em arquivo + disclosure`, e
ele verifica **a presença do campo, não a verdade dele** — o campo existe para tornar a reavaliação
possível se `AB-950` virar, não para recusar por licença de peso — fonte:
`[R13-24 (3-0)]` e `docs/00-panorama-verificado.md §9.3`
(`O gate verifica a presenca do campo`).

**A licença do código não é a licença do peso.** Kokoro-82M apache-2.0 · Chatterbox MIT (com
watermark) · Dia-1.6B Apache-2.0 (só inglês, ~10 GB VRAM) · CSM-1B Apache-2.0 · Orpheus 3B ft
apache-2.0 mas repo *gated* · OpenAudio S1-mini cc-by-nc-sa-4.0 · F5-TTS código MIT e
checkpoints CC-BY-NC · XTTS-v2 pesos sob Coqui Public Model License com código MPL-2.0 —
**Placar (2-0)** — fonte: https://huggingface.co/coqui/XTTS-v2 ·
https://huggingface.co/nari-labs/Dia-1.6B · https://github.com/resemble-ai/chatterbox.

### Loudness pertence a um estágio só, e não é este

A cadeia `F2-03 locução → F3-01 timing → F3-03 ducking → F3-05 mix → F5-03 loudness` é estritamente
sequencial e o loudness é o **último** elo dela, **quatro estágios** depois da locução — fonte:
`PROGRAMA.md §III-10` (o caminho crítico, a linha `F0-01 → F0-02 →`) e
`PROGRAMA.md §III-14 · card F5-03` (`Pós-processamento: loudness e sidecar`), norma do programa. Normalizar o wav
da locução no ato da síntese quebra duas coisas ao mesmo tempo: muda o `sha256` do artefato
cacheado, e entrega ao estágio de loudness um material já comprimido. O mecanismo do dano é
medido: `loudnorm` sem `measured_*` roda em modo **dinâmico**, e mesmo **com** os `measured_*`
ele desliga a normalização linear e cai para dinâmica quando `offset_tp > target_tp` ou
`measured_lra > target_lra` — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/af_loudnorm.c. Duas passagens
dinâmicas em série alteram a dinâmica duas vezes e não convergem para o alvo.

Além disso não existe alvo único de loudness (EBU R 128 = −23,0 LUFS; AES TD1008 = −18 fala;
Netflix = −27 LKFS dialog-gated; Spotify = −14) — **Placar (5-0)** — e o teto de true peak
convergente antes de codec com perdas é −1 dBTP — **Placar (3-0)** — fonte:
https://tech.ebu.ch/docs/r/r128.pdf · `[R14-12 (5-0)]` `[R14-13 (3-0)]`. Escrever um alvo
aqui seria escolher pelo dono; o alvo é ADR.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não regenere a locução a cada render.** É o reflexo natural ("a síntese é barata, o texto é
  a fonte de verdade") e é o que quebra o gate de snapshot: a síntese fica **acima** da fronteira
  de determinismo (`PROGRAMA.md §"Os cinco estágios e a fronteira que organiza o programa"`, a
  caixa `A FRONTEIRA`) e nenhuma API grande promete PCM bit-exato. O render lê
  o artefato; se o `sha256` divergir do registrado, o gate recusa — ele não re-sintetiza.
- **Não troque de voz no meio de uma série.** `voice_id` e `model_id` estão dentro da chave de
  cache: trocar recacheia tudo o que ainda não foi renderizado e deixa o já publicado com a voz
  antiga. Se a troca for necessária, ela é um recache **completo** e explícito da série, com
  recaptura dos snapshots — não uma mudança de variável.
- **Não assuma que o TTS pronuncia sigla técnica corretamente sem testar.** O modo de falha é
  mudo: o áudio sai fluente e errado, e nenhum gate deste programa o detecta. Rode a
  frase-canário no provedor **e na voz** escolhidos — a pronúncia varia entre vozes do mesmo
  provedor — antes de aceitar o dicionário como verde.
- **Não normalize loudness duas vezes.** O estágio de locução entrega o wav cru; loudness é
  `F5-03`. Se você já normalizou na síntese, a medição do estágio dono mede material comprimido
  e o `loudnorm` cai para dinâmico — o log ainda diz que atingiu o alvo.
- **Não deixe o formato nativo do provedor vazar para dentro dos componentes Remotion.**
  Caracteres do ElevenLabs, `word_timestamps` do Cartesia, speech marks do Polly e eventos do
  Azure são quatro formatos diferentes. O ponto de troca barata é **um adaptador por provedor**
  para um `timing.json` normalizado; se o formato nativo entrar no `<HighlightText />`, trocar de
  provedor vira refatoração de componente — fonte: `docs/pesquisa/R13-tts-locucao.md:440-450`.
- **Não fatie o texto pelos offsets do Polly como se fossem caracteres.** `start`/`end` dos
  speech marks são **offsets de bytes** do texto de entrada; em pt-BR, "ç", "ã" e "é" ocupam mais
  de um byte. O deslize só aparece depois do primeiro acento da frase — **Placar (2-0)** —
  fonte: https://docs.aws.amazon.com/polly/latest/dg/using-speechmarks.html.
- **Não case o índice de `alignment` com o tempo de `normalized_alignment`.** São dois arrays
  sobre textos diferentes (cru × expandido). O highlight desliza progressivamente, e só em
  frases com número ou sigla — **Placar (3-0)** — fonte:
  https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps.
- **Não escolha uma voz Azure HD porque soa melhor sem checar o que ela perde.** Nas HD,
  `<bookmark>`, `<mstts:viseme>`, `<prosody>` e `<emphasis>` não são suportados, e `<break>` só
  no DragonHD. O SSML escrito para a voz neural clássica é **aceito e ignorado** — pior que erro
  — **(1-0)** → Não verificado, mas o teste é barato (comparar duração com e sem `<break>`).
- **Não peça áudio e speech marks do Polly esperando uma chamada.** `OutputFormat=json` não emite
  áudio; são duas requisições, ambas cobradas por caractere. Um orçamento feito com uma chamada
  erra por 2×.
- **Não leia o `LICENSE` do repositório e escreva "MIT" no manifesto do provedor de voz.** XTTS-v2
  (pesos CPML), checkpoints F5-TTS (CC-BY-NC) e OpenAudio S1-mini (CC-BY-NC-SA) têm código
  permissivo e pesos restritivos; Chatterbox é MIT e ainda assim marca d'água **todo** output com
  Perth. O campo que o gate registra é a licença **do peso** — um card que lê só o pacote passa
  verde carregando o dado errado, e a reavaliação futura (`AB-950`) fica cega.
- **Não bloqueie um card porque os pesos são não-comerciais.** É o reflexo correto em outro projeto
  e errado neste: a cláusula NC é condicionada a *uso comercial*, e `I-01`/ADR-0003 registrou o uso
  como **pessoal** — a decisão **ampliou** a lista de candidatos de `F2-03`, não a reduziu
  (`PROGRAMA.md §III-14 · card I-01, D4`). Bloquear aqui é decidir no lugar do dono e apagar opção
  que ele já autorizou. O que sobrevive é a **condição**: se o uso virar comercial, `AB-950` reabre
  e esses pesos saem (`PROGRAMA.md §III-14 · card I-01, campo ledger`).
- **Não escolha o provedor dentro do card de locução.** É a decisão que parece técnica e não é: ela
  cria ou apaga um subsistema inteiro de ASR, e está reservada ao **ADR-0009**. `F2-03` emite
  `audio` **e** `timing` quando o provedor fornece e **degrada com item de ledger** quando não;
  hardcodar o provedor transforma uma decisão registrada em um `import` que ninguém revisa
  (`PROGRAMA.md §III-14 · card F2-03`).
- **Não escolha voz humana para o laço de iteração.** Num sistema em que o LLM reescreve o
  roteiro, cada correção invalida a gravação: "regerar o vídeo" passa de segundos para uma sessão
  de estúdio. Voz humana é opção de corte final, com forced alignment desde o começo, não default
  — fonte: `docs/pesquisa/R13-tts-locucao.md:276-280`.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| "Recebi `alignment`, logo tenho timing de palavra" | é timing de **caractere**, e há dois arrays sobre textos diferentes | fixture com `"3 pods do PostgreSQL"` assertando que "PostgreSQL" começa depois de "pods" nos **dois** arrays |
| "Fixei o seed, logo o áudio é reprodutível" | o fornecedor promete "best effort", e nenhum seed cobre update de modelo | gate que compara o `sha256` do wav cacheado com o registrado **antes** do render, e falha na divergência |
| "Kokoro tem timestamps" | tem, no ramo `lang_code in 'ab'` e na rota PyTorch; pt-BR sai sem `tokens` | o teste `AB-050`: roda `KPipeline(lang_code='p')` e falha se `r[0].tokens` for `None` — é ele que fecha `D-05`, e nenhum card "local sem ASR" começa antes dele |
| "O SSML foi aceito, logo funcionou" | vozes HD do Azure aceitam e ignoram tags não suportadas | asserção de que a duração do áudio com e sem `<break time="1s"/>` difere |
| "A doc do Chirp 3: HD diz que aceita SSML" | outra página do mesmo fornecedor diz que não; (1-1) EM DISPUTA | teste de integração que envia `<mark>` para a voz Chirp 3: HD pt-BR e falha explicitamente, sem fallback silencioso |
| "O log do `loudnorm` diz que atingiu o alvo" | ele reporta o alvo dele, e pode ter caído para modo dinâmico | medição independente com `ebur128` (read-only) sobre o arquivo final |
| "Polly devolve word marks, então uma chamada resolve" | são duas chamadas cobradas, e os offsets são em bytes | teste que fatia o texto pelos offsets de um mark e compara com a palavra esperada, com texto acentuado |
| "O pacote é MIT" | a licença do peso é outra (CPML, CC-BY-NC, CC-BY-NC-SA) | campo `license` obrigatório no manifesto do provedor de voz, checado no gate de publicação |
| "A locução saiu, o vídeo está sincronizado" | áudio novo com `timing.json` velho dessincroniza **sem erro** | teste que re-sintetiza **só** o wav (mantendo o `timing.json` antigo no cache) e exige que o gate **falhe**: se ele passar verde, o par não está sendo validado junto |

## O que esta skill NÃO cobre

- Schema do `timing.json`, whisper.cpp/`tokenLevelTimestamps`, `t_dtw`, WhisperX, MFA, legenda,
  `createTikTokStyleCaptions` e o consumo do timing pelos componentes → **`audio-captions-sync`**.
- `loudnorm`, `ebur128`, ducking, mix, concat, probe e determinismo de bytes de mídia →
  **`ffmpeg-media-ops`**.
- Redação do roteiro e a produção do dicionário de pronúncia como artefato de autoria →
  **`llm-authoring`**.
- Trilha musical, licença de mídia externa e procedência de asset → **`asset-acquisition`**.
- Onde o áudio entra na timeline e como o manifesto o referencia → **`timeline-manifest`**.
- `<Audio>` do `@remotion/media` × o legado de `remotion` → **`remotion-core`**.

## Não verificado

Claims com placar < 2-0 que aparecem acima, cada um com o comando que fecha a lacuna:

- **Azure vozes HD: quais eventos e tags sobrevivem** (`<bookmark>`, `<mstts:viseme>`,
  `<prosody>`, `<emphasis>`, `<break>`; word boundary só no Omni) — **(1-0)**, doc oficial única.
  Fecha com: sample oficial em Python com `synthesis_word_boundary.connect`, uma vez com
  `pt-BR-FranciscaNeural` e outra com `pt-BR-Thalita:DragonHDLatestNeural`.
- **Determinismo do ElevenLabs com `seed` fixo** — **(1-0)**. Fecha com: 3× a mesma request com o
  mesmo seed → `sha256sum` do PCM e diff dos arrays de timestamp.
- **`apply_text_normalization ∈ {auto,on,off}` do ElevenLabs** (existência e efeito sobre o texto
  falado) — **(1-0)**, doc oficial única; os secundários independentes só corroboram os arrays de
  alinhamento. Fecha com: a mesma request com `on` e com `off` sobre `"3 pods"` → diff de
  `alignment.characters` e `sha256sum` do PCM.
- **PlayHT/PlayAI expõe `seed` ≥ 0 e `temperature` 0–2 sem promessa escrita de determinismo** —
  **(1-0)**, doc oficial única do job API. Fecha com: mesmo teste de 3× do ElevenLabs.
- **`kokoro-js`/ONNX não expõe o alinhamento nativo** — **(1-0)**, um blog independente, nada no
  repositório. Fecha com: rodar o pipeline ONNX em `lang_code='a'` e inspecionar o retorno.
- **Azure HD amostra por design** (`temperature`, `top_p`, `top_k`, `cfg_scale`) e **Polly
  generative muda o som entre updates** — **(1-0)** cada. Fecha com: sintetizar o mesmo texto em
  duas datas e comparar `sha256`.
- **Preço de varejo do ElevenLabs** ($0,05/$0,10 por 1 K chars, de onde sai o ≈$0,15 por vídeo e o
  ~$130 por 1.000 vídeos da seção de custo) — **(1-0)**; **preço do Google
  TTS** e **do Azure Speech** por 1 M de caracteres — **não lidos** (páginas renderizadas por JS
  / tabela interativa). Fecha com: console de billing / Pricing Calculator.
- **Chirp 3: HD aceita SSML?** — **(1-1) EM DISPUTA** entre duas páginas do próprio Google. Fecha
  com: `POST v1beta1/text:synthesize` com `enableTimePointing:["SSML_MARK"]` e voz
  `pt-BR-Chirp3-HD-*`.
- **Mecanismos de pronúncia** (`<phoneme>` e o corte DragonHD × Omni, léxico, `<sub alias>`,
  `custom_pronunciations`, `enhancePronunciation=true`) e **modelos locais não aceitam
  SSML** — **(1-0)**. Fecha com: a
  frase-canário em cada candidato, e a inspeção do dicionário do espeak-ng para o caminho local.
- **Hume Octave**: word/phoneme timestamps, suporte a pt-BR e preço — **(1-0)**, doc única.
- **Qualidade percebida das 3 vozes pt-BR do Kokoro** — o `VOICES.md` não publica grade — **(1-0)**.
  Fecha com: gerar a frase-canário nas três vozes; a decisão é do dono, não do agente.
- **Timing nativo de XTTS-v2, checkpoints F5-TTS e OpenAudio S1-mini** — **não lido**: o R13 checou
  licença e idioma desses três e **não** checou se devolvem timestamps. Enquanto eles estavam fora
  por licença isso não custava nada; com `I-01` trazendo-os para a lista, a lacuna virou decisória.
  Fecha com: sintetizar a frase-canário em cada um e inspecionar o retorno do pacote Python
  procurando campo de duração/alinhamento por token.

**Sobre as citações de `PROGRAMA.md` e `docs/00-panorama-verificado.md` sem placar:** elas não
são afirmações sobre o mundo, são **decisões deste programa** (a fronteira de determinismo, o
dono do estágio de loudness, o dicionário como fonte única, o campo do gate de publicação).
Placar não se aplica; o que as valida é a âncora estável (id de card, id de item de ledger ou
título de seção), e o que as derruba é um ADR que declare `Supera`. Toda afirmação empírica acima
carrega placar do arquivo de pesquisa correspondente.

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
