#!/usr/bin/env npx tsx
/**
 * tools/legendas/gerar.ts
 *
 * GERA AS LEGENDAS CANONICAS a partir do manifesto canonico e do timing
 * canonico COMMITADO (golden de F3-01, que por sua vez vence do replay
 * do cassete de locucao — AB-523).
 *
 * Tres modos:
 *
 *   --conferir  (default) constroi e compara byte a byte com
 *               `fixtures/canonico/legendas-canono.json`. Ausencia e
 *               VERMELHO, sempre — nunca grava sozinho.
 *   --gravar    constroi e ESCREVE a fixture commitada. Ato explicito.
 *   --saida P   constroi e escreve em P (usado pelo determinismo, se
 *               algum dia este documento entrar na camada 1).
 *
 * Por que o golden e commitado: o documento e a base do consumidor de
 * pos (F5-03, W8) e do oraculo. Um golden byte a byte prova que o
 * construtor nao mudou os bytes sem bump de versao do formato.
 */

import { readFile, writeFile } from "node:fs/promises";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import type { TimingCanonico } from "../../src/sincronia/timing/formato.js";
import { lerTimingCanonico } from "../../src/sincronia/timing/validar.js";
import { construirLegendas } from "../../src/sincronia/legendas/construir.js";
import { serializarLegendas } from "../../src/sincronia/legendas/formato.js";

const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const FIXTURE_LEGENDAS = "fixtures/canonico/legendas-canono.json";

async function construir(): Promise<Buffer> {
  const manifesto = JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
  const bytesTiming = await readFile("fixtures/canonico/timing-canono.json");
  // Entrada unica do contrato: os bytes passam pelo oraculo de F3-01.
  const timing: TimingCanonico = lerTimingCanonico(bytesTiming);
  const doc = construirLegendas(manifesto, timing);
  return serializarLegendas(doc);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const modoGravar = args.includes("--gravar");
  const indiceSaida = args.indexOf("--saida");
  const caminhoSaida =
    indiceSaida >= 0 ? (args[indiceSaida + 1] ?? "") : "";

  const bytes = await construir();

  if (caminhoSaida !== "") {
    await writeFile(caminhoSaida, bytes);
    console.log(`legendas: escrita em ${caminhoSaida}`);
    return;
  }

  let golden: Buffer | null = null;
  try {
    golden = await readFile(FIXTURE_LEGENDAS);
  } catch {
    golden = null;
  }

  if (modoGravar) {
    await writeFile(FIXTURE_LEGENDAS, bytes);
    console.log(`legendas: golden gravado em ${FIXTURE_LEGENDAS}`);
    return;
  }

  if (golden === null) {
    console.error(
      `FALHOU: ${FIXTURE_LEGENDAS} ausente — o golden e obrigatorio ` +
        "(ausencia e VERMELHO, nunca se auto-grava). Rode `--gravar` como " +
        "ato explicito e revise o diff.",
    );
    process.exit(1);
  }

  if (!bytes.equals(golden)) {
    console.error("FALHOU: as legendas construidas divergem do golden commitado.");
    console.error(`  esperado (golden): ${golden.length} bytes`);
    console.error(`  construido:        ${bytes.length} bytes`);
    console.error(
      "Rode `just legendas-gravar`, revise o diff e decida: regressao ou " +
        "mudanca intencional (ato explicito).",
    );
    process.exit(1);
  }
  console.log("legendas: conferido contra o golden (bytes identicos).");
}

main().catch((erro: unknown) => {
  console.error(erro);
  process.exit(1);
});
