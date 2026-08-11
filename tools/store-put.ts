/**
 * tools/store-put
 *
 * Armazena um arquivo no store enderecado por conteudo.
 *
 * Uso:
 *   tools/store-put <arquivo> [--label <nome>] [--license <licenca>] [--source <fonte>]
 *
 * Opcoes:
 *   --label <nome>       Nome descritivo do asset
 *   --license <licenca>  Licenca do asset (default: "unknown")
 *   --source <fonte>     Fonte do asset (default: "manual")
 *   --url <url>          URL de origem do asset
 *   --root <path>        Raiz do store (default: .cache/store)
 *   --json               Saida em JSON
 *
 * Exit codes:
 *   0 — Asset armazenado com sucesso
 *   1 — Erro de argumentos
 *   2 — Erro de IO
 */

import { readFile, stat } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { Store } from "../src/store/store.js";
import type { Procedencia, ProvedorAsset } from "../src/store/procedencia.js";

// ─── CLI ────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(`store-put — Armazena um arquivo no store enderecado por conteudo.

Uso:
  tools/store-put <arquivo> [opcoes]

Opcoes:
  --label <nome>       Nome descritivo do asset
  --license <licenca>  Licenca do asset (default: "unknown")
  --source <fonte>     Fonte: giphy, tenor, pexels, pixabay, openverse,
                       remotion-animated-emoji, local, manual, unknown
                       (default: "manual")
  --url <url>          URL de origem do asset
  --root <path>        Raiz do store (default: .cache/store)
  --json               Saida em JSON

Exit codes:
  0 — Asset armazenado
  1 — Erro de argumentos
  2 — Erro de IO`);
  process.exit(0);
}

const filePath = resolve(args[0]!);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const label = getArg("--label") ?? basename(filePath);
const license = getArg("--license") ?? "unknown";
const source = (getArg("--source") ?? "manual") as ProvedorAsset;
const url = getArg("--url");
const root = getArg("--root") ?? ".cache/store";
const json = args.includes("--json");

const validSources = new Set([
  "giphy", "tenor", "pexels", "pixabay", "openverse",
  "remotion-animated-emoji", "local", "manual", "unknown",
]);

if (!validSources.has(source)) {
  console.error(`Erro: fonte invalida "${source}". Validas: ${[...validSources].join(", ")}`);
  process.exit(1);
}

async function main(): Promise<void> {
  let content: Buffer;
  let fileInfo: { size: number };

  try {
    content = await readFile(filePath);
    fileInfo = await stat(filePath);
  } catch (err: unknown) {
    console.error(
      `Erro ao ler arquivo: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(2);
  }

  const hash = createHash("sha256").update(content).digest("hex");

  const procedencia: Procedencia = {
    license,
    attributionRequired: false,
    attribution: label,
    source,
    fetchedFrom: url,
    acquiredAt: new Date().toISOString(),
    mimeType: guessMimeType(filePath),
    byteSize: fileInfo.size,
  };

  const store = new Store({ root });

  const result = await store.put(content, procedencia);

  if (json) {
    console.log(JSON.stringify({
      hash: result.hash,
      path: result.path,
      procedenciaPath: result.procedenciaPath,
      size: fileInfo.size,
      label,
      license,
      source,
    }, null, 2));
  } else {
    console.log(`Hash:     ${result.hash}`);
    console.log(`Caminho:  ${result.path}`);
    console.log(`Licenca:  ${license}`);
    console.log(`Fonte:    ${source}`);
    console.log(`Tamanho:  ${fileInfo.size} bytes`);
    if (url) console.log(`URL:      ${url}`);
  }
}

function guessMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    json: "application/json",
    txt: "text/plain",
  };
  return mimeMap[ext ?? ""] ?? "application/octet-stream";
}

main();
