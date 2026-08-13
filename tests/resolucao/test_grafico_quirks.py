"""Oraculo dos quirks do Manim absorvidos do 3blue1brown. Card F2-02 (W4).

Cada teste aqui exige que UM quirk continue sendo aplicado. Eles existem
porque os tres erros que `sanear_codigo` corrige sao invisiveis na leitura:
o codigo com `CYAN` e sintaticamente perfeito, passa em qualquer linter, e
so estoura dentro do subprocesso de render com um `NameError` que nao
menciona cor.

Nenhum teste deste arquivo precisa do Manim instalado, com uma excecao
explicitamente marcada (`@pytest.mark.manim`): a sonda empirica que confirma
que `CYAN` de fato NAO existe no namespace de `from manim import *`. Sem o
Manim ela e reportada como SKIPPED pelo pytest -- nao como verde.

Fonte de tudo que e afirmado sobre o projeto de origem:
`/home/ondokai/Projects/3blue1brown/`, com `arquivo:linha` em quirks.py.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "src" / "resolucao" / "grafico" / "manim"))

from quirks import (  # noqa: E402
    COLOR_FALLBACKS,
    DANGEROUS_FUNCTIONS,
    DANGEROUS_IMPORTS,
    EQuirkDeCodigo,
    descobrir_video,
    extrair_codigo,
    nome_da_cena,
    preparar_cena,
    sanear_codigo,
    validar_codigo,
)

CENA_VALIDA = """from manim import *


class MinhaCena(Scene):
    def construct(self):
        self.play(Create(Dot()))
        self.wait(0.2)
"""


# ---------------------------------------------------------------------------
# 2.3 -- extrair_codigo
# ---------------------------------------------------------------------------


def test_extrai_de_cerca_python() -> None:
    resposta = "Segue a cena:\n\n```python\n" + CENA_VALIDA + "```\n"
    assert extrair_codigo(resposta).startswith("from manim import *")


def test_extrai_quando_o_modelo_explica_antes_de_mostrar() -> None:
    """O caso que a alternativa ingenua erra.

    Pegar o primeiro bloco de crase tripla devolveria a explicacao, e nao o
    codigo. A ancora em ```python e o que resolve.
    """
    resposta = (
        "Primeiro, um resumo:\n\n```\nCria um ponto e espera.\n```\n\n"
        "Agora o codigo:\n\n```python\n" + CENA_VALIDA + "```\n"
    )
    assert extrair_codigo(resposta).startswith("from manim import *")


def test_extrai_sem_cerca_quando_ha_import_do_manim() -> None:
    assert extrair_codigo(CENA_VALIDA).startswith("from manim import *")


def test_recusa_texto_que_nao_e_codigo() -> None:
    with pytest.raises(EQuirkDeCodigo):
        extrair_codigo("Nao consegui gerar a cena, desculpe.")


# ---------------------------------------------------------------------------
# 2.4 -- nome_da_cena
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("base", ["Scene", "ThreeDScene", "MovingCameraScene"])
def test_nome_da_cena_cobre_as_tres_bases(base: str) -> None:
    codigo = (
        f"from manim import *\n\n\nclass Alvo({base}):\n"
        "    def construct(self):\n        pass\n"
    )
    assert nome_da_cena(codigo) == "Alvo"


def test_nome_da_cena_recusa_classe_que_nao_e_cena() -> None:
    with pytest.raises(EQuirkDeCodigo):
        nome_da_cena("from manim import *\n\n\nclass Alvo(VGroup):\n    pass\n")


# ---------------------------------------------------------------------------
# 2.2 -- validar_codigo (as seis regras, e a ORDEM delas)
# ---------------------------------------------------------------------------


def test_valida_cena_correta() -> None:
    ok, detalhe = validar_codigo(CENA_VALIDA)
    assert ok, detalhe


def test_sintaxe_reprova_antes_de_qualquer_outra_regra() -> None:
    """A ordem e contrato.

    Este codigo viola TRES regras de uma vez (sintaxe, import do manim,
    classe de cena). A mensagem tem de ser a de sintaxe: com a arvore
    quebrada, as outras cinco regras nao tem o que inspecionar.
    """
    ok, detalhe = validar_codigo("class (:")
    assert not ok
    assert "sintaxe" in detalhe


def test_reprova_sem_import_do_manim() -> None:
    ok, detalhe = validar_codigo(
        "class MinhaCena(Scene):\n    def construct(self):\n        pass\n"
    )
    assert not ok
    assert "from manim import" in detalhe


def test_reprova_sem_classe_de_cena() -> None:
    ok, detalhe = validar_codigo("from manim import *\n\n\ndef construct(self):\n    pass\n")
    assert not ok
    assert "classe de cena" in detalhe


def test_reprova_sem_construct() -> None:
    ok, detalhe = validar_codigo(
        "from manim import *\n\n\nclass MinhaCena(Scene):\n    def outro(self):\n        pass\n"
    )
    assert not ok
    assert "construct" in detalhe


@pytest.mark.parametrize("modulo", sorted(DANGEROUS_IMPORTS))
def test_reprova_import_perigoso(modulo: str) -> None:
    codigo = CENA_VALIDA.replace("from manim import *", f"from manim import *\nimport {modulo}")
    ok, detalhe = validar_codigo(codigo)
    assert not ok
    assert "import proibido" in detalhe


@pytest.mark.parametrize("modulo", sorted(DANGEROUS_IMPORTS))
def test_reprova_from_import_perigoso(modulo: str) -> None:
    codigo = CENA_VALIDA.replace(
        "from manim import *", f"from manim import *\nfrom {modulo} import algo"
    )
    ok, detalhe = validar_codigo(codigo)
    assert not ok
    assert "import proibido" in detalhe


@pytest.mark.parametrize("funcao", sorted(DANGEROUS_FUNCTIONS))
def test_reprova_funcao_perigosa(funcao: str) -> None:
    codigo = CENA_VALIDA.replace("        self.wait(0.2)", f"        {funcao}('x')")
    ok, detalhe = validar_codigo(codigo)
    assert not ok
    assert "funcao proibida" in detalhe


def test_a_blocklist_nao_e_sandbox() -> None:
    """Documenta o limite, em vez de deixar a impressao de defesa.

    `docs/reuso-3b1b.md` item 2.13: a lista bloqueia NOMES, nao capacidades.
    `__builtins__["__imp" + "ort__"]` passa. O teste existe para que ninguem
    leia `validar_codigo` como isolamento -- o subprocesso roda na conta do
    usuario, sem container.
    """
    codigo = CENA_VALIDA.replace(
        "        self.wait(0.2)",
        "        fn = getattr(__builtins__, 'ex' + 'ec', None)",
    )
    ok, _ = validar_codigo(codigo)
    assert ok, "o teste so documenta o furo; se ele reprovar, a nota mudou"


# ---------------------------------------------------------------------------
# 2.1 / 2.6 / 2.7 / 2.8 -- sanear_codigo
# ---------------------------------------------------------------------------


def test_troca_cyan_por_teal() -> None:
    codigo = CENA_VALIDA.replace("Dot()", "Dot(color=CYAN)")
    saneado, correcoes = sanear_codigo(codigo)
    assert "CYAN" not in saneado
    assert "TEAL" in saneado
    assert "cor: CYAN -> TEAL" in correcoes


@pytest.mark.parametrize(("origem", "destino"), sorted(COLOR_FALLBACKS.items()))
def test_todas_as_variantes_de_cyan_tem_fallback(origem: str, destino: str) -> None:
    saneado, correcoes = sanear_codigo(CENA_VALIDA.replace("Dot()", f"Dot(color={origem})"))
    assert f"color={destino}" in saneado
    assert f"cor: {origem} -> {destino}" in correcoes


def test_nao_mexe_em_cor_que_existe() -> None:
    """Sonda negativa: TEAL existe e nao pode ser reescrito.

    Sem esta, um saneador que trocasse toda cor por TEAL passaria no teste
    anterior.
    """
    codigo = CENA_VALIDA.replace("Dot()", "Dot(color=TEAL)")
    saneado, correcoes = sanear_codigo(codigo)
    assert saneado == codigo
    assert correcoes == []


def test_corrige_fill_opacity_em_add_background_rectangle() -> None:
    codigo = CENA_VALIDA.replace(
        "        self.wait(0.2)",
        "        Text('x').add_background_rectangle(fill_opacity=0.6)",
    )
    saneado, correcoes = sanear_codigo(codigo)
    assert "opacity=0.6" in saneado
    assert "fill_opacity" not in saneado
    assert "add_background_rectangle: fill_opacity -> opacity" in correcoes


def test_nao_mexe_em_fill_opacity_de_outra_chamada() -> None:
    """`fill_opacity` e o kwarg CORRETO em quase todo o resto do Manim.

    Trocar em todo lugar quebraria `Rectangle(fill_opacity=...)`, que e o uso
    normal. A correcao e especifica de `add_background_rectangle`.
    """
    codigo = CENA_VALIDA.replace("Dot()", "Rectangle(fill_opacity=1.0)")
    saneado, correcoes = sanear_codigo(codigo)
    assert saneado == codigo
    assert correcoes == []


def test_remove_tip_style_de_add_tip() -> None:
    codigo = CENA_VALIDA.replace(
        "        self.wait(0.2)",
        "        Line().add_tip(tip_style=1, tip_length=0.2)",
    )
    saneado, correcoes = sanear_codigo(codigo)
    assert "tip_style" not in saneado
    assert "tip_length=0.2" in saneado, "os outros kwargs tem de sobreviver"
    assert "add_tip: kwarg tip_style removido (nome de ManimGL)" in correcoes


def test_codigo_sem_quirk_volta_byte_a_byte() -> None:
    """`ast.unparse` reescreve formatacao e apaga comentario.

    O original devolve a string de entrada quando nada mudou
    (openai_service.py:230-231); manter isso e o que impede todo diff de cena
    de virar ruido.
    """
    codigo = CENA_VALIDA + "\n# um comentario que ast.unparse apagaria\n"
    saneado, correcoes = sanear_codigo(codigo)
    assert saneado == codigo
    assert correcoes == []
    assert "# um comentario" in saneado


def test_sanear_nao_valida() -> None:
    """Codigo com sintaxe quebrada volta intacto; quem reprova e validar_codigo."""
    saneado, correcoes = sanear_codigo("class (:")
    assert saneado == "class (:"
    assert correcoes == []


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


def test_preparar_cena_prefixa_o_patch_de_background_rectangle() -> None:
    preparada = preparar_cena(CENA_VALIDA)
    assert preparada.codigo.startswith("from manim.mobject.geometry.shape_matchers import")
    assert 'BackgroundRectangle.tex_string = ""' in preparada.codigo
    assert preparada.nome_cena == "MinhaCena"


def test_preparar_cena_sanea_antes_de_validar() -> None:
    """A ordem documentada em docs/reuso-3b1b.md item 2.1: pos-extracao, pre-validacao."""
    resposta = "```python\n" + CENA_VALIDA.replace("Dot()", "Dot(color=CYAN)") + "```"
    preparada = preparar_cena(resposta)
    assert "CYAN" not in preparada.codigo
    assert preparada.correcoes == ["cor: CYAN -> TEAL"]


def test_preparar_cena_recusa_cena_invalida() -> None:
    with pytest.raises(EQuirkDeCodigo):
        preparar_cena("from manim import *\n\n\nclass X(Scene):\n    pass\n")


# ---------------------------------------------------------------------------
# 2.10 -- descobrir_video (a versao corrigida)
# ---------------------------------------------------------------------------


def _arvore_de_media(raiz: Path, arquivos: list[str]) -> Path:
    media = raiz / "media"
    for relativo in arquivos:
        alvo = media / relativo
        alvo.parent.mkdir(parents=True, exist_ok=True)
        alvo.write_bytes(b"conteudo")
    return media


def test_descobre_o_mov_do_render_transparente(tmp_path: Path) -> None:
    """Bug (a) do original: ele varria so `*.mp4`.

    Com `-t` o Manim escreve `.mov` -- o cenario exato deste programa. O
    original devolveria None e o chamador reportaria "video nao encontrado"
    com returncode 0.
    """
    media = _arvore_de_media(tmp_path, ["videos/cena/270p15/MinhaCena.mov"])
    achado = descobrir_video(media, "MinhaCena", "mov")
    assert achado.name == "MinhaCena.mov"


def test_ignora_os_fragmentos_de_partial_movie_files(tmp_path: Path) -> None:
    """Bug (b) do original: o fallback `candidates[0]`.

    Aqui NAO ha saida final -- so fragmentos. O original devolveria o
    fragmento mais recente e o pipeline seguiria com um pedaco de video. A
    versao corrigida levanta.
    """
    media = _arvore_de_media(
        tmp_path,
        [
            "videos/cena/270p15/partial_movie_files/MinhaCena/uncached_00000.mov",
            "videos/cena/270p15/partial_movie_files/MinhaCena/uncached_00001.mov",
        ],
    )
    with pytest.raises(EQuirkDeCodigo):
        descobrir_video(media, "MinhaCena", "mov")


def test_nao_devolve_video_de_outra_cena(tmp_path: Path) -> None:
    media = _arvore_de_media(tmp_path, ["videos/cena/270p15/OutraCena.mov"])
    with pytest.raises(EQuirkDeCodigo):
        descobrir_video(media, "MinhaCena", "mov")


def test_casamento_de_nome_e_exato(tmp_path: Path) -> None:
    """`scene_name in mp4.stem` do original casa `MinhaCena` em `MinhaCenaAntiga`."""
    media = _arvore_de_media(tmp_path, ["videos/cena/270p15/MinhaCenaAntiga.mov"])
    with pytest.raises(EQuirkDeCodigo):
        descobrir_video(media, "MinhaCena", "mov")


def test_extensao_vem_do_formato_pedido(tmp_path: Path) -> None:
    media = _arvore_de_media(
        tmp_path,
        ["videos/cena/270p15/MinhaCena.mp4", "videos/cena/270p15/MinhaCena.webm"],
    )
    assert descobrir_video(media, "MinhaCena", "mp4").suffix == ".mp4"
    assert descobrir_video(media, "MinhaCena", "webm").suffix == ".webm"


def test_ambiguidade_e_erro(tmp_path: Path) -> None:
    media = _arvore_de_media(
        tmp_path,
        ["videos/a/270p15/MinhaCena.mov", "videos/b/270p15/MinhaCena.mov"],
    )
    with pytest.raises(EQuirkDeCodigo):
        descobrir_video(media, "MinhaCena", "mov")


def test_formato_desconhecido_e_erro(tmp_path: Path) -> None:
    media = _arvore_de_media(tmp_path, ["videos/cena/270p15/MinhaCena.mov"])
    with pytest.raises(EQuirkDeCodigo):
        descobrir_video(media, "MinhaCena", "avi")


# ---------------------------------------------------------------------------
# Sonda empirica -- exige o Manim instalado
# ---------------------------------------------------------------------------


@pytest.mark.manim
def test_cyan_nao_existe_no_namespace_do_manim() -> None:
    """A afirmacao que justifica COLOR_FALLBACKS, verificada e nao herdada.

    Sem o Manim instalado o pytest reporta SKIPPED -- que e diferente de
    verde. O `manim` esta declarado em pyproject.toml e nao esta instalado
    neste ambiente; ver o handoff do card.
    """
    manim = pytest.importorskip("manim", reason="Manim CE nao instalado neste ambiente")
    assert not hasattr(manim, "CYAN"), "se CYAN passou a existir, o fallback virou ruido"
    assert hasattr(manim, "TEAL"), "TEAL precisa existir, senao o fallback troca por nada"
