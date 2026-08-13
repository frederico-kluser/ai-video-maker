// =============================================================================
// FRAMES POR INDICE ABSOLUTO E O ARMAZEM — testes de unidade (F5-09)
// =============================================================================
//
// AB-691: a unidade do cache e o FRAME por indice absoluto, extraido do
// nome (`frame-7.png` -> 7), robusto a padding entre faixas de tamanhos
// diferentes. Um nome que nao casa o pattern e ERRO — se o Remotion
// mudar o naming, o cache acusa (verde vira vermelho), nunca compara
// errado em silencio.
//
// O armazem (ADR-0041, decisoes 3 e 6): um diretorio por chave C7,
// frames por indice absoluto, escrita atomica, e a FRONTEIRA de codec
// aplicada na construcao — cache de bytes para vp9/mp4 nao existe, com
// o motivo na mensagem.
// =============================================================================

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  extrairIndiceDoFrame,
  PADRAO_DE_NOME_DE_FRAME,
  ErroDeNomeDeFrame,
  ErroDeFrameAusente,
} from "../../../src/render/cache/frames";
import { ArmazemDeCache } from "../../../src/render/cache/armazenar";
import { ErroDeCacheDeBytes } from "../../../src/render/cache/delimitacao";

describe("extrairIndiceDoFrame — o parser AB-691", () => {
  it("extrai o indice ABSOLUTO do nome", () => {
    expect(extrairIndiceDoFrame("frame-0.png")).toBe(0);
    expect(extrairIndiceDoFrame("frame-7.png")).toBe(7);
    expect(extrairIndiceDoFrame("frame-726.png")).toBe(726);
  });

  it("e robusto a PADDING entre faixas de tamanhos diferentes", () => {
    expect(extrairIndiceDoFrame("frame-007.png")).toBe(7);
    expect(extrairIndiceDoFrame("frame-0001.png")).toBe(1);
    expect(extrairIndiceDoFrame("frame-0999.png")).toBe(999);
  });

  it("o pattern e o MESMO fixado pelo pipeline (frame-[frame].png)", () => {
    expect(PADRAO_DE_NOME_DE_FRAME).toBe("frame-[frame].png");
  });

  it("nome fora do pattern e ERRO, nunca comparacao errada em silencio", () => {
    for (const nome of [
      "frame-x.png",
      "frame-.png",
      "frame--1.png",
      "frame.png",
      "frame-1.jpeg",
      "outro.png",
      "frame-1.png.bak",
    ]) {
      expect(() => extrairIndiceDoFrame(nome)).toThrow(ErroDeNomeDeFrame);
    }
  });
});

describe("ArmazemDeCache — o armazem de bytes por chave", () => {
  it("grava e le bytes por indice absoluto (round-trip fiel)", () => {
    const raiz = mkdtempSync(join(tmpdir(), "cache-test-"));
    const armazem = new ArmazemDeCache({ raiz, chave: "c".repeat(64), codec: "png" });
    try {
      expect(armazem.ler(3)).toBeNull();
      armazem.gravar(3, Buffer.from("frame-3"));
      expect(armazem.ler(3)?.toString()).toBe("frame-3");
      expect(armazem.ler(4)).toBeNull();
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("indicesPresentes devolve somente os presentes, em qualquer ordem", () => {
    const raiz = mkdtempSync(join(tmpdir(), "cache-test-"));
    const armazem = new ArmazemDeCache({ raiz, chave: "c".repeat(64), codec: "png" });
    try {
      armazem.gravar(7, Buffer.from("a"));
      armazem.gravar(0, Buffer.from("b"));
      armazem.gravar(726, Buffer.from("c"));
      const presentes = armazem.indicesPresentes();
      expect([...presentes].sort((x, y) => x - y)).toEqual([0, 7, 726]);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("temTodos exige [0, totalFrames) completo — frame faltante e miss", () => {
    const raiz = mkdtempSync(join(tmpdir(), "cache-test-"));
    const armazem = new ArmazemDeCache({ raiz, chave: "c".repeat(64), codec: "png" });
    try {
      for (let f = 0; f < 5; f++) {
        armazem.gravar(f, Buffer.from(`f${f}`));
      }
      expect(armazem.temTodos(5)).toBe(true);
      expect(armazem.temTodos(6)).toBe(false);
      expect(armazem.temTodos(0)).toBe(false);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("chaves DIFERENTES nunca colidem — diretorios isolados", () => {
    const raiz = mkdtempSync(join(tmpdir(), "cache-test-"));
    const a = new ArmazemDeCache({ raiz, chave: "a".repeat(64), codec: "png" });
    const b = new ArmazemDeCache({ raiz, chave: "b".repeat(64), codec: "png" });
    try {
      a.gravar(1, Buffer.from("de-a"));
      expect(b.ler(1)).toBeNull();
      expect(b.indicesPresentes().size).toBe(0);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("um arquivo estranho dentro do diretorio de frames acusa (verde vira vermelho)", () => {
    const raiz = mkdtempSync(join(tmpdir(), "cache-test-"));
    const armazem = new ArmazemDeCache({ raiz, chave: "c".repeat(64), codec: "png" });
    try {
      mkdirSync(armazem.dirDosFrames, { recursive: true });
      writeFileSync(join(armazem.dirDosFrames, "frame-estranho.png"), "x");
      expect(() => armazem.indicesPresentes()).toThrow(ErroDeNomeDeFrame);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("a FRONTEIRA de codec recusa cache de bytes fora de CODIFICADORES_DA_COMPARACAO", () => {
    for (const codec of ["vp9/webm", "mp4/h264", "codec-desconhecido"]) {
      let erro: ErroDeCacheDeBytes | null = null;
      try {
        new ArmazemDeCache({ raiz: tmpdir(), chave: "c".repeat(64), codec });
      } catch (e) {
        erro = e as ErroDeCacheDeBytes;
      }
      expect(erro).not.toBeNull();
      // A exclusao e dita em voz alta: o motivo do ADR/AB na mensagem.
      expect(erro!.message).toMatch(/AB-396|AB-397|ADR-0035|declarad|sem declaracao/);
    }
  });

  it("limpar apaga a chave inteira (a sonda de miss forcado do gate)", () => {
    const raiz = mkdtempSync(join(tmpdir(), "cache-test-"));
    const armazem = new ArmazemDeCache({ raiz, chave: "c".repeat(64), codec: "png" });
    try {
      armazem.gravar(1, Buffer.from("a"));
      armazem.gravarMeta({
        formato: "render-cache-meta-v1",
        chave: "c".repeat(64),
        codec: "png",
        componentes: {
          manifesto: "m",
          assets: "a",
          tokens: "t",
          versoes: "v",
          ferramentas: "f",
        },
        totalFrames: 2,
      });
      expect(armazem.ler(1)).not.toBeNull();
      armazem.limpar();
      expect(armazem.ler(1)).toBeNull();
      expect(armazem.meta()).toBeNull();
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it("o meta.json registra os componentes da chave — SEM data (diagnostico por conteudo)", () => {
    const raiz = mkdtempSync(join(tmpdir(), "cache-test-"));
    const armazem = new ArmazemDeCache({ raiz, chave: "c".repeat(64), codec: "png" });
    try {
      armazem.gravarMeta({
        formato: "render-cache-meta-v1",
        chave: "c".repeat(64),
        codec: "png",
        componentes: {
          manifesto: "m1",
          assets: "a1",
          tokens: "t1",
          versoes: "v1",
          ferramentas: "f1",
        },
        totalFrames: 2,
      });
      const meta = armazem.meta();
      expect(meta?.componentes.manifesto).toBe("m1");
      expect(meta?.totalFrames).toBe(2);
      const texto = JSON.stringify(meta).toLowerCase();
      for (const proibida of ["memtotal", "workers", "porta", "data"]) {
        expect(texto).not.toContain(proibida);
      }
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });
});

describe("ErroDeFrameAusente — nunca render parcial", () => {
  it("e um erro distinto, nomeado", () => {
    const erro = new ErroDeFrameAusente(7);
    expect(erro.code).toBe("FRAME_AUSENTE");
    expect(erro.message).toContain("7");
  });
});
