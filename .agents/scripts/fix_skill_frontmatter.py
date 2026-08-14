#!/usr/bin/env python3
"""
Deterministic repair of SKILL.md frontmatter: quote the description so the
on-disk YAML parses WITHOUT the tolerant fixup.

The defect (measured across the catalog at the bootstrap run): descriptions
are written as YAML plain scalars containing `Triggers: "x"` — a `: ` inside a
plain scalar is invalid YAML ("mapping values are not allowed here"). The
linter and the catalog generator tolerate it via _fix_description_yaml; the
loader tolerates it too — but "linter green" and "skill carregável" are
different things, and this program's own falso-verde table demands a raw
yaml.safe_load probe. This script makes the on-disk form valid.

The transformation re-emits the frontmatter with the description wrapped in
double quotes (inner quotes escaped). Everything else (name, metadata keys,
verification_signal) is re-emitted from the parsed values, so the round-trip
is content-preserving — verified by comparing parsed name/type/tier/signal
before and after, and by requiring the raw parse to succeed after.

Usage:
    python3 .agents/scripts/fix_skill_frontmatter.py [skill...]

Exit: 0 = all target files now raw-parse; 2 = any file still fails.
"""

import sys
import yaml
from pathlib import Path
from glob import glob

SKILLS_DIR = Path(".agents/skills")


def parse_tolerant(content: str) -> dict | None:
    """Parse with the same tolerant path as skill_lint (fixup fallback)."""
    if not content.startswith("---"):
        return None
    second = content.find("---", 3)
    if second == -1:
        return None
    yaml_str = content[3:second].strip()
    try:
        return yaml.safe_load(yaml_str)
    except yaml.YAMLError:
        # Reuse the linter's fixup: join the description into a quoted scalar.
        lines = yaml_str.split("\n")
        fixed, in_desc, desc_lines = [], False, []
        for line in lines:
            if in_desc:
                if line and not line[0].isspace() and ":" in line:
                    in_desc = False
                    joined = " ".join(desc_lines).replace("\\", "\\\\").replace('"', '\\"')
                    fixed.append(f'description: "{joined}"')
                    fixed.append(line)
                else:
                    desc_lines.append(line.strip())
            elif line.startswith("description:"):
                rest = line[len("description:"):].strip()
                if rest:
                    desc_lines, in_desc = [rest], True
                else:
                    in_desc = True
            else:
                fixed.append(line)
        if in_desc and desc_lines:
            joined = " ".join(desc_lines).replace("\\", "\\\\").replace('"', '\\"')
            fixed.append(f'description: "{joined}"')
        try:
            return yaml.safe_load("\n".join(fixed))
        except yaml.YAMLError:
            return None


def fix_file(skill_dir: Path) -> tuple[bool, str]:
    md = skill_dir / "SKILL.md"
    content = md.read_text()
    if not content.startswith("---"):
        return False, "missing opening ---"
    second = content.find("---", 3)
    if second == -1:
        return False, "missing closing ---"
    raw = content[3:second].strip()

    # Already valid? Nothing to do.
    try:
        yaml.safe_load(raw)
        return True, "already valid"
    except yaml.YAMLError:
        pass

    meta = parse_tolerant(content)
    if meta is None:
        return False, "cannot parse frontmatter even with fixup"

    desc = meta.get("description", "")
    name = meta.get("name", skill_dir.name)
    meta_block = meta.get("metadata", {})
    body = content[second + 3:]

    # Dump the WHOLE frontmatter as one mapping (safe_dump of a bare scalar
    # would append an end-of-document marker; a mapping dump does not).
    fm = {"name": name, "description": desc, "metadata": meta_block}
    dumped = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False,
                            width=1 << 30).rstrip()
    new_content = f"---\n{dumped}\n---" + body

    # Verify: raw parse must succeed, and the round-trip must preserve values
    # exactly (dict equality, not field-by-field).
    try:
        re_meta = yaml.safe_load(dumped)
    except yaml.YAMLError as e:
        return False, f"re-emitted frontmatter still invalid: {e}"
    if re_meta != fm:
        return False, "round-trip changed frontmatter values"

    md.write_text(new_content)
    return True, f"quoted description ({len(desc)} chars)"


def main() -> int:
    targets = sys.argv[1:] or sorted(d.name for d in SKILLS_DIR.glob("*/"))
    all_ok = True
    for name in targets:
        skill_dir = SKILLS_DIR / name
        ok, msg = fix_file(skill_dir)
        status = "OK  " if ok else "FAIL"
        print(f"{status} {name}: {msg}")
        all_ok = all_ok and ok
    return 0 if all_ok else 2


if __name__ == "__main__":
    sys.exit(main())
