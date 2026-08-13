// =============================================================================
// FRONTEIRAS — onde, em frames absolutos, as duas cenas desenham juntas
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// A ARITMETICA NAO E DESTE ARQUIVO. Ela e de ../tempo.ts (card F1-01, ja
// mergeado), e este modulo NAO a reimplementa: ele consome
// `calcularDuracao()` e usa o campo `origem` de cada fronteira para saber QUAL
// lado do manifesto venceu a precedencia. Existe uma unica implementacao da
// regra "a transicao_saida da anterior manda", e ela nao esta aqui.
//
// Reimplementar a precedencia neste arquivo teria sido o bug caro da onda: as
// duas copias concordariam na fixture canonica e divergiriam em silencio no
// primeiro manifesto que declarasse a fronteira pelo outro lado.
//
//   total = SOMA(cenas) - SOMA(fronteiras)        <- ../tempo.ts
//   janela da fronteira i = [fim(cena i) - D, fim(cena i))
//
// Nessa janela as DUAS cenas existem. E por isso que a transicao encurta o
// video: os D frames sao contados uma vez, nao duas.
// =============================================================================

import type {
  AnimacaoDirecao,
  Manifesto,
  Transicao,
  TransicaoTipo,
} from "../../contratos/manifesto";
import { calcularDuracao, type TimelineCena } from "../tempo";
import { DIRECAO_PADRAO, ErroDeTransicao, isTipoDeTransicao } from "./contrato";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Uma fronteira posicionada em frames absolutos. */
export interface JanelaDeFronteira {
  /** Indice da cena que termina (a fronteira i fica entre as cenas i e i+1) */
  indice: number;
  /** Id da cena que termina */
  cenaAnterior: string;
  /** Id da cena que comeca */
  cenaSeguinte: string;
  /** Tipo vencedor da precedencia */
  tipo: TransicaoTipo;
  /** Direcao declarada pelo lado vencedor, ou DIRECAO_PADRAO */
  direcao: AnimacaoDirecao;
  /** Duracao da sobreposicao, em frames */
  duracaoFrames: number;
  /** Qual campo do manifesto venceu: "saida" | "entrada" | "nenhuma" */
  origem: "saida" | "entrada" | "nenhuma";
  /** Primeiro frame absoluto da sobreposicao (inclusivo) */
  inicio: number;
  /** Primeiro frame absoluto DEPOIS da sobreposicao (exclusivo) */
  fim: number;
}

/** O plano de transicoes: tudo que a composicao precisa, ja conferido. */
export interface PlanoDeTransicoes {
  fps: number;
  width: number;
  height: number;
  /** Total derivado por ../tempo.ts — nunca escrito a mao */
  totalFrames: number;
  somaCenas: number;
  somaTransicoes: number;
  timeline: readonly TimelineCena[];
  /** Uma janela por par de cenas adjacentes; as de duracao 0 tambem aparecem */
  janelas: readonly JanelaDeFronteira[];
  /** So as janelas que de fato sobrepoem (duracaoFrames > 0) */
  ativas: readonly JanelaDeFronteira[];
}

/** Uma cena presente num frame absoluto, com o seu papel na fronteira. */
export interface CenaNoFrame {
  cenaId: string;
  /** Indice da cena na timeline */
  indice: number;
  /** Frame LOCAL da cena: 0 = primeiro frame da cena */
  frameLocal: number;
  /** Janela absoluta da cena */
  janela: TimelineCena;
  /** Lado da fronteira ativa, ou null quando a cena esta sozinha no frame */
  lado: "saindo" | "entrando" | null;
  /** Progresso da fronteira ativa em [0, 1); 0 quando lado e null */
  progresso: number;
  /** A fronteira ativa, ou null */
  fronteira: JanelaDeFronteira | null;
}

// ---------------------------------------------------------------------------
// Resolucao
// ---------------------------------------------------------------------------

/**
 * A `Transicao` que venceu a precedencia numa fronteira.
 *
 * NAO decide a precedencia: le `origem`, que ../tempo.ts ja decidiu. Devolve
 * `undefined` quando nenhum lado declarou nada (corte seco).
 */
export function transicaoVencedora(
  manifesto: Manifesto,
  indice: number,
  origem: "saida" | "entrada" | "nenhuma",
): Transicao | undefined {
  if (origem === "saida") {
    return manifesto.cenas[indice]?.transicao_saida;
  }
  if (origem === "entrada") {
    return manifesto.cenas[indice + 1]?.transicao_entrada;
  }
  return undefined;
}

/**
 * Posiciona cada fronteira em frames absolutos.
 *
 * LANCA `ErroDeTransicao` quando:
 * - a resolucao discorda de ../tempo.ts (invariante interna);
 * - o tipo declarado nao existe no schema;
 * - duas fronteiras se sobrepoem — tres cenas desenhando ao mesmo tempo nao
 *   e transicao, e um empilhamento sem semantica definida. ../tempo.ts nao
 *   cobre este caso (so recusa fronteira maior que a cena de saida).
 */
export function janelasDeFronteira(manifesto: Manifesto): JanelaDeFronteira[] {
  const duracao = calcularDuracao(manifesto);
  const erros: string[] = [];
  const janelas: JanelaDeFronteira[] = [];

  for (const fronteira of duracao.fronteiras) {
    const indice = fronteira.indiceAnterior;
    const cena = duracao.timeline[indice];
    if (!cena) {
      erros.push(`fronteira ${String(indice)}: cena anterior ausente na timeline`);
      continue;
    }

    const declarada = transicaoVencedora(manifesto, indice, fronteira.origem);

    // Invariante: a leitura deste modulo tem de coincidir com a de ../tempo.ts.
    // Se divergir, uma das duas esta errada — e o video sairia com a duracao
    // de uma e o desenho da outra.
    if (fronteira.origem !== "nenhuma") {
      if (!declarada) {
        erros.push(
          `fronteira ${fronteira.cenaAnterior} -> ${fronteira.cenaSeguinte}: ` +
            `tempo.ts diz origem "${fronteira.origem}" mas o campo esta ausente`,
        );
        continue;
      }
      if (
        declarada.tipo !== fronteira.tipo ||
        declarada.duracao_frames !== fronteira.duracaoFrames
      ) {
        erros.push(
          `fronteira ${fronteira.cenaAnterior} -> ${fronteira.cenaSeguinte}: ` +
            `divergencia com tempo.ts (tempo: ${fronteira.tipo}/` +
            `${String(fronteira.duracaoFrames)}; manifesto: ${declarada.tipo}/` +
            `${String(declarada.duracao_frames)})`,
        );
        continue;
      }
    }

    if (!isTipoDeTransicao(fronteira.tipo)) {
      erros.push(
        `fronteira ${fronteira.cenaAnterior} -> ${fronteira.cenaSeguinte}: ` +
          `tipo "${fronteira.tipo}" nao existe no schema`,
      );
      continue;
    }

    janelas.push({
      indice,
      cenaAnterior: fronteira.cenaAnterior,
      cenaSeguinte: fronteira.cenaSeguinte,
      tipo: fronteira.tipo,
      direcao: declarada?.direcao ?? DIRECAO_PADRAO,
      duracaoFrames: fronteira.duracaoFrames,
      origem: fronteira.origem,
      inicio: cena.frameFinal - fronteira.duracaoFrames,
      fim: cena.frameFinal,
    });
  }

  // Duas fronteiras sobrepostas colocariam TRES cenas no mesmo frame.
  const ativas = janelas.filter((j) => j.duracaoFrames > 0);
  for (let i = 1; i < ativas.length; i++) {
    const anterior = ativas[i - 1]!;
    const atual = ativas[i]!;
    if (atual.inicio < anterior.fim) {
      erros.push(
        `fronteiras sobrepostas: ${anterior.cenaAnterior}->${anterior.cenaSeguinte} ` +
          `ocupa [${String(anterior.inicio)}, ${String(anterior.fim)}) e ` +
          `${atual.cenaAnterior}->${atual.cenaSeguinte} comeca em ` +
          `${String(atual.inicio)} — tres cenas no mesmo frame nao e transicao`,
      );
    }
  }

  if (erros.length > 0) {
    throw new ErroDeTransicao(erros);
  }

  return janelas;
}

/** Monta o plano de transicoes inteiro. */
export function planoDeTransicoes(manifesto: Manifesto): PlanoDeTransicoes {
  const duracao = calcularDuracao(manifesto);
  const janelas = janelasDeFronteira(manifesto);

  return {
    fps: manifesto.fps,
    width: manifesto.width,
    height: manifesto.height,
    totalFrames: duracao.totalFrames,
    somaCenas: duracao.somaCenas,
    somaTransicoes: duracao.somaTransicoes,
    timeline: duracao.timeline,
    janelas: Object.freeze(janelas),
    ativas: Object.freeze(janelas.filter((j) => j.duracaoFrames > 0)),
  };
}

// ---------------------------------------------------------------------------
// Consulta por frame
// ---------------------------------------------------------------------------

/**
 * Progresso de um frame absoluto dentro de uma janela.
 * 0 no primeiro frame da sobreposicao; nunca 1, porque o frame em que valeria
 * 1 e justamente o primeiro em que a cena que sai ja nao existe.
 */
export function progressoNaJanela(janela: JanelaDeFronteira, frame: number): number {
  if (janela.duracaoFrames <= 0) return 0;
  return (frame - janela.inicio) / janela.duracaoFrames;
}

/** A fronteira ativa num frame absoluto, ou null. */
export function fronteiraNoFrame(
  plano: PlanoDeTransicoes,
  frame: number,
): JanelaDeFronteira | null {
  for (const janela of plano.ativas) {
    if (frame >= janela.inicio && frame < janela.fim) {
      return janela;
    }
  }
  return null;
}

/**
 * As cenas presentes num frame absoluto, na ordem de pintura:
 * a que sai primeiro, a que entra por cima.
 *
 * Fora de uma fronteira devolve exatamente uma cena; dentro, exatamente duas.
 */
export function cenasNoFrame(plano: PlanoDeTransicoes, frame: number): CenaNoFrame[] {
  const fronteira = fronteiraNoFrame(plano, frame);
  const progresso = fronteira ? progressoNaJanela(fronteira, frame) : 0;
  const presentes: CenaNoFrame[] = [];

  for (let indice = 0; indice < plano.timeline.length; indice++) {
    const janela = plano.timeline[indice]!;
    if (frame < janela.frameInicial || frame >= janela.frameFinal) continue;

    let lado: "saindo" | "entrando" | null = null;
    if (fronteira) {
      if (janela.cenaId === fronteira.cenaAnterior) lado = "saindo";
      else if (janela.cenaId === fronteira.cenaSeguinte) lado = "entrando";
    }

    presentes.push({
      cenaId: janela.cenaId,
      indice,
      frameLocal: frame - janela.frameInicial,
      janela,
      lado,
      progresso: lado === null ? 0 : progresso,
      fronteira: lado === null ? null : fronteira,
    });
  }

  // Ordem de pintura: indice crescente = a que sai antes da que entra.
  presentes.sort((a, b) => a.indice - b.indice);
  return presentes;
}

/**
 * Censo frame a frame: quantos frames cada cena ocupa e em quantos frames
 * duas cenas desenham juntas.
 *
 * E a conferencia INDEPENDENTE do total: em vez de reler o numero que
 * ../tempo.ts calculou, percorre o video inteiro e conta. Se a composicao
 * desenhar de menos, o censo acusa — o total continuaria "certo" no papel.
 */
export interface Censo {
  totalFrames: number;
  /** Frames em que exatamente uma cena desenha */
  framesComUmaCena: number;
  /** Frames em que exatamente duas cenas desenham (a sobreposicao) */
  framesComDuasCenas: number;
  /** Frames sem nenhuma cena — sempre 0; qualquer outro valor e quadro preto */
  framesVazios: number;
  /** Frames desenhados por cena, na ordem da timeline */
  framesPorCena: readonly { cenaId: string; frames: number }[];
  /** Soma de framesPorCena — deve bater com somaCenas */
  somaDesenhada: number;
}

export function censoDeFrames(plano: PlanoDeTransicoes): Censo {
  const porCena = new Map<string, number>();
  for (const t of plano.timeline) porCena.set(t.cenaId, 0);

  let framesComUmaCena = 0;
  let framesComDuasCenas = 0;
  let framesVazios = 0;

  for (let frame = 0; frame < plano.totalFrames; frame++) {
    const presentes = cenasNoFrame(plano, frame);
    if (presentes.length === 0) framesVazios++;
    else if (presentes.length === 1) framesComUmaCena++;
    else framesComDuasCenas++;

    for (const cena of presentes) {
      porCena.set(cena.cenaId, (porCena.get(cena.cenaId) ?? 0) + 1);
    }
  }

  const framesPorCena = plano.timeline.map((t) => ({
    cenaId: t.cenaId,
    frames: porCena.get(t.cenaId) ?? 0,
  }));

  return {
    totalFrames: plano.totalFrames,
    framesComUmaCena,
    framesComDuasCenas,
    framesVazios,
    framesPorCena,
    somaDesenhada: framesPorCena.reduce((soma, c) => soma + c.frames, 0),
  };
}
