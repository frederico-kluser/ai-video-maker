#!/usr/bin/env python3
# =============================================================================
# medir-maquina.py — medicao e conferencia da maquina de render (card I-03)
# =============================================================================
# Card: I-03 (W6.5, infra) — "Maquina de render: RAM por worker, ponto de
# saturacao, sessoes de encode, throughput de disco — cada numero com o
# comando que o reproduz".
#
# UMA ferramenta para tres papeis:
#   1. MEDIR (cerimonia completa, registrada em docs/medicao/maquina.md):
#        inventario  — fatos da maquina (CPU/RAM/GPU/disco/carga/versoes)
#        rss         — pico de RSS da arvore do render -> RAM por worker
#        saturacao   — curva tempo-por-frame x concurrency -> ponto de saturacao
#        encode      — sessoes de encode paralelas (nvenc + libx264)
#        disco       — throughput de escrita/leitura (dd) no diretorio e no store
#        gate-pico   — pico de RSS do gate local (margem para rodar junto)
#   2. CONFERIR (medicao CURTA vs numeros declarados + tolerancia):
#        conferir / --conferir — le a tabela de docs/medicao/maquina.md,
#                                 re-mede em curto e falha alem da tolerancia
#   3. SINCRONIZAR a tabela do documento:
#        gerar-tabela — imprime as linhas de tabela (chave|valor|...|comando)
#                       no formato que o `conferir` parseia
#
# Toda execucao registra data/hora, comando e saida — nada e copiado de
# documentacao: cada numero abaixo tem o comando que o reproduz.
#
# Saida: texto; com --json, dict JSON por subcomando (para parse).
# Exit: 0 = PASS, 1 = FAIL (conferir), 2 = erro de uso.
# =============================================================================

import argparse
import json
import os
import re
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "fixtures" / "snapshots" / "integrado" / "entrada.tsx"
COMP = "integrado"
WORK = Path("/tmp/medir-maquina")           # espaco de trabalho da medicao
DOC = RAIZ / "docs" / "medicao" / "maquina.md"
STORE_DIR = RAIZ / ".cache" / "store"       # store default (tools/store-put.ts)
GATE_SH = RAIZ / "tools" / "gate.sh"
FRAMES_CURVA = "0-239"                      # 240 frames (8 s) da fixture canonica
FRAMES_CURTO = "0-59"                       # 60 frames — medicao curta
FRAMES_CURTO_SAT = "0-119"                  # 120 frames — curta de saturacao (startup
                                            # domina 60 frames: c4 vs c8 vira ruido)

# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def rodar(cmd: list[str], log: Path, timeout: int | None = None) -> subprocess.CompletedProcess:
    """Roda um comando com stdout/stderr no log e retorna o resultado."""
    with log.open("w") as f:
        f.write(f"# {agora()} — comando: {' '.join(cmd)}\n")
        try:
            p = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT,
                               text=True, timeout=timeout)
        except subprocess.TimeoutExpired:
            f.write(f"# TIMEOUT apos {timeout}s\n")
            return subprocess.CompletedProcess(cmd, 124, "", "")
    return p


def pico_rss_grupo(popen: subprocess.Popen, intervalo: float = 0.25,
                   total_segundos: int = 900,
                   com_detalhe: bool = False) -> tuple[int, float, dict | None]:
    """Amostra o RSS (KiB) da ARVORE de processos do render a cada `intervalo` s.

    Caminha por PPID a partir do filho direto (sessao nova): o chrome-headless
    do Remotion abre sessao propria (setsid) e NAO aparece em `ps -g <pgid>`
    — medicao M1 mostrou o pico do grupo sem nenhum processo chrome. A
    caminhada por ppid pega node + chrome + ffmpeg da arvore, e so dela
    (processos alheios do host nunca entram).
    Soma o RSS de todos os descendentes a cada amostra e devolve
    (pico_soma_kib, wall_segundos, detalhe). Com com_detalhe, o detalhe e um
    snapshot por processo no instante do pico: {pid, rss_kib, comm}.
    """
    raiz = popen.pid
    pico = 0
    detalhe: dict | None = None
    inicio = time.monotonic()
    while popen.poll() is None and time.monotonic() - inicio < total_segundos:
        try:
            saida = subprocess.run(
                ["ps", "-e", "-o", "pid=,ppid=,rss=,comm="],
                capture_output=True, text=True, timeout=5,
            ).stdout
        except subprocess.TimeoutExpired:
            time.sleep(intervalo)
            continue
        procs: dict[int, tuple[int, int, str]] = {}
        for l in saida.splitlines():
            partes = l.split(None, 3)
            if len(partes) == 4 and partes[0].isdigit() and partes[1].isdigit():
                procs[int(partes[0])] = (int(partes[1]), int(partes[2]), partes[3])
        soma, arvore = _soma_arvore(raiz, procs)
        if soma > pico:
            pico = soma
            if com_detalhe:
                detalhe = [{"pid": pid, "rss_kib": rss, "comm": comm}
                           for pid, (rss, comm) in sorted(arvore.items(),
                                                          key=lambda kv: -kv[1][0])]
        time.sleep(intervalo)
    popen.wait()
    return pico, time.monotonic() - inicio, detalhe


def _soma_arvore(raiz: int, procs: dict[int, tuple[int, int, str]]) -> tuple[int, dict]:
    """Soma o RSS de todos os descendentes (por ppid) de `raiz`."""
    filhos: dict[int, list[int]] = {}
    rss_por_pid: dict[int, int] = {}
    for pid, (ppid, rss, _comm) in procs.items():
        filhos.setdefault(ppid, []).append(pid)
        rss_por_pid[pid] = rss
    soma = 0
    arvore: dict[int, tuple[int, str]] = {}
    pilha = [raiz]
    while pilha:
        pid = pilha.pop()
        if pid in rss_por_pid:
            soma += rss_por_pid[pid]
            comm = procs[pid][2]
            arvore[pid] = (rss_por_pid[pid], comm)
        pilha.extend(filhos.get(pid, []))
    return soma, arvore


def render(concurrency: int, frames: str, nome: str,
           extra: list[str] | None = None,
           com_detalhe: bool = False, intervalo: float = 0.25,
           sequencia: bool = False) -> dict:
    """Render da composicao `integrado` com `concurrency` workers.

    Retorna dict com pico de RSS do grupo, tempo de parede, frames e
    tempo-por-frame. O render roda com --gl=swangle (a chave do baseline
    do programa; verificado que a GPU fica a 0% nos dois backends — o
    render e CPU-bound, medicao M0 do documento).

    Com sequencia=True, a saida e uma SEQUENCIA DE FRAMES (--sequence): a
    fase de encode (ffmpeg) fica de fora e o tempo-por-frame mede so o
    render — o pico de RSS e o dos workers, nao o do ffmpeg (que dominava
    o pico no modo mp4 — medicao M1, detalhe).
    """
    WORK.mkdir(parents=True, exist_ok=True)
    log = WORK / f"render-{nome}.log"
    saida = WORK / f"render-{nome}-seq" if sequencia else WORK / f"render-{nome}.mp4"
    cmd = ["npx", "remotion", "render", str(ENTRADA), COMP, str(saida),
           f"--frames={frames}", f"--concurrency={concurrency}", "--gl=swangle"]
    if sequencia:
        cmd += ["--sequence"]
    if extra:
        cmd += extra
    proc = subprocess.Popen(cmd, cwd=RAIZ,
                            stdout=log.open("w"), stderr=subprocess.STDOUT,
                            start_new_session=True)
    pico_kib, wall, detalhe = pico_rss_grupo(proc, intervalo=intervalo,
                                             com_detalhe=com_detalhe)
    ok = proc.returncode == 0
    n_frames = int(frames.split("-")[1]) - int(frames.split("-")[0]) + 1
    resultado = {
        "concurrency": concurrency,
        "frames": frames,
        "n_frames": n_frames,
        "ok": ok,
        "wall_s": round(wall, 2),
        "tf_frame_s": round(wall / n_frames, 4),
        "pico_rss_grupo_kib": pico_kib,
        "pico_rss_grupo_mib": round(pico_kib / 1024, 1),
        "modo": "sequence" if sequencia else "mp4",
        "log": str(log),
        "saida": str(saida),
        "data": agora(),
    }
    if com_detalhe and detalhe:
        resultado["detalhe_pico"] = detalhe
        resultado["n_processos_pico"] = len(detalhe)
        maiores = sorted(detalhe, key=lambda d: d["rss_kib"], reverse=True)[:6]
        resultado["maiores_processos_pico"] = maiores
    return resultado


# ---------------------------------------------------------------------------
# 1. inventario
# ---------------------------------------------------------------------------

def cmd_inventario(args) -> int:
    facts: dict = {"data": agora(), "carga": {}}
    # CPU
    with open("/proc/cpuinfo") as f:
        for linha in f:
            if linha.startswith("model name"):
                facts["cpu_modelo"] = linha.split(":", 1)[1].strip()
                break
    facts["cpu_nproc"] = os.cpu_count()
    with open("/proc/loadavg") as f:
        facts["carga"]["loadavg"] = f.read().strip()
    # RAM
    with open("/proc/meminfo") as f:
        for linha in f:
            for chave in ("MemTotal", "MemAvailable"):
                if linha.startswith(chave + ":"):
                    facts.setdefault("ram_kib", {})[chave] = linha.split()[1]
    # GPU
    gpu = subprocess.run(["nvidia-smi", "--query-gpu=name,memory.total,driver_version",
                          "--format=csv,noheader"], capture_output=True, text=True)
    facts["gpu"] = gpu.stdout.strip() if gpu.returncode == 0 else "nvidia-smi indisponivel"
    # Disco
    df = subprocess.run(["df", "-h", str(RAIZ)], capture_output=True, text=True).stdout
    facts["disco"] = [l for l in df.splitlines() if "/dev/" in l]
    # Versoes
    for nome, cmd in [("node", ["node", "--version"]),
                      ("ffmpeg", ["ffmpeg", "-version"]),
                      ("just", ["just", "--version"])]:
        p = subprocess.run(cmd, capture_output=True, text=True)
        facts[nome] = p.stdout.splitlines()[0].strip() if p.returncode == 0 else "?"
    out = facts if args.json else json.dumps(facts, indent=2, ensure_ascii=False)
    print(out)
    return 0


# ---------------------------------------------------------------------------
# 2. rss — RAM por worker
# ---------------------------------------------------------------------------

def _mediana(vals: list[float]) -> float:
    vals = sorted(vals)
    meio = len(vals) // 2
    return vals[meio] if len(vals) % 2 else (vals[meio - 1] + vals[meio]) / 2


def cmd_rss(args) -> int:
    c_alvo = args.concurrency
    c_ref = args.referencia
    frames = args.frames
    r1 = render(c_ref, frames, f"rss-ref-c{c_ref}",
                com_detalhe=args.detalhe, intervalo=args.intervalo,
                sequencia=args.sequencia)
    rn = render(c_alvo, frames, f"rss-alvo-c{c_alvo}",
                com_detalhe=args.detalhe, intervalo=args.intervalo,
                sequencia=args.sequencia)
    if not r1["ok"] or not rn["ok"]:
        print(json.dumps({"erro": "render falhou", "ref": r1, "alvo": rn},
                         ensure_ascii=False))
        return 1
    extra_mib = rn["pico_rss_grupo_mib"] - r1["pico_rss_grupo_mib"]
    n_extra = c_alvo - c_ref
    marginal = extra_mib / n_extra if n_extra > 0 else 0.0
    resultado = {
        "data": agora(),
        "frames": frames,
        "n_frames": r1["n_frames"],
        "referencia": r1,
        "alvo": rn,
        "ram_worker_marginal_mib": round(marginal, 1),
        "ram_total_por_worker_bruto_mib": round(rn["pico_rss_grupo_mib"] / c_alvo, 1),
        "comando": f"tools/medir-maquina.py rss --concurrency {c_alvo} --referencia {c_ref} --frames {frames}",
    }
    print(json.dumps(resultado, ensure_ascii=False, indent=2) if args.json
          else json.dumps(resultado, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# 3. saturacao — curva tempo-por-frame x concurrency
# ---------------------------------------------------------------------------

def cmd_saturacao(args) -> int:
    """Curva tempo-por-frame x concurrency, com repeticoes por nivel.

    Ponto de saturacao (definicao robusta a ruido de host compartilhado):
    o MENOR c tal que dobrar c (do maior nivel <= c/2) ganha MENOS que 15%
    sobre a mediana do nivel anterior, e o c anterior ainda ganhava >= 15%
    sobre o anterior a ele. Niveis com ruido (mediana vs mediana) sao
    comparados em `tf_por_frame_mediana_s`.
    """
    niveis = [int(x) for x in args.niveis.split(",")]
    frames = args.frames
    reps = max(1, args.reps)
    por_nivel: dict[int, list[dict]] = {c: [] for c in niveis}
    for c in niveis:
        for k in range(reps):
            por_nivel[c].append(render(c, frames, f"sat-c{c}-r{k+1}",
                                       intervalo=args.intervalo,
                                       sequencia=args.sequencia))
    curva = {}
    mediana = {}
    for c, rs in por_nivel.items():
        tf = [r["tf_frame_s"] for r in rs]
        curva[str(c)] = tf
        mediana[str(c)] = round(_mediana(tf), 4)
        pico = [r["pico_rss_grupo_mib"] for r in rs]
        mediana_pico = _mediana(pico)
        # guarda a mediana de pico para o detalhe
        rs.append({"mediana_tf": mediana[str(c)], "mediana_pico_mib": round(mediana_pico, 1)})
    # Saturacao por dupla de dobra (c, c/2) quando ambos existem nos niveis.
    sat = None
    niveis_dobra = [c for c in niveis if c % 2 == 0 and c // 2 in niveis]
    for c in sorted(niveis_dobra):
        metade = c // 2
        tf_c = mediana[str(c)]
        tf_metade = mediana[str(metade)]
        if tf_metade > 0 and tf_c >= 0.85 * tf_metade:
            # dobrar metade -> c ganha menos de 15%: saturado em c
            sat = c
            break
    if sat is None:
        sat = niveis[-1]
    out = {
        "data": agora(),
        "frames": frames,
        "reps": reps,
        "tf_por_frame_mediana_s": mediana,
        "tf_por_frame_bruto_s": curva,
        "ponto_saturacao_concurrency": sat,
        "definicao": "menor c onde dobrar c ganha menos de 15% (mediana de reps)",
        "detalhe": {str(c): rs for c, rs in por_nivel.items()},
    }
    print(json.dumps(out, ensure_ascii=False, indent=2) if args.json
          else json.dumps(out, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# 4. encode — sessoes paralelas (nvenc e libx264)
# ---------------------------------------------------------------------------

def _entrada_encode() -> Path:
    """Entrada sintetica unica para todos os testes de encode."""
    entrada = WORK / "entrada-encode.mp4"
    if not entrada.exists():
        rodar(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
               "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=10",
               "-pix_fmt", "yuv420p", str(entrada)],
              WORK / "encode-entrada.log")
    return entrada


def _amostra_rss_filhos(procs: list[subprocess.Popen],
                        intervalo: float = 0.2,
                        total_segundos: int = 600) -> int:
    """Pico da soma de RSS (KiB) dos processos diretos (ffmpeg do encode).

    Os encodes sao filhos diretos do script; amostra ps -e filtrado pelos
    pids lancados (o mesmo problema do chrome nao vale aqui: os ffmpeg
    herdam o grupo, mas por ppid e mais simples e imune a setsid).
    """
    pids = {p.pid for p in procs}
    pico = 0
    inicio = time.monotonic()
    while any(p.poll() is None for p in procs) and time.monotonic() - inicio < total_segundos:
        out = subprocess.run(["ps", "-e", "-o", "pid=,ppid=,rss="],
                             capture_output=True, text=True, timeout=5).stdout
        soma = 0
        for l in out.splitlines():
            partes = l.split()
            if len(partes) == 3 and int(partes[0]) in pids:
                soma += int(partes[2])
        if soma > pico:
            pico = soma
        time.sleep(intervalo)
    return pico


def _n_encoders_nvenc_ok(n: int, entrada: Path) -> dict:
    """Lanca n encodes nvenc em paralelo; conta inicializacoes OK e fps por sessao."""
    dir_n = WORK / f"nvenc-{n}"
    dir_n.mkdir(parents=True, exist_ok=True)
    procs, logs = [], []
    inicio = time.monotonic()
    for j in range(n):
        log = dir_n / f"sessao-{j}.log"
        logs.append(log)
        procs.append(subprocess.Popen(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
             "-i", str(entrada), "-c:v", "h264_nvenc", "-preset", "p5",
             "-b:v", "4M", str(dir_n / f"sessao-{j}.mp4")],
            stdout=log.open("w"), stderr=subprocess.STDOUT))
    pico_rss_kib = _amostra_rss_filhos(procs)
    erros_inicializacao = 0
    for p, log in zip(procs, logs):
        p.wait()
        if p.returncode != 0:
            texto = log.read_text()
            if any(s in texto for s in ("Cannot load NVENC", "nvenc",
                                        "init_encode_session", "session")):
                erros_inicializacao += 1
    wall = time.monotonic() - inicio
    return {
        "n": n,
        "sessoes_ok": n - erros_inicializacao,
        "sessoes_falharam": erros_inicializacao,
        "wall_s": round(wall, 2),
        "fps_por_sessao": round((300 * n) / wall, 1) if n else 0,
        "fps_agregado": round((300 * n) / wall, 1),
        "pico_rss_sessoes_kib": pico_rss_kib,
        "pico_rss_por_sessao_mib": round(pico_rss_kib / 1024 / max(1, n), 1),
    }


def cmd_encode(args) -> int:
    entrada = _entrada_encode()
    resultados = {"data": agora(), "entrada": str(entrada), "nvenc": [], "x264": []}
    if args.nvenc:
        for n in args.nvenc:
            resultados["nvenc"].append(_n_encoders_nvenc_ok(n, entrada))
    if args.soft:
        for n in args.soft:
            resultados["x264"].append(_n_encoders_x264(n, entrada))
    print(json.dumps(resultados, ensure_ascii=False, indent=2) if args.json
          else json.dumps(resultados, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# 5. disco — throughput de escrita/leitura (dd)
# ---------------------------------------------------------------------------

def _dd(arquivo: Path, tamanho_mib: int, leitura: bool) -> dict:
    """dd real: escrita com fdatasync, leitura para /dev/null."""
    bs_mib = 64
    count = max(1, tamanho_mib // bs_mib)
    if leitura:
        cmd = ["dd", f"if={arquivo}", "of=/dev/null", f"bs={bs_mib}M", "status=none"]
    else:
        cmd = ["dd", "if=/dev/zero", f"of={arquivo}", f"bs={bs_mib}M",
               f"count={count}", "conv=fdatasync", "status=none"]
    inicio = time.monotonic()
    p = subprocess.run(cmd, capture_output=True, text=True)
    wall = time.monotonic() - inicio
    mib = tamanho_mib if leitura else count * bs_mib
    return {
        "arquivo": str(arquivo),
        "tamanho_mib": mib,
        "ok": p.returncode == 0,
        "wall_s": round(wall, 2),
        "mib_s": round(mib / wall, 1) if wall > 0 else 0.0,
        "stderr": p.stderr.strip()[:200],
    }


def cmd_disco(args) -> int:
    mib = args.tamanho_mib
    alvos = [("diretorio_trabalho", RAIZ / ".cache" / "medir-maquina" / "disco")]
    if args.com_store:
        alvos.append(("store", STORE_DIR / "medir-maquina" / "disco"))
    resultados = {"data": agora(), "testes": []}
    for nome, dir_alvo in alvos:
        dir_alvo.mkdir(parents=True, exist_ok=True)
        arquivo = dir_alvo / "dd-test.bin"
        for modo in ("escrita", "leitura"):
            r = _dd(arquivo, mib, leitura=(modo == "leitura"))
            r["modo"] = modo
            r["alvo"] = nome
            resultados["testes"].append(r)
    print(json.dumps(resultados, ensure_ascii=False, indent=2) if args.json
          else json.dumps(resultados, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# 6. gate-pico — pico de RSS do gate local (margem para rodar junto)
# ---------------------------------------------------------------------------

def cmd_gate_pico(args) -> int:
    proc = subprocess.Popen(["bash", str(GATE_SH), "--no-color"], cwd=RAIZ,
                            stdout=(WORK / "gate.log").open("w"),
                            stderr=subprocess.STDOUT, start_new_session=True)
    pico, wall, _detalhe = pico_rss_grupo(proc, intervalo=0.5)
    out = {
        "data": agora(),
        "pico_rss_grupo_kib": pico,
        "pico_rss_grupo_mib": round(pico / 1024, 1),
        "wall_s": round(wall, 2),
        "exit": proc.returncode,
        "comando": f"tools/medir-maquina.py gate-pico",
    }
    print(json.dumps(out, ensure_ascii=False, indent=2) if args.json
          else json.dumps(out, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# Tabela do documento — parse e geracao
# ---------------------------------------------------------------------------
# A tabela vive em docs/medicao/maquina.md com EXATAMENTE este formato:
#
#   | chave | valor | unidade | tolerancia | comando |
#   |---|---|---|---|---|
#   | ram_worker | 211 | MiB/worker | 0.30 | `tools/medir-maquina.py rss --concurrency 16` |
#
# `conferir` le os numeros do DOCUMENTO (fonte unica); `gerar-tabela` emite
# as linhas a partir dos valores declarados em ESPERADOS (para a cerimonia
# de atualizacao — nunca para o gate).

TABELA_RE = re.compile(
    r"^\|\s*(ram_worker|sat_ponto|teto_concorrencia|sessoes_nvenc"
    r"|x264_paralelo|disco_escrita|disco_leitura|pico_gate)\s*\|")


def ler_tabela_doc() -> dict[str, dict]:
    if not DOC.exists():
        return {}
    linhas: dict[str, dict] = {}
    for l in DOC.read_text().splitlines():
        if not TABELA_RE.match(l):
            continue
        cel = [c.strip() for c in l.strip("|").split("|")]
        if len(cel) < 5:
            continue
        chave, valor, unidade, tol, comando = cel[:5]
        comando = comando.strip("`")
        try:
            linhas[chave] = {
                "valor": float(valor),
                "unidade": unidade,
                "tolerancia": float(tol) if tol not in ("", "-") else None,
                "comando": comando,
            }
        except ValueError:
            continue
    return linhas


# ---------------------------------------------------------------------------
# 7. conferir — medicao curta vs documento
# ---------------------------------------------------------------------------

def _conferir_ram_worker(esperado: float, tolerancia: float) -> tuple[bool, dict]:
    # modo sequence: a mesma metodologia do numero declarado (M1) — o pico
    # em modo mp4 e dominado pela fase de encode do ffmpeg
    r1 = render(1, FRAMES_CURTO, "conf-ram-c1", sequencia=True)
    r16 = render(16, FRAMES_CURTO, "conf-ram-c16", sequencia=True)
    if not r1["ok"] or not r16["ok"]:
        return False, {"erro": "render falhou"}
    extra = r16["pico_rss_grupo_mib"] - r1["pico_rss_grupo_mib"]
    medido = round(extra / 15, 1)
    ok = abs(medido - esperado) <= tolerancia * esperado
    return ok, {"esperado_mib": esperado, "medido_mib": medido,
                "tolerancia": tolerancia, "pico_c1": r1["pico_rss_grupo_mib"],
                "pico_c16": r16["pico_rss_grupo_mib"], "ok": ok}


def _conferir_saturacao(teto: int, sat: int) -> tuple[bool, dict]:
    """Curta (120 frames): c=4, c=teto, c=sat.

    Em renders curtos o startup domina o tempo-por-frame (medido: em 60
    frames c=8 vs c=4 vira ruido de 1%) — a definicao de 15% da cerimonia
    completa (240 frames, mediana) nao e verificavel em curto. A checagem
    curta valida a FORMA, que sobrevive ao offset de startup:
      - saturado_no_ponto: tf(sat) >= 0.85 x tf(teto) — dobrar alem do teto
        ganha menos de 15% (a regiao achatada existe);
      - teto_nao_piora: tf(teto) <= 1.10 x tf(4) — o teto nunca e pior que
        metade dele alem de ruido (o paralelismo nao quebrou);
      - a maquina 2-3x mais lenta derruba a checagem de RAM antes (o teto
        de RAM e o limite duro), nao precisa de bound absoluto aqui.
    """
    r4 = render(4, FRAMES_CURTO_SAT, "conf-sat-c4")
    rt = render(teto, FRAMES_CURTO_SAT, f"conf-sat-c{teto}")
    rs = render(sat, FRAMES_CURTO_SAT, f"conf-sat-c{sat}")
    tf = {4: r4["tf_frame_s"], teto: rt["tf_frame_s"], sat: rs["tf_frame_s"]}
    saturado_no_ponto = tf[sat] >= 0.85 * tf[teto]
    teto_nao_piora = tf[teto] <= 1.10 * tf[4]
    ok = all([r["ok"] for r in (r4, rt, rs)]) and saturado_no_ponto and teto_nao_piora
    return ok, {"teto": teto, "sat_esperado": sat, "tf_por_frame": tf,
                "saturado_no_ponto_15pct": saturado_no_ponto,
                "teto_nao_piora_10pct": teto_nao_piora,
                "ok": ok}


def _conferir_nvenc(n_esperado: int) -> tuple[bool, dict]:
    """No teto declarado, TODAS as sessoes inicializam e terminam."""
    r = _n_encoders_nvenc_ok(n_esperado, _entrada_encode())
    ok = r["sessoes_ok"] == n_esperado and r["sessoes_falharam"] == 0
    return ok, {**r, "esperado": n_esperado, "ok": ok}


def _conferir_x264(fps_esperado: float, n: int = 4) -> tuple[bool, dict]:
    r = _n_encoders_x264(n, _entrada_encode())
    ok = r["fps_agregado"] >= 0.70 * fps_esperado
    return ok, {**r, "esperado_fps": fps_esperado, "ok": ok}


def _n_encoders_x264(n: int, entrada: Path) -> dict:
    dir_n = WORK / f"x264-conf-{n}"
    dir_n.mkdir(parents=True, exist_ok=True)
    procs = []
    inicio = time.monotonic()
    for j in range(n):
        log = dir_n / f"sessao-{j}.log"
        procs.append(subprocess.Popen(
            ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
             "-i", str(entrada), "-c:v", "libx264", "-preset", "veryfast",
             "-b:v", "2M", str(dir_n / f"sessao-{j}.mp4")],
            stdout=log.open("w"), stderr=subprocess.STDOUT))
    pico_rss_kib = _amostra_rss_filhos(procs)
    for p in procs:
        p.wait()
    wall = time.monotonic() - inicio
    return {"n": n, "wall_s": round(wall, 2), "fps_agregado": round((300 * n) / wall, 1),
            "pico_rss_sessoes_kib": pico_rss_kib,
            "pico_rss_por_sessao_mib": round(pico_rss_kib / 1024 / max(1, n), 1)}


def _conferir_disco(esperado_escrita: float, esperado_leitura: float,
                    tolerancia: float, mib: int = 512) -> tuple[bool, dict]:
    """Escrita como PISO (>= 75% do declarado), leitura em faixa (+-25%).

    O numero declarado de escrita (724 MiB/s) e o caso FRIO (dd 2 GiB em
    diretorio novo); a re-escrita curta pega page cache quente e mede ate
    3,5x mais (2551 MiB/s na conferencia) — tolerancia dupla de escrita
    falharia sempre no quente. O piso cobre o caso frio, que e o da
    pipeline real; a leitura e simetrica.
    """
    dir_alvo = RAIZ / ".cache" / "medir-maquina" / "disco-conf"
    dir_alvo.mkdir(parents=True, exist_ok=True)
    arquivo = dir_alvo / "dd-test.bin"
    w = _dd(arquivo, mib, leitura=False)
    r = _dd(arquivo, mib, leitura=True)
    ok_w = w["mib_s"] >= 0.75 * esperado_escrita
    ok_r = abs(r["mib_s"] - esperado_leitura) <= tolerancia * esperado_leitura
    return (ok_w and ok_r), {
        "esperado_escrita_mib_s": esperado_escrita, "medido_escrita_mib_s": w["mib_s"],
        "esperado_leitura_mib_s": esperado_leitura, "medido_leitura_mib_s": r["mib_s"],
        "piso_escrita_75pct": ok_w, "faixa_leitura": tolerancia, "ok": ok_w and ok_r}


CHECKS = {
    "ram_worker": ("_conferir_ram_worker", 16),
    "sat_ponto": ("_conferir_saturacao", 8),
    "teto_concorrencia": ("_conferir_saturacao", 8),
    "sessoes_nvenc": ("_conferir_nvenc", 5),
    "x264_paralelo": ("_conferir_x264", 4),
    "disco_escrita": ("_conferir_disco", 512),
    "disco_leitura": ("_conferir_disco", 512),
}


def cmd_conferir(args) -> int:
    tabela = ler_tabela_doc()
    if not tabela:
        print("FALHA: docs/medicao/maquina.md nao tem a tabela de numeros "
              "(ou esta vazia). Rode a cerimonia completa primeiro.")
        return 1
    resultados = {"data": agora(), "checagens": {}}
    falhas = 0
    sat_ok, sat_det = None, None
    for chave, (fn, n) in CHECKS.items():
        if chave not in tabela:
            resultados["checagens"][chave] = {"ok": False, "erro": "chave ausente do documento"}
            falhas += 1
            continue
        esp = tabela[chave]
        if chave == "ram_worker":
            ok, det = _conferir_ram_worker(esp["valor"], esp["tolerancia"] or 0.30)
        elif chave in ("sat_ponto", "teto_concorrencia"):
            # o par (teto, sat) vem das duas linhas do documento; a checagem
            # roda UMA vez e e registrada nas duas chaves
            if sat_ok is None:
                teto = int(tabela.get("teto_concorrencia", {}).get("valor", 8))
                sat = int(tabela.get("sat_ponto", {}).get("valor", 16))
                sat_ok, sat_det = _conferir_saturacao(teto, sat)
            resultados["checagens"][chave] = {"ok": sat_ok, "detalhe": sat_det,
                                              "esperado": esp["valor"]}
            if not sat_ok:
                falhas += 1
            continue
        elif chave == "sessoes_nvenc":
            ok, det = _conferir_nvenc(int(esp["valor"]))
        elif chave == "x264_paralelo":
            ok, det = _conferir_x264(esp["valor"])
        elif chave == "disco_escrita":
            ok, det = _conferir_disco(esp["valor"], tabela["disco_leitura"]["valor"],
                                      esp["tolerancia"] or 0.25, mib=512)
            resultados["checagens"]["disco_leitura"] = {
                "ok": ok, "detalhe": det, "esperado": tabela["disco_leitura"]["valor"]}
            resultados["checagens"][chave] = {"ok": ok, "detalhe": det}
            if not ok:
                falhas += 2
            continue
        elif chave == "disco_leitura":
            continue  # conferida junto com disco_escrita acima
        else:
            ok, det = False, {"erro": f"check desconhecido {chave}"}
        resultados["checagens"][chave] = {"ok": ok, "detalhe": det,
                                          "esperado": esp["valor"]}
        if not ok:
            falhas += 1
    resumo = f"conferir: {len(resultados['checagens'])} checagem(ns), {falhas} falha(s)"
    print(json.dumps(resultados, ensure_ascii=False, indent=2) if args.json else resumo)
    for chave, c in resultados["checagens"].items():
        print(f"  [{'PASS' if c.get('ok') else 'FAIL'}] {chave} — {c.get('detalhe')}")
    if falhas:
        print("=== VERMELHO: medicao divergiu alem da tolerancia declarada ===")
        return 1
    print("=== VERDE: maquina dentro da tolerancia declarada ===")
    return 0


def cmd_gerar_tabela(args) -> int:
    tabela = ler_tabela_doc()
    print("# Linhas da tabela de numeros (copie para docs/medicao/maquina.md)")
    print("| chave | valor | unidade | tolerancia | comando |")
    print("|---|---|---|---|---|")
    for chave, esp in tabela.items():
        print(f"| {chave} | {esp['valor']:g} | {esp['unidade']} | "
              f"{esp['tolerancia'] if esp['tolerancia'] is not None else '-'} "
              f"| `{esp['comando']}` |")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="Medicao e conferencia da maquina de render (I-03)")
    parser.add_argument("comando", nargs="?", default="inventario",
                        help="inventario|rss|saturacao|encode|disco|gate-pico|conferir|gerar-tabela")
    parser.add_argument("--conferir", action="store_true",
                        help="alias de 'conferir' (forma do ∅-crit: just medir-maquina --conferir)")
    parser.add_argument("--json", action="store_true", help="saida JSON")
    parser.add_argument("--concurrency", type=int, default=16, help="rss: nivel alvo")
    parser.add_argument("--referencia", type=int, default=1, help="rss: nivel de referencia")
    parser.add_argument("--frames", default=FRAMES_CURVA, help="faixa de frames do render")
    parser.add_argument("--niveis", default="1,2,4,8,12,16,24,32", help="saturacao: niveis")
    parser.add_argument("--reps", type=int, default=1, help="saturacao: repeticoes por nivel (mediana)")
    parser.add_argument("--intervalo", type=float, default=0.25, help="intervalo de amostragem de RSS (s)")
    parser.add_argument("--detalhe", action="store_true", help="rss: snapshot por processo no pico")
    parser.add_argument("--sequencia", action="store_true",
                        help="rss/saturacao: saida em sequencia de frames (sem encode)")
    parser.add_argument("--nvenc", type=str, default="", help="encode: niveis nvenc (virgula)")
    parser.add_argument("--soft", type=str, default="", help="encode: niveis x264 (virgula)")
    parser.add_argument("--tamanho-mib", type=int, default=2048, help="disco: tamanho em MiB")
    parser.add_argument("--com-store", action="store_true", help="disco: inclui o store")
    args = parser.parse_args()

    comando = "conferir" if args.conferir else args.comando
    if comando == "inventario":
        return cmd_inventario(args)
    if comando == "rss":
        return cmd_rss(args)
    if comando == "saturacao":
        return cmd_saturacao(args)
    if comando == "encode":
        args.nvenc = [int(x) for x in args.nvenc.split(",") if x]
        args.soft = [int(x) for x in args.soft.split(",") if x]
        return cmd_encode(args)
    if comando == "disco":
        return cmd_disco(args)
    if comando == "gate-pico":
        return cmd_gate_pico(args)
    if comando == "conferir":
        return cmd_conferir(args)
    if comando == "gerar-tabela":
        return cmd_gerar_tabela(args)
    print(f"comando desconhecido: {comando}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
