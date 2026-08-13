/**
 * src/sincronia/ducking/parametros.ts
 *
 * OS NUMEROS DO ENVELOPE DE DUCKING — card F3-03 (W6).
 *
 * O vocabulario (docs/vocabulario.md, "ducking") fixa o exemplo de
 * referencia: locucao reduz o ganho da musica em -12 dB, com ataque de
 * 100 ms antes do inicio da fala e release de 200 ms apos o fim. Estes
 * sao os numeros DESTE arquivo, exportados como constantes — o contrato
 * congelado (docs/contrato-w6.md §4) exige que o envelope carregue as
 * rampas e a folga DECLARADAS nos proprios intervalos, e o F3-05 (W7)
 * consome os campos, nao estes numeros.
 *
 * ─── Por que aqui e nao em src/design/tokens.ts ─────────────────────────
 *
 * tokens.ts e o S-5 (dono unico por onda, alteracao recaptura snapshots).
 * Este card nao tem autorizacao de toca-lo; a migracao dos numeros para o
 * sistema de tokens fica registrada em AB-601. O golden byte a byte do
 * envelope pina estes valores: mudar um numero AQUI muda os bytes do
 * envelope e o golden fica VERMELHO ate regeneracao explicita
 * (`just ducking-gravar`).
 *
 * Unidade: SEGUNDOS, coerente com o timing canonico (contrato-w6 §2).
 */

/** Attenuacao da trilha durante a locucao, em dB (negativa = reducao). */
export const DUCKING_GANHO_DB = -12;

/**
 * Folga de entrada, em segundos: o intervalo de ganho constante comeca
 * `DUCKING_FOLGA_ENTRADA_S` antes da primeira palavra da fala. E a "folga
 * declarada" do contrato — a atenuacao (o patamar, nao so a rampa) ja
 * vale antes de a voz comecar, e o ataque da palavra cai em cima de
 * atenuacao plena.
 */
export const DUCKING_FOLGA_ENTRADA_S = 0.1;

/**
 * Rampa de entrada (ataque), em segundos: transicao linear de 0 dB ate
 * `DUCKING_GANHO_DB`, ocupando `[inicio_s - DUCKING_ATAQUE_S, inicio_s]`
 * do intervalo. A rampa TERMINA antes do inicio da fala — a curva de
 * ataque cobre o ataque da palavra.
 */
export const DUCKING_ATAQUE_S = 0.1;

/**
 * Folga de saida, em segundos: o patamar de ganho termina
 * `DUCKING_FOLGA_SAIDA_S` depois da ultima palavra da fala.
 */
export const DUCKING_FOLGA_SAIDA_S = 0.2;

/**
 * Rampa de saida (release), em segundos: transicao linear de
 * `DUCKING_GANHO_DB` ate 0 dB, ocupando
 * `[fim_s, fim_s + DUCKING_RELEASE_S]` do intervalo.
 */
export const DUCKING_RELEASE_S = 0.2;

/** Os parametros do envelope, como configuracao explicita e tipada. */
export interface ParametrosDoDucking {
  /** Atenuacao durante a fala, em dB (negativa). */
  readonly ganhoDb: number;
  /** Folga entre o inicio do patamar e a primeira palavra, em segundos. */
  readonly folgaEntradaS: number;
  /** Rampa de entrada, em segundos. */
  readonly ataqueS: number;
  /** Folga entre a ultima palavra e o fim do patamar, em segundos. */
  readonly folgaSaidaS: number;
  /** Rampa de saida, em segundos. */
  readonly releaseS: number;
}

/** Os numeros do vocabulario, como objeto imutavel. */
export const PARAMETROS_PADRAO: Readonly<ParametrosDoDucking> = Object.freeze({
  ganhoDb: DUCKING_GANHO_DB,
  folgaEntradaS: DUCKING_FOLGA_ENTRADA_S,
  ataqueS: DUCKING_ATAQUE_S,
  folgaSaidaS: DUCKING_FOLGA_SAIDA_S,
  releaseS: DUCKING_RELEASE_S,
});
