/**
 * src/roteiro/contrato/edicao.ts
 *
 * A APLICACAO de uma edicao do usuario sobre um pedaco — a semantica
 * congelada de "pedaco editado sobrevive": merge raso dos campos de
 * EdicaoPedaco, com as tres travas que a identidade exige:
 *
 *   1. id e indice NUNCA mudam por edicao (a posicao do pedaco no
 *      roteiro e estavel; regenerar um irmao nao renumera ninguem);
 *   2. narracao NUNCA muda por edicao (audio so muda pelos endpoints de
 *      narracao — Onda 3/4); se a edicao toca `fala`, a narracao fica
 *      "stale" por regra do contrato — SO quando havia narracao (status
 *      "vazio" nao tem audio para ficar stale); apagar a fala limpa a
 *      narracao inteira (volta a vazio — os bytes permanecem no store);
 *   3. a edicao e VALIDADA antes de aplicar (aplicarEdicaoPedacoValida):
 *      delta invalido e rejeicao nomeada, nunca merge silencioso (FQ-C1).
 *
 * O servidor da Onda 4 aplica estes deltas ao servir o roteiro e ao
 * montar o PedidoRegenerarPedaco (a edicao vira entrada da chave do
 * gerador — C12/FQ-G3).
 */

import type { EdicaoPedaco, Pedaco } from "./contrato.js";
import { validarEdicaoPedaco } from "./validar.js";
import { ErroContratoRoteiro } from "./rejeitar.js";

/**
 * Aplica um delta de edicao sobre o pedaco (merge raso; id, indice,
 * narracao e anexo intocados). Nao valida — a variante validada esta
 * abaixo.
 */
export function aplicarEdicaoPedaco(pedaco: Pedaco, edicao: EdicaoPedaco): Pedaco {
  return {
    ...pedaco,
    ...edicao,
    // As quatro travas: identidade, estado de audio e estado de ANEXO
    // nunca vêm de edicao — o anexo (anexo_hash/anexo_meta) muda somente
    // pela rota de anexo (regra edicao-anexo-proibido em validar.ts).
    id: pedaco.id,
    indice: pedaco.indice,
    narracao: pedaco.narracao,
    anexo_hash: pedaco.anexo_hash,
    anexo_meta: pedaco.anexo_meta,
  };
}

/**
 * Aplica uma edicao VALIDADA: o delta passa por validarEdicaoPedaco
 * antes do merge — edicao invalida lanca ErroContratoRoteiro (FQ-C1:
 * nunca aceita em silencio).
 */
export function aplicarEdicaoPedacoValida(
  pedaco: Pedaco,
  edicao: EdicaoPedaco,
): Pedaco {
  const resultado = validarEdicaoPedaco(edicao);
  if (!resultado.valido) {
    throw new ErroContratoRoteiro(resultado.problemas);
  }
  return aplicarEdicaoPedaco(pedaco, edicao);
}

/**
 * Marca a narracao como "editado" apos uma edicao que tocou `fala`: o
 * audio existente corresponde ao texto ANTIGO, entao `narracao.texto`
 * fica como estava e o status vira "editado" — a regra
 * status-editado-dessincronizado (texto != fala) passa a valer. Quem
 * aplica uma edicao com `fala` diferente da atual DEVE chamar isto; sem
 * a marca, o pedaco resultante violaria as regras de narracao (status
 * "gerado" com texto != fala).
 *
 * Quando a fala editada e igual a anterior (edicao de titulo, por
 * exemplo), a narracao NAO muda e nao se marca nada.
 */
export function marcarFalaEditada(pedaco: Pedaco, novaFala: string): Pedaco {
  if (novaFala === pedaco.fala) {
    return pedaco;
  }
  return {
    ...pedaco,
    fala: novaFala,
    narracao: {
      ...pedaco.narracao,
      status: "editado",
    },
  };
}

/**
 * O ciclo completo de edicao do servidor: valida o delta, aplica sobre o
 * pedaco e marca a narracao quando a fala mudou. O resultado e um Pedaco
 * que SEMPRE valida (quando o pedaco de entrada valida).
 */
export function editarPedaco(pedaco: Pedaco, edicao: EdicaoPedaco): Pedaco {
  const aplicado = aplicarEdicaoPedacoValida(pedaco, edicao);
  if (edicao.fala === undefined || edicao.fala === pedaco.fala) {
    return aplicado;
  }
  if (edicao.fala === "") {
    // Sem fala nao ha o que narrar: a narracao volta a vazio (os bytes do
    // audio antigo permanecem no store por hash — S-8; o pedaco deixa de
    // referencia-los — regra narracao-fala-vazia).
    return {
      ...aplicado,
      narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    };
  }
  // A comparacao e contra a fala ORIGINAL (a do pedaco antes do merge).
  // A fala mudou: a narracao ficou stale — MAS so quando havia narracao;
  // pedaco nunca narrado (status "vazio") nao tem audio para ficar stale
  // e permanece "vazio" (regra origem-nenhuma-com-estado). Com narracao
  // existente, o status vira "editado" e `narracao.texto` fica apontando
  // para o texto antigo (regra status-editado-dessincronizado).
  if (pedaco.narracao.status === "vazio") {
    return aplicado;
  }
  return {
    ...aplicado,
    narracao: {
      ...aplicado.narracao,
      status: "editado",
    },
  };
}
