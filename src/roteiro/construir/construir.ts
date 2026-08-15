/**
 * src/roteiro/construir/construir.ts
 *
 * O CONSTRUTOR DE MANIFESTO — a ponte Pedaco[] -> Manifesto.1 do app web.
 *
 * Cada pedaco do Roteiro vira UMA cena do Manifesto.1 (decisao D1 do
 * plano, docs/roteiro/contrato-roteiro.md §5):
 *
 *   - a duracao do pedaco (segundos) vira a duracao da cena (frames);
 *   - o visual vira os nos da cena (mapear.ts — a tabela do contrato §3);
 *   - a fala vira `audio_cena.texto_locucao` SO quando
 *     `narracao.origem ∈ {tts, gravacao}` (contrato §5 + emenda
 *     RECORD-FIRST: pedaco com fala ainda nao narrada renderiza
 *     silencioso — origem "nenhuma" nao gera audio_cena);
 *   - `duracao_total_frames` = soma das duracoes das cenas menos as
 *     sobreposicoes de transicao (a aritmetica SUBTRATIVA do F1-01 —
 *     src/composicao/tempo.ts — e a verdade; o campo declara o que o
 *     render vai produzir, nunca uma soma ingênua);
 *   - fps/width/height vêm das opcoes, com default do FORMATO_VIDEO do
 *     contrato (1920x1080@30 — a autoridade, zero literais).
 *
 * RESPONSABILIDADE ATE AQUI TERMINA NO MANIFESTO.1 VALIDO: o construtor
 * monta o manifesto e o valida contra o schema oficial (validar.ts) antes
 * de devolver — nunca emite manifesto invalido. A PONTE AB-550
 * (`atravessarPonte` em src/render/pipeline/ponte.ts) NAO e chamada aqui:
 * ela exige assets + procedencias resolvidos e e consumida pelo preview e
 * pelo juntar (Onda 4) — este modulo so prepara o que ela consome.
 *
 * `reduzirManifesto` e API PUBLICA (REPLAN do orquestrador): o preview da
 * Onda 4 reduz o manifesto a UMA cena para renderizar um pedaco — reusa,
 * nunca reimplementa (FQ-M3).
 *
 * Determinismo por conteudo: mesmas entradas produzem o mesmo manifesto,
 * byte a byte — a base do cache do preview (C7/FQ-P1).
 */

import { createHash } from "node:crypto";
import { FORMATO_VIDEO } from "../contrato/contrato.js";
import type { Roteiro } from "../contrato/contrato.js";
import { rejeitarRoteiroInvalido } from "../contrato/rejeitar.js";
import { VOCABULARIO_TRANSICAO } from "../../autoria/contrato/contrato.js";
import { msToFrames, transitionDuration } from "../../design/tokens.js";
import type { Manifesto, Transicao } from "../../contratos/manifesto.js";
import { duracaoDaCena, ErroDeTempo } from "../../composicao/tempo.js";
import { mapearPedacoParaNo } from "./mapear.js";
import { rejeitarManifestoInvalido } from "./validar.js";

// ─── Opcoes ───────────────────────────────────────────────────────────────────

/**
 * Vocabulario fechado de transicao do construtor.
 *
 * Reusa VOCABULARIO_TRANSICAO da autoria (fade/slide/wipe/flip/none) — a
 * interseccao ja decidida entre o enum do schema e os presentations
 * exportados pelo pacote instalado @remotion/transitions (sem `cube`, que
 * e item pago separado). Fonte unica: quem precisa do vocabulario importa
 * a constante, nunca redigita a lista (Regra 2).
 */
export type TipoTransicaoConstrucao = (typeof VOCABULARIO_TRANSICAO)[number];

/** Opcoes da construcao. Tudo opcional — os defaults sao do contrato. */
export interface OpcoesConstruirManifesto {
  /** fps do manifesto (inteiro 1..120 — limites do schema). Default FORMATO_VIDEO.fps (30). */
  readonly fps?: number;
  /** Largura em pixels (inteiro >= 1). Default FORMATO_VIDEO.width (1920). */
  readonly width?: number;
  /** Altura em pixels (inteiro >= 1). Default FORMATO_VIDEO.height (1080). */
  readonly height?: number;
  /**
   * Transicao entre as cenas (aplicada na saida de cada cena exceto a
   * ultima). Ausencia = corte seco. A duracao sai do token de transicao
   * `base` (300ms) de src/design/tokens.ts — nunca de literal.
   */
  readonly transicao?: TipoTransicaoConstrucao;
}

/** Erro nomeado: opcoes fora dos limites que o schema do manifesto aceita. */
export class ErroOpcoesInvalidas extends Error {
  readonly code = "OPCOES_INVALIDAS";
  readonly problemas: string[];
  constructor(problemas: string[]) {
    super(
      `Opcoes de construcao invalidas (${problemas.length} problema(s)):\n` +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ErroOpcoesInvalidas";
    this.problemas = problemas;
  }
}

/** Erro nomeado: duracao do pedaco nao produz um unico frame. */
export class ErroDuracaoInsuficiente extends Error {
  readonly code = "DURACAO_ABAIXO_DE_UM_FRAME";
  readonly regra = "duracao-abaixo-de-um-frame";
  constructor(pedacoId: string, segundos: number, fps: number) {
    super(
      `pedaco "${pedacoId}": duracao_segundos ${String(segundos)} nao produz ` +
        `nem um frame a ${String(fps)}fps (regra duracao-abaixo-de-um-frame) — ` +
        `o schema do manifesto exige duracao_frames >= 1 e o construtor nunca ` +
        `emite manifesto invalido (C1); aumente a duracao do pedaco`,
    );
    this.name = "ErroDuracaoInsuficiente";
  }
}

/** Erro nomeado: reducao imposivel (indice fora do limite ou cena quebrada). */
export class ErroReduzirManifesto extends Error {
  readonly code = "REDUCAO_IMPOSIVEL";
  readonly regra = "reducao-impossivel";
  constructor(mensagem: string) {
    super(`${mensagem} (regra reducao-impossivel)`);
    this.name = "ErroReduzirManifesto";
  }
}

// ─── Helpers puros ────────────────────────────────────────────────────────────

/**
 * Converte segundos em frames: `round(segundos * fps)`, arredondado UMA
 * vez, por ANcora — nunca duracoes encadeadas (ADR-0010; a regra de
 * conversao da skill timeline-manifest: erro limitado a meio frame por
 * ancora, sem propagacao).
 */
export function duracaoEmFrames(segundos: number, fps: number): number {
  return Math.round(segundos * fps);
}

/** Id de no/cena derivado do indice do pedaco: n-002 / c-002 (0-based, 3 digitos). */
function idComIndice(prefixo: "n" | "c", indice: number): string {
  return `${prefixo}-${String(indice).padStart(3, "0")}`;
}

/**
 * Hash de conteudo do texto da locucao — o `hash_locucao` declarado no
 * manifesto quando a origem e "tts".
 *
 * POR QUE: o schema do Manifesto.1 EXIGE `hash_locucao` nao-vazio em toda
 * `audio_cena`, mas o audio de TTS ainda nao existe na construcao — ele
 * nasce no estagio `locucao` da resolucao, que consome `texto_locucao` e
 * grava o hash REAL do wav em `nos_locucao` do manifesto resolvido
 * (nenhum consumidor le `audio_cena.hash_locucao` — verificado por grep
 * em src/). Este placeholder e um hash de conteudo do proprio texto
 * (deterministico, C7 — nada de URL nem de marcador arbitrao); a verdade
 * do audio atravessa a ponte pelos BYTES, nunca por este campo.
 */
export function hashLocucaoTts(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

function validarOpcoes(opcoes: OpcoesConstruirManifesto): void {
  const problemas: string[] = [];
  if (opcoes.fps !== undefined) {
    if (!Number.isInteger(opcoes.fps) || opcoes.fps < 1 || opcoes.fps > 120) {
      problemas.push(
        `fps ${String(opcoes.fps)} fora do intervalo 1..120 (inteiro) — os limites do schema do manifesto`,
      );
    }
  }
  for (const [nome, valor] of [
    ["width", opcoes.width],
    ["height", opcoes.height],
  ] as const) {
    if (valor !== undefined && (!Number.isInteger(valor) || valor < 1)) {
      problemas.push(`${nome} ${String(valor)} deve ser inteiro >= 1 (limite do schema)`);
    }
  }
  if (
    opcoes.transicao !== undefined &&
    !(VOCABULARIO_TRANSICAO as readonly string[]).includes(opcoes.transicao)
  ) {
    problemas.push(
      `transicao "${opcoes.transicao}" fora do vocabulario fechado ` +
        `(${VOCABULARIO_TRANSICAO.join(" | ")})`,
    );
  }
  if (problemas.length > 0) {
    throw new ErroOpcoesInvalidas(problemas);
  }
}

// ─── Construcao ───────────────────────────────────────────────────────────────

/**
 * Constroi o Manifesto.1 completo a partir do Roteiro.
 *
 * Fluxo (fail-closed em cada passo):
 *   1. valida o Roteiro contra o schema + semantica do contrato
 *      (rejeitarRoteiroInvalido — FQ-C1: pedaco invalido nunca entra);
 *   2. valida as opcoes contra os limites do schema do manifesto;
 *   3. monta uma cena por pedaco (mapear.ts) e a transicao opcional;
 *   4. valida a PROPRIA SAIDA contra o schema oficial (FQ-M1) — nunca
 *      emite manifesto invalido.
 *
 * @throws ErroContratoRoteiro (roteiro invalido — inclui gif/video sem
 *   anexo: regra anexo-exigido-para-gif-video), ErroOpcoesInvalidas,
 *   ErroDuracaoInsuficiente, ErroAnexoAusente, ErroManifestoInvalido.
 */
export function construirManifesto(
  roteiro: Roteiro,
  opcoes: OpcoesConstruirManifesto = {},
): Manifesto {
  // Passo 1+2: o contrato de roteiro e o unico gate de entrada; opcoes
  // fora dos limites do schema produziriam um manifesto que o proprio
  // schema rejeitaria — os dois validados ANTES de montar.
  rejeitarRoteiroInvalido(roteiro);
  validarOpcoes(opcoes);

  const fps = opcoes.fps ?? FORMATO_VIDEO.fps;
  const width = opcoes.width ?? FORMATO_VIDEO.width;
  const height = opcoes.height ?? FORMATO_VIDEO.height;

  // A duracao da transicao vem do TOKEN base (300ms), convertido UMA vez
  // na camada de token (msToFrames — a regra do motion-design-system:
  // arredondar uma vez, nunca no ponto de uso).
  const duracaoTransicaoFrames = msToFrames(transitionDuration.base, fps);
  const semTransicao =
    opcoes.transicao === undefined || opcoes.transicao === "none";

  const nos: Manifesto["nos"] = [];
  const cenas: Manifesto["cenas"] = [];
  let totalFrames = 0;

  for (let indice = 0; indice < roteiro.pedacos.length; indice++) {
    const pedaco = roteiro.pedacos[indice]!;
    const idNo = idComIndice("n", indice);
    const idCena = idComIndice("c", indice);

    // Duracao do pedaco -> duracao da cena. Menor que 1 frame e recusa
    // nomeada: o schema exige duracao_frames >= 1 e o construtor nao
    // emite manifesto invalido (nem arredonda para cima em silencio —
    // isso alongaria o video alem do que o usuario pediu).
    const framesDaCena = duracaoEmFrames(pedaco.duracao_segundos, fps);
    if (framesDaCena < 1) {
      throw new ErroDuracaoInsuficiente(pedaco.id, pedaco.duracao_segundos, fps);
    }

    nos.push(mapearPedacoParaNo(pedaco, idNo, framesDaCena));
    totalFrames += framesDaCena;

    // Transicao de saida entre cenas adjacentes (so quando ha cena
    // seguinte e a cena e mais longa que a propria transicao — a
    // aritmetica do F1-01 recusa fronteira maior que a cena: a
    // sobreposicao engoliria a cena inteira).
    let transicaoSaida: Transicao | undefined;
    if (
      !semTransicao &&
      indice < roteiro.pedacos.length - 1 &&
      framesDaCena > duracaoTransicaoFrames
    ) {
      transicaoSaida = {
        tipo: opcoes.transicao as TipoTransicaoConstrucao,
        duracao_frames: duracaoTransicaoFrames,
      };
      totalFrames -= duracaoTransicaoFrames;
    }

    // audio_cena SO com origem real (contrato §5 + emenda RECORD-FIRST):
    // origem "nenhuma" = fala ainda nao narrada = cena SILENCIOSA no
    // preview (estado normal do roteiro recem-gerado); o juntar e quem
    // bloqueia fala muda (verificarJuntarFalaSemNarracao, Onda 4).
    // texto_locucao = narracao.texto, nunca a fala corrente: o audio e
    // sempre o do texto de que foi gerado (regra gerado-dessincronizado
    // — com status "editado" a fala ja mudou e o audio fala o texto
    // antigo; o manifest precisa carregar o texto que o audio pronuncia).
    let audioCena;
    if (
      pedaco.narracao.origem === "tts" ||
      pedaco.narracao.origem === "gravacao"
    ) {
      if (pedaco.narracao.texto.trim() === "") {
        // Inalcancavel com roteiro valido (validarRoteiro exige texto
        // nao-vazio com origem real), mas fail-closed: a cena sem texto
        // derrubaria o estagio locucao (ELocucaoSemTexto) no render.
        throw new Error(
          `pedaco "${pedaco.id}": narracao com origem "${pedaco.narracao.origem}" ` +
            `e texto vazio — o estagio locucao recusaria a cena em silencio`,
        );
      }
      let hashLocucao: string;
      if (pedaco.narracao.origem === "gravacao") {
        if (pedaco.narracao.hash_audio === undefined) {
          // Inalcancavel com roteiro valido (regra gravacao-sem-hash), mas
          // fail-closed: um hash_locucao vazio violaria o schema e um
          // fabricado mentiria sobre os bytes que o usuario gravou.
          throw new Error(
            `pedaco "${pedaco.id}": origem "gravacao" sem hash_audio — o ` +
              `hash_locucao do manifesto e o SHA-256 do wav gravado, nunca ` +
              `inventado (C7)`,
          );
        }
        hashLocucao = pedaco.narracao.hash_audio;
      } else {
        hashLocucao = hashLocucaoTts(pedaco.narracao.texto);
      }
      audioCena = {
        hash_locucao: hashLocucao,
        texto_locucao: pedaco.narracao.texto,
      };
    }

    cenas.push({
      id: idCena,
      nos: [idNo],
      ...(transicaoSaida !== undefined ? { transicao_saida: transicaoSaida } : {}),
      ...(audioCena !== undefined ? { audio_cena: audioCena } : {}),
    });
  }

  const manifesto: Manifesto = {
    schema_version: "Manifesto.1",
    fps,
    width,
    height,
    duracao_total_frames: totalFrames,
    nos,
    cenas,
  };

  // Passo 4: a propria saida contra o schema oficial. Se falhar e bug do
  // construtor — erro nomeado, nunca manifesto invalido na mao de quem
  // consome (o preview da Onda 4 confia nesta garantia para cachear por
  // hash do manifesto reduzido, FQ-P1).
  rejeitarManifestoInvalido(manifesto, "construirManifesto");
  return manifesto;
}

// ─── Reducao a um pedaco (API PUBLICA — o preview da Onda 4) ───────────────────

/**
 * Reduz um Manifesto a UMA cena — a do pedaco no indice dado.
 *
 * API PUBLICA do construtor (REPLAN do orquestrador): o preview da Onda 4
 * renderiza o pedaco i como `reduzirManifesto(manifesto, i)` — reusa,
 * nunca reimplementa (FQ-M3).
 *
 * Regras da reducao (deterministicas por conteudo — mesmo manifesto e
 * mesmo indice produzem o mesmo reduzido, byte a byte):
 *
 *   - cena do indice, com os NO da cena (a lista plana do manifesto
 *     reduzido so carrega os nos referenciados, na ordem da cena);
 *   - `duracao_total_frames` = duracao da cena (max(entrada_frames +
 *     duracao_frames) dos nos — a MESMA aritmetica do F1-01, importada de
 *     src/composicao/tempo.ts: duplicar a conta divergiria da timeline
 *     que o render usa, e a divergencia viraria cauda/overrun sem erro);
 *   - transicoes da cena REMOVIDAS: uma cena so nao tem com o que
 *     sobrepor (entrada da primeira e saida da ultima nao descontam
 *     nada — tempo.ts) — a transicao de saida so faria o preview terminar
 *     com um fade de 300ms fantasma;
 *   - `audio_cena` PRESERVADO (o preview narra se o pedaco narra);
 *   - `audio` (trilha sonora) REMOVIDO: a musica entra no juntar (D6 do
 *     plano), nunca no preview de um pedaco.
 *
 * @throws ErroReduzirManifesto para indice fora do limite ou cena com
 *   referencia quebrada (fail-closed: manifesto reduzido invalido e
 *   erro, nunca saida).
 */
export function reduzirManifesto(
  manifesto: Manifesto,
  indicePedaco: number,
): Manifesto {
  if (!Number.isInteger(indicePedaco) || indicePedaco < 0 || indicePedaco >= manifesto.cenas.length) {
    throw new ErroReduzirManifesto(
      `indicePedaco ${String(indicePedaco)} fora do limite — o manifesto tem ` +
        `${String(manifesto.cenas.length)} cena(s)`,
    );
  }
  const cena = manifesto.cenas[indicePedaco]!;

  const nosDaCena = new Map(
    manifesto.nos.map((no) => [no.id, no] as const),
  );
  let duracaoDaCenaFrames: number;
  try {
    duracaoDaCenaFrames = duracaoDaCena(cena, nosDaCena);
  } catch (erro) {
    if (erro instanceof ErroDeTempo) {
      throw new ErroReduzirManifesto(
        `cena "${cena.id}" nao resolveu: ${erro.message}`,
      );
    }
    throw erro;
  }

  const nosReduzidos = cena.nos
    .map((id) => nosDaCena.get(id))
    .filter((no): no is NonNullable<typeof no> => no !== undefined);

  const reduzido: Manifesto = {
    schema_version: manifesto.schema_version,
    fps: manifesto.fps,
    width: manifesto.width,
    height: manifesto.height,
    duracao_total_frames: duracaoDaCenaFrames,
    nos: nosReduzidos,
    cenas: [
      {
        id: cena.id,
        nos: cena.nos,
        ...(cena.audio_cena !== undefined ? { audio_cena: cena.audio_cena } : {}),
      },
    ],
  };

  rejeitarManifestoInvalido(reduzido, `reduzirManifesto(${String(indicePedaco)})`);
  return reduzido;
}
