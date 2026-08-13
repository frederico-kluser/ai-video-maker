/**
 * src/audio/mix/mixar.ts
 *
 * O MIX DA TRILHA COMPOSTA — card F3-05 (W7). ADR-0034.
 *
 * O mix e uma funcao pura dos contratos FECHADOS que a W7 consome:
 *
 *   timing canonico (F3-01)   — onde a fala esta e o que ela diz;
 *   envelope de ducking (F3-03) — quanto a musica cede durante a fala;
 *   cadencia / ritmo (F3-04)  — a emenda (palavras na ordem, ligadas
 *                               pelas lacunas restantes — C3/AB-617);
 *   aritmetica da composicao (F1-01) — onde cada cena COMECA (AB-520);
 *   volumes do manifesto      — o nivel de cada faixa;
 *   bytes dos assets          — a voz (store/cassete) e a trilha (F2-06).
 *
 * O que o mix DECIDE (congelado neste arquivo e no ADR-0034):
 *
 *   D2  a emenda preserva o formato da fonte (WAV s16) e ganha bytes +
 *       hash NOVOS (C3); o master e f32le estereo 48 kHz.
 *   D3  o ganho do envelope acompanha a fala EMENDADA: em cada cena o
 *       instante do master e mapeado de volta para a timeline da fonte
 *       pela inversa da compactacao da cadencia (`posicaoOriginal`) —
 *       "a atenuacao acompanha a fala, nao a janela visual" (C1 item 2);
 *       no resto (incluindo a cauda cortada da cena anterior) vale o
 *       envelope plano — a cauda removida continua coberta (C1 item 3).
 *   D4  reconciliacao por CORTE SECO: cena posterior manda; a cauda da
 *       anterior e truncada exatamente no inicio da posterior. O corte
 *       seco pode clicar (AB-662); a alternativa (fade) fica para a
 *       calibracao por escuta.
 *
 * A guarda de clip e estrutural: um mix que soma acima de 0 dBFS NAO
 * EXISTE — o construtor lanca EMixClipado (medida nos bytes f32, nunca
 * por escuta). O oraculo (`verificar.ts`) re-mede nos bytes produzidos.
 */

import type { Manifesto } from "../../contratos/manifesto.js";
import { calcularDuracao } from "../../composicao/tempo.js";
import type { DuckingEnvelope } from "../../sincronia/ducking/formato.js";
import { validarEnvelopeDucking } from "../../sincronia/ducking/validar.js";
import { ganhoEm, posicoesDaTimeline } from "../../sincronia/ducking/calcular.js";
import type { ResultadoDeCorte } from "../../sincronia/ritmo/formato.js";
import type { IntervaloDeSilencio } from "../../sincronia/timing/formato.js";
import type { EntradaDeCena, TimingCanonico } from "../../sincronia/timing/formato.js";
import { ETimingCanonicoInvalido, validarTimingCanonico } from "../../sincronia/timing/validar.js";
import { emendar, posicaoOriginal } from "./emenda.js";
import { FORMATO_MIX, sha256Bytes } from "./formato.js";
import type { FaixaLocucao, MixDocument } from "./formato.js";
import {
  EMixPcmInvalido,
  comGanho,
  conferirClip,
  escreverWavPcm,
  paraCanais,
  pcmNaDuracao,
  recortar,
  sobrepor,
  somar,
} from "./pcm.js";
import type { Pcm } from "./pcm.js";

// ─── Parametros do mix ────────────────────────────────────────────────────────

/** Taxa do master (ADR-0034, D1): padrao de video, deterministica. */
export const MIX_RATE_PADRAO = 48000;

/** Canais do master. */
export const MIX_CANAIS_PADRAO = 2;

/** Tolerancia de sobreposicao residual de fala (C1 item 4): 0,1 segundo. */
export const SOBREPOSICAO_RESIDUAL_MAXIMA_S = 0.1;

// ─── Entradas ─────────────────────────────────────────────────────────────────

/**
 * Carrega os bytes de um asset pelo hash (store de F0-07, ou o cassete
 * offline). A emenda publicada (C3) e enderecavel por este mesmo caminho.
 */
export type CarregarBytes = (hash: string) => Promise<Buffer | null>;

/**
 * Converte bytes de audio em PCM na taxa/canais do mix.
 *
 * Quem fornece e a fronteira impura (o gate, com ffmpeg pinado): o mix
 * nao reamostra — a reamostragem e da ferramenta, e o determinismo entre
 * versoes de ferramenta e declarado por pin (MixDocument.ferramentas),
 * nunca por reimplementacao. Pode ser assincrono (o ffmpeg e um
 * subprocesso); um decoder sincrono (os testes sinteticos) tambem vale.
 */
export type DecodificarPcm = (bytes: Buffer) => Promise<Pcm> | Pcm;

/** Opcoes do mix — tudo opcional; os defaults sao o contrato. */
export interface OpcoesDoMix {
  /** Taxa do master. Default: 48000. */
  readonly rate?: number;
  /** Canais do master. Default: 2. */
  readonly canais?: number;
  /** Versao do ffmpeg (pin de determinismo, registrada no documento). */
  readonly ffmpeg?: string;
  /** Versao do node (pin de determinismo, registrada no documento). */
  readonly node?: string;
  /**
   * Aplica a reconciliacao do C1 (cena posterior manda). false so existe
   * para a sonda ∅-crit do gate — o mix de producao nunca o desliga.
   */
  readonly aplicarReconciliacao?: boolean;
  /**
   * Aplica o envelope de ducking na musica. false so existe para a sonda
   * ∅-crit do gate.
   */
  readonly aplicarEnvelope?: boolean;
}

export interface EntradasDoMix {
  /** Timing canonico (F3-01) — o oraculo e reaplicado aqui. */
  readonly timing: TimingCanonico;
  /** Manifesto de autoria: fps, volumes, posicoes (aritmetica F1-01). */
  readonly manifesto: Manifesto;
  /** Envelope de ducking (F3-03) — o oraculo e reaplicado aqui. */
  readonly envelope: DuckingEnvelope;
  /** Cadencia e cortes (F3-04, Ritmo.1) — a base da emenda (C3). */
  readonly cadencia: ResultadoDeCorte;
  /** Hash da trilha de musica (resolvido: trilha_sonora do F2-06). */
  readonly musicaHash: string;
  /** Bytes por hash — voz e musica (store/cassete). */
  readonly carregarBytes: CarregarBytes;
  /** Bytes de audio -> PCM na taxa do mix (gate, ffmpeg pinado). */
  readonly decodificarPcm: DecodificarPcm;
  readonly opcoes?: OpcoesDoMix;
}

// ─── Saida ────────────────────────────────────────────────────────────────────

/** A emenda materializada de uma cena (C3) — o que o gate publica no store. */
export interface EmendaMaterializada {
  readonly cena: string;
  /** Hash do audio-FONTE (timing canonico). */
  readonly fonteHash: string;
  /** Hash dos bytes NOVOS da emenda — enderecavel por conteudo. */
  readonly emendaHash: string;
  /** Bytes WAV da emenda (formato da fonte, s16). */
  readonly bytes: Buffer;
  /** Regioes de corte aplicadas (subset das da cadencia). */
  readonly regioes: readonly IntervaloDeSilencio[];
}

/** Uma fala posicionada no master (ja reconciliada). */
export interface SpanDeFala {
  readonly cena: string;
  readonly inicio_s: number;
  readonly fim_s: number;
  /** PCM da emenda a 48 kHz, ja com o volume da cena. */
  readonly pcm: Pcm;
  /** Duracao da emenda (segundos). */
  readonly duracaoEmendada_s: number;
  /** Regioes de corte da cadencia para esta cena. */
  readonly regioes: readonly IntervaloDeSilencio[];
}

/** As faixas derivadas do mix — a base das medicoes do oraculo. */
export interface ComponentesDoMix {
  /** A faixa de fala (emendas posicionadas e reconciliadas). */
  readonly fala: Pcm;
  /** A faixa de musica (com envelope, ou sem — conforme as opcoes). */
  readonly musica: Pcm;
  /** A faixa de musica SEM envelope (volume apenas) — para medir. */
  readonly musicaCrua: Pcm;
  /** As falas posicionadas, ja reconciliadas. */
  readonly spans: readonly SpanDeFala[];
  readonly rate: number;
  readonly canais: number;
  readonly duracaoTotalS: number;
}

/** Resultado completo do mix. */
export interface ResultadoDoMix {
  /** Bytes WAV f32le do master. */
  readonly bytes: Buffer;
  /** PCM do master (a medicao roda sobre ele e sobre os bytes). */
  readonly pcm: Pcm;
  /** O documento MixDocument.1 (colocacao + pins). */
  readonly documento: MixDocument;
  /** As emendas materializadas, para o gate publicar no store (C3). */
  readonly emendas: readonly EmendaMaterializada[];
  /** As falas posicionadas no master (a base das medicoes). */
  readonly spans: readonly SpanDeFala[];
}

// ─── A derivacao de componentes ────────────────────────────────────────────────

/**
 * Deriva as faixas (fala + musica) dos inputs — a computacao de contrato.
 *
 * Separada do construtor para o ORACULO re-derivar a partir dos MESMOS
 * inputs e comparar com os bytes produzidos (verificar.ts): o mix so
 * existe se for exatamente o que os inputs mandam. Nao aplica a guarda
 * de clip (a guarda e do construtor; o oraculo mede o clip nos bytes).
 *
 * @throws ETimingCanonicoInvalido / EEnvelopeDuckingInvalido se os
 *   inputs nao passarem nos oraculos dos donos.
 */
export async function derivarComponentes(
  entradas: EntradasDoMix,
  opcoes?: OpcoesDoMix,
): Promise<ComponentesDoMix> {
  const rate = opcoes?.rate ?? entradas.opcoes?.rate ?? MIX_RATE_PADRAO;
  const canais = opcoes?.canais ?? entradas.opcoes?.canais ?? MIX_CANAIS_PADRAO;
  const aplicarReconciliacao =
    opcoes?.aplicarReconciliacao ?? entradas.opcoes?.aplicarReconciliacao ?? true;
  const aplicarEnvelope =
    opcoes?.aplicarEnvelope ?? entradas.opcoes?.aplicarEnvelope ?? true;

  // Oraculos reaplicados: o mix nunca processa o que os donos reprovam.
  const problemasTiming = validarTimingCanonico(entradas.timing);
  if (problemasTiming.length > 0) {
    throw new ETimingCanonicoInvalido("(entrada do mix)", problemasTiming);
  }
  const problemasEnvelope = validarEnvelopeDucking(entradas.envelope);
  if (problemasEnvelope.length > 0) {
    throw new Error(
      "Envelope de ducking invalido (o oraculo de F3-03 reprovou):\n" +
        problemasEnvelope.map((p) => `  - ${p}`).join("\n"),
    );
  }

  const duracao = calcularDuracao(entradas.manifesto);
  const duracaoTotalS = duracao.totalFrames / entradas.manifesto.fps;
  const posicoes = posicoesDaTimeline(entradas.manifesto);

  // 1. Emendas materializadas (C3) e spans de fala, na ordem da timeline.
  const spans: SpanDeFala[] = [];

  for (const id of Object.keys(entradas.timing.cenas).sort()) {
    const entrada = entradas.timing.cenas[id] as EntradaDeCena;
    if (entrada.estado !== "locucao") continue;

    const posicao = posicoes.get(id);
    if (posicao === undefined) {
      throw new EMixPcmInvalido(
        `cena "${id}" tem locucao e nenhuma posicao absoluta — o mix nao ` +
          "pode posicionar a fala que nao sabe onde esta (AB-520)",
      );
    }
    const fonteHash = entrada.audio!;
    const bytesFonte = await entradas.carregarBytes(fonteHash);
    if (bytesFonte === null) {
      throw new EMixPcmInvalido(
        `cena "${id}": bytes do audio-fonte ${fonteHash.slice(0, 12)}… ausentes — ` +
          "locucao sem bytes e erro, nunca silencio",
      );
    }

    const regioes = entradas.cadencia.cortes[id] ?? [];
    const duracaoDeclarada = entradas.cadencia.documento.cenas[id]?.duracao_s;
    const emenda = emendar(bytesFonte, entrada, regioes, 16, duracaoDeclarada);

    const decodificado = await entradas.decodificarPcm(emenda.bytes);
    if (decodificado.rate !== rate) {
      throw new EMixPcmInvalido(
        `decoder devolveu ${decodificado.rate} Hz, esperado ${rate} Hz ` +
          "(taxa do master) — a reamostragem e da ferramenta pinada",
      );
    }
    // A locucao e mono por contrato; o master e estereo (centro).
    const pcmEmendado = paraCanais(decodificado, canais);

    const volume = volumeDaCena(entradas.manifesto, id);
    const duracaoEmendada_s =
      pcmEmendado.amostras.length / pcmEmendado.canais / rate;
    spans.push({
      cena: id,
      inicio_s: posicao,
      fim_s: posicao + duracaoEmendada_s,
      pcm: comGanho(pcmEmendado, volume),
      duracaoEmendada_s,
      regioes,
    });
  }

  // 2. Reconciliacao C1: cena posterior manda; cauda da anterior cortada
  //    exatamente no inicio da posterior. Ordenacao explicita (inicio,
  //    depois id) — determinismo.
  const spansOrdenados = [...spans].sort(
    (a, b) => a.inicio_s - b.inicio_s || (a.cena < b.cena ? -1 : 1),
  );
  if (aplicarReconciliacao) {
    for (let i = 1; i < spansOrdenados.length; i++) {
      const anterior = spansOrdenados[i - 1]!;
      const atual = spansOrdenados[i]!;
      if (anterior.fim_s > atual.inicio_s + SOBREPOSICAO_RESIDUAL_MAXIMA_S) {
        spansOrdenados[i - 1] = { ...anterior, fim_s: atual.inicio_s };
      }
    }
  }

  // 3. A faixa de fala: cada emenda posicionada no inicio absoluto da
  //    cena, truncada no fim reconciliado.
  const silencioInicial: Pcm = {
    rate,
    canais,
    amostras: new Float32Array(Math.ceil(duracaoTotalS * rate) * canais),
  };
  let fala: Pcm = silencioInicial;
  for (const span of spansOrdenados) {
    const trecho = recortar(span.pcm, 0, Math.max(0, span.fim_s - span.inicio_s));
    fala = sobrepor(fala, trecho, Math.round(span.inicio_s * rate));
  }

  // 4. A faixa de musica com o envelope de ducking (F3-03) mapeado pela
  //    cadencia (D3): a atenuacao acompanha a fala EMENDADA.
  const bytesMusica = await entradas.carregarBytes(entradas.musicaHash);
  if (bytesMusica === null) {
    throw new EMixPcmInvalido(
      `bytes da trilha ${entradas.musicaHash.slice(0, 12)}… ausentes — ` +
        "trilha sem bytes e erro, nunca silencio",
    );
  }
  const musicaDecodificada = paraCanais(
    await entradas.decodificarPcm(bytesMusica),
    canais,
  );
  if (musicaDecodificada.rate !== rate) {
    throw new EMixPcmInvalido(
      `decoder da trilha devolveu ${musicaDecodificada.rate} Hz, esperado ${rate} Hz`,
    );
  }
  const volumeTrilha = entradas.manifesto.audio?.volume ?? 1;
  const inicioTrilhaS =
    (entradas.manifesto.audio?.inicio_frames ?? 0) / entradas.manifesto.fps;

  const musicaNaDuracao = pcmNaDuracao(musicaDecodificada, duracaoTotalS);
  const musicaCrua = comGanho(musicaNaDuracao, volumeTrilha);
  const musica = aplicarEnvelope
    ? aplicarGanhoDoEnvelope(
        musicaNaDuracao,
        rate,
        volumeTrilha,
        (t) => ganhoAplicado(t, entradas.envelope, spansOrdenados),
      )
    : musicaCrua;

  return {
    fala,
    musica: deslocar(musica, inicioTrilhaS, rate),
    musicaCrua: deslocar(musicaCrua, inicioTrilhaS, rate),
    spans: spansOrdenados,
    rate,
    canais,
    duracaoTotalS,
  };
}

// ─── O construtor ──────────────────────────────────────────────────────────────

/**
 * Constroi o mix — funcao pura (bytes in, bytes out). Determinismo:
 * iteracao ordenada, zero estado, zero relogio.
 *
 * @throws EMixClipado se a soma estourar 0 dBFS; ETimingCanonicoInvalido
 *   ou EEnvelopeDuckingInvalido se os inputs nao passarem nos oraculos.
 */
export async function mixar(entradas: EntradasDoMix): Promise<ResultadoDoMix> {
  const componentes = await derivarComponentes(entradas);

  // 5. A soma e o master. Clip e erro estrutural: medido nos bytes f32.
  const master = somar(componentes.fala, componentes.musica);
  conferirClip(master);

  const emendas: EmendaMaterializada[] = [];
  for (const span of componentes.spans) {
    const entrada = entradas.timing.cenas[span.cena] as EntradaDeCena;
    const bytesFonte = (await entradas.carregarBytes(entrada.audio!))!;
    const duracaoDeclarada = entradas.cadencia.documento.cenas[span.cena]?.duracao_s;
    const emenda = emendar(bytesFonte, entrada, span.regioes, 16, duracaoDeclarada);
    emendas.push({
      cena: span.cena,
      fonteHash: entrada.audio!,
      emendaHash: sha256Bytes(emenda.bytes),
      bytes: emenda.bytes,
      regioes: span.regioes,
    });
  }

  const documento: MixDocument = {
    schema_version: FORMATO_MIX,
    unidade: "segundos",
    rate: componentes.rate,
    canais: componentes.canais,
    duracao_s: componentes.duracaoTotalS,
    faixas: {
      locucao: componentes.spans.map(
        (s): FaixaLocucao => ({
          cena: s.cena,
          fonte_hash: entradas.timing.cenas[s.cena]!.audio!,
          emenda_hash: emendas.find((e) => e.cena === s.cena)!.emendaHash,
          volume: volumeDaCena(entradas.manifesto, s.cena),
          inicio_s: s.inicio_s,
          fim_s: s.fim_s,
        }),
      ),
      musica: {
        hash: entradas.musicaHash,
        volume: entradas.manifesto.audio?.volume ?? 1,
        inicio_s: (entradas.manifesto.audio?.inicio_frames ?? 0) / entradas.manifesto.fps,
        fim_s: componentes.duracaoTotalS,
      },
    },
    cadencia: {
      versao: entradas.cadencia.politica.versao,
      gapAlvoS: entradas.cadencia.politica.gapAlvoS,
    },
    ferramentas: {
      ffmpeg: entradas.opcoes?.ffmpeg ?? "nao-declarado",
      node: entradas.opcoes?.node ?? "nao-declarado",
    },
  };

  return {
    bytes: escreverWavPcm(master, 32),
    pcm: master,
    documento,
    emendas,
    spans: componentes.spans,
  };
}

// ─── Helpers puros ─────────────────────────────────────────────────────────────

/** O volume da locucao da cena (audio_cena.volume), 1.0 quando ausente. */
function volumeDaCena(manifesto: Manifesto, cenaId: string): number {
  const cena = manifesto.cenas.find((c) => c.id === cenaId);
  const volume = cena?.audio_cena?.volume;
  return volume === undefined ? 1 : volume;
}

/**
 * O ganho aplicado a musica no instante `t` do master, em dB.
 *
 * Dentro do span emendado de uma cena, o instante e mapeado de volta
 * para a timeline da FONTE pela inversa da compactacao (D3): a
 * atenuacao acompanha a fala emendada. Fora dos spans (incluindo a
 * cauda cortada pela reconciliacao), vale o envelope plano — a cauda
 * removida continua coberta (C1 item 3).
 */
export function ganhoAplicado(
  t: number,
  envelope: DuckingEnvelope,
  spans: readonly SpanDeFala[],
): number {
  for (const span of spans) {
    if (t >= span.inicio_s - 1e-6 && t <= span.fim_s + 1e-6) {
      const local = t - span.inicio_s;
      const fonteLocal = posicaoOriginal(span.regioes, local);
      return ganhoEm(envelope, span.inicio_s + fonteLocal);
    }
  }
  return ganhoEm(envelope, t);
}

/** Aplica o ganho (em dB, funcao do tempo) a um PCM, amostra a amostra. */
function aplicarGanhoDoEnvelope(
  pcm: Pcm,
  rate: number,
  volume: number,
  ganhoDb: (t: number) => number,
): Pcm {
  const amostras = new Float32Array(pcm.amostras.length);
  for (let f = 0; f < amostras.length / pcm.canais; f++) {
    const ganho = volume * Math.pow(10, ganhoDb(f / rate) / 20);
    for (let c = 0; c < pcm.canais; c++) {
      amostras[f * pcm.canais + c] = (pcm.amostras[f * pcm.canais + c] ?? 0) * ganho;
    }
  }
  return { rate: pcm.rate, canais: pcm.canais, amostras };
}

/** Desloca um PCM por um atraso em segundos (zeros a esquerda). */
function deslocar(pcm: Pcm, atrasoS: number, rate: number): Pcm {
  const atraso = Math.round(atrasoS * rate);
  if (atraso <= 0) return pcm;
  const amostras = new Float32Array(pcm.amostras.length + atraso * pcm.canais);
  amostras.set(pcm.amostras, atraso * pcm.canais);
  return { rate: pcm.rate, canais: pcm.canais, amostras };
}

/** O SHA-256 dos bytes do master (o artefato enderecado por conteudo). */
export function hashDosBytesDoMaster(mix: ResultadoDoMix): string {
  return sha256Bytes(mix.bytes);
}
