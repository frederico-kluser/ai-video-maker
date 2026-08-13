#!/usr/bin/env bash
# =============================================================================
# gate.sh — Gate local executável do Editor de Vídeo IA
# =============================================================================
# Uma etapa por job do CI. Três estados: PASS, FAIL, NÃO-EXERCITADO.
# Ferramenta ausente é VERMELHO, não "pulado".
# Gate começa verde com tudo vazio.
#
# Uso:
#   bash tools/gate.sh              # Saída com cores no terminal
#   bash tools/gate.sh --no-color   # Saída sem cores ANSI
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Cores ANSI (desligadas com --no-color)
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--no-color" ]]; then
    RED='' GREEN='' YELLOW='' CYAN='' NC=''
else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    CYAN='\033[0;36m'
    NC='\033[0m'
fi

# ---------------------------------------------------------------------------
# Estado global
# ---------------------------------------------------------------------------
PASS_COUNT=0
FAIL_COUNT=0
NAO_EXERCITADO_COUNT=0
PENDENTE_COUNT=0
TOTAL=0

# ---------------------------------------------------------------------------
# Definição de etapas
# ---------------------------------------------------------------------------
# Cada etapa: nome, descrição, comando, ferramentas (separadas por vírgula)
# - Etapa sem descrição → PENDENTE (definida mas não conectada a job)
# - Ferramenta ausente → FAIL
# - Comando vazio → NÃO-EXERCITADO
# - Comando executado → PASS ou FAIL

declare -A STAGE_DESC
declare -A STAGE_CMD
declare -A STAGE_TOOLS

_define_stage() {
    local name="$1"
    local desc="$2"
    local cmd="$3"
    local tools="$4"
    STAGE_DESC["$name"]="$desc"
    STAGE_CMD["$name"]="$cmd"
    STAGE_TOOLS["$name"]="$tools"
}

# --- Etapas ativas (mapeadas para jobs do CI) ---
_define_stage "build" \
    "Compila TypeScript e verifica sintaxe Python" \
    "npx tsc --noEmit && python3 -c 'print(\"Python syntax OK\")'" \
    "node,python3"

_define_stage "test" \
    "Roda todos os testes (vitest + pytest)" \
    '{
        # FALSO-VERDE corrigido: o `;` entre os dois runners fazia o exit code
        # do comando composto ser apenas o do pytest, engolindo falha do vitest
        # (classe C2 — runner que nao reprova). Agora cada rc e capturado e a
        # falha de QUALQUER um dos dois deixa o gate vermelho, com os dois
        # rodando (nao usar `&&` puro, que abortaria o pytest quando o vitest
        # falhasse). A saida de falha mostra qual runner caiu, na ordem certa.
        rc1=0; rc2=0
        saida1=$(npx vitest run 2>/dev/null); rc1=$?
        saida2=$(python3 -m pytest tests/ 2>/dev/null); rc2=$?
        [ "$rc1" -ne 0 ] && echo "VITEST falhou (rc=$rc1)"
        [ "$rc2" -ne 0 ] && echo "PYTEST falhou (rc=$rc2)"
        if [ "$rc1" -ne 0 ] || [ "$rc2" -ne 0 ]; then
            printf "%s\n" "$saida1" "$saida2" | grep -v "^$" | head -30
        fi
        [ "$rc1" -eq 0 ] && [ "$rc2" -eq 0 ]
    }' \
    "node,python3"

_define_stage "lint" \
    "Roda linters (TypeScript + Python ruff)" \
    "npx tsc --noEmit && python3 -m ruff check src/ tests/ 2>/dev/null" \
    "node,python3"

_define_stage "typecheck" \
    "Type-check TypeScript (sem emitir JS)" \
    "npx tsc --noEmit" \
    "node"

_define_stage "versoes" \
    "Reporta versões da toolchain (node, python, ffmpeg)" \
    "node --version >/dev/null && python3 --version >/dev/null && ffmpeg -version 2>&1 | head -1 >/dev/null" \
    "node,python3,ffmpeg"

# Ordem de execução das etapas
STAGE_ORDER=("build" "test" "lint" "typecheck" "versoes")

# ---------------------------------------------------------------------------
# Funções de verificação
# ---------------------------------------------------------------------------

# Verifica se uma ferramenta está disponível no PATH
_check_tool() {
    local tool="$1"
    command -v "$tool" >/dev/null 2>&1
}

# Executa uma etapa e retorna o estado
# stdout: linha de status com cor
# return: 0=PASS/NÃO-EXERCITADO/PENDENTE, 1=FAIL
_run_stage() {
    local name="$1"
    local desc="${STAGE_DESC[$name]:-}"
    local cmd="${STAGE_CMD[$name]:-}"
    local tools="${STAGE_TOOLS[$name]:-}"

    TOTAL=$((TOTAL + 1))

    # --- Etapa sem descrição → PENDENTE ---
    if [ -z "$desc" ]; then
        echo -e "${CYAN}[PENDENTE]${NC} $name — etapa definida mas não conectada a nenhum job"
        PENDENTE_COUNT=$((PENDENTE_COUNT + 1))
        return 0
    fi

    # --- Verifica ferramentas antes de tudo ---
    if [ -n "$tools" ]; then
        local IFS=','
        local TOOL_LIST
        read -ra TOOL_LIST <<< "$tools"
        for tool in "${TOOL_LIST[@]}"; do
            tool="${tool#"${tool%%[![:space:]]*}"}"  # trim left
            tool="${tool%"${tool##*[![:space:]]}"}"  # trim right
            if [ -z "$tool" ]; then
                continue
            fi
            if ! _check_tool "$tool"; then
                echo -e "${RED}[FAIL]${NC} $name — ferramenta ausente: ${RED}${tool}${NC}"
                FAIL_COUNT=$((FAIL_COUNT + 1))
                return 1
            fi
        done
    fi

    # --- Etapa sem comando → NÃO-EXERCITADO ---
    if [ -z "$cmd" ]; then
        echo -e "${YELLOW}[NÃO-EXERCITADO]${NC} $name — comando não definido"
        NAO_EXERCITADO_COUNT=$((NAO_EXERCITADO_COUNT + 1))
        return 0
    fi

    # --- Executa o comando ---
    local output
    local rc=0
    output=$(bash -c "$cmd" 2>&1) || rc=$?

    if [ "$rc" -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $name — $desc"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name — $desc"
        # Imprime as primeiras 5 linhas da saída de erro
        local line_count=0
        while IFS= read -r line; do
            echo "       $line"
            line_count=$((line_count + 1))
            [ "$line_count" -ge 5 ] && break
        done <<< "$output"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# ---------------------------------------------------------------------------
# Execução principal
# ---------------------------------------------------------------------------
_run_gate() {
    echo "=== Gate Local — Editor de Vídeo IA ==="
    echo ""

    for stage in "${STAGE_ORDER[@]}"; do
        _run_stage "$stage" || true  # não aborta no primeiro FAIL
    done

    echo ""
    echo "---"
    echo -n "Veredito: "

    if [ "$FAIL_COUNT" -gt 0 ]; then
        echo -e "${RED}VERMELHO${NC} ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
        return 1
    elif [ "$NAO_EXERCITADO_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}AMARELO${NC} ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
        return 0
    else
        echo -e "${GREEN}VERDE${NC} ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
        return 0
    fi
}

# Se executado diretamente (não sourced), roda o gate
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    _run_gate
fi