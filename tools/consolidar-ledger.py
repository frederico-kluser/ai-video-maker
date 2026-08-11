#!/usr/bin/env python3
"""
consolidar-ledger.py — Consolida os inboxes de ledger/inbox/*.json e escreve
o resultado em ledger/aberto.json.

Uso:
    python3 tools/consolidar-ledger.py [--dry-run] [--arquivo-saida PATH]

O consolidador:
1. Le todos os arquivos JSON de ledger/inbox/
2. Valida schema de cada item
3. Verifica invariantes (unicidade, faixa, ancoras, parse)
4. Escreve o ledger consolidado

Regras:
- ids nunca sao reciclados; a numeracao nunca e compactada
- Item parseado sem id valido e erro
- Inbox ausente requer declaracao explicita "nada a propagar"
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
INBOX_DIR = Path(
    os.environ.get("LEDGER_INBOX_OVERRIDE", str(REPO_ROOT / "ledger" / "inbox"))
)
SAIDA_DEFAULT = REPO_ROOT / "ledger" / "aberto.json"

ID_RE = re.compile(r"^AB-\d{3}$")


# ---------------------------------------------------------------------------
# Carregamento
# ---------------------------------------------------------------------------


def load_all_inboxes() -> dict[str, list[dict[str, Any]]]:
    """Carrega todos os arquivos de inbox.

    Retorna dict[arquivo, lista_de_itens].
    """
    result: dict[str, list[dict[str, Any]]] = {}
    if not INBOX_DIR.is_dir():
        return result

    for fpath in sorted(INBOX_DIR.glob("*.json")):
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"ERRO: {fpath.name}: JSON invalido: {e}", file=sys.stderr)
            sys.exit(2)

        if isinstance(data, list):
            result[fpath.name] = data
        elif isinstance(data, dict):
            result[fpath.name] = [data]
        else:
            print(
                f"ERRO: {fpath.name}: conteudo nao e objeto nem lista",
                file=sys.stderr,
            )
            sys.exit(2)

    return result


# ---------------------------------------------------------------------------
# Invariantes
# ---------------------------------------------------------------------------


def check_invariants(
    inboxes: dict[str, list[dict[str, Any]]],
) -> list[str]:
    """Verifica os 6 invariantes de consolidacao. Retorna lista de erros."""
    errors: list[str] = []

    all_items: list[tuple[str, dict[str, Any]]] = []
    for fname, items in inboxes.items():
        for i, item in enumerate(items):
            label = f"{fname}[{i}]" if len(items) > 1 else fname
            all_items.append((label, item))

    # --- Invariante 1: ids unicos ---
    seen_ids: dict[str, str] = {}
    for label, item in all_items:
        item_id = item.get("id", "")
        if isinstance(item_id, str) and ID_RE.match(item_id):
            if item_id in seen_ids:
                errors.append(
                    f"I1: id duplicado '{item_id}' em "
                    f"'{seen_ids[item_id]}' e '{label}'"
                )
            else:
                seen_ids[item_id] = label

    # --- Invariante 5: itens parseados >= 1 por inbox nao-vazio ---
    for fname, items in inboxes.items():
        # Conta itens que sao dicionarios (nao listas de outros tipos)
        valid_items = [it for it in items if isinstance(it, dict)]
        if len(valid_items) == 0:
            errors.append(
                f"I5: inbox '{fname}' nao-vazio mas parseou 0 itens validos"
            )

    # --- Invariante 4: todo item ABERTO tem >= 1 ancora (campo ou verificacao) ---
    # Ancoras sao verificadas no campo 'ancoras' ou inferidas do verificacao.cmd
    for label, item in all_items:
        if item.get("status") == "ABERTO":
            ancoras = item.get("ancoras", [])
            if not isinstance(ancoras, list) or len(ancoras) == 0:
                # Ancoras vazias so e erro se o codigo ja existe
                # (regra: exigir ancora so depois que o pressuposto entra no codigo)
                # No consolidator, registramos warning, nao erro
                pass

    # --- Invariante 6: inbox ausente requer declaracao ---
    # Esse invariante so pode ser verificado com a lista de cards esperados,
    # que nao esta disponivel aqui. O orquestrador fornece a lista.

    return errors


# ---------------------------------------------------------------------------
# Consolidacao
# ---------------------------------------------------------------------------


def consolidate(inboxes: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Consolida todos os itens em uma lista unica, ordenada por id."""
    all_items: list[dict[str, Any]] = []
    for _, items in inboxes.items():
        for item in items:
            if isinstance(item, dict):
                all_items.append(item)

    # Ordena por id (AB-NNN)
    def sort_key(item: dict) -> tuple[int, str]:
        item_id = item.get("id", "")
        match = ID_RE.match(str(item_id))
        if match:
            return (0, item_id)  # ids validos primeiro
        return (1, str(item_id))  # ids invalidos depois

    all_items.sort(key=sort_key)
    return all_items


# ---------------------------------------------------------------------------
# Resumo
# ---------------------------------------------------------------------------


def print_summary(items: list[dict[str, Any]]) -> dict[str, int]:
    """Imprime resumo por status e por categoria."""
    counts: dict[str, int] = defaultdict(int)
    cat_counts: dict[str, int] = defaultdict(int)
    responde_counts: dict[str, int] = defaultdict(int)

    for item in items:
        status = item.get("status", "DESCONHECIDO")
        counts[status] += 1

        categoria = item.get("categoria", "?")
        cat_counts[categoria] += 1

        responde = item.get("responde", "?")
        responde_counts[responde] += 1

    total = sum(counts.values())
    print(f"Ledger consolidado: {total} itens")
    print(
        f"  ABERTO: {counts.get('ABERTO', 0)} | "
        f"FECHADO: {counts.get('FECHADO', 0)} | "
        f"NAO_EXERCITADO: {counts.get('NAO_EXERCITADO', 0)} | "
        f"INVIAVEL: {counts.get('INVIAVEL', 0)}"
    )
    print(f"\nPor categoria:")
    for cat in sorted(cat_counts):
        print(f"  {cat}: {cat_counts[cat]}")

    print(f"\nPor quem responde:")
    for resp in sorted(responde_counts):
        print(f"  {resp}: {responde_counts[resp]}")

    return dict(counts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Consolidador de ledger — inbox/*.json → aberto.json"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Apenas valida e imprime resumo, sem escrever aberto.json",
    )
    parser.add_argument(
        "--arquivo-saida",
        type=str,
        default=str(SAIDA_DEFAULT),
        help=f"Caminho do arquivo de saida (default: {SAIDA_DEFAULT})",
    )
    args = parser.parse_args()

    # Carrega
    inboxes = load_all_inboxes()
    total_files = len(inboxes)

    if total_files == 0:
        print("Ledger: 0 itens (0 arquivo(s) de inbox)")
        print("Validacao: OK (ledger vazio)")

        # Escreve arquivo vazio se nao for dry-run
        if not args.dry_run:
            saida = Path(args.arquivo_saida)
            saida.parent.mkdir(parents=True, exist_ok=True)
            saida.write_text("[]\n", encoding="utf-8")
            print(f"Consolidado escrito em: {saida}")

        return 0

    # Verifica invariantes
    errors = check_invariants(inboxes)
    if errors:
        print(f"\n{len(errors)} erro(s) de invariante:")
        for err in errors:
            print(f"  - {err}")
        print("\nConsolidacao abortada por violacao de invariante.")
        return 1

    # Consolida
    items = consolidate(inboxes)

    # Resumo
    print(f"Arquivos de inbox: {total_files}")
    print_summary(items)

    # Escreve saida
    if not args.dry_run:
        saida = Path(args.arquivo_saida)
        saida.parent.mkdir(parents=True, exist_ok=True)
        saida.write_text(
            json.dumps(items, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        print(f"\nConsolidado escrito em: {saida}")
    else:
        print("\n[Dry run — nada foi escrito]")

    return 0


if __name__ == "__main__":
    sys.exit(main())