#!/usr/bin/env bash
# =============================================================================
# snapshots — C3: git diff --exit-code nao enxerga arquivo nao rastreado
# =============================================================================
# Card: F1-09 (onda W4)
#
# O criterio do PROGRAMA e a COMBINACAO de dois comandos, e os dois tem de
# sair vazios:
#   git diff --exit-code fixtures/snapshots/no-grafico/
#   git status --porcelain fixtures/snapshots/no-grafico/
#
# Uso:  bash tools/no-grafico/snapshots.sh
# Exit: 0 = diffs limpos e status limpo; 1 = alguma coisa diverge
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR_SNAPSHOTS="$REPO_ROOT/fixtures/snapshots/no-grafico"

if ! git -C "$REPO_ROOT" diff --exit-code --quiet "$DIR_SNAPSHOTS"; then
    echo "FALHOU: git diff --exit-code fixtures/snapshots/no-grafico/ nao-vazio"
    git -C "$REPO_ROOT" diff --stat "$DIR_SNAPSHOTS" || true
    exit 1
fi

porcelain="$(git -C "$REPO_ROOT" status --porcelain "$DIR_SNAPSHOTS")"
if [ -n "$porcelain" ]; then
    echo "FALHOU: git status --porcelain fixtures/snapshots/no-grafico/ nao-vazio (C3):"
    echo "$porcelain"
    exit 1
fi

echo "no-grafico-snapshots: OK (diff limpo + status limpo)"
