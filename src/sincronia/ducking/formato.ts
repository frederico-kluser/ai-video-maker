/**
 * src/sincronia/ducking/formato.ts
 *
 * O ENVELOPE DE DUCKING — DuckingEnvelope.1. Card F3-03 (W6).
 *
 * ─── O que este documento e ──────────────────────────────────────────────
 *
 * O envelope de ducking e um DADO: um documento serializavel e
 * deterministico, chave por INTERVALO ABSOLUTO na timeline (segundos desde
 * o byte zero do video — nunca indice de trecho, nunca posicao relativa).
 * Quem o APLICA no mix de audio e o F3-05 (W7): a fronteira esta
 * registrada no contrato congelado (docs/contrato-w6.md §4) e no
 * ADR-0012 ("O mix de audio (ducking, loudness, cobertura da trilha) —
 * F3-05"). Este card PRODUZ o envelope; nao mixa nada.
 *
 * Um intervalo declara o ganho da trilha durante a locucao:
 *
 *   rampa de entrada          patamar constante           rampa de saida
 *   [inicio - rampa_entrada,  [inicio, fim]               [fim, fim + rampa_saida]
 *    inicio]                  0 -> ganho_db (<=0)         ganho_db -> 0
 *
 * A atenuacao COMECA ANTES da fala: o patamar comeca `folgaEntradaS`
 * antes da primeira palavra (a rampa de entrada termina ANTES do inicio
 * da fala — a curva de ataque cobre o ataque da palavra com folga).
 * Intervalos cujas rampas se sobreporiam sao FUNDIDOS pelo calculo
 * (calcular.ts): trechos de fala colados nunca produzem degrau.
 *
 * ─── Determinismo ────────────────────────────────────────────────────────
 *
 * A serializacao reusa `serializarCanonico()` de `src/resolucao/cassete/`
 * — a MESMA do timing canonico: dois serializadores canonicos no mesmo
 * repositorio produziriam dois hashes para o mesmo dado. O envelope e
 * funcao pura de (timing canonico + posicoes absolutas + parametros);
 * dois processamentos sobre os mesmos bytes produzem bytes identicos, e o
 * golden commitado (tests/fixtures/ducking-canono.json) prova a regressao
 * entre versoes.
 */

import { createHash } from "node:crypto";
import { serializarCanonico } from "../../resolucao/cassete/formato.js";
import type { Sha256 } from "../../resolucao/manifesto-resolvido.js";
import { UNIDADE_SEGUNDOS } from "../timing/formato.js";

// ─── Identidade ───────────────────────────────────────────────────────────────

/** Versao do formato. Muda ⇒ mudam os bytes, muda o hash. */
export const FORMATO_ENVELOPE_DUCKING = "DuckingEnvelope.1" as const;

/**
 * MIME do envelope de ducking.
 *
 * Nao e uma URL: nao ha `://` — o guarda `encontrarURLs()` nao o acusa.
 * O F3-05 (W7) identifica o documento por este MIME ou por conteudo.
 */
export const MIME_ENVELOPE_DUCKING =
  "application/vnd.editor-video-ia.ducking-envelope+json" as const;

// ─── O documento ───────────────────────────────────────────────────────────────

/**
 * Um intervalo de atenuacao, posicionado na timeline ABSOLUTA.
 *
 * Durante [inicio_s, fim_s] o ganho da trilha e `ganho_db`; a rampa de
 * entrada ocupa [inicio_s - rampa_entrada_s, inicio_s] (0 dB -> ganho_db)
 * e a de saida ocupa [fim_s, fim_s + rampa_saida_s] (ganho_db -> 0 dB).
 */
export interface IntervaloDeDucking {
  /** Inicio do patamar de atenuacao, em segundos absolutos. */
  readonly inicio_s: number;
  /** Fim do patamar de atenuacao, em segundos absolutos. */
  readonly fim_s: number;
  /**
   * Ganho da trilha durante o patamar, em dB. Negativo = atenuacao
   * (ex.: -12). O zero nao e atenuacao: locucao coberta por ganho zero
   * esta SEM atenuacao (∅-crit).
   */
  readonly ganho_db: number;
  /** Duracao da rampa de entrada, em segundos. Sempre > 0 (nunca degrau). */
  readonly rampa_entrada_s: number;
  /** Duracao da rampa de saida, em segundos. Sempre > 0 (nunca degrau). */
  readonly rampa_saida_s: number;
  /**
   * Cena que originou o intervalo — informativo, para rastreabilidade.
   * Apos a fusao de intervalos colados o campo continua valendo (a
   * primeira cena do grupo); o intervalo pode cobrir fala de mais cenas.
   */
  readonly cena?: string;
}

/** O envelope de ducking: um documento por video, intervalos absolutos. */
export interface DuckingEnvelope {
  readonly schema_version: typeof FORMATO_ENVELOPE_DUCKING;
  /** Sempre "segundos" — declarada no documento, nunca inferida. */
  readonly unidade: typeof UNIDADE_SEGUNDOS;
  /**
   * Intervalos ordenados por inicio_s, sem sobreposicao de rampas (o
   * invariante anti-degrau do oraculo de validar.ts). Vazio e legitimo:
   * um video sem locucao nao precisa de atenuacao nenhuma.
   */
  readonly intervalos: readonly IntervaloDeDucking[];
}

// ─── Serializacao ─────────────────────────────────────────────────────────────

/**
 * Serializa o envelope em JSON canonico — os MESMOS bytes que entram no
 * hash, no store e na comparacao do determinismo.
 */
export function serializarEnvelopeDucking(doc: DuckingEnvelope): Buffer {
  return Buffer.from(serializarCanonico(doc), "utf-8");
}

/** SHA-256 dos bytes canonicos do envelope. */
export function hashDoEnvelopeDucking(doc: DuckingEnvelope): Sha256 {
  return createHash("sha256").update(serializarEnvelopeDucking(doc)).digest("hex");
}
