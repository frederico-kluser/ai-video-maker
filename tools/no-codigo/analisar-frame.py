#!/usr/bin/env python3
"""Analise de pixel do still do no de codigo (F1-08).

C1 do AGENTS.md: "exit 0 de um render nao prova que saiu imagem. Quadro preto =
sucesso". Este script e a resposta: ele conta PIXEL, e as cores que ele procura
sao as do proprio componente (cores.json, gerado a partir de tokens.ts) — nunca
valores digitados aqui.

Duas perguntas, uma por modo:

  --modo destacado  as cinco cores distintivas de papel estao no quadro?
                    (se nao estao, o destaque nao foi desenhado — e o gate
                    ficaria verde com um bloco de codigo cinza)
  --modo cru        nenhuma delas pode estar. E o mesmo codigo, sem tokens: se
                    uma cor de papel aparecer, o componente inventou destaque.
                    O quadro ainda tem de estar DESENHADO — codigo na cor
                    neutra — senao "nao ha cor de papel" seria verdade por
                    quadro vazio.

Entrada: RGBA cru na stdin (ffmpeg -pix_fmt rgba), que e o unico decodificador
de PNG disponivel neste repositorio sem instalar dependencia.

Uso:
  ffmpeg -v error -i frame.png -f rawvideo -pix_fmt rgba - \\
    | python3 tools/no-codigo/analisar-frame.py --cores cores.json \\
        --modo destacado --largura 1920 --altura 1080
"""

from __future__ import annotations

import argparse
import array
import json
import sys
from collections import Counter

# Quantos pixels EXATOS bastam para dizer "esta cor foi desenhada".
# Medido no still aprovado (JetBrains Mono 19px, antialiasing do Chrome do
# render): o papel mais raro da fixture e `numero` — os dois digitos de "42" e
# o "0" — com 20 pixels no nucleo dos glifos. Os outros ficam entre 76 e 245.
# 15 fica abaixo do mais raro e muito acima do ruido: antialiasing nao produz
# dezenas de pixels na cor pura. Se o destaque sumir, a contagem vai a ZERO,
# nao a 14 — o limite so precisa separar "desenhou" de "nao desenhou".
MINIMO_PADRAO = 15


def hex_para_rgb(valor: str) -> tuple[int, int, int]:
    v = valor.strip().lstrip("#")
    if len(v) == 3:
        v = "".join(c * 2 for c in v)
    if len(v) != 6:
        raise SystemExit(f"cor fora do formato hexadecimal: {valor!r}")
    return (int(v[0:2], 16), int(v[2:4], 16), int(v[4:6], 16))


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--cores", required=True, help="cores.json escrito por renderizar.ts")
    p.add_argument("--modo", required=True, choices=["destacado", "cru"])
    p.add_argument("--largura", type=int, required=True)
    p.add_argument("--altura", type=int, required=True)
    p.add_argument("--minimo", type=int, default=MINIMO_PADRAO)
    args = p.parse_args()

    with open(args.cores, encoding="utf-8") as fh:
        cores = json.load(fh)

    por_papel = cores["porPapel"]
    distintivos = list(cores["distintivos"])
    sem_destaque = cores["semDestaque"]

    if not distintivos:
        print("FALHOU: nenhum papel distintivo declarado (denominador zero)")
        return 1

    dados = sys.stdin.buffer.read()
    esperado = args.largura * args.altura * 4
    if len(dados) != esperado:
        print(
            f"FALHOU: {len(dados)} bytes na entrada, esperado {esperado} "
            f"({args.largura}x{args.altura} RGBA)"
        )
        return 1

    valores = array.array("I")
    valores.frombytes(dados)
    contagem = Counter(valores)

    def pixels(cor_hex: str) -> int:
        r, g, b = hex_para_rgb(cor_hex)
        total = 0
        for v, n in contagem.items():
            if (v & 0xFF) == r and ((v >> 8) & 0xFF) == g and ((v >> 16) & 0xFF) == b:
                total += n
        return total

    total_pixels = args.largura * args.altura
    distintas = len(contagem)
    modal = contagem.most_common(1)[0][1]
    fracao_modal = modal / total_pixels

    print(f"  cores distintas no quadro: {distintas}")
    print(f"  fracao da cor dominante:   {fracao_modal:.4f}")

    problemas: list[str] = []

    # Um quadro chapado passa em qualquer assercao estrutural. Aqui, nao.
    if distintas < 8:
        problemas.append(f"quadro quase chapado: so {distintas} cores distintas")
    if fracao_modal > 0.999:
        problemas.append(
            f"quadro chapado: {fracao_modal:.4f} do quadro e uma cor so"
        )

    neutros = pixels(sem_destaque)
    print(f"  pixels na cor neutra ({sem_destaque}): {neutros}")
    if neutros < args.minimo:
        problemas.append(
            f"o codigo nao foi desenhado: {neutros} pixel(s) na cor neutra "
            f"(minimo {args.minimo})"
        )

    for papel in distintivos:
        cor = por_papel[papel]
        n = pixels(cor)
        print(f"  papel {papel:<14} {cor}  pixels={n}")
        if args.modo == "destacado" and n < args.minimo:
            problemas.append(
                f"papel {papel} ({cor}) tem {n} pixel(s), minimo {args.minimo} — "
                f"o destaque nao chegou ao quadro"
            )
        if args.modo == "cru" and n > 0:
            problemas.append(
                f"papel {papel} ({cor}) aparece em {n} pixel(s) num quadro SEM "
                f"tokens — o componente inventou destaque"
            )

    if problemas:
        print("FALHOU:")
        for problema in problemas:
            print(f"  - {problema}")
        return 1

    print(f"  analise de pixel OK (modo {args.modo})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
