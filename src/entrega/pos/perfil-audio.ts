/**
 * src/entrega/pos/perfil-audio.ts
 *
 * O PERFIL DE ENCODE DE AUDIO DO POS — card F5-03 (W8). ADR-0040
 * decisao 5 + contrato-w8 §2.
 *
 * O contrato-w8 §2 manda: "o encode de audio do master para a
 * conferencia de *true peak* DEPOIS da codificacao usa os perfis de
 * encode do F5-02 (ADR-0036) — e so perfis `deterministico: true`
 * participam da comparacao". O catalogo do F5-02 (`listarPerfis`) nao
 * tem perfil de AUDIO (os dois perfis sao de video: entrega-nvenc e
 * entrega-software); o card cria o SEU com **o mesmo contrato** — o
 * perfil e um OBJETO INTEIRO com o alvo de qualidade DECLARADO no eixo
 * do encoder, a declaracao de determinismo OBRIGATORIA com justificativa
 * medida, e a linha de comando nasce de UM construtor unico com os tres
 * flags canonicos do F5-02 (`FLAGS_BITEXACT`, sempre DEPOIS das
 * entradas — ffmpeg-media-ops, NV-5).
 *
 * Mapeamento do contrato do F5-02 (PerfilEncode) para audio:
 *
 *   PerfilEncode            ->  aqui (audio)
 *   motor (nvenc|libx264)   ->  "libx264" — o eixo de SOFTWARE, o unico
 *                               que declara determinismo (a fila do
 *                               motor libx264 e a fila do F5-02 usada
 *                               com limites injetados pelo card).
 *   codec (valor de -c:v)   ->  "aac" (valor de -c:a) — o encoder nativo
 *                               do ffmpeg.
 *   alvoQualidade crf|cq|qp ->  { tipo: "bitrate", valor: 192 } (kbps) —
 *                               o eixo de qualidade do aac nativo.
 *   preset (veryfast..)     ->  "aac-lc" — o PERFIL do codec (AAC-LC, o
 *                               default do encoder nativo), nao preset.
 *   pixFmt                  ->  NAO SE APLICA a audio (campo de video) —
 *                               ausente por declaracao, documentado aqui.
 *   argsExtra               ->  vazio.
 *
 * O determinismo DECLARADO e TESTADO ao vivo pelo gate (2x encodes do
 * mesmo master = bytes identicos) — a mesma disciplina do gate do F5-02.
 * A fila de encode e INJETADA (instancia propria do card, criada por
 * `criarFilaDeEncode` do F5-02): o dono da fila compartilhada do
 * processo e o F5-07 (AB-705, W9) — o pos nunca a toca.
 */

import { FLAGS_BITEXACT } from "../../render/encode/comando.js";

// ─── O perfil ─────────────────────────────────────────────────────────────────

/** O eixo de execucao do perfil de audio do pos (software, deterministico). */
export type MotorAudioPos = "libx264";

/** O alvo de qualidade do aac nativo: bitrate em kbps (o eixo de audio). */
export interface AlvoQualidadeAudio {
  readonly tipo: "bitrate";
  /** Bitrate em kbps (o valor de -b:a). */
  readonly valor: number;
}

/** O perfil de audio do pos — o objeto inteiro (contrato F5-02, eixo audio). */
export interface PerfilAudioPos {
  /** Nome unico do perfil. */
  readonly nome: string;
  /** O motor — o eixo de execucao (a fila do F5-02 usa este motor). */
  readonly motor: MotorAudioPos;
  /** O valor exato de `-c:a` ("aac"). */
  readonly codec: string;
  /**
   * DECLARACAO de determinismo (emenda da W7, contrato-w7 §6): `true` =
   * 2x encodes produzem bytes identicos, testado pelo gate ao vivo.
   */
  readonly deterministico: boolean;
  /** Por que a declaracao vale (obrigatorio — evidencia medida, nao prosa). */
  readonly justificativaDeterminismo: string;
  /** O alvo de qualidade — OBRIGATORIO (∅-crit do PROGRAMA). */
  readonly alvoQualidade: AlvoQualidadeAudio;
  /** O perfil do codec AAC (aac-lc — o default do encoder nativo). */
  readonly preset: string;
  /** Argumentos extras validados do encoder (vazio quando nao ha). */
  readonly argsExtra: readonly string[];
}

/** O perfil de audio do pos — o unico que participa da comparacao. */
export const PERFIL_AUDIO_POS: PerfilAudioPos = {
  nome: "pos-audio-aac",
  motor: "libx264",
  codec: "aac",
  deterministico: true,
  justificativaDeterminismo:
    "medido em ffmpeg 6.1.1-3ubuntu5 (2026-08-13): 2x encodes do MESMO WAV " +
    "(master da fixture canonica, F3-05) com os flags canonicos do F5-02 " +
    "(FLAGS_BITEXACT depois das entradas) produzem bytes de arquivo IDENTICOS " +
    "(sha256 igual); o encoder nativo aac do ffmpeg e deterministico na cadeia " +
    "pinada. Vale para a cadeia pinada — bump de ffmpeg invalida (padrao AB-703). " +
    "Testado ao vivo pelo gate `just pos` (sonda de determinismo).",
  alvoQualidade: { tipo: "bitrate", valor: 192 },
  preset: "aac-lc",
  argsExtra: [],
};

// ─── Validacao ─────────────────────────────────────────────────────────────────

/** Perfil de audio invalido tentou virar comando (nao alcancavel por contrato). */
export class EPerfilAudioInvalido extends Error {
  readonly code = "POS_PERFIL_AUDIO_INVALIDO";
  constructor(readonly erros: string[]) {
    super(`perfil de audio do pos invalido:\n  - ${erros.join("\n  - ")}`);
    this.name = "EPerfilAudioInvalido";
  }
}

/**
 * Valida o perfil contra o contrato (o ∅-crit do PROGRAMA em forma
 * executavel): alvo de qualidade DECLARADO, determinismo declarado com
 * justificativa. Devolve a lista de erros; vazia = valido.
 */
export function validarPerfilAudio(entrada: unknown): string[] {
  const erros: string[] = [];
  if (typeof entrada !== "object" || entrada === null) {
    return ["perfil nao e um objeto"];
  }
  const p = entrada as Record<string, unknown>;
  if (typeof p.nome !== "string" || p.nome.trim() === "") {
    erros.push("nome: string nao-vazia obrigatoria");
  }
  if (p.motor !== "libx264") {
    erros.push("motor: o unico eixo do pos e 'libx264' (software, deterministico)");
  }
  if (typeof p.codec !== "string" || p.codec.trim() === "") {
    erros.push("codec: string nao-vazia obrigatoria (o valor exato de -c:a)");
  }
  if (typeof p.deterministico !== "boolean") {
    erros.push("deterministico: declaracao OBRIGATORIA (emenda da W7, contrato-w7 §6)");
  }
  if (typeof p.justificativaDeterminismo !== "string" || p.justificativaDeterminismo.trim() === "") {
    erros.push(
      "justificativaDeterminismo: obrigatoria — a declaracao de determinismo exige a evidencia do por que",
    );
  }
  if (typeof p.alvoQualidade !== "object" || p.alvoQualidade === null) {
    erros.push("alvoQualidade: OBRIGATORIO (∅-crit) — perfil sem alvo declarado e invalido");
  } else {
    const alvo = p.alvoQualidade as Record<string, unknown>;
    if (alvo.tipo !== "bitrate") {
      erros.push("alvoQualidade.tipo: o eixo de audio do pos e 'bitrate'");
    }
    if (
      typeof alvo.valor !== "number" ||
      !Number.isFinite(alvo.valor) ||
      (alvo.valor as number) <= 0
    ) {
      erros.push("alvoQualidade.valor: kbps positivo obrigatorio");
    }
  }
  if (typeof p.preset !== "string" || p.preset.trim() === "") {
    erros.push("preset: string nao-vazia obrigatoria (o perfil do codec AAC)");
  }
  if (!Array.isArray(p.argsExtra)) {
    erros.push("argsExtra: array obrigatorio (pode ser vazio)");
  }
  return erros;
}

// ─── A guarda de determinismo ──────────────────────────────────────────────────

/**
 * Perfil `deterministico: false` recusado na comparacao do pos —
 * contrato-w8 §2: "e so perfis `deterministico: true` participam da
 * comparacao" (NVENC, AB-700, nunca participa — o mesmo espirito da
 * recusa de golden do F5-02).
 */
export class EPerfilNaoDeterministico extends Error {
  readonly code = "POS_PERFIL_NAO_DETERMINISTICO";
  constructor(readonly perfil: { readonly nome: string }) {
    super(
      `perfil "${perfil.nome}" recusado na comparacao do pos: o perfil declara ` +
        "deterministico: false — so perfis deterministico: true participam " +
        "(contrato-w8 §2, ADR-0040 decisao 5)",
    );
    this.name = "EPerfilNaoDeterministico";
  }
}

// ─── O construtor unico de comando ────────────────────────────────────────────

/**
 * Monta o argv completo do encode de audio do pos: ffmpeg + entrada +
 * opcoes do perfil + os tres flags canonicos do F5-02 SEMPRE depois das
 * entradas (NV-5) + saida (m4a — contêiner mp4, aac).
 *
 * A mesma disciplina do `montarComando` do F5-02: flag de encoder nao
 * se espalha pelos cards; o comando do pos nasce aqui, com o bitexact
 * na posicao que funciona.
 */
export function montarComandoAudio(
  perfil: PerfilAudioPos,
  entrada: string,
  saida: string,
): string[] {
  const erros = validarPerfilAudio(perfil);
  if (erros.length > 0) {
    throw new EPerfilAudioInvalido(erros);
  }
  if (perfil.deterministico !== true) {
    throw new EPerfilNaoDeterministico(perfil);
  }

  const argv: string[] = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"];
  argv.push("-i", entrada);
  argv.push("-c:a", perfil.codec);
  argv.push("-b:a", `${perfil.alvoQualidade.valor}k`);
  argv.push(...perfil.argsExtra);

  // Os tres flags canonicos — SEMPRE depois das entradas (NV-5): o
  // metadado nao-deterministico (encoder, creation_time) fica fora do
  // arquivo e dois encodes da mesma entrada produzem bytes identicos.
  argv.push(...FLAGS_BITEXACT);

  argv.push("-f", "mp4", saida);
  return argv;
}
