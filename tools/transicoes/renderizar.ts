// =============================================================================
// RENDERIZAR — os snapshots de transicao, do RENDER de verdade
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// AGENTS.md, C5: "O Chrome do Studio != o Chrome do render. Nenhum snapshot
// aprovado a partir do Studio; so do render." Este script usa o mesmo caminho
// que `remotion still` usa por baixo (@remotion/bundler + @remotion/renderer),
// com `gl: swangle` (rasterizacao por software) para o pixel nao depender da
// GPU da maquina.
//
// Uso:
//   npx tsx tools/transicoes/renderizar.ts --saida <dir>
//   npx tsx tools/transicoes/renderizar.ts --aprovar     # grava nos aprovados
//
// O bundle e feito UMA vez e reaproveitado pelos N stills: bundlar por still
// multiplicaria o custo sem mudar nenhum pixel.
// =============================================================================

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { DIR_APROVADOS, QUADROS, arquivoDoQuadro } from "./quadros";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const ENTRADA = resolve(RAIZ, "src", "composicao", "transicoes", "entrada.tsx");

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function principal(): Promise<void> {
  const aprovar = process.argv.includes("--aprovar");
  const destino = aprovar
    ? resolve(RAIZ, DIR_APROVADOS)
    : resolve(RAIZ, argumento("--saida") ?? ".remotion/transicoes-recebidos");

  if (!existsSync(ENTRADA)) {
    console.error(`FALHOU: ponto de entrada ausente: ${ENTRADA}`);
    process.exit(1);
  }

  // Diretorio limpo: sobra de uma execucao anterior mascara arquivo que o
  // render desta vez NAO produziu.
  if (existsSync(destino) && !aprovar) {
    rmSync(destino, { recursive: true, force: true });
  }
  mkdirSync(destino, { recursive: true });

  console.log(`=== renderizar: ${String(QUADROS.length)} quadro(s) -> ${destino}`);
  console.log("bundlando...");

  const serveUrl = await bundle({
    entryPoint: ENTRADA,
    onProgress: () => undefined,
  });

  for (const quadro of QUADROS) {
    const id = `transicao-${quadro.tipo}`;
    const composicao = await selectComposition({
      serveUrl,
      id,
      inputProps: { tipo: quadro.tipo },
    });

    const saida = join(destino, arquivoDoQuadro(quadro));
    await renderStill({
      composition: composicao,
      serveUrl,
      output: saida,
      frame: quadro.frame,
      inputProps: { tipo: quadro.tipo },
      imageFormat: "png",
      chromiumOptions: { gl: "swangle" },
      overwrite: true,
    });
    console.log(`  ${quadro.nome}.png  (${quadro.tipo}, frame ${String(quadro.frame)})`);
  }

  console.log(`=== renderizar: OK (${destino})`);
}

principal().catch((causa: unknown) => {
  console.error("FALHOU:", causa);
  process.exit(1);
});
