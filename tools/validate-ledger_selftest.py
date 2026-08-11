#!/usr/bin/env python3
"""
validate-ledger_selftest.py — 9 mutacoes + fixtures sinteticas para o validador de ledger.

As mutacoes sao calculadas contra o estado corrente, nunca literais.
Fixture de FECHADO valido e invalido entra na suite desde o dia 1.

Uso:
    python3 tools/validate-ledger_selftest.py
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# ---------------------------------------------------------------------------
# Fixtures sinteticas
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
VALIDATOR = REPO_ROOT / "tools" / "validate-ledger.py"

# Item ABERTO valido
ITEM_ABERTO_VALIDO = {
    "id": "AB-001",
    "titulo": "Fixture sintetica — item aberto valido",
    "pergunta": "Este teste passa no validador?",
    "por_que_aberto": "Fixture sintetica para autoteste do validador de ledger",
    "decisao_provisoria": "Assumir que o validador funciona corretamente",
    "verificacao": {
        "cmd": "python3 -c 'print(\"ok\")'",
        "espera": "ok",
        "ambiente": "local",
    },
    "impacto_se_divergir": {
        "resumo": "O autoteste do validador quebraria",
        "artefatos": ["tools/validate-ledger.py"],
        "cards": ["F0-03"],
    },
    "risco": "baixo",
    "categoria": "agentes-worktrees",
    "responde": "infra",
    "antecedencia": "card",
    "status": "ABERTO",
    "evidencia": None,
    "data_resolucao": None,
    "adr": None,
}

# Item FECHADO valido (com evidencia estruturada)
ITEM_FECHADO_VALIDO = {
    "id": "AB-002",
    "titulo": "Fixture sintetica — item fechado valido",
    "pergunta": "Este teste fecha corretamente?",
    "por_que_aberto": "Fixture sintetica para autoteste do validador de ledger",
    "decisao_provisoria": "Assumir que o fechamento funciona",
    "verificacao": {
        "cmd": "echo 'hello world'",
        "espera": "hello world",
        "ambiente": "local",
    },
    "impacto_se_divergir": {
        "resumo": "O autoteste quebraria",
        "artefatos": ["tools/validate-ledger.py"],
        "cards": ["F0-03"],
    },
    "risco": "baixo",
    "categoria": "agentes-worktrees",
    "responde": "infra",
    "antecedencia": "card",
    "status": "FECHADO",
    "evidencia": {
        "cmd": "echo 'hello world'",
        "exit": "0",
        "arquivo": "ledger/evidencia/AB-002.txt",
        "sha256": "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447",
    },
    "data_resolucao": "2026-08-11",
    "adr": None,
}


def run_validator(inbox_dir: str, *extra_args: str) -> subprocess.CompletedProcess:
    """Executa o validador com um diretorio de inbox especifico."""
    env = os.environ.copy()
    # Sobrescreve o caminho do inbox sem modificar o validador
    # Usamos monkey-patch via env var
    return subprocess.run(
        [sys.executable, str(VALIDATOR), *extra_args],
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT),
        env={**env, "LEDGER_INBOX_OVERRIDE": inbox_dir},
    )


def write_items(inbox_dir: str, items: list[dict]) -> str:
    """Escreve itens em um arquivo de inbox. Retorna o caminho."""
    fpath = os.path.join(inbox_dir, "test-fixture.json")
    with open(fpath, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
    return fpath


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------

PASS = 0
FAIL = 0


def test(name: str, items: list[dict], expected_errors: list[str],
         expect_pass: bool = False, extra_args: tuple = ()) -> None:
    """Executa um teste do validador.

    Args:
        name: Nome do teste.
        items: Lista de itens para escrever no inbox.
        expected_errors: Substrings esperadas na saida de erro.
        expect_pass: Se True, espera-se que o validador passe (exit 0).
        extra_args: Argumentos extras para o validador.
    """
    global PASS, FAIL
    with tempfile.TemporaryDirectory() as tmpdir:
        inbox_dir = os.path.join(tmpdir, "inbox")
        os.makedirs(inbox_dir, exist_ok=True)

        if items:
            write_items(inbox_dir, items)

        result = run_validator(inbox_dir, *extra_args)

        if expect_pass:
            if result.returncode == 0:
                print(f"  PASS: {name}")
                PASS += 1
            else:
                print(f"  FAIL: {name}")
                print(f"        Esperado exit 0, obteve {result.returncode}")
                print(f"        stderr: {result.stderr.strip()}")
                print(f"        stdout: {result.stdout.strip()}")
                FAIL += 1
        else:
            if result.returncode != 0:
                combined = result.stdout + result.stderr
                missing = [
                    e for e in expected_errors
                    if e.lower() not in combined.lower()
                ]
                if not missing:
                    print(f"  PASS: {name}")
                    PASS += 1
                else:
                    print(f"  FAIL: {name}")
                    print(f"        Substrings nao encontradas: {missing}")
                    print(f"        stdout: {result.stdout.strip()}")
                    print(f"        stderr: {result.stderr.strip()}")
                    FAIL += 1
            else:
                print(f"  FAIL: {name}")
                print(f"        Esperado exit != 0, obteve 0")
                print(f"        stdout: {result.stdout.strip()}")
                FAIL += 1


# ---------------------------------------------------------------------------
# Suite
# ---------------------------------------------------------------------------


def main() -> int:
    print("=== validate-ledger_selftest.py ===\n")

    # Test 0: Ledger vazio sai 0 (aceitacao do card F0-03)
    test(
        "ledger vazio sai 0",
        [],
        [],
        expect_pass=True,
    )

    # Test 1: Item ABERTO valido passa
    test(
        "item ABERTO valido passa",
        [ITEM_ABERTO_VALIDO],
        [],
        expect_pass=True,
    )

    # Test 2: Item FECHADO valido passa
    test(
        "item FECHADO valido passa",
        [ITEM_FECHADO_VALIDO],
        [],
        expect_pass=True,
    )

    # --- Mutacao 1: id duplicado ---
    duplicado_1 = dict(ITEM_ABERTO_VALIDO)
    duplicado_2 = dict(ITEM_ABERTO_VALIDO)
    duplicado_2["titulo"] = "Copia com mesmo id"
    test(
        "M1: id duplicado",
        [duplicado_1, duplicado_2],
        ["duplicado", "AB-001"],
    )

    # --- Mutacao 2: id com formato invalido ---
    id_invalido = dict(ITEM_ABERTO_VALIDO)
    id_invalido["id"] = "AB-99"  # 2 digitos, deveria ser 3
    test(
        "M2: id com formato invalido",
        [id_invalido],
        ["id invalido", "AB-99"],
    )

    # --- Mutacao 3: status invalido ---
    status_invalido = dict(ITEM_ABERTO_VALIDO)
    status_invalido["id"] = "AB-010"
    status_invalido["status"] = "PENDENTE"
    test(
        "M3: status invalido",
        [status_invalido],
        ["status", "PENDENTE", "invalido"],
    )

    # --- Mutacao 4: categoria invalida ---
    cat_invalida = dict(ITEM_ABERTO_VALIDO)
    cat_invalida["id"] = "AB-011"
    cat_invalida["categoria"] = "inesistente"
    test(
        "M4: categoria invalida",
        [cat_invalida],
        ["categoria", "inesistente", "invalida"],
    )

    # --- Mutacao 5: verificacao.cmd vazio ---
    cmd_vazio = dict(ITEM_ABERTO_VALIDO)
    cmd_vazio["id"] = "AB-012"
    cmd_vazio["verificacao"] = {"cmd": "", "espera": "x", "ambiente": "local"}
    test(
        "M5: verificacao.cmd vazio",
        [cmd_vazio],
        ["verificacao.cmd", "vazio"],
    )

    # --- Mutacao 6: impacto_se_divergir.artefatos vazio ---
    artefatos_vazio = dict(ITEM_ABERTO_VALIDO)
    artefatos_vazio["id"] = "AB-013"
    artefatos_vazio["impacto_se_divergir"] = {
        "resumo": "impacto",
        "artefatos": [],
        "cards": [],
    }
    test(
        "M6: impacto_se_divergir.artefatos vazio",
        [artefatos_vazio],
        ["artefatos", "vazio"],
    )

    # --- Mutacao 7: FECHADO com evidencia na lista negra ("ok") ---
    ev_blacklist = dict(ITEM_ABERTO_VALIDO)
    ev_blacklist["id"] = "AB-014"
    ev_blacklist["status"] = "FECHADO"
    ev_blacklist["evidencia"] = "ok"
    ev_blacklist["data_resolucao"] = "2026-08-11"
    test(
        "M7: FECHADO com evidencia 'ok' (lista negra)",
        [ev_blacklist],
        ["termo proibido", "ok"],
    )

    # --- Mutacao 8: FECHADO com evidencia < 12 chars ---
    ev_curta = dict(ITEM_ABERTO_VALIDO)
    ev_curta["id"] = "AB-015"
    ev_curta["status"] = "FECHADO"
    ev_curta["evidencia"] = "curta"
    ev_curta["data_resolucao"] = "2026-08-11"
    test(
        "M8: FECHADO com evidencia < 12 chars",
        [ev_curta],
        ["minimo", "12"],
    )

    # --- Mutacao 9: FECHADO sem data_resolucao ---
    sem_data = dict(ITEM_ABERTO_VALIDO)
    sem_data["id"] = "AB-016"
    sem_data["status"] = "FECHADO"
    sem_data["evidencia"] = {
        "cmd": "echo 'hello world'",
        "exit": "0",
        "arquivo": "ledger/evidencia/AB-016.txt",
        "sha256": "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447",
    }
    sem_data["data_resolucao"] = None
    test(
        "M9: FECHADO sem data_resolucao",
        [sem_data],
        ["data_resolucao"],
    )

    # --- Resumo ---
    total = PASS + FAIL
    print(f"\n=== Resultado: {PASS}/{total} passaram ===")
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())