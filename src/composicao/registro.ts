// =============================================================================
// REGISTRO DE NOS — espelho SEM DISCO do que a descoberta acha no disco
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// Por que existe, se AGENTS.md (Regra 6) proibe registro central:
//
//   O bundle de render (Remotion/webpack, e o navegador do render) nao tem
//   `node:fs`. Se a raiz importasse `descoberta.ts`, o render quebraria.
//   A VERDADE CONTINUA SENDO O DISCO: este arquivo e um ESPELHO, e o gate
//   `just comp-unicidade` reprova se ele divergir do que a descoberta acha.
//   Divergir aqui e vermelho, nao "so um esquecimento".
//
// Ver docs/adr/0006-composicao-raiz.md.
// =============================================================================

import {
  validarMeta,
  type NoComponent,
  type NoComponentMeta,
} from "./contrato-de-no";

import cabecalho, { meta as metaCabecalho } from "./nos/cabecalho";
import codigo, { meta as metaCodigo } from "./nos/codigo";
import grafico, { meta as metaGrafico } from "./nos/grafico";
import lista, { meta as metaLista } from "./nos/lista";
import midia, { meta as metaMidia } from "./nos/midia";
import texto, { meta as metaTexto } from "./nos/texto";

/** Um no disponivel para render. */
export interface EntradaDeRegistro {
  meta: NoComponentMeta;
  componente: NoComponent;
}

/** Registro imutavel, indexado por tipo de no. */
export type RegistroDeNos = ReadonlyMap<string, EntradaDeRegistro>;

const ENTRADAS: readonly EntradaDeRegistro[] = [
  { meta: metaCabecalho, componente: cabecalho },
  { meta: metaCodigo, componente: codigo },
  { meta: metaGrafico, componente: grafico },
  { meta: metaLista, componente: lista },
  { meta: metaMidia, componente: midia },
  { meta: metaTexto, componente: texto },
];

// Autoverificacao na carga: um espelho torto e pior que espelho nenhum.
const errosDoRegistro: string[] = [];
for (const entrada of ENTRADAS) {
  errosDoRegistro.push(
    ...validarMeta(entrada.meta, entrada.meta.tipo, `registro:${entrada.meta.tipo}`),
  );
  if (typeof entrada.componente !== "function") {
    errosDoRegistro.push(`registro:${entrada.meta.tipo}: componente nao e funcao`);
  }
}
if (errosDoRegistro.length > 0) {
  throw new Error(
    `Registro de nos invalido:\n` + errosDoRegistro.map((e) => `  - ${e}`).join("\n"),
  );
}

/** Ordem deterministica por tipo — nada de iterar objeto sem ordenar. */
const ORDENADAS = [...ENTRADAS].sort((a, b) => (a.meta.tipo < b.meta.tipo ? -1 : 1));

export const REGISTRO_DE_NOS: RegistroDeNos = new Map(
  ORDENADAS.map((entrada) => [entrada.meta.tipo, entrada] as const),
);

/** Tipos disponiveis para render, em ordem deterministica. */
export function tiposRegistrados(): string[] {
  return [...REGISTRO_DE_NOS.keys()].sort();
}
