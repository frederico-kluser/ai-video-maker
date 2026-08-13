/**
 * src/render/encode/formato.ts
 *
 * O PERFIL DE ENCODE — a forma do objeto inteiro (card F5-02, onda W7).
 *
 * A decisao congelada no ADR-0036: o perfil e um OBJETO INTEIRO
 * (codec, rate control, alvo de qualidade, pixel format, extras), e a
 * linha de comando nasce de UM construtor unico (`comando.ts`) — nunca
 * flag de encoder espalhada pelos cards. Trocar `libx264` por `h264_nvenc`
 * mantendo `-crf` nao e substituicao de encoder: e mudanca de CONTRATO DE
 * QUALIDADE, sem nada ficar vermelho (R10-01, ffmpeg-media-ops).
 *
 * ─── Os dois eixos, que nunca se comparam ────────────────────────────────
 *
 *   libx264 (software): alvo de qualidade = CRF (-crf N, 0..51).
 *   NVENC (hardware):   NAO TEM CRF — alvo = -rc vbr -cq N (qualidade
 *                       constante em VBR) ou -rc constqp -qp N (QP fixo).
 *
 * Nenhum numero de CRF e comparavel a nenhum numero de CQ: as escalas sao
 * de implementacoes diferentes, sem equivalencia (placar 3-0, ffmpeg-
 * media-ops). Um perfil que declare um alvo no eixo errado do motor e
 * INVALIDO — e o teste que impede o falso verde da flag sobrando (o
 * `-crf` num encoder sem a opcao nao aborta o comando: exit 0, aviso no
 * log e rate control default).
 *
 * ─── O ∅-crit e a emenda da W7 (contrato-w7 §6) ─────────────────────────
 *
 *   ∅-crit do PROGRAMA: um perfil SEM ALVO DE QUALIDADE DECLARADO tem de
 *   falhar — `alvoQualidade` e obrigatorio e `validarPerfil` devolve erro
 *   na ausencia dele; o gate `encode-perfis` roda `listarPerfis()`, que
 *   falha alto no primeiro perfil invalido.
 *
 *   Emenda da W7: o perfil DECLARA SE O ENCODE E DETERMINISTICO
 *   (`deterministico: true | false`, obrigatorio). Goldens so existem em
 *   perfis deterministicos (`golden.ts` recusa os demais). O determinismo
 *   declarado e TESTADO (2x bytes identicos) nos deterministicos — a
 *   justificativa da declaracao fica no proprio perfil.
 */

// ─── Eixos ───────────────────────────────────────────────────────────────────

/** O motor de encode — o eixo de execucao (fila por motor, fallback por motor). */
export type MotorEncode = "nvenc" | "libx264";

/**
 * O tipo do alvo de qualidade — o EIXO de qualidade.
 *
 * `crf` so existe em encoders de software (libx264); `cq`/`qp` so existem
 * no vocabulario do NVENC. O eixo e a pergunta adversarial 1 do card:
 * hardware e software NAO se comparam pelo mesmo eixo — um nao tem CRF.
 */
export type TipoAlvoQualidade = "crf" | "cq" | "qp";

/** Alvo de qualidade declarado. OBRIGATORIO (∅-crit). */
export interface AlvoQualidade {
  /** O eixo do alvo (crf | cq | qp). */
  tipo: TipoAlvoQualidade;
  /**
   * O valor do alvo.
   *
   * - crf: 0..51 (0 = lossless — alvo valido).
   * - cq: 1..51 (o 0 do NVENC significa "automatico" = SEM alvo
   *   declarado — invalido por construcao, e o ∅-crit nao abre excecao).
   * - qp: 0..51.
   */
  valor: number;
}

/** Um perfil de encode completo — o objeto inteiro (ADR-0036, decisao 1). */
export interface PerfilEncode {
  /** Nome unico do perfil (deriva do arquivo em `perfis/`). */
  nome: string;
  /** O motor — o eixo de execucao. */
  motor: MotorEncode;
  /** O valor exato de `-c:v`. */
  codec: string;
  /**
   * DECLARACAO de determinismo (emenda da W7, contrato-w7 §6).
   *
   * `true`  = o encode e reproduzivel byte a byte (2x bytes identicos,
   *           testado pelo gate e pela suite). Goldens podem existir.
   * `false` = sem garantia de bytes identicos entre execucoes (ex.:
   *           NVENC — o resultado depende da sessao do encoder/driver).
   *           Nunca vira linha de base de bytes (`golden.ts` recusa).
   */
  deterministico: boolean;
  /** Por que esta declaracao de determinismo vale (obrigatorio — prosa nao, evidencia). */
  justificativaDeterminismo: string;
  /** O alvo de qualidade — OBRIGATORIO (∅-crit), no eixo do motor. */
  alvoQualidade: AlvoQualidade;
  /**
   * O preset do encoder:
   * - libx264: veryfast..veryslow (default da familia: medium);
   * - NVENC: p1..p7 (o p5 e o medido na maquina — I-03, docs/medicao/maquina.md).
   */
  preset: string;
  /** Pixel format de saida (ex.: yuv420p). */
  pixFmt: string;
  /** Argumentos extras validados do encoder (vazio quando nao ha). */
  argsExtra: string[];
}

// ─── Faixas validas de cada eixo ─────────────────────────────────────────────

/** crf 0..51 — 0 e lossless e e um alvo legitimo no software. */
export const CRF_MIN = 0;
export const CRF_MAX = 51;
/** cq 1..51 — 0 e "automatico" no NVENC: declarar 0 e nao declarar alvo. */
export const CQ_MIN = 1;
export const CQ_MAX = 51;
/** qp 0..51. */
export const QP_MIN = 0;
export const QP_MAX = 51;

/** O valor default de teto de sessoes (I-03/ADR-0032, decisao 2): 4+4. */
export const LIMITES_PADRAO = { nvenc: 4, libx264: 4 } as const;

// ─── Validacao ───────────────────────────────────────────────────────────────

/**
 * Valida um perfil contra o contrato. Devolve a lista de erros; vazia =
 * perfil valido. A funcao nao lanca: quem a chama decide o que fazer com
 * os erros (o ∅-crit do gate usa o erro para falhar alto).
 */
export function validarPerfil(entrada: unknown): string[] {
  const erros: string[] = [];
  if (typeof entrada !== "object" || entrada === null) {
    return ["perfil nao e um objeto"];
  }
  const p = entrada as Record<string, unknown>;

  if (typeof p.nome !== "string" || p.nome.trim() === "") {
    erros.push("nome: string nao-vazia obrigatoria");
  }
  if (p.motor !== "nvenc" && p.motor !== "libx264") {
    erros.push("motor: deve ser 'nvenc' ou 'libx264'");
  }
  if (typeof p.codec !== "string" || p.codec.trim() === "") {
    erros.push("codec: string nao-vazia obrigatoria (valor exato de -c:v)");
  }
  if (typeof p.deterministico !== "boolean") {
    erros.push(
      "deterministico: declaracao OBRIGATORIA (emenda da W7, contrato-w7 §6)",
    );
  }
  if (typeof p.justificativaDeterminismo !== "string" || p.justificativaDeterminismo.trim() === "") {
    erros.push(
      "justificativaDeterminismo: obrigatoria — a declaracao de determinismo exige a evidencia do por que",
    );
  }

  // ∅-crit do PROGRAMA: perfil sem alvo de qualidade declarado tem de falhar.
  if (typeof p.alvoQualidade !== "object" || p.alvoQualidade === null) {
    erros.push(
      "alvoQualidade: OBRIGATORIO (∅-crit) — um perfil sem alvo de qualidade declarado e invalido",
    );
  } else {
    const alvo = p.alvoQualidade as Record<string, unknown>;
    if (alvo.tipo !== "crf" && alvo.tipo !== "cq" && alvo.tipo !== "qp") {
      erros.push("alvoQualidade.tipo: deve ser 'crf', 'cq' ou 'qp'");
    }
    if (typeof alvo.valor !== "number" || !Number.isFinite(alvo.valor)) {
      erros.push("alvoQualidade.valor: numero finito obrigatorio");
    } else {
      const valor = alvo.valor as number;
      if (alvo.tipo === "crf") {
        // Eixo: crf so em software. Um NVENC com crf declarado e o falso
        // verde da flag sobrando — a validacao corta antes do ffmpeg.
        if (p.motor !== "libx264") {
          erros.push(
            "eixo: alvo 'crf' so existe em encoder de software — perfil de hardware nao tem CRF (pergunta adversarial 1)",
          );
        }
        if (valor < CRF_MIN || valor > CRF_MAX) {
          erros.push(`alvoQualidade.valor crf: deve estar em [${CRF_MIN}..${CRF_MAX}]`);
        }
      } else if (alvo.tipo === "cq" || alvo.tipo === "qp") {
        if (p.motor !== "nvenc") {
          erros.push(
            "eixo: alvo 'cq'/'qp' e vocabulario do NVENC — libx264 declara CRF",
          );
        }
        const [min, max] = alvo.tipo === "cq" ? [CQ_MIN, CQ_MAX] : [QP_MIN, QP_MAX];
        if (valor < min || valor > max) {
          erros.push(`alvoQualidade.valor ${alvo.tipo}: deve estar em [${min}..${max}]`);
        }
      }
    }
  }

  if (typeof p.preset !== "string" || p.preset.trim() === "") {
    erros.push("preset: string nao-vazia obrigatoria");
  }
  if (typeof p.pixFmt !== "string" || p.pixFmt.trim() === "") {
    erros.push("pixFmt: string nao-vazia obrigatoria");
  }
  if (!Array.isArray(p.argsExtra)) {
    erros.push("argsExtra: array obrigatorio (pode ser vazio)");
  }
  return erros;
}

/** Verdadeiro quando o perfil passa em `validarPerfil`. */
export function ehPerfilValido(entrada: unknown): boolean {
  return validarPerfil(entrada).length === 0;
}

/**
 * Perfil invalido encontrado em disco (ou construido em codigo).
 *
 * O `validarPerfil` devolve a lista; esta classe e o erro que o gate e o
 * descobridor lancam para FALHAR ALTO — um perfil invalido nunca e pulado
 * em silencio (Regra 6: descoberta por convencao; o falso verde de sumir
 * sem aviso e o que este projeto persegue).
 */
export class EPerfilInvalido extends Error {
  readonly code = "ENCODE_PERFIL_INVALIDO";
  constructor(
    readonly nomeDoPerfil: string,
    readonly erros: string[],
  ) {
    super(`perfil de encode invalido "${nomeDoPerfil}":\n  - ${erros.join("\n  - ")}`);
    this.name = "EPerfilInvalido";
  }
}
