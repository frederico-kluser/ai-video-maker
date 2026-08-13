/**
 * src/audio/mix/emenda.ts
 *
 * A EMENDA MATERIALIZADA — card F3-05 (W7), C3 (AB-617).
 *
 * A cadencia (Ritmo.1, F3-04) preserva `audio` = hash do audio-FONTE: o
 * audio EMENDADO (palavras na ordem, ligadas pelas lacunas restantes)
 * nao existia em bytes. Este modulo o materializa: os bytes da fonte
 * menos as regioes de corte que a cadencia declara. O resultado ganha
 * identidade propria — bytes + hash NOVOS, enderecaveis por conteudo
 * (SHA-256, store de F0-07) — distinta da fonte (∅-crit C3: a emenda
 * tratada como se fosse a fonte e o falso-verde perseguido).
 *
 * ─── Formato ────────────────────────────────────────────────────────────
 *
 * A emenda preserva o formato da fonte (WAV PCM s16, 16 kHz mono): a
 * emenda e uma EDICAO da fonte, nao uma reamostragem — reamostrar na
 * emenda misturaria o corte com a cadeia de resample e o hash deixaria
 * de ser "a fonte editada". A reamostragem para o master (48 kHz) e do
 * mix, que e quem soma.
 *
 * ─── Guardas ────────────────────────────────────────────────────────────
 *
 * O corte de uma palavra em silencio seria a regressao mais cara deste
 * modulo — o ∅-crit do F3-04 ja garante por construcao que as regioes
 * de corte estao inteiras dentro de lacunas DECLARADAS (Ritmo.1); este
 * modulo REDERIVA a guarda sobre a entrada (a mesma disciplina do
 * oraculo reaplicado): regiao de corte fora de silencio declarado e
 * ERRO, nunca corte silencioso.
 */

import type { IntervaloDeSilencio, PalavraCanonica, TimingCanonico } from "../../sincronia/timing/formato.js";
import { EPS_S } from "../../sincronia/timing/validar.js";
import { sha256Bytes } from "./formato.js";
import {
  EMixPcmInvalido,
  amostrasDaRegiao,
  lerWavPcm,
  escreverWavPcm,
} from "./pcm.js";
import type { Pcm } from "./pcm.js";

/** Erro de emenda que nao pode existir: corte que tocaria uma palavra. */
export class EEmendaInvalida extends Error {
  readonly code = "EMENDA_INVALIDA";
  constructor(detalhe: string) {
    super(`Emenda invalida: ${detalhe}`);
    this.name = "EEmendaInvalida";
  }
}

/**
 * Confere que cada regiao de corte esta inteira dentro de uma lacuna de
 * silencio DECLARADA e nao toca palavra nenhuma — a rededucao da guarda
 * do Ritmo.1 sobre os bytes reais (a fonte pode divergir do documento,
 * e a guarda roda no ponto de consumo).
 */
function conferirRegioes(
  cena: string,
  palavras: readonly PalavraCanonica[],
  silencio: readonly IntervaloDeSilencio[],
  regioes: readonly IntervaloDeSilencio[],
): void {
  for (const regiao of regioes) {
    const dentroDeLacuna = silencio.some(
      (l) =>
        regiao.inicio_s >= l.inicio_s - EPS_S &&
        regiao.fim_s <= l.fim_s + EPS_S,
    );
    if (!dentroDeLacuna) {
      throw new EEmendaInvalida(
        `cena "${cena}": regiao de corte ${regiao.inicio_s}..${regiao.fim_s}s ` +
          "fora de silencio DECLARADO — o corte comeria a fala",
      );
    }
    const tocaPalavra = palavras.some(
      (p) =>
        regiao.inicio_s < p.fim_s - EPS_S &&
        regiao.fim_s > p.inicio_s + EPS_S,
    );
    if (tocaPalavra) {
      throw new EEmendaInvalida(
        `cena "${cena}": regiao de corte ${regiao.inicio_s}..${regiao.fim_s}s ` +
          "toca uma palavra — o ataque de palavra nunca e comido",
      );
    }
  }
}

/**
 * Materializa a emenda de uma cena: os bytes da fonte menos as regioes
 * de corte declaradas pela cadencia.
 *
 * @param fonteBytes bytes WAV do audio-FONTE (hash do timing canonico)
 * @param entrada    a entrada da cena no timing canonico (palavras e
 *                   lacunas declaradas — a base da guarda; para cena de
 *                   locucao o oraculo C4b garante palavras nao-vazias)
 * @param regioes    as regioes de corte da cadencia (Ritmo.1), em
 *                   segundos da timeline da FONTE
 * @param bits       formato de saida (16 = s16, como a fonte)
 * @param duracaoAlvoS a duracao que a emenda TEM de ter: a declarada
 *                   pelo documento compactado da cadencia (Ritmo.1 item
 *                   5 — o corte nunca muda a duracao sem atualizar o
 *                   documento). As fronteiras de corte sao quantizadas
 *                   em amostras (floor/ceil); o ajuste final (podar ou
 *                   estender com silencio, no limite da cauda, que e
 *                   silencio declarado) materializa a duracao EXATA.
 * @returns o par { bytes, pcm } da emenda
 */
export function emendar(
  fonteBytes: Buffer,
  entrada: {
    readonly palavras?: readonly PalavraCanonica[];
    readonly silencio?: readonly IntervaloDeSilencio[];
  },
  regioes: readonly IntervaloDeSilencio[],
  bits: 16 | 32 = 16,
  duracaoAlvoS?: number,
): { bytes: Buffer; pcm: Pcm } {
  const fonte = lerWavPcm(fonteBytes);
  if (fonte.canais !== 1) {
    throw new EMixPcmInvalido(
      `fonte com ${fonte.canais} canais — a locucao e mono por contrato`,
    );
  }

  conferirRegioes(
    "(emenda)",
    entrada.palavras ?? [],
    entrada.silencio ?? [],
    regioes,
  );

  // Regioes ordenadas e disjuntas (oraculo C7b do timing + Ritmo.1).
  const ordenadas = [...regioes].sort((a, b) => a.inicio_s - b.inicio_s);
  const trechos: Pcm[] = [];
  let cursor = 0;
  for (const regiao of ordenadas) {
    const { inicio, fim } = amostrasDaRegiao(fonte, regiao.inicio_s, regiao.fim_s);
    if (inicio < cursor) {
      throw new EEmendaInvalida("regioes de corte sobrepostas");
    }
    trechos.push(recortarTrecho(fonte, cursor, inicio));
    cursor = fim;
  }
  trechos.push(
    recortarTrecho(fonte, cursor, fonte.amostras.length / fonte.canais),
  );

  const amostras = new Float32Array(
    trechos.reduce((acc, t) => acc + t.amostras.length, 0),
  );
  let pos = 0;
  for (const trecho of trechos) {
    amostras.set(trecho.amostras, pos);
    pos += trecho.amostras.length;
  }

  // Materializa a duracao DECLARADA pela cadencia: a quantizacao das
  // fronteiras em amostras desvia a duracao em ate uma amostra por corte;
  // o ajuste (na cauda, que e silencio declarado) devolve o documento a
  // verdade de Ritmo.1 item 5. Desvio alem da quantizacao e ERRO.
  if (duracaoAlvoS !== undefined) {
    const alvo = Math.round(duracaoAlvoS * fonte.rate);
    const atual = amostras.length;
    const tetoDeQuantizacao = 2 * ordenadas.length + 2;
    if (Math.abs(alvo - atual) > tetoDeQuantizacao) {
      throw new EEmendaInvalida(
        `duracao emendada ${atual} amostras vs. declarada ${alvo} ` +
          `(desvio ${alvo - atual} alem da quantizacao ${tetoDeQuantizacao})`,
      );
    }
    if (alvo !== atual) {
      const ajustadas = new Float32Array(alvo);
      ajustadas.set(amostras.subarray(0, Math.min(alvo, atual)));
      return {
        bytes: escreverWavPcm(
          { rate: fonte.rate, canais: fonte.canais, amostras: ajustadas },
          bits,
        ),
        pcm: { rate: fonte.rate, canais: fonte.canais, amostras: ajustadas },
      };
    }
  }

  const emendado: Pcm = { rate: fonte.rate, canais: fonte.canais, amostras };
  return { bytes: escreverWavPcm(emendado, bits), pcm: emendado };
}

function duracaoDaFonte(fonte: Pcm): number {
  return fonte.amostras.length / fonte.canais / fonte.rate;
}

function recortarTrecho(
  fonte: Pcm,
  inicioAmostra: number,
  fimAmostra: number,
): Pcm {
  const a = Math.max(0, inicioAmostra);
  const b = Math.min(fonte.amostras.length / fonte.canais, fimAmostra);
  const amostras = fonte.amostras.subarray(a * fonte.canais, b * fonte.canais);
  return {
    rate: fonte.rate,
    canais: fonte.canais,
    amostras: Float32Array.from(amostras),
  };
}

/** SHA-256 dos bytes da emenda — a identidade nova de C3. */
export function hashDaEmenda(bytes: Buffer): string {
  return sha256Bytes(bytes);
}

/**
 * A duracao da emenda, em segundos — a compactacao da cadencia no
 * proprio audio. Deve bater com `duracao_s` do documento compactado
 * (Ritmo.1 item 5: o corte nunca muda a duracao sem atualizar o
 * documento) dentro do arredondamento de amostra.
 */
export function duracaoDaEmenda(bytes: Buffer): number {
  return duracaoDaFonte(lerWavPcm(bytes));
}

/**
 * A posicao na timeline da FONTE de um ponto `t` da timeline EMENDADA
 * (compactada): a inversa do mapa novo(x) = x - corteAcumulado(x).
 *
 * A inversa nao e unica nos pontos de colapso (fim de regiao); o ponto
 * certo e o MAIOR ponto fixo de x = t + corteAcumulado(x) — a mesma
 * iteracao do oraculo do F3-04 (tests/sincronia/ritmo.test.ts), agora
 * como codigo de producao, porque o F3-05 usa o mapeamento para aplicar
 * o envelope onde a fala EMENDADA existe (ADR-0034, D3).
 */
export function posicaoOriginal(
  regioes: readonly IntervaloDeSilencio[],
  t: number,
): number {
  const total = regioes.reduce((acc, r) => acc + (r.fim_s - r.inicio_s), 0);
  let x = t + total;
  for (let passo = 0; passo < 64; passo++) {
    const proximo = t + corteAcumulado(regioes, x);
    if (proximo === x) return x;
    x = proximo;
  }
  throw new EEmendaInvalida(`posicaoOriginal nao convergiu para t=${t}`);
}

/** Corte acumulado antes de `t` — a funcao do mapa de compactacao. */
export function corteAcumulado(
  regioes: readonly IntervaloDeSilencio[],
  t: number,
): number {
  let total = 0;
  for (const regiao of regioes) {
    if (regiao.fim_s <= t) total += regiao.fim_s - regiao.inicio_s;
  }
  return total;
}
