// =============================================================================
// Composicao de snapshot do no de texto — F1-05
// =============================================================================
// Renderiza UM no de texto isolado, para que o snapshot aprovado responda por
// este componente e por mais nada. A raiz do manifesto (F1-01) ja tem o proprio
// gate; misturar as duas coisas faria um snapshot vermelho apontar para dois
// donos ao mesmo tempo.
//
// AQUI e o lugar legitimo de `useCurrentFrame()`: esta e a camada adaptadora
// que transforma o relogio do Remotion na prop `frame`. Dentro de
// src/composicao/ o hook e proibido — e `just comp-pureza` cobra isso.
//
// As fontes locais (F1-03) sao registradas no escopo do modulo: loadFont()
// abre delayRender() e o render espera. Sem isso o still sairia com a fonte de
// fallback e ninguem ficaria sabendo (AGENTS.md, C6).
// =============================================================================

import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import Texto from "../../../src/composicao/nos/texto";
import type { No } from "../../../src/contratos/manifesto";
import { registrarFontesLocais } from "../../../src/design/fontes";
import { background, breakpoints, fontFamily } from "../../../src/design/tokens";
import { FPS } from "./composicoes";
import noComTimingJson from "./no-com-timing.json";
import noSemTimingJson from "./no-sem-timing.json";

void registrarFontesLocais();

/** Formato do still — token de breakpoint, nao numero digitado aqui. */
export const LARGURA = breakpoints.hd.width;
export const ALTURA = breakpoints.hd.height;

/** O no com timing por palavra — caminho do destaque palavra a palavra. */
export const NO_COM_TIMING = noComTimingJson as unknown as No;

/** O mesmo no SEM o campo de timing — caminho da degradacao para frase. */
export const NO_SEM_TIMING = noSemTimingJson as unknown as No;

// Type alias, nao interface: o <Composition> do Remotion exige props
// atribuiveis a Record<string, unknown>, e so type alias ganha a index
// signature implicita (mesma razao registrada em src/composicao/raiz.tsx).
export type PalcoDeNoProps = {
  no: No;
};

/**
 * Palco minimo: fundo do token, pilha tipografica do token, e o no ocupando o
 * quadro inteiro. Nada aqui desenha texto proprio — se o componente devolver
 * um quadro vazio, o still sai vazio, que e exatamente o que o harness cobra.
 */
export const PalcoDeNo: React.FC<PalcoDeNoProps> = ({ no }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: background.primary,
        fontFamily: fontFamily.sans,
      }}
    >
      <Texto no={no} frame={frame} fps={FPS} width={LARGURA} height={ALTURA} />
    </AbsoluteFill>
  );
};

/**
 * CONTROLE NEGATIVO — o mesmo palco com um no que nao desenha nada.
 *
 * Existe para responder, com pixel e nao com opiniao, a pergunta "o smoke
 * passaria com o componente devolvendo um quadro vazio?". O harness renderiza
 * este quadro vazio de verdade e EXIGE que os stills do componente sejam
 * diferentes dele. Um componente que devolvesse null produziria exatamente
 * esta imagem, e o gate ficaria vermelho.
 */
export const PalcoVazio: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: background.primary,
      fontFamily: fontFamily.sans,
    }}
  />
);
