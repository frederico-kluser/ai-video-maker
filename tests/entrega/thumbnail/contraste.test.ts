// =============================================================================
// THUMBNAIL — contraste MEDIDO no pixel (card F5-05, W7)
// =============================================================================
// Pergunta adversarial (3) do card: "O contraste e medido (WCAG) ou so
// declarado?" — este arquivo prova que a medicao roda sobre PIXELS com a
// MESMA formula dos tokens (contrastRatio importada, nunca redeclarada), e
// que a declaracao dos tokens vira OBRIGACAO na tela: uma tinta que casa um
// par declarado tem de passar o minimo do par (AA normal 4.5:1 quando o par
// declara passar); uma tinta sem par declarado cai no piso AA large 3:1.
//
// ∅-crit do card — "thumbnail com contraste abaixo do minimo tem de
// falhar" — e o teste da tinta gray 600 sobre o fundo do video: razao
// 2.68:1 < 3:1, e conferirContraste TEM de devolver a falha. O mesmo probe
// roda no gate, contra os pixels REAIS do thumbnail renderizado
// (tests/entrega/thumbnail/gate.ts, etapa 5).
//
// O piso de contagem (PISO_DE_TINTA) separa tinta de ruido de
// anti-aliasing: uma mistura de borda com poucos pixels NAO e tinta e nao
// derruba um thumbnail saudavel (falso vermelho).
// =============================================================================

import { describe, expect, it } from "vitest";

import {
  background,
  contrastRatio,
  palette,
  text,
  highlight,
} from "../../../src/design/tokens";
import {
  MINIMO_AA_LARGE,
  MINIMO_AA_NORMAL,
  PISO_DE_TINTA,
  conferirContraste,
  medirContrasteDoThumbnail,
  minimoDaTinta,
} from "../../../src/entrega/thumbnail";

const LARGURA = 1280;
const ALTURA = 720;

function rgb(cor: string): [number, number, number] {
  return [
    parseInt(cor.slice(1, 3), 16),
    parseInt(cor.slice(3, 5), 16),
    parseInt(cor.slice(5, 7), 16),
  ];
}

interface Mancha {
  cor: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Um quadro sintetico: fundo chapado + manchas retangulares de tinta. */
function quadroDeTinta(fundo: string, manchas: Mancha[] = []): Uint8Array {
  const rgba = new Uint8Array(LARGURA * ALTURA * 4);
  const [fr, fg, fb] = rgb(fundo);
  for (let i = 0; i < LARGURA * ALTURA; i++) {
    rgba[i * 4] = fr;
    rgba[i * 4 + 1] = fg;
    rgba[i * 4 + 2] = fb;
    rgba[i * 4 + 3] = 255;
  }
  for (const m of manchas) {
    const [r, g, b] = rgb(m.cor);
    for (let py = m.y; py < m.y + m.altura; py++) {
      for (let px = m.x; px < m.x + m.largura; px++) {
        const i = (py * LARGURA + px) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

/** O retangulo do titulo — dentro da regiao graphics safe (margem 36px). */
const TITULO: Mancha = { cor: text.primary, x: 290, y: 342, largura: 700, altura: 36 };
const SUBTITULO: Mancha = { cor: text.secondary, x: 390, y: 380, largura: 500, altura: 18 };
const REGUA: Mancha = { cor: highlight.primary, x: 597, y: 376, largura: 85, altura: 3 };

describe("medirContrasteDoThumbnail", () => {
  it("acha o fundo dominante e mede as tintas com a MESMA formula dos tokens", () => {
    const quadro = quadroDeTinta(background.primary, [TITULO, SUBTITULO, REGUA]);
    const medida = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);

    expect(medida.fundo).toBe(background.primary.toLowerCase());
    const tintas = new Map(medida.tintas.map((t) => [t.cor, t]));

    // Presenca: o titulo, o subtitulo e a regua do manifesto estao na tela.
    expect(tintas.has(text.primary.toLowerCase())).toBe(true);
    expect(tintas.has(text.secondary.toLowerCase())).toBe(true);
    expect(tintas.has(highlight.primary.toLowerCase())).toBe(true);

    // Medido == declarado: a razao do PIXEL confere com a razao dos tokens
    // (o par registrado em tokens.ts declara exatamente o que a tela mostra).
    for (const cor of [text.primary, text.secondary, highlight.primary]) {
      const tinta = tintas.get(cor.toLowerCase())!;
      expect(tinta.razao).toBeCloseTo(
        contrastRatio(cor, background.primary),
        2,
      );
    }
  });

  it("uma tinta que casa par declarado AA normal herda o minimo 4.5", () => {
    const quadro = quadroDeTinta(background.primary, [TITULO]);
    const medida = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    const titulo = medida.tintas.find((t) => t.cor === text.primary.toLowerCase())!;
    expect(titulo.minimo).toBe(MINIMO_AA_NORMAL);
    expect(titulo.origemDoMinimo).toBe("par-declarado");
    expect(conferirContraste(medida)).toEqual([]);
  });

  it("∅-crit: tinta de contraste abaixo do minimo TEM de falhar a conferencia", () => {
    // gray 600 sobre o fundo do video: 2.68:1 — abaixo do piso AA large.
    const razao = contrastRatio(palette.gray[600], background.primary);
    expect(razao, "a sonda precisa estar abaixo do piso para ser uma sonda").toBeLessThan(
      MINIMO_AA_LARGE,
    );

    const quadro = quadroDeTinta(background.primary, [
      { ...TITULO, cor: palette.gray[600] },
    ]);
    const medida = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    const falhas = conferirContraste(medida);

    expect(falhas.length).toBeGreaterThan(0);
    const falha = falhas[0]!;
    expect(falha.motivo).toContain(palette.gray[600].toLowerCase());
    expect(falha.motivo).toContain("abaixo do minimo");
  });

  it("tinta sem par declarado cai no piso AA large e passa se estiver acima", () => {
    // gray 500 (4.19:1) nao e fg de nenhum par registrado sobre o fundo.
    const razao = contrastRatio(palette.gray[500], background.primary);
    expect(razao).toBeGreaterThanOrEqual(MINIMO_AA_LARGE);
    expect(razao).toBeLessThan(MINIMO_AA_NORMAL);

    const quadro = quadroDeTinta(background.primary, [
      { ...TITULO, cor: palette.gray[500] },
    ]);
    const medida = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    const tinta = medida.tintas.find((t) => t.cor === palette.gray[500].toLowerCase())!;
    expect(tinta.minimo).toBe(MINIMO_AA_LARGE);
    expect(tinta.origemDoMinimo).toBe("piso-aa-large");
    expect(conferirContraste(medida)).toEqual([]);
  });

  it("ruido de anti-aliasing (mistura de borda com poucos pixels) nao e tinta", () => {
    // Uma mistura quase da cor do fundo, com 100 px — abaixo do piso de
    // contagem — tem de ficar FORA das tintas: medir borda como tinta
    // acusaria um thumbnail saudavel (falso vermelho).
    const misturaDeBorda = "#0A0A14";
    const quadro = quadroDeTinta(background.primary, [
      TITULO,
      { cor: misturaDeBorda, x: 64, y: 36, largura: 100, altura: 1 },
    ]);
    const medida = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    expect(medida.tintas.some((t) => t.cor === misturaDeBorda)).toBe(false);
    expect(conferirContraste(medida)).toEqual([]);
  });

  it("cor declarada nos tokens e medida mesmo abaixo do piso — texto pequeno ainda e texto", () => {
    // O subtitulo de 18px da fixture canonica tem so ~106px solidos no
    // thumbnail (1280x720) — abaixo do piso, mas e um par DECLARADO em
    // tokens.ts (text.secondary sobre o fundo): tem de entrar na conta.
    const quadro = quadroDeTinta(background.primary, [
      { cor: text.secondary, x: 600, y: 342, largura: 50, altura: 1 },
    ]);
    const medida = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    const subtitulo = medida.tintas.find(
      (t) => t.cor === text.secondary.toLowerCase(),
    );
    expect(subtitulo).toBeDefined();
    expect(subtitulo!.contagem).toBeLessThan(PISO_DE_TINTA);
    expect(conferirContraste(medida)).toEqual([]);
  });

  it("cor nao declarada com poucos pixels nao entra na conta, mesmo colada no titulo", () => {
    const quadro = quadroDeTinta(background.primary, [
      TITULO,
      { cor: palette.gray[600], x: 290, y: 342, largura: 50, altura: 1 },
    ]);
    const medida = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    expect(medida.tintas.some((t) => t.cor === palette.gray[600].toLowerCase())).toBe(false);
    expect(conferirContraste(medida)).toEqual([]);
  });

  it("e deterministico: mesma tela, mesma medicao", () => {
    const quadro = quadroDeTinta(background.primary, [TITULO, SUBTITULO]);
    const a = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    const b = medirContrasteDoThumbnail(LARGURA, ALTURA, quadro);
    expect(a).toEqual(b);
  });

  it("recusa bytes fora do tamanho declarado", () => {
    expect(() => medirContrasteDoThumbnail(LARGURA, ALTURA, new Uint8Array(10))).toThrow();
  });
});

describe("minimoDaTinta", () => {
  it("par declarado AA normal exige 4.5", () => {
    expect(minimoDaTinta(text.primary, background.primary)).toBe(MINIMO_AA_NORMAL);
    expect(minimoDaTinta(text.secondary, background.primary)).toBe(MINIMO_AA_NORMAL);
  });

  it("cor sem par declarado sobre o fundo cai no piso AA large", () => {
    expect(minimoDaTinta(palette.gray[600], background.primary)).toBe(MINIMO_AA_LARGE);
  });

  it("o par declarado so vale quando o fundo casa o par", () => {
    // text.primary e declarado sobre background.primary; sobre outro fundo
    // nao ha par e o piso vale.
    expect(minimoDaTinta(text.primary, background.light)).toBe(MINIMO_AA_LARGE);
  });
});
