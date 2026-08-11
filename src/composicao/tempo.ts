// =============================================================================
// TEMPO — aritmetica SUBTRATIVA de transicoes
// =============================================================================
// Card: F1-01 — Composicao raiz
//
//   total = SOMA(duracao das cenas) - SOMA(duracao das FRONTEIRAS)
//
// Durante uma transicao as duas cenas renderizam ao mesmo tempo: a transicao
// ENCURTA a composicao, nao alonga. Errar o sinal (somar) produz cauda preta
// no fim do video, sem erro nenhum no console.
//
// A UNIDADE DE COBRANCA E A FRONTEIRA, NAO O CAMPO.
// O manifesto deixa a mesma fronteira ser declarada dos dois lados
// (cenas[i].transicao_saida e cenas[i+1].transicao_entrada). Cobrar os dois
// campos conta a mesma sobreposicao duas vezes e o video encurta em silencio.
// Regra de precedencia adotada (docs/adr/0006-composicao-raiz.md):
//   a transicao_saida da cena anterior manda; a transicao_entrada da cena
//   seguinte so vale se a anterior nao declarar saida.
// Transicao de entrada da PRIMEIRA cena e de saida da ULTIMA nao tem par:
// nao ha com o que sobrepor, logo nao descontam nada.
//
// Fonte: https://www.remotion.dev/docs/transitions/transitionseries (2026-08-11)
//        — TransitionSeries: total = A + B - duracao da transicao
// =============================================================================

import type { Manifesto, No, Cena, Transicao } from "../contratos/manifesto";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** De onde saiu a duracao cobrada numa fronteira. */
export type OrigemDaFronteira = "saida" | "entrada" | "nenhuma";

/** Uma fronteira entre duas cenas adjacentes. */
export interface Fronteira {
  /** Indice da cena que termina */
  indiceAnterior: number;
  /** Id da cena que termina */
  cenaAnterior: string;
  /** Id da cena que comeca */
  cenaSeguinte: string;
  /** Duracao cobrada (frames de sobreposicao) */
  duracaoFrames: number;
  /** Qual campo do manifesto forneceu a duracao */
  origem: OrigemDaFronteira;
  /** Tipo da transicao vencedora (informativo) */
  tipo: string;
}

/** Uma cena posicionada na linha do tempo absoluta. */
export interface TimelineCena {
  cenaId: string;
  /** Frame absoluto inicial (inclusivo) */
  frameInicial: number;
  /** Frame absoluto final (exclusivo) */
  frameFinal: number;
  /** Duracao propria da cena em frames */
  duracao: number;
  /** Fronteira de entrada (sobreposicao com a cena anterior) */
  fronteiraEntrada: number;
  /** Fronteira de saida (sobreposicao com a cena seguinte) */
  fronteiraSaida: number;
}

/** Resultado do calculo de duracao. */
export interface DuracaoResolvida {
  /** Duracao total em frames */
  totalFrames: number;
  /** Duracao total em segundos */
  totalSegundos: number;
  /** Soma das duracoes proprias das cenas */
  somaCenas: number;
  /** Soma das fronteiras — o que e SUBTRAIDO */
  somaTransicoes: number;
  /** Uma entrada por par de cenas adjacentes */
  fronteiras: readonly Fronteira[];
  /** Uma entrada por cena, posicionada em frames absolutos */
  timeline: readonly TimelineCena[];
}

/** Erro de tempo: manifesto que nao permite calcular uma linha do tempo. */
export class ErroDeTempo extends Error {
  readonly erros: readonly string[];
  constructor(erros: readonly string[]) {
    super(
      `Nao foi possivel resolver a linha do tempo (${erros.length} erro(s)):\n` +
        erros.map((e) => `  - ${e}`).join("\n"),
    );
    this.name = "ErroDeTempo";
    this.erros = erros;
  }
}

// ---------------------------------------------------------------------------
// Nos
// ---------------------------------------------------------------------------

/** Mapa id -> no, para lookup. Recusa id duplicado. */
export function mapaDeNos(manifesto: Manifesto): Map<string, No> {
  const mapa = new Map<string, No>();
  const erros: string[] = [];
  for (const no of manifesto.nos) {
    if (mapa.has(no.id)) {
      erros.push(`no com id duplicado: "${no.id}"`);
      continue;
    }
    mapa.set(no.id, no);
  }
  if (erros.length > 0) {
    throw new ErroDeTempo(erros);
  }
  return mapa;
}

/**
 * Duracao propria de uma cena: o ultimo frame em que algum no dela ainda
 * esta visivel. Nos da mesma cena rodam em paralelo, cada um com seu
 * deslocamento `entrada_frames`.
 *
 * Recusa (nao ignora) referencia a no inexistente.
 */
export function duracaoDaCena(cena: Cena, nos: ReadonlyMap<string, No>): number {
  const erros: string[] = [];
  let maximo = 0;

  for (const noId of cena.nos) {
    const no = nos.get(noId);
    if (!no) {
      erros.push(`cena "${cena.id}" referencia no inexistente "${noId}"`);
      continue;
    }
    const fim = (no.entrada_frames ?? 0) + no.duracao_frames;
    if (fim > maximo) {
      maximo = fim;
    }
  }

  if (erros.length > 0) {
    throw new ErroDeTempo(erros);
  }
  if (cena.nos.length === 0) {
    throw new ErroDeTempo([`cena "${cena.id}" nao tem nenhum no`]);
  }

  return maximo;
}

// ---------------------------------------------------------------------------
// Fronteiras
// ---------------------------------------------------------------------------

/** Duracao declarada por uma transicao (0 quando ausente). */
export function duracaoDaTransicao(transicao?: Transicao): number {
  return transicao?.duracao_frames ?? 0;
}

/**
 * Uma fronteira por par de cenas adjacentes — nunca uma por campo.
 * Precedencia: `transicao_saida` da anterior; se ausente, `transicao_entrada`
 * da seguinte; se nenhuma, corte seco (0).
 */
export function resolverFronteiras(manifesto: Manifesto): Fronteira[] {
  const fronteiras: Fronteira[] = [];

  for (let i = 0; i + 1 < manifesto.cenas.length; i++) {
    const anterior = manifesto.cenas[i]!;
    const seguinte = manifesto.cenas[i + 1]!;

    const saida = anterior.transicao_saida;
    const entrada = seguinte.transicao_entrada;

    let duracaoFrames = 0;
    let origem: OrigemDaFronteira = "nenhuma";
    let tipo = "none";

    if (saida) {
      duracaoFrames = duracaoDaTransicao(saida);
      origem = "saida";
      tipo = saida.tipo;
    } else if (entrada) {
      duracaoFrames = duracaoDaTransicao(entrada);
      origem = "entrada";
      tipo = entrada.tipo;
    }

    fronteiras.push({
      indiceAnterior: i,
      cenaAnterior: anterior.id,
      cenaSeguinte: seguinte.id,
      duracaoFrames,
      origem,
      tipo,
    });
  }

  return fronteiras;
}

// ---------------------------------------------------------------------------
// Calculo principal
// ---------------------------------------------------------------------------

/**
 * Resolve a linha do tempo inteira.
 *
 * 1. duracao propria de cada cena = max(entrada_frames + duracao_frames)
 * 2. uma fronteira por par adjacente (precedencia saida > entrada)
 * 3. cena i+1 comeca em fim(i) - fronteira(i)
 * 4. total = ultimo frameFinal = SOMA(cenas) - SOMA(fronteiras)
 */
export function calcularDuracao(manifesto: Manifesto): DuracaoResolvida {
  if (manifesto.cenas.length === 0) {
    throw new ErroDeTempo(["manifesto nao tem nenhuma cena"]);
  }
  if (!Number.isFinite(manifesto.fps) || manifesto.fps <= 0) {
    throw new ErroDeTempo([`fps invalido: ${String(manifesto.fps)}`]);
  }

  const nos = mapaDeNos(manifesto);
  const fronteiras = resolverFronteiras(manifesto);
  const timeline: TimelineCena[] = [];
  const erros: string[] = [];

  let somaCenas = 0;
  let somaTransicoes = 0;
  let inicio = 0;

  for (let i = 0; i < manifesto.cenas.length; i++) {
    const cena = manifesto.cenas[i]!;
    const duracao = duracaoDaCena(cena, nos);
    const fronteiraEntrada = i > 0 ? fronteiras[i - 1]!.duracaoFrames : 0;
    const fronteiraSaida = i < fronteiras.length ? fronteiras[i]!.duracaoFrames : 0;

    if (fronteiraSaida > duracao) {
      erros.push(
        `cena "${cena.id}": fronteira de saida (${fronteiraSaida}) maior que a ` +
          `duracao da cena (${duracao}) — a sobreposicao engoliria a cena inteira`,
      );
    }

    somaCenas += duracao;
    somaTransicoes += fronteiraSaida;

    timeline.push({
      cenaId: cena.id,
      frameInicial: inicio,
      frameFinal: inicio + duracao,
      duracao,
      fronteiraEntrada,
      fronteiraSaida,
    });

    // A proxima cena entra ANTES do fim desta, pela duracao da fronteira.
    inicio = inicio + duracao - fronteiraSaida;
  }

  if (erros.length > 0) {
    throw new ErroDeTempo(erros);
  }

  const totalFrames = timeline[timeline.length - 1]!.frameFinal;

  if (totalFrames !== somaCenas - somaTransicoes) {
    // Invariante interna: se isto disparar, a aritmetica divergiu do modelo.
    throw new ErroDeTempo([
      `invariante quebrada: total ${totalFrames} != somaCenas ${somaCenas} - ` +
        `somaTransicoes ${somaTransicoes}`,
    ]);
  }

  return {
    totalFrames,
    totalSegundos: totalFrames / manifesto.fps,
    somaCenas,
    somaTransicoes,
    fronteiras: Object.freeze(fronteiras),
    timeline: Object.freeze(timeline),
  };
}

/**
 * Confere a coerencia de uma linha do tempo ja resolvida.
 * Devolve a lista de problemas (vazia = coerente).
 */
export function validarTimeline(timeline: readonly TimelineCena[]): string[] {
  const erros: string[] = [];

  for (const t of timeline) {
    if (t.frameInicial >= t.frameFinal) {
      erros.push(
        `cena ${t.cenaId}: frameInicial (${t.frameInicial}) >= frameFinal (${t.frameFinal})`,
      );
    }
    if (t.duracao <= 0) {
      erros.push(`cena ${t.cenaId}: duracao <= 0 (${t.duracao})`);
    }
  }

  for (let i = 1; i < timeline.length; i++) {
    const anterior = timeline[i - 1]!;
    const atual = timeline[i]!;
    if (atual.frameInicial < anterior.frameInicial) {
      erros.push(
        `cenas fora de ordem: ${anterior.cenaId} (${anterior.frameInicial}) -> ` +
          `${atual.cenaId} (${atual.frameInicial})`,
      );
    }
    const esperado = anterior.frameFinal - atual.fronteiraEntrada;
    if (atual.frameInicial !== esperado) {
      erros.push(
        `cena ${atual.cenaId}: comeca em ${atual.frameInicial}, esperado ${esperado} ` +
          `(fim da anterior ${anterior.frameFinal} menos fronteira ${atual.fronteiraEntrada})`,
      );
    }
  }

  return erros;
}
