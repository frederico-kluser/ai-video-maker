---
name: manim-bridge
description: 'Provides the Manim-to-Remotion handoff contract - which container/codec/pix_fmt actually preserves alpha, why the output extension changes silently, how Cairo and OpenGL differ, what varies between two identical renders, how to run N scenes in parallel without collision, and which quirks of the 3blue1brown manim-api are worth absorbing. Use whenever a Python process shells out to the manim CLI, whenever a scene asset has to reach a Remotion composition with transparency, and whenever a render "succeeds" without producing a file - even if the user never says "manim". Triggers: "manim", "transparent", "alpha channel", "yuva420p", "qtrle", "webm", "prores", "scene render", "headless render", "media_dir", "write_to_movie", "renderer opengl", "partial_movie_files", "disable_caching", "manim_executor".'
metadata:
  type: knowledge
  tier: dominio
  verification_signal: (.venv/bin/manim --version 2>/dev/null || manim --version 2>/dev/null) | grep -q 0.20.1 && (.venv/bin/manim render --help 2>/dev/null || manim render --help 2>/dev/null) | grep -q -- '-t, --transparent' && ! (.venv/bin/manim render --help 2>/dev/null || manim render --help 2>/dev/null) | grep -qiE 'codec|pix_fmt|--jobs|parallel'
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
# Ponte Manim → arquivo → Remotion

## Quando carregar

- Escrever ou alterar o runner Python que invoca o CLI do Manim: montar o comando, isolar o
  diretório de mídia, descobrir o arquivo de saída, escolher formato e renderer.
- Decidir ou revisar o **formato de handoff** entre a cena Manim e a composição Remotion,
  especialmente com canal alfa.
- Diagnosticar três sintomas específicos: "o render terminou com sucesso e não há arquivo",
  "o vídeo entrou com fundo preto", "a fórmula saiu errada só quando renderizo em paralelo".
- Herdar qualquer coisa do `manim-api` do projeto 3blue1brown.
- **Não carregar** quando a pergunta é como a composição React consome o asset (`remotion-core`),
  como o vídeo final é codificado (`remotion-render-pipeline`), ou qual é a tolerância do oráculo
  visual (`video-characterization`).

## Conhecimento injetado

**Convenção de âncora:** citação com prefixo `3b1b:` é caminho no repositório de **referência**
`/home/ondokai/Projects/3blue1brown` — o `manim-api`, o `venv/` dele e as skills dele. Neste
repositório `manim-api/` **não existe**: sem o prefixo, todo pino abaixo resolve para arquivo
ausente. Citação **sem** prefixo é deste repositório (`PROGRAMA.md`, `docs/…`).

### A forma da ponte: gerador de pré-compilação, nunca serviço

O Manim entra como **processo por cena, terminado antes de o Remotion abrir**. Três fatos fecham
isso, e nenhum é preferência de arquitetura:

- O Manim CE 0.20.1 **não tem paralelismo interno**: nenhuma flag em todo o `manim render --help`,
  e um colaborador do repositório oficial afirma que *"the current architecture of Manim is
  insufficient to handle multithreading correctly"*, sem previsão antes da v0.21.0 —
  **(2-0)** — fonte: https://github.com/ManimCommunity/manim/discussions/3897
- Quem tentou a forma de serviço no projeto de origem colheu o descasamento clássico: o teto
  efetivo por request para cliente remoto (~100 s do túnel) é **menor** que o `render_timeout`
  do servidor (120 s), abrindo uma janela em que o servidor renderiza para ninguém e **nenhum
  dos dois lados registra a discrepância** — **(2-0)** — fonte:
  `docs/pesquisa/L01-reuso-3b1b-codigo.md:686` (claim C12).
- O executor daquele serviço sempre carrega o MP4 inteiro em memória e o codifica em base64
  (`3b1b:manim-api/services/manim_executor.py:188`), e o chamador desfaz — ~2,33× o tamanho do vídeo
  em RAM por render, multiplicado pela concorrência. Leitura de artefato único **(1-0)** — fonte:
  `docs/pesquisa/L01-reuso-3b1b-codigo.md:482-487`. A regra "o runner novo devolve **caminho**"
  não depende desse número: é o delta #5 de `docs/pesquisa/L01-reuso-3b1b-codigo.md:660`.

Consequência de desenho: o contrato do runner é `(código da cena, formato, resolução, seed) →
caminho de arquivo existente`, com o processo já encerrado.

### A pergunta decisiva — que combinação preserva alfa E é consumível

A resposta curta: **`.webm` + `libvpx-vp9` + `yuva420p`, e só se `-t` e `--format=webm` forem
passados juntos.** As quatro peças:

1. Com `-t`, o Manim **CE** resolve a extensão para **`.mov`**, exceto se `--format=webm` (aí
   `.webm`) — o CLI do manimgl é outro e não vale aqui.
   **`--format=mp4 -t` produz `.mov` silenciosamente, com exit 0** — **(3-0)** — fontes:
   https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/_config/utils.py ·
   https://docs.manim.community/en/stable/faq/general.html
2. Esse `.mov` é **`qtrle` + pix_fmt `argb`** (QuickTime Animation RLE, lossless) — **não** é
   ProRes 4444 — **(2-0)** — fontes:
   https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py ·
   https://ffmpeg.org/general.html
3. O `.webm` transparente é **`libvpx-vp9` + `yuva420p`** com `-auto-alt-ref=1`, e o setter de
   `format` loga que webm *"can be slower than other formats"* — **(2-0)** — fontes:
   `scene_file_writer.py` (mesma URL acima) ·
   https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/_config/utils.py
4. Chrome reproduz **WebM VP8/VP9 com canal alfa** desde o Chrome 31; Safari não — **(3-0)** —
   fonte: https://developer.chrome.com/blog/alpha-transparency-in-chrome-video · E o Chromium
   **não decodifica ProRes nem QTRLE**: a lista oficial é AV1/VP8/VP9 (+ H.264 e HEVC só no
   Chrome). O container `.mov` é aceito; o codec dentro dele é que não — **(2-0)** — fonte:
   https://www.chromium.org/audio-video/

**A condição de escopo que não pode cair:** o limite do Chromium vale para `<video>` e para
preview no browser. No render server-side o decoder do Chrome **não está no caminho crítico**:
`<OffthreadVideo>` extrai o frame *fora* do browser com FFmpeg, e a prop `transparent` troca a
extração de BMP para PNG — **(2-0)** — fontes: https://www.remotion.dev/docs/offthreadvideo ·
https://www.remotion.dev/docs/transparent-videos. **Mas** a lista documentada do Remotion é
H.264, H.265, VP8, VP9, AV1 e ProRes, e **não menciona QTRLE** — por isso o `.mov` default é
caminho *não confirmado*, não caminho alternativo (ver `## Não verificado`).

**A saída sem decoder nenhum:** `--format=png` grava **todos** os frames (não só o último) num
subdiretório, com `-0/--zero_pad`; com `-t` saem RGBA — **(3-0)** — fontes:
`scene_file_writer.py` · https://docs.manim.community/en/stable/guides/configuration.html

**Não existe atalho de codec pelo CLI.** O Manim CE 0.20.1 **não expõe** nenhuma opção de codec,
pix_fmt, bitrate ou passthrough de ffmpeg — codec e pix_fmt são hardcoded em
`open_partial_movie_stream` — **(2-0)** — fonte:
https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py
E desde a 0.19.0 o **CE** (e só ele — o manimgl continua exigindo FFmpeg de sistema) **não usa
ffmpeg externo** (encoda via `pyav`), então não há binário no meio do caminho para injetar flag:
ProRes ou `bitexact` exigem um **passo de transcode próprio depois**, com `ffmpeg` declarado como
dependência **nova** do container — **(2-0)** — fontes:
https://raw.githubusercontent.com/ManimCommunity/manim/main/pyproject.toml ·
`docs/pesquisa/R07-manim-headless-alpha.md:63`

**Regra de superfície:** a extensão muda com a flag, então o nome do arquivo **não pode vazar
para dentro das cenas Remotion** — o formato de handoff é uma constante do runner mais um
componente na composição, e é o ponto de troca barata do programa — fonte:
`docs/00-panorama-verificado.md` §5.1, linha «Formato de handoff Manim→Remotion» (claim R07-06).

### Cairo × OpenGL — o que quebra, e por que `--write_to_movie` é obrigatório

- `--renderer [cairo|opengl]` existe, default `cairo` — **(2-0)** — fonte: `render_options.py`
  (URL acima). Trocar o renderer troca as **classes base** dos mobjects em runtime, e é por isso
  que a paridade quebra por mobject, não por renderer inteiro.
- **Sem `--write_to_movie`, o renderer OpenGL executa as animações e não escreve arquivo** — o
  mecanismo é do Manim; a mensagem que o usuário vê é do chamador. No executor de origem chega o
  genérico "Video file not found after render"
  (`3b1b:manim-api/services/manim_executor.py:183`), e é aí que **a mensagem mente sobre a
  camada** (aponta para descoberta de arquivo, não para "nada foi escrito"). Num runner novo, quem
  escolhe a mensagem é você — e o texto certo nomeia o flag —
  **(4-0)** — fontes:
  `3b1b:manim-api/services/manim_executor.py:233` (o flag) · `:183` (a mensagem) ·
  `3b1b:manim-api/venv/.../manim/_config/utils.py:849-851`
  (`if self.renderer == RendererType.OPENGL and args.write_to_movie is None: self["write_to_movie"] = False`)
  · `--help` do binário instalado · commit `922e47d`.
- O contexto OpenGL é criado **headless** por `moderngl.create_context(standalone=True)` com
  fallback explícito para `backend="egl"`, e a janela só aparece com `preview` **e sem**
  `write_to_movie`/`format`/`save_last_frame`/`dry_run` — **(2-0)** — fontes:
  https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/renderer/opengl_renderer.py ·
  https://moderngl.readthedocs.io/en/latest/techniques/headless_ubuntu_18_server.html
  *Ausência de janela não é evidência de GPU nem de velocidade* — é o comportamento normal de
  qualquer render com `--format`.
- Paridade **incompleta**: a própria doc admite que `OpenGLMobject`/`OpenGLVMobject` não estão
  documentadas; `StreamLines` falha só com `--renderer=opengl` (issue #3789, **relatada na 0.18.1**,
  nunca reconferida na 0.20.1); e a única medição pública dá **CE/OpenGL 36 s vs Cairo 24 s vs
  manimgl 8 s** — OpenGL **mais lento que Cairo**. **A condição que não pode cair:** esse número é
  de 2021, de uma issue ainda aberta, em versão anterior à 0.20.1 — o card de OpenGL está bloqueado
  por **ausência de medição atual**, não por uma medição atual desfavorável —
  **(2-0)** — fontes: https://docs.manim.community/en/stable/faq/opengl.html ·
  https://github.com/ManimCommunity/manim/issues/3789 ·
  https://github.com/ManimCommunity/manim/issues/1957
- Invertido em relação ao folclore: `--use_projection_stroke_shaders` e
  `--use_projection_fill_shaders` são do **CE**, não do manimgl — **(2-0)** — fonte:
  `render_options.py` (URL acima).

Postura operacional: fixar `cairo`, passar `--write_to_movie` sempre (é o que o OpenGL exige e o
efeito colateral no Cairo não foi medido — ver `## Não verificado`), e tratar qualquer card
"trocar para OpenGL para acelerar" como **bloqueado por medição nesta máquina**.

### Determinismo — o que varia entre duas execuções idênticas

- O Manim **não produz saída bit-exata por construção**: não configura `bitexact` em lugar
  nenhum e grava `metadata["comment"] = "Rendered with Manim Community v<versão>"` **dentro do
  container**; a concatenação final é stream-copy, então o determinismo do arquivo final se
  reduz ao dos partials — **(2-0)** — fontes: `scene_file_writer.py` ·
  https://ffmpeg.org/ffmpeg-formats.html (`bitexact` é literalmente o flag que faria *"only
  write platform-, build- and time-independent data"*) ·
  https://manpages.debian.org/unstable/x264/x264.1.en.html (existe `--non-deterministic`, não
  existe `--deterministic` — o default do x264 é o repetível, mas o Manim não expõe opção nenhuma
  do x264, então o número de threads fica a cargo da máquina).
- **Corolário duro:** bump de versão do Manim muda os bytes **por definição**, porque a versão
  vai gravada no arquivo — o placar disso é o do metadata acima, **(2-0)**, não o da versão.
  Que a estável seja **0.20.1** é que tem **(3-0)** — fonte: https://pypi.org/project/manim/ — e é
  o par dos dois que faz do pin `manim==0.20.1` + tag Docker `v0.20.1` requisito do oráculo.
- `--seed INTEGER` controla o **RNG da cena**, não o encoder — **(2-0)** — fonte:
  https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/global_options.py
  Se a cena é gerada por LLM, o seed vai **no template**, nunca no prompt.
- O mapa de qualidade é `l`=854x480@15, `m`=1280x720@30, `h`=1920x1080@60, **`p`=2560x1440@60**,
  **`k`=3840x2160@60**, default `high_quality` — **(3-0)** — fonte:
  https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/constants.py
  A letra **não** é mnemônica de resolução e tutoriais trocam `p` e `k`; o gate asserta
  `pixel_width/pixel_height` do arquivo, nunca a letra da flag.
- O artefato comparável é **PNG por frame**, não bytes de vídeo: lossless, sem codec, sem
  metadata de encoder — **(3-0)** — fonte: `scene_file_writer.py`.
- Com LaTeX na cena, o determinismo passa a depender **também** da versão da distribuição TeX,
  que vira mais uma linha do lock de ferramentas — fonte: `docs/00-panorama-verificado.md` §5.2,
  linha «LaTeX sim/nao no container do Manim».

### Cache: o do Manim, e o do programa

- O cache do Manim é **por play call**, não por cena: hash **CRC32** de camera+animations+mobjects
  gravado como `<hash><ext>` em `partial_movie_files`. O hash extrai o **código-fonte** de funções
  via `inspect.getsource()` e **trunca arrays numpy acima de 1000 elementos** para uma amostra
  (100,100). `--disable_caching` desliga **o uso** ("still generates cache files"); `--flush_cache`
  remove — **(2-0)** — fontes: `global_options.py` (URL acima) ·
  https://docs.manim.community/en/stable/_modules/manim/utils/hashing.html
- Três consequências que ninguém deduz do nome: (a) mudar um comentário dentro de um lambda
  invalida o cache; (b) duas cenas que só diferem **além** da truncagem podem colidir e reusar o
  vídeo errado; (c) CRC32 é checksum, não hash criptográfico — colisão é possível por construção.
  Por isso o gate de CI roda com `--disable_caching`, e **queda súbita do tempo de CI é alarme**.
- O cache **do programa** (por hash do código da cena) é outra camada e não deve ser confundido
  com o do Manim. A chave tem de incluir o lock de ferramentas (Manim, distribuição TeX,
  ffmpeg de transcode): mesma chave com ferramenta diferente = saída diferente = falso verde, e
  corrigir a chave depois invalida **todo** o cache existente — fontes: claim `R12-24·R12-25` e
  `docs/00-panorama-verificado.md` §5.2, linha «Chave do cache de assets».

### Paralelizar N cenas sem colisão

Sem paralelismo interno (acima), o paralelismo é **nosso**: N processos, um por cena. O que
colide não é a CPU, é o diretório:

- `media/Tex/` e `media/text/` são **compartilhados por padrão** e as notas de correção da 0.20.0
  listam *"directory creation race conditions"* entre os bugfixes — corridas **existiam** —
  **(2-0)** — fonte: `docs/pesquisa/R07-manim-headless-alpha.md:238-244` ·
  https://docs.manim.community/en/stable/guides/configuration.html (`--media_dir PATH` — *"Path
  to store rendered videos and latex"*).
- O modo de falha esperado é **intermitente e mudo**: um `.tex` meio escrito lido por outro
  processo produz **fórmula errada, não erro**; os N processos saem todos com exit 0. Isso é
  **dedução, não medição** — a colisão de fato nunca foi reproduzida (AB-036 do panorama), o que
  muda o *tamanho* do risco e não a decisão de isolar.
- A mitigação óbvia — `--media_dir` por processo — **duplica a compilação LaTeX por cena e perde
  o cache de Tex entre cenas**. Isso não é uma variável, é uma arquitetura: isolar garante
  segurança e destrói a taxa de acerto do cache; compartilhar preserva o cache e exige código de
  lock nosso — fonte: `docs/00-panorama-verificado.md` §5.2, linha «`media_dir` isolado por
  processo × compartilhado com lock». A decisão provisória é **isolar até medir**, e a métrica que
  decide é *cache hit rate*, não tempo de parede (tempo de parede confunde cache com máquina
  ociosa) — fonte: **AB-037** do panorama (§7.3), que a declara métrica obrigatória.
- Contenção secundária: o LaTeX é opcional no Manim CE (`pycairo` e `manimpango` não são), então
  um pipeline só com `Text`/Pango torna o paralelismo trivial e o container magro — **(2-0)** —
  fonte: https://docs.manim.community/en/stable/installation/uv.html

### Reuso do `manim-api` (3blue1brown) — o que vale copiar

A conta que decide: **9 símbolos consumidos contra 1.447 linhas publicadas** — e o executor novo
que os substitui cabe em ~120 linhas, daí o 12:1 da pesquisa (1.447 ÷ ~120, **não** 1.447 ÷ 9). O
conhecimento não-inferível cabe em ~25 linhas — **(2-0)** — fonte:
`docs/pesquisa/L01-reuso-3b1b-codigo.md:684` (claim C10). Portanto: **absorver os fatos,
reescrever o código; importar zero símbolos.**

| quirk que vale copiar | onde | por que não é inferível | placar |
|---|---|---|---|
| Monkey-patch `BackgroundRectangle.tex_string = ""` prefixado a todo script | `3b1b:manim-api/services/manim_executor.py:30-35`, aplicado em `:220` | o nome não sugere LaTeX; a causa é `assert hasattr(mobject, "tex_string")` em `3b1b:manim-api/venv/.../manim/animation/transform_matching_parts.py:292`, e `3b1b:manim-api/venv/.../geometry/shape_matchers.py:83` não define o atributo | **(3-0)** |
| `--write_to_movie` sempre no comando — a exigência é **do renderer OpenGL**; no Cairo o efeito não foi medido | `3b1b:manim-api/services/manim_executor.py:233` | o flag parece redundante e o erro que a ausência produz aponta para a camada errada | **(4-0)** no escopo OpenGL |
| Sanitizar `CYAN → TEAL` (e `_A.._E`) em código gerado | `3b1b:manim-api/services/openai_service.py:46-53` + `:220-226` | `CYAN` existe no Manim, **mas não no namespace de `from manim import *`** — só em XKCD/SVGNAMES/DVIPSNAMES; o `NameError` estoura **dentro do subprocess de render** | **(3-0)** |
| Reescrever `add_background_rectangle(fill_opacity=…)` → `opacity=` **só nesse método** | `3b1b:manim-api/services/openai_service.py:208-212` | `fill_opacity` é correto em quase todo o resto do Manim; aqui colide com `**kwargs` e o erro é `TypeError: got multiple values`, não "unexpected keyword" | **(3-0)** |
| Remover `tip_style=` de `add_tip(...)`, mantendo os demais kwargs | `3b1b:manim-api/services/openai_service.py:213-218` | `tip_style` é nome de ManimGL; o CE expõe `tip_shape` | **(2-0)** |
| Detecção de GPU com a **regra do "E"** e fallback | `3b1b:manim-api/services/manim_executor.py:70-130` | ter GPU não basta e ter Manim com OpenGL não basta: `:97-99` e `:110` exigem os dois — um agente escreveria `or`. O fallback **remove** o flag em vez de passar `--renderer=cairo` (`:262-263`) | **(1-0)** |
| Descobrir o arquivo em vez de montar o caminho | `3b1b:manim-api/services/manim_executor.py:48-59` + https://docs.manim.community/en/stable/tutorials/output_and_config.html | a subpasta de qualidade (`media/videos/<script>/<WxH><fps>/`) depende de flags que o chamador nem passou | **(2-0)** |

Linhas com **(1-0)** são leitura de artefato único: o código está lá, mas nenhuma segunda fonte
corrobora — trate-as com o mesmo ceticismo de `## Não verificado`.

**Copiar a função, não importar o módulo:** `sanitize_code` é AST puro e não toca a rede
(`3b1b:manim-api/services/openai_service.py:188-236`), mas qualquer import do módulo constrói o
cliente OpenAI em escopo de módulo (`3b1b:manim-api/services/openai_service.py:18`) — e o próprio
executor de vídeo é **inimportável** sem `OPENAI_API_KEY` — **(3-0)** — fonte:
`docs/pesquisa/L01-reuso-3b1b-codigo.md:680` (claim C06).

### Reuso do `manim-api` — o que não vale copiar

| o que | por que | placar |
|---|---|---|
| `find_video` (`3b1b:manim-api/services/manim_executor.py:48-59`) como utilitário pronto | varre só `*.mp4` nos dois ramos; render com `-t` escreve `.mov`/`.webm` ⇒ devolve `None` ⇒ o pipeline reporta "Video file not found after render" **com `returncode == 0`** — falha em silêncio no cenário exato que este programa precisa | **(3-0)** |
| `RenderResult.video_path` | aponta para dentro de um `tempfile.TemporaryDirectory` (`:216`) destruído no `return` (`:267`); o campo tem o nome certo, o tipo certo e devolve caminho morto | **(2-0)** |
| A blocklist AST como se fosse defesa | bloqueia **nomes**, não capacidades: o código roda por `subprocess.run` na conta do usuário, sem container, com `os.environ.copy()` inteiro — enquanto `3b1b:manim-api/prompts.py:4` afirma ao modelo que o ambiente é isolado | **(3-0)** |
| `prompts.py` (373 linhas) como base de conhecimento | documenta **0.19.0** enquanto o runtime é **0.20.1**, e injeta as "mudanças críticas" da versão errada em todo system prompt | **(8-1)** |
| Acoplamento a OpenAI/FastAPI em geral | o que tem placar é o executor **inimportável** sem chave (C06) e a ausência de sandbox (C14); CORS `*`, OPTIONS respondendo 200 em rota inexistente, base64 obrigatório e DTOs de wire são leitura de artefato (`3b1b:manim-api/main.py:30-58`, `3b1b:manim-api/schemas.py:5-45`) | **(3-0)** para C06/C14 |
| A skill `manim-rendering` do 3b1b como conhecimento pronto | a única citação com hash do corpus (`3b1b:manim-api/services/manim_executor.py:225@922e47d`) aponta para a linha errada **e já estava errada no commit que ela pina** — fonte: `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:559-571` (claim C10). Junto vêm 5 pinos de linha mortos, um `verification_signal` (`3b1b:.agents/skills/manim-rendering/SKILL.md:6`) com `from manim-api.services…` — hífen não é identificador Python, logo o gate só pode falhar (**L01-C15**, não o C15 do L02, que é outro claim) — e `3b1b:.agents/skills/manim-rendering/SKILL.md:114` afirmando "the GIL is held during the entire render" quando o render é **processo filho** | **(3-0)** para o pin errado; **(1-0)** para os outros três |

Duas decisões de produto disfarçadas de detalhe de CLI, que viajam junto se alguém copiar o
`base_cmd`: `--fps 60` literal (`3b1b:manim-api/services/manim_executor.py:228-229`) e a inserção
**posicional** do flag de renderer (`cmd.insert(2, …)`, `:246-248`), que passa a cair no meio de um
par flag/valor se alguém reordenar a lista — e não há teste nenhum no repositório.

## Conhecimento negativo — o que um profissional competente faria e aqui está errado

- **Não descubra o arquivo de saída pelo `.mp4` mais recente.** O executor de origem ordena por
  `st_mtime` decrescente e, se o casamento por nome falhar, devolve `candidates[0]` — qualquer
  mp4 mais novo, incluindo fragmentos de `partial_movie_files/`
  (`3b1b:manim-api/services/manim_executor.py:51-55`, `:59`). Com N processos no **mesmo**
  `media_dir`, "o mais recente" pode ser de outra cena.
  **A condição que separa os dois modos de falha:** o partial herda `movie_file_extension`
  (`<hash><ext>`), então num render `-t` os partials são `.mov` — o glob `*.mp4` não acha **nada** e
  a função devolve `None`. O fallback `candidates[0]` só morde quando existe algum `.mp4` na
  árvore: render **não**-transparente, ou `media_dir` compartilhado/sujo. Quem lê "devolve `None`"
  e "devolve o mp4 errado" como o mesmo bug conserta um e deixa o outro.
  A regra correta: extensão **derivada do formato pedido**, casamento exato do nome da cena,
  `partial_movie_files/` excluído explicitamente, e **sem fallback** — não casou, é erro.
- **Não trate `manim` retornando 0 como prova de render.** `--format=mp4 -t` sai 0 e entrega
  `.mov`; OpenGL sem `--write_to_movie` sai sem escrever nada. O gate é a existência de
  `<Cena>.<ext-esperada>`, nunca o exit code.
- **Não parametrize o comando com `-c:v`/`-pix_fmt`.** Não são flags do Manim; o comando morre
  ou é ignorado. Transparência é `-t` **mais** `--format=webm`, e ProRes é transcode posterior.
- **Não escreva o gate de regressão como `sha256` do vídeo.** Sem `bitexact`, e com a versão do
  Manim gravada dentro do container, ele pisca vermelho por motivo irrelevante em outra máquina —
  e a reação humana a isso é desligar o gate, que é o pior desfecho possível.
- **Não confie no `--seed` para reprodutibilidade de arquivo.** Ele resolve o RNG da cena e nada
  do encoder; confundir os dois faz o time procurar não-determinismo no lugar errado.
- **Não trate a ausência de LaTeX como erro de setup que aparece sozinho.** LaTeX é oficialmente
  opcional no Manim, então nada falha no boot: a ausência vira erro de LaTeX **dentro** do
  subprocess, no meio de uma cena. O preflight tem de provar TeX com um valor conhecido, não
  checar se a pasta existe.
- **Não herde a detecção automática de renderer só porque ela existe.** Ela só faz sentido sob
  `MANIM_RENDERER=auto`, e a postura deste programa é `cairo` fixo — o que apaga a função inteira,
  não a otimiza. Se ainda assim você a mantiver: no executor de origem ela roda **dentro** de cada
  render (`3b1b:manim-api/services/manim_executor.py:238`), sem `lru_cache`, custando até 3 spawns
  de subprocess por render — enquanto a resolução de TeX Live, ao lado, é cacheada no import
  (`:28`). A inconsistência é o achado, e ela viaja junto com o `base_cmd` se alguém copiar o
  bloco.
- **Não reuse o cache do Manim entre execuções de CI.** `--disable_caching` continua **gravando**
  arquivos de cache; para limpar é `--flush_cache`. Quem assume que a flag limpa acumula disco
  por worktree.
- **Não escreva citação de proveniência à mão.** O único pin com hash do corpus de origem
  (`3b1b:manim-api/services/manim_executor.py:225@922e47d`) estava errado no próprio commit que
  ele pina — **(3-0)** — fonte: `docs/pesquisa/L02-reuso-3b1b-infra-skills.md:559-571` (C10).
  Citação que ninguém checa lê como verificada para sempre; gere o pin do arquivo, não da memória.

## Falso verde deste domínio

| O que parece verde | Por quê não é | O que fica vermelho se sumir |
|---|---|---|
| `manim -t --format=mp4` sai 0 e loga "File ready" | o arquivo é `.mov`, não `.mp4` (3-0) | gate "existe `<Cena>.<ext-esperada>`"; um gate de exit code não pega |
| O webm "abre no Chrome" | alfa só entra se `transparent` **e** extensão `.webm`; perder o `-t` derruba o pix_fmt para `yuv420p` e o vídeo entra com **fundo preto**, sem erro (2-0) | `ffprobe -show_entries stream=pix_fmt` exigindo `yuva420p` |
| O segundo render ficou 10× mais rápido | pode estar reusando o partial errado: CRC32 com truncagem de array (2-0) | `--disable_caching` no CI + tratar queda súbita de tempo como alarme |
| `sha256` do vídeo bate na sua máquina | sem `bitexact` e com a versão gravada dentro do container, não bate na do colega (2-0) | comparação PNG por frame |
| N processos `manim` terminam todos com exit 0 | `media/Tex/` compartilhado produz **fórmula errada, não erro** — diretório compartilhado e corridas já corrigidas na 0.20.0 são (2-0), mas a colisão em si é **não medida** (AB-036) | `--media_dir` por processo + comparação de frame contra o golden master |
| `find_video` devolveu um mp4 | pode ser fragmento de `partial_movie_files/` ou de outra cena concorrente (3-0) — só em render **não**-transparente: com `-t` os partials são `.mov` e a função devolve `None` | sonda negativa: plantar um `.mp4` decoy **mais novo** em `partial_movie_files/` e exigir que o runner **erre** em vez de devolvê-lo |
| OpenGL "não abriu janela, logo está headless e rápido" | `should_create_window` é falso em **qualquer** render com `--format` (2-0) | benchmark `cairo` × `opengl` na mesma cena com `/usr/bin/time` (AB-033 do panorama); sem esse número o card de OpenGL fica bloqueado |
| O render OpenGL terminou sem erro | sem `--write_to_movie` ele não escreve nada, e o erro que chega culpa a descoberta de arquivo (4-0) | sonda negativa: rodar `--renderer=opengl` **sem** o flag e exigir que o runner falhe com uma mensagem que **nomeie `--write_to_movie`**. Se sumir, volta a mensagem que manda o time depurar o `find_video` — que está correto — enquanto a causa está no comando |
| `docker run manimcommunity/manim:latest` funciona hoje | `latest` aponta para `main`, não para release (2-0) | asserção de `manim --version` contra o valor pinado |

## O que esta skill NÃO cobre

- Como a composição consome o asset (`<OffthreadVideo>`, `<Img>`, `staticFile`, `delayRender`):
  **`remotion-core`**.
- Codec, concorrência, chunks e aceleração do render final: **`remotion-render-pipeline`**.
- Transcode pós-Manim (ProRes, webm otimizado), loudness, `ffprobe` como ferramenta:
  **`ffmpeg-media-ops`**.
- Tolerância do oráculo visual, normalização e captura de golden master:
  **`video-characterization`**; a forma do gate e a sonda negativa: **`falsifiable-gates`**.
- Isolamento por worktree, barreira de onda e propriedade de arquivo: **`parallel-worktrees`**.
- Como pedir a cena ao modelo (prompt, schema, validação, retry): **`llm-authoring`**.
- Onde a cena entra no tempo do vídeo: **`timeline-manifest`**. Animação de código-fonte:
  **`code-animation`**.

## Não verificado

Nada aqui tem placar ≥2-0. Cada item traz o comando que fecha a lacuna.

1. **`<OffthreadVideo>` lê `.mov` `qtrle`?** A doc do Remotion lista ProRes e omite QTRLE.
   Fecha com: `<OffthreadVideo src={staticFile("Cena.mov")} transparent />` + `npx remotion
   render`, conferindo se o frame sai com alfa ou preto. Enquanto aberto, o `.mov` default não é
   caminho de handoff.
2. **O Chromium do Remotion renderiza o webm-alfa gerado pelo Manim, ponta a ponta?** Fecha com:
   1 frame com `<OffthreadVideo transparent>` sobre fundo magenta; o magenta tem de sumir.
3. **Dois renders idênticos produzem PNGs byte-iguais?** Fecha com: dois `--format=png -t
   --disable_caching` e `diff -r`. Se não baterem, o gate precisa de tolerância (SSIM/limiar) e
   isso é outro card. (O chunk `tIME` do PNG é opcional e a Pillow não o escreve por default —
   também não confirmado.)
4. **O Cairo escreve vídeo SEM `--write_to_movie`, e o flag tem efeito colateral nele?** O help
   fala só de OpenGL; o comportamento default do Cairo não foi verificado por fonte primária
   (AB-040 do panorama + L01-U07). Fecha com: render Cairo com e sem o flag, comparando a árvore de
   saída. Se o Cairo **não** escrever sem o flag, todo comando de render que o omite falha mudo.
5. **`--renderer=opengl` sobe em container sem GPU e sem X, só com EGL/Mesa?** O guia do ModernGL
   sobe `Xvfb` antes do exemplo com EGL. Fecha com: `docker run --rm -e DISPLAY=
   manimcommunity/manim:v0.20.1 manim -ql --renderer=opengl --write_to_movie scene.py Cena`.
6. **O monkey-patch de `BackgroundRectangle` ainda é necessário em 0.20.1?** A cadeia de código
   está provada; o disparo não. Fecha com: cena com `add_background_rectangle()` +
   `TransformMatchingTex`, **sem** o patch, esperando `AssertionError`.
7. **A resolução de TeX Live por glob (`3b1b:manim-api/services/manim_executor.py:17-28`) assume o
   layout do instalador oficial** (`~/texlive/<ano>/bin/<arch>`), e é avaliada **no import** —
   instalar TeX com o processo no ar não tem efeito até reiniciar. Leitura de artefato único
   (1-0). Fecha com: `ls -d ~/texlive/*/bin/*` no host alvo.
8. **O disparo real do fallback de `find_video`** — que `candidates[0]` devolva de fato um
   fragmento de `partial_movie_files/` ou a saída de outro processo é dedução da árvore
   documentada, não observação (1-0, PROVÁVEL). Fecha com: render **não**-transparente (com `-t` os
   partials são `.mov` e não há `*.mp4` para o fallback pegar) com `-o nome_diferente`, listando
   todos os `.mp4` da árvore e assertando qual foi escolhido. A regra "sem casamento exato é erro"
   não depende deste item — depende do formato da função, que está provado.
9. **`sanitize_code` devolve o texto original quando nada muda e o texto reimpresso por
   `ast.unparse` quando algo muda** (`3b1b:manim-api/services/openai_service.py:228-236`) — logo a
   mesma cena lógica pode render dois hashes diferentes conforme a sanitização dispare ou não.
   Leitura de artefato único (1-0). Fecha com: `sanitize_code(src) is src` para um fonte limpo e
   um sujo, comparando os hashes. Enquanto aberto, normalize com `ast.unparse` **antes** de
   hashear.

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
