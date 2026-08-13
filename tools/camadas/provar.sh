#!/usr/bin/env bash
# =============================================================================
# provar.sh — `just camadas-det-provar`: determinismo das camadas
# =============================================================================
# Card: F1-11 — Camadas globais (fundo, grade, vinheta)
#
# O PROGRAMA pede `just det:provar --no camadas` — render 2x e exigir bytes
# identicos. `just` 1.42 nao aceita ':' em nome de receita e a receita
# `det-provar` de F0-06 nao recebe argumentos (nao se edita receita alheia),
# entao o equivalente deste card vive aqui: renderiza as 7 composicoes da
# prova duas vezes, em diretorios separados, e exige bytes identicos.
#
# - `--concurrency` default do Remotion: serializar esconderia o sintoma.
# - `--gl=swangle` fixo: o backend grafico e parte da chave do baseline.
# - Compara tambem com o snapshot aprovado (regressao) e exige entropia.
# - Divergencia escreve em fixtures/snapshots/camadas/received/ e nunca
#   sobrescreve o aprovado.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SNAP_DIR="$REPO_ROOT/fixtures/snapshots/camadas"
RECEIVED_DIR="$SNAP_DIR/received"
T1=$(mktemp -d /tmp/camadas-det1.XXXXXX)
T2=$(mktemp -d /tmp/camadas-det2.XXXXXX)
FALHAS=0

trap 'find "$T1" -depth -delete 2>/dev/null || true; find "$T2" -depth -delete 2>/dev/null || true' EXIT

echo "=== camadas-det-provar — determinismo: render 2x, bytes identicos ==="
echo ""

eval "$(cd "$REPO_ROOT" && npx tsx tools/camadas/medir.ts parametros)"

# Pre-condicao: snapshots aprovados existem (ausencia e falha, nao primeiro run)
for id in $CAMADAS_APROVADOS; do
  if [ ! -f "$SNAP_DIR/$id.png" ]; then
    echo "SNAPSHOT AUSENTE: $SNAP_DIR/$id.png"
    echo "  gere com: bash tools/camadas/aprovar.sh (ou camadas-capturar)"
    exit 1
  fi
done

echo "Render 1/2..."
bash "$SCRIPT_DIR/capturar.sh" "$T1"
echo "Render 2/2..."
bash "$SCRIPT_DIR/capturar.sh" "$T2"

for id in $CAMADAS_IDS; do
  if ! cmp -s "$T1/$id.png" "$T2/$id.png"; then
    echo "DETERMINISMO: render de $id divergiu entre as duas execucoes"
    mkdir -p "$RECEIVED_DIR"
    cp "$T1/$id.png" "$RECEIVED_DIR/det1-$id.png"
    cp "$T2/$id.png" "$RECEIVED_DIR/det2-$id.png"
    echo "  divergentes preservados em: $RECEIVED_DIR/det1-$id.png e det2-$id.png"
    FALHAS=$((FALHAS + 1))
  fi
done

for id in $CAMADAS_APROVADOS; do
  tamanho=$(stat -c%s "$T1/$id.png")
  if [ "$tamanho" -lt 1000 ]; then
    echo "FALHOU: entropia — $id.png tem $tamanho byte(s), esperado >= 1000"
    FALHAS=$((FALHAS + 1))
  fi
  if ! cmp -s "$T1/$id.png" "$SNAP_DIR/$id.png"; then
    echo "REGRESSAO: $id diverge do snapshot aprovado"
    mkdir -p "$RECEIVED_DIR"
    cp "$T1/$id.png" "$RECEIVED_DIR/atual-$id.png"
    FALHAS=$((FALHAS + 1))
  fi
done

echo ""
if [ "$FALHAS" -eq 0 ]; then
  echo "=== VERDE: $(echo "$CAMADAS_IDS" | wc -w) composicoes, render 2x identico, snapshots intactos ==="
  exit 0
fi
echo "=== VERMELHO: determinismo nao provado ($FALHAS falha(s)) ==="
exit 1
