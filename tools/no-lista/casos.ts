// =============================================================================
// F1-06 — os casos do no `lista`, em um lugar so
// =============================================================================
// Ficam fora do teste porque DOIS consumidores precisam da mesma lista:
//   - tools/no-lista/render.ts, que grava os snapshots aprovados;
//   - tests/composicao/no-lista.test.ts, que renderiza de novo e compara.
// Se cada um tivesse a sua copia, o snapshot passaria a ser comparado contra
// um caso que ninguem aprova — verde sem oraculo.
//
// Os extremos do card sao `um-item` e `vinte-itens`. Os demais existem para
// que o extremo tenha com que ser comparado.
// =============================================================================

import type { NoLista } from "../../src/contratos/manifesto.js";
import { msToFrames, transitionDuration } from "../../src/design/tokens.js";

export interface CasoDeLista {
  /** Nome do arquivo de snapshot (sem extensao, sem acento). */
  nome: string;
  /** O que este caso prova. */
  descricao: string;
  no: NoLista;
  /** Frame LOCAL. Ver `frameCheio` abaixo. */
  frame: number;
  fps: number;
  width: number;
  height: number;
}

const FPS = 30;
const LARGURA = 1920;
const ALTURA = 1080;

/**
 * Frame em que a lista esta inteira em tela: a entrada escalonada ja terminou
 * e a saida ainda nao comecou. A saida dura `transitionDuration.instant` — o
 * mesmo token que o componente usa, importado, nunca redigitado.
 */
export function frameCheio(duracao: number, fps: number): number {
  return duracao - Math.max(1, msToFrames(transitionDuration.instant, fps));
}

/** Gera `quantidade` itens a partir de um molde — ordem explicita, 1..n. */
function itens(quantidade: number, molde: (n: number) => string): string[] {
  return Array.from({ length: quantidade }, (_, i) => molde(i + 1));
}

function lista(
  id: string,
  conteudo: string[],
  duracao: number,
  extra: Partial<Pick<NoLista, "ordenada" | "alinhamento">> = {},
): NoLista {
  return {
    id,
    schema: "Lista.1",
    type: "lista",
    duracao_frames: duracao,
    itens: conteudo,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Casos com snapshot aprovado
// ---------------------------------------------------------------------------

const UM_ITEM = lista(
  "lista-um-item",
  ["Um item so, e a grade nao pode ficar absurda"],
  90,
);

const OITO_ITENS = lista(
  "lista-oito-itens",
  itens(8, (n) => `Etapa ${String(n)}: o pipeline resolve e compoe`),
  120,
);

const VINTE_ITENS = lista(
  "lista-vinte-itens",
  itens(20, (n) => `Invariante ${String(n)}: medida antes do pixel`),
  180,
);

const VINTE_ORDENADA = lista(
  "lista-vinte-ordenada",
  itens(20, (n) => `Passo ${String(n)} da cadeia de producao`),
  180,
  { ordenada: true, alinhamento: "centro" },
);

// Copia dos dados de `n-003` de fixtures/canonico/manifesto-valido.json
// (PREP-w4). Copia, e nao import: o no canonico e artefato compartilhado e
// este card nao o possui. Texto pt-BR com acento exercita a tabela de largura
// por classe de caractere de F1-02.
const CANONICO_N003 = lista(
  "n-003",
  [
    "Cabeçalho: título e subtítulo com alinhamento configurável",
    "Texto: corpo com destaque opcional e animação de entrada",
    "Lista: itens ordenados ou não, com bullets automáticos",
  ],
  180,
);

export const CASOS: readonly CasoDeLista[] = [
  {
    nome: "um-item",
    descricao:
      "UM item: uma coluna, uma linha, bloco justo ao conteudo, fonte no token",
    no: UM_ITEM,
    frame: frameCheio(UM_ITEM.duracao_frames, FPS),
    fps: FPS,
    width: LARGURA,
    height: ALTURA,
  },
  {
    nome: "oito-itens",
    descricao: "Oito itens: a grade abre para duas colunas de quatro linhas",
    no: OITO_ITENS,
    frame: frameCheio(OITO_ITENS.duracao_frames, FPS),
    fps: FPS,
    width: LARGURA,
    height: ALTURA,
  },
  {
    nome: "vinte-itens",
    descricao:
      "VINTE itens: tres colunas de sete linhas, dentro da safe area, fonte >= piso",
    no: VINTE_ITENS,
    frame: frameCheio(VINTE_ITENS.duracao_frames, FPS),
    fps: FPS,
    width: LARGURA,
    height: ALTURA,
  },
  {
    nome: "vinte-itens-entrando",
    descricao:
      "VINTE itens no meio da entrada escalonada: opacidades parciais, ordem do manifesto",
    no: VINTE_ITENS,
    frame: 10,
    fps: FPS,
    width: LARGURA,
    height: ALTURA,
  },
  {
    nome: "vinte-itens-ordenada",
    descricao:
      "VINTE itens numerados e centrados: '1.' e '20.' alinham na mesma coluna de texto",
    no: VINTE_ORDENADA,
    frame: frameCheio(VINTE_ORDENADA.duracao_frames, FPS),
    fps: FPS,
    width: LARGURA,
    height: ALTURA,
  },
  {
    nome: "canonico-n003",
    descricao: "Texto pt-BR longo com acento, como no manifesto canonico",
    no: CANONICO_N003,
    frame: frameCheio(CANONICO_N003.duracao_frames, FPS),
    fps: FPS,
    width: LARGURA,
    height: ALTURA,
  },
];

// ---------------------------------------------------------------------------
// Casos SEM snapshot — os dois lados da fronteira "encolhe" x "falha"
// ---------------------------------------------------------------------------

/**
 * Itens longos o bastante para a fonte do token nao caber, mas curtos o
 * bastante para caberem ACIMA do piso legivel. Aqui encolher e a resposta
 * certa: o texto continua legivel.
 */
export const CASO_QUE_ENCOLHE: CasoDeLista = {
  nome: "vinte-itens-encolhe",
  descricao: "VINTE itens largos: a fonte desce, mas nao abaixo do piso",
  no: lista(
    "lista-vinte-encolhe",
    itens(
      20,
      (n) =>
        `Invariante ${String(n)}: a medida vem antes do pixel e o build para`,
    ),
    180,
  ),
  frame: frameCheio(180, FPS),
  fps: FPS,
  width: LARGURA,
  height: ALTURA,
};

/**
 * Itens que nao cabem nem no piso legivel. Aqui encolher seria mentir: o
 * esperado e TextOverflowError, com o id do no na mensagem.
 */
export const CASO_QUE_NAO_CABE: CasoDeLista = {
  nome: "vinte-itens-estoura",
  descricao: "VINTE itens que nao cabem nem no piso: overflow e erro de build",
  no: lista(
    "lista-vinte-estoura",
    itens(
      20,
      (n) =>
        `Item ${String(n)}: um paragrafo inteiro dentro de um item de lista, ` +
        `com subordinada, aposto e a promessa de que ainda vai caber numa ` +
        `celula de grade de tres colunas sem encolher abaixo do legivel`,
    ),
    180,
  ),
  frame: frameCheio(180, FPS),
  fps: FPS,
  width: LARGURA,
  height: ALTURA,
};
