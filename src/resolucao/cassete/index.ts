/**
 * src/resolucao/cassete/index.ts
 *
 * Barrel do modulo de cassete.
 */

export {
  ARQUIVOS_OBRIGATORIOS,
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  ARQUIVO_VOLATIL,
  CAMPOS_VOLATEIS,
  DIRETORIO_CORPOS,
  ECasseteAusente,
  ECasseteInvalido,
  HEADERS_SENSIVEIS,
  PADROES_CREDENCIAL,
  RAIZ_CASSETES_PADRAO,
  VALOR_REDIGIDO,
  VERSAO_FORMATO_CASSETE,
  caminhoDoCorpo,
  diretorioDoCassete,
  diretorioDoEstagio,
  paraProcedenciaDoStore,
  procurarCredencial,
  sanitizarHeaders,
  sanitizarUrl,
  serializarCanonico,
  sha256,
  validarProcedencia,
} from "./formato.js";

export type {
  CabecalhoCassete,
  Cassete,
  ChamadaGravada,
  ProblemaCassete,
  ProcedenciaAsset,
  ProcedenciaCassete,
  ProcedenciaDoStore,
  VolatilCassete,
} from "./formato.js";

export {
  GravadorDeChamadas,
  escreverProcedencia,
  gravarCassete,
} from "./gravador.js";
export type { OpcoesGravacao, ResultadoGravacao } from "./gravador.js";

export {
  EChamadaNaoGravada,
  chavesGravadas,
  criarFetchDeCassete,
  lerCassete,
} from "./reprodutor.js";

export { diffCassetes, ehVolatil, formatarDiff } from "./diff.js";
export type { Diferenca, ResultadoDiff, Veredito } from "./diff.js";
