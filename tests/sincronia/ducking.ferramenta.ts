#!/usr/bin/env npx tsx
/**
 * tests/sincronia/ducking.ferramenta.ts
 *
 * A FERRAMENTA DE CONFERENCIA DO ENVELOPE DE DUCKING — card F3-03 (W6).
 *
 * Mora em tests/ (nao em tools/) porque o mapa da onda da a este card
 * apenas `src/sincronia/ducking/**` e `tests/**`: e a ferramenta dos
 * testes do envelope, usada pelo gate `just ducking`. Nao e um teste
 * (`*.ferramenta.ts` nao casa o glob do vitest) — e executada por
 * `npx tsx`, como tools/timing/gerar.ts.
 *
 * Tres modos:
 *
 *   --conferir  (default) — (a) constroi o envelope a partir do timing
 *               canonico COMMITADO (fixtures/canonico/timing-canono.json,
 *               via lerTimingCanonico) e das posicoes da aritmetica da
 *               composicao (manifesto + calcularDuracao, o veredito do
 *               AB-520); (b) roda a sonda negativa do ∅-crit: qualquer
 *               palavra do timing SEM atenuacao faz exit 1; (c) compara
 *               byte a byte com o golden commitado
 *               (tests/fixtures/ducking-canono.json). Ausencia do golden
 *               e VERMELHO, sempre — nunca se auto-grava.
 *   --gravar    constroi e ESCREVE o golden. Ato explicito.
 *   --saida P   constroi e escreve em P (determinismo em dois processos).
 *
 * Por que o golden e commitado: o envelope e CALCULADO, e o contrato
 * (docs/contrato-w6.md §4) exige que a saida nao mude entre versoes. Um
 * golden byte a byte prova que o calculo nao mudou os bytes sem bump de
 * versao — a resposta escrita a pergunta adversarial (1) do card.
 */

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import { lerTimingCanonico } from "../../src/sincronia/timing/validar.js";
import {
  calcularEnvelopeDucking,
  coberturaDoEnvelope,
  posicoesDaTimeline,
} from "../../src/sincronia/ducking/calcular.js";
import { serializarEnvelopeDucking } from "../../src/sincronia/ducking/formato.js";

const TIMING_CANONICO = "fixtures/canonico/timing-canono.json";
const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const GOLDEN_DUCKING = "tests/fixtures/ducking-canono.json";

async function construir(): Promise<{ bytes: Buffer; descobertas: string[] }> {
  const timing = lerTimingCanonico(await readFile(TIMING_CANONICO, "utf-8"));
  const manifesto = JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
  const posicoes = posicoesDaTimeline(manifesto);
  const envelope = calcularEnvelopeDucking({ timing, posicoes });
  const descobertas = coberturaDoEnvelope(envelope, timing, posicoes);
  return { bytes: serializarEnvelopeDucking(envelope), descobertas };
}

/** ∅-crit + comparacao byte a byte; ausencia do golden e VERMELHO. */
async function conferir(): Promise<number> {
  console.log("=== ducking: conferir o golden do envelope ===");
  const { bytes, descobertas } = await construir();

  if (descobertas.length > 0) {
    console.log("");
    console.log(`VERMELHO: ${descobertas.length} palavra(s) com locucao SEM atenuacao:`);
    for (const d of descobertas) console.log(`  - ${d}`);
    console.log("");
    console.log("O ∅-crit do card: um trecho com locucao sem atenuacao e VERMELHO.");
    return 1;
  }
  console.log(`  ∅-crit: toda a locucao da fixture coberta (${bytes.length} bytes)`);

  let commitado: Buffer;
  try {
    commitado = await readFile(GOLDEN_DUCKING);
  } catch {
    console.log("");
    console.log(`VERMELHO: ${GOLDEN_DUCKING} ausente.`);
    console.log("O golden nao se auto-grava: rode `just ducking-gravar`.");
    return 1;
  }

  if (commitado.equals(bytes)) {
    console.log(`  ${GOLDEN_DUCKING}: bytes identicos (${bytes.length} bytes)`);
    console.log("");
    console.log("=== VERDE: envelope de ducking sustentado (calculado, 2x deterministico) ===");
    return 0;
  }

  const atual = JSON.parse(bytes.toString("utf-8")) as {
    intervalos?: Array<{ inicio_s?: number; fim_s?: number }>;
  };
  const gravado = JSON.parse(commitado.toString("utf-8")) as {
    intervalos?: Array<{ inicio_s?: number; fim_s?: number }>;
  };
  console.log(`VERMELHO: ${GOLDEN_DUCKING} divergiu do calculado.`);
  console.log(`  intervalos do golden: ${JSON.stringify(gravado.intervalos ?? [])}`);
  console.log(`  intervalos do atual:  ${JSON.stringify(atual.intervalos ?? [])}`);
  console.log(
    "  Se a mudanca e intencional (bump de versao, parametros), rode --gravar e revise o diff.",
  );
  return 1;
}

async function gravar(): Promise<number> {
  console.log("=== ducking: gravacao do golden ===");
  const { bytes, descobertas } = await construir();
  if (descobertas.length > 0) {
    console.log(`VERMELHO: nao se grava golden com locucao descoberta (${descobertas.length})`);
    for (const d of descobertas) console.log(`  - ${d}`);
    return 1;
  }
  await writeFile(GOLDEN_DUCKING, bytes, "utf-8");
  console.log(`  ${GOLDEN_DUCKING}: ${bytes.length} bytes gravados`);
  console.log("");
  console.log("=== VERDE: golden gravado ===");
  return 0;
}

async function saida(caminho: string): Promise<number> {
  const { bytes, descobertas } = await construir();
  if (descobertas.length > 0) {
    console.log(`VERMELHO: locucao descoberta (${descobertas.length})`);
    for (const d of descobertas) console.log(`  - ${d}`);
    return 1;
  }
  await writeFile(caminho, bytes, "utf-8");
  return 0;
}

async function main(): Promise<number> {
  const argumentos = process.argv.slice(2);
  const indiceSaida = argumentos.indexOf("--saida");
  if (indiceSaida >= 0) {
    const caminho = argumentos[indiceSaida + 1];
    if (caminho === undefined) {
      console.error("uso: ducking.ferramenta.ts --saida <caminho>");
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
      console.error("tests/sincronia/ducking.ferramenta.ts: erro inesperado:", erro);
      process.exit(2);
    },
  );
}
