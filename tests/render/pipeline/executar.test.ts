// =============================================================================
// O EXECUTOR DO RENDER POR FAIXAS — testes de unidade
// =============================================================================
// Pergunta adversarial 3 do card: um worker que morre deixa o pipeline
// VERDE? Nao: qualquer rejeicao de render (inteiro ou faixa) PROPAGA e
// derruba o pipeline. O renderer e injetado — o teste roda sem navegador.
// =============================================================================

import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  renderizarPorFaixas,
  ErroDeRender,
  type RendererDeFrames,
  type ContextoDoRender,
} from "../../../src/render/pipeline/executar";
import { planejarFaixas } from "../../../src/render/pipeline/faixas";

/** Um contexto fake: a composicao minima que o executor so repassa. */
function contextoFake(): ContextoDoRender {
  return {
    serveUrl: "file:///tmp/serve",
    composicao: {
      id: "integrado",
      durationInFrames: 60,
      fps: 30,
      width: 1920,
      height: 1080,
    } as ContextoDoRender["composicao"],
  };
}

/** Um renderer que conta chamadas e pode falhar sob encomenda. */
function rendererContador(
  falharNasFaixas: boolean,
): { renderer: RendererDeFrames; chamadas: { inicio: number; fim: number }[] } {
  const chamadas: { inicio: number; fim: number }[] = [];
  const renderer: RendererDeFrames = async (opcoes) => {
    chamadas.push({
      inicio: opcoes.frameRange[0],
      fim: opcoes.frameRange[1] + 1,
    });
    if (falharNasFaixas && opcoes.frameRange[0] > 0) {
      throw new Error("renderer morreu no meio da faixa");
    }
    return { frameCount: opcoes.frameRange[1] - opcoes.frameRange[0] + 1 };
  };
  return { renderer, chamadas };
}

const OPCOES_BASE = {
  entrada: "/tmp/entrada.tsx",
  composicaoId: "integrado",
  porta: 4501,
  saida: "",
  totalFrames: 60,
  faixas: planejarFaixas(60, 3),
  workers: 6,
};

describe("renderizarPorFaixas — sucesso", () => {
  it("renderiza o inteiro e as faixas, e soma as faixas cobre o inteiro", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "executar-"));
    const { renderer, chamadas } = rendererContador(false);
    const resultado = await renderizarPorFaixas(
      { ...OPCOES_BASE, saida: tmp },
      contextoFake(),
      undefined as never,
      renderer,
    );
    rmSync(tmp, { recursive: true, force: true });

    // Presenca: o inteiro foi renderizado e as faixas somam o total.
    expect(resultado.framesDoInteiro).toBe(60);
    expect(resultado.framesDasFaixas).toBe(60);
    expect(chamadas.length).toBe(4); // 1 inteiro + 3 faixas

    // O inteiro cobre [0, 60); as faixas sao disjuntas e cobrem o mesmo.
    const inteiro = chamadas[0]!;
    expect(inteiro).toEqual({ inicio: 0, fim: 60 });
    const faixas = chamadas.slice(1);
    expect(faixas[0]!.inicio).toBe(0);
    for (let i = 1; i < faixas.length; i++) {
      expect(faixas[i]!.inicio).toBe(faixas[i - 1]!.fim);
    }
    expect(faixas[faixas.length - 1]!.fim).toBe(60);
  });
});

describe("renderizarPorFaixas — worker morto (pergunta adversarial 3)", () => {
  it("uma faixa que falha derruba o pipeline (nunca verde)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "executar-"));
    const { renderer } = rendererContador(true);

    let erro: ErroDeRender | null = null;
    try {
      await renderizarPorFaixas(
        { ...OPCOES_BASE, saida: tmp },
        contextoFake(),
        undefined as never,
        renderer,
      );
    } catch (e) {
      erro = e as ErroDeRender;
    }
    rmSync(tmp, { recursive: true, force: true });

    expect(erro).not.toBeNull();
    expect(erro!.code).toBe("RENDER_FALHOU");
    expect(erro!.message).toContain("faixa");
    expect(erro!.message).toContain("nunca deixa verde");
  });

  it("o plano de faixas que estoura o teto de workers e recusado antes de render", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "executar-"));
    const { renderer } = rendererContador(false);

    let erro: ErroDeRender | null = null;
    try {
      await renderizarPorFaixas(
        {
          ...OPCOES_BASE,
          saida: tmp,
          faixas: planejarFaixas(60, 3),
          workers: 2, // 3 faixas x 1 worker = 3 > 2
        },
        contextoFake(),
        undefined as never,
        renderer,
      );
    } catch (e) {
      erro = e as ErroDeRender;
    }
    rmSync(tmp, { recursive: true, force: true });

    expect(erro).not.toBeNull();
    expect(erro!.message).toContain("teto de workers");
  });

  it("faixas que nao somam o total sao recusadas (a concatenacao nao cobre)", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "executar-"));
    // Renderer que devolve menos frames do que prometeu em cada faixa.
    const renderer: RendererDeFrames = async (opcoes) => ({
      frameCount: opcoes.frameRange[1] - opcoes.frameRange[0], // um a menos
    });

    let erro: ErroDeRender | null = null;
    try {
      await renderizarPorFaixas(
        { ...OPCOES_BASE, saida: tmp },
        contextoFake(),
        undefined as never,
        renderer,
      );
    } catch (e) {
      erro = e as ErroDeRender;
    }
    rmSync(tmp, { recursive: true, force: true });

    expect(erro).not.toBeNull();
    expect(erro!.message).toContain("nao cobre o render inteiro");
  });
});
