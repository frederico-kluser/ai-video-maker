---
name: remotion-render-pipeline
description: 'Provides the exact semantics of the Remotion render CLI at scale — flag allowlist, what --concurrency really opens and its hard cap of 8, the three quality options that break hardware encoding (a hard throw under required, a silent software fallback under if-possible), the --gl backends per OS, pinning Chrome for cross-machine reproducibility, and frame-range chunking with its concatenation rules. Use whenever a task builds, tunes, parallelizes or budgets a video render, even if the user doesn''t mention Remotion, NVENC, concurrency or ffmpeg. Triggers: "render the video", "make the render faster", "use the GPU", "hardware acceleration", "nvenc", "concurrency", "render in chunks", "combineChunks", "frameRange", "--frames", "--gl", "swangle", "angle", "bundle cache", "render preset", "crf", "video bitrate", "why is my render slow", "render out of memory", "renders differ between machines".'
metadata:
  type: knowledge
  tier: dominio
  verification_signal: grep -rho "Math.min(8, Math.max(1, maxCpus / 2))" node_modules/@remotion/renderer/dist/ && npx remotion render --help | grep -c -- "--hardware-acceleration"
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
# Remotion — pipeline de render, concorrência e aceleração

Âncora de versão: **Remotion 4.0.507**. Todo piso de versão citado aqui é literal; abaixo dele a
funcionalidade não existe, e o card que a promete nasce morto. O `verification_signal` deste frontmatter
**exige `node_modules` instalado**: sem `npm i` ele falha por ambiente, não por defeito do conhecimento.

## Quando carregar

- Montar, revisar ou parametrizar qualquer invocação de `npx remotion render` / `renderMedia()`.
- Decidir o preset de qualidade (CRF × aceleração de hardware + bitrate) ou trocar de encoder.
- Dimensionar paralelismo de render: concorrência, RAM, sessões de encode, N renders simultâneos.
- Paralelizar **um único vídeo** em faixas de frames e costurar os pedaços.
- Investigar "o render está lento", "estourou memória", "a saída difere entre máquinas".
- **Não carregue** para escrever composições, comandos FFmpeg crus, orquestrar worktrees ou comparar
  baseline visual — o roteamento está em `## O que esta skill NÃO cobre`.

## Conhecimento injetado

### A lista de flags é uma allowlist fechada — fora dela é API inventada

`npx remotion render` documenta ~60 flags, e a sequência de headings de
`packages/docs/docs/cli/render.mdx` **no tag da versão** é a lista canônica. Duas flags plausíveis
que **não existem**: `--delay-render-timeout` (o timeout de `delayRender()` é `--timeout`, default
`30000` ms — o option interno se chama `delayRenderTimeoutInMillisecondsOption`, mas `cliFlag =
'timeout'`) e `--output-still` (still é o comando separado `npx remotion still`).
— **Placar (2-0)** · R05-01 · fonte: https://www.remotion.dev/docs/cli/render

Pisos de versão que mudam o que é possível escrever: `--gop` (4.0.466), `--rspack` (4.0.502),
`--sample-rate` (4.0.448), `--for-seamless-aac-concatenation` e `--separate-audio-to` (4.0.123),
`--metadata` (4.0.216), `--binaries-directory` (4.0.120), `--chrome-mode` (4.0.248),
`--offthreadvideo-video-threads` (4.0.261); `--ffmpeg-executable`/`--ffprobe-executable` foram removidas.
— **Placar (2-0)** · R05-01 · fonte: https://www.remotion.dev/docs/cli/render

### `--hardware-acceleration`: três valores, e o literal do código vence a prosa

O enum é `['disable', 'if-possible', 'required']`, default `disable`.
— **Placar (2-0)** · R05-02 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/hardware-acceleration.tsx

A doc oficial em prosa escreve *"By default, hardware acceleration is `"disabled"`"* — string com
"d" final que **não está no enum** e faz `Config.setHardwareAcceleration('disabled')` lançar
`Invalid value for --hardware-acceleration: disabled`. É a classe de erro que um LLM comete lendo a
doc. Regra que sobrevive às duas leituras: **o literal do código é a verdade**.
— **Placar (2-1) EM DISPUTA** · R05-03 · fontes: `options/hardware-acceleration.tsx` @ v4.0.507 ·
https://www.remotion.dev/docs/hardware-acceleration (a fonte que contradiz)

### As três opções incompatíveis, e os dois desfechos diferentes

Não é só `crf`. `hasSpecifiedUnsupportedHardwareQualifySettings` checa, **nesta ordem**:
`encodingBufferSize` (`--buffer-size`), `encodingMaxRate` (`--max-rate`), `crf`. A proibição é
**condicional ao encoder acelerado**: no caminho de software as três são legítimas.
— **Placar (2-0)** · R05-04 · fonte: `@remotion/renderer@4.0.507` `dist/esm/index.mjs`
(https://registry.npmjs.org/@remotion/renderer/-/renderer-4.0.507.tgz)

Com `required` + qualquer uma das três, `getCodecName` **lança**. Com `if-possible`, **não há
erro**: o encoder de software é escolhido e sai apenas um `Log.warn`. Ou seja, `if-possible --crf 18`
produz um render de `libx264` que parece ter funcionado, exit 0, MP4 válido.
— **Placar (2-0)** · R05-05 · fonte: `@remotion/renderer@4.0.507` `getCodecName`

Barreiras adicionais, independentes da seleção de encoder: `crf` + `videoBitrate` juntos lançam
`"crf" and "videoBitrate" can not both be set.`; `--max-rate` sem `--buffer-size` lança
`"encodingMaxRate" can not be set without also setting "encodingBufferSize".`
— **Placar (2-0)** · R05-04/R05-05 · fonte: `validateQualitySettings` no pacote publicado

Quando o encoder **é** acelerado e não há `crf`, o Remotion emite `[...bufSizeArray,
...maxRateArray]` — **nenhum `-crf`**, nem o default do codec. No caminho de software o mesmo ramo
injeta `["-crf", String(getDefaultCrfForCodec(codec))]`. É essa ausência, não o encoder, que produz
o arquivo grande; por isso a recomendação oficial de `--video-bitrate=8M` para H.264 Full HD.
— **Placar (2-0)** · R05-06 · fonte: `validateQualitySettings` no pacote publicado

### A restrição CRF × bitrate: confirmada, ampliada e parcialmente refutada

Confirmada e mais forte do que se costuma dizer: **nenhum encoder de hardware exposto pelo FFmpeg**
(NVENC, VAAPI, QSV, AMF, VideoToolbox) tem opção `crf`. CRF é vocabulário dos wrappers de software.
O mais próximo é `-rc vbr -cq N` (NVENC), `ICQ`/`QVBR` (VAAPI), `-qvbr_quality_level` (AMF), `-q:v`
(VideoToolbox) — e **nenhum é comparável a outro**.
— **Placar (3-0)** · R10-01 · fonte:
https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/nvenc_h264.c

Refutada onde mais dói: a receita "use `--buffer-size` junto com a aceleração para conter a
degradação" produz o **oposto** — `--buffer-size` é a *primeira* opção checada e derruba a
aceleração.
— **Placar (2-0)** · R05-04/R05-06 · fonte: `validateQualitySettings` no pacote publicado
(o caso `prores` × `videoBitrate` tem fonte única — ver `## Não verificado`)

### A matriz de aceleração é estática por codec × plataforma

macOS → VideoToolbox para `prores`/`h264`/`h265`. Linux e Windows → NVENC **apenas** `h264`/`h265`,
e **só a partir de v4.0.484**. `vp8`/`vp9`/`av1`/`gif` nunca aceleram. Duas condições que somem
quando a matriz é resumida: o FFmpeg **empacotado** só traz NVENC em **Linux x64** (ARM64 não é
suportado) e exige driver NVIDIA **525+**; no **Windows** é preciso apontar `--binaries-directory`
para um FFmpeg com NVENC — sem isso a linha "Windows → NVENC" é falsa na prática.
— **Placar (2-0)** · R05-07 · fonte: https://www.remotion.dev/docs/hardware-acceleration
(a assimetria "`vp9 required` não lança × `h264-mkv required` lança" é leitura só do artefato
publicado — **Placar (1-0)**, ver `## Não verificado`; não a use como guarda de erro)

### `--concurrency`: o que abre, o teto de 8, e o erro duro

Em render local, `concurrency` = número de **pages (abas) Puppeteer** num `Pool` sobre **um único**
browser — `Math.min(framesToRender.length, resolvedConcurrency)`. Consequência de orçamento: o
overhead de browser (GPU process, network service, zygote) é pago **uma vez por render**, não por
unidade de concorrência; a RAM escala pelo *renderer process* de cada aba.
— **Placar (2-0)** · R12-01 · fonte:
https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/render-frames.ts ·
https://www.remotion.dev/docs/terminology/concurrency

O default é `Math.round(Math.min(8, Math.max(1, maxCpus / 2)))` — **teto rígido de 8**. Em 32 threads
o default é 8, não 16. A prosa oficial ("half of the CPU threads available") só é verdadeira até 16
threads e não menciona o teto.
— **Placar (2-0)** · R05-10 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/get-concurrency.ts

Aceita inteiro (fracionário é rejeitado com *"must be an integer"*) ou percentual `/^\d+(\.\d+)?%$/`
convertido por `Math.floor((pct/100) * maxCpus)`. Mínimo 1. **Acima do número de núcleos, lança**
`Maximum for --concurrency is N` — não faz clamp silencioso.
— **Placar (2-0)** · R05-09 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/concurrency.tsx

A contagem é `min(os.availableParallelism(), nproc)` e respeita cgroup/`--cpuset-cpus`. **Git
worktree não é cgroup**: N worktrees no mesmo host veem o host inteiro e cada processo pede até 8
workers ⇒ até 8N abas disputando a mesma CPU.
— **Placar (2-0)** · R05-11 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/get-cpu-count.ts

### O gargalo real satura antes da CPU

`--offthreadvideo-cache-size-in-bytes` tem default `null` = **metade da memória do sistema
disponível no início daquele render**, calculado **por processo**. Dois renders simultâneos pedem,
cada um, metade da RAM — o valor de um não conhece o do outro.
— **Placar (2-0)** · R05-22 — mas o eixo *por processo* é R12-06, **(1-0)**; o panorama registra o
par como `(2-0)/(1-0)` · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/offthreadvideo-cache-size.tsx

### A curva de retorno não é monotônica — e não há número publicado

O Remotion **não publica** RAM por aba nem curva de retorno; a doc de performance manda medir com
`npx remotion benchmark` (desde v3.2.28, com `--runs` e `--concurrencies`). O caso público concreto
é a issue oficial #4300: VPS de 48 cores / 350 GB, subir a concorrência de 1 para `100%` deixou o
render **mais lento**, com a maioria dos cores ociosa — existe um regime em que mais abas piora.
— **Placar (2-0)** · R12-05 / R05-25 · fontes: https://www.remotion.dev/docs/performance ·
https://github.com/remotion-dev/remotion/issues/4300 · https://www.remotion.dev/docs/cli/benchmark

### `--gl`: seis backends, default `null`, e o leak do `angle`

Válidos, exatamente seis: `swangle`, `angle`, `egl`, `swiftshader`, `vulkan` (4.0.41+), `angle-egl`
(4.0.51+). Fora disso lança `TypeError: X is not a valid GL backend`. `null` é aceito e significa
"o Chrome decide".
— **Placar (2-0)** · R05-13 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/gl.tsx

Default em 4.0.x = **`null`**; em 5.0 passa a `angle`; Lambda/Cloud Run usam `swangle`.
— **Placar (2-0)** · R05-14 · fonte: https://www.remotion.dev/docs/gl-options
A tabela de recomendação por ambiente (desktop → `angle`; cloud com GPU → `angle-egl`; Lambda e
máquina sem GPU → `swangle`) sai de **uma fonte só** e vale **só para conteúdo WebGL/WebGPU/Three.js**
— **Placar (1-0)** · R05-15 · está em `## Não verificado`; ela **restringe**, nunca amplia, o default.

`angle` tem **vazamento de memória conhecido**, com recomendação explícita de quebrar renders longos
em partes quando ele é usado — e o histórico embutido no fonte registra que `angle` já foi default e
foi revertido por esse leak. Um teste curto não expõe o vazamento.
— **Placar (2-0)** · R05-16 · fonte: `options/gl.tsx` @ v4.0.507

### Fixar o Chrome é fixar o Remotion (não existe outra alavanca)

O Remotion baixa o próprio Chrome Headless Shell para `node_modules/.remotion/chrome-headless-shell/…`
e a versão é uma **constante compilada**: 4.0.507 embute `TESTED_VERSION = "149.0.7790.0"`. Não há
flag "escolha a versão do Chrome" — o controle é a versão do Remotion. Pin exato (sem `^`, sem `~`)
é o único mecanismo. `--browser-executable` é escape hatch que **desfaz** a garantia: troca um
binário fixado por um binário do host.
— **Placar (3-0)** · R05-17 · fonte:
https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell

`--chrome-mode` tem exatamente dois valores, `headless-shell` (default) e `chrome-for-testing`
(4.0.248+); a orientação oficial é usar o segundo *"only if you want to set up a GPU-accelerated
rendering environment on Linux"* — ele é o Chrome real (mais pesado, precisa de X11/Wayland/D-Bus).
— **Placar (2-0)** · R05-18 · fontes:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/chrome-mode.tsx ·
https://developer.chrome.com/blog/chrome-headless-shell

`--enable-multiprocess-on-linux` já vem `true` desde v4.0.137 (versões novas do Chrome não renderizam
com `--single-process`) e **será removida no 5.0**. Não é ganho a conquistar, é default a não quebrar.
— **Placar (2-0)** · R05-23 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/enable-multiprocess-on-linux.tsx

### Paralelizar UM vídeo: faixas de frames e as regras que não são negociáveis

Suporte de primeira classe, não gambiarra. `frameRange`/`--frames` desde v2.0.0; múltiplas faixas
disjuntas concatenadas num único vídeo desde **v4.0.502**; `[n, null]` desde v4.0.421.
— **Placar (2-0)** · R12-07 · fonte: https://www.remotion.dev/docs/cli/render

`combineChunks()` é API pública de `@remotion/renderer` desde **v4.0.279** (marcada "Advanced API";
`frameRange` nela desde v4.0.421). A frase "the concatenation algorithm is not a public API" que
circula se refere ao algoritmo **interno do Lambda**, não a esta função.
— **Placar (2-0)** · R12-08 · fonte: https://www.remotion.dev/docs/renderer/combine-chunks

O procedimento oficial exige, junto: **todo chunk com o mesmo número de frames exceto o último**;
`h264-ts` nos chunks e `h264` no `combineChunks()`; `numberOfGifLoops: null`; `enforceAudioTrack:
true`; **as mesmas opções em todos os chunks**; e no áudio **ou** `pcm-16` com
`forSeamlessAacConcatenation: false` (≥4 frames por chunk) **ou** `aac` com
`forSeamlessAacConcatenation: true` (desde v4.0.123), que apara o áudio no frame AAC mais próximo.
Violar a regra de áudio **não gera erro**: gera artefato inaudível num player e visível no waveform.
— **Placar (2-0)** · R12-09 · fonte: https://www.remotion.dev/docs/distributed-rendering

**Por que MPEG-TS existe aqui:** permite emendar por bytes sem depender do alinhamento de GOP do
MP4. O `concat` demuxer do FFmpeg exige *"All files must have the same streams (same codecs, same
time base, etc.)"* para `-c copy`; o **filtro** `concat` opera em frames decodificados e portanto
**sempre reencoda**.
— **Placar (2-0)** · R12-09 / R10-21 · fontes: https://www.remotion.dev/docs/distributed-rendering ·
https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/doc/demuxers.texi

`h264-ts` **é** codec válido (`validCodecs = ['h264','h265','vp8','vp9','av1','mp3','aac','wav',
'prores','h264-mkv','h264-ts','gif']`) mas **não** aparece no guia de encoding, no union `codec`
publicado de `combineChunks()`, nem na lista documentada de `--codec` da CLI (R05-01) — o
procedimento oficial roda por `renderMedia()`, não pela linha de comando. É codec de trânsito:
documente isso no card, senão alguém "corrige" o codec e quebra a costura.
— **Placar (2-0)** · R12-10 · fontes:
https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/codec.ts ·
https://www.remotion.dev/docs/encoding

### NVENC concorrente: o teto existe; o número **não** é constante

Existe teto de sessões NVENC simultâneas imposto por driver em GPUs de consumo, e existe patch
binário de terceiro que o remove (`keylase/nvidia-patch`) — decisão de dono (garantia, TI, EULA),
não decisão técnica.
— **Placar (2-0)** · R12-16 · fontes:
https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-application-note/index.html ·
https://github.com/keylase/nvidia-patch

O **valor** e o escopo ("12 por sistema", não por GPU) têm placar de fonte única — ver
`## Não verificado`. O número já mudou quatro vezes (2 → 3 → 5 → 8 → 12): hardcodar qualquer valor é
apostar numa constante volátil. O contorno sem patch é um semáforo global de encode com fallback
para `libx264` quando o pool enche.

### Preview parcial e frame-âncora: dois caminhos, não intercambiáveis

`--every-nth-frame` **só pode ser usado ao renderizar GIF** (*"This option may only be set when
rendering GIFs"*), não combina com `frames`/`frameRange`, e não é atalho de preview de vídeo.
— **Placar (2-0)** · R05-19 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/every-nth-frame.tsx

`--frames` aceita número único (renderiza um still), intervalo `0-9`, intervalo aberto `100-` e
listas por vírgula de frames ou de intervalos (`0-9,50-59`); intervalos são inclusivos e o parser
rejeita segundo número menor que o primeiro.
— **Placar (2-0)** · R05-20 · fonte:
https://github.com/remotion-dev/remotion/blob/v4.0.507/packages/renderer/src/options/frames.tsx

`npx remotion still` é **comando separado**, usa `--frame` (singular, aceita negativo para contar de
trás para frente) e **não aceita `--concurrency`** nem `--codec`/`--crf`. A lista de flags da página
é a evidência positiva da ausência.
— **Placar (2-0)** · R05-21 · fonte: https://www.remotion.dev/docs/cli/still

### Defaults de CRF por codec (só valem no caminho de software)

`h264=18`, `h265=23`, `vp8=9`, `vp9=28`, `av1=30`, `h264-mkv=18`, `h264-ts=18`;
`prores`/`gif`/`aac`/`mp3`/`wav` não têm CRF. Faixas: h264 `[1,51]`, h265 `[0,51]`, vp8 `[4,63]`,
vp9/av1 `[0,63]`. `--image-format` para vídeo **já é `jpeg` por default** — trocar para `png` só se
a cena exigir alfa, e o preço é tempo. `--log=verbose` imprime o valor de cache usado e os frames
mais lentos — é o único instrumento embutido antes do `benchmark`.
— **Placar (2-0)** · R05-01 / R05-24 · fontes: https://www.remotion.dev/docs/encoding ·
`defaultCrfMap`/`crfRanges` no pacote publicado

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

1. **Não suba `--concurrency` "até a CPU saturar".** O recurso que satura primeiro é a RAM: o cache
   do OffthreadVideo pede metade da memória disponível **por processo** (R05-22, 2-0), e a curva
   tempo × concorrência não é monotônica (R12-05, 2-0). Meça com `benchmark` **sob a carga de fundo
   real**, não numa máquina ociosa.
2. **Não deixe `--concurrency` implícito "porque o default é sensato".** O default é no máximo 8
   mesmo em 32 threads (R05-10, 2-0). Sem passar o valor você usa um quarto da máquina e conclui
   que o Remotion é lento; e se o teto sumir numa versão futura, o consumo de RAM dobra sem aviso.
3. **Não compare bitrate de hardware com CRF de software.** São contratos de qualidade diferentes:
   nenhum encoder de hardware do FFmpeg tem `crf` (R10-01, 3-0), e com encoder acelerado o Remotion
   **não emite `-crf` nenhum** (R05-06, 2-0). "O NVENC comprime mal" é, quase sempre, a ausência de
   controle de taxa — não o encoder.
4. **Não use `--buffer-size`/`--max-rate` para "domar" a aceleração.** São duas das três opções que
   a desligam, e `--buffer-size` é a **primeira** checada (R05-04, 2-0). Com `required` lança; com
   `if-possible` cai para software em silêncio.
5. **Não trate `if-possible` como "acelera se der".** O "if possible" cobre **opções de qualidade
   incompatíveis**, não ausência de hardware (R05-05, 2-0; e ver `## Não verificado` sobre a
   ausência de probe). Um exit 0 com MP4 válido não é prova de aceleração.
6. **Não renderize final e preview com configuração diferente e compare snapshots.** `--scale`,
   `--image-format`, `--gl`, `--jpeg-quality` e a versão do Chrome (R05-17, 3-0) mudam o pixel. Um
   diff entre configurações diferentes mede a configuração, não a regressão.
7. **Não use `--every-nth-frame` para preview rápido de vídeo** — a opção é exclusiva de GIF
   (R05-19, 2-0). Para amostrar o vídeo, `--frames` com listas/intervalos.
8. **Não "conserte" o codec dos chunks para `h264`.** Os chunks são `h264-ts` e só o `combineChunks()`
   recebe `h264` (R12-09/R12-10, 2-0). Trocar isso quebra a emenda de forma que abre no player.
9. **Não divida os frames em faixas de tamanho conveniente.** Todo chunk precisa do mesmo número de
   frames exceto o último (R12-09, 2-0); chunk desigual em AAC vira artefato de áudio, não erro.
10. **Não resolva falta de sessão NVENC comprando uma segunda GeForce** — o teto documentado é por
    sistema, não por GPU (ver `## Não verificado` para o placar do número).
11. **Não use `--browser-executable` para "pular o download lento do Chrome"** — troca o binário
    fixado pelo do host e apaga a garantia de determinismo entre máquinas (R05-17, 3-0).
12. **Não trate `--repro` como reprodutibilidade** — é ZIP de bug report, não fixa nada (R05-25,
    2-0). E não faça gate de CI sobre `npx remotion gpu`: a doc diz que a saída não é para parsing
    automatizado, mas esse aviso é **fonte única** (ver `## Não verificado`).
13. **Não mexa em `--gl` sem conteúdo WebGL/WebGPU/Three.js esperando ganho.** A recomendação por
    ambiente é condicionada a esse tipo de conteúdo (R05-15, **1-0**), e `angle` traz um leak conhecido
    (R05-16, 2-0). Mas **fixe o valor explicitamente mesmo assim**: o default `null` significa "o
    Chrome decide", que é a pior condição possível para determinismo entre máquinas.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| `--hardware-acceleration if-possible` terminou com exit 0 e MP4 válido | Com `--crf`/`--max-rate`/`--buffer-size` o Remotion desligou a aceleração e usou `libx264`, deixando só um `Log.warn` (R05-05, 2-0) | Gate que roda com `--log=verbose` e exige a linha `hardware accelerated: true` (a doc avisa para não depender do texto exato — mantenha o gate fácil de atualizar) |
| `required` passou na validação em Linux | A seleção de `h264_nvenc` é tabela por codec × plataforma (R05-07, 2-0); a falha migra para o FFmpeg e é diagnosticada como "vídeo corrompido" | Probe de máquina (`ffmpeg -hide_banner -encoders \| grep nvenc`, `nvidia-smi`) rodado **antes** do render e gravado no perfil da máquina |
| O render acelerado ficou 3× maior, "logo o encoder comprime mal" | Sem `crf` o Remotion não emite controle de taxa nenhum (R05-06, 2-0) | Assert de bytes por segundo de vídeo por preset na saída |
| Não passei `--concurrency`, "então usa a máquina toda" | Teto rígido de 8 (R05-10, 2-0) | Assert no runner: `resolvedConcurrency` (exposto em `onStart`) gravado no metadata **e comparado** com o valor do preset — o gate falha quando o default entrou sozinho |
| Duas worktrees renderizando, "cada uma com metade da RAM" | O default de cache é metade da RAM **por processo**, calculado no início de cada render (R05-22, 2-0) | Pré-flight que aborta a onda quando `MemAvailable` < N × `--offthreadvideo-cache-size-in-bytes` configurado, com teto explícito de `--concurrency` por worktree e semáforo global de render |
| Subi para `--concurrency=100%` e a primeira medição acelerou | `100%` é o teto **aceito** (acima de `nproc` lança), não o saudável; a primeira execução tem cache quente e máquina ociosa (R05-09 + R12-05, 2-0) | `benchmark --concurrencies=… --runs=3` executado com a carga de fundo real + watchdog de RSS |
| Os 4 chunks combinaram e o MP4 abre | Abrir não prova costura; artefato de AAC por chunk desigual é inaudível no player (R12-09, 2-0) | `ffprobe -count_frames` (total de frames) + duração de áudio contra o render monolítico + RMS por janela nas fronteiras |
| `--gl=angle` acelerou num teste | O leak de memória só aparece em render longo (R05-16, 2-0) | Um render da duração real do vídeo alvo antes de fixar o backend |
| A regressão visual passou na minha máquina | `^4.0.x` pode trocar o Chrome entre instalações e mudar antialiasing e layout de fonte (R05-17, 3-0) | Versão exata do Remotion no lockfile + `TESTED_VERSION` gravado ao lado de cada fixture |

## O que esta skill NÃO cobre

- **Escrever composições** (`useCurrentFrame`, `interpolate`, `spring`, `<Sequence>`, `<Composition>`,
  `calculateMetadata`, schemas Zod) → `remotion-core`.
- **Comandos FFmpeg crus** (loudnorm em duas passadas, `ebur128`, `silencedetect`, `sidechaincompress`,
  concat demuxer na prática, `-fflags +bitexact`, alfa/`yuva420p`, ProRes) → `ffmpeg-media-ops`.
- **Lançar e coordenar agentes em worktrees** (barreira, merge com gate, semáforo entre sessões) →
  `parallel-worktrees`. Esta skill só entrega os números que aquele orçamento consome.
- **Capturar, normalizar e comparar baseline visual** (`still` como fixture, PSNR/SSIM/VMAF, política
  de re-baseline) → `video-characterization`.
- **Render do Manim, `media_dir`, cache CRC32 por play call** → `manim-bridge`; locução, legendas e
  sincronia de palavra → `audio-captions-sync`; licenciamento do Remotion → `remotion-core`.

## Não verificado

Tudo abaixo entrou com placar < 2-0 ou é consequência derivada de um claim assim. Nenhuma destas
linhas pode virar afirmação num card sem o comando de fechamento rodado nesta máquina.

- **`required` não faz probe de hardware** — em Linux/Windows a escolha de `h264_nvenc` dependeria
  só de `process.platform`, sem consulta a driver NVIDIA, sem `ffmpeg -encoders`, sem retry. A mesma
  leitura de `getCodecName` sustenta a assimetria `vp9 required` (não lança, cai para software) ×
  `h264-mkv required` (lança) — logo, `required` **não** é guarda de erro confiável por codec.
  **Placar (1-0)** (só o artefato publicado sustenta; nenhuma prosa afirma nem nega) · R05-08.
  Fecha com: `ffmpeg -hide_banner -encoders | grep -E 'nvenc'` e `nvidia-smi`; depois
  `npx remotion render <comp> --codec h264 --hardware-acceleration if-possible --log=verbose | grep -i "hardware accelerated"`.
- **O teto de NVENC é 12 sessões concorrentes por SISTEMA em GPUs "non-qualified" (GeForce)** —
  **Placar (1-0)** (as duas páginas são do mesmo domínio NVIDIA ⇒ contam como uma) · R12-17.
  Fecha com: `for i in $(seq 1 16); do ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=1280x720:rate=30 -t 60 -c:v h264_nvenc -f null - & done; wait`
  e `nvidia-smi -q -d ENCODER_STATS`.
- **Em `prores` acelerado não se controla nem por CRF nem por bitrate** — `validateQualitySettings`
  faz `console.warn("ProRes does not support videoBitrate. Ignoring.")` e retorna `[]`, sobrando só
  `--prores-profile`. **Placar (1-0)** (só o artefato publicado; nenhuma prosa afirma nem nega) ·
  R05-04 (linha de refutação). Escopo estreito: `prores` só acelera em macOS/VideoToolbox, então em
  Linux isto nunca dispara. Fecha com
  `npx remotion render <comp> --codec prores --video-bitrate 20M --log=verbose 2>&1 | grep -i bitrate`.
- **A saída de `npx remotion gpu` não serve como gate de CI** — a doc diz *"should not be used for
  automated parsing, as it may change inbetween any Remotion and Chrome versions"*. **Placar (1-0)**
  (só `remotion.dev`; um domínio conta como uma fonte) · nota de reconferência de R05-13/R05-14.
  Fecha rodando `npx remotion gpu` em duas versões de Remotion e comparando a saída campo a campo.
- **`--concurrency` abre "browser tabs" ou "render processes"** — a doc oficial usa as duas palavras
  e não fixa qual. **Placar (1-0)** · R05-12. O código resolve a favor de abas (R12-01, 2-0), mas o
  **custo de RAM por aba não tem número publicado**. Fecha com:
  `ps -eo pid,rss,comm --sort=-rss | head -20` durante um render, dividido por `--concurrency`.
- **A tabela de recomendação de `--gl` por ambiente, e a condição de que ela só vale para conteúdo
  WebGL/WebGPU/Three.js** — **Placar (1-0)** · R05-15. Note o conflito interno: "ficar no default"
  colide com a exigência de determinismo, porque o default é `null`. Fecha lendo
  https://www.remotion.dev/docs/gl-options contra um render medido.
- **Semântica de `--bundle-cache`** — a flag existe na allowlist desde v2.0.0 (isso é R05-01, 2-0),
  mas **o que ela cacheia, onde, e como invalida não foi pesquisado**. **Sem placar.** Não escreva
  card que dependa do comportamento dela. Fecha com:
  `npx remotion render --help | grep -A3 -- '--bundle-cache'` e um render repetido com e sem a flag,
  medindo tempo de bundling e o conteúdo do diretório de cache.
- **Cache endereçado por conteúdo dos assets** — o padrão é o par action cache (`/ac/`) + CAS
  (`/cas/`, SHA256) do Bazel, e o Bazel avisa que *"does not track tools outside a workspace"*.
  **Placar (1-0)** · R12-25 (make por mtime, Ninja por mtime + hash da linha de comando: R12-24,
  **1-0**). A consequência derivada — incluir um `tool-versions.lock` (Remotion, Chrome empacotado,
  FFmpeg) no digest da ação — é a decisão **cara depois**: corrigir a chave invalida todo o cache.
  Fecha lendo https://bazel.build/remote/caching e provando localmente que dois renders com
  binários diferentes produzem a mesma chave.
- **Priming de AAC = 2112 samples fixos, remainder < 1024 samples, sem sinalização satisfatória em
  MP4/ADTS** — **Placar (1-0)** · R10-22, fonte Apple TN2258. É a **mecânica** por trás de
  `--for-seamless-aac-concatenation`; a **regra operacional** (usar `pcm-16` ou AAC com a flag) tem
  placar 2-0 por R12-09 e vale independentemente. Fecha concatenando dois trechos AAC de duração não
  múltipla e medindo o offset com `ffprobe -show_packets` nas fronteiras.
- **Alfa em VP8/VP9 pode divergir no início de cada chunk** (a codificação do plano alfa depende de
  frames anteriores) — **Placar (1-0)** · R10-12. Só morde se o pipeline paralelizar por segmento
  **e** houver alfa. Fecha com `ffmpeg -lavfi alphaextract` + `ssim` no frame de fronteira.
- **Aceleração de hardware vale para conteúdo de texto vetorial** — o único benchmark com números
  públicos usou clipes de câmera e jogo. **Placar (0-0, uma secundária)** · R10-07. Ninguém mediu
  texto vetorial, borda dura e fundo chapado — o regime em que encoders de hardware historicamente
  sofrem. Fecha medindo VMAF/SSIM do nosso próprio conteúdo, software × hardware, mesmo alvo de taxa.

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
