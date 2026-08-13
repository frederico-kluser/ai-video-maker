// =============================================================================
// ENTRADA DO RENDER DE VARIANTES — a mesma composicao, em cada canvas
// =============================================================================
// Card: F5-04 (W7) — Variantes de proporcao.
//
// Duas composicoes, AMBAS consumindo o pintor promovido
// (src/composicao/pintura, AB-493):
//
//   variante-16x9   a fixture canonica como ela e (canvas 1920x1080) — a
//                   variante BASE do contrato.
//   variante-9x16   a MESMA fixture derivada para o canvas vertical
//                   (1080x1920) por derivarVariante (src/entrega/variantes/)
//                   — o "recorte por viewport" da emenda: o pintor desenha a
//                   arvore inteira no viewport da plataforma, e a derivacao
//                   e o modulo que produz o manifesto que casa com o
//                   viewport (o contrato publico da pintura recusa
//                   viewport != manifesto).
//
// Nada aqui reimplementa a arvore: ArvoreIntegrada e a entrada do pintor
// promovido (src/composicao/pintura/arvore.ts), e a fiacao fiar anexa os
// assets aos nos de grafico pelo resolvedor padrao.
//
// C5: nenhum snapshot e aprovado a partir do Studio; so deste render.
// A variante 9:16 do canonico e REPROVADA pelo oraculo (conteudo fora da
// safe area 9:16 provisional) — ela e renderizada aqui para a PROVA de
// pixel do ∅-crit, mas nunca vira snapshot aprovado (provar.ts).
// =============================================================================

import type React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";

import { breakpoints } from "../../../src/design/tokens";
import { derivarVariante } from "../../../src/entrega/variantes/derivar";
import { ArvoreIntegrada } from "../../../src/composicao/pintura";
import { registrarFontesLocais } from "../../../src/design/fontes/index";
import {
  FIXTURA_INTEGRADA,
  fiar,
  type FixtureIntegrada,
} from "../../../tests/integracao/composicao/fiar";

// AB-313: as fontes locais entram no render.
void registrarFontesLocais();

// ---------------------------------------------------------------------------
// A variante vertical: a MESMA fixture, derivada para o canvas 9:16
// ---------------------------------------------------------------------------

export const FIXTURA_VARIANTE_9X16: FixtureIntegrada = {
  ...FIXTURA_INTEGRADA,
  manifesto: derivarVariante(FIXTURA_INTEGRADA.manifesto, breakpoints.vertical),
};

// ---------------------------------------------------------------------------
// Adaptador — o relogio do Remotion vira a prop `frame`
// ---------------------------------------------------------------------------

export type ComposicaoDeVarianteProps = {
  fixture: FixtureIntegrada;
};

export const ComposicaoDeVariante: React.FC<ComposicaoDeVarianteProps> = ({
  fixture,
}) => {
  const frame = useCurrentFrame();
  return <ArvoreIntegrada fixture={fixture} frame={frame} />;
};

function totalDaFixture(fixture: FixtureIntegrada): number {
  return fiar(fixture, () => "/grafico-integrado.png").plano.totalFrames;
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------

export const RaizDeVariantes: React.FC = () => {
  return (
    <>
      <Composition
        id="variante-16x9"
        component={ComposicaoDeVariante}
        durationInFrames={totalDaFixture(FIXTURA_INTEGRADA)}
        fps={FIXTURA_INTEGRADA.manifesto.fps}
        width={FIXTURA_INTEGRADA.manifesto.width}
        height={FIXTURA_INTEGRADA.manifesto.height}
        defaultProps={{ fixture: FIXTURA_INTEGRADA }}
      />
      <Composition
        id="variante-9x16"
        component={ComposicaoDeVariante}
        durationInFrames={totalDaFixture(FIXTURA_VARIANTE_9X16)}
        fps={FIXTURA_VARIANTE_9X16.manifesto.fps}
        width={FIXTURA_VARIANTE_9X16.manifesto.width}
        height={FIXTURA_VARIANTE_9X16.manifesto.height}
        defaultProps={{ fixture: FIXTURA_VARIANTE_9X16 }}
      />
    </>
  );
};

registerRoot(RaizDeVariantes);
