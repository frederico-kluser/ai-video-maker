#!/usr/bin/env bash
# =============================================================================
# timing-determinismo — o timing canonico e 2x identico (F3-01)
# =============================================================================
# Card F3-01. O construtor e funcao pura de (manifesto + parcial + bytes);
# o determinismo NAO pode ser premissa — tem de ser provado, em processos
# separados e com ambientes propositalmente diferentes (C9):
#
#   Fase 1  dois processos separados (TZ e LANG diferentes), bytes iguais.
#   Fase 2  sonda negativa: mutar UM byte do documento TEM de deixar o
#           diff VERMELHO (um determinismo que nao acusa mutacao e um
#           diff cego — o falso verde que a fase 2 existe para matar).
#   Fase 3  os dois batem com o golden COMMITADO (regressao byte a byte).
#
# C3: `git diff --exit-code` nao enxerga arquivo nao rastreado; aqui a
# comparacao e com `cmp` sobre caminhos explícitos, e o golden e
# conferido pelo proprio `timing-testar` (gerar.ts --conferir).
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$RAIZ"

GOLDEN="fixtures/canonico/timing-canono.json"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "=== timing-determinismo: o documento canonico e 2x identico ==="
echo ""

echo "Fase 1 — dois PROCESSOS separados, ambientes diferentes (C9)"
TZ=UTC LANG=C npx tsx tools/timing/gerar.ts --saida "$TMP/a.json"
TZ=America/Sao_Paulo LANG=pt_BR.UTF-8 npx tsx tools/timing/gerar.ts --saida "$TMP/b.json"
if cmp -s "$TMP/a.json" "$TMP/b.json"; then
    echo "  a.json == b.json ($(wc -c < "$TMP/a.json") bytes)"
else
    echo "VERMELHO: dois processos produziram bytes diferentes."
    diff "$TMP/a.json" "$TMP/b.json" | head -40
    exit 1
fi
echo ""

echo "Fase 2 — sonda negativa: mutar 1 byte TEM de ficar VERMELHO"
cp "$TMP/a.json" "$TMP/mutado.json"
printf ' ' >> "$TMP/mutado.json"   # um byte de diferenca no fim
if cmp -s "$TMP/a.json" "$TMP/mutado.json"; then
    echo "VERMELHO: o determinismo nao acusou a mutacao — diff cego."
    exit 1
fi
echo "  mutacao detectada: a.json != mutado.json"
echo ""

echo "Fase 3 — os dois batem com o golden commitado"
if [ ! -f "$GOLDEN" ]; then
    echo "VERMELHO: $GOLDEN ausente. Rode 'npx tsx tools/timing/gerar.ts --gravar'."
    exit 1
fi
if cmp -s "$TMP/a.json" "$GOLDEN"; then
    echo "  a.json == $GOLDEN"
else
    echo "VERMELHO: o processo atual divergiu do golden commitado."
    diff "$TMP/a.json" "$GOLDEN" | head -40
    exit 1
fi
echo ""
echo "=== VERDE: determinismo do timing canonico sustentado ==="
