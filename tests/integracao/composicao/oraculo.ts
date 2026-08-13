// =============================================================================
// ORACULO DE CONTEUDO do quadro composto
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// A W4 deixou enderecado ao join (AB-344): "O join da W5 (F1-12) deve
// renderizar a cena composta e reaplicar a contagem de alfa sobre o quadro
// inteiro". O still do no isolado prova o NO; o quadro composto prova o
// COMPOSITOR. Este arquivo e a reaplicacao.
//
// O que cada regiao mede:
//
//   quadro inteiro           - C1: entropia. Um quadro preto (ou uniforme)
//                              renderiza, sai com exit 0 e e deterministico —
//                              entao a primeira barreira e contar cores.
//   regiao do marcador de
//   midia (interior)         - AB-344: o interior da caixa do marcador e
//                              TRANSPARENTE por contrato (o no nao pinta
//                              fundo). No quadro composto ele tem de mostrar
//                              o fundo da cena em MULTIPLOS TONS (as faixas
//                              da camada de fundo — nenhuma cor domina) E a
//                              tinta do proprio no (o marcador esta la).
//                              Uma regiao chapada (uma ou duas cores) e a
//                              assinatura do "compositor pintou um retangulo
//                              opaco por cima do alfa do no" — o defeito
//                              exato que AB-344 endereca ao join.
//   regiao do grafico        - AB-390/AB-364: a regiao do asset tem de
//                              mostrar as cores do grafico fiado (o asset
//                              decodificou e esta no quadro) e nao pode ser
//                              chapada (o alfa do asset sobreviveu ao
//                              compositor). Um asset que nao decodifica
//                              deixa a regiao so com o fundo; um retangulo
//                              opaco tapa o fundo.
//
// O que este oraculo NAO cobre (documentado no handoff, AB-363): formatos
// de grafico que o no aceita mas que o gate de bytes deste projeto ainda
// nao sabe ler (WebM, SVG, GIF) — "consistente-mas-possivelmente-errado".
// O gate de bytes aqui cobre PNG, que e o formato da fixture integrada.
//
// Os limiares sao constantes nomeadas, nunca digitadas no teste
// (video-characterization: o numero mora numa constante com o valor medido
// ao lado).
// =============================================================================

import type { PngDecodificado } from "./png";
import { medirRegiao, medirQuadro } from "./png";
import { highlight, state } from "../../../src/design/tokens";

// ---------------------------------------------------------------------------
// Cores de referencia — tokens do projeto, nunca literais no teste
// ---------------------------------------------------------------------------

/** A tinta do marcador de midia (rotulo e contorno tracejado). */
export const COR_DO_MARCADOR_DE_MIDIA = highlight.primary;

/** As cinco cores das barras do asset de grafico (gerar-assets.ts). */
export const CORES_DAS_BARRAS_DO_GRAFICO: readonly string[] = [
  highlight.primary,
  state.success,
  state.warning,
  state.error,
  highlight.secondary,
];

/**
 * As cores dos graficos desenhados a partir dos DADOS do manifesto
 * (caminho sem asset): as cores da serie vêm de `dados[].cor` da fixture.
 */
export const CORES_DOS_DADOS_DA_FIXTURE: readonly string[] = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#06B6D4",
];

// ---------------------------------------------------------------------------
// Limiares — valores com o que medem ao lado
// ---------------------------------------------------------------------------

/**
 * Cores distintas minimas no quadro inteiro de um still integrado.
 * Medido: um still com conteudo real (texto sobre base escura, com
 * antialias) tem dezenas de cores; um campo chapado tem 1 ou 2.
 */
export const LIMIAR_CORES_DO_QUADRO = 8;

/**
 * Cores distintas minimas dentro da regiao de um no.
 * A regiao do marcador de midia cruza as faixas do fundo (seis tons) mais a
 * tinta do marcador; a do grafico cruza as faixas mais as cores das barras.
 * Uma regiao chapada (retangulo opaco) tem 1 ou 2.
 */
export const LIMIAR_CORES_DA_REGIAO = 3;

/**
 * Fracao maxima da cor dominante numa regiao com alfa preservado.
 * O interior transparente do marcador de midia mostra as faixas do fundo:
 * nenhuma cor chega perto de dominar (medido: ~0.19 no 1920x1080). Uma
 * regiao coberta por um retangulo opaco tem a fracao dominante perto de 1.
 */
export const LIMIAR_FRACAO_DOMINANTE = 0.95;

// ---------------------------------------------------------------------------
// As assercoes
// ---------------------------------------------------------------------------

export interface FalhaDoOraculo {
  regiao: string;
  motivo: string;
}

/** C1: o quadro inteiro tem conteudo. */
export function conferirEntropiaDoQuadro(png: PngDecodificado): FalhaDoOraculo[] {
  const falhas: FalhaDoOraculo[] = [];
  const medida = medirQuadro(png);

  if (medida.coresDistintas < LIMIAR_CORES_DO_QUADRO) {
    falhas.push({
      regiao: "quadro inteiro",
      motivo:
        `so ${String(medida.coresDistintas)} cores distintas — quadro sem ` +
        `conteudo (C1). Um quadro preto ou uniforme renderiza com exit 0.`,
    });
  }
  return falhas;
}

/** A regiao nao pode ser chapada — o alfa do no sobreviveu ao compositor. */
function conferirNaoChapada(
  regiao: string,
  medida: ReturnType<typeof medirRegiao>,
): FalhaDoOraculo[] {
  const falhas: FalhaDoOraculo[] = [];
  if (medida.coresDistintas < LIMIAR_CORES_DA_REGIAO) {
    falhas.push({
      regiao,
      motivo:
        `regiao com so ${String(medida.coresDistintas)} cores — ou o no nao ` +
        `desenhou, ou o compositor pintou um retangulo opaco por cima do ` +
        `alfa dele (AB-344)`,
    });
  }
  if (medida.fracaoDaCorDominante >= LIMIAR_FRACAO_DOMINANTE) {
    falhas.push({
      regiao,
      motivo:
        `a cor dominante cobre ${(medida.fracaoDaCorDominante * 100).toFixed(1)}% ` +
        `da regiao — regiao chapada, nao composicao sobre alfa`,
    });
  }
  return falhas;
}

/**
 * AB-344: o interior da caixa do marcador de midia, no quadro composto.
 * Tem de ter a tinta do marcador (o no esta la) e nao pode ser chapado
 * (o alfa do no sobreviveu ao compositor).
 */
export function conferirRegiaoDaMidia(
  png: PngDecodificado,
  regiao: { x: number; y: number; largura: number; altura: number },
): FalhaDoOraculo[] {
  const falhas: FalhaDoOraculo[] = [];
  const medida = medirRegiao(png, regiao.x, regiao.y, regiao.largura, regiao.altura);

  if (medida.contar(COR_DO_MARCADOR_DE_MIDIA) === 0) {
    falhas.push({
      regiao: "marcador de midia",
      motivo: `nenhum pixel da tinta do marcador (${COR_DO_MARCADOR_DE_MIDIA}) — o no nao esta la`,
    });
  }
  falhas.push(...conferirNaoChapada("marcador de midia", medida));
  return falhas;
}

/**
 * AB-390/AB-364: a regiao de desenho do grafico, no quadro composto.
 * As barras do asset fiado tem de aparecer (o grafico REAL esta no quadro,
 * nao saiu deterministicamente preto) e a regiao nao pode ser chapada.
 */
export function conferirRegiaoDoGrafico(
  png: PngDecodificado,
  regiao: { x: number; y: number; largura: number; altura: number },
): FalhaDoOraculo[] {
  const falhas: FalhaDoOraculo[] = [];
  const medida = medirRegiao(png, regiao.x, regiao.y, regiao.largura, regiao.altura);

  const coresDasBarrasPresentes = CORES_DAS_BARRAS_DO_GRAFICO.filter(
    (cor) => medida.contar(cor) > 0,
  );
  if (coresDasBarrasPresentes.length < CORES_DAS_BARRAS_DO_GRAFICO.length) {
    falhas.push({
      regiao: "grafico",
      motivo:
        `das ${String(CORES_DAS_BARRAS_DO_GRAFICO.length)} cores das barras ` +
        `do asset, so ${String(coresDasBarrasPresentes.length)} aparecem ` +
        `(${coresDasBarrasPresentes.join(", ") || "nenhuma"}) — o grafico ` +
        `nao esta no quadro (nao decodificou? nao foi fiado?)`,
    });
  }
  falhas.push(...conferirNaoChapada("grafico", medida));
  return falhas;
}

/**
 * A cena c-004 da fixture inteira: graficos desenhados a partir dos DADOS
 * (o caminho sem asset) e asset fiado — pelo menos duas cores da serie da
 * fixture tem de aparecer na regiao (o desenho dos dados esta no quadro).
 */
export function conferirCoresDaSerieNoQuadro(
  png: PngDecodificado,
  regiao: { x: number; y: number; largura: number; altura: number },
): FalhaDoOraculo[] {
  const falhas: FalhaDoOraculo[] = [];
  const medida = medirRegiao(png, regiao.x, regiao.y, regiao.largura, regiao.altura);
  const presentes = CORES_DOS_DADOS_DA_FIXTURE.filter((cor) => medida.contar(cor) > 0);
  if (presentes.length < 2) {
    falhas.push({
      regiao: "graficos c-004",
      motivo:
        `so ${String(presentes.length)} cor(es) da serie dos dados aparecem ` +
        `na regiao dos graficos — o desenho dos dados nao esta no quadro`,
    });
  }
  return falhas;
}
