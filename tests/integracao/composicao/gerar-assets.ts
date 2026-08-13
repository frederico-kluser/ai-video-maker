// =============================================================================
// Gera o asset de grafico da fixture integrada — um PNG RGBA deterministico
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// O no `grafico` (F1-09, ja mergeado) consome o asset resolvido pela fiacao
// via `<Img src={fonte}>`. Este arquivo produz o PNG que a fiacao serve:
// barras de TINTA sobre fundo TRANSPARENTE, com as cores de token do proprio
// projeto — e e por isso que o oraculo de conteudo do quadro composto sabe
// o que procurar: dentro da regiao do grafico, as cinco cores das barras tem
// de aparecer, e o fundo da cena tem de aparecer onde o PNG e transparente
// (AB-344: o alfa do no sobrevive ao compositor).
//
// Determinismo: zero relogio, zero RNG, zero metadado no PNG (o codificador
// em png.ts nao grava texto nem timestamp). O SHA-256 do arquivo e a chave
// do store da fixture: quem regenerar e conferir que o hash nao mudou e o
// proprio gate (C7, S-8).
//
// Uso:  npx tsx tests/integracao/composicao/gerar-assets.ts
// Saida ja versionada em fixtures/snapshots/integrado/assets/.
// =============================================================================

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { highlight, state } from "../../../src/design/tokens";
import { escreverPng } from "./png";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(
  AQUI,
  "..",
  "..",
  "..",
  "fixtures",
  "snapshots",
  "integrado",
  "assets",
);

export const LARGURA = 480;
export const ALTURA = 320;

function rgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * Barras de altura fixa — desenho deterministico, sem relogio e sem RNG.
 * As cinco cores sao tokens do projeto (highlight.primary/secondary e
 * state.success/warning/error): o oraculo procura exatamente estes hex no
 * quadro composto.
 */
export const BARRAS: readonly { cor: string; fracao: number }[] = [
  { cor: highlight.primary, fracao: 0.45 },
  { cor: state.success, fracao: 0.8 },
  { cor: state.warning, fracao: 0.6 },
  { cor: state.error, fracao: 0.95 },
  { cor: highlight.secondary, fracao: 0.3 },
];

/** Cor do pixel, ou `null` quando ele deve ficar sem tinta (alfa 0). */
function corDoPixel(x: number, y: number): [number, number, number] | null {
  const margem = 24;
  const larguraBarra = (LARGURA - margem * 2) / BARRAS.length;
  if (x < margem || x >= LARGURA - margem || y < margem || y >= ALTURA - margem) {
    return null;
  }
  const indice = Math.floor((x - margem) / larguraBarra);
  const barra = BARRAS[indice];
  if (barra === undefined) return null;
  // Um vao de 8 px entre barras, para o oraculo conseguir isolar cada cor.
  if ((x - margem) % larguraBarra > larguraBarra - 8) return null;
  const topo = ALTURA - margem - barra.fracao * (ALTURA - margem * 2);
  if (y < topo) return null;
  return rgb(barra.cor);
}

export function gerarPng(): Buffer {
  const comAlfa = new Uint8Array(LARGURA * ALTURA * 4);
  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      const i = y * LARGURA + x;
      const cor = corDoPixel(x, y);
      comAlfa[i * 4] = cor?.[0] ?? 0;
      comAlfa[i * 4 + 1] = cor?.[1] ?? 0;
      comAlfa[i * 4 + 2] = cor?.[2] ?? 0;
      comAlfa[i * 4 + 3] = cor === null ? 0 : 255;
    }
  }
  return escreverPng(LARGURA, ALTURA, 4, comAlfa);
}

function principal(): void {
  const png = gerarPng();
  mkdirSync(DESTINO, { recursive: true });
  const caminho = resolve(DESTINO, "grafico-integrado.png");
  writeFileSync(caminho, png);
  const hash = createHash("sha256").update(png).digest("hex");
  const existente = readFileSync(caminho).equals(png)
    ? "(bytes inalterados)"
    : "(ATENCAO: bytes mudaram — atualize o hash em fiar.tsx e no ledger)";
  process.stdout.write(`gerar-assets: ${caminho}\n`);
  process.stdout.write(`gerar-assets: sha256 = ${hash} ${existente}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  principal();
}
