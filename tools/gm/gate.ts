#!/usr/bin/env npx tsx
/**
 * tools/gm/gate.ts — O GATE do golden master de ponta a ponta (card F5-08,
 * W10). Rodado por `just gm-e2e`.
 *
 * O que o gate prova, e como:
 *
 *   P0  PRESENCA do golden: cada item do indice (fixtures/gm/manifesto.json)
 *       tem de existir em disco — apagar um item do golden fica VERMELHO
 *       NOMEANDO o item (∅-crit por ausencia; nunca "nada a comparar").
 *   R1  o pipeline roda de NOVO com cache FRIO (a regeneracao do card:
 *       "o golden regenera") e os itens extraidos da saida (o MESMO
 *       caminho do tools/gm/extrair.ts da captura) tem de ser byte a
 *       byte identicos ao golden commitado — divergencia acusa NOMEANDO
 *       o item.
 *   R2  re-execucao com o MESMO cache (quente — 0 chamadas ao renderer):
 *       os itens tem de sair byte a byte identicos aos da R1 (2× idêntico,
 *       incluindo o caminho servido pelo cache).
 *   S0  PINS: o ffmpeg corrente casa o pin 6.1.1 e o registrado no
 *       golden; o node corrente casa o registrado; a chave C7
 *       recomputada da saida da R1 casa a chave registrada no golden
 *       (uma mudanca de versao de ferramenta acende AQUI — declarado,
 *       sem re-render — e muda tambem os itens, se re-renderizar).
 *   M1  MUTACAO DE TOKEN: background.primary (#030712 -> #1F2937, escuro
 *       e valido — muda o pixel sem derrubar os gates do pipeline) ->
 *       producao com cache FRIO -> a extracao TEM de divergir do golden
 *       (senao o golden e cego). tokens.ts restaurado e conferido por
 *       sha256.
 *   M2  MUTACAO DE FONTE: os bytes de Inter-Regular.woff2 trocados pelos
 *       de JetBrainsMono-Regular.woff2 -> producao com cache FRIO -> a
 *       extracao TEM de divergir. Arquivo restaurado e conferido.
 *
 * O MP4 final NUNCA entra na comparacao (falso oraculo: o encoder muda).
 * O que ele compara: manifesto-resolvido.json, mix-documento.json,
 * pos-documento.json, relatorio-final.json (o indice de hashes dos 11
 * artefatos), frames-chave (PNG do master QTRLE) e o envelope de audio
 * (RMS por janela do master.wav do mix) — uma regressao de AUDIO sem
 * regressao de VIDEO muda o envelope e o gate fica VERMELHO.
 *
 * Veredito por PROBLEMAS (vazio = VERDE), na disciplina dos outros gates.
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { versaoDoFfmpeg, PIN_FFMPEG } from "../../src/entrega/pos/index.js";
import {
  chaveC7DaCaptura,
  executorDoFfmpeg,
  extrairItens,
} from "./extrair.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const GOLDEN = join(RAIZ, "fixtures", "gm");
const INDICE = join(GOLDEN, "manifesto.json");
const TOKENS = join(RAIZ, "src", "design", "tokens.ts");
const FONTE_INTER = join(RAIZ, "assets", "fontes", "Inter-Regular.woff2");
const FONTE_MONO = join(RAIZ, "assets", "fontes", "JetBrainsMono-Regular.woff2");

/**
 * A CLI do pipeline como subprocesso — cada execucao re-importa tudo.
 * Com retry (ate 3 tentativas): o render do Chrome sob carga tem flake
 * transitorio conhecido ("delayRender nao limpa apos 28 s" — a politica
 * do CI do F5-07 e rodar o gate 2x exatamente por isso; medido nesta
 * maquina durante o proprio card, ~1 em cada 2 renders sob carga). O
 * retry mantem o MESMO cache-dir (o resume do cache por conteudo e o
 * caminho desenhado) e o MESMO saida; um erro real falha nas tres
 * tentativas.
 */
const TENTATIVAS_POR_PRODUCAO = 3;

async function rodarProducao(saida: string, cacheDir: string): Promise<string> {
  let ultimoErro: unknown = null;
  for (let tentativa = 1; tentativa <= TENTATIVAS_POR_PRODUCAO; tentativa++) {
    try {
      return await new Promise<string>((resolve2, reject) => {
        execFile(
          "npx",
          ["tsx", "src/pipeline/produzir.ts", "--fixture", "canonico", "--estrito", "--saida", saida, "--cache-dir", cacheDir],
          { cwd: RAIZ, timeout: 45 * 60_000, maxBuffer: 64 * 1024 * 1024 },
          (erro, stdout, stderr) => {
            if (erro) {
              reject(new Error(`produzir falhou (${String(erro.code ?? erro.message)})\n${String(stdout)}\n${String(stderr)}`));
              return;
            }
            resolve2(String(stdout));
          },
        );
      });
    } catch (erro) {
      ultimoErro = erro;
      if (tentativa < TENTATIVAS_POR_PRODUCAO) {
        process.stdout.write(
          `  AVISO producao falhou na tentativa ${String(tentativa)} — flake transitorio do render Chrome sob carga? tentando de novo (mesmo cache)\n`,
        );
      }
    }
  }
  throw ultimoErro;
}

interface Problema {
  readonly nome: string;
  readonly motivo: string;
}
const problemas: Problema[] = [];
function ok(mensagem: string): void {
  process.stdout.write(`  OK    ${mensagem}\n`);
}
function falhou(nome: string, motivo: string): void {
  process.stdout.write(`  FALHOU ${nome}: ${motivo}\n`);
  problemas.push({ nome, motivo });
}

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** A saida de uma execucao (r1, r2 ou mutacao) -> itens extraidos. */
async function extrairDa(saida: string, frames: ReadonlyArray<{ frame: number; arquivo: string }>, totalFrames: number) {
  return extrairItens(executorDoFfmpeg, saida, frames.map((f) => ({ frame: f.frame, motivo: "" })), totalFrames);
}

async function main(): Promise<number> {
  const temporario = await mkdtemp(join(tmpdir(), "gm-gate-"));
  process.stdout.write("=== gm-e2e: golden master de ponta a ponta (F5-08, W10) ===\n");

  // ── P0: presenca do golden (∅-crit por ausencia) ──────────────────────
  process.stdout.write("=== P0: presenca do golden ===\n");
  let indice: {
    frames: ReadonlyArray<{ frame: number; arquivo: string; motivo: string; sha256: string }>;
    itens: ReadonlyArray<{ arquivo: string; sha256: string; tamanho: number }>;
    ferramentas: { ffmpeg: string; node: string };
    chaveC7: string;
    schema_version: string;
    naoCobre: readonly string[];
  };
  try {
    indice = JSON.parse(readFileSync(INDICE, "utf-8")) as typeof indice;
  } catch (erro) {
    falhou("P0", `o indice do golden (${INDICE}) nao existe ou nao parseia: ${String(erro)}`);
    process.stdout.write(`=== gm-e2e: VERMELHO (${String(problemas.length)} falha(s)) ===\n`);
    return 1;
  }
  if (indice.schema_version !== "GoldenMaster.1") {
    falhou("P0", `indice com schema ${indice.schema_version} — esperado GoldenMaster.1`);
  }
  if (!Array.isArray(indice.naoCobre) || indice.naoCobre.length === 0) {
    falhou("P0", "o indice do golden NAO declara naoCobre — o que o golden nao cobre tem de estar escrito (pergunta adversarial 2)");
  }
  let ausentes = 0;
  for (const item of indice.itens) {
    try {
      readFileSync(join(GOLDEN, item.arquivo));
    } catch {
      ausentes++;
      falhou("P0", `item do golden AUSENTE: ${item.arquivo} — apagar item do golden fica VERMELHO por ausencia`);
    }
  }
  if (ausentes === 0) ok(`P0: ${String(indice.itens.length)} itens do golden presentes em disco`);
  const totalFramesDoIndice = Math.max(...indice.frames.map((f) => f.frame)) + 1;

  // ── S0: pins e chave C7 (versao de ferramenta por PIN, sem re-render) ─
  process.stdout.write("=== S0: pins de ferramenta e chave C7 ===\n");
  const ffmpegAtual = await versaoDoFfmpeg();
  if (!ffmpegAtual.startsWith(PIN_FFMPEG)) {
    falhou("S0", `ffmpeg corrente ${ffmpegAtual} fora do pin ${PIN_FFMPEG} — versao de ferramenta mudou`);
  } else if (ffmpegAtual !== indice.ferramentas.ffmpeg) {
    falhou("S0", `ffmpeg corrente ${ffmpegAtual} diverge do registrado no golden (${indice.ferramentas.ffmpeg})`);
  } else {
    ok(`S0: ffmpeg ${ffmpegAtual} no pin (declarado, sem re-render)`);
  }
  if (process.version !== indice.ferramentas.node) {
    falhou("S0", `node corrente ${process.version} diverge do registrado no golden (${indice.ferramentas.node})`);
  } else {
    ok(`S0: node ${process.version} == registrado no golden`);
  }

  // ── R1: producao com cache FRIO, itens == golden (o golden regenera) ──
  process.stdout.write("=== R1: producao fria — itens devem ser identicos ao golden ===\n");
  const cacheR1 = join(temporario, "cache-r1");
  const saidaR1 = join(temporario, "saida-r1");
  await rodarProducao(saidaR1, cacheR1);
  const itensR1 = await extrairDa(saidaR1, indice.frames, totalFramesDoIndice);
  let divergentesR1 = 0;
  for (const item of indice.itens) {
    const bytes = itensR1.get(item.arquivo);
    if (bytes === undefined) {
      divergentesR1++;
      falhou("R1", `item ${item.arquivo} nao foi extraido da producao — ausencia e VERMELHO`);
      continue;
    }
    const hash = sha256Hex(bytes);
    if (hash !== item.sha256) {
      divergentesR1++;
      falhou("R1", `item ${item.arquivo} DIVERGENTE do golden (${hash.slice(0, 16)}… vs ${item.sha256.slice(0, 16)}…)`);
    }
  }
  if (divergentesR1 === 0) ok(`R1: ${String(indice.itens.length)} itens byte a byte identicos ao golden`);

  // A chave C7 da producao fria precisa bater com a do golden.
  const manifestoR1 = itensR1.get("manifestos/manifesto-resolvido.json");
  if (manifestoR1 !== undefined) {
    const recomputada = chaveC7DaCaptura(RAIZ, manifestoR1);
    if (recomputada.chave !== indice.chaveC7) {
      falhou("S0", `chave C7 recomputada ${recomputada.chave.slice(0, 16)}… diverge da do golden (${indice.chaveC7.slice(0, 16)}…) — tokens/versoes/pins mudaram`);
    } else {
      ok(`S0: chave C7 recomputada == golden (${recomputada.chave.slice(0, 16)}…)`);
    }
  }

  // ── R2: re-execucao com o MESMO cache (quente) — 2x identico ──────────
  process.stdout.write("=== R2: re-execucao quente — 2x identico ===\n");
  const saidaR2 = join(temporario, "saida-r2");
  await rodarProducao(saidaR2, cacheR1);
  const itensR2 = await extrairDa(saidaR2, indice.frames, totalFramesDoIndice);
  let divergentesR2 = 0;
  for (const [arquivo, bytes] of itensR1) {
    const bytes2 = itensR2.get(arquivo);
    if (bytes2 === undefined || !bytes.equals(bytes2)) {
      divergentesR2++;
      falhou("R2", `item ${arquivo} divergiu entre as duas execucoes (2x identico)`);
    }
  }
  if (divergentesR2 === 0) ok(`R2: ${String(itensR1.size)} itens byte a byte identicos entre as 2 execucoes`);

  // ── M1: mutacao de token tem de acender o diff ─────────────────────────
  process.stdout.write("=== M1: mutacao de token (background.primary) TEM de acender o diff ===\n");
  const tokensOriginal = readFileSync(TOKENS);
  // Mutacao conservadora: background.primary #030712 -> #111827
  // (palette.gray[900]). Escuro, valido e consumido por TODOS os frames
  // (o fundo da pintura) — muda o pixel sem derrubar os gates do proprio
  // pipeline. CALIBRADO contra os pares declarados de tokens.ts: o pior
  // caso e state.error #EF4444 / highlight.primary #3B82F6 sobre o fundo
  // mutado, razoes 4.71:1 e 4.82:1 (>= 4.5 AA normal; medido — gray[800]
  // #1F2937 cai para 3.99:1 e o thumbnail do pipeline FALHA, mutacao
  // invalida). O piso de YAVG do encode e MAXIMO por frame: o conteudo
  // (texto/graficos/cards) mantem o maximo bem acima de 32.
  const mutado = tokensOriginal
    .toString("utf-8")
    .replace("primary: palette.gray[950],", "primary: palette.gray[900],");
  if (mutado === tokensOriginal.toString("utf-8")) {
    falhou("M1", "a mutacao de tokens.ts nao casou o padrao — o sed nao aplicou (falso verde)");
  } else {
    writeFileSync(TOKENS, mutado);
    const cacheM1 = join(temporario, "cache-m1");
    const saidaM1 = join(temporario, "saida-m1");
    try {
      await rodarProducao(saidaM1, cacheM1);
      const itensM1 = await extrairDa(saidaM1, indice.frames, totalFramesDoIndice);
      const divergiuM1 = indice.itens.some((item) => {
        const bytes = itensM1.get(item.arquivo);
        return bytes === undefined || sha256Hex(bytes) !== item.sha256;
      });
      if (divergiuM1) {
        const nomes = indice.itens
          .filter((item) => {
            const bytes = itensM1.get(item.arquivo);
            return bytes === undefined || sha256Hex(bytes) !== item.sha256;
          })
          .map((i) => i.arquivo);
        ok(`M1: mutacao de token acendeu o diff em ${String(nomes.length)} item(ns): ${nomes.slice(0, 3).join(", ")}…`);
      } else {
        falhou("M1", "mutacao de token NAO mudou nenhum item do golden — o golden e cego a tokens");
      }
    } catch (erro) {
      falhou(
        "M1",
        `producao mutada falhou (o erro COMPLETO segue para diagnostico):\n${(erro as Error).message}`,
      );
    } finally {
      writeFileSync(TOKENS, tokensOriginal);
      const restaurado = readFileSync(TOKENS);
      if (!restaurado.equals(tokensOriginal)) {
        falhou("M1", "tokens.ts NAO foi restaurado byte a byte apos a mutacao");
      } else {
        ok("M1: tokens.ts restaurado byte a byte");
      }
    }
  }

  // ── M2: mutacao de fonte tem de acender o diff ─────────────────────────
  process.stdout.write("=== M2: mutacao de fonte (Inter-Regular.woff2) TEM de acender o diff ===\n");
  const interOriginal = readFileSync(FONTE_INTER);
  const monoBytes = readFileSync(FONTE_MONO);
  if (sha256Hex(interOriginal) === sha256Hex(monoBytes)) {
    falhou("M2", "as duas fontes sao identicas — a mutacao nao faria diferenca (sonda invalida)");
  } else {
    writeFileSync(FONTE_INTER, monoBytes);
    const cacheM2 = join(temporario, "cache-m2");
    const saidaM2 = join(temporario, "saida-m2");
    try {
      await rodarProducao(saidaM2, cacheM2);
      const itensM2 = await extrairDa(saidaM2, indice.frames, totalFramesDoIndice);
      const divergiuM2 = indice.itens.some((item) => {
        const bytes = itensM2.get(item.arquivo);
        return bytes === undefined || sha256Hex(bytes) !== item.sha256;
      });
      if (divergiuM2) {
        const nomes = indice.itens
          .filter((item) => {
            const bytes = itensM2.get(item.arquivo);
            return bytes === undefined || sha256Hex(bytes) !== item.sha256;
          })
          .map((i) => i.arquivo);
        ok(`M2: mutacao de fonte acendeu o diff em ${String(nomes.length)} item(ns): ${nomes.slice(0, 3).join(", ")}…`);
      } else {
        falhou("M2", "mutacao de fonte NAO mudou nenhum item do golden — o golden e cego a fontes");
      }
    } catch (erro) {
      falhou(
        "M2",
        `producao mutada falhou (o erro COMPLETO segue para diagnostico):\n${(erro as Error).message}`,
      );
    } finally {
      writeFileSync(FONTE_INTER, interOriginal);
      const restaurado = readFileSync(FONTE_INTER);
      if (!restaurado.equals(interOriginal)) {
        falhou("M2", "Inter-Regular.woff2 NAO foi restaurado byte a byte apos a mutacao");
      } else {
        ok("M2: Inter-Regular.woff2 restaurado byte a byte");
      }
    }
  }

  await rm(temporario, { recursive: true, force: true }).catch(() => undefined);

  if (problemas.length > 0) {
    process.stdout.write(`=== gm-e2e: VERMELHO (${String(problemas.length)} falha(s)) ===\n`);
    return 1;
  }
  process.stdout.write("=== gm-e2e: VERDE — o golden master esta sustentado (2x identico, mutacoes acendem) ===\n");
  return 0;
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    process.stderr.write(`gm-e2e: ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}\n`);
    process.exit(2);
  },
);
