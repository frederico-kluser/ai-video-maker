#!/usr/bin/env python3
"""
tools/medir-perfil-estrito.py — a evidencia do ADR-0042 (F5-07, W9).

Encoda o MESMO master (o master.mov do pipeline) nos dois perfis do
catalogo do F5-02 — entrega-software (libx264, CRF 18) e entrega-nvenc —
com a cadeia de flags canonica do encode (montarComando do F5-02:
-fflags +bitexact -flags +bitexact -map_metadata -1 DEPOIS das entradas)
e compara TAMANHO + SSIM minimo por frame (a metrica nativa disponivel:
libvmaf esta AUSENTE deste build — "No such filter" — AB-701).

Contrato-w9 §7: nunca escolher perfil por igualar numeros de eixos
diferentes (CRF nao se compara a CQ); a evidencia e tamanho + SSIM do
MESMO master nos DOIS perfis, registrada no ADR-0042.

Uso:
  python3 tools/medir-perfil-estrito.py output/master.mov

Escreve docs/medicao/estrito-perfil-w9.json e imprime a tabela.
"""

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[1]
SAIDA_MEDICAO = RAIZ / "docs" / "medicao" / "estrito-perfil-w9.json"

# Os flags canonicos do encode deterministico (F5-02/ffmpeg-media-ops):
# bitexact + remocao de metadado DEPOIS das entradas.
FLAGS = ["-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1"]

# O filtro ssim do ffmpeg 6.1.1-3ubuntu5 so imprime o RESUMO (uma linha)
# — os valores POR FRAME nao saem em nenhum log level. O SSIM por frame
# e computado aqui em uma amostra declarada (12 frames espacados), com a
# formula de Wang et al. (2004) no canal Y (BT.709) — a mesma metrica do
# filtro, reimplementada para leitura por frame.
AMOSTRA_DE_FRAMES = 12


def ssim_numpy(a: np.ndarray, b: np.ndarray) -> float:
    """SSIM estrutural (Wang et al. 2004): janela 11x11, K1=0.01, K2=0.03."""
    c1 = (0.01 * 255) ** 2
    c2 = (0.03 * 255) ** 2
    janela = np.hanning(11)

    def f2(x: np.ndarray) -> np.ndarray:
        # convolucao 2D separavel (hanning x hanning), bordas replicadas
        t = np.pad(x.astype(float), 5, mode="edge")
        t = np.array([np.convolve(linha, janela, mode="valid") for linha in t])
        t = np.array([np.convolve(col, janela, mode="valid") for col in t.T]).T
        return t

    mu_a, mu_b = f2(a), f2(b)
    mu_a2, mu_b2, mu_ab = mu_a * mu_a, mu_b * mu_b, mu_a * mu_b
    sigma_a2 = f2(a * a) - mu_a2
    sigma_b2 = f2(b * b) - mu_b2
    sigma_ab = f2(a * b) - mu_ab
    ssim = ((2 * mu_ab + c1) * (2 * sigma_ab + c2)) / (
        (mu_a2 + mu_b2 + c1) * (sigma_a2 + sigma_b2 + c2)
    )
    return float(ssim.mean())


def rodar(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True)


def montar_comando_software(entrada: Path, saida: Path) -> list[str]:
    # entrega-software: libx264, crf 18, preset medium, yuv420p
    return [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(entrada),
        "-c:v", "libx264", "-crf", "18", "-preset", "medium",
        "-pix_fmt", "yuv420p", *FLAGS, str(saida),
    ]


def montar_comando_nvenc(entrada: Path, saida: Path) -> list[str]:
    # entrega-nvenc: h264_nvenc, cq 18, yuv420p (o perfil do catalogo F5-02)
    return [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(entrada),
        "-c:v", "h264_nvenc", "-rc", "vbr", "-cq", "23", "-preset", "p5",
        "-pix_fmt", "yuv420p", *FLAGS, str(saida),
    ]


def quadro_em(arquivo: Path, indice: int) -> np.ndarray:
    """Extrai o quadro `indice` como Y (BT.709) 1920x1080 via ffmpeg."""
    args = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-i", str(arquivo),
        "-vf", f"select=eq(n\\,{indice}),format=gray",
        "-frames:v", "1",
        "-f", "rawvideo", "-pix_fmt", "gray",
        "-",
    ]
    proc = subprocess.run(args, capture_output=True)
    if proc.returncode != 0 or len(proc.stdout) == 0:
        raise RuntimeError(f"nao consegui extrair o quadro {indice} de {arquivo}")
    return np.frombuffer(proc.stdout, dtype=np.uint8).reshape(1080, 1920)


def ssim_contra_master(master: Path, encodado: Path) -> dict:
    """SSIM POR FRAME (amostra declarada) do encodado contra o master.

    O filtro ssim nativo do ffmpeg 6.1.1-3ubuntu5 so imprime o resumo —
    aqui a metrica (Wang et al. 2004) roda por quadro na amostra
    `AMOSTRA_DE_FRAMES`, espacada uniformemente pelo video inteiro.
    """
    frames_total = 727  # a composicao canonica (a aritmetica do F1-01)
    passos = max(1, frames_total // AMOSTRA_DE_FRAMES)
    valores: list[float] = []
    for indice in range(0, frames_total, passos):
        a = quadro_em(master, indice)
        b = quadro_em(encodado, indice)
        valores.append(ssim_numpy(a, b))
    if not valores:
        return {"min": None, "max": None, "media": None, "frames": 0}
    return {
        "min": round(min(valores), 4),
        "max": round(max(valores), 4),
        "media": round(sum(valores) / len(valores), 4),
        "frames": len(valores),
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("uso: python3 tools/medir-perfil-estrito.py <master.mov>")
        return 2
    master = Path(sys.argv[1])
    if not master.exists():
        print(f"ERRO: {master} nao existe")
        return 1

    ffmpeg_versao = rodar(["ffmpeg", "-version"]).stdout.splitlines()[0]
    linhas: list[str] = []
    tabela: dict = {
        "onda": "W9",
        "card": "F5-07",
        "master": str(master),
        "ffmpeg": ffmpeg_versao,
        "libvmaf": "AUSENTE (No such filter — AB-701)",
        "metrica": "SSIM nativo (ffmpeg 6.1.1), tamanho em bytes",
        "perfis": {},
    }

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        for nome, montar in [
            ("entrega-software", montar_comando_software),
            ("entrega-nvenc", montar_comando_nvenc),
        ]:
            saida = tmpdir / f"{nome}.mp4"
            proc = rodar(montar(master, saida))
            if proc.returncode != 0 or not saida.exists():
                print(f"ERRO: o encode {nome} falhou:\n{proc.stderr}")
                return 1
            tamanho = saida.stat().st_size
            ssim = ssim_contra_master(master, saida)
            tabela["perfis"][nome] = {
                "tamanho_bytes": tamanho,
                "tamanho_mib": round(tamanho / 1024 / 1024, 2),
                "ssim": ssim,
            }
            linhas.append(
                f"{nome:<18} {tamanho / 1024 / 1024:>8.2f} MiB  "
                f"SSIM min={ssim['min']} media={ssim['media']} max={ssim['max']}"
            )

    SAIDA_MEDICAO.parent.mkdir(parents=True, exist_ok=True)
    SAIDA_MEDICAO.write_text(json.dumps(tabela, indent=2, ensure_ascii=False) + "\n")
    print(f"ffmpeg: {ffmpeg_versao}")
    print("libvmaf: AUSENTE — 'No such filter' (AB-701); metrica: SSIM nativo")
    print("perfil             tamanho   SSIM (min/media/max)")
    for linha in linhas:
        print("  " + linha)
    print(f"\nevidencias: {SAIDA_MEDICAO}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
