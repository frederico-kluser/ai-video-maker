# R03 — Remotion: áudio, volume por frame, drift e sample rate

**Escopo desta pesquisa:** fecha quais componentes de áudio o Remotion oferece hoje (4.0.507), a
semântica exata de `volume`/trim/`toneFrequency`/`playbackRate`, como N faixas viram uma trilha no
render, e o que a doc/código dizem sobre sample rate e dessincronia. **NÃO** responde legendas/TTS
(R04/R13), nem política de licença comercial do Remotion, nem medição de loudness na nossa máquina.

**Âncora de versão:** todas as afirmações se referem a **Remotion `v4.0.507`**, release publicada em
**2026-08-07** (`gh api repos/remotion-dev/remotion/releases/latest` → `v4.0.507`), lida em
2026-08-10. Onde o código citado é do branch `main`, isso está dito.

**Nota sobre placares neste cluster:** o ecossistema Remotion tem, na prática, poucos domínios
primários independentes — `remotion.dev` (docs + blog = **uma** fonte pela regra do contrato),
`github.com/remotion-dev/remotion` (código + release notes = **uma** fonte),
`registry.npmjs.org` e `ffmpeg.org`. Por isso muitos claims fecham legitimamente em **(2-0)
PROVÁVEL** mesmo com evidência forte (o valor literal no código-fonte). Não inflei placar com
mirrors da doc oficial (mcpservers.org, skillsmp.com, remotiondocs.com), que não são independentes.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R03-01 | O pacote `@remotion/media` exporta os componentes `Audio` e `Video` (mais os aliases deprecados `experimental_Audio`/`experimental_Video`), na versão 4.0.507. | (3-0) | CONFIRMADO | https://github.com/remotion-dev/remotion/blob/main/packages/media/src/index.ts |
| R03-02 | A doc oficial declara `<Audio>` de `@remotion/media` como o componente de áudio recomendado para código novo. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/html5-audio |
| R03-03 | O `package.json` de `@remotion/media@4.0.507` ainda descreve o pacote como "Experimental WebCodecs-based media tags". | (2-0) | PROVÁVEL | https://registry.npmjs.org/@remotion/media/latest |
| R03-04 | O `Audio` exportado pelo pacote `remotion` é literalmente `export const Audio = Html5Audio;` com JSDoc `@deprecated This component has been renamed to Html5Audio`. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/core/src/audio/html5-audio.tsx |
| R03-05 | `<Html5Audio>` **não** está deprecado: é o alvo do fallback automático de `@remotion/media` quando o container/codec não é decodificável. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/media/fallback |
| R03-06 | A limitação documentada de `<Html5Audio>` é `@remotion/web-renderer` (renderização **no browser**), não renderização server-side. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/html5-audio |
| R03-07 | `volume` aceita `number \| ((frame: number) => number)` — o tipo é `VolumeProp` e vale para `<Audio>` e `<Html5Audio>`. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/core/src/volume-prop.ts |
| R03-08 | O `frame` que chega no callback de `volume` é **relativo ao início da mídia** (0 quando o áudio começa), não `useCurrentFrame()` absoluto. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/audio/volume |
| R03-09 | `loopVolumeCurveBehavior` (`'repeat'` padrão \| `'extend'`) decide se a curva de volume reinicia a cada iteração de loop. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/core/src/audio/use-audio-frame.ts |
| R03-10 | Volume negativo é clampado a 0 e volume > 1 **amplifica** (só `>= 100` lança erro); `allowAmplificationDuringRender` está deprecado com a nota "Amplification is now always enabled". | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/core/src/volume-safeguard.ts |
| R03-11 | Os nomes atuais são `trimBefore`/`trimAfter`; `startFrom`/`endAt` foram renomeados na v4.0.319 de forma retrocompatível. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/releases/v4.0.319 |
| R03-12 | O tipo `AudioProps` de `@remotion/media` **não tem** `startFrom` nem `endAt` — os aliases legados só existem em `remotion`/`<Html5Audio>`. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/media/src/audio/props.ts |
| R03-13 | `acceptableTimeShiftInSeconds` **não** é prop direto de `<Audio>` de `@remotion/media`: só existe dentro de `fallbackHtml5AudioProps` (e direto em `<Html5Audio>`), com padrão 0.45 s. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/media/src/audio/props.ts |
| R03-14 | `toneFrequency` aceita 0.01–2, só funciona em render server-side, e é implementado como `asetrate=SR*tone,aresample=SR,atempo=1/tone`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/media/audio |
| R03-15 | O sample rate de saída tem padrão **48000 Hz**, é configurável por `--sample-rate` / `Config.setSampleRate()` / `sampleRate` desde a **v4.0.448**, e **todas** as fontes são reamostradas para ele. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/sample-rate |
| R03-16 | Os codecs de áudio válidos são exatamente `pcm-16`, `aac`, `mp3`, `opus`; o padrão para `h264` é `aac` (ou `pcm-16` com `--prefer-lossless`), e o `--audio-bitrate` padrão é `320k`. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/options/audio-codec.tsx |
| R03-17 | A mixagem de N faixas é `amix=inputs=N:dropout_transition=0:normalize=0` — ou seja, o Remotion **desliga** a normalização que o `amix` do FFmpeg traz ligada por padrão. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/create-ffmpeg-merge-filter.ts |
| R03-18 | Não existe normalização de loudness embutida no render: a lista completa de opções do renderer não tem nenhuma opção de loudness, e `loudnorm` só aparece na doc do Remotion Recorder como script FFmpeg **externo**. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/tree/main/packages/renderer/src/options |
| R03-19 | A flag é `--separate-audio-to` (grafia com "a", `ssrName: 'separateAudioTo'`), disponível desde a v4.0.123. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/options/separate-audio.tsx |
| R03-20 | As flags são `--muted` (não `--mute`) e `--enforce-audio-track`, ambas com padrão `false`, desde a v3.2.1. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/cli/render |
| R03-21 | `@remotion/sfx` existe (v4.0.507, `"license": "MIT"`, disponível desde v4.0.429) mas exporta **strings de URL remotas** `https://remotion.media/*.wav`, não um componente. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/sfx/src/index.ts |
| R03-22 | O `atempo` do FFmpeg é imprecisamente frame-accurate — a própria Remotion documenta "speeding up 80.000 audio samples by 2x will lead to 40.014 audio samples". | (2-0) | PROVÁVEL | https://www.remotion.dev/blog/faster-lambda |
| R03-23 | Um stream AAC tem pacotes de exatamente 1024 amostras e 512 amostras de silêncio no início, compensadas por offset negativo no container MP4 — é essa a fonte documentada de "pop" ao concatenar. | (2-0) | PROVÁVEL | https://www.remotion.dev/blog/faster-lambda |
| R03-24 | Para arquivos MP3 o Remotion **ignora deliberadamente** o `start_time` do `ffprobe` ("that is an inherent encoder thing"), zerando-o antes de calcular o `adelay` da faixa. | (1-0) | NÃO VERIFICADO | https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/assets/get-audio-channels.ts |
| R03-25 | Existem **duas** pipelines de áudio distintas no render: `<Html5Audio>` → asset de mídia → filtros FFmpeg; `@remotion/media <Audio>` → extração por frame via WebCodecs → asset `inline-audio` (PCM) — e só a etapa final de `amix` é comum. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/media/src/audio/audio-for-rendering.tsx |

---

## 2. Detalhe por claim

### R03-01 — `@remotion/media` exporta `Audio` e `Video`

- **Verdade operacional:** `import {Audio} from '@remotion/media'` é código válido hoje. O
  `index.ts` do pacote exporta `Audio`, `Video`, `AudioForPreview`, os tipos `AudioProps`/
  `FallbackHtml5AudioProps`/`MediaErrorAction`/`MediaRequestInit`, `getTargetSampleRate`, e mantém
  `experimental_Audio`/`experimental_Video` como aliases marcados `@deprecated  Now just Audio`.
  (O comando de instalação exato de `@remotion/media` **não** consegui ler na página — o bloco de
  instalação é componente React e não sai no fetch; para `@remotion/sfx` o comando documentado é
  `npx remotion add @remotion/sfx`. Ver L-R03-10.)
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/media/src/index.ts --jq '.content' | base64 -d`
  e `curl -s https://registry.npmjs.org/@remotion/media/latest | jq '.version,.dependencies'`
- **O que quebra se divergir:** todo card que escreve componente de áudio; o import fica errado em
  cada cena gerada pelo LLM, e o erro só aparece no build da worktree, não no plano.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/media/src/index.ts (primária) — o
    arquivo de exports literal.
  - https://www.remotion.dev/docs/media/audio (primária) — "the recommended component for embedding
    audio in Remotion", exemplo com `import {Audio} from '@remotion/media'`.
  - https://registry.npmjs.org/@remotion/media/latest (primária) — `version: 4.0.507`,
    `dependencies: {remotion: 4.0.507, mediabunny: 1.50.8, zod: 4.4.3}`.

### R03-02 — `<Audio>` de `@remotion/media` é o recomendado hoje

- **Verdade operacional:** a doc de `<Html5Audio>` diz textualmente *"For new audio usage, prefer
  `<Audio>` from `@remotion/media`"*, e a página de `@remotion/media` diz *"This package provides the
  recommended `<Video>` and `<Audio>` tags… Use these tags for new projects."* O código corrobora
  pela direção contrária: o JSDoc do `Audio` legado aponta para `/docs/mediabunny/new-video`.
- **Como reconferir:** abrir https://www.remotion.dev/docs/html5-audio e procurar a frase "prefer".
- **O que quebra se divergir:** o default do gerador de cena. Se um dia a recomendação voltar para
  `<Html5Audio>`, muda uma linha de import por template — troca barata.
- **Fontes:**
  - https://www.remotion.dev/docs/html5-audio (primária) — a frase de preferência.
  - https://github.com/remotion-dev/remotion/blob/main/packages/core/src/audio/html5-audio.tsx
    (primária) — JSDoc do alias deprecado apontando para a nova doc.

### R03-03 — o pacote ainda se autodescreve como "Experimental"

- **Verdade operacional:** há uma **tensão real** entre a doc ("recommended", "Use these tags for
  new projects") e o metadado do pacote (`"description": "Experimental WebCodecs-based media tags"`).
  Isso não invalida R03-02, mas é o sinal honesto de que a superfície de API pode mudar dentro da
  linha 4.0.x. Note também que `packages/media/package.json` **não tem campo `license`** (ao
  contrário de `@remotion/sfx`, que declara `MIT`).
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/@remotion/media/latest | jq -r '.description'`
- **O que quebra se divergir:** a decisão de fixar (`pin`) a versão do Remotion. Se o pacote é
  experimental, o card de setup precisa de versão travada e de um teste de fumaça de áudio.
- **Fontes:**
  - https://registry.npmjs.org/@remotion/media/latest (primária) — campo `description`.
  - https://github.com/remotion-dev/remotion/blob/main/packages/media/package.json (primária) —
    linha 56, mesma string.

### R03-04 — `Audio` de `"remotion"` é alias deprecado de `Html5Audio`

- **Verdade operacional:** o pacote `remotion` exporta os dois nomes
  (`export {Audio, Html5Audio} from './audio/index.js'`), mas `Audio` é literalmente o mesmo objeto:
  `export const Audio = Html5Audio;`, com `@deprecated This component has been renamed to
  Html5Audio`. Consequência prática: **`import {Audio} from 'remotion'` compila e roda, e é o erro
  mais fácil de um LLM cometer**, porque parece certo e dá o componente errado (o legado).
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/core/src/audio/html5-audio.tsx --jq '.content' | base64 -d | tail -20`
- **O que quebra se divergir:** o gate de lint do gerador de cena. Precisamos de uma regra que
  proíba `import {Audio} from 'remotion'` — sem ela, metade das cenas usa o caminho legado sem
  ninguém perceber, e as duas pipelines de timing se misturam (ver R03-25).
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/core/src/audio/html5-audio.tsx
    (primária) — a linha `export const Audio = Html5Audio;` e o JSDoc.
  - https://www.remotion.dev/docs/html5-audio (primária) — "_previously called `<Audio>`_".

### R03-05 — `<Html5Audio>` não está deprecado; é o fallback

- **Verdade operacional:** `<Html5Audio>` continua documentado e suportado. `@remotion/media` cai
  para ele automaticamente quando: o recurso falha por CORS, o container não é suportado pelo
  Mediabunny, ou o codec não é decodificável por WebCodecs. O código de `audio-for-rendering.tsx`
  mostra os quatro casos (`unknown-container-format`, `cannot-decode`, `network-error`) chamando
  `setReplaceWithHtml5Audio(true)`. `disallowFallbackToHtml5Audio` transforma o fallback em
  cancelamento do render.
- **Como reconferir:** abrir https://www.remotion.dev/docs/media/fallback.
- **O que quebra se divergir:** o card de "áudio de entrada" e a fixture de formatos. Se o fallback
  existe, um mp3 exótico rende sem erro mas por outra pipeline — e o teste de sincronia precisa
  saber por qual caminho passou.
- **Fontes:**
  - https://www.remotion.dev/docs/media/fallback (primária) — condições de fallback e
    `disallowFallbackToHtml5Audio`.
  - https://github.com/remotion-dev/remotion/blob/main/packages/media/src/audio/audio-for-rendering.tsx
    (primária) — os ramos de erro e o `setReplaceWithHtml5Audio`.

### R03-06 — a limitação é web-renderer (browser), não SSR

- **Verdade operacional:** o aviso da doc é *"`<Html5Audio>` is not supported in
  `@remotion/web-renderer`. Use `<Audio>` from `@remotion/media` instead."* — e
  `@remotion/web-renderer` é **client-side rendering no browser** (estável desde v4.0.491, usa
  WebCodecs+Mediabunny no lugar do FFmpeg), explicitamente distinto de SSR. Prova adicional na
  direção oposta: `toneFrequency` é documentado como *"Only works in server-side rendering"* — ou
  seja, o caminho SSR é justamente o mais capaz. A mesma página de fallback diz que **no
  client-side rendering o fallback para `<Html5Audio>` é impossível**, o que confirma que o
  fallback existe e funciona no caminho server-side.
- **Como reconferir:** https://www.remotion.dev/docs/html5-audio (bloco de aviso) e
  https://www.remotion.dev/docs/client-side-rendering.
- **O que quebra se divergir:** nada no nosso caso — rodamos localmente com `@remotion/renderer`
  (Node + Chrome headless), que é SSR. Mas o card errado ("não use Html5Audio porque quebra em
  SSR") teria proibido o único fallback disponível.
- **Fontes:**
  - https://www.remotion.dev/docs/html5-audio (primária) — o texto do aviso.
  - https://github.com/remotion-dev/remotion/blob/main/packages/media/src/audio/audio-for-rendering.tsx
    (primária) — `environment.isClientSideRendering` separa mensagens e desabilita fallback.

### R03-07 — `volume` aceita função de frame

- **Verdade operacional:** o tipo é literal:
  `export type VolumeProp = number | ((frame: number) => number);`. Vale para `<Audio>` de
  `@remotion/media` (via `AudioProps.volume?: VolumeProp`) e para `<Html5Audio>`. A doc recomenda a
  forma de callback quando o volume varia: *"Prefer using a callback function if the volume is
  changing. This will enable Remotion to draw a volume curve in the Studio and is more performant."*
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/core/src/volume-prop.ts --jq '.content' | base64 -d`
- **O que quebra se divergir:** todo card de fade/ducking. Sem callback, fade vira `<Sequence>`
  picotada.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/core/src/volume-prop.ts (primária) —
    a definição do tipo e a função `evaluateVolume`.
  - https://www.remotion.dev/docs/audio/volume (primária) — exemplo
    `volume={(f) => interpolate(f, [0, 1 * fps], [0, 1], {extrapolateLeft: 'clamp'})}`.

### R03-08 — o `frame` do callback é relativo à mídia, não à composição

- **Verdade operacional:** a doc é explícita: *"Inside the callback function, the value of `f` starts
  always `0` when the audio begins to play. It is not the same as the value of `useCurrentFrame()`."*
  A implementação é `useCurrentFrame() + useMediaStartsAt()`, onde `useMediaStartsAt()` lê
  `parentSequence?.cumulatedNegativeFrom ?? 0` — ou seja, soma o deslocamento negativo acumulado das
  `<Sequence>` pai. Prático: **um `<Audio>` dentro de uma `<Sequence from={90}>` recebe `f=0` no
  frame 90 da composição.**
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/core/src/audio/use-audio-frame.ts --jq '.content' | base64 -d`
- **O que quebra se divergir:** todas as curvas de fade do manifesto de timeline. Se alguém assumir
  frame absoluto, o fade-in de 1 s acontece no início da composição, não no início da faixa — e o
  bug é silencioso em cenas que começam no frame 0 (falso verde clássico).
- **Fontes:**
  - https://www.remotion.dev/docs/audio/volume (primária) — a frase citada.
  - https://github.com/remotion-dev/remotion/blob/main/packages/core/src/audio/use-audio-frame.ts
    (primária) — `useFrameForVolumeProp`.

### R03-09 — `loopVolumeCurveBehavior`

- **Verdade operacional:** com `loop`, o padrão `'repeat'` faz `f` reiniciar do 0 a cada iteração
  (a curva se repete); `'extend'` retorna `frame + startsAt + loop.durationInFrames *
  loop.iteration`, fazendo `f` continuar crescendo através das iterações. Disponível em ambos os
  componentes.
- **Como reconferir:** mesmo arquivo de R03-08, ramo `behavior === 'repeat' || loop === null`.
- **O que quebra se divergir:** música de fundo em loop com fade-out no fim: com `'repeat'` o
  fade-out nunca chega, porque `f` reinicia.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/core/src/audio/use-audio-frame.ts
    (primária) — a lógica dos dois modos.
  - https://www.remotion.dev/docs/media/audio (primária) — lista o prop com padrão `"repeat"`.

### R03-10 — clamp em 0, amplificação livre acima de 1

- **Verdade operacional:** `evaluateVolume` termina em `return Math.max(0, evaluated);` — negativo
  vira 0 silenciosamente. Não há teto: `warnAboutTooHighVolume` só **lança erro em `volume >= 100`**
  ("Did you forget to divide by 100?"). E o prop antigo `allowAmplificationDuringRender` está
  marcado `@deprecated Amplification is now always enabled. To prevent amplification, set volume to
  a value less than 1.` Combinado com R03-17 (`normalize=0`), isto significa: **nada no Remotion
  impede clipping**; 3 faixas em `volume={1}` somam para além de 0 dBFS e o `pcm_s16le` satura.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/core/src/volume-safeguard.ts --jq '.content' | base64 -d`
- **O que quebra se divergir:** o gate de áudio. Se houvesse limiter embutido, não precisaríamos de
  um passo de loudness no FFmpeg — como não há, precisamos (ver seção 7).
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/core/src/volume-safeguard.ts +
    `volume-prop.ts` + `core/src/audio/props.ts` (primária, mesmo domínio = 1 fonte).
  - https://www.remotion.dev/docs/audio/volume (primária) — "values below 0 are not allowed".

### R03-11 / R03-12 — nomes atuais de trim

- **Verdade operacional:** a release **v4.0.319** traz literalmente
  `remotion: Rename startFrom -> trimBefore and endAt -> trimAfter (backwards-compatible)`. Em
  `packages/core/src/audio/props.ts` os antigos sobrevivem com `@deprecated 'startFrom' was renamed
  to 'trimBefore'`. Em `packages/media/src/audio/props.ts` **eles simplesmente não existem** — o
  `AudioProps` de `@remotion/media` só tem `trimBefore?: number` e `trimAfter?: number`. Unidade:
  frames da composição (`trimBefore={2 * fps}` corta 2 s). A doc de trimming confirma o exemplo.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/media/src/audio/props.ts --jq '.content' | base64 -d`
- **O que quebra se divergir:** o schema do manifesto de timeline. Se emitirmos `startFrom` para
  `<Audio>` de `@remotion/media`, é prop desconhecida — TypeScript reclama, mas JS gerado em runtime
  ignora e o trim some.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/releases/v4.0.319 (primária) — a linha do rename.
  - https://www.remotion.dev/docs/audio/trimming (primária) — unidade em frames, exemplo
    `trimBefore={2 * fps} trimAfter={4 * fps}`.

### R03-13 — `acceptableTimeShiftInSeconds` é mecanismo de **preview**, não de render

- **Verdade operacional:** a doc descreve o comportamento: *"In the Remotion Studio or in the
  Remotion Player, Remotion will seek the audio if it gets too much out of sync with Remotion's
  internal time"*, com padrão de 0.45 s. O código confirma:
  `DEFAULT_ACCEPTABLE_TIMESHIFT_WITH_NORMAL_PLAYBACK = 0.45` (e `+0.2` quando há amplificação), em
  `use-media-playback.ts`, com o comentário "In Safari, it seems to lag behind mostly around ~0.4
  seconds". Em `@remotion/media` o prop **não é de primeiro nível**: aparece apenas no tipo
  `FallbackHtml5AudioProps`. **Conclusão dura: mexer nesse prop nunca conserta drift de render — ele
  só existe no caminho de reprodução ao vivo.**
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/core/src/use-media-playback.ts --jq '.content' | base64 -d | grep -n -B3 -A6 0.45`
- **O que quebra se divergir:** o card de "áudio dessincronizado". Se alguém tentar corrigir drift
  de arquivo final mexendo aqui, gasta um dia e não muda um byte da saída.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/core/src/use-media-playback.ts
    (primária) — a constante 0.45.
  - https://www.remotion.dev/docs/html5-audio (primária) — a descrição do prop e o escopo
    Studio/Player.

### R03-14 — `toneFrequency`

- **Verdade operacional:** doc: *"Accepts a number between `0.01` and `2`, where `1` represents the
  original pitch"* e *"Only works in server-side rendering. Does not currently work in preview or in
  client-side rendering."* A validação no renderer é `toneFrequency <= 0 || toneFrequency > 2` →
  `throw new Error('toneFrequency must be a positive number between 0.01 and 2')`. A implementação
  é o truque clássico de pitch-shift: `asetrate=${sampleRate}*${toneFrequency},
  aresample=${sampleRate},atempo=1/${toneFrequency}`, presente tanto no filtro do caminho
  Html5Audio quanto em `apply-tone-frequency.ts` para o caminho `inline-audio`.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/assets/apply-tone-frequency.ts --jq '.content' | base64 -d`
- **O que quebra se divergir:** qualquer card que prometa "corrigir o tom da TTS no preview" — o
  preview não aplica.
- **Fontes:**
  - https://www.remotion.dev/docs/media/audio (primária) — faixa 0.01–2 e a restrição a SSR.
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/stringify-ffmpeg-filter.ts
    (primária) — a validação e a cadeia de filtros.

### R03-15 — sample rate: 48000 Hz por padrão, e tudo é reamostrado

- **Verdade operacional:** o valor literal está no código:
  `let currentSampleRate: number = 48000;` e `return {value: 48000, source: 'default'};` em
  `packages/renderer/src/options/sample-rate.tsx`, cuja `description` diz *"Controls the sample rate
  of the output audio. The default is 48000 Hz. Match this to your source audio to avoid resampling
  artifacts."* A precedência resolvida no `getValue` é, em ordem: **CLI (`--sample-rate`) > config
  (`Config.setSampleRate()`) > `calculateMetadata` > default 48000**. A doc `/docs/sample-rate`
  confirma que *"All audio sources — regardless of their original sample rate — are resampled to the
  output sample rate during rendering"* e que não há como preservar várias taxas num arquivo. No
  caminho FFmpeg isso é `aformat=sample_fmts=s16:sample_rates=${sampleRate}` como **primeiro**
  filtro; no caminho `@remotion/media` é `getTargetSampleRate()` (que lê
  `window.remotion_sampleRate`, senão 48000).
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/options/sample-rate.tsx --jq '.content' | base64 -d`
- **O que quebra se divergir:** o card de "normalizar entradas para 48 kHz". Se o Remotion já faz
  isso, esse card é redundante e vira só uma recomendação de qualidade (evitar reamostragem 44.1→48
  em material de TTS), não um pré-requisito de sincronia.
- **Fontes:**
  - https://www.remotion.dev/docs/sample-rate (primária) — "By default, Remotion renders all audio
    at 48000 Hz (48 kHz)"; disponível a partir de v4.0.448; lista CLI, config, `renderMedia()`,
    `renderMediaOnWeb()` e o dropdown do Studio.
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/options/sample-rate.tsx
    (primária) — o default literal e a precedência.

### R03-16 — codecs de áudio e bitrate

- **Verdade operacional (do código, que é a fonte de verdade da validação):**
  `validAudioCodecs = ['pcm-16', 'aac', 'mp3', 'opus']`. Combinações suportadas por codec de vídeo:
  `h264: aac|pcm-16|mp3`, `h265: aac|pcm-16`, `vp8/vp9: opus|pcm-16`, `av1: aac|opus|pcm-16`,
  `prores: aac|pcm-16`, `wav: pcm-16`, `gif/avi: nenhum`. Defaults: `h264` → `aac` comprimido /
  `pcm-16` com `--prefer-lossless`; `prores` → `pcm-16` nos dois modos. Mapeamento para FFmpeg:
  `aac→libfdk_aac`, `mp3→libmp3lame`, `opus→libopus`, `pcm-16→pcm_s16le`. `--audio-bitrate` usa a
  sintaxe de `-b:a` e a descrição declara **"Default: `320k`"**.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/options/audio-codec.tsx --jq '.content' | base64 -d | head -60`
  — e, na máquina, `npx remotion render --help | grep -A2 audio`.
- **O que quebra se divergir:** o card de perfil de saída. Escolher `--codec=h264 --audio-codec=opus`
  falha em tempo de render, não de plano.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/options/audio-codec.tsx
    (primária) — a lista, a matriz e os defaults; `options/audio-bitrate.tsx` para o 320k.
  - https://www.remotion.dev/docs/encoding (primária) — a página existe e documenta `--audio-codec`,
    **mas a tabela é renderizada por componente React e não sai no fetch** (ver seção 4).

### R03-17 — mixagem de N faixas: soma pura, `normalize=0`

- **Verdade operacional:** o filtro gerado é literalmente
  `[padded0][padded1]...amix=inputs=N:dropout_transition=0:normalize=0[outputaudio]`, precedido por
  `adelay`/`apad` por faixa. Pela doc do FFmpeg, o `normalize` do `amix` é **"by default enabled"** —
  ou seja, o comportamento padrão do FFmpeg (dividir pela quantidade de entradas) foi **desligado de
  propósito** pela Remotion, para que `volume={1}` signifique "ganho unitário" e não "1/N". Isso é a
  escolha certa para composição, e é exatamente por isso que a soma pode estourar. Acima de 32
  faixas o Remotion mixa em duas etapas (chunks de 10) por causa do limite do FFmpeg; com zero
  faixas ele gera silêncio (`createSilentAudio`). A saída intermediária é sempre `pcm_s16le`.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/create-ffmpeg-merge-filter.ts --jq '.content' | base64 -d`
- **O que quebra se divergir:** o gate de loudness e o card de "mixagem de N faixas". Se a
  normalização estivesse ligada, adicionar uma faixa baixaria todas as outras — e o design de
  ducking seria outro.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/create-ffmpeg-merge-filter.ts
    e `merge-audio-track.ts` (primária) — o filtro e o chunking.
  - https://ffmpeg.org/ffmpeg-filters.html (primária, domínio independente) — `amix`: *"normalize:
    Set if output of filter will be normalized, by default is enabled"*; `dropout_transition` default
    2 s; `adelay` em milissegundos; `apad`/`pad_len` em amostras; `atempo` de 0.5 a 2.0.

### R03-18 — não há normalização de loudness embutida (evidência positiva)

- **Verdade operacional:** a enumeração **completa** de `packages/renderer/src/options/` (96
  arquivos) contém, de áudio: `audio-bitrate`, `audio-codec`, `enforce-audio`, `mute`,
  `for-seamless-aac-concatenation`, `number-of-shared-audio-tags`, `prefer-lossless`,
  `preview-sample-rate`, `sample-rate`, `separate-audio`. **Nenhuma** opção de loudness, LUFS,
  limiter ou normalize. A busca por `loudnorm` no repositório inteiro devolve **2** ocorrências, e
  as duas são fora do renderer: um `.md` de skill sobre detecção de silêncio e
  `packages/docs/docs/recorder/editing/normalizing-audio.mdx`, que é um **script Bun/FFmpeg externo
  e destrutivo** (`ffmpeg -af loudnorm=I=-23:LRA=7:print_format=json` para medir, depois
  `loudnorm=I=${toApply}:LRA=7:TP=-2.0` para aplicar, sobrescrevendo os arquivos). Ou seja: a própria
  Remotion resolve loudness **antes** do render, com FFmpeg, fora do Remotion.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/options --jq '.[].name'` e
  `gh api -X GET "search/code?q=repo:remotion-dev/remotion+loudnorm" --jq '.items[].path'`
- **O que quebra se divergir:** o card de loudness sai do Remotion e entra no FFmpeg (S15). Se
  amanhã existir uma opção nativa, o card muda de dono.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/tree/main/packages/renderer/src/options (primária) —
    a lista exaustiva; e `packages/docs/docs/recorder/editing/normalizing-audio.mdx` com o script.
  - https://www.remotion.dev/docs/renderer/render-media (primária) — a lista de opções de
    `renderMedia()` (audioCodec, audioBitrate, muted, enforceAudioTrack, separateAudioTo,
    sampleRate) sem nenhuma de loudness.

### R03-19 / R03-20 — flags de CLI, grafias exatas

- **Verdade operacional:** `--separate-audio-to` (`ssrName: 'separateAudioTo'`, default `null`,
  desde v4.0.123): *"the audio will not be included in the main output but rendered as a separate
  file at the location you pass"* — e a extensão do caminho **deriva o audioCodec**, conflitando com
  `--audio-codec` se divergirem. `--muted` (`ssrName: 'muted'`, default `false`, v3.2.1). Não existe
  `--mute`. `--enforce-audio-track` (default `false`, v3.2.1) força pista de áudio silenciosa.
  Bônus: `--for-seamless-aac-concatenation` existe (default `false`) mas a própria descrição diz
  *"This option is used internally. There is currently no documentation yet for to concatenate the
  audio chunks."*
- **Como reconferir:** `npx remotion render --help`, e
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/options/separate-audio.tsx --jq '.content' | base64 -d`
- **O que quebra se divergir:** o wrapper de render. Uma flag com typo não é ignorada em silêncio no
  minimist do Remotion? Não confie — isso é LEDGER-SEED L-03.
- **Fontes:**
  - https://www.remotion.dev/docs/cli/render (primária) — lista `--audio-codec` (v3.3.42),
    `--audio-bitrate` (v3.2.32), `--enforce-audio-track` (v3.2.1), `--muted` (v3.2.1),
    `--separate-audio-to` (v4.0.123), `--sample-rate` (v4.0.448),
    `--for-seamless-aac-concatenation` (v4.0.123).
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/options/ (primária) —
    `separate-audio.tsx`, `mute.tsx`, `enforce-audio.tsx`, `for-seamless-aac-concatenation.tsx`.

### R03-21 — `@remotion/sfx` existe, mas é um catálogo de URLs remotas

- **Verdade operacional:** o pacote existe (`npx remotion add @remotion/sfx`, disponível a partir da
  **v4.0.429**, `"license": "MIT"` no package.json, versão 4.0.507). Mas o `index.ts` inteiro é uma
  lista de constantes de string:
  `export const uiSwitch = 'https://remotion.media/switch.wav' as const;` (idem `whoosh`, `whip`,
  `pageTurn`, `mouseClick`, `ding`, `vineBoom`, `wilhelmScream`, … dezenas). O uso documentado é
  `import {uiSwitch} from '@remotion/sfx'; import {Audio} from '@remotion/media'; <Audio
  src={uiSwitch} />`. **Para um pipeline local isso é uma dependência de rede em tempo de render**;
  a página de detalhe do `uiSwitch` mostra o arquivo como 0.330 s, 2 canais, **44100 Hz** (será
  reamostrado para 48000 — ver R03-15). Licença dos sons é por som (o `uiSwitch` é "UI Audio -
  Switch 35 by kenney.nl - License: Creative Commons 0"), distinta da licença MIT do pacote.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/sfx/src/index.ts --jq '.content' | base64 -d | head`
- **O que quebra se divergir:** o card "efeito sonoro". Se as constantes fossem locais, não
  precisaríamos de um passo de download; como são URLs, precisamos (ou usamos nossa própria
  biblioteca em `public/`).
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/sfx/src/index.ts (primária) — as
    constantes de URL; `packages/sfx/package.json` para versão e licença MIT.
  - https://www.remotion.dev/docs/sfx/ui-switch (primária) — o exemplo de uso e a atribuição
    CC0/kenney.nl; https://www.remotion.dev/docs/sfx/ para o `npx remotion add` e a v4.0.429.

### R03-22 / R03-23 — causas documentadas de dessincronia

- **Verdade operacional:** o post oficial "Lambda renders are now faster"
  (21 de março de 2024, Remotion v4.0.130) é a fonte primária mais explícita que existe sobre
  timing de áudio no Remotion. Ele documenta, em ordem:
  1. **`atempo` não é exato** — *"speeding up 80.000 audio samples by 2x will lead to 40.014 audio
     samples"*. Por isso o código aplica `atempo` **antes** do `atrim`, com o comentário: *"We need
     to apply the tempo filter first because the atempo filter is not frame-perfect. It creates a
     small offset and the offset needs to be the same for all audio tracks."*
  2. **AAC tem granularidade de 1024 amostras** — *"The duration of the audio must be divisible by
     1024 samples. If your audio does not fit, you must pad the last packet with silence!"*
  3. **AAC tem priming de 512 amostras** — *"each AAC file has a silence of 512 samples at the
     beginning of the file"*, compensado *"by adding a negative offset to the MP4 container"*.
  4. **Pacote AAC não é auto-contido** — *"the waveform also depends on the previous and next
     packets"*; daí o "popping noise" ao concatenar.
  5. O post afirma padronização de áudio em **48000 Hz** em todas as camadas.
  Somando ao código: o offset de início de cada faixa é `adelay=<ms>` com
  `(padStart * 1000).toFixed(0)` — **milissegundos inteiros**. Isso quantiza o início de cada faixa
  em até 0.5 ms no caminho FFmpeg (a doc do FFmpeg confirma que `adelay` é em ms salvo sufixo `S`).
  O padding no fim é `apad=pad_len=Math.round(padAtEnd * sampleRate)`, esse sim em amostras.
- **Como reconferir:** https://www.remotion.dev/blog/faster-lambda e
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/stringify-ffmpeg-filter.ts --jq '.content' | base64 -d`
- **O que quebra se divergir:** o gate de sincronia (R03 alimenta o card "medir offset A/V no
  arquivo final"). Se o offset de faixa é quantizado em ms, o gate não pode exigir tolerância menor
  que ~1 ms no caminho Html5Audio.
- **Fontes:**
  - https://www.remotion.dev/blog/faster-lambda (primária) — todas as citações acima.
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/stringify-ffmpeg-filter.ts
    (primária) — `adelay` em ms com `toFixed(0)`, `apad` em amostras, ordem atempo→atrim.
  - https://ffmpeg.org/ffmpeg-filters.html (primária, independente) — unidades de `adelay`/`apad` e
    faixa de `atempo`.

### R03-24 — MP3: o `start_time` é ignorado de propósito

- **Verdade operacional:** `getAudioChannelsAndDurationWithoutCache` roda
  `ffprobe -show_entries stream=channels:stream=start_time:format=duration:format=format_name` e
  depois faz:
  ```ts
  const isMP3 = container ? container[1] === 'mp3' : false;
  // We ignore the start time for MP3 because that is an inherent encoder thing
  // not in the sense that we want
  startTime: startTime ? (isMP3 ? 0 : parseFloat(startTime[1])) : null,
  ```
  Esse `startTime` vira `presentationTimeOffsetInSeconds`, somado ao `padStart` do `adelay`
  **apenas quando `asset.trimLeft === 0`**. Tradução: o encoder delay do MP3 é tratado no domínio do
  *tempo de apresentação* (zerando-o), **não** no domínio da taxa de amostragem. Rótulo NÃO
  VERIFICADO porque só tenho uma fonte independente (o código); a doc não menciona esse
  comportamento em lugar nenhum que eu tenha conseguido abrir.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/assets/get-audio-channels.ts --jq '.content' | base64 -d | head -60`
- **O que quebra se divergir:** o card "converter tudo para WAV antes de entrar no Remotion".
  Se o Remotion já zera o delay do MP3, a conversão é higiene, não correção — e vira decisão de
  custo, não de correção.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/assets/get-audio-channels.ts
    (primária) — o trecho literal.

### R03-25 — duas pipelines de áudio coexistem

- **Verdade operacional:** este é o achado com maior consequência arquitetural do cluster.
  - **Pipeline A (`<Html5Audio>` / `remotion`):** o componente registra um *media asset* com `src`,
    `trimLeft`, `playbackRate`, `volume` (array por frame) e `toneFrequency`. O renderer, em
    `preprocessAudioTrack`, chama FFmpeg por faixa:
    `ffmpeg -i <src> -ac 2 -filter_script:a <file> -c:a pcm_s16le -ar <sampleRate> out.wav`,
    com o filtro `aformat=sample_fmts=s16:sample_rates=SR, atempo…, atrim=…us:…us,
    volume=<expr>:eval=frame, [asetrate/aresample/atempo se toneFrequency]`.
  - **Pipeline B (`<Audio>` / `@remotion/media`):** `AudioForRendering` faz, **por frame**,
    `extractFrameViaBroadcastChannel({timeInSeconds: frame/fps, durationInSeconds: 1/fps, …})` via
    Mediabunny/WebCodecs no browser, aplica `applyVolume(audio.data, volume)` em JS e registra
    `registerRenderAsset({type: 'inline-audio', …, duration: numberOfFrames / getTargetSampleRate() *
    1e6, toneFrequency})`. No Node, `makeInlineAudioMixing` escreve isso como WAV PCM 16-bit, 2
    canais, na `sampleRate`, com `expectedDataSize = round((totalFrames/fps - trimLeftOffset +
    trimRightOffset) * 2 * sampleRate * 2)`.
  - **Convergência:** `createAudio` junta as faixas pré-processadas de A com os WAVs inline de B e
    chama `mergeAudioTrack` (o `amix` de R03-17), e só depois `compressAudio` com
    `audioCodec`/`audioBitrate`.
  **Consequência dura:** misturar `<Html5Audio>` e `<Audio>` na mesma composição significa duas
  disciplinas de timing diferentes disputando o mesmo `amix`. Padronizar em uma só é uma decisão de
  programa, não de cena.
- **Como reconferir:**
  `gh api repos/remotion-dev/remotion/contents/packages/renderer/src/create-audio.ts --jq '.content' | base64 -d | head -140`
- **O que quebra se divergir:** o card de sincronia e o gate de determinismo. Se as duas pipelines
  quantizam o início de faixa de formas diferentes (ms via `adelay` em A; amostras via cabeçalho WAV
  em B), o mesmo manifesto rende com offsets diferentes dependendo do import escolhido.
- **Fontes:**
  - https://github.com/remotion-dev/remotion/blob/main/packages/media/src/audio/audio-for-rendering.tsx
    e `packages/renderer/src/create-audio.ts`, `preprocess-audio-track.ts`,
    `assets/inline-audio-mixing.ts` (primária, mesmo domínio = 1 fonte).
  - https://www.remotion.dev/docs/mediabunny/new-video (primária) — confirma que os tags novos são
    "based on Mediabunny and WebCodecs" e "designed for frame-accurate video rendering, fast media
    extraction, minimal data fetching".

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "`@remotion/media` exporta `<Audio>`" | **CONFIRMADO** (não é refutação) | Verdade literal: `export {Audio, Video}` em `packages/media/src/index.ts`, v4.0.507. | https://github.com/remotion-dev/remotion/blob/main/packages/media/src/index.ts |
| "`<Html5Audio>` falha em SSR" | **REFUTADO** | O aviso oficial é sobre `@remotion/web-renderer` (render **no browser**, client-side, estável desde v4.0.491). No caminho server-side `<Html5Audio>` funciona e é justamente o alvo do fallback automático de `@remotion/media`. Evidência na direção oposta: `toneFrequency` *"only works in server-side rendering"*. | https://www.remotion.dev/docs/html5-audio + https://www.remotion.dev/docs/media/fallback |
| "`--seperate-audio-to`" | **REFUTADO** (grafia) | A flag é `--separate-audio-to`, `ssrName: 'separateAudioTo'`, constante `cliFlag = 'separate-audio-to'`. Não existe variante com "seperate". | https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/options/separate-audio.tsx |
| "`--mute`" | **REFUTADO** (grafia) | A flag é `--muted` (`cliFlag = 'muted'`), default `false`, desde v3.2.1. | https://www.remotion.dev/docs/cli/render |
| "normalizar tudo para 48000 Hz antes de codificar elimina o drift do padding de mp3" | **EM DISPUTA / parcial** | **Metade que se sustenta:** 48000 Hz é de fato o alvo, e tudo é reamostrado para lá — mas *pelo próprio Remotion*, não por nós; e a doc recomenda casar a taxa da fonte com a saída "to avoid resampling artifacts" (qualidade), não sincronia. **Metade que não se sustenta:** não há, em doc nem código, ligação entre sample rate e "padding de mp3". O padding/priming documentado é do **AAC** (1024 amostras por pacote, 512 de silêncio no início), e o encoder delay do **MP3** é tratado por outro mecanismo — o Remotion **zera** o `start_time` do ffprobe quando o container é mp3. Sample rate e padding são dois eixos distintos. | https://www.remotion.dev/docs/sample-rate + https://www.remotion.dev/blog/faster-lambda + https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/assets/get-audio-channels.ts |
| "existe normalização de loudness embutida" (suspeita do briefing, a confirmar) | **REFUTADO** | A enumeração completa de `packages/renderer/src/options/` não tem nenhuma opção de loudness; `amix` roda com `normalize=0` (desligando o padrão do FFmpeg); `loudnorm` só aparece na doc do Recorder, como script FFmpeg externo. | https://github.com/remotion-dev/remotion/tree/main/packages/renderer/src/options + https://ffmpeg.org/ffmpeg-filters.html |
| "`@remotion/sfx` não existe / não há efeito sonoro pronto" | **REFUTADO** | Existe desde v4.0.429, MIT, mas exporta **URLs remotas** (`https://remotion.media/*.wav`), não componente. Para pipeline local, os arquivos precisam ser baixados. | https://github.com/remotion-dev/remotion/blob/main/packages/sfx/src/index.ts |
| "usa-se `<Audio>` importado de `@remotion/sfx`" (afirmação que aparece em resumos de busca) | **REFUTADO** | `@remotion/sfx` não exporta nenhum componente. O exemplo oficial é `import {uiSwitch} from '@remotion/sfx'; import {Audio} from '@remotion/media'; <Audio src={uiSwitch} />`. | https://www.remotion.dev/docs/sfx/ui-switch |
| "`startFrom`/`endAt` são os nomes atuais" | **REFUTADO** | Renomeados na v4.0.319 para `trimBefore`/`trimAfter` (retrocompatível em `remotion`; **inexistentes** em `@remotion/media`). | https://github.com/remotion-dev/remotion/releases/v4.0.319 |
| "`acceptableTimeShiftInSeconds` conserta dessincronia do render" | **REFUTADO** | É mecanismo de Studio/Player (re-seek em reprodução ao vivo), padrão 0.45 s, e em `@remotion/media` só existe dentro de `fallbackHtml5AudioProps`. Não toca no arquivo renderizado. | https://github.com/remotion-dev/remotion/blob/main/packages/core/src/use-media-playback.ts |

---

## 4. Armadilhas (falso verde deste domínio)

- **`import {Audio} from 'remotion'` compila, roda e produz vídeo com som** → não é prova de que
  você está no componente recomendado: `Audio` ali é alias deprecado de `Html5Audio` e entra na
  pipeline FFmpeg, não na de WebCodecs. → Fica vermelho se sumir: uma regra de lint/ESLint que
  proíba esse import específico e um teste que afirme qual pipeline processou a faixa.

- **Fade testado numa cena que começa no frame 0 fica perfeito** → não é prova de que a semântica de
  `f` foi entendida: no frame 0, `useCurrentFrame()` e o `f` relativo coincidem. O bug aparece só
  quando a mídia entra dentro de uma `<Sequence from={N}>`. → Fica vermelho se sumir: uma fixture
  com áudio dentro de `<Sequence from={90}>` e uma asserção sobre o RMS do primeiro segundo.

- **Ouvir o preview no Studio e achar sincronizado** → não é prova: o Studio tem um mecanismo de
  re-seek (`acceptableTimeShiftInSeconds`, 0.45 s) que **esconde** desvio até quase meio segundo, e
  esse mecanismo não existe no render. → Fica vermelho se sumir: medir offset A/V no arquivo MP4
  final, não no preview.

- **A tabela de codecs na página `/docs/encoding` "existe"** → não é prova de que você leu os
  valores: a tabela é um componente React (`SupportedAudioCodecTable`) e **não aparece** no HTML
  buscado por ferramenta. Tudo que eu afirmo sobre a matriz de codecs veio do código-fonte
  (`options/audio-codec.tsx`), não da página. → Fica vermelho se sumir: `npx remotion render --help`
  e um render de fumaça por combinação usada.

- **`--audio-bitrate 320k` "é o default"** → cuidado: a *descrição* da opção diz "Default: 320k",
  mas o `getValue` devolve `{value: null, source: 'default'}` quando nada é passado — ou seja, a
  string `320k` é documentação do comportamento do FFmpeg a jusante, não um valor injetado pelo
  Remotion. → Fica vermelho se sumir: `ffprobe` no arquivo de saída conferindo o bitrate real.

- **Nenhum warning no render com 4 faixas em `volume={1}`** → não é prova de que não houve clipping:
  o único guarda-corpo de volume dispara em `volume >= 100`, e o `amix` roda com `normalize=0`. →
  Fica vermelho se sumir: um gate `ffmpeg -af astats` / `volumedetect` no arquivo final com limite
  de true peak.

- **Buscar "Remotion audio out of sync" e encontrar artigos que "explicam tudo"** → não é prova:
  vários dos resultados de topo (p.ex. `crepal.ai`) são conteúdo gerado, sem fonte primária, e
  afirmam causas plausíveis ("VBR mp3 causa drift, use CBR") que **não** encontrei em nenhuma doc
  nem no código do Remotion. Não usei nenhum deles como fonte. → Fica vermelho se sumir: exigir que
  todo claim de sincronia cite `remotion.dev`, o repositório, ou `ffmpeg.org`.

- **`@remotion/sfx` "resolve" efeito sonoro** → não é prova de que o pipeline é local: as constantes
  são URLs em `remotion.media`. Um render offline com SFX quebra ou trava no `delayRender`. → Fica
  vermelho se sumir: um teste de render com a rede desligada.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| L-R03-01 | Qual é o offset A/V real (ms) do MP4 final para uma faixa colocada em `<Sequence from={N}>`, no caminho `@remotion/media` vs. `<Html5Audio>`? | Assumir tolerância de gate ≤ 2 frames, apertar depois de medir. | Renderizar a mesma composição duas vezes trocando só o import; `ffprobe -show_entries stream=start_time,duration -select_streams a:0 out.mp4` e correlacionar com um click track. | O gate de sincronia (limite numérico) e a escolha de pipeline única. |
| L-R03-02 | A soma de N faixas com `volume={1}` clipa de fato em `pcm_s16le` antes do `compressAudio`? | Assumir que sim; prever headroom de -6 dBFS por faixa. | `npx remotion render … --separate-audio-to=/tmp/a.wav` e depois `ffmpeg -i /tmp/a.wav -af volumedetect -f null -` (ler `max_volume`). | O card de mixagem e a necessidade de limiter no FFmpeg. |
| L-R03-03 | Uma flag de CLI com typo (`--seperate-audio-to`) é rejeitada com erro ou ignorada em silêncio? | Assumir que é ignorada (minimist aceita chaves desconhecidas) — logo, typo = feature que não acontece. | `npx remotion render Comp out.mp4 --seperate-audio-to=/tmp/x.wav; echo $?; ls /tmp/x.wav` | A confiabilidade de todo wrapper de render gerado por LLM. |
| L-R03-04 | Qual a granularidade real da curva de volume no arquivo final — degrau de 1 frame ou rampa? | Assumir degrau de 1 frame nas duas pipelines. | Render de um fade linear de 1 s a 30 fps; `ffmpeg -af "astats=metadata=1:reset=1" -f null -` e olhar RMS por janela de 1/30 s. | Cards de fade/ducking e qualquer promessa de "fade suave". |
| L-R03-05 | Com áudio de 44.1 kHz (típico de TTS e do `@remotion/sfx`), a reamostragem para 48 kHz introduz offset mensurável? | Assumir que não introduz offset (só artefato de qualidade). | Render com fonte 44.1 e com a mesma fonte pré-convertida para 48; comparar cross-correlation dos dois WAVs de saída. | O card "normalizar entradas para 48 kHz" — vira obrigatório ou opcional. |
| L-R03-06 | O Remotion força todas as faixas a **2 canais** (`-ac 2`, `TARGET_NUMBER_OF_CHANNELS = 2`)? (claim 1-0 no código, sem segunda fonte) | Assumir que sim: saída sempre estéreo. | `ffprobe -show_entries stream=channels -select_streams a:0 out.mp4` com entrada mono. | Cards de mixagem espacial/pan e qualquer expectativa de mono. |
| L-R03-07 | Acima de 32 faixas o mix vira duas etapas (chunks de 10) — isso muda o resultado numérico? | Assumir que não muda audivelmente, mas que muda o tempo de render. | Render com 31 e com 33 faixas idênticas; comparar hashes/RMS. | Limite de faixas por cena no manifesto de timeline. |
| L-R03-08 | Os `.wav` de `@remotion/sfx` são acessíveis e cacheáveis offline? Qual o tamanho total do catálogo? | Assumir que precisamos espelhar em `public/sfx/`. | `curl -sI https://remotion.media/switch.wav` e um script que baixe a lista de `packages/sfx/src/index.ts`. | O card de efeito sonoro e a promessa de render offline. |
| L-R03-09 | `--for-seamless-aac-concatenation` é utilizável por nós ou é mesmo só interno? | Assumir interno; não usar. | `npx remotion render … --for-seamless-aac-concatenation` e inspecionar a duração do áudio vs. vídeo. | Só importa se formos renderizar em chunks e concatenar (estratégia de paralelismo). |
| L-R03-10 | Qual é o comando de instalação exato de `@remotion/media` e ele já vem no scaffold do template? (bloco de instalação da doc é componente React, não legível por fetch) | Assumir `npx remotion add @remotion/media`, por simetria com `@remotion/sfx`. | `npx remotion add --help` e `cat package.json \| jq '.dependencies'` após o scaffold. | O card de setup do projeto: um comando errado trava a onda zero. |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| Padronizamos **uma** pipeline de áudio (`@remotion/media <Audio>`) e proibimos `<Html5Audio>`, ou permitimos as duas com fallback? | Depende de apetite de risco: o pacote se autodescreve "Experimental" e a doc o chama "recommended". É uma aposta, não um fato. | Uma só: gate de lint simples, timing homogêneo, risco de quebra em upgrade. Duas: cobertura maior de formatos, mas dois modelos de timing e o dobro de fixtures de sincronia. |
| Travamos a versão do Remotion em `4.0.507` ou seguimos a `latest`? | Depende de mandato de manutenção — a linha 4.0.x muda semanalmente e mexeu em áudio recentemente (`sampleRate` em 4.0.448, client-side rendering estável em 4.0.491). | Travado: reprodutibilidade e um card recorrente de upgrade. Latest: menos atrito e cards que expiram sem aviso. |
| Onde entra o loudness: passo FFmpeg **pré-render** (normalizar cada asset), **pós-render** (loudnorm no MP4 final) ou os dois? | É trade-off de qualidade × tempo × destrutividade, e depende do alvo de publicação. O Remotion não decide isso por nós (R03-18). | Pré: mixagem previsível, mas altera os assets (a própria Remotion avisa que o script do Recorder é destrutivo). Pós: não toca nos assets, mas re-encoda o áudio final e não resolve clipping interno da soma. |
| Qual é o alvo de loudness e true peak (ex.: -14 LUFS / -1 dBTP para web, -23 LUFS para broadcast)? | É decisão editorial/de distribuição, não técnica. | Muda os parâmetros do `loudnorm`, o headroom por faixa no manifesto, e o limite do gate de áudio. |
| Usamos `@remotion/sfx` (URLs em `remotion.media`) ou espelhamos os `.wav` em `public/`? | Depende do requisito de "roda localmente": espelhar custa espaço e um passo de sync; não espelhar cria dependência de rede em tempo de render. | Espelhado: render offline garantido, um card de aquisição de asset. Direto: menos código, render que falha sem internet. |
| Aceitamos `--separate-audio-to` (áudio em arquivo separado) no pipeline, ou exigimos áudio embutido? | Depende de como o produto final é consumido e se haverá etapa de masterização externa. | Separado: permite masterizar o áudio sem re-encodar vídeo. Embutido: um artefato só, mas qualquer ajuste de áudio re-encoda tudo. |
| `@remotion/media` não declara `license` no `package.json` — a licença comercial do Remotion cobre nosso uso? | É questão jurídica/de orçamento, não dedutível de doc técnica. (Fora do escopo deste cluster; anotado porque apareceu na leitura primária.) | Muda a viabilidade do programa inteiro, não só o card de áudio. |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** o **import do componente de áudio**. Padronizar hoje em
  `import {Audio} from '@remotion/media'` custa uma linha por template de cena; reverter para
  `import {Html5Audio} from 'remotion'` custa a mesma linha **desde que** os props usados fiquem no
  subconjunto comum (`src`, `volume`, `trimBefore`, `trimAfter`, `playbackRate`, `loop`, `muted`,
  `toneFrequency`, `loopVolumeCurveBehavior`). Concretamente: **1 constante de import num arquivo de
  template + 1 regra de lint**. O que **não** é troca barata é depender de props exclusivos de um
  lado (`fallbackHtml5AudioProps`, `requestInit`, `premountFor`/`postmountFor` de um lado;
  `useWebAudioApi`, `preservePitch`, `acceptableTimeShiftInSeconds` direto do outro) — isso amarra a
  escolha.

- **Ponto de troca cara (registre agora):** a **escolha de pipeline** muda a disciplina de timing
  (ms quantizado via `adelay` vs. amostras via cabeçalho WAV) e, portanto, o número do gate de
  sincronia. Se o gate for calibrado numa pipeline e a outra for adotada depois, o gate precisa ser
  recalibrado — não é uma variável, é uma medição.

- **Skills que devem carregar este conhecimento:**
  - `S12 audio-captions-sync` — dono natural: R03-07 a R03-14 (semântica de props), R03-22 a R03-25
    (timing e pipelines), e as armadilhas de preview.
  - `S10 remotion-render-pipeline` — R03-15 a R03-20 (sample rate, codecs, flags, mixagem) e a
    ausência de normalização.
  - `S15 ffmpeg-media-ops` — R03-17, R03-18 e o passo de loudness que o Remotion empurra para fora.
  - `S09 remotion-core` — R03-01 a R03-06 (qual componente importar e por quê) e a regra de lint
    contra `import {Audio} from 'remotion'`.
  - `S13 tts-voiceover` — R03-15 (44.1 kHz da TTS será reamostrado) e R03-24 (encoder delay de MP3).

- **Cards que este cluster condiciona:**
  1. **Template de cena com áudio** — fixa o import, os nomes de props (`trimBefore`/`trimAfter`) e
     a assinatura do callback de volume com `f` relativo. Deve nascer com a fixture de
     `<Sequence from={90}>`.
  2. **Regra de lint "sem `Audio` de `remotion`"** — barata, impede a classe inteira de erro de
     R03-04.
  3. **Wrapper de render** — materializa `--audio-codec`, `--audio-bitrate`, `--sample-rate`,
     `--muted`, `--enforce-audio-track`, `--separate-audio-to` com as grafias verificadas, e falha
     ruidosamente em flag desconhecida (depende de L-R03-03).
  4. **Gate de sincronia A/V** — mede offset no arquivo final, nunca no preview; tolerância definida
     por L-R03-01.
  5. **Gate de loudness / anti-clipping** — vive no FFmpeg (S15), não no Remotion; alvo definido
     pela PERGUNTA-DONO de LUFS; entrada preferencial via `--separate-audio-to`.
  6. **Aquisição de SFX** — espelhar (ou não) o catálogo de `@remotion/sfx` para `public/`,
     decidido pela PERGUNTA-DONO de execução offline.
  7. **Card de upgrade do Remotion** — só existe se a resposta for "travar versão"; carrega a
     rechecagem dos claims (2-0) deste arquivo.

- **Data-limite de rechecagem dos claims PROVÁVEL (2-0):** rechecar ao subir de versão menor
  (4.0.507 → qualquer 4.0.5xx+) ou, no máximo, em 90 dias. O comando de rechecagem mais barato é
  `gh api repos/remotion-dev/remotion/releases/latest --jq '.tag_name'` seguido de um `grep` nos
  arquivos citados em cada claim.
