#!/usr/bin/env bash
# =============================================================================
# transicoes — determinismo e snapshot do card F1-10 (Transicoes)
# =============================================================================
# Tres modos:
#
#   (padrao)            renderiza 2x em PROCESSOS SEPARADOS, exige bytes
#                       identicos (determinismo), roda o oraculo de pixel
#                       (C1: quadro preto reprova), compara com os 9 PNGs
#                       aprovados e confere o diretorio de snapshot no git.
#   --somente-snapshot  so a parte de snapshot (existencia + git). Rapido,
#                       e o que a mutacao de ∅-crit usa.
#   --aprovar           renderiza, roda o oraculo de pixel e GRAVA os 9
#                       snapshots aprovados. Ato explicito.
#
# POR QUE APROVAR E UM MODO SEPARADO
# tools/determinismo/provar.sh (F0-06) trata "snapshot ausente" como "primeira
# execucao" e grava o snapshot sozinho — e por isso o teste de ausencia dele
# nao consegue ficar vermelho: apagar o arquivo e rodar de novo simplesmente
# recria o arquivo. Aqui ausencia e VERMELHO, sempre; gravar exige --aprovar.
#
# C1: o render pode sair com exit 0 e imagem preta. Por isso a regressao
# roda o oraculo de pixel (tools/transicoes/pixels.ts) ANTES de comparar
# bytes — uma regressao que compara preto com preto continua preta.
#
# C3: `git diff --exit-code` nao enxerga arquivo nao rastreado. Por isso a
# conferencia e diff + status, e as duas contam.
# =============================================================================

set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$DIR_SCRIPT/../.." && pwd)"

DIR_SNAPSHOT="$RAIZ/fixtures/snapshots/transicoes"
CAMINHO_RELATIVO="fixtures/snapshots/transicoes"

# Os 9 quadros aprovados — espelho de tools/transicoes/quadros.ts. O teste
# (C2) cobra que quadros.ts e o disco concordem; aqui o disco e o aprovado.
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
  echo "=== snapshot: os 9 quadros aprovados existem? ==="
  local faltando=0
  for nome in "${SNAPSHOTS[@]}"; do
    local arquivo="$DIR_SNAPSHOT/$nome.png"
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

echo "=== pre-condicao: os 9 snapshots aprovados tem de existir ==="
for nome in "${SNAPSHOTS[@]}"; do
  [ -f "$DIR_SNAPSHOT/$nome.png" ] || falhar "snapshot ausente: $nome.png (use --aprovar)"
done
echo "  os 9 quadros aprovados estao no disco"

echo ""
echo "=== render 1: bundle unico, 9 stills (gl: swangle, rasterizacao por software) ==="
npx tsx "$DIR_SCRIPT/renderizar.ts" --saida "$TEMP/render-1"

if [ "$MODO" = "verificar" ]; then
  echo ""
  echo "=== render 2: SEGUNDO PROCESSO, mesmos 9 stills ==="
  npx tsx "$DIR_SCRIPT/renderizar.ts" --saida "$TEMP/render-2"

  # -------------------------------------------------------------------------
  # Determinismo: render 2x, byte a byte
  # -------------------------------------------------------------------------
  echo ""
  echo "=== determinismo: render 1 contra render 2 ==="
  for nome in "${SNAPSHOTS[@]}"; do
    if ! cmp -s "$TEMP/render-1/$nome.png" "$TEMP/render-2/$nome.png"; then
      echo "  $nome.png: DIVERGE"
      echo "    render-1: $(sha256sum "$TEMP/render-1/$nome.png" | cut -d' ' -f1)"
      echo "    render-2: $(sha256sum "$TEMP/render-2/$nome.png" | cut -d' ' -f1)"
      falhar "dois renders do mesmo frame divergem — determinismo refutado"
    fi
    echo "  $nome.png: bytes identicos ($(sha256sum "$TEMP/render-1/$nome.png" | cut -d' ' -f1 | cut -c1-16)…)"
  done
fi

# ---------------------------------------------------------------------------
# Oraculo de pixel (C1) — no render NOVO, antes de qualquer comparacao
# ---------------------------------------------------------------------------
echo ""
echo "=== pixel (C1): o render novo desenha o prometido? ==="
npx tsx "$DIR_SCRIPT/pixels.ts" "$TEMP/render-1" || falhar "o oraculo de pixel reprovou o render novo"

# ---------------------------------------------------------------------------
# Grava ou compara
# ---------------------------------------------------------------------------
if [ "$MODO" = "aprovar" ]; then
  for nome in "${SNAPSHOTS[@]}"; do
    cp "$TEMP/render-1/$nome.png" "$DIR_SNAPSHOT/$nome.png"
  done
  echo ""
  echo "=== snapshot gravado em $CAMINHO_RELATIVO/ ==="
  echo "Ele so vale depois de 'git add' + commit: enquanto estiver nao"
  echo "rastreado, a conferencia continua VERMELHA (C3)."
  exit 0
fi

echo ""
echo "=== regressao: render atual contra snapshot aprovado ==="
for nome in "${SNAPSHOTS[@]}"; do
  novo="$TEMP/render-1/$nome.png"
  aprovado="$DIR_SNAPSHOT/$nome.png"
  if ! cmp -s "$novo" "$aprovado"; then
    echo "  $nome.png: DIVERGE"
    echo "    aprovado: $(sha256sum "$aprovado" | cut -d' ' -f1)"
    echo "    atual:    $(sha256sum "$novo" | cut -d' ' -f1)"
    mkdir -p "$DIR_SNAPSHOT/recebido"
    cp "$novo" "$DIR_SNAPSHOT/recebido/$nome.png"
    falhar "o render mudou; artefato recebido em $CAMINHO_RELATIVO/recebido/$nome.png"
  fi
  echo "  $nome.png: identico"
done

conferir_snapshot

echo ""
echo "=== VERDE: determinismo provado e snapshot conferido ==="
