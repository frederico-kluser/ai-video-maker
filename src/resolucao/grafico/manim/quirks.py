"""Quirks do Manim CE absorvidos do projeto 3blue1brown, com citacao de origem.

Card F2-02 (W4). Decisao vinculante: ADR-0004 (reuso 3b1b) e
`docs/reuso-3b1b.md`, itens 2.1 a 2.10. A regra do ADR-0004 e ABSORVER,
nunca importar: nada aqui faz `import` de `/home/ondokai/Projects/3blue1brown`.
O codigo foi copiado, traduzido e corrigido; a origem fica citada em
`arquivo:linha` para que `check_staleness` consiga revalidar depois.

Todas as citacoes sao relativas a `/home/ondokai/Projects/3blue1brown/`.

Por que estes quirks existem: sao erros SISTEMATICOS e NAO-INFERIVEIS do
Manim CE. Nenhum agente os deduziria sem ve-los acontecer, e cada um falha
dentro do subprocesso de render -- longe do lugar onde a causa esta.

O que este modulo NAO e: sandbox. A blocklist de imports/funcoes bloqueia
NOMES, nao capacidades (`docs/reuso-3b1b.md`, item 2.13 IGNORAR). Ela vale
como validacao antes do subprocesso, e so.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# Tabelas absorvidas
# ---------------------------------------------------------------------------

# Origem: manim-api/services/openai_service.py:46-53
#
# CYAN existe no Manim, mas NAO no namespace de `from manim import *` -- so em
# XKCD/SVGNAMES/DVIPSNAMES. O NameError estoura dentro do subprocesso de render,
# onde a mensagem nao diz que a cor e o problema. Sonda empirica em
# tests/resolucao/test_grafico_quirks.py (marcador `manim`).
COLOR_FALLBACKS: dict[str, str] = {
    "CYAN": "TEAL",
    "CYAN_A": "TEAL_A",
    "CYAN_B": "TEAL_B",
    "CYAN_C": "TEAL_C",
    "CYAN_D": "TEAL_D",
    "CYAN_E": "TEAL_E",
}

# Origem: manim-api/services/openai_service.py:21-33 (11 modulos)
DANGEROUS_IMPORTS: frozenset[str] = frozenset(
    {
        "os",
        "sys",
        "subprocess",
        "shutil",
        "socket",
        "urllib",
        "requests",
        "pickle",
        "ctypes",
        "multiprocessing",
        "pty",
    }
)

# Origem: manim-api/services/openai_service.py:35 (5 funcoes)
DANGEROUS_FUNCTIONS: frozenset[str] = frozenset({"eval", "exec", "open", "__import__", "compile"})

# Origem: manim-api/services/manim_executor.py:30-35, aplicado em :220
#
# `BackgroundRectangle` pode nao ter o atributo `tex_string` que
# `transform_matching_parts.py:292` assume; `geometry/shape_matchers.py:83` nao
# o define. Sem o patch, qualquer cena com `add_background_rectangle()` -- o
# recurso padrao para legibilidade de texto sobre grafico -- pode estourar
# AssertionError. O patch e prefixado a TODA cena, nao so as suspeitas: custo
# zero quando desnecessario, e a suspeita e justamente o que nao se sabe a
# priori.
PATCH_BACKGROUND_RECTANGLE = (
    "from manim.mobject.geometry.shape_matchers import BackgroundRectangle\n"
    "\n"
    'if not hasattr(BackgroundRectangle, "tex_string"):\n'
    '    BackgroundRectangle.tex_string = ""\n'
)

# Origem: manim-api/services/openai_service.py:93
BASES_DE_CENA: tuple[str, ...] = ("Scene", "ThreeDScene", "MovingCameraScene")


# N818 pede sufixo `Error`. A convencao deste repositorio e o prefixo `E`
# (ECasseteAusente, ERedeBloqueada, EEstagioDesconhecido), e ela atravessa
# TypeScript e Python. Renomear so aqui quebraria a correspondencia.
class EQuirkDeCodigo(ValueError):  # noqa: N818
    """Codigo de cena que nao passa pelo pipeline de preparo."""


# ---------------------------------------------------------------------------
# 2.3 -- extract_code
# ---------------------------------------------------------------------------


def extrair_codigo(resposta: str) -> str:
    """Extrai codigo Python de uma resposta em markdown.

    Origem: manim-api/services/openai_service.py:78-88.

    O fallback importa: pegar ingenuamente o primeiro bloco de crase tripla
    falha quando o modelo explica o codigo antes de mostra-lo. Aqui a cerca
    e ancorada em ```python, e a saida sem cerca so e aceita se contiver
    `from manim import`.
    """
    correspondencias = re.findall(r"```python\s*(.*?)\s*```", resposta, re.DOTALL)
    if correspondencias:
        return correspondencias[0].strip()

    if "from manim import" in resposta:
        return resposta.strip()

    raise EQuirkDeCodigo(
        "nao foi possivel extrair codigo Manim: nem cerca ```python, "
        "nem 'from manim import' no texto"
    )


# ---------------------------------------------------------------------------
# 2.4 -- get_scene_name
# ---------------------------------------------------------------------------


def nome_da_cena(codigo: str) -> str:
    """Extrai o nome da classe de cena.

    Origem: manim-api/services/openai_service.py:91-97.

    Necessario duas vezes: para montar `manim render ... <NomeDaCena>` e para
    saber qual arquivo esperar na saida (`descobrir_video`).
    """
    padrao = r"class\s+(\w+)\s*\(\s*(?:" + "|".join(BASES_DE_CENA) + r")\s*\)"
    achado = re.search(padrao, codigo)
    if achado:
        return achado.group(1)
    raise EQuirkDeCodigo(
        f"nenhuma classe de cena encontrada; bases aceitas: {', '.join(BASES_DE_CENA)}"
    )


# ---------------------------------------------------------------------------
# 2.2 -- validate_code
# ---------------------------------------------------------------------------


def validar_codigo(codigo: str) -> tuple[bool, str]:
    """Valida codigo Manim antes de entrega-lo ao subprocesso.

    Origem: manim-api/services/openai_service.py:100-139.

    A ORDEM das seis regras e parte do contrato: o parse AST vem primeiro
    porque um SyntaxError torna as outras cinco inuteis
    (openai_service.py:102-105).
    """
    try:
        arvore = ast.parse(codigo)
    except SyntaxError as exc:
        return False, f"erro de sintaxe: {exc}"

    if "from manim import" not in codigo:
        return False, "falta 'from manim import' -- a cena nao tem o namespace do Manim"

    if all(f"({base})" not in codigo for base in BASES_DE_CENA):
        return False, (
            "falta classe de cena; esperado `class X(Scene):` "
            f"(ou {', '.join(BASES_DE_CENA[1:])})"
        )

    if "def construct(self)" not in codigo:
        return False, "falta o metodo `def construct(self):`"

    for no in ast.walk(arvore):
        if isinstance(no, ast.Import):
            for alias in no.names:
                modulo = alias.name.split(".")[0]
                if modulo in DANGEROUS_IMPORTS:
                    return False, f"import proibido: {alias.name}"
        elif isinstance(no, ast.ImportFrom):
            modulo = (no.module or "").split(".")[0]
            if modulo in DANGEROUS_IMPORTS:
                return False, f"import proibido: from {no.module}"
        elif isinstance(no, ast.Call) and (
            isinstance(no.func, ast.Name) and no.func.id in DANGEROUS_FUNCTIONS
        ):
            return False, f"funcao proibida: {no.func.id}()"

    return True, "codigo validado"


# ---------------------------------------------------------------------------
# 2.1 / 2.6 / 2.7 / 2.8 -- sanitize_code
# ---------------------------------------------------------------------------


class _Saneador(ast.NodeTransformer):
    """Aplica as tres correcoes de AST, registrando cada uma pelo nome."""

    def __init__(self) -> None:
        self.correcoes: list[str] = []

    def visit_Call(self, no: ast.Call) -> ast.AST:  # noqa: N802 (nome da API do ast)
        self.generic_visit(no)

        nome_func = None
        if isinstance(no.func, ast.Attribute):
            nome_func = no.func.attr
        elif isinstance(no.func, ast.Name):
            nome_func = no.func.id

        # 2.7 -- origem: manim-api/services/openai_service.py:208-212
        # Em quase todo o Manim o kwarg e `fill_opacity`; em
        # `add_background_rectangle` ele colide com **kwargs e o erro e
        # "got multiple values", nao "unexpected keyword" -- o que manda o
        # depurador para o lugar errado.
        if nome_func == "add_background_rectangle":
            for kw in no.keywords:
                if kw.arg == "fill_opacity":
                    kw.arg = "opacity"
                    self.correcoes.append("add_background_rectangle: fill_opacity -> opacity")

        # 2.8 -- origem: manim-api/services/openai_service.py:213-218
        # `tip_style` e nome de ManimGL; o Manim CE expoe `tip_shape`.
        if nome_func == "add_tip" and no.keywords:
            filtrados = [kw for kw in no.keywords if kw.arg != "tip_style"]
            if len(filtrados) != len(no.keywords):
                no.keywords = filtrados
                self.correcoes.append("add_tip: kwarg tip_style removido (nome de ManimGL)")

        return no

    def visit_Name(self, no: ast.Name) -> ast.AST:  # noqa: N802 (nome da API do ast)
        # 2.6 -- origem: manim-api/services/openai_service.py:220-226
        substituta = COLOR_FALLBACKS.get(no.id)
        if substituta:
            self.correcoes.append(f"cor: {no.id} -> {substituta}")
            no.id = substituta
        return no


def sanear_codigo(codigo: str) -> tuple[str, list[str]]:
    """Corrige os erros sistematicos do Manim CE por transformacao de AST.

    Origem: manim-api/services/openai_service.py:188-236.

    Duas adaptacoes em relacao ao original:

    1. sem `request_id` nem `logger` -- a funcao e standalone (item 2.1 do
       inventario de reuso);
    2. devolve a LISTA de correcoes aplicadas em vez de um booleano
       `modified`. O original sabia que mudou e nao sabia o que mudou; um
       conserto silencioso e indistinguivel de nenhum conserto.

    O comportamento preservado do original: se nada mudou, devolve o codigo
    ORIGINAL, byte a byte (openai_service.py:230-231). `ast.unparse`
    reescreve formatacao e comentario; reescrever sem necessidade tornaria
    todo diff de cena ilegivel.
    """
    try:
        arvore = ast.parse(codigo)
    except SyntaxError:
        # Igual ao original: sanear nao e validar. Quem reprova sintaxe e
        # `validar_codigo`, com mensagem propria.
        return codigo, []

    saneador = _Saneador()
    saneador.visit(arvore)
    if not saneador.correcoes:
        return codigo, []

    ast.fix_missing_locations(arvore)
    return ast.unparse(arvore), saneador.correcoes


# ---------------------------------------------------------------------------
# Pipeline de preparo
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CenaPreparada:
    """Uma cena pronta para o subprocesso do Manim."""

    codigo: str
    """Codigo saneado, ja com o patch de BackgroundRectangle prefixado."""

    nome_cena: str
    correcoes: list[str] = field(default_factory=list)


def preparar_cena(fonte: str) -> CenaPreparada:
    """extrair -> sanear -> validar -> prefixar o patch.

    A ordem e deliberada e espelha a do projeto de origem: sanear ANTES de
    validar, porque as tres correcoes de AST resolvem justamente casos que a
    validacao nao reprovaria (o codigo com CYAN e sintaticamente perfeito) e
    que so falhariam dentro do subprocesso.

    O patch entra por ULTIMO, depois da validacao, para que a validacao veja
    exatamente o codigo da cena -- e nao aprove um `from manim...` que quem
    escreveu a cena nunca colocou.
    """
    codigo = extrair_codigo(fonte)
    codigo, correcoes = sanear_codigo(codigo)

    ok, detalhe = validar_codigo(codigo)
    if not ok:
        raise EQuirkDeCodigo(f"cena invalida: {detalhe}")

    nome = nome_da_cena(codigo)
    return CenaPreparada(
        codigo=f"{PATCH_BACKGROUND_RECTANGLE}\n{codigo}",
        nome_cena=nome,
        correcoes=correcoes,
    )


# ---------------------------------------------------------------------------
# 2.10 -- find_video, na versao corrigida
# ---------------------------------------------------------------------------

# Origem do conceito: manim-api/services/manim_executor.py:48-59.
# Origem dos DOIS bugs que esta versao corrige (item 2.11, IGNORAR):
#   (a) varre so `*.mp4`; render com `-t` escreve `.mov` e `--format=webm`
#       escreve `.webm` => devolve None => o chamador reporta "video nao
#       encontrado" com returncode 0. Falha em silencio no cenario exato
#       que este programa precisa (fundo transparente).
#   (b) `return candidates[0]` (manim_executor.py:59) devolve o mp4 mais
#       recente quando o nome da cena nao casa -- podendo ser de outra cena
#       ou um fragmento de `partial_movie_files/`.
#
# Verificado no disco: um render com `-t` produz
#   media/videos/<script>/<H>p<fps>/<Cena>.mov            <- o resultado
#   media/videos/<script>/<H>p<fps>/partial_movie_files/<Cena>/uncached_00000.mov
# Os fragmentos ficam num diretorio com o nome da cena; o `stem` deles e
# `uncached_00000`, entao o casamento por `stem` do original nao os pega --
# mas o fallback `candidates[0]` pega.

DIRETORIO_DE_FRAGMENTOS = "partial_movie_files"

EXTENSAO_POR_FORMATO: dict[str, str] = {
    "mp4": ".mp4",
    "mov": ".mov",
    "webm": ".webm",
    "gif": ".gif",
    "png": ".png",
}


def descobrir_video(media_dir: Path, nome_cena: str, formato: str) -> Path:
    """Descobre o arquivo que o Manim produziu, em vez de montar o caminho.

    Descobrir e nao montar porque a subpasta de qualidade
    (`media/videos/<script>/<altura>p<fps>/`) depende de flags que o chamador
    nem sempre passou.

    Diferencas em relacao ao original, todas deliberadas:
      - a extensao vem do FORMATO pedido, nao de `*.mp4` fixo;
      - o casamento com o nome da cena e EXATO (`path.stem == nome_cena`);
      - `partial_movie_files/` e excluido explicitamente;
      - NAO existe fallback: nao casou, e erro.
    """
    extensao = EXTENSAO_POR_FORMATO.get(formato)
    if extensao is None:
        raise EQuirkDeCodigo(
            f"formato desconhecido: {formato!r}; conhecidos: "
            f"{', '.join(sorted(EXTENSAO_POR_FORMATO))}"
        )

    raiz = media_dir / "videos"
    base = raiz if raiz.exists() else media_dir

    candidatos = [
        caminho
        for caminho in sorted(base.rglob(f"*{extensao}"))
        if DIRETORIO_DE_FRAGMENTOS not in caminho.parts and caminho.stem == nome_cena
    ]

    if not candidatos:
        raise EQuirkDeCodigo(
            f"nenhum arquivo {extensao} com stem exatamente {nome_cena!r} em {base} "
            f"(fragmentos de {DIRETORIO_DE_FRAGMENTOS}/ nao contam). "
            "Sem fallback de proposito: devolver 'o mais recente' entrega o video "
            "de outra cena com codigo de saida 0."
        )
    if len(candidatos) > 1:
        raise EQuirkDeCodigo(
            f"{len(candidatos)} arquivos {extensao} com stem {nome_cena!r}: "
            f"{', '.join(str(c) for c in candidatos)}. "
            "Ambiguidade e erro: escolher um seria escolher por acaso."
        )
    return candidatos[0]
