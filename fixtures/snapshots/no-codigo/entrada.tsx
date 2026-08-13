// =============================================================================
// Ponto de entrada do still de prova do no de codigo — F1-08
// =============================================================================
// Duas composicoes com papeis opostos, o mesmo codigo cru nas duas:
//
//   no-codigo      — o no COM tokens pre-computados. E o snapshot aprovado.
//   no-codigo-cru  — o no SEM tokens. A prova de que o componente nao inventa
//                    destaque: nenhuma das cores de papel pode aparecer no
//                    quadro, e o codigo continua legivel numa cor so.
//
// C5 do AGENTS.md: nenhum snapshot sai do Studio, so do render. Este arquivo
// e o entry que `npx remotion still` / `@remotion/renderer` usam.
//
// C6: as fontes locais sao registradas no escopo de modulo. JetBrains Mono
// tem de estar carregada quando o quadro sai — se o arquivo sumir, loadFont()
// derruba o render em vez de cair em fallback silencioso.
//
// Imports RELATIVOS: o bundler e webpack e nao le os `paths` do tsconfig.
// =============================================================================

import type React from "react";
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from "remotion";
import Codigo from "../../../src/composicao/nos/codigo";
import { registrarFontesLocais } from "../../../src/design/fontes/index";
import { background } from "../../../src/design/tokens";
import {
  DURACAO_FRAMES,
  NO_COM_DESTAQUE,
  NO_SEM_DESTAQUE,
  type NoCodigoHidratado,
} from "./no-de-teste";

void registrarFontesLocais();

export const LARGURA = 1920;
export const ALTURA = 1080;
export const FPS = 30;

export const COMPOSICAO_COM_DESTAQUE = "no-codigo";
export const COMPOSICAO_SEM_DESTAQUE = "no-codigo-cru";

// Type alias, nao interface: <Composition> exige props atribuiveis a
// Record<string, unknown>, e so type alias ganha index signature implicita.
export type PalcoProps = { no: NoCodigoHidratado };

/**
 * Adaptador — a UNICA camada que fala com o relogio do Remotion. O componente
 * de no recebe `frame` por prop, como manda o contrato de F1-01.
 */
const Palco: React.FC<PalcoProps> = ({ no }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: background.primary }}>
      <Codigo no={no} frame={frame} fps={FPS} width={LARGURA} height={ALTURA} />
    </AbsoluteFill>
  );
};

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSICAO_COM_DESTAQUE}
        component={Palco}
        durationInFrames={DURACAO_FRAMES}
        fps={FPS}
        width={LARGURA}
        height={ALTURA}
        defaultProps={{ no: NO_COM_DESTAQUE }}
      />
      <Composition
        id={COMPOSICAO_SEM_DESTAQUE}
        component={Palco}
        durationInFrames={DURACAO_FRAMES}
        fps={FPS}
        width={LARGURA}
        height={ALTURA}
        defaultProps={{ no: NO_SEM_DESTAQUE }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
