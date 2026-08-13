/**
 * tests/autoria/reparo/reparar.test.ts
 *
 * A camada de reparo (F4-03, W6): tres tentativas com simplificacao
 * progressiva, revalidacao a cada tentativa, rejeicao final nomeando a
 * regra que falhou (contrato-w6 §3).
 *
 * Pergunta obrigatoria da W6 (contrato-w6 §10): as assercoes sobre escopo
 * sao sobre OS ESCOPOS DESTE CARD (constantes proprias, presentes a cada
 * tentativa) — nunca sobre listas completas de cenas/nos do mundo.
 */

import { describe, expect, it, vi } from "vitest";
import { validarSaidaAutoria } from "../../../src/autoria/contrato/validar.js";
import {
  ESCOPO_T1,
  ESCOPO_T2,
  ESCOPO_T3,
  ErroReparoAutoria,
  escopoDaTentativa,
  repararAutoria,
  type PedidoReparo,
  type Reparador,
} from "../../../src/autoria/reparo/reparar.js";
import { mutar } from "./helpers.js";

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

describe("documento valido — nada e tocado", () => {
  it("valido na entrada: reparado=false, tentativas=0, reparador nao invocado", () => {
    const doc = mutar(() => {});
    const reparador = vi.fn<Reparador>((d) => d);

    const resultado = repararAutoria(doc, { reparador });

    expect(resultado.reparado).toBe(false);
    expect(resultado.tentativas).toBe(0);
    expect(reparador).not.toHaveBeenCalled();
    expect(validarSaidaAutoria(resultado.documento).valido).toBe(true);
  });
});

describe("reparo de FORMA — 1 tentativa com o reparador mecanico", () => {
  it("case de enum corrigido na tentativa 1 pelo reparador mecanico default", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "Fade";
    });

    const resultado = repararAutoria(doc);

    expect(resultado.reparado).toBe(true);
    expect(resultado.tentativas).toBe(1);
    expect(validarSaidaAutoria(resultado.documento).valido).toBe(true);
    expect(
      (resultado.documento.cenas[0]!.transicao_entrada as { tipo: string }).tipo,
    ).toBe("fade");
  });

  it("um documento com TODAS as categorias de forma juntas e reparado numa unica tentativa", () => {
    const doc = mutar((d) => {
      // case
      ((d.cenas as Record<string, unknown>[])[1]!.transicao_entrada as Record<string, unknown>)!.tipo = "Wipe";
      // espaco: campo opcional so com brancos
      (d.nos as Record<string, unknown>[])[0]!.subtitulo = "  ";
      // espaco: item de lista so com brancos
      ((d.nos as Record<string, unknown>[])[2]!.itens as string[]).push("   ");
      // duplicata: id de no repetido
      (d.nos as Record<string, unknown>[]).push({ ...(d.nos as Record<string, unknown>[])[0]! });
      // escape: quebra de linha escapada no codigo
      (d.nos as Record<string, unknown>[])[3]!.codigo = "replicas: 3\\nimage: api:v2";
    });

    const resultado = repararAutoria(doc);

    expect(resultado.reparado).toBe(true);
    expect(resultado.tentativas).toBe(1);
    expect(validarSaidaAutoria(resultado.documento).valido).toBe(true);
  });
});

describe("tres tentativas com simplificacao progressiva — terminam", () => {
  it("escopo encolhe T1 -> T2 -> T3 (presenca das categorias de cada tentativa)", () => {
    expect(escopoDaTentativa(1)).toEqual(ESCOPO_T1);
    expect(escopoDaTentativa(2)).toEqual(ESCOPO_T2);
    expect(escopoDaTentativa(3)).toEqual(ESCOPO_T3);
    // Presenca: duplicata so em T1; espaco em T1 e T2; case em T1, T2 e T3.
    expect(ESCOPO_T1.duplicata).toBe(true);
    expect(ESCOPO_T2.duplicata).toBe(false);
    expect(ESCOPO_T1.espaco).toBe(true);
    expect(ESCOPO_T2.espaco).toBe(true);
    expect(ESCOPO_T3.espaco).toBe(false);
    expect(ESCOPO_T3.case).toBe(true);
  });

  it("reparador que falha 2x e acerta na 3a: recebe os pedidos com escopo decrescente", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "Fade";
    });
    const pedidos: PedidoReparo[] = [];
    let chamadas = 0;
    const reparador: Reparador = (documento, pedido) => {
      chamadas++;
      pedidos.push(pedido);
      // Falha nas duas primeiras (devolve clone intocado); na 3a repara.
      if (chamadas < 3) return structuredClone(documento);
      const copia = structuredClone(documento) as Record<string, unknown>;
      (
        (copia.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>
      )!.tipo = "fade";
      return copia;
    };

    const resultado = repararAutoria(doc, { reparador });

    expect(resultado.tentativas).toBe(3);
    expect(chamadas).toBe(3);
    expect(pedidos.map((p) => p.tentativa)).toEqual([1, 2, 3]);
    // O erro do validador volta com o caminho JSON em CADA pedido.
    for (const pedido of pedidos) {
      expect(pedido.erros.some((e) => e.includes("/cenas/0/transicao_entrada/tipo"))).toBe(true);
    }
    // Escopo decrescente: a presenca de duplicata some entre T1 e T2.
    expect(pedidos[0]!.escopo.duplicata).toBe(true);
    expect(pedidos[1]!.escopo.duplicata).toBe(false);
  });

  it("TERMINA: reparador que nunca repara — exatamente 3 invocacoes, depois rejeicao com a regra", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "Fade";
    });
    let chamadas = 0;
    const reparador: Reparador = (documento) => {
      chamadas++;
      return structuredClone(documento);
    };

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(chamadas).toBe(3);
    expect(erro.motivo).toBe("tentativas_esgotadas");
    // O erro final NOMEIA a regra que falhou com o caminho — nao so "invalido".
    expect(erro.message).toContain("case_de_enum");
    expect(erro.message).toContain("/cenas/0/transicao_entrada/tipo");
    expect(erro.message).not.toContain("invalido");
  });

  it("maxTentativas respeita o teto (1 tentativa, depois rejeicao)", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[1]!.transicao_saida as Record<string, unknown>)!.tipo = "Flip";
    });
    let chamadas = 0;
    const reparador: Reparador = (documento) => {
      chamadas++;
      return structuredClone(documento);
    };

    const erro = capturarErro(() => repararAutoria(doc, { reparador, maxTentativas: 1 }));

    expect(chamadas).toBe(1);
    expect(erro.motivo).toBe("tentativas_esgotadas");
    expect(erro.message).toContain("/cenas/1/transicao_saida/tipo");
  });
});

describe("semantica no meio do loop — rejeicao imediata, nao 3 tentativas", () => {
  it("reparador que INTRODUZ transicao fora do vocabulario: rejeitado na hora", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "Fade";
    });
    let chamadas = 0;
    const reparador: Reparador = (documento) => {
      chamadas++;
      const copia = structuredClone(documento) as Record<string, unknown>;
      // c-001 nao tem transicao_saida: o reparador INVENTA uma com tipo
      // fora do vocabulario — semantica introduzida no meio do loop.
      (copia.cenas as Record<string, unknown>[])[0]!.transicao_saida = { tipo: "clockWipe" };
      return copia;
    };

    const erro = capturarErro(() => repararAutoria(doc, { reparador }));

    expect(chamadas).toBe(1);
    expect(erro.motivo).toBe("irreparavel");
    expect(erro.message).toContain("transicao_fora_do_vocabulario");
    expect(erro.message).toContain("/cenas/0/transicao_saida/tipo");
  });
});
