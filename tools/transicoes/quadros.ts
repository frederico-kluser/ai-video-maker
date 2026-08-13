// =============================================================================
// QUADROS APROVADOS — quais frames viram snapshot, e por que cada um
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Cada quadro desta lista tem de ser capaz de REPROVAR alguma coisa. Snapshot
// que so registra "renderizou" e peso morto: ele fica verde com quadro vazio,
// com um lado faltando e com a transicao invertida.
//
// A demonstracao tem uma fronteira de 12 frames comecando no frame 18
// (30 de cena - 12 de fronteira). Logo:
//   frame 15 -> antes da fronteira: so a cena A
//   frame 24 -> meio exato (progresso 0.5)
//   frame 21 -> um quarto (progresso 0.25)
//   frame 33 -> depois da fronteira: so a cena B
// =============================================================================

import type { TransicaoTipo } from "../../src/contratos/manifesto";
import {
  DEMO_DURACAO_FRONTEIRA,
  DEMO_FRONTEIRA_INICIO,
  DEMO_FRONTEIRA_MEIO,
} from "../../src/composicao/transicoes/demonstracao";

/** Frame antes da fronteira: so a cena que sai desenha. */
export const FRAME_ANTES = DEMO_FRONTEIRA_INICIO - 3;

/** Frame depois da fronteira: so a cena que entra desenha. */
export const FRAME_DEPOIS = DEMO_FRONTEIRA_INICIO + DEMO_DURACAO_FRONTEIRA + 3;

/** Um quarto da fronteira (progresso 0.25). */
export const FRAME_QUARTO = DEMO_FRONTEIRA_INICIO + DEMO_DURACAO_FRONTEIRA / 4;

/** Um quadro aprovado. */
export interface Quadro {
  /** Nome do arquivo, sem extensao */
  nome: string;
  tipo: TransicaoTipo;
  frame: number;
  /** O que este quadro prova — aparece na mensagem de falha */
  prova: string;
}

export const QUADROS: readonly Quadro[] = [
  {
    nome: "fade-antes",
    tipo: "fade",
    frame: FRAME_ANTES,
    prova: "fora da fronteira so a cena que sai desenha, e a tela e a cor dela inteira",
  },
  {
    nome: "fade-meio",
    tipo: "fade",
    frame: DEMO_FRONTEIRA_MEIO,
    prova:
      "no meio da fronteira o pixel e a mistura 50/50 das duas cores — " +
      "cor que nenhum dos dois lados produz sozinho",
  },
  {
    nome: "fade-depois",
    tipo: "fade",
    frame: FRAME_DEPOIS,
    prova: "depois da fronteira so a cena que entra desenha",
  },
  {
    nome: "wipe-meio",
    tipo: "wipe",
    frame: DEMO_FRONTEIRA_MEIO,
    prova: "metade esquerda e a cena que entra, metade direita a que sai",
  },
  {
    nome: "clock-wipe-meio",
    tipo: "clockWipe",
    frame: DEMO_FRONTEIRA_MEIO,
    prova: "setor de 180 graus: a direita e a cena que entra, a esquerda a que sai",
  },
  {
    nome: "slide-meio",
    tipo: "slide",
    frame: DEMO_FRONTEIRA_MEIO,
    prova: "as duas cenas deslocadas de meia tela, encostadas",
  },
  {
    nome: "cube-meio",
    tipo: "cube",
    frame: DEMO_FRONTEIRA_MEIO,
    prova: "as duas faces do cubo aparecem ao mesmo tempo, em quina",
  },
  {
    nome: "flip-quarto",
    tipo: "flip",
    frame: FRAME_QUARTO,
    prova:
      "a um quarto do giro so a face que sai esta de frente (backface) — " +
      "e ela ja aparece rotacionada, com o palco visivel na borda",
  },
  {
    nome: "none-meio",
    tipo: "none",
    frame: DEMO_FRONTEIRA_MEIO,
    prova: "corte seco: os dois lados existem, e o que entra cobre o que sai",
  },
];

/** Diretorio (relativo a raiz do repo) dos snapshots aprovados. */
export const DIR_APROVADOS = "fixtures/snapshots/transicoes";

/** Nome do arquivo de um quadro. */
export function arquivoDoQuadro(quadro: Quadro): string {
  return `${quadro.nome}.png`;
}
