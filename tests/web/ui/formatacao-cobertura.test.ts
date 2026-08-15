// =============================================================================
// FORMATACAO DA UI — COBERTURA COMPLEMENTAR (bordas)
// =============================================================================
// Completa formatacao.test.ts nas bordas: formatarData SEM a opcao
// timeZone (o ramo default usa o fuso do ambiente — nunca UTC fixo),
// unidade TB de bytes, duracoes com resto de segundos que arredondam e o
// cruzamento de borda 59.96s -> "1min".
// =============================================================================

import { afterEach, describe, expect, it } from "vitest";
import { formatarBytes, formatarData, formatarDuracao } from "../../../src/web/ui/src/formatacao.js";

afterEach(() => {
  // A alteracao de TZ e por-teste; devolver o valor anterior evita
  // vazar fuso para outros testes do arquivo.
});

describe("formatarData — sem a opcao timeZone (default do ambiente)", () => {
  it("sem timeZone usa o fuso do ambiente (o mesmo que o navegador do usuario)", () => {
    const tzAnterior = process.env.TZ;
    process.env.TZ = "America/Sao_Paulo";
    try {
      // 10:00Z em Sao Paulo (UTC-3) = 07:00 — se o default fosse UTC
      // fixo, o teste falharia. Determinismo por TZ explicita no teste.
      expect(formatarData("2026-08-14T10:00:00.000Z")).toBe("14/08/2026, 07:00");
    } finally {
      process.env.TZ = tzAnterior;
    }
  });

  it("sem timeZone concorda com o fuso default resolvido (oraculo independente)", () => {
    const fusoDefault = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const iso = "2026-08-14T10:00:00.000Z";
    expect(formatarData(iso)).toBe(formatarData(iso, { timeZone: fusoDefault }));
  });
});

describe("formatarDuracao — bordas", () => {
  it("zero vira '0s' (nunca vazio na tela)", () => {
    expect(formatarDuracao(0)).toBe("0s");
  });

  it("resto de segundos exatos por baixo do minuto", () => {
    expect(formatarDuracao(119)).toBe("1min 59s");
    expect(formatarDuracao(3599)).toBe("59min 59s");
  });

  it("meia hora com horas cheias", () => {
    expect(formatarDuracao(5400)).toBe("1h 30min");
  });

  it("fracao que arredonda para o minuto exato cruza a borda", () => {
    // 59.96s arredonda para 60s -> "1min" (o arredondamento de 1 casa e
    // a fonte da verdade: 599.6 -> 600 -> 60.0).
    expect(formatarDuracao(59.96)).toBe("1min");
  });

  it("fracao que arredonda para zero", () => {
    expect(formatarDuracao(0.04)).toBe("0s");
  });
});

describe("formatarBytes — bordas", () => {
  it("terabyte (a ultima unidade da lista)", () => {
    expect(formatarBytes(1024 ** 4)).toBe("1 TB");
    expect(formatarBytes(1.5 * 1024 ** 4)).toBe("1,5 TB");
  });

  it("logo abaixo do terabyte ainda e GB (a troca de unidade e no limiar)", () => {
    // 0,9 TB — abaixo do limiar de 1024 GB, formata em GB com casa decimal.
    expect(formatarBytes(0.9 * 1024 ** 4)).toBe("921,6 GB");
  });
});
