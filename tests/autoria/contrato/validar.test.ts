/**
 * tests/autoria/contrato/validar.test.ts
 *
 * A validacao da saida da autoria contra o schema COMPLETO (draft 2020-12).
 * As fixtures validas passam; as invalidas sao rejeitadas com erros
 * nomeados. E a base do `just autoria-contrato`.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validarSaidaAutoria } from "../../../src/autoria/contrato/validar.js";

const FIXTURES = join(__dirname, "fixtures");

function carregar(nome: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as unknown;
}

const FIXTURES_VALIDAS = ["valido-minimo.json", "valido-todos-nos.json"];

const FIXTURES_INVALIDAS: Array<[string, string]> = [
  ["invalido-schema-version-errado.json", "schema_version errado"],
  ["invalido-midia-sem-texto-alternativo.json", "midia sem texto_alternativo (AB-433)"],
  ["invalido-midia-com-hash-sem-texto.json", "midia com hash mas sem texto_alternativo (AB-433)"],
  ["invalido-tenta-emitir-frames.json", "no tenta emitir duracao_frames (decisao do sistema)"],
  ["invalido-tenta-emitir-cor.json", "no tenta emitir cor (decisao do sistema)"],
  ["invalido-tenta-emitir-coordenada.json", "no tenta emitir coordenada (decisao do sistema)"],
  ["invalido-tipo-desconhecido.json", "no com type fora do vocabulario"],
  ["invalido-transicao-com-duracao.json", "transicao com duracao_frames (decisao do sistema)"],
];

describe("contrato de autoria v1 — validacao contra o schema completo", () => {
  for (const nome of FIXTURES_VALIDAS) {
    it(`aceita a fixture valida ${nome}`, () => {
      const resultado = validarSaidaAutoria(carregar(nome));
      expect(resultado.valido, resultado.erros.join("; ")).toBe(true);
      expect(resultado.erros).toEqual([]);
    });
  }

  for (const [nome, descricao] of FIXTURES_INVALIDAS) {
    it(`rejeita a fixture invalida ${nome} (${descricao})`, () => {
      const resultado = validarSaidaAutoria(carregar(nome));
      expect(resultado.valido, `esperado invalido: ${descricao}`).toBe(false);
      expect(resultado.erros.length).toBeGreaterThan(0);
    });
  }

  it("o erro carrega o caminho JSON do campo que falhou (nao so 'invalido')", () => {
    const resultado = validarSaidaAutoria(carregar("invalido-tenta-emitir-frames.json"));
    expect(resultado.erros.some((e) => e.includes("duracao_frames"))).toBe(true);
  });
});
