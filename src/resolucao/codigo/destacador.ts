/**
 * src/resolucao/codigo/destacador.ts
 *
 * O motor: texto de codigo -> linhas de tokens com cor.
 *
 * Funcao pura de `(codigo, linguagem, tema, larguraDaTabulacao,
 * linhasDestacadas)`. Nenhuma leitura de disco, de ambiente ou de
 * relogio. E isso que permite ao cassete ser regravavel byte a byte:
 * o unico volatil do cassete deste estagio e a hora da gravacao.
 *
 * O invariante que sustenta o resto:
 *
 *     linhas.map(textoDaLinha).join("\n") === codigoNormalizado
 *
 * Ou seja: tokenizar nao perde nem inventa caractere. Um destacador que
 * come um espaco entrega um video plausivel e errado — o tipo de defeito
 * que passa em revisao humana e so aparece quando alguem tenta copiar o
 * codigo da tela.
 */

import type { TemaDeDestaque } from "./tema.js";
import { gramaticaDe } from "./gramaticas.js";
import type { Gramatica } from "./gramaticas.js";
import type { ClasseDeToken, LinhaDestacada, TokenDeDestaque } from "./tokens-de-destaque.js";

// ─── Versao ─────────────────────────────────────────────────────────────────────

/**
 * Versao do motor de destaque.
 *
 * Entra nos parametros do estagio. Regra dura do contrato: mudou este
 * arquivo de um jeito que pode mudar a saida, bumpe aqui — senao o
 * cassete velho continua sendo servido para sempre (C12).
 */
export const VERSAO_DO_DESTACADOR = "1.0.0";

/** Largura de tabulacao padrao. Muda a coluna do glifo, muda o pixel. */
export const LARGURA_DA_TABULACAO_PADRAO = 4;

// ─── Normalizacao ───────────────────────────────────────────────────────────────

/**
 * Normaliza o texto antes de tokenizar.
 *
 * Tres coisas, e cada uma existe por um motivo de determinismo:
 *
 *   1. CRLF e CR viram LF. O mesmo codigo salvo no Windows e no Linux
 *      tem de produzir o MESMO hash de artefato; senao o cache erra por
 *      causa do editor de quem escreveu o manifesto.
 *   2. BOM inicial some. Um U+FEFF invisivel viraria um token invisivel
 *      e um hash diferente para um arquivo visualmente identico.
 *   3. Tabulacao vira N espacos. O render usa fonte monoespacada e nao
 *      tem tab stop: deixar `\t` passar produziria colunas que dependem
 *      do motor de layout do navegador do render (C5).
 */
export function normalizarCodigo(codigo: string, larguraDaTabulacao: number): string {
  const BOM = "\uFEFF";
  const semBom = codigo.startsWith(BOM) ? codigo.slice(1) : codigo;
  const comLf = semBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return comLf.replace(/\t/g, " ".repeat(larguraDaTabulacao));
}

// ─── Tokenizacao ────────────────────────────────────────────────────────────────

/** Um trecho classificado, ainda sem cor e ainda podendo conter `\n`. */
interface TrechoBruto {
  readonly texto: string;
  readonly classe: ClasseDeToken;
}

/**
 * Percorre o texto aplicando as regras em ordem; a primeira que casa
 * vence.
 *
 * Quando nenhuma regra casa, consome UM caractere como `texto` em vez de
 * abortar. Abortar transformaria um caractere exotico num estagio
 * vermelho; ignorar sem consumir seria laco infinito. Consumir um
 * caractere e a unica saida que termina e nao perde byte.
 */
function tokenizar(texto: string, gramatica: Gramatica): TrechoBruto[] {
  const trechos: TrechoBruto[] = [];
  let i = 0;

  while (i < texto.length) {
    let casou = false;
    for (const { classe, padrao } of gramatica.regras) {
      padrao.lastIndex = i;
      const m = padrao.exec(texto);
      if (m !== null && m[0].length > 0) {
        empilhar(trechos, m[0], classe);
        i += m[0].length;
        casou = true;
        break;
      }
    }
    if (!casou) {
      empilhar(trechos, texto.charAt(i), "texto");
      i += 1;
    }
  }

  return trechos;
}

/**
 * Acrescenta um trecho, fundindo com o anterior quando a classe repete.
 *
 * Sem a fusao, o fallback de um caractere por vez produziria um token
 * por caractere e o artefato inflaria sem mudar um pixel. Fusao e
 * deterministica: depende so da classe do vizinho imediato.
 */
function empilhar(trechos: TrechoBruto[], texto: string, classe: ClasseDeToken): void {
  const ultimo = trechos[trechos.length - 1];
  if (ultimo !== undefined && ultimo.classe === classe) {
    trechos[trechos.length - 1] = { texto: ultimo.texto + texto, classe };
    return;
  }
  trechos.push({ texto, classe });
}

// ─── Quebra em linhas ───────────────────────────────────────────────────────────

/**
 * Quebra o fluxo de trechos em linhas.
 *
 * Um trecho pode atravessar linhas (comentario de bloco, template
 * literal, corrida de espaco em branco). A quebra e por `\n` dentro do
 * proprio trecho, preservando a classe nos dois lados — e por isso um
 * comentario de bloco continua verde na segunda linha.
 */
function quebrarEmLinhas(
  trechos: readonly TrechoBruto[],
  tema: TemaDeDestaque,
): TokenDeDestaque[][] {
  const linhas: TokenDeDestaque[][] = [[]];

  for (const trecho of trechos) {
    const partes = trecho.texto.split("\n");
    for (let i = 0; i < partes.length; i++) {
      if (i > 0) linhas.push([]);
      const parte = partes[i] as string;
      if (parte.length === 0) continue;
      const atual = linhas[linhas.length - 1] as TokenDeDestaque[];
      atual.push({
        texto: parte,
        classe: trecho.classe,
        cor: tema.cores[trecho.classe],
      });
    }
  }

  return linhas;
}

// ─── API ────────────────────────────────────────────────────────────────────────

/** Opcoes de uma execucao de destaque. */
export interface OpcoesDestaque {
  readonly tema: TemaDeDestaque;
  readonly larguraDaTabulacao: number;
  /** Numeros de linha (base 1) vindos de `linhas_destaque` do no. */
  readonly linhasDestacadas: readonly number[];
}

/** Resultado de uma execucao de destaque. */
export interface ResultadoDestaque {
  readonly linhas: readonly LinhaDestacada[];
  /** Rotulo da gramatica usada, com o motivo quando houve queda. */
  readonly gramatica: string;
  /** `false` quando a linguagem declarada nao tinha gramatica local. */
  readonly gramaticaExata: boolean;
  /** Nome canonico da gramatica (sem versao). */
  readonly linguagem: string;
  /** O texto exatamente como foi tokenizado. Base do invariante. */
  readonly codigoNormalizado: string;
}

/**
 * Destaca um bloco de codigo.
 *
 * `linhasDestacadas` e normalizado aqui: ordenado, sem repeticao, e
 * ignorando numero fora do intervalo. Um `linhas_destaque: [99]` num
 * bloco de 10 linhas nao pode virar linha fantasma nem excecao — o
 * manifesto e escrito por LLM e vai errar esse numero.
 */
export function destacar(
  codigo: string,
  linguagem: string,
  opcoes: OpcoesDestaque,
): ResultadoDestaque {
  const busca = gramaticaDe(linguagem);
  const codigoNormalizado = normalizarCodigo(codigo, opcoes.larguraDaTabulacao);
  const trechos = tokenizar(codigoNormalizado, busca.gramatica);
  const porLinha = quebrarEmLinhas(trechos, opcoes.tema);

  const destacadas = new Set(
    opcoes.linhasDestacadas.filter(
      (n) => Number.isInteger(n) && n >= 1 && n <= porLinha.length,
    ),
  );

  const linhas: LinhaDestacada[] = porLinha.map((tokens, i) => ({
    numero: i + 1,
    destacada: destacadas.has(i + 1),
    tokens,
  }));

  return {
    linhas,
    gramatica: busca.rotulo,
    gramaticaExata: busca.exata,
    linguagem: busca.gramatica.nome,
    codigoNormalizado,
  };
}
