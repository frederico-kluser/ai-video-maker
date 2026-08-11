/**
 * src/resolucao/rede/index.ts
 *
 * Barrel do guarda de rede minimo da resolucao.
 */

export {
  ERedeBloqueada,
  bloquearRede,
  liberarRede,
  redeBloqueada,
  tentativasDeSaida,
  __somenteParaSondaDoGuarda_comRedeLiberada,
} from "./bloqueio.js";
export type { OpcoesBloqueio } from "./bloqueio.js";
