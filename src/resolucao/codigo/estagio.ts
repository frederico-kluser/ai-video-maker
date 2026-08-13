/**
 * src/resolucao/codigo/estagio.ts
 *
 * ESTAGIO DE RESOLUCAO: destaque de codigo. Card F2-05 (W4).
 *
 * Descoberto por convencao (AGENTS.md Regra 6): o arquivo se chama
 * `estagio.ts`, mora em `src/resolucao/codigo/` e tem `export default`.
 *
 * ── O que este estagio faz ─────────────────────────────────────────────
 *
 * Para cada no `Codigo.1` do manifesto, tokeniza o codigo com uma
 * gramatica LOCAL, resolve cada classe para uma cor de
 * `src/design/tokens.ts`, e publica o resultado como artefato
 * enderecado por SHA-256. `nos_codigo[<id do no>] = <hash>`.
 *
 * ── O que este estagio NAO faz, e por que isso e o ponto do card ───────
 *
 * Ele nao vai a rede. Nem no primeiro cache miss, nem nunca. A
 * tentacao do dominio e usar uma ferramenta de destaque que resolve
 * tipos consultando um host de terceiro em tempo de execucao — existe
 * uma popular, e o ADR a nomeia. Se isso rodasse no render, o video
 * deixaria de ser funcao
 * pura do manifesto: dois renders iguais, em dias diferentes, dariam
 * frames diferentes, e o segundo dependeria de um host alheio estar de
 * pe. Se rodasse aqui, teria de ser gravado no cassete. Este card
 * resolveu por eliminacao: a gramatica mora no repositorio, o cassete
 * tem zero chamadas gravadas, e existe teste que varre este diretorio
 * inteiro atras de qualquer vocabulario de rede.
 *
 * Consequencia direta: cache quente ou cache frio, com a rede aberta ou
 * fechada, a saida e a mesma. O teste prova os dois lados.
 *
 * ── O que muda o pixel, e portanto entra na chave ──────────────────────
 *
 *   tema + hashDoTema  — trocar uma cor troca o pixel. O hash deriva do
 *                        VALOR das cores, entao mexer em
 *                        `src/design/tokens.ts` invalida o cassete
 *                        sozinho, sem depender de alguem lembrar.
 *   versaoDoDestacador — mudar o motor muda a tokenizacao.
 *   versaoDasGramaticas— mudar uma regra muda a cor de um trecho.
 *   fonte              — a metrica do glifo muda a coluna.
 *   larguraDaTabulacao — muda a coluna de tudo que vem depois do tab.
 *
 * Contrato completo: docs/contrato-estagio-resolucao.md.
 * Decisoes e alternativas descartadas: docs/adr/0011-resolucao-destaque-de-codigo.md.
 */

import type { EntradaEstagio, EstagioResolucao, SaidaEstagio } from "../contrato.js";
import type { AssetResolvido } from "../manifesto-resolvido.js";
import type { ProcedenciaAsset, ProcedenciaCassete } from "../cassete/formato.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import { isNoCodigo } from "../../contratos/manifesto.js";
import {
  HASH_DO_TEMA_PADRAO,
  NOME_DO_TEMA,
  TEMA_PADRAO,
  VERSAO_DO_TEMA,
} from "./tema.js";
import {
  LARGURA_DA_TABULACAO_PADRAO,
  VERSAO_DO_DESTACADOR,
  destacar,
} from "./destacador.js";
import { VERSAO_DAS_GRAMATICAS } from "./gramaticas.js";
import {
  FORMATO_TOKENS_DE_DESTAQUE,
  hashDosTokens,
  serializarTokens,
} from "./tokens-de-destaque.js";
import type { TokensDeDestaque } from "./tokens-de-destaque.js";

// ─── Licenca ────────────────────────────────────────────────────────────────────

/**
 * Licenca do que ESTE estagio acrescenta.
 *
 * O artefato e a soma de duas coisas: a estrutura (gramatica, tema,
 * tokenizacao), escrita neste repositorio e liberada em CC0-1.0, e o
 * texto do codigo, que veio do proprio manifesto e mantem a licenca do
 * manifesto — este estagio nao adquire nada de terceiro, entao nao ha
 * um segundo titular para declarar. A nota da procedencia diz isso por
 * extenso, porque "CC0" sozinho leria como se o texto do usuario
 * tivesse sido relicenciado aqui, e nao foi.
 */
const LICENCA = "CC0-1.0";

/** Identificador de provedor. `local` e vocabulario conhecido do store. */
const PROVEDOR = "local";

// ─── Parametros ─────────────────────────────────────────────────────────────────

/**
 * Parametros do estagio. Escalares, como o contrato exige.
 *
 * `hashDoTema` e derivado, nao digitado — de proposito. Um parametro
 * digitado a mao e um parametro que alguem esquece de atualizar; um
 * parametro derivado do valor real acompanha a mudanca sozinho.
 */
export const PARAMETROS = {
  tema: NOME_DO_TEMA,
  versaoDoTema: VERSAO_DO_TEMA,
  hashDoTema: HASH_DO_TEMA_PADRAO,
  fonte: TEMA_PADRAO.fonte,
  versaoDoDestacador: VERSAO_DO_DESTACADOR,
  versaoDasGramaticas: VERSAO_DAS_GRAMATICAS,
  larguraDaTabulacao: LARGURA_DA_TABULACAO_PADRAO,
} as const;

// ─── Artefatos ──────────────────────────────────────────────────────────────────

/** Um artefato de destaque, com o endereco e os bytes que o produzem. */
export interface ArtefatoDeCodigo {
  /** Id do no de codigo do manifesto. */
  readonly no: string;
  /** SHA-256 dos bytes canonicos. E o endereco no `nos_codigo`. */
  readonly hash: string;
  /** A forma canonica, exatamente como vai para o disco. */
  readonly bytes: string;
  /** O artefato desserializado, para quem quiser inspecionar. */
  readonly tokens: TokensDeDestaque;
}

/**
 * Computa os artefatos de todos os nos de codigo de um manifesto.
 *
 * Funcao pura e exportada de proposito: a gravacao do cassete precisa
 * dos mesmos bytes que `resolver()` produziu, e recomputa-los aqui e o
 * unico jeito de garantir que sao os MESMOS bytes. Duas rotas para o
 * mesmo artefato divergem no primeiro caso de borda, e a divergencia
 * aparece como hash que nao bate — tarde.
 */
export function computarArtefatos(manifesto: Manifesto): ArtefatoDeCodigo[] {
  const artefatos: ArtefatoDeCodigo[] = [];

  for (const no of manifesto.nos) {
    if (!isNoCodigo(no)) continue;

    const resultado = destacar(no.codigo, no.linguagem, {
      tema: TEMA_PADRAO,
      larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
      linhasDestacadas: no.linhas_destaque ?? [],
    });

    const tokens: TokensDeDestaque = {
      formato: FORMATO_TOKENS_DE_DESTAQUE,
      no: no.id,
      linguagemDeclarada: no.linguagem,
      linguagem: resultado.linguagem,
      gramatica: resultado.gramatica,
      gramaticaExata: resultado.gramaticaExata,
      tema: TEMA_PADRAO.nome,
      hashDoTema: PARAMETROS.hashDoTema,
      fonte: TEMA_PADRAO.fonte,
      larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
      corDeFundo: TEMA_PADRAO.corDeFundo,
      corDeFundoDaLinhaDestacada: TEMA_PADRAO.corDeFundoDaLinhaDestacada,
      corDeTextoPadrao: TEMA_PADRAO.corDeTextoPadrao,
      ...(no.nome_arquivo !== undefined ? { nomeArquivo: no.nome_arquivo } : {}),
      linhas: resultado.linhas,
    };

    artefatos.push({
      no: no.id,
      hash: hashDosTokens(tokens),
      bytes: serializarTokens(tokens),
      tokens,
    });
  }

  // Ordem estavel por id de no: o manifesto ja e uma lista ordenada, mas
  // depender dessa ordem seria depender de quem escreveu o manifesto.
  return artefatos.sort((a, b) => (a.no < b.no ? -1 : a.no > b.no ? 1 : 0));
}

// ─── O estagio ──────────────────────────────────────────────────────────────────

const estagio: EstagioResolucao = {
  identidade: { nome: "codigo", versao: "1.0.0" },

  parametros: PARAMETROS,

  // `async` sem `await` de proposito: a assinatura do contrato e
  // assincrona porque um estagio TIPICO fala com o mundo. Este nao fala,
  // e essa e a propriedade que o card entrega.
  // eslint-disable-next-line @typescript-eslint/require-await
  async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
    const artefatos = computarArtefatos(entrada.manifesto);

    const assets: Record<string, AssetResolvido> = {};
    const nosCodigo: Record<string, string> = {};
    const procedenciaAssets: ProcedenciaAsset[] = [];

    for (const artefato of artefatos) {
      assets[artefato.hash] = {
        hash: artefato.hash,
        tipo: "dados",
        mimeType: "application/json",
        byteSize: Buffer.byteLength(artefato.bytes, "utf-8"),
        licenca: LICENCA,
        atribuicaoObrigatoria: false,
        provedor: PROVEDOR,
      };
      nosCodigo[artefato.no] = artefato.hash;
      procedenciaAssets.push({
        hash: artefato.hash,
        licenca: LICENCA,
        atribuicaoObrigatoria: false,
        provedor: PROVEDOR,
        idNoProvedor: artefato.no,
      });
    }

    const procedencia: ProcedenciaCassete = {
      licenca: LICENCA,
      provedor: PROVEDOR,
      ferramenta: `destaque-local ${VERSAO_DO_DESTACADOR} + gramaticas ${VERSAO_DAS_GRAMATICAS}`,
      assets: procedenciaAssets,
      notas:
        "Destaque pre-computado localmente. Gramatica e tema sao escritos neste " +
        "repositorio (CC0-1.0); zero material de terceiro e zero chamada externa. " +
        "O texto do codigo vem do proprio manifesto e mantem a licenca do manifesto: " +
        "este estagio transforma, nao adquire.",
    };

    return { parcial: { assets, nos_codigo: nosCodigo }, procedencia };
  },
};

export default estagio;
