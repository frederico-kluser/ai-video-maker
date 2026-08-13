/**
 * src/autoria/contrato/validar.ts
 *
 * Validacao da saida da autoria contra o schema COMPLETO (draft 2020-12).
 *
 * Ordem obrigatoria (skill llm-authoring, "Validacao e gate, nao etapa"):
 * gerar -> validar contra o schema completo -> SO ENTAO tocar o pipeline.
 * O schema completo carrega as invariantes de negocio (tetos, tamanhos)
 * que os schemas podados nao podem carregar no modo estrito; por isso a
 * resposta do LLM e validada aqui, nunca no subset que viajou na chamada.
 */

import { readFileSync } from "node:fs";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import { CAMINHO_SCHEMA_COMPLETO } from "./contrato.js";

export interface ResultadoValidacao {
  valido: boolean;
  erros: string[];
}

const ajv = new Ajv2020({ allErrors: true, strict: false });

let validador: ValidateFunction | undefined;

function carregarValidador(): ValidateFunction {
  if (validador === undefined) {
    const schema = JSON.parse(readFileSync(CAMINHO_SCHEMA_COMPLETO, "utf-8"));
    validador = ajv.compile(schema);
  }
  return validador;
}

/**
 * Valida uma saida contra o schema completo do Documento de Autoria v1.
 * Nunca lanca: devolve valido=false com a lista de erros.
 */
export function validarSaidaAutoria(saida: unknown): ResultadoValidacao {
  const fn = carregarValidador();
  const valido = fn(saida) === true;
  const erros = valido
    ? []
    : (fn.errors ?? []).map((e) => {
        const onde = e.instancePath === "" ? "(raiz)" : e.instancePath;
        const detalhe = e.params && "additionalProperty" in e.params
          ? ` ${String(e.params.additionalProperty)}`
          : "";
        return `${onde}: ${e.message ?? "invalido"}${detalhe}`;
      });
  return { valido, erros };
}
