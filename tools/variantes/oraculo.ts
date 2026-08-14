// =============================================================================
// ORACULO DE PIXEL DAS VARIANTES — o ∅-crit medido no quadro renderizado
// =============================================================================
// Card: F5-04 (W7) — Variantes de proporcao.
//
// Duas medicoes, complementares:
//
//   1. PRESENCA DE CONTEUDO DENTRO da safe area da plataforma (C1): a
//      regiao segura do quadro NAO pode ser chapada — um quadro vazio (so
//      fundo e camadas) passaria em qualquer metrica estrutural, e o card
//      existe para que o CONTEUDO esteja la, dentro da safe area.
//
//   2. NADA DE TINTA NAO-EXPLICADA FORA da safe area (o ∅-crit em pixel):
//      todo pixel fora do retangulo seguro da plataforma tem de ser
//      explicado pelo PLANO DE CAMADAS (fundo/grade/vinheta, que declaram
//      cada retangulo que pintam — o contrato de F1-11). Um pixel fora da
//      safe area que NAO casa com o plano e TINTA DE CONTEUDO vazada —
//      "conteudo fora da safe area", VERMELHO, nomeando a posicao.
//
// A expectativa e computada, nunca chutada: o plano de cada camada e uma
// funcao pura do frame (CAMADAS de src/composicao/camadas/registro), e a
// composicao e a mesma do navegador — blend source-over em 8 bits, na
// ordem do registro (fundo -> grade -> vinheta) sobre a cor de base do
// AbsoluteFill. Tolerancia de 3 por canal absorve o arredondamento do
// compositor (a mesma ordem de grandeza que o oraculo integrado usa).
//
// A geometria segura vem do contrato de variantes
// (src/entrega/variantes/plataformas.ts) — os TOKENS, nunca literais.
// =============================================================================

import { background, palette } from "../../src/design/tokens";
import { CAMADAS } from "../../src/composicao/camadas/registro";
import type {
  CamadaProps,
  RetanguloPintado,
} from "../../src/composicao/camadas/contrato-de-camada";
import { contemPonto } from "../../src/composicao/camadas/geometria";
import type { Retangulo } from "../../src/composicao/camadas/geometria";
import { planoDeComposicao, faixasVisiveis } from "../../src/composicao/ManifestoRaiz";
import { regiaoDoQuadro, type NoComEixo } from "../../src/composicao/layout/eixo";
import type { Manifesto } from "../../src/contratos/manifesto";
import type { PngDecodificado } from "../../tests/integracao/composicao/png";
import { medirRegiao } from "../../tests/integracao/composicao/png";
import { safeRectDaPlataforma, type Plataforma } from "../../src/entrega/variantes/plataformas";

// ---------------------------------------------------------------------------
// O fundo opaco dos nos
// ---------------------------------------------------------------------------

/**
 * Tipos de no que pintam um fundo OPACO (`backgroundColor: background.primary`)
 * — cabecalho (F1-04), texto (F1-05) e codigo (F1-07). O retangulo pintado e
 * a BANDA do no no eixo de posicionamento (`no.eixo.regiao`, onda 2); sem
 * eixo, o quadro inteiro. Um no desses visivel no frame esconde o fundo da
 * camada por baixo dele na sua banda: a expectativa de pixel fora da safe
 * area tem de levar a banda do no em conta, ou o oraculo acusa o proprio
 * fundo do no como "tinta nao-explicada". Os nos que NAO pintam fundo
 * (midia, grafico, lista) nao entram na lista — conferido nos componentes
 * (midia declara "CONTRATO DE ALFA: nenhuma cor de fundo aqui"; grafico
 * "Este no NAO pinta fundo").
 */
const NOS_COM_FUNDO_OPACO: ReadonlySet<string> = new Set([
  "cabecalho",
  "texto",
  "codigo",
]);

// ---------------------------------------------------------------------------
// Cores de referencia — tokens, nunca literais
// ---------------------------------------------------------------------------

const COR_DE_BASE = background.primary; // AbsoluteFill + fundo base

/** Cores distintas minimas dentro da safe area para o quadro ter conteudo. */
export const LIMIAR_CORES_DENTRO_DA_SAFE_AREA = 8;

/** Tolerancia por canal contra o arredondamento do compositor. */
export const TOLERANCIA_POR_CANAL = 3;

// ---------------------------------------------------------------------------
// A expectativa — o que as camadas pintam em cada pixel
// ---------------------------------------------------------------------------

function hexParaRgb(cor: string): [number, number, number] {
  const c = cor.replace("#", "");
  return [
    Number.parseInt(c.slice(0, 2), 16),
    Number.parseInt(c.slice(2, 4), 16),
    Number.parseInt(c.slice(4, 6), 16),
  ];
}

/**
 * O plano de pintura do frame, na ordem de composicao que o navegador
 * compoe (z-index): fundo (z0) -> fundo opaco dos nos visiveis (z10) ->
 * grade (z20) -> vinheta (z20). Funcao pura do (frame, canvas, fps,
 * duracao, manifesto): o envelope de janela das camadas depende dos tres
 * primeiros, e o plano tem de bater com o que o pintor promovido pintou
 * (arvore.ts passa exatamente estas props a CAMADAS; os nos visiveis sao
 * os de faixasVisiveis no frame).
 *
 * Os retangulos dos fundos opacos dos nos sao inseridos com opacidade 1
 * na posicao da banda de cada no: quando existem, RESETAM o acumulado para
 * background.primary naquela banda — exatamente o que o fundo do no faz.
 * Os frames do gate sao escolhidos no meio das janelas (opacidade dos nos
 * = 1).
 */
export function planoDeCamadasDoFrame(
  frame: number,
  canvas: { width: number; height: number },
  fps: number,
  duracaoEmFrames: number,
  manifesto: Manifesto,
): RetanguloPintado[] {
  const props: CamadaProps = {
    frame,
    fps,
    width: canvas.width,
    height: canvas.height,
    duracaoEmFrames,
  };
  const plano: RetanguloPintado[] = [];
  for (const modulo of CAMADAS) {
    plano.push(...modulo.plano(props));
    // O fundo opaco dos nos entra DEPOIS do fundo (z0) e ANTES das
    // sobreposicoes (grade/vinheta, z20) — a mesma posicao dos nos na
    // arvore do pintor (z10). A ordem do registro e [fundo, grade,
    // vinheta], entao inserir apos o modulo "fundo" e exatamente o ponto.
    if (modulo.meta.papel === "fundo") {
      // Eixo de posicionamento (onda 2, commit 48add36): cada no de texto
      // pinta o fundo opaco na SUA banda (`no.eixo.regiao`), nao no quadro
      // inteiro — o mesmo contrato do componente (`regiao = comEixo.eixo?.
      // regiao ?? regiaoDoQuadro(...)`, src/composicao/nos/cabecalho.tsx:378).
      // No sem eixo (sozinho na cena) continua pintando o quadro inteiro. O
      // modelo antigo (um retangulo de tela cheia) ficou stale com o eixo e
      // acusava o proprio plano de camadas (banho + vinheta) como tinta
      // nao-explicada (medido: 107456 pixels em variante-16x9-c002-frame140).
      const visiveis = faixasVisiveis(planoDeComposicao(manifesto), frame);
      for (const { faixa } of visiveis) {
        if (!NOS_COM_FUNDO_OPACO.has(faixa.tipo)) {
          continue;
        }
        const no = faixa.no as NoComEixo;
        const regiao = no.eixo?.regiao ?? regiaoDoQuadro(canvas.width, canvas.height);
        plano.push({
          nome: `fundo-opaco-${faixa.noId}`,
          x: regiao.x,
          y: regiao.y,
          largura: regiao.largura,
          altura: regiao.altura,
          opacidade: 1,
          cor: background.primary,
        });
      }
    }
  }
  return plano;
}

/**
 * A cor esperada do pixel (x, y) segundo o plano de camadas: a base do
 * AbsoluteFill, com cada retangulo do plano que contem o pixel aplicado em
 * blend source-over com arredondamento de 8 bits — o que o navegador faz.
 */
export function corEsperada(
  plano: readonly RetanguloPintado[],
  x: number,
  y: number,
): [number, number, number] {
  let [r, g, b] = hexParaRgb(COR_DE_BASE);
  for (const retangulo of plano) {
    if (retangulo.opacidade <= 0 || !contemPonto(retangulo, x, y)) {
      continue;
    }
    const [sr, sg, sb] = hexParaRgb(retangulo.cor);
    const a = retangulo.opacidade;
    r = Math.round(sr * a + r * (1 - a));
    g = Math.round(sg * a + g * (1 - a));
    b = Math.round(sb * a + b * (1 - a));
  }
  return [r, g, b];
}

/** O pixel (x, y) difere da cor esperada alem da tolerancia? */
function difereDoEsperado(
  png: PngDecodificado,
  plano: readonly RetanguloPintado[],
  x: number,
  y: number,
): boolean {
  const i = y * png.largura + x;
  const [er, eg, eb] = corEsperada(plano, x, y);
  const dr = Math.abs(png.rgba[i * 4]! - er);
  const dg = Math.abs(png.rgba[i * 4 + 1]! - eg);
  const db = Math.abs(png.rgba[i * 4 + 2]! - eb);
  return dr > TOLERANCIA_POR_CANAL || dg > TOLERANCIA_POR_CANAL || db > TOLERANCIA_POR_CANAL;
}

// ---------------------------------------------------------------------------
// As medicoes
// ---------------------------------------------------------------------------

export interface FalhaDoOraculoDeVariante {
  readonly regiao: string;
  readonly motivo: string;
}

/**
 * Mede o quadro renderizado contra o contrato de safe area da plataforma:
 *
 *  - presenca: cores distintas dentro do retangulo seguro >= limiar
 *    (quadro chapado = VERMELHO — C1, o quadro vazio e deterministico);
 *  - vazamento: todo pixel FORA do retangulo seguro tem de casar com o
 *    plano de camadas (tinta de conteudo fora da safe area = VERMELHO —
 *    o ∅-crit do card, em pixel).
 *
 * `frame` e o frame absoluto do still (as camadas dependem do frame).
 */
export function medirVarianteNoQuadro(
  png: PngDecodificado,
  frame: number,
  canvas: { width: number; height: number },
  fps: number,
  duracaoEmFrames: number,
  plataforma: Plataforma,
  manifesto: Manifesto,
): FalhaDoOraculoDeVariante[] {
  const falhas: FalhaDoOraculoDeVariante[] = [];
  const seguro = safeRectDaPlataforma(canvas, plataforma);

  // 1. Presenca de conteudo dentro da safe area.
  const dentro = medirRegiao(
    png,
    seguro.x,
    seguro.y,
    seguro.largura,
    seguro.altura,
  );
  if (dentro.coresDistintas < LIMIAR_CORES_DENTRO_DA_SAFE_AREA) {
    falhas.push({
      regiao: "dentro-da-safe-area",
      motivo:
        `a regiao segura tem ${String(dentro.coresDistintas)} cores distintas ` +
        `(< ${String(LIMIAR_CORES_DENTRO_DA_SAFE_AREA)}) — quadro chapado ` +
        "dentro da safe area, conteudo ausente (C1)",
    });
  }

  // 2. Nada de tinta nao-explicada fora da safe area.
  const plano = planoDeCamadasDoFrame(frame, canvas, fps, duracaoEmFrames, manifesto);
  let vazados = 0;
  let primeiroVazado: { x: number; y: number } | null = null;
  for (let y = 0; y < png.altura; y++) {
    for (let x = 0; x < png.largura; x++) {
      if (contemPonto(seguro, x, y)) {
        continue;
      }
      if (difereDoEsperado(png, plano, x, y)) {
        vazados++;
        if (primeiroVazado === null) {
          primeiroVazado = { x, y };
        }
      }
    }
  }
  if (vazados > 0) {
    falhas.push({
      regiao: "fora-da-safe-area",
      motivo:
        `${String(vazados)} pixel(is) de tinta nao-explicada FORA da safe area ` +
        `da plataforma ${plataforma.id} (primeiro em (${String(primeiroVazado?.x)},` +
        `${String(primeiroVazado?.y)})) — conteudo fora da safe area, VERMELHO`,
    });
  }

  return falhas;
}
