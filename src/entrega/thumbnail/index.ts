// =============================================================================
// THUMBNAIL — API publica do modulo (card F5-05, W7)
// =============================================================================
// Quem consome (o gate deste card, o F5-07 na W9) importa DAQUI e nunca
// reimplementa a escolha de frame, a escala, a legibilidade ou a medicao
// de contraste. O que e impuro (bundle + render com Chrome) vive no gate
// (tests/entrega/thumbnail/gate.ts) — este modulo inteiro e funcao pura:
// zero disco, zero rede, zero relogio.
//
// O pixel do thumbnail nasce do pintor promovido (src/composicao/pintura,
// AB-493) — o contrato `pintar(manifesto, tempo, viewport)`, a mesma
// arvore que o render usa. Nenhum texto, cor ou geometria e digitado aqui.
// =============================================================================

export { TIPO_DO_TITULO, escolherFrameDoThumbnail } from "./frame";

export {
  MINIMO_AA_NORMAL,
  MINIMO_AA_LARGE,
  PISO_DE_TINTA,
  TINTAS_TOP,
  conferirContraste,
  medirContrasteDoThumbnail,
  minimoDaTinta,
} from "./contraste";

export {
  PISO_DE_LEGIBILIDADE_PX,
  alturaDoTituloNoThumbnail,
  conferirLegibilidadeDoTitulo,
} from "./legibilidade";

export {
  ESCALA_DO_THUMBNAIL,
  planoDoThumbnail,
  tituloDoThumbnail,
} from "./especificacao";

export { ThumbnailSemTitulo } from "./contrato";
export type {
  EscalaDoThumbnail,
  FalhaDeContraste,
  FrameDoThumbnail,
  MedidaDeContraste,
  PlanoDoThumbnail,
  TintaMedida,
} from "./contrato";
