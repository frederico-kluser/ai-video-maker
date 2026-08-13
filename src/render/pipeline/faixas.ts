// =============================================================================
// PLANEJAMENTO DE FAIXAS DE FRAMES — o paralelismo do pipeline (F5-01)
// =============================================================================
//
// Um render continuo vira N faixas disjuntas que COBREM o intervalo inteiro
// sem buracos e sem sobreposicao. As regras seguem o procedimento de
// chunks do Remotion (R12-09, remotion-render-pipeline SKILL.md):
//
//   1. todo chunk tem o MESMO numero de frames, exceto o ultimo — o ultimo
//      fica com o resto (nunca com mais que o tamanho padrao);
//   2. a uniao das faixas == [0, totalFrames): um frame fora de qualquer
//      faixa e cauda preta (ou trecho perdido) no video concatenado;
//   3. nenhuma faixa vazia (inicio < fim, fim <= totalFrames).
//
// `fim` e EXCLUSIVO (a faixa cobre `[inicio, fim)`), como os frameRange do
// Remotion: o ultimo frame renderizado de uma faixa e `fim - 1` e a faixa
// seguinte comeca em `fim` — a fronteira nunca e renderizada duas vezes nem
// pulada.
//
// Funcao pura: o mesmo (totalFrames, numeroDeFaixas) produz o mesmo plano —
// e e por isso que o gate consegue reprovar o planejamento sem render.
// =============================================================================

/** Uma faixa de frames: cobre `[inicio, fim)` — fim exclusivo. */
export interface FaixaDeFrames {
  readonly inicio: number;
  readonly fim: number;
}

/** Erro de planejamento: faixas impossiveis (vazias, fora do intervalo). */
export class ErroDePlanejamento extends Error {
  readonly code = "PLANEJAMENTO_INVALIDO";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDePlanejamento";
  }
}

/**
 * Planeja `numeroDeFaixas` faixas cobrindo `[0, totalFrames)`.
 *
 * Todas as faixas tem o mesmo tamanho exceto a ultima, que fica com o
 * resto (regra R12-09). O plano e DETERMINISTICO: o mesmo par de entradas
 * devolve exatamente as mesmas faixas.
 *
 * @throws ErroDePlanejamento para entradas impossiveis (totalFrames < 1,
 *   numeroDeFaixas < 1, ou numeroDeFaixas > totalFrames — uma faixa vazia
 *   nunca e plano valido).
 */
export function planejarFaixas(
  totalFrames: number,
  numeroDeFaixas: number,
): readonly FaixaDeFrames[] {
  if (!Number.isInteger(totalFrames) || totalFrames < 1) {
    throw new ErroDePlanejamento(
      `totalFrames = ${String(totalFrames)} — esperado inteiro >= 1`,
    );
  }
  if (!Number.isInteger(numeroDeFaixas) || numeroDeFaixas < 1) {
    throw new ErroDePlanejamento(
      `numeroDeFaixas = ${String(numeroDeFaixas)} — esperado inteiro >= 1`,
    );
  }
  if (numeroDeFaixas > totalFrames) {
    throw new ErroDePlanejamento(
      `numeroDeFaixas (${String(numeroDeFaixas)}) > totalFrames ` +
        `(${String(totalFrames)}) deixaria faixa vazia — o paralelismo nao ` +
        "multiplica frames",
    );
  }

  const tamanhoPadrao = Math.ceil(totalFrames / numeroDeFaixas);
  const faixas: FaixaDeFrames[] = [];
  let inicio = 0;

  for (let i = 0; i < numeroDeFaixas; i++) {
    const fim = Math.min(inicio + tamanhoPadrao, totalFrames);
    if (fim <= inicio) {
      // Inalcancavel para entradas validas (numeroDeFaixas <= totalFrames)
      // — a guarda existe para impedir REGRESSAO do planejador.
      throw new ErroDePlanejamento(
        `faixa ${String(i)} vazia em ${String(inicio)}..${String(fim)} — ` +
          "regressao do planejador",
      );
    }
    faixas.push(Object.freeze({ inicio, fim }));
    inicio = fim;
  }

  return Object.freeze(faixas);
}

/**
 * A sonda do ∅-crit do planejador: a cobertura da uniao das faixas.
 *
 * Devolve a lista de frames NAO cobertos — vazia significa que as faixas
 * cobrem `[0, totalFrames)` sem buracos nem sobreposicao. A ausencia de
 * buracos e PRESENCA (contrato-w7 §12): a assercao e "nenhum frame fica de
 * fora", nunca "exatamente N faixas".
 */
export function coberturaDasFaixas(
  faixas: readonly FaixaDeFrames[],
  totalFrames: number,
): number[] {
  const cobertos = new Set<number>();
  for (const faixa of faixas) {
    for (let f = faixa.inicio; f < faixa.fim; f++) {
      if (f >= 0 && f < totalFrames) {
        cobertos.add(f);
      }
    }
  }
  const fora: number[] = [];
  for (let f = 0; f < totalFrames; f++) {
    if (!cobertos.has(f)) {
      fora.push(f);
    }
  }
  return fora;
}

/**
 * A sonda da regra de tamanho (R12-09): todos os chunks com o mesmo numero
 * de frames exceto o ultimo. Devolve a lista de faixas que VIOLAM — vazia
 * significa plano conforme. O ultimo pode ser menor; NUNCA maior.
 */
export function violacoesDeTamanho(
  faixas: readonly FaixaDeFrames[],
): FaixaDeFrames[] {
  if (faixas.length === 0) return [];
  const tamanhos = faixas.map((f) => f.fim - f.inicio);
  const padrao = tamanhos[0]!;
  const violadoras: FaixaDeFrames[] = [];
  for (let i = 0; i < faixas.length; i++) {
    const tamanho = tamanhos[i]!;
    if (i < faixas.length - 1 && tamanho !== padrao) {
      violadoras.push(faixas[i]!);
    }
    if (i === faixas.length - 1 && tamanho > padrao) {
      violadoras.push(faixas[i]!);
    }
  }
  return violadoras;
}
