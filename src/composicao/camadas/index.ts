// =============================================================================
// Camadas globais — barrel export
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
// =============================================================================

export {
  RETANGULO_VAZIO,
  NOMES_DAS_BANDAS,
  areaDe,
  areaDaIntersecao,
  bandasDaMargem,
  baixoDe,
  contem,
  contemPonto,
  direitaDe,
  fatiarBanda,
  intersecaoDe,
  intersecta,
  recortar,
  type Banda,
  type NomeDeBanda,
  type Retangulo,
} from "./geometria";

export {
  PAPEIS_DE_CAMADA,
  Z_INDEX_POR_PAPEL,
  apenasVisiveis,
  foraDaJanela,
  isPapelDeCamada,
  margemSegura,
  medirInvasaoDaSafeArea,
  opacidadeDaJanela,
  rampaEmFrames,
  retanguloDoQuadro,
  retangulosForaDoQuadro,
  retanguloSeguro,
  validarModuloDeCamada,
  type CamadaComponent,
  type CamadaMeta,
  type CamadaProps,
  type Invasao,
  type ModuloDeCamada,
  type PapelDeCamada,
  type PlanoDeCamada,
  type RetanguloPintado,
} from "./contrato-de-camada";

export { CAMADAS, CAMADA_POR_NOME, camadaChamada, nomesRegistrados } from "./registro";

export { pintarPlano } from "./_pintar";
