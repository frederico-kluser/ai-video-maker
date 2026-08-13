/**
 * src/resolucao/midia/adaptadores.ts
 *
 * Quem SABE baixar. A barreira da decisao de hotlink mora aqui, e ela
 * nao e um `if`: e a ausencia de codigo.
 *
 * `POLITICAS_DE_PROVEDOR` (politicas.ts) diz o que os termos de cada
 * provedor exigem. Esta lista diz de quem existe implementacao. A
 * invariante que amarra as duas — "provedor que EXIGE hotlink nao tem
 * adaptador" — e verificavel por uma funcao, e o teste a executa sobre
 * a tabela inteira.
 *
 * A invariante e UNIVERSAL, nunca sobre a lista fechada: ela diz "para
 * TODO provedor que exige hotlink, nao ha adaptador", nao "existem
 * exatamente cinco provedores". A primeira continua verdadeira quando
 * alguem acrescenta a sexta entrada; a segunda vira falsa em silencio.
 */

import { adaptadorCommons } from "./commons.js";
import {
  EProvedorSemAdaptador,
  POLITICAS_DE_PROVEDOR,
  ehElegivel,
  exigirProvedorElegivel,
} from "./politicas.js";
import type { AdaptadorProvedor, PoliticaDeProvedor } from "./politicas.js";

/** Adaptadores implementados. So provedor elegivel pode aparecer aqui. */
export const ADAPTADORES: readonly AdaptadorProvedor[] = [adaptadorCommons];

/** Adaptador de um provedor, ou `undefined` se nao ha. */
export function adaptadorDe(provedor: string): AdaptadorProvedor | undefined {
  return ADAPTADORES.find((a) => a.provedor === provedor);
}

/**
 * Provedores que exigem hotlink E tem adaptador — a violacao da decisao
 * de hotlink, se algum dia existir.
 *
 * Devolve uma lista para que o teste possa exigir que ela esteja VAZIA e
 * imprimir quem a povoou. Um booleano diria "quebrou" sem dizer onde.
 */
export function violacoesDaDecisaoDeHotlink(): readonly string[] {
  return POLITICAS_DE_PROVEDOR.filter(
    (p) => !ehElegivel(p) && adaptadorDe(p.provedor) !== undefined,
  ).map(
    (p) =>
      `${p.provedor}: politicaHotlink="${p.politicaHotlink}" mas ha adaptador ` +
      `implementado — ver docs/adr/0008-hotlink-e-midia-externa.md`,
  );
}

/**
 * Resolve provedor -> (politica, adaptador), nesta ordem.
 *
 * A ordem e a decisao do card: elegibilidade PRIMEIRO, adaptador DEPOIS.
 * Invertido, um provedor que exige hotlink falharia com "sem adaptador"
 * — uma mensagem que convida a escrever o adaptador, que e exatamente a
 * coisa errada a fazer.
 */
export function selecionarAdaptador(provedor: string): {
  readonly politica: PoliticaDeProvedor;
  readonly adaptador: AdaptadorProvedor;
} {
  const politica = exigirProvedorElegivel(provedor);
  const adaptador = adaptadorDe(provedor);
  if (adaptador === undefined) {
    throw new EProvedorSemAdaptador(
      provedor,
      ADAPTADORES.map((a) => a.provedor),
    );
  }
  return { politica, adaptador };
}
