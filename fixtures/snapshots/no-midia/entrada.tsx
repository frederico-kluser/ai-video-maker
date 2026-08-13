// =============================================================================
// Ponto de entrada do render do NO DE MIDIA — F1-07
// =============================================================================
// Este arquivo existe para que o no de midia seja rasterizado pelo RENDER de
// verdade (Chrome headless do Remotion), nunca pelo Studio (AGENTS.md C5).
//
// Ele isola o no: cada composicao aqui desenha UM no de midia da fixture
// canonica, e mais nada. Um irmao de W4 com o componente quebrado nao pode
// derrubar o gate deste card, e uma regressao aqui nomeia este card.
//
// FUNDO: nenhum. O still sai com canal alfa, e e assim que o contrato de alfa
// vira prova — `tools/no-midia/provar.ts` conta pixel transparente e pixel
// opaco no PNG. Um fundo pintado aqui apagaria exatamente a evidencia.
//
// FONTES: embutidas (F1-03). Sem isto, uma fonte que nao carrega cai para
// fallback do sistema sem erro (C6) e os bytes do still passam a depender da
// maquina.
// =============================================================================

import type React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";
import type { NoMidia } from "../../../src/contratos/manifesto";
import { registrarFontesLocais } from "../../../src/design/fontes/index";
import Midia from "../../../src/composicao/nos/midia";
import {
  ALTURA,
  COMPOSICAO_POR_TIPO,
  FPS,
  LARGURA,
  NO_GIF,
  NO_IMAGEM,
  NO_VIDEO,
  noDeMidiaDaFixture,
} from "./casos";

// Escopo de modulo, como manda a doc do Remotion: cada loadFont() abre o
// proprio delayRender() e o render espera sozinho. Fonte que falta mata o
// render — e esse e o ponto.
void registrarFontesLocais();

/** Um caso de render: id da composicao e o no que ela desenha. */
interface CasoDeRender {
  id: string;
  no: NoMidia;
}

/** Os tres tipos de midia do schema, cada um com um no real da fixture. */
export const CASOS: readonly CasoDeRender[] = [
  { id: COMPOSICAO_POR_TIPO.imagem, no: noDeMidiaDaFixture(NO_IMAGEM) },
  { id: COMPOSICAO_POR_TIPO.video, no: noDeMidiaDaFixture(NO_VIDEO) },
  { id: COMPOSICAO_POR_TIPO.gif, no: noDeMidiaDaFixture(NO_GIF) },
];

// Type alias (nao interface): <Composition> exige props atribuiveis a
// Record<string, unknown>, e so type alias ganha index signature implicita.
type PropsDoCaso = {
  no: NoMidia;
};

/**
 * Adaptador: transforma o relogio do Remotion na prop `frame`. E a UNICA
 * camada que fala com o runtime — o componente do no continua funcao pura,
 * como manda `src/composicao/contrato-de-no.ts`.
 */
const CasoDeMidia: React.FC<PropsDoCaso> = ({ no }) => {
  const frame = useCurrentFrame();
  return (
    <Midia no={no} frame={frame} fps={FPS} width={LARGURA} height={ALTURA} />
  );
};

const Raiz: React.FC = () => (
  <>
    {CASOS.map((caso) => (
      <Composition
        key={caso.id}
        id={caso.id}
        component={CasoDeMidia}
        durationInFrames={caso.no.duracao_frames}
        fps={FPS}
        width={LARGURA}
        height={ALTURA}
        defaultProps={{ no: caso.no }}
      />
    ))}
  </>
);

registerRoot(Raiz);
