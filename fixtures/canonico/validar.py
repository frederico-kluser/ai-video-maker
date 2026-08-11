#!/usr/bin/env python3
"""
validar.py — Valida fixtures do manifesto contra o JSON Schema 2020-12.

Uso:
  python3 fixtures/canonico/validar.py [--schema PATH] [--fixture PATH]

Sem argumentos, valida todas as fixtures em fixtures/canonico/ contra
schema/manifesto.schema.json.

Flags:
  --schema PATH   Caminho para o schema (default: schema/manifesto.schema.json)
  --fixture PATH  Caminho para uma fixture especifica (default: todas em fixtures/canonico/)
  --verbose       Mostra erros detalhados de validacao
  --quiet         Suprime saida de sucesso (so imprime erros)

Exit codes:
  0 — todas as fixtures validas passaram e todas as invalidas falharam
  1 — erro de uso (arquivo ausente, JSON malformado)
  2 — uma fixture valida falhou na validacao (regressao)
  3 — uma fixture invalida passou na validacao (escape)
"""

import json
import sys
import os
from pathlib import Path

# jsonschema e uma dependencia opcional para validacao 2020-12.
# Fallback: validacao estrutural basica (sem schema, so parse + checagem de chaves).
try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False


# ─── Constantes ────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCHEMA_DEFAULT = REPO_ROOT / "schema" / "manifesto.schema.json"
FIXTURES_DIR = Path(__file__).resolve().parent

# Classificacao: cada fixture invalida tem uma classificacao CONTRATO ou BUG
# CONTRATO = o schema explicitamente rejeita (ex.: enum invalido, required faltando)
# BUG      = o schema deveria rejeitar mas nao rejeita, ou o validador tem uma falha
CLASSIFICACAO = {
    "manifesto-invalido-01-schema-version-faltando.json": {
        "classificacao": "CONTRATO",
        "erro_esperado": "required property 'schema_version' missing",
        "descricao": "Campo obrigatorio schema_version ausente no topo do manifesto",
    },
    "manifesto-invalido-02-tipo-no-invalido.json": {
        "classificacao": "CONTRATO",
        "erro_esperado": "no anyOf match for unknown node type 'invalido'",
        "descricao": "Tipo de no 'invalido' nao casa nenhum const no anyOf",
    },
    "manifesto-invalido-03-duracao-negativa.json": {
        "classificacao": "CONTRATO",
        "erro_esperado": "duracao_frames < minimum 1",
        "descricao": "duracao_frames negativa viola minimum: 1",
    },
    "manifesto-invalido-04-cabecalho-sem-texto.json": {
        "classificacao": "CONTRATO",
        "erro_esperado": "required property 'texto' missing in NoCabecalho",
        "descricao": "NoCabecalho sem campo obrigatorio 'texto'",
    },
    "manifesto-invalido-05-cena-no-inexistente.json": {
        "classificacao": "BUG",
        "erro_esperado": "cena referencia no 'n-999' que nao existe no array 'nos'",
        "descricao": "Cena referencia id de no que nao existe. O JSON Schema valida string, "
                      "mas nao tem $ref cruzado entre arrays — a checagem de integridade "
                      "referencial e da camada de negocio, nao do schema.",
    },
    "manifesto-invalido-06-propriedade-extra.json": {
        "classificacao": "CONTRATO",
        "erro_esperado": "additionalProperties not allowed: 'cor_fonte'",
        "descricao": "Propriedade 'cor_fonte' nao declarada no schema com additionalProperties: false",
    },
    "manifesto-invalido-07-transicao-tipo-invalido.json": {
        "classificacao": "CONTRATO",
        "erro_esperado": "enum mismatch: 'explosao' not in Transicao.tipo enum",
        "descricao": "Tipo de transicao 'explosao' nao esta no enum de Transicao",
    },
    "manifesto-invalido-08-grafico-tipo-invalido.json": {
        "classificacao": "CONTRATO",
        "erro_esperado": "enum mismatch: 'radar' not in tipo_grafico enum",
        "descricao": "Tipo de grafico 'radar' nao esta no enum de NoGrafico",
    },
}


# ─── Validacao ──────────────────────────────────────────────────────────────────

def carregar_json(caminho: Path):
    """Carrega e faz parse de um arquivo JSON. Retorna (data, error)."""
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f), None
    except json.JSONDecodeError as e:
        return None, f"JSON invalido: {e}"
    except FileNotFoundError:
        return None, f"Arquivo nao encontrado: {caminho}"
    except Exception as e:
        return None, f"Erro ao ler arquivo: {e}"


def validar_com_jsonschema(instance, schema, caminho_fixture):
    """Valida usando jsonschema (draft 2020-12). Retorna lista de erros."""
    validator = jsonschema.Draft202012Validator(schema)
    erros = list(validator.iter_errors(instance))
    return erros


def validar_estrutural(instance):
    """Validacao estrutural basica sem jsonschema. Retorna lista de strings de erro."""
    erros = []

    if not isinstance(instance, dict):
        erros.append("Topo deve ser um objeto JSON")
        return erros

    # Campos obrigatorios de topo
    for campo in ["schema_version", "fps", "width", "height", "nos", "cenas"]:
        if campo not in instance:
            erros.append(f"Campo obrigatorio ausente: '{campo}'")

    # schema_version
    if instance.get("schema_version") != "Manifesto.1":
        erros.append(f"schema_version deve ser 'Manifesto.1', recebido: {instance.get('schema_version')}")

    # nos array
    nos = instance.get("nos", [])
    if not isinstance(nos, list) or len(nos) == 0:
        erros.append("'nos' deve ser um array nao-vazio")
    else:
        for i, no in enumerate(nos):
            if not isinstance(no, dict):
                erros.append(f"nos[{i}] deve ser um objeto")
                continue
            for campo in ["id", "schema", "type", "duracao_frames"]:
                if campo not in no:
                    erros.append(f"nos[{i}]: campo obrigatorio '{campo}' ausente")
            if no.get("type") not in ("cabecalho", "texto", "lista", "midia", "codigo", "grafico"):
                erros.append(f"nos[{i}]: type '{no.get('type')}' invalido")
            if isinstance(no.get("duracao_frames"), (int, float)) and no["duracao_frames"] < 1:
                erros.append(f"nos[{i}]: duracao_frames={no['duracao_frames']} < 1")

    # cenas array
    cenas = instance.get("cenas", [])
    if not isinstance(cenas, list) or len(cenas) == 0:
        erros.append("'cenas' deve ser um array nao-vazio")
    else:
        ids_nos = {no["id"] for no in nos if isinstance(no, dict) and "id" in no}
        for i, cena in enumerate(cenas):
            if not isinstance(cena, dict):
                erros.append(f"cenas[{i}] deve ser um objeto")
                continue
            for campo in ["id", "nos"]:
                if campo not in cena:
                    erros.append(f"cenas[{i}]: campo obrigatorio '{campo}' ausente")
            cena_nos = cena.get("nos", [])
            if isinstance(cena_nos, list):
                if len(cena_nos) == 0:
                    erros.append(f"cenas[{i}]: array 'nos' vazio (minItems: 1)")
                for nid in cena_nos:
                    if nid not in ids_nos:
                        erros.append(f"cenas[{i}]: referencia a no '{nid}' que nao existe")

    return erros


def formatar_erros_jsonschema(erros):
    """Formata erros do jsonschema para exibicao."""
    linhas = []
    for err in erros:
        caminho = " → ".join(str(p) for p in err.absolute_path) if err.absolute_path else "(raiz)"
        linhas.append(f"  {caminho}: {err.message}")
    return linhas


# ─── Main ───────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Valida fixtures do manifesto contra JSON Schema")
    parser.add_argument("--schema", type=Path, default=SCHEMA_DEFAULT,
                        help="Caminho para o schema JSON")
    parser.add_argument("--fixture", type=Path, default=None,
                        help="Caminho para uma fixture especifica")
    parser.add_argument("--verbose", action="store_true",
                        help="Mostra erros detalhados")
    parser.add_argument("--quiet", action="store_true",
                        help="Suprime saida de sucesso")
    args = parser.parse_args()

    # Carregar schema
    schema, err = carregar_json(args.schema)
    if err:
        print(f"ERRO: Nao foi possivel carregar o schema: {err}", file=sys.stderr)
        sys.exit(1)

    # Determinar fixtures a validar
    if args.fixture:
        fixtures = [args.fixture]
    else:
        fixtures = sorted(FIXTURES_DIR.glob("manifesto-*.json"))

    if not fixtures:
        print("Nenhuma fixture encontrada.", file=sys.stderr)
        sys.exit(1)

    validas = []
    invalidas = []
    erros_validacao = []
    escapes = []

    for caminho in fixtures:
        nome = caminho.name
        data, err = carregar_json(caminho)
        if err:
            print(f"ERRO: {nome}: {err}", file=sys.stderr)
            sys.exit(1)

        if HAS_JSONSCHEMA:
            erros = validar_com_jsonschema(data, schema, caminho)
            tem_erro = len(erros) > 0
        else:
            erros_estrut = validar_estrutural(data)
            tem_erro = len(erros_estrut) > 0
            erros = erros_estrut  # lista de strings

        if nome.startswith("manifesto-valido"):
            validas.append(nome)
            if tem_erro:
                erros_validacao.append((nome, erros))
                if not args.quiet:
                    print(f"FALHA: {nome} — fixture valida foi rejeitada pelo schema")
                    if args.verbose:
                        if HAS_JSONSCHEMA:
                            for linha in formatar_erros_jsonschema(erros):
                                print(linha)
                        else:
                            for e in erros:
                                print(f"  {e}")
            else:
                if not args.quiet:
                    print(f"OK: {nome} — valida, passou no schema")
        else:
            invalidas.append(nome)
            if not tem_erro:
                escapes.append(nome)
                if not args.quiet:
                    print(f"ESCAPE: {nome} — fixture invalida NAO foi rejeitada pelo schema")
            else:
                if not args.quiet:
                    print(f"OK: {nome} — invalida, rejeitada pelo schema")

    # ─── Resumo ────────────────────────────────────────────────────────────────
    print()
    print("=" * 60)
    print("RESUMO DA VALIDACAO")
    print("=" * 60)
    print(f"  Schema:        {args.schema}")
    print(f"  Validador:     {'jsonschema (draft 2020-12)' if HAS_JSONSCHEMA else 'estrutural basico (jsonschema nao instalado)'}")
    print(f"  Fixtures:      {len(fixtures)} encontradas")
    print(f"  Validas:       {len(validas)} ({len(erros_validacao)} falhas)")
    print(f"  Invalidas:     {len(invalidas)} ({len(escapes)} escapes)")
    print()

    if erros_validacao:
        print("FIXTURES VALIDAS QUE FALHARAM (REGRESSAO):")
        for nome, _ in erros_validacao:
            print(f"  - {nome}")
        print()

    if escapes:
        print("FIXTURES INVALIDAS QUE PASSARAM (ESCAPE):")
        for nome in escapes:
            info = CLASSIFICACAO.get(nome, {})
            print(f"  - {nome} [{info.get('classificacao', '?')}] {info.get('descricao', '')}")
        print()

    # Tabela CONTRATO x BUG
    print("CLASSIFICACAO CONTRATO x BUG:")
    print(f"  {'Fixture':<55} {'Classif.':<10} {'Validacao':<12}")
    print(f"  {'-'*55} {'-'*10} {'-'*12}")
    for nome in sorted(invalidas):
        info = CLASSIFICACAO.get(nome, {})
        clas = info.get("classificacao", "?")
        if HAS_JSONSCHEMA:
            data, _ = carregar_json(FIXTURES_DIR / nome)
            js_erros = validar_com_jsonschema(data, schema, FIXTURES_DIR / nome)
            status = "REJEITADO" if js_erros else "ESCAPOU"
        else:
            data, _ = carregar_json(FIXTURES_DIR / nome)
            est_erros = validar_estrutural(data)
            status = "REJEITADO" if est_erros else "ESCAPOU"
        print(f"  {nome:<55} {clas:<10} {status:<12}")
    print()

    # Exit code
    if erros_validacao:
        sys.exit(2)  # regressao
    if escapes:
        sys.exit(3)  # escape
    sys.exit(0)


if __name__ == "__main__":
    main()
