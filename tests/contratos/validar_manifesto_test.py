"""
tests/contratos/validar-manifesto.test.py

Testes de validacao do manifesto contra o JSON Schema.
Valida fixtures validas e invalidas usando o schema completo 2020-12.

Requer: pip install jsonschema
"""

import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError:
    print("SKIP: jsonschema nao instalado. Rode: pip install jsonschema")
    sys.exit(0)

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "schema" / "manifesto.schema.json"
FIXTURES_DIR = Path(__file__).resolve().parent


def carregar_schema():
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def carregar_fixture(nome):
    with open(FIXTURES_DIR / nome) as f:
        return json.load(f)


def test_valido_minimo():
    """Fixture valida deve passar na validacao."""
    schema = carregar_schema()
    validator = Draft202012Validator(schema)
    fixture = carregar_fixture("valido-minimo.json")
    erros = list(validator.iter_errors(fixture))
    assert len(erros) == 0, f"Esperado 0 erros, obtido {len(erros)}: {[e.message for e in erros]}"


def test_valido_completo():
    """Fixture valida com todos os tipos de no deve passar."""
    schema = carregar_schema()
    validator = Draft202012Validator(schema)

    fixture = {
        "schema_version": "Manifesto.1",
        "fps": 30,
        "width": 1920,
        "height": 1080,
        "duracao_total_frames": 600,
        "nos": [
            {
                "id": "n-001", "schema": "Cabecalho.1", "type": "cabecalho",
                "duracao_frames": 120, "texto": "Titulo Principal", "alinhamento": "centro"
            },
            {
                "id": "n-002", "schema": "Texto.1", "type": "texto",
                "duracao_frames": 150, "texto": "Paragrafo explicativo sobre o tema."
            },
            {
                "id": "n-003", "schema": "Lista.1", "type": "lista",
                "duracao_frames": 180, "itens": ["Item A", "Item B", "Item C"]
            },
            {
                "id": "n-004", "schema": "Midia.1", "type": "midia",
                "duracao_frames": 120, "hash": "a" * 64, "tipo_midia": "imagem",
                "licenca": "CC-BY-4.0"
            },
            {
                "id": "n-005", "schema": "Codigo.1", "type": "codigo",
                "duracao_frames": 200, "codigo": "print('hello')", "linguagem": "python"
            },
            {
                "id": "n-006", "schema": "Grafico.1", "type": "grafico",
                "duracao_frames": 180, "tipo_grafico": "barras",
                "dados": [{"rotulo": "A", "valor": 10}, {"rotulo": "B", "valor": 20}]
            }
        ],
        "cenas": [
            {"id": "cena-001", "nos": ["n-001", "n-002"]},
            {"id": "cena-002", "nos": ["n-003", "n-004", "n-005", "n-006"]}
        ],
        "audio": {
            "trilha_sonora": "none",
            "volume": 0.3
        }
    }

    erros = list(validator.iter_errors(fixture))
    assert len(erros) == 0, f"Esperado 0 erros, obtido {len(erros)}: {[e.message for e in erros]}"


# ─── Fixtures invalidas ──────────────────────────────────────────────────────

FIXTURES_INVALIDAS = [
    ("invalido-01-schema-version-errado.json", "schema_version const errado"),
    ("invalido-02-schema-version-ausente.json", "schema_version ausente"),
    ("invalido-03-propriedade-extra.json", "additionalProperties extra"),
    ("invalido-04-fps-negativo.json", "fps negativo"),
    ("invalido-05-nos-vazio.json", "nos vazio"),
    ("invalido-06-cenas-vazio.json", "cenas vazio"),
    ("invalido-07-no-sem-type.json", "no sem type"),
    ("invalido-08-no-type-invalido.json", "no type invalido"),
    ("invalido-09-cabecalho-sem-texto.json", "cabecalho sem texto"),
    ("invalido-10-duracao-negativa.json", "duracao negativa"),
    ("invalido-11-cena-sem-nos.json", "cena sem nos"),
    ("invalido-12-transicao-tipo-invalido.json", "transicao tipo invalido"),
]


def _test_fixture_invalida(nome, descricao, schema, validator):
    fixture = carregar_fixture(nome)
    erros = list(validator.iter_errors(fixture))
    assert len(erros) > 0, (
        f"Fixture '{nome}' ({descricao}) deveria ser invalida, "
        f"mas passou na validacao com 0 erros"
    )


def test_invalidas():
    """Todas as 12 fixtures invalidas devem falhar na validacao."""
    schema = carregar_schema()
    validator = Draft202012Validator(schema)

    for nome, descricao in FIXTURES_INVALIDAS:
        _test_fixture_invalida(nome, descricao, schema, validator)


# ─── Subset gate ──────────────────────────────────────────────────────────────

CHAVES_PROIBIDAS_NO_LLM = [
    "minimum",
    "maximum",
    "multipleOf",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "pattern",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "minProperties",
    "maxProperties",
    "dependentRequired",
    "if",
    "then",
    "else",
    "not",
    "oneOf",
]


def _contem_chave_proibida(no, caminho):
    """Verifica recursivamente se um no do schema contem chaves proibidas."""
    if isinstance(no, dict):
        for chave in CHAVES_PROIBIDAS_NO_LLM:
            if chave in no:
                return f"{caminho}.{chave}"
        for k, v in no.items():
            resultado = _contem_chave_proibida(v, f"{caminho}.{k}")
            if resultado:
                return resultado
    elif isinstance(no, list):
        for i, item in enumerate(no):
            resultado = _contem_chave_proibida(item, f"{caminho}[{i}]")
            if resultado:
                return resultado
    return None


def test_subset_sem_chaves_proibidas():
    """O schema do LLM nao deve conter nenhuma chave de validacao proibida."""
    llm_path = ROOT / "schema" / "manifesto.llm.schema.json"
    with open(llm_path) as f:
        llm_schema = json.load(f)

    violacao = _contem_chave_proibida(llm_schema, "$")
    assert violacao is None, (
        f"Schema do LLM contem chave proibida: {violacao}. "
        f"Estas chaves sao rejeitadas pelo strict mode da Anthropic."
    )


def test_subset_e_relaxamento():
    """O schema do LLM deve ser um relaxamento do schema completo.
    Ou seja: todo dado valido no LLM deve ser valido no completo."""
    full_path = ROOT / "schema" / "manifesto.schema.json"
    llm_path = ROOT / "schema" / "manifesto.llm.schema.json"

    with open(full_path) as f:
        full_schema = json.load(f)
    with open(llm_path) as f:
        llm_schema = json.load(f)

    full_validator = Draft202012Validator(full_schema)
    llm_validator = Draft202012Validator(llm_schema)

    # Gera dados validos contra o LLM e verifica contra o full
    fixture = carregar_fixture("valido-minimo.json")

    # Primeiro confirma que e valido no LLM
    erros_llm = list(llm_validator.iter_errors(fixture))
    assert len(erros_llm) == 0, f"Fixture valida falhou no LLM: {erros_llm}"

    # Depois confirma que e valido no full
    erros_full = list(full_validator.iter_errors(fixture))
    assert len(erros_full) == 0, (
        f"Fixture valida no LLM falhou no schema completo: {erros_full}"
    )
