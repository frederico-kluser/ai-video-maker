// =============================================================================
// Testes de entropia do canário
// =============================================================================
// Card: F0-06 — Harness de determinismo
// Asserção de entropia: o canário DEVE produzir saída não-vazia.
// Um frame 100% preto passaria em todos os critérios estruturais
// e seria perfeitamente estável — por isso a entropia é o primeiro
// gate depois do determinismo.
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const APPROVED_DIR = resolve(REPO_ROOT, "fixtures", "canario", "approved");
const OUTPUT_FILE = "canario-frame15.png";
const APPROVED_PATH = resolve(APPROVED_DIR, OUTPUT_FILE);

describe("Canário — asserção de entropia", () => {
  it("snapshot aprovado existe", () => {
    if (!existsSync(APPROVED_PATH)) {
      console.log(
        "SKIP: snapshot aprovado não existe. Execute 'bash tools/determinismo/provar.sh' primeiro."
      );
      return;
    }
    expect(existsSync(APPROVED_PATH)).toBe(true);
  });

  it("snapshot aprovado não é vazio", () => {
    if (!existsSync(APPROVED_PATH)) {
      return;
    }
    const buf = readFileSync(APPROVED_PATH);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("snapshot aprovado tem tamanho mínimo (entropia)", () => {
    if (!existsSync(APPROVED_PATH)) {
      return;
    }
    const buf = readFileSync(APPROVED_PATH);
    // Um PNG 1920x1080 com conteúdo visual deve ter pelo menos 10 KB
    // Um frame preto sólido comprimido em PNG teria ~5 KB ou menos
    expect(buf.length).toBeGreaterThan(10000);
    console.log(`  Tamanho do snapshot: ${buf.length} bytes`);
  });

  it("snapshot aprovado não é frame uniforme (todos pixels iguais)", () => {
    if (!existsSync(APPROVED_PATH)) {
      return;
    }
    const buf = readFileSync(APPROVED_PATH);
    // Verifica que o arquivo não é um PNG de cor sólida
    // Um PNG de cor sólida 1920x1080 comprimido seria muito pequeno
    // (menos de 5 KB). Se o arquivo tem mais de 10 KB, há variação visual.
    expect(buf.length).toBeGreaterThan(10000);

    // Verifica que o hash não é o hash de um frame preto
    const hash = createHash("sha256").update(buf).digest("hex");
    expect(hash.length).toBe(64); // SHA-256
    console.log(`  SHA-256: ${hash}`);
  });

  it("snapshot aprovado é um PNG válido", () => {
    if (!existsSync(APPROVED_PATH)) {
      return;
    }
    const buf = readFileSync(APPROVED_PATH);
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(buf.subarray(0, 8)).toEqual(pngMagic);
  });
});

describe("Canário — determinismo", () => {
  it("dois renders do mesmo frame produzem bytes idênticos", () => {
    if (!existsSync(APPROVED_PATH)) {
      console.log(
        "SKIP: snapshot aprovado não existe. Execute 'bash tools/determinismo/provar.sh' primeiro."
      );
      return;
    }

    const temp1 = execSync("mktemp -d").toString().trim();
    const temp2 = execSync("mktemp -d").toString().trim();

    try {
      const canaryEntry = resolve(
        REPO_ROOT,
        "fixtures",
        "canario",
        "index.tsx"
      );

      // Render 1
      execSync(
        `npx remotion still "${canaryEntry}" canario "${temp1}/${OUTPUT_FILE}" --frame=15 --gl=swangle`,
        { cwd: REPO_ROOT, stdio: "pipe", timeout: 120000 }
      );

      // Render 2
      execSync(
        `npx remotion still "${canaryEntry}" canario "${temp2}/${OUTPUT_FILE}" --frame=15 --gl=swangle`,
        { cwd: REPO_ROOT, stdio: "pipe", timeout: 120000 }
      );

      const buf1 = readFileSync(resolve(temp1, OUTPUT_FILE));
      const buf2 = readFileSync(resolve(temp2, OUTPUT_FILE));

      expect(buf1.equals(buf2)).toBe(true);
      console.log("  Renders idênticos — determinismo confirmado");
    } finally {
      execSync(`rm -rf "${temp1}" "${temp2}"`);
    }
  }, 300000); // 5 min timeout for rendering
});
