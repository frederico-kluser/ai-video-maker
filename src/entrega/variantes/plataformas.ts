// =============================================================================
// PLATAFORMAS — o contrato de safe area por plataforma de destino
// =============================================================================
// Card: F5-04 (W7) — Variantes de proporcao.
//
// A fonte de verdade das safe areas sao OS TOKENS (S-5, src/design/tokens.ts):
//
//   16:9  -> tokens.safeArea16x9   — EBU R 95 (action safe 3.5%)
//   9:16  -> tokens.safeArea9x16   — PROVISIONAL (AB-071; autoridade pela
//                                    emenda AB-584 do contrato-w7 §6)
//
// O que a emenda do contrato-w7 §6 (F5-04) manda: a pesquisa de safe areas de
// 2026 ALIMENTA, nao substitui, a decisao de tokens. O token continua a fonte
// de verdade do gate; a pesquisa (2026-08-13, ver docs/adr/0037-*.md) vira
// evidencia no ledger para revisar o token — nunca decisao no gate.
//
// Este modulo e o UNICO ponto que conhece o mapa plataforma -> token. Quem
// consome (o oraculo de variantes) importa daqui e nunca redeclara margem.
// Nenhum numero e digitado aqui: tudo deriva dos PERCENTUAIS dos tokens,
// porque o contrato precisa valer em qualquer resolucao (a mesma disciplina
// de margemSegura/retanguloSeguro de F1-11, mas agora por plataforma).
//
// PURO: nada de disco, relogio, rede ou Math.random — mesma disciplina de
// comp-pureza da composicao.
// =============================================================================

import { safeArea16x9, safeArea9x16 } from "../../design/tokens";
import type { Retangulo } from "../../composicao/camadas/geometria";

// ---------------------------------------------------------------------------
// O contrato de plataforma
// ---------------------------------------------------------------------------

/** Uma plataforma de destino com safe area conhecida pelos tokens. */
export interface Plataforma {
  /** Id estavel, citado em mensagens de erro e no ledger. */
  readonly id: string;
  /** Nome legivel para relatorios. */
  readonly nome: string;
  /** Aspecto (largura/altura) do canvas que a plataforma espera. */
  readonly aspecto: number;
  /** Safe area provisoria? (9:16 e provisorio por AB-071/AB-584.) */
  readonly provisoria: boolean;
  /** Qual token e a fonte de verdade. */
  readonly fonte: string;
}

/** 16:9 — YouTube/broadcast. EBU R 95, action safe 3.5%. */
export const PLATAFORMA_16X9: Plataforma = {
  id: "16:9",
  nome: "16:9 (YouTube/broadcast)",
  aspecto: 16 / 9,
  provisoria: false,
  fonte: "src/design/tokens.ts safeArea16x9.actionSafePct",
};

/**
 * 9:16 — TikTok/Reels/Shorts. PROVISIONAL (AB-071), autoridade pela emenda
 * AB-584 do contrato-w7 §6. A pesquisa de 2026 (ADR-0037) documenta o que as
 * plataformas publicam hoje; o token NAO muda nesta onda.
 */
export const PLATAFORMA_9X16: Plataforma = {
  id: "9:16",
  nome: "9:16 (TikTok/Reels/Shorts)",
  aspecto: 9 / 16,
  provisoria: true,
  fonte: "src/design/tokens.ts safeArea9x16 (topPct/bottomPct/rightPct)",
};

/** As plataformas conhecidas do contrato. */
export const PLATAFORMAS: readonly Plataforma[] = [
  PLATAFORMA_16X9,
  PLATAFORMA_9X16,
] as const;

// ---------------------------------------------------------------------------
// Resolucao por aspecto
// ---------------------------------------------------------------------------

/** Tolerancia de aspecto para nao confundir 16:9 com 9:16 por float. */
export const EPS_ASPECTO = 1e-6;

/**
 * A plataforma do contrato cujo aspecto casa com o canvas. `null` quando o
 * canvas nao e de nenhuma plataforma conhecida — e o chamador decide (o
 * oraculo recusa canvas sem plataforma: variante para lugar nenhum e erro).
 */
export function plataformaDoCanvas(canvas: {
  width: number;
  height: number;
}): Plataforma | null {
  const aspecto = canvas.width / canvas.height;
  for (const plataforma of PLATAFORMAS) {
    if (Math.abs(aspecto - plataforma.aspecto) < EPS_ASPECTO) {
      return plataforma;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// O retangulo seguro da plataforma, para QUALQUER canvas do aspecto dela
// ---------------------------------------------------------------------------

/**
 * O retangulo de safe area de uma plataforma sobre o canvas dado, derivado
 * dos PERCENTUAIS do token (nunca dos absolutos, que valem so para a
 * resolucao de referencia do token — mesma disciplina de F1-11).
 *
 * 16:9 — margem simetrica de actionSafePct (EBU R 95).
 * 9:16 — margens por lado do provisional (topPct, bottomPct, rightPct;
 *        sem margem esquerda: o retangulo util comeca em x = 0).
 *
 * Retangulo em coordenadas de borda: [margem, D - margem], semi-aberto.
 */
export function safeRectDaPlataforma(
  canvas: { width: number; height: number },
  plataforma: Plataforma,
): Retangulo {
  if (plataforma.id === PLATAFORMA_16X9.id) {
    const margemH = Math.round(canvas.width * safeArea16x9.actionSafePct);
    const margemV = Math.round(canvas.height * safeArea16x9.actionSafePct);
    return {
      x: margemH,
      y: margemV,
      largura: canvas.width - 2 * margemH,
      altura: canvas.height - 2 * margemV,
    };
  }
  if (plataforma.id === PLATAFORMA_9X16.id) {
    const topo = Math.round(canvas.height * safeArea9x16.topPct);
    const base = Math.round(canvas.height * safeArea9x16.bottomPct);
    const direita = Math.round(canvas.width * safeArea9x16.rightPct);
    return {
      x: 0,
      y: topo,
      largura: canvas.width - direita,
      altura: canvas.height - topo - base,
    };
  }
  // Plataforma desconhecida: nunca acontece com PLATAFORMAS — mas o erro
  // existe para que adicionar uma terceira plataforma a este modulo SEM
  // implementar o retangulo dela seja um erro, nao um retangulo inventado.
  throw new Error(
    `plataformas: plataforma "${plataforma.id}" sem retangulo seguro implementado`,
  );
}

/**
 * O retangulo de CONTEUDO de um canvas — o retangulo que a composicao
 * declara proteger. E o retangulo seguro da plataforma do proprio canvas:
 * o conteudo de uma composicao 16:9 vive no action safe EBU; o de uma 9:16,
 * no retangulo util provisional.
 */
export function retanguloDeConteudo(canvas: {
  width: number;
  height: number;
}): Retangulo | null {
  const plataforma = plataformaDoCanvas(canvas);
  if (plataforma === null) {
    return null;
  }
  return safeRectDaPlataforma(canvas, plataforma);
}
