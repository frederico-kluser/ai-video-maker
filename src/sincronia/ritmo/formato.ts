/**
 * src/sincronia/ritmo/formato.ts
 *
 * O RITMO COMO DADO — a superficie do corte de silencio e da cadencia
 * (card F3-04, onda W6). ADR-0029.
 *
 * O F3-04 consome o timing canonico (contrato-w6 §2: `lerTimingCanonico`
 * de `src/sincronia/timing/validar.ts`, unidade SEGUNDOS, silencio
 * DECLARADO) e produz a CADENCIA: um documento de timing compactado em
 * que cada lacuna de silencio declarada fica com, no maximo, `GAP_ALVO_S`
 * segundos. O documento compactado e um `TimingCanonico` VALIDO — a mesma
 * forma, o mesmo oraculo — e as regioes removidas da timeline original
 * sao declaradas em `cortes`, para quem quiser auditar que nenhuma
 * palavra foi cortada.
 *
 * ─── O que este modulo NAO e ─────────────────────────────────────────────
 *
 * O corte e um PLANO DE EDICAO, nao a edicao: este modulo nao mixa audio
 * (F3-05, W7), nao desenha video nem escreve bytes. As palavras sao as
 * MESMAS do documento de entrada — mesmos textos, mesmas duracoes; apenas
 * as lacunas de silencio encurtam e as posicoes na nova timeline deslocam.
 * Quem materializa o audio emendado (emenda = palavras na ordem, ligadas
 * pelas lacunas restantes) e o F3-05/F5-01, na W7 — ver AB-617.
 *
 * ─── Determinismo ─────────────────────────────────────────────────────────
 *
 * `cortarSilencio()` e funcao pura do documento de entrada e do alvo de
 * lacuna: dois processamentos sobre os mesmos bytes produzem bytes
 * identicos (testado), e aplicar 2x e o mesmo que aplicar 1x (idempotente
 * por construcao: apos o corte, toda lacuna tem no maximo o alvo, entao
 * nada resta para cortar).
 */

import type {
  IntervaloDeSilencio,
  TimingCanonico,
} from "../timing/formato.js";

// ─── Identidade ───────────────────────────────────────────────────────────────

/**
 * Versao da POLITICA de corte.
 *
 * A politica e funcao pura; quando ela mudar (novo alvo, nova regra de
 * borda), este numero sobe no MESMO commit — os bytes da cadencia mudam e
 * o consumidor distingue as geracoes por este campo em `ResultadoDeCorte`.
 */
export const FORMATO_RITMO = "Ritmo.1" as const;

/**
 * Alvo de lacuna entre palavras, em segundos, aplicado por default.
 *
 * Valor de politica, NAO token de design (S-5): e um parametro do corte,
 * nao um valor de layout. Depois do corte, nenhuma lacuna de uma cena com
 * locucao ultrapassa este teto. O default de 0,25 s nao comprime a
 * fixture canonica (lacunas naturais de 0,09 s) — a compressao agressiva
 * e escolha explicita de quem consome via `OpcoesDeCorte.gapAlvoS`.
 */
export const GAP_ALVO_S = 0.25;

// ─── Opcoes e resultado ─────────────────────────────────────────────────────────

/** Opcoes do corte. Tudo opcional — o default e a politica congelada. */
export interface OpcoesDeCorte {
  /**
   * Teto de lacuna, em segundos. Finito e >= 0. 0 remove toda a lacuna
   * (palavras ficam contiguas). Default: `GAP_ALVO_S`.
   */
  readonly gapAlvoS?: number;
}

/** A politica que produziu este corte, para o consumidor poder auditar. */
export interface PoliticaDeCorte {
  /** Versao da politica (`FORMATO_RITMO`). Sobe quando a politica muda. */
  readonly versao: typeof FORMATO_RITMO;
  /** O alvo de lacuna efetivamente aplicado, em segundos. */
  readonly gapAlvoS: number;
}

/**
 * Resultado do corte de silencio.
 *
 * - `documento` — a CADENCIA: um `TimingCanonico` valido (passa no MESMO
 *   oraculo de `validar.ts`), com as MESMAS palavras (texto e duracao
 *   intactos), lacunas encurtadas para no maximo `gapAlvoS` e
 *   `duracao_s` atualizado (o corte nunca muda a duracao sem atualizar o
 *   documento — AB-618).
 * - `cortes` — as regioes REMOVIDAS da timeline ORIGINAL, por cena. Cada
 *   regiao e um sub-intervalo de uma lacuna de silencio DECLARADA, nunca
 *   de uma palavra: e por elas que se prova que nenhuma palavra foi
 *   cortada (∅-crit, AB-615).
 */
export interface ResultadoDeCorte {
  readonly politica: PoliticaDeCorte;
  readonly documento: TimingCanonico;
  readonly cortes: Readonly<Record<string, readonly IntervaloDeSilencio[]>>;
}
