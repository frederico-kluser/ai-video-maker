#!/usr/bin/env python3
"""Verificador de aceitacao — sonda negativa e tripwire.

Parseia cards.json, para cada card concluido exige que cada seletor case >=1
teste, implementa sonda negativa por alvo, e tripwire independente (conta
ocorrencias em texto normalizado diferente do parser).

Zero cards parseados = FALHA.

Uso: python3 tools/verify-acceptance.py [caminho/para/cards.json]
"""

import glob as _glob
import json
import re
import sys
from html import unescape as _html_unescape
from pathlib import Path
from typing import TextIO


# ---------------------------------------------------------------------------
# Constantes de normalizacao para tripwire
# ---------------------------------------------------------------------------

# Caracteres que o parser JSON ignora mas que afetam contagem em texto "cru"
_ZERO_WIDTH_RE = re.compile(
    r"[​‌‍‎‏⁠﻿­ -   ]"
)

# Marcadores de sonda negativa
_NEGATIVE_MARKER = "∅-crit"  # ∅-crit


# ---------------------------------------------------------------------------
# Parse
# ---------------------------------------------------------------------------

def load_cards(path: str) -> list[dict]:
    """Carrega cards.json e valida estrutura basica."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise ValueError("cards.json deve ser uma lista de objetos")
    return data


def _parse_parts(acceptance: str) -> list[str]:
    """Divide o campo acceptance em criterios individuais pelo separador '·'.

    Retorna lista de strings, cada uma representando um criterio.
    """
    if not acceptance or not acceptance.strip():
        return []
    parts = [p.strip() for p in acceptance.split("·")]  # middle dot
    return [p for p in parts if p]


def _is_negative_probe(part: str) -> bool:
    """Determina se um criterio eh uma sonda negativa (∅-crit)."""
    stripped = part.strip()
    return stripped.startswith(_NEGATIVE_MARKER) or stripped.startswith("∅-crit")


def _has_command(selector: str) -> bool:
    """Verifica se o seletor contem um comando reconhecivel."""
    command_patterns = [
        r"^(?:rg|grep)\s",
        r"^python3\s",
        r"^bash\s",
        r"^just\s",
        r"^git\s",
        r"^npx\s",
        r"^node\s",
        r"^npm\s",
        r"^test\s",
        r"^ffmpeg\s",
        r"^ffprobe\s",
    ]
    s = selector.strip()
    for pat in command_patterns:
        if re.match(pat, s):
            return True
    return False


def _clean_selector(part: str) -> str:
    """Remove marcadores e descricao, deixando so o seletor (comando/padrao).

    O seletor eh a parte antes de '→', '—' (em-dash), ou '--'.
    """
    s = part.strip()

    # Remove o marcador ∅-crit se estiver no inicio
    if s.startswith(_NEGATIVE_MARKER) or s.startswith("∅-crit"):
        s = s[len(_NEGATIVE_MARKER):].strip()

    # Separa no primeiro '→'
    if "→" in s:
        s = s.split("→")[0].strip()
    elif "->" in s:
        s = s.split("->")[0].strip()

    # Remove descricao apos em-dash ou travessao
    # So se o travessao estiver fora de aspas
    m = re.match(r'^(.*?)\s+[—–]\s+', s)
    if m:
        candidate = m.group(1).strip()
        if candidate.count('"') % 2 == 0 and candidate.count("'") % 2 == 0:
            s = candidate

    return s.strip()


def _extract_targets(selector: str) -> list[str]:
    """Extrai os alvos (arquivos/diretorios) de um seletor.

    Heuristica: para comandos conhecidos, extrai argumentos que parecem
    caminhos de arquivo ou padroes glob.

    Retorna lista de padroes glob ou caminhos.
    """
    s = selector.strip()

    # Remove redirecionamentos e pipes
    s = re.sub(r"\s*[|&>]\s*\S*", " ", s)

    # Caso 1: rg / grep
    rg_m = re.match(r"^(?:rg|grep)\s+(?:-[a-zA-Z0-9]+\s+)*", s)
    if rg_m:
        rest = s[rg_m.end():].strip()
        tokens = rest.split()
        # Remove flags
        path_tokens = [t for t in tokens if not t.startswith("-")]
        if len(path_tokens) >= 2:
            return [path_tokens[-1]]
        elif len(path_tokens) == 1:
            return [path_tokens[0]]
        return []

    # Caso 2: python3 script.py [args]
    py_m = re.match(r"^python3\s+(\S+\.py)", s)
    if py_m:
        return [py_m.group(1)]

    # Caso 3: bash script.sh
    bash_m = re.match(r"^bash\s+(\S+\.sh)", s)
    if bash_m:
        return [bash_m.group(1)]

    # Caso 4: just <target>
    just_m = re.match(r"^just\s+(\S+)", s)
    if just_m:
        return [just_m.group(1)]

    # Caso 5: git <cmd> <path>
    git_m = re.match(r"^git\s+\S+\s+(?:--\S+\s+)*(\S+)", s)
    if git_m:
        last = git_m.group(1)
        if not last.startswith("-"):
            return [last]
        return []

    # Fallback: extrair tokens que parecem caminhos
    targets = []
    for token in s.split():
        token = token.strip("\"'")
        if ("/" in token or token.endswith(".py") or token.endswith(".sh")
                or token.endswith(".md") or token.endswith(".json")
                or token.endswith(".ts") or token.endswith(".tsx")
                or "*" in token):
            targets.append(token)

    return targets


def _resolve_targets(targets: list[str]) -> list[str]:
    """Resolve padroes glob para arquivos reais existentes."""
    resolved: list[str] = []
    for t in targets:
        t = t.strip("'\"")
        try:
            matches = _glob.glob(t, recursive=True)
            if matches:
                resolved.extend(matches)
            else:
                if Path(t).exists():
                    resolved.append(t)
        except Exception:
            pass
    return resolved


def _count_selector_matches(selector: str) -> int:
    """Conta quantos alvos um seletor casa.

    Retorna o numero de arquivos/recursos que o seletor encontraria.
    Se o seletor nao tem comando reconhecivel, retorna -1 (nao verificavel).
    """
    if not _has_command(selector):
        return -1  # Nao verificavel

    targets = _extract_targets(selector)
    if not targets:
        return 0  # Comando reconhecido mas sem alvo extraivel

    resolved = _resolve_targets(targets)
    return len(resolved)


# ---------------------------------------------------------------------------
# Tripwire
# ---------------------------------------------------------------------------

def _normalize_for_tripwire(text: str) -> str:
    """Normaliza texto para contagem de tripwire.

    Diferente do parser JSON: remove entidades HTML, caracteres de largura
    zero, hifens suaves, e normaliza whitespace.
    """
    # Decodifica entidades HTML
    text = _html_unescape(text)

    # Remove caracteres de largura zero e hifens suaves
    text = _ZERO_WIDTH_RE.sub("", text)

    # Normaliza whitespace (mantem newlines)
    text = re.sub(r"[ \t]+", " ", text)

    return text


def _tripwire_card_count(text: str) -> int:
    """Conta cards no texto normalizado via tripwire.

    Conta ocorrencias do padrao '"id":' no texto normalizado.
    """
    normalized = _normalize_for_tripwire(text)
    matches = re.findall(r'"id"\s*:\s*"([^"]+)"', normalized)
    return len(matches)


# ---------------------------------------------------------------------------
# Verificacao principal
# ---------------------------------------------------------------------------

def verify_acceptance(
    cards_path: str,
    raw_text: str | None = None,
    out: TextIO | None = None,
) -> tuple[bool, list[str]]:
    """Executa verificacao de aceitacao.

    Args:
        cards_path: Caminho para cards.json
        raw_text: Texto bruto do arquivo (para tripwire). Se None, le do disco.
        out: Stream de saida. Se None, acumula em lista.

    Returns:
        (passou, lista_de_mensagens)
    """
    messages: list[str] = []
    if out is None:
        out = _ListWriter(messages)

    # --- 1. Carrega cards ---
    try:
        cards = load_cards(cards_path)
    except json.JSONDecodeError as e:
        out.write(f"FAIL: JSON invalido em {cards_path}: {e}\n")
        return False, messages
    except FileNotFoundError:
        out.write(f"FAIL: arquivo nao encontrado: {cards_path}\n")
        return False, messages
    except ValueError as e:
        out.write(f"FAIL: {e}\n")
        return False, messages

    # --- 2. Zero cards = FALHA ---
    if len(cards) == 0:
        out.write("FAIL: zero cards parseados — o formato mudou e este verificador ficou cego\n")
        return False, messages

    out.write(f"PASS: {len(cards)} cards parseados\n")

    # --- 3. Tripwire independente ---
    if raw_text is None:
        try:
            with open(cards_path, encoding="utf-8") as f:
                raw_text = f.read()
        except Exception:
            raw_text = None

    if raw_text is not None:
        tripwire = _tripwire_card_count(raw_text)
        if tripwire != len(cards):
            out.write(
                f"FAIL: tripwire — parser contou {len(cards)} cards, "
                f"mas tripwire contou {tripwire} ocorrencias de '\"id\"'\n"
            )
            return False, messages
        out.write(f"PASS: tripwire bate ({tripwire} cards)\n")
    else:
        out.write("INFO: tripwire nao exercitado (texto bruto indisponivel)\n")

    # --- 4. Agrupa cards por status ---
    completed = [c for c in cards if c.get("status") == "concluido"]
    pending = [c for c in cards if c.get("status") != "concluido"]

    out.write(f"INFO: {len(completed)} concluidos, {len(pending)} pendentes\n")

    # --- 5. Para cada card concluido, verifica seletores ---
    all_pass = True
    selector_ok = 0
    selector_fail = 0
    selector_uncheckable = 0
    negative_ok = 0
    negative_fail = 0
    negative_uncheckable = 0

    for card in cards:
        cid = card["id"]
        acceptance = card.get("acceptance", "")
        parts = _parse_parts(acceptance)

        if not parts:
            if card.get("status") == "concluido":
                out.write(f"  FAIL: {cid} — card concluido sem criterios de aceitacao\n")
                all_pass = False
            continue

        for i, part in enumerate(parts):
            is_negative = _is_negative_probe(part)
            selector = _clean_selector(part)

            if not selector:
                continue

            matches = _count_selector_matches(selector)

            if is_negative:
                if matches < 0:
                    # Text-only negative probe: not file-checkable
                    negative_uncheckable += 1
                    if card.get("status") == "concluido":
                        out.write(
                            f"  AVISO: {cid} — sonda negativa #{i + 1} nao "
                            f"verificavel (sem comando reconhecivel)\n"
                        )
                elif matches == 0:
                    # Negative probe target doesn't exist yet
                    # This is OK for pending cards, but for completed cards
                    # it means the probe can't be exercised
                    if card.get("status") == "concluido":
                        negative_fail += 1
                        out.write(
                            f"  FAIL: {cid} — sonda negativa #{i + 1} "
                            f"inalcancavel (zero alvos)\n"
                            f"         seletor: {selector[:100]}\n"
                        )
                        all_pass = False
                    else:
                        negative_ok += 1
                        out.write(
                            f"  AVISO: {cid} — sonda negativa #{i + 1} "
                            f"inalcancavel (zero alvos, card pendente)\n"
                        )
                else:
                    # Negative probe target exists: exercisable
                    negative_ok += 1
                    out.write(
                        f"  PASS: {cid} — sonda negativa #{i + 1} "
                        f"exercitavel ({matches} alvo(s))\n"
                    )
            elif card.get("status") == "concluido":
                if matches < 0:
                    selector_uncheckable += 1
                    out.write(
                        f"  AVISO: {cid} — seletor #{i + 1} nao "
                        f"verificavel (sem comando reconhecivel)\n"
                    )
                elif matches == 0:
                    selector_fail += 1
                    out.write(
                        f"  FAIL: {cid} — seletor #{i + 1} casa zero "
                        f"testes (card concluido)\n"
                        f"         seletor: {selector[:100]}\n"
                    )
                    all_pass = False
                else:
                    selector_ok += 1
                    out.write(
                        f"  PASS: {cid} — seletor #{i + 1} casa "
                        f"{matches} teste(s)\n"
                    )

    # --- 6. Sumario ---
    out.write("\n--- Sumario ---\n")
    out.write(f"  Cards parseados: {len(cards)}\n")
    out.write(f"  Cards concluidos: {len(completed)}\n")
    out.write(f"  Seletores OK: {selector_ok}\n")
    out.write(f"  Seletores FAIL: {selector_fail}\n")
    out.write(f"  Seletores nao verificaveis: {selector_uncheckable}\n")
    out.write(f"  Sondas negativas OK: {negative_ok}\n")
    out.write(f"  Sondas negativas FAIL: {negative_fail}\n")
    out.write(f"  Sondas negativas nao verificaveis: {negative_uncheckable}\n")

    if all_pass:
        out.write("\nRESULTADO: PASS\n")
    else:
        out.write("\nRESULTADO: FAIL\n")

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
    import argparse

    parser = argparse.ArgumentParser(
        description="Verificador de aceitacao — sonda negativa e tripwire"
    )
    parser.add_argument(
        "cards",
        nargs="?",
        default="tools/cards.json",
        help="Caminho para cards.json (default: tools/cards.json)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Saida em formato JSON",
    )
    parser.add_argument(
        "--raw-text",
        default=None,
        help="Caminho alternativo para texto bruto (tripwire).",
    )
    args = parser.parse_args()

    raw_text = None
    raw_path = args.raw_text or args.cards
    try:
        with open(raw_path, encoding="utf-8") as f:
            raw_text = f.read()
    except Exception:
        pass

    passed, messages = verify_acceptance(args.cards, raw_text)

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
