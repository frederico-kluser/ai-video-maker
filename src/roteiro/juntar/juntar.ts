/**
 * src/roteiro/juntar/juntar.ts
 *
 * O JUNTAR E ENTREGAR — o passo final do usuario: "uma vez com todos os
 * pedacos prontos, juntamos e entregamos o video" (Onda 4 do app web).
 * Contrato: docs/roteiro/api.md §POST /api/projetos/:id/juntar e
 * docs/roteiro/contrato-roteiro.md §8; os CLIs seguem a convencao D11.
 *
 * Fluxo:
 *   1. GATES — verificarJuntavel(): revalidacao do roteiro
 *      (validarRoteiro — regras anexo-* nomeadas), o gate record-first
 *      verificarJuntarFalaSemNarracao (nunca entrega fala muda — C1) e a
 *      presenca de TODOS os previews. O juntar so comeca a gravar quando
 *      os tres passam (REPLAN P5: 409 antes de qualquer trabalho);
 *   2. FORMATOS — ffprobe por preview (C4): h264 yuv420p 1920x1080 30fps
 *      + aac 48k (FORMATO_VIDEO, fonte unica). Qualquer divergencia =
 *      ErroJuntarFormatosDivergentes — NUNCA concat cego: o demuxer
 *      concat exige "same codecs, same time base, etc." e nao falha alto
 *      (ffmpeg-media-ops): concatena pacotes e o problema aparece nas
 *      emendas;
 *   3. CONCAT — ffmpeg concat demuxer, stream-copy (os previews sao
 *      identicos por construcao — FQ-J1);
 *   4. MUSICA (opcional) — trilha de fundo misturada no PCM em JS (o
 *      padrao do repo: src/audio/mix/pcm.ts — funcao pura) com VOLUME
 *      FIXO -20 dB. Decisao documentada em MUSICA_GANHO_* (sem ducking);
 *   5. LOUDNESS — EBU R 128 no padrao do repo (src/entrega/pos/,
 *      ADR-0040): medicao ebur128 (1a passada) + ganho aplicado UMA vez
 *      no PCM (2a passada) + conferencia no CODIFICADO — o "duas
 *      passadas" do api.md. Nunca `loudnorm` em modo dinamico (o filtro
 *      cai para dinamico em silencio — ffmpeg-media-ops);
 *   6. SRT final — quando o servidor entrega timing de TTS
 *      (opcoes.timing_pedacos), com offset acumulado por pedaco;
 *      GRAVACAO NAO DERIVA LEGENDAS (D4 — sem timing, sem SRT);
 *   7. MUX — video (copy) + audio AAC normalizado; a entrega e gravada
 *      em .cache/roteiro/entregas/<sha256>.mp4 (append-only por hash,
 *      S-8) + sidecar <hash>.json (medicoes — FQ-J5) + <hash>.srt
 *      (quando houver timing);
 *   8. ORACULO — conferirEntrega(): conteudo (C1 — REUSE
 *      medirConteudoDeBytes/reprovadoPorConteudo do produzir) + streams
 *      video+audio por stream (C4).
 *
 * Limites e decisoes documentadas:
 *   - AAC priming: o audio de cada preview tem 1024 amostras de priming
 *     (512 no MP4 — R03-22/23; medido: primeiro pacote de audio em
 *     -0.021 s). O demuxer concat alinha todos os streams pelo pacote
 *     mais cedo e desloca o VIDEO para +0.021 s (medido; concat de
 *     previews sem audio nao desloca nada). O mux final reverte o
 *     deslocamento com -itsoffset e usa -use_editlist 0 (duracao da
 *     trilha pelos timestamps reais — FQ-J1 — e o pacote de priming
 *     descartado, como o edit list faria). O "pop" de emenda classico
 *     nao chega ao audio final: o concat e uma cadeia AAC continua, o
 *     decode para o loudness e unico e o AAC final e codificado UMA vez.
 *   - MUSICA fixa em -20 dB, sem ducking (sidechaincompress):
 *     (a) ducking precisa dos intervalos da fala e a gravacao nao tem
 *     timing (D4); (b) a normalizacao EBU R128 a seguir equaliza o
 *     master inteiro; (c) o mix em PCM e funcao pura (FQ-J3 — o
 *     determinismo do sidechaincompress nao esta medido, NV-2);
 *     (d) a decisao fica audivel em diff. -20 dB e o piso tipico de
 *     musica de fundo sob locucao; o alvo de loudness do master e o
 *     mesmo do pos (tokens: targetLufs -23.0 / maxTruePeakDbtp -1.0,
 *     ADR-0040).
 *   - O oraculo de conteudo NAO roda dentro de juntar(): e o
 *     conferirEntrega() do servidor/Onda 5 apos o job ok (os previews ja
 *     passaram pelo oraculo do preview — FQ-P2; o concat nao cria
 *     preto). O mux confere apenas a presenca de video+audio (fail-fast
 *     no formato do proprio passo, C4).
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  lerWavPcm,
  comGanho,
  pcmNaDuracao,
  somar,
  escreverWavPcm,
} from "../../audio/mix/pcm.js";
import type { Pcm } from "../../audio/mix/pcm.js";
import { alvoDoPos, TOLERANCIA_MEDICAO_LU, versaoDoFfmpeg } from "../../entrega/pos/index.js";
import { medirLoudness } from "../../entrega/pos/medir.js";
import type { MedicaoEbur128 } from "../../entrega/pos/medir.js";
import { aplicarGanhoNoMaster, computarGanho } from "../../entrega/pos/normalizar.js";
import { montarComandoAudio, PERFIL_AUDIO_POS } from "../../entrega/pos/perfil-audio.js";
import { srtTimecode } from "../../entrega/pos/sidecar.js";
import {
  AMOSTRAGEM_DE_FRAMES,
  executorBrutoPadrao,
  executorPadrao,
  escreverAtomico,
  medirConteudoDeBytes,
  reprovadoPorConteudo,
  sha256Hex,
} from "../../pipeline/produzir.js";
import type { ExecutorBruto, ExecutorDeComando, MedidaDeConteudo } from "../../pipeline/produzir.js";
import { FORMATO_VIDEO } from "../contrato/contrato.js";
import type { Pedaco, Roteiro } from "../contrato/contrato.js";
import { validarRoteiro, verificarJuntarFalaSemNarracao } from "../contrato/validar.js";

// ─── Constantes de dominio (Regra 2 — valores em tipo nomeado) ────────────────

/** Diretorio default das entregas (append-only por hash, S-8). */
export const DIR_ENTREGAS_DEFAULT = ".cache/roteiro/entregas";

/** Diretorio default dos temporarios do juntar (gitignored, .cache/). */
export const DIR_TRABALHO_DEFAULT = ".cache/roteiro/trabalho";

/**
 * Ganho LINEAR da musica de fundo: 0.1 = -20 dB. Decisao documentada no
 * cabecalho (volume fixo, sem ducking) — veja MUSICA_GANHO_DB.
 */
export const MUSICA_GANHO_LINEAR = 0.1;

/** O mesmo ganho em decibeis, para mensagens e sidecar. */
export const MUSICA_GANHO_DB = -20;

/**
 * Tolerancia de comparacao de duracao por stream (FQ-J1 — C4).
 *
 * 0.01 s, de proposito: SEM o reparo de timestamps do mux (a reversao
 * do deslocamento de ~21 ms que o demuxer concat aplica ao video por
 * causa do priming AAC), a duracao por stream DESVIA da soma por ~21 ms
 * (o sinal depende do mux: medido +21 ms com -use_editlist 0 e -21 ms
 * com edit list default) — a tolerancia tem de ficar VERMELHA nessa
 * regressao (0.021 > 0.01), nao absorve-la. O valor medido com o
 * reparo e soma + 0.0003 s (folga de 30x).
 */
export const TOLERANCIA_DURACAO_JUNTAR_SEGUNDOS = 0.01;

/** Formato do sidecar da entrega (medicoes — FQ-J5). */
export const FORMATO_SIDECAR_ENTREGA = "EntregaJuntar.1";

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

/** Um cue de timing de TTS — relativo ao INICIO do pedaco (a fonte do SRT). */
export interface CueDeTiming {
  /** O texto do cue (a fala ou parte dela). */
  readonly texto: string;
  /** Inicio em segundos, relativo ao inicio do pedaco. */
  readonly inicio_segundos: number;
  /** Fim em segundos, relativo ao inicio do pedaco. */
  readonly fim_segundos: number;
}

/**
 * Opcoes do juntar. O servidor (Onda 5) monta este objeto a partir do
 * estado do projeto e do corpo do POST — os CAMINHOS dos previews por
 * pedaco (o layout do preview e da Onda 4; o servidor resolve o caminho
 * de cada preview pronto — C7: endereco por conteudo, nunca URL).
 */
export interface OpcoesDeJuntar {
  /**
   * Caminho do mp4 do preview de CADA pedaco, chaveado por pedaco.id.
   * Pedaco sem entrada (ou com arquivo inexistente) = 409
   * juntar-preview-ausente.
   */
  readonly previews: Readonly<Record<string, string>>;
  /**
   * Trilha de fundo opcional — caminho de DISCO do servidor, nunca URL
   * (C7). O upload de musica e passo manual permanente (a YouTube Audio
   * Library nao tem API — api.md §juntar).
   */
  readonly musica_caminho?: string;
  /**
   * Timing de TTS por pedaco (cues RELATIVOS ao pedaco) — a fonte do SRT
   * final. So existe para narracao com timing: GRAVACAO NAO DERIVA
   * LEGENDAS (D4) — o servidor omite timing para pedacos gravados.
   */
  readonly timing_pedacos?: Readonly<Record<string, readonly CueDeTiming[]>>;
  /** Diretorio das entregas (default: .cache/roteiro/entregas). */
  readonly dirEntregas?: string;
  /** Diretorio de trabalho dos temporarios (default: .cache/roteiro/trabalho). */
  readonly dirTrabalho?: string;
  /** Executor de ffmpeg/ffprobe injetavel (default: executorPadrao do produzir). */
  readonly executor?: ExecutorDeComando;
  /** Executor bruto injetavel (bytes — o oraculo de conteudo, C1). */
  readonly executorBruto?: ExecutorBruto;
}

// ─── Erros nomeados ───────────────────────────────────────────────────────────

/** A familia de erros do juntar — `codigo` e a chave estavel do envelope. */
export class ErroJuntar extends Error {
  /** Identificador estavel (a SPA/Onda 5 casa por ele — api.md envelope). */
  readonly codigo: string;
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroJuntar";
    this.codigo = codigo;
  }
}

/** 409 — fala sem narracao (gate record-first; lista de pedacos). */
export class ErroJuntarFalaSemNarracao extends ErroJuntar {
  /** Os pedacos com fala e origem "nenhuma" (o 409 lista os ids). */
  readonly pedacos: readonly Pedaco[];
  constructor(pedacos: readonly Pedaco[]) {
    const ids = pedacos.map((p) => p.id).join(", ");
    super(
      "juntar-fala-sem-narracao",
      `pedacos com fala nao narrada (origem "nenhuma") — grave ou gere o audio antes ` +
        `de juntar: ${ids}`,
    );
    this.name = "ErroJuntarFalaSemNarracao";
    this.pedacos = pedacos;
  }
}

/** 409 — roteiro revalidado com regras anexo-* (DELETE de anexo, etc.). */
export class ErroJuntarAnexoInvalido extends ErroJuntar {
  /** Os problemas do validador (regras anexo-* nomeadas — FQ-C1). */
  readonly problemas: readonly string[];
  constructor(problemas: readonly string[]) {
    super(
      "juntar-anexo-invalido",
      `roteiro revalidado com regras anexo-*:\n  - ${problemas.join("\n  - ")}`,
    );
    this.name = "ErroJuntarAnexoInvalido";
    this.problemas = problemas;
  }
}

/** 409 — roteiro nao valida (problemas fora das regras anexo-*). */
export class ErroJuntarRoteiroInvalido extends ErroJuntar {
  /** Os problemas do validarRoteiro (nao-anexo — o roteiro e invalido). */
  readonly problemas: readonly string[];
  constructor(problemas: readonly string[]) {
    super(
      "juntar-roteiro-invalido",
      `roteiro nao valida contra o contrato:\n  - ${problemas.join("\n  - ")}`,
    );
    this.name = "ErroJuntarRoteiroInvalido";
    this.problemas = problemas;
  }
}

/** 409 — algum pedaco sem preview (arquivo ausente ou nao declarado). */
export class ErroJuntarPreviewAusente extends ErroJuntar {
  /** Os pedacos sem preview (o 409 lista os ids). */
  readonly pedacos: readonly Pedaco[];
  constructor(pedacos: readonly Pedaco[]) {
    const ids = pedacos.map((p) => p.id).join(", ");
    super(
      "juntar-preview-ausente",
      `pedacos sem preview pronto — renderize o preview antes de juntar: ${ids}`,
    );
    this.name = "ErroJuntarPreviewAusente";
    this.pedacos = pedacos;
  }
}

/** Preview fora do FORMATO_VIDEO — nunca concat cego. */
export class ErroJuntarFormatosDivergentes extends ErroJuntar {
  /** As divergencias, uma por preview (ja com o id do pedaco). */
  readonly divergencias: readonly string[];
  constructor(divergencias: readonly string[]) {
    super(
      "juntar-formatos-divergentes",
      `previews divergem do ${FORMATO_VIDEO.video_codec} ${FORMATO_VIDEO.pix_fmt} ` +
        `${FORMATO_VIDEO.width}x${FORMATO_VIDEO.height} ${FORMATO_VIDEO.fps}fps + ` +
        `${FORMATO_VIDEO.audio_codec} ${FORMATO_VIDEO.audio_sample_rate}hz:\n  - ` +
        divergencias.join("\n  - "),
    );
    this.name = "ErroJuntarFormatosDivergentes";
    this.divergencias = divergencias;
  }
}

/** Falha de execucao (ffmpeg/ffprobe) ou de conferencia do proprio juntar. */
export class ErroJuntarRender extends ErroJuntar {
  constructor(mensagem: string) {
    super("juntar-render-falhou", mensagem);
    this.name = "ErroJuntarRender";
  }
}

// ─── Verificacao (os gates) ───────────────────────────────────────────────────

/** Um problema do verificarJuntavel — regra nomeada + pedacos envolvidos. */
export interface ProblemaDeJuntar {
  /** A regra violada (juntar-fala-sem-narracao | anexo-* | ...). */
  readonly regra: string;
  /** Os pedacos envolvidos (vazio para problemas de documento). */
  readonly pedacos: readonly Pedaco[];
  /** Mensagens detalhadas (as saidas do validarRoteiro, com a regra). */
  readonly detalhes: readonly string[];
}

/** Resultado do verificarJuntavel: ok, ou os problemas na ordem dos gates. */
export type ResultadoVerificacaoJuntar =
  | { readonly ok: true }
  | { readonly ok: false; readonly problemas: readonly ProblemaDeJuntar[] };

/** Prefixo das regras de anexo do contrato (o escopo da revalidacao). */
const REGRAS_DE_ANEXO = ["regra anexo-", "regra edicao-anexo-"];

/** Separa os problemas do validarRoteiro: anexo-* dos demais. */
function separarProblemasDeAnexo(problemas: readonly string[]): {
  anexo: string[];
  demais: string[];
} {
  const anexo: string[] = [];
  const demais: string[] = [];
  for (const problema of problemas) {
    if (REGRAS_DE_ANEXO.some((prefixo) => problema.includes(prefixo))) {
      anexo.push(problema);
    } else {
      demais.push(problema);
    }
  }
  return { anexo, demais };
}

/** Extrai a regra nomeada de uma mensagem do validador ("regra X — ..."). */
function regraDaMensagem(mensagem: string): string {
  const m = /regra (\S+)/.exec(mensagem);
  return m === null ? "regra-desconhecida" : m[1]!;
}

/**
 * Os gates do juntar — na ordem (documentada):
 *
 *   1. REVALIDACAO do roteiro (validarRoteiro): problemas de anexo
 *      (anexo-exigido-para-gif-video etc.) viram
 *      juntar-anexo-invalido — e o estado inconsistente que o catch-all
 *      "preview ausente" nao pega (DELETE de anexo depois do preview
 *      renderizado — REPLAN P5); problemas de OUTRA natureza viram
 *      juntar-roteiro-invalido (falha fechada — roteiro que nao valida
 *      nao se junta);
 *   2. GATE record-first: verificarJuntarFalaSemNarracao (a funcao da
 *      Onda 1 — CONSUMIDA, nunca reimplementada) — pedaco com fala e
 *      origem "nenhuma" renderizaria MUDO (C1);
 *   3. PREVIEWS: todo pedaco tem caminho declarado em `opcoes.previews`
 *      e o arquivo existe em disco (a presenca em disco, nao o conteudo —
 *      o conteudo e o ffprobe do juntar, passo 2).
 *
 * `verificarJuntavel` NAO lanca: devolve {ok:false, problemas}. Quem
 * junta (juntar/CLI) transforma os problemas nos erros nomeados 409.
 */
export function verificarJuntavel(
  roteiro: Roteiro,
  opcoes: OpcoesDeJuntar,
): ResultadoVerificacaoJuntar {
  // 1. Revalidacao (schema + semantica) — roda ANTES dos demais gates:
  //    um roteiro fora do contrato nao tem pedacos confiaveis para
  //    inspecionar (verificarJuntarFalaSemNarracao sobre shape invalido
  //    nem roda).
  const validacao = validarRoteiro(roteiro);
  if (!validacao.valido) {
    const { anexo, demais } = separarProblemasDeAnexo(validacao.problemas);
    if (anexo.length > 0) {
      return {
        ok: false,
        problemas: [
          { regra: "juntar-anexo-invalido", pedacos: [], detalhes: anexo },
        ],
      };
    }
    if (demais.length > 0) {
      return {
        ok: false,
        problemas: [
          { regra: "juntar-roteiro-invalido", pedacos: [], detalhes: demais },
        ],
      };
    }
  }

  // 2. Gate record-first — fala muda nunca chega ao video final.
  const falaSemNarracao = verificarJuntarFalaSemNarracao(roteiro);
  if (falaSemNarracao.length > 0) {
    const pedacos = roteiro.pedacos.filter(
      (p) => p.fala !== "" && p.narracao.origem === "nenhuma",
    );
    return {
      ok: false,
      problemas: [
        { regra: "juntar-fala-sem-narracao", pedacos, detalhes: falaSemNarracao },
      ],
    };
  }

  // 3. Previews presentes (arquivo existe em disco).
  const semPreview = roteiro.pedacos.filter((p) => {
    const caminho = opcoes.previews[p.id];
    return caminho === undefined || !existsSync(caminho);
  });
  if (semPreview.length > 0) {
    return {
      ok: false,
      problemas: [
        {
          regra: "juntar-preview-ausente",
          pedacos: semPreview,
          detalhes: semPreview.map(
            (p) =>
              `pedacos[${String(p.indice)}].id ${p.id}: preview ausente ` +
              `(opcoes.previews["${p.id}"] = ${String(opcoes.previews[p.id])})`,
          ),
        },
      ],
    };
  }

  return { ok: true };
}

/** Transforma os problemas do verificarJuntavel no primeiro erro nomeado. */
function erroDosProblemas(problemas: readonly ProblemaDeJuntar[]): ErroJuntar {
  const primeiro = problemas[0];
  if (primeiro === undefined) {
    return new ErroJuntarRoteiroInvalido(["verificacao falhou sem problemas — bug"]);
  }
  switch (primeiro.regra) {
    case "juntar-fala-sem-narracao":
      return new ErroJuntarFalaSemNarracao(primeiro.pedacos);
    case "juntar-anexo-invalido":
      return new ErroJuntarAnexoInvalido(primeiro.detalhes);
    case "juntar-preview-ausente":
      return new ErroJuntarPreviewAusente(primeiro.pedacos);
    case "juntar-roteiro-invalido":
      return new ErroJuntarRoteiroInvalido(primeiro.detalhes);
    default:
      // Regra desconhecida — nunca silencio: falha fechada com a regra.
      return new ErroJuntarRoteiroInvalido(primeiro.detalhes);
  }
}

// ─── Verificacao de formato dos previews (ffprobe — C4) ───────────────────────

/** Um preview e seus parametros lidos do arquivo (ffprobe por stream). */
interface ParametrosDePreview {
  readonly codec_video?: string;
  readonly pix_fmt?: string;
  readonly largura?: number;
  readonly altura?: number;
  readonly fps?: number;
  readonly codec_audio?: string;
  readonly sample_rate?: number;
  /** Canais do audio (1 = mono, 2 = stereo) — a consistencia e o gate. */
  readonly canais?: number;
  /** Layout de canais ("mono"/"stereo"/...) — a consistencia e o gate. */
  readonly channel_layout?: string;
}

/** Le os parametros de video+audio de um arquivo com ffprobe (por stream). */
async function parametrosDePreview(
  caminho: string,
  executor: ExecutorDeComando,
): Promise<ParametrosDePreview> {
  const video = await executor("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,pix_fmt,width,height,avg_frame_rate",
    "-of", "json",
    caminho,
  ]);
  const audio = await executor("ffprobe", [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "stream=codec_name,sample_rate,channels,channel_layout",
    "-of", "json",
    caminho,
  ]);
  const v = JSON.parse(video.stdout) as { streams?: Array<Record<string, unknown>> };
  const a = JSON.parse(audio.stdout) as { streams?: Array<Record<string, unknown>> };
  const vs = v.streams?.[0];
  const as = a.streams?.[0];
  const fps = (() => {
    const bruto = typeof vs?.avg_frame_rate === "string" ? vs.avg_frame_rate : undefined;
    if (bruto === undefined) return undefined;
    const [num, den] = bruto.split("/");
    const n = Number(num);
    const d = Number(den);
    if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return undefined;
    return n / d;
  })();
  // sample_rate sai como STRING no JSON do ffprobe ("48000") enquanto
  // width/height/channels saem numeros — normalizar pelos dois aceitos
  // (parse rigoroso: valor ilegivel e undefined, que vira divergencia).
  const taxa = as?.sample_rate;
  const sampleRate = typeof taxa === "number" || typeof taxa === "string"
    ? Number(taxa)
    : undefined;
  return {
    codec_video: typeof vs?.codec_name === "string" ? vs.codec_name : undefined,
    pix_fmt: typeof vs?.pix_fmt === "string" ? vs.pix_fmt : undefined,
    largura: typeof vs?.width === "number" ? vs.width : undefined,
    altura: typeof vs?.height === "number" ? vs.height : undefined,
    fps,
    codec_audio: typeof as?.codec_name === "string" ? as.codec_name : undefined,
    sample_rate: sampleRate !== undefined && Number.isFinite(sampleRate)
      ? sampleRate
      : undefined,
    canais: typeof as?.channels === "number" ? as.channels : undefined,
    channel_layout: typeof as?.channel_layout === "string" ? as.channel_layout : undefined,
  };
}

/**
 * Confere CADA preview contra o FORMATO_VIDEO (ffprobe por stream, C4) —
 * o gate do concat: params identicos por construcao, verificados por
 * evidencia. Devolve a lista de divergencias (vazia = todos conformes).
 *
 * Duas camadas:
 *   1. por preview: codec/pix_fmt/geometria/fps/audio contra o
 *      FORMATO_VIDEO (o que o contrato pina);
 *   2. CONSISTENCIA ENTRE PREVIEWS: canais e channel_layout iguais em
 *      todos. O contrato nao pina canais, mas o demuxer concat exige
 *      "same streams" — e a divergencia NAO falha alto: medido, um
 *      concat de mono+stereo sai com exit 0 e o segmento estereo perde
 *      um canal em silencio (revisao adversarial FQ-J8). O caminho de
 *      render produz estereo (2 canais) em toda a cadeia — consistencia
 *      implica 2 na pratica.
 */
async function verificarFormatosDosPreviews(
  roteiro: Roteiro,
  opcoes: OpcoesDeJuntar,
  executor: ExecutorDeComando,
): Promise<readonly string[]> {
  const divergencias: string[] = [];
  const formato = FORMATO_VIDEO;
  const parametros: Array<{ pedaco: Pedaco; caminho: string; params: ParametrosDePreview }> = [];
  for (const pedaco of roteiro.pedacos) {
    const caminho = opcoes.previews[pedaco.id]!;
    const params = await parametrosDePreview(caminho, executor);
    parametros.push({ pedaco, caminho, params });
    const divergenciasDoPedaco: string[] = [];
    const divergiu = (esperado: string | number | undefined, atual: string | number | undefined) =>
      atual === undefined || atual !== esperado;
    if (divergiu(formato.video_codec, params.codec_video)) {
      divergenciasDoPedaco.push(
        `codec de video ${String(params.codec_video)} (esperado ${formato.video_codec})`,
      );
    }
    if (divergiu(formato.pix_fmt, params.pix_fmt)) {
      divergenciasDoPedaco.push(
        `pix_fmt ${String(params.pix_fmt)} (esperado ${formato.pix_fmt})`,
      );
    }
    if (divergiu(formato.width, params.largura)) {
      divergenciasDoPedaco.push(
        `largura ${String(params.largura)} (esperado ${String(formato.width)})`,
      );
    }
    if (divergiu(formato.height, params.altura)) {
      divergenciasDoPedaco.push(
        `altura ${String(params.altura)} (esperado ${String(formato.height)})`,
      );
    }
    if (params.fps === undefined || Math.abs(params.fps - formato.fps) > 0.01) {
      divergenciasDoPedaco.push(`fps ${String(params.fps)} (esperado ${String(formato.fps)})`);
    }
    if (divergiu(formato.audio_codec, params.codec_audio)) {
      divergenciasDoPedaco.push(
        `codec de audio ${String(params.codec_audio)} (esperado ${formato.audio_codec})`,
      );
    }
    if (divergiu(formato.audio_sample_rate, params.sample_rate)) {
      divergenciasDoPedaco.push(
        `sample rate ${String(params.sample_rate)} (esperado ${String(formato.audio_sample_rate)})`,
      );
    }
    if (divergenciasDoPedaco.length > 0) {
      divergencias.push(
        `pedacos[${String(pedaco.indice)}].id ${pedaco.id} (${caminho}): ` +
          divergenciasDoPedaco.join("; "),
      );
    }
  }

  // Camada 2 — consistencia entre previews (canais/layout): o primeiro
  // preview e a referencia; qualquer divergencia dos irmaos e o caso
  // medido do concat silencioso com perda de canal.
  const referencia = parametros[0];
  if (referencia !== undefined) {
    for (const { pedaco, caminho, params } of parametros.slice(1)) {
      const inconsistencias: string[] = [];
      if (params.canais !== referencia.params.canais) {
        inconsistencias.push(
          `canais ${String(params.canais)} (o primeiro preview tem ${String(referencia.params.canais)})`,
        );
      }
      if (params.channel_layout !== referencia.params.channel_layout) {
        inconsistencias.push(
          `channel_layout ${String(params.channel_layout)} (o primeiro preview tem ` +
            `${String(referencia.params.channel_layout)})`,
        );
      }
      if (inconsistencias.length > 0) {
        divergencias.push(
          `pedacos[${String(pedaco.indice)}].id ${pedaco.id} (${caminho}): ` +
            `audio inconsistente com os demais previews: ${inconsistencias.join("; ")}`,
        );
      }
    }
  }

  return divergencias;
}

// ─── Os passos de midia ───────────────────────────────────────────────────────

/** Envolve um erro de execucao em ErroJuntarRender (com o stderr real). */
function erroDeExecucao(etapa: string, erro: unknown): ErroJuntarRender {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  return new ErroJuntarRender(`etapa "${etapa}" falhou:\n${mensagem}`);
}

/** Escapa um caminho para a linha `file '...'` do demuxer concat. */
function escaparCaminhoDoConcat(caminho: string): string {
  return `file '${caminho.split("'").join("'\\''")}'`;
}

/**
 * Concatena os previews com o demuxer concat em stream-copy (FQ-J1).
 * Os parametros JA foram conferidos por ffprobe (verificarFormatos
 * DosPreviews) — o demuxer nunca recebe segmentos divergentes.
 */
async function concatenarPreviews(
  caminhos: readonly string[],
  saida: string,
  executor: ExecutorDeComando,
): Promise<void> {
  const lista = caminhos.map(escaparCaminhoDoConcat).join("\n") + "\n";
  const listaPath = `${saida}.lista.txt`;
  await writeFile(listaPath, lista, "utf-8");
  try {
    await executor("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "concat", "-safe", "0",
      "-i", listaPath,
      "-c", "copy",
      // Os tres flags canonicos SEMPRE depois das entradas (NV-5): o
      // metadado do muxer (encoder, creation_time) fica fora do arquivo.
      "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
      saida,
    ]);
  } catch (erro) {
    throw erroDeExecucao("concat demuxer", erro);
  }
}

/** Decodifica o audio de um arquivo em WAV pcm f32le 48 kHz estereo. */
async function decodificarAudioParaWav(
  entrada: string,
  saida: string,
  executor: ExecutorDeComando,
): Promise<void> {
  try {
    await executor("ffmpeg", [
      "-y", "-hide_banner", "-loglevel", "error",
      "-i", entrada,
      "-map", "0:a:0",
      "-c:a", "pcm_f32le",
      "-ar", "48000",
      "-ac", "2",
      saida,
    ]);
  } catch (erro) {
    throw erroDeExecucao(`decode de audio (${entrada})`, erro);
  }
}

/**
 * Mistura a musica de fundo no PCM da fala — funcao PURA (determinismo
 * FQ-J3): ganho fixo MUSICA_GANHO_LINEAR (-20 dB), truncada/padded na
 * duracao da fala, somada amostra a amostra (src/audio/mix/pcm.ts).
 *
 * O mix fica em f32 (escreverWavPcm 32 bits) — amostras acima de 1.0
 * NAO clipam no arquivo (nada de conversao inteira); o ganho do passo
 * seguinte leva o master ao alvo e a conferencia de true peak no
 * CODIFICADO e a guarda final (a mesma disciplina do produzirPos).
 */
function misturarMusica(bytesFala: Buffer, bytesMusica: Buffer): Buffer {
  const fala: Pcm = lerWavPcm(bytesFala);
  const musica: Pcm = lerWavPcm(bytesMusica);
  const duracaoDaFala = fala.amostras.length / fala.rate / fala.canais;
  const musicaNoTempo = pcmNaDuracao(comGanho(musica, MUSICA_GANHO_LINEAR), duracaoDaFala);
  return escreverWavPcm(somar(fala, musicaNoTempo), 32);
}

/**
 * O SRT final: os cues de timing de cada pedaco deslocados pelo acumulo
 * das duracoes dos pedacos anteriores. NAO fabrica tempo (os numeros
 * vem do timing de TTS; srtTimecode so formata). Vazio quando nao ha
 * timing — gravacao nao deriva legendas (D4).
 */
export function gerarSrtFinal(
  roteiro: Roteiro,
  timingPorPedaco: Readonly<Record<string, readonly CueDeTiming[]>>,
): string {
  const blocos: string[] = [];
  let offset = 0;
  let numero = 0;
  for (const pedaco of roteiro.pedacos) {
    const cues = timingPorPedaco[pedaco.id];
    if (cues !== undefined) {
      for (const cue of cues) {
        numero += 1;
        blocos.push(
          `${String(numero)}\n` +
            `${srtTimecode(offset + cue.inicio_segundos)} --> ` +
            `${srtTimecode(offset + cue.fim_segundos)}\n` +
            `${cue.texto}`,
        );
      }
    }
    offset += pedaco.duracao_segundos;
  }
  return blocos.join("\n\n") + (blocos.length > 0 ? "\n" : "");
}

/** Duracao do stream de VIDEO (C4 — nunca o envelope do container). */
async function duracaoPorStream(caminho: string, executor: ExecutorDeComando): Promise<number> {
  const probe = await executor("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=duration",
    "-of", "csv=p=0",
    caminho,
  ]);
  const valor = probe.stdout.trim().split("\n").find((linha) => linha !== "N/A" && linha !== "");
  const duracao = valor === undefined ? Number.NaN : Number.parseFloat(valor);
  if (!Number.isFinite(duracao)) {
    throw new ErroJuntarRender(
      `duracao do stream de video nao lida em ${caminho} ` +
        `(saida do ffprobe: ${JSON.stringify(probe.stdout.trim())})`,
    );
  }
  return duracao;
}

/**
 * O `start_time` do stream de VIDEO do concat (segundos).
 *
 * O demuxer concat ALINHA todos os streams pelo pacote mais cedo: o
 * audio AAC dos previews carrega o priming (1024 amostras, 21,3 ms —
 * R03-22/23), entao o primeiro pacote de audio sai em -0.021 e o demuxer
 * desloca o VIDEO para +0.021 (medido: concat de 2 previews sem priming
 * nao desloca nada — so o audio dispara o alinhamento). O mux final
 * reverte o deslocamento com -itsoffset (ver muxarFinal): sem ele, o
 * video entregue comecaria 21 ms depois do audio (A/V drift de verdade,
 * e a duracao por stream leria soma - 21 ms).
 */
async function inicioDoStreamDeVideo(
  caminho: string,
  executor: ExecutorDeComando,
): Promise<number> {
  const probe = await executor("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=start_time",
    "-of", "csv=p=0",
    caminho,
  ]);
  const valor = probe.stdout.trim().split("\n").find((linha) => linha !== "N/A" && linha !== "");
  const inicio = valor === undefined ? Number.NaN : Number.parseFloat(valor);
  // Sem inicio lido, sem deslocamento (0) — conservador: um video com
  // inicio ilegivel nao merece um shift inventado, e o caso normal sem
  // priming ja le 0.000000.
  return Number.isFinite(inicio) ? inicio : 0;
}

// ─── O juntar ─────────────────────────────────────────────────────────────────

/** As medicoes registradas na entrega (FQ-J5 — ebur128). */
export interface MedicoesDoJuntar {
  /** Loudness integrada medida no master (ebur128 — 1a passada). */
  readonly masterIntegradoLufs: number;
  /** True peak medido no master (ebur128, dBTP). */
  readonly masterTruePeakDbtp: number;
  /** Ganho aplicado UMA vez (ADR-0040 — 2a passada). */
  readonly ganhoAplicadoDb: number;
  /** Loudness integrada medida no CODIFICADO (a conferencia final). */
  readonly entregavelIntegradoLufs: number;
  /** True peak medido no CODIFICADO (a conferencia final, dBTP). */
  readonly entregavelTruePeakDbtp: number;
  /** Alvo do gate (tokens — ADR-0040). */
  readonly alvoLufs: number;
  /** Tolerancia de medicao do alvo (ADR-0040). */
  readonly toleranciaLufs: number;
  /** Verdadeiro quando a trilha de fundo foi misturada. */
  readonly musicaAplicada: boolean;
}

/** O resultado do juntar — a entrega enderecada por hash (C7/S-8). */
export interface ResultadoDeJuntar {
  /** SHA-256 dos bytes do mp4 final (o endereco da entrega). */
  readonly hash: string;
  /** Caminho de disco do mp4 (dirEntregas/<hash>.mp4). */
  readonly caminho: string;
  /** Duracao do stream de video (ffprobe por stream — C4, FQ-J1). */
  readonly duracaoSegundos: number;
  /** Caminho do SRT final (presente SO quando houve timing de TTS). */
  readonly srtCaminho?: string;
  /** As medicoes registradas (o lado FQ-J5 da entrega). */
  readonly medicoes: MedicoesDoJuntar;
}

/**
 * Junta e entrega: gates -> formatos (ffprobe) -> concat -> musica ->
 * loudness (ADR-0040) -> SRT (se houver timing) -> mux -> grava por hash.
 *
 * @throws ErroJuntarFalaSemNarracao | ErroJuntarAnexoInvalido |
 *         ErroJuntarRoteiroInvalido | ErroJuntarPreviewAusente |
 *         ErroJuntarFormatosDivergentes | ErroJuntarRender
 */
export async function juntar(
  roteiro: Roteiro,
  opcoes: OpcoesDeJuntar,
): Promise<ResultadoDeJuntar> {
  // 1. Gates — nada comeca antes (409 na porta).
  const verificacao = verificarJuntavel(roteiro, opcoes);
  if (!verificacao.ok) {
    throw erroDosProblemas(verificacao.problemas);
  }

  const executor = opcoes.executor ?? executorPadrao;
  const executorBruto = opcoes.executorBruto ?? executorBrutoPadrao;
  const dirTrabalho = opcoes.dirTrabalho ?? DIR_TRABALHO_DEFAULT;
  const dirEntregas = opcoes.dirEntregas ?? DIR_ENTREGAS_DEFAULT;
  // Pin da ferramenta ANTES de qualquer trabalho (fail-fast): o
  // determinismo entre versoes e declarado por pin, nunca assumido
  // (ADR-0040) — um ffmpeg fora do pin nao produz entrega nenhuma.
  const ffmpeg = await versaoDoFfmpeg(executor);
  if (!/^6\.1\.1/.test(ffmpeg)) {
    throw new ErroJuntarRender(
      `ffmpeg corrente ${ffmpeg} diverge do pin 6.1.1 (ADR-0040) — ` +
        "o determinismo entre versoes e declarado por pin, nunca assumido",
    );
  }
  await mkdir(dirTrabalho, { recursive: true });
  await mkdir(dirEntregas, { recursive: true });

  // 2. Formatos por ffprobe — nunca concat cego.
  const divergencias = await verificarFormatosDosPreviews(roteiro, opcoes, executor);
  if (divergencias.length > 0) {
    throw new ErroJuntarFormatosDivergentes(divergencias);
  }

  const caminhosDosPreviews = roteiro.pedacos.map((p) => opcoes.previews[p.id]!);

  // 3. Concat (stream-copy — FQ-J1).
  const concatPath = join(dirTrabalho, "concatenado.mp4");
  await concatenarPreviews(caminhosDosPreviews, concatPath, executor);

  // 4. Audio da fala (decode pcm f32le 48k) + musica opcional (mix puro).
  const falaPath = join(dirTrabalho, "fala.wav");
  await decodificarAudioParaWav(concatPath, falaPath, executor);
  // Anotacao explicita: o readFile do fs/promises tipa Buffer<ArrayBuffer>
  // e o mix puro devolve Buffer<ArrayBufferLike> — a variavel e o ponto
  // de juncao dos dois.
  let masterBytes: Buffer = await readFile(falaPath);
  let musicaAplicada = false;
  if (opcoes.musica_caminho !== undefined) {
    const musicaPath = join(dirTrabalho, "musica.wav");
    await decodificarAudioParaWav(opcoes.musica_caminho, musicaPath, executor);
    const bytesMusica = await readFile(musicaPath);
    masterBytes = misturarMusica(masterBytes, bytesMusica);
    musicaAplicada = true;
  }
  const masterPath = join(dirTrabalho, "master.wav");
  await writeFile(masterPath, masterBytes);

  // 5. Loudness EBU R 128 no padrao do repo (ADR-0040): medir (1a
  //    passada) -> ganho UMA vez no PCM (2a passada) -> conferir no
  //    codificado. O alvo e dos tokens (S-5, leitura).
  const alvo = alvoDoPos();
  const medicaoDoMaster = await medirLoudness(masterPath, executor);
  const ganho = computarGanho(alvo, medicaoDoMaster.integradoLufs, medicaoDoMaster.truePeakDbtp);
  const normalizado = aplicarGanhoNoMaster(masterBytes, ganho.ganhoAplicadoDb);
  const normalizadoPath = join(dirTrabalho, "normalizado.wav");
  await writeFile(normalizadoPath, normalizado.wav);

  // 6. Encode AAC com o perfil do pos (deterministico: true, bitexact).
  const audioPath = join(dirTrabalho, "audio.m4a");
  const comandoAudio = montarComandoAudio(PERFIL_AUDIO_POS, normalizadoPath, audioPath);
  try {
    await executor(comandoAudio[0]!, comandoAudio.slice(1));
  } catch (erro) {
    throw erroDeExecucao("encode de audio", erro);
  }

  // 7. Conferencia no CODIFICADO (a mesma disciplina do produzirPos —
  //    ADR-0040 decisao 2: medir o entregavel, decodificado de volta).
  const medicaoDoEntregavel = await medirLoudness(audioPath, executor);
  if (
    Math.abs(medicaoDoEntregavel.integradoLufs - alvo.targetLufs) >
    alvo.toleranciaMedicaoLu
  ) {
    throw new ErroJuntarRender(
      `entregavel fora do alvo de LUFS: medido ${medicaoDoEntregavel.integradoLufs.toFixed(2)}, ` +
        `alvo ${alvo.targetLufs.toFixed(2)} ± ${alvo.toleranciaMedicaoLu} LU — ` +
        "o juntar nunca entrega fora do alvo (∅-crit do pos)",
    );
  }
  if (medicaoDoEntregavel.truePeakDbtp > alvo.maxTruePeakDbtp + alvo.toleranciaMedicaoLu) {
    throw new ErroJuntarRender(
      `true peak ${medicaoDoEntregavel.truePeakDbtp.toFixed(2)} dBTP acima do teto ` +
        `${alvo.maxTruePeakDbtp.toFixed(2)} + ${alvo.toleranciaMedicaoLu} LU no codificado`,
    );
  }

  // 8. Mux: video (copy) + audio AAC normalizado (o mesmo comando do
  //    estagioMux do produzir — bitexact apos as entradas), com DOIS
  //    reparos medidos:
  //    - `-itsoffset -<inicio do video no concat>`: reverte o
  //      deslocamento +21 ms que o demuxer concat aplicou ao video por
  //      causa do priming AAC (inicioDoStreamDeVideo) — sem ele o video
  //      entregue comeca 21 ms depois do audio;
  //    - `-use_editlist 0`: escreve a duracao da trilha de video pelos
  //      timestamps reais (soma exata — FQ-J1) e descarta o pacote de
  //      priming negativo do audio (o "Skip Samples" do edit list, que
  //      o muxer nao representa sem edit list) — o audio entregue
  //      comeca no conteudo real, em 0.
  const inicioDoVideo = await inicioDoStreamDeVideo(concatPath, executor);
  const muxPath = join(dirTrabalho, "final.mp4");
  try {
    const argv: string[] = ["-y", "-hide_banner", "-loglevel", "error"];
    if (Math.abs(inicioDoVideo) > 1e-9) {
      argv.push("-itsoffset", String(-inicioDoVideo));
    }
    argv.push(
      "-i", concatPath,
      "-i", audioPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c", "copy",
      "-use_editlist", "0",
      "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
      muxPath,
    );
    await executor("ffmpeg", argv);
  } catch (erro) {
    throw erroDeExecucao("mux final", erro);
  }
  const bytesFinais = await readFile(muxPath);
  if (bytesFinais.length === 0) {
    throw new ErroJuntarRender("a muxagem nao escreveu bytes (C1)");
  }

  // 9. Estrutura minima do muxado (fail-fast, C4): video+audio.
  const probe = await executor("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type",
    "-of", "csv=p=0",
    muxPath,
  ]);
  const streams = probe.stdout.trim().split("\n").filter((s) => s !== "");
  if (!streams.includes("video") || !streams.includes("audio")) {
    throw new ErroJuntarRender(
      `o mp4 muxado nao tem video+audio (streams: ${streams.join(" | ") || "(vazio)"})`,
    );
  }

  // 10. Entrega por hash (C7/S-8): <hash>.mp4 + sidecar <hash>.json +
  //     <hash>.srt (so quando houver timing).
  const hash = sha256Hex(bytesFinais);
  const caminhoFinal = join(dirEntregas, `${hash}.mp4`);
  await escreverAtomico(caminhoFinal, bytesFinais);

  const medicoes: MedicoesDoJuntar = {
    masterIntegradoLufs: medicaoDoMaster.integradoLufs,
    masterTruePeakDbtp: medicaoDoMaster.truePeakDbtp,
    ganhoAplicadoDb: ganho.ganhoAplicadoDb,
    entregavelIntegradoLufs: medicaoDoEntregavel.integradoLufs,
    entregavelTruePeakDbtp: medicaoDoEntregavel.truePeakDbtp,
    alvoLufs: alvo.targetLufs,
    toleranciaLufs: alvo.toleranciaMedicaoLu,
    musicaAplicada,
  };

  let srtCaminho: string | undefined;
  const timing = opcoes.timing_pedacos ?? {};
  const temTiming = roteiro.pedacos.some(
    (p) => timing[p.id] !== undefined && timing[p.id]!.length > 0,
  );
  if (temTiming) {
    const srt = gerarSrtFinal(roteiro, timing);
    srtCaminho = join(dirEntregas, `${hash}.srt`);
    await escreverAtomico(srtCaminho, Buffer.from(srt, "utf-8"));
  }

  const duracaoSegundos = await duracaoPorStream(caminhoFinal, executor);

  const sidecar = {
    schema_version: FORMATO_SIDECAR_ENTREGA,
    hash,
    arquivo: `${hash}.mp4`,
    duracao_segundos: duracaoSegundos,
    pedacos: roteiro.pedacos.length,
    musica: {
      aplicada: musicaAplicada,
      ganho_linear: MUSICA_GANHO_LINEAR,
      ganho_db: MUSICA_GANHO_DB,
      decisao:
        "volume fixo -20 dB, sem ducking — ducking exige os intervalos da fala e a " +
        "gravacao nao tem timing (D4); a normalizacao EBU R128 equaliza o master; " +
        "o mix em PCM e funcao pura (FQ-J3)",
    },
    loudness: {
      alvo_lufs: medicoes.alvoLufs,
      tolerancia_lu: medicoes.toleranciaLufs,
      master_integrado_lufs: medicoes.masterIntegradoLufs,
      master_true_peak_dbtp: medicoes.masterTruePeakDbtp,
      ganho_aplicado_db: medicoes.ganhoAplicadoDb,
      entregavel_integrado_lufs: medicoes.entregavelIntegradoLufs,
      entregavel_true_peak_dbtp: medicoes.entregavelTruePeakDbtp,
    },
    srt: { gerado: srtCaminho !== undefined, arquivo: srtCaminho === undefined ? null : `${hash}.srt` },
    formatos_verificados: true,
    ferramentas: { ffmpeg, node: process.version },
  };
  await escreverAtomico(
    join(dirEntregas, `${hash}.json`),
    Buffer.from(`${JSON.stringify(sidecar, null, 2)}\n`, "utf-8"),
  );

  return { hash, caminho: caminhoFinal, duracaoSegundos, srtCaminho, medicoes };
}

// ─── O oraculo (C1 + C4) ──────────────────────────────────────────────────────

/** Entradas da conferencia da entrega (o oraculo do juntar). */
export interface OpcoesDeConferencia {
  /** Diretorio das entregas (default: .cache/roteiro/entregas). */
  readonly dirEntregas?: string;
  readonly executor?: ExecutorDeComando;
  readonly executorBruto?: ExecutorBruto;
}

/** Resultado da conferencia — problemas vazio = VERDE. */
export interface ConferenciaDeEntrega {
  readonly problemas: readonly string[];
  /** A medida de conteudo (yavg/desvio por frame amostrado — C1). */
  readonly medida: MedidaDeConteudo;
}

/**
 * O ORACULO da entrega — o que responde "este mp4 esta vivo?" sem
 * confiar no que o juntar gravou:
 *
 *   - existencia + identidade: o arquivo <hash>.mp4 existe e seus bytes
 *     medem exatamente o hash do nome (S-8/C7);
 *   - conteudo (C1): REUSE do oraculo do produzir — medirConteudoDeBytes
 *     + reprovadoPorConteudo sobre frames amostrados (decodificados por
 *     executorBruto, rawvideo): um video 100% preto/chapado passa em
 *     toda a camada estrutural e e reprovado aqui (PISO_YAVG_MAXIMO);
 *   - streams (C4): video+audio presentes, por stream (codec_type), e
 *     os parametros do video conferem com o FORMATO_VIDEO.
 *
 * Problemas vazio = VERDE (o servidor/Onda 5 chama apos o job ok).
 */
export async function conferirEntrega(
  hash: string,
  opcoes: OpcoesDeConferencia = {},
): Promise<ConferenciaDeEntrega> {
  const problemas: string[] = [];
  const executor = opcoes.executor ?? executorPadrao;
  const executorBruto = opcoes.executorBruto ?? executorBrutoPadrao;
  const dirEntregas = opcoes.dirEntregas ?? DIR_ENTREGAS_DEFAULT;
  const caminho = join(dirEntregas, `${hash}.mp4`);

  if (!existsSync(caminho)) {
    return { problemas: [`entrega ausente: ${caminho}`], medida: { yavgMaximo: 0, desvioMaximo: 0 } };
  }
  const bytes = await readFile(caminho);
  if (sha256Hex(bytes) !== hash) {
    problemas.push(
      `os bytes de ${caminho} nao medem o hash do nome (${hash.slice(0, 16)}…) — ` +
        "identidade por conteudo violada (S-8)",
    );
  }

  // C4 — streams por stream (nunca o envelope do container).
  const probe = await executor("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,pix_fmt,width,height,sample_rate",
    "-of", "json",
    caminho,
  ]);
  const json = JSON.parse(probe.stdout) as { streams?: Array<Record<string, unknown>> };
  const streams = json.streams ?? [];
  const tipos = streams.map((s) => String(s.codec_type));
  if (!tipos.includes("video")) {
    problemas.push(`sem stream de video (streams: ${tipos.join(" | ") || "(vazio)"})`);
  }
  if (!tipos.includes("audio")) {
    problemas.push(`sem stream de audio (streams: ${tipos.join(" | ") || "(vazio)"})`);
  }
  const video = streams.find((s) => s.codec_type === "video");
  if (video !== undefined) {
    const conferir = (campo: string, esperado: string | number): void => {
      if (String(video[campo]) !== String(esperado)) {
        problemas.push(
          `stream de video ${campo} ${String(video[campo])} (esperado ${String(esperado)})`,
        );
      }
    };
    conferir("codec_name", FORMATO_VIDEO.video_codec);
    conferir("pix_fmt", FORMATO_VIDEO.pix_fmt);
    conferir("width", FORMATO_VIDEO.width);
    conferir("height", FORMATO_VIDEO.height);
  }
  const audio = streams.find((s) => s.codec_type === "audio");
  if (audio !== undefined) {
    conferirStreamAudio(audio, problemas);
  }

  // C1 — conteudo: decodifica frames amostrados (rawvideo, luma) e mede
  // yavg/desvio — o oraculo do produzir (medirConteudoDeBytes).
  const saida = await executorBruto("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-i", caminho,
    "-vf", `fps=${String(AMOSTRAGEM_DE_FRAMES)},extractplanes=y`,
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ]);
  const medida = medirConteudoDeBytes(saida.stdout, FORMATO_VIDEO.width, FORMATO_VIDEO.height);
  if (reprovadoPorConteudo(medida)) {
    problemas.push(
      `o video final e (quase) chapado: yavg maximo por frame ` +
        `${String(medida.yavgMaximo)} e desvio-padrao maximo ` +
        `${String(medida.desvioMaximo)} — quadro preto/chapado passa em toda a ` +
        "camada estrutural (C1) e e reprovado aqui",
    );
  }

  return { problemas, medida };
}

/** Confere os parametros do stream de audio contra o FORMATO_VIDEO. */
function conferirStreamAudio(
  audio: Record<string, unknown>,
  problemas: string[],
): void {
  const codec = String(audio.codec_name);
  const taxa = String(audio.sample_rate);
  if (codec !== FORMATO_VIDEO.audio_codec) {
    problemas.push(`stream de audio codec ${codec} (esperado ${FORMATO_VIDEO.audio_codec})`);
  }
  if (taxa !== String(FORMATO_VIDEO.audio_sample_rate)) {
    problemas.push(
      `stream de audio sample_rate ${taxa} (esperado ${String(FORMATO_VIDEO.audio_sample_rate)})`,
    );
  }
}
