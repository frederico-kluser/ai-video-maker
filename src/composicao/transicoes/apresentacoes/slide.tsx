// =============================================================================
// APRESENTACAO: slide — as duas cenas deslizam juntas
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// A cena que ENTRA vem da borda declarada em `direcao`; a que SAI e empurrada
// para a borda oposta. As duas se movem na MESMA janela de frames e ficam
// encostadas: no meio da fronteira, cada uma ocupa metade da tela.
//
// Fonte: https://www.remotion.dev/docs/transitions/presentations/slide (2026-08-11)
//        — o default de `slide()` e `from-left`, e as duas cenas se movem.
// =============================================================================

import { interpolate } from "remotion";
import {
  eixoDaDirecao,
  porcento,
  sinalDaDirecao,
  type Apresentacao,
  type ApresentacaoMeta,
} from "../contrato";

export const meta: ApresentacaoMeta = {
  tipo: "slide",
  id: "transicao-slide",
  descricao: "Deslizamento: a cena que entra empurra a que sai para a borda oposta",
  contribuicao: "repartidos",
};

const Slide: Apresentacao = ({ progresso, lado, direcao, children }) => {
  // `from-left` significa que a cena que ENTRA nasce a esquerda (deslocamento
  // negativo) e vai a zero, empurrando a que sai para a direita.
  const sinal = sinalDaDirecao(direcao);
  const deslocamento =
    lado === "entrando"
      ? interpolate(progresso, [0, 1], [-100 * sinal, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(progresso, [0, 1], [0, 100 * sinal], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const medida = porcento(deslocamento);
  const transform =
    eixoDaDirecao(direcao) === "horizontal"
      ? `translateX(${medida})`
      : `translateY(${medida})`;

  return (
    <div
      data-apresentacao={meta.tipo}
      data-lado={lado}
      style={{ position: "absolute", inset: 0, transform }}
    >
      {children}
    </div>
  );
};

export default Slide;
