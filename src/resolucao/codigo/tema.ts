/**
 * src/resolucao/codigo/tema.ts
 *
 * O TEMA de destaque — classe semantica para cor final.
 *
 * Regra 2 do AGENTS.md: toda cor vive em `src/design/tokens.ts` e e
 * importada, nunca redigitada. Este arquivo nao inventa nenhuma cor: ele
 * so escolhe QUAL token cada classe usa. O gate `design-varrer`
 * (tests/design/literal-scan.test.ts) varre `src/**` atras de `#RRGGBB` e
 * ficaria vermelho se aqui houvesse um so hexadecimal escrito a mao.
 *
 * `src/design/tokens.ts` e singleton (S-5) e esta PROIBIDO para este
 * card. Foi por isso que o tema saiu por composicao de tokens que ja
 * existem, e nao por um grupo `sintaxe` novo la dentro. O que isso custa
 * esta escrito no handoff e em `docs/adr/0007-*`: a paleta de destaque
 * nao tem nome proprio no design system ainda.
 *
 * O tema inteiro e hasheado (`hashDoTema`) e o hash entra na chave de
 * cache do estagio. E a resposta executavel para "mudar o tema muda o
 * pixel": mudar QUALQUER cor daqui — inclusive por alguem mexer em
 * `src/design/tokens.ts` la longe — muda o hash, muda a chave, muda o
 * diretorio do cassete, e o cassete velho deixa de ser encontrado.
 * Barulhento, nao silencioso (AGENTS.md C12).
 */

import { palette, text as corDeTexto, background, fontFamily } from "../../design/tokens.js";
import { serializarCanonico, sha256 } from "../cassete/formato.js";
import { CLASSES_DE_TOKEN } from "./tokens-de-destaque.js";
import type { ClasseDeToken } from "./tokens-de-destaque.js";

// ─── Identidade do tema ─────────────────────────────────────────────────────────

/** Nome do tema. Entra nos parametros do estagio. */
export const NOME_DO_TEMA = "editor-escuro";

/**
 * Versao do tema.
 *
 * Bump quando o MAPEAMENTO classe->token mudar. O hash cobre tambem
 * mudanca de valor dentro do token, entao a versao e legibilidade
 * humana, nao a barreira — a barreira e o hash.
 */
export const VERSAO_DO_TEMA = "1.0.0";

// ─── Estrutura ──────────────────────────────────────────────────────────────────

/** Um tema de destaque completo e auto-contido. */
export interface TemaDeDestaque {
  readonly nome: string;
  readonly versao: string;
  /** Pilha monoespacada. Muda a metrica do glifo, muda o pixel. */
  readonly fonte: string;
  /** Fundo do bloco de codigo. */
  readonly corDeFundo: string;
  /** Fundo de uma linha em `linhas_destaque`. */
  readonly corDeFundoDaLinhaDestacada: string;
  /** Cor usada quando nenhuma classe se aplica. */
  readonly corDeTextoPadrao: string;
  /** Cor por classe. Cobertura total: uma entrada por classe. */
  readonly cores: Readonly<Record<ClasseDeToken, string>>;
}

// ─── O tema padrao ──────────────────────────────────────────────────────────────

/**
 * Tema padrao.
 *
 * Toda cor abaixo e uma referencia a `src/design/tokens.ts`. As escolhas
 * de tom nao sao estetica solta: cada uma passa AA (4.5:1) contra os
 * DOIS fundos possiveis — o do bloco e o da linha destacada, que e mais
 * claro. Testar so contra o fundo escuro deixaria a linha destacada
 * ilegivel exatamente onde o video quer que voce olhe.
 * `tests/resolucao/codigo.test.ts` recomputa as razoes; nenhuma esta
 * transcrita aqui como numero.
 */
export const TEMA_PADRAO: TemaDeDestaque = {
  nome: NOME_DO_TEMA,
  versao: VERSAO_DO_TEMA,
  fonte: fontFamily.mono,
  corDeFundo: background.secondary,
  corDeFundoDaLinhaDestacada: background.elevated,
  corDeTextoPadrao: palette.gray[300],
  cores: {
    // Achromaticos: estrutura que precisa recuar.
    texto: palette.gray[300],
    pontuacao: palette.gray[300],
    identificador: corDeTexto.primary,
    comentario: corDeTexto.secondary,
    // Cromaticos: um hue por papel, para nao confundir a olho.
    "palavra-chave": palette.purple[400],
    tipo: palette.cyan[300],
    funcao: palette.blue[300],
    cadeia: palette.amber[300],
    numero: palette.green[400],
    operador: palette.red[300],
    anotacao: palette.amber[500],
  },
};

// ─── Hash ───────────────────────────────────────────────────────────────────────

/**
 * SHA-256 do tema resolvido, em JSON canonico.
 *
 * Deriva do VALOR das cores, nao do nome do tema. Um humano que troque
 * `palette.blue[300]` por `palette.blue[400]` em `src/design/tokens.ts`
 * e esqueca de bumpar qualquer versao ainda assim invalida todo cassete
 * — porque o hash mudou sozinho. Versao depende de memoria; hash, nao.
 */
export function hashDoTema(tema: TemaDeDestaque): string {
  return sha256(serializarCanonico(tema));
}

/** Hash do tema padrao, calculado uma vez. Vai para `parametros`. */
export const HASH_DO_TEMA_PADRAO = hashDoTema(TEMA_PADRAO);

/**
 * Cor de uma classe. Nunca devolve `undefined`: o tipo `Record` cobre
 * todas as classes e `CLASSES_DE_TOKEN` e a lista que o teste cobra.
 */
export function corDaClasse(tema: TemaDeDestaque, classe: ClasseDeToken): string {
  return tema.cores[classe];
}

/** Classes sem cor declarada. Vazio = tema completo. */
export function classesSemCor(tema: TemaDeDestaque): ClasseDeToken[] {
  return CLASSES_DE_TOKEN.filter((c) => {
    const cor = tema.cores[c];
    return typeof cor !== "string" || cor.trim() === "";
  });
}
