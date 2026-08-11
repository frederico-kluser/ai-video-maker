// =============================================================================
// Motor de layout — barrel export
// =============================================================================
// Skill: motion-design-system (SKILL.md)
// =============================================================================

export {
  measureTextWidth,
  measureTextHeight,
  measureText,
  worstCaseWidth,
  type TextMeasurement,
} from "./medicao";

export {
  fitTextToWidth,
  fitTextToBounds,
  MIN_FONT_SIZE_PX,
  type FontFitResult,
} from "./ajuste";

export {
  checkOverflow,
  checkOverflowWithFit,
  assertNoOverflow,
  assertNoOverflowWithFit,
  assertLayoutFits,
  TextOverflowError,
  type NodeContext,
  type OverflowCheckResult,
} from "./overflow";