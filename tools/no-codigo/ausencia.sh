#!/usr/bin/env bash
# =============================================================================
# no-codigo — ∅-crit: apagar um snapshot aprovado TEM de ficar vermelho (F1-08)
# =============================================================================
# Prova por mutacao, tres vezes, cada uma com um motivo diferente de vermelho:
#
#   A  apagar o PNG aprovado          -> vermelho por AUSENCIA
#   B  intruso nao rastreado no dir   -> vermelho so por `git status`; o
#                                        `git diff --exit-code` sozinho fica
#                                        VERDE aqui, e este e o ponto (C3)
#   C  mexer um byte do PNG aprovado  -> vermelho por `git diff`
#
# Antes e depois de cada mutacao o gate tem de estar VERDE. Um gate que nunca
# foi visto passar do verde para o vermelho e de volta nao provou nada.
#
# O estado do repositorio e restaurado ao fim, inclusive se o script morrer.
# =============================================================================

set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$DIR_SCRIPT/../.." && pwd)"

CAMINHO_RELATIVO="fixtures/snapshots/no-codigo"
DIR_APROVADO="$RAIZ/$CAMINHO_RELATIVO/aprovado"
ALVO="$DIR_APROVADO/no-codigo.png"
INTRUSO="$DIR_APROVADO/intruso-nao-rastreado.png"

TEMP="$(mktemp -d)"

restaurar() {
    rm -f "$INTRUSO"
    if [ -f "$TEMP/backup.png" ]; then
        cp "$TEMP/backup.png" "$ALVO"
    fi
    rm -rf "$TEMP"
}
trap restaurar EXIT

gate() {
    bash "$DIR_SCRIPT/provar.sh" --somente-snapshot > "$TEMP/saida.txt" 2>&1
}

exigir_verde() {
    if gate; then
        echo "  VERDE — $1"
    else
        echo "  esperava VERDE e veio VERMELHO — $1"
        sed 's/^/    /' "$TEMP/saida.txt"
        exit 1
    fi
}

exigir_vermelho() {
    local motivo="$2"
    if gate; then
        echo "  FALHOU: esperava VERMELHO e o gate passou — $1"
        sed 's/^/    /' "$TEMP/saida.txt"
        exit 1
    fi
    if ! grep -q "$motivo" "$TEMP/saida.txt"; then
        echo "  FALHOU: ficou vermelho, mas nao por \"$motivo\" — $1"
        sed 's/^/    /' "$TEMP/saida.txt"
        exit 1
    fi
    echo "  VERMELHO por \"$motivo\" — $1"
}

echo "=== ∅-crit do no-codigo: a ausencia de snapshot fica vermelha? ==="
echo ""

echo "[0] estado inicial"
[ -f "$ALVO" ] || { echo "  PRE-CONDICAO FALHOU: $ALVO nao existe"; exit 1; }
cp "$ALVO" "$TEMP/backup.png"
exigir_verde "base"

echo ""
echo "[A] apagando o snapshot aprovado"
rm -f "$ALVO"
exigir_vermelho "snapshot apagado" "SNAPSHOT AUSENTE"
cp "$TEMP/backup.png" "$ALVO"
exigir_verde "snapshot restaurado"

echo ""
echo "[B] intruso nao rastreado no diretorio de snapshot"
cp "$TEMP/backup.png" "$INTRUSO"
# A demonstracao de C3: o diff sozinho NAO enxerga isto.
if git -C "$RAIZ" diff --exit-code -- "$CAMINHO_RELATIVO/" > /dev/null 2>&1; then
    echo "  (git diff --exit-code sozinho: VERDE — cego para o intruso, C3)"
else
    echo "  FALHOU: o diff acusou o intruso; a demonstracao de C3 nao vale mais"
    exit 1
fi
exigir_vermelho "intruso presente" "nao rastreado"
rm -f "$INTRUSO"
exigir_verde "intruso removido"

echo ""
echo "[C] mexendo um byte do snapshot aprovado"
printf '\x00' >> "$ALVO"
exigir_vermelho "snapshot corrompido" "o snapshot mudou"
cp "$TEMP/backup.png" "$ALVO"
exigir_verde "snapshot restaurado"

echo ""
echo "=== VERDE: as tres mutacoes ficaram vermelhas, e o gate voltou ao verde ==="
