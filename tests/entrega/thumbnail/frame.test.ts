// =============================================================================
// THUMBNAIL — escolha do frame (card F5-05, W7)
// =============================================================================
// A escolha do frame e a primeira resposta a pergunta adversarial (2) do
// card: o thumbnail e gerado do MESMO manifesto — o frame vem da MESMA
// aritmetica de composicao que o render usa (planoDeComposicao, F1-01),
// nunca de um numero digitado a parte.
//
// Disciplina da W7 (contrato-w7 §12): assercao de PRESENCA, nunca lista
// completa. O que se asserta aqui e que o frame escolhido cai no meio da
// janela do PRIMEIRO cabecalho do SEU manifesto — e que nessa altura a
// mola de entrada ja acomodou (o titulo esta inteiro na tela). Nenhum
// teste asserta quantos nos ou cenas a fixture tem.
// =============================================================================

import { describe, expect, it } from "vitest";

import { molaEm, presetObrigatorio } from "../../../src/composicao/nos/cabecalho";
import { planoDeComposicao } from "../../../src/composicao/ManifestoRaiz";
import type { Manifesto } from "../../../src/contratos/manifesto";
import { escolherFrameDoThumbnail } from "../../../src/entrega/thumbnail";
import { ThumbnailSemTitulo } from "../../../src/entrega/thumbnail";
import { FIXTURA_INTEGRADA } from "../../integracao/composicao/fiar";

/** O manifesto canonico — a lista de presenca que o gate exige. */
function manifestoCanonico(): Manifesto {
  return FIXTURA_INTEGRADA.manifesto;
}

/** Um manifesto minimo valido: uma cena, um cabecalho, nada pendurado. */
function manifestoComUmCabecalho(
  texto: string,
  duracaoFrames = 60,
): Manifesto {
  return {
    schema_version: "Manifesto.1",
    fps: 30,
    width: 1920,
    height: 1080,
    nos: [
      {
        id: "n-t",
        type: "cabecalho",
        schema: "Cabecalho.1",
        duracao_frames: duracaoFrames,
        texto,
      },
    ],
    cenas: [{ id: "c-1", nos: ["n-t"] }],
  };
}

describe("escolherFrameDoThumbnail", () => {
  it("escolhe o meio da janela do primeiro cabecalho, pela aritmetica do render", () => {
    const manifesto = manifestoCanonico();
    const plano = planoDeComposicao(manifesto);
    const primeiroCabecalho = plano.faixas.find((f) => f.tipo === "cabecalho");

    // Presenca: o primeiro cabecalho EXISTE (nao se asserte a lista inteira).
    expect(primeiroCabecalho).toBeDefined();
    expect(primeiroCabecalho!.no.type).toBe("cabecalho");

    const esperado = primeiroCabecalho!.inicio + Math.floor(primeiroCabecalho!.duracao / 2);
    expect(escolherFrameDoThumbnail(manifesto)).toBe(esperado);
  });

  it("no meio da janela a mola de entrada ja acomodou — o titulo esta inteiro", () => {
    const manifesto = manifestoCanonico();
    const frame = escolherFrameDoThumbnail(manifesto);
    const plano = planoDeComposicao(manifesto);
    const cabecalho = plano.faixas.find((f) => f.tipo === "cabecalho")!;

    // O frame escolhido esta DENTRO da janela do cabecalho.
    expect(frame).toBeGreaterThanOrEqual(cabecalho.inicio);
    expect(frame).toBeLessThan(cabecalho.fim);

    // A mola do preset padrao ("suave") pousou: opacidade 1 no frame escolhido.
    const suave = presetObrigatorio("suave");
    const mola = molaEm(frame, plano.fps, suave);
    expect(mola, `mola no frame ${String(frame)} deveria estar acomodada`).toBe(1);
  });

  it("e deterministico: o mesmo manifesto devolve o mesmo frame", () => {
    const manifesto = manifestoCanonico();
    expect(escolherFrameDoThumbnail(manifesto)).toBe(escolherFrameDoThumbnail(manifesto));
  });

  it("manifesto sem nenhum cabecalho e recusado — sem titulo nao ha thumbnail", () => {
    const manifesto = manifestoComUmCabecalho("titulo");
    const semCabecalho: Manifesto = {
      ...manifesto,
      nos: [
        {
          id: "n-t",
          type: "texto",
          schema: "Texto.1",
          duracao_frames: 60,
          texto: "nao sou titulo",
        },
      ],
    };
    expect(() => escolherFrameDoThumbnail(semCabecalho)).toThrow(ThumbnailSemTitulo);
  });

  it("o primeiro cabecalho da timeline manda, mesmo com cabecalho em outra cena", () => {
    const manifesto = manifestoCanonico();
    const primeiro = planoDeComposicao(manifesto).faixas.find(
      (f) => f.tipo === "cabecalho",
    )!;

    // Um manifesto com DOIS cabecalhos: o escolhido tem de ser o primeiro
    // da timeline — presenca do segundo nao muda a escolha do primeiro.
    const comSegundoCabecalho: Manifesto = {
      ...manifesto,
      nos: [
        ...manifesto.nos,
        {
          id: "n-extra-titulo",
          type: "cabecalho",
          schema: "Cabecalho.1",
          duracao_frames: 60,
          texto: "titulo final",
        },
      ],
      cenas: [
        ...manifesto.cenas,
        { id: "c-extra", nos: ["n-extra-titulo"] },
      ],
    };

    const escolhido = escolherFrameDoThumbnail(comSegundoCabecalho);
    const esperado = primeiro.inicio + Math.floor(primeiro.duracao / 2);
    expect(escolhido).toBe(esperado);
  });
});
