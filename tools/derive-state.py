#!/usr/bin/env python3
"""
Derive program state from cards.json.

Reads tools/cards.json and tools/state.json, then derives:
- Completed waves: uninterrupted prefix of waves where ALL cards are done
- Cards by status: counts of cards in each status
- Progress metrics: wave and card completion percentages

Key invariant: marking a late-wave card as completed does NOT increase the
completed-waves count. "Completed waves" is the uninterrupted prefix, not the set.

Usage:
    python3 tools/derive-state.py              # Print current state table
    python3 tools/derive-state.py --verificar  # Check derived state against saved state
    python3 tools/derive-state.py --salvar     # Save current derivation to state.json
    python3 tools/derive-state.py --selftest   # Run self-test
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
CARDS_PATH = SCRIPT_DIR / "cards.json"
STATE_PATH = SCRIPT_DIR / "state.json"


def parse_wave_key(wave_name: str) -> tuple:
    """Parse wave name into a sortable tuple.

    W0   -> (0, 0)
    W0.5 -> (0, 5)
    W1   -> (1, 0)
    W2.5 -> (2, 5)
    """
    num = wave_name.lstrip("W")
    if "." in num:
        major, minor = num.split(".")
        return (int(major), int(minor))
    else:
        return (int(num), 0)


def load_cards() -> list:
    """Load cards from cards.json."""
    if not CARDS_PATH.exists():
        print(f"ERRO: {CARDS_PATH} nao encontrado", file=sys.stderr)
        sys.exit(1)
    with open(CARDS_PATH, "r") as f:
        return json.load(f)


def load_state() -> dict:
    """Load state from state.json, or return empty state."""
    if STATE_PATH.exists():
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    return {"cards": {}}


def save_state(state: dict) -> None:
    """Save state to state.json."""
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
    print(f"Estado salvo em {STATE_PATH}")


def derive_state(cards: list, card_statuses: dict) -> dict:
    """Derive program state from cards and their completion status.

    Args:
        cards: List of card dicts from cards.json
        card_statuses: Dict mapping card_id -> status ("concluido" or other)

    Returns:
        Dict with derived state fields.
    """
    # Group cards by wave
    wave_cards: dict = defaultdict(list)
    for card in cards:
        wave_cards[card["wave"]].append(card)

    # Sort waves by their numeric key
    sorted_waves = sorted(wave_cards.keys(), key=parse_wave_key)

    # Determine which cards are completed
    completed_cards = set()
    for card_id, status in card_statuses.items():
        if status == "concluido":
            completed_cards.add(card_id)

    # Calculate completed waves: uninterrupted prefix
    # A wave is completed only if ALL its cards are marked "concluido"
    # The prefix breaks at the first incomplete wave
    completed_waves = []
    for wave in sorted_waves:
        cards_in_wave = wave_cards[wave]
        all_done = all(card["id"] in completed_cards for card in cards_in_wave)
        if all_done:
            completed_waves.append(wave)
        else:
            break  # Prefix ends here

    # Count cards by status
    status_counts = defaultdict(int)
    total = len(cards)
    completed_count = 0
    for card in cards:
        cid = card["id"]
        status = card_statuses.get(cid, "pendente")
        status_counts[status] += 1
        if status == "concluido":
            completed_count += 1

    # Calculate progress
    total_waves = len(sorted_waves)
    completed_wave_count = len(completed_waves)

    return {
        "completed_waves": completed_waves,
        "completed_wave_count": completed_wave_count,
        "total_waves": total_waves,
        "status_counts": dict(status_counts),
        "total_cards": total,
        "completed_cards": completed_count,
        "wave_progress": f"{completed_wave_count}/{total_waves}",
        "card_progress": f"{completed_count}/{total}",
        "sorted_waves": sorted_waves,
        "wave_cards": {
            w: [c["id"] for c in wave_cards[w]] for w in sorted_waves
        },
        "incomplete_waves": [
            w for w in sorted_waves if w not in completed_waves
        ],
    }


def print_state(state: dict) -> None:
    """Print a formatted state table."""
    print("=" * 70)
    print("ESTADO DO PROGRAMA")
    print("=" * 70)
    print()

    cw = state["completed_waves"]
    print(
        f"Ondas concluidas (prefixo ininterrupto): "
        f"{', '.join(cw) if cw else 'nenhuma'}"
    )
    print(f"Progresso de ondas: {state['wave_progress']}")
    print(f"Progresso de cards:  {state['card_progress']}")
    print()

    print("Cards por status:")
    for status, count in sorted(state["status_counts"].items()):
        print(f"  {status}: {count}")
    print()

    print("Detalhe por onda:")
    print(f"{'Onda':<8} {'Cards':<6} {'Concluida?':<12} IDs")
    print("-" * 70)
    for wave in state["sorted_waves"]:
        cards_in_wave = state["wave_cards"][wave]
        done = "SIM" if wave in state["completed_waves"] else "NAO"
        print(
            f"{wave:<8} {len(cards_in_wave):<6} "
            f"{done:<12} {', '.join(cards_in_wave)}"
        )

    print()
    if state["incomplete_waves"]:
        print(f"Proxima onda pendente: {state['incomplete_waves'][0]}")
    else:
        print("Todas as ondas concluidas!")


def pack_derived(state: dict) -> dict:
    """Extract the compact derived fields for storage."""
    return {
        "completed_waves": state["completed_waves"],
        "completed_wave_count": state["completed_wave_count"],
        "completed_cards": state["completed_cards"],
        "total_cards": state["total_cards"],
        "total_waves": state["total_waves"],
    }


def cmd_default() -> None:
    """Print current state."""
    cards = load_cards()
    stored = load_state()
    derived = derive_state(cards, stored.get("cards", {}))
    print_state(derived)


def cmd_verificar() -> None:
    """Check current derived state against saved state.

    Exits 0 if they match, exits 1 if they diverge.
    """
    cards = load_cards()
    stored = load_state()

    current = derive_state(cards, stored.get("cards", {}))
    saved_derived = stored.get("derived", {})

    mismatches = []

    cw_cur = current["completed_waves"]
    cw_sav = saved_derived.get("completed_waves", [])
    if cw_cur != cw_sav:
        mismatches.append(
            f"Ondas concluidas: salvo={cw_sav} atual={cw_cur}"
        )

    cwc_cur = current["completed_wave_count"]
    cwc_sav = saved_derived.get("completed_wave_count", 0)
    if cwc_cur != cwc_sav:
        mismatches.append(
            f"Contagem de ondas: salvo={cwc_sav} atual={cwc_cur}"
        )

    cc_cur = current["completed_cards"]
    cc_sav = saved_derived.get("completed_cards", 0)
    if cc_cur != cc_sav:
        mismatches.append(
            f"Cards concluidos: salvo={cc_sav} atual={cc_cur}"
        )

    if mismatches:
        print("VERIFICACAO FALHOU -- divergencias encontradas:")
        for m in mismatches:
            print(f"  - {m}")
        sys.exit(1)
    else:
        print("VERIFICACAO OK -- estado derivado confere com o salvo.")
        print()
        print_state(current)
        sys.exit(0)


def cmd_salvar() -> None:
    """Save current derivation to state.json."""
    cards = load_cards()
    stored = load_state()

    current = derive_state(cards, stored.get("cards", {}))
    stored["derived"] = pack_derived(current)

    save_state(stored)
    print()
    print_state(current)


def cmd_selftest() -> None:
    """Run self-test.

    Core invariant: marking a late-wave card as completed does NOT increase
    the completed-waves count. The count is the uninterrupted prefix.
    """
    cards = load_cards()

    # Identify waves and their ordering
    sorted_waves = sorted({c["wave"] for c in cards}, key=parse_wave_key)
    first_wave = sorted_waves[0]
    second_wave = sorted_waves[1] if len(sorted_waves) > 1 else None
    latest_wave = sorted_waves[-1]

    print("=== AUTOTESTE: Estado derivado ===")
    print(f"Ondas ordenadas: {sorted_waves}")
    print(f"Primeira onda: {first_wave}")
    print(f"Onda mais tardia: {latest_wave}")
    print()

    errors = 0

    # --- Test 1: Empty state -> 0 completed waves ---
    state1 = derive_state(cards, {})
    if state1["completed_wave_count"] != 0:
        print(
            f"FAIL [t1]: Esperado 0 ondas concluidas, "
            f"obtido {state1['completed_wave_count']}"
        )
        errors += 1
    else:
        print("PASS [t1]: Estado vazio -> 0 ondas concluidas")

    # --- Test 2: All cards of first wave completed -> 1 completed wave ---
    first_wave_cards = [c for c in cards if c["wave"] == first_wave]
    status2 = {c["id"]: "concluido" for c in first_wave_cards}
    state2 = derive_state(cards, status2)
    if state2["completed_wave_count"] != 1:
        print(
            f"FAIL [t2]: Esperado 1 onda concluida, "
            f"obtido {state2['completed_wave_count']}"
        )
        errors += 1
    elif state2["completed_waves"] != [first_wave]:
        print(
            f"FAIL [t2]: Esperado {[first_wave]}, "
            f"obtido {state2['completed_waves']}"
        )
        errors += 1
    else:
        print(
            f"PASS [t2]: Onda {first_wave} completa -> "
            f"1 onda concluida ({first_wave})"
        )

    # --- Test 3: Single late-wave card completed -> 0 completed waves ---
    # This is THE core invariant: prefix is uninterrupted
    late_cards = [c for c in cards if c["wave"] == latest_wave]
    assert late_cards, f"Nenhum card encontrado na onda {latest_wave}"
    status3 = {late_cards[0]["id"]: "concluido"}
    state3 = derive_state(cards, status3)
    if state3["completed_wave_count"] != 0:
        print(
            f"FAIL [t3]: Card de onda tardia concluido NAO deve aumentar "
            f"ondas concluidas. Esperado 0, obtido {state3['completed_wave_count']}"
        )
        errors += 1
    else:
        print(
            f"PASS [t3]: Card de onda tardia ({latest_wave}) concluido -> "
            f"0 ondas concluidas (prefixo ininterrupto)"
        )

    # --- Test 4: All cards of ALL waves completed -> all waves completed ---
    status4 = {c["id"]: "concluido" for c in cards}
    state4 = derive_state(cards, status4)
    expected_waves = len(sorted_waves)
    if state4["completed_wave_count"] != expected_waves:
        print(
            f"FAIL [t4]: Esperado {expected_waves} ondas, "
            f"obtido {state4['completed_wave_count']}"
        )
        errors += 1
    else:
        print(
            f"PASS [t4]: Todos os cards concluidos -> "
            f"{expected_waves} ondas concluidas"
        )

    # --- Test 5: W0 complete, W1 incomplete (one card missing), W2 all complete ---
    # Only W0 should be counted as completed (prefix breaks at W1)
    if second_wave and len(sorted_waves) >= 3:
        third_wave = sorted_waves[2]
        w0_cards = [c for c in cards if c["wave"] == first_wave]
        w1_cards = [c for c in cards if c["wave"] == second_wave]
        w2_cards = [c for c in cards if c["wave"] == third_wave]

        status5 = {}
        for c in w0_cards:
            status5[c["id"]] = "concluido"
        # Mark all but one card of W1 as completed
        for c in w1_cards[:-1]:
            status5[c["id"]] = "concluido"
        # Mark all cards of W2 as completed
        for c in w2_cards:
            status5[c["id"]] = "concluido"

        state5 = derive_state(cards, status5)
        if state5["completed_wave_count"] != 1:
            print(
                f"FAIL [t5]: Esperado 1 onda concluida (prefixo), "
                f"obtido {state5['completed_wave_count']}"
            )
            errors += 1
        elif state5["completed_waves"] != [first_wave]:
            print(
                f"FAIL [t5]: Esperado {[first_wave]}, "
                f"obtido {state5['completed_waves']}"
            )
            errors += 1
        else:
            print(
                f"PASS [t5]: {first_wave} completa, {second_wave} incompleta, "
                f"{third_wave} completa -> apenas {first_wave} concluida "
                f"(prefixo ininterrupto)"
            )
    else:
        print("SKIP [t5]: Menos de 3 ondas, pulando teste de prefixo")

    # --- Test 6: status_counts includes "pendente" for cards without status ---
    state6 = derive_state(cards, {})
    pending_count = state6["status_counts"].get("pendente", 0)
    if pending_count != len(cards):
        print(
            f"FAIL [t6]: Esperado {len(cards)} cards pendentes, "
            f"obtido {pending_count}"
        )
        errors += 1
    else:
        print(f"PASS [t6]: {pending_count} cards pendentes no estado vazio")

    print()
    if errors == 0:
        print("=== TODOS OS TESTES PASSARAM ===")
        sys.exit(0)
    else:
        print(f"=== {errors} TESTE(S) FALHARAM ===")
        sys.exit(1)


def main() -> None:
    if "--selftest" in sys.argv:
        cmd_selftest()
    elif "--verificar" in sys.argv:
        cmd_verificar()
    elif "--salvar" in sys.argv:
        cmd_salvar()
    else:
        cmd_default()


if __name__ == "__main__":
    main()
