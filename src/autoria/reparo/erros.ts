/**
 * src/autoria/reparo/erros.ts
 *
 * O erro da REJEICAO DEFINITIVA do reparo de autoria (F4-03, W6).
 *
 * Contrato-w6 §3: "o erro final nomeia a regra que falhou. Nao e
 * 'invalido': e a regra do schema (ou do vocabulario fechado) que o
 * documento violou, com o caminho JSON." — mesma disciplina do
 * rejeitar.ts de F4-01: caminho JSON + a regra, nunca so "invalido".
 *
 * Dois motivos de rejeicao, distinguiveis pelo pipeline:
 *   - "irreparavel": violacao SEMANTICA presente no documento (antes ou
 *     entre tentativas) — o reparo so toca FORMA, e rejeicao definitiva;
 *   - "tentativas_esgotadas": tres tentativas com simplificacao
 *     progressiva terminaram sem documento valido — o reparador nao
 *     conseguiu cobrir a forma, e o erro final nomeia a regra que ainda
 *     falha.
 */

import type { Desvio } from "./classificar.js";

export type MotivoRejeicao = "irreparavel" | "tentativas_esgotadas";

export class ErroReparoAutoria extends Error {
  readonly desvios: readonly Desvio[];
  readonly motivo: MotivoRejeicao;

  constructor(desvios: readonly Desvio[], motivo: MotivoRejeicao = "irreparavel") {
    const linhas = desvios.map((d) => {
      const onde = d.caminho === "" ? "(raiz)" : d.caminho;
      return `- ${onde}: ${d.regra}${d.detalhe === undefined ? "" : ` (${d.detalhe})`}`;
    });
    super(
      `Documento de autoria IRREPARAVEL (${motivo}) — regra(s) violada(s):\n${linhas.join("\n")}`,
    );
    this.name = "ErroReparoAutoria";
    this.motivo = motivo;
    this.desvios = desvios;
  }
}
