// =============================================================================
// THUMBNAIL — contraste MEDIDO no pixel, nunca so declarado (card F5-05, W7)
// =============================================================================
// Pergunta adversarial (3) do card: "O contraste e medido (WCAG) ou so
// declarado?" — a resposta e o proposito deste arquivo.
//
// A declaracao vive nos tokens (src/design/tokens.ts, S-5): cada par
// (fg, bg) carrega a razao medida e o minimo normativo (AA normal 4.5:1,
// AA large 3:1 — tests/design/contrast.test.ts). Mas "declarado" nao prova
// nada sobre a TELA: e possivel um token certo e um pixel errado, em
// silencio. Este modulo mede o que o pintor promovido DE FATO pintou:
//
//   medirContrasteDoThumbnail(largura, altura, rgba) — decodifica a regiao
//   graphics safe (o retangulo dos tokens onde o texto vive), acha o fundo
//   (cor dominante) e as tintas (as cores distintas mais frequentes, o que
//   descarta o ruido de anti-aliasing das bordas dos glifos) e calcula a
//   razao WCAG de cada tinta contra o fundo — com a MESMA formula dos
//   tokens (contrastRatio importada, nunca redeclarada).
//
//   conferirContraste(medida) — aplica os minimos: o par declarado nos
//   tokens manda na tinta que o casa (AA normal 4.5 quando o par declara
//   passar AA normal); tinta sem par declarado cai no piso AA large 3:1.
//   O ∅-crit do card — thumbnail com contraste abaixo do minimo tem de
//   falhar — e exatamente esta funcao devolvendo a falha, exercitada em
//   tests/entrega/thumbnail/contraste.test.ts com tinta de baixo contraste
//   DE VERDADE (gray 600 sobre o fundo do video, razao 2.68:1 < 3:1).
//
// Minimios normativos (WCAG 2.2, contraste minimo):
//   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
//   https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio (2026-08-13)
// =============================================================================

import {
  contrastPairs,
  contrastRatio,
  safeArea16x9,
} from "../../design/tokens";
import type { FalhaDeContraste, MedidaDeContraste, TintaMedida } from "./contrato";

/** AA normal — 4.5:1 (texto normal, WCAG 2.2). */
export const MINIMO_AA_NORMAL = 4.5;

/** AA large — 3:1 (texto grande; o piso que o gate de tokens exige de TODO par). */
export const MINIMO_AA_LARGE = 3.0;

/**
 * Quantas tintas (cores distintas apos o fundo) a medicao considera, das
 * mais frequentes para baixo. 8 cobre as tintas reais do frame pintado
 * (titulo, subtitulo, regua de destaque) e deixa de fora o ruido de
 * anti-aliasing: as misturas de borda dos glifos sao MUITAS e cada uma
 * com poucos pixels — uma cor de borda nao chega ao topo.
 */
export const TINTAS_TOP = 8;

/**
 * Piso de contagem de uma tinta NAO DECLARADA, em pixels do quadro medido:
 * abaixo dele a cor e ruido de anti-aliasing, nao tinta. As bordas dos
 * glifos misturam o texto com o fundo em dezenas de niveis, cada um com
 * poucos pixels (uma aresta vertical de 36px contribui ~36px por nivel);
 * medir uma mistura de borda como tinta acusaria um thumbnail SAUDAVEL de
 * baixo contraste (falso vermelho).
 *
 * Calibrado contra o render REAL deste card (1280x720, frame 45 da fixture
 * canonica): o maior nivel de mistura de borda medido foi 172px; 200 fica
 * acima com folga. Cor DECLARADA nos tokens (fg de um par registrado) e
 * sempre medida, mesmo abaixo do piso — o subtitulo de 18px da fixture tem
 * so ~106px solidos no thumbnail e continua na conta, porque e texto, nao
 * ruido.
 */
export const PISO_DE_TINTA = 200;

/**
 * Mede o contraste da regiao onde o texto do thumbnail vive.
 *
 * Regiao: o retangulo graphics safe dos tokens (safeArea16x9.graphicsSafePct
 * — a fracao da borda que o texto nunca encosta, EBU R 95), com margem POR
 * EIXO: horizontal sobre a largura, vertical sobre a altura — a mesma
 * aritmetica do padding do no cabecalho (o texto fica sempre dentro) e a
 * mesma dos retangulos seguros das camadas (a vinheta e a grade nunca
 * entram na margem). Fora da regiao ficam vinheta e grade, que escurecem
 * a borda de proposito e nao participam da conta.
 *
 * Fundo: a cor dominante da regiao. Tintas: as cores distintas depois do
 * fundo que sao DECLARADAS nos tokens (fg de um par registrado sobre este
 * fundo — sempre medidas, e o texto pequeno ainda e texto) ou tem
 * contagem acima do piso de ruido (PISO_DE_TINTA — tinta nao declarada
 * com area de verdade), as mais frequentes (TINTAS_TOP). Cada tinta
 * carrega a razao WCAG contra o fundo e o minimo que a regra vai exigir.
 *
 * Regiao fora do quadro e recusada — medir fora da tela esconderia o
 * retangulo que a medicao existe para pegar (mesma disciplina do oraculo
 * de regiao de tests/integracao/composicao/png.ts).
 */
export function medirContrasteDoThumbnail(
  largura: number,
  altura: number,
  rgba: Uint8Array,
): MedidaDeContraste {
  if (rgba.length !== largura * altura * 4) {
    throw new Error(
      `medirContraste: ${String(rgba.length)} bytes para ` +
        `${String(largura)}x${String(altura)}x4`,
    );
  }

  const margemHorizontal = Math.round(largura * safeArea16x9.graphicsSafePct);
  const margemVertical = Math.round(altura * safeArea16x9.graphicsSafePct);
  const regiao = {
    x: margemHorizontal,
    y: margemVertical,
    largura: largura - 2 * margemHorizontal,
    altura: altura - 2 * margemVertical,
  };
  if (regiao.largura <= 0 || regiao.altura <= 0) {
    throw new Error(
      `medirContraste: regiao vazia em ${String(largura)}x${String(altura)} ` +
        `(margens graphics safe de ${String(margemHorizontal)}x${String(margemVertical)}px)`,
    );
  }

  const contagens = new Map<string, number>();
  for (let py = regiao.y; py < regiao.y + regiao.altura; py++) {
    for (let px = regiao.x; px < regiao.x + regiao.largura; px++) {
      const i = (py * largura + px) * 4;
      const cor = `#${[
        rgba[i]!.toString(16).padStart(2, "0"),
        rgba[i + 1]!.toString(16).padStart(2, "0"),
        rgba[i + 2]!.toString(16).padStart(2, "0"),
      ].join("")}`;
      contagens.set(cor, (contagens.get(cor) ?? 0) + 1);
    }
  }

  const ordenadas = [...contagens.entries()].sort((a, b) => b[1] - a[1]);
  const fundo = ordenadas[0]?.[0] ?? "";
  const pixelsDeFundo = ordenadas[0]?.[1] ?? 0;

  // Declarada: fg de um par registrado nos tokens sobre este fundo — e
  // texto (ou destaque) de verdade, e o par declarado manda nela.
  const declaradas = new Set(
    contrastPairs
      .filter((par) => par.bg.toLowerCase() === fundo)
      .map((par) => par.fg.toLowerCase()),
  );

  const tintas: TintaMedida[] = ordenadas
    .slice(1)
    .filter(
      ([cor, contagem]) => declaradas.has(cor) || contagem >= PISO_DE_TINTA,
    )
    .slice(0, TINTAS_TOP)
    .map(([cor, contagem]) => {
      const razao = contrastRatio(cor, fundo);
      const minimo = minimoDaTinta(cor, fundo);
      return {
        cor,
        contagem,
        razao,
        minimo,
        origemDoMinimo: minimo > MINIMO_AA_LARGE ? "par-declarado" : "piso-aa-large",
      } satisfies TintaMedida;
    });

  return {
    largura,
    altura,
    regiao,
    fundo,
    pixelsDeFundo,
    tintas,
    pisoAaLarge: MINIMO_AA_LARGE,
  };
}

/**
 * O minimo de uma tinta: o do par DECLARADO nos tokens quando a tinta e o
 * fundo casam um par registrado (a declaracao vira obrigacao na tela); nao
 * casou nenhum par, o piso AA large. O maior minimo vence entre pares
 * coincidentes.
 */
export function minimoDaTinta(cor: string, fundo: string): number {
  let minimo = MINIMO_AA_LARGE;
  for (const par of contrastPairs) {
    if (par.fg.toLowerCase() !== cor.toLowerCase()) continue;
    if (par.bg.toLowerCase() !== fundo.toLowerCase()) continue;
    const exigido = par.passesAANormal ? MINIMO_AA_NORMAL : MINIMO_AA_LARGE;
    if (exigido > minimo) minimo = exigido;
  }
  return minimo;
}

/**
 * Confere uma medicao contra os minimos. Devolve TODAS as falhas — tinta
 * abaixo do minimo e falha nomeando a cor, a razao medida e a regra.
 * Lista vazia = aprovado.
 *
 * O ∅-crit do card e esta funcao: um thumbnail cujo pixel tem contraste
 * abaixo do minimo TEM de cair aqui. Quem a chama (o gate e a suite) tem
 * de exigir lista vazia — e a suite prova o vermelho com tinta de baixo
 * contraste de verdade (tests/entrega/thumbnail/contraste.test.ts).
 */
export function conferirContraste(
  medida: MedidaDeContraste,
): FalhaDeContraste[] {
  const falhas: FalhaDeContraste[] = [];
  for (const tinta of medida.tintas) {
    if (tinta.razao < tinta.minimo) {
      falhas.push({
        regiao: `regiao graphics safe (${String(medida.regiao.largura)}x` +
          `${String(medida.regiao.altura)})`,
        motivo:
          `tinta ${tinta.cor} (${String(tinta.contagem)}px) sobre ` +
          `${medida.fundo}: razao ${tinta.razao.toFixed(2)}:1 abaixo do ` +
          `minimo ${tinta.minimo.toFixed(1)}:1 ` +
          `(${tinta.origemDoMinimo === "par-declarado" ? "par declarado em tokens.ts" : "piso AA large"})`,
      });
    }
  }
  return falhas;
}
