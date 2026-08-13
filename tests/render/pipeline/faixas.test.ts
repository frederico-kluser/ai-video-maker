// =============================================================================
// PLANEJAMENTO DE FAIXAS — testes de unidade
// =============================================================================
// As regras do procedimento de chunks do Remotion (R12-09): cobertura sem
// buracos nem sobreposicao, todos os chunks com o mesmo numero de frames
// exceto o ultimo, e entradas impossiveis recusadas.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  planejarFaixas,
  coberturaDasFaixas,
  violacoesDeTamanho,
  ErroDePlanejamento,
} from "../../../src/render/pipeline/faixas";

describe("planejarFaixas — cobertura", () => {
  it("faixas cobrem [0, totalFrames) sem buracos nem sobreposicao", () => {
    const total = 727; // a fixture canonica
    const faixas = planejarFaixas(total, 4);

    expect(coberturaDasFaixas(faixas, total)).toEqual([]);

    // Soma das duracoes == total (presenca, nao lista fechada).
    const soma = faixas.reduce((s, f) => s + (f.fim - f.inicio), 0);
    expect(soma).toBe(total);

    // Disjuntas e ordenadas: a faixa i+1 comeca onde a i termina.
    for (let i = 1; i < faixas.length; i++) {
      expect(faixas[i]!.inicio).toBe(faixas[i - 1]!.fim);
    }
  });

  it("todos os chunks tem o mesmo tamanho exceto o ultimo (R12-09)", () => {
    const faixas = planejarFaixas(727, 4);
    expect(violacoesDeTamanho(faixas)).toEqual([]);

    const tamanhos = faixas.map((f) => f.fim - f.inicio);
    expect(tamanhos.slice(0, -1)).toEqual(new Array(tamanhos.length - 1).fill(tamanhos[0]));
    expect(tamanhos[tamanhos.length - 1]!).toBeLessThanOrEqual(tamanhos[0]!);
  });

  it("divisao exata: todas as faixas do mesmo tamanho, inclusive a ultima", () => {
    const faixas = planejarFaixas(900, 3);
    expect(violacoesDeTamanho(faixas)).toEqual([]);
    expect(faixas.map((f) => f.fim - f.inicio)).toEqual([300, 300, 300]);
  });

  it("uma faixa so: o plano e o intervalo inteiro", () => {
    const faixas = planejarFaixas(727, 1);
    expect(faixas).toEqual([{ inicio: 0, fim: 727 }]);
    expect(coberturaDasFaixas(faixas, 727)).toEqual([]);
  });

  it("determinismo: o mesmo plano para o mesmo par de entradas", () => {
    expect(planejarFaixas(727, 4)).toEqual(planejarFaixas(727, 4));
  });
});

describe("planejarFaixas — recusas (∅-crit do planejador)", () => {
  it("totalFrames < 1 e ERRO", () => {
    expect(() => planejarFaixas(0, 2)).toThrow(ErroDePlanejamento);
    expect(() => planejarFaixas(-1, 2)).toThrow(ErroDePlanejamento);
  });

  it("numeroDeFaixas < 1 e ERRO", () => {
    expect(() => planejarFaixas(727, 0)).toThrow(ErroDePlanejamento);
  });

  it("mais faixas que frames (faixa vazia) e ERRO", () => {
    expect(() => planejarFaixas(3, 4)).toThrow(ErroDePlanejamento);
  });
});
