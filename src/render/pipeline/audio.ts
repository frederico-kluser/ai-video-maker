// =============================================================================
// POSICIONAMENTO DE AUDIO NO RENDER — C4 (ancora absoluta, AB-600) + C3
// =============================================================================
//
// Toda posicao de audio consumida pelo render e em SEGUNDOS desde o byte
// zero da composicao — a MESMA timeline absoluta do timing canonico
// (ADR-0022), do envelope de ducking (ADR-0028) e da cadencia (ADR-0029).
//
//   - O modulo consome `DuckingEnvelope.1` (F3-03) e `Ritmo.1` (F3-04)
//     PELOS CAMPOS ABSOLUTOS: `inicio_s`/`fim_s` do envelope e posicoes em
//     segundos da cadencia — e a posicao absoluta de cada cena vem da
//     aritmetica da composicao (frameInicial/fps, AB-520/AB-600).
//   - NUNCA recomputa essas posicoes a partir da janela visual da cena: a
//     c-004 da fixture canonica prova que as duas divergem (janela visual
//     de 4 s com locucao de 8,505 s — contrato-w7 §2/§5). Recalcular e o
//     erro que o contrato existe para impedir.
//   - A EMENDA (C3, AB-617): a cadencia preserva `audio` = hash do
//     audio-FONTE; os bytes EMENDADOS sao materializados pelo F3-05 com
//     hash NOVO. O render posiciona os bytes da emenda pelo hash NOVO —
//     PROIBIDO reutilizar o hash do audio-fonte para os bytes emendados.
//     Se a emenda de uma cena ainda nao existe no mix, a cena NAO e
//     posicionada (nunca cai para o hash da fonte).
//
// Este modulo e funcao pura dos tres documentos (cadencia, envelope, mix)
// e das posicoes da aritmetica — o mesmo conjunto de entradas produz o
// mesmo plano de audio, testavel sem render e sem disco.
//
// ATENCAO (handoff): o MIX de F3-05 (bytes + hash novos) NAO esta
// mergeado nesta base — este modulo consome a INTERFACE descrita no
// contrato C3 (`MixDeEmenda`). A posicao dos bytes emendados no render
// final (renderMedia com trilha) e consumida pelo F5-07 (W9).
// =============================================================================

import type { TimingCanonico, PalavraCanonica } from "../../sincronia/timing/formato";
import type { DuckingEnvelope, IntervaloDeDucking } from "../../sincronia/ducking/formato";
import type { PosicoesDeCenas } from "../../sincronia/ducking/calcular";
import type { Sha256 } from "../../resolucao/manifesto-resolvido";

// ─── O mix da emenda (C3, AB-617) ──────────────────────────────────────────────

/**
 * O mix de F3-05: por cena, o hash NOVO dos bytes emendados (palavras na
 * ordem, ligadas pelas lacunas). A interface e a do contrato C3 — quem
 * materializa os bytes e o F3-05, na mesma onda; enquanto o mix nao
 * existir nesta base, este tipo e o contrato de entrada.
 */
export interface MixDeEmenda {
  /** cenaId -> SHA-256 dos bytes EMENDADOS (hash novo, nunca o da fonte). */
  readonly cenas: ReadonlyMap<string, Sha256>;
}

// ─── O plano de audio ──────────────────────────────────────────────────────────

/** Uma palavra posicionada em segundos ABSOLUTOS desde o byte zero. */
export interface PalavraAbsoluta {
  readonly texto: string;
  readonly inicio_s: number;
  readonly fim_s: number;
}

/** A atenuacao da trilha no trecho, em segundos absolutos (do envelope). */
export interface TrechoDeAtenuacao {
  readonly inicio_s: number;
  readonly fim_s: number;
  readonly ganho_db: number;
}

/** Uma trilha de locucao posicionada no render. */
export interface FaixaDeAudioPosicionada {
  readonly cenaId: string;
  /** O hash NOVO da emenda (C3) — nunca o hash do audio-fonte. */
  readonly hash: Sha256;
  /** Inicio absoluto da fala da cena — frameInicial/fps (AB-600). */
  readonly inicio_s: number;
  /** Fim absoluto — fim da ultima palavra (nunca a janela visual). */
  readonly fim_s: number;
  /** Palavras em segundos absolutos, na ordem da cadencia. */
  readonly palavras: readonly PalavraAbsoluta[];
  /** A cobertura de atenuacao do envelope que toca esta cena. */
  readonly atenuacao: readonly TrechoDeAtenuacao[];
}

/** O plano de audio inteiro: todas as cenas com locucao posicionadas. */
export interface PlanoDeAudio {
  readonly faixas: readonly FaixaDeAudioPosicionada[];
}

/** Erro de posicionamento: audio que nao pode ser posicionado. */
export class ErroDePosicionamento extends Error {
  readonly code = "POSICIONAMENTO_DE_AUDIO_INVALIDO";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDePosicionamento";
  }
}

// ─── O posicionamento ──────────────────────────────────────────────────────────

/** Entradas do posicionamento — os tres documentos + a aritmetica. */
export interface EntradasDoPosicionamento {
  /** A cadencia (Ritmo.1, F3-04): TimingCanonico com lacunas encurtadas. */
  readonly cadencia: TimingCanonico;
  /** O envelope de ducking (DuckingEnvelope.1, F3-03). */
  readonly envelope: DuckingEnvelope;
  /** O mix da emenda (C3, F3-05) — hash NOVO por cena. */
  readonly mix: MixDeEmenda;
  /** Inicio absoluto de cada cena, em segundos — frameInicial/fps (AB-520). */
  readonly posicoes: PosicoesDeCenas;
}

/**
 * Posiciona a trilha de audio no render — C4: campos ABSOLUTOS da
 * cadencia e do envelope, aritmetica frameInicial/fps, NUNCA a janela
 * visual.
 *
 * Regras:
 *   - cena silenciosa (estado "silencio") nao vira faixa;
 *   - cena com locucao SEM posicao absoluta e ERRO (o envelope de ducking
 *     exige o mesmo — a fala nao pode flutuar);
 *   - cena com locucao SEM emenda no mix e OMITIDA (nao existe bytes
 *     emendados; reutilizar o hash da fonte seria o falso-verde de C3);
 *   - a atenuacao vem do envelope pelos trechos absolutos que tocam a fala
 *     da cena — verbatim, nunca recalculada da janela visual.
 */
export function posicionarAudio(
  entradas: EntradasDoPosicionamento,
): PlanoDeAudio {
  const { cadencia, envelope, mix, posicoes } = entradas;

  if (cadencia.unidade !== "segundos" || envelope.unidade !== "segundos") {
    throw new ErroDePosicionamento(
      "cadencia/envelope em unidade desconhecida — o contrato C4 exige " +
        "segundos desde o byte zero",
    );
  }

  const faixas: FaixaDeAudioPosicionada[] = [];

  for (const cenaId of Object.keys(cadencia.cenas).sort()) {
    const entrada = cadencia.cenas[cenaId]!;
    if (entrada.estado !== "locucao") continue; // silencio declarado: sem faixa

    const posicao = posicoes.get(cenaId);
    if (posicao === undefined) {
      throw new ErroDePosicionamento(
        `cena "${cenaId}" tem locucao e nenhuma posicao absoluta — a fala ` +
          "nao pode ser posicionada (regra ancora-absoluta, campo posicoes)",
      );
    }

    const hashNovo = mix.cenas.get(cenaId);
    if (hashNovo === undefined) {
      // C3: sem emenda materializada, a cena fica SEM faixa — nunca cai
      // para o hash do audio-fonte que a cadencia preserva.
      continue;
    }

    const palavras: PalavraAbsoluta[] = (entrada.palavras ?? []).map(
      (p: PalavraCanonica) => ({
        texto: p.texto,
        inicio_s: posicao + p.inicio_s,
        fim_s: posicao + p.fim_s,
      }),
    );
    const primeira = palavras[0];
    const ultima = palavras[palavras.length - 1];
    if (primeira === undefined || ultima === undefined) {
      throw new ErroDePosicionamento(
        `cena "${cenaId}" com locucao e zero palavras — cadencia invalida`,
      );
    }

    // A cobertura de atenuacao: os intervalos ABSOLUTOS do envelope que
    // tocam a fala da cena — verbatim, com os rampas do documento.
    const atenuacao: TrechoDeAtenuacao[] = envelope.intervalos
      .filter(
        (iv: IntervaloDeDucking) =>
          iv.fim_s >= primeira.inicio_s && iv.inicio_s <= ultima.fim_s,
      )
      .map((iv) => ({
        inicio_s: iv.inicio_s,
        fim_s: iv.fim_s,
        ganho_db: iv.ganho_db,
      }));

    faixas.push({
      cenaId,
      hash: hashNovo,
      inicio_s: primeira.inicio_s,
      fim_s: ultima.fim_s,
      palavras,
      atenuacao,
    });
  }

  return { faixas: Object.freeze(faixas) };
}
