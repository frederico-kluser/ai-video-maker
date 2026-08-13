// =============================================================================
// A PONTE AB-550 (C2) — testes de unidade
// =============================================================================
// Cobre o ∅-crit novo do card: cena com no inexistente no manifesto
// resolvido fica VERMELHO, com mensagem nomeando a regra e o caminho; e os
// campos da fronteira preenchidos com fonte nomeada (frames da aritmetica
// de F1-01, cores dos tokens, hash dos bytes do asset, licenca da
// procedencia de F0-07).
// =============================================================================

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import type { Manifesto } from "../../../src/contratos/manifesto";
import { background } from "../../../src/design/tokens";
import type { Procedencia } from "../../../src/store/procedencia";
import {
  atravessarPonte,
  ErroDePonte,
  REGRA_INTEGRIDADE_REFERENCIAL,
  REGRA_HASH_DOS_BYTES,
  REGRA_LICENCA_DE_PROCEDENCIA,
} from "../../../src/render/pipeline/ponte";

// ─── Dados minimos de teste ───────────────────────────────────────────────────

const HASH_A = createHash("sha256").update(Buffer.from("bytes-do-asset-a")).digest("hex");
const BYTES_A = Buffer.from("bytes-do-asset-a");

function procedencia(license: string): Procedencia {
  return {
    license,
    attributionRequired: false,
    source: "local",
    acquiredAt: "2026-08-13T00:00:00.000Z",
  };
}

function manifestoValido(): Manifesto {
  return {
    schema_version: "Manifesto.1",
    fps: 30,
    width: 1920,
    height: 1080,
    nos: [
      {
        id: "n-001",
        schema: "Cabecalho.1",
        type: "cabecalho",
        duracao_frames: 90,
        entrada_frames: 0,
        texto: "titulo",
      },
      {
        id: "n-009",
        schema: "Grafico.1",
        type: "grafico",
        duracao_frames: 60,
        entrada_frames: 10,
        tipo_grafico: "barras",
        dados: [],
      },
    ],
    cenas: [{ id: "c-001", nos: ["n-001", "n-009"] }],
  };
}

function entradasBase() {
  return {
    manifesto: manifestoValido(),
    assets: new Map([[HASH_A, BYTES_A]]),
    procedencias: new Map([[HASH_A, procedencia("CC0-1.0")]]),
    nosGrafico: new Map([["n-009", HASH_A]]),
  };
}

// ─── Os testes ────────────────────────────────────────────────────────────────

describe("ponte AB-550 (C2) — integridade referencial", () => {
  it("cena com no inexistente e ERRO nomeando regra e caminho (∅-crit)", () => {
    const entradas = entradasBase();
    const manifesto = entradas.manifesto;
    manifesto.cenas = [{ id: "c-003", nos: ["n-999"] }];

    let erro: ErroDePonte | null = null;
    try {
      atravessarPonte(entradas);
    } catch (e) {
      erro = e as ErroDePonte;
    }

    expect(erro).not.toBeNull();
    expect(erro!.message).toContain('cena "c-003"');
    expect(erro!.message).toContain('no inexistente "n-999"');
    expect(erro!.message).toContain(`regra ${REGRA_INTEGRIDADE_REFERENCIAL}`);
    expect(erro!.message).toContain("campo cena.nos");
  });

  it("cena valida atravessa sem erro e o plano e o da aritmetica F1-01", () => {
    const resultado = atravessarPonte(entradasBase());

    // Duracao propria da cena = max(entrada_frames + duracao_frames):
    // n-001 = 90, n-009 = 10 + 60 = 70 -> a cena vale 90 frames.
    expect(resultado.plano.totalFrames).toBe(90);
    expect(resultado.plano.totalFrames).toBeGreaterThan(0);
    // A fonte dos frames e nomeada: aritmetica de F1-01.
    expect(resultado.campos.frames.fonte).toContain("F1-01");
    expect(resultado.campos.frames.valor).toContain(String(resultado.plano.totalFrames));
  });
});

describe("ponte AB-550 (C2) — hash dos bytes (F0-07/C7)", () => {
  it("asset cuja chave nao e o SHA-256 dos bytes e ERRO nomeando a regra", () => {
    const entradas = entradasBase();
    const manifesto = entradas.manifesto;
    manifesto.cenas = [{ id: "c-001", nos: ["n-001"] }];
    // O no de grafico sai da cena; o asset entra com a chave mentirosa.
    entradas.assets = new Map([["a".repeat(64), BYTES_A]]);

    let erro: ErroDePonte | null = null;
    try {
      atravessarPonte(entradas);
    } catch (e) {
      erro = e as ErroDePonte;
    }
    expect(erro).not.toBeNull();
    expect(erro!.message).toContain(`regra ${REGRA_HASH_DOS_BYTES}`);
    expect(erro!.message).toContain("assets.");
    // O hash correto calculado dos mesmos bytes consta da mensagem.
    expect(erro!.message).toContain(createHash("sha256").update(BYTES_A).digest("hex").slice(0, 8));
  });

  it("o campo hash declara a fonte (store F0-07) e a chave casa com os bytes", () => {
    const resultado = atravessarPonte(entradasBase());
    expect(resultado.campos.hash.fonte).toContain("F0-07");
    const asset = resultado.assets.get(HASH_A);
    expect(asset?.bytes).toEqual(BYTES_A);
  });
});

describe("ponte AB-550 (C2) — licenca da procedencia (F0-07)", () => {
  it("asset sem procedencia com licenca e ERRO — nunca digitada a mao", () => {
    const entradas = entradasBase();
    entradas.procedencias = new Map();
    const manifesto = entradas.manifesto;
    manifesto.cenas = [{ id: "c-001", nos: ["n-001"] }];

    let erro: ErroDePonte | null = null;
    try {
      atravessarPonte(entradas);
    } catch (e) {
      erro = e as ErroDePonte;
    }
    expect(erro).not.toBeNull();
    expect(erro!.message).toContain(`regra ${REGRA_LICENCA_DE_PROCEDENCIA}`);
    expect(erro!.message).toContain("campo assets.");
  });

  it("a licenca do asset atravessado e a da procedencia, com fonte nomeada", () => {
    const resultado = atravessarPonte(entradasBase());
    const asset = resultado.assets.get(HASH_A)!;
    expect(asset.licenca.valor).toBe("CC0-1.0");
    expect(asset.licenca.fonte).toContain("F0-07");
    expect(resultado.campos.licenca.fonte).toContain("F0-07");
  });
});

describe("ponte AB-550 (C2) — cores dos tokens (S-1)", () => {
  it("a cor da fronteira e o valor do token, com o token nomeado — nunca literal", () => {
    const resultado = atravessarPonte(entradasBase());
    expect(resultado.campos.cores.valor).toBe(background.primary);
    expect(resultado.campos.cores.token).toBe("background.primary");
    expect(resultado.campos.cores.fonte).toContain("tokens.ts");
  });
});
