// =============================================================================
// PONTO DE ENTRADA DO REMOTION — cenario de prova das camadas globais
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Este arquivo e a UNICA parte do card que fala com o runtime do Remotion:
// e aqui que useCurrentFrame() vira a prop `frame` da cena pura. As camadas
// nunca veem o runtime — e por isso `just no-camadas` consegue medi-las tanto
// no DOM (react-dom/server) quanto no pixel (render de verdade).
//
// O catalogo das composicoes NAO vive aqui: vive em ./cena, porque este
// modulo chama registerRoot() no topo e a ferramenta de medicao precisa do
// catalogo sem arrastar o runtime junto.
// =============================================================================

import type React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";
import {
  ALTURA_DA_PROVA,
  COMPOSICOES_DA_PROVA,
  CenaSentinela,
  DURACAO_DA_PROVA,
  FPS_DA_PROVA,
  LARGURA_DA_PROVA,
} from "./cena";

// Type alias (nao interface): <Composition> exige props atribuiveis a
// Record<string, unknown>, e so type alias ganha index signature implicita.
export type PropsDaCena = {
  camadas: string[];
};

export const CenaDeProva: React.FC<PropsDaCena> = ({ camadas }) => {
  const frame = useCurrentFrame();
  return <CenaSentinela camadas={camadas} frame={frame} />;
};

export const RaizDaProva: React.FC = () => (
  <>
    {COMPOSICOES_DA_PROVA.map((c) => (
      <Composition
        key={c.id}
        id={c.id}
        component={CenaDeProva}
        durationInFrames={DURACAO_DA_PROVA}
        fps={FPS_DA_PROVA}
        width={LARGURA_DA_PROVA}
        height={ALTURA_DA_PROVA}
        defaultProps={{ camadas: c.camadas }}
      />
    ))}
  </>
);

registerRoot(RaizDaProva);
