/**
 * src/entrega/pos/medir.ts
 *
 * O INSTRUMENTO DO GATE — card F5-03 (W8). ADR-0040, decisao 4.
 *
 * A medicao de loudness usa o **ffmpeg 6.1.1 com o filtro `ebur128`**
 * (instrumento pinado) e o node pinado — o determinismo entre versoes
 * de ferramenta e declarado por pin, nunca assumido (o mesmo padrao do
 * decoder do mix, F3-05). O pin e conferido pelo gate; este modulo so
 * sabe pedir a medicao ao executavel.
 *
 * O que mede (ADR-0040, decisao 2):
 *
 *   - **integrated loudness**: janela EBU R 128 de 400 milissegundos com gating
 *     (absolute gate -70 LUFS + relative gate -10 LU) — o `I:` do
 *     sumario do ebur128;
 *   - **true peak**: o pico REAL (oversampling 4x do ebur128), o
 *     `Peak:` do sumario com `peak=true`.
 *
 * A medicao roda sobre o ARQUIVO passado (WAV do master, ou o
 * ENTREGAVEL CODIFICADO — o ffmpeg decodifica de volta antes de medir:
 * a pergunta adversarial (2) do card).
 *
 * O parse e rigoroso na disciplina do falsifiable-gates: sumario vazio
 * ou campo ausente e ERRO (uma chave com typo devolve saida vazia com
 * exit 0 — nunca se compara valor que nao foi lido).
 */

import { execFile } from "node:child_process";

/** Uma medicao do ebur128 (EBU R 128, com gating). */
export interface MedicaoEbur128 {
  /** Loudness integrada em LUFS (janela de 400 milissegundos, gating -70/-10). */
  readonly integradoLufs: number;
  /** True peak em dBTP (oversampling do ebur128 com peak=true). */
  readonly truePeakDbtp: number;
}

/** Executor de comandos injetavel (default: execFile — o teste injeta). */
export type ExecutorDeMedicao = (
  comando: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

const executorPadrao: ExecutorDeMedicao = (comando, args) =>
  new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 300_000 }, (erro, stdout, stderr) => {
      if (erro) {
        reject(erro);
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/**
 * Mede a loudness integrada e o true peak de um arquivo de audio.
 *
 * O arquivo pode ser WAV (PCM) ou o entregavel codificado — o ffmpeg
 * decodifica o que precisar decodificar (ADR-0040 decisao 2: a
 * conferencia e no CODIFICADO, decodificado de volta).
 *
 * Lanca `EMedicaoInvalida` quando o ebur128 nao devolver o sumario —
 * medir nada e erro, nunca silencio.
 */
export async function medirLoudness(
  arquivo: string,
  executor: ExecutorDeMedicao = executorPadrao,
): Promise<MedicaoEbur128> {
  const resultado = await executor("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    arquivo,
    "-filter_complex",
    "ebur128=peak=true:framelog=quiet",
    "-f",
    "null",
    "-",
  ]);
  return parseSumarioEbur128(resultado.stderr);
}

/** Erro de parse: o sumario do ebur128 nao veio ou veio incompleto. */
export class EMedicaoInvalida extends Error {
  readonly code = "POS_MEDICAO_INVALIDA";
  constructor(problemas: string) {
    super(`medicao ebur128 invalida: ${problemas}`);
    this.name = "EMedicaoInvalida";
  }
}

/**
 * Extrai `integradoLufs` (o `I:` do sumario) e `truePeakDbtp` (o `Peak:`
 * com peak=true) da saida do ebur128.
 *
 * O ebur128 imprime o sumario no stderr, em duas secoes:
 *
 *   [Parsed_ebur128_0 @ ...]   Integrated loudness:
 *   [Parsed_ebur128_0 @ ...]     I:         -23.0 LUFS
 *   [Parsed_ebur128_0 @ ...]     Threshold: -31.2 LUFS
 *   ...
 *   [Parsed_ebur128_0 @ ...]   True peak:
 *   [Parsed_ebur128_0 @ ...]     Peak:      -19.3 dBFS
 *
 * Parse NAO-vazio antes de comparar valor: sumario ausente, campo
 * ausente ou formato inesperado sao ERRO, nunca "fora do alvo" nem
 * "dentro do alvo" (falsifiable-gates).
 */
export function parseSumarioEbur128(saida: string): MedicaoEbur128 {
  const lufs = /I:\s+(-?\d+(?:\.\d+)?)\s+LUFS/.exec(saida);
  const peak = /Peak:\s+(-?\d+(?:\.\d+)?)\s+dBFS/.exec(saida);
  if (lufs === null || peak === null) {
    const estetica = saida.trim().slice(0, 400);
    throw new EMedicaoInvalida(
      `sumario incompleto (I=${lufs === null ? "ausente" : "presente"}, ` +
        `Peak=${peak === null ? "ausente" : "presente"}). Saida:\n${estetica}`,
    );
  }
  const integradoLufs = Number.parseFloat(lufs[1]!);
  const truePeakDbtp = Number.parseFloat(peak[1]!);
  if (!Number.isFinite(integradoLufs) || !Number.isFinite(truePeakDbtp)) {
    throw new EMedicaoInvalida(`valores nao-finitos (I=${lufs[1]}, Peak=${peak[1]})`);
  }
  return { integradoLufs, truePeakDbtp };
}
