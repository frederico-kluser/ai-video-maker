// =============================================================================
// APRESENTACAO: flip — as duas cenas sao as duas faces da mesma carta
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Os dois lados ficam na arvore a fronteira inteira e giram JUNTOS, 180 graus
// defasados, com `backfaceVisibility: hidden`. Consequencia honesta: em cada
// frame so UMA das faces esta de frente para a camera — por isso o `meta`
// declara `contribuicao: "alternados"`, e nao "sobrepostos".
//
// Declarar "sobrepostos" aqui faria o gate de pixel exigir mistura das duas
// cores no meio da fronteira e ficar VERMELHO. O campo existe para que o
// componente nao possa mentir sobre o que ele faz.
//
// No meio exato (progresso 0.5) as duas faces estao de perfil e o palco
// aparece: e assim que um flip se comporta, nao e quadro perdido.
//
// A perspectiva vem do palco (../sequencia.tsx), que a aplica no envoltorio
// PAI de cada lado — `perspective` so vale para os filhos diretos.
//
// Fonte: https://www.remotion.dev/docs/transitions/presentations/flip (2026-08-11)
// =============================================================================

import { interpolate } from "remotion";
import {
  angulo,
  eixoDaDirecao,
  sinalDaDirecao,
  type Apresentacao,
  type ApresentacaoMeta,
} from "../contrato";

export const meta: ApresentacaoMeta = {
  tipo: "flip",
  id: "transicao-flip",
  descricao: "Giro de 180 graus: as duas cenas sao as faces opostas da mesma carta",
  contribuicao: "alternados",
};

/** Meia volta, em graus. */
const MEIA_VOLTA = 180;

const Flip: Apresentacao = ({ progresso, lado, direcao, children }) => {
  const sinal = sinalDaDirecao(direcao);
  const graus =
    lado === "entrando"
      ? interpolate(progresso, [0, 1], [-MEIA_VOLTA * sinal, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(progresso, [0, 1], [0, MEIA_VOLTA * sinal], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const medida = angulo(graus);
  const transform =
    eixoDaDirecao(direcao) === "horizontal"
      ? `rotateY(${medida})`
      : `rotateX(${medida})`;

  return (
    <div
      data-apresentacao={meta.tipo}
      data-lado={lado}
      style={{
        position: "absolute",
        inset: 0,
        transform,
        backfaceVisibility: "hidden",
      }}
    >
      {children}
    </div>
  );
};

export default Flip;
