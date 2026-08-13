// =============================================================================
// Ponto de entrada do Remotion para os snapshots do no de texto — F1-05
// =============================================================================
// Duas composicoes, uma por CAMINHO do componente:
//
//   no-texto-com-timing  -> destaque palavra a palavra
//   no-texto-sem-timing  -> degradacao para destaque por frase
//
// As duas usam o MESMO no, byte a byte, exceto pelo campo `timing_palavras`.
// E isso que faz o par de snapshots ser prova: se as duas imagens sairem
// iguais, ou o componente ignorou o timing, ou desenhou um quadro vazio.
// =============================================================================

import type React from "react";
import { Composition, registerRoot } from "remotion";
import {
  FPS,
  ID_COM_TIMING,
  ID_CONTROLE_VAZIO,
  ID_SEM_TIMING,
} from "./composicoes";
import {
  ALTURA,
  LARGURA,
  NO_COM_TIMING,
  NO_SEM_TIMING,
  PalcoDeNo,
  PalcoVazio,
} from "./Root";

const RaizDosSnapshots: React.FC = () => (
  <>
    <Composition
      id={ID_COM_TIMING}
      component={PalcoDeNo}
      durationInFrames={NO_COM_TIMING.duracao_frames}
      fps={FPS}
      width={LARGURA}
      height={ALTURA}
      defaultProps={{ no: NO_COM_TIMING }}
    />
    <Composition
      id={ID_SEM_TIMING}
      component={PalcoDeNo}
      durationInFrames={NO_SEM_TIMING.duracao_frames}
      fps={FPS}
      width={LARGURA}
      height={ALTURA}
      defaultProps={{ no: NO_SEM_TIMING }}
    />
    <Composition
      id={ID_CONTROLE_VAZIO}
      component={PalcoVazio}
      durationInFrames={NO_COM_TIMING.duracao_frames}
      fps={FPS}
      width={LARGURA}
      height={ALTURA}
    />
  </>
);

registerRoot(RaizDosSnapshots);
