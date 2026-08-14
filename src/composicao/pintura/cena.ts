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
// O EIXO DE TEXTO (onda 2): este e o ponto de fiacao da cena. O pintor
// anexa a cada no de texto a sua BANDA (regiao) e o FATOR DE TRANSICAO
// (src/composicao/layout/eixo.ts) — e o lugar certo porque a transicao
// (lado/progresso) so existe aqui, na camada de pintura. Para nos de
// grafico com video resolvido ele anexa a base absoluta do relogio do
// video (e a fatia, na montagem da cena c-004): sem `<Sequence>` nesta
// camada, o OffthreadVideo so recebe o deslocamento certo com a base.
//
// PURO: zero hook, zero relogio, zero disco. `estado` vem da fiacao
// (`fiar`, em ./fiar.ts); o componente vem do REGISTRO_DE_NOS central.
// =============================================================================

import { createElement } from "react";
import { REGISTRO_DE_NOS } from "../registro";
import type { PintorDeCena } from "../transicoes/sequencia";
import { duracaoDaCena } from "../tempo";
import {
  eDeTexto,
  escalonarGraficosDaCena,
  fatorDeTextoNaTransicao,
  regioesDeTextoDaCena,
  type EixoDoNo,
} from "../layout/eixo";
import type { NoGraficoResolvido } from "../nos/grafico";
import type { Fiado } from "./fiar";

/**
 * O pintor de cena de producao: pinta os nos do registro dentro da janela
 * da cena, com o frame local de cada no derivado do relogio da cena.
 */
export function pintorDeCena(estado: Fiado): PintorDeCena {
  const { manifesto, porId } = estado;
  const cenaPorId = new Map(manifesto.cenas.map((c) => [c.id, c] as const));

  const Pintor: PintorDeCena = ({
    cenaId,
    frame,
    frameAbsoluto,
    lado,
    progresso,
    fps,
    width,
    height,
  }) => {
    const cena = cenaPorId.get(cenaId);
    if (cena === undefined) {
      throw new Error(`pintorDeCena: cena "${cenaId}" nao existe no manifesto`);
    }

    // O eixo da cena, calculado UMA vez por chamada (funcoes puras, baratas).
    const regioes = regioesDeTextoDaCena(cena, porId, width, height);
    const fatorDeTexto = fatorDeTextoNaTransicao(lado, progresso);
    const duracao = duracaoDaCena(cena, porId);
    const montagem = escalonarGraficosDaCena(cena, porId, duracao);
    const fatias = new Map(montagem.map((f) => [f.noId, f] as const));
    const inicioAbsolutoDaCena = frameAbsoluto - frame;

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
        let local = frame - entrada;

        const eixo: EixoDoNo = {};
        const fatia = fatias.get(noId);
        if (fatia !== undefined) {
          // Montagem: o no so desenha dentro da propria fatia, e o relogio
          // do no comeca no inicio da fatia.
          if (frame < fatia.inicio || frame >= fatia.inicio + fatia.duracao) {
            return null;
          }
          local = frame - entrada - fatia.inicio;
          eixo.videoInicioAbsoluto = inicioAbsolutoDaCena + entrada + fatia.inicio;
        } else if (no.type === "grafico") {
          const resolvido = (no as NoGraficoResolvido).grafico_resolvido;
          if (resolvido !== undefined && resolvido.asset.tipo === "video") {
            // Video de grafico sem montagem: o relogio comeca no inicio da
            // propria janela do no.
            eixo.videoInicioAbsoluto = inicioAbsolutoDaCena + entrada;
          }
        }

        if (eDeTexto(no)) {
          eixo.regiao = regioes.get(noId);
          eixo.fatorTexto = fatorDeTexto;
        }

        if (local < 0 || local >= no.duracao_frames) return null;

        const modulo = REGISTRO_DE_NOS.get(no.type);
        if (modulo === undefined) {
          throw new Error(
            `pintorDeCena: tipo "${no.type}" do no "${noId}" nao tem componente ` +
              `registrado em src/composicao/registro.ts`,
          );
        }
        const Componente = modulo.componente;
        const noComEixo = Object.keys(eixo).length > 0 ? { ...no, eixo } : no;
        return createElement(Componente, {
          key: noId,
          no: noComEixo,
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
