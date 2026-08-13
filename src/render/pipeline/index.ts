// =============================================================================
// PIPELINE DE RENDER — a fachada publica do card F5-01 (W7, hub)
// =============================================================================
// O pipeline de render por faixas + concatenacao: a ponte AB-550 (C2), o
// posicionamento de audio por ancora absoluta (C4/C3), o orcamento de
// concorrencia (ADR-0032/I-03), o planejamento de faixas e o executor que
// entrega os dois lados da comparacao byte a byte (∅-crit).
//
// Quem consome (F5-09 na W8 — cache de render; F5-07 na W9 — orquestrador
// de ponta a ponta) importa DESTE modulo e nunca reimplementa o pipeline.
// Imports relativos: o bundler do Remotion nao le os `paths` do tsconfig
// (armadilha 9.3).
// =============================================================================

export {
  atravessarPonte,
  ErroDePonte,
  REGRA_INTEGRIDADE_REFERENCIAL,
  REGRA_HASH_DOS_BYTES,
  REGRA_LICENCA_DE_PROCEDENCIA,
  type EntradasDaPonte,
  type FonteNomeada,
  type CorDaFronteira,
  type AssetDaPonte,
  type ResultadoDaPonte,
} from "./ponte";

export {
  posicionarAudio,
  ErroDePosicionamento,
  type MixDeEmenda,
  type PalavraAbsoluta,
  type TrechoDeAtenuacao,
  type FaixaDeAudioPosicionada,
  type PlanoDeAudio,
  type EntradasDoPosicionamento,
} from "./audio";

export {
  calcularOrcamento,
  lerMemTotalGiB,
  BASE_ARVORE_GIB,
  MARGINAL_POR_WORKER_GIB,
  ENCODE_FFMPEG_GIB,
  PICO_GATE_GIB,
  TETO_RAM_GIB,
  TETO_WORKERS,
  MEM_TOTAL_REFERENCIA_GIB,
  MARGEM_PARA_O_HOST_GIB,
  type Orcamento,
  type OpcoesDoOrcamento,
} from "./orcamento";

export {
  planejarFaixas,
  coberturaDasFaixas,
  violacoesDeTamanho,
  ErroDePlanejamento,
  type FaixaDeFrames,
} from "./faixas";

export {
  renderizarPorFaixas,
  prepararRender,
  rendererReal,
  ErroDeRender,
  type ContextoDoRender,
  type RendererDeFrames,
  type OpcoesDoExecutor,
  type ResultadoDoExecutor,
} from "./executar";

export {
  garantirCodecComparavel,
  CODIFICADORES_DA_COMPARACAO,
  ErroDeCodecIncomparavel,
  type DeclaracaoDeCodec,
} from "./codificacoes";
