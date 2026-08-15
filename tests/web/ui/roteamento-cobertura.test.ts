// =============================================================================
// ROTEAMENTO POR HASH — COBERTURA COMPLEMENTAR (hash malformados)
// =============================================================================
// Completa roteamento.test.ts nos hashes malformados: barras duplicadas,
// hash sem '#', multiplos '#' e segmentos extras em sequencia.
// =============================================================================

import { describe, expect, it } from "vitest";
import { montarHash, parsearHash } from "../../../src/web/ui/src/roteamento.js";

describe("parsearHash — hashes malformados", () => {
  it("barras duplicadas sao absorvidas (partes vazias filtradas)", () => {
    expect(parsearHash("#//projeto//p-001//")).toEqual({ nome: "projeto", id: "p-001" });
    expect(parsearHash("#///")).toEqual({ nome: "novo-projeto" });
  });

  it("hash sem o '#' e aceito (o '#' e opcional na entrada)", () => {
    expect(parsearHash("projeto/p-001")).toEqual({ nome: "projeto", id: "p-001" });
  });

  it("dois '#' nao formam rota conhecida (so o primeiro e removido)", () => {
    expect(parsearHash("###/projeto/p-001")).toEqual({ nome: "novo-projeto" });
  });

  it("segmentos extras em sequencia sao descartados (o id e o segundo segmento)", () => {
    expect(parsearHash("#/projeto/p-001/p-002/coisa")).toEqual({ nome: "projeto", id: "p-001" });
  });

  it("query string no hash nao e parseada — caracterizacao do comportamento atual", () => {
    // O navegador nao produz "#/projeto/p-001?x=1" em fluxos normais;
    // o teste pina o comportamento atual (a query permanece no id).
    expect(parsearHash("#/projeto/p-001?x=1")).toEqual({ nome: "projeto", id: "p-001?x=1" });
  });
});

describe("montarHash — ids do contrato", () => {
  it("round-trip com ids reais do contrato (proj-XXX)", () => {
    for (const id of ["proj-001", "proj-abc", "proj-9f8e7d6c"]) {
      expect(parsearHash(montarHash({ nome: "projeto", id }))).toEqual({ nome: "projeto", id });
    }
  });
});
