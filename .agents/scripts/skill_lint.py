#!/usr/bin/env python3
"""
Linter for SKILL.md files in .agents/skills/*/SKILL.md.

Validates:
  - Frontmatter YAML (name, description, metadata.type)
  - Missing type → ERROR (not silence)
  - description measured with yaml.safe_load (not regex)
  - name must match parent directory name
  - Rejects $data in the body
  - Rejects citation without path (provenance check)

Exit codes:
  0 — no errors, no warnings
  1 — warnings only (body line budget, etc.)
  2 — errors (form, missing fields, etc.)
"""

import sys
import os
import re
from pathlib import Path
from glob import glob

import yaml


SKILLS_DIR = ".agents/skills"
BODY_LINE_WARN = 400
BODY_LINE_ERROR = 500


def find_skill_files(root: str = ".") -> list[Path]:
    """Find all SKILL.md files exactly one level below SKILLS_DIR."""
    pattern = os.path.join(root, SKILLS_DIR, "*/SKILL.md")
    return sorted(Path(p) for p in glob(pattern))


def _fix_description_yaml(yaml_str: str) -> str | None:
    """
    Attempt to fix YAML frontmatter where the description value contains ': '
    (e.g. 'Triggers: "foo"'). This is a known issue with plain scalars in YAML.

    Returns the fixed YAML string, or None if the fix is not applicable.
    """
    lines = yaml_str.split("\n")
    fixed_lines = []
    in_description = False
    desc_lines = []

    for line in lines:
        if in_description:
            # Check if this line starts a new top-level key (no indentation)
            if line and not line[0].isspace() and ":" in line:
                # End of description block
                in_description = False
                # Join the collected description lines and wrap in double quotes
                joined = " ".join(desc_lines).replace("\\", "\\\\").replace('"', '\\"')
                fixed_lines.append(f'description: "{joined}"')
                fixed_lines.append(line)
            else:
                desc_lines.append(line.strip())
        elif line.startswith("description:"):
            rest = line[len("description:"):].strip()
            if rest.startswith("|") or rest.startswith(">") or rest.startswith("-"):
                # Block scalar - YAML handles this natively
                fixed_lines.append(line)
            elif rest:
                # Single-line plain scalar - collect it
                desc_lines = [rest]
                in_description = True
            else:
                # Description key with value on next line(s)
                desc_lines = []
                in_description = True
        else:
            fixed_lines.append(line)

    if in_description and desc_lines:
        joined = " ".join(desc_lines).replace("\\", "\\\\").replace('"', '\\"')
        fixed_lines.append(f'description: "{joined}"')

    return "\n".join(fixed_lines)


def parse_frontmatter(filepath: Path) -> tuple[dict | None, str, str | None]:
    """
    Parse YAML frontmatter from a SKILL.md file.
    Returns (metadata_dict, body, error_message).
    metadata_dict is None on parse failure.
    """
    try:
        content = filepath.read_text(encoding="utf-8")
    except Exception as e:
        return None, "", f"cannot read file: {e}"

    # Must start with ---
    if not content.startswith("---"):
        return None, content, "missing opening frontmatter delimiter (---)"

    # Find the second ---
    second = content.find("---", 3)
    if second == -1:
        return None, content, "missing closing frontmatter delimiter (---)"

    yaml_str = content[3:second].strip()
    body = content[second + 3 :]

    if not yaml_str:
        return None, body, "empty frontmatter"

    # Try strict YAML first
    try:
        metadata = yaml.safe_load(yaml_str)
    except yaml.YAMLError:
        # Try fixing common YAML issue: Triggers: in description value
        fixed = _fix_description_yaml(yaml_str)
        if fixed is not None:
            try:
                metadata = yaml.safe_load(fixed)
            except yaml.YAMLError as e:
                return None, body, f"YAML parse error in frontmatter: {e}"
        else:
            return None, body, "YAML parse error in frontmatter (could not fix)"

    if metadata is None:
        return None, body, "frontmatter parsed to null/empty"

    if not isinstance(metadata, dict):
        return None, body, f"frontmatter is not a mapping (got {type(metadata).__name__})"

    return metadata, body, None


def validate_description(metadata: dict, filepath: Path) -> str | None:
    """Validate description field using the parsed YAML (not regex)."""
    if "description" not in metadata:
        return "missing 'description' field"

    desc = metadata["description"]
    if desc is None:
        return "'description' is null"

    if not isinstance(desc, str):
        return f"'description' is not a string (got {type(desc).__name__})"

    if not desc.strip():
        return "'description' is empty"

    # Check length: spec says max 1024 chars
    if len(desc) > 1024:
        return f"'description' is {len(desc)} chars (max 1024)"

    return None


def validate_name(metadata: dict, filepath: Path) -> str | None:
    """Validate that 'name' equals the parent directory name."""
    if "name" not in metadata:
        return "missing 'name' field"

    name = metadata["name"]
    if name is None:
        return "'name' is null"

    if not isinstance(name, str):
        return f"'name' is not a string (got {type(name).__name__})"

    parent_dir = filepath.parent.name
    if name != parent_dir:
        return f"'name' ({name!r}) does not match directory name ({parent_dir!r})"

    return None


def validate_type(metadata: dict, filepath: Path) -> str | None:
    """Validate that metadata.type is present and non-empty. Missing → ERROR."""
    meta = metadata.get("metadata")
    if meta is None:
        return "missing 'metadata' section in frontmatter"

    if not isinstance(meta, dict):
        return f"'metadata' is not a mapping (got {type(meta).__name__})"

    if "type" not in meta:
        return "missing 'metadata.type' field"

    type_val = meta["type"]
    if type_val is None:
        return "'metadata.type' is null"

    if not isinstance(type_val, str):
        return f"'metadata.type' is not a string (got {type(type_val).__name__})"

    if not type_val.strip():
        return "'metadata.type' is empty"

    return None


def check_body_data_ref(body: str) -> str | None:
    """Reject $data in the skill body (YAML data reference leaking into prose)."""
    # $data is a YAML 1.1 data reference. In the body of a markdown file it
    # indicates a malformed template or a copy-paste error.
    if "$data" in body:
        return "body contains '$data' (YAML data reference)"
    return None


def check_citation_provenance(body: str) -> str | None:
    """
    Check that the body has at least one citation with a path (URL or file:line).
    A skill body with zero path-bearing citations has no traceable provenance.

    A path-bearing citation matches:
      - https://... or http://...
      - file:line pattern like docs/foo.md:123 or path/to/file.py:45-67
      - file with section marker like PROGRAMA.md §VI-4 or docs/playbook.md §8
      - prefixed paths like 3b1b:path/to/file.py:100
    """
    # URL pattern
    if re.search(r"https?://", body):
        return None

    # file:line or file:line-range pattern
    # Matches things like: docs/foo.md:123, src/bar.py:45-67, 3b1b:path/to/file.ts:100
    # Allow an optional prefix before the path (like "3b1b:")
    if re.search(r"(?:^|\s|[(\[`])(?:[\w.\-]+:)?(?:[\w.][\w.\-]*/)*[\w.\-]+\.(?:md|py|ts|tsx|js|json|yaml|yml|toml|html|css|sh):\d+", body):
        return None

    # file with section marker: PROGRAMA.md §VI-4, docs/playbook.md §8
    if re.search(r"\b[\w.\-]+\.md\s+§", body):
        return None

    return "no citation with path found in body (provenance)"


def lint_skill(filepath: Path) -> tuple[list[str], list[str]]:
    """
    Lint a single SKILL.md file.
    Returns (errors, warnings).
    """
    errors = []
    warnings = []

    metadata, body, fm_error = parse_frontmatter(filepath)
    if fm_error:
        errors.append(fm_error)
        return errors, warnings

    # Validate frontmatter fields
    for validator, label in [
        (validate_name, "name"),
        (validate_description, "description"),
        (validate_type, "metadata.type"),
    ]:
        err = validator(metadata, filepath)
        if err:
            errors.append(err)

    # Body checks
    body_err = check_body_data_ref(body)
    if body_err:
        errors.append(body_err)

    prov_err = check_citation_provenance(body)
    if prov_err:
        errors.append(prov_err)

    # Line budget warnings
    body_lines = body.count("\n")
    if body_lines > BODY_LINE_ERROR:
        errors.append(f"body is {body_lines} lines (max {BODY_LINE_ERROR})")
    elif body_lines > BODY_LINE_WARN:
        warnings.append(f"body is {body_lines} lines (warning at {BODY_LINE_WARN})")

    return errors, warnings


def resolve_repo_root() -> str:
    """Resolve the repository root. Falls back to cwd if git is not available."""
    cwd = os.getcwd()
    try:
        import subprocess
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            root = result.stdout.strip()
            # Guard against git returning "/" when run outside a repo
            if root and root != "/" and os.path.isdir(root):
                return root
    except Exception:
        pass
    return cwd


def main() -> int:
    """Run the linter over all skills. Returns exit code."""
    repo_root = resolve_repo_root()
    skills_dir = Path(repo_root) / SKILLS_DIR
    if not skills_dir.is_dir():
        print(f"ERROR: skills directory not found: {skills_dir}", file=sys.stderr)
        return 2

    skill_files = find_skill_files(repo_root)
    if not skill_files:
        print(f"WARNING: no SKILL.md files found in {skills_dir}", file=sys.stderr)
        return 1

    total_errors = 0
    total_warnings = 0

    for fp in skill_files:
        rel = str(fp.relative_to(repo_root)) if fp.is_relative_to(repo_root) else str(fp)
        errors, warnings = lint_skill(fp)

        if errors or warnings:
            print(f"\n=== {rel} ===")

        for e in errors:
            print(f"  ERROR: {e}")
            total_errors += 1

        for w in warnings:
            print(f"  WARNING: {w}")
            total_warnings += 1

    if total_errors == 0 and total_warnings == 0:
        print(f"OK: {len(skill_files)} skills, no errors, no warnings")
        return 0
    elif total_errors == 0:
        print(f"\n{len(skill_files)} skills, {total_warnings} warning(s), 0 errors")
        return 1
    else:
        print(f"\n{len(skill_files)} skills, {total_errors} error(s), {total_warnings} warning(s)",
              file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())