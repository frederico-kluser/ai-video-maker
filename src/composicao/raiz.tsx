// =============================================================================
// RAIZ — ponto de entrada do Remotion
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// Esta e a UNICA camada que fala com o runtime do Remotion: e aqui que
// `useCurrentFrame()` vira a prop `frame` que atravessa toda a arvore, e e
// aqui que o envelope vira `<Sequence>` de verdade (o que a fase W4 precisa
// para <Audio>/<OffthreadVideo> receberem o deslocamento certo).
//
// O manifesto entra por IMPORT ESTATICO, nao por leitura de disco: o bundle
// de render nao tem `node:fs`, e composicao e funcao pura (AGENTS.md, Regra 1).
// =============================================================================

import type React from "react";
import { Composition, Sequence, registerRoot, useCurrentFrame } from "remotion";
import type { Manifesto } from "../contratos/manifesto";
import manifestoCanonicoJson from "../../fixtures/canonico/manifesto-valido.json";
import {
  ManifestoRaiz,
  planoDeComposicao,
  type Envelope,
} from "./ManifestoRaiz";

// ---------------------------------------------------------------------------
// A fixture canonica (F0-09), embutida no bundle
// ---------------------------------------------------------------------------

export const MANIFESTO_CANONICO = manifestoCanonicoJson as unknown as Manifesto;

/** Id da composicao registrada. */
export const ID_COMPOSICAO = "manifesto";

// ---------------------------------------------------------------------------
// Envelope do Remotion
// ---------------------------------------------------------------------------

/**
 * Envelope de producao: `<Sequence>`. Ele janela o no no tempo E desloca o
 * relogio interno do Remotion, que e o que a midia (audio/video) usa.
 */
export const EnvelopeSequence: Envelope = ({ inicio, duracao, nome, children }) => (
  <Sequence from={inicio} durationInFrames={duracao} name={nome}>
    {children}
  </Sequence>
);

// ---------------------------------------------------------------------------
// A composicao
// ---------------------------------------------------------------------------

// Type alias (nao interface): o <Composition> do Remotion exige props
// atribuiveis a Record<string, unknown>, e so type alias ganha index
// signature implicita.
export type ComposicaoDoManifestoProps = {
  manifesto: Manifesto;
};

/** Adaptador: transforma o relogio do Remotion na prop `frame`. */
export const ComposicaoDoManifesto: React.FC<ComposicaoDoManifestoProps> = ({
  manifesto,
}) => {
  const frame = useCurrentFrame();
  return (
    <ManifestoRaiz manifesto={manifesto} frame={frame} Envelope={EnvelopeSequence} />
  );
};

/**
 * Registro da composicao.
 *
 * `durationInFrames` NUNCA e escrito a mao: sai da aritmetica subtrativa de
 * `tempo.ts`, tanto no valor inicial quanto em `calculateMetadata()` — que e
 * quem manda quando o manifesto chega por props (render com --props).
 */
export const RaizRemotion: React.FC = () => {
  const plano = planoDeComposicao(MANIFESTO_CANONICO);

  return (
    <Composition
      id={ID_COMPOSICAO}
      component={ComposicaoDoManifesto}
      durationInFrames={plano.totalFrames}
      fps={plano.fps}
      width={plano.width}
      height={plano.height}
      defaultProps={{ manifesto: MANIFESTO_CANONICO }}
      calculateMetadata={({ props }) => {
        const p = planoDeComposicao(props.manifesto);
        return {
          durationInFrames: p.totalFrames,
          fps: p.fps,
          width: p.width,
          height: p.height,
          props,
        };
      }}
    />
  );
};

registerRoot(RaizRemotion);
