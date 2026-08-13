// =============================================================================
// THUMBNAIL — legibilidade no tamanho em que o texto aparece de fato
// (card F5-05, W7)
// =============================================================================
// Pergunta adversarial (1) do card: "O texto do thumbnail e legivel no
// tamanho em que ele aparece de fato (tamanho pequeno — 16:9)".
//
// A resposta nao e opiniao, e conta: o titulo do thumbnail e o do
// cabecalho do manifesto, pintado pelo MESMO pintor no tamanho do frame
// (typeScale.display — 5% da altura, um TOKEN), e a escala de saida do
// thumbnail diz em quantos pixels ele aparece. O piso de legibilidade e o
// texto grande do WCAG (18pt = 24px):
//
//   https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
//   ("Large-scale text is at least 18 point or 14 point bold")
//   https://www.w3.org/TR/WCAG22/#dfn-large-scale-text (2026-08-13)
//
// O numero e NORMATIVO e citado — nao e um token de design (S-5, dono
// unico) e a decisao de o promover a token fica no ledger (AB-735).
//
// A conta roda sobre o manifesto real: altura do frame do manifesto x
// typeScale.display x escala de saida. Se o titulo cair abaixo do piso no
// tamanho de saida, o thumbnail NAO pode ser entregue — melhor falhar
// dizendo por que do que entregar titulo ilegivel em silencio.
// =============================================================================

import type { Manifesto } from "../../contratos/manifesto";
import { typeScale } from "../../design/tokens";
import type { EscalaDoThumbnail } from "./contrato";

/**
 * Piso de legibilidade do titulo no thumbnail, em px de saida: texto
 * grande do WCAG (18pt = 24px).
 * Fonte: https://www.w3.org/TR/WCAG22/#dfn-large-scale-text (2026-08-13)
 * Normativo, nao token de design — ver ledger AB-735.
 */
export const PISO_DE_LEGIBILIDADE_PX = 24;

/**
 * Altura do titulo do thumbnail JA NO TAMANHO DE SAIDA, em px.
 * O titulo e o do primeiro no `cabecalho` do manifesto, pintado pelo pintor
 * promovido no tamanho do frame (typeScale.display e a fracao da ALTURA do
 * frame); a escala de saida e a do thumbnail. Nenhum numero aqui e digitado:
 * tudo deriva de tokens e do manifesto.
 */
export function alturaDoTituloNoThumbnail(
  manifesto: Manifesto,
  escala: EscalaDoThumbnail,
): number {
  const noTamanhoDoFrame = Math.round(manifesto.height * typeScale.display);
  return Math.round(noTamanhoDoFrame * escala);
}

/**
 * Confere a legibilidade do titulo no tamanho de saida.
 * Devolve a falha, ou null quando o titulo esta acima do piso.
 * A regra e de PRESENCA: o que importa e que o titulo do SEU manifesto
 * caiba legivel — nunca uma lista fechada de tamanhos.
 */
export function conferirLegibilidadeDoTitulo(
  manifesto: Manifesto,
  escala: EscalaDoThumbnail,
): string | null {
  const altura = alturaDoTituloNoThumbnail(manifesto, escala);
  if (altura < PISO_DE_LEGIBILIDADE_PX) {
    return (
      `titulo do thumbnail a ${String(altura)}px no tamanho de saida ` +
      `(piso ${String(PISO_DE_LEGIBILIDADE_PX)}px, WCAG large) — ` +
      `o texto seria ilegivel no tamanho em que aparece de fato`
    );
  }
  return null;
}
