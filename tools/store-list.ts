/**
 * tools/store-list
 *
 * Lista o conteudo do store enderecado por conteudo.
 *
 * Uso:
 *   tools/store-list [--root .cache/store] [--json] [--verbose]
 *
 * Opcoes:
 *   --root <path>   Raiz do store (default: .cache/store)
 *   --json          Saida em JSON com metadados
 *   --verbose       Mostra procedencia de cada asset
 *   --count         Apenas mostra a contagem
 *
 * Exit codes:
 *   0 — Sucesso
 *   2 — Erro de execucao
 */

import { stat } from "node:fs/promises";
import { Store } from "../src/store/store.js";

// ─── CLI ────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const rootArg = args.indexOf("--root");
const root = rootArg >= 0 ? args[rootArg + 1] ?? ".cache/store" : ".cache/store";
const json = args.includes("--json");
const verbose = args.includes("--verbose");
const countOnly = args.includes("--count");

const store = new Store({ root });

async function main(): Promise<void> {
  const hashes = await store.list();

  if (countOnly) {
    console.log(String(hashes.length));
    return;
  }

  if (json) {
    const assets = [];
    for (const hash of hashes) {
      const proc = await store.getProcedencia(hash);
      const filePath = store.hashPath(hash);
      let size = 0;
      try {
        const info = await stat(filePath);
        size = info.size;
      } catch { /* ignore */ }
      assets.push({ hash, size, procedencia: proc });
    }
    console.log(JSON.stringify({ total: hashes.length, assets }, null, 2));
    return;
  }

  if (hashes.length === 0) {
    console.log("Store vazio.");
    return;
  }

  console.log(`Store: ${store.root}`);
  console.log(`Total de assets: ${hashes.length}\n`);

  for (const hash of hashes) {
    const filePath = store.hashPath(hash);
    let size = 0;
    try {
      const info = await stat(filePath);
      size = info.size;
    } catch { /* ignore */ }

    const proc = await store.getProcedencia(hash);

    if (verbose && proc) {
      console.log(`${hash}`);
      console.log(`  Tamanho:  ${size} bytes`);
      console.log(`  Licenca:  ${proc.license}`);
      console.log(`  Fonte:    ${proc.source}`);
      if (proc.sourceId) console.log(`  SourceID: ${proc.sourceId}`);
      if (proc.fetchedFrom) console.log(`  URL:      ${proc.fetchedFrom}`);
      if (proc.attribution) console.log(`  Attrib:   ${proc.attribution}`);
      console.log();
    } else {
      const lic = proc?.license ?? "?";
      console.log(`${hash}  ${String(size).padStart(8)} bytes  ${lic}`);
    }
  }
}

main().catch((err: unknown) => {
  console.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
