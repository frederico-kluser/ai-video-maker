// =============================================================================
// AJUSTE DE FONTE — Editor de Video IA
// =============================================================================
// Reduz o tamanho da fonte ate que o texto caiba na largura disponivel.
// Piso de legibilidade: 16px (fonte: Apple HIG minimo de 11pt, adaptado
// para video — motion-design-system SKILL.md §Escala tipografica).
//
// O ajuste e binario: ou o texto cabe em algum tamanho >= piso,
// ou nao cabe e o chamador decide se lanca overflow ou aceita.
// =============================================================================

import { type TextMeasurement, measureText } from "./medicao";

// =============================================================================
// CONSTANTES
// =============================================================================

/** Tamanho minimo de fonte legivel (≈ 11pt em tela — Apple HIG) */
export const MIN_FONT_SIZE_PX = 16;

/** Passo de reducao em px a cada tentativa */
const FONT_REDUCTION_STEP = 1;

/** Numero maximo de tentativas de reducao */
const MAX_REDUCTION_ATTEMPTS = 100;

// =============================================================================
// TIPOS
// =============================================================================

/** Resultado da tentativa de ajuste de fonte */
export interface FontFitResult {
  /** Tamanho da fonte que cabe (ou o piso, se nao coube) */
  fontSize: number;
  /** Se o texto coube no tamanho retornado */
  fits: boolean;
  /** Medicao do texto no tamanho retornado */
  measurement: TextMeasurement;
  /** Tamanho original solicitado */
  requestedFontSize: number;
  /** Numero de passos de reducao aplicados */
  reductionSteps: number;
}

// =============================================================================
// API PUBLICA
// =============================================================================

/**
 * Ajusta o tamanho da fonte para que o texto caiba na largura maxima.
 *
 * Reduz progressivamente o tamanho da fonte ate que o texto caiba
 * ou atinja o piso de legibilidade (16px).
 *
 * @param text - Texto a ajustar
 * @param maxWidth - Largura maxima disponivel em px
 * @param fontSize - Tamanho de fonte desejado em px
 * @param lineHeight - Altura de linha como multiplo do fontSize
 * @param minFontSize - Piso de legibilidade (default: 16px)
 * @returns Resultado do ajuste com a fonte final e se coube
 */
export function fitTextToWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  lineHeight: number = 1.4,
  minFontSize: number = MIN_FONT_SIZE_PX,
): FontFitResult {
  if (!text || text.length === 0) {
    return {
      fontSize,
      fits: true,
      measurement: measureText(text, fontSize, lineHeight),
      requestedFontSize: fontSize,
      reductionSteps: 0,
    };
  }

  let currentSize = fontSize;
  let steps = 0;

  // Tenta o tamanho original primeiro
  let measurement = measureText(text, currentSize, lineHeight);

  if (measurement.width <= maxWidth) {
    return {
      fontSize: currentSize,
      fits: true,
      measurement,
      requestedFontSize: fontSize,
      reductionSteps: 0,
    };
  }

  // Reduz progressivamente
  while (currentSize > minFontSize && steps < MAX_REDUCTION_ATTEMPTS) {
    currentSize = Math.max(minFontSize, currentSize - FONT_REDUCTION_STEP);
    steps++;
    measurement = measureText(text, currentSize, lineHeight);

    if (measurement.width <= maxWidth) {
      return {
        fontSize: currentSize,
        fits: true,
        measurement,
        requestedFontSize: fontSize,
        reductionSteps: steps,
      };
    }

    // Se chegou ao piso, para
    if (currentSize <= minFontSize) {
      break;
    }
  }

  // Nao coube nem no piso
  measurement = measureText(text, minFontSize, lineHeight);
  return {
    fontSize: minFontSize,
    fits: measurement.width <= maxWidth,
    measurement,
    requestedFontSize: fontSize,
    reductionSteps: steps,
  };
}

/**
 * Ajusta o tamanho da fonte para que o texto caiba na largura maxima
 * E na altura maxima (numero de linhas * altura de linha).
 *
 * @param text - Texto a ajustar
 * @param maxWidth - Largura maxima disponivel em px
 * @param maxHeight - Altura maxima disponivel em px
 * @param fontSize - Tamanho de fonte desejado em px
 * @param lineHeight - Altura de linha como multiplo do fontSize
 * @param minFontSize - Piso de legibilidade (default: 16px)
 * @returns Resultado do ajuste
 */
export function fitTextToBounds(
  text: string,
  maxWidth: number,
  maxHeight: number,
  fontSize: number,
  lineHeight: number = 1.4,
  minFontSize: number = MIN_FONT_SIZE_PX,
): FontFitResult {
  if (!text || text.length === 0) {
    return {
      fontSize,
      fits: true,
      measurement: measureText(text, fontSize, lineHeight),
      requestedFontSize: fontSize,
      reductionSteps: 0,
    };
  }

  let currentSize = fontSize;
  let steps = 0;

  let measurement = measureText(text, currentSize, lineHeight);

  if (measurement.width <= maxWidth && measurement.height <= maxHeight) {
    return {
      fontSize: currentSize,
      fits: true,
      measurement,
      requestedFontSize: fontSize,
      reductionSteps: 0,
    };
  }

  // Reduz progressivamente
  while (currentSize > minFontSize && steps < MAX_REDUCTION_ATTEMPTS) {
    currentSize = Math.max(minFontSize, currentSize - FONT_REDUCTION_STEP);
    steps++;
    measurement = measureText(text, currentSize, lineHeight);

    if (measurement.width <= maxWidth && measurement.height <= maxHeight) {
      return {
        fontSize: currentSize,
        fits: true,
        measurement,
        requestedFontSize: fontSize,
        reductionSteps: steps,
      };
    }

    if (currentSize <= minFontSize) {
      break;
    }
  }

  measurement = measureText(text, minFontSize, lineHeight);
  return {
    fontSize: minFontSize,
    fits: measurement.width <= maxWidth && measurement.height <= maxHeight,
    measurement,
    requestedFontSize: fontSize,
    reductionSteps: steps,
  };
}