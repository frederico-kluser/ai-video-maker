/**
 * tests/autoria/contrato/canonicalizar.test.ts
 *
 * A canonicalizacao da chave de cache (skill llm-authoring): chaves
 * ordenadas recursivamente, separadores compactos — sem isso o hash muda
 * sem o conteudo mudar. Ordem de ARRAY e preservada: ela muda o conteudo.
 */

import { describe, expect, it } from "vitest";
import { canonicalizar } from "../../../src/autoria/contrato/canonicalizar.js";

describe("canonicalizar — chaves ordenadas, conteudo preservado", () => {
  it("ordena chaves de objetos em todos os niveis", () => {
    expect(canonicalizar({ b: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"b":1}',
    );
  });

  it("a ordem das chaves do objeto de entrada nao muda a string", () => {
    expect(canonicalizar({ a: 1, b: 2 })).toBe(canonicalizar({ b: 2, a: 1 }));
  });

  it("ordem de array E significativa (muda a string)", () => {
    expect(canonicalizar({ a: [1, 2] })).not.toBe(canonicalizar({ a: [2, 1] }));
  });

  it("objetos dentro de arrays tambem sao ordenados", () => {
    expect(canonicalizar({ lista: [{ b: 1, a: 2 }] })).toBe(
      '{"lista":[{"a":2,"b":1}]}',
    );
  });

  it("escalares passam intactos (string, numero, bool, null)", () => {
    expect(canonicalizar(null)).toBe("null");
    expect(canonicalizar(7)).toBe("7");
    expect(canonicalizar(true)).toBe("true");
    expect(canonicalizar("x")).toBe('"x"');
  });

  it("nao introduz espacos (separadores compactos)", () => {
    const s = canonicalizar({ a: [1, { c: true }] });
    expect(s).toContain(":");
    expect(s).not.toContain(": ");
    expect(s).not.toContain(", ");
  });
});
