/**
 * src/store/index.ts
 *
 * Barrel export do modulo de store enderecado por conteudo.
 */

export { Store } from "./store.js";
export type { StoreOptions, PutResult, CacheKey } from "./store.js";
export type { Procedencia, ProvedorAsset } from "./procedencia.js";
export { isValidProcedencia } from "./procedencia.js";
