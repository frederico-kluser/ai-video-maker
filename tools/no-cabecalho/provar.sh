#!/usr/bin/env bash
# =============================================================================
# no-cabecalho — prova de determinismo e snapshot do no de cabecalho (F1-04)
# =============================================================================
# Card: F1-04 — onda W4.
#
# O que este script prova, em ordem:
#
#   1. DETERMINISMO       cada still e renderizado 2x, a partir de DOIS bundles
#                         independentes, e os bytes tem de ser identicos.
#                         Qualquer byte diferente refuta o determinismo.
#
#   2. ENTROPIA (C1)      "exit 0 de um render nao prova que saiu imagem".
#                         Cada still aprovado tem de ter faixa de luminancia
#                         (YMAX - YMIN) acima do limiar: um campo de cor
#                         uniforme REPROVA.
#
#   3. QUADRO VAZIO       a composicao `no-cabecalho-fora-da-janela` renderiza
#                         o MESMO no um frame DEPOIS da duracao declarada.
#                         Ela tem de sair uniforme (o componente nao desenha
#                         fora da propria janela) e tem de DIFERIR de todo
#                         snapshot aprovado. E a resposta executavel para
#                         "o smoke passaria com um quadro vazio?": nao passa,
#                         porque o quadro vazio esta aqui e e reprovado.
#
#   4. SNAPSHOT           o still tem de bater byte a byte com o aprovado.
#                         Aprovado AUSENTE e VERMELHO — nunca "primeira
#                         execucao, vou gerar". Gerar so com --aprovar.
#
#   5. ARVORE LIMPA (C3)  `git diff --exit-code` NAO enxerga arquivo nao
#                         rastreado. Por isso ele vem casado com
#                         `git status --porcelain` no mesmo diretorio.
#
# Uso:
#   bash tools/no-cabecalho/provar.sh              # gate
#   bash tools/no-cabecalho/provar.sh --aprovar    # (re)gera os aprovados
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ENTRADA="$REPO_ROOT/fixtures/snapshots/no-cabecalho/entrada.tsx"
DIR_SNAPSHOT="$REPO_ROOT/fixtures/snapshots/no-cabecalho"
APROVADOS="$DIR_SNAPSHOT/aprovados"

# Composicao:frame:arquivo — a lista de stills aprovados deste card.
# Este diretorio pertence exclusivamente a F1-04 (docs/contrato-w4.md §1),
# entao cobrar a lista COMPLETA aqui nao pode virar falso por merge de irmao.
SPECS=(
  "no-cabecalho-centro:3:centro-frame3.png"
  "no-cabecalho-centro:45:centro-frame45.png"
  "no-cabecalho-esquerda:20:esquerda-frame20.png"
)

# Controle negativo: mesmo no, primeiro frame FORA da janela declarada.
CONTROLE_COMP="no-cabecalho-fora-da-janela"
CONTROLE_FRAME=90
CONTROLE_ARQUIVO="fora-da-janela-frame90.png"

# Limiares. Um still com conteudo mede ~207 de faixa; o campo uniforme mede 0.
LIMIAR_FAIXA_LUMA=100
LIMIAR_BYTES=1000

APROVAR=0
if [[ "${1:-}" == "--aprovar" ]]; then
    APROVAR=1
fi

TEMP=$(mktemp -d)
cleanup() { rm -rf "$TEMP"; }
trap cleanup EXIT

vermelho() {
    echo ""
    echo "=== VERMELHO: $* ==="
    exit 1
}

echo "=== no-cabecalho: determinismo + snapshot ==="
echo ""

# ---------------------------------------------------------------------------
# Pre-condicoes — ferramenta ausente e VERMELHO, nunca "pulado"
# ---------------------------------------------------------------------------
command -v ffmpeg >/dev/null 2>&1 || vermelho "ffmpeg ausente (a assercao de entropia precisa dele)"
[ -f "$ENTRADA" ] || vermelho "ponto de entrada ausente: $ENTRADA"
mkdir -p "$APROVADOS"

# ---------------------------------------------------------------------------
# Faixa de luminancia do PNG — a assercao de conteudo (C1)
# ---------------------------------------------------------------------------
faixa_luma() {
    local arquivo="$1"
    local saida ymin ymax
    saida=$(ffmpeg -hide_banner -i "$arquivo" -vf "signalstats,metadata=print:file=-" -f null - 2>/dev/null)
    ymin=$(printf '%s\n' "$saida" | grep -m1 'lavfi.signalstats.YMIN=' | cut -d= -f2)
    ymax=$(printf '%s\n' "$saida" | grep -m1 'lavfi.signalstats.YMAX=' | cut -d= -f2)
    if [ -z "$ymin" ] || [ -z "$ymax" ]; then
        echo "ERRO"
        return
    fi
    # signalstats devolve inteiro em YMIN/YMAX; corta qualquer decimal por seguranca.
    printf '%s\n' "$(( ${ymax%%.*} - ${ymin%%.*} ))"
}

# ---------------------------------------------------------------------------
# 1. Dois bundles independentes
# ---------------------------------------------------------------------------
echo "Bundle 1/2..."
npx remotion bundle "$ENTRADA" --out-dir="$TEMP/b1" >/dev/null 2>&1 \
    || vermelho "bundle 1 falhou"
echo "Bundle 2/2..."
npx remotion bundle "$ENTRADA" --out-dir="$TEMP/b2" >/dev/null 2>&1 \
    || vermelho "bundle 2 falhou"
[ -f "$TEMP/b1/index.html" ] || vermelho "bundle 1 sem index.html"
[ -f "$TEMP/b2/index.html" ] || vermelho "bundle 2 sem index.html"
echo ""

mkdir -p "$TEMP/r1" "$TEMP/r2"

renderizar() {
    local bundle="$1" comp="$2" frame="$3" saida="$4"
    npx remotion still "$bundle" "$comp" "$saida" --frame="$frame" --gl=swangle >/dev/null 2>&1 \
        || vermelho "render falhou: $comp frame $frame"
    [ -f "$saida" ] || vermelho "render nao produziu arquivo: $comp frame $frame"
}

# ---------------------------------------------------------------------------
# 2. Controle negativo — o quadro vazio, renderizado de verdade
# ---------------------------------------------------------------------------
echo "Controle negativo: $CONTROLE_COMP frame $CONTROLE_FRAME (fora da janela declarada)"
renderizar "$TEMP/b1" "$CONTROLE_COMP" "$CONTROLE_FRAME" "$TEMP/$CONTROLE_ARQUIVO"
FAIXA_CONTROLE=$(faixa_luma "$TEMP/$CONTROLE_ARQUIVO")
[ "$FAIXA_CONTROLE" != "ERRO" ] || vermelho "ffmpeg nao devolveu YMIN/YMAX do controle"
if [ "$FAIXA_CONTROLE" -ne 0 ]; then
    vermelho "o componente DESENHOU fora da janela declarada (faixa de luma $FAIXA_CONTROLE, esperado 0)"
fi
echo "  faixa de luma 0 — nada foi desenhado fora da janela. OK"
echo ""

# ---------------------------------------------------------------------------
# 3. Cada still: 2x, entropia, diferente do vazio, igual ao aprovado
# ---------------------------------------------------------------------------
FALHAS=0
for spec in "${SPECS[@]}"; do
    COMP="${spec%%:*}"
    RESTO="${spec#*:}"
    FRAME="${RESTO%%:*}"
    ARQ="${RESTO#*:}"

    echo "still: $COMP frame $FRAME -> $ARQ"

    renderizar "$TEMP/b1" "$COMP" "$FRAME" "$TEMP/r1/$ARQ"
    renderizar "$TEMP/b2" "$COMP" "$FRAME" "$TEMP/r2/$ARQ"

    # --- determinismo ---
    if ! cmp -s "$TEMP/r1/$ARQ" "$TEMP/r2/$ARQ"; then
        echo "  FALHOU: render 1 e render 2 divergem (determinismo refutado)"
        FALHAS=$((FALHAS + 1))
        continue
    fi
    echo "  determinismo: 2 renders, bytes identicos"

    # --- entropia (C1) ---
    BYTES=$(stat -c%s "$TEMP/r1/$ARQ")
    if [ "$BYTES" -lt "$LIMIAR_BYTES" ]; then
        echo "  FALHOU: arquivo pequeno demais ($BYTES bytes)"
        FALHAS=$((FALHAS + 1))
        continue
    fi
    FAIXA=$(faixa_luma "$TEMP/r1/$ARQ")
    if [ "$FAIXA" = "ERRO" ]; then
        echo "  FALHOU: ffmpeg nao devolveu YMIN/YMAX"
        FALHAS=$((FALHAS + 1))
        continue
    fi
    if [ "$FAIXA" -lt "$LIMIAR_FAIXA_LUMA" ]; then
        echo "  FALHOU: quadro sem conteudo (faixa de luma $FAIXA < $LIMIAR_FAIXA_LUMA)"
        FALHAS=$((FALHAS + 1))
        continue
    fi
    echo "  entropia: faixa de luma $FAIXA, $BYTES bytes"

    # --- nao pode ser igual ao quadro vazio ---
    if cmp -s "$TEMP/r1/$ARQ" "$TEMP/$CONTROLE_ARQUIVO"; then
        echo "  FALHOU: still identico ao quadro vazio — o smoke estaria cego"
        FALHAS=$((FALHAS + 1))
        continue
    fi
    echo "  diferente do quadro vazio"

    # --- snapshot ---
    if [ "$APROVAR" -eq 1 ]; then
        cp "$TEMP/r1/$ARQ" "$APROVADOS/$ARQ"
        echo "  aprovado (escrito em fixtures/snapshots/no-cabecalho/aprovados/$ARQ)"
        continue
    fi

    if [ ! -f "$APROVADOS/$ARQ" ]; then
        echo "  FALHOU: snapshot aprovado AUSENTE ($APROVADOS/$ARQ)"
        echo "          ausencia e vermelho. Para (re)aprovar: just no-cabecalho-aprovar"
        FALHAS=$((FALHAS + 1))
        continue
    fi
    if ! cmp -s "$TEMP/r1/$ARQ" "$APROVADOS/$ARQ"; then
        echo "  FALHOU: render diverge do snapshot aprovado"
        FALHAS=$((FALHAS + 1))
        continue
    fi
    echo "  snapshot: identico ao aprovado"
done
echo ""

if [ "$FALHAS" -gt 0 ]; then
    vermelho "$FALHAS still(s) reprovado(s)"
fi

# ---------------------------------------------------------------------------
# 4. O diretorio aprovado nao tem sobra nem falta
# ---------------------------------------------------------------------------
ESPERADOS=$(printf '%s\n' "${SPECS[@]}" | sed 's/.*://' | sort)
NO_DISCO=$(ls -A "$APROVADOS" 2>/dev/null | sort || true)
if [ "$ESPERADOS" != "$NO_DISCO" ]; then
    echo "esperado em aprovados/:"; printf '%s\n' "$ESPERADOS" | sed 's/^/  /'
    echo "no disco:";               printf '%s\n' "$NO_DISCO"  | sed 's/^/  /'
    vermelho "o diretorio aprovado diverge da lista de stills deste card"
fi
echo "aprovados/: $(printf '%s\n' "$NO_DISCO" | wc -l) arquivo(s), exatamente os esperados"

if [ "$APROVAR" -eq 1 ]; then
    echo ""
    echo "=== VERDE: snapshots (re)aprovados. Revise o diff e commite. ==="
    exit 0
fi

# ---------------------------------------------------------------------------
# 5. Arvore limpa — diff E status, porque diff sozinho nao ve nao-rastreado (C3)
# ---------------------------------------------------------------------------
cd "$REPO_ROOT"
if ! git diff --exit-code -- "fixtures/snapshots/no-cabecalho/" >/dev/null; then
    git --no-pager diff --stat -- "fixtures/snapshots/no-cabecalho/"
    vermelho "git diff acusou mudanca em fixtures/snapshots/no-cabecalho/"
fi
SUJO=$(git status --porcelain -- "fixtures/snapshots/no-cabecalho/")
if [ -n "$SUJO" ]; then
    printf '%s\n' "$SUJO"
    vermelho "git status acusou arquivo nao rastreado/modificado em fixtures/snapshots/no-cabecalho/"
fi
echo "arvore limpa: git diff --exit-code E git status --porcelain, os dois vazios"

echo ""
echo "=== VERDE: determinismo provado, snapshots batem, quadro vazio reprovado ==="
