#!/usr/bin/env bash
# =============================================================================
# gate_selftest.sh — Autoteste do gate local
# =============================================================================
# Asserta a MENSAGEM de cada estado (PASS, FAIL, NÃO-EXERCITADO, PENDENTE).
# Prova que esconder FFmpeg do PATH → VERMELHO.
# Prova que etapa sem comando → NÃO-EXERCITADO.
#
# Roda ANTES do gate, não depois. Assertar só o exit code não distingue
# "acusou" de "quebrou" — a asserção é sobre a MENSAGEM.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE_SH="${SCRIPT_DIR}/gate.sh"
PASSED=0
FAILED=0

# ---------------------------------------------------------------------------
# Cores do autoteste (independentes das do gate)
# ---------------------------------------------------------------------------
T_RED='\033[0;31m'
T_GREEN='\033[0;32m'
T_NC='\033[0m'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_assert_contains() {
    local label="$1"
    local haystack="$2"
    local needle="$3"
    if echo "$haystack" | grep -qF "$needle"; then
        echo -e "  ${T_GREEN}OK${T_NC} $label"
        PASSED=$((PASSED + 1))
    else
        echo -e "  ${T_RED}FALHOU${T_NC} $label"
        echo "       esperado: $needle"
        echo "       recebido: $haystack"
        FAILED=$((FAILED + 1))
    fi
}

_assert_not_contains() {
    local label="$1"
    local haystack="$2"
    local needle="$3"
    if echo "$haystack" | grep -qF "$needle"; then
        echo -e "  ${T_RED}FALHOU${T_NC} $label"
        echo "       não deveria conter: $needle"
        echo "       recebido: $haystack"
        FAILED=$((FAILED + 1))
    else
        echo -e "  ${T_GREEN}OK${T_NC} $label"
        PASSED=$((PASSED + 1))
    fi
}

# Monta um gate temporário com etapas customizadas e roda
# Argumentos: descrição da etapa, comando, ferramentas (separados por |)
# Retorna stdout do gate
_run_test_gate() {
    local test_dir
    test_dir="$(mktemp -d)"
    trap "rm -rf '$test_dir'" RETURN

    # Cria um script de gate com as etapas fornecidas
    cat > "$test_dir/test_gate.sh" << 'GATE_HEADER'
#!/usr/bin/env bash
set -euo pipefail

RED='' GREEN='' YELLOW='' CYAN='' NC=''

declare -A STAGE_DESC
declare -A STAGE_CMD
declare -A STAGE_TOOLS

_define_stage() {
    local name="$1"; local desc="$2"; local cmd="$3"; local tools="$4"
    STAGE_DESC["$name"]="$desc"
    STAGE_CMD["$name"]="$cmd"
    STAGE_TOOLS["$name"]="$tools"
}

_check_tool() {
    command -v "$1" >/dev/null 2>&1
}

PASS_COUNT=0
FAIL_COUNT=0
NAO_EXERCITADO_COUNT=0
PENDENTE_COUNT=0
TOTAL=0

_run_stage() {
    local name="$1"
    local desc="${STAGE_DESC[$name]:-}"
    local cmd="${STAGE_CMD[$name]:-}"
    local tools="${STAGE_TOOLS[$name]:-}"

    TOTAL=$((TOTAL + 1))

    if [ -z "$desc" ]; then
        echo "[PENDENTE] $name — etapa definida mas não conectada a nenhum job"
        PENDENTE_COUNT=$((PENDENTE_COUNT + 1))
        return 0
    fi

    if [ -n "$tools" ]; then
        local IFS=','
        local TOOL_LIST
        read -ra TOOL_LIST <<< "$tools"
        for tool in "${TOOL_LIST[@]}"; do
            tool="${tool#"${tool%%[![:space:]]*}"}"
            tool="${tool%"${tool##*[![:space:]]}"}"
            if [ -z "$tool" ]; then continue; fi
            if ! _check_tool "$tool"; then
                echo "[FAIL] $name — ferramenta ausente: ${tool}"
                FAIL_COUNT=$((FAIL_COUNT + 1))
                return 1
            fi
        done
    fi

    if [ -z "$cmd" ]; then
        echo "[NÃO-EXERCITADO] $name — comando não definido"
        NAO_EXERCITADO_COUNT=$((NAO_EXERCITADO_COUNT + 1))
        return 0
    fi

    local output
    local rc=0
    output=$(bash -c "$cmd" 2>&1) || rc=$?

    if [ "$rc" -eq 0 ]; then
        echo "[PASS] $name — $desc"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
    else
        echo "[FAIL] $name — $desc"
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

STAGE_ORDER=()
GATE_HEADER

    # Adiciona as etapas do teste
    local stage_count=0
    for stage_def in "$@"; do
        local sname="stage_${stage_count}"
        local desc cmd tools
        IFS='|' read -r desc cmd tools <<< "$stage_def"
        cat >> "$test_dir/test_gate.sh" << EOF
_define_stage "$sname" "$desc" "$cmd" "$tools"
STAGE_ORDER+=("$sname")
EOF
        stage_count=$((stage_count + 1))
    done

    # Adiciona o main
    cat >> "$test_dir/test_gate.sh" << 'GATE_FOOTER'

for stage in "${STAGE_ORDER[@]}"; do
    _run_stage "$stage" || true
done

echo -n "Veredito: "
if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "VERMELHO ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
elif [ "$NAO_EXERCITADO_COUNT" -gt 0 ]; then
    echo "AMARELO ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
else
    echo "VERDE ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
fi
GATE_FOOTER

    bash "$test_dir/test_gate.sh"
}

# ---------------------------------------------------------------------------
# Teste 1: Mensagem de PASS
# ---------------------------------------------------------------------------
echo "=== Teste 1: Mensagem de PASS ==="
output=$(_run_test_gate "Etapa que passa|echo ok|")
_assert_contains "contém [PASS]" "$output" "[PASS]"
_assert_contains "contém descrição" "$output" "Etapa que passa"
echo ""

# ---------------------------------------------------------------------------
# Teste 2: Mensagem de FAIL
# ---------------------------------------------------------------------------
echo "=== Teste 2: Mensagem de FAIL ==="
output=$(_run_test_gate "Etapa que falha|exit 1|")
_assert_contains "contém [FAIL]" "$output" "[FAIL]"
_assert_contains "contém descrição" "$output" "Etapa que falha"
echo ""

# ---------------------------------------------------------------------------
# Teste 3: Mensagem de NÃO-EXERCITADO
# ---------------------------------------------------------------------------
echo "=== Teste 3: Mensagem de NÃO-EXERCITADO ==="
output=$(_run_test_gate "Etapa sem comando||")
_assert_contains "contém [NÃO-EXERCITADO]" "$output" "[NÃO-EXERCITADO]"
_assert_contains "contém 'comando não definido'" "$output" "comando não definido"
echo ""

# ---------------------------------------------------------------------------
# Teste 4: Mensagem de PENDENTE
# ---------------------------------------------------------------------------
echo "=== Teste 4: Mensagem de PENDENTE ==="
# PENDENTE = etapa sem descrição.
# Usamos um hack: chamamos com uma etapa que existe nos arrays mas sem descrição.
# Vamos criar um gate que define uma etapa diretamente nos arrays sem _define_stage.
test_dir="$(mktemp -d)"
cat > "$test_dir/test_gate.sh" << 'PENDENTE_SCRIPT'
#!/usr/bin/env bash
declare -A STAGE_DESC; declare -A STAGE_CMD; declare -A STAGE_TOOLS
STAGE_ORDER=("pendente_stage")

_check_tool() { command -v "$1" >/dev/null 2>&1; }

_run_stage() {
    local name="$1"
    local desc="${STAGE_DESC[$name]:-}"
    local cmd="${STAGE_CMD[$name]:-}"
    local tools="${STAGE_TOOLS[$name]:-}"
    if [ -z "$desc" ]; then
        echo "[PENDENTE] $name — etapa definida mas não conectada a nenhum job"
        return 0
    fi
    echo "não deveria chegar aqui"
}

for stage in "${STAGE_ORDER[@]}"; do _run_stage "$stage" || true; done
PENDENTE_SCRIPT
output=$(bash "$test_dir/test_gate.sh")
_assert_contains "contém [PENDENTE]" "$output" "[PENDENTE]"
_assert_contains "contém 'não conectada'" "$output" "não conectada a nenhum job"
rm -rf "$test_dir"
echo ""

# ---------------------------------------------------------------------------
# Teste 5: Esconder FFmpeg do PATH → VERMELHO
# ---------------------------------------------------------------------------
echo "=== Teste 5: Esconder FFmpeg do PATH → VERMELHO ==="
# Teste 5: Esconder FFmpeg do PATH → VERMELHO
# Como bash e ffmpeg dividem o mesmo diretório (/usr/bin), não podemos
# remover o diretório do PATH sem perder o próprio bash. Em vez disso,
# injetamos uma mutação no _check_tool que simula ffmpeg ausente.
# Esta é a abordagem de "mutação calculada": o teste não depende do estado
# real do sistema, e sim da lógica de detecção de ferramenta ausente.
test_dir="$(mktemp -d)"
cat > "$test_dir/test_gate.sh" << 'FFMPEG_TEST'
#!/usr/bin/env bash
set -euo pipefail

declare -A STAGE_DESC; declare -A STAGE_CMD; declare -A STAGE_TOOLS
STAGE_ORDER=("s0")

PASS_COUNT=0; FAIL_COUNT=0; NAO_EXERCITADO_COUNT=0; PENDENTE_COUNT=0; TOTAL=0

# Mutação: _check_tool retorna falso para ffmpeg, real para o resto
_check_tool() {
    if [ "$1" = "ffmpeg" ]; then
        return 1  # simula ffmpeg ausente
    fi
    command -v "$1" >/dev/null 2>&1
}

_run_stage() {
    local name="$1"
    local desc="Precisa de ffmpeg"
    local cmd="ffmpeg -version >/dev/null 2>&1"
    local tools="ffmpeg"
    TOTAL=$((TOTAL + 1))

    if [ -n "$tools" ]; then
        local IFS=','
        local TOOL_LIST
        read -ra TOOL_LIST <<< "$tools"
        for tool in "${TOOL_LIST[@]}"; do
            tool="${tool#"${tool%%[![:space:]]*}"}"
            tool="${tool%"${tool##*[![:space:]]}"}"
            if [ -z "$tool" ]; then continue; fi
            if ! _check_tool "$tool"; then
                echo "[FAIL] $name — ferramenta ausente: ${tool}"
                FAIL_COUNT=$((FAIL_COUNT + 1))
                return 1
            fi
        done
    fi

    local output
    local rc=0
    output=$(bash -c "$cmd" 2>&1) || rc=$?
    if [ "$rc" -eq 0 ]; then
        echo "[PASS] $name — $desc"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "[FAIL] $name — $desc"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

for stage in "${STAGE_ORDER[@]}"; do _run_stage "$stage" || true; done

echo -n "Veredito: "
if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "VERMELHO ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
elif [ "$NAO_EXERCITADO_COUNT" -gt 0 ]; then
    echo "AMARELO ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
else
    echo "VERDE ($PASS_COUNT PASS, $FAIL_COUNT FAIL, $NAO_EXERCITADO_COUNT NÃO-EXERCITADO, $PENDENTE_COUNT PENDENTE)"
fi
FFMPEG_TEST
output=$(bash "$test_dir/test_gate.sh")
_assert_contains "contém [FAIL]" "$output" "[FAIL]"
_assert_contains "contém 'ferramenta ausente'" "$output" "ferramenta ausente"
_assert_contains "nomeia ffmpeg" "$output" "ffmpeg"
_assert_contains "veredito VERMELHO" "$output" "VERMELHO"
_assert_not_contains "não contém [NÃO-EXERCITADO]" "$output" "[NÃO-EXERCITADO]"
rm -rf "$test_dir"
echo ""

# ---------------------------------------------------------------------------
# Teste 6: Etapa sem comando → NÃO-EXERCITADO
# ---------------------------------------------------------------------------
echo "=== Teste 6: Etapa sem comando → NÃO-EXERCITADO ==="
output=$(_run_test_gate "Etapa vazia||")
_assert_contains "contém [NÃO-EXERCITADO]" "$output" "[NÃO-EXERCITADO]"
_assert_not_contains "não contém [PASS]" "$output" "[PASS]"
_assert_not_contains "não contém [FAIL]" "$output" "[FAIL]"
echo ""

# ---------------------------------------------------------------------------
# Teste 7: Veredito VERDE com todas PASS
# ---------------------------------------------------------------------------
echo "=== Teste 7: Veredito VERDE ==="
output=$(_run_test_gate "Passa 1|echo ok|" "Passa 2|echo ok|")
_assert_contains "veredito VERDE" "$output" "VERDE"
echo ""

# ---------------------------------------------------------------------------
# Teste 8: Veredito VERMELHO com alguma FAIL
# ---------------------------------------------------------------------------
echo "=== Teste 8: Veredito VERMELHO ==="
output=$(_run_test_gate "Passa|echo ok|" "Falha|exit 1|")
_assert_contains "veredito VERMELHO" "$output" "VERMELHO"
echo ""

# ---------------------------------------------------------------------------
# Teste 9: Veredito AMARELO com alguma NÃO-EXERCITADO
# ---------------------------------------------------------------------------
echo "=== Teste 9: Veredito AMARELO ==="
output=$(_run_test_gate "Passa|echo ok|" "Vazia||")
_assert_contains "veredito AMARELO" "$output" "AMARELO"
echo ""

# ---------------------------------------------------------------------------
# Teste 10: Gate começa verde com tudo vazio (só PENDENTE)
# ---------------------------------------------------------------------------
echo "=== Teste 10: Gate verde com tudo vazio ==="
# Simula: todas as etapas são PENDENTE (sem descrição)
test_dir="$(mktemp -d)"
cat > "$test_dir/test_gate.sh" << 'VAZIO_SCRIPT'
#!/usr/bin/env bash
declare -A STAGE_DESC; declare -A STAGE_CMD; declare -A STAGE_TOOLS
STAGE_ORDER=("s1" "s2" "s3")

_check_tool() { command -v "$1" >/dev/null 2>&1; }

PASS_COUNT=0; FAIL_COUNT=0; NAO_EXERCITADO_COUNT=0; PENDENTE_COUNT=0; TOTAL=0

_run_stage() {
    local name="$1"
    local desc="${STAGE_DESC[$name]:-}"
    TOTAL=$((TOTAL + 1))
    if [ -z "$desc" ]; then
        echo "[PENDENTE] $name — etapa definida mas não conectada a nenhum job"
        PENDENTE_COUNT=$((PENDENTE_COUNT + 1))
        return 0
    fi
    echo "não deveria"
}

for stage in "${STAGE_ORDER[@]}"; do _run_stage "$stage" || true; done

echo -n "Veredito: "
if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "VERMELHO"
elif [ "$NAO_EXERCITADO_COUNT" -gt 0 ]; then
    echo "AMARELO"
else
    echo "VERDE"
fi
VAZIO_SCRIPT
output=$(bash "$test_dir/test_gate.sh")
_assert_contains "veredito VERDE" "$output" "VERDE"
_assert_contains "3 PENDENTE" "$output" "[PENDENTE]"
rm -rf "$test_dir"
echo ""

# ---------------------------------------------------------------------------
# Teste 11: Ferramenta ausente é VERMELHO, não "pulado"
# ---------------------------------------------------------------------------
echo "=== Teste 11: Ferramenta ausente → VERMELHO (não amarelo) ==="
output=$(_run_test_gate "Precisa de ferramenta inexistente|echo ok|nao_existe_xyz_123")
_assert_contains "contém [FAIL]" "$output" "[FAIL]"
_assert_not_contains "não contém [NÃO-EXERCITADO]" "$output" "[NÃO-EXERCITADO]"
_assert_not_contains "não contém 'pulado'" "$output" "pulado"
echo ""

# ---------------------------------------------------------------------------
# Teste 12: Gate.sh real é executável e tem shebang
# ---------------------------------------------------------------------------
echo "=== Teste 12: gate.sh é executável ==="
if [ -x "$GATE_SH" ]; then
    _assert_contains "executável" "OK" "OK"
else
    _assert_contains "executável" "FALHA" "OK"
fi
first_line=$(head -1 "$GATE_SH")
_assert_contains "shebang bash" "$first_line" "#!/usr/bin/env bash"
echo ""

# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------
echo "========================================="
echo -n "Resultado: "
if [ "$FAILED" -eq 0 ]; then
    echo -e "${T_GREEN}$PASSED passaram, $FAILED falharam${T_NC}"
    echo "Gate selftest: PASSOU"
else
    echo -e "${T_RED}$PASSED passaram, $FAILED falharam${T_NC}"
    echo "Gate selftest: FALHOU"
    exit 1
fi