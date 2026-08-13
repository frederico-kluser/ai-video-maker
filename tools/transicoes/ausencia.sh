#!/usr/bin/env bash
# =============================================================================
# transicoes:ausencia — ∅-crit do card F1-10 (Transicoes)
# =============================================================================
# "Apagar um snapshot aprovado TEM de ficar vermelho" — e o teste disso:
#
#   1. apaga um dos 9 snapshots aprovados e exige que `provar.sh
#      --somente-snapshot` fique VERMELHO pelo motivo certo (AUSENTE,
#      nomeando o arquivo) — sem pagar dois renders de Chrome;
#   2. exige que a suite de testes fique VERMELHA com o mesmo snapshot
#      apagado (o teste le o PNG do disco; ausente, acusa pelo nome);
#   3. restaura e exige VERDE nos mesmos comandos — e, no fim, o gate
#      COMPLETO (dois renders, pixel e regressao) fica VERDE.
#
# Sem o passo 3, um script que apaga e nunca restaura deixaria o proprio gate
# vermelho para sempre — o ∅-crit "provado" por uma sonega. Este teste termina
# com o repositorio exatamente como comecou.
#
# Uso:
#   bash tools/transicoes/ausencia.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APROVADOS="$REPO_ROOT/fixtures/snapshots/transicoes"

SNAPSHOTS=(
  "fade-antes"
  "fade-meio"
  "fade-depois"
  "wipe-meio"
  "clock-wipe-meio"
  "slide-meio"
  "cube-meio"
  "flip-quarto"
  "none-meio"
)

TEMP=$(mktemp -d)
BACKUP="$TEMP/backup"
mkdir -p "$BACKUP"

restaurar() {
    local nome
    for nome in "${SNAPSHOTS[@]}"; do
        if [ -f "$BACKUP/$nome.png" ] && [ ! -f "$APROVADOS/$nome.png" ]; then
            cp "$BACKUP/$nome.png" "$APROVADOS/$nome.png"
        fi
    done
}
trap restaurar EXIT

FALHOU=0

echo "=== transicoes:ausencia — ∅-crit das transicoes (F1-10) ==="
echo ""

# ---------------------------------------------------------------------------
# Pre-condicao: todos os snapshots existem (apagar o que nao existe nao prova
# nada — e o denominador zero de sempre)
# ---------------------------------------------------------------------------
for nome in "${SNAPSHOTS[@]}"; do
    if [ ! -f "$APROVADOS/$nome.png" ]; then
        echo "PRÉ-CONDIÇÃO FALHOU: $APROVADOS/$nome.png ausente."
        echo "Rode o provador primeiro (bash tools/transicoes/provar.sh --aprovar)."
        exit 1
    fi
    cp "$APROVADOS/$nome.png" "$BACKUP/$nome.png"
done

for nome in "${SNAPSHOTS[@]}"; do
    echo "=== ausencia: $nome.png ==="

    # -----------------------------------------------------------------------
    # 1. Snapshot apagado -> provar --somente-snapshot VERMELHO (AUSENTE)
    # -----------------------------------------------------------------------
    rm "$APROVADOS/$nome.png"
    saida_provar=$(cd "$REPO_ROOT" && bash tools/transicoes/provar.sh --somente-snapshot 2>&1) && {
        echo "FALHOU: provar.sh --somente-snapshot ficou VERDE com $nome.png apagado"
        FALHOU=1
    } || {
        if ! echo "$saida_provar" | grep -q "AUSENTE" || ! echo "$saida_provar" | grep -q "$nome"; then
            echo "FALHOU: provar.sh ficou vermelho pelo motivo errado:"
            echo "$saida_provar" | tail -5
            FALHOU=1
        else
            echo "  provar.sh VERMELHO pelo motivo certo (AUSENTE: $nome.png)."
        fi
    }

    # -----------------------------------------------------------------------
    # 2. Snapshot apagado -> a suite de testes VERMELHA nomeando a ausencia
    # -----------------------------------------------------------------------
    saida_vitest=$(cd "$REPO_ROOT" && npx vitest run tests/composicao/transicoes.test.ts 2>&1) && {
        echo "FALHOU: vitest ficou VERDE com $nome.png apagado"
        FALHOU=1
    } || {
        if ! echo "$saida_vitest" | grep -qi "ausente"; then
            echo "FALHOU: vitest ficou vermelho pelo motivo errado:"
            echo "$saida_vitest" | tail -5
            FALHOU=1
        else
            echo "  vitest VERMELHO nomeando a ausencia."
        fi
    }

    # -----------------------------------------------------------------------
    # 3. Restaura este snapshot
    # -----------------------------------------------------------------------
    cp "$BACKUP/$nome.png" "$APROVADOS/$nome.png"
done

# ---------------------------------------------------------------------------
# 4. Tudo restaurado -> o gate COMPLETO volta VERDE
# ---------------------------------------------------------------------------
echo ""
echo "=== tudo restaurado: o gate completo tem de voltar VERDE ==="
(cd "$REPO_ROOT" && bash tools/transicoes/provar.sh) || {
    echo "FALHOU: provar.sh VERMELHO com os snapshots restaurados"
    FALHOU=1
}
saida_vitest_final=$(cd "$REPO_ROOT" && npx vitest run tests/composicao/transicoes.test.ts 2>&1) || {
    echo "FALHOU: vitest VERMELHO com os snapshots restaurados"
    echo "$saida_vitest_final" | tail -5
    FALHOU=1
}
if ! echo "$saida_vitest_final" | grep -qE "Tests +41 passed"; then
    echo "FALHOU: vitest nao voltou a 41 passed"
    echo "$saida_vitest_final" | tail -5
    FALHOU=1
fi

echo ""

if [ "$FALHOU" -ne 0 ]; then
    echo "=== VERMELHO: o ∅-crit falhou ==="
    exit 1
fi

echo "=== VERDE: ausencia de snapshot aprovado derruba o gate, presenca restaura o verde ==="
