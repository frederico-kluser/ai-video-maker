/**
 * src/sincronia/legendas/formato.ts
 *
 * O DOCUMENTO CANONICO DE LEGENDAS — a superficie que F5-03 (W8) consome
 * no pos. Card F3-02 (W6).
 *
 * ─── O que este documento e ─────────────────────────────────────────────
 *
 * Legendas derivadas do timing canonico (F3-01): uma lista PLANA e
 * ORDENADA de legendas, com tempo ABSOLUTO em segundos desde o byte zero
 * do video — e exatamente o que um consumidor de pos (sidecar SRT,
 * legenda queimada) precisa, sem recalcular timeline nenhuma.
 *
 * Unidade: SEGUNDOS, nunca frames. O timing descreve tempo de parede do
 * audio; conversao para frame e de quem consome, no ponto de consumo
 * (contrato-w6 §2). O invariante de duracao deste documento mora em
 * SEGUNDOS — `duracao >= max(0,833 s; caracteres/20)` e `duracao <= 7 s`
 * [R14-01·R14-11 (2-0)]. Num manifesto frame-based, reescrever o piso em
 * frames e o erro que este card existe para pegar: 20 frames a 60 fps
 * sao 0,333 s — QUATRO VEZES abaixo do piso, em silencio.
 *
 * ─── Consumo por CONTEUDO ──────────────────────────────────────────────
 *
 * Cada legenda carrega `cena` (a chave do manifesto) e `audio` (o SHA-256
 * do audio de que o timing deriva — o mesmo campo `audio` da entrada
 * canonica de F3-01). O casamento e por conteudo, nunca por posicao: uma
 * legenda declara DE ONDE veio, e o oraculo (validar.ts) confere contra o
 * timing.
 *
 * ─── Determinismo ────────────────────────────────────────────────────────
 *
 * O documento e funcao pura de (manifesto + timing canonico). A
 * serializacao reusa `serializarCanonico()` de `src/resolucao/cassete/`
 * de proposito: duas serializacoes canonicas diferentes no mesmo
 * repositorio produzem dois hashes para o mesmo dado. `tools/legendas/
 * gerar.ts --conferir` pina os bytes num golden commitado.
 */

import { createHash } from "node:crypto";
import { serializarCanonico } from "../../resolucao/cassete/formato.js";
import type { Sha256 } from "../../resolucao/manifesto-resolvido.js";

// ─── Identidade ───────────────────────────────────────────────────────────────

/** Versao do formato. Muda ⇒ mudam os bytes, muda o hash. */
export const FORMATO_LEGENDAS_CANONICAS = "LegendasCanonicas.1" as const;

/**
 * A unidade do documento inteiro: segundos absolutos na timeline.
 *
 * O contrato-w6 §2: unidade SEGUNDOS em todo documento que descreve
 * tempo de parede; conversao para frame e de quem consome.
 */
export const UNIDADE_LEGENDAS = "segundos" as const;

/**
 * MIME do documento canonico de legendas.
 *
 * NAO e o MIME do asset de origem (timing): este documento e derivado,
 * produzido na composicao. Nao e uma URL: nao ha `://` — o guarda
 * `encontrarURLs()` nao o acusa.
 */
export const MIME_LEGENDAS_CANONICAS =
  "application/vnd.editor-video-ia.legendas-canonica+json" as const;

// ─── O documento ───────────────────────────────────────────────────────────────

/** Uma legenda: texto paginado + intervalo ABSOLUTO em segundos. */
export interface LegendaCanonica {
  /**
   * A unidade desta legenda: sempre `"segundos"` — declarada por
   * entrada, nunca inferida de contexto (mesma disciplina do contrato
   * de timing, contrato-w6 §2: um consumidor que leia uma entrada
   * avulsa sabe a unidade sem olhar a raiz).
   */
  readonly unidade: typeof UNIDADE_LEGENDAS;
  /**
   * Id da cena do manifesto de que esta legenda deriva. Nunca por
   * posicao: e a chave do mapa do timing canonico.
   */
  readonly cena: string;
  /**
   * SHA-256 do audio de que o timing deriva — o endereco por CONTEUDO
   * (o campo `audio` da entrada de F3-01). O oraculo confere contra o
   * timing; nunca confia no campo.
   */
  readonly audio: Sha256;
  /**
   * Inicio ABSOLUTO, em segundos, desde o byte zero do video.
   *
   * Nunca antes do inicio da primeira palavra da cena (o oraculo
   * confere): a legenda NAO aparece antes da palavra.
   */
  readonly inicio_s: number;
  /**
   * Fim ABSOLUTO, em segundos. Sempre `> inicio_s`. Pode estender-se
   * alem do fim da ultima palavra (folga de leitura sobre o silencio
   * declarado), mas nunca alem do fim da cena.
   */
  readonly fim_s: number;
  /** Linhas paginadas, na ordem de leitura. `linhas.length <= maxLines`. */
  readonly linhas: readonly string[];
  /** O texto completo: `linhas.join("\n")`. Para exibicao e SRT. */
  readonly texto: string;
  /**
   * Numero de caracteres exibidos (espacos e pontuacao inclusos, quebras
   * de linha excluidas). E o numerador do piso de leitura: uma legenda
   * com N caracteres precisa de pelo menos N/20 segundos na tela.
   */
  readonly caracteres: number;
}

/** O documento canonico de legendas: lista plana, ordenada, em segundos. */
export interface LegendasCanonicas {
  readonly schema_version: typeof FORMATO_LEGENDAS_CANONICAS;
  /** Sempre `"segundos"` — declarada, nunca inferida. */
  readonly unidade: typeof UNIDADE_LEGENDAS;
  /**
   * Legendas em ordem de exibicao (tempo absoluto crescente; dentro de
   * uma cena, sem sobreposicao).
   */
  readonly legendas: readonly LegendaCanonica[];
}

// ─── Serializacao ─────────────────────────────────────────────────────────────

/**
 * Serializa o documento em JSON canonico — os MESMOS bytes que entram no
 * hash, no store e na comparacao do determinismo.
 */
export function serializarLegendas(doc: LegendasCanonicas): Buffer {
  return Buffer.from(serializarCanonico(doc), "utf-8");
}

/** SHA-256 dos bytes canonicos do documento. */
export function hashDasLegendas(doc: LegendasCanonicas): Sha256 {
  return createHash("sha256").update(serializarLegendas(doc)).digest("hex");
}
