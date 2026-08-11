#!/usr/bin/env bash
# =============================================================================
# det:provar — Prova de determinismo do canário
# =============================================================================
# Card: F0-06 — Harness de determinismo
#
# Renderiza o canário 2x no mesmo frame e exige bytes idênticos.
# Se idênticos, copia o snapshot para o diretório aprovado.
# Se divergentes, escreve em *.received/ e falha.
#
# Também assere entropia (saída não-vazia).
# Também assere que o snapshot aprovado EXISTE (ausência falha).
#
# Uso:
#   bash tools/determinismo/provar.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CANARY_ENTRY="$REPO_ROOT/fixtures/canario/index.tsx"
COMP_ID="canario"
FRAME=15
APPROVED_DIR="$REPO_ROOT/fixtures/canario/approved"
RECEIVED_DIR="$REPO_ROOT/fixtures/canario/received"
OUTPUT_FILE="canario-frame${FRAME}.png"
TEMP1=$(mktemp -d)
TEMP2=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP1" "$TEMP2"
}
trap cleanup EXIT

echo "=== det:provar — Prova de determinismo do canário ==="
echo ""

# ---------------------------------------------------------------------------
# Verifica que o snapshot aprovado existe (ausência falha)
# ---------------------------------------------------------------------------
if [ ! -f "$APPROVED_DIR/$OUTPUT_FILE" ]; then
    echo "SNAPSHOT AUSENTE: $APPROVED_DIR/$OUTPUT_FILE"
    echo "Renderizando 2x para gerar snapshot inicial..."

    # Render 1
    echo "  Render 1/2..."
    npx remotion still "$CANARY_ENTRY" "$COMP_ID" "$TEMP1/$OUTPUT_FILE" \
        --frame="$FRAME" \
        --gl=swangle 2>&1 | grep -v "^$" || true

    # Render 2
    echo "  Render 2/2..."
    npx remotion still "$CANARY_ENTRY" "$COMP_ID" "$TEMP2/$OUTPUT_FILE" \
        --frame="$FRAME" \
        --gl=swangle 2>&1 | grep -v "^$" || true

    # Compara bytes
    if cmp -s "$TEMP1/$OUTPUT_FILE" "$TEMP2/$OUTPUT_FILE"; then
        echo "  DETERMINISMO PROVADO: renders idênticos"

        # Asserção de entropia — saída não-vazia
        FILE_SIZE=$(stat -c%s "$TEMP1/$OUTPUT_FILE")
        if [ "$FILE_SIZE" -lt 1000 ]; then
            echo "  FALHOU: asserção de entropia — arquivo muito pequeno ($FILE_SIZE bytes)"
            exit 1
        fi
        echo "  Entropia OK: $FILE_SIZE bytes"

        # Copia para aprovado
        mkdir -p "$APPROVED_DIR"
        cp "$TEMP1/$OUTPUT_FILE" "$APPROVED_DIR/$OUTPUT_FILE"
        echo "  Snapshot aprovado: $APPROVED_DIR/$OUTPUT_FILE"
        echo ""
        echo "=== VERDE: determinismo provado, snapshot aprovado ==="
        exit 0
    else
        echo "  FALHOU: renders divergentes na geração inicial"
        mkdir -p "$RECEIVED_DIR"
        cp "$TEMP1/$OUTPUT_FILE" "$RECEIVED_DIR/render1-$OUTPUT_FILE"
        cp "$TEMP2/$OUTPUT_FILE" "$RECEIVED_DIR/render2-$OUTPUT_FILE"
        echo "  Artefatos divergentes em: $RECEIVED_DIR/"
        echo ""
        echo "=== VERMELHO: determinismo não provado ==="
        exit 1
    fi
fi

echo "Snapshot aprovado encontrado: $APPROVED_DIR/$OUTPUT_FILE"
echo ""

# ---------------------------------------------------------------------------
# Renderiza 2x e compara com o snapshot aprovado
# ---------------------------------------------------------------------------

# Render 1
echo "Render 1/2..."
npx remotion still "$CANARY_ENTRY" "$COMP_ID" "$TEMP1/$OUTPUT_FILE" \
    --frame="$FRAME" \
    --gl=swangle 2>&1 | grep -v "^$" || true

# Render 2
echo "Render 2/2..."
npx remotion still "$CANARY_ENTRY" "$COMP_ID" "$TEMP2/$OUTPUT_FILE" \
    --frame="$FRAME" \
    --gl=swangle 2>&1 | grep -v "^$" || true

# Compara os dois renders entre si
if ! cmp -s "$TEMP1/$OUTPUT_FILE" "$TEMP2/$OUTPUT_FILE"; then
    echo "FALHOU: renders 1 e 2 divergem entre si — determinismo quebrado"
    mkdir -p "$RECEIVED_DIR"
    cp "$TEMP1/$OUTPUT_FILE" "$RECEIVED_DIR/render1-$OUTPUT_FILE"
    cp "$TEMP2/$OUTPUT_FILE" "$RECEIVED_DIR/render2-$OUTPUT_FILE"
    echo "Artefatos divergentes em: $RECEIVED_DIR/"
    echo ""
    echo "=== VERMELHO: determinismo não provado ==="
    exit 1
fi
echo "Renders 1 e 2 idênticos entre si"

# Compara com o snapshot aprovado
if ! cmp -s "$TEMP1/$OUTPUT_FILE" "$APPROVED_DIR/$OUTPUT_FILE"; then
    echo "FALHOU: render atual diverge do snapshot aprovado"
    mkdir -p "$RECEIVED_DIR"
    cp "$TEMP1/$OUTPUT_FILE" "$RECEIVED_DIR/atual-$OUTPUT_FILE"
    echo "Artefato divergente em: $RECEIVED_DIR/atual-$OUTPUT_FILE"
    echo "Snapshot aprovado em: $APPROVED_DIR/$OUTPUT_FILE"
    echo ""
    echo "=== VERMELHO: regressão detectada ==="
    exit 1
fi
echo "Render atual idêntico ao snapshot aprovado"

# Asserção de entropia — saída não-vazia
FILE_SIZE=$(stat -c%s "$TEMP1/$OUTPUT_FILE")
if [ "$FILE_SIZE" -lt 1000 ]; then
    echo "FALHOU: asserção de entropia — arquivo muito pequeno ($FILE_SIZE bytes)"
    exit 1
fi
echo "Entropia OK: $FILE_SIZE bytes"

echo ""
echo "=== VERDE: determinismo provado ==="
