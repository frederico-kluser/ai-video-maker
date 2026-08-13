/**
 * src/autoria/reparo/reparar.ts
 *
 * A camada de validacao e reparo da saida do LLM de autoria (F4-03, W6),
 * sobre o documento que a chamada devolveu (Autoria.1 — schema real de
 * F4-01). Contrato-w6 §3, congelado:
 *
 *   - documento sem desvios => passa sem tocar em nada;
 *   - REPARAVEL = FORMA: espaco, escape, case de enum, ordem, duplicata;
 *   - REJEICAO DEFINITIVA = SEMANTICA: o documento e rejeitado, nunca
 *     "melhorado" ate passar. A classificacao roda ANTES de qualquer
 *     tentativa; violacao semantica surgida no meio do loop tambem e
 *     rejeicao imediata (um reparo que resolve semantica seria o LLM
 *     decidindo duas vezes);
 *   - TRES tentativas com simplificacao progressiva e depois rejeicao: a
 *     cada tentativa o erro do validador volta com o caminho JSON dos
 *     campos que falharam; a simplificacao reduz o ESCOPO DO PEDIDO de
 *     reparo (o formato do pedido, nunca o documento): T1 (tudo) ->
 *     T2 (espaco/escape/case) -> T3 (case);
 *   - o erro final NOMEIA a regra que falhou, com o caminho JSON — nunca
 *     so "invalido".
 *
 * A autoridade de decisao e a classificacao (classificar.ts), que combina
 * o validador Ajv do schema (mesmo arquivo e opcoes do validar.ts de
 * F4-01) com a varredura estrutural das regras que o schema nao expressa
 * (AB-432/433, vocabularios fechados, ids duplicados, referencia
 * inexistente). Isso importa em dois casos que o schema sozinho deixaria
 * passar: texto_alternativo so com brancos e referencia a id inexistente
 * sao semanticamente invalidos (AB-433) mesmo validando no Ajv — sao
 * REJEITADOS, nunca "melhorados" ate passar.
 *
 * O reparador e injetavel na assinatura (documento, pedido) => documento:
 * o default e o reparadorMecanico (deterministico, forma-only por
 * construcao); o F4-04/F5-07 pode injetar um reparador de chamada LLM na
 * mesma costura — a camada o protege reclassificando a cada tentativa.
 */

import type { DocumentoAutoria } from "../contrato/contrato.js";
import { classificarDesvios, temIrreparavel, type Desvio } from "./classificar.js";
import { ErroReparoAutoria } from "./erros.js";
import { reparadorMecanico } from "./reparador-mecanico.js";

export { ErroReparoAutoria } from "./erros.js";

/** Numero de tentativas do contrato: tres. */
export const MAX_TENTATIVAS = 3;

/** As cinco categorias de FORMA que o reparo pode tocar (contrato-w6 §3). */
export interface EscopoReparo {
  espaco: boolean;
  escape: boolean;
  case: boolean;
  ordem: boolean;
  duplicata: boolean;
}

/**
 * Simplificacao progressiva: o escopo do PEDIDO encolhe a cada tentativa
 * (T1 ⊃ T2 ⊃ T3). O documento nunca e simplificado — o pedido e.
 */
export const ESCOPO_T1: EscopoReparo = {
  espaco: true, escape: true, case: true, ordem: true, duplicata: true,
};
export const ESCOPO_T2: EscopoReparo = {
  espaco: true, escape: true, case: true, ordem: false, duplicata: false,
};
export const ESCOPO_T3: EscopoReparo = {
  espaco: false, escape: false, case: true, ordem: false, duplicata: false,
};

export function escopoDaTentativa(tentativa: number): EscopoReparo {
  if (tentativa <= 1) return ESCOPO_T1;
  if (tentativa === 2) return ESCOPO_T2;
  return ESCOPO_T3;
}

/** O pedido de reparo: tentativa, escopo permitido e erros com caminho JSON. */
export interface PedidoReparo {
  tentativa: number;
  escopo: EscopoReparo;
  /** Erros do validador com o caminho JSON dos campos que falharam. */
  erros: string[];
}

export type Reparador = (documento: unknown, pedido: PedidoReparo) => unknown;

export interface ResultadoReparo {
  documento: DocumentoAutoria;
  /** false quando o documento ja valida e nada foi tocado. */
  reparado: boolean;
  /** 0 = sem reparo; caso contrario, a tentativa que validou (1..max). */
  tentativas: number;
}

export interface OpcoesReparo {
  reparador?: Reparador;
  maxTentativas?: number;
}

/** O erro do validador com caminho JSON, na forma que o reparador consome. */
function desviosParaErros(desvios: readonly Desvio[]): string[] {
  return desvios.map((d) => {
    const onde = d.caminho === "" ? "(raiz)" : d.caminho;
    return `${onde}: ${d.regra}${d.detalhe === undefined ? "" : ` (${d.detalhe})`}`;
  });
}

function irreparaveisDe(desvios: readonly Desvio[]): Desvio[] {
  return desvios.filter((d) => d.classe === "irreparavel");
}

/**
 * Valida e repara a saida da autoria. NUNCA lanca para documento valido;
 * lanca ErroReparoAutoria (com a regra e o caminho JSON) para documento
 * irreparavel ou que esgotou as tentativas.
 */
export function repararAutoria(saida: unknown, opcoes: OpcoesReparo = {}): ResultadoReparo {
  const max = opcoes.maxTentativas ?? MAX_TENTATIVAS;
  const reparador = opcoes.reparador ?? reparadorMecanico;

  let atual = saida;
  let desvios = classificarDesvios(atual);
  // ∅-crit (contrato-w6 §3): irreparavel e REJEITADO antes de qualquer
  // tentativa — o reparador nunca e invocado para semantica.
  const iniciais = irreparaveisDe(desvios);
  if (iniciais.length > 0) throw new ErroReparoAutoria(iniciais);
  if (desvios.length === 0) {
    return { documento: saida as DocumentoAutoria, reparado: false, tentativas: 0 };
  }

  let erros = desviosParaErros(desvios);
  for (let tentativa = 1; tentativa <= max; tentativa++) {
    const pedido: PedidoReparo = { tentativa, escopo: escopoDaTentativa(tentativa), erros };
    const reparado = reparador(atual, pedido);
    desvios = classificarDesvios(reparado);
    // Semantica surgida no meio do loop: rejeicao imediata — nao ha o
    // que reparar (o reparo so toca forma) e tentativa extra seria
    // "melhorar" um documento que nao pode passar.
    const noLoop = irreparaveisDe(desvios);
    if (noLoop.length > 0) throw new ErroReparoAutoria(noLoop);
    if (desvios.length === 0) {
      return { documento: reparado as DocumentoAutoria, reparado: true, tentativas: tentativa };
    }
    atual = reparado;
    erros = desviosParaErros(desvios);
  }

  // Esgotadas as tentativas: rejeicao definitiva nomeando a regra que
  // ainda falha (a classificacao final cobre tambem as de forma que o
  // reparador nao conseguiu sanar).
  throw new ErroReparoAutoria(classificarDesvios(atual), "tentativas_esgotadas");
}
