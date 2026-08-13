/**
 * src/autoria/contrato/contrato.ts
 *
 * Contrato de autoria v1 (card F4-01, W5).
 *
 * O estagio de AUTORIA e o unico estagio em que um LLM decide: NARRATIVA —
 * quais nos entram, em que ordem, o texto, e o vocabulario fechado de
 * transicao. Tudo que e decisao do SISTEMA (frame exato, layout, cor,
 * duracao resolvida) nao existe no Documento de Autoria: os campos nao
 * estao no schema e additionalProperties:false torna a emissao IMPOSSIVEL,
 * nao apenas desencorajada.
 *
 * Regras duras herdadas do ledger (docs/contrato-w5.md §3):
 *   - AB-432 — hash de midia e ADVISORY, nao exigido. A autoria pode omitir
 *     o hash; o schema nunca reprova a ausencia. (O hash e resolvido a
 *     jusante, na fronteira de resolucao.)
 *   - AB-433 — texto_alternativo OBRIGATORIO para no de midia. Ausencia e
 *     erro, nao aviso.
 *
 * Fronteira de determinismo: a autoria esta ACIMA da linha — nada aqui e
 * deterministico, e o CACHE por hash da entrada canonicalizada e a unica
 * garantia de reprodutibilidade (temperatura zero NAO e garantia; ver
 * docs/adr/0023-contrato-de-autoria.md). O cache e implementado em
 * cache.ts; a validacao em validar.ts; o gate de rejeicao em rejeitar.ts.
 */

/** Versao congelada do Documento de Autoria. Bump = novo arquivo, nunca editar este. */
export const VERSAO_DOCUMENTO_AUTORIA = "Autoria.1" as const;
export type VersaoDocumentoAutoria = typeof VERSAO_DOCUMENTO_AUTORIA;

/** Versao do schema completo (validador). Vive no proprio arquivo JSON. */
export const CAMINHO_SCHEMA_COMPLETO =
  new URL("./schema/autoria.schema.json", import.meta.url).pathname;
export const CAMINHO_SCHEMA_ANTHROPIC =
  new URL("./schema/autoria.llm.anthropic.json", import.meta.url).pathname;
export const CAMINHO_SCHEMA_OPENAI =
  new URL("./schema/autoria.llm.openai.json", import.meta.url).pathname;

/**
 * Vocabulario fechado de transicao que o LLM pode escolher (decisao
 * narrativa de ritmo). Congelado na v1 como a intersecao do enum do
 * manifesto S-4 com os presentations exportados pelo pacote instalado
 * @remotion/transitions (sem `cube`, que tem pagina na doc mas nao existe
 * no pacote — pacote separado e pago). A duracao e a direcao da transicao
 * sao decisao do sistema e nao existem no documento de autoria.
 */
export const VOCABULARIO_TRANSICAO = [
  "fade",
  "slide",
  "wipe",
  "flip",
  "none",
] as const;
export type TipoTransicaoAutoria = (typeof VOCABULARIO_TRANSICAO)[number];

// ─── Tipos do Documento de Autoria v1 ────────────────────────────────────────

export interface NoCabecalhoAutoria {
  id: string;
  schema: "Cabecalho.1";
  type: "cabecalho";
  texto: string;
  subtitulo?: string;
}

export interface NoTextoAutoria {
  id: string;
  schema: "Texto.1";
  type: "texto";
  texto: string;
  destaque?: boolean;
}

export interface NoListaAutoria {
  id: string;
  schema: "Lista.1";
  type: "lista";
  itens: string[];
  ordenada?: boolean;
}

export type TipoMidiaAutoria = "imagem" | "video" | "gif";

export interface NoMidiaAutoria {
  id: string;
  schema: "Midia.1";
  type: "midia";
  tipo_midia: TipoMidiaAutoria;
  /** OBRIGATORIO (AB-433): sem descricao, o no de midia e invalido. */
  texto_alternativo: string;
  /** ADVISORY (AB-432): opcional — ausencia nunca reprova o documento. */
  hash?: string;
}

export interface NoCodigoAutoria {
  id: string;
  schema: "Codigo.1";
  type: "codigo";
  codigo: string;
  linguagem?: string;
  linhas_destaque?: number[];
}

export type TipoGraficoAutoria = "barras" | "linha" | "pizza" | "area" | "dispersao";

export interface DadoGraficoAutoria {
  rotulo: string;
  valor: number;
}

export interface NoGraficoAutoria {
  id: string;
  schema: "Grafico.1";
  type: "grafico";
  tipo_grafico: TipoGraficoAutoria;
  titulo?: string;
  dados: DadoGraficoAutoria[];
}

export type NoAutoria =
  | NoCabecalhoAutoria
  | NoTextoAutoria
  | NoListaAutoria
  | NoMidiaAutoria
  | NoCodigoAutoria
  | NoGraficoAutoria;

export interface TransicaoAutoria {
  tipo: TipoTransicaoAutoria;
}

export interface AudioCenaAutoria {
  texto_locucao: string;
}

export interface CenaAutoria {
  id: string;
  nos: string[];
  transicao_entrada?: TransicaoAutoria;
  transicao_saida?: TransicaoAutoria;
  audio_cena?: AudioCenaAutoria;
}

export interface AudioAutoria {
  trilha_sonora: string;
}

export interface DocumentoAutoria {
  schema_version: VersaoDocumentoAutoria;
  nos: NoAutoria[];
  cenas: CenaAutoria[];
  audio?: AudioAutoria;
}

// ─── Entrada do cache (o que muda a saida) ───────────────────────────────────

/**
 * Componentes da chave de cache da autoria. Qualquer mudanca em QUALQUER
 * componente gera MISS (C12) — teste em tests/autoria/contrato/cache.test.ts.
 *
 * A chave e a especificacao da skill llm-authoring:
 * sha256(canonical_json({model, system, tools, messages, output_config,
 * schema_version})). `output_config` carrega o schema podado por fornecedor
 * e o nome — trocar de fornecedor muda a chave. `tentativa` entra na chave
 * porque o retry com simplificacao progressiva MUTA o prompt: a saida
 * depende de quantas vezes falhou.
 *
 * Temperatura NAO faz parte da chave de proposito: o cache e a garantia de
 * reprodutibilidade; parametros de amostragem nao sao contrato de
 * reproducao (ADR-0023, pergunta adversarial 2).
 */
export interface EntradaAutoria {
  model: string;
  system: string;
  tools: unknown[];
  messages: unknown[];
  output_config: unknown;
  schema_version: string;
  tentativa?: number;
}
