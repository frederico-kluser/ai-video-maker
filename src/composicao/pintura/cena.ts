// =============================================================================
// O PINTOR DE CENA — pinta os nos do registro dentro da janela da cena
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
// Promovido para src/composicao/pintura/ no PREP-w7 (AB-493).
//
// O pintor de cena de producao: pinta os nos do registro dentro da janela
// da cena, com o frame local de cada no derivado do relogio da cena. E o
// PINTOR DE CENA DAS TRANSICOES: injetado no SequenciaComTransicoes, que
// decide quais cenas existem no frame e em que ordem elas pintam.
//
// `frame` chega local da CENA (0 = primeiro frame da cena). O no tem o
// proprio relogio: `frame - entrada_frames`. Fora da janela do no, nada e
// emitido — os proprios nos ja recusam (contrato de F1-01), e esta dupla
// guarda e o que a pergunta adversarial 4 da W4 cobrou.
//
// A ordem de pintura e a ordem declarada em `cena.nos` — a mesma do plano
// da raiz (ManifestoRaiz). Quem pinta por ultimo fica por cima.
//
// PURO: zero hook, zero relogio, zero disco. `estado` vem da fiacao
// (`fiar`, em ./fiar.ts); o componente vem do REGISTRO_DE_NOS central.
// =============================================================================

import { createElement } from "react";
import { REGISTRO_DE_NOS } from "../registro";
import type { PintorDeCena } from "../transicoes/sequencia";
import type { Fiado } from "./fiar";

/**
 * O pintor de cena de producao: pinta os nos do registro dentro da janela
 * da cena, com o frame local de cada no derivado do relogio da cena.
 */
export function pintorDeCena(estado: Fiado): PintorDeCena {
  const { manifesto, porId } = estado;
  const cenaPorId = new Map(manifesto.cenas.map((c) => [c.id, c] as const));

  const Pintor: PintorDeCena = ({ cenaId, frame, fps, width, height }) => {
    const cena = cenaPorId.get(cenaId);
    if (cena === undefined) {
      throw new Error(`pintorDeCena: cena "${cenaId}" nao existe no manifesto`);
    }
    return createElement(
      "div",
      { "data-cena": cenaId, "data-frame": String(frame), style: { position: "absolute", inset: 0 } },
      cena.nos.map((noId) => {
        const no = porId.get(noId);
        if (no === undefined) {
          throw new Error(
            `pintorDeCena: cena "${cenaId}" referencia no inexistente "${noId}"`,
          );
        }
        const entrada = no.entrada_frames ?? 0;
        const local = frame - entrada;
        if (local < 0 || local >= no.duracao_frames) return null;
        const modulo = REGISTRO_DE_NOS.get(no.type);
        if (modulo === undefined) {
          throw new Error(
            `pintorDeCena: tipo "${no.type}" do no "${noId}" nao tem componente ` +
              `registrado em src/composicao/registro.ts`,
          );
        }
        const Componente = modulo.componente;
        return createElement(Componente, {
          key: noId,
          no,
          frame: local,
          fps,
          width,
          height,
        });
      }),
    );
  };

  return Pintor;
}
