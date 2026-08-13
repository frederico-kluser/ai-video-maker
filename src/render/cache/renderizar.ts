// =============================================================================
// O RENDER COM CACHE — a integracao do cache C7 com o pipeline (F5-09)
// =============================================================================
//
// `renderizarComCache` envolve o renderer do pipeline (F5-01): consulta
// a chave C7, serve os frames presentes e renderiza SOMENTE os
// faltantes, por faixas contiguas de indices ABSOLUTOS (AB-691). A
// unidade do cache e o frame — a faixa e apenas particionamento de
// execucao, e o plano pode mudar entre execucoes sem afetar o acerto.
//
// O que este modulo NAO faz:
//   - nao decide a chave por conta propria — o chamador computa a chave
//     C7 (ou injeta a mutada, na sonda do gate);
//   - nao engole erro de render: o renderer que rejeita PROPAGA
//     (worker morto derruba o pipeline — AB-685; um cache QUENTE nao
//     prova render, e a sonda de miss do gate existe exatamente para
//     isso);
//   - nao aceita render parcial: cada faixa renderizada tem de entregar
//     TODOS os frames que pediu, senao ErroDeFrameAusente (verde vira
//     vermelho, nunca compara errado em silencio).
//
// O renderer e INJETAVEL (o mesmo `RendererDeFrames` do pipeline) — o
// teste de worker-morto e o contador de chamadas rodam sem navegador.
// =============================================================================

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ErroDeRender,
  prepararRender,
  type ContextoDoRender,
  type RendererDeFrames,
} from "../pipeline/executar";
import type { ComponentesDaChaveC7 } from "./chave";
import { ArmazemDeCache } from "./armazenar";
import { ErroDeFrameAusente, extrairIndiceDoFrame } from "./frames";

/** Opcoes do render com cache — as do executor do pipeline + a chave. */
export interface OpcoesDoRenderComCache {
  /** Entry point do bundle (o mesmo do pipeline). */
  readonly entrada: string;
  /** publicDir do bundle (assets + fontes). */
  readonly publicDir?: string;
  /** Composicao a renderizar. */
  readonly composicaoId: string;
  /** Porta TCP do card (S-9: F5-09 = 4509). */
  readonly porta: number;
  /** Total de frames da composicao. */
  readonly totalFrames: number;
  /** Workers do orcamento (nunca acima do teto — quem calcula e o chamador). */
  readonly workers: number;
  /** A chave C7 do conteudo (computada pelo chamador). */
  readonly chaveC7: string;
  /** Raiz do cache em disco (default: /tmp/ai-video-maker/render-cache). */
  readonly raizDoCache?: string;
  /** Codec dos bytes (default "png" — a sequencia de frames do pipeline). */
  readonly codec?: string;
  /** Renderer injetavel (default: o real do pipeline). */
  readonly renderer?: RendererDeFrames;
  /** Contexto ja preparado (bundle + composicao) — evita re-bundle. */
  readonly contexto?: ContextoDoRender;
  /** Componentes da chave para o meta.json (diagnostico, sem data). */
  readonly componentes?: ComponentesDaChaveC7;
  /** Diretorio de saida — os frames SERVEM materializados aqui. */
  readonly saida: string;
}

/** Resultado do render com cache — os numeros que as sondas asserem. */
export interface ResultadoDoRenderComCache {
  /** Diretorio com TODOS os frames (servidos do cache + renderizados). */
  readonly dirDeSaida: string;
  /** Chamadas ao renderer — 0 no acerto quente (a sonda AB-685). */
  readonly chamadasDoRenderer: number;
  /** Frames servidos do cache (presenca: 0 no miss forcado). */
  readonly framesDoCache: number;
  /** Frames renderizados de novo. */
  readonly framesRenderizados: number;
  /** `true` quando NENHUM frame precisou de render (acerto quente). */
  readonly acertouTudo: boolean;
}

/**
 * Os frames de um diretorio de saida do renderer: indice ABSOLUTO -> nome
 * real do arquivo (AB-691). O Remotion ZERO-PADDA o nome pelo ultimo
 * frame (`frame-000.png` num lote de 727, `frame-0.png` num de 4) — a
 * largura do padding e uma decisao de execucao que muda entre lotes.
 * Quem le NUNCA constroi o nome pelo indice; resolve o indice no nome e
 * le pelo nome real. Um nome fora do pattern PROPAGA ErroDeNomeDeFrame.
 */
function framesDeUmDiretorio(dir: string): Map<number, string> {
  const porIndice = new Map<number, string>();
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith(".png")) {
      continue;
    }
    porIndice.set(extrairIndiceDoFrame(nome), nome);
  }
  return porIndice;
}

/** Materializa um frame na saida — escrita atomica (tmp + rename). */
function materializarNaSaida(dirDeSaida: string, indice: number, bytes: Buffer): void {
  const destino = join(dirDeSaida, `frame-${String(indice)}.png`);
  const temporario = `${destino}.tmp-${process.pid}`;
  writeFileSync(temporario, bytes);
  renameSync(temporario, destino);
}

/**
 * Renderiza com cache: serve os frames presentes na chave C7 e renderiza
 * apenas os faltantes, por faixas contiguas de indices absolutos.
 *
 * Falhas do renderer PROPAGAM (ErroDeRender) — um worker morto nunca
 * deixa o cache "acertar" por cima. Render parcial (frames a menos do
 * que a faixa pediu) e ErroDeFrameAusente — nunca aceito.
 */
export async function renderizarComCache(
  opcoes: OpcoesDoRenderComCache,
): Promise<ResultadoDoRenderComCache> {
  const {
    saida,
    totalFrames,
    chaveC7,
    codec = "png",
    workers,
    porta,
    entrada,
    publicDir,
    composicaoId,
    componentes,
  } = opcoes;

  const renderer: RendererDeFrames =
    opcoes.renderer ?? (await import("../pipeline/executar")).rendererReal;

  const dirDeSaida = join(saida, "frames");
  mkdirSync(dirDeSaida, { recursive: true });

  const armazem = new ArmazemDeCache({
    raiz: opcoes.raizDoCache,
    chave: chaveC7,
    codec,
  });
  const presentes = armazem.indicesPresentes();

  // Os indices FALTANTES, em ordem — a faixa de trabalho do render.
  const faltantes: number[] = [];
  for (let f = 0; f < totalFrames; f++) {
    if (!presentes.has(f)) {
      faltantes.push(f);
    }
  }

  if (faltantes.length === 0) {
    // Acerto QUENTE: nenhum frame precisa de render. Servir = copiar os
    // bytes cacheados para a saida (o chamador compara contra o render
    // sem cache — o cache acertando pelo motivo errado tem de ser
    // detectavel). O renderer NAO e chamado: 0 chamadas, e a sonda
    // AB-685 assere exatamente isso (cache quente nao prova render).
    for (let f = 0; f < totalFrames; f++) {
      const bytes = armazem.ler(f);
      if (bytes === null) {
        // Entre a leitura de `presentes` e agora o frame sumiu — a
        // escrita atomica nao pode ter deixado parcial; algo apagou o
        // cache no meio. Falha alto, nunca servir no chute.
        throw new ErroDeFrameAusente(f);
      }
      materializarNaSaida(dirDeSaida, f, bytes);
    }
    return Object.freeze({
      dirDeSaida,
      chamadasDoRenderer: 0,
      framesDoCache: totalFrames,
      framesRenderizados: 0,
      acertouTudo: true,
    });
  }

  // Miss (total ou parcial): renderiza as faixas faltantes contiguas.
  const faixas: Array<[number, number]> = [];
  let inicio = faltantes[0]!;
  let anterior = inicio;
  for (let i = 1; i < faltantes.length; i++) {
    const f = faltantes[i]!;
    if (f === anterior + 1) {
      anterior = f;
      continue;
    }
    faixas.push([inicio, anterior]);
    inicio = f;
    anterior = f;
  }
  faixas.push([inicio, anterior]);

  // Contexto: o mesmo do executor do pipeline — quem ja preparou passa,
  // quem nao passou prepara aqui (bundle + selecao da composicao).
  const ctx =
    opcoes.contexto ??
    (await prepararRender({ entrada, publicDir, composicaoId }));

  let chamadasDoRenderer = 0;
  let framesRenderizados = 0;
  const dirsTemporarios: string[] = [];

  try {
    for (const [inicioFaixa, fimFaixa] of faixas) {
      const dirDaFaixa = join(saida, `novos-${String(inicioFaixa)}-${String(fimFaixa)}`);
      mkdirSync(dirDaFaixa, { recursive: true });
      dirsTemporarios.push(dirDaFaixa);

      chamadasDoRenderer++;
      let contagem: number;
      try {
        const resultado = await renderer({
          composition: ctx.composicao,
          serveUrl: ctx.serveUrl,
          outputDir: dirDaFaixa,
          frameRange: [inicioFaixa, fimFaixa], // frameRange e INCLUSIVO
          concurrency: workers,
        });
        contagem = resultado.frameCount;
      } catch (erro) {
        throw new ErroDeRender(
          `o render da faixa [${String(inicioFaixa)}, ${String(fimFaixa)}] com ` +
            `cache (chave ${chaveC7.slice(0, 12)}...) falhou na porta ${String(porta)} — ` +
            "worker morto derruba o pipeline, o cache quente NAO mascara " +
            `(AB-685): ${erro instanceof Error ? erro.message : String(erro)}`,
          erro,
        );
      }

      if (contagem !== fimFaixa - inicioFaixa + 1) {
        throw new ErroDeRender(
          `a faixa [${String(inicioFaixa)}, ${String(fimFaixa)}] entregou ` +
            `${String(contagem)} frames — esperado ${String(fimFaixa - inicioFaixa + 1)} ` +
            "(render parcial nunca e aceito)",
        );
      }

      // Cada frame renderizado: validar presenca, armazenar na chave e
      // materializar na saida. Frame faltante = ErroDeFrameAusente. O
      // arquivo e lido pelo NOME REAL (o Remotion zero-padda o nome pelo
      // ultimo frame da faixa) — o indice e resolvido no nome, nunca
      // o nome construido pelo indice (AB-691).
      const renderizados = framesDeUmDiretorio(dirDaFaixa);
      for (let f = inicioFaixa; f <= fimFaixa; f++) {
        const nome = renderizados.get(f);
        if (nome === undefined) {
          throw new ErroDeFrameAusente(f);
        }
        const bytes = readFileSync(join(dirDaFaixa, nome));
        armazem.gravar(f, bytes);
        materializarNaSaida(dirDeSaida, f, bytes);
        framesRenderizados++;
      }
    }
  } finally {
    for (const dir of dirsTemporarios) {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  // Meta do cache: diagnostico (componentes da chave) SEM data. A
  // presenca de componentes e do gate, que os passa; sem eles o meta
  // nao e gravado (o cache continua funcionando).
  if (componentes !== undefined) {
    armazem.gravarMeta({
      formato: "render-cache-meta-v1",
      chave: chaveC7,
      codec,
      componentes,
      totalFrames,
    });
  }

  return Object.freeze({
    dirDeSaida,
    chamadasDoRenderer,
    framesDoCache: totalFrames - framesRenderizados,
    framesRenderizados,
    acertouTudo: chamadasDoRenderer === 0,
  });
}
