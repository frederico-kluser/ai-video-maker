/**
 * tests/autoria/reparo/classificar.test.ts
 *
 * A fronteira REPARAVEL (forma) x IRREPARAVEL (semantica) do reparo de
 * autoria (F4-03, W6 — contrato-w6 §3, congelado).
 *
 * Duas responsabilidades deste arquivo:
 *   1. paridade: a validacao interna da classificacao (Ajv com o mesmo
 *      arquivo de schema) coincide com a do contrato
 *      (validarSaidaAutoria de F4-01) — documento valido => zero desvios;
 *   2. cada categoria de FORMA e classificada reparavel com a sua
 *      categoria, e cada regra de SEMANTICA e classificada irreparavel
 *      com o nome estavel da regra.
 *
 * Pergunta obrigatoria da W6 (contrato-w6 §10): assercao de PRESENCA do
 * item deste card (a regra e o caminho), nunca lista completa de cenas/
 * nos do mundo — os documentos aqui sao mutacoes da base deste proprio
 * card, intocadas pelos irmaos da onda.
 */

import { describe, expect, it } from "vitest";
import { validarSaidaAutoria } from "../../../src/autoria/contrato/validar.js";
import { classificarDesvios, type Desvio } from "../../../src/autoria/reparo/classificar.js";
import { mutar } from "./helpers.js";

function desviosDe(mutacao: Parameters<typeof mutar>[0]): Desvio[] {
  return classificarDesvios(mutar(mutacao));
}

function soIrreparaveis(mutacao: Parameters<typeof mutar>[0]): Desvio[] {
  return desviosDe(mutacao).filter((d) => d.classe === "irreparavel");
}

function soReparaveis(mutacao: Parameters<typeof mutar>[0]): Desvio[] {
  return desviosDe(mutacao).filter((d) => d.classe === "reparavel");
}

describe("paridade com o validador do contrato (F4-01)", () => {
  it("documento valido da base: validarSaidaAutoria valido E zero desvios", () => {
    const doc = mutar(() => {});
    expect(validarSaidaAutoria(doc).valido).toBe(true);
    expect(classificarDesvios(doc)).toEqual([]);
  });

  it("paridade: documento invalido no schema => a classificacao reporta >=1 desvio", () => {
    // (A referencia inexistente e schema-VALIDA por desenho — o schema nao
    // exige existencia de id; quem a pega e a varredura estrutural, nos
    // testes de SEMANTICA abaixo.)
    const casos: Array<Parameters<typeof mutar>[0]> = [
      (d) => { (d.nos as Record<string, unknown>[])[1]!.type = "frame"; },
      (d) => { delete (d.nos as Record<string, unknown>[])[4]!.texto_alternativo; },
      (d) => { ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "clockWipe"; },
      (d) => { (d.nos as Record<string, unknown>[])[1]!.destaque = "sim"; },
      (d) => { ((d.nos as Record<string, unknown>[])[5]!.dados as Record<string, unknown>[])[0]!.valor = "6"; },
      (d) => { (d as Record<string, unknown>).schema_version = "Manifesto.1"; },
      (d) => { (d.nos as Record<string, unknown>[])[1]!.duracao_frames = 90; },
    ];
    for (const caso of casos) {
      const doc = mutar(caso);
      expect(validarSaidaAutoria(doc).valido).toBe(false);
      expect(classificarDesvios(doc).length).toBeGreaterThan(0);
    }
  });
});

describe("REPARAVEL = FORMA", () => {
  it("case de enum do vocabulario fechado: Fade -> reparavel(case)", () => {
    const desvios = soReparaveis((d) => {
      ((d.cenas as Record<string, unknown>[])[0]!.transicao_entrada as Record<string, unknown>)!.tipo = "Fade";
    });
    expect(desvios.some((d) => d.categoria === "case" && d.regra === "case_de_enum" && d.caminho === "/cenas/0/transicao_entrada/tipo")).toBe(true);
  });

  it("enum com espaco em volta: ' fade ' -> reparavel(espaco)", () => {
    const desvios = soReparaveis((d) => {
      ((d.cenas as Record<string, unknown>[])[1]!.transicao_entrada as Record<string, unknown>)!.tipo = " fade ";
    });
    expect(desvios.some((d) => d.categoria === "espaco" && d.regra === "espaco" && d.caminho === "/cenas/1/transicao_entrada/tipo")).toBe(true);
  });

  it("case de tipo_midia: 'Imagem' -> reparavel(case)", () => {
    const desvios = soReparaveis((d) => {
      (d.nos as Record<string, unknown>[])[4]!.tipo_midia = "Imagem";
    });
    expect(desvios.some((d) => d.categoria === "case" && d.caminho === "/nos/4/tipo_midia")).toBe(true);
  });

  it("case de tipo_grafico: 'Barras' -> reparavel(case)", () => {
    const desvios = soReparaveis((d) => {
      (d.nos as Record<string, unknown>[])[5]!.tipo_grafico = "Barras";
    });
    expect(desvios.some((d) => d.categoria === "case" && d.caminho === "/nos/5/tipo_grafico")).toBe(true);
  });

  it("case de type de no: 'Midia' -> reparavel(case) — const do vocabulario fechado", () => {
    const desvios = soReparaveis((d) => {
      (d.nos as Record<string, unknown>[])[4]!.type = "Midia";
    });
    expect(desvios.some((d) => d.categoria === "case" && d.caminho === "/nos/4/type")).toBe(true);
  });

  it("case de type NAO esconde AB-433: no 'Midia' sem texto_alternativo e irreparavel", () => {
    const desvios = desviosDe((d) => {
      (d.nos as Record<string, unknown>[])[4]!.type = "Midia";
      delete (d.nos as Record<string, unknown>[])[4]!.texto_alternativo;
    });
    expect(desvios.some((d) => d.classe === "irreparavel" && d.regra === "texto_alternativo_ausente")).toBe(true);
  });

  it("duplicata: id de no repetido -> reparavel(duplicata)", () => {
    const desvios = soReparaveis((d) => {
      (d.nos as Record<string, unknown>[]).push({ ...(d.nos as Record<string, unknown>[])[0]! });
    });
    expect(desvios.some((d) => d.regra === "id_de_no_duplicado" && d.categoria === "duplicata" && d.caminho === "/nos/6/id")).toBe(true);
  });

  it("duplicata: id de cena repetido -> reparavel(duplicata)", () => {
    const desvios = soReparaveis((d) => {
      (d.cenas as Record<string, unknown>[]).push({ ...(d.cenas as Record<string, unknown>[])[0]! });
    });
    expect(desvios.some((d) => d.regra === "id_de_cena_duplicado" && d.categoria === "duplicata")).toBe(true);
  });

  it("duplicata: referencia repetida dentro de cena.nos -> reparavel(duplicata)", () => {
    const desvios = soReparaveis((d) => {
      (d.cenas as Record<string, unknown>[])[0]!.nos = ["n-001", "n-001", "n-002"];
    });
    expect(desvios.some((d) => d.regra === "referencia_duplicada_na_cena" && d.categoria === "duplicata" && d.caminho === "/cenas/0/nos/1")).toBe(true);
  });

  it("espaco: campo opcional vazio -> reparavel(espaco) (removivel)", () => {
    // minLength so reprova a string vazia (brancos contam como caracteres):
    // o sinal de espaco e o "" em campo opcional — o reparo remove o campo.
    const desvios = soReparaveis((d) => {
      (d.nos as Record<string, unknown>[])[0]!.subtitulo = "";
    });
    expect(desvios.some((d) => d.categoria === "espaco" && d.regra === "espaco" && d.caminho === "/nos/0/subtitulo")).toBe(true);
  });

  it("espaco: item de lista vazio -> reparavel(espaco) (removivel)", () => {
    const desvios = soReparaveis((d) => {
      ((d.nos as Record<string, unknown>[])[2]!.itens as string[]).push("");
    });
    expect(desvios.some((d) => d.categoria === "espaco" && d.caminho === "/nos/2/itens/3")).toBe(true);
  });

  it("duplicata em documento SEMANTICAMENTE valido nao produz desvio irreparavel", () => {
    const desvios = desviosDe((d) => {
      (d.nos as Record<string, unknown>[]).push({ ...(d.nos as Record<string, unknown>[])[0]! });
    });
    expect(desvios.every((d) => d.classe === "reparavel")).toBe(true);
  });
});

describe("REJEICAO DEFINITIVA = SEMANTICA", () => {
  it("tipo de no desconhecido: irreparavel 'tipo_de_no_desconhecido'", () => {
    const desvios = soIrreparaveis((d) => {
      (d.nos as Record<string, unknown>[])[3]!.type = "video-fundo";
    });
    expect(desvios.some((d) => d.regra === "tipo_de_no_desconhecido" && d.caminho === "/nos/3/type")).toBe(true);
  });

  it("texto_alternativo ausente: irreparavel 'texto_alternativo_ausente' (AB-433)", () => {
    const desvios = soIrreparaveis((d) => {
      delete (d.nos as Record<string, unknown>[])[4]!.texto_alternativo;
    });
    expect(desvios.some((d) => d.regra === "texto_alternativo_ausente" && d.caminho === "/nos/4/texto_alternativo")).toBe(true);
  });

  it("hash nao-string: irreparavel 'hash_de_midia_invalido' (AB-432)", () => {
    const desvios = soIrreparaveis((d) => {
      (d.nos as Record<string, unknown>[])[4]!.hash = 12345;
    });
    expect(desvios.some((d) => d.regra === "hash_de_midia_invalido" && d.caminho === "/nos/4/hash")).toBe(true);
  });

  it("transicao clockWipe: irreparavel 'transicao_fora_do_vocabulario' (AB-555)", () => {
    const desvios = soIrreparaveis((d) => {
      // c-002 tem transicao_saida declarada (none) — sobrescrever com
      // clockWipe e a violacao do vocabulario v1.
      ((d.cenas as Record<string, unknown>[])[1]!.transicao_saida as Record<string, unknown>)!.tipo = "clockWipe";
    });
    expect(desvios.some((d) => d.regra === "transicao_fora_do_vocabulario" && d.caminho === "/cenas/1/transicao_saida/tipo")).toBe(true);
  });

  it("tipo_midia fora do vocabulario fechado: irreparavel 'enum_fora_do_vocabulario'", () => {
    const desvios = soIrreparaveis((d) => {
      (d.nos as Record<string, unknown>[])[4]!.tipo_midia = "photo";
    });
    expect(desvios.some((d) => d.regra === "enum_fora_do_vocabulario" && d.caminho === "/nos/4/tipo_midia")).toBe(true);
  });

  it("tipo_grafico fora do vocabulario fechado: irreparavel 'enum_fora_do_vocabulario'", () => {
    const desvios = soIrreparaveis((d) => {
      (d.nos as Record<string, unknown>[])[5]!.tipo_grafico = "pizza3d";
    });
    expect(desvios.some((d) => d.regra === "enum_fora_do_vocabulario" && d.caminho === "/nos/5/tipo_grafico")).toBe(true);
  });

  it("referencia inexistente em cena.nos: irreparavel 'referencia_inexistente'", () => {
    const desvios = soIrreparaveis((d) => {
      (d.cenas as Record<string, unknown>[])[1]!.nos = ["n-999"];
    });
    expect(desvios.some((d) => d.regra === "referencia_inexistente" && d.caminho === "/cenas/1/nos/0")).toBe(true);
  });

  it("schema_version errada: irreparavel 'const' no caminho do campo", () => {
    const desvios = soIrreparaveis((d) => {
      (d as Record<string, unknown>).schema_version = "Autoria.2";
    });
    expect(desvios.some((d) => d.regra === "const" && d.caminho === "/schema_version")).toBe(true);
  });

  it("emissao de frames (campo inexistente): irreparavel 'additionalProperties' — o schema reprova de proposito", () => {
    const desvios = soIrreparaveis((d) => {
      (d.nos as Record<string, unknown>[])[1]!.duracao_frames = 90;
    });
    expect(desvios.some((d) => d.regra === "additionalProperties" && d.caminho === "/nos/1")).toBe(true);
  });

  it("valor numerico onde o schema pede numero: irreparavel 'type'", () => {
    const desvios = soIrreparaveis((d) => {
      ((d.nos as Record<string, unknown>[])[5]!.dados as Record<string, unknown>[])[0]!.valor = "6";
    });
    expect(desvios.some((d) => d.regra === "type" && d.caminho === "/nos/5/dados/0/valor")).toBe(true);
  });

  it("campo obrigatorio vazio (texto = ''): irreparavel 'minLength' — reparo nao inventa texto", () => {
    const desvios = soIrreparaveis((d) => {
      (d.nos as Record<string, unknown>[])[0]!.texto = "";
    });
    expect(desvios.some((d) => d.regra === "minLength" && d.caminho === "/nos/0/texto")).toBe(true);
  });

  it("array vazio onde o schema exige >=1 (itens): irreparavel 'minItems'", () => {
    const desvios = soIrreparaveis((d) => {
      (d.nos as Record<string, unknown>[])[2]!.itens = [];
    });
    expect(desvios.some((d) => d.regra === "minItems" && d.caminho === "/nos/2/itens")).toBe(true);
  });
});
