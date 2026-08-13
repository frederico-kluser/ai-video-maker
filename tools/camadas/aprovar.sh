#!/usr/bin/env bash
# =============================================================================
# aprovar.sh — gera (ou regenera) os snapshots aprovados de camadas
# =============================================================================
# Card: F1-11 — Camadas globais (fundo, grade, vinheta)
#
# Nascer so a partir do RENDER, nunca do Studio (C5): o Chrome do preview nao
# e o do render. E nascer com a prova de determinismo ANTES de tocar o
# aprovado (F0-06, entrega a): renderiza 2x em rascunho, exige bytes
# identicos, e SO entao copia para fixtures/snapshots/camadas/.
#
# O aprovado e imutavel (ADR-0001): este script nunca roda dentro de um gate —
# e a acao explicita de quem autoriza um re-baseline, e o commit seguinte
# registra o que mudou. O gate (gate.sh) trata divergencia como REGRESSAO.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SNAP_DIR="$REPO_ROOT/fixtures/snapshots/camadas"
T1=$(mktemp -d /tmp/camadas-apr1.XXXXXX)
T2=$(mktemp -d /tmp/camadas-apr2.XXXXXX)

trap 'find "$T1" -depth -delete 2>/dev/null || true; find "$T2" -depth -delete 2>/dev/null || true' EXIT

echo "=== camadas-capturar — geracao de snapshots a partir do render ==="
echo ""

bash "$SCRIPT_DIR/capturar.sh" "$T1"
bash "$SCRIPT_DIR/capturar.sh" "$T2"

eval "$(cd "$REPO_ROOT" && npx tsx tools/camadas/medir.ts parametros)"

for id in $CAMADAS_APROVADOS; do
  if ! cmp -s "$T1/$id.png" "$T2/$id.png"; then
    echo "FALHOU: determinismo — $id divergiu entre os dois renders"
    echo "  nada foi copiado para fixtures/snapshots/camadas/"
    exit 1
  fi
done

mkdir -p "$SNAP_DIR"
for id in $CAMADAS_APROVADOS; do
  cp "$T1/$id.png" "$SNAP_DIR/$id.png"
  echo "  aprovado: $SNAP_DIR/$id.png ($(stat -c%s "$SNAP_DIR/$id.png") bytes)"
done

echo ""
echo "SNAP: os 5 snapshots foram (re)escritos — revisite com git diff e commite."
