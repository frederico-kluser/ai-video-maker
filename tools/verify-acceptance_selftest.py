#!/usr/bin/env python3
"""Autoteste do verify-acceptance.py — asserta a mensagem, nao o exit code.

Casos:
  1. Card concluido com seletor que casa zero testes → vermelho
  2. HTML no meio do token → tripwire dispara
  3. Caractere de largura zero e hifen suave → tripwire dispara
  4. Zero cards parseados → falha
  5. Sonda negativa exercitavel → OK
  6. Tripwire bate com texto limpo → OK
  7. Card concluido com todos seletores OK → verde
  8. Card concluido sem acceptance → falha

Uso: python3 tools/verify-acceptance_selftest.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VERIFIER = Path(__file__).resolve().parent / "verify-acceptance.py"


def _run_verify(cards_data: list[dict] | str, raw_text: str | None = None) -> tuple[int, str]:
    """Executa o verificador contra dados temporarios.

    Args:
        cards_data: Lista de dicts (sera serializada como JSON) ou string JSON.
        raw_text: Texto bruto para tripwire. Se None, usa o proprio JSON.

    Returns:
        (exit_code, stdout)
    """
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as f:
        if isinstance(cards_data, str):
            f.write(cards_data)
        else:
            json.dump(cards_data, f, indent=2, ensure_ascii=False)
        cards_path = f.name

    raw_path = None
    if raw_text is not None:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as f:
            f.write(raw_text)
            raw_path = f.name

    try:
        cmd = [sys.executable, str(VERIFIER), cards_path]
        if raw_path:
            cmd.extend(["--raw-text", raw_path])

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return result.returncode, result.stdout
    finally:
        os.unlink(cards_path)
        if raw_path:
            os.unlink(raw_path)


# ---------------------------------------------------------------------------
# Mini-framework de assercao
# ---------------------------------------------------------------------------

_failures = 0
_passes = 0


def _assert(condition: bool, test_name: str, detail: str = "") -> None:
    global _failures, _passes
    if condition:
        _passes += 1
        print(f"  PASS: {test_name}")
    else:
        _failures += 1
        print(f"  FAIL: {test_name}")
        if detail:
            for line in detail.split("\n"):
                print(f"        {line}")


def _assert_contains(needle: str, haystack: str, test_name: str) -> None:
    _assert(needle in haystack, test_name,
            f"esperado: {needle!r}\nobtido (ultimos 300 chars): {haystack[-300:]!r}")


def _assert_not_contains(needle: str, haystack: str, test_name: str) -> None:
    _assert(needle not in haystack, test_name,
            f"nao esperado: {needle!r}")


# ---------------------------------------------------------------------------
# Casos de teste
# ---------------------------------------------------------------------------

def test_zero_cards_fails() -> None:
    """Caso 1: Zero cards parseados → falha."""
    print("\n--- Teste: zero cards parseados → falha ---")

    rc, out = _run_verify([])

    _assert(rc != 0, "exit code != 0 (zero cards)", f"rc={rc}")
    _assert_contains("zero cards parseados", out, "mensagem contem 'zero cards parseados'")
    _assert_contains("FAIL", out, "saida contem FAIL")


def test_completed_card_zero_matches_fails() -> None:
    """Caso 2: Card concluido com seletor que casa zero testes → vermelho."""
    print("\n--- Teste: card concluido com seletor zero matches → vermelho ---")

    cards = [
        {
            "id": "TEST-01",
            "wave": "W0",
            "deps": [],
            "discipline": "tdd",
            "title": "Card de teste — seletor impossivel",
            "owned_files": "tools/arquivo-que-nao-existe-xyz.py",
            "acceptance": "python3 tools/arquivo-que-nao-existe-xyz.py → exit 0",
            "severity": "baixo",
            "needs_search": False,
            "status": "concluido",
        }
    ]

    rc, out = _run_verify(cards)

    _assert(rc != 0, "exit code != 0 (seletor zero matches)", f"rc={rc}")
    _assert_contains("FAIL", out, "saida contem FAIL")
    _assert_contains("casa zero testes", out, "mensagem contem 'casa zero testes'")
    _assert_contains("TEST-01", out, "nomeia o card TEST-01")


def test_completed_card_all_ok_passes() -> None:
    """Caso 3: Card concluido com todos seletores OK → verde."""
    print("\n--- Teste: card concluido com seletores OK → verde ---")

    cards = [
        {
            "id": "TEST-02",
            "wave": "W0",
            "deps": [],
            "discipline": "tdd",
            "title": "Card de teste — seletores validos",
            "owned_files": "tools/verify-acceptance.py",
            "acceptance": (
                "python3 tools/verify-acceptance.py → exit 0 · "
                "∅-crit rg -L \"PADRAO_QUE_NAO_EXISTE_XYZ\" tools/verify-acceptance.py → vazio"
            ),
            "severity": "baixo",
            "needs_search": False,
            "status": "concluido",
        }
    ]

    rc, out = _run_verify(cards)

    _assert(rc == 0, "exit code == 0 (seletores OK)", f"rc={rc}")
    _assert_contains("PASS", out, "saida contem PASS")
    _assert_contains("RESULTADO: PASS", out, "resultado final PASS")


def test_html_entities_in_token_tripwire() -> None:
    """Caso 4: HTML entities no meio do token → tripwire dispara.

    Injeta &quot;id&quot;: &quot;FAKE-01&quot; no campo acceptance.
    O parser JSON trata como string literal (1 card).
    O tripwire normaliza &quot; → \" e encontra um padrao \"id\" extra.
    """
    print("\n--- Teste: HTML entities no token → tripwire ---")

    cards = [
        {
            "id": "TRIP-01",
            "wave": "W0",
            "deps": [],
            "discipline": "tdd",
            "title": "Teste de tripwire com entidades HTML",
            "owned_files": "tools/verify-acceptance.py",
            # &quot;id&quot;: &quot;FAKE-01&quot; — o parser JSON le como
            # texto literal; o tripwire normaliza &quot; → " e encontra
            # o padrao "id": "FAKE-01"
            "acceptance": (
                "python3 tools/verify-acceptance.py → exit 0 · "
                "verificar &quot;id&quot;: &quot;FAKE-01&quot; na saida"
            ),
            "severity": "baixo",
            "needs_search": False,
        }
    ]

    json_str = json.dumps(cards, indent=2, ensure_ascii=False)

    rc, out = _run_verify(cards, raw_text=json_str)

    _assert(rc != 0, "exit code != 0 (tripwire disparou)", f"rc={rc}")
    _assert_contains("tripwire", out, "saida menciona tripwire")
    _assert_contains("FAIL", out, "saida contem FAIL")


def test_zero_width_and_soft_hyphen_tripwire() -> None:
    """Caso 5: Caractere de largura zero e hifen suave → tripwire dispara.

    Injeta &#8203; (zero-width space) e &shy; (soft hyphen) como entidades
    HTML no meio de um padrao \"id\". O tripwire normaliza removendo-os
    e encontra o padrao extra.
    """
    print("\n--- Teste: caractere de largura zero e hifen suave → tripwire ---")

    cards = [
        {
            "id": "ZWSP-01",
            "wave": "W0",
            "deps": [],
            "discipline": "tdd",
            "title": "Card com caracteres invisiveis",
            "owned_files": "tools/verify-acceptance.py",
            # &quot;i&#8203;d&shy;&quot;: &quot;FAKE-ZW&quot;
            # O tripwire normaliza: &#8203; → removido, &shy; → removido,
            # &quot; → ". Resultado: "id": "FAKE-ZW"
            "acceptance": (
                "python3 tools/verify-acceptance.py → exit 0 · "
                "ref &quot;i&#8203;d&shy;&quot;: &quot;FAKE-ZW&quot;"
            ),
            "severity": "baixo",
            "needs_search": False,
        }
    ]

    json_str = json.dumps(cards, indent=2, ensure_ascii=False)

    rc, out = _run_verify(cards, raw_text=json_str)

    _assert(rc != 0, "exit code != 0 (tripwire)", f"rc={rc}")
    _assert_contains("tripwire", out, "saida menciona tripwire")
    _assert_contains("FAIL", out, "saida contem FAIL")


def test_negative_probe_exercisable() -> None:
    """Caso 6: Sonda negativa com alvo existente → exercitavel."""
    print("\n--- Teste: sonda negativa exercitavel ---")

    cards = [
        {
            "id": "NEG-01",
            "wave": "W0",
            "deps": [],
            "discipline": "tdd",
            "title": "Sonda negativa com alvo real",
            "owned_files": "tools/verify-acceptance.py",
            "acceptance": "∅-crit rg -L \"PADRAO_IMPOSSIVEL_XYZ123\" tools/verify-acceptance.py → vazio",
            "severity": "baixo",
            "needs_search": False,
            "status": "concluido",
        }
    ]

    rc, out = _run_verify(cards)

    _assert(rc == 0, "exit code == 0 (sonda negativa exercitavel)", f"rc={rc}")
    _assert_contains("PASS", out, "saida contem PASS")
    _assert_contains("exercitavel", out, "sonda negativa marcada como exercitavel")


def test_card_without_acceptance() -> None:
    """Caso 7: Card concluido sem criterios de aceitacao → falha."""
    print("\n--- Teste: card concluido sem acceptance ---")

    cards = [
        {
            "id": "NOACC-01",
            "wave": "W0",
            "deps": [],
            "discipline": "tdd",
            "title": "Card sem criterios",
            "owned_files": "tools/verify-acceptance.py",
            "acceptance": "",
            "severity": "baixo",
            "needs_search": False,
            "status": "concluido",
        }
    ]

    rc, out = _run_verify(cards)

    _assert(rc != 0, "exit code != 0 (sem acceptance)", f"rc={rc}")
    _assert_contains("sem criterios", out, "mensagem menciona falta de criterios")


def test_tripwire_passes_with_clean_text() -> None:
    """Caso 8: Tripwire bate com texto limpo."""
    print("\n--- Teste: tripwire bate com texto limpo ---")

    cards = [
        {
            "id": "CLEAN-01",
            "wave": "W0",
            "deps": [],
            "discipline": "tdd",
            "title": "Card limpo sem entidades HTML",
            "owned_files": "tools/verify-acceptance.py",
            "acceptance": "python3 tools/verify-acceptance.py → exit 0",
            "severity": "baixo",
            "needs_search": False,
        }
    ]

    json_str = json.dumps(cards, indent=2, ensure_ascii=False)

    rc, out = _run_verify(cards, raw_text=json_str)

    _assert(rc == 0, "exit code == 0 (texto limpo)", f"rc={rc}")
    _assert_contains("tripwire bate", out, "tripwire confirmou contagem")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=== verify-acceptance_selftest ===")
    print(f"Verificador: {VERIFIER}")

    if not VERIFIER.exists():
        print(f"FAIL: verificador nao encontrado em {VERIFIER}")
        sys.exit(1)

    test_zero_cards_fails()
    test_completed_card_zero_matches_fails()
    test_completed_card_all_ok_passes()
    test_html_entities_in_token_tripwire()
    test_zero_width_and_soft_hyphen_tripwire()
    test_negative_probe_exercisable()
    test_card_without_acceptance()
    test_tripwire_passes_with_clean_text()

    print(f"\n=== Resultado: {_passes} PASS, {_failures} FAIL ===")
    sys.exit(0 if _failures == 0 else 1)


if __name__ == "__main__":
    main()
