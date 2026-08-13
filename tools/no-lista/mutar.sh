#!/usr/bin/env bash
# =============================================================================
# no-lista: sondas negativas sobre o COMPONENTE
# =============================================================================
# Card: F1-06
#
# "O smoke passaria com o componente devolvendo um quadro vazio?" — a unica
# resposta que vale e uma mutacao. Aqui sao tres, cada uma atacando uma
# afirmacao diferente do card:
#
#   1. QUADRO VAZIO      — o componente devolve null sempre.
#                          Se a suite passar, ela nao esta olhando o conteudo.
#   2. SAFE AREA ZERADA  — a margem da safe area vira 0.
#                          Se a suite passar, "dentro da safe area" era uma
#                          assercao do plano contra o proprio plano.
#   3. PISO DE FONTE 1px — o ajuste pode encolher ate 1px.
#                          Se a suite passar, "falha em vez de encolher" e
#                          so uma frase no comentario.
#
# O arquivo mutado e restaurado em qualquer saida (trap).
#
# Uso: bash tools/no-lista/mutar.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

ALVO="src/composicao/nos/lista.tsx"
SUITE="tests/composicao/no-lista.test.ts"
TEMP="$(mktemp -d)"

restaurar() {
    if [ -f "$TEMP/lista.tsx" ]; then
        cp "$TEMP/lista.tsx" "$ALVO"
    fi
    rm -rf "$TEMP"
}
trap restaurar EXIT

cp "$ALVO" "$TEMP/lista.tsx"

echo "=== no-lista: sondas negativas sobre o componente ==="
echo ""

# ---------------------------------------------------------------------------
# Controle positivo
# ---------------------------------------------------------------------------
echo "[0/3] controle positivo — a suite passa com o componente intacto"
if ! npx vitest run "$SUITE" > "$TEMP/verde.log" 2>&1; then
    echo "  FALHOU: a suite ja esta vermelha ANTES de qualquer mutacao."
    tail -20 "$TEMP/verde.log"
    exit 1
fi
echo "  VERDE, como esperado"
echo ""

# ---------------------------------------------------------------------------
# Helper: aplica mutacao, exige VERMELHO, restaura
# ---------------------------------------------------------------------------
mutacao() {
    local numero="$1" nome="$2" padrao="$3" troca="$4" marca="$5"

    echo "[$numero/3] $nome"
    cp "$TEMP/lista.tsx" "$ALVO"
    sed -i "s|$padrao|$troca|" "$ALVO"

    if ! grep -qF "$marca" "$ALVO"; then
        echo "  FALHOU: a mutacao nao foi aplicada — o sed nao casou o padrao."
        echo "  Padrao: $padrao"
        exit 1
    fi

    if npx vitest run "$SUITE" > "$TEMP/mutado-$numero.log" 2>&1; then
        echo "  FALHOU: a suite passou COM a mutacao aplicada."
        echo "  O gate esta cego para: $nome"
        echo ""
        echo "=== VERMELHO: gate cego ==="
        exit 1
    fi

    local quantos
    quantos="$(grep -cE '^\s+[x×]|FAIL' "$TEMP/mutado-$numero.log" || true)"
    echo "  VERMELHO, como esperado (linhas de falha: $quantos)"
    cp "$TEMP/lista.tsx" "$ALVO"
}

mutacao 1 "quadro vazio: o componente devolve null sempre" \
    "  if (!plano.visivel) return null;" \
    "  if (plano.itens >= 0) return null;" \
    "if (plano.itens >= 0) return null;"

mutacao 2 "safe area zerada: a margem some" \
    "const margemH = Math.round(width \* safeArea16x9.actionSafePct);" \
    "const margemH = 0;" \
    "const margemH = 0;"

mutacao 3 "piso de fonte 1px: encolher passa a ser permitido sem limite" \
    "^      pisoDeFonte,\$" \
    "      1," \
    "      1,"

echo ""
echo "restaurando e reconferindo..."
if ! npx vitest run "$SUITE" > "$TEMP/final.log" 2>&1; then
    echo "  FALHOU: a suite continua vermelha depois da restauracao."
    tail -20 "$TEMP/final.log"
    exit 1
fi
echo "  VERDE de novo"
echo ""
echo "=== VERDE: as tres mutacoes ficam VERMELHAS ==="
