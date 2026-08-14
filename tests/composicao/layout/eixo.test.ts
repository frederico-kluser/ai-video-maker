// =============================================================================
// eixo — o eixo de texto: bandas, fator de transicao e montagem de videos
// =============================================================================
// Onda 2 (onda2-composicao, sub-parte 2a/2b). Unit tests das funcoes puras
// de src/composicao/layout/eixo.ts:
//
//   1. regioesDeTextoDaCena — uma banda disjunta por no de texto;
//   2. fatorDeTextoNaTransicao — 0 nos dois lados no meio da transicao;
//   3. escalonarGraficosDaCena — uma fatia por video de grafico.
//
// A sonda de sobreposicao (sonda-de-texto.test.ts) e o oraculo de FRAME;
// este arquivo e o oraculo da GEOMETRIA, em numeros.
// =============================================================================

import { describe, expect, it } from "vitest";
import type { Cena, No } from "../../../src/contratos/manifesto";
import {
  eDeTexto,
  escalonarGraficosDaCena,
  fatorDeTextoNaTransicao,
  regiaoDoQuadro,
  regioesDeTextoDaCena,
} from "../../../src/composicao/layout/eixo";

const W = 1920;
const H = 1080;
const MARGEM = Math.round(H * 0.05); // graphics safe — 54

function no(id: string, type: string, extra: Record<string, unknown> = {}): No {
  return { id, schema: "X.1", type, duracao_frames: 90, ...extra } as unknown as No;
}

function cena(id: string, nos: string[]): Cena {
  return { id, nos };
}

describe("regioesDeTextoDaCena — bandas verticais disjuntas", () => {
  it("cena sem no de texto: mapa vazio (midia/grafico nao tem banda)", () => {
    const porId = new Map<string, No>([
      ["n-001", no("n-001", "midia")],
      ["n-002", no("n-002", "grafico")],
    ]);
    const regioes = regioesDeTextoDaCena(cena("c", ["n-001", "n-002"]), porId, W, H);
    expect(regioes.size).toBe(0);
  });

  it("um unico no de texto: banda = quadro inteiro (comportamento historico)", () => {
    const porId = new Map<string, No>([["n-001", no("n-001", "cabecalho")]]);
    const regioes = regioesDeTextoDaCena(cena("c", ["n-001"]), porId, W, H);
    expect(regioes.get("n-001")).toEqual(regiaoDoQuadro(W, H));
  });

  it("dois nos de texto: duas bandas disjuntas, na ordem do manifesto", () => {
    const porId = new Map<string, No>([
      ["n-002", no("n-002", "texto")],
      ["n-003", no("n-003", "lista")],
    ]);
    const regioes = regioesDeTextoDaCena(cena("c", ["n-002", "n-003"]), porId, W, H);
    const topo = regioes.get("n-002")!;
    const base = regioes.get("n-003")!;
    expect(topo.y).toBe(MARGEM);
    expect(topo.altura).toBe(base.y - topo.y);
    expect(base.y).toBe(topo.y + topo.altura);
    expect(base.y + base.altura).toBe(H - MARGEM);
    expect(topo.y + topo.altura).toBeLessThanOrEqual(base.y);
  });

  it("codigo participa do eixo (o bloco de codigo e texto legivel)", () => {
    const porId = new Map<string, No>([
      ["n-008", no("n-008", "codigo")],
      ["n-004", no("n-004", "lista")],
    ]);
    const regioes = regioesDeTextoDaCena(cena("c", ["n-008", "n-004"]), porId, W, H);
    expect(regioes.size).toBe(2);
    expect(eDeTexto(no("n-008", "codigo"))).toBe(true);
  });

  it("midia no meio nao quebra a ordem das bandas", () => {
    const porId = new Map<string, No>([
      ["n-014", no("n-014", "texto")],
      ["n-006", no("n-006", "midia")],
      ["n-015", no("n-015", "cabecalho")],
    ]);
    const regioes = regioesDeTextoDaCena(cena("c", ["n-014", "n-006", "n-015"]), porId, W, H);
    expect(regioes.size).toBe(2);
    expect(regioes.get("n-014")!.y).toBeLessThan(regioes.get("n-015")!.y);
    expect(regioes.get("n-014")!.y + regioes.get("n-014")!.altura).toBeLessThanOrEqual(
      regioes.get("n-015")!.y,
    );
  });

  it("e deterministico: duas chamadas, mesmas bandas", () => {
    const porId = new Map<string, No>([
      ["n-002", no("n-002", "texto")],
      ["n-003", no("n-003", "lista")],
    ]);
    const a = regioesDeTextoDaCena(cena("c", ["n-002", "n-003"]), porId, W, H);
    const b = regioesDeTextoDaCena(cena("c", ["n-002", "n-003"]), porId, W, H);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });
});

describe("fatorDeTextoNaTransicao — o texto dos dois lados nunca coexiste", () => {
  it("fora de fronteira (lado null) o fator e 1", () => {
    expect(fatorDeTextoNaTransicao(null, 0)).toBe(1);
    expect(fatorDeTextoNaTransicao(null, 0.7)).toBe(1);
  });

  it("a cena que SAI some na primeira metade: 1 em 0, 0 em 0.5", () => {
    expect(fatorDeTextoNaTransicao("saindo", 0)).toBe(1);
    expect(fatorDeTextoNaTransicao("saindo", 0.25)).toBeCloseTo(0.5, 10);
    expect(fatorDeTextoNaTransicao("saindo", 0.5)).toBe(0);
  });

  it("a cena que ENTRA aparece na segunda metade: 0 em 0.5, 1 em 1", () => {
    expect(fatorDeTextoNaTransicao("entrando", 0.5)).toBe(0);
    expect(fatorDeTextoNaTransicao("entrando", 0.75)).toBeCloseTo(0.5, 10);
    expect(fatorDeTextoNaTransicao("entrando", 1)).toBe(1);
  });

  it("no MEIO da transicao os DOIS lados tem fator 0 — nenhum texto visivel", () => {
    expect(fatorDeTextoNaTransicao("saindo", 0.5)).toBe(0);
    expect(fatorDeTextoNaTransicao("entrando", 0.5)).toBe(0);
  });

  it("clampa fora da janela [0, 1] (progresso nunca sai dela, mas a funcao nao estoura)", () => {
    expect(fatorDeTextoNaTransicao("saindo", 2)).toBe(0);
    expect(fatorDeTextoNaTransicao("entrando", -1)).toBe(0);
    expect(fatorDeTextoNaTransicao("saindo", -0.5)).toBe(1);
  });
});

describe("escalonarGraficosDaCena — a montagem de videos de grafico", () => {
  function noGraficoVideo(id: string): No {
    return {
      id,
      schema: "Grafico.1",
      type: "grafico",
      duracao_frames: 90,
      tipo_grafico: "barras",
      dados: [],
      grafico_resolvido: {
        asset: {
          hash: "a".repeat(64),
          tipo: "video",
          mimeType: "video/webm",
          byteSize: 1,
          largura: 1920,
          altura: 1080,
          licenca: "CC0-1.0",
          atribuicaoObrigatoria: false,
          provedor: "local",
        },
        fonte: "/grafico/a.webm",
      },
    } as unknown as No;
  }

  it("cena com um unico grafico: sem montagem (nao ha o que escalonar)", () => {
    const porId = new Map<string, No>([["n-009", noGraficoVideo("n-009")]]);
    const fatias = escalonarGraficosDaCena(cena("c", ["n-009"]), porId, 120);
    expect(fatias).toEqual([]);
  });

  it("cinco videos em 120 frames: cinco fatias de 24, na ordem do manifesto", () => {
    const ids = ["n-009", "n-010", "n-011", "n-012", "n-013"];
    const porId = new Map<string, No>(ids.map((id) => [id, noGraficoVideo(id)]));
    const fatias = escalonarGraficosDaCena(cena("c", ids), porId, 120);
    expect(fatias).toStrictEqual([
      { noId: "n-009", inicio: 0, duracao: 24 },
      { noId: "n-010", inicio: 24, duracao: 24 },
      { noId: "n-011", inicio: 48, duracao: 24 },
      { noId: "n-012", inicio: 72, duracao: 24 },
      { noId: "n-013", inicio: 96, duracao: 24 },
    ]);
    // A soma das fatias fecha exatamente a cena: sem buraco, sem resto.
    const soma = fatias.reduce((acc, f) => acc + f.duracao, 0);
    expect(soma).toBe(120);
  });

  it("duracao que nao divide: a ultima fatia recebe o resto", () => {
    const ids = ["n-009", "n-010", "n-011"];
    const porId = new Map<string, No>(ids.map((id) => [id, noGraficoVideo(id)]));
    const fatias = escalonarGraficosDaCena(cena("c", ids), porId, 100);
    expect(fatias).toStrictEqual([
      { noId: "n-009", inicio: 0, duracao: 33 },
      { noId: "n-010", inicio: 33, duracao: 33 },
      { noId: "n-011", inicio: 66, duracao: 34 },
    ]);
  });

  it("grafico de IMAGEM (asset PNG) nao dispara a montagem — o historico vale", () => {
    const imagem: No = {
      ...noGraficoVideo("n-009"),
      grafico_resolvido: {
        asset: {
          hash: "b".repeat(64),
          tipo: "imagem",
          mimeType: "image/png",
          byteSize: 1,
          largura: 480,
          altura: 320,
          licenca: "CC0-1.0",
          atribuicaoObrigatoria: false,
          provedor: "local",
        },
        fonte: "/grafico/b.png",
      },
    } as unknown as No;
    const porId = new Map<string, No>([
      ["n-009", imagem],
      ["n-010", noGraficoVideo("n-010")],
    ]);
    const fatias = escalonarGraficosDaCena(cena("c", ["n-009", "n-010"]), porId, 120);
    expect(fatias).toEqual([]);
  });

  it("grafico sem asset resolvido (caminho dados) nao dispara a montagem", () => {
    const porId = new Map<string, No>([
      ["n-009", no("n-009", "grafico")],
      ["n-010", no("n-010", "grafico")],
    ]);
    const fatias = escalonarGraficosDaCena(cena("c", ["n-009", "n-010"]), porId, 120);
    expect(fatias).toEqual([]);
  });
});
