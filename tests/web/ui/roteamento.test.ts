// =============================================================================
// ROTEAMENTO POR HASH — funcoes PURAS (parsearHash/montarHash)
// =============================================================================
// Onda 6 (spa-frontend): o roteamento da SPA e hash puro (decisao
// documentada em src/web/ui/src/roteamento.ts — zero deps, o servidor
// serve o index como fallback e o hash nunca chega a ele).
// =============================================================================

import { describe, expect, it } from "vitest";
import { montarHash, parsearHash } from "../../../src/web/ui/src/roteamento.js";

describe("parsearHash", () => {
  it("hash vazio e raiz caem em novo-projeto", () => {
    expect(parsearHash("")).toEqual({ nome: "novo-projeto" });
    expect(parsearHash("#")).toEqual({ nome: "novo-projeto" });
    expect(parsearHash("#/")).toEqual({ nome: "novo-projeto" });
  });

  it("hash de projeto devolve o id", () => {
    expect(parsearHash("#/projeto/proj-001")).toEqual({ nome: "projeto", id: "proj-001" });
  });

  it("projeto sem id nao vira projeto fantasma", () => {
    expect(parsearHash("#/projeto/")).toEqual({ nome: "novo-projeto" });
    expect(parsearHash("#/projeto")).toEqual({ nome: "novo-projeto" });
  });

  it("rota desconhecida cai em novo-projeto (nunca tela em branco)", () => {
    expect(parsearHash("#/lixo")).toEqual({ nome: "novo-projeto" });
    expect(parsearHash("#/projeto/proj-001/extra")).toEqual({ nome: "projeto", id: "proj-001" });
  });
});

describe("montarHash (round-trip)", () => {
  it("round-trip com parsearHash", () => {
    expect(parsearHash(montarHash({ nome: "novo-projeto" }))).toEqual({ nome: "novo-projeto" });
    expect(parsearHash(montarHash({ nome: "projeto", id: "proj-abc" }))).toEqual({ nome: "projeto", id: "proj-abc" });
  });
});
