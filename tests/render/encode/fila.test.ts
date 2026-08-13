/**
 * tests/render/encode/fila.test.ts
 *
 * A FILA EXPLICITA DE SESSOES (S-10; teto do I-03: 4 NVENC + 4 libx264,
 * ADR-0032 decisao 2). Os limites sao injetaveis — aqui o teto de teste
 * e 1 por motor, para exercitar o bloqueio sem gastar encodes reais.
 *
 *   1. O teto: adquirir alem do limite BLOQUEIA (promise pendente) — o
 *      "nunca lancar mais que o teto" da fila explicita, por construcao.
 *   2. A liberacao acorda o proximo da fila (FIFO), na ordem de chegada.
 *   3. Os limites sao POR MOTOR: fila de NVENC cheia nao segura libx264.
 *   4. A liberacao e chamada no maximo uma vez por adquirente; liberar
 *      quando nao ha sessao propria nao derruba a fila (defensivo).
 */

import { describe, expect, it } from "vitest";
import {
  criarFilaDeEncode,
  type FilaDeEncode,
} from "src/render/encode/fila.js";
import { LIMITES_PADRAO } from "src/render/encode/formato.js";

/** Espera pequena para conferir que uma promise NAO resolveu. */
async function permanecePendente(promise: Promise<unknown>): Promise<boolean> {
  let resolveu = false;
  const marcador = promise.then(
    () => {
      resolveu = true;
    },
    () => {
      resolveu = true;
    },
  );
  // Race contra um timeout: se a promise resolver, resolveu=true; se
  // nao, o timeout vence e a promise continua pendente — a assercao.
  await Promise.race([marcador, new Promise((r) => setTimeout(r, 25))]);
  return !resolveu;
}

describe("criarFilaDeEncode — fila explicita com teto por motor", () => {
  it("o default de limites e o teto medido no I-03: 4 NVENC + 4 libx264", () => {
    const fila = criarFilaDeEncode();
    expect(fila.limites.nvenc).toBe(LIMITES_PADRAO.nvenc);
    expect(fila.limites.libx264).toBe(LIMITES_PADRAO.libx264);
  });

  it("adquirir alem do teto BLOQUEIA — o quinto NVENC espera (nunca 5 sessoes)", async () => {
    const fila: FilaDeEncode = criarFilaDeEncode({ nvenc: 1, libx264: 4 });
    const liberar1 = await fila.adquirir("nvenc");
    expect(fila.ocupados("nvenc")).toBe(1);

    const quinto = fila.adquirir("nvenc");
    expect(fila.esperando("nvenc")).toBe(1);
    expect(await permanecePendente(quinto)).toBe(true);

    liberar1();
    const liberar2 = await quinto; // acordou depois da liberacao
    expect(fila.ocupados("nvenc")).toBe(1);
    liberar2();
    expect(fila.ocupados("nvenc")).toBe(0);
  });

  it("a fila e FIFO: o proximo da ordem de chegada acorda primeiro", async () => {
    const fila = criarFilaDeEncode({ nvenc: 1, libx264: 4 });
    const liberarA = await fila.adquirir("nvenc");
    const ordem: string[] = [];
    const pedidoB = fila.adquirir("nvenc").then((lib) => {
      ordem.push("B");
      return lib;
    });
    const pedidoC = fila.adquirir("nvenc").then((lib) => {
      ordem.push("C");
      return lib;
    });
    expect(fila.esperando("nvenc")).toBe(2);

    liberarA();
    const liberarB = await pedidoB;
    expect(ordem).toEqual(["B"]);
    expect(fila.esperando("nvenc")).toBe(1);
    liberarB();
    const liberarC = await pedidoC;
    expect(ordem).toEqual(["B", "C"]);
    liberarC();
  });

  it("os limites sao POR MOTOR: NVENC cheio nao segura libx264", async () => {
    const fila = criarFilaDeEncode({ nvenc: 1, libx264: 1 });
    const liberarNvenc = await fila.adquirir("nvenc");

    // O segundo NVENC espera...
    const segundoNvenc = fila.adquirir("nvenc");
    expect(await permanecePendente(segundoNvenc)).toBe(true);

    // ...mas o libx264 passa (o teto dele esta livre).
    const liberarX264 = await fila.adquirir("libx264");
    expect(fila.ocupados("libx264")).toBe(1);

    liberarNvenc();
    const liberarNvenc2 = await segundoNvenc;
    liberarNvenc2();
    liberarX264();
    expect(fila.ocupados("nvenc")).toBe(0);
    expect(fila.ocupados("libx264")).toBe(0);
  });

  it("liberar sem sessao propria nao derruba a fila (defensivo)", async () => {
    const fila = criarFilaDeEncode({ nvenc: 1, libx264: 4 });
    const liberar = await fila.adquirir("nvenc");
    liberar();
    // segunda chamada da mesma liberacao: nao pode derrubar o contador.
    liberar();
    expect(fila.ocupados("nvenc")).toBe(0);
    // e a fila continua funcional
    const liberar2 = await fila.adquirir("nvenc");
    expect(fila.ocupados("nvenc")).toBe(1);
    liberar2();
  });
});
