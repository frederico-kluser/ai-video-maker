#!/usr/bin/env python3
"""
Bootstrap stop gate: mission-phase barrier.

Prevents the agent from terminating (Stop) until every phase in the
bootstrap state file (.agents/skills/.bootstrap-state.json) is done AND
its gate passed. This makes "complete the full mission" a deterministic
guarantee rather than a hope.

Guard: stop_hook_active flag prevents infinite loops — if the hook has
already blocked once, it allows Stop to prevent the agent from being trapped,
after printing a clear report of what is still incomplete.

Exit codes: 0 = allow Stop, 2 = block Stop
"""

import json
import sys
from pathlib import Path

STATE_FILE = Path(".agents/skills/.bootstrap-state.json")


def main() -> None:
    # No state file -> no bootstrap mission in progress; allow Stop.
    if not STATE_FILE.exists():
        print("[BootstrapGate] No bootstrap state file — allowing Stop")
        sys.exit(0)

    try:
        state = json.loads(STATE_FILE.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[BootstrapGate] Could not parse bootstrap state: {exc} — allowing Stop")
        sys.exit(0)

    phases = state.get("phases", [])
    if not phases:
        print("[BootstrapGate] No phases in bootstrap state — allowing Stop")
        sys.exit(0)

    incomplete = [
        p for p in phases
        if not p.get("done") or not p.get("gate_passed")
    ]

    if not incomplete:
        print("[BootstrapGate] All bootstrap phases complete — allowing Stop")
        sys.exit(0)

    # Guard: if we have already blocked once, allow Stop (no infinite loop),
    # but surface the report so the incomplete state is visible.
    if state.get("stop_hook_active"):
        print("[BootstrapGate] WARNING: stop_hook_active is set — allowing Stop to avoid an infinite loop")
        print("[BootstrapGate] Still incomplete:")
        for p in incomplete:
            print(f"  phase {p.get('id')}: {p.get('name', '?')} (done={p.get('done')}, gate={p.get('gate_passed')})")
        sys.exit(0)

    # Set the guard flag and persist.
    state["stop_hook_active"] = True
    STATE_FILE.write_text(json.dumps(state, indent=2))

    # Block Stop.
    print("[BootstrapGate] BLOCKING Stop — bootstrap mission has incomplete phases:")
    for p in incomplete:
        print(f"  phase {p.get('id')}: {p.get('name', '?')} (done={p.get('done')}, gate={p.get('gate_passed')})")
    print("[BootstrapGate] Complete all phases and pass their gates before stopping.")
    print("[BootstrapGate] The stop_hook_active flag has been set — next Stop will be allowed with a report.")
    sys.exit(2)


if __name__ == "__main__":
    main()
