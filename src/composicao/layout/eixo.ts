// =============================================================================
// EIXO DE TEXTO — o eixo de posicionamento que impede blocos de texto
//                  de se sobreporem
// =============================================================================
// Onda 2 (onda2-composicao, sub-parte 2a): "os textos se sobrepoem".
//
// Duas causas, dois eixos, um modulo:
//
//   1. EIXO ESPACIAL (bandas) — nos de texto da MESMA cena dividem o quadro
//      em bandas verticais disjuntas. Hoje todo no de texto se centraliza no
//      meio do quadro: dois nos de texto na mesma cena se sobrepoem por
//      construcao (c-002: texto+lista; c-003: codigo+lista; c-005:
//      texto+cabecalho). Com banda, o bloco de texto de cada no se
//      centraliza DENTRO da propria banda — bandas disjuntas, blocos
//      disjuntos.
//
//   2. EIXO TEMPORAL (fator de transicao) — durante uma transicao as DUAS
//      cenas desenham ao mesmo tempo (TransitionSeries: total = A + B -
//      duracao da transicao). Se as duas tem texto, os textos se sobrepoem
//      no frame (c-001->c-002 fade, c-002->c-003 wipe). A politica: o texto
//      da cena que SAI some na PRIMEIRA metade da transicao (fator 1->0 em
//      [0, 0.5]) e o texto da cena que ENTRA aparece na SEGUNDA metade
//      (fator 0->1 em [0.5, 1]). Em nenhum frame os dois lados tem texto
//      visivel ao mesmo tempo.
//
// O eixo NAO muda a aritmetica de tempo (../tempo.ts) nem o schema do
// manifesto: ele e uma camada de composicao. Os nos recebem o eixo por
// anexacao ao proprio `no` (o mesmo padrao de `grafico_resolvido` da
// fiacao): `no.eixo = { regiao?, fatorTexto?, videoInicioAbsoluto? }`.
//
// O fator e aplicado pelo ENVELOPE do no (o container), nunca dentro da
// aritmetica de opacidade do proprio no — AB-312 continua valendo: o fade
// de saida da propria janela do no nao e multiplicado pela transicao.
//
// PURO: nada de hook, nada de relogio, nada de disco.
// =============================================================================

import type { Cena, No } from "../../contratos/manifesto";
import { safeArea16x9 } from "../../design/tokens";
import type { NoGraficoResolvido } from "../nos/grafico";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Retangulo em px, canto superior esquerdo + dimensoes. */
export interface Regiao {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Quais tipos de no participam do eixo de texto.
 *
 * Inclui `codigo`: o bloco de codigo e texto legivel — deixar o codigo
 * centralizado no quadro inteiro enquanto a lista ganha uma banda
 * reproduziria a sobreposicao com outro nome. (A sonda do oraculo cobre
 * texto/lista/cabecalho; o codigo entra no eixo pelo mesmo contrato.)
 *
 * Inclui `midia` (Onda 3): a LEGENDA do no de midia (gif/video) e texto
 * legivel — sem banda e fator, a legenda da cena c-005 colidiria com o
 * texto dos irmaos e quebraria o C2 da sonda na transicao. A IMAGEM nao
 * participa (eDeTexto refina por tipo_midia): o n-005 e `cover` e nao
 * renderiza legenda (decisao documentada no handoff da Onda 3), entao
 * nao deve roubar banda dos irmaos na cena c-003.
 */
export const TIPOS_DE_TEXTO: readonly string[] = [
  "cabecalho",
  "texto",
  "lista",
  "codigo",
  "midia",
];

/** O eixo anexado ao no pelo ponto de fiacao da cena. */
export interface EixoDoNo {
  /**
   * Banda onde o bloco de texto se centraliza. Ausente = quadro inteiro
   * (o comportamento historico do no, quando ele esta sozinho na cena).
   */
  regiao?: Regiao;
  /**
   * Fator de visibilidade durante a transicao da cena. 1 fora de fronteira;
   * a cena que sai cai a 0 na primeira metade; a que entra sobe na segunda.
   */
  fatorTexto?: number;
  /**
   * Base absoluta (em frames da composicao) do relogio de um video de
   * grafico. Sem `<Sequence>` na camada de pintura, o OffthreadVideo veria
   * o frame absoluto da composicao (427..547 na cena c-004) e pediria ao
   * webm de 90-120 frames um frame alem do fim — preto. Com a base, o no
   * envolve o video num `<Sequence from={base}>` e o relogio do video
   * comeca em 0 no primeiro frame do no (ou da sua fatia na montagem).
   */
  videoInicioAbsoluto?: number;
}

/** Um no com o eixo anexado (a fiacao anexa; os nos leem). */
export type NoComEixo = No & {
  readonly eixo?: EixoDoNo;
};

// ---------------------------------------------------------------------------
// Eixo espacial — bandas verticais
// ---------------------------------------------------------------------------

/** O no participa do eixo de texto? */
export function eDeTexto(no: No): boolean {
  if (no.type === "midia") {
    // Onda 3: so gif/video renderizam legenda (temLegenda em nos/midia.tsx)
    // e participam do eixo; imagem cover nao tem legenda e nao rouba banda.
    return no.tipo_midia === "gif" || no.tipo_midia === "video";
  }
  return TIPOS_DE_TEXTO.includes(no.type);
}

/** Regiao padrao: o quadro inteiro (no de texto sozinho na cena). */
export function regiaoDoQuadro(width: number, height: number): Regiao {
  return { x: 0, y: 0, largura: width, altura: height };
}

/**
 * Uma banda por no de texto da cena, na ordem de `cena.nos`, de cima para
 * baixo, dentro da graphics safe da EBU R 95. Bandas disjuntas: dois blocos
 * de texto da mesma cena nunca se tocam, por construcao.
 *
 * Cena com um unico no de texto: banda = quadro inteiro (comportamento
 * historico — o titulo da cena de abertura continua centralizado).
 */
export function regioesDeTextoDaCena(
  cena: Cena,
  porId: ReadonlyMap<string, No>,
  width: number,
  height: number,
): Map<string, Regiao> {
  const nosDeTexto: string[] = [];
  for (const noId of cena.nos) {
    const no = porId.get(noId);
    if (no !== undefined && eDeTexto(no)) nosDeTexto.push(noId);
  }

  const saida = new Map<string, Regiao>();
  if (nosDeTexto.length === 0) return saida;
  if (nosDeTexto.length === 1) {
    saida.set(nosDeTexto[0]!, regiaoDoQuadro(width, height));
    return saida;
  }

  const margem = Math.round(height * safeArea16x9.graphicsSafePct);
  const topo = margem;
  const base = height - margem;
  const alturaDeBanda = (base - topo) / nosDeTexto.length;

  nosDeTexto.forEach((noId, indice) => {
    const y = Math.round(topo + indice * alturaDeBanda);
    const altura = Math.round(y + alturaDeBanda) - y;
    saida.set(noId, { x: 0, y, largura: width, altura });
  });
  return saida;
}

// ---------------------------------------------------------------------------
// Eixo temporal — o fator de texto na transicao
// ---------------------------------------------------------------------------

/**
 * Fator de visibilidade do texto de uma cena dentro da transicao.
 *
 *   lado "saindo"   -> 1 - 2p   (some na PRIMEIRA metade da transicao)
 *   lado "entrando" -> 2p - 1   (aparece na SEGUNDA metade)
 *   lado null       -> 1        (fora de fronteira)
 *
 * Em p = 0.5 os dois fatores sao 0: nunca existe um frame em que o texto
 * dos dois lados esteja visivel ao mesmo tempo — a causa da sobreposicao
 * durante as transicoes (fade, wipe, clockWipe) fica eliminada por
 * construcao. A sonda (tests/composicao/layout/sonda-de-texto.test.ts)
 * cobra o resultado: em cada frame de fronteira, no maximo UM lado tem
 * texto acima do limiar de visibilidade.
 */
export function fatorDeTextoNaTransicao(
  lado: "saindo" | "entrando" | null,
  progresso: number,
): number {
  if (lado === null) return 1;
  if (lado === "saindo") return Math.max(0, Math.min(1, 1 - progresso * 2));
  return Math.max(0, Math.min(1, progresso * 2 - 1));
}

// ---------------------------------------------------------------------------
// Montagem de graficos-video — uma fatia da cena para cada video
// ---------------------------------------------------------------------------

/** Uma fatia da montagem: o no ocupa [inicio, inicio+duracao) da cena. */
export interface FatiaDeMontagem {
  noId: string;
  inicio: number;
  duracao: number;
}

/**
 * Escalona os nos `grafico` de VIDEO de uma cena em fatias sequenciais.
 *
 * Por que: os webm de matematica (estagio grafico, F2-02) sao 1920x1080 —
 * quadro cheio, como o proprio video final. Cinco videos de quadro cheio na
 * mesma cena (c-004: n-009..n-013, todos com janela [0, duracao)) nao podem
 * desenhar ao mesmo tempo: so o de cima apareceria. A montagem da a cada
 * video uma fatia da cena, na ordem do manifesto, e o pintor de cena so
 * desenha o video cuja fatia contem o frame.
 *
 * Condicao: a cena tem >= 2 nos `grafico` e TODOS os nos `grafico` da cena
 * tem asset resolvido de tipo video (a fixture integrada, com assets PNG,
 * continua no comportamento historico — cada grafico desenha na propria
 * janela).
 *
 * O escalonamento NAO muda a duracao da cena nem as janelas declaradas:
 * cada fatia cabe na cena e na janela do proprio no (o ultimo video recebe
 * o resto da cena, para a soma ser exata).
 */
export function escalonarGraficosDaCena(
  cena: Cena,
  porId: ReadonlyMap<string, No>,
  duracaoDaCena: number,
): readonly FatiaDeMontagem[] {
  const graficos: string[] = [];
  for (const noId of cena.nos) {
    const no = porId.get(noId);
    if (no === undefined || no.type !== "grafico") continue;
    const resolvido = (no as NoGraficoResolvido).grafico_resolvido;
    if (resolvido === undefined || resolvido.asset.tipo !== "video") return [];
    graficos.push(noId);
  }
  if (graficos.length < 2) return [];

  const passo = Math.floor(duracaoDaCena / graficos.length);
  if (passo < 1) return [];

  const saida: FatiaDeMontagem[] = [];
  graficos.forEach((noId, indice) => {
    const inicio = indice * passo;
    const fim =
      indice === graficos.length - 1 ? duracaoDaCena : inicio + passo;
    saida.push({ noId, inicio, duracao: fim - inicio });
  });
  return saida;
}
