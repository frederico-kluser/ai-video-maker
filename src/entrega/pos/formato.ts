/**
 * src/entrega/pos/formato.ts
 *
 * O DOCUMENTO DO POS — PosDocument.1. Card F5-03 (W8, caminho critico).
 * ADR-0040 + contrato-w8 §2.
 *
 * O pos nao e so bytes: e bytes + um documento que declara o que foi
 * MEDIDO e o que foi APLICADO — o mesmo espirito do MixDocument.1
 * (F3-05, W7). O consumidor (F5-07 na W9, e o oraculo deste card)
 * confere o documento contra o entregavel SEM confiar nas declaracoes —
 * mas um documento que declara a medicao e o que torna a conferencia
 * possivel.
 *
 * Campos:
 *
 *   alvo        — targetLufs e maxTruePeakDbtp LIDOS de
 *                 src/design/tokens.ts (S-5, leitura — o gate nunca
 *                 duplica o numero; se o token mudar, o gate segue o
 *                 token, ADR-0040 decisao 1) + tolerancia de medicao
 *                 ±0,3 LU + margem de overshoot AAC 1,0 dB (ADR-0040
 *                 decisao 3).
 *   normalizacao — o ganho aplicado UMA vez (pergunta adversarial 1:
 *                 nenhum caminho aplica normalizacao duas vezes), a
 *                 medicao do master e o pico pre-encode (<= -2.0 dBTP
 *                 por contrato: teto -1.0 menos a margem).
 *   entregavel  — o arquivo codificado (AAC), hash dos bytes + o perfil
 *                 que o produziu.
 *   medicoes    — integrated loudness e true peak MEDIDOS no entregavel
 *                 CODIFICADO, decodificado de volta (pergunta
 *                 adversarial 2; ADR-0040 decisao 2) + o overshoot real
 *                 de codec (tripwire do ADR-0040 decisao 3).
 *   sidecar     — o SRT, hash dos bytes + hash do documento de legendas
 *                 de que nasceu (ADR-0027: o sidecar nasce do MESMO
 *                 documento LegendasCanonicas.1 via lerLegendas, nunca
 *                 regenerado — ∅-crit (a) do contrato-w8 §2).
 *   ferramentas — versoes pinadas (ffmpeg 6.1.1 + node): o determinismo
 *                 entre versoes de ferramenta e declarado por pin, nunca
 *                 assumido — a receita `just pos` falha se a versao
 *                 corrente divergir do pin (padrao
 *                 MixDocument.ferramentas do F3-05, contrato-w8 §2).
 *
 * Serializacao canonica pela MESMA `serializarCanonico()` do cassete —
 * um segundo serializador produziria dois hashes para o mesmo dado.
 */

import { createHash } from "node:crypto";
import { serializarCanonico } from "../../resolucao/cassete/formato.js";
import type { Sha256 } from "../../resolucao/manifesto-resolvido.js";

// ─── Identidade ───────────────────────────────────────────────────────────────

/** Versao do formato. Muda ⇒ mudam os bytes do documento, muda o hash. */
export const FORMATO_POS = "PosDocument.1" as const;

// ─── O documento ───────────────────────────────────────────────────────────────

/** O alvo congelado do gate (ADR-0040) — lido dos tokens, nunca duplicado. */
export interface AlvoDoPos {
  /** LUFS integrado (EBU R 128 broadcast) — token `targetLufs` (S-5). */
  readonly targetLufs: number;
  /** Teto de true peak em dBTP — token `maxTruePeakDbtp` (S-5). */
  readonly maxTruePeakDbtp: number;
  /** Tolerancia de medicao ±0,3 LU (ADR-0040, decisao 2). */
  readonly toleranciaMedicaoLu: number;
  /** Margem de overshoot de codec AAC 1,0 dB (ADR-0040, decisao 3). */
  readonly margemOvershootDb: number;
}

/** O que foi medido e aplicado na normalizacao — UMA vez (adversarial 1). */
export interface NormalizacaoDoPos {
  /** LUFS integrado do master (medido com ebur128, ffmpeg pinado). */
  readonly lufsDoMaster: number;
  /** True peak do master (medido com ebur128, ffmpeg pinado). */
  readonly truePeakDoMasterDbtp: number;
  /** O ganho aplicado UMA vez no master, em dB. */
  readonly ganhoAplicadoDb: number;
  /** True peak do PCM normalizado ANTES do encode — <= teto - margem. */
  readonly truePeakPreEncodeDbtp: number;
}

/** O entregavel codificado. */
export interface EntregavelDoPos {
  /** Nome do arquivo (entregavel.m4a). */
  readonly nome: string;
  /** SHA-256 dos bytes do arquivo codificado. */
  readonly hash: Sha256;
  /** Nome do perfil que produziu o encode (contrato F5-02). */
  readonly perfil: string;
  /** Valor de -c:a do perfil ("aac"). */
  readonly codec: string;
  /** Taxa de amostragem do entregavel (a do master, 48 kHz). */
  readonly taxa: number;
  /** Canais do entregavel (os do master, estereo). */
  readonly canais: number;
}

/** As medicoes de conferencia — no CODIFICADO, decodificado de volta. */
export interface MedicoesDoPos {
  /** LUFS integrado do entregavel decodificado (EBU R 128, com gating). */
  readonly integradoLufs: number;
  /** True peak do entregavel decodificado, em dBTP. */
  readonly truePeakDbtp: number;
  /** Overshoot REAL de codec: truePeakDbtp - truePeakPreEncodeDbtp. */
  readonly overshootDb: number;
}

/** O sidecar SRT e a sua origem documental. */
export interface SidecarDoPos {
  /** Nome do arquivo (entregavel.srt). */
  readonly nome: string;
  /** SHA-256 dos bytes do SRT. */
  readonly hash: Sha256;
  /** SHA-256 do documento LegendasCanonicas.1 de que o SRT nasceu. */
  readonly fonte_documento_hash: Sha256;
}

/** As ferramentas que produziram os bytes — o pin do determinismo. */
export interface FerramentasDoPos {
  /** Versao do ffmpeg (pin do ADR-0040: 6.1.1; ex.: "6.1.1-3ubuntu5"). */
  readonly ffmpeg: string;
  /** Versao do node que executou o pos (ex.: "v24.15.0"). */
  readonly node: string;
}

/** O documento do pos: bytes + declaracao de medicao e colocacao. */
export interface PosDocument {
  readonly schema_version: typeof FORMATO_POS;
  readonly alvo: AlvoDoPos;
  readonly normalizacao: NormalizacaoDoPos;
  readonly entregavel: EntregavelDoPos;
  readonly medicoes: MedicoesDoPos;
  readonly sidecar: SidecarDoPos;
  readonly ferramentas: FerramentasDoPos;
}

// ─── Serializacao ─────────────────────────────────────────────────────────────

/** Serializa o documento em JSON canonico — os bytes que entram no hash. */
export function serializarPosDocumento(doc: PosDocument): Buffer {
  return Buffer.from(serializarCanonico(doc), "utf-8");
}

/** SHA-256 dos bytes canonicos do documento. */
export function hashDoPosDocumento(doc: PosDocument): Sha256 {
  return createHash("sha256").update(serializarPosDocumento(doc)).digest("hex");
}

/** SHA-256 de qualquer buffer (os bytes do entregavel, do SRT). */
export function sha256Bytes(bytes: Buffer): Sha256 {
  return createHash("sha256").update(bytes).digest("hex");
}
