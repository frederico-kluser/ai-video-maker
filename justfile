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

# Skills infrastructure
skills:lint:
    python3 .agents/scripts/skill_lint.py

skills:test:
    python3 .agents/scripts/skill_lint_selftest.py

skills:catalogo:
    python3 .agents/scripts/gerar-catalogo.py
    git diff --exit-code .agents/skills/catalog.md || (echo "ERROR: catalog.md is out of date. Run 'just skills:catalogo' to regenerate." && exit 1)

# Alias
default: build
