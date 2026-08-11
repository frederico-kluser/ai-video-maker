---
name: code-animation
description: Provides the verified facts, refutations and traps for showing and animating source code inside a Remotion render — the Code Hike template, Shiki, @shikijs/magic-move, pre-computed highlight tokens, locally embedded monospace fonts, the licences of the highlight engines (one of which changes the project NOTICE) and text measurement gates. Use whenever a task puts source code on screen, diffs two code states, types code out, highlights a snippet or picks a syntax theme, code font or highlight engine, even if the user never says Code Hike, Shiki or highlighting. Triggers: "code snippet", "syntax highlight", "animate code", "code transition", "magic move", "typing effect", "codehike", "shiki", "highlight.js", "token transitions", "measureText", "code overflows the frame", "monospace font", "licenca do motor de highlight", "trecho de codigo", "animar codigo"
metadata:
  type: knowledge
  tier: dominio
  verification_signal: 'curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/@remotion/code  # espera 404; se responder 200, o pacote oficial passou a existir e esta skill caducou'
---
# Animação de código — o que existe, o que não existe e onde o determinismo morre

## Quando carregar

- A tarefa coloca código-fonte na tela: bloco estático, digitação, diff entre dois estados,
  destaque de trecho, gutter de números de linha.
- A tarefa escolhe motor de highlight, tema de sintaxe ou fonte monoespaçada do vídeo.
- A tarefa escreve o gate que prova que o snippet cabe no quadro.
- **Não carregue** para texto que não é código (título, legenda, lower third) — isso é
  `motion-design-system`. Para a regra geral de determinismo e concorrência do render, é
  `remotion-render-pipeline`. Para código animado em Python/Manim, é `manim-bridge`.

## Conhecimento injetado

### O pacote oficial não existe — e um agente vai tentar importá-lo

`@remotion/code` **não existe**: `registry.npmjs.org/@remotion/code` responde HTTP 404 e a
listagem completa de `packages/` do monorepo (120+ diretórios) não tem `code`. Isto é ausência
provada por evidência positiva, não "não achei" — **Placar (2-0)** — fonte:
https://registry.npmjs.org/@remotion/code ·
https://api.github.com/repos/remotion-dev/remotion/contents/packages

A tabela de componentes do panorama mistura, na mesma coluna, coisas que se importam
(`@remotion/gif`) com coisas que precisam ser escritas (`<CodeHikeBlock />`, `<HighlightText />`).
O que tem **Placar (2-0)** é a ausência do pacote de código (mesma evidência acima); que os outros
quatro componentes também não existam é lacuna estrutural registrada pelo panorama, **sem
evidência própria por componente** — fonte: `docs/00-panorama-verificado.md` §3.2, linha
«A tabela `RM:26-30` mistura…» (`L03 S-15 + R09-10`)

Também não há página de doc oficial de "animated code"/"code transitions" no Remotion: o
caminho documentado é a **página de template**, não uma API — **Placar (2-0), rótulo PROVÁVEL e
não CONFIRMADO: a listagem da API veio truncada na leitura de origem** — fonte:
https://api.github.com/repos/remotion-dev/remotion/contents/packages/docs/docs

### O caminho oficial é um template, e ele não é MIT

O repo `remotion-dev/template-code-hike` existe, está ativo e é listado no catálogo oficial de
templates — **Placar (3-0)** — fonte: https://www.remotion.dev/templates/code-hike

`npx create-video@latest --code-hike` é comando válido **por construção**: `code-hike` é o
`cliId` do template e o CLI registra todo `cliId` como flag booleana. A lista literal de
templates só existe no código-fonte; a página `/docs/cli/create-video` renderiza um componente e
o HTML servido não contém os nomes — **Placar (3-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/create-video/src/templates.ts

O template **não é MIT**: o repo não declara SPDX (`license: null`), então adotá-lo **não** torna
a base permissiva — vale a licença dual do Remotion — **Placar (3-0)** — fonte:
https://remotion.pro/license

**Condição de escopo que não pode ser cortada:** o gatilho da Company License é *organização com
fins lucrativos com mais de 3 empregados*, **não** headcount cru de quem escreve código —
**Placar (3-0)** — fonte: `docs/00-panorama-verificado.md` §1.1 · `R01-02`; que *personal use*
seja categoria elegível à licença gratuita é leitura do programa, **não** está nessa linha do
panorama — fonte: `PROGRAMA.md` §I-3 (tabela de blast radius, linha «Licença do motor»).
Este programa está enquadrado como **uso pessoal** (decisão
do dono em `I-01`, ADR `0003-enquadramento-de-uso`), logo o gatilho **não dispara**: nenhum card
de animação de código está bloqueado por licença comercial, e escrever que está é erro. O que
sobrevive do fato é só o SPDX ausente — um `license-check` que espere MIT no template dá
vermelho — e o gatilho de reabertura: se o uso deixar de ser pessoal, esta condição cai.

### O motor do Code Hike não é Shiki

O highlight do Code Hike é `@code-hike/lighter` (TextMate via `tm-grammars`), **não** Shiki. Os
dois compartilham a *família de gramáticas*, não o runtime — **temas não são intercambiáveis por
suposição** — **Placar (2-0)** — fonte: https://registry.npmjs.org/@code-hike/lighter/latest

O pacote é `codehike` (sem escopo, sem hífen), e o subpath de que a transição depende —
`codehike/utils/token-transitions` — **só existe na linha 1.x**. `@code-hike/mdx` é a linha 0.x e
**não** é a v1: um agente que pesquisar pelo nome com escopo cai na linha errada, onde esse
subpath não existe — **Placar (3-0)** — fonte: https://registry.npmjs.org/codehike/latest

"Code Hike exige MDX" é verdade **só** para o pipeline markdown→componentes. `highlight()` e
`Pre` de `codehike/code` são explicitamente opcionais e o template Remotion não tem nenhum
arquivo `.mdx` — **Placar (3-0)** — fonte: https://codehike.org/blog/v1

### Trocar de motor de highlight mexe no `NOTICE` — um dos candidatos não é MIT

Entre os motores alternativos, **`highlight.js` é BSD-3-Clause** — a **única não-MIT** do grupo.
Prism (branch default `v2`), starry-night, tree-sitter e a `rough-notation` original são MIT —
**Placar (2-0)** — fonte: `docs/00-panorama-verificado.md` §2.7 · `R09-23`. A consequência é de
build, não de opinião: BSD-3-Clause exige a **cláusula de não-endosso** no aviso, logo adotar
`highlight.js` **muda o arquivo `NOTICE` do projeto**. Quem troca o motor sem reemitir o `NOTICE`
fica em falta com a licença enquanto todo `license-check` continua verde, porque "BSD-3-Clause" é
lida como permissiva conhecida e ninguém confere se o texto do aviso existe.

Os dois motores em jogo hoje não fecham o `NOTICE` sozinhos: o **Shiki é MIT** — **Placar (3-0) na
pesquisa de origem** (claim `R09-18` em `docs/pesquisa/R09-animacao-de-codigo.md`; o panorama não
reregistra o fato de licença, só os números de bundle) — e a licença efetiva de
`@code-hike/lighter` **está em disputa** (`D-11`, **placar 1-1**: o npm declara MIT, a API do
GitHub não detecta arquivo → semente `AB-064`). Enquanto `AB-064` estiver aberto, lighter **não**
pode entrar no `NOTICE` como MIT limpo.

### Pré-computar tokens: o mecanismo real, e o crédito honesto

O template pré-computa highlight **e** medição em `calculateMetadata()`, que o Remotion executa
**uma única vez, numa aba separada**, antes do render; o resultado viaja como props
JSON-serializáveis para todas as abas. Por isso o custo do highlight não multiplica por frame nem
por thread — e a doc de data-fetching declara a condição que sustenta isso: *"the data returned by
the API must be the same on all threads, otherwise flickering may occur"* —
**Placar (2-0) para o parágrafo inteiro** (as duas páginas de doc são **o mesmo domínio** e valem
um ponto só; o segundo ponto é o código do template) — fonte:
https://www.remotion.dev/docs/calculate-metadata ·
https://www.remotion.dev/docs/data-fetching ·
https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/src/calculate-metadata/calculate-metadata.tsx

**Crédito honesto:** "pré-compute tokens em build" não é recomendação do Shiki. As boas práticas
publicadas dele são outras — highlighter singleton com `dispose()`, bundle fine-grained, engine
JavaScript RegExp em vez de Oniguruma WASM na web, e highlight em Worker — **Placar (2-0)** —
fonte: https://shiki.style/guide/best-performance

**Escopo de versão dos números de bundle:** medidos no **Shiki 4.4.x** e válidos **por
entrypoint** — `shiki/bundle/full` = 6,4 MB min / 1,2 MB gzip, `shiki/bundle/web` = 3,8 MB /
695 KB. Não transporte esses números para outra minor nem para o import raiz — **Placar (2-0)**,
que é o placar com que o panorama registra estes números (a pesquisa de origem escreveu 3-0; o
panorama vence sobre fato) — fonte: `docs/00-panorama-verificado.md` §2.7 · `R09-19`, que registra
só o bundle **completo**; a versão `4.4.x` e o número do bundle **web** vêm do claim `R09-18` em
`docs/pesquisa/R09-animacao-de-codigo.md` · https://shiki.style/guide/bundles

A fronteira que torna a escolha de motor reversível é uma função
`getHighlightedTokens(source, lang, theme) → JSON serializável`, chamada **só** de
`calculateMetadata()`. Custo de reversão declarado: 1 arquivo, ~40 linhas, 1 fixture de tokens.
Se `highlight()` for chamado espalhado dentro dos componentes de render, a troca vira reescrita.
Isto é **decisão de costura deste programa, não fato de fornecedor — logo não tem placar** —
fonte: `docs/00-panorama-verificado.md` §5.1, linha «Motor de highlight de codigo». A costura
isola a *chamada*; **não** isola a
equivalência de tokens entre os dois motores (AB-063 aberto).

### A transição de estados: o erro clássico do domínio

O `CodeTransition.tsx` do template **não** usa Web Animations API: tira snapshot em
`useLayoutEffect`, compara com o DOM novo e aplica estilo por frame com `useCurrentFrame()` +
`interpolate()`. A doc do **próprio Code Hike** descreve o caminho padrão via
`getSnapshotBeforeUpdate()` / `componentDidUpdate()` + **WAAPI** — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/template-code-hike/main/src/CodeTransition.tsx ·
https://codehike.org/docs/code/token-transitions

WAAPI é dirigido por relógio de parede. Num render frame-a-frame com seek, o mesmo frame produz
resultados diferentes. Copiar o exemplo da doc do Code Hike para dentro de uma composição é o
erro mais provável deste domínio.

### magic-move: o pacote vivo mudou de nome

O pacote vivo é `@shikijs/magic-move` (MIT), versionado junto com o Shiki. O que importa dos
exports é que `./core` e `./renderer` são **subpaths separados** e que **todo** peer é opcional
(inclusive `shiki`): dá para consumir a máquina de estados sem arrastar o renderer, o
`./style.css` nem o highlighter em runtime — **Placar (3-0)** — fonte:
https://registry.npmjs.org/@shikijs/magic-move/latest

`shiki-magic-move@1.4.0` está deprecated no registry (*"is now @shikijs/magic-move, please
migrate by renaming the package"*) e o repositório dele foi arquivado; o código vive em
`shikijs/shiki` — **Placar (2-0)** — fonte: https://registry.npmjs.org/shiki-magic-move/latest

O ângulo aproveitável é o subpath `./core` (máquina de estados separada do renderer) alimentado
por tokens já compilados. O comportamento do renderer oficial está em `## Não verificado`.

### Medir texto: a API real e o que ela mede de fato

`@remotion/layout-utils` é MIT, sem dependências de produção, e exporta `measureText()`,
`fitText()` (desde v4.0.88), `fillTextBox()` (desde v4.0.57) e `fitTextOnNLines()` (desde
v4.0.313) — **Placar (3-0)** — fonte: https://www.remotion.dev/docs/layout-utils/fit-text

Para bloco de código o par correto é `fitTextOnNLines()` (devolve `{fontSize, lines[]}`) ou
`fillTextBox()` (devolve `{exceedsBox, newLine}`). **`fitText()` resolve uma largura, uma linha**
— usá-lo como gate de bloco é o falso verde documentado — **Placar (3-0)** — fonte:
https://www.remotion.dev/docs/layout-utils/fit-text-on-n-lines

`measureText()` mede criando um `<span>` real no DOM (`position:absolute`, `top:-10000px`,
`whiteSpace:'pre'`, `display:inline-block`) + `getBoundingClientRect()`, com cache em `Map` —
não usa canvas — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/layout-utils/src/layouts/measure-text.ts

Três consequências que mudam o código do gate: (1) precisa de DOM, logo não roda em Node puro;
(2) `whiteSpace:'pre'` mede **uma linha** preservando espaços, logo bloco multi-linha exige medir
linha a linha; (3) o span não tem `padding` nem `border` — se o elemento real tiver, a medida é
de outra coisa (a doc manda usar `outline`).

`validateFontIsLoaded` mede duas vezes (fonte pedida × fallback) e lança se as medidas baterem.
**Condição de escopo:** ele passa a `true` por padrão no Remotion 5.0; enquanto o projeto estiver
na linha 4.x o default é `false` e o parâmetro precisa ser explícito em toda medição —
**Placar (2-0)** — fonte: https://www.remotion.dev/docs/layout-utils/measure-text

### Fonte monoespacada: licença liberada, entrega pela rede não

JetBrains Mono é OFL-1.1 e Fira Code é SIL OFL 1.1 — ambas embutíveis sem custo, com o aviso da
OFL no `NOTICE` — **Placar (3-0)** — fonte:
https://api.github.com/repos/JetBrains/JetBrainsMono ·
https://raw.githubusercontent.com/tonsky/FiraCode/master/LICENSE

`@remotion/google-fonts` **não embute** a fonte: os módulos gerados (`JetBrainsMono.ts`,
`FiraCode.ts`) contêm URLs `https://fonts.gstatic.com/...`, ou seja, usar o pacote é baixar fonte
da rede no render — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/google-fonts/src/JetBrainsMono.ts

O caminho local é `loadFont()` de `@remotion/fonts` (desde v4.0.165) com `staticFile()`: carrega
`.woff2` versionado em `public/` e bloqueia o render até a fonte estar pronta, integrado a
`delayRender` — **Placar (2-0)** — fonte: https://www.remotion.dev/docs/fonts-api/load-font

**Condição de escopo que não pode ser cortada:** a restrição "sem CDN" é **nossa**, motivada por
render local e reprodutibilidade — decisão deste programa, **sem placar**, e **não** recomendação
do Remotion. Não escreva em card nenhum que "o Remotion recomenda embutir a fonte". O que a
página `/docs/fonts` de fato diz é leitura de fonte única e está em `## Não verificado`.

### Rede escondida dentro do template

O template usa `twoslash-cdn`, que baixa type definitions de CDN em runtime, com cache apenas em
memória por padrão (`storage` opcional para persistir). Somado ao `src/font.ts`, que carrega
Roboto Mono via `@remotion/google-fonts`, o template **como vem não roda offline** e não é
determinístico se o snippet importar de pacotes externos — **Placar (2-0)** — fonte:
https://twoslash.netlify.app/packages/cdn

### Anotação sobre o código

`@remotion/rough-notation` (MIT, desde v4.0.490) expõe `progress` (0–1) e `seed`, o que torna
forma e quantidade desenhada função do frame. A lib original `rough-stuff/rough-notation` anima
com relógio próprio (`show()`) e o `roughjs` usa aleatoriedade — as duas quebram determinismo —
**Placar (3-0)** — fonte: https://registry.npmjs.org/@remotion/rough-notation/latest ·
https://www.remotion.dev/docs/rough-notation/highlight

### Ritmo: quanto código pode entrar por segundo

O dado normativo disponível é sobre texto na tela, não sobre código: o teto de velocidade de
leitura em tela fica **abaixo** da leitura silenciosa livre de adultos (238 wpm em não-ficção) —
DCMP recomenda 130–160 wpm e a norma da Netflix é 20 caracteres por segundo (≈207 wpm, derivado)
— **Placar (3-0)** — fonte:
https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf ·
https://dcmp.org/learn/captioningkey/601 ·
https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide

O teto operacional derivado disto — **≈0,5 linha nova de código por segundo** (uma linha de ~40
caracteres a 20 CPS pede ~2 s) — é derivação nossa e está em `## Não verificado`. Código é mais
denso que prosa: trate 0,5 linha/s como teto, não como alvo.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não importe `@remotion/code` nem `<CodeHikeBlock />`.** Não existem. O import não resolve e o
  agente perde a onda tentando achar a versão certa de um pacote inexistente.
- **Não copie o exemplo de token transitions da doc do Code Hike.** Ele usa WAAPI; o template
  Remotion reescreveu essa parte justamente porque relógio de parede não sobrevive a seek.
- **Não chame `highlight()`/`codeToTokens()` dentro de componente de render.** O highlight roda em
  `calculateMetadata()`, atrás de `getHighlightedTokens()`. Por frame, o custo multiplica por
  frame × concorrência e abre uma porta de não-determinismo entre abas.
- **Não substitua o bloco de código por screenshot de editor.** O pixel queima tema, fonte e DPI,
  o texto some do DOM, `measureText`/`fillTextBox` não têm o que medir e o gate de layout fica
  verde por ausência de texto. Falso verde por remoção do que era medido.
- **Não instale `shiki-magic-move`.** É o nome que todo tutorial e a doc do Slidev usam, e o npm
  serve. Mas o pacote parou na linha **1.x** como alias deprecated, enquanto `@shikijs/magic-move`
  é versionado **junto com o Shiki 4.x**: instalar o velho prende `codeToKeyedTokens` a uma versão
  que não acompanha a gramática do highlighter, e a chave de token diverge sem erro nenhum.
- **Não confie em ligadura de fonte para alinhamento.** `=>` renderizado como glifo único muda a
  largura medida e desalinha gutter e colunas. Desligue (`fontVariantLigatures: 'none'`) até
  AB-065 fechar; ligar de volta exige recapturar todo snapshot de código.
- **Não use `fitText()` para provar que o bloco cabe.** Ele resolve uma linha; o bloco continua
  estourando por baixo e o gate passa.
- **Não use `@remotion/google-fonts` para a fonte do código** (é rede no render) — e não escreva
  no card que "o Remotion recomenda embutir a fonte": ele não recomenda.
- **Não misture motores** (lighter para uns snippets, Shiki para outros) no mesmo vídeo. A
  equivalência de tokens entre os dois está aberta (AB-063); tema "equivalente" não é tema igual.
- **Não suba `codehike` para o `latest` só porque o npm serve.** O template pina `codehike 1.0.4`
  e `@code-hike/lighter 1.0.3`; trocar a versão sem recapturar o snapshot de transição é trocar o
  motor no meio da estrada. Escopo: vale enquanto a base do projeto for o template.
- **Não leia os snippets via `getStaticFiles()` de `@remotion/studio` assumindo render headless.**
  AB-060 está aberto; o caminho seguro é `props` gerado antes do render.
- **Não rode `license-check` só sobre o campo `license` do `package.json`.** É o que toda
  ferramenta do ecossistema faz por default e é o que produz o verde errado **aqui**:
  `@code-hike/lighter` publica `"license":"MIT"` no manifesto enquanto o repositório não tem
  arquivo de licença detectável (AB-064 aberto), e o `template-code-hike` não tem SPDX nenhum —
  o campo lido é o do pacote, não o do tarball. O que morde é abrir o tarball
  (`npm pack` + `tar -tzf | grep -i licen`).
- **Não emita o `NOTICE` só quando a dependência for copiada para o repo.** JetBrains Mono e Fira
  Code entram como `.woff2` em `public/`, não como dependência npm — o `license-check` que só olha
  `node_modules` passa verde e o aviso exigido pela OFL some do build.
- **Não troque o motor de highlight sem reemitir o `NOTICE`.** Sair de lighter/Shiki para
  `highlight.js` é sair de MIT para **BSD-3-Clause**: a cláusula de não-endosso passa a ser
  exigida no aviso, e uma troca de motor parece mudança de implementação, não de licença — é por
  isso que ninguém abre o `NOTICE` na hora de trocar.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| O snippet aparece bonito no Studio | O Studio tem `@remotion/studio` disponível e a rede quente; o render headless pode não ter nem um nem outro | Gate `render-offline`: `npx remotion render` com a interface de rede **desligada**, falhando em qualquer timeout de `delayRender` (AB-055) + gate `render-headless`: mesmo render com o Studio fechado, falhando se `get-files.ts` devolver array vazio (AB-060) |
| A fonte "carregou" porque o texto apareceu | O Chrome cai no fallback em silêncio; `measureText` mede o fallback e devolve número plausível, o layout fecha e o vídeo sai errado | `validateFontIsLoaded: true` explícito em toda medição enquanto o projeto estiver na linha 4.x — é ele que **lança** quando as duas medições (fonte pedida × fallback) batem; sem o parâmetro, no 4.x o default é `false` e nada lança |
| A transição roda lisa no navegador | Pode ser WAAPI ou `transition-*`: perfeito em playback, lixo em render com seek | Render duas vezes com `--sequence` e hash por frame, falhando no primeiro frame divergente (AB-016) — mais um `grep` de gate que falha se `element.animate(`, `transition-duration` ou `getAnimations(` aparecer em `src/` |
| `measureText` devolveu um número | Mede um `<span>` com `whiteSpace:'pre'`, sem `padding`/`border`, uma linha só | Fixture de snippet que estoura de propósito, asserindo `exceedsBox === true` |
| O highlight é rápido | Você mediu com o highlighter quente; a primeira chamada carrega gramática e tema | Gate que mede a **primeira** chamada num **processo novo** e a segunda no mesmo processo, e falha se o número reportado no orçamento for o da segunda — a diferença entre as duas é a evidência anexada; o teto em ms ainda não existe, então o gate morde pela **origem do número**, não por limiar |
| A transição tem "os mesmos tokens" | A chave de token (`codeToKeyedTokens`) muda com tema, gramática ou versão; o diff vira "tudo saiu, tudo entrou" e a animação vira flash | Teste entre dois snippets quase idênticos asserindo `tokens movidos > 0` |
| `npm i` passou | `@code-hike/lighter` declara MIT no npm e o repo não tem licença detectável; o template não tem SPDX | `license-check` no CI que falha em `UNLICENSED`/`null` |
| O `license-check` continuou verde depois de trocar o motor | Ele classifica a licença (BSD-3-Clause é permissiva conhecida), não confere se o **aviso** que ela exige foi escrito — a cláusula de não-endosso do `highlight.js` some sem ninguém ficar vermelho | Gate que lê a licença efetiva de cada dependência de highlight e falha se alguma for ≠ MIT sem entrada correspondente no `NOTICE` |
| "Funciona com a versão mais nova" | O template pina versões antigas e é nelas que a transição foi testada | Lockfile commitado + um snapshot de frame por versão |

## O que esta skill NÃO cobre

- Determinismo, concorrência e chunking do render em geral → `remotion-render-pipeline`.
- `interpolate`, `spring`, durações e legibilidade tipográfica geral → `motion-design-system`.
- Como escrever o gate para que ele morda (sonda negativa, falha por ausência) →
  `falsifiable-gates`.
- Onde o nó de código entra na linha do tempo e como ele é serializado → `timeline-manifest`.
- Cena de código produzida em Python/Manim → `manim-bridge`.
- Legenda, karaokê e sincronia com locução → `audio-captions-sync`.
- Licenciamento e aquisição de imagem/GIF → `asset-acquisition`.
- Fatos base do Remotion (licença dual, `calculateMetadata` como API) → `remotion-core`.

## Não verificado

Nenhuma linha abaixo tem placar ≥2-0. Não use como fato; feche antes de depender.

**Sobre os identificadores:** só `AB-nnn` é id do ledger do programa (faixa `AB-001..AB-075`
alocada no panorama, `AB-076..AB-149` reservada para as ondas seguintes). `R09/LS-nn` é o id
**provisório da pesquisa de origem** e **não foi promovido a `AB-`** — não procure por ele no
ledger, e ao abrir o item use a faixa reservada.

- **Renderer do `@shikijs/magic-move` usa CSS transitions e não expõe progresso** — leitura de uma
  única fonte primária, **placar (1-0)**. Fecha com:
  `curl -s https://raw.githubusercontent.com/shikijs/shiki/main/packages/magic-move/src/renderer.ts | grep -nE "getAnimations|transitionDuration|--smm"`
- **`@shikijs/magic-move/core` é dirigível por `useCurrentFrame()` sem o renderer nem o CSS**
  (semente `R09/LS-04`, sem id `AB-` alocado) — dedução. Fecha com spike de ~30 linhas importando só `./core` numa `<Composition>` e
  conferindo que nada chama `getAnimations()`.
- **Teto de ≈0,5 linha nova de código por segundo** — derivado de 20 CPS/130–160 wpm, que são
  normas de **legenda**, não de código. Não há norma publicada de taxa de leitura de código.
  Fecha com decisão do dono + fixture de legibilidade (OCR no frame reduzido), não com comando.
- **A página `/docs/fonts` do Remotion lista Google Fonts via CDN como abordagem padrão e não
  desaconselha CDN** — leitura de uma única fonte primária, **placar (1-0)**. A regra operacional
  ("sem CDN") não depende disto: ela é nossa. Fecha com:
  `curl -s https://www.remotion.dev/docs/fonts | grep -icE "gstatic|@remotion/google-fonts"`
- **Tokens do Shiki ≡ tokens do lighter para o mesmo tema** (AB-063) — assumir que **não**. Fecha
  rodando `codeToTokens` (Shiki) e `highlight()` (lighter) sobre o mesmo arquivo e diffando o JSON.
- **`getStaticFiles()` funciona em `calculateMetadata` durante `remotion render` headless**
  (AB-060) — sem declaração primária. Fecha rodando `npx remotion render` num clone limpo do
  template com o Studio fechado e observando se `get-files.ts` devolve array vazio.
- **Ligaduras alteram a largura medida por `measureText`, e `additionalStyles`/`featureSettings`
  propagam para a medição** (AB-065). Fecha medindo `"=>"` e `"= >"` com e sem
  `additionalStyles: {fontVariantLigatures:'none'}` e comparando `width`.
- **Licença efetiva de `@code-hike/lighter`** (AB-064, placar 1-1: npm diz MIT, GitHub não detecta
  arquivo). Fecha com `npm pack @code-hike/lighter && tar -tzf code-hike-lighter-*.tgz | grep -i licen`.
- **Custo em ms (cold start) de `highlight()` para ~60 linhas** (semente `R09/LS-02`, sem id `AB-` alocado). Fecha instrumentando
  `process-snippet.ts` com `performance.now()` e rodando o render duas vezes.
- **Tamanho real do bundle Shiki fine-grained com 5 linguagens e 1 tema** (semente `R09/LS-08`, sem id `AB-` alocado). Fecha com
  `npx remotion bundle` e medindo o output contra o bundle completo.
- **`codehike 1.1.0` é drop-in sobre o `1.0.4` pinado** (semente `R09/LS-11`, sem id `AB-` alocado). Fecha instalando 1.1.0 no clone do
  template, renderizando o mesmo frame e comparando o PNG.
- **`seed` de `@remotion/rough-notation` produz a mesma forma entre execuções e entre máquinas**
  (semente `R09/LS-10`, sem id `AB-` alocado). Fecha renderizando o mesmo frame com `seed=1` duas vezes e comparando o PNG.

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
