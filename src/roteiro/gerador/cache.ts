/**
 * src/roteiro/gerador/cache.ts
 *
 * O STORE do cache do gerador de roteiro — leitura/escrita em disco,
 * atomico (S-8). A DERIVACAO da chave e do contrato
 * (chaveDeCacheGerador em src/roteiro/contrato/cache.ts); este modulo
 * e o disco.
 *
 * A chave do STORE COMPOE a chave do contrato com o sha256 do prompt E
 * com o FINGERPRINT do schema podado:
 *
 *   chaveDoStore = sha256(chaveDeCacheGerador(pedido)
 *                         + ":" + sha256(prompt)
 *                         + ":" + fingerprintDoSchemaPodado(alvo))
 *
 * Por que compor com o prompt (C12): o contrato congelou a chave como
 * sha256(canonical_json(pedido)) — o pedido NAO carrega o texto do
 * prompt. Mas a saida muda quando o prompt muda (docs/roteiro/prompts/):
 * o prompt alterado SEM bump de versao serviria resultado velho para
 * sempre. Com a composicao, qualquer edicao no prompt-roteirista
 * principal ou no prompt-regenerar-pedaco e MISS automatico.
 *
 * Por que compor com o fingerprint do schema (C12, REPLAN P1): o
 * output_config NAO faz parte do prompt — o schema podado por
 * fornecedor (src/roteiro/gerador/schema/) muda a saida do LLM sem
 * tocar no texto do prompt. O fingerprint (sha256 do JSON canonico dos
 * schemas do alvo, provedor.ts) amarra o schema a chave: schema
 * editado = MISS sem bump de prompt nem de versao. O fingerprint e por
 * ALVO (completo | pedaco): renomear um campo do schema da regeneracao
 * nao invalida o cache da geracao completa.
 *
 * O teste FQ-C3 (que exercita a chave do contrato diretamente)
 * permanece intocado: a composicao vive no store, que e do gerador.
 *
 * Regras:
 *   - escrita atomica (tmp + rename): um processo nunca le arquivo pela
 *     metade (S-8) — o poll do servidor relê o arquivo a cada tick;
 *   - arquivo corrompido = MISS (a geracao regenera; cache corrompido
 *     nunca derruba o estagio — o GATE revalida a saida lida do cache,
 *     cache envenenado nao entra no pipeline);
 *   - a saida persistida e a NORMALIZADA e VALIDADA (record-first), nunca
 *     a resposta bruta do provedor: o cache so guarda roteiros/pedacos
 *     que o contrato aceita.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** Diretorio padrao do cache do gerador: .cache/roteiro/ (gitignored). */
const DIRETORIO_PADRAO = join(process.cwd(), ".cache", "roteiro");

let diretorioCache = process.env.ROTEIRO_CACHE_DIR ?? DIRETORIO_PADRAO;

/** Troca o diretorio do cache (testes usam um tmp dir; ambiente usa env). */
export function definirDiretorioCache(diretorio: string): void {
  diretorioCache = diretorio;
}

/** O diretorio corrente do cache do gerador. */
export function obterDiretorioCache(): string {
  return diretorioCache;
}

/** sha256 de uma string — a composicao da chave do store. */
export function sha256(texto: string): string {
  return createHash("sha256").update(texto, "utf-8").digest("hex");
}

/**
 * A chave do STORE do cache: a chave do contrato (sha256 do pedido
 * canonico) composta com o sha256 do prompt E com o fingerprint do
 * schema podado do alvo — ver cabecalho do modulo.
 *
 * @param fingerprintDoSchema fingerprintDoSchemaPodado(alvo) — C12: o
 *   output_config nao faz parte do prompt; sem o fingerprint, schema
 *   podado editado serviria resultado velho para sempre.
 */
export function chaveDoStore(
  chaveDoContrato: string,
  prompt: string,
  fingerprintDoSchema: string,
): string {
  return sha256(`${chaveDoContrato}:${sha256(prompt)}:${fingerprintDoSchema}`);
}

/** Caminho do arquivo de cache para uma chave do store. */
export function caminhoDoCache(chave: string): string {
  return join(diretorioCache, `${chave}.json`);
}

/** Le a saida cacheada, ou null em MISS (corrompido = MISS). */
export function lerDoCache(chave: string): unknown | null {
  const caminho = caminhoDoCache(chave);
  if (!existsSync(caminho)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(caminho, "utf-8")) as unknown;
  } catch {
    // Arquivo corrompido = MISS (a geracao regenera). Nunca lanca aqui:
    // um cache corrompido nao pode derrubar o gerador.
    return null;
  }
}

/** Escreve a saida no cache, atomicamente (tmp + rename, S-8). */
export function escreverNoCache(chave: string, saida: unknown): void {
  const caminho = caminhoDoCache(chave);
  mkdirSync(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp-${process.pid}`;
  writeFileSync(temporario, JSON.stringify(saida), "utf-8");
  renameSync(temporario, caminho);
}
