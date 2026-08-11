/**
 * src/store/store.ts
 *
 * Store de assets enderecado por hash de conteudo (SHA-256).
 *
 * Append-only: escrita atomica (tmp + fsync + rename), N escritores
 * concorrentes do mesmo conteudo produzem um arquivo e zero corrupcao.
 *
 * Cada asset tem um procedencia.json irmao com licenca e metadados
 * de proveniencia.
 *
 * A chave de cache inclui TUDO que muda a saida (C12).
 * — asset-acquisition SKILL.md §1.1-1.6
 * — AGENTS.md C7, C12
 */

import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  writeFile,
  readFile,
  rename,
  access,
  open as fsOpen,
} from "node:fs/promises";
import { join, dirname } from "node:path";
import type { Procedencia } from "./procedencia.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

/** Prefixo do diretorio de cache relativo a raiz do projeto. */
const DEFAULT_STORE_ROOT = ".cache/store";

/** Tamanho do prefixo do hash usado como subdiretorio. */
const HASH_PREFIX_LENGTH = 2;

// ─── Tipos ─────────────────────────────────────────────────────────────────────

/** Opcoes de configuracao do Store. */
export interface StoreOptions {
  /** Raiz do store no sistema de arquivos. Default: ".cache/store" */
  root?: string;
}

/** Resultado de uma operacao de put no store. */
export interface PutResult {
  /** Hash SHA-256 do conteudo armazenado. */
  hash: string;
  /** Caminho absoluto do arquivo armazenado. */
  path: string;
  /** Caminho absoluto do arquivo de procedencia. */
  procedenciaPath: string;
}

/** Chave composta para cache de derivados.
 *  Inclui TUDO que muda a saida (C12). */
export interface CacheKey {
  /** Hash do conteudo base (ou identificador de operacao). */
  operation: string;
  /** Parametros que afetam a saida. */
  params: Record<string, string | number | boolean | null>;
  /** Versoes das ferramentas que afetam a saida. */
  toolVersions: Record<string, string>;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export class Store {
  readonly root: string;

  constructor(options: StoreOptions = {}) {
    this.root = options.root ?? DEFAULT_STORE_ROOT;
  }

  // ─── Hash ──────────────────────────────────────────────────────────────────

  /** Calcula o hash SHA-256 de um buffer. */
  static hashBuffer(data: Buffer): string {
    return createHash("sha256").update(data).digest("hex");
  }

  /** Calcula o hash SHA-256 de uma string (UTF-8). */
  static hashString(data: string): string {
    return Store.hashBuffer(Buffer.from(data, "utf-8"));
  }

  /** Calcula o hash SHA-256 de um arquivo em disco. */
  static async hashFile(filePath: string): Promise<string> {
    const data = await readFile(filePath);
    return Store.hashBuffer(data);
  }

  // ─── Caminhos ──────────────────────────────────────────────────────────────

  /** Retorna o caminho do diretorio de prefixo para um hash. */
  private hashDir(hash: string): string {
    return join(this.root, hash.slice(0, HASH_PREFIX_LENGTH));
  }

  /** Retorna o caminho completo do arquivo de conteudo para um hash. */
  hashPath(hash: string): string {
    return join(this.hashDir(hash), hash);
  }

  /** Retorna o caminho completo do arquivo de procedencia para um hash. */
  procedenciaPath(hash: string): string {
    return join(this.hashDir(hash), `${hash}.procedencia.json`);
  }

  // ─── Operacoes atomicas ────────────────────────────────────────────────────

  /**
   * Escreve um arquivo atomicamente usando tmp + fsync + rename.
   *
   * N escritores concorrentes do mesmo conteudo produzem um arquivo
   * e zero corrupcao: o ultimo rename vence, mas o conteudo e identico
   * porque o hash e o mesmo.
   */
  private async atomicWrite(
    filePath: string,
    data: Buffer | string,
  ): Promise<void> {
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Nome unico para tmp: PID + timestamp + 8 bytes hex aleatorios
    // Garante unicidade mesmo com N escritores concorrentes no mesmo processo
    const rnd = randomBytes(4).toString("hex");
    const tmpName = `${filePath.split("/").pop()!}.tmp.${process.pid}-${Date.now()}-${rnd}`;
    const tmpFile = join(dir, tmpName);
    const content = typeof data === "string" ? Buffer.from(data, "utf-8") : data;

    // Escreve no arquivo temporario
    const fd = await fsOpen(tmpFile, "w", 0o644);
    try {
      await fd.write(content, 0, content.length);
      // fsync para garantir que os dados chegaram ao disco
      await fd.sync();
    } finally {
      await fd.close();
    }

    // Renomeia atomicamente
    // Se o destino ja existe (outro escritor chegou primeiro), o rename
    // sobrescreve — mas o conteudo e identico porque o hash e o mesmo.
    await rename(tmpFile, filePath);
  }

  // ─── API publica ───────────────────────────────────────────────────────────

  /**
   * Armazena conteudo no store enderecado por SHA-256.
   *
   * Se o asset ja existe, retorna o hash existente sem reescrever.
   * A escrita e atomica: tmp + fsync + rename.
   *
   * O procedencia e obrigatorio — sem licenca registrada, o asset
   * nao pode ser auditado.
   *
   * @param content - Conteudo binario do asset.
   * @param procedencia - Metadados de proveniencia (licenca obrigatoria).
   * @returns Hash e caminhos do asset armazenado.
   */
  async put(
    content: Buffer,
    procedencia: Procedencia,
  ): Promise<PutResult> {
    const hash = Store.hashBuffer(content);
    const filePath = this.hashPath(hash);
    const procPath = this.procedenciaPath(hash);

    // Verifica se o conteudo ja existe
    const exists = await this.has(hash);

    if (!exists) {
      // Escrita atomica do conteudo
      await this.atomicWrite(filePath, content);

      // Escrita atomica da procedencia
      await this.atomicWrite(
        procPath,
        JSON.stringify(procedencia, null, 2) + "\n",
      );
    }

    return { hash, path: filePath, procedenciaPath: procPath };
  }

  /**
   * Recupera o conteudo de um asset pelo hash.
   *
   * @param hash - Hash SHA-256 do asset.
   * @returns Buffer com o conteudo, ou null se nao encontrado.
   */
  async get(hash: string): Promise<Buffer | null> {
    const filePath = this.hashPath(hash);
    try {
      return await readFile(filePath);
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") return null;
      throw err;
    }
  }

  /**
   * Recupera a procedencia de um asset pelo hash.
   *
   * @param hash - Hash SHA-256 do asset.
   * @returns Procedencia, ou null se nao encontrada.
   */
  async getProcedencia(hash: string): Promise<Procedencia | null> {
    const procPath = this.procedenciaPath(hash);
    try {
      const raw = await readFile(procPath, "utf-8");
      return JSON.parse(raw) as Procedencia;
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === "ENOENT") return null;
      throw err;
    }
  }

  /**
   * Verifica se um asset existe no store.
   *
   * @param hash - Hash SHA-256 do asset.
   * @returns true se o asset existe.
   */
  async has(hash: string): Promise<boolean> {
    const filePath = this.hashPath(hash);
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verifica a integridade de um asset: recalcula o hash do arquivo
   * e compara com o hash esperado (nome do arquivo).
   *
   * @param hash - Hash SHA-256 esperado.
   * @returns true se o arquivo existe e o hash confere.
   */
  async verify(hash: string): Promise<boolean> {
    const filePath = this.hashPath(hash);
    try {
      const actualHash = await Store.hashFile(filePath);
      return actualHash === hash;
    } catch {
      return false;
    }
  }

  /**
   * Deriva um asset a partir de uma chave de cache composta.
   *
   * A chave inclui TUDO que muda a saida: operacao, parametros
   * e versoes de ferramentas (C12).
   *
   * Se a chave ja produziu um resultado, retorna o hash cacheado.
   * Senao, executa o producer, armazena o resultado e retorna o hash.
   *
   * @param key - Chave de cache composta (tudo que muda a saida).
   * @param producer - Funcao que produz o conteudo se nao cacheado.
   * @param procedencia - Metadados de proveniencia.
   * @returns Hash do conteudo (cacheado ou recem-produzido).
   */
  async derive(
    key: CacheKey,
    producer: () => Promise<Buffer>,
    procedencia: Procedencia,
  ): Promise<string> {
    // A chave de cache e o hash de todos os componentes que afetam a saida
    const keyHash = Store.hashString(JSON.stringify(key));

    // Verifica se ja existe um asset cacheado com esta chave
    const keyFilePath = join(this.hashDir(keyHash), `${keyHash}.cache-key.json`);
    try {
      const cached = JSON.parse(await readFile(keyFilePath, "utf-8")) as {
        contentHash: string;
      };
      if (await this.has(cached.contentHash)) {
        return cached.contentHash;
      }
    } catch {
      // Cache miss: produz o conteudo
    }

    // Produz o conteudo
    const content = await producer();

    // Armazena no store
    const { hash } = await this.put(content, procedencia);

    // Registra o mapeamento chave → hash
    await this.atomicWrite(
      keyFilePath,
      JSON.stringify({ contentHash: hash, key }, null, 2) + "\n",
    );

    return hash;
  }

  /**
   * Lista todos os hashes armazenados no store.
   *
   * @returns Array de hashes.
   */
  async list(): Promise<string[]> {
    const hashes: string[] = [];
    try {
      const { readdir } = await import("node:fs/promises");
      const prefixDirs = await readdir(this.root, { withFileTypes: true });
      for (const entry of prefixDirs) {
        if (!entry.isDirectory()) continue;
        if (entry.name.length !== HASH_PREFIX_LENGTH) continue;
        const files = await readdir(join(this.root, entry.name), {
          withFileTypes: true,
        });
        for (const file of files) {
          if (!file.isFile()) continue;
          // Arquivos de conteudo: nome e o hash completo (64 chars hex)
          if (
            file.name.length === 64 &&
            /^[0-9a-f]{64}$/.test(file.name)
          ) {
            hashes.push(file.name);
          }
        }
      }
    } catch {
      // Store vazio ou inexistente
    }
    return hashes.sort();
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isNodeError(
  err: unknown,
): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
