/**
 * src/audio/mix/verificar.ts
 *
 * O ORACULO DO MIX — card F3-05 (W7). ADR-0034.
 *
 * "A musica cobre a locucao? MEÇA, nao escute." Este modulo e a medida.
 * Ele NAO confia no documento do mix nem no construtor: rededuz as
 * colocacoes dos MESMOS inputs (timing canonico + cadencia + envelope +
 * posicoes da aritmetica F1-01) e mede nos BYTES produzidos.
 *
 * As checagens (cada uma vira um problema; vazio = VERDE):
 *
 *   V1  forma — documento MixDocument.1, unidade segundos, taxa/canais
 *       coerentes com os bytes do master (parse do WAV).
 *   V2  colocacao — cada cena com locucao do timing tem uma faixa cujos
 *       inicio_s/fim_s batem com a rededucao: inicio = frameInicial/fps
 *       (AB-520), duracao = duracao_s da CADENCIA (Ritmo.1 — o documento
 *       compactado declara a duracao emendada), fim = reconciliado (cena
 *       posterior manda, cauda cortada no inicio da posterior — C1).
 *   V3  sobreposicao residual (∅-crit C1, item 4) — pares de faixas do
 *       documento com sobreposicao > 0,1 s: ERRO, com o par e a duracao.
 *   V4  emenda (∅-crit C3) — para cena COM cortes na cadencia: o hash da
 *       emenda e distinto do hash da fonte, os bytes sao ENDERECAVEIS
 *       (carregarBytes resolve) e sao exatamente a fonte menos os cortes
 *       (byte a byte). Sem cortes, emenda == fonte e enderecamento por
 *       conteudo legitimo (bytes identicos, hash identico).
 *   V5  presenca (∅-crit original) — o mix tem fala: em cada intervalo
 *       declarado, os bytes do mix DIFEREM da derivacao sem fala, e o
 *       RMS da fala passa do piso. Um mix sem locucao e VERMELHO.
 *   V6  clip (adversarial 1) — pico absoluto dos bytes <= 1.0 (0 dBFS).
 *   V7  cobertura (adversarial 3) — em cada intervalo de fala: (a) a
 *       musica no mix difere da musica sem envelope (o envelope TEM
 *       efeito onde a fala existe); (b) a atenuacao medida bate com a
 *       declarada (±1 dB) e e <= -6 dB; (c) a margem fala/musica e
 *       >= 6 dB. Sem ducking, (a)/(b) ficam VERMELHOS.
 *   V8  reconstrucao — os bytes do mix batem byte a byte com a
 *       derivacao de contrato (fala + musica com envelope). Divergencia
 *       nomeia o primeiro instante em que os bytes mentem.
 *
 * Todas as medicoes sao numeros sobre os bytes e sobre as derivacoes
 * CONFERIDAS contra os bytes (V8) — a disciplina do card: meça, nao
 * escute. Os limiares (0,1 s, ±1 dB, -6 dB, 6 dB, piso de RMS) sao
 * DECLARADOS aqui e registrados no ADR-0034 (D5); a calibracao por
 * escuta e da W10 (AB-661).
 */

import { EPS_S, validarTimingCanonico } from "../../sincronia/timing/validar.js";
import { posicoesDaTimeline } from "../../sincronia/ducking/calcular.js";
import { lerWavPcm, picoAbsoluto, rms, somar } from "./pcm.js";
import { emendar } from "./emenda.js";
import { derivarComponentes, ganhoAplicado } from "./mixar.js";
import type { EntradasDoMix } from "./mixar.js";
import type { MixDocument } from "./formato.js";
import { FORMATO_MIX } from "./formato.js";
import { SOBREPOSICAO_RESIDUAL_MAXIMA_S } from "./mixar.js";
import type { ResultadoDoMix } from "./mixar.js";

// ─── Limiares declarados (ADR-0034, D5) ───────────────────────────────────────

/** Teto de sobreposicao residual de fala no mix (C1 item 4). */
export const LIMIAR_SOBREPOSICAO_S = SOBREPOSICAO_RESIDUAL_MAXIMA_S;

/** Tolerancia entre a atenuacao medida e a declarada pelo envelope. */
export const TOLERANCIA_ATENUACAO_DB = 1.0;

/** Atenuacao minima exigida onde a fala existe (o ducking e -12 dB). */
export const ATENUACAO_MINIMA_DB = -6.0;

/** Margem minima fala/musica (a musica nunca cobre a fala). */
export const MARGEM_FALA_MUSICA_MINIMA_DB = 6.0;

/** Piso de RMS da fala num intervalo (presenca de energia, ~-60 dBFS). */
export const PISO_RMS_FALA = 1e-3;

// ─── Medicoes ─────────────────────────────────────────────────────────────────

/** A medida de UMA cena com locucao. */
export interface MedicaoDeCena {
  readonly cena: string;
  readonly inicio_s: number;
  readonly fim_s: number;
  /** Duracao da fala no mix (apos a emenda e a reconciliacao). */
  readonly duracaoFala_s: number;
  /** RMS da fala no intervalo (medido na derivacao conferida). */
  readonly rmsFala: number;
  /** A media do ganho que o envelope DECLARA no intervalo, em dB. */
  readonly atenuacaoDeclarada_db: number;
  /** A atenuacao MEDIDA nos componentes do mix, em dB. */
  readonly atenuacaoMedida_db: number;
  /** Margem fala/musica: 20*log10(rmsFala/rmsMusica), em dB. */
  readonly margemFalaMusica_db: number;
}

/** As medicoes do mix, para o relatorio do gate. */
export interface MedicoesDoMix {
  readonly picoAbsoluto: number;
  /** A maior sobreposicao residual entre pares de falas, em segundos. */
  readonly sobreposicaoMaxima_s: number;
  readonly cenas: readonly MedicaoDeCena[];
}

/** O veredito: problemas vazio = VERDE; cada problema nomeia a regra. */
export interface ResultadoDaVerificacao {
  readonly problemas: readonly string[];
  readonly medicoes: MedicoesDoMix;
}

/** Uma colocacao esperada, rededuzida dos inputs. */
interface SpanEsperado {
  readonly cena: string;
  readonly inicio_s: number;
  readonly fim_s: number;
  readonly duracao_s: number;
}

// ─── A rededucao independente de colocacao (V2/V3) ────────────────────────────

/**
 * Rededuz as colocacoes de fala dos INPUTS — nunca do documento do mix.
 *
 * inicio = frameInicial/fps (aritmetica F1-01, AB-520); duracao =
 * duracao_s da CADENCIA (Ritmo.1 item 5: o documento compactado declara
 * a duracao emendada = fonte - soma dos cortes); reconciliacao: cena
 * posterior manda, cauda da anterior cortada exatamente no inicio da
 * posterior (C1 item 3). Tolerancia de 0,1 s: so a cauda da ANTERIOR e
 * cortada quando a sobreposicao passa disso (C1 item 4).
 */
export function spansEsperados(entradas: EntradasDoMix): SpanEsperado[] {
  const problemas = validarTimingCanonico(entradas.timing);
  if (problemas.length > 0) {
    throw new Error("timing invalido na rededucao do oraculo");
  }
  const posicoes = posicoesDaTimeline(entradas.manifesto);

  const spans: SpanEsperado[] = [];
  for (const id of Object.keys(entradas.timing.cenas).sort()) {
    const entrada = entradas.timing.cenas[id]!;
    if (entrada.estado !== "locucao") continue;
    const posicao = posicoes.get(id);
    if (posicao === undefined) {
      throw new Error(`cena "${id}" tem locucao e nenhuma posicao absoluta`);
    }
    const cadenciaDaCena = entradas.cadencia.documento.cenas[id];
    const duracao = cadenciaDaCena?.duracao_s ?? entrada.duracao_s;
    spans.push({ cena: id, inicio_s: posicao, fim_s: posicao + duracao, duracao_s: duracao });
  }
  spans.sort((a, b) => a.inicio_s - b.inicio_s || (a.cena < b.cena ? -1 : 1));

  for (let i = 1; i < spans.length; i++) {
    const anterior = spans[i - 1]!;
    const atual = spans[i]!;
    if (anterior.fim_s > atual.inicio_s + SOBREPOSICAO_RESIDUAL_MAXIMA_S) {
      spans[i - 1] = { ...anterior, fim_s: atual.inicio_s };
    }
  }
  return spans;
}

// ─── O oraculo ────────────────────────────────────────────────────────────────

/**
 * Verifica o mix contra os inputs e mede nos bytes. Problemas vazio =
 * VERDE; qualquer problema e VERMELHO, com a regra e o trecho nomeados.
 */
export async function verificarMix(
  entradas: EntradasDoMix,
  mix: ResultadoDoMix,
): Promise<ResultadoDaVerificacao> {
  const problemas: string[] = [];
  const doc: MixDocument = mix.documento;

  // V1 — forma e coerencia com os bytes.
  if (doc.schema_version !== FORMATO_MIX) {
    problemas.push(
      `V1: schema_version "${String(doc.schema_version)}" — esperado ${FORMATO_MIX}`,
    );
  }
  const master = lerWavPcm(mix.bytes);
  if (master.rate !== doc.rate || master.canais !== doc.canais) {
    problemas.push(
      `V1: bytes do master ${master.rate} Hz/${master.canais} canais, ` +
        `documento declara ${doc.rate}/${doc.canais}`,
    );
  }
  if (doc.unidade !== "segundos") {
    problemas.push(`V1: unidade "${String(doc.unidade)}" — contrato exige segundos`);
  }

  // Derivacoes de contrato (V7/V8) — fala + musica com envelope.
  const ref = await derivarComponentes(entradas, { aplicarEnvelope: true });
  const esperado = await derivarComponentes(entradas, { aplicarEnvelope: false });
  const rate = ref.rate;

  // V8 — os bytes do mix batem com a derivacao de contrato.
  const mixEsperado = somar(ref.fala, ref.musica);
  const primeiro = primeiraDivergencia(mix.pcm, mixEsperado);
  if (primeiro !== null) {
    problemas.push(
      `V8: bytes do mix divergem da derivacao de contrato em t=${primeiro.toFixed(3)}s ` +
        "(fala + musica com envelope) — o mix nao e o que os inputs mandam",
    );
  }

  // V2/V3 — colocacao rededuzida dos inputs e sobreposicao residual.
  const esperados = spansEsperados(entradas);
  const faixas = doc.faixas.locucao;
  for (const s of esperados) {
    const faixa = faixas.find((f) => f.cena === s.cena);
    if (faixa === undefined) {
      problemas.push(`V2: cena "${s.cena}" sem faixa de locucao no documento`);
      continue;
    }
    if (Math.abs(faixa.inicio_s - s.inicio_s) > 2 / rate) {
      problemas.push(
        `V2: cena "${s.cena}" comeca em ${faixa.inicio_s}s no documento; ` +
          `a rededucao dos inputs da ${s.inicio_s}s (inicio absoluto da cena, AB-520)`,
      );
    }
    if (Math.abs(faixa.fim_s - s.fim_s) > 2 / rate) {
      problemas.push(
        `V2: cena "${s.cena}" termina em ${faixa.fim_s}s no documento; ` +
          `a rededucao da ${s.fim_s}s — a cauda da anterior e cortada no ` +
          "inicio da cena posterior (C1)",
      );
    }
  }

  let sobreposicaoMaxima = 0;
  for (let i = 0; i < faixas.length; i++) {
    for (let j = i + 1; j < faixas.length; j++) {
      const a = faixas[i]!;
      const b = faixas[j]!;
      const inicio = Math.max(a.inicio_s, b.inicio_s);
      const fim = Math.min(a.fim_s, b.fim_s);
      const sobreposicao = Math.max(0, fim - inicio);
      if (sobreposicao > LIMIAR_SOBREPOSICAO_S + EPS_S) {
        problemas.push(
          `V3: sobreposicao de fala de ${sobreposicao.toFixed(3)}s entre ` +
            `"${a.cena}" e "${b.cena}" (${inicio.toFixed(3)}..${fim.toFixed(3)}s) — ` +
            `acima de ${LIMIAR_SOBREPOSICAO_S}s (C1 item 4)`,
        );
      }
      sobreposicaoMaxima = Math.max(sobreposicaoMaxima, sobreposicao);
    }
  }

  // V4 — emenda enderecada por conteudo (C3).
  for (const faixa of faixas) {
    const entrada = entradas.timing.cenas[faixa.cena];
    if (entrada === undefined || entrada.estado !== "locucao") {
      problemas.push(`V4: faixa de "${faixa.cena}" sem entrada de locucao no timing`);
      continue;
    }
    const regioes = entradas.cadencia.cortes[faixa.cena] ?? [];
    const bytesFonte = await entradas.carregarBytes(faixa.fonte_hash);
    if (bytesFonte === null) {
      problemas.push(
        `V4: cena "${faixa.cena}": bytes da fonte ${faixa.fonte_hash.slice(0, 12)}… ausentes`,
      );
      continue;
    }
    if (regioes.length > 0) {
      if (faixa.emenda_hash === faixa.fonte_hash) {
        problemas.push(
          `V4: cena "${faixa.cena}": a emenda e enderecada pelo hash do ` +
            "audio-FONTE — a emenda tratada como se fosse a fonte e o " +
            "falso-verde que o ∅-crit persegue (C3)",
        );
      }
      const bytesEmenda = await entradas.carregarBytes(faixa.emenda_hash);
      if (bytesEmenda === null) {
        problemas.push(
          `V4: cena "${faixa.cena}": a emenda ${faixa.emenda_hash.slice(0, 12)}… ` +
            "nao e enderecavel — bytes novos nao publicados (C3)",
        );
      } else {
        const duracaoDeclarada = entradas.cadencia.documento.cenas[faixa.cena]?.duracao_s;
        const esperada = emendar(bytesFonte, entrada, regioes, 16, duracaoDeclarada).bytes;
        if (!bytesEmenda.equals(esperada)) {
          problemas.push(
            `V4: cena "${faixa.cena}": os bytes da emenda enderecada nao sao ` +
              "a fonte menos os cortes da cadencia — emenda mentirosa (C3)",
          );
        }
      }
    }
  }

  // V5 — presenca de fala (∅-crit original), medida nos bytes.
  const medicoes: MedicaoDeCena[] = [];
  for (const s of esperados) {
    const faixa = faixas.find((f) => f.cena === s.cena);
    if (faixa === undefined) continue;
    const a = faixa.inicio_s;
    const b = faixa.fim_s;

    const rmsFala = rms(ref.fala, a, b);
    const difereSemFala = regiaoDifere(mix.pcm, ref.musica, a, b, rate);
    if (!difereSemFala || rmsFala < PISO_RMS_FALA) {
      problemas.push(
        `V5: cena "${s.cena}" (${a.toFixed(3)}..${b.toFixed(3)}s): mix sem ` +
          `locucao — rms da fala ${rmsFala.toFixed(5)} (piso ${PISO_RMS_FALA}) ` +
          "e os bytes nao diferem da derivacao sem fala",
      );
    }

    // V7 — cobertura: o envelope aplicado onde a fala existe, MEDIDO NOS
    // BYTES do mix: o mix produzido tem de diferir do mix sem envelope
    // dentro do intervalo (se sao iguais, o ducking nao aconteceu).
    const rmsMusicaCom = rms(ref.musica, a, b);
    const rmsMusicaCrua = rms(esperado.musica, a, b);
    const atenuacaoMedida =
      rmsMusicaCrua > 0
        ? 20 * Math.log10(rmsMusicaCom / rmsMusicaCrua)
        : -Infinity;
    const atenuacaoDeclarada = mediaDoGanho(
      (t) => ganhoAplicado(t, entradas.envelope, ref.spans),
      a,
      b,
      rate,
    );
    const margemFalaMusica =
      rmsMusicaCom > 0 ? 20 * Math.log10(rmsFala / rmsMusicaCom) : Infinity;

    const mixSemEnvelope = somar(ref.fala, esperado.musica);
    const envelopeDifere = regiaoDifere(mix.pcm, mixSemEnvelope, a, b, rate);
    if (!envelopeDifere) {
      problemas.push(
        `V7: cena "${s.cena}": o envelope NAO tem efeito onde a fala existe ` +
          `(${a.toFixed(3)}..${b.toFixed(3)}s) — a musica cobre a locucao`,
      );
    }
    if (atenuacaoMedida > ATENUACAO_MINIMA_DB) {
      problemas.push(
        `V7: cena "${s.cena}": atenuacao medida ${atenuacaoMedida.toFixed(1)} dB ` +
          `(declarada ${atenuacaoDeclarada.toFixed(1)} dB) acima do piso ` +
          `${ATENUACAO_MINIMA_DB} dB — ducking ausente ou insuficiente`,
      );
    }
    if (Math.abs(atenuacaoMedida - atenuacaoDeclarada) > TOLERANCIA_ATENUACAO_DB) {
      problemas.push(
        `V7: cena "${s.cena}": atenuacao medida ${atenuacaoMedida.toFixed(1)} dB ` +
          `divergente da declarada ${atenuacaoDeclarada.toFixed(1)} dB ` +
          `(tolerancia ${TOLERANCIA_ATENUACAO_DB} dB)`,
      );
    }
    if (margemFalaMusica < MARGEM_FALA_MUSICA_MINIMA_DB) {
      problemas.push(
        `V7: cena "${s.cena}": margem fala/musica ${margemFalaMusica.toFixed(1)} dB ` +
          `abaixo de ${MARGEM_FALA_MUSICA_MINIMA_DB} dB — a musica cobre a locucao`,
      );
    }

    medicoes.push({
      cena: s.cena,
      inicio_s: a,
      fim_s: b,
      duracaoFala_s: b - a,
      rmsFala,
      atenuacaoDeclarada_db: atenuacaoDeclarada,
      atenuacaoMedida_db: atenuacaoMedida,
      margemFalaMusica_db: margemFalaMusica,
    });
  }

  if (faixas.length === 0) {
    problemas.push(
      "V5: o mix nao tem NENHUMA faixa de locucao — um mix sem locucao e VERMELHO " +
        "(∅-crit do card)",
    );
  }

  // V6 — clip medido nos bytes (adversarial 1).
  const pico = picoAbsoluto(mix.pcm);
  if (pico > 1.0) {
    problemas.push(
      `V6: o mix clipa — pico ${pico.toFixed(3)} > 1.0 (0 dBFS). ` +
        "A soma das faixas estoura o teto (adversarial 1)",
    );
  }

  return {
    problemas,
    medicoes: {
      picoAbsoluto: pico,
      sobreposicaoMaxima_s: sobreposicaoMaxima,
      cenas: Object.freeze(medicoes),
    },
  };
}

// ─── Helpers de medicao ────────────────────────────────────────────────────────

/** O primeiro instante em que dois PCM divergem; null = identicos. */
function primeiraDivergencia(
  a: { amostras: Float32Array; rate: number; canais: number },
  b: { amostras: Float32Array; rate: number; canais: number },
): number | null {
  const n = Math.max(a.amostras.length, b.amostras.length);
  for (let i = 0; i < n; i++) {
    if ((a.amostras[i] ?? 0) !== (b.amostras[i] ?? 0)) {
      return i / Math.max(1, a.canais || b.canais) / Math.max(1, a.rate || b.rate);
    }
  }
  return null;
}

/** Ha amostra divergente entre dois PCM dentro da regiao [a, b]? */
function regiaoDifere(
  a: { amostras: Float32Array; rate: number; canais: number },
  b: { amostras: Float32Array; rate: number; canais: number },
  aS: number,
  bS: number,
  rate: number,
): boolean {
  const inicio = Math.max(0, Math.floor(aS * rate)) * Math.max(1, a.canais);
  const fim = Math.min(
    a.amostras.length,
    Math.ceil(bS * rate) * Math.max(1, a.canais),
  );
  for (let i = inicio; i < fim; i++) {
    if ((a.amostras[i] ?? 0) !== (b.amostras[i] ?? 0)) return true;
  }
  return false;
}

/** Media (em dB) do ganho declarado sobre o intervalo, amostra a amostra. */
function mediaDoGanho(
  ganhoDb: (t: number) => number,
  aS: number,
  bS: number,
  rate: number,
): number {
  const inicio = Math.floor(aS * rate);
  const fim = Math.ceil(bS * rate);
  const n = Math.max(1, fim - inicio);
  let soma = 0;
  for (let f = inicio; f < fim; f++) {
    soma += ganhoDb(f / rate);
  }
  return soma / n;
}

