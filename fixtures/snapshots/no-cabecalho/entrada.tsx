// =============================================================================
// Ponto de entrada do render de snapshot — no de cabecalho (F1-04)
// =============================================================================
// Este arquivo NAO e composicao de producao. Ele existe para que
// `just no-cabecalho` consiga tirar um still do no SOZINHO, sem arrastar o
// manifesto canonico inteiro junto — um snapshot que so falha quando outro
// no muda nao serve de oraculo para este card.
//
// Quatro composicoes, tres papeis:
//
//   no-cabecalho-centro         titulo + subtitulo, alinhamento centro,
//                               animacao "spring" -> preset overshoot.
//                               Dois frames aprovados: um EM MOVIMENTO
//                               (a mola do token e visivel no pixel) e um
//                               ASSENTADO (o layout final).
//
//   no-cabecalho-esquerda       so titulo, alinhamento esquerda,
//                               animacao "fade" -> preset suave.
//
//   no-cabecalho-fora-da-janela MESMO no da primeira, mas a composicao dura
//                               mais que o no. Renderizado no primeiro frame
//                               DEPOIS da duracao declarada, tem de sair um
//                               campo de cor uniforme: o componente nao
//                               desenha fora da propria janela. E tambem o
//                               controle negativo do smoke — se um snapshot
//                               aprovado fosse igual a este, o teste estaria
//                               aprovando quadro vazio.
//
// FONTES: registrarFontesLocais() no escopo de modulo. Sem isso o Chrome do
// render cai para fallback sem erro (AGENTS.md, C6) e o snapshot vira refem
// das fontes instaladas na maquina.
// =============================================================================

import type React from "react";
import {
  AbsoluteFill,
  Composition,
  registerRoot,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { NoCabecalho } from "../../../src/contratos/manifesto";
import { background, breakpoints } from "../../../src/design/tokens";
import { registrarFontesLocais } from "../../../src/design/fontes/index";
import Cabecalho from "../../../src/composicao/nos/cabecalho";

void registrarFontesLocais();

// ---------------------------------------------------------------------------
// Os nos sob teste
// ---------------------------------------------------------------------------

const FPS = 30;
const DURACAO = 90;
/** Folga da composicao "fora da janela": frames alem da duracao do no. */
const FOLGA = 10;

/**
 * Frame do still "em movimento" — a mola ainda NAO assentou.
 * O preset `overshoot` acomoda em 0.4 s (12 frames a 30 fps); no frame 3 o
 * titulo esta em ~40% do caminho. Um snapshot so no estado final passaria
 * mesmo se a mola do token fosse trocada por outra.
 */
export const FRAME_EM_MOVIMENTO = 3;
/** Frame do still "assentado" — depois de qualquer repique. */
export const FRAME_ASSENTADO = 45;
/** Frame do still da variante alinhada a esquerda. */
export const FRAME_ESQUERDA = 20;
/** Primeiro frame FORA da janela declarada do no. */
export const FRAME_FORA_DA_JANELA = DURACAO;

const NO_CENTRO: NoCabecalho = {
  id: "snap-cabecalho-centro",
  schema: "Cabecalho.1",
  type: "cabecalho",
  duracao_frames: DURACAO,
  texto: "Editor de Video IA",
  subtitulo: "Da ideia ao frame final, sem edicao manual",
  alinhamento: "centro",
  animacao: { tipo: "spring" },
};

const NO_ESQUERDA: NoCabecalho = {
  id: "snap-cabecalho-esquerda",
  schema: "Cabecalho.1",
  type: "cabecalho",
  duracao_frames: DURACAO,
  texto: "Composicao e funcao pura",
  alinhamento: "esquerda",
  animacao: { tipo: "fade" },
};

// ---------------------------------------------------------------------------
// Palco — o adaptador entre o relogio do Remotion e a prop `frame`
// ---------------------------------------------------------------------------
// O contrato do no proibe useCurrentFrame() DENTRO do componente. A traducao
// acontece aqui, exatamente como em src/composicao/raiz.tsx.

type PalcoProps = { no: NoCabecalho };

const Palco: React.FC<PalcoProps> = ({ no }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: background.primary }}>
      <Cabecalho no={no} frame={frame} fps={fps} width={width} height={height} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

const RaizDoSnapshot: React.FC = () => {
  return (
    <>
      <Composition
        id="no-cabecalho-centro"
        component={Palco}
        durationInFrames={DURACAO}
        fps={FPS}
        width={breakpoints.hd.width}
        height={breakpoints.hd.height}
        defaultProps={{ no: NO_CENTRO }}
      />
      <Composition
        id="no-cabecalho-esquerda"
        component={Palco}
        durationInFrames={DURACAO}
        fps={FPS}
        width={breakpoints.hd.width}
        height={breakpoints.hd.height}
        defaultProps={{ no: NO_ESQUERDA }}
      />
      <Composition
        id="no-cabecalho-fora-da-janela"
        component={Palco}
        durationInFrames={DURACAO + FOLGA}
        fps={FPS}
        width={breakpoints.hd.width}
        height={breakpoints.hd.height}
        defaultProps={{ no: NO_CENTRO }}
      />
    </>
  );
};

registerRoot(RaizDoSnapshot);
