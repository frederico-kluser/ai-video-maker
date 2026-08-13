// =============================================================================
// registro.test.ts — descoberta por convencao x espelho estatico
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// AGENTS.md Regra 6: descoberta por convencao, nunca registro central.
// A convencao das camadas: src/composicao/camadas/<nome>.tsx exporta meta,
// plano e default. O caminho de render usa o espelho estatico (registro.ts) —
// que nao toca disco — e este teste amarra as duas pontas:
//
//   todo <nome>.tsx encontrado no disco TEM de estar no registro, com meta
//   identico. Um arquivo que nao chega ao registro sumiria do video sem erro.
//
// REGRA DA ONDA (docs/contrato-w4.md §5): nada de assercao sobre a LISTA
// COMPLETA de camadas. Nenhum teste abaixo enumera o catalogo inteiro nem
// conta arquivos — apenas a PRESENCA das camadas deste card e a propriedade
// estrutural "todo arquivo em disco tem registro".
// =============================================================================

import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CAMADA_POR_NOME,
  CAMADAS,
  camadaChamada,
  nomesRegistrados,
} from "src/composicao/camadas/registro";
import { zIndex } from "src/design/tokens";
import { PAPEIS_DE_CAMADA, Z_INDEX_POR_PAPEL, validarModuloDeCamada } from "src/composicao/camadas/contrato-de-camada";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR_CAMADAS = resolve(AQUI, "../../../src/composicao/camadas");

/** Arquivos <nome>.tsx do diretorio de camadas, em ordem estavel. */
function modulosNoDisco(): string[] {
  return readdirSync(DIR_CAMADAS)
    .filter((e) => e.endsWith(".tsx") && !e.startsWith("_"))
    .sort();
}

describe("registro x disco (espelho estatico)", () => {
  it("o diretorio existe e tem arquivos — seletor vazio seria falso verde (C2)", () => {
    expect(modulosNoDisco().length).toBeGreaterThan(0);
  });

  it("todo <nome>.tsx do disco esta registrado — arquivo sem registro some do video em silencio", () => {
    for (const arquivo of modulosNoDisco()) {
      const nome = arquivo.replace(/\.tsx$/, "");
      const modulo = CAMADA_POR_NOME.get(nome);
      expect(
        modulo,
        `${arquivo} existe no disco mas nao esta em registro.ts — sumiria do video sem erro`,
      ).toBeDefined();
    }
  });

  it("o registro nao tem entrada sem arquivo em disco (espelho nao inventa)", () => {
    for (const nome of nomesRegistrados()) {
      expect(modulosNoDisco()).toContain(`${nome}.tsx`);
    }
  });

  it("todo modulo registrado passa na validacao do contrato", () => {
    for (const modulo of CAMADAS) {
      const r = validarModuloDeCamada(
        { meta: modulo.meta, default: modulo.componente, plano: modulo.plano },
        modulo.meta.nome,
        `registro/${modulo.meta.nome}`,
      );
      expect(r.erros, `${modulo.meta.nome} viola o contrato`).toStrictEqual([]);
    }
  });

  it("os ids sao unicos entre as camadas registradas", () => {
    const ids = CAMADAS.map((c) => c.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada camada registrada tem meta valida (nome, id, papel, descricao)", () => {
    for (const modulo of CAMADAS) {
      expect(modulo.meta.nome.length).toBeGreaterThan(0);
      expect(modulo.meta.id.length).toBeGreaterThan(0);
      expect(modulo.meta.descricao.length).toBeGreaterThan(0);
      expect(PAPEIS_DE_CAMADA).toContain(modulo.meta.papel);
    }
  });
});

describe("presenca das camadas deste card (regra da onda: presenca, nunca lista completa)", () => {
  it("fundo, grade e vinheta estao registrados e respondem por nome", () => {
    for (const nome of ["fundo", "grade", "vinheta"]) {
      expect(CAMADA_POR_NOME.has(nome), `camada ${nome} ausente do registro`).toBe(true);
      expect(camadaChamada(nome).meta.nome).toBe(nome);
    }
  });

  it("nome desconhecido estoura — ausencia nunca e silencio", () => {
    expect(() => camadaChamada("nao-existe")).toThrow(/nao esta registrada/);
  });

  it("z-index dos papeis vem dos tokens e o conteudo fica entre fundo e overlay", () => {
    expect(Z_INDEX_POR_PAPEL.fundo).toBe(zIndex.background);
    expect(Z_INDEX_POR_PAPEL.sobreposicao).toBe(zIndex.overlay);
    expect(zIndex.background).toBeLessThan(zIndex.content);
    expect(zIndex.content).toBeLessThan(zIndex.overlay);
  });
});
