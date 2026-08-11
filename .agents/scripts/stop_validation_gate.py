#!/usr/bin/env python3
"""
Stop validation gate: wave barrier.

Prevents the agent from terminating (Stop) until all tasks in the current wave
are complete. Reads .agents/.wave_state.json; exits 2 if the wave is incomplete.

Guard: stop_hook_active flag prevents infinite loops — if the hook has already
blocked once, it allows Stop to prevent the agent from being trapped.

Exit codes: 0 = allow Stop, 2 = block Stop

State file format (.agents/.wave_state.json):
{
  "wave_id": "onda2",
  "tasks": [
    {"id": "T-05", "name": "Hooks", "done": false, "gate_passed": false},
    ...
  ],
  "stop_hook_active": false
}
"""

import json
import sys
from pathlib import Path

STATE_FILE = Path(".agents/.wave_state.json")


def main() -> None:
    # If no state file exists, allow Stop (no wave in progress)
    if not STATE_FILE.exists():
        print("[StopGate] No wave state file found — allowing Stop")
        sys.exit(0)

    # Parse state file
    try:
        state = json.loads(STATE_FILE.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        print(f"[StopGate] Could not parse wave state: {exc} — allowing Stop")
        sys.exit(0)

    tasks = state.get("tasks", [])
    wave_id = state.get("wave_id", "unknown")

    # Find incomplete tasks
    incomplete = [
        t for t in tasks
        if not t.get("done") or not t.get("gate_passed")
    ]

    if not incomplete:
        print(f"[StopGate] Wave '{wave_id}': all tasks complete — allowing Stop")
        sys.exit(0)

    # Guard: if stop_hook_active is already set, we have blocked once before
    # Allow Stop to prevent infinite loop
    if state.get("stop_hook_active"):
        print("[StopGate] WARNING: stop_hook_active is set — preventing infinite loop, allowing Stop")
        print("[StopGate] Incomplete tasks:")
        for t in incomplete:
            print(f"  {t['id']}: {t.get('name', '?')} (done={t.get('done')}, gate={t.get('gate_passed')})")
        sys.exit(0)

    # Set the guard flag and persist
    state["stop_hook_active"] = True
    STATE_FILE.write_text(json.dumps(state, indent=2))

    # Block Stop
    print(f"[StopGate] BLOCKING Stop — wave '{wave_id}' has incomplete tasks:")
    for t in incomplete:
        print(f"  {t['id']}: {t.get('name', '?')} (done={t.get('done')}, gate={t.get('gate_passed')})")
    print("[StopGate] Complete all tasks and run their gates before stopping.")
    print("[StopGate] The stop_hook_active flag has been set — next Stop will be allowed.")
    sys.exit(2)


if __name__ == "__main__":
    main()
