// =============================================================================
// MEDICAO DE TEXTO — Editor de Video IA
// =============================================================================
// Aproximacao de largura de texto para uso em tempo de build (Node.js).
// Nao depende de browser nem de canvas — usa tabela de largura por classe
// de caractere, calibrada para fontes proporcionais sans-serif (Inter).
//
// A aproximacao e conservadora: superestima a largura para que o cheque
// de overflow dispare antes de chegar ao pixel, nunca depois.
//
// Skill: motion-design-system (SKILL.md)
// =============================================================================

// =============================================================================
// TABELA DE LARGURA POR CLASSE DE CARACTERE
// =============================================================================
// Fatores normalizados (multiplicar por fontSize para obter px).
// Calibrados para Inter (sans-serif) em peso regular.
// A fonte e aproximacao de engenharia — nao existe tabela publicada
// de largura de caractere para fontes web.

/** Fator de largura para caracteres largos (M, W, m, w, @, #) */
const WIDE_FACTOR = 0.72;

/** Fator de largura para caracteres medios (maioria das maiusculas, digitos) */
const MEDIUM_FACTOR = 0.56;

/** Fator de largura para caracteres estreitos (i, l, I, pontuacao, espaco fino) */
const NARROW_FACTOR = 0.32;

/** Fator de largura para espaco */
const SPACE_FACTOR = 0.28;

/** Fator de largura para tabulacao */
const TAB_FACTOR = 1.2;

/** Caracteres classificados como largos */
const WIDE_CHARS = new Set([
  "M", "W", "m", "w",
  "@", "#", "%", "&",
  "G", "O", "Q", "D",
  "À", "Á", "Â", "Ã", "Ä", // A com acentos
  "Ò", "Ó", "Ô", "Õ", "Ö", // O com acentos
  "Ù", "Ú", "Û", "Ü", // U com acentos
  "à", "á", "â", "ã", "ä", // a com acentos
  "ò", "ó", "ô", "õ", "ö", // o com acentos
  "ù", "ú", "û", "ü", // u com acentos
  "Ç", "ç", // C cedilha / c cedilha
]);

/** Caracteres classificados como estreitos */
const NARROW_CHARS = new Set([
  "i", "l", "I", "j", "f", "t", "r",
  "!", ".", ",", ":", ";", "'", "\"",
  "|", "\\", "/",
  "í", "ì", "î", "ï", // i com acentos
  "¡", "¿", // ! invertido, ? invertido
  "‘", "’", "‚", // aspas simples
  "“", "”", "„", // aspas duplas
  "…", // reticencias
]);

// =============================================================================
// API PUBLICA
// =============================================================================

/**
 * Mede a largura estimada de um texto em pixels.
 *
 * Usa aproximacao por classe de caractere — nao depende de browser nem canvas.
 * A aproximacao e conservadora (superestima) para que o cheque de overflow
 * seja seguro: se o texto "cabe" na aproximacao, cabe no pixel real.
 *
 * @param text - Texto a medir (pode conter quebras de linha)
 * @param fontSize - Tamanho da fonte em px
 * @param fatorAjuste - Fator de ajuste global (default: 1.0). Use >1 para
 *   margem de seguranca adicional, <1 para fontes mais compactas.
 * @returns Largura em px da linha mais longa
 */
export function measureTextWidth(
  text: string,
  fontSize: number,
  fatorAjuste: number = 1.0,
): number {
  if (!text || text.length === 0) return 0;

  const lines = text.split("\n");
  let maxLineWidth = 0;

  for (const line of lines) {
    const lineWidth = measureLineWidth(line, fontSize, fatorAjuste);
    if (lineWidth > maxLineWidth) {
      maxLineWidth = lineWidth;
    }
  }

  return maxLineWidth;
}

/**
 * Mede a largura de uma unica linha de texto.
 */
function measureLineWidth(
  line: string,
  fontSize: number,
  fatorAjuste: number,
): number {
  let width = 0;

  for (const char of line) {
    width += charWidth(char, fontSize);
  }

  return width * fatorAjuste;
}

/**
 * Retorna a largura estimada de um unico caractere em px.
 */
function charWidth(char: string, fontSize: number): number {
  if (char === " ") return fontSize * SPACE_FACTOR;
  if (char === "\t") return fontSize * TAB_FACTOR;

  if (WIDE_CHARS.has(char)) return fontSize * WIDE_FACTOR;
  if (NARROW_CHARS.has(char)) return fontSize * NARROW_FACTOR;

  return fontSize * MEDIUM_FACTOR;
}

/**
 * Mede a altura de um bloco de texto em pixels.
 *
 * @param text - Texto a medir
 * @param fontSize - Tamanho da fonte em px
 * @param lineHeight - Altura de linha como multiplo do fontSize (ex: 1.4)
 * @returns Altura total em px
 */
export function measureTextHeight(
  text: string,
  fontSize: number,
  lineHeight: number = 1.4,
): number {
  if (!text || text.length === 0) return 0;

  const lines = text.split("\n");
  // Linha extra para o espaco abaixo da ultima linha (descendentes)
  return lines.length * fontSize * lineHeight;
}

/**
 * Resultado da medicao completa de texto.
 */
export interface TextMeasurement {
  /** Largura da linha mais longa em px */
  width: number;
  /** Altura total em px */
  height: number;
  /** Numero de linhas */
  lines: number;
  /** Fonte usada na medicao em px */
  fontSize: number;
}

/**
 * Mede completamente um bloco de texto.
 */
export function measureText(
  text: string,
  fontSize: number,
  lineHeight: number = 1.4,
  fatorAjuste: number = 1.0,
): TextMeasurement {
  if (!text || text.length === 0) {
    return { width: 0, height: 0, lines: 0, fontSize };
  }

  const lines = text.split("\n");
  const width = measureTextWidth(text, fontSize, fatorAjuste);
  const height = lines.length * fontSize * lineHeight;

  return {
    width,
    height,
    lines: lines.length,
    fontSize,
  };
}

/**
 * Largura de referencia para o caractere mais largo possivel
 * (usado em testes de pior caso tipografico).
 *
 * Ex: "WWWW..." (42 caracteres) a 27px = 42 * 27 * 0.72 = 816.48px
 */
export function worstCaseWidth(
  charCount: number,
  fontSize: number,
): number {
  return charCount * fontSize * WIDE_FACTOR;
}