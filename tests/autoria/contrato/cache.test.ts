/**
 * tests/autoria/contrato/cache.test.ts
 *
 * Criterio do card: "a mesma entrada NAO chama a API duas vezes; mudar
 * QUALQUER componente da chave gera MISS" (C12 — teste muda um parametro
 * por vez e exige cache miss).
 *
 * O gerador e injetado (contador de chamadas): o contrato nunca fala com
 * fornecedor nenhum — a mecanica do cache e o que este teste prova.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buscarOuGerar,
  chaveDeCache,
  definirDiretorioCache,
  escreverNoCache,
  lerDoCache,
  obterDiretorioCache,
} from "../../../src/autoria/contrato/cache.js";
import type { EntradaAutoria } from "../../../src/autoria/contrato/contrato.js";

const DIRETORIO_ORIGINAL = obterDiretorioCache();

function entradaBase(sobrescrita: Partial<EntradaAutoria> = {}): EntradaAutoria {
  return {
    model: "claude-sonnet-4-6",
    system: "Voce e o autor de videos educativos.",
    tools: [],
    messages: [{ role: "user", content: "Tema: como funciona um cache" }],
    output_config: {
      type: "json_schema",
      name: "documento_autoria",
      schema: { type: "object" },
    },
    schema_version: "Autoria.1",
    ...sobrescrita,
  };
}

const SAIDA_EXEMPLO = { schema_version: "Autoria.1", nos: [], cenas: [] };

describe("cache de autoria — HIT/MISS", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "autoria-cache-"));
    definirDiretorioCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  afterAll(() => {
    definirDiretorioCache(DIRETORIO_ORIGINAL);
  });

  it("a mesma entrada NAO chama o gerador duas vezes (HIT na segunda)", () => {
    let chamadas = 0;
    const gerador = (): unknown => {
      chamadas++;
      return SAIDA_EXEMPLO;
    };

    const primeira = buscarOuGerar(entradaBase(), gerador);
    const segunda = buscarOuGerar(entradaBase(), gerador);

    expect(chamadas).toBe(1);
    expect(primeira).toEqual(segunda);
  });

  it("a saida cacheada persiste em disco sob o hash da chave", () => {
    const entrada = entradaBase();
    buscarOuGerar(entrada, () => SAIDA_EXEMPLO);
    const caminho = join(dir, `${chaveDeCache(entrada)}.json`);
    expect(existsSync(caminho)).toBe(true);
    expect(lerDoCache(entrada)).toEqual(SAIDA_EXEMPLO);
  });

  it("entrada sem cache gera MISS e o gerador roda", () => {
    let chamadas = 0;
    buscarOuGerar(entradaBase(), () => {
      chamadas++;
      return SAIDA_EXEMPLO;
    });
    expect(chamadas).toBe(1);
  });

  it("escreverNoCache + lerDoCache sao o par fechado (mesma entrada, mesmo arquivo)", () => {
    const entrada = entradaBase();
    escreverNoCache(entrada, SAIDA_EXEMPLO);
    expect(lerDoCache(entrada)).toEqual(SAIDA_EXEMPLO);
  });
});

describe("cache de autoria — C12: cada componente da chave gera MISS", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "autoria-cache-"));
    definirDiretorioCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  afterAll(() => {
    definirDiretorioCache(DIRETORIO_ORIGINAL);
  });

  const MUTACOES: Array<[string, Partial<EntradaAutoria>]> = [
    ["model", { model: "claude-haiku-4-5" }],
    ["system", { system: "Outro sistema de autoria." }],
    ["tools", { tools: [{ name: "ferramenta-extra" }] }],
    ["messages", { messages: [{ role: "user", content: "Outro tema" }] }],
    [
      "output_config",
      { output_config: { type: "json_schema", name: "documento_autoria", schema: { type: "object", required: ["x"] } } },
    ],
    ["schema_version", { schema_version: "Autoria.2" }],
    ["tentativa", { tentativa: 2 }],
  ];

  for (const [nome, mutacao] of MUTACOES) {
    it(`mudar ${nome} gera MISS (chave diferente, gerador chamado de novo)`, () => {
      const base = entradaBase();
      const mutada = entradaBase(mutacao);

      expect(chaveDeCache(base)).not.toBe(chaveDeCache(mutada));

      let chamadas = 0;
      const gerador = (): unknown => {
        chamadas++;
        return SAIDA_EXEMPLO;
      };

      buscarOuGerar(base, gerador);
      buscarOuGerar(mutada, gerador);

      expect(chamadas).toBe(2);
    });
  }

  it("a ordem das chaves na entrada nao muda a chave do cache", () => {
    const a = chaveDeCache(entradaBase());
    // Mesmo conteudo, ordem de chaves diferente no objeto raiz.
    const bagunçada = { ...entradaBase() };
    const reordenada = { model: bagunçada.model, messages: bagunçada.messages, schema_version: bagunçada.schema_version, system: bagunçada.system, tools: bagunçada.tools, output_config: bagunçada.output_config };
    expect(chaveDeCache(reordenada)).toBe(a);
  });
});
