/**
 * tests/roteiro/contrato-cobertura.test.ts
 *
 * Cobertura dos gaps deixados por contrato.test.ts / cache.test.ts /
 * primeira-chamada.test.ts (onda de TESTING pos-squash da Onda 1).
 *
 * O que este arquivo cobre (e o motivo de cada bloco):
 *
 *   A. marcarFalaEditada (edicao.ts) — funcao publica sem NENHUM teste
 *      direto; a marca "editado" e o ponto em que a narracao fica stale
 *      por regra (edicao.ts:70-82).
 *   B. editarPedaco com fala IGUAL a atual — branch
 *      `edicao.fala === pedaco.fala` (audio continua em dia; nada stale).
 *   C. rejeitarBriefInvalido (rejeitar.ts:44-48) + happy-path dos asserts
 *      (rejeitarRoteiroInvalido/rejeitarPedacoInvalido com entrada valida
 *      nao lancam — o assert estreita o tipo, FQ-C1).
 *   D. Guards de vocabulario eTipoVisual/eOrigemNarracao/eStatusNarracao
 *      (validar.ts:400-410) — 0% na baseline.
 *   E. validarProjetoRoteiro — branches negativas (nao-objeto, id vazio,
 *      datas invalidas, brief/roteiro invalidos prefixados, chave fora do
 *      formato p-[0-9]{3}, pedacos_editados nao-objeto e ausente).
 *   F. Pedidos do gerador — versoes invalidas no REGENERAR (so o gerar era
 *      mutado) e a SEMANTICA do pedaco_atual com prefixo "(raiz).pedaco_atual".
 *   G. Bordas do schema (FQ-C2 e o schema e o UNICO contrato): minItems/
 *      maxItems do roteiro, schema_version errada, duracao_total 0/negativa,
 *      hash_audio/anexo_hash malformados, narracao sem campo obrigatorio,
 *      duracao_alvo invalida no pedido, resumo vazio, pedaco_atual ausente.
 *   H. Round-trip edicao -> cache (C12/FQ-G3): a edicao aplicada por
 *      editarPedaco vira `pedaco_atual` do PedidoRegenerarPedaco e MUDOU a
 *      chave; a mesma edicao 2x = mesma chave; irmao editado (resumo) =
 *      chave diferente; canonicalizar com chaves embaralhadas em
 *      PROFUNDIDADE; travas de identidade de aplicarEdicaoPedaco mesmo com
 *      delta ilegal.
 *
 * Nao duplica os 55 testes existentes; cada caso aqui mira uma linha ou
 * branch que a baseline deixou em 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGRA_ANEXO_EXIGIDO,
  REGRA_NARRACAO_FALA_VAZIA,
  REGRA_VERSAO,
  eOrigemNarracao,
  eStatusNarracao,
  eTipoVisual,
  validarBriefRoteiro,
  validarPedaco,
  validarPedidoGerarRoteiro,
  validarPedidoRegenerarPedaco,
  validarProjetoRoteiro,
  validarRoteiro,
} from "../../src/roteiro/contrato/validar.js";
import {
  ErroContratoRoteiro,
  rejeitarBriefInvalido,
  rejeitarPedacoInvalido,
  rejeitarRoteiroInvalido,
} from "../../src/roteiro/contrato/rejeitar.js";
import {
  aplicarEdicaoPedaco,
  editarPedaco,
  marcarFalaEditada,
} from "../../src/roteiro/contrato/edicao.js";
import { chaveDeCacheGerador } from "../../src/roteiro/contrato/cache.js";
import { canonicalizar, resumoDePedacos } from "../../src/roteiro/contrato/canonicalizar.js";
import {
  VERSAO_CONTRATO_GERADOR,
  VERSAO_CONTRATO_ROTEIRO,
  VERSAO_GERADOR,
} from "../../src/roteiro/contrato/contrato.js";
import type {
  EdicaoPedaco,
  Pedaco,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
  Roteiro,
} from "../../src/roteiro/contrato/contrato.js";

const FIXTURES = join(__dirname, "fixtures");

function carregar(nome: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as unknown;
}

function roteiroComNarracao(): Roteiro {
  return carregar("roteiro-com-narracao.json") as Roteiro;
}

function problemasDe(problemas: string[], regra: string): boolean {
  return problemas.some((p) => p.includes(regra));
}

// ─── A. marcarFalaEditada ──────────────────────────────────────────────────────

describe("marcarFalaEditada — a marca de stale da narracao (edicao.ts)", () => {
  const alvo = () => roteiroComNarracao().pedacos[1]!; // tts, status gerado

  it("fala IGUAL a atual devolve o pedaco intacto (mesma referencia, nada marcado)", () => {
    const pedaco = alvo();
    const resultado = marcarFalaEditada(pedaco, pedaco.fala);
    expect(resultado).toBe(pedaco); // identidade: nenhum campo muda
    expect(resultado.narracao.status).toBe("gerado");
  });

  it("fala diferente marca status 'editado' preservando narracao.texto (o texto ANTIGO)", () => {
    const pedaco = alvo();
    const resultado = marcarFalaEditada(pedaco, "Nova fala escrita pelo usuario.");
    expect(resultado.fala).toBe("Nova fala escrita pelo usuario.");
    expect(resultado.narracao.status).toBe("editado");
    // `narracao.texto` continua apontando para o texto de que o audio ATUAL
    // foi gerado — e a regra editado-sincronizado (texto != fala) que vale.
    expect(resultado.narracao.texto).toBe(pedaco.narracao.texto);
    expect(resultado.narracao.origem).toBe(pedaco.narracao.origem);
    // Identidade intocada (travas do contrato).
    expect(resultado.id).toBe(pedaco.id);
    expect(resultado.indice).toBe(pedaco.indice);
    // O resultado e um pedaco que VALIDA: editado exige texto != fala.
    expect(validarPedaco(resultado).valido).toBe(true);
  });
});

// ─── B. editarPedaco com fala igual ───────────────────────────────────────────

describe("editarPedaco — bordas da regra de narracao", () => {
  it("fala editada para o MESMO valor nao marca stale (audio continua em dia)", () => {
    const roteiro = roteiroComNarracao();
    const alvo = roteiro.pedacos[1]!; // tts, gerado
    const editado = editarPedaco(alvo, { fala: alvo.fala, titulo: "Titulo novo" });
    expect(editado.fala).toBe(alvo.fala);
    expect(editado.titulo).toBe("Titulo novo");
    // A fala nao mudou: nao ha nada stale — status permanece "gerado".
    expect(editado.narracao.status).toBe("gerado");
    expect(editado.narracao.texto).toBe(alvo.narracao.texto);
    expect(validarPedaco(editado).valido).toBe(true);
  });

  it("apagar a fala de um pedaco JA vazio permanece vazio (fala '' == fala atual)", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const alvo = roteiro.pedacos[0]!; // fala "", status vazio
    const editado = editarPedaco(alvo, { fala: "" });
    expect(editado.fala).toBe("");
    expect(editado.narracao).toEqual({ texto: "", origem: "nenhuma", status: "vazio" });
  });
});

// ─── C. rejeitarBriefInvalido + happy-path dos asserts ────────────────────────

describe("rejeicao — rejeitarBriefInvalido e asserts com entrada valida", () => {
  it("rejeitarBriefInvalido lanca ErroContratoRoteiro com os problemas nomeados", () => {
    expect(() => rejeitarBriefInvalido(carregar("brief-invalido-sem-tema.json"))).toThrow(
      ErroContratoRoteiro,
    );
    let capturado: ErroContratoRoteiro | null = null;
    try {
      rejeitarBriefInvalido(carregar("brief-invalido-sem-tema.json"));
    } catch (e) {
      capturado = e as ErroContratoRoteiro;
    }
    expect(capturado?.name).toBe("ErroContratoRoteiro");
    expect(capturado?.problemas.length).toBeGreaterThan(0);
    expect(capturado?.problemas.some((p) => p.includes("tema"))).toBe(true);
  });

  it("tema vazio (nao so ausente) e rejeitado pelo schema do brief", () => {
    const resultado = validarBriefRoteiro({ tema: "" });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("tema"))).toBe(true);
  });

  it("os asserts de roteiro, pedaco e brief PASSAM sem lancar para entradas validas", () => {
    // O assert estreita o tipo (asserts valor is X): entrada valida nao
    // pode lancar — o caminho de aceite de rejeitar.ts:28-49.
    expect(() => rejeitarRoteiroInvalido(carregar("roteiro-valido.json"))).not.toThrow();
    expect(() => rejeitarPedacoInvalido(carregar("pedaco-valido.json"))).not.toThrow();
    expect(() => rejeitarBriefInvalido(carregar("brief-valido.json"))).not.toThrow();
  });
});

// ─── D. Guards de vocabulario ─────────────────────────────────────────────────

describe("guards de vocabulario (validar.ts) — reconhecem o vocabulario fechado", () => {
  it("eTipoVisual: cada valor do vocabulario casa; fora dele, nao", () => {
    for (const valor of ["manim", "grafico", "gif", "video", "texto", "lista", "cabecalho"]) {
      expect(eTipoVisual(valor), `esperado true para "${valor}"`).toBe(true);
    }
    expect(eTipoVisual("holograma")).toBe(false);
    expect(eTipoVisual("")).toBe(false);
  });

  it("eOrigemNarracao: tts/gravacao/nenhuma casam; fora delas, nao", () => {
    expect(eOrigemNarracao("tts")).toBe(true);
    expect(eOrigemNarracao("gravacao")).toBe(true);
    expect(eOrigemNarracao("nenhuma")).toBe(true);
    expect(eOrigemNarracao("radio")).toBe(false);
  });

  it("eStatusNarracao: vazio/gerado/editado casam; fora deles, nao", () => {
    expect(eStatusNarracao("vazio")).toBe(true);
    expect(eStatusNarracao("gerado")).toBe(true);
    expect(eStatusNarracao("editado")).toBe(true);
    expect(eStatusNarracao("gravando")).toBe(false);
  });

  it("o guard estreita o tipo em runtime (if + uso como valor do vocabulario)", () => {
    const valor: string = "manim";
    if (eTipoVisual(valor)) {
      // Dentro do if, o TS trata `valor` como TipoVisualPedaco — o tipo
      // guard e a ponte entre o JSON bruto e o vocabulario fechado.
      expect(valor).toBe("manim");
    } else {
      throw new Error("eTipoVisual(\"manim\") deveria ter estreitado");
    }
  });
});

// ─── E. validarProjetoRoteiro — branches negativas ────────────────────────────

describe("validarProjetoRoteiro — rejeicoes de shape e composicao", () => {
  function projetoBase(): Record<string, unknown> {
    return {
      id: "proj-001",
      brief: carregar("brief-valido.json"),
      roteiro: carregar("roteiro-valido.json"),
      pedacos_editados: {},
      criado_em: "2026-08-14T10:00:00.000Z",
      atualizado_em: "2026-08-14T10:05:00.000Z",
    };
  }

  it("valor que nao e objeto (null, array, string) e rejeitado", () => {
    for (const valor of [null, [], "projeto"]) {
      const resultado = validarProjetoRoteiro(valor);
      expect(resultado.valido, JSON.stringify(valor)).toBe(false);
      expect(resultado.problemas.some((p) => p.includes("nao e um objeto"))).toBe(true);
    }
  });

  it("id ausente ou vazio e rejeitado com regra id-vazio", () => {
    for (const id of ["", undefined]) {
      const resultado = validarProjetoRoteiro({ ...projetoBase(), id });
      expect(resultado.valido).toBe(false);
      expect(resultado.problemas.some((p) => p.includes("id-vazio"))).toBe(true);
    }
  });

  it("datas fora do formato ISO-8601 sao rejeitadas (criado_em e atualizado_em)", () => {
    const comCriacaoRuim = { ...projetoBase(), criado_em: "ontem" };
    const comAtualizacaoRuim = { ...projetoBase(), atualizado_em: "2026-08-14" };
    for (const projeto of [comCriacaoRuim, comAtualizacaoRuim]) {
      const resultado = validarProjetoRoteiro(projeto);
      expect(resultado.valido).toBe(false);
      expect(resultado.problemas.some((p) => p.includes("ISO-8601"))).toBe(true);
    }
  });

  it("brief invalido dentro do projeto aparece com prefixo (raiz).brief", () => {
    const resultado = validarProjetoRoteiro({ ...projetoBase(), brief: { tema: "" } });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.startsWith("(raiz).brief"))).toBe(true);
  });

  it("roteiro invalido dentro do projeto aparece com prefixo (raiz).roteiro", () => {
    const resultado = validarProjetoRoteiro({
      ...projetoBase(),
      roteiro: carregar("roteiro-duracao-total-errada.json"),
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.startsWith("(raiz).roteiro"))).toBe(true);
  });

  it("chave de pedacos_editados fora do formato p-[0-9]{3} e rejeitada", () => {
    const resultado = validarProjetoRoteiro({
      ...projetoBase(),
      pedacos_editados: { "xyz": { fala: "qualquer" } },
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes('pedacos_editados["xyz"]'))).toBe(true);
    expect(resultado.problemas.some((p) => p.includes("p-[0-9]{3}"))).toBe(true);
  });

  it("pedacos_editados que nao e objeto chaveado (string ou array) e rejeitado", () => {
    for (const editados of ["nao-objeto", [["p-000", {}]]]) {
      const resultado = validarProjetoRoteiro({ ...projetoBase(), pedacos_editados: editados });
      expect(resultado.valido).toBe(false);
      expect(resultado.problemas.some((p) => p.includes("deve ser um objeto chaveado"))).toBe(true);
    }
  });

  it("pedacos_editados AUSENTE e rejeitado (campo obrigatorio do projeto)", () => {
    const semCampo = projetoBase();
    delete semCampo.pedacos_editados;
    const resultado = validarProjetoRoteiro(semCampo);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("campo obrigatorio do projeto"))).toBe(true);
  });

  it("projeto sem roteiro (ainda nao gerado) VALIDA — roteiro e opcional", () => {
    const semRoteiro = projetoBase();
    delete semRoteiro.roteiro;
    const resultado = validarProjetoRoteiro(semRoteiro);
    expect(resultado.valido, resultado.problemas.join("; ")).toBe(true);
  });
});

// ─── F. Pedidos do gerador — versoes e semantica do pedaco_atual ──────────────

describe("pedidos do gerador — versoes invalidas no regenerar e semantica do pedaco_atual", () => {
  it("cada versao errada no PedidoRegenerarPedaco e rejeitada com regra versao-incompativel", () => {
    const regenerar = carregar("pedido-regenerar-valido.json") as Record<string, unknown>;
    for (const campo of ["versao_contrato", "versao_contrato_gerador", "versao_gerador"]) {
      const resultado = validarPedidoRegenerarPedaco({ ...regenerar, [campo]: "0.0.0-invalida" });
      expect(resultado.valido, `${campo}: ${resultado.problemas.join("; ")}`).toBe(false);
      expect(problemasDe(resultado.problemas, REGRA_VERSAO)).toBe(true);
      expect(resultado.problemas.some((p) => p.startsWith(`(raiz).${campo}`))).toBe(true);
    }
  });

  it("versao_gerador errada no PedidoGerarRoteiro e rejeitada (versao_contrato ja era testada)", () => {
    const gerar = carregar("pedido-gerar-valido.json") as Record<string, unknown>;
    const resultado = validarPedidoGerarRoteiro({ ...gerar, versao_gerador: "2.0.0" });
    expect(resultado.valido).toBe(false);
    expect(problemasDe(resultado.problemas, REGRA_VERSAO)).toBe(true);
  });

  it("pedaco_atual com semantica invalida e rejeitado com prefixo (raiz).pedaco_atual", () => {
    const regenerar = carregar("pedido-regenerar-valido.json") as Record<string, unknown>;
    const pedacoAtual = regenerar.pedaco_atual as Pedaco;

    // fala vazia com narracao gerada — o gerador nao pode receber um
    // pedaco que o proprio contrato rejeitaria (FQ-G4/FQ-C1).
    const semFala = {
      ...regenerar,
      pedaco_atual: {
        ...pedacoAtual,
        fala: "",
        narracao: { texto: "audio de um texto que sumiu", origem: "tts", status: "gerado" },
      },
    };
    const r1 = validarPedidoRegenerarPedaco(semFala);
    expect(r1.valido).toBe(false);
    expect(problemasDe(r1.problemas, REGRA_NARRACAO_FALA_VAZIA)).toBe(true);
    expect(r1.problemas.some((p) => p.startsWith("(raiz).pedaco_atual"))).toBe(true);

    // tipo_visual gif sem o par anexo_hash + anexo_meta (a emenda da Onda 2
    // tornou o PAR obrigatorio: regra anexo-exigido-para-gif-video).
    const r2 = validarPedidoRegenerarPedaco({
      ...regenerar,
      pedaco_atual: { ...pedacoAtual, tipo_visual: "gif" },
    });
    expect(r2.valido).toBe(false);
    expect(problemasDe(r2.problemas, REGRA_ANEXO_EXIGIDO)).toBe(true);
  });
});

// ─── G. Bordas do schema (FQ-C2 — o schema e o UNICO contrato) ────────────────

describe("bordas do schema — o que o contrato nao admite em nenhuma forma", () => {
  it("roteiro sem pedacos (minItems 1) e rejeitado", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const resultado = validarRoteiro({ ...roteiro, pedacos: [] });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("pedacos"))).toBe(true);
  });

  it("roteiro com mais de 40 pedacos (maxItems) e rejeitado", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const base = roteiro.pedacos[0]!;
    const quarentaEUm = Array.from({ length: 41 }, (_, i) => ({
      ...base,
      id: `p-${String(i).padStart(3, "0")}`,
      indice: i,
    }));
    const resultado = validarRoteiro({
      ...roteiro,
      pedacos: quarentaEUm,
      duracao_total_segundos: 41 * 4,
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("pedacos"))).toBe(true);
  });

  it("schema_version fora do contrato e rejeitado pelo const do schema", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const resultado = validarRoteiro({ ...roteiro, schema_version: "Roteiro.2" });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("schema_version"))).toBe(true);
  });

  it("duracao_total_segundos zero ou negativa e rejeitada (exclusiveMinimum)", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const base = roteiro.pedacos[0]!;
    // Sonda do keyword exclusiveMinimum: pedacos cuja soma (0.005) fica
    // DENTRO da tolerancia de zero — para total=0 nenhuma regra semantica
    // roda (|0 - 0.005| <= TOLERANCIA_DURACAO_TOTAL_SEGUNDOS) e a rejeicao
    // so pode vir do exclusiveMinimum do schema. Para total=-3 a regra
    // duracao-total-inconsistente (soma > 0) segue como reserva — negativo
    // nunca casa a soma de duracoes positivas, entao o pino do keyword so
    // existe no caso 0.
    const pedacos = [{ ...base, duracao_segundos: 0.005 }];
    for (const total of [0, -3]) {
      const resultado = validarRoteiro({
        ...roteiro,
        duracao_total_segundos: total,
        pedacos,
      });
      expect(resultado.valido, `total=${String(total)}`).toBe(false);
      expect(resultado.problemas.some((p) => p.includes("duracao_total_segundos"))).toBe(true);
    }
  });

  it("hash_audio fora do padrao ^[0-9a-f]{64}$ e rejeitado pelo schema", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const base = roteiro.pedacos[0]!;
    const resultado = validarRoteiro({
      ...roteiro,
      pedacos: [
        {
          ...base,
          fala: "texto narrado",
          narracao: { texto: "texto narrado", origem: "gravacao", hash_audio: "abc", status: "gerado" },
        },
      ],
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("hash_audio"))).toBe(true);
  });

  it("anexo_hash fora do padrao ^[0-9a-f]{64}$ e rejeitado pelo schema", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const base = roteiro.pedacos[0]!;
    // A emenda da Onda 2 exige o PAR (anexo_hash + anexo_meta) para
    // gif/video: com anexo_meta AUSENTE, a regra anexo-exigido-para-gif-video
    // cobre a rejeicao e o pattern do schema fica sem pino. Meta coerente +
    // duracao_total consistente = o UNICO problema e o padrao do hash: se o
    // pattern sumir do schema, este pedaco VALIDA.
    const resultado = validarRoteiro({
      ...roteiro,
      duracao_total_segundos: base.duracao_segundos,
      pedacos: [
        {
          ...base,
          tipo_visual: "gif",
          anexo_hash: "curto",
          anexo_meta: { tipo: "image/gif", tamanho_bytes: 1024, nome_original: "meme.gif" },
        },
      ],
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("anexo_hash"))).toBe(true);
  });

  it("narracao sem campo obrigatorio (status) e rejeitada pelo schema", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const base = roteiro.pedacos[0]!;
    // Sonda do keyword required:status. Com fala == "" a regra semantica
    // narracao-fala-vazia (status != "vazio") cobre a rejeicao e o required
    // fica sem pino. Com fala != "" e origem "tts", NENHUMA regra semantica
    // toca narracao.status undefined (validar.ts:153-203) — e com
    // duracao_total consistente a regra duracao-total-inconsistente tambem
    // nao roda. A rejeicao SO pode vir do schema: se `status` sumir do
    // required, este roteiro VALIDA e o teste FALHA.
    const resultado = validarRoteiro({
      ...roteiro,
      duracao_total_segundos: base.duracao_segundos,
      pedacos: [
        {
          ...base,
          fala: "texto narrado",
          narracao: { texto: "texto narrado", origem: "tts" },
        },
      ],
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("status"))).toBe(true);
  });

  it("duracao_alvo_segundos zero ou negativa no pedido e rejeitada", () => {
    const gerar = carregar("pedido-gerar-valido.json") as Record<string, unknown>;
    for (const alvo of [0, -5]) {
      const resultado = validarPedidoGerarRoteiro({ ...gerar, duracao_alvo_segundos: alvo });
      expect(resultado.valido, `alvo=${String(alvo)}`).toBe(false);
      expect(resultado.problemas.some((p) => p.includes("duracao_alvo_segundos"))).toBe(true);
    }
  });

  it("brief invalido dentro do pedido e rejeitado (o $ref do brief vale no pedido)", () => {
    const gerar = carregar("pedido-gerar-valido.json") as Record<string, unknown>;
    const resultado = validarPedidoGerarRoteiro({ ...gerar, brief: { tema: "" } });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("brief"))).toBe(true);
  });

  it("resumo_demais_pedacos vazio e pedaco_atual ausente no regenerar sao rejeitados", () => {
    const regenerar = carregar("pedido-regenerar-valido.json") as Record<string, unknown>;
    expect(validarPedidoRegenerarPedaco({ ...regenerar, resumo_demais_pedacos: "" }).valido).toBe(
      false,
    );

    const semPedacoAtual = { ...regenerar };
    delete semPedacoAtual.pedaco_atual;
    const resultado = validarPedidoRegenerarPedaco(semPedacoAtual);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("pedaco_atual"))).toBe(true);
  });
});

// ─── H. Round-trip edicao -> cache (C12/FQ-G3) ────────────────────────────────

describe("round-trip edicao -> PedidoRegenerarPedaco -> chave de cache (C12/FQ-G3)", () => {
  function pedidoPara(alvo: Pedaco, irmaos: readonly Pedaco[]): PedidoRegenerarPedaco {
    return {
      brief: { tema: "Como funciona um cache de computador" },
      duracao_alvo_segundos: 30,
      pedaco_atual: alvo,
      resumo_demais_pedacos: resumoDePedacos(irmaos),
      versao_contrato: VERSAO_CONTRATO_ROTEIRO,
      versao_contrato_gerador: VERSAO_CONTRATO_GERADOR,
      versao_gerador: VERSAO_GERADOR,
    };
  }

  it("a edicao do usuario (editarPedaco) MUDOU a chave do regenerar; a mesma edicao 2x = a mesma chave", () => {
    const roteiro = roteiroComNarracao();
    const alvo = roteiro.pedacos[1]!; // p-001, tts gerado
    const irmaos = roteiro.pedacos.filter((p) => p.id !== alvo.id);

    const pedidoOriginal = pedidoPara(alvo, irmaos);
    expect(validarPedidoRegenerarPedaco(pedidoOriginal).valido).toBe(true);

    const falaEditada = "Fala editada que entra na chave do gerador.";
    const editado = editarPedaco(alvo, { fala: falaEditada });
    expect(editado.narracao.status).toBe("editado");
    const pedidoEditado = pedidoPara(editado, irmaos);
    // O pedido montado com o pedaco editado continua VALIDO (a semantica
    // de narracao do pedido aceita editado com texto != fala).
    expect(validarPedidoRegenerarPedaco(pedidoEditado).valido, validarPedidoRegenerarPedaco(pedidoEditado).problemas.join("; ")).toBe(true);

    // A edicao e parte da chave (FQ-G3): editar mudou a saida, mudou a chave.
    expect(chaveDeCacheGerador(pedidoEditado)).not.toBe(chaveDeCacheGerador(pedidoOriginal));

    // Determinismo: refazer a MESMA edicao sobre um pedaco identico
    // (deep clone) produz a MESMA chave.
    const clone = JSON.parse(JSON.stringify(alvo)) as Pedaco;
    const editadoDeNovo = editarPedaco(clone, { fala: falaEditada });
    expect(chaveDeCacheGerador(pedidoPara(editadoDeNovo, irmaos))).toBe(
      chaveDeCacheGerador(pedidoEditado),
    );
  });

  it("editar um IRMAO muda o resumo_demais_pedacos e, com ele, a chave", () => {
    const roteiro = roteiroComNarracao();
    const alvo = roteiro.pedacos[1]!;
    const irmaos = roteiro.pedacos.filter((p) => p.id !== alvo.id);

    const pedido = pedidoPara(alvo, irmaos);
    const chave = chaveDeCacheGerador(pedido);

    const irmaoEditado = editarPedaco(irmaos[0]!, { titulo: "Irmao com titulo editado" });
    const irmaosComEdicao = irmaos.map((p) => (p.id === irmaoEditado.id ? irmaoEditado : p));
    expect(chaveDeCacheGerador(pedidoPara(alvo, irmaosComEdicao))).not.toBe(chave);
  });

  it("canonicalizar e estavel com chaves embaralhadas em PROFUNDIDADE (aninhado)", () => {
    const pedido = carregar("pedido-gerar-valido.json") as Record<string, unknown>;
    const chave = chaveDeCacheGerador(pedido as unknown as PedidoGerarRoteiro);

    const briefEmbaralhado = {
      duracao_alvo_segundos: (pedido.brief as Record<string, unknown>).duracao_alvo_segundos,
      tema: (pedido.brief as Record<string, unknown>).tema,
    };
    const embaralhado = { ...pedido, brief: briefEmbaralhado };
    expect(chaveDeCacheGerador(embaralhado as unknown as PedidoGerarRoteiro)).toBe(chave);
  });

  it("resumoDePedacos de lista vazia e deterministico (\"[]\")", () => {
    expect(resumoDePedacos([])).toBe("[]");
    expect(canonicalizar(null)).toBe("null");
  });

  it("aplicarEdicaoPedaco aplica as tres travas mesmo com delta ILEGAL tentando id/indice/narracao", () => {
    // aplicarEdicaoPedaco (a variante sem validacao) NUNCA deixa a edicao
    // tocar identidade nem estado de audio — e o que o contrato promete
    // em edicao.ts:27-40. O delta ilegal so chega aqui porque o chamador
    // passou por cima do schema (a variante Valida lancaria antes).
    const alvo = carregar("pedaco-valido.json") as Pedaco;
    const aplicado = aplicarEdicaoPedaco(alvo, {
      fala: "fala nova",
      id: "p-999",
      indice: 99,
      narracao: { texto: "hack", origem: "tts", status: "gerado" },
    } as unknown as EdicaoPedaco);
    expect(aplicado.id).toBe(alvo.id);
    expect(aplicado.indice).toBe(alvo.indice);
    expect(aplicado.narracao).toEqual(alvo.narracao);
    expect(aplicado.fala).toBe("fala nova");
  });
});
