---
name: motion-design-system
description: Provides the named token vocabulary every other skill inherits — typographic scale,
  palette with measured contrast, grid and safe areas per aspect ratio, canonical transition
  durations, spring presets held as (damping ratio, settling time) — plus the measurable numbers
  that become blocking gates: minimum on-screen text time, characters per second, contrast floors,
  the three-flashes-per-second limit, loudness target, true-peak headroom, and the markup-contract
  rule that keeps snapshot approval honest. Use whenever a task picks a duration, a colour, a size,
  a screen position, an easing curve or an audio level, even if the user never says "design
  system". Triggers: "token de design", "design system", "motion-invariants", "escala tipografica",
  "paleta", "contraste", "WCAG", "safe area", "graphics safe", "9:16", "Shorts", "Reels", "TikTok",
  "duracao de transicao", "easing", "spring preset", "snappy", "damping ratio", "overshoot",
  "flash", "fotossensibilidade", "LUFS", "true peak", "legibilidade", "valor magico".
metadata:
  type: knowledge
  tier: dominio
  verification_signal: "grep -qF '| R14-06 |' docs/00-panorama-verificado.md && grep -qF '| R14-16 |' docs/00-panorama-verificado.md && grep -qF '| AB-071 |' docs/00-panorama-verificado.md && curl -sL https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts | grep -qF 'Math.sqrt(k * m)' && curl -sL https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html | grep -qF 'three times in any one second'"
---
# Sistema de motion design — o vocabulário de tokens

## Quando carregar

- A tarefa escolhe um número que aparece na tela ou no alto-falante: duração, cor, tamanho de fonte,
  posição, curva, nível de áudio. Se você está prestes a digitar um literal, carregue isto antes.
- A tarefa cria ou edita o arquivo de tokens, ou escreve um gate que lê dele.
- A tarefa pergunta "quanto tempo esse texto fica na tela", "essa cor passa", "cabe na tela do
  celular", "essa transição está rápida demais", "esse piscar é perigoso".
- A tarefa gera conteúdo de ritmo acelerado — corte seco encadeado, strobe, glitch, flash de
  transição. O limite de fotossensibilidade é Nível A e não é negociável por estética.
- **Não carregue** para a mecânica de `spring()`, `interpolate()` ou `<TransitionSeries>` — isso é
  `remotion-core`. Nem para alinhamento de legenda, `Caption[]` ou implementação de ducking — isso é
  `audio-captions-sync`. Nem para escrever a linha de comando do FFmpeg — isso é `ffmpeg-media-ops`.

## Conhecimento injetado

### O arquivo é o vocabulário; o código de composição não tem número

O ponto de troca barata deste programa é **um único arquivo de constantes**, `motion-invariants.json`,
com ~15 chaves — `minTextDurationSeconds` 0.833, `maxCpsAdult` 20, `maxCharsPerLine` 42, `maxLines` 2,
`minSubtitleGapFrames` 2, `actionSafePct` 0.035, `graphicsSafePct` 0.05, `minContrastNormal` 4.5,
`minContrastLarge` 3.0, `maxFlashesPerSecond` 3, `flashAreaPct` 0.25, `flashLuminanceDelta` 0.10,
`targetLufs` (decisão do dono), `maxTruePeakDbtp` −1.0, `narrationWpm` 165 — **norma do programa** —
fonte: `docs/00-panorama-verificado.md` §5.1, linha «Invariantes de motion design».

A cláusula que dá valor a isso é a segunda metade da frase: trocar de plataforma, de público ou de
idioma custa **editar valores, não código — desde que nenhum número literal exista no código de
composição**. Um literal espalhado não quebra nada hoje; ele transforma "trocar 16:9 por 9:16" de
uma edição de 15 linhas em uma refatoração. O custo de reversão declarado (1 arquivo, ~15 linhas) só
é verdadeiro enquanto o invariante "zero literais" for **testado**, não prometido.

**Um valor, uma chave nomeada, um lugar.** Cada número deste vocabulário existe em **exatamente uma**
chave de `motion-invariants.json` e chega ao resto por um único tipo nomeado (`MotionInvariants`),
importado — nunca redeclarado. Um número que aparece em dois lugares (o arquivo de tokens **e** o
schema do manifesto, ou o arquivo **e** o gate) é **literal repetido, e literal repetido é proibido
mesmo quando os dois valores concordam hoje**: a próxima edição move um e deixa o outro, e nada fica
vermelho, porque cada lado continua internamente consistente. O invariante é mecânico: um varredor
sobre o diretório de composição não pode casar nenhum literal numérico nem `#hex` fora de import ou
leitura de token — e o gate falha se o varredor casar **zero arquivos**, senão ele sai verde por não
ter olhado nada (é a mesma armadilha de seletor vazio da seção de contrato de marcação).

**O sinal de verificação desta skill mede as fontes, não os gates.** As três âncoras de claim no
panorama e as duas URLs do frontmatter rodam hoje, e exigem rede — ele não fecha offline (`AB-055`).
Os dois gates que tornariam "zero literais" testado em vez de prometido estão **pendentes por
artefato inexistente**: o linter de skill (`.agents/scripts/skill_lint.py`, dono `T-10`) e a
varredura de literal (`just design:varrer`, dono `F0-04`). Até eles existirem, nenhum comando deste
repositório reprova um literal solto — e gate que não roda é invisível, que é pior que vermelho.

Acoplamento residual declarado no mesmo lugar: `maxCharsPerLine: 42` é calibrado para **inglês**.
pt-BR tem palavras mais longas e pode exigir 37–40 — o que muda o **quebrador de linha**, não só o
número.

### Tempo de texto na tela — o piso é em segundos, nunca em frames

Toda norma de legendagem consultada impõe piso e teto por evento de texto: piso de **20 frames**
(Netflix, "5/6 de segundo") a **40 frames** (DCMP, "1 segundo e 10 frames" ⇒ 1,333 s); teto de
**6 s** (DCMP) a **7 s** (Netflix) — **(2-0)** — fonte:
`https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements`
· `https://dcmp.org/learn/captioningkey/597` · `docs/00-panorama-verificado.md` §1.5, `R14-01 · R14-11`.

A armadilha é escrever o gate na unidade errada. **20 frames a 60 fps são 0,333 s** — quatro vezes
abaixo do piso das duas normas, com o gate parecendo rigoroso porque cita a Netflix. O invariante é
`duracao >= max(0,833 s; caracteres / maxCpsAdult)` **e** `duracao <= 7 s`, escrito em segundos e
convertido para frames só no último passo. O divisor de 20 CPS é fonte única — ver `## Não verificado`.
Duas condições de escopo dentro desse invariante: o piso de 0,833 s é o **mais frouxo** dos dois
publicados (o DCMP exige 1,333 s) e o teto de 7 s também é o **mais frouxo** (o DCMP fecha em 6 s) —
adotar os extremos permissivos é **escolha nossa**, não leitura de norma; conformidade com as duas
normas ao mesmo tempo é `1,333 s ≤ duração ≤ 6 s`.

O teto normativo de velocidade de texto fica **abaixo** da leitura silenciosa livre de adultos
(238 wpm não-ficção, 190 estudos, 18.573 participantes): DCMP recomenda 130–160 wpm e a Netflix
20 CPS (≈207 wpm, derivado) — **(3-0)** — fonte:
`https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf` · `https://dcmp.org/learn/captioningkey/601`.
Consequência de projeto: **não dimensione tempo de tela pela taxa de leitura livre** — o leitor
também está olhando a imagem.

Locução de referência fica em **140–183 wpm** (leitura em voz alta 183 wpm em 77 estudos; audiolivros
140–180; notícia de rádio ~170) — **(2-0)** — fonte: o mesmo PDF de Brysbaert. `narrationWpm: 165` é
escolha nossa **dentro** dessa faixa, não um valor publicado; a 165 wpm, 100 s de vídeo comportam
~275 palavras, e esse número é o orçamento que o roteirista recebe como restrição de schema.

### Escala tipográfica — o invariante publicado é relacional, não um px

Nenhuma norma lida publica "px mínimo em 1080p". O que existe e é testável hoje: **nenhuma bounding
box de texto pode sair do retângulo graphics-safe**, e esse retângulo tem número (abaixo). A escala
tipográfica em si é **estipulação nossa** — passos nomeados (`display`, `title`, `body`, `caption`),
cada um em fração da altura do frame, nunca em px absoluto, para que 1080p e 720p compartilhem token.

Dois pisos provisórios governam a escala e **nenhum dos dois tem fonte normativa** (ver
`## Não verificado`): altura de caixa ≥ 2,5% da altura do frame para texto secundário (27 px em
1080p) e ≥ 5% para texto principal. O argumento **derivado** que sustenta o piso: o vídeo será visto
a ~360 px de largura, um fator 3 de redução, e 27 px viram 9 px — abaixo dos **11 pt** que a Apple
publica como tamanho mínimo de fonte no iOS — **(1-0)** — fonte:
`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json`.
**Condição de escopo:** esse 11 pt é mínimo de **UI de aplicativo**, não norma de vídeo; ele é âncora
do argumento, não piso importável. Se a escala for definida olhando o Studio em tela cheia, ela nasce
ilegível no destino real.

### Paleta e contraste — o número é emprestado, a obrigação é nossa

Contraste mínimo **4,5:1** para texto normal e **3:1** para texto grande (nível **AA**; ≥18 pt, ou
≥14 pt negrito; "18pt and 14pt are equivalent to approximately 24px and 18.5px") — publicado igual por dois
publicadores independentes — **(2-0)** — fonte:
`https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html` ·
`https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json`.

**Condição de escopo que não pode ser cortada:** a WCAG regula *texto em página web*. Texto queimado
em vídeo está **fora do escopo normativo dela**. Adotamos o número como regra própria — o número é
emprestado, a obrigação é nossa. Isso muda onde o teste roda: sobre o **pixel renderizado**, frame a
frame, porque o fundo é vídeo.

Regra do token: cada par `(foreground, background)` da paleta guarda a **razão medida ao lado do
par**, e o gate recomputa. Cor que não está na paleta não entra na composição — não porque feiúra
seja erro, mas porque uma cor solta não tem razão de contraste registrada e por isso **não é
verificável**: ela passa no gate por não existir para ele.

### Grade e safe area — a norma citável cobre um formato só

EBU R 95 v1.1: **action safe = 3,5%** e **graphics safe = 5%** no topo, na base e nas laterais; 3,5%
de 1920 = **67 px** — **(2-0)** — fonte: `https://tech.ebu.ch/docs/r/r095.pdf` ·
`docs/00-panorama-verificado.md` §1.5, `R14-11`. Retângulos **derivados** para 1920×1080:

| zona | margem | horizontal | vertical | retângulo útil |
|---|---|---|---|---|
| action safe | 3,5% | 67 px | 38 px | x 67→1853 · y 38→1042 |
| graphics safe | 5% | 96 px | 54 px | x 96→1824 · y 54→1026 |

A convenção da tabela é parte do número e tem de ser escrita junto: **margem arredondada ao inteiro
mais próximo** (67,2→67; 37,8→38) e retângulo em **coordenadas de borda**, `[m, D−m]`, não em índices
do último pixel. A diferença é de 1 px, é invisível na revisão, e as duas leituras convivendo na
mesma tabela produzem um teste de bounding box que aprova texto encostado na borda de um eixo e
reprova no outro.

**Condição de escopo dura:** R 95 é **televisão 16:9**. Ela não cobre 9:16 e não diz nada sobre a UI
que TikTok, Reels ou Shorts desenham **por cima** do vídeo. Não existe fonte primária acessível para
as zonas de UI dessas três plataformas — três sondagens, três bloqueios de natureza diferente
(artigo removido, SPA sem conteúdo no HTML, HTTP 400) — registrado como item de ledger
**AB-071** — fonte: `docs/00-panorama-verificado.md` §7.6 (`AB-071`). Até a medição, a reserva **provisória e sem
fonte** em 1080×1920 é **12% no topo (230 px)**, **20% na base (384 px)** e **15% à direita (162 px)**
— o mesmo trio para as três plataformas por falta de dado, e ele muda por **versão do app**, não só
por plataforma. O procedimento de medição está em `## Não verificado`; qualquer safe zone vertical
que apareça num card **sem** vir dessa medição é folclore.

### Durações canônicas de transição — a grade é nossa, a régua é de terceiro

Os tokens de duração são estipulação: `cut` 0 ms · `instant` 100 ms · `snap` 200 ms · `base` 300 ms ·
`calm` 500 ms. A régua de onde vieram (a grade de 50–1000 ms do Material 3) é **fonte única** e está
em `## Não verificado`; e é grade de **UI**, não de vídeo.

A mecânica de `<TransitionSeries>` é de `remotion-core`; aqui entra só o que **muda o token** — três
fatos:

- A duração de uma transição é **subtrativa**: `total = Σ sequences − Σ transitions`. O token de
  duração é gasto **duas vezes**, uma de cada lado da emenda, e o total do manifesto tem de descontar
  isso. Errar o sinal produz cauda preta no fim, que é falha **visual**, não erro de execução —
  **(2-0)** — fonte: `https://www.remotion.dev/docs/transitions/transitionseries`.
- A duração **não se redigita**: ela vem de `timing.getDurationInFrames({fps})` — **(2-0)** — fonte:
  `https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/types.ts`.
  Isso é a regra §33 do playbook aplicada aqui: número que existe numa fonte estruturada é gerado ou
  conferido, nunca escrito à mão — fonte: `docs/PLAYBOOK-REFERENCIA.md` §33.
- Uma transição **não pode ser mais longa que a Sequence adjacente**; o runtime lança erro nomeando
  esse caso — **(2-0)** — fonte:
  `https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/transitions/src/TransitionSeries.tsx`.
  Portanto o token de duração tem um teto que **depende da cena**: `min(duração da cena vizinha)`.

O token `cut: 0` precisa mapear para uma presentation **explícita**. Omitir `presentation` não dá
corte seco — dá `slide()` — **(2-0)** — fonte: o mesmo `TransitionSeries.tsx`.

Detalhe de arredondamento que se perde: o token vive em milissegundos e a timeline vive em frames.
300 ms a 30 fps são 9 frames exatos; a 24 fps são 7,2. **Arredonde uma vez, na camada de token**, e
guarde o resultado em frames por fps — arredondar no ponto de uso produz duas cenas com durações
diferentes para o mesmo token e um desalinhamento de 1 frame que nenhum gate de pixel explica.

### Presets de mola — o token é (ζ, T); mass/damping/stiffness é derivado

`spring()` implementa oscilador harmônico amortecido, com a linha literal
`const zeta = c / (2 * Math.sqrt(k * m))`. Com o default (`mass: 1`, `damping: 10`, `stiffness: 100`,
`overshootClamping: false`): `ω₀ = √(k/m) = 10 rad/s`, **`ζ = 0,5`** — subamortecido, ou seja
**overshoot por padrão** — e amortecimento crítico com `stiffness=100, mass=1` seria `damping = 20`
— **(2-0)** — fonte: `https://www.remotion.dev/docs/spring` ·
`https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts`.

A consequência é o coração deste domínio: **"snappy com repique" e "suave sem repique" não são
gosto, são ζ<1 e ζ≥1.** O preset guarda **(ζ, T)** — razão de amortecimento e tempo de acomodação —
e converte para `{mass, damping, stiffness}` por fórmula; trocar "snappy" vira dois números, não
quinze configs espalhadas — **norma do programa** — fonte: `docs/00-panorama-verificado.md` §5.1,
linha «Presets de mola», e §1.5, `R14-16`.

Os pares (ζ, T) abaixo são **estipulação nossa** — nenhuma norma publica preset de mola, e nenhum
deles tem placar. O que é fato com fonte é a coluna da direita: ζ<1 repica, ζ≥1 não.

| preset | ζ (estipulado) | T alvo (estipulado) | leitura (fato) |
|---|---|---|---|
| `snappy` | 0,7 | 0,25 s | chega e para; repique pequeno |
| `suave` | 1,0 | 0,50 s | amortecimento crítico, zero repique |
| `overshoot` | 0,45 | 0,40 s | repique deliberado, para ênfase |

A conversão (`ω₀ = ln(1/threshold)/(ζ·T)`, `stiffness = ω₀²·m`, `damping = 2·ζ·ω₀·m`) é **derivada**:
ela usa só o envelope exponencial e ignora o termo trigonométrico, então **superestima levemente**.
Por isso a tabela de presets **nasce medida**: cada linha é confirmada por `measureSpring()` antes de
entrar no arquivo de tokens — sem isso o `<TransitionSeries>` recebe um número de frames que não
corresponde à animação — norma: `docs/00-panorama-verificado.md` §5.1, linha «Presets de mola».

Dois números que mudam a duração em silêncio:

- `durationRestThreshold` tem default **0.005** em `spring()`, `measureSpring()` e `springTiming()`
  — **(2-0)** — fonte: `https://www.remotion.dev/docs/transitions/timings/springtiming`. Baixá-lo
  para 0.001 **não** é ajuste estético: muda a duração da transição e, portanto, a duração total da
  composição.
- `measureSpring()` roda um `while` **sem teto de iteração** — **(2-0)** — fonte:
  `https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/measure-spring.ts`.
  Por isso o schema que expõe mola a um LLM precisa de **piso de `damping`**: threshold baixo com
  mola lenta trava o cálculo de layout, no render, não no vídeo.

### O gate de flash — três por segundo, e a área de referência que diverge

Nada pode piscar mais de **3 vezes em qualquer janela de 1 segundo**. Dois organismos independentes
publicam o mesmo limite, e a WCAG o classifica como **Nível A**, o mais básico — **(3-0)** — fonte:
`https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html` ·
`https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf` ·
`docs/00-panorama-verificado.md` §1.5, `R14-06`.

O detalhe que faz um gate ingênuo dar falso verde: **os dois padrões divergem na área de
referência**. A WCAG é **local** — 25% de qualquer campo visual de 10°, aproximado por um retângulo
de **341×256 px**. A ITU é **global** — 1/4 da área de tela exibida — **(2-0)** — fonte: as duas URLs
acima. Um gate que implementa só a regra global **deixa passar** conteúdo que reprova pela WCAG: um
quadrado pequeno piscando forte é aprovado pela ITU e reprovado pela WCAG.

O limite entra como **invariante testável, não como conselho**. O detector é escrito por nós e a
asserção é: para **toda** janela deslizante de 1 s e **toda** região, `pares de transição de
luminância relativa com Δ ≥ 0,10 e região escura < 0,80` **≤ 3**. Ela é avaliada **duas vezes** — uma
com a área de referência local da WCAG (~341×256 px) e outra com a global da ITU (1/4 da tela) — e
reprova se **qualquer uma das duas** reprovar; só a global aprova o quadrado pequeno piscando forte.
A sonda negativa faz parte do gate: contra os clipes sintéticos de referência (3 Hz e 4 Hz, 20% e 30%
de área) ele tem de acusar **só** o 4 Hz/30% — um gate que aprova os quatro e um que reprova os
quatro estão igualmente quebrados, e ambos parecem verdes num relatório. Rodar sobre o arquivo
renderizado, nunca sobre a composição: o pisca-pisca nasce da composição de camadas, não de uma prop.
Item de ledger **AB-070**, fonte: `docs/00-panorama-verificado.md` §7.6. A ferramenta de referência do
domínio não integra aqui (ver `## Não verificado`).

### Loudness e headroom — cinco normas, nenhum alvo herdável

**Não existe alvo único de loudness**; cinco publicadores, cinco números, todos corretos no próprio
escopo: EBU R 128 = **−23,0 LUFS** (broadcast); AES TD1008 = −18 (fala) / −16 (música) / −14
(álbum); Netflix OTT = **−27 LKFS dialog-gated**; Spotify = −14 LUFS; Google Assistant = −16 LUFS
estéreo — **(5-0)** — fonte: `https://tech.ebu.ch/docs/r/r128.pdf` ·
`https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf` ·
`https://support.spotify.com/artists/article/loudness-normalization` ·
`https://developers.google.com/assistant/tools/audio-loudness` · `docs/00-panorama-verificado.md` §1.5, `R14-12`.
Consequência: `targetLufs` é **decisão do dono registrada em ADR**, não constante de card — norma:
`docs/00-panorama-verificado.md` §6.2, `P-09` (→ ADR-009).

**Condição de escopo que muda o uso da lista:** o AES TD1008 declara explicitamente **não se aplicar
a conteúdo com imagem** (remete a AES71 para OTT/vídeo) — **(1-0)** — fonte:
`https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf` ·
`docs/00-panorama-verificado.md` §8.1, `R14-14` (e §8.2, «AES71-2018»). Ou seja, os −18/−16/−14 dessa linha **não são números de
vídeo**; citá-los como alvo para este programa é usar a fonte fora do escopo que ela própria declara.
Os outros quatro escopos são igualmente estreitos: R 128 é broadcast, −27 LKFS é OTT dialog-gated,
−14 é normalização de streaming de música e −16 é assistente de voz em estéreo.

O teto de **true peak −1 dBTP** antes de codec com perdas é convergente entre três fontes
independentes (Netflix é mais restritivo: −2 dBTP) — **(3-0)** — fonte: `https://tech.ebu.ch/docs/r/r128.pdf`
· o PDF do AES TD1008 · a página da Spotify · `docs/00-panorama-verificado.md` §1.5, `R14-13`. `maxTruePeakDbtp`
é **teto, não alvo**; na dúvida, −2. A ressalva de escopo acima não derruba este teto: a EBU R 128 é
norma de **broadcast**, com imagem, e a convergência sobrevive mesmo descontando o AES.

O número mais citado do domínio não tem documento: **"−14 LUFS é o padrão do YouTube" não tem fonte
primária**. Isto é **refutação registrada, não claim com placar positivo** — duas buscas
independentes deste programa, restritas aos domínios oficiais, voltaram vazias: R14-15 **(1-0)** e
R10-18 **(0-0)** — fonte: `docs/00-panorama-verificado.md` §3.3 (linha do «−14 LUFS … YouTube») e
§8.2 (primeira linha). A força dela é a ausência
repetida, não a soma dos placares. Escrever "(fonte: YouTube)" ao lado de um LUFS é citar documento
inexistente.

### Contrato de marcação — id nunca some, classe nova entra ao lado

Todo elemento que um gate seleciona carrega um **id de contrato**. Ids de contrato **não são
removidos nem renomeados**; classe nova entra **ao lado**, nunca no lugar. Isso é a regra de
propriedade de membro compartilhado do playbook aplicada ao markup: *"compartilhado — só acrescente.
Nunca reordene, nunca renomeie, nunca reindente"* — norma: `docs/PLAYBOOK-REFERENCIA.md` §12.

O motivo mecânico é o que torna a regra não-óbvia: **renomear um id não muda um pixel.** O golden
master visual passa idêntico, e o gate de layout que seleciona por aquele id passa a casar **zero
elementos** — e runner com seletor que não casa nada **sai verde**; no programa de origem, 25 de 42
cards tinham exatamente esse critério, que já passava antes da primeira linha escrita — norma:
`docs/PLAYBOOK-REFERENCIA.md` §30. A perda é dupla e silenciosa.

E ela se acumula porque **aprovar um snapshot é copiar**: aprovar baseline por
`cp received/ approved/` absorve a regressão em silêncio; a defesa mecânica é o arquivo aprovado ser
**imutável** e a aprovação exigir um passo que produza registro — fonte:
`docs/pesquisa/R11-golden-master-video.md` §4 (armadilhas). Um id renomeado mais uma aprovação por cópia é a
combinação exata em que o sistema esquece o que sabia verificar.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não escreva literal numérico em componente de composição** — nem `1080`, nem `0.833`, nem `#hex`,
  nem `300ms`. Um valor duplicado não quebra hoje; ele destrói o custo de reversão de 15 linhas que
  justifica o arquivo de tokens. O invariante é "zero literais", e ele precisa ser testado, não
  prometido.
- **Não redeclare o valor do token no schema do manifesto nem dentro do gate** "para o schema ficar
  autocontido" — é o reflexo certo em qualquer outro projeto e aqui é a falha. Duas cópias que
  concordam hoje divergem na primeira edição, e nenhuma delas fica vermelha: cada lado continua
  internamente consistente e o gate valida contra a sua própria cópia velha. O schema importa a chave.
- **Não exponha `damping`/`stiffness` como token público.** O token é (ζ, T). Expor os três números
  crus convida um agente a "diminuir o damping" — que é o conselho incompleto que o panorama já
  tomou: o default já é ζ=0,5, e o que falta para o estilo alvo é `stiffness` maior ou
  `durationInFrames`, não menos `damping`.
- **Não escreva a tabela de presets à mão.** A fórmula de conversão é derivada e superestima; cada
  linha entra confirmada por `measureSpring()`, senão a duração declarada no manifesto e a animação
  divergem sem erro nenhum.
- **Não escreva o piso de duração de texto em frames.** Frame é unidade dependente de fps; 20 frames
  a 60 fps são 0,333 s e o gate aprova legenda ilegível parecendo citar a Netflix.
- **Não valide contraste no token de cor.** O relatório sai "100% AA" e o texto está sobre vídeo,
  GIF e gradiente. A medição é no pixel renderizado, no pior frame.
- **Não valide legibilidade no Remotion Studio em tela cheia.** O destino é ~360 px de largura; o
  teste reduz o frame antes de julgar.
- **Não trate EBU R 95 como safe area universal.** É televisão 16:9. Usá-la em 9:16 produz um teste
  que passa enquanto a UI do app cobre o texto.
- **Não cite a HIG da Apple como origem de duração de animação** — a página *Motion* não publica
  nenhum número de duração (ver `## Não verificado`). Quem quiser "o número da Apple" vai inventar.
- **Não adote PEAT como gate de fotossensibilidade** (ver `## Não verificado`): o card muda de
  "integrar ferramenta" para "implementar detector", e essa diferença é de ondas, não de horas.
- **Não escreva "o alvo é −14 LUFS"** em card nenhum, e não atribua LUFS ao YouTube. O alvo é ADR.
- **Não cite o AES TD1008 como norma de áudio de vídeo** — é a fonte mais respeitável da lista e por
  isso a mais convidativa, mas o próprio documento declara não se aplicar a conteúdo com imagem. Um
  alvo copiado de lá entra no ADR com aparência de conformidade e sem escopo que o sustente.
- **Não acrescente uma cor "só nesta cena".** Cor fora da paleta não tem razão de contraste
  registrada; ela não reprova no gate porque o gate não sabe que ela existe.
- **Não renomeie nem remova id de contrato para "limpar" o markup**, e não substitua classe: some
  ao lado. Renomear é invisível no diff de pixel e apaga o gate.
- **Não corte na batida da música alternando plano claro e plano escuro acima de 3 vezes por
  segundo.** É a edição mais competente e mais óbvia do estilo alvo — e é exatamente o caso que a ITU
  trata como flash: corte rápido cai nas mesmas restrições quando produz área da tela que pisca
  (`(1-0)`, ver `## Não verificado`). O dano é silencioso duas vezes: o render termina sem erro, e um
  gate que conta cortes de cena aprova, porque o critério é luminância por região, não nº de cortes.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| Relatório de paleta "100% AA" | o contraste real muda a cada frame porque o fundo é vídeo | amostragem do contraste no pixel renderizado, no pior frame |
| Gate de duração citando "20 frames da Netflix" | a 60 fps são 0,333 s, quatro vezes abaixo do piso em segundos | assert em segundos: `dur >= max(0,833; chars/20)` e `<= 7` |
| Gate de flash que conta cortes de cena | corte só conta se produzir área que pisca; e estroboscópio **sem** corte reprova | série temporal de luminância por frame **e por região** |
| Preset de mola calibrado "no olho" no Studio | a duração real depende de `durationRestThreshold` e da config | comparação `measureSpring(config)` × duração declarada no manifesto |
| Layout aprovado no Studio em tela cheia | o vídeo será visto a ~360 px de largura | teste que reduz o frame para largura mobile antes de julgar |
| "Cabe em 42 caracteres" testado com texto médio | fonte proporcional; o pior caso é linha cheia de `MMMM`/`WWWW` | fixture de pior caso tipográfico |
| Safe area verde em 9:16 usando 3,5%/5% | R 95 é televisão 16:9 e não modela a UI que o app desenha por cima | teste de layout 9:16 com as zonas medidas em AB-071 |
| Gate de layout verde depois de renomear um id de contrato | seletor que não casa nada sai verde; e o pixel não mudou | sonda negativa: o gate falha se contar **zero** nós de contrato |
| `ebur128 target=-23` na linha de comando | o parâmetro só desenha a escala do medidor; não normaliza nada | comparação do LUFS **medido no arquivo de saída** |
| Token de duração em ms conferido no papel | 300 ms a 24 fps são 7,2 frames; o arredondamento no ponto de uso diverge | frames por fps guardados no token e assertados |

## O que esta skill NÃO cobre

- Mecânica de `spring()`, `interpolate()`, `<Sequence>`/`<Series>`/`<TransitionSeries>`, catálogo de
  presentations e determinismo de render → `remotion-core`.
- Alinhamento palavra-a-palavra, `Caption[]`, paginação de legenda, implementação de ducking e drift
  A/V → `audio-captions-sync`.
- Linha de comando do FFmpeg, `loudnorm` em duas passadas, `ebur128`, `scdet` → `ffmpeg-media-ops`.
- O schema do manifesto onde estes tokens são **referenciados por nome** → `timeline-manifest`.
- Como transformar um invariante numérico em comando que falha por ausência → `falsifiable-gates`.
- Baseline visual, limiar de comparador, política de aprovação de snapshot → `video-characterization`.
- Tipografia e destaque de código animado, e transição token-a-token → `code-animation`.
- Escolha de motor de TTS, voz e o wpm que ele produz de fato → `tts-voiceover`.

## Não verificado

| Item | Placar | Como fecha |
|---|---|---|
| 42 caracteres/linha, 2 linhas, 20 CPS adulto e 17 CPS infantil (Netflix) | (1-0), norma proprietária = fonte única por construção, calibrada para inglês | abrir `https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide` e procurar "42 characters"; para pt-BR, medir o quebrador na fonte escolhida |
| Intervalo mínimo de 2 frames entre legendas, e fechar para 2 todo intervalo de 3 a 11 frames | (1-0) | abrir a página *Subtitle Timing Guidelines* da Netflix e procurar "2 frames" |
| Corte rápido conta como flash quando produz área que pisca | (1-0), só a ITU | `pdftotext -layout` no PDF da BT.1702 e procurar "fast cuts" |
| Limiares físicos de flash: ≥20 cd/m², imagem escura <160 cd/m², sequência >5 s como risco residual | (1-0) | grep "20 cd/m" e "5 s" no mesmo PDF |
| Grade de duração do Material 3 (50–1000 ms) e as curvas `cubic-bezier` de easing | (1-0), repositório único, e é grade de **UI** | `curl -s https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss \| grep -n duration` |
| A página *Motion* da HIG da Apple não publica nenhuma duração | (1-0), refutação de fonte única | reler `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json` |
| Tamanho de fonte é especificado de forma **relacional** ("caber 42 caracteres na largura") | (1-0) | procurar "42 characters across screen" na página do TTSG |
| Piso de altura de caixa 2,5% (secundário) e 5% (principal) da altura do frame | **sem fonte** | renderizar, reduzir para 360 px de largura e comparar OCR (`tesseract`) com o texto esperado |
| Zonas de UI vertical: 12% topo, 20% base, 15% direita de 1080×1920 (≈230 / 384 / 162 px) | **sem fonte** (AB-071) | vídeo-régua com grade de 5%, screenshot do app, leitura de onde a UI cobre — por plataforma **e por versão do app** |
| Música a −18 dB sob a locução e −6 dB nos intervalos | **sem fonte**, chute calibrável | medir voz e música com `ebur128` separadamente, comparar LUFS integrados, depois A/B cego |
| Overshoot de 16,3% e acomodação de ≈1,06 s com o default de `spring()` (≈1,38 s a 0.001) | derivação, não medição | `measureSpring({fps, config})` para cada preset e comparar com o alvo em frames |
| PEAT inviável como gate (v1.6, Windows, `.AVI`, ~1 GB por 3 min) | (1-0) | reabrir `https://trace.umd.edu/peat/` |
| Densidade de corte do estilo alvo | **sem fonte primária viva** (AB-072) | `ffmpeg -i ref.mp4 -vf "scdet=threshold=10" -f null -` dividido pela duração; conferir com `threshold=5` e `=15` |

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
