// =============================================================================
// NO DE MENTIRA: midia
// =============================================================================
// Fase F1 — prova de fiacao, nao de estetica. Ver nos/cabecalho.tsx.
// Nao carrega asset nenhum: mostra o hash de conteudo, que e o unico
// enderecamento permitido abaixo da fronteira (C7 — nada de URL).

import { interpolate } from "remotion";
import type { NoMidia } from "../../contratos/manifesto";
import {
  background,
  borderRadius,
  fontFamily,
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
  tipo: "midia",
  schema: "Midia.1",
  id: "no-midia",
  descricao: "Marcador de midia (imagem, video ou GIF) enderecada por hash",
};

const ROTULOS: Record<string, string> = {
  imagem: "Imagem",
  video: "Video",
  gif: "GIF",
};

/** Quantos caracteres do hash aparecem no marcador. */
const PREFIXO_DO_HASH = 12;

const Midia: NoComponent = ({ no, frame, fps, width, height }) => {
  const midia = no as NoMidia;
  const entrada = Math.max(1, msToFrames(transitionDuration.snap, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      data-no={midia.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background.primary,
        opacity: opacidade,
      }}
    >
      <div
        style={{
          width: Math.round(width / 2),
          height: Math.round(height / 2),
          borderStyle: "dashed",
          borderWidth: spacing["1"] / 2,
          borderColor: highlight.primary,
          borderRadius: borderRadius.lg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing["4"],
        }}
      >
        <div
          style={{
            fontSize: Math.round(height * typeScale.title),
            color: highlight.primary,
            fontWeight: fontWeight.semibold,
          }}
        >
          [{ROTULOS[midia.tipo_midia] ?? midia.tipo_midia}]
        </div>
        <div
          style={{
            fontSize: Math.round(height * typeScale.caption),
            color: corDeTexto.muted,
            fontFamily: fontFamily.mono,
          }}
        >
          hash: {midia.hash.slice(0, PREFIXO_DO_HASH)}
        </div>
      </div>
    </div>
  );
};

export default Midia;
