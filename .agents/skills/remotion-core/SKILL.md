---
name: remotion-core
description: Provides the deterministic composition model of Remotion 4.0.x — frame in, pixels out —
  with the real documented defaults of interpolate() and spring(), the subtractive duration arithmetic
  of TransitionSeries, the closed list of transition presentations and timings, and the
  scope-conditioned license trigger. Use whenever authoring, generating or reviewing
  composition code, scene timing, animation curves or transitions, even if the user never says
  "Remotion" or "determinism". Triggers — "composition", "useCurrentFrame", "interpolate", "spring",
  "easing", "Sequence", "Series", "TransitionSeries", "transition", "presentation", "springTiming",
  "linearTiming", "premount", "layout none", "pushCut", "cube", "flicker", "non-deterministic render",
  "random seed", "delayRender", "calculateMetadata", "OffthreadVideo", "@remotion/media",
  "import Audio from remotion", "Remotion license", "company license".
metadata:
  type: knowledge
  tier: dominio
  verification_signal: "node -e \"const {interpolate}=require('remotion'); if (interpolate(200,[0,100],[0,1]) !== 2) throw new Error('interpolate deixou de extrapolar por extend');\" && node -e \"const t=require('@remotion/transitions'); if (typeof t.springTiming !== 'function' || typeof t.linearTiming !== 'function') throw new Error('catalogo de timings mudou');\" && npm ls remotion @remotion/transitions"
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
# Remotion — composição determinística

> **Como esta skill cita o panorama:** por **id de claim** (`R02-03`, `R07-12`, `R09-15`), nunca por
> `arquivo:linha` — o id sobrevive à edição do alvo e a linha não (`PROGRAMA.md` §V-1 mediu a deriva
> e manda exigir `§seção` ou id). Sem id — as refutações da §3 — é `§`-âncora mais o título da linha.

## Quando carregar

- Ao escrever ou gerar qualquer `.tsx` do diretório de composições — cena, título, animação de
  entrada, transição.
- Ao calcular a duração de uma composição a partir do roteiro/manifesto, ou ao explicar por que o
  vídeo saiu com cauda preta.
- Ao revisar código Remotion que "funciona no Studio" e ainda não passou por um render completo.
- Ao escolher entre `<Sequence>`, `<Series>` e `<TransitionSeries>`, ou ao escolher uma
  `presentation`/`timing`.
- Ao esbarrar em qualquer pergunta de licença do Remotion — a skill existe aqui para dizer que a
  resposta está **registrada** (`ADR-0003`), não para deduzi-la nem para re-escalá-la.
- Ao decidir **onde** duração ou prop derivada é calculada, ou qual componente de mídia importar.
- **Não** carregue para flags de CLI, concorrência, codec, GPU ou tempo de render
  (`remotion-render-pipeline`); para alinhamento, paginação, ducking e legenda
  (`audio-captions-sync` — mas **qual** componente de áudio importar é aqui); para o schema do
  manifesto de timeline (`timeline-manifest`).

## Conhecimento injetado

### O motivo mecânico do determinismo

Em render local, `concurrency` é o número de **abas Puppeteer num único browser**, geridas por um
`Pool` — não N processos de browser — **Placar (2-0)** — fonte: `R12-01` (§2.4 do panorama).
Consequência que governa tudo abaixo: o mesmo componente é
montado em várias abas, cada uma pedindo frames **fora de ordem**. Qualquer valor que venha de
relógio de parede, de sorteio local ou de estado acumulado entre frames diverge **entre abas**, e o
sintoma é cintilação — não erro.

O default de concorrência é `Math.round(Math.min(8, Math.max(1, cores/2)))`, com teto rígido de 8 e
contagem que respeita cgroup — **Placar (2-0)** — fonte: `R05-09 · R05-10 · R05-11` (§2.4). O que
o número esconde é o **piso**: com ≤ 2 núcleos visíveis (contêiner de CI com `--cpus=2`, VM pequena)
o default resolve para **1 aba** e todo defeito de determinismo some — exatamente onde o gate roda.
Multi-aba por padrão vale de 3 núcleos para cima, não sempre; por isso o gate de determinismo
registra a concorrência efetiva em vez de assumi-la.

### `calculateMetadata()` — onde a duração derivada é calculada, e por que só ali

`calculateMetadata()` roda **uma única vez, numa aba separada**, dentro do `selectComposition()` que
precede o render — não por aba, não por frame — **Placar (2-0)** — fonte: `R09-15` (§2.7 do
panorama). Daí a licença que só ela dá: `durationInFrames` da `<Composition>` e as props derivadas
são calculadas **uma vez** e viajam JSON-serializadas para todas as abas — inclusive a duração vinda
de `timing.getDurationInFrames({fps})` da aritmética subtrativa abaixo. É também a única exceção
documentada à regra de aleatoriedade: sorteio verdadeiro cabe ali porque não há segunda instância —
**(1-0)** — fonte: `R11-16 · R11-17` (§8.1 do panorama, tier não verificado). A condição que sobra é
a que morde: o valor devolvido tem de ser **o mesmo em toda aba**; derivá-lo de rede, de relógio ou
de disco mutável recria a cintilação uma camada acima. Trabalho caro (medir texto, colorir código,
ler arquivo) mora ali, nunca no corpo do componente, onde multiplica pela concorrência.

### `interpolate()` — o default é `extend`, não `clamp`

Defaults reais: `extrapolateLeft: 'extend'`, `extrapolateRight: 'extend'`, `easing` identidade,
`output: 'linear'`; valores aceitos `extend | clamp | wrap | identity` — **Placar (2-0)** — fonte:
https://www.remotion.dev/docs/interpolate e
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/interpolate.ts

`interpolate(200,[0,100],[0,1])` devolve `2`. Sem erro, sem aviso. É daí que nascem opacidade
negativa, escala explodida e cor fora de gama. **Toda** chamada leva `extrapolateLeft` e
`extrapolateRight` explícitos: com o default sendo `extend`, isso é gate de correção, não estilo.

`interpolate()` lança com mensagens literais úteis para casar em teste — **Placar (2-0)** — fonte:
`packages/core/src/interpolate.ts` (mesmo arquivo acima):
`"inputRange must be strictly monotonically increasing but got [...]"`,
`"inputRange (N) and outputRange (M) must have the same length"`,
`"inputRange must contain only finite numbers, but got [...]"`,
`"Cannot interpolate an input which is not a number"`.

### `spring()` e `measureSpring()` — os defaults reais e o loop sem teto

Config default: `mass: 1`, `damping: 10`, `stiffness: 100`, `overshootClamping: false` —
**Placar (2-0)** — fonte: https://www.remotion.dev/docs/spring e
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts
(`const defaultSpringConfig: SpringConfig = { damping: 10, mass: 1, stiffness: 100,
overshootClamping: false };`). `damping: 10` é **subamortecido**: `spring({frame, fps})` sem config
já tem overshoot visível. Não existe preset nomeado oficial — "entrada mais dinâmica" é mexer nesses
três números.

`durationRestThreshold` default `0.005`, o mesmo valor em `spring()`, `measureSpring()` (lá chamado
`threshold`) e `springTiming()` — **Placar (2-0)** — fonte:
https://www.remotion.dev/docs/transitions/timings/springtiming e
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/measure-spring.ts

`measureSpring({fps, config, threshold})` devolve frames até assentar e roda um `while` **sem teto de
iteração e sem throw** — **Placar (2-0)** — fonte: `measure-spring.ts` (mesmo arquivo). Escopo da
armadilha: o custo é pago **no cálculo de layout do `<TransitionSeries>`, durante o render**, não no
runtime do vídeo. `damping` baixo somado a `durationRestThreshold: 0.001` produz duração absurda ou
espera longa. Todo schema exposto a um LLM carrega piso de `damping` e piso de
`durationRestThreshold`.

Baixar o threshold para `0.001` **alonga a transição** e portanto muda a duração total da
composição — é ajuste de timeline, não ajuste estético — **Placar (2-0)** — fonte: `R02-03`
(§2.1 do panorama).

### `<Series>` — o delta sobre o que já é óbvio

Só o **último** `<Series.Sequence>` pode ter `durationInFrames: Infinity`; os anteriores são
validados como duração finita positiva — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/series/index.tsx e
https://www.remotion.dev/docs/series. O wrapper externo do `<Series>` é um `<Sequence layout="none">`
(não introduz `AbsoluteFill`), enquanto cada `<Series.Sequence>` herda `absolute-fill` — quem
estiliza contando com um `AbsoluteFill` no wrapper erra a camada.

Regra operacional: nunca calcule `from` à mão quando houver alternativa — `<Series>` sem transição,
`<TransitionSeries>` com transição (aí os vizinhos se sobrepõem pela duração da transição).

### A aritmética da duração é subtrativa

`total = Σ(durationInFrames das sequences) − Σ(durações das transitions)` — **Placar (2-0)** —
fonte: https://www.remotion.dev/docs/transitions/transitionseries e
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/TransitionSeries.tsx
Exemplo oficial: `40 + 60 + 90 − 30 − 45 = 115`. Durante a transição as duas cenas renderizam
simultaneamente.

`<TransitionSeries.Overlay>` (a partir da v4.0.415) é **outro mecanismo**, não uma variante de
transição: sobrepõe sem consumir frames de ninguém e **não entra na subtração** — **Placar (2-0)** —
mesma fonte. Fundir os dois é o erro que o panorama cometeu: "sobreposição" descreve os dois e só um
deles encurta. Consequência mecânica: quem troca uma `Transition` por um `Overlay` para "manter o
efeito" **alonga** a composição pela duração da transição removida, e quem soma um `Overlay` na
aritmética **encurta**. O runtime também proíbe `Overlay` adjacente a `Transition`.

Errar o sinal (somar em vez de subtrair) não gera erro: gera **cauda preta no fim do vídeo**. A
duração sai de `timing.getDurationInFrames({fps})`, nunca de soma à mão.

`presentation` de `<TransitionSeries.Transition>` é **opcional e cai em `slide()`** quando omitido —
**Placar (2-0)** — fonte: `TransitionSeries.tsx` (`const nextPresentation = next.props.presentation
?? slide();`) e a página acima. Omitir não dá corte seco; corte seco é `none()`, corte com punch é
`pushCut()`. No schema exposto ao gerador, `presentation` é obrigatório mesmo sendo opcional na API.

Restrições de arranjo validadas em runtime, com mensagens literais — **Placar (2-0)** — fonte:
`TransitionSeries.tsx`:
`"A <TransitionSeries.Transition /> component must not be followed by another
<TransitionSeries.Transition /> component"` e
`"The duration of a <TransitionSeries.Sequence /> must not be shorter than the duration of the next
<TransitionSeries.Transition />."`

### Premount, postmount e `layout="none"`

`premountFor` e `postmountFor` existem, default `0` em 4.0.x, suportados em `<Sequence>`,
`<Series.Sequence>` e `<TransitionSeries.Sequence>` — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/Sequence.tsx e
https://www.remotion.dev/docs/player/premounting. O delta que não se deduz do nome: a cena premontada
fica no DOM com `opacity: 0` e `pointer-events: none` — ou seja, ela **roda `delayRender`, baixa
asset e dispara efeito** durante o intervalo em que não aparece.

`layout="none"` (default é `absolute-fill`) é **incompatível com `style`, com `ref` e com premount**
— as três combinações lançam — e dentro de `<TransitionSeries>` é deprecated e passa a lançar a
partir da 5.0.0 — **Placar (2-0)** — fonte: `Sequence.tsx` (mesmo arquivo) e a doc acima. É tentador
porque "parece menos mágica" e o preview fica igual.

### O catálogo real de presentations e timings

`@remotion/transitions@4.0.507` embarca exatamente **19** presentations, por subpath de export:
`fade`, `slide`, `wipe`, `flip`, `clock-wipe`, `book-flip`, `zoom-blur`, `dreamy-zoom`, `film-burn`,
`linear-blur`, `zoom-in-out`, `none`, `iris`, `dissolve`, `ripple`, `crosswarp`, `cross-zoom`,
`swap`, `push-cut` — **Placar (3-0)** — fonte:
https://registry.npmjs.org/@remotion/transitions/latest e
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/package.json

`cube()` **não** vem no pacote: tem página na mesma árvore de doc das outras, mas o import é
`@remotion-dev/cube-presentation`, um pacote separado e **pago** — **Placar (3-0)** — fonte:
https://www.remotion.dev/docs/transitions/presentations/cube e o exports map acima (evidência
positiva de ausência: o exports map é a superfície fechada do pacote). Copiar o catálogo da
documentação produz build quebrado — ou, pior, alguém "resolve" instalando uma dependência paga sem
passar pelo dono.

`pushCut()` **existe** — subpath `./push-cut` — **Placar (3-0)** — mesma fonte do catálogo. A
suspeita de que o nome era alucinação do panorama está **refutada**; o risco real migrou para o
corte de versão (ver `## Não verificado`).

Existem exatamente **dois** timings oficiais — `linearTiming()` e `springTiming()` — mais a rota
custom — **Placar (2-0)** — fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/index.ts e
https://www.remotion.dev/docs/transitions/transitionseries. Não existe `easeTiming` nem
`cubicTiming`; curva fora de linear/mola é `linearTiming({durationInFrames, easing})` ou um
`TransitionTiming` próprio.

O helper de duração é o próprio objeto de timing:
`TransitionTiming = { getDurationInFrames({fps}), getProgress({frame, fps}) }` — **Placar (2-0)** —
fonte:
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/types.ts e a
página de `transitionseries`. A assimetria que o gerador precisa saber: `linearTiming` **exige**
`durationInFrames`; `springTiming` **deriva** a duração. É isso que permite calcular a timeline
antes de renderizar.

### Mídia na composição — o que sai do browser, e o import que compila errado

`<OffthreadVideo>` extrai o frame com **FFmpeg, fora do browser**, e o injeta como `<Img>`; a prop
`transparent` (v4.0.0) troca a extração de BMP para **PNG**, habilitando alfa e desacelerando o
render — **Placar (2-0)** — fonte: `R07-12 · R10-13` (§2.5 do panorama). É isto que desarma a tensão
roteada para cá: o Chromium não decodifica `qtrle` nem ProRes (`R07-11`), mas o decoder do browser
**não está no caminho crítico** do render server-side — o limite vale para preview e `<video>`
(`docs/00-panorama-verificado.md` §3.3, refutação «O Remotion roda no Chrome, entao so consegue
WebM VP9 com alfa»). O que **não** se deduz disso: a doc lista H.264, H.265, VP8, VP9, AV1 e ProRes
e **não menciona QTRLE** — ler `.mov` `qtrle` segue item de ledger aberto (`AB-041`). Qual
container/codec sai do Manim é `manim-bridge`/`ffmpeg-media-ops`; aqui fica o fato do componente.

`@remotion/media` exporta `Audio` e `Video` — **Placar (3-0)** — fonte: `R03-01` (§1.2 do panorama).
O pacote `remotion` **também** exporta `Audio`, e lá ele é literalmente
`export const Audio = Html5Audio;` marcado `@deprecated`, enquanto `<Audio>` de `@remotion/media` é
o recomendado para código novo — **Placar (2-0)** — fonte: `R03-02 · R03-04` (§2.2 do panorama). Por
isso a regra é **lint, não revisão**: `import {Audio} from 'remotion'` compila, roda e produz som.
Não há sintoma, e o que muda é invisível no diff — o legado entra na **outra** pipeline
(`<Html5Audio>` → asset de mídia → filtros FFmpeg) contra extração por frame via WebCodecs e asset
`inline-audio` PCM (`R03-25`, 2-0), com outra quantização de início de faixa. O invariante mora
junto dos estruturais (`PROGRAMA.md` §IV-3, a linha que proíbe
`Date.now`/`Math.random`/`setTimeout` sob `src/composicao/`) e é executável pelo gate de pureza do
card `F1-01` (`just comp:pureza`). `<Html5Audio>` **não** está deprecado — é o alvo do fallback
automático de `@remotion/media` (`R03-05`, 2-0): proibir o **import** não é proibir o componente.

### Licenciamento — restrição de primeira classe, não nota de rodapé

Remotion **não é open-source**: é *source-available* sob licença proprietária própria, e a FAQ
oficial nega a condição literalmente — **Placar (3-0)** — fonte:
https://www.remotion.dev/docs/license/faq e
https://github.com/remotion-dev/remotion/blob/main/LICENSE.md. Não há fork MIT, não há vendoring do
renderer que escape do gatilho.

A elegibilidade à Free License na linha 4.x é uma **lista fechada de categorias**, e a condição de
escopo mora na categoria, não no número: *"You are eligible to use Remotion for free if you are: an
individual / a for-profit organization with up to 3 employees / a non-profit or not-for-profit
organization / evaluating whether Remotion is a good fit, and are not yet using it in a commercial
way"* — **Placar (3-0)** — fonte: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md e
https://www.remotion.dev/docs/license/faq. Duas leituras que não podem ser fundidas: **(a)** dentro
da categoria *organização com fins lucrativos*, o gatilho é o tamanho da **organização** (mais de 3
empregados ⇒ Company License), não o número de pessoas que operam o software; **(b)** *an individual*
é **categoria própria** — uso pessoal não passa pelo gatilho de (a). Citar (a) sem (b) converte uma
regra condicionada em bloqueio universal, e é o erro mais provável desta seção inteira.

Neste programa a condição já está fechada por precedência declarada: `PROGRAMA.md` `I-01` /
`ADR-0003` registram **uso pessoal**, com `D2 — tier: nenhum` e a pergunta de tier `ENCERRADA SEM
DECISÃO`. O gatilho de (a) **não se aplica** enquanto o escopo for esse; nenhum card deste programa
está bloqueado por licença comercial. O que fica vivo é o item de ledger `AB-950` ("o uso continua
pessoal?"), aberto por desenho.

O uso comercial do **vídeo produzido** é amplamente permitido (institucional, marketing, treinamento,
entrega a cliente); o proibido é vender/relicenciar um derivado do próprio Remotion — **Placar
(3-0)** — fonte: `LICENSE.md` acima e https://www.remotion.dev/docs/license/faq. A cerca é sobre o
produto Remotion, não sobre o vídeo.

**Não há diferença de funcionalidade entre a versão gratuita e a paga** — **Placar (2-0)** — fonte:
https://www.remotion.dev/docs/license/faq e https://www.remotion.pro/license. A consequência é dura
e é o motivo de a licença estar nesta skill: **não existe sinal técnico de não-conformidade**. O
sistema roda idêntico licenciado ou não; nenhum teste fica vermelho. Compliance aqui é decisão
escrita, nunca gate executável.

Regra operacional: **não reabra a pergunta de tier** — `ADR-0003` a encerrou, e escalar de novo um
`PERGUNTA-DONO` já respondido custa uma onda por nada. O que continua vivo é só o **escopo**: um card
que proponha publicação monetizada, entrega em nome de uma organização ou uso de trabalho não é
decisão técnica — dispara `AB-950` e volta ao dono, porque é aí que (a) passa a valer. Preço e tier
não entram em skill nenhuma: envelhecem rápido e vivem no dossiê
`docs/pesquisa/R01-remotion-licenca-versoes.md`.

### Versão e pin

A linha 4 é **patch-only**: de 4.0.0 a 4.0.507 sem nenhum incremento de minor, com cadência de
release quase diária — **Placar (2-0)** — fonte: https://registry.npmjs.org/remotion/latest e
https://github.com/remotion-dev/remotion/releases. `^4.0.0` deixa duas worktrees irmãs em versões
diferentes **no mesmo dia**; o pin exato mais o lockfile commitado é o que impede o falso vermelho
mais provável de uma onda paralela.

Remotion 5.0 **não foi lançado** e a própria página de migração declara a lista de breaking changes
como incompleta — **Placar (3-0)** — fonte: https://www.remotion.dev/docs/5-0-migration. Tudo que
esta skill diz sobre 5.0 é anúncio de fornecedor, não invariante.

`@remotion/sfx` existe (não é nome inventado) e a referência oficial de API lista 41 pacotes —
**Placar (3-0)** — fonte: https://registry.npmjs.org/@remotion/sfx e
https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/components/TableOfContents/api.tsx

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não use `<img>` nem `<Img>` para GIF.** `@remotion/gif` é determinístico por três mecanismos
  verificáveis (`delayRender()` bloqueando a carga, índice puro `useCurrentGifIndex` = f(frame, fps,
  playbackRate, delays) sem `Date.now()`, e pintura em `<canvas>`) — **Placar (2-0)** — fonte:
  `R08-15 · R08-16` (§2.6 do panorama). Um `<img src="x.gif">` não tem nenhum dos três e anima pelo
  relógio de parede. Argumente pelo mecanismo: a frase da doc oficial que proíbe `<Img>` para GIF é
  fonte única — **(1-0)**, mesmo claim.
- **`@remotion/google-fonts` é CDN — o pacote não embute a fonte.** Os módulos gerados contêm URLs
  `https://fonts.gstatic.com/...`; usar o pacote é **baixar da rede em tempo de render** —
  **Placar (2-0)** — fonte: `R09-17` (§2.7 do panorama) e `docs/00-panorama-verificado.md` §3.3,
  refutação «`@remotion/google-fonts` embute a fonte no bundle». Não herde o (3-0) de `R09-25`
  (§1.5): aquele placar é da **licença** das fontes (OFL), não da **entrega pela rede**, que fecha
  em 2-0. A saída é `@remotion/fonts` + `staticFile()` com o `.woff2`
  versionado em `public/`. Condição de escopo que não pode cair: **proibir CDN de fonte é regra
  nossa**, e vale porque este render é local e precisa ser reprodutível — a `/docs/fonts` oficial
  lista Google Fonts via CDN como abordagem **padrão** e não emite esse aviso (§3.3, refutação «O
  Remotion recomenda evitar CDN de fontes por determinismo», REFUTADO). Não atribua a proibição ao
  fornecedor.
- **Não meça texto à mão no browser.** Use `measureText()`, `fillTextBox()` ou `fitTextOnNLines()` de
  `@remotion/layout-utils` — **Placar (3-0)** — fonte: `R09-12` (§1.2 do panorama). Duas
  condições de escopo que se perdem: `fitText()` resolve **uma linha** e não serve para bloco de
  texto/código; e `measureText()` mede criando um `<span>` real no DOM, exigindo
  `validateFontIsLoaded: true` explícito enquanto o projeto estiver no 4.x, porque o Chrome mede o
  **fallback** em silêncio e a medida do fallback é plausível — **Placar (2-0)** — fonte:
  `R09-13 · R09-14` (§2.7 do panorama).
- **Não assuma que o que roda no Studio roda no render.** São regimes diferentes em duas dimensões:
  processo (o render abre N abas num Pool — **Placar (2-0)**, `R12-01`) e rede (o Studio tem rede de
  autoria; o render pode não ter, e `@remotion/sfx` serve **URLs remotas**
  `https://remotion.media/*.wav`, o que trava num `delayRender` sem internet — **Placar (2-0)**,
  `R03-21`). "Ficou bom no Studio" não é evidência de nada.
- **Não omita `presentation`** esperando corte seco — cai em `slide()` (2-0, acima).
- **Não calcule `from` à mão** e **não some as durações das transições** — a aritmética é subtrativa
  (2-0, acima). O sintoma de errar é visual e passa em teste de fumaça.
- **Não emita `layout="none"`** no diretório de composições, por mais limpo que pareça: desliga
  premount, é incompatível com `style` e `ref`, e lança dentro de `<TransitionSeries>` a partir da
  5.0 (2-0, acima).
- **Não copie o catálogo de transições da documentação** — ela inclui `cube()`, que não está no
  pacote e é pago (3-0, acima). O enum nasce derivado do `exports` do pacote instalado.
- **Não exponha `damping` nem `durationRestThreshold` a um gerador sem piso numérico** —
  `measureSpring()` roda um `while` sem teto durante o cálculo de layout (2-0, acima).
- **Não trate o campo `license` do npm como prova de licenciamento** — `@remotion/sfx` declara
  `MIT` e `@remotion/effects` declara `UNLICENSED` no mesmo monorepo, enquanto o `LICENSE.md`
  governa os dois. Um scanner de dependências vai reportar verde. Regra por dedução; o fato está em
  `## Não verificado`.
- **Não deduza o tier de licença a partir do volume de render, e não o re-escale.** A FAQ se
  contradiz para este caso exato (1-1, abaixo) — e `ADR-0003` já fechou por outro caminho (categoria
  de uso, não volume). As duas falhas simétricas: deduzir "é muito render, então precisa de tier"
  inventa um bloqueio que o programa não tem; reabrir a pergunta gasta uma onda numa decisão
  registrada. O que **é** sua responsabilidade é o gatilho: cena que menciona monetização,
  cliente ou marca da organização muda a categoria e dispara `AB-950`.
- **Não escreva "a doc do Remotion proíbe `setTimeout`".** A proibição é correta por dedução do
  modelo, mas nenhuma página oficial os lista nominalmente. Citação que ninguém checa envelhece pior
  que regra assumida — ver `## Não verificado`.
- **Não adote `@remotion/media-parser` nem `@remotion/webcodecs` como base estrutural** — ambos estão
  na lista de remoção planejada para o 5.0. Fato de fonte única; ver `## Não verificado`.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| `interpolate()` sem clamp passa nos testes | o default `extend` só transborda **fora** da janela testada (2-0) | fixture que assere `frame < inputRange[0]` **e** `frame > inputRange[n-1]` |
| A `<TransitionSeries>` renderiza sem erro | o Remotion não valida `durationInFrames` da `<Composition>` contra o conteúdo; somar em vez de subtrair dá cauda preta (2-0) | duração derivada de `timing.getDurationInFrames({fps})` + assert de que o último frame não é uniforme |
| `presentation` omitido "é corte seco" | é `slide()`, uma animação visível (2-0) | validação de schema que rejeita a transição sem `presentation` **antes** do render — o teste é gerar um manifesto com o campo ausente e exigir exit ≠ 0 com o nome do campo na mensagem |
| Catálogo de transições copiado da doc oficial | inclui `cube()`, fora do pacote e pago (3-0) | diff entre o enum do schema e `jq -r '.exports \| keys[]'` do `@remotion/transitions` instalado, falhando em qualquer nome só de um lado — pega `cube` a mais e `push-cut` a menos no mesmo gate |
| `layout="none"` e o preview fica idêntico | desliga premount e lança dentro de `<TransitionSeries>` no 5.0 (2-0) | grep proibindo `layout="none"` sob o diretório de composições |
| `durationRestThreshold: 0.001` "melhorou a transição" | alonga a transição e muda a duração total da composição em silêncio (2-0) | duração total como fixture assertado, não valor derivado sem olho |
| O repositório está no GitHub e o build passa | o produto é source-available; a elegibilidade é por **categoria de uso**, não por checagem no código (3-0) | **nada fica vermelho, e aqui isso é aceitável por um motivo nomeável**: a conformidade não é propriedade do binário, é propriedade do escopo declarado, e o escopo já está registrado (`ADR-0003`, uso pessoal). O que substitui o gate é o item de ledger `AB-950`, que só um humano fecha. O gate `"license": "SEE LICENSE IN LICENSE.md"` em `node_modules/remotion/package.json` pega **outra** falha (fork não-oficial), não não-conformidade |
| `import {Audio} from 'remotion'` — compila, roda e sai som no MP4 | é o `Html5Audio` legado sob o nome antigo, e entra na **outra** pipeline de áudio, com outra quantização de início (2-0) | lint que recuse importar `Audio` de `remotion` sob o diretório de composições, nomeando `@remotion/media` na mensagem — nenhum teste de áudio fica vermelho sem ele |
| `<img src="x.gif">` anima bonito no Studio | anima por relógio de parede; diverge entre abas no render (2-0) | lint proibindo `.gif` dentro de `<img>`/`<Img>` nas composições |
| `"^4.0.0"` — "é semver, está seguro" | a linha 4 é patch-only com release quase diária; worktrees irmãs instalam versões diferentes no mesmo dia (2-0) | gate que compare a saída de `npm ls remotion @remotion/transitions` com o pin exato do manifesto e falhe em qualquer divergência — ou em qualquer `^` no `package.json` |

## O que esta skill NÃO cobre

- Escolher e tunar `--concurrency`, flags de CLI, GPU, codec, tempo e custo de render →
  `remotion-render-pipeline`. Aqui a concorrência entra só como mecanismo do determinismo (quantas
  abas pedem frames fora de ordem), nunca como ajuste de performance.
- Alinhamento, paginação, ducking, legenda e a sincronia das duas pipelines de áudio →
  `audio-captions-sync`. **Qual** componente importar e o lint do import ficam aqui: é fato de API
  de componente, não de sincronia.
- Schema do manifesto, ids de cena, contrato roteiro→timeline → `timeline-manifest`.
- Aquisição e licença de GIF/imagem/trilha, cache do `@remotion/gif` → `asset-acquisition`.
- `@remotion/layout-utils` aplicado a bloco de código, fonte monoespaçada, ligaduras →
  `code-animation`.
- Durações normativas, easing como sistema de design, tokens de movimento →
  `motion-design-system`.
- Integração com Manim e espera de asset externo → `manim-bridge`.
- Golden master, hash de frames, caracterização de vídeo → `video-characterization`.
- Como escrever o gate falsificável que testa qualquer regra acima → `falsifiable-gates`.

## Não verificado

Tudo abaixo entrou com placar < 2-0 ou em disputa. Nenhuma destas linhas pode ser citada como
"a documentação afirma"; todas têm comando que fecha a lacuna.

| Afirmação | Placar | Comando que fecha |
|---|---|---|
| `useCurrentFrame()` é relativo à `<Sequence>` envolvente (retorna `0` no frame absoluto `from`) | (1-0) | renderizar composição com `<Sequence from={90}>` e assertar o valor no frame 90 — trivialmente testável, vira teste e não card cego |
| `random(seed)` é determinístico e `Math.random()` quebra por multi-instância da página | (1-0) | dois renders completos com concorrência default e comparação de hash frame a frame |
| `delayRender(label?, {timeoutInMilliseconds?, retries?})` tem timeout default de 30 s e `retries` default `0` | (1-0) | cronometrar a carga do asset real contra 30000 ms e passar `timeoutInMilliseconds` explícito |
| A doc oficial de flickering proíbe **nominalmente** `Date.now`, `setTimeout`, `requestAnimationFrame` e animação CSS | **(0-0) — nenhuma fonte achada**, não é (1-0): ninguém localizou página que os liste. A doc lista **outras** causas (state em vez de `useCurrentFrame()`, ordem de render, aleatoriedade fora de `random()`, asset não carregado, `background-image`/`mask-image`) — isso sim é (1-0) | render de uma composição com `transition: opacity 1s` e um `Date.now()` na tela; conferir se o valor varia entre frames. A **regra** de proibi-los é sólida por dedução do modelo; a **citação** não existe |
| O último frame é `durationInFrames - 1` e `Easing.bezier(x1,y1,x2,y2)` é o nome (não `cubicBezier`) | (1-0) | `node -e "console.log(Object.keys(require('remotion').Easing))"` + fixture de off-by-one no último frame |
| Não existe modo "`<TransitionSeries>` paralela" — ela é estritamente sequencial, e paralelismo real é `<Sequence>` irmãs dentro de um `<AbsoluteFill>` | (1-0), ausência | montar duas `<TransitionSeries.Sequence>` e assertar que a segunda só começa depois da primeira; a ausência de "paralela" na doc não fecha por leitura — fonte da suspeita: `docs/pesquisa/R02-remotion-tempo-animacao.md` §3, refutação «Estruturar a timeline numa formidável `<TransitionSeries>` **paralela**» |
| `pushCut()` está disponível a partir da v4.0.500 | (1-0) | `npm ls @remotion/transitions` e `node -e "console.log(Object.keys(require('@remotion/transitions/push-cut')))"` |
| Os identificadores camelCase de 8 das 19 presentations (`bookFlip`, `zoomBlur`, `zoomInOut`, `dissolve`, `ripple`, `crosswarp`, `swap`, `none`) seguem a conversão kebab→camel | (1-0) | `node -e "for (const p of ['book-flip','zoom-blur','zoom-in-out','dissolve','ripple','crosswarp','swap','none']) console.log(p, Object.keys(require('@remotion/transitions/'+p)))"` |
| A partir da v5.0 o default de `premountFor` passa de `0` para `fps` | (1-0) | reler a página de premounting quando `dist-tags.latest` deixar de começar com `4.0.` |
| O 5.0 remove `@remotion/media-parser` e `@remotion/webcodecs` (substituídos por Mediabunny) | (1-0) | reler a página de migração 5.0 a cada release candidate |
| O campo `license` do npm é inconsistente entre pacotes do mesmo monorepo | (1-0) | `for p in remotion @remotion/sfx @remotion/effects; do echo -n "$p "; curl -s "https://registry.npmjs.org/$p/latest" \| jq -r .license; done` |
| O critério de contagem **muda** entre o `LICENSE.md` vigente (conta *empregados da organização*) e os Terms que entram em vigor no 5.0 (contam *pessoal que opera o software*) | (1-1) EM DISPUTA — os dois textos sucedem-se no tempo mas **coexistem hoje**, porque o instalado é 4.0.x e a página pública de Terms já descreve o regime 5.0 | abrir `LICENSE.md` e `/docs/license/terms` lado a lado e comparar palavra a palavra. **Não é bloqueio aqui**: as duas leituras convergem sob a categoria *an individual*, que é a registrada em `ADR-0003` |
| Gerar código Remotion com LLM em nome do usuário é permitido; receber `.tsx` de terceiro para renderizar não é | (1-0) | nenhum comando fecha. **Não escale hoje**: só morde se o programa passar a aceitar composição de terceiro — evento de `AB-950`, não pergunta em aberto |
| `npx remotion render` e `<Player>` contam como *automation* para fins de tier | (1-0) | nenhum comando fecha, e é **moot sob `D2 — tier: nenhum`**. Instrumentar contagem de renders continua valendo por outro motivo (custo e regressão), não por licença |
| Enquadramento de tier para render local automatizado de baixo volume | (1-1) EM DISPUTA na FAQ | a contradição é **interna** à FAQ oficial e permanece verdadeira como fato; **não é lacuna deste programa** — `ADR-0003` fechou por categoria de uso e não por volume. Só volta a importar se `AB-950` virar |

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
