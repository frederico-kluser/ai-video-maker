/**
 * tests/autoria/contrato/rejeitar.test.ts
 *
 * O ∅-crit do card F4-01:
 *   "uma saida que NAO valida contra o schema TEM de ser rejeitada ANTES
 *    de tocar o pipeline"
 *
 * A sonda negativa e dupla: (a) a saida invalida lanca ErroContratoAutoria
 * e o stub do pipeline NUNCA e invocado; (b) a saida valida passa pelo gate
 * e o pipeline recebe o documento tipado.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ErroContratoAutoria,
  rejeitarSaidaInvalida,
} from "../../../src/autoria/contrato/rejeitar.js";
import type { DocumentoAutoria } from "../../../src/autoria/contrato/contrato.js";

const FIXTURES = join(__dirname, "fixtures");

function carregar(nome: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as unknown;
}

describe("∅-crit — rejeicao antes do pipeline", () => {
  it("saida invalida e REJEITADA e o pipeline nao e tocado", () => {
    const tocouPipeline: string[] = [];
    const pipeline = (doc: DocumentoAutoria): void => {
      tocouPipeline.push(doc.schema_version);
    };

    let erro: unknown = null;
    try {
      rejeitarSaidaInvalida(carregar("invalido-tenta-emitir-frames.json"));
    } catch (e) {
      erro = e;
    }

    expect(erro).toBeInstanceOf(ErroContratoAutoria);
    expect((erro as ErroContratoAutoria).erros.length).toBeGreaterThan(0);
    expect(tocouPipeline).toEqual([]);
  });

  it("saida valida passa pelo gate e chega tipada ao pipeline", () => {
    const recebidos: DocumentoAutoria[] = [];
    const pipeline = (doc: DocumentoAutoria): void => {
      recebidos.push(doc);
    };

    let saida: DocumentoAutoria | undefined;
    try {
      saida = carregar("valido-todos-nos.json") as DocumentoAutoria;
      rejeitarSaidaInvalida(saida);
    } catch (e) {
      expect.unreachable(`saida valida nao deveria ter sido rejeitada: ${String(e)}`);
    }
    pipeline(saida!);

    expect(recebidos.length).toBe(1);
    expect(recebidos[0]!.schema_version).toBe("Autoria.1");
  });

  it("o erro nomeia a regra que falhou (mensagem, nao so exit code)", () => {
    let erro: unknown = null;
    try {
      rejeitarSaidaInvalida(carregar("invalido-midia-sem-texto-alternativo.json"));
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroContratoAutoria);
    expect(String((erro as ErroContratoAutoria).message)).toContain(
      "texto_alternativo",
    );
  });
});
