/**
 * tests/autoria/contrato/ab-432-ab-433.test.ts
 *
 * As duas regras duras do contrato de autoria v1 (docs/contrato-w5.md §3),
 * herdadas do ledger e irredutveis pelo card:
 *   - AB-432: hash de midia e ADVISORY — a ausencia do hash NUNCA reprova.
 *   - AB-433: texto_alternativo e OBRIGATORIO — a ausencia e erro, nao aviso.
 *
 * Note a assimetria proposital: hash presente NAO salva um no sem
 * texto_alternativo; texto_alternativo presente salva um no sem hash.
 */

import { describe, it, expect } from "vitest";
import { validarSaidaAutoria } from "../../../src/autoria/contrato/validar.js";

function documentoComUmNo(no: Record<string, unknown>): unknown {
  return {
    schema_version: "Autoria.1",
    nos: [no],
    cenas: [{ id: "cena-001", nos: [String(no.id)] }],
  };
}

function noMidia(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "n-004",
    schema: "Midia.1",
    type: "midia",
    tipo_midia: "imagem",
    ...extra,
  };
}

describe("AB-432 — hash de midia e ADVISORY, nao exigido", () => {
  it("midia SEM hash e SEM texto_alternativo... e invalida (mas pelo AB-433, nao pelo AB-432)", () => {
    const resultado = validarSaidaAutoria(documentoComUmNo(noMidia({})));
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.some((e) => e.includes("texto_alternativo"))).toBe(true);
  });

  it("midia SEM hash e COM texto_alternativo e VALIDA (AB-432: ausencia nunca reprova)", () => {
    const resultado = validarSaidaAutoria(
      documentoComUmNo(noMidia({ texto_alternativo: "Paisagem dos campos do sul" })),
    );
    expect(resultado.valido, resultado.erros.join("; ")).toBe(true);
  });

  it("midia COM hash e COM texto_alternativo e VALIDA (hash presente e aceito)", () => {
    const resultado = validarSaidaAutoria(
      documentoComUmNo(
        noMidia({ texto_alternativo: "Paisagem dos campos do sul", hash: "d".repeat(64) }),
      ),
    );
    expect(resultado.valido, resultado.erros.join("; ")).toBe(true);
  });
});

describe("AB-433 — texto_alternativo OBRIGATORIO para no de midia", () => {
  it("midia sem texto_alternativo e INVALIDA", () => {
    const resultado = validarSaidaAutoria(documentoComUmNo(noMidia({})));
    expect(resultado.valido).toBe(false);
  });

  it("midia com hash presente nao e salva: texto_alternativo ausente continua INVALIDO", () => {
    const resultado = validarSaidaAutoria(
      documentoComUmNo(noMidia({ hash: "e".repeat(64) })),
    );
    expect(resultado.valido).toBe(false);
  });

  it("texto_alternativo vazio e INVALIDO (nao e descricao)", () => {
    const resultado = validarSaidaAutoria(
      documentoComUmNo(noMidia({ texto_alternativo: "" })),
    );
    expect(resultado.valido).toBe(false);
  });
});
