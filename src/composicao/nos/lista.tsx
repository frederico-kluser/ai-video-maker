// =============================================================================
// NO: lista — bullets, numeracao e grade
// =============================================================================
// Card: F1-06 — o caso "UM item" e o caso "VINTE itens".
//
// O ponto deste no esta nos extremos, nao no caso medio:
//
//   UM item     — a grade nao pode ficar absurda. Uma celula nao vira um
//                 retangulo de 1786x1004 com uma palavra dentro: o bloco e
//                 justo ao conteudo, uma coluna, uma linha, centrado no eixo
//                 vertical. A fonte tambem nao infla para "preencher".
//
//   VINTE itens — nada sai da safe area e nada encolhe abaixo do piso legivel.
//                 Encolher para caber e pior que falhar: o video sai ilegivel
//                 e o build fica verde. Por isso a fonte so desce ate o piso
//                 (F1-02, MIN_FONT_SIZE_PX, elevado por typeScale.small na
//                 resolucao corrente) e, se nem ali couber, o motor de layout
//                 LANCA TextOverflowError — overflow e erro de build, nunca
//                 texto cortado no video.
//
// CONTRATO (cobrado por `just comp-pureza`):
//   - funcao pura de (no, frame, fps, width, height); `frame` vem por PROP;
//   - zero Date.now / Math.random / setTimeout / fetch;
//   - zero animacao CSS, zero background-image, zero mask-image;
//   - toda interpolacao com extrapolateLeft/Right explicitos;
//   - imports relativos: o bundler e webpack e nao le os `paths` do tsconfig.
//
// REGRA 1 (AGENTS.md) — iteracao sobre objeto sem ordenacao explicita e
// proibida. Aqui so se itera sobre ARRAYS (`itens`, colunas derivadas dele),
// cuja ordem e a do manifesto. Nenhum Object.keys/for-in em lugar nenhum:
// uma lista renderizada em ordem de chave de objeto muda entre versoes.
//
// Ver docs/adr/0007-no-lista-grade-e-extremos.md.
// =============================================================================

import { interpolate } from "remotion";
import type { Alinhamento, NoLista } from "../../contratos/manifesto";
import {
  breakpoints,
  fontFamily,
  fontWeight,
  lineHeight,
  msToFrames,
  safeArea16x9,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";
import { MIN_FONT_SIZE_PX, fitTextToBounds } from "../layout/ajuste";
import { measureTextWidth } from "../layout/medicao";
import { assertNoOverflow, type NodeContext } from "../layout/overflow";

export const meta: NoComponentMeta = {
  tipo: "lista",
  schema: "Lista.1",
  id: "no-lista",
  descricao: "Lista de itens com marcadores ou numeracao",
};

// ---------------------------------------------------------------------------
// Estrutura da grade
// ---------------------------------------------------------------------------
// Estes dois numeros NAO sao tokens de design (cor, espacamento, duracao,
// fonte, tamanho) — sao a FORMA da grade, e nao existem em src/design/tokens.ts.
// Ficam aqui porque tokens.ts e singleton (S-5) e esta onda nao pode edita-lo;
// se o projeto quiser tokeniza-los, isso e PREP da onda seguinte (handoff).
//
// 7 itens por coluna: heuristica de agrupamento de Miller (1956), "7 mais ou
// menos 2" — https://psychclassics.yorku.ca/Miller/ (2026-08-11). E heuristica
// declarada, nao norma herdada.
const ITENS_POR_COLUNA_ALVO = 7;

// Tres colunas e o teto: com quatro, a largura de coluna em 16:9 cai abaixo do
// que uma frase de lista precisa, e a fonte comeca a encolher por causa da
// GRADE, nao do conteudo.
const COLUNAS_MAX = 3;

/** Marcador de item nao ordenado (U+2022 BULLET). */
const MARCADOR_BULLET = "•";

// ---------------------------------------------------------------------------
// O plano — geometria e animacao, em dados, antes de virar DOM
// ---------------------------------------------------------------------------
// O componente nao calcula nada dentro do JSX: ele desenha este plano. E o que
// permite ao teste assertar safe area, piso de fonte e janela temporal em
// NUMEROS, sem depender de parsear HTML.

/** Retangulo em px, canto superior esquerdo + dimensoes. */
export interface RetanguloDeLista {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Uma celula da grade: um item, sua posicao e sua opacidade neste frame. */
export interface CaixaDeItem {
  /** Posicao no array `itens` do manifesto — a ordem e a do manifesto. */
  indice: number;
  texto: string;
  marcador: string;
  coluna: number;
  linha: number;
  x: number;
  y: number;
  largura: number;
  altura: number;
  /** Largura medida de "marcador + espaco + texto" na fonte escolhida. */
  larguraMedida: number;
  /** Opacidade do item neste frame (ja inclui a entrada escalonada). */
  opacidade: number;
}

/** Tudo que o componente precisa para desenhar — e o teste, para reprovar. */
export interface PlanoDeLista {
  noId: string;
  /** false quando o frame esta fora de [0, duracao_frames): nao desenha nada. */
  visivel: boolean;
  frame: number;
  duracaoFrames: number;
  itens: number;
  colunas: number;
  linhas: number;
  fonte: number;
  /** Piso legivel na resolucao corrente. A fonte nunca fica abaixo dele. */
  pisoDeFonte: number;
  /** Tamanho de fonte pedido pelo token antes de qualquer ajuste. */
  fonteBase: number;
  alturaDeLinha: number;
  larguraMarcador: number;
  opacidadeDoNo: number;
  alinhamento: Alinhamento;
  safeRect: RetanguloDeLista;
  /** O retangulo REALMENTE ocupado pela grade — justo ao conteudo. */
  bloco: RetanguloDeLista;
  caixas: CaixaDeItem[];
}

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

/** Arredonda para 3 casas — opacidade legivel e estavel no snapshot. */
function arredondar3(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/** Marcador do item: numero quando ordenada, bullet quando nao. */
function marcadorDe(lista: NoLista, indice: number): string {
  return lista.ordenada === true ? `${String(indice + 1)}.` : MARCADOR_BULLET;
}

/**
 * Marcador mais largo da lista. A medicao e linear no tamanho da fonte, entao
 * a ordem nao depende do tamanho em que se mede — medir na base basta.
 * Todos os itens sao MEDIDOS com este marcador: assim a coluna de texto comeca
 * no mesmo x em todos ("1." e "20." nao desalinham) e a medida e conservadora.
 */
function marcadorMaisLargo(marcadores: readonly string[], fonte: number): string {
  let escolhido = marcadores[0] ?? "";
  let largura = measureTextWidth(escolhido, fonte);
  for (const marcador of marcadores) {
    const candidata = measureTextWidth(marcador, fonte);
    if (candidata > largura) {
      escolhido = marcador;
      largura = candidata;
    }
  }
  return escolhido;
}

/** Alinhamento do manifesto para o valor de `text-align`. */
function textAlignDe(alinhamento: Alinhamento): "left" | "center" | "right" {
  if (alinhamento === "centro") return "center";
  if (alinhamento === "direita") return "right";
  return "left";
}

// ---------------------------------------------------------------------------
// planejarLista — a funcao que decide tudo
// ---------------------------------------------------------------------------

/**
 * Calcula grade, fonte, posicoes e opacidades. LANCA quando o conteudo nao
 * couber na safe area no piso legivel — falhar e o comportamento correto,
 * encolher abaixo do piso seria um video ilegivel com build verde.
 *
 * @throws {TextOverflowError} conteudo que nao cabe nem no piso de fonte
 * @throws {Error} lista sem itens (o schema exige minItems 1)
 */
export function planejarLista(
  lista: NoLista,
  frame: number,
  fps: number,
  width: number,
  height: number,
): PlanoDeLista {
  const itens = lista.itens;
  if (itens.length === 0) {
    throw new Error(
      `no "${lista.id}" (lista): \`itens\` vazio — um quadro vazio nao e ` +
        `saida valida (schema exige minItems 1)`,
    );
  }

  const duracao = lista.duracao_frames;
  const alinhamento: Alinhamento = lista.alinhamento ?? "esquerda";

  // --- Safe area: percentual do token, aplicado a resolucao corrente ---------
  // EBU R 95 action safe. Percentual, e nao margem em px, porque o mesmo no
  // renderiza em 1080p e em 4K.
  const margemH = Math.round(width * safeArea16x9.actionSafePct);
  const margemV = Math.round(height * safeArea16x9.actionSafePct);
  const safeRect: RetanguloDeLista = {
    x: margemH,
    y: margemV,
    largura: width - margemH * 2,
    altura: height - margemV * 2,
  };

  // --- Espacos: token escalado pela altura do frame -------------------------
  const escala = height / breakpoints.hd.height;
  const gapColuna = Math.max(1, Math.round(spacing["12"] * escala));
  const gapLinha = Math.max(1, Math.round(spacing["3"] * escala));

  // --- Grade ---------------------------------------------------------------
  const colunas = Math.max(
    1,
    Math.min(COLUNAS_MAX, Math.ceil(itens.length / ITENS_POR_COLUNA_ALVO)),
  );
  const linhas = Math.ceil(itens.length / colunas);
  const larguraColuna = Math.floor(
    (safeRect.largura - gapColuna * (colunas - 1)) / colunas,
  );

  // --- Fonte: nunca cresce acima do token, so desce ate o piso --------------
  const pisoDeFonte = Math.max(
    MIN_FONT_SIZE_PX,
    Math.round(height * typeScale.small),
  );
  const fonteBase = Math.max(pisoDeFonte, Math.round(height * typeScale.body));

  // Preenchimento coluna-a-coluna (leitura de cima para baixo, depois a
  // proxima coluna). `indice` continua sendo a ordem do manifesto.
  const marcadores = itens.map((_, indice) => marcadorDe(lista, indice));
  const prefixo = `${marcadorMaisLargo(marcadores, fonteBase)} `;
  const colunasDeTexto: string[][] = [];
  for (let c = 0; c < colunas; c++) colunasDeTexto.push([]);
  itens.forEach((texto, indice) => {
    const coluna = Math.floor(indice / linhas);
    colunasDeTexto[coluna]?.push(prefixo + texto);
  });

  // Altura util de uma coluna com `n` linhas. O `- n` reserva 1px por linha
  // para o arredondamento PARA CIMA da altura de linha; sem essa reserva, o
  // bloco pode passar da safe area por alguns pixels sem ninguem ver.
  const alturaUtil = (n: number): number =>
    safeRect.altura - gapLinha * Math.max(0, n - 1) - n;

  let fonte = fonteBase;
  for (const coluna of colunasDeTexto) {
    if (coluna.length === 0) continue;
    const ajuste = fitTextToBounds(
      coluna.join("\n"),
      larguraColuna,
      alturaUtil(coluna.length),
      fonteBase,
      lineHeight.normal,
      pisoDeFonte,
    );
    if (ajuste.fontSize < fonte) fonte = ajuste.fontSize;
  }

  // Overflow e ERRO DE BUILD. Se a coluna nao couber no piso, `assertNoOverflow`
  // lanca TextOverflowError nomeando este no — e o render para aqui.
  for (const coluna of colunasDeTexto) {
    if (coluna.length === 0) continue;
    const ctx: NodeContext = {
      nodeId: lista.id,
      nodeType: meta.tipo,
      maxWidth: larguraColuna,
      maxHeight: alturaUtil(coluna.length),
      fontSize: fonte,
    };
    assertNoOverflow(coluna.join("\n"), ctx, lineHeight.normal);
  }

  // --- Geometria -----------------------------------------------------------
  const alturaDeLinha = Math.ceil(fonte * lineHeight.normal);
  const larguraMarcador = Math.ceil(measureTextWidth(prefixo, fonte));
  const larguraDeConteudo = Math.ceil(
    measureTextWidth(itens.map((texto) => prefixo + texto).join("\n"), fonte),
  );
  // O bloco e JUSTO AO CONTEUDO. E isto que impede a grade absurda com um
  // item so: a celula nao se estica pela safe area inteira.
  const larguraDaCelula = Math.min(larguraColuna, larguraDeConteudo);

  const bloco: RetanguloDeLista = {
    x: 0,
    y: safeRect.y + Math.floor((safeRect.altura - (linhas * alturaDeLinha + gapLinha * (linhas - 1))) / 2),
    largura: colunas * larguraDaCelula + gapColuna * (colunas - 1),
    altura: linhas * alturaDeLinha + gapLinha * (linhas - 1),
  };
  bloco.x =
    alinhamento === "centro"
      ? safeRect.x + Math.floor((safeRect.largura - bloco.largura) / 2)
      : alinhamento === "direita"
        ? safeRect.x + safeRect.largura - bloco.largura
        : safeRect.x;

  // --- Tempo: a coreografia inteira cabe DENTRO da duracao declarada --------
  // A entrada escalonada (um item depois do outro) so tem direito ao orcamento
  // que sobra depois de reservar a saida; se nao houver orcamento, o passo cai
  // a zero e todos entram juntos. O ultimo item chega a opacidade 1 em
  //   passo*(n-1) + entrada <= duracao - saida
  // ou seja: nenhum item ainda esta entrando quando o no comeca a sair.
  const entrada = Math.max(1, msToFrames(transitionDuration.snap, fps));
  const saida = Math.max(1, msToFrames(transitionDuration.instant, fps));
  const passoBase = Math.max(1, msToFrames(transitionDuration.instant, fps));
  const orcamento = Math.max(0, duracao - saida - entrada);
  const passo =
    itens.length <= 1
      ? 0
      : Math.max(0, Math.min(passoBase, Math.floor(orcamento / (itens.length - 1))));

  const opacidadeDoNo = arredondar3(
    interpolate(frame, [duracao - saida, duracao], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const caixas: CaixaDeItem[] = itens.map((texto, indice) => {
    const coluna = Math.floor(indice / linhas);
    const linha = indice % linhas;
    const inicio = indice * passo;
    return {
      indice,
      texto,
      marcador: marcadores[indice] ?? MARCADOR_BULLET,
      coluna,
      linha,
      x: bloco.x + coluna * (larguraDaCelula + gapColuna),
      y: bloco.y + linha * (alturaDeLinha + gapLinha),
      largura: larguraDaCelula,
      altura: alturaDeLinha,
      larguraMedida: Math.ceil(measureTextWidth(prefixo + texto, fonte)),
      opacidade: arredondar3(
        interpolate(frame, [inicio, inicio + entrada], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      ),
    };
  });

  return {
    noId: lista.id,
    visivel: frame >= 0 && frame < duracao,
    frame,
    duracaoFrames: duracao,
    itens: itens.length,
    colunas,
    linhas,
    fonte,
    pisoDeFonte,
    fonteBase,
    alturaDeLinha,
    larguraMarcador,
    opacidadeDoNo,
    alinhamento,
    safeRect,
    bloco,
    caixas,
  };
}

// ---------------------------------------------------------------------------
// O componente
// ---------------------------------------------------------------------------

const Lista: NoComponent = ({ no, frame, fps, width, height }) => {
  const lista = no as NoLista;
  const plano = planejarLista(lista, frame, fps, width, height);

  // Fora da propria janela nao se desenha nada. O envelope da raiz ja janela,
  // mas o no tambem se recusa — quem desenha fora da duracao declarada nao
  // aparece como erro, aparece como fantasma no video de outro no.
  if (!plano.visivel) return null;

  const alturaEmPx = `${String(plano.alturaDeLinha)}px`;

  return (
    <div
      data-no={lista.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      data-colunas={String(plano.colunas)}
      data-linhas={String(plano.linhas)}
      data-fonte={String(plano.fonte)}
      data-itens={String(plano.caixas.length)}
      style={{
        position: "absolute",
        inset: 0,
        opacity: plano.opacidadeDoNo,
        fontFamily: fontFamily.sans,
      }}
    >
      <ul
        data-bloco="lista"
        style={{
          position: "absolute",
          left: plano.bloco.x,
          top: plano.bloco.y,
          width: plano.bloco.largura,
          height: plano.bloco.altura,
          margin: 0,
          padding: 0,
          listStyleType: "none",
        }}
      >
        {plano.caixas.map((caixa) => (
          <li
            key={caixa.indice}
            data-item={String(caixa.indice)}
            data-coluna={String(caixa.coluna)}
            data-linha={String(caixa.linha)}
            style={{
              position: "absolute",
              left: caixa.x - plano.bloco.x,
              top: caixa.y - plano.bloco.y,
              width: caixa.largura,
              height: caixa.altura,
              display: "flex",
              alignItems: "center",
              opacity: caixa.opacidade,
              // NUNCA `hidden`: cortar texto em silencio e exatamente o que
              // este card existe para impedir. O que nao cabe ja parou o build.
              overflow: "visible",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: plano.larguraMarcador,
                color: corDeTexto.secondary,
                fontSize: plano.fonte,
                fontWeight: fontWeight.medium,
                lineHeight: alturaEmPx,
              }}
            >
              {caixa.marcador}
            </span>
            <span
              style={{
                flexGrow: 1,
                color: corDeTexto.primary,
                fontSize: plano.fonte,
                fontWeight: fontWeight.regular,
                lineHeight: alturaEmPx,
                textAlign: textAlignDe(plano.alinhamento),
                whiteSpace: "nowrap",
                overflow: "visible",
              }}
            >
              {caixa.texto}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Lista;
