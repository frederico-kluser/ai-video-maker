/**
 * tests/render/encode/executar.test.ts
 *
 * O EXECUTOR — o caminho completo consumido pelo pipeline (F5-01) e pelo
 * orquestrador (F5-07): escolha com fallback DECLARADO + fila explicita +
 * ffmpeg. Os executores sao injetados (nenhum ffmpeg real aqui — os
 * encodes reais vivem em `reais.test.ts`).
 *
 *   1. O resultado declara o fallback quando o NVENC esta indisponivel —
 *      e o fallback e logado (stderr) em voz alta, nunca silencioso
 *      (pergunta adversarial 3).
 *   2. A fila e respeitada: o slot do motor efetivo e adquirido e
 *      liberado; com a fila cheia o encode espera.
 *   3. O ffmpeg roda com o comando do construtor unico e o perfil
 *      EFETIVO (o de software, no fallback).
 *   4. Sem fallback: resultado.perfil == solicitado, fallback.ativo false.
 *   5. ffmpeg que falha lança — encode que nao sai nao devolve resultado.
 */

import { describe, expect, it } from "vitest";
import {
  executarEncode,
  perfilPrecisaDeDeteccao,
} from "src/render/encode/executar.js";
import { criarFilaDeEncode } from "src/render/encode/fila.js";
import type { ExecutorDeComando } from "src/render/encode/detectar.js";
import type { PerfilEncode } from "src/render/encode/formato.js";

function perfilSoftware(): PerfilEncode {
  return {
    nome: "teste-software",
    motor: "libx264",
    codec: "libx264",
    deterministico: true,
    justificativaDeterminismo: "teste",
    alvoQualidade: { tipo: "crf", valor: 18 },
    preset: "medium",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

function perfilHardware(): PerfilEncode {
  return {
    nome: "teste-hardware",
    motor: "nvenc",
    codec: "h264_nvenc",
    deterministico: false,
    justificativaDeterminismo: "teste",
    alvoQualidade: { tipo: "cq", valor: 23 },
    preset: "p5",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

function executorQueGrava(): ExecutorDeComando & {
  chamadas: { comando: string; args: string[] }[];
} {
  const chamadas: { comando: string; args: string[] }[] = [];
  const executor: ExecutorDeComando = async (comando, args) => {
    chamadas.push({ comando, args: [...args] });
    return { stdout: "", stderr: "" };
  };
  return Object.assign(executor, { chamadas });
}

describe("executarEncode — escolha + fila + ffmpeg, com fallback declarado", () => {
  it("sem fallback: resultado.perfil == solicitado e fallback.ativo false", async () => {
    const executor = executorQueGrava();
    const resultado = await executarEncode({
      perfil: perfilSoftware(),
      entrada: "/tmp/in.mp4",
      saida: "/tmp/out.mp4",
      executor,
      fila: criarFilaDeEncode({ nvenc: 4, libx264: 4 }),
      catalogo: [perfilSoftware()],
    });
    expect(resultado.perfil.nome).toBe("teste-software");
    expect(resultado.solicitado.nome).toBe("teste-software");
    expect(resultado.fallback.ativo).toBe(false);
    expect(resultado.duracaoMs).toBeGreaterThanOrEqual(0);
  });

  it("NVENC indisponivel: encoda com o software e DECLARA o fallback no resultado", async () => {
    const executor = executorQueGrava();
    const stderrOriginal = process.stderr.write;
    const stderrGravado: string[] = [];
    process.stderr.write = (chunk: string | Uint8Array) => {
      stderrGravado.push(String(chunk));
      return true;
    };
    try {
      const resultado = await executarEncode({
        perfil: perfilHardware(),
        entrada: "/tmp/in.mp4",
        saida: "/tmp/out.mp4",
        executor,
        fila: criarFilaDeEncode({ nvenc: 4, libx264: 4 }),
        catalogo: [perfilSoftware()],
        detectar: async () => ({ nvenc: false, motivo: "sonda falhou (teste)" }),
      });
      expect(resultado.perfil.nome).toBe("teste-software");
      expect(resultado.fallback.ativo).toBe(true);
      expect(resultado.fallback.solicitado).toBe("teste-hardware");
      // O fallback e logado em voz alta, nunca em log de debug.
      expect(stderrGravado.join("").includes("FALLBACK DECLARADO")).toBe(true);
      // O ffmpeg rodou com o perfil EFETIVO (o software).
      const linha = (executor.chamadas[0]?.args ?? []).join(" ");
      expect(linha).toContain("libx264");
      expect(linha).not.toContain("h264_nvenc");
    } finally {
      process.stderr.write = stderrOriginal;
    }
  });

  it("NVENC disponivel: sem fallback, ffmpeg roda com o perfil de hardware", async () => {
    const executor = executorQueGrava();
    const resultado = await executarEncode({
      perfil: perfilHardware(),
      entrada: "/tmp/in.mp4",
      saida: "/tmp/out.mp4",
      executor,
      fila: criarFilaDeEncode({ nvenc: 4, libx264: 4 }),
      catalogo: [perfilSoftware()],
      detectar: async () => ({ nvenc: true, motivo: "sonda passou (teste)" }),
    });
    expect(resultado.fallback.ativo).toBe(false);
    const linha = (executor.chamadas[0]?.args ?? []).join(" ");
    expect(linha).toContain("h264_nvenc");
  });

  it("a fila e respeitada: com o teto ocupado o encode espera e libera o slot", async () => {
    const executor = executorQueGrava();
    const fila = criarFilaDeEncode({ nvenc: 1, libx264: 4 });
    const ocupar = await fila.adquirir("nvenc");

    const promessa = executarEncode({
      perfil: perfilHardware(),
      entrada: "/tmp/in.mp4",
      saida: "/tmp/out.mp4",
      executor,
      fila,
      catalogo: [perfilSoftware()],
      detectar: async () => ({ nvenc: true, motivo: "ok" }),
    });
    let terminou = false;
    promessa.then(() => {
      terminou = true;
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(terminou).toBe(false); // bloqueado pela fila
    expect(fila.esperando("nvenc")).toBe(1);

    ocupar();
    const resultado = await promessa;
    expect(resultado.perfil.motor).toBe("nvenc");
    expect(fila.ocupados("nvenc")).toBe(0);
  });

  it("a deteccao so roda para perfis de hardware (sem smoke test a toa)", () => {
    expect(perfilPrecisaDeDeteccao(perfilHardware())).toBe(true);
    expect(perfilPrecisaDeDeteccao(perfilSoftware())).toBe(false);
  });

  it("ffmpeg que falha lanca — encode que nao sai nao devolve resultado", async () => {
    const executor: ExecutorDeComando = async () => {
      throw new Error("exit 1: encoder failed");
    };
    await expect(
      executarEncode({
        perfil: perfilSoftware(),
        entrada: "/tmp/in.mp4",
        saida: "/tmp/out.mp4",
        executor,
        fila: criarFilaDeEncode({ nvenc: 4, libx264: 4 }),
        catalogo: [],
      }),
    ).rejects.toThrow(/encoder failed/);
  });

  it("slot liberado mesmo quando o ffmpeg falha (finally)", async () => {
    const executor: ExecutorDeComando = async () => {
      throw new Error("falhou");
    };
    const fila = criarFilaDeEncode({ nvenc: 4, libx264: 1 });
    await expect(
      executarEncode({
        perfil: perfilSoftware(),
        entrada: "in",
        saida: "out",
        executor,
        fila,
        catalogo: [],
      }),
    ).rejects.toThrow();
    expect(fila.ocupados("libx264")).toBe(0);
  });
});
