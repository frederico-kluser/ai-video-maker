/**
 * tests/roteiro/construir-validar.test.ts
 *
 * A VALIDACAO do Manifesto.1 contra o schema oficial (validar.ts):
 *
 *   - rejeitarManifestoInvalido: erro NOMEADO (ErroManifestoInvalido,
 *     code MANIFESTO_INVALIDO, contexto no topo, problemas listados) —
 *     o fail-closed do construtor e da reducao;
 *   - o validador e REAL: reprova campo extra (additionalProperties:
 *     false — "campo novo sem bump vira falha dura") e tipo errado, com
 *     o caminho JSON do campo no problema;
 *   - schema AUSENTE ou CORROMPIDO: falha ALTA (excecao propagada),
 *     nunca "aceita qualquer coisa" em silencio (C1 — um validador que
 *     nao carrega o schema nao pode passar a validar);
 *   - a FRONTEIRA DA REGRA DE URL: o schema puro do Manifesto.1 NAO tem
 *     a proibicao de URL — ela vale para o manifesto RESOLVIDO e mora na
 *     ponte AB-550 (docs/roteiro/contrato-roteiro.md §5, C7). O que o
 *     construtor garante por CONSTRUCAO: todo endereco de asset no
 *     manifesto emitido e SHA-256 de conteudo (64 hex), nunca URL.
 *
 * A ORDEM dos describes importa: o teste de schema ausente roda ANTES de
 * qualquer compilacao bem-sucedida (obterValidador memoiza o schema) e
 * restaura o modo real ao final.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  rejeitarManifestoInvalido,
  validarManifestoConstruido,
  ErroManifestoInvalido,
} from "../../src/roteiro/construir/validar.js";
import { construirManifesto } from "../../src/roteiro/construir/construir.js";
import type { Roteiro } from "../../src/roteiro/contrato/contrato.js";
import {
  isNoMidia,
  type Manifesto,
  type No,
} from "../../src/contratos/manifesto.js";

const FIXTURES = join(__dirname, "fixtures");

/**
 * Intercepta a leitura do schema oficial: "ausente" e "corrompido"
 * simulam o arquivo sumido/invalido; "real" passa para o disco. O
 * controle e global ao arquivo de teste (vi.hoisted) para o mock poder
 * ler o modo no momento da chamada.
 */
const modoSchema = vi.hoisted(() => ({ modo: "real" as "real" | "ausente" | "corrompido" }));

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    readFileSync: ((caminho: unknown, ...args: unknown[]) => {
      const p = String(caminho);
      if (p.endsWith("manifesto.schema.json")) {
        if (modoSchema.modo === "ausente") {
          const erro = new Error(`ENOENT: no such file or directory, open '${p}'`) as Error & {
            code?: string;
          };
          erro.code = "ENOENT";
          throw erro;
        }
        if (modoSchema.modo === "corrompido") {
          return "isto nao e um json de schema";
        }
      }
      return real.readFileSync(caminho as Parameters<typeof real.readFileSync>[0], ...(args as []));
    }) as typeof real.readFileSync,
  };
});

function carregarRoteiro(nome: string): Roteiro {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as Roteiro;
}

/**
 * Lazy de proposito: construirManifesto valida a propria saida contra o
 * schema oficial — se isto rodasse na COLETA dos describes, o validador
 * seria memoizado com o schema real antes dos testes de schema ausente
 * (que precisam ser a PRIMEIRA compilacao do arquivo).
 */
function manifestoValido(): Manifesto {
  return construirManifesto(carregarRoteiro("roteiro-valido.json"));
}

// ─── Schema ausente/corrompido (roda ANTES da primeira compilacao) ────────────

describe("validarManifestoConstruido — schema ausente ou corrompido", () => {
  it("schema AUSENTE: a validacao falha ALTO (excecao), nunca aceita em silencio", () => {
    modoSchema.modo = "ausente";
    try {
      // O schema nao carrega -> obterValidador lanca -> a validacao
      // PROPAGA o erro. Um validador sem schema que devolvesse
      // {valido: true} seria o falso verde C1.
      expect(() => validarManifestoConstruido({ schema_version: "Manifesto.1" })).toThrow();
      expect(() =>
        rejeitarManifestoInvalido({ schema_version: "Manifesto.1" }, "ctx"),
      ).toThrow();
    } finally {
      modoSchema.modo = "real";
    }
  });

  it("schema CORROMPIDO (JSON invalido): mesma falha alta (SyntaxError)", () => {
    modoSchema.modo = "corrompido";
    try {
      expect(() => validarManifestoConstruido({})).toThrow(SyntaxError);
    } finally {
      modoSchema.modo = "real";
    }
  });

  it("sonda negativa: com o schema restaurado a validacao volta a funcionar", () => {
    modoSchema.modo = "real";
    expect(validarManifestoConstruido(manifestoValido()).valido).toBe(true);
  });
});

// ─── ErroManifestoInvalido: nomeado, com contexto e problemas ─────────────────

describe("rejeitarManifestoInvalido — erro nomeado (fail-closed)", () => {
  it("manifesto valido passa SEM lancar (o assert de tipo afirma)", () => {
    expect(() => rejeitarManifestoInvalido(manifestoValido(), "ctx")).not.toThrow();
  });

  it("manifesto invalido lanca ErroManifestoInvalido com contexto e problemas", () => {
    const invalido = { ...manifestoValido(), nos: [] };
    let lancou = false;
    try {
      rejeitarManifestoInvalido(invalido, "construirManifesto");
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroManifestoInvalido);
      const e = erro as ErroManifestoInvalido;
      expect(e.code).toBe("MANIFESTO_INVALIDO");
      expect(e.problemas.length).toBeGreaterThan(0);
      // O contexto nomeia o chamador (debug de quem recusou a saida).
      expect(String(e)).toContain("construirManifesto");
      // Os problemas sao listados um por linha.
      expect(String(e)).toMatch(/\n- /);
    }
    expect(lancou, "manifesto invalido tem de ser recusado — nunca devolvido").toBe(true);
  });

  it("sonda negativa: a recusa depende do VALOR (mutacao passa a falhar)", () => {
    // Sem isto o teste passaria com um validador que aceita tudo.
    const manifesto = manifestoValido();
    expect(validarManifestoConstruido(manifesto).valido).toBe(true);
    expect(validarManifestoConstruido({ ...manifesto, cenas: [] }).valido).toBe(false);
  });
});

// ─── O validador e real: additionalProperties e tipos ─────────────────────────

describe("validarManifestoConstruido — o schema e o unico contrato", () => {
  it("campo extra NA RAIZ: reprovado, com o nome do campo no problema", () => {
    // additionalProperties: false -> "campo novo sem bump vira falha dura".
    // Na raiz o Ajv reporta o parametro additionalProperty (com o nome).
    const comExtra = { ...manifestoValido(), campo_fora_do_schema: 1 } as unknown as Manifesto;
    const resultado = validarManifestoConstruido(comExtra);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.join("\n")).toContain("campo_fora_do_schema");
  });

  it("tipo errado no fps: reprovado com o caminho JSON do campo", () => {
    const fpsErrado = { ...manifestoValido(), fps: "trinta" } as unknown as Manifesto;
    const resultado = validarManifestoConstruido(fpsErrado);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.join("\n")).toContain("/fps");
  });

  it("campo extra DENTRO de um no: reprovado com o caminho ate o no", () => {
    // Dentro da uniao anyOf o 2020-12 reporta "unevaluated properties"
    // (sem o nome — o param adicional nao existe nesse erro); o que o
    // problema carrega e o CAMINHO ate o objeto infrator.
    const noComExtra: No = {
      ...manifestoValido().nos[0]!,
      cor_de_fundo: "#000000",
    } as unknown as No;
    const comExtraNoNo: Manifesto = { ...manifestoValido(), nos: [noComExtra] };
    const resultado = validarManifestoConstruido(comExtraNoNo);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.join("\n")).toContain("/nos/0");
    expect(resultado.problemas.join("\n")).toContain("unevaluated");
  });

  it("resultado valido: {valido: true, problemas: []}", () => {
    expect(validarManifestoConstruido(manifestoValido())).toEqual({
      valido: true,
      problemas: [],
    });
  });
});

// ─── A fronteira de URL (C7) ──────────────────────────────────────────────────

describe("C7 — endereco por conteudo, nunca URL", () => {
  it("o schema PURO do Manifesto.1 nao proibe URL em texto (a regra e da ponte)", () => {
    // Verificado em 2026-08-14: schema/manifesto.schema.json nao contem
    // formato uri/url em campo nenhum. A proibicao "nenhuma URL no
    // manifesto resolvido" (contrato-roteiro.md §5) vale para o
    // RESOLVIDO e e aplicada pela ponte AB-550 (src/render/pipeline/
    // ponte.ts), nao por este validador — o construtor emite Manifesto.1,
    // ainda acima da ponte. Este teste registra a fronteira: quem
    // assumir que o schema puro e o gate de URL esta errado.
    const comUrl = manifestoValido();
    const noComUrl: No = {
      ...comUrl.nos[0]!,
      texto: "veja https://exemplo.com/recurso",
    } as unknown as No;
    const comUrlNoManifesto: Manifesto = { ...comUrl, nos: [noComUrl] };
    expect(validarManifestoConstruido(comUrlNoManifesto).valido).toBe(true);
  });

  it("todo endereco emitido pelo construtor e SHA-256 de conteudo (64 hex), nunca URL", () => {
    // O que o construtor GARANTE por construcao (C7): os campos de
    // endereco do Manifesto.1 emitido — NoMidia.hash (anexo do usuario)
    // e audio_cena.hash_locucao (wav gravado / hash de conteudo do
    // texto) — sao hashes, nunca URLs.
    const manifesto = construirManifesto(carregarRoteiro("roteiro-com-narracao.json"));
    const enderecos: string[] = [];
    for (const no of manifesto.nos) {
      if (isNoMidia(no)) {
        enderecos.push(no.hash);
        expect(no.hash).toMatch(/^[0-9a-f]{64}$/);
      }
    }
    for (const cena of manifesto.cenas) {
      if (cena.audio_cena) {
        enderecos.push(cena.audio_cena.hash_locucao);
        expect(cena.audio_cena.hash_locucao).toMatch(/^[0-9a-f]{64}$/);
      }
    }
    // A varredura casou enderecos reais (sonda negativa — contagem > 0).
    expect(enderecos.length).toBeGreaterThanOrEqual(3);
    for (const endereco of enderecos) {
      expect(endereco).not.toMatch(/^https?:\/\//);
    }
  });
});
