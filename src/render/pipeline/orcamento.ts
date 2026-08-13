// =============================================================================
// ORCAMENTO DE CONCORRENCIA E RAM — ADR-0032 (I-03) + AB-986
// =============================================================================
//
// O teto de concorrencia do pipeline e MEDIDO, nao copiado de
// documentacao (pergunta adversarial 2 do card):
//
//   workers_totais <= 8                                (ADR-0032, decisao 1)
//   RAM_estimada <= 24 GiB                             (ADR-0032, decisao 3)
//   RAM_estimada = base(1,2 GiB)
//                + (workers_totais - 1) x 0,138 GiB
//                + 1,1 GiB por encode ffmpeg simultaneo
//                + pico_gate (3,904 GiB) quando o gate roda junto
//
// O teto de RAM usa o TOTAL da maquina, nunca o MemAvailable (que oscila
// 12-13,3 GiB num host compartilhado — AB-986). O MemTotal e lido EM
// RUNTIME de /proc/meminfo (AB-986: "o F5-01 deve ler o total em runtime e
// reduzir concurrency quando MemTotal < 28 GiB"): o orcamento derruba a
// concurrency proporcionalmente quando a maquina mudar (VM, upgrade).
//
// A conversao faixa x worker (AB-988) usa workers_totais = soma dos
// workers de TODAS as arvores de render simultaneas — o numero que a
// maquina tem de caber, como mediu o I-03 (pico da ARVORE inteira).
// =============================================================================

import { readFileSync } from "node:fs";

// ─── Os numeros medidos (docs/medicao/maquina.md, ADR-0032) ────────────────────

/** Base de RAM da arvore do render com 1 worker — GiB (M1 do I-03). */
export const BASE_ARVORE_GIB = 1.2;

/** RAM marginal por worker adicional — GiB (M1 do I-03, ~138 MiB). */
export const MARGINAL_POR_WORKER_GIB = 0.138;

/** RAM de um processo ffmpeg de encode simultaneo — GiB (M1 do I-03). */
export const ENCODE_FFMPEG_GIB = 1.1;

/** Pico de RSS do gate local com 5 etapas — GiB (M5 do I-03, 3.904 MiB). */
export const PICO_GATE_GIB = 3.904;

/** Teto de RAM para render + encode + gate — GiB (ADR-0032, decisao 3). */
export const TETO_RAM_GIB = 24;

/** Teto de workers ativos de render — ADR-0032, decisao 1 (sat. 16/2). */
export const TETO_WORKERS = 8;

/** MemTotal de referencia da medicao — GiB (~31,8). */
export const MEM_TOTAL_REFERENCIA_GIB = 31.8;

/** Margem deixada para o resto do host — GiB (7,7 = 31,8 - 24). */
export const MARGEM_PARA_O_HOST_GIB = MEM_TOTAL_REFERENCIA_GIB - TETO_RAM_GIB;

// ─── O orcamento ────────────────────────────────────────────────────────────────

/** O veredito do orcamento — o que o pipeline pode lancar. */
export interface Orcamento {
  /** MemTotal da maquina lido em runtime (GiB) — AB-986. */
  readonly memTotalGiB: number;
  /** Limite de RAM para render+encode+gate — total menos a margem do host. */
  readonly limiteRamGiB: number;
  /** Total de workers ativos (todas as arvores simultaneas). */
  readonly workers: number;
  /** Arvores de render simultaneas (uma por faixa concorrente + a inteira). */
  readonly arvoresSimultaneas: number;
  /** Encode ffmpeg simultaneos (0 no caminho PNG deste card). */
  readonly encodesSimultaneos: number;
  /** `true` quando o gate local roda junto (pico do gate entra na conta). */
  readonly gateJunto: boolean;
  /** RAM estimada pela formula do ADR-0032 (GiB). */
  readonly ramEstimadaGiB: number;
  /** `true` se a RAM estimada cabe no limite. */
  readonly dentroDoTeto: boolean;
}

/** Opcoes do calculo — tudo opcional; o default e o caminho do gate. */
export interface OpcoesDoOrcamento {
  /** Workers desejados; o orcamento nunca sobe alem do teto. */
  readonly workersDesejados?: number;
  /** Arvores de render simultaneas (o custo de base e por arvore). */
  readonly arvoresSimultaneas?: number;
  /** Encode ffmpeg simultaneos. */
  readonly encodesSimultaneos?: number;
  /** `true` se o gate local roda junto (default: true — o card e um gate). */
  readonly gateJunto?: boolean;
  /** Leitor do MemTotal, injetavel para o teste. */
  readonly lerMemTotalGiB?: () => number;
}

/**
 * Le o MemTotal da maquina de /proc/meminfo em GiB — AB-986. O fallback
 * para o valor de referencia existe apenas para sistemas sem /proc/meminfo
 * (macOS); em Linux o arquivo SEMPRE existe.
 */
export function lerMemTotalGiB(): number {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf8");
    const linha = meminfo.split("\n").find((l) => l.startsWith("MemTotal:"));
    if (linha === undefined) {
      throw new Error("MemTotal ausente de /proc/meminfo");
    }
    const kib = Number.parseInt(linha.replace(/MemTotal:\s*/, ""), 10);
    if (!Number.isFinite(kib) || kib <= 0) {
      throw new Error(`MemTotal ilegivel: "${linha}"`);
    }
    return kib / (1024 * 1024);
  } catch {
    return MEM_TOTAL_REFERENCIA_GIB;
  }
}

/**
 * Calcula o orcamento. Regras (ADR-0032):
 *
 *   - workers = min(TETO_WORKERS, workersDesejados, tetoDaRam) — o teto de
 *     RAM pode derrubar a concurrency em maquinas menores (AB-986);
 *   - ramEstimada usa a formula da decisao 3 com workers_totais;
 *   - dentroDoTeto = ramEstimada <= limiteRamGiB, onde limiteRamGiB =
 *     memTotalGiB - MARGEM_PARA_O_HOST_GIB (a margem do host nunca e
 *     consumida pelo pipeline).
 */
export function calcularOrcamento(
  opcoes: OpcoesDoOrcamento = {},
): Orcamento {
  const memTotalGiB = (opcoes.lerMemTotalGiB ?? lerMemTotalGiB)();
  const limiteRamGiB = memTotalGiB - MARGEM_PARA_O_HOST_GIB;
  const gateJunto = opcoes.gateJunto ?? true;
  const arvoresSimultaneas = opcoes.arvoresSimultaneas ?? 1;
  const encodesSimultaneos = opcoes.encodesSimultaneos ?? 0;
  const desejados = Math.max(1, opcoes.workersDesejados ?? TETO_WORKERS);

  // O teto de RAM resolve o maior workers que cabe na formula.
  const tetoDaRam = (workers: number): boolean => {
    const ram =
      BASE_ARVORE_GIB * Math.min(workers, arvoresSimultaneas) +
      MARGINAL_POR_WORKER_GIB * Math.max(0, workers - 1) +
      ENCODE_FFMPEG_GIB * encodesSimultaneos +
      (gateJunto ? PICO_GATE_GIB : 0);
    return ram <= limiteRamGiB;
  };

  let workers = Math.min(TETO_WORKERS, desejados);
  while (workers > 1 && !tetoDaRam(workers)) {
    workers--;
  }
  if (!tetoDaRam(workers)) {
    throw new Error(
      `orcamento: nem 1 worker cabe no teto de RAM (memTotal ${memTotalGiB.toFixed(1)} ` +
        `GiB, limite ${limiteRamGiB.toFixed(1)} GiB) — maquina sem margem para render`,
    );
  }

  const ramEstimadaGiB =
    BASE_ARVORE_GIB * Math.min(workers, arvoresSimultaneas) +
    MARGINAL_POR_WORKER_GIB * Math.max(0, workers - 1) +
    ENCODE_FFMPEG_GIB * encodesSimultaneos +
    (gateJunto ? PICO_GATE_GIB : 0);

  return Object.freeze({
    memTotalGiB,
    limiteRamGiB,
    workers,
    arvoresSimultaneas,
    encodesSimultaneos,
    gateJunto,
    ramEstimadaGiB,
    dentroDoTeto: ramEstimadaGiB <= limiteRamGiB,
  });
}
