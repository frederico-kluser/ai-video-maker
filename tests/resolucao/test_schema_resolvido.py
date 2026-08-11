"""
tests/resolucao/test_schema_resolvido.py

Prova que o manifesto resolvido NAO consegue conter uma URL — e que isso
e propriedade do schema, nao da revisao de codigo.

A pergunta adversarial do card F2-01 e literalmente: "O manifesto
resolvido consegue conter uma URL? Deve ser impossivel pelo schema, nao
por convencao." A resposta e este arquivo: dez fixtures, cada uma
contrabandeando uma URL por um caminho diferente, e o schema rejeitando
todas.

Os caminhos cobertos (porque proibir so o obvio nao proibe nada):
  01  propriedade `url` extra num asset      -> additionalProperties
  02  URL escondida em `provedor`            -> TextoSemURL
  03  URL escondida em `licenca`             -> TextoSemURL
  04  URL escondida em `atribuicao`          -> TextoSemURL
  05  URL FUNDO dentro do manifesto embutido -> SemURLProfundo (recursivo)
  06  URL como NOME de propriedade           -> propertyNames
  07  URL no lugar do hash de um no          -> Sha256
  08  URL relativa a protocolo (//cdn...)    -> SemURLProfundo
  09  timestamp de parede                    -> additionalProperties (C9)
  10  asset sem licenca                      -> required

Requer: jsonschema. Ausencia de jsonschema NAO e um skip silencioso —
e uma falha, porque uma suite que pula a unica prova que tem fica verde
sem provar nada (AGENTS.md C2).
"""

import json
import re
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

RAIZ = Path(__file__).resolve().parents[2]
SCHEMA_RESOLVIDO = RAIZ / "schema" / "manifesto-resolvido.schema.json"
SCHEMA_MANIFESTO = RAIZ / "schema" / "manifesto.schema.json"
FIXTURES = RAIZ / "fixtures" / "resolucao"

FIXTURE_VALIDA = "manifesto-resolvido-valido.json"

# (arquivo, o que a fixture contrabandeia, que guarda tem de pegar)
FIXTURES_INVALIDAS = [
    (
        "manifesto-resolvido-invalido-01-url-como-propriedade-de-asset.json",
        "propriedade 'url' extra num asset",
        "additionalProperties:false em AssetResolvido",
    ),
    (
        "manifesto-resolvido-invalido-02-url-no-provedor.json",
        "URL no campo provedor",
        "$defs.TextoSemURL",
    ),
    (
        "manifesto-resolvido-invalido-03-url-na-licenca.json",
        "URL no campo licenca",
        "$defs.TextoSemURL",
    ),
    (
        "manifesto-resolvido-invalido-04-url-na-atribuicao.json",
        "URL no texto de atribuicao",
        "$defs.TextoSemURL",
    ),
    (
        "manifesto-resolvido-invalido-05-url-dentro-do-manifesto.json",
        "URL enterrada no manifesto embutido",
        "$defs.SemURLProfundo (recursivo, via allOf na raiz)",
    ),
    (
        "manifesto-resolvido-invalido-06-url-como-nome-de-propriedade.json",
        "URL como NOME de propriedade",
        "propertyNames em SemURLProfundo",
    ),
    (
        "manifesto-resolvido-invalido-07-url-no-lugar-do-hash.json",
        "URL onde deveria haver hash",
        "$defs.Sha256",
    ),
    (
        "manifesto-resolvido-invalido-08-url-relativa-a-protocolo.json",
        "URL relativa a protocolo (//cdn...)",
        "$defs.SemURLProfundo",
    ),
    (
        "manifesto-resolvido-invalido-09-timestamp-de-parede.json",
        "timestamp de parede no topo",
        "additionalProperties:false na raiz (C9)",
    ),
    (
        "manifesto-resolvido-invalido-10-asset-sem-licenca.json",
        "asset sem licenca",
        "required em AssetResolvido",
    ),
]


def carregar(caminho: Path):
    return json.loads(caminho.read_text(encoding="utf-8"))


def validador() -> Draft202012Validator:
    """Monta o validador com o schema do manifesto resolvido.

    O schema resolvido faz `$ref` para `./manifesto.schema.json`, que
    resolve para o `$id` do schema do manifesto. Sem registrar o schema
    do manifesto, o ref falharia por rede — e uma suite offline nunca
    pode depender de resolver ref pela internet.
    """
    resolvido = carregar(SCHEMA_RESOLVIDO)
    manifesto = carregar(SCHEMA_MANIFESTO)
    registro = Registry().with_resources(
        [
            (manifesto["$id"], Resource.from_contents(manifesto)),
            (resolvido["$id"], Resource.from_contents(resolvido)),
        ]
    )
    return Draft202012Validator(resolvido, registry=registro)


# ─── Fixture valida ──────────────────────────────────────────────────────────


def test_fixture_valida_passa():
    """Sonda positiva: sem ela, "tudo invalido" seria satisfeito por um
    schema que rejeita absolutamente tudo."""
    erros = list(validador().iter_errors(carregar(FIXTURES / FIXTURE_VALIDA)))
    assert not erros, "fixture valida rejeitada: " + "; ".join(
        f"{list(e.absolute_path)}: {e.message}" for e in erros
    )


def test_fixture_valida_nao_tem_url():
    """A fixture valida nao pode conter URL em lugar nenhum — se contivesse,
    o teste acima estaria provando o oposto do que diz provar."""
    texto = (FIXTURES / FIXTURE_VALIDA).read_text(encoding="utf-8")
    assert "://" not in texto, "a propria fixture valida contem URL"


# ─── Fixtures invalidas ──────────────────────────────────────────────────────


@pytest.mark.parametrize("arquivo,contrabando,guarda", FIXTURES_INVALIDAS)
def test_fixture_invalida_e_rejeitada(arquivo: str, contrabando: str, guarda: str):
    erros = list(validador().iter_errors(carregar(FIXTURES / arquivo)))
    assert erros, (
        f"{arquivo} deveria ser rejeitada ({contrabando}), mas passou. "
        f"Guarda que falhou: {guarda}."
    )


def test_todas_as_fixtures_invalidas_existem():
    """C2: um parametrize sobre uma lista de arquivos que nao existem
    passaria por erro de coleta, nao por prova."""
    for arquivo, _, _ in FIXTURES_INVALIDAS:
        assert (FIXTURES / arquivo).is_file(), f"fixture ausente: {arquivo}"
    assert len(FIXTURES_INVALIDAS) >= 10


# ─── Propriedades estruturais do schema ──────────────────────────────────────


def test_schema_nao_tem_campo_de_relogio():
    """C9: nenhum campo do manifesto resolvido carrega tempo de parede.

    Congelar relogio no teste nao adianta se o artefato tem um campo de
    data: dois pipelines identicos em dias diferentes produziriam
    manifestos resolvidos diferentes, e o determinismo abaixo da
    fronteira seria falso.
    """
    texto = SCHEMA_RESOLVIDO.read_text(encoding="utf-8")
    schema = json.loads(texto)
    proibidos = re.compile(
        r'"(inicio|fim|duracaoMs|timestamp|gravadoEm|resolvidoEm|data|acquiredAt)"'
    )
    nomes_de_propriedade = set()

    def andar(no):
        if isinstance(no, dict):
            for chave, valor in no.items():
                if chave in ("properties", "$defs") and isinstance(valor, dict):
                    nomes_de_propriedade.update(valor.keys())
                andar(valor)
        elif isinstance(no, list):
            for item in no:
                andar(item)

    andar(schema)
    achados = [n for n in nomes_de_propriedade if proibidos.match(f'"{n}"')]
    assert not achados, f"schema declara campo de relogio: {achados}"
    assert "date-time" not in texto, "schema usa format:date-time"


def test_schema_proibe_url_recursivamente():
    """O guarda C7 tem de estar ligado na RAIZ, senao ele so protege o
    pedaco que alguem lembrou de anotar."""
    schema = carregar(SCHEMA_RESOLVIDO)
    assert "SemURLProfundo" in schema["$defs"], "guarda recursivo ausente"
    refs_na_raiz = [
        sub.get("$ref") for sub in schema.get("allOf", []) if isinstance(sub, dict)
    ]
    assert "#/$defs/SemURLProfundo" in refs_na_raiz, (
        "SemURLProfundo existe mas nao esta aplicado na raiz via allOf — "
        "um guarda que nao guarda a raiz nao guarda o manifesto embutido"
    )


def test_additional_properties_fechado_na_raiz():
    schema = carregar(SCHEMA_RESOLVIDO)
    assert schema.get("additionalProperties") is False
    assert schema["$defs"]["AssetResolvido"].get("additionalProperties") is False
    assert schema["$defs"]["RegistroEstagio"].get("additionalProperties") is False
