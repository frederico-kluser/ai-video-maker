/**
 * tools/store-check
 *
 * Verifica a integridade do store enderecado por conteudo.
 * Recomputa SHA-256 de cada asset e compara com o nome do arquivo.
 *
 * Uso:
 *   tools/store-check [--root .cache/store] [--fix]
 *
 * Opcoes:
 *   --root <path>   Raiz do store (default: .cache/store)
 *   --fix           Remove assets corrompidos
 *   --verbose       Mostra cada asset verificado
 *   --json          Saida em JSON
 *
 * Exit codes:
 *   0 — Todos os assets integros
 *   1 — Assets corrompidos encontrados
 *   2 — Erro de execucao
 */

import { createHash } from "node:crypto";
import { readdir, readFile, unlink, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

// ─── CLI ────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const rootArg = args.indexOf("--root");
const root = rootArg >= 0 ? args[rootArg + 1] ?? ".cache/store" : ".cache/store";
const fix = args.includes("--fix");
const verbose = args.includes("--verbose");
const json = args.includes("--json");

const storeRoot = resolve(root);
const HASH_PREFIX_LENGTH = 2;

interface AssetStatus {
  hash: string;
  path: string;
  ok: boolean;
  error?: string;
  sizeBytes?: number;
}

async function main(): Promise<void> {
  const results: AssetStatus[] = [];
  let total = 0;
  let ok = 0;
  let corrupted = 0;
  let missing = 0;

  try {
    const prefixDirs = await readdir(storeRoot, { withFileTypes: true });

    for (const entry of prefixDirs) {
      if (!entry.isDirectory()) continue;
      if (entry.name.length !== HASH_PREFIX_LENGTH) continue;

      const files = await readdir(join(storeRoot, entry.name), {
        withFileTypes: true,
      });

      for (const file of files) {
        if (!file.isFile()) continue;
        // Arquivos de conteudo: nome e o hash completo (64 chars hex)
        if (!/^[0-9a-f]{64}$/.test(file.name)) continue;

        total++;
        const filePath = join(storeRoot, entry.name, file.name);
        const hash = file.name;
        const status: AssetStatus = { hash, path: filePath, ok: false };

        try {
          const content = await readFile(filePath);
          const actualHash = createHash("sha256")
            .update(content)
            .digest("hex");
          const fileInfo = await stat(filePath);
          status.sizeBytes = fileInfo.size;

          if (actualHash === hash) {
            status.ok = true;
            ok++;
          } else {
            status.error = `Hash mismatch: expected ${hash}, got ${actualHash}`;
            corrupted++;
            if (fix) {
              await unlink(filePath);
              // Remove procedencia tambem
              const procPath = filePath + ".procedencia.json";
              try {
                await unlink(procPath);
              } catch {
                // procedencia pode nao existir
              }
              if (verbose) console.error(`Removed corrupted: ${filePath}`);
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          status.error = `Read error: ${msg}`;
          missing++;
        }

        results.push(status);

        if (verbose && !json) {
          const icon = status.ok ? "OK" : "FAIL";
          console.error(`${icon}  ${hash}  (${status.sizeBytes ?? "?"} bytes)`);
          if (status.error) console.error(`     ${status.error}`);
        }
      }
    }
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      // Store nao existe — integro por vacuidade
      if (!json) console.log("Store vazio — integro.");
      process.exit(0);
    }
    console.error(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }

  if (json) {
    console.log(
      JSON.stringify(
        { total, ok, corrupted, missing, results },
        null,
        2,
      ),
    );
  } else {
    console.log(`\nTotal: ${total}  OK: ${ok}  Corrompidos: ${corrupted}  Ausentes: ${missing}`);
    if (corrupted > 0 || missing > 0) {
      console.log("FALHOU — assets com problema encontrados.");
      if (!fix) console.log("Use --fix para remover assets corrompidos.");
    } else {
      console.log("PASSOU — todos os assets integros.");
    }
  }

  process.exit(corrupted > 0 || missing > 0 ? 1 : 0);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}

main();
