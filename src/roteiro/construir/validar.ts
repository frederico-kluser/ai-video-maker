/**
 * src/roteiro/construir/validar.ts
 *
 * Validacao do Manifesto.1 contra o schema OFICIAL
 * (`schema/manifesto.schema.json`, draft 2020-12 — o unico que valida).
 *
 * DECISAO DE VALIDACAO (documentada): o validador oficial do repositorio
 * e o Python `jsonschema.Draft202012Validator` rodado pelo
 * `just contrato_testar` (`tests/contratos/validar_manifesto_test.py`) sobre
 * `schema/manifesto.schema.json`. Este modulo ESPELHA esse validador em TS
 * (Ajv 2020) compilando O MESMO ARQUIVO de schema — a validacao e a mesma
 * superficie, so o runtime muda. O teste cruzado (FQ-M1 em
 * tests/roteiro/construir.test.ts) roda os DOIS contra a saida do
 * construtor: o Ajv em processo e o Draft202012Validator do Python num
 * subprocesso, com o mesmo JSON. Divergencia entre os dois e vermelho.
 *
 * A escolha de espelhar (em vez de subordinar o construtor ao Python) tem
 * uma razao de pipeline: o construtor roda dentro do servidor Node (Onda 4)
 * e precisa rejeitar a propria saida SEM depender de subprocesso nem de
 * pacote Python instalado. O espelho e o mesmo schema, nao um schema
 * diferente — a armadilha que o gate `contrato_subset` existe para pegar.
 *
 * Ordem identica ao validar.ts do contrato de roteiro: forma primeiro
 * (erros com o caminho JSON do campo), e o consumidor lanca o erro nomeado.
 */

import { readFileSync } from "node:fs";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";

/** Caminho do schema completo do manifesto (draft 2020-12 — o validador). */
export const CAMINHO_SCHEMA_MANIFESTO = new URL(
  "../../../schema/manifesto.schema.json",
  import.meta.url,
).pathname;

export interface ResultadoValidacaoManifesto {
  valido: boolean;
  problemas: string[];
}

/** Erro nomeado: o manifesto NAO passou no schema oficial. */
export class ErroManifestoInvalido extends Error {
  readonly code = "MANIFESTO_INVALIDO";
  readonly problemas: string[];
  constructor(problemas: string[], contexto: string) {
    super(
      `${contexto}: manifesto invalido contra o schema oficial ` +
        `(${problemas.length} problema(s)):\n- ${problemas.join("\n- ")}`,
    );
    this.name = "ErroManifestoInvalido";
    this.problemas = problemas;
  }
}

// ─── Validador de schema (memoizado — o schema so compila uma vez) ─────────────

const ajv = new Ajv2020({ allErrors: true, strict: false });

let validadorDoManifesto: ValidateFunction | undefined;

function obterValidador(): ValidateFunction {
  if (validadorDoManifesto === undefined) {
    // O schema do manifesto e autocontido ($defs internas, sem $ref externo):
    // compila sem registro previo. Compilar uma vez por processo e o mesmo
    // custo que o contrato de roteiro paga (memoizacao la em validar.ts).
    const schema = JSON.parse(readFileSync(CAMINHO_SCHEMA_MANIFESTO, "utf-8"));
    validadorDoManifesto = ajv.compile(schema);
  }
  return validadorDoManifesto;
}

function errosDeSchema(fn: ValidateFunction, valor: unknown): string[] {
  if (fn(valor) === true) {
    return [];
  }
  return (fn.errors ?? []).map((e) => {
    const onde = e.instancePath === "" ? "(raiz)" : e.instancePath;
    const detalhe =
      e.params !== undefined && "additionalProperty" in e.params
        ? ` ${String((e.params as { additionalProperty: unknown }).additionalProperty)}`
        : "";
    return `${onde}: ${e.message ?? "invalido"}${detalhe}`;
  });
}

// ─── API publica ──────────────────────────────────────────────────────────────

/**
 * Valida um valor contra o schema oficial do Manifesto.1.
 *
 * O construtor roda isto CONTRA A PROPRIA SAIDA antes de devolver qualquer
 * manifesto (fail-closed: nunca emite manifesto invalido — C1); o preview
 * e o servidor podem chamar contra qualquer JSON recebido.
 */
export function validarManifestoConstruido(valor: unknown): ResultadoValidacaoManifesto {
  const problemas = errosDeSchema(obterValidador(), valor);
  return { valido: problemas.length === 0, problemas };
}

/** Rejeita um Manifesto invalido com erro nomeado (FQ-M1/FQ-M3). */
export function rejeitarManifestoInvalido(
  valor: unknown,
  contexto: string,
): asserts valor is import("../../contratos/manifesto.js").Manifesto {
  const resultado = validarManifestoConstruido(valor);
  if (!resultado.valido) {
    throw new ErroManifestoInvalido(resultado.problemas, contexto);
  }
}
