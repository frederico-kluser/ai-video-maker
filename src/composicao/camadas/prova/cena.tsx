// =============================================================================
// CENA SENTINELA — o cenario onde a invasao da safe area vira numero
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// COMO A MEDICAO FUNCIONA
//
// A cena tem duas partes e nada mais:
//   1. o CANVAS, cor solida cobrindo o quadro inteiro;
//   2. o CONTEUDO, cor solida cobrindo EXATAMENTE a safe area, em
//      tokens.zIndex.content.
//
// Renderiza-se a mesma cena duas vezes: uma sem camada nenhuma (`camadas-sem`)
// e uma com a camada ligada. Comparando os dois PNGs pixel a pixel:
//
//   dentro da safe area  -> ZERO pixel pode ter mudado.  Se mudou, a camada
//                           comeu conteudo. Vale para os tres papeis: um
//                           fundo tambem reprova se subir de z-index.
//   fora da safe area    -> os pixels que mudaram tem de cair todos dentro
//                           dos retangulos que a camada DECLAROU, e cada
//                           retangulo declarado tem de ter mudado ao menos
//                           um pixel.
//
// A segunda metade e o que separa "camada decorativa correta" de "componente
// que devolveu quadro vazio" — os dois passam em qualquer smoke test que so
// olhe o codigo de saida do render.
//
// A cena e PURA e recebe `frame` por prop: da para renderiza-la com
// react-dom/server, sem navegador. Quem chama useCurrentFrame() e o adaptador
// em prova/index.tsx, exatamente como raiz.tsx faz com os nos.
// =============================================================================

import type { ReactElement } from "react";
import {
  background,
  breakpoints,
  highlight,
  maxTextDurationSeconds,
  zIndex,
} from "../../../design/tokens";
import {
  retanguloSeguro,
  type CamadaProps,
  type ModuloDeCamada,
} from "../contrato-de-camada";
import { CAMADAS } from "../registro";
import { SONDAS } from "./sondas";

// ---------------------------------------------------------------------------
// Parametros da prova — derivados de token, nunca digitados
// ---------------------------------------------------------------------------

/** Resolucao da prova: 16:9 de tokens.breakpoints.hd, a mesma de safeArea16x9. */
export const LARGURA_DA_PROVA = breakpoints.hd.width;
export const ALTURA_DA_PROVA = breakpoints.hd.height;

/**
 * fps da prova. fps nao e token de design: e propriedade do manifesto
 * (`Manifesto.fps`). 30 e o valor da fixture canonica.
 */
export const FPS_DA_PROVA = 30;

/**
 * Janela da prova: a duracao maxima de texto em tela (tokens), em frames.
 * 7 s a 30 fps = 210 frames.
 */
export const DURACAO_DA_PROVA = Math.round(maxTextDurationSeconds * FPS_DA_PROVA);

/**
 * Frame amostrado pelo gate: o meio da janela.
 * Tem de estar no PLATO do envelope de opacidade — amostrar durante a rampa
 * de entrada mediria uma camada semi-transparente e transformaria o gate num
 * gerador de falso vermelho.
 */
export const FRAME_DA_PROVA = Math.floor(DURACAO_DA_PROVA / 2);

/** Props de camada usadas pela prova, para o gate e o teste falarem o mesmo. */
export function propsDaProva(frame: number = FRAME_DA_PROVA): CamadaProps {
  return {
    frame,
    fps: FPS_DA_PROVA,
    width: LARGURA_DA_PROVA,
    height: ALTURA_DA_PROVA,
    duracaoEmFrames: DURACAO_DA_PROVA,
  };
}

// ---------------------------------------------------------------------------
// Catalogo da prova — camadas de verdade mais as sondas negativas
// ---------------------------------------------------------------------------

/**
 * As camadas reais MAIS as sondas que existem para ser reprovadas.
 * As sondas vivem em prova/ e nao em camadas/: elas nao sao descobertas como
 * camada nenhuma, e nao entram no registro de producao.
 */
export const CATALOGO_DA_PROVA: ReadonlyMap<string, ModuloDeCamada> = new Map([
  ...CAMADAS.map((c) => [c.meta.nome, c] as const),
  ...SONDAS.map((c) => [c.meta.nome, c] as const),
]);

/** Resolve nomes para modulos. Nome desconhecido estoura — nunca e pulado. */
export function resolverCamadas(nomes: readonly string[]): ModuloDeCamada[] {
  return nomes.map((nome) => {
    const achada = CATALOGO_DA_PROVA.get(nome);
    if (!achada) {
      throw new Error(
        `cena de prova: camada "${nome}" desconhecida ` +
          `(conhecidas: ${[...CATALOGO_DA_PROVA.keys()].join(", ")})`,
      );
    }
    return achada;
  });
}

// ---------------------------------------------------------------------------
// A cena
// ---------------------------------------------------------------------------

/** O que o gate espera da medicao de cada composicao de prova. */
export type VeredictoEsperado = "referencia" | "aprova" | "reprova";

export interface ComposicaoDeProva {
  id: string;
  camadas: string[];
  esperado: VeredictoEsperado;
  /** Por que esta composicao existe — vai para a saida do gate. */
  motivo: string;
}

/**
 * O catalogo vive AQUI, e nao em index.tsx, porque index.tsx chama
 * registerRoot() no topo do modulo: importa-lo de uma ferramenta de linha de
 * comando arrastaria o runtime do Remotion para dentro do medidor.
 *
 * Quatro composicoes tem de APROVAR e duas tem de REPROVAR. As duas sondas
 * nao sao decoracao do catalogo: sao o unico jeito de saber que o medidor
 * ainda enxerga (ADR-0001, Regra 3).
 */
export const COMPOSICOES_DA_PROVA: readonly ComposicaoDeProva[] = Object.freeze([
  {
    id: "camadas-sem",
    camadas: [],
    esperado: "referencia",
    motivo: "cena sentinela sem camada: e o PNG contra o qual todos os outros sao subtraidos",
  },
  {
    id: "camadas-fundo",
    camadas: ["fundo"],
    esperado: "aprova",
    motivo: "fundo abaixo do conteudo: pinta o quadro inteiro e nao muda um pixel da safe area",
  },
  {
    id: "camadas-grade",
    camadas: ["grade"],
    esperado: "aprova",
    motivo: "grade como marca de registro: so nas bandas de margem",
  },
  {
    id: "camadas-vinheta",
    camadas: ["vinheta"],
    esperado: "aprova",
    motivo: "vinheta contida nas bandas de margem, rampa terminando em opacidade visivel",
  },
  {
    id: "camadas-com",
    camadas: ["fundo", "grade", "vinheta"],
    esperado: "aprova",
    motivo: "as tres camadas juntas, na ordem de composicao do registro",
  },
  {
    id: "camadas-invasora",
    camadas: ["invasora"],
    esperado: "reprova",
    motivo: "SONDA: vinheta deslocada para dentro da safe area — o gate tem de ficar vermelho",
  },
  {
    id: "camadas-vazia",
    camadas: ["vazia"],
    esperado: "reprova",
    motivo: "SONDA: camada que devolve quadro vazio — o gate tem de ficar vermelho",
  },
]);

export interface CenaSentinelaProps {
  /** Nomes das camadas a ligar. Lista vazia = a cena de referencia. */
  camadas: readonly string[];
  /** Frame LOCAL da composicao. */
  frame: number;
}

export const CenaSentinela = ({
  camadas,
  frame,
}: CenaSentinelaProps): ReactElement => {
  const props = propsDaProva(frame);
  const seguro = retanguloSeguro(props.width, props.height);
  const modulos = resolverCamadas(camadas);

  return (
    <div
      data-cena="sentinela"
      data-frame={String(frame)}
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: background.light,
        overflow: "hidden",
      }}
    >
      {modulos.map((modulo) => (
        <modulo.componente key={modulo.meta.id} {...props} />
      ))}

      <div
        data-conteudo="safe-area"
        style={{
          position: "absolute",
          left: seguro.x,
          top: seguro.y,
          width: seguro.largura,
          height: seguro.altura,
          backgroundColor: highlight.primary,
          zIndex: zIndex.content,
        }}
      />
    </div>
  );
};
