#!/usr/bin/env python3
"""Gera a tabela de ondas em markdown a partir do cards.json.

A tabela é derivada do atributo `deps` de cada card — nunca redigitada.
Uso: python3 tools/gerar-tabela-de-ondas.py [caminho/para/cards.json]
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

# Carrega validate_graph via importlib
_tools_dir = Path(__file__).resolve().parent
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "validate_graph", _tools_dir / "validate-graph.py"
)
assert _spec is not None
_vg = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_vg)


def wave_ordinal(wave: str) -> int:
    return _vg.wave_ordinal(wave)


def load_cards(path: str) -> list[dict]:
    return _vg.load_cards(path)


def build_index(cards: list[dict]) -> dict[str, dict]:
    return _vg.build_index(cards)


def compute_levels(cards: list[dict], index: dict[str, dict]) -> dict[str, int]:
    return _vg.compute_levels(cards, index)


def generate_wave_table(cards: list[dict]) -> str:
    """Gera a tabela de ondas em markdown."""
    index = build_index(cards)
    levels = compute_levels(cards, index)

    # Agrupa cards por onda
    wave_cards: dict[str, list[dict]] = defaultdict(list)
    for c in cards:
        wave_cards[c["wave"]].append(c)

    # Ordena ondas por ordinal
    sorted_waves = sorted(wave_cards.keys(), key=wave_ordinal)

    # Calcula níveis por onda
    wave_min_level: dict[str, int] = {}
    wave_max_level: dict[str, int] = {}
    for wave, wcards in wave_cards.items():
        wlevels = [levels.get(c["id"], 0) for c in wcards]
        wave_min_level[wave] = min(wlevels) if wlevels else 0
        wave_max_level[wave] = max(wlevels) if wlevels else 0

    # Detecta ondas de composição
    dependents: dict[str, list[str]] = defaultdict(list)
    for c in cards:
        for dep in c.get("deps", []):
            dependents[dep].append(c["id"])

    composition_waves: set[str] = set()
    for c in cards:
        deps_of_me = dependents.get(c["id"], [])
        if len(deps_of_me) >= 2:
            consumer_waves = set()
            for dep_id in deps_of_me:
                if dep_id in index:
                    consumer_waves.add(index[dep_id]["wave"])
            if len(consumer_waves) == 1:
                cons_wave = next(iter(consumer_waves))
                c_ord = wave_ordinal(c["wave"])
                cons_ord = wave_ordinal(cons_wave)
                if cons_ord == c_ord + 1:
                    composition_waves.add(cons_wave)

    # Monta a tabela
    lines: list[str] = []
    lines.append("## Tabela de ondas (gerada)")
    lines.append("")
    lines.append("| Onda | Cards | Nível | Qtd | Notas |")
    lines.append("|------|-------|-------|-----|-------|")

    total_cards = 0
    for wave in sorted_waves:
        wcards = wave_cards[wave]
        card_ids = [c["id"] for c in wcards]
        n = len(wcards)
        total_cards += n

        min_l = wave_min_level.get(wave, 0)
        max_l = wave_max_level.get(wave, 0)
        if min_l == max_l:
            nivel_str = str(min_l)
        else:
            nivel_str = f"{min_l}-{max_l}"

        # Notas
        notas: list[str] = []
        if wave.endswith(".5"):
            notas.append("infra")
        if wave in composition_waves:
            notas.append("composicao")
        if n == 1 and not wave.endswith(".5"):
            notas.append("join")

        nota_str = ", ".join(notas) if notas else "—"

        cards_str = " ".join(f"`{cid}`" for cid in card_ids)
        lines.append(f"| {wave} | {cards_str} | {nivel_str} | {n} | {nota_str} |")

    lines.append("")
    lines.append(f"Total: {total_cards} cards em {len(sorted_waves)} ondas")

    # Caminho crítico
    path = _vg.compute_critical_path(cards, index, levels)
    if path:
        lines.append("")
        lines.append(f"Caminho crítico ({len(path)} nós): {' -> '.join(path)}")

    return "\n".join(lines) + "\n"


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Gerador de tabela de ondas")
    parser.add_argument(
        "cards",
        nargs="?",
        default="tools/cards.json",
        help="Caminho para cards.json",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="Arquivo de saída (default: stdout)",
    )
    args = parser.parse_args()

    cards = load_cards(args.cards)
    table = generate_wave_table(cards)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(table)
    else:
        sys.stdout.write(table)


if __name__ == "__main__":
    main()