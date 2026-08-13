#!/usr/bin/env npx tsx
/**
 * tools/timing/gerar.ts
 *
 * GERA O TIMING CANONICO a partir do manifesto canonico e do cassete de
 * locucao COMMITADO (replay offline — ver src/resolucao/locucao/replay.ts).
 *
 * Tres modos:
 *
 *   --conferir  (default) constroi e compara byte a byte com
 *               `fixtures/canonico/timing-canono.json`. Ausencia e
 *               VERMELHO, sempre — nunca grava sozinho (mesma disciplina
 *               do `tools/transicoes/provar.sh`: aprovar e ato explicito).
 *   --gravar    constroi e ESCREVE a fixture commitada. Ato explicito.
 *   --saida P   constroi e escreve em P (usado pelo determinismo, que
 *               roda isto em dois processos separados).
 *
 * Por que o timing canonico e uma fixture commitada: o documento e a base
 * dos tres consumidores da W6 (F3-02/03/04) e do oraculo. Um golden byte
 * a byte prova que o construtor nao mudou os bytes sem bump de versao —
 * e o determinismo so faz sentido contra uma base fixa.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import type { ParcialResolvido, Sha256 } from "../../src/resolucao/manifesto-resolvido.js";
import { reproduzirLocucao } from "../../src/resolucao/locucao/replay.js";
import type { UnidadeReproduzida } from "../../src/resolucao/locucao/replay.js";
import {
  construirTimingCanonico,
} from "../../src/sincronia/timing/construir.js";
import { serializarTimingCanonico } from "../../src/sincronia/timing/formato.js";

const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const FIXTURE_TIMING = "fixtures/canonico/timing-canono.json";

async function lerManifesto(): Promise<Manifesto> {
  return JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
}

/**
 * Monta a parcial a partir do `resultado.json` do cassete e um carregador
 * que serve os bytes do REPLAY (audio e timing) — nunca do store: os
 * bytes dos assets nao estao no store (AB-411), e o replay e a prova de
 * que os bytes batem.
 */
async function parcialDoCassete(
  manifesto: Manifesto,
): Promise<{
  parcial: Pick<ParcialResolvido, "assets" | "nos_locucao">;
  carregar: (hash: Sha256) => Buffer | null;
}> {
  const reprod = await reproduzirLocucao(manifesto);
  const gravado = JSON.parse(
    await readFile(join(reprod.diretorio, "resultado.json"), "utf-8"),
  ) as { assets: Record<string, unknown>; nos_locucao: Record<string, string> };

  const porHash = new Map<string, UnidadeReproduzida>();
  for (const u of reprod.unidades) {
    porHash.set(u.hashTiming, u);
    porHash.set(u.hashAudio, u);
  }

  return {
    parcial: {
      assets: gravado.assets as ParcialResolvido["assets"],
      nos_locucao: gravado.nos_locucao,
    },
    carregar: (hash) => {
      const u = porHash.get(hash);
      if (u === undefined) return null;
      return hash === u.hashTiming ? u.bytesTiming : u.audio;
    },
  };
}

async function construir(): Promise<Buffer> {
  const manifesto = await lerManifesto();
  const { parcial, carregar } = await parcialDoCassete(manifesto);
  const documento = await construirTimingCanonico({
    manifesto,
    parcial,
    carregar,
  });
  return serializarTimingCanonico(documento);
}

/** Compara byte a byte; ausencia da fixture e VERMELHO. */
async function conferir(): Promise<number> {
  console.log("=== timing-testar: conferir o golden do timing canonico ===");
  const bytes = await construir();

  let commitado: Buffer;
  try {
    commitado = await readFile(FIXTURE_TIMING);
  } catch {
    console.log("");
    console.log(`VERMELHO: ${FIXTURE_TIMING} ausente.`);
    console.log("O golden nao se auto-grava: rode `npx tsx tools/timing/gerar.ts --gravar`.");
    return 1;
  }

  if (commitado.equals(bytes)) {
    console.log(`  ${FIXTURE_TIMING}: bytes identicos (${bytes.length} bytes)`);
    console.log("");
    console.log("=== VERDE: golden do timing canonico sustentado ===");
    return 0;
  }

  // Diff legivel: mostra as chaves de cena de cada lado.
  const atual = JSON.parse(bytes.toString("utf-8")) as {
    cenas?: Record<string, unknown>;
  };
  const gravado = JSON.parse(commitado.toString("utf-8")) as {
    cenas?: Record<string, unknown>;
  };
  console.log(`VERMELHO: ${FIXTURE_TIMING} divergiu do construido.`);
  console.log(`  cenas do golden:  ${Object.keys(gravado.cenas ?? {}).join(", ")}`);
  console.log(`  cenas do atual:   ${Object.keys(atual.cenas ?? {}).join(", ")}`);
  console.log(
    "  Se a mudanca e intencional, bumpe a versao do formato e rode --gravar.",
  );
  return 1;
}

async function gravar(): Promise<number> {
  console.log("=== timing: gravacao da fixture canonica ===");
  const bytes = await construir();
  await writeFile(FIXTURE_TIMING, bytes, "utf-8");
  console.log(`  ${FIXTURE_TIMING}: ${bytes.length} bytes gravados`);
  console.log("");
  console.log("=== VERDE: fixture gravada ===");
  return 0;
}

async function saida(caminho: string): Promise<number> {
  const bytes = await construir();
  await writeFile(caminho, bytes, "utf-8");
  return 0;
}

async function main(): Promise<number> {
  const argumentos = process.argv.slice(2);
  const indiceSaida = argumentos.indexOf("--saida");
  if (indiceSaida >= 0) {
    const caminho = argumentos[indiceSaida + 1];
    if (caminho === undefined) {
      console.error("uso: gerar.ts --saida <caminho>");
      return 2;
    }
    return saida(caminho);
  }
  if (argumentos.includes("--gravar")) return gravar();
  return conferir();
}

const executadoDireto =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  main().then(
    (codigo) => process.exit(codigo),
    (erro: unknown) => {
      console.error("tools/timing/gerar.ts: erro inesperado:", erro);
      process.exit(2);
    },
  );
}
