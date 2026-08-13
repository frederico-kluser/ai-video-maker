/**
 * src/sincronia/ducking/calcular.ts
 *
 * O CALCULO DO ENVELOPE DE DUCKING — card F3-03 (W6).
 *
 * O envelope e CALCULADO, nunca comprimido: uma funcao pura de
 * (timing canonico + posicoes absolutas + parametros). Dois processamentos
 * sobre os mesmos bytes produzem bytes identicos — e o golden commitado
 * (tests/fixtures/ducking-canono.json) prova que a saida nao muda entre
 * versoes. Nenhum estado, nenhum relogio, nenhum compressor.
 *
 * ─── Entrada ─────────────────────────────────────────────────────────────
 *
 *   timing   — o documento canonico de F3-01, ja validado
 *              (lerTimingCanonico — o oraculo roda de novo aqui: um
 *              envelope calculado de um timing mentiroso estaria certo
 *              sobre o documento errado).
 *   posicoes — inicio absoluto de cada cena, em segundos desde o byte
 *              zero do video. A FONTE canonica e a aritmetica da
 *              composicao (F1-01/F1-12): `posicoesDaTimeline()` abaixo
 *              usa exatamente `calcularDuracao()` de src/composicao/
 *              tempo.ts — o veredito do AB-520 (contrato-w6 §2) manda o
 *              consumidor usar essa aritmetica, nunca somar duracao_s.
 *              Quem posiciona as cenas de outra forma (o F5-01, W7, no
 *              render de ponta a ponta) injeta o proprio mapa.
 *
 * ─── O que o calculo decide ──────────────────────────────────────────────
 *
 *   1. UMA fala (cena com locucao) gera UM intervalo: do inicio da
 *      primeira palavra menos a folga de entrada ate o fim da ultima
 *      palavra mais a folga de saida, com as rampas do vocabulario
 *      (parametros.ts). A atenuacao comeca ANTES da fala: o patamar ja
 *      vale com folga quando a voz comeca, e a rampa de entrada termina
 *      antes do ataque da palavra.
 *   2. Intervalos cujas rampas se tocariam ou se sobreporiam sao
 *      FUNDIDOS: dois trechos de fala colados (ou com silencio curto)
 *      produzem um patamar continuo — nunca um degrau. Lacunas maiores
 *      que a soma das rampas devolvem a musica a 0 dB entre os
 *      intervalos, sem descontinuidade.
 *   3. Cena silenciosa (estado "silencio") nao gera intervalo — a
 *      semantica de silencio e declarada no timing; aqui ela e respeitada
 *      por ausencia de atenuacao. Cena com locucao SEM posicao absoluta
 *      e erro: o envelope nao pode inventar onde a fala esta.
 *
 * ─── Fronteira de aplicacao ──────────────────────────────────────────────
 *
 * A APLICACAO do envelope no mix de audio e do F3-05 (W7) — contrato-w6
 * §4 e ADR-0012. Este arquivo entrega o DADO (calcularEnvelopeDucking) e
 * a leitura do DADO (ganhoEm, coberturaDoEnvelope); nao mixa nada.
 */

import type { Manifesto } from "../../contratos/manifesto.js";
import { calcularDuracao } from "../../composicao/tempo.js";
import { UNIDADE_SEGUNDOS } from "../timing/formato.js";
import type { TimingCanonico, EntradaDeCena } from "../timing/formato.js";
import { validarTimingCanonico } from "../timing/validar.js";
import { EPS_S } from "../timing/validar.js";
import { PARAMETROS_PADRAO } from "./parametros.js";
import type { ParametrosDoDucking } from "./parametros.js";
import {
  FORMATO_ENVELOPE_DUCKING,
} from "./formato.js";
import type { DuckingEnvelope, IntervaloDeDucking } from "./formato.js";
import { EEnvelopeDuckingInvalido, validarEnvelopeDucking } from "./validar.js";

/** Inicio absoluto de cada cena, em segundos desde o byte zero do video. */
export type PosicoesDeCenas = ReadonlyMap<string, number>;

/** Tudo que o calculo precisa alem do timing canonico. */
export interface EntradasDoEnvelope {
  /** O timing canonico de F3-01 (ja validado por quem leu os bytes). */
  readonly timing: TimingCanonico;
  /** Mapa cena -> inicio absoluto em segundos (timeline da composicao). */
  readonly posicoes: PosicoesDeCenas;
  /** Parcial de parametros; o que faltar usa os numeros do vocabulario. */
  readonly parametros?: Partial<ParametrosDoDucking>;
}

/**
 * Calcula o envelope de ducking — funcao pura do timing e das posicoes.
 *
 * @throws EEnvelopeDuckingInvalido se o timing nao passar no oraculo,
 *   se uma cena com locucao nao tiver posicao absoluta, ou se o documento
 *   produzido nao passar no proprio oraculo.
 */
export function calcularEnvelopeDucking(
  entradas: EntradasDoEnvelope,
): DuckingEnvelope {
  const { timing, posicoes } = entradas;
  const parametros = { ...PARAMETROS_PADRAO, ...entradas.parametros };

  // O oraculo do timing roda de novo: um envelope calculado de um timing
  // mentiroso estaria certo sobre o documento errado (oraculo cego e
  // oraculo que nao existe).
  const problemasDoTiming = validarTimingCanonico(timing);
  if (problemasDoTiming.length > 0) {
    throw new EEnvelopeDuckingInvalido([
      "timing canonico invalido (o oraculo de F3-01 reprovou):",
      ...problemasDoTiming.map((p) => `  ${p}`),
    ]);
  }

  // Iteracao com ORDENACAO explicita (chaves do mapa em ordem
  // lexicografica) — determinismo; a posicao absoluta vem de quem
  // posiciona, nunca da ordem das chaves.
  const intervalos = Object.keys(timing.cenas)
    .sort()
    .flatMap((cenaId) => {
      const entrada = timing.cenas[cenaId] as EntradaDeCena;
      if (entrada.estado !== "locucao") return []; // silencio declarado: sem atenuacao
      const palavras = entrada.palavras ?? [];
      const posicao = posicoes.get(cenaId);
      if (posicao === undefined) {
        throw new EEnvelopeDuckingInvalido([
          `cena "${cenaId}" tem locucao e nenhuma posicao absoluta — o ` +
            "envelope nao pode posicionar a fala na timeline",
        ]);
      }
      if (!Number.isFinite(posicao) || posicao < -EPS_S) {
        throw new EEnvelopeDuckingInvalido([
          `cena "${cenaId}" com posicao absoluta invalida (${posicao}s)`,
        ]);
      }
      const primeira = palavras[0]!;
      const ultima = palavras[palavras.length - 1]!;
      return [
        {
          inicio_s: posicao + primeira.inicio_s - parametros.folgaEntradaS,
          fim_s: posicao + ultima.fim_s + parametros.folgaSaidaS,
          ganho_db: parametros.ganhoDb,
          rampa_entrada_s: parametros.ataqueS,
          rampa_saida_s: parametros.releaseS,
          cena: cenaId,
        },
      ];
    });

  const fundidos = fundirSemDegrau(intervalos);

  const documento: DuckingEnvelope = {
    schema_version: FORMATO_ENVELOPE_DUCKING,
    unidade: UNIDADE_SEGUNDOS,
    intervalos: fundidos,
  };

  // O oraculo do proprio documento: o calculo nao emite o que nao pode
  // existir.
  const problemas = validarEnvelopeDucking(documento);
  if (problemas.length > 0) {
    throw new EEnvelopeDuckingInvalido(problemas);
  }
  return documento;
}

/** Um intervalo em construcao — mutavel, para a fusao; congelado na saida. */
interface IntervaloEmConstrucao {
  inicio_s: number;
  fim_s: number;
  ganho_db: number;
  rampa_entrada_s: number;
  rampa_saida_s: number;
  cena: string | undefined;
}

/**
 * Funde intervalos cujas rampas se tocariam ou se sobreporiam.
 *
 * Dois intervalos vizinhos produzem degrau quando a rampa de entrada do
 * segundo comeca antes de a rampa de saida do primeiro ter terminado —
 * nesse trecho o documento pediria dois ganhos ao mesmo tempo. A fusao
 * troca os dois intervalos por UM patamar continuo: rampa de entrada do
 * primeiro, patamar ate o fim da fala que termina mais tarde, rampa de
 * saida do ultimo. O resultado respeita o invariante anti-degrau do
 * oraculo (validar.ts E4) por construcao.
 */
function fundirSemDegrau(
  intervalos: readonly IntervaloEmConstrucao[],
): readonly IntervaloDeDucking[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio_s - b.inicio_s);
  const resultado: IntervaloEmConstrucao[] = [];

  for (const atual of ordenados) {
    const anterior = resultado[resultado.length - 1];
    if (anterior === undefined) {
      resultado.push({ ...atual });
      continue;
    }
    const inicioRampaAtual = atual.inicio_s - atual.rampa_entrada_s;
    const fimRampaAnterior = anterior.fim_s + anterior.rampa_saida_s;
    if (inicioRampaAtual <= fimRampaAnterior + EPS_S) {
      // Colados: fundir. O patamar vai ate a fala que termina mais
      // tarde; a rampa de saida e a do intervalo que termina depois.
      if (atual.fim_s > anterior.fim_s) {
        anterior.fim_s = atual.fim_s;
        anterior.rampa_saida_s = atual.rampa_saida_s;
      }
      continue;
    }
    resultado.push({ ...atual });
  }

  return Object.freeze(
    resultado.map((r) => ({
      inicio_s: r.inicio_s,
      fim_s: r.fim_s,
      ganho_db: r.ganho_db,
      rampa_entrada_s: r.rampa_entrada_s,
      rampa_saida_s: r.rampa_saida_s,
      ...(r.cena === undefined ? {} : { cena: r.cena }),
    })),
  );
}

/**
 * As posicoes absolutas das cenas pela aritmetica da composicao (F1-01 /
 * F1-12): `calcularDuracao(manifesto).timeline` em frames, convertidos
 * para SEGUNDOS pelo fps do manifesto. E a resposta do AB-520: quem
 * consome usa esta aritmetica, nunca soma de duracao_s.
 */
export function posicoesDaTimeline(manifesto: Manifesto): PosicoesDeCenas {
  const duracao = calcularDuracao(manifesto);
  return new Map(
    duracao.timeline.map((t) => [t.cenaId, t.frameInicial / manifesto.fps]),
  );
}

/**
 * O ganho da trilha no instante t, em dB — a leitura do envelope como
 * funcao do tempo. 0 = sem atenuacao; negativo = atenuado. Definido para
 * qualquer t real (antes do video, entre intervalos, depois).
 *
 * A APLICACAO disso no mix (converter dB em amplitude e somar as faixas)
 * e do F3-05 (W7).
 */
export function ganhoEm(envelope: DuckingEnvelope, t: number): number {
  for (const intervalo of envelope.intervalos) {
    const inicioRampa = intervalo.inicio_s - intervalo.rampa_entrada_s;
    if (t >= inicioRampa && t <= intervalo.inicio_s) {
      // Rampa de entrada: linear de 0 ate ganho_db.
      const progresso = (t - inicioRampa) / intervalo.rampa_entrada_s;
      return intervalo.ganho_db * progresso;
    }
    if (t > intervalo.inicio_s && t <= intervalo.fim_s) {
      // Patamar constante.
      return intervalo.ganho_db;
    }
    const fimRampa = intervalo.fim_s + intervalo.rampa_saida_s;
    if (t > intervalo.fim_s && t <= fimRampa) {
      // Rampa de saida: linear de ganho_db ate 0.
      const progresso = (t - intervalo.fim_s) / intervalo.rampa_saida_s;
      return intervalo.ganho_db * (1 - progresso);
    }
  }
  return 0;
}

/**
 * A sonda negativa do ∅-crit: lista as palavras do timing que ficaram
 * SEM atenuacao no envelope. Vazia = toda a locucao coberta. Uma palavra
 * esta coberta quando existe intervalo cujo patamar (ganho < 0) contem o
 * trecho absoluto da palavra — a rampa sozinha nao cobre.
 *
 * E uma assercao de PRESENCA sobre o contrato de entrada (o timing de
 * F3-01, congelado): pergunta da onda — nunca uma lista fechada de cenas
 * ou de intervalos.
 */
export function coberturaDoEnvelope(
  envelope: DuckingEnvelope,
  timing: TimingCanonico,
  posicoes: PosicoesDeCenas,
): string[] {
  const descobertas: string[] = [];

  for (const cenaId of Object.keys(timing.cenas).sort()) {
    const entrada = timing.cenas[cenaId] as EntradaDeCena;
    if (entrada.estado !== "locucao") continue;
    const posicao = posicoes.get(cenaId);
    if (posicao === undefined) {
      descobertas.push(`cena "${cenaId}": sem posicao absoluta — fala nao posicionada`);
      continue;
    }
    for (const palavra of entrada.palavras ?? []) {
      const inicioAbs = posicao + palavra.inicio_s;
      const fimAbs = posicao + palavra.fim_s;
      const coberta = envelope.intervalos.some(
        (iv) =>
          iv.ganho_db < 0 &&
          iv.inicio_s <= inicioAbs + EPS_S &&
          fimAbs <= iv.fim_s + EPS_S,
      );
      if (!coberta) {
        descobertas.push(
          `cena "${cenaId}", palavra "${palavra.texto}" ` +
            `(${inicioAbs}s..${fimAbs}s absolutos) sem atenuacao`,
        );
      }
    }
  }

  return descobertas;
}
