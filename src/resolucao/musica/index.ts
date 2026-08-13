/**
 * src/resolucao/musica/index.ts
 *
 * Barrel do estagio de musica e efeitos (card F2-06).
 *
 * NAO e o ponto de descoberta: o orquestrador acha o estagio por
 * `src/resolucao/musica/estagio.ts` + `export default` (AGENTS.md Regra
 * 6), nunca por este arquivo. Se este barrel sumir, o estagio continua
 * sendo descoberto; e essa a diferenca entre convencao e registro
 * central.
 *
 * O formato publicado para quem consome — em especial F3-05 (mix de
 * audio) e F5-06 (relatorio de procedencia) — esta em
 * `docs/adr/0007-musica-e-efeitos.md`, secao "O que este card entrega
 * para F3-05".
 */

export { default as estagioMusica, criarEstagioMusica } from "./estagio.js";
export {
  DURACAO_MINIMA_TRILHA_SEGUNDOS,
  EIntegridadeDoDownload,
  ETrilhaInadequada,
  EURLAtravessouAFronteira,
  PARAMETROS,
  VERSAO_ESTAGIO,
} from "./estagio.js";
export type { OpcoesEstagioMusica } from "./estagio.js";

export {
  CATALOGO,
  EPacoteInconsistente,
  ID_DA_TRILHA,
  NOME_DO_PACOTE,
  PROVEDOR,
  TIPO_DE_NO_PARA_EFEITO,
  VERSAO_DO_PACOTE,
  efeitoDoNo,
  itemPorId,
  itensDoPapel,
  titulosNecessarios,
} from "./pacote.js";
export type { ItemDoPacote, PapelDoItem } from "./pacote.js";

export {
  ENDPOINT_API,
  ERespostaDoFornecedor,
  USER_AGENT,
  VERSAO_API_EXTERNA,
  atribuicaoSemURL,
  ehAtribuicaoObrigatoria,
  limparTextoDoProvedor,
  normalizarCatalogo,
  normalizarPagina,
  urlDoCatalogo,
} from "./fornecedor.js";
export type { ArquivoDoFornecedor } from "./fornecedor.js";

export { formatarHidratacao, hidratarStoreDoCassete } from "./hidratar.js";
export type { AssetHidratado, RelatorioHidratacao } from "./hidratar.js";
