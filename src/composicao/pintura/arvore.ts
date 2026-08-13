// =============================================================================
// O PINTOR INTEGRADO — camadas + sequencia com transicoes + nos, num frame
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
// Promovido para src/composicao/pintura/ no PREP-w7 (AB-493).
//
// A arvore integrada, em funcao pura:
//
//   <AbsoluteFill bg={background.primary}>
//     <CAMADAS.../>                    <- fundo (z 0), grade e vinheta (z 20)
//     <SequenciaComTransicoes          <- quem decide as cenas do frame
//        Cena={pintorDeCena(estado)}/> <- o pintor REAL, injetado
//   </AbsoluteFill>
//
// As camadas se posicionam por z-index (tokens.zIndex.background/overlay);
// o palco das transicoes fica entre as duas — e por isso que a vinheta
// cobre o conteudo e o fundo nao.
//
// Duas entradas publicas:
//
//   `pintar(manifesto, tempo, viewport) -> frame` — o CONTRATO publico
//   (contrato.ts): recebe o manifesto FIADO, o tempo absoluto e o viewport,
//   devolve a arvore do frame. O viewport TEM de casar com o manifesto:
//   a sequencia deriva as dimensoes do proprio manifesto, e uma divergencia
//   produziria camadas e conteudo com geometrias diferentes, em silencio —
//   por isso `pintar` recusa com erro nomeando a regra (mesma disciplina de
//   F1-01: manifesto torto e erro, nao quadro torto).
//
//   `ArvoreIntegrada({fixture, frame})` — a mesma arvore, a partir da
//   fixture integrada: fia com o resolvedor padrao e delega a `pintar`.
//   `fixture` e injetada de proposito: e a mesma funcao que o ∅-crit usa
//   quando muta a fixture (remove um no) para exigir que o gate fique
//   VERMELHO POR AUSENCIA.
//
// PURO: nada de hook, nada de relogio, nada de disco — o mesmo modulo roda
// dentro do bundle do Remotion e dentro do teste de node.
// =============================================================================

import { createElement, type ReactElement } from "react";
import { AbsoluteFill } from "remotion";
import { background, fontFamily } from "../../design/tokens";
import { planoDeComposicao } from "../ManifestoRaiz";
import { CAMADAS } from "../camadas/registro";
import type {
  CamadaProps,
  ModuloDeCamada,
} from "../camadas/contrato-de-camada";
import SequenciaComTransicoes from "../transicoes/sequencia";
import type { Viewport, TempoAbsoluto } from "./contrato";
import { fiar, resolverPadrao, type Fiado, type FixtureIntegrada } from "./fiar";
import { pintorDeCena } from "./cena";

// ---------------------------------------------------------------------------
// O pintor integrado — contrato publico
// ---------------------------------------------------------------------------

/**
 * `pintar(manifesto, tempo, viewport) -> frame` — o contrato publico da
 * camada de pintura (AB-493). Recebe o manifesto FIADO, o tempo absoluto em
 * frames e o viewport; devolve a arvore React do frame composto.
 *
 * O viewport tem de casar com o manifesto: fps/largura/altura declarados.
 * Divergir produziria um frame incoerente em silencio (camadas em uma
 * geometria, sequencia e nos em outra) — `pintar` recusa com erro.
 */
export function pintar(
  manifesto: Fiado["manifesto"],
  tempo: TempoAbsoluto,
  viewport: Viewport,
): ReactElement {
  const plano = planoDeComposicao(manifesto);
  if (
    viewport.fps !== plano.fps ||
    viewport.width !== plano.width ||
    viewport.height !== plano.height
  ) {
    throw new Error(
      `pintar: viewport ${viewport.width}x${viewport.height}@${viewport.fps} ` +
        `diverge do manifesto ${plano.width}x${plano.height}@${plano.fps} ` +
        `(regra viewport==manifesto, contrato da pintura)`,
    );
  }
  const porId = new Map(manifesto.nos.map((no) => [no.id, no] as const));
  const estado: Fiado = { manifesto, porId, plano, resolverFonte: resolverPadrao };
  return pintarEstado(estado, tempo, viewport);
}

// ---------------------------------------------------------------------------
// O desenho em si — compartilhado pelas duas entradas
// ---------------------------------------------------------------------------

function pintarEstado(
  estado: Fiado,
  frame: number,
  viewport: Viewport,
): ReactElement {
  const { manifesto, plano } = estado;
  const propsDeCamada: CamadaProps = {
    frame,
    fps: viewport.fps,
    width: viewport.width,
    height: viewport.height,
    duracaoEmFrames: plano.totalFrames,
  };

  return createElement(
    AbsoluteFill,
    {
      style: {
        backgroundColor: background.primary,
        fontFamily: fontFamily.sans,
      },
    },
    CAMADAS.map((modulo: ModuloDeCamada) =>
      createElement(modulo.componente, { ...propsDeCamada, key: modulo.meta.id }),
    ),
    createElement(SequenciaComTransicoes, {
      manifesto,
      frame,
      Cena: pintorDeCena(estado),
    }),
  );
}

// ---------------------------------------------------------------------------
// A arvore integrada — a partir da fixture (uso do oraculo e do render)
// ---------------------------------------------------------------------------

export interface ArvoreIntegradaProps {
  fixture: FixtureIntegrada;
  frame: number;
}

/**
 * A composicao integrada a partir da fixture: fia com o resolvedor padrao e
 * delega a `pintar`. A suite integrada e o render de ponta a ponta usam esta
 * entrada; `pintar` e o contrato para quem ja tem o manifesto fiado.
 */
export function ArvoreIntegrada({
  fixture,
  frame,
}: ArvoreIntegradaProps): ReactElement {
  const estado = fiar(fixture, resolverPadrao);
  const viewport: Viewport = {
    fps: estado.plano.fps,
    width: estado.plano.width,
    height: estado.plano.height,
  };
  return pintarEstado(estado, frame, viewport);
}
