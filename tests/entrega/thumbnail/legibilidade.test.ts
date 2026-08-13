// =============================================================================
// THUMBNAIL — legibilidade no tamanho de saida (card F5-05, W7)
// =============================================================================
// Pergunta adversarial (1) do card: "O texto do thumbnail e legivel no
// tamanho em que ele aparece de fato (tamanho pequeno — 16:9 e vertical)?"
//
// A resposta e uma conta sobre o MESMO manifesto e os MESMOS tokens que o
// render usa: o titulo do thumbnail e o cabecalho pintado pelo pintor
// promovido, no tamanho typeScale.display do frame (5% da altura), na
// escala de saida do thumbnail. O piso e o texto grande do WCAG (18pt =
// 24px). O que se asserta: PRESENCA do titulo legivel — nunca uma lista
// fechada de tamanhos.
//
// O caso vertical (9:16) e das variantes (F5-04, W7) — este modulo decide
// a legibilidade da proporcao do manifesto; o consumo vertical fica com o
// F5-07 (W9), ver ledger AB-736.
// =============================================================================

import { describe, expect, it } from "vitest";

import { typeScale } from "../../../src/design/tokens";
import {
  PISO_DE_LEGIBILIDADE_PX,
  alturaDoTituloNoThumbnail,
  conferirLegibilidadeDoTitulo,
  ESCALA_DO_THUMBNAIL,
} from "../../../src/entrega/thumbnail";
import { FIXTURA_INTEGRADA } from "../../integracao/composicao/fiar";

describe("alturaDoTituloNoThumbnail", () => {
  it("deriva do token typeScale.display e do manifesto, nada digitado", () => {
    const manifesto = FIXTURA_INTEGRADA.manifesto;
    const noTamanhoDoFrame = Math.round(manifesto.height * typeScale.display);
    const esperado = Math.round(noTamanhoDoFrame * ESCALA_DO_THUMBNAIL);
    expect(alturaDoTituloNoThumbnail(manifesto, ESCALA_DO_THUMBNAIL)).toBe(esperado);
    // Presenca: a conta produziu um numero positivo — nao um boia vazia.
    expect(esperado).toBeGreaterThan(0);
  });

  it("na escala de saida o titulo da fixture canonica esta acima do piso WCAG large", () => {
    const manifesto = FIXTURA_INTEGRADA.manifesto;
    const altura = alturaDoTituloNoThumbnail(manifesto, ESCALA_DO_THUMBNAIL);
    expect(altura).toBeGreaterThanOrEqual(PISO_DE_LEGIBILIDADE_PX);
    expect(conferirLegibilidadeDoTitulo(manifesto, ESCALA_DO_THUMBNAIL)).toBeNull();
  });

  it("uma escala pequena demais cai abaixo do piso e a conferencia falha", () => {
    const manifesto = FIXTURA_INTEGRADA.manifesto;
    const escalaPequena = 1 / 3; // 54px -> 18px no thumbnail
    const falha = conferirLegibilidadeDoTitulo(manifesto, escalaPequena);
    expect(falha).not.toBeNull();
    expect(falha).toContain("ilegivel");
  });

  it("e deterministico: mesma entrada, mesma altura", () => {
    const manifesto = FIXTURA_INTEGRADA.manifesto;
    expect(alturaDoTituloNoThumbnail(manifesto, ESCALA_DO_THUMBNAIL)).toBe(
      alturaDoTituloNoThumbnail(manifesto, ESCALA_DO_THUMBNAIL),
    );
  });
});
