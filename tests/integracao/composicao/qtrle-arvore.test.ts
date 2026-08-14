// =============================================================================
// QTRLE-ARVORE — o wiring do webm na ARVORE renderizada (complemento do
// qtrle.ts, a sonda de pixel)
// =============================================================================
// Correcao da revisao adversaria (onda 2, fix): o qtrle.ts afirmava que "o
// quadro do join no frame 460 e o frame 33 do webm do cassete" — FALSO (na
// fixture integrada o webm de n-009 fica no fundo, dominado pelos graficos
// sobrepostos; o oraculo de entropia passaria com o webm ausente). O que a
// arvore PROVA — e esta sonda asserta — e o WIRING: com o cassete real
// fiado no no n-009, o no renderiza o caminho do webm (`data-modo` +
// `<video src=grafico/<hash>.webm>`); sem a fiacao, o no desenha do
// manifesto sem `<video>` nenhum. Se o webm sumir do wiring, esta sonda
// fica VERMELHA.
// =============================================================================

import { createElement, type ImgHTMLAttributes, type VideoHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fiarApadrao, pintar } from "../../../src/composicao/pintura/index";

vi.mock("remotion", async (importOriginal) => {
  const original = await importOriginal<typeof import("remotion")>();
  return {
    ...original,
    Img: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
    OffthreadVideo: (props: VideoHTMLAttributes<HTMLVideoElement>) =>
      createElement("video", props),
    Sequence: (props: { from: number; children?: unknown }) =>
      createElement(
        "div",
        { "data-sequence-from": String(props.from) },
        props.children as never,
      ),
  };
});

import type { FixtureIntegrada } from "./fiar";

const AQUI = resolve(import.meta.dirname);
const RAIZ = resolve(AQUI, "..", "..", "..");
const CAMINHO_FIXTURA = resolve(
  RAIZ,
  "fixtures",
  "snapshots",
  "integrado",
  "manifesto-integrado.json",
);

const MIME_DO_CASSETE_REAL = "video/webm";
const FRAME = 460; // c-004, janela de n-009 (o mesmo frame do join do qtrle.ts)

/** A fixture com o descritor do cassete real fiado no n-009 (em memoria). */
function fixtureComWebmFiado(): FixtureIntegrada {
  const fixture = JSON.parse(readFileSync(CAMINHO_FIXTURA, "utf8")) as FixtureIntegrada;
  const hashDoPng = fixture.nos_grafico["n-009"];
  if (hashDoPng === undefined) {
    throw new Error("qtrle-arvore: n-009 nao tem asset na fixture integrada");
  }
  const base = resolve(RAIZ, "fixtures", "cassetes", "grafico");
  let achou: { hash: string; asset: Record<string, unknown> } | null = null;
  for (const d of readdirSync(base).sort()) {
    const caminho = join(base, d, "resultado.json");
    if (achou !== null) break;
    const resultado = JSON.parse(readFileSync(caminho, "utf8")) as {
      assets: Record<string, Record<string, unknown>>;
    };
    for (const [hash, asset] of Object.entries(resultado.assets ?? {})) {
      if (asset["mimeType"] !== MIME_DO_CASSETE_REAL) continue;
      if (achou === null && existsSync(join(base, d, "corpos", hash))) {
        achou = { hash, asset };
      }
    }
  }
  if (achou === null) {
    throw new Error("qtrle-arvore: nenhum cassete com corpo commitado");
  }
  fixture.assets[hashDoPng] = { ...achou.asset, hash: hashDoPng } as never;
  return fixture;
}

function htmlDa(fixture: FixtureIntegrada): string {
  const estado = fiarApadrao(fixture);
  return renderToStaticMarkup(
    pintar(estado.manifesto, FRAME, {
      fps: estado.plano.fps,
      width: estado.plano.width,
      height: estado.plano.height,
    }),
  );
}

describe("qtrle-arvore — o wiring do webm na arvore renderizada", () => {
  it("com o cassete real fiado: n-009 renderiza data-modo=asset-video + <video src=grafico/<hash>.webm>", () => {
    const html = htmlDa(fixtureComWebmFiado());
    const no = /data-no="n-009"[^>]*data-modo="([^"]+)"/.exec(html);
    expect(no?.[1]).toBe("asset-video");
    const video = /<video[^>]*src="([^"]+)"/.exec(html);
    expect(video).not.toBeNull();
    expect(video![1]!).toMatch(/^\/?grafico\/[0-9a-f]+\.webm$/);
    expect(video![1]!.endsWith(".webm")).toBe(true);
  });

  it("sem a fiacao do webm: n-009 desenha do manifesto, SEM <video> nenhum", () => {
    const fixture = JSON.parse(readFileSync(CAMINHO_FIXTURA, "utf8")) as FixtureIntegrada;
    const html = htmlDa(fixture);
    const no = /data-no="n-009"[^>]*data-modo="([^"]+)"/.exec(html);
    // Na fixture integrada o n-009 tem asset PNG: desenha como asset de
    // IMAGEM (data-modo=asset), nunca como video.
    expect(no?.[1]).not.toBe("asset-video");
    expect(html).not.toContain("<video");
    expect(html).toContain('data-no="n-009"');
  });
});
