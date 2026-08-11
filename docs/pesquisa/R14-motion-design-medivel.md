# R14 — Motion design e ritmo: o que é mensurável no estilo "Fireship"

**Escopo desta pesquisa:** o que, no vídeo técnico de ritmo acelerado, tem **número publicado por
norma** e portanto pode virar invariante testável do gerador (tempo mínimo de texto na tela,
velocidade de leitura, safe area, contraste, flash, loudness, física de mola). **Não** responde
qual é o "estilo certo", não mede vídeos do canal Fireship (nenhuma base pública de shot length
sobreviveu — ver R14-25), e não decide os alvos do projeto: decidir é do dono (seção 6).

> **Nota de método sobre o placar.** Este cluster é feito de *normas*. Para uma regra proprietária
> ("a Netflix exige 42 caracteres") só existe **uma** fonte possível — a própria Netflix. O placar
> `(1-0)` aqui não significa "duvidoso", significa **fonte única sem corroboração externa
> possível**: o risco não é a exatidão do número, é a **transferibilidade** dele para o nosso
> produto. Onde duas ou mais organizações independentes publicam o mesmo número, o placar sobe de
> verdade. Leia a coluna Rótulo junto com a "Verdade operacional" de cada claim.
>
> **Método de leitura.** Toda fonte listada foi aberta nesta sessão. Onde o WebFetch devolveu PDF
> binário, o PDF foi baixado pelo próprio WebFetch e lido com `pdftotext -layout` — as citações são
> do texto extraído, não de memória. Fontes que o ambiente **não** conseguiu abrir estão marcadas
> como inacessíveis e **não** são citadas como evidência.

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R14-01 | Toda norma de legendagem consultada impõe **piso e teto** de tempo de exibição por evento de texto: piso entre 20 frames (Netflix) e 40 frames (DCMP), teto entre 6 s (DCMP) e 7 s (Netflix). | (2-0) | PROVÁVEL | https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements |
| R14-02 | O Netflix English (USA) Timed Text Style Guide limita legenda a **42 caracteres por linha**, **máximo 2 linhas**, **20 CPS** (adulto) e **17 CPS** (infantil). | (1-0) | NÃO VERIFICADO | https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide |
| R14-03 | O teto normativo de velocidade de texto na tela fica **abaixo** da taxa de leitura silenciosa livre de adultos (238 wpm não-ficção): DCMP recomenda 130–160 wpm e Netflix 20 CPS (≈207 wpm, derivado). | (3-0) | CONFIRMADO | https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf |
| R14-04 | Netflix exige **intervalo mínimo de 2 frames** entre legendas e manda **fechar para 2 frames** todo intervalo de 3 a 11 frames. | (1-0) | NÃO VERIFICADO | https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines |
| R14-05 | Locução falada de referência fica em **140–183 wpm**: leitura em voz alta 183 wpm (77 estudos), audiolivros 140–180 wpm, notícia de rádio ~170 wpm. | (2-0) | PROVÁVEL | https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf |
| R14-06 | WCAG 2.2 SC 2.3.1 e ITU-R BT.1702 convergem: **nada pode piscar mais de 3 vezes em qualquer janela de 1 segundo**. | (3-0) | CONFIRMADO | https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html |
| R14-07 | Os dois padrões **divergem na área de referência** do flash: WCAG usa 25% de qualquer campo visual de 10° (retângulo de 341×256 px); ITU-R BT.1702 usa **1/4 da área de tela exibida**. | (2-0) | PROVÁVEL | https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf |
| R14-08 | ITU-R BT.1702 declara que **cortes rápidos** ("fast cuts") são provocativos e ficam sujeitos às mesmas restrições de flash quando produzem áreas da tela que piscam. | (1-0) | NÃO VERIFICADO | https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf |
| R14-09 | ITU-R BT.1702 define flash perigoso como par de mudanças opostas de luminância **≥20 cd/m²** com a imagem escura **<160 cd/m²** (branco de pico = 200 cd/m²), e alerta que **sequências >5 s** podem ser risco mesmo em conformidade. | (1-0) | NÃO VERIFICADO | https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf |
| R14-10 | Contraste mínimo de texto **4,5:1** (normal) e **3:1** (grande: ≥18 pt ou ≥14 pt negrito ≈ 24 px / 18,5 px) é publicado igual por W3C (WCAG 2.2 AA) e Apple (HIG). | (2-0) | PROVÁVEL | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |
| R14-11 | EBU R 95 v1.1 (2017): **action safe = 3,5%** e **graphics safe = 5%** no topo, base e laterais; 3,5% de 1920 = **67 px**. | (2-0) | PROVÁVEL | https://tech.ebu.ch/docs/r/r095.pdf |
| R14-12 | **Não existe alvo único de loudness**: EBU R128 = −23,0 LUFS; AES TD1008 = −18 (fala) / −16 (música track) / −14 (álbum); Netflix OTT = −27 LKFS dialog-gated; Spotify = −14 LUFS; Google Assistant = −16 LUFS estéreo. | (5-0) | CONFIRMADO | https://tech.ebu.ch/docs/r/r128.pdf |
| R14-13 | Teto de **true peak −1 dBTP** antes de codec com perdas é recomendação convergente de EBU R128, AES TD1008 e Spotify. | (3-0) | CONFIRMADO | https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf |
| R14-14 | O AES TD1008 declara **explicitamente que não se aplica a conteúdo com imagem** (OTT/vídeo), remetendo a AES71-2018 — logo −14/−16/−18 LUFS **não é regra de vídeo**. | (1-0) | NÃO VERIFICADO | https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf |
| R14-15 | Não foi localizada nenhuma página oficial do YouTube ou do TikTok publicando alvo de LUFS; o "−14 LUFS do YouTube" **não tem fonte primária acessível**. | (1-0) | NÃO VERIFICADO | busca restrita a `support.google.com` sem resultado — ver R14-15 na seção 2 |
| R14-16 | `spring()` do Remotion usa **mass=1, damping=10, stiffness=100**, implementando oscilador harmônico amortecido com **ζ = c/(2·√(k·m))** — o padrão é **ζ = 0,5** (subamortecido, com overshoot). | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/spring |
| R14-17 | **Derivado** do modelo: com a config padrão o overshoot máximo é ≈**16,3%** e o tempo até repouso a 0,005 é ≈**1,06 s** — mais longo que **qualquer** token de duração do Material 3 (máx 1000 ms). | (1-0) | NÃO VERIFICADO | derivação a partir de https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts |
| R14-18 | Material 3 publica tokens de duração de **50 ms a 1000 ms** (`short1`=50 … `extra-long4`=1000) e `easing-standard` = `cubic-bezier(0.2, 0, 0, 1)`. | (1-0) | NÃO VERIFICADO | https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss |
| R14-19 | A página **Motion** da Apple HIG **não publica nenhum número de duração de animação**; publica 30–60 fps para jogos e alerta contra oscilação em torno de **0,2 Hz**. | (1-0) | REFUTADO | https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json |
| R14-20 | `springTiming()` do Remotion tem `durationRestThreshold` **padrão 0.005** — exatamente o que o panorama afirma. | (1-0) | NÃO VERIFICADO | https://www.remotion.dev/docs/transitions/timings/springtiming |
| R14-21 | Netflix especifica tamanho de fonte de legenda de forma **relacional** ("relative to video resolution and ability to fit 42 characters across screen") — o invariante testável é *caber 42 caracteres na largura segura*, não um px fixo. | (1-0) | NÃO VERIFICADO | https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide |
| R14-22 | **Não há fonte primária acessível** publicando as safe zones de UI de TikTok, Instagram Reels ou YouTube Shorts. | (1-0) | NÃO VERIFICADO | ver R14-22 na seção 2 (três domínios sondados, três bloqueios distintos) |
| R14-23 | O PEAT (Trace Center) é gratuito mas está na **v1.6 (fev/2017)**, roda em **Windows** e exige **.AVI** — não serve como gate em pipeline Linux headless. | (1-0) | NÃO VERIFICADO | https://trace.umd.edu/peat/ |
| R14-24 | A URL `https://bbc.github.io/subtitle-guidelines/`, citada por toda a web como a fonte das BBC Subtitle Guidelines, responde **HTTP 404**. | (1-0) | REFUTADO | verificado com WebFetch e `curl -L` — ver R14-24 |
| R14-25 | O domínio `cinemetrics.lv` (base clássica de *Average Shot Length*) responde **HTTP 410 Gone**. | (1-0) | REFUTADO | verificado com `curl -L` — ver R14-25 |

---

## 2. Detalhe por claim

### R14-01 — Piso e teto de tempo de exibição de texto

- **Verdade operacional:** nenhuma norma deixa texto aparecer "o tempo que der". Netflix: mínimo
  **20 frames** por evento (a página *General Requirements* chama isso de **5/6 s**, "e.g. 20 frames
  for 24fps"; a página *Subtitle Timing Guidelines* chama de **4/5 s** — as duas concordam em
  *frames* e discordam em *segundos* porque assumem fps diferentes) e **máximo 7 s**. DCMP
  *Captioning Key*: mínimo **40 frames** ("1 second and 10 frames" ⇒ 30 fps ⇒ **1,333 s**) e máximo
  **6 s**. O invariante seguro do nosso sistema é o **mais restritivo dos dois em segundos**, não em
  frames: um gate escrito em frames aceita 20 frames a 60 fps = **0,333 s**, que viola as duas normas.
- **Como reconferir:**
  `https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements`
  (procurar "5/6"), `https://dcmp.org/learn/captioningkey/597` (procurar "40 frames").
- **O que quebra se divergir:** o gate de legibilidade do timeline manifest; o card que gera
  "páginas" de legenda estilo TikTok; a duração mínima de qualquer card de meme/GIF **que contenha
  texto**.
- **Fontes:**
  - https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements (primária) — "Minimum duration is 5/6 (five-sixths) of a second per subtitle event (e.g. 20 frames for 24fps)"; máximo 7 s; máximo 2 linhas.
  - https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines (primária, mesmo domínio ⇒ mesma fonte) — "Subtitles should not be any shorter in duration than 20 frames (or 4/5 sec)".
  - https://dcmp.org/learn/captioningkey/597 (primária) — mínimo "40 frames (1 second and 10 frames)", máximo "6 seconds", "no more than two lines per caption".

### R14-02 — 42 caracteres, 2 linhas, 20/17 CPS (Netflix)

- **Verdade operacional:** números exatos e citáveis; valem para inglês. Para adulto, **20 CPS**;
  infantil, **17 CPS**. Uma linha cheia (42 chars) a 20 CPS pede **2,1 s**; duas linhas cheias
  (84 chars) pedem **4,2 s** — dentro do teto de 7 s. Derivação de wpm: 20 CPS × 60 = 1200 chars/min
  ÷ ~5,8 chars/palavra (inglês, com espaço) ≈ **207 wpm** (número **derivado**, não publicado).
- **Como reconferir:** abrir a URL e procurar "42 characters" e "20 characters per second".
- **O que quebra se divergir:** o quebrador de linha do gerador de legenda; o teste automático
  "cabe na largura segura"; o cálculo de duração mínima por evento.
- **Fontes:**
  - https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide (primária) — 42 caracteres/linha, 2 linhas, 20 CPS adulto, 17 CPS infantil, fonte Arial como *placeholder* de `proportionalSansSerif`, cor branca.
- **Nota de transferibilidade:** o texto do nosso vídeo **não é legenda de diálogo** — é tipografia
  autoral. Adotar 42/20 como piso é conservador e defensável; adotar como teto absoluto pode
  proibir um *title card* de três palavras gigantes que é perfeitamente legível. Ver PERGUNTA-DONO.

### R14-03 — O teto de leitura na tela fica abaixo da leitura livre

- **Verdade operacional:** Brysbaert (2019, *Journal of Memory and Language* 109:104047, 190 estudos,
  18.573 participantes) fixa a leitura silenciosa adulta de não-ficção em **238 wpm** (faixa
  175–300) e ficção em **260 wpm** (faixa 200–320). As normas de legenda operam **muito abaixo
  disso** (DCMP 130/140/160 wpm por nível; Netflix ≈207 wpm derivado) porque o leitor de legenda
  também está olhando a imagem. Consequência de projeto: **não use a taxa de leitura livre para
  dimensionar tempo de tela.**
- **Como reconferir:** `pdftotext -layout` no PDF do gwern e procurar "238 words per minute";
  https://dcmp.org/learn/captioningkey/601 e procurar "130 words per minute".
- **O que quebra se divergir:** a fórmula de duração mínima de qualquer nó de texto; o orçamento de
  tempo do roteiro (quanto texto cabe em 100 s).
- **Fontes:**
  - https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf (primária, artigo revisado por pares) — "the average silent reading rate for adults in English is 238 words per minute (wpm) for non-fiction and 260 wpm for fiction"; "The average oral reading rate (based on 77 studies and 5965 participants) is 183 wpm".
  - https://dcmp.org/learn/captioningkey/601 (primária) — "not to exceed 130 words per minute (wpm)" (lower), 140 (middle), 160 (upper).
  - https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide (primária) — 20 CPS.

### R14-04 — Intervalo entre legendas e sincronia com corte

- **Verdade operacional:** o padrão Netflix não deixa "buraquinho" entre legendas: mínimo **2 frames**
  e todo intervalo de **3 a 11 frames inclusive deve ser fechado para 2 frames**. Também: entrada
  tolerada em 1–2 frames do primeiro frame de áudio; saída pode estender **até meio segundo** além
  do timecode (12 frames a 24 fps, 15 a 30 fps, 30 a 60 fps); saída junto a corte deve ficar **2
  frames antes do corte**. Isso é uma regra de *ritmo* disfarçada de regra de legenda: ela proíbe
  piscar texto no corte.
- **Como reconferir:** abrir a URL e procurar "2 frames".
- **O que quebra se divergir:** o alinhador de legenda com o áudio (R04) e o gate que valida a
  timeline contra a lista de cortes.
- **Fontes:**
  - https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines (primária).

### R14-05 — Velocidade de locução

- **Verdade operacional:** a faixa defensável para narração é **140–183 wpm**. Brysbaert reporta
  leitura em voz alta em **183 wpm**, e no corpo do artigo registra que "audiobooks are spoken at a
  rate of 140–180 wpm" e que o "ideal speech rate for radio news is 170 wpm for high density
  messages" (Rodero). O DCMP corrobora **só o teto**: legenda acima de 160 wpm já é considerada
  rápida demais para mídia educacional. Um TTS a 200+ wpm sai do envelope de todas as fontes.
- **Como reconferir:** grep por "audiobooks are spoken" e "radio news" no texto extraído do PDF.
- **O que quebra se divergir:** o card de TTS (R13) — a escolha de *rate*/*speed* do sintetizador; e
  o orçamento "quantas palavras cabem em 100 segundos" (a 170 wpm ⇒ **~283 palavras**).
- **Fontes:**
  - https://gwern.net/doc/psychology/linguistics/2019-brysbaert.pdf (primária).
  - https://dcmp.org/learn/captioningkey/601 (primária) — corrobora o limite superior, mas mede
    *taxa de legenda*, não de fala. Corroboração parcial, declarada.

### R14-06 — Três flashes por segundo

- **Verdade operacional:** dois organismos independentes (W3C e ITU-R) publicam o **mesmo limite de
  3 flashes em 1 s**, e existe ferramenta que o implementa (PEAT). Isto é o candidato mais sólido a
  **gate bloqueante automático** do sistema inteiro. Redação normativa da WCAG: "Web pages do not
  contain anything that flashes more than three times in any one second period, or the flash is
  below the general flash and red flash thresholds". ITU: "there are more than three flashes within
  any one-second period"; e, como esclarecimento operacional, **flashes cujas bordas de subida
  estejam separadas por ≥9 frames (50 Hz) ou ≥10 frames (60 Hz) são aceitáveis** independentemente
  de brilho e área.
- **Como reconferir:** as duas URLs abaixo; procurar "three flashes".
- **O que quebra se divergir:** o gate de acessibilidade; a política de cortes rápidos; o card que
  gera *strobe*/*glitch* de transição.
- **Fontes:**
  - https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html (primária, WCAG 2.2, SC 2.3.1, Nível A).
  - https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf (primária, Rec. ITU-R BT.1702, 2005).
  - https://trace.umd.edu/peat/ (primária do implementador) — PEAT analisa contra a SC 2.3.1.

### R14-07 — A área de referência do flash é diferente nos dois padrões

- **Verdade operacional:** este é o detalhe que faz um gate ingênuo dar falso verde ou falso
  vermelho. WCAG: o flash falha se "the combined area of flashes occurring concurrently occupies no
  more than a total of .006 steradians within any **10 degree visual field**" — 25% de um campo de
  10°, aproximado por um retângulo de **341×256 px** (tela de 15–17", a 22–26" de distância).
  ITU-R BT.1702: falha se "the combined area of flashes occurring concurrently occupies more than
  **one quarter of the displayed screen area**". Ou seja: **WCAG é local** (um quadrado pequeno
  piscando forte já reprova), **ITU é global** (precisa de 1/4 da tela). Um gate que implementar só
  a regra global deixa passar conteúdo que reprova pela WCAG.
- **Como reconferir:** procurar "steradians" na página da W3C e "one quarter" no PDF da ITU.
- **O que quebra se divergir:** a implementação do detector (janela deslizante local vs média
  global) e o número de falsos positivos que o gate produz.
- **Fontes:** as duas de R14-06 (primárias).

### R14-08 — Corte rápido conta como flash

- **Verdade operacional:** a frase da ITU é literal e é **a restrição central deste projeto**:
  *"Rapidly changing image sequences (for example, fast cuts) are provocative if they result in
  areas of the screen that flash, in which case the same constraints apply as for flashes."*
  Traduzindo para o nosso sistema: o estilo "corte seco a cada 0,8 s" **não é livre**. Se os cortes
  alternarem entre um plano claro e um plano escuro, a sequência de cortes **é** uma sequência de
  flashes e cai sob o limite de 3/s.
- **Como reconferir:** `pdftotext -layout` no PDF da ITU e procurar "fast cuts".
- **O que quebra se divergir:** o gerador de ritmo; o gate de flash precisa medir **luminância média
  por frame ao longo dos cortes**, não só detectar cortes.
- **Fontes:** https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf (primária).

### R14-09 — Limiares físicos do flash

- **Verdade operacional:** ITU-R BT.1702: flash perigoso = par de mudanças opostas de luminância de
  **≥20 cd/m²**, aplicável só quando a imagem mais escura está **abaixo de 160 cd/m²**; ambiente de
  referência com branco de pico em **200 cd/m²** e gama 2,2 (ITU-R BT.500). Em unidades relativas
  isso é ~10% do branco de pico — **o mesmo 10% da WCAG** ("a pair of opposing changes in relative
  luminance of 10% or more of the maximum relative luminance (1.0) where the relative luminance of
  the darker image is below 0.80"). Adicional crítico: *"a sequence of flashing images lasting more
  than 5 s might constitute a risk even when it complies with the guidelines"*.
- **Como reconferir:** procurar "20 cd/m" e "5 s" no PDF da ITU; "0.80" na página da W3C.
- **O que quebra se divergir:** a fórmula do detector de flash (luminância relativa vs cd/m²) e a
  regra de duração máxima de sequência estroboscópica.
- **Fontes:** as duas de R14-06 (primárias). A conversão 20 cd/m² ≈ 10% de 200 cd/m² é **derivada**.

### R14-10 — Contraste 4,5:1 e 3:1

- **Verdade operacional:** dois publicadores independentes dão os mesmos dois números. W3C
  (WCAG 2.2, SC 1.4.3, AA): 4,5:1 normal, 3:1 para texto grande (≥18 pt, ou ≥14 pt negrito;
  "18pt and 14pt are equivalent to approximately 24px and 18.5px"). Apple HIG: 4,5:1 até 17 pt,
  3:1 a partir de 18 pt e para negrito. **Ressalva de escopo que importa muito aqui:** a WCAG
  regula *texto na web*; texto **queimado no vídeo** não está no escopo normativo dela. Adotamos
  como regra própria — o número é emprestado, a obrigação é nossa.
- **Como reconferir:** as duas URLs; procurar "4.5:1".
- **O que quebra se divergir:** o gate de contraste por frame; a paleta do design system de motion.
- **Fontes:**
  - https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (primária).
  - https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json (primária) — tabela de contraste WCAG AA; e tamanhos mínimos de fonte por plataforma: iOS 17 pt padrão / 11 pt mínimo, macOS 13/10, tvOS 29/23, visionOS 17/12, watchOS 16/12.

### R14-11 — Safe area 3,5% / 5% (EBU R 95)

- **Verdade operacional:** EBU R 95 v1.1 (junho/2017), nota 5: *"The action safe area is 3.5% and
  the graphics safe area is 5%, at the top, bottom and lateral parts of the image."* O documento
  confirma no histórico de revisão que **3,5% de 1920 = 67 px** (erro anterior de 76 px corrigido).
  Valores **derivados** para 1920×1080:

  | zona | margem % | margem horizontal | margem vertical | retângulo útil |
  |---|---|---|---|---|
  | action safe | 3,5% | 67 px | 38 linhas | x 67→1852 (1786 px) × y 38→1042 (1004 linhas) |
  | graphics safe | 5% | 96 px | 54 linhas | x 96→1823 (1728 px) × y 54→1025 (972 linhas) |

  Corroboração independente: a Nota 3 da ITU-R BT.1702 afirma que o overscan típico de receptores
  domésticos fica "in the range 3.5% to ± 1% of the overall picture width or height".
- **Como reconferir:** `pdftotext -layout r095.pdf | grep -n "3.5%"`.
- **O que quebra se divergir:** o teste automático de layout (nenhum glifo fora do graphics safe);
  o posicionamento default de legenda e de *lower third*.
- **Fontes:**
  - https://tech.ebu.ch/docs/r/r095.pdf (primária, EBU R 95 v1.1, 2017).
  - https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf (primária, Nota 3 — cita a versão R95-2000, então é corroboração fraca: a ITU está lendo a EBU).
- **Limite honesto:** R 95 é para **televisão 16:9**. Não cobre 9:16 nem UI de app. Ver R14-22.

### R14-12 — Não existe um alvo único de LUFS

- **Verdade operacional:** cinco publicadores, cinco números, todos corretos **no seu escopo**:

  | fonte | alvo | true peak | escopo declarado |
  |---|---|---|---|
  | EBU R 128-2023 (V5) | **−23,0 LUFS** (±1,0 LU só quando inevitável, ex. ao vivo; ±0,2 LU para QC) | −1 dBTP (±0,3 dB) | broadcast, medição *integrada e sem ênfase em fala* |
  | EBU R 128 s2-2023 (V3) | −23,0 LUFS para streaming; se precisar mais alto por ambiente ruidoso, **−20,0 a −16,0 LUFS** | idem | streaming de broadcaster |
  | AES TD1008.1.21-9 (2021) | **−18** (fala mensurável, +1 LU) / **−16** (música track-normalized, +0,2) / **−14** (faixa mais alta do álbum) / −18 (interstitial) | **−1 dBTP** na entrada do codec | **áudio-only**; explicitamente *não* para som com imagem |
  | Netflix Sound Mix Spec v1.1 | **−27 LKFS ±2 LU dialog-gated** (BS.1770-1); alternativa −24 LKFS ±2 program quando o diálogo é <15% | **−2 dBTP** (limitador em −2,3 dBFS) | entrega OTT |
  | Spotify | **−14 LUFS** | true peak abaixo de −1 dB (−2 dB se masterizar acima do alvo) | reprodução musical |
  | Google Assistant | −16 LUFS estéreo / −19 LUFS mono | −1,5 dBTP no exemplo de `ffmpeg` | áudio de assistente |

  O AES ainda registra a intenção de **baixar 6 LU** no futuro para harmonizar com EBU R128 / ATSC
  A/85 / AES71-2018 em −23/−24 LUFS.
- **Como reconferir:** os PDFs em `tech.ebu.ch/docs/r/` e `aes2.org`, mais as duas páginas de
  suporte. Comandos: `pdftotext -layout r128.pdf | grep -n "23.0 LUFS"`.
- **O que quebra se divergir:** o card de masterização de áudio; o gate `ebur128`; o valor do
  `loudnorm -i`.
- **Fontes:**
  - https://tech.ebu.ch/docs/r/r128.pdf (primária) — "the Programme Loudness Level shall be normalised to a Target Level of −23.0 LUFS".
  - https://tech.ebu.ch/docs/r/r128s2.pdf (primária, mesmo domínio ⇒ mesma fonte) — "in the range of −20.0 to −16.0 LUFS".
  - https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf (primária) — Tabela 1.
  - https://partnerhelp.netflixstudios.com/hc/en-us/articles/360001794307-Sound-Mix-Specifications-Best-Practices-v1-1 (primária) — "Set average loudness at -27 LKFS with a tolerance of ±2 LU, dialog-gated".
  - https://support.spotify.com/artists/article/loudness-normalization (primária) — −14 dB LUFS.
  - https://developers.google.com/assistant/tools/audio-loudness (primária) — −16 LUFS estéreo, −19 LUFS mono.

### R14-13 — −1 dBTP é o teto convergente

- **Verdade operacional:** três fontes independentes chegam ao mesmo teto de pico verdadeiro antes
  de codificação com perdas: EBU R128 ("shall not exceed −1 dBTP … measurement tolerance ±0,3 dB"),
  AES TD1008 ("Maximum True Peak level not exceed −1 dBTP at the codec input of lossy-encoded
  streams"), Spotify (true peak abaixo de −1 dB). Netflix é **mais** restritivo (−2 dBTP) porque é
  entrega de master. Regra do sistema: **−1 dBTP é teto, não alvo**; se houver dúvida, −2.
- **Como reconferir:** grep "dBTP" nos três documentos.
- **O que quebra se divergir:** o parâmetro `TP` do `loudnorm` e o gate de pico do render final.
- **Fontes:** as três acima (primárias, domínios distintos).

### R14-14 — O AES TD1008 não é norma de vídeo

- **Verdade operacional:** citação literal do documento: *"Is not intended for sound-with-picture
  content (Over-The-Top, or On-Demand Video). Guidelines for that material are covered in other
  industry recommendations and standards (e.g., AES71-2018)."* Isso invalida o atalho preguiçoso
  "AES manda −16, então nosso vídeo vai a −16". **AES71-2018 não foi lido nesta pesquisa** (não
  localizei cópia pública acessível) — fica como LEDGER-SEED.
- **Como reconferir:** grep "sound-with-picture" no PDF do TD1008.
- **O que quebra se divergir:** a justificativa escrita do alvo de loudness do projeto.
- **Fontes:** https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf (primária).

### R14-15 — O "−14 LUFS do YouTube" não tem fonte primária

- **Verdade operacional:** busca restrita aos domínios `support.google.com`, `developers.google.com`
  e `youtube.com` por "loudness normalization" devolveu **apenas threads de comunidade e vídeos**,
  nenhuma página de ajuda oficial com número. O único −14 LUFS que este agente conseguiu ler em
  documento oficial é o da **Spotify** e o caso "album-loudest track" do **AES TD1008**. Isso não
  prova que o YouTube não normaliza a −14; prova que **não há documento para citar num card**. O
  caminho honesto é medir (ver LEDGER-SEED LS-03: o próprio YouTube expõe "content loudness" em
  *Stats for nerds*, que é uma medição observável).
- **Como reconferir:** repetir a busca restrita; ou publicar um vídeo de teste e ler o
  "content loudness" no *Stats for nerds*.
- **O que quebra se divergir:** o alvo de masterização e a promessa "soa igual ao Fireship".
- **Fontes:** ausência de resultado em busca restrita a `support.google.com` (evidência **fraca** de
  ausência, declarada como tal); https://support.spotify.com/artists/article/loudness-normalization
  (primária, para atribuir o −14 a quem de fato o publica).

### R14-16 — Física da mola do Remotion

- **Verdade operacional:** o default é `{mass: 1, damping: 10, stiffness: 100, overshootClamping:
  false}` e o código-fonte implementa oscilador harmônico amortecido, com a linha literal
  `const zeta = c / (2 * Math.sqrt(k * m)); // damping ratio` e envelope
  `Math.exp(-zeta * omega0 * t)`. Isso dá as identidades **exatas** que faltam no panorama:

  - `ω₀ = √(k/m)` → padrão: **10 rad/s**
  - `ζ = c / (2·√(k·m))` → padrão: **0,5** (subamortecido ⇒ overshoot existe por padrão)
  - **amortecimento crítico** (sem overshoot) com `stiffness=100, mass=1`: `damping = 2·√(k·m) = 20`

  Ou seja, "snappy com repique" e "suave sem repique" **não são gosto, são ζ<1 e ζ≥1**. Um preset
  do design system deve ser expresso em (ζ, ω₀) e convertido para (mass, damping, stiffness), não
  chutado.
- **Como reconferir:**
  `curl -s https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts | grep -n "zeta"`
- **O que quebra se divergir:** a tabela de presets de mola do design system de motion (S17); a
  conversão "quero 300 ms sem repique" → config.
- **Fontes:**
  - https://www.remotion.dev/docs/spring (primária) — defaults, assinatura, `durationInFrames`
    (v3.0.27), `delay` (v3.3.90), `reverse` (v3.3.92).
  - https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts (primária, mesmo projeto, domínio distinto) — o modelo físico.

### R14-17 — O default do Remotion é lento demais para o estilo alvo (derivado)

- **Verdade operacional:** **números derivados** das identidades do oscilador amortecido aplicadas
  ao modelo que o código implementa (não são valores publicados):

  - overshoot máximo = `exp(−ζπ/√(1−ζ²))` = `exp(−1,8138)` ≈ **16,3%** acima do alvo
  - tempo até o 1º pico = `π/ωd`, com `ωd = ω₀√(1−ζ²) = 8,66 rad/s` ⇒ ≈ **0,363 s** (≈11 frames a 30 fps)
  - tempo de acomodação ≈ `ln(1/threshold)/(ζ·ω₀)` ⇒ **1,06 s** a `0.005` e **1,38 s** a `0.001`

  Comparado com Material 3 (R14-18), cujo token **mais longo** é 1000 ms e cujo uso típico de
  transição fica em 200–400 ms, a mola padrão do Remotion é **mais lenta que qualquer transição de
  UI**. Receita derivada para calibrar: para acomodar em `T` segundos com razão de amortecimento ζ,
  use `ω₀ = ln(1/threshold)/(ζ·T)`, `stiffness = ω₀²·m`, `damping = 2·ζ·ω₀·m`. Exemplo: 300 ms sem
  repique (ζ=1, threshold 0.005) ⇒ `ω₀ ≈ 17,7` ⇒ **stiffness ≈ 312, damping ≈ 35, mass 1**.
- **Como reconferir:** **não confie na derivação** — meça com `measureSpring()` do Remotion e
  registre o resultado (LEDGER-SEED LS-06). A derivação usa só o envelope exponencial e ignora o
  termo trigonométrico, então superestima levemente o tempo.
- **O que quebra se divergir:** a tabela de presets; a duração real de cada `TransitionSeries`.
- **Fontes:** derivação sobre https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts (primária) + https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss (primária) para a comparação.

### R14-18 — Tokens de duração do Material 3

- **Verdade operacional:** valores literais do arquivo de tokens do `material-web` (v0_192):
  `short1` 50 ms, `short2` 100, `short3` 150, `short4` 200, `medium1` 250, `medium2` 300,
  `medium3` 350, `medium4` 400, `long1` 450, `long2` 500, `long3` 550, `long4` 600,
  `extra-long1` 700, `extra-long2` 800, `extra-long3` 900, `extra-long4` 1000.
  Easing: `standard` e `emphasized` = `cubic-bezier(0.2, 0, 0, 1)`; `emphasized-decelerate` =
  `cubic-bezier(0.05, 0.7, 0.1, 1)`; `emphasized-accelerate` = `cubic-bezier(0.3, 0, 0.8, 0.15)`;
  `legacy` = `cubic-bezier(0.4, 0, 0.2, 1)`.
  **Atenção:** isto é grade de duração de **UI**, não de vídeo. Serve como *régua* e como fonte de
  curvas de easing — não como norma.
- **Como reconferir:** `curl -s <raw url> | grep -n "duration"`.
- **O que quebra se divergir:** a grade de durações do design system de motion (S17).
- **Fontes:** https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss (primária, repositório oficial).
  A página `m3.material.io/styles/motion/easing-and-duration/tokens-specs` foi aberta e devolve
  **só o título** (renderização por JS) — inútil como fonte, por isso o repositório.

### R14-19 — A HIG da Apple não dá durações

- **Verdade operacional:** a página *Motion* foi lida inteira (via JSON da documentação) e **não
  contém nenhum número de duração**. Contém: "maintaining a consistent frame rate of 30 to 60 fps"
  (jogos) e "avoid showing an oscillation that has a frequency of around 0.2 Hz" (visionOS). A
  página de *Accessibility* menciona a configuração **Dim Flashing Lights** mas **não** publica
  limiar numérico de flashes. Portanto: quem quiser "o número da Apple" para uma transição vai
  inventar.
- **Como reconferir:** as duas URLs `.json` da HIG.
- **O que quebra se divergir:** qualquer card que cite "Apple HIG" como origem de uma duração.
- **Fontes:**
  - https://developer.apple.com/tutorials/data/design/human-interface-guidelines/motion.json (primária).
  - https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json (primária, mesmo domínio).

### R14-20 — `durationRestThreshold` padrão 0.005

- **Verdade operacional:** a doc do `springTiming()` diz literalmente "At which point the animation
  is considered to be finished. Default: 0.005" e recomenda baixar para `0.001`. O panorama acertou
  o número. O que o panorama erra é o **efeito** — ver seção 3.
- **Como reconferir:** https://www.remotion.dev/docs/transitions/timings/springtiming
- **O que quebra se divergir:** a duração real de cada transição e, portanto, o *cut density*.
- **Fontes:** https://www.remotion.dev/docs/transitions/timings/springtiming (primária).

### R14-21 — Tamanho de fonte: o invariante é relacional

- **Verdade operacional:** nenhuma das normas lidas publica "px mínimo em 1080p". A Netflix
  especifica o tamanho como **relação**: "Relative to video resolution and ability to fit 42
  characters across screen". Isso é **melhor** que um px fixo para o nosso caso, porque vira um
  teste automático executável: *renderize a linha mais longa e verifique que a caixa de texto cabe
  dentro do graphics safe (1728 px em 1080p) e que 42 caracteres da mesma fonte também cabem*.
  Referências adjacentes de tamanho mínimo (UI, não vídeo): Apple HIG — iOS mínimo 11 pt, tvOS
  mínimo 23 pt (tvOS é o proxy mais próximo de "tela vista de longe").
- **Como reconferir:** procurar "42 characters across screen" na página do TTSG.
- **O que quebra se divergir:** o teste de layout; a escolha de escala tipográfica.
- **Fontes:**
  - https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide (primária).
  - https://developer.apple.com/tutorials/data/design/human-interface-guidelines/accessibility.json (primária, adjacente).

### R14-22 — Safe zones de TikTok / Reels / Shorts: sem fonte

- **Verdade operacional:** três tentativas, três bloqueios **de natureza diferente**, todos
  registrados:
  - **TikTok** — o artigo `ads.tiktok.com/help/article/tiktok-feed-ad-video-safe-zone` responde com
    "The article you are looking for no longer exists or failed to load"; o artigo
    `tiktok-video-safe-zone` devolve HTTP 200 mas é SPA (`serverRendered:false`), e o HTML entregue
    contém apenas CSS — nenhum número.
  - **Meta/Instagram** — `facebook.com/business/help/980593475366490` devolve **HTTP 400** para
    cliente não-navegador; via WebFetch retorna só o título da página.
  - **YouTube Shorts** — busca restrita a `support.google.com` por "safe area"/"safe zone" +
    shorts devolveu **zero** páginas oficiais (só ferramenta de terceiro).
  Conclusão operacional: **qualquer número de safe zone vertical que aparecer num card é folclore**
  até ser medido. Vira LS-05.
- **Como reconferir:** as três sondagens acima; e a medição empírica descrita em LS-05.
- **O que quebra se divergir:** o teste de layout para 9:16; a decisão de exportar vertical.
- **Fontes:** sondagens registradas (evidência positiva de indisponibilidade, não de inexistência).

### R14-23 — PEAT não serve como gate

- **Verdade operacional:** PEAT é gratuito e é a implementação de referência da SC 2.3.1, mas: v1.6
  de **fevereiro de 2017**, roda em **Windows** (Mac só via Boot Camp), a função de captura "doesn't
  always work with current formats" e a recomendação é **converter o vídeo para .AVI**; requer
  ~1 GB por 3 minutos de vídeo não comprimido. Os próprios autores dizem que está "old in the tooth"
  e que o substituto open-source não tem data. Para um pipeline Linux headless dirigido por agentes,
  **isto não é integrável** — o gate de flash tem que ser escrito por nós (ver LS-09).
- **Como reconferir:** https://trace.umd.edu/peat/
- **O que quebra se divergir:** o card "gate de fotossensibilidade" — se PEAT fosse usável, o card
  seria "integrar ferramenta"; como não é, o card é "implementar detector".
- **Fontes:** https://trace.umd.edu/peat/ (primária do projeto).

### R14-24 — A URL das BBC Subtitle Guidelines está morta

- **Verdade operacional:** `https://bbc.github.io/subtitle-guidelines/` responde **404** (confirmado
  por WebFetch e por `curl -L -o /dev/null -w '%{http_code}'`), e `github.com/bbc/subtitle-guidelines`
  também responde **404**. O domínio `www.bbc.co.uk` (onde as diretrizes hoje residiriam) é
  **inacessível a partir deste ambiente**. Consequência: os números famosos das BBC/Ofcom
  (**160–180 wpm**, "0,3 s por palavra") apareceram apenas em fontes **secundárias** nesta sessão e
  **não foram confirmados em documento primário** — não podem virar restrição de card. O PDF da
  Ofcom (`qos-statement.pdf`) devolveu **403**.
- **Como reconferir:** `curl -sS -o /dev/null -w '%{http_code}' -L https://bbc.github.io/subtitle-guidelines/`
- **O que quebra se divergir:** qualquer card que cite "BBC: 160–180 wpm" como fonte.
- **Fontes:** as duas verificações de status HTTP acima.

### R14-25 — A base Cinemetrics está fora do ar

- **Verdade operacional:** `http://www.cinemetrics.lv/` responde **HTTP 410 Gone** e
  `https://www.cinemetrics.lv/database.php` falha o handshake TLS. Era **a** base pública de
  *Average Shot Length* por filme. O artigo de referência sobre ASL em Hollywood (Cutting et al.,
  *Psychological Science*, 2010) está atrás de paywall (**403** no SagePub) e os espelhos
  institucionais de Cornell **não respondem** (timeout). Portanto: **este cluster não entrega número
  de shot length de fonte primária.** Vira LS-01 (medição local).
- **Como reconferir:** `curl -sS -o /dev/null -w '%{http_code}' -L http://www.cinemetrics.lv/`
- **O que quebra se divergir:** o card "parametrizar densidade de corte" — hoje ele nasce sem
  constante, só com procedimento de medição.
- **Fontes:** verificações de status HTTP acima.

---

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "ritmo frenético e altamente condensado… cortes secos" como se fosse especificação | **NÃO É ESPECIFICAÇÃO** | Não há um único número no panorama nem fonte pública viva que meça *shot length* desse estilo: a base Cinemetrics responde 410 Gone e o artigo de referência está atrás de paywall. Densidade de corte só entra no sistema como valor **medido localmente** (LS-01), nunca como constante herdada. | (R14-25) `curl` → 410 em `cinemetrics.lv`; 403 em `journals.sagepub.com` |
| "meme_gif … injeção de humor abrupto e efémero (**1-2 segundos**)" | **PARCIAL** | 1–2 s é aceitável para GIF **sem texto**. Com texto na tela, 1 s **viola** o piso das duas normas de legibilidade lidas (Netflix: ≥20 frames/≈0,83 s **e** ≤20 CPS ⇒ 20 caracteres já exigem 1 s; DCMP: ≥40 frames ≈1,33 s). O card do meme precisa de dois caminhos: com texto e sem texto. | https://partnerhelp.netflixstudios.com/hc/en-us/articles/215758617-Timed-Text-Style-Guide-General-Requirements ; https://dcmp.org/learn/captioningkey/597 |
| "`durationRestThreshold`… por predefinição situado nos **0.005**" | **CONFIRMADO** | O número está certo. Fica registrado como um dos poucos valores do panorama que sobreviveu à conferência. | https://www.remotion.dev/docs/transitions/timings/springtiming |
| "a redução do limiar para 0.001 **prolonga microscopicamente** a cauda da transição" | **REFUTADO (na palavra 'microscopicamente')** | Pelo modelo que o código do Remotion implementa, o tempo de acomodação vai de ≈1,06 s para ≈1,38 s com a config padrão — **+30%**, ≈10 frames a 30 fps. Isso é uma mudança de ritmo perceptível, não um detalhe. (Número **derivado**; medir com `measureSpring()`.) | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts |
| "diminuir o amortecimento para permitir oscilações rápidas e aumentar a rigidez" (sem números) | **INCOMPLETO** | A grandeza que governa o repique tem nome e fórmula no próprio código: **ζ = damping/(2·√(stiffness·mass))**. O default (1/10/100) já é **ζ = 0,5**, com **16,3% de overshoot** e ≈**1,06 s** até o repouso — mais lento que **todo** token de duração do Material 3. "Fireship" exige `stiffness` maior (ou `durationInFrames`), não só "menos damping". | https://raw.githubusercontent.com/remotion-dev/remotion/main/packages/core/src/spring/spring-utils.ts ; https://raw.githubusercontent.com/material-components/material-web/main/tokens/versions/v0_192/_md-sys-motion.scss |
| "legendas… caracterizadas por um **enorme contraste gráfico** na palavra em foco" | **SEM NÚMERO** | Existe número publicado (4,5:1 normal, 3:1 para ≥18 pt / ≥14 pt negrito) mas ele é da **WCAG, que regula texto em página web** — texto queimado em vídeo está fora do escopo normativo. Adotar é decisão nossa, e o teste tem de rodar **sobre o pixel renderizado**, frame a frame, porque o fundo é vídeo. | https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html |
| Panorama é **silente** sobre loudness; o folclore de produção diz "−14 LUFS é o alvo do YouTube" | **SEM FONTE PRIMÁRIA** | Busca restrita a `support.google.com`/`youtube.com` não devolveu nenhuma página oficial com número. O −14 LUFS documentado pertence à **Spotify** e ao caso "faixa mais alta do álbum" do **AES TD1008** — que, aliás, declara não valer para conteúdo com imagem. | https://support.spotify.com/artists/article/loudness-normalization ; https://aes2.org/wp-content/uploads/2024/01/20210924_TD1008_v3.13.pdf |
| Panorama é **silente** sobre fotossensibilidade | **RISCO NÃO ENDEREÇADO** | ITU-R BT.1702 diz literalmente que **cortes rápidos contam como flash** quando produzem áreas piscantes. O estilo alvo do projeto é definido por cortes rápidos. Sem gate, o produto pode gerar conteúdo que reprova em WCAG 2.3.1 (Nível **A**, o mais básico). | https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1702-0-200502-I!!PDF-E.pdf |
| Fonte de referência habitual "BBC Subtitle Guidelines em `bbc.github.io/subtitle-guidelines`" | **REFUTADO (link morto)** | HTTP **404** na página e **404** no repositório. Os números BBC/Ofcom (160–180 wpm) só apareceram em secundárias nesta sessão e **não** podem sustentar card. | verificação `curl -L -w '%{http_code}'` |
| Uso de PEAT como gate pronto de fotossensibilidade (atalho natural que um card tomaria) | **INVIÁVEL AQUI** | v1.6 de 2017, Windows-only, exige `.AVI`, ~1 GB por 3 min. Não integra em pipeline Linux headless. O gate tem de ser escrito. | https://trace.umd.edu/peat/ |

---

## 4. Armadilhas (falso verde deste domínio)

- **Gate de duração escrito em frames** → parece rigoroso porque cita a Netflix ("20 frames") →
  a 60 fps isso são **0,333 s**, quatro vezes abaixo do piso em segundos das duas normas. *Fica
  vermelho se sumir:* o teste "texto mais curto do vídeo ≥ max(0,833 s; chars/20 CPS)".
- **`ffmpeg -af loudnorm` sem parâmetros** → o log diz "loudness normalization" e o arquivo sai
  diferente → os **defaults** do binário local são `I=-24`, `LRA=7`, `TP=-2`, ou seja **não é**
  EBU R128 (−23 / −1) nem nada que decidimos. *Fica vermelho se sumir:* o assert do valor medido
  por `ebur128` no master final.
- **`loudnorm` em uma passada** → produz um número plausível → sem `measured_I/measured_LRA/
  measured_TP/measured_thresh` o filtro opera em modo dinâmico e **não** garante o alvo. *Fica
  vermelho se sumir:* a comparação medida-antes/medida-depois no golden master.
- **Confundir `ebur128 target=-23` com um alvo aplicado** → o parâmetro existe e aceita −23 → ele só
  desenha a escala do medidor de vídeo; **não normaliza nada**. *Fica vermelho se sumir:* o teste
  que compara LUFS do arquivo de saída, não a flag da linha de comando.
- **Gate de flash que só conta cortes de cena** → passa em todos os vídeos e parece um gate → a
  ITU trata corte rápido como flash **apenas se produzir área que pisca**; o inverso também vale:
  um fundo estroboscópico **sem corte nenhum** reprova. *Fica vermelho se sumir:* a série temporal
  de luminância por frame e por região.
- **Medir contraste no token de cor** → o design system fica "100% AA" → o texto está sobre vídeo,
  GIF e gradiente; o contraste real muda a cada frame. *Fica vermelho se sumir:* a amostragem do
  contraste **no pixel renderizado**, no pior frame.
- **Validar legibilidade no Remotion Studio** → tudo legível em tela cheia de desktop → o vídeo será
  visto em ~360 px de largura. *Fica vermelho se sumir:* o teste que reduz o frame para largura
  mobile antes de julgar.
- **Testar "cabe em 42 caracteres" com texto médio em fonte proporcional** → passa → o pior caso é
  linha cheia de maiúsculas largas (`MMMM`, `WWWW`). *Fica vermelho se sumir:* a fixture de pior
  caso tipográfico.
- **Calibrar mola "no olho" no Studio** → parece snappy → a duração real depende de
  `durationRestThreshold` e da config; sem `measureSpring()` o `TransitionSeries` recebe um número
  de frames que não corresponde à animação. *Fica vermelho se sumir:* o teste que compara
  `measureSpring(config)` com a duração declarada no manifesto.
- **Tratar EBU R 95 como safe area universal** → é uma norma real e citável → ela é **16:9 de
  televisão**; não diz nada sobre a UI que o TikTok desenha por cima do vídeo. *Fica vermelho se
  sumir:* o teste de layout específico para 9:16 com as zonas medidas em LS-05.

---

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| LS-01 | Qual é a duração média de plano e a densidade de corte do estilo alvo? | Adotar provisoriamente **1 corte a cada 2,0 s** como default do gerador de ritmo e ajustar por medição. | `ffmpeg -i ref.mp4 -vf "scdet=threshold=10" -f null - 2>&1 \| grep -c lavfi.scd.score` e dividir pela duração; conferir com `scdet=threshold=5` e `=15` | O parâmetro central do gerador de ritmo; o orçamento de cenas por vídeo de 100 s. |
| LS-02 | Qual é o wpm real da locução que o nosso TTS produz? | Alvo **165 wpm** (centro da faixa 140–183 de R14-05). | contar palavras do roteiro ÷ duração do WAV: `soxi -D voz.wav` (ou `ffprobe -show_entries format=duration`) | O casamento roteiro↔duração; o número de palavras que cabe em 100 s. |
| LS-03 | A que LUFS o nosso master deve sair, dado o destino real? | **−16 LUFS integrado, −1,5 dBTP** como default (entre o −14 social e o −18 de fala do AES), revisável. | medir: `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -` ; validar no destino via *Stats for nerds* do YouTube ("content loudness" deve ficar ≈0,0 dB) | O card de masterização; o gate de loudness; a percepção de "soa baixo". |
| LS-04 | Quantos dB abaixo da locução a música deve ficar? | **−18 dB** relativo à voz durante fala, **−6 dB** nos intervalos (ducking), como ponto de partida. | medir voz e música separadamente com `ebur128` e comparar LUFS integrados; depois teste cego A/B | O card de ducking (R03); a inteligibilidade da narração. **Nenhuma fonte primária foi encontrada com esse número — é chute calibrável, não norma.** |
| LS-05 | Onde ficam as zonas de UI de TikTok, Reels e Shorts? | Reservar **12% no topo** e **20% na base** de um 1080×1920, mais **15% na direita**, até medir. | capturar screenshot do app com um vídeo-régua (grade de 5% em 5%) e ler onde a UI cobre; repetir por plataforma e por versão do app | O teste de layout 9:16; a decisão de exportar vertical. **Números provisórios sem fonte** (R14-22). |
| LS-06 | Quais configs de mola dão "snappy" (≈250 ms) e "suave" (≈500 ms) de verdade? | Derivar por `ω₀ = ln(1/threshold)/(ζ·T)`; snappy ζ=0,7 / suave ζ=1,0. | `measureSpring({fps, config})` do Remotion para cada preset e comparar com o alvo em frames | A tabela de presets do design system (S17); a duração declarada de cada transição. |
| LS-07 | Quais filtros de análise o `ffmpeg` desta máquina oferece e com que defaults? | **Medido nesta sessão:** `ffmpeg 6.1.1-3ubuntu5`; tem `ebur128` (`peak`, `target` default −23, `framelog`, `metadata`), `loudnorm` (`I`=−24, `LRA`=7, `TP`=−2, `print_format`), `scdet` (`threshold` default 10, `sc_pass`), `signalstats`, `blackdetect`, `freezedetect`. | `ffmpeg -hide_banner -h filter=ebur128` / `=loudnorm` / `=scdet` | Todos os gates de áudio e de detecção de corte. Se o CI usar outra versão do ffmpeg, os defaults mudam silenciosamente. |
| LS-08 | Qual é o menor tamanho de fonte que sobrevive ao downscale mobile? | Piso provisório: **altura de caixa ≥ 2,5% da altura do frame** (27 px em 1080p) para texto secundário; ≥5% para texto principal. | renderizar frame, reduzir para 360 px de largura, comparar OCR (`tesseract`) com o texto esperado | O teste automático de legibilidade; a escala tipográfica. **Sem fonte normativa** — a norma existente é relacional (R14-21). |
| LS-09 | O detector de flash próprio reproduz o critério WCAG/ITU? | Implementar janela deslizante de 1 s sobre luminância relativa por região; reprovar >3 pares de transições ≥10% com região escura <0,80. | validar contra clipes sintéticos de referência (3 Hz e 4 Hz, 20% e 30% de área) e conferir que o gate acusa só o 4 Hz / 30% | O gate de acessibilidade — o mais caro de errar (WCAG 2.3.1 é Nível A). |
| LS-10 | O texto renderizado cabe no graphics safe e em 42 caracteres? | Assert em tempo de render: caixa de texto ⊆ retângulo 96..1823 × 54..1025 em 1080p. | medir a bounding box no DOM do Remotion no momento do render e falhar a composição se sair | O teste de layout; qualquer mudança de fonte quebra isso silenciosamente. |
| LS-11 | O AES71-2018 (loudness de som com imagem) diz o quê? | Tratar como desconhecido; não citar. | obter cópia via biblioteca/AES e ler; o TD1008 aponta para ele como a norma correta para OTT | A justificativa formal do alvo de loudness de vídeo (R14-14). |

---

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| Qual é o formato **primário**: 16:9 (YouTube) ou 9:16 (Shorts/Reels/TikTok)? | É escolha de distribuição, não fato técnico. | 16:9 ⇒ safe area EBU R 95 (3,5%/5%) é citável e o teste de layout fecha hoje. 9:16 ⇒ **não há fonte** (R14-22): o teste depende de medição empírica (LS-05) e vira dívida permanente de manutenção a cada update de app. |
| O público é **adulto técnico** ou o vídeo precisa servir acessibilidade educacional? | Depende de mandato, não de norma. | Adulto ⇒ 20 CPS / ~207 wpm (Netflix). Educacional ⇒ 130–160 wpm (DCMP), o que corta **~25% do texto** que cabe em 100 s. |
| WCAG 2.3.1 é **gate bloqueante** (build falha) ou aviso? | É apetite de risco. | Bloqueante ⇒ precisamos de LS-09 antes de qualquer card de "estilo frenético"; e alguns efeitos de transição ficam proibidos. Aviso ⇒ o produto pode publicar conteúdo que reprova em Nível A. |
| Qual alvo de loudness adotamos: −14, −16, −18 ou −23 LUFS? | Cinco normas, cinco números, todos legítimos no seu escopo (R14-12); a escolha depende de onde o vídeo toca. | −14/−16 ⇒ soa "igual aos outros" em plataforma social, com menos dinâmica. −23 ⇒ conformidade broadcast, soa baixo no celular. A escolha fixa o `loudnorm -i` e o gate. |
| Legenda queimada é **obrigatória** em todo vídeo? | É decisão de produto. | Se sim, todo o conjunto de invariantes de legibilidade (42 chars, 2 linhas, piso de duração, safe area) passa a ser **gate bloqueante do render**, não recomendação de estilo. |
| O idioma primário é **pt-BR**? | O contrato de 42 caracteres/linha é calibrado para inglês. | pt-BR tem palavras mais longas: manter 42 chars aumenta a quebra de linha e o número de "páginas" de legenda. Pode ser necessário 37–40 chars/linha ou uma fonte mais condensada — decisão de estilo com custo de reescrever o quebrador. |
| Aceitamos transições **acima de 400 ms**? | É estética, e conflita com o alvo "frenético". | ≤400 ms ⇒ precisamos recalibrar as molas (o default do Remotion leva ≈1,06 s, R14-17) e provavelmente usar `durationInFrames` em toda transição. >400 ms ⇒ o vídeo deixa de parecer com a referência. |
| O sistema pode **recusar-se a renderizar** um roteiro que viole os invariantes, ou só avisa? | É política de produto para o agente de IA. | Recusar ⇒ o agente escritor precisa de feedback estruturado e de um caminho de conserto automático. Avisar ⇒ o gate vira ruído e será ignorado em três semanas. |

---

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** **um único arquivo de constantes** — `motion-invariants.json`, ~15
  chaves — com: `minTextDurationSeconds` (0.833), `maxCpsAdult` (20), `maxCharsPerLine` (42),
  `maxLines` (2), `minSubtitleGapFrames` (2), `actionSafePct` (0.035), `graphicsSafePct` (0.05),
  `minContrastNormal` (4.5), `minContrastLarge` (3.0), `maxFlashesPerSecond` (3), `flashAreaPct`
  (0.25), `flashLuminanceDelta` (0.10), `targetLufs` (LS-03), `maxTruePeakDbtp` (−1.0),
  `narrationWpm` (165). Trocar de plataforma, de público ou de idioma = **editar valores**, não
  código. Custo de reversão: **1 arquivo, ~15 linhas**. Todo gate lê daqui; nenhum número literal
  no código de composição.
  Corolário: o *design system* de mola guarda **(ζ, T)** por preset e converte para
  `{mass, damping, stiffness}` por fórmula (R14-16/R14-17) — trocar "snappy" é mexer em dois
  números, não em quinze configs espalhadas.

- **Skills que devem carregar este conhecimento:**
  - `motion-design-system` (**S17** — dono natural deste cluster: grade de durações, presets de
    mola por (ζ, ω₀), safe areas, escala tipográfica)
  - `falsifiable-gates` (**S05** — os gates de legibilidade, contraste, flash e loudness são
    exatamente "invariante numérico + comando que o verifica")
  - `audio-captions-sync` (**S12** — piso/teto de duração, 2 frames de gap, sincronia com corte,
    CPS)
  - `video-characterization` (**S07** — o golden master precisa comparar LUFS, contraste e
    densidade de corte, não só hash de pixel)
  - `ffmpeg-media-ops` (**S15** — `ebur128`, `loudnorm` com duas passadas, `scdet`, `signalstats`)
  - `remotion-core` (**S09** — os defaults de `spring()` e a armadilha do `durationRestThreshold`)

- **Cards que este cluster condiciona:**
  1. **Gate de legibilidade de texto** — para cada nó de texto do manifesto, verificar
     `duração ≥ max(0.833 s, caracteres/20)` e `≤ 7 s`, `≤ 2 linhas`, `≤ 42 caracteres/linha`.
     Falha = build quebra. Fixture: um nó de 1 caractere e um nó de 84 caracteres.
  2. **Gate de safe area / layout** — nenhuma bounding box de texto fora do retângulo graphics-safe
     (5%); nenhum elemento essencial fora do action-safe (3,5%). Medido no render, não no CSS.
  3. **Gate de fotossensibilidade** (LS-09) — detector próprio, porque PEAT não integra (R14-23).
     Critério: >3 transições de luminância ≥10% em qualquer janela de 1 s, em qualquer região que
     cubra ≥25% de um campo de 10°. Este card **depende de PERGUNTA-DONO** (bloqueante ou aviso).
  4. **Gate de loudness** — medir com `ebur128` no master e comparar com `targetLufs` ±1 LU e
     `maxTruePeakDbtp`. Normalizar com `loudnorm` em **duas passadas** (nunca uma).
  5. **Calibração de molas** (LS-06) — script que, dado (ζ, T), emite a config e confirma com
     `measureSpring()`; a tabela de presets nasce **medida**, não escrita à mão.
  6. **Medição de ritmo de referência** (LS-01) — script `scdet` que produz a distribuição de shot
     length de vídeos de referência; o gerador de ritmo consome a distribuição, não uma constante.
  7. **Orçamento de roteiro** — dado `narrationWpm`, o LLM recebe um teto de palavras por segmento
     (a 165 wpm, 100 s ⇒ **275 palavras**) como restrição do schema de saída, não como sugestão.
