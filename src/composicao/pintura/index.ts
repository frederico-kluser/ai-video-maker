// =============================================================================
// PINTURA — a camada de pintura de producao (AB-493)
// =============================================================================
// Promovida da suite integrada no PREP-w7: o pintor de cena de producao
// passa a viver em src/composicao/ como codigo puro, e a suite integrada
// (tests/integracao/composicao/fiar.tsx) continua o oraculo importando daqui.
//
// API publica:
//
//   pintar(manifesto, tempo, viewport) -> frame   o contrato publico
//   fiar(fixture, resolverFonte) -> Fiado         a fiacao
//   ArvoreIntegrada({fixture, frame})             a arvore a partir da fixture
//   pintorDeCena(estado) -> PintorDeCena          o pintor de cena das
//                                                 transicoes, injetavel
//
// Nada aqui fala com o disco nem com o relogio (comp-pureza); os imports sao
// relativos porque o bundler do Remotion nao le os paths do tsconfig
// (armadilha 9.3). Nao e registrado no registro central
// (src/composicao/registro.ts): o registro e dos NOS; a pintura e uma camada
// de composicao, como transicoes e camadas, e cada uma tem o proprio ponto
// de composicao.
// =============================================================================

export {
  fiar,
  fiarApadrao,
  resolverPadrao,
  HASH_DO_GRAFICO,
  NOME_DO_ARQUIVO_DO_GRAFICO,
  type Fiado,
  type FixtureIntegrada,
} from "./fiar";

export { pintorDeCena } from "./cena";

export { pintar, ArvoreIntegrada, type ArvoreIntegradaProps } from "./arvore";

export type { Pintar, Viewport, TempoAbsoluto } from "./contrato";
