// =============================================================================
// APRESENTACAO: cube — as duas cenas sao duas faces adjacentes de um cubo
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Diferente do flip, as duas faces estao a 90 graus, nao a 180: durante a
// fronteira inteira as DUAS aparecem ao mesmo tempo, formando a quina do cubo.
// Por isso `contribuicao` e "repartidos" — cada lado ocupa uma faixa da tela,
// e a soma das faixas cobre a tela.
//
// A rotacao acontece em torno do CENTRO do cubo, nao do centro da face:
//     translateZ(-metade) rotate(angulo) translateZ(metade)
// leva a face para a superficie do cubo, gira, e volta. Sem o par de
// translateZ a face gira em torno de si mesma e o cubo vira um flip.
//
// A perspectiva vem do palco (../sequencia.tsx).
//
// Fonte: https://www.remotion.dev/docs/transitions/presentations/cube (2026-08-11)
// =============================================================================

import { interpolate } from "remotion";
import {
  angulo,
  eixoDaDirecao,
  pixels,
  sinalDaDirecao,
  type Apresentacao,
  type ApresentacaoMeta,
} from "../contrato";

export const meta: ApresentacaoMeta = {
  tipo: "cube",
  id: "transicao-cube",
  descricao: "Cubo: as duas cenas sao faces adjacentes girando em torno do centro",
  contribuicao: "repartidos",
};

/** Quarto de volta, em graus: o angulo entre duas faces adjacentes. */
const QUARTO_DE_VOLTA = 90;

const Cube: Apresentacao = ({ progresso, lado, direcao, width, height, children }) => {
  const horizontal = eixoDaDirecao(direcao) === "horizontal";
  const sinal = sinalDaDirecao(direcao);

  // Metade da aresta do cubo: a face fica a essa distancia do centro.
  const metade = (horizontal ? width : height) / 2;

  const graus =
    lado === "entrando"
      ? interpolate(progresso, [0, 1], [-QUARTO_DE_VOLTA * sinal, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(progresso, [0, 1], [0, QUARTO_DE_VOLTA * sinal], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const giro = horizontal ? `rotateY(${angulo(graus)})` : `rotateX(${angulo(graus)})`;
  const transform = `translateZ(${pixels(-metade)}) ${giro} translateZ(${pixels(metade)})`;

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

export default Cube;
