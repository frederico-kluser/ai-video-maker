/**
 * src/sincronia/ritmo/cortar.ts
 *
 * O CORTE DE SILENCIO — a funcao pura que produz a cadencia (card F3-04,
 * onda W6). ADR-0029.
 *
 * Entrada: um documento canonico de timing VALIDO (quem le os bytes e o
 * contrato de consumo: `lerTimingCanonico()` de `src/sincronia/timing/
 * validar.ts`). Saida: `ResultadoDeCorte` com o documento compactado e as
 * regioes cortadas da timeline original.
 *
 * ─── A politica (congelada no ADR-0029) ─────────────────────────────────
 *
 *   1. De cada lacuna de silencio DECLARADA com mais de `gapAlvoS`
 *      segundos, o corte mantem os PRIMEIROS `gapAlvoS` segundos e remove
 *      o rabo — a regiao removida fica no lado da proxima palavra, nunca
 *      sobre ela.
 *   2. Lacuna com `gapAlvoS` = 0 e removida por inteiro; lacuna cujo resto
 *      ficaria menor que `EPS_S` (o piso do oraculo, `validar.ts`) nao e
 *      emitida — palavras ficam contiguas.
 *   3. Palavras sao as MESMAS: mesmo texto, mesma duracao; a posicao na
 *      nova timeline e a original menos o corte acumulado antes do inicio
 *      da palavra. O ataque de nenhuma palavra pode ser comido — por
 *      construcao (regiao de corte ⊂ lacuna declarada) e por guarda
 *      (testada, AB-615).
 *   4. Cena com `estado: "silencio"` nao tem palavra nem lacuna de
 *      locucao: o corte nao a toca (a duracao dela e da aritmetica da
 *      composicao, AB-520).
 *   5. `duracao_s` do documento compactado = original - soma dos cortes:
 *      o corte NUNCA muda a duracao sem atualizar o documento (AB-618).
 *   6. O documento compactado passa no MESMO oraculo do timing canonico:
 *      a cadencia respeita o timing canonico (AB-618) — cobertura
 *      palavras + silencio = [0, duracao_s] inclusive.
 *
 * Determinismo e idempotencia: funcao pura do (documento, alvo); aplicar
 * 2x = aplicar 1x, pois apos o corte nenhuma lacuna passa do alvo.
 */

import {
  EPS_S,
  ETimingCanonicoInvalido,
  validarTimingCanonico,
} from "../timing/validar.js";
import type {
  EntradaDeCena,
  IntervaloDeSilencio,
  PalavraCanonica,
  TimingCanonico,
} from "../timing/formato.js";
import {
  FORMATO_RITMO,
  GAP_ALVO_S,
} from "./formato.js";
import type {
  OpcoesDeCorte,
  ResultadoDeCorte,
} from "./formato.js";

// ─── Erros ─────────────────────────────────────────────────────────────────────

/** Opcoes de corte invalidas: alvo negativo ou nao-finito. */
export class ECorteInvalido extends Error {
  readonly code = "RITMO_OPCOES_INVALIDAS";
  constructor(detalhe: string) {
    super(`Opcoes de corte invalidas: ${detalhe}`);
    this.name = "ECorteInvalido";
  }
}

/**
 * Regiao de corte que tocaria uma palavra.
 *
 * Inalcancavel para documento valido por construcao (regiao ⊂ lacuna
 * declarada, lacuna ∩ palavra = ∅ pelo oraculo C7c) — e a guarda que
 * existe para impedir REGRESSAO: se a politica for editada e passar a
 * cortar para dentro de palavra, o corte para de produzir em vez de
 * comer o ataque em silencio.
 */
export class ECorteInvadePalavra extends Error {
  readonly code = "RITMO_CORTE_INVADE_PALAVRA";
  constructor(cena: string, inicio: number, fim: number) {
    super(
      `Corte da cena "${cena}" em ${inicio}..${fim}s toca uma palavra — ` +
        "regiao de corte tem de estar inteira dentro de silencio declarado",
    );
    this.name = "ECorteInvadePalavra";
  }
}

// ─── O corte ─────────────────────────────────────────────────────────────────────

/**
 * Aplica o corte de silencio ao documento canonico e devolve a cadencia.
 *
 * @param doc documento canonico de timing VALIDO (o oraculo e reaplicado:
 *   o modulo nunca processa o que o oraculo reprovar)
 * @param opcoes alvo de lacuna opcional (default: `GAP_ALVO_S`)
 */
export function cortarSilencio(
  doc: TimingCanonico,
  opcoes?: OpcoesDeCorte,
): ResultadoDeCorte {
  // O modulo nunca confia na forma da entrada: o oraculo e reaplicado
  // (o consumidor pode ter lido os bytes por um caminho sem oraculo).
  const problemas = validarTimingCanonico(doc);
  if (problemas.length > 0) {
    throw new ETimingCanonicoInvalido("(entrada do corte)", problemas);
  }

  const gapAlvo = opcoes?.gapAlvoS ?? GAP_ALVO_S;
  if (!Number.isFinite(gapAlvo) || gapAlvo < 0) {
    throw new ECorteInvalido(
      `gapAlvoS = ${String(gapAlvo)} — esperado numero finito >= 0`,
    );
  }

  const cenas: Record<string, EntradaDeCena> = {};
  const cortes: Record<string, readonly IntervaloDeSilencio[]> = {};
  for (const id of Object.keys(doc.cenas).sort()) {
    const entrada = doc.cenas[id] as EntradaDeCena;
    if (entrada.estado === "silencio") {
      // Cena silenciosa nao tem palavra a preservar nem lacuna de
      // locucao: o corte nao a toca (duracao e da composicao, AB-520).
      cenas[id] = entrada;
      cortes[id] = [];
      continue;
    }
    const resultado = cortarCenaComLocucao(id, entrada, gapAlvo);
    cenas[id] = resultado.entrada;
    cortes[id] = resultado.cortes;
  }

  const documento: TimingCanonico = { ...doc, cenas };

  // A cadencia tem de passar no MESMO oraculo — garantia do modulo, nao
  // so teste: "a cadencia respeita o timing canonico" (pergunta
  // adversarial 4 do card, AB-618).
  const saidaProblemas = validarTimingCanonico(documento);
  if (saidaProblemas.length > 0) {
    throw new ETimingCanonicoInvalido("(saida do corte)", saidaProblemas);
  }

  return {
    politica: { versao: FORMATO_RITMO, gapAlvoS: gapAlvo },
    documento,
    cortes,
  };
}

// ─── Uma cena com locucao ───────────────────────────────────────────────────────

interface CenaCortada {
  entrada: EntradaDeCena;
  cortes: readonly IntervaloDeSilencio[];
}

function cortarCenaComLocucao(
  id: string,
  entrada: EntradaDeCena,
  gapAlvo: number,
): CenaCortada {
  // O oraculo C4b garante palavras nao-vazias e C3d/C7 garantem lacunas
  // declaradas para cena de locucao.
  const palavras = entrada.palavras as readonly PalavraCanonica[];
  const silencio = entrada.silencio as readonly IntervaloDeSilencio[];

  // 1. Regioes de corte: de cada lacuna com mais de `gapAlvo`, manter os
  //    primeiros `gapAlvo` segundos e remover o rabo. Lacunas sao
  //    ordenadas e disjuntas (oraculo C7b) → regioes tambem.
  const regioes: IntervaloDeSilencio[] = [];
  for (const lacuna of silencio) {
    if (lacuna.fim_s - lacuna.inicio_s > gapAlvo + EPS_S) {
      regioes.push({
        inicio_s: lacuna.inicio_s + gapAlvo,
        fim_s: lacuna.fim_s,
      });
    }
  }

  // 2. Guarda de seguranca (∅-crit, AB-615): por construcao cada regiao
  //    esta inteira dentro de uma lacuna DECLARADA e nenhuma toca
  //    palavra. A guarda impede que uma regressao na politica corte o
  //    ataque de uma palavra em silencio.
  for (const regiao of regioes) {
    const dentroDeLacuna = silencio.some(
      (l) => regiao.inicio_s >= l.inicio_s - EPS_S && regiao.fim_s <= l.fim_s + EPS_S,
    );
    if (!dentroDeLacuna) {
      throw new ECorteInvadePalavra(id, regiao.inicio_s, regiao.fim_s);
    }
    const tocaPalavra = palavras.some(
      (p) => regiao.inicio_s < p.fim_s - EPS_S && regiao.fim_s > p.inicio_s + EPS_S,
    );
    if (tocaPalavra) {
      throw new ECorteInvadePalavra(id, regiao.inicio_s, regiao.fim_s);
    }
  }

  // 3. Mapa de compactacao: novo(t) = t - corte acumulado antes de t.
  //    E monotona, tem inclinacao 1 dentro de palavra (o ataque e a
  //    release da palavra sobrevivem inteiros) e colapsa cada regiao
  //    de corte num ponto da nova timeline.
  const corteAte = (t: number): number => {
    let total = 0;
    for (const regiao of regioes) {
      if (regiao.fim_s <= t) total += regiao.fim_s - regiao.inicio_s;
    }
    return total;
  };

  // 4. Palavras: as MESMAS, com as MESMAS duracoes — o fim e derivado do
  //    inicio compactado mais a duracao original (exata), nunca por uma
  //    segunda subtracao que pudesse arredondar diferente.
  const novasPalavras: PalavraCanonica[] = palavras.map((p) => {
    const inicio = p.inicio_s - corteAte(p.inicio_s);
    return {
      texto: p.texto,
      inicio_s: inicio,
      fim_s: inicio + (p.fim_s - p.inicio_s),
    };
  });

  // 5. Lacunas restantes: a parte mantida de cada lacuna, na nova
  //    timeline. Parte mantida menor que o piso do oraculo nao e emitida
  //    (o documento compactado tem de continuar valido — AB-618).
  const novasLacunas: IntervaloDeSilencio[] = [];
  for (const lacuna of silencio) {
    const mantida = Math.min(lacuna.fim_s - lacuna.inicio_s, gapAlvo);
    if (mantida < EPS_S) continue;
    const inicio = lacuna.inicio_s - corteAte(lacuna.inicio_s);
    novasLacunas.push({ inicio_s: inicio, fim_s: inicio + mantida });
  }

  // 6. Duracao nova: a original menos o corte total (pergunta adversarial
  //    3: o corte nunca muda a duracao sem atualizar o documento).
  const totalCorte = regioes.reduce(
    (acc, regiao) => acc + (regiao.fim_s - regiao.inicio_s),
    0,
  );

  return {
    entrada: {
      ...entrada,
      palavras: novasPalavras,
      silencio: novasLacunas,
      duracao_s: entrada.duracao_s - totalCorte,
    },
    cortes: regioes,
  };
}
