# R07 — Manim: CE vs GL, headless, transparência e desempenho

**Escopo desta pesquisa:** fecha o que é público e datável sobre Manim Community 0.20.1 — versão/requisitos, a flag `-t`, o codec real que sai com alpha, o renderer OpenGL, cache e paralelismo — e o que Chrome/Remotion conseguem consumir desse arquivo.
**NÃO responde:** números de tempo de render, tamanho de arquivo e igualdade byte-a-byte nesta máquina — isso é medição, não pesquisa, e desce para a seção 5.

*Convenção de independência usada aqui (mais dura que o contrato, de propósito):* `github.com/ManimCommunity/manim` e `raw.githubusercontent.com/ManimCommunity/manim` contam como **uma** fonte (o repositório). `docs.manim.community` conta como outra, mas **é gerada do mesmo repositório** — onde um claim fecha só com esses dois, marco `PROVÁVEL` e explicito que a corroboração é fraca em independência ainda que a evidência seja o código literal. Data de coleta: **2026-08-10**.

## 1. Claims verificados

| # | Claim (afirmação falsificável, uma frase) | Placar | Rótulo | Fonte primária |
|---|---|---|---|---|
| R07-01 | A versão estável do Manim Community é **0.20.1**, publicada em 2026-02-27 (0.20.0 em 2026-02-20, 0.19.2 em 2026-01-17, 0.19.1 em 2025-12-01, 0.19.0 em 2025-01-20). | (3-0) | CONFIRMADO | https://pypi.org/project/manim/ |
| R07-02 | O Manim CE 0.20.1 exige **Python >= 3.11** e declara classifiers para 3.11, 3.12, 3.13 e 3.14. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/pyproject.toml |
| R07-03 | Desde a v0.19.0 (2025-01-20) o Manim CE **não exige `ffmpeg` externo**: o encoding passou a usar `pyav` (`av>=15.0`), distribuído em wheels binários. | (2-0) | PROVÁVEL | https://docs.manim.community/en/stable/changelog/0.19.0-changelog.html |
| R07-04 | LaTeX é **opcional** no Manim CE ("technically optional if rendering plain text is sufficient"); Cairo e Pango **não são** — `pycairo` e `manimpango` são dependências de runtime. | (2-0) | PROVÁVEL | https://docs.manim.community/en/stable/installation/uv.html |
| R07-05 | A flag `-t, --transparent` **existe** no Manim CE 0.20.1, com o help literal "Render scenes with alpha channel." | (3-0) | CONFIRMADO | https://docs.manim.community/en/stable/guides/configuration.html |
| R07-06 | Com `-t`, o Manim CE resolve a extensão para **`.mov`**, exceto se `--format=webm` (aí `.webm`); `--format=mp4 -t` produz **`.mov` silenciosamente**. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/_config/utils.py |
| R07-07 | O `.mov` transparente do Manim CE é codificado com **`qtrle` + pix_fmt `argb`** — **não** é ProRes 4444. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py |
| R07-08 | O `.webm` transparente do Manim CE é **`libvpx-vp9` + pix_fmt `yuva420p`** com `-auto-alt-ref=1`, e o setter de `format` loga aviso de que webm "can be slower than other formats". | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py |
| R07-09 | O CLI do Manim CE 0.20.1 **não expõe nenhuma opção de codec, pix_fmt, bitrate ou passthrough de ffmpeg** — codec e pix_fmt são hardcoded em `open_partial_movie_stream`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py |
| R07-10 | Chrome reproduz **WebM com VP8/VP9 e canal alpha** (desde Chrome 31, anúncio de 2013-07-25); Safari não. | (3-0) | CONFIRMADO | https://developer.chrome.com/blog/alpha-transparency-in-chrome-video |
| R07-11 | Chromium/Chrome **não decodifica ProRes nem QTRLE**: a lista oficial de codecs de vídeo é AV1/VP8/VP9 (+ H.264 e HEVC só no Chrome), e nenhum dos dois aparece. | (2-0) | PROVÁVEL | https://www.chromium.org/audio-video/ |
| R07-12 | O `<OffthreadVideo>` do Remotion extrai frames **fora do browser** ("This extraction process happens outside the browser using FFmpeg") e suporta ProRes; o prop `transparent` (v4.0.0) extrai frames como PNG para preservar alpha. | (2-0) | PROVÁVEL | https://www.remotion.dev/docs/offthreadvideo |
| R07-13 | `--renderer [cairo\|opengl]` **existe** no Manim CE 0.20.1, com default `cairo`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py |
| R07-14 | `--use_projection_stroke_shaders` e `--use_projection_fill_shaders` **existem no Manim CE 0.20.1** (não são exclusivas do manimgl); a página de configuração do manimgl lista todas as suas flags e nenhuma das duas está lá. | (2-0) | PROVÁVEL | https://docs.manim.community/en/stable/reference/manim._config.utils.ManimConfig.html |
| R07-15 | O renderer OpenGL do CE cria contexto **headless** via `moderngl.create_context(standalone=True)` com fallback explícito para `backend="egl"`, e só abre janela se `preview` e **não** `write_to_movie`/`format`/`save_last_frame`/`dry_run`. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/renderer/opengl_renderer.py |
| R07-16 | `--write_to_movie` existe e é descrita como "Write the video rendered with opengl to a file" — é a chave que troca janela por arquivo no caminho OpenGL. | (2-0) | PROVÁVEL | https://docs.manim.community/en/stable/guides/configuration.html |
| R07-17 | O renderer OpenGL do CE tem **paridade incompleta** com o cairo: a própria doc admite que as classes `OpenGLMobject`/`OpenGLVMobject` não estão documentadas, e há bugs abertos (StreamLines #3789 em 0.18.1; performance #1957 aberta desde 2021-08-24). | (2-0) | PROVÁVEL | https://docs.manim.community/en/stable/faq/opengl.html |
| R07-18 | O mapa de qualidade é `l`=854x480@15, `m`=1280x720@30, `h`=1920x1080@60, **`p`=2560x1440@60**, **`k`=3840x2160@60**, e `DEFAULT_QUALITY = "high_quality"`. | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/constants.py |
| R07-19 | O cache do Manim é por *play call*: hash **CRC32** de camera+animations+mobjects, gravado como `<hash><ext>` em `partial_movie_files`; `--disable_caching` "Disable the use of the cache (**still generates cache files**)" e `--flush_cache` remove. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/global_options.py |
| R07-20 | O Manim CE 0.20.1 **não tem render paralelo de cenas**: não há nenhuma flag de paralelismo em todo o `manim render --help`, e um mantenedor afirma que "the current architecture of Manim is insufficient to handle multithreading correctly", sem previsão antes da v0.21.0. | (2-0) | PROVÁVEL | https://github.com/ManimCommunity/manim/discussions/3897 |
| R07-21 | O Manim CE **não produz saída bit-exata por construção**: não configura `bitexact` em lugar nenhum e grava `metadata["comment"] = "Rendered with Manim Community v<versão>"` no container; pelo FFmpeg, `bitexact` é justamente o flag que faria "only write platform-, build- and time-independent data". | (2-0) | PROVÁVEL | https://ffmpeg.org/ffmpeg-formats.html |
| R07-22 | Existe `--seed INTEGER` ("Set the random seed to allow reproducibility"), adicionada na v0.20.0 — controla o RNG da cena, **não** o determinismo do encoder. | (2-0) | PROVÁVEL | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/global_options.py |
| R07-23 | `--format=png` grava **todos** os frames como PNG (não só o último), em subdiretório, com `-0/--zero_pad`; com `-t` os PNGs saem com fundo transparente (RGBA). | (3-0) | CONFIRMADO | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py |
| R07-24 | Existe imagem Docker oficial `manimcommunity/manim` (tags `latest`/`stable`/`vX.Y.Z`) com **TeX Live mínimo** (sem `ctex`), e nela `-p` e `-f` não funcionam. | (2-0) | PROVÁVEL | https://docs.manim.community/en/stable/installation/docker.html |
| R07-25 | ManimGL está vivo mas lento: última release no PyPI é **1.7.2 (2024-12-13)**, Python 3.7+, exige FFmpeg externo e OpenGL. `manimlib` está **congelado**: última release **0.2.0 (2021-02-01)**. | (2-0) | PROVÁVEL | https://pypi.org/project/manimgl/ |

## 2. Detalhe por claim

### R07-01 — Manim CE estável é 0.20.1 (2026-02-27)
- **Verdade operacional:** o pin do projeto é `manim==0.20.1`. A cadência é irregular: 0.19.0 saiu em jan/2025 e ficou ~11 meses sem release, depois vieram três em três meses (dez/2025, jan/2026, fev/2026). Não achei documento público de política de release — a numeração é `0.x` e cada changelog tem seção de *breaking changes*, então **assuma que minor bump pode quebrar API**.
- **Como reconferir:** `curl -s https://pypi.org/pypi/manim/json | jq -r '.info.version, (.releases | keys_unsorted[-5:][])'`
- **O que quebra se divergir:** o pin do `pyproject.toml`/`uv.lock` da sidecar Python e o Dockerfile de render. Um bump de minor invalida os golden masters de imagem.
- **Fontes:**
  - https://pypi.org/project/manim/ (primária) — "0.20.1 released February 27, 2026"; histórico 0.20.0 (2026-02-20), 0.19.2 (2026-01-17), 0.19.1 (2025-12-01), 0.19.0 (2025-01-20); "Requires: Python >=3.11".
  - https://docs.manim.community/en/stable/changelog.html (primária) — índice de 32 versões, de v0.1.0 a v0.20.1; **não** contém política de versionamento nem cadência.
  - https://github.com/ManimCommunity/manim/releases (primária) — confirma as tags `v0.20.1`, `v0.20.0`, `v0.19.2`, `v0.19.1` nessa ordem. *Aviso: a conversão da página devolveu datas relativas com ano inconsistente (2024); as datas acima vêm do PyPI e do changelog, não daqui.*
  - https://docs.manim.community/en/stable/changelog/0.20.0-changelog.html (primária) — "Release Date: February 20, 2026".

### R07-02 — Python >= 3.11
- **Verdade operacional:** o container de render precisa de Python 3.11+. O changelog da 0.19.0 ainda falava em "Python 3.9–3.13"; **a 0.20.x subiu o piso** — não copie a instrução antiga.
- **Como reconferir:** `python -c "import tomllib,urllib.request as u;print(tomllib.loads(u.urlopen('https://raw.githubusercontent.com/ManimCommunity/manim/main/pyproject.toml').read().decode())['project']['requires-python'])"`
- **O que quebra se divergir:** a imagem base do Dockerfile Python e o `.python-version` do worktree da sidecar Manim.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/pyproject.toml (primária) — `version = "0.20.1"`, `requires-python = ">=3.11"`, classifiers 3.11/3.12/3.13/3.14; deps `av>=15.0`, `manimpango>=0.6.1,<1.0.0`, `moderngl>=5.7.0,<6.0.0`, `moderngl-window>=2.0.0`, `numpy>=2.1`, `pillow>=11.0`, `pycairo>=1.14,<2.0.0`, `srt>=3.0.0`, `watchdog>=2.0.0`; extras `gui`, `jupyterlab`, `typst`.
  - https://pypi.org/project/manim/ (primária) — "Python >=3.11", "Supports Python 3.11 through 3.14".

### R07-03 — Sem ffmpeg externo desde 0.19.0 (usa PyAV)
- **Verdade operacional:** `pip install manim` já traz o encoder. **Consequência dura para nós:** não existe mais um binário `ffmpeg` no meio do caminho para você injetar flags — quem quiser prores/bitexact tem que fazer um **passo de transcode próprio depois** do manim. Ver R07-09.
- **Como reconferir:** `grep -rn "^import av\|subprocess.*ffmpeg" $(python -c "import manim,os;print(os.path.dirname(manim.__file__))")/scene/scene_file_writer.py`
- **O que quebra se divergir:** o card "sidecar Manim" some da lista de dependências de sistema do Dockerfile; se divergir, o container quebra em runtime, não em build.
- **Fontes:**
  - https://docs.manim.community/en/stable/changelog/0.19.0-changelog.html (primária) — "Replaced external `ffmpeg` dependency with `pyav`" (PR #3501), "the maintainers of `pyav` distribute it in their binary wheels"; data de release 2025-01-20.
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py (primária) — o writer usa a API do `av` (`av.VideoFrame.from_ndarray`, `output_container.mux(packet)`), não subprocess.

### R07-04 — LaTeX opcional, Cairo/Pango obrigatórios
- **Verdade operacional:** dá para rodar um pipeline inteiro sem LaTeX se todo texto for `Text` (Pango) em vez de `Tex`/`MathTex`. Como o produto é *vídeo técnico*, provavelmente vamos querer LaTeX — mas isso é decisão, não requisito (ver seção 6).
- **Como reconferir:** rode uma cena só com `Text(...)` num container sem `texlive` e veja se completa.
- **O que quebra se divergir:** o tamanho da imagem Docker (TeX Live completo passa de 1 GB) e o tempo de cold start de cada worktree paralela.
- **Fontes:**
  - https://docs.manim.community/en/stable/installation/uv.html (primária) — LaTeX "essential for rendering mathematical equations, though technically optional if rendering plain text is sufficient"; Cairo + pkg-config exigidos para `pycairo`; em Linux exige compilador C, headers de Python, Pango e Cairo com headers para compilar `manimpango`/`pycairo` da fonte.
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/pyproject.toml (primária) — `pycairo` e `manimpango` são dependências obrigatórias; nenhum pacote LaTeX aparece.

### R07-05 — `-t/--transparent` existe
- **Verdade operacional:** é uma flag booleana e o help é literalmente "Render scenes with alpha channel." Por baixo ela seta `background_opacity = 0.0`.
- **Como reconferir:** `manim render --help | grep -A1 transparent`
- **O que quebra se divergir:** todo o card de "camada Manim com fundo transparente sobre cena Remotion".
- **Fontes:**
  - https://docs.manim.community/en/stable/guides/configuration.html (primária) — bloco `manim render --help`, Render Options: `-t, --transparent   Render scenes with alpha channel.`
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py (primária) — a opção `-t, --transparent` está definida como flag.
  - https://docs.devtaoism.com/docs/html/contents/_3_camera_options.html (secundária) — "WITH TRANSPARENCY: `-t` — If you use this flag while rendering a video then it will be exported in **.mov** format in an alpha channel".

### R07-06 — Com `-t` a extensão vira `.mov`, salvo `--format=webm`
- **Verdade operacional:** o código é explícito e não tem terceira via:
  ```python
  def resolve_movie_file_extension(self, is_transparent: bool) -> None:
      if is_transparent:
          self.movie_file_extension = ".webm" if self.format == "webm" else ".mov"
      elif self.format == "webm":  self.movie_file_extension = ".webm"
      elif self.format == "mov":   self.movie_file_extension = ".mov"
      else:                        self.movie_file_extension = ".mp4"
  ```
  E o setter de `transparent` faz `self._d["background_opacity"] = float(not value)` antes de chamar isso. **`--format=mp4 -t` não dá erro: entrega `.mov`.** O `movie_file_extension` só aceita `[".mp4", ".mov", ".webm"]`.
  Corolário útil: **`--format=mov` SEM `-t` é H.264/yuv420p num container MOV** — esse o Chrome toca (R07-11 lista MOV como container aceito).
- **Como reconferir:** `manim -ql -t --format=mp4 scene.py Cena && ls media/videos/scene/480p15/`
- **O que quebra se divergir:** qualquer card que assuma nome de arquivo de saída (`{Scene}.mp4`) para montar o caminho que o Remotion vai consumir. O gate de "arquivo esperado existe" fica vermelho.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/_config/utils.py (primária) — código acima, verbatim.
  - https://docs.manim.community/en/stable/faq/general.html (primária) — "the default video file format does not support transparency, which is why Manim will output a `.mov` instead of a `.mp4`... Other movie file formats that support transparency can be obtained by passing `--format=webm` or `--format=gif`."
  - https://docs.devtaoism.com/docs/html/contents/_3_camera_options.html (secundária) — confirma `.mov`.

### R07-07 — O `.mov` transparente é `qtrle`/`argb`, não ProRes
- **Verdade operacional:** o trecho decisivo de `open_partial_movie_stream`:
  ```python
  partial_movie_file_codec = "libx264"
  partial_movie_file_pix_fmt = "yuv420p"
  av_options = {"an": "1", "crf": "23"}
  if config.movie_file_extension == ".webm":
      partial_movie_file_codec = "libvpx-vp9"
      av_options["-auto-alt-ref"] = "1"
      if config.transparent:
          partial_movie_file_pix_fmt = "yuva420p"
  elif config.transparent:
      partial_movie_file_codec = "qtrle"
      partial_movie_file_pix_fmt = "argb"
  ```
  `qtrle` é o *QuickTime Animation (RLE)*, **lossless** segundo a tabela de codecs do FFmpeg. Para conteúdo Manim (fundo 100% transparente + line art de cor chapada) o RLE tende a comprimir muito bem — mas isso é hipótese; medir é L-03.
- **Como reconferir:** `manim -ql -t scene.py Cena && ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt -of csv=p=0 media/videos/scene/480p15/Cena.mov` → esperado `qtrle,argb`.
- **O que quebra se divergir:** o card de "handoff Manim→Remotion" inteiro. Se for `qtrle`, o `<Video>` do Chrome **não** toca esse arquivo (R07-11) e o único caminho é `<OffthreadVideo>` (R07-12) ou PNG sequence (R07-23).
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py (primária) — código verbatim acima.
  - https://docs.manim.community/en/stable/_modules/manim/scene/scene_file_writer.html (primária, v0.20.1) — mesmo código na doc renderizada. *Corroboração fraca: esta página é gerada do repositório acima.*
  - https://ffmpeg.org/general.html (primária) — "QuickTime Animation (RLE) video / X / X / fourcc: 'rle '", marcado como lossless; ProRes listado à parte com fourcc `apch,apcn,apcs,apco,ap4h,ap4x`.

### R07-08 — O `.webm` transparente é VP9 + `yuva420p`
- **Verdade operacional:** exatamente o que o Chrome sabe decodificar com alpha. Também: o setter de `format` emite `logger.warning("Output format set as webm, this can be slower than other formats")` — o próprio projeto avisa que webm é o caminho lento.
- **Como reconferir:** `manim -ql -t --format=webm scene.py Cena && ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt -of csv=p=0 media/videos/scene/480p15/Cena.webm` → esperado `vp9,yuva420p`.
- **O que quebra se divergir:** o caminho "Manim entrega webm alpha direto pro `<Video>` do Remotion". Se o pix_fmt sair `yuv420p`, a transparência sumiu e o vídeo entra com fundo preto — falha silenciosa, não crash.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py (primária) — código do R07-07.
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/_config/utils.py (primária) — o warning de lentidão no setter de `format`.
  - https://ffmpeg.org/general.html (primária) — VP9 "encoding supported through external library libvpx".

### R07-09 — Não há flag de codec no CLI do Manim CE
- **Verdade operacional:** varri as **duas** listas completas de opções (`render_options.py` e `global_options.py`) e o bloco inteiro de `manim render --help`. Não existe `-c:v`, `--codec`, `--pix_fmt`, `--crf`, `--bitrate` nem passthrough de ffmpeg. **O comando `--format=mov -c:v prores_ks -pix_fmt yuva444p10le` não é um comando manim** — são flags de ffmpeg cru (ver seção 3).
  Achado colateral, **não** presente na 0.20.1: o `render_options.py` do branch `main` já tem `--max-inflight-encoders` e `--encoder-queue-size` (IntRange, min=1), que **não** aparecem no help publicado da 0.20.1. Isso é paralelismo de *encoder*, não de cena, e é código não liberado — ver L-07.
- **Como reconferir:** `manim render --help | grep -iE "codec|pix_?fmt|crf|bitrate|ffmpeg"` (esperado: vazio)
- **O que quebra se divergir:** o card "gerar ProRes 4444 direto do Manim" nunca deve existir. Se existir, ele vira um card de **pós-processamento** com `ffmpeg -i entrada.mov -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le saida.mov`, com o `ffmpeg` como dependência **nova e explícita** do container (o manim não traz mais binário — R07-03).
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py (primária) — lista completa: `-n/--from_animation_number`, `-a/--write_all`, `--format`, `-s/--save_last_frame`, `-q/--quality`, `-r/--resolution`, `--fps/--frame_rate`, `--max-inflight-encoders`, `--encoder-queue-size`, `--renderer`, `-g/--save_pngs`(dep.), `-i/--save_as_gif`(dep.), `--save_sections`, `-t/--transparent`, `--use_projection_fill_shaders`, `--use_projection_stroke_shaders`.
  - https://docs.manim.community/en/stable/guides/configuration.html (primária) — bloco `manim render --help` completo da 0.20.1; nenhuma opção de codec.

### R07-10 — Chrome reproduz WebM VP8/VP9 com alpha
- **Verdade operacional:** este é o **único** caminho de vídeo-com-alpha que o `<video>` do Chrome decodifica. Safari não decodifica alpha em VP8 nem VP9 — irrelevante para render local, decisivo se algum dia houver preview no browser do usuário.
- **Como reconferir:** abrir o `.webm` num `<video>` sobre fundo colorido em Chrome; ou `chrome://media-internals` durante a reprodução.
- **O que quebra se divergir:** o card "camada Manim transparente composta em cima da cena Remotion via `<Video>`".
- **Fontes:**
  - https://developer.chrome.com/blog/alpha-transparency-in-chrome-video (primária, 2013-07-25, Chrome 31) — "Chrome takes the alpha channel into account when playing 'green screen' videos encoded to WebM (VP8 and VP9) with an alpha channel"; recomenda `ffmpeg ... -pix_fmt yuva420p`. Nenhuma menção a HEVC/ProRes/MOV.
  - https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs (primária) — VP8: "allows video with an alpha channel... Safari does not support alpha transparency in VP8 video"; VP9: "Safari does not support alpha transparency in this format". Alpha só é mencionado para VP8 e VP9. ProRes não aparece.
  - https://www.chromium.org/audio-video/ (primária) — WebM como container e VP8/VP9 como codecs suportados.

### R07-11 — Chrome não decodifica ProRes nem QTRLE
- **Verdade operacional:** a página do Chromium é uma **lista fechada** — é exatamente o tipo de evidência positiva que o contrato exige para refutar. Containers: "MP4 (QuickTime/ MOV / ISO-BMFF / CMAF), Ogg, WebM, WAV, Matroska, HLS". Codecs de vídeo: "AV1, VP8, VP9"; proprietários só no Chrome: "H.264 / AVC, H.265 / HEVC". `qtrle` e `prores` não estão em lugar nenhum. **O container `.mov` é aceito; o codec dentro dele é que não.**
- **Como reconferir:** carregar o `.mov` do manim num `<video>` em Chrome e olhar `video.error.code` / `chrome://media-internals`.
- **O que quebra se divergir:** o pressuposto de que o `.mov` default do `-t` serve de asset direto no Remotion. **Serve, mas só via `<OffthreadVideo>`, não via `<video>` do browser.**
- **Fontes:**
  - https://www.chromium.org/audio-video/ (primária) — listas verbatim acima.
  - https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs (primária) — guia de codecs de vídeo para web; ProRes não é mencionado.

### R07-12 — `<OffthreadVideo>` do Remotion não passa pelo decoder do browser
- **Verdade operacional:** **este é o achado que desarma a pergunta "o Chrome precisa tocar o arquivo".** No render server-side, ele não precisa: o Remotion extrai o frame com FFmpeg e injeta como `<Img>`. Logo o `.mov` `qtrle` do Manim é *potencialmente* consumível — mas a doc do Remotion lista explicitamente H.264, H.265, VP8, VP9, AV1 e **ProRes**, e **não** menciona QTRLE. QTRLE fica em aberto (L-04).
- **Como reconferir:** compor uma cena Remotion com `<OffthreadVideo src={staticFile("cena.mov")} transparent />` e rodar `npx remotion render`.
- **O que quebra se divergir:** o card de composição Manim×Remotion muda de "converter tudo para webm VP9 alpha" para "consumir o `.mov` direto". A diferença é um passo de transcode por cena no pipeline.
- **Fontes:**
  - https://www.remotion.dev/docs/offthreadvideo (primária) — "extracts the exact frame from the video and displays it in a `<Img>` tag. This extraction process happens outside the browser using FFmpeg"; prop `transparent` (v4.0.0): "frames will be extracted as PNG, enabling transparency but also slowing down your render"; default BMP; codecs H.264, H.265, VP8, VP9, AV1 (v4.0.6), ProRes.
  - https://www.remotion.dev/docs/transparent-videos (primária, mesmo domínio — conta junto) — saída com alpha: VP8/VP9 (`yuva420p`) e ProRes 4444 / 4444-XQ (`yuva444p10le`, desde v2.1.7), ambos exigindo image format PNG; alerta de flicker em WebM alpha nos limites de chunk no Lambda.
  - https://rendercomp.com/blog/remotion-video-embedding-offthreadvideo-guide/ (secundária, 2026-07-11, Remotion 4.x) — "`transparent` enables alpha-channel extraction for footage that has one (ProRes 4444, VP9 with alpha). Frames are extracted as PNG instead of BMP".

### R07-13 — `--renderer=opengl` existe
- **Verdade operacional:** existe e é `Choice(["cairo","opengl"])` com default `cairo`. Trocar o renderer troca as **classes base** dos mobjects em runtime (`ConvertToOpenGL`), o que explica por que bugs de paridade aparecem em mobjects específicos e não no renderer inteiro.
- **Como reconferir:** `manim render --help | grep -A1 renderer`
- **O que quebra se divergir:** o card "acelerar render trocando o renderer" — que, de qualquer forma, R07-17 recomenda não abrir cedo.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py (primária) — `--renderer` (choice from RendererType, default "cairo").
  - https://docs.manim.community/en/stable/guides/configuration.html (primária) — "`--renderer [cairo|opengl]` Select a renderer for your Scene."

### R07-14 — As flags de projection shaders são do CE, não do manimgl
- **Verdade operacional:** invertido em relação ao que se imagina. Estão documentadas no `ManimConfig` do CE ("Use shaders for OpenGLVMobject stroke which are compatible with transformation matrices") e definidas em `render_options.py`. A página de configuração do manimgl lista **toda** a sua superfície de CLI (`--write_file`, `--skip_animations`, `--low_quality`, `--medium_quality`, `--hd`, `--uhd`, `--full_screen`, `--presenter_mode`, `--save_pngs`, `--gif`, `--transparent`, `--quiet`, `--write_all`, `--open`, `--finder`, `--config`, `--file_name`, `--start_at_animation_number`, `--embed`, `--resolution`, `--fps`, `--color`, `--leave_progress_bars`, `--video_dir`, `--config_file`, `--log-level`) e nenhuma das duas está lá.
- **Como reconferir:** `manim render --help | grep projection` (CE) e `manimgl --help | grep projection` (esperado: vazio).
- **O que quebra se divergir:** um card que tentasse "portar a flag do manimgl para o CE" — trabalho inexistente.
- **Fontes:**
  - https://docs.manim.community/en/stable/reference/manim._config.utils.ManimConfig.html (primária, v0.20.1) — `use_projection_stroke_shaders` e `use_projection_fill_shaders` documentadas.
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py (primária) — ambas definidas como flags.
  - https://3b1b.github.io/manim/getting_started/configuration.html (primária, manimgl) — lista completa de flags; nenhuma das duas presente.

### R07-15 — Contexto OpenGL headless com fallback EGL
- **Verdade operacional:** o código faz `moderngl.create_context(standalone=True)` e, no `except Exception`, `moderngl.create_context(standalone=True, backend="egl")`. A janela obedece:
  ```python
  def should_create_window(self):
      return (config["preview"] and not config["save_last_frame"]
              and not config["format"] and not config["write_to_movie"]
              and not config["dry_run"])
  ```
  Ou seja: **num render batch (com `--format` ou `--write_to_movie`) nenhuma janela é criada** — headless é o caminho default, não uma gambiarra. O que **não** está provado é que o EGL resolve num container sem GPU: o próprio guia headless do ModernGL sobe `Xvfb :99` antes do exemplo com `backend='egl'`. Ver L-05.
- **Como reconferir:** `docker run --rm -e DISPLAY= manimcommunity/manim manim -ql --renderer=opengl --write_to_movie scene.py Cena`
- **O que quebra se divergir:** o Dockerfile precisa de `xvfb` + `libegl1-mesa` e o entrypoint de um wrapper `xvfb-run`. Isso é um card, e ele só existe se o teste falhar.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/renderer/opengl_renderer.py (primária) — código verbatim acima; `force_window` documentado como debug com aviso de performance.
  - https://moderngl.readthedocs.io/en/latest/techniques/headless_ubuntu_18_server.html (primária, ModernGL 5.12.0) — `moderngl.create_context(standalone=True, backend='egl', libgl='libGL.so.1', libegl='libEGL.so.1')`; pacotes `python3-pip mesa-utils libegl1-mesa xvfb`; e ainda assim `Xvfb :99 -screen 0 640x480x24 &`.
  - https://moderngl.readthedocs.io/en/latest/reference/moderngl.html (primária) — assinatura publicada é `create_context(require=330, standalone=False)`; o parâmetro `backend` **não** está na referência, só no guia headless. Inconsistência da doc do ModernGL — anotada, não resolvida.

### R07-16 — `--write_to_movie`
- **Verdade operacional:** o help é específico do OpenGL ("Write the video rendered with **opengl** to a file"), e é uma das condições que suprime a janela. Com o renderer cairo o comportamento default (escrever vídeo sem passar a flag) **não** foi verificado por fonte primária — ver L-08.
- **Como reconferir:** `manim -ql --renderer=opengl scene.py Cena` vs `manim -ql --renderer=opengl --write_to_movie scene.py Cena`, comparando `ls media/videos/`.
- **O que quebra se divergir:** o card do renderer OpenGL entrega zero arquivos e o gate "artefato existe" fica vermelho sem mensagem de erro.
- **Fontes:**
  - https://docs.manim.community/en/stable/guides/configuration.html (primária) — Output options: `--write_to_movie   Write the video rendered with opengl to a file.`
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/renderer/opengl_renderer.py (primária) — `config.write_to_movie` consultado em `scene_finished()` e em `should_create_window()`.

### R07-17 — Paridade e desempenho do renderer OpenGL do CE
- **Verdade operacional:** a doc oficial admite que "the official online documentation does not contain the relevant base classes like `OpenGLMobject` and `OpenGLVMobject`" e aponta para docstrings no código. Há bugs abertos de paridade (StreamLines quebra com `--renderer=opengl` mas funciona com cairo, #3789, 0.18.1). E o número que interessa: a issue #1957 relata **CE/OpenGL ~36 s vs cairo ~24 s vs manimgl ~8 s** na mesma cena — ou seja, **o OpenGL do CE chegou a ser mais lento que o cairo**. A issue está aberta desde 2021-08-24 e o relato é de 2021, não da 0.20.1.
- **Como reconferir:** rodar a mesma cena três vezes com `time`, alternando `--renderer=cairo` e `--renderer=opengl` na 0.20.1 (é L-01).
- **O que quebra se divergir:** o card "usar OpenGL para acelerar" deve nascer **bloqueado por medição**. Se o número de 2021 ainda valer em 2026, o card não existe.
- **Fontes:**
  - https://docs.manim.community/en/stable/faq/opengl.html (primária, v0.20.1) — admissão sobre documentação ausente; workaround do `sqlite3.ProgrammingError` com `IPython==8.0.1`; **não** documenta o que é ou não suportado.
  - https://github.com/ManimCommunity/manim/issues/3789 (repositório oficial, conteúdo de usuário — secundária) — StreamLines falha só com `--renderer=opengl`, manim 0.18.1, aberta.
  - https://github.com/ManimCommunity/manim/issues/1957 (repositório oficial, conteúdo de usuário — secundária) — os números 36 s / 24 s / 8 s; aberta desde 2021-08-24; labels bug, opengl, performance.

### R07-18 — Mapa de qualidade (`p` é 1440p, `k` é 4K)
- **Verdade operacional:** `k` = "fourk_quality" = 3840x2160; `p` = "production_quality" = 2560x1440. **A letra não é mnemônica de resolução** e muita fonte de terceiro troca as duas. Default = `high_quality` (1920x1080@60). Existe ainda `example_quality` (854x480@30) sem flag.
- **Como reconferir:** `python -c "from manim.constants import QUALITIES,DEFAULT_QUALITY;print(DEFAULT_QUALITY);[print(k,v) for k,v in QUALITIES.items()]"`
- **O que quebra se divergir:** todo cálculo de custo de render e todo fixture de golden master gravado em resolução errada. Um golden master a 1440p comparado contra saída 2160p falha em 100% dos pixels.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/constants.py (primária) — dicionário `QUALITIES` verbatim, `DEFAULT_QUALITY = "high_quality"`.
  - https://docs.manim.community/en/stable/guides/configuration.html (primária) — `-q, --quality [l|m|h|p|k]` "respectively: 854x480 15FPS, 1280x720 30FPS, 1920x1080 60FPS, 2560x1440 60FPS, 3840x2160 60FPS" (ordem l,m,h,p,k → bate com o repositório).
  - https://docs.devtaoism.com/docs/html/contents/_3_camera_options.html (secundária) — "`-qp`: 1440p at 60FPS and `-qk`: 4K at 60FPS" — concorda com o repositório.

### R07-19 — Cache por hash CRC32 de play call
- **Verdade operacional:** cada `self.play(...)` vira um partial movie file nomeado pelo hash. `is_already_cached` só checa `path.exists()`. O hash é CRC32 de um JSON custom que: extrai o **código-fonte** de funções via `inspect.getsource()`, inclui closure vars, **trunca** arrays numpy com mais de 1000 elementos para uma amostra `(100,100)`, e ordena as animações por `str()` antes de hashear. **Consequências:** (a) mudar um comentário dentro de um lambda invalida o cache; (b) duas cenas que só diferem em elementos de um array grande **além** da truncagem podem colidir no hash e reutilizar o vídeo errado; (c) CRC32 é checksum, não hash criptográfico — colisão é possível por construção.
- **Como reconferir:** `manim -ql scene.py Cena; manim -ql scene.py Cena` e comparar o log ("Using cached data") + `ls media/videos/scene/480p15/partial_movie_files/Cena/`.
- **O que quebra se divergir:** se o cache reutilizar um partial errado, o golden master de vídeo passa e o vídeo está errado — **falso verde**. Por isso o gate de CI deve rodar com `--disable_caching`.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/global_options.py (primária) — `--disable_caching` "Disable the use of the cache (still generates cache files)."; `--flush_cache` "Remove cached partial movie files."
  - https://docs.manim.community/en/stable/_modules/manim/utils/hashing.html (primária, v0.20.1) — `zlib.crc32(repr(json_val).encode())`; `_CustomEncoder`; truncagem de arrays > 1000 elementos; `inspect.getsource()` e `inspect.getclosurevars()`; `_Memoizer` usando `id()`.
  - https://docs.manim.community/en/stable/tutorials/output_and_config.html (primária, mesmo domínio) — layout `media/videos/<file>/<quality>/partial_movie_files/`, `media/images/`, `media/text/`, `media/Tex/`; `max_files_cached`.

### R07-20 — Sem render paralelo de cenas
- **Verdade operacional:** o paralelismo tem que ser **nosso**: N processos `manim`, um por cena. E aí vem o risco: `media/Tex/` e `media/text/` são compartilhados por padrão. Nenhuma fonte primária documenta um lock; o changelog da 0.20.0 lista "directory creation race conditions" entre os bugfixes, o que confirma que corridas de diretório **existiam**. A mitigação óbvia é `--media_dir` distinto por processo, mas isso **duplica a compilação LaTeX** por cena e perde o cache de Tex entre cenas. O trade-off precisa de medição (L-02).
- **Como reconferir:** `manim render --help | grep -iE "jobs|parallel|workers|threads"` (esperado: vazio).
- **O que quebra se divergir:** o card "N worktrees renderizando em paralelo" precisa de uma decisão de isolamento (media_dir por worktree vs media_dir compartilhado com lock). Sem essa decisão, o modo de falha é intermitente e mudo: um `.tex` meio-escrito lido por outro processo.
- **Fontes:**
  - https://github.com/ManimCommunity/manim/discussions/3897 (repositório oficial; resposta de collaborator JasonGrace2282 em 2024-08-07 — primária quanto à posição do projeto) — "the current architecture of Manim is insufficient to handle multithreading correctly"; precisaria de "a two pass rendering system"; "We have a refactor branch... I wouldn't expect it to be ready for any time before Manim v0.21.0".
  - https://docs.manim.community/en/stable/guides/configuration.html (primária) — listagem completa de flags; nenhuma opção de paralelismo. `--media_dir PATH` "Path to store rendered videos and latex."
  - https://docs.manim.community/en/stable/changelog/0.20.0-changelog.html (primária, mesmo domínio) — bugfixes incluem "directory creation race conditions".

### R07-21 — Determinismo: não é bit-exato por construção
- **Verdade operacional:** três fatos de código somados. (1) `av_options = {"an": "1", "crf": "23"}` — **nenhum** `bitexact`. (2) `output_container.metadata["comment"] = f"Rendered with Manim Community v{__version__}"` — a versão do Manim está gravada **dentro do arquivo**, então bump de versão muda os bytes por definição. (3) A concatenação final é **stream-copy**, não re-encode (`for packet in partial_movies_input.demux(...): packet.dts = None; packet.stream = output_stream; output_container.mux(packet)`), então o determinismo do arquivo final se reduz ao determinismo dos partials. Pelo FFmpeg, `bitexact` é literalmente o flag que garante "Only write platform-, build- and time-independent data. This ensures that file and data checksums are reproducible and match between platforms." Sem ele, não há garantia. Sobre o x264: o man page tem `--non-deterministic` ("Slightly improve quality of SMP, at the cost of repeatability") e **não** tem `--deterministic` — o que implica que o **default é o repetível**; mas o Manim não expõe nenhuma opção do x264 (R07-09), então o número de threads fica a cargo do libx264 e da máquina. **Conclusão para o golden master: não compare bytes de vídeo. Compare frames.**
- **Como reconferir:** `manim -ql --disable_caching scene.py Cena && sha256sum out1.mp4 && manim -ql --disable_caching scene.py Cena && sha256sum out2.mp4` — e, se divergir, `cmp -l` para ver se a diferença é só no header de metadata.
- **O que quebra se divergir:** o gate de regressão visual. Se você escrever o gate como `sha256` do arquivo, ele vai piscar vermelho em máquina diferente e você vai desligar o gate — que é o pior desfecho possível. O gate correto é PNG-por-frame (R07-23) com tolerância de pixel.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py (primária) — as três evidências de código acima; nenhum `bitexact`/`movflags`.
  - https://ffmpeg.org/ffmpeg-formats.html (primária) — descrição verbatim do flag `bitexact`; `write_tmcd` "auto" grava trilha de timecode em mov/mp4 por default.
  - https://manpages.debian.org/unstable/x264/x264.1.en.html (primária) — `--non-deterministic` "Slightly improve quality of SMP, at the cost of repeatability"; `--threads` "Force a specific number of threads" sem default declarado; não existe `--deterministic`.

### R07-22 — `--seed`
- **Verdade operacional:** `--seed INTEGER  Set the random seed to allow reproducibility`, adicionada na v0.20.0 ("Added configurable `seed` option for reproducible randomness in rendered scenes"). Resolve a aleatoriedade **da cena** (`random_bright_color`, jitter, etc.). Não resolve nada de encoder — não confunda com R07-21.
- **Como reconferir:** `manim render --help | grep -A1 seed`
- **O que quebra se divergir:** qualquer cena que use aleatoriedade fica não-reproduzível e o golden master é impossível. Se o card gerar cenas via LLM, **fixe o seed no template**, não no prompt.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/global_options.py (primária) — `--seed` com o help verbatim.
  - https://docs.manim.community/en/stable/changelog/0.20.0-changelog.html (primária) — a adição na v0.20.0.

### R07-23 — `--format=png` grava a sequência inteira com alpha
- **Verdade operacional:** **este é provavelmente o formato de handoff certo.** O writer roda `if is_png_format() and not config["dry_run"]: ... self.output_image(image, target_dir, extension, config["zero_pad"])` dentro do laço de frames, incrementando `self.frame_count` — todos os frames, num subdiretório. Os frames chegam como ndarray `(h, w, 4)` uint8 e viram `Image.fromarray(...)` → PNG RGBA. Com `-t` o fundo é transparente. Vantagens sobre vídeo: lossless, sem codec, sem metadata de encoder, **byte-comparável** (PNG tem o chunk `tIME` opcional — a Pillow não o escreve por default, o que precisa ser confirmado em L-06), e o Remotion consome via `<Img>`/`staticFile` sem passar por nenhum decoder de vídeo.
- **Como reconferir:** `manim -ql -t --format=png -0 5 scene.py Cena && ls media/images/scene/Cena/ | head && python -c "from PIL import Image;print(Image.open('media/images/scene/Cena/Cena00000.png').mode)"` → esperado `RGBA`.
- **O que quebra se divergir:** se só o último frame sair, o card "golden master por frame" e o card "handoff via PNG sequence" caem juntos, e voltamos para webm VP9.
- **Fontes:**
  - https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py (primária) — laço `is_png_format()`, `output_image` com `zero_pad`, `Image.fromarray`.
  - https://docs.manim.community/en/stable/guides/configuration.html (primária) — `--format [png|gif|mp4|webm|mov]`; `-0, --zero_pad INTEGER RANGE  Zero padding for PNG file names. [0<=x<=9]`.
  - https://docs.devtaoism.com/docs/html/contents/_3_camera_options.html (secundária) — "in case you render an image it will export a PNG without background".

### R07-24 — Imagem Docker oficial
- **Verdade operacional:** `manimcommunity/manim`, tags `latest` (main), `stable` (última release) e `vX.Y.Z`. Use **`vX.Y.Z`** — `latest` aponta para main e viola o pin de R07-01. TeX Live é mínimo e sem `ctex` (`tlmgr install ctex` se precisar). `-p` e `-f` não funcionam. Para evitar arquivos root no host em Linux: `--user="$(id -u):$(id -g)"`.
- **Como reconferir:** `docker run --rm manimcommunity/manim:v0.20.1 manim --version`
- **O que quebra se divergir:** o card de containerização. Se a tag `v0.20.1` não existir, o card vira "construir Dockerfile próprio" — trabalho bem maior.
- **Fontes:**
  - https://docs.manim.community/en/stable/installation/docker.html (primária, v0.20.1) — nome da imagem, as três tags, comandos `docker run` verbatim, TeX Live mínimo sem `ctex`, `-p`/`-f` não suportados.
  - https://pypi.org/project/manim/ (primária) — confirma distribuição via Docker.

### R07-25 — Estado de ManimGL e manimlib
- **Verdade operacional:** três projetos, um só é para nós. **CE (`manim`)**: 0.20.1, fev/2026, documentado, testado, política de changelog. **ManimGL (`manimgl`)**: 1.7.2 de 2024-12-13, Python 3.7+, exige FFmpeg **externo** + OpenGL, LaTeX opcional; a doc oficial do CE descreve como tendo "more experimental features and breaking changes between versions are not documented". **manimlib**: 0.2.0 de 2021-02-01 — congelado, só serve para re-renderizar projetos 3b1b de 2019 e antes. Os CLIs **não são intercambiáveis** (manimgl usa `-w/--write_file`, `--hd`, `--uhd`; o CE usa `-q`, `--format`, `--write_to_movie`) e o README do 3b1b avisa que misturar as instruções "will cause problems".
- **Como reconferir:** `pip index versions manimgl` / `curl -s https://pypi.org/pypi/manimgl/json | jq -r .info.version`
- **O que quebra se divergir:** o card de escolha de engine. Se aparecer um manimgl 2.x com performance dramática, o cluster inteiro merece reabertura — mas hoje a escolha é CE por causa da doc, da API estável e do PyAV embutido.
- **Fontes:**
  - https://pypi.org/project/manimgl/ (primária) — 1.7.2 em 2024-12-13; classifiers Python 3.7–3.10; requer FFmpeg, OpenGL, LaTeX opcional; releases anteriores 1.7.1/1.7.0 (2024-10-23), 1.6.1 (2022-04-13).
  - https://pypi.org/project/manimlib/ (primária, mesmo domínio) — 0.2.0 em 2021-02-01, última.
  - https://github.com/3b1b/manim (primária, projeto ManimGL) — "In 2020 a group of developers forked it into what is now the community edition"; "The package name is `manimgl` instead of `manim` or `manimlib`"; "WARNING: These instructions are for ManimGL _only_".
  - https://docs.manim.community/en/stable/faq/installation.html (primária) — descrição dos três pacotes; manimlib como "the old, pre-OpenGL version of manimgl".

## 3. Refutações — o que o panorama afirma e não se sustenta

| O que o panorama diz | Veredito | O que é de fato | Fonte |
|---|---|---|---|
| "`-t` no Manim produz webm VP9 com alpha (yuva420p)" | **PARCIALMENTE REFUTADO** | Só se você também passar `--format=webm`. Sozinho, `-t` produz **`.mov` com `qtrle`/`argb`**. O código: `".webm" if self.format == "webm" else ".mov"`. | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/_config/utils.py |
| "O `.mov` transparente do Manim é ProRes 4444" | **REFUTADO** | É `qtrle` (QuickTime Animation RLE) com pix_fmt `argb`. ProRes não aparece em nenhum lugar do `scene_file_writer.py`. | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/scene/scene_file_writer.py |
| "Configure o Manim com `--format=mov -c:v prores_ks -pix_fmt yuva444p10le`" | **REFUTADO** | `-c:v` e `-pix_fmt` **não são flags do Manim**. A listagem completa de `manim render --help` e os arquivos `render_options.py` + `global_options.py` não têm nenhuma opção de codec/pix_fmt/bitrate. ProRes só via transcode posterior com ffmpeg próprio — que desde a v0.19.0 **não vem mais junto** com o Manim. | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/render_options.py |
| "`--use_projection_stroke_shaders` é coisa do manimgl" | **REFUTADO** | É do **Manim CE**: documentada no `ManimConfig` da v0.20.1 e definida em `render_options.py`. A página de configuração do manimgl lista todas as suas flags e essa não está lá. | https://docs.manim.community/en/stable/reference/manim._config.utils.ManimConfig.html |
| "O Remotion roda no Chrome, então só consegue usar webm VP9 com alpha" | **REFUTADO** | `<OffthreadVideo>` extrai o frame "outside the browser using FFmpeg" e suporta ProRes; o decoder do Chrome não está no caminho crítico do render server-side. O limite do Chrome vale para preview no browser e para `<video>`, não para o render. | https://www.remotion.dev/docs/offthreadvideo |
| "O Chrome toca o `.mov` que o Manim gera com `-t`" | **REFUTADO** | O container MOV é aceito, o codec não: a lista fechada do Chromium é AV1/VP8/VP9 (+ H.264/HEVC no Chrome). `qtrle` e ProRes não estão lá. | https://www.chromium.org/audio-video/ |
| "Precisa instalar FFmpeg para usar o Manim" | **REFUTADO para o CE ≥ 0.19.0** | O CE usa `pyav` (`av>=15.0`) com wheels binários. **Continua verdade para o manimgl**, que lista FFmpeg como requisito de sistema. | https://docs.manim.community/en/stable/changelog/0.19.0-changelog.html |
| "`-qk` é 1440p e `-qp` é 4K" | **REFUTADO** | Invertido. `k` = `fourk_quality` = 3840x2160; `p` = `production_quality` = 2560x1440. | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/constants.py |
| "`--disable_caching` faz o Manim não escrever nada de cache" | **REFUTADO** | O help literal é "Disable the use of the cache (**still generates cache files**)". Para limpar é `--flush_cache`. | https://raw.githubusercontent.com/ManimCommunity/manim/main/manim/cli/render/global_options.py |
| "Dá para paralelizar cenas dentro do Manim" | **REFUTADO para 0.20.1** | Não há flag de paralelismo e o mantenedor afirma que a arquitetura não suporta; o refactor não sai antes da v0.21.0. Paralelismo é por processo, e é responsabilidade nossa. | https://github.com/ManimCommunity/manim/discussions/3897 |
| "`--seed` torna o render reproduzível" | **PARCIALMENTE REFUTADO** | Torna o **RNG da cena** reproduzível. Não torna os bytes do arquivo reproduzíveis: o Manim não configura `bitexact` e grava a própria versão em `metadata["comment"]`. | https://ffmpeg.org/ffmpeg-formats.html |
| "O renderer OpenGL do CE é mais rápido" | **EM DISPUTA / não sustentado** | A única medição pública que achei (issue oficial, 2021) dá CE/OpenGL 36 s vs cairo 24 s vs manimgl 8 s — OpenGL **mais lento que cairo**. Issue aberta até hoje. Não há medição pública para 0.20.1. | https://github.com/ManimCommunity/manim/issues/1957 |

## 4. Armadilhas (falso verde deste domínio)

- **`manim -t --format=mp4` roda sem erro e sem aviso** → mas o arquivo que sai é `.mov`, não `.mp4`. *Por que não é prova:* o exit code é 0 e o log diz "File ready". *O que fica vermelho se sumir:* nada — é exatamente o problema. Um gate de "arquivo `{Scene}.mp4` existe" pega isso; um gate de "manim retornou 0" não pega.
- **O webm com alpha "funciona" no Chrome de desenvolvimento** → mas o Manim só coloca alpha no webm se `config.transparent` **e** `movie_file_extension == ".webm"` ao mesmo tempo. Se alguém trocar `--format` num script e perder o `-t`, o pix_fmt cai para `yuv420p` e o vídeo entra com **fundo preto**, não com erro. *Gate:* `ffprobe ... -show_entries stream=pix_fmt` deve dizer `yuva420p`, senão vermelho.
- **O cache faz o segundo render ficar 10x mais rápido** → e pode estar reutilizando o partial errado: o hash é CRC32 sobre um JSON que **trunca arrays numpy acima de 1000 elementos** para uma amostra (100,100). Duas cenas que só diferem fora da amostra colidem. *Gate:* CI sempre com `--disable_caching`; se o tempo de CI cair de repente, isso é sinal de alarme, não de vitória.
- **O golden master de vídeo passa por `sha256` na sua máquina** → e vai falhar na máquina do colega. Sem `bitexact`, o FFmpeg escreve dados dependentes de plataforma/build/tempo, e o Manim ainda grava a própria versão dentro do container. *O que fica vermelho se sumir:* o gate inteiro, e a reação humana vai ser desligá-lo. Use PNG por frame com tolerância.
- **N processos `manim` em paralelo terminam todos com exit 0** → e um deles pode ter lido um `.tex`/`.dvi` meio-escrito de outro, porque `media/Tex/` é compartilhado. A falha é intermitente e o vídeo sai com uma fórmula errada, não com erro. *Gate:* `--media_dir` por processo **e** comparação de frame contra golden master.
- **`docker run manimcommunity/manim:latest` funciona hoje** → `latest` aponta para `main`, não para uma release. Amanhã ela tem `--max-inflight-encoders` e uma API diferente. *Gate:* pin em `vX.Y.Z` e um teste que compara `manim --version` com o valor esperado.
- **Tutorial de terceiro diz `-qk` = 1440p** → o mapa real é `p`=1440p, `k`=4K. Cheguei a coletar a versão errada de um resumo desta mesma pesquisa antes de abrir `constants.py`. *Gate:* asserção do `pixel_width/pixel_height` do arquivo gerado, nunca a letra da flag.
- **O renderer OpenGL "não abre janela, logo está headless e rápido"** → não abrir janela é o comportamento normal de qualquer render com `--format`/`--write_to_movie` (`should_create_window` retorna False). Não diz nada sobre GPU nem sobre velocidade. *Gate:* medir tempo, não observar ausência de janela.

## 5. LEDGER-SEED — o que só a máquina/o ambiente real responde

| id provisório | pergunta | decisão provisória sugerida | como verificar (comando) | o que quebra se divergir |
|---|---|---|---|---|
| L-01 | Quanto tempo leva uma cena típica em `-qh` (1080p60) nesta máquina, com cairo e com opengl? | Assumir **cairo** como default e tratar opengl como experimento bloqueado até medir. | `for r in cairo opengl; do /usr/bin/time -f "$r %e s" manim -qh --disable_caching --renderer=$r scene.py Cena >/dev/null; done` | O orçamento de tempo de todo o pipeline e a decisão de rodar em `-ql` durante o loop de agentes. |
| L-02 | O que domina o tempo: geometria/Python, compilação LaTeX, ou encode? | Assumir que **LaTeX domina em cenas com muitas fórmulas** e Python em cenas com muitos mobjects. | `manim -qh --disable_caching -v DEBUG scene.py Cena 2>&1 \| ts -i "%.s" \| sort -rn \| head -30` (ou `python -X importtime`/`cProfile` no runner) | O card de otimização aponta para o lugar errado; cache de Tex vs `--disable_caching` troca de sinal. |
| L-03 | Tamanho e tempo de `qtrle/.mov` vs `vp9/.webm` vs sequência PNG, para a mesma cena com alpha. | Assumir **PNG sequence** para golden master e **webm VP9** para o asset que entra no Remotion. | `for f in mov webm png; do manim -qh -t --format=$f --disable_caching scene.py Cena; done; du -sh media/videos/scene/1080p60/* media/images/scene/Cena` | A escolha de formato de handoff Manim→Remotion, e o tamanho do diretório de artefatos por worktree. |
| L-04 | O `<OffthreadVideo>` do Remotion consegue ler um `.mov` **qtrle** (não só ProRes)? | Assumir **não** e transcodificar para webm VP9 ou usar PNG sequence. | Compor `<OffthreadVideo src={staticFile("Cena.mov")} transparent />` e `npx remotion render`; conferir se o frame sai com alpha ou preto. | Se der certo, some um passo de transcode por cena do pipeline. Se der errado silenciosamente (fundo preto), o vídeo final sai errado sem erro. |
| L-05 | O `--renderer=opengl` sobe num container Linux sem GPU e sem X, só com EGL/Mesa? | Assumir que precisa de `libegl1-mesa` + `xvfb-run` até provar o contrário (o próprio guia do ModernGL sobe Xvfb). | `docker run --rm -e DISPLAY= manimcommunity/manim:v0.20.1 manim -ql --renderer=opengl --write_to_movie scene.py Cena` | O Dockerfile ganha ou perde `xvfb`/`libegl1-mesa` e o entrypoint ganha ou perde um wrapper. |
| L-06 | Dois renders da mesma cena, mesma máquina, mesma versão, `--disable_caching`: os bytes batem? E os PNGs? | Assumir que **vídeo não bate** e **PNG bate**; escrever o gate sobre PNG. | `manim -ql -t --format=png --disable_caching scene.py Cena && cp -r media/images/scene/Cena /tmp/a && manim -ql -t --format=png --disable_caching scene.py Cena && diff -r /tmp/a media/images/scene/Cena` | O gate de regressão visual inteiro. Se nem PNG bater, o gate precisa de tolerância de pixel (SSIM/limiar), o que é um card diferente. |
| L-07 | `--max-inflight-encoders` / `--encoder-queue-size` (presentes em `main`, ausentes no help da 0.20.1) chegam em qual versão e ajudam quanto? | Ignorar; não usar flag de branch não liberada. | `manim render --help \| grep -i encoder` na versão instalada; rechecar o changelog na v0.21.0. | Se entregarem ganho real, o card de paralelismo por processo pode encolher. Rechecar até 2026-12-31. |
| L-08 | Com renderer **cairo**, o Manim escreve vídeo sem `--write_to_movie` explícito? (o help da flag fala só de opengl) | Assumir **sim** (comportamento default do cairo) mas passar a flag explicitamente nos scripts. | `manim -ql scene.py Cena && ls media/videos/scene/480p15/*.mp4` | Se não escrever, todo comando de render dos cards precisa da flag e os que não têm falham mudos. |
| L-09 | N processos `manim` em paralelo com `media_dir` compartilhado corrompem `media/Tex/`? Com que N? | Assumir **sim**; `--media_dir` isolado por worktree. | Loop com `xargs -P 8` renderizando 8 cenas com Tex no mesmo `--media_dir`, comparando cada saída contra o render serial. | A arquitetura de worktrees paralelas: media_dir por worktree (mais lento, seguro) vs compartilhado com lock (mais rápido, precisa de código nosso). |
| L-10 | Quanto o cache de Tex compartilhado economiza de fato entre cenas? | Assumir que compensa; medir antes de isolar tudo. | Render serial de 8 cenas com `--media_dir` único vs 8 `--media_dir` distintos, comparando tempo total. | Se a economia for pequena, L-09 fica trivial: isola tudo e acabou. |

## 6. PERGUNTA-DONO — o que exige decisão humana

| pergunta | por que não dá para deduzir | o que muda em cada resposta |
|---|---|---|
| O produto precisa de LaTeX (fórmulas `MathTex`/`Tex`) ou basta `Text` com Pango? | É escopo de produto, não fato técnico. LaTeX é oficialmente opcional no CE. | **Com LaTeX:** imagem Docker grande, cold start alto, corrida de `media/Tex/` vira problema real (L-09), e o determinismo passa a depender da versão da distribuição TeX. **Sem LaTeX:** container magro, paralelismo trivial, e perdemos notação matemática. |
| Qual é o formato de handoff Manim→Remotion: **webm VP9 alpha**, **`.mov` qtrle via OffthreadVideo**, ou **sequência PNG**? | Depende de apetite por tamanho de artefato em disco vs velocidade de render vs rigor do golden master — todos preferências do dono. | **webm:** menor arquivo, único que o `<video>` do Chrome toca, mas lossy e o próprio Manim avisa que é lento. **`.mov` qtrle:** lossless, sem transcode, mas depende de L-04 e não abre em preview de browser. **PNG:** maior em disco, mas lossless, byte-comparável e sem decoder no caminho — é o único que torna o golden master barato. |
| Vale gastar tempo no renderer OpenGL agora? | Depende de orçamento de tempo de engenharia e de tolerância a bug de paridade. O único dado público é de 2021 e é desfavorável. | **Sim:** um card de spike medido (L-01) antes de qualquer adoção. **Não:** fixar `--renderer=cairo` em toda a configuração e fechar o assunto; custo de reverter é uma variável. |
| Qual o grau de paralelismo alvo (quantas cenas simultâneas) e em que hardware? | Não é dedutível: depende do número de núcleos, RAM e de quantos agentes rodam em worktrees ao mesmo tempo. | Define se o isolamento de `media_dir` é obrigatório (L-09), se o cache de Tex compensa (L-10) e se a fila de render precisa de semáforo. |
| Aceitamos pinar `manim==0.20.1` e a tag Docker `v0.20.1`, com um card periódico de bump? | É política de manutenção, não fato. O projeto é `0.x` e cada minor traz breaking changes documentados. | **Pinado:** golden masters estáveis, bump vira trabalho agendado. **Flutuante (`stable`/`latest`):** os golden masters quebram sem aviso, porque a versão do Manim está gravada dentro do próprio arquivo de vídeo (R07-21). |
| O gate de regressão visual é **igualdade exata de PNG** ou **similaridade com tolerância**? | Depende do apetite por falso vermelho vs falso verde. Só L-06 diz se a igualdade exata é viável. | **Exato:** gate barato e brutal; qualquer mudança de fonte/versão de Pillow quebra tudo. **Tolerância:** precisa de código (SSIM/limiar), calibração e um card próprio. |

## 7. Recomendação para o roadmap

- **Ponto de troca barata:** o **formato de handoff Manim→Remotion**. Hoje ele é uma linha de flag (`--format=webm` vs `--format=png` vs default `.mov`) e um componente no lado Remotion (`<Video>` vs `<OffthreadVideo>` vs `<Img>`). Custo de reversão: **1 variável de configuração no runner Python + 1 componente na composição Remotion**. Mantenha isso atrás de uma única constante (algo como `MANIM_OUTPUT_FORMAT`) e não deixe o nome do arquivo vazar para dentro das cenas Remotion — a extensão muda com a flag (R07-06), e essa é a superfície que mais gente vai errar.
- **Ponto de troca cara (não deixe barato por engano):** a decisão de **LaTeX sim/não** e a de **`media_dir` isolado vs compartilhado**. A primeira define a imagem Docker; a segunda define a arquitetura do paralelismo entre worktrees. Ambas custam refatoração real depois.
- **Skills que devem carregar este conhecimento:**
  - a skill de **render Manim / sidecar Python** — precisa de R07-05..R07-09 (nomes de arquivo e codecs reais), R07-18 (mapa de qualidade), R07-19 (cache), R07-22 (`--seed`);
  - a skill de **integração Remotion** — precisa de R07-10..R07-12 (o que o Chrome decodifica e o que o OffthreadVideo contorna);
  - a skill de **golden master / gate visual** — precisa de R07-21 e R07-23 (por que não comparar bytes de vídeo, e qual é o artefato comparável);
  - a skill de **orquestração em worktrees paralelas** — precisa de R07-20 e dos LEDGER-SEEDs L-09/L-10 (colisão de `media_dir` e cache de Tex);
  - a skill de **container/ambiente** — precisa de R07-02..R07-04, R07-15 e R07-24 (Python 3.11+, sem ffmpeg externo, EGL/Xvfb, pin da tag).
- **Cards que este cluster condiciona:**
  1. **Pin de ambiente:** fixar `manim==0.20.1`, Python 3.11+, imagem `manimcommunity/manim:v0.20.1`, com teste que compara `manim --version`. Bloqueado por nada; faça primeiro.
  2. **Runner de cena:** wrapper que monta o comando `manim` com `--media_dir` isolado, `--disable_caching` em CI, `--seed` fixo, e que **descobre o arquivo de saída em vez de adivinhar o nome** (R07-06). Bloqueia quase tudo o resto.
  3. **Spike medido de formato de saída:** roda L-03 + L-04 + L-06 e devolve uma tabela; só depois dele o card de handoff pode ser escrito. Sem esse spike, o card de handoff é chute.
  4. **Gate de regressão visual por PNG:** depende de L-06. Escreva o gate sobre `--format=png -t`, nunca sobre `sha256` de vídeo.
  5. **Transcode pós-Manim (só se o spike pedir):** passo `ffmpeg` explícito para ProRes 4444 / webm otimizado — com `ffmpeg` declarado como dependência **nova** do container, porque o Manim não traz mais (R07-03/R07-09).
  6. **Orquestração paralela de cenas:** N processos, `media_dir` por processo, com o teste de corrida de L-09 como critério de aceite. Nada de esperar paralelismo interno do Manim antes da v0.21.0.
  7. **Spike OpenGL (opcional, bloqueado):** só se o dono aprovar; critério de saída é o número de L-01, não a ausência de janela.
