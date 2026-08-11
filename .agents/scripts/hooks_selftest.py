#!/usr/bin/env python3
"""
Self-test suite for all hooks.

Tests each hook script in isolation by calling it as a subprocess with
controlled arguments and verifying exit codes and output.

Usage:
    python3 .agents/scripts/hooks_selftest.py

Exit codes:
    0 = all tests passed
    1 = one or more tests failed
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = Path(os.getcwd())


def run_hook(script_name: str, *args: str) -> subprocess.CompletedProcess:
    """Run a hook script and return the result."""
    script_path = SCRIPTS_DIR / script_name
    cmd = [sys.executable, str(script_path), *args]
    return subprocess.run(cmd, capture_output=True, text=True, cwd=str(PROJECT_ROOT))


def assert_exit_code(result: subprocess.CompletedProcess, expected: int, test_name: str) -> bool:
    """Assert that the exit code matches expected."""
    if result.returncode != expected:
        print(f"  FAIL: {test_name}")
        print(f"    Expected exit {expected}, got {result.returncode}")
        print(f"    stdout: {result.stdout.strip()[:200]}")
        print(f"    stderr: {result.stderr.strip()[:200]}")
        return False
    return True


def assert_output_contains(result: subprocess.CompletedProcess, text: str, test_name: str) -> bool:
    """Assert that stdout contains the given text."""
    if text.lower() not in result.stdout.lower():
        print(f"  FAIL: {test_name}")
        print(f"    Expected output to contain '{text}'")
        print(f"    stdout: {result.stdout.strip()[:200]}")
        return False
    return True


# ═══════════════════════════════════════════════════════════════════════════
# bash_guardrail.py tests
# ═══════════════════════════════════════════════════════════════════════════

def test_bash_guardrail() -> int:
    """Test bash_guardrail.py allowlist logic."""
    failures = 0
    print("\n--- bash_guardrail.py ---")

    # Test 1: Empty command → allow
    r = run_hook("bash_guardrail.py", "")
    if assert_exit_code(r, 0, "Empty command allows"):
        print("  PASS: Empty command allows")

    # Test 2: Safe command (git status) → allow
    r = run_hook("bash_guardrail.py", "git status")
    if assert_exit_code(r, 0, "Safe command (git status) allows"):
        print("  PASS: Safe command (git status) allows")
    else:
        failures += 1

    # Test 3: Safe npm command → allow
    r = run_hook("bash_guardrail.py", "npm install")
    if assert_exit_code(r, 0, "Safe command (npm install) allows"):
        print("  PASS: Safe command (npm install) allows")
    else:
        failures += 1

    # Test 4: rm -rf / → block
    r = run_hook("bash_guardrail.py", "rm -rf /")
    if assert_exit_code(r, 2, "rm -rf / blocks"):
        if assert_output_contains(r, "BLOCKING", "rm -rf / output contains BLOCKING"):
            print("  PASS: rm -rf / is blocked")
        else:
            failures += 1
    else:
        failures += 1

    # Test 5: rm -rf ~ → block
    r = run_hook("bash_guardrail.py", "rm -rf ~")
    if assert_exit_code(r, 2, "rm -rf ~ blocks"):
        print("  PASS: rm -rf ~ is blocked")
    else:
        failures += 1

    # Test 6: sudo rm -rf / → block (sudo primitive triggers first)
    r = run_hook("bash_guardrail.py", "sudo rm -rf /")
    if assert_exit_code(r, 2, "sudo rm -rf / blocks"):
        print("  PASS: sudo rm -rf / is blocked")
    else:
        failures += 1

    # Test 7: rm -rf /home → block
    r = run_hook("bash_guardrail.py", "rm -rf /home")
    if assert_exit_code(r, 2, "rm -rf /home blocks"):
        print("  PASS: rm -rf /home is blocked")
    else:
        failures += 1

    # Test 8: rm -rf /etc → block
    r = run_hook("bash_guardrail.py", "rm -rf /etc")
    if assert_exit_code(r, 2, "rm -rf /etc blocks"):
        print("  PASS: rm -rf /etc is blocked")
    else:
        failures += 1

    # Test 9: rm -rf node_modules → allow (safe directory)
    r = run_hook("bash_guardrail.py", "rm -rf node_modules")
    if assert_exit_code(r, 0, "rm -rf node_modules allows"):
        print("  PASS: rm -rf node_modules is allowed")
    else:
        failures += 1

    # Test 10: rm -rf __pycache__ → allow (safe directory)
    r = run_hook("bash_guardrail.py", "rm -rf __pycache__")
    if assert_exit_code(r, 0, "rm -rf __pycache__ allows"):
        print("  PASS: rm -rf __pycache__ is allowed")
    else:
        failures += 1

    # Test 11: cat .env → block (secrets read)
    r = run_hook("bash_guardrail.py", "cat .env")
    if assert_exit_code(r, 2, "cat .env blocks"):
        print("  PASS: cat .env is blocked")
    else:
        failures += 1

    # Test 12: cat .env.local → block (secrets read)
    r = run_hook("bash_guardrail.py", "cat .env.local")
    if assert_exit_code(r, 2, "cat .env.local blocks"):
        print("  PASS: cat .env.local is blocked")
    else:
        failures += 1

    # Test 13: grep SECRET .env → block (secrets read)
    r = run_hook("bash_guardrail.py", "grep SECRET .env")
    if assert_exit_code(r, 2, "grep SECRET .env blocks"):
        print("  PASS: grep SECRET .env is blocked")
    else:
        failures += 1

    # Test 14: cat secrets/tokens.json → block (secrets dir)
    r = run_hook("bash_guardrail.py", "cat secrets/tokens.json")
    if assert_exit_code(r, 2, "cat secrets/tokens.json blocks"):
        print("  PASS: cat secrets/tokens.json is blocked")
    else:
        failures += 1

    # Test 15: cat id_rsa → block (private key)
    r = run_hook("bash_guardrail.py", "cat ~/.ssh/id_rsa")
    if assert_exit_code(r, 2, "cat id_rsa blocks"):
        print("  PASS: cat id_rsa is blocked")
    else:
        failures += 1

    # Test 16: rm some_file.txt → allow (single file)
    r = run_hook("bash_guardrail.py", "rm some_file.txt")
    if assert_exit_code(r, 0, "rm some_file.txt allows"):
        print("  PASS: rm some_file.txt is allowed")
    else:
        failures += 1

    # Test 17: rm -rf /tmp/foo → block (absolute path not in allowlist)
    r = run_hook("bash_guardrail.py", "rm -rf /tmp/foo")
    if assert_exit_code(r, 2, "rm -rf /tmp/foo blocks (absolute path not in allowlist)"):
        print("  PASS: rm -rf /tmp/foo is blocked (absolute path not in allowlist)")
    else:
        failures += 1

    # Test 18: dd command → block
    r = run_hook("bash_guardrail.py", "dd if=/dev/zero of=/dev/sda")
    if assert_exit_code(r, 2, "dd command blocks"):
        print("  PASS: dd command is blocked")
    else:
        failures += 1

    # Test 19: chmod 777 → block
    r = run_hook("bash_guardrail.py", "chmod 777 /etc/passwd")
    if assert_exit_code(r, 2, "chmod 777 blocks"):
        print("  PASS: chmod 777 is blocked")
    else:
        failures += 1

    # Test 20: fork bomb → block
    r = run_hook("bash_guardrail.py", ":(){ :|:& };:")
    if assert_exit_code(r, 2, "fork bomb blocks"):
        print("  PASS: fork bomb is blocked")
    else:
        failures += 1

    # Test 21: echo with SECRET env var → block
    r = run_hook("bash_guardrail.py", "echo $SECRET_KEY")
    if assert_exit_code(r, 2, "echo $SECRET_KEY blocks"):
        print("  PASS: echo $SECRET_KEY is blocked")
    else:
        failures += 1

    # Test 22: ls command → allow (non-dangerous)
    r = run_hook("bash_guardrail.py", "ls -la")
    if assert_exit_code(r, 0, "ls -la allows"):
        print("  PASS: ls -la is allowed")
    else:
        failures += 1

    # Test 23: python3 script → allow (non-dangerous)
    r = run_hook("bash_guardrail.py", "python3 .agents/scripts/skill_lint.py")
    if assert_exit_code(r, 0, "python3 script allows"):
        print("  PASS: python3 script is allowed")
    else:
        failures += 1

    # Test 24: rm -rf .claude/worktrees/foo → allow (safe worktree cleanup)
    r = run_hook("bash_guardrail.py", "rm -rf .claude/worktrees/onda2-hooks")
    if assert_exit_code(r, 0, "rm -rf .claude/worktrees/ allows"):
        print("  PASS: rm -rf .claude/worktrees/ is allowed")
    else:
        failures += 1

    return failures


# ═══════════════════════════════════════════════════════════════════════════
# skill_write_gate.py tests
# ═══════════════════════════════════════════════════════════════════════════

def test_skill_write_gate() -> int:
    """Test skill_write_gate.py token gate logic."""
    failures = 0
    print("\n--- skill_write_gate.py ---")

    # Test 1: Empty path → allow
    r = run_hook("skill_write_gate.py", "")
    if assert_exit_code(r, 0, "Empty path allows"):
        print("  PASS: Empty path allows")

    # Test 2: Non-SKILL.md path → allow
    r = run_hook("skill_write_gate.py", "src/App.tsx")
    if assert_exit_code(r, 0, "Non-SKILL.md path allows"):
        print("  PASS: Non-SKILL.md path allows")
    else:
        failures += 1

    # Test 3: SKILL.md outside skills/ → allow
    r = run_hook("skill_write_gate.py", "docs/SKILL.md")
    if assert_exit_code(r, 0, "SKILL.md outside skills/ allows"):
        print("  PASS: SKILL.md outside skills/ allows")
    else:
        failures += 1

    # Test 4: Non-existent skill → allow (initial creation)
    r = run_hook("skill_write_gate.py", ".agents/skills/nonexistent-skill/SKILL.md")
    if assert_exit_code(r, 0, "Non-existent skill allows (initial creation)"):
        if assert_output_contains(r, "Initial creation", "Non-existent skill output"):
            print("  PASS: Non-existent skill allows initial creation")
        else:
            failures += 1
    else:
        failures += 1

    # Test 5: Existing skill without eval record → block
    # We test with 'project-router' which exists but has no .eval_records/
    r = run_hook("skill_write_gate.py", ".agents/skills/project-router/SKILL.md")
    if assert_exit_code(r, 2, "Existing skill without eval record blocks"):
        if assert_output_contains(r, "BLOCKING", "Existing skill output contains BLOCKING"):
            print("  PASS: Existing skill without eval record is blocked")
        else:
            failures += 1
    else:
        failures += 1

    # Test 6: Existing skill with green eval record → allow
    eval_records_dir = PROJECT_ROOT / ".agents/skills/.eval_records"
    eval_records_dir.mkdir(parents=True, exist_ok=True)
    test_record = eval_records_dir / "project-router.json"
    test_record.write_text(json.dumps({"last_eval_passed": True}))
    try:
        r = run_hook("skill_write_gate.py", ".agents/skills/project-router/SKILL.md")
        if assert_exit_code(r, 0, "Existing skill with green eval record allows"):
            if assert_output_contains(r, "Eval record green", "Green eval output"):
                print("  PASS: Existing skill with green eval record is allowed")
            else:
                failures += 1
        else:
            failures += 1
    finally:
        # Cleanup
        test_record.unlink(missing_ok=True)
        # Remove dir if empty
        try:
            eval_records_dir.rmdir()
        except OSError:
            pass

    # Test 7: Existing skill with non-green eval record → block
    eval_records_dir.mkdir(parents=True, exist_ok=True)
    test_record = eval_records_dir / "project-router.json"
    test_record.write_text(json.dumps({"last_eval_passed": False}))
    try:
        r = run_hook("skill_write_gate.py", ".agents/skills/project-router/SKILL.md")
        if assert_exit_code(r, 2, "Existing skill with non-green eval record blocks"):
            print("  PASS: Existing skill with non-green eval record is blocked")
        else:
            failures += 1
    finally:
        test_record.unlink(missing_ok=True)
        try:
            eval_records_dir.rmdir()
        except OSError:
            pass

    # Test 8: Dotfile skill dir → allow
    r = run_hook("skill_write_gate.py", ".agents/skills/.internal/SKILL.md")
    if assert_exit_code(r, 0, "Dotfile skill dir allows"):
        print("  PASS: Dotfile skill dir allows")
    else:
        failures += 1

    return failures


# ═══════════════════════════════════════════════════════════════════════════
# stop_validation_gate.py tests
# ═══════════════════════════════════════════════════════════════════════════

def test_stop_validation_gate() -> int:
    """Test stop_validation_gate.py wave barrier logic."""
    failures = 0
    print("\n--- stop_validation_gate.py ---")

    wave_state_file = PROJECT_ROOT / ".agents/.wave_state.json"

    # Clean up any existing state file
    wave_state_file.unlink(missing_ok=True)

    # Test 1: No state file → allow
    r = run_hook("stop_validation_gate.py")
    if assert_exit_code(r, 0, "No state file allows"):
        print("  PASS: No state file allows Stop")

    # Test 2: All tasks complete → allow
    state = {
        "wave_id": "onda2",
        "tasks": [
            {"id": "T-01", "name": "Package config", "done": True, "gate_passed": True},
            {"id": "T-05", "name": "Hooks", "done": True, "gate_passed": True},
        ],
        "stop_hook_active": False,
    }
    wave_state_file.write_text(json.dumps(state, indent=2))
    try:
        r = run_hook("stop_validation_gate.py")
        if assert_exit_code(r, 0, "All tasks complete allows"):
            if assert_output_contains(r, "all tasks complete", "All complete output"):
                print("  PASS: All tasks complete allows Stop")
            else:
                failures += 1
        else:
            failures += 1
    finally:
        wave_state_file.unlink(missing_ok=True)

    # Test 3: Incomplete tasks → block
    state = {
        "wave_id": "onda2",
        "tasks": [
            {"id": "T-01", "name": "Package config", "done": True, "gate_passed": True},
            {"id": "T-05", "name": "Hooks", "done": False, "gate_passed": False},
        ],
        "stop_hook_active": False,
    }
    wave_state_file.write_text(json.dumps(state, indent=2))
    try:
        r = run_hook("stop_validation_gate.py")
        if assert_exit_code(r, 2, "Incomplete tasks block"):
            if assert_output_contains(r, "BLOCKING", "Incomplete tasks output"):
                print("  PASS: Incomplete tasks block Stop")
            else:
                failures += 1
        else:
            failures += 1

        # Verify stop_hook_active was set
        updated = json.loads(wave_state_file.read_text())
        if updated.get("stop_hook_active"):
            print("  PASS: stop_hook_active flag was set")
        else:
            print("  FAIL: stop_hook_active flag was NOT set")
            failures += 1
    finally:
        wave_state_file.unlink(missing_ok=True)

    # Test 4: stop_hook_active prevents infinite loop → allow
    state = {
        "wave_id": "onda2",
        "tasks": [
            {"id": "T-05", "name": "Hooks", "done": False, "gate_passed": False},
        ],
        "stop_hook_active": True,
    }
    wave_state_file.write_text(json.dumps(state, indent=2))
    try:
        r = run_hook("stop_validation_gate.py")
        if assert_exit_code(r, 0, "stop_hook_active prevents infinite loop"):
            if assert_output_contains(r, "infinite loop", "Infinite loop prevention output"):
                print("  PASS: stop_hook_active flag prevents infinite loop")
            else:
                failures += 1
        else:
            failures += 1
    finally:
        wave_state_file.unlink(missing_ok=True)

    # Test 5: Malformed state file → allow (fail-safe)
    wave_state_file.write_text("{not valid json")
    try:
        r = run_hook("stop_validation_gate.py")
        if assert_exit_code(r, 0, "Malformed state file allows (fail-safe)"):
            print("  PASS: Malformed state file allows Stop (fail-safe)")
        else:
            failures += 1
    finally:
        wave_state_file.unlink(missing_ok=True)

    # Test 6: Task done but gate not passed → blocked
    state = {
        "wave_id": "onda2",
        "tasks": [
            {"id": "T-01", "name": "Task done no gate", "done": True, "gate_passed": False},
        ],
        "stop_hook_active": False,
    }
    wave_state_file.write_text(json.dumps(state, indent=2))
    try:
        r = run_hook("stop_validation_gate.py")
        if assert_exit_code(r, 2, "Task done but gate not passed blocks"):
            print("  PASS: Task done but gate not passed blocks Stop")
        else:
            failures += 1
    finally:
        wave_state_file.unlink(missing_ok=True)

    return failures


# ═══════════════════════════════════════════════════════════════════════════
# calibration_nudge.py tests
# ═══════════════════════════════════════════════════════════════════════════

def test_calibration_nudge() -> int:
    """Test calibration_nudge.py nudge output."""
    failures = 0
    print("\n--- calibration_nudge.py ---")

    r = run_hook("calibration_nudge.py")

    # Test 1: Always exits 0
    if assert_exit_code(r, 0, "Calibration nudge always exits 0"):
        print("  PASS: Calibration nudge exits 0")

    # Test 2: Contains C1
    if assert_output_contains(r, "C1", "Contains C1 rule"):
        print("  PASS: Contains C1 rule")
    else:
        failures += 1

    # Test 3: Contains C2
    if assert_output_contains(r, "C2", "Contains C2 rule"):
        print("  PASS: Contains C2 rule")
    else:
        failures += 1

    # Test 4: Contains C9
    if assert_output_contains(r, "C9", "Contains C9 rule"):
        print("  PASS: Contains C9 rule")
    else:
        failures += 1

    # Test 5: Contains C12
    if assert_output_contains(r, "C12", "Contains C12 rule"):
        print("  PASS: Contains C12 rule")
    else:
        failures += 1

    # Test 6: Contains "Calibracao" header
    if assert_output_contains(r, "Calibracao", "Contains Calibracao header"):
        print("  PASS: Contains Calibracao header")
    else:
        failures += 1

    return failures


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("=" * 60)
    print("HOOKS SELFTEST — Editor de Video IA")
    print("=" * 60)

    total_failures = 0

    total_failures += test_bash_guardrail()
    total_failures += test_skill_write_gate()
    total_failures += test_stop_validation_gate()
    total_failures += test_calibration_nudge()

    print("\n" + "=" * 60)
    if total_failures == 0:
        print("RESULT: ALL TESTS PASSED")
    else:
        print(f"RESULT: {total_failures} TEST(S) FAILED")
    print("=" * 60)

    sys.exit(0 if total_failures == 0 else 1)


if __name__ == "__main__":
    main()
