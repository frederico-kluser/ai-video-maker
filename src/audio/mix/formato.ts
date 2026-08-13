/**
 * src/audio/mix/formato.ts
 *
 * O DOCUMENTO DO MIX — MixDocument.1. Card F3-05 (W7). ADR-0034.
 *
 * O mix nao e so bytes: e bytes + um documento que declara ONDE cada
 * componente foi colocado (a "trilha composta" como dado, no mesmo
 * espirito do DuckingEnvelope.1 e do TimingCanonico.1). O consumidor
 * (F5-03 na W8, e o proprio oraculo deste card) confere o documento
 * contra os inputs SEM confiar nas declaracoes — mas um documento que
 * declara a colocacao e o que torna a conferencia possivel.
 *
 * Campos:
 *
 *   faixas.locucao[] — UMA entrada por cena com locucao, com o hash da
 *     emenda MATERIALIZADA (C3: bytes + hash NOVOS, distintos da fonte
 *     quando ha cortes) e o intervalo absoluto em que a fala TOCA no
 *     mix — ja com a reconciliacao do C1 aplicada (cena posterior manda,
 *     cauda da anterior cortada). `inicio_s` e o INICIO ABSOLUTO da cena
 *     (frameInicial/fps da aritmetica de composicao, AB-520), nunca a
 *     janela visual.
 *   faixas.musica — a trilha (hash dos bytes decodificados a 48 kHz, nao
 *     o OGG bruto: o que o mix soma e o PCM) e o intervalo em que toca.
 *   ferramentas — versoes pinadas (ffmpeg, node): o determinismo entre
 *     versoes e declarado, nunca assumido — a receita do gate falha se a
 *     versao corrente divergir do pin.
 *
 * Serializacao canonica pela MESMA `serializarCanonico()` do cassete —
 * um segundo serializador produziria dois hashes para o mesmo dado.
 */

import { createHash } from "node:crypto";
import { serializarCanonico } from "../../resolucao/cassete/formato.js";
import type { Sha256 } from "../../resolucao/manifesto-resolvido.js";
import { UNIDADE_SEGUNDOS } from "../../sincronia/timing/formato.js";

// ─── Identidade ───────────────────────────────────────────────────────────────

/** Versao do formato. Muda ⇒ mudam os bytes do documento, muda o hash. */
export const FORMATO_MIX = "MixDocument.1" as const;

// ─── O documento ───────────────────────────────────────────────────────────────

/** Uma fala posicionada no mix, ja reconciliada (C1). */
export interface FaixaLocucao {
  /** Cena que originou a fala. */
  readonly cena: string;
  /** SHA-256 do audio-FONTE (timing canonico, F3-01). */
  readonly fonte_hash: Sha256;
  /**
   * SHA-256 dos bytes da EMENDA materializada (C3). Com cortes na
   * cadencia, e SEMPRE distinto de fonte_hash; sem cortes, os bytes
   * emendados sao os da fonte e o hash coincide (enderecamento por
   * conteudo — identico e identico).
   */
  readonly emenda_hash: Sha256;
  /** Volume da fala (audio_cena.volume do manifesto resolvido). */
  readonly volume: number;
  /** Inicio absoluto da fala no mix (inicio da cena, AB-520). */
  readonly inicio_s: number;
  /**
   * Fim absoluto da fala no mix — apos a reconciliacao: a cena posterior
   * manda, e a cauda da anterior e cortada no inicio dela (C1 item 3).
   */
  readonly fim_s: number;
}

/** A trilha de musica no mix, com o envelope de ducking aplicado. */
export interface FaixaMusica {
  /** SHA-256 dos bytes PCM (48 kHz, f32) que o mix soma. */
  readonly hash: Sha256;
  /** Volume da trilha (audio.volume do manifesto resolvido). */
  readonly volume: number;
  /** Inicio absoluto da trilha (audio.inicio_frames do manifesto). */
  readonly inicio_s: number;
  /** Fim absoluto da trilha no mix (duracao do video). */
  readonly fim_s: number;
}

/** As ferramentas que produziram os bytes — o pin do determinismo. */
export interface FerramentasDoMix {
  /** Versao do ffmpeg que decodificou/reamostrou (ex.: "6.1.1-3ubuntu5"). */
  readonly ffmpeg: string;
  /** Versao do node que executou o mix. */
  readonly node: string;
}

/** O documento do mix: bytes + declaracao de colocacao. */
export interface MixDocument {
  readonly schema_version: typeof FORMATO_MIX;
  /** Sempre "segundos" — a mesma unidade do timing e do envelope. */
  readonly unidade: typeof UNIDADE_SEGUNDOS;
  /** Taxa do master. */
  readonly rate: number;
  /** Canais do master. */
  readonly canais: number;
  /** Duracao do master em segundos (duracao da composicao, AB-520). */
  readonly duracao_s: number;
  readonly faixas: {
    readonly locucao: readonly FaixaLocucao[];
    readonly musica: FaixaMusica;
  };
  /** Politica da cadencia que produziu as emendas (Ritmo.1). */
  readonly cadencia: { readonly versao: string; readonly gapAlvoS: number };
  readonly ferramentas: FerramentasDoMix;
}

// ─── Serializacao ─────────────────────────────────────────────────────────────

/** Serializa o documento em JSON canonico — os bytes que entram no hash. */
export function serializarMixDocumento(doc: MixDocument): Buffer {
  return Buffer.from(serializarCanonico(doc), "utf-8");
}

/** SHA-256 dos bytes canonicos do documento. */
export function hashDoMixDocumento(doc: MixDocument): Sha256 {
  return createHash("sha256").update(serializarMixDocumento(doc)).digest("hex");
}

/** SHA-256 de qualquer buffer (os bytes do master, os da emenda). */
export function sha256Bytes(bytes: Buffer): Sha256 {
  return createHash("sha256").update(bytes).digest("hex");
}
