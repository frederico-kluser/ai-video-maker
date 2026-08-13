// =============================================================================
// THUMBNAIL — contrato publico do modulo (card F5-05, W7)
// =============================================================================
// O thumbnail e gerado do MESMO manifesto que o video: o unico caminho para
// pixel e o pintor promovido (src/composicao/pintura, AB-493) — nada aqui
// re-digita texto, cor ou geometria. O que este modulo decide, em funcao
// pura:
//
//   1. QUAL frame do manifesto vira thumbnail (escolherFrameDoThumbnail —
//      o meio da janela do PRIMEIRO no `cabecalho`: e o titulo do video no
//      momento de maxima visibilidade, com a mola ja acomodada);
//   2. EM QUE TAMANHO o frame e entregue (planoDoThumbnail — a escala de
//      saida; o texto do thumbnail tem de ser legivel NO TAMANHO EM QUE
//      ELE APARECE, ver legibilidade.ts);
//   3. SE O CONTRASTE DOS PIXELS PINTADOS E NORMATIVO (medirContraste +
//      conferirContraste — WCAG, medido no pixel, nunca so declarado).
//
// Regra de ouro (contrato-w7 §6, F5-05): o ∅-crit do PROGRAMA — thumbnail
// com contraste abaixo do minimo tem de falhar — e medido no PIXEL
// renderizado, e o minimo de cada par vem dos MESMOS tokens que o gate de
// design ja verifica (tests/design/contrast.test.ts): a declaracao e
// conferida contra a tela, e a tela e conferida contra a declaracao.
// =============================================================================

import type { Manifesto } from "../../contratos/manifesto";

/** O frame absoluto da composicao que vira thumbnail. */
export type FrameDoThumbnail = number;

/** A escala de saida do thumbnail: fracao das dimensoes do manifesto. */
export type EscalaDoThumbnail = number;

/**
 * O plano do thumbnail: tudo que o gate precisa para renderizar, derivado
 * do MESMO manifesto — nunca digitado a parte.
 */
export interface PlanoDoThumbnail {
  /** Frame absoluto escolhido (escolherFrameDoThumbnail). */
  frame: FrameDoThumbnail;
  /** Escala de saida: dimensoes do thumbnail / dimensoes do manifesto. */
  escala: EscalaDoThumbnail;
  /** Largura do thumbnail em pixels (round(manifesto.width * escala)). */
  largura: number;
  /** Altura do thumbnail em pixels (round(manifesto.height * escala)). */
  altura: number;
  /** O titulo do manifesto que o thumbnail mostra (primeiro cabecalho). */
  titulo: string;
  /** Altura do titulo JA NO TAMANHO do thumbnail, em px. */
  alturaDoTitulo: number;
}

/** Uma cor medida no pixel do thumbnail, com a razao contra o fundo. */
export interface TintaMedida {
  /** Cor em #rrggbb, como veio do pixel. */
  cor: string;
  /** Quantos pixels da regiao tem exatamente esta cor. */
  contagem: number;
  /** Razao WCAG medida contra a cor dominante da regiao (fundo). */
  razao: number;
  /** O minimo exigido para esta cor: o do par declarado nos tokens, ou o piso. */
  minimo: number;
  /** Fonte do minimo: o par declarado em tokens.ts, ou o piso generico. */
  origemDoMinimo: "par-declarado" | "piso-aa-large";
}

/** O resultado da medicao de contraste de um thumbnail decodificado. */
export interface MedidaDeContraste {
  /** Largura do quadro medido. */
  largura: number;
  /** Altura do quadro medido. */
  altura: number;
  /** Regiao medida (graphics safe, onde o texto vive). */
  regiao: { x: number; y: number; largura: number; altura: number };
  /** Cor dominante da regiao — o fundo contra o qual o texto e lido. */
  fundo: string;
  /** Quantos pixels da regiao tem a cor do fundo. */
  pixelsDeFundo: number;
  /** As tintas medidas na regiao (toda cor distinta acima do piso de ruido). */
  tintas: TintaMedida[];
  /** O piso generico: AA large, 3.0:1 (mesmo piso do gate de tokens). */
  pisoAaLarge: number;
}

/** Uma falha de contraste — o que o gate imprime e pelo que falha. */
export interface FalhaDeContraste {
  regiao: string;
  motivo: string;
}

/** Um manifesto sem nenhum no `cabecalho` nao tem o que virar thumbnail. */
export class ThumbnailSemTitulo extends Error {
  constructor() {
    super(
      "thumbnail: o manifesto nao tem nenhum no do tipo `cabecalho` — " +
        "sem titulo nao existe thumbnail (a recusa e por ausencia, nunca " +
        "um quadro vazio)",
    );
    this.name = "ThumbnailSemTitulo";
  }
}
