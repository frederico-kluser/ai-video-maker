/**
 * tests/integracao/resolucao/cassete-volateis.test.ts
 *
 * Decisao AB-440/AB-473/AB-475 (ADR-0026, card F2-07): headers volateis
 * de RESPOSTA (date, age, server, x-request-id, server-timing,
 * x-search-id, x-cache, x-cache-status, content-length,
 * transfer-encoding) e x-client-ip NAO entram em chamadas.json — nem
 * redigidos: REMOVIDOS NA GRAVACAO.
 *
 * Tres provas, nesta ordem:
 *
 *   1. os cassetes COMMITADOS nao carregam nenhum dos headers da lista
 *      (tripwire de disco — per-item, nunca lista fechada do que o
 *      provedor devolve);
 *   2. o gravador remove na gravacao: uma chamada com os headers
 *      plantados sai de chamadas.json sem eles (e o header SENSIVEL
 *      continua [REDIGIDO], como sempre);
 *   3. sonda negativa do diff: um header volátil que NÃO esta na lista
 *      (x-novo-volatil) tem de deixar o diff VERMELHO — a decisao
 *      "remover na gravacao" nao pode virar "ignorar o que vazar".
 */

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterAll } from "vitest";
import {
  ARQUIVO_CHAMADAS,
  HEADERS_VOLATEIS,
  RAIZ_CASSETES_PADRAO,
  removerHeadersVolateis,
  sanitizarHeaders,
  sha256,
} from "src/resolucao/cassete/formato.js";
import type { EstagioResolucao } from "src/resolucao/contrato.js";
import { GravadorDeChamadas, gravarCassete } from "src/resolucao/cassete/gravador.js";
import { diffCassetes } from "src/resolucao/cassete/diff.js";
import { lerManifesto, RAIZ } from "./helpers.js";

const TMP = await mkdtemp(join(tmpdir(), "cassete-volateis-"));
afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

/** Todos os chamadas.json commitados (denominador do tripwire). */
async function chamadasJsonCommitadas(): Promise<
  Array<{ caminho: string; chamadas: Array<Record<string, unknown>> }>
> {
  const { readdir } = await import("node:fs/promises");
  const saida: Array<{ caminho: string; chamadas: Array<Record<string, unknown>> }> = [];
  async function andar(dir: string): Promise<void> {
    let entradas;
    try {
      entradas = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entrada of entradas) {
      const completo = join(dir, entrada.name);
      if (entrada.isDirectory()) await andar(completo);
      else if (entrada.isFile() && entrada.name === "chamadas.json") {
        saida.push({
          caminho: completo,
          chamadas: JSON.parse(await readFile(completo, "utf-8")) as Array<
            Record<string, unknown>
          >,
        });
      }
    }
  }
  await andar(join(RAIZ, RAIZ_CASSETES_PADRAO));
  return saida;
}

describe("AB-440/473/475 — cassetes commitados sem header volatil", () => {
  it("nenhum chamadas.json commitado carrega header da lista (per-item)", async () => {
    const arquivos = await chamadasJsonCommitadas();
    expect(arquivos.length).toBeGreaterThan(0);
    for (const { caminho, chamadas } of arquivos) {
      for (const chamada of chamadas) {
        const headers = (chamada["headersResposta"] ?? {}) as Record<string, string>;
        for (const header of HEADERS_VOLATEIS) {
          expect(
            headers[header],
            `${caminho} chamada ${String(chamada["indice"])}: header "${header}" presente`,
          ).toBeUndefined();
        }
      }
    }
  });

  it("x-client-ip (AB-475) esta na lista de volateis", () => {
    expect(HEADERS_VOLATEIS).toContain("x-client-ip");
  });
});

describe("AB-440/473/475 — o gravador remove na gravacao", () => {
  it("registrar() grava a chamada sem os headers volateis", () => {
    const gravador = new GravadorDeChamadas();
    const gravadas = gravador.registrar({
      metodo: "GET",
      url: "https://provedor-falso.invalid/x",
      headersRequisicao: { accept: "application/json" },
      status: 200,
      headersResposta: {
        date: "Thu, 13 Aug 2026 12:07:47 GMT",
        age: "0",
        "x-client-ip": "2804:1b3:a940:dc57:91d3:f8eb:97:3916",
        "content-length": "123",
        "set-cookie": "sessao=abc123",
        "content-type": "application/json",
        "x-novo-header-estavel": "valor",
      },
      corpo: Buffer.from("corpo", "utf-8"),
    });
    expect(gravadas.headersResposta["date"]).toBeUndefined();
    expect(gravadas.headersResposta["age"]).toBeUndefined();
    expect(gravadas.headersResposta["x-client-ip"]).toBeUndefined();
    expect(gravadas.headersResposta["content-length"]).toBeUndefined();
    expect(gravadas.headersResposta["content-type"]).toBe("application/json");
    expect(gravadas.headersResposta["x-novo-header-estavel"]).toBe("valor");
    expect(gravadas.headersResposta["set-cookie"]).toBe("[REDIGIDO]");
  });

  it("removerHeadersVolateis e sanitaria (nao muta a entrada)", () => {
    const entrada: Record<string, string> = {
      date: "x",
      "content-type": "application/json",
    };
    const saida = removerHeadersVolateis(entrada);
    expect(saida).toEqual({ "content-type": "application/json" });
    expect(entrada).toEqual({ date: "x", "content-type": "application/json" });
  });

  it("uma gravacao inteira (gravarCassete) sai sem os headers volateis", async () => {
    const manifesto = lerManifesto(join(RAIZ, "fixtures", "canonico", "manifesto-valido.json"));
    const g = await gravarComResposta(join(TMP, "gravacao-simples"), manifesto, {
      date: "Thu, 13 Aug 2026 12:07:47 GMT",
      "content-type": "text/plain",
    });
    const chamadas = JSON.parse(
      await readFile(join(g.diretorio, ARQUIVO_CHAMADAS), "utf-8"),
    ) as Array<{ headersResposta: Record<string, string> }>;
    expect(chamadas[0]?.headersResposta["date"]).toBeUndefined();
    expect(chamadas[0]?.headersResposta["content-type"]).toBe("text/plain");
  });
});

describe("AB-440/473 — sonda negativa: volátil fora da lista deixa o diff VERMELHO", () => {
  it("um header fora da lista que muda entre gravacoes REFUTA o diff", async () => {
    const manifesto = lerManifesto(join(RAIZ, "fixtures", "canonico", "manifesto-valido.json"));
    const raizA = join(TMP, "sonda-a");
    const raizB = join(TMP, "sonda-b");

    const a = await gravarComResposta(raizA, manifesto, { "x-novo-volatil": "1" });
    const b = await gravarComResposta(raizB, manifesto, { "x-novo-volatil": "2" });

    const diff = await diffCassetes(a.diretorio, b.diretorio);
    expect(diff.refutacoes).toBeGreaterThan(0);
    const achada = diff.diferencas.find((d) =>
      String(d.campo).includes("headersResposta.x-novo-volatil"),
    );
    expect(achada, "a refutacao nomeia o header que vazou").toBeDefined();
  });

  it("o MESMO estagio com header da lista grava identico (controle)", async () => {
    const manifesto = lerManifesto(join(RAIZ, "fixtures", "canonico", "manifesto-valido.json"));
    const raizA = join(TMP, "controle-a");
    const raizB = join(TMP, "controle-b");

    const a = await gravarComResposta(raizA, manifesto, {
      date: "2026-01-01",
      "x-client-ip": "2001:db8::1",
    });
    const b = await gravarComResposta(raizB, manifesto, {
      date: "2026-06-01",
      "x-client-ip": "2001:db8::2",
    });

    const diff = await diffCassetes(a.diretorio, b.diretorio);
    expect(diff.refutacoes).toBe(0);
  });

  it("sanitizarHeaders + removerHeadersVolateis sao composiveis", () => {
    const limpo = removerHeadersVolateis(
      sanitizarHeaders({ authorization: "Bearer segredo", date: "x", "content-type": "a/b" }),
    );
    expect(limpo).toEqual({ authorization: "[REDIGIDO]", "content-type": "a/b" });
  });
});

// ---------------------------------------------------------------------------
// Estagio falso para gravacao: devolve uma resposta com headers escolhidos
// ---------------------------------------------------------------------------

/**
 * Grava o estagio falso com uma resposta cujos headers sao `escolhidos`.
 *
 * O `fetchReal` devolve a resposta plantada sem tocar na rede — com o
 * guarda global ativo, o fetch real lancaria ERedeBloqueada.
 */
async function gravarComResposta(
  raiz: string,
  manifesto: unknown,
  escolhidos: Record<string, string>,
) {
  const estagioFalso: EstagioResolucao = {
    identidade: { nome: "codigo", versao: "9.9.9-teste-volateis" },
    parametros: { sonda: "headers" },
    async resolver(entrada) {
      await entrada.fetch("https://provedor-falso.invalid/x", { method: "GET" });
      return {
        parcial: {
          assets: {
            [sha256("corpo-da-resposta")]: {
              hash: sha256("corpo-da-resposta"),
              tipo: "dados",
              licenca: "CC0-1.0",
              atribuicaoObrigatoria: false,
              provedor: "falso",
            },
          },
          nos_codigo: { "n-sonda": sha256("corpo-da-resposta") },
        },
        procedencia: {
          licenca: "CC0-1.0",
          provedor: "falso",
          assets: [],
        },
      };
    },
  };
  return gravarCassete(estagioFalso, {
    raiz,
    manifesto: manifesto as never,
    diretorioTrabalho: TMP,
    fetchReal: () =>
      Promise.resolve(
        new Response("corpo-da-resposta", {
          status: 200,
          headers: new Headers(escolhidos),
        }),
      ),
  });
}
