# R05 — Remotion: CLI de render, concorrência e aceleração de hardware

**Escopo desta pesquisa:** fecha o comportamento documentado e o comportamento *compilado* de
`npx remotion render` na linha 4.0.x (âncora: **Remotion 4.0.507**, publicada em 2026-08-07) —
flags existentes, semântica de `--hardware-acceleration`, `--concurrency`, `--gl`, `--chrome-mode`
e seleção de encoder. **Não** responde: números de benchmark desta máquina, licenciamento
Remotion, integração com Manim, nem nada de Lambda/Cloud Run (fora do alvo "roda localmente").

## Fontes independentes usadas (domínios distintos)

| id | domínio | tipo | o que é |
|---|---|---|---|
| **D1** | `remotion.dev` | primária | documentação oficial em prosa. **Os arquivos `packages/docs/**/*.mdx` do repositório são o MESMO artefato — não contam como segunda fonte.** |
| **D2** | `github.com/remotion-dev/remotion` | primária | **código-fonte TypeScript** no tag `v4.0.507`. Artefato distinto da prosa: descreve comportamento executável, não intenção. |
| **D3** | `registry.npmjs.org` | primária | **pacote publicado** `@remotion/renderer@4.0.507` (tarball baixado e inspecionado). É o código que realmente roda. |
| **D4** | `developer.chrome.com` | primária | documentação do Chrome sobre `chrome-headless-shell`. |

> Nota de método: quando D2 e D3 concordam, isso é uma fonte de código e uma fonte de artefato
> publicado — corroboram de forma genuinamente separada (o build pode divergir do fonte, e aqui
> não divergiu). Quando D1 discorda de D2+D3, **o código ganha** e a prosa vira linha de refutação.

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R05-01 | Em Remotion 4.0.507 `npx remotion render` documenta ~60 flags, e a lista canônica é a sequência de headings `### \`--x\`` de `packages/docs/docs/cli/render.mdx`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/cli/render |
| R05-02 | Os valores aceitos por `--hardware-acceleration` são exatamente `disable`, `if-possible`, `required`, e o default é `disable`. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/hardware-acceleration.tsx |
| R05-03 | `"disabled"` **não** é um valor aceito de `--hardware-acceleration`; passá-lo lança `Invalid value for --hardware-acceleration: disabled`, apesar de a doc em prosa escrever `"disabled"`. | (2-1) | EM DISPUTA | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/hardware-acceleration.tsx |
| R05-04 | As opções de qualidade incompatíveis com encoder acelerado são exatamente três — `crf`, `encodingMaxRate` (`--max-rate`) e `encodingBufferSize` (`--buffer-size`) — e não apenas `crf`. | (2-0) | PROVÁVEL | https://registry.npmjs.org/@remotion/renderer/-/renderer-4.0.507.tgz (`dist/esm/index.mjs`, `hasSpecifiedUnsupportedHardwareQualifySettings`) |
| R05-05 | Com `--hardware-acceleration required` + qualquer uma dessas três opções, o render **lança erro**; com `if-possible`, o Remotion **desliga silenciosamente** a aceleração e apenas emite um `Log.warn`. | (2-0) | PROVÁVEL | https://registry.npmjs.org/@remotion/renderer/-/renderer-4.0.507.tgz (`getCodecName`) |
| R05-06 | Quando o encoder é acelerado e nenhum `crf` foi passado, o Remotion **não emite `-crf` nenhum** para o FFmpeg (nem o default do codec), o que explica o arquivo maior. | (2-0) | PROVÁVEL | https://registry.npmjs.org/@remotion/renderer/-/renderer-4.0.507.tgz (`validateQualitySettings`) |
| R05-07 | A matriz de aceleração é: macOS → VideoToolbox para `prores`/`h264`/`h265`; Linux e Windows → NVENC apenas para `h264`/`h265` (a partir de v4.0.484); `vp8`/`vp9`/`av1`/`gif` nunca são acelerados. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/hardware-acceleration |
| R05-08 | `required` **não verifica se existe hardware**: em Linux/Windows a escolha de `h264_nvenc` depende só de `process.platform`, sem probe de GPU nem de capacidade do FFmpeg. | (1-0) | NÃO VERIFICADO | https://registry.npmjs.org/@remotion/renderer/-/renderer-4.0.507.tgz (`getCodecName`) |
| R05-09 | `--concurrency` aceita inteiro ou string percentual (`"50%"`), mínimo 1, e lança `Maximum for --concurrency is N` acima do número de núcleos detectados. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/concurrency.tsx |
| R05-10 | O default de concorrência é `Math.round(Math.min(8, Math.max(1, cores / 2)))` — ou seja, **teto rígido de 8**, independente de quantos núcleos a máquina tenha. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/get-concurrency.ts |
| R05-11 | A contagem de núcleos é `min(os.availableParallelism(), nproc)` — respeita limites de cgroup/container, não o hardware do host. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/get-cpu-count.ts |
| R05-12 | A doc oficial usa duas palavras diferentes para o que `--concurrency` abre — "browser tabs" na página de terminologia e "render processes" na de `renderMedia()` — e não fixa qual é. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/terminology/concurrency |
| R05-13 | Os backends válidos de `--gl` são exatamente seis: `swangle`, `angle`, `egl`, `swiftshader`, `vulkan` (v4.0.41+), `angle-egl` (v4.0.51+). | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/gl.tsx |
| R05-14 | O default de `--gl` em Remotion 4.0 é `null` (Chrome decide); em Remotion 5.0 passa a `angle`; em Lambda/Cloud Run é `swangle`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/gl-options |
| R05-15 | A recomendação oficial de `--gl` só se aplica a conteúdo WebGL/WebGPU/Three.js; sem esse conteúdo a doc manda usar o default. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/gl-options |
| R05-16 | `angle` tem vazamento de memória conhecido e a doc recomenda **quebrar renders longos em partes** quando ele é usado. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/gl.tsx |
| R05-17 | O Remotion baixa o próprio navegador (Chrome Headless Shell) para `node_modules/.remotion/chrome-headless-shell/...`, e a versão é **fixada pela versão do Remotion**: 4.0.507 embute `TESTED_VERSION = "149.0.7790.0"`. | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell |
| R05-18 | `--chrome-mode` aceita exatamente `headless-shell` (default) e `chrome-for-testing`, desde v4.0.248; `chrome-for-testing` existe para aproveitar drivers de GPU no Linux. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/chrome-mode.tsx |
| R05-19 | `--every-nth-frame` **só pode ser usado ao renderizar GIF** — não é um atalho de render rápido para vídeo. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/every-nth-frame.tsx |
| R05-20 | `--frames` aceita frame único (renderiza um still), intervalo `0-9`, intervalo aberto `100-`, e lista separada por vírgula de frames ou de intervalos. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/frames.tsx |
| R05-21 | `npx remotion still` é comando separado, usa `--frame` (singular) e **não aceita `--concurrency`**. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/cli/still |
| R05-22 | `--offthreadvideo-cache-size-in-bytes` tem default `null`, que significa **metade da memória do sistema disponível no início do render**. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/offthreadvideo-cache-size.tsx |
| R05-23 | `--enable-multiprocess-on-linux` remove a flag `--single-process` do Chromium, tem default `true` desde v4.0.137, e **será removida no Remotion v5.0**. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/enable-multiprocess-on-linux.tsx |
| R05-24 | Os defaults de CRF por codec são h264=18, h265=23, vp8=9, vp9=28, av1=30; prores/gif/aac/mp3/wav não têm CRF. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/encoding |
| R05-25 | `npx remotion benchmark` (desde v3.2.28) existe justamente para medir `--concurrency` localmente, e a doc de performance **manda usá-lo em vez de publicar números**. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/cli/benchmark |

---

## 2. Detalhe por claim

### R05-01 — Lista canônica de flags de `npx remotion render` (v4.0.507)

- **Verdade operacional:** a lista abaixo é a sequência literal de headings da página de
  referência no tag `v4.0.507`. Serve como *allowlist*: um card que use uma flag fora dela está
  inventando API.

`--props`, `--height` (3.2.40), `--width` (3.2.40), `--fps` (4.0.424), `--duration` (4.0.424),
`--concurrency`, `--pixel-format`, `--image-format` (1.4.0), `--image-sequence-pattern` (4.0.313),
`--config` (1.2.0), `--env-file` (2.2.0), `--jpeg-quality` (4.0.0), ~~`--quality`~~ (depreciada),
`--output` (4.0.0), `--overwrite`, `--sequence` (1.4.0), `--codec` (1.4.0), `--audio-codec` (3.3.42),
`--audio-bitrate` (3.2.32), `--video-bitrate` (3.2.32), `--buffer-size` (4.0.78), `--max-rate` (4.0.78),
`--prores-profile` (2.1.6), `--x264-preset`, `--gop` (4.0.466), `--crf` (1.4.0),
`--browser-executable` (1.5.0), `--chrome-mode` (4.0.248), `--scale`, `--frames` (2.0.0),
`--every-nth-frame` (3.1.0), `--muted` (3.2.1), `--enforce-audio-track` (3.2.1),
`--disallow-parallel-encoding` (4.0.315), `--number-of-gif-loops` (3.1.0), `--color-space` (4.0.28),
`--hardware-acceleration` (4.0.228), `--bundle-cache` (2.0.0), `--log`, `--port`,
`--public-dir` (3.2.13), `--timeout`, `--ignore-certificate-errors` (2.6.5),
`--disable-web-security` (2.6.5), `--disable-headless` (2.6.5), `--dark-mode` (4.0.381), `--gl`,
`--user-agent` (3.3.83), `--media-cache-size-in-bytes` (4.0.352),
`--offthreadvideo-cache-size-in-bytes` (4.0.23), `--offthreadvideo-video-threads` (4.0.261),
`--enable-multiprocess-on-linux` (4.0.42), `--repro` (4.0.88), `--binaries-directory` (4.0.120),
`--rspack` (4.0.502), `--sample-rate` (4.0.448), `--for-seamless-aac-concatenation` (4.0.123),
`--separate-audio-to` (4.0.123), `--metadata` (4.0.216), ~~`--ffmpeg-executable`~~,
~~`--ffprobe-executable`~~.

Valores de `--log`: `error`, `warn`, `info` (default), `verbose`.
Valores de `--codec`: `h264` (default), `h265`, `av1`, `png`, `vp8`, `vp9`, `mp3`, `aac`, `wav`,
`prores`, `h264-mkv`.
`--scale`: `> 0` e `<= 16`, default `1`. `--jpeg-quality`: inteiro 0–100, default `80`.
`--image-format` para vídeo: default `jpeg` (mais rápido, sem transparência).
`--timeout`: default `30000` ms — é o timeout de `delayRender()`.

- **Como reconferir:**
  `gh api "repos/remotion-dev/remotion/contents/packages/docs/docs/cli/render.mdx?ref=v4.0.507" -H "Accept: application/vnd.github.raw" | grep -E '^#{2,3} '`
- **O que quebra se divergir:** todo card que monte linha de comando de render; o wrapper Node
  que dispara o render; o schema de validação de preset de render.
- **Fontes:** https://www.remotion.dev/docs/cli/render (primária, D1 — prosa e lista de flags);
  `packages/renderer/src/options/*.tsx` no tag v4.0.507 (primária, D2 — cada arquivo declara
  `const cliFlag = '...'`, confirmando a grafia de `concurrency`, `hardware-acceleration`,
  `chrome-mode`, `gl`, `timeout`, `frames`, `every-nth-frame`, `jpeg-quality`, `scale`,
  `offthreadvideo-cache-size-in-bytes`, `buffer-size`, `max-rate`).

### R05-02 / R05-03 — Valores de `--hardware-acceleration`: `disable`, não `disabled`

- **Verdade operacional:** o enum no código é `['disable', 'if-possible', 'required'] as const`
  e o default retornado é `{source: 'default', value: 'disable'}`. O getter valida com
  `if (!hardwareAccelerationOptions.includes(value)) throw new Error(\`Invalid value for --${cliFlag}: ${value}\`)`.
  A página oficial em prosa, porém, escreve: *"By default, hardware acceleration is `"disabled"`."*
  Essa string com "d" final **não existe** no enum. Quem copiar a prosa para um arquivo de
  configuração (`Config.setHardwareAcceleration('disabled')`) recebe erro — `setConfig` roda a
  mesma validação.
  Isto está classificado como **EM DISPUTA** e não como CONFIRMADO porque há uma fonte primária
  (D1) que diz o contrário; a leitura que separa as duas é que D1 está descrevendo o *estado*
  ("a aceleração está desabilitada") e não o *literal do enum*, mas o texto é ambíguo o bastante
  para produzir código quebrado. Trate o literal do código como verdade.
- **Como reconferir:**
  `gh api "repos/remotion-dev/remotion/contents/packages/renderer/src/options/hardware-acceleration.tsx?ref=v4.0.507" -H "Accept: application/vnd.github.raw"`
  e, no pacote publicado, `grep -rho '"disable", *"if-possible", *"required"' node_modules/@remotion/renderer/dist/`
- **O que quebra se divergir:** o preset de render "sem aceleração"; qualquer `remotion.config.ts`
  gerado por LLM a partir da prosa da doc; o validador de configuração de render.
- **Fontes:**
  `packages/renderer/src/options/hardware-acceleration.tsx` @ v4.0.507 (primária, D2 — enum e default);
  `@remotion/renderer@4.0.507`, `dist/options/hardware-acceleration.js` (primária, D3 — o artefato
  publicado contém literalmente `"disable", "if-possible", "required"` e `value: "disable"`);
  https://www.remotion.dev/docs/hardware-acceleration (primária, D1 — **contradiz**, escreve `"disabled"`).

### R05-04 / R05-05 / R05-06 — "Com hwaccel não dá pra usar CRF, só bitrate": sustenta-se, mas está incompleto

- **Verdade operacional:** a afirmação **se sustenta para `crf`**, e é **incompleta** em dois eixos.
  O código publicado tem:

```js
var hasSpecifiedUnsupportedHardwareQualifySettings = ({encodingMaxRate, encodingBufferSize, crf}) => {
  if (encodingBufferSize !== null) return "encodingBufferSize";
  if (encodingMaxRate !== null)    return "encodingMaxRate";
  if (crf !== null && typeof crf !== "undefined") return "crf";
  return null;
};
```

  1. **Não é só CRF.** `--buffer-size` e `--max-rate` também são incompatíveis, e são checados
     *antes* de `crf`.
  2. **O desfecho depende do modo.** Com `required` + qualquer uma das três, `getCodecName`
     lança: *"When using hardware accelerated encoding, the option "X" with hardware acceleration
     is not supported. Disable hardware accelerated encoding or use "if-possible" instead."*
     Com `if-possible`, **não há erro**: o encoder de software é escolhido e sai apenas um
     `Log.warn` — *"Hardware accelerated encoding disabled - "X" option is not supported with
     hardware acceleration"*. Ou seja, **`if-possible` + `--crf` produz um render de software que
     parece ter funcionado**.
  3. Há ainda uma segunda barreira em `validateQualitySettings`, independente da seleção de
     encoder: `crf` + `videoBitrate` juntos lançam `"crf" and "videoBitrate" can not both be set.`,
     e `crf` + `hardwareAcceleration === "required"` lança `'"crf" option is not supported with
     hardware acceleration'`.
  4. `--max-rate` exige `--buffer-size`: `'"encodingMaxRate" can not be set without also setting
     "encodingBufferSize".'`
  5. Quando o encoder É acelerado e não há `crf`, o ramo emitido é `return [...bufSizeArray,
     ...maxRateArray]` — **sem `-crf`**. No caminho de software, o mesmo ramo injeta
     `["-crf", String(getDefaultCrfForCodec(codec))]`. É essa ausência que causa o arquivo grande
     que a doc menciona, e por isso a recomendação oficial de `--video-bitrate` (a doc cita
     `--video-bitrate=8M` como equivalente aproximado ao software para H.264 Full HD).
- **Como reconferir:** baixar o tarball e ler a função:
  `curl -sL https://registry.npmjs.org/@remotion/renderer/-/renderer-4.0.507.tgz | tar xz && grep -n -A 20 "hasSpecifiedUnsupportedHardwareQualifySettings" package/dist/esm/index.mjs`
- **O que quebra se divergir:** o card "render acelerado"; o preset de qualidade; qualquer gate
  de CI que afirme "render acelerado" sem verificar a linha de log do encoder.
- **Fontes:** `@remotion/renderer@4.0.507` `dist/esm/index.mjs`, funções
  `hasSpecifiedUnsupportedHardwareQualifySettings`, `getCodecName`, `validateQualitySettings`
  (primária, D3); https://www.remotion.dev/docs/hardware-acceleration (primária, D1 — afirma a
  incompatibilidade de `crf` e recomenda `--video-bitrate=8M`);
  https://www.remotion.dev/docs/encoding (primária, D1, mesmo domínio — *"If you enable hardware
  acceleration, you cannot set a `crf`"*).

### R05-07 / R05-08 — Matriz de aceleração e o que `required` realmente garante

- **Verdade operacional:** a seleção de encoder é uma tabela estática por `codec` × `process.platform`:

| codec | macOS | Linux / Windows | fallback software |
|---|---|---|---|
| `prores` | `prores_videotoolbox` ✅ | **não acelera** (`required` lança) | `prores_ks` |
| `h264` | `h264_videotoolbox` ✅ | `h264_nvenc` ✅ | `libx264` |
| `h265` | `hevc_videotoolbox` ✅ | `hevc_nvenc` ✅ | `libx265` |
| `vp8` / `vp9` / `av1` / `gif` | nunca | nunca | `libvpx` / `libvpx-vp9` / `libaom-av1` / `gif` |
| `h264-mkv` / `h264-ts` | nunca (`required` lança) | nunca (`required` lança) | `libx264` |

  O ponto perigoso: **não existe probe de hardware**. Na linha do `h264` em Linux o teste é
  literalmente `preferredHwAcceleration && (process.platform === "linux" || process.platform ===
  "win32") && !unsupportedQualityOption` → retorna `h264_nvenc`. Não há consulta a driver NVIDIA,
  não há `ffmpeg -encoders`, não há retry. Consequência: numa máquina Linux **sem** GPU NVIDIA,
  `--hardware-acceleration required --codec h264` **não falha na validação** — ele seleciona
  `h264_nvenc` e o processo FFmpeg quebra depois, com erro de FFmpeg, não de Remotion.
  E `if-possible` **também quebra** nesse cenário: o "if possible" cobre opções de qualidade
  incompatíveis, **não** cobre ausência de hardware.
  Note ainda a assimetria: `vp9 --hardware-acceleration required` **não lança nada** e faz encode
  de software silenciosamente, enquanto `h264-mkv --hardware-acceleration required` lança.
- **Como reconferir:** `npx remotion render <comp> --codec h264 --hardware-acceleration if-possible --log=verbose`
  e procurar a linha `Encoder: h264_nvenc, hardware accelerated: true`. A doc avisa:
  *"Don't rely on the exact wording of the log message"*. Probe direto do FFmpeg do Remotion:
  `ffmpeg -hide_banner -encoders | grep nvenc`.
- **O que quebra se divergir:** o card "detectar capacidade de GPU antes do render"; o fallback
  do runner de render; a matriz de presets por máquina.
- **Fontes:** `@remotion/renderer@4.0.507` `dist/esm/index.mjs`, `getCodecName` (primária, D3 — a
  tabela acima foi lida linha a linha do artefato publicado);
  https://www.remotion.dev/docs/hardware-acceleration (primária, D1 — confirma a matriz de
  plataformas, o requisito de driver NVIDIA 525+, que o FFmpeg embutido só traz NVENC em Linux
  x64, que ARM64 não é suportado, e que no Windows é preciso apontar `--binaries-directory` para
  um FFmpeg com NVENC).
  *R05-08 fica em NÃO VERIFICADO porque só D3 sustenta a ausência de probe; nenhuma fonte em
  prosa afirma nem nega isso. Virou LEDGER-SEED LS-02.*

### R05-09 / R05-10 / R05-11 / R05-12 — Concorrência: o que é, o default real e o teto de 8

- **Verdade operacional:** a descrição oficial da opção é *"How many CPU threads to use. Minimum 1.
  The maximum is the amount of threads you have (In Node.JS `os.cpus().length`). You can also
  provide a percentage value (e.g. `50%`)."* A validação aceita **inteiro** (rejeita fracionário:
  *"must be an integer"*) ou **string casando `/^\d+(\.\d+)?%$/`**.
  A resolução do valor é:

```js
export const resolveConcurrency = (userPreference) => {
  const maxCpus = getCpuCount();
  if (userPreference === null) return Math.round(Math.min(8, Math.max(1, maxCpus / 2)));
  // percentagem => Math.floor((percentage / 100) * maxCpus)
  if (rounded > maxCpus) throw new Error(`Maximum for --concurrency is ${maxCpus} (number of cores on this system)`);
  if (rounded < 1)       throw new Error(`Minimum for concurrency is 1.`);
  return rounded;
};
```

  Três consequências que a prosa não diz:
  1. **O default é limitado a 8.** Numa máquina de 32 threads o default é **8**, não 16. A doc
     oficial diz apenas *"Default is half of the CPU threads available"* — verdadeiro só até
     16 threads. Acima disso a prosa está errada.
  2. **O teto é o número de núcleos, e ele lança.** `--concurrency` acima de `getCpuCount()`
     aborta o render com erro — não satura silenciosamente.
  3. **A contagem de núcleos respeita container.** `getCpuCount()` é
     `min(os.availableParallelism(), nproc)`, com comentário explícito no fonte sobre Kubernetes
     e `--cpuset-cpus`. Em worktrees paralelas **no mesmo host** isso não isola nada: cada
     processo Remotion vê o host inteiro e cada um vai pedir até 8 workers. N worktrees ⇒ até
     8N workers concorrendo pela mesma CPU.
  Sobre **o que** é aberto: a página de terminologia diz *"how many browser tabs are opened in
  parallel"*; a de `renderMedia()` diz *"how many render processes should be started in parallel"*.
  As duas são D1. A doc não fecha a diferença, e por isso R05-12 fica NÃO VERIFICADO — o gargalo
  (RAM por aba vs. processo) precisa de medição local (LS-01).
- **Como reconferir:**
  `node -e "console.log(require('node:os').availableParallelism())"; nproc`
  e depois `npx remotion benchmark src/index.ts <comp> --concurrencies=1,4,8,16 --runs=3`.
- **O que quebra se divergir:** o card de paralelismo entre worktrees; o orçamento de RAM por
  render; o cálculo de quantos agentes podem renderizar ao mesmo tempo; qualquer estimativa
  de tempo de render derivada de "usa todos os núcleos".
- **Fontes:**
  `packages/renderer/src/options/concurrency.tsx` e `packages/renderer/src/get-concurrency.ts` e
  `packages/renderer/src/get-cpu-count.ts` @ v4.0.507 (primária, D2);
  `@remotion/renderer@4.0.507` — `dist/get-concurrency.js:8` e `dist/esm/index.mjs:19029` contêm
  literalmente `Math.round(Math.min(8, Math.max(1, maxCpus / 2)))`, e `dist/esm/index.mjs:6977`
  usa `availableParallelism` (primária, D3 — o teto de 8 está no pacote que roda, não só no fonte);
  https://www.remotion.dev/docs/renderer/render-media e
  https://www.remotion.dev/docs/renderer/render-frames (primária, D1, mesmo domínio — *"Default is
  half of the CPU threads available"*, sem mencionar o teto);
  https://www.remotion.dev/docs/terminology/concurrency (primária, D1 — *"Higher concurrency can
  lead to faster render times, but too high concurrency will lead to diminishing returns and to
  overload of the machines, which might crash a render."*).

### R05-13 / R05-14 / R05-15 / R05-16 — `--gl`: backends, default e quando GPU ajuda

- **Verdade operacional:** o array de validação é
  `['swangle', 'angle', 'egl', 'swiftshader', 'vulkan', 'angle-egl'] as const`, e um valor fora
  disso lança `TypeError: X is not a valid GL backend. Accepted values: swangle, angle, egl,
  swiftshader, vulkan, angle-egl`. `null` é aceito e significa "deixa o Chrome decidir".
  O default é calculado por `getDefaultOpenGlRenderer(ENABLE_V5_BREAKING_CHANGES)`: `null` em
  4.0.x, `'angle'` em 5.0. Lambda/Cloud Run usam `swangle` em todas as versões.
  Recomendação oficial (4.0), **condicionada a WebGL/WebGPU/Three.js**: desktop → `angle`;
  instância cloud com GPU → `angle-egl`; Lambda → `swangle`; máquina sem GPU → `swangle`
  (com a nota de que é lento). **Sem conteúdo WebGL, a doc manda ficar no default.**
  Para um vídeo técnico Remotion feito de DOM/CSS/SVG mais vídeos do Manim, isso significa que
  mexer em `--gl` é, por default, ruído — não ganho.
  Duas advertências: (a) `angle` tem vazamento de memória conhecido, com recomendação explícita
  de partir renders longos; (b) o changelog embutido registra que entre v2.4.3 e v2.6.6 o default
  era `angle` e foi revertido justamente por esse leak.
  **Discrepância de versão não resolvida:** o fonte de `gl.tsx` anota `angle-egl` como
  *"from Remotion v4.0.51"*; a leitura da página renderizada devolveu "v4.0.52". Adote 4.0.51
  (literal do fonte) e trate a diferença de um patch como irrelevante para decisão.
  Sobre GPU em geral: a doc de GPU lista como acelerados WebGL (Three.js, Skia, P5.js, Mapbox),
  decodificação de vídeo, `box-shadow`, `text-shadow`, gradientes, `filter: blur/drop-shadow`,
  transforms e parte do Canvas — e avisa que **aceleração de GPU é desativada em modo headless
  por padrão**, o que é exatamente o motivo de `--gl` existir.
- **Como reconferir:** `npx remotion gpu` (desde v4.0.52) imprime como o Chrome está usando a GPU.
  A própria doc avisa: *"The output should not be used for automated parsing, as it may change
  inbetween any Remotion and Chrome versions."* — logo, **não** faça gate de CI em cima disso.
- **O que quebra se divergir:** o card de configuração de render por máquina; qualquer card que
  prometa "usar a GPU" para composições sem WebGL; a decisão de partir render longo em partes.
- **Fontes:** `packages/renderer/src/options/gl.tsx` @ v4.0.507 (primária, D2 — array
  `validOpenGlRenderers`, `getDefaultOpenGlRenderer`, changelog embutido, aviso de memory leak);
  https://www.remotion.dev/docs/gl-options (primária, D1 — tabela de recomendação por ambiente e
  defaults); https://www.remotion.dev/docs/gpu e https://www.remotion.dev/docs/chromium-flags e
  https://www.remotion.dev/docs/cli/gpu (primária, D1, mesmo domínio — lista de features
  aceleradas, headless desativa GPU, comportamento de `npx remotion gpu`).

### R05-17 / R05-18 — Chrome próprio, versão fixada, e determinismo entre máquinas

- **Verdade operacional:** *"Remotion is automatically installing 'Chrome Headless Shell' into your
  `node_modules` in order to render videos."* O destino é
  `node_modules/.remotion/chrome-headless-shell/[platform]/chrome-headless-shell-[platform]`
  (e `node_modules/.remotion/chrome-for-testing/[platform]` no outro modo). O download vem de
  `https://storage.googleapis.com/chrome-for-testing-public/${TESTED_VERSION}/${platform}/chrome-headless-shell-${platform}.zip`.
  **A versão do Chrome é uma constante compilada dentro do `@remotion/renderer`**: em 4.0.507,
  `var TESTED_VERSION = "149.0.7790.0"`. A doc publica o histórico: v4.0.452→149.0.7790.0,
  v4.0.414→144.0.7559.97, v4.0.315→134.0.6998.35, v4.0.274→133.0.6943.141, v4.0.245→123.0.6312.86.
  **Consequência para reprodutibilidade:** *pinar a versão exata do Remotion no `package.json`
  (sem `^`) pina o Chrome junto.* Não existe flag "escolha a versão do Chrome" no `render` — o
  controle é a versão do Remotion. A doc recomenda explicitamente *"use the Remotion mechanisms
  which uses and pins the version of Chrome Headless Shell"* e usar **v4.0.208+** para não pegar
  um navegador instalado externamente. O escape hatch é `--browser-executable`, que
  **desfaz** a garantia (você passa a depender do Chrome do host).
  `--chrome-mode` (v4.0.248+) tem exatamente dois valores, `headless-shell` (default) e
  `chrome-for-testing`; a orientação oficial é usar `chrome-for-testing` *"only if you want to set
  up a GPU-accelerated rendering environment on Linux"*. Um valor inválido lança
  `Invalid \`--chrome-mode\` value passed. Accepted values: 'headless-shell', 'chrome-for-testing'.`
  Contexto do Chrome: `chrome-headless-shell` é o headless *antigo*, *"a lightweight wrapper around
  Chromium's `//content` module"*, com menos dependências (não precisa de X11/Wayland nem D-Bus);
  o headless novo *"is the real Chrome browser, and is thus more authentic, reliable, and offers
  more features"*. Isso explica o trade-off do `--chrome-mode`: velocidade/leveza vs. fidelidade
  e drivers de GPU.
- **Como reconferir:**
  `node -e "console.log(require('@remotion/renderer/package.json').version)"` e
  `grep -rho 'TESTED_VERSION *= *"[^"]*"' node_modules/@remotion/renderer/dist/esm/index.mjs`
  e `ls node_modules/.remotion/`
- **O que quebra se divergir:** o gate de regressão visual (um bump de Chrome muda antialiasing e
  layout de fonte ⇒ todas as fixtures de still viram vermelho); a política de lockfile; o card de
  setup de worktree (cada worktree com `node_modules` próprio baixa o Chrome de novo — custo de
  disco e de rede).
- **Fontes:** https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell (primária, D1 —
  instalação automática, caminho no `node_modules`, tabela de versões por release, orientação de
  pinagem, v4.0.208+); `@remotion/renderer@4.0.507` `dist/esm/index.mjs:6544`
  (primária, D3 — `TESTED_VERSION = "149.0.7790.0"` e a URL de download do Google);
  https://developer.chrome.com/blog/chrome-headless-shell (primária, D4 — o que é o binário, desde
  o Chrome 120 no Chrome for Testing, e o trade-off contra o headless novo);
  `packages/renderer/src/options/chrome-mode.tsx` @ v4.0.507 (primária, D2 — enum e default);
  https://www.remotion.dev/docs/cli/browser/ensure (primária, D1, mesmo domínio — `npx remotion
  browser ensure`, desde v4.0.137, para pré-baixar o navegador).

### R05-19 / R05-20 / R05-21 — Render parcial e stills para regressão visual

- **Verdade operacional:** para teste de regressão visual há **dois** caminhos, e eles não são
  intercambiáveis:
  - `npx remotion still <entry> <comp> <out.png>` com `--frame N` (singular). Aceita `--image-format`,
    `--jpeg-quality`, `--scale`, `--output`, `--timeout`, `--gl`, `--chrome-mode`,
    `--offthreadvideo-cache-size-in-bytes`, `--enable-multiprocess-on-linux`, `--bundle-cache`.
    **Não aceita `--concurrency`** (não está na lista de flags da página) nem `--codec`/`--crf`.
    `--frame` aceita valores negativos para contar de trás para frente.
  - `npx remotion render ... --frames=...` — a gramática, lida do parser: número único
    (*"Pass a single number to render a still"*), intervalo `0-9`, intervalo aberto `100-`, e
    listas por vírgula que podem ser só frames (`10,20,30`) ou intervalos (`0-9,50-59`). O parser
    valida que num intervalo o segundo número seja `>= ` o primeiro (*"The second number of the
    --frames flag number should be greater or equal than first number"*) e rejeita entradas vazias
    entre vírgulas.
  - **`--every-nth-frame` NÃO serve para acelerar teste de vídeo.** A descrição da opção é
    categórica: *"This option may only be set when rendering GIFs."* A doc de `renderFrames()`
    reforça: *"Only meant for rendering GIFs"*, e que não combina com `frames`/`frameRange`.
    Um card que proponha `--every-nth-frame 5` para "preview rápido de MP4" está errado.
  - **Recomendações oficiais de velocidade** (página de performance): `jpeg` em vez de `png`
    (*"If you set the image format `png`, it is slower than `jpeg`"*); baixar `--scale`;
    evitar `vp8`/`vp9` (*"very slow at encoding due to stronger compression"*); `--log=verbose`
    para listar os frames mais lentos; e `npx remotion benchmark` para achar a concorrência ótima.
- **Como reconferir:** `npx remotion still src/index.ts MyComp out/f30.png --frame=30 --scale=0.5`
  e `npx remotion render src/index.ts MyComp out/probe.mp4 --frames=0-9,100-109`
- **O que quebra se divergir:** o card de fixtures de regressão visual; o gate de "diff de still";
  qualquer atalho de preview rápido baseado em `--every-nth-frame`.
- **Fontes:** `packages/renderer/src/options/frames.tsx` e `every-nth-frame.tsx` @ v4.0.507
  (primária, D2 — gramática do parser e restrição a GIF);
  https://www.remotion.dev/docs/cli/still (primária, D1 — lista completa de flags do comando, que
  é a evidência positiva de que `--concurrency` não está lá);
  https://www.remotion.dev/docs/performance e https://www.remotion.dev/docs/renderer/render-frames
  (primária, D1, mesmo domínio — recomendações de velocidade e `everyNthFrame` só para GIF).

### R05-22 / R05-23 / R05-24 / R05-25 — Cache de vídeo, multiprocesso, CRF e benchmark

- **Verdade operacional:**
  - `--offthreadvideo-cache-size-in-bytes`: default `null` = *"half of the system memory available
    when the render starts"*. *"The higher it is, the faster the render will be, but the more
    memory will be used. The used value will be printed when running in verbose mode."* A
    validação exige inteiro positivo finito. **Isso é o item mais perigoso para worktrees
    paralelas:** dois renders simultâneos com default pedem, cada um, metade da RAM da máquina.
  - `--enable-multiprocess-on-linux`: *"Removes the `--single-process` flag that gets passed to
    Chromium on Linux by default. This will make the render faster because multiple processes can
    be used, but may cause issues with some Linux distributions or if window server libraries are
    missing."* Default `false` até v4.0.136, **`true` a partir de v4.0.137** porque versões novas
    do Chrome não renderizam com `--single-process`. *"This flag will be removed in Remotion v5.0."*
    Em 4.0.507 já vem ligada — não é um ganho a conquistar, é um default a não quebrar.
  - CRF: defaults `{h264: 18, h265: 23, vp8: 9, vp9: 28, av1: 30, "h264-mkv": 18, "h264-ts": 18,
    prores: null, gif: null, aac/mp3/wav: null}`; faixas `{h264: [1,51], h265: [0,51], vp8: [4,63],
    vp9: [0,63], av1: [0,63], prores: [0,0], gif: [0,0]}`. Menor = melhor qualidade.
  - `npx remotion benchmark <entry> [composition-ids]` desde **v3.2.28**, com `--runs` e
    `--concurrencies`. **Não existe benchmark oficial publicado com números**: a doc de performance
    resolve a pergunta "quanto tempo leva" mandando medir localmente. Qualquer número de
    tempo/custo no roadmap tem de vir desta máquina.
  - `--repro` (v4.0.88): *"Create a ZIP that you can submit to Remotion if asked for a
    reproduction."* — é ferramenta de bug report, **não** é mecanismo de reprodutibilidade de
    render. Não use para determinismo.
  - `--for-seamless-aac-concatenation` (v4.0.123): *"the audio is trimmed to the nearest AAC frame,
    which is required for seamless concatenation of AAC files"*, e o próprio fonte avisa
    *"This option is used internally. There is currently no documentation yet for how to
    concatenate the audio chunks."* Relevante se o pipeline renderizar cenas separadas e concatenar;
    e é justamente onde a doc admite lacuna.
  - Versão de referência: `remotion@4.0.507` é `latest` no npm em 2026-08-07; a licença declarada
    no `package.json` é `SEE LICENSE IN LICENSE.md` — **não é uma licença OSS padrão**, e isso é
    assunto de outro cluster, mas invalida qualquer card que assuma MIT.
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/remotion | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['dist-tags']['latest'])"`
  e `npx remotion render ... --log=verbose 2>&1 | grep -i "cache"`
- **O que quebra se divergir:** o orçamento de RAM do runner paralelo; o card de concatenação de
  cenas; qualquer estimativa de tempo no roadmap; o card de licenciamento.
- **Fontes:** `packages/renderer/src/options/{offthreadvideo-cache-size,enable-multiprocess-on-linux,repro,for-seamless-aac-concatenation,jpeg-quality,scale,timeout}.tsx`
  @ v4.0.507 (primária, D2); `@remotion/renderer@4.0.507` `dist/esm/index.mjs` — `defaultCrfMap` e
  `crfRanges` (primária, D3); https://www.remotion.dev/docs/encoding,
  https://www.remotion.dev/docs/config, https://www.remotion.dev/docs/cli/benchmark,
  https://www.remotion.dev/docs/performance (primária, D1, mesmo domínio);
  https://registry.npmjs.org/remotion (primária, D3 — `dist-tags.latest = 4.0.507`, publicado
  2026-08-07T12:28Z, `license: "SEE LICENSE IN LICENSE.md"`);
  releases do repositório via `gh api repos/remotion-dev/remotion/releases` (primária, D2 —
  `v4.0.507` em 2026-08-07).

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| (linha 120) *"alinhar buffers interligados como `--buffer-size` em complementaridade [ao `--video-bitrate`, sob aceleração de hardware] mitiga severamente a degradação"* | **REFUTADO** | `--buffer-size` (`encodingBufferSize`) é uma das **três opções proibidas** com encoder acelerado, e é a **primeira** checada. Com `--hardware-acceleration required` o render **lança erro**; com `if-possible` ele **desliga a aceleração** e cai para software com um `Log.warn`. A receita do panorama produz exatamente o oposto do que promete. | `@remotion/renderer@4.0.507`, `hasSpecifiedUnsupportedHardwareQualifySettings` / `getCodecName` (D3); https://www.remotion.dev/docs/hardware-acceleration (D1) |
| (linha 120) *"a utilização do encoder com hardware nativo proíbe a dependência do CRF e dita o uso exclusivo de débitos via `--video-bitrate`"* | **PARCIALMENTE CONFIRMADO** | Verdadeiro para `h264`/`h265`. Falso para `prores`: `validateQualitySettings` faz `console.warn("ProRes does not support videoBitrate. Ignoring.")` e retorna `[]`. Em ProRes acelerado (macOS/VideoToolbox) você não controla nem por CRF nem por bitrate — só por `--prores-profile`. E a lista de proibidos é maior que `crf`. | `@remotion/renderer@4.0.507`, `validateQualitySettings` (D3) |
| (linhas 113-116) receita `npx remotion render ... --hardware-acceleration required --video-bitrate 18M` como caminho padrão local | **EM DISPUTA** | A flag e o valor existem, mas `required` **não verifica hardware**: em Linux sem GPU NVIDIA ele seleciona `h264_nvenc` só por `process.platform` e a falha aparece depois, como erro do FFmpeg. Além disso o FFmpeg embutido só traz NVENC em **Linux x64** (ARM64 não suportado). A receita só é segura depois de um probe da máquina. | `@remotion/renderer@4.0.507`, `getCodecName` (D3); https://www.remotion.dev/docs/hardware-acceleration (D1) |
| (linha 110) *"para injetar o motor NVENC ... utiliza-se o argumento `--hardware-acceleration`"*, citando a fonte 48 = `docs/cli/render` | **PARCIALMENTE CONFIRMADO** | A flag existe (v4.0.228+), mas **NVENC em Linux/Windows só existe a partir de v4.0.484**. Antes disso `--hardware-acceleration` era efetivamente só macOS/VideoToolbox. Um card que fixe uma versão de Remotion < 4.0.484 e prometa NVENC está errado. | https://www.remotion.dev/docs/hardware-acceleration (D1, `<AvailableFrom v="4.0.484" />`) |
| Doc oficial (não o panorama): *"By default, hardware acceleration is `"disabled"`"* | **REFUTADO** (o literal) | O enum é `['disable','if-possible','required']` e o default é `'disable'`. `'disabled'` lança `Invalid value for --hardware-acceleration: disabled`. | `packages/renderer/src/options/hardware-acceleration.tsx` @ v4.0.507 (D2); `@remotion/renderer@4.0.507` `dist/options/hardware-acceleration.js` (D3) |
| Doc oficial (não o panorama): *"Default is half of the CPU threads available"* para `concurrency` | **REFUTADO** (acima de 16 threads) | O default é `Math.round(Math.min(8, Math.max(1, cores/2)))`. Em máquina de 32 threads o default é **8**, não 16. A prosa só é verdadeira até 16 threads. | `packages/renderer/src/get-concurrency.ts` @ v4.0.507 (D2); `@remotion/renderer@4.0.507` `dist/get-concurrency.js:8` (D3) |
| Flags `--delay-render-timeout` e `--output-still` (levantadas na lista de investigação) | **REFUTADO** | Não existem em `npx remotion render`. Evidência positiva: a página de referência lista **todas** as flags e nenhuma das duas está lá. O timeout de `delayRender()` é `--timeout` (o option interno chama-se `delayRenderTimeoutInMillisecondsOption`, mas `const cliFlag = 'timeout'`); render de still é o **comando separado** `npx remotion still` com `--frame`. | https://www.remotion.dev/docs/cli/render (D1, lista completa); `packages/renderer/src/options/timeout.tsx` @ v4.0.507 (D2, `cliFlag = 'timeout'`) |
| `--every-nth-frame` como acelerador genérico de render/preview | **REFUTADO** | *"This option may only be set when rendering GIFs."* Não combina com `frames`/`frameRange`. Para preview parcial de vídeo o correto é `--frames`. | `packages/renderer/src/options/every-nth-frame.tsx` @ v4.0.507 (D2); https://www.remotion.dev/docs/renderer/render-frames (D1) |

---

## 4. Armadilhas (falso verde deste domínio)

- **`--hardware-acceleration if-possible` "funcionou"** → o render terminou com exit code 0 e um MP4
  válido saiu → *não é prova*: se você passou `--crf`, `--max-rate` ou `--buffer-size`, o Remotion
  desligou a aceleração e usou `libx264`, deixando só um `Log.warn` no meio da saída. → Fica
  vermelho se sumir: um gate que rode com `--log=verbose` e exija a linha
  `hardware accelerated: true`. Sem esse gate, "render acelerado" é uma crença.

- **O render acelerado ficou 3× maior e você culpou o encoder** → *não é prova* de que NVENC/VideoToolbox
  comprime mal: quando o encoder é acelerado o Remotion **não emite `-crf` nenhum**, nem o default do
  codec. O tamanho é consequência de não haver controle de taxa. → Fica vermelho se sumir: uma
  asserção de tamanho/bitrate do arquivo de saída no gate de render.

- **`--hardware-acceleration required` passou na validação em Linux** → *não é prova* de que existe
  GPU: a seleção de `h264_nvenc` olha só `process.platform`. A falha migra para o FFmpeg, aparece
  como erro de encoder e é fácil de diagnosticar errado como "vídeo corrompido". → Fica vermelho se
  sumir: um probe de capacidade (`ffmpeg -encoders | grep nvenc`) rodado **antes** do render e
  gravado no ledger da máquina.

- **`--concurrency` não foi passado, logo "está usando a máquina toda"** → *não é prova*: o default é
  no máximo **8**, mesmo em 32 threads. Em uma máquina grande você está usando um quarto dela e
  achando que o Remotion é lento. → Fica vermelho se sumir: registrar a concorrência efetiva
  (`onStart` expõe `resolvedConcurrency`) no metadata de cada render.

- **Duas worktrees renderizando em paralelo, cada uma "com metade da RAM"** → *não é prova* de que cabe:
  o default de `offthreadVideoCacheSizeInBytes` é metade da memória **disponível no início daquele
  render**, calculado independentemente por processo. Dois processos ⇒ os dois pedem metade ⇒
  estouro. O mesmo vale para concorrência: N worktrees × até 8 workers. → Fica vermelho se sumir:
  um teto explícito de `--concurrency` e de `--offthreadvideo-cache-size-in-bytes` por worktree,
  mais um semáforo de render global.

- **A regressão visual passou na sua máquina** → *não é prova* de que passa na do agente: o Chrome é
  fixado pela versão do Remotion (`TESTED_VERSION`), então um `^4.0.x` no `package.json` pode trocar
  o Chrome entre `npm install`s e mudar antialiasing/layout de fonte. → Fica vermelho se sumir: a
  versão exata do Remotion no lockfile + a versão do Chrome gravada junto de cada fixture.

- **`--browser-executable` "resolveu o download lento do Chrome"** → *não é prova* de equivalência:
  você acabou de trocar um binário fixado por um binário do host, e perdeu a garantia de
  determinismo entre máquinas. → Fica vermelho se sumir: o gate de regressão visual, que passa a
  falhar de forma não reproduzível.

- **`--gl=angle` deixou o render mais rápido num teste** → *não é prova* de que é a escolha certa: a
  recomendação oficial de `angle` é para conteúdo WebGL/WebGPU/Three.js, e `angle` tem vazamento de
  memória documentado que derruba renders longos. Um teste curto não expõe o leak. → Fica vermelho
  se sumir: um teste de render longo (duração real do vídeo alvo) antes de fixar o backend.

- **`--repro` como garantia de reprodutibilidade** → *não é prova*: a flag só gera um ZIP para enviar
  ao suporte do Remotion. Não fixa nada. → Fica vermelho se sumir: nada — o card baseado nessa
  leitura simplesmente não deve existir.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-01 | `--concurrency` abre abas de Chrome ou processos, e qual o custo de RAM por unidade nesta máquina? | Assumir **1 processo Chrome por unidade de concorrência**, ~400 MB–1 GB cada, até medir. | `npx remotion render <comp> --concurrency=4 --log=verbose &` e em paralelo `ps -eo pid,rss,comm --sort=-rss \| head -20` | Orçamento de RAM do runner paralelo; número de worktrees que podem renderizar juntas. |
| LS-02 | Esta máquina tem NVENC utilizável pelo FFmpeg que o Remotion embute? | Assumir **não**, e usar `--hardware-acceleration disable` como default até provar o contrário. | `ffmpeg -hide_banner -encoders \| grep -E 'nvenc'` e `nvidia-smi`; depois `npx remotion render <comp> --codec h264 --hardware-acceleration if-possible --log=verbose \| grep -i "hardware accelerated"` | O card de render acelerado; o tempo estimado de render; a escolha entre `--crf` e `--video-bitrate`. |
| LS-03 | Qual a concorrência ótima aqui (o default 8 é bom, ruim ou irrelevante)? | Não fixar; rodar o benchmark e gravar o número no ledger. | `npx remotion benchmark src/index.ts <comp> --concurrencies=1,2,4,8,16 --runs=3` | Toda estimativa de tempo do roadmap; o card de paralelismo. |
| LS-04 | Quantos núcleos o Remotion enxerga dentro de uma git worktree / container? | Assumir que enxerga o host inteiro (worktree não isola CPU). | `node -e "console.log(require('node:os').availableParallelism())"; nproc` | O semáforo de render entre agentes paralelos. |
| LS-05 | O default de cache do OffthreadVideo (metade da RAM) inviabiliza render simultâneo? | Fixar `--offthreadvideo-cache-size-in-bytes` explicitamente por worktree em vez de usar o default. | `npx remotion render <comp> --log=verbose 2>&1 \| grep -i cache` (a doc diz que o valor usado é impresso em verbose) | O card de execução paralela; o limite de agentes concorrentes. |
| LS-06 | `--gl` default (`null`) vs `angle` vs `swangle`: qual é mais rápido e estável para as composições reais deste projeto? | Ficar no default (`null`) enquanto não houver WebGL/Three.js na cena. | `npx remotion benchmark src/index.ts <comp> --runs=3` uma vez por valor de `--gl`; e `npx remotion gpu` para inspeção | O card de configuração de render; a decisão de partir renders longos. |
| LS-07 | Um render longo com `--gl=angle` sobrevive ao vazamento de memória documentado? | Se `angle` for necessário, **partir o render em segmentos** por `--frames` desde o começo. | render da duração alvo real com `/usr/bin/time -v` e monitoramento de RSS | A arquitetura de render (monolítico vs. segmentado + concatenação). |
| LS-08 | A troca de versão do Remotion (e portanto do Chrome) muda as fixtures de regressão visual? | Pinar Remotion sem `^` e tratar bump de Remotion como evento que re-baseia fixtures. | gravar `TESTED_VERSION` junto de cada fixture; após bump, `npx remotion still ... --frame=N` e diff das imagens | O gate de regressão visual; a política de atualização de dependências. |
| LS-09 | ProRes acelerado (só macOS) é relevante aqui, ou a máquina é Linux? | Esta máquina é Linux (`Linux 6.18.7`) ⇒ ProRes **nunca** acelera; `--hardware-acceleration required --codec prores` lança. | `uname -s` | O card de master intermediário em ProRes. |
| LS-10 | Renderizar N composições ao mesmo tempo bate melhor que uma composição com concorrência alta? | Preferir **uma composição por vez com concorrência calibrada**, até medir o contrário. | comparar `benchmark` de 1 comp × concorrência 8 contra 4 processos × concorrência 2 | O desenho do orquestrador de render entre worktrees. |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| A máquina de render tem GPU NVIDIA, e ela é dedicada ao projeto ou compartilhada? | É fato de hardware e de uso, não de documentação. `nvidia-smi` diz se existe, mas não se o dono aceita saturá-la. | Sem NVIDIA: `--hardware-acceleration disable` vira default permanente e o CRF continua disponível. Com NVIDIA: entra um card de probe + preset de bitrate e o CRF sai do vocabulário para h264/h265. |
| Qual é o teto aceitável de uso da máquina enquanto os agentes trabalham (render pode consumir 100% da CPU e travar o editor do dono)? | É apetite de risco/conforto, não dado técnico. | Teto alto: concorrência perto do número de núcleos, render monolítico. Teto baixo: concorrência fixa (2–4), semáforo global, render em segmentos. |
| Quantos renders simultâneos entre worktrees o dono quer permitir? | O Remotion não coordena processos entre si; cada um assume que é o único (metade da RAM, até 8 workers). A política é humana. | 1 por vez: nenhum card de semáforo, defaults do Remotion servem. N por vez: card de semáforo + tetos explícitos de `--concurrency` e cache. |
| Determinismo entre máquinas é requisito de gate (build quebra) ou só desejável? | Depende de o dono aceitar re-baselinar fixtures a cada bump de Chrome/Remotion. | Requisito: pin exato de Remotion, proibição de `--browser-executable`, fixtures versionadas com a versão do Chrome. Desejável: `^4.0.x` e tolerância por diff perceptual. |
| Qualidade alvo do master: arquivo pequeno (CRF) ou render rápido (hwaccel + bitrate)? | É trade-off de produto. As duas rotas são mutuamente exclusivas no Remotion. | CRF: sem aceleração, mais lento, menor. Hwaccel: mais rápido, maior, e `--crf`/`--buffer-size`/`--max-rate` ficam **proibidos**. |
| O pipeline vai renderizar cenas separadas e concatenar, ou um master único? | É decisão de arquitetura. Afeta `--for-seamless-aac-concatenation`, cuja própria doc admite não ter procedimento publicado. | Master único: ignore a flag. Segmentado: entra um card de concatenação com risco documentado (a doc oficial diz que não há documentação para concatenar os chunks de áudio). |
| Aceita fixar Remotion numa versão ≥ 4.0.484 (requisito de NVENC) mesmo que isso force outras atualizações? | Requisito de compatibilidade com o resto do stack, que o dono conhece. | < 4.0.484: NVENC não existe, aceleração é só macOS. ≥ 4.0.484: NVENC disponível em Linux x64 (não ARM64). |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** a escolha entre **CRF** e **hardware acceleration + video-bitrate** deve
  viver em **uma única variável de preset** (ex.: um objeto `renderPreset` num arquivo só), nunca
  espalhada em linhas de comando dentro de cards. As duas rotas são mutuamente exclusivas e a
  escolha depende de LS-02, que só a máquina responde. Custo de reversão desejado: **1 arquivo,
  1 objeto**. Se a decisão vazar para os comandos dos cards, a reversão passa a custar um card por
  ocorrência — e cada card errado carrega `--buffer-size` junto, que é justamente o combinado que
  quebra.

- **Ponto de troca cara (não reversível de graça):** a versão do Remotion, porque ela pina o Chrome
  e portanto o baseline de todas as fixtures de regressão visual. Trate bump de Remotion como
  evento de re-baseline planejado, não como manutenção de rotina.

- **Skills que devem carregar este conhecimento:**
  - a skill de **render/CLI Remotion** — precisa da allowlist de flags de R05-01 e da regra de que
    `--every-nth-frame` é só GIF e de que `--delay-render-timeout`/`--output-still` não existem;
  - a skill de **aceleração/encoding** — precisa da tabela codec × plataforma, das três opções
    proibidas e da diferença entre `required` (lança) e `if-possible` (degrada em silêncio);
  - a skill de **execução paralela em worktrees** — precisa do teto de 8, do `min(availableParallelism, nproc)`
    e do cache de metade da RAM por processo;
  - a skill de **regressão visual** — precisa de `npx remotion still --frame`, de `--frames` com
    listas, e da pinagem Remotion→Chrome.

- **Cards que este cluster condiciona:**
  1. **Probe de capacidade da máquina** — roda `nvidia-smi`, `ffmpeg -encoders | grep nvenc`,
     `nproc`, `availableParallelism`, `free -m`, e grava um arquivo de perfil da máquina. É
     pré-requisito de qualquer card de render. Fecha LS-02, LS-04.
  2. **Preset de render único e versionado** — o objeto que decide codec, CRF *ou* bitrate,
     concorrência, cache e `--gl`, derivado do perfil da máquina. É o ponto de troca barata.
  3. **Gate "a aceleração realmente aconteceu"** — render com `--log=verbose` + asserção da linha
     `hardware accelerated: true`, com a ressalva documentada de que o texto do log pode mudar
     entre versões (logo, o gate precisa ser fácil de atualizar).
  4. **Semáforo de render entre worktrees** — com teto explícito de `--concurrency` e de
     `--offthreadvideo-cache-size-in-bytes` por processo. Fecha LS-01, LS-05, LS-10.
  5. **Fixtures de regressão visual por still** — `npx remotion still --frame=N` em frames-âncora,
     com a versão do Remotion e do Chrome gravadas ao lado de cada imagem. Fecha LS-08.
  6. **Calibração de concorrência** — roda `npx remotion benchmark` uma vez e grava o número no
     ledger; nenhuma estimativa de tempo entra no roadmap antes disso. Fecha LS-03.
  7. **Setup de navegador determinístico** — pin exato do Remotion, `npx remotion browser ensure`
     no bootstrap da worktree, e proibição de `--browser-executable`.

---

*Pesquisa fechada em 2026-08-10 contra Remotion **4.0.507** (npm `latest`, publicada 2026-08-07).
Reconferir quando: o Remotion cruzar 4.1/5.0 (muda o default de `--gl` para `angle` e remove
`--enable-multiprocess-on-linux`), ou quando o projeto pinar uma versão < 4.0.484 (NVENC deixa de
existir em Linux).*
