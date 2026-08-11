/**
 * tests/resolucao/rede-bloqueada.test.ts
 *
 * PERGUNTA ADVERSARIAL 1 — "a suite offline de fato bloqueia a rede, ou
 * so nao a usa? Prove com um estagio que tenta sair."
 *
 * Este arquivo e a prova. Ele nao afirma "ninguem chamou fetch"; ele
 * chama, de cinco jeitos diferentes, e exige que cada um morra com
 * `REDE BLOQUEADA` — nao com um erro de rede qualquer.
 *
 * O ponto delicado, e o motivo de existir um servidor de loopback aqui:
 * "bloqueou" e "esta quebrado" produzem o mesmo teste verde se voce so
 * verificar que a chamada falhou. A sonda de dois lados resolve isso:
 *
 *   1. com o guarda desligado, a MESMA chamada de loopback FUNCIONA;
 *   2. com o guarda ligado, ela morre com REDE BLOQUEADA.
 *
 * Se (1) falhasse, o teste inteiro seria vacuo — e ele reprovaria.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import type { AddressInfo } from "node:net";
import {
  ERedeBloqueada,
  bloquearRede,
  liberarRede,
  redeBloqueada,
  tentativasDeSaida,
  __somenteParaSondaDoGuarda_comRedeLiberada as comRedeLiberada,
} from "src/resolucao/rede/bloqueio.js";
import type { EntradaEstagio, EstagioResolucao, SaidaEstagio } from "src/resolucao/contrato.js";
import { gravarCassete } from "src/resolucao/cassete/gravador.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Manifesto } from "src/contratos/manifesto.js";

// Host externo que nunca deve ser alcancado. `.invalid` e reservado
// (RFC 2606): se o guarda falhar, o erro sera de DNS, e o teste vai
// distinguir esse caso do bloqueio.
const HOST_EXTERNO = "alvo-proibido.invalid";
const URL_EXTERNA = `https://${HOST_EXTERNO}/recurso`;

function manifestoMinimo(): Manifesto {
  return {
    schema_version: "Manifesto.1",
    fps: 30,
    width: 1920,
    height: 1080,
    nos: [
      {
        id: "n-001",
        schema: "Cabecalho.1",
        type: "cabecalho",
        duracao_frames: 30,
        texto: "Sonda",
      },
    ],
    cenas: [{ id: "c-001", nos: ["n-001"] }],
  };
}

describe("Guarda de rede — bloqueio de verdade, nao ausencia de uso", () => {
  beforeEach(() => {
    // O setup global (tests/setup/rede-bloqueada.ts) ja instalou o
    // guarda. Reafirmamos aqui para o caso deste arquivo rodar isolado.
    if (!redeBloqueada()) bloquearRede({ permitirLoopback: false });
  });

  it("o guarda esta instalado durante toda a suite", () => {
    expect(redeBloqueada()).toBe(true);
  });

  // ─── As cinco camadas ────────────────────────────────────────────────────

  it("camada fetch: fetch() externo morre com REDE BLOQUEADA", async () => {
    await expect(fetch(URL_EXTERNA)).rejects.toThrow(/REDE BLOQUEADA \[fetch\]/);
  });

  it("camada socket: net.connect() externo morre com REDE BLOQUEADA", () => {
    expect(() => net.connect(443, HOST_EXTERNO)).toThrow(/REDE BLOQUEADA \[socket\]/);
  });

  it("camada https: https.request() externo morre com REDE BLOQUEADA", () => {
    expect(() => https.request(URL_EXTERNA)).toThrow(/REDE BLOQUEADA \[https\]/);
  });

  it("camada http: http.get() externo morre com REDE BLOQUEADA", () => {
    expect(() => http.get(`http://${HOST_EXTERNO}/x`)).toThrow(
      /REDE BLOQUEADA \[http\]/,
    );
  });

  it("camada dns: dns.promises.lookup() morre com REDE BLOQUEADA", async () => {
    await expect(dns.promises.lookup(HOST_EXTERNO)).rejects.toThrow(
      /REDE BLOQUEADA \[dns\]/,
    );
  });

  it("camada dns: dns.lookup() com callback recebe REDE BLOQUEADA", async () => {
    const erro = await new Promise<Error | null>((resolve) => {
      dns.lookup(HOST_EXTERNO, (e) => resolve(e));
    });
    expect(erro).toBeInstanceOf(ERedeBloqueada);
  });

  // ─── O erro e distinguivel de "falhou por acaso" ──────────────────────────

  it("o erro e ERedeBloqueada, com camada e destino — nao um ENOTFOUND generico", async () => {
    const erro = await fetch(URL_EXTERNA).then(
      () => null,
      (e: unknown) => e as ERedeBloqueada,
    );
    expect(erro).toBeInstanceOf(ERedeBloqueada);
    expect(erro?.code).toBe("REDE_BLOQUEADA");
    expect(erro?.camada).toBe("fetch");
    expect(erro?.destino).toContain(HOST_EXTERNO);
  });

  it("as tentativas de saida ficam registradas — 'zero chamadas' com denominador", async () => {
    const antes = tentativasDeSaida().length;
    await fetch(`${URL_EXTERNA}?probe=denominador`).catch(() => undefined);
    const depois = tentativasDeSaida();
    expect(depois.length).toBe(antes + 1);
    expect(depois[depois.length - 1]).toContain(HOST_EXTERNO);
  });
});

// ─── Sonda de dois lados: o guarda bloqueia, nao apenas quebra ──────────────

describe("Sonda do guarda — sem ele a chamada funciona, com ele nao", () => {
  let servidor: http.Server;
  let porta = 0;

  beforeAll(async () => {
    // `listen` nao e `connect`: subir servidor local nao passa pelo guarda.
    servidor = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("servidor-local-vivo");
    });
    await new Promise<void>((resolve) => {
      servidor.listen(0, "127.0.0.1", () => {
        porta = (servidor.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
  });

  it("1/2 — COM o guarda desligado, a chamada de loopback FUNCIONA", async () => {
    const corpo = await comRedeLiberada(async () => {
      const resposta = await fetch(`http://127.0.0.1:${porta}/`);
      return resposta.text();
    });
    // Se este assert falhar, todos os testes de bloqueio acima sao vacuos:
    // eles estariam medindo um ambiente sem rede, nao um guarda.
    expect(corpo).toBe("servidor-local-vivo");
  });

  it("2/2 — COM o guarda ligado, a MESMA chamada morre com REDE BLOQUEADA", async () => {
    expect(redeBloqueada()).toBe(true);
    await expect(fetch(`http://127.0.0.1:${porta}/`)).rejects.toThrow(
      /REDE BLOQUEADA/,
    );
  });

  it("o guarda restaura os originais ao ser liberado e reinstalado", async () => {
    const fetchDurante = globalThis.fetch;
    liberarRede();
    const fetchDepois = globalThis.fetch;
    expect(fetchDepois).not.toBe(fetchDurante);
    bloquearRede({ permitirLoopback: false });
    expect(globalThis.fetch).not.toBe(fetchDepois);
  });
});

// ─── O estagio que tenta sair ───────────────────────────────────────────────

describe("Estagio que tenta sair — a prova pedida pelo card", () => {
  let tmp: string;

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), "estagio-fujao-"));
  });

  afterAll(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  /** Estagio que ignora `entrada.fetch` e vai direto para o global. */
  const estagioFujao: EstagioResolucao = {
    identidade: { nome: "midia", versao: "1.0.0" },
    parametros: { provedor: "proibido" },
    async resolver(): Promise<SaidaEstagio> {
      // Exatamente o erro que um estagio da W4 pode cometer.
      await globalThis.fetch(URL_EXTERNA);
      throw new Error("inalcancavel: o guarda deveria ter derrubado a chamada");
    },
  };

  /** Estagio que usa `entrada.fetch` — o caminho certo — mas com rede real. */
  const estagioEducado: EstagioResolucao = {
    identidade: { nome: "midia", versao: "2.0.0" },
    parametros: { provedor: "proibido" },
    async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
      await entrada.fetch(URL_EXTERNA);
      throw new Error("inalcancavel: o guarda deveria ter derrubado a chamada");
    },
  };

  it("estagio que chama globalThis.fetch e derrubado pelo guarda", async () => {
    await expect(
      gravarCassete(estagioFujao, {
        raiz: join(tmp, "cassetes"),
        manifesto: manifestoMinimo(),
        diretorioTrabalho: tmp,
      }),
    ).rejects.toThrow(/REDE BLOQUEADA/);
  });

  it("estagio que usa entrada.fetch tambem e derrubado (o gravador envolve o fetch bloqueado)", async () => {
    await expect(
      gravarCassete(estagioEducado, {
        raiz: join(tmp, "cassetes"),
        manifesto: manifestoMinimo(),
        diretorioTrabalho: tmp,
      }),
    ).rejects.toThrow(/REDE BLOQUEADA/);
  });

  it("nada foi gravado em disco pelo estagio que tentou sair", async () => {
    const { readdir } = await import("node:fs/promises");
    const conteudo = await readdir(join(tmp, "cassetes")).catch(() => []);
    expect(conteudo).toEqual([]);
  });
});
