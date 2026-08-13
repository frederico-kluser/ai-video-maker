#!/usr/bin/env bash
# =============================================================================
# invasao.sh — `just camadas-invasao`: a prova de que o medidor sabe reprovar
# =============================================================================
# Card: F1-11 — Camadas globais (fundo, grade, vinheta)
#
# ADR-0001, Regra 3: nenhum estagio comeca sem oraculo CAPAZ DE REPROVA-LO.
# Um gate que so foi visto aprovando nunca foi visto funcionando (C2). Aqui o
# gate prova as proprias mandibulas:
#
#   camadas-invasora  — a vinheta "bonita" que avanca 12% para dentro da safe
#                       area. TEM de reprovar com a mensagem `INVASAO`.
#   camadas-vazia     — a camada que nao desenha nada. TEM de reprovar com a
#                       mensagem `QUADRO VAZIO`.
#
# Assertamos a MENSAGEM, nao so o exit code (IV-4): exit code nao distingue
# "acusou" de "quebrou".
#
# E a mesma mutacao que o fundo documenta: subir o z-index do fundo para cima
# do conteudo deixa este gate vermelho — o fundo tambem e medido pela INVASAO.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TEMP=$(mktemp -d /tmp/camadas-inv.XXXXXX)
FALHAS=0

trap 'find "$TEMP" -depth -delete 2>/dev/null || true' EXIT

echo "=== camadas-invasao — o medidor sabe reprovar? ==="
echo ""

bash "$SCRIPT_DIR/capturar.sh" "$TEMP"

saida=$(cd "$REPO_ROOT" && npx tsx tools/camadas/medir.ts medir --dir "$TEMP" 2>&1) || true
echo "$saida"
echo ""

# O catalogo inteiro tem de bater (4 aprovam, 2 reprovam)
if ! echo "$saida" | grep -qE "0 falha\(s\)$"; then
  echo "FALHOU: medicao do catalogo nao fechou com 0 falhas"
  FALHAS=$((FALHAS + 1))
fi

# A sonda invasora tem de acusar INVASAO — nao basta exit code
if ! echo "$saida" | grep -q "REPROVA  camadas-invasora" || \
   ! echo "$saida" | grep -q "INVASAO"; then
  echo "FALHOU: a sonda invasora nao acusou INVASAO — o medidor ficou cego"
  FALHAS=$((FALHAS + 1))
fi

# A sonda vazia tem de acusar QUADRO VAZIO
if ! echo "$saida" | grep -q "REPROVA  camadas-vazia" || \
   ! echo "$saida" | grep -q "QUADRO VAZIO"; then
  echo "FALHOU: a sonda vazia nao acusou QUADRO VAZIO — o medidor ficou cego"
  FALHAS=$((FALHAS + 1))
fi

echo ""
if [ "$FALHAS" -eq 0 ]; then
  echo "=== VERDE: as duas sondas reprovam com a mensagem certa ==="
  exit 0
fi
echo "=== VERMELHO: o medidor nao reprova o que devia ==="
exit 1
