// =============================================================================
// APRESENTACAO: clockWipe — varredura circular, como o ponteiro de um relogio
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// A cena que SAI fica inteira; a que ENTRA e recortada por um setor que abre
// de 12 horas no sentido horario. No meio da fronteira o setor cobre 180
// graus: METADE da tela e uma cena, metade e a outra. Os dois lados desenham
// ao mesmo tempo, em regioes disjuntas — "repartidos".
//
// O recorte e um `clipPath: polygon(...)` construido a mao, e NAO um
// `mask-image` (proibido pelo gate de pureza) nem um `url(#id)` de SVG (que
// exigiria um id unico no documento — fonte classica de nao-determinismo
// quando o id e gerado).
//
// O poligono e: centro -> 12 horas -> cada quina JA VARRIDA -> ponta atual.
// Incluir as quinas e o que faz o setor acompanhar o retangulo em vez de um
// circulo inscrito, que deixaria os quatro cantos sem revelar.
//
// Fonte: https://www.remotion.dev/docs/transitions/presentations/clock-wipe (2026-08-11)
// =============================================================================

import { interpolate } from "remotion";
import { CASAS_DECIMAIS, type Apresentacao, type ApresentacaoMeta } from "../contrato";

export const meta: ApresentacaoMeta = {
  tipo: "clockWipe",
  id: "transicao-clockwipe",
  descricao: "Varredura circular a partir das 12 horas, no sentido horario",
  contribuicao: "repartidos",
};

/** Uma volta inteira, em graus. */
const VOLTA = 360;

/** Angulos das quatro quinas do retangulo, a partir das 12 horas, em graus. */
const QUINAS = [45, 135, 225, 315];

/** Centro do retangulo em coordenadas percentuais. */
const CENTRO = 50;

/** Lado inteiro do retangulo em coordenadas percentuais. */
const INTEIRO = 100;

/** Graus para radianos. */
function radianos(graus: number): number {
  return (graus * Math.PI) / (VOLTA / 2);
}

/**
 * Ponto da borda do retangulo no angulo dado, em coordenadas percentuais
 * (0..100), com 0 grau apontando para cima e crescendo no sentido horario.
 *
 * O raio e esticado ate a borda do retangulo (`0.5 / max(|dx|, |dy|)`), o que
 * faz o setor varrer as quinas em vez de um circulo inscrito.
 */
export function pontoNaBorda(graus: number): { x: number; y: number } {
  const rad = radianos(graus);
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const escala = CENTRO / INTEIRO / Math.max(Math.abs(dx), Math.abs(dy));
  return { x: CENTRO + INTEIRO * escala * dx, y: CENTRO + INTEIRO * escala * dy };
}

/** Poligono CSS do setor varrido ate `graus`, em porcentagem. */
export function setorHorario(graus: number): string {
  const pontos: { x: number; y: number }[] = [
    { x: CENTRO, y: CENTRO },
    pontoNaBorda(0),
  ];
  for (const quina of QUINAS) {
    if (quina < graus) pontos.push(pontoNaBorda(quina));
  }
  pontos.push(pontoNaBorda(graus));

  const lista = pontos
    .map((p) => `${p.x.toFixed(CASAS_DECIMAIS)}% ${p.y.toFixed(CASAS_DECIMAIS)}%`)
    .join(", ");
  return `polygon(${lista})`;
}

const ClockWipe: Apresentacao = ({ progresso, lado, children }) => {
  const graus = interpolate(progresso, [0, 1], [0, VOLTA], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const clipPath = lado === "entrando" ? setorHorario(graus) : undefined;

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

export default ClockWipe;
