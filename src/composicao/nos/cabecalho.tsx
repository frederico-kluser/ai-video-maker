// =============================================================================
// NO DE MENTIRA: cabecalho
// =============================================================================
// Fase F1. Este componente nao tem ambicao estetica: ele existe para PROVAR
// A FIACAO — que a raiz entregou o no certo, no frame local certo, com as
// dimensoes certas. Os atributos data-* sao a evidencia que o gate le.
// Substituido pelo componente real na onda W4.

import { interpolate } from "remotion";
import type { NoCabecalho } from "../../contratos/manifesto";
import {
  background,
  fontWeight,
  msToFrames,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "cabecalho",
  schema: "Cabecalho.1",
  id: "no-cabecalho",
  descricao: "Titulo e subtitulo com alinhamento configuravel",
};

const Cabecalho: NoComponent = ({ no, frame, fps, height }) => {
  const cabecalho = no as NoCabecalho;
  const entrada = Math.max(1, msToFrames(transitionDuration.base, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const alinhamento = cabecalho.alinhamento ?? "centro";
  const textAlign =
    alinhamento === "esquerda" ? "left" : alinhamento === "direita" ? "right" : "center";
  const alignItems =
    alinhamento === "esquerda"
      ? "flex-start"
      : alinhamento === "direita"
        ? "flex-end"
        : "center";

  return (
    <div
      data-no={cabecalho.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems,
        justifyContent: "center",
        paddingLeft: spacing["24"],
        paddingRight: spacing["24"],
        backgroundColor: background.primary,
        color: corDeTexto.primary,
        opacity: opacidade,
      }}
    >
      <h1
        style={{
          fontSize: Math.round(height * typeScale.display),
          fontWeight: fontWeight.bold,
          margin: 0,
          textAlign,
        }}
      >
        {cabecalho.texto}
      </h1>
      {cabecalho.subtitulo ? (
        <p
          style={{
            fontSize: Math.round(height * typeScale.subtitle),
            fontWeight: fontWeight.regular,
            marginTop: spacing["4"],
            marginBottom: 0,
            color: corDeTexto.secondary,
            textAlign,
          }}
        >
          {cabecalho.subtitulo}
        </p>
      ) : null}
    </div>
  );
};

export default Cabecalho;
