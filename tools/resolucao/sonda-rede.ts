#!/usr/bin/env npx tsx
/**
 * tools/resolucao/sonda-rede.ts
 *
 * A sonda que responde "bloqueada ou apenas nao usada?".
 *
 * Duas camadas, medidas separadamente porque falham de jeitos diferentes:
 *
 *   --camada kernel
 *     Conecta num ENDERECO IP LITERAL (1.1.1.1:443). Sem DNS no caminho:
 *     um ENOTFOUND provaria que a resolucao de nome falhou, nao que a
 *     rede esta fechada — e resolvedor quebrado e um estado comum de
 *     container. Com o namespace ativo, o kernel devolve ENETUNREACH
 *     imediatamente. Sem ele, a conexao ABRE, e a sonda reprova.
 *
 *   --camada processo
 *     Instala o guarda em processo e exige que fetch, socket e http
 *     morram com a mensagem estavel `REDE BLOQUEADA`. Aqui o criterio e
 *     a mensagem, nao "deu erro": qualquer erro serviria para um teste
 *     frouxo, e e assim que uma suite passa a medir o ambiente em vez do
 *     guarda.
 *
 * Uso:
 *   npx tsx tools/resolucao/sonda-rede.ts --camada kernel
 *   npx tsx tools/resolucao/sonda-rede.ts --camada processo
 */

import net from "node:net";
import {
  ERedeBloqueada,
  bloquearRede,
} from "../../src/resolucao/rede/bloqueio.js";

/** Endereco IP literal e porta que dispensam DNS. */
const IP_EXTERNO = "1.1.1.1";
const PORTA_EXTERNA = 443;

/** Codigos que significam "o kernel nao deixou sair". */
const CODIGOS_BLOQUEIO = new Set([
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ENETDOWN",
  "EACCES",
  "EPERM",
  "EADDRNOTAVAIL",
]);

const TIMEOUT_MS = 5000;

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ─── Camada do kernel ───────────────────────────────────────────────────────────

async function sondarKernel(): Promise<number> {
  console.log(
    `sonda [kernel]: conectando em ${IP_EXTERNO}:${PORTA_EXTERNA} (IP literal, sem DNS)`,
  );

  const resultado = await new Promise<{ ok: boolean; detalhe: string }>((resolve) => {
    const socket = net.connect(PORTA_EXTERNA, IP_EXTERNO);
    const encerrar = (r: { ok: boolean; detalhe: string }) => {
      socket.destroy();
      resolve(r);
    };
    socket.on("error", (erro: NodeJS.ErrnoException) => {
      const codigo = erro.code ?? "SEM_CODIGO";
      encerrar({
        ok: CODIGOS_BLOQUEIO.has(codigo),
        detalhe: codigo,
      });
    });
    socket.on("connect", () =>
      encerrar({ ok: false, detalhe: "a conexao ABRIU" }),
    );
    setTimeout(
      () => encerrar({ ok: false, detalhe: `sem resposta em ${TIMEOUT_MS}ms` }),
      TIMEOUT_MS,
    ).unref();
  });

  if (resultado.ok) {
    console.log(`[PASSOU] o kernel recusou a saida: ${resultado.detalhe}`);
    return 0;
  }
  console.log(`[FALHOU] a saida NAO foi bloqueada pelo kernel: ${resultado.detalhe}`);
  console.log(
    "         'a suite nao usa a rede' e diferente de 'a rede esta bloqueada'.",
  );
  return 1;
}

// ─── Camada do processo ─────────────────────────────────────────────────────────

async function sondarProcesso(): Promise<number> {
  console.log("sonda [processo]: instalando o guarda e tentando sair de tres jeitos");
  bloquearRede({ permitirLoopback: false });

  let falhas = 0;

  // 1. fetch
  const erroFetch = await fetch("https://alvo-proibido.invalid/x").then(
    () => null,
    (e: unknown) => e,
  );
  if (erroFetch instanceof ERedeBloqueada) {
    console.log("[PASSOU] fetch  -> REDE BLOQUEADA");
  } else {
    falhas++;
    console.log(
      `[FALHOU] fetch  -> ${erroFetch === null ? "PASSOU pela rede" : String(erroFetch).slice(0, 60)}`,
    );
  }

  // 2. socket TCP com IP literal (nao depende de DNS)
  try {
    net.connect(PORTA_EXTERNA, IP_EXTERNO).destroy();
    falhas++;
    console.log("[FALHOU] socket -> a conexao nao foi interceptada");
  } catch (erro) {
    if (erro instanceof ERedeBloqueada) {
      console.log("[PASSOU] socket -> REDE BLOQUEADA");
    } else {
      falhas++;
      console.log(`[FALHOU] socket -> erro inesperado: ${String(erro).slice(0, 60)}`);
    }
  }

  // 3. DNS
  const erroDns = await import("node:dns").then((dns) =>
    dns.promises.lookup("alvo-proibido.invalid").then(
      () => null,
      (e: unknown) => e,
    ),
  );
  if (erroDns instanceof ERedeBloqueada) {
    console.log("[PASSOU] dns    -> REDE BLOQUEADA");
  } else {
    falhas++;
    console.log(
      `[FALHOU] dns    -> ${erroDns === null ? "resolveu" : String(erroDns).slice(0, 60)}`,
    );
  }

  if (falhas > 0) {
    console.log(`[FALHOU] ${falhas} camada(s) do guarda em processo nao responderam`);
    return 1;
  }
  return 0;
}

// ─── Main ───────────────────────────────────────────────────────────────────────

const camada = argumento("--camada") ?? "processo";
const executar =
  camada === "kernel"
    ? sondarKernel
    : camada === "processo"
      ? sondarProcesso
      : null;

if (executar === null) {
  console.error(`sonda-rede: --camada desconhecida: ${camada} (use kernel|processo)`);
  process.exit(2);
}

executar().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("sonda-rede: erro inesperado:", erro);
    process.exit(2);
  },
);
