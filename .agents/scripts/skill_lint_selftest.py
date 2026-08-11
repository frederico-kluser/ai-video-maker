#!/usr/bin/env python3
"""
Self-tests for skill_lint.py that assert the MESSAGE, not just the exit code.

Each test creates a temporary directory with a SKILL.md and runs the linter
against it, capturing both stdout/stderr and exit code.
"""

import sys
import os
import tempfile
import subprocess
from pathlib import Path

# Path to the linter script
LINT_SCRIPT = Path(__file__).resolve().parent / "skill_lint.py"


def run_lint(work_dir: Path) -> tuple[int, str, str]:
    """Run the linter from the work_dir that contains .agents/skills/. Returns (exit_code, stdout, stderr)."""
    result = subprocess.run(
        [sys.executable, str(LINT_SCRIPT)],
        capture_output=True,
        text=True,
        cwd=str(work_dir),
        timeout=10,
    )
    return result.returncode, result.stdout, result.stderr


def make_skill(work_dir: Path, name: str, frontmatter: str, body: str = "") -> Path:
    """Create a skill directory with SKILL.md inside .agents/skills/<name>/."""
    skills_dir = work_dir / ".agents" / "skills"
    skills_dir.mkdir(parents=True, exist_ok=True)
    skill_dir = skills_dir / name
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_file = skill_dir / "SKILL.md"
    if frontmatter.startswith("---"):
        content = frontmatter + "\n" + body
    else:
        content = "---\n" + frontmatter + "\n---\n" + body
    skill_file.write_text(content, encoding="utf-8")
    return work_dir


def test_all_ok():
    """A valid skill should pass with exit 0."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "my-skill",
            "name: my-skill\n"
            "description: A test skill with provenance.\n"
            "metadata:\n"
            "  type: knowledge\n"
            "  tier: dominio\n",
            "See https://example.com/docs for details.\n"
            "Also see docs/guide.md:42 for more.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 0, f"expected exit 0, got {code}\nstdout={stdout}\nstderr={stderr}"
        assert "OK:" in stdout, f"expected 'OK:' in stdout, got: {stdout}"
        assert "no errors" in stdout, f"expected 'no errors' in stdout, got: {stdout}"


def test_missing_type_is_error():
    """Missing metadata.type must be an ERROR, not silence."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "no-type-skill",
            "name: no-type-skill\n"
            "description: A test skill.\n"
            "metadata:\n"
            "  tier: dominio\n",
            "See https://example.com for provenance.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2 (error), got {code}\nstdout={stdout}\nstderr={stderr}"
        assert "missing 'metadata.type' field" in stdout, (
            f"expected 'missing metadata.type field' in output, got: {stdout}"
        )


def test_name_must_match_directory():
    """name must equal the parent directory name."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "correct-name",
            "name: wrong-name\n"
            "description: A test skill.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See https://example.com for provenance.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        assert "does not match directory name" in stdout, (
            f"expected 'does not match directory name' in output, got: {stdout}"
        )
        assert "wrong-name" in stdout, f"expected 'wrong-name' in output, got: {stdout}"
        assert "correct-name" in stdout, f"expected 'correct-name' in output, got: {stdout}"


def test_description_measured_with_yaml_not_regex():
    """Multiline descriptions must be measured correctly with yaml.safe_load, not regex."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        # A multiline description that a regex would only read the first line of
        make_skill(
            work,
            "multi-skill",
            "name: multi-skill\n"
            "description: |\n"
            "  This is a multiline description.\n"
            "  It has multiple lines of text.\n"
            "  A regex reading only the first line would miss all this.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See https://example.com for provenance.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 0, f"expected exit 0, got {code}\nstdout={stdout}\nstderr={stderr}"
        assert "OK:" in stdout, f"expected OK, got: {stdout}"


def test_description_too_long():
    """Description longer than 1024 chars must be an error."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        long_desc = "A" * 1025
        make_skill(
            work,
            "long-skill",
            f"name: long-skill\n"
            f"description: {long_desc}\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See https://example.com for provenance.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        assert "max 1024" in stdout, f"expected 'max 1024' in output, got: {stdout}"


def test_reject_dollar_data_in_body():
    """$data in the skill body must be rejected."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "data-skill",
            "name: data-skill\n"
            "description: A test skill.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "Here is some body text with $data reference in it.\n"
            "See https://example.com for provenance.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        assert "$data" in stdout, f"expected '$data' in output, got: {stdout}"


def test_reject_no_provenance():
    """A skill body with zero path-bearing citations must be rejected."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "no-prov-skill",
            "name: no-prov-skill\n"
            "description: A test skill with no provenances.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "This body has no URLs and no file:line citations.\n"
            "It just has prose with no traceable sources.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        assert "no citation with path" in stdout, (
            f"expected 'no citation with path' in output, got: {stdout}"
        )


def test_url_provenance_passes():
    """A skill body with a URL passes provenance check."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "url-skill",
            "name: url-skill\n"
            "description: A test skill with URL provenance.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See https://agentskills.io/specification for details.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 0, f"expected exit 0, got {code}\nstdout={stdout}\nstderr={stderr}"


def test_fileline_provenance_passes():
    """A skill body with a file:line citation passes provenance check."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "fileline-skill",
            "name: fileline-skill\n"
            "description: A test skill with file:line provenance.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See docs/PLAYBOOK-REFERENCIA.md:159-161 for details.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 0, f"expected exit 0, got {code}\nstdout={stdout}\nstderr={stderr}"


def test_prefixed_fileline_provenance_passes():
    """A skill body with a 3b1b: prefixed file:line citation passes provenance check."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "prefixed-skill",
            "name: prefixed-skill\n"
            "description: A test skill with prefixed provenance.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See 3b1b:.agents/scripts/skill_lint.py:54-55 for the reference.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 0, f"expected exit 0, got {code}\nstdout={stdout}\nstderr={stderr}"


def test_body_line_warning():
    """A body over 400 lines should produce a warning (exit 1)."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        body_lines = ["Line " + str(i) for i in range(401)]
        body_text = "\n".join(body_lines) + "\nSee https://example.com for provenance.\n"
        make_skill(
            work,
            "big-skill",
            "name: big-skill\n"
            "description: A test skill with a large body.\n"
            "metadata:\n"
            "  type: knowledge\n",
            body_text,
        )
        code, stdout, stderr = run_lint(work)
        # Should have warnings (exit 1) but not errors
        assert code == 1, f"expected exit 1 (warning), got {code}\nstdout={stdout}\nstderr={stderr}"
        assert "warning" in stdout.lower() or "WARNING" in stdout, (
            f"expected 'WARNING' in output, got: {stdout}"
        )


def test_body_line_error():
    """A body over 500 lines should produce an error (exit 2)."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        body_lines = ["Line " + str(i) for i in range(501)]
        body_text = "\n".join(body_lines) + "\nSee https://example.com for provenance.\n"
        make_skill(
            work,
            "huge-skill",
            "name: huge-skill\n"
            "description: A test skill with a huge body.\n"
            "metadata:\n"
            "  type: knowledge\n",
            body_text,
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2 (error), got {code}\nstdout={stdout}"
        assert "500" in stdout, f"expected '500' in output, got: {stdout}"


def test_missing_frontmatter():
    """A file with no proper frontmatter mapping should produce an error."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        # The make_skill helper wraps content in ---, so the "frontmatter" is a
        # plain string, not a mapping. This produces a "not a mapping" error.
        make_skill(
            work,
            "nofm-skill",
            "This is not YAML frontmatter.\n",
            "body\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        assert "not a mapping" in stdout, (
            f"expected 'not a mapping' in output, got: {stdout}"
        )


def test_empty_frontmatter():
    """A file with empty frontmatter should produce an error."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "emptyfm-skill",
            "---\n---\n",
            "body\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        assert "empty frontmatter" in stdout, (
            f"expected 'empty frontmatter' in output, got: {stdout}"
        )


def test_missing_description():
    """A skill without description should produce an error."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        make_skill(
            work,
            "nodesc-skill",
            "name: nodesc-skill\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See https://example.com for provenance.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        assert "missing 'description' field" in stdout, (
            f"expected 'missing description field' in output, got: {stdout}"
        )


def test_multiple_skills_mixed_results():
    """Multiple skills: some pass, some fail. Exit code should be the worst (2)."""
    with tempfile.TemporaryDirectory() as td:
        work = Path(td)
        # Good skill
        make_skill(
            work,
            "good-skill",
            "name: good-skill\n"
            "description: A good skill.\n"
            "metadata:\n"
            "  type: knowledge\n",
            "See https://example.com for provenance.\n",
        )
        # Bad skill: missing type
        make_skill(
            work,
            "bad-skill",
            "name: bad-skill\n"
            "description: A bad skill.\n"
            "metadata:\n"
            "  tier: dominio\n",
            "See https://example.com for provenance.\n",
        )
        code, stdout, stderr = run_lint(work)
        assert code == 2, f"expected exit 2, got {code}\nstdout={stdout}"
        # The bad skill should appear in output with the error
        assert "bad-skill" in stdout, f"expected 'bad-skill' in output, got: {stdout}"
        assert "missing 'metadata.type' field" in stdout, (
            f"expected error about missing type in output, got: {stdout}"
        )


def main():
    """Run all tests."""
    tests = [
        ("all_ok", test_all_ok),
        ("missing_type_is_error", test_missing_type_is_error),
        ("name_must_match_directory", test_name_must_match_directory),
        ("description_measured_with_yaml", test_description_measured_with_yaml_not_regex),
        ("description_too_long", test_description_too_long),
        ("reject_dollar_data_in_body", test_reject_dollar_data_in_body),
        ("reject_no_provenance", test_reject_no_provenance),
        ("url_provenance_passes", test_url_provenance_passes),
        ("fileline_provenance_passes", test_fileline_provenance_passes),
        ("prefixed_fileline_provenance_passes", test_prefixed_fileline_provenance_passes),
        ("body_line_warning", test_body_line_warning),
        ("body_line_error", test_body_line_error),
        ("missing_frontmatter", test_missing_frontmatter),
        ("empty_frontmatter", test_empty_frontmatter),
        ("missing_description", test_missing_description),
        ("multiple_skills_mixed_results", test_multiple_skills_mixed_results),
    ]

    failures = 0
    for name, test_fn in tests:
        try:
            test_fn()
            print(f"  PASS: {name}")
        except AssertionError as e:
            print(f"  FAIL: {name}")
            print(f"        {e}")
            failures += 1
        except Exception as e:
            print(f"  ERROR: {name}")
            print(f"         {type(e).__name__}: {e}")
            failures += 1

    print(f"\n{len(tests)} tests, {failures} failure(s)")
    return 1 if failures > 0 else 0


if __name__ == "__main__":
    sys.exit(main())