// =============================================================================
// DEMONSTRACAO — o manifesto minimo que exercita UMA fronteira
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Duas cenas, uma fronteira, cores CHAPADAS de token. A cor chapada nao e
// preguica: e o que torna o snapshot um oraculo de verdade. Com duas cores
// conhecidas, o pixel do meio da fronteira e PREVISTO:
//
//   fade  (sobrepostos) -> o pixel central e a mistura 50/50 das duas cores,
//                          que NENHUM dos dois lados produz sozinho;
//   wipe  (repartidos)  -> a esquerda e uma cor inteira, a direita e a outra.
//
// Um componente que devolvesse quadro vazio, ou que desenhasse so um lado,
// produziria outra cor — e o gate acusa pelo VALOR do pixel, nunca pelo
// codigo de saida (AGENTS.md, C1).
//
// Este modulo NAO usa o registro de nos: o pintor de cena e proprio. Depender
// de `src/composicao/nos/**` seria dependencia lateral com os seis cards
// irmaos desta onda.
// =============================================================================

import type React from "react";
import type {
  AnimacaoDirecao,
  Manifesto,
  TransicaoTipo,
} from "../../contratos/manifesto";
import { background, palette } from "../../design/tokens";
import { SequenciaComTransicoes, type PintorDeCenaProps } from "./sequencia";

// ---------------------------------------------------------------------------
// Dimensoes e tempos da demonstracao
// ---------------------------------------------------------------------------
//
// Pequeno de proposito: o snapshot e comparado byte a byte, e cada pixel a
// mais e custo de render sem ganho de oraculo. As assercoes sao sobre a COR
// de posicoes relativas, que nao dependem da resolucao.

export const DEMO_LARGURA = 480;
export const DEMO_ALTURA = 270;
export const DEMO_FPS = 30;

/** Duracao de cada uma das duas cenas, em frames. */
export const DEMO_DURACAO_CENA = 30;

/** Duracao da fronteira, em frames. Divisivel por 2 e por 4: o meio e exato. */
export const DEMO_DURACAO_FRONTEIRA = 12;

/**
 * Total esperado, calculado a mao:
 *   soma das cenas      = 30 + 30 = 60
 *   soma das fronteiras =           12
 *   TOTAL               = 60 - 12 = 48
 */
export const DEMO_TOTAL_FRAMES = DEMO_DURACAO_CENA * 2 - DEMO_DURACAO_FRONTEIRA;

/** Primeiro frame da sobreposicao: fim da cena 1 menos a fronteira. */
export const DEMO_FRONTEIRA_INICIO = DEMO_DURACAO_CENA - DEMO_DURACAO_FRONTEIRA;

/** Frame do meio exato da fronteira (progresso 0.5). */
export const DEMO_FRONTEIRA_MEIO =
  DEMO_FRONTEIRA_INICIO + DEMO_DURACAO_FRONTEIRA / 2;

/** Ids das duas cenas da demonstracao. */
export const DEMO_CENA_A = "demo-a";
export const DEMO_CENA_B = "demo-b";

// ---------------------------------------------------------------------------
// Cores — de token, nunca literais
// ---------------------------------------------------------------------------

/** Cor da cena que SAI. */
export const COR_A = palette.red[500];

/** Cor da cena que ENTRA. */
export const COR_B = palette.blue[500];

/** Fundo do palco: aparece so onde nenhuma das duas cenas desenha. */
export const COR_PALCO = background.primary;

/** Cor da marca da cena que SAI. */
export const COR_MARCA_A = palette.amber[500];

/** Cor da marca da cena que ENTRA. */
export const COR_MARCA_B = palette.green[500];

/** Cor de cada cena da demonstracao, por id. */
export function corDaCena(cenaId: string): string {
  return cenaId === DEMO_CENA_A ? COR_A : COR_B;
}

/** Cor da marca de cada cena, por id. */
export function corDaMarca(cenaId: string): string {
  return cenaId === DEMO_CENA_A ? COR_MARCA_A : COR_MARCA_B;
}

// ---------------------------------------------------------------------------
// A MARCA — o que distingue "recortar" de "transladar"
// ---------------------------------------------------------------------------
//
// Com cenas de cor chapada, `wipe` e `slide` produzem EXATAMENTE o mesmo
// quadro: os dois partem a tela ao meio, um recortando e o outro deslocando.
// Snapshots identicos byte a byte (medido: mesmo md5) — ou seja, o snapshot
// de slide nao reprovaria um slide que virasse wipe.
//
// A marca conserta isso: e um retangulo preso a uma posicao DENTRO da cena.
// Recortar (wipe, clockWipe) esconde a marca ou a mantem no lugar; transladar
// (slide, cube) a leva junto. As duas transicoes deixam de ter o mesmo pixel.

/** Faixa vertical ocupada pela marca, em porcentagem da altura da cena. */
export const MARCA_TOPO = 8;
export const MARCA_ALTURA = 16;

/** Posicao horizontal da marca, em porcentagem da largura da cena. */
export const MARCA_LARGURA = 16;
export const MARCA_ESQUERDA_A = 6;
export const MARCA_ESQUERDA_B = 78;

/** Posicao horizontal da marca de cada cena. */
export function marcaEsquerda(cenaId: string): number {
  return cenaId === DEMO_CENA_A ? MARCA_ESQUERDA_A : MARCA_ESQUERDA_B;
}

// ---------------------------------------------------------------------------
// O manifesto
// ---------------------------------------------------------------------------

/**
 * Duas cenas, uma fronteira do tipo pedido.
 * A fronteira e declarada SO em `transicao_saida` da primeira cena — declarar
 * dos dois lados e o bug que `tests/fixtures/coerencia-canonica.test.ts` guarda.
 */
export function manifestoDeDemonstracao(
  tipo: TransicaoTipo,
  direcao?: AnimacaoDirecao,
  duracaoFronteira: number = DEMO_DURACAO_FRONTEIRA,
): Manifesto {
  return {
    schema_version: "Manifesto.1",
    fps: DEMO_FPS,
    width: DEMO_LARGURA,
    height: DEMO_ALTURA,
    nos: [
      {
        id: "demo-no-a",
        schema: "Texto.1",
        type: "texto",
        duracao_frames: DEMO_DURACAO_CENA,
        texto: "A",
      },
      {
        id: "demo-no-b",
        schema: "Texto.1",
        type: "texto",
        duracao_frames: DEMO_DURACAO_CENA,
        texto: "B",
      },
    ],
    cenas: [
      {
        id: DEMO_CENA_A,
        nos: ["demo-no-a"],
        transicao_saida: {
          tipo,
          duracao_frames: duracaoFronteira,
          ...(direcao ? { direcao } : {}),
        },
      },
      { id: DEMO_CENA_B, nos: ["demo-no-b"] },
    ],
  };
}

// ---------------------------------------------------------------------------
// O pintor de cena
// ---------------------------------------------------------------------------

/** Pinta a cena inteira com a cor chapada dela, mais a marca de posicao. */
export const PintorChapado: React.FC<PintorDeCenaProps> = ({ cenaId, frame, lado }) => (
  <div
    data-pintura={cenaId}
    data-frame-local={String(frame)}
    data-lado-pintado={lado ?? "sozinha"}
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: corDaCena(cenaId),
    }}
  >
    <div
      data-marca={cenaId}
      style={{
        position: "absolute",
        left: `${String(marcaEsquerda(cenaId))}%`,
        top: `${String(MARCA_TOPO)}%`,
        width: `${String(MARCA_LARGURA)}%`,
        height: `${String(MARCA_ALTURA)}%`,
        backgroundColor: corDaMarca(cenaId),
      }}
    />
  </div>
);

// ---------------------------------------------------------------------------
// O componente da demonstracao
// ---------------------------------------------------------------------------

export interface DemonstracaoProps {
  tipo: TransicaoTipo;
  /** Frame absoluto. Vem por prop. */
  frame: number;
  direcao?: AnimacaoDirecao;
}

export const Demonstracao: React.FC<DemonstracaoProps> = ({ tipo, frame, direcao }) => (
  <div
    data-demonstracao={tipo}
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: COR_PALCO,
    }}
  >
    <SequenciaComTransicoes
      manifesto={manifestoDeDemonstracao(tipo, direcao)}
      frame={frame}
      Cena={PintorChapado}
    />
  </div>
);

export default Demonstracao;
