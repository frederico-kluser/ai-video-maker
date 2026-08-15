/**
 * src/roteiro/contrato/rejeitar.ts
 *
 * O gate de rejeicao do dominio de roteiro (FQ-C1): um pedaco/roteiro/
 * pedido que NAO valida tem de ser REJEITADO antes de tocar o pipeline —
 * nunca aceito em silencio, nunca "reparado". O erro e lancado com os
 * problemas nomeados (regra + caminho JSON do campo), para o retry do
 * gerador poder devolver a localizacao exata (a skill llm-authoring:
 * devolva o erro do validador com o caminho JSON do campo que falhou).
 *
 * Espelho de src/autoria/contrato/rejeitar.ts (ErroContratoAutoria).
 */

import { validarRoteiro, validarPedaco, validarBriefRoteiro } from "./validar.js";
import type { BriefRoteiro, Pedaco, Roteiro } from "./contrato.js";

export class ErroContratoRoteiro extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(`Contrato de roteiro invalido (${problemas.length} problema(s)):\n- ${problemas.join("\n- ")}`);
    this.name = "ErroContratoRoteiro";
    this.problemas = problemas;
  }
}

/** Rejeita um Roteiro invalido ANTES de qualquer consumidor tocar o pipeline. */
export function rejeitarRoteiroInvalido(valor: unknown): asserts valor is Roteiro {
  const resultado = validarRoteiro(valor);
  if (!resultado.valido) {
    throw new ErroContratoRoteiro(resultado.problemas);
  }
}

/** Rejeita um Pedaco invalido (schema + regras de narracao e anexo). */
export function rejeitarPedacoInvalido(valor: unknown): asserts valor is Pedaco {
  const resultado = validarPedaco(valor);
  if (!resultado.valido) {
    throw new ErroContratoRoteiro(resultado.problemas);
  }
}

/** Rejeita um BriefRoteiro invalido (tema ausente/vazio e erro). */
export function rejeitarBriefInvalido(valor: unknown): asserts valor is BriefRoteiro {
  const resultado = validarBriefRoteiro(valor);
  if (!resultado.valido) {
    throw new ErroContratoRoteiro(resultado.problemas);
  }
}
