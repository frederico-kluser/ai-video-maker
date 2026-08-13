// =============================================================================
// Ponto de entrada do Remotion para o snapshot do no `grafico`
// =============================================================================
// Card: F1-09 (onda W4)
//
// FUNDO: nenhum. Nada aqui pinta cor de fundo, e e de proposito — o still sai
// em PNG com canal alfa (o renderizador liga `omitBackground` quando o formato
// e png), entao o snapshot PROVA no pixel que o no compoe sobre a cena em vez
// de tapa-la. Um `AbsoluteFill` com backgroundColor aqui destruiria a unica
// evidencia que este card produz.
//
// C5: nenhum snapshot e aprovado a partir do Studio; so do render.
// =============================================================================

import type React from "react";
import { Composition, registerRoot, staticFile, useCurrentFrame } from "remotion";

import Grafico from "../../../src/composicao/nos/grafico";
import type { NoGraficoResolvido } from "../../../src/composicao/nos/grafico";
import type { AssetResolvido } from "../../../src/resolucao/manifesto-resolvido";
import {
  ALTURA,
  ASSET_COM_ALFA,
  ASSET_FORMATO_SEM_ALFA,
  DURACAO_FRAMES,
  FPS,
  LARGURA,
  NO_BARRAS,
  NO_COM_ASSET,
} from "./cenario";

/** Adaptador: o relogio do Remotion vira a prop `frame` do contrato de no. */
const ComGrafico: React.FC<{ no: NoGraficoResolvido }> = ({ no }) => {
  const frame = useCurrentFrame();
  return (
    <Grafico no={no} frame={frame} fps={FPS} width={LARGURA} height={ALTURA} />
  );
};

function comAsset(asset: AssetResolvido, arquivo: string): NoGraficoResolvido {
  return {
    ...NO_COM_ASSET,
    grafico_resolvido: { asset, fonte: staticFile(arquivo) },
  };
}

const Raiz: React.FC = () => (
  <>
    {/* Sem asset resolvido: o no desenha a serie declarada no manifesto. */}
    <Composition
      id="no-grafico-dados"
      component={ComGrafico}
      durationInFrames={DURACAO_FRAMES}
      fps={FPS}
      width={LARGURA}
      height={ALTURA}
      defaultProps={{ no: NO_BARRAS as NoGraficoResolvido }}
    />

    {/* Com asset resolvido em formato com alfa: compoe sobre a cena. */}
    <Composition
      id="no-grafico-asset"
      component={ComGrafico}
      durationInFrames={DURACAO_FRAMES}
      fps={FPS}
      width={LARGURA}
      height={ALTURA}
      defaultProps={{
        no: comAsset(ASSET_COM_ALFA, "grafico-com-alfa.png"),
      }}
    />

    {/* SONDA NEGATIVA: renderizar esta composicao TEM de falhar, nomeando o
        no. Se um dia ela renderizar, o video ganhou um retangulo opaco e o
        gate deste card parou de valer. `just no-grafico-mutar` cobra isso. */}
    <Composition
      id="no-grafico-formato-sem-alfa"
      component={ComGrafico}
      durationInFrames={DURACAO_FRAMES}
      fps={FPS}
      width={LARGURA}
      height={ALTURA}
      defaultProps={{
        no: comAsset(ASSET_FORMATO_SEM_ALFA, "grafico-opaco.png"),
      }}
    />
  </>
);

registerRoot(Raiz);
