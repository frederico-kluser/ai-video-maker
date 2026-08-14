#!/usr/bin/env python3
"""
Per-skill eval runner — produces the green write-gate token.

For each skill under .agents/skills/ (or the named subset), four layers:

  FORM      — skill_lint.py must report 0 errors for the whole catalog.
              Warnings (line-budget, 400..500) are non-error debt owned by
              meta-skill-consolidate, not a gate failure.
  RAW-YAML  — the on-disk frontmatter must parse with yaml.safe_load with NO
              fixup. This is the probe the project-router's falso-verde table
              prescribes ("linter verde" != "skill carregável"). A description
              written as a plain scalar containing "Triggers: ..." is invalid
              YAML even when the tolerant parser repairs it.
  ROUTING   — reads the GENERATED catalog.md (the real router surface, not a
              duplicate map): the skill appears in the catalog, its use_when
              is non-empty, and it owns at least one trigger no other skill
              claims.
  SIGNAL    — the skill's own verification_signal is executed verbatim with a
              60 s timeout. A failing signal issues a token with
              signal_status="debt:<reason>" ONLY when the other three layers
              passed — the debt must be cleared (fix the signal, re-run).
              A skill whose signal layer is missing is red, never green.

Zero assertions = red (all([]) must never be True): if catalog parsing finds
no trigger rows, every routing layer fails.

On all-green the token is written to
.agents/skills/.eval_records/<skill>.json:
  {"last_eval_passed": true, "sha1": <sha1 of the SKILL.md>, "evaled_at": <epoch>,
   "signal_status": "ok" | "debt:<reason>"}
On any red layer the token is removed.

Exit codes: 0 = all requested skills fully green; 1 = green with signal debt;
            2 = form/raw-yaml/routing failures.
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from glob import glob
from pathlib import Path

import yaml

ROOT = Path(os.getcwd())
SKILLS_DIR = ROOT / ".agents/skills"
RECORDS_DIR = SKILLS_DIR / ".eval_records"
CATALOG = SKILLS_DIR / "catalog.md"
SIGNAL_TIMEOUT = 60

# Trigger-row regex of the generated catalog: | `trigger` | owner, owner |
TRIGGER_ROW = re.compile(r"^\| `(.+?)` \| (.+?) \|$")
# Skill row of the tier tables: | [`name`](name/SKILL.md) | type | use_when |
SKILL_ROW = re.compile(r"^\| \[`(.+?)`\]\((.+?)/SKILL\.md\) \| (.+?) \| (.+?)\|$")


def sha1_of(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()


def parse_catalog() -> tuple[dict, dict]:
    """Parse catalog.md. Returns (skills, trigger_index)."""
    if not CATALOG.exists():
        return {}, {}
    text = CATALOG.read_text()
    skills: dict[str, dict] = {}
    trigger_index: dict[str, list[str]] = {}
    in_triggers = False
    for line in text.splitlines():
        m = SKILL_ROW.match(line)
        if m and not in_triggers:
            skills[m.group(1)] = {"use_when": m.group(4).strip(), "type": m.group(3).strip()}
        if line.startswith("### Todos os gatilhos"):
            in_triggers = True
            continue
        if in_triggers:
            t = TRIGGER_ROW.match(line)
            if t:
                trigger_index[t.group(1)] = [o.strip() for o in t.group(2).split(",")]
    return skills, trigger_index


def raw_yaml_ok(skill_dir: Path) -> tuple[bool, str]:
    """The on-disk frontmatter must parse WITHOUT the fixup."""
    content = (skill_dir / "SKILL.md").read_text()
    if not content.startswith("---"):
        return False, "missing opening ---"
    second = content.find("---", 3)
    if second == -1:
        return False, "missing closing ---"
    try:
        yaml.safe_load(content[3:second])
    except yaml.YAMLError as e:
        return False, f"raw YAML parse failed: {e}"
    return True, ""


def get_signal(skill_dir: Path) -> str:
    content = (skill_dir / "SKILL.md").read_text()
    try:
        meta = yaml.safe_load(content.split("---", 2)[1])
    except yaml.YAMLError:
        return ""
    return ((meta or {}).get("metadata") or {}).get("verification_signal", "") or ""


def run_signal(signal: str) -> tuple[int, str]:
    """Execute the signal verbatim. Returns (exit_code, last_output_lines)."""
    try:
        proc = subprocess.run(
            ["timeout", str(SIGNAL_TIMEOUT), "sh", "-c", signal],
            capture_output=True, text=True, cwd=str(ROOT), timeout=SIGNAL_TIMEOUT + 10,
        )
    except (subprocess.TimeoutExpired, OSError) as e:
        return 2, f"could not run signal: {e}"
    tail = (proc.stdout + proc.stderr).strip().splitlines()[-3:]
    return proc.returncode, "\n".join(tail)


def lint_errors() -> int:
    """Run skill_lint.py; returns error count (warnings tolerated)."""
    proc = subprocess.run(
        [sys.executable, str(ROOT / ".agents/scripts/skill_lint.py")],
        capture_output=True, text=True, cwd=str(ROOT),
    )
    err_count = 0
    for line in (proc.stdout + proc.stderr).splitlines():
        if line.strip().startswith("ERROR:"):
            err_count += 1
    return err_count


def evaluate(skill_name: str, lint_err_total: int, catalog_skills: dict, trigger_index: dict) -> dict:
    """Evaluate one skill. Returns a result dict."""
    skill_dir = SKILLS_DIR / skill_name
    result = {
        "name": skill_name,
        "layers": {},       # layer -> True/False
        "reasons": {},      # layer -> short reason
        "signal_debt": "",
        "green": False,
    }

    # FORM
    form_ok = (lint_err_total == 0)
    result["layers"]["form"] = form_ok
    if not form_ok:
        result["reasons"]["form"] = f"{lint_err_total} lint error(s) in catalog"

    # RAW-YAML
    yaml_ok, yaml_reason = raw_yaml_ok(skill_dir)
    result["layers"]["raw-yaml"] = yaml_ok
    if not yaml_ok:
        result["reasons"]["raw-yaml"] = yaml_reason

    # ROUTING
    if skill_name not in catalog_skills:
        result["layers"]["routing"] = False
        result["reasons"]["routing"] = "skill not present in generated catalog.md"
    else:
        use_when = catalog_skills[skill_name]["use_when"]
        unique = any(
            owners == [skill_name]
            for owners in trigger_index.values()
        )
        routing_ok = bool(use_when) and unique
        result["layers"]["routing"] = routing_ok
        if not routing_ok:
            missing = []
            if not use_when:
                missing.append("use_when empty")
            if not unique:
                missing.append("no uniquely-owned trigger")
            result["reasons"]["routing"] = "; ".join(missing)

    # SIGNAL (debt-tolerant: only issued when the other three layers pass)
    signal = get_signal(skill_dir)
    if not signal:
        result["layers"]["signal"] = False
        result["reasons"]["signal"] = "no verification_signal declared"
    else:
        rc, tail = run_signal(signal)
        result["layers"]["signal"] = (rc == 0)
        if rc != 0:
            result["reasons"]["signal"] = f"signal exit {rc}: {tail[:200]}"

    core_ok = all(result["layers"][k] for k in ("form", "raw-yaml", "routing"))
    signal_ok = result["layers"].get("signal", False)

    if core_ok and signal_ok:
        result["green"] = True
    elif core_ok and not signal_ok:
        result["green"] = True
        result["signal_debt"] = result["reasons"].get("signal", "signal failed")[:200]
    else:
        result["green"] = False

    return result


def write_token(skill_name: str, result: dict) -> None:
    """Write (green) or remove (red) the eval token."""
    skill_md = SKILLS_DIR / skill_name / "SKILL.md"
    token = RECORDS_DIR / f"{skill_name}.json"
    if not result["green"]:
        token.unlink(missing_ok=True)
        return
    record = {
        "last_eval_passed": True,
        "sha1": sha1_of(skill_md),
        "evaled_at": int(time.time()),
        "signal_status": "ok" if not result["signal_debt"] else f"debt:{result['signal_debt']}",
    }
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    token.write_text(json.dumps(record, indent=2))


def main() -> int:
    targets = sys.argv[1:] or sorted(
        d.name for d in SKILLS_DIR.glob("*/") if not d.name.startswith(".")
    )
    if not SKILLS_DIR.is_dir():
        print("ERROR: no .agents/skills dir", file=sys.stderr)
        return 2

    catalog_skills, trigger_index = parse_catalog()
    if not trigger_index:
        print("ERROR: catalog.md has no trigger rows — refusing to evaluate against nothing",
              file=sys.stderr)
        return 2

    lint_err_total = lint_errors()

    results = []
    for name in targets:
        skill_dir = SKILLS_DIR / name
        if not (skill_dir / "SKILL.md").exists():
            print(f"ERROR: unknown skill {name}", file=sys.stderr)
            return 2
        r = evaluate(name, lint_err_total, catalog_skills, trigger_index)
        write_token(name, r)
        results.append(r)

    n_green = sum(1 for r in results if r["green"])
    n_debt = sum(1 for r in results if r["signal_debt"])
    n_red = len(results) - n_green

    for r in results:
        status = "GREEN" if r["green"] and not r["signal_debt"] else (
            "DEBT " if r["green"] and r["signal_debt"] else "RED  ")
        print(f"{status} {r['name']}: " + " ".join(
            f"{k}={'ok' if v else 'FAIL'}" for k, v in r["layers"].items()))
        for layer, reason in r["reasons"].items():
            print(f"      {layer}: {reason}")
        if r["signal_debt"]:
            print(f"      signal debt: {r['signal_debt']}")

    print(f"\n{len(results)} skills: {n_green} green, {n_debt} with signal debt, {n_red} red")
    if n_red:
        return 2
    if n_debt:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
