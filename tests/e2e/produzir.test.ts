/**
 * tests/e2e/produzir.test.ts
 *
 * A suite de CONTRATO do orquestrador de ponta a ponta — card F5-07
 * (W9). Roda sem navegador e sem render (o render e do gate
 * `produzir-gate.ts`): aqui vivem as assercoes sobre a LISTA FECHADA do
 * contrato-w9 §2, a escrita atomica (S-8), a conferencia de presenca
 * (∅-crit) e o parse do CLI.
 *
 * PERGUNTA OBRIGATORIA DA ONDA (contrato-w9 §12): todas as assercoes sao
 * de PRESENCA per-item — "o artefato X existe com hash Y" — nunca uma
 * lista fechada de modulos ou de faixas. A UNICA lista fechada deste
 * diff e ARTEFATOS_ESPERADOS_DO_ESTRITO (a do contrato-w9 §2), e os
 * testes a leem por LEITURA, nunca a reescrevem.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARTEFATOS_ESPERADOS_DO_ESTRITO,
  FORMATO_RELATORIO_FINAL,
} from "src/pipeline/contrato.js";
import {
  conferirPresenca,
  escreverAtomico,
  parsearArgumentos,
  sha256Hex,
} from "src/pipeline/produzir.js";
import type { RelatorioFinal } from "src/pipeline/contrato.js";

/** Os 11 nomes do contrato-w9 §2, na ordem da tabela. */
const NOMES_DO_CONTRATO = [
  "manifesto-resolvido.json",
  "master-de-video-deterministico",
  "master-de-audio-do-mix",
  "entregavel.m4a",
  "entregavel.srt",
  "pos-documento.json",
  "variante-16x9.json",
  "thumbnail.png",
  "relatorio-procedencia.json",
  "entregavel-final.mp4",
  "relatorio-final.json",
] as const;

function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex");
}

/** Um relatorio-final minimo, com todos os arquivos da lista. */
async function relatorioMinimo(saida: string): Promise<RelatorioFinal> {
  const artefatos = [];
  for (const esperado of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
    if (esperado.nome === "relatorio-final.json") continue; // o 11 nao se declara
    const arquivos = [];
    for (const nome of esperado.arquivos) {
      const bytes = Buffer.from(`${nome}:${esperado.nome}`, "utf-8");
      await escreverAtomico(join(saida, nome), bytes);
      arquivos.push({ nome, sha256: sha256Hex(bytes), tamanho: bytes.length });
    }
    artefatos.push({ nome: esperado.nome, arquivos });
  }
  const relatorio = {
    schema_version: FORMATO_RELATORIO_FINAL,
    pipeline: { fixture: "canonico", estrito: true },
    sucesso: true,
    artefatos,
    ferramentas: { ffmpeg: "6.1.1-3ubuntu5", node: "v24.0.0" },
    escritoEm: "1970-01-01T00:00:00.000Z",
  };
  // O arquivo do relatorio (o artefato 11) — um JSON valido com sucesso.
  await escreverAtomico(
    join(saida, "relatorio-final.json"),
    Buffer.from(JSON.stringify(relatorio, null, 2), "utf-8"),
  );
  return relatorio as RelatorioFinal;
}

describe("F5-07 — a LISTA FECHADA do contrato-w9 §2 (presenca por item)", () => {
  it("cada um dos 11 artefatos do contrato existe na constante, com arquivos", () => {
    const nomes = new Set(ARTEFATOS_ESPERADOS_DO_ESTRITO.map((a) => a.nome));
    for (const nome of NOMES_DO_CONTRATO) {
      expect(nomes.has(nome), `artefato "${nome}" presente na lista fechada`).toBe(true);
    }
  });

  it("cada item tem identidade declarada e ao menos um arquivo nomeado", () => {
    for (const artefato of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
      expect(artefato.identidade.length, `identidade de "${artefato.nome}"`).toBeGreaterThan(0);
      expect(artefato.arquivos.length, `arquivos de "${artefato.nome}"`).toBeGreaterThan(0);
      for (const arquivo of artefato.arquivos) {
        expect(arquivo.length, `nome do arquivo de "${artefato.nome}"`).toBeGreaterThan(0);
      }
    }
  });

  it("nenhum item da lista duplica nome (identidade por nome)", () => {
    const nomes = ARTEFATOS_ESPERADOS_DO_ESTRITO.map((a) => a.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
  });
});

describe("F5-07 — escrita atomica (S-8: artefato parcial e artefato ausente)", () => {
  it("escreverAtomico so publica o destino depois do arquivo inteiro", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-atomic-"));
    try {
      const destino = join(dir, "artefato.json");
      await escreverAtomico(destino, Buffer.from("conteudo", "utf-8"));
      expect(await readFile(destino, "utf-8")).toBe("conteudo");
      // Nenhum temporario sobra na publicacao.
      expect((await readdir(dir)).filter((n) => n.includes(".tmp-"))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("F5-07 — o ∅-crit de presenca (lido da constante, nunca reescrito)", () => {
  it("verde quando todos os arquivos existem com o hash declarado", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-presenca-"));
    try {
      const relatorio = await relatorioMinimo(dir);
      const problemas = await conferirPresenca(relatorio, dir);
      expect(problemas).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("REMOVER qualquer artefato esperado fica VERMELHO NOMEANDO o artefato", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-ausencia-"));
    try {
      const relatorio = await relatorioMinimo(dir);
      for (const esperado of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
        for (const arquivo of esperado.arquivos) {
          await rm(join(dir, arquivo), { force: true });
          const problemas = await conferirPresenca(relatorio, dir);
          expect(
            problemas.some((p) => p.includes(esperado.nome) && p.includes("AUSENTE")),
            `remover "${arquivo}" do artefato "${esperado.nome}" tem de ficar ` +
              `VERMELHO por ausencia nomeando o artefato. Problemas: ${problemas.join(" | ")}`,
          ).toBe(true);
          // restaura para a proxima iteracao
          const bytes = Buffer.from(`${arquivo}:${esperado.nome}`, "utf-8");
          await escreverAtomico(join(dir, arquivo), bytes);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("CORROMPER um artefato (hash muda) fica VERMELHO nomeando o artefato", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-corrompido-"));
    try {
      const relatorio = await relatorioMinimo(dir);
      for (const esperado of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
        for (const arquivo of esperado.arquivos) {
          await writeFile(join(dir, arquivo), Buffer.from("bytes corrompidos", "utf-8"));
          const problemas = await conferirPresenca(relatorio, dir);
          expect(
            problemas.some((p) => p.includes(esperado.nome) && p.includes("corrompido")),
            `corromper "${arquivo}" do artefato "${esperado.nome}" tem de ficar ` +
              `VERMELHO. Problemas: ${problemas.join(" | ")}`,
          ).toBe(true);
          const bytes = Buffer.from(`${arquivo}:${esperado.nome}`, "utf-8");
          await escreverAtomico(join(dir, arquivo), bytes);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("um relatorio que omite um artefato fica VERMELHO nomeando o ausente", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pipeline-relatorio-"));
    try {
      const relatorio = await relatorioMinimo(dir);
      const mutilado = {
        ...relatorio,
        artefatos: relatorio.artefatos.filter((a) => a.nome !== "entregavel-final.mp4"),
      };
      const problemas = await conferirPresenca(mutilado, dir);
      expect(
        problemas.some((p) => p.includes("entregavel-final.mp4")),
        `o relatorio sem "entregavel-final.mp4" tem de acusar. Problemas: ${problemas.join(" | ")}`,
      ).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("F5-07 — sha256 e parse do CLI", () => {
  it("sha256Hex bate com o vetor conhecido", () => {
    expect(sha256Hex(Buffer.from("", "utf-8"))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("parsearArgumentos entende --fixture canonico --estrito --cache-dir", () => {
    const opcoes = parsearArgumentos([
      "--fixture", "canonico",
      "--estrito",
      "--cache-dir", "/tmp/cache-x",
    ]);
    expect(opcoes.fixture).toBe("canonico");
    expect(opcoes.estrito).toBe(true);
    expect(opcoes.cacheDir).toBe("/tmp/cache-x");
  });

  it("fixture desconhecida e argumento desconhecido sao erro nomeado", () => {
    expect(() => parsearArgumentos(["--fixture", "9x16"])).toThrow(/desconhecido/);
    expect(() => parsearArgumentos(["--nao-sei"])).toThrow(/argumento desconhecido/);
  });
});
