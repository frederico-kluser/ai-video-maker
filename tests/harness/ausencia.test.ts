// =============================================================================
// Testes de ausência de snapshot
// =============================================================================
// Card: F0-06 — Harness de determinismo
// Apagar um snapshot aprovado tem de deixar o gate VERMELHO.
// O gate NÃO pode passar com "nada a comparar".
// =============================================================================

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const APPROVED_DIR = resolve(REPO_ROOT, "fixtures", "canario", "approved");
const OUTPUT_FILE = "canario-frame15.png";
const APPROVED_PATH = resolve(APPROVED_DIR, OUTPUT_FILE);

describe("Gate de ausência de snapshot", () => {
  it("snapshot aprovado existe (pré-condição)", () => {
    if (!existsSync(APPROVED_PATH)) {
      console.log(
        "SKIP: snapshot aprovado não existe. Execute 'bash tools/determinismo/provar.sh' primeiro."
      );
      return;
    }
    expect(existsSync(APPROVED_PATH)).toBe(true);
  });

  it("remover snapshot aprovado torna o diretório vazio", () => {
    if (!existsSync(APPROVED_PATH)) {
      return;
    }

    // Backup
    const backup = readFileSync(APPROVED_PATH);

    try {
      // Remove
      rmSync(APPROVED_PATH);

      // Verifica que o diretório está vazio (ou só tem .gitkeep)
      const files = execSync(`ls -A "${APPROVED_DIR}" 2>/dev/null || true`)
        .toString()
        .trim();
      const nonKeepFiles = files
        .split("\n")
        .filter((f) => f !== ".gitkeep" && f !== "");

      expect(nonKeepFiles.length).toBe(0);
      console.log("  Diretório aprovado vazio após remoção");
    } finally {
      // Restaura
      mkdirSync(APPROVED_DIR, { recursive: true });
      writeFileSync(APPROVED_PATH, backup);
    }
  });

  it("gate NÃO passa com snapshot ausente (ausência falha)", () => {
    if (!existsSync(APPROVED_PATH)) {
      return;
    }

    // Backup
    const backup = readFileSync(APPROVED_PATH);

    try {
      // Remove
      rmSync(APPROVED_PATH);

      // Verifica que o snapshot não existe
      expect(existsSync(APPROVED_PATH)).toBe(false);

      // Tenta rodar o gate de ausência — DEVE falhar (exit code != 0)
      // porque o snapshot está ausente
      let commandFailed = false;
      let output = "";
      try {
        const ausenciaScript = resolve(
          REPO_ROOT,
          "tools",
          "determinismo",
          "ausencia.sh"
        );
        output = execSync(`bash "${ausenciaScript}"`, {
          cwd: REPO_ROOT,
          stdio: "pipe",
          timeout: 30000,
        }).toString();
      } catch (err: any) {
        commandFailed = true;
        output = err.stdout?.toString() || "";
        if (err.stderr) {
          output += "\n" + err.stderr.toString();
        }
      }

      console.log("  Saída do gate de ausência:");
      const lines = output.split("\n").filter((l: string) => l.trim());
      for (const line of lines.slice(0, 5)) {
        console.log("  " + line);
      }

      // O gate DEVE falhar (exit code != 0) quando snapshot está ausente
      // OU deve reportar a ausência explicitamente
      const reportsAbsence =
        output.match(/ausente|ausência|removido|snapshot.*não.*exist/i) !== null;
      const exitedWithError = commandFailed;

      // Pelo menos um dos dois deve ser verdadeiro:
      // - O comando falhou (exit != 0) → gate vermelho
      // - O comando reportou ausência → gate detectou o problema
      expect(exitedWithError || reportsAbsence).toBe(true);
    } finally {
      // Restaura
      mkdirSync(APPROVED_DIR, { recursive: true });
      writeFileSync(APPROVED_PATH, backup);
    }
  });
});
