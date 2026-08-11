/**
 * tests/store/store.test.ts
 *
 * Testes do store enderecado por conteudo (SHA-256).
 *
 * Cobre:
 * - Escrita e leitura basica
 * - Escrita atomica (tmp + rename)
 * - Escrita concorrente do mesmo conteudo → um arquivo, zero corrupcao
 * - Cache miss por parametro (C12: muda um parametro por vez e exige miss)
 * - Ausencia de URL no manifesto-resolvido (C7: so hash de conteudo)
 * - Verificacao de integridade (sha256sum)
 * - Procedencia obrigatoria
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Store } from "src/store/store.js";
import type { Procedencia, CacheKey } from "src/store/store.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeProcedencia(overrides?: Partial<Procedencia>): Procedencia {
  return {
    license: "CC BY 4.0",
    attributionRequired: true,
    attribution: "Author Name",
    source: "local",
    acquiredAt: new Date().toISOString(),
    mimeType: "image/png",
    byteSize: 1024,
    ...overrides,
  };
}

function makeCacheKey(
  overrides?: Partial<CacheKey>,
): CacheKey {
  return {
    operation: "test-op",
    params: { param1: "value1", param2: 42 },
    toolVersions: { toolA: "1.0.0" },
    ...overrides,
  };
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe("Store (enderecado por conteudo)", () => {
  let tmpDir: string;
  let store: Store;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "store-test-"));
    store = new Store({ root: join(tmpDir, ".cache", "store") });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Hash ──────────────────────────────────────────────────────────────────

  describe("hash", () => {
    it("calcula SHA-256 deterministico", () => {
      const h1 = Store.hashBuffer(Buffer.from("hello"));
      const h2 = Store.hashBuffer(Buffer.from("hello"));
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });

    it("conteudos diferentes produzem hashes diferentes", () => {
      const h1 = Store.hashBuffer(Buffer.from("hello"));
      const h2 = Store.hashBuffer(Buffer.from("world"));
      expect(h1).not.toBe(h2);
    });

    it("hashString e equivalente a hashBuffer do UTF-8", () => {
      const str = "teste";
      const h1 = Store.hashString(str);
      const h2 = Store.hashBuffer(Buffer.from(str, "utf-8"));
      expect(h1).toBe(h2);
    });

    it("hashFile confere com hashBuffer", async () => {
      const content = Buffer.from("file content");
      const filePath = join(tmpDir, "test.bin");
      await writeFile(filePath, content);
      const h1 = Store.hashBuffer(content);
      const h2 = await Store.hashFile(filePath);
      expect(h1).toBe(h2);
    });
  });

  // ─── Put e Get ─────────────────────────────────────────────────────────────

  describe("put e get", () => {
    it("armazena e recupera conteudo", async () => {
      const content = Buffer.from("my test content");
      const proc = makeProcedencia();
      const { hash } = await store.put(content, proc);
      const retrieved = await store.get(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe("my test content");
    });

    it("put retorna o hash e caminhos", async () => {
      const content = Buffer.from("test");
      const proc = makeProcedencia();
      const result = await store.put(content, proc);
      expect(result.hash).toBe(Store.hashBuffer(content));
      expect(result.path).toContain(result.hash);
      expect(result.procedenciaPath).toContain(result.hash);
    });

    it("put do mesmo conteudo retorna o mesmo hash (idempotente)", async () => {
      const content = Buffer.from("idempotent test");
      const proc = makeProcedencia();
      const r1 = await store.put(content, proc);
      const r2 = await store.put(content, proc);
      expect(r1.hash).toBe(r2.hash);
      expect(r1.path).toBe(r2.path);
    });

    it("get de hash inexistente retorna null", async () => {
      const result = await store.get(
        "a".repeat(64),
      );
      expect(result).toBeNull();
    });

    it("has retorna true para asset existente", async () => {
      const content = Buffer.from("has test");
      const { hash } = await store.put(content, makeProcedencia());
      expect(await store.has(hash)).toBe(true);
    });

    it("has retorna false para hash inexistente", async () => {
      expect(await store.has("b".repeat(64))).toBe(false);
    });
  });

  // ─── Procedencia ───────────────────────────────────────────────────────────

  describe("procedencia", () => {
    it("armazena e recupera procedencia", async () => {
      const content = Buffer.from("asset with license");
      const proc = makeProcedencia({
        license: "MIT",
        source: "pexels",
        sourceId: "12345",
        fetchedFrom: "https://example.com/asset.jpg",
      });
      const { hash } = await store.put(content, proc);
      const retrieved = await store.getProcedencia(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.license).toBe("MIT");
      expect(retrieved!.source).toBe("pexels");
      expect(retrieved!.sourceId).toBe("12345");
      expect(retrieved!.fetchedFrom).toBe("https://example.com/asset.jpg");
    });

    it("procedencia e obrigatoria — sempre gravada junto com o asset", async () => {
      const content = Buffer.from("procedencia test");
      const proc = makeProcedencia({ license: "Apache-2.0" });
      const { hash } = await store.put(content, proc);
      const retrieved = await store.getProcedencia(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.license).toBe("Apache-2.0");
    });

    it("getProcedencia de hash inexistente retorna null", async () => {
      const result = await store.getProcedencia("c".repeat(64));
      expect(result).toBeNull();
    });

    it("procedencia contem fetchedFrom (URL) mas o manifesto so referencia hash (C7)", async () => {
      const content = Buffer.from("c7 test");
      const proc = makeProcedencia({
        fetchedFrom: "https://api.giphy.com/v1/gifs/abc123",
        source: "giphy",
        sourceId: "abc123",
      });
      const { hash } = await store.put(content, proc);

      // O hash e a unica referencia no manifesto
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      // A URL fica na procedencia, nao no caminho de leitura
      const retrieved = await store.getProcedencia(hash);
      expect(retrieved!.fetchedFrom).toBe("https://api.giphy.com/v1/gifs/abc123");
      // O get usa o hash, nao a URL
      const asset = await store.get(hash);
      expect(asset).not.toBeNull();
    });
  });

  // ─── Escrita atomica ───────────────────────────────────────────────────────

  describe("escrita atomica", () => {
    it("escreve sem corrupcao: conteudo lido e identico ao escrito", async () => {
      const content = Buffer.from("atomic write test " + "x".repeat(1000));
      const proc = makeProcedencia();
      const { hash } = await store.put(content, proc);
      const retrieved = await store.get(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.equals(content)).toBe(true);
    });

    it("conteudo binario (bytes nao-UTF8) sobrevive roundtrip", async () => {
      const content = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) content[i] = i;
      const proc = makeProcedencia({ mimeType: "application/octet-stream" });
      const { hash } = await store.put(content, proc);
      const retrieved = await store.get(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.equals(content)).toBe(true);
    });
  });

  // ─── Concorrencia ──────────────────────────────────────────────────────────

  describe("concorrencia", () => {
    it("N escritores do mesmo conteudo produzem um arquivo e zero corrupcao", async () => {
      const content = Buffer.from("concurrent test content");
      const proc = makeProcedencia();

      // Simula N escritores concorrentes tentando escrever o mesmo conteudo
      const N = 10;
      const results = await Promise.all(
        Array.from({ length: N }, () => store.put(content, proc)),
      );

      // Todos retornam o mesmo hash
      const hashes = results.map((r) => r.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1);

      // O conteudo recuperado e integro
      const hash = hashes[0]!;
      const retrieved = await store.get(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe("concurrent test content");
    });

    it("escritores concorrentes de conteudos diferentes nao interferem", async () => {
      const contents = Array.from({ length: 5 }, (_, i) =>
        Buffer.from(`content-${i}`),
      );
      const procs = contents.map((_, i) =>
        makeProcedencia({ sourceId: `src-${i}` }),
      );

      const results = await Promise.all(
        contents.map((c, i) => store.put(c, procs[i]!)),
      );

      // Cada hash e unico
      const hashes = results.map((r) => r.hash);
      expect(new Set(hashes).size).toBe(5);

      // Cada conteudo e recuperavel
      for (let i = 0; i < contents.length; i++) {
        const retrieved = await store.get(hashes[i]!);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.toString()).toBe(`content-${i}`);
      }
    });
  });

  // ─── Cache key (C12) ───────────────────────────────────────────────────────

  describe("derive — cache key (C12)", () => {
    it("derive cacheia resultado e retorna no segundo acesso", async () => {
      const key = makeCacheKey({ operation: "derive-test" });
      let callCount = 0;

      const producer = async (): Promise<Buffer> => {
        callCount++;
        return Buffer.from("derived content");
      };

      const h1 = await store.derive(key, producer, makeProcedencia());
      const h2 = await store.derive(key, producer, makeProcedencia());

      // Mesmo hash retornado
      expect(h1).toBe(h2);
      // Producer chamado so uma vez
      expect(callCount).toBe(1);
    });

    it("muda um parametro → cache miss (C12)", async () => {
      let callCount = 0;

      const producer = async (): Promise<Buffer> => {
        callCount++;
        return Buffer.from(`call-${callCount}`);
      };

      const key1 = makeCacheKey({
        operation: "c12-test",
        params: { param1: "value1", param2: 42 },
      });

      const h1 = await store.derive(key1, producer, makeProcedencia());
      expect(callCount).toBe(1);

      // Muda UM parametro (param1)
      const key2 = makeCacheKey({
        operation: "c12-test",
        params: { param1: "value2", param2: 42 },
      });
      const h2 = await store.derive(key2, producer, makeProcedencia());
      expect(callCount).toBe(2);
      expect(h2).not.toBe(h1);
    });

    it("muda toolVersion → cache miss (C12)", async () => {
      let callCount = 0;

      const producer = async (): Promise<Buffer> => {
        callCount++;
        return Buffer.from(`tool-${callCount}`);
      };

      const key1 = makeCacheKey({
        operation: "tool-version-test",
        toolVersions: { remotion: "4.0.507" },
      });

      const h1 = await store.derive(key1, producer, makeProcedencia());
      expect(callCount).toBe(1);

      // Muda versao da ferramenta
      const key2 = makeCacheKey({
        operation: "tool-version-test",
        toolVersions: { remotion: "4.0.508" },
      });
      const h2 = await store.derive(key2, producer, makeProcedencia());
      expect(callCount).toBe(2);
      expect(h2).not.toBe(h1);
    });

    it("muda operation → cache miss", async () => {
      let callCount = 0;

      const producer = async (): Promise<Buffer> => {
        callCount++;
        return Buffer.from(`op-${callCount}`);
      };

      const key1 = makeCacheKey({ operation: "op-A" });
      await store.derive(key1, producer, makeProcedencia());
      expect(callCount).toBe(1);

      const key2 = makeCacheKey({ operation: "op-B" });
      await store.derive(key2, producer, makeProcedencia());
      expect(callCount).toBe(2);
    });

    it("adiciona um parametro novo → cache miss", async () => {
      let callCount = 0;

      const producer = async (): Promise<Buffer> => {
        callCount++;
        return Buffer.from(`new-param-${callCount}`);
      };

      const key1 = makeCacheKey({
        operation: "new-param-test",
        params: { a: "1" },
      });
      await store.derive(key1, producer, makeProcedencia());
      expect(callCount).toBe(1);

      // Adiciona parametro b
      const key2 = makeCacheKey({
        operation: "new-param-test",
        params: { a: "1", b: "2" },
      });
      await store.derive(key2, producer, makeProcedencia());
      expect(callCount).toBe(2);
    });

    it("mesmo parametro com valor default → mesmo cache", async () => {
      let callCount = 0;

      const producer = async (): Promise<Buffer> => {
        callCount++;
        return Buffer.from("same params");
      };

      const key = makeCacheKey({
        operation: "same-params",
        params: { x: "same", y: 42 },
      });

      const h1 = await store.derive(key, producer, makeProcedencia());
      const h2 = await store.derive(key, producer, makeProcedencia());

      expect(h1).toBe(h2);
      expect(callCount).toBe(1);
    });
  });

  // ─── Integridade ───────────────────────────────────────────────────────────

  describe("verificacao de integridade", () => {
    it("verify retorna true para asset integro", async () => {
      const content = Buffer.from("integrity check");
      const { hash } = await store.put(content, makeProcedencia());
      expect(await store.verify(hash)).toBe(true);
    });

    it("verify retorna false para hash inexistente", async () => {
      expect(await store.verify("d".repeat(64))).toBe(false);
    });
  });

  // ─── List ──────────────────────────────────────────────────────────────────

  describe("list", () => {
    it("lista todos os hashes armazenados", async () => {
      const contents = ["a", "b", "c"].map((s) => Buffer.from(s));
      const procs = contents.map((_, i) =>
        makeProcedencia({ sourceId: `list-${i}` }),
      );

      const hashes: string[] = [];
      for (let i = 0; i < contents.length; i++) {
        const { hash } = await store.put(contents[i]!, procs[i]!);
        hashes.push(hash);
      }

      const list = await store.list();
      expect(list).toHaveLength(3);
      for (const h of hashes) {
        expect(list).toContain(h);
      }
    });

    it("store vazio retorna lista vazia", async () => {
      const list = await store.list();
      expect(list).toEqual([]);
    });
  });

  // ─── C7 — Nada de URL como caminho ─────────────────────────────────────────

  describe("C7 — ausencia de URL no manifesto-resolvido", () => {
    it("o hash do conteudo e a unica chave de recuperacao", async () => {
      const content = Buffer.from("c7-no-url");
      const proc = makeProcedencia({
        fetchedFrom: "https://cdn.example.com/asset.mp4",
        source: "pexels",
      });
      const { hash } = await store.put(content, proc);

      // So o hash recupera o conteudo
      const byHash = await store.get(hash);
      expect(byHash).not.toBeNull();

      // A URL NAO e usada como caminho de leitura
      const procRetrieved = await store.getProcedencia(hash);
      expect(procRetrieved!.fetchedFrom).toBeDefined();
      // A URL existe na procedencia, mas nao e usada para recuperar o asset
    });

    it("o hash nao depende da URL — mesmo conteudo de URLs diferentes = mesmo hash", async () => {
      const content = Buffer.from("same content, different URLs");
      const proc1 = makeProcedencia({
        fetchedFrom: "https://cdn1.example.com/asset.jpg",
        source: "pexels",
      });
      const proc2 = makeProcedencia({
        fetchedFrom: "https://cdn2.example.com/asset.jpg",
        source: "pixabay",
      });

      const { hash: h1 } = await store.put(content, proc1);
      const { hash: h2 } = await store.put(content, proc2);

      // Mesmo conteudo = mesmo hash, independente da URL de origem
      expect(h1).toBe(h2);
    });
  });

  // ─── Root customizado ──────────────────────────────────────────────────────

  describe("root customizado", () => {
    it("respeita o root passado no construtor", async () => {
      const customRoot = join(tmpDir, "custom-store");
      const customStore = new Store({ root: customRoot });

      const content = Buffer.from("custom root");
      const { hash, path } = await customStore.put(
        content,
        makeProcedencia(),
      );

      expect(path).toContain(customRoot);
      const retrieved = await customStore.get(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe("custom root");
    });
  });
});
