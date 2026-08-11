// =============================================================================
// NO DE MENTIRA: codigo
// =============================================================================
// Fase F1 — prova de fiacao, nao de estetica. Ver nos/cabecalho.tsx.

import { interpolate } from "remotion";
import type { NoCodigo } from "../../contratos/manifesto";
import {
  background,
  border,
  borderRadius,
  fontFamily,
  highlight,
  lineHeight,
  msToFrames,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "codigo",
  schema: "Codigo.1",
  id: "no-codigo",
  descricao: "Bloco de codigo com realce de linhas",
};

const Codigo: NoComponent = ({ no, frame, fps, height }) => {
  const codigo = no as NoCodigo;
  const entrada = Math.max(1, msToFrames(transitionDuration.base, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const linhas = codigo.codigo.split("\n");
  const realcadas = new Set(codigo.linhas_destaque ?? []);

  return (
    <div
      data-no={codigo.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingLeft: spacing["20"],
        paddingRight: spacing["20"],
        backgroundColor: background.primary,
        opacity: opacidade,
      }}
    >
      {codigo.nome_arquivo ? (
        <div
          style={{
            fontSize: Math.round(height * typeScale.small),
            color: corDeTexto.muted,
            fontFamily: fontFamily.mono,
            marginBottom: spacing["3"],
          }}
        >
          {codigo.nome_arquivo}
        </div>
      ) : null}
      <pre
        style={{
          margin: 0,
          padding: spacing["6"],
          backgroundColor: background.secondary,
          borderRadius: borderRadius.md,
          borderStyle: "solid",
          borderWidth: spacing["1"] / 4,
          borderColor: border.default,
          overflow: "hidden",
          fontSize: Math.round(height * typeScale.caption),
          fontFamily: fontFamily.mono,
          lineHeight: lineHeight.normal,
          color: corDeTexto.secondary,
        }}
      >
        {linhas.map((linha, i) => (
          <div
            key={`${String(i)}:${linha}`}
            style={{
              backgroundColor: realcadas.has(i + 1)
                ? background.elevated
                : background.secondary,
              color: realcadas.has(i + 1) ? highlight.primary : corDeTexto.secondary,
              paddingLeft: spacing["2"],
              paddingRight: spacing["2"],
              borderRadius: borderRadius.sm,
            }}
          >
            {linha}
          </div>
        ))}
      </pre>
    </div>
  );
};

export default Codigo;
