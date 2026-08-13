/**
 * tests/autoria/reparo/vazio-crit.test.ts
 *
 * O ∅-crit do card F4-03 (PROGRAMA.html):
 *   "um manifesto irreparavel tem de ser REJEITADO, nunca 'melhorado'
 *    ate passar"
 *
 * A sonda negativa e dupla:
 *   (a) o documento irreparavel lanca ErroReparoAutoria e o REPARADOR
 *       NUNCA e invocado (contador de invocacao);
 *   (b) o erro nomeia a REGRA que falhou com o CAMINHO JSON — nunca so
 *       "invalido" (contrato-w6 §3).
 *
 * Cobre a armadilha mais cara: um documento com erro de FORMA E erro de
 * SEMANTICA juntos (aqui: "Fade" que seria reparavel + tipo de no
 * desconhecido) TEM de ser rejeitado — o reparo de forma nao pode
 * "salvar" um documento que nunca deveria ser aceito.
 */

import { describe, expect, it, vi } from "vitest";
import {
  ErroReparoAutoria,
  repararAutoria,
  type PedidoReparo,
  type Reparador,
} from "../../../src/autoria/reparo/reparar.js";
import { mutar } from "./helpers.js";

/** Reparador-espião: registra invocacoes e NUNCA altera o documento. */
function reparadorQueNuncaEInvocado(): { reparador: Reparador; invocacoes: PedidoReparo[] } {
  const invocacoes: PedidoReparo[] = [];
  const reparador: Reparador = (_documento, pedido) => {
    invocacoes.push(pedido);
    return _documento;
  };
  return { reparador, invocacoes };
}

function capturarErro(fn: () => unknown): ErroReparoAutoria {
  let erro: unknown = null;
  try {
    fn();
  } catch (e) {
    erro = e;
  }
  expect(erro).toBeInstanceOf(ErroReparoAutoria);
  return erro as ErroReparoAutoria;
}

describe("∅-crit — irreparavel e REJEITADO, nunca reparado ate passar", () => {
  it("tipo de no desconhecido: rejeitado, reparador nunca invocado, erro nomeia a regra + caminho", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[1]!.type = "frame";
    });
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(invocacoes).toEqual([]);
    expect(erro.motivo).toBe("irreparavel");
    expect(erro.message).toContain("tipo_de_no_desconhecido");
    expect(erro.message).toContain("/nos/1/type");
    expect(erro.message).not.toContain("invalido");
  });

  it("texto_alternativo ausente em no de midia (AB-433): rejeitado, nunca reparado", () => {
    const doc = mutar((d) => {
      delete (d.nos as Record<string, unknown>[])[4]!.texto_alternativo;
    });
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(invocacoes).toEqual([]);
    expect(erro.message).toContain("texto_alternativo_ausente");
    expect(erro.message).toContain("/nos/4/texto_alternativo");
    expect(erro.message).toContain("AB-433");
  });

  it("texto_alternativo so com brancos: rejeitado (AB-433 — sem descricao)", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[4]!.texto_alternativo = "   \n  ";
    });
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(invocacoes).toEqual([]);
    expect(erro.message).toContain("texto_alternativo_ausente");
  });

  it("hash de midia presente e nao-string (AB-432): rejeitado", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[4]!.hash = 12345;
    });
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(invocacoes).toEqual([]);
    expect(erro.message).toContain("hash_de_midia_invalido");
    expect(erro.message).toContain("/nos/4/hash");
    expect(erro.message).toContain("AB-432");
  });

  it("transicao clockWipe fora do vocabulario v1 (AB-555): rejeitado", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo =
        "clockWipe";
    });
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(invocacoes).toEqual([]);
    expect(erro.message).toContain("transicao_fora_do_vocabulario");
    expect(erro.message).toContain("/cenas/0/transicao_entrada/tipo");
    expect(erro.message).toContain("clockWipe");
  });

  it("transicao cube fora do vocabulario v1 (AB-555): rejeitado", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[1]!.transicao_saida as Record<string, unknown>)!.tipo =
        "cube";
    });

    const erro = capturarErro(() => repararAutoria(doc, { reparador: vi.fn() }));

    expect(erro.message).toContain("transicao_fora_do_vocabulario");
  });

  it("referencia a id inexistente em cena.nos: rejeitado (reparo nao inventa nem remove no)", () => {
    const doc = mutar((d) => {
      (d.cenas as Record<string, unknown>[])[2]!.nos = ["n-004", "n-999"];
    });
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(invocacoes).toEqual([]);
    expect(erro.message).toContain("referencia_inexistente");
    expect(erro.message).toContain("/cenas/2/nos/1");
  });

  it("A ARMADILHA: erro de FORMA (Fade) E erro de SEMANTICA juntos — rejeitado, reparador nunca invocado", () => {
    const doc = mutar((d) => {
      // Forma: case de enum — seria reparavel sozinho.
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo =
        "Fade";
      // Semantica: tipo de no desconhecido.
      (d.nos as Record<string, unknown>[])[2]!.type = "video-fundo";
    });
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    // Nenhuma tentativa: semantica manda antes de qualquer reparo de forma.
    expect(invocacoes).toEqual([]);
    expect(erro.motivo).toBe("irreparavel");
    expect(erro.message).toContain("tipo_de_no_desconhecido");
    expect(erro.message).toContain("/nos/2/type");
  });

  it("documento valido: passa sem tocar em nada (reparado=false, tentativas=0)", () => {
    const doc = mutar(() => {});
    const { reparador, invocacoes } = reparadorQueNuncaEInvocado();

    const resultado = repararAutoria(doc, { reparador });

    expect(resultado.reparado).toBe(false);
    expect(resultado.tentativas).toBe(0);
    expect(invocacoes).toEqual([]);
  });
});
