// =============================================================================
// REGISTRO DE CAMADAS — espelho estatico, sem disco
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// AGENTS.md Regra 6 pede descoberta por convencao, nunca registro central
// escrito a mao. A convencao existe e e a mesma de F1-01:
//
//   src/composicao/camadas/<nome>.tsx
//     export const meta: CamadaMeta
//     export const plano: PlanoDeCamada
//     export default: CamadaComponent
//
// A VARREDURA DO DISCO NAO PODE MORAR AQUI. `just comp-pureza` so permite
// `node:fs` em `src/composicao/descoberta.ts` — qualquer outro arquivo de
// src/composicao/ que importe disco derruba o gate. Entao a descoberta por
// disco vive no teste (tests/camadas/), que e quem precisa dela, e o caminho
// de render usa este espelho, que nao toca disco nenhum.
//
// O teste amarra os dois: todo arquivo <nome>.tsx encontrado no disco tem de
// estar aqui, com meta identico. Um arquivo que nao chega ao registro sumiria
// do video sem erro nenhum.
// =============================================================================

import type { ModuloDeCamada } from "./contrato-de-camada";
import Fundo, { meta as metaFundo, plano as planoFundo } from "./fundo";
import Grade, { meta as metaGrade, plano as planoGrade } from "./grade";
import Vinheta, { meta as metaVinheta, plano as planoVinheta } from "./vinheta";

/**
 * Ordem de composicao das camadas: fundo primeiro, sobreposicoes depois.
 * A ordem e deterministica e explicita — iterar objeto sem ordenacao e
 * proibido abaixo da fronteira de determinismo (AGENTS.md, Regra 1).
 */
export const CAMADAS: readonly ModuloDeCamada[] = Object.freeze([
  { meta: metaFundo, componente: Fundo, plano: planoFundo },
  { meta: metaGrade, componente: Grade, plano: planoGrade },
  { meta: metaVinheta, componente: Vinheta, plano: planoVinheta },
]);

/** Indexado por nome, para o teste e para o cenario de prova. */
export const CAMADA_POR_NOME: ReadonlyMap<string, ModuloDeCamada> = new Map(
  CAMADAS.map((c) => [c.meta.nome, c]),
);

/** Nomes registrados, em ordem de composicao. */
export function nomesRegistrados(): string[] {
  return CAMADAS.map((c) => c.meta.nome);
}

/** Busca uma camada pelo nome. Ausencia e erro de quem chama, nunca silencio. */
export function camadaChamada(nome: string): ModuloDeCamada {
  const achada = CAMADA_POR_NOME.get(nome);
  if (!achada) {
    throw new Error(
      `camada "${nome}" nao esta registrada em src/composicao/camadas/registro.ts ` +
        `(registradas: ${nomesRegistrados().join(", ")})`,
    );
  }
  return achada;
}
