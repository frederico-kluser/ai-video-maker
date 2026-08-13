/**
 * src/render/encode/detectar.ts
 *
 * DETECCAO DE NVENC — prova por encode real de 1 segundo, nunca por
 * presenca de driver nem por listagem de encoders (C8 das "12 ferramentas
 * que mentem": `nvidia-smi` presente != encoder disponivel para o
 * processo; ffmpeg-media-ops: `ffmpeg -encoders | grep nvenc` lista o
 * encoder compilado no build mesmo sem GPU — a inicializacao so falha na
 * hora do encode, AB-008).
 *
 * A sonda e a mesma metodologia do I-03 (docs/medicao/maquina.md, M3):
 * um encode curto sintetico com `h264_nvenc`. Se ele inicializa e sai com
 * exit 0, o NVENC esta disponivel; qualquer falha (exit != 0, excecao de
 * processo) devolve `nvenc: false` com o motivo — e quem escolhe o motor
 * usa esse resultado para declarar o fallback (nunca em silencio).
 *
 * A sonda e curta (um segundo, 320x180, lavfi — sem disco, sem rede) e roda em
 * /tmp: o teto de disco do ADR-0032 (decisao 4) manda saidas de trabalho
 * para fora do filesystem do repo.
 */

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─── Tipos ───────────────────────────────────────────────────────────────────

/** O resultado de uma execucao de comando, injetavel nos testes. */
export interface ResultadoDeComando {
  stdout: string;
  stderr: string;
}

/** Executor de comandos injetavel (default: execFile do node). */
export type ExecutorDeComando = (
  comando: string,
  args: string[],
) => Promise<ResultadoDeComando>;

export interface ResultadoDetecao {
  /** Verdadeiro quando o smoke test de um segundo inicializou o encoder. */
  nvenc: boolean;
  /** O motivo da decisao (nunca vazio — a decisao e sempre declarada). */
  motivo: string;
}

// ─── Defaults e constantes ───────────────────────────────────────────────────

/** A sonda de um segundo: mesma metodologia do I-03 (testsrc2, 320x180@30). */
export const SMOKE_TEST_ARGS: readonly string[] = [
  "-y",
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=320x180:rate=30:duration=1",
  "-c:v",
  "h264_nvenc",
  "-preset",
  "p5",
  "-pix_fmt",
  "yuv420p",
  "-fflags",
  "+bitexact",
  "-flags",
  "+bitexact",
  "-map_metadata",
  "-1",
];

const executorDefault: ExecutorDeComando = (comando, args) =>
  new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 15_000 }, (erro, stdout, stderr) => {
      if (erro) {
        reject(erro);
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/**
 * Detecta NVENC com um encode real de um segundo.
 *
 * `executor` e `dirTemporario` sao injetaveis para os testes: a sonda
 * nunca deve ser falsificada por ambiente — nos testes o executor fake
 * decide a disponibilidade e o teste do ∅-crit exige que o caminho do
 * falso (falha do executor) produza `nvenc: false` com motivo declarado.
 */
export async function detectarNvenc(opcoes: {
  executor?: ExecutorDeComando;
  dirTemporario?: string;
} = {}): Promise<ResultadoDetecao> {
  const executor = opcoes.executor ?? executorDefault;
  const base = opcoes.dirTemporario ?? tmpdir();
  let dir: string | undefined;
  try {
    dir = await mkdtemp(join(base, "f5-02-nvenc-probe-"));
    const saida = join(dir, `probe-${randomBytes(4).toString("hex")}.mp4`);
    const argv = [...SMOKE_TEST_ARGS, "-f", "mp4", saida];
    await executor("ffmpeg", argv);
    return {
      nvenc: true,
      motivo: "smoke test de um segundo com h264_nvenc inicializou e saiu com exit 0 (C8)",
    };
  } catch (erro) {
    const detalhe =
      erro instanceof Error ? erro.message.split("\n")[0] ?? erro.message : String(erro);
    return {
      nvenc: false,
      motivo: `smoke test de um segundo com h264_nvenc FALHOU: ${detalhe} — NVENC tratado como indisponivel (C8: presenca de driver nao prova encoder)`,
    };
  } finally {
    if (dir !== undefined) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
