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

// ---------------------------------------------------------------------------
// TEXTO VISIVEL NO QUADRO (fix da Onda 3) — o oraculo de PIXEL do texto
// ---------------------------------------------------------------------------
// O revisor refutou a Onda 3 medindo o frame 580 real da c-005: o bloco de
// texto n-014 (bbox declarado "1306,87,517,176", visibilidade 1) mostrava
// o VIDEO dvorak — zero pixels do texto — e a regiao da legenda do video
// n-006 ("851,438,218,78") estava chapada de branco do globo do gif
// (98.7%). A sonda C1/C2 so lia data-bbox DECLARADOS e deixou o
// falso-verde passar. Este oraculo e o metodo do revisor, permanente:
// no render REAL, a regiao de cada bloco declarado visivel tem de mostrar
// o FUNDO do bloco (preto) e a TINTA do texto (as cores dos tokens de
// texto, nunca "qualquer pixel claro" — o texto n-014 e cinza #9CA3AF nos
// primeiros frames, as legendas sao brancas #F9FAFB).
//
// Tres criterios, calibrados nos masters (aprovado-bug 580 x corrigido 590):
//   P  fracao de PRETO (r,g,b < 30) >= 0.40 — o fundo opaco do bloco
//      (background.primary) esta la. No bug: n-014 tinha 0.1% de preto
//      (video por cima), a legenda n-006 0.0% (globo por cima); corrigido:
//      80-87%. Este criterio e o que pega a cobertura por midia.
//   T  fracao de TINTA (branco | cinza do pendente | azul do realce
//      ativo) >= 0.01 — os glifos existem (pega "fundo preto sem texto").
//   W  fracao de BRANCO <= 0.65 — uma superficie clara (o globo) cobrindo
//      a regiao deixa a fracao perto de 1 e acende este limite.

/** Um bloco de texto declarado visivel, em coordenadas absolutas do quadro. */
export interface BlocoDeclarado {
  readonly noId: string;
  readonly rotulo: string;
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
}

/** Fracao minima de preto (o fundo do bloco) — calibrada: bug 0.1%/0.0%, fix 80-87%. */
export const LIMIAR_FRACAO_DE_FUNDO_MINIMA = 0.4;

/** Fracao minima de tinta de texto — calibrada: fix 5-8%. */
export const LIMIAR_FRACAO_DE_TINTA_MINIMA = 0.01;

/** Fracao maxima de branco — a cobertura do globo media 98.7%. */
export const LIMIAR_FRACAO_DE_BRANCO_MAXIMA = 0.65;

/** Branco puro: corDeTexto.primary #F9FAFB + antialias. */
export function ehBrancoDeTexto(r: number, g: number, b: number): boolean {
  return r >= 235 && g >= 235 && b >= 235;
}

/** Cinza do pendente: corDeTexto.secondary #9CA3AF + halo. */
export function ehCinzaDeTexto(r: number, g: number, b: number): boolean {
  return r >= 120 && r <= 200 && g >= 130 && g <= 210 && b >= 145 && b <= 225;
}

/** Azul do realce ativo: highlight.primary #3B82F6 + halo. */
export function ehAzulDeTexto(r: number, g: number, b: number): boolean {
  return r >= 30 && r <= 110 && g >= 90 && g <= 160 && b >= 190 && b <= 255;
}

/** Um pixel e tinta de texto quando casa com a paleta de texto do projeto. */
export function ehTintaDeTexto(r: number, g: number, b: number): boolean {
  return ehBrancoDeTexto(r, g, b) || ehCinzaDeTexto(r, g, b) || ehAzulDeTexto(r, g, b);
}

interface FracaoDeRegiao {
  preto: number;
  tinta: number;
  branco: number;
}

function medirFracaoesDoBloco(
  png: PngDecodificado,
  regiao: { x: number; y: number; largura: number; altura: number },
): FracaoDeRegiao {
  const x = Math.round(regiao.x);
  const y = Math.round(regiao.y);
  const largura = Math.round(regiao.largura);
  const altura = Math.round(regiao.altura);
  let preto = 0;
  let tinta = 0;
  let branco = 0;
  for (let py = y; py < y + altura; py++) {
    for (let px = x; px < x + largura; px++) {
      const i = py * png.largura + px;
      const r = png.rgba[i * 4]!;
      const g = png.rgba[i * 4 + 1]!;
      const b = png.rgba[i * 4 + 2]!;
      if (r < 30 && g < 30 && b < 30) preto++;
      if (ehTintaDeTexto(r, g, b)) tinta++;
      if (ehBrancoDeTexto(r, g, b)) branco++;
    }
  }
  const total = largura * altura;
  return {
    preto: preto / total,
    tinta: tinta / total,
    branco: branco / total,
  };
}

/**
 * Exige, no render REAL, que a regiao de cada bloco declarado visivel
 * mostre o fundo do bloco (preto) e a tinta do texto — e que nenhuma
 * superficie clara domine. E o padrao de pixel que o revisor usou para
 * refutar a Onda 3, transformado em oraculo do render de verdade.
 */
export function conferirTintaDeTexto(
  png: PngDecodificado,
  blocos: readonly BlocoDeclarado[],
): FalhaDoOraculo[] {
  const falhas: FalhaDoOraculo[] = [];
  for (const bloco of blocos) {
    const fracao = medirFracaoesDoBloco(png, bloco);
    if (fracao.preto < LIMIAR_FRACAO_DE_FUNDO_MINIMA) {
      falhas.push({
        regiao: bloco.rotulo,
        motivo:
          `bloco "${bloco.noId}" declarado visivel com so ` +
          `${(fracao.preto * 100).toFixed(1)}% de fundo preto — a midia ` +
          `(obstaculo opaco) esta cobrindo o texto (o bug refutado da ` +
          `c-005: n-014 com 0.1% e a legenda n-006 com 0.0% antes do fix)`,
      });
    }
    if (fracao.tinta < LIMIAR_FRACAO_DE_TINTA_MINIMA) {
      falhas.push({
        regiao: bloco.rotulo,
        motivo:
          `bloco "${bloco.noId}" com so ${(fracao.tinta * 100).toFixed(2)}% ` +
          `de tinta de texto — o fundo esta la mas os glifos nao (texto ` +
          `apagado?)`,
      });
    }
    if (fracao.branco > LIMIAR_FRACAO_DE_BRANCO_MAXIMA) {
      falhas.push({
        regiao: bloco.rotulo,
        motivo:
          `bloco "${bloco.noId}" com ${(fracao.branco * 100).toFixed(1)}% de ` +
          `pixels brancos — superficie clara dominando a regiao (o globo ` +
          `branco cobrindo a legenda do video: 98.7% antes do fix)`,
      });
    }
  }
  return falhas;
}
