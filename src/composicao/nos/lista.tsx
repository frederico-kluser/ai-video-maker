// =============================================================================
// NO DE MENTIRA: lista
// =============================================================================
// Fase F1 — prova de fiacao, nao de estetica. Ver nos/cabecalho.tsx.

import { interpolate } from "remotion";
import type { NoLista } from "../../contratos/manifesto";
import {
  background,
  lineHeight,
  msToFrames,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "lista",
  schema: "Lista.1",
  id: "no-lista",
  descricao: "Lista de itens com marcadores ou numeracao",
};

const Lista: NoComponent = ({ no, frame, fps, height }) => {
  const lista = no as NoLista;
  const entrada = Math.max(1, msToFrames(transitionDuration.snap, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const alinhamento = lista.alinhamento ?? "esquerda";
  const alignItems =
    alinhamento === "centro"
      ? "center"
      : alinhamento === "direita"
        ? "flex-end"
        : "flex-start";

  return (
    <div
      data-no={lista.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems,
        paddingLeft: spacing["24"],
        paddingRight: spacing["24"],
        backgroundColor: background.primary,
        opacity: opacidade,
      }}
    >
      <ul
        style={{
          listStyleType: lista.ordenada ? "decimal" : "disc",
          color: corDeTexto.primary,
          fontSize: Math.round(height * typeScale.body),
          lineHeight: lineHeight.loose,
          margin: 0,
          paddingLeft: alinhamento === "centro" ? 0 : spacing["10"],
          textAlign: alinhamento === "centro" ? "center" : "left",
        }}
      >
        {lista.itens.map((item) => (
          <li key={item} style={{ marginBottom: spacing["2"] }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Lista;
