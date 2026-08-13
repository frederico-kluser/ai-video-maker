#!/usr/bin/env bash
# =============================================================================
# no-lista: ∅-crit — apagar um snapshot aprovado TEM de ficar vermelho
# =============================================================================
# Card: F1-06
#
# Tres mutacoes, cada uma com o seu vermelho exigido e a restauracao no fim:
#
#   1. APAGA um snapshot aprovado         -> suite VERMELHA por "SNAPSHOT AUSENTE"
#   2. CORROMPE um snapshot aprovado      -> suite VERMELHA por divergencia
#   3. CRIA arquivo NAO RASTREADO no dir  -> `git status --porcelain` nao-vazio
#
# A terceira existe por causa de AGENTS.md C3: `git diff --exit-code` nao
# enxerga arquivo nao rastreado. Sozinho, ele aprovaria um snapshot que nunca
# entrou no git — e o proximo agente nao teria com que comparar.
#
# Uso: bash tools/no-lista/ausencia.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

DIR_APROVADO="fixtures/snapshots/no-lista"
SUITE="tests/composicao/no-lista.test.ts"
ALVO="$DIR_APROVADO/vinte-itens.html"
INTRUSO="$DIR_APROVADO/nao-rastreado.html"
TEMP="$(mktemp -d)"

restaurar() {
    if [ -f "$TEMP/alvo" ]; then
        cp "$TEMP/alvo" "$ALVO"
    fi
    rm -f "$INTRUSO"
    rm -rf "$TEMP"
}
trap restaurar EXIT

echo "=== no-lista ∅-crit: ausencia e corrupcao de snapshot ==="
echo ""

# ---------------------------------------------------------------------------
# Pre-condicao: tem de haver snapshot para apagar (denominador zero, C2)
# ---------------------------------------------------------------------------
if [ ! -d "$DIR_APROVADO" ] || [ -z "$(ls -A "$DIR_APROVADO" 2>/dev/null)" ]; then
    echo "PRE-CONDICAO FALHOU: $DIR_APROVADO vazio ou inexistente."
    echo "Rode 'just no-lista-aprovar' antes — sem snapshot nao ha o que apagar,"
    echo "e um teste de ausencia sobre o vazio e verde sem oraculo."
    echo ""
    echo "=== VERMELHO: nada a testar ==="
    exit 1
fi
if [ ! -f "$ALVO" ]; then
    echo "PRE-CONDICAO FALHOU: $ALVO nao existe."
    echo "=== VERMELHO: nada a testar ==="
    exit 1
fi
cp "$ALVO" "$TEMP/alvo"
echo "Snapshot alvo: $ALVO"
echo ""

# ---------------------------------------------------------------------------
# Controle positivo: com tudo no lugar, a suite passa
# ---------------------------------------------------------------------------
echo "[0/3] controle positivo — a suite passa com os snapshots no lugar"
if ! npx vitest run "$SUITE" > "$TEMP/verde.log" 2>&1; then
    echo "  FALHOU: a suite ja esta vermelha ANTES de qualquer mutacao."
    tail -20 "$TEMP/verde.log"
    echo ""
    echo "=== VERMELHO: base suja ==="
    exit 1
fi
echo "  VERDE, como esperado"
echo ""

# ---------------------------------------------------------------------------
# Mutacao 1 — apagar o snapshot aprovado
# ---------------------------------------------------------------------------
echo "[1/3] apagando $ALVO"
rm "$ALVO"
if npx vitest run "$SUITE" > "$TEMP/apagado.log" 2>&1; then
    echo "  FALHOU: a suite passou COM O SNAPSHOT APAGADO."
    echo "  O gate esta cego: ausencia esta sendo lida como 'nada a comparar'."
    echo ""
    echo "=== VERMELHO: gate cego para ausencia ==="
    exit 1
fi
if ! grep -q "SNAPSHOT AUSENTE" "$TEMP/apagado.log"; then
    echo "  FALHOU: ficou vermelho, mas nao pelo motivo certo."
    echo "  Esperado 'SNAPSHOT AUSENTE' na saida. Saida real:"
    tail -20 "$TEMP/apagado.log"
    echo ""
    echo "=== VERMELHO: vermelho pelo motivo errado ==="
    exit 1
fi
echo "  VERMELHO pelo motivo certo (SNAPSHOT AUSENTE)"
cp "$TEMP/alvo" "$ALVO"
echo ""

# ---------------------------------------------------------------------------
# Mutacao 2 — corromper o snapshot aprovado
# ---------------------------------------------------------------------------
echo "[2/3] corrompendo $ALVO (um item a mais no atributo data-itens)"
sed -i 's/data-itens="20"/data-itens="21"/' "$ALVO"
if ! grep -q 'data-itens="21"' "$ALVO"; then
    echo "  FALHOU: a mutacao nao foi aplicada — o sed nao casou o padrao."
    exit 1
fi
if npx vitest run "$SUITE" > "$TEMP/corrompido.log" 2>&1; then
    echo "  FALHOU: a suite passou com o snapshot CORROMPIDO."
    echo ""
    echo "=== VERMELHO: gate cego para divergencia ==="
    exit 1
fi
echo "  VERMELHO, como esperado"
cp "$TEMP/alvo" "$ALVO"
echo ""

# ---------------------------------------------------------------------------
# Mutacao 3 — arquivo nao rastreado no diretorio aprovado (C3)
# ---------------------------------------------------------------------------
echo "[3/3] criando arquivo nao rastreado em $DIR_APROVADO"
printf 'snapshot que nunca entrou no git\n' > "$INTRUSO"
if git diff --exit-code "$DIR_APROVADO" > /dev/null 2>&1; then
    echo "  git diff --exit-code: VERDE (era esperado — ele nao ve nao rastreado)"
else
    echo "  FALHOU: git diff acusou algo que nao deveria ver aqui."
    exit 1
fi
SUJEIRA="$(git status --porcelain -- "$DIR_APROVADO")"
if [ -z "$SUJEIRA" ]; then
    echo "  FALHOU: git status --porcelain saiu VAZIO com arquivo nao rastreado."
    echo "  A combinacao diff+status nao esta pegando C3."
    echo ""
    echo "=== VERMELHO: gate cego para arquivo nao rastreado ==="
    exit 1
fi
echo "  git status --porcelain acusou: $SUJEIRA"
rm -f "$INTRUSO"
echo ""

# ---------------------------------------------------------------------------
# Restauracao provada
# ---------------------------------------------------------------------------
echo "restaurando e reconferindo..."
if ! npx vitest run "$SUITE" > "$TEMP/final.log" 2>&1; then
    echo "  FALHOU: a suite continua vermelha depois da restauracao."
    tail -20 "$TEMP/final.log"
    exit 1
fi
echo "  VERDE de novo"
echo ""
echo "=== VERDE: ausencia, corrupcao e arquivo nao rastreado ficam VERMELHOS ==="
