/**
 * src/entrega/pos/sidecar.ts
 *
 * O SIDECAR SRT — card F5-03 (W8). ADR-0027 + contrato-w8 §2.
 *
 * O sidecar nasce do MESMO documento `LegendasCanonicas.1` que a
 * legenda queimada — lido via `lerLegendas(bytes, contexto)` (ADR-0027:
 * o consumidor F5-03 le por `lerLegendas`, e o `serializeSrt` do
 * Remotion fabrica `timestampMs` e nao e round-trip limpo; o SRT so e
 * fabricado no ponto de consumo — ∅-crit (a) do contrato-w8 §2).
 *
 * O que este modulo faz:
 *
 *   - `serializarSrt` — SRT a partir do documento: tempos ABSOLUTOS em
 *     segundos -> timecodes hh:mm:ss,mmm. Nenhum `timestampMs`
 *     fabricado: o round-trip e o proprio documento.
 *   - `parseSrt` — o leitor minimo do SRT para a conferencia (o gate
 *     confere o arquivo de volta, nunca confia no que gravou).
 *   - `conferirSidecar` — cada legenda do documento TEM um cue no
 *     sidecar com o MESMO inicio_s e o MESMO texto (presenca, nunca
 *     lista fechada — contrato-w8 §7); cada cue tem um documento de que
 *     deriva (nenhum intervalo inventado).
 *   - `spansDaQueimada` — a legenda queimada e o MESMO documento
 *     CLIPADO a janela visual da cena (F1-01): onde a queimada existe,
 *     o inicio_s coincide com o sidecar — e o FIM diverge por
 *     construcao quando a fala carrega alem da janela (CASO C1: c-004
 *     tem janela visual de 4 s e fala de 8,505 s — a queimada existe so
 *     na janela, o sidecar descreve a fala inteira ate 22,738 s).
 *     `conferirCoerenciaDaQueimada` assere a COERENCIA DE inicio_s onde
 *     a queimada existe — nunca igualdade de duracao total (contrato-w8
 *     §2 ∅-crit (b); a licao do contrato-w7 §12: assercao de presenca,
 *     nunca de lista completa).
 */

import type { LegendasCanonicas } from "../../sincronia/legendas/formato.js";

/** Tolerancia de comparacao de inicio entre documento e sidecar (um milissegundo). */
export const TOLERANCIA_SRTCUE_MS = 1;

// ─── Timecodes ────────────────────────────────────────────────────────────────

/** Segundos -> hh:mm:ss,mmm (arredondado ao milissegundo mais proximo). */
export function srtTimecode(segundos: number): string {
  const ms = Math.round(segundos * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const mili = ms % 1000;
  return (
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:` +
    `${String(s).padStart(2, "0")},${String(mili).padStart(3, "0")}`
  );
}

// ─── Serializacao ─────────────────────────────────────────────────────────────

/**
 * Serializa o documento LegendasCanonicas.1 em SRT.
 *
 * O texto de cada cue e a juncao das linhas do documento (a mesma que o
 * oraculo confere em `texto`); os tempos sao os ABSOLUTOS do documento,
 * na ORDEM do documento — nenhum numero e fabricado no ponto de
 * consumo (ADR-0027, consequencias).
 */
export function serializarSrt(legendas: LegendasCanonicas): string {
  const blocos = legendas.legendas.map((l, i) => {
    const linhas = (l.linhas ?? []).join("\n");
    return (
      `${i + 1}\n` +
      `${srtTimecode(l.inicio_s)} --> ${srtTimecode(l.fim_s)}\n` +
      `${linhas}`
    );
  });
  return blocos.join("\n\n") + (blocos.length > 0 ? "\n" : "");
}

// ─── Parse ────────────────────────────────────────────────────────────────────

/** Um cue do SRT, como lido do arquivo. */
export interface CueSrt {
  readonly indice: number;
  /** inicio_s derivado do timecode (segundos). */
  readonly inicio_s: number;
  /** fim_s derivado do timecode (segundos). */
  readonly fim_s: number;
  readonly texto: string;
}

/** hh:mm:ss,mmm -> segundos. Null quando o formato nao casa. */
export function parseTimecode(tc: string): number | null {
  const m = /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/.exec(tc.trim());
  if (m === null) return null;
  const h = Number.parseInt(m[1]!, 10);
  const min = Number.parseInt(m[2]!, 10);
  const s = Number.parseInt(m[3]!, 10);
  const mili = Number.parseInt(m[4]!, 10);
  if (min > 59 || s > 59) return null;
  return h * 3600 + min * 60 + s + mili / 1000;
}

/**
 * Le o SRT e devolve os cues. Parse rigoroso: bloco sem timecode valido
 * e ERRO (`ERetoDeSrtInvalido`) — um SRT que o gate nao consegue ler nao
 * existe (falsifiable-gates: nunca comparar valor que nao foi lido).
 */
export function parseSrt(texto: string): CueSrt[] {
  const cues: CueSrt[] = [];
  const blocos = texto.split(/\n\s*\n/);
  for (const bloco of blocos) {
    const linhas = bloco.split("\n").filter((l) => l.trim() !== "");
    if (linhas.length === 0) continue;
    const indice = Number.parseInt(linhas[0]!, 10);
    const arrow = linhas[1]?.split("-->");
    if (!Number.isInteger(indice) || arrow === undefined || arrow.length !== 2) {
      throw new ERetoDeSrtInvalido(`bloco sem indice/arrow: ${JSON.stringify(bloco)}`);
    }
    const inicio = parseTimecode(arrow[0]!);
    const fim = parseTimecode(arrow[1]!);
    if (inicio === null || fim === null || fim < inicio) {
      throw new ERetoDeSrtInvalido(`timecode invalido: ${JSON.stringify(arrow.join(" --> "))}`);
    }
    cues.push({
      indice,
      inicio_s: inicio,
      fim_s: fim,
      texto: linhas.slice(2).join("\n"),
    });
  }
  return cues;
}

/** Um cue bate com uma legenda do documento (inicio, fim e texto). */
function mesmoIntervalo(
  cue: CueSrt,
  legenda: LegendasCanonicas["legendas"][number],
): boolean {
  const tol = TOLERANCIA_SRTCUE_MS / 1000;
  return (
    Math.abs(cue.inicio_s - legenda.inicio_s) <= tol &&
    Math.abs(cue.fim_s - legenda.fim_s) <= tol &&
    cue.texto === (legenda.linhas ?? []).join("\n")
  );
}

/** SRT que o parse nao consegue ler. */
export class ERetoDeSrtInvalido extends Error {
  readonly code = "POS_SRT_INVALIDO";
  constructor(problema: string) {
    super(`SRT invalido: ${problema}`);
    this.name = "ERetoDeSrtInvalido";
  }
}

// ─── Conferencia do sidecar contra o documento ────────────────────────────────

/**
 * Confere o SRT (como produzido no disco) contra o documento de que ele
 * TEM de ter nascido. Problemas vazio = VERDE; cada problema nomeia a
 * regra. A disciplina do contrato-w8 §7: presenca do SEU item, nunca
 * lista completa — cada legenda do documento tem de TER um cue, e cada
 * cue tem de derivar de uma legenda do documento.
 */
export function conferirSidecar(
  srtTexto: string,
  documento: LegendasCanonicas,
): string[] {
  const problemas: string[] = [];
  const cues = parseSrt(srtTexto);

  // Presenca: cada legenda do documento TEM um cue com o MESMO inicio,
  // o MESMO fim e o MESMO texto (a mutacao de um intervalo do sidecar —
  // ∅-crit (a) — deixa a legenda sem cue correspondente). O FIM entra na
  // comparacao: o sidecar e comparado ao DOCUMENTO (que descreve a fala
  // inteira) — a divergencia legitima de fim e a da QUEIMADA, que o
  // contrato-w8 §2 ∅-crit (b) trata em `conferirCoerenciaDaQueimada`.
  for (const legenda of documento.legendas) {
    const cue = cues.find((c) => mesmoIntervalo(c, legenda));
    if (cue === undefined) {
      problemas.push(
        `sidecar: legenda "${legenda.cena}" @ ${legenda.inicio_s.toFixed(3)}s ` +
          "sem cue correspondente no SRT (inicio/fim/texto divergentes do documento)",
      );
    }
  }

  // Nenhum cue orfao: cada intervalo do SRT tem um documento de que
  // deriva — um intervalo inventado no sidecar e VERMELHO.
  for (const cue of cues) {
    const deriva = documento.legendas.some((l) => mesmoIntervalo(cue, l));
    if (!deriva) {
      problemas.push(
        `sidecar: cue ${cue.indice} @ ${cue.inicio_s.toFixed(3)}s nao deriva ` +
          "de nenhuma legenda do documento — intervalo inventado ou alterado",
      );
    }
  }
  return problemas;
}

// ─── A queimada e a coerencia do CASO C1 ───────────────────────────────────────

/** Uma cena posicionada na timeline absoluta (F1-01 — o que o gate usa). */
export interface JanelaVisualDaCena {
  readonly cenaId: string;
  /** Inicio da janela visual da cena, em segundos. */
  readonly inicio_s: number;
  /** Fim da janela visual da cena, em segundos (exclusivo). */
  readonly fim_s: number;
}

/**
 * A legenda QUEIMADA: o MESMO documento CLIPADO a janela visual da cena
 * (F1-01). Onde a queimada existe (duracao residual > 0), o inicio_s e o
 * do documento — e o fim pode ser RECORTADO pela janela quando a fala
 * carrega alem dela (CASO C1: c-004 tem janela de 4 s e fala de
 * 8,505 s — a queimada de c-004 morre em 18,233 s e o sidecar descreve
 * a fala inteira ate 22,738 s).
 */
export function spansDaQueimada(
  legendas: LegendasCanonicas,
  janelas: readonly JanelaVisualDaCena[],
): { readonly cena: string; readonly inicio_s: number; readonly fim_s: number; readonly texto: string }[] {
  const spans: { cena: string; inicio_s: number; fim_s: number; texto: string }[] = [];
  for (const legenda of legendas.legendas) {
    const janela = janelas.find((j) => j.cenaId === legenda.cena);
    if (janela === undefined) continue;
    const inicio = Math.max(legenda.inicio_s, janela.inicio_s);
    const fim = Math.min(legenda.fim_s, janela.fim_s);
    if (fim - inicio > 0) {
      spans.push({
        cena: legenda.cena,
        inicio_s: inicio,
        fim_s: fim,
        texto: (legenda.linhas ?? []).join("\n"),
      });
    }
  }
  return spans;
}

/**
 * Coerencia da queimada (∅-crit (b)): onde a queimada existe, o
 * inicio_s do sidecar COINCIDE com o inicio_s da queimada — o MESMO
 * numero nos dois, derivado do MESMO documento. NUNCA igualdade de
 * duracao total: o lado que descreve a fala inteira (sidecar) e o lado
 * que descreve a janela visual (queimada) divergem por CONSTRUCAO no
 * CASO C1 — asserir duracao total igual seria o falso-verde que este
 * contrato existe para impedir (contrato-w8 §2, ∅-crit (b)).
 */
export function conferirCoerenciaDaQueimada(
  srtTexto: string,
  legendas: LegendasCanonicas,
  janelas: readonly JanelaVisualDaCena[],
): string[] {
  const problemas: string[] = [];
  const cues = parseSrt(srtTexto);
  for (const span of spansDaQueimada(legendas, janelas)) {
    const cue = cues.find(
      (c) => Math.abs(c.inicio_s - span.inicio_s) <= TOLERANCIA_SRTCUE_MS / 1000,
    );
    if (cue === undefined) {
      problemas.push(
        `queimada: "${span.cena}" @ ${span.inicio_s.toFixed(3)}s sem cue no ` +
          "sidecar com o mesmo inicio_s — a queimada e o sidecar divergem onde " +
          "a queimada existe",
      );
    }
  }
  return problemas;
}
