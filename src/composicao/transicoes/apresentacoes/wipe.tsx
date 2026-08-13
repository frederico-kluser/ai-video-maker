// =============================================================================
// APRESENTACAO: wipe — a cena que entra e revelada por uma borda que varre
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// A cena que SAI fica inteira e parada; a que ENTRA e recortada por um
// retangulo que cresce a partir da borda declarada em `direcao`. No meio da
// fronteira, METADE da tela e uma cena e metade e a outra: os dois lados
// desenham ao mesmo tempo, em regioes disjuntas.
//
// O recorte usa `clipPath: inset(...)`, NAO `mask-image` — mask-image e
// proibido pelo gate de pureza (e, no render, depende de carregar um recurso).
//
// Fonte: https://www.remotion.dev/docs/transitions/presentations/wipe (2026-08-11)
// =============================================================================

import { interpolate } from "remotion";
import type { AnimacaoDirecao } from "../../../contratos/manifesto";
import { porcento, type Apresentacao, type ApresentacaoMeta } from "../contrato";

export const meta: ApresentacaoMeta = {
  tipo: "wipe",
  id: "transicao-wipe",
  descricao: "Varredura: a cena que entra e revelada por uma borda que atravessa a tela",
  contribuicao: "repartidos",
};

/**
 * `inset(top right bottom left)` para a cena que entra.
 * `restante` e quanto ainda falta revelar, em porcentagem (100 -> 0).
 */
export function recorteDeEntrada(direcao: AnimacaoDirecao, restante: number): string {
  const zero = porcento(0);
  const r = porcento(restante);
  switch (direcao) {
    case "from-left":
      return `inset(${zero} ${r} ${zero} ${zero})`;
    case "from-right":
      return `inset(${zero} ${zero} ${zero} ${r})`;
    case "from-top":
      return `inset(${zero} ${zero} ${r} ${zero})`;
    case "from-bottom":
      return `inset(${r} ${zero} ${zero} ${zero})`;
  }
}

const Wipe: Apresentacao = ({ progresso, lado, direcao, children }) => {
  const restante = interpolate(progresso, [0, 1], [100, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const clipPath = lado === "entrando" ? recorteDeEntrada(direcao, restante) : undefined;

  return (
    <div
      data-apresentacao={meta.tipo}
      data-lado={lado}
      style={{ position: "absolute", inset: 0, clipPath }}
    >
      {children}
    </div>
  );
};

export default Wipe;
