"""
tests/sincronia/test_schema_timing.py

Segunda implementacao do oraculo do schema do timing canonico (F3-01):
a suite TS valida com ajv; esta valida o MESMO schema com a implementacao
python (jsonschema) — duas implementacoes que discordam sobre a mesma
fixture e uma falha que nem ajv nem TS enxergam sozinhos.

O que este arquivo prova:
  01  a fixture canonica (golden) valida contra schema/timing.schema.json;
  02  uma URL em QUALQUER profundidade do documento e rejeitada
      (SemURLProfundo — C7: nada de endereco abaixo da fronteira);
  03  palavra com fim negativo e rejeitada (duracao negativa, metade do
      oraculo que o JSON Schema consegue expressar — a outra metade, a
      geometria fim>=inicio/ordem/sobreposicao, e do oraculo TS);
  04  entrada de locucao SEM audio e rejeitada (casamento por conteudo
      impossivel — o campo `audio` e a ligacao timing<->audio);
  05  entrada sem `unidade` declarada e rejeitada (contrato-w5 §2).

Requer: jsonschema. Ausencia de jsonschema NAO e skip silencioso — e
falha, porque uma suite que pula a unica prova que tem fica verde sem
provar nada (AGENTS.md C2).
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

RAIZ = Path(__file__).resolve().parents[2]
SCHEMA_TIMING = RAIZ / "schema" / "timing.schema.json"
GOLDEN_TIMING = RAIZ / "fixtures" / "canonico" / "timing-canono.json"


@pytest.fixture(scope="module")
def validador():
    try:
        import jsonschema  # noqa: F401
    except ImportError as erro:
        pytest.fail(f"jsonschema ausente: {erro}")
    with SCHEMA_TIMING.open("r", encoding="utf-8") as arquivo:
        schema = json.load(arquivo)
    return Draft202012Validator(schema)


def carregar_golden():
    with GOLDEN_TIMING.open("r", encoding="utf-8") as arquivo:
        return json.load(arquivo)


def test_01_fixture_canonica_valida_contra_o_schema(validador):
    documento = carregar_golden()
    erros = sorted(validador.iter_errors(documento), key=lambda e: e.json_path)
    assert erros == [], "\n".join(e.message for e in erros)


def test_02_url_em_qualquer_profundidade_e_rejeitada(validador):
    documento = carregar_golden()
    # A URL entra por tres profundidades: valor de texto, nome de
    # propriedade e dentro de um array de silencio (nao pode entrar em
    # nenhuma).
    documento["cenas"]["c-004"]["texto"] += " veja https://exemplo.com/x"
    assert validador.is_valid(documento) is False

    documento = carregar_golden()
    documento["cenas"]["http://url-como-nome"] = documento["cenas"]["c-001"]
    assert validador.is_valid(documento) is False

    documento = carregar_golden()
    documento["cenas"]["c-004"]["silencio"][0]["//cdn.exemplo/a"] = 1
    assert validador.is_valid(documento) is False


def test_03_palavra_com_fim_negativo_e_rejeitada(validador):
    documento = carregar_golden()
    palavra = documento["cenas"]["c-004"]["palavras"][0]
    palavra["fim_s"] = -0.5
    assert validador.is_valid(documento) is False


def test_04_entrada_de_locucao_sem_audio_e_rejeitada(validador):
    documento = carregar_golden()
    del documento["cenas"]["c-004"]["audio"]
    assert validador.is_valid(documento) is False


def test_05_entrada_sem_unidade_declarada_e_rejeitada(validador):
    documento = carregar_golden()
    del documento["cenas"]["c-001"]["unidade"]
    assert validador.is_valid(documento) is False
