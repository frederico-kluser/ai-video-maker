/**
 * src/contratos/manifesto.ts
 *
 * Tipos TypeScript do manifesto de video.
 * Fonte unica de verdade para o contrato de dados.
 *
 * A cadeia de geracao e:
 *   Zod 4 (este arquivo) → z.toJSONSchema() → schema/manifesto.schema.json
 *                                           → schema/manifesto.llm.schema.json
 *   schema/manifesto.schema.json → datamodel-codegen → src/contratos/manifesto.py
 *
 * Estes tipos sao escritos a mao na Fase 0 e migrarao para Zod 4
 * quando as dependencias estiverem instaladas (card T-01 + F0-02).
 */

// ─── Tipos base ────────────────────────────────────────────────────────────────

/** Versao do schema do manifesto. */
export type SchemaVersion = "Manifesto.1";

/** Identificador unico de no. Referenciado pelas cenas. */
export type NodeId = string;

/** Identificador unico de cena. */
export type CenaId = string;

// ─── Animacao ───────────────────────────────────────────────────────────────────

export type AnimacaoTipo = "fade" | "slide" | "scale" | "spring" | "none";
export type AnimacaoDirecao = "from-left" | "from-right" | "from-top" | "from-bottom";

export interface ConfiguracaoMola {
  damping: number;
  stiffness: number;
  mass?: number;
}

export interface Animacao {
  tipo: AnimacaoTipo;
  direcao?: AnimacaoDirecao;
  duracao_frames?: number;
  configuracao_mola?: ConfiguracaoMola;
}

// ─── Nos visuais ────────────────────────────────────────────────────────────────

export type Alinhamento = "esquerda" | "centro" | "direita";

interface NoBase {
  id: NodeId;
  schema: string;
  type: string;
  duracao_frames: number;
  entrada_frames?: number;
  animacao?: Animacao;
}

export interface NoCabecalho extends NoBase {
  type: "cabecalho";
  schema: "Cabecalho.1";
  texto: string;
  subtitulo?: string;
  alinhamento?: Alinhamento;
}

export interface NoTexto extends NoBase {
  type: "texto";
  schema: "Texto.1";
  texto: string;
  destaque?: boolean;
  alinhamento?: Alinhamento;
}

export interface NoLista extends NoBase {
  type: "lista";
  schema: "Lista.1";
  itens: string[];
  ordenada?: boolean;
  alinhamento?: Alinhamento;
}

export type TipoMidia = "imagem" | "video" | "gif";
export type AjusteMidia = "cover" | "contain" | "fill" | "none";

export interface NoMidia extends NoBase {
  type: "midia";
  schema: "Midia.1";
  hash: string;
  tipo_midia: TipoMidia;
  ajuste?: AjusteMidia;
  texto_alternativo?: string;
  licenca: string;
}

export interface NoCodigo extends NoBase {
  type: "codigo";
  schema: "Codigo.1";
  codigo: string;
  linguagem: string;
  linhas_destaque?: number[];
  nome_arquivo?: string;
}

export type TipoGrafico = "barras" | "linha" | "pizza" | "area" | "dispersao";

export interface DadoGrafico {
  rotulo: string;
  valor: number;
  cor?: string;
}

export interface NoGrafico extends NoBase {
  type: "grafico";
  schema: "Grafico.1";
  tipo_grafico: TipoGrafico;
  titulo?: string;
  dados: DadoGrafico[];
}

/** Uniao discriminada de todos os tipos de no. */
export type No = NoCabecalho | NoTexto | NoLista | NoMidia | NoCodigo | NoGrafico;

// ─── Transicoes ─────────────────────────────────────────────────────────────────

export type TransicaoTipo =
  | "slide"
  | "fade"
  | "wipe"
  | "flip"
  | "clockWipe"
  | "cube"
  | "none";

export interface TimingMola {
  kind: "spring";
  config: ConfiguracaoMola;
}

export interface Transicao {
  tipo: TransicaoTipo;
  duracao_frames: number;
  direcao?: AnimacaoDirecao;
  timing?: TimingMola;
}

// ─── Audio ──────────────────────────────────────────────────────────────────────

export interface Audio {
  trilha_sonora: string;
  volume?: number;
  inicio_frames?: number;
}

export interface AudioCena {
  hash_locucao: string;
  volume?: number;
  texto_locucao?: string;
}

// ─── Cena ───────────────────────────────────────────────────────────────────────

export interface Cena {
  id: CenaId;
  nos: NodeId[];
  transicao_entrada?: Transicao;
  transicao_saida?: Transicao;
  audio_cena?: AudioCena;
}

// ─── Manifesto ──────────────────────────────────────────────────────────────────

export interface Manifesto {
  schema_version: SchemaVersion;
  fps: number;
  width: number;
  height: number;
  duracao_total_frames?: number;
  nos: No[];
  cenas: Cena[];
  audio?: Audio;
}

// ─── Guards de tipo ─────────────────────────────────────────────────────────────

export function isNoCabecalho(no: No): no is NoCabecalho {
  return no.type === "cabecalho";
}
export function isNoTexto(no: No): no is NoTexto {
  return no.type === "texto";
}
export function isNoLista(no: No): no is NoLista {
  return no.type === "lista";
}
export function isNoMidia(no: No): no is NoMidia {
  return no.type === "midia";
}
export function isNoCodigo(no: No): no is NoCodigo {
  return no.type === "codigo";
}
export function isNoGrafico(no: No): no is NoGrafico {
  return no.type === "grafico";
}