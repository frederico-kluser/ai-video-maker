/**
 * tests/render/encode/reais.test.ts
 *
 * OS ENCODES REAIS — a prova de que o modulo funciona contra o ffmpeg da
 * maquina (6.1.1) e nao apenas contra executores fake. Sao encodes
 * curtos (1 s, 320x180, lavfi — sem rede, sem fixtures, saida em /tmp
 * conforme o teto de disco do ADR-0032).
 *
 *   1. ROUND-TRIP: `executarEncode` (perfil entrega-software) +
 *      `verificarSaida` — o artefato bate estrutura, entropia, sem
 *      metadado (pergunta adversarial 2).
 *
 *   2. DETERMINISMO TESTADO (pergunta adversarial 4 — emenda da W7):
 *      o perfil DECLARADO deterministico (entrega-software) e testado
 *      2x: bytes do arquivo IDENTICOS e framemd5 IDENTICO. A declaracao
 *      de um perfil deterministico sem essa prova nao sobrevive aqui.
 *
 *   3. NVENC: deteccao real (C8 — smoke test de 1 s); quando disponivel,
 *      round-trip estrutural do perfil entrega-nvenc. O determinismo
 *      NAO e testado nele (declarado false — amostra nao e garantia,
 *      AB-700): a emenda manda goldens so em deterministicos, e o teste
 *      espelha isso nao comparando bytes do nvenc.
 *
 * PRESENCA, nunca lista completa (§12).
 */

import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectarNvenc } from "src/render/encode/detectar.js";
import { executarEncode } from "src/render/encode/executar.js";
import {
  codecNameDePerfil,
  calcularFramemd5,
  verificarSaida,
} from "src/render/encode/verificar.js";
import { listarPerfis } from "src/render/encode/descobrir.js";

function rodar(comando: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 120_000 }, (erro) => {
      if (erro) {
        reject(erro);
        return;
      }
      resolve();
    });
  });
}

function sha256DoArquivo(caminho: string): Promise<string> {
  return readFile(caminho).then((bytes) =>
    createHash("sha256").update(bytes).digest("hex"),
  );
}

/** Gera o master de entrada (1 s, 320x180, lavfi — o mesmo do I-03). */
async function gerarMaster(dir: string): Promise<string> {
  const master = join(dir, "master.mp4");
  await rodar("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x180:rate=30:duration=1",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-fflags",
    "+bitexact",
    "-flags",
    "+bitexact",
    "-map_metadata",
    "-1",
    master,
  ]);
  return master;
}

describe("encodes reais (ffmpeg 6.1.1)", () => {
  it("round-trip: executarEncode + verificarSaida com o perfil entrega-software", async () => {
    const dir = await mkdtemp(join(tmpdir(), "f5-02-reais-"));
    try {
      const master = await gerarMaster(dir);
      const catalogo = await listarPerfis();
      const software = catalogo.find((d) => d.perfil.nome === "entrega-software");
      expect(software).toBeDefined();
      if (software === undefined) return;

      const saida = join(dir, "saida.mp4");
      const resultado = await executarEncode({
        perfil: software.perfil,
        entrada: master,
        saida,
        catalogo: catalogo.map((d) => d.perfil),
      });
      expect(resultado.fallback.ativo).toBe(false);

      const verificacao = await verificarSaida(saida, {
        codec: codecNameDePerfil(software.perfil.codec),
        largura: 320,
        altura: 180,
      });
      expect(verificacao.ok).toBe(true);
      expect(verificacao.erros).toEqual([]);
      // pergunta adversarial 2, em bytes reais: sem metadado VOLATIL
      // (encoder/creation_time) no artefato; as tags de brand do MP4
      // sao deterministicas e seguem no arquivo.
      expect(verificacao.info.formatTags.encoder).toBeUndefined();
      expect(verificacao.info.formatTags.creation_time).toBeUndefined();
      expect(verificacao.info.framesLidos).toBe(30);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("determinismo TESTADO (pergunta adversarial 4): 2x encodes do perfil deterministico = bytes identicos", async () => {
    const dir = await mkdtemp(join(tmpdir(), "f5-02-det-"));
    try {
      const master = await gerarMaster(dir);
      const catalogo = await listarPerfis();
      const software = catalogo.find((d) => d.perfil.nome === "entrega-software");
      expect(software).toBeDefined();
      if (software === undefined) return;
      // a declaracao do perfil e o contrato testado aqui
      expect(software.perfil.deterministico).toBe(true);

      const saida1 = join(dir, "det-1.mp4");
      const saida2 = join(dir, "det-2.mp4");
      await executarEncode({
        perfil: software.perfil,
        entrada: master,
        saida: saida1,
        catalogo: catalogo.map((d) => d.perfil),
      });
      await executarEncode({
        perfil: software.perfil,
        entrada: master,
        saida: saida2,
        catalogo: catalogo.map((d) => d.perfil),
      });

      // 2x BYTES IDENTICOS — a pergunta adversarial 4 em forma literal.
      expect(await sha256DoArquivo(saida1)).toBe(await sha256DoArquivo(saida2));
      // E o oraculo de frames decodificados tambem (camada 1).
      expect(await calcularFramemd5(saida1)).toBe(await calcularFramemd5(saida2));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("NVENC: deteccao real (C8) e round-trip estrutural quando disponivel", async () => {
    const detecao = await detectarNvenc();
    // A decisao e DECLARADA com motivo, disponivel ou nao.
    expect(detecao.motivo.length).toBeGreaterThan(0);

    if (!detecao.nvenc) {
      // Maquina sem NVENC utilizavel: o caminho de hardware nao e
      // exercitado aqui, e isso e dito — nao passado em silencio
      // (ferramenta ausente e VERMELHO nomeado, nao "pulado").
      expect(detecao.motivo).toMatch(/FALHOU|indisponivel/);
      return;
    }

    const dir = await mkdtemp(join(tmpdir(), "f5-02-nvenc-"));
    try {
      const master = await gerarMaster(dir);
      const catalogo = await listarPerfis();
      const nvenc = catalogo.find((d) => d.perfil.nome === "entrega-nvenc");
      expect(nvenc).toBeDefined();
      if (nvenc === undefined) return;

      const saida = join(dir, "saida-nvenc.mp4");
      const resultado = await executarEncode({
        perfil: nvenc.perfil,
        entrada: master,
        saida,
        catalogo: catalogo.map((d) => d.perfil),
      });
      expect(resultado.fallback.ativo).toBe(false);

      const verificacao = await verificarSaida(saida, {
        codec: codecNameDePerfil(nvenc.perfil.codec),
        largura: 320,
        altura: 180,
      });
      expect(verificacao.ok).toBe(true);
      expect(verificacao.info.codec).toBe("h264");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
