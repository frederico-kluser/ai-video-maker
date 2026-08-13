/**
 * tests/autoria/contrato/subset.test.ts
 *
 * Os schemas que viajam na chamada (autoria.llm.anthropic.json e
 * autoria.llm.openai.json) tem de caber no subset do modo estrito de CADA
 * fornecedor — chave recusada na chamada e 400 ANTES da inferencia
 * (ADR-0023, tabela por fornecedor, verificada em 2026-08-13):
 *
 *   Anthropic: recusa minimum/maximum/multipleOf, minLength/maxLength,
 *   maxItems e demais constraints de array alem de minItems 0|1, oneOf,
 *   pattern (nao confirmado — ausente por desenho), recursao, $ref externo;
 *   exige additionalProperties:false e enum so de escalares.
 *
 *   OpenAI: recusa allOf, not, if/then/else, dependentRequired/
 *   dependentSchemas; exige TODAS as propriedades em required (opcional via
 *   uniao null), additionalProperties:false em todo objeto, raiz objeto
 *   (nunca anyOf). Recursao e aceita pela OpenAI mas nao usada (profundidade
 *   fixa do v1, teto de desenho ≤ 5 niveis).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import Ajv2020, { type AnySchema } from "ajv/dist/2020.js";
import {
  CAMINHO_SCHEMA_ANTHROPIC,
  CAMINHO_SCHEMA_COMPLETO,
  CAMINHO_SCHEMA_OPENAI,
} from "../../../src/autoria/contrato/contrato.js";
import { join } from "node:path";

const FIXTURES = join(__dirname, "fixtures");

function carregarSchema(caminho: string): AnySchema {
  return JSON.parse(readFileSync(caminho, "utf-8")) as AnySchema;
}

function carregarFixture(nome: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as unknown;
}

/** Remove recursivamente propriedades de valor null (materializacao OpenAI -> canonico). */
function desmaterializar(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(desmaterializar);
  }
  if (valor !== null && typeof valor === "object") {
    const entrada = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(entrada)) {
      if (item !== null) {
        saida[chave] = desmaterializar(item);
      }
    }
    return saida;
  }
  return valor;
}

const COMPLETO = carregarSchema(CAMINHO_SCHEMA_COMPLETO);
const ANTHROPIC = carregarSchema(CAMINHO_SCHEMA_ANTHROPIC);
const OPENAI = carregarSchema(CAMINHO_SCHEMA_OPENAI);

/** Chaves recusadas pelo modo estrito da Anthropic (ADR-0023). */
const RECUSADAS_ANTHROPIC = [
  "minimum",
  "maximum",
  "multipleOf",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "maxItems",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "oneOf",
  "pattern",
  "if",
  "then",
  "else",
  "not",
  "dependentRequired",
  "dependentSchemas",
];

/** Chaves recusadas pelo modo estrito da OpenAI (ADR-0023). */
const RECUSADAS_OPENAI = [
  "allOf",
  "not",
  "if",
  "then",
  "else",
  "dependentRequired",
  "dependentSchemas",
  "oneOf",
  "default",
];

function visitar(no: unknown, fn: (objeto: Record<string, unknown>) => void): void {
  if (Array.isArray(no)) {
    for (const item of no) {
      visitar(item, fn);
    }
    return;
  }
  if (no !== null && typeof no === "object") {
    const objeto = no as Record<string, unknown>;
    fn(objeto);
    for (const valor of Object.values(objeto)) {
      visitar(valor, fn);
    }
  }
}

function objetosDoSchema(schema: unknown): Array<Record<string, unknown>> {
  const objetos: Array<Record<string, unknown>> = [];
  visitar(schema, (objeto) => {
    objetos.push(objeto);
  });
  return objetos;
}

describe("subset Anthropic — so chaves aceitas", () => {
  it("nenhuma chave recusada pela Anthropic esta no schema podado", () => {
    const violacoes: string[] = [];
    visitar(ANTHROPIC, (objeto) => {
      for (const chave of RECUSADAS_ANTHROPIC) {
        if (chave in objeto) {
          violacoes.push(chave);
        }
      }
    });
    expect(violacoes, `chaves recusadas presentes: ${violacoes.join(", ")}`).toEqual([]);
  });

  it("todo minItems e 0 ou 1 (a Anthropic so aceita esses dois)", () => {
    const valores: number[] = [];
    visitar(ANTHROPIC, (objeto) => {
      if (typeof objeto.minItems === "number") {
        valores.push(objeto.minItems as number);
      }
    });
    expect(valores.length).toBeGreaterThan(0);
    for (const v of valores) {
      expect(v, `minItems=${v} fora do {0,1} aceito pela Anthropic`).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("todo objeto com properties tem additionalProperties:false", () => {
    for (const objeto of objetosDoSchema(ANTHROPIC)) {
      if (!("properties" in objeto)) {
        continue;
      }
      expect(
        objeto.additionalProperties,
        `objeto sem additionalProperties:false: ${JSON.stringify(objeto).slice(0, 80)}`,
      ).toBe(false);
    }
  });

  it("$ref e sempre interno (nunca URL externa)", () => {
    visitar(ANTHROPIC, (objeto) => {
      if (typeof objeto.$ref === "string") {
        expect((objeto.$ref as string).startsWith("#/")).toBe(true);
      }
    });
  });
});

describe("subset OpenAI — regras do strict", () => {
  it("nenhuma chave recusada pela OpenAI esta no schema podado", () => {
    const violacoes: string[] = [];
    visitar(OPENAI, (objeto) => {
      for (const chave of RECUSADAS_OPENAI) {
        if (chave in objeto) {
          violacoes.push(chave);
        }
      }
    });
    expect(violacoes, `chaves recusadas presentes: ${violacoes.join(", ")}`).toEqual([]);
  });

  it("a raiz e um objeto, nunca anyOf", () => {
    const raiz = OPENAI as Record<string, unknown>;
    expect(raiz.type).toBe("object");
    expect(raiz.anyOf).toBeUndefined();
  });

  it("todo objeto com properties tem additionalProperties:false", () => {
    for (const objeto of objetosDoSchema(OPENAI)) {
      if (!("properties" in objeto)) {
        continue;
      }
      expect(
        objeto.additionalProperties,
        `objeto sem additionalProperties:false: ${JSON.stringify(objeto).slice(0, 80)}`,
      ).toBe(false);
    }
  });

  it("TODAS as propriedades estao em required (opcional emulado com null)", () => {
    visitar(OPENAI, (objeto) => {
      if (!objeto.properties || typeof objeto.properties !== "object") {
        return;
      }
      const nomes = Object.keys(objeto.properties as Record<string, unknown>);
      const requeridas = (objeto.required ?? []) as string[];
      const faltando = nomes.filter((n) => !requeridas.includes(n));
      expect(
        faltando,
        `propriedades fora de required: ${faltando.join(", ")} em ${JSON.stringify(objeto).slice(0, 100)}`,
      ).toEqual([]);
    });
  });

  it("$ref e sempre interno", () => {
    visitar(OPENAI, (objeto) => {
      if (typeof objeto.$ref === "string") {
        expect((objeto.$ref as string).startsWith("#/")).toBe(true);
      }
    });
  });
});

describe("relacao entre schemas (dois schemas: o que viaja e o que valida)", () => {
  const ajv = new Ajv2020({ strict: false });

  it("o schema completo e valido como JSON Schema 2020-12", () => {
    expect(() => ajv.compile(COMPLETO)).not.toThrow();
  });

  it("o schema podado Anthropic e valido como JSON Schema 2020-12", () => {
    expect(() => ajv.compile(ANTHROPIC)).not.toThrow();
  });

  it("o schema podado OpenAI e valido como JSON Schema 2020-12", () => {
    expect(() => ajv.compile(OPENAI)).not.toThrow();
  });

  it("todo documento valido no completo tambem e valido no podado Anthropic (relaxamento)", () => {
    const completo = ajv.compile(COMPLETO);
    const anthropic = ajv.compile(ANTHROPIC);
    for (const nome of ["valido-minimo.json", "valido-todos-nos.json"]) {
      const doc = carregarFixture(nome);
      expect(completo(doc), `fixture ${nome} deveria ser valida no completo`).toBe(true);
      expect(anthropic(doc), `fixture ${nome} deveria ser valida no podado Anthropic`).toBe(true);
    }
  });

  it("o ciclo OpenAI: materializada valida no podado; desmaterializada valida no completo", () => {
    // O strict da OpenAI obriga TODAS as chaves presentes (opcional = null).
    // A forma materializada e valida no podado OpenAI; o documento CANONICO
    // (opcionais ausentes, nao null) e valido no completo — e o circulo que
    // um consumidor do modo OpenAI fecha ao receber a resposta.
    const completo = ajv.compile(COMPLETO);
    const openai = ajv.compile(OPENAI);
    const doc = carregarFixture("valido-openai-materializado.json");
    expect(openai(doc), "materializada deveria ser valida no podado OpenAI").toBe(true);

    const canonica = desmaterializar(doc);
    expect(completo(canonica), "desmaterializada deveria ser valida no completo").toBe(true);
  });

  it("profundidade de desenho ≤ 5 niveis (interseccao dos tetos dos fornecedores)", () => {
    // Raiz(1) -> nos(2) -> No(3) -> NoX(4) -> escalar(5)
    const raiz = COMPLETO as Record<string, unknown>;
    const nos = raiz.properties as Record<string, { type: string; items: unknown }>;
    const cenas = (raiz.properties as Record<string, unknown>).cenas as Record<
      string,
      unknown
    >;
    const noItems = nos.nos!.items as Record<string, unknown>;
    const cenaItems = cenas.items as Record<string, unknown>;
    expect(raiz.type).toBe("object");
    expect(noItems.anyOf ?? noItems.$ref).toBeTruthy();
    expect(cenaItems.$ref ?? cenaItems.properties).toBeTruthy();
  });
});
