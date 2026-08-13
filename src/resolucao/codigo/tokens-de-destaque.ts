/**
 * src/resolucao/codigo/tokens-de-destaque.ts
 *
 * O FORMATO PUBLICADO — e a unica coisa deste card que outro card le.
 *
 * O destaque de sintaxe e pre-computado AQUI, acima da fronteira de
 * determinismo. O no de composicao (card F1-08) nao tokeniza, nao escolhe
 * cor e nao decide nada: ele recebe uma lista de linhas, cada linha uma
 * lista de trechos, cada trecho com o texto exato e a cor final ja
 * resolvida a partir de `src/design/tokens.ts`.
 *
 * Por que a cor vem pronta e nao a classe semantica sozinha: se o no
 * mapeasse classe -> cor, trocar o tema mudaria o pixel ABAIXO da
 * fronteira, sem mudar nenhuma chave de cache, e o cassete gravado
 * continuaria valendo para um video que ficou diferente. Com a cor
 * dentro do artefato, e o `hashDoTema` dentro da chave, trocar o tema e
 * um cache miss barulhento (AGENTS.md C12).
 *
 * A classe semantica vai junto mesmo assim: ela e o que torna o artefato
 * auditavel a olho nu, e o que permite a um teste dizer "esta palavra e
 * palavra-chave" sem depender de uma cor.
 *
 * O artefato inteiro e enderecado por SHA-256 do proprio conteudo
 * serializado canonicamente: `nos_codigo[<id do no>] = <hash>`.
 */

import {
  serializarCanonico,
  sha256,
} from "../cassete/formato.js";

// ─── Versao do formato ──────────────────────────────────────────────────────────

/**
 * Versao do formato de tokens.
 *
 * Muda ⇒ o artefato antigo nao pode ser lido como novo. Quem le confere
 * este campo antes de olhar qualquer outro (ver `lerArtefato`).
 */
export const FORMATO_TOKENS_DE_DESTAQUE = "TokensDeDestaque.1";

// ─── Classes de token ───────────────────────────────────────────────────────────

/**
 * Vocabulario fechado de classes.
 *
 * Fechado de proposito: uma classe nova exige cor nova no tema, e cor
 * nova exige token novo em `src/design/tokens.ts`. Uma classe "outros"
 * que caisse numa cor qualquer transformaria um buraco de gramatica em
 * um pixel plausivel — que e a forma mais cara de bug de destaque,
 * porque parece funcionar.
 */
export type ClasseDeToken =
  | "texto"
  | "palavra-chave"
  | "identificador"
  | "tipo"
  | "funcao"
  | "cadeia"
  | "numero"
  | "comentario"
  | "operador"
  | "pontuacao"
  | "anotacao";

/** Todas as classes, em ordem estavel. O tema tem de cobrir todas. */
export const CLASSES_DE_TOKEN: readonly ClasseDeToken[] = [
  "texto",
  "palavra-chave",
  "identificador",
  "tipo",
  "funcao",
  "cadeia",
  "numero",
  "comentario",
  "operador",
  "pontuacao",
  "anotacao",
] as const;

// ─── Estrutura ──────────────────────────────────────────────────────────────────

/** Um trecho contiguo de codigo com uma classe e uma cor ja resolvida. */
export interface TokenDeDestaque {
  /** Texto exato do trecho. Nunca vazio. Nunca contem quebra de linha. */
  readonly texto: string;

  /** Classe semantica. Serve para auditoria e para teste sem cor. */
  readonly classe: ClasseDeToken;

  /** Cor final, hexadecimal, vinda de `src/design/tokens.ts` via o tema. */
  readonly cor: string;
}

/** Uma linha de codigo ja tokenizada. */
export interface LinhaDestacada {
  /** Numero da linha, base 1 — igual ao que o manifesto usa. */
  readonly numero: number;

  /** Se esta linha esta em `linhas_destaque` do no. */
  readonly destacada: boolean;

  /**
   * Trechos, na ordem. A concatenacao de `texto` reproduz a linha
   * inteira, byte a byte — invariante testado. Linha vazia = lista vazia.
   */
  readonly tokens: readonly TokenDeDestaque[];
}

/**
 * O artefato completo de UM no de codigo.
 *
 * Tudo que o no de composicao precisa para desenhar esta aqui dentro.
 * Ele nao importa o tema, nao importa a gramatica e nao importa este
 * estagio: importa o tipo e le o JSON.
 */
export interface TokensDeDestaque {
  /** Sempre `FORMATO_TOKENS_DE_DESTAQUE`. Conferido antes de tudo. */
  readonly formato: string;

  /** Id do no do manifesto a que este artefato pertence. */
  readonly no: string;

  /** Linguagem declarada no manifesto, como veio. */
  readonly linguagemDeclarada: string;

  /** Linguagem efetivamente usada apos normalizacao de apelido. */
  readonly linguagem: string;

  /**
   * Gramatica usada e versao, mais o motivo quando houve queda para
   * texto puro. Uma queda silenciosa aqui seria um bloco de codigo
   * cinza que ninguem investiga.
   */
  readonly gramatica: string;

  /** Se a linguagem declarada tinha gramatica propria (nao caiu para texto). */
  readonly gramaticaExata: boolean;

  /** Nome do tema aplicado. */
  readonly tema: string;

  /** SHA-256 do tema resolvido. Entra na chave de cache do estagio. */
  readonly hashDoTema: string;

  /** Pilha de fonte monoespacada, vinda de `src/design/tokens.ts`. */
  readonly fonte: string;

  /** Quantos espacos cada tabulacao virou. Muda a coluna, muda o pixel. */
  readonly larguraDaTabulacao: number;

  /** Cor de fundo do bloco. */
  readonly corDeFundo: string;

  /** Cor de fundo de uma linha destacada. */
  readonly corDeFundoDaLinhaDestacada: string;

  /** Cor de texto quando nenhuma classe se aplica. */
  readonly corDeTextoPadrao: string;

  /** Nome de arquivo declarado no no, quando houver. */
  readonly nomeArquivo?: string;

  /** As linhas, na ordem, base 1. */
  readonly linhas: readonly LinhaDestacada[];
}

// ─── Serializacao e endereco ────────────────────────────────────────────────────

/**
 * Serializa o artefato em JSON canonico.
 *
 * Reusa `serializarCanonico` do formato de cassete de proposito: dois
 * serializadores canonicos no mesmo repositorio divergem no primeiro
 * caso de borda (ordem de chave, `undefined`, fim de linha) e a
 * divergencia so aparece como hash diferente em outra maquina.
 */
export function serializarTokens(tokens: TokensDeDestaque): string {
  return serializarCanonico(tokens);
}

/** Endereco de conteudo do artefato: SHA-256 da forma canonica. */
export function hashDosTokens(tokens: TokensDeDestaque): string {
  return sha256(serializarTokens(tokens));
}

/**
 * Reconstroi o texto de uma linha a partir dos seus tokens.
 *
 * Existe para o invariante que o teste cobra: tokenizar nao pode perder
 * nem inventar caractere. Um destacador que come um espaco produz um
 * video plausivel e errado.
 */
export function textoDaLinha(linha: LinhaDestacada): string {
  return linha.tokens.map((t) => t.texto).join("");
}
