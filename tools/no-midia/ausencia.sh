#!/usr/bin/env bash
# =============================================================================
# no-midia:ausencia — ∅-crit do no de midia (F1-07)
# =============================================================================
# "Apagar um snapshot aprovado TEM de ficar vermelho" — e o teste disso:
#
#   1. apaga um snapshot de MARCACAO e exige que `marcacao.ts` fique vermelho
#      pelo motivo certo (AUSENTE), nao "passou sem olhar";
#   2. apaga um snapshot de STILL e exige que `provar.ts` fique vermelho pela
#      ausencia — a checagem de presenca dele roda ANTES de renderizar, entao
#      este passo nao paga dois renders de Chrome;
#   3. restaura os dois e exige VERDE nos mesmos comandos.
#
# Sem o passo 3, um script que apaga e nunca restaura deixaria o proprio gate
# vermelho para sempre — o ∅-crit "provado" por uma sonega. Este teste termina
# com o repositorio exatamente como comecou.
#
# A sonda negativa deste script e o proprio script: ele falha se o gate ficar
# VERDE com o snapshot apagado, e falha se ficar VERMELHO com o snapshot
# restaurado.
#
# Uso:
#   bash tools/no-midia/ausencia.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APROVADOS="$REPO_ROOT/fixtures/snapshots/no-midia/aprovados"

MARCACAO_ALVO="marcacao-gif-f000.html"
STILL_ALVO="still-gif-f000.png"

TEMP=$(mktemp -d)
BACKUP="$TEMP/backup"
mkdir -p "$BACKUP"

remover() {
    rm "$1"
}

restaurar() {
    for arquivo in "$MARCACAO_ALVO" "$STILL_ALVO"; do
        if [ -f "$BACKUP/$arquivo" ]; then
            cp "$BACKUP/$arquivo" "$APROVADOS/$arquivo"
        fi
    done
}
trap restaurar EXIT

FALHOU=0

echo "=== no-midia:ausencia — ∅-crit do no de midia ==="
echo ""

# ---------------------------------------------------------------------------
# Pre-condicao: os dois snapshots existem (apagar o que nao existe nao prova
# nada — e o denominador zero de sempre)
# ---------------------------------------------------------------------------
for arquivo in "$MARCACAO_ALVO" "$STILL_ALVO"; do
    if [ ! -f "$APROVADOS/$arquivo" ]; then
        echo "PRÉ-CONDIÇÃO FALHOU: $APROVADOS/$arquivo ausente."
        echo "Rode o provador primeiro (npx tsx tools/no-midia/provar.ts --aprovar)."
        exit 1
    fi
    cp "$APROVADOS/$arquivo" "$BACKUP/$arquivo"
done

# ---------------------------------------------------------------------------
# 1. Marcacao apagada -> gate de marcacao VERMELHO
# ---------------------------------------------------------------------------
remover "$APROVADOS/$MARCACAO_ALVO"
echo "1. snapshot de MARCACAO apagado: $MARCACAO_ALVO"
saida_marcacao=$(cd "$REPO_ROOT" && npx tsx tools/no-midia/marcacao.ts 2>&1) && {
    echo "FALHOU: marcacao.ts ficou VERDE com $MARCACAO_ALVO apagado"
    FALHOU=1
} || {
    if ! echo "$saida_marcacao" | grep -q "AUSENTE"; then
        echo "FALHOU: marcacao.ts ficou vermelho pelo motivo errado:"
        echo "$saida_marcacao" | tail -5
        FALHOU=1
    else
        echo "  VERMELHO pelo motivo certo (AUSENTE)."
    fi
}

saida_vitest=$(cd "$REPO_ROOT" && npx vitest run tests/composicao/no-midia.test.ts -t "identico ao aprovado" 2>&1) && {
    echo "FALHOU: vitest ficou VERDE com $MARCACAO_ALVO apagado"
    FALHOU=1
} || {
    if ! echo "$saida_vitest" | grep -q "AUSENTE"; then
        echo "FALHOU: vitest ficou vermelho pelo motivo errado:"
        echo "$saida_vitest" | tail -5
        FALHOU=1
    else
        echo "  vitest VERMELHO pelo motivo certo (AUSENTE)."
    fi
}

# ---------------------------------------------------------------------------
# 2. Still apagado -> prover VERMELHO pela presenca (sem renderizar)
# ---------------------------------------------------------------------------
cp "$BACKUP/$MARCACAO_ALVO" "$APROVADOS/$MARCACAO_ALVO"
remover "$APROVADOS/$STILL_ALVO"
echo "2. snapshot de STILL apagado: $STILL_ALVO"
saida_provar=$(cd "$REPO_ROOT" && npx tsx tools/no-midia/provar.ts 2>&1) && {
    echo "FALHOU: provar.ts ficou VERDE com $STILL_ALVO apagado"
    FALHOU=1
} || {
    if ! echo "$saida_provar" | grep -q "AUSENTE"; then
        echo "FALHOU: provar.ts ficou vermelho pelo motivo errado:"
        echo "$saida_provar" | tail -5
        FALHOU=1
    else
        echo "  VERMELHO pelo motivo certo (AUSENTE), sem renderizar."
    fi
}

# ---------------------------------------------------------------------------
# 3. Restaurado -> os mesmos comandos VERDES
# ---------------------------------------------------------------------------
restaurar
echo "3. snapshots restaurados."
(cd "$REPO_ROOT" && npx tsx tools/no-midia/marcacao.ts) >/dev/null 2>&1 || {
    echo "FALHOU: marcacao.ts VERMELHO com os snapshots restaurados"
    FALHOU=1
}
(cd "$REPO_ROOT" && npx vitest run tests/composicao/no-midia.test.ts -t "identico ao aprovado" >/dev/null 2>&1) || {
    echo "FALHOU: vitest VERMELHO com os snapshots restaurados"
    FALHOU=1
}

echo ""

if [ "$FALHOU" -ne 0 ]; then
    echo "=== VERMELHO: o ∅-crit falhou ==="
    exit 1
fi

echo "=== VERDE: ausencia de snapshot aprovado derruba o gate, presenca restaura o verde ==="
