// =============================================================================
// ENTRADA DO RENDER INTEGRADO — a composicao inteira, de verdade
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// Este arquivo e a UNICA parte da suite que fala com o runtime do Remotion:
// e aqui que `useCurrentFrame()` vira a prop `frame` da arvore integrada
// (tests/integracao/composicao/fiar.tsx). Nenhum hook, nenhum relogio dentro
// dos nos, das camadas ou das transicoes — o padrao de F1-01.
//
// Tres composicoes:
//
//   integrado               a fixture canonica INTEIRA (15 nos, 5 cenas, 4
//                           fronteiras), com a fiacao anexada. E o join.
//
//   integrado-grafico-asset UMA cena, UM no de grafico com o asset fiado
//                           (PNG RGBA). O oraculo de conteudo da regiao do
//                           grafico (AB-344/AB-390) roda aqui: na fixture
//                           inteira o grafico divide o frame com os irmaos.
//
//   integrado-midia         UMA cena, UM no de midia (marcador). O oraculo
//                           de alfa da regiao do marcador roda aqui.
//
// FONTES: registrarFontesLocais() no escopo de modulo. Sem isso o Chrome do
// render cai para fallback sem erro (AGENTS.md, C6; AB-313) e o snapshot
// vira refem das fontes instaladas na maquina. O publicDir do bundle serve
// `fontes/` (symlink em assets/) e `grafico-integrado.png`.
//
// C5: nenhum snapshot e aprovado a partir do Studio; so do render.
// =============================================================================

import type React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";

import { registrarFontesLocais } from "../../../src/design/fontes/index";
import {
  ArvoreIntegrada,
  FIXTURA_GRAFICO_ASSET,
  FIXTURA_INTEGRADA,
  FIXTURA_MIDIA,
  fiar,
  type FixtureIntegrada,
} from "../../../tests/integracao/composicao/fiar";

// AB-313: as fontes locais entram no render. A chamada e no escopo de
// modulo — o render espera a carga antes de pintar qualquer frame.
void registrarFontesLocais();

// ---------------------------------------------------------------------------
// Adaptador — o relogio do Remotion vira a prop `frame`
// ---------------------------------------------------------------------------

export type ComposicaoIntegradaProps = {
  fixture: FixtureIntegrada;
};

export const ComposicaoIntegrada: React.FC<ComposicaoIntegradaProps> = ({
  fixture,
}) => {
  const frame = useCurrentFrame();
  return <ArvoreIntegrada fixture={fixture} frame={frame} />;
};

// ---------------------------------------------------------------------------
// Duracao — da aritmetica subtrativa, nunca escrita a mao
// ---------------------------------------------------------------------------

function totalDaFixture(fixture: FixtureIntegrada): number {
  return fiar(fixture, () => "/grafico-integrado.png").plano.totalFrames;
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

export const RaizIntegrada: React.FC = () => {
  const integrado = totalDaFixture(FIXTURA_INTEGRADA);

  return (
    <>
      <Composition
        id="integrado"
        component={ComposicaoIntegrada}
        durationInFrames={integrado}
        fps={FIXTURA_INTEGRADA.manifesto.fps}
        width={FIXTURA_INTEGRADA.manifesto.width}
        height={FIXTURA_INTEGRADA.manifesto.height}
        defaultProps={{ fixture: FIXTURA_INTEGRADA }}
      />
      <Composition
        id="integrado-grafico-asset"
        component={ComposicaoIntegrada}
        durationInFrames={totalDaFixture(FIXTURA_GRAFICO_ASSET)}
        fps={FIXTURA_GRAFICO_ASSET.manifesto.fps}
        width={FIXTURA_GRAFICO_ASSET.manifesto.width}
        height={FIXTURA_GRAFICO_ASSET.manifesto.height}
        defaultProps={{ fixture: FIXTURA_GRAFICO_ASSET }}
      />
      <Composition
        id="integrado-midia"
        component={ComposicaoIntegrada}
        durationInFrames={totalDaFixture(FIXTURA_MIDIA)}
        fps={FIXTURA_MIDIA.manifesto.fps}
        width={FIXTURA_MIDIA.manifesto.width}
        height={FIXTURA_MIDIA.manifesto.height}
        defaultProps={{ fixture: FIXTURA_MIDIA }}
      />
    </>
  );
};

registerRoot(RaizIntegrada);
