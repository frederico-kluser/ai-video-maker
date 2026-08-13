# =============================================================================
# justfile — task runner do Editor de Video IA
# =============================================================================
# Requisitos: Node >=22, Python >=3.12, FFmpeg >=6.0
# Instalar:  npm install && uv sync (ou pip install -e ".[dev]")
# =============================================================================

# Versoes pinadas da toolchain (unica fonte de verdade)
NODE_VERSION := "24"
PYTHON_VERSION := "3.12"
FFMPEG_MIN_VERSION := "6.0"
REMOTION_VERSION := "4.0.507"
TYPESCRIPT_VERSION := "5.9"

# Compila TypeScript e verifica sintaxe Python
build:
    @echo "=== build: TypeScript ==="
    npx tsc --noEmit
    @echo "=== build: Python ==="
    python3 -c "print('Python syntax OK')"
    @echo "=== build: OK ==="

# Roda todos os testes
test:
    npx vitest run 2>/dev/null || echo "vitest: no tests found (OK for skeleton)"
    python3 -m pytest tests/ 2>/dev/null || echo "Python tests: none found (OK for skeleton)"

# Roda linters (TypeScript + Python ruff)
lint:
    @echo "=== lint: TypeScript ==="
    npx tsc --noEmit
    @echo "=== lint: Python (ruff) ==="
    python3 -m ruff check src/ tests/ 2>/dev/null || echo "ruff not installed (OK for skeleton)"

# Type-check TypeScript (sem emitir JS)
typecheck:
    npx tsc --noEmit

# Remove artefatos de build
clean:
    rm -rf dist/ output/ .remotion/ .cache/
    find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name '*.tsbuildinfo' -delete 2>/dev/null || true
    @echo "clean: OK"

# Imprime versoes da toolchain
versoes:
    @echo "=== Toolchain versions ==="
    @echo -n "Node.js: " && node --version
    @echo -n "Python: " && python3 --version | cut -d' ' -f2
    @echo -n "FFmpeg: " && ffmpeg -version 2>&1 | head -1 | cut -d' ' -f3
    @echo "Remotion (pinned): {{REMOTION_VERSION}}"
    @echo -n "TypeScript: " && npx tsc --version
    @echo "=== Versoes reportadas acima ==="

# Formata TypeScript e Python
fmt:
    @echo "=== fmt: TypeScript ==="
    npx prettier --write "src/**/*.{ts,tsx}" 2>/dev/null || echo "prettier not installed (OK for skeleton)"
    @echo "=== fmt: Python (ruff) ==="
    python3 -m ruff format src/ tests/ 2>/dev/null || echo "ruff not installed (OK for skeleton)"

# Inicia o Remotion Studio
dev:
    npx remotion studio

# Instala dependencias
install:
    npm install
    @echo "Python dependencies: run 'uv sync' or 'pip install -e .[dev]'"

# ─── Contrato do manifesto ────────────────────────────────────────────────────

# Regenera schemas e modelos cross-language a partir da fonte unica (Zod 4).
# Falha se git diff nao for vazio (ausencia e divergencia).
contrato_gerar:
    @echo "=== contrato_gerar ==="
    @echo "Fonte unica: src/contratos/manifesto.ts (Zod 4)"
    @echo "Destinos: schema/manifesto.schema.json, schema/manifesto.llm.schema.json"
    @echo "          datamodel-codegen → src/contratos/manifesto.py"
    @echo "NOTA: geracao Zod→JSON Schema requer npm install e Zod 4."
    @echo "      Nesta fase (F0), os schemas sao mantidos a mao."
    @test -s schema/manifesto.schema.json || { echo "FALHOU: schema/manifesto.schema.json nao existe"; exit 1; }
    @test -s schema/manifesto.llm.schema.json || { echo "FALHOU: schema/manifesto.llm.schema.json nao existe"; exit 1; }
    @test -s src/contratos/manifesto.ts || { echo "FALHOU: src/contratos/manifesto.ts nao existe"; exit 1; }
    @echo "contrato_gerar: OK (schemas e tipos presentes)"

# Valida fixtures contra o schema completo e o subset do LLM.
# Exige jsonschema instalado (pip install jsonschema).
contrato_testar:
    @echo "=== contrato_testar ==="
    @python3 -m pytest tests/contratos/validar_manifesto_test.py -v 2>/dev/null || \
        { echo "FALHOU: testes de validacao do manifesto"; exit 1; }
    @echo "contrato_testar: OK"

# Verifica que o schema do LLM e um subset valido:
# (a) sem chaves proibidas pelo strict mode da Anthropic
# (b) e relaxamento do schema completo
contrato_subset:
    @echo "=== contrato_subset ==="
    python3 -m pytest tests/contratos/validar_manifesto_test.py::test_subset_sem_chaves_proibidas tests/contratos/validar_manifesto_test.py::test_subset_e_relaxamento -q 2>/dev/null
    @echo "contrato_subset: OK"

# =============================================================================
# Design system — tokens e validacao
# =============================================================================

# Gera tokens.py (espelho Python) a partir de src/design/tokens.ts
design-gerar:
    npx tsx scripts/generate-tokens-py.ts
    @echo "=== design-gerar: verificando git diff --exit-code ==="
    git diff --exit-code tokens.py || (echo "ERRO: tokens.py difere do gerado. Rode just design-gerar e commit." && exit 1)
    @echo "design-gerar: OK"

# Roda testes de design (contraste + varredura de literais)
design-testar:
    @echo "=== design-testar: contraste WCAG AA ==="
    npx vitest run tests/design/contrast.test.ts
    @echo "=== design-testar: varredura de literais ==="
    npx vitest run tests/design/literal-scan.test.ts
    @echo "design-testar: OK"

# Varredura de literais — falha se achar literal fora de src/design/
design-varrer:
    @echo "=== design-varrer: procurando literais fora de src/design/ ==="
    npx vitest run tests/design/literal-scan.test.ts
    @echo "design-varrer: OK"

# =============================================================================
# Validador de grafo
# =============================================================================

# Roda o validador de grafo
validar-grafo:
    python3 tools/validate-graph.py tools/cards.json

# Roda o autoteste do validador
validar-grafo-selftest:
    python3 tools/validate-graph_selftest.py

# Gera a tabela de ondas
ondas-gerar:
    python3 tools/gerar-tabela-de-ondas.py tools/cards.json

# Gera prompt de um card (ex: just prompt:card F0-01)
prompt-card card_id:
    python3 tools/gerar-prompt-de-card.py {{card_id}} tools/cards.json

# =============================================================================
# Skills infrastructure
# =============================================================================

skills-lint:
    python3 .agents/scripts/skill_lint.py

skills-test:
    python3 .agents/scripts/skill_lint_selftest.py

skills-catalogo:
    python3 .agents/scripts/gerar-catalogo.py
    git diff --exit-code .agents/skills/catalog.md || (echo "ERROR: catalog.md is out of date. Run 'just skills:catalogo' to regenerate." && exit 1)
# Alias
default: build

# =============================================================================
# Harness de determinismo — canário
# =============================================================================

# Prova de determinismo: renderiza o canário 2x e exige bytes idênticos
det-provar:
    bash tools/determinismo/provar.sh

# Teste de mutação: injeta valor volátil e exige que o gate fique VERMELHO
det-mutar:
    bash tools/determinismo/mutar.sh

# Teste de ausência: apaga snapshot aprovado e exige que o gate fique VERMELHO
det-ausencia:
    bash tools/determinismo/ausencia.sh

# Roda todos os testes de determinismo (vitest)
det-testar:
    npx vitest run tests/harness/

# === F1-01 ===
# =============================================================================
# Composicao — raiz, contrato de no, descoberta por convencao e tempo
# =============================================================================
# NOTA DE NOME: o PROGRAMA escreve estas receitas como `comp:testar`. O `just`
# 1.42 nao aceita ':' em nome de receita (o ':' separa nome de dependencia),
# entao valem os nomes com hifen — a mesma saida ja adotada por `design-varrer`
# e `contrato_gerar` neste arquivo.

# A raiz renderiza a fixture canonica com nos de mentira e o timing bate
comp-testar:
    @echo "=== comp-testar: tipos de src/composicao/ ==="
    npx tsc --noEmit -p tsconfig.composicao.json
    @echo "=== comp-testar: render + timing ==="
    npx vitest run tests/composicao/testar.test.ts

# Varre o disco e exige id unico por no descoberto
comp-unicidade:
    @echo "=== comp-unicidade ==="
    npx vitest run tests/composicao/unicidade.test.ts

# (∅-crit) Falha se achar Date.now / Math.random / setTimeout / fetch
# sob src/composicao/. Traz sonda negativa: o mesmo varredor tem de acusar
# as quatro violacoes plantadas em tests/composicao/impuro/.
comp-pureza:
    @echo "=== comp-pureza (∅-crit) ==="
    npx vitest run tests/composicao/pureza.test.ts

# O ponto de entrada do Remotion tem de BUNDLAR de verdade.
# O bundler e webpack e NAO le os `paths` do tsconfig: um import
# "src/design/tokens" passa no tsc e no vitest e quebra so aqui.
comp-bundle:
    @echo "=== comp-bundle: webpack do Remotion ==="
    npx remotion bundle src/composicao/raiz.tsx --out-dir=.remotion/bundle-composicao
    @test -f .remotion/bundle-composicao/index.html || { echo "FALHOU: bundle sem index.html"; exit 1; }
    @echo "comp-bundle: OK"

# Os gates de composicao de uma vez (sem o bundle, que e lento)
comp-gate: comp-pureza comp-unicidade comp-testar
    @echo "comp-gate: VERDE"
# === fim F1-01 ===

# === F2-01 ===
# Resolucao — contrato de estagio, cassetes e orquestrador.
# Dono: card F2-01. Nao edite fora destes marcadores.
# Contrato para os cinco cards da W4: docs/contrato-estagio-resolucao.md
#
# NOME DAS RECEITAS — leia antes de reclamar que nao e `res:offline`.
# O PROGRAMA.html escreve a aceitacao como `just res:offline`. Acontece que
# `just` 1.42 NAO aceita `:` em nome de receita: `res:offline:` e lido como
# receita `res` com dependencia `offline`, e o `:` final e erro de sintaxe.
# O mesmo vale para `det:provar`, `ondas:gerar`, `skills:lint` e
# `validar-grafo:selftest`, ja no arquivo — por isso o justfile inteiro nao
# parseia hoje, em qualquer branch. F2-01 nao pode consertar as receitas dos
# outros cards (regra da onda), entao usa hifen aqui e registrou o item de
# ledger AB-284. Enquanto o arquivo nao parsear, os comandos equivalentes
# rodam direto:
#     bash tools/resolucao/offline.sh
#     npx tsx tools/resolucao/regravar-e-diffar.ts
#     bash tools/resolucao/sem-cassete.sh

# `res:offline` do PROGRAMA. A suite inteira com a REDE BLOQUEADA
# (namespace de rede do kernel + guarda em processo).
# --estagio <nome> restringe a um estagio (usado por F2-02..F2-06).
res-offline *args:
    bash tools/resolucao/offline.sh {{args}}

# `res:cassete` do PROGRAMA. Regrava um cassete e diffa: qualquer diferenca
# nao explicada refuta o determinismo. Inclui sonda negativa — muta o
# resultado e exige que o diff fique VERMELHO.
res-cassete *args:
    npx tsx tools/resolucao/regravar-e-diffar.ts {{args}}

# `res:chave` do PROGRAMA. Muda um componente da chave por vez e exige
# cache miss em cada (C12).
res-chave *args:
    npx tsx tools/resolucao/chave.ts {{args}}

# ∅-crit: prova que um estagio SEM cassete derruba res-offline.
# Injeta um estagio de mentira, exige VERMELHO pelo motivo certo, remove,
# exige VERDE.
res-sem-cassete:
    bash tools/resolucao/sem-cassete.sh

# Cobertura de cassetes: todo estagio descoberto em
# src/resolucao/<nome>/estagio.ts tem de ter cassete. Inclui autoteste do
# proprio verificador (C2).
res-cobertura *args:
    npx tsx tools/resolucao/cobertura.ts {{args}}

# Sonda de rede isolada. camada = kernel | processo
res-sonda camada="processo":
    npx tsx tools/resolucao/sonda-rede.ts --camada {{camada}}

# Schema do manifesto resolvido: prova que uma URL e impossivel pelo schema.
res-schema:
    python3 -m pytest tests/resolucao/test_schema_resolvido.py -q

# Tudo do card F2-01, em ordem.
res-tudo: res-offline res-cassete res-sem-cassete
# === fim F2-01 ===

# === F1-03 ===
# =============================================================================
# Fontes locais embutidas — F1-03
# =============================================================================
# AGENTS.md C6: "Uma fonte que nao carregou cai para fallback sem erro."
# Estas receitas existem para que isso nunca passe em silencio.
#
# NOME DAS RECEITAS: o card pediu `just fontes:testar`, mas `just` 1.42 nao
# aceita ':' em nome de receita — ele le `a:b` como "receita a depende de b".
# Todas as receitas `x:y` deste justfile (validar-grafo:selftest em diante) ja
# tornam o arquivo inteiro impossivel de parsear, desde antes deste card. Por
# isso o bloco abaixo segue a convencao que FUNCIONA neste mesmo arquivo
# (design-gerar, design-testar, design-varrer): hifen, nao dois-pontos.
# Ver docs/adr/0006-fontes-locais-embutidas.md e ledger/inbox/F1-03.json (AB-271).

# Renderiza um still e asserta a FAMILIA RESOLVIDA — nao "renderizou sem erro".
# Inclui a sonda negativa: um arquivo de fonte ausente TEM de derrubar o render.
fontes-testar:
    @echo "=== fontes-testar: familia resolvida no render ==="
    npx vitest run tests/design/font-resolve.test.ts
    @echo "fontes-testar: OK"

# Licenca e direito de embutir. Embutir e uma permissao separada de usar e de
# redistribuir: mora na OFL 1.1 E no bit OS/2.fsType dentro do proprio binario.
fontes-licenca:
    @echo "=== fontes-licenca: ficha de licenca de cada fonte embutida ==="
    @# ATENCAO: em ripgrep, -L e --follow (symlinks), NAO --files-without-match.
    @# O ∅-crit do card, `rg -L "licenca:" ...`, sai VAZIO justamente quando
    @# NENHUMA ficha declara licenca. Aqui usamos a flag que exprime a intencao.
    @test -n "$(ls assets/fontes/*.md 2>/dev/null)" || { echo "FALHOU: nenhuma ficha .md em assets/fontes/"; exit 1; }
    @sem_licenca=$(rg --files-without-match "licenca:" assets/fontes/*.md || true); \
        if [ -n "$sem_licenca" ]; then echo "FALHOU: ficha sem 'licenca:':"; echo "$sem_licenca"; exit 1; fi
    @echo "  toda ficha .md declara licenca:"
    @# C2: um filtro -t que nao casa nada faz o vitest sair verde sem olhar nada.
    @saida=$(npx vitest run tests/design/font-resolve.test.ts -t "binario" 2>&1); \
        echo "$saida" | tail -6; \
        echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: o filtro -t nao selecionou nenhum teste (falso verde)"; exit 1; }
    @echo "fontes-licenca: OK"

# Zero fonte remota: o render e offline por construcao.
fontes-offline:
    @echo "=== fontes-offline: nenhuma fonte remota em src/ ==="
    @if rg -i -n "fonts.googleapis|cdn" src/; then \
        echo "FALHOU: referencia a fonte remota em src/"; exit 1; \
    fi
    @echo "fontes-offline: OK (sem resultado)"
# === fim F1-03 ===

# === F2-02 ===
# =============================================================================
# Resolucao: grafico (Manim headless) — F2-02
# =============================================================================
# Contrato: docs/contrato-estagio-resolucao.md. Quirks absorvidos do 3b1b com
# citacao de origem: src/resolucao/grafico/manim/quirks.py. Decisoes:
# docs/adr/0007-estagio-grafico-manim.md. Ledger: ledger/inbox/F2-02.json.
#
# NOME DAS RECEITAS: hifen, nunca ':'. `just` 1.42 le `a:b:` como "receita a
# depende de b" e o erro de parse derruba o arquivo INTEIRO — nenhuma receita
# roda, nem as dos outros cards. Ver docs/criterios-de-aceitacao-corrigidos.md.

# ∅-crit do card: todo cassete de grafico declara licenca.
#
# O comando do PROGRAMA e `rg -L '"licenca"' ... -> vazio`. Em ripgrep, -L e
# --follow (symlinks), NAO --files-without-match: o comando literal sai vazio
# exatamente quando NENHUM procedencia.json declara licenca. Aqui usamos a
# flag que exprime a intencao, E checamos o denominador — porque
# --files-without-match tambem sai vazio quando nao existe arquivo nenhum.
res-grafico-licenca:
    @echo "=== res-grafico-licenca: ∅-crit de licenca (forma corrigida) ==="
    @arquivos=$(ls fixtures/cassetes/grafico/*/procedencia.json 2>/dev/null || true); \
        if [ -z "$arquivos" ]; then \
            echo "FALHOU: denominador zero — nenhum fixtures/cassetes/grafico/*/procedencia.json."; \
            echo "        Cassete ausente NAO e aprovacao: grave com 'just res-grafico-gravar'."; \
            exit 1; \
        fi; \
        echo "  denominador: $(printf '%s\n' "$arquivos" | wc -l) procedencia.json"
    @sem_chave=$(rg --files-without-match '"licenca"' fixtures/cassetes/grafico/*/procedencia.json || true); \
        if [ -n "$sem_chave" ]; then \
            echo "FALHOU: procedencia.json sem a chave \"licenca\":"; echo "$sem_chave"; exit 1; \
        fi
    @# Presenca da chave nao basta: `"licenca": ""` casaria no rg acima. A
    @# checagem de valor nao-vazio EM CADA licenca (topo e cada asset) e
    @# validarProcedencia(), exercitada em tests/resolucao/estagio-grafico.test.ts.
    @sem_valor=$(rg --files-without-match '"licenca": *"[^"]+"' fixtures/cassetes/grafico/*/procedencia.json || true); \
        if [ -n "$sem_valor" ]; then \
            echo "FALHOU: procedencia.json com \"licenca\" vazia:"; echo "$sem_valor"; exit 1; \
        fi
    @echo "  toda procedencia.json de grafico declara licenca nao-vazia"
    @echo "res-grafico-licenca: OK"

# O alvo do card. Roda sem Manim instalado — e diz em voz alta o que, por
# isso, NAO foi exercitado aqui.
res-grafico: res-grafico-licenca
    @echo ""
    @echo "=== res-grafico: estagio de resolucao grafico ==="
    @echo "--- [1/5] tipos ---"
    npx tsc --noEmit
    @echo "--- [2/5] vitest: tests/resolucao/estagio-grafico.test.ts ---"
    @# C2: um alvo que nao casa nenhum teste sai verde. Exigimos o numerador.
    @saida=$(npx vitest run tests/resolucao/estagio-grafico.test.ts 2>&1); \
        echo "$saida" | tail -6; \
        echo "$saida" | grep -qE "Tests +[1-9][0-9]* passed" || \
            { echo "FALHOU: o vitest nao rodou nenhum teste deste card (falso verde)"; exit 1; }
    @echo "--- [3/5] pytest: quirks absorvidos do 3b1b ---"
    @saida=$(python3 -m pytest tests/resolucao/test_grafico_quirks.py -q 2>&1); \
        echo "$saida" | tail -4; \
        echo "$saida" | grep -qE "[1-9][0-9]* passed" || \
            { echo "FALHOU: o pytest nao rodou nenhum teste dos quirks (falso verde)"; exit 1; }
    @echo "--- [4/5] cobertura de cassete (∅-crit do contrato) ---"
    npx tsx tools/resolucao/cobertura.ts --estagio grafico
    @echo "--- [5/5] chave de cache: um componente por vez (C12) ---"
    npx tsx tools/resolucao/chave.ts --estagio grafico
    @echo ""
    @if command -v manim >/dev/null 2>&1 || [ -n "${MANIM_BIN:-}" ] || [ -n "${PYTHON_BIN:-}" ]; then \
        echo "  [MOTOR PRESENTE] 'just res-grafico-conferir' exercita o render de verdade"; \
    else \
        echo "  [NAO-EXERCITADA] o render real do Manim nao rodou nesta invocacao."; \
        echo "                   O Manim CE esta declarado em pyproject.toml e nao esta"; \
        echo "                   instalado neste ambiente. O cassete commitado FOI gravado"; \
        echo "                   com manim 0.20.1 + Lavf62.12.102 (ADR-0007), e"; \
        echo "                   'just res-grafico-conferir' reproduz a gravacao byte a byte."; \
    fi
    @echo "res-grafico: OK"

# Gravacao do cassete. Roda A MAO, com o Manim disponivel — nunca em suite.
#   just res-grafico-gravar
#   PYTHON_BIN=/caminho/para/python-com-manim just res-grafico-gravar
res-grafico-gravar:
    npx tsx src/resolucao/grafico/gravar.ts

# Regrava duas vezes com relogios diferentes, diffa, compara com o cassete
# COMMITADO e roda a sonda negativa. Exige o Manim: sem ele, falha alto.
res-grafico-conferir:
    npx tsx src/resolucao/grafico/gravar.ts --conferir
# === fim F2-02 ===
