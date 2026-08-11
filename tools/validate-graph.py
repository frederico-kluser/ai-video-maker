#!/usr/bin/env python3
"""Validador de grafo de tarefas — as 11 checagens.

Faz o parse de cards.json, valida o grafo de dependências e imprime os resultados.
Uso: python3 tools/validate-graph.py [caminho/para/cards.json]
"""

import json
import sys
from collections import deque
from pathlib import Path
from typing import TextIO


# ---------------------------------------------------------------------------
# Wave ordering
# ---------------------------------------------------------------------------
# Meia-ondas são intercaladas: W0 < W0.5 < W1 < W2 < W2.5 < W3 ...
_WAVE_ORDER = [
    "W0", "W0.5",
    "W1",
    "W2", "W2.5",
    "W3",
    "W4",
    "W5",
    "W6", "W6.5",
    "W7",
    "W8",
    "W9", "W9.5",
    "W10",
    "W11",
    "W12",
]

_WAVE_ORDINAL = {w: i for i, w in enumerate(_WAVE_ORDER)}


def wave_ordinal(wave: str) -> int:
    """Retorna o ordinal da onda para comparação (0 = W0)."""
    if wave in _WAVE_ORDINAL:
        return _WAVE_ORDINAL[wave]
    # Fallback: parse "W<n>" ou "W<n>.5"
    try:
        base = wave.lstrip("W")
        if ".5" in base:
            return int(base.replace(".5", "")) * 2 + 1
        return int(base) * 2
    except (ValueError, AttributeError):
        return -1


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_cards(path: str) -> list[dict]:
    """Carrega os cards do arquivo JSON."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("cards.json deve ser uma lista de objetos")
    return data


def build_index(cards: list[dict]) -> dict[str, dict]:
    """Constrói índice id -> card."""
    return {c["id"]: c for c in cards}


def compute_levels(cards: list[dict], index: dict[str, dict]) -> dict[str, int]:
    """Calcula nível topológico de cada card.

    nivel(c) = 0 se sem deps, senão 1 + max(nivel(dep))
    Usa ordenação topológica para evitar recursão.
    """
    # In-degrees
    in_degree: dict[str, int] = {}
    for c in cards:
        cid = c["id"]
        if cid not in in_degree:
            in_degree[cid] = 0
        for dep in c.get("deps", []):
            in_degree[cid] = in_degree.get(cid, 0) + 1

    # Topological sort
    levels: dict[str, int] = {}
    queue: deque[str] = deque()

    for c in cards:
        if c["id"] not in in_degree or in_degree[c["id"]] == 0:
            queue.append(c["id"])
            levels[c["id"]] = 0

    # Build reverse adjacency
    dependents: dict[str, list[str]] = {}
    for c in cards:
        for dep in c.get("deps", []):
            dependents.setdefault(dep, []).append(c["id"])

    while queue:
        current = queue.popleft()
        current_level = levels.get(current, 0)
        for dependent in dependents.get(current, []):
            new_level = current_level + 1
            if dependent not in levels or levels[dependent] < new_level:
                levels[dependent] = new_level
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                queue.append(dependent)

    return levels


def find_cycle(cards: list[dict], index: dict[str, dict]) -> list[str] | None:
    """DFS com cor para detectar ciclo. Retorna o ciclo ou None."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {c["id"]: WHITE for c in cards}
    parent: dict[str, str | None] = {c["id"]: None for c in cards}

    cycle: list[str] | None = None

    def dfs(u: str) -> None:
        nonlocal cycle
        color[u] = GRAY
        card = index[u]
        for v in card.get("deps", []):
            if v not in index:
                continue
            if color.get(v) == GRAY:
                # Found a cycle: trace back from u to v
                path = [v, u]
                p = parent[u]
                while p is not None and p != v:
                    path.append(p)
                    p = parent[p]
                path.append(v)
                path.reverse()
                cycle = path
                return
            if color.get(v) == WHITE:
                parent[v] = u
                dfs(v)
                if cycle:
                    return
        color[u] = BLACK

    for c in cards:
        if color[c["id"]] == WHITE:
            dfs(c["id"])
            if cycle:
                return cycle
    return None


def compute_critical_path(
    cards: list[dict], index: dict[str, dict], levels: dict[str, int]
) -> list[str]:
    """Encontra o caminho crítico (caminho mais longo no DAG)."""
    # Build reverse adjacency
    dependents: dict[str, list[str]] = {}
    for c in cards:
        for dep in c.get("deps", []):
            dependents.setdefault(dep, []).append(c["id"])

    # Compute longest path ending at each node (DP)
    longest_ending: dict[str, int] = {}
    prev_node: dict[str, str | None] = {}

    # Topological order by level
    sorted_cards = sorted(cards, key=lambda c: levels.get(c["id"], -1))

    for c in sorted_cards:
        cid = c["id"]
        best = 0
        best_prev = None
        for dep in c.get("deps", []):
            if dep in longest_ending and longest_ending[dep] + 1 > best:
                best = longest_ending[dep] + 1
                best_prev = dep
        longest_ending[cid] = best
        prev_node[cid] = best_prev

    # Find the node with the longest path
    max_len = 0
    end_node = None
    for cid, length in longest_ending.items():
        if length > max_len:
            max_len = length
            end_node = cid

    if end_node is None:
        return []

    # Reconstruct path
    path: list[str] = []
    current = end_node
    while current is not None:
        path.append(current)
        current = prev_node.get(current)
    path.reverse()
    return path


# ---------------------------------------------------------------------------
# The 11 checks
# ---------------------------------------------------------------------------

def check_1_unique_ids(cards: list[dict], out: TextIO) -> bool:
    """Checagem 1: Todo card tem id único."""
    ids = [c["id"] for c in cards]
    seen: set[str] = set()
    dups: set[str] = set()
    for cid in ids:
        if cid in seen:
            dups.add(cid)
        seen.add(cid)
    if dups:
        out.write(f"  FAIL: ids duplicados: {sorted(dups)}\n")
        return False
    out.write(f"  PASS: {len(ids)} ids únicos\n")
    return True


def check_2_existing_deps(cards: list[dict], index: dict[str, dict], out: TextIO) -> bool:
    """Checagem 2: Toda dependência referenciada existe."""
    missing: list[tuple[str, str]] = []
    for c in cards:
        for dep in c.get("deps", []):
            if dep not in index:
                missing.append((c["id"], dep))
    if missing:
        out.write(f"  FAIL: {len(missing)} dependência(s) inexistente(s):\n")
        for card_id, dep in missing:
            out.write(f"    {card_id} -> {dep} (não encontrado)\n")
        return False
    out.write(f"  PASS: todas as {sum(len(c.get('deps', [])) for c in cards)} arestas referenciam cards existentes\n")
    return True


def check_3_no_cycles(cards: list[dict], index: dict[str, dict], out: TextIO) -> bool:
    """Checagem 3: Não há ciclos (DAG)."""
    cycle = find_cycle(cards, index)
    if cycle:
        out.write(f"  FAIL: ciclo detectado: {' -> '.join(cycle)}\n")
        return False
    out.write("  PASS: grafo acíclico\n")
    return True


def check_4_levels(
    cards: list[dict], index: dict[str, dict], levels: dict[str, int], out: TextIO
) -> bool:
    """Checagem 4: Nível(c) = 0 se sem deps, senão 1 + max(nível(dep))."""
    # Computed by compute_levels above — verify consistency
    errors = []
    for c in cards:
        cid = c["id"]
        computed = levels.get(cid, -1)
        expected = 0
        if c.get("deps"):
            max_dep_level = max(
                (levels.get(d, -1) for d in c["deps"] if d in levels), default=-1
            )
            if max_dep_level >= 0:
                expected = max_dep_level + 1
        if computed != expected:
            errors.append(f"    {cid}: nível computado={computed}, esperado={expected}")
    if errors:
        out.write(f"  FAIL: {len(errors)} inconsistência(s) de nível:\n")
        for e in errors:
            out.write(e + "\n")
        return False
    out.write(f"  PASS: níveis consistentes (profundidade máxima={max(levels.values())})\n")
    return True


def check_5_wave_ge_level(
    cards: list[dict], levels: dict[str, int], out: TextIO
) -> bool:
    """Checagem 5: Onda(c) >= nível(c) — invariante DURA (AVISO)."""
    # This is a WARNING, not a hard failure
    violations = []
    for c in cards:
        cid = c["id"]
        lev = levels.get(cid, 0)
        w_ord = wave_ordinal(c["wave"])
        if w_ord < 0:
            violations.append(f"    {cid}: onda '{c['wave']}' desconhecida")
        elif w_ord < lev:
            violations.append(f"    {cid}: onda={c['wave']}(ord={w_ord}) < nível={lev}")
    if violations:
        out.write(f"  FAIL: {len(violations)} violação(ões) de onda >= nível:\n")
        for v in violations:
            out.write(v + "\n")
        return False
    out.write("  PASS: onda >= nível para todos os cards\n")
    return True


def check_6_no_lateral_deps(cards: list[dict], index: dict[str, dict], out: TextIO) -> bool:
    """Checagem 6: Nenhuma dependência lateral — onda(card) > onda(dep) para toda aresta."""
    violations = []
    for c in cards:
        cid = c["id"]
        c_ord = wave_ordinal(c["wave"])
        for dep in c.get("deps", []):
            if dep not in index:
                continue
            d_ord = wave_ordinal(index[dep]["wave"])
            if c_ord >= 0 and d_ord >= 0 and c_ord <= d_ord:
                if c_ord == d_ord:
                    msg = (
                        f"DEPENDÊNCIA LATERAL: {cid}({c['wave']}) depende de "
                        f"{dep}({index[dep]['wave']}) — mesma onda"
                    )
                else:
                    msg = (
                        f"DEPENDÊNCIA INVERTIDA: {cid}({c['wave']}) depende de "
                        f"{dep}({index[dep]['wave']}) — onda anterior"
                    )
                violations.append(msg)
    if violations:
        out.write(f"  FAIL: {len(violations)} violação(ões) de monotonia de onda:\n")
        for v in violations:
            out.write(f"    {v}\n")
        return False
    out.write("  PASS: monotonia de onda estrita (onda(card) > onda(dep)) para todas as arestas\n")
    return True


def check_7_disjoint_files(cards: list[dict], out: TextIO) -> bool:
    """Checagem 7: Arquivos de cards da mesma onda são disjuntos (mapa de propriedade)."""
    from collections import defaultdict

    # Parse owned_files into a rough file list per card
    wave_files: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))

    for c in cards:
        wave = c["wave"]
        owned = c.get("owned_files", "")
        if not owned:
            continue
        # Simple heuristic: split by · and extract first path-like token
        parts = [p.strip() for p in owned.replace("·", "·").split("·")]
        for part in parts:
            part = part.strip()
            if not part:
                continue
            # Extract the first word (file/dir path) — this is approximate
            # We look for patterns like <code>path</code> or bare paths
            first_token = part.split()[0] if part.split() else part
            if first_token and ("/" in first_token or "." in first_token or first_token.endswith("/**") or "**" in first_token):
                wave_files[wave][first_token].append(c["id"])

    conflicts = []
    for wave, file_map in wave_files.items():
        for fpath, owners in file_map.items():
            if len(owners) > 1:
                conflicts.append(f"    {wave}: '{fpath}' é declarado por {owners}")

    if conflicts:
        out.write(f"  FAIL: {len(conflicts)} conflito(s) de propriedade de arquivo:\n")
        for conflict in conflicts:
            out.write(conflict + "\n")
        return False
    out.write("  PASS: arquivos disjuntos por onda\n")
    return True


def check_8_orphans(
    cards: list[dict], index: dict[str, dict], out: TextIO, allowlist: set[str] | None = None
) -> bool:
    """Checagem 8: Cards sem dependência E sem dependente -> falha (salvo allowlist)."""
    if allowlist is None:
        allowlist = set()

    # Build reverse dependency map
    dependents: dict[str, list[str]] = {}
    for c in cards:
        for dep in c.get("deps", []):
            dependents.setdefault(dep, []).append(c["id"])

    orphans = []
    for c in cards:
        cid = c["id"]
        has_deps = bool(c.get("deps"))
        has_dependents = bool(dependents.get(cid))
        if not has_deps and not has_dependents and cid not in allowlist:
            orphans.append(cid)

    if orphans:
        out.write(f"  FAIL: {len(orphans)} card(s) órfão(s) (sem dependências e sem dependentes):\n")
        for o in orphans:
            out.write(f"    {o}: onda={index[o]['wave']}, título={index[o]['title'][:80]}\n")
        return False
    out.write("  PASS: nenhum card órfão (sem allowlist)\n")
    return True


def check_9_composition_waves(
    cards: list[dict], index: dict[str, dict], out: TextIO
) -> bool:
    """Checagem 9: Onda de composição detectada e impressa.

    Definição: card com out-degree >= 2 cujos consumidores estão todos na mesma
    onda seguinte (onda(c) + 1). O validador imprime os candidatos; não decide sozinho.
    """
    # Build reverse dependency
    dependents: dict[str, list[str]] = {}
    for c in cards:
        for dep in c.get("deps", []):
            dependents.setdefault(dep, []).append(c["id"])

    composition_candidates = []
    for c in cards:
        cid = c["id"]
        deps_of_me = dependents.get(cid, [])
        if len(deps_of_me) < 2:
            continue

        c_ord = wave_ordinal(c["wave"])
        if c_ord < 0:
            continue

        # Check if all consumers are in the same wave
        consumer_waves = set()
        for dep_id in deps_of_me:
            if dep_id in index:
                consumer_waves.add(index[dep_id]["wave"])

        if len(consumer_waves) == 1:
            consumer_wave = next(iter(consumer_waves))
            cons_ord = wave_ordinal(consumer_wave)
            if cons_ord == c_ord + 1:
                composition_candidates.append(
                    (cid, c["wave"], consumer_wave, len(deps_of_me), deps_of_me)
                )

    if composition_candidates:
        out.write("  INFO: candidatos a onda de composição detectados:\n")
        for cid, wave, cons_wave, n, consumers in composition_candidates:
            out.write(
                f"    {cid} ({wave}) -> {n} consumidores em {cons_wave}: "
                f"{', '.join(consumers)}\n"
            )
    else:
        out.write("  INFO: nenhum candidato a onda de composição detectado\n")
    # This check never fails — it only prints
    return True


def check_10_zero_cards(out: TextIO, cards: list[dict]) -> bool:
    """Checagem 10: Zero cards parseados = falha (formato mudou)."""
    if len(cards) == 0:
        out.write("  FAIL: zero cards parseados — o formato mudou e este verificador ficou cego\n")
        return False
    out.write(f"  PASS: {len(cards)} cards parseados\n")
    return True


def check_11_critical_path(
    cards: list[dict], index: dict[str, dict], levels: dict[str, int], out: TextIO
) -> bool:
    """Checagem 11: Caminho crítico recalculável."""
    path = compute_critical_path(cards, index, levels)
    if not path:
        out.write("  FAIL: não foi possível calcular o caminho crítico\n")
        return False
    out.write(f"  INFO: caminho crítico ({len(path)} nós): {' -> '.join(path)}\n")
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def validate(cards_path: str, allowlist: set[str] | None = None) -> tuple[bool, list[str]]:
    """Executa as 11 checagens e retorna (passou, mensagens)."""
    messages: list[str] = []
    out = _StringIO(messages)

    cards = load_cards(cards_path)

    # Checagem 10 PRIMEIRO — zero cards = falha imediata
    out.write("--- Checagem 10: zero cards parseados ---\n")
    if not check_10_zero_cards(out, cards):
        out.write("\nRESULTADO: FAIL (zero cards — verificador cego)\n")
        return False, messages

    index = build_index(cards)
    levels = compute_levels(cards, index)

    checks = [
        ("1: ids únicos", lambda: check_1_unique_ids(cards, out)),
        ("2: dependências existentes", lambda: check_2_existing_deps(cards, index, out)),
        ("3: sem ciclos", lambda: check_3_no_cycles(cards, index, out)),
        ("4: níveis corretos", lambda: check_4_levels(cards, index, levels, out)),
        ("5: onda >= nível", lambda: check_5_wave_ge_level(cards, levels, out)),
        ("6: sem dependências laterais", lambda: check_6_no_lateral_deps(cards, index, out)),
        ("7: arquivos disjuntos", lambda: check_7_disjoint_files(cards, out)),
        ("8: sem órfãos", lambda: check_8_orphans(cards, index, out, allowlist)),
        ("9: ondas de composição", lambda: check_9_composition_waves(cards, index, out)),
        ("11: caminho crítico", lambda: check_11_critical_path(cards, index, levels, out)),
    ]

    all_pass = True
    for name, check_fn in checks:
        out.write(f"\n--- Checagem {name} ---\n")
        if not check_fn():
            all_pass = False

    # Folga: imprime cards com onda > nível
    out.write("\n--- Folga (onda > nível) ---\n")
    folga_found = False
    for c in cards:
        cid = c["id"]
        lev = levels.get(cid, 0)
        w_ord = wave_ordinal(c["wave"])
        if w_ord > lev:
            out.write(f"  AVISO: {cid} ({c['wave']}) tem nível={lev}, folga={w_ord - lev}\n")
            folga_found = True
    if not folga_found:
        out.write("  (nenhuma folga)\n")

    out.write(f"\nRESULTADO: {'PASS' if all_pass else 'FAIL'}\n")
    return all_pass, messages


class _StringIO:
    """StringIO-like que acumula em uma lista de strings."""

    def __init__(self, messages: list[str]):
        self._messages = messages

    def write(self, s: str) -> None:
        self._messages.append(s)

    def flush(self) -> None:
        pass


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Validador de grafo de tarefas")
    parser.add_argument(
        "cards",
        nargs="?",
        default="tools/cards.json",
        help="Caminho para cards.json (default: tools/cards.json)",
    )
    parser.add_argument(
        "--allowlist",
        nargs="*",
        default=[],
        help="IDs de cards permitidos como órfãos (checagem 8)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Saída em formato JSON",
    )
    args = parser.parse_args()

    allowlist = set(args.allowlist)
    passed, messages = validate(args.cards, allowlist)

    if args.json:
        result = {
            "passed": passed,
            "messages": "".join(messages),
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        for msg in messages:
            sys.stdout.write(msg)

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()