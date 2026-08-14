#!/usr/bin/env python3
"""
Generate .agents/skills/catalog.md from the frontmatter of all SKILL.md files.

This file is GENERATED — never edit it by hand. Regenerate with:
  python3 .agents/scripts/gerar-catalogo.py

Or via just:
  just skills-catalogo
"""

import sys
import os
import re
from pathlib import Path
from glob import glob
from collections import defaultdict

import yaml


SKILLS_DIR = ".agents/skills"
CATALOG_PATH = ".agents/skills/catalog.md"

# Tier display order and labels
TIER_ORDER = ["router", "metodo", "dominio", "meta"]
TIER_LABELS = {
    "router": "## Router — sempre primeiro",
    "metodo": "## Método — como o programa é executado",
    "dominio": "## Domínio — o que o programa constrói",
    "meta": "## Meta — como a memória evolui",
}


def find_skill_files(root: str = ".") -> list[Path]:
    """Find all SKILL.md files exactly one level below SKILLS_DIR."""
    pattern = os.path.join(root, SKILLS_DIR, "*/SKILL.md")
    return sorted(Path(p) for p in glob(pattern))


def _fix_description_yaml(yaml_str: str) -> str | None:
    """
    Attempt to fix YAML frontmatter where the description value contains ': '
    (e.g. 'Triggers: "foo"'). This is a known issue with plain scalars in YAML.
    """
    lines = yaml_str.split("\n")
    fixed_lines = []
    in_description = False
    desc_lines = []

    for line in lines:
        if in_description:
            if line and not line[0].isspace() and ":" in line:
                in_description = False
                joined = " ".join(desc_lines).replace("\\", "\\\\").replace('"', '\\"')
                fixed_lines.append(f'description: "{joined}"')
                fixed_lines.append(line)
            else:
                desc_lines.append(line.strip())
        elif line.startswith("description:"):
            rest = line[len("description:"):].strip()
            if rest.startswith("|") or rest.startswith(">") or rest.startswith("-"):
                fixed_lines.append(line)
            elif rest:
                desc_lines = [rest]
                in_description = True
            else:
                desc_lines = []
                in_description = True
        else:
            fixed_lines.append(line)

    if in_description and desc_lines:
        joined = " ".join(desc_lines).replace("\\", "\\\\").replace('"', '\\"')
        fixed_lines.append(f'description: "{joined}"')

    return "\n".join(fixed_lines)


def parse_skill(filepath: Path) -> dict | None:
    """Parse a SKILL.md file and return its frontmatter metadata."""
    content = filepath.read_text(encoding="utf-8")
    if not content.startswith("---"):
        return None
    second = content.find("---", 3)
    if second == -1:
        return None
    yaml_str = content[3:second].strip()

    # Try strict YAML first
    try:
        return yaml.safe_load(yaml_str) or {}
    except yaml.YAMLError:
        # Try fixing common YAML issue: Triggers: in description value
        fixed = _fix_description_yaml(yaml_str)
        if fixed is not None:
            try:
                return yaml.safe_load(fixed) or {}
            except yaml.YAMLError:
                return None
        return None


def extract_use_when(description: str) -> str:
    """
    Extract the "use when" portion from the description.
    This is the text after "Use whenever" or "Use when" or "Use ",
    before the triggers section.
    """
    # Find the "use" clause
    use_text = ""
    for marker in ["Use whenever ", "Use when ", "Use "]:
        if marker in description:
            use_text = description.split(marker, 1)[1]
            break

    if not use_text:
        # Fallback: use the text before triggers
        for delim in ["Triggers —", "Triggers:", "Triggers are"]:
            if delim in description:
                use_text = description.split(delim)[0].strip()
                break
        if not use_text:
            use_text = description.strip()

    # Strip trailing triggers section
    for delim in ["Triggers —", "Triggers:", "Triggers are"]:
        if delim in use_text:
            use_text = use_text.split(delim)[0]

    return use_text.strip().rstrip(".").strip()


def extract_triggers(description: str) -> list[str]:
    """
    Extract individual trigger terms from the description.
    Returns a list of normalized trigger strings.
    """
    triggers = []

    # Find the triggers section
    trigger_text = ""
    for delim in ["Triggers —", "Triggers:", "Triggers are", "Triggers "]:
        if delim in description:
            trigger_text = description.split(delim, 1)[1]
            break

    if not trigger_text:
        return []

    # Normalize: remove quotes, split by comma, clean up
    # First, try to extract quoted triggers
    quoted = re.findall(r'"([^"]+)"', trigger_text)
    for q in quoted:
        triggers.append(q.lower().strip())

    # Also handle unquoted, comma-separated triggers
    # Remove already-extracted quoted parts
    remaining = re.sub(r'"[^"]+"', "", trigger_text)
    # Split by comma
    parts = remaining.replace(";", ",").split(",")
    for part in parts:
        t = part.strip().strip('"').strip("'").strip(".").strip()
        if t and len(t) > 1:
            triggers.append(t.lower())

    # Deduplicate while preserving order
    seen = set()
    result = []
    for t in triggers:
        if t not in seen:
            seen.add(t)
            result.append(t)

    return result


def build_trigger_index(skills: list[dict]) -> dict[str, list[str]]:
    """
    Build a mapping from trigger term to list of skill names.
    """
    index = defaultdict(list)
    for skill in skills:
        for trigger in skill.get("triggers", []):
            index[trigger].append(skill["name"])
    return dict(index)


def truncate(text: str, max_len: int = 77) -> str:
    """Truncate text with ellipsis if too long."""
    if len(text) <= max_len:
        return text
    return text[:max_len] + "…"


def generate_catalog(skills: list[dict], trigger_index: dict[str, list[str]]) -> str:
    """Generate the full catalog.md content."""
    lines = []

    # Header
    lines.append("# Catálogo de skills — Editor de Vídeo IA")
    lines.append("")
    lines.append(
        "> **Arquivo GERADO** a partir do frontmatter de cada `SKILL.md`. "
        "Não edite à mão: regenere com"
    )
    lines.append(
        "> `python3 .agents/scripts/gerar-catalogo.py`. "
        "Se este arquivo e os frontmatter divergirem, **este** é o que está errado — "
        "ele é a representação derivada."
    )
    lines.append("")

    # Routing instructions
    lines.append("## Como rotear — dois níveis, obrigatório")
    lines.append("")
    lines.append(
        f"Este catálogo tem **{len(skills)} skills**, acima do limiar (~15) em que "
        "roteamento por palavra-chave degrada. O `project-router` escolhe primeiro o "
        "**tier**, e só depois a skill dentro dele. Roteamento de um nível nesta escala "
        "erra, e erra em silêncio."
    )
    lines.append("")
    lines.append(
        "**As duas obrigatórias por classe de tarefa** — carregadas por regra, "
        "não por julgamento do agente:"
    )
    lines.append("")
    lines.append("| Se a tarefa… | Carregue antes, sempre | Porque a falha é… |")
    lines.append("|---|---|---|")
    lines.append(
        "| altera saída **visual ou sonora** | `video-characterization` | "
        'silenciosa: "o render passou" parece prova e não é |'
    )
    lines.append(
        "| escreve em arquivo tocado por **outro card** | `parallel-worktrees` | "
        "confirmatória: o merge limpo confirma a ilusão de escopo contido |"
    )
    lines.append("")

    # Organize skills by tier
    by_tier = defaultdict(list)
    for skill in skills:
        tier = (skill.get("metadata") or {}).get("tier", "dominio")
        by_tier[tier].append(skill)

    for tier in TIER_ORDER:
        tier_skills = by_tier.get(tier, [])
        if not tier_skills:
            continue

        lines.append(TIER_LABELS[tier])
        lines.append("")
        lines.append("| Skill | `type` | Carregue quando |")
        lines.append("|---|---|---|")

        for skill in sorted(tier_skills, key=lambda s: s["name"]):
            name = skill["name"]
            skill_type = (skill.get("metadata") or {}).get("type", "knowledge")
            use_when = truncate(skill.get("use_when", ""))
            link = f"[`{name}`]({name}/SKILL.md)"
            lines.append(f"| {link} | {skill_type} | {use_when} |")

        lines.append("")

    # Trigger index
    lines.append("## Índice de gatilhos")
    lines.append("")
    lines.append(
        "Termo → skill. **Um termo reivindicado por duas skills é dívida de roteamento**, "
        "não redundância saudável: `meta-skill-consolidate` mede isso e propõe fusão."
    )
    lines.append("")

    total_triggers = len(trigger_index)
    ambiguous = {k: v for k, v in trigger_index.items() if len(v) > 1}
    ambiguous_count = len(ambiguous)
    ambiguous_pct = round(ambiguous_count / total_triggers * 100, 1) if total_triggers else 0

    lines.append(
        f"Gatilhos declarados: **{total_triggers}** · "
        f"ambíguos (2+ donos): **{ambiguous_count}** ({ambiguous_pct}%)"
    )
    lines.append("")

    # Ambiguous triggers
    if ambiguous:
        lines.append("### Ambíguos — desambiguar na próxima consolidação")
        lines.append("")
        lines.append("| Gatilho | Reivindicado por |")
        lines.append("|---|---|")
        for trigger in sorted(ambiguous.keys()):
            owners = ", ".join(ambiguous[trigger])
            lines.append(f"| `{trigger}` | {owners} |")
        lines.append("")

    # All triggers
    lines.append("### Todos os gatilhos")
    lines.append("")
    lines.append("| Gatilho | Skill |")
    lines.append("|---|---|")
    for trigger in sorted(trigger_index.keys()):
        owners = ", ".join(trigger_index[trigger])
        lines.append(f"| `{trigger}` | {owners} |")

    lines.append("")
    return "\n".join(lines)


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
            if root and root != "/" and os.path.isdir(root):
                return root
    except Exception:
        pass
    return cwd


def main() -> int:
    """Generate the catalog and write it to disk. Returns exit code."""
    repo_root = resolve_repo_root()
    skills_dir = Path(repo_root) / SKILLS_DIR
    if not skills_dir.is_dir():
        print(f"ERROR: skills directory not found: {skills_dir}", file=sys.stderr)
        return 2

    skill_files = find_skill_files(repo_root)
    if not skill_files:
        print(f"ERROR: no SKILL.md files found in {skills_dir}", file=sys.stderr)
        return 2

    # Parse all skills
    skills = []
    for fp in skill_files:
        meta = parse_skill(fp)
        if meta is None:
            print(f"WARNING: cannot parse frontmatter in {fp}", file=sys.stderr)
            continue
        name = meta.get("name", fp.parent.name)
        description = meta.get("description", "")
        meta["name"] = name
        meta["use_when"] = extract_use_when(description)
        meta["triggers"] = extract_triggers(description)
        skills.append(meta)

    if not skills:
        print("ERROR: no skills parsed successfully", file=sys.stderr)
        return 2

    # Build trigger index
    trigger_index = build_trigger_index(skills)

    # Generate catalog
    catalog_content = generate_catalog(skills, trigger_index)

    # Write to disk
    catalog_path = Path(repo_root) / CATALOG_PATH
    catalog_path.write_text(catalog_content, encoding="utf-8")

    print(f"Catalog written: {catalog_path}")
    print(f"  Skills: {len(skills)}")
    print(f"  Triggers: {len(trigger_index)}")
    print(f"  Ambiguous: {len([k for k, v in trigger_index.items() if len(v) > 1])}")

    return 0


if __name__ == "__main__":
    sys.exit(main())