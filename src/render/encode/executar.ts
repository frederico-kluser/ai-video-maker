/**
 * src/render/encode/executar.ts
 *
 * O EXECUTOR do encode — o caminho completo que o pipeline (F5-01) e o
 * orquestrador (F5-07) consomem:
 *
 *   1. escolhe o motor (com fallback DECLARADO, nunca silencioso);
 *   2. adquire sessao na fila explicita (tetos do I-03: 4 NVENC + 4
 *      libx264, S-10);
 *   3. roda o ffmpeg montado pelo construtor unico (`comando.ts`);
 *   4. devolve o resultado com a declaracao de fallback e o tempo — e
 *      loga o fallback em voz alta (stderr) quando aconteceu.
 *
 * O resultado NAO e "o encode rodou": ele carrega a decisao de motor.
 * O consumidor do resultado (procedencia do F5-06, relatorio do F5-07)
 * le `resultado.fallback` — se `ativo`, o encode foi feito por OUTRO
 * perfil que nao o solicitado, e isso nunca pode sumir.
 */

import { execFile } from "node:child_process";
import type { PerfilEncode } from "./formato.js";
import { montarComando } from "./comando.js";
import {
  detectarNvenc,
  type ExecutorDeComando,
  type ResultadoDetecao,
} from "./detectar.js";
import {
  escolherPerfil,
  type DeclaracaoDeFallback,
} from "./escolher.js";
import {
  criarFilaDeEncode,
  type FilaDeEncode,
  type LimitesDaFila,
} from "./fila.js";

/** O catalogo de perfis: quem nao o recebe explicitamente usa o padrao. */
export type CatalogoDePerfis = readonly PerfilEncode[];

export interface OpcoesDeExecucao {
  /** O perfil SOLICITADO (pode virar fallback de software). */
  perfil: PerfilEncode;
  /** Entrada (arquivo de video/frames do pipeline). */
  entrada: string;
  /** Saida (.mp4). */
  saida: string;
  /** A fila explicita (default: singleton com tetos do I-03). */
  fila?: FilaDeEncode;
  /** Catalogo para o fallback (default: `listarPerfis` e caro — injete nos testes). */
  catalogo?: CatalogoDePerfis;
  /** Deteccao de NVENC (default: smoke test real de um segundo). */
  detectar?: () => Promise<ResultadoDetecao>;
  /** Executor de comandos (default: execFile). */
  executor?: ExecutorDeComando;
}

export interface ResultadoDeExecucao {
  /** O perfil SOLICITADO (o que o chamador pediu). */
  solicitado: PerfilEncode;
  /** O perfil que EFETIVAMENTE encodou (igual ao solicitado quando sem fallback). */
  perfil: PerfilEncode;
  /** A declaracao do fallback — nunca silenciosa. */
  fallback: DeclaracaoDeFallback;
  /** Tempo de parede do encode, em ms. */
  duracaoMs: number;
}

/** Executor padrao (injetavel nos testes). */
const executorPadrao: ExecutorDeComando = (comando, args) =>
  new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 600_000 }, (erro, stdout, stderr) => {
      if (erro) {
        reject(erro);
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/** Somente perfis de hardware podem precisar de deteccao (fallback hw->sw). */
export function perfilPrecisaDeDeteccao(perfil: PerfilEncode): boolean {
  return perfil.motor === "nvenc";
}

/**
 * Executa o encode de ponta a ponta: escolha com fallback declarado +
 * fila explicita + ffmpeg. Lanca se o ffmpeg falhar (exit != 0) — o
 * encode que nao sai nao devolve resultado.
 */
export async function executarEncode(
  opcoes: OpcoesDeExecucao,
): Promise<ResultadoDeExecucao> {
  const executor = opcoes.executor ?? executorPadrao;
  const fila = opcoes.fila ?? criarFilaDeEncode();
  const catalogo = opcoes.catalogo ?? [];
  const detectar = opcoes.detectar ?? (() => detectarNvenc());

  // 1. Escolha do motor — fallback declarado, nunca silencioso. A
  // deteccao de NVENC so roda quando o perfil solicitado e de hardware
  // (o smoke test de um segundo nao existe sem motivo: libx264 nao cai em
  // fallback nenhum).
  const detecao = perfilPrecisaDeDeteccao(opcoes.perfil)
    ? await detectar()
    : { nvenc: false, motivo: "motor de software nao depende de deteccao de hardware" };
  const { perfil, fallback } = escolherPerfil(
    opcoes.perfil,
    { nvenc: detecao.nvenc },
    catalogo,
  );

  if (fallback.ativo) {
    // O fallback e DECLARADO em voz alta — nunca um log de debug.
    process.stderr.write(
      `[encode] FALLBACK DECLARADO: ${fallback.solicitado} -> ${perfil.nome} (${fallback.motivo})\n`,
    );
  }

  // 2. Fila explicita — o teto do I-03 vale por motor.
  const liberar = await fila.adquirir(perfil.motor);
  try {
    // 3. O construtor unico de comando + ffmpeg. O `montarComando`
    // devolve o argv COMPLETO (argv[0] = "ffmpeg"); o contrato do
    // executor recebe (comando, args) separados.
    const argv = montarComando(perfil, opcoes.entrada, opcoes.saida);
    const inicio = performance.now();
    await executor(argv[0] ?? "ffmpeg", argv.slice(1));
    const duracaoMs = Math.round(performance.now() - inicio);

    return {
      solicitado: opcoes.perfil,
      perfil,
      fallback,
      duracaoMs,
    };
  } finally {
    liberar();
  }
}
