/**
 * src/pipeline/index.ts
 *
 * Barrel do ORQUESTRADOR DE PONTA A PONTA — card F5-07 (W9, o join).
 *
 * Quem consome (F5-08/F6-01 na W10 — o golden de ponta a ponta e o
 * dossie) importa DAQUI: o orquestrador, a lista fechada do contrato e
 * a conferencia de presenca do ∅-crit.
 */

export {
  produzir,
  conferirPresenca,
  escreverAtomico,
  sha256Hex,
  parsearArgumentos,
  main,
  executorPadrao,
  ErroDoPipeline,
  PORTA_DO_PIPELINE,
  ID_DA_COMPOSICAO,
} from "./produzir.js";
export type {
  OpcoesDaProducao,
  ResultadoDaProducao,
  ArquivoProduzido,
  ExecutorDeComando,
  OpcoesDaLinhaDeComando,
} from "./produzir.js";

export {
  ARTEFATOS_ESPERADOS_DO_ESTRITO,
  FORMATO_RELATORIO_FINAL,
} from "./contrato.js";
export type {
  ArtefatoEsperado,
  EntradaDoRelatorioFinal,
  RelatorioFinal,
} from "./contrato.js";
