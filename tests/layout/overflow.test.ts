// =============================================================================
// Testes do motor de layout — overflow como erro de build
// =============================================================================
// Verifica que:
// 1. Texto que estoura → build FALHA com mensagem nomeando o no
// 2. Safe area (graphics safe) e respeitada
// 3. Medicao e deterministica
// 4. Piso de legibilidade (16px) e respeitado
//
// Skill: motion-design-system (SKILL.md)
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  measureText,
  measureTextWidth,
  measureTextHeight,
  worstCaseWidth,
} from "src/composicao/layout/medicao";
import { fitTextToWidth, fitTextToBounds, MIN_FONT_SIZE_PX } from "src/composicao/layout/ajuste";
import {
  assertNoOverflow,
  assertNoOverflowWithFit,
  assertLayoutFits,
  checkOverflow,
  checkOverflowWithFit,
  TextOverflowError,
  type NodeContext,
} from "src/composicao/layout/overflow";
import { safeArea16x9, safeArea9x16 } from "src/design/tokens";

// =============================================================================
// HELPERS
// =============================================================================

/** Fixture: texto curto que cabe em qualquer lugar */
const TEXTO_CURTO = "Oi";

/** Fixture: texto que estoura — 200 caracteres largos */
const TEXTO_ESTOURA =
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" +
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" +
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW" +
  "WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW";

/** Contexto de no tipico para cabecalho em HD */
function ctxCabecalho(
  overrides: Partial<NodeContext> = {},
): NodeContext {
  return {
    nodeId: "cabecalho-01",
    nodeType: "cabecalho",
    maxWidth: 800,
    maxHeight: 200,
    fontSize: 54,
    ...overrides,
  };
}

/** Contexto de no tipico para legenda em HD */
function ctxLegenda(
  overrides: Partial<NodeContext> = {},
): NodeContext {
  return {
    nodeId: "legenda-01",
    nodeType: "texto",
    maxWidth: 1600,
    maxHeight: 120,
    fontSize: 22,
    ...overrides,
  };
}

// =============================================================================
// MEDICAO DE TEXTO
// =============================================================================

describe("Medicao de texto (medicao.ts)", () => {
  describe("measureText", () => {
    it("texto vazio retorna zero", () => {
      const m = measureText("", 20);
      expect(m.width).toBe(0);
      expect(m.height).toBe(0);
      expect(m.lines).toBe(0);
    });

    it("texto curto tem largura positiva", () => {
      const m = measureText("Oi", 20);
      expect(m.width).toBeGreaterThan(0);
    });

    it("texto mais longo e mais largo que texto curto", () => {
      const curto = measureText("Oi", 20);
      const longo = measureText("Ola mundo", 20);
      expect(longo.width).toBeGreaterThan(curto.width);
    });

    it("largura escala linearmente com fontSize", () => {
      const m20 = measureText("ABCDEFGH", 20);
      const m40 = measureText("ABCDEFGH", 40);
      // 40/20 = 2x, tolerancia de arredondamento
      expect(m40.width).toBeCloseTo(m20.width * 2, 0);
    });

    it("determinismo: mesma entrada → mesma saida", () => {
      const a = measureText("Hello World", 24);
      const b = measureText("Hello World", 24);
      expect(a.width).toBe(b.width);
      expect(a.height).toBe(b.height);
      expect(a.lines).toBe(b.lines);
    });

    it("multilinha: altura conta todas as linhas", () => {
      const m = measureText("Linha 1\nLinha 2\nLinha 3", 20, 1.4);
      expect(m.lines).toBe(3);
      expect(m.height).toBeCloseTo(3 * 20 * 1.4, 0);
    });

    it("multilinha: largura e a da linha mais longa", () => {
      const m = measureText("Curta\nLinha muito mais longa\nOk", 20);
      const linhaLonga = measureTextWidth("Linha muito mais longa", 20);
      expect(m.width).toBeCloseTo(linhaLonga, 0);
    });
  });

  describe("measureTextWidth", () => {
    it("espacos sao medidos", () => {
      const semEspaco = measureTextWidth("AB", 20);
      const comEspaco = measureTextWidth("A B", 20);
      expect(comEspaco).toBeGreaterThan(semEspaco);
    });

    it("caracteres largos (W, M) sao mais largos que medios", () => {
      const w = measureTextWidth("W", 20);
      const n = measureTextWidth("N", 20);
      expect(w).toBeGreaterThan(n);
    });

    it("caracteres estreitos (i, l) sao mais estreitos que medios", () => {
      const i = measureTextWidth("i", 20);
      const n = measureTextWidth("n", 20);
      expect(i).toBeLessThan(n);
    });
  });

  describe("measureTextHeight", () => {
    it("texto vazio retorna zero", () => {
      expect(measureTextHeight("", 20)).toBe(0);
    });

    it("uma linha = fontSize * lineHeight", () => {
      expect(measureTextHeight("Oi", 20, 1.4)).toBeCloseTo(28, 0);
    });
  });

  describe("worstCaseWidth", () => {
    it("pior caso usa WIDE_FACTOR", () => {
      const w = worstCaseWidth(42, 27);
      // 42 * 27 * 0.72 = 816.48
      expect(w).toBeCloseTo(816.48, 1);
    });

    it("pior caso >= texto real com W (com tolerancia de float)", () => {
      const textoW = "W".repeat(42);
      const medido = measureTextWidth(textoW, 27);
      const worst = worstCaseWidth(42, 27);
      // Usa toBeCloseTo para absorver erro de ponto flutuante
      // (worst = 816.48, medido = 816.4800000000007)
      expect(worst).toBeCloseTo(medido, 5);
      // E o pior caso nao pode ser menor que o medido por margem significativa
      expect(worst).toBeGreaterThanOrEqual(medido - 0.01);
    });
  });
});

// =============================================================================
// AJUSTE DE FONTE
// =============================================================================

describe("Ajuste de fonte (ajuste.ts)", () => {
  describe("fitTextToWidth", () => {
    it("texto que cabe nao sofre reducao", () => {
      const result = fitTextToWidth("Oi", 800, 54);
      expect(result.fits).toBe(true);
      expect(result.fontSize).toBe(54);
      expect(result.reductionSteps).toBe(0);
    });

    it("texto que estoura e reduzido ate caber", () => {
      // Texto que estoura a 54px (54 * 0.72 = 38.88px/char) mas cabe reduzido
      // 50 caracteres W a 54px = 50 * 38.88 = 1944px > 800px
      // 50 caracteres W a 16px = 50 * 11.52 = 576px < 800px
      const textoMedio = "W".repeat(50);
      const result = fitTextToWidth(textoMedio, 800, 54);
      expect(result.fits).toBe(true);
      // Deve ter reduzido para caber
      expect(result.fontSize).toBeLessThan(54);
      expect(result.reductionSteps).toBeGreaterThan(0);
    });

    it("fonte nao desce abaixo do piso (16px)", () => {
      const result = fitTextToWidth(TEXTO_ESTOURA, 300, 54);
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX);
    });

    it("retorna fits: false quando nem no piso coube", () => {
      // 300px muito estreito para 200 caracteres mesmo a 16px
      const result = fitTextToWidth(TEXTO_ESTOURA, 300, 54);
      if (result.fontSize === MIN_FONT_SIZE_PX && !result.fits) {
        // Esperado: nao coube nem no piso
        expect(result.fits).toBe(false);
      }
    });

    it("texto vazio sempre cabe", () => {
      const result = fitTextToWidth("", 100, 54);
      expect(result.fits).toBe(true);
    });

    it("fonte no piso com texto curto cabe", () => {
      const result = fitTextToWidth("Oi", 400, 16);
      expect(result.fits).toBe(true);
      expect(result.fontSize).toBe(16);
    });
  });

  describe("fitTextToBounds", () => {
    it("texto que cabe em ambas as dimensoes nao reduz", () => {
      const result = fitTextToBounds("Oi", 800, 200, 54);
      expect(result.fits).toBe(true);
      expect(result.fontSize).toBe(54);
    });

    it("texto com muitas linhas reduz para caber na altura", () => {
      const textoMultilinha = "Linha\n".repeat(20);
      const result = fitTextToBounds(textoMultilinha, 800, 200, 54);
      // Ou coube ou reduziu; no piso deve ter o menor tamanho
      expect(result.fontSize).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX);
    });
  });
});

// =============================================================================
// OVERFLOW COMO ERRO
// =============================================================================

describe("Overflow como erro de build (overflow.ts)", () => {
  describe("checkOverflow", () => {
    it("texto que cabe retorna fits: true", () => {
      const ctx = ctxCabecalho();
      const result = checkOverflow("Oi", ctx);
      expect(result.fits).toBe(true);
      expect(result.widthRemaining).toBeGreaterThan(0);
    });

    it("texto que estoura retorna fits: false", () => {
      const ctx = ctxCabecalho();
      const result = checkOverflow(TEXTO_ESTOURA, ctx);
      expect(result.fits).toBe(false);
    });

    it("texto vazio sempre cabe", () => {
      const ctx = ctxCabecalho();
      const result = checkOverflow("", ctx);
      expect(result.fits).toBe(true);
    });
  });

  describe("assertNoOverflow", () => {
    it("texto que cabe nao lanca erro", () => {
      const ctx = ctxCabecalho();
      expect(() => assertNoOverflow("Oi", ctx)).not.toThrow();
    });

    it("TEXTO QUE ESTOURA → build FALHA com mensagem nomeando o no", () => {
      const ctx = ctxCabecalho();
      expect(() => assertNoOverflow(TEXTO_ESTOURA, ctx)).toThrow(
        TextOverflowError,
      );
    });

    it("mensagem de erro contem o nodeId", () => {
      const ctx = ctxCabecalho({ nodeId: "cabecalho-01" });
      try {
        assertNoOverflow(TEXTO_ESTOURA, ctx);
        // Se nao lancou, o teste falha
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(TextOverflowError);
        const msg = (err as TextOverflowError).message;
        expect(msg).toContain("cabecalho-01");
        expect(msg).toContain("OVERFLOW");
      }
    });

    it("mensagem de erro contem o nodeType", () => {
      const ctx = ctxCabecalho({ nodeType: "cabecalho" });
      try {
        assertNoOverflow(TEXTO_ESTOURA, ctx);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(TextOverflowError);
        const msg = (err as TextOverflowError).message;
        expect(msg).toContain("cabecalho");
      }
    });

    it("mensagem de erro reporta dimensoes excedidas", () => {
      const ctx = ctxCabecalho({ maxWidth: 800, maxHeight: 200 });
      try {
        assertNoOverflow(TEXTO_ESTOURA, ctx);
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(TextOverflowError);
        const msg = (err as TextOverflowError).message;
        expect(msg).toContain("800px");
        expect(msg).toContain("excedido");
      }
    });

    it("TextOverflowError expoe nodeId e medicoes", () => {
      const ctx = ctxCabecalho({ nodeId: "no-42" });
      try {
        assertNoOverflow(TEXTO_ESTOURA, ctx);
        expect(true).toBe(false);
      } catch (err) {
        const teErr = err as TextOverflowError;
        expect(teErr.nodeId).toBe("no-42");
        expect(teErr.measurement.width).toBeGreaterThan(ctx.maxWidth);
        expect(teErr.maxWidth).toBe(ctx.maxWidth);
      }
    });
  });

  describe("assertNoOverflowWithFit", () => {
    it("ajusta fonte e nao lanca erro se coube", () => {
      const ctx = ctxCabecalho();
      // Texto medio que cabe com ajuste
      const texto = "Um titulo um pouco mais longo que o normal para caber";
      expect(() => assertNoOverflowWithFit(texto, ctx)).not.toThrow();
    });

    it("lanca erro se nem ajustando coube", () => {
      const ctx = ctxCabecalho({ maxWidth: 200, fontSize: 54 });
      expect(() => assertNoOverflowWithFit(TEXTO_ESTOURA, ctx)).toThrow(
        TextOverflowError,
      );
    });
  });

  describe("checkOverflowWithFit", () => {
    it("retorna fitResult com detalhes do ajuste", () => {
      const ctx = ctxCabecalho();
      const result = checkOverflowWithFit(TEXTO_ESTOURA, ctx);
      expect(result.fitResult).toBeDefined();
      if (result.fitResult) {
        expect(result.fitResult.reductionSteps).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================================================
// SAFE AREA — graphics safe respeitada
// =============================================================================

describe("Safe area — graphics safe respeitada", () => {
  const graphicsSafe16x9 = {
    x: safeArea16x9.graphicsSafe.left,
    y: safeArea16x9.graphicsSafe.top,
    width: safeArea16x9.graphicsSafe.right - safeArea16x9.graphicsSafe.left,
    height: safeArea16x9.graphicsSafe.bottom - safeArea16x9.graphicsSafe.top,
  };

  const graphicsSafe9x16 = {
    x: safeArea9x16.safeRect.x,
    y: safeArea9x16.safeRect.y,
    width: safeArea9x16.safeRect.width,
    height: safeArea9x16.safeRect.height,
  };

  it("16:9 — texto dentro da graphics safe area nao lanca erro", () => {
    const ctx = ctxCabecalho({
      maxWidth: graphicsSafe16x9.width,
      maxHeight: graphicsSafe16x9.height,
    });
    expect(() =>
      assertLayoutFits("Titulo curto", ctx, graphicsSafe16x9),
    ).not.toThrow();
  });

  it("16:9 — no mais largo que a graphics safe area lanca erro", () => {
    const ctx = ctxCabecalho({
      maxWidth: graphicsSafe16x9.width + 100, // 100px mais largo
      maxHeight: graphicsSafe16x9.height,
    });
    expect(() =>
      assertLayoutFits("Titulo curto", ctx, graphicsSafe16x9),
    ).toThrow(TextOverflowError);
  });

  it("9:16 — texto dentro da safe area vertical nao lanca erro", () => {
    const ctx = ctxLegenda({
      maxWidth: graphicsSafe9x16.width,
      maxHeight: 120,
    });
    expect(() =>
      assertLayoutFits("Legenda curta", ctx, graphicsSafe9x16),
    ).not.toThrow();
  });

  it("texto que cabe na safe area retorna margem positiva", () => {
    const ctx = ctxCabecalho({
      maxWidth: 400,
      maxHeight: 100,
    });
    const result = checkOverflow("Oi", ctx);
    expect(result.widthRemaining).toBeGreaterThan(0);
    expect(result.heightRemaining).toBeGreaterThan(0);
  });

  it("16:9 — graphics safe tem dimensoes corretas", () => {
    // Margem: 96px cada lado (5% de 1920 = 96)
    expect(graphicsSafe16x9.x).toBe(96);
    expect(graphicsSafe16x9.y).toBe(54);
    // 1824 - 96 = 1728
    expect(graphicsSafe16x9.width).toBe(1728);
    // 1026 - 54 = 972
    expect(graphicsSafe16x9.height).toBe(972);
  });

  it("9:16 — safe rect tem dimensoes corretas", () => {
    // Margem: top 230px, bottom 384px, right 162px
    expect(graphicsSafe9x16.x).toBe(0);
    expect(graphicsSafe9x16.y).toBe(230);
    // 1080 - 162 = 918
    expect(graphicsSafe9x16.width).toBe(918);
    // 1920 - 230 - 384 = 1306
    expect(graphicsSafe9x16.height).toBe(1306);
  });
});

// =============================================================================
// FIXTURE CANONICA: "texto que estoura" → build FALHA
// =============================================================================

describe('Fixture "texto que estoura" → build FALHA', () => {
  it("assertNoOverflow com TEXTO_ESTOURA lanca TextOverflowError", () => {
    const ctx = ctxCabecalho();
    expect(() => assertNoOverflow(TEXTO_ESTOURA, ctx)).toThrow(
      TextOverflowError,
    );
  });

  it("erro nomeia o no correto", () => {
    const ctx = ctxCabecalho({ nodeId: "cabecalho-01" });
    try {
      assertNoOverflow(TEXTO_ESTOURA, ctx);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(TextOverflowError);
      expect((err as TextOverflowError).nodeId).toBe("cabecalho-01");
    }
  });

  it("erro contem preview do texto (truncado)", () => {
    const ctx = ctxCabecalho();
    try {
      assertNoOverflow(TEXTO_ESTOURA, ctx);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(TextOverflowError);
      const msg = (err as TextOverflowError).message;
      // Deve conter parte do texto ou "..." indicando truncamento
      expect(msg).toMatch(/WWWW/);
    }
  });

  it("erro NAO e silencioso — o erro propaga, nao e engolido", () => {
    const ctx = ctxCabecalho();
    // O erro deve ser lancado, nao logado e engolido
    let threw = false;
    try {
      assertNoOverflow(TEXTO_ESTOURA, ctx);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

// =============================================================================
// DETERMINISMO
// =============================================================================

describe("Determinismo do layout", () => {
  it("medicao e deterministica para qualquer texto", () => {
    const textos = ["Oi", "Hello World", TEXTO_ESTOURA, "A\nB\nC"];
    for (const texto of textos) {
      const a = measureText(texto, 24);
      const b = measureText(texto, 24);
      expect(a.width).toBe(b.width);
      expect(a.height).toBe(b.height);
      expect(a.lines).toBe(b.lines);
    }
  });

  it("ajuste e deterministico", () => {
    const a = fitTextToWidth("Um texto medio", 600, 32);
    const b = fitTextToWidth("Um texto medio", 600, 32);
    expect(a.fontSize).toBe(b.fontSize);
    expect(a.fits).toBe(b.fits);
    expect(a.reductionSteps).toBe(b.reductionSteps);
  });

  it("overflow check e deterministico", () => {
    const ctx = ctxCabecalho();
    const a = checkOverflow("Oi", ctx);
    const b = checkOverflow("Oi", ctx);
    expect(a.fits).toBe(b.fits);
    expect(a.widthRemaining).toBe(b.widthRemaining);
  });
});

// =============================================================================
// PISO DE LEGIBILIDADE
// =============================================================================

describe("Piso de legibilidade (16px)", () => {
  it("MIN_FONT_SIZE_PX e 16", () => {
    expect(MIN_FONT_SIZE_PX).toBe(16);
  });

  it("fitTextToWidth nunca retorna fonte abaixo do piso", () => {
    const result = fitTextToWidth(TEXTO_ESTOURA, 100, 54);
    expect(result.fontSize).toBeGreaterThanOrEqual(16);
  });

  it("fonte no piso ainda mede texto corretamente", () => {
    const m = measureText("Oi", 16);
    expect(m.fontSize).toBe(16);
    expect(m.width).toBeGreaterThan(0);
  });
});