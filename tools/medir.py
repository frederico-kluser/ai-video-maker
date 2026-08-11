#!/usr/bin/env python3
# =============================================================================
# medir.py — Instrumentacao de custo e tempo por onda
# =============================================================================
# Registra medicoes de cada onda: tempo de execucao, chamadas de API,
# tokens consumidos, arquivos modificados.
#
# Uma onda sem registro de medicao deixa o gate AMARELO (NAO-EXERCITADO),
# nunca verde.
#
# "Chamadas de API" tem denominador: zero chamadas e verdade quando o
# cache esta perfeito (executado=true) E quando ninguem rodou nada
# (executado=false). O campo "executado" distingue os dois casos.
#
# Uso:
#   python3 tools/medir.py registrar --onda W1 --duracao-ms 45000 ...
#   python3 tools/medir.py verificar --onda W1
#   python3 tools/medir.py ler --onda W1
#   python3 tools/medir.py validar docs/medicao/W1.json
#   python3 tools/medir.py listar
#
# Codigos de saida do subcomando "verificar" (para integracao com gate.sh):
#   0 = PASS           (registro existe e e valido)
#   1 = FAIL           (registro existe mas e invalido)
#   2 = NAO-EXERCITADO (nenhum registro existe para esta onda)
#
# O gate.sh atual trata exit != 0 como FAIL. Para que o gate.sh distinga
# NAO-EXERCITADO (exit 2) de FAIL (exit 1), o gate.sh precisa ser
# estendido com suporte a exit code 2. Enquanto isso, a saida stdout
# contem o marcador textual ([PASS], [FAIL], [NAO-EXERCITADO]) que
# permite verificacao manual e parse futuro.
# =============================================================================

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
MEDICAO_DIR = REPO_ROOT / "docs" / "medicao"

# ---------------------------------------------------------------------------
# Schema de validacao
# ---------------------------------------------------------------------------
# Cada tupla: (campo, tipo_esperado, obrigatorio)
# Tipo pode ser um tipo unico ou uma tupla de tipos alternativos.

RECORD_SCHEMA: List[Tuple[str, Union[type, Tuple[type, ...]], bool]] = [
    ("onda", str, True),
    ("executado", bool, True),
    ("timestamp", str, True),
    ("duracao_ms", (int, float), True),
    ("api", dict, True),
    ("arquivos", dict, True),
]

API_SCHEMA: List[Tuple[str, Union[type, Tuple[type, ...]], bool]] = [
    ("chamadas", int, True),
    ("tokens_entrada", int, True),
    ("tokens_saida", int, True),
    ("modelo", str, True),
]

ARQUIVOS_SCHEMA: List[Tuple[str, Union[type, Tuple[type, ...]], bool]] = [
    ("modificados", int, True),
    ("criados", int, True),
    ("lista", list, True),
]


def _check_type(value: Any, expected: Union[type, Tuple[type, ...]]) -> bool:
    """Check if value matches the expected type (or tuple of types)."""
    return isinstance(value, expected)


def _validate_schema(
    data: dict,
    schema: List[Tuple[str, Union[type, Tuple[type, ...]], bool]],
    prefix: str = "",
) -> List[str]:
    """Validate a dict against a schema. Returns list of error messages."""
    errors: List[str] = []
    label = f"'{prefix}'" if prefix else "raiz"

    for field, expected_type, required in schema:
        full_path = f"{prefix}.{field}" if prefix else field

        if field not in data:
            if required:
                errors.append(
                    f"Campo obrigatorio ausente em {label}: '{field}'"
                )
            continue

        value = data[field]
        if not _check_type(value, expected_type):
            type_names = (
                [expected_type.__name__]
                if isinstance(expected_type, type)
                else [t.__name__ for t in expected_type]
            )
            errors.append(
                f"Tipo invalido para '{full_path}': "
                f"esperado {' | '.join(type_names)}, "
                f"recebido {type(value).__name__}"
            )

    return errors


def _validate_timestamp(ts: str) -> Optional[str]:
    """Validate ISO 8601 timestamp. Returns error message or None."""
    try:
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return None
    except (ValueError, AttributeError):
        return f"Formato invalido de timestamp: '{ts}' (esperado ISO 8601)"


def _validate_onda_format(onda: str) -> Optional[str]:
    """Validate onda identifier format. Returns error message or None."""
    if not onda or not onda.startswith("W"):
        return f"Formato invalido de onda: '{onda}' (esperado Wn, ex: W1, W2)"
    sufixo = onda[1:]
    if not sufixo or not sufixo[0].isdigit():
        return f"Formato invalido de onda: '{onda}' (esperado Wn, ex: W1, W2)"
    return None


def validate_record(data: dict) -> List[str]:
    """Validate a complete measurement record against the schema.

    Returns a list of error messages. Empty list means valid.
    """
    errors: List[str] = []

    # Top-level schema
    errors.extend(_validate_schema(data, RECORD_SCHEMA))

    # Sub-object: api
    if isinstance(data.get("api"), dict):
        errors.extend(_validate_schema(data["api"], API_SCHEMA, prefix="api"))

    # Sub-object: arquivos
    if isinstance(data.get("arquivos"), dict):
        errors.extend(
            _validate_schema(data["arquivos"], ARQUIVOS_SCHEMA, prefix="arquivos")
        )

    # Semantic validations (only if fields exist and have correct types)
    if isinstance(data.get("timestamp"), str):
        ts_err = _validate_timestamp(data["timestamp"])
        if ts_err:
            errors.append(ts_err)

    if isinstance(data.get("onda"), str):
        onda_err = _validate_onda_format(data["onda"])
        if onda_err:
            errors.append(onda_err)

    # Cross-field validation: if executado=false, api calls must be zero
    if isinstance(data.get("executado"), bool) and not data["executado"]:
        api = data.get("api", {})
        if isinstance(api, dict):
            chamadas = api.get("chamadas", 0)
            if isinstance(chamadas, int) and chamadas > 0:
                errors.append(
                    f"Inconsistencia: executado=false mas api.chamadas={chamadas} "
                    f"(esperado 0 quando nao executado)"
                )

    # Note: chamadas=0 with executado=true is VALID (cache was perfect).
    # chamadas=0 with executado=false is also VALID (nobody ran anything).
    # The "executado" field disambiguates the two cases.

    return errors


# ---------------------------------------------------------------------------
# File operations
# ---------------------------------------------------------------------------

def record_path(onda: str) -> Path:
    """Path to the measurement record file for a wave."""
    return MEDICAO_DIR / f"{onda}.json"


def record_exists(onda: str) -> bool:
    """Check if a measurement record exists for the wave."""
    return record_path(onda).exists()


def read_record(onda: str) -> Optional[dict]:
    """Read a measurement record. Returns None if it doesn't exist or is corrupt."""
    path = record_path(onda)
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        print(f"Erro ao ler {path}: {e}", file=sys.stderr)
        return None


def write_record(onda: str, data: dict) -> None:
    """Write a measurement record for a wave."""
    MEDICAO_DIR.mkdir(parents=True, exist_ok=True)
    path = record_path(onda)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def list_records() -> List[str]:
    """List all waves that have measurement records."""
    if not MEDICAO_DIR.exists():
        return []
    records = []
    for entry in sorted(MEDICAO_DIR.iterdir()):
        if entry.suffix == ".json" and entry.stem.startswith("W"):
            records.append(entry.stem)
    return records


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

def cmd_registrar(args: argparse.Namespace) -> int:
    """Register a new measurement for a wave.

    Returns 0 on success, 1 on validation error.
    """
    onda = args.onda

    timestamp = args.timestamp or datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    data: Dict[str, Any] = {
        "onda": onda,
        "executado": args.executado,
        "timestamp": timestamp,
        "duracao_ms": args.duracao_ms,
        "api": {
            "chamadas": args.api_chamadas,
            "tokens_entrada": args.tokens_entrada,
            "tokens_saida": args.tokens_saida,
            "modelo": args.modelo,
        },
        "arquivos": {
            "modificados": args.arquivos_modificados,
            "criados": args.arquivos_criados,
            "lista": args.arquivos_lista or [],
        },
    }

    # Validate before writing
    errors = validate_record(data)
    if errors:
        print(f"ERRO: Registro invalido para onda '{onda}':", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    write_record(onda, data)
    print(f"Medicao registrada para onda '{onda}': {record_path(onda)}")
    print(f"  timestamp:  {timestamp}")
    print(f"  executado:  {args.executado}")
    print(f"  duracao:    {args.duracao_ms}ms")
    print(
        f"  API:        {args.api_chamadas} chamadas, "
        f"{args.tokens_entrada}+{args.tokens_saida} tokens "
        f"({args.modelo})"
    )
    print(
        f"  Arquivos:   {args.arquivos_modificados} modificados, "
        f"{args.arquivos_criados} criados"
    )
    return 0


def cmd_verificar(args: argparse.Namespace) -> int:
    """Verify if a measurement record exists for a wave.

    Exit codes:
      0 = PASS           (record exists and is valid)
      1 = FAIL           (record exists but is invalid)
      2 = NAO-EXERCITADO (no record exists for this wave)

    stdout output follows gate.sh format for parsing:
      [PASS] medicao — ...
      [FAIL] medicao — ...
      [NAO-EXERCITADO] medicao — ...
    """
    onda = args.onda

    if not record_exists(onda):
        print(
            f"[NAO-EXERCITADO] medicao — "
            f"onda '{onda}' sem registro de medicao"
        )
        return 2

    data = read_record(onda)
    if data is None:
        print(
            f"[FAIL] medicao — "
            f"onda '{onda}': arquivo de registro corrompido ou ilegivel"
        )
        return 1

    errors = validate_record(data)
    if errors:
        print(f"[FAIL] medicao — registro invalido para onda '{onda}':")
        for err in errors:
            print(f"  - {err}")
        return 1

    api = data["api"]
    arq = data["arquivos"]
    print(
        f"[PASS] medicao — onda '{onda}' registrada: "
        f"ts={data['timestamp']}, "
        f"executado={data['executado']}, "
        f"duracao={data['duracao_ms']}ms, "
        f"API={api['chamadas']} chamadas "
        f"({api['tokens_entrada']}+{api['tokens_saida']} tokens, "
        f"{api['modelo']}), "
        f"arquivos={arq['modificados']}M/{arq['criados']}C"
    )
    return 0


def cmd_ler(args: argparse.Namespace) -> int:
    """Read and display a measurement record (formatted JSON).

    Returns 0 on success, 1 if record doesn't exist.
    """
    onda = args.onda

    data = read_record(onda)
    if data is None:
        print(f"Nenhum registro encontrado para onda '{onda}'", file=sys.stderr)
        return 1

    print(json.dumps(data, indent=2, ensure_ascii=False))
    return 0


def cmd_validar(args: argparse.Namespace) -> int:
    """Validate a measurement record JSON file.

    Returns 0 if valid, 1 if invalid or file not found.
    """
    path = Path(args.arquivo)

    if not path.exists():
        print(f"Arquivo nao encontrado: {path}", file=sys.stderr)
        return 1

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"JSON invalido em {path}: {e}", file=sys.stderr)
        return 1
    except OSError as e:
        print(f"Erro ao ler {path}: {e}", file=sys.stderr)
        return 1

    errors = validate_record(data)
    if errors:
        print(f"Registro invalido ({len(errors)} erro(s)):")
        for err in errors:
            print(f"  - {err}")
        return 1

    onda = data.get("onda", "?")
    print(f"Registro valido: onda '{onda}'")
    return 0


def cmd_listar(args: argparse.Namespace) -> int:
    """List all waves with measurement records.

    Returns 0 always (empty list is not an error).
    """
    records = list_records()
    if not records:
        print("Nenhum registro de medicao encontrado.")
    else:
        print(f"Ondas com registro de medicao ({len(records)}):")
        for onda in records:
            data = read_record(onda)
            if data:
                status = "executado" if data.get("executado") else "nao-executado"
                print(
                    f"  {onda}: ts={data.get('timestamp', '?')}, "
                    f"{data.get('duracao_ms', '?')}ms, "
                    f"{status}"
                )
            else:
                print(f"  {onda}: (erro de leitura)")
    return 0


# ---------------------------------------------------------------------------
# Main CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser with subcommands."""

    parser = argparse.ArgumentParser(
        description="Instrumentacao de custo e tempo por onda",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  # Registrar uma medicao
  python3 tools/medir.py registrar --onda W1 --duracao-ms 45000 \\
      --api-chamadas 12 --tokens-entrada 50000 --tokens-saida 8000 \\
      --modelo claude-sonnet-4-20250514 \\
      --arquivos-modificados 3 --arquivos-criados 1

  # Verificar se uma onda tem registro (para gate.sh)
  python3 tools/medir.py verificar --onda W1

  # Ler um registro
  python3 tools/medir.py ler --onda W1

  # Validar um arquivo de registro
  python3 tools/medir.py validar docs/medicao/W1.json

  # Listar todas as ondas com registro
  python3 tools/medir.py listar
        """,
    )

    subparsers = parser.add_subparsers(
        dest="comando",
        help="Comando a executar",
    )

    # --- registrar ---
    reg = subparsers.add_parser(
        "registrar",
        help="Registrar medicao para uma onda",
    )
    reg.add_argument(
        "--onda",
        required=True,
        help="Identificador da onda (ex: W1, W2, W3a)",
    )
    reg.add_argument(
        "--executado",
        action="store_true",
        default=True,
        help="Marca a onda como executada (default: True)",
    )
    reg.add_argument(
        "--nao-executado",
        dest="executado",
        action="store_false",
        help="Marca a onda como NAO executada "
        "(zero chamadas de API = ninguem rodou)",
    )
    reg.add_argument(
        "--timestamp",
        help="Timestamp ISO 8601 (default: agora em UTC)",
    )
    reg.add_argument(
        "--duracao-ms",
        type=int,
        required=True,
        help="Duracao total da onda em milissegundos",
    )
    reg.add_argument(
        "--api-chamadas",
        type=int,
        required=True,
        help="Numero de chamadas de API realizadas",
    )
    reg.add_argument(
        "--tokens-entrada",
        type=int,
        required=True,
        help="Total de tokens de entrada consumidos",
    )
    reg.add_argument(
        "--tokens-saida",
        type=int,
        required=True,
        help="Total de tokens de saida gerados",
    )
    reg.add_argument(
        "--modelo",
        default="claude-sonnet-4-20250514",
        help="Modelo de LLM utilizado (default: claude-sonnet-4-20250514)",
    )
    reg.add_argument(
        "--arquivos-modificados",
        type=int,
        required=True,
        help="Numero de arquivos modificados",
    )
    reg.add_argument(
        "--arquivos-criados",
        type=int,
        required=True,
        help="Numero de arquivos criados",
    )
    reg.add_argument(
        "--arquivos-lista",
        nargs="*",
        default=[],
        help="Lista de caminhos dos arquivos afetados",
    )

    # --- verificar ---
    ver = subparsers.add_parser(
        "verificar",
        help="Verificar se uma onda tem registro de medicao",
    )
    ver.add_argument(
        "--onda",
        required=True,
        help="Identificador da onda (ex: W1, W2)",
    )

    # --- ler ---
    ler = subparsers.add_parser(
        "ler",
        help="Ler o registro de medicao de uma onda",
    )
    ler.add_argument(
        "--onda",
        required=True,
        help="Identificador da onda (ex: W1, W2)",
    )

    # --- validar ---
    val = subparsers.add_parser(
        "validar",
        help="Validar um arquivo JSON de registro de medicao",
    )
    val.add_argument(
        "arquivo",
        help="Caminho para o arquivo JSON de registro",
    )

    # --- listar ---
    subparsers.add_parser(
        "listar",
        help="Listar todas as ondas com registro de medicao",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.comando == "registrar":
        return cmd_registrar(args)
    elif args.comando == "verificar":
        return cmd_verificar(args)
    elif args.comando == "ler":
        return cmd_ler(args)
    elif args.comando == "validar":
        return cmd_validar(args)
    elif args.comando == "listar":
        return cmd_listar(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
