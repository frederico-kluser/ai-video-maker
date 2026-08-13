/**
 * src/sincronia/legendas/construir.ts
 *
 * O CONSTRUTOR DAS LEGENDAS CANONICAS — legenda a partir do timing.
 *
 * Entrada: o manifesto e o timing canonico de F3-01. Saida: o documento
 * de legendas (formato.ts), ja validado pelo oraculo (validar.ts) — um
 * documento que o oraculo reprova nao sai daqui.
 *
 * ─── As regras de ouro do contrato-w6 §2 ────────────────────────────────
 *
 *   1. UNIDADE SEGUNDOS. O documento inteiro e em segundos; a conversao
 *      para frame e de quem consome, no ponto de consumo. O invariante
 *      de duracao e calculado em SEGUNDOS — nunca reescrito em frames
 *      (20 frames a 60 fps sao 0,333 s, quatro vezes abaixo do piso).
 *
 *   2. CONSUMO POR CONTEUDO + UNIDADE ORFA. O construtor itera as cenas
 *      do MANIFESTO (AB-522): cena silenciosa → NENHUMA legenda; cena com
 *      locucao → ao menos uma. Cada legenda carrega `cena` e `audio` (o
 *      endereco por conteudo do timing de que deriva). Nada e assumido
 *      por posicao; nada e inventado para cena sem locucao.
 *
 *   3. LEGENDA NUNCA ANTES DA PALAVRA. A legenda nasce no inicio de uma
 *      palavra — nunca antes da primeira da cena. A folga de leitura
 *      (quando o piso exige mais tempo do que a fala ocupa) estende o
 *      FIM da legenda sobre o silencio declarado, clampada pelo inicio
 *      da legenda seguinte, pelo fim da cena e pelo teto. Se nem assim
 *      o piso cabe — ou se a propria fala da legenda nao cabe no teto —
 *      este timing NAO produz um documento valido: o construtor PARA e
 *      nomeia a cena (vermelho > documento que o oraculo reprovaria).
 *
 *   4. PAGINACAO LIMITADA. No maximo `maxLines` linhas de ate
 *      `maxCharsPerLine` caracteres (tokens, S-5) — a caixa vertical e
 *      limitada por construcao.
 */

import {
  maxCharsPerLine,
  maxCpsAdult,
  maxLines,
  maxTextDurationSeconds,
  minTextDurationSeconds,
} from "../../design/tokens.js";
import { calcularDuracao } from "../../composicao/tempo.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import { validarTimingCanonico } from "../timing/validar.js";
import type { PalavraCanonica, TimingCanonico } from "../timing/formato.js";
import { UNIDADE_LEGENDAS } from "./formato.js";
import type { LegendaCanonica, LegendasCanonicas } from "./formato.js";
import { EPS_S, validarLegendas } from "./validar.js";

/** O timing da cena nao permite um documento de legendas valido. */
export class ELegendasImpossiveis extends Error {
  readonly code = "LEGENDAS_IMPOSSIVEIS";
  readonly cena: string;
  readonly problemas: readonly string[];
  constructor(cena: string, problemas: readonly string[]) {
    super(
      `Legendas impossiveis para a cena "${cena}":\n` +
        problemas.map((p) => `  - ${p}`).join("\n") +
        "\n  O timing nao comporta legendas dentro do invariante de " +
        "duracao (segundos). Revisar o texto ou o timing — nunca relaxar " +
        "o invariante.",
    );
    this.name = "ELegendasImpossiveis";
    this.cena = cena;
    this.problemas = problemas;
  }
}

/**
 * Constroi o documento canonico de legendas para um manifesto e o seu
 * timing canonico.
 *
 * @throws ELegendasImpossiveis se uma cena com locucao nao admitir
 *   legendas dentro do invariante de duracao; ELegendasInvalidas se o
 *   documento construido nao passar no oraculo (nunca deveria).
 */
export function construirLegendas(
  manifesto: Manifesto,
  timing: TimingCanonico,
): LegendasCanonicas {
  // Entrada unica e fechada: bytes que nao passam no oraculo de F3-01
  // nao existem para este construtor.
  const problemasDoTiming = validarTimingCanonico(timing);
  if (problemasDoTiming.length > 0) {
    throw new Error(
      "construirLegendas: timing invalido — bytes que nao passam no " +
        "oraculo nao existem:\n" +
        problemasDoTiming.map((p) => `  - ${p}`).join("\n"),
    );
  }

  const timeline = calcularDuracao(manifesto);
  const posicaoPorCena = new Map(timeline.timeline.map((t) => [t.cenaId, t]));

  const legendas: LegendaCanonica[] = [];

  // Iteracao na ORDEM do manifesto (ordenacao explicita = determinismo).
  for (const cena of manifesto.cenas) {
    const entrada = timing.cenas[cena.id];
    if (entrada === undefined || entrada.estado === "silencio") {
      // Cena sem locucao: NENHUMA legenda (AB-522 — o silencio e
      // declarado, nunca vira legenda).
      continue;
    }
    const posicao = posicaoPorCena.get(cena.id);
    if (posicao === undefined) {
      throw new ELegendasImpossiveis(cena.id, [
        "cena sem posicao na timeline da composicao — nao ha como " +
          "calcular tempo absoluto",
      ]);
    }
    const inicioCenaAbs = posicao.frameInicial / manifesto.fps;
    legendas.push(
      ...paginarCena(
        cena.id,
        entrada.audio ?? "",
        entrada.palavras ?? [],
        entrada.duracao_s,
        inicioCenaAbs,
      ),
    );
  }

  const documento: LegendasCanonicas = {
    schema_version: "LegendasCanonicas.1",
    unidade: UNIDADE_LEGENDAS,
    legendas,
  };

  // Um documento que o oraculo reprova nao sai daqui.
  const problemas = validarLegendas(documento, { manifesto, timing });
  if (problemas.length > 0) {
    throw new Error(
      "construirLegendas: o proprio oraculo reprovou o documento:\n" +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
  }
  return documento;
}

/** Uma legenda ainda relativa ao inicio da cena, antes da folga. */
interface CueEmPaginas {
  readonly palavras: readonly PalavraCanonica[];
  readonly linhas: readonly string[];
  readonly caracteres: number;
  readonly inicioRel: number;
  /** Fim da ultima palavra (sem folga). */
  readonly fimDaFalaRel: number;
}

/**
 * Pagina as palavras de uma cena em legendas e aplica a folga de
 * leitura. Devolve legendas com tempo ABSOLUTO.
 */
function paginarCena(
  cena: string,
  audio: string,
  palavras: readonly PalavraCanonica[],
  duracaoAudioRel: number,
  inicioCenaAbs: number,
): LegendaCanonica[] {
  if (palavras.length === 0) {
    // O oraculo do timing (C4b) ja reprova audio com fala e zero
    // palavras; este caminho e blindagem.
    throw new ELegendasImpossiveis(cena, ["cena com locucao sem palavras"]);
  }

  const cues = paginar(palavras, cena);

  // Folga de leitura (piso do invariante) + tempo absoluto. O limite da
  // legenda e o FIM DO AUDIO da cena — a legenda descreve a fala, e a
  // fala e o timing. O fim da janela visual da composicao NAO limita a
  // legenda: se a janela for mais curta que a fala, quem reconcilia e a
  // fronteira de composicao (AB-550) e o mix (F3-05) — nao este card
  // (ver AB-58x no ledger: a fixture canonica tem c-004 com audio de
  // 8,505 s dentro de janela visual de 4 s).
  const fimAudioAbs = inicioCenaAbs + duracaoAudioRel;
  const fimDaCenaAbs = fimAudioAbs;

  const saida: LegendaCanonica[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue === undefined) continue;
    const inicioAbs = inicioCenaAbs + cue.inicioRel;
    const fimDaFalaAbs = inicioCenaAbs + cue.fimDaFalaRel;

    const pisoAbsoluto = minTextDurationSeconds;
    const pisoDeLeitura = cue.caracteres / maxCpsAdult;
    const piso = Math.max(pisoAbsoluto, pisoDeLeitura);

    // A folga estende o FIM sobre o silencio declarado — nunca antes da
    // primeira palavra, nunca em cima da legenda seguinte, nunca fora
    // da cena, nunca alem do teto da norma.
    const inicioDaProxima =
      cues[i + 1] !== undefined
        ? inicioCenaAbs + (cues[i + 1]?.inicioRel ?? 0)
        : Infinity;
    const limite = Math.min(
      inicioDaProxima,
      fimDaCenaAbs,
      inicioAbs + maxTextDurationSeconds,
    );

    // A legenda cobre a propria fala E o piso de leitura; o que nao
    // couber no limite e impossivel, nao aproximado.
    const fimDesejado = Math.max(fimDaFalaAbs, inicioAbs + piso);
    const fimAbs = Math.min(fimDesejado, limite);

    if (fimAbs < fimDaFalaAbs - EPS_S) {
      throw new ELegendasImpossiveis(cena, [
        `a fala da legenda "${cue.linhas.join(" / ")}" termina em ` +
          `${fimDaFalaAbs.toFixed(3)}s, mas o limite da cena e ` +
          `${limite.toFixed(3)}s — a legenda nao cabe no teto da norma ` +
          `(${maxTextDurationSeconds}s) nem na cena`,
      ]);
    }
    if (fimAbs - inicioAbs < piso - EPS_S) {
      throw new ELegendasImpossiveis(cena, [
        `legenda "${cue.linhas.join(" / ")}" precisa de ${piso.toFixed(3)}s ` +
          `na tela (max(${pisoAbsoluto}s; ${cue.caracteres} caracteres / ` +
          `${maxCpsAdult} CPS)) mas so ha ${(limite - inicioAbs).toFixed(3)}s ` +
          "antes da proxima legenda / fim da cena. O timing nao comporta " +
          "esta legenda dentro do invariante (em SEGUNDOS).",
      ]);
    }

    const linhas = cue.linhas;
    saida.push({
      unidade: UNIDADE_LEGENDAS,
      cena,
      audio,
      inicio_s: inicioAbs,
      fim_s: fimAbs,
      linhas,
      texto: linhas.join("\n"),
      caracteres: cue.caracteres,
    });
  }

  if (saida.length === 0) {
    // Nunca deveria acontecer: palavras nao-vazias paginam em ao menos
    // uma legenda. E o C1 aplicado a este documento: sucesso sem produto.
    throw new ELegendasImpossiveis(cena, ["cena com locucao sem nenhuma legenda"]);
  }
  return saida;
}

/**
 * Paginacao gulosa e deterministica: acumula palavras na legenda atual
 * enquanto a tentativa (a) cabe em `maxLines` linhas de ate
 * `maxCharsPerLine` caracteres e (b) nao estoura o teto de duracao.
 * Palavra isolada maior que a linha nao e cortada (sem hifenacao): fica
 * sozinha na propria linha — o teto de CPL e alvo do construtor, e o
 * oraculo nao o exige.
 */
function paginar(
  palavras: readonly PalavraCanonica[],
  cena: string,
): CueEmPaginas[] {
  const cues: CueEmPaginas[] = [];
  let atual: PalavraCanonica[] = [];

  const fechar = (): void => {
    if (atual.length === 0) return;
    cues.push(comporCue(atual, cena));
    atual = [];
  };

  for (const palavra of palavras) {
    const tentativa = [...atual, palavra];
    const duracaoDaTentativa = fimDaFala(tentativa) - (tentativa[0]?.inicio_s ?? 0);

    // Fecha a legenda anterior se a tentativa estoura o teto de duracao
    // ou o limite de paginacao (linhas x caracteres).
    if (atual.length > 0 && quebraLimites(tentativa, duracaoDaTentativa)) {
      fechar();
      atual = [palavra];
    } else {
      atual = tentativa;
    }
  }
  fechar();
  return cues;
}

/** A tentativa viola o teto de duracao ou o limite de linhas? */
function quebraLimites(
  tentativa: readonly PalavraCanonica[],
  duracao: number,
): boolean {
  if (duracao > maxTextDurationSeconds) return true;
  return contarLinhas(tentativa).length > maxLines;
}

/** Quebra as palavras em linhas de ate `maxCharsPerLine` caracteres. */
function contarLinhas(palavras: readonly PalavraCanonica[]): string[] {
  const linhas: string[] = [];
  let linha = "";
  for (const p of palavras) {
    const palavra = p.texto.trim();
    if (linha === "") {
      linha = palavra;
    } else if (linha.length + 1 + palavra.length <= maxCharsPerLine) {
      linha = `${linha} ${palavra}`;
    } else {
      linhas.push(linha);
      linha = palavra;
    }
  }
  if (linha !== "") linhas.push(linha);
  return linhas;
}

function fimDaFala(palavras: readonly PalavraCanonica[]): number {
  let fim = 0;
  for (const p of palavras) fim = Math.max(fim, p.fim_s);
  return fim;
}

/** Monta uma legenda a partir das palavras acumuladas. */
function comporCue(
  palavras: readonly PalavraCanonica[],
  cena: string,
): CueEmPaginas {
  const linhas = contarLinhas(palavras);
  if (linhas.length > maxLines) {
    // Blindagem: a paginacao gulosa nunca deveria fechar uma cue acima
    // do limite — quem fecha e `quebraLimites`, na tentativa seguinte.
    throw new ELegendasImpossiveis(cena, [
      `pagina com ${linhas.length} linhas acima do maximo ${maxLines} ` +
        "(bug do construtor — o oraculo deveria ter pego)",
    ]);
  }
  return {
    palavras,
    linhas,
    caracteres: linhas.join("").length,
    inicioRel: palavras[0]?.inicio_s ?? 0,
    fimDaFalaRel: fimDaFala(palavras),
  };
}
