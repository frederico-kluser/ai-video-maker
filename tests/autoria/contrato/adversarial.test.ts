/**
 * tests/autoria/contrato/adversarial.test.ts
 *
 * Pergunta adversarial 1 do card F4-01:
 *   "O LLM consegue emitir coordenada, cor ou duracao em frames?
 *    Deve ser IMPOSSIVEL pelo schema."
 *
 * Duas camadas de evidencia:
 *   1. DADOS — fixtures que TENTAM emitir duracao_frames, cor e
 *      coordenada sao rejeitadas pela validacao (additionalProperties:false).
 *   2. SCHEMA — uma varredura do schema completo confirma que nenhum campo
 *      de decisao do sistema existe como propriedade em lugar nenhum: o
 *      campo nao pode ser emitido porque nao existe para ser emitido.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validarSaidaAutoria } from "../../../src/autoria/contrato/validar.js";
import { CAMINHO_SCHEMA_COMPLETO } from "../../../src/autoria/contrato/contrato.js";

const FIXTURES = join(__dirname, "fixtures");

/** Campos que o SISTEMA decide e que o LLM nao pode emitir (narrativa apenas). */
const CAMPOS_DE_DECISAO_DO_SISTEMA = [
  "duracao_frames",
  "entrada_frames",
  "inicio_frames",
  "duracao_total_frames",
  "fps",
  "width",
  "height",
  "cor",
  "x",
  "y",
  "coordenada",
  "alinhamento",
  "layout",
  "ajuste",
];

function carregar(nome: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as unknown;
}

/** Varre o schema e devolve todos os nomes de propriedade declarados. */
function coletarPropriedades(no: unknown, acumulador: Set<string>): void {
  if (Array.isArray(no)) {
    for (const item of no) {
      coletarPropriedades(item, acumulador);
    }
    return;
  }
  if (no !== null && typeof no === "object") {
    const objeto = no as Record<string, unknown>;
    if (objeto.properties && typeof objeto.properties === "object") {
      for (const chave of Object.keys(objeto.properties)) {
        acumulador.add(chave);
      }
    }
    for (const valor of Object.values(objeto)) {
      coletarPropriedades(valor, acumulador);
    }
  }
}

describe("adversarial 1 — coordenada, cor e duracao em frames sao IMPOSSIVEIS pelo schema", () => {
  it("fixture que tenta emitir duracao_frames e REJEITADA", () => {
    const resultado = validarSaidaAutoria(carregar("invalido-tenta-emitir-frames.json"));
    expect(resultado.valido).toBe(false);
  });

  it("fixture que tenta emitir cor e REJEITADA", () => {
    const resultado = validarSaidaAutoria(carregar("invalido-tenta-emitir-cor.json"));
    expect(resultado.valido).toBe(false);
  });

  it("fixture que tenta emitir coordenada (x/y) e REJEITADA", () => {
    const resultado = validarSaidaAutoria(carregar("invalido-tenta-emitir-coordenada.json"));
    expect(resultado.valido).toBe(false);
  });

  it("transicao com duracao_frames e REJEITADA", () => {
    const resultado = validarSaidaAutoria(carregar("invalido-transicao-com-duracao.json"));
    expect(resultado.valido).toBe(false);
  });

  it("nenhum campo de decisao do sistema existe como propriedade no schema", () => {
    const schema = JSON.parse(readFileSync(CAMINHO_SCHEMA_COMPLETO, "utf-8")) as unknown;
    const declaradas = new Set<string>();
    coletarPropriedades(schema, declaradas);

    const presentes = CAMPOS_DE_DECISAO_DO_SISTEMA.filter((campo) =>
      declaradas.has(campo),
    );
    expect(presentes, `campos de decisao do sistema declarados no schema: ${presentes.join(", ")}`).toEqual(
      [],
    );
  });

  it("o documento de autoria nao declara resolucao (fps/width/height sao do sistema)", () => {
    const schema = JSON.parse(readFileSync(CAMINHO_SCHEMA_COMPLETO, "utf-8")) as unknown;
    const declaradas = new Set<string>();
    coletarPropriedades(schema, declaradas);
    expect(declaradas.has("fps")).toBe(false);
    expect(declaradas.has("width")).toBe(false);
    expect(declaradas.has("height")).toBe(false);
  });
});
