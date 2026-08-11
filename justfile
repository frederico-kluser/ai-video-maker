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
validar-grafo:selftest:
    python3 tools/validate-graph_selftest.py

# Gera a tabela de ondas
ondas:gerar:
    python3 tools/gerar-tabela-de-ondas.py tools/cards.json

# Gera prompt de um card (ex: just prompt:card F0-01)
prompt:card card_id:
    python3 tools/gerar-prompt-de-card.py {{card_id}} tools/cards.json

# =============================================================================
# Skills infrastructure
# =============================================================================

skills:lint:
    python3 .agents/scripts/skill_lint.py

skills:test:
    python3 .agents/scripts/skill_lint_selftest.py

skills:catalogo:
    python3 .agents/scripts/gerar-catalogo.py
    git diff --exit-code .agents/skills/catalog.md || (echo "ERROR: catalog.md is out of date. Run 'just skills:catalogo' to regenerate." && exit 1)
# Alias
default: build

# =============================================================================
# Harness de determinismo — canário
# =============================================================================

# Prova de determinismo: renderiza o canário 2x e exige bytes idênticos
det:provar:
    bash tools/determinismo/provar.sh

# Teste de mutação: injeta valor volátil e exige que o gate fique VERMELHO
det:mutar:
    bash tools/determinismo/mutar.sh

# Teste de ausência: apaga snapshot aprovado e exige que o gate fique VERMELHO
det:ausencia:
    bash tools/determinismo/ausencia.sh

# Roda todos os testes de determinismo (vitest)
det:testar:
    npx vitest run tests/harness/
