// =============================================================================
// CONTRATO DE CAMADA — a interface que toda camada global implementa
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Uma camada global e uma FUNCAO PURA de (frame, fps, width, height, duracao).
// Como o no de F1-01, ela recebe o frame por PROP e nunca chama
// useCurrentFrame(): e isso que a torna renderizavel e mensuravel sem
// navegador e sem runtime do Remotion.
//
// O QUE ESTE CONTRATO ACRESCENTA AO CONTRATO DE NO
//
// Toda camada declara, em numero, o conjunto de retangulos que ela pinta —
// `planoDe(props)`. O componente NAO desenha nada que nao esteja no plano:
// ele e literalmente `plano.map(...)`. Isso existe por um motivo especifico:
//
//   uma vinheta ou uma grade decorativa que invade a safe area COME O
//   CONTEUDO, e o build passa, porque tecnicamente tudo renderizou.
//
// Com o plano em numero, "nao cobre a safe area" deixa de ser uma opiniao
// sobre a imagem e vira uma comparacao de area: `areaDaIntersecao(...) === 0`.
// E o gate de pixel confere que o plano nao mente — que os pixels que mudaram
// no render de verdade estao todos dentro dos retangulos declarados.
// =============================================================================

import type React from "react";
import { interpolate } from "remotion";
import {
  msToFrames,
  safeArea16x9,
  transitionDuration,
  zIndex,
} from "../../design/tokens";
import {
  areaDe,
  contem,
  intersecaoDe,
  type Retangulo,
} from "./geometria";
import { OPACIDADE_MINIMA_VISIVEL } from "./tokens-de-camada";

// ---------------------------------------------------------------------------
// Papel — o que decide se a camada pode ou nao encostar na safe area
// ---------------------------------------------------------------------------

/**
 * `fundo`        — desenhada ABAIXO do conteudo. Pode ocupar o quadro inteiro
 *                  porque o conteudo a cobre; nunca come nada.
 * `sobreposicao` — desenhada ACIMA do conteudo. Cada pixel dela apaga um pixel
 *                  de conteudo, e por isso ela e proibida dentro da safe area.
 */
export const PAPEIS_DE_CAMADA = ["fundo", "sobreposicao"] as const;

export type PapelDeCamada = (typeof PAPEIS_DE_CAMADA)[number];

/** z-index canonico de cada papel — vem de tokens.zIndex, nunca de literal. */
export const Z_INDEX_POR_PAPEL: Record<PapelDeCamada, number> = {
  fundo: zIndex.background,
  sobreposicao: zIndex.overlay,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props que toda camada global recebe. Fechado, como o contrato de no. */
export interface CamadaProps {
  /** Frame LOCAL: 0 = primeiro frame da janela declarada desta camada */
  frame: number;
  /** Frames por segundo da composicao */
  fps: number;
  /** Largura do canvas em pixels */
  width: number;
  /** Altura do canvas em pixels */
  height: number;
  /** Janela declarada da camada, em frames. Fora dela a camada nao desenha. */
  duracaoEmFrames: number;
}

/**
 * Componente de camada global.
 *
 * Contrato (cobrado por `just comp-pureza` e por `just no-camadas`):
 * - funcao pura de (frame, fps, width, height, duracaoEmFrames);
 * - `frame` vem por prop — nada de useCurrentFrame();
 * - zero Date.now(), Math.random(), setTimeout(), fetch();
 * - zero animacao CSS, zero background-image, zero mask-image;
 * - toda interpolacao com extrapolateLeft/extrapolateRight explicitos;
 * - nada desenhado fora da janela `[0, duracaoEmFrames)`;
 * - se `papel === "sobreposicao"`, nenhum retangulo pintado toca a safe area.
 */
export type CamadaComponent = React.FC<CamadaProps>;

// ---------------------------------------------------------------------------
// Plano de pintura — o que torna a camada mensuravel
// ---------------------------------------------------------------------------

/**
 * Um retangulo que a camada declara que vai pintar.
 * `nome` existe para a mensagem de erro apontar QUAL retangulo invadiu.
 */
export interface RetanguloPintado extends Retangulo {
  nome: string;
  /** Opacidade efetiva do retangulo, em [0, 1]. */
  opacidade: number;
  /** Cor de preenchimento — sempre um token de src/design/tokens.ts. */
  cor: string;
}

/** Funcao pura que devolve o plano de pintura da camada para um dado frame. */
export type PlanoDeCamada = (props: CamadaProps) => RetanguloPintado[];

/**
 * Filtra o plano para o que de fato vira pixel: retangulo degenerado ou
 * opacidade abaixo do limiar de 8 bits NAO entra no plano.
 *
 * Nao e cosmetica. O gate de pixel exige que TODO retangulo declarado tenha
 * ao menos um pixel diferente no render — e um retangulo declarado que nao
 * pinta nada e exatamente o quadro-vazio disfarcado que este card persegue.
 * Declarar so o que pinta e o que mantem essa assercao afiada.
 */
export function apenasVisiveis(retangulos: RetanguloPintado[]): RetanguloPintado[] {
  return retangulos.filter(
    (r) => areaDe(r) > 0 && r.opacidade >= OPACIDADE_MINIMA_VISIVEL,
  );
}

// ---------------------------------------------------------------------------
// Metadados — cada camada se auto-declara
// ---------------------------------------------------------------------------

/** Metadados que toda camada DEVE exportar com o nome `meta`. */
export interface CamadaMeta {
  /** Nome da camada; casa com o nome do arquivo (`<nome>.tsx`) */
  nome: string;
  /** Identificador unico no repositorio inteiro */
  id: string;
  /** Papel — decide se a camada pode encostar na safe area */
  papel: PapelDeCamada;
  /** Breve descricao do que a camada desenha */
  descricao: string;
}

/** Modulo de camada ja validado. */
export interface ModuloDeCamada {
  meta: CamadaMeta;
  componente: CamadaComponent;
  plano: PlanoDeCamada;
}

// ---------------------------------------------------------------------------
// A safe area — o retangulo que nenhuma sobreposicao pode tocar
// ---------------------------------------------------------------------------

/**
 * Margem segura em pixels, derivada do PERCENTUAL do token, nunca do valor
 * absoluto: o absoluto de tokens.safeArea16x9 vale so para 1920x1080 e este
 * contrato precisa valer em qualquer resolucao.
 *
 * Qual dos dois percentuais: o de ACTION SAFE (3.5%), nao o de graphics safe
 * (5%). O retangulo de action safe e o MAIOR dos dois — ele contem o de
 * graphics safe. Proteger o maior protege os dois; proteger o menor deixaria
 * uma faixa de 29 pixels onde a decoracao e o conteudo se sobrepoem sem que
 * gate nenhum perceba. Cobrado em teste: `retanguloSeguro` contem
 * `graphicsSafe`, e bate pixel a pixel com `actionSafe` em 1920x1080.
 */
export function margemSegura(largura: number, altura: number): {
  horizontal: number;
  vertical: number;
} {
  return {
    horizontal: Math.round(largura * safeArea16x9.actionSafePct),
    vertical: Math.round(altura * safeArea16x9.actionSafePct),
  };
}

/** O retangulo de conteudo que nenhuma camada de sobreposicao pode tocar. */
export function retanguloSeguro(largura: number, altura: number): Retangulo {
  const margem = margemSegura(largura, altura);
  return {
    x: margem.horizontal,
    y: margem.vertical,
    largura: largura - 2 * margem.horizontal,
    altura: altura - 2 * margem.vertical,
  };
}

/** O quadro inteiro, como retangulo. */
export function retanguloDoQuadro(largura: number, altura: number): Retangulo {
  return { x: 0, y: 0, largura, altura };
}

// ---------------------------------------------------------------------------
// Janela declarada — a camada nao desenha fora da propria duracao
// ---------------------------------------------------------------------------

/**
 * `true` quando o frame esta FORA da janela `[0, duracaoEmFrames)`.
 * Uma camada global cobre a composicao inteira; se ela desenhar em frame
 * negativo ou depois do fim, ela esta desenhando fora da propria janela — e
 * numa composicao encadeada isso vaza para o video do vizinho.
 */
export function foraDaJanela(frame: number, duracaoEmFrames: number): boolean {
  return frame < 0 || frame >= duracaoEmFrames;
}

/**
 * Duracao da rampa de entrada/saida da camada, em frames.
 * Vem de tokens.transitionDuration.base, convertida uma unica vez pela funcao
 * de token (`msToFrames`) — o arredondamento acontece na camada de token, nao
 * espalhado por tres componentes.
 */
export function rampaEmFrames(fps: number): number {
  return Math.max(1, msToFrames(transitionDuration.base, fps));
}

/**
 * Envelope de opacidade da camada dentro da propria janela: sobe na entrada,
 * fica em 1, desce na saida. FORA da janela devolve 0 — e os componentes
 * devolvem `null` antes disso, para nao existir nem no DOM.
 *
 * Toda interpolacao com extrapolateLeft/extrapolateRight explicitos: o default
 * do Remotion e `extend`, nao `clamp` (AGENTS.md, armadilhas de dominio), e um
 * fade que extrapola devolve opacidade negativa ou maior que 1 sem erro nenhum.
 */
export function opacidadeDaJanela(props: CamadaProps): number {
  const { frame, fps, duracaoEmFrames } = props;
  if (foraDaJanela(frame, duracaoEmFrames)) return 0;

  const rampa = rampaEmFrames(fps);
  // Janela curta demais para duas rampas: entra, nao sai.
  const rampaDeSaida = Math.min(rampa, Math.max(0, duracaoEmFrames - rampa));

  const entrada = interpolate(frame, [0, rampa], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (rampaDeSaida === 0) return entrada;

  const saida = interpolate(
    frame,
    [duracaoEmFrames - rampaDeSaida - 1, duracaoEmFrames - 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return Math.min(entrada, saida);
}

// ---------------------------------------------------------------------------
// Medicao — a assercao que da nome ao card
// ---------------------------------------------------------------------------

/** Um retangulo declarado que invade a safe area, com a area invadida. */
export interface Invasao {
  camada: string;
  retangulo: string;
  areaInvadida: number;
  intersecao: Retangulo;
}

/**
 * Mede a invasao da safe area por um plano de pintura.
 *
 * MEDE, nao olha: devolve a lista de retangulos cuja intersecao com a safe
 * area tem area maior que zero, com o numero da area invadida em cada um.
 * Camada de papel `fundo` nunca invade por definicao (ela e desenhada abaixo
 * do conteudo) e por isso devolve lista vazia — mas o gate de pixel continua
 * cobrando dela a mesma propriedade no render de verdade, e la o z-index e
 * cobrado junto.
 */
export function medirInvasaoDaSafeArea(
  modulo: ModuloDeCamada,
  props: CamadaProps,
): Invasao[] {
  if (modulo.meta.papel === "fundo") return [];
  const seguro = retanguloSeguro(props.width, props.height);
  const invasoes: Invasao[] = [];
  for (const r of modulo.plano(props)) {
    const intersecao = intersecaoDe(r, seguro);
    const area = areaDe(intersecao);
    if (area > 0) {
      invasoes.push({
        camada: modulo.meta.nome,
        retangulo: r.nome,
        areaInvadida: area,
        intersecao,
      });
    }
  }
  return invasoes;
}

/** Retangulos do plano que escapam do quadro — camada nao pinta fora da tela. */
export function retangulosForaDoQuadro(
  modulo: ModuloDeCamada,
  props: CamadaProps,
): RetanguloPintado[] {
  const quadro = retanguloDoQuadro(props.width, props.height);
  return modulo.plano(props).filter((r) => !contem(quadro, r));
}

// ---------------------------------------------------------------------------
// Validacao do contrato — usada pelo gate, nao pelo caminho de render
// ---------------------------------------------------------------------------

function textoNaoVazio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

/** `true` se o valor e um papel de camada valido. */
export function isPapelDeCamada(valor: string): valor is PapelDeCamada {
  return (PAPEIS_DE_CAMADA as readonly string[]).includes(valor);
}

/**
 * Valida um modulo de camada inteiro: `meta` + `default` + `plano`.
 * Devolve `{ modulo, erros }`. Se `erros` nao for vazio, `modulo` e null e
 * quem chama DEVE falhar — nunca seguir adiante ignorando o arquivo torto.
 */
export function validarModuloDeCamada(
  modulo: unknown,
  nomeDoArquivo: string,
  origem: string,
): { modulo: ModuloDeCamada | null; erros: string[] } {
  const erros: string[] = [];

  if (modulo === null || typeof modulo !== "object") {
    return {
      modulo: null,
      erros: [`${origem}: modulo nao pode ser carregado (veio ${typeof modulo})`],
    };
  }

  const registro = modulo as Record<string, unknown>;
  const meta = registro["meta"];

  if (meta === null || typeof meta !== "object") {
    erros.push(
      `${origem}: nao exporta \`meta\` (esperado objeto CamadaMeta, veio ${typeof meta})`,
    );
  } else {
    const m = meta as Partial<CamadaMeta>;
    for (const campo of ["nome", "id", "papel", "descricao"] as const) {
      if (!textoNaoVazio(m[campo])) {
        erros.push(`${origem}: meta.${campo} ausente ou vazio`);
      }
    }
    if (textoNaoVazio(m.papel) && !isPapelDeCamada(m.papel)) {
      erros.push(
        `${origem}: meta.papel "${m.papel}" nao e papel de camada ` +
          `(validos: ${PAPEIS_DE_CAMADA.join(", ")})`,
      );
    }
    if (textoNaoVazio(m.nome) && m.nome !== nomeDoArquivo) {
      erros.push(
        `${origem}: meta.nome "${m.nome}" nao casa com o nome do arquivo ` +
          `"${nomeDoArquivo}" (descoberta por convencao: <nome>.tsx)`,
      );
    }
  }

  if (typeof registro["default"] !== "function") {
    erros.push(
      `${origem}: nao exporta \`default\` como componente ` +
        `(esperado funcao, veio ${typeof registro["default"]})`,
    );
  }

  if (typeof registro["plano"] !== "function") {
    erros.push(
      `${origem}: nao exporta \`plano\` — sem plano de pintura a camada e ` +
        `imensuravel, e "nao cobre a safe area" vira opiniao sobre a imagem`,
    );
  }

  if (erros.length > 0) return { modulo: null, erros };

  return {
    modulo: {
      meta: registro["meta"] as CamadaMeta,
      componente: registro["default"] as CamadaComponent,
      plano: registro["plano"] as PlanoDeCamada,
    },
    erros: [],
  };
}
