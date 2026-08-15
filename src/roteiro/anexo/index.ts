/**
 * src/roteiro/anexo/index.ts
 *
 * Barrel export do modulo de anexo (gif/video do usuario) — o caminho
 * do PUT de anexo: receberAnexo valida tipo/tamanho (allowlist +
 * ANEXO_TAMANHO_MAXIMO_BYTES do contrato), grava os bytes no store por
 * SHA-256 com procedencia e devolve o par (anexo_hash, anexo_meta) para
 * o Pedaco (contrato-roteiro.md §7; api.md §anexo).
 */

export {
  receberAnexo,
  validarTipoAnexo,
  validarTamanhoAnexo,
  VERSAO_MODULO_ANEXO,
  ErroTipoAnexoInvalido,
  ErroTamanhoAnexoExcedido,
  ErroAnexoVazio,
} from "./anexo.js";
export type {
  MetaDoAnexo,
  OpcoesDeAnexo,
  ResultadoDoAnexo,
} from "./anexo.js";
export { procedenciaDoAnexo } from "./procedencia.js";
export type { DadosDaProcedenciaDoAnexo } from "./procedencia.js";
