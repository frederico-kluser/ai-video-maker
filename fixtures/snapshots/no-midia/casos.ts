// =============================================================================
// CASOS DE SNAPSHOT DO NO DE MIDIA — F1-07
// =============================================================================
// Fonte unica dos casos. Tres consumidores leem DAQUI:
//
//   fixtures/snapshots/no-midia/entrada.tsx  — as composicoes do render
//   tools/no-midia/marcacao.ts               — a marcacao aprovada
//   tools/no-midia/provar.ts                 — os stills aprovados
//   tests/composicao/no-midia.test.ts        — as assercoes
//
// Uma tabela em quatro lugares diverge no primeiro merge; uma tabela em um
// lugar so nao tem como divergir.
//
// SEM react-dom aqui: este modulo entra no bundle do Remotion via entrada.tsx.
// Dado, e nada alem de dado.
// =============================================================================

import type { Manifesto, No, NoMidia } from "../../../src/contratos/manifesto";
import manifestoCanonicoJson from "../../canonico/manifesto-valido.json";

const MANIFESTO = manifestoCanonicoJson as unknown as Manifesto;

/** fps/width/height que os casos usam — os da propria fixture canonica. */
export const FPS = MANIFESTO.fps;
export const LARGURA = MANIFESTO.width;
export const ALTURA = MANIFESTO.height;

/**
 * Acha um no de midia da fixture canonica pelo id, ou estoura.
 *
 * Assercao sobre a PRESENCA do no que ESTE card usa. Nunca sobre a lista
 * completa de nos da fixture: os irmaos de W4 tem o mesmo direito de
 * acrescentar, e uma assercao de lista fechada seria verdade contra esta base
 * e falsa depois do merge deles (contrato da W4, §5).
 */
export function noDeMidiaDaFixture(id: string): NoMidia {
  const achado = MANIFESTO.nos.find((no: No) => no.id === id);
  if (achado === undefined) {
    throw new Error(
      `fixture canonica sem o no "${id}", que os snapshots de F1-07 exigem`,
    );
  }
  if (achado.type !== "midia") {
    throw new Error(
      `no "${id}" da fixture canonica e "${achado.type}", nao "midia"`,
    );
  }
  return achado;
}

/** Id da composicao do render para cada tipo de midia. */
export const COMPOSICAO_POR_TIPO = {
  imagem: "no-midia-imagem",
  video: "no-midia-video",
  gif: "no-midia-gif",
} as const;

/** Os tres nos de midia da fixture canonica, um por tipo do schema. */
export const NO_IMAGEM = "n-005";
export const NO_VIDEO = "n-006";
export const NO_GIF = "n-007";

// ---------------------------------------------------------------------------
// Casos de MARCACAO — a arvore que o componente puro emite
// ---------------------------------------------------------------------------

export interface CasoDeMarcacao {
  /** Nome do arquivo aprovado, sem diretorio */
  arquivo: string;
  /** Id do no na fixture canonica */
  noId: string;
  /** Frame LOCAL do no */
  frame: number;
  /** Por que este frame esta na lista */
  porque: string;
}

/**
 * Frames escolhidos, nao sorteados. Cada linha diz o que quebraria se ela
 * sumisse.
 */
export const CASOS_DE_MARCACAO: readonly CasoDeMarcacao[] = [
  {
    arquivo: "marcacao-imagem-f000.html",
    noId: NO_IMAGEM,
    frame: 0,
    porque: "primeiro frame; a entrada declarada no manifesto comeca aqui",
  },
  {
    arquivo: "marcacao-imagem-f005.html",
    noId: NO_IMAGEM,
    frame: 5,
    porque: "meio da entrada de 10 frames — opacidade interpolada",
  },
  {
    arquivo: "marcacao-imagem-f045.html",
    noId: NO_IMAGEM,
    frame: 45,
    porque: "regime permanente, depois da entrada",
  },
  {
    arquivo: "marcacao-imagem-f089.html",
    noId: NO_IMAGEM,
    frame: 89,
    porque: "ultimo frame VISIVEL (duracao 90) — a borda da janela",
  },
  {
    arquivo: "marcacao-video-f000.html",
    noId: NO_VIDEO,
    frame: 0,
    porque: "animacao 'none': opaco desde o frame 0, sem fade inventado",
  },
  {
    arquivo: "marcacao-video-f030.html",
    noId: NO_VIDEO,
    frame: 30,
    porque: "meio da janela de 60 frames",
  },
  {
    arquivo: "marcacao-gif-f000.html",
    noId: NO_GIF,
    frame: 0,
    porque: "quadro 0 do GIF",
  },
  {
    arquivo: "marcacao-gif-f001.html",
    noId: NO_GIF,
    frame: 1,
    porque: "MESMO quadro do GIF que f000 — a fita nao pode mudar",
  },
  {
    arquivo: "marcacao-gif-f003.html",
    noId: NO_GIF,
    frame: 3,
    porque: "quadro 1 do GIF — a fita TEM de mudar",
  },
  {
    arquivo: "marcacao-gif-f006.html",
    noId: NO_GIF,
    frame: 6,
    porque: "quadro 2 do GIF",
  },
  {
    arquivo: "marcacao-gif-f044.html",
    noId: NO_GIF,
    frame: 44,
    porque: "ultimo frame VISIVEL do GIF (duracao 45)",
  },
];

// ---------------------------------------------------------------------------
// Casos de STILL — o pixel que sai do render de verdade
// ---------------------------------------------------------------------------

export interface CasoDeStill {
  /** Nome do arquivo aprovado, sem diretorio */
  arquivo: string;
  /** Id da composicao registrada em entrada.tsx */
  composicao: string;
  /** Frame LOCAL do no */
  frame: number;
  /** Por que este frame esta na lista */
  porque: string;
}

/**
 * Menos casos que na marcacao, de proposito: cada still custa dois renders de
 * Chrome. O que NAO pode faltar sao dois frames DIFERENTES do GIF — sem eles,
 * um GIF que anda pelo relogio passaria no gate inteiro.
 */
export const CASOS_DE_STILL: readonly CasoDeStill[] = [
  {
    arquivo: "still-gif-f000.png",
    composicao: COMPOSICAO_POR_TIPO.gif,
    frame: 0,
    porque: "quadro 0 do GIF, rasterizado",
  },
  {
    arquivo: "still-gif-f006.png",
    composicao: COMPOSICAO_POR_TIPO.gif,
    frame: 6,
    porque: "quadro 2 do GIF — TEM de diferir do still de f000",
  },
  {
    arquivo: "still-imagem-f045.png",
    composicao: COMPOSICAO_POR_TIPO.imagem,
    frame: 45,
    porque: "imagem com ajuste 'cover': o marcador ocupa o quadro inteiro",
  },
  {
    arquivo: "still-video-f000.png",
    composicao: COMPOSICAO_POR_TIPO.video,
    frame: 0,
    porque: "video com ajuste 'contain': margem transparente e o alfa",
  },
];

/** Diretorio dos artefatos aprovados, relativo a raiz do repositorio. */
export const DIR_APROVADOS = "fixtures/snapshots/no-midia/aprovados";

/** Ponto de entrada do render, relativo a raiz do repositorio. */
export const ENTRADA_DO_RENDER = "fixtures/snapshots/no-midia/entrada.tsx";
