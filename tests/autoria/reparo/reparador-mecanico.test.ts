/**
 * tests/autoria/reparo/reparador-mecanico.test.ts
 *
 * O reparador DETERMINISTICO de forma (F4-03, W6): as cinco categorias
 * do contrato-w6 §3 — espaco, escape, case de enum, ordem, duplicata —
 * cada uma GATEADA pelo escopo do pedido (a simplificacao progressiva
 * reduz o escopo do pedido, nunca o documento).
 *
 * Assercao central deste arquivo: o reparador so toca o que o escopo
 * permite — e NUNCA toca `hash` (AB-432: advisory, endereco por conteudo
 * e resolvido a jusante). Qualquer normalizacao fora das cinco categorias
 * seria "o LLM decidindo duas vezes".
 *
 * Pergunta obrigatoria da W6 (contrato-w6 §10): presenca do item deste
 * card (a categoria reparada), nunca listas completas do mundo.
 */

import { describe, expect, it } from "vitest";
import { reparadorMecanico } from "../../../src/autoria/reparo/reparador-mecanico.js";
import { ESCOPO_T1, ESCOPO_T3, type PedidoReparo } from "../../../src/autoria/reparo/reparar.js";
import { mutar } from "./helpers.js";

function pedido(escopo = ESCOPO_T1): PedidoReparo {
  return { tentativa: 1, escopo, erros: [] };
}

describe("case de enum do vocabulario fechado", () => {
  it("Fade -> fade (transicao)", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "Fade";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect(
      ((reparado.cenas as Record<string, unknown>[])[0]!.transicao_entrada as { tipo: string }).tipo,
    ).toBe("fade");
  });

  it("Imagem -> imagem (tipo_midia)", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[4]!.tipo_midia = "Imagem";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[4]!.tipo_midia).toBe("imagem");
  });

  it("Barras -> barras (tipo_grafico)", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[5]!.tipo_grafico = "Barras";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[5]!.tipo_grafico).toBe("barras");
  });

  it("Midia -> midia (type de no, const do vocabulario fechado)", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[4]!.type = "Midia";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[4]!.type).toBe("midia");
  });

  it("sem escopo de case, o case NAO e tocado", () => {
    const doc = mutar((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "Fade";
    });
    const escopoSemCase = { ...ESCOPO_T1, case: false };
    const reparado = reparadorMecanico(doc, pedido(escopoSemCase)) as Record<string, unknown>;
    expect(
      ((reparado.cenas as Record<string, unknown>[])[0]!.transicao_entrada as { tipo: string }).tipo,
    ).toBe("Fade");
  });
});

describe("espaco em campo textual", () => {
  it("trim de texto com brancos nas bordas", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[0]!.texto = "  Orquestrador de containers  ";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[0]!.texto).toBe("Orquestrador de containers");
  });

  it("normaliza \r\n -> \n no codigo", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[3]!.codigo = "replicas: 3\r\nimage: api:v2";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[3]!.codigo).toBe("replicas: 3\nimage: api:v2");
  });

  it("campo opcional so com brancos e REMOVIDO (nao preenchido)", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[0]!.subtitulo = "   ";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[0]!).not.toHaveProperty("subtitulo");
  });

  it("item de lista so com brancos e REMOVIDO", () => {
    const doc = mutar((d) => {
      ((d.nos as Record<string, unknown>[])[2]!.itens as string[]).push("   ");
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[2]!.itens).toEqual([
      "Sobe containers em maquinas saudaveis",
      "Reinicia o que parou",
      "Escala replicas quando o trafego cresce",
    ]);
  });

  it("sem escopo de espaco, nada e aparado", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[0]!.texto = "  Orquestrador  ";
    });
    const escopoSemEspaco = { ...ESCOPO_T1, espaco: false };
    const reparado = reparadorMecanico(doc, pedido(escopoSemEspaco)) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[0]!.texto).toBe("  Orquestrador  ");
  });
});

describe("escape em campo textual", () => {
  it("decodifica \\n literal para quebra de linha no codigo", () => {
    const doc = mutar((d) => {
      // No texto PARSEADO: backslash + n (o LLM escapou a quebra de linha).
      (d.nos as Record<string, unknown>[])[3]!.codigo = "replicas: 3\\nimage: api:v2";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[3]!.codigo).toBe("replicas: 3\nimage: api:v2");
  });

  it("decodifica \\t literal em campo textual", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[1]!.texto = "um\\ttab";
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[1]!.texto).toBe("um\ttab");
  });

  it("sem escopo de escape, sequencias ficam intocadas", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[3]!.codigo = "replicas: 3\\nimage: api:v2";
    });
    const escopoSemEscape = { ...ESCOPO_T1, escape: false };
    const reparado = reparadorMecanico(doc, pedido(escopoSemEscape)) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[3]!.codigo).toBe("replicas: 3\\nimage: api:v2");
  });
});

describe("ordem de campos", () => {
  it("no de cabecalho com campos fora de ordem ganha a ordem canonica do schema", () => {
    const doc = mutar((d) => {
      const nos = d.nos as Record<string, unknown>[];
      const original = nos[0] as Record<string, unknown>;
      nos[0] = {
        subtitulo: original.subtitulo,
        texto: original.texto,
        type: original.type,
        schema: original.schema,
        id: original.id,
      };
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect(Object.keys((reparado.nos as Record<string, unknown>[])[0]!)).toEqual([
      "id",
      "schema",
      "type",
      "texto",
      "subtitulo",
    ]);
  });

  it("cena ganha a ordem canonica (id, nos, transicoes, audio_cena)", () => {
    const doc = mutar((d) => {
      const cenas = d.cenas as Record<string, unknown>[];
      const cena = cenas[0] as Record<string, unknown>;
      cenas[0] = {
        audio_cena: cena.audio_cena,
        transicao_entrada: cena.transicao_entrada,
        nos: cena.nos,
        id: cena.id,
      };
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    // c-001 nao tem transicao_saida: a ordem canonica respeita a presenca.
    expect(Object.keys((reparado.cenas as Record<string, unknown>[])[0]!)).toEqual([
      "id",
      "nos",
      "transicao_entrada",
      "audio_cena",
    ]);
  });
});

describe("duplicata", () => {
  it("id de no repetido: mantem a PRIMEIRA ocorrencia, descarta a segunda", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[]).push({ ...(d.nos as Record<string, unknown>[])[1]! });
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    const ids = (reparado.nos as Record<string, unknown>[]).map((n) => n.id);
    expect(ids.filter((id) => id === "n-002").length).toBe(1);
    expect((reparado.nos as Record<string, unknown>[]).length).toBe(6);
  });

  it("id de cena repetido: mantem a primeira", () => {
    const doc = mutar((d) => {
      (d.cenas as Record<string, unknown>[]).push({ ...(d.cenas as Record<string, unknown>[])[0]! });
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.cenas as Record<string, unknown>[]).length).toBe(3);
  });

  it("referencia repetida em cena.nos: deduplicada", () => {
    const doc = mutar((d) => {
      (d.cenas as Record<string, unknown>[])[0]!.nos = ["n-001", "n-001", "n-002"];
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.cenas as Record<string, unknown>[])[0]!.nos).toEqual(["n-001", "n-002"]);
  });

  it("sem escopo de duplicata, o no repetido permanece", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[]).push({ ...(d.nos as Record<string, unknown>[])[1]! });
    });
    const escopoSemDuplicata = { ...ESCOPO_T1, duplicata: false };
    const reparado = reparadorMecanico(doc, pedido(escopoSemDuplicata)) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[]).length).toBe(7);
  });
});

describe("limites do reparador — o que ele NUNCA toca", () => {
  it("hash de midia valido permanece byte a byte (AB-432 advisory; nao e tocado)", () => {
    const hash = "a".repeat(64);
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[])[4]!.hash = hash;
    });
    const reparado = reparadorMecanico(doc, pedido()) as Record<string, unknown>;
    expect((reparado.nos as Record<string, unknown>[])[4]!.hash).toBe(hash);
  });

  it("escopo minimo T3 so toca case — nem espaco nem duplicata", () => {
    const doc = mutar((d) => {
      (d.nos as Record<string, unknown>[]).push({ ...(d.nos as Record<string, unknown>[])[0]! });
      (d.nos as Record<string, unknown>[])[0]!.texto = "  Orquestrador  ";
      ((d.cenas as Record<string, unknown>[])[1]!.transicao_entrada as Record<string, unknown>)!.tipo = "Wipe";
    });
    const reparado = reparadorMecanico(doc, pedido(ESCOPO_T3)) as Record<string, unknown>;
    // case foi aplicado
    expect(
      ((reparado.cenas as Record<string, unknown>[])[1]!.transicao_entrada as { tipo: string }).tipo,
    ).toBe("wipe");
    // espaco NAO foi aplicado
    expect((reparado.nos as Record<string, unknown>[])[0]!.texto).toBe("  Orquestrador  ");
    // duplicata NAO foi aplicada
    expect((reparado.nos as Record<string, unknown>[]).length).toBe(7);
  });
});
