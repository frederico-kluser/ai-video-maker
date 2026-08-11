# R02 — Remotion: modelo temporal, spring, interpolate, Series e transições

**Escopo desta pesquisa:** fecha a semântica temporal do Remotion (frame como única fonte de tempo),
os defaults documentados de `spring()`/`interpolate()`, a diferença operacional entre `<Sequence>`,
`<Series>` e `<TransitionSeries>`, o catálogo completo de presentations/timings de
`@remotion/transitions` e as regras de determinismo de render. **Não** responde: performance de
render, `@remotion/media` / codecs, Player embutido, Lambda, licenciamento comercial do Remotion
(outro cluster) nem integração com Manim.

**Versão de referência de todos os claims:** `remotion@4.0.507` e `@remotion/transitions@4.0.507`
(`latest` no registry npm em **2026-08-10**). Claims marcados "v5.0" descrevem mudanças de default
já anunciadas na doc mas ainda não vigentes em 4.0.x.

**Nota metodológica sobre o placar (leia antes de julgar os rótulos):** este é um domínio de
**fornecedor único**. Existem exatamente três domínios primários independentes possíveis —
`remotion.dev` (prosa), `github.com`/`raw.githubusercontent.com` (código-fonte) e
`registry.npmjs.org` (metadado de pacote publicado). Pela regra "duas páginas do mesmo domínio =
uma fonte", o teto prático para um fato de API é **3-0**, e só quando o npm carrega o fato
(existência de export, versão). Fatos que só existem na prosa + no código fecham em **2-0 =
PROVÁVEL**, e isso aqui é forte, não fraco: significa "a doc afirma **e** o código implementa".
Atenção a uma armadilha que evitei: `raw.githubusercontent.com/.../packages/docs/docs/*.mdx` é
**o mesmo artefato** que a página em `remotion.dev` — servi-lo de outro domínio **não** cria
segunda fonte, e não foi contado como tal.

---

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R02-01 | Em `remotion@4.0.507` os defaults do config de `spring()` são `mass: 1`, `damping: 10`, `stiffness: 100`, `overshootClamping: false`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/spring |
| R02-02 | `spring()` também aceita `from` (default `0`), `to` (default `1`), `durationInFrames`, `durationRestThreshold`, `delay` e `reverse`, todos opcionais e sem default numérico exceto `from`/`to`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/spring |
| R02-03 | O default documentado de `durationRestThreshold` é `0.005`, e é o mesmo valor em `spring()`, `measureSpring()` (lá chamado `threshold`) e `springTiming()`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/transitions/timings/springtiming |
| R02-04 | `measureSpring({fps, config, threshold})` existe, retorna o número de frames até a mola assentar, e sua implementação é um `while` **sem teto de iteração** — threshold muito baixo + mola muito lenta pode travar o processo. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/measure-spring.ts |
| R02-05 | `pushCut()` **existe de fato** em `@remotion/transitions` (subpath `./push-cut`), não é invenção do panorama. | (3-0) | CONFIRMADO | https://registry.npmjs.org/@remotion/transitions/latest |
| R02-06 | `pushCut()` está disponível **a partir da v4.0.500** — ou seja, qualquer pin de Remotion abaixo disso não tem o efeito. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/transitions/presentations/push-cut |
| R02-07 | `@remotion/transitions@4.0.507` embarca exatamente **19** presentations built-in (lista completa no detalhe). | (3-0) | CONFIRMADO | https://registry.npmjs.org/@remotion/transitions/latest |
| R02-08 | `cube()` é documentado no site mas **não** vem em `@remotion/transitions`: é o pacote separado e **pago** `@remotion-dev/cube-presentation`. | (3-0) | CONFIRMADO | https://www.remotion.dev/docs/transitions/presentations/cube |
| R02-09 | Existem exatamente **dois** timings oficiais exportados — `linearTiming()` e `springTiming()` — mais a rota "custom". | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/index.ts |
| R02-10 | O helper oficial de duração é o próprio objeto de timing: `TransitionTiming = { getDurationInFrames({fps}), getProgress({frame, fps}) }`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/types.ts |
| R02-11 | A duração total de uma `<TransitionSeries>` é `Σ(durationInFrames das Sequences) − Σ(duração das Transitions)`; a transição consome frames dos dois lados. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/transitions/transitionseries |
| R02-12 | O `presentation` de `<TransitionSeries.Transition>` é **opcional** e cai em `slide()` quando omitido. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/TransitionSeries.tsx |
| R02-13 | Uma transição não pode ser mais longa que a Sequence adjacente; o runtime lança erro nomeando exatamente esse caso. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/TransitionSeries.tsx |
| R02-14 | `premountFor` e `postmountFor` existem, default `0` em 4.0.x, e são suportados em `<Sequence>`, `<Series.Sequence>` e `<TransitionSeries.Sequence>`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/Sequence.tsx |
| R02-15 | A partir da v5.0 o default de `premountFor` muda de `0` para `fps` (1 segundo) — premount passa a ser automático e opt-out via `premountFor={0}`. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/player/premounting |
| R02-16 | `layout="none"` existe e é válido em `<Sequence>`/`<Series.Sequence>` (default `absolute-fill`), mas é **incompatível com `style`, com `ref` e com premount**, e é deprecated + throw a partir da 5.0.0 dentro de `<TransitionSeries>`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/Sequence.tsx |
| R02-17 | Em `<Series.Sequence>`, só o **último** filho pode ter `durationInFrames: Infinity`; os demais são validados como duração finita. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/series/index.tsx |
| R02-18 | Os defaults de `interpolate()` são `extrapolateLeft: 'extend'`, `extrapolateRight: 'extend'`, `easing` identidade, `output: 'linear'`; os valores aceitos de extrapolate são `extend \| clamp \| wrap \| identity`. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/interpolate |
| R02-19 | `interpolate()` lança erro se `inputRange` não for estritamente monotônico crescente, se os ranges tiverem tamanhos diferentes, ou se houver valor não-finito. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/interpolate.ts |
| R02-20 | `useCurrentFrame()` é **relativo à `<Sequence>` envolvente** (retorna o frame contado a partir do `from` do pai), não ao timeline absoluto. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/use-current-frame |
| R02-21 | `random(seed)` com `seed: number \| string` é determinístico (mesma seed ⇒ mesmo output, faixa 0–1); `seed: null` desliga o determinismo de propósito. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/random |
| R02-22 | `delayRender(label?, {timeoutInMilliseconds?, retries?})` pausa o render até `continueRender(handle)`; o timeout default é **30 s** e `retries` default `0` (ambas as opções a partir da v4.0.140). | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/delay-render |
| R02-23 | A doc oficial lista como causas de render não-determinístico: animação baseada em state em vez de `useCurrentFrame()`, dependência da ordem de render dos frames, aleatoriedade fora de `random()`, e assets não carregados no momento do screenshot. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/flickering |
| R02-24 | `Easing` expõe `step0, step1, linear, ease, quad, cubic, poly, sin, circle, exp, elastic, back, bounce, bezier, in, out, inOut` — o nome é `bezier(x1,y1,x2,y2)`, **não** `cubicBezier`. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/easing |

---

## 2. Detalhe por claim

### R02-01 — Defaults do config de `spring()`

- **Verdade operacional:** `spring({frame, fps})` sem config já produz um overshoot visível
  (`damping: 10` é pouco amortecido). Toda "entrada hiper-dinâmica" do panorama é obtida mexendo
  em três números e nada mais; não existe preset nomeado oficial.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts | grep -A6 defaultSpringConfig`
- **O que quebra se divergir:** os fixtures de snapshot visual de qualquer card "animação de
  entrada"; e o gate de duração, porque `damping` menor alonga a cauda da mola e muda o retorno de
  `measureSpring()`.
- **Fontes:**
  - https://www.remotion.dev/docs/spring — (primária) tabela de parâmetros com `mass` 1,
    `damping` 10, `stiffness` 100, `overshootClamping` false.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts —
    (primária) o literal em código:
    `const defaultSpringConfig: SpringConfig = { damping: 10, mass: 1, stiffness: 100, overshootClamping: false };`

### R02-02 — Parâmetros adicionais de `spring()` e suas versões

- **Verdade operacional:** `durationInFrames` **estica a curva** para caber num número exato de
  frames (não corta a mola: reparametriza o tempo). `delay` atrasa em frames. `reverse` roda a
  curva ao contrário. `from`/`to` default `0`/`1` — o padrão idiomático é manter `spring()` em 0→1
  e alimentar `interpolate()` com ele.
- **Como reconferir:** abrir https://www.remotion.dev/docs/spring e ler a tabela de props; as
  anotações `<AvailableFrom v="..."/>` estão ao lado de cada uma.
- **O que quebra se divergir:** cards que usam `durationInFrames` em `spring()` para casar mola com
  duração de cena. Se o parâmetro não existisse na versão pinada, a prop seria silenciosamente
  ignorada — falha muda, sem erro de tipo em JS puro.
- **Fontes:**
  - https://www.remotion.dev/docs/spring — (primária) lista `durationInFrames` e
    `durationRestThreshold` como "available from v3.0.27", `delay` "from v3.3.90", `reverse`
    "from v3.3.92".
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/timings/spring-timing.ts —
    (primária) corrobora por uso: repassa `config`, `durationRestThreshold` e `reverse` para
    `spring()`/`measureSpring()`, e monta `const to = options.reverse ? 0 : 1; const from = options.reverse ? 1 : 0;`.
- **Fechamento parcial:** a **existência** dos parâmetros está em 2-0. Os **números de versão**
  (3.0.27 / 3.3.90 / 3.3.92) vêm de uma única fonte — trate-os como indicativos, não como gate.

### R02-03 — `durationRestThreshold` default `0.005`

- **Verdade operacional:** a mola é declarada terminada quando fica dentro de 0,5% do valor de
  destino. Em transição isso corta a cauda e produz um "salto" perceptível no ponto de corte —
  é exatamente o fenômeno que o panorama descreve. **O panorama acertou o número.**
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/measure-spring.ts | grep -n "threshold"`
  → deve mostrar `threshold = 0.005`.
- **O que quebra se divergir:** o cálculo de duração de toda transição com `springTiming()`, porque
  `getDurationInFrames()` delega para `measureSpring({threshold})`. Mudar o threshold muda a
  **duração da transição**, e portanto a duração total da composição — não é ajuste estético, é
  ajuste de timeline.
- **Fontes:**
  - https://www.remotion.dev/docs/transitions/timings/springtiming — (primária) "The default
    `durationRestThreshold` is `0.005` (same as `spring()`)" e "if the animation has progressed
    99.5%, it is considered to be finished".
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/measure-spring.ts —
    (primária) assinatura com `threshold = 0.005` como default de parâmetro.

### R02-04 — `measureSpring()` e o loop sem teto

- **Verdade operacional:** `measureSpring({fps, config, threshold})` devolve **frames até assentar**.
  A implementação roda `while (difference >= threshold)` e depois exige 20 frames consecutivos
  estáveis; **não há cap de iteração nem erro**. Um `damping` muito baixo combinado com
  `durationRestThreshold: 0.001` pode gerar duração absurda ou loop longo no momento em que o
  `<TransitionSeries>` calcula o layout — isto é, **no render, não no runtime do vídeo**.
- **Como reconferir:** `npx tsx -e "import {measureSpring} from 'remotion'; console.log(measureSpring({fps:30, config:{damping:2}, threshold:0.001}))"`
- **O que quebra se divergir:** o gate "render termina em tempo finito". Um card que exponha
  `damping` a um LLM sem piso numérico pode gerar composição que nunca fecha o cálculo.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/measure-spring.ts —
    (primária) `while` não limitado, validação de 20 frames extras, sem throw.
  - https://www.remotion.dev/docs/measure-spring — (primária) "Theoretically, a spring animation
    never ends. There is always a miniscule amount or energy left in the spring that causes tiny
    movements." Confirma o retorno em frames e o default `0.005`.

### R02-05 / R02-06 — `pushCut()` existe, mas só a partir da v4.0.500

- **Verdade operacional:** **o panorama não inventou `pushCut()`.** O efeito existe e é
  literalmente "corte duro com punch-in nas duas cenas e um flash breve no ponto de edição".
  O risco real não é o nome — é a **versão**: é um dos exports mais novos do pacote, e um lockfile
  em qualquer 4.0.4xx não o tem.
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/@remotion/transitions/latest | jq '.version, (.exports | keys)'`
  → deve conter `"./push-cut"`.
  Local: `node -e "console.log(Object.keys(require('@remotion/transitions/push-cut')))"`.
- **O que quebra se divergir:** o card do catálogo de transições e o schema que o LLM preenche.
  Se `pushCut` for oferecido ao LLM e o pin do projeto for < 4.0.500, o import falha em build —
  falha barulhenta, o que é o bom caso. O caso ruim é um schema que aceita a string `"pushCut"` e
  faz fallback silencioso para `slide()`.
- **Opções documentadas** (com defaults, da página oficial): `cutProgress` (`5/11`),
  `outgoingScale` (`1.04`), `incomingStartScale` (`1.04`), `incomingEndScale` (`1.07`),
  `transformOrigin` (`'50% 50%'`), `flashColor` (`'#f5f2ed'`), `flashOpacity` (`0.2`),
  `flashFrames` (`2`), mais `outerEnterStyle`/`outerExitStyle`/`innerEnterStyle`/`innerExitStyle`.
- **Fontes:**
  - https://registry.npmjs.org/@remotion/transitions/latest — (primária) `version: 4.0.507`,
    exports contém `"./push-cut"`.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/presentations/push-cut.tsx —
    (primária) `export const pushCut = (props?: PushCutProps): TransitionPresentation<PushCutProps> => {`
  - https://www.remotion.dev/docs/transitions/presentations/push-cut — (primária) página existe,
    lista os defaults acima e marca `AvailableFrom v="4.0.500"`.
- **Fechamento parcial:** existência = **3-0 CONFIRMADO**. O corte de versão exato (4.0.500) vem
  só da doc → 1-0, verifique contra o release real antes de virar gate.

### R02-07 — As 19 presentations built-in

- **Verdade operacional:** a lista fechada, por subpath de export em 4.0.507, é:
  `fade`, `slide`, `wipe`, `flip`, `clock-wipe`, `book-flip`, `zoom-blur`, `dreamy-zoom`,
  `film-burn`, `linear-blur`, `zoom-in-out`, `none`, `iris`, `dissolve`, `ripple`, `crosswarp`,
  `cross-zoom`, `swap`, `push-cut`. São 19. Não há `cube` (ver R02-08).
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/@remotion/transitions/latest | jq -r '.exports | keys[]' | grep -v -e '^\.$' -e package.json | wc -l` → `19`.
- **O que quebra se divergir:** o enum do schema de transições que o LLM preenche. Este é o
  artefato mais barato de errar e mais caro de descobrir: um nome a mais no enum vira ImportError
  em runtime de render, um a menos vira capacidade perdida silenciosamente.
- **Fontes:**
  - https://registry.npmjs.org/@remotion/transitions/latest — (primária) exports map publicado.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/package.json —
    (primária) mesmo conjunto de 19 subpaths, `version: 4.0.507`; e o diretório
    `src/presentations/` tem 20 arquivos, sendo `upload-element-image.ts` um utilitário, não uma
    presentation (20 − 1 = 19, bate).
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/sidebars.ts —
    (primária) os ids de doc `transitions/presentations/*` cobrem os mesmos 19 **mais** `cube`,
    `custom`, `custom-html-in-canvas` e `audio-transitions`.
- **Ressalva honesta sobre os nomes camelCase:** os **subpaths** estão em 3-0. Os identificadores
  exportados que eu li literalmente no código ou na doc são `pushCut`, `slide`, `fade`, `wipe`,
  `flip`, `clockWipe`, `iris`, `crossZoom`, `dreamyZoom`, `filmBurn`, `linearBlur`. Os restantes
  (`bookFlip`, `zoomBlur`, `zoomInOut`, `dissolve`, `ripple`, `crosswarp`, `swap`, `none`) eu
  **infiro** pela convenção kebab→camel e **não** confirmei um a um → tratar como NÃO VERIFICADO
  individualmente (ver LEDGER-SEED LS-02).

### R02-08 — `cube()` não vem no pacote e é pago

- **Verdade operacional:** a doc oficial tem uma página `cube()` na mesma árvore das outras
  presentations, o que induz a acreditar que basta importar de `@remotion/transitions`. Não basta:
  o import documentado é `import { cube } from "@remotion-dev/cube-presentation";` e a página diz
  textualmente que "This is a paid item which you can buy here".
- **Como reconferir:**
  `curl -s https://registry.npmjs.org/@remotion/transitions/latest | jq -r '.exports | keys[]' | grep -c cube` → `0`.
- **O que quebra se divergir:** o card de catálogo de transições **e** o card de licenciamento.
  Um LLM que leu a doc e escreveu `cube()` produz um build quebrado; pior, se alguém "resolver"
  instalando o pacote, entra uma dependência paga no projeto sem passar pelo dono.
- **Fontes:**
  - https://www.remotion.dev/docs/transitions/presentations/cube — (primária) import de
    `@remotion-dev/cube-presentation`, nota de item pago.
  - https://registry.npmjs.org/@remotion/transitions/latest — (primária) ausência de `./cube`
    no exports map. **Evidência positiva de ausência**: o exports map é a lista fechada de tudo
    que o pacote expõe.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/package.json —
    (primária) mesma ausência no repositório.

### R02-09 — Só dois timings

- **Verdade operacional:** não existe "easeTiming", "cubicTiming" ou similar. Para qualquer curva
  fora de linear/mola, o caminho é `linearTiming({durationInFrames, easing})` com um `Easing`, ou
  escrever um `TransitionTiming` próprio (rota "custom").
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/index.ts | grep -i timing`
- **O que quebra se divergir:** o enum de `timing` no schema. `linearTiming` exige
  `durationInFrames` (é o único jeito de fixar duração exata de transição); `springTiming` **deriva**
  a duração — essa assimetria é o que o gerador precisa saber.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/index.ts —
    (primária) exporta `linearTiming` de `./timings/linear-timing.js` e `springTiming` de
    `./timings/spring-timing.js`, e nada mais de timing.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/docs/sidebars.ts —
    (primária) ids `transitions/timings/springtiming`, `transitions/timings/lineartiming`,
    `transitions/timings/custom` — três entradas, duas funções.
  - `linearTiming()` — parâmetros documentados: `durationInFrames` (obrigatório) e `easing?`
    (opcional, "An easing function, see Easing"). A doc **não** publica defaults explícitos de
    tipo para esses campos.

### R02-10 — O helper oficial de duração é `getDurationInFrames()` no timing

- **Verdade operacional:** **existe helper oficial e ele mora no objeto de timing, não numa função
  solta.** Qualquer timing satisfaz
  `{ getDurationInFrames: ({fps}) => number; getProgress: ({frame, fps}) => number }`.
  Exemplo da doc: `springTiming({config: {damping: 200}}).getDurationInFrames({fps: 30}) // 23`.
  Isto é o que permite ao gerador **calcular a timeline antes de renderizar**, em vez de adivinhar.
- **Como reconferir:**
  `node -e "const {springTiming}=require('@remotion/transitions'); console.log(springTiming({config:{damping:200}}).getDurationInFrames({fps:30}))"`
- **O que quebra se divergir:** o cálculo de `durationInFrames` da `<Composition>`. Sem esse
  helper, todo card que monta timeline precisa hardcodar a duração da transição — e aí
  `springTiming` (que é derivada) fica impossível de casar.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/types.ts —
    (primária) `export type TransitionTiming = { getDurationInFrames: (options: {fps: number}) => number; getProgress: (options: {frame: number; fps: number}) => number; };`
  - https://www.remotion.dev/docs/transitions/transitionseries — (primária) mostra a chamada
    `springTiming({config: {damping: 200}}).getDurationInFrames({fps: 30})` retornando `23`.

### R02-11 — Aritmética da duração total da `<TransitionSeries>`

- **Verdade operacional:** a transição **não é aditiva, é subtrativa**. Durante ela as duas cenas
  são renderizadas simultaneamente, e o total encurta pelo tamanho da transição:
  **`total = Σ sequences − Σ transitions`**.
  Exemplo literal da doc: sequences de 40, 60 e 90 frames com transições de 30 e 45 frames →
  `(40 + 60 + 90) − 30 − 45 = 115`.
  `<TransitionSeries.Overlay>` (a partir da v4.0.415) é a exceção: **não** encurta nada.
- **Como reconferir:** montar uma `<TransitionSeries>` de duas cenas de 40 e 60 com
  `linearTiming({durationInFrames: 30})` e confirmar que a composição precisa de `durationInFrames={70}`.
- **O que quebra se divergir:** o card "calcular duração da composição a partir do roteiro" e todo
  fixture de duração. Errar o sinal aqui (somar em vez de subtrair) produz vídeo com cauda preta
  no fim — falha visual, não erro de execução, portanto **não** pega em teste de fumaça.
- **Fontes:**
  - https://www.remotion.dev/docs/transitions/transitionseries — (primária) "During the transition,
    both scenes are rendered simultaneously and the total duration is shortened by the transition
    length", com os dois exemplos numéricos (`60 + 40 − 30 = 70` e `190 − 30 − 45 = 115`).
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/TransitionSeries.tsx —
    (primária) o código que faz o offset das sequences e valida o encaixe.
- **Nota de contagem:** eu **não** contei `packages/docs/docs/transitions/transitionseries.mdx`
  como segunda fonte — é o mesmo artefato da página, servido do GitHub.

### R02-12 / R02-13 — Default `slide()` e as restrições de arranjo

- **Verdade operacional:** `presentation` é **opcional**. Omitir não dá "corte seco" — dá `slide()`.
  Se o roteiro quiser corte seco, o nome é `none()` (ou `pushCut()` para corte com punch).
  Restrições verificadas no código e na doc: duas `<Transition>` não podem ser adjacentes;
  transição não pode ser mais longa que a Sequence vizinha; transição e overlay não podem ser
  adjacentes; tem que haver Sequence antes/depois.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/TransitionSeries.tsx | grep -n "?? slide()"`
- **O que quebra se divergir:** o validador de roteiro→timeline. As mensagens literais para casar
  em teste são:
  `"A <TransitionSeries.Transition /> component must not be followed by another <TransitionSeries.Transition /> component"`
  e
  `"The duration of a <TransitionSeries.Sequence /> must not be shorter than the duration of the next <TransitionSeries.Transition />."`
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/TransitionSeries.tsx —
    (primária) `const nextPresentation = next.props.presentation ?? slide();` e as mensagens de erro.
  - https://www.remotion.dev/docs/transitions/transitionseries — (primária) `presentation?` com
    default `slide()`; lista as regras de arranjo.

### R02-14 / R02-15 / R02-16 — Premount, postmount e `layout`

- **Verdade operacional:** premount = montar a cena **antes** de ela aparecer para dar tempo dos
  assets carregarem, com `opacity: 0` e `pointer-events: none` no container. Em 4.0.x o default é
  `0` (desligado). Três armadilhas que o código confirma:
  1. **premount exige container** → `layout="none"` + `premountFor`/`postmountFor` **lança erro**;
  2. `layout="none"` + `style` **lança erro**;
  3. `layout="none"` + `ref` **lança erro**.
  E dentro de `<TransitionSeries>` a doc é categórica: "`layout="none"` is deprecated and throws
  from Remotion 5.0.0 on. Transition scenes must stay absolutely positioned."
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/Sequence.tsx | grep -n 'layout="none"'`
- **O que quebra se divergir:** o card de "template de cena". Se o gerador emitir `layout="none"`
  como default (tentador, porque parece "menos mágica"), ele perde premount e quebra a
  `<TransitionSeries>` inteira na migração para 5.0.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/Sequence.tsx —
    (primária) `const {layout = 'absolute-fill'} = other;`, `premountFor`/`postmountFor` default `0`,
    e as três mensagens de erro citadas.
  - https://www.remotion.dev/docs/player/premounting — (primária) semântica do premount,
    `opacity: 0` / `pointer-events: none`, suporte em `<Sequence>`, `<Series.Sequence>` e
    `<TransitionSeries.Sequence>`, e a mudança de default na v5.0.
  - https://www.remotion.dev/docs/sequence — (primária) tabela de props com versões
    (`premountFor` v4.0.140+, `postmountFor` v4.0.340+, `freeze` v4.0.476+, `trimBefore` v4.0.482+,
    `showInTimeline` v4.0.110+). **Mesmo domínio da anterior → conta como uma fonte.**
- **Fechamento parcial:** o comportamento em 4.0.x está em 2-0. A **mudança de default na v5.0**
  é anúncio de roadmap do fornecedor, fonte única → 1-0, não usar como gate.

### R02-17 — `<Series>` vs `<Sequence>` vs `<TransitionSeries>`: a diferença operacional

- **Verdade operacional:** a distinção que importa para o gerador:
  - **`<Sequence from={} durationInFrames={}>`** — posicionamento **absoluto** no timeline.
    Você calcula o `from`. Reordenar cenas = recalcular tudo à mão.
  - **`<Series>`** — empilha filhos **consecutivamente** e calcula o `from` por você; `offset`
    negativo cria sobreposição manual. Só o **último** `<Series.Sequence>` pode ter
    `durationInFrames: Infinity`. O wrapper externo do `<Series>` é um `<Sequence layout="none">`
    (não introduz `AbsoluteFill`), enquanto cada `<Series.Sequence>` herda o default
    `absolute-fill`.
  - **`<TransitionSeries>`** — como `<Series>`, **mas** os vizinhos se sobrepõem pela duração da
    transição e o total encurta (R02-11). É o único dos três que tem `.Transition` e `.Overlay`.
  Regra prática para o roadmap: **nunca calcule `from` à mão** se houver alternativa; use `<Series>`
  quando não há transição e `<TransitionSeries>` quando há.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/series/index.tsx | grep -n -A4 "Infinity"`
- **O que quebra se divergir:** o card do "compilador de roteiro→JSX". Misturar os três modelos no
  mesmo gerador é a fonte clássica de cena duplicada/faltando um frame.
- **Fontes:**
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/series/index.tsx —
    (primária) o wrapper `<Sequence layout="none" name="<Series>">` e a validação
    `if (index !== childrenLength - 1 || durationInFrames !== Infinity) { validateDurationInFrames(...) }`.
  - https://www.remotion.dev/docs/series — (primária) "Only the last `<Series.Sequence />` instance
    is allowed to have `Infinity` as a duration, all previous one must have a positive integer";
    `offset` positivo atrasa e negativo sobrepõe.

### R02-18 / R02-19 — `interpolate()`: defaults e erros

- **Verdade operacional:** **o default de extrapolação é `extend`, não `clamp`.** Fora do
  `inputRange` o valor continua crescendo linearmente — é assim que se produz opacidade negativa e
  escala explodida sem nenhum erro. O panorama está certo ao insistir em `clamp` explícito nas duas
  pontas; é a instrução mais valiosa deste cluster para o gerador de código.
  A assinatura é `interpolate(input, inputRange, outputRange, options?)`, e `options` aceita
  `easing` (função **ou array** de funções, uma por segmento), `extrapolateLeft`,
  `extrapolateRight`, `output` e `posterize`.
- **Como reconferir:**
  `node -e "const {interpolate}=require('remotion'); console.log(interpolate(200,[0,100],[0,1]))"`
  → `2` se o default for `extend`; `1` se fosse `clamp`.
- **O que quebra se divergir:** a regra de lint/skill "toda chamada de `interpolate` carrega
  `extrapolateLeft` e `extrapolateRight` explícitos". Se o default fosse `clamp`, essa regra seria
  ruído; como é `extend`, ela é um gate de correção.
- **Erros literais para casar em teste:**
  `"inputRange must be strictly monotonically increasing but got [...]"`,
  `"inputRange (N) and outputRange (M) must have the same length"`,
  `"inputRange must contain only finite numbers, but got [...]"`,
  `"Cannot interpolate an input which is not a number"`.
- **Fontes:**
  - https://www.remotion.dev/docs/interpolate — (primária) valores aceitos `extend | clamp | wrap |
    identity`, default `extend` nos dois lados, `easing` default identidade, `output` default
    `'linear'` (com a alternativa `'perceptual-scale'`), `posterize` sem default.
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/interpolate.ts —
    (primária) o tipo `InterpolateOptions` e as mensagens de erro acima, verbatim do código.
- **Ressalva:** `output: 'perceptual-scale'` e `posterize` apareceram na leitura da doc e do tipo,
  mas eu **não** li a semântica deles em página dedicada → não usar em card sem reconferir (LS-04).

### R02-20 — `useCurrentFrame()` é relativo à Sequence

- **Verdade operacional:** dentro de uma `<Sequence from={90}>`, `useCurrentFrame()` retorna `0` no
  frame absoluto 90. Isso é o que torna cenas **reutilizáveis e movíveis**: a cena não sabe onde
  está no vídeo. Consequência prática: para obter o frame absoluto, a doc manda chamar
  `useCurrentFrame()` no componente de topo e **passar como prop**. Não existe hook de frame
  absoluto documentado nesta página.
- **Como reconferir:** https://www.remotion.dev/docs/use-current-frame — procurar "will return the
  frame relative to when the parent starts".
- **O que quebra se divergir:** todo card de "componente de cena". Se o gerador assumir frame
  absoluto dentro da cena, cada cena depois da primeira começa animada pela metade — e o bug só
  aparece na cena 2+, nunca no preview isolado da cena 1. Falso verde clássico.
- **Fontes:**
  - https://www.remotion.dev/docs/use-current-frame — (primária) frames 0-indexed; "If the component
    you are writing is inside a component with a `from` prop, `useCurrentFrame()` will return the
    frame relative to when the parent starts".
- **Por que 1-0:** não encontrei um segundo domínio primário afirmando a relatividade. O
  comportamento é trivialmente testável na máquina → vira LS-01, não card cego.

### R02-21 — `random()` é a API oficial de aleatoriedade determinística

- **Verdade operacional:** `random(seed)` com `seed: number | string` retorna sempre o mesmo valor
  em `[0, 1)` para a mesma seed. `Math.random()` quebra porque o Remotion renderiza em **múltiplos
  processos**, reabrindo a página várias vezes — cada thread sorteia diferente e o mesmo elemento
  pisca de frame para frame. `random(null)` é a saída de emergência para aleatoriedade real.
  Padrão idiomático para partículas: `random(\`particle-${i}\`)`.
- **Como reconferir:** https://www.remotion.dev/docs/random.
- **O que quebra se divergir:** a regra de skill "proibido `Math.random()` no diretório de
  composições" e o gate de determinismo (render duas vezes, comparar hash dos frames).
- **Fontes:**
  - https://www.remotion.dev/docs/random — (primária) "If the seed is the same, the output is
    always the same"; seed `number | string | null`; explicação do multi-thread; menciona que há
    aviso de ESLint contra `Math.random()`.
- **Por que 1-0:** um único domínio. O determinismo em si é verificável na máquina → LS-01.

### R02-22 — `delayRender()` / `continueRender()`

- **Verdade operacional:** é o mecanismo para **trabalho assíncrono antes do screenshot do frame**:
  buscar dados, medir texto depois da fonte carregar, preparar um asset. `delayRender(label?, opts?)`
  devolve um handle; `continueRender(handle)` libera. **Default de 30 s**; estourar falha o render
  com mensagem tipo `"A delayRender() was called but not cleared after 28000ms."`. Para falha
  irrecuperável use `cancelRender(err)`, que cancela todos os `delayRender()` pendentes de uma vez.
  Opções `timeoutInMilliseconds` e `retries` (default `0`) a partir da v4.0.140.
- **Como reconferir:** https://www.remotion.dev/docs/delay-render.
- **O que quebra se divergir:** o card de integração Manim/asset externo. Se um `.webm` do Manim é
  gerado ou carregado sob demanda, é aqui que a espera tem que morar — **não** em `useEffect` sem
  `delayRender`, que renderiza o frame antes do asset chegar.
- **Fontes:**
  - https://www.remotion.dev/docs/delay-render — (primária) assinatura, opções, default de 30 s,
    comportamento de timeout e `cancelRender()`.
- **Por que 1-0:** domínio único; o default de 30 s é fácil de verificar na máquina → LS-03.

### R02-23 — O que a doc oficial cita como quebra de determinismo

- **Verdade operacional:** a página oficial de flickering atribui não-determinismo a: animação
  baseada em **state** em vez de `useCurrentFrame()`; componente que não renderiza igual em chamadas
  repetidas; **dependência da ordem de render dos frames** (o Remotion renderiza frames fora de
  ordem, em paralelo); aleatoriedade fora de `random()`; e screenshot antes dos assets carregarem.
  Mitigações citadas: derivar tudo de `useCurrentFrame()`; usar os componentes que esperam asset
  (`<Video>`, `<Audio>`, `<Img>`, `<OffthreadVideo>`, `<IFrame>`, `<Gif>`); `delayRender()` para
  dados; garantir fonte carregada antes de medir texto; **evitar `background-image` e `mask-image`**;
  `--concurrency=1` como último recurso (mais lento e ainda sem garantia).
- **Como reconferir:** https://www.remotion.dev/docs/flickering.
- **O que quebra se divergir:** o gate de determinismo do pipeline e a lista de proibições da skill.
- **Fontes:**
  - https://www.remotion.dev/docs/flickering — (primária) causas e correções acima; menciona também
    que múltiplas tags `<Html5Video>` podem causar stutter.
- **Fechamento parcial explícito — leia com atenção:** a pergunta original listava
  `Date.now`, `setTimeout`, `requestAnimationFrame`, animações CSS e `autoplay` de vídeo. Desses,
  **eu confirmei em fonte primária apenas** "state em vez de frame", "ordem de render" e
  "aleatoriedade". `Date.now` / `setTimeout` / `rAF` / CSS `animation`/`transition` são
  **consequência direta** do modelo (o Remotion tira screenshot por frame; não passa tempo de
  parede entre frames), e apareceram em resultados de busca **secundários** — mas eu **não** achei
  uma página oficial que os liste nominalmente. Portanto: a **regra** de proibi-los é sólida por
  dedução do modelo, o **claim de que a doc os proíbe nominalmente** é NÃO VERIFICADO. Ver LS-05.

### R02-24 — `Easing` e a diferença frame-based × time-based

- **Verdade operacional:** o objeto `Easing` traz `step0, step1, linear, ease, quad, cubic, poly(n),
  sin, circle, exp, elastic(bounciness), back(s), bounce, bezier(x1,y1,x2,y2)` e os combinadores
  `in(fn)`, `out(fn)`, `inOut(fn)`. **O nome é `bezier`, não `cubicBezier`.** Uso típico:
  `interpolate(frame, [0, 30], [0, 1], {easing: Easing.bezier(0.8, 0.22, 0.96, 0.65), extrapolateRight: 'clamp'})`.
  Sobre frame-based × time-based: a doc fundamental estabelece que o vídeo é "a function of images
  over time", que o primeiro frame é `0` e o último é `durationInFrames - 1`, e que a duração em
  segundos é `durationInFrames / fps`. **Toda conversão tempo→frame no gerador deve ser
  `segundos * fps`, e o índice do último frame nunca é `durationInFrames`.**
- **Como reconferir:** https://www.remotion.dev/docs/easing e https://www.remotion.dev/docs/the-fundamentals.
- **O que quebra se divergir:** o card do conversor "roteiro em segundos → frames" e qualquer
  off-by-one de último frame (que produz um frame preto no fim, invisível em preview).
- **Fontes:**
  - https://www.remotion.dev/docs/easing — (primária) lista de métodos estáticos; só existe
    `bezier`, descrito como "a cubic bezier curve"; a leitura também trouxe `Easing.spring(config?)`,
    que eu **não** corroborei em segunda fonte.
  - https://www.remotion.dev/docs/the-fundamentals — (primária, **mesmo domínio → não soma placar**)
    "A video's first frame is `0` and its last frame is `durationInFrames - 1`" e
    "This {width}x{height}px video is {durationInFrames / fps} seconds long".

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "aplicando apresentações como **pushCut()**, slide(), wipe() ou flip()" (§47) | **CONFIRMADO, com ressalva de versão** | `pushCut()` existe mesmo, subpath `./push-cut`. Mas só **a partir da v4.0.500** — é dos exports mais novos. Pin abaixo disso não tem. A suspeita de que o nome era alucinado estava errada. | https://registry.npmjs.org/@remotion/transitions/latest |
| "configurar o parâmetro durationRestThreshold. Por predefinição situado nos **0.005** … A redução do limiar para **0.001**" (§47) | **CONFIRMADO quanto ao default; a recomendação é opinião do fornecedor** | `0.005` é o default real, verificado no código (`threshold = 0.005`) e na doc. O `0.001` é literalmente o que a doc do `springTiming()` recomenda — mas é recomendação, não fato, e tem custo: `measureSpring()` roda um `while` **sem teto**, então threshold menor alonga a transição e o cálculo. | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/measure-spring.ts |
| "A `<Series>` empilha cenas consecutivamente … a evolução natural é o `@remotion/transitions` que disponibiliza a `<TransitionSeries>`. Esta interface permite **sobreposições (overlays) ativas**" (§46) | **PARCIAL** | Empilhamento consecutivo e sobreposição estão certos, mas o panorama funde dois conceitos distintos. Sobreposição de transição **encurta** o total (`Σ sequences − Σ transitions`). `<TransitionSeries.Overlay>` é outra coisa, existe desde a v4.0.415 e **não altera a duração**. Confundir os dois erra a duração da composição. | https://www.remotion.dev/docs/transitions/transitionseries |
| Implica que basta escolher uma presentation da doc do site | **REFUTADO para `cube()`** | `cube()` tem página na mesma árvore de doc das outras, mas **não está** no exports map de `@remotion/transitions` — é o pacote separado e **pago** `@remotion-dev/cube-presentation`. Evidência positiva de ausência: o exports map é a lista fechada do que o pacote expõe. | https://www.remotion.dev/docs/transitions/presentations/cube |
| "a aplicação rigorosa do extrapolateLeft: 'clamp' e extrapolateRight: 'clamp' … assegura que os cálculos não transbordem" (§41) | **CONFIRMADO e subestimado** | Está certo e é mais importante do que o panorama sugere: o default **não** é `clamp`, é **`extend`**. Sem clamp explícito, `interpolate(200,[0,100],[0,1])` devolve `2`, sem erro nenhum. Isso é gate, não estilo. | https://www.remotion.dev/docs/interpolate |
| "Estruturar a timeline numa formidável `<TransitionSeries>` **paralela**" (§171) | **NÃO VERIFICADO / provável erro conceitual** | Não existe modo "paralelo" de `<TransitionSeries>` na doc. Ela é estritamente **sequencial**; a única sobreposição é a da própria transição (e do `Overlay`). Paralelismo de fato se faz com `<Sequence>` irmãs dentro de um `<AbsoluteFill>`. Não achei nada que sustente "paralela". | https://www.remotion.dev/docs/transitions/transitionseries |
| "funções nativas de temporização do browser como **setTimeout**, que quebram o determinismo" (§16) | **CORRETO por dedução; não confirmado nominalmente na doc** | A conclusão é certa (o render é screenshot por frame, sem tempo de parede correndo), mas eu **não** achei página oficial que liste `setTimeout` nominalmente. A página de flickering cita state, ordem de render, aleatoriedade e assets. Não transforme "a doc proíbe setTimeout" em citação. | https://www.remotion.dev/docs/flickering |

---

## 4. Armadilhas (falso verde deste domínio)

- **`interpolate()` sem clamp parece funcionar** → porque no intervalo testado o valor está dentro
  do range; o default `extend` só transborda **fora** da janela → fica vermelho se o teste de
  fixture cobrir `frame < inputRange[0]` e `frame > inputRange[n-1]` e assertar o valor.
- **A cena 1 renderiza perfeita no preview isolado** → `useCurrentFrame()` é relativo à Sequence,
  então o bug de "assumi frame absoluto" só aparece a partir da cena 2 → fica vermelho se o gate
  renderizar sempre a composição **inteira**, nunca a cena isolada, ao validar timing.
- **A `<TransitionSeries>` renderiza sem erro e o vídeo tem cauda preta no fim** → o Remotion não
  reclama de `durationInFrames` da `<Composition>` maior que o conteúdo; a subtração das transições
  foi esquecida → fica vermelho se houver assert de que o último frame não é uniforme/preto, ou se
  a duração for calculada por `getDurationInFrames({fps})` em vez de à mão.
- **`presentation` omitido "dá corte seco"** → dá `slide()`, que é uma animação visível → fica
  vermelho se o schema tornar `presentation` **obrigatório** no gerador, mesmo sendo opcional na API.
- **Render de teste passa com `--concurrency=1`** → concorrência 1 mascara justamente as quebras de
  determinismo que a doc descreve (e a própria doc diz que nem assim há garantia) → fica vermelho se
  o gate de determinismo rodar com concorrência **default** e comparar hash de frames entre duas
  execuções.
- **`Math.random()` "funciona" no Studio** → o Studio é um processo só; o piscar só nasce no render
  multi-processo → fica vermelho com lint proibindo `Math.random()` **mais** o teste de dois renders
  com hash igual.
- **`layout="none"` parece mais limpo e o preview fica igual** → mas desliga premount e é deprecated
  + throw dentro de `<TransitionSeries>` a partir da 5.0 → fica vermelho se houver grep proibindo
  `layout="none"` dentro do diretório de composições.
- **`durationRestThreshold: 0.001` "melhora a transição"** → e simultaneamente alonga a transição,
  mudando a duração total da composição sem ninguém perceber → fica vermelho se a duração total for
  um fixture assertado, não um valor derivado silenciosamente.
- **Um catálogo de transições copiado da doc do site** → inclui `cube()`, que é pacote pago
  separado → fica vermelho se o enum for gerado a partir do `exports` do `package.json` instalado,
  não da doc.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-01 | `useCurrentFrame()` é mesmo relativo à Sequence e `random(seed)` é mesmo estável entre dois renders completos nesta máquina? | Assumir sim (doc). | Renderizar duas vezes a mesma composição com `<Sequence from={90}>` e partículas com `random()`; comparar hash frame a frame: `npx remotion render Comp out1.mp4 && npx remotion render Comp out2.mp4 && cmp out1.mp4 out2.mp4` | O gate de determinismo inteiro e o card de "componente de cena reutilizável". |
| LS-02 | Quais são os identificadores camelCase **exatos** das 8 presentations que não li literalmente (`bookFlip`, `zoomBlur`, `zoomInOut`, `dissolve`, `ripple`, `crosswarp`, `swap`, `none`)? | Assumir kebab→camel. | `node -e "for (const p of ['book-flip','zoom-blur','zoom-in-out','dissolve','ripple','crosswarp','swap','none']) console.log(p, Object.keys(require('@remotion/transitions/'+p)))"` | O enum de transições do schema do LLM — um nome errado vira ImportError em tempo de render. |
| LS-03 | O timeout default de `delayRender()` (30 s) é suficiente para o asset do Manim nesta máquina? | Assumir que não; passar `timeoutInMilliseconds` explícito. | Cronometrar a geração/carga do `.webm` do Manim e comparar com 30000. | O card de integração Manim→Remotion: estouro derruba o render inteiro, não só a cena. |
| LS-04 | `output: 'perceptual-scale'` e `posterize` em `interpolate()` — qual a semântica exata e valem a pena para escala? | Não usar até verificar. | Ler a doc dedicada e comparar `interpolate(f,[0,30],[1,2],{output:'perceptual-scale'})` com o `'linear'`. | Nada hoje; vira card só se a verificação passar. |
| LS-05 | Animação CSS / `setTimeout` / `rAF` / `Date.now()` produzem de fato saída quebrada neste pipeline, ou o Chromium headless os congela de forma inofensiva? | Assumir que quebram; proibir por lint. | Render de uma composição com `transition: opacity 1s` e um `Date.now()` na tela; conferir se o valor varia entre frames. | A lista de proibições da skill. Se for inofensivo, a regra é ruído; se quebrar, é gate. |
| LS-06 | Com `durationRestThreshold: 0.001` e o `damping` que o projeto usar, quantos frames o `springTiming()` realmente devolve? | Medir antes de fixar. | `node -e "const {springTiming}=require('@remotion/transitions'); console.log(springTiming({config:{damping:200},durationRestThreshold:0.001}).getDurationInFrames({fps:30}))"` | A duração total de toda composição com transição por mola. |
| LS-07 | `measureSpring()` com o config do projeto termina em tempo aceitável (loop sem teto)? | Impor piso de `damping` no schema. | Cronometrar `measureSpring({fps:30, config:{damping:2}, threshold:0.001})`. | O gate "render termina"; um LLM livre para escolher `damping` pode travar o cálculo. |
| LS-08 | Qual versão exata de `remotion` e `@remotion/transitions` fica no lockfile deste projeto? | Pinar ≥ 4.0.500 se `pushCut()` entrar no catálogo. | `npm ls remotion @remotion/transitions` | O catálogo de transições e todo claim deste arquivo, que é ancorado em 4.0.507. |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| Pinar `remotion` em 4.0.507 (ou ≥4.0.500) para ter `pushCut()`, ou aceitar uma faixa mais larga? | É apetite de risco: o Remotion lança quase diariamente na série 4.0.4xx/5xx; pin estreito dá reprodutibilidade e dá trabalho de upgrade. | Pin ≥4.0.500 → `pushCut()` entra no catálogo. Faixa larga → `pushCut()` vira opcional com fallback, e o schema precisa de detecção de capacidade. |
| Comprar `@remotion-dev/cube-presentation` (item pago) ou excluir `cube()` do catálogo? | É decisão de orçamento e de licença, não técnica. | Comprar → +1 dependência paga e uma transição. Não comprar → `cube()` sai do enum e a doc oficial vira fonte parcialmente inutilizável para o LLM (precisa de filtro). |
| Adotar o default de premount da v5.0 desde já (`premountFor={fps}` explícito em toda cena) ou manter `0`? | Troca custo de memória/render por robustez de carga de asset; depende do hardware local e do peso dos assets Manim. | Premount ligado → menos flicker de asset, mais RAM e mais componentes montados por frame. Desligado → mais leve, risco de frame sem asset. |
| Migrar para Remotion 5.0 quando sair, dado que `layout="none"` passa a lançar erro dentro de `<TransitionSeries>` e o premount muda de default? | É decisão de janela de manutenção e de mandato. | Migrar cedo → paga a quebra de uma vez, com o codebase pequeno. Adiar → acumula uso de `layout="none"` que depois vira migração em N cenas. |
| O gate de determinismo (render duplo + comparação de hash) roda em todo commit ou só no CI noturno? | Custo de tempo de render local é do dono da máquina. | Todo commit → feedback rápido, ciclo lento. Noturno → ciclo rápido, regressão de determinismo descoberta tarde. |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** o **catálogo de transições** — o enum de `presentation` e `timing` que
  o LLM preenche. Deve nascer **derivado** do `exports` do `@remotion/transitions` instalado, num
  único arquivo (uma constante). Custo de reversão: **1 arquivo, ~25 linhas**. Se em vez disso o
  enum for espalhado pelos prompts e schemas, a reversão vira caça em N cards.
- **Segundo ponto de troca barata:** o cálculo de duração da composição. Se for sempre
  `Σ sequences − Σ timing.getDurationInFrames({fps})`, trocar `linearTiming` por `springTiming`
  custa **uma variável**. Se as durações forem hardcodadas, custa a timeline inteira.
- **Skills que devem carregar este conhecimento:**
  - a skill de **geração de composição Remotion** — precisa de R02-11 (aritmética da
    `TransitionSeries`), R02-12 (default `slide()`), R02-17 (`Sequence` vs `Series` vs
    `TransitionSeries`) e R02-20 (frame relativo);
  - a skill de **animação/timing** — R02-01/02/03 (defaults de spring), R02-18 (default `extend`
    do `interpolate`), R02-24 (`Easing.bezier`, `durationInFrames / fps`, último frame `- 1`);
  - a skill de **determinismo/render** — R02-21 (`random()`), R02-22 (`delayRender`), R02-23 e as
    armadilhas da seção 4;
  - a skill de **catálogo de efeitos** — R02-05/06/07/08 (as 19 presentations, o corte de versão do
    `pushCut()`, e `cube()` fora do pacote).
- **Cards que este cluster condiciona:**
  1. Card do **compilador roteiro→JSX**: escolher `<TransitionSeries>` como estrutura padrão,
     calcular duração por `getDurationInFrames({fps})`, nunca por soma ingênua.
  2. Card do **schema de transições**: enum derivado do `exports` instalado; `presentation`
     obrigatório no schema (mesmo sendo opcional na API); `cube` explicitamente fora.
  3. Card do **lint de determinismo**: proibir `Math.random`, `Date.now`, `setTimeout`,
     `requestAnimationFrame`, `transition:`/`animation:` CSS e `layout="none"` no diretório de
     composições — com a ressalva de LS-05 de que parte disso é dedução, não citação.
  4. Card do **gate de render duplo**: renderizar duas vezes com concorrência default e comparar
     hash; **não** usar `--concurrency=1` no gate.
  5. Card da **integração Manim→Remotion**: toda espera de asset passa por `delayRender()` com
     `timeoutInMilliseconds` explícito, nunca por `useEffect` solto.
  6. Card do **conversor de tempo**: `segundos * fps`, último frame `durationInFrames - 1`,
     com fixture de off-by-one.
  7. Card de **piso de parâmetros de spring**: impor mínimo de `damping` e mínimo de
     `durationRestThreshold` no schema, por causa do loop sem teto de `measureSpring()`.

---

**Data da pesquisa:** 2026-08-10 · **Rechecar até:** 2026-11-10 (o Remotion publica versões quase
diariamente; os claims PROVÁVEL ancorados em 4.0.507 têm meia-vida curta, e a v5.0 muda
`premountFor` e o `layout="none"` da `TransitionSeries`).
