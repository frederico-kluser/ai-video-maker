/**
 * tests/autoria/gravar-cassete.test.ts
 *
 * A resolucao de credencial da cerimonia de gravacao (P3 do fix da
 * autoria viva, onda 2):
 *
 *   - anthropic le ANTHROPIC_AUTH_TOKEN com fallback para
 *     ANTHROPIC_API_KEY (a API key antiga segue aceita; o token de auth
 *     e o que o ambiente provisiona — antes a cerimonia lia so a API
 *     key e o SOSIA rodava em silencio);
 *   - `--provedor anthropic` explicito sem credencial grava do SOSIA e
 *     emite AVISO RUIDOSO no stderr (nao silencioso — silencio esconde
 *     que o cassete veio do sosia, nao da API real).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  avisarSosiaSemCredencial,
  resolverChaveDeApi,
} from "src/autoria/executor/gravar-cassete.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolverChaveDeApi (P3)", () => {
  it("anthropic: ANTHROPIC_AUTH_TOKEN presente vence (fallback nao e usado)", () => {
    expect(
      resolverChaveDeApi("anthropic", {
        ANTHROPIC_AUTH_TOKEN: "token-auth",
        ANTHROPIC_API_KEY: "chave-antiga",
      }),
    ).toBe("token-auth");
  });

  it("anthropic: sem token, o fallback ANTHROPIC_API_KEY resolve", () => {
    expect(
      resolverChaveDeApi("anthropic", { ANTHROPIC_API_KEY: "chave-antiga" }),
    ).toBe("chave-antiga");
  });

  it("anthropic: nenhuma das duas -> undefined (SOSIA)", () => {
    expect(resolverChaveDeApi("anthropic", {})).toBeUndefined();
  });

  it("openai: usa OPENAI_API_KEY", () => {
    expect(
      resolverChaveDeApi("openai", { OPENAI_API_KEY: "chave-openai" }),
    ).toBe("chave-openai");
  });
});

describe("avisarSosiaSemCredencial (P3) — aviso ruidoso no stderr", () => {
  it("--provedor anthropic explicito sem credencial -> aviso no stderr (console.error)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const aviso = avisarSosiaSemCredencial("anthropic", true, undefined);
    expect(aviso).toBeTruthy();
    expect(aviso).toContain("AVISO");
    expect(aviso).toContain("ANTHROPIC_AUTH_TOKEN");
    expect(aviso).toContain("SOSIA");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("--provedor anthropic explicito COM credencial -> nenhum aviso", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisarSosiaSemCredencial("anthropic", true, "token-auth")).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("anthropic sem --provedor explicito -> nenhum aviso (nao e decisao consciente)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisarSosiaSemCredencial("anthropic", false, undefined)).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it("openai -> nenhum aviso", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisarSosiaSemCredencial("openai", true, undefined)).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
