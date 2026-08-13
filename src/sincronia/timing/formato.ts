/**
 * src/sincronia/timing/formato.ts
 *
 * O DOCUMENTO CANONICO DE TIMING — a superficie que F3-02, F3-03 e F3-04
 * consomem na W6. Card F3-01, onda W5, caminho critico.
 *
 * ─── O que este documento e ──────────────────────────────────────────────
 *
 * O timing de locucao de F2-03 (`TimingLocucao`) e por unidade de fala, em
 * MILISSEGUNDO inteiro, e descreve so os trechos que tem voz. O documento
 * canonico e a visao da CENA inteira, em SEGUNDOS, com o silencio
 * DECLARADO: a estrutura e um mapa cena -> entrada (contrato-w5 §2:
 * "chave por cena"), cada entrada declara a propria `unidade`, e um trecho
 * sem locucao aparece como `estado: "silencio"` — nunca pela ausencia de
 * entrada.
 *
 *   TimingLocucao (F2-03, ms) ──converte──▶ TimingCanonico (F3-01, s)
 *
 * Unidade: SEGUNDOS, nunca frames. O timing descreve tempo de parede do
 * audio; conversao para frame e de quem consome, no ponto de consumo
 * (contrato-w5 §2).
 *
 * ─── Consumo por CONTEUDO ────────────────────────────────────────────────
 *
 * Cada entrada de locucao carrega o campo `audio`: o SHA-256 dos bytes
 * canonicos do audio a que o timing se refere. O casamento timing<->audio
 * e por este campo (`casarTimings()` de F2-03), nunca por ordem de
 * aparecimento nem indice de cena assumido — ver `construir.ts`.
 *
 * ─── Determinismo ────────────────────────────────────────────────────────
 *
 * A serializacao reusa `serializarCanonico()` de `src/resolucao/cassete/`
 * de proposito: duas serializacoes canonicas diferentes no mesmo
 * repositorio produzem dois hashes para o mesmo dado. O documento e
 * funcao pura de (manifesto + parcial + bytes do store); `timing-
 * determinismo` prova 2× identico.
 */

import { createHash } from "node:crypto";
import { serializarCanonico } from "../../resolucao/cassete/formato.js";
import type { Sha256 } from "../../resolucao/manifesto-resolvido.js";

// ─── Identidade ───────────────────────────────────────────────────────────────

/** Versao do formato. Muda ⇒ mudam os bytes, muda o hash. */
export const FORMATO_TIMING_CANONICO = "TimingCanonico.1" as const;

/**
 * A unidade do documento inteiro e de cada entrada.
 *
 * O contrato-w5 §2 exige que CADA entrada declare a propria `unidade`
 * explicitamente, nunca inferida de contexto — um consumidor que leia uma
 * entrada avulsa tem de saber em que unidade ela esta sem olhar a raiz.
 */
export const UNIDADE_SEGUNDOS = "segundos" as const;

/**
 * MIME do documento canonico.
 *
 * Nao e o MIME do asset de ORIGEM (`application/vnd.editor-video-ia.
 * timing-locucao+json`, F2-03): este documento e derivado, produzido na
 * composicao. Nao e uma URL: nao ha `://` — o guarda `encontrarURLs()`
 * nao o acusa.
 */
export const MIME_TIMING_CANONICO =
  "application/vnd.editor-video-ia.timing-canonico+json" as const;

// ─── O documento ───────────────────────────────────────────────────────────────

/** Uma palavra falada, com intervalo em SEGUNDOS dentro do audio. */
export interface PalavraCanonica {
  /** Texto da palavra, com a pontuacao anexada. `"pipeline."` */
  readonly texto: string;
  /** Inicio, em segundos, desde o byte zero do audio. */
  readonly inicio_s: number;
  /** Fim, em segundos. Sempre `> inicio_s` (oraculo C5a). */
  readonly fim_s: number;
}

/** Um trecho sem locucao, em segundos, dentro da duracao da cena. */
export interface IntervaloDeSilencio {
  readonly inicio_s: number;
  readonly fim_s: number;
}

/**
 * O estado de uma cena: com locucao ou silenciosa.
 *
 * A semantica de silencio e DECLARADA (contrato-w5 §2): uma cena sem
 * locucao nao e a ausencia de entrada no mapa — e uma entrada com
 * `estado: "silencio"`. A cena aparece no mapa SEMPRE.
 */
export type EstadoDeCena = "locucao" | "silencio";

/** Entrada de UMA cena no documento canonico. */
export interface EntradaDeCena {
  /** Sempre `"segundos"` — declarada por entrada, nunca inferida. */
  readonly unidade: typeof UNIDADE_SEGUNDOS;
  /** Com locucao ou silenciosa. */
  readonly estado: EstadoDeCena;
  /**
   * SHA-256 do audio a que o timing se refere. So em `estado:
   * "locucao"`. E a ligacao timing->audio: consumo por CONTEUDO, nunca
   * por posicao (contrato-w5 §2).
   */
  readonly audio?: Sha256;
  /** Duracao da cena, em segundos. */
  readonly duracao_s: number;
  /** Texto falado, como enviado ao provedor. So em `estado: "locucao"`. */
  readonly texto?: string;
  /** Palavras em ordem, monotonicas, sem sobreposicao. So em locucao. */
  readonly palavras?: readonly PalavraCanonica[];
  /**
   * Trechos de silencio DENTRO da cena, declarados explicitamente:
   * as lacunas entre palavras e as bordas (antes da primeira e depois da
   * ultima). Ordenados, sem sobreposicao, e juntos com as palavras cobrem
   * `[0, duracao_s]` — esse invariante e o oraculo C8 de `validar.ts`.
   * So em `estado: "locucao"`.
   */
  readonly silencio?: readonly IntervaloDeSilencio[];
}

/** O documento canonico de timing: mapa cena -> entrada. */
export interface TimingCanonico {
  readonly schema_version: typeof FORMATO_TIMING_CANONICO;
  /** Unidade do documento inteiro. */
  readonly unidade: typeof UNIDADE_SEGUNDOS;
  /** Uma entrada por cena do manifesto — TODAS, silenciosas inclusive. */
  readonly cenas: Readonly<Record<string, EntradaDeCena>>;
}

// ─── Serializacao ─────────────────────────────────────────────────────────────

/**
 * Serializa o documento em JSON canonico — os MESMOS bytes que entram no
 * hash, no store e na comparacao do determinismo.
 */
export function serializarTimingCanonico(doc: TimingCanonico): Buffer {
  return Buffer.from(serializarCanonico(doc), "utf-8");
}

/** SHA-256 dos bytes canonicos do documento. */
export function hashDoTimingCanonico(doc: TimingCanonico): Sha256 {
  return createHash("sha256").update(serializarTimingCanonico(doc)).digest("hex");
}
