// =============================================================================
// ENTRADA DO RENDER DO THUMBNAIL — o pintor promovido, a mesma arvore
// =============================================================================
// Card: F5-05 — Thumbnail gerado do MESMO manifesto (W7)
//
// Este arquivo e a UNICA parte do thumbnail que fala com o runtime do
// Remotion: registra a composicao que pinta a fixture canonica com o
// pintor promovido (ArvoreIntegrada, src/composicao/pintura — AB-493).
// O frame e escolhido pelo proprio modulo (escolherFrameDoThumbnail) e
// passado ao renderStill; a escala de saida (1280x720 a partir de
// 1920x1080) tambem vem do modulo (escala/planoDoThumbnail). Nada de
// texto, cor ou geometria e digitado aqui — o que nao vem do manifesto
// nao entra no thumbnail.
//
// FONTES: registrarFontesLocais() no escopo de modulo — sem isso o Chrome
// do render cai para fallback sem erro (AGENTS.md, C6; AB-313) e o
// thumbnail vira refem das fontes instaladas na maquina. O publicDir do
// bundle serve o MESMO diretorio de assets da fixture integrada (o grafico
// fiado e as fontes), nunca um diretorio proprio.
//
// C5: o thumbnail nasce do RENDER (Chrome headless, --gl=swangle), nunca
// do Studio.
// =============================================================================

import type React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";

import { registrarFontesLocais } from "../../../src/design/fontes/index";
import { ID_DA_COMPOSICAO } from "../../../src/entrega/thumbnail/especificacao";
import {
  ArvoreIntegrada,
  FIXTURA_INTEGRADA,
  fiar,
  type FixtureIntegrada,
} from "../../integracao/composicao/fiar";

// AB-313: as fontes locais entram no render. A chamada e no escopo de
// modulo — o render espera a carga antes de pintar qualquer frame.
void registrarFontesLocais();

/** Adaptador: o relogio do Remotion vira a prop `frame` do pintor. */
export type PropsDaComposicaoThumb = {
  fixture: FixtureIntegrada;
};

export const ComposicaoThumb: React.FC<PropsDaComposicaoThumb> = ({
  fixture,
}) => {
  const frame = useCurrentFrame();
  return <ArvoreIntegrada fixture={fixture} frame={frame} />;
};

/** Duracao da composicao — da aritmetica subtrativa, nunca escrita a mao. */
function totalDaFixture(fixture: FixtureIntegrada): number {
  return fiar(fixture, () => "/grafico-integrado.png").plano.totalFrames;
}

/** O registro: a composicao do thumbnail, com a fixture canonica embutida. */
export const RaizThumb: React.FC = () => {
  const integrado = totalDaFixture(FIXTURA_INTEGRADA);
  return (
    <Composition
      id={ID_DA_COMPOSICAO}
      component={ComposicaoThumb}
      durationInFrames={integrado}
      fps={FIXTURA_INTEGRADA.manifesto.fps}
      width={FIXTURA_INTEGRADA.manifesto.width}
      height={FIXTURA_INTEGRADA.manifesto.height}
      defaultProps={{ fixture: FIXTURA_INTEGRADA }}
    />
  );
};

registerRoot(RaizThumb);
