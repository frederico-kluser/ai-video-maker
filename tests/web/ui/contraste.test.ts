// =============================================================================
// CONTRASTE DA PALETA DA UI — piso WCAG AA para os pares de estilos.css
// =============================================================================
// A paleta da UI vive EM src/web/ui/src/estilos.css (CSS nao passa pela
// varredura de literais de tests/design/literal-scan.test.ts, que cobre
// .ts/.tsx). Este teste ESPELHA os pares do CSS e asserta o piso:
//
//   - texto normal  >= 4.5:1 (WCAG AA — motion-design-system: "contraste
//     minimo 4.5:1 para texto normal", emprestado da WCAG e que aqui
//     vale DIRETO, porque a UI e pagina web);
//   - o unico par fora do piso e o do botao primario (texto escuro sobre
//     primaria) — ainda assim 7.29:1, acima de AA.
//
// Quem editar uma cor no CSS TEM de editar o par aqui; o teste e o
// guarda (sem ele, uma cor solta entra sem razao de contraste medida).
// =============================================================================

import { describe, expect, it } from "vitest";

/**
 * Pares (texto, fundo) usados em estilos.css — [nome, texto, fundo].
 * Espelho DECLARADO da folha de estilos: nao importa o CSS de proposito
 * (o teste e a verificacao da escolha de cor, nao um leitor do arquivo).
 */
const PALETA: ReadonlyArray<readonly [string, string, string]> = [
  ["texto-em-fundo", "#eef1f6", "#0d1017"],
  ["texto-suave-em-fundo", "#b6c0cf", "#0d1017"],
  ["texto-fraco-em-fundo", "#9aa4b5", "#0d1017"],
  ["texto-em-superficie", "#eef1f6", "#141a24"],
  ["texto-suave-em-superficie", "#b6c0cf", "#141a24"],
  ["texto-fraco-em-superficie", "#9aa4b5", "#141a24"],
  ["primaria-em-fundo", "#5aa2ff", "#0d1017"],
  ["texto-em-primaria", "#0d1017", "#5aa2ff"],
  ["perigo-em-fundo", "#ff8a80", "#0d1017"],
  ["ok-em-fundo", "#7ee2a8", "#0d1017"],
  ["aviso-em-fundo", "#f5c15c", "#0d1017"],
  ["texto-em-superficie-alta", "#eef1f6", "#1b2331"],
] as const;

/** Racao de contraste WCAG (secao 1.4.3): (L1 + 0.05) / (L2 + 0.05). */
function razaoDeContraste(texto: string, fundo: string): number {
  const lTexto = luminanciaRelativa(texto);
  const lFundo = luminanciaRelativa(fundo);
  const maisClara = Math.max(lTexto, lFundo);
  const maisEscura = Math.min(lTexto, lFundo);
  return (maisClara + 0.05) / (maisEscura + 0.05);
}

/** Luminancia relativa de um #rrggbb (canais linearizados da WCAG). */
function luminanciaRelativa(hex: string): number {
  const canais = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(canais)) {
    throw new Error(`cor fora do formato #rrggbb: ${hex}`);
  }
  const r = Number.parseInt(canais.slice(0, 2), 16) / 255;
  const g = Number.parseInt(canais.slice(2, 4), 16) / 255;
  const b = Number.parseInt(canais.slice(4, 6), 16) / 255;
  const linear = (v: number): number => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

const PISO_TEXTO_NORMAL = 4.5;

describe("paleta da UI — piso de contraste WCAG AA", () => {
  it("a paleta espelha estilos.css (pelo menos os pares do cabecalho)", () => {
    // Denominador: o espelho nao pode encolher em silencio — somem
    // pares do CSS e este teste deixa de cobri-los.
    expect(PALETA.length).toBeGreaterThanOrEqual(12);
  });

  it("todo par de texto tem razao >= 4.5:1 (AA para texto normal)", () => {
    for (const [nome, texto, fundo] of PALETA) {
      const razao = razaoDeContraste(texto, fundo);
      expect(razao, `${nome}: ${texto} sobre ${fundo}`).toBeGreaterThanOrEqual(PISO_TEXTO_NORMAL);
    }
  });

  it("a formula WCAG confere contra o exemplo canonico da propria WCAG", () => {
    // #FFFFFF sobre #767676 = 4.54:1 — o exemplo da secao 1.4.3.
    expect(razaoDeContraste("#ffffff", "#767676")).toBeGreaterThanOrEqual(4.5);
    expect(razaoDeContraste("#ffffff", "#767676")).toBeLessThan(4.6);
  });
});
