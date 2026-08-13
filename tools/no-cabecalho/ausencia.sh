#!/usr/bin/env bash
# =============================================================================
# no-cabecalho — ∅-crit: apagar um snapshot aprovado TEM de ficar vermelho
# =============================================================================
# Card: F1-04 — onda W4.
#
# Um gate de snapshot que trata "nao existe aprovado" como "primeira execucao,
# vou gerar" nunca reprova nada: o oraculo se reescreve para concordar com o
# codigo. Este script executa a sonda negativa de verdade, um snapshot por vez:
#
#     apaga -> roda o gate -> EXIGE vermelho -> restaura -> EXIGE verde
#
# Se qualquer remocao deixar o gate verde, ESTE script fica vermelho.
#
# Uso:
#   bash tools/no-cabecalho/ausencia.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

APROVADOS="$REPO_ROOT/fixtures/snapshots/no-cabecalho/aprovados"
PROVAR="$SCRIPT_DIR/provar.sh"

TEMP=$(mktemp -d)
restaurar_tudo() {
    if [ -d "$TEMP/backup" ]; then
        for guardado in "$TEMP/backup/"*; do
            [ -e "$guardado" ] || continue
            cp "$guardado" "$APROVADOS/$(basename "$guardado")"
        done
    fi
    rm -rf "$TEMP"
}
trap restaurar_tudo EXIT

echo "=== no-cabecalho ∅-crit: ausencia de snapshot tem de ficar VERMELHO ==="
echo ""

mapfile -t SNAPSHOTS < <(ls -A "$APROVADOS" 2>/dev/null | sort || true)
if [ "${#SNAPSHOTS[@]}" -eq 0 ]; then
    echo "PRE-CONDICAO FALHOU: nao ha snapshot aprovado para apagar."
    echo "Rode 'just no-cabecalho-aprovar' antes."
    echo ""
    echo "=== VERMELHO: nada a testar (denominador zero) ==="
    exit 1
fi
echo "Snapshots aprovados: ${SNAPSHOTS[*]}"
echo ""

mkdir -p "$TEMP/backup"
for arq in "${SNAPSHOTS[@]}"; do
    cp "$APROVADOS/$arq" "$TEMP/backup/$arq"
done

# ---------------------------------------------------------------------------
# Controle positivo: com tudo no lugar, o gate esta VERDE.
# Sem isto, um gate quebrado por outro motivo passaria por "detectou a ausencia".
# ---------------------------------------------------------------------------
echo "Controle positivo: gate com todos os snapshots presentes..."
if ! bash "$PROVAR" >"$TEMP/verde-antes.log" 2>&1; then
    tail -20 "$TEMP/verde-antes.log"
    echo ""
    echo "=== VERMELHO: o gate ja estava vermelho ANTES da sonda ==="
    exit 1
fi
echo "  VERDE (como esperado)"
echo ""

# ---------------------------------------------------------------------------
# A sonda: um snapshot por vez
# ---------------------------------------------------------------------------
for arq in "${SNAPSHOTS[@]}"; do
    echo "Apagando aprovados/$arq ..."
    rm "$APROVADOS/$arq"
    [ ! -f "$APROVADOS/$arq" ] || { echo "FALHOU: remocao nao funcionou"; exit 1; }

    if bash "$PROVAR" >"$TEMP/sonda-$arq.log" 2>&1; then
        echo "  FALHOU: o gate saiu VERDE com aprovados/$arq apagado."
        echo "  Um snapshot ausente tem de reprovar, nunca ser regerado em silencio."
        tail -20 "$TEMP/sonda-$arq.log"
        cp "$TEMP/backup/$arq" "$APROVADOS/$arq"
        echo ""
        echo "=== VERMELHO: gate cego para ausencia de snapshot ==="
        exit 1
    fi

    if ! grep -q "AUSENTE" "$TEMP/sonda-$arq.log"; then
        echo "  FALHOU: o gate reprovou, mas nao pelo motivo certo (sem 'AUSENTE' na saida)."
        tail -20 "$TEMP/sonda-$arq.log"
        cp "$TEMP/backup/$arq" "$APROVADOS/$arq"
        echo ""
        echo "=== VERMELHO: reprovou pelo motivo errado ==="
        exit 1
    fi
    echo "  VERMELHO pelo motivo certo (snapshot AUSENTE)"

    cp "$TEMP/backup/$arq" "$APROVADOS/$arq"
    echo "  restaurado"
    echo ""
done

# ---------------------------------------------------------------------------
# Volta ao verde: restaurar tem de bastar
# ---------------------------------------------------------------------------
echo "Controle final: gate com tudo restaurado..."
if ! bash "$PROVAR" >"$TEMP/verde-depois.log" 2>&1; then
    tail -20 "$TEMP/verde-depois.log"
    echo ""
    echo "=== VERMELHO: restaurar os snapshots nao devolveu o verde ==="
    exit 1
fi
echo "  VERDE"

echo ""
echo "=== VERDE: ${#SNAPSHOTS[@]} snapshot(s), cada um apagado -> vermelho -> restaurado -> verde ==="
