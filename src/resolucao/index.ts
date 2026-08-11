/**
 * src/resolucao/index.ts
 *
 * Barrel do modulo de resolucao.
 *
 * Ponto de entrada unico para os cinco cards da W4. Se voce esta
 * implementando um estagio, comece por:
 *   docs/contrato-estagio-resolucao.md
 *   fixtures/resolucao/estagio-referencia/estagio.ts
 */

// ─── Contrato ───────────────────────────────────────────────────────────────────

export {
  ORDEM_ESTAGIOS,
  VERSAO_CONTRATO,
  chaveDeCache,
  chaveDoEstagio,
  componentesDaChave,
  ehNomeEstagio,
  hashDoManifesto,
  jsonCanonico,
} from "./contrato.js";
export type {
  ComponentesChave,
  EntradaEstagio,
  EstagioResolucao,
  IdentidadeEstagio,
  NomeEstagio,
  ParametrosEstagio,
  SaidaEstagio,
} from "./contrato.js";

// ─── Manifesto resolvido ────────────────────────────────────────────────────────

export {
  EColisaoDeMerge,
  PADRAO_URL,
  SCHEMA_VERSION_RESOLVIDO,
  encontrarURLs,
  fundirParciais,
} from "./manifesto-resolvido.js";
export type {
  AchadoDeURL,
  AssetResolvido,
  ManifestoResolvido,
  OrigemResultado,
  ParcialComRegistro,
  ParcialResolvido,
  RegistroEstagio,
  SchemaVersionResolvido,
  Sha256,
  TipoAsset,
} from "./manifesto-resolvido.js";

// ─── Cassete ────────────────────────────────────────────────────────────────────

export * from "./cassete/index.js";

// ─── Descoberta ─────────────────────────────────────────────────────────────────

export {
  ARQUIVO_MARCADOR,
  EEstagioDesconhecido,
  RAIZ_ESTAGIOS_PADRAO,
  descobrirEstagios,
  formatarCobertura,
  verificarCobertura,
} from "./descoberta.js";
export type {
  CoberturaEstagio,
  EstagioDescoberto,
  RelatorioCobertura,
} from "./descoberta.js";

// ─── Orquestrador ───────────────────────────────────────────────────────────────

export { Orquestrador } from "./orquestrador.js";
export type {
  ModoOrquestrador,
  OpcoesOrquestrador,
  ResultadoResolucao,
} from "./orquestrador.js";

// ─── Rede ───────────────────────────────────────────────────────────────────────

export {
  ERedeBloqueada,
  bloquearRede,
  liberarRede,
  redeBloqueada,
  tentativasDeSaida,
} from "./rede/index.js";
export type { OpcoesBloqueio } from "./rede/index.js";
