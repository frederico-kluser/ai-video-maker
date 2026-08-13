#!/usr/bin/env python3
"""
validate-ledger.py — Validador de schema, lista negra de evidencias e integridade do ledger.

Uso:
    python3 tools/validate-ledger.py [--id AB-950] [--exigir-gatilho]
    python3 tools/validate-ledger.py --exigir-fechados --categoria plataforma,infra,operacao [--permitir-aberto AB-950]

Modo schema (default, desde F0-03/W1): valida o schema de cada item e sai 1
com qualquer erro. E a superficie que tornou visivel a divida historica
(categorias/slugs fora do vocabulario fechado em itens de ondas antigas).

Modo fechamento (--exigir-fechados, card F6-04/W11 — gate G-LED): assere
apenas as propriedades de fechamento:
  - zero itens ABERTO nas categorias bloqueantes (--categoria filtra por
    slug de `responde`; sem --categoria, todos os itens estao em escopo),
    salvo allowlist explicita (--permitir-aberto <id>);
  - um item FECHADO com evidencia da lista negra tem de falhar (∅-crit do
    card): evidencia textual proibida, evidencia estruturada apontando
    arquivo inexistente, sha256 divergente ou conteudo do arquivo proibido;
  - FECHADO sem evidencia e INVIAVEL sem ADR sao closes falsos e falham;
  - cada id de --permitir-aberto exige justificativa em ledger/fechamento.md
    (secao "Allowlist") — allowlist explicita, nunca silenciosa.

O modo fechamento NAO valida o schema dos itens fora de escopo: a divida
historica e registrada em ledger/fechamento.md e o modo schema (sem flags)
continua falhando nela ate a correcao exigida (F6-05). A ferramenta de
schema estreou em F0-03 (W1); as flags de fechamento estreiam em F6-04.

O validador sai 0 com o ledger vazio desde o dia 1.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
INBOX_DIR = Path(
    os.environ.get("LEDGER_INBOX_OVERRIDE", str(REPO_ROOT / "ledger" / "inbox"))
)
FECHAMENTO_PATH = Path(
    os.environ.get(
        "LEDGER_FECHAMENTO_OVERRIDE", str(REPO_ROOT / "ledger" / "fechamento.md")
    )
)
EVIDENCIA_DIR = Path(
    os.environ.get(
        "LEDGER_EVIDENCIA_OVERRIDE", str(REPO_ROOT / "ledger" / "evidencia")
    )
)
CATEGORIAS_DIR = REPO_ROOT / "ledger"

ID_RE = re.compile(r"^AB-\d{3}$")

# Justificativa minima exigida para um item da allowlist em
# ledger/fechamento.md — a excecao tem de dizer POR QUE existe.
ALLOWLIST_JUSTIFICACAO_MIN_CHARS = 40
EVIDENCIA_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
EVIDENCIA_EXIT_RE = re.compile(r"^\d{1,3}$")
EVIDENCIA_ARQUIVO_RE = re.compile(r"^ledger/evidencia/AB-\d{3}\.[a-z0-9.]+$")

STATUS_VALIDOS = {"ABERTO", "FECHADO", "NAO_EXERCITADO", "INVIAVEL"}

CATEGORIA_ITEM_VALIDAS = {
    "ambiente",
    "render",
    "manim-bridge",
    "audio",
    "assets-licenca",
    "agentes-worktrees",
}

RESPONDE_SLUGS = {"dono", "juridico", "infra", "plataforma", "operacao"}

RISCO_VALIDOS = {"baixo", "medio", "alto", "critico"}

ANTECEDENCIA_VALIDAS = {"onda", "card", "commit"}

# Lista negra de evidencias textuais.
# Uniao de tres fontes: playbook (:466-467), panorama (§7.7, regra 4), card F0-03.
EVIDENCIA_BLACKLIST = {
    "ok",
    "confirmado",
    "conforme combinado",
    "resolvido",
    "feito",
    "checado",
    "sim",
    "n/a",
}

EVIDENCIA_MIN_CHARS = 12

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_whitespace(s: str) -> str:
    """Normaliza espacos internos para comparacao de comandos."""
    return " ".join(s.split())


def _normalize_evidencia_text(text: str) -> str:
    """Remove pontuacao final e espacos para aplicar a lista negra."""
    t = text.strip().lower()
    t = re.sub(r"[.!?;:,]+$", "", t)
    return t.strip()


def _check_evidencia_blacklist(
    text: str, exigir_tamanho_minimo: bool = True
) -> list[str]:
    """Retorna lista de erros se o texto de evidencia for invalido.

    exigir_tamanho_minimo=False e usado para o CONTEUDO de arquivos de
    evidencia (saida crua de comando — um contador '0' ou '1' e evidencia
    legitima); a lista negra vale sempre.
    """
    errors = []
    normalized = _normalize_evidencia_text(text)

    if normalized in EVIDENCIA_BLACKLIST:
        errors.append(
            f"evidencia textual '{text}' casa termo proibido '{normalized}'"
        )

    if exigir_tamanho_minimo and len(text.strip()) < EVIDENCIA_MIN_CHARS:
        errors.append(
            f"evidencia textual com {len(text.strip())} chars "
            f"(minimo: {EVIDENCIA_MIN_CHARS})"
        )

    return errors


def _parse_responde_slugs(responde: str) -> list[str]:
    """Extrai os slugs individuais de um campo responde composto."""
    tokens = re.split(r"[→+\s]+", responde)
    return [t for t in tokens if t]


# ---------------------------------------------------------------------------
# Validacao de schema por item
# ---------------------------------------------------------------------------


def validate_item_schema(item: dict[str, Any], item_path: str) -> list[str]:
    """Valida o schema completo de um item. Retorna lista de erros."""
    errors: list[str] = []
    item_id = item.get("id", "<sem id>")

    # --- Campos obrigatorios de topo ---
    required_top = [
        "id",
        "titulo",
        "pergunta",
        "por_que_aberto",
        "decisao_provisoria",
        "verificacao",
        "impacto_se_divergir",
        "risco",
        "categoria",
        "responde",
        "antecedencia",
        "status",
    ]
    for field in required_top:
        if field not in item:
            errors.append(f"{item_id}: campo obrigatorio '{field}' ausente")

    # --- id ---
    if "id" in item:
        if not isinstance(item["id"], str) or not ID_RE.match(item["id"]):
            errors.append(f"{item_id}: id invalido (esperado AB-NNN)")

    # --- status ---
    status = item.get("status")
    if status is not None:
        if not isinstance(status, str) or status not in STATUS_VALIDOS:
            errors.append(
                f"{item_id}: status '{status}' invalido "
                f"(esperado: {', '.join(sorted(STATUS_VALIDOS))})"
            )

    # --- categoria ---
    categoria = item.get("categoria")
    if categoria is not None:
        if not isinstance(categoria, str) or categoria not in CATEGORIA_ITEM_VALIDAS:
            errors.append(
                f"{item_id}: categoria '{categoria}' invalida "
                f"(esperado: {', '.join(sorted(CATEGORIA_ITEM_VALIDAS))})"
            )

    # --- risco ---
    risco = item.get("risco")
    if risco is not None:
        if not isinstance(risco, str) or risco not in RISCO_VALIDOS:
            errors.append(
                f"{item_id}: risco '{risco}' invalido "
                f"(esperado: {', '.join(sorted(RISCO_VALIDOS))})"
            )

    # --- antecedencia ---
    antecedencia = item.get("antecedencia")
    if antecedencia is not None:
        if not isinstance(antecedencia, str) or antecedencia not in ANTECEDENCIA_VALIDAS:
            errors.append(
                f"{item_id}: antecedencia '{antecedencia}' invalida "
                f"(esperado: {', '.join(sorted(ANTECEDENCIA_VALIDAS))})"
            )

    # --- responde ---
    responde = item.get("responde")
    if responde is not None:
        if isinstance(responde, str):
            slugs = _parse_responde_slugs(responde)
            unknown = [s for s in slugs if s not in RESPONDE_SLUGS]
            if unknown:
                errors.append(
                    f"{item_id}: responde contem slugs desconhecidos: {unknown}"
                )
        else:
            errors.append(f"{item_id}: responde deve ser string")

    # --- verificacao ---
    verificacao = item.get("verificacao")
    if verificacao is not None:
        if not isinstance(verificacao, dict):
            errors.append(f"{item_id}: verificacao deve ser objeto")
        else:
            if "cmd" not in verificacao:
                errors.append(f"{item_id}: verificacao.cmd ausente")
            elif not isinstance(verificacao["cmd"], str) or not verificacao["cmd"].strip():
                errors.append(f"{item_id}: verificacao.cmd vazio")
            if "espera" not in verificacao:
                errors.append(f"{item_id}: verificacao.espera ausente")
            if "ambiente" not in verificacao:
                errors.append(f"{item_id}: verificacao.ambiente ausente")

    # --- impacto_se_divergir ---
    impacto = item.get("impacto_se_divergir")
    if impacto is not None:
        if not isinstance(impacto, dict):
            errors.append(f"{item_id}: impacto_se_divergir deve ser objeto")
        else:
            if "resumo" not in impacto:
                errors.append(f"{item_id}: impacto_se_divergir.resumo ausente")
            if "artefatos" not in impacto:
                errors.append(f"{item_id}: impacto_se_divergir.artefatos ausente")
            elif not isinstance(impacto["artefatos"], list) or len(impacto["artefatos"]) == 0:
                errors.append(f"{item_id}: impacto_se_divergir.artefatos vazio")

    # --- Validacao por estado ---
    if status == "ABERTO":
        errors.extend(_validate_aberto(item, item_id))
    elif status == "FECHADO":
        errors.extend(_validate_fechado(item, item_id))
    elif status == "NAO_EXERCITADO":
        errors.extend(_validate_nao_exercitado(item, item_id))
    elif status == "INVIAVEL":
        errors.extend(_validate_inviavel(item, item_id))

    return errors


def _validate_aberto(item: dict[str, Any], item_id: str) -> list[str]:
    """Validacoes especificas para itens ABERTO."""
    errors: list[str] = []

    # Campo 4: verificacao com token executavel
    verificacao = item.get("verificacao")
    if isinstance(verificacao, dict):
        cmd = verificacao.get("cmd", "")
        if isinstance(cmd, str) and cmd.strip():
            # Rejeita verbos de intencao que nao sao comandos
            intencao_patterns = [
                r"^verificar com o dono",
                r"^testar em produ[çc][ãa]o",
                r"^conferir na doc",
                r"^alinhar com",
                r"^perguntar para",
                r"^decidir com",
            ]
            for pat in intencao_patterns:
                if re.search(pat, cmd.strip().lower()):
                    errors.append(
                        f"{item_id}: verificacao.cmd parece verbo de intencao, "
                        f"nao comando executavel: '{cmd.strip()}'"
                    )
                    break

    # Campo 5: impacto_se_divergir com artefatos
    impacto = item.get("impacto_se_divergir")
    if isinstance(impacto, dict):
        artefatos = impacto.get("artefatos", [])
        if isinstance(artefatos, list) and len(artefatos) == 0:
            errors.append(
                f"{item_id}: ABERTO requer impacto_se_divergir.artefatos nao-vazio"
            )

    return errors


def _validate_fechado(item: dict[str, Any], item_id: str) -> list[str]:
    """Validacoes especificas para itens FECHADO."""
    errors: list[str] = []

    evidencia = item.get("evidencia")
    if evidencia is None:
        errors.append(f"{item_id}: FECHADO requer evidencia")
        return errors

    if not isinstance(evidencia, dict):
        # Evidencia textual — aplica lista negra
        if isinstance(evidencia, str):
            errors.extend(_check_evidencia_blacklist(evidencia))
        else:
            errors.append(f"{item_id}: evidencia deve ser objeto ou string")
        return errors

    # Evidencia estruturada
    ev_cmd = evidencia.get("cmd", "")
    if not isinstance(ev_cmd, str) or not ev_cmd.strip():
        errors.append(f"{item_id}: evidencia.cmd ausente ou vazio")

    if "exit" not in evidencia:
        errors.append(f"{item_id}: evidencia.exit ausente")
    elif not isinstance(evidencia["exit"], (int, str)):
        errors.append(f"{item_id}: evidencia.exit deve ser numero")
    elif not EVIDENCIA_EXIT_RE.match(str(evidencia["exit"])):
        errors.append(f"{item_id}: evidencia.exit invalido")

    if "arquivo" not in evidencia:
        errors.append(f"{item_id}: evidencia.arquivo ausente")
    elif not isinstance(evidencia["arquivo"], str) or not EVIDENCIA_ARQUIVO_RE.match(
        evidencia["arquivo"]
    ):
        errors.append(
            f"{item_id}: evidencia.arquivo invalido "
            f"(esperado: ledger/evidencia/AB-NNN.ext)"
        )

    if "sha256" not in evidencia:
        errors.append(f"{item_id}: evidencia.sha256 ausente")
    elif not isinstance(evidencia["sha256"], str) or not EVIDENCIA_SHA256_RE.match(
        evidencia["sha256"]
    ):
        errors.append(f"{item_id}: evidencia.sha256 invalido (esperado: 64 hex chars)")

    # Compara evidencia.cmd com verificacao.cmd (normalizados)
    if isinstance(ev_cmd, str) and ev_cmd.strip():
        verificacao = item.get("verificacao")
        if isinstance(verificacao, dict):
            v_cmd = verificacao.get("cmd", "")
            if isinstance(v_cmd, str):
                if _normalize_whitespace(ev_cmd) != _normalize_whitespace(v_cmd):
                    errors.append(
                        f"{item_id}: evidencia.cmd diverge de verificacao.cmd"
                    )

    # data_resolucao obrigatoria para FECHADO
    if not item.get("data_resolucao"):
        errors.append(f"{item_id}: FECHADO requer data_resolucao")

    return errors


def _validate_nao_exercitado(item: dict[str, Any], item_id: str) -> list[str]:
    """Validacoes especificas para itens NAO_EXERCITADO."""
    errors: list[str] = []

    # Precisa de motivo textual
    motivo = item.get("por_que_aberto", "")
    if not isinstance(motivo, str) or len(motivo.strip()) < 10:
        errors.append(
            f"{item_id}: NAO_EXERCITADO requer por_que_aberto com motivo "
            f"detalhado (>=10 chars)"
        )

    return errors


def _validate_inviavel(item: dict[str, Any], item_id: str) -> list[str]:
    """Validacoes especificas para itens INVIAVEL."""
    errors: list[str] = []

    adr = item.get("adr")
    if not adr:
        errors.append(f"{item_id}: INVIAVEL requer adr (ADR com guarda executavel)")
    elif not isinstance(adr, str):
        errors.append(f"{item_id}: adr deve ser string (caminho ou referencia)")

    return errors


# ---------------------------------------------------------------------------
# Modo fechamento (--exigir-fechados, card F6-04 — gate G-LED)
# ---------------------------------------------------------------------------


def _normalize_evidencia_arquivo_path(arquivo: str) -> Path:
    """Resolve o caminho de um arquivo de evidencia.

    Caminhos no formato `ledger/evidencia/AB-NNN.ext` resolvem contra a raiz
    do repositorio (ou o override de evidencia usado pelo selftest); qualquer
    outro formato e resolvido literalmente (e nao existe — erro por schema).
    """
    if EVIDENCIA_ARQUIVO_RE.match(arquivo):
        return EVIDENCIA_DIR / Path(arquivo).name
    return Path(arquivo)


def check_evidencia_fechada(item: dict[str, Any], item_id: str) -> list[str]:
    """∅-crit do card F6-04: um item FECHADO com evidencia da lista negra
    tem de falhar — e closes falsos (sem evidencia, arquivo inexistente,
    sha256 divergente, arquivo com conteudo proibido) tambem.

    Vale para TODO item FECHADO do ledger, dentro ou fora do escopo das
    categorias bloqueantes.
    """
    errors: list[str] = []
    evidencia = item.get("evidencia")

    if evidencia is None:
        errors.append(f"{item_id}: FECHADO sem evidencia (close falso)")
        return errors

    if isinstance(evidencia, str):
        errors.extend(_check_evidencia_blacklist(evidencia))
        return errors

    if not isinstance(evidencia, dict):
        errors.append(f"{item_id}: evidencia deve ser objeto ou string")
        return errors

    # Evidencia estruturada: arquivo + sha256 tem de bater com o disco.
    arquivo = evidencia.get("arquivo", "")
    sha256_declarado = evidencia.get("sha256", "")

    if not isinstance(arquivo, str) or not EVIDENCIA_ARQUIVO_RE.match(arquivo):
        errors.append(
            f"{item_id}: evidencia.arquivo invalido "
            f"(esperado: ledger/evidencia/AB-NNN.ext)"
        )
        return errors

    caminho = _normalize_evidencia_arquivo_path(arquivo)
    if not caminho.is_file():
        errors.append(
            f"{item_id}: evidencia.arquivo inexistente: {arquivo} (close falso)"
        )
        return errors

    try:
        conteudo = caminho.read_bytes()
    except OSError as e:
        errors.append(f"{item_id}: evidencia.arquivo ilegivel: {e}")
        return errors

    if not isinstance(sha256_declarado, str) or not EVIDENCIA_SHA256_RE.match(
        sha256_declarado
    ):
        errors.append(
            f"{item_id}: evidencia.sha256 invalido (esperado: 64 hex chars)"
        )
        return errors

    hash_real = hashlib.sha256(conteudo).hexdigest()
    if hash_real != sha256_declarado:
        errors.append(
            f"{item_id}: evidencia.sha256 diverge do arquivo "
            f"({sha256_declarado[:12]} vs {hash_real[:12]})"
        )
        return errors

    # O conteudo do arquivo e a propria evidencia textual: a lista negra
    # vale sempre; o tamanho minimo NAO vale para saida crua de comando
    # (um contador '0' e evidencia legitima).
    try:
        texto = conteudo.decode("utf-8")
    except UnicodeDecodeError:
        texto = ""
    for err in _check_evidencia_blacklist(texto, exigir_tamanho_minimo=False):
        errors.append(f"{item_id}: evidencia.arquivo: {err}")

    return errors


def load_allowlist() -> dict[str, str]:
    """Le ledger/fechamento.md e extrai {id: justificativa} da secao Allowlist.

    Formato esperado (a unica fonte da allowlist — a flag so NOMEIA o item):

        ## Allowlist — itens abertos permitidos

        | Id | Justificativa |
        |---|---|
        | AB-950 | <texto da justificativa> |
    """
    result: dict[str, str] = {}
    if not FECHAMENTO_PATH.is_file():
        return result

    try:
        text = FECHAMENTO_PATH.read_text(encoding="utf-8")
    except OSError:
        return result

    in_allowlist = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("## "):
            in_allowlist = "allowlist" in stripped.lower()
            continue
        if not in_allowlist:
            continue
        m = re.match(r"^\|\s*(AB-\d{3})\s*\|\s*(.+?)\s*\|$", stripped)
        if m and m.group(2).strip():
            result[m.group(1)] = m.group(2).strip()

    return result


def check_allowlist(
    permitir_aberto: list[str],
    allowlist: dict[str, str],
    ids_existentes: set[str],
) -> list[str]:
    """Valida a allowlist explicita: cada id de --permitir-aberto tem de
    existir no inbox E ter justificativa real em ledger/fechamento.md.
    """
    errors: list[str] = []
    for pid in permitir_aberto:
        if not ID_RE.match(pid):
            errors.append(f"allowlist: id invalido: '{pid}'")
            continue
        if pid not in ids_existentes:
            errors.append(
                f"allowlist: item {pid} nao existe no inbox "
                f"(allowlist de item inexistente e silenciosa)"
            )
            continue
        justificativa = allowlist.get(pid)
        if not justificativa:
            errors.append(
                f"allowlist: item {pid} sem justificativa em "
                f"ledger/fechamento.md (secao 'Allowlist')"
            )
            continue
        if len(justificativa.strip()) < ALLOWLIST_JUSTIFICACAO_MIN_CHARS:
            errors.append(
                f"allowlist: justificativa de {pid} com "
                f"{len(justificativa.strip())} chars "
                f"(minimo: {ALLOWLIST_JUSTIFICACAO_MIN_CHARS})"
            )
            continue
        blacklist_hits = _check_evidencia_blacklist(justificativa)
        if blacklist_hits:
            errors.append(
                f"allowlist: justificativa de {pid} casa termo proibido: "
                f"{blacklist_hits}"
            )
    return errors


def check_fechamento(
    items: list[tuple[str, dict[str, Any]]],
    categoria_slugs: set[str],
    permitir_aberto: list[str],
) -> tuple[list[str], dict[str, int]]:
    """Checagens do modo --exigir-fechados.

    Retorna (erros, contagens) onde as contagens sao:
      em_escopo / abertos_em_escopo / fechados_checados / permitidos.

    Regras:
      1. Item em escopo (responde ∩ categoria_slugs != ∅) com status ABERTO
         e violacao, salvo se o id estiver na allowlist (--permitir-aberto).
      2. Item em escopo com status fora de {ABERTO, FECHADO, NAO_EXERCITADO,
         INVIAVEL} e violacao (status invalido num item de categoria
         bloqueante nao pode passar em silencio).
      3. Todo item FECHADO (do ledger inteiro) passa pelo ∅-crit de evidencia.
      4. Todo item INVIAVEL exige adr.
      5. A allowlist e validada por completo (justificativa exigida).
    """
    errors: list[str] = []
    ids_existentes = {item.get("id", "") for _, item in items if item.get("id")}
    em_escopo = 0
    abertos_em_escopo = 0

    for _, item in items:
        item_id = item.get("id", "<sem id>")
        responde = item.get("responde", "")
        slugs = set(_parse_responde_slugs(responde)) if isinstance(responde, str) else set()

        if categoria_slugs and not (slugs & categoria_slugs):
            continue
        em_escopo += 1

        status = item.get("status")
        if status == "ABERTO":
            if item_id not in permitir_aberto:
                abertos_em_escopo += 1
                errors.append(
                    f"{item_id}: item ABERTO em categoria bloqueante "
                    f"(responde: {responde}) — feche, marque NAO_EXERCITADO "
                    f"ou permita explicitamente com --permitir-aberto"
                )
        elif status not in STATUS_VALIDOS:
            errors.append(
                f"{item_id}: status '{status}' invalido em item de "
                f"categoria bloqueante"
            )

    for _, item in items:
        item_id = item.get("id", "<sem id>")
        if item.get("status") == "FECHADO":
            errors.extend(check_evidencia_fechada(item, item_id))
        elif item.get("status") == "INVIAVEL":
            if not item.get("adr"):
                errors.append(
                    f"{item_id}: INVIAVEL requer adr (ADR com guarda executavel)"
                )

    errors.extend(
        check_allowlist(permitir_aberto, load_allowlist(), ids_existentes)
    )

    return errors, {
        "em_escopo": em_escopo,
        "abertos_em_escopo": abertos_em_escopo,
    }


# ---------------------------------------------------------------------------
# Carregamento e validacao global
# ---------------------------------------------------------------------------


def load_inbox_items() -> list[tuple[str, dict[str, Any]]]:
    """Carrega todos os itens de ledger/inbox/*.json.

    Retorna lista de (arquivo, item).
    """
    items: list[tuple[str, dict[str, Any]]] = []
    if not INBOX_DIR.is_dir():
        return items

    for fpath in sorted(INBOX_DIR.glob("*.json")):
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"ERRO: {fpath.name}: JSON invalido: {e}", file=sys.stderr)
            sys.exit(2)

        if isinstance(data, list):
            for i, item in enumerate(data):
                if isinstance(item, dict):
                    items.append((f"{fpath.name}[{i}]", item))
                else:
                    print(
                        f"ERRO: {fpath.name}[{i}]: item nao e objeto",
                        file=sys.stderr,
                    )
                    sys.exit(2)
        elif isinstance(data, dict):
            items.append((fpath.name, data))
        else:
            print(
                f"ERRO: {fpath.name}: conteudo nao e objeto nem lista",
                file=sys.stderr,
            )
            sys.exit(2)

    return items


def validate_all(items: list[tuple[str, dict[str, Any]]]) -> tuple[list[str], dict[str, int]]:
    """Valida todos os itens. Retorna (erros, contagem_por_status)."""
    all_errors: list[str] = []
    seen_ids: dict[str, str] = {}  # id -> arquivo
    counts: dict[str, int] = {"ABERTO": 0, "FECHADO": 0, "NAO_EXERCITADO": 0, "INVIAVEL": 0}

    for file_path, item in items:
        item_id = item.get("id", "<sem id>")

        # Unicidade de id
        if isinstance(item_id, str) and ID_RE.match(item_id):
            if item_id in seen_ids:
                all_errors.append(
                    f"{item_id}: id duplicado (em '{seen_ids[item_id]}' e '{file_path}')"
                )
            else:
                seen_ids[item_id] = file_path

        # Schema do item
        all_errors.extend(validate_item_schema(item, file_path))

        # Contagem
        status = item.get("status")
        if status in counts:
            counts[status] += 1

    # Invariante: itens parseados >= 1 por inbox nao-vazio
    # (verificado no consolidator, nao aqui — o validador so ve o que foi carregado)

    return all_errors, counts


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validador de schema e integridade do ledger de incerteza"
    )
    parser.add_argument(
        "--id",
        type=str,
        default=None,
        help="Filtrar validacao para um id especifico (ex: AB-950)",
    )
    parser.add_argument(
        "--exigir-gatilho",
        action="store_true",
        default=False,
        help="Exigir campo 'gatilho' no item filtrado (para AB-950)",
    )
    parser.add_argument(
        "--exigir-fechados",
        action="store_true",
        default=False,
        help="Modo fechamento (gate G-LED): zero itens ABERTO nas categorias "
        "bloqueantes, salvo allowlist explicita (F6-04)",
    )
    parser.add_argument(
        "--categoria",
        type=str,
        default=None,
        help="Categorias bloqueantes: slugs de quem_responde separados por "
        "virgula (ex: plataforma,infra,operacao). Sem o flag, todos os itens "
        "estao em escopo.",
    )
    parser.add_argument(
        "--permitir-aberto",
        type=str,
        action="append",
        default=[],
        help="Item permitido ABERTO nas categorias bloqueantes (repeatable). "
        "Requer justificativa em ledger/fechamento.md, secao 'Allowlist' — "
        "allowlist explicita, nunca silenciosa.",
    )
    args = parser.parse_args()

    items = load_inbox_items()
    total_inbox_files = len(list(INBOX_DIR.glob("*.json"))) if INBOX_DIR.is_dir() else 0

    if args.id is not None:
        items = [(fp, it) for fp, it in items if it.get("id") == args.id]
        if not items:
            print(f"Item {args.id} nao encontrado no inbox")
            return 0 if not args.exigir_gatilho else 1

    if args.exigir_fechados:
        return run_fechamento(items, total_inbox_files, args)

    errors, counts = validate_all(items)

    # --exigir-gatilho: para AB-950
    if args.exigir_gatilho:
        for _, item in items:
            if "gatilho" not in item:
                errors.append(
                    f"{item.get('id', '?')}: --exigir-gatilho requer campo 'gatilho'"
                )
            elif item["gatilho"] is None:
                errors.append(
                    f"{item.get('id', '?')}: --exigir-gatilho requer 'gatilho' nao-nulo"
                )

    # Imprime resumo
    total = sum(counts.values())
    print(f"Ledger: {total} itens ({total_inbox_files} arquivo(s) de inbox)")
    print(
        f"  ABERTO: {counts['ABERTO']} | "
        f"FECHADO: {counts['FECHADO']} | "
        f"NAO_EXERCITADO: {counts['NAO_EXERCITADO']} | "
        f"INVIAVEL: {counts['INVIAVEL']}"
    )

    if errors:
        print(f"\n{len(errors)} erro(s) de validacao:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("Validacao: OK")
    return 0


def run_fechamento(
    items: list[tuple[str, dict[str, Any]]],
    total_inbox_files: int,
    args: argparse.Namespace,
) -> int:
    """Modo --exigir-fechados: o veredito do gate G-LED (card F6-04).

    O exit code reflete SOMENTE as propriedades de fechamento. Os erros de
    schema dos itens historicos fora do vocabulario fechado sao divida
    registrada em ledger/fechamento.md (decisao (a) do F6-04) e continuam
    fazendo o modo schema (sem flags) falhar — a divida nao some da
    superficie, so sai do escopo deste gate.
    """
    categoria_slugs = set()
    if args.categoria:
        categoria_slugs = {s.strip() for s in args.categoria.split(",") if s.strip()}
        desconhecidos = sorted(s for s in categoria_slugs if s not in RESPONDE_SLUGS)
        if desconhecidos:
            print(
                f"ERRO: --categoria com slugs desconhecidos: {desconhecidos} "
                f"(esperado: {', '.join(sorted(RESPONDE_SLUGS))})",
                file=sys.stderr,
            )
            return 2

    total = len(items)
    fechamento_errors, stats = check_fechamento(
        items, categoria_slugs, args.permitir_aberto
    )

    escopo_label = (
        ", ".join(sorted(categoria_slugs)) if categoria_slugs else "todos os itens"
    )
    print(f"Ledger: {total} itens ({total_inbox_files} arquivo(s) de inbox)")
    print(f"Fechamento (categorias bloqueantes: {escopo_label}):")
    print(f"  em escopo: {stats['em_escopo']} | abertos em escopo: "
          f"{stats['abertos_em_escopo']} | permitidos: {len(args.permitir_aberto)}")
    if args.permitir_aberto:
        print(f"  allowlist: {', '.join(args.permitir_aberto)}")

    if fechamento_errors:
        print(f"\n{len(fechamento_errors)} erro(s) de fechamento:")
        for err in fechamento_errors:
            print(f"  - {err}")
        return 1

    print("\nFechamento: OK — zero itens ABERTO nas categorias bloqueantes")
    return 0


if __name__ == "__main__":
    sys.exit(main())