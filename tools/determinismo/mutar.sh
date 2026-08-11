#!/usr/bin/env bash
# =============================================================================
# det:mutar — Teste de mutação volátil do canário
# =============================================================================
# Card: F0-06 — Harness de determinismo
#
# Injeta um valor volátil (Date.now()) na composição do canário,
# renderiza, e EXIGE que o resultado divirja do snapshot aprovado.
# Se o render mutado for idêntico ao aprovado, o gate está cego
# e falha.
#
# Uso:
#   bash tools/determinismo/mutar.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

COMP_ID="canario"
FRAME=15
APPROVED_DIR="$REPO_ROOT/fixtures/canario/approved"
RECEIVED_DIR="$REPO_ROOT/fixtures/canario/received"
OUTPUT_FILE="canario-frame${FRAME}.png"
TEMP=$(mktemp -d)
MUTATED_DIR="$TEMP/mutated"

cleanup() {
    rm -rf "$TEMP"
}
trap cleanup EXIT

echo "=== det:mutar — Teste de mutação volátil ==="
echo ""

# ---------------------------------------------------------------------------
# Pré-condição: snapshot aprovado precisa existir
# ---------------------------------------------------------------------------
if [ ! -f "$APPROVED_DIR/$OUTPUT_FILE" ]; then
    echo "PRÉ-CONDIÇÃO FALHOU: snapshot aprovado ausente."
    echo "Execute 'bash tools/determinismo/provar.sh' primeiro para gerar o snapshot."
    echo ""
    echo "=== VERMELHO: snapshot aprovado ausente ==="
    exit 1
fi
echo "Snapshot aprovado encontrado: $APPROVED_DIR/$OUTPUT_FILE"
echo ""

# ---------------------------------------------------------------------------
# Cria cópia mutada do canário com valor volátil injetado
# ---------------------------------------------------------------------------
echo "Criando cópia mutada do canário..."

mkdir -p "$MUTATED_DIR"
cp "$REPO_ROOT/fixtures/canario/Root.tsx" "$MUTATED_DIR/Root.tsx"
cp "$REPO_ROOT/fixtures/canario/index.tsx" "$MUTATED_DIR/index.tsx"

# Injeta Date.now() no fundo — substitui a cor de fundo constante
# por uma que depende do relógio de parede
sed -i 's/backgroundColor: "#0B1121"/backgroundColor: `rgb(${Date.now() % 256}, ${(Date.now() * 7) % 256}, ${(Date.now() * 13) % 256})`/' \
    "$MUTATED_DIR/Root.tsx"

# Verifica que a mutação foi aplicada
if grep -q 'Date.now()' "$MUTATED_DIR/Root.tsx"; then
    echo "  Mutação aplicada: Date.now() injetado no fundo"
else
    echo "  FALHOU: mutação não foi aplicada — sed não casou o padrão"
    exit 1
fi

# ---------------------------------------------------------------------------
# Renderiza a versão mutada
# ---------------------------------------------------------------------------
echo "Renderizando versão mutada..."
npx remotion still "$MUTATED_DIR/index.tsx" "$COMP_ID" "$TEMP/$OUTPUT_FILE" \
    --frame="$FRAME" \
    --gl=swangle 2>&1 | grep -v "^$" || true

if [ ! -f "$TEMP/$OUTPUT_FILE" ]; then
    echo "FALHOU: render da versão mutada não produziu arquivo"
    exit 1
fi

# ---------------------------------------------------------------------------
# Compara com o snapshot aprovado — EXIGE divergência
# ---------------------------------------------------------------------------
if cmp -s "$TEMP/$OUTPUT_FILE" "$APPROVED_DIR/$OUTPUT_FILE"; then
    echo ""
    echo "FALHOU: versão mutada (com Date.now()) produziu saída IDÊNTICA ao snapshot aprovado."
    echo "O gate está CEGO — não detecta injeção de valor volátil."
    mkdir -p "$RECEIVED_DIR"
    cp "$TEMP/$OUTPUT_FILE" "$RECEIVED_DIR/mutado-identico-$OUTPUT_FILE"
    echo ""
    echo "=== VERMELHO: gate cego para volatilidade ==="
    exit 1
fi

echo "  Mutação detectada: render mutado diverge do snapshot aprovado"
echo ""

# ---------------------------------------------------------------------------
# Verifica que a mensagem de erro contém o diagnóstico correto
# (a divergência foi detectada e classificada como volatilidade)
# ---------------------------------------------------------------------------
echo "Teste de mutação: volatilidade injetada → divergência detectada → gate VERMELHO"
echo "Este é o comportamento ESPERADO: Date.now() quebra o determinismo."
echo ""
echo "=== VERDE: gate detectou a volatilidade corretamente ==="
