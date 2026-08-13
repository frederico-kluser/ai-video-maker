#!/usr/bin/env bash
# =============================================================================
# no-lista: determinismo — render 2x, bytes identicos
# =============================================================================
# Card: F1-06
#
# Duas renderizacoes, em DOIS PROCESSOS diferentes, em diretorios diferentes,
# comparadas byte a byte com `cmp`. Processos separados porque o que interessa
# nao e se a funcao devolve o mesmo objeto duas vezes na mesma memoria — e se
# ela devolve os mesmos BYTES numa maquina que acabou de ligar. Ordem de chave,
# semente de hash e relogio nao sobrevivem ao segundo processo.
#
# Tambem confere ENTROPIA (AGENTS.md C1): `exit 0` de um render nao prova que
# saiu imagem. Um arquivo minusculo, ou sem o texto dos itens, e quadro vazio
# com sinal positivo.
#
# Uso: bash tools/no-lista/determinismo.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

TEMP="$(mktemp -d)"
UM="$TEMP/render-1"
DOIS="$TEMP/render-2"
BYTES_MINIMOS=500

cleanup() { rm -rf "$TEMP"; }
trap cleanup EXIT

echo "=== no-lista: determinismo (render 2x, processos separados) ==="
echo ""

echo "Render 1/2..."
npx tsx tools/no-lista/gravar.ts "$UM" > /dev/null
echo "Render 2/2..."
npx tsx tools/no-lista/gravar.ts "$DOIS" > /dev/null

QUANTOS="$(find "$UM" -type f | wc -l)"
if [ "$QUANTOS" -eq 0 ]; then
    echo "FALHOU: o render nao produziu arquivo nenhum (denominador zero, C2)."
    echo ""
    echo "=== VERMELHO ==="
    exit 1
fi
echo "$QUANTOS arquivo(s) por render"
echo ""

DIVERGENTES=0
for arquivo in "$UM"/*; do
    nome="$(basename "$arquivo")"
    if ! cmp -s "$arquivo" "$DOIS/$nome"; then
        echo "  DIVERGE: $nome"
        cmp "$arquivo" "$DOIS/$nome" || true
        DIVERGENTES=$((DIVERGENTES + 1))
        continue
    fi

    tamanho="$(stat -c%s "$arquivo")"
    if [ "$tamanho" -lt "$BYTES_MINIMOS" ]; then
        echo "  FALHOU (entropia): $nome tem so $tamanho bytes"
        DIVERGENTES=$((DIVERGENTES + 1))
        continue
    fi
    echo "  identico: $nome ($tamanho bytes)"
done

echo ""
if [ "$DIVERGENTES" -gt 0 ]; then
    echo "=== VERMELHO: $DIVERGENTES arquivo(s) divergentes ou vazios ==="
    exit 1
fi

# Entropia de conteudo: o texto do vigesimo item TEM de estar no markup.
# Sem isto, "bytes identicos" seria satisfeito por dois quadros vazios iguais.
if ! grep -q "Invariante 20" "$UM/vinte-itens.html"; then
    echo "FALHOU (entropia): o texto do vigesimo item nao esta no markup."
    echo "Dois quadros vazios tambem sao identicos entre si."
    echo ""
    echo "=== VERMELHO ==="
    exit 1
fi
echo "Entropia OK: o texto do vigesimo item esta no markup"
echo ""
echo "=== VERDE: render 2x, bytes identicos ==="
