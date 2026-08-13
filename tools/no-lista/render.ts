// =============================================================================
// F1-06 — o conteudo de um snapshot do no `lista`
// =============================================================================
// Modulo SEM efeito de importacao: quem grava e tools/no-lista/gravar.ts, quem
// compara e tests/composicao/no-lista.test.ts. Os dois passam por aqui, e e
// por isso que o que o teste compara e exatamente o que o gravador aprovou.
//
// Por caso saem DOIS arquivos:
//   <caso>.html  o markup exato que o no produz naquele frame (bytes)
//   <caso>.json  o plano de layout — grade, fonte, safe area, caixas
//
// Por que os dois: o HTML e o que vira pixel; o JSON e o que um humano
// consegue revisar num diff. Um snapshot ilegivel nao e aprovado, e tolerado.
// =============================================================================

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Lista, { planejarLista } from "../../src/composicao/nos/lista.js";
import type { CasoDeLista } from "./casos.js";

/** Markup de um caso. Funcao pura: mesmo caso, mesmos bytes. */
export function markupDoCaso(caso: CasoDeLista): string {
  return `${renderToStaticMarkup(
    createElement(Lista, {
      no: caso.no,
      frame: caso.frame,
      fps: caso.fps,
      width: caso.width,
      height: caso.height,
    }),
  )}\n`;
}

/** Plano de um caso, serializado — numeros inteiros, ordem estavel. */
export function planoDoCaso(caso: CasoDeLista): string {
  const plano = planejarLista(
    caso.no,
    caso.frame,
    caso.fps,
    caso.width,
    caso.height,
  );
  return `${JSON.stringify(plano, null, 2)}\n`;
}
