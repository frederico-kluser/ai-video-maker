// =============================================================================
// DERIVACAO — a variante de proporcao a partir do MESMO manifesto
// =============================================================================
// Card: F5-04 (W7) — Variantes de proporcao.
//
// Uma variante e o MESMO manifesto em um novo canvas: mesma autoria, mesmas
// cenas, mesmos nos, mesmo fps — SOMENTE `width` e `height` mudam. E por isso
// que o TIMING e herdado por construcao: a variante nunca recalcula, reordena
// ou reancora nada (pergunta adversarial (3) do card — verificar.ts confere
// isso em bytes, nao por promessa).
//
// O que a variante NAO faz (fronteira negativa):
//   - NAO toca o pintor (src/composicao/pintura/** e do PREP — consuma);
//   - NAO toca os nos nem as camadas (W4/W5 — consuma);
//   - NAO decide se o conteudo CABE na safe area da plataforma — isso e o
//     oraculo verificar.ts, e a derivacao pura dele: derivar produz a
//     variante; verificar decide se ela e entregavel.
//
// A derivacao consome o pintor promovido por convencao: a variante e
// renderizada com `pintar(manifestoDaVariante, tempo, viewport)` — o
// contrato publico da pintura exige viewport == manifesto, e a derivacao e
// exatamente o modulo que produz o manifesto que casa com o viewport da
// plataforma (o "recorte por viewport" da emenda AB-493/AB-584).
//
// PURO: funcao pura do (manifesto, alvo) — zero disco, relogio, rede, RNG.
// =============================================================================

import { breakpoints } from "../../design/tokens";
import type { Manifesto } from "../../contratos/manifesto";

// ---------------------------------------------------------------------------
// O alvo
// ---------------------------------------------------------------------------

/**
 * O canvas alvo de uma variante. A autoridade e tokens.breakpoints (S-5):
 * um alvo que nao esteja la e erro nomeando o token — nunca um retangulo
 * digitado a mao aqui.
 */
export interface CanvasAlvo {
  readonly width: number;
  readonly height: number;
}

/** Todos os canvas de breakpoint conhecidos (para validação e relatorios). */
export const CANVASES_ALVO: readonly CanvasAlvo[] = [
  breakpoints.hd,
  breakpoints.vertical,
  breakpoints.square,
  breakpoints.portrait,
] as const;

/**
 * `true` se o alvo e um dos breakpoints declarados nos tokens (S-5).
 * Assercao de PRESENCA: o alvo tem de ESTAR nos breakpoints — nunca uma
 * lista fechada comparada por fora (contrato-w7 §12).
 */
export function ehCanvasDeBreakpoint(alvo: CanvasAlvo): boolean {
  return CANVASES_ALVO.some(
    (b) => b.width === alvo.width && b.height === alvo.height,
  );
}

// ---------------------------------------------------------------------------
// A derivacao
// ---------------------------------------------------------------------------

/** Erro de derivacao: alvo fora dos breakpoints dos tokens. */
export class EAlvoDesconhecido extends Error {
  readonly code = "ALVO_DESCONHECIDO";
  readonly alvo: CanvasAlvo;
  constructor(alvo: CanvasAlvo) {
    super(
      `derivarVariante: alvo ${alvo.width}x${alvo.height} nao e nenhum ` +
        "breakpoint de src/design/tokens.ts (tokens.breakpoints, S-5) — " +
        "a variante so existe para canvas que o token declara",
    );
    this.name = "EAlvoDesconhecido";
    this.alvo = alvo;
  }
}

/**
 * Deriva a variante de proporcao: o MESMO manifesto no canvas alvo.
 *
 * - `schema_version`, `fps`, `cenas` e `nos` sao os MESMOS objetos: a
 *   variante herda o timing, a autoria e o conteudo por identidade — nada e
 *   recalculado, nada e reordenado (pergunta adversarial (3): o oraculo
 *   verificarHeranca confere em bytes).
 * - `width`/`height` viram os do alvo. E o unico delta.
 *
 * Funcao pura: mesmo (manifesto, alvo) produz o MESMO manifesto da variante.
 */
export function derivarVariante(
  manifesto: Manifesto,
  alvo: CanvasAlvo,
): Manifesto {
  if (!ehCanvasDeBreakpoint(alvo)) {
    throw new EAlvoDesconhecido(alvo);
  }
  return {
    ...manifesto,
    width: alvo.width,
    height: alvo.height,
  };
}
