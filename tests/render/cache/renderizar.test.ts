// =============================================================================
// O RENDER COM CACHE — testes com renderer FAKE (card F5-09, W8)
// =============================================================================
//
// Estes testes exercitam `renderizarComCache` SEM navegador: o renderer
// injetado escreve bytes sinteticos por frame. O que eles asserem:
//
//   - acerto QUENTE: segunda chamada com a mesma chave NAO chama o
//     renderer (chamadas == 0) e serve os MESMOS bytes;
//   - a sonda de MISS forcado (AB-685): chave fria re-renderiza e os
//     bytes batem com o render sem cache — cache quente NAO prova
//     render;
//   - miss PARCIAL: so a faixa faltante e renderizada;
//   - ∅-crit do PROGRAMA: token de design MUDADO com cache quente —
//     a chave muda, o cache NAO serve (miss), o renderer e chamado;
//   - worker morto com cache quente + miss forcado: a rejeicao PROPAGA
//     (um cache quente nao mascara worker morto — AB-685);
//   - render parcial nunca e aceito.
//
// O renderer fake recebe o MESMO contrato do pipeline (`RendererDeFrames`
// de src/render/pipeline/executar.ts) — o teste e um contrato de
// integracao com o F5-01.
// =============================================================================

import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  renderizarComCache,
  type ResultadoDoRenderComCache,
} from "../../../src/render/cache/renderizar";
import { calcularChaveC7 } from "../../../src/render/cache/chave";
import { ErroDeRender } from "../../../src/render/pipeline/executar";

const TOTAL = 8;

const VERSAO_BASE = {
  remotion: "4.0.507",
  renderer: "4.0.507",
  bundler: "4.0.507",
  compositor: "4.0.507",
  navegador: "149.0.7790.0",
} as const;

const PIN_BASE = { node: "24.15.0", ffmpeg: "6.1.1-3ubuntu5" } as const;

const MANIFESTO = Buffer.from(JSON.stringify({ schema_version: "ManifestoResolvido.1" }));
const ASSETS = new Map<string, Buffer>([["a".repeat(64), Buffer.from("bytes")]]);

function chaveComTokens(tokensConsumidos?: unknown): string {
  return calcularChaveC7({
    manifestoResolvido: MANIFESTO,
    assets: ASSETS,
    tokensConsumidos,
    versoes: VERSAO_BASE,
    pinFerramentas: PIN_BASE,
  });
}

const TOKENS_REAIS = { fundo: { primario: "#030712" }, texto: { primario: "#F9FAFB" } };
const TOKENS_MUTADOS = { fundo: { primario: "#010203" }, texto: { primario: "#F9FAFB" } };

/**
 * O renderer fake: escreve um byte sintetico por frame no outputDir —
 * o MESMO contrato do rendererReal do pipeline (frameRange INCLUSIVO).
 */
function rendererFake(opcoes: {
  composition: unknown;
  serveUrl: string;
  outputDir: string;
  frameRange: [number, number];
  concurrency: number;
}): Promise<{ frameCount: number }> {
  mkdirSync(opcoes.outputDir, { recursive: true });
  const [inicio, fim] = opcoes.frameRange;
  for (let f = inicio; f <= fim; f++) {
    writeFileSync(join(opcoes.outputDir, `frame-${String(f)}.png`), Buffer.from(`sintetico-${String(f)}`));
  }
  return Promise.resolve({ frameCount: fim - inicio + 1 });
}

/** O renderer fake com contador de chamadas (a sonda do "nao renderizou"). */
function rendererFakeContado() {
  const chamadas: Array<{ inicio: number; fim: number }> = [];
  const renderer = vi.fn((opcoes: Parameters<typeof rendererFake>[0]) => {
    chamadas.push({ inicio: opcoes.frameRange[0], fim: opcoes.frameRange[1] });
    return rendererFake(opcoes);
  });
  return { renderer, chamadas };
}

function opcoesPara(
  chave: string,
  raiz: string,
  saida: string,
  renderer: unknown,
  extras: Record<string, unknown> = {},
): Parameters<typeof renderizarComCache>[0] {
  return {
    entrada: "fixtures/snapshots/integrado/entrada.tsx",
    composicaoId: "integrado",
    porta: 4509,
    totalFrames: TOTAL,
    workers: 2,
    chaveC7: chave,
    raizDoCache: raiz,
    saida,
    renderer: renderer as never,
    // Contexto stub: o teste nao faz bundle nem abre navegador — o
    // renderer fake ignora composition/serveUrl. O gate real passa o
    // contexto do bundle de verdade.
    contexto: {
      serveUrl: "served-by-test",
      composicao: { id: "integrado", fps: 30, width: 1920, height: 1080 },
    } as never,
    ...extras,
  };
}

/** Le os bytes de um diretorio de saida, por indice absoluto. */
function bytesDaSaida(dir: string): Map<number, Buffer> {
  const mapa = new Map<number, Buffer>();
  for (let f = 0; f < TOTAL; f++) {
    try {
      mapa.set(f, readFileSync(join(dir, `frame-${String(f)}.png`)));
    } catch {
      // ausente — quem pergunta decide
    }
  }
  return mapa;
}

function ambiente(): { raiz: string; saida: string; limpar: () => void } {
  const raiz = mkdtempSync(join(tmpdir(), "cache-render-"));
  const saida = mkdtempSync(join(tmpdir(), "cache-saida-"));
  return {
    raiz,
    saida,
    limpar: () => {
      rmSync(raiz, { recursive: true, force: true });
      rmSync(saida, { recursive: true, force: true });
    },
  };
}

describe("renderizarComCache — o ciclo quente/frio", () => {
  it("acerto QUENTE nao chama o renderer e serve os MESMOS bytes", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chave = chaveComTokens(TOKENS_REAIS);
      const { renderer, chamadas } = rendererFakeContado();

      // 1a passada: miss total -> renderiza e popula o cache.
      const frio = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "frio"), renderer),
      );
      expect(frio.chamadasDoRenderer).toBe(1);
      expect(frio.acertouTudo).toBe(false);
      expect(frio.framesDoCache).toBe(0);
      expect(frio.framesRenderizados).toBe(TOTAL);

      // 2a passada: MESMA chave -> acerto quente, renderer NAO chamado.
      const quente = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "quente"), renderer),
      );
      expect(quente.chamadasDoRenderer).toBe(0);
      expect(quente.acertouTudo).toBe(true);
      expect(quente.framesDoCache).toBe(TOTAL);
      expect(chamadas).toHaveLength(1);

      // Os bytes servidos sao os MESMOS renderizados (acertou pelo motivo
      // certo: a chave).
      const doFrio = bytesDaSaida(frio.dirDeSaida);
      const doQuente = bytesDaSaida(quente.dirDeSaida);
      for (let f = 0; f < TOTAL; f++) {
        expect(doFrio.get(f)?.toString()).toBe(`sintetico-${String(f)}`);
        expect(doQuente.get(f)?.equals(doFrio.get(f)!)).toBe(true);
      }
    } finally {
      limpar();
    }
  });

  it("sonda de MISS forcado (AB-685): chave fria re-renderiza e os bytes batem", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chave = chaveComTokens(TOKENS_REAIS);
      const { renderer } = rendererFakeContado();

      // "Render sem cache": raiz vazia, miss total — o render frio.
      const semCache = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "sem-cache"), renderer),
      );
      const bytesSemCache = bytesDaSaida(semCache.dirDeSaida);

      // "Miss forcado": cache apagado -> o gate re-renderiza de verdade.
      const { ArmazemDeCache } = await import("../../../src/render/cache/armazenar");
      new ArmazemDeCache({ raiz, chave, codec: "png" }).limpar();
      const missForcado = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "miss-forcado"), renderer),
      );
      expect(missForcado.chamadasDoRenderer).toBe(1);

      // Compara contra o render sem cache — bytes iguais por frame.
      const bytesDoMiss = bytesDaSaida(missForcado.dirDeSaida);
      for (let f = 0; f < TOTAL; f++) {
        expect(bytesDoMiss.get(f)?.equals(bytesSemCache.get(f)!)).toBe(true);
      }
    } finally {
      limpar();
    }
  });

  it("miss PARCIAL: so a faixa faltante e renderizada", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chave = chaveComTokens(TOKENS_REAIS);
      const { renderer, chamadas } = rendererFakeContado();

      await renderizarComCache(opcoesPara(chave, raiz, join(saida, "a"), renderer));
      expect(chamadas).toHaveLength(1);

      // Apaga o frame 3 (e so ele) -> a faixa [3,3] e renderizada de novo.
      const { ArmazemDeCache } = await import("../../../src/render/cache/armazenar");
      const armazem = new ArmazemDeCache({ raiz, chave, codec: "png" });
      const caminho = armazem.caminhoDoFrame(3);
      rmSync(caminho, { force: true });

      const parcial = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "b"), renderer),
      );
      expect(parcial.chamadasDoRenderer).toBe(1);
      expect(parcial.framesDoCache).toBe(TOTAL - 1);
      expect(parcial.framesRenderizados).toBe(1);
      expect(chamadas).toHaveLength(2);
      expect(chamadas[1]).toEqual({ inicio: 3, fim: 3 });
    } finally {
      limpar();
    }
  });

  it("∅-crit: TOKEN MUDADO com cache quente — a chave muda e o cache NAO serve", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chaveReal = chaveComTokens(TOKENS_REAIS);
      const chaveMutada = chaveComTokens(TOKENS_MUTADOS);
      expect(chaveMutada).not.toBe(chaveReal);

      const { renderer, chamadas } = rendererFakeContado();

      // Popula o cache com a chave REAL (quente).
      await renderizarComCache(opcoesPara(chaveReal, raiz, join(saida, "a"), renderer));
      expect(chamadas).toHaveLength(1);

      // Render com a chave MUTADA: cache quente NAO pode servir — a chave
      // mudou, o renderer TEM de ser chamado (senao o ∅-crit e VERMELHO:
      // o token mudou e o cache nao invalidou).
      const mutado = await renderizarComCache(
        opcoesPara(chaveMutada, raiz, join(saida, "b"), renderer),
      );
      expect(mutado.acertouTudo).toBe(false);
      expect(mutado.chamadasDoRenderer).toBe(1);
      expect(mutado.framesDoCache).toBe(0);
      expect(chamadas).toHaveLength(2);
    } finally {
      limpar();
    }
  });

  it("worker morto com cache quente + miss forcado: a rejeicao PROPAGA (AB-685)", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chave = chaveComTokens(TOKENS_REAIS);
      const { renderer } = rendererFakeContado();

      // Cache quente populado.
      await renderizarComCache(opcoesPara(chave, raiz, join(saida, "a"), renderer));

      // O worker "morre": o renderer passa a rejeitar. O gate força o
      // MISS e re-renderiza — a rejeicao TEM de derrubar o pipeline,
      // nunca ser mascarada pelo cache quente.
      const morto = vi.fn(() => Promise.reject(new Error("worker morreu")));
      const { ArmazemDeCache } = await import("../../../src/render/cache/armazenar");
      new ArmazemDeCache({ raiz, chave, codec: "png" }).limpar();

      let erro: ErroDeRender | null = null;
      try {
        await renderizarComCache(
          opcoesPara(chave, raiz, join(saida, "b"), morto),
        );
      } catch (e) {
        erro = e as ErroDeRender;
      }
      expect(erro).not.toBeNull();
      expect(erro!.message).toContain("worker morreu");
      expect(erro!.message).toMatch(/AB-685|morreu/);
    } finally {
      limpar();
    }
  });

  it("render PARCIAL nunca e aceito — frames a menos derrubam o pipeline", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chave = chaveComTokens(TOKENS_REAIS);
      const parcial = vi.fn(
        (opcoes: Parameters<typeof rendererFake>[0]) =>
          Promise.resolve({ frameCount: 0 }), // entrega ZERO frames
      );

      let erro: ErroDeRender | null = null;
      try {
        await renderizarComCache(
          opcoesPara(chave, raiz, join(saida, "a"), parcial),
        );
      } catch (e) {
        erro = e as ErroDeRender;
      }
      expect(erro).not.toBeNull();
      expect(erro!.message).toMatch(/entregou 0|parcial/);
    } finally {
      limpar();
    }
  });

  it("pergunta (2): um cache acertando pelo MOTIVO ERRADO e detectavel — bytes trocados divergem", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chave = chaveComTokens(TOKENS_REAIS);
      const { renderer } = rendererFakeContado();

      const primeiro = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "a"), renderer),
      );
      const base = bytesDaSaida(primeiro.dirDeSaida);

      // Corrompe o frame 2 NO CACHE (o que um armazenamento errado faria):
      // o acerto quente tem de SERVIR o byte errado e o comparador do
      // gate tem de VER a divergencia — nunca o cache mascara.
      const { ArmazemDeCache } = await import("../../../src/render/cache/armazenar");
      new ArmazemDeCache({ raiz, chave, codec: "png" }).gravar(
        2,
        Buffer.from("bytes-CORROMPIDOS"),
      );

      const quente = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "b"), renderer),
      );
      expect(quente.chamadasDoRenderer).toBe(0); // acerto quente
      const servidos = bytesDaSaida(quente.dirDeSaida);
      // O byte corrupto e SERVido — e o gate compara com a linha de base
      // byte a byte: divergencia detectada (pergunta adversarial 2).
      expect(servidos.get(2)?.toString()).toBe("bytes-CORROMPIDOS");
      expect(servidos.get(2)?.equals(base.get(2)!)).toBe(false);
    } finally {
      limpar();
    }
  });

  it("chaves diferentes nunca se misturam: o cache de A nao serve B", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chaveA = chaveComTokens(TOKENS_REAIS);
      const chaveB = chaveComTokens(TOKENS_MUTADOS);
      const { renderer } = rendererFakeContado();

      await renderizarComCache(opcoesPara(chaveA, raiz, join(saida, "a"), renderer));
      const paraB = await renderizarComCache(
        opcoesPara(chaveB, raiz, join(saida, "b"), renderer),
      );
      // B nao acertou nada de A: renderizou tudo de novo.
      expect(paraB.framesDoCache).toBe(0);
      expect(paraB.framesRenderizados).toBe(TOTAL);
    } finally {
      limpar();
    }
  });
});

describe("renderizarComCache — resultado tipado para o F5-07", () => {
  it("o resultado expoe dirDeSaida com todos os frames do total", async () => {
    const { raiz, saida, limpar } = ambiente();
    try {
      const chave = chaveComTokens(TOKENS_REAIS);
      const { renderer } = rendererFakeContado();
      const resultado = await renderizarComCache(
        opcoesPara(chave, raiz, join(saida, "a"), renderer),
      );
      expect(resultado.dirDeSaida).toBe(join(saida, "a", "frames"));
      const bytes = bytesDaSaida(resultado.dirDeSaida);
      expect(bytes.size).toBe(TOTAL);
      const r: ResultadoDoRenderComCache = resultado;
      expect(r.acertouTudo).toBe(false);
    } finally {
      limpar();
    }
  });
});
