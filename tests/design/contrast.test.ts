// =============================================================================
// Teste de contraste — WCAG AA
// =============================================================================
// Valida que todos os pares de contraste registrados em tokens.ts
// atendem aos minimos normativos.
//
// Fonte: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
// AA normal: 4.5:1 | AA large: 3:1
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  contrastPairs,
  contrastRatio,
  hexToLuminance,
  background,
  text,
  state,
  highlight,
  border,
} from "src/design/tokens";

// ---------------------------------------------------------------------------
// Constantes de referencia
// ---------------------------------------------------------------------------
// Fonte: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html (2026-08-11)
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

describe("Contraste WCAG AA", () => {
  it("todos os pares registrados tem razao >= 3.0 (AA large)", () => {
    for (const pair of contrastPairs) {
      expect(
        pair.ratio,
        `Par ${pair.fg} / ${pair.bg}: razao ${pair.ratio.toFixed(2)}:1 < ${AA_LARGE}:1 (AA large)`,
      ).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });

  it("pares marcados como AA normal tem razao >= 4.5", () => {
    for (const pair of contrastPairs) {
      if (pair.passesAANormal) {
        expect(
          pair.ratio,
          `Par ${pair.fg} / ${pair.bg}: declarado AA normal mas razao ${pair.ratio.toFixed(2)}:1 < ${AA_NORMAL}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
    }
  });

  it("pares marcados como AA large (nao normal) estao entre 3.0 e 4.5", () => {
    for (const pair of contrastPairs) {
      if (!pair.passesAANormal) {
        expect(
          pair.ratio,
          `Par ${pair.fg} / ${pair.bg}: declarado nao-AA-normal mas razao ${pair.ratio.toFixed(2)}:1 >= ${AA_NORMAL}:1 (deveria ser passesAANormal: true)`,
        ).toBeLessThan(AA_NORMAL);
      }
    }
  });

  it("razao declarada no par confere com calculo ao vivo", () => {
    for (const pair of contrastPairs) {
      const recomputed = contrastRatio(pair.fg, pair.bg);
      expect(
        recomputed,
        `Par ${pair.fg} / ${pair.bg}: razao declarada ${pair.ratio.toFixed(2)}:1 != calculada ${recomputed.toFixed(2)}:1`,
      ).toBeCloseTo(pair.ratio, 2);
    }
  });

  it("texto principal sobre fundo escuro passa AA normal", () => {
    const ratio = contrastRatio(text.primary, background.primary);
    expect(
      ratio,
      `text.primary / bg.primary: ${ratio.toFixed(2)}:1 < ${AA_NORMAL}:1`,
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("texto escuro sobre fundo claro passa AA normal", () => {
    const ratio = contrastRatio(text.dark, background.light);
    expect(
      ratio,
      `text.dark / bg.light: ${ratio.toFixed(2)}:1 < ${AA_NORMAL}:1`,
    ).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("cores de estado sobre fundo escuro passam AA large", () => {
    const stateColors = [
      state.success,
      state.warning,
      state.error,
      state.info,
    ];
    for (const color of stateColors) {
      const ratio = contrastRatio(color, background.primary);
      expect(
        ratio,
        `Estado ${color} / bg.primary: ${ratio.toFixed(2)}:1 < ${AA_LARGE}:1`,
      ).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });
});

describe("Luminancia relativa (WCAG 2.2)", () => {
  // Fonte: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance (2026-08-11)

  it("preto (#000000) tem luminancia 0", () => {
    expect(hexToLuminance("#000000")).toBeCloseTo(0.0, 4);
  });

  it("branco (#FFFFFF) tem luminancia 1", () => {
    expect(hexToLuminance("#FFFFFF")).toBeCloseTo(1.0, 4);
  });

  it("preto sobre branco = 21:1", () => {
    const ratio = contrastRatio("#000000", "#FFFFFF");
    expect(ratio).toBeCloseTo(21.0, 0);
  });

  it("mesma cor = 1:1", () => {
    const ratio = contrastRatio("#3B82F6", "#3B82F6");
    expect(ratio).toBeCloseTo(1.0, 0);
  });
});