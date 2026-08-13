/**
 * tests/render/encode/golden.test.ts
 *
 * A EMENDA DA W7 (contrato-w7 §6): goldens so existem em perfis
 * DETERMINISTICOS. Um perfil nao-determinista nunca vira linha de base
 * de bytes — `registrarGolden` RECUSA com `EGoldenEmPerfilNaoDeterministico`
 * e o teste exige a recusa.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EGoldenEmPerfilNaoDeterministico,
  podeTerGolden,
  registrarGolden,
} from "src/render/encode/golden.js";
import type { PerfilEncode } from "src/render/encode/formato.js";

function perfil(deterministico: boolean, nome = "teste-golden"): PerfilEncode {
  return {
    nome,
    motor: "libx264",
    codec: "libx264",
    deterministico,
    justificativaDeterminismo: "teste",
    alvoQualidade: { tipo: "crf", valor: 18 },
    preset: "medium",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

describe("registrarGolden — emenda da W7: goldens so em perfis deterministicos", () => {
  it("registra o golden de um perfil deterministico com SHA-256", async () => {
    const dir = mkdtempSync(join(tmpdir(), "f5-02-golden-"));
    const artefato = join(dir, "entrega.mp4");
    writeFileSync(artefato, "bytes-do-encode-deterministico");
    const golden = await registrarGolden(perfil(true), artefato);
    expect(golden.perfil).toBe("teste-golden");
    expect(golden.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(golden.tamanhoBytes).toBeGreaterThan(0);
  });

  it("RECUSA o golden de um perfil NAO-deterministico (o ∅-crit da emenda)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "f5-02-golden-"));
    const artefato = join(dir, "entrega-nvenc.mp4");
    writeFileSync(artefato, "bytes-que-mudam");
    const naoDeterministico = perfil(false, "teste-nvenc");
    await expect(registrarGolden(naoDeterministico, artefato)).rejects.toThrow(
      EGoldenEmPerfilNaoDeterministico,
    );
    // a recusa e nominal: nomeia o perfil e a regra da emenda
    try {
      await registrarGolden(naoDeterministico, artefato);
      expect.unreachable("deveria recusar");
    } catch (erro) {
      expect(erro).toBeInstanceOf(EGoldenEmPerfilNaoDeterministico);
      expect(String(erro)).toMatch(/teste-nvenc/);
      expect(String(erro)).toMatch(/perfis deterministicos/);
    }
  });

  it("podeTerGolden espelha a declaracao de determinismo", () => {
    expect(podeTerGolden(perfil(true))).toBe(true);
    expect(podeTerGolden(perfil(false))).toBe(false);
  });
});
