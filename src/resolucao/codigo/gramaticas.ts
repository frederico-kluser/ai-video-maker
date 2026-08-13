/**
 * src/resolucao/codigo/gramaticas.ts
 *
 * As gramaticas — locais, versionadas, sem nada remoto.
 *
 * O ponto do card: destacar codigo e uma operacao que a industria
 * resolve com ferramenta que fala com a rede em tempo de execucao.
 * A ferramenta canonica desse tipo baixa declaracoes de tipo de um host
 * de terceiro para anotar hovers (o nome dela esta no ADR; aqui nao, por
 * causa do tripwire). Se isso acontecesse no render, um video deixaria de ser
 * funcao pura do manifesto: dois renders da mesma entrada, em dias
 * diferentes, dariam frames diferentes — e o segundo dependeria de um
 * host de terceiro estar de pe.
 *
 * A escolha deste card e mais forte do que "cachear a chamada": aqui a
 * gramatica MORA no repositorio. Nao ha chamada para cachear. O cassete
 * gravado tem zero chamadas de rede, e isso e verificado
 * (`quantidadeChamadas` = 0), nao prometido.
 *
 * O que se perde por isso, dito em voz alta: este lexer nao entende
 * literal de expressao regular em JavaScript, nao resolve tipos, e nao
 * distingue `<` de abertura de JSX de `<` de comparacao. Um destacador
 * de verdade (TextMate/Oniguruma) faria melhor — e entraria como
 * dependencia nova em `package.json`, que e singleton PROIBIDO para
 * este card. Esta limitacao esta no ADR e no ledger, com o item aberto.
 *
 * Determinismo: as regras sao ordenadas e a primeira que casa vence.
 * Nenhuma depende de relogio, de ambiente ou de ordem de `Object.keys`.
 */

import type { ClasseDeToken } from "./tokens-de-destaque.js";

// ─── Versao ─────────────────────────────────────────────────────────────────────

/**
 * Versao do conjunto de gramaticas.
 *
 * Entra nos parametros do estagio, e portanto na chave de cache: mudar
 * uma regra lexica muda a tokenizacao, muda a cor de algum trecho e
 * muda o pixel. Sem isso o cassete velho continuaria valendo (C12).
 */
export const VERSAO_DAS_GRAMATICAS = "1.0.0";

// ─── Estrutura ──────────────────────────────────────────────────────────────────

/** Uma regra lexica: um padrao ancorado e a classe que ele produz. */
export interface RegraLexica {
  readonly classe: ClasseDeToken;
  /** Padrao com flag `y` (sticky). Sempre casa a partir de `lastIndex`. */
  readonly padrao: RegExp;
}

/** Uma gramatica: nome, versao e regras em ordem de prioridade. */
export interface Gramatica {
  readonly nome: string;
  readonly versao: string;
  readonly regras: readonly RegraLexica[];
}

/** Constroi uma regra com o flag sticky sempre ligado. */
function regra(classe: ClasseDeToken, fonte: string): RegraLexica {
  return { classe, padrao: new RegExp(fonte, "y") };
}

// ─── Palavras-chave ─────────────────────────────────────────────────────────────

const PALAVRAS_TS = [
  "abstract", "as", "async", "await", "break", "case", "catch", "class",
  "const", "continue", "declare", "default", "delete", "do", "else", "enum",
  "export", "extends", "false", "finally", "for", "from", "function", "get",
  "if", "implements", "import", "in", "instanceof", "interface", "keyof", "let",
  "new", "null", "of", "private", "protected", "public", "readonly", "return",
  "satisfies", "set", "static", "super", "switch", "this", "throw", "true",
  "try", "type", "typeof", "undefined", "var", "void", "while", "yield",
];

const PALAVRAS_PY = [
  "and", "as", "assert", "async", "await", "break", "class", "continue",
  "def", "del", "elif", "else", "except", "False", "finally", "for", "from",
  "global", "if", "import", "in", "is", "lambda", "None", "nonlocal", "not",
  "or", "pass", "raise", "return", "self", "True", "try", "while", "with",
  "yield",
];

/** Alternacao ancorada em fronteira de palavra, em ordem estavel. */
function alternativa(palavras: readonly string[]): string {
  return `\\b(?:${[...palavras].sort().join("|")})\\b`;
}

// ─── Gramaticas ─────────────────────────────────────────────────────────────────

/**
 * TypeScript / JavaScript / JSX / TSX.
 *
 * Uma gramatica so para a familia inteira de proposito: quatro copias
 * quase iguais divergem na primeira correcao que alguem esquece de
 * replicar, e a divergencia aparece como cor diferente para o mesmo
 * trecho em dois nos do mesmo video.
 */
const TIPOSCRIPT: Gramatica = {
  nome: "typescript",
  versao: VERSAO_DAS_GRAMATICAS,
  regras: [
    regra("comentario", "\\/\\*[\\s\\S]*?\\*\\/"),
    regra("comentario", "\\/\\/[^\\n]*"),
    regra("cadeia", "`(?:[^`\\\\]|\\\\[\\s\\S])*`"),
    regra("cadeia", '"(?:[^"\\\\\\n]|\\\\.)*"'),
    regra("cadeia", "'(?:[^'\\\\\\n]|\\\\.)*'"),
    regra("numero", "\\b0[xXbBoO][0-9a-fA-F_]+\\b"),
    regra("numero", "\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?\\b"),
    regra("anotacao", "@[A-Za-z_$][A-Za-z0-9_$]*"),
    regra("palavra-chave", alternativa(PALAVRAS_TS)),
    regra("tipo", "\\b[A-Z][A-Za-z0-9_$]*\\b"),
    regra("funcao", "\\b[a-z_$][A-Za-z0-9_$]*(?=\\s*\\()"),
    regra("identificador", "\\b[A-Za-z_$][A-Za-z0-9_$]*\\b"),
    regra("operador", "[+\\-*/%=<>!&|^~?:]+"),
    regra("pontuacao", "[{}()\\[\\];,.]"),
    regra("texto", "\\s+"),
  ],
};

/** Python. */
const PITAO: Gramatica = {
  nome: "python",
  versao: VERSAO_DAS_GRAMATICAS,
  regras: [
    regra("comentario", "#[^\\n]*"),
    regra("cadeia", '"""[\\s\\S]*?"""'),
    regra("cadeia", "'''[\\s\\S]*?'''"),
    regra("cadeia", '"(?:[^"\\\\\\n]|\\\\.)*"'),
    regra("cadeia", "'(?:[^'\\\\\\n]|\\\\.)*'"),
    regra("numero", "\\b0[xXbBoO][0-9a-fA-F_]+\\b"),
    regra("numero", "\\b\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?\\b"),
    regra("anotacao", "@[A-Za-z_][A-Za-z0-9_.]*"),
    regra("palavra-chave", alternativa(PALAVRAS_PY)),
    regra("tipo", "\\b[A-Z][A-Za-z0-9_]*\\b"),
    regra("funcao", "\\b[a-z_][A-Za-z0-9_]*(?=\\s*\\()"),
    regra("identificador", "\\b[A-Za-z_][A-Za-z0-9_]*\\b"),
    regra("operador", "[+\\-*/%=<>!&|^~:]+"),
    regra("pontuacao", "[{}()\\[\\];,.]"),
    regra("texto", "\\s+"),
  ],
};

/** JSON. */
const JSON_: Gramatica = {
  nome: "json",
  versao: VERSAO_DAS_GRAMATICAS,
  regras: [
    regra("cadeia", '"(?:[^"\\\\]|\\\\.)*"'),
    regra("numero", "-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b"),
    regra("palavra-chave", "\\b(?:false|null|true)\\b"),
    regra("operador", ":"),
    regra("pontuacao", "[{}\\[\\],]"),
    regra("texto", "\\s+"),
  ],
};

/**
 * Texto puro — a rede de seguranca.
 *
 * Nao e "sem gramatica": e uma gramatica declarada, com nome, que
 * aparece no artefato. Uma queda para ca fica escrita em
 * `TokensDeDestaque.gramatica` junto com o motivo, para que um bloco
 * inteiro sem cor tenha explicacao no proprio dado, e nao vire uma
 * pergunta em revisao de video.
 */
const TEXTO: Gramatica = {
  nome: "texto",
  versao: VERSAO_DAS_GRAMATICAS,
  regras: [regra("texto", "[\\s\\S]+")],
};

// ─── Apelidos e busca ───────────────────────────────────────────────────────────

/**
 * Apelido para gramatica.
 *
 * Mapa explicito: um manifesto escrito por LLM diz `ts`, `tsx`,
 * `TypeScript` e `typescript` para a mesma coisa, e tratar cada variacao
 * como linguagem desconhecida produziria bloco cinza intermitente.
 */
const APELIDOS: Readonly<Record<string, Gramatica>> = {
  typescript: TIPOSCRIPT,
  ts: TIPOSCRIPT,
  tsx: TIPOSCRIPT,
  typescriptreact: TIPOSCRIPT,
  javascript: TIPOSCRIPT,
  js: TIPOSCRIPT,
  jsx: TIPOSCRIPT,
  javascriptreact: TIPOSCRIPT,
  mjs: TIPOSCRIPT,
  cjs: TIPOSCRIPT,
  python: PITAO,
  py: PITAO,
  python3: PITAO,
  json: JSON_,
  jsonc: JSON_,
  text: TEXTO,
  texto: TEXTO,
  txt: TEXTO,
  plaintext: TEXTO,
  plain: TEXTO,
};

/** Normaliza a linguagem declarada: minuscula, sem espaco nas bordas. */
export function normalizarLinguagem(linguagem: string): string {
  return linguagem.trim().toLowerCase();
}

/** Resultado da busca de gramatica. */
export interface BuscaDeGramatica {
  readonly gramatica: Gramatica;
  /** `false` quando caiu para texto puro por nao conhecer a linguagem. */
  readonly exata: boolean;
  /** Rotulo que vai para o artefato, com o motivo quando houve queda. */
  readonly rotulo: string;
}

/**
 * Acha a gramatica de uma linguagem.
 *
 * Linguagem desconhecida NAO e erro: um manifesto legitimo pode trazer
 * `rust`, e derrubar a resolucao inteira por causa da cor de um bloco
 * seria desproporcional. Mas tambem nao e silencio: o rotulo carrega o
 * motivo, `exata` fica `false`, e o teste cobra que o motivo apareca.
 */
export function gramaticaDe(linguagem: string): BuscaDeGramatica {
  const normal = normalizarLinguagem(linguagem);
  const achada = Object.prototype.hasOwnProperty.call(APELIDOS, normal)
    ? APELIDOS[normal]
    : undefined;
  if (achada !== undefined) {
    // Apelido conhecido e sempre casamento exato — inclusive quando a
    // linguagem pedida E texto puro. `exata: false` fica reservado para o
    // unico caso que merece explicacao: nao sabemos destacar isto.
    return {
      gramatica: achada,
      exata: true,
      rotulo: `${achada.nome}@${achada.versao}`,
    };
  }
  return {
    gramatica: TEXTO,
    exata: false,
    rotulo:
      `${TEXTO.nome}@${TEXTO.versao} (queda: linguagem "${normal}" sem gramatica local)`,
  };
}

/**
 * Nomes de gramatica disponiveis, sem repeticao, em ordem estavel.
 *
 * Usado por diagnostico e por teste. O teste asserta a PRESENCA da
 * gramatica que este card precisa, nunca a lista fechada — a lista e
 * minha e so cresce, mas assercao de lista completa e o defeito que a
 * pergunta obrigatoria da W4 existe para evitar.
 */
export function nomesDeGramatica(): string[] {
  return [...new Set(Object.values(APELIDOS).map((g) => g.nome))].sort();
}

/** Apelidos reconhecidos, em ordem estavel. */
export function apelidosDeLinguagem(): string[] {
  return Object.keys(APELIDOS).sort();
}
