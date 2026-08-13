#!/usr/bin/env bash
# =============================================================================
# capturar.sh — renderiza TODAS as composicoes do cenario de prova de camadas
# =============================================================================
# Card: F1-11 — Camadas globais (fundo, grade, vinheta)
#
# O cenario de prova tem sete composicoes: a referencia (sem camada), as tres
# camadas reais, a composicao das tres juntas e as duas sondas negativas.
# Frame, duracao, resolucao e ids vem de `medir.ts parametros` — o shell nao
# redigita numero nenhum, e quem deriva os numeros dos tokens e a cena.
#
# Uso:  bash tools/camadas/capturar.sh <diretorio-destino>
#
# Os PNGs sao o que o gate mede. Render falho de QUALQUER composicao derruba o
# capturar — um catalogo incompleto viraria "menos o que comparar" e sairia
# verde (C2).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DESTINO="${1:?uso: bash tools/camadas/capturar.sh <diretorio-destino>}"

# Parametros derivados dos tokens (frame, ids, entrada...) — nada digitado.
eval "$(cd "$REPO_ROOT" && npx tsx tools/camadas/medir.ts parametros)"

mkdir -p "$DESTINO"

for id in $CAMADAS_IDS; do
  log="$DESTINO/.render-$id.log"
  if ! (cd "$REPO_ROOT" && npx remotion still "$CAMADAS_ENTRADA" "$id" \
      "$DESTINO/$id.png" --frame="$CAMADAS_FRAME" --gl=swangle >"$log" 2>&1); then
    echo "FALHOU: render de $id" >&2
    tail -20 "$log" >&2
    exit 1
  fi
  find "$DESTINO" -maxdepth 1 -name ".render-$id.log" -delete
done

echo "capturar: $(echo "$CAMADAS_IDS" | wc -w) PNG(s) renderizados em $DESTINO"
