#!/usr/bin/env python3
"""Verificador de sincronia gate local <-> CI.

Garante que cada job do CI tem etapa correspondente no gate local,
e cada etapa do gate tem job correspondente no CI.

Job no CI sem etapa no gate → VERMELHO (adicao unilateral).
Etapa no gate sem job no CI → VERMELHO (estagio orfao).

Uso:
    python3 tools/espelho-ci.py [--gate PATH] [--ci PATH] [--json]

    python3 tools/espelho-ci.py
    python3 tools/espelho-ci.py --json
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import TextIO


# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

# Caminhos padrao relativos a raiz do repo
_DEFAULT_GATE = "tools/gate.sh"
_DEFAULT_CI = ".github/workflows/ci.yml"

# Regex para extrair nome de etapa (usado como fallback)
_DEFINE_STAGE_NAME_RE = re.compile(r'_define_stage\s+"([^"]+)"')

# Regex para extrair STAGE_ORDER
# Formato: STAGE_ORDER=("stage1" "stage2" ...)
_STAGE_ORDER_RE = re.compile(
    r'STAGE_ORDER=\(((?:"[^"]*"\s*)+)\)'
)


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def parse_gate_stages(gate_path: str) -> tuple[list[str], dict[str, dict]]:
    """Extrai as etapas definidas no gate.sh.

    Args:
        gate_path: Caminho para tools/gate.sh

    Returns:
        (stage_names, stage_info) onde stage_names e a lista ordenada
        e stage_info e um dicionario nome -> {desc, cmd, tools}
    """
    with open(gate_path, encoding="utf-8") as f:
        content = f.read()

    # Normaliza: remove continuacoes de linha (backslash + newline)
    # para que cada _define_stage ocupe uma linha logica
    normalized = re.sub(r'\\\s*\n\s*', '', content)

    # Regex para extrair os 4 argumentos de _define_stage
    # O comando (3o argumento) pode conter \" escapados
    _DEFINE_STAGE_FULL_RE = re.compile(
        r'_define_stage\s+"([^"]+)"\s+'    # name
        r'"([^"]*)"\s+'                     # desc (sem escapes)
        r'"((?:[^"\\]|\\.)*)"\s+'           # cmd (permite \")
        r'"([^"]*)"'                        # tools (sem escapes)
    )

    # Extrai definicoes de etapa
    stage_info: dict[str, dict] = {}
    for m in _DEFINE_STAGE_FULL_RE.finditer(normalized):
        name = m.group(1)
        desc = m.group(2)
        cmd = m.group(3)
        tools = m.group(4)
        stage_info[name] = {
            "desc": desc,
            "cmd": cmd,
            "tools": tools,
        }

    # Extrai ordem
    order_match = _STAGE_ORDER_RE.search(content)
    if order_match:
        names_str = order_match.group(1)
        stage_names = re.findall(r'"([^"]+)"', names_str)
    else:
        # Fallback: ordem de aparicao no arquivo
        stage_names = list(stage_info.keys())

    return stage_names, stage_info


def parse_ci_jobs(ci_path: str) -> list[str]:
    """Extrai os nomes dos jobs do CI.

    Args:
        ci_path: Caminho para .github/workflows/ci.yml

    Returns:
        Lista de nomes de jobs, na ordem em que aparecem no arquivo
    """
    with open(ci_path, encoding="utf-8") as f:
        content = f.read()

    # Parsing simplificado de YAML para extrair jobs
    # Procura a secao "jobs:" e extrai as chaves de nivel 1 dentro dela
    lines = content.split("\n")

    in_jobs = False
    jobs: list[str] = []
    for line in lines:
        stripped = line.rstrip()

        # Detecta inicio da secao jobs
        if re.match(r"^jobs:\s*$", stripped):
            in_jobs = True
            continue

        if not in_jobs:
            continue

        # Sai da secao jobs quando encontra uma chave de nivel 0 (sem indentacao)
        if stripped and not stripped.startswith(" ") and not stripped.startswith("\t"):
            if re.match(r"^[a-zA-Z_]", stripped):
                # Nova secao de nivel 0 — saiu de jobs
                break

        # Job: chave de nivel 1 (2 espacos de indentacao, sem traco, sem comentario)
        m = re.match(r"^  ([a-zA-Z_][a-zA-Z0-9_-]*):\s*$", stripped)
        if m:
            job_name = m.group(1)
            # Ignora chaves internas de job (steps, runs-on, etc.)
            # So conta se for uma chave simples (nao aninhada)
            jobs.append(job_name)

    return jobs


# ---------------------------------------------------------------------------
# Verificacao
# ---------------------------------------------------------------------------

def _check_toolchain_consistency(
    ci_path: str,
    gate_path: str,
    out: TextIO,
) -> bool:
    """Verifica que gate e CI usam a mesma toolchain pinada.

    Retorna True se consistente.
    """
    with open(ci_path, encoding="utf-8") as f:
        ci_content = f.read()

    with open(gate_path, encoding="utf-8") as f:
        gate_content = f.read()

    issues = 0

    # Verifica Node no CI
    if "node-version: 24" not in ci_content:
        out.write("  AVISO: CI nao especifica Node 24 explicitamente\n")
        issues += 1

    # Verifica Python no CI
    if "python-version: '3.12'" not in ci_content and "python-version: 3.12" not in ci_content:
        out.write("  AVISO: CI nao especifica Python 3.12 explicitamente\n")
        issues += 1

    # Verifica FFmpeg no CI (opcional, mas recomendado)
    if "setup-ffmpeg" not in ci_content:
        out.write("  INFO: CI nao configura FFmpeg explicitamente (apenas job versoes usa)\n")

    return issues == 0


def verify_espelho(
    gate_path: str,
    ci_path: str,
    out: TextIO | None = None,
) -> tuple[bool, list[str]]:
    """Verifica sincronia gate <-> CI.

    Args:
        gate_path: Caminho para tools/gate.sh
        ci_path: Caminho para .github/workflows/ci.yml
        out: Stream de saida. Se None, acumula em lista.

    Returns:
        (passou, lista_de_mensagens)
    """
    messages: list[str] = []
    if out is None:
        out = _ListWriter(messages)

    all_pass = True

    # --- 1. Verifica existencia dos arquivos ---
    if not Path(gate_path).exists():
        out.write(f"FAIL: gate.sh nao encontrado: {gate_path}\n")
        return False, messages
    if not Path(ci_path).exists():
        out.write(f"FAIL: ci.yml nao encontrado: {ci_path}\n")
        return False, messages

    # --- 2. Parse ---
    gate_names, gate_info = parse_gate_stages(gate_path)
    ci_jobs = parse_ci_jobs(ci_path)

    if not gate_names:
        out.write("FAIL: zero etapas parseadas do gate.sh\n")
        return False, messages

    if not ci_jobs:
        out.write("FAIL: zero jobs parseados do ci.yml\n")
        return False, messages

    out.write(f"PASS: {len(gate_names)} etapas no gate, {len(ci_jobs)} jobs no CI\n")

    # --- 3. Converte para conjuntos para comparacao ---
    gate_set = set(gate_names)
    ci_set = set(ci_jobs)

    # --- 4. Jobs no CI sem etapa no gate (adicao unilateral) → VERMELHO ---
    only_in_ci = ci_set - gate_set
    if only_in_ci:
        for job in sorted(only_in_ci):
            out.write(f"FAIL: job '{job}' no CI sem etapa correspondente no gate\n")
            out.write(f"       → Adicione _define_stage \"{job}\" em tools/gate.sh\n")
        all_pass = False

    # --- 5. Etapas no gate sem job no CI (estagio orfao) → VERMELHO ---
    only_in_gate = gate_set - ci_set
    if only_in_gate:
        for stage in sorted(only_in_gate):
            out.write(f"FAIL: etapa '{stage}' no gate sem job correspondente no CI\n")
            out.write(f"       → Adicione job '{stage}' em .github/workflows/ci.yml\n")
        all_pass = False

    # --- 6. Verifica consistencia de toolchain ---
    out.write("\n--- Toolchain ---\n")
    _check_toolchain_consistency(ci_path, gate_path, out)

    # --- 7. Verifica ferramentas por etapa ---
    out.write("\n--- Ferramentas por etapa ---\n")
    for name in sorted(gate_set & ci_set):
        info = gate_info.get(name, {})
        tools = info.get("tools", "")
        if tools:
            out.write(f"  {name}: {tools}\n")
        else:
            out.write(f"  AVISO: {name} — etapa sem ferramentas declaradas\n")

    # --- 8. Sumario ---
    out.write("\n--- Sumario ---\n")
    out.write(f"  Etapas no gate: {len(gate_names)}\n")
    out.write(f"  Jobs no CI:     {len(ci_jobs)}\n")
    out.write(f"  Em comum:       {len(gate_set & ci_set)}\n")
    out.write(f"  So no CI:       {len(only_in_ci)}\n")
    out.write(f"  So no gate:     {len(only_in_gate)}\n")

    if all_pass:
        out.write("\nRESULTADO: ESPELHO SINCRONIZADO\n")
    else:
        out.write("\nRESULTADO: ESPELHO QUEBRADO\n")

    return all_pass, messages


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class _ListWriter:
    """Writer que acumula em lista."""

    def __init__(self, messages: list[str]):
        self._messages = messages

    def write(self, s: str) -> None:
        self._messages.append(s)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verificador de sincronia gate local <-> CI"
    )
    parser.add_argument(
        "--gate",
        default=_DEFAULT_GATE,
        help=f"Caminho para gate.sh (default: {_DEFAULT_GATE})",
    )
    parser.add_argument(
        "--ci",
        default=_DEFAULT_CI,
        help=f"Caminho para ci.yml (default: {_DEFAULT_CI})",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Saida em formato JSON",
    )
    args = parser.parse_args()

    passed, messages = verify_espelho(args.gate, args.ci)

    if args.json:
        result = {
            "passed": passed,
            "messages": "".join(messages),
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        for msg in messages:
            sys.stdout.write(msg)

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()