#!/usr/bin/env python3
"""
Calibration nudge: reinjects calibration rules C1, C2, C9, C12 on every message.

These rules are the most frequently forgotten guardrails of this program.
They are defined in PROGRAMA.html and repeated here so the agent never loses them
from its attention window.

Exit codes: always 0 (this is a nudge, never a gate)
"""

import sys

CALIBRATION_RULES = """
[Calibracao] Regras que NAO podem ser esquecidas:
C1: exit 0 de um render nao prova que saiu imagem. Um quadro preto renderiza com sucesso.
    -> todo gate de render asserta CONTEUDO (entropia do frame), nunca so o codigo de saida.
C2: Um runner de teste com filtro que nao casa nada sai verde.
    -> sempre inclua sonda negativa por alvo: o que o teste imprime se nao fizer nada?
C9: Rodar duas vezes e comparar nao pega o que muda por data, fuso ou maquina.
    -> congele relogio, fuso e locale; normalize por posicao, nunca por valor.
C12: O cache acerta pelo motivo errado quando a chave omite um parametro.
    -> a chave inclui TUDO que muda a saida, e existe teste que muda um parametro por vez e exige cache miss.
"""


def main() -> None:
    print(CALIBRATION_RULES, end="")
    sys.exit(0)


if __name__ == "__main__":
    main()
