// =============================================================================
// O EXECUTOR DO RENDER POR FAIXAS — o coracao do pipeline (F5-01)
// =============================================================================
//
// Renderiza a composicao INTEIRA e, em paralelo, cada faixa do plano —
// todas em SEQUENCIA DE PNG (imageFormat "png", a codificacao
// deterministica da delimitacao em codificacoes.ts). A comparacao byte a
// byte entre a concatenacao das faixas e o render inteiro e o ∅-crit do
// card; o executor entrega os dois lados da comparacao.
//
//   - CONCORRENCIA: o numero total de workers ativos (soma de todas as
//     arvores simultaneas) nunca excede o teto do orcamento (ADR-0032,
//     decisao 1: <= 8; decisao 3: RAM <= 24 GiB com MemTotal lido em
//     runtime — AB-986). O executor NUNCA deixa o default do Remotion
//     decidir: sem o valor explicito, o teto poderia sumir numa versao
//     futura e a RAM dobraria sem aviso (R05-10).
//   - WORKER QUE MORRE: qualquer rejeicao de render — de uma faixa ou do
//     inteiro — PROPAGA e derruba o pipeline. Um worker morto nunca
//     deixa o pipeline verde (pergunta adversarial 3 do card): o executor
//     nao engole erro, nao devolve "parcialmente pronto".
//   - O executor recebe o renderer INJETAVEL (default: renderFrames do
//     @remotion/renderer) — o teste de worker-morto roda sem navegador.
// =============================================================================

import { bundle as bundleReal } from "@remotion/bundler";
import { renderFrames as renderFramesReal, selectComposition } from "@remotion/renderer";
import type { VideoConfig } from "remotion/no-react";
import { mkdirSync } from "node:fs";
import type { FaixaDeFrames } from "./faixas";

/** A assinatura minima do renderer de frames (injetavel no teste). */
export interface RendererDeFrames {
  (opcoes: {
    composition: VideoConfig;
    serveUrl: string;
    outputDir: string;
    frameRange: [number, number];
    concurrency: number;
  }): Promise<{ frameCount: number }>;
}

/** O bundle e a composicao escolhida — o contexto de um render inteiro. */
export interface ContextoDoRender {
  readonly serveUrl: string;
  readonly composicao: VideoConfig;
}

/** Opcoes do executor. */
export interface OpcoesDoExecutor {
  /** Entry point do bundle (o mesmo da suite integrada). */
  readonly entrada: string;
  /** publicDir do bundle (assets + fontes). */
  readonly publicDir?: string;
  /** Composicao a renderizar. */
  readonly composicaoId: string;
  /** Porta TCP deste card (S-9: F5-01 = 4501). */
  readonly porta: number;
  /** Diretorio de saida (em /tmp — AB-984). */
  readonly saida: string;
  /** Total de frames da composicao. */
  readonly totalFrames: number;
  /** O plano de faixas. */
  readonly faixas: readonly FaixaDeFrames[];
  /** Workers do orcamento (nunca acima do teto). */
  readonly workers: number;
  /** Renderer injetavel (default: o real). */
  readonly renderer?: RendererDeFrames;
}

/** Resultado do executor: os dois lados da comparacao byte a byte. */
export interface ResultadoDoExecutor {
  /** Diretorio com os PNGs do render INTEIRO (frame-NNN.png). */
  readonly dirDoInteiro: string;
  /** Um diretorio de PNGs por faixa, na ordem do plano. */
  readonly dirsDasFaixas: readonly string[];
  /** Total de frames renderizados no inteiro (presenca: > 0). */
  readonly framesDoInteiro: number;
  /** Total de frames renderizados nas faixas (soma). */
  readonly framesDasFaixas: number;
}

/** Erro do executor: render falhou — o pipeline NAO pode ficar verde. */
export class ErroDeRender extends Error {
  readonly code = "RENDER_FALHOU";
  constructor(mensagem: string, readonly causa?: unknown) {
    super(mensagem);
    this.name = "ErroDeRender";
  }
}

/**
 * Monta o contexto do render: bundle + selecao da composicao.
 * Falha (bundle, composicao inexistente) PROPAGA — exit nao-zero.
 */
export async function prepararRender(
  opcoes: Pick<OpcoesDoExecutor, "entrada" | "publicDir" | "composicaoId">,
  bundle: typeof bundleReal = bundleReal,
): Promise<ContextoDoRender> {
  const serveUrl = await bundle({
    entryPoint: opcoes.entrada,
    publicDir: opcoes.publicDir,
    onProgress: () => undefined,
  });
  const composicao = await selectComposition({
    serveUrl,
    id: opcoes.composicaoId,
    logLevel: "error",
  });
  return { serveUrl, composicao };
}

/**
 * Executa o render por faixas: inteiro primeiro, faixas em paralelo depois
 * (fases separadas: o pico de arvores simultaneas e o da fase de faixas).
 *
 * Falha de QUALQUER render (inteiro ou faixa) rejeita a promessa — o gate
 * fica VERMELHO. Nenhum worker morto e varrido para debaixo do tapete.
 */
export async function renderizarPorFaixas(
  opcoes: OpcoesDoExecutor,
  contexto?: ContextoDoRender,
  bundle: typeof bundleReal = bundleReal,
  renderer: RendererDeFrames = rendererReal,
): Promise<ResultadoDoExecutor> {
  const {
    entrada,
    publicDir,
    composicaoId,
    porta,
    saida,
    totalFrames,
    faixas,
    workers,
  } = opcoes;

  mkdirSync(saida, { recursive: true });

  const ctx =
    contexto ??
    (await prepararRender({ entrada, publicDir, composicaoId }, bundle));

  // ── Fase 1: o render inteiro (1 arvore, workers do orcamento) ──
  const dirDoInteiro = `${saida}/inteiro`;
  mkdirSync(dirDoInteiro, { recursive: true });
  const inteiro = await executarFrames({
    renderer,
    ctx,
    dir: dirDoInteiro,
    faixa: { inicio: 0, fim: totalFrames },
    workers,
    porta,
  });

  // ── Fase 2: as faixas, em paralelo, dividindo o teto de workers ──
  const dirsDasFaixas: string[] = [];
  for (let i = 0; i < faixas.length; i++) {
    const dir = `${saida}/faixa-${String(i).padStart(2, "0")}`;
    mkdirSync(dir, { recursive: true });
    dirsDasFaixas.push(dir);
  }

  const workersPorFaixa = Math.max(1, Math.floor(workers / faixas.length));
  // Soma dos workers de TODAS as faixas simultaneas <= teto (AB-988):
  // o numero que a maquina tem de caber e o TOTAL, nao o por-faixa.
  const totalSimultaneo = workersPorFaixa * faixas.length;
  if (totalSimultaneo > workers) {
    throw new ErroDeRender(
      `plano de faixas estoura o teto de workers: ${String(totalSimultaneo)} ` +
        `(faixas x por-faixa) > ${String(workers)} (ADR-0032, decisao 1)`,
    );
  }

  const resultadosDasFaixas = await Promise.all(
    faixas.map((faixa, i) =>
      executarFrames({
        renderer,
        ctx,
        dir: dirsDasFaixas[i]!,
        faixa,
        workers: workersPorFaixa,
        porta,
      }),
    ),
  );

  const framesDasFaixas = resultadosDasFaixas.reduce(
    (soma, r) => soma + r.frameCount,
    0,
  );
  if (framesDasFaixas !== totalFrames) {
    throw new ErroDeRender(
      `as faixas renderizaram ${String(framesDasFaixas)} frames, o inteiro ` +
        `${String(totalFrames)} — a concatenacao nao cobre o render inteiro`,
    );
  }

  return Object.freeze({
    dirDoInteiro,
    dirsDasFaixas,
    framesDoInteiro: inteiro.frameCount,
    framesDasFaixas,
  });
}

/** Uma execucao de frames, com o renderer injetado e a porta do card. */
async function executarFrames(opcoes: {
  renderer: RendererDeFrames;
  ctx: ContextoDoRender;
  dir: string;
  faixa: FaixaDeFrames;
  workers: number;
  porta: number;
}): Promise<{ frameCount: number }> {
  const { renderer, ctx, dir, faixa, workers, porta } = opcoes;
  try {
    return await renderer({
      composition: ctx.composicao,
      serveUrl: ctx.serveUrl,
      outputDir: dir,
      frameRange: [faixa.inicio, faixa.fim - 1], // frameRange e INCLUSIVO
      concurrency: workers,
    });
  } catch (erro) {
    throw new ErroDeRender(
      `o render da faixa [${String(faixa.inicio)}, ${String(faixa.fim)}) ` +
        `falhou na porta ${String(porta)} — worker morto derruba o pipeline ` +
        `(nunca deixa verde): ${erro instanceof Error ? erro.message : String(erro)}`,
      erro,
    );
  }
}

/**
 * O renderer real: renderFrames do @remotion/renderer com os parametros do
 * pipeline — PNG (codec deterministico), frameRange inclusivo, concurrency
 * explicita (nunca o default do Remotion) e gl=swangle (o backend medido
 * do I-03 — AB-982).
 */
export const rendererReal: RendererDeFrames = async (opcoes) => {
  const resultado = await renderFramesReal({
    composition: opcoes.composition,
    serveUrl: opcoes.serveUrl,
    outputDir: opcoes.outputDir,
    frameRange: opcoes.frameRange,
    imageFormat: "png",
    concurrency: opcoes.concurrency,
    chromiumOptions: { gl: "swangle" },
    imageSequencePattern: "frame-[frame].png",
    logLevel: "error",
    inputProps: {},
    onStart: () => undefined,
    onFrameUpdate: () => undefined,
  });
  return { frameCount: resultado.frameCount };
};
