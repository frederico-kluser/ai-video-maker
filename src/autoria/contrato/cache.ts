/**
 * src/autoria/contrato/cache.ts
 *
 * Cache de autoria — a garantia de reprodutibilidade do estagio.
 *
 * O LLM nao e deterministico: nenhum fornecedor garante saida identica,
 * nem com temperature 0 (ADR-0023, pergunta adversarial 2). A unica
 * reprodutibilidade real e cache de saida por hash da entrada
 * canonicalizada: sha256(canonical_json({model, system, tools, messages,
 * output_config, schema_version})) -> .cache/manifests/<hash>.json.
 *
 * Regras:
 *   - A mesma entrada NUNCA chama a API duas vezes (HIT serve o arquivo).
 *   - Mudar QUALQUER componente da chave gera MISS (C12) — teste por
 *     componente em tests/autoria/contrato/cache.test.ts.
 *   - Escrita atomica (tmp + rename): um processo nunca le arquivo pela
 *     metade.
 *   - A chamada a API entra por injecao (gerador): este modulo nao
 *     conhece fornecedor nenhum — o contrato e a mecanica do cache.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalizar } from "./canonicalizar.js";
import type { EntradaAutoria } from "./contrato.js";

/** Diretorio padrao do cache: .cache/manifests/ (gitignored no repo). */
const DIRETORIO_PADRAO = join(
  process.cwd(),
  ".cache",
  "manifests",
);

let diretorioCache = process.env.AUTORIA_CACHE_DIR ?? DIRETORIO_PADRAO;

/** Troca o diretorio do cache (testes usam um tmp dir; ambiente usa env). */
export function definirDiretorioCache(diretorio: string): void {
  diretorioCache = diretorio;
}

export function obterDiretorioCache(): string {
  return diretorioCache;
}

/** sha256 da entrada canonicalizada — a chave do cache. */
export function chaveDeCache(entrada: EntradaAutoria): string {
  return createHash("sha256").update(canonicalizar(entrada), "utf-8").digest("hex");
}

/** Caminho do arquivo de cache para uma entrada. */
export function caminhoDoCache(entrada: EntradaAutoria): string {
  return join(diretorioCache, `${chaveDeCache(entrada)}.json`);
}

/** Le a saida cacheada, ou null em MISS. */
export function lerDoCache(entrada: EntradaAutoria): unknown | null {
  const caminho = caminhoDoCache(entrada);
  if (!existsSync(caminho)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(caminho, "utf-8")) as unknown;
  } catch {
    // Arquivo corrompido = MISS (a geracao regenera). Nunca lanca aqui:
    // um cache corrompido nao pode derrubar o estagio.
    return null;
  }
}

/** Escreve a saida no cache, atomicamente (tmp + rename). */
export function escreverNoCache(entrada: EntradaAutoria, saida: unknown): void {
  const caminho = caminhoDoCache(entrada);
  mkdirSync(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp-${process.pid}`;
  writeFileSync(temporario, JSON.stringify(saida), "utf-8");
  renameSync(temporario, caminho);
}

/**
 * O ciclo completo: HIT devolve a saida cacheada sem chamar o gerador;
 * MISS chama o gerador UMA vez e persiste. `gerador` e a funcao que fala
 * com o provedor (ou com um sosia/cassete) — injetada para o contrato nao
 * depender de fornecedor.
 */
export function buscarOuGerar(
  entrada: EntradaAutoria,
  gerador: (entrada: EntradaAutoria) => unknown,
): unknown {
  const cacheado = lerDoCache(entrada);
  if (cacheado !== null) {
    return cacheado;
  }
  const saida = gerador(entrada);
  escreverNoCache(entrada, saida);
  return saida;
}
