// =============================================================================
// Gera as duas fixtures de asset de grafico — o par que prova o ponto do card
// =============================================================================
// Card: F1-09 (onda W4)
//
//   grafico-com-alfa.png   tipo de cor 6 (RGBA), fundo transparente
//   grafico-opaco.png      tipo de cor 2 (RGB),  MESMO desenho, fundo chapado
//
// Os dois tem a mesma extensao, o mesmo desenho e o mesmo `mimeType`
// ("image/png") no manifesto resolvido. A UNICA diferenca esta nos bytes: um
// carrega canal alfa e o outro nao. E exatamente a diferenca que o video
// mostra e que o build, sem a guarda deste card, nao mostra.
//
// Uso:  npx tsx tools/no-grafico/gerar-assets.ts
// Saida ja versionada em fixtures/snapshots/no-grafico/assets/.
// =============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { highlight, state } from "../../src/design/tokens";
import { escreverPng } from "./png";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(AQUI, "..", "..", "fixtures", "snapshots", "no-grafico", "assets");

const LARGURA = 480;
const ALTURA = 320;

function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Barras de altura fixa — desenho deterministico, sem relogio e sem RNG. */
const BARRAS: readonly { readonly cor: string; readonly fracao: number }[] = [
  { cor: highlight.primary, fracao: 0.45 },
  { cor: state.success, fracao: 0.8 },
  { cor: state.warning, fracao: 0.6 },
  { cor: state.error, fracao: 0.95 },
  { cor: highlight.secondary, fracao: 0.3 },
];

/** Cor do pixel, ou `null` quando ele deve ficar sem tinta. */
function corDoPixel(x: number, y: number): [number, number, number] | null {
  const margem = 24;
  const largura = (LARGURA - margem * 2) / BARRAS.length;
  if (x < margem || x >= LARGURA - margem || y < margem || y >= ALTURA - margem) {
    return null;
  }
  const indice = Math.floor((x - margem) / largura);
  const barra = BARRAS[indice];
  if (barra === undefined) return null;
  if ((x - margem) % largura > largura - 8) return null;
  const topo = ALTURA - margem - barra.fracao * (ALTURA - margem * 2);
  if (y < topo) return null;
  return rgb(barra.cor);
}

function gerar(): void {
  const comAlfa = new Uint8Array(LARGURA * ALTURA * 4);
  const opaco = new Uint8Array(LARGURA * ALTURA * 3);
  const fundoOpaco = rgb(state.info);

  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      const i = y * LARGURA + x;
      const cor = corDoPixel(x, y);
      // RGBA: sem tinta = alfa 0. E o que faz o grafico compor sobre a cena.
      comAlfa[i * 4] = cor?.[0] ?? 0;
      comAlfa[i * 4 + 1] = cor?.[1] ?? 0;
      comAlfa[i * 4 + 2] = cor?.[2] ?? 0;
      comAlfa[i * 4 + 3] = cor === null ? 0 : 255;
      // RGB: nao existe "sem tinta". O que sobra vira fundo chapado, e o
      // quadro inteiro cobre a cena.
      opaco[i * 3] = cor?.[0] ?? fundoOpaco[0];
      opaco[i * 3 + 1] = cor?.[1] ?? fundoOpaco[1];
      opaco[i * 3 + 2] = cor?.[2] ?? fundoOpaco[2];
    }
  }

  mkdirSync(DESTINO, { recursive: true });
  writeFileSync(resolve(DESTINO, "grafico-com-alfa.png"), escreverPng(LARGURA, ALTURA, 4, comAlfa));
  writeFileSync(resolve(DESTINO, "grafico-opaco.png"), escreverPng(LARGURA, ALTURA, 3, opaco));
  process.stdout.write(`gerar-assets: escrito em ${DESTINO}\n`);
}

gerar();
