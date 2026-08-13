// =============================================================================
// APRESENTACAO: fade — dissolucao cruzada
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// A cena que SAI continua opaca a fronteira inteira; a que ENTRA sobe de
// alpha 0 a 1 por cima dela. O pixel resultante e exatamente
//     p * (cena que entra) + (1 - p) * (cena que sai)
// ou seja, a prova de que os dois lados desenharam esta NO PROPRIO PIXEL: uma
// cor que nenhum dos dois lados produz sozinho.
//
// Se so o lado que entra desenhasse, o meio da fronteira seria a cena que
// entra sobre o FUNDO, e o gate de pixel acusa.
//
// Fonte: https://www.remotion.dev/docs/transitions/presentations/fade (2026-08-11)
//        — `fade()` mantem a cena que sai opaca por default
//          (shouldFadeOutExitingScene: false) e faz o alpha so na que entra.
// =============================================================================

import { interpolate } from "remotion";
import type { Apresentacao, ApresentacaoMeta } from "../contrato";

export const meta: ApresentacaoMeta = {
  tipo: "fade",
  id: "transicao-fade",
  descricao: "Dissolucao cruzada: a cena que entra sobe de alpha sobre a que sai",
  contribuicao: "sobrepostos",
};

const Fade: Apresentacao = ({ progresso, lado, children }) => {
  const opacidade =
    lado === "entrando"
      ? interpolate(progresso, [0, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <div
      data-apresentacao={meta.tipo}
      data-lado={lado}
      style={{ position: "absolute", inset: 0, opacity: opacidade }}
    >
      {children}
    </div>
  );
};

export default Fade;
