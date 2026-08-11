#!/usr/bin/env python3
"""tools/invariantes/verificar.py — Verificador de invariantes estruturais.

Cada invariante tem tres estados: PASS, FAIL, NAO-EXERCITADO.
PASS  = verificacao rodou e passou.
FAIL  = verificacao rodou e encontrou violacao.
NAO-EXERCITADO = o alvo ainda nao existe (ex.: diretorio vazio, arquivo ausente).

Regras de projeto (fonte: AGENTS.md, estrutura.md, PROGRAMA.html):
- Falha fechado: o que nao e analisado e recusado explicitamente.
- Zero itens parseados = falha.
- A mensagem de erro identifica o que violou e onde.
- O autoteste (verificar_selftest.py) roda ANTES e asserta a MENSAGEM.

Uso:
  python3 tools/invariantes/verificar.py [--raiz DIR] [--invariante NOME]
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Tipos
# ---------------------------------------------------------------------------

# Resultado de um invariante: (estado, mensagem, detalhes)
Resultado = Tuple[str, str, str]

# Funcao que verifica um invariante: (raiz: Path) -> Resultado
Verificador = Callable[[Path], Resultado]

# ---------------------------------------------------------------------------
# Cores ANSI
# ---------------------------------------------------------------------------

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[0;33m"
CYAN = "\033[0;36m"
NC = "\033[0m"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_file(caminho: Path) -> Optional[str]:
    """Le arquivo, retorna None se nao existir."""
    try:
        return caminho.read_text(encoding="utf-8")
    except (FileNotFoundError, IsADirectoryError, PermissionError):
        return None


# ---------------------------------------------------------------------------
# I01: Todo projeto de teste e executado por algum job
# ---------------------------------------------------------------------------

def _i01_testes_tem_job(raiz: Path) -> Resultado:
    """I01: Todo projeto de teste e executado por algum job."""

    nome = "I01: testes-tem-job"
    testes_dir = raiz / "tests"
    if not testes_dir.is_dir():
        return ("NAO-EXERCITADO", f"{nome} — diretorio tests/ nao existe", "")

    dirs_com_teste: List[str] = []
    for d in sorted(testes_dir.iterdir()):
        if d.is_dir() and not d.name.startswith("."):
            arquivos = list(d.rglob("*"))
            arquivos_teste = [
                a for a in arquivos
                if a.is_file()
                and a.suffix in (".py", ".ts", ".tsx", ".json")
                and not a.name.startswith(".")
            ]
            if arquivos_teste:
                dirs_com_teste.append(d.name)

    if not dirs_com_teste:
        return ("NAO-EXERCITADO", f"{nome} — nenhum diretorio de teste com arquivos", "")

    # Coleta jobs do justfile
    justfile_path = raiz / "justfile"
    just_recipes: List[str] = []
    just_commands: List[str] = []
    if justfile_path.is_file():
        conteudo = _read_file(justfile_path)
        if conteudo:
            for linha in conteudo.split("\n"):
                match = re.match(r"^([a-zA-Z][a-zA-Z0-9_\-:]*)\s*:", linha)
                if match:
                    just_recipes.append(match.group(1))
            just_commands = [conteudo]

    # Coleta etapas do gate.sh
    gate_path = raiz / "tools" / "gate.sh"
    gate_texto = ""
    if gate_path.is_file():
        gate_texto = _read_file(gate_path) or ""

    # Verifica cada diretorio de teste
    sem_job: List[str] = []
    for d in dirs_com_teste:
        tem_job = False
        # Busca no justfile
        texto_just = " ".join(just_recipes + just_commands)
        if d in texto_just or f"tests/{d}" in texto_just:
            tem_job = True
        # Busca no gate.sh
        if d in gate_texto or f"tests/{d}" in gate_texto:
            tem_job = True
        # Busca em .github/ se existir
        workflows_dir = raiz / ".github" / "workflows"
        if workflows_dir.is_dir():
            for wf in workflows_dir.glob("*.yml"):
                wf_texto = _read_file(wf) or ""
                if d in wf_texto or f"tests/{d}" in wf_texto:
                    tem_job = True
                    break
        if not tem_job:
            sem_job.append(d)

    if sem_job:
        detalhes = "\n".join(
            f"  tests/{d}/ — sem job correspondente"
            for d in sem_job
        )
        return (
            "FAIL",
            f"{nome} — {len(sem_job)} diretorio(s) de teste sem job: {', '.join(sem_job)}",
            detalhes,
        )

    return (
        "PASS",
        f"{nome} — {len(dirs_com_teste)} diretorio(s) de teste, todos com job",
        "",
    )


# ---------------------------------------------------------------------------
# I02: Nenhum literal de token fora de src/design/
# ---------------------------------------------------------------------------

def _i02_tokens_fora_de_design(raiz: Path) -> Resultado:
    """I02: Nenhum literal de token fora de src/design/."""

    nome = "I02: tokens-fora-de-design"
    src_dir = raiz / "src"

    if not src_dir.is_dir():
        return ("NAO-EXERCITADO", f"{nome} — diretorio src/ nao existe", "")

    # Padroes de literal proibido (fora de src/design/)
    padroes: List[Tuple[str, str, str]] = [
        ("hex-color", r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b",
         "Cor hexadecimal literal. Use tokens.palette ou cor semantica."),
        ("duration-ms", r"\b(\d+)\s*ms\b",
         "Duracao literal em ms. Use tokens.transitionDuration."),
        ("duration-s", r"(?<![a-zA-Z0-9])(\d+(?:\.\d+)?)\s*[sS](?![a-zA-Z])",
         "Duracao literal em segundos. Use tokens.minTextDurationSeconds."),
        ("px-literal", r"\b(\d{2,4})\s*px\b",
         "Valor literal em px. Use tokens.breakpoints, tokens.safeArea."),
        ("lufs-literal", r"(?:targetLufs|lufs|LUFS)\s*[:=]\s*(-?\d+(?:\.\d+)?)",
         "LUFS literal redeclarado. Use tokens.targetLufs."),
        ("cps-literal", r"(?:maxCps|cps|CPS|charsPerSecond)\s*[:=]\s*(\d+)",
         "CPS literal redeclarado. Use tokens.maxCpsAdult."),
        ("zindex-literal", r"(?:zIndex|z_index)\s*[:=]\s*(\d+)",
         "z-index literal redeclarado. Use tokens.zIndex."),
        ("flash-literal", r"(?:maxFlashes|flashesPerSecond)\s*[:=]\s*(\d+)",
         "Limite de flash redeclarado. Use tokens.maxFlashesPerSecond."),
    ]

    arquivos: List[Path] = []
    for ext in (".ts", ".tsx", ".py", ".js", ".jsx"):
        for a in src_dir.rglob(f"*{ext}"):
            if a.is_file():
                rel = str(a.relative_to(raiz))
                if not rel.startswith("src/design/"):
                    arquivos.append(a)

    if not arquivos:
        return ("NAO-EXERCITADO", f"{nome} — nenhum arquivo fonte fora de src/design/", "")

    violacoes: List[str] = []
    for arquivo in sorted(arquivos):
        conteudo = _read_file(arquivo)
        if conteudo is None:
            continue
        rel = str(arquivo.relative_to(raiz))
        linhas = conteudo.split("\n")

        for i, linha in enumerate(linhas, 1):
            linha_strip = linha.strip()
            if linha_strip.startswith("//") or linha_strip.startswith("#"):
                continue
            if linha_strip.startswith("*") or linha_strip.startswith("/*"):
                continue
            if "from" in linha and "tokens" in linha:
                continue
            if "import" in linha and "tokens" in linha:
                continue

            for nome_classe, regex, msg in padroes:
                try:
                    matches = list(re.finditer(regex, linha))
                except re.error:
                    continue
                for m in matches:
                    valor = m.group(1) if m.lastindex else m.group(0)
                    violacoes.append(
                        f"  {rel}:{i}: \"{m.group(0).strip()}\" — {msg}"
                    )

    if violacoes:
        return (
            "FAIL",
            f"{nome} — {len(violacoes)} literal(is) de token fora de src/design/",
            "\n".join(violacoes[:20]),
        )

    return (
        "PASS",
        f"{nome} — {len(arquivos)} arquivo(s) escaneado(s), zero literais",
        "",
    )


# ---------------------------------------------------------------------------
# I03: Nenhuma URL remota em manifesto-resolvido.json
# ---------------------------------------------------------------------------

def _i03_url_em_manifesto_resolvido(raiz: Path) -> Resultado:
    """I03: Nenhuma URL remota em manifesto-resolvido.json."""

    nome = "I03: url-em-manifesto-resolvido"

    caminhos = [
        raiz / "fixtures" / "gm" / "manifesto-resolvido.json",
        raiz / "output" / "manifesto-resolvido.json",
        raiz / "manifesto-resolvido.json",
    ]

    encontrado = False
    violacoes: List[str] = []

    for caminho in caminhos:
        conteudo = _read_file(caminho)
        if conteudo is None:
            continue
        encontrado = True
        padrao_url = re.compile(r"https?://[^\s\"',}]+")
        for i, linha in enumerate(conteudo.split("\n"), 1):
            for m in padrao_url.finditer(linha):
                violacoes.append(f"  {caminho.name}:{i}: \"{m.group(0)}\"")

    if not encontrado:
        return ("NAO-EXERCITADO", f"{nome} — manifesto-resolvido.json nao encontrado", "")

    if violacoes:
        return (
            "FAIL",
            f"{nome} — {len(violacoes)} URL(s) remota(s) encontrada(s)",
            "\n".join(violacoes[:10]),
        )

    return ("PASS", f"{nome} — manifesto-resolvido.json encontrado, zero URLs remotas", "")


# ---------------------------------------------------------------------------
# I04: Nenhum nao-determinismo em src/composicao/
# ---------------------------------------------------------------------------

def _i04_nao_determinismo_em_composicao(raiz: Path) -> Resultado:
    """I04: Nenhum nao-determinismo em src/composicao/."""

    nome = "I04: nao-determinismo-em-composicao"
    composicao_dir = raiz / "src" / "composicao"

    if not composicao_dir.is_dir():
        return ("NAO-EXERCITADO", f"{nome} — diretorio src/composicao/ nao existe", "")

    padroes_proibidos: List[Tuple[str, str, str]] = [
        ("Date.now()", r"\bDate\.now\s*\(\s*\)", "Date.now() — use frame como relogio"),
        ("new Date()", r"\bnew\s+Date\s*\(\s*\)", "new Date() — use frame como relogio"),
        ("Math.random()", r"\bMath\.random\s*\(\s*\)", "Math.random() — use seed"),
        ("setTimeout", r"\bsetTimeout\s*\(", "setTimeout() — proibido em composicao pura"),
        ("setInterval", r"\bsetInterval\s*\(", "setInterval() — proibido em composicao pura"),
        ("fetch(", r"\bfetch\s*\(", "fetch() — proibido em composicao pura"),
        ("process.env", r"\bprocess\.env\b", "process.env — proibido em composicao pura"),
        ("localStorage", r"\blocalStorage\b", "localStorage — proibido em composicao pura"),
        ("fs.readFile", r"\bfs\.readFile", "fs.readFile() — proibido em composicao pura"),
    ]

    arquivos: List[Path] = []
    for ext in (".ts", ".tsx", ".js", ".jsx"):
        for a in composicao_dir.rglob(f"*{ext}"):
            if a.is_file():
                arquivos.append(a)

    if not arquivos:
        return ("NAO-EXERCITADO", f"{nome} — src/composicao/ existe mas sem arquivos fonte", "")

    violacoes: List[str] = []
    for arquivo in sorted(arquivos):
        conteudo = _read_file(arquivo)
        if conteudo is None:
            continue
        rel = str(arquivo.relative_to(raiz))
        linhas = conteudo.split("\n")
        for i, linha in enumerate(linhas, 1):
            linha_strip = linha.strip()
            if linha_strip.startswith("//") or linha_strip.startswith("/*"):
                continue
            for nome, regex, msg in padroes_proibidos:
                if re.search(regex, linha):
                    violacoes.append(f"  {rel}:{i}: {nome} — {msg}")

    if violacoes:
        return (
            "FAIL",
            f"{nome} — {len(violacoes)} chamada(s) nao-deterministica(s)",
            "\n".join(violacoes[:20]),
        )

    return ("PASS", f"{nome} — {len(arquivos)} arquivo(s) escaneado(s), zero nao-determinismo", "")


# ---------------------------------------------------------------------------
# I05: Todo id de composicao registrado e unico
# ---------------------------------------------------------------------------

def _i05_ids_composicao_unicos(raiz: Path) -> Resultado:
    """I05: Todo id de composicao registrado e unico."""

    nome = "I05: ids-composicao-unicos"

    arquivos_registro = [
        raiz / "src" / "composicao" / "raiz.tsx",
        raiz / "src" / "Root.tsx",
        raiz / "src" / "index.ts",
    ]

    encontrado = False
    ids: Dict[str, List[str]] = {}

    for arquivo in arquivos_registro:
        conteudo = _read_file(arquivo)
        if conteudo is None:
            continue
        encontrado = True
        rel = str(arquivo.relative_to(raiz))
        padroes_id = [
            re.compile(r'<Composition[^>]*\bid\s*=\s*["\']([^"\']+)["\']'),
            re.compile(r'id\s*:\s*["\']([^"\']+)["\']'),
            re.compile(r'registerRoot\s*\(\s*["\x27]([^"\x27]+)["\x27]'),
        ]
        linhas = conteudo.split("\n")
        for i, linha in enumerate(linhas, 1):
            for padrao in padroes_id:
                for m in padrao.finditer(linha):
                    id_valor = m.group(1)
                    if id_valor not in ids:
                        ids[id_valor] = []
                    ids[id_valor].append(f"{rel}:{i}")

    if not encontrado:
        return ("NAO-EXERCITADO", f"{nome} — nenhum arquivo de registro de composicao encontrado", "")

    if not ids:
        return ("NAO-EXERCITADO", f"{nome} — arquivo(s) de registro encontrado(s) mas sem ids", "")

    duplicados = [(id_valor, locs) for id_valor, locs in ids.items() if len(locs) > 1]

    if duplicados:
        detalhes = "\n".join(
            f"  id \"{id_valor}\" em: {', '.join(locs)}"
            for id_valor, locs in duplicados
        )
        return ("FAIL", f"{nome} — {len(duplicados)} id(s) duplicado(s)", detalhes)

    return ("PASS", f"{nome} — {len(ids)} id(s) de composicao, todos unicos", "")


# ---------------------------------------------------------------------------
# I06: Nenhum segredo literal
# ---------------------------------------------------------------------------

def _i06_sem_segredos_literais(raiz: Path) -> Resultado:
    """I06: Nenhum segredo literal no repositorio."""

    nome = "I06: sem-segredos-literais"

    padroes_segredo: List[Tuple[str, str, str]] = [
        ("aws-access-key", r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
        ("github-token", r"gh[pousr]_[A-Za-z0-9_]{36,}", "GitHub PAT"),
        ("openai-key", r"sk-[A-Za-z0-9]{32,}", "OpenAI API Key"),
        ("anthropic-key", r"sk-ant-[A-Za-z0-9]{32,}", "Anthropic API Key"),
        ("api-key-assignment",
         r'(?i)(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["\'][A-Za-z0-9_\-]{20,}["\']',
         "API key literal"),
        ("password-assignment",
         r'(?i)password\s*[:=]\s*["\'][^"\']{4,}["\']',
         "Senha literal"),
        ("jwt-token",
         r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}",
         "JWT token literal"),
        ("private-key",
         r"-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PGP)\s+PRIVATE\s+KEY",
         "Chave privada literal"),
        ("slack-webhook",
         r"https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+",
         "Slack webhook URL"),
        ("discord-webhook",
         r"https://discord\.com/api/webhooks/\d+/[A-Za-z0-9_\-]+",
         "Discord webhook URL"),
    ]

    excluir_dirs = {
        "node_modules", "dist", ".git", "output", ".remotion",
        ".cache", "__pycache__", "fixtures/cassetes",
    }
    excluir_prefixos = {
        "tools/invariantes/verificar_selftest.py",
    }
    excluir_ext = {".lock", ".pyc", ".tsbuildinfo", ".map", ".png", ".jpg",
                   ".jpeg", ".gif", ".webm", ".mp4", ".mov", ".mp3",
                   ".wav", ".ogg", ".woff", ".woff2", ".ttf", ".otf"}

    violacoes: List[str] = []
    arquivos_escaneados = 0

    for arquivo in raiz.rglob("*"):
        if not arquivo.is_file():
            continue
        rel = str(arquivo.relative_to(raiz))
        if any(rel == d or rel.startswith(d + "/") for d in excluir_dirs):
            continue
        if any(rel == p or rel.startswith(p + "/") for p in excluir_prefixos):
            continue
        if arquivo.suffix in excluir_ext:
            continue
        conteudo = _read_file(arquivo)
        if conteudo is None:
            continue
        arquivos_escaneados += 1
        for nome_padrao, regex, desc in padroes_segredo:
            try:
                for m in re.finditer(regex, conteudo):
                    linha = conteudo[:m.start()].count("\n") + 1
                    violacoes.append(f"  {rel}:{linha}: {nome_padrao} — {desc}")
            except re.error:
                continue

    if not arquivos_escaneados:
        return ("NAO-EXERCITADO", f"{nome} — nenhum arquivo escaneado", "")

    if violacoes:
        return (
            "FAIL",
            f"{nome} — {len(violacoes)} segredo(s) literal(is) encontrado(s)",
            "\n".join(violacoes[:20]),
        )

    return ("PASS", f"{nome} — {arquivos_escaneados} arquivo(s) escaneado(s), zero segredos", "")


# ---------------------------------------------------------------------------
# I07: Ausencia do que foi removido por decisao
# ---------------------------------------------------------------------------

def _i07_ausencia_de_removido(raiz: Path) -> Resultado:
    """I07: Ausencia do que foi removido por decisao."""

    nome = "I07: ausencia-de-removido"

    itens_removidos: List[Tuple[str, str, str]] = []

    if not itens_removidos:
        return ("NAO-EXERCITADO", f"{nome} — nenhum item removido por decisao registrado", "")

    violacoes: List[str] = []
    for padrao, adr, desc in itens_removidos:
        matches = list(raiz.glob(padrao))
        for m in matches:
            if m.is_file() or m.is_dir():
                violacoes.append(f"  {m.relative_to(raiz)} — {desc} ({adr})")

    if violacoes:
        return (
            "FAIL",
            f"{nome} — {len(violacoes)} item(ns) removido(s) reencontrado(s)",
            "\n".join(violacoes),
        )

    return ("PASS", f"{nome} — {len(itens_removidos)} item(ns) removido(s) verificados, zero", "")


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------

INVARIANTES: Dict[str, Tuple[str, Verificador]] = {
    "I01": ("I01: testes-tem-job — Todo diretorio de teste executado por job", _i01_testes_tem_job),
    "I02": ("I02: tokens-fora-de-design — Nenhum literal de token fora de src/design/", _i02_tokens_fora_de_design),
    "I03": ("I03: url-em-manifesto-resolvido — Nenhuma URL remota em manifesto-resolvido.json", _i03_url_em_manifesto_resolvido),
    "I04": ("I04: nao-determinismo-em-composicao — Nenhum nao-determinismo em src/composicao/", _i04_nao_determinismo_em_composicao),
    "I05": ("I05: ids-composicao-unicos — Todo id de composicao registrado e unico", _i05_ids_composicao_unicos),
    "I06": ("I06: sem-segredos-literais — Nenhum segredo literal no repositorio", _i06_sem_segredos_literais),
    "I07": ("I07: ausencia-de-removido — Ausencia do que foi removido por decisao", _i07_ausencia_de_removido),
}


# ---------------------------------------------------------------------------
# Execucao
# ---------------------------------------------------------------------------

def _colorir_estado(estado: str) -> str:
    if estado == "PASS":
        return f"{GREEN}[PASS]{NC}"
    elif estado == "FAIL":
        return f"{RED}[FAIL]{NC}"
    elif estado == "NAO-EXERCITADO":
        return f"{YELLOW}[NAO-EXERCITADO]{NC}"
    return estado


def verificar(raiz: Optional[Path] = None, invariante_nome: Optional[str] = None) -> int:
    """Executa verificacao de invariantes. Retorna 0=PASS, 1=FAIL, 2=erro."""

    raiz = raiz or Path.cwd()
    if not raiz.is_dir():
        print(f"Erro: diretorio raiz '{raiz}' nao existe", file=sys.stderr)
        return 2

    if invariante_nome:
        if invariante_nome not in INVARIANTES:
            print(f"Erro: invariante '{invariante_nome}' nao encontrado", file=sys.stderr)
            print(f"Disponiveis: {', '.join(sorted(INVARIANTES.keys()))}", file=sys.stderr)
            return 2
        selecionados = {invariante_nome: INVARIANTES[invariante_nome]}
    else:
        selecionados = INVARIANTES

    print("=== Verificador de Invariantes Estruturais ===")
    print(f"Raiz: {raiz}")
    print()

    pass_count = 0
    fail_count = 0
    nao_exercitado_count = 0

    for nome in sorted(selecionados.keys()):
        desc, verificador = selecionados[nome]
        estado, msg, detalhes = verificador(raiz)
        print(f"  {_colorir_estado(estado)} {msg}")
        if estado == "PASS":
            pass_count += 1
        elif estado == "FAIL":
            fail_count += 1
            if detalhes:
                for linha in detalhes.split("\n"):
                    if linha.strip():
                        print(f"    {linha}")
        elif estado == "NAO-EXERCITADO":
            nao_exercitado_count += 1

    print()
    print("---")
    total = pass_count + fail_count + nao_exercitado_count
    print(f"Total: {total} invariante(s)")

    if fail_count > 0:
        print(f"{RED}VERMELHO{NC} — {pass_count} PASS, {fail_count} FAIL, {nao_exercitado_count} NAO-EXERCITADO")
        return 1
    elif nao_exercitado_count > 0:
        print(f"{YELLOW}AMARELO{NC} — {pass_count} PASS, {fail_count} FAIL, {nao_exercitado_count} NAO-EXERCITADO")
        return 0
    else:
        print(f"{GREEN}VERDE{NC} — {pass_count} PASS, {fail_count} FAIL, {nao_exercitado_count} NAO-EXERCITADO")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verificador de invariantes estruturais do Editor de Video IA",
    )
    parser.add_argument("--raiz", type=Path, default=None, help="Diretorio raiz do repositorio")
    parser.add_argument("--invariante", type=str, default=None, help="Executa apenas este invariante")
    parser.add_argument("--lista", action="store_true", help="Lista invariantes e sai")
    args = parser.parse_args()

    if args.lista:
        for nome in sorted(INVARIANTES.keys()):
            print(f"  {nome}: {INVARIANTES[nome][0]}")
        return

    sys.exit(verificar(raiz=args.raiz, invariante_nome=args.invariante))


if __name__ == "__main__":
    main()
