/**
 * tests/render/encode/detectar.test.ts
 *
 * A DETECCAO DE NVENC — C8 das "12 ferramentas que mentem": `nvidia-smi`
 * presente != encoder disponivel para o processo. A sonda e um encode
 * REAL de 1 segundo com h264_nvenc; qualquer falha do smoke test produz
 * `nvenc: false` com motivo DECLARADO.
 *
 *   1. O executor fake que falha -> nvenc:false com motivo (nunca
 *      excecao para fora — a indisponibilidade e um resultado).
 *   2. O executor fake que passa -> nvenc:true.
 *   3. A sonda chama ffmpeg com o encode de 1 s (nunca nvidia-smi) — o
 *      teste asserta O COMANDO, nao o resultado: presenca de driver nao
 *      entra no caminho de deteccao.
 *   4. O diretorio temporario e limpo ao fim (mesmo em falha).
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectarNvenc,
  SMOKE_TEST_ARGS,
  type ExecutorDeComando,
} from "src/render/encode/detectar.js";

function executorQueResolve(stdout = ""): ExecutorDeComando & {
  chamadas: { comando: string; args: string[] }[];
} {
  const chamadas: { comando: string; args: string[] }[] = [];
  const executor: ExecutorDeComando = async (comando, args) => {
    chamadas.push({ comando, args: [...args] });
    return { stdout, stderr: "" };
  };
  return Object.assign(executor, { chamadas });
}

function executorQueFalha(mensagem: string): ExecutorDeComando & {
  chamadas: { comando: string; args: string[] }[];
} {
  const chamadas: { comando: string; args: string[] }[] = [];
  const executor: ExecutorDeComando = async (comando, args) => {
    chamadas.push({ comando, args: [...args] });
    throw new Error(mensagem);
  };
  return Object.assign(executor, { chamadas });
}

describe("detectarNvenc — prova por encode de 1 s (C8)", () => {
  it("devolve nvenc:true quando o smoke test de 1 s inicializa (exit 0)", async () => {
    const executor = executorQueResolve();
    const resultado = await detectarNvenc({ executor, dirTemporario: tmpdir() });
    expect(resultado.nvenc).toBe(true);
    expect(resultado.motivo.length).toBeGreaterThan(0);
  });

  it("devolve nvenc:false com motivo declarado quando o encode falha", async () => {
    const executor = executorQueFalha("CUDA error: no available encoder");
    const resultado = await detectarNvenc({ executor, dirTemporario: tmpdir() });
    expect(resultado.nvenc).toBe(false);
    expect(resultado.motivo).toMatch(/FALHOU/);
    expect(resultado.motivo).toMatch(/CUDA error/);
  });

  it("NUNCA consulta nvidia-smi — a sonda e o encode de 1 s (C8)", async () => {
    const executor = executorQueFalha("nada");
    await detectarNvenc({ executor, dirTemporario: tmpdir() });
    const comandos = executor.chamadas.map((c) => c.comando);
    expect(comandos).toContain("ffmpeg");
    for (const chamada of executor.chamadas) {
      expect(chamada.comando).not.toBe("nvidia-smi");
      expect(chamada.args.join(" ")).not.toMatch(/nvidia-smi/);
    }
  });

  it("a sonda e o smoke test de 1 s com h264_nvenc (mesma metodologia do I-03)", async () => {
    const executor = executorQueResolve();
    await detectarNvenc({ executor, dirTemporario: tmpdir() });
    const args = executor.chamadas[0]?.args ?? [];
    const linha = args.join(" ");
    expect(linha).toContain("h264_nvenc");
    expect(linha).toContain("testsrc2");
    expect(linha).toContain("duration=1");
    // O SMOKE_TEST_ARGS exportado e exatamente o que roda.
    expect(args.slice(0, SMOKE_TEST_ARGS.length)).toEqual([...SMOKE_TEST_ARGS]);
  });

  it("limpa o diretorio temporario mesmo quando o encode falha", async () => {
    const base = mkdtempSync(join(tmpdir(), "f5-02-detectar-base-"));
    const executor = executorQueFalha("falhou");
    await detectarNvenc({ executor, dirTemporario: base });
    expect(readdirSync(base).length).toBe(0);
    expect(statSync(base).isDirectory()).toBe(true);
  });
});
