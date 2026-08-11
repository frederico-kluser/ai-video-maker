// =============================================================================
// NO DE MENTIRA: texto
// =============================================================================
// Fase F1 — prova de fiacao, nao de estetica. Ver nos/cabecalho.tsx.

import { interpolate } from "remotion";
import type { NoTexto } from "../../contratos/manifesto";
import {
  background,
  fontWeight,
  lineHeight,
  maxCharsPerLine,
  msToFrames,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "texto",
  schema: "Texto.1",
  id: "no-texto",
  descricao: "Corpo de texto com destaque opcional e alinhamento configuravel",
};

const Texto: NoComponent = ({ no, frame, fps, height }) => {
  const texto = no as NoTexto;
  const entrada = Math.max(1, msToFrames(transitionDuration.base, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const alinhamento = texto.alinhamento ?? "esquerda";
  const textAlign =
    alinhamento === "esquerda" ? "left" : alinhamento === "direita" ? "right" : "center";
  const justifyContent =
    alinhamento === "esquerda"
      ? "flex-start"
      : alinhamento === "direita"
        ? "flex-end"
        : "center";

  return (
    <div
      data-no={texto.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent,
        paddingLeft: spacing["24"],
        paddingRight: spacing["24"],
        backgroundColor: background.primary,
        opacity: opacidade,
      }}
    >
      <p
        style={{
          fontSize: Math.round(height * typeScale.body),
          fontWeight: texto.destaque ? fontWeight.semibold : fontWeight.regular,
          lineHeight: lineHeight.relaxed,
          color: texto.destaque ? corDeTexto.primary : corDeTexto.secondary,
          maxWidth: `${maxCharsPerLine}ch`,
          textAlign,
          margin: 0,
        }}
      >
        {texto.texto}
      </p>
    </div>
  );
};

export default Texto;
