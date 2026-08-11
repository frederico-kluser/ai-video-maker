#!/usr/bin/env python3
"""
Skill write gate: blocks Write/Edit on SKILL.md files unless a validation token exists.

The validation token is the existence of a green eval record for that skill.
Exit codes: 0 = allow, 2 = block

Gate logic:
  - Path does not contain "SKILL.md" or "skills" → allow (not a skill file)
  - Skill dir starts with "." → allow (internal/dotfile skill dirs)
  - File does not exist yet → allow (initial creation)
  - Green eval record exists → allow
  - Everything else → block
"""

import json
import sys
from pathlib import Path

SKILL_DIR = Path(".agents/skills")
EVAL_RECORDS_DIR = Path(".agents/skills/.eval_records")


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else ""

    # Only gate SKILL.md files under skills/
    if not path or "SKILL.md" not in path or "skills" not in path:
        sys.exit(0)

    # Determine which skill this belongs to
    skill_path = Path(path)
    # Walk up to find the skill directory (parent of SKILL.md)
    skill_name = skill_path.parent.name if skill_path.name == "SKILL.md" else None

    if not skill_name or skill_name.startswith("."):
        # Allow writes to non-skill areas or dotfile skill dirs
        sys.exit(0)

    # Check if the skill directory exists under SKILL_DIR
    skill_dir = SKILL_DIR / skill_name
    if not skill_dir.exists():
        # Skill directory doesn't exist yet — allow initial creation
        print(f"[SkillGate] Initial creation of skill '{skill_name}' — allowing write")
        sys.exit(0)

    # Check if SKILL.md exists — if not, this is initial creation
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        print(f"[SkillGate] Initial creation of SKILL.md for '{skill_name}' — allowing write")
        sys.exit(0)

    # Check if an eval record exists for this skill
    eval_file = EVAL_RECORDS_DIR / f"{skill_name}.json"
    if eval_file.exists():
        try:
            record = json.loads(eval_file.read_text())
            if record.get("last_eval_passed"):
                print(f"[SkillGate] Eval record green for '{skill_name}' — allowing write")
                sys.exit(0)
            else:
                print(f"[SkillGate] Eval record exists but NOT green for '{skill_name}'")
        except (json.JSONDecodeError, OSError):
            print(f"[SkillGate] Could not parse eval record for '{skill_name}'")

    # Block unvalidated writes
    print(f"[SkillGate] BLOCKING write to {path}: no green eval record for '{skill_name}'")
    print(f"[SkillGate] Run the skill eval suite to obtain a green token:")
    print(f"[SkillGate]   python3 .agents/scripts/skill_lint.py {skill_name}")
    print(f"[SkillGate] Or create .agents/skills/.eval_records/{skill_name}.json")
    print(f'[SkillGate] with {{"last_eval_passed": true}}')
    sys.exit(2)


if __name__ == "__main__":
    main()
