// =============================================================================
// Canário — composição mínima para prova de determinismo
// =============================================================================
// Card: F0-06 — Harness de determinismo
// Este é o PRIMEIRO componente que produz pixel no programa.
// O canário prova que o pipeline de render é determinístico:
// dois renders do mesmo frame produzem bytes idênticos.
//
// REGRAS:
// - Nenhum Date.now(), Math.random(), setTimeout, requestAnimationFrame
// - Nenhuma animação CSS (transition, animation)
// - Nenhum asset da rede
// - Toda animação é função pura de useCurrentFrame()
// =============================================================================

import { useCurrentFrame, interpolate, spring, AbsoluteFill } from "remotion";

export const Canario: React.FC = () => {
  const frame = useCurrentFrame();

  // Posição horizontal: move da esquerda para a direita entre frames 0 e 30
  const x = interpolate(frame, [0, 30], [100, 1820], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Opacidade: fade-in com mola subamortecida
  const opacity = spring({
    frame,
    fps: 30,
    config: { damping: 200 },
  });

  // Raio do círculo: cresce com overshoot
  const radius = spring({
    frame,
    fps: 30,
    config: { damping: 15, mass: 0.5 },
  });

  // Cor do texto: interpola de azul para roxo
  const textHue = interpolate(frame, [0, 30], [220, 270], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0B1121",
        fontFamily: "sans-serif",
      }}
    >
      {/* Círculo animado */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: 540 - radius * 50,
          width: radius * 100,
          height: radius * 100,
          borderRadius: "50%",
          backgroundColor: `hsl(${textHue}, 70%, 60%)`,
          opacity,
        }}
      />

      {/* Texto do canário */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 100,
          color: "white",
          fontSize: 48,
          fontWeight: 700,
          opacity,
        }}
      >
        Canário — Prova de Determinismo
      </div>

      {/* Indicador de frame */}
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 170,
          color: "rgba(255,255,255,0.5)",
          fontSize: 24,
          fontFamily: "monospace",
          opacity,
        }}
      >
        Frame: {frame}
      </div>
    </AbsoluteFill>
  );
};
