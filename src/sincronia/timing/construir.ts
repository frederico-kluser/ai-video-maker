/**
 * src/sincronia/timing/construir.ts
 *
 * O CONSTRUTOR DO TIMING CANONICO — tres consumidores (legendas, ducking,
 * ritmo), uma fonte.
 *
 * Entrada: o manifesto, a parcial resolvida (assets + nos_locucao) e um
 * carregador de bytes por hash. Saida: o documento canonico (formato.ts),
 * ja validado pelo oraculo (validar.ts) — um documento que o oraculo
 * reprova nao sai daqui.
 *
 * ─── As tres regras de ouro do contrato-w5 §2 ────────────────────────────
 *
 *   1. UNIDADE SEGUNDOS. `TimingLocucao` do F2-03 e milissegundo inteiro;
 *      aqui vira `s` (divisao exata por 1000). Conversao para frame e do
 *      consumidor, no ponto de consumo.
 *
 *   2. CHAVE POR CENA + SILENCIO DECLARADO. O mapa tem TODAS as cenas do
 *      manifesto; cena sem `audio_cena` entra como `estado: "silencio"`
 *      (nunca pela ausencia de entrada). Dentro de uma cena com locucao,
 *      as lacunas entre palavras e as bordas sao declaradas em `silencio`.
 *
 *   3. CONSUMO POR CONTEUDO. O casamento timing<->audio usa
 *      `casarTimings()` de F2-03, ligado pelo campo `audio` do documento
 *      — jamais por ordem de aparecimento ou indice assumido.
 *
 * ─── O oraculo tem premissa independente (pergunta adversarial 3) ───────
 *
 * Alem de validar o documento, o construtor mede o AUDIO DE VERDADE:
 *
 *   C9  `duracaoDoWavMs()` (C4: duracao aritmetica no PCM, nunca
 *       container) comparada com a `duracao_ms` que o produtor declarou,
 *       dentro da tolerancia de 250 ms — a mesma que ja guarda, no
 *       produtor, "timing descreve outro audio". Se a parcial afirmasse
 *       um audio e entregasse o timing de outro, o delta dispara em
 *       segundos e isto fica VERMELHO aqui — pergunta adversarial (2).
 *
 *   C10 o SHA-256 dos bytes entregues tem de bater com o hash do asset.
 *       Um carregador que devolva bytes errados para um hash certo
 *       desviaria o timing e o audio juntos, sem nenhum outro sinal.
 *
 * Se o carregador nao entregar os bytes do audio, o construtor NAO
 * inventa duracao: ele para. Orculo cego e oraculo que nao existe.
 */

import { createHash } from "node:crypto";
import type { Manifesto } from "../../contratos/manifesto.js";
import { duracaoDaCena, mapaDeNos } from "../../composicao/tempo.js";
import type { ParcialResolvido, Sha256 } from "../../resolucao/manifesto-resolvido.js";
import {
  casarTimings,
} from "../../resolucao/locucao/timing.js";
import type { TimingLocucao } from "../../resolucao/locucao/timing.js";
import {
  TOLERANCIA_DIVERGENCIA_MS,
  duracaoDoWavMs,
} from "../../resolucao/locucao/provedor.js";
import {
  UNIDADE_SEGUNDOS,
} from "./formato.js";
import type {
  EntradaDeCena,
  IntervaloDeSilencio,
  PalavraCanonica,
  TimingCanonico,
} from "./formato.js";
import { ETimingCanonicoInvalido, validarTimingCanonico } from "./validar.js";

/** Le os bytes de um asset pelo hash. `null` = nao ha bytes. */
export type CarregarBytes = (
  hash: Sha256,
) => Promise<Buffer | null> | Buffer | null;

/** Tudo que o construtor precisa alem do manifesto. */
export interface EntradasDoConstrutor {
  readonly manifesto: Manifesto;
  /** Parcial ou manifesto resolvido — so precisa de assets + nos_locucao. */
  readonly parcial: Pick<ParcialResolvido, "assets" | "nos_locucao">;
  /** Store (ou replay do cassete): hash -> bytes. */
  readonly carregar: CarregarBytes;
}

/**
 * Constroi o documento canonico de timing para um manifesto.
 *
 * @throws ETimingCanonicoInvalido se o oraculo reprovar qualquer entrada,
 *   se uma cena com locucao nao tiver timing (legenda que nunca aparece),
 *   se os bytes do audio divergirem do que o timing declara, ou se os
 *   bytes nao baterem com o hash do asset.
 */
export async function construirTimingCanonico(
  entradas: EntradasDoConstrutor,
): Promise<TimingCanonico> {
  const { manifesto, parcial, carregar } = entradas;

  // Casamento por CONTEUDO — ligado pelo campo `audio` do documento de
  // F2-03. Lanca se uma unidade de `nos_locucao` nao tiver timing.
  const locucoes = await casarTimings(parcial, carregar);
  const porCena = new Map(locucoes.map((l) => [l.unidade, l]));

  const nos = mapaDeNos(manifesto);
  const cenas: Record<string, EntradaDeCena> = {};

  // Iteracao na ORDEM do manifesto (ordenacao explicita = determinismo);
  // a serializacao canonica reordena as chaves.
  for (const cena of manifesto.cenas) {
    if (cena.audio_cena === undefined) {
      // Cena silenciosa — declarada explicitamente, nunca pela ausencia
      // de entrada. A duracao vem da aritmetica da composicao (F1-01),
      // nao de chute deste card.
      cenas[cena.id] = {
        unidade: UNIDADE_SEGUNDOS,
        estado: "silencio",
        duracao_s: duracaoDaCena(cena, nos) / manifesto.fps,
      };
      continue;
    }

    const locucao = porCena.get(cena.id);
    if (locucao === undefined) {
      // AB-522: cena declara locucao no manifesto e nao tem entrada na
      // parcial. E o modo de falha silencioso que o casarTimings nao ve
      // (ele itera `nos_locucao`, nao o manifesto): legenda que nunca
      // aparece, ninguem fica vermelho. Aqui fica VERMELHO.
      throw new ETimingCanonicoInvalido(cena.id, [
        "cena com audio_cena no manifesto sem entrada em nos_locucao — " +
          "sem timing, a legenda nunca aparece",
      ]);
    }

    const timing = locucao.timing;
    const bytesAudio = await carregar(locucao.audio);
    if (bytesAudio === null) {
      throw new ETimingCanonicoInvalido(cena.id, [
        `bytes do audio ${locucao.audio.slice(0, 16)}… nao carregaram — ` +
          "sem os bytes, o oraculo de duracao fica cego e o documento " +
          "derivaria da premissa do produtor",
      ]);
    }

    // C10 — bytes certos para o hash certo.
    const hashDosBytes = createHash("sha256").update(bytesAudio).digest("hex");
    if (hashDosBytes !== locucao.audio) {
      throw new ETimingCanonicoInvalido(cena.id, [
        `bytes entregues para ${locucao.audio.slice(0, 16)}… tem hash ` +
          `${hashDosBytes.slice(0, 16)}… — timing e audio divergindo em ` +
          "silencio, sem nada ficar vermelho",
      ]);
    }

    // C9 — a duracao medida no PCM contra a declarada no timing. O
    // proprio produtor roda `conferirDuracao`; aqui medimos DE NOVO, nos
    // bytes que o consumidor vai usar.
    const medidaMs = duracaoDoWavMs(bytesAudio);
    const deltaMs = Math.abs(medidaMs - timing.duracao_ms);
    if (deltaMs > TOLERANCIA_DIVERGENCIA_MS) {
      throw new ETimingCanonicoInvalido(cena.id, [
        `o timing declara ${timing.duracao_ms}ms e o PCM mede ${medidaMs}ms ` +
          `(delta ${deltaMs}ms > ${TOLERANCIA_DIVERGENCIA_MS}ms). ` +
          "O timing provavelmente descreve OUTRO audio — divergencia sem " +
          "sinal no produtor nao chega ao consumidor.",
      ]);
    }

    cenas[cena.id] = entradaDeLocucao(timing);
  }

  const documento: TimingCanonico = {
    schema_version: "TimingCanonico.1",
    unidade: UNIDADE_SEGUNDOS,
    cenas,
  };

  const problemas = validarTimingCanonico(documento);
  if (problemas.length > 0) {
    throw new ETimingCanonicoInvalido("(documento)", problemas);
  }
  return documento;
}

/** Converte o timing de F2-03 (ms inteiro) na entrada canonica (s). */
function entradaDeLocucao(timing: TimingLocucao): EntradaDeCena {
  const palavras: PalavraCanonica[] = timing.palavras.map((p) => ({
    texto: p.texto,
    inicio_s: p.inicio_ms / 1000,
    fim_s: p.fim_ms / 1000,
  }));

  return {
    unidade: UNIDADE_SEGUNDOS,
    estado: "locucao",
    audio: timing.audio,
    duracao_s: timing.duracao_ms / 1000,
    texto: timing.texto,
    palavras,
    silencio: derivarSilencio(timing),
  };
}

/**
 * Deriva os trechos de silencio declarados: bordas + lacunas entre
 * palavras, em milissegundos inteiros, convertidos por divisao exata —
 * as mesmas fronteiras que o oraculo C8 espera.
 */
function derivarSilencio(timing: TimingLocucao): IntervaloDeSilencio[] {
  const silencio: IntervaloDeSilencio[] = [];
  let cursorMs = 0;

  for (const palavra of timing.palavras) {
    if (palavra.inicio_ms > cursorMs) {
      silencio.push({
        inicio_s: cursorMs / 1000,
        fim_s: palavra.inicio_ms / 1000,
      });
    }
    cursorMs = Math.max(cursorMs, palavra.fim_ms);
  }
  if (timing.duracao_ms > cursorMs) {
    silencio.push({
      inicio_s: cursorMs / 1000,
      fim_s: timing.duracao_ms / 1000,
    });
  }
  return silencio;
}
