# R11 — Teste de vídeo: golden master, determinismo e diff perceptual

**Escopo desta pesquisa:** como a indústria prova automaticamente que uma saída visual/animada não
regrediu — qual artefato vira baseline, qual métrica gateia, quais são as fontes conhecidas de
não-determinismo em Chrome headless e como cada uma se elimina, como se versiona baseline sem inchar
o repo, e o que existe de comparação automática de áudio.
**NÃO responde:** escolha de provedor de TTS/LLM, formato do manifesto, política de aprovação humana
de snapshot, custo de render, nem qual limiar numérico este projeto deve adotar (isso é
`PERGUNTA-DONO` + `LEDGER-SEED`, porque depende do conteúdo e da máquina).

**Data da pesquisa:** 2026-08-10. **Versões de referência apuradas nesta data:**
Playwright `1.62.1` (npm), Remotion `4.0.507` (npm, `latest`), pixelmatch `7.2.0` (npm),
FFmpeg `6.1.1-3ubuntu5` (binário desta máquina), ImageMagick `6.9.12-98 Q16` (desta máquina),
git-lfs `3.7.1` (site oficial) / `3.4.1` (desta máquina), libvmaf `3.0.0` (release citada no repo Netflix).

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R11-01 | O matcher `expect(page).toHaveScreenshot()` do Playwright expõe `animations` (default `"disabled"`), `caret` (default `"hide"`), `mask`, `maskColor` (default `#FF00FF`), `stylePath`, `threshold` (default `0.2`), `maxDiffPixels`, `maxDiffPixelRatio` e `scale` (default `"css"`), e existe desde a v1.23. | (2-0) | PROVÁVEL | https://playwright.dev/docs/api/class-pageassertions |
| R11-02 | Playwright faz a comparação pixel a pixel com a biblioteca `pixelmatch` e nomeia o baseline como `{testName}-{browserName}-{platform}.png`. | (1-0) | NÃO VERIFICADO | https://playwright.dev/docs/test-snapshots |
| R11-03 | Congelar animação/transição CSS antes do disparo do screenshot é prática documentada por três fornecedores independentes de teste visual (Playwright, Chromatic, Percy), cada um com mecanismo próprio. | (3-0) | CONFIRMADO | https://www.chromatic.com/docs/animations/ |
| R11-04 | Animação dirigida por JavaScript (Motion/Framer Motion, GSAP, jQuery) **não** é congelada automaticamente por Chromatic nem por Percy — o autor tem de desligá-la no código. | (2-0) | PROVÁVEL | https://www.chromatic.com/docs/animations/ |
| R11-05 | O `pixelmatch` aceita `threshold` (default `0.1`), `includeAA` (default `false`), `alpha` (`0.1`), `diffMask`, `checkerboard` e `windowSize`, e devolve o número de pixels divergentes. | (1-0) | NÃO VERIFICADO | https://github.com/mapbox/pixelmatch/blob/main/README.md?plain=1 |
| R11-06 | A versão corrente publicada de `pixelmatch` é 7.2.0, e a opção `checkerboard` foi introduzida nessa versão. | (2-0) | PROVÁVEL | https://registry.npmjs.org/-/package/pixelmatch/dist-tags |
| R11-07 | Qual espaço de cor o `threshold` usa está inconsistente entre as duas docs: Playwright descreve YIQ; o README do `pixelmatch` 7.x descreve OKLab + métrica HyAB. | (1-1) | EM DISPUTA | https://playwright.dev/docs/api/class-pageassertions vs https://github.com/mapbox/pixelmatch/blob/main/README.md?plain=1 |
| R11-08 | `jest-image-snapshot` permite trocar o algoritmo com `comparisonMethod: 'pixelmatch' \| 'ssim'` (default `pixelmatch`) e gateia com `failureThreshold` (default `0`) + `failureThresholdType: 'pixel' \| 'percent'` (default `pixel`); a doc afirma que SSIM reduz falso-positivo. | (1-0) | NÃO VERIFICADO | https://github.com/americanexpress/jest-image-snapshot/blob/main/README.md |
| R11-09 | `odiff` (npm `odiff-bin`) usa o algoritmo YIQ NTSC para diferença perceptual, tem detecção de antialiasing desligável, `--fail-on-layout-diff` e `--ignore-regions`, e compara png/jpeg/webp/tiff inclusive entre formatos diferentes. | (1-0) | NÃO VERIFICADO | https://github.com/dmtrKovalenko/odiff/blob/main/README.md?plain=1 |
| R11-10 | Os filtros `psnr` e `ssim` do FFmpeg exigem que os dois vídeos tenham a **mesma resolução e o mesmo pixel format**, e assumem o mesmo número de frames, comparados um a um; a validação de dimensão aborta com `AVERROR(EINVAL)`. | (2-0) | PROVÁVEL | `man ffmpeg-filters` (FFmpeg 6.1.1) + https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/vf_psnr.c |
| R11-11 | A flag `-fflags +bitexact` do FFmpeg existe exatamente para tornar checksums reproduzíveis: "Only write platform-, build- and time-independent data. This ensures that file and data checksums are reproducible and match between platforms. Its primary use is for regression testing." | (1-0) | NÃO VERIFICADO | `man ffmpeg-formats` (FFmpeg 6.1.1), seção AVOptions `bitexact` |
| R11-12 | x264 é determinístico por padrão mesmo com SMP; existe a flag `--non-deterministic` descrita como "Slightly improve quality of SMP, at the cost of repeatability" — ou seja, a não-reprodutibilidade é opt-in. | (1-0) | NÃO VERIFICADO | https://manpages.debian.org/testing/x264/x264.1.en.html |
| R11-13 | VMAF só está disponível no FFmpeg se o build tiver `--enable-libvmaf`; o build padrão do Ubuntu (`ffmpeg 6.1.1-3ubuntu5`) **não** tem, e `ffmpeg -h filter=libvmaf` responde `Unknown filter 'libvmaf'`. | (2-0) | PROVÁVEL | https://github.com/Netflix/vmaf + saída do binário local |
| R11-14 | O valor "≈6 pontos de VMAF = 1 JND", muito citado, **não** aparece no README nem no FAQ oficiais do Netflix/vmaf. | (1-0) | NÃO VERIFICADO | https://github.com/Netflix/vmaf/blob/master/resource/doc/faq.md |
| R11-15 | Em Remotion 4.x o default do `--gl` no desktop é `null` (o Chrome decide o backend); `angle` só passa a ser default no Remotion 5.0, que **não está lançado** (npm `latest` = 4.0.507 em 2026-08-10). | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/5-0-migration + https://registry.npmjs.org/-/package/remotion/dist-tags |
| R11-16 | A doc do Remotion enumera como causas de flicker/não-determinismo: animação não dirigida por `useCurrentFrame()`, `Math.random()`, `Date.now()`, estado dependente da ordem de render, fontes/imagens/vídeos não carregados, dados assíncronos e as propriedades CSS `background-image`/`mask-image`. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/flickering |
| R11-17 | O Remotion oferece `random(seed)` determinístico porque "Remotion is spinning up multiple instances of the webpage to render frames in parallel, and the random values will be different on every instance". | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/using-randomness |
| R11-18 | O Chromium headless tem a flag `--font-render-hinting` (valores `none\|slight\|medium\|full\|max`), adicionada em 2018-02-13 justamente porque headless e não-headless renderizavam texto diferente no Linux. | (1-0) | NÃO VERIFICADO | https://chromium.googlesource.com/chromium/src/+/e1b855d4545dc4fff19cee500d7ce105126f3bd2 |
| R11-19 | Padronizar o ambiente de render em container é a resposta documentada de dois projetos independentes ao problema de o mesmo HTML renderizar diferente em máquinas diferentes (BackstopJS `--docker`; Playwright: "run tests in the same environment where the baseline screenshots were generated"). | (2-0) | PROVÁVEL | https://github.com/garris/BackstopJS + https://playwright.dev/docs/test-snapshots |
| R11-20 | O FFmpeg 6.1.1 desta máquina traz os muxers de hash `framemd5`, `streamhash` e `hash`, o muxer `chromaprint` (fingerprint de áudio, `-fp_format raw\|compressed\|base64`) e o filtro `axcorrelate` (correlação cruzada normalizada entre dois áudios, saída em [-1,1]). | (1-0) | NÃO VERIFICADO | `ffmpeg -h muxer=framemd5` / `-h muxer=chromaprint` / `man ffmpeg-filters` (FFmpeg 6.1.1) |
| R11-21 | O `compare` do ImageMagick 6.9.12-98 desta máquina suporta exatamente as métricas `AE, Fuzz, MAE, MEPP, MSE, NCC, PAE, PHASH, PSNR, RMSE` — **não** há SSIM, DSSIM nem butteraugli na lista. | (1-0) | NÃO VERIFICADO | `compare -list metric` (ImageMagick 6.9.12-98) |
| R11-22 | Git LFS "replaces large files ... with text pointers inside Git, while storing the file contents on a remote server"; no GitHub, Free/Pro inclui 10 GiB de storage e 10 GiB de banda, e o excedente é medido a US$ 0,07/GiB-mês (storage) e US$ 0,0875/GiB (banda), com os antigos *data packs* descontinuados. | (2-0) | PROVÁVEL | https://git-lfs.com/ + https://docs.github.com/en/billing/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage |
| R11-23 | BackstopJS usa Resemble.js e gateia por `misMatchThreshold` com default `0.1` (percentual de pixels divergentes). | (1-0) | NÃO VERIFICADO | https://github.com/garris/BackstopJS |

---

## 2. Detalhe por claim

### R11-01 — Opções de `toHaveScreenshot` no Playwright

- **Verdade operacional:** o estado da arte de golden master visual já vem embalado. A asserção
  desliga animação CSS/transição/Web Animations, esconde o caret, mascara regiões voláteis com
  `mask: [locator]` pintadas de `#FF00FF`, injeta CSS de estabilização por `stylePath`, e gateia por
  três eixos independentes: `threshold` (tolerância de cor por pixel), `maxDiffPixels` (contagem
  absoluta) e `maxDiffPixelRatio` (fração). Os mesmos campos existem em
  `playwright.config.ts` sob `expect.toHaveScreenshot`, e o `.d.ts` publicado também expõe
  `pathTemplate` para controlar onde o baseline é gravado.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright/types/test.d.ts | grep -n -A3 'toHaveScreenshot'`
  e a página https://playwright.dev/docs/api/class-pageassertions
- **O que quebra se divergir:** todo card que assumir "o gate visual já existe pronto" — se as
  opções mudarem de nome, o arquivo de config do runner e o helper de captura são reescritos.
- **Fontes:**
  - https://playwright.dev/docs/api/class-pageassertions (primária) — tabela de opções, defaults,
    versões de introdução (`maskColor` v1.35, `stylePath` v1.41, matcher desde v1.23).
  - https://raw.githubusercontent.com/microsoft/playwright/main/packages/playwright/types/test.d.ts
    (primária, tipos publicados no repo) — confirma `animations` default `"disabled"`, `caret`
    default `"hide"`, `scale` default `"css"`, `maxDiffPixels`/`maxDiffPixelRatio` "unset by default".
  - https://registry.npmjs.org/-/package/playwright/dist-tags (primária) — `latest` = `1.62.1`.
  - **Ressalva honesta:** as duas primeiras fontes são do mesmo fornecedor (Microsoft/Playwright).
    São artefatos distintos (site de doc × `.d.ts` embarcado), mas não são leituras independentes.

### R11-02 — Playwright usa pixelmatch e o baseline é por SO+browser

- **Verdade operacional:** o baseline **não é um arquivo**, é uma matriz `browser × plataforma`. Um
  golden master aprovado no Linux não vale no macOS, e o próprio Playwright materializa isso no nome
  do arquivo (`example-test-1-chromium-darwin.png`). Isso é a prova de que a comunidade já desistiu
  de "um baseline universal".
- **Como reconferir:** https://playwright.dev/docs/test-snapshots e, depois de instalar,
  `node -e "console.log(require('@playwright/test/package.json').dependencies)"` para ver se
  `pixelmatch` aparece na árvore.
- **O que quebra se divergir:** o card que definir o layout de `__snapshots__/`. Se a chave de
  plataforma não entrar no caminho, dois agentes em worktrees com SOs diferentes sobrescrevem o
  baseline um do outro em silêncio.
- **Fontes:**
  - https://playwright.dev/docs/test-snapshots (primária) — "Playwright Test uses the pixelmatch
    library"; padrão de nome `{testName}-{browserName}-{platform}.png`.
  - Tentativa de segunda primária falhou: o `package.json` de `playwright-core` no `main` não expõe
    campo `dependencies` legível por fetch. Por isso o placar fica em (1-0) e vira LEDGER-SEED L-04.

### R11-03 — Congelar animação CSS é prática de três fornecedores

- **Verdade operacional:** os três resolvem o mesmo problema de formas diferentes, e as três
  soluções são complementares, não excludentes:
  - **Playwright:** `animations: "disabled"` — "stops CSS animations, CSS transitions and Web
    Animations"; animações finitas são levadas ao fim, infinitas são resetadas.
  - **Chromatic:** pausa automaticamente animações e transições CSS, animações SVG, vídeos e GIFs;
    `pauseAnimationAtEnd` com default `true` (pausa no último frame, para que elementos que
    "animam para dentro" apareçam completos).
  - **Percy:** congela GIFs no primeiro frame e "most CSS `animation` and `transition` styles";
    oferece o media query `@media only percy { ... }` para forçar o estado final de um elemento.
- **Como reconferir:** as três URLs abaixo; `pauseAnimationAtEnd` e `@media only percy` são strings
  literais e greppáveis nas páginas.
- **O que quebra se divergir:** o card de "estabilização de captura". Se a política do projeto for
  "pausar no primeiro frame" e a ferramenta pausar no último, todo baseline nasce errado — e nasce
  *consistentemente* errado, que é o pior caso, porque passa nos testes.
- **Fontes:**
  - https://www.chromatic.com/docs/animations/ (primária) — lista o que pausa e o default de
    `pauseAnimationAtEnd`.
  - https://www.browserstack.com/docs/percy/stabilize-screenshots/animations (primária) — GIF no
    primeiro frame, `@media only percy`, `$.fx.off = true`, `TweenMax.globalTimeScale(0)`.
  - https://playwright.dev/docs/api/class-pageassertions (primária) — semântica de
    `animations: "disabled"`.

### R11-04 — Animação em JS não é congelada automaticamente

- **Verdade operacional:** este é o buraco exato onde este projeto vive. Remotion **não** anima por
  CSS — anima por `useCurrentFrame()` + `interpolate()`, que é JavaScript. Nenhuma das ferramentas
  de screenshot congela isso por conta própria; o que salva o Remotion é que o próprio frame é a
  variável de controle (ver R11-16/R11-17). A lição transferível: *a estabilidade não vem da
  ferramenta de captura, vem de a animação ser função pura do frame.*
- **Como reconferir:** Chromatic: "Chromatic doesn't have the same control over them as it does over
  CSS animations" (sobre Motion/Framer Motion). Percy: lista explicitamente jQuery, Velocity,
  Greensock e `animateTransform` de SVG como não-congeláveis.
- **O que quebra se divergir:** o gate visual do estágio de composição. Se alguém introduzir uma
  animação por `requestAnimationFrame` fora do relógio do Remotion, o snapshot fica flaky e a
  resposta natural (afrouxar o `threshold`) destrói o oráculo em vez de consertar a causa.
- **Fontes:**
  - https://www.chromatic.com/docs/animations/ (primária).
  - https://www.browserstack.com/docs/percy/stabilize-screenshots/animations (primária).

### R11-05 / R11-06 / R11-07 — pixelmatch: opções, versão e o espaço de cor em disputa

- **Verdade operacional:** `pixelmatch(img1, img2, output, width, height, options)` devolve a
  contagem de pixels divergentes. `includeAA: false` (default) significa que **pixels de
  antialiasing são detectados e ignorados** — é exatamente esse comportamento que torna diff de
  texto renderizado sobrevivível. `windowSize` (default `Infinity`) muda o retorno para "máximo de
  pixels divergentes em qualquer janela N×N", o que permite gatear por *concentração* de diferença
  em vez de total — útil para pegar "um elemento sumiu" sem estourar em ruído espalhado.
- **A disputa (R11-07):** a doc do Playwright descreve `threshold` como "acceptable perceived color
  difference in the YIQ color space"; o README do `pixelmatch` no `main` (linha 7.x) descreve
  **OKLab** com a métrica **HyAB** (Ottosson 2020; Abasi et al. 2019). O `.d.ts` do Playwright já
  não menciona YIQ — diz só "acceptable perceived color difference". Duas leituras possíveis:
  (a) o Playwright empacota um pixelmatch anterior ao 7.x e a doc está certa para a versão que ele
  usa; (b) o Playwright atualizou a dependência e a prosa da doc ficou para trás. **Não resolvi
  isso** — resolve-se olhando `node_modules` depois do primeiro `npm i` (LEDGER-SEED L-04).
  Consequência prática: **o número do `threshold` não é portável entre ferramentas.** `threshold:0.2`
  no Playwright e `threshold:0.2` no `odiff` (que é YIQ, R11-09) não significam a mesma coisa.
- **Como reconferir:**
  `npm view pixelmatch version` · `curl -s https://registry.npmjs.org/-/package/pixelmatch/dist-tags`
  · https://github.com/mapbox/pixelmatch/releases (v7.2.0 introduziu `checkerboard`, descrito como
  mudança sobre "pre-v7 behavior").
- **O que quebra se divergir:** o card que fixar o limiar do gate visual. Se a métrica por baixo
  mudar de YIQ para OKLab numa atualização de dependência, o mesmo `threshold` passa a aceitar/rejeitar
  um conjunto diferente de diferenças, e nenhum teste vai avisar — só a taxa de flake muda.
- **Fontes:**
  - https://github.com/mapbox/pixelmatch/blob/main/README.md?plain=1 (primária) — assinatura,
    defaults, OKLab/HyAB, detector de antialiasing (Vyšniauskas 2009).
  - https://github.com/mapbox/pixelmatch/releases (primária) — v7.2.0 é a mais recente; `checkerboard`
    entrou nela.
  - https://registry.npmjs.org/-/package/pixelmatch/dist-tags (primária) — `latest` = `7.2.0`.
  - https://playwright.dev/docs/api/class-pageassertions (primária, lado contrário da disputa) — YIQ.

### R11-08 — jest-image-snapshot: SSIM como alternativa ao diff de pixel

- **Verdade operacional:** é o único dos comparadores JS pesquisados que oferece **duas métricas no
  mesmo matcher**, e a doc é explícita sobre o motivo de existir a segunda: SSIM traz "reduced false
  positives (failing tests when the images look the same)" e "higher sensitivity to actual changes
  in the image itself". O modo rápido é `customDiffConfig: { ssim: 'fast' }`. Ele também tem
  `blur` (raio de gaussiana antes de comparar — amortece ruído de antialiasing de forma grosseira),
  `allowSizeMismatch` (default `false`) e `storeReceivedOnFailure` (grava a imagem recebida ao lado
  do baseline em vez de sobrescrever).
- **Como reconferir:** https://github.com/americanexpress/jest-image-snapshot/blob/main/README.md —
  greppar por `comparisonMethod`, `failureThresholdType`, `storeReceivedOnFailure`.
- **O que quebra se divergir:** o card que escolher o comparador. Se o projeto for de Jest/Vitest
  puro (sem Playwright), este é o caminho; se for Playwright, o `toHaveScreenshot` já resolve e essa
  dependência é gordura.
- **Fontes:**
  - https://github.com/americanexpress/jest-image-snapshot/blob/main/README.md (primária) — tabela
    completa de opções e defaults.
  - **Nota negativa relevante:** este README **não** contém nenhum aviso sobre divergência de
    renderização entre SOs ou sobre rodar em Docker. Quem adotar essa lib e não ler R11-19 vai
    descobrir o problema na primeira máquina diferente.

### R11-09 — odiff

- **Verdade operacional:** binário nativo (não-JS) com API Node, pensado para o caso "diff de muitas
  imagens grandes rápido". Duas opções interessam a um gate de vídeo: `--fail-on-layout-diff`
  (falha explicitamente quando as dimensões divergem, em vez de tentar comparar) e
  `--capture-diff-lines` / `--capture-diff-cols`, que devolvem **em quais linhas/colunas** a
  diferença está — isso é diagnóstico automático, não só um booleano.
- **Como reconferir:** `npx odiff-bin --help` depois de instalar; README em
  https://github.com/dmtrKovalenko/odiff/blob/main/README.md?plain=1 — o próprio README diz que a
  lista autoritativa de flags é o `--help`, não o README.
- **O que quebra se divergir:** nada estrutural — é substituível por pixelmatch em uma linha. É um
  ponto de troca barata.
- **Fontes:**
  - https://github.com/dmtrKovalenko/odiff/blob/main/README.md?plain=1 (primária) — YIQ NTSC,
    antialiasing, formatos suportados, nome do pacote `odiff-bin`.
  - **Não verificado:** os defaults numéricos das flags do odiff não estão no README.

### R11-10 — `psnr` e `ssim` do FFmpeg exigem geometria idêntica

- **Verdade operacional:** o texto do man é literal: *"Both video inputs must have the same
  resolution and pixel format for this filter to work correctly. Also it assumes that both inputs
  have the same number of frames, which are compared one by one."* O código confirma com um erro
  duro (`"Width and height of input videos must be same."` → `AVERROR(EINVAL)`). Consequência: essas
  métricas **não detectam dessincronia temporal** — se o vídeo novo tiver um frame a mais no começo,
  a comparação frame-a-frame vira lixo e a métrica despenca por um motivo que não é regressão visual.
  Elas medem *degradação de imagem*, não *deslocamento no tempo*.
- **Discrepância encontrada dentro do próprio FFmpeg 6.1.1:** o man diz que a opção do psnr se chama
  `stats_add_max`; o binário (`ffmpeg -h filter=psnr`) e o fonte dizem `output_max`. Use o binário
  como autoridade.
- **Como reconferir:**
  `ffmpeg -h filter=psnr` · `ffmpeg -h filter=ssim` · `man ffmpeg-filters | grep -A20 '^   ssim'`
  · https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/vf_psnr.c
- **O que quebra se divergir:** o card do gate de vídeo completo. Se ele comparar dois MP4s de
  durações diferentes, o resultado é numérico e sem sentido — o gate precisa **primeiro** assertar
  `durationInFrames` igual, e só depois medir.
- **Fontes:**
  - `man ffmpeg-filters` do FFmpeg 6.1.1 instalado (primária, man page) — seções `psnr` e `ssim`.
  - https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavfilter/vf_psnr.c (primária, fonte
    oficial) — tabela `psnr_options` e o check de dimensão em `config_input_ref`.

### R11-11 — `-fflags +bitexact` é a flag de reprodutibilidade

- **Verdade operacional:** a doc do FFmpeg diz, sobre a AVOption `bitexact` de formato: *"Only write
  platform-, build- and time-independent data. This ensures that file and data checksums are
  reproducible and match between platforms. Its primary use is for regression testing."* Isto é uma
  declaração de intenção do próprio projeto: comparar arquivo de mídia por checksum **é** um caso de
  uso suportado, desde que a flag esteja ligada. Medido nesta máquina: sem `bitexact` o MP4 carrega
  `TAG:encoder=Lavf60.16.100`; com `bitexact` essa tag some (ver LEDGER-SEED L-01).
- **Como reconferir:** `man ffmpeg-formats | grep -A4 bitexact` · `man ffmpeg | grep -A2 '\-bitexact'`
- **O que quebra se divergir:** o card de "prova de determinismo". Sem `bitexact`, o hash do arquivo
  final passa a ser função da versão do FFmpeg — subir o FFmpeg quebra 100% dos baselines de uma vez
  e o sinal fica indistinguível de regressão real.
- **Fontes:** `man ffmpeg-formats` (FFmpeg 6.1.1, primária, man page).

### R11-12 — x264 é determinístico por padrão

- **Verdade operacional:** a existência de uma flag chamada `--non-deterministic`, descrita como
  *"Slightly improve quality of SMP, at the cost of repeatability"*, é evidência positiva de que o
  comportamento default **é** repetível mesmo com múltiplas threads. O man ainda cita
  `--cpu-independent` para reprodutibilidade entre CPUs diferentes. Ou seja: a intuição comum de
  "encoder com thread nunca é determinístico" é falsa para x264 com as flags default.
- **Como reconferir:** https://manpages.debian.org/testing/x264/x264.1.en.html (versão documentada:
  `2:0.165.3222+gitb35605ac-3+b2`); localmente, o experimento em LEDGER-SEED L-01.
- **O que quebra se divergir:** o card que decidir *o que* é o artefato comparado. Se x264 fosse
  não-determinístico, comparar bytes seria impossível e só métrica perceptual restaria.
- **Fontes:** https://manpages.debian.org/testing/x264/x264.1.en.html (primária, man page).

### R11-13 — VMAF não vem no FFmpeg do sistema

- **Verdade operacional:** VMAF é a métrica mais defensável publicamente e é a **menos disponível**.
  O repo do Netflix instrui `./configure --enable-libvmaf` para usá-la via FFmpeg; o build
  `6.1.1-3ubuntu5` desta máquina não tem essa flag na linha de `configuration:` e responde
  `Unknown filter 'libvmaf'`. Adotar VMAF neste projeto significa **compilar FFmpeg ou usar
  container**, o que é um custo de setup real, não uma linha de config.
- **Como reconferir:**
  `ffmpeg -hide_banner -h filter=libvmaf` (espera-se `Unknown filter 'libvmaf'` no build atual)
  · `ffmpeg -version | tr ' ' '\n' | grep vmaf`
- **O que quebra se divergir:** qualquer card que escreva "gate por VMAF". Ele vira um card de
  infraestrutura (compilar/containerizar FFmpeg) antes de virar um card de teste.
- **Fontes:**
  - https://github.com/Netflix/vmaf (primária) — instrução `--enable-libvmaf`; libvmaf v3.0.0
    (2023-12-07) é a release citada; modelos v1 anunciados em 2026-06.
  - Saída do binário local (primária, comportamento do binário instalado).

### R11-14 — O "6 pontos de VMAF = 1 JND" não tem fonte primária localizada

- **Verdade operacional:** procurei nas fontes oficiais do projeto (README do `Netflix/vmaf` e
  `resource/doc/faq.md`) e **o número não está lá**. O FAQ oficial cobre onze perguntas técnicas e
  "notably omits guidance on score interpretation, perceptual thresholds, or statistical confidence
  measures". O número circula em fontes secundárias (Streaming Learning Center e afins) que
  **não abri** e portanto não conto. Um card que escreva "gate: ΔVMAF ≤ 6" hoje está citando
  folclore, não documentação.
- **Como reconferir:** buscar `JND` nas páginas de
  https://github.com/Netflix/vmaf/blob/master/resource/doc/faq.md e
  https://github.com/Netflix/vmaf/blob/master/resource/doc/references.md; se aparecer, virar
  PROVÁVEL. O post original do Netflix TechBlog está atrás de redirect do Medium e não abriu.
- **O que quebra se divergir:** o número do gate. Se o JND real for 2 ou 12, o gate calibrado em 6
  ou é ruidoso demais ou cego demais.
- **Fontes:**
  - https://github.com/Netflix/vmaf/blob/master/resource/doc/faq.md (primária) — evidência de
    **ausência** dentro da doc oficial, não evidência de que o número seja falso.

### R11-15 — Determinismo de GPU no Remotion depende de uma flag que ainda não tem default seguro

- **Verdade operacional:** em Remotion 4.x (o que existe hoje: `latest` = 4.0.507) o default do
  `--gl` no desktop é `null` — **o Chrome decide o backend gráfico**, que é literalmente "depende da
  máquina". Os valores aceitos são `null`, `angle`, `angle-egl`, `egl`, `swiftshader`, `swangle` e
  `vulkan` (4.0.41+). A doc recomenda `swangle` para máquina sem GPU e registra que, em Remotion 4.0,
  o GitHub Actions falha com `angle` porque os runners não têm GPU. Em Lambda/Cloud Run o default já
  é `swangle`. O Remotion 5.0 troca o default local para `angle` com fallback para software — mas a
  própria página de migração abre com *"Remotion 5.0 is not yet released"*.
- **Consequência dura para este projeto:** rodar N agentes em worktrees paralelas **na mesma
  máquina** com GPU pode ser determinístico; a mesma composição na máquina de outra pessoa, não. A
  única escolha que fecha o determinismo por construção é **fixar `gl` explicitamente** (candidato:
  `swangle`, software puro) em vez de aceitar o default.
- **Como reconferir:** https://www.remotion.dev/docs/gl-options ·
  https://www.remotion.dev/docs/5-0-migration ·
  `curl -s https://registry.npmjs.org/-/package/remotion/dist-tags`
- **O que quebra se divergir:** o card de configuração de render e o baseline inteiro. Trocar o
  backend gráfico muda o rasterizador; todo golden master recaptura.
- **Fontes:**
  - https://www.remotion.dev/docs/gl-options e https://www.remotion.dev/docs/5-0-migration
    (primárias, mesmo domínio → contam como **uma** fonte).
  - https://registry.npmjs.org/-/package/remotion/dist-tags (primária) — `latest` 4.0.507,
    `alpha` 4.1.0-alpha12, `canary` 4.0.0-alpha.217; **nenhuma 5.x publicada**.

### R11-16 / R11-17 — O catálogo oficial de não-determinismo do Remotion

- **Verdade operacional:** a página *Flickering* é, na prática, a lista de proibições que este
  projeto precisa transformar em lint. Causa → correção, com os nomes de API literais:
  | Causa | Correção documentada |
  |---|---|
  | animação não dirigida por frame | `useCurrentFrame()`; alternativa lenta e insuficiente: `--concurrency=1` |
  | `Math.random()` | `random(seed)` de `remotion` |
  | `Date.now()` e afins | derivar do número do frame |
  | estado que depende da ordem de render | componente tem de funcionar em qualquer ordem |
  | vídeo não carregado | `<Video>`, `<Audio>`, `<OffthreadVideo>` |
  | imagem não carregada | `<Img>` |
  | fonte não carregada | aguardar carga antes de `fitText()`, `fillTextBox()`, `measureText()` |
  | dado assíncrono | `delayRender()` + `continueRender()` |
  | `background-image` / `mask-image` CSS | evitar essas propriedades |
  | vários `<Html5Video>` | trocar por outra tag de vídeo |
  O motivo mecânico está na página de randomness: *"Remotion is spinning up multiple instances of
  the webpage to render frames in parallel, and the random values will be different on every
  instance."* Exceção documentada: `calculateMetadata()` pode usar aleatoriedade verdadeira porque
  roda uma vez só e não em paralelo.
- **Como reconferir:** https://www.remotion.dev/docs/flickering ·
  https://www.remotion.dev/docs/using-randomness · https://www.remotion.dev/docs/random
- **O que quebra se divergir:** o card do lint de determinismo (`PROGRAMA.md` já prevê "Nenhum
  `Date.now`/`Math.random`/`setTimeout` sob `src/composicao/`"). Esta tabela diz que a lista do
  PROGRAMA está **incompleta**: faltam `background-image`/`mask-image`, `<img>` cru e fonte não
  aguardada — três causas de flicker que nenhum grep por `Date.now` pega.
- **Fontes:** https://www.remotion.dev/docs/flickering e /docs/using-randomness (primárias, mesmo
  domínio → uma fonte).

### R11-18 — `--font-render-hinting` no Chromium headless

- **Verdade operacional:** o commit de 2018-02-13 (`e1b855d4`, mensagem *"using HINTING_FULL by
  default in headless builds, added command line parameter to override it"*) existe precisamente
  porque "the default font hinting is HINTING_MEDIUM, which leads to usage of subpixel glyphs
  positioning in Skia, but in desktop environment hinting eventually resolves to HINTING_FULL,
  resulting in slightly different font rendering with no option to control it". Ou seja: **o texto
  renderiza diferente entre headless e headed no Linux**, e isso é um fato documentado pelo próprio
  Chromium, não um mito de fórum.
- **Ressalva importante:** não confirmei que o Remotion aceite repassar essa flag. A página oficial
  de Chromium flags do Remotion lista apenas `--disable-web-security`, `--ignore-certificate-errors`,
  `--disable-headless`, `--gl`, `--user-agent` e `--dark-mode` — **não há entrada de font rendering
  nem qualquer flag arbitrária**. Isso é evidência positiva de ausência para a superfície documentada
  do Remotion (ver seção 3).
- **Como reconferir:**
  https://chromium.googlesource.com/chromium/src/+/e1b855d4545dc4fff19cee500d7ce105126f3bd2
  · https://www.remotion.dev/docs/chromium-flags
- **O que quebra se divergir:** o card que tentar estabilizar tipografia por flag. Se o Remotion não
  repassar a flag, a estabilização de fonte tem de vir de outro lugar: fonte embutida no bundle,
  ambiente containerizado, ou aceitar o antialiasing e absorver com `includeAA`/SSIM.
- **Fontes:**
  - https://chromium.googlesource.com/chromium/src/+/e1b855d4545dc4fff19cee500d7ce105126f3bd2
    (primária, repo oficial) — 10 arquivos alterados, incluindo `headless_shell_switches.cc`.
  - https://www.remotion.dev/docs/chromium-flags (primária) — lista fechada de flags suportadas.

### R11-19 — Container como resposta ao ambiente

- **Verdade operacional:** dois projetos independentes chegaram na mesma solução. BackstopJS: *"We've
  found that different environments can render the same webpage in slightly different ways -- in
  particular with text"*, e por isso existe `--docker`. Playwright: *"Browser rendering can vary
  based on the host OS, version, settings, hardware, power source (battery vs. power adapter),
  headless mode, and other factors. For consistent screenshots, run tests in the same environment
  where the baseline screenshots were generated."* Note "power source" — é um nível de paranoia que
  só se escreve depois de ter sido mordido.
- **Como reconferir:** https://github.com/garris/BackstopJS · https://playwright.dev/docs/test-snapshots
- **O que quebra se divergir:** a decisão "roda localmente na máquina do dono" vs. "roda em
  container". Se o projeto é local e single-machine, o baseline é válido só naquela máquina — e isso
  precisa estar escrito no card, não descoberto quando um segundo colaborador aparecer.
- **Fontes:** https://github.com/garris/BackstopJS (primária) e https://playwright.dev/docs/test-snapshots (primária).

### R11-20 — O arsenal de comparação já instalado nesta máquina

- **Verdade operacional:** o FFmpeg 6.1.1 local já resolve quatro necessidades sem instalar nada:
  - `-f framemd5` — hash **por frame** dos dados decodificados. É o meio-termo entre "hash do arquivo"
    (frágil) e "PNG por frame" (pesado): um arquivo de texto de N linhas que localiza *qual* frame
    mudou. Opções: `-hash` (default `md5`), `-format_version` (default 2).
  - `-f streamhash` — um hash por stream (default `sha256`).
  - Muxer `chromaprint` — fingerprint acústico direto do FFmpeg (`-fp_format raw|compressed|base64`,
    `-algorithm` default 1, `-silence_threshold` default -1). Este build tem `--enable-chromaprint`.
    O binário `fpcalc` **não** está instalado nesta máquina.
  - Filtro `axcorrelate` — *"Calculate normalized windowed cross-correlation between two input audio
    streams. Resulted samples are always between -1 and 1 inclusive. If result is 1 it means two
    input samples are highly correlated in that selected segment."* Opções: `size` (default 256,
    faixa 2..131072) e `algo` (`slow|fast|best`, default `best`).
  - Filtro `astats` — estatísticas por janela (`length` default 0.05 s), incluindo `RMS_level`,
    `Peak_level`, `DC_offset`, `Zero_crossings`, `Flat_factor`.
- **Como reconferir:**
  `ffmpeg -h muxer=framemd5` · `ffmpeg -h muxer=chromaprint` · `ffmpeg -h filter=axcorrelate`
  · `ffmpeg -h filter=astats`
- **O que quebra se divergir:** o card de comparação de áudio. Se o build do FFmpeg do usuário final
  não tiver `--enable-chromaprint`, o fingerprint some e sobra `axcorrelate`/`astats`.
- **Fontes:** saída do binário FFmpeg 6.1.1 instalado + `man ffmpeg-filters` (primária, man page).

### R11-21 — ImageMagick não tem SSIM na lista de métricas (nesta versão)

- **Verdade operacional:** `compare -list metric` no ImageMagick **6**.9.12-98 devolve exatamente:
  `AE, Fuzz, MAE, MEPP, MSE, NCC, PAE, PHASH, PSNR, RMSE`. **SSIM/DSSIM não estão na lista.** `AE`
  (absolute error, contagem de pixels diferentes) combinado com `-fuzz` é o análogo mais próximo de
  "pixelmatch com threshold", e `PHASH` é um hash perceptual que sobrevive a reencode. Esta é uma
  lista fechada retornada pela própria ferramenta — evidência positiva de ausência **para esta
  versão**; o ImageMagick 7 tem outra lista e não a verifiquei.
- **Como reconferir:** `compare -list metric` · `compare -version`
- **O que quebra se divergir:** o card que escolher a ferramenta de diff de imagem fora do Node. Se
  precisar de SSIM em CLI, ImageMagick 6 não serve — vai ser `ffmpeg -lavfi ssim` sobre PNGs ou uma
  lib JS.
- **Fontes:** `compare -list metric` e `man compare` do ImageMagick 6.9.12-98 instalado (primária,
  man page + binário).

### R11-22 — Custo real de versionar golden master

- **Verdade operacional:** Git LFS troca o arquivo por um ponteiro de texto no histórico e guarda o
  conteúdo em um servidor remoto — o repo Git em si não incha, mas o **clone completo com LFS**
  incha. No GitHub o modelo hoje é medido: 10 GiB de storage + 10 GiB de banda inclusos em Free/Pro
  (250 GiB em Team/Enterprise), depois US$ 0,07/GiB-mês de storage e US$ 0,0875/GiB de banda; os
  *data packs* pré-pagos foram removidos. Aritmética que importa aqui: um PNG 1920×1080 costuma
  pesar da ordem de 1 MB; **10.000 stills ≈ 10 GiB**, ou seja, o teto gratuito. Um projeto que
  capture 10 frames por composição e tenha 100 composições, recapturados 10 vezes ao longo do
  desenvolvimento, já mora nessa ordem de grandeza.
- **Como reconferir:** https://git-lfs.com/ (versão corrente 3.7.1) ·
  https://docs.github.com/en/billing/managing-billing-for-git-large-file-storage/about-billing-for-git-large-file-storage
  · localmente `git lfs version` (3.4.1 aqui).
- **O que quebra se divergir:** a decisão de onde o baseline mora. As três opções reais são:
  (a) PNG no git direto — simples, incha para sempre, cada recaptura é um blob novo permanente;
  (b) Git LFS — histórico limpo, custo medido, precisa de servidor;
  (c) **hash-only** — commitar apenas o `framemd5`/sha256 do baseline e manter os PNGs fora do git;
  o repo fica minúsculo e o diff visual só existe quando alguém tem o artefato local.
  A opção (c) é a única que não tem custo de armazenamento e é a única que **não deixa você olhar
  o que quebrou** sem re-render. Essa é uma decisão de dono (ver seção 6).
- **Fontes:** https://git-lfs.com/ (primária) e https://docs.github.com/... (primária).

### R11-23 — BackstopJS / Resemble.js

- **Verdade operacional:** `misMatchThreshold` default `0.1` — **percentual** de pixels divergentes,
  não fração de cor. É outra unidade que o `threshold` do pixelmatch. Terceira ferramenta, terceira
  semântica para a palavra "threshold".
- **Como reconferir:** https://github.com/garris/BackstopJS — greppar `misMatchThreshold`.
- **O que quebra se divergir:** nada neste projeto se BackstopJS não for adotado; serve como
  evidência de que "o limiar padrão da indústria" não é um número, é três números em três unidades.
- **Fontes:** https://github.com/garris/BackstopJS (primária).

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| `PROGRAMA.md:513` — *"renderizar 2× em rascunho + `diff` byte a byte dos frames"* é o oráculo bom | **PARCIALMENTE REFUTADO** | A parte "2× e diff" está certa e é barata. A parte "byte a byte" precisa de qualificação: comparar **frames PNG** byte a byte é sólido; comparar o **MP4** byte a byte só é estável com `-fflags +bitexact` e com a versão do FFmpeg pinada — sem a flag, o container carrega `TAG:encoder=Lavf60.16.100` e subir o FFmpeg invalida todos os baselines de uma vez. Existe uma terceira opção melhor que as duas: `-f framemd5`, que hasheia frames decodificados e é imune a container e a metadata. | `man ffmpeg-formats` (bitexact) + `ffmpeg -h muxer=framemd5` (FFmpeg 6.1.1) |
| Implícito no panorama: "encoder com múltiplas threads não é reprodutível, por isso não dá para comparar o vídeo final" | **REFUTADO** | x264 é reprodutível por default; a não-reprodutibilidade é opt-in via `--non-deterministic` ("at the cost of repeatability"). Medido nesta máquina: 3 encodes idênticos de 1280×720 com `-preset medium -threads 8` deram o mesmo MD5 (`3101f893…`), e 2 encodes com threads em auto também (`16ce9fe6…`). | https://manpages.debian.org/testing/x264/x264.1.en.html + medição local (L-01) |
| Existe prática publicada de snapshot testing **com Remotion** | **REFUTADO (para a doc oficial)** | A página oficial *Testing Remotion components* recomenda React Testing Library, Bun + Happy DOM e Playwright, ensina o wrapper `<Thumbnail noSuspense>` (v4.0.271+) e assere sobre `renderToString`. Ela **não menciona** golden master, snapshot de imagem, `renderStill` nem comparação de imagem. A lista completa da página é evidência positiva da ausência. `renderStill()` existe e serve (v2.3+), mas a doc dele também não fala em teste. | https://www.remotion.dev/docs/testing + https://www.remotion.dev/docs/renderer/render-still |
| Estabilizar tipografia headless é questão de passar `--font-render-hinting=none` no Remotion | **REFUTADO na superfície documentada do Remotion** | A flag existe no Chromium desde 2018 e resolve o problema no Chromium. Mas a página oficial *Chromium flags* do Remotion lista uma superfície fechada de 6 flags (`--gl`, `--disable-web-security`, `--ignore-certificate-errors`, `--disable-headless`, `--user-agent`, `--dark-mode`) e **não inclui** repasse de flags arbitrárias nem controle de font rendering. Não achei mecanismo documentado de repasse. | https://www.remotion.dev/docs/chromium-flags + https://chromium.googlesource.com/chromium/src/+/e1b855d4545dc4fff19cee500d7ce105126f3bd2 |
| "Gate de regressão em ΔVMAF ≤ 6 pontos (1 JND)" é o número da indústria | **NÃO SUSTENTADO** (não é refutação: é ausência de fonte) | O número não está no README nem no FAQ oficiais do `Netflix/vmaf`. Só circula em fontes secundárias que não abri. Além disso, `libvmaf` **não existe** no FFmpeg padrão do Ubuntu desta máquina. Duas razões independentes para não escrever esse gate num card ainda. | https://github.com/Netflix/vmaf/blob/master/resource/doc/faq.md + `ffmpeg -h filter=libvmaf` → `Unknown filter` |
| Remotion 5.0 já traz `angle` como default e resolve a questão de GPU | **REFUTADO** | *"Remotion 5.0 is not yet released"* na própria página de migração, e o npm confirma: `latest` = 4.0.507, sem nenhuma tag 5.x. Em 4.x o default local é `null` — o Chrome escolhe o backend, que é a pior situação possível para determinismo. | https://www.remotion.dev/docs/5-0-migration + https://registry.npmjs.org/-/package/remotion/dist-tags |
| "threshold 0.2" significa a mesma coisa em qualquer comparador | **REFUTADO** | Três unidades diferentes em três ferramentas: Playwright `threshold` = diferença de cor por pixel 0..1 (default 0.2); pixelmatch `threshold` = 0..1 (default 0.1) e a métrica de cor por baixo mudou para OKLab/HyAB no 7.x; BackstopJS `misMatchThreshold` = **percentual de pixels** (default 0.1). Copiar um número de um blog entre ferramentas produz um gate calibrado por acidente. | https://playwright.dev/docs/api/class-pageassertions + https://github.com/mapbox/pixelmatch/blob/main/README.md?plain=1 + https://github.com/garris/BackstopJS |

---

## 4. Armadilhas (falso verde deste domínio)

- **Render duas vezes na mesma máquina, no mesmo segundo, e ver o mesmo hash** → *por que não é
  prova:* prova determinismo contra escalonamento de threads, nada mais. Não testa fuso, locale,
  data, versão de fonte do sistema, backend de GPU, nem versão do Chrome. → *o que fica vermelho se
  sumir:* nada — é exatamente por isso que é perigoso. A sonda tem de ser render duas vezes **com o
  ambiente perturbado de propósito** (TZ diferente, LANG diferente, `--gl` diferente) e afirmar que
  o hash **muda só onde deveria**.
- **Afrouxar o `threshold` até o teste parar de piscar** → *por que não é prova:* cada ponto de
  afrouxamento é uma classe de regressão que deixa de ser detectada, e a perda é invisível. Com
  `maxDiffPixels` alto o bastante, "o texto sumiu" passa. → *o que fica vermelho se sumir:* nada.
  A defesa é gatear por **duas dimensões ao mesmo tempo** (`threshold` baixo + `maxDiffPixels`
  pequeno), ou usar `windowSize` do pixelmatch para exigir que a diferença esteja *concentrada*.
- **Baseline aprovado a partir do Studio/preview em vez do render** → *por que não é prova:* o Chrome
  do preview e o Chrome do render não têm as mesmas flags nem o mesmo backend `gl`. O baseline
  nasce descrito por um pipeline que nunca vai rodar em produção. → *o que fica vermelho se sumir:*
  nada; o primeiro render de verdade falha e o instinto é "recapturar", que apaga a evidência.
- **`--concurrency=1` para "consertar" flicker** → *por que não é prova:* a própria doc do Remotion
  diz que é mais lento e **não garante o timing correto**. Serializar esconde o sintoma
  (inconsistência entre instâncias) sem remover a causa (estado fora de `useCurrentFrame()`). →
  *o que fica vermelho se sumir:* ao voltar para concorrência normal, o flicker retorna — em
  produção, não no teste.
- **Comparar MP4 por PSNR/SSIM sem checar a duração antes** → *por que não é prova:* os filtros
  assumem mesmo número de frames comparados um a um. Um frame de offset produz um número baixo que
  parece regressão de qualidade e é, na verdade, regressão de sincronia — diagnóstico errado,
  correção errada. → *o que fica vermelho se sumir:* o teste fica vermelho, mas pela razão errada,
  o que custa mais que ficar verde.
- **Métrica global (média de SSIM do vídeo inteiro) como gate** → *por que não é prova:* uma
  regressão que destrói 3 frames de 900 é diluída na média até virar ruído. → *o que fica vermelho
  se sumir:* nada. Gate tem de ser sobre o **mínimo por frame** ou sobre a **contagem de frames
  abaixo do limiar**, não sobre a média.
- **`allowSizeMismatch: true` / comparadores que redimensionam** → *por que não é prova:* mudança de
  resolução é uma das regressões mais graves possíveis num gerador de vídeo, e essa opção a
  transforma em não-evento. → *o que fica vermelho se sumir:* nada; o vídeo sai em 1280×720 em vez
  de 1920×1080 e o gate visual aprova.
- **Um único frame-chave como golden master de uma cena animada** → *por que não é prova:* o frame 0
  de quase toda animação é o estado inicial, que costuma ser trivial (opacidade 0, escala 0). Um
  baseline do frame 0 é um baseline de tela quase vazia. → *o que fica vermelho se sumir:* nada.
  Frames-chave têm de ser escolhidos **no meio das transições**, onde a interpolação está exercida.
- **Aprovar baseline por `cp received/ approved/`** → *por que não é prova:* copiar absorve a
  regressão em silêncio, e o `PROGRAMA.md` já identificou isso (linhas 410-423). A defesa mecânica
  é o arquivo aprovado ser **imutável** e a aprovação exigir um passo que produza registro.
- **`includeAA: false` (default) escondendo mudança real** → *por que não é prova:* o detector de
  antialiasing do pixelmatch ignora pixels que *parecem* antialiasing. Uma mudança sutil de peso de
  fonte ou de sub-pixel de posição pode ser classificada como AA e desaparecer do diff. → *o que
  fica vermelho se sumir:* nada. A contraprova é rodar o mesmo diff uma vez com `includeAA: true`
  num teste separado, tolerante, só para observar a magnitude do ruído de AA e saber se ele cresceu.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| L-01 | O MP4 produzido por este pipeline é byte-idêntico entre execuções nesta máquina? | **Sim, medido**: FFmpeg 6.1.1 + libx264, 3 execuções de `testsrc2` 1280×720/30fps/4s com `-preset medium -threads 8` → MD5 idêntico `3101f8938972e6609d4f689df7df2263`; com threads em auto → `16ce9fe6ea3456a312cb466956fff265`; com `-fflags +bitexact -flags:v +bitexact` → estável e sem a tag `encoder`. Adotar `bitexact` mesmo assim, para tirar a versão do FFmpeg de dentro do artefato. | `ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=4" -c:v libx264 -preset medium -fflags +bitexact -flags:v +bitexact -y /tmp/x1.mp4 && ffmpeg -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=4" -c:v libx264 -preset medium -fflags +bitexact -flags:v +bitexact -y /tmp/x2.mp4 && md5sum /tmp/x1.mp4 /tmp/x2.mp4` | Se divergir com o pipeline real (que tem Chrome no meio, não `testsrc2`), a causa está no render de frames, não no encoder — e o oráculo vira PNG por frame em vez de arquivo final. |
| L-02 | O Remotion renderiza a mesma composição byte-idêntica duas vezes seguidas nesta máquina? | Presumir **não** até medir. Fixar `chromiumOptions.gl` explicitamente (candidato `swangle`) antes de medir, porque o default 4.x é `null` = "o Chrome decide". | `npx remotion still <entry> <id> out/a.png --gl=swangle && npx remotion still <entry> <id> out/b.png --gl=swangle && sha256sum out/a.png out/b.png` | Se divergir, nenhum golden master pixel-exato é possível e o gate obrigatoriamente vira métrica com tolerância (SSIM/pixelmatch), o que muda o tipo do card e o formato do baseline. |
| L-03 | O mesmo `renderStill` com `--gl=angle` e `--gl=swangle` produz PNGs iguais nesta máquina? | Presumir **não**. Se diferirem, `gl` vira parte da chave do baseline, igual a `browserName`/`platform` no Playwright. | `npx remotion still <entry> <id> out/angle.png --gl=angle; npx remotion still <entry> <id> out/swangle.png --gl=swangle; compare -metric AE out/angle.png out/swangle.png null: 2>&1` | Se diferirem, o nome do arquivo de baseline precisa carregar o backend gráfico; sem isso, dois agentes com configs diferentes se sobrescrevem. |
| L-04 | Qual versão de `pixelmatch` o `@playwright/test` instalado realmente usa, e a métrica de cor é YIQ ou OKLab? | Presumir que o número do `threshold` **não** é portável; calibrar empiricamente contra frames reais, não copiar de blog. | `npm ls pixelmatch` · `node -p "require('pixelmatch/package.json').version"` | Se for 7.x (OKLab), os limiares publicados em qualquer material anterior a 2025 estão em outra escala e a calibração inicial do gate está errada. |
| L-05 | Qual é o ruído de base (pixels divergentes entre dois renders idênticos) desta máquina, por composição? | Medir **antes** de escolher qualquer limiar: renderizar 2× e diffar. O limiar do gate deve ser `ruído_medido × margem`, nunca um número importado. | `pixelmatch a.png b.png diff.png` via script, ou `compare -metric AE a.png b.png null: 2>&1` | Se o ruído for 0, dá para gatear por hash e o baseline vira um `.sha256` de 64 bytes (opção hash-only, sem LFS). Se for >0, precisa de tolerância e de PNG versionado. |
| L-06 | `libvmaf` está disponível no FFmpeg deste ambiente? | **Não** nesta máquina (`ffmpeg 6.1.1-3ubuntu5`, `Unknown filter 'libvmaf'`). Decisão provisória: **não usar VMAF**; usar SSIM (nativo) e diff de PNG. | `ffmpeg -hide_banner -h filter=libvmaf` · `ffmpeg -version \| grep -o 'enable-libvmaf'` | Se um card depender de VMAF, ele passa a exigir compilar FFmpeg ou containerizar — sai de "card de teste" e vira "card de infraestrutura". |
| L-07 | `fpcalc`/chromaprint está disponível para fingerprint de áudio? | O binário `fpcalc` **não** está instalado; mas o FFmpeg local tem `--enable-chromaprint` e o muxer `chromaprint`. Usar o muxer do FFmpeg em vez de adicionar dependência. | `command -v fpcalc; ffmpeg -h muxer=chromaprint` | Se o FFmpeg do ambiente-alvo não tiver `--enable-chromaprint`, a comparação de áudio cai para `axcorrelate` + `astats`, que dão correlação e RMS mas não um identificador compacto para commitar. |
| L-08 | Qual o tamanho real do conjunto de baselines depois de N composições? | Medir depois das 10 primeiras composições e projetar antes de decidir git vs LFS vs hash-only. | `du -sh __snapshots__/ && find __snapshots__ -name '*.png' \| wc -l && git count-objects -vH` | Se passar de ~1 GiB no histórico, migrar depois exige reescrever o histórico do git (caro e destrutivo em worktrees paralelas). Esta decisão é barata **agora** e cara depois. |
| L-09 | Renderizar com `TZ` e `LANG` diferentes muda o PNG? | Presumir que **sim** para qualquer composição que formate data/número, e proibir formatação dependente de ambiente na camada pura. | `TZ=UTC LANG=C npx remotion still <entry> <id> out/utc.png; TZ=Asia/Tokyo LANG=ja_JP.UTF-8 npx remotion still <entry> <id> out/tk.png; sha256sum out/utc.png out/tk.png` | Se divergir, o runner precisa exportar `TZ`/`LANG` fixos e o lint precisa proibir `Intl.*`/`toLocaleString` sem locale explícito — mais uma regra que o grep por `Date.now` não pega. |
| L-10 | Frames PNG do Remotion são reprodutíveis quando renderizados em worktrees paralelas simultâneas (contenção de CPU/GPU)? | Presumir **sim** se L-02 passar, mas medir sob carga, porque é o modo real de operação deste projeto. | rodar 4 renders da mesma composição em paralelo e `sha256sum` os 4 resultados | Se divergir sob carga e não isolado, o gate vira flaky exatamente na configuração que o projeto usa, e a causa é quase impossível de achar depois. |
| L-11 | Quantos frames-chave por composição são necessários para o gate pegar regressões reais? | Provisório: primeiro e último frame de cada `<Series.Sequence>`, mais o ponto médio de cada transição. Medir o custo em tempo e em bytes. | cronometrar `npx remotion still` × K e medir `du -sh` do conjunto | Se K frames por composição forem caros demais, o gate vira "render completo + framemd5" (um arquivo de texto por vídeo) em vez de PNGs — muda o formato do baseline. |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| O baseline visual é **pixel-exato** (hash) ou **tolerante** (métrica com limiar)? | Depende de L-02/L-05 (o ambiente é determinístico?) **e** do apetite do dono por falso-positivo vs. falso-negativo. Nenhuma doc decide isso. | *Pixel-exato:* baseline é um `.sha256` de 64 bytes, repo não incha, zero falso-negativo, mas qualquer upgrade de Chrome/Remotion quebra tudo de uma vez. *Tolerante:* baseline é PNG (MBs), aguenta upgrade, mas exige calibrar e defender um número. |
| Onde os PNGs aprovados moram: git direto, Git LFS, ou fora do git (hash-only)? | É uma escolha de custo, de fricção de colaboração e de "quero conseguir olhar o que quebrou sem re-render". Não há resposta técnica única. | *Git direto:* zero setup, histórico incha para sempre. *LFS:* histórico limpo, precisa de servidor e tem custo medido (US$ 0,07/GiB-mês no GitHub). *Hash-only:* repo minúsculo, mas ninguém consegue ver o diff sem re-renderizar o baseline. |
| O projeto aceita depender de container (Docker) para render, ou o render tem de funcionar na máquina nua do dono? | Playwright e BackstopJS convergem em container como solução do problema de ambiente, mas containerizar render com GPU/Chrome tem custo de setup real e o mandato "rodar LOCALMENTE" pode ou não englobar isso. | *Com container:* baselines portáveis entre máquinas e colaboradores possíveis. *Sem container:* baseline é válido só naquela máquina, e isso precisa estar escrito no README, senão o segundo colaborador acha que encontrou um bug. |
| Qual é a política quando o baseline diverge: falha dura, ou "escreve em `received/` e falha"? | O `PROGRAMA.md` já propõe a segunda (linha 360), mas a decisão de o arquivo aprovado ser imutável e o custo de revisão humana disso é do dono. | *Falha dura sem artefato:* barato, mas o agente não consegue diagnosticar. *Com `received/`:* diagnosticável, mas produz lixo em disco e exige uma política de limpeza. |
| Vale pagar o custo de compilar/containerizar FFmpeg com `--enable-libvmaf`? | VMAF é a métrica mais defensável publicamente, mas não está no FFmpeg do sistema e o número do JND que justificaria o gate não tem fonte primária localizada (R11-14). | *Sim:* métrica citável, custo de build e de manutenção do container. *Não:* SSIM nativo + diff de PNG cobrem o caso de regressão, com números menos "publicáveis" mas igualmente falsificáveis. |
| Áudio entra no golden master, e em qual nível: fingerprint, correlação, ou nada? | Depende de o dono considerar dessincronia áudio/vídeo uma regressão detectável automaticamente ou um item de revisão humana. Não achei ferramenta padrão publicada para detectar *drift* automaticamente. | *Fingerprint (chromaprint):* pega "o áudio mudou", commit barato (string base64), não localiza *onde*. *`axcorrelate`:* mede correlação por janela e o lag de pico revela offset — mas exige escrever o cálculo do lag, não vem pronto. *Nada:* áudio só no olho/ouvido humano. |
| Quantos frames-chave por composição, e escolhidos por quem — regra automática ou curadoria? | É trade-off entre cobertura do gate e custo de captura/armazenamento/revisão. Não há número publicado. | *Regra automática (ex.: 5 frames equiespaçados):* previsível, pode cair todo em estados triviais. *Curadoria:* pega o meio das transições, mas vira trabalho manual por composição e alguém tem de manter. |

---

## 7. Recomendação para o roadmap

**A forma do oráculo que as fontes sustentam.** Nada do que li recomenda comparar o MP4 final como
oráculo primário. O que a indústria faz, e o que as fontes primárias suportam, é uma **pirâmide de
três camadas**, da mais barata para a mais cara:

1. **Prova de determinismo (mais barata, roda sempre):** render 2× e comparar. Nesta camada o
   artefato ideal é `ffmpeg -i out.mp4 -f framemd5 -` — um arquivo de texto de N linhas, hash por
   frame decodificado, imune a container e a metadata (medido: `a1.mp4` sem `bitexact` e `b1.mp4`
   com `bitexact` têm bytes diferentes e **o mesmo** framemd5, `0bdfae70c7c6f887a838cf2f7084142c`).
   Isso responde "mudou alguma coisa?" e "em qual frame?" sem guardar um único pixel.
2. **Golden master de frame-chave (média):** `renderStill()` de K frames por composição, comparados
   com pixelmatch/`toHaveScreenshot`, com `threshold` **calibrado contra o ruído medido em L-05**,
   e `maxDiffPixels` apertado. Esta é a camada que responde "o que mudou visualmente".
3. **Métrica sobre o vídeo inteiro (mais cara, sob demanda):** `ffmpeg -lavfi ssim` **com asserção
   prévia de mesma duração/resolução**, gateando pelo **mínimo por frame**, nunca pela média.
   VMAF fica fora até L-06 mudar e até R11-14 ter fonte.

**Ponto de troca barata:** o comparador de imagem. `pixelmatch`, `odiff` e `jest-image-snapshot` são
intercambiáveis atrás de uma função `comparar(baselinePath, recebidoPath) -> {pixeisDiferentes, diffPath}`
— **um arquivo, ~30 linhas**. A troca cara, e que precisa ser decidida cedo, é (a) o **formato do
baseline** (PNG versionado vs. hash) e (b) o `chromiumOptions.gl` fixado, porque ambos são chaves de
identidade do baseline: mudar qualquer um dos dois recaptura 100% dos golden masters. Fixe `gl`
explicitamente no dia 1 mesmo que o valor seja provisório — a variável tem um nome e um lugar, e
mudá-la depois é uma linha; **descobrir** que ela existe depois de 200 baselines é uma recaptura.

**Segunda troca barata, menos óbvia:** o limiar. Não escreva número literal em teste. `threshold` e
`maxDiffPixels` vivem em **uma** constante nomeada, derivada do ruído medido, com o valor medido
registrado ao lado em comentário. Três ferramentas usam a palavra "threshold" com três unidades
diferentes (R11-23) — a constante nomeada é o que impede alguém colar o número do blog errado.

**Skills que devem carregar este conhecimento:**
- a skill de **composição Remotion** precisa carregar a tabela de R11-16 inteira (as dez causas de
  flicker), não só "não use `Math.random`" — em particular `background-image`/`mask-image`, `<img>`
  cru e fonte não aguardada, que o lint proposto no `PROGRAMA.md` hoje não pega;
- a skill de **teste/gate visual** precisa carregar R11-01 (API concreta), R11-07 (o limiar não é
  portável), R11-10 (psnr/ssim exigem geometria idêntica) e a seção 4 inteira;
- a skill de **render/CLI** precisa carregar R11-15 (fixar `gl`) e R11-11 (`-fflags +bitexact`);
- a skill de **revisão** precisa carregar a seção 4: as armadilhas são todas do tipo "o teste ficou
  verde e não devia", que é exatamente o que uma revisão adversarial procura.

**Cards que este cluster condiciona:**
- o card que cria o helper de captura de still (fixa `gl`, `TZ`, `LANG`, `imageFormat`, `scale`) —
  condicionado por R11-15 e L-09;
- o card que cria o comparador de imagem e a constante de limiar — condicionado por L-05
  (o limiar **não pode** ser escrito antes de o ruído ser medido);
- o card que define o layout e a imutabilidade de `__snapshots__/` — condicionado por R11-02
  (a chave tem de incluir plataforma e backend gráfico) e por L-03;
- o card do gate de determinismo por `framemd5` — condicionado por R11-11 e L-01;
- o card do lint de determinismo — condicionado por R11-16 (a lista atual está incompleta);
- o card de comparação de áudio, se existir — condicionado por L-07 e pela `PERGUNTA-DONO` sobre
  nível de exigência de áudio; hoje não há ferramenta publicada de detecção automática de *drift*,
  só peças (`axcorrelate`, `astats`, muxer `chromaprint`) que alguém tem de montar;
- o card de decisão de armazenamento de baseline — bloqueado por `PERGUNTA-DONO`, e **barato agora,
  caro depois** (L-08).
