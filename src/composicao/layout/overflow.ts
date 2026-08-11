// =============================================================================
// OVERFLOW COMO ERRO DE BUILD — Editor de Video IA
// =============================================================================
// Overflow de texto nao e silencioso: se o texto nao couber na area
// designada mesmo apos ajuste de fonte, o build FALHA com mensagem
// nomeando o no responsavel.
//
// Isto e uma decisao de projeto: overflow silencioso produz video
// ilegivel e nenhum sinal de erro. O build vermelho obriga a correcao
// antes do render.
//
// Skill: motion-design-system (SKILL.md) §Escala tipografica
// =============================================================================

import { measureText, type TextMeasurement } from "./medicao";
import { fitTextToWidth, type FontFitResult } from "./ajuste";

// =============================================================================
// TIPOS
// =============================================================================

/** Contexto do no que esta sendo verificado */
export interface NodeContext {
  /** Identificador unico do no (ex: "cabecalho-01") */
  nodeId: string;
  /** Tipo do no (ex: "cabecalho", "texto", "legenda") */
  nodeType: string;
  /** Largura maxima disponivel para o texto nesse no (px) */
  maxWidth: number;
  /** Altura maxima disponivel para o texto nesse no (px) */
  maxHeight: number;
  /** Tamanho de fonte configurado para o no (px) */
  fontSize: number;
}

/** Resultado da verificacao de overflow */
export interface OverflowCheckResult {
  /** Se o texto coube */
  fits: boolean;
  /** Medicao do texto */
  measurement: TextMeasurement;
  /** Resultado do ajuste de fonte (se aplicado) */
  fitResult?: FontFitResult;
  /** Margem de seguranca restante em px (largura) */
  widthRemaining: number;
  /** Margem de seguranca restante em px (altura) */
  heightRemaining: number;
}

// =============================================================================
// CLASSE DE ERRO
// =============================================================================

/**
 * Erro lancado quando texto transborda a area designada.
 *
 * Este erro interrompe o build — nao e um aviso, e uma falha.
 * A mensagem nomeia o no, o texto (truncado), e as dimensoes excedidas.
 */
export class TextOverflowError extends Error {
  /** Identificador do no que causou overflow */
  readonly nodeId: string;
  /** Tipo do no */
  readonly nodeType: string;
  /** Medicao do texto no momento do overflow */
  readonly measurement: TextMeasurement;
  /** Largura disponivel */
  readonly maxWidth: number;
  /** Altura disponivel */
  readonly maxHeight: number;

  constructor(
    nodeId: string,
    nodeType: string,
    text: string,
    measurement: TextMeasurement,
    maxWidth: number,
    maxHeight: number,
  ) {
    const preview = text.length > 80 ? text.slice(0, 77) + "..." : text;
    const overflowDims: string[] = [];

    if (measurement.width > maxWidth) {
      overflowDims.push(
        `largura: ${measurement.width}px > ${maxWidth}px (${measurement.width - maxWidth}px excedido)`,
      );
    }
    if (measurement.height > maxHeight) {
      overflowDims.push(
        `altura: ${measurement.height}px > ${maxHeight}px (${measurement.height - maxHeight}px excedido)`,
      );
    }

    const message = [
      `OVERFLOW: texto do no "${nodeId}" (${nodeType}) transborda a area designada.`,
      `  Texto: "${preview}"`,
      `  Fonte: ${measurement.fontSize}px`,
      `  ${overflowDims.join("; ")}`,
      `  Acao: reduza o texto, aumente a area ou divida em mais nos.`,
    ].join("\n");

    super(message);
    this.name = "TextOverflowError";
    this.nodeId = nodeId;
    this.nodeType = nodeType;
    this.measurement = measurement;
    this.maxWidth = maxWidth;
    this.maxHeight = maxHeight;
  }
}

// =============================================================================
// API PUBLICA
// =============================================================================

/**
 * Verifica se o texto cabe na area designada.
 *
 * NAO lanca erro — retorna o resultado para que o chamador decida.
 * Use `assertNoOverflow` para lancar erro em caso de overflow.
 *
 * @param text - Texto a verificar
 * @param ctx - Contexto do no (id, tipo, dimensoes)
 * @param lineHeight - Altura de linha (multiplo do fontSize)
 * @returns Resultado da verificacao com medicoes e margens
 */
export function checkOverflow(
  text: string,
  ctx: NodeContext,
  lineHeight: number = 1.4,
): OverflowCheckResult {
  const measurement = measureText(text, ctx.fontSize, lineHeight);

  const widthFits = measurement.width <= ctx.maxWidth;
  const heightFits = measurement.height <= ctx.maxHeight;

  return {
    fits: widthFits && heightFits,
    measurement,
    widthRemaining: ctx.maxWidth - measurement.width,
    heightRemaining: ctx.maxHeight - measurement.height,
  };
}

/**
 * Verifica overflow e TENTA ajustar a fonte para caber.
 *
 * Se o texto nao couber no tamanho original, reduz a fonte ate caber
 * ou ate o piso de legibilidade (16px). Se nem no piso couber,
 * retorna `fits: false`.
 *
 * @param text - Texto a verificar
 * @param ctx - Contexto do no
 * @param lineHeight - Altura de linha
 * @param minFontSize - Piso de legibilidade (default: 16px)
 * @returns Resultado com ajuste de fonte aplicado
 */
export function checkOverflowWithFit(
  text: string,
  ctx: NodeContext,
  lineHeight: number = 1.4,
  minFontSize?: number,
): OverflowCheckResult {
  // Primeiro tenta no tamanho original
  const measurement = measureText(text, ctx.fontSize, lineHeight);

  if (measurement.width <= ctx.maxWidth && measurement.height <= ctx.maxHeight) {
    return {
      fits: true,
      measurement,
      widthRemaining: ctx.maxWidth - measurement.width,
      heightRemaining: ctx.maxHeight - measurement.height,
    };
  }

  // Tenta ajustar a fonte
  const fitResult = fitTextToWidth(
    text,
    ctx.maxWidth,
    ctx.fontSize,
    lineHeight,
    minFontSize,
  );

  return {
    fits: fitResult.fits,
    measurement: fitResult.measurement,
    fitResult,
    widthRemaining: ctx.maxWidth - fitResult.measurement.width,
    heightRemaining: ctx.maxHeight - fitResult.measurement.height,
  };
}

/**
 * Verifica overflow e LANCA ERRO se o texto nao couber.
 *
 * Esta e a funcao principal de gate: chame-a no build para garantir
 * que nenhum texto transborda silenciosamente.
 *
 * @param text - Texto a verificar
 * @param ctx - Contexto do no
 * @param lineHeight - Altura de linha
 * @throws {TextOverflowError} Se o texto transbordar a area
 */
export function assertNoOverflow(
  text: string,
  ctx: NodeContext,
  lineHeight: number = 1.4,
): void {
  const result = checkOverflow(text, ctx, lineHeight);

  if (!result.fits) {
    throw new TextOverflowError(
      ctx.nodeId,
      ctx.nodeType,
      text,
      result.measurement,
      ctx.maxWidth,
      ctx.maxHeight,
    );
  }
}

/**
 * Verifica overflow com ajuste de fonte e LANCA ERRO se nem ajustando couber.
 *
 * Tenta reduzir a fonte ate o piso de legibilidade. Se ainda assim
 * o texto nao couber, lanca TextOverflowError.
 *
 * @param text - Texto a verificar
 * @param ctx - Contexto do no
 * @param lineHeight - Altura de linha
 * @param minFontSize - Piso de legibilidade (default: 16px)
 * @returns O resultado com o ajuste aplicado (fonte final)
 * @throws {TextOverflowError} Se o texto transbordar mesmo no piso
 */
export function assertNoOverflowWithFit(
  text: string,
  ctx: NodeContext,
  lineHeight: number = 1.4,
  minFontSize?: number,
): OverflowCheckResult {
  const result = checkOverflowWithFit(text, ctx, lineHeight, minFontSize);

  if (!result.fits) {
    throw new TextOverflowError(
      ctx.nodeId,
      ctx.nodeType,
      text,
      result.measurement,
      ctx.maxWidth,
      ctx.maxHeight,
    );
  }

  return result;
}

/**
 * Verifica o layout completo de um no: largura, altura e safe area.
 *
 * @param text - Texto a verificar
 * @param ctx - Contexto do no
 * @param safeRect - Retangulo da safe area (x, y, width, height)
 * @param lineHeight - Altura de linha
 * @returns true se tudo couber
 * @throws {TextOverflowError} Se qualquer dimensao for violada
 */
export function assertLayoutFits(
  text: string,
  ctx: NodeContext,
  safeRect: { x: number; y: number; width: number; height: number },
  lineHeight: number = 1.4,
): void {
  // Verifica se o no esta dentro da safe area
  if (ctx.maxWidth > safeRect.width) {
    throw new TextOverflowError(
      ctx.nodeId,
      ctx.nodeType,
      text,
      measureText(text, ctx.fontSize, lineHeight),
      safeRect.width,
      safeRect.height,
    );
  }

  // Verifica overflow do texto
  assertNoOverflow(text, ctx, lineHeight);
}