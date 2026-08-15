/**
 * tests/roteiro/gerador-cache.test.ts
 *
 * Gaps de cobertura do STORE do cache do gerador
 * (src/roteiro/gerador/cache.ts) nao exercitados por gerador.test.ts:
 *
 *   - obterDiretorioCache (default do modulo + apos definirDiretorioCache);
 *   - escrita atomica verificada no DISCO (tmp + rename, S-8): apos
 *     escreverNoCache nao sobra nenhum `.tmp-*` — o poll do servidor
 *     nunca le o arquivo pela metade;
 *   - lerDoCache com arquivo corrompido = MISS (null) no nivel do store
 *     (gerador.test.ts cobre o efeito via gerarRoteiro);
 *   - a composicao da chave do store e deterministica (mesma entrada,
 *     mesma chave; entradas diferentes, chaves diferentes).
 *
 * O trio do gate (gerador.test.ts + gerador-cli.test.ts) cobre o resto;
 * aqui so os caminhos de codigo que o trio deixa a descoberto.
 */

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chaveDoStore,
  definirDiretorioCache,
  escreverNoCache,
  lerDoCache,
  obterDiretorioCache,
  sha256,
} from "../../src/roteiro/gerador/cache.js";

function cacheTmp(): string {
  return mkdtempSync(join(tmpdir(), "roteiro-cache-store-"));
}

describe("cache do gerador — o store (src/roteiro/gerador/cache.ts)", () => {
  it("obterDiretorioCache devolve o default do modulo (env ROTEIRO_CACHE_DIR ou .cache/roteiro) e passa a devolver o diretorio definido", () => {
    const esperado = process.env.ROTEIRO_CACHE_DIR ?? join(process.cwd(), ".cache", "roteiro");
    expect(obterDiretorioCache()).toBe(esperado);

    const tmp = cacheTmp();
    definirDiretorioCache(tmp);
    expect(obterDiretorioCache()).toBe(tmp);
  });

  it("escreverNoCache + lerDoCache: roundtrip, e a escrita e ATOMICA — nenhum .tmp-* sobra no diretorio (S-8)", () => {
    const diretorio = cacheTmp();
    definirDiretorioCache(diretorio);
    const chave = chaveDoStore("contrato-abc", "prompt xyz", "fp-teste");
    const saida = { pedacos: [1, 2], total: 3 };

    escreverNoCache(chave, saida);

    expect(lerDoCache(chave)).toEqual(saida);
    const arquivos = readdirSync(diretorio);
    expect(arquivos).toEqual([`${chave}.json`]); // so o arquivo final — sem tmp
    // E o arquivo no disco e exatamente o JSON da saida (o poll rele o texto).
    const conteudo = readFileSync(join(diretorio, `${chave}.json`), "utf-8");
    expect(conteudo).toBe(JSON.stringify(saida));
  });

  it("lerDoCache em arquivo AUSENTE devolve null; em arquivo CORROMPIDO devolve null (MISS — cache quebrado nunca lanca)", () => {
    const diretorio = cacheTmp();
    definirDiretorioCache(diretorio);

    expect(lerDoCache("chave-que-nao-existe")).toBeNull();

    writeFileSync(join(diretorio, "corrompido.json"), "{ quebrado !!!", "utf-8");
    expect(lerDoCache("corrompido")).toBeNull();

    writeFileSync(join(diretorio, "nao-json.json"), "apenas texto", "utf-8");
    expect(lerDoCache("nao-json")).toBeNull();
  });

  it("chaveDoStore e deterministica e distingue chave do contrato e prompt (C12): 2x = mesma; trocou qualquer lado, trocou a chave", () => {
    expect(chaveDoStore("A", "p1", "fp-teste")).toBe(chaveDoStore("A", "p1", "fp-teste"));
    expect(chaveDoStore("A", "p1", "fp-teste")).not.toBe(chaveDoStore("B", "p1", "fp-teste"));
    expect(chaveDoStore("A", "p1", "fp-teste")).not.toBe(chaveDoStore("A", "p2", "fp-teste"));
    // A composicao e sha256(contrato + ":" + sha256(prompt)): a chave final
    // e 64 hex — e o sha256 do prompt entra por dentro (prompt novo, chave nova).
    expect(chaveDoStore("A", "p1", "fp-teste")).toMatch(/^[0-9a-f]{64}$/);
    expect(chaveDoStore("A", "p1", "fp-teste")).not.toBe(sha256("A"));
    expect(chaveDoStore("A", "p1", "fp-teste")).not.toBe(sha256("p1"));
  });
});
