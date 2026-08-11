# Inventario de reuso do 3blue1brown -- por call-site

> **Projeto de origem:** `/home/ondokai/Projects/3blue1brown` (SOMENTE LEITURA)
> **Data:** 2026-08-11
> **Referencia:** ADR-0004 (decisao vinculante)

Este documento e o inventario de tudo que o projeto de referencia
`3blue1brown` contem e que e relevante para o Editor de Video IA.
Cada item recebe uma classificacao e, quando for "ABSORVER", declara
quantos call-sites justificam a copia e o que precisa ser adaptado.
Toda afirmacao sobre o projeto de origem carrega `arquivo:linha`.

---

## 1. Classificacao

| Classificacao | Significado |
|---|---|
| **ABSORVER** | Copiar o codigo (ou conhecimento) para dentro deste repositorio, adaptando-o. NUNCA importar do projeto de origem. |
| **INTEGRAR** | Usar como dependencia externa (pip, npm, etc.). Nao copiar codigo. |
| **IGNORAR** | Nao usar. O item nao se aplica, e inferior ao que sera construido, ou e prejudicial. |

---

## 2. Manim bridge -- artefatos do `manim-api/`

### 2.1 ABSORVER: `sanitize_code` -- AST-based sanitization of LLM-generated Manim code

- **Origem:** `manim-api/services/openai_service.py:188-236`
- **Call-sites:** 3
  1. Pipeline de geracao de codigo (LLM authoring) -- pos-extracao, pre-validacao
  2. Validacao offline de codigo gerado (CI/linter proprio)
  3. Qualquer ferramenta que reescreva codigo Manim gerado por LLM
- **Justificativa:** O LLM gera nomes de cores que nao existem no namespace `from manim import *` (CYAN so existe em XKCD/SVGNAMES/DVIPSNAMES -- `manim-api/services/openai_service.py:46-53`), usa `fill_opacity` em `add_background_rectangle` quando o kwargs correto e `opacity` (`manim-api/services/openai_service.py:208-212`), e usa `tip_style` que e nome de ManimGL, nao de Manim CE (`manim-api/services/openai_service.py:213-218`). Esses tres erros sao sistematicos e nao-inferiveis -- nenhum agente os deduziria sem ve-los acontecer.
- **O que adaptar:**
  - Extrair para funcao standalone, sem dependencia de `openai` ou `AsyncOpenAI`
  - Remover o `request_id` do log (usar o sistema de log do nosso pipeline)
  - Manter o `modified` flag que devolve o original se nada mudou (`manim-api/services/openai_service.py:230-231`)
  - Adicionar `TEAL` ao dicionario de fallbacks -- o codigo atual ja tem (`manim-api/services/openai_service.py:47`)
  - ~50 linhas uteis das 49 originais

### 2.2 ABSORVER: `validate_code` -- AST-based validation of Manim code

- **Origem:** `manim-api/services/openai_service.py:100-139`
- **Call-sites:** 2
  1. Pipeline de geracao de codigo -- apos sanitizacao, antes do render
  2. CI: validacao de codigo Manim em fixtures de teste
- **Justificativa:** As 6 regras de validacao (AST parse, `from manim import`, Scene class, `construct`, imports perigosos, funcoes perigosas) sao o conjunto minimo que impede codigo malicioso ou invalido de chegar ao subprocess. A ordem importa: AST parse primeiro porque SyntaxError torna as outras regras inuteis (`manim-api/services/openai_service.py:102-105`). As listas `DANGEROUS_IMPORTS` (`manim-api/services/openai_service.py:21-33`) e `DANGEROUS_FUNCTIONS` (`manim-api/services/openai_service.py:35`) sao curadas para o ambiente Manim e bloqueiam o que um LLM malicioso ou desatento poderia gerar.
- **O que adaptar:**
  - Extrair para funcao standalone, sem dependencia de `openai`
  - Manter as mesmas listas de bloqueio (11 imports + 5 funcoes)
  - Manter a ordem das 6 regras
  - ~40 linhas uteis das 40 originais

### 2.3 ABSORVER: `extract_code` -- code extraction from markdown fences

- **Origem:** `manim-api/services/openai_service.py:78-88`
- **Call-sites:** 1
  1. Pipeline de geracao de codigo -- extrair o codigo da resposta do LLM
- **Justificativa:** O regex `r"```python\s*(.*?)\s*```"` com fallback para "se tem `from manim import` trata como codigo" e o padrao correto e nao-inferivel -- a alternativa ingenua de pegar o primeiro fence triplo falha quando o LLM explica o codigo antes de mostra-lo.
- **O que adaptar:**
  - Extrair para funcao standalone
  - ~10 linhas uteis das 11 originais

### 2.4 ABSORVER: `get_scene_name` -- scene name extraction

- **Origem:** `manim-api/services/openai_service.py:91-97`
- **Call-sites:** 2
  1. Pipeline de geracao de codigo -- descobrir o nome da classe para passar ao CLI
  2. Runner de render -- descobrir qual arquivo de saida esperar
- **Justificativa:** O regex `r"class\s+(\w+)\s*\(\s*(?:Scene|ThreeDScene|MovingCameraScene)\s*\)"` cobre as tres classes base validas. Extrair o nome da cena e essencial para montar o comando `manim render ... <SceneName>` e para descobrir o arquivo de saida.
- **O que adaptar:**
  - Extrair para funcao standalone
  - ~7 linhas uteis das 7 originais

### 2.5 ABSORVER: `BackgroundRectangle` monkey-patch

- **Origem:** `manim-api/services/manim_executor.py:30-35`
- **Call-sites:** 1 (mas aplicado a TODA cena renderizada)
  1. O runner de render prefixa este patch a todo script de cena antes de executa-lo
- **Justificativa:** O Manim CE tem um bug em que `BackgroundRectangle` espera um atributo `tex_string` que pode nao existir (`manim-api/services/manim_executor.py:30-35`). A cadeia de codigo que dispara o `AssertionError` esta em `manim-api/venv/.../manim/animation/transform_matching_parts.py:292` e `manim-api/venv/.../geometry/shape_matchers.py:83` nao define o atributo. Sem este patch, qualquer cena que use `BackgroundRectangle` (comum para legibilidade de texto sobre graficos) crasha. O patch e aplicado em `manim-api/services/manim_executor.py:220`.
- **O que adaptar:**
  - Copiar o bloco de 6 linhas como string constante no runner de render
  - Verificar se ainda e necessario no Manim CE 0.20.1 (a cadeia esta provada; o disparo nao -- ver `## Nao verificado` no manim-bridge SKILL.md)

### 2.6 ABSORVER: Color fallbacks (CYAN -> TEAL)

- **Origem:** `manim-api/services/openai_service.py:46-53`
- **Call-sites:** 1 (via `sanitize_code`)
  1. A funcao `sanitize_code` aplica o dicionario `COLOR_FALLBACKS` a todos os `ast.Name` nodes
- **Justificativa:** `CYAN` existe no Manim, mas nao no namespace de `from manim import *` -- so em XKCD/SVGNAMES/DVIPSNAMES. O `NameError` estoura dentro do subprocess de render, e o LLM gera `CYAN` consistentemente. O dicionario de 7 entradas (`manim-api/services/openai_service.py:46-53`) cobre `CYAN` e variantes `_A`..`_E`.
- **O que adaptar:**
  - Copiar o dicionario como constante
  - Ja integrado na funcao `sanitize_code` (item 2.1)

### 2.7 ABSORVER: `add_background_rectangle` kwarg fix

- **Origem:** `manim-api/services/openai_service.py:208-212`
- **Call-sites:** 1 (via `sanitize_code`)
  1. A funcao `sanitize_code` reescreve `fill_opacity` -> `opacity` em chamadas a `add_background_rectangle`
- **Justificativa:** `fill_opacity` e o kwargs correto em quase todo o resto do Manim, mas em `add_background_rectangle` colide com `**kwargs` e o erro e `TypeError: got multiple values`, nao "unexpected keyword" -- o que torna o debugging nao-obvio. O LLM gera `fill_opacity` consistentemente.
- **O que adaptar:**
  - Ja integrado na funcao `sanitize_code` (item 2.1)

### 2.8 ABSORVER: `add_tip` style removal

- **Origem:** `manim-api/services/openai_service.py:213-218`
- **Call-sites:** 1 (via `sanitize_code`)
  1. A funcao `sanitize_code` remove `tip_style` kwargs de chamadas a `add_tip`
- **Justificativa:** `tip_style` e nome de ManimGL; o Manim CE expoe `tip_shape`. O LLM, treinado em corpora que misturam GL e CE, gera `tip_style` com frequencia.
- **O que adaptar:**
  - Ja integrado na funcao `sanitize_code` (item 2.1)

### 2.9 ABSORVER: `--write_to_movie` sempre no comando

- **Origem:** `manim-api/services/manim_executor.py:233`
- **Call-sites:** 1 (o runner de render)
  1. Todo comando `manim render` inclui `--write_to_movie`
- **Justificativa:** A exigencia e do renderer OpenGL -- sem ele, o OpenGL executa as animacoes e nao escreve arquivo (`manim-api/services/manim_executor.py:233`). O erro que a ausencia produz ("Video file not found after render" em `manim-api/services/manim_executor.py:183`) aponta para a camada errada (descoberta de arquivo, nao "nada foi escrito"). O comportamento do Cairo sem o flag nao foi medido -- `## Nao verificado` no manim-bridge SKILL.md.
- **O que adaptar:**
  - Incluir `--write_to_movie` como flag fixa no base_cmd do runner
  - Nao requer codigo proprio -- e uma decisao de linha de comando

### 2.10 ABSORVER: Descobrir o arquivo em vez de montar o caminho (versao corrigida)

- **Origem:** Conceito de `manim-api/services/manim_executor.py:48-59`, mas com correcoes
- **Call-sites:** 1 (o runner de render)
  1. Apos o render, descobrir qual arquivo o Manim produziu
- **Justificativa:** A subpasta de qualidade (`media/videos/<script>/<WxH><fps>/`) depende de flags que o chamador nem passou. Montar o caminho e fragil; descobrir e robusto. Mas a implementacao original (`manim-api/services/manim_executor.py:48-59`) tem dois bugs: (a) so varre `*.mp4`, enquanto render com `-t` escreve `.mov`/`.webm`; (b) o fallback `candidates[0]` (`manim-api/services/manim_executor.py:59`) devolve o mp4 mais recente, que pode ser de outra cena ou um fragmento de `partial_movie_files/`.
- **O que adaptar:**
  - Reescrever `find_video` com: extensao derivada do formato pedido, casamento exato do nome da cena, `partial_movie_files/` excluido explicitamente, e sem fallback -- nao casou, e erro
  - ~20 linhas uteis apos correcao

### 2.11 IGNORAR: `find_video` como utilitario pronto

- **Origem:** `manim-api/services/manim_executor.py:48-59`
- **Por que ignorar:** Varre so `*.mp4` nos dois ramos; render com `-t` escreve `.mov`/`.webm` => devolve `None` => o pipeline reporta "Video file not found after render" com `returncode == 0` -- falha em silencio no cenario exato que este programa precisa. O fallback `candidates[0]` (`manim-api/services/manim_executor.py:59`) devolve o mp4 mais recente, que pode ser de outra cena ou fragmento de `partial_movie_files/`.

### 2.12 IGNORAR: `RenderResult.video_path`

- **Origem:** `manim-api/services/manim_executor.py:38-45`
- **Por que ignorar:** Aponta para dentro de um `tempfile.TemporaryDirectory` (`manim-api/services/manim_executor.py:216`) destruido no `return` (`manim-api/services/manim_executor.py:267`); o campo tem o nome certo, o tipo certo e devolve caminho morto.

### 2.13 IGNORAR: A blocklist AST como se fosse defesa

- **Origem:** `manim-api/services/openai_service.py:21-35`
- **Por que ignorar:** Bloqueia nomes, nao capacidades: o codigo roda por `subprocess.run` na conta do usuario, sem container, com `os.environ.copy()` inteiro (`manim-api/services/manim_executor.py:63,144-151`) -- enquanto `manim-api/prompts.py:4` afirma ao modelo que o ambiente e isolado. A blocklist e util como validacao (item 2.2), mas nao e sandbox.

### 2.14 IGNORAR: `prompts.py` (373 linhas)

- **Origem:** `manim-api/prompts.py:1-374`
- **Por que ignorar:** Documenta Manim CE **0.19.0** (`manim-api/prompts.py:3`) enquanto o runtime deste programa e **0.20.1**. Injeta as "mudancas criticas" da versao errada em todo system prompt. O conhecimento de prompt engineering e util como referencia, mas o texto exato nao pode ser copiado -- as breaking changes da 0.19.0 listadas em `manim-api/prompts.py:33` ja sao o comportamento default na 0.20.1.

### 2.15 IGNORAR: Acoplamento a OpenAI/FastAPI

- **Origem:** `manim-api/services/openai_service.py:18` (cliente OpenAI em escopo de modulo)
- **Por que ignorar:** O executor e inimportavel sem `OPENAI_API_KEY` (`manim-api/services/openai_service.py:18`). Qualquer `import` do modulo constroi o cliente OpenAI -- efeito colateral em escopo de modulo que torna o codigo inimportavel em ambiente de teste sem chave. CORS `*`, OPTIONS respondendo 200 em rota inexistente, base64 obrigatorio e DTOs de wire (`manim-api/main.py:30-58`, `manim-api/schemas.py:5-45`) sao preocupacoes de servico web que nao se aplicam a este programa.

### 2.16 IGNORAR: `manim-api/` como servico FastAPI

- **Origem:** `manim-api/main.py:1-261`
- **Por que ignorar:** Este programa nao e um servico web. O Manim entra como processo por cena, terminado antes de o Remotion abrir. A forma de servico (FastAPI + Cloudflare Tunnel) e exatamente o que a pesquisa recomenda **nao** copiar: o teto efetivo por request para cliente remoto (~100 s do tunel) e menor que o `render_timeout` do servidor (120 s), abrindo uma janela em que o servidor renderiza para ninguem.

### 2.17 IGNORAR: Deteccao de GPU e fallback OpenGL

- **Origem:** `manim-api/services/manim_executor.py:70-130`
- **Por que ignorar:** A postura deste programa e `cairo` fixo. A deteccao automatica (`manim-api/services/manim_executor.py:120-130`) so faz sentido sob `MANIM_RENDERER=auto`. Alem disso, a funcao `_detect_gpu_renderer()` roda a cada render (`manim-api/services/manim_executor.py:238`), sem `lru_cache`, custando ate 3 spawns de subprocess por render.

### 2.18 IGNORAR: `--fps 60` hardcoded

- **Origem:** `manim-api/services/manim_executor.py:228-229`
- **Por que ignorar:** E uma decisao de produto especifica daquele projeto, nao um conhecimento tecnico. Este programa deve permitir fps configuravel por cena.

### 2.19 IGNORAR: Insercao posicional do flag de renderer

- **Origem:** `manim-api/services/manim_executor.py:246-248`
- **Por que ignorar:** `cmd.insert(2, "--renderer=opengl")` -- a insercao posicional cai no meio de um par flag/valor se alguem reordenar a lista. Nao ha teste que cubra isso. Com `cairo` fixo, a flag nem existe.

---

## 3. Infra de skills -- artefatos de `.agents/`

### 3.1 ABSORVER: `skill_lint.py` (com correcoes)

- **Origem:** `.agents/scripts/skill_lint.py:1-137`
- **Call-sites:** 3
  1. CI: `python3 .agents/scripts/skill_lint.py` -> exit 0
  2. PreToolUse hook: gate de escrita de SKILL.md
  3. meta-skill-evolution: rodado antes de promover atualizacao de skill
- **Justificativa:** O linter original cobre frontmatter validity, body length, e hygiene (sem datas/changelogs). Mas tem 4 defeitos conhecidos que precisam ser corrigidos na absorcao:
  - **Defeito 1:** `description` medido por regex `description:\s*(.+)` -- `.` nao casa `\n`, entao mede so a primeira linha fisica (`.agents/scripts/skill_lint.py:58`). Descricao real de 1.215 chars (614 na primeira linha) => linter exit 0, spec violada.
  - **Defeito 2:** `type_match = re.search(...)` e so valida `if type_match:` -- ausencia da chave `type:` e silencio, nao erro (`.agents/scripts/skill_lint.py:72-77`).
  - **Defeito 3:** Nao verifica presenca de citacao de proveniencia (`arquivo:linha` ou `https://`) no corpo.
  - **Defeito 4:** O glob de um nivel `*/SKILL.md` (`.agents/scripts/skill_lint.py:115`) pula skills em subdiretorios aninhados em silencio.
- **O que adaptar:**
  - Medir `description` com parser YAML, nao com regex
  - Exigir `type:` como obrigatorio (nao opcional)
  - Adicionar regra de proveniencia: `grep -cE` por `arquivo:linha` e `https?://` com piso por secao
  - Adicionar verificacao de que `find` e `ls -d` batem (skill aninhada = erro)
  - Manter: MAX_BODY_LINES=500, WARN_BODY_LINES=400, MAX_NAME_LEN=64, MAX_DESC_LEN=1024
  - ~100 linhas uteis apos correcoes (das 137 originais)

### 3.2 ABSORVER: `run_skill_evals.py` -- estrutura do eval runner

- **Origem:** `.agents/scripts/run_skill_evals.py:1-396`
- **Call-sites:** 2
  1. CI: `python3 .agents/scripts/run_skill_evals.py [skill-name]`
  2. PreToolUse hook: skill_write_gate consulta `.eval_records/<skill>.json`
- **Justificativa:** O padrao de eval runner com registros em `.eval_records/` e essencial para o gate de escrita de skill. A estrutura: (a) dicionario `EVAL_FUNCTIONS` mapeando skill->funcao, (b) cada funcao devolve `list[dict]` com `test/passed/detail`, (c) `save_record()` grava JSON em `.eval_records/`, (d) exit 0 se todos passaram, 1 se algum falhou. O `ROUTING_MAP` do eval de roteamento (`.agents/scripts/run_skill_evals.py:286-303`) nao e o roteador real e nao deve ser copiado como oraculo -- o oraculo tem de ler a tabela do SKILL.md, nao duplica-la.
- **O que adaptar:**
  - Reescrever completamente para nossas 20 skills
  - Manter o padrao de `test/passed/detail` e `save_record()`
  - Remover o `ROUTING_MAP` duplicado -- o eval de roteamento deve ler a tabela do project-router
  - Remover imports de `manim-api` (nao existe neste repositorio)
  - ~50 linhas de estrutura aproveitaveis das 396 originais

### 3.3 ABSORVER: `check_staleness.py` -- verificador de proveniencia stale

- **Origem:** `.agents/scripts/check_staleness.py:1-77`
- **Call-sites:** 2
  1. CI periodico: `python3 .agents/scripts/check_staleness.py`
  2. meta-skill-consolidate: passo 3 (revalidar proveniencia)
- **Justificativa:** O padrao de verificar cada citacao `arquivo:linha` contra o estado atual do arquivo e essencial para evitar que skills acumulem conhecimento obsoleto. O regex `PROVENANCE_PATTERN` (`.agents/scripts/check_staleness.py:15`) captura `file:line` e `file:line@hash`. A verificacao de existencia do arquivo (`.agents/scripts/check_staleness.py:27-34`) e de linha alem do fim (`.agents/scripts/check_staleness.py:38-46`) sao as duas regras corretas.
- **O que adaptar:**
  - Ajustar `SKILL_DIR` para nosso caminho
  - Adicionar regra: se o hash mudou, marcar `[STALE]` em vez de so reportar linha alem do fim
  - ~50 linhas uteis das 77 originais

### 3.4 ABSORVER: `skill_write_gate.py` -- PreToolUse hook para escrita de skill

- **Origem:** `.agents/scripts/skill_write_gate.py:1-55`
- **Call-sites:** 1
  1. Hook `PreToolUse` em `.claude/settings.json` -- dispara em todo `Write`/`Edit` em `**/skills/**/SKILL.md`
- **Justificativa:** O gate bloqueia escrita em SKILL.md a menos que exista um registro verde de eval (`.eval_records/<skill>.json` com `last_eval_passed: true`). A excecao para criacao inicial (arquivo nao existe) e necessaria para o bootstrap (`.agents/scripts/skill_write_gate.py:44-46`). O exit code 2 bloqueia a acao; qualquer outro codigo e erro nao-bloqueante.
- **O que adaptar:**
  - Ajustar `SKILL_DIR` e `EVAL_RECORDS_DIR` para nosso caminho
  - A logica de "arquivo nao existe => permite" (`.agents/scripts/skill_write_gate.py:44`) precisa ser revisada -- o `isinstance(skill_path, Path)` e sempre True, entao a condicao e `not skill_path.exists()` que e o comportamento correto
  - ~40 linhas uteis das 55 originais

### 3.5 ABSORVER: `stop_validation_gate.py` -- Stop hook

- **Origem:** `.agents/scripts/stop_validation_gate.py:1-51`
- **Call-sites:** 1
  1. Hook `Stop` em `.claude/settings.json` -- impede o agente de terminar enquanto fases de bootstrap estiverem incompletas
- **Justificativa:** O padrao de ler `.bootstrap-state.json` e bloquear `Stop` com exit 2 se houver fases incompletas (`.agents/scripts/stop_validation_gate.py:25-26`) e util para garantir que o bootstrap do projeto seja concluido antes que o agente "termine". O guard `stop_hook_active` (`.agents/scripts/stop_validation_gate.py:32`) previne loop infinito.
- **O que adaptar:**
  - Adaptar `STATE_FILE` para nosso caminho
  - Adaptar as fases para nosso bootstrap (diferente do projeto de origem)
  - ~40 linhas uteis das 51 originais

### 3.6 ABSORVER: `bash_guardrail.py` (versao corrigida)

- **Origem:** `.agents/scripts/bash_guardrail.py:1-37`
- **Call-sites:** 1
  1. Hook `PreToolUse` em `.claude/settings.json` -- dispara em todo comando `Bash`
- **Justificativa:** O guardrail original bloqueia `rm -rf` em caminhos criticos e operacoes git destrutivas. MAS tem uma falha critica: nao bloqueia `rm -rf /`, `rm -rf ~` nem `sudo rm -rf /` -- o caso literalmente nomeado na descricao do hook e o que passa (`.agents/scripts/bash_guardrail.py:11`). O regex `r"\brm\s+-rf\s+(~|/|/home|...)"` exige um espaco entre `-rf` e o caminho, e `sudo rm -rf /` introduz `sudo` antes.
- **O que adaptar:**
  - Corrigir o regex para capturar `sudo rm -rf` e `rm -rf` sem o padrao de espaco
  - Adicionar `chmod 777 /`, `mkfs`, `dd` para dispositivos
  - Manter exit 2 para bloquear, exit 0 para permitir
  - ~30 linhas uteis apos correcoes

### 3.7 ABSORVER: Padrao de hooks (`settings.json`)

- **Origem:** `.claude/settings.json:1-33`
- **Call-sites:** 1 (o arquivo `settings.json` inteiro)
  1. O harness do Claude Code carrega `.claude/settings.json` e executa os hooks declarados
- **Justificativa:** O padrao de tres hooks `PreToolUse` + um hook `Stop` (`.claude/settings.json:2-32`) e a arquitetura correta para este programa. Os hooks sao:
  - `PreToolUse` para `Write||Edit` em `**/skills/**/SKILL.md` -> `skill_write_gate.py` (`.claude/settings.json:4-9`)
  - `PreToolUse` para `Read` em `.env||**/secrets/**` -> `exit 2` (`.claude/settings.json:11-16`)
  - `PreToolUse` para `Bash` -> `bash_guardrail.py` (`.claude/settings.json:18-22`)
  - `Stop` -> `stop_validation_gate.py` (`.claude/settings.json:25-30`)
- **O que adaptar:**
  - Adicionar hook de barreira de onda (inexistente no projeto de origem)
  - Adicionar hook de nudge de contexto (skill criticas)
  - Ajustar paths para nosso projeto
  - Manter `onError: "block"` em todos os hooks

### 3.8 ABSORVER: `catalog.md` como artefato gerado

- **Origem:** `.agents/skills/catalog.md:1-54`
- **Call-sites:** 2
  1. project-router: carregado para selecionar skills
  2. meta-skill-consolidate: regenerado apos consolidacao
- **Justificativa:** O catalogo e um indice gerado (nao redigitado) das skills. A estrutura: tabela de router, tabela de knowledge skills, tabela de meta skills, quick-select por arquivo, quick-select por tipo de tarefa (`.agents/skills/catalog.md:6-53`). O fato de ser gerado e criticamente importante: redigitar o catalogo a mao produz divergencia entre o catalogo e os SKILL.md.
- **O que adaptar:**
  - Gerar a partir dos nossos 20 SKILL.md
  - Adicionar secao de quick-select por tier (metodo/dominio/meta)
  - O script gerador e novo (nao existe no projeto de origem)

### 3.9 ABSORVER: `skill-map.md` como documentacao de design

- **Origem:** `.agents/skills/skill-map.md:1-139`
- **Call-sites:** 1
  1. Consulta humana e de agentes sobre a arquitetura do catalogo de skills
- **Justificativa:** O skill-map documenta a granularidade, a justificativa de nao dividir/nao juntar, e o grafo de dependencias entre skills. A secao de "Why NOT split further" (`.agents/skills/skill-map.md:92-100`) e "Why NOT merge further" (`.agents/skills/skill-map.md:102-108`) e particularmente util para evitar que o catalogo degrade com o tempo.
- **O que adaptar:**
  - Reescrever para nossas 20 skills
  - Manter a estrutura: catalog, dependency graph, granularity justification, verification signals
  - ~80 linhas de estrutura aproveitaveis

### 3.10 IGNORAR: `project-router/SKILL.md` do 3b1b

- **Origem:** `.agents/skills/project-router/SKILL.md:1-45`
- **Por que ignorar:** O passo 1 manda "FACA MUITAS PERGUNTAS" incondicionalmente (`.agents/skills/project-router/SKILL.md:12`). Com card a montante isso e errado por norma: pergunta-se o delta, nao se repete o questionario. O protocolo de 8 passos (`.agents/skills/project-router/SKILL.md:14-28`) e generico e nao cobre Caso A vs Caso B. Nosso `project-router` ja esta escrito e e superior.

### 3.11 IGNORAR: `manim-rendering/SKILL.md` do 3b1b

- **Origem:** `.agents/skills/manim-rendering/SKILL.md:1-134`
- **Por que ignorar:** A unica citacao com hash do corpus (`.agents/skills/manim-rendering/SKILL.md:58@922e47d`) aponta para a linha errada e ja estava errada no commit que ela pina. Contem 5 pinos de linha mortos. O `verification_signal` (`.agents/skills/manim-rendering/SKILL.md:6`) contem `from manim-api.services...` -- hifen nao e identificador Python, logo o gate so pode falhar. A linha 114 afirma "the GIL is held during the entire render" quando o render e processo filho. Nosso `manim-bridge` SKILL.md ja contem o conhecimento relevante com correcoes.

### 3.12 IGNORAR: `manim-code-gen/SKILL.md` do 3b1b

- **Origem:** `.agents/skills/manim-code-gen/SKILL.md:1-104`
- **Por que ignorar:** Documenta Manim CE 0.19.0 e o pipeline de dois estagios com OpenAI. Nosso pipeline de LLM authoring e diferente (usamos o modelo que o usuario escolher, nao apenas OpenAI). O conhecimento de validacao e sanitizacao ja foi extraido para os itens 2.1-2.8 acima.

### 3.13 IGNORAR: `fastapi-app/SKILL.md` do 3b1b

- **Origem:** `.agents/skills/fastapi-app/SKILL.md:1-127`
- **Por que ignorar:** FastAPI, Cloudflare Tunnel, CORS middleware -- tudo especifico de servico web. Nao se aplica a este programa.

### 3.14 IGNORAR: `validation-report.md` do 3b1b

- **Origem:** `.agents/skills/validation-report.md:1-219`
- **Por que ignorar:** E um relatorio estatico do bootstrap daquele projeto, commit `9247be1`. O conhecimento util (gaps, limitacoes, recomendacoes) ja foi absorvido pelo nosso `project-router` e pela pesquisa `L02-reuso-3b1b-infra-skills.md`.

### 3.15 IGNORAR: `project-analysis.md` do 3b1b

- **Origem:** `.agents/skills/project-analysis.md:1-147`
- **Por que ignorar:** E a analise estatica do projeto 3blue1brown, nao deste. O equivalente para este projeto e `docs/00-panorama-verificado.md`.

---

## 4. Padroes de codigo

### 4.1 ABSORVER: Settings singleton com `@lru_cache`

- **Origem:** `manim-api/config.py:28-32`
- **Call-sites:** 3+
  1. Qualquer modulo que precise de configuracao (runner, LLM authoring, pipeline)
  2. Testes que precisam de settings isolados
  3. CLI tools
- **Justificativa:** O padrao Pydantic `BaseSettings` + `@lru_cache` no `get_settings()` garante que as configuracoes sao lidas uma vez do `.env` e cacheadas. `extra="ignore"` em `model_config` (`manim-api/config.py:23-27`) significa que vars desconhecidas sao silenciosamente ignoradas. Este padrao e limpo, testavel e bem estabelecido.
- **O que adaptar:**
  - Usar nossos proprios campos de configuracao (diferentes do projeto de origem)
  - Manter o `@lru_cache` e `SettingsConfigDict(env_file=".env")`
  - ~10 linhas de estrutura

### 4.2 ABSORVER: Structured logging com `[request_id]`

- **Origem:** `manim-api/main.py:42,61-68`
- **Call-sites:** 5+
  1. Pipeline de LLM authoring
  2. Runner de render Manim
  3. Pipeline de composicao Remotion
  4. Pipeline de render final
  5. Orquestrador e2e
- **Justificativa:** O padrao `[request_id]` como prefixo em todo log (8-char hex de `uuid.uuid4().hex[:8]` -- `manim-api/main.py:42`) permite rastrear uma execucao completa atraves de todos os modulos. O ID flui como parametro `request_id` com fallback `"no-request-id"` (`.agents/skills/fastapi-app/SKILL.md:64`).
- **O que adaptar:**
  - Renomear para `trace_id` ou `run_id` (nao temos "request")
  - Manter o padrao de passar o id como parametro explicito, com fallback
  - ~5 linhas de conceito, zero linhas de codigo copiado

### 4.3 ABSORVER: `extract_code` -- code extraction from markdown fences

- **Origem:** `manim-api/services/openai_service.py:78-88`
- **Call-sites:** 1
  1. Pipeline de geracao de codigo -- extrair o codigo da resposta do LLM
- **Justificativa:** O regex `r"```python\s*(.*?)\s*```"` com fallback para "se tem `from manim import` trata como codigo" e o padrao correto e nao-inferivel -- a alternativa ingenua de pegar o primeiro fence triplo falha quando o LLM explica o codigo antes de mostra-lo.
- **O que adaptar:**
  - Extrair para funcao standalone
  - ~10 linhas uteis das 11 originais

### 4.4 IGNORAR: `asyncio.to_thread()` para render

- **Origem:** `manim-api/main.py:155`
- **Por que ignorar:** Este programa nao usa FastAPI nem asyncio. O render e sincrono, um processo por cena.

### 4.5 IGNORAR: `client.responses.create()` com `reasoning={"effort": "xhigh"}`

- **Origem:** `manim-api/services/openai_service.py:249,293`
- **Por que ignorar:** Especifico da API da OpenAI. Nosso LLM authoring e agnostico de provedor.

---

## 5. Padroes de projeto

### 5.1 ABSORVER: Estrutura de diretorios `.agents/skills/` + `.claude/skills` symlink

- **Origem:** `.claude/skills -> ../.agents/skills` (symlink)
- **Call-sites:** 1 (a estrutura de diretorios)
  1. O harness do Claude Code carrega skills de `.claude/skills/`
- **Justificativa:** A separacao entre `.agents/skills/` (fonte) e `.claude/skills/` (symlink para o harness) e o padrao documentado. Manter as skills em `.agents/` permite que outras ferramentas (Codex, Cursor, etc.) usem o mesmo diretorio com seus proprios symlinks.
- **O que adaptar:**
  - Criar o symlink `.claude/skills -> ../.agents/skills`
  - Verificar que o harness carrega skills desse caminho (item `## Nao verificado` no project-router)

### 5.2 ABSORVER: `AGENTS.md` como entry point + symlink `CLAUDE.md`

- **Origem:** `AGENTS.md:1-31` e `CLAUDE.md -> AGENTS.md` (symlink)
- **Call-sites:** 1 (a estrutura de arquivos)
  1. O harness carrega `CLAUDE.md` no startup; o arquivo canonico e `AGENTS.md`
- **Justificativa:** `AGENTS.md` como arquivo canonico + `CLAUDE.md` como symlink permite que o mesmo conteudo sirva para Claude Code e outras ferramentas. O conteudo em si (comandos, regras, skills) e especifico de cada projeto.
- **O que adaptar:**
  - Nosso `AGENTS.md`/`CLAUDE.md` ja existe e e diferente
  - Absorvemos apenas o padrao de symlink, nao o conteudo

### 5.3 ABSORVER: `TASK_PLAN.md` descartavel

- **Origem:** `.agents/skills/project-router/SKILL.md:16,28,34`
- **Call-sites:** 1 (todo agente executor)
  1. O project-router manda criar `TASK_PLAN.md` e deleta-lo ao concluir
- **Justificativa:** O plano descartavel registra o acordo da desambiguacao, a cadeia de skills e os criterios. E gitignorado e apagado ao concluir. A distincao entre artefatos permanentes e descartaveis (`.agents/skills/project-router/SKILL.md:34`) e essencial para nao poluir o repositorio.
- **O que adaptar:**
  - Nosso project-router ja implementa isso
  - Nada a copiar -- e uma norma, nao codigo

### 5.4 ABSORVER: Evolution pipeline (5 passos)

- **Origem:** `.agents/skills/meta-skill-evolution/SKILL.md:38-66`
- **Call-sites:** 1 (todo agente executor, ao concluir)
  1. Cada skill carregada executa `<evolution>` ao final da tarefa
- **Justificativa:** O pipeline de 5 passos (Importance, Verification, Conflict, Gating, Update -- `.agents/skills/meta-skill-evolution/SKILL.md:40-65`) e o mecanismo que mantem as skills atualizadas sem acumular lixo. A regra "se nada importante e verificado foi aprendido, nao escreva nada" (`.agents/skills/meta-skill-evolution/SKILL.md:23`) e o desfecho saudavel.
- **O que adaptar:**
  - Nosso `meta-skill-evolution` ja implementa isso
  - Nada a copiar -- e uma norma, nao codigo

### 5.5 IGNORAR: Bootstrap em 5 fases

- **Origem:** `.agents/skills/.bootstrap-state.json:1-11`
- **Por que ignorar:** O bootstrap do projeto de origem (analise -> skill-map -> skills -> router -> validacao) e especifico daquele projeto. Nosso bootstrap e diferente e ja foi executado.

---

## 6. Resumo

### Itens ABSORVER (19)

| # | Item | Call-sites | Linhas uteis |
|---|------|-----------|-------------|
| 2.1 | `sanitize_code` | 3 | ~50 |
| 2.2 | `validate_code` | 2 | ~40 |
| 2.3 | `extract_code` | 1 | ~10 |
| 2.4 | `get_scene_name` | 2 | ~7 |
| 2.5 | BackgroundRectangle monkey-patch | 1 (todas as cenas) | ~6 |
| 2.6 | Color fallbacks CYAN->TEAL | 1 (via sanitize) | ~7 |
| 2.7 | `add_background_rectangle` kwarg fix | 1 (via sanitize) | ~5 |
| 2.8 | `add_tip` style removal | 1 (via sanitize) | ~6 |
| 2.9 | `--write_to_movie` sempre | 1 | 0 (decisao) |
| 2.10 | `find_video` corrigido | 1 | ~20 |
| 3.1 | `skill_lint.py` (corrigido) | 3 | ~100 |
| 3.2 | `run_skill_evals.py` (estrutura) | 2 | ~50 |
| 3.3 | `check_staleness.py` | 2 | ~50 |
| 3.4 | `skill_write_gate.py` | 1 | ~40 |
| 3.5 | `stop_validation_gate.py` | 1 | ~40 |
| 3.6 | `bash_guardrail.py` (corrigido) | 1 | ~30 |
| 3.7 | `settings.json` hooks | 1 | ~20 |
| 3.8 | `catalog.md` gerado | 2 | ~30 |
| 3.9 | `skill-map.md` | 1 | ~80 |
| 4.1 | Settings singleton | 3+ | ~10 |
| 4.2 | Structured logging | 5+ | 0 (conceito) |
| 5.1 | Estrutura `.agents/` + symlink | 1 | 0 (estrutura) |
| 5.2 | `AGENTS.md` + symlink `CLAUDE.md` | 1 | 0 (estrutura) |
| 5.3 | `TASK_PLAN.md` descartavel | 1 | 0 (norma) |
| 5.4 | Evolution pipeline | 1 | 0 (norma) |

### Itens INTEGRAR (2)

| # | Item | Como |
|---|------|------|
| I-1 | Manim CE 0.20.1 | `pip install manim==0.20.1` |
| I-2 | PyAV (ffmpeg embutido) | Dependencia do Manim CE |

### Itens IGNORAR (15)

| # | Item | Motivo |
|---|------|--------|
| 2.11 | `find_video` original | Bug: so `*.mp4`, fallback `candidates[0]` |
| 2.12 | `RenderResult.video_path` | Caminho morto (tempdir destruido) |
| 2.13 | Blocklist AST como defesa | Nao e sandbox |
| 2.14 | `prompts.py` | Documenta 0.19.0, usamos 0.20.1 |
| 2.15 | Acoplamento OpenAI/FastAPI | Inimportavel sem API key |
| 2.16 | `manim-api/` servico | Nao somos servico web |
| 2.17 | GPU detection/fallback | Cairo fixo |
| 2.18 | `--fps 60` hardcoded | Decisao de produto, nao conhecimento |
| 2.19 | Insercao posicional de flag | Fragil, sem testes |
| 3.10 | `project-router` SKILL.md | "FACA MUITAS PERGUNTAS" incondicional |
| 3.11 | `manim-rendering` SKILL.md | Pinos errados, claims falsos |
| 3.12 | `manim-code-gen` SKILL.md | 0.19.0, pipeline OpenAI |
| 3.13 | `fastapi-app` SKILL.md | Nao aplicavel |
| 3.14 | `validation-report.md` | Relatorio estatico do bootstrap deles |
| 3.15 | `project-analysis.md` | Analise do projeto deles |
| 4.4 | `asyncio.to_thread()` | Nao usamos asyncio |
| 4.5 | `client.responses.create()` | Especifico OpenAI |
| 5.5 | Bootstrap 5 fases | Especifico do projeto deles |

---

## 7. Afirmacoes com `arquivo:linha` (25)

Todas as referencias abaixo sao relativas a `/home/ondokai/Projects/3blue1brown/`.

1. `3blue1brown/manim-api/services/openai_service.py:188-236` -- `sanitize_code` aplica AST transforms para corrigir erros sistematicos do LLM
2. `3blue1brown/manim-api/services/openai_service.py:46-53` -- `COLOR_FALLBACKS` mapeia CYAN->TEAL (cores que nao existem no namespace `from manim import *`)
3. `3blue1brown/manim-api/services/openai_service.py:208-212` -- `add_background_rectangle` reescreve `fill_opacity` -> `opacity`
4. `3blue1brown/manim-api/services/openai_service.py:213-218` -- `add_tip` remove `tip_style` kwargs (nome de ManimGL)
5. `3blue1brown/manim-api/services/openai_service.py:100-139` -- `validate_code` com 6 regras em ordem
6. `3blue1brown/manim-api/services/openai_service.py:21-33` -- `DANGEROUS_IMPORTS` (11 modulos)
7. `3blue1brown/manim-api/services/openai_service.py:35` -- `DANGEROUS_FUNCTIONS` (5 funcoes)
8. `3blue1brown/manim-api/services/openai_service.py:78-88` -- `extract_code` regex + fallback
9. `3blue1brown/manim-api/services/openai_service.py:91-97` -- `get_scene_name` regex
10. `3blue1brown/manim-api/services/manim_executor.py:30-35` -- `BACKGROUND_RECTANGLE_PATCH`
11. `3blue1brown/manim-api/services/manim_executor.py:220` -- patch aplicado em todo script de cena
12. `3blue1brown/manim-api/services/manim_executor.py:233` -- `--write_to_movie` no base_cmd
13. `3blue1brown/manim-api/services/manim_executor.py:48-59` -- `find_video` original (varre so `*.mp4`, fallback `candidates[0]`)
14. `3blue1brown/manim-api/services/manim_executor.py:216` -- `TemporaryDirectory` como contexto do render
15. `3blue1brown/manim-api/services/manim_executor.py:267` -- `return` destoi o `TemporaryDirectory`
16. `3blue1brown/manim-api/services/manim_executor.py:70-130` -- `_detect_gpu_renderer` + `_resolve_renderer`
17. `3blue1brown/manim-api/services/manim_executor.py:228-229` -- `--fps 60` hardcoded
18. `3blue1brown/.agents/scripts/skill_lint.py:58` -- `description` medido por regex (`.` nao casa `\n`)
19. `3blue1brown/.agents/scripts/skill_lint.py:72-77` -- `type_match` so valida se presente (ausencia = silencio)
20. `3blue1brown/.agents/scripts/skill_lint.py:115` -- glob `*/SKILL.md` (um nivel so)
21. `3blue1brown/.agents/scripts/run_skill_evals.py:286-303` -- `ROUTING_MAP` duplicado, nao e o roteador real
22. `3blue1brown/.agents/scripts/bash_guardrail.py:11` -- regex `rm -rf` nao captura `sudo rm -rf /`
23. `3blue1brown/.agents/scripts/skill_write_gate.py:44-46` -- permite escrita se arquivo nao existe (criacao inicial)
24. `3blue1brown/.agents/scripts/stop_validation_gate.py:25-26,32` -- bloqueia Stop com fases incompletas, guard anti-loop
25. `3blue1brown/.claude/settings.json:2-32` -- tres hooks `PreToolUse` + um `Stop`