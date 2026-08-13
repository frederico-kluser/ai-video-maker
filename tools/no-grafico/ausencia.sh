#!/usr/bin/env bash
# =============================================================================
# ausencia — ∅-crit do card F1-09: apagar snapshot aprovado TEM de ficar
# VERMELHO, e com ele de volta o gate TEM de voltar VERDE
# =============================================================================
# Card: F1-09 (onda W4)
#
# O criterio do PROGRAMA e literal: "apagar um snapshot aprovado tem de ficar
# vermelho". Este script faz exatamente isso, nos DOIS snapshots aprovados, e
# cobra tambem o motivo certo (a mensagem tem de nomear o arquivo ausente —
# um vermelho por "porta ocupada" ou "bundle quebrado" nao prova nada).
#
# Se o snapshot sumir por engano no meio do script, o trap restaura. Nada fica
# quebrado depois de um VERMELHO legitimo.
#
# Uso:  bash tools/no-grafico/ausencia.sh
# Exit: 0 = as duas garantias valem; 1 = alguma sonda nao reprovou
# =============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR_APROVADO="$REPO_ROOT/fixtures/snapshots/no-grafico/aprovado"
BACKUP="$(mktemp -d)"
trap 'restaurar_tudo' EXIT

SNAPSHOTS=(
  "no-grafico-dados-frame20.png"
  "no-grafico-asset-frame20.png"
)

restaurar_tudo() {
    local snap
    for snap in "${SNAPSHOTS[@]}"; do
        if [[ -f "$BACKUP/$snap" && ! -f "$DIR_APROVADO/$snap" ]]; then
            cp "$BACKUP/$snap" "$DIR_APROVADO/$snap"
        fi
    done
}

falhas=0

for snap in "${SNAPSHOTS[@]}"; do
    echo "=== ausencia: $snap ==="

    if [[ ! -f "$DIR_APROVADO/$snap" ]]; then
        echo "FALHOU: pre-condicao — $DIR_APROVADO/$snap nao existe (rode 'just no-grafico-aprovar')"
        exit 1
    fi
    cp "$DIR_APROVADO/$snap" "$BACKUP/$snap"

    # Apaga o snapshot aprovado e exige VERMELHO pelo motivo certo
    rm "$DIR_APROVADO/$snap"
    saida="$(npx tsx tools/no-grafico/provar.ts 2>&1 || true)"
    if [[ "$saida" != *"AUSENTE"* || "$saida" != *"$snap"* || "$saida" == *"VERDE: no-grafico provar"* ]]; then
        echo "FALHOU: apagar $snap nao deixou o gate VERMELHO nomeando o arquivo ausente"
        echo "--- ultimas linhas do provar ---"
        echo "$saida" | tail -8
        falhas=$((falhas + 1))
    else
        echo "  VERMELHO no motivo certo (AUSENTE: $snap)"
    fi

    # Devolve o snapshot e exige VERDE de novo — a sonda nao pode deixar estrago
    cp "$BACKUP/$snap" "$DIR_APROVADO/$snap"
    saida="$(npx tsx tools/no-grafico/provar.ts 2>&1 || true)"
    if [[ "$saida" != *"VERDE: no-grafico provar"* ]]; then
        echo "FALHOU: com $snap de volta o gate nao voltou VERDE"
        echo "--- ultimas linhas do provar ---"
        echo "$saida" | tail -8
        falhas=$((falhas + 1))
    else
        echo "  VERDE com o snapshot de volta"
    fi
done

if [[ $falhas -gt 0 ]]; then
    echo ""
    echo "=== VERMELHO: ausencia (${falhas} sonda(s) nao reprovou(aram)) ==="
    exit 1
fi

echo ""
echo "=== VERDE: apagar snapshot aprovado fica VERMELHO, e o gate volta VERDE ==="
