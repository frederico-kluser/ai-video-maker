/**
 * tests/integracao/resolucao/rede-guarda.test.ts
 *
 * Perguntas adversariais (1) e (4) do card F2-07:
 *
 *   (1) O guarda bloqueia DNS, socket e subprocesso, ou so o cliente
 *       HTTP da linguagem? — Aqui, as camadas EM PROCESSO: fetch,
 *       socket TCP, http.request, https.request e DNS. Cada uma TEM de
 *       morrer com a mensagem ESTAVEL "REDE BLOQUEADA" — um ENOTFOUND
 *       generico NAO serve (pode ser resolvedor quebrado, nao guarda).
 *       A camada de SUBPROCESSO nao alcanca este arquivo: filhos nao
 *       herdam o patch do processo pai, e quem cobre filhos e o
 *       namespace do kernel (tools/offline-guard.sh, sonda de
 *       subprocesso — etapa [2/9]).
 *
 *   (4) O guarda vale para o vitest INTEIRO, nao so para os testes de
 *       resolucao? — Este arquivo vive em tests/integracao/resolucao/
 *       e NAO instala guarda nenhum: ele EXIGE que o setup global
 *       (tests/setup/rede-bloqueada.ts, carregado por vitest.config.ts
 *       para toda a suite) ja esteja ativo. Se o setup sumisse, este
 *       arquivo fica vermelho — a prova de que o guarda e global.
 *
 * Decisao AB-394 (ADR-0026): o guarda continua global e com
 * permitirLoopback: false — inclusive o LOOPBACK e bloqueado aqui. O
 * teste de fontes (F1-03) renderiza em processo EXTERNO justamente por
 * isso; o guarda nao foi enfraquecido para acomodar o vizinho.
 */

import { describe, it, expect } from "vitest";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
import {
  ERedeBloqueada,
  redeBloqueada,
  tentativasDeSaida,
} from "src/resolucao/rede/bloqueio.js";

/** Host externo que nunca deve ser alcancado (RFC 2606). */
const HOST_EXTERNO = "alvo-proibido.invalid";
const IP_EXTERNO = "1.1.1.1";

describe("F2-07 — o guarda global vale para o vitest inteiro (AB-394, Q4)", () => {
  it("o guarda esta ativo neste processo, fora de tests/resolucao", () => {
    expect(redeBloqueada(), "setupFiles deve instalar o guarda antes de qualquer teste").toBe(
      true,
    );
  });

  it("fetch para host externo morre com a mensagem estavel REDE BLOQUEADA", async () => {
    const erro = await fetch(`https://${HOST_EXTERNO}/recurso`).then(
      () => null,
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ERedeBloqueada);
    expect(String(erro)).toMatch(/REDE BLOQUEADA/);
  });

  it("fetch para LOOPBACK tambem morre — o guarda nao foi enfraquecido", async () => {
    const erro = await fetch("http://127.0.0.1:9/probe").then(
      () => null,
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ERedeBloqueada);
    expect(String(erro)).toMatch(/REDE BLOQUEADA/);
  });

  it("socket TCP cru para IP literal morre na camada de socket", () => {
    expect(() => net.connect(443, IP_EXTERNO).destroy()).toThrow(/REDE BLOQUEADA/);
  });

  it("http.request morre na camada http", () => {
    expect(() => http.request(`http://${HOST_EXTERNO}/`).end()).toThrow(
      /REDE BLOQUEADA/,
    );
  });

  it("https.request morre na camada https", () => {
    expect(() => https.request(`https://${HOST_EXTERNO}/`).end()).toThrow(
      /REDE BLOQUEADA/,
    );
  });

  it("dns.lookup morre na camada dns", async () => {
    const erro = await dns.promises.lookup(HOST_EXTERNO).then(
      () => null,
      (e: unknown) => e,
    );
    expect(erro).toBeInstanceOf(ERedeBloqueada);
    expect(String(erro)).toMatch(/REDE BLOQUEADA/);
  });
});

describe("F2-07 — o denominador de tentativas existe (Q2)", () => {
  it("tentativasDeSaida() registra o que foi bloqueado neste processo", async () => {
    const antes = tentativasDeSaida().length;
    await fetch(`https://${HOST_EXTERNO}/mais-uma`).catch(() => undefined);
    expect(tentativasDeSaida().length).toBeGreaterThan(antes);
    const ultima = tentativasDeSaida().at(-1);
    expect(ultima).toMatch(/fetch/);
  });
});
