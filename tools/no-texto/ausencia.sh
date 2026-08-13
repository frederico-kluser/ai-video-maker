#!/usr/bin/env bash
# =============================================================================
# no-texto:ausencia — ∅-crit do no de texto (card F1-05)
# =============================================================================
# O criterio de aceitacao do PROGRAMA escreve `bash tools/no-texto/ausencia.sh`:
# apagar um snapshot aprovado TEM de ficar vermelho. Nao basta ver o gate
# passando — a prova de que ele funciona e a mutacao: some com cada aprovado,
# um por vez, e exige VERMELHO; restaura e exige VERDE de novo (controle
# positivo nas duas pontas).
#
# A implementacao da prova mora em fixtures/snapshots/no-texto/provar.ts
# (modo --provar-ausencia), junto do harness de determinismo do card — um so
# lugar, uma so pre-condicao. Este script e o comando do card, que delega:
# quem tocar na logica muda aquele arquivo, nao este.
#
# Uso:
#   bash tools/no-texto/ausencia.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

npx tsx fixtures/snapshots/no-texto/provar.ts --provar-ausencia
