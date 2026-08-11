# R09 — Animação de código: Code Hike, Shiki e alternativas

**Escopo desta pesquisa:** fecha o que existe hoje (2026-08-10) para exibir e animar código dentro
de um render Remotion local — pacotes reais, versões, licenças, onde o highlight roda e como medir
texto. **Não** responde performance real desta máquina, nem escolha de tema/fonte (isso é do dono).

---

## Nota de contagem de fontes (leia antes da tabela)

O contrato manda contar domínios. Aqui isso favorece artificialmente afirmações sobre produtos de
fornecedor único: `remotion.dev`, `github.com/remotion-dev` e `registry.npmjs.org/@remotion/*` são
três domínios mas **um fornecedor**. Onde isso acontece eu escrevo o placar por domínio (regra do
contrato) **e** anoto `corroboração de fornecedor: 1` no detalhe. Um claim com placar 3-0 e
corroboração de fornecedor 1 não é independente — é doc + código + publicação da mesma casa. Isso é
suficiente para nome de API e versão (o fornecedor é a autoridade), e **insuficiente** para
comportamento sob carga, custo e determinismo.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R09-01 | O repositório `remotion-dev/template-code-hike` existe, está ativo (push 2026-07-31) e é listado no catálogo oficial de templates do Remotion. | (3-0) | CONFIRMADO | https://www.remotion.dev/templates/code-hike |
| R09-02 | `npx create-video@latest --code-hike` é comando válido: `code-hike` é o `cliId` do template e o CLI registra todo `cliId` como flag booleana. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/create-video/src/templates.ts |
| R09-03 | A lista oficial de templates do `create-video` tem 22 `cliId` gratuitos (`hello-world`, `javascript`, `blank`, `next`, `next-no-tailwind`, `next-pages-dir`, `vercel`, `react-router`, `three`, `still`, `audiogram`, `music-visualization`, `prompt-to-video`, `skia`, `overlay`, `stargazer`, `tiktok`, `code-hike`, `render-server`, `recorder`, `prompt-to-motion-graphics`, `electron`) mais 1 pago (`editor-starter`). | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/create-video/src/templates.ts |
| R09-04 | O template Code Hike **não** é MIT: o repo não declara SPDX e vale a licença dual do Remotion — grátis até 3 pessoas, Company License a partir de 4. | (3-0) | CONFIRMADO | https://remotion.pro/license |
| R09-05 | Code Hike 1.x é publicado no npm como `codehike` (latest **1.1.0** em 2026-08-10) com subpaths `./code`, `./mdx`, `./blocks`, `./utils/token-transitions`, `./utils/static-fallback`, `./utils/selection`. | (3-0) | CONFIRMADO | https://registry.npmjs.org/codehike/latest |
| R09-06 | A licença do `codehike` é MIT. | (2-0) | PROVÁVEL | https://registry.npmjs.org/codehike/latest |
| R09-07 | Code Hike depende de React **e MDX** para o pipeline de markdown, mas `highlight()` + `Pre` de `codehike/code` são usáveis **sem MDX** — o template Remotion não tem nenhum arquivo `.mdx`. | (3-0) | CONFIRMADO | https://codehike.org/blog/v1 |
| R09-08 | O motor de highlight do Code Hike é `@code-hike/lighter` (TextMate via `tm-grammars`), **não** Shiki. | (2-0) | PROVÁVEL | https://registry.npmjs.org/@code-hike/lighter/latest |
| R09-09 | Licença de `@code-hike/lighter`: o npm declara `MIT`, mas o GitHub não detecta arquivo de licença no repo `code-hike/lighter` (`license: null`, último push 2024-12-31). | (1-1) | EM DISPUTA | https://api.github.com/repos/code-hike/lighter |
| R09-10 | **`@remotion/code` não existe** — 404 no registry npm e não há diretório `code` em `packages/` do monorepo. | (2-0) | REFUTADO (a API não existe) | https://api.github.com/repos/remotion-dev/remotion/contents/packages |
| R09-11 | Não existe página de doc oficial do Remotion dedicada a "animated code"/"code transitions"; o caminho oficial documentado é o template Code Hike. | (2-0) | PROVÁVEL | https://api.github.com/repos/remotion-dev/remotion/contents/packages/docs/docs |
| R09-12 | `@remotion/layout-utils` existe desde v4.0.50, é MIT (4.0.507) e exporta `measureText()`, `fitText()` (v4.0.88), `fillTextBox()` (v4.0.57) e `fitTextOnNLines()` (v4.0.313). | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/layout-utils/fit-text |
| R09-13 | `measureText()` mede criando um `<span>` real no DOM (`position:absolute`, `top:-10000px`, `whiteSpace:'pre'`, `display:inline-block`) + `getBoundingClientRect()`, com cache em `Map` — não usa canvas. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/layout-utils/src/layouts/measure-text.ts |
| R09-14 | `validateFontIsLoaded` mede duas vezes (fonte pedida vs fallback) e lança erro se as medidas baterem; passa a `true` por padrão no Remotion 5.0 (era `false`). | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/layout-utils/measure-text |
| R09-15 | O template Code Hike pré-computa highlight **e** medição em `calculateMetadata()`, que o Remotion executa **uma única vez, numa aba separada**, antes do render. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/calculate-metadata |
| R09-16 | O `CodeTransition.tsx` do template **não** usa Web Animations API: usa `getStartingSnapshot()`/`calculateTransitions()` de `codehike/utils/token-transitions` e aplica estilo por frame via `useCurrentFrame()` + `interpolate()`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/src/CodeTransition.tsx |
| R09-17 | O template usa `twoslash-cdn`, que **baixa type definitions de CDN em runtime** (cache em memória por padrão, `storage` opcional para persistir). | (2-0) | PROVÁVEL | https://twoslash.netlify.app/packages/cdn |
| R09-18 | Shiki está em **4.4.3**, MIT (Pine Wu 2021 / Anthony Fu 2023–), baseado em gramáticas TextMate; bundle completo = 6.4 MB min / 1.2 MB gzip, bundle web = 3.8 MB / 695 KB. | (3-0) | CONFIRMADO | https://shiki.style/guide/bundles |
| R09-19 | As boas práticas oficiais do Shiki são: reutilizar um highlighter singleton (`dispose()` explícito), usar bundle fine-grained, preferir o engine **JavaScript RegExp** ao Oniguruma WASM na web, e mover o highlight para Worker. | (2-0) | PROVÁVEL | https://shiki.style/guide/best-performance |
| R09-20 | `@shikijs/magic-move` **4.4.3** MIT existe, com wrappers `./vue`, `./react`, `./solid`, `./svelte`, `./core`, `./renderer` e peer `shiki ^4.0.0`. | (3-0) | CONFIRMADO | https://registry.npmjs.org/@shikijs/magic-move/latest |
| R09-21 | O pacote `shiki-magic-move` (1.4.0) está **deprecated** como alias, e o repo `shikijs/shiki-magic-move` foi **arquivado em 2026-06-03**; o código vive em `shikijs/shiki`. | (2-0) | PROVÁVEL | https://registry.npmjs.org/shiki-magic-move/latest |
| R09-22 | O renderer do magic-move anima com **CSS transitions** (`--smm-duration`, `CLASS_MOVE`) e espera com `element.getAnimations()`; não expõe parâmetro de progresso/tempo manual. | (1-0) | NÃO VERIFICADO | https://raw.githubusercontent.com/shikijs/shiki/main/packages/magic-move/src/renderer.ts |
| R09-23 | Licenças das alternativas: Prism **MIT** (branch default `v2`), highlight.js **BSD-3-Clause**, starry-night **MIT**, tree-sitter **MIT**, rough-notation original **MIT** (último push 2024-03-18). | (2-0) | PROVÁVEL | https://api.github.com/repos/highlightjs/highlight.js |
| R09-24 | `@remotion/rough-notation` **existe oficialmente** (4.0.507, MIT, desde v4.0.490) e expõe props `progress` (0–1) e `seed` — ou seja, animação de anotação dirigida por frame e forma determinística. | (3-0) | CONFIRMADO | https://registry.npmjs.org/@remotion/rough-notation/latest |
| R09-25 | JetBrains Mono é **OFL-1.1** e Fira Code é **SIL OFL 1.1**; ambos estão em `@remotion/google-fonts` (`JetBrainsMono.ts`, `FiraCode.ts`) apontando para `fonts.gstatic.com` — ou seja, **fonte baixada da rede no render**. | (3-0) | CONFIRMADO | https://api.github.com/repos/JetBrains/JetBrainsMono |

---

## 2. Detalhe por claim

### R09-01 — O template `remotion-dev/template-code-hike` existe e está vivo
- **Verdade operacional:** é o único caminho de animação de código que o Remotion mantém como
  produto. Última publicação no repo em **2026-07-31**, não arquivado, descrição "Beautiful code
  snippet animations". Dependências fixadas: `codehike 1.0.4`, `@code-hike/lighter 1.0.3`,
  `twoslash-cdn 0.3.1`, `react 19.2.3`, `remotion ^4.0.0`, `@remotion/layout-utils ^4.0.0`,
  `zod 4.4.3`, `polished 4.3.1`.
- **Como reconferir:**
  `curl -s https://api.github.com/repos/remotion-dev/template-code-hike | jq '{archived,pushed_at,license}'`
  e `curl -s https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/package.json`
- **O que quebra se divergir:** o card "adotar o template Code Hike como base do renderer de código"
  perde a base; a fixture de snippet (`public/code1.tsx`…`code4.swift`) deixa de existir; a matriz de
  versões pinada no nosso `package.json` fica órfã.
- **Fontes:**
  - https://www.remotion.dev/templates/code-hike — catálogo oficial, descreve o template (primária)
  - https://api.github.com/repos/remotion-dev/template-code-hike — `archived:false`, `pushed_at:2026-07-31T09:03:35Z`, `license:null` (primária)
  - https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/package.json — dependências e versões (primária)
- **Corroboração de fornecedor: 1** (tudo Remotion).

### R09-02 — `npx create-video@latest --code-hike` é válido
- **Verdade operacional:** o comando funciona porque o CLI declara `boolean: [...ALL_TEMPLATES.map(f => f.cliId), 'tmp', 'yes', 'no-tailwind', 'help']` e resolve com
  `export const isFlagSelected = ALL_TEMPLATES.find((f) => parsed[f.cliId]);`. Como existe uma entrada
  com `cliId: 'code-hike'` apontando para o repo `template-code-hike`, a flag `--code-hike` existe por
  construção, não por documentação.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/create-video/src/select-template.ts`
  e `npx create-video@latest --help`
- **O que quebra se divergir:** o passo de bootstrap do worktree de vídeo (script de scaffolding);
  qualquer card que assuma "scaffolding em um comando" vira "clonar repo + patch de package.json".
- **Fontes:**
  - `packages/create-video/src/templates.ts` (raw.githubusercontent.com) — `cliId: 'code-hike'` (primária)
  - `packages/create-video/src/select-template.ts` (raw.githubusercontent.com) — parsing de flags (primária)
  - https://www.remotion.dev/templates/code-hike — mostra o comando literal `npx create-video@latest --code-hike` (primária)
- **Nota:** a página https://www.remotion.dev/docs/cli/create-video renderiza a lista via componente
  `<CreateVideoTemplateFlags />`; o HTML servido **não** contém os nomes. A lista literal só existe no
  código-fonte. Não copie a lista de um blog.

### R09-03 — Lista oficial de templates
- **Verdade operacional:** 22 templates gratuitos + `editor-starter` (pago). Nenhum deles é
  "code animation" além do `code-hike`. `prompt-to-motion-graphics` e `prompt-to-video` são os
  templates LLM-adjacentes; `recorder` é screencast.
- **Como reconferir:** mesmo `templates.ts` acima; conferir contra https://www.remotion.dev/templates
- **O que quebra se divergir:** o card de "escolher template base" e o inventário de dependências.
- **Fontes:**
  - `packages/create-video/src/templates.ts` — lista de `cliId`/repo (primária)
  - https://www.remotion.dev/templates — mesmos 22 nomes em prosa (primária)
- **Rechecar até:** 2026-11-10 (templates entram e saem com frequência).

### R09-04 — O template Code Hike não é MIT
- **Verdade operacional:** o GitHub retorna `license: null` para `template-code-hike`; o README diz
  *"for some entities a company license is needed"*. O `LICENSE.md` do Remotion define Free License
  para indivíduos, non-profits, avaliação e empresas com **até 3 pessoas**; a página comercial diz que
  a Company License é para *"collaborations and companies of 4+ people"*, com dois planos:
  **Automators** `$0.01/render, mínimo $100/mês` e **Creators** `$25/mês por seat`.
- **Como reconferir:** https://remotion.pro/license e
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/LICENSE.md`
- **O que quebra se divergir:** o gate jurídico do programa inteiro. Se este projeto for de uma
  entidade com 4+ pessoas, **todo** card que renderiza com Remotion carrega custo recorrente.
  Grupo Fleury é 4+ pessoas — ver PERGUNTA-DONO.
- **Fontes:**
  - https://api.github.com/repos/remotion-dev/template-code-hike — `license: null` (primária)
  - `LICENSE.md` do monorepo Remotion — limiar de 3 pessoas, Free vs Company (primária)
  - https://remotion.pro/license — "4+ people", preços (primária, domínio distinto)

### R09-05 / R09-06 — Code Hike 1.x, pacote e licença
- **Verdade operacional:** o pacote é `codehike` (sem escopo, sem hífen). O anúncio 1.0 nomeia
  `codehike` e `codehike/code`. O `latest` no registry em 2026-08-10 é **1.1.0**; o template Remotion
  pina **1.0.4**. Os subpaths publicados são `.`, `./mdx`, `./blocks`, `./code`,
  `./utils/token-transitions`, `./utils/static-fallback`, `./utils/selection`. Dependências:
  `@code-hike/lighter 1.0.1`, `diff ^5.1.0`, `estree-util-visit ^2.0.0`, `mdast-util-mdx-jsx ^3.0.0`,
  `unist-util-visit ^5.0.0`. Sem `peerDependencies` declaradas. O pacote antigo `@code-hike/mdx` é a
  linha 0.x — **não** é a v1.
- **Como reconferir:** `npm view codehike version license exports` e
  `curl -s https://registry.npmjs.org/codehike/latest | jq '{version,license,exports}'`
- **O que quebra se divergir:** o lockfile do worktree de código; qualquer import de
  `codehike/utils/token-transitions` (subpath que só existe na v1).
- **Fontes:**
  - https://registry.npmjs.org/codehike/latest — `1.1.0`, `MIT` (primária)
  - https://codehike.org/blog/v1 — anuncia 1.0 estável, nomeia `codehike` e `codehike/code` (primária)
  - `packages/codehike/package.json` em `code-hike/codehike` — exports map (primária)
  - https://api.github.com/repos/code-hike/codehike — `spdx_id: MIT`, branch default `next`, push 2026-03-17, 5.370 stars (primária)
- **Rechecar licença até:** 2026-11-10 (placar 2-0: npm + GitHub são as duas leituras do mesmo repo).

### R09-07 — MDX é o pipeline, não o requisito do highlight
- **Verdade operacional:** o blog v1 diz *"Code Hike depends on React and MDX, so any framework that
  supports those should work"* — isso vale para o fluxo markdown→componentes. Mas a doc de conceitos
  diz *"Both the `highlight` function and the `Pre` component are optional"*, e o template Remotion
  prova o caminho sem MDX: `src/calculate-metadata/process-snippet.ts` importa `highlight` de
  `codehike/code` e alimenta com arquivos `.tsx`/`.swift` lidos do `public/`. A árvore do repo
  (`README.md`, `src/*.tsx`, `public/code*.tsx`) **não contém nenhum `.mdx`**.
- **Fechamento parcial explícito:** "Code Hike exige MDX" é verdade para o pipeline de conteúdo
  markdown e **falso** para uso de `highlight()`/`Pre` como biblioteca headless.
- **Como reconferir:** `curl -s https://api.github.com/repos/remotion-dev/template-code-hike/git/trees/main?recursive=1 | jq -r '.tree[].path' | grep -i mdx`
  (esperado: vazio)
- **O que quebra se divergir:** o card "não introduzir MDX no pipeline" — se `highlight()` passar a
  exigir contexto MDX, o gerador de vídeo precisa de um passo de compilação MDX no meio.
- **Fontes:**
  - https://codehike.org/blog/v1 e https://codehike.org/docs/concepts/code (mesmo domínio = 1 fonte, primária)
  - árvore + `process-snippet.ts` de `remotion-dev/template-code-hike` (primária)
  - exports map de `code-hike/codehike` separando `./code` de `./mdx` (primária)

### R09-08 / R09-09 — O motor é lighter, e a licença dele está em disputa
- **Verdade operacional:** `codehike` depende de `@code-hike/lighter`; o npm descreve o pacote como
  *"Code Hike's syntax highlighter"* e ele depende de `tm-grammars ^1.22.0` e `ansi-sequence-parser
  1.1.1`. Ou seja: **Code Hike e Shiki compartilham a família de gramáticas TextMate, mas não o
  runtime.** Não misture temas assumindo compatibilidade 1:1.
- **A disputa:** `registry.npmjs.org/@code-hike/lighter/latest` declara `license: MIT`; a API do GitHub
  para `code-hike/lighter` retorna licença ausente. O repo está parado desde **2024-12-31**.
  As duas leituras: (a) o campo do package.json é a licença efetiva do artefato publicado;
  (b) sem `LICENSE` no repo, um revisor jurídico pode recusar. O que separa: alguém precisa abrir o
  tarball publicado e procurar o arquivo de licença dentro dele.
- **Como reconferir:**
  `npm pack @code-hike/lighter && tar -tzf code-hike-lighter-*.tgz | grep -i licen`
- **O que quebra se divergir:** o gate de compliance de dependências; se lighter for "sem licença", a
  cadeia inteira do Code Hike fica contaminada e a alternativa é Shiki.
- **Fontes:**
  - https://registry.npmjs.org/@code-hike/lighter/latest — `1.0.3`, `MIT`, deps (primária)
  - https://api.github.com/repos/code-hike/lighter — descrição, sem licença, push 2024-12-31 (primária)

### R09-10 — `@remotion/code` não existe (REFUTADO)
- **Verdade operacional:** duas evidências positivas de ausência, não "não achei":
  (1) `https://registry.npmjs.org/@remotion/code` responde **HTTP 404**;
  (2) a listagem **completa** de `packages/` do monorepo `remotion-dev/remotion` tem 120+ diretórios
  (`animation-utils`, `captions`, `fonts`, `google-fonts`, `layout-utils`, `media`, `paths`,
  `rough-notation`, `rounded-text-box`, `shapes`, `skia`, `transitions`, `webcodecs`, …) e **não tem
  `code`**.
- **Como reconferir:**
  `curl -s -o /dev/null -w '%{http_code}\n' https://registry.npmjs.org/@remotion/code` → esperado `404`
  `curl -s https://api.github.com/repos/remotion-dev/remotion/contents/packages | jq -r '.[].name' | grep -x code`
- **O que quebra se divergir:** se um dia existir, o card de "camada de código" muda de "montar em
  cima do template Code Hike" para "usar o pacote oficial" — e a licença muda junto.
- **Fontes:**
  - https://registry.npmjs.org/@remotion/code — 404 (primária)
  - https://api.github.com/repos/remotion-dev/remotion/contents/packages — listagem completa (primária)

### R09-11 — Não há doc oficial de "animated code"
- **Verdade operacional:** `packages/docs/docs` não tem entrada `code`, `code-hike`, `syntax` nem
  `animated-code`; uma busca restrita a `remotion.dev` devolve o template e páginas genéricas
  (`interpolate`, `animating-properties`, `transitioning`). O que o Remotion documenta sobre "código"
  na doc é `ts twoslash` **nos snippets da própria documentação**, não animação de código em vídeo.
- **Como reconferir:**
  `curl -s https://api.github.com/repos/remotion-dev/remotion/contents/packages/docs/docs | jq -r '.[].name' | grep -iE 'code|syntax'`
- **O que quebra se divergir:** o card de "escrever nossa própria receita de animação de código" perde
  justificativa — se houver doc oficial, seguimos ela.
- **Fontes:**
  - https://api.github.com/repos/remotion-dev/remotion/contents/packages/docs/docs — listagem (primária)
  - busca `site:remotion.dev` (secundária de método, primária de conteúdo: só retorna o template)
- **Ressalva honesta:** a listagem da API veio truncada na leitura. Placar 2-0, rótulo PROVÁVEL, não
  CONFIRMADO. Rechecar rodando o comando acima localmente.

### R09-12 — `@remotion/layout-utils`: a API real
- **Verdade operacional (assinaturas conferidas na doc oficial):**
  - `measureText({text, fontFamily, fontSize, fontWeight, letterSpacing, fontVariantNumeric?, textTransform?, validateFontIsLoaded?, additionalStyles?})` → `{height, width}`.
    `fontVariantNumeric` desde v4.0.57; `validateFontIsLoaded` desde v4.0.136;
    `textTransform` e `additionalStyles` desde v4.0.140.
  - `fitText({text, withinWidth, fontFamily, fontWeight?, letterSpacing?, fontVariantNumeric?, textTransform?, validateFontIsLoaded?, additionalStyles?})` → `{fontSize}` — **desde v4.0.88**.
  - `fillTextBox({maxBoxWidth, maxLines})` → objeto com `.add({text, fontFamily, fontSize, ...})` que
    devolve `{exceedsBox, newLine}` — **desde v4.0.57**.
  - `fitTextOnNLines({text, maxBoxWidth, maxLines, fontFamily, maxFontSize?, ...})` → `{fontSize, lines: string[]}` — **desde v4.0.313**.
  - Pacote MIT, `4.0.507`, **zero dependências de produção**.
- **Como reconferir:** `npm view @remotion/layout-utils version license` e
  `curl -s https://api.github.com/repos/remotion-dev/remotion/contents/packages/layout-utils/src/layouts | jq -r '.[].name'`
  (esperado: `fill-text-box.ts`, `fit-text-on-n-lines.ts`, `fit-text.ts`, `measure-text.ts`)
- **O que quebra se divergir:** o card "garantir que o código não estoura o quadro". A resposta certa
  aqui é `fitTextOnNLines` (retorna as linhas já quebradas) ou `fillTextBox` (detecta overflow), **não**
  `fitText` — `fitText` só resolve uma linha.
- **Fontes:**
  - https://www.remotion.dev/docs/layout-utils/fit-text, `/measure-text`, `/fill-text-box`, `/fit-text-on-n-lines`, `/best-practices` (mesmo domínio = 1 fonte, primária)
  - listagem de `packages/layout-utils/src/layouts` no GitHub (primária)
  - https://registry.npmjs.org/@remotion/layout-utils/latest — versão e licença (primária)
- **Corroboração de fornecedor: 1.**

### R09-13 / R09-14 — Como `measureText` mede, e o falso verde da fonte
- **Verdade operacional:** o código cria um `span`, aplica `fontFamily`, `fontSize`, `fontWeight`,
  `letterSpacing`, `fontVariantNumeric`, `textTransform` + `additionalStyles`, mais
  `display:'inline-block'`, `position:'absolute'`, `top:'-10000px'`, `whiteSpace:'pre'`, anexa ao
  `document.body`, lê `getBoundingClientRect()` e remove. Cache em `Map` com chave
  `${text}-${fontFamily}-${fontWeight}-${fontSize}-...`. Consequências diretas:
  1. **Precisa de DOM** — não roda em Node puro; roda no browser (Studio e aba de render).
  2. **`whiteSpace:'pre'`** significa que ele mede **uma linha**, preservando espaços — exatamente o que
     código precisa, e por isso multi-linha exige medir linha a linha.
  3. `validateFontIsLoaded` mede de novo com `fontFamily: null`; se as medidas baterem, as fontes
     computadas diferirem e `new Set(text).size > 4`, ele **lança**. Default vira `true` no Remotion 5.0.
  4. A doc é explícita: *"Only call measureText() after the font is loaded"* e *"ensure that all font
     properties match the ones you are going to use"*; `padding`/`border` no elemento real distorcem a
     medida (use `outline`).
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/layout-utils/src/layouts/measure-text.ts`
- **O que quebra se divergir:** o gate "código não estoura o quadro" passa a mentir. Se `measureText`
  mudar para canvas, a medida deixa de refletir `letter-spacing`/`text-transform` do CSS real e o
  layout do snippet desalinha.
- **Fontes:**
  - `packages/layout-utils/src/layouts/measure-text.ts` (primária)
  - https://www.remotion.dev/docs/layout-utils/measure-text + `/best-practices` (primária)
- **Corroboração de fornecedor: 1.**

### R09-15 — Onde o highlight roda no template (isto é o coração do determinismo)
- **Verdade operacional:** `src/calculate-metadata/calculate-metadata.tsx` exporta
  `calculateMetadata: CalculateMetadataFunction<...>`, chama
  `await processSnippet(snippet, props.theme)` em laço e usa `measureText` de
  `@remotion/layout-utils` para calcular largura por caractere. `src/calculate-metadata/get-files.ts`
  usa `getStaticFiles()` de `@remotion/studio` e `fetch(file.src)` para ler os arquivos de `public/`.
  A doc do Remotion diz que `calculateMetadata()` *"is called a single time, independently from the
  concurrency of the render"* e *"runs in a separate tab, as part of the render process calling
  selectComposition()"*, disponível desde **v4.0.0**, e pode ser `async`.
- **Consequência que vira restrição de card:** o highlight **não** roda por frame. Roda uma vez, na aba
  de seleção de composição, e o resultado (tokens já coloridos + medidas) viaja como props
  JSON-serializáveis para todas as abas de render. É por isso que o template não flicka.
- **Ressalva importante:** `getStaticFiles()` vem de `@remotion/studio`. Confirmar que ele funciona em
  `remotion render` headless (fora do Studio) é LEDGER-SEED — não achei declaração primária.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/src/calculate-metadata/calculate-metadata.tsx`
- **O que quebra se divergir:** se `calculateMetadata` passar a rodar por thread, o custo de highlight
  multiplica pela concorrência e o `data-fetching` doc do Remotion já avisa: *"the data returned by the
  API must be the same on all threads, otherwise flickering may occur"*.
- **Fontes:**
  - https://www.remotion.dev/docs/calculate-metadata e https://www.remotion.dev/docs/data-fetching (mesmo domínio = 1 fonte, primária)
  - `calculate-metadata.tsx`, `process-snippet.ts`, `get-files.ts` do template (primária)
- **Corroboração de fornecedor: 1.**

### R09-16 — A transição é dirigida por frame, não por WAAPI
- **Verdade operacional:** `CodeTransition.tsx` importa `AnnotationHandler`, `HighlightedCode`, `Pre` de
  `codehike/code` e `calculateTransitions`, `getStartingSnapshot`, `TokenTransitionsSnapshot` de
  `codehike/utils/token-transitions`. Em `useLayoutEffect` ele tira o snapshot do estado antigo,
  compara com o DOM novo, e depois **aplica estilos manualmente** via `applyStyle()` usando
  `interpolate(frame, [delay, delay + duration], [0, 1])` com easing bezier. Não chama
  `element.animate()`.
- **Por que isso importa mais que tudo neste cluster:** a doc do próprio Code Hike
  (`/docs/code/token-transitions`) descreve o uso padrão via `getSnapshotBeforeUpdate()` +
  `componentDidUpdate()` + **Web Animations API**. WAAPI é dirigido por relógio de parede; num render
  frame-a-frame com seek, isso não é determinístico. O template Remotion **reescreveu essa parte**.
  Copiar o exemplo da doc do Code Hike direto para dentro de uma composição Remotion é o erro clássico.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/src/CodeTransition.tsx | grep -nE 'animate\(|useCurrentFrame|interpolate'`
- **O que quebra se divergir:** o gate de determinismo (render duas vezes → hash igual). Se alguém
  trocar `applyStyle` por `element.animate()`, os frames viram função do tempo real da máquina.
- **Fontes:**
  - `src/CodeTransition.tsx` do template (primária)
  - https://codehike.org/docs/code/token-transitions — descreve o caminho WAAPI (primária)

### R09-17 — `twoslash-cdn` é rede no meio do pipeline
- **Verdade operacional:** `process-snippet.ts` importa `createTwoslashFromCDN` de `twoslash-cdn` e
  configura `CompilerOptions`/`JsxEmit`/`ModuleKind`/`ScriptTarget` do TypeScript para extrair queries
  `^?` e erros de compilação, que viram anotações `Callout`/`Error`. A doc do twoslash-cdn diz:
  *"During `.run()`, it will automatically fetch types from CDN for used imports in the code"* e
  *"By default, the fetched files are stored in a virtual file system in memory... If you want to keep
  them persistent, you can pass a `storage` option"* (via `unstorage`).
- **Consequência:** o template **como vem** não roda offline nem é determinístico entre execuções se o
  snippet importar de pacotes externos (o CDN pode servir uma versão de types diferente amanhã).
- **Como reconferir:** rodar o render com a rede desligada e observar se `processSnippet` falha;
  https://twoslash.netlify.app/packages/cdn para a opção `storage`.
- **O que quebra se divergir:** o card "render 100% local". A saída é: (a) desligar twoslash, ou
  (b) plugar `storage` persistente e versionar o cache como fixture.
- **Fontes:**
  - https://twoslash.netlify.app/packages/cdn — doc oficial do twoslash (primária)
  - `src/calculate-metadata/process-snippet.ts` do template (primária)
  - https://github.com/antfu/twoslash-cdn — "Auto-Type-Acquisition from CDN" (primária, mesmo autor)

### R09-18 / R09-19 — Shiki: versão, licença e o que a doc realmente recomenda
- **Verdade operacional:** `shiki` está em **4.4.3**, MIT (Pine Wu 2021, Anthony Fu 2023–). Depende de
  `@shikijs/core`, `@shikijs/engine-javascript`, `@shikijs/engine-oniguruma`, `@shikijs/langs`,
  `@shikijs/themes`, `@shikijs/types`, `@shikijs/vscode-textmate`. APIs documentadas:
  `codeToHtml(code, {lang, theme})`, `codeToTokens(code, {lang, theme})`, `codeToHast(...)`,
  `createHighlighter({themes, langs})`, `createHighlighterCore(...)`, `getSingletonHighlighter`.
  Bundles: `shiki/bundle/full` = 6.4 MB min / 1.2 MB gzip; `shiki/bundle/web` = 3.8 MB / 695 KB.
  Temas redistribuídos via `tm-themes`. O projeto se declara *"Portable & agnostic. Does not rely on
  Node.js APIs or the filesystem, works in any modern JavaScript runtime."*
- **Fechamento parcial explícito:** a página `best-performance` recomenda **cachear o highlighter**,
  **bundle fine-grained**, **engine JavaScript RegExp** em vez de Oniguruma WASM na web, e **Workers**.
  Ela **não** diz "pré-compute em build". A recomendação "pré-computar tokens em build" é *nossa
  inferência a partir do padrão do template Code Hike* (R09-15), não uma afirmação do Shiki. Isso
  vira LEDGER-SEED, não claim.
- **Como reconferir:** `npm view shiki version license dependencies` e https://shiki.style/guide/bundles
- **O que quebra se divergir:** o orçamento de bundle da composição e o tempo de warm-up da aba de
  render. Se o full bundle entrar no bundle da composição, 1.2 MB gzip por aba × concorrência.
- **Fontes:**
  - https://shiki.style/guide/, `/guide/install`, `/guide/bundles`, `/guide/best-performance` (mesmo domínio = 1 fonte, primária)
  - `packages/shiki/package.json` e `LICENSE` em `shikijs/shiki` (primária)
  - https://registry.npmjs.org/shiki/latest — `4.4.3`, MIT (primária)

### R09-20 / R09-21 / R09-22 — magic-move: existe, mudou de nome, e não é frame-driven
- **Verdade operacional:**
  - O pacote atual é **`@shikijs/magic-move` 4.4.3, MIT**, versionado junto com o Shiki, dentro de
    `shikijs/shiki` em `packages/magic-move`. Exports: `.`, `./core`, `./renderer`, `./types`,
    `./vue`, `./react`, `./solid`, `./svelte`, `./style.css`. Peers **opcionais**: `shiki ^4.0.0`,
    `react ^18.2.0 || ^19.0.0`, `vue ^3.4.0`, `svelte ^5.0.0-0`, `solid-js ^1.9.1`.
  - O antigo `shiki-magic-move` (1.4.0) está marcado no registry como deprecated:
    *"shiki-magic-move is now @shikijs/magic-move, please migrate by renaming the package"*, e o repo
    `shikijs/shiki-magic-move` foi **arquivado em 2026-06-03**.
  - API: `ShikiMagicMove` (precisa de instância de highlighter), `ShikiMagicMovePrecompiled` (aceita
    tokens já compilados, **sem** dependência do Shiki em runtime), `ShikiMagicMoveRenderer`,
    `createMagicMoveMachine`, `codeToKeyedTokens`. CSS obrigatório: `@shikijs/magic-move/style.css`.
  - **O renderer usa CSS transitions**: seta `--smm-duration`, manipula `CLASS_MOVE`,
    `el.style.transitionDuration = el.style.transitionDelay = '0ms'`, e aguarda com
    `Promise.allSettled(el.getAnimations().map(a => a.finished))`. As opções são `duration`,
    `delayMove`, `easing` — **não há parâmetro de progresso/tempo manual**.
- **Fechamento parcial explícito:** *que* o renderer usa CSS transitions e não expõe progresso é
  leitura direta do código (1 fonte primária → NÃO VERIFICADO pelo placar). *Que isso o torna
  inadequado a Remotion sem wrapper* é dedução minha e vira LEDGER-SEED, não claim.
- **O ângulo aproveitável:** `ShikiMagicMovePrecompiled` + `codeToKeyedTokens` são exatamente a peça
  "tokens pré-computados" que serve ao nosso pipeline — a máquina de estados (`createMagicMoveMachine`)
  é separada do renderer. Um renderer nosso, dirigido por `useCurrentFrame()`, é viável em cima de
  `./core`.
- **Como reconferir:**
  `npm view @shikijs/magic-move version license exports` e
  `curl -s https://raw.githubusercontent.com/shikijs/shiki/main/packages/magic-move/src/renderer.ts | grep -nE "getAnimations|transitionDuration|--smm"`
- **O que quebra se divergir:** se o renderer ganhar controle de progresso, o card "escrever renderer
  próprio" some e vira "usar o renderer oficial com progresso ligado ao frame".
- **Fontes:**
  - https://registry.npmjs.org/@shikijs/magic-move/latest e https://registry.npmjs.org/shiki-magic-move/latest — versões, licenças, campo `deprecated` (primária)
  - https://github.com/shikijs/shiki-magic-move — README com aviso de arquivamento em 2026-06-03 e a lista de APIs (primária)
  - `packages/magic-move/package.json` e `src/renderer.ts` em `shikijs/shiki` (primária)
  - https://sli.dev/features/shiki-magic-move — Slidev usa a lib via ` ```md magic-move `, desde v0.48.0 (primária de outro fornecedor)

### R09-23 — Alternativas e suas licenças
- **Verdade operacional (todas via API do GitHub, 2026-08-10):**
  | Projeto | Licença | Último push | Nota |
  |---|---|---|---|
  | `PrismJS/prism` | MIT | 2026-06-29 | branch default é **`v2`**, não `main`/`master` — a v2 é a linha ativa |
  | `highlightjs/highlight.js` | **BSD-3-Clause** | 2026-08-09 | única não-MIT do grupo; auto-detecção de linguagem |
  | `wooorm/starry-night` | MIT | 2026-06-08 | replica o highlight do GitHub; conhecido por ser pesado |
  | `tree-sitter/tree-sitter` | MIT | 2026-08-10 | parser incremental, **não** é highlighter pronto |
  | `rough-stuff/rough-notation` | MIT | **2024-03-18** | upstream parado; ver R09-24 |
- **Como reconferir:** `for r in PrismJS/prism highlightjs/highlight.js wooorm/starry-night tree-sitter/tree-sitter rough-stuff/rough-notation; do curl -s https://api.github.com/repos/$r | jq -r '"\(.full_name) \(.license.spdx_id) \(.pushed_at)"'; done`
- **O que quebra se divergir:** o inventário de licenças do compliance. BSD-3-Clause exige cláusula de
  não-endosso no aviso — se highlight.js entrar, o `NOTICE` do projeto muda.
- **Fontes:** as cinco chamadas de `api.github.com` acima (primária; contam como 1 domínio — placar 2-0
  contando `registry.npmjs.org` para o `rough-notation`).
- **Rechecar até:** 2026-11-10.

### R09-24 — `@remotion/rough-notation` é a resposta oficial para anotação, e é determinística
- **Verdade operacional:** existe pacote oficial `@remotion/rough-notation` **4.0.507, MIT**,
  disponível desde **v4.0.490**, descrito como *"Animated marker highlights, circles, boxes, underlines
  and other hand-drawn text annotations for Remotion videos."* Depende de `roughjs 4.6.6` e
  `@remotion/paths`. Componentes documentados: `box.mdx`, `bracket.mdx`, `circle.mdx`,
  `crossed-off.mdx`, `highlight.mdx`, `strike-through.mdx`, `underline.mdx`. Props que importam:
  `progress` (*"Controls how much of the annotation is drawn. Use a value between 0 and 1"*) e
  `seed` (*"Controls the generated shape. Change the integer on every frame to animate the shape."*,
  default `1`). `<Highlight>` aceita `iterations` (default 2), `padding`, `rtl`.
- **Por que isso resolve um problema real:** a `rough-notation` original anima sozinha (`show()`), com
  relógio próprio, e o `roughjs` usa aleatoriedade — os dois quebram determinismo. A versão do Remotion
  expõe `progress` e `seed`, então o frame determina a forma **e** o quanto está desenhado.
- **Como reconferir:** `npm view @remotion/rough-notation version license` e
  https://www.remotion.dev/docs/rough-notation/highlight
- **O que quebra se divergir:** o card "destacar trechos de código com anotação"; se `progress`/`seed`
  sumirem, volta a ser não-determinístico e precisa de wrapper.
- **Fontes:**
  - https://registry.npmjs.org/@remotion/rough-notation/latest — versão, MIT, deps (primária)
  - `packages/docs/docs/rough-notation/index.mdx` — `progress`, `seed`, `AvailableFrom 4.0.490` (primária)
  - https://www.remotion.dev/docs/rough-notation/highlight — props de `<Highlight>` (primária)
- **Corroboração de fornecedor: 1.**

### R09-25 — Fontes de código: licença OK, entrega pela rede NÃO
- **Verdade operacional, em duas metades com placares diferentes:**
  - **(3-0) CONFIRMADO — licença:** JetBrains Mono é `OFL-1.1` (repo oficial `JetBrains/JetBrainsMono`,
    spdx `OFL-1.1`); Fira Code é *"licensed under the SIL Open Font License, Version 1.1"*
    (`LICENSE` do repo `tonsky/FiraCode`). Ambas embutíveis sem custo, com o aviso da OFL.
  - **(2-0) PROVÁVEL — entrega:** `@remotion/google-fonts` tem `JetBrainsMono.ts` (8 pesos, normal +
    italic, 6 subsets) e `FiraCode.ts` (pesos 300–700), e **todas as URLs apontam para
    `fonts.gstatic.com`**. A doc de `loadFont()` do google-fonts devolve um objeto com `fonts`
    contendo URLs `https://fonts.gstatic.com/...` e alerta sobre >20 requisições de rede. Ou seja:
    usar `@remotion/google-fonts` = baixar fonte da rede no render.
  - **(2-0) PROVÁVEL — alternativa determinística:** `@remotion/fonts` expõe
    `loadFont({family, url, format?, weight?, style?, stretch?, display?, featureSettings?, ascentOverride?, descentOverride?, lineGapOverride?, unicodeRange?})` → `Promise`,
    **disponível desde v4.0.165**, *"Load a local font for use in Remotion. Automatically blocks the
    render until the font is ready"*, integrado a `delayRender`. Combinado com `staticFile()` e o
    `.woff2` versionado em `public/`, não há rede.
  - **Contraponto honesto:** a página `/docs/fonts` do Remotion **não** desaconselha CDN — ela lista
    Google Fonts via CDN como abordagem padrão e diz que *"From version 2.2 on, Remotion will
    automatically wait until the fonts are loaded"*. A restrição "sem rede" é **nossa**, motivada por
    render local e reprodutibilidade, não uma recomendação do fornecedor. Não escreva no card que "o
    Remotion recomenda embutir a fonte" — ele não recomenda.
  - **`featureSettings`** existe em `loadFont()` de `@remotion/fonts`; é o gancho para ligar/desligar
    ligaduras (`calt`/`liga`). Que valor exato usar e como isso interage com `measureText` **não foi
    verificado** — ver LEDGER-SEED LS-06.
- **Como reconferir:**
  `curl -s https://api.github.com/repos/JetBrains/JetBrainsMono | jq .license` ;
  `curl -s https://raw.githubusercontent.com/tonsky/FiraCode/master/LICENSE | head -3` ;
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/google-fonts/src/JetBrainsMono.ts | grep -c gstatic`
- **O que quebra se divergir:** o gate "render offline"; a fixture de fonte em `public/`; e o card
  "medir largura do código" (fonte não carregada → `validateFontIsLoaded` lança, ou pior, mede o
  fallback e o layout mente).
- **Fontes:**
  - https://api.github.com/repos/JetBrains/JetBrainsMono — `OFL-1.1` (primária)
  - https://raw.githubusercontent.com/tonsky/FiraCode/master/LICENSE — SIL OFL 1.1 (primária)
  - `packages/google-fonts/src/JetBrainsMono.ts` e `FiraCode.ts` — URLs gstatic (primária)
  - https://www.remotion.dev/docs/fonts-api/load-font, `/docs/google-fonts/load-font`, `/docs/fonts` (mesmo domínio = 1 fonte, primária)

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| Existe um pacote oficial `@remotion/code` para exibir/animar código | **REFUTADO** | `registry.npmjs.org/@remotion/code` → HTTP 404, e a listagem completa de `packages/` no monorepo (120+ diretórios) não tem `code`. O caminho oficial é o template `code-hike`. | https://api.github.com/repos/remotion-dev/remotion/contents/packages |
| O Remotion tem documentação oficial de "animated code" / "code transitions" | **REFUTADO (parcial)** | `packages/docs/docs` não tem entrada `code`/`code-hike`/`syntax`/`animated-code`. O que existe é a página de **template** (`/templates/code-hike`), não doc de API. Rótulo PROVÁVEL porque a listagem lida veio truncada. | https://api.github.com/repos/remotion-dev/remotion/contents/packages/docs/docs |
| Code Hike usa Shiki por baixo | **REFUTADO** | Usa `@code-hike/lighter` (repo `code-hike/lighter`, *"The syntax highlighter used by Code Hike"*), que depende de `tm-grammars`. Compartilha a família TextMate com o Shiki, não o runtime. Temas não são intercambiáveis por suposição. | https://registry.npmjs.org/@code-hike/lighter/latest |
| O template Code Hike do Remotion é open source permissivo (MIT) | **REFUTADO** | GitHub retorna `license: null`; README diz *"for some entities a company license is needed"*; a licença do Remotion é dual, Free só até 3 pessoas, Company License a partir de 4 (`$0.01/render, mín. $100/mês` ou `$25/mês por seat`). | https://remotion.pro/license |
| `shiki-magic-move` é o pacote a instalar | **REFUTADO** | `shiki-magic-move@1.4.0` está deprecated (*"is now @shikijs/magic-move, please migrate by renaming the package"*) e o repo foi arquivado em 2026-06-03. O pacote vivo é `@shikijs/magic-move@4.4.3`, versionado junto com o Shiki. | https://registry.npmjs.org/shiki-magic-move/latest |
| Code Hike exige MDX, logo não serve para Remotion | **REFUTADO (metade)** | MDX é exigido pelo pipeline markdown→componentes; `highlight()` e `Pre` de `codehike/code` são explicitamente opcionais e o template Remotion não tem nenhum `.mdx`. A outra metade (Code Hike **depende** de React+MDX como projeto) é verdadeira. | https://codehike.org/blog/v1 |
| Dá para copiar o exemplo de token transitions da doc do Code Hike direto para o Remotion | **REFUTADO** | O exemplo da doc usa `componentDidUpdate` + **Web Animations API** (relógio de parede). O template Remotion reescreveu isso: aplica estilo manualmente por frame com `useCurrentFrame()` + `interpolate()`. Copiar o exemplo quebra determinismo. | https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/src/CodeTransition.tsx |
| O template Code Hike roda 100% offline | **REFUTADO** | Ele usa `twoslash-cdn`, que *"will automatically fetch types from CDN for used imports"*, com cache só em memória por padrão. E `src/font.ts` carrega **Roboto Mono** via `@remotion/google-fonts/RobotoMono`, que resolve para `fonts.gstatic.com`. | https://twoslash.netlify.app/packages/cdn |
| `@remotion/google-fonts` embute a fonte no bundle | **REFUTADO** | Os módulos gerados (`JetBrainsMono.ts`, `FiraCode.ts`) contêm URLs `https://fonts.gstatic.com/...`; a doc de `loadFont()` devolve essas URLs e alerta sobre >20 requisições de rede. Para offline use `@remotion/fonts` + `staticFile()`. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/google-fonts/src/JetBrainsMono.ts |
| O Remotion recomenda evitar CDN de fontes por determinismo | **REFUTADO** | `/docs/fonts` lista Google Fonts via CDN como abordagem padrão e não emite esse aviso. A restrição é **nossa**, por render local — não cite o fornecedor como se fosse dele. | https://www.remotion.dev/docs/fonts |
| `fitText()` resolve "o código não estoura o quadro" | **REFUTADO (metade)** | `fitText()` ajusta o `fontSize` para caber em **uma largura**, uma linha. Para bloco de código o par correto é `fitTextOnNLines()` (v4.0.313, devolve `{fontSize, lines[]}`) ou `fillTextBox()` (v4.0.57, devolve `{exceedsBox, newLine}`). | https://www.remotion.dev/docs/layout-utils/fit-text-on-n-lines |
| Rough Notation em vídeo é não-determinístico por causa do roughjs | **REFUTADO** | Verdade para a lib original (`rough-stuff/rough-notation`, parada desde 2024-03-18, animação por `show()`). O pacote oficial `@remotion/rough-notation` (desde v4.0.490) expõe `progress` (0–1) e `seed` (default 1), tornando forma e desenho função do frame. | https://registry.npmjs.org/@remotion/rough-notation/latest |
| A lista de templates do `create-video` está na página de CLI da doc | **REFUTADO** | `/docs/cli/create-video` renderiza `<CreateVideoTemplateFlags />`; o HTML servido não contém os nomes. A lista literal só existe em `packages/create-video/src/templates.ts`. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/create-video/src/templates.ts |

---

## 4. Armadilhas (falso verde deste domínio)

- **O snippet aparece bonito no Studio → não é prova de que o render fecha.** O Studio tem o
  `@remotion/studio` disponível e a rede quente; o render headless pode não ter `getStaticFiles()` no
  mesmo contexto e o CDN do twoslash pode estar frio. *Fica vermelho se sumir:* o gate
  `render-offline` (render com rede desligada) e o gate `render-headless` (render sem Studio).
- **A fonte "carregou" porque o texto apareceu → pode ser fallback.** O Chrome renderiza com fallback
  silenciosamente. `measureText` mede o fallback e devolve número plausível; o layout fecha e o vídeo
  sai errado. *Fica vermelho se sumir:* `validateFontIsLoaded: true` explícito em toda chamada de
  medição (e o default `true` do Remotion 5.0 não te salva enquanto você estiver no 4.x).
- **A animação de transição roda lisa no navegador → pode ser WAAPI/CSS transition.** Qualquer coisa
  dirigida por relógio (`element.animate()`, `transition-duration`, `getAnimations()`) parece perfeita
  em playback e vira lixo em render frame-a-frame com seek. *Fica vermelho se sumir:* o gate
  "renderizar duas vezes e comparar hash dos frames".
- **`measureText` devolveu um número → não significa que bate com o DOM real.** Ele mede um `span` com
  `whiteSpace:'pre'` e **sem** `padding`/`border`. Se o elemento real tem padding, borda, ou quebra de
  linha, a medida é de outra coisa. *Fica vermelho se sumir:* uma fixture de snippet longo que
  propositalmente estoura, com asserção de `exceedsBox === true`.
- **O highlight é rápido → você mediu com o highlighter já quente.** Shiki e lighter carregam
  gramáticas e temas sob demanda; a primeira chamada paga tudo. Medir a segunda chamada e reportar como
  custo é falso verde. *Fica vermelho se sumir:* medição de cold start no gate de performance.
- **`npm i` passou → a licença pode não ter passado.** `@code-hike/lighter` declara MIT no npm e não tem
  licença detectável no repo; o template Code Hike não tem SPDX nenhum. Instalador não é jurídico.
  *Fica vermelho se sumir:* um `license-check` no CI que falha em `UNLICENSED`/`null`.
- **"Funciona com a versão mais nova" → o template pina versões antigas.** O template usa
  `codehike 1.0.4` e `@code-hike/lighter 1.0.3`, enquanto o npm serve `codehike 1.1.0` (que depende de
  `lighter 1.0.1`). Subir versão sem testar a transição de tokens é troca de motor no meio da estrada.
  *Fica vermelho se sumir:* lockfile commitado + um snapshot de frame por versão.
- **A transição "só" precisa de tokens iguais → chave de token importa mais que cor.** `magic-move`
  depende de `codeToKeyedTokens`; se a chave mudar (por mudança de tema, de gramática ou de versão), o
  diff vira "tudo saiu, tudo entrou" e a animação vira flash. *Fica vermelho se sumir:* um teste de
  transição entre dois snippets quase idênticos, asserindo N tokens movidos > 0.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-01 | `getStaticFiles()` de `@remotion/studio` funciona dentro de `calculateMetadata` durante `npx remotion render` headless, sem o Studio no ar? | Assumir que **não** é confiável; ler os snippets do disco via um `props` gerado antes do render, não via Studio API | `npx remotion render Main out.mp4` num clone limpo do `template-code-hike` com o Studio fechado; observar se `get-files.ts` devolve array vazio | Card "ler snippets do `public/`" muda de Studio API para input-props/JSON gerado pelo agente |
| LS-02 | Quanto custa (ms, cold start) `highlight()` do lighter para um snippet de ~60 linhas, dentro da aba de `calculateMetadata`? | Orçar 300–800 ms de cold start e cachear o resultado em disco por hash do snippet | instrumentar `process-snippet.ts` com `performance.now()` e rodar `npx remotion render` duas vezes | Orçamento de tempo do pipeline; se passar de ~2 s, o highlight sai do render e vira etapa de build |
| LS-03 | Shiki pré-computado em Node (build) produz tokens **idênticos** aos do lighter/Code Hike para o mesmo tema? | Assumir que **não**; escolher um motor só e não misturar | rodar `codeToTokens` do Shiki e `highlight()` do lighter sobre o mesmo arquivo com tema equivalente e diffar o JSON | Se divergir, o card "trocar lighter por Shiki" deixa de ser troca barata e vira reescrita do renderer de tokens |
| LS-04 | `@shikijs/magic-move` `./core` (`createMagicMoveMachine` + `codeToKeyedTokens`) pode ser dirigido por `useCurrentFrame()` com um renderer nosso, sem `./renderer` nem `style.css`? | Assumir que **sim** — a máquina de estados é separada do renderer — mas provar com spike de 1 composição | protótipo de 30 linhas importando só `@shikijs/magic-move/core` num `<Composition>` e conferindo que nada chama `getAnimations()` | Se não der, a única rota de transição animada é o `CodeTransition.tsx` do Code Hike, e o Shiki vira só highlighter estático |
| LS-05 | O render fecha com a rede **desligada** depois de remover `twoslash-cdn` e trocar `@remotion/google-fonts` por `@remotion/fonts` + `staticFile()`? | Sim; tratar como gate obrigatório do programa | desligar a interface de rede e rodar `npx remotion render`; qualquer `delayRender` timeout = falha | Gate `render-offline`, que é premissa de "roda LOCALMENTE" e de reprodutibilidade entre worktrees |
| LS-06 | Ligaduras (`calt`/`liga`) de JetBrains Mono / Fira Code alteram a largura medida por `measureText`, e `additionalStyles`/`featureSettings` propagam corretamente para a medição? | Assumir que **alteram**; desligar ligaduras no código do vídeo (`fontVariantLigatures: 'none'`) até provar o contrário | medir `"=>"` e `"= >"` com e sem `additionalStyles: {fontVariantLigatures:'none'}` e comparar `width` | Gate "código não estoura o quadro" e alinhamento de colunas/gutter de números de linha |
| LS-07 | Renderizar a mesma composição de código duas vezes produz frames byte-idênticos? | Sim, se e só se: sem WAAPI, sem rede, sem `Math.random` não semeado, fonte local | `npx remotion render ... out1.mp4 && npx remotion render ... out2.mp4 && cmp out1.mp4 out2.mp4` (ou hash por frame com `--sequence`) | Gate mestre de determinismo do programa; sem ele, agentes em worktrees paralelas não conseguem comparar saídas |
| LS-08 | O bundle da composição com Shiki fine-grained cabe no orçamento (qual o tamanho real com 5 linguagens e 1 tema)? | Assumir fine-grained obrigatório; nunca importar `shiki` ou `shiki/bundle/full` | `npx remotion bundle` e medir o output; comparar full vs fine-grained | Tempo de warm-up por aba de render × concorrência; e o card "escolher motor de highlight" |
| LS-09 | Qual a concorrência de abas que a máquina aguenta com uma composição de código (DOM pesado por token)? | Deixar o default do Remotion e medir antes de tunar | `npx remotion render --concurrency=N` para N em {1,2,4,8} e medir wall-clock e RSS | Orçamento de tempo do pipeline e o card de paralelização de render |
| LS-10 | O `seed` de `@remotion/rough-notation` produz a mesma forma entre execuções e entre máquinas? | Assumir sim dentro da mesma versão; pinar a versão | renderizar o mesmo frame com `seed=1` em duas execuções e comparar PNG | Card "anotar trecho de código"; se divergir, anotação rough sai do pipeline determinístico |
| LS-11 | `codehike 1.1.0` (npm latest) é drop-in sobre o `1.0.4` pinado no template? | Ficar em `1.0.4` (o que o template testa) até provar | `npm i codehike@1.1.0` no clone do template e renderizar o mesmo frame; comparar PNG | Lockfile e o snapshot de referência de cada card de animação de código |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| Esta entidade se qualifica para a Free License do Remotion (≤3 pessoas / non-profit / avaliação)? O e-mail da sessão é corporativo (`@grupofleury.com.br`). | É fato jurídico sobre a organização, não sobre o software. A licença fala em "entities", não em "quem roda o comando". | **Free:** segue como está. **Company:** custo recorrente (`$0.01/render, mín. $100/mês` para Automators, ou `$25/mês/seat` para Creators) entra no programa antes do primeiro card, e uma alternativa sem Remotion precisa ser avaliada. |
| A licença é "avaliação" (protótipo interno) ou uso de produção? | O próprio texto lista "evaluating the software" como caso de Free License — só o dono sabe a intenção. | **Avaliação:** o gate jurídico vira um card de "decidir antes de produção". **Produção:** o gate é bloqueante hoje. |
| Aceitamos `@code-hike/lighter` com licença ambígua (npm diz MIT, repo sem arquivo de licença, parado desde 2024-12-31)? | Apetite de risco jurídico e de manutenção. | **Aceita:** Code Hike segue como motor. **Não aceita:** troca para Shiki 4.x (MIT limpo, ativo) e o `CodeTransition.tsx` precisa ser reescrito sobre `@shikijs/magic-move/core`. |
| Twoslash (tipos e erros do TypeScript inline no vídeo) é requisito de produto ou enfeite? | É decisão de escopo do vídeo, não fato técnico. | **Requisito:** aceitamos rede no pipeline ou versionamos um cache `unstorage` como fixture (trabalho extra real). **Enfeite:** removemos `twoslash-cdn` e ganhamos offline de graça. |
| Fonte de código: JetBrains Mono, Fira Code ou outra — e ligaduras ligadas ou desligadas? | Escolha estética + acessibilidade; ambas são OFL-1.1, então não é decisão de licença. | Muda o `.woff2` versionado em `public/`, todas as medidas de `measureText`, e o snapshot de referência de todo card de código. Ligaduras ligadas exigem fechar LS-06 antes. |
| Aceitamos ficar amarrados ao template Code Hike (fork) ou queremos um renderer de código próprio sobre tokens pré-computados? | Trade-off de manutenção vs controle; depende do horizonte do projeto. | **Fork do template:** rápido, mas herda `codehike`, `lighter`, `twoslash-cdn` e a licença Remotion. **Renderer próprio:** ~1 arquivo (`CodeTransition`) + 1 função de tokens; ganha Shiki MIT e offline, custa um spike (LS-04). |
| Precisamos de tema claro **e** escuro, ou um só? | Requisito de produto. | Um tema = pré-computar 1 conjunto de tokens. Dois = dobra o custo de highlight e o tamanho das props serializadas de `calculateMetadata`. |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** o motor de highlight. Se o pipeline for desenhado com a fronteira certa —
  **uma função `getHighlightedTokens(source, lang, theme) → JSON serializável`, chamada dentro de
  `calculateMetadata()`** — trocar lighter (Code Hike) por Shiki 4.x custa **1 arquivo e 1 assinatura
  de função**. Se o `highlight()` for chamado espalhado dentro dos componentes de render, a troca vira
  reescrita. Custo de reversão desejado: **1 arquivo, ~40 linhas, 1 fixture de tokens**.
  Segundo ponto de troca barata: **fonte**. Um único módulo `src/font.ts` com `loadFont()` de
  `@remotion/fonts` + `staticFile()` — trocar JetBrains Mono por Fira Code deve custar **1 linha + 1
  arquivo em `public/`**.

- **Skills que devem carregar este conhecimento:**
  - a skill de **Remotion** (`remotion`, e as regras `fonts` / `layout` correlatas): precisa saber que
    `@remotion/code` não existe, que `calculateMetadata()` roda uma vez numa aba separada, e que a API
    de medição é `measureText`/`fitText`/`fillTextBox`/`fitTextOnNLines` com as versões mínimas.
  - `surf-plan-skill` e `deep-orchestrator`: precisam do gate de determinismo (LS-07) e do gate offline
    (LS-05) como critério de aceite de qualquer card de animação de código.
  - `worktree-dev-session`: o lockfile pinado (`codehike 1.0.4`, `@code-hike/lighter 1.0.3`) tem que
    viajar igual para toda worktree, senão dois agentes produzem frames diferentes do mesmo código.
  - qualquer skill de **compliance/licença** do projeto: os três pontos vermelhos são a licença dual do
    Remotion (4+ pessoas), o `license: null` do template, e a ambiguidade do `@code-hike/lighter`.

- **Cards que este cluster condiciona:**
  1. **Bootstrap do renderer de código** — scaffolding via `npx create-video@latest --code-hike`
     (comando confirmado), seguido de remoção deliberada de `twoslash-cdn` e substituição de
     `@remotion/google-fonts` por `@remotion/fonts` + `staticFile()`. Entregável inclui o `.woff2` em
     `public/` e o `NOTICE` com a OFL.
  2. **Fronteira de highlight** — extrair `getHighlightedTokens()` como único ponto de contato com o
     motor, chamada exclusivamente de `calculateMetadata()`, com cache em disco por hash do snippet.
     Este card é o que torna LS-03 uma decisão reversível.
  3. **Renderer de transição frame-driven** — auditar/reescrever `CodeTransition.tsx` garantindo zero
     `element.animate()` e zero `transition-*`; toda interpolação sai de `useCurrentFrame()`.
     Critério de aceite = LS-07 (render duas vezes, hash igual).
  4. **Gate de layout de código** — helper que usa `fitTextOnNLines()`/`fillTextBox()` para provar que
     o snippet cabe no quadro, com `validateFontIsLoaded: true` explícito, e uma fixture que
     propositalmente estoura para provar que o gate morde.
  5. **Gate offline** — render com a rede desligada como etapa de CI local (LS-05). Este card mata as
     duas fontes de rede que o template traz de fábrica.
  6. **Card de compliance de licença** — `license-check` que falha em `UNLICENSED`/`null`, mais a
     decisão do dono sobre a Company License do Remotion. Bloqueia produção, não protótipo.
  7. **(opcional, depende de LS-04) Spike Shiki + magic-move** — protótipo sobre
     `@shikijs/magic-move/core` dirigido por frame, como rota de fuga MIT-limpa caso a licença do
     lighter ou do Remotion trave o projeto.
  8. **Anotação sobre código** — usar `@remotion/rough-notation` (v4.0.490+) com `progress` e `seed`
     explícitos; nunca a lib `rough-notation` original.

---

### Apêndice — o que ficou sem fonte primária (não vire card)

- Contagem exata de temas e linguagens do Shiki 4.4.x: a página `/themes` lista via tabela dinâmica que
  não veio no HTML. O que está confirmado é a origem (`tm-themes`) e o tamanho dos bundles.
- Lista literal dos 27+ temas do Code Hike: a doc de conceitos menciona o número e alguns nomes
  (`dark-plus`, `dracula`, `github-dark`, `material-darker`, `nord`, `github-from-css`,
  `material-from-css`), sem tabela completa acessível.
- `@remotion/rounded-text-box` / `createRoundedTextBox()`: o diretório `packages/rounded-text-box`
  existe no monorepo e a doc é referenciada, mas não abri a página de API. Potencialmente útil para a
  moldura do bloco de código — verificar antes de usar.
- Comportamento de `getStaticFiles()` fora do Studio: sem declaração primária encontrada → LS-01.
- Se pré-computar tokens em build é mais barato que em `calculateMetadata`: **o Shiki não afirma isso**.
  A doc dele fala em cache de highlighter, bundle fine-grained e Workers. Nossa preferência por
  pré-computar vem do padrão do template Code Hike, não do fornecedor → LS-02/LS-08.
