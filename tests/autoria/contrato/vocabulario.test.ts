/**
 * tests/autoria/contrato/vocabulario.test.ts
 *
 * O vocabulario fechado de transicao do contrato de autoria v1.
 *
 * A skill llm-authoring: o vocabulario fechado que o modelo pode escolher
 * (o presentation de uma transicao) tem de ser gerado do exports do pacote
 * INSTALADO, nunca copiado da doc — o contraexemplo e literal: `cube()`
 * tem pagina na doc e NAO existe no pacote (pacote separado e pago).
 *
 * Pergunta da onda (contrato-w5 §10): assercao de PRESENCA do SEU item,
 * nunca lista completa do mundo. Aqui: cada valor do vocabulario do
 * contrato existe no exports do pacote instalado; `cube` NAO esta no
 * vocabulario do contrato.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VOCABULARIO_TRANSICAO,
  CAMINHO_SCHEMA_COMPLETO,
} from "../../../src/autoria/contrato/contrato.js";

const RAIZ = join(__dirname, "..", "..", "..");
const EXPORTS_TRANSITIONS = join(
  RAIZ,
  "node_modules",
  "@remotion",
  "transitions",
  "package.json",
);

interface ExportsTransitions {
  exports: Record<string, unknown>;
}

function exportsInstalados(): Set<string> {
  const pkg = JSON.parse(readFileSync(EXPORTS_TRANSITIONS, "utf-8")) as ExportsTransitions;
  const nomes = new Set<string>();
  for (const chave of Object.keys(pkg.exports)) {
    nomes.add(chave.replace(/^\.\//, ""));
  }
  return nomes;
}

describe("vocabulario de transicao v1", () => {
  it("cada valor do vocabulario existe no exports do pacote instalado (presenca)", () => {
    const instalados = exportsInstalados();
    for (const valor of VOCABULARIO_TRANSICAO) {
      expect(
        instalados.has(valor),
        `'${valor}' nao existe no exports de @remotion/transitions instalado`,
      ).toBe(true);
    }
  });

  it("`cube` NAO esta no vocabulario (pagina na doc, ausente do pacote)", () => {
    expect(VOCABULARIO_TRANSICAO).not.toContain("cube");
  });

  it("o enum do schema completo e exatamente o vocabulario do contrato", () => {
    const schema = JSON.parse(readFileSync(CAMINHO_SCHEMA_COMPLETO, "utf-8")) as {
      $defs: { Transicao: { properties: { tipo: { enum: string[] } } } };
    };
    const enumSchema = schema.$defs.Transicao.properties.tipo.enum;
    expect([...enumSchema].sort()).toEqual([...VOCABULARIO_TRANSICAO].sort());
  });
});
