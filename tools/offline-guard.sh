#!/usr/bin/env bash
# =============================================================================
# offline-guard.sh — a suite offline integrada (card F2-07, W5)
# =============================================================================
# A pergunta adversarial desta suite: "o pipeline abaixo da autoria roda sem
# rede — de verdade, em todas as camadas?" Resposta executavel em QUATRO
# camadas, cada uma com a sonda que a distingue de "ambiente quebrado":
#
#   KERNEL      namespace de rede (`unshare --net`) — vale para o processo
#               E para todo subprocesso: nem curl, nem ffmpeg, nem um npx
#               alcanca a rede. Loopback levantado de proposito (a sonda
#               em processo precisa de um servidor local para provar que
#               bloqueio != ambiente quebrado).
#   SUBPROCESSO sonda que SOBE um processo limpo tentando conectar num IP
#               literal (tools/offline-guard.ts --sonda subprocesso). O
#               guarda em processo nao alcanca filhos; so o kernel pode.
#   PROCESSO    guarda em processo (src/resolucao/rede/bloqueio.ts,
#               instalado pelo setup do vitest): fetch, socket, http/https
#               e DNS morrem com a mensagem ESTAVEL "REDE BLOQUEADA",
#               distinguivel de um ENOTFOUND por acaso.
#   VITEST      a suite inteira (tests/**, inclusive tests/integracao/
#               resolucao — os 5 estagios reais rodando a partir dos
#               cassetes) + pytest do schema, com as camadas acima ativas.
#
# Alem das camadas, dois tripwires:
#   - porta de fuga do guarda (__somenteParaSondaDoGuarda_*) so nos
#     arquivos autorizados (C11: busca no texto, nao na intencao);
#   - nenhum cassete commitado carrega header volatil de resposta
#     (offline-guard.ts --verifica-cassetes; AB-440/473/475).
#
# Se `unshare` nao estiver disponivel, o script diz isso em voz alta e roda
# so com as camadas em processo. Ele NAO finge que rodou completo: as
# sondas de kernel e subprocesso sao marcadas NAO-EXERCITADA, nunca
# "passaram".
#
# Uso:
#   bash tools/offline-guard.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Modo re-entrante: dentro do namespace, o script se chama de novo
# ---------------------------------------------------------------------------
if [ "${OFFLINE_GUARD_DENTRO_DO_NAMESPACE:-0}" = "1" ]; then
    ETAPAS_FALHAS=0

    echo "=== offline-guard — suite offline integrada (F2-07) ==="
    echo ""
    echo "Camada externa: ${OFFLINE_GUARD_CAMADA_EXTERNA:-desconhecida}"
    echo "Camada interna: guarda em processo (tests/setup/rede-bloqueada.ts)"
    echo ""

    # -----------------------------------------------------------------------
    # [0/9] tripwire da porta de fuga do guarda
    # -----------------------------------------------------------------------
    echo "--- [0/9] tripwire da porta de fuga do guarda ---"
    # O simbolo e montado de duas partes de proposito: este proprio script
    # precisa do NOME para procura-lo, mas a presenca do literal aqui faria
    # o tripwire do IRMAO (tools/resolucao/offline.sh, PERMITIDOS fechado)
    # apontar este arquivo como vazamento — e `just res-offline` ficaria
    # vermelho. O arquivo so referencia o simbolo para DETECTA-lo.
    SIMBOLO="__somenteParaSondaDoGuarda_""comRedeLiberada"
    PERMITIDOS="src/resolucao/rede/bloqueio.ts src/resolucao/rede/index.ts tests/resolucao/rede-bloqueada.test.ts tools/resolucao/offline.sh tools/offline-guard.sh"
    VAZAMENTOS=""
    while IFS= read -r arquivo; do
        [ -z "$arquivo" ] && continue
        case " $PERMITIDOS " in
            *" $arquivo "*) continue ;;
        esac
        VAZAMENTOS="$VAZAMENTOS $arquivo"
    done < <(grep -rl "$SIMBOLO" --include='*.ts' --include='*.tsx' --include='*.sh' \
                src tests tools fixtures 2>/dev/null || true)

    if [ -n "$VAZAMENTOS" ]; then
        echo "[FALHOU] a porta de fuga do guarda aparece fora dos arquivos autorizados:"
        for a in $VAZAMENTOS; do echo "         $a"; done
        echo "         Um estagio que desliga o guarda torna 'offline' uma palavra."
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    else
        echo "[PASSOU] a porta de fuga so existe onde deve"
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [1/9] sonda de kernel (IP literal, processo limpo)
    # -----------------------------------------------------------------------
    echo "--- [1/9] sonda de kernel: chamada que TENTA sair ---"
    if [ "${OFFLINE_GUARD_TEM_NAMESPACE:-0}" = "1" ]; then
        if npx tsx tools/resolucao/sonda-rede.ts --camada kernel; then
            :
        else
            echo "         ^ a sonda de kernel reprovou"
            ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
        fi
    else
        echo "[NAO-EXERCITADA] sonda de kernel — sem namespace de rede nesta maquina"
        echo "                 a camada externa nao existe aqui; ver o aviso acima"
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [2/9] sonda de SUBPROCESSO: filhos limpos tambem tem de ser barrados
    # -----------------------------------------------------------------------
    echo "--- [2/9] sonda de subprocesso: filhos limpos tentando sair ---"
    if [ "${OFFLINE_GUARD_TEM_NAMESPACE:-0}" = "1" ]; then
        if npx tsx tools/offline-guard.ts --sonda subprocesso; then
            :
        else
            echo "         ^ a sonda de subprocesso reprovou"
            ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
        fi
    else
        echo "[NAO-EXERCITADA] sonda de subprocesso — sem namespace, o filho alcanca a rede"
        echo "                 o guarda em processo nao cobre filhos; ver o aviso acima"
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [3/9] sonda em processo (fetch, socket, http, https, DNS)
    # -----------------------------------------------------------------------
    echo "--- [3/9] sonda em processo: o guarda instalado bloqueia ---"
    if npx tsx tools/resolucao/sonda-rede.ts --camada processo; then
        :
    else
        echo "         ^ a sonda em processo reprovou"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [4/9] tripwire de headers volateis nos cassetes (AB-440/473/475)
    # -----------------------------------------------------------------------
    echo "--- [4/9] tripwire: cassetes commitados sem header volatil ---"
    if npx tsx tools/offline-guard.ts --verifica-cassetes; then
        :
    else
        echo "         ^ cassete carrega header volatil — rode --redige-cassetes"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [5/9] vitest COMPLETO — a suite inteira, com as camadas acima ativas
    # -----------------------------------------------------------------------
    echo "--- [5/9] vitest: suite completa (tests/**, incl. tests/integracao/resolucao) ---"
    if npx vitest run --passWithNoTests; then
        echo "[PASSOU] vitest"
    else
        echo "[FALHOU] vitest"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [6/9] schema do manifesto resolvido (pytest + jsonschema)
    # -----------------------------------------------------------------------
    echo "--- [6/9] pytest: schema do manifesto resolvido ---"
    if python3 -m pytest tests/resolucao/test_schema_resolvido.py -q; then
        echo "[PASSOU] schema do manifesto resolvido"
    else
        echo "[FALHOU] schema do manifesto resolvido"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [7/9] ∅-crit: todo estagio descoberto tem cassete
    # -----------------------------------------------------------------------
    echo "--- [7/9] ∅-crit: cobertura de cassetes (estagio sem cassete derruba) ---"
    if npx tsx tools/resolucao/cobertura.ts; then
        echo "[PASSOU] cobertura de cassetes"
    else
        echo "[FALHOU] cobertura de cassetes"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [8/9] chave de cache: um componente por vez (C12)
    # -----------------------------------------------------------------------
    echo "--- [8/9] chave de cache: um componente por vez (C12) ---"
    if npx tsx tools/resolucao/chave.ts; then
        echo "[PASSOU] chave de cache"
    else
        echo "[FALHOU] chave de cache"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # [9/9] denominador de cassetes e estagios (anti-vacuidade C2)
    # -----------------------------------------------------------------------
    echo "--- [9/9] denominador: cassetes e chamadas gravadas ---"
    TOTAL_CASSETES=$(find fixtures/cassetes -mindepth 2 -maxdepth 2 -type d -name '[0-9a-f]*' 2>/dev/null | wc -l)
    TOTAL_CHAMADAS=$(python3 -c "
import json,glob
n=0
for f in glob.glob('fixtures/cassetes/*/*/chamadas.json'):
    n += len(json.load(open(f)))
print(n)
" 2>/dev/null || echo 0)
    ESTAGIOS=$(find src/resolucao -mindepth 2 -maxdepth 2 -name estagio.ts | wc -l)
    echo "  estagios descobertos: $ESTAGIOS"
    echo "  cassetes commitados:  $TOTAL_CASSETES"
    echo "  chamadas gravadas:    $TOTAL_CHAMADAS"
    if [ "$TOTAL_CASSETES" -lt 5 ]; then
        echo "[FALHOU] menos de 5 cassetes commitados — a suite estaria verde por vacuidade"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    elif [ "$TOTAL_CHAMADAS" -eq 0 ]; then
        echo "[FALHOU] zero chamadas gravadas — nada foi exercitado"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    else
        echo "[PASSOU] denominador: $ESTAGIOS estagios, $TOTAL_CASSETES cassetes, $TOTAL_CHAMADAS chamadas"
    fi
    echo ""

    echo "---"
    if [ "$ETAPAS_FALHAS" -gt 0 ]; then
        echo "=== VERMELHO: $ETAPAS_FALHAS etapa(s) falharam com a rede bloqueada ==="
        exit 1
    fi
    echo "=== VERDE: a suite integrada inteira passou com a rede bloqueada ==="
    exit 0
fi

# ---------------------------------------------------------------------------
# Camada externa: entra no namespace de rede, se der
# ---------------------------------------------------------------------------
if command -v unshare >/dev/null 2>&1 &&
    unshare --map-root-user --net -- true >/dev/null 2>&1; then
    export OFFLINE_GUARD_DENTRO_DO_NAMESPACE=1
    export OFFLINE_GUARD_TEM_NAMESPACE=1
    export OFFLINE_GUARD_CAMADA_EXTERNA="namespace de rede do kernel (unshare --net), vale para subprocessos"
    exec unshare --map-root-user --net -- bash -c '
        # Loopback ligado: bloqueio nao pode ser confundido com ambiente
        # quebrado, e a sonda do guarda precisa de um servidor local.
        ip link set lo up 2>/dev/null || true
        exec bash "$0" "$@"
    ' "$0"
fi

echo "=== offline-guard ==="
echo ""
echo "AVISO: 'unshare --net' indisponivel nesta maquina."
echo "       A camada externa (namespace de rede, que cobre subprocessos)"
echo "       NAO foi aplicada. Rodando so com o guarda em processo e o"
echo "       tripwire de cassetes. Isso e um resultado mais fraco, e esta"
echo "       dito em voz alta de proposito: relatar VERDE sem a camada"
echo "       externa seria maquiagem."
echo ""
export OFFLINE_GUARD_DENTRO_DO_NAMESPACE=1
export OFFLINE_GUARD_TEM_NAMESPACE=0
export OFFLINE_GUARD_CAMADA_EXTERNA="AUSENTE (unshare indisponivel) — so o guarda em processo"
exec bash "$0"
