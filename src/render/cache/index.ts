// =============================================================================
// CACHE DE RENDER POR CONTEUDO — a fachada publica do card F5-09 (W8)
// =============================================================================
//
// O cache de render e a sua invalidacao por CONTEUDO (ADR-0041): a
// chave C7 tem cinco componentes (manifesto resolvido, re-hash dos
// bytes de assets, valores dos tokens consumidos, versao do
// codigo/compositor/navegador, pin das ferramentas) e NUNCA data,
// memTotal, workers, plano de faixas, porta ou env de agendamento.
// O cache de bytes so existe onde a comparacao byte a byte vale
// (CODIFICADORES_DA_COMPARACAO do F5-01 — png/qtrle; vp9/webm e
// mp4/h264 excluidos com o motivo) e nunca em perfil deterministico:
// false (NVENC — AB-700). A unidade e o FRAME por indice absoluto
// (AB-691).
//
// Quem consome (F5-07 na W9 — orquestrador) importa DESTE modulo e
// nunca reimplementa a chave: a retomada por estagio usa a chave C7, e
// "cache velho quando a entrada mudou" e detectado pela comparacao de
// chaves, nunca por data. Imports relativos: o bundler do Remotion nao
// le os `paths` do tsconfig.
// =============================================================================

export {
  calcularChaveC7,
  componentesDaChaveC7,
  sha256Hex,
  FORMATO_DA_CHAVE,
  tokensConsumidosReais,
  type EntradasDaChaveC7,
  type ComponentesDaChaveC7,
} from "./chave";

export {
  serializarCanonico,
  type ValorSerializavel,
} from "./serializar";

export {
  lerVersoesDaPilha,
  lerPinDeFerramentas,
  lerVersaoDoFfmpeg,
  type VersoesDaPilha,
  type PinDeFerramentas,
  type LerVersaoDoFfmpeg,
  type OpcoesDasVersoes,
} from "./versoes";

export {
  extrairIndiceDoFrame,
  PADRAO_DE_NOME_DE_FRAME,
  ErroDeNomeDeFrame,
  ErroDeFrameAusente,
} from "./frames";

export {
  permitidoCacheDeBytesDoCodec,
  permitidoCacheDeBytesDoPerfil,
  codecsCacheaveisEmBytes,
  ErroDeCacheDeBytes,
} from "./delimitacao";

export {
  ArmazemDeCache,
  RAIZ_DEFAULT_DO_CACHE,
  type OpcoesDoArmazem,
  type MetaDoCache,
} from "./armazenar";

export {
  renderizarComCache,
  type OpcoesDoRenderComCache,
  type ResultadoDoRenderComCache,
} from "./renderizar";
