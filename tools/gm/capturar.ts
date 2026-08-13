#!/usr/bin/env npx tsx
/**
 * tools/gm/capturar.ts — CAPTURA do golden master (card F5-08, W10).
 *
 * Uso:
 *   npx tsx tools/gm/capturar.ts [--saida <dir-da-execucao>] [--no-run]
 *
 * Fluxo:
 *   1. (padrao) roda o pipeline inteiro (a MESMA API do F5-07) com
 *      cache FRIO e saida dedicada — o golden nasce do render, nunca do
 *      Studio (C5);
 *   2. extrai os itens do golden da saida (tools/gm/extrair.ts — o
 *      mesmíssimo caminho que o gate usa);
 *   3. escreve fixtures/gm/** (indice + itens), com a chave C7, o pin
 *      de ferramentas, a pilha Remotion, o commit e a maquina;
 *   4. auto-conferencia: re-extrai da mesma saida e confere os bytes.
 *
 * O indice gravado (GoldenMaster.1) e a fonte da lista de frames do
 * gate: o gate NAO re-deriva a lista a cada execucao — usa a gravada,
 * para uma fixture que mude de forma acender o diff em vez de deslocar
 * a amostragem.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lerPinDeFerramentas, lerVersoesDaPilha } from "../../src/render/cache/index.js";
import { planoDeComposicao, type PlanoDeComposicao } from "../../src/composicao/ManifestoRaiz.js";
import {
  FORMATO_DO_INDICE,
  chaveC7DaCaptura,
  derivarFramesDoManifesto,
  escreverItem,
  executorDoFfmpeg,
  extrairItens,
  itensParaIndice,
  nomeDoFrame,
  sha256Hex,
} from "./extrair.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const GOLDEN = join(RAIZ, "fixtures", "gm");

interface Opcoes {
  readonly saida: string;
  readonly noRun: boolean;
}

function parsearArgumentos(argv: readonly string[]): Opcoes {
  let saida = join(RAIZ, ".cache", "gm", "captura");
  let noRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--saida") {
      const valor = argv[++i];
      if (valor === undefined) throw new Error("--saida precisa de um valor");
      saida = valor;
    } else if (arg === "--no-run") noRun = true;
    else throw new Error(`argumento desconhecido: ${arg ?? "(vazio)"}`);
  }
  return { saida, noRun };
}

/** Rodar a producao completa (API do F5-07) com cache frio. */
async function rodarPipeline(saida: string): Promise<void> {
  const { produzir } = await import("../../src/pipeline/index.js");
  const cacheDir = mkdtempSync(join(tmpdir(), "gm-captura-cache-"));
  process.stdout.write(`[gm] cache frio: ${cacheDir}\n`);
  const resultado = await produzir({
    fixture: "canonico",
    estrito: true,
    cacheDir,
    saida,
  });
  process.stdout.write(`[gm] chave C7 da producao: ${resultado.chaveC7}\n`);
}

async function escreverGolden(saida: string): Promise<number> {
  const plano = planoDaFixture();
  const manifesto = JSON.parse(
    await readFile(join(RAIZ, "fixtures", "canonico", "manifesto-valido.json"), "utf-8"),
  );
  const frames = derivarFramesDoManifesto(manifesto);

  process.stdout.write(`[gm] extraindo itens de ${saida}...\n`);
  const itens = await extrairItens(executorDoFfmpeg, saida, frames, plano.totalFrames);

  const manifestoResolvidoBytes = itens.get("manifestos/manifesto-resolvido.json");
  if (manifestoResolvidoBytes === undefined) {
    throw new Error("manifesto-resolvido.json ausente dos itens extraidos");
  }
  const { chave, componentes } = chaveC7DaCaptura(RAIZ, manifestoResolvidoBytes);
  const relatorioFinal = JSON.parse(
    (itens.get("manifestos/relatorio-final.json") as Buffer).toString("utf-8"),
  ) as { ferramentas: { ffmpeg: string; node: string } };

  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: RAIZ }).toString().trim();
  const maquina = `${execFileSync("hostname").toString().trim()} / ${process.platform} / ${process.arch}`;

  const indice = {
    schema_version: FORMATO_DO_INDICE,
    fixture: "canonico",
    estrito: true,
    captura: {
      commit,
      maquina,
      em: "2026-08-13",
      pipeline: "just produzir --fixture canonico --estrito (API do F5-07)",
    },
    ferramentas: {
      ffmpeg: relatorioFinal.ferramentas.ffmpeg,
      node: relatorioFinal.ferramentas.node,
      pilha: lerVersoesDaPilha(),
      pin: lerPinDeFerramentas(),
    },
    chaveC7: chave,
    componentesC7: componentes,
    frames: frames.map((f) => {
      const arquivo = `frames/${nomeDoFrame(f.frame, plano.totalFrames)}`;
      return {
        frame: f.frame,
        arquivo,
        motivo: f.motivo,
        sha256: sha256Hex(itens.get(arquivo) as Buffer),
      };
    }),
    itens: itensParaIndice(itens),
    naoCobre: [
      "o MP4 final (entregavel-final.mp4): o container carrega a versao do encoder — o golden compara frames decodificados do master QTRLE, nunca bytes do MP4",
      "os artefatos nao capturados (thumbnail, variante, entregavel.m4a/.srt, mp4): cobertos POR INDICE via relatorio-final.json — qualquer mudanca de hash deles muda o relatorio-final, que e item do golden",
      "o timing palavra-a-palavra da locucao: o envelope por janela de 100 ms pega mudanca de ganho/duracao; um deslocamento menor que uma janela pode passar (declarado)",
      "o 9:16: o estrito e 16:9-only (ADR-0042 decisao 4) — nenhum artefato 9:16 existe",
      "a rede: o render estrito e offline por construcao; o golden nao bloqueia rede (o offline-guard cobre)",
      "a maquina: o baseline vale para a maquina que o capturou (ffmpeg/Chrome pinados; sem container — declarado no README)",
    ],
  };

  process.stdout.write(`[gm] escrevendo fixtures/gm/ (${String(itens.size)} itens + indice)...\n`);
  for (const [arquivo, bytes] of itens) {
    await escreverItem(GOLDEN, arquivo, bytes);
  }
  await escreverItem(GOLDEN, "manifesto.json", Buffer.from(JSON.stringify(indice, null, 2), "utf-8"));
  process.stdout.write(
    `[gm] indice: chaveC7=${chave.slice(0, 16)}… frames=${String(frames.length)} itens=${String(itens.size)}\n`,
  );

  // Auto-conferencia: re-extrai da MESMA saida e compara bytes.
  process.stdout.write("[gm] auto-conferencia: re-extraindo e comparando...\n");
  const itens2 = await extrairItens(executorDoFfmpeg, saida, frames, plano.totalFrames);
  const problemas: string[] = [];
  for (const [arquivo, bytes] of itens) {
    const bytes2 = itens2.get(arquivo);
    if (bytes2 === undefined || !bytes.equals(bytes2)) {
      problemas.push(`item ${arquivo} divergiu na re-extracao`);
    }
  }
  if (problemas.length > 0) {
    process.stderr.write(`VERMELHO: captura divergiu na auto-conferencia:\n  - ${problemas.join("\n  - ")}\n`);
    return 1;
  }
  process.stdout.write(`=== gm: captura VERDE (${String(itens.size)} itens + indice em fixtures/gm/) ===\n`);
  return 0;
}

/** Plano da composicao da fixture canonica (nomes e totais de frames). */
function planoDaFixture(): PlanoDeComposicao {
  const manifesto = JSON.parse(
    readFileSync(join(RAIZ, "fixtures", "canonico", "manifesto-valido.json"), "utf-8"),
  );
  return planoDeComposicao(manifesto);
}

async function main(): Promise<number> {
  const { saida, noRun } = parsearArgumentos(process.argv.slice(2));
  process.stdout.write("=== gm: capturar — golden master de ponta a ponta (F5-08) ===\n");
  if (!noRun) {
    process.stdout.write("[gm] produzindo (pipeline completo, cache frio)...\n");
    await rodarPipeline(saida);
  }
  return escreverGolden(saida);
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    process.stderr.write(`capturar: ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}\n`);
    process.exit(2);
  },
);
