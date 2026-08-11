#!/usr/bin/env bash
# =============================================================================
# res:offline — a suite de resolucao com a REDE BLOQUEADA
# =============================================================================
# Card: F2-01 — Contrato de estagio de resolucao, cassetes e o orquestrador
#
# A pergunta adversarial: "a suite offline de fato bloqueia a rede, ou so
# nao a usa?" Sao coisas diferentes, e a diferenca so aparece quando
# alguem tenta sair. Aqui a rede e bloqueada em DUAS camadas:
#
#   FORA  namespace de rede do kernel (`unshare --net`). Vale para o
#         processo e para todo subprocesso: nem `curl`, nem `ffmpeg`,
#         nem um `npx` qualquer alcanca a rede. Loopback e levantado
#         de proposito (`ip link set lo up`) porque a sonda do guarda
#         precisa de um servidor local para provar que bloqueio nao e
#         a mesma coisa que ambiente quebrado.
#
#   DENTRO  o guarda em processo (src/resolucao/rede/bloqueio.ts),
#         instalado pelo setup do vitest. Ele bloqueia fetch, socket,
#         http/https e DNS, e falha com uma mensagem ESTAVEL
#         ("REDE BLOQUEADA"), distinguivel de um ENOTFOUND por acaso.
#
# Se `unshare` nao estiver disponivel, o script diz isso em voz alta e
# roda so com a camada de dentro. Ele NAO finge que rodou completo.
#
# O guarda de rede completo (proxy, denominador, subprocesso instrumentado)
# e o card F2-07, na W5. Aqui esta o minimo que torna a prova possivel.
#
# Uso:
#   bash tools/resolucao/offline.sh [--estagio <nome>]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

ESTAGIO=""
while [ $# -gt 0 ]; do
    case "$1" in
        --estagio)
            ESTAGIO="${2:-}"
            shift 2
            ;;
        *)
            echo "res:offline: argumento desconhecido: $1" >&2
            exit 2
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Modo re-entrante: dentro do namespace, o script se chama de novo
# ---------------------------------------------------------------------------
if [ "${RES_OFFLINE_DENTRO_DO_NAMESPACE:-0}" = "1" ]; then
    ETAPAS_FALHAS=0

    echo "=== res:offline — rede bloqueada ==="
    echo ""
    echo "Camada externa: ${RES_OFFLINE_CAMADA_EXTERNA:-desconhecida}"
    echo "Camada interna: guarda em processo (tests/setup/rede-bloqueada.ts)"
    if [ -n "$ESTAGIO" ]; then
        echo "Filtro: --estagio $ESTAGIO"
    fi
    echo ""

    # -----------------------------------------------------------------------
    # Etapa 0 — tripwire: a porta de fuga do guarda so pode aparecer em
    # dois lugares. Um estagio que a usasse "so para testar" desligaria o
    # bloqueio para toda a suite (C11: a busca e no texto, nao na intencao).
    # -----------------------------------------------------------------------
    echo "--- [0/5] tripwire da porta de fuga do guarda ---"
    SIMBOLO="__somenteParaSondaDoGuarda_comRedeLiberada"
    PERMITIDOS="src/resolucao/rede/bloqueio.ts src/resolucao/rede/index.ts tests/resolucao/rede-bloqueada.test.ts tools/resolucao/offline.sh"
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
    # Etapa 1 — sondas de saida, uma por camada.
    #
    # Sem esta etapa toda a suite abaixo poderia estar passando por nao
    # usar a rede, e nao por ela estar fechada. As duas sondas usam IP
    # LITERAL: um ENOTFOUND provaria resolvedor quebrado, nao bloqueio.
    #
    # A sonda de kernel roda num processo LIMPO, sem o guarda carregado —
    # ela mede o namespace, nao o patch. Quando o namespace nao existe,
    # ela e marcada NAO-EXERCITADA em vez de "passar": pular em silencio
    # e o modo de falha que este projeto inteiro existe para nao ter.
    # -----------------------------------------------------------------------
    echo "--- [1/5] sondas de saida: chamadas que TENTAM sair ---"
    if [ "${RES_OFFLINE_TEM_NAMESPACE:-0}" = "1" ]; then
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

    if npx tsx tools/resolucao/sonda-rede.ts --camada processo; then
        :
    else
        echo "         ^ a sonda do guarda em processo reprovou"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # Etapa 2 — suite TypeScript (vitest), com o guarda em processo
    # -----------------------------------------------------------------------
    echo "--- [2/5] vitest: tests/resolucao/ ---"
    ALVO_VITEST="tests/resolucao/"
    if npx vitest run "$ALVO_VITEST" --reporter=default; then
        echo "[PASSOU] vitest"
    else
        echo "[FALHOU] vitest"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # Etapa 3 — schema do manifesto resolvido (pytest + jsonschema)
    # -----------------------------------------------------------------------
    echo "--- [3/5] pytest: schema do manifesto resolvido ---"
    if python3 -m pytest tests/resolucao/test_schema_resolvido.py -q; then
        echo "[PASSOU] schema do manifesto resolvido"
    else
        echo "[FALHOU] schema do manifesto resolvido"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # Etapa 4 — ∅-crit: cobertura de cassetes
    # -----------------------------------------------------------------------
    echo "--- [4/5] ∅-crit: todo estagio descoberto tem cassete ---"
    if [ -n "$ESTAGIO" ]; then
        COBERTURA_ARGS=(--estagio "$ESTAGIO")
    else
        COBERTURA_ARGS=()
    fi
    if npx tsx tools/resolucao/cobertura.ts "${COBERTURA_ARGS[@]}"; then
        echo "[PASSOU] cobertura de cassetes"
    else
        echo "[FALHOU] cobertura de cassetes"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    # -----------------------------------------------------------------------
    # Etapa 5 — chave de cache: um componente por vez
    # -----------------------------------------------------------------------
    echo "--- [5/5] chave de cache: um componente por vez (C12) ---"
    if [ -n "$ESTAGIO" ]; then
        CHAVE_ARGS=(--estagio "$ESTAGIO")
    else
        CHAVE_ARGS=()
    fi
    if npx tsx tools/resolucao/chave.ts "${CHAVE_ARGS[@]}"; then
        echo "[PASSOU] chave de cache"
    else
        echo "[FALHOU] chave de cache"
        ETAPAS_FALHAS=$((ETAPAS_FALHAS + 1))
    fi
    echo ""

    echo "---"
    if [ "$ETAPAS_FALHAS" -gt 0 ]; then
        echo "=== VERMELHO: $ETAPAS_FALHAS etapa(s) falharam com a rede bloqueada ==="
        exit 1
    fi
    echo "=== VERDE: a suite inteira passou com a rede bloqueada ==="
    exit 0
fi

# ---------------------------------------------------------------------------
# Camada externa: entra no namespace de rede, se der
# ---------------------------------------------------------------------------
ARGS=()
if [ -n "$ESTAGIO" ]; then
    ARGS=(--estagio "$ESTAGIO")
fi

if command -v unshare >/dev/null 2>&1 &&
    unshare --map-root-user --net -- true >/dev/null 2>&1; then
    export RES_OFFLINE_DENTRO_DO_NAMESPACE=1
    export RES_OFFLINE_TEM_NAMESPACE=1
    export RES_OFFLINE_CAMADA_EXTERNA="namespace de rede do kernel (unshare --net), vale para subprocessos"
    exec unshare --map-root-user --net -- bash -c '
        # Loopback ligado: bloqueio nao pode ser confundido com ambiente
        # quebrado, e a sonda do guarda precisa de um servidor local.
        ip link set lo up 2>/dev/null || true
        exec bash "$0" "$@"
    ' "$0" "${ARGS[@]+"${ARGS[@]}"}"
fi

echo "=== res:offline ==="
echo ""
echo "AVISO: 'unshare --net' indisponivel nesta maquina."
echo "       A camada externa (namespace de rede, que cobre subprocessos)"
echo "       NAO foi aplicada. Rodando so com o guarda em processo."
echo "       Isso e um resultado mais fraco, e esta dito em voz alta de"
echo "       proposito: relatar VERDE sem a camada externa seria maquiagem."
echo ""
export RES_OFFLINE_DENTRO_DO_NAMESPACE=1
export RES_OFFLINE_TEM_NAMESPACE=0
export RES_OFFLINE_CAMADA_EXTERNA="AUSENTE (unshare indisponivel) — so o guarda em processo"
exec bash "$0" "${ARGS[@]+"${ARGS[@]}"}"
