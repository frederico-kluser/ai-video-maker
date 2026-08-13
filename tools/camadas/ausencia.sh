#!/usr/bin/env bash
# =============================================================================
# ausencia.sh — ∅-crit: apagar um snapshot aprovado TEM de ficar VERMELHO
# =============================================================================
# Card: F1-11 — Camadas globais (fundo, grade, vinheta)
#
# Este e o unico modo de falha que o resto da cadeia nao cobre: um snapshot
# apagado pode virar "nada a comparar" e passar verde. O gate nao pode ter
# esse caminho.
#
# Sequencia (cada passo com assercao de MENSAGEM, nao so de exit code):
#   1. gate VERDE na base (pre-condicao: o gate fecha limpo).
#   2. apaga UM snapshot aprovado (camadas-grade.png).
#   3. gate VERMELHO, com o marcador `SNAPSHOT AUSENTE` na saida.
#   4. restaura o snapshot.
#   5. gate VERDE de novo — o green do passo 1 nao era sorte.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SNAP_DIR="$REPO_ROOT/fixtures/snapshots/camadas"
ALVO="camadas-grade"
BACKUP=$(mktemp -d /tmp/camadas-aus.XXXXXX)

trap 'find "$BACKUP" -depth -delete 2>/dev/null || true' EXIT

echo "=== camadas-ausencia — ∅-crit: snapshot apagado tem de ficar VERMELHO ==="
echo ""

# ---------------------------------------------------------------------------
# Pre-condicao: o snapshot alvo existe
# ---------------------------------------------------------------------------
if [ ! -f "$SNAP_DIR/$ALVO.png" ]; then
  echo "PRÉ-CONDIÇÃO FALHOU: $SNAP_DIR/$ALVO.png nao existe."
  echo "Rode 'bash tools/camadas/aprovar.sh' antes."
  exit 1
fi

# ---------------------------------------------------------------------------
# Passo 1 — gate verde na base
# ---------------------------------------------------------------------------
echo "Passo 1: gate na base (esperado VERDE)..."
if bash "$SCRIPT_DIR/gate.sh" >"$BACKUP/gate-base.log" 2>&1; then
  echo "  VERDE na base confirmado"
else
  echo "  FALHOU: o gate ja nao fecha verde na base — nao ha o que testar"
  tail -20 "$BACKUP/gate-base.log"
  exit 1
fi

# ---------------------------------------------------------------------------
# Passo 2 e 3 — apaga o snapshot e exige VERMELHO com o marcador
# ---------------------------------------------------------------------------
cp "$SNAP_DIR/$ALVO.png" "$BACKUP/$ALVO.png"

echo "Passo 2: apagando snapshot aprovado $ALVO.png..."
if ! find "$SNAP_DIR" -maxdepth 1 -name "$ALVO.png" -delete; then
  echo "FALHOU: nao consegui apagar $SNAP_DIR/$ALVO.png"
  exit 1
fi
echo "  apagado"

echo "Passo 3: gate apos a remocao (esperado VERMELHO com SNAPSHOT AUSENTE)..."
set +e
bash "$SCRIPT_DIR/gate.sh" >"$BACKUP/gate-sem.log" 2>&1
codigo=$?
set -e

if [ "$codigo" -eq 0 ]; then
  echo "FALHOU: o gate ficou VERDE com snapshot apagado — ∅-crit violado"
  tail -20 "$BACKUP/gate-sem.log"
  exit 1
fi
echo "  gate VERMELHO (exit $codigo)"

if grep -q "SNAPSHOT AUSENTE" "$BACKUP/gate-sem.log"; then
  echo "  marcador presente: SNAPSHOT AUSENTE"
else
  echo "FALHOU: o gate ficou vermelho pela RAZAO errada — sem o marcador"
  echo "       SNAPSHOT AUSENTE. Vermelho por acidente e verde por sorte:"
  tail -20 "$BACKUP/gate-sem.log"
  exit 1
fi

if [ -n "$(git -C "$REPO_ROOT" status --porcelain -- fixtures/snapshots/camadas/)" ]; then
  echo "  git status confirma a remocao:"
  git -C "$REPO_ROOT" status --porcelain -- fixtures/snapshots/camadas/ | sed 's/^/    /'
fi

# ---------------------------------------------------------------------------
# Passos 4 e 5 — restaura e exige VERDE
# ---------------------------------------------------------------------------
cp "$BACKUP/$ALVO.png" "$SNAP_DIR/$ALVO.png"
echo "Passo 4: snapshot restaurado"

echo "Passo 5: gate apos a restauracao (esperado VERDE)..."
if bash "$SCRIPT_DIR/gate.sh" >"$BACKUP/gate-fim.log" 2>&1; then
  echo "  VERDE apos restauracao confirmado"
else
  echo "  FALHOU: o gate nao voltou a fechar verde apos restaurar"
  tail -20 "$BACKUP/gate-fim.log"
  exit 1
fi

if [ -n "$(git -C "$REPO_ROOT" status --porcelain -- fixtures/snapshots/camadas/)" ]; then
  echo "FALHOU: fixtures/snapshots/camadas/ ficou sujo apos o teste"
  git -C "$REPO_ROOT" status --porcelain -- fixtures/snapshots/camadas/
  exit 1
fi

echo ""
echo "=== VERDE: apagar snapshot aprovado deixa o gate VERMELHO; restaurado, VERDE ==="
