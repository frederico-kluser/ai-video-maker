// =============================================================================
// geometria.test.ts — aritmetica pura dos retangulos de camada
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Toda a defesa geometrica do card ("a camada nao cobre a safe area") desce a
// este modulo: intersecao, area, bandas de margem e fatias. Se a aritmetica
// mentir, a medicao inteira mente — por isso cada propriedade aqui e cobrada
// como invariante, nao como valor decorativo.
// =============================================================================

import { describe, expect, it } from "vitest";

import {
  NOMES_DAS_BANDAS,
  RETANGULO_VAZIO,
  areaDaIntersecao,
  areaDe,
  bandasDaMargem,
  baixoDe,
  contem,
  contemPonto,
  direitaDe,
  fatiarBanda,
  intersecaoDe,
  intersecta,
  recortar,
  type Retangulo,
} from "src/composicao/camadas/geometria";

const A: Retangulo = { x: 0, y: 0, largura: 100, altura: 100 };

describe("Retangulo — area e bordas", () => {
  it("areaDe: produto das dimensoes", () => {
    expect(areaDe(A)).toBe(10000);
    expect(areaDe({ x: 10, y: 20, largura: 30, altura: 40 })).toBe(1200);
  });

  it("areaDe: degenerado tem area zero, nunca negativa", () => {
    expect(areaDe({ x: 0, y: 0, largura: 0, altura: 100 })).toBe(0);
    expect(areaDe({ x: 0, y: 0, largura: -5, altura: 100 })).toBe(0);
  });

  it("bordas direita/baixo sao exclusivas", () => {
    expect(direitaDe(A)).toBe(100);
    expect(baixoDe(A)).toBe(100);
  });
});

describe("Intersecao", () => {
  it("sobreposicao parcial", () => {
    const b: Retangulo = { x: 50, y: 50, largura: 100, altura: 100 };
    const i = intersecaoDe(A, b);
    expect(i).toStrictEqual({ x: 50, y: 50, largura: 50, altura: 50 });
    expect(areaDaIntersecao(A, b)).toBe(2500);
  });

  it("encostar na borda NAO e intersecar (semi-aberto)", () => {
    const encosta: Retangulo = { x: 100, y: 0, largura: 50, altura: 100 };
    expect(intersecaoDe(A, encosta)).toStrictEqual(RETANGULO_VAZIO);
    expect(intersecta(A, encosta)).toBe(false);
  });

  it("disjuntos", () => {
    const longe: Retangulo = { x: 200, y: 200, largura: 10, altura: 10 };
    expect(intersecta(A, longe)).toBe(false);
  });

  it("contido devolve o proprio retangulo", () => {
    const dentro: Retangulo = { x: 10, y: 10, largura: 20, altura: 20 };
    expect(intersecaoDe(A, dentro)).toStrictEqual(dentro);
  });
});

describe("contem", () => {
  it("interno cabe inteiro no externo", () => {
    expect(contem(A, { x: 10, y: 10, largura: 20, altura: 20 })).toBe(true);
    expect(contem(A, { x: 0, y: 0, largura: 100, altura: 100 })).toBe(true);
  });

  it("qualquer escape para fora reprova", () => {
    expect(contem(A, { x: 90, y: 0, largura: 20, altura: 20 })).toBe(false);
    expect(contem(A, { x: 0, y: -1, largura: 10, altura: 10 })).toBe(false);
  });
});

describe("contemPonto", () => {
  it("borda direita e inferior exclusivas, esquerda e superior inclusivas", () => {
    expect(contemPonto(A, 0, 0)).toBe(true);
    expect(contemPonto(A, 99, 99)).toBe(true);
    expect(contemPonto(A, 100, 50)).toBe(false);
    expect(contemPonto(A, 50, 100)).toBe(false);
  });
});

describe("recortar", () => {
  it("recorta para dentro do limite", () => {
    const alvo: Retangulo = { x: -10, y: -10, largura: 120, altura: 120 };
    expect(recortar(alvo, A)).toStrictEqual(A);
  });

  it("fora do limite vira vazio", () => {
    const fora: Retangulo = { x: 200, y: 200, largura: 10, altura: 10 };
    expect(recortar(fora, A)).toStrictEqual(RETANGULO_VAZIO);
  });
});

describe("bandasDaMargem", () => {
  const quadro: Retangulo = { x: 0, y: 0, largura: 100, altura: 100 };
  const interno: Retangulo = { x: 25, y: 25, largura: 50, altura: 50 };

  it("ladrilha a margem: soma das areas == area da margem", () => {
    const bandas = bandasDaMargem(quadro, interno);
    const soma = bandas.reduce((acc, b) => acc + areaDe(b), 0);
    expect(soma).toBe(areaDe(quadro) - areaDe(interno));
  });

  it("nenhuma banda intersecta o retangulo interno", () => {
    for (const b of bandasDaMargem(quadro, interno)) {
      expect(areaDaIntersecao(b, interno)).toBe(0);
    }
  });

  it("ordem deterministica: topo, base, esquerda, direita", () => {
    expect(bandasDaMargem(quadro, interno).map((b) => b.nome)).toStrictEqual([
      "topo",
      "base",
      "esquerda",
      "direita",
    ]);
  });

  it("banda de area zero (margem daquele lado nula) nao entra no plano", () => {
    const colado: Retangulo = { x: 0, y: 25, largura: 100, altura: 50 };
    const bandas = bandasDaMargem(quadro, colado);
    expect(bandas.some((b) => b.nome === "esquerda")).toBe(false);
    expect(bandas.some((b) => b.nome === "direita")).toBe(false);
    expect(bandas.some((b) => b.nome === "topo")).toBe(true);
  });

  it("NOMES_DAS_BANDAS e a ordem canonica", () => {
    expect(NOMES_DAS_BANDAS).toStrictEqual([
      "topo",
      "base",
      "esquerda",
      "direita",
    ]);
  });
});

describe("fatiarBanda", () => {
  const banda = { nome: "topo" as const, x: 0, y: 0, largura: 100, altura: 10 };

  it("ladrilha a banda: soma das areas == area da banda", () => {
    const fatias = fatiarBanda(banda, 4);
    const soma = fatias.reduce((acc, f) => acc + areaDe(f), 0);
    expect(soma).toBe(areaDe(banda));
  });

  it("k = 0 e a fatia colada na borda do quadro", () => {
    const fatias = fatiarBanda(banda, 4);
    expect(fatias[0]).toStrictEqual({ x: 0, y: 0, largura: 100, altura: 3 });
  });

  it("coordenadas inteiras e sem buraco entre fatias", () => {
    const fatias = fatiarBanda(banda, 8);
    for (const f of fatias) {
      expect(Number.isInteger(f.x) && Number.isInteger(f.y)).toBe(true);
      expect(Number.isInteger(f.largura) && Number.isInteger(f.altura)).toBe(true);
    }
    const a = fatias[0];
    const b = fatias[1];
    if (a && b) {
      expect(baixoDe(a)).toBe(b.y);
    }
  });

  it("passos <= 0 devolve lista vazia", () => {
    expect(fatiarBanda(banda, 0)).toStrictEqual([]);
    expect(fatiarBanda(banda, -1)).toStrictEqual([]);
  });

  it("banda horizontal fatia na perpendicular (largura do lado)", () => {
    const lateral = { nome: "esquerda" as const, x: 0, y: 0, largura: 10, altura: 100 };
    const fatias = fatiarBanda(lateral, 4);
    for (const f of fatias) {
      expect(f.altura).toBe(100);
    }
  });
});
