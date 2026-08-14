/**
 * src/entrega/pos/index.ts
 *
 * O POS-PROCESSAMENTO DE ENTREGA — card F5-03 (W8, caminho critico).
 * ADR-0040 + contrato-w8 §2.
 *
 * O que este modulo faz, no fluxo da entrega:
 *
 *   1. MEDE o master do mix (F3-05) com o instrumento pinado (ffmpeg
 *      6.1.1, filtro ebur128 — `medir.ts`): loudness integrada e true
 *      peak;
 *   2. COMPUTA o ganho pela estrategia de `normalizar.ts` (uma
 *      aplicacao — pergunta adversarial 1) e aplica UMA vez nos bytes;
 *   3. CODIFICA o master normalizado em AAC (m4a) com o perfil de audio
 *      do pos (`perfil-audio.ts`, deterministico: true — so perfis
 *      deterministico: true participam da comparacao, contrato-w8 §2) e
 *      a FILA INJETADA (instancia do card, criada por `criarFilaDeEncode`
 *      do F5-02 — a dona da fila compartilhada do processo e a F5-07,
 *      AB-705);
 *   4. CONFERE no entregavel CODIFICADO, decodificado de volta
 *      (pergunta adversarial 2; ADR-0040 decisao 2): loudness integrada
 *      dentro do alvo ±0,3 LU e true peak dentro do teto -1.0 dBTP
 *      (±0,3 LU de tolerancia de medicao aplicada a leitura) — um
 *      entregavel fora do alvo NAO EXISTE (∅-crit original: a guarda
 *      lança, a entrega falha);
 *   5. GERA o sidecar SRT do MESMO documento LegendasCanonicas.1 lido
 *      via `lerLegendas` (ADR-0027 — ∅-crit (a)), RECONCILIADO com o
 *      mix (C1, `reconciliarComOMix`): o SRT descreve a timeline
 *      POS-reconciliacao — cue que cruza um corte do mix e truncada no
 *      corte, menos de 1 frame visivel e removida, nenhuma cue sobrepoe
 *      a vizinha. Confere a coerencia com a queimada (∅-crit (b):
 *      inicio_s coincide ONDE a queimada existe; duracao total NUNCA e
 *      comparada — no CASO C1 da fixture o corte do mix em 18,233 s
 *      coincide com o fim da janela: a queimada morre onde o sidecar
 *      morre);
 *   6. REGISTRA tudo no PosDocument.1 (`formato.ts`): alvo, ganho,
 *      medicoes, sidecar e o pin das ferramentas (ffmpeg 6.1.1 + node —
 *      `just pos` falha se a versao corrente divergir do pin).
 *
 * O determinismo do veredito e em MEDIDA (loudness), nunca em bytes do
 * entregavel: o encoder muda entre versoes e bytes nao sao oraculo
 * (AB-396/397, ADR-0035 — decisao 2 do ADR-0040).
 */

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { targetLufs, maxTruePeakDbtp } from "../../design/tokens.js";
import type { ContextoDeLegendas } from "../../sincronia/legendas/validar.js";
import { lerLegendas } from "../../sincronia/legendas/validar.js";
import { criarFilaDeEncode } from "../../render/encode/fila.js";
import type { FilaDeEncode } from "../../render/encode/fila.js";
import { medirLoudness } from "./medir.js";
import type { ExecutorDeMedicao } from "./medir.js";
import { aplicarGanhoNoMaster, computarGanho } from "./normalizar.js";
import type { GanhoComputado } from "./normalizar.js";
import { montarComandoAudio } from "./perfil-audio.js";
import { PERFIL_AUDIO_POS } from "./perfil-audio.js";
import {
  conferirCoerenciaDaQueimada,
  conferirSidecar,
  reconciliarComOMix,
  serializarSrt,
} from "./sidecar.js";
import type { FalaReconciliada, JanelaVisualDaCena } from "./sidecar.js";
import { FORMATO_POS, sha256Bytes } from "./formato.js";
import type { AlvoDoPos, PosDocument } from "./formato.js";

// ─── As constantes do ADR-0040 ────────────────────────────────────────────────

/** Tolerancia de medicao ±0,3 LU (ADR-0040, decisao 2). */
export const TOLERANCIA_MEDICAO_LU = 0.3;

/** Margem de overshoot de codec (AAC) 1,0 dB (ADR-0040, decisao 3). */
export const MARGEM_OVERSHOOT_DB = 1.0;

/** Pin do instrumento: ffmpeg 6.1.1 (ADR-0040, decisao 4). */
export const PIN_FFMPEG = "6.1.1";

/** Tolerancia da checagem de overshoot contra a margem (arredondamento). */
export const TOLERANCIA_OVERSHOOT_DB = 0.05;

/**
 * O alvo do gate: LIDO dos tokens (S-5, leitura — o gate nunca duplica
 * o numero; se o token mudar, o gate segue o token, ADR-0040 decisao 1)
 * + as constantes do ADR-0040.
 */
export function alvoDoPos(): AlvoDoPos {
  return {
    targetLufs,
    maxTruePeakDbtp,
    toleranciaMedicaoLu: TOLERANCIA_MEDICAO_LU,
    margemOvershootDb: MARGEM_OVERSHOOT_DB,
  };
}

// ─── Versoes (o pin) ──────────────────────────────────────────────────────────

/** Versao do ffmpeg local — o pin do determinismo (parse da 1a linha). */
export async function versaoDoFfmpeg(
  executor: ExecutorDeMedicao = executorPadrao,
): Promise<string> {
  const saida = await executor("ffmpeg", ["-version"]);
  const m = /^ffmpeg version (\S+)/.exec(saida.stdout);
  if (m === null) throw new Error(`nao reconheci a versao do ffmpeg:\n${saida.stdout}`);
  return m[1]!;
}

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

// ─── Entradas e saidas ────────────────────────────────────────────────────────

/** Opcoes do pos — tudo que o card precisa para produzir a entrega. */
export interface OpcoesDoPos {
  /** Bytes do master do mix (WAV f32le 48 kHz estereo — F3-05). */
  readonly masterBytes: Buffer;
  /** Bytes do documento LegendasCanonicas.1 (o sidecar nasce dele). */
  readonly documentoLegendasBytes: Buffer;
  /** Contexto do oraculo de legendas (manifesto + timing — F3-02). */
  readonly contextoLegendas: ContextoDeLegendas;
  /**
   * Os intervalos em que a fala de cada cena REALMENTE toca no master —
   * a reconciliacao do mix (C1, `faixas.locucao` do MixDocument.1). O
   * sidecar descreve a timeline POS-reconciliacao: cue que cruza um
   * corte e truncada no corte; menos de 1 frame visivel e removida;
   * nenhuma cue sobrepoe a vizinha (reconciliarComOMix).
   */
  readonly intervalosDeFala: readonly FalaReconciliada[];
  /** Diretorio de trabalho para os arquivos temporarios do ffmpeg. */
  readonly dirTrabalho: string;
  /** Versao do ffmpeg corrente (default: detectada — o pin e conferido). */
  readonly ffmpeg?: string;
  /** Versao do node corrente (default: process.version). */
  readonly node?: string;
  /** Executor de comandos injetavel (default: execFile). */
  readonly executor?: ExecutorDeMedicao;
  /**
   * A FILA DE ENCODE INJETADA — instancia propria do card (criada por
   * `criarFilaDeEncode` do F5-02). O pos NUNCA usa a fila compartilhada
   * do processo: a dona dela e a F5-07 (AB-705, W9).
   */
  readonly fila: FilaDeEncode;
}

/** Resultado completo da producao do pos. */
export interface ResultadoDoPos {
  /** Bytes do entregavel codificado (m4a — aac 192 kbps). */
  readonly entregavel: Buffer;
  /** Texto do sidecar SRT. */
  readonly sidecar: string;
  /** O documento PosDocument.1 (medicoes + pins). */
  readonly documento: PosDocument;
  /** A estrategia de ganho aplicada (para o gate conferir de novo). */
  readonly ganho: GanhoComputado;
  /** Medicao do master (para o gate conferir de novo). */
  readonly masterMedicao: { integradoLufs: number; truePeakDbtp: number };
}

/** O entregavel fora do alvo de LUFS — NAO EXISTE (∅-crit original). */
export class EEntregavelForaDoAlvo extends Error {
  readonly code = "POS_ENTREGAVEL_FORA_DO_ALVO";
  constructor(medido: number, alvo: number, tolerancia: number) {
    super(
      `entregavel fora do alvo de LUFS: medido ${medido.toFixed(2)} LUFS, ` +
        `alvo ${alvo.toFixed(2)} ± ${tolerancia} LU — a entrega falha (∅-crit)`,
    );
    this.name = "EEntregavelForaDoAlvo";
  }
}

/** True peak acima do teto no CODIFICADO — NAO EXISTE (∅-crit (c)). */
export class ETruePeakAcimaDoTeto extends Error {
  readonly code = "POS_TRUE_PEAK_ACIMA_DO_TETO";
  constructor(medido: number, teto: number, tolerancia: number) {
    super(
      `true peak ${medido.toFixed(2)} dBTP acima do teto ${teto.toFixed(2)} ` +
        `+ tolerancia ${tolerancia} LU no entregavel codificado — a entrega falha (∅-crit (c))`,
    );
    this.name = "ETruePeakAcimaDoTeto";
  }
}

// ─── A producao ───────────────────────────────────────────────────────────────

/**
 * Produz a entrega do pos: master normalizado UMA vez + codificado +
 * sidecar + documento.
 *
 * Guardas estruturais (o que nao existe nao sai deste modulo):
 *   - entregavel fora do alvo de LUFS (±0,3 LU) -> EEntregavelForaDoAlvo;
 *   - true peak do codificado acima do teto -> ETruePeakAcimaDoTeto.
 *
 * @throws EEntregavelForaDoAlvo / ETruePeakAcimaDoTeto / EMedicaoInvalida
 */
export async function produzirPos(opcoes: OpcoesDoPos): Promise<ResultadoDoPos> {
  const alvo = alvoDoPos();
  const executor = opcoes.executor ?? executorPadrao;
  const ffmpeg = opcoes.ffmpeg ?? (await versaoDoFfmpeg(executor));
  const node = opcoes.node ?? process.version;

  // 1. Medicao do master (instrumento pinado).
  const masterPath = join(opcoes.dirTrabalho, "master.wav");
  await writeFile(masterPath, opcoes.masterBytes);
  const masterMedicao = await medirLoudness(masterPath, executor);

  // 2. Estrategia de ganho + aplicacao UMA vez.
  const ganho = computarGanho(alvo, masterMedicao.integradoLufs, masterMedicao.truePeakDbtp);
  const normalizado = aplicarGanhoNoMaster(opcoes.masterBytes, ganho.ganhoAplicadoDb);
  const normalizadoPath = join(opcoes.dirTrabalho, "normalizado.wav");
  await writeFile(normalizadoPath, normalizado.wav);

  // 3. Encode AAC com o perfil do pos (deterministico: true — o
  //    montarComandoAudio RECUSA perfil deterministico: false) e a fila
  //    INJETADA (motor libx264, os tetos da fila do F5-02).
  const saida = join(opcoes.dirTrabalho, "entregavel.m4a");
  const comando = montarComandoAudio(PERFIL_AUDIO_POS, normalizadoPath, saida);
  const liberar = await opcoes.fila.adquirir(PERFIL_AUDIO_POS.motor);
  try {
    await executor(comando[0]!, comando.slice(1));
  } finally {
    liberar();
  }
  const entregavel = await readFile(saida);

  // 4. Conferencia no CODIFICADO, decodificado de volta (ADR-0040
  //    decisao 2) — as guardas dos ∅-crits original e (c).
  const medicao = await medirLoudness(saida, executor);
  if (Math.abs(medicao.integradoLufs - alvo.targetLufs) > alvo.toleranciaMedicaoLu) {
    throw new EEntregavelForaDoAlvo(medicao.integradoLufs, alvo.targetLufs, alvo.toleranciaMedicaoLu);
  }
  if (medicao.truePeakDbtp > alvo.maxTruePeakDbtp + alvo.toleranciaMedicaoLu) {
    throw new ETruePeakAcimaDoTeto(medicao.truePeakDbtp, alvo.maxTruePeakDbtp, alvo.toleranciaMedicaoLu);
  }

  // 5. Sidecar do MESMO documento (ADR-0027), RECONCILIADO com o mix
  //    (C1) — por construcao ele bate; a conferencia independente e do
  //    oraculo (`conferirPos`).
  const legendas = lerLegendas(opcoes.documentoLegendasBytes, opcoes.contextoLegendas);
  const reconciliadas = reconciliarComOMix(
    legendas,
    opcoes.intervalosDeFala,
    opcoes.contextoLegendas.manifesto.fps,
  );
  const sidecar = serializarSrt(reconciliadas);
  const problemasSidecar = conferirSidecar(sidecar, reconciliadas);
  if (problemasSidecar.length > 0) {
    // Inalcancavel por construcao: o sidecar ACABOU de nascer do documento.
    throw new Error(`sidecar recusado pela propria conferencia:\n  - ${problemasSidecar.join("\n  - ")}`);
  }

  // 6. O documento PosDocument.1.
  const documento: PosDocument = {
    schema_version: FORMATO_POS,
    alvo,
    normalizacao: {
      lufsDoMaster: masterMedicao.integradoLufs,
      truePeakDoMasterDbtp: masterMedicao.truePeakDbtp,
      ganhoAplicadoDb: ganho.ganhoAplicadoDb,
      truePeakPreEncodeDbtp: ganho.truePeakPreEncodeDbtp,
    },
    entregavel: {
      nome: "entregavel.m4a",
      hash: sha256Bytes(entregavel),
      perfil: PERFIL_AUDIO_POS.nome,
      codec: PERFIL_AUDIO_POS.codec,
      taxa: 48000,
      canais: 2,
    },
    medicoes: {
      integradoLufs: medicao.integradoLufs,
      truePeakDbtp: medicao.truePeakDbtp,
      overshootDb: medicao.truePeakDbtp - ganho.truePeakPreEncodeDbtp,
    },
    sidecar: {
      nome: "entregavel.srt",
      hash: sha256Bytes(Buffer.from(sidecar, "utf-8")),
      fonte_documento_hash: sha256Bytes(opcoes.documentoLegendasBytes),
    },
    ferramentas: { ffmpeg, node },
  };

  return {
    entregavel,
    sidecar,
    documento,
    ganho,
    masterMedicao,
  };
}

// ─── O oraculo ────────────────────────────────────────────────────────────────

/**
 * Confere a entrega do pos — o ORACULO. Nao confia no documento:
 * re-mede o master e o entregavel codificado, re-deriva o ganho da
 * estrategia, re-deriva o sidecar do documento de legendas e compara
 * com o que foi entregue. Problemas vazio = VERDE.
 *
 * Checagens (cada uma vira um problema; vazio = VERDE):
 *
 *   G1  forma — PosDocument.1; alvo do documento == alvo dos tokens
 *       (S-5) e das constantes do ADR-0040.
 *   G2  pin — o documento registra ffmpeg 6.1.1 (pin do ADR-0040) e o
 *       ffmpeg/node correntes coincidem com o registrado; divergencia
 *       invalida o documento e exige re-verificacao.
 *   G3  alvo (∅-crit original) — loudness integrada MEDIDA no
 *       entregavel decodificado dentro do alvo ±0,3 LU.
 *   G4  teto (∅-crit (c)) — true peak MEDIDO no entregavel decodificado
 *       dentro do teto -1.0 dBTP (+ tolerancia de medicao na leitura).
 *   G5  normalizacao unica (adversarial 1) — a medicao do entregavel
 *       bate com masterMedido + ganhoDaEstrategia (reaplicar o ganho
 *       deslocaria a saida pela propria magnitude).
 *   G6  margem (ADR-0040 decisao 3) — o overshoot real medido fica
 *       dentro da margem declarada; acima dela, a margem e revisada por
 *       ADR (nunca ajustada em silencio).
 *   G7  sidecar (∅-crit (a)) — o SRT entregue e o que deriva do MESMO
 *       documento RECONCILIADO com o mix (lerLegendas ->
 *       reconciliarComOMix -> serializarSrt) e confere contra a
 *       timeline pos-reconciliada (intervalos coerentes); o hash
 *       registrado bate com os bytes entregues e com o documento de
 *       origem.
 *   G8  queimada (∅-crit (b)) — coerencia de inicio_s ONDE a queimada
 *       existe (janela visual da cena, F1-01); NUNCA igualdade de
 *       duracao total.
 *   G9  identidade — o hash do entregavel registrado bate com os bytes
 *       entregues.
 */
export interface ConferenciaDoPos {
  readonly problemas: readonly string[];
  readonly medicoes: MedicoesConferidas;
}

/** As medicoes reconferidas pelo oraculo, para o relatorio do gate. */
export interface MedicoesConferidas {
  readonly masterLufs: number;
  readonly masterTruePeakDbtp: number;
  readonly entregavelLufs: number;
  readonly entregavelTruePeakDbtp: number;
  readonly overshootDb: number;
  readonly ganhoAplicadoDb: number;
  readonly clampadoPorTeto: boolean;
}

/** O que o oraculo precisa para conferir (a entrega + o contexto). */
export interface EntradasDaConferencia {
  /** Diretorio de trabalho para os arquivos temporarios da re-medicao. */
  readonly dirTrabalho: string;
  /** Os bytes do master (a medicao e refeita — nunca confiar no doc). */
  readonly masterBytes: Buffer;
  /** Os bytes do documento de legendas de que o sidecar nasceu. */
  readonly documentoLegendasBytes: Buffer;
  readonly contextoLegendas: ContextoDeLegendas;
  /**
   * A reconciliacao do mix (C1) — os intervalos em que a fala de cada
   * cena toca no master. O sidecar esperado e re-derivado por
   * `lerLegendas -> reconciliarComOMix -> serializarSrt`.
   */
  readonly intervalosDeFala: readonly FalaReconciliada[];
  /** As janelas visuais das cenas (F1-01) — a base da queimada. */
  readonly janelasVisuais: readonly JanelaVisualDaCena[];
  /** Os bytes do entregavel codificado. */
  readonly entregavel: Buffer;
  /** O texto do sidecar entregue. */
  readonly sidecar: string;
  /** O documento PosDocument.1 entregue. */
  readonly documento: PosDocument;
  /** Versoes correntes (default: detectadas). */
  readonly ffmpegAtual?: string;
  readonly nodeAtual?: string;
  readonly executor?: ExecutorDeMedicao;
}

/**
 * Confere a entrega — problemas vazio = VERDE; qualquer problema e
 * VERMELHO, com a regra nomeada.
 */
export async function conferirPos(
  entradas: EntradasDaConferencia,
): Promise<ConferenciaDoPos> {
  const problemas: string[] = [];
  const alvo = alvoDoPos();
  const executor = entradas.executor ?? executorPadrao;
  const ffmpegAtual = entradas.ffmpegAtual ?? (await versaoDoFfmpeg(executor));
  const nodeAtual = entradas.nodeAtual ?? process.version;
  const doc = entradas.documento;

  // G1 — forma e alvo do documento.
  if (doc.schema_version !== FORMATO_POS) {
    problemas.push(
      `G1: schema_version "${String(doc.schema_version)}" — esperado ${FORMATO_POS}`,
    );
  }
  if (doc.alvo.targetLufs !== alvo.targetLufs || doc.alvo.maxTruePeakDbtp !== alvo.maxTruePeakDbtp) {
    problemas.push(
      `G1: alvo do documento (${doc.alvo.targetLufs} LUFS / ${doc.alvo.maxTruePeakDbtp} dBTP) ` +
        `diverge dos tokens (${alvo.targetLufs} / ${alvo.maxTruePeakDbtp}) — o gate segue o token (ADR-0040)`,
    );
  }
  if (
    doc.alvo.toleranciaMedicaoLu !== TOLERANCIA_MEDICAO_LU ||
    doc.alvo.margemOvershootDb !== MARGEM_OVERSHOOT_DB
  ) {
    problemas.push(
      `G1: tolerancia/margem do documento (${doc.alvo.toleranciaMedicaoLu} LU / ` +
        `${doc.alvo.margemOvershootDb} dB) divergem do ADR-0040 ` +
        `(${TOLERANCIA_MEDICAO_LU} LU / ${MARGEM_OVERSHOOT_DB} dB)`,
    );
  }

  // G2 — pin das ferramentas (contrato-w8 §2).
  const pinOk = /^6\.1\.1/.test(doc.ferramentas.ffmpeg);
  if (!pinOk) {
    problemas.push(
      `G2: o documento registra ffmpeg ${doc.ferramentas.ffmpeg} — o pin do ` +
        `ADR-0040 e ${PIN_FFMPEG} (bump invalida o documento e exige re-verificacao)`,
    );
  }
  if (!/^6\.1\.1/.test(ffmpegAtual)) {
    problemas.push(
      `G2: ffmpeg corrente ${ffmpegAtual} diverge do pin ${PIN_FFMPEG} — o ` +
        "determinismo entre versoes de ferramenta e declarado por pin, nunca assumido",
    );
  }
  if (ffmpegAtual !== doc.ferramentas.ffmpeg) {
    problemas.push(
      `G2: ffmpeg corrente ${ffmpegAtual} diverge do registrado ` +
        `(${doc.ferramentas.ffmpeg}) no documento`,
    );
  }
  if (nodeAtual !== doc.ferramentas.node) {
    problemas.push(
      `G2: node corrente ${nodeAtual} diverge do registrado (${doc.ferramentas.node}) no documento`,
    );
  }

  // Re-medicao independente (G3/G4/G5) — nunca confiar no documento.
  const masterPath = join(entradas.dirTrabalho ?? ".", "conferir-master.wav");
  const entregavelPath = join(entradas.dirTrabalho ?? ".", "conferir-entregavel.m4a");
  await writeFile(masterPath, entradas.masterBytes);
  await writeFile(entregavelPath, entradas.entregavel);
  const master = await medirLoudness(masterPath, executor);
  const medicao = await medirLoudness(entregavelPath, executor);

  // A estrategia de ganho re-derivada dos numeros medidos.
  const ganho = computarGanho(alvo, master.integradoLufs, master.truePeakDbtp);

  // G3 — ∅-crit original: entregavel fora do alvo de LUFS tem de bloquear.
  if (Math.abs(medicao.integradoLufs - alvo.targetLufs) > alvo.toleranciaMedicaoLu) {
    problemas.push(
      `G3: entregavel medido em ${medicao.integradoLufs.toFixed(2)} LUFS — fora do ` +
        `alvo ${alvo.targetLufs.toFixed(2)} ± ${alvo.toleranciaMedicaoLu} LU (∅-crit: bloqueia)`,
    );
  }

  // G4 — ∅-crit (c): true peak no CODIFICADO, decodificado de volta.
  if (medicao.truePeakDbtp > alvo.maxTruePeakDbtp + alvo.toleranciaMedicaoLu) {
    problemas.push(
      `G4: true peak ${medicao.truePeakDbtp.toFixed(2)} dBTP acima do teto ` +
        `${alvo.maxTruePeakDbtp.toFixed(2)} + ${alvo.toleranciaMedicaoLu} LU no entregavel ` +
        "codificado, decodificado de volta (∅-crit (c))",
    );
  }

  // G5 — normalizacao UMA vez (adversarial 1): a medicao do entregavel
  // bate com master + ganho da estrategia; reaplicar o ganho deslocaria
  // a saida pela propria magnitude do ganho.
  const esperadoLufs = master.integradoLufs + ganho.ganhoAplicadoDb;
  if (Math.abs(medicao.integradoLufs - esperadoLufs) > alvo.toleranciaMedicaoLu) {
    problemas.push(
      `G5: entregavel medido em ${medicao.integradoLufs.toFixed(2)} LUFS, mas ` +
        `master (${master.integradoLufs.toFixed(2)}) + ganho da estrategia ` +
        `(${ganho.ganhoAplicadoDb.toFixed(2)} dB) = ${esperadoLufs.toFixed(2)} — a ` +
        "normalizacao foi aplicada mais de uma vez, ou o ganho divergiu da estrategia",
    );
  }
  if (ganho.ganhoAplicadoDb !== doc.normalizacao.ganhoAplicadoDb) {
    problemas.push(
      `G5: documento declara ganho ${doc.normalizacao.ganhoAplicadoDb.toFixed(3)} dB, ` +
        `a estrategia re-derivada da ${ganho.ganhoAplicadoDb.toFixed(3)} dB`,
    );
  }

  // G6 — margem de overshoot (ADR-0040 decisao 3): o overshoot REAL
  // medido dentro da margem declarada; acima dela a margem e revisada
  // por ADR, nunca ajustada em silencio.
  const overshootDb = medicao.truePeakDbtp - ganho.truePeakPreEncodeDbtp;
  if (overshootDb > alvo.margemOvershootDb + TOLERANCIA_OVERSHOOT_DB) {
    problemas.push(
      `G6: overshoot real de codec ${overshootDb.toFixed(2)} dB acima da margem ` +
        `declarada ${alvo.margemOvershootDb.toFixed(1)} dB — a margem do ADR-0040 ` +
        "precisa de revisao por ADR (nunca ajuste em silencio)",
    );
  }

  // G7 — sidecar (∅-crit (a)): o SRT entregue e o que deriva do MESMO
  // documento, RECONCILIADO com o mix (C1): a expectativa e
  // `lerLegendas -> reconciliarComOMix -> serializarSrt` — o sidecar
  // descreve a timeline POS-reconciliacao, nunca a fala inteira do
  // documento; intervalos coerentes com o golden pos-reconciliado.
  const legendas = lerLegendas(entradas.documentoLegendasBytes, entradas.contextoLegendas);
  const reconciliadas = reconciliarComOMix(
    legendas,
    entradas.intervalosDeFala,
    entradas.contextoLegendas.manifesto.fps,
  );
  const esperadoSrt = serializarSrt(reconciliadas);
  if (entradas.sidecar !== esperadoSrt) {
    problemas.push(
      "G7: o sidecar entregue NAO e o que deriva do documento LegendasCanonicas.1 " +
        "(lerLegendas -> reconciliarComOMix -> serializarSrt) — o sidecar e fabricado " +
        "no ponto de consumo, nunca regenerado de outra fonte (ADR-0027)",
    );
  }
  problemas.push(...conferirSidecar(entradas.sidecar, reconciliadas).map((p) => `G7: ${p}`));
  const hashSrt = sha256Bytes(Buffer.from(entradas.sidecar, "utf-8"));
  if (doc.sidecar.hash !== hashSrt) {
    problemas.push(
      `G7: documento registra hash do sidecar ${doc.sidecar.hash.slice(0, 12)}…, ` +
        `os bytes entregues medem ${hashSrt.slice(0, 12)}…`,
    );
  }
  const fonteHash = sha256Bytes(entradas.documentoLegendasBytes);
  if (doc.sidecar.fonte_documento_hash !== fonteHash) {
    problemas.push(
      `G7: documento registra fonte do sidecar ${doc.sidecar.fonte_documento_hash.slice(0, 12)}…, ` +
        `o documento de legendas entregue mede ${fonteHash.slice(0, 12)}…`,
    );
  }

  // G8 — queimada (∅-crit (b)): coerencia de inicio_s ONDE a queimada
  // existe; nunca igualdade de duracao total (CASO C1: c-004).
  problemas.push(
    ...conferirCoerenciaDaQueimada(entradas.sidecar, legendas, entradas.janelasVisuais)
      .map((p) => `G8: ${p}`),
  );

  // G9 — identidade do entregavel.
  const hashEntregavel = sha256Bytes(entradas.entregavel);
  if (doc.entregavel.hash !== hashEntregavel) {
    problemas.push(
      `G9: documento registra hash do entregavel ${doc.entregavel.hash.slice(0, 12)}…, ` +
        `os bytes entregues medem ${hashEntregavel.slice(0, 12)}…`,
    );
  }

  return {
    problemas,
    medicoes: {
      masterLufs: master.integradoLufs,
      masterTruePeakDbtp: master.truePeakDbtp,
      entregavelLufs: medicao.integradoLufs,
      entregavelTruePeakDbtp: medicao.truePeakDbtp,
      overshootDb,
      ganhoAplicadoDb: ganho.ganhoAplicadoDb,
      clampadoPorTeto: ganho.clampadoPorTeto,
    },
  };
}
