/**
 * src/render/encode/index.ts
 *
 * API PUBLICA do modulo de encode (card F5-02, onda W7) — o que o
 * pipeline (F5-01), a procedencia (F5-06) e o orquestrador (F5-07)
 * consomem. Nada aqui escreve fora do proprio diretorio.
 *
 * Consumidor principal: F5-07 (W9). O caminho de uso:
 *
 *   const perfis = await listarPerfis();
 *   const resultado = await executarEncode({
 *     perfil: perfilNvenc,
 *     entrada: master,
 *     saida: destino,
 *   });
 *   if (resultado.fallback.ativo) { /* registrar na procedencia *\/ }
 *   const verificacao = await verificarSaida(destino, {
 *     codec: resultado.perfil.codec,
 *     largura, altura,
 *   });
 */

export {
  validarPerfil,
  ehPerfilValido,
  EPerfilInvalido,
  CRF_MIN,
  CRF_MAX,
  CQ_MIN,
  CQ_MAX,
  QP_MIN,
  QP_MAX,
  LIMITES_PADRAO,
} from "./formato.js";
export type {
  PerfilEncode,
  AlvoQualidade,
  MotorEncode,
  TipoAlvoQualidade,
} from "./formato.js";

export { montarComando, FLAGS_BITEXACT, EComandoPerfilInvalido } from "./comando.js";

export { detectarNvenc, SMOKE_TEST_ARGS } from "./detectar.js";
export type { ResultadoDetecao, ExecutorDeComando as ExecutorDeComandoDetectar } from "./detectar.js";

export {
  escolherPerfil,
  ESemPerfilDeFallback,
  familiaDeCodec,
  familiaDeCodecNvenc,
} from "./escolher.js";
export type { ResultadoEscolha, DeclaracaoDeFallback } from "./escolher.js";

export { criarFilaDeEncode } from "./fila.js";
export type { FilaDeEncode, LimitesDaFila } from "./fila.js";

export { executarEncode, perfilPrecisaDeDeteccao } from "./executar.js";
export type { ResultadoDeExecucao, OpcoesDeExecucao } from "./executar.js";

export {
  verificarSaida,
  calcularFramemd5,
  codecNameDePerfil,
  YAVG_PISO_CONTEUDO,
  CHAVES_METADADO_NAO_DETERMINISTICO,
} from "./verificar.js";
export type {
  ResultadoDeVerificacao,
  InfoDaSaida,
  EsperadoDeSaida,
} from "./verificar.js";

export {
  registrarGolden,
  podeTerGolden,
  EGoldenEmPerfilNaoDeterministico,
} from "./golden.js";
export type { GoldenRegistrado } from "./golden.js";

export { listarPerfis, DIRETORIO_DE_PERFIS } from "./descobrir.js";
export type { PerfilDescoberto } from "./descobrir.js";
