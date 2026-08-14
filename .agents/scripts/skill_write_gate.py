#!/usr/bin/env python3
"""
Skill write gate v2 — contract version (see meta-skill-evolution, "O gate de
escrita, em três camadas").

Blocks Write/Edit on SKILL.md unless a FRESH GREEN eval token exists for that
skill: token file present, last_eval_passed true, mtime < 30 min, and the sha1
of the on-disk SKILL.md equals the sha1 recorded when the token was issued.

Contract deltas vs v1 (each defect measured in the reference corpus and
prescribed in this program's own meta-skill):
  - root resolved via `git rev-parse --show-toplevel` (cwd-independent; v1
    opened the gate for any skill when run from another directory)
  - fail-closed: empty/missing argv BLOCKS (v1 allowed; unexpected input is red)
  - token bound to content sha1 (a green from old content authorizes nothing;
    v1's name-only record stayed green forever)
  - TTL of 30 min (a green from half an hour ago authorizes nothing; v1's
    committed JSON never expired)
  - token lives in .agents/skills/.eval_records/ (gitignored, local, never
    inherited by another worktree)
  - block messages on stderr (the harness surfaces stderr on a blocked action)

Exit codes: 0 = allow, 2 = block
"""

import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

TTL_SECONDS = 30 * 60


def repo_root() -> Path:
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode == 0:
            root = Path(proc.stdout.strip())
            if root != Path("/") and root.is_dir():
                return root
    except (OSError, subprocess.TimeoutExpired):
        pass
    return Path(os.getcwd())


def main() -> None:
    root = repo_root()
    raw_path = sys.argv[1] if len(sys.argv) > 1 else ""

    # Fail-closed: unexpected input is red (contract: "entrada inesperada é vermelho").
    if not raw_path:
        print("[SkillGate] BLOCKING write: no file path provided (fail-closed). "
              "The hook payload must supply .tool_input.file_path.", file=sys.stderr)
        sys.exit(2)

    path = Path(raw_path)
    if not path.is_absolute():
        path = root / path

    # Only gate SKILL.md files under the repo's skills directory.
    skills_dir = (root / ".agents/skills").resolve()
    try:
        path_res = path.resolve()
        path_res.relative_to(skills_dir)
    except ValueError:
        # Outside .agents/skills/ — not gated content.
        sys.exit(0)

    if path_res.name != "SKILL.md":
        sys.exit(0)

    skill_name = path_res.parent.name
    if skill_name.startswith("."):
        # Internal/dotfile skill dirs are not gated.
        sys.exit(0)

    skill_md = path_res

    # Initial creation: no SKILL.md yet under the repo root → allow.
    if not skill_md.exists():
        print(f"[SkillGate] Initial creation of SKILL.md for '{skill_name}' — allowing write",
              file=sys.stderr)
        sys.exit(0)

    # Token check: fresh green record bound to the current content.
    token_file = skills_dir / ".eval_records" / f"{skill_name}.json"
    if not token_file.exists():
        print(f"[SkillGate] BLOCKING write to {raw_path}: no eval token for '{skill_name}'",
              file=sys.stderr)
        print(f"[SkillGate] Run the skill eval suite to obtain a green token:",
              file=sys.stderr)
        print(f"[SkillGate]   python3 .agents/scripts/run_skill_evals.py {skill_name}",
              file=sys.stderr)
        sys.exit(2)

    try:
        record = json.loads(token_file.read_text())
    except (json.JSONDecodeError, OSError):
        print(f"[SkillGate] BLOCKING write to {raw_path}: eval token for "
              f"'{skill_name}' is unreadable — re-run the eval suite", file=sys.stderr)
        sys.exit(2)

    if not record.get("last_eval_passed"):
        print(f"[SkillGate] BLOCKING write to {raw_path}: eval record for "
              f"'{skill_name}' is not green — re-run the eval suite", file=sys.stderr)
        sys.exit(2)

    age = time.time() - token_file.stat().st_mtime
    if age > TTL_SECONDS:
        print(f"[SkillGate] BLOCKING write to {raw_path}: eval token for "
              f"'{skill_name}' is stale ({int(age)} s old, TTL {TTL_SECONDS} s) — "
              "re-run the eval suite", file=sys.stderr)
        sys.exit(2)

    current_sha1 = hashlib.sha1(skill_md.read_bytes()).hexdigest()
    if record.get("sha1") != current_sha1:
        print(f"[SkillGate] BLOCKING write to {raw_path}: eval token for "
              f"'{skill_name}' was issued for different content (sha1 mismatch) — "
              "re-run the eval suite after this edit", file=sys.stderr)
        sys.exit(2)

    print(f"[SkillGate] Eval token green and fresh for '{skill_name}' — allowing write",
          file=sys.stderr)
    sys.exit(0)


if __name__ == "__main__":
    main()
