// =============================================================================
// FORMATACAO DA UI — funcoes PURAS (duracoes, bytes, progresso, data)
// =============================================================================
// Onda 6 (spa-frontend): formatacao.ts em pt-BR, determinismo por
// parametros explicitos (o formatarData recebe o timeZone — o fuso do
// navegador fica de fora dos testes).
// =============================================================================

import { describe, expect, it } from "vitest";
import { formatarBytes, formatarData, formatarDuracao, formatarProgresso } from "../../../src/web/ui/src/formatacao.js";

// 1,4 MB de fixture para a casa decimal — o teto do anexo (200 MB) nao
// se redigita aqui: ele vem do contrato, nunca do teste.
const ANEXO_FIXTURE = 1024 * 1024 * 1.4;

describe("formatarDuracao", () => {
  it("segundos exatos", () => {
    expect(formatarDuracao(30)).toBe("30s");
    expect(formatarDuracao(60)).toBe("1min");
    expect(formatarDuracao(120)).toBe("2min");
    expect(formatarDuracao(3600)).toBe("1h");
  });

  it("minutos com resto", () => {
    expect(formatarDuracao(65)).toBe("1min 5s");
    expect(formatarDuracao(3660)).toBe("1h 1min");
    expect(formatarDuracao(7540)).toBe("2h 5min");
  });

  it("resto de segundos nunca vaza para 60 (arredonda o total primeiro)", () => {
    expect(formatarDuracao(119.4)).toBe("1min 59s");
    expect(formatarDuracao(119.6)).toBe("2min");
    expect(formatarDuracao(119.96)).toBe("2min");
    expect(formatarDuracao(179.9)).toBe("3min");
  });

  it("fracoes com virgula pt-BR", () => {
    expect(formatarDuracao(12.5)).toBe("12,5s");
    expect(formatarDuracao(0.5)).toBe("0,5s");
  });

  it("valores invalidos viram travessao (nunca NaN na tela)", () => {
    expect(formatarDuracao(-1)).toBe("—");
    expect(formatarDuracao(Number.NaN)).toBe("—");
    expect(formatarDuracao(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatarBytes", () => {
  it("unidades pt-BR", () => {
    expect(formatarBytes(0)).toBe("0 B");
    expect(formatarBytes(890)).toBe("890 B");
    expect(formatarBytes(1024)).toBe("1 kB");
    expect(formatarBytes(10240)).toBe("10 kB");
    expect(formatarBytes(1048576)).toBe("1 MB");
    expect(formatarBytes(2 * 1024 * 1024 * 1024)).toBe("2 GB");
  });

  it("uma casa decimal com virgula", () => {
    expect(formatarBytes(99999)).toBe("97,7 kB");
    expect(formatarBytes(ANEXO_FIXTURE)).toBe("1,4 MB");
  });

  it("valores invalidos viram travessao", () => {
    expect(formatarBytes(-5)).toBe("—");
    expect(formatarBytes(Number.NaN)).toBe("—");
  });
});

describe("formatarProgresso", () => {
  it("0..1 vira porcentagem arredondada e limitada", () => {
    expect(formatarProgresso(0)).toBe("0%");
    expect(formatarProgresso(0.456)).toBe("46%");
    expect(formatarProgresso(1)).toBe("100%");
    // Fora da faixa (CLI indisciplinado) nunca passa de 0..100.
    expect(formatarProgresso(1.2)).toBe("100%");
    expect(formatarProgresso(-0.2)).toBe("0%");
  });

  it("null/undefined = indeterminado (reticencias)", () => {
    expect(formatarProgresso(null)).toBe("…");
    expect(formatarProgresso(undefined)).toBe("…");
  });
});

describe("formatarData", () => {
  it("ISO vira data/hora pt-BR com o fuso pedido (determinismo de teste)", () => {
    expect(formatarData("2026-08-14T10:00:00.000Z", { timeZone: "UTC" })).toBe("14/08/2026, 10:00");
  });

  it("data invalida devolve o proprio texto (nunca 'Invalid Date')", () => {
    expect(formatarData("nao-e-uma-data", { timeZone: "UTC" })).toBe("nao-e-uma-data");
  });
});
