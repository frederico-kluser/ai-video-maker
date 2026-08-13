#!/usr/bin/env npx tsx
/**
 * tools/offline-guard.ts — o guarda de rede da suite offline integrada (F2-07)
 *
 * Tres subcomandos, um por problema que este card existe para resolver:
 *
 *   --sonda subprocesso
 *     Responde a pergunta adversarial "o guarda bloqueia DNS, socket e
 *     SUBPROCESSO, ou so o cliente HTTP da linguagem?". O guarda em
 *     processo (src/resolucao/rede/bloqueio.ts) nao alcanca filhos; a
 *     camada que cobre subprocesso e o namespace de rede do kernel
 *     (`unshare --net`). Esta sonda so e valida DENTRO do namespace: ela
 *     sobe um processo LIMPO (python + curl, quando presente) tentando
 *     conectar num IP literal, e exige que o kernel recuse. Fora do
 *     namespace ela FALHA em voz alta (nao "passa"): sem a camada
 *     externa, subprocesso e porta aberta.
 *
 *   --redige-cassetes
 *     Migracao unica dos cassetes JA COMMITADOS (AB-440/473/475, decisao
 *     do ADR-0026): remove de `chamadas.json` os headers volateis de
 *     resposta (HEADERS_VOLATEIS em src/resolucao/cassete/formato.ts),
 *     inclusive `x-client-ip` — PII do endereco de quem gravou. A partir
 *     daqui o GRAVADOR nao os grava; este comando limpa o que ja estava
 *     la. Idempotente e puro: so toca `headersResposta` de cada chamada;
 *     corpo, hash e demais arquivos ficam intocados.
 *
 *   --verifica-cassetes
 *     Tripwire de disco: percorre cada `chamadas.json` sob
 *     `fixtures/cassetes/` (qualquer estagio, qualquer chave) e
 *     exige que nenhuma chamada carregue um dos HEADERS_VOLATEIS. Sai 1
 *     se achar — um cassete regravado por ferramenta antiga nao passa
 *     por aqui em silencio.
 *
 * Uso:
 *   npx tsx tools/offline-guard.ts --sonda subprocesso
 *   npx tsx tools/offline-guard.ts --redige-cassetes
 *   npx tsx tools/offline-guard.ts --verifica-cassetes
 */

import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import {
  ARQUIVO_CHAMADAS,
  HEADERS_VOLATEIS,
  RAIZ_CASSETES_PADRAO,
  serializarCanonico,
} from "../src/resolucao/cassete/formato.js";
import type { ChamadaGravada } from "../src/resolucao/cassete/formato.js";

/** IP literal externo para as sondas: sem DNS no caminho (1.1.1.1:443). */
const IP_EXTERNO = "1.1.1.1";
const PORTA_EXTERNA = 443;

/**
 * Sinais de "o kernel recusou a saida", nas duas linguagens que a sonda
 * usa: nomes de erro do Node e a mensagem do python (OSError: [Errno N]).
 * Errno 101 = ENETUNREACH, 110 = ETIMEDOUT, 113 = EHOSTUNREACH.
 */
const PADROES_BLOQUEIO = [
  /ENETUNREACH|EHOSTUNREACH|ENETDOWN|EADDRNOTAVAIL/,
  /Errno (101|110|113)|Network is unreachable|No route to host/,
  /Failed to connect|Couldn't connect|Connection timed out|Connection refused/,
];

const TIMEOUT_MS = 8000;

// ─── Sonda de subprocesso ───────────────────────────────────────────────────────

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Roda um comando e devolve o texto de erro, ou null se ele "funcionou". */
function rodar(comando: string, args: readonly string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      comando,
      [...args],
      { timeout: TIMEOUT_MS },
      (erro, stdout, stderr) => {
        if (erro === null) {
          resolve(null); // o filho conseguiu sair — sonda reprovou
          return;
        }
        // A ULTIMA linha do stderr: o python imprime o Traceback inteiro
        // e a excecao real (com o codigo de erro do kernel) na ultima.
        const linhas = `${stderr || stdout || String(erro)}`
          .trim()
          .split("\n")
          .filter(Boolean);
        const detalhe = linhas.at(-1) ?? "sem detalhe";
        resolve(detalhe.slice(0, 160));
      },
    );
  });
}

/**
 * Prova que um subprocesso LIMPO nao consegue sair do namespace.
 *
 * O processo filho NAO carrega o guarda em processo — ele mede so o
 * kernel. Criterio: conexao a IP literal tem de morrer com codigo de
 * bloqueio de rede. Conexao que abre, timeout sem erro, ou erro de outra
 * classe (ex.: TLS) reprovam: cada um deles significa que o filho
 * ALCANCOU a rede.
 */
export async function sondaSubprocesso(): Promise<number> {
  console.log(
    `sonda [subprocesso]: filhos LIMPOS tentando ${IP_EXTERNO}:${PORTA_EXTERNA} ` +
      `(IP literal, sem DNS)`,
  );
  let falhas = 0;

  // 1. python3 — sempre presente na toolchain do projeto.
  const python = process.env["PYTHON_BIN"] ?? "python3";
  const script = [
    "import socket,sys",
    "s=socket.socket()",
    "s.settimeout(5)",
    `s.connect(("${IP_EXTERNO}", ${PORTA_EXTERNA}))`,
    "s.close()",
  ].join(";");
  const detalhePython = await rodar(python, ["-c", script]);
  if (detalhePython !== null && PADROES_BLOQUEIO.some((p) => p.test(detalhePython as string))) {
    console.log(`[PASSOU] python  -> kernel recusou (${detalhePython})`);
  } else if (detalhePython === null) {
    falhas++;
    console.log("[FALHOU] python  -> a conexao ABRIU num processo limpo");
  } else {
    falhas++;
    console.log(`[FALHOU] python  -> erro de outra classe: ${detalhePython}`);
  }

  // 2. curl — quando presente; ausencia e VERMELHO, nao "pulado".
  const temCurl = await rodar("curl", ["--version"]).then(
    (d) => d === null,
    () => false,
  );
  if (temCurl) {
    const detalheCurl = await rodar("curl", [
      "--connect-timeout",
      "5",
      `https://${IP_EXTERNO}/`,
    ]);
    if (
      detalheCurl !== null &&
      PADROES_BLOQUEIO.some((p) => p.test(detalheCurl as string))
    ) {
      console.log(
        `[PASSOU] curl    -> kernel recusou (${(detalheCurl as string).slice(0, 80)})`,
      );
    } else if (detalheCurl === null) {
      falhas++;
      console.log("[FALHOU] curl    -> o download ABRIU num processo limpo");
    } else {
      falhas++;
      console.log(`[FALHOU] curl    -> erro de outra classe: ${detalheCurl}`);
    }
  } else {
    falhas++;
    console.log("[FALHOU] curl    -> ferramenta ausente no PATH (vermelho, nao pulado)");
  }

  if (falhas > 0) {
    console.log(`[FALHOU] ${falhas} sonda(s) de subprocesso nao bloqueadas`);
    console.log("         Sem namespace de rede, subprocesso e porta aberta:");
    console.log("         o guarda em processo nao alcanca filhos.");
    return 1;
  }
  console.log(
    "         o namespace do kernel vale para o processo E para todo subprocesso",
  );
  return 0;
}

// ─── Migracao e tripwire dos cassetes ───────────────────────────────────────────

/** Todos os `chamadas.json` sob a raiz de cassetes. */
async function listarChamadasJson(raiz: string): Promise<string[]> {
  const saida: string[] = [];
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
      else if (entrada.isFile() && entrada.name === ARQUIVO_CHAMADAS) {
        saida.push(completo);
      }
    }
  }
  await andar(raiz);
  return saida.sort();
}

/** Remove os headers volateis de uma chamada gravada (imutavel). */
export function chamadaSemVolateis(chamada: ChamadaGravada): ChamadaGravada {
  const headersResposta: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(chamada.headersResposta)) {
    if (HEADERS_VOLATEIS.includes(chave.toLowerCase())) continue;
    headersResposta[chave] = valor;
  }
  return { ...chamada, headersResposta };
}

/**
 * Remove os headers volateis de todos os cassetes commitados.
 *
 * Idempotente: uma segunda execucao nao muda byte nenhum. Devolve o
 * relatorio linha a linha (arquivo, quantos headers removidos, quais).
 */
export async function redigirCassetes(
  raiz: string = RAIZ_CASSETES_PADRAO,
): Promise<{ ok: boolean; linhas: string[] }> {
  const linhas: string[] = [];
  const arquivos = await listarChamadasJson(raiz);
  if (arquivos.length === 0) {
    return { ok: false, linhas: ["nenhum chamadas.json encontrado — denominador zero"] };
  }

  let alterados = 0;
  for (const caminho of arquivos) {
    const bruto = await readFile(caminho, "utf-8");
    const chamadas = JSON.parse(bruto) as ChamadaGravada[];
    const limpos = chamadas.map(chamadaSemVolateis);
    const novo = serializarCanonico(limpos);
    if (novo !== bruto) {
      const removidos = chamadas
        .map((c, i) => {
          const antes = new Set(
            Object.keys(c.headersResposta).map((h) => h.toLowerCase()),
          );
          const depois = new Set(
            Object.keys(limpos[i]!.headersResposta).map((h) => h.toLowerCase()),
          );
          return [...antes]
            .filter((h) => !depois.has(h))
            .map((h) => `${c.indice}:${h}`);
        })
        .flat();
      await writeFile(caminho, novo, "utf-8");
      alterados++;
      linhas.push(
        `  ${relative(raiz, caminho)}: ${removidos.length} header(s) volateis removido(s) ` +
          `(${removidos.join(", ")})`,
      );
    }
  }
  linhas.push(
    alterados === 0
      ? `nenhum chamadas.json precisou de redacao (${arquivos.length} verificado(s))`
      : `${alterados} chamadas.json atualizado(s) de ${arquivos.length}`,
  );
  return { ok: true, linhas };
}

/**
 * Tripwire: nenhuma chamada commitada carrega header volatil.
 *
 * Per-item (ADR-0026 / contrato-w5 §10: nunca asserte a LISTA COMPLETA —
 * asserte que cada ITEM da lista esta ausente dos cassetes).
 */
export async function verificarCassetesSemVolateis(
  raiz: string = RAIZ_CASSETES_PADRAO,
): Promise<{ ok: boolean; linhas: string[] }> {
  const linhas: string[] = [];
  const arquivos = await listarChamadasJson(raiz);
  if (arquivos.length === 0) {
    return { ok: false, linhas: ["nenhum chamadas.json encontrado — denominador zero"] };
  }
  let achados = 0;
  for (const caminho of arquivos) {
    const chamadas = JSON.parse(await readFile(caminho, "utf-8")) as ChamadaGravada[];
    for (const chamada of chamadas) {
      for (const [chave] of Object.entries(chamada.headersResposta)) {
        const minuscula = chave.toLowerCase();
        if (HEADERS_VOLATEIS.includes(minuscula)) {
          achados++;
          linhas.push(
            `  [VAZOU] ${relative(raiz, caminho)} chamada ${chamada.indice}: ` +
              `header "${chave}" presente`,
          );
        }
      }
    }
  }
  linhas.push(
    achados === 0
      ? `nenhum header volatil nos ${arquivos.length} chamadas.json (${HEADERS_VOLATEIS.length} na lista)`
      : `${achados} header(s) volatil(is) nos cassetes — regrave com o gravador atual ou rode --redige-cassetes`,
  );
  return { ok: achados === 0, linhas };
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const sonda = argumento("--sonda");
  if (sonda === "subprocesso") return sondaSubprocesso();

  if (process.argv.includes("--redige-cassetes")) {
    const resultado = await redigirCassetes();
    for (const linha of resultado.linhas) console.log(linha);
    return resultado.ok ? 0 : 1;
  }
  if (process.argv.includes("--verifica-cassetes")) {
    const resultado = await verificarCassetesSemVolateis();
    for (const linha of resultado.linhas) console.log(linha);
    return resultado.ok ? 0 : 1;
  }

  console.error(
    "uso: npx tsx tools/offline-guard.ts --sonda subprocesso | " +
      "--redige-cassetes | --verifica-cassetes",
  );
  return 2;
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("offline-guard: erro inesperado:", erro);
    process.exit(2);
  },
);
