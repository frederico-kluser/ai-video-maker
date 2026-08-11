# L01 — Inventário de reuso: código do `manim-api` (projeto 3blue1brown)

> **Papel deste documento:** reconhecimento local, sem pesquisa web. Achado e recomendação estão
> fisicamente separados (§6 do playbook): a tabela de inventário e as respostas Q1–Q5 são
> **achado**; a coluna `destino` e a seção "Decisão de reuso" são **recomendação** e serão
> superadas por qualquer ADR datado do projeto novo.
>
> **Dono exclusivo deste arquivo:** card L01. Nenhum outro arquivo do repositório foi editado.
>
> **Data do reconhecimento:** 2026-08-10.
> **Alvo:** `/home/ondokai/Projects/3blue1brown/manim-api` (exclui `venv/`, `__pycache__/`, `media/`).
> **Projeto consumidor hipotético:** editor de vídeo IA que precisa **renderizar Manim headless**.

---

## 0. Regras de leitura do corpus (calibradas antes de contar — §1)

Aplicadas a este reconhecimento, cada uma como **modo de falha**, não como dica:

| Regra | Modo de falha que ela cobre |
|---|---|
| **R1.** Toda afirmação factual carrega `arquivo:linha`. Sem citação ⇒ vai para `## Não verificado`. | Prosa plausível virando premissa invisível. |
| **R2.** `venv/` está fora do *inventário de reuso*, mas **dentro do corpus de evidência**: é onde mora o Manim realmente instalado. Ignorar `venv/` como fonte de verdade sobre o runtime seria confundir "o que o doc diz" com "o que a máquina tem". | Declarar quirk como "provável" quando ele é verificável em 3 segundos. |
| **R3.** Documentação **não** é evidência sobre código. Quando `README.md` e o `.py` divergem, o `.py` vence e a divergência **vira achado**, não nota de rodapé. | O catálogo de falso verde: "teste que asserta a documentação em vez do artefato". |
| **R4.** Toda vez que o quirk pôde ser **executado**, foi executado (importar módulo, chamar a API do Manim, ler `--help` do CLI instalado). Resultado do comando > leitura do código. | "Prove a sonda antes de acreditar no sintoma" (§17). |
| **R5.** Zero ocorrências não é prova de ausência — cada `grep` negativo foi confirmado por leitura integral do arquivo. | §1, corolário. |

**Arquivos lidos integralmente:** `main.py`, `config.py`, `schemas.py`, `prompts.py`,
`services/manim_executor.py`, `services/openai_service.py`, `scripts/parallel_request_test.py`,
`requirements.txt`, `README.md`, `docs/guia_definitivo.md`, `.env.example`, `.gitignore`,
`postman_collection.json`, `/home/ondokai/Projects/3blue1brown/API_CONSUMER.md`,
`/home/ondokai/Projects/3blue1brown/CLOUDFLARE.md`,
`/home/ondokai/Projects/3blue1brown/performance_rendering_tips.md`.
**Lido adicionalmente como evidência (não faz parte do inventário de reuso):**
`/home/ondokai/Projects/3blue1brown/.agents/skills/manim-rendering/SKILL.md` e o pacote `manim`
instalado em `manim-api/venv/`.

---

## 1. Inventário por papel

Contagem de linhas via `wc -l`. `status`: **vivo** = executado em produção pelo caminho
`/generate-video`; **experimental** = existe e roda, mas fora do caminho crítico; **morto** =
não é importado nem executado por nada.

| arquivo | linhas | PAPEL | status | destino | justificativa |
|---|---:|---|---|---|---|
| `services/manim_executor.py` | 267 | **Executor headless do Manim CLI**: tmpdir por render, monkey-patch injetado no script, resolução de TeX Live, escolha de renderer (GPU/CPU) com fallback, invocação do subprocess, descoberta do MP4, base64 | vivo (`main.py:155`, `main.py:216`) | **ABSORVER (só o conhecimento; reescrever o código)** | É o único arquivo com conhecimento não-inferível. Mas é **inimportável** sem `OPENAI_API_KEY` (`manim_executor.py:11`+`config.py:7`), sempre devolve base64 (`:188`) e devolve um `video_path` que aponta para dentro de um tmpdir já destruído (`:216` vs `:267`). Copiar o arquivo importa os defeitos; copiar as ~25 linhas de fatos, não. |
| `services/openai_service.py` | 359 | Cliente OpenAI + extração/validação AST + **sanitizador AST de código Manim** | vivo (`main.py:14`, `main.py:112`) | **INTEGRAR parcial (`sanitize_code`) · IGNORAR o resto** | `sanitize_code` (`:188-236`) é conhecimento de compatibilidade real e verificado (ver Q1.5–Q1.7). O resto é pipeline LLM: cliente global (`:18`), Responses API com `effort=xhigh` (`:251`, `:293`), 3 tentativas (`:37`, `:281`) — nada disso serve a um pipeline determinístico. |
| `prompts.py` | 373 | Base de conhecimento Manim CE em prosa, injetada em system prompts | vivo (`openai_service.py:10-14`) | **IGNORAR (como código) · ABSORVER 2 linhas** | 373 linhas de prosa **sobre Manim CE 0.19.0** (`prompts.py:33`, `:50`) enquanto o runtime instalado é **0.20.1** (ver Q5.1). Só duas linhas são fato operacional reaproveitável: `:32` (transparência ⇒ `.mov`/`--format=webm`) e `:286` (não passar mobject com background rectangle para `TransformMatchingTex`). |
| `main.py` | 260 | Camada HTTP FastAPI: CORS manual, request-id, 3 endpoints, health | vivo | **IGNORAR** | 100% acoplado a FastAPI/HTTP. O único fato de arquitetura aproveitável é conceitual e cabe numa frase: render bloqueante roda em `asyncio.to_thread` (`:155`). O resto (CORS `*` em `:32`, OPTIONS curto-circuitado para qualquer rota em `:47-48`, eco de `Access-Control-Allow-Headers` do request em `:57-58`) é anti-padrão que o projeto novo não deve herdar. |
| `config.py` | 32 | Settings pydantic (OpenAI + Manim + servidor) | vivo | **IGNORAR** | 32 linhas triviais, mas com o acoplamento mais tóxico do repositório: `openai_api_key: str` sem default (`:7`) torna o **executor de vídeo** inimportável sem chave de LLM (provado em Q4.1). Reescrever, não copiar. |
| `schemas.py` | 45 | DTOs pydantic da API HTTP | vivo | **IGNORAR** | Modela um contrato HTTP que o projeto novo não tem. `VideoRequest.width/height` (`:12-23`) valida `320..3840` mas não exige paridade — irrelevante fora do HTTP. |
| `scripts/parallel_request_test.py` | 111 | Smoke test de concorrência end-to-end contra `127.0.0.1:8000` | experimental (não é importado por nada; roda à mão) | **IGNORAR** | Mede LLM+render juntos, sem controle serial, sem baseline e **sem gravar resultado** (`:106` imprime e sai). É sonda de fumaça, não benchmark. Ver Q3. |
| `requirements.txt` | 11 | Manifesto de dependências | vivo | **IGNORAR (usar como checklist)** | 8 das 11 linhas são FastAPI/OpenAI/pytest. Para render headless só `manim>=0.19.0` (`:7`) importa — e o pin está errado na prática (instalado: 0.20.1). |
| `README.md` | 1313 | Doc + tutorial + **cópia integral desatualizada do código-fonte** | vivo (como doc) | **IGNORAR** | Contém uma segunda cópia de `config.py`, `schemas.py`, `prompts.py`, `openai_service.py`, `manim_executor.py` e `main.py` (`README.md:270-881`) que **diverge da fonte real** — sem GPU, sem patch de `BackgroundRectangle`, sem `--write_to_movie`, com `chat.completions` (`:904-912`) que a própria linha `:38` diz não funcionar. Duas representações, nenhuma gerada da outra (§15, corolário). |
| `docs/guia_definitivo.md` | 185 | Guia Manim CE 0.19.0 | vivo (como doc) | **IGNORAR** | É subconjunto textual de `prompts.py:50-234` (`GUIDE_DEFINITIVO`), duplicado à mão. Mesmo defeito de §15. |
| `postman_collection.json` | 216 | Coleção Postman (local + `ondokai.com`) | experimental | **IGNORAR** | Artefato de consumo HTTP. |
| `.env.example` | 20 | Template de env | vivo | **IGNORAR (ler 3 linhas)** | `:13` e `:16` documentam `MANIM_RENDERER` e `MANIM_RENDERER_FALLBACK`, que é o único contrato de configuração de render. |
| `.gitignore` | 24 | — | vivo | **IGNORAR** | `:19-21` ignora `*.mp4`/`*.mov` — relevante só como aviso: qualquer golden master de vídeo no projeto novo precisa de allowlist explícita, senão o `git diff --exit-code` do gate **não enxerga o artefato** (Apêndice I). |
| `services/__init__.py` | 0 | — | vivo | **IGNORAR** | Vazio. |
| **Total `.py`** | **1447** | | | | Superfície consumida pelo caso de uso alvo: **9 símbolos, 1 arquivo** (Q2). |

**Fontes externas ao `manim-api/` que foram lidas:**

| arquivo | linhas | PAPEL | status | destino | justificativa |
|---|---:|---|---|---|---|
| `../API_CONSUMER.md` | 234 | Contrato público + **os únicos números de concorrência existentes** | vivo (doc) | **ABSORVER 4 números · IGNORAR o resto** | `:27`, `:150`, `:190`, `:193` são os únicos números operacionais do corpus. Nenhum traz evidência anexada (Q3). |
| `../CLOUDFLARE.md` | 420 | Runbook de túnel Cloudflare em macOS/GoDaddy | vivo (doc) | **IGNORAR** | Topologia de exposição pública. Um pipeline local determinístico não tem túnel. `:340-345` (ERR_TOO_MANY_REDIRECTS com Vercel) é o único item não-inferível, e é sobre DNS, não sobre vídeo. |
| `../performance_rendering_tips.md` | 21 | Tabela de estratégias de render rápido, com fontes web | vivo (doc) | **INTEGRAR como hipóteses** | `:5` (OpenGL), `:6` (`--format=mp4 --codec=h264 --bitrate 8000k --threads 8`), `:12` (iterar em `-ql`, finalizar em `-qh`). São **hipóteses citadas de terceiros**, não medições deste projeto — nenhuma delas está implementada em `manim_executor.py:223-236`. |

---

## 2. Q1 — Quirks e patches: o conhecimento **NÃO-INFERÍVEL**, linha a linha

Esta é a única razão econômica para o `manim-api` existir na análise. Cada item abaixo é uma
regra que **não se deduz do nome de nada** (§2, Q3 do playbook) e que um agente competente
reescreveria errado por bom senso.

### Q1.1 — Monkey-patch de `BackgroundRectangle.tex_string` prefixado a **todo** script

**Onde:** `services/manim_executor.py:30-35` (constante) e `services/manim_executor.py:220`
(aplicação: `script_path.write_text(f"{BACKGROUND_RECTANGLE_PATCH}\n\n{code}")`).

```
manim_executor.py:31  from manim.mobject.geometry.shape_matchers import BackgroundRectangle
manim_executor.py:33  if not hasattr(BackgroundRectangle, "tex_string"):
manim_executor.py:34      BackgroundRectangle.tex_string = ""
```

**Por que é não-inferível:** o nome "BackgroundRectangle" não sugere nenhuma relação com LaTeX.
A causa real está no upstream:
`manim-api/venv/lib/python3.12/site-packages/manim/animation/transform_matching_parts.py:292`
contém `assert hasattr(mobject, "tex_string")` dentro de `TransformMatchingTex`. E
`.../manim/mobject/geometry/shape_matchers.py:83` declara
`class BackgroundRectangle(SurroundingRectangle)` — que **não** possui `tex_string`
(verificado em execução: `hasattr(BackgroundRectangle, 'tex_string') == False`).

**Consequência exata:** `mob.add_background_rectangle()` seguido de
`TransformMatchingTex(mob, outro)` estoura `AssertionError`. O patch injeta o atributo na
**classe**, globalmente, antes de o script do usuário rodar.

**Sinal de que o próprio projeto sabe disso e mitiga por dois caminhos:** `prompts.py:286`
instrui o LLM a **não** deixar background rectangles dentro de objetos usados em
`TransformMatchingTex/TransformMatchingShapes`. Ou seja: o mesmo defeito é tratado no prompt
**e** por monkey-patch. Redundância deliberada, não duplicação acidental.

**Status:** **CONFIRMADO** (código do quirk + código upstream que o exige + execução).

### Q1.2 — `--write_to_movie` é obrigatório no OpenGL (e inócuo no Cairo)

**Onde:** `services/manim_executor.py:233` (dentro de `base_cmd`, `:223-236`).

**Por que é não-inferível:** o flag parece redundante — "renderizar" já deveria escrever vídeo.
O `--help` do Manim instalado é explícito:
`--write_to_movie  Write the video rendered with **opengl** to a file.`
E o mecanismo está em
`manim-api/venv/lib/python3.12/site-packages/manim/_config/utils.py:849-851`:

```
if self.renderer == RendererType.OPENGL and args.write_to_movie is None:
    # --write_to_movie was not passed on the command line, so don't generate video.
    self["write_to_movie"] = False
```

**Consequência exata:** sem o flag, o render OpenGL **executa as animações e não produz arquivo**,
e o erro que chega ao chamador é o genérico `"Video file not found after render"`
(`manim_executor.py:183`) — que aponta para o lugar errado (descoberta de arquivo), não para a
causa (nenhum arquivo foi escrito). Isso é o pior tipo de quirk: a mensagem de erro **mente sobre
a camada**.

**Proveniência:** commit `922e47d` (`fix: adiciona --write_to_movie ao comando Manim (OpenGL requer)`,
2026-08-09), cuja mensagem já registra o diagnóstico e os 4 cenários testados.

**Status:** **CONFIRMADO** (flag no código + `--help` do binário instalado + fonte upstream + commit).

### Q1.3 — Resolução de TeX Live por *glob* em `~/texlive/*/bin/*`, ordenada ao contrário

**Onde:** `services/manim_executor.py:17-25` (`_resolve_texlive_bin`), `:28` (avaliada **uma vez**
no import), `:62-67` (`_build_env` prefixa no `PATH`), `:150` (injetada no subprocess).

```
manim_executor.py:18  texlive_root = Path.home() / "texlive"
manim_executor.py:21  candidates = sorted(texlive_root.glob("*/bin/*"), reverse=True)
manim_executor.py:66  env["PATH"] = f"{TEXLIVE_BIN}:{current_path}" ...
```

**Por que é não-inferível:** (a) o caminho `~/texlive/<ano>/bin/<arch>` é o layout do instalador
**oficial** do TeX Live, não o do `apt`/`brew`; (b) `reverse=True` existe para preferir o ano mais
recente (`2025` > `2024`), o que só se entende sabendo que o glob retorna anos; (c) a resolução
acontece **no import do módulo** (`:28`), não por render — logo instalar TeX Live com o serviço no
ar **não tem efeito** até reiniciar o processo.

**Modo de falha silencioso:** se `~/texlive` não existir, `TEXLIVE_BIN` é `None` (`:20`) e o
subprocess herda só o `PATH` do sistema — `MathTex`/`Tex` falham **dentro** do render, com erro de
LaTeX, não com "TeX Live ausente". Não há nenhuma checagem de saúde de LaTeX em lugar nenhum do
executor (verificado por leitura integral de `manim_executor.py`).

**Status:** **CONFIRMADO** (código). O layout `~/texlive/<ano>/bin/<arch>` como convenção do
instalador oficial está em `## Não verificado`.

### Q1.4 — Detecção de GPU: 3 sondas, teto de 1,5 s cada, **sem cache**, e a regra do "E"

**Onde:** `services/manim_executor.py:70-117` (`_detect_gpu_renderer`), `:120-130`
(`_resolve_renderer`), `:238` (chamada), `:247-248` (injeção do flag), `:253-265` (fallback).

Fatos linha a linha:

| linha | fato |
|---|---|
| `:80` | sonda 1: `nvidia-smi -L`, `timeout=1.5` |
| `:87-89` | sonda 2: `glxinfo -B`, `timeout=1.5` |
| `:90` | aceita só se `returncode == 0` **e** `"opengl" in stdout.lower()` |
| `:97-99` | **sem hardware ⇒ retorna `False` e nem tenta o Manim** — economiza a terceira sonda |
| `:103-108` | sonda 3: `manim render --renderer=opengl --help`, `timeout=1.5` |
| `:110` | aceita só se `returncode == 0` **e** `"--renderer" in (stdout+stderr)` |
| `:84`, `:93`, `:113` | **toda** exceção é engolida e vira `False` — a função "nunca lança" (docstring `:71-75`) |
| `:127-130` | `"cairo"`/`"opengl"` passam direto; **qualquer outro valor**, inclusive lixo, cai em auto-detecção |
| `:247-248` | o flag é inserido em **posição 2** (`cmd.insert(2, "--renderer=opengl")`), logo após `manim render` — posicional, não append |
| `:262-263` | o fallback **remove** o flag em vez de passar `--renderer=cairo`: "sem `--renderer`, o Manim usa Cairo por padrão" |

**Os dois quirks reais aqui:**

1. **A regra do "E":** ter GPU não basta e ter Manim com OpenGL não basta — `:97` e `:110` exigem
   os dois. Um agente escreveria `or` por bom senso.
2. **Ausência de cache:** `_resolve_renderer()` é chamada **dentro** de `execute_manim`
   (`:238`), e nem ela nem `_detect_gpu_renderer` têm `lru_cache` (verificado: nenhum decorador em
   `:70` e `:120`). Com `MANIM_RENDERER=auto`, **cada render** paga até 3 spawns de subprocess
   (≤4,5 s). Contraste deliberado com `TEXLIVE_BIN` (`:28`), que É cacheado no import. A
   inconsistência é o achado.

**Status:** **CONFIRMADO** (código). O custo de 4,5 s é o **teto** dos timeouts declarados, não uma
medição — ver `## Não verificado`.

### Q1.5 — Sanitização `CYAN → TEAL` (e variantes `_A.._E`)

**Onde:** `services/openai_service.py:46-53` (mapa) e `:220-226` (`visit_Name` do transformer AST).

**Por que é não-inferível:** "CYAN" é um nome de cor óbvio e existe em Manim — só que **não no
namespace que `from manim import *` publica**. Verificado em execução com o Manim instalado:

```
CYAN   -> AUSENTE      TEAL   -> PRESENTE
CYAN_A -> AUSENTE      TEAL_A -> PRESENTE
```

`CYAN` existe apenas em paletas auxiliares que exigem import explícito
(`.../manim/utils/color/XKCD.py:209`, `.../SVGNAMES.py:49`, `.../DVIPSNAMES.py:43`), enquanto a
paleta núcleo tem `TEAL_A..TEAL_E` (`.../manim/utils/color/manim_colors.py:164-168`).

**Consequência exata:** `Circle(color=CYAN)` gera `NameError` **em tempo de execução do render**,
dentro do subprocess — ou seja, o erro chega como stderr de render, não como erro de validação.
Nada em `validate_code` (`openai_service.py:100-139`) pega isso.

**Contexto que fecha o círculo:** os 5 prompts do teste de carga
(`scripts/parallel_request_test.py:18-24`) pedem explicitamente "azul/teal", "tons cyan", "setas
teal" — o sanitizador nasceu desse teste (mesmo commit, `0ad3da0`).

**Status:** **CONFIRMADO** (mapa + execução no runtime real).

### Q1.6 — Sanitização `add_background_rectangle(fill_opacity=…) → opacity=…`

**Onde:** `services/openai_service.py:208-212`.

**Por que é não-inferível:** `fill_opacity` é o nome correto em **quase todo** o resto do Manim
(`Circle(fill_opacity=0.5)` funciona). O método é a exceção:
`.../manim/mobject/mobject.py:1952-1953` declara
`def add_background_rectangle(self, color=None, opacity: float = 0.75, **kwargs)`, e o corpo em
`.../mobject.py:1986-1988` faz `BackgroundRectangle(self, color=color, fill_opacity=opacity, **kwargs)`.

**Consequência exata, executada agora:**

```
Square().add_background_rectangle(fill_opacity=0.6)
  -> TypeError: ... BackgroundRectangle() got multiple values for keyword argument 'fill_opacity'
```

Note o formato do erro: **"multiple values"**, não "unexpected keyword". É colisão do `**kwargs`
com o argumento já preenchido — o tipo de erro que ninguém adivinha lendo a assinatura pública.

**Status:** **CONFIRMADO** (assinatura + corpo upstream + `TypeError` reproduzido).

### Q1.7 — Remoção de `tip_style=` em `add_tip(...)`

**Onde:** `services/openai_service.py:213-218` (filtra o kwarg, mantém os demais).

**Por que é não-inferível:** `tip_style` é o nome usado em ManimGL/versões antigas; o Manim CE
atual expõe `tip_shape`. Assinatura real:
`.../manim/mobject/geometry/arc.py:114-121` → `add_tip(tip=None, tip_shape=None, tip_length=None, tip_width=None, at_start=False)`.

**Consequência exata, executada agora:**

```
Line().add_tip(tip_style=0)
  -> TypeError: TipableVMobject.add_tip() got an unexpected keyword argument 'tip_style'
```

**Status:** **CONFIRMADO** (assinatura + `TypeError` reproduzido).

### Q1.8 — Descoberta do MP4 de saída: 4 regras, e a última é uma armadilha

**Onde:** `services/manim_executor.py:48-59`.

| linha | regra |
|---|---|
| `:50-52` | procura em `<media_dir>/videos/**` recursivamente; **se essa pasta não existir**, cai para `<media_dir>/**` |
| `:51-55` | ordena por `st_mtime` **decrescente** |
| `:56-58` | primeira preferência: `scene_name in mp4.stem` (substring do *stem*, não igualdade) |
| `:59` | **fallback: `candidates[0]`** — o `.mp4` mais recente **qualquer que seja** |

**Por que é não-inferível:** o Manim escreve em subpasta nomeada por qualidade
(`media/videos/<script>/<WxH><fps>/`), cujo nome depende de flags que o chamador nem passou — o
`README.md:949-958` desenha exatamente essa árvore. Não dá para montar o caminho por concatenação;
tem de buscar.

**A armadilha do fallback (`:59`):** o Manim também escreve `.mp4` em
`partial_movie_files/` (a mesma árvore, `README.md:957`). Se o casamento por nome falhar — por
exemplo se alguém passar `-o/--output_file`, que existe no CLI instalado — o fallback devolve um
**fragmento parcial** como se fosse o vídeo final, e o pipeline reporta **sucesso**. É um falso
verde de manual (Apêndice I): não há nenhuma asserção sobre o arquivo escolhido além de "é um mp4
e é o mais novo".

**Status:** **CONFIRMADO** quanto ao código e à existência de `partial_movie_files` na árvore
documentada. O disparo real do fallback num render concreto está em `## Não verificado`.

### Q1.9 — O que **não** está lá e parece que deveria estar

Verificado por leitura integral + `grep` (R5): **não existe** nenhuma ocorrência de
`-t`, `--transparent` ou `--format` em `services/manim_executor.py`. As únicas menções a
transparência no repositório são **prosa de prompt**: `prompts.py:32` ("usar `-t` (gera .mov por
padrão) ou `--transparent --format=webm`") e `docs/guia_definitivo.md:70`.

**Isto é o achado central para o projeto novo:** o executor do `manim-api` **nunca renderizou com
fundo transparente**. O caso de uso alvo não é uma extensão do que existe; é um caminho não
percorrido. Ver Q5.2 para a consequência mecânica.

---

## 3. Q2 — Superfície **realmente** consumida, por call-site

Caso de uso declarado: *"renderizar uma cena Manim headless com fundo transparente e receber o
caminho do arquivo"*. Inventário por call-site (§38), não por arquivo.

### 3.1 O call-site único

O projeto novo faria **1 (uma) chamada**:

```python
resultado = execute_manim(code, scene_name, width, height, timeout, request_id)
```

assinatura em `services/manim_executor.py:199-206`.

### 3.2 O que essa única chamada arrasta (fecho transitivo)

| # | símbolo | arquivo:linha | é necessário para o caso de uso? |
|---|---|---|---|
| 1 | `execute_manim` | `manim_executor.py:199` | sim — é o call-site |
| 2 | `BACKGROUND_RECTANGLE_PATCH` | `manim_executor.py:30` | sim, **se** a cena usar `TransformMatchingTex` + background rect |
| 3 | `_run_manim_render` | `manim_executor.py:133` | sim (wrapper do subprocess) |
| 4 | `find_video` | `manim_executor.py:48` | sim — **mas quebra com transparência** (Q5.2) |
| 5 | `RenderResult` | `manim_executor.py:38` | parcialmente: 3 dos 6 campos são inúteis aqui |
| 6 | `_build_env` | `manim_executor.py:62` | só se houver LaTeX na cena |
| 7 | `TEXLIVE_BIN` / `_resolve_texlive_bin` | `manim_executor.py:28` / `:17` | idem |
| 8 | `_resolve_renderer` | `manim_executor.py:120` | opcional (só se quiser GPU) |
| 9 | `_detect_gpu_renderer` | `manim_executor.py:70` | opcional (idem) |
| — | `settings.manim_renderer` | `config.py:16` | opcional |
| — | `settings.manim_renderer_fallback` | `config.py:17` | opcional |
| — | `settings.render_timeout` | `config.py:15` | não: o chamador já passa `timeout` (`main.py:161`) |

**Total: 9 símbolos, todos em 1 arquivo, mais 2 campos de configuração.**

### 3.3 O que tem **zero** call-sites no caso de uso

| módulo | símbolos públicos | call-sites |
|---|---:|---:|
| `schemas.py` (`:5`, `:26`, `:33`, `:42`) | 4 classes | **0** |
| `prompts.py` (`:1`, `:9`, `:50`, `:236`, `:242`, `:271`, `:332`, `:348`, `:356`) | 9 | **0** |
| `openai_service.py` (`:78`, `:91`, `:100`, `:188`, `:239`, `:264` + 8 privados) | 14 | **0** (ou **1**, `sanitize_code`, se o código vier de LLM) |
| `main.py` (`:41`, `:72`, `:92`, `:98`, `:102`, `:122`, `:189`) | 7 | **0** |
| `scripts/parallel_request_test.py` (`:27`, `:79`) | 2 | **0** |

### 3.4 A conta que decide ABSORVER × INTEGRAR

- Publicado: **1447 linhas** de Python em 8 arquivos.
- Executado pelo caso de uso: **1 arquivo**, ~119 linhas úteis (patch `:30-35`; `find_video`
  `:48-59`; TeX Live `:17-28` + `:62-67`; GPU `:70-130`; subprocess `:144-151`; `base_cmd`
  `:223-236`).
- **Conhecimento não-inferível** dentro disso: os 8 itens de Q1 ≈ **25 linhas de fato**.
- Razão publicado : consumido ≈ **12 : 1**. Razão publicado : conhecimento ≈ **58 : 1**.

Isto é exatamente a assimetria que §38 prevê ("a superfície consumida costuma ser uma ordem de
grandeza menor que a publicada"), e ela decide sozinha: **ABSORVER os fatos, não integrar o
pacote**. Não há dependência a versionar, não há upstream a acompanhar, não há autor a quem
reportar bug — é código de um MVP interno de 1447 linhas cujo caminho útil cabe numa página.

---

## 4. Q3 — O que `parallel_request_test.py` revela sobre concorrência

### 4.1 O que o script faz (números que existem no arquivo)

| fato | citação |
|---|---|
| alvo é **local**: `http://127.0.0.1:8000/generate-video` | `scripts/parallel_request_test.py:13` |
| **5** prompts, todos sobre eixos cartesianos em azul/teal/cyan | `:18-24` |
| paralelismo = **5** (`max_workers=len(PROMPTS)`) — não configurável | `:81` |
| timeout por request: **300 s** | `:16` |
| resolução: **1920×1080** | `:14-15` |
| mede `time.perf_counter()` por request e no total | `:43`, `:61`, `:80`, `:85` |
| imprime `Total wall time for N requests` | `:106` |
| sai `1` se **qualquer** request falhar, e trata **`render_logs` não vazio como falha** | `:99-102`, `:103`, `:107` |

### 4.2 O que ele **não** faz — e por que isso invalida a leitura ingênua

1. **Não é um benchmark de render.** Cada request de `/generate-video` faz **2 chamadas ao LLM
   antes de qualquer render** — `optimize_prompt` (`openai_service.py:248-252`) e a geração de
   código (`:290-294`) —, ambas com `reasoning={"effort": "xhigh"}` (`:251`, `:293`), e até **3**
   tentativas de código (`:37`, `:281`). Ou seja: até **4 round-trips de LLM** por request. O
   número que o script imprime (`:106`) mistura latência de LLM com tempo de render, sem
   separação possível.
2. **Não tem controle serial.** Não existe execução de referência com 1 request. Sem denominador,
   "total wall time" não distingue "escalou bem" de "a máquina estava ociosa" — a armadilha do
   denominador da Parte VII.
3. **Não grava nada.** `grep` por `benchmark|wall time|throughput|resultado` em todos os `.md`/`.json`/`.txt`
   do repositório (fora de `venv/`) não retorna **nenhum** resultado registrado. O script imprime
   e morre. Não há série histórica, não há artefato, não há gate.
4. **Nunca toca o gargalo real dos clientes.** Ele bate em `127.0.0.1` (`:13`), portanto **passa
   por fora do Cloudflare Tunnel** — que é onde o teto de verdade mora (4.3).

### 4.3 Os únicos números de concorrência que existem no corpus (e a origem deles)

Todos vivem em prosa, em `API_CONSUMER.md`, **sem evidência anexada**:

| número | citação |
|---|---|
| **6–8 renders simultâneas** recomendadas | `../API_CONSUMER.md:27`, repetido em `:151` e `:190` |
| hardware: **Mac mini M1, 16 GB** | `../API_CONSUMER.md:27` |
| "latência aumenta quando todos os **8 núcleos** estão ocupados" | `../API_CONSUMER.md:193` |
| latência esperada por render: **20–70 s** | `../API_CONSUMER.md:16` |
| Cloudflare derruba requests que passam de **~100 s** sem resposta (524) | `../API_CONSUMER.md:150`, `:211` |
| timeout de render no servidor: **120 s** | `config.py:15`, ecoado em `../API_CONSUMER.md:188` |

### 4.4 O que satura primeiro — resposta com as três camadas separadas

1. **Para cliente remoto (o caminho real de produção): satura o túnel, não o renderizador.**
   O teto do Cloudflare (~100 s, `../API_CONSUMER.md:150`) é **menor** que o `render_timeout` do
   servidor (120 s, `config.py:15`). Logo existe uma janela de 20 s em que o servidor ainda está
   renderizando e o cliente já levou 524. Do lado do servidor isso aparece como render bem-sucedido
   sem consumidor; do lado do cliente, como falha. **Nenhum dos dois lados registra a
   discrepância.** Este é o achado operacional mais acionável de Q3.
2. **Para o processo: satura CPU, e o número declarado é 8 núcleos** (`../API_CONSUMER.md:193`).
   Coerente com o desenho: o render roda em processo filho (`manim_executor.py:144-151`)
   despachado por `asyncio.to_thread` (`main.py:155`), então N requests ⇒ N processos `manim`
   competindo por núcleo.
3. **Antes disso, pode saturar o LLM.** 5 requests paralelos ⇒ até 20 chamadas à OpenAI
   (`openai_service.py:248`, `:290`, com `MAX_CODE_ATTEMPTS=3` em `:37`). Nenhum rate-limit,
   retry com backoff ou fila existe no código — `README.md:1208` lista `OpenAI RateLimitError`
   como problema conhecido e `README.md:1223` admite "Sem retry". **Não medido.**

### 4.5 A contradição que o script expõe sem querer

O script exercita **5** simultâneos (`:81`); a documentação recomenda **6–8**
(`../API_CONSUMER.md:27`). O teto documentado **nunca foi exercitado pela ferramenta que existe
para exercitá-lo**. E o `README.md:1221` ainda declara a limitação oposta — "**Single-threaded**:
Apenas uma renderização por vez" — que `main.py:155` e `../API_CONSUMER.md:193` contradizem.
Três documentos, três números, zero medições.

---

## 5. Q4 — O que está ACOPLADO a OpenAI/FastAPI e não serve a pipeline local determinístico

### Q4.1 — O acoplamento duro: **o executor de vídeo não importa sem chave de LLM** (provado)

`services/manim_executor.py:11` faz `from config import get_settings` e `:13` executa
`get_settings()` **no import**. `config.py:7` declara `openai_api_key: str` **sem default**, e
`config.py:23-27` só lê `.env` do diretório corrente (que **não existe** no repositório — só
`.env.example`).

Prova executada, com o interpretador do próprio `venv` do projeto, sem `OPENAI_API_KEY` e fora do
diretório do `.env`:

```
$ env -u OPENAI_API_KEY python -c "from services.manim_executor import execute_manim"
EXECUTOR IMPORT FALHOU: ValidationError
1 validation error for Settings
openai_api_key
  Field required [type=missing, input_value={}, input_type=dict]
```

**Leitura:** o módulo que renderiza vídeo — que não usa OpenAI para nada — é **inimportável** sem
credencial de OpenAI. Para um pipeline local determinístico isso é discricionário e fatal: você não
consegue nem escrever um teste de caracterização do render sem provisionar uma chave falsa.

### Q4.2 — Cliente OpenAI instanciado no import

`services/openai_service.py:18`: `client = AsyncOpenAI(api_key=settings.openai_api_key)` em escopo
de módulo. Qualquer import de `openai_service` — inclusive para pegar só `sanitize_code`
(`:188`), que é **AST puro e não toca a rede** — constrói o cliente. Se o projeto novo quiser
`sanitize_code`, tem de **copiar a função**, não importar o módulo.

### Q4.3 — Não-determinismo por construção, em 4 pontos

| ponto | citação | por que mata determinismo |
|---|---|---|
| `reasoning={"effort": "xhigh"}` sem `seed`, `temperature` ou `top_p` | `openai_service.py:251`, `:293` | duas chamadas idênticas produzem cenas diferentes |
| 3 tentativas com **prompt mutante** a cada retry | `:37`, `:281-284`, `:38-44` | a saída depende de quantas vezes falhou |
| `optimize_prompt` engole toda exceção e devolve o prompt original | `:259-261` | falha de rede vira mudança silenciosa de entrada |
| `_safe_load_json` devolve `{}` em JSON inválido, e `_ensure_str` cai para default | `:153-157`, `:160-167`, `:255-256` | resposta corrompida vira degradação muda |

`README.md:1222` reconhece: "**Sem cache**: Mesma descrição gera código diferente".

### Q4.4 — Acoplamento a FastAPI/HTTP (tudo IGNORAR)

| item | citação |
|---|---|
| `CORSMiddleware(allow_origins=["*"], allow_origin_regex=".*")` | `main.py:30-37` |
| middleware que responde **200 a qualquer OPTIONS**, inclusive em rota inexistente | `main.py:47-48` |
| eco de `Access-Control-Allow-Headers` a partir do header do request | `main.py:57-58` |
| `request_id` derivado de header do cliente (`x-request-id`) sem validação | `main.py:42` |
| health que dispara `subprocess manim --version` **por request** | `main.py:75-80` |
| `/generate-video-file` faz **base64-encode e depois base64-decode** do mesmo vídeo | `manim_executor.py:188` → `main.py:242` |
| DTOs pydantic que só existem para o wire HTTP | `schemas.py:5-45` |

O último item merece nome: o executor **sempre** carrega o MP4 inteiro em memória e o codifica em
base64 (`manim_executor.py:188`), mesmo quando o consumidor quer bytes crus — e aí `main.py:242`
desfaz. Custo: ~2,33× o tamanho do vídeo em RAM por render, multiplicado pelos 6–8 simultâneos
recomendados.

### Q4.5 — A "segurança" é de fachada e o projeto novo não deve herdá-la como se fosse defesa

`openai_service.py:21-33` bloqueia imports (`os`, `sys`, `subprocess`, …) e `:35` bloqueia
`eval/exec/open/__import__/compile`. Mas o código aprovado é escrito num arquivo
(`manim_executor.py:218-220`) e executado por `subprocess.run` **na conta do usuário, sem
container, sem sandbox, sem usuário separado** (`manim_executor.py:144-151`), com
`env = os.environ.copy()` — o **ambiente inteiro do processo pai**, sem allowlist
(`manim_executor.py:63`).

Enquanto isso, `prompts.py:4` afirma ao LLM: *"Ambiente Python 3.11 isolado, sem acesso à
rede/arquivo além do subprocess controlado"*. Isso é **falso** e está sendo dito ao modelo como se
fosse contexto factual. Ver refutação R4 na §7.

---

## 6. Q5 — Riscos de copiar: o que **parece** reutilizável e não é

### Q5.1 — O corpus inteiro documenta 0.19.0; a máquina roda **0.20.1**

`requirements.txt:7` pina `manim>=0.19.0`. `README.md:6`, `README.md:142`, `prompts.py:3`,
`prompts.py:10`, `prompts.py:33`, `prompts.py:50`, `docs/guia_definitivo.md:1`,
`../API_CONSUMER.md:10` dizem **0.19.0**. O binário instalado responde:

```
$ manim --version
Manim Community v0.20.1
```

Consequência direta: a seção "Mudanças críticas da versão 0.19.0" (`prompts.py:124-128`) é
injetada em **todo** system prompt como se fosse o changelog vigente. O sistema está ensinando o
LLM sobre a versão errada. Copiar `prompts.py` é copiar essa defasagem.

### Q5.2 — `find_video` **não pode** servir ao caso de uso alvo (falha por construção)

Esta é a refutação mais importante para o projeto novo, e é mecânica:

1. `manim_executor.py:52` glob **só** `*.mp4` (nos dois ramos do ternário), e `:57` casa o
   candidato pelo *stem*.
2. Com `-t/--transparent`, o Manim **troca a extensão de saída**:
   `manim-api/venv/lib/python3.12/site-packages/manim/_config/utils.py:1438-1447` —
   `resolve_movie_file_extension` define `.mov` (ou `.webm` se `--format=webm`) quando
   `is_transparent`; e `.../utils.py:1324-1326` mostra que passar `-t` dispara exatamente essa
   resolução. `prompts.py:32` diz a mesma coisa em prosa.
3. Logo: render transparente **sucede**, escreve `Cena.mov`, e `find_video` devolve `None`
   (`:59`, com `candidates` vazio) ⇒ `execute_manim` reporta
   `"Video file not found after render"` (`:183`) **com `returncode == 0`**.

Ou seja: a função que mais parece "utilitário genérico pronto" é a que **falha em silêncio,
reportando erro na camada errada**, exatamente no cenário que o projeto novo precisa.

### Q5.3 — `RenderResult.video_path` é um **caminho para arquivo já apagado**

`manim_executor.py:216` abre `with tempfile.TemporaryDirectory(prefix="manim_") as tmpdir:` e
`:267` executa `return result` **de dentro** do `with`. O `video_path` (`:192`) aponta para
`<tmpdir>/media/videos/.../Cena.mp4`. Quando `execute_manim` retorna, o context manager já
destruiu a árvore.

O defeito está **latente** porque nenhum chamador usa o campo: `grep video_path` em todo o código
não-`venv` retorna só definições e usos internos ao próprio executor
(`manim_executor.py:41,178,179,188,189,192`) — `main.py` consome apenas `video_base64`
(`main.py:184`, `main.py:242`).

**Para o caso de uso alvo — "receber o caminho do arquivo" — este é o pior risco do inventário:**
o campo existe, tem o nome certo, o tipo certo, e devolve um caminho morto. Um agente que copiar
`manim_executor.py` e trocar `video_base64` por `video_path` produz código que passa em revisão,
compila, roda, e devolve `FileNotFoundError` no consumidor.

### Q5.4 — A skill `manim-rendering` do repositório tem pinos de linha **derivados**

`/home/ondokai/Projects/3blue1brown/.agents/skills/manim-rendering/SKILL.md` é o candidato natural
a "conhecimento pronto para transplantar". Ela está **desatualizada em relação ao arquivo que
descreve**:

| a skill afirma | realidade |
|---|---|
| `SKILL.md:22` "tempfile isolation — `manim_executor.py:86-106`" | `with tempfile.TemporaryDirectory` está em `manim_executor.py:216` |
| `SKILL.md:37` "o patch é aplicado na linha 90" | aplicado em `manim_executor.py:220` |
| `SKILL.md:104` "timeout — `manim_executor.py:117-127`" | `try/except TimeoutExpired` em `manim_executor.py:143-159` |
| `SKILL.md:119` "Full executor implementation (**157 lines**)" | `wc -l` = **267** |
| `SKILL.md:58` "Verified against Manim CE **v0.20.1**" | é o único lugar do corpus que acerta a versão — e contradiz `requirements.txt:7` e todo o resto |

Pior: o `verification_signal` da skill (`SKILL.md:6`) contém
`python3 -c 'from manim-api.services.manim_executor import …'` — **`manim-api` tem hífen e não é
identificador Python válido**; esse comando não pode passar. É um gate que só pode falhar, o que na
prática o torna um gate que ninguém roda. Falso verde por construção (Apêndice I).

**Risco de copiar:** transplantar a skill traz junto 5 pinos mortos e uma asserção falsa sobre GIL
(R3 na §7). §35 é explícito: citação sem hash é endereço, não asserção de conteúdo.

### Q5.5 — `README.md` carrega uma **segunda implementação** que não é a que roda

`README.md:270-881` reproduz `config.py`, `schemas.py`, `prompts.py`, `openai_service.py`,
`manim_executor.py` e `main.py` inteiros. Essa cópia:

- não tem GPU/OpenGL (compare `README.md:639-714` com `manim_executor.py:199-267`);
- não tem o monkey-patch de `BackgroundRectangle` (`README.md:650` escreve `script_path.write_text(code)` cru);
- não tem `--write_to_movie` (`README.md:652-664`);
- usa `client.chat.completions.create(...)` com `temperature=0.2, max_tokens=2000`
  (`README.md:560-565`, `README.md:904-912`) — que a própria linha `README.md:38` declara não
  funcionar com o modelo em uso ("não funciona em Chat Completions").

Um agente que "reusar o código do README" reconstrói o MVP **sem nenhum dos 8 quirks de Q1**. Este
é o risco de cópia de maior probabilidade, porque o README é o arquivo mais convidativo do repo.

### Q5.6 — `prompts.py` recomenda parâmetros que o código não usa

`prompts.py:39` instrui: *"Parâmetros LLM recomendados: temperature 0.0–0.3, top_p 0.9–0.95,
max_tokens 4000–8000"* — e `prompts.py:134` repete. As chamadas reais
(`openai_service.py:248-252` e `:290-294`) não passam **nenhum** dos três: só `model`, `input` e
`reasoning`. A base de conhecimento contradiz o motor que ela alimenta.

### Q5.7 — `--fps 60` e resolução são hardcoded no comando

`manim_executor.py:228-229` fixa `--fps 60` sem passar por `config.py` (verificado: `grep fps`
em `config.py` não retorna nada; os únicos campos Manim são `:15-17`). Para um editor de vídeo IA,
FPS é parâmetro de timeline, não constante de executor. Copiar `base_cmd` (`:223-236`) é herdar
uma decisão de produto disfarçada de detalhe de CLI.

### Q5.8 — Ordem de flags é posicional e frágil

`manim_executor.py:247-248` insere `--renderer=opengl` em **posição 2** de uma lista literal. Se
alguém reordenar `base_cmd` (`:223-236`) — por exemplo mover `-r` para depois de `--fps` — a
inserção passa a cair no meio de um par flag/valor. Nada testa isso; nenhum teste existe no
repositório (não há diretório `tests/`, `pytest>=7.4.0` está em `requirements.txt:10` sem nenhum
arquivo de teste).

---

## 7. Refutações — o que "o panorama" diz × o que é de fato

| # | O que o panorama diz | O que é de fato |
|---|---|---|
| **R1** | `README.md:6`, `prompts.py:3`, `docs/guia_definitivo.md:1`, `../API_CONSUMER.md:10`: a stack é **Manim CE 0.19.0**. | O binário instalado é **v0.20.1** (`manim --version` no `venv` do projeto). Todo o changelog "0.19.0" injetado em `prompts.py:124-128` é contexto errado entregue ao LLM em toda chamada. |
| **R2** | `README.md:1221`: "**Single-threaded**: Apenas uma renderização por vez". | `main.py:155` despacha o render via `asyncio.to_thread`, e `../API_CONSUMER.md:193` afirma execução em threads paralelas com 8 núcleos. O README descreve um sistema que deixou de existir. |
| **R3** | `SKILL.md:114`: "The **GIL is held** during the entire render". | O render acontece num **processo filho** (`manim_executor.py:144-151`, `subprocess.run`); o GIL é liberado enquanto a thread espera o filho. O que de fato limita é CPU/núcleos e o número de workers do executor default do `asyncio.to_thread`. A frase da skill diagnostica o gargalo errado. |
| **R4** | `prompts.py:4`: "Ambiente Python 3.11 isolado, **sem acesso à rede/arquivo** além do subprocess controlado". | Não há isolamento algum: o código gerado por LLM é escrito em disco (`manim_executor.py:218-220`) e executado com `subprocess.run` na conta do usuário (`:144-151`), recebendo **cópia integral de `os.environ`** sem allowlist (`:63`). A blocklist AST (`openai_service.py:21-35`) bloqueia nomes, não capacidades. |
| **R5** | `manim_executor.py:41` + `:192`: `RenderResult.video_path` é "o caminho do vídeo". | É o caminho de um arquivo dentro de `tempfile.TemporaryDirectory` (`:216`) que é destruído no `return` (`:267`). O campo é sempre um caminho morto para quem está fora. |
| **R6** | `find_video` (`manim_executor.py:48-59`) parece um utilitário genérico de descoberta de saída. | O glob é `*.mp4` nos dois ramos (`:52`) e o casamento é por *stem* (`:57`). Render transparente escreve `.mov` (`venv/.../manim/_config/utils.py:1438-1447`) ⇒ retorna `None` ⇒ o pipeline reporta "Video file not found after render" (`:183`) para um render que **funcionou**. |
| **R7** | `manim_executor.py:59` (`return candidates[0]`) parece um fallback prudente. | Devolve **qualquer** `.mp4` mais recente na árvore, incluindo os fragmentos de `partial_movie_files/` (árvore em `README.md:949-958`). Sucesso reportado com artefato errado — falso verde. |
| **R8** | `../API_CONSUMER.md:27`/`:151`/`:190`: "6–8 renders simultâneas" é o limite conhecido. | Nenhuma medição sustenta o número: `scripts/parallel_request_test.py:81` exercita **5**, imprime e não grava (`:106`); não há arquivo de resultado em nenhum lugar do repo. É afirmação sem evidência anexada — o estado que §36 chama de pior que item aberto. |
| **R9** | `../API_CONSUMER.md:188`/`config.py:15`: o teto por request é o timeout de render de **120 s**. | Para cliente remoto o teto efetivo é **~100 s**, imposto pelo Cloudflare (`../API_CONSUMER.md:150`, `:211`) — **antes** do timeout do servidor. Existe uma janela de 20 s em que o servidor renderiza para ninguém. |
| **R10** | `README.md:37-55` e `:38`: o pipeline usa exclusivamente a Responses API, "não funciona em Chat Completions". | O mesmo README, em `:560-565` e `:904-912`, prescreve `client.chat.completions.create(...)` com `temperature`/`max_tokens` como "parâmetros de chamada recomendados". Duas seções do mesmo arquivo se contradizem. |
| **R11** | `prompts.py:39` e `:134`: usar `temperature 0.0–0.3`, `top_p 0.9–0.95`, `max_tokens 4000–8000`. | As chamadas reais (`openai_service.py:248-252`, `:290-294`) não passam nenhum dos três parâmetros. A recomendação é inexecutável na Responses API tal como usada. |
| **R12** | `SKILL.md` é conhecimento pronto para transplantar. | 5 dos seus pinos de linha estão mortos (Q5.4) e seu `verification_signal` (`SKILL.md:6`) contém um import Python sintaticamente inválido (`from manim-api.services…`) — nunca pode passar. |
| **R13** | O executor de vídeo é independente do LLM (arquivos separados, `services/manim_executor.py` × `services/openai_service.py`). | `manim_executor.py:11-13` + `config.py:7` tornam o executor **inimportável** sem `OPENAI_API_KEY` — provado com `ValidationError` no interpretador do próprio projeto. |
| **R14** | `performance_rendering_tips.md` é a política de performance do projeto. | Nenhuma das 8 linhas da tabela (`:5-12`) está implementada: `base_cmd` (`manim_executor.py:223-236`) não passa `--codec`, `--bitrate`, `--threads`, nem `-ql/-qm`; e mantém `--disable_caching` (`:232`), o oposto de `:12` ("finalize em `-qh/-qp` com caching ligado"). São hipóteses de terceiros, não prática. |

---

## 8. Decisão de reuso (recomendação — separada do achado, §6)

**Congelar na raiz da árvore e tornar hereditário (§38):**

> **ABSORVER conhecimento, não código.** O projeto novo escreve um executor próprio de ~120 linhas
> e importa do `manim-api` **zero** símbolos. Os 8 quirks de Q1 entram como comentários âncora com
> citação, e cada um vira um teste.

Justificativa em unidade contável: 9 símbolos consumidos contra 1447 linhas publicadas (12:1), e
2 dos 9 (`find_video`, `RenderResult.video_path`) são **inservíveis** para o caso de uso alvo
(R5, R6). Custo de reversão desta decisão: reescrever ~120 linhas — barato, e por isso a decisão
é um ponto de troca barata legítimo.

**Delta obrigatório do executor novo em relação ao do `manim-api`:**

| # | mudança | motivo |
|---|---|---|
| 1 | zero import de `config`/pydantic-settings de LLM | R13 |
| 2 | tmpdir com **tempo de vida controlado pelo chamador** (ou mover o arquivo antes de retornar) | R5 |
| 3 | descoberta por **extensão derivada do formato pedido** (`.mp4`/`.mov`/`.webm`), nunca `*.mp4` fixo | R6 |
| 4 | fallback de descoberta **proibido**: sem casamento exato, é erro | R7 |
| 5 | retornar **caminho**, nunca base64 obrigatório | Q4.4 |
| 6 | excluir `partial_movie_files/` da busca explicitamente | R7 |
| 7 | `_detect_gpu_renderer` cacheado por processo | Q1.4 |
| 8 | `--fps` e formato como parâmetros, não literais | Q5.7 |
| 9 | `env` do subprocess por **allowlist**, não `os.environ.copy()` | R4 |
| 10 | manter `--write_to_movie` sempre, e o monkey-patch de `BackgroundRectangle` | Q1.1, Q1.2 |

---

## 9. Placar dos claims

`placar` = *fontes independentes que sustentam* – *fontes que contradizem*. Rótulo por §36.

| id | claim (falsificável) | placar | rótulo |
|---|---|---:|---|
| C01 | Sem `--write_to_movie`, o renderer OpenGL do Manim CE não escreve arquivo de vídeo. | 4-0 | CONFIRMADO |
| C02 | `BackgroundRectangle` não tem `tex_string`, e `TransformMatchingTex` faz `assert hasattr(mobject,"tex_string")`. | 3-0 | CONFIRMADO |
| C03 | `CYAN` não é exportado por `from manim import *`; `TEAL`/`TEAL_A..E` são. | 3-0 | CONFIRMADO |
| C04 | `add_background_rectangle(fill_opacity=…)` levanta `TypeError: got multiple values`. | 3-0 | CONFIRMADO |
| C05 | `add_tip(tip_style=…)` levanta `TypeError: unexpected keyword argument`. | 2-0 | CONFIRMADO |
| C06 | `from services.manim_executor import execute_manim` falha com `ValidationError` sem `OPENAI_API_KEY`. | 3-0 | CONFIRMADO |
| C07 | Render com `-t` produz `.mov`/`.webm`, e `find_video` só varre `*.mp4` ⇒ retorna `None`. | 3-0 | CONFIRMADO |
| C08 | `RenderResult.video_path` aponta para dentro de um `TemporaryDirectory` destruído no `return`. | 2-0 | CONFIRMADO |
| C09 | O Manim instalado é 0.20.1 enquanto todo o corpus documenta 0.19.0. | 8-1 | CONFIRMADO |
| C10 | A superfície consumida pelo caso de uso alvo é de 9 símbolos em 1 arquivo. | 2-0 | CONFIRMADO |
| C11 | Não existe nenhuma medição de concorrência registrada no repositório. | 2-0 | CONFIRMADO |
| C12 | O teto efetivo por request para cliente remoto (~100 s) é menor que o `render_timeout` (120 s). | 2-0 | CONFIRMADO |
| C13 | `_detect_gpu_renderer` roda a cada `execute_manim`, sem cache, com até 3 spawns de subprocess. | 2-0 | CONFIRMADO |
| C14 | A blocklist AST não confere isolamento: o render roda sem sandbox com `os.environ` copiado inteiro. | 3-0 | CONFIRMADO |
| C15 | O `verification_signal` da skill `manim-rendering` é sintaticamente inválido em Python. | 1-0 | CONFIRMADO |
| C16 | O código reproduzido no `README.md` diverge do código-fonte real em ≥4 pontos materiais. | 2-0 | CONFIRMADO |
| C17 | O fallback `find_video` (`:59`) pode devolver um fragmento de `partial_movie_files/`. | 1-0 | PROVÁVEL |
| C18 | Com `MANIM_RENDERER=auto`, a detecção adiciona até ~4,5 s por render. | 1-0 | PROVÁVEL |
| C19 | O paralelismo real de renders é limitado pelo `ThreadPoolExecutor` default do `asyncio.to_thread`. | 1-0 | PROVÁVEL |
| C20 | Sob 5 requests paralelos, a OpenAI (até 20 chamadas) satura antes da CPU. | 0-0 | NÃO VERIFICADO |
| C21 | `~/texlive/<ano>/bin/<arch>` é o layout do instalador oficial do TeX Live. | 1-0 | PROVÁVEL |
| C22 | Largura/altura ímpares (permitidas por `schemas.py:12-23`) quebram o encode H.264. | 0-0 | NÃO VERIFICADO |

---

## 10. Perguntas para o dono (§5 — dependem de mandato, topologia ou apetite de risco)

1. O projeto novo vai renderizar **só** com fundo transparente, ou transparência é um modo entre
   vários? (decide se a descoberta de arquivo é por extensão fixa ou derivada do formato — R6)
2. Onde o MP4/MOV deve **aterrissar**? Diretório persistente gerenciado pelo chamador, ou o
   executor devolve bytes? (decide o destino de R5/Q5.3)
3. Qual é o hardware alvo? O único número de concorrência do corpus assume Mac mini M1 16 GB
   (`../API_CONSUMER.md:27`) e não se transfere. Há GPU NVIDIA no alvo?
4. Vale manter o caminho OpenGL, dado que ele custa até 3 sondas por render (Q1.4) e cai para Cairo
   ao primeiro erro (`manim_executor.py:253-265`)? Ou fixar `cairo` e eliminar 61 linhas?
5. O executor novo pode **exigir** LaTeX, ou precisa degradar (`Text` em vez de `MathTex`) quando
   TeX Live não estiver presente? Hoje a ausência é silenciosa (Q1.3).
6. Qual é o apetite de risco para executar código gerado por LLM **sem sandbox**? Hoje não há
   nenhum (R4). Container/usuário separado entra em qual onda?
7. Fixamos `manim==0.20.1` (o que está instalado) ou seguimos `>=0.19.0`? Todo o Q1 foi verificado
   contra 0.20.1 (C09).
8. O FPS é parâmetro do editor (timeline) ou constante do executor? Hoje é literal `60`
   (`manim_executor.py:228-229`).
9. Algum consumidor externo já depende dos endpoints `ondokai.com`
   (`../API_CONSUMER.md:20-21`)? Isso muda o blast radius de qualquer aposentadoria do `manim-api`.
10. `prompts.py` (373 linhas) deve ser portado como base de conhecimento do editor novo, sabendo
    que fala de 0.19.0 e recomenda parâmetros que o código não usa (R1, R11)?

---

## 11. Sementes de ledger de incerteza (§36 — cada uma com passo executável)

- **L01-U01** — O fallback de `find_video` (`manim_executor.py:59`) devolve fragmento de
  `partial_movie_files/`? **Fecha com:** render de cena com `-o nome_diferente`, listar todos os
  `.mp4` da árvore e assertar qual foi escolhido. **Quebra se divergir:** a regra "sem casamento
  exato é erro" (delta #4) perde justificativa.
- **L01-U02** — Custo real de `_detect_gpu_renderer` no hardware alvo. **Fecha com:** cronometrar
  100 chamadas de `_resolve_renderer()` com `MANIM_RENDERER=auto`. **Quebra se divergir:** o delta
  #7 (cache) vira otimização prematura.
- **L01-U03** — Qual recurso satura primeiro sob N renders paralelos: CPU, I/O, RAM (base64) ou
  rate-limit da OpenAI. **Fecha com:** matriz N ∈ {1,2,4,8} com render **sem LLM** (código fixo),
  medindo wall time, `%CPU` e RSS. **Quebra se divergir:** o número "6–8" de
  `../API_CONSUMER.md:27` precisa ser substituído no doc do projeto novo (R8).
- **L01-U04** — Render transparente sob OpenGL produz alpha correto, ou só Cairo? **Fecha com:**
  renderizar a mesma cena com `-t` em ambos os renderers e comparar o canal alpha do frame 0.
  **Quebra se divergir:** o caminho OpenGL sai do escopo do caso de uso alvo.
- **L01-U05** — Dimensões ímpares quebram o encode (C22)? **Fecha com:** render com `-r 1921,1080`
  e checar `returncode`. **Quebra se divergir:** precisa de guarda de paridade na entrada.
- **L01-U06** — O monkey-patch de `BackgroundRectangle` ainda é necessário em 0.20.1? **Fecha
  com:** cena com `add_background_rectangle()` + `TransformMatchingTex`, **sem** o patch; esperar
  `AssertionError`. **Quebra se divergir:** 6 linhas a menos no executor novo, e Q1.1 vira nota
  histórica.
- **L01-U07** — `--write_to_movie` tem algum efeito colateral no Cairo (nome de arquivo, seções,
  cache)? **Fecha com:** render Cairo com e sem o flag, comparando a árvore de saída byte a byte.
  **Quebra se divergir:** o flag deixa de ser "safe default" e passa a ser condicional ao renderer.
- **L01-U08** — Quantas threads de render o `asyncio.to_thread` default permite de fato (C19)?
  **Fecha com:** `ThreadPoolExecutor` default do runtime alvo + contador de renders concorrentes.
  **Quebra se divergir:** o limite de fila do editor novo precisa ser explícito, não herdado.
- **L01-U09** — `OPENAI_API_KEY` chega ao subprocess de render? Depende de como o processo pai foi
  iniciado (`os.environ.copy()` em `:63` **vs** `.env` lido por pydantic, que não injeta no
  ambiente). **Fecha com:** cena que escreve `os.environ` em arquivo, rodada pelo executor.
  **Quebra se divergir:** o delta #9 (allowlist de env) muda de severidade.
- **L01-U10** — Existe consumidor vivo de `ondokai.com` hoje? **Fecha com:** log de acesso do
  túnel por 7 dias. **Cuidado com a armadilha do denominador:** "0 requests" é verdade tanto se
  ninguém usa quanto se o túnel está fora do ar.

---

## Não verificado

Itens **sem** citação `arquivo:linha` que sustente a afirmação. Nenhum deles deve ser usado como
premissa sem antes virar item de ledger.

1. **Layout do TeX Live.** Que `~/texlive/<ano>/bin/<arch>` seja especificamente o layout do
   instalador oficial (e não de `apt`/`brew`) é interpretação do glob em `manim_executor.py:21` —
   não há nada no repositório que declare a origem da instalação. (C21)
2. **Custo de 4,5 s da detecção de GPU.** É a soma dos **timeouts declarados**
   (`manim_executor.py:80`, `:88`, `:107`), ou seja um **teto**, não uma medição. Latência real de
   `nvidia-smi -L` / `glxinfo -B` / `manim … --help` não foi cronometrada. (C18)
3. **Teto do `asyncio.to_thread`.** O default do `ThreadPoolExecutor` do CPython não está escrito
   em nenhum arquivo do corpus; `main.py:155` só mostra a chamada. (C19)
4. **Saturação por rate-limit da OpenAI.** `README.md:1208` lista `RateLimitError` como problema
   conhecido, mas nenhum limite numérico, medição ou log existe no repositório. (C20)
5. **Paridade de dimensões e H.264.** `schemas.py:12-23` aceita ímpares; nada no repositório
   testa isso, e não foi executado aqui. (C22)
6. **Disparo real do fallback de `find_video`.** O caminho por onde `candidates[0]` (`:59`)
   devolveria um fragmento é dedução da estrutura documentada em `README.md:949-958`; nenhum render
   foi executado para reproduzi-lo. (C17)
7. **Alpha sob OpenGL.** Que o renderer OpenGL honre `-t` corretamente não foi verificado — só a
   troca de extensão no config (`venv/.../_config/utils.py:1438-1447`) foi.
8. **Necessidade atual do monkey-patch em 0.20.1.** Está provado que `BackgroundRectangle` não tem
   `tex_string` e que `TransformMatchingTex` assere sua presença; **não** foi executada a cena
   completa que produz o `AssertionError`. A cadeia é sólida, o disparo é inferido. (L01-U06)
9. **Vazamento de `OPENAI_API_KEY` para o subprocess.** `manim_executor.py:63` copia `os.environ`
   inteiro — mas se a chave só existe no `.env` (lido por pydantic, `config.py:23-27`), ela pode
   não estar em `os.environ`. Depende de como o serviço é iniciado; não observado. (L01-U09)
10. **Estado operacional do serviço.** Não há `.env` no diretório (`ls` mostra só `.env.example`) e
    `manim` não está no `PATH` do sistema — só dentro do `venv`. Se o serviço roda hoje, e onde,
    não foi verificado.
11. **Bypass trivial da blocklist AST.** Que a lista de nomes proibidos
    (`openai_service.py:21-35`) seja contornável por cadeia de atributos em módulos permitidos é
    raciocínio, não experimento. O que **está** verificado é a ausência de sandbox (R4).
