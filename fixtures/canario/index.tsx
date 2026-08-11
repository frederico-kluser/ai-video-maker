// =============================================================================
// Ponto de entrada do canário — registra a composição para o Remotion
// =============================================================================
// Card: F0-06 — Harness de determinismo
// Este arquivo é o entry point que o Remotion CLI usa para encontrar
// e registrar composições. registerRoot() é obrigatório.
// =============================================================================

import type React from "react";
import { registerRoot, Composition } from "remotion";
import { Canario } from "./Root";

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="canario"
      component={Canario}
      durationInFrames={30}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(RemotionRoot);
