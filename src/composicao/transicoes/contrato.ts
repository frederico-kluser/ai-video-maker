// =============================================================================
// CONTRATO DE APRESENTACAO — a interface que toda transicao implementa
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Uma transicao NAO e um efeito aplicado "no meio" de duas cenas. Ela e um par
// de APRESENTACOES aplicadas as DUAS cenas AO MESMO TEMPO, sobre a mesma
// janela de frames. Se so um lado desenha, o que existe e um corte, nao uma
// transicao — e o video fica com um flash preto ou um salto invisivel no
// diff de bytes.
//
// O progresso chega por PROP, derivado do frame absoluto pela aritmetica de
// ../tempo.ts. Nenhum hook, nenhum relogio, nenhuma animacao CSS: o tempo e
// do frame, nunca do navegador.
//
// Fonte: https://www.remotion.dev/docs/transitions/presentations (2026-08-11)
//        — a presentation do Remotion recebe `presentationProgress` e
//          `presentationDirection` ("entering" | "exiting") e envolve os dois
//          lados; adotamos a mesma forma, com o progresso por prop.
// =============================================================================

import type React from "react";
import type { AnimacaoDirecao, TransicaoTipo } from "../../contratos/manifesto";

// ---------------------------------------------------------------------------
// Tipos de transicao — espelho do enum do schema
// ---------------------------------------------------------------------------

/**
 * Os tipos que `schema/manifesto.schema.json` declara em `Transicao.tipo`.
 * Esta lista NAO e escolha deste card: e o enum do schema (singleton S-4).
 * O gate cobra que exista apresentacao para cada um — o schema e o
 * denominador, o registro e o numerador.
 */
export const TIPOS_DE_TRANSICAO = [
  "clockWipe",
  "cube",
  "fade",
  "flip",
  "none",
  "slide",
  "wipe",
] as const satisfies readonly TransicaoTipo[];

/** Verifica se uma string e um tipo de transicao do schema. */
export function isTipoDeTransicao(valor: string): valor is TransicaoTipo {
  return (TIPOS_DE_TRANSICAO as readonly string[]).includes(valor);
}

/** Direcao adotada quando o manifesto nao declara nenhuma. */
export const DIRECAO_PADRAO: AnimacaoDirecao = "from-left";

// ---------------------------------------------------------------------------
// Lados da fronteira
// ---------------------------------------------------------------------------

/**
 * Qual das duas cenas esta sendo desenhada.
 * - `saindo`   — a cena ANTERIOR, que termina nesta fronteira
 * - `entrando` — a cena SEGUINTE, que comeca nesta fronteira
 *
 * Durante a fronteira os dois existem na arvore ao mesmo tempo. E isso que
 * distingue transicao de corte.
 */
export type LadoDaTransicao = "saindo" | "entrando";

/** Os dois lados, em ordem de pintura (o que sai primeiro, o que entra por cima). */
export const LADOS: readonly LadoDaTransicao[] = ["saindo", "entrando"];

// ---------------------------------------------------------------------------
// Props da apresentacao
// ---------------------------------------------------------------------------

/**
 * Props que toda apresentacao de transicao recebe.
 *
 * `progresso` e o unico eixo de tempo: 0 no primeiro frame da sobreposicao,
 * tendendo a 1 no ultimo. Ele NUNCA chega a 1 exato, porque o frame em que
 * valeria 1 e justamente o primeiro frame em que a cena que sai ja nao existe.
 */
export interface ApresentacaoProps {
  /** Progresso da fronteira em [0, 1) */
  progresso: number;
  /** Qual cena esta sendo desenhada */
  lado: LadoDaTransicao;
  /** Direcao declarada no manifesto (ou DIRECAO_PADRAO) */
  direcao: AnimacaoDirecao;
  /** Largura do canvas em pixels */
  width: number;
  /** Altura do canvas em pixels */
  height: number;
  /** A cena inteira, ja pintada */
  children: React.ReactNode;
}

/**
 * Apresentacao de transicao.
 *
 * Contrato (cobrado por `just comp-pureza` e por tests/composicao/transicoes.test.ts):
 * - funcao pura de (progresso, lado, direcao, width, height)
 * - nenhum useCurrentFrame(), nenhum Date.now(), Math.random(), setTimeout(), fetch()
 * - nenhuma animacao CSS, nenhum background-image, nenhum mask-image
 * - toda interpolacao com extrapolateLeft/extrapolateRight explicitos
 * - o mesmo componente desenha os DOIS lados; nunca devolve null
 */
export type Apresentacao = React.FC<ApresentacaoProps>;

// ---------------------------------------------------------------------------
// Metadados — cada apresentacao se auto-declara
// ---------------------------------------------------------------------------

/**
 * Metadados que toda apresentacao DEVE exportar com o nome `meta`.
 * A convencao de descoberta e `apresentacoes/<tipo>.tsx`, e o gate cobra que
 * `meta.tipo` case com o nome do arquivo.
 */
export interface ApresentacaoMeta {
  /** Tipo de transicao do schema (ex.: "fade") */
  tipo: TransicaoTipo;
  /** Identificador unico no repositorio inteiro */
  id: string;
  /** O que a apresentacao desenha */
  descricao: string;
  /**
   * Os dois lados contribuem VISIVELMENTE no mesmo pixel durante a fronteira?
   *
   * - `sobrepostos` — os dois lados pintam a mesma regiao (fade)
   * - `repartidos`  — os dois lados pintam regioes disjuntas da tela
   *                   (wipe, clockWipe, slide, cube)
   * - `alternados`  — os dois estao na arvore, mas so um e visivel de cada vez
   *                   (flip, por causa do backface; none, por sobreposicao opaca)
   *
   * Isto NAO e enfeite: e o que o teste de "os dois lados desenham" usa para
   * saber o que exigir do pixel. Declarar `sobrepostos` e nao misturar cor
   * derruba o gate.
   */
  contribuicao: "sobrepostos" | "repartidos" | "alternados";
}

/** Uma apresentacao ja validada: metadados + componente. */
export interface ModuloDeApresentacao {
  meta: ApresentacaoMeta;
  apresentacao: Apresentacao;
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/** Erro de transicao: fronteira que esta camada se recusa a compor. */
export class ErroDeTransicao extends Error {
  readonly erros: readonly string[];
  constructor(erros: readonly string[]) {
    super(
      `Composicao de transicoes recusada (${erros.length} erro(s)):\n` +
        erros.map((e) => `  - ${e}`).join("\n"),
    );
    this.name = "ErroDeTransicao";
    this.erros = erros;
  }
}

// ---------------------------------------------------------------------------
// Validacao dos metadados
// ---------------------------------------------------------------------------

function textoNaoVazio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

const CONTRIBUICOES = new Set(["sobrepostos", "repartidos", "alternados"]);

/**
 * Valida o `meta` de uma apresentacao contra o nome do arquivo.
 * Devolve a lista de erros (vazia = valido). NUNCA ignora em silencio.
 */
export function validarMetaDeApresentacao(
  valor: unknown,
  tipoDoArquivo: string,
  origem: string,
): string[] {
  const erros: string[] = [];

  if (valor === null || typeof valor !== "object") {
    erros.push(
      `${origem}: nao exporta \`meta\` (esperado ApresentacaoMeta, veio ${typeof valor})`,
    );
    return erros;
  }

  const meta = valor as Partial<ApresentacaoMeta>;

  for (const campo of ["tipo", "id", "descricao"] as const) {
    if (!textoNaoVazio(meta[campo])) {
      erros.push(`${origem}: meta.${campo} ausente ou vazio`);
    }
  }

  if (!textoNaoVazio(meta.contribuicao) || !CONTRIBUICOES.has(meta.contribuicao)) {
    erros.push(
      `${origem}: meta.contribuicao invalida (${String(meta.contribuicao)}); ` +
        `validas: sobrepostos, repartidos, alternados`,
    );
  }

  if (textoNaoVazio(meta.tipo)) {
    if (!isTipoDeTransicao(meta.tipo)) {
      erros.push(
        `${origem}: meta.tipo "${meta.tipo}" nao e um tipo de transicao do schema ` +
          `(validos: ${TIPOS_DE_TRANSICAO.join(", ")})`,
      );
    }
    if (meta.tipo !== tipoDoArquivo) {
      erros.push(
        `${origem}: meta.tipo "${meta.tipo}" nao casa com o nome do arquivo ` +
          `"${tipoDoArquivo}" (descoberta por convencao: <tipo>.tsx)`,
      );
    }
  }

  return erros;
}

// ---------------------------------------------------------------------------
// Formatacao deterministica de numeros em CSS
// ---------------------------------------------------------------------------
//
// Float cru em string de CSS e uma fonte silenciosa de diff: 33.33333333333333
// contra 33.333333333333336 muda o markup sem mudar o pixel, e derruba o
// snapshot de texto sem nenhuma regressao real. Arredonda-se UMA VEZ, aqui.

/** Casas decimais usadas em toda saida CSS desta camada. */
export const CASAS_DECIMAIS = 4;

/** Numero -> porcentagem CSS com casas fixas. */
export function porcento(valor: number): string {
  return `${valor.toFixed(CASAS_DECIMAIS)}%`;
}

/** Numero -> angulo CSS com casas fixas. */
export function angulo(valor: number): string {
  return `${valor.toFixed(CASAS_DECIMAIS)}deg`;
}

/** Numero -> comprimento CSS em pixels com casas fixas. */
export function pixels(valor: number): string {
  return `${valor.toFixed(CASAS_DECIMAIS)}px`;
}

/** Eixo geometrico de uma direcao: horizontal (left/right) ou vertical. */
export function eixoDaDirecao(direcao: AnimacaoDirecao): "horizontal" | "vertical" {
  return direcao === "from-left" || direcao === "from-right" ? "horizontal" : "vertical";
}

/**
 * Sinal da direcao: +1 quando o conteudo que entra vem do lado
 * negativo do eixo (from-left, from-top), -1 caso contrario.
 */
export function sinalDaDirecao(direcao: AnimacaoDirecao): 1 | -1 {
  return direcao === "from-left" || direcao === "from-top" ? 1 : -1;
}
