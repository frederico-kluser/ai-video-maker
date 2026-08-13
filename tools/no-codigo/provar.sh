#!/usr/bin/env bash
# =============================================================================
# no-codigo — determinismo e snapshot do no de codigo (F1-08)
# =============================================================================
# Tres modos:
#
#   (padrao)            renderiza 2x, exige bytes identicos, compara com o
#                       snapshot aprovado, analisa o pixel e confere o
#                       diretorio de snapshot no git.
#   --somente-snapshot  so a parte de snapshot (existencia + git). Rapido, e o
#                       que a mutacao de ∅-crit usa.
#   --aprovar           renderiza e GRAVA o snapshot aprovado. Ato explicito.
#
# POR QUE APROVAR E UM MODO SEPARADO
# tools/determinismo/provar.sh (F0-06) trata "snapshot ausente" como "primeira
# execucao" e grava o snapshot sozinho — e por isso o teste de ausencia dele
# nao consegue ficar vermelho: apagar o arquivo e rodar de novo simplesmente
# recria o arquivo. Aqui ausencia e VERMELHO, sempre; gravar exige --aprovar.
#
# C3: `git diff --exit-code` nao enxerga arquivo nao rastreado. Por isso a
# conferencia e diff + status, e as duas contam.
# =============================================================================

set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$DIR_SCRIPT/../.." && pwd)"

DIR_SNAPSHOT="$RAIZ/fixtures/snapshots/no-codigo"
DIR_APROVADO="$DIR_SNAPSHOT/aprovado"
CAMINHO_RELATIVO="fixtures/snapshots/no-codigo"

PNG_DESTACADO="$DIR_APROVADO/no-codigo.png"
PNG_CRU="$DIR_APROVADO/no-codigo-cru.png"
MARCACAO="$DIR_APROVADO/no-codigo.html"

LARGURA=1920
ALTURA=1080

MODO="verificar"
case "${1:-}" in
    --somente-snapshot) MODO="somente-snapshot" ;;
    --aprovar) MODO="aprovar" ;;
    "") ;;
    *) echo "uso: provar.sh [--somente-snapshot|--aprovar]"; exit 2 ;;
esac

TEMP=""
limpar() { [ -n "$TEMP" ] && rm -rf "$TEMP"; }
trap 'limpar || true' EXIT

falhar() {
    echo ""
    echo "=== VERMELHO: $1 ==="
    exit 1
}

# ---------------------------------------------------------------------------
# Conferencia do diretorio de snapshot
# ---------------------------------------------------------------------------
conferir_snapshot() {
    echo "=== snapshot: os arquivos aprovados existem? ==="
    local faltando=0
    for arquivo in "$PNG_DESTACADO" "$PNG_CRU" "$MARCACAO"; do
        if [ ! -f "$arquivo" ]; then
            echo "  SNAPSHOT AUSENTE: ${arquivo#"$RAIZ/"}"
            faltando=1
        else
            echo "  ok: ${arquivo#"$RAIZ/"} ($(stat -c%s "$arquivo") bytes)"
        fi
    done
    [ "$faltando" -eq 0 ] || falhar "snapshot aprovado ausente (rode --aprovar e commite)"

    echo "=== snapshot: git diff --exit-code $CAMINHO_RELATIVO/ ==="
    if ! git -C "$RAIZ" diff --exit-code -- "$CAMINHO_RELATIVO/"; then
        falhar "o snapshot mudou em relacao ao commit"
    fi
    echo "  sem diferenca em arquivo rastreado"

    # C3: diff sozinho e cego para arquivo nao rastreado — inclusive para um
    # snapshot recem-gravado que ninguem commitou.
    echo "=== snapshot: git status --porcelain $CAMINHO_RELATIVO/ ==="
    local sujo
    sujo="$(git -C "$RAIZ" status --porcelain -- "$CAMINHO_RELATIVO/")"
    if [ -n "$sujo" ]; then
        echo "$sujo"
        falhar "ha arquivo nao rastreado ou modificado sob $CAMINHO_RELATIVO/"
    fi
    echo "  diretorio limpo e rastreado"
}

if [ "$MODO" = "somente-snapshot" ]; then
    conferir_snapshot
    echo ""
    echo "=== VERDE: snapshot conferido ==="
    exit 0
fi

# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------
TEMP="$(mktemp -d)"

if [ "$MODO" = "verificar" ]; then
    echo "=== pre-condicao: o snapshot aprovado tem de existir ==="
    for arquivo in "$PNG_DESTACADO" "$PNG_CRU" "$MARCACAO"; do
        [ -f "$arquivo" ] || falhar "snapshot ausente: ${arquivo#"$RAIZ/"} (use --aprovar)"
    done
    echo "  os tres artefatos aprovados estao no disco"
fi

echo ""
echo "=== render: um bundle, tres stills ==="
npx tsx "$DIR_SCRIPT/renderizar.ts" --saida "$TEMP"

# ---------------------------------------------------------------------------
# Determinismo: render 2x, byte a byte
# ---------------------------------------------------------------------------
echo ""
echo "=== determinismo: render 1 contra render 2 ==="
if ! cmp -s "$TEMP/render-1.png" "$TEMP/render-2.png"; then
    echo "  render-1: $(sha256sum "$TEMP/render-1.png" | cut -d' ' -f1)"
    echo "  render-2: $(sha256sum "$TEMP/render-2.png" | cut -d' ' -f1)"
    cp "$TEMP/render-1.png" "$TEMP/render-2.png" "$DIR_SNAPSHOT/" 2>/dev/null || true
    falhar "dois renders do mesmo frame divergem — determinismo refutado"
fi
echo "  bytes identicos: $(sha256sum "$TEMP/render-1.png" | cut -d' ' -f1)"

# ---------------------------------------------------------------------------
# Analise de pixel (C1)
# ---------------------------------------------------------------------------
analisar() {
    local arquivo="$1" modo="$2"
    echo ""
    echo "=== pixel ($modo): $arquivo ==="
    ffmpeg -v error -i "$TEMP/$arquivo" -f rawvideo -pix_fmt rgba - \
        | python3 "$DIR_SCRIPT/analisar-frame.py" \
            --cores "$TEMP/cores.json" \
            --modo "$modo" \
            --largura "$LARGURA" \
            --altura "$ALTURA"
}

analisar "render-1.png" "destacado" || falhar "o still com tokens nao desenhou o destaque"
analisar "cru.png" "cru" || falhar "o still SEM tokens tem cor de destaque — improvisou"

# ---------------------------------------------------------------------------
# Grava ou compara
# ---------------------------------------------------------------------------
if [ "$MODO" = "aprovar" ]; then
    mkdir -p "$DIR_APROVADO"
    cp "$TEMP/render-1.png" "$PNG_DESTACADO"
    cp "$TEMP/cru.png" "$PNG_CRU"
    cp "$TEMP/marcacao.html" "$MARCACAO"
    echo ""
    echo "=== snapshot gravado em $CAMINHO_RELATIVO/aprovado/ ==="
    echo "Ele so vale depois de 'git add' + commit: enquanto estiver nao"
    echo "rastreado, a conferencia continua VERMELHA (C3)."
    exit 0
fi

echo ""
echo "=== regressao: render atual contra snapshot aprovado ==="
for par in "render-1.png:$PNG_DESTACADO" "cru.png:$PNG_CRU" "marcacao.html:$MARCACAO"; do
    novo="$TEMP/${par%%:*}"
    aprovado="${par#*:}"
    if ! cmp -s "$novo" "$aprovado"; then
        echo "  ${aprovado#"$RAIZ/"}: DIVERGE"
        echo "    aprovado: $(sha256sum "$aprovado" | cut -d' ' -f1)"
        echo "    atual:    $(sha256sum "$novo" | cut -d' ' -f1)"
        cp "$novo" "$DIR_SNAPSHOT/recebido-${par%%:*}"
        falhar "o render mudou; artefato recebido em $CAMINHO_RELATIVO/recebido-${par%%:*}"
    fi
    echo "  ${aprovado#"$RAIZ/"}: identico"
done

conferir_snapshot

echo ""
echo "=== VERDE: determinismo provado e snapshot conferido ==="
