#!/usr/bin/env bash
# =============================================================================
# res:sem-cassete — ∅-crit executavel
# =============================================================================
# Card: F2-01
#
# O criterio: "um estagio SEM cassete tem de derrubar `just res:offline`,
# e nao ser pulado em silencio."
#
# Este script prova isso do jeito que o card pede — registrando um
# estagio de mentira, mostrando a suite vermelha, removendo, e mostrando
# a suite verde de novo:
#
#   FASE 1  suite limpa   -> VERDE   (linha de base; sem ela, a fase 2 nao
#                                     prova nada: uma suite ja vermelha
#                                     ficaria "vermelha" por outro motivo)
#   FASE 2  estagio falso -> VERMELHO, e a mensagem tem de citar o ∅-crit
#                            e o NOME do estagio. Vermelho generico nao
#                            serve: precisa ser vermelho PELO motivo certo.
#   FASE 3  removido      -> VERDE   (o estado volta; a prova nao deixa
#                                     residuo)
#
# O estagio falso e criado em `src/resolucao/mentira/estagio.ts`, um
# diretorio que nenhum card possui, e removido por `trap` mesmo se o
# script morrer no meio.
#
# Uso:
#   bash tools/resolucao/sem-cassete.sh
# =============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

ESTAGIO_FALSO_DIR="src/resolucao/mentira"
ESTAGIO_FALSO="$ESTAGIO_FALSO_DIR/estagio.ts"
LOG=$(mktemp)

limpar() {
    rm -rf "$REPO_ROOT/$ESTAGIO_FALSO_DIR"
    rm -f "$LOG"
}
trap limpar EXIT

# Guarda: nunca sobrescrever trabalho de outro card.
if [ -e "$ESTAGIO_FALSO_DIR" ]; then
    echo "ABORTADO: $ESTAGIO_FALSO_DIR ja existe. Nao vou sobrescrever."
    exit 2
fi

echo "=== res:sem-cassete — ∅-crit: estagio sem cassete derruba a suite ==="
echo ""

# ---------------------------------------------------------------------------
# FASE 1 — linha de base
# ---------------------------------------------------------------------------
echo "--- FASE 1: suite limpa (linha de base) ---"
if npx tsx tools/resolucao/cobertura.ts > "$LOG" 2>&1; then
    echo "[VERDE] cobertura passa com a arvore limpa"
else
    echo "[FALHOU] a suite ja esta vermelha ANTES da injecao."
    echo "         Sem linha de base verde, a fase 2 nao prova nada."
    cat "$LOG"
    exit 1
fi
echo ""

# ---------------------------------------------------------------------------
# FASE 2 — injeta o estagio de mentira, sem cassete
# ---------------------------------------------------------------------------
echo "--- FASE 2: registrando um estagio de mentira, SEM cassete ---"
mkdir -p "$ESTAGIO_FALSO_DIR"
cat > "$ESTAGIO_FALSO" <<'TS'
/**
 * ESTAGIO DE MENTIRA — criado por tools/resolucao/sem-cassete.sh.
 *
 * Existe por poucos segundos, so para provar que a suite offline nao
 * pula um estagio sem cassete. Se este arquivo sobreviveu a execucao do
 * script, apague-o: `rm -rf src/resolucao/mentira`.
 */
const estagio = {
  identidade: { nome: "mentira", versao: "0.0.0" },
  parametros: {},
  async resolver() {
    throw new Error("estagio de mentira: nunca deveria ser executado");
  },
};
export default estagio;
TS

echo "  criado: $ESTAGIO_FALSO (sem cassete em fixtures/cassetes/mentira/)"
echo ""

if npx tsx tools/resolucao/cobertura.ts > "$LOG" 2>&1; then
    echo "[FALHOU] a cobertura passou COM um estagio sem cassete."
    echo "         O estagio foi PULADO EM SILENCIO — exatamente o que o"
    echo "         ∅-crit proibe."
    cat "$LOG"
    exit 1
fi

echo "[VERMELHO] a cobertura reprovou, como tem de ser. Saida:"
sed 's/^/           /' "$LOG"
echo ""

# Vermelho pelo motivo CERTO, nao por acidente.
FALHAS_DE_MOTIVO=0
if ! grep -q "mentira" "$LOG"; then
    echo "[FALHOU] a saida nao cita o estagio 'mentira' pelo nome."
    FALHAS_DE_MOTIVO=$((FALHAS_DE_MOTIVO + 1))
fi
if ! grep -q "∅-crit" "$LOG"; then
    echo "[FALHOU] a saida nao cita o ∅-crit — vermelho generico nao serve."
    FALHAS_DE_MOTIVO=$((FALHAS_DE_MOTIVO + 1))
fi
if [ "$FALHAS_DE_MOTIVO" -gt 0 ]; then
    echo "         A suite ficou vermelha, mas nao pelo motivo que se quer provar."
    exit 1
fi
echo "  [OK] vermelho pelo motivo certo: cita 'mentira' e cita o ∅-crit"
echo ""

# A mesma coisa pela porta da frente: just res:offline inteiro.
echo "--- FASE 2b: o mesmo estagio derruba 'res:offline' inteiro ---"
if bash tools/resolucao/offline.sh > "$LOG" 2>&1; then
    echo "[FALHOU] res:offline passou COM um estagio sem cassete."
    tail -20 "$LOG"
    exit 1
fi
echo "[VERMELHO] res:offline reprovou. Veredito:"
grep -E "VERMELHO|FALHOU" "$LOG" | sed 's/^/           /' | head -10
echo ""

# ---------------------------------------------------------------------------
# FASE 3 — remove e exige verde de novo
# ---------------------------------------------------------------------------
echo "--- FASE 3: removendo o estagio de mentira ---"
rm -rf "$ESTAGIO_FALSO_DIR"
echo "  removido: $ESTAGIO_FALSO_DIR"
echo ""

if bash tools/resolucao/offline.sh > "$LOG" 2>&1; then
    echo "[VERDE] res:offline volta a passar"
else
    echo "[FALHOU] res:offline continua vermelho depois da remocao."
    echo "         A prova deixou residuo, ou algo mais quebrou."
    tail -20 "$LOG"
    exit 1
fi
echo ""

echo "==="
echo "=== VERDE: ∅-crit provado ==="
echo "    verde limpo -> injeta estagio sem cassete -> VERMELHO pelo motivo"
echo "    certo -> remove -> verde de novo."
