// =============================================================================
// NO DE MENTIRA: grafico
// =============================================================================
// Fase F1 — prova de fiacao, nao de estetica. Ver nos/cabecalho.tsx.
// Nao desenha grafico nenhum: mostra o tipo e a contagem de pontos, que e o
// que a raiz precisa provar que entregou.

import { interpolate } from "remotion";
import type { NoGrafico } from "../../contratos/manifesto";
import {
  background,
  borderRadius,
  fontWeight,
  highlight,
  msToFrames,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "grafico",
  schema: "Grafico.1",
  id: "no-grafico",
  descricao: "Marcador de grafico (barras, linha, pizza, area, dispersao)",
};

const ROTULOS: Record<string, string> = {
  barras: "Barras",
  linha: "Linha",
  pizza: "Pizza",
  area: "Area",
  dispersao: "Dispersao",
};

const Grafico: NoComponent = ({ no, frame, fps, width, height }) => {
  const grafico = no as NoGrafico;
  const entrada = Math.max(1, msToFrames(transitionDuration.base, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      data-no={grafico.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background.primary,
        opacity: opacidade,
        gap: spacing["6"],
      }}
    >
      {grafico.titulo ? (
        <h2
          style={{
            fontSize: Math.round(height * typeScale.title),
            fontWeight: fontWeight.semibold,
            color: corDeTexto.primary,
            margin: 0,
          }}
        >
          {grafico.titulo}
        </h2>
      ) : null}
      <div
        style={{
          width: Math.round(width / 2),
          height: Math.round(height / 2),
          borderStyle: "dashed",
          borderWidth: spacing["1"] / 2,
          borderColor: highlight.secondary,
          borderRadius: borderRadius.lg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing["3"],
        }}
      >
        <div
          style={{
            fontSize: Math.round(height * typeScale.subtitle),
            color: highlight.secondary,
            fontWeight: fontWeight.semibold,
          }}
        >
          [{ROTULOS[grafico.tipo_grafico] ?? grafico.tipo_grafico}]
        </div>
        <div
          style={{
            fontSize: Math.round(height * typeScale.caption),
            color: corDeTexto.secondary,
          }}
        >
          pontos: {String(grafico.dados.length)}
        </div>
      </div>
    </div>
  );
};

export default Grafico;
