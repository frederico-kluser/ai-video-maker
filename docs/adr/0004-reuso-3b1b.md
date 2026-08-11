# ADR-0004: Reuso do 3blue1brown -- o que absorver, integrar e ignorar

**Status:** ACEITO
**Data:** 2026-08-11
**Decisores:** programa-editor-video-ia
**Supera:** Nenhum (primeira decisao de reuso)

## Contexto

O programa Editor de Video IA usa Manim Community Edition para gerar
graficos animados. O projeto de referencia `3blue1brown`
(`/home/ondokai/Projects/3blue1brown`, somente leitura) contem um
`manim-api` que faz exatamente isso -- gera codigo Manim via LLM e
renderiza em headless. O projeto de referencia tambem contem uma
infraestrutura de skills (linter, evals, hooks, scripts) que e a
origem do nosso sistema de skills.

A pergunta que este ADR responde: **de tudo que o projeto de referencia
contem, o que copiamos para dentro (ABSORVER), o que usamos como
dependencia externa (INTEGRAR), e o que descartamos (IGNORAR)?**

O inventario completo esta em `docs/reuso-3b1b.md`. Este ADR contem
a decisao vinculante e as regras que governam o reuso.

## Decisao

### Regra 1: ABSORVER conhecimento, NAO importar codigo

Nenhum `import` do projeto de referencia e permitido. Todo codigo
absorvido e copiado para dentro deste repositorio, adaptado ao nosso
contexto, e mantido independentemente. O projeto de referencia e
**somente leitura** -- nunca escrevemos la.

### Regra 2: Cada item ABSORVER declara call-sites

Nenhum item e absorvido sem justificativa quantitativa: quantos
lugares no nosso codigo usariam aquele artefato. A contagem de
call-sites esta no inventario (`docs/reuso-3b1b.md`).

### Regra 3: Toda afirmacao sobre a origem carrega `arquivo:linha`

Citacoes sem `arquivo:linha` nao sao verificaveis. O inventario
contem 25 afirmacoes com `arquivo:linha` no repositorio
`/home/ondokai/Projects/3blue1brown`.

### O que ABSORVER (copiar para dentro, adaptando)

#### Manim bridge (do `manim-api/`)

1. **`sanitize_code`** -- AST-based sanitization (3 call-sites)
   - Corrige erros sistematicos do LLM: CYAN->TEAL, `fill_opacity`->`opacity`, `tip_style`
   - Extrair como funcao standalone, sem dependencia de OpenAI
   - Origem: `manim-api/services/openai_service.py:188-236`

2. **`validate_code`** -- AST-based validation (2 call-sites)
   - 6 regras: AST parse, `from manim import`, Scene class, `construct`, imports perigosos, funcoes perigosas
   - Extrair como funcao standalone
   - Origem: `manim-api/services/openai_service.py:100-139`

3. **`extract_code`** -- code extraction from markdown (1 call-site)
   - Regex ` ```python ... ``` ` com fallback para codigo sem fence
   - Origem: `manim-api/services/openai_service.py:78-88`

4. **`get_scene_name`** -- scene name extraction (2 call-sites)
   - Regex para `class X(Scene|ThreeDScene|MovingCameraScene)`
   - Origem: `manim-api/services/openai_service.py:91-97`

5. **BackgroundRectangle monkey-patch** (1 call-site, todas as cenas)
   - Workaround para bug do Manim CE com `tex_string`
   - Origem: `manim-api/services/manim_executor.py:30-35`

6. **`--write_to_movie` sempre** (1 call-site)
   - Flag obrigatoria para OpenGL; efeito no Cairo nao medido
   - Origem: `manim-api/services/manim_executor.py:233`

7. **`find_video` corrigido** (1 call-site)
   - Descobrir arquivo de saida em vez de montar caminho
   - Correcoes: extensao derivada do formato, sem fallback `candidates[0]`
   - Origem: `manim-api/services/manim_executor.py:48-59` (conceito, com bugs)

#### Infra de skills (de `.agents/`)

8. **`skill_lint.py`** (3 call-sites: CI, hook, evolution)
   - Linter de SKILL.md com 4 correcoes: description via YAML, type obrigatorio, proveniencia, skill aninhada
   - Origem: `.agents/scripts/skill_lint.py:1-137`

9. **`run_skill_evals.py`** -- estrutura (2 call-sites)
   - Padrao de eval runner com registros em `.eval_records/`
   - Reescrever completamente para nossas 20 skills
   - Origem: `.agents/scripts/run_skill_evals.py:1-396`

10. **`check_staleness.py`** (2 call-sites)
    - Verificador de proveniencia stale (`arquivo:linha` contra estado atual)
    - Origem: `.agents/scripts/check_staleness.py:1-77`

11. **`skill_write_gate.py`** (1 call-site: hook PreToolUse)
    - Gate que bloqueia escrita em SKILL.md sem eval verde
    - Origem: `.agents/scripts/skill_write_gate.py:1-55`

12. **`stop_validation_gate.py`** (1 call-site: hook Stop)
    - Impede o agente de terminar com fases de bootstrap incompletas
    - Origem: `.agents/scripts/stop_validation_gate.py:1-51`

13. **`bash_guardrail.py`** corrigido (1 call-site: hook PreToolUse)
    - Bloqueia comandos bash perigosos
    - Correcao: capturar `sudo rm -rf /`, `rm -rf ~`, `rm -rf /`
    - Origem: `.agents/scripts/bash_guardrail.py:1-37`

14. **Padrao de hooks** (`settings.json`) (1 call-site)
    - Tres `PreToolUse` + um `Stop`
    - Adicionar hook de barreira de onda (inexistente na origem)
    - Origem: `.claude/settings.json:2-32`

15. **`catalog.md` como artefato gerado** (2 call-sites)
    - Indice gerado a partir dos SKILL.md, nunca redigitado
    - Origem: `.agents/skills/catalog.md:1-54`

16. **`skill-map.md`** (1 call-site)
    - Documentacao de design: granularidade, grafo, justificativas
    - Origem: `.agents/skills/skill-map.md:1-139`

#### Padroes de codigo e projeto

17. **Settings singleton** (`@lru_cache` no `get_settings()`) (3+ call-sites)
    - Pydantic `BaseSettings` + cache
    - Origem: `manim-api/config.py:28-32`

18. **Structured logging** com `[trace_id]` (5+ call-sites)
    - Prefixo de 8-char hex em todo log, passado como parametro
    - Origem: `manim-api/main.py:42,61-68`

19. **Estrutura `.agents/skills/` + symlink `.claude/skills`** (1 call-site)
    - Skills em `.agents/`, symlink para o harness
    - Origem: `.claude/skills -> ../.agents/skills`

20. **Evolution pipeline** (1 call-site: todo agente, ao concluir)
    - 5 passos: Importance, Verification, Conflict, Gating, Update
    - Origem: `.agents/skills/meta-skill-evolution/SKILL.md:38-66`

### O que INTEGRAR (dependencia externa)

1. **Manim CE 0.20.1** -- `pip install manim==0.20.1`
2. **PyAV** -- dependencia do Manim CE (ffmpeg embutido)

### O que IGNORAR (nao usar)

1. `manim-api/` como servico FastAPI -- nao somos servico web
2. `prompts.py` (373 linhas) -- documenta Manim CE 0.19.0, usamos 0.20.1
3. `find_video` original -- bug: so `*.mp4`, fallback `candidates[0]`
4. `RenderResult.video_path` -- caminho morto (tempdir destruido)
5. Blocklist AST como defesa -- nao e sandbox
6. Acoplamento OpenAI/FastAPI -- inimportavel sem API key
7. GPU detection e fallback OpenGL -- postura cairo fixo
8. `--fps 60` hardcoded e insercao posicional de flag -- decisoes de produto
9. Skills do 3b1b como conhecimento pronto -- pinos errados, claims falsos, versao errada
10. `validation-report.md`, `project-analysis.md` -- especificos do projeto deles
11. `asyncio.to_thread()`, `client.responses.create()` -- nao usamos asyncio nem OpenAI

## Consequencias

### Positivas

1. **Independencia do projeto de origem.** Todo codigo absorvido e nosso,
   mantido neste repositorio. O projeto de referencia pode ser arquivado
   sem impacto.

2. **Cada absorcao tem justificativa quantitativa.** O numero de call-sites
   impede que codigo seja copiado "por via das duvidas" -- se nao ha lugares
   que usariam, nao entra.

3. **As correcoes estao documentadas.** Cada item "absorver" declara o que
   precisa ser adaptado. Quem implementar o card `F0-06` (infra de skills)
   ou `F2-03` (ponte Manim) tem a lista exata de correcoes.

4. **O que foi ignorado tem razao explicita.** Itens como `prompts.py`
   (0.19.0 vs 0.20.1) e `find_video` (bug de fallback) tem o motivo do
   descarte documentado -- um agente que os encontrasse no futuro saberia
   que a decisao ja foi tomada.

### Negativas

1. **Custo de manutencao.** Codigo absorvido precisa ser mantido. Se o
   Manim CE lancar a 0.21.0 e o monkey-patch de `BackgroundRectangle` for
   corrigido, precisamos detectar e remover o patch -- ele nao some sozinho.

2. **Risco de divergencia.** Se o projeto de referencia corrigir um bug
   que absorvemos (ex: `bash_guardrail.py`), nossa copia corrigida e a
   correcao deles podem divergir. O inventario nao estabelece sincronizacao
   continua -- cada item e copiado uma vez e mantido independentemente.

## Guarda executavel

O card `F0-06` implementa os scripts de infra de skills. O card `F2-03`
implementa a ponte Manim. Ambos tem criterios de aceitacao que verificam
a presenca e correcao dos artefatos absorvidos.

O inventario (`docs/reuso-3b1b.md`) tem duas sondas negativas declaradas
no PROGRAMA.html:

- `rg -L "call-sites:" docs/reuso-3b1b.md` -> vazio (toda linha de
  "absorver" declara quantos call-sites justificam)
- `rg -c "3blue1brown/.*:[0-9]+" docs/reuso-3b1b.md` >= 15 (toda
  afirmacao sobre o projeto de origem carrega `arquivo:linha`)

## O que o sign-off NAO autoriza

- **Importar codigo do projeto de referencia.** `import` de `manim-api`
  ou de `.agents/scripts/` do 3b1b e proibido. Copiar e adaptar.
- **Absorver sem declarar call-sites.** "Parece util" nao e justificativa.
  Se nao ha lugares concretos que usariam, nao entra.
- **Escrever no projeto de referencia.** `/home/ondokai/Projects/3blue1brown`
  e somente leitura. Qualquer alteracao la e violacao deste ADR.
- **Usar as skills do 3b1b como fonte de verdade.** As skills `manim-rendering`,
  `manim-code-gen` e `fastapi-app` do projeto de referencia tem erros
  documentados (pinos de linha mortos, claims falsos, versao errada).
  Nosso `manim-bridge` SKILL.md e a fonte de verdade para conhecimento Manim.

## O que este documento NAO cobre

- A implementacao dos artefatos absorvidos -- ver cards `F0-06` (infra de
  skills) e `F2-03` (ponte Manim)
- A decisao de usar Remotion + Manim vs so Manim -- ver ADR-0003
  (enquadramento de uso) e `docs/00-panorama-verificado.md`
- O formato exato do runner de render -- ver skill `manim-bridge`
- A infra de hooks e gates -- ver skill `parallel-worktrees`