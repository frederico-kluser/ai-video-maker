# R12 — Paralelismo de render: local, chunked e distribuído

**Escopo desta pesquisa:** responde COMO o render paraleliza de fato (Remotion local, chunking por
faixa de frames, Lambda/Cloud Run) e QUAL recurso satura antes da CPU (RAM, cache de vídeo, sessões
NVENC, disco, portas), além dos padrões de fila/cache-por-hash aplicáveis a um pipeline local.
NÃO responde: licenciamento comercial do Remotion, escolha de codec final para publicação, custo de
nuvem fora do exemplo publicado pelo próprio fornecedor, nem qualidade visual de saída.

**Data da pesquisa:** 2026-08-10. **Versões de referência:** Remotion `4.0.507` (npm `latest`),
Manim Community `v0.20.1`, NVIDIA Video Codec SDK `13.1`, Dagster `1.13.17`, FFmpeg (doc `ffmpeg-formats`
corrente; binário local `6.1.1-3ubuntu5`).

**Máquina onde as sementes de ledger foram calibradas** (medida com `nproc`/`free`/`nvidia-smi` em
2026-08-10): 32 threads, 31 GiB de RAM total (~13 GiB disponíveis no momento da medição), swap 47 GiB,
`NVIDIA GeForce RTX 4070 Laptop GPU` driver `580.159.03`, `ip_local_port_range = 32768 60999`,
`ulimit -n = 1048576`.

---

## Convenção de placar usada aqui (leia antes da tabela)

O contrato manda contar **fontes independentes** e trata duas páginas do mesmo domínio como **uma**.
Para uma API de fornecedor único (Remotion, Manim, NVIDIA) isso tem uma consequência estrutural:
**a maioria dos claims de API não consegue passar de `PROVÁVEL` mesmo estando literalmente escrita na
doc oficial**, porque só existe uma autoridade. Onde consegui, usei dois artefatos primários de
domínios distintos e naturezas distintas — `remotion.dev` (doc) e `github.com/remotion-dev/remotion`
(código-fonte / raw) — que **de fato discordam entre si** em pelo menos um ponto (ver R12-03), o que
prova que não são a mesma fonte. Onde só existe a doc, o placar é `(1-0)` e eu escrevo isso, mesmo
quando o fato é trivialmente verdadeiro. O rótulo mede corroboração, não minha confiança.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R12-01 | Em render local do Remotion, `concurrency` = número de *pages* (abas) Puppeteer abertas em paralelo dentro de **uma única** instância de browser, distribuídas por um `Pool`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/terminology/concurrency + https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/render-frames.ts |
| R12-02 | O `concurrency` default do Remotion deriva de `nCPUs / 2`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/renderer/render-media + https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/get-concurrency.ts |
| R12-03 | O default é **travado em no máximo 8** (`Math.round(Math.min(8, Math.max(1, maxCpus/2)))`) — numa máquina de 32 threads o default é 8, não 16; a doc não menciona esse teto. | (1-0) | NÃO VERIFICADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/get-concurrency.ts |
| R12-04 | `concurrency` acima do número de cores **lança erro** (`Maximum for --concurrency is ${maxCpus}`); string percentual vira `Math.floor((pct/100)*maxCpus)`. | (1-0) | NÃO VERIFICADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/get-concurrency.ts |
| R12-05 | O Remotion **não publica** número de RAM por aba nem curva de retorno; a doc oficial só afirma qualitativamente que concorrência alta demais é contraproducente e manda medir com `npx remotion benchmark` (desde v3.2.28). | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/performance + https://github.com/remotion-dev/remotion/issues/4300 |
| R12-06 | O cache de `OffthreadVideo` (`offthreadVideoCacheSizeInBytes`, desde v4.0.23) tem default `null`, que significa **metade da memória do sistema disponível no início do render** — por processo de render. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/renderer/render-media |
| R12-07 | Renderizar faixas de frames é suporte oficial: `frameRange` na API e `--frames` na CLI (desde v2.0.0); múltiplas faixas disjuntas concatenadas num único vídeo desde v4.0.502; `[n, null]` desde v4.0.421. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/cli/render + https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/combine-chunks.ts |
| R12-08 | Existe API pública de concatenação de chunks: `combineChunks()` em `@remotion/renderer`, adicionada em **v4.0.279** (`frameRange` nela desde v4.0.421), marcada como "Advanced API". | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/renderer/combine-chunks + https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/combine-chunks.ts |
| R12-09 | O procedimento oficial de render distribuído exige: **todo chunk com o mesmo número de frames exceto o último**, codec `h264-ts` nos chunks e `h264` no combine, `numberOfGifLoops: null`, `enforceAudioTrack: true`, e (a) `pcm-16` + `forSeamlessAacConcatenation:false` para ≥4 frames/chunk ou (b) `aac` + `forSeamlessAacConcatenation:true`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/distributed-rendering + https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/codec.ts |
| R12-10 | `h264-ts` **é** um codec válido do Remotion (está em `validCodecs`), mas **não** aparece na lista de codecs do guia de encoding nem no union `codec` da assinatura de `combineChunks()`. | (2-0) | PROVÁVEL | https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/codec.ts + https://www.remotion.dev/docs/encoding |
| R12-11 | `forSeamlessAacConcatenation` existe como opção de config (`Config.setForSeamlessAacConcatenation()`) desde **v4.0.123**. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/config |
| R12-12 | Remotion Lambda faz chunking automático: alvo de concorrência = `interpolate(frameCount, [0,18000], [75,150])`, `framesPerLambda = max(frameCount/concorrência, 20)`, mínimo configurável de `framesPerLambda` = **5** (era 4 até 4.0.331) e concorrência máxima **200**. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/lambda/concurrency |
| R12-13 | O algoritmo interno de concatenação do Lambda **não é API pública**; a doc sugere `frameRange` + `pcm-16` + FFmpeg para quem quiser reproduzir. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/lambda/how-lambda-works |
| R12-14 | Remotion **Cloud Run está em Alpha e não está em desenvolvimento ativo**; entre as opções server-side, **só o Lambda** faz render distribuído — as demais renderizam numa máquina só. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/cloudrun + https://www.remotion.dev/docs/compare-ssr (mesmo domínio ⇒ 1 fonte) |
| R12-15 | Custos medidos pelo próprio fornecedor (Remotion 4.0.381, 2048 MB, disco 10 GB, us-east-1): Hello World $0.001 (7,56 s), vídeo local de 1 min $0.017 (18,91 s), vídeo HD remoto de 10 min $0.103 (56,09 s), 4K de 10 s $0.013 (45,28 s) — **sem** S3 e transferência. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/lambda/cost-example |
| R12-16 | Existe um teto de sessões NVENC simultâneas imposto por driver em GPUs de consumo, e existe um patch binário de terceiro que o remove em Linux/Windows (`keylase/nvidia-patch`). | (2-0) | PROVÁVEL | https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-application-note/index.html + https://github.com/keylase/nvidia-patch |
| R12-17 | O teto atual documentado é **12 sessões concorrentes por SISTEMA** em GPUs "non-qualified" (GeForce); em "qualified" (RTX PRO/Quadro/data center) o limite é só recurso disponível. | (1-0) | NÃO VERIFICADO | https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-application-note/index.html (+ https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new, mesmo domínio ⇒ 1 fonte) |
| R12-18 | No Remotion, encode acelerado por NVENC em Linux/Windows x64 existe **a partir de v4.0.484**, só para H.264/H.265, produz **arquivo significativamente maior**, é incompatível com `crf`, não funciona em Linux ARM64 e **não** existe em Lambda/Cloud Run. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/hardware-acceleration |
| R12-19 | Manim v0.20.1 tem cache endereçado por hash: cada `play`/`wait` gera um hash (câmera + animações + mobjects) que nomeia um *partial movie file* reutilizado se o hash bater; `--disable_caching` e `--flush_cache` controlam. | (1-0) | NÃO VERIFICADO | https://docs.manim.community/en/stable/guides/configuration.html |
| R12-20 | Manim v0.20.1 expõe `media_dir` como raiz e `video_dir`/`tex_dir`/`partial_movie_dir`/`images_dir`/`text_dir`/`sections_dir` como derivados; só `--media_dir` e `--log_dir` têm flag de CLI, os demais são "no flag" (config file ou objeto `config`); precedência: arquivo < CLI < programático. | (1-0) | NÃO VERIFICADO | https://docs.manim.community/en/stable/reference/manim._config.utils.ManimConfig.html |
| R12-21 | Manim **não tem** paralelismo interno: colaborador do repo oficial afirma que "the current architecture of Manim is insufficient to handle multithreading correctly" e que a refatoração (classe `Manager`) não deve sair antes da **v0.21.0**. | (1-0) | NÃO VERIFICADO | https://github.com/ManimCommunity/manim/discussions/3897 |
| R12-22 | GNU parallel: `-j` default é `100%` (uma job por thread), `--joblog` registra por job (seq, início, duração, exit, sinal, comando), `--resume`/`--resume-failed`/`--retry-failed` retomam a partir do joblog, e por default a saída é agrupada de modo a sair igual à execução sequencial. | (1-0) | NÃO VERIFICADO | https://www.gnu.org/software/parallel/parallel.html |
| R12-23 | `xargs -P` tem default **1**, exige `-n`/`-L`/`-I` para gerar mais de um exec, e a man page avisa que a saída de processos paralelos sai "in an indeterminate order (and very likely mixed up)". | (2-0) | PROVÁVEL | https://man7.org/linux/man-pages/man1/xargs.1.html + `man xargs` local (findutils, verificado nesta máquina) |
| R12-24 | Ninja decide rebuild por **mtime + hash da linha de comando** gravada no `.ninja_log`, roda em paralelo por default com base no número de CPUs, e `pool` (incl. o pool pré-definido `console`, profundidade 1) restringe concorrência por regra/edge. | (1-0) | NÃO VERIFICADO | https://ninja-build.org/manual.html |
| R12-25 | O cache remoto do Bazel é exatamente o padrão *content-addressed build cache*: **action cache** (digest da ação → metadados do resultado, sob `/ac/`) + **CAS** (blobs por SHA256 do próprio conteúdo, sob `/cas/`), servível por qualquer servidor HTTP/1.1 com PUT/GET; e o Bazel avisa que **não rastreia ferramentas fora do workspace**, o que permite cache hit incorreto. | (1-0) | NÃO VERIFICADO | https://bazel.build/remote/caching |

---

## 2. Detalhe por claim

### R12-01 — `concurrency` local = N abas num único browser, geridas por um Pool

- **Verdade operacional:** um render Remotion não é N processos de Chrome; é **um** browser com N
  `page`s num `Pool`. O código monta `new Array(concurrencyOrFramesToRender).fill(true).map((_,i) =>
  makeNewPage(...))` e depois `new Pool(puppeteerPages)`, onde
  `concurrencyOrFramesToRender = Math.min(framesToRender.length, resolvedConcurrency)`. Consequência
  prática: RAM escala por *renderer process* do Chrome (o Chrome usa processo por aba/site), mas o
  overhead de browser (GPU process, network service, zygote) é pago **uma vez por render**, não por aba.
  A doc de `renderFrames()` chama isso de "render processes", e a página de terminologia chama de
  "browser tabs" — o código resolve a ambiguidade a favor de **abas**.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/render-frames.ts | grep -n "new Pool\|makeNewPage\|concurrencyOrFramesToRender"`
  e, durante um render, `pgrep -a chrome | wc -l` / `ps -o rss= -C chrome | awk '{s+=$1} END {print s/1024" MB"}'`.
- **O que quebra se divergir:** o card de "orçamento de RAM por worktree" e o card de "quantos agentes
  simultâneos". Se cada aba fosse um browser completo, o custo por unidade de concorrência sobe muito e
  o número de worktrees paralelas cai.
- **Fontes:**
  - https://www.remotion.dev/docs/terminology/concurrency (primária) — "how many browser tabs are opened in parallel during a render"; "too high concurrency will lead to diminishing returns and to overload of the machines, which might crash a render".
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/render-frames.ts (primária, código) — pool de pages sobre um único browser.
  - https://www.remotion.dev/docs/renderer/render-frames (primária, mesmo domínio) — "A `number` specifying how many render processes should be started in parallel"; "Reusing a browser across multiple function calls can speed up the rendering process."

### R12-02 / R12-03 / R12-04 — o default é `nCPUs/2` **com teto de 8**, e o máximo é o nº de cores

- **Verdade operacional:** o arquivo `packages/renderer/src/get-concurrency.ts` (lido verbatim) é:
  ```ts
  export const resolveConcurrency = (userPreference: number | string | null) => {
      const maxCpus = getCpuCount();
      if (userPreference === null) {
          return Math.round(Math.min(8, Math.max(1, maxCpus / 2)));
      }
      const min = 1;
      let rounded;
      if (typeof userPreference === 'string') {
          const percentage = parseInt(userPreference.slice(0, -1), 10);
          rounded = Math.floor((percentage / 100) * maxCpus);
      } else {
          rounded = Math.floor(userPreference);
      }
      if (rounded > maxCpus) {
          throw new Error(`Maximum for --concurrency is ${maxCpus} (number of cores on this system)`);
      }
      if (rounded < min) { throw new Error(`Minimum for concurrency is ${min}.`); }
      return rounded;
  };
  ```
  Nesta máquina (32 threads) o **default é 8**, não 16. A doc de `renderMedia()` diz apenas
  "Default is half of the CPU threads available" — verdadeiro só até 16 threads. Ou seja: em máquina
  grande o Remotion **subutiliza de propósito**, e "aumentar concorrência" é uma ação explícita, não
  automática. Também: `--concurrency=100%` é o máximo aceito; `--concurrency` acima de `nproc` é erro
  duro, não clamp silencioso.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/get-concurrency.ts`
  e localmente `npx remotion render <comp> out.mp4 --log=verbose 2>&1 | grep -i concurrency`.
- **O que quebra se divergir:** o card de "tuning de concorrência" e qualquer *fixture* de tempo de
  render. Se o teto de 8 sumir numa versão futura, o consumo de RAM do render dobra sem aviso numa
  máquina de 32 threads — e o gate de RAM por worktree passa a estourar.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/get-concurrency.ts (primária, código verbatim, branch `main`).
  - https://www.remotion.dev/docs/renderer/render-media (primária) — "Default is half of the CPU threads available"; aceita `number`, `string` percentual (`"50%"`) ou `null`.
  - https://www.remotion.dev/docs/config (primária, mesmo domínio) — "Try to set your concurrency to `os.cpus().length` to all the threads available on your CPU for faster rendering."

### R12-05 — não há números publicados de RAM/aba nem de curva de retorno

- **Verdade operacional:** procurei nas páginas de performance, terminologia, benchmark, `renderMedia`
  e `optimizing-speed`. Nenhuma traz número. A orientação oficial é *medir*: `npx remotion benchmark`
  (v3.2.28+) aceita `--runs` e `--concurrencies` para comparar valores. O caso público mais concreto é
  a issue #4300 do repositório oficial (VPS de 48 cores / 350 GB RAM, Remotion 4.0.211): subir a
  concorrência de 1 para `100%` deixou o render **mais lento** com a maioria dos cores ociosa, enquanto
  um MacBook Air M2 de 8 cores se comportava como esperado. Isso é evidência positiva de que a curva
  **não** é monotônica e de que existe um regime em que mais abas piora.
- **Como reconferir:**
  `npx remotion benchmark <comp> --concurrencies=2,4,8,12,16 --runs=3` na máquina-alvo.
- **O que quebra se divergir:** o card "escolher concurrency" não pode ter valor hardcoded vindo de
  pesquisa — ele tem que ler de config e ter um benchmark como gate. Qualquer card que afirme
  "concurrency = nproc" nasce errado.
- **Fontes:**
  - https://www.remotion.dev/docs/performance (primária) — "A concurrency too high and a concurrency too low can both be counterproductive."; manda usar o benchmark.
  - https://www.remotion.dev/docs/cli/benchmark (primária, mesmo domínio) — "measures render time by running a render multiple times… with multiple compositions and concurrency values"; desde v3.2.28.
  - https://github.com/remotion-dev/remotion/issues/4300 (primária, repo oficial) — caso 48 cores/350 GB, 4.0.211, concorrência maior = mais lento.

### R12-06 — cache do OffthreadVideo pega metade da RAM **por processo de render**

- **Verdade operacional:** `offthreadVideoCacheSizeInBytes` (desde v4.0.23) tem default `null` que
  corresponde a **metade da memória do sistema disponível quando o render começa**. Numa máquina de
  31 GiB isso é ~15 GiB *por render*. Se o pipeline roda N renders em paralelo (uma por worktree de
  agente), cada um calcula "metade da memória" no seu próprio start e os N somam muito mais que 100% —
  o clássico *thundering herd* de cache. Este é, na minha leitura, o recurso que satura antes da CPU
  neste projeto, mais do que as abas em si.
- **Como reconferir:** `npx remotion render … --offthreadvideo-cache-size-in-bytes=<N>` e observar
  `free -m` / `smem` durante N renders simultâneos; comparar com o default.
- **O que quebra se divergir:** o card "rodar N agentes em worktrees paralelas" e o gate de OOM. Se o
  default for por-máquina e não por-processo, o problema some; se for por-processo (o que a doc diz),
  o pipeline **precisa** fixar o valor explicitamente em toda invocação.
- **Fontes:**
  - https://www.remotion.dev/docs/renderer/render-media (primária) — lista a opção e a versão v4.0.23; o texto do default ("half of the system memory available when the render starts") aparece na família de páginas de opções do mesmo domínio (`cli/render`, `renderFrames`, Lambda).

### R12-07 / R12-08 / R12-09 / R12-10 / R12-11 — chunking oficial: `frameRange`/`--frames` + `combineChunks()`

- **Verdade operacional:** **sim, dá para paralelizar UM vídeo entre N processos/máquinas, e é
  suporte de primeira classe.** A página "Distributed rendering" descreve o procedimento oficial em
  três fases: (1) `selectComposition()` para saber a duração e calcular faixas onde "every chunk must
  render the same amount of frames, except the last one"; (2) `renderMedia()` por chunk com
  `frameRange`, **as mesmas opções em todos**, `numberOfGifLoops: null` e `enforceAudioTrack: true`;
  (3) `combineChunks()` recebendo os arrays ordenados de vídeo e áudio mais `framesPerChunk`, `fps` e
  `compositionDurationInFrames`.
  As armadilhas de codec são explícitas e são o coração do card:
  - **Vídeo:** renderize os chunks com `h264-ts` (MPEG-TS) e passe `h264` ao `combineChunks()`.
    `h264-ts` está em `validCodecs` no código, mas **não** está listado no guia de encoding nem no
    union `codec` publicado da assinatura de `combineChunks()` — ou seja, é um codec "de trânsito".
  - **Áudio:** com ≥4 frames por chunk e sem AAC, use `pcm-16` e `forSeamlessAacConcatenation: false`;
    se for renderizar em AAC, `forSeamlessAacConcatenation: true` (opção desde v4.0.123), que apara o
    áudio no *frame AAC* mais próximo. A doc avisa: "violating this rule might lead to audio artifacts
    if you are using the `aac` audio codec".
  - **Keyframes:** o motivo de MPEG-TS existir aqui é justamente permitir concatenação por bytes sem
    depender de alinhamento de GOP do MP4; o `concat` demuxer do FFmpeg exige "All files must have the
    same streams (same codecs, same time base, etc.)" (R12-25 do FFmpeg, seção abaixo).
  Assinatura publicada de `combineChunks()` (v4.0.279; `frameRange` desde v4.0.421): `outputLocation`,
  `videoFiles[]`, `audioFiles[]`, `codec`, `fps`, `framesPerChunk`, `audioCodec?`, `preferLossless`,
  `compositionDurationInFrames`, `frameRange?`, `everyNthFrame?`, `onProgress?`, `audioBitrate?`,
  `numberOfGifLoops?`, `logLevel?`, `binariesDirectory?`, `cancelSignal?`, `metadata?`.
  Na CLI, `--frames` aceita frames individuais e faixas (`--frames=0,30-59,90-`), "Ranges are
  inclusive", faixas múltiplas concatenadas num único vídeo desde **v4.0.502**, flag desde v2.0.0.
- **Como reconferir:** ler https://www.remotion.dev/docs/distributed-rendering e
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/codec.ts | grep -A16 validCodecs`.
  Teste de aceitação local: renderizar a mesma composição (a) monolítica e (b) em 4 chunks + combine,
  e comparar duração, contagem de frames e áudio (`ffprobe -count_frames`).
- **O que quebra se divergir:** o card "render chunked local em N processos" inteiro, e o gate de
  "vídeo combinado == vídeo monolítico". Se `combineChunks()` for removido/renomeado, o fallback é
  `--frames` + `ffmpeg -f concat -c copy` com `pcm-16`, o que muda o card de áudio.
- **Fontes:**
  - https://www.remotion.dev/docs/distributed-rendering (primária) — procedimento, regra do número igual de frames, `h264-ts`, `pcm-16`, `forSeamlessAacConcatenation`, `enforceAudioTrack`, `numberOfGifLoops`.
  - https://www.remotion.dev/docs/renderer/combine-chunks (primária, mesmo domínio) — assinatura completa, "Added in v4.0.279", `frameRange` em v4.0.421, aviso de "Advanced API".
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/combine-chunks.ts (primária, código) — a função existe, opções batem, há `canConcatAudioSeamlessly()` e `codecSupportsFastStart` marcando `h264-ts: false`.
  - https://github.com/remotion-dev/remotion/blob/main/packages/renderer/src/codec.ts (primária, código) — `validCodecs = ['h264','h265','vp8','vp9','av1','mp3','aac','wav','prores','h264-mkv','h264-ts','gif']`.
  - https://www.remotion.dev/docs/cli/render (primária, mesmo domínio) — sintaxe de `--frames`, versões.
  - https://www.remotion.dev/docs/config (primária, mesmo domínio) — `setForSeamlessAacConcatenation()` desde v4.0.123.
  - https://www.remotion.dev/docs/encoding (primária, mesmo domínio) — lista de codecs **sem** `h264-ts`.

### R12-12 / R12-13 / R12-14 / R12-15 — Lambda e Cloud Run, e por que ficar local

- **Verdade operacional:** o Lambda faz chunking automático com fórmula publicada:
  concorrência alvo = `interpolate(frameCount, [0, 18000], [75, 150])`;
  `framesPerLambda = Math.max(frameCount / concorrência, 20)`;
  `lambdasNeeded = Math.ceil(frameCount / framesPerLambda)`;
  resultado final = `Math.ceil(frameCount / lambdasNeeded)`. Mínimo de `framesPerLambda` = 5
  (era 4 até 4.0.331); concorrência máxima 200. **Mas** o algoritmo de concatenação da função principal
  "is not a public API at the moment" — quem quiser reproduzir local usa `frameRange` + `pcm-16` +
  FFmpeg (que é exatamente o caminho de R12-07..R12-11).
  Sobre alternativa self-hosted: entre as opções server-side documentadas (Lambda, Cloud Run, Vercel
  Sandbox, Node.js próprio), **só o Lambda distribui**; as outras renderizam numa máquina. Cloud Run é
  Alpha e "not actively being developed" — não é alternativa self-hosted, é outro produto hospedado.
  A alternativa self-hosted real é: montar o orquestrador de chunks você mesmo com `frameRange` +
  `combineChunks()`, que é justamente o que o projeto quer.
  Custo (medição do próprio fornecedor, v4.0.381): 10 min de HD remoto = $0.103. Isto é baixo — o
  argumento para ficar local **não é custo de compute**, é: dependência de AWS, o não-suporte a
  aceleração de hardware em Lambda/Cloud Run (R12-18), e o fato de o Manim/LaTeX não caber no runtime
  do Lambda sem imagem custom.
- **Como reconferir:** https://www.remotion.dev/docs/lambda/concurrency e
  https://www.remotion.dev/docs/lambda/cost-example.
- **O que quebra se divergir:** o card "decidir local vs nuvem" e o card de orçamento. Se o Cloud Run
  sair de Alpha, reabre a opção GCP.
- **Fontes:**
  - https://www.remotion.dev/docs/lambda/concurrency (primária) — fórmulas e limites.
  - https://www.remotion.dev/docs/lambda/how-lambda-works (primária, mesmo domínio) — "The concatenation algorithm is not a public API at the moment"; "Building a distributed renderer is hard, and not recommended for most".
  - https://www.remotion.dev/docs/compare-ssr (primária, mesmo domínio) — só o Lambda divide em chunks; Cloud Run "is in Alpha and we are considering moving it".
  - https://www.remotion.dev/docs/cloudrun (primária, mesmo domínio) — "Cloud Run is in Alpha status and not actively being developed."
  - https://www.remotion.dev/docs/lambda/cost-example (primária, mesmo domínio) — tabela de custos, config e versão 4.0.381; "We always recommend to measure the cost of your composition yourself."

### R12-16 / R12-17 — NVENC: o teto é **por sistema**, não por GPU, e é 12 em GeForce

- **Verdade operacional:** a NVENC Application Note do Video Codec SDK 13.1 diz, literalmente:
  *"On qualified GPUs, the number of concurrent encode sessions is limited by available system
  resources (encoder capacity, system memory, video memory etc.). On non-qualified GPUs, the number of
  concurrent encode sessions is limited to 12 per system."* Dois detalhes que mudam o desenho do
  pipeline: (a) **"per system"** — colocar uma segunda GeForce na máquina não multiplica o teto;
  (b) o número **mudou várias vezes** (2 → 3 em 2020 → 5 em 2023 → 8 em 2024 → 12 hoje), então
  hardcodear 12 num card é apostar numa constante volátil. O contorno conhecido é o patch binário do
  driver `keylase/nvidia-patch` ("removes restriction on maximum number of simultaneous NVENC video
  encoding sessions imposed by Nvidia to consumer-grade GPUs", alvo principal GNU/Linux, com suporte a
  drivers até `610.43.03` no momento da leitura) — mas isso é decisão do dono (suporte, garantia,
  compliance), não decisão técnica. O contorno **sem patch** é trivial e melhor: serializar o encode
  atrás de um semáforo de N=8..10 e usar libx264 (CPU) quando o semáforo estiver cheio.
  Na máquina medida, a GPU é uma RTX 4070 Laptop com driver 580.159.03 — o número efetivo dela precisa
  ser medido (LS-04), porque a matriz de suporte lista o teto por família e o comportamento real
  depende do driver instalado.
- **Como reconferir:**
  ```bash
  for i in $(seq 1 16); do ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc=size=1280x720:rate=30 \
    -t 60 -c:v h264_nvenc -f null - & done; wait
  ```
  A sessão que estourar o teto falha com erro do NVENC (tipicamente
  `OpenEncodeSessionEx failed: out of memory` / `no encode device`). Confirmar com `nvidia-smi -q -d ENCODER_STATS`.
- **O que quebra se divergir:** o card "encode acelerado em paralelo". Se o teto for menor que o número
  de renders simultâneos, o pipeline precisa de um semáforo global de encode — que é um artefato
  concreto (um lockfile / um pool no runner), não um comentário.
- **Fontes:**
  - https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-application-note/index.html (primária) — a frase citada; tabelas de performance referenciam Video Codec SDK v13.1.
  - https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new (primária, **mesmo domínio nvidia.com** ⇒ não soma) — coluna "Max # of concurrent sessions" = 12 para GeForce; "Unrestricted" para linha profissional; nº de chips NVENC por GPU (RTX 4090: 2; RTX 5090: 3; RTX PRO 6000 Blackwell: 4).
  - https://github.com/keylase/nvidia-patch (primária, repo, domínio independente) — existência do limite e do contorno; **não** cita o número.
  - Secundárias que datam a série histórica (não somam ao placar, servem para provar volatilidade):
    TechPowerUp (2020, "limit to 3"), VideoCardz/Tom's Hardware (2024, "up to 8", drivers Windows 551.76 / Linux 550.54.14). Ambas foram localizadas via busca; VideoCardz retornou HTTP 402 e Tom's Hardware entregou só o *chrome* da página no fetch — por isso ficam registradas como **não lidas integralmente**.

### R12-18 — aceleração de hardware no Remotion é recente, limitada e cara em bitrate

- **Verdade operacional:** `hardwareAcceleration` aceita `"disabled"` (default), `"if-possible"` e
  `"required"`. macOS via VideoToolbox (ProRes desde v4.0.228; H.264/H.265 desde v4.0.236);
  **Linux/Windows via NVENC desde v4.0.484, só H.264 e H.265**, com os binários FFmpeg empacotados do
  Remotion em Linux x64 já trazendo suporte NVENC; Linux ARM64 não suportado. Dois avisos que viram
  gate: "The file size is significantly larger by default when using hardware acceleration, likely
  because less compression is applied" e `crf` é **incompatível** com encoders acelerados (usar
  `--video-bitrate`). Não existe em Lambda nem Cloud Run.
- **Como reconferir:** https://www.remotion.dev/docs/hardware-acceleration e, local,
  `npx remotion render <comp> out.mp4 --hardware-acceleration=required --log=verbose`.
- **O que quebra se divergir:** o card "encode rápido". Se a versão instalada for < 4.0.484, a flag
  simplesmente não acelera nada em Linux e o ganho esperado some — o gate é comparar tamanho de arquivo
  e tempo com e sem, não só tempo.
- **Fontes:** https://www.remotion.dev/docs/hardware-acceleration (primária).

### R12-19 / R12-20 / R12-21 — Manim em paralelo: dá, mas por processo e com diretórios separados

- **Verdade operacional:** não existe paralelismo interno oficial e não existe ferramenta pronta e
  mantida pelo projeto para rodar N cenas. O que existe:
  1. **Isolamento por diretório.** `media_dir` é a raiz; `video_dir`, `tex_dir`, `partial_movie_dir`,
     `images_dir`, `text_dir`, `sections_dir` derivam dela. Só `--media_dir` (e `--log_dir`) têm flag de
     CLI; os demais são "no flag" e só saem por `manim.cfg` ou pelo objeto `config`. Precedência:
     arquivo de config < CLI < programático; config de pasta ganha do config de usuário.
     ⇒ **o padrão seguro é um `--media_dir` por processo** e depois mover/linkar as saídas.
  2. **Cache por hash.** Cada `play`/`wait` gera um hash (concatenação dos hashes de câmera, lista de
     animações e mobjects correntes) que nomeia o *partial movie file*; se o hash bate, reusa.
     `--disable_caching` desliga o uso do cache (mas ainda gera arquivos) e `--flush_cache` apaga os
     partial movie files. `max_files_cached` limita a quantidade (`-1` = infinito).
     ⇒ isso é um *content-addressed cache* já pronto — mas **por `media_dir`**. Isolar o `media_dir`
     por processo isola o cache também, o que **destrói a taxa de acerto entre execuções**. Essa é a
     tensão central do card de paralelismo do Manim.
  3. **Arquitetura.** Colaborador do repo oficial: "the current architecture of Manim is insufficient to
     handle multithreading correctly" e "I wouldn't expect it to be ready for any time before Manim
     v0.21.0" (refatoração com a classe `Manager`).
  **O que NÃO consegui fechar com fonte primária:** que a colisão concreta entre processos seja
  especificamente no `tex_dir`/temporários do LaTeX. Vi isso afirmado em relato secundário, não na doc
  nem numa issue oficial que eu tenha aberto. Vira LS-08.
- **Como reconferir:**
  `manim render -qh --media_dir /tmp/manim/$SCENE cena.py $SCENE` em N processos via
  `parallel -j8 --joblog manim.log`; e checar colisão rodando os mesmos N processos com `media_dir`
  **compartilhado** e comparando artefatos.
- **O que quebra se divergir:** o card "render de N cenas Manim em paralelo" e o card de cache. Se o
  cache do Manim puder ser compartilhado com segurança entre processos, o desenho muda de
  "um media_dir por processo" para "media_dir único + lock por hash".
- **Fontes:**
  - https://docs.manim.community/en/stable/guides/configuration.html (primária, v0.20.1) — `media_dir`, precedência, `--disable_caching`, `--flush_cache`, `--renderer [cairo|opengl]`.
  - https://docs.manim.community/en/stable/reference/manim._config.utils.ManimConfig.html (primária, mesmo domínio) — todos os `*_dir` com marcação "(no flag)", `max_files_cached`.
  - https://github.com/ManimCommunity/manim/discussions/3897 (primária, repo oficial) — falas de `JasonGrace2282` sobre arquitetura e v0.21.0.

### R12-22 / R12-23 / R12-24 / R12-25 — fila, DAG e cache por conteúdo

- **Verdade operacional (o que cada ferramenta *de fato* garante):**
  | ferramenta | decide rebuild por | paralelismo | retomada | ordem da saída |
  |---|---|---|---|---|
  | `xargs -P` | nada (não é build system) | `-P N`, default **1**, `-P 0` = máximo; exige `-n`/`-L`/`-I` | não | **indeterminada e misturada** (aviso explícito na man page) |
  | GNU parallel | nada | `-j`, default `100%`; aceita `N`, `N%`, expressão, ou arquivo relido durante a execução | **sim**: `--joblog` + `--resume` / `--resume-failed` / `--retry-failed` | agrupada por default ("same output as you would get had you run the commands sequentially"); `--line-buffer` é o meio-termo |
  | GNU make | **mtime** | `-j`; sem argumento, **sem limite**; jobserver coordena sub-makes | não (só o que já está feito) | `-O/--output-sync` |
  | Ninja | **mtime + hash da linha de comando** (`.ninja_log`); `restat` reavalia mtime pós-execução | default = nº de CPUs | não | `pool` (incl. `console`, profundidade 1) |
  | Bazel | **digest do conteúdo** (action cache `/ac/` + CAS `/cas/`, SHA256) | sim | sim (cache) | sim |
  | Dagster 1.13.17 | `code_version` + `data_version` (hash do code version com os data versions dos inputs) | sim | sim (memoização limitada; "the last-computed asset value is always cached") | sim |
  O padrão que o projeto quer — *content-addressed build cache aplicado a assets de vídeo* — é
  literalmente o par **action cache + CAS** do Bazel: a chave é o digest da *ação* (comando + inputs +
  ambiente declarados), o valor é o metadado do resultado, e os blobs de saída vivem endereçados pelo
  SHA256 do próprio conteúdo, num servidor HTTP/1.1 que só precisa de `PUT` e `GET`. **Não é preciso
  adotar o Bazel para adotar o padrão**: um diretório `cas/<sha256[:2]>/<sha256>` mais um
  `ac/<action-digest>.json` reproduz o contrato em ~50 linhas.
  O aviso do Bazel que mais importa aqui: *"Bazel currently does not track tools outside a workspace"* —
  ou seja, uma versão diferente de FFmpeg/Chrome/LaTeX produz saída diferente com **a mesma chave de
  cache**. Num pipeline de vídeo isso é o modo de falha número um: a versão dos binários **tem** que
  entrar no digest da ação.
  `make` e `ninja` **não** dão cache por conteúdo: decidem por mtime (o ninja adiciona só o hash da
  linha de comando). Um `git checkout` numa worktree nova reescreve mtimes e invalida tudo — o que
  torna make/ninja uma péssima base de cache para um pipeline dirigido por worktrees paralelas, mesmo
  sendo ótima base de *escalonamento*.
- **Como reconferir:** `man xargs`, `man parallel`, `man make` (todos disponíveis nesta máquina),
  https://ninja-build.org/manual.html, https://bazel.build/remote/caching,
  https://docs.dagster.io/guides/build/assets/asset-versioning-and-caching.
- **O que quebra se divergir:** o card do runner e o card do cache. Se a chave de cache não incluir a
  versão dos binários, o gate "regerar do zero == usar cache" passa a dar falso verde.
- **Fontes:**
  - https://www.gnu.org/software/parallel/parallel.html (primária) — `-j` default 100%, `--joblog` (campos), `--resume`/`--resume-failed`/`--retry-failed`, `--halt soon,fail=3%`, `--line-buffer`/`--group`/`--ungroup`.
  - https://man7.org/linux/man-pages/man1/xargs.1.html (primária) + `man xargs` local (findutils) — `-P` default 1; aviso de saída misturada; `--show-limits`; SIGUSR1/SIGUSR2 ajustam a concorrência em tempo real.
  - `man make` local (GNU make, verificado nesta máquina): "If the -j option is given without an argument, make will not limit the number of jobs that can run simultaneously." (a versão online em gnu.org devolveu HTTP 429 em três tentativas — registro isso em vez de citar uma URL que eu não li).
  - https://ninja-build.org/manual.html (primária) — mtime; "Outputs implicitly depend on the command line that was used to generate them"; `.ninja_log`; `restat`; "Builds are always run in parallel, based by default on the number of CPUs your system has"; pools e `console`.
  - https://bazel.build/remote/caching (primária) — action cache vs CAS, SHA256, `/ac/` e `/cas/`, HTTP/1.1 PUT/GET, aviso sobre ferramentas fora do workspace.
  - https://docs.dagster.io/guides/build/assets/asset-versioning-and-caching (primária, Dagster 1.13.17) — `code_version`, `DataVersion`, hash do code version com os data versions dos inputs, skip de rematerializações.
  - https://ffmpeg.org/ffmpeg-formats.html#concat-1 (primária) — "All files must have the same streams (same codecs, same time base, etc.)"; `safe` default 1; `inpoint`/`outpoint` "work best with intra frame codecs".

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "O `concurrency` default do Remotion é metade das threads da CPU." | EM DISPUTA (meia-verdade) | O código faz `Math.round(Math.min(8, Math.max(1, maxCpus/2)))`: há **teto rígido de 8**. Em máquina de 32 threads o default é 8, não 16. A doc omite o teto. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/renderer/src/get-concurrency.ts |
| "O Remotion não tem API pública para concatenar chunks; tem que ser FFmpeg na mão." | REFUTADO | `combineChunks()` é API pública de `@remotion/renderer` desde **v4.0.279** (o arquivo existe no repo e a página de referência publica a assinatura completa). A frase "not a public API" ainda aparece na página antiga do Lambda e se refere ao algoritmo **interno** do Lambda. | https://www.remotion.dev/docs/renderer/combine-chunks |
| "Basta renderizar faixas com `--frames` e juntar com `ffmpeg -c copy`." | EM DISPUTA | Funciona só se todos os chunks tiverem os mesmos streams e a mesma time base, se os chunks tiverem **o mesmo número de frames** (exceto o último), se o vídeo for `h264-ts` e se o áudio for `pcm-16` **ou** AAC com `forSeamlessAacConcatenation`. Ignorar isso dá artefato de áudio, não erro. | https://www.remotion.dev/docs/distributed-rendering ; https://ffmpeg.org/ffmpeg-formats.html#concat-1 |
| "Remotion Cloud Run é a alternativa self-hosted / GCP ao Lambda." | REFUTADO | Cloud Run "is in Alpha status and not actively being developed"; e, entre as opções server-side, **só o Lambda distribui em chunks**. Não é self-hosted: é outro produto hospedado. A alternativa self-hosted real é orquestrar `frameRange` + `combineChunks()` você mesmo. | https://www.remotion.dev/docs/cloudrun ; https://www.remotion.dev/docs/compare-ssr |
| "GeForce permite 8 sessões NVENC simultâneas." | EM DISPUTA (desatualizado) | A Application Note do SDK 13.1 diz **12 por sistema** em GPUs não-qualificadas. O "8" é da atualização de jan/2024 (drivers Win 551.76 / Linux 550.54.14). O número mudou 4 vezes desde 2020: hardcodear qualquer valor é frágil. | https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-application-note/index.html |
| "Se faltar sessão NVENC, é só usar uma segunda GPU." | REFUTADO | O texto da NVIDIA diz "limited to 12 **per system**", não por GPU. Uma segunda GeForce não eleva o teto. | https://docs.nvidia.com/video-technologies/video-codec-sdk/13.1/nvenc-application-note/index.html |
| "Ligar GPU resolve o gargalo do render Remotion." | EM DISPUTA | Aceleração de hardware no Remotion só existe para H.264/H.265 em Linux/Windows **a partir de v4.0.484**, gera arquivo "significantly larger", é incompatível com `crf` e não roda em Lambda/Cloud Run. O encode é a fatia final; o gargalo típico é o Chrome (rasterização + screenshot). | https://www.remotion.dev/docs/hardware-acceleration |
| "Mais concorrência = render mais rápido." | REFUTADO | Issue oficial #4300: VPS de 48 cores/350 GB, Remotion 4.0.211 — passar de concorrência 1 para "100%" deixou o render **mais lento** com a maioria dos cores ociosa. A própria doc: "A concurrency too high and a concurrency too low can both be counterproductive." | https://github.com/remotion-dev/remotion/issues/4300 ; https://www.remotion.dev/docs/performance |
| "O Manim já paraleliza cenas / tem multiprocessing." | REFUTADO | Colaborador do repo: "the current architecture of Manim is insufficient to handle multithreading correctly"; refatoração (`Manager`) "not… before Manim v0.21.0". Paralelismo hoje é **externo**, processo por cena. | https://github.com/ManimCommunity/manim/discussions/3897 |
| "É só rodar N `manim` ao mesmo tempo." | EM DISPUTA | Dá, mas `media_dir` é raiz compartilhada de `video_dir`/`tex_dir`/`partial_movie_dir`/`images_dir`; e só `--media_dir` tem flag de CLI. Isolar por processo funciona, ao custo de **perder o cache por hash** entre execuções. | https://docs.manim.community/en/stable/reference/manim._config.utils.ManimConfig.html |
| "make/ninja dão cache incremental por conteúdo." | REFUTADO | GNU make decide por **mtime**; Ninja por **mtime + hash da linha de comando**. Cache endereçado por conteúdo é o par action-cache + CAS (Bazel). Numa worktree nova os mtimes são novos e make/ninja invalidam tudo. | https://ninja-build.org/manual.html ; https://bazel.build/remote/caching |
| "`xargs -P` resolve, é o mesmo que GNU parallel." | REFUTADO | `xargs -P` tem default 1, exige `-n`/`-L`, não tem joblog nem retomada, e a man page avisa que a saída sai "in an indeterminate order (and very likely mixed up)". GNU parallel agrupa a saída para ficar igual à sequencial e tem `--joblog`/`--resume`. | https://man7.org/linux/man-pages/man1/xargs.1.html ; https://www.gnu.org/software/parallel/parallel.html |
| "O cache de vídeo do Remotion é um detalhe de tuning." | EM DISPUTA | `offthreadVideoCacheSizeInBytes` default = **metade da memória disponível no início do render**, por processo. N renders paralelos reivindicam N × metade da RAM. Numa máquina de 31 GiB isso é o primeiro recurso a saturar, antes da CPU. | https://www.remotion.dev/docs/renderer/render-media |

---

## 4. Armadilhas (falso verde deste domínio)

- **"O render em 4 chunks terminou e o MP4 abre"** → abrir não prova costura: artefato de áudio por
  chunk de tamanho desigual em AAC é inaudível num player e visível só no waveform → fica vermelho o
  gate `ffprobe -count_frames` (contagem total de frames) + comparação de duração de áudio contra o
  render monolítico, e um teste de RMS por janela nas fronteiras de chunk.
- **"Subi o `--concurrency` para 32 e o render acelerou na primeira medição"** → a primeira execução
  usa cache de vídeo quente e a máquina estava ociosa; sob N worktrees o mesmo valor causa swap →
  fica vermelho `npx remotion benchmark --concurrencies=… --runs=3` executado **com** a carga de fundo
  real, e um assert de `free -m` mínimo durante o render.
- **"`--concurrency=100%` é o teto seguro"** → é o teto **aceito** (acima de `nproc` o Remotion lança
  erro), não o teto saudável; RAM satura antes → fica vermelho o watchdog de RSS por render.
- **"NVENC está ligado, então o encode é paralelo"** → a 9ª/13ª sessão simultânea falha em runtime, não
  em configuração, e o Remotion pode cair para software silenciosamente com `if-possible` → fica
  vermelho `--hardware-acceleration=required` no teste de fumaça + o semáforo global de encode.
- **"Arquivo saiu menor/maior, mas o vídeo está igual"** → a doc avisa que hardware acceleration
  produz arquivo "significantly larger"; se ninguém mede, o pipeline entrega vídeos 3× maiores →
  fica vermelho um gate de tamanho por segundo de vídeo (`bytes/s` máximo por preset).
- **"O cache do Manim está funcionando: o segundo render foi instantâneo"** → foi instantâneo porque o
  `media_dir` era o mesmo; com um `media_dir` por processo (o isolamento que o paralelismo exige) a
  taxa de acerto vai a zero e ninguém percebe, porque o resultado continua correto → fica vermelho uma
  métrica de *cache hit rate* emitida pelo runner, não o tempo de parede.
- **"O hash de conteúdo bateu, então pode reusar o asset"** → o Bazel avisa que ferramentas fora do
  workspace não entram no digest; trocar FFmpeg 6.1.1 por 7.x ou o Chrome do Remotion muda a saída com
  a **mesma** chave → fica vermelho um `tool-versions.lock` incluído no digest da ação.
- **"`git worktree` isola tudo"** → isola arquivos, não isola porta TCP (Studio em 3000), nem o
  `media_dir` do Manim, nem o cache global do npm/pnpm, nem a GPU → fica vermelho um teste que sobe
  dois agentes simultâneos e confere que ambos renderizam.
- **"Zero erro no log do `xargs -P`"** → `xargs` mistura stdout de processos paralelos; uma stack trace
  intercalada vira ruído e o exit code de um filho pode se perder → fica vermelho migrar para
  `parallel --joblog` e assertar a coluna de exit status do joblog, não o log de texto.
- **"O disco tem espaço"** → o número que importa não é o livre agora, é o pico: frames intermediários +
  partial movie files do Manim + N worktrees + o cache de OffthreadVideo em disco → fica vermelho um
  gate de espaço livre mínimo verificado **antes** de despachar a onda, não durante.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-01 | Qual é o `concurrency` efetivo default nesta máquina de 32 threads? | 8 (pelo teto do código) | `npx remotion render <comp> /tmp/o.mp4 --log=verbose 2>&1 \| grep -i concurrenc` | Card de tuning; se for 16, o orçamento de RAM por render dobra. |
| LS-02 | Quantos MB de RSS custa cada aba de render do Remotion? | ~300–600 MB/aba (chute, **sem fonte**) | durante o render: `ps -o rss=,cmd= -C chrome \| awk '{s+=$1} END{print s/1024" MB"}'` e dividir por `--concurrency` | Card "N agentes em paralelo": o teto de worktrees sai daqui. |
| LS-03 | Onde está o joelho da curva tempo × concurrency nesta máquina? | medir 2/4/8/12/16 | `npx remotion benchmark <comp> --concurrencies=2,4,8,12,16 --runs=3` | Card de tuning e o SLA de tempo por vídeo. |
| LS-04 | Qual o teto real de sessões NVENC na RTX 4070 Laptop com driver 580.159.03? | 12 (doc SDK 13.1) | loop de 16 `ffmpeg -c:v h264_nvenc` simultâneos até falhar; `nvidia-smi -q -d ENCODER_STATS` | Card do semáforo de encode; se for 8, o pool encolhe. |
| LS-05 | O default de `offthreadVideoCacheSizeInBytes` é mesmo metade da RAM **por processo**? | sim; fixar explicitamente em `~1.5 GiB` por render | rodar 2 renders simultâneos e observar `free -m` / `smem -k`; comparar com `--offthreadvideo-cache-size-in-bytes=1500000000` | Card de OOM guard: se for por máquina, o guard é desnecessário. |
| LS-06 | `combineChunks()` produz saída equivalente ao render monolítico (frames, duração, áudio)? | sim, com chunks de tamanho igual + `h264-ts` + `pcm-16` | render A (monolítico) vs B (4 chunks + combine); `ffprobe -count_frames -show_entries stream=nb_read_frames,duration` nos dois | Gate de aceitação do render chunked; se divergir, o chunking sai do escopo. |
| LS-07 | Quanto disco custa 1 minuto de vídeo em artefatos intermediários (frames + partial movies + chunks)? | orçar 2 GB/min (chute, **sem fonte**) | `du -sh` do `media_dir` do Manim e do tmp do Remotion antes/depois de um render de 1 min | Gate de espaço livre pré-onda; card de limpeza de worktree. |
| LS-08 | Rodar N `manim` com `media_dir` **compartilhado** colide de fato (LaTeX/tex_dir)? | assumir que sim; isolar por processo | rodar 8 cenas com LaTeX em paralelo no mesmo `media_dir` e comparar com 8 em `media_dir` separados; diff dos SVG/PNG gerados | Card de paralelismo do Manim: se não colidir, mantemos cache compartilhado (hit rate alto). |
| LS-09 | Qual a taxa de acerto do cache do Manim com `media_dir` por processo vs compartilhado? | medir antes de decidir | contar arquivos em `partial_movie_files` reusados entre duas execuções idênticas | Card de cache: define se vale um CAS externo por cima do Manim. |
| LS-10 | Quantos Remotion Studio simultâneos cabem (porta 3000 + fallback)? | 1 por worktree, porta explícita `3000+i` | `npx remotion studio --port=30NN` em N worktrees; `ss -ltnp \| grep -c node` | Card de dev-loop paralelo; portas efêmeras locais são 32768–60999 (~28k), então porta não é o limite — o limite é RAM. |
| LS-11 | O FFmpeg do sistema (6.1.1) serve ou o pipeline deve usar sempre o binário empacotado do Remotion? | usar o empacotado (`binariesDirectory`) para determinismo | `ffmpeg -version` vs o binário do `@remotion/compositor-*`; comparar hash de saída dos dois | Gate de determinismo do cache: versão de ferramenta **tem** que entrar no digest. |
| LS-12 | Renders repetidos com a mesma entrada produzem bytes idênticos? | provavelmente **não** (timestamps/metadata) | `npx remotion render` 2× e `sha256sum`; se divergir, testar `--metadata` fixo e comparar frames com `ffmpeg -i a -i b -filter_complex psnr` | Define se a chave de cache pode ser o hash da **saída** ou tem que ser o hash da **entrada + ferramentas**. |
| LS-13 | Qual o pico de RAM com N worktrees × M abas antes do swap? | manter N×M ≤ 8 até medir | script de rampa: subir renders até `free` < 2 GiB, registrar N×M | Teto duro do orquestrador de ondas. |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| "Local" é requisito rígido, ou o Lambda é aceitável para picos? | É mandato/compliance, não fato técnico. O custo medido ($0.103 por 10 min HD) não é o obstáculo. | Se Lambda entra: o chunking vira problema resolvido pelo fornecedor. Se não: precisamos do nosso orquestrador de chunks (`frameRange` + `combineChunks`). |
| Qual é a máquina-alvo de produção? A de desenvolvimento (32 threads / 31 GiB / RTX 4070 Laptop) é a mesma? | Todo número de concorrência, RAM e sessões NVENC depende disso. | Muda o teto de agentes paralelos, o default de `concurrency` e se o semáforo de NVENC precisa existir. |
| Aceitamos arquivos "significantly larger" em troca de encode acelerado por NVENC? | Trade-off qualidade/tamanho/tempo é apetite do dono. | Se não: `--hardware-acceleration=disabled` e o paralelismo tem que vir da CPU, o que muda o cálculo de threads. |
| Podemos aplicar `keylase/nvidia-patch` no driver NVIDIA da máquina? | Envolve garantia, suporte, política de TI e possivelmente EULA. Não é dedutível. | Se sim: o semáforo de encode some. Se não: encode fica limitado a ~8–12 sessões e precisa de fila. |
| Quantos agentes/worktrees simultâneos o dono quer de fato? | É decisão de throughput vs. estabilidade, não de hardware. | Define diretamente o orçamento de RAM por render e o valor de `offthreadVideoCacheSizeInBytes`. |
| Determinismo bit-a-bit é requisito, ou "visualmente equivalente" basta? | É critério de aceitação do produto. | Bit-a-bit ⇒ chave de cache pelo hash da entrada + versões de ferramenta + metadata fixa. Visual ⇒ chave mais frouxa e comparação por PSNR/SSIM. |
| Adotamos um DAG runner (Dagster/Prefect) ou ficamos em `just` + GNU parallel + um CAS caseiro? | É custo de operação e curva de aprendizado do time, não fato técnico. | Dagster traz `code_version`/`data_version` prontos mas um serviço a mais; `parallel --joblog` + CAS caseiro é ~50 linhas e zero daemon. |
| Fixamos Manim em v0.20.1 ou acompanhamos a v0.21 (refatoração `Manager`)? | Apetite de risco vs. ganho futuro de paralelismo interno. | Fixar ⇒ paralelismo externo por processo é permanente. Acompanhar ⇒ o card de paralelismo do Manim pode ser reescrito na v0.21. |
| Fixamos a versão do Remotion (hoje 4.0.507) ou seguimos `latest`? | Política de dependências. | Vários claims aqui têm piso de versão (`combineChunks` 4.0.279, NVENC 4.0.484, faixas múltiplas 4.0.502). Fixar abaixo de 4.0.502 remove funcionalidade que os cards assumem. |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** a **estratégia de paralelismo do render de um único vídeo**. Se o pipeline
  expuser uma única função `renderComposition(comp, outPath, {chunks: N})` que hoje chama
  `renderMedia()` uma vez e amanhã chama N vezes com `frameRange` + `combineChunks()`, a reversão custa
  **um arquivo e uma variável de config** (`RENDER_CHUNKS`, default `1`). O que **não** é troca barata é
  a chave de cache: se ela nascer sem a versão das ferramentas no digest, corrigir depois invalida todo
  o cache existente e obriga a reprocessar tudo — decidir isso já no primeiro card.

- **Segunda troca barata:** `concurrency` e `offthreadVideoCacheSizeInBytes` devem ser **sempre
  explícitos** em toda invocação, lidos de um único módulo de config. Nunca aceitar o default: o default
  de concorrência tem um teto de 8 não documentado (R12-03) e o default do cache reivindica metade da
  RAM por processo (R12-06). Custo de reverter: uma constante.

- **Skills que devem carregar este conhecimento:**
  - a skill de **render/encode** (Remotion CLI + FFmpeg): precisa de R12-01..R12-11, R12-18, R12-25
    (concat demuxer) e das armadilhas de costura de áudio;
  - a skill de **orquestração paralela / worktrees**: precisa de R12-03, R12-05, R12-06, R12-13,
    R12-22, R12-23, LS-01, LS-02, LS-05, LS-13;
  - a skill de **Manim**: precisa de R12-19, R12-20, R12-21 e da tensão `media_dir` isolado × cache;
  - a skill de **cache/determinismo de build**: precisa de R12-24, R12-25 e do aviso de ferramentas
    fora do workspace.

- **Cards que este cluster condiciona (trabalho, não ids):**
  1. Módulo de configuração de render que fixa `concurrency`, `offthreadVideoCacheSizeInBytes`,
     `hardwareAcceleration` e `binariesDirectory` — nenhum default implícito.
  2. Orquestrador de chunks local: divide `durationInFrames` em N faixas **de tamanho igual exceto a
     última**, renderiza com `h264-ts` + `pcm-16`, combina com `combineChunks()` passando `h264`.
  3. Gate de equivalência chunked × monolítico (`ffprobe -count_frames`, duração de áudio, RMS nas
     fronteiras) — sem esse gate o chunking é falso verde.
  4. Semáforo global de encode acelerado (N ≤ teto NVENC medido em LS-04), com fallback para libx264
     quando o pool estiver cheio.
  5. Wrapper de Manim que cria um `media_dir` por processo, executa via `parallel --joblog` e reporta
     *cache hit rate* — não só tempo.
  6. CAS caseiro para assets de vídeo: `ac/<action-digest>.json` + `cas/<sha256>`; o digest da ação
     inclui inputProps, hash do código da composição, e um `tool-versions.lock`
     (Remotion, Chrome empacotado, FFmpeg, Manim, TeX).
  7. Pré-flight de onda: checar RAM livre, disco livre e portas antes de despachar N agentes; abortar
     a onda em vez de deixar o OOM killer escolher a vítima.
  8. Escolha do runner (`just` + GNU parallel vs. Dagster) — bloqueado por PERGUNTA-DONO.
