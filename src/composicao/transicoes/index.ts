// =============================================================================
// TRANSICOES — superficie publica
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// `entrada.tsx` NAO e reexportado de proposito: ele chama `registerRoot()` no
// nivel do modulo, e importa-lo por acidente registraria a raiz de
// demonstracao por cima da raiz de producao.
// =============================================================================

export {
  CASAS_DECIMAIS,
  DIRECAO_PADRAO,
  ErroDeTransicao,
  LADOS,
  TIPOS_DE_TRANSICAO,
  angulo,
  eixoDaDirecao,
  isTipoDeTransicao,
  pixels,
  porcento,
  sinalDaDirecao,
  validarMetaDeApresentacao,
  type Apresentacao,
  type ApresentacaoMeta,
  type ApresentacaoProps,
  type LadoDaTransicao,
  type ModuloDeApresentacao,
} from "./contrato";

export {
  censoDeFrames,
  cenasNoFrame,
  fronteiraNoFrame,
  janelasDeFronteira,
  planoDeTransicoes,
  progressoNaJanela,
  transicaoVencedora,
  type Censo,
  type CenaNoFrame,
  type JanelaDeFronteira,
  type PlanoDeTransicoes,
} from "./fronteiras";

export {
  REGISTRO_DE_APRESENTACOES,
  apresentacaoDe,
  metaDe,
  tiposComApresentacao,
  type RegistroDeApresentacoes,
} from "./registro";

export {
  SequenciaComTransicoes,
  type PintorDeCena,
  type PintorDeCenaProps,
  type SequenciaComTransicoesProps,
} from "./sequencia";
