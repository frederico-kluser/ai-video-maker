/**
 * src/autoria/contrato/rejeitar.ts
 *
 * O gate de rejeicao da autoria (∅-crit do card F4-01):
 * uma saida que NAO valida contra o schema TEM de ser rejeitada ANTES de
 * tocar o pipeline — nunca "reparada", nunca encaminhada. A rejeicao e
 * lancada com o caminho JSON dos campos que falharam, para o retry poder
 * devolver o erro do validador com a localizacao exata (a skill
 * llm-authoring: devolva o erro do validador com o caminho JSON do campo
 * que falhou — sem isso voce paga tres geracoes para tentar sorte tres
 * vezes).
 */

import { validarSaidaAutoria } from "./validar.js";
import type { DocumentoAutoria } from "./contrato.js";

export class ErroContratoAutoria extends Error {
  readonly erros: string[];

  constructor(erros: string[]) {
    super(`Documento de autoria invalido (${erros.length} erro(s)):\n- ${erros.join("\n- ")}`);
    this.name = "ErroContratoAutoria";
    this.erros = erros;
  }
}

/**
 * Rejeita a saida invalida ANTES de qualquer consumidor tocar o pipeline.
 * Com saida valida, devolve a saida tipada como DocumentoAutoria (narrowing
 * via `asserts`).
 */
export function rejeitarSaidaInvalida(
  saida: unknown,
): asserts saida is DocumentoAutoria {
  const resultado = validarSaidaAutoria(saida);
  if (!resultado.valido) {
    throw new ErroContratoAutoria(resultado.erros);
  }
}
