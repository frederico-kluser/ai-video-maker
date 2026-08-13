#!/usr/bin/env bash
# =============================================================================
# gate.sh — `just no-camadas`: o gate das camadas globais
# =============================================================================
# Card: F1-11 — Camadas globais (fundo, grade, vinheta)
#
# O gate responde, em pixel e em numero, a pergunta do card: a camada
# (fundo, grade, vinheta) NAO cobre a safe area? E nao deixa um quadro vazio
# passar por camada decorativa.
#
# Etapas, na ordem em que o fracasso e mais barato:
#
#   1. DENOMINADOR  os 5 snapshots aprovados existem (C3/C2: um diretorio
#                   vazio sairia verde sem olhar nada). Um snapshot apagado
#                   imprime `SNAPSHOT AUSENTE` — e o marcador que o ∅-crit
#                   (ausencia.sh) procura.
#   2. ENTROPIA     todo snapshot aprovado tem de ter conteudo (>= 1000 bytes):
#                   um PNG truncado nao e "menos o que comparar", e falha.
#   3. RENDER       renderiza as 7 composicoes da prova em diretorio temporario.
#   4. REGRESSAO    cada render novo tem de ser BYTE-A-BYTE igual ao snapshot
#                   aprovado. Divergiu? escreve em received/ e falha — o
#                   aprovado e imutavel, e nunca e sobrescrito (ADR-0001).
#   5. MEDICAO      medir.ts aplica o veredito esperado de cada composicao:
#                   0 pixels mudados dentro da safe area nas aprovadas; as duas
#                   sondas negativas TEM de reprovar (INVASAO, QUADRO VAZIO).
#   6. GIT          git diff --exit-code combinado com git status --porcelain
#                   sobre fixtures/snapshots/camadas/: o diff nao enxerga
#                   arquivo nao rastreado, e o status sai 0 sujo e limpo — o
#                   par e o oraculo de "o diretorio aprovado esta intacto".
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SNAP_DIR="$REPO_ROOT/fixtures/snapshots/camadas"
RECEIVED_DIR="$SNAP_DIR/received"
TEMP=$(mktemp -d /tmp/camadas-gate.XXXXXX)
FALHAS=0

trap 'find "$TEMP" -depth -delete 2>/dev/null || true' EXIT

echo "=== no-camadas — gate das camadas globais ==="
echo ""

eval "$(cd "$REPO_ROOT" && npx tsx tools/camadas/medir.ts parametros)"

# ---------------------------------------------------------------------------
# 1. Denominador — os snapshots aprovados existem
# ---------------------------------------------------------------------------
for id in $CAMADAS_APROVADOS; do
  if [ ! -f "$SNAP_DIR/$id.png" ]; then
    echo "SNAPSHOT AUSENTE: $SNAP_DIR/$id.png"
    echo "  (o ∅-crit apaga um snapshot e exige este VERMELHO)"
    FALHAS=$((FALHAS + 1))
  fi
done

# ---------------------------------------------------------------------------
# 2. Entropia — conteudo minimo em cada snapshot aprovado
# ---------------------------------------------------------------------------
for id in $CAMADAS_APROVADOS; do
  if [ -f "$SNAP_DIR/$id.png" ]; then
    tamanho=$(stat -c%s "$SNAP_DIR/$id.png")
    if [ "$tamanho" -lt 1000 ]; then
      echo "FALHOU: entropia — $id.png tem $tamanho byte(s), esperado >= 1000"
      FALHAS=$((FALHAS + 1))
    fi
  fi
done

# ---------------------------------------------------------------------------
# 3. Render das 7 composicoes
# ---------------------------------------------------------------------------
if ! bash "$SCRIPT_DIR/capturar.sh" "$TEMP"; then
  echo "FALHOU: render do cenario de prova (capturar.sh)"
  FALHAS=$((FALHAS + 1))
fi

# ---------------------------------------------------------------------------
# 4. Regressao — render novo == snapshot aprovado, byte a byte
# ---------------------------------------------------------------------------
if [ "$FALHAS" -eq 0 ]; then
  for id in $CAMADAS_APROVADOS; do
    if ! cmp -s "$TEMP/$id.png" "$SNAP_DIR/$id.png"; then
      echo "REGRESSAO: render de $id diverge do snapshot aprovado"
      mkdir -p "$RECEIVED_DIR"
      cp "$TEMP/$id.png" "$RECEIVED_DIR/atual-$id.png"
      echo "  divergente preservado em: $RECEIVED_DIR/atual-$id.png"
      FALHAS=$((FALHAS + 1))
    fi
  done
fi

# ---------------------------------------------------------------------------
# 5. Medicao — vereditos esperados, sondas incluidas
# ---------------------------------------------------------------------------
if [ "$FALHAS" -eq 0 ]; then
  saida_medicao=$(npx tsx "$SCRIPT_DIR/medir.ts" medir --dir "$TEMP" 2>&1) || true
  echo "$saida_medicao"
  echo ""
  if ! echo "$saida_medicao" | grep -qE "0 falha\(s\)$"; then
    echo "FALHOU: medicao reprovou alguma composicao (acima)"
    FALHAS=$((FALHAS + 1))
  fi
fi

# ---------------------------------------------------------------------------
# 6. Git — o diretorio aprovado esta intacto (par de oraculos, C3)
# ---------------------------------------------------------------------------
if ! git -C "$REPO_ROOT" diff --exit-code -- fixtures/snapshots/camadas/ >/dev/null; then
  echo "FALHOU: git diff --exit-code — fixtures/snapshots/camadas/ foi alterado"
  FALHAS=$((FALHAS + 1))
fi
if [ -n "$(git -C "$REPO_ROOT" status --porcelain -- fixtures/snapshots/camadas/)" ]; then
  echo "FALHOU: git status --porcelain — arquivo nao rastreado ou removido em fixtures/snapshots/camadas/:"
  git -C "$REPO_ROOT" status --porcelain -- fixtures/snapshots/camadas/ | sed 's/^/  /'
  FALHAS=$((FALHAS + 1))
fi

echo ""
if [ "$FALHAS" -eq 0 ]; then
  echo "=== VERDE: nenhuma camada cobre a safe area, snapshots intactos ==="
  exit 0
fi
echo "=== VERMELHO: $FALHAS falha(s) — detalhes acima ==="
exit 1
