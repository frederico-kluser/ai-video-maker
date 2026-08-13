/**
 * src/entrega/pos/normalizar.ts
 *
 * A ESTRATEGIA DE GAIN STAGING do pos — card F5-03 (W8). ADR-0040.
 *
 * O ADR-0040 congela a MEDICAO e deixa a estrategia de ganho para o card
 * ("quanto reduzir/levantar o master — e do card, dentro do alvo e do
 * teto"). Esta e a estrategia, congelada aqui:
 *
 *   1. ganhoParaAlvo = targetLufs - lufsDoMaster   (chegar no alvo)
 *   2. tetoPreEncode = maxTruePeakDbtp - margemOvershootDb
 *      (ADR-0040 decisao 3: o pico pre-encode fica em <= -2.0 dBTP —
 *      o teto de -1.0 menos a margem de 1,0 dB de overshoot de AAC)
 *   3. ganhoMaximoPorTeto = tetoPreEncode - truePeakDoMasterDbtp
 *   4. ganhoAplicado = min(ganhoParaAlvo, ganhoMaximoPorTeto)
 *
 * A normalizacao e aplicada UMA vez — a pergunta adversarial (1) do
 * card: "a normalizacao foi aplicada duas vezes em algum caminho?"
 * Nao: o master do mix recebe o ganho UMA vez, e a conferencia mede a
 * saida e falha se o alvo divergir. Um ganho reaplicado sobre o ja
 * normalizado desloca a saida do alvo pela propria magnitude do ganho e
 * o oraculo acusa (sonda S7 do gate).
 *
 * O clamp pelo teto e a consequencia da decisao 3: se o master for tao
 * quente que o ganhoParaAlvo estouraria o pico pre-encode, o ganho e
 * limitado e o entregavel fica ABAIXO do alvo — um entregavel fora da
 * tolerancia do alvo NAO EXISTE (∅-crit original: bloqueia a entrega).
 *
 * Tudo aqui e FUNCAO PURA (numeros e PCM) — a medicao e da ferramenta
 * pinada (`medir.ts`), o ganho e aritmetica.
 */

import { comGanho, lerWavPcm, escreverWavPcm, picoAbsoluto } from "../../audio/mix/pcm.js";
import type { Pcm } from "../../audio/mix/pcm.js";
import type { AlvoDoPos } from "./formato.js";

/** A estrategia de ganho computada dos numeros medidos. */
export interface GanhoComputado {
  /** O ganho que leva o master ao alvo (targetLufs - medido). */
  readonly ganhoParaAlvoDb: number;
  /** O teto pre-encode: maxTruePeakDbtp - margemOvershootDb (-2.0 dBTP). */
  readonly tetoPreEncodeDbtp: number;
  /** O maior ganho que nao estoura o teto pre-encode. */
  readonly ganhoMaximoPorTetoDb: number;
  /** O ganho APLICADO: min(ganhoParaAlvo, ganhoMaximoPorTeto). */
  readonly ganhoAplicadoDb: number;
  /** True peak do PCM normalizado, antes do encode. */
  readonly truePeakPreEncodeDbtp: number;
  /** Verdadeiro quando o clamp pelo teto limitou o ganho. */
  readonly clampadoPorTeto: boolean;
}

/**
 * Computa o ganho da estrategia — puro, dos numeros medidos.
 *
 * @param alvo          o alvo do gate (tokens + ADR-0040)
 * @param lufsDoMaster  loudness integrada do master (medida)
 * @param truePeakDoMasterDbtp  true peak do master (medido)
 */
export function computarGanho(
  alvo: AlvoDoPos,
  lufsDoMaster: number,
  truePeakDoMasterDbtp: number,
): GanhoComputado {
  const ganhoParaAlvoDb = alvo.targetLufs - lufsDoMaster;
  const tetoPreEncodeDbtp = alvo.maxTruePeakDbtp - alvo.margemOvershootDb;
  const ganhoMaximoPorTetoDb = tetoPreEncodeDbtp - truePeakDoMasterDbtp;
  const ganhoAplicadoDb = Math.min(ganhoParaAlvoDb, ganhoMaximoPorTetoDb);
  return {
    ganhoParaAlvoDb,
    tetoPreEncodeDbtp,
    ganhoMaximoPorTetoDb,
    ganhoAplicadoDb,
    truePeakPreEncodeDbtp: truePeakDoMasterDbtp + ganhoAplicadoDb,
    clampadoPorTeto: ganhoAplicadoDb < ganhoParaAlvoDb - 1e-9,
  };
}

/** Decibeis -> fator linear (10^(db/20)). */
export function ganhoLinearDe(ganhoDb: number): number {
  return Math.pow(10, ganhoDb / 20);
}

/**
 * Aplica o ganho UMA vez nos bytes WAV do master e devolve o WAV
 * normalizado (f32le, mesmas taxa/canais) + o pico absoluto resultante.
 *
 * Puro e deterministico: decodifica o WAV f32 do mix (lerWavPcm),
 * multiplica as amostras pelo fator linear e re-escreve o WAV — a mesma
 * aritmetica que o mix usa para volumes (comGanho), nenhum caminho
 * duplica o ganho.
 */
export function aplicarGanhoNoMaster(
  bytesMaster: Buffer,
  ganhoDb: number,
): { wav: Buffer; pcm: Pcm; picoAbsoluto: number } {
  const pcm = lerWavPcm(bytesMaster);
  const normalizado = comGanho(pcm, ganhoLinearDe(ganhoDb));
  return {
    wav: escreverWavPcm(normalizado, 32),
    pcm: normalizado,
    picoAbsoluto: picoAbsoluto(normalizado),
  };
}
