/**
 * src/roteiro/narracao/narracao.ts
 *
 * NARRACAO GRAVADA — o caminho do botao de gravacao de voz (D4 do
 * TASK_PLAN; docs/roteiro/contrato-roteiro.md §7): o navegador grava com
 * MediaRecorder (webm/opus), o servidor chama `receberGravacao`, que
 * converte para o formato congelado do contrato (FORMATO_AUDIO_GRAVADO:
 * wav 48 kHz estereo), calcula o SHA-256 do wav FINAL e o grava no store
 * enderecado por conteudo (S-8) com procedencia — mesmo conteudo 2x =
 * mesmo hash e UMA entrada (FQ-N1, put idempotente).
 *
 * O que este modulo NAO e:
 *   - nao e a rota HTTP (Onda 5): o servidor chama `receberGravacao` e
 *     atualiza o Pedaco.narracao (`{texto: fala, origem: "gravacao",
 *     hash_audio, status: "gerado"}`) — este modulo nao conhece pedacos;
 *   - nao e TTS: a gravacao e a via PRIMARIA de voz deste ambiente (o
 *     TTS real responde 429 credit_balance_exhausted — contrato-roteiro
 *     §7);
 *   - nao e whisper/ASR: o timing da gravacao e a DURACAO DO AUDIO (D4),
 *     medida no cabecalho do wav (pura, deterministico); legendas nao
 *     sao derivadas de gravacao.
 *
 * Fronteira de impureza: a conversao webm->wav usa ffmpeg via EXECUTOR
 * INJETAVEL (o padrao do repo — ExecutorDeComando de
 * src/pipeline/produzir.ts; nunca globalThis.fetch/exec). O executor
 * padrao e execFile com o binario do PATH, pinado em 6.1.1
 * (PIN_FFMPEG_NARRACAO — o MESMO pin do resto do pipeline,
 * src/entrega/pos/index.ts:78); `conferirPinDoFfmpeg` deixa o servidor
 * verificar o pin uma vez no startup (o mesmo papel de versaoDoFfmpeg no
 * produzir.ts). Tudo o mais aqui e funcao pura dos bytes: parse do
 * cabecalho wav, duracao, hash.
 *
 * Determinismo da conversao (FQ-N3/bitexact): os tres flags de
 * determinismo (`-fflags +bitexact -flags +bitexact -map_metadata -1`)
 * vao DEPOIS da entrada — antes do -i eles configuram o DEMUXER e a
 * saida carrega metadado de versao do libavformat (ffmpeg-media-ops
 * SKILL.md, NV-5), o que mudaria o hash do wav entre versoes de ffmpeg.
 */

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FORMATO_AUDIO_GRAVADO } from "../contrato/contrato.js";
import { Store } from "../../store/store.js";
import { procedenciaDaGravacao } from "./procedencia.js";

// ─── Versoes (o pin) ───────────────────────────────────────────────────────────

/** Versao do modulo de narracao — entra no toolVersion da procedencia. */
export const VERSAO_MODULO_NARRACAO = "1.0.0" as const;

/**
 * Pin do ffmpeg da conversao — o MESMO do resto do pipeline
 * (PIN_FFMPEG de src/entrega/pos/index.ts:78). O determinismo da
 * conversao e declarado por pin, nunca por esperanca: bytes iguais so
 * significam algo dentro da mesma versao de ferramenta.
 */
export const PIN_FFMPEG_NARRACAO = "6.1.1" as const;

// ─── Erros nomeados ────────────────────────────────────────────────────────────

/** O corpo do PUT veio vazio — nada foi gravado pelo navegador. */
export class ErroGravacaoVazia extends Error {
  readonly code = "GRAVACAO_VAZIA";
  constructor(detalhe = "gravacao vazia: o corpo do envio nao pode ser vazio") {
    super(detalhe);
    this.name = "ErroGravacaoVazia";
  }
}

/**
 * A conversao webm->wav falhou (ou produziu algo inutilizavel). Carrega
 * o stderr do ffmpeg quando o executor o expoe — o servidor o loga.
 */
export class ErroConversaoAudio extends Error {
  readonly code = "CONVERSAO_AUDIO";
  /** stderr do ffmpeg, quando disponivel (o executor o anexa ao erro). */
  readonly stderr?: string;
  constructor(detalhe: string, stderr?: string) {
    const trecho =
      stderr !== undefined && stderr.trim().length > 0
        ? `\nstderr do ffmpeg:\n${stderr.trim()}`
        : "";
    super(`${detalhe}${trecho}`);
    this.name = "ErroConversaoAudio";
    this.stderr = stderr;
  }
}

/** Os bytes nao sao um WAV RIFF/WAVE valido (parse puro falhou). */
export class ErroAudioInvalido extends Error {
  readonly code = "AUDIO_INVALIDO";
  constructor(detalhe: string) {
    super(`audio invalido: ${detalhe}`);
    this.name = "ErroAudioInvalido";
  }
}

// ─── Executor injetavel (padrao do repo) ──────────────────────────────────────

/** Executa um comando e devolve stdout/stderr — o contrato do executor. */
export type ExecutorDeComando = (
  comando: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

/**
 * O executor padrao: execFile (subprocesso local, sem rede). Em caso de
 * falha, anexa o stderr do subprocesso ao erro ANTES de rejeitar: no
 * Node 24 o erro do execFile NAO carrega `stderr` na propria excecao
 * (medido: `typeof erro.stderr === "undefined"`) — o stderr chega so como
 * 3o argumento do callback. E esse stderr anexado que o
 * ErroConversaoAudio preserva.
 */
export const executorPadrao: ExecutorDeComando = (comando, args) =>
  new Promise((resolve, reject) => {
    execFile(
      comando,
      args,
      { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
      (erro, stdout, stderr) => {
        if (erro) {
          (erro as Error & { stderr?: string }).stderr = String(stderr);
          reject(erro);
          return;
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });

// ─── Tipos da API ──────────────────────────────────────────────────────────────

/** Metadado que o navegador/servidor conhece sobre a gravacao enviada. */
export interface MetaDaGravacao {
  /** Nome original do arquivo (exibicao/auditoria — como AnexoMeta). */
  readonly nome_original?: string;
  /** MIME declarado pelo navegador (ex.: "audio/webm"). So auditoria. */
  readonly tipo?: string;
}

/** Opcoes de receberGravacao — o que e impuro entra injetado. */
export interface OpcoesDeGravacao {
  /** O store onde o wav entra (S-8, append-only por hash). Obrigatorio. */
  readonly store: Store;
  /** Executor de comandos (default: execFile — subprocesso local). */
  readonly executor?: ExecutorDeComando;
  /**
   * Relogio do `acquiredAt` da procedencia (default: Date real — o
   * servidor registra o momento real da aquisicao). Testes injetam
   * relogio fixo para o determinismo da procedencia.
   */
  readonly relogio?: () => Date;
  /** Nome do binario ffmpeg (default: "ffmpeg" do PATH). */
  readonly ffmpeg?: string;
}

/** O resultado de receberGravacao — o que o servidor grava no pedaco. */
export interface ResultadoDaGravacao {
  /**
   * SHA-256 do wav FINAL (FORMATO_AUDIO_GRAVADO) — e este o hash que o
   * Pedaco.narracao.hash_audio carrega (contrato-roteiro §7: hash_audio
   * e do wav que o pipeline consome, nunca do webm original).
   */
  readonly hash_audio: string;
  /** Os bytes do wav 48 kHz estereo (o que o pipeline consome). */
  readonly wavBytes: Buffer;
  /**
   * Duracao em segundos — o TIMING da gravacao (D4): duracao do audio,
   * medida no cabecalho do wav; sem whisper, sem legendas derivadas.
   */
  readonly duracaoSegundos: number;
}

// ─── Cabecalho wav (funcoes puras) ─────────────────────────────────────────────

/** O cabecalho RIFF/WAVE de um wav PCM — o que a duracao precisa. */
export interface CabecalhoWav {
  /** Taxa de amostragem em Hz (fmt.rate). */
  readonly sample_rate: number;
  /** Quantidade de canais (1 = mono, 2 = estéreo). */
  readonly canais: number;
  /** Bits por amostra (16 = s16le, 32 = f32le). */
  readonly bits_por_amostra: number;
  /** 1 = PCM s16, 3 = IEEE float (o 0xfffe extensible e desembrulhado). */
  readonly formato_audio: number;
  /** Tamanho do chunk data em bytes. */
  readonly tamanho_dados: number;
  /** Duracao em segundos — tamanho_dados / byte_rate (aritmetica exata). */
  readonly duracao_segundos: number;
}

/**
 * Le o cabecalho de um WAV PCM (s16le ou f32le) e devolve o que a
 * duracao precisa — SEM decodificar amostras (medirDuracao e usado em
 * todo PUT; decodificar 5 min de voz por chamada seria desperdicio).
 *
 * Varre os chunks RIFF em vez de assumir offset 44 — a mesma disciplina
 * de src/audio/mix/pcm.ts lerWavPcm. Rejeita codec que nao seja PCM
 * linear (1 ou 3) e formato desconhecido: bytes errados entrando como
 * "wav" dariam duracao inventada (fail-closed, nunca chute).
 *
 * @throws ErroAudioInvalido se os bytes nao forem um WAV PCM conhecido.
 */
export function lerCabecalhoWav(bytes: Buffer): CabecalhoWav {
  if (
    bytes.length < 44 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new ErroAudioInvalido("bytes nao sao um WAV RIFF/WAVE");
  }

  let formato = 0;
  let canais = 0;
  let sample_rate = 0;
  let bits = 0;
  let tamanho_dados = 0;
  let offset = 12;
  let viuFmt = false;

  while (offset + 8 <= bytes.length) {
    const chunkId = bytes.toString("ascii", offset, offset + 4);
    const tamanho = bytes.readUInt32LE(offset + 4);
    const corpo = offset + 8;
    if (corpo + tamanho > bytes.length) {
      throw new ErroAudioInvalido(`chunk "${chunkId}" estoura o arquivo`);
    }
    if (chunkId === "fmt ") {
      viuFmt = true;
      if (tamanho < 16) {
        throw new ErroAudioInvalido("chunk fmt com menos de 16 bytes");
      }
      let f = bytes.readUInt16LE(corpo);
      if (f === 0xfffe) {
        // WAVE_FORMAT_EXTENSIBLE: o formato real esta no GUID SubFormat
        // (offset 24 do corpo do fmt, apos cbSize) — o ffmpeg grava
        // extensible para f32.
        const sub = corpo + 24;
        if (sub + 2 > bytes.length) {
          throw new ErroAudioInvalido("fmt extensible sem SubFormat");
        }
        f = bytes.readUInt16LE(sub);
      }
      formato = f;
      canais = bytes.readUInt16LE(corpo + 2);
      sample_rate = bytes.readUInt32LE(corpo + 4);
      bits = bytes.readUInt16LE(corpo + 14);
    } else if (chunkId === "data") {
      tamanho_dados = tamanho;
    }
    offset = corpo + tamanho + (tamanho % 2); // chunks RIFF sao alinhados a 2
  }

  if (!viuFmt) {
    throw new ErroAudioInvalido("WAV sem chunk fmt");
  }
  if (sample_rate <= 0 || canais <= 0 || bits <= 0) {
    throw new ErroAudioInvalido("chunk fmt ausente ou incompleto");
  }
  if (formato !== 1 && formato !== 3) {
    throw new ErroAudioInvalido(
      `formato de audio ${formato} (esperado 1=PCM s16 ou 3=IEEE float)`,
    );
  }
  if ((formato === 1 && bits !== 16) || (formato === 3 && bits !== 32)) {
    throw new ErroAudioInvalido(
      `bits ${bits} incompativel com o formato ${formato}`,
    );
  }

  const bytesPorAmostra = bits / 8;
  return {
    sample_rate,
    canais,
    bits_por_amostra: bits,
    formato_audio: formato,
    tamanho_dados,
    duracao_segundos: tamanho_dados / (sample_rate * canais * bytesPorAmostra),
  };
}

/**
 * Duracao de um wav em segundos — leitura pura do cabecalho (D4: o
 * timing da gravacao e a duracao do audio; nada de whisper aqui).
 *
 * @throws ErroAudioInvalido se os bytes nao forem um WAV PCM conhecido.
 */
export function medirDuracao(wavBytes: Buffer): number {
  return lerCabecalhoWav(wavBytes).duracao_segundos;
}

/**
 * O input ja e o formato canonico (wav 48 kHz estereo PCM)? Se sim, o
 * wav passa SEM re-encode — os bytes do usuario viram o artefato do
 * store tal qual (a conversao e so para o que nao nasceu canonico).
 *
 * O check e SO de formato: um wav canonico com chunk data vazio passa
 * por aqui e morre na guarda de duracao de `receberGravacao` como
 * ErroGravacaoVazia ("o navegador gravou nada") — vazio nao e conversao
 * falha, e uma gravacao que nao existe.
 */
export function eWavNoFormatoCanonico(bytes: Buffer): boolean {
  try {
    const cab = lerCabecalhoWav(bytes);
    return (
      cab.sample_rate === FORMATO_AUDIO_GRAVADO.sample_rate &&
      cab.canais === FORMATO_AUDIO_GRAVADO.canais
    );
  } catch {
    // Nao e wav valido (ou e wav fora do formato) — cai na conversao.
    return false;
  }
}

/** SHA-256 de um buffer — o MESMO sha256 do store (hashDeAudio == hash do put). */
export function hashDeAudio(bytes: Buffer): string {
  return Store.hashBuffer(bytes);
}

// ─── O caminho principal ───────────────────────────────────────────────────────

/**
 * Recebe a gravacao do usuario e devolve o wav canonico no store.
 *
 * Fluxo (docs/roteiro/api.md — PUT narracao/audio):
 *   1. valida o input (nao-vazio; wav com zero dados de audio tambem e
 *      gravacao vazia — o navegador "gravou" silencio de duracao zero);
 *   2. converte para wav 48 kHz estereo (FORMATO_AUDIO_GRAVADO) — wav
 *      canonico passa SEM re-encode (conferido por leitura do cabecalho,
 *      nao por exit code — C1); o resto vai ao ffmpeg pinado;
 *   3. calcula o sha256 do wav FINAL e grava no store com procedencia
 *      (S-8: put idempotente — mesmo conteudo 2x = mesmo hash, UMA
 *      entrada; FQ-N1);
 *   4. devolve {hash_audio, wavBytes, duracaoSegundos} — o servidor
 *      grava `hash_audio` no Pedaco.narracao com origem "gravacao".
 *
 * @throws ErroGravacaoVazia  input vazio ou duracao zero (nada gravado)
 * @throws ErroConversaoAudio ffmpeg falhou ou produziu saida fora do formato
 * @throws ErroAudioInvalido  o wav final nao parseia como WAV PCM valido
 */
export async function receberGravacao(
  bytes: Buffer,
  meta: MetaDaGravacao = {},
  opcoes: OpcoesDeGravacao,
): Promise<ResultadoDaGravacao> {
  if (bytes.length === 0) {
    throw new ErroGravacaoVazia();
  }

  const wavBytes = eWavNoFormatoCanonico(bytes)
    ? bytes
    : await converterParaWavCanonico(bytes, opcoes);

  const duracaoSegundos = medirDuracao(wavBytes);
  if (!(duracaoSegundos > 0)) {
    throw new ErroGravacaoVazia(
      "gravacao sem dados de audio: o wav final tem duracao zero",
    );
  }

  const procedencia = procedenciaDaGravacao({
    nomeOriginal: meta.nome_original,
    tipo: meta.tipo,
    duracaoSegundos,
    byteSize: wavBytes.length,
    relogio: opcoes.relogio ?? (() => new Date()),
    toolVersion: `narracao-${VERSAO_MODULO_NARRACAO}`,
  });

  const { hash } = await opcoes.store.put(wavBytes, procedencia);
  return { hash_audio: hash, wavBytes, duracaoSegundos };
}

// ─── Conversao (privada) ───────────────────────────────────────────────────────

/**
 * Converte qualquer entrada para o wav canonico com ffmpeg pinado.
 *
 * O comando e o mesmo decoder do mix (src/pipeline/produzir.ts
 * criarDecoder) com codificador PCM s16 (o WAV classico, legivel por
 * qualquer consumidor — o mix decodifica s16 e f32 igual). Os flags de
 * determinismo ficam DEPOIS do -i (ffmpeg-media-ops NV-5: antes da
 * entrada eles configuram o demuxer e o metadado de versao vaza para o
 * arquivo, mudando o hash entre versoes de ffmpeg).
 *
 * Saida conferida de verdade, nunca so exit code (C1): o arquivo tem de
 * existir, parsear como WAV PCM e estar no formato canonico — exit 0
 * com saida ausente/errada e ErroConversaoAudio, nao sucesso.
 */
async function converterParaWavCanonico(
  bytes: Buffer,
  opcoes: OpcoesDeGravacao,
): Promise<Buffer> {
  const executor = opcoes.executor ?? executorPadrao;
  const ffmpeg = opcoes.ffmpeg ?? "ffmpeg";
  const dir = await mkdtemp(join(tmpdir(), "narracao-audio-"));
  try {
    const entrada = join(dir, "entrada");
    const saida = join(dir, "saida.wav");
    await writeFile(entrada, bytes);
    try {
      await executor(ffmpeg, [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        entrada,
        "-fflags",
        "+bitexact",
        "-flags",
        "+bitexact",
        "-map_metadata",
        "-1",
        "-ar",
        String(FORMATO_AUDIO_GRAVADO.sample_rate),
        "-ac",
        String(FORMATO_AUDIO_GRAVADO.canais),
        "-c:a",
        "pcm_s16le",
        "-f",
        "wav",
        saida,
      ]);
    } catch (erro) {
      throw new ErroConversaoAudio(
        "ffmpeg falhou ao converter a gravacao para o formato canonico " +
          "(wav 48 kHz estereo)",
        stderrDe(erro),
      );
    }
    let saidaBytes: Buffer;
    try {
      saidaBytes = await readFile(saida);
    } catch {
      throw new ErroConversaoAudio(
        "ffmpeg terminou sem escrever o wav de saida — exit 0 nao prova " +
          "bytes (C1)",
      );
    }
    const cab = lerCabecalhoWav(saidaBytes); // inparseavel -> ErroAudioInvalido
    if (
      cab.sample_rate !== FORMATO_AUDIO_GRAVADO.sample_rate ||
      cab.canais !== FORMATO_AUDIO_GRAVADO.canais ||
      cab.tamanho_dados === 0
    ) {
      throw new ErroConversaoAudio(
        `saida fora do formato canonico: ${cab.sample_rate} Hz / ` +
          `${cab.canais} canais / ${cab.tamanho_dados} bytes de dados ` +
          `(esperado ${FORMATO_AUDIO_GRAVADO.sample_rate} Hz / ` +
          `${FORMATO_AUDIO_GRAVADO.canais} canais)`,
      );
    }
    return saidaBytes;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ─── O pin (verificacao opcional, chamada uma vez pelo servidor) ──────────────

/**
 * Confere a versao do ffmpeg contra o pin e a devolve. O servidor chama
 * UMA vez no startup (o mesmo papel de versaoDoFfmpeg do produzir.ts);
 * a conversao em si nao re-confere a cada PUT — o determinismo entre
 * versoes de ferramenta e declarado por pin, nunca por esperanca.
 *
 * @throws ErroConversaoAudio se o ffmpeg divergir do pin ou nao rodar.
 */
export async function conferirPinDoFfmpeg(
  executor: ExecutorDeComando = executorPadrao,
  ffmpeg = "ffmpeg",
): Promise<string> {
  let saida: { stdout: string; stderr: string };
  try {
    saida = await executor(ffmpeg, ["-version"]);
  } catch (erro) {
    throw new ErroConversaoAudio(
      "nao consegui executar o ffmpeg para conferir o pin",
      stderrDe(erro),
    );
  }
  const m = /^ffmpeg version (\S+)/.exec(saida.stdout);
  if (m === null) {
    throw new ErroConversaoAudio(
      "nao reconheci a versao do ffmpeg",
      saida.stderr,
    );
  }
  if (!m[1]!.startsWith(PIN_FFMPEG_NARRACAO)) {
    throw new ErroConversaoAudio(
      `ffmpeg corrente ${m[1]} diverge do pin ${PIN_FFMPEG_NARRACAO} — ` +
        "o determinismo da conversao de narracao e declarado por pin",
    );
  }
  return m[1]!;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Extrai o stderr de um erro de execFile (string ou Buffer) — se houver. */
function stderrDe(erro: unknown): string | undefined {
  if (!(erro instanceof Error)) return undefined;
  const stderr = (erro as { stderr?: unknown }).stderr;
  if (typeof stderr === "string") return stderr;
  if (Buffer.isBuffer(stderr)) return stderr.toString("utf-8");
  return undefined;
}
