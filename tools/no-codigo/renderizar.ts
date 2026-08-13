// =============================================================================
// no-codigo — renderiza os stills de prova do no de codigo (F1-08)
// =============================================================================
// Um bundle, tres renders. O bundle e o mesmo do render de producao (webpack do
// Remotion), e nao o Studio: C5 do AGENTS.md diz que snapshot aprovado a partir
// do Studio nao vale, porque nao e o mesmo Chrome.
//
// Artefatos escritos no diretorio de saida:
//   render-1.png    composicao `no-codigo`, frame FRAME_DO_STILL
//   render-2.png    o MESMO render, de novo — a prova de determinismo e a
//                   comparacao byte a byte entre os dois
//   cru.png         composicao `no-codigo-cru` (mesmo codigo, sem tokens)
//   cores.json      as cores dos papeis, lidas do componente (nunca digitadas)
//   marcacao.html   o markup do componente, para o diff legivel do snapshot
//
// Uso: npx tsx tools/no-codigo/renderizar.ts --saida <dir>
// =============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Codigo, {
  CORES_DA_MOLDURA,
  COR_POR_PAPEL,
  COR_SEM_DESTAQUE,
  PAPEIS_DISTINTIVOS,
} from "../../src/composicao/nos/codigo";
import {
  FRAME_DO_STILL,
  NO_COM_DESTAQUE,
} from "../../fixtures/snapshots/no-codigo/no-de-teste";

const RAIZ = resolve(import.meta.dirname, "..", "..");
const ENTRADA = resolve(RAIZ, "fixtures", "snapshots", "no-codigo", "entrada.tsx");

const COMPOSICAO_COM_DESTAQUE = "no-codigo";
const COMPOSICAO_SEM_DESTAQUE = "no-codigo-cru";
const LARGURA = 1920;
const ALTURA = 1080;
const FPS = 30;

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const saida = argumento("--saida");
  if (saida === undefined) {
    throw new Error("uso: renderizar.ts --saida <dir>");
  }
  mkdirSync(saida, { recursive: true });

  // As cores saem do componente, que as tira de src/design/tokens.ts. Nenhum
  // valor de cor e redigitado aqui — Regra 2.
  writeFileSync(
    resolve(saida, "cores.json"),
    `${JSON.stringify(
      {
        porPapel: COR_POR_PAPEL,
        distintivos: PAPEIS_DISTINTIVOS,
        moldura: CORES_DA_MOLDURA,
        semDestaque: COR_SEM_DESTAQUE,
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );

  writeFileSync(
    resolve(saida, "marcacao.html"),
    `${renderToStaticMarkup(
      createElement(Codigo, {
        no: NO_COM_DESTAQUE,
        frame: FRAME_DO_STILL,
        fps: FPS,
        width: LARGURA,
        height: ALTURA,
      }),
    )}\n`,
    "utf-8",
  );

  process.stdout.write(`bundlando ${ENTRADA}\n`);
  const serveUrl = await bundle({
    entryPoint: ENTRADA,
    onProgress: () => undefined,
    ignoreRegisterRootWarning: true,
  });

  const composicoes = await getCompositions(serveUrl);
  const achar = (id: string) => {
    const c = composicoes.find((x) => x.id === id);
    if (c === undefined) {
      throw new Error(
        `composicao "${id}" nao esta no bundle (vistas: ${composicoes
          .map((x) => x.id)
          .join(", ")})`,
      );
    }
    return c;
  };

  const alvos: { composicao: string; arquivo: string }[] = [
    { composicao: COMPOSICAO_COM_DESTAQUE, arquivo: "render-1.png" },
    { composicao: COMPOSICAO_COM_DESTAQUE, arquivo: "render-2.png" },
    { composicao: COMPOSICAO_SEM_DESTAQUE, arquivo: "cru.png" },
  ];

  for (const alvo of alvos) {
    process.stdout.write(`  render ${alvo.composicao} -> ${alvo.arquivo}\n`);
    await renderStill({
      composition: achar(alvo.composicao),
      serveUrl,
      frame: FRAME_DO_STILL,
      imageFormat: "png",
      output: resolve(saida, alvo.arquivo),
      overwrite: true,
      chromiumOptions: { gl: "swangle" },
    });
  }

  process.stdout.write(`stills em ${saida}\n`);
}

main().catch((erro: unknown) => {
  process.stderr.write(`${String(erro)}\n`);
  process.exit(1);
});
