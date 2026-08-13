#!/usr/bin/env python3
"""Runner headless do Manim -- o unico lugar deste repositorio que executa o Manim.

Card F2-02 (W4). Recebe UM job em JSON e devolve UM resultado em JSON na
ultima linha de stdout. Nao imprime nada mais em stdout (o Manim escreve em
stderr, e o que ele escreve fica em stderr).

Uso:
    python3 src/resolucao/grafico/manim/runner.py <job.json>

Por que um processo por cena e nao um servico: `docs/reuso-3b1b.md` item 2.16.
O projeto de origem virou um FastAPI + tunel cujo teto de request do tunel
(~100 s) era MENOR que o `render_timeout` do servidor (120 s) -- abrindo uma
janela em que o servidor renderiza para ninguem. Aqui o Manim entra como
processo, termina, e o resultado e um hash.

O que este runner recusa a fazer, e por que:

  * Nao "conserta" a saida do Manim. Todo conserto e do lado da ENTRADA
    (quirks.preparar_cena), antes do subprocesso. Consertar a saida faria o
    cassete gravado ser um sucessor, e nao um sosia, da execucao real.
  * Nao aceita `manim` de versao diferente da declarada em `versaoManim`.
    A versao do gerador vai DENTRO dos bytes do video (o container carrega
    `comment=Rendered with Manim Community v0.20.1`): trocar de versao troca
    o hash em silencio. C12.
  * Nao aceita muxer de versao diferente da declarada em `versaoMuxer`.
    Mesmo motivo: o container carrega `encoder=LavfXX.YY.ZZ`.
  * Nao confia no codigo de saida do Manim. C1: "exit 0 de um render nao
    prova que saiu imagem". O runner decodifica frames e exige conteudo.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from quirks import EQuirkDeCodigo, descobrir_video, preparar_cena  # noqa: E402

# ---------------------------------------------------------------------------
# Codigos de erro -- estaveis, consumidos pelo executor TypeScript
# ---------------------------------------------------------------------------

E_MOTOR_AUSENTE = "EMOTOR_AUSENTE"
E_VERSAO_DIVERGENTE = "EVERSAO_DIVERGENTE"
E_CENA_INVALIDA = "ECENA_INVALIDA"
E_RENDER_FALHOU = "ERENDER_FALHOU"
E_SAIDA_VAZIA = "ESAIDA_VAZIA"
E_JOB_INVALIDO = "EJOB_INVALIDO"

# Desvio-padrao minimo (em cinza, 0..255) para um frame contar como "tem
# conteudo". Um quadro chapado -- preto, branco ou fundo solido -- da 0.0.
# Medido: o frame 0 de um render real do Manim da EXATAMENTE 0.0 (a cena
# comeca vazia), e os seguintes dao ~20. Por isso a checagem varre varios
# frames e nao aceita "o primeiro deu certo".
DESVIO_MINIMO_DE_CONTEUDO = 1.0

# Quantos frames decodificar na checagem de conteudo.
FRAMES_INSPECIONADOS = 12

FLAG_TRANSPARENTE = "-t"

# Escapes ANSI que o `rich` do Manim injeta em toda saida, inclusive --version.
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


# Ver a nota de N818 em quirks.py: prefixo `E`, convencao do repositorio.
class EFalhaDeRender(RuntimeError):  # noqa: N818
    """Erro do runner, com codigo estavel."""

    def __init__(self, codigo: str, mensagem: str, detalhe: str = "") -> None:
        super().__init__(mensagem)
        self.codigo = codigo
        self.mensagem = mensagem
        self.detalhe = detalhe


# ---------------------------------------------------------------------------
# Motor
# ---------------------------------------------------------------------------


def _comando_do_manim() -> list[str]:
    """Descobre como invocar o Manim.

    `MANIM_BIN` existe para a GRAVACAO do cassete, que roda a mao: aponta
    para o interpretador de um ambiente que tem o Manim. Nao ha deteccao
    automatica nem fallback silencioso -- motor ausente e erro, nunca
    "renderiza de outro jeito".
    """
    binario = os.environ.get("MANIM_BIN", "").strip()
    if binario:
        caminho = Path(binario)
        if not caminho.exists():
            raise EFalhaDeRender(
                E_MOTOR_AUSENTE, f"MANIM_BIN aponta para {binario}, que nao existe"
            )
        # Um interpretador Python roda `-m manim`; o executavel `manim` roda direto.
        if caminho.name.startswith("python"):
            return [str(caminho), "-m", "manim"]
        return [str(caminho)]

    achado = shutil.which("manim")
    if achado:
        return [achado]

    # Mesmo motor, outra porta de entrada: quando este runner ja roda no
    # interpretador que tem o Manim (o caso da gravacao com PYTHON_BIN), o
    # console script pode nao estar no PATH. Isto NAO e fallback para outro
    # renderizador -- e o mesmo Manim, invocado por `-m`.
    if importlib.util.find_spec("manim") is not None:
        return [sys.executable, "-m", "manim"]

    raise EFalhaDeRender(
        E_MOTOR_AUSENTE,
        "Manim nao encontrado: nem `manim` no PATH, nem MANIM_BIN definido. "
        "Este estagio NAO renderiza de outro jeito: um motor grafico ausente "
        "que degrada em silencio produz video sem grafico com exit 0 (C1).",
    )


def _versao_do_manim(comando: list[str]) -> str:
    saida = subprocess.run(  # noqa: S603
        [*comando, "--version"],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    # O Manim imprime a versao COLORIDA (rich), e o `v0.` fica separado do
    # `20.1` por escapes ANSI: "Manim Community \x1b[32mv0.\x1b[0m\x1b[32m20.1".
    # Um parser ingenuo le "0." e "20.1" como dois tokens e conclui "versao
    # ilegivel" — que aponta para o lugar errado. Tirar o ANSI primeiro.
    texto = ANSI.sub("", f"{saida.stdout}\n{saida.stderr}")
    achado = re.search(r"\bv?(\d+\.\d+\.\d+)\b", texto)
    if achado:
        return achado.group(1)
    raise EFalhaDeRender(
        E_MOTOR_AUSENTE,
        "nao foi possivel ler a versao do Manim",
        texto.strip()[:400],
    )


def _versao_do_muxer() -> str:
    """Versao do libavformat que ESCREVE o container.

    Nao e o `ffmpeg` do PATH: o Manim CE muxa por PyAV, que embute a propria
    libavformat. O valor devolvido aqui e literalmente o que aparece na tag
    `encoder` do arquivo produzido (`Lavf62.12.102`), e portanto muda o hash
    do asset. Ele existe em `parametros` por isso.
    """
    try:
        import av  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - so ocorre sem Manim
        raise EFalhaDeRender(
            E_MOTOR_AUSENTE, "PyAV ausente (vem junto com o Manim CE)", str(exc)
        ) from exc
    maior, menor, micro = av.library_versions["libavformat"]
    return f"Lavf{maior}.{menor}.{micro}"


# ---------------------------------------------------------------------------
# Conteudo do render -- a defesa contra C1
# ---------------------------------------------------------------------------


def _inspecionar_conteudo(caminho: Path) -> dict[str, Any]:
    """Decodifica frames e mede conteudo. C1: exit 0 nao prova imagem.

    Devolve contagem de frames, dimensoes e o maior desvio-padrao observado.
    Quem decide o veredito e `_exigir_conteudo`, com o denominador a vista.
    """
    import av  # noqa: PLC0415

    with av.open(str(caminho)) as container:
        fluxo = container.streams.video[0]
        largura, altura = fluxo.width, fluxo.height
        frames_declarados = fluxo.frames
        desvios: list[float] = []
        for indice, frame in enumerate(container.decode(video=0)):
            desvios.append(float(frame.to_ndarray(format="gray").std()))
            if indice + 1 >= FRAMES_INSPECIONADOS:
                break

    return {
        "largura": largura,
        "altura": altura,
        "framesDeclarados": frames_declarados,
        "framesInspecionados": len(desvios),
        "desvioMaximo": max(desvios) if desvios else 0.0,
        "framesChapados": sum(1 for d in desvios if d <= DESVIO_MINIMO_DE_CONTEUDO),
    }


def _exigir_conteudo(caminho: Path, medida: dict[str, Any]) -> None:
    if medida["framesInspecionados"] == 0:
        raise EFalhaDeRender(
            E_SAIDA_VAZIA,
            f"{caminho.name} nao tem frame decodificavel (0 frames). "
            "O Manim saiu com codigo 0 e nao escreveu imagem (C1).",
        )
    if medida["desvioMaximo"] <= DESVIO_MINIMO_DE_CONTEUDO:
        raise EFalhaDeRender(
            E_SAIDA_VAZIA,
            f"{caminho.name} tem {medida['framesInspecionados']} frame(s) e TODOS "
            f"sao chapados (desvio maximo {medida['desvioMaximo']:.3f} <= "
            f"{DESVIO_MINIMO_DE_CONTEUDO}). Quadro preto tambem sai com codigo 0.",
        )


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------


def _montar_comando(
    manim: list[str],
    script: Path,
    media_dir: Path,
    nome_cena: str,
    job: dict[str, Any],
) -> list[str]:
    """Monta a linha de comando do render.

    `--write_to_movie` e FIXO (docs/reuso-3b1b.md item 2.9, origem
    manim-api/services/manim_executor.py:233): sem ele o renderer OpenGL
    executa as animacoes e nao escreve arquivo, e o erro que aparece aponta
    para a camada errada ("video nao encontrado", em vez de "nada foi
    escrito").

    `--disable_caching` NAO limpa cache -- o proprio help do Manim diz "still
    generates cache files" (AGENTS.md, armadilhas de dominio). Ele esta aqui
    para nao REUSAR cache entre execucoes, que e o que interessa para o hash
    ser funcao da cena.

    Nada de insercao posicional de flag (item 2.19 IGNORAR): o renderer
    cairo e fixo e a lista e montada de uma vez.
    """
    comando = [
        *manim,
        "render",
        "-r",
        f"{job['larguraPx']},{job['alturaPx']}",
        "--fps",
        str(job["fps"]),
        "--media_dir",
        str(media_dir),
        "--disable_caching",
        "--write_to_movie",
    ]
    if job["fundoTransparente"]:
        # `-t` sozinho NAO produz WebM com alfa: produz .mov com qtrle/argb
        # (verificado com ffprobe: codec_name=qtrle, pix_fmt=argb). WebM com
        # alfa exige `--format=webm` junto. AGENTS.md, armadilhas de dominio.
        comando.append(FLAG_TRANSPARENTE)
    if job["formato"] == "webm":
        comando.append("--format=webm")
    comando.extend([str(script), nome_cena])
    return comando


def executar(job: dict[str, Any]) -> dict[str, Any]:
    trabalho = Path(job["diretorioTrabalho"])
    trabalho.mkdir(parents=True, exist_ok=True)

    try:
        cena = preparar_cena(job["codigo"])
    except EQuirkDeCodigo as exc:
        raise EFalhaDeRender(E_CENA_INVALIDA, str(exc)) from exc

    manim = _comando_do_manim()

    versao = _versao_do_manim(manim)
    if versao != job["versaoManim"]:
        raise EFalhaDeRender(
            E_VERSAO_DIVERGENTE,
            f"o Manim instalado e {versao} e o parametro declara "
            f"{job['versaoManim']}. A versao do gerador vai dentro dos bytes do "
            "video, entao renderizar assim mudaria o hash do asset sem mudar a "
            "chave de cache (C12). Bumpe `versaoManim` em "
            "src/resolucao/grafico/estagio.ts e regrave o cassete.",
        )

    muxer = _versao_do_muxer()
    if muxer != job["versaoMuxer"]:
        raise EFalhaDeRender(
            E_VERSAO_DIVERGENTE,
            f"o muxer local escreve {muxer} e o parametro declara "
            f"{job['versaoMuxer']}. O container carrega a tag `encoder=<muxer>`, "
            "entao o hash do asset mudaria em silencio. Bumpe `versaoMuxer` e "
            "regrave o cassete.",
        )

    script = trabalho / "cena.py"
    media_dir = trabalho / "media"
    script.write_text(cena.codigo, encoding="utf-8")

    comando = _montar_comando(manim, script, media_dir, cena.nome_cena, job)
    execucao = subprocess.run(  # noqa: S603
        comando,
        capture_output=True,
        text=True,
        timeout=int(job.get("timeoutSegundos", 600)),
        check=False,
        cwd=str(trabalho),
    )
    if execucao.returncode != 0:
        raise EFalhaDeRender(
            E_RENDER_FALHOU,
            f"manim render saiu com codigo {execucao.returncode}",
            (execucao.stderr or execucao.stdout)[-2000:],
        )

    try:
        video = descobrir_video(media_dir, cena.nome_cena, job["formato"])
    except EQuirkDeCodigo as exc:
        raise EFalhaDeRender(E_SAIDA_VAZIA, str(exc), (execucao.stderr or "")[-2000:]) from exc

    dados = video.read_bytes()
    medida = _inspecionar_conteudo(video)
    _exigir_conteudo(video, medida)

    return {
        "ok": True,
        "hash": hashlib.sha256(dados).hexdigest(),
        "bytes": len(dados),
        "largura": medida["largura"],
        "altura": medida["altura"],
        "framesDeclarados": medida["framesDeclarados"],
        "framesInspecionados": medida["framesInspecionados"],
        "framesChapados": medida["framesChapados"],
        "desvioMaximo": round(medida["desvioMaximo"], 6),
        "nomeCena": cena.nome_cena,
        "correcoes": cena.correcoes,
        "ferramenta": f"manim {versao}",
        "muxer": muxer,
        "comando": comando,
        "arquivo": str(video),
    }


def _responder(carga: dict[str, Any]) -> None:
    """Uma unica linha de JSON em stdout. Tudo o mais do runner vai para stderr."""
    print(json.dumps(carga), flush=True)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        _responder({"ok": False, "codigo": E_JOB_INVALIDO, "mensagem": "uso: runner.py <job.json>"})
        return 2
    try:
        job = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        _responder({"ok": False, "codigo": E_JOB_INVALIDO, "mensagem": str(exc)})
        return 2

    try:
        resultado = executar(job)
    except EFalhaDeRender as exc:
        _responder(
            {
                "ok": False,
                "codigo": exc.codigo,
                "mensagem": exc.mensagem,
                "detalhe": exc.detalhe,
            }
        )
        return 1

    _responder(resultado)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
