/**
 * tests/autoria/reparo/helpers.ts
 *
 * Helpers compartilhados dos testes do reparo (F4-03, W6): a base valida
 * e a funcao de mutacao. A base mora em fixtures/valido-todos-nos.json
 * (os seis tipos de no, tres cenas, transicoes e audio) e cada teste
 * deriva variantes com `mutar` — mutacoes pequenas e legiveis.
 *
 * Pergunta obrigatoria da W6 (contrato-w6 §10): as assercoes aqui sao de
 * PRESENCA do item do F4-03 (a regra que falhou, a categoria reparada) —
 * nunca listas completas de cenas/nos do mundo; os documentos de cada
 * teste sao criados por este proprio card, e nenhum irmao da W6 os toca.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Doc = Record<string, unknown>;

const AQUI = fileURLToPath(new URL(".", import.meta.url));

export function carregarBase(): Doc {
  return JSON.parse(
    readFileSync(join(AQUI, "fixtures", "valido-todos-nos.json"), "utf-8"),
  ) as Doc;
}

/** Clona a base e aplica a mutacao. */
export function mutar(mutacao: (doc: Doc) => void): Doc {
  const doc = structuredClone(carregarBase());
  mutacao(doc);
  return doc;
}
