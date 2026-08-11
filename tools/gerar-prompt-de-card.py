#!/usr/bin/env python3
"""Gera o prompt XML de 12 tags para um card.

Uso: python3 tools/gerar-prompt-de-card.py <ID-DO-CARD> [caminho/para/cards.json]
"""

import json
import sys
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


def load_cards(path: str) -> list[dict]:
    return _vg.load_cards(path)


def build_index(cards: list[dict]) -> dict[str, dict]:
    return _vg.build_index(cards)


def compute_levels(cards: list[dict], index: dict[str, dict]) -> dict[str, int]:
    return _vg.compute_levels(cards, index)


def format_deps(card: dict, index: dict[str, dict]) -> str:
    """Formata as dependências como lista de XML."""
    deps = card.get("deps", [])
    if not deps:
        return "  <dependencia>— (raiz, sem dependências)</dependencia>"
    lines = []
    for dep in deps:
        if dep in index:
            dep_card = index[dep]
            lines.append(
                f"  <dependencia id=\"{dep}\" onda=\"{dep_card['wave']}\">"
                f"{dep_card['title'][:100]}</dependencia>"
            )
        else:
            lines.append(
                f"  <dependencia id=\"{dep}\" status=\"NÃO ENCONTRADO\"/>"
            )
    return "\n".join(lines)


def format_dependents(card_id: str, cards: list[dict], index: dict[str, dict]) -> str:
    """Formata os cards que dependem deste."""
    dependents: list[str] = []
    for c in cards:
        if card_id in c.get("deps", []):
            dependents.append(c["id"])

    if not dependents:
        return "  <dependente>— (fim de linha, nenhum card depende deste)</dependente>"

    lines = []
    for dep_id in dependents:
        if dep_id in index:
            dep_card = index[dep_id]
            lines.append(
                f"  <dependente id=\"{dep_id}\" onda=\"{dep_card['wave']}\">"
                f"{dep_card['title'][:100]}</dependente>"
            )
    return "\n".join(lines)


def generate_prompt(card: dict, cards: list[dict], index: dict[str, dict], levels: dict[str, int]) -> str:
    """Gera o prompt XML de 12 tags para um card."""
    cid = card["id"]
    level = levels.get(cid, 0)

    # Ancestrais transitivos
    ancestors: set[str] = set()
    queue = list(card.get("deps", []))
    while queue:
        dep = queue.pop(0)
        if dep in index and dep not in ancestors:
            ancestors.add(dep)
            queue.extend(index[dep].get("deps", []))

    # Ondas de composição que afetam este card
    composition_waves: set[str] = set()
    # Uma onda de composição afeta este card se ele está na onda de composição
    # ou se depende de um hub cujos consumidores estão todos na mesma onda
    dependents_map: dict[str, list[str]] = {}
    for c in cards:
        for dep in c.get("deps", []):
            dependents_map.setdefault(dep, []).append(c["id"])

    for c in cards:
        deps_of_me = dependents_map.get(c["id"], [])
        if len(deps_of_me) >= 2:
            consumer_waves = set()
            for dep_id in deps_of_me:
                if dep_id in index:
                    consumer_waves.add(index[dep_id]["wave"])
            if len(consumer_waves) == 1:
                cons_wave = next(iter(consumer_waves))
                c_ord = _vg.wave_ordinal(c["wave"])
                cons_ord = _vg.wave_ordinal(cons_wave)
                if cons_ord == c_ord + 1:
                    composition_waves.add(cons_wave)

    is_composition = card["wave"] in composition_waves

    prompt = f"""<card id="{cid}">
  <titulo>{card['title']}</titulo>
  <severidade>{card['severity']}</severidade>
  <onda>{card['wave']}</onda>
  <nivel>{level}</nivel>
  <disciplina>{card['discipline']}</disciplina>
  <dependencias>
{format_deps(card, index)}
  </dependencias>
  <dependentes>
{format_dependents(cid, cards, index)}
  </dependentes>
  <arquivos>
    <![CDATA[{card['owned_files']}]]>
  </arquivos>
  <aceitacao>
    <![CDATA[{card['acceptance']}]]>
  </aceitacao>
  <pesquisa-web>{'sim' if card.get('needs_search') else 'nao'}</pesquisa-web>
  <onda-composicao>{'sim' if is_composition else 'nao'}</onda-composicao>
  <ancestrais-transitivos>{', '.join(sorted(ancestors)) if ancestors else '—'}</ancestrais-transitivos>
</card>
"""
    return prompt


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Gerador de prompt XML de card")
    parser.add_argument("card_id", help="ID do card (ex: F0-01, T-02)")
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
    parser.add_argument(
        "--all",
        action="store_true",
        help="Gera prompts para todos os cards",
    )
    args = parser.parse_args()

    cards = load_cards(args.cards)
    index = build_index(cards)
    levels = compute_levels(cards, index)

    if args.all:
        prompts = []
        for card in cards:
            prompts.append(generate_prompt(card, cards, index, levels))
        output = "\n".join(prompts)
    else:
        if args.card_id not in index:
            print(f"ERRO: card '{args.card_id}' não encontrado em {len(cards)} cards", file=sys.stderr)
            sys.exit(1)
        card = index[args.card_id]
        output = generate_prompt(card, cards, index, levels)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
    else:
        sys.stdout.write(output)


if __name__ == "__main__":
    main()