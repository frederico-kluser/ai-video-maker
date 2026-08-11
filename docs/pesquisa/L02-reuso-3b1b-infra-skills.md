# L02 — Inventário de reuso: infraestrutura de skills, linter e hooks do 3blue1brown

> **Cluster:** L02 (reconhecimento local, sem pesquisa web).
> **Alvo:** `/home/ondokai/Projects/3blue1brown/.agents/` e `/home/ondokai/Projects/3blue1brown/.claude/`.
> **Base de citação:** todos os caminhos `.agents/...`, `.claude/...`, `AGENTS.md`, `manim-api/...`
> são **relativos a `/home/ondokai/Projects/3blue1brown/`**. Caminhos que começam com
> `docs/` são deste repositório (`/home/ondokai/Projects/ai-video-maker/`).
> **Método normativo:** `docs/PLAYBOOK-REFERENCIA.md`.
> **HEAD do alvo no momento da leitura:** `a32c2a4` (`docs(skills): atualiza manim-rendering com
> conhecimento de GPU e --write_to_movie`).

---

## 0. Método e o que foi efetivamente executado

O playbook manda calibrar a ferramenta antes de contar (`docs/PLAYBOOK-REFERENCIA.md:30-36`) e
**provar a sonda antes de acreditar no sintoma** (`docs/PLAYBOOK-REFERENCIA.md:216-217`). Este
inventário, portanto, não se limita a ler os scripts: **executa** cada verificador contra o
próprio corpus e registra a saída. Toda afirmação sobre comportamento vem de execução real,
não de leitura de código.

Comandos executados (todos read-only sobre o repositório alvo; nenhum arquivo do alvo foi
modificado):

| # | Comando | Onde | Resultado registrado em |
|---|---------|------|-------------------------|
| E1 | `python3 .agents/scripts/skill_lint.py` | raiz do alvo | §1.4 |
| E2 | `python3 .agents/scripts/check_staleness.py` | raiz do alvo | §5.3 |
| E3 | `skill_lint.py` / `check_staleness.py` / `stop_validation_gate.py` / `skill_write_gate.py` | a partir de `/tmp` (cwd errado) | §6.4 |
| E4 | `skill_write_gate.py <path>` com 6 entradas diferentes | raiz do alvo | §2.3 |
| E5 | `bash_guardrail.py <cmd>` com 18 comandos | raiz do alvo | §6.3 |
| E6 | contagem de citações por regex estrita × regex frouxa | raiz do alvo | §5.4 |
| E7 | linter contra corpus sintético (skill sem `type`, sem proveniência, skill aninhada) | scratchpad | §1.5 |
| E8 | `git show a32c2a4`, `git log`, `git ls-files` | raiz do alvo | §2.5, §6.5 |

**Escopo negativo declarado:** `run_skill_evals.py` **não foi executado**, porque ele escreve em
`.agents/skills/.eval_records/*.json` (`.agents/scripts/run_skill_evals.py:352`) e este agente é
dono exclusivo de um único arquivo, em outro repositório. Tudo o que se afirma sobre o runner
vem de leitura integral do código, e está rotulado como tal.

**Tamanho do corpus inventariado:** 6 scripts (753 linhas), 6 `SKILL.md` (583 linhas), 4
artefatos de bootstrap (`catalog.md` 53, `project-analysis.md` 146, `skill-map.md` 138,
`validation-report.md` 219), `.bootstrap-state.json` (11) e `.claude/settings.json` (33) —
1.936 linhas ao todo, medidas por `wc -l`.

---

## 1. Especificação exata do `skill_lint.py` — **isto é contrato**

Fonte integral: `.agents/scripts/skill_lint.py` (137 linhas).

### 1.1 Constantes numéricas (os limites são estes, não outros)

| Constante | Valor | Linha |
|---|---|---|
| `SKILL_DIR` | `Path(".agents/skills")` — **relativo ao cwd** | `.agents/scripts/skill_lint.py:12` |
| `MAX_BODY_LINES` | `500` | `.agents/scripts/skill_lint.py:13` |
| `WARN_BODY_LINES` | `400` | `.agents/scripts/skill_lint.py:14` |
| `MAX_NAME_LEN` | `64` | `.agents/scripts/skill_lint.py:15` |
| `MAX_DESC_LEN` | `1024` | `.agents/scripts/skill_lint.py:16` |

### 1.2 As regras, uma a uma, com severidade

Severidade é **ERRO** (entra em `errors`, exit 2) ou **AVISO** (entra em `warnings`, exit 1).

| # | Regra | Severidade | Linha | Observação de contrato |
|---|---|---|---|---|
| R1 | Conteúdo tem de **começar** com `---` | **ERRO** | `.agents/scripts/skill_lint.py:27-29` | **retorna imediatamente** (linha 29): nenhuma outra regra roda |
| R2 | `content.split("---", 2)` tem de produzir ≥3 partes | **ERRO** | `.agents/scripts/skill_lint.py:31-34` | também **retorna imediatamente** (linha 34) |
| R3 | Substring `name:` presente no frontmatter | **ERRO** | `.agents/scripts/skill_lint.py:39-40` | é `in`, não parse YAML — `app_name:` satisfaz |
| R4 | Substring `description:` presente | **ERRO** | `.agents/scripts/skill_lint.py:41-42` | idem |
| R5 | Substring `metadata:` presente | **ERRO** | `.agents/scripts/skill_lint.py:43-44` | idem |
| R6 | `len(name) <= 64` | **ERRO** | `.agents/scripts/skill_lint.py:50-51` | regex de captura: `name:\s*(\S+)` (linha 47) — pega o **primeiro** casamento |
| R7 | `name` casa `^[a-z0-9-]+$` | **ERRO** | `.agents/scripts/skill_lint.py:52-53` | minúsculas, dígitos e hífen; **sem underscore, sem ponto** |
| R8 | `name` == nome do **diretório** pai | **ERRO** | `.agents/scripts/skill_lint.py:54-55` | acopla identidade a caminho |
| R9 | `len(description) <= 1024` | **ERRO** | `.agents/scripts/skill_lint.py:61-62` | regex `description:\s*(.+)` (linha 58) captura **só a primeira linha** |
| R10 | `description` começa com um dos 12 verbos de terceira pessoa | **AVISO** | `.agents/scripts/skill_lint.py:64-69` | lista completa em §1.3 |
| R11 | `metadata.type` ∈ `{knowledge, task, router, meta}` | **ERRO** | `.agents/scripts/skill_lint.py:72-77` | **só dispara se `type:` existir**; ausência é silêncio (ver §1.5) |
| R12 | corpo `<= 500` linhas | **ERRO** | `.agents/scripts/skill_lint.py:81-82` | corpo = `parts[2].strip().split("\n")` (linha 80) |
| R13 | corpo `<= 400` linhas | **AVISO** | `.agents/scripts/skill_lint.py:83-84` | `elif` — nunca coexiste com R12 |
| R14 | nenhuma data/changelog no corpo | **ERRO** | `.agents/scripts/skill_lint.py:87-90` | padrão em §1.3; linhas iniciadas por `>` são isentas (linha 89) |
| R15 | imperativo em CAIXA-ALTA sem explicação | **AVISO** | `.agents/scripts/skill_lint.py:93-98` | padrão em §1.3 |
| R16 | corpo não vazio | **ERRO** | `.agents/scripts/skill_lint.py:101-102` | |

**Códigos de saída** (`.agents/scripts/skill_lint.py:5`, confirmados em 125-133):
`0` = sem erro e sem aviso · `1` = só avisos · `2` = houve erro.

### 1.3 As listas literais (verbos, tipos, padrões)

**Verbos aceitos no início da `description`** — exatamente 12, sensíveis a maiúscula
(`.agents/scripts/skill_lint.py:64-67`):

```
Injects · Routes · Handles · Provides · Contains · Manages
Validates · Creates · Updates · Proposes · Scans · Runs
```

**Tipos válidos de `metadata.type`** — exatamente 4 (`.agents/scripts/skill_lint.py:75`):

```
knowledge · task · router · meta
```

**Padrão de data/changelog proibido** (`.agents/scripts/skill_lint.py:87`), com
`re.IGNORECASE`:

```
\b(20\d{2}[-/]\d{2}[-/]\d{2}|changelog|last.updated|version\s+history)\b
```

> Nota de contrato: `last.updated` usa `.` **sem escape** — casa `last updated`,
> `last-updated`, `last_updated` e qualquer `lastXupdated`.

**Padrão de imperativo em caixa-alta** (`.agents/scripts/skill_lint.py:93`), **sem**
`IGNORECASE`:

```
\b(MUST|ALWAYS|NEVER|DO NOT|REQUIRED)\b
```

Isenções (`.agents/scripts/skill_lint.py:97`): a linha começa com `#`, **ou** contém `why`,
**ou** contém `because` (comparação em minúsculas).

### 1.4 O que o linter faz no corpus atual (execução E1)

```
$ cd /home/ondokai/Projects/3blue1brown && python3 .agents/scripts/skill_lint.py
All skills pass linting
exit=0
```

Seis skills, zero erro, zero aviso. Corpos medidos (limite 500 / aviso 400):

| Skill | linhas de corpo | folga até o aviso |
|---|---:|---:|
| `manim-rendering` | 126 | 274 |
| `fastapi-app` | 120 | 280 |
| `manim-code-gen` | 96 | 304 |
| `meta-skill-evolution` | 89 | 311 |
| `meta-skill-consolidate` | 73 | 327 |
| `project-router` | 37 | 363 |

### 1.5 O que o linter **não** faz — provado por sonda sintética (execução E7)

Corpus sintético montado no scratchpad, fora dos dois repositórios:

- `probe-a/SKILL.md`: frontmatter com `metadata:` mas **sem `type:`**, `description` em
  primeira pessoa, corpo **sem nenhuma citação de proveniência**.
- `nested/deep/probe-b/SKILL.md`: `metadata.type: inventado-invalido`, dois níveis de
  profundidade.

Saída:

```
WARNING: probe-a: description may not be in third person
0 errors, 1 warning(s)
exit=1
```

Três conclusões, cada uma um requisito do projeto novo:

1. **`metadata.type` é opcional na prática.** A regra R11 só dispara se a chave existir
   (`.agents/scripts/skill_lint.py:72-73`). Omitir `type:` passa limpo. A regra R5 exige apenas
   a substring `metadata:`.
2. **Proveniência não é verificada pelo linter — em nenhum grau.** Não há uma única linha em
   `.agents/scripts/skill_lint.py` que procure `arquivo:linha`. Uma skill sem qualquer citação
   sai `0 errors`. Isto **refuta** `.agents/skills/skill-map.md:134` (ver §10, R2).
3. **Skills aninhadas são puladas em silêncio.** O glob é `SKILL_DIR.glob("*/SKILL.md")`
   (`.agents/scripts/skill_lint.py:115`) — **um nível só**. `probe-b`, com `type` inválido, nunca
   foi analisada e não apareceu na saída. Isto é o "verificador que pula o que não entende" do
   `docs/PLAYBOOK-REFERENCIA.md:530`.

E mais duas, por leitura:

4. **`SKILL_DIR` é relativo ao cwd** (`.agents/scripts/skill_lint.py:12`) e o diretório ausente
   é `print` + `sys.exit(0)` (`.agents/scripts/skill_lint.py:108-110`) — **falha aberto**.
5. **Não há argumento de arquivo.** `main()` ignora `sys.argv` inteiramente
   (`.agents/scripts/skill_lint.py:107-115`): ou linta tudo, ou nada. Não dá para gatear um card
   individual.
6. **A numeração de linha nos erros é do corpo, não do arquivo.** `enumerate(body_lines)` com
   `i+1` (`.agents/scripts/skill_lint.py:88-90`, `95-98`) — o número impresso está deslocado pelo
   tamanho do frontmatter.

---

## 2. Protocolo exato do `skill_write_gate.py`

Fonte integral: `.agents/scripts/skill_write_gate.py` (55 linhas).

### 2.1 O que ele exige antes de permitir escrita

Uma única coisa: **um arquivo JSON `.agents/skills/.eval_records/<nome-da-skill>.json` cujo campo
`last_eval_passed` seja verdadeiro** (`.agents/scripts/skill_write_gate.py:33-39`).

Sequência literal:

1. `path = sys.argv[1]` — ou string vazia se ausente (`:18`).
2. Se `path` vazio **ou** não contém `"SKILL.md"` **ou** não contém `"skills"` → `exit 0`
   (`:21-22`).
3. `skill_name` = nome do diretório pai; se o pai for literalmente `skills`, vira `None` (`:26`).
4. Se `skill_name` é falsy **ou** começa com `.` → `exit 0` (`:28-30`).
5. Lê `EVAL_RECORDS_DIR / f"{skill_name}.json"`; se existe e `record.get("last_eval_passed")` é
   verdadeiro → imprime `[SkillGate] Eval record green` e `exit 0` (`:33-39`). Exceção de parse é
   engolida por `except Exception: pass` (`:40-41`).
6. **Escape de criação inicial:** se o arquivo alvo **não existe no disco**, `exit 0`
   (`:44-46`).
7. Caso contrário: imprime `BLOCKING` e `exit 2` (`:49-51`).

### 2.2 Onde mora o token e qual é o TTL — **a pergunta tem resposta negativa**

> **Não existe token, e não existe TTL.**

- Não há arquivo de token em lugar nenhum do script. As duas únicas constantes de caminho são
  `SKILL_DIR` (`.agents/scripts/skill_write_gate.py:13`, **declarada e nunca usada** — código
  morto) e `EVAL_RECORDS_DIR` (`:14`).
- O "token" é o próprio registro de eval, e ele é **rastreado pelo git**:
  `git ls-files .agents/skills/.eval_records/` lista os 6 arquivos. Não há `.gitignore` no
  repositório alvo. Isto contraria diretamente `docs/PLAYBOOK-REFERENCIA.md:436` ("Token
  gitignorado, **TTL de 30 minutos**").
- O campo `timestamp` existe no registro (`.agents/scripts/run_skill_evals.py:348`) e **nunca é
  lido** pelo gate. Um registro verde de agosto de 2026 autoriza escrita indefinidamente.
- O registro **não é amarrado ao conteúdo** que passou: não há sha1 do `SKILL.md`, nem do
  código-fonte citado. Editar o `SKILL.md` não invalida o registro.
- Consequência operacional: **o token é editável à mão e commitável**. Trocar
  `"last_eval_passed": false` por `true` num editor de texto abre o portão permanentemente, sem
  rodar eval nenhuma.

### 2.3 O que acontece em falha — matriz medida (execução E4)

| Entrada | Saída | Código | Semântica |
|---|---|---:|---|
| sem argumento | (silêncio) | `0` | **abre** |
| literal `${path}` não interpolado | (silêncio) | `0` | **abre** |
| `.agents/skills/fastapi-app/SKILL.md` (registro verde) | `Eval record green` | `0` | abre — correto |
| `.agents/skills/manim-rendering/SKILL.md` (registro **vermelho**) | `BLOCKING write` | `2` | **fecha** — correto |
| `/home/.../3blue1brown/.agents/skills/manim-rendering/SKILL.md` (absoluto, registro vermelho) | `BLOCKING write` | `2` | fecha |
| `.agents/skills/nova-skill/SKILL.md` (inexistente) | `Initial creation — allowing write` | `0` | abre por desenho |
| **mesmo caminho vermelho, executado a partir de `/tmp`** | `Initial creation of 'manim-rendering' — allowing write` | `0` | **abre — falso** |

A última linha é o achado. `EVAL_RECORDS_DIR` (`:14`) e `skill_path.exists()` (`:44`) são ambos
relativos ao cwd. Rodando de outro diretório, o gate não acha o registro **e** conclui que o
arquivo não existe, caindo no escape de criação inicial. **O gate mais rígido do sistema é
desarmado por um `cd`.**

### 2.4 A expressão da linha 44

```python
if not skill_path.exists() if isinstance(skill_path, Path) else True:
```

`.agents/scripts/skill_write_gate.py:44`. É uma expressão condicional, não um `if` aninhado:
avalia `(not skill_path.exists()) if isinstance(skill_path, Path) else True`. Como `skill_path`
é sempre `Path` (construído em `:25`), o `isinstance` é sempre verdadeiro e o ramo `else True`
é **inalcançável**. A expressão equivale a `if not skill_path.exists():`. Não muda o
comportamento; muda a auditabilidade.

### 2.5 O gate não segurou na prática — evidência no git (execução E8)

`.agents/skills/.eval_records/manim-rendering.json:3` registra `"last_eval_passed": false`, com
`timestamp` `2026-08-09T14:54:13.563563+00:00` (`:4`). O commit `a32c2a4`, de
`2026-08-09 11:54:36 -0300` (= `14:54:36 UTC`, **23 segundos depois**), alterou:

```
 .agents/skills/.eval_records/manim-rendering.json |  2 +-
 .agents/skills/manim-rendering/SKILL.md           | 26 ++++++++++++++++++++---
```

O diff do JSON nesse commit mexe **apenas no `timestamp`** — `last_eval_passed` permanece
`false` antes e depois. Ou seja: o `SKILL.md` de uma skill com registro vermelho foi escrito e
commitado, exatamente o caso que a execução E4 mostra que o script bloquearia com `exit 2`.

Duas explicações possíveis, ambas relevantes para o projeto novo:

- **(a) O hook não disparou.** O bloco em `.claude/settings.json:4-10` usa as chaves
  `pathPattern`, `command`, `description` e `onError` diretamente no objeto do matcher, e o
  matcher é a string `"Write||Edit"` (`.claude/settings.json:5`) — com **dois** pipes. O
  contrato de hooks do Claude Code aninha os comandos em `hooks: [{type: "command", command:
  ...}]` e entrega o payload por **stdin JSON**, não por interpolação `${path}`
  (`.claude/settings.json:7`). Se a forma não casa o esquema, o hook é ignorado.
- **(b) O hook disparou e recebeu `${path}` literal** — que a execução E4 mostra sair `0`.

Em qualquer dos dois casos, **o resultado observado é o mesmo: escrita não validada, sem
ruído**. Isto é a definição do playbook de "a ausência de um verificador é indistinguível de
conformidade" (`docs/PLAYBOOK-REFERENCIA.md:229-230`).

---

## 3. Formato exato de um registro em `.eval_records/`

Escrito por `save_record()`, `.agents/scripts/run_skill_evals.py:344-352`. Não há schema
declarado em lugar nenhum; o formato **é** o dicionário literal das linhas 346-350.

### 3.1 Campos de topo

| Campo | Tipo | Origem | Semântica |
|---|---|---|---|
| `skill` | `str` | `.agents/scripts/run_skill_evals.py:346` | nome da skill; espelha a chave de `EVAL_FUNCTIONS` (`:334-341`) e o nome do arquivo (`:352`) |
| `last_eval_passed` | `bool` | `:347` | **é o token do gate** (`.agents/scripts/skill_write_gate.py:37`) |
| `timestamp` | `str` ISO-8601 UTC | `:348`, de `datetime.now(timezone.utc).isoformat()` (`:349`) | **escrito e nunca lido por nenhum consumidor** |
| `results` | `list[dict]` | `:349` | um item por asserção |

Serialização: `json.dumps(record, indent=2)` (`.agents/scripts/run_skill_evals.py:352`), sem
newline final — confirmado nos 6 arquivos existentes.

### 3.2 Campos de cada item de `results`

| Campo | Tipo | Semântica | Exemplo real |
|---|---|---|---|
| `test` | `str` | rótulo humano da asserção | `"validate_code rejects dangerous imports (os)"` (`.agents/scripts/run_skill_evals.py:112`) |
| `passed` | `bool` | veredito binário | `.agents/skills/.eval_records/manim-rendering.json:8` |
| `detail` | `str` | mensagem livre; truncada em 120 chars na impressão (`:383`) | `"manim CLI not installed in this environment (expected outside venv)"` (`.agents/skills/.eval_records/manim-rendering.json:14`) |

### 3.3 Como `last_eval_passed` é derivado — e os dois modos de falso verde

```python
passed = all(r["passed"] for r in results)
```
`.agents/scripts/run_skill_evals.py:376`.

- **Falso verde nº 1 — lista vazia.** `all([])` é `True` em Python. Uma função de eval que
  retorne `[]` produz `last_eval_passed: true` com **zero asserções**. Só o caminho de exceção
  força `False` explicitamente (`.agents/scripts/run_skill_evals.py:372`). Isto é literalmente o
  primeiro item do catálogo de falso verde do playbook: "runner com filtro que casa **zero**
  testes" (`docs/PLAYBOOK-REFERENCIA.md:522`).
- **Falso verde nº 2 — eval constante.** Duas das seis entradas de `EVAL_FUNCTIONS` são lambdas
  que retornam `{"passed": True}` codificado à mão, com o detalhe `"Delegated to skill_lint.py"`
  (`.agents/scripts/run_skill_evals.py:339-340`) — **e não chamam `skill_lint.py`**. Os registros
  resultantes (`.agents/skills/.eval_records/meta-skill-evolution.json:3` e
  `.agents/skills/.eval_records/meta-skill-consolidate.json:3`) são verdes por construção. Como
  esses são exatamente os arquivos das duas meta-skills que escrevem em outras skills, **o portão
  das ferramentas de escrita é permanentemente aberto**.

### 3.4 Terceiro estado ausente

O playbook exige três estados: `PASS`, `FAIL` e **não-exercitado**
(`docs/PLAYBOOK-REFERENCIA.md:368-370`). O registro tem dois (`passed: bool`). A consequência
aparece no corpus: `.agents/skills/.eval_records/manim-code-gen.json:8-9` marca
`"passed": false` com o detalhe `"Cannot import (venv may not be active): No module named
'pydantic_settings'"` — **ambiente ausente foi contabilizado como reprovação**. É o lado
conservador do erro, mas apaga a distinção entre "a skill está errada" e "a suíte não rodou", e
por isso o gate bloqueia escrita numa skill que nunca foi de fato avaliada.

### 3.5 Estado atual dos 6 registros

| Registro | `last_eval_passed` | asserções | motivo | Linha |
|---|---|---:|---|---|
| `fastapi-app.json` | `true` | 4 | 4× AST parse | `.agents/skills/.eval_records/fastapi-app.json:3` |
| `project-router.json` | `true` | 15 | 10 gatilhos + 5 quase-erros | `.agents/skills/.eval_records/project-router.json:3` |
| `meta-skill-evolution.json` | `true` | 1 | **lambda constante** | `.agents/skills/.eval_records/meta-skill-evolution.json:3` |
| `meta-skill-consolidate.json` | `true` | 1 | **lambda constante** | `.agents/skills/.eval_records/meta-skill-consolidate.json:3` |
| `manim-code-gen.json` | `false` | 1 | venv ausente | `.agents/skills/.eval_records/manim-code-gen.json:3` |
| `manim-rendering.json` | `false` | 3 (1 verde) | venv + CLI ausentes | `.agents/skills/.eval_records/manim-rendering.json:3` |

**Duas das seis skills estão com o portão fechado por ausência de ambiente, e duas estão com o
portão aberto por asserção fabricada.** Só duas (`fastapi-app`, `project-router`) têm um verde
com lastro.

---

## 4. O que `run_skill_evals.py` espera encontrar dentro de um `SKILL.md`

### 4.1 Resposta direta: **nada**

`run_skill_evals.py` **nunca abre um `SKILL.md`**. Não há `SKILL.md` no código fora da constante
`SKILL_DIR` (`.agents/scripts/run_skill_evals.py:17`), que só serve para derivar `EVAL_DIR`
(`:18`). Não há `glob`, não há leitura de frontmatter, não há parse de YAML.

O acoplamento é pelo **nome**, num dicionário codificado no próprio runner:

```python
EVAL_FUNCTIONS = {
    "manim-code-gen": eval_manim_code_gen,
    "manim-rendering": eval_manim_rendering,
    "fastapi-app": eval_fastapi_app,
    "project-router": eval_project_router,
    "meta-skill-evolution": lambda: [...],
    "meta-skill-consolidate": lambda: [...],
}
```
`.agents/scripts/run_skill_evals.py:334-341`.

Uma skill que não esteja nessa chave recebe `Unknown skill` e `exit 2`
(`.agents/scripts/run_skill_evals.py:358-361`). Sem argumento, roda `list(EVAL_FUNCTIONS.keys())`
(`:363`) — ou seja, **as seis, e só as seis**.

### 4.2 A consequência: o campo `verification_signal` é decorativo

Todos os 6 `SKILL.md` declaram no frontmatter um `metadata.verification_signal` com um comando
concreto:

| Skill | `verification_signal` declarado | Linha |
|---|---|---|
| `manim-code-gen` | `python3 -c '... import validate_code ...' && python3 .agents/scripts/skill_lint.py` | `.agents/skills/manim-code-gen/SKILL.md:6` |
| `fastapi-app` | `python3 -c 'ast.parse(open("manim-api/main.py")...)' && ... skill_lint.py` | `.agents/skills/fastapi-app/SKILL.md:6` |
| `manim-rendering` | `manim --version && python3 -c '...' && ... skill_lint.py` | `.agents/skills/manim-rendering/SKILL.md:6` |
| `project-router` | `python3 .agents/scripts/run_skill_evals.py project-router` | `.agents/skills/project-router/SKILL.md:6` |
| `meta-skill-evolution` | `skill_lint.py && run_skill_evals.py` | `.agents/skills/meta-skill-evolution/SKILL.md:6` |
| `meta-skill-consolidate` | `skill_lint.py && run_skill_evals.py` | `.agents/skills/meta-skill-consolidate/SKILL.md:6` |

**Nenhum desses comandos é executado por nenhum script do repositório.** O template de proposta
de nova skill continua exigindo o campo (`.agents/skills/meta-skill-evolution/SKILL.md:78-79`), e
o linter continua sem verificá-lo. É um `Guarda executável` (`docs/PLAYBOOK-REFERENCIA.md:476`)
escrito e nunca disparado — "se você não consegue escrever a guarda, a decisão é uma intenção";
aqui a guarda foi escrita e **ninguém a chama**.

### 4.3 O que o runner de fato espera do ambiente

O que precisa existir para uma eval passar não está no `SKILL.md`, está no runner:

- `sys.path.insert(0, REPO_ROOT / "manim-api")` (`.agents/scripts/run_skill_evals.py:14-15`) —
  o layout de diretórios do projeto alvo é premissa embutida.
- `from services.openai_service import validate_code, sanitize_code, extract_code,
  get_scene_name` (`:49`) — nomes de função reais.
- `from services.manim_executor import RenderResult, find_video` (`:163`).
- `run_ast_check("manim-api/main.py")` e três irmãos (`:224`, `:231`, `:238`, `:245`) — caminhos
  **relativos ao cwd**, ao contrário de `EVAL_DIR`, que é derivado de `__file__` (`:14-18`).
  Convivem duas convenções de resolução de caminho no mesmo arquivo.
- `subprocess.run(["manim", "--version"], ...)` (`:180`).
- `ROUTING_MAP` (`:286-303`): três skills, com listas de 12–17 palavras-chave, comparadas por
  substring em minúsculas (`:307-310`).

### 4.4 A única peça genuinamente transferível: gatilho × quase-erro

`eval_project_router()` implementa a estrutura que o playbook chama de sonda negativa:

- **10 gatilhos** que **têm de** casar (`.agents/scripts/run_skill_evals.py:252-274`), assertados
  com `all(s in matched for s in expected)` (`:315`).
- **5 quase-erros** que **não podem** casar (`:277-283`), assertados com
  `not any(s in matched for s in forbidden)` (`:324`).

Este é o padrão a copiar. Mas a asserção do quase-erro tem um vazamento:

```python
"passed": none_matched or len(matched) == 0,
```
`.agents/scripts/run_skill_evals.py:326`. O `or len(matched) == 0` é redundante quando
`forbidden` cobre todas as skills e **enfraquece** o teste quando não cobre: um roteador que
nunca casa nada passa em todos os 5 quase-erros. Falta a asserção recíproca — "o roteador casa
alguma coisa" — que os 10 gatilhos dão só porque o `ROUTING_MAP` está no mesmo arquivo.

E aí está a violação estrutural: **o `ROUTING_MAP` do teste (`:286-303`) não é o roteador**. O
roteador real é a prosa de `.agents/skills/project-router/SKILL.md:37-44`, uma tabela em
português com 4 linhas. O oráculo e a implementação são objetos diferentes que ninguém
compara — o inverso do defeito do playbook (`docs/PLAYBOOK-REFERENCIA.md:322-323`), mas com o
mesmo efeito: 15/15 verde não diz nada sobre o roteador que roda.

---

## 5. O que `check_staleness.py` valida sobre proveniência

Fonte integral: `.agents/scripts/check_staleness.py` (77 linhas).

### 5.1 O formato de citação aceito

Um único regex, `.agents/scripts/check_staleness.py:15`:

```python
PROVENANCE_PATTERN = re.compile(r"`([^`]+):(\d+)(?:@([a-f0-9]{7,}))?`")
```

Leitura estrita: **crase**, depois qualquer coisa sem crase (grupo 1 = caminho), **dois-pontos**,
**um ou mais dígitos e nada mais** (grupo 2 = linha), opcionalmente **`@` + ≥7 hex** (grupo 3 =
hash), **crase**. O comentário na linha 14 declara a intenção: `file:line@hash` ou `file:line`.

O que **não** é aceito, por consequência mecânica:

| Forma | Aceita? | Por quê |
|---|---|---|
| `` `main.py:259` `` | sim | |
| `` `manim_executor.py:225@922e47d` `` | sim | |
| `` `openai_service.py:100-139` `` | **não** | após `\d+` o próximo char tem de ser `@` ou crase; é `-` |
| `` `openai_service.py:249,293` `` | **não** | idem, vírgula |
| `` `main.py` `` (sem linha) | **não** | falta `:\d+` |
| `main.py:259` sem crase | **não** | crases são obrigatórias |
| `` `http://localhost:8000` `` | **sim (falso positivo)** | `http://localhost` vira "caminho", `8000` vira "linha" |

### 5.2 O que ele chama de deriva — e o que **não** chama

Duas verificações, só duas:

1. **Existência do arquivo.** `target = REPO_ROOT / file_ref`, com
   `REPO_ROOT = Path.cwd()` (`.agents/scripts/check_staleness.py:12`, `27`). Ausente →
   `"issue": "File not found"` (`:29-35`).
2. **Linha dentro do arquivo.** `if line_ref > len(target_lines)` →
   `"Line N beyond file end"` (`:41-46`).

**O hash é capturado e descartado.** `hash_ref = match.group(3)` (`:25`) só reaparece como valor
no dicionário de relatório (`:32`, `:44`). Não há `hashlib`, não há `git`, não há leitura do
conteúdo da linha citada. `target.read_text()` é chamado (`:39`) apenas para contar linhas.

Portanto: **este script não detecta deriva.** Ele detecta arquivo deletado e arquivo encurtado.
Uma linha reescrita, uma função renomeada, um bloco inteiro trocado — tudo passa verde desde que
o arquivo tenha comprimento suficiente. O playbook já declara o teto disto ("Proveniência
detecta deriva, não correção", `docs/PLAYBOOK-REFERENCIA.md:443`); aqui o teto é mais baixo:
**detecta ausência, não deriva.**

Códigos de saída: `1` se houver qualquer item (`:70`), `0` caso contrário (`:73`). Diretório
`.agents/skills` ausente → `exit 0` (`:54-56`), **falha aberto**. Exceção de leitura →
`except Exception: pass` (`:47-48`), item descartado em silêncio.

### 5.3 O que ele reporta hoje (execução E2)

```
STALE PROVENANCE FOUND:

  fastapi-app:
    config.py:17 — File not found
    http://localhost:8000 — File not found
    config.py:12 — File not found
    main.py:259 — File not found

  manim-code-gen:
    openai_service.py:35 — File not found

  manim-rendering:
    manim_executor.py:225 — File not found
    config.py:15 — File not found
exit=1
```

As citações usam nomes de arquivo **nus** (`config.py`), mas os arquivos reais moram em
`manim-api/config.py` e `manim-api/services/openai_service.py`. Resolvidos contra
`Path.cwd()` = raiz do repositório, não existem. **Sete dos itens são falha de convenção de
caminho, não deriva real** — e um deles nem é um caminho (`http://localhost:8000`).

E o mais importante: **`skill_lint.py` sai `0` no mesmo corpus em que `check_staleness.py` sai
`1`** (E1 × E2). Os dois não conversam. Nada, em nenhum hook, em nenhum script, chama
`check_staleness.py`: as únicas menções em todo o repositório são prosa —
`.agents/skills/meta-skill-consolidate/SKILL.md:79`, `AGENTS.md:10` e
`.agents/skills/validation-report.md:146`. Não existe `.github/` no repositório alvo (verificado:
`ls -a .github` → não existe).

### 5.4 O tamanho do buraco, medido (execução E6)

Contagem sobre os 6 `SKILL.md`, comparando o regex estrito com um regex frouxo que pega qualquer
`` `...<ext>...:<dígito>...` ``:

| Skill | citações com forma de `arquivo:linha` | casadas pelo regex | **mudas** |
|---|---:|---:|---:|
| `manim-code-gen` | 18 | 2 | **16** |
| `manim-rendering` | 14 | 3 | **11** |
| `fastapi-app` | 11 | 5 (1 é URL) | **7** |
| meta/router (3 skills) | 0 | 0 | 0 |
| **total** | **43** | **10** | **34** |

- **34 de 43 citações (79%) são invisíveis ao verificador.** Quase todas por serem faixas
  (`openai_service.py:100-139`).
- Das 10 casadas, **7 reportam "File not found"** (§5.3) e 1 é o falso positivo da URL.
- **3 citações de 43 (7%)** resolvem para um arquivo existente e são de fato conferidas — e
  mesmo essas só quanto a "a linha existe".
- **Exatamente 1 citação em todo o corpus carrega hash:**
  `` `manim_executor.py:225@922e47d` `` (`.agents/skills/manim-rendering/SKILL.md:58`).

Isto reproduz, com números diferentes e a mesma forma, o defeito nomeado no playbook: "38 de 55
citações estavam mudas porque a regex exigia caminho e o token nunca casava"
(`docs/PLAYBOOK-REFERENCIA.md:429-431`) e "citação de proveniência **sem o caminho** — a regex
nunca casa; é pulada em silêncio" (`docs/PLAYBOOK-REFERENCIA.md:525`).

### 5.5 A única citação com hash está errada — e nasceu errada

`.agents/skills/manim-rendering/SKILL.md:58` afirma:

> `--write_to_movie` — required for OpenGL renderer to produce MP4 output. […] Verified against
> Manim CE v0.20.1 `manim_executor.py:225@922e47d`

Verificação direta:

- No HEAD, `manim-api/services/manim_executor.py:225` é `"render",` — e `--write_to_movie` está
  na **linha 233** (`grep -n write_to_movie` → `233:            "--write_to_movie",`).
- No commit pinado, `git show 922e47d:manim-api/services/manim_executor.py | sed -n 225p`
  devolve `"render",` também. **O pin já estava errado no commit que ele pina.**
- O caminho citado (`manim_executor.py`) não resolve a partir da raiz, então o
  `check_staleness.py` reporta "File not found" e **nunca chega a comparar coisa alguma**.

A citação foi escrita no mesmo commit `a32c2a4` cuja mensagem declara
`Provenance: manim_executor.py:225@922e47d`. É a demonstração completa do ciclo: proveniência
escrita à mão, pin errado, verificador cego ao erro, mensagem de commit reafirmando o erro. O
playbook antecipa isso e prescreve o remédio: citação "gerada por script, **jamais escrita à
mão**" (`docs/PLAYBOOK-REFERENCIA.md:429-430`).

---

## 6. Os hooks de `.claude/settings.json` — o que garantem, e aberto × fechado

Fonte integral: `.claude/settings.json` (33 linhas). Quatro hooks: três `PreToolUse`
(`:3-24`) e um `Stop` (`:25-31`). **Todos** declaram `"onError": "block"` (`:9`, `:16`, `:22`,
`:29`).

### 6.1 O que cada um pretende garantir

| # | Gatilho | Comando | Intenção declarada | Linhas |
|---|---|---|---|---|
| H1 | `Write\|\|Edit` em `**/skills/**/SKILL.md` | `skill_write_gate.py "${path}"` | "Block unvalidated SKILL.md writes — requires a green eval record" | `.claude/settings.json:4-10` |
| H2 | `Read` em `.env\|\|**/secrets/**\|\|**/.env.*` | `exit 2` | "Block reading .env and secrets files" | `.claude/settings.json:11-17` |
| H3 | `Bash` (sem `pathPattern`) | `bash_guardrail.py "${command}"` | "Block dangerous bash commands (rm -rf /, history rewrite, etc.)" | `.claude/settings.json:18-23` |
| H4 | `Stop` | `stop_validation_gate.py` | "Prevent Stop until all bootstrap phases are complete" | `.claude/settings.json:25-31` |

### 6.2 Aberto × fechado — a distinção que importa

`onError: "block"` governa o que fazer se o **hook** errar. Não governa o que o **script** faz
com entrada inesperada. A diferença entre falhar aberto e falhar fechado é decidida no código de
saída, e a matriz é esta:

| Hook | Entrada inesperada | Código | **Falha** |
|---|---|---:|---|
| H1 | argv vazio / `${path}` literal (`skill_write_gate.py:21-22`) | `0` | **ABERTO** |
| H1 | cwd fora da raiz (E4, `:14`+`:44`) | `0` | **ABERTO** |
| H1 | JSON corrompido (`:40-41` engole a exceção, cai no bloqueio `:49`) | `2` | fechado |
| H1 | arquivo alvo inexistente (`:44-46`) | `0` | **ABERTO** (por desenho) |
| H2 | — (é `exit 2` literal, `.claude/settings.json:14`) | `2` | **FECHADO sempre** |
| H3 | argv vazio (`bash_guardrail.py:24-25`) | `0` | **ABERTO** |
| H3 | qualquer comando fora das 5 regexes (`:9-20`) | `0` | **ABERTO** (denylist) |
| H4 | arquivo de estado ausente (`stop_validation_gate.py:14-16`) | `0` | **ABERTO** |
| H4 | JSON não parseável (`:18-22`) | `0` | **ABERTO** |
| H4 | `stop_hook_active` já setado (`:32-37`) | `0` | **ABERTO** (auto-desarme) |
| H4 | fases incompletas, 1ª vez (`:43-47`) | `2` | fechado |
| H4 | fase sem chave `id` (`:36` acessa `p['id']` sem `.get`) | traceback | indefinido |

**Resumo:** **um único hook falha fechado incondicionalmente — o H2**, e é o único que não roda
script. Os três que rodam script falham abertos em toda entrada que não seja exatamente a que
esperavam. Isto contradiz `.agents/skills/validation-report.md:191`, que afirma o contrário (ver
§10, R5).

O playbook admite hooks que falham abertos diante de entrada inesperada
(`docs/PLAYBOOK-REFERENCIA.md:399-400`), mas com a condição imediata: escopo estreito o bastante
para não ser desligado, e **gate mecânico só onde o erro é irreversível ou auto-amplificante**
(`docs/PLAYBOOK-REFERENCIA.md:404-405`). Memória persistida é exatamente esse caso — e é o H1,
o que mais falha aberto.

### 6.3 H4 é um gate que se desarma sozinho

`stop_validation_gate.py:40-41`:

```python
state["stop_hook_active"] = True
STATE_FILE.write_text(json.dumps(state, indent=2))
```

Na primeira tentativa de parada com fases incompletas, o script **escreve no próprio arquivo de
estado** e bloqueia. Na segunda, o ramo `:32-37` vê a flag e libera. **O gate vale uma vez por
ciclo** e permanece desarmado até alguém repor `stop_hook_active: false` à mão — que é o valor
atual em `.agents/skills/.bootstrap-state.json:10`.

O guard contra loop infinito é legítimo; o efeito colateral é que o gate persiste sua própria
desativação num arquivo versionado. Um verificador que escreve no artefato que verifica não é
verificador.

Além disso: as 5 fases de `.agents/skills/.bootstrap-state.json:2-8` são uma **lista linear**
(`id`, `name`, `done`, `gate_passed`, `artifact`). Não há campo de dependência, não há aresta,
não há onda, não há contador monotônico. Como barreira de onda no sentido de
`docs/PLAYBOOK-REFERENCIA.md:289-290` ("Contador monotônico por onda, nunca relógio"), **não
serve**: é um checklist de 5 posições de um bootstrap que já terminou (todas `done: true`,
`gate_passed: true`).

### 6.4 A dependência de cwd atravessa três dos quatro (execução E3)

Executados a partir de `/tmp`:

```
skill_lint.py            → "No skills directory found"                          exit=0
check_staleness.py       → "No skills directory"                                exit=0
stop_validation_gate.py  → "Bootstrap state file not found — allowing Stop"     exit=0
skill_write_gate.py <skill vermelha> → "Initial creation — allowing write"      exit=0
```

Quatro verificadores, quatro saídas verdes, zero verificação. Todos usam `Path(".agents/...")`
literal (`skill_lint.py:12`, `check_staleness.py:11`, `stop_validation_gate.py:11`,
`skill_write_gate.py:13-14`). O único que resolve por `__file__` é `run_skill_evals.py:14` — e
esse é o que não gateia nada.

### 6.5 H3 não bloqueia `rm -rf /` (execução E5)

`bash_guardrail.py:9-20` é uma denylist de 5 regexes. Testados 18 comandos:

| Comando | Código | Veredito |
|---|---:|---|
| `rm -rf /` | **0** | **passa** |
| `rm -rf /*` | **0** | **passa** |
| `rm -rf ~` | **0** | **passa** |
| `rm -rf ~/` | **0** | **passa** |
| `sudo rm -rf /` | **0** | **passa** |
| `rm -rf --no-preserve-root /` | **0** | **passa** |
| `rm -fr /home` | **0** | **passa** |
| `cd /home && rm -rf .` | **0** | passa |
| `find / -delete` | **0** | passa |
| `python3 -c "import shutil;shutil.rmtree('/home')"` | **0** | passa |
| `git push -f origin main` | **0** | **passa** |
| `git reset --hard HEAD~5` | **0** | passa |
| `dd if=/dev/zero of=/dev/nvme0n1` | **0** | passa |
| `rm -rf /home/ondokai/Projects` | 2 | bloqueia |
| `echo x; rm  -rf  /home` | 2 | bloqueia |
| `git push --force origin main` | 2 | bloqueia |
| `git reset --hard origin/main` | 2 | bloqueia |
| `dd if=/dev/zero of=/dev/sda` | 2 | bloqueia |

A causa de `rm -rf /` passar está em `bash_guardrail.py:11`:

```python
(r"\brm\s+-rf\s+(~|/|/home|/root|/etc|/var|/usr|/bin|/sbin)\b", "rm -rf on critical path")
```

O `\b` final exige fronteira de palavra. Depois de `/` (não-palavra) no fim da string, não há
fronteira — o regex não casa. A alternância também está ordenada de forma que `/` casa antes de
`/home`, mas isso é secundário: **o caso nomeado na descrição do próprio hook
(`.claude/settings.json:21`, "rm -rf /") é o caso que não é bloqueado.**

Só bloqueia quando há um sufixo com caractere de palavra (`/home`, `/home/ondokai/Projects`).
Também não cobre `-fr`, `--no-preserve-root`, `-f` curto no push, `nvme*`, `find -delete` ou
qualquer coisa via Python.

Isto é a armadilha do `docs/PLAYBOOK-REFERENCIA.md:402`: *"um gate que só pode ser satisfeito
contornando-o ensina a contornar"* — aqui é pior, o gate **já está contornado por acidente** e
imprime silêncio, que é indistinguível de aprovação.

---

## 7. Tabela de reuso

Uma linha por unidade reutilizável. **`copiar-com-ajuste` só é legítimo com o ajuste nomeado** —
sem nome, é `não-serve`.

| Unidade | verbatim | com ajuste | não-serve | Ajuste nomeado (obrigatório na coluna do meio) |
|---|:---:|:---:|:---:|---|
| **Pipeline de memória em 5 passos** (`.agents/skills/meta-skill-evolution/SKILL.md:40-67`) | **X** | | | copiar o texto como está; ele já codifica importância → verificação externa → conflito → gate → commit próprio, alinhado a `docs/PLAYBOOK-REFERENCIA.md:437-441` |
| **Template de frontmatter de skill** (`.agents/skills/meta-skill-evolution/SKILL.md:73-88`) | **X** | | | `name` / `description` / `metadata.type` / `metadata.verification_signal` + seções `When to use` / `Injected knowledge` / `Evolution` |
| **Regras de descarte** (`.agents/skills/meta-skill-evolution/SKILL.md:92-96`) | **X** | | | "na dúvida, descarte" e "nunca crie LEARNINGS.md" são normativos e já corretos |
| `skill_lint.py` | | **X** | | (a) resolver `SKILL_DIR` por `__file__`/`git rev-parse` e **falhar fechado** se o diretório sumir ou se **zero skills forem parseadas** (`:108-110`, `:115`); (b) aceitar caminho em `argv` para gatear um card só; (c) **nova regra de proveniência como ERRO**: exigir `caminho/com/separador:linha@sha1(≥7)` e **rejeitar as formas degeneradas** (faixa, vírgula, sem caminho, URL); (d) `metadata.type` obrigatório (`:72`); (e) `rglob` em vez de `glob` de um nível (`:115`); (f) numerar linhas do arquivo, não do corpo (`:88`, `:95`); (g) trocar a lista de 12 verbos (`:64-67`) por regra falsificável, ou rebaixá-la a aviso documentado como heurística |
| `skill_write_gate.py` | | **X** | | (a) **token de verdade**: arquivo gitignorado, TTL de 30 min, contendo o `sha1` do `SKILL.md` que passou (`docs/PLAYBOOK-REFERENCIA.md:436`) — hoje o token é o JSON versionado `:33-39`; (b) remover o escape de criação inicial cwd-dependente (`:44-46`) ou trocá-lo por allowlist explícita datada; (c) resolver caminhos por `__file__`; (d) **falhar fechado** em `argv` vazio (`:21-22`); (e) **chamar o linter**, não só ler um JSON; (f) apagar `SKILL_DIR` morto (`:13`) e a expressão inalcançável (`:44`) |
| `run_skill_evals.py` — motor | | | **X** | evals codificadas para `manim-api` (`:43-331`), `EVAL_FUNCTIONS` hardcoded (`:334-341`), `sys.path` cravado (`:14-15`). Substituir por descoberta a partir do `metadata.verification_signal` do próprio `SKILL.md` |
| `run_skill_evals.py:344-352` — contrato do registro | | **X** | | (a) trocar `passed: bool` por 3 estados `PASS/FAIL/NÃO-EXERCITADO` (`docs/PLAYBOOK-REFERENCIA.md:368-370`); (b) **`all([])` → falha** (`:376`); (c) gravar `sha1` do `SKILL.md` avaliado; (d) TTL lido a partir de `timestamp` (`:348`) |
| `run_skill_evals.py:252-283` — gatilhos + quase-erros | | **X** | | (a) remover o `or len(matched) == 0` (`:326`), que deixa passar roteador que nunca casa; (b) acrescentar a asserção recíproca "casa ≥1"; (c) fazer o oráculo **ler o roteador real**, não uma cópia (`ROUTING_MAP:286-303` × `project-router/SKILL.md:37-44`) |
| `check_staleness.py` | | **X** | | (a) **comparar o sha1 recomputado** — hoje ele é capturado em `:25` e descartado; (b) regex que exija separador de caminho e `@sha1` obrigatório, e que **rejeite** URL e faixa em vez de ignorá-las (`:15`); (c) resolver a raiz por `git rev-parse --show-toplevel`, não `Path.cwd()` (`:12`); (d) **falhar fechado** se um `SKILL.md` que afirma fatos tiver zero citações casadas (`:54-56`, `:47-48`); (e) ser chamado por algum gate — hoje só existe em prosa |
| `stop_validation_gate.py` | | **X** | | (a) trocar o auto-desarme por **contador monotônico por onda** (`docs/PLAYBOOK-REFERENCIA.md:289-290`); (b) **não escrever no arquivo que verifica** (`:40-41`); (c) falhar **fechado** quando o estado não parseia (`:18-22`); (d) `p.get('id')` (`:36`) |
| `bash_guardrail.py` | | | **X** | denylist de 5 regexes que **deixa passar `rm -rf /`, `rm -rf ~` e `sudo rm -rf /`** (§6.5) e nomeia esse caso na descrição do hook (`.claude/settings.json:21`). Substituir por: allowlist do harness (`permissions` do `settings.json`) + gate de **propriedade de arquivo** por card (`docs/PLAYBOOK-REFERENCIA.md:136-147`) |
| `.claude/settings.json` | | **X** | | (a) reescrever no esquema aninhado `hooks: [{type:"command", command: ...}]`; (b) ler o payload de **stdin JSON** em vez de `${path}`/`${command}` (`:7`, `:20`); (c) `"Write\|Edit"` com **um** pipe (`:5`); (d) manter o `exit 2` literal para segredos (`:14`) — é o único que falha fechado |
| `.agents/skills/catalog.md` (formato) | | **X** | | o formato de índice serve; **tem de ser gerado**, não redigitado (`docs/PLAYBOOK-REFERENCIA.md:431-433`). O cabeçalho `:4` já promete geração que não existe (§10, R1) |
| `.agents/skills/skill-map.md` §3 (justificativa de granularidade) | | **X** | | as tabelas "por que não dividir / por que não juntar" (`:90-108`) viram o argumento de **granularidade de card** de `docs/PLAYBOOK-REFERENCIA.md:90-94`, com o critério trocado de "tokens" para "conjunto de arquivos escritos disjunto + comando `exit 0`" |
| `.agents/skills/validation-report.md` | | | **X** | é prosa que se autodeclara `PASS` em 12/12 critérios (`:168-181`) enquanto §5.3 e §6.5 mostram o contrário. Como gate, não serve. A §8 "Known Gaps" (`:185-197`) só serve se **virar ledger** (ver Lacuna 3) |
| `.agents/skills/.bootstrap-state.json` | | **X** | | acrescentar arestas de dependência, `onda`, `nivel`, dono de arquivo e contador monotônico; hoje são 5 fases lineares sem grafo (`:2-8`) |
| `project-router/SKILL.md` — protocolo | | **X** | | os 8 passos (`:12-28`) são o ritual de entrada de `docs/PLAYBOOK-REFERENCIA.md:266-268`; ajuste: trocar "faça muitas perguntas" por **perguntar só o delta** quando há spec a montante (`docs/PLAYBOOK-REFERENCIA.md:270-272`), e substituir o `TASK_PLAN.md` descartável por card versionado |
| `meta-skill-consolidate/SKILL.md` — workflow de GC | | **X** | | os 8 passos (`:16-69`) servem; ajuste: o passo 3 (`:27-34`) descreve conferência de hash que **o script não faz** (§5.2) — ou o script passa a fazer, ou o passo vira manual declarado (`docs/PLAYBOOK-REFERENCIA.md:228-230`) |

**Contagem:** 3 verbatim · 12 com ajuste · 3 não-serve.

---

## 8. LACUNAS — cada uma vira um card do programa novo

O critério de existência aqui é o do playbook: *"se isto desaparecer, o que fica vermelho?"*
(`docs/PLAYBOOK-REFERENCIA.md:363`). Em todas as lacunas abaixo, a resposta é **nada**.

### L1 — Validador de grafo de dependências: **inexistente**

**O que o playbook exige:** ~80 linhas, escritas no dia 1, com 11 verificações
(`docs/PLAYBOOK-REFERENCIA.md:182-194`): resolução de dependência, aciclicidade, monotonia de
onda, folga `onda > nivel`, órfãos, representação gerada, onda declarada == tabela, **dois cards
da mesma onda não escrevem no mesmo arquivo**, critério parseável, caminho crítico, ancestrais
concluídos.

**O que existe:** nada. Não há grafo. `.agents/skills/skill-map.md:66-86` desenha um grafo de
composição **em bloco de código ASCII**, redigitado à mão, sem validador. Não há card, não há
onda, não há aresta em formato estruturado. `.agents/skills/.bootstrap-state.json:2-8` é uma
lista de 5 fases sem dependências.

**Card:** escrever o validador de grafo antes da primeira onda paralela, com os 11 checks e o
autoteste de §L6. É o erro nº 2 do programa de origem (`docs/PLAYBOOK-REFERENCIA.md:544`).

### L2 — Sonda negativa de aceitação: **parcial, e no lugar errado**

**O que existe:** os 5 quase-erros de roteamento
(`.agents/scripts/run_skill_evals.py:277-283`) são uma sonda negativa legítima — e o único
pedaço desta infraestrutura que o playbook aprovaria sem ajuste conceitual.

**O que falta:**
1. A sonda cobre o **roteador**, não os **gates**. Ninguém pergunta "o que o `skill_lint.py`
   imprime se a skill não tiver nada?" — resposta medida em §1.5: `0 errors`.
2. `all([])` é verde (`.agents/scripts/run_skill_evals.py:376`) — o falso verde nº 1 do catálogo
   (`docs/PLAYBOOK-REFERENCIA.md:522`).
3. Duas evals são `passed: True` literal (`.agents/scripts/run_skill_evals.py:339-340`) — nunca
   podem ficar vermelhas.
4. Falta o critério que **falha por ausência** (`docs/PLAYBOOK-REFERENCIA.md:386-388`): nenhum
   comando neste repositório fica vermelho quando um artefato é apagado.

**Card:** para cada critério de aceitação do programa novo, escrever a sonda negativa pareada, e
fazer "zero itens parseados = falha" em todos os verificadores.

### L3 — Ledger de incerteza: **inexistente**

**O que o playbook exige** (`docs/PLAYBOOK-REFERENCIA.md:447-472`): não é registro de riscos, é
fila de trabalho. Cinco campos por item — a pergunta, por que a base não responde, o que se
assumiu, **o teste executável que fecha**, o que se quebra se a resposta for outra. Mais: id
pré-alocado por faixa, inbox por card, âncora no código `// ABERTO <id>`, script de fechamento
rodando no gate **desde o dia 1**, lista negra de evidências (`"ok"`, `"confirmado"`), estado
terminal `INVIÁVEL`.

**O que existe:** `.agents/skills/validation-report.md:185-197`, "Known Gaps and Limitations", 6
parágrafos numerados em prosa. Nenhum tem id, nenhum tem teste que o feche, nenhum diz o que
quebra, nenhum tem dono. O item 4 (`:193`, "No automated CI") está aberto desde o commit `2a005ef`
e não há nada que o reaperte.

Pior: o item 1 (`:187`) declara que as evals de `manim-code-gen` e `manim-rendering` falham fora
do venv e chama isso de **"This is expected"**. Duas skills estão com o portão de escrita fechado
por essa razão e o texto trata a condição como aceitável. É a "premissa invisível" do
`docs/PLAYBOOK-REFERENCIA.md:469-471` com o sinal trocado: em vez de `CONFIRMADO` sem evidência,
é `esperado` sem prazo.

**Card:** criar o ledger no card 1 (erro nº 1 do programa de origem,
`docs/PLAYBOOK-REFERENCIA.md:543`), com os 5 campos, faixas de id e o script de fechamento verde
com tudo aberto.

### L4 — Estado derivado: **inexistente, e já divergiu**

**O que o playbook exige:** "Todo número que aparece em prosa e existe numa fonte estruturada é
**gerado ou conferido**, nunca redigitado" (`docs/PLAYBOOK-REFERENCIA.md:410-411`), e "se o grafo
existe em duas representações, uma tem de ser gerada da outra"
(`docs/PLAYBOOK-REFERENCIA.md:196-197`).

**O que existe:** três documentos que redigitam o mesmo estado — `catalog.md` (53 linhas),
`skill-map.md` (138), `validation-report.md` (219) — e nenhum gerador.

**Divergência já materializada:** `.agents/skills/validation-report.md:145` afirma
*"Skills are 92-140 lines each […] median ~110 lines"*. Medição real dos 6 arquivos:
`44, 80, 96, 103, 127, 133` linhas de arquivo (`37, 73, 89, 96, 120, 126` de corpo). O
`project-router` tem 44 — **fora da faixa declarada**. O número em prosa está errado, e nada fica
vermelho.

**Card:** gerar `catalog.md` e a tabela de ondas a partir da fonte estruturada, e adicionar ao
gate a comparação **linha a linha** (`docs/PLAYBOOK-REFERENCIA.md:414-415`) entre o prosa e o
derivado.

### L5 — Faixas de id: **inexistentes**

**O que o playbook exige:** ids pré-alocados **por faixa** para sobreviver a N worktrees, inbox
por card em vez do arquivo compartilhado, ids nunca reciclados, procurar antes de abrir
(`docs/PLAYBOOK-REFERENCIA.md:459-462`); e faixas de ID disjuntas como um dos quatro dispositivos
da onda de composição (`docs/PLAYBOOK-REFERENCIA.md:163-164`).

**O que existe:** nenhum id em lugar nenhum. As "fases" de `.bootstrap-state.json:3-7` têm
`id: 1..5` — uma sequência linear de 5 posições, não uma faixa alocável. Toda a infraestrutura
pressupõe **um agente, um cwd**: quatro dos scripts resolvem caminho por `Path.cwd()` (§6.4), e
`.eval_records/` é um diretório compartilhado onde N agentes em N worktrees escreveriam o mesmo
`<skill>.json`.

**Card:** definir o esquema de id (faixa por card), o inbox por card e a consolidação
pós-merge, antes de existir a primeira onda com mais de um agente.

### L6 — Autoteste dos verificadores: **inexistente**

**O que o playbook exige** (`docs/PLAYBOOK-REFERENCIA.md:392-395`): o autoteste roda **antes** do
verificador, **asserta a mensagem** e não o código de saída, com **mutações calculadas do
documento corrente, nunca literais**, falha fechado e **recusa explicitamente o que não sabe
analisar**.

**O que existe:** nada testa `skill_lint.py`, `check_staleness.py`, `skill_write_gate.py`,
`bash_guardrail.py` ou `stop_validation_gate.py`. Este documento é, até onde a leitura alcança, a
primeira execução adversarial desses scripts — e ela derrubou três deles (§1.5, §5.5, §6.5).

**Card:** para cada verificador do programa novo, um autoteste com mutação calculada, que asserta
a **mensagem** de acusação.

### L7 — Três estados (PASS / FAIL / não-exercitado): **ausente**

Detalhado em §3.4. `passed: bool` conflata "quebrou" com "não rodou".
`docs/PLAYBOOK-REFERENCIA.md:368-370` exige três, e
`docs/PLAYBOOK-REFERENCIA.md:367` exige que **ferramenta ausente seja VERMELHO, não "pulado"** —
aqui é vermelho, o que está certo, mas indistinguível de defeito real, o que está errado.
Gate que ainda não existe deve ser anunciado como `PENDENTE`, nunca omitido
(`docs/PLAYBOOK-REFERENCIA.md:369-370`) — não há nenhum `PENDENTE` no corpus.

**Card:** enum de 3 estados no registro de eval e no gate, com `PENDENTE` declarado.

### L8 — Fonte única e gate local: **ausentes**

Não existe `.github/` no repositório alvo. `AGENTS.md:8-10` lista os três comandos de
verificação como prosa; nada os executa. `.agents/skills/validation-report.md:193` reconhece
("No automated CI") e `:203` recomenda — a recomendação não virou card. O playbook exige que o
gate local **leia** a definição do CI (`docs/PLAYBOOK-REFERENCIA.md:370`); aqui não há nem um nem
outro.

**Card:** um gate local com uma etapa por job, lendo a definição do CI, com os três estados.

### L9 — Propriedade de arquivo: **ausente**

`docs/PLAYBOOK-REFERENCIA.md:136-150` põe a propriedade de arquivo como o eixo real do
paralelismo, e manda enumerar os recursos singleton antes de dimensionar a onda. Nesta
infraestrutura, os singletons são visíveis e não declarados: `.agents/skills/catalog.md`,
`.agents/skills/.bootstrap-state.json` e cada `.agents/skills/.eval_records/<skill>.json`. Não há
mapa de propriedade nem coluna "os outros: não editam".

**Card:** mapa de propriedade por arquivo, com dono nominal por card, antes da primeira onda
paralela.

### L10 — Guarda executável de decisão (ADR): **declarada e nunca disparada**

`metadata.verification_signal` existe nos 6 `SKILL.md` (§4.2) e é exatamente a forma que
`docs/PLAYBOOK-REFERENCIA.md:476-478` pede para um ADR — **e nenhum script o executa**. Não há
diretório de ADR, não há campo `Supera`, não há `O que o sign-off NÃO autoriza`.

**Card:** ADR com `Guarda executável`, `Supera` e `O que o sign-off NÃO autoriza`, com o comando
da guarda rodando no gate.

### L11 — Barreira de onda: **ausente** (o Stop gate não é uma)

Detalhado em §6.3. O H4 é um checklist de bootstrap de 5 posições que se auto-desarma na segunda
tentativa. `docs/PLAYBOOK-REFERENCIA.md:289-290` exige contador monotônico por onda, válido para
quem terminou antes de você começar a esperar.

**Card:** barreira por contador monotônico, mais o ciclo
`lançar → BARREIRA → commite → BARREIRA → merges um a um → gate após CADA merge`
(`docs/PLAYBOOK-REFERENCIA.md:292-296`).

### L12 — Caracterização / golden master: **fora de escopo desta infra, e é uma lacuna**

`docs/PLAYBOOK-REFERENCIA.md:202-204` define "iniciado" pela existência de um golden master
pinado. Nenhum dos 6 scripts captura saída de nada. `AGENTS.md:7` registra
`python -m pytest` com a observação **"no test files yet"** — o repositório alvo não tem teste
nenhum. As "evals" são asserções de import e de parse de AST
(`.agents/scripts/run_skill_evals.py:224-253`), não bytes de saída + diff de estado
(`docs/PLAYBOOK-REFERENCIA.md:224`).

**Card:** as quatro camadas de caracterização, cada uma um card com gate próprio
(`docs/PLAYBOOK-REFERENCIA.md:212-214`).

### Resumo das lacunas

| # | Lacuna | Existe algo? | Vira card |
|---|---|---|---|
| L1 | Validador de grafo de dependências | não | sim, dia 1 |
| L2 | Sonda negativa de aceitação | parcial (roteamento) | sim, ajustar + estender |
| L3 | Ledger de incerteza | não (só prosa) | sim, card 1 |
| L4 | Estado derivado | não, e já divergiu | sim |
| L5 | Faixas de id | não | sim, antes da 1ª onda |
| L6 | Autoteste dos verificadores | não | sim |
| L7 | Três estados PASS/FAIL/não-exercitado | não | sim |
| L8 | Gate local + fonte única (CI) | não | sim |
| L9 | Propriedade de arquivo | não | sim, antes da 1ª onda |
| L10 | Guarda executável / ADR | declarada, nunca disparada | sim |
| L11 | Barreira de onda por contador | não | sim |
| L12 | Golden master / caracterização | não | sim |

---

## 9. Placar dos claims

Escala do placar: `evidências a favor - evidências contra`, contando execuções e citações
independentes.

| id | Claim (falsificável) | Placar | Rótulo |
|---|---|---|---|
| C01 | `skill_lint.py` não verifica proveniência em nenhum grau; uma skill sem citação alguma sai `0 errors` | 3-0 | CONFIRMADO |
| C02 | `metadata.type` é opcional: omitir a chave passa no linter | 2-0 | CONFIRMADO |
| C03 | O linter só varre um nível (`*/SKILL.md`); skill aninhada com `type` inválido é pulada em silêncio | 2-0 | CONFIRMADO |
| C04 | Não existe token nem TTL no `skill_write_gate.py`; o "token" é um JSON versionado editável à mão | 3-0 | CONFIRMADO |
| C05 | Rodado fora da raiz do repo, o write gate libera escrita numa skill com registro vermelho | 2-0 | CONFIRMADO |
| C06 | Um `SKILL.md` de skill com registro vermelho foi escrito e commitado (`a32c2a4`) | 3-0 | CONFIRMADO |
| C07 | `check_staleness.py` captura o hash e nunca o compara — não detecta deriva, só ausência | 2-0 | CONFIRMADO |
| C08 | 34 de 43 citações do corpus (79%) são invisíveis ao regex de proveniência | 2-0 | CONFIRMADO |
| C09 | Só 3 de 43 citações (7%) resolvem para arquivo existente e são conferidas | 2-0 | CONFIRMADO |
| C10 | A única citação com hash (`manim_executor.py:225@922e47d`) aponta para a linha errada, e já estava errada no commit pinado | 3-0 | CONFIRMADO |
| C11 | `bash_guardrail.py` não bloqueia `rm -rf /`, `rm -rf ~` nem `sudo rm -rf /` | 2-0 | CONFIRMADO |
| C12 | Dos 4 hooks, só o H2 (`exit 2` para `.env`) falha fechado incondicionalmente | 2-0 | CONFIRMADO |
| C13 | O Stop gate escreve `stop_hook_active: true` no arquivo que verifica e se desarma na 2ª tentativa | 2-0 | CONFIRMADO |
| C14 | `run_skill_evals.py` nunca lê um `SKILL.md`; o acoplamento é por chave em `EVAL_FUNCTIONS` | 2-0 | CONFIRMADO |
| C15 | Nenhum script executa o `metadata.verification_signal` declarado nos 6 `SKILL.md` | 2-0 | CONFIRMADO |
| C16 | `all([])` é `True` (`:376`): eval que retorna lista vazia grava `last_eval_passed: true` | 2-0 | CONFIRMADO |
| C17 | Duas das 6 evals são lambdas com `passed: True` literal e nunca podem ficar vermelhas | 2-0 | CONFIRMADO |
| C18 | Nenhum script chama `check_staleness.py`; as 3 menções são prosa | 2-0 | CONFIRMADO |
| C19 | Não há `.github/`, nem CI, nem gate local no repositório alvo | 2-0 | CONFIRMADO |
| C20 | O número "92-140 linhas por skill" de `validation-report.md:145` está errado (`project-router` = 44) | 2-0 | CONFIRMADO |
| C21 | `.eval_records/` é diretório compartilhado sem faixa de id — colide sob N worktrees | 1-0 | PROVÁVEL |
| C22 | Os hooks de `.claude/settings.json` não casam o esquema documentado do Claude Code e por isso não disparam | 2-1 | EM DISPUTA |
| C23 | O `ROUTING_MAP` do teste não é o roteador real, logo 15/15 verde não valida o roteador que roda | 2-0 | CONFIRMADO |

Sobre C22: a favor, a forma de `.claude/settings.json:4-10` (chaves fora do bloco `hooks`,
`"Write||Edit"` com dois pipes, interpolação `${path}`) e a evidência empírica de C06; contra,
não foi possível executar o harness para observar o disparo. Ver §11.

---

## 10. Refutações do panorama

Cada linha: o que a documentação do próprio alvo afirma × o que a execução mostra.

### R1 — "O catálogo é gerado pelo linter"

- **Panorama:** `.agents/skills/catalog.md:4` — *"Auto-generated index of all available skills.
  […] Regenerate with: `python3 .agents/scripts/skill_lint.py` (also validates all skills)."*
- **De fato:** `skill_lint.py` não escreve arquivo nenhum. Suas únicas saídas são `print`
  (`.agents/scripts/skill_lint.py:109`, `121-132`). Não há `write_text`, não há `open(...,"w")`.
  `catalog.md` é redigitado à mão. **É o oposto de estado derivado**
  (`docs/PLAYBOOK-REFERENCIA.md:410-411`).

### R2 — "O linter exige proveniência"

- **Panorama:** `.agents/skills/skill-map.md:134` — *"4. **Provenance format**: every knowledge
  item with `file:line@hash` or `file:line` citation"*, listada como uma das 6 regras que o
  linter "enforces" (`:130`).
- **De fato:** nenhuma linha de `skill_lint.py` procura citação (§1.5, sonda E7:
  skill sem qualquer proveniência → `0 errors`). A regra existe só no documento de desenho.

### R3 — "O linter roda no write-gate antes de qualquer escrita"

- **Panorama:** `.agents/skills/skill-map.md:138` — *"The linter is […] run by the write-gate
  hook before any SKILL.md write is allowed."*
- **De fato:** `skill_write_gate.py` não importa, não invoca e não menciona `skill_lint`. Ele lê
  um JSON e decide (`.agents/scripts/skill_write_gate.py:33-51`). O linter nunca roda no gate.

### R4 — "check_staleness valida as citações do corpus"

- **Panorama:** `.agents/skills/validation-report.md:146` — *"Every knowledge item carries a
  provenance citation like `openai_service.py:100-139`. check_staleness.py validates these."*
- **De fato:** o exemplo dado na própria frase é **exatamente uma das 34 formas que o regex não
  casa** (§5.1). A frase é autorrefutante. E das 9 que casam, 7 saem "File not found" (§5.3).

### R5 — "Os hooks falham fechados, que é o default seguro"

- **Panorama:** `.agents/skills/validation-report.md:191` — *"If these scripts have bugs or are
  deleted, the hooks fail-closed (block the action), which is the safe default."*
- **De fato:** os três scripts falham **abertos** em entrada inesperada (`exit 0`), medido em E3
  e E4. Script deletado é outro caso (aí o `onError: block` valeria), mas script **presente e
  mal alimentado** libera. A afirmação cobre o caso improvável e omite o caso real.

### R6 — "O sistema bloqueia comandos perigosos como `rm -rf /`"

- **Panorama:** `.claude/settings.json:21` — *"Block dangerous bash commands (rm -rf /, history
  rewrite, etc.)"*; `AGENTS.md:30` — *"Hook guardrails: `.claude/settings.json` blocks `.env`
  reads and dangerous bash"*.
- **De fato:** `rm -rf /` sai `0` (E5). O caso literalmente nomeado na descrição é o caso que
  passa.

### R7 — "Aprovado em 12 de 12 critérios de sucesso; pronto para produção"

- **Panorama:** `.agents/skills/validation-report.md:168-181` (12× `PASS`) e `:217-219` —
  *"The knowledge skills system passes all success criteria […] ready for production use."*
- **De fato:** no momento da leitura, 2 das 6 skills têm o portão de escrita **fechado** por
  registro vermelho (§3.5), `check_staleness.py` sai `1` (§5.3), e o critério 11
  ("Deterministic enforcement: skill linter + 3 hooks", `:180`) é contrariado por R2, R3, R5 e
  R6. O relatório é um oráculo que deriva da mesma premissa da implementação
  (`docs/PLAYBOOK-REFERENCIA.md:322-323`).

### R8 — "Skills têm 92-140 linhas, mediana ~110"

- **Panorama:** `.agents/skills/validation-report.md:145`.
- **De fato:** `44, 80, 96, 103, 127, 133` linhas de arquivo. `project-router` = 44, fora da
  faixa. Número em prosa, nunca conferido (`docs/PLAYBOOK-REFERENCIA.md:410-411`).

### R9 — "A verificação externa é imposta no nível do sistema de arquivos"

- **Panorama:** `.agents/skills/validation-report.md:153` — *"The PreToolUse write-gate hook
  enforces this at the filesystem level."*
- **De fato:** o commit `a32c2a4` escreveu um `SKILL.md` com registro vermelho (§2.5). Seja por
  hook não disparado, seja por `${path}` não interpolado, a imposição não ocorreu.

### R10 — "As evals das meta-skills delegam ao linter"

- **Panorama:** `.agents/skills/.eval_records/meta-skill-evolution.json:9` e
  `.agents/skills/.eval_records/meta-skill-consolidate.json:9` — `"detail": "Delegated to
  skill_lint.py"`.
- **De fato:** `.agents/scripts/run_skill_evals.py:339-340` são lambdas que retornam o
  dicionário literal. Não há `subprocess`, não há `import`, não há chamada. O "detail" descreve
  uma delegação que não existe — é uma **fixture fabricada alimentando a própria asserção**
  (`docs/PLAYBOOK-REFERENCIA.md:526`).

### R11 — "O pin de proveniência foi verificado"

- **Panorama:** mensagem do commit `a32c2a4` — *"Tudo verificado com 4 testes reais
  (opengl/cairo/auto/fallback) / Provenance: manim_executor.py:225@922e47d"*, e
  `.agents/skills/manim-rendering/SKILL.md:58`.
- **De fato:** a linha 225 é `"render",` no HEAD **e** em `922e47d`; `--write_to_movie` está na
  233 (§5.5). O que pode ter sido verificado é o comportamento; o **pin** não foi.

---

## 11. Perguntas ao dono

Cinco perguntas cuja resposta depende de mandato ou de ambiente, não de leitura
(`docs/PLAYBOOK-REFERENCIA.md:61-69`). Cada uma vira sign-off nominal e datado ou item de ledger.

1. **Os hooks de `.claude/settings.json` alguma vez dispararam neste ambiente?** Existe log,
   transcrição ou lembrança de ter visto `[SkillGate] BLOCKING` ou `[BashGuard] BLOCKING` na
   tela? A resposta resolve C22 e decide se `.claude/settings.json` é `copiar-com-ajuste` ou
   `não-serve`.
2. **O projeto novo herda o esquema de hooks do 3b1b ou parte do esquema documentado?** Se
   herdar, herda o mesmo silêncio. Precisa de decisão explícita com guarda executável.
3. **Qual é o apetite para gate mecânico sobre memória persistida?** O playbook restringe gate
   mecânico ao irreversível ou auto-amplificante (`docs/PLAYBOOK-REFERENCIA.md:404-405`). Escrita
   em `SKILL.md` é auto-amplificante. Confirma-se gate duro (TTL 30 min, token gitignorado), ou
   nudge?
4. **As evals podem depender de venv?** Hoje 2 de 6 skills estão travadas por
   `pydantic_settings` ausente (`.agents/skills/.eval_records/manim-code-gen.json:9`). Ou o gate
   passa a exigir ambiente provisionado, ou precisa do estado `NÃO-EXERCITADO`. É decisão de
   apetite, não de código.
5. **Existe CI disponível (GitHub Actions, runner local, hook de pre-commit) para o projeto
   novo?** Não há `.github/` no alvo, e a lacuna L8 depende dessa resposta para virar card
   executável em vez de intenção.

---

## 12. Sementes de ledger

Itens no formato do `docs/PLAYBOOK-REFERENCIA.md:449-454`: pergunta · por que a base não responde
· o que se assumiu · **teste que fecha** · o que quebra se a resposta for outra. Ids em faixa
`L02-*` reservada a este cluster, nunca recicladas.

- **L02-001 — Os hooks disparam?** A base não responde porque o harness não é observável a partir
  do repositório. Assumido: **não disparam** (evidência: `a32c2a4`). Fecha com: forçar um `Edit`
  em `.agents/skills/manim-rendering/SKILL.md` sob o harness e observar `exit 2`. Se a resposta
  for outra, C22 cai e R9 é parcialmente reabilitada; o card de reescrita de `settings.json`
  encolhe para ajuste de interpolação.
- **L02-002 — `${path}` é interpolado pelo harness?** Fecha com: hook temporário que grava
  `sys.argv` num arquivo. Se não for interpolado, todo hook que passa argumento no comando é
  no-op — e isso vale para o projeto novo inteiro.
- **L02-003 — Qual a raiz canônica de resolução de caminho?** Quatro scripts usam `Path.cwd()`;
  um usa `__file__`. Assumido: raiz do repo. Fecha com: `git rev-parse --show-toplevel` em todos
  os verificadores + teste que roda cada um a partir de 3 cwd diferentes e exige a mesma saída.
- **L02-004 — Faixa de ids sob N worktrees.** `.eval_records/<skill>.json` é escrito por
  `run_skill_evals.py:352` sem coordenação. Assumido: colide. Fecha com: rodar 2 agentes em
  worktrees distintas gravando o mesmo registro e conferir o merge. Se colidir, L5 e L9 viram
  cards de onda 0.
- **L02-005 — Quantas citações do corpus novo sobrevivem ao regex.** Assumido: se o regex for
  copiado sem ajuste, ~79% ficam mudas (medido no alvo). Fecha com: o próprio linter, com "zero
  citações casadas num arquivo que afirma fatos = ERRO".
- **L02-006 — `manim --version` e `pydantic_settings` estarão disponíveis no gate?** Assumido:
  não, fora do venv. Fecha com: `python3 -c "import pydantic_settings"` e `manim --version` no
  runner de gate. Se não estiverem, o estado `NÃO-EXERCITADO` (L7) deixa de ser refinamento e
  vira pré-requisito.
- **L02-007 — O `verification_signal` é executável como escrito?** Os comandos usam
  `from manim-api.config import ...` (`.agents/skills/fastapi-app/SKILL.md:6`), e `manim-api`
  **não é um identificador Python válido** (hífen). Assumido: os comandos declarados falhariam
  se executados. Fecha com: executar os 6 signals e registrar o código de saída de cada um.
- **L02-008 — Existe CI?** Ver pergunta 5. Fecha com: `ls .github/workflows` no repositório de
  destino.

---

## 13. Não verificado

Afirmações sem citação de arquivo:linha, ou cuja verificação exigiria executar algo que este
agente não executou. Nenhuma delas sustenta conclusão acima.

1. **O esquema de hooks do Claude Code.** A afirmação de que `PreToolUse` exige
   `hooks: [{type: "command", command: ...}]` e entrega payload por stdin JSON vem de
   conhecimento prévio do modelo, **não** de arquivo lido neste repositório. Não há
   documentação do harness em nenhum dos dois repositórios. É a base de C22 (EM DISPUTA) e
   de L02-001/L02-002.
2. **Se `"Write||Edit"` é tratado como regex.** Se for, a alternativa vazia entre os dois pipes
   casaria qualquer ferramenta. Não foi observado.
3. **Comportamento de `run_skill_evals.py` em execução.** Não foi executado (§0, escopo
   negativo). Tudo em §3 e §4 vem de leitura integral do código. A afirmação de que `all([])`
   grava verde é dedução de semântica de Python padrão, não observação.
4. **Se as evals de `manim-code-gen`/`manim-rendering` passam dentro do venv.** Os registros
   vermelhos podem refletir só ambiente. Não foi tentado ativar venv.
5. **Se `L02-007` está certo sobre `from manim-api.config`.** A leitura do hífen como
   identificador inválido é conhecimento de linguagem, não execução.
6. **Intenção autoral.** Nada aqui afirma que os defeitos foram deliberados ou negligentes. O
   inventário registra o que os scripts fazem, não por que foram escritos assim. Onde o
   documento de desenho e o código divergem, ambos estão citados; qual dos dois está "certo" é
   decisão do dono, não achado.
7. **Transferibilidade das evals de domínio.** A classificação de `run_skill_evals.py` (motor)
   como `não-serve` pressupõe que o projeto novo não é um clone do `manim-api`. Se for, boa parte
   das evals de AST parse é reaproveitável direto.
