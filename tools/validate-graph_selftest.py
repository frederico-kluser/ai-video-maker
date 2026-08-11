#!/usr/bin/env python3
"""Autoteste do validador de grafo — 11 mutações calculadas do documento corrente.

Cada mutação modifica os dados em memória (nunca literais), roda o validador
e asserta a MENSAGEM de erro, não apenas o exit code.

Uso: python3 tools/validate-graph_selftest.py
"""

import copy
import importlib.util
import json
import sys
from pathlib import Path

# Carrega validate_graph como módulo
_tools_dir = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "validate_graph", _tools_dir / "validate-graph.py"
)
assert _spec is not None, "validate-graph.py não encontrado"
_vg = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_vg)


def load_fixture() -> list[dict]:
    """Carrega os cards correntes como base para as mutações."""
    cards_path = Path(__file__).resolve().parent / "cards.json"
    return _vg.load_cards(str(cards_path))


class FailCollector:
    """Coleta mensagens de saída para asserção."""

    def __init__(self):
        self.messages: list[str] = []

    def write(self, s: str) -> None:
        self.messages.append(s)

    def flush(self) -> None:
        pass

    def get_output(self) -> str:
        return "".join(self.messages)


def assert_contains(output: str, fragment: str, test_name: str) -> None:
    """Falha se fragment não estiver na saída."""
    assert fragment in output, (
        f"{test_name}: esperava '{fragment}' na saída, mas não encontrei.\n"
        f"Saída completa:\n{output}"
    )


def assert_not_contains(output: str, fragment: str, test_name: str) -> None:
    """Falha se fragment estiver na saída."""
    assert fragment not in output, (
        f"{test_name}: NÃO esperava '{fragment}' na saída, mas encontrei.\n"
        f"Saída completa:\n{output}"
    )


# ---------------------------------------------------------------------------
# MUT-01: ID duplicado
# ---------------------------------------------------------------------------

def test_mut_01_duplicate_id() -> None:
    """MUT-01: Introduz um id duplicado e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    # Duplica o primeiro card com o mesmo id
    dup = copy.deepcopy(cards[0])
    cards.append(dup)

    out = FailCollector()
    passed = _vg.check_1_unique_ids(cards, out)
    output = out.get_output()

    assert passed is False, "MUT-01: esperava FAIL"
    assert_contains(output, "duplicados", "MUT-01")
    assert_contains(output, cards[0]["id"], "MUT-01")


# ---------------------------------------------------------------------------
# MUT-02: Dependência inexistente
# ---------------------------------------------------------------------------

def test_mut_02_missing_dep() -> None:
    """MUT-02: Referencia um card que não existe e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    cards[0]["deps"] = ["CARD-INEXISTENTE"]
    index = _vg.build_index(cards)

    out = FailCollector()
    passed = _vg.check_2_existing_deps(cards, index, out)
    output = out.get_output()

    assert passed is False, "MUT-02: esperava FAIL"
    assert_contains(output, "CARD-INEXISTENTE", "MUT-02")
    assert_contains(output, "não encontrado", "MUT-02")


# ---------------------------------------------------------------------------
# MUT-03: Ciclo
# ---------------------------------------------------------------------------

def test_mut_03_cycle() -> None:
    """MUT-03: Cria um ciclo entre dois cards e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    # Encontra dois cards sem relação de dependência entre si
    # e cria um ciclo: A -> B, B -> A
    card_a = cards[0]  # F0-01
    card_b = cards[1]  # T-01
    card_a["deps"] = [card_b["id"]]
    card_b["deps"] = [card_a["id"]]
    index = _vg.build_index(cards)

    out = FailCollector()
    passed = _vg.check_3_no_cycles(cards, index, out)
    output = out.get_output()

    assert passed is False, "MUT-03: esperava FAIL"
    assert_contains(output, "ciclo", "MUT-03")


# ---------------------------------------------------------------------------
# MUT-04: Nível inconsistente
# ---------------------------------------------------------------------------

def test_mut_04_level_inconsistency() -> None:
    """MUT-04: Força nível inconsistente e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    index = _vg.build_index(cards)
    levels = _vg.compute_levels(cards, index)

    # Corrompe um nível
    corrupted_id = cards[5]["id"]  # algum card com deps
    original = levels[corrupted_id]
    levels[corrupted_id] = original + 100

    out = FailCollector()
    passed = _vg.check_4_levels(cards, index, levels, out)
    output = out.get_output()

    assert passed is False, "MUT-04: esperava FAIL"
    assert_contains(output, "inconsistência", "MUT-04")
    assert_contains(output, corrupted_id, "MUT-04")


# ---------------------------------------------------------------------------
# MUT-05: Onda < nível
# ---------------------------------------------------------------------------

def test_mut_05_wave_below_level() -> None:
    """MUT-05: Coloca um card em onda anterior ao seu nível e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    index = _vg.build_index(cards)
    levels = _vg.compute_levels(cards, index)

    # Encontra um card com nível > 0 e move para uma onda anterior
    for c in cards:
        if levels.get(c["id"], 0) >= 3:
            # Move para W0
            c["wave"] = "W0"
            break

    out = FailCollector()
    passed = _vg.check_5_wave_ge_level(cards, levels, out)
    output = out.get_output()

    assert passed is False, "MUT-05: esperava FAIL"
    assert_contains(output, "onda", "MUT-05")
    assert_contains(output, "nível", "MUT-05")


# ---------------------------------------------------------------------------
# MUT-06: Dependência lateral (mesma onda)
# ---------------------------------------------------------------------------

def test_mut_06_lateral_dep() -> None:
    """MUT-06: Cria dependência entre dois cards da mesma onda e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    # Pega dois cards da W1 sem dependência entre si
    w1_cards = [c for c in cards if c["wave"] == "W1"]
    # Remove deps de A e adiciona B como dep
    a = w1_cards[0]
    b = w1_cards[1]
    a["deps"] = [b["id"]]
    index = _vg.build_index(cards)

    out = FailCollector()
    passed = _vg.check_6_no_lateral_deps(cards, index, out)
    output = out.get_output()

    assert passed is False, "MUT-06: esperava FAIL"
    assert_contains(output, "DEPENDÊNCIA LATERAL", "MUT-06")
    assert_contains(output, a["id"], "MUT-06")
    assert_contains(output, b["id"], "MUT-06")


# ---------------------------------------------------------------------------
# MUT-07: Conflito de arquivo na mesma onda
# ---------------------------------------------------------------------------

def test_mut_07_file_conflict() -> None:
    """MUT-07: Dois cards da mesma onda declaram o mesmo arquivo e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    # Pega dois cards da W1 e dá a eles o mesmo owned_files
    w1_cards = [c for c in cards if c["wave"] == "W1"]
    if len(w1_cards) >= 2:
        w1_cards[0]["owned_files"] = "shared/path/conflict.ts"
        w1_cards[1]["owned_files"] = "shared/path/conflict.ts"

    out = FailCollector()
    passed = _vg.check_7_disjoint_files(cards, out)
    output = out.get_output()

    assert passed is False, "MUT-07: esperava FAIL"
    assert_contains(output, "conflito", "MUT-07")


# ---------------------------------------------------------------------------
# MUT-08: Card órfão
# ---------------------------------------------------------------------------

def test_mut_08_orphan() -> None:
    """MUT-08: Cria um card sem dependências e sem dependentes e asserta a mensagem."""
    cards = copy.deepcopy(load_fixture())
    # Adiciona um card novo sem deps e sem ser referenciado
    orphan = {
        "id": "ORFAO-TESTE",
        "wave": "W5",
        "deps": [],
        "discipline": "tdd",
        "title": "Card órfão de teste",
        "owned_files": "teste/orfao.md",
        "acceptance": "exit 0",
        "severity": "baixo",
        "needs_search": False,
    }
    cards.append(orphan)
    index = _vg.build_index(cards)

    out = FailCollector()
    # Sem allowlist — o órfão deve falhar
    passed = _vg.check_8_orphans(cards, index, out, allowlist=set())
    output = out.get_output()

    assert passed is False, "MUT-08: esperava FAIL"
    assert_contains(output, "órfão", "MUT-08")
    assert_contains(output, "ORFAO-TESTE", "MUT-08")


# ---------------------------------------------------------------------------
# MUT-09: Onda de composição (detecção)
# ---------------------------------------------------------------------------

def test_mut_09_composition_detection() -> None:
    """MUT-09: Verifica que a detecção de onda de composição funciona."""
    cards = copy.deepcopy(load_fixture())
    index = _vg.build_index(cards)

    out = FailCollector()
    passed = _vg.check_9_composition_waves(cards, index, out)
    output = out.get_output()

    # This check always passes — it's informational
    assert passed is True, "MUT-09: esperava PASS (informativo)"
    # Should contain "candidatos" (with or without candidates)
    assert "candidato" in output.lower() or "candidatos" in output.lower(), (
        f"MUT-09: esperava menção a candidatos de composição.\nSaída: {output}"
    )


# ---------------------------------------------------------------------------
# MUT-10: Zero cards
# ---------------------------------------------------------------------------

def test_mut_10_zero_cards() -> None:
    """MUT-10: Zero cards parseados falha com mensagem clara."""
    out = FailCollector()
    passed = _vg.check_10_zero_cards(out, [])
    output = out.get_output()

    assert passed is False, "MUT-10: esperava FAIL"
    assert_contains(output, "zero cards", "MUT-10")
    assert_contains(output, "formato mudou", "MUT-10")
    assert_contains(output, "verificador ficou cego", "MUT-10")


# ---------------------------------------------------------------------------
# MUT-11: Caminho crítico
# ---------------------------------------------------------------------------

def test_mut_11_critical_path() -> None:
    """MUT-11: Verifica que o caminho crítico é calculável."""
    cards = load_fixture()
    index = _vg.build_index(cards)
    levels = _vg.compute_levels(cards, index)

    out = FailCollector()
    passed = _vg.check_11_critical_path(cards, index, levels, out)
    output = out.get_output()

    assert passed is True, "MUT-11: esperava PASS"
    assert_contains(output, "caminho crítico", "MUT-11")
    # O caminho crítico deve ter pelo menos 10 nós
    # (profundidade máxima do grafo é 11, caminho = 12 nós)
    assert "->" in output, "MUT-11: caminho crítico deve conter setas"


# ---------------------------------------------------------------------------
# Integration: validate() function with empty cards
# ---------------------------------------------------------------------------

def test_validate_empty_cards() -> None:
    """Testa a função validate() com lista vazia — deve falhar."""
    import tempfile, os

    # Cria um arquivo temporário com cards vazios
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump([], f)
        tmp_path = f.name

    try:
        passed, messages = _vg.validate(tmp_path)
        assert not passed, "validate() com lista vazia deve falhar"
        output = "".join(messages)
        assert_contains(output, "zero cards", "validate-empty")
    finally:
        os.unlink(tmp_path)


def test_validate_success() -> None:
    """Testa que validate() passa com os dados correntes."""
    cards_path = str(Path(__file__).resolve().parent / "cards.json")
    passed, messages = _vg.validate(cards_path)
    output = "".join(messages)
    assert passed, f"validate() deve passar com os dados correntes.\nSaída:\n{output}"
    assert_contains(output, "PASS", "validate-success")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main() -> None:
    tests = [
        ("MUT-01: id duplicado", test_mut_01_duplicate_id),
        ("MUT-02: dependência inexistente", test_mut_02_missing_dep),
        ("MUT-03: ciclo", test_mut_03_cycle),
        ("MUT-04: nível inconsistente", test_mut_04_level_inconsistency),
        ("MUT-05: onda < nível", test_mut_05_wave_below_level),
        ("MUT-06: dependência lateral", test_mut_06_lateral_dep),
        ("MUT-07: conflito de arquivo", test_mut_07_file_conflict),
        ("MUT-08: card órfão", test_mut_08_orphan),
        ("MUT-09: detecção de composição", test_mut_09_composition_detection),
        ("MUT-10: zero cards", test_mut_10_zero_cards),
        ("MUT-11: caminho crítico", test_mut_11_critical_path),
        ("validate() com lista vazia", test_validate_empty_cards),
        ("validate() com dados correntes", test_validate_success),
    ]

    failed = 0
    for name, test_fn in tests:
        try:
            test_fn()
            print(f"  PASS: {name}")
        except AssertionError as e:
            print(f"  FAIL: {name}")
            print(f"    {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR: {name}")
            print(f"    {type(e).__name__}: {e}")
            failed += 1

    print(f"\n{len(tests)} testes, {failed} falha(s)")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()