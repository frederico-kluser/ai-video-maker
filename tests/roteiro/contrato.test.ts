/**
 * tests/roteiro/contrato.test.ts
 *
 * As perguntas falsificaveis do contrato de roteiro (TASK_PLAN FQ-C1..C4):
 *
 *   FQ-C1 — um Pedaco invalido (sem id, duracao <= 0, tipo_visual
 *           desconhecido, fala sem texto mas origem tts, campo extra) e
 *           REJEITADO com erro nomeado (ErroContratoRoteiro + regra)?
 *   FQ-C2 — o schema do pedaco e o UNICO contrato: QUALQUER campo fora
 *           do schema (additionalProperties:false) e rejeitado?
 *   FQ-C4 — o contrato de API (docs/roteiro/api.md) documenta TODAS as
 *           rotas que a SPA consome: todo metodo+path do documento existe
 *           como constante em rotas.ts, e toda constante esta no
 *           documento (nada inventado na Onda 5, nada esquecido na 4)?
 *   BONUS — round-trip validar(editar(validar)): roteiro de fixture
 *           valida, a edicao do usuario e preservada no shape do
 *           contrato (id/indice/narracao intocados) e o resultado
 *           continua valido.
 *
 * FQ-C3 (bump de versao invalida o cache) vive em cache.test.ts, no
 * formato da autoria (MUTACOES uma a uma — C12).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REGRA_ANEXO_EXIGIDO,
  REGRA_ANEXO_PROIBIDO,
  REGRA_ANEXO_TAMANHO,
  REGRA_ANEXO_TIPO,
  REGRA_DURACAO_TOTAL,
  REGRA_EDICAO_ANEXO_PROIBIDO,
  REGRA_EDITADO_SINCRONIZADO,
  REGRA_GERADO_DESSINCRONIZADO,
  REGRA_GERADO_SEM_ORIGEM,
  REGRA_GRAVACAO_SEM_HASH,
  REGRA_HASH_SEM_GRAVACAO,
  REGRA_ID_INDICE,
  REGRA_IDS_DUPLICADOS,
  REGRA_INDICES,
  REGRA_JUNTAR_FALA_SEM_NARRACAO,
  REGRA_NARRACAO_FALA_VAZIA,
  REGRA_STATUS_VAZIO,
  REGRA_VERSAO,
  validarBriefRoteiro,
  validarEdicaoPedaco,
  validarPedaco,
  validarPedidoGerarRoteiro,
  validarPedidoRegenerarPedaco,
  validarProjetoRoteiro,
  validarRoteiro,
  verificarJuntarFalaSemNarracao,
} from "../../src/roteiro/contrato/validar.js";
import {
  ErroContratoRoteiro,
  rejeitarPedacoInvalido,
  rejeitarRoteiroInvalido,
} from "../../src/roteiro/contrato/rejeitar.js";
import { ROTAS_API } from "../../src/roteiro/contrato/rotas.js";
import { editarPedaco } from "../../src/roteiro/contrato/edicao.js";
import { resumoDePedacos } from "../../src/roteiro/contrato/canonicalizar.js";
import {
  ANEXO_TAMANHO_MAXIMO_BYTES,
  type Pedaco,
  type Roteiro,
} from "../../src/roteiro/contrato/contrato.js";

const FIXTURES = join(__dirname, "fixtures");

function carregar(nome: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as unknown;
}

function pedacoBase(): Pedaco {
  return carregar("pedaco-valido.json") as Pedaco;
}

function problemasDe(problemas: string[], regra: string): boolean {
  return problemas.some((p) => p.includes(regra));
}

describe("FQ-C1 — pedaco invalido e REJEITADO com erro nomeado", () => {
  it("aceita as fixtures validas (pedaco, roteiro recem-gerado, roteiro com narracao)", () => {
    const pedaco = validarPedaco(carregar("pedaco-valido.json"));
    expect(pedaco.valido, pedaco.problemas.join("; ")).toBe(true);
    expect(pedaco.problemas).toEqual([]);

    const recemGerado = validarRoteiro(carregar("roteiro-valido.json"));
    expect(recemGerado.valido, recemGerado.problemas.join("; ")).toBe(true);

    const comNarracao = validarRoteiro(carregar("roteiro-com-narracao.json"));
    expect(comNarracao.valido, comNarracao.problemas.join("; ")).toBe(true);
  });

  const PEDACOS_INVALIDOS: Array<[string, string]> = [
    ["pedaco-sem-id.json", "sem id"],
    ["pedaco-duracao-zero.json", "duracao 0"],
    ["pedaco-duracao-negativa.json", "duracao negativa"],
    ["pedaco-tipo-visual-desconhecido.json", "tipo_visual fora do vocabulario"],
    ["pedaco-fala-vazia-origem-tts.json", "fala vazia com origem tts"],
    ["pedaco-campo-extra.json", "campo fora do schema (FQ-C2)"],
  ];

  for (const [nome, descricao] of PEDACOS_INVALIDOS) {
    it(`rejeita o pedaco invalido ${nome} (${descricao})`, () => {
      const resultado = validarPedaco(carregar(nome));
      expect(resultado.valido, `esperado invalido: ${descricao}`).toBe(false);
      expect(resultado.problemas.length).toBeGreaterThan(0);
    });
  }

  it("rejeitarPedacoInvalido lanca o ERRO NOMEADO com os problemas", () => {
    expect(() => rejeitarPedacoInvalido(carregar("pedaco-fala-vazia-origem-tts.json"))).toThrow(
      ErroContratoRoteiro,
    );
    let capturado: ErroContratoRoteiro | null = null;
    try {
      rejeitarPedacoInvalido(carregar("pedaco-fala-vazia-origem-tts.json"));
    } catch (e) {
      capturado = e as ErroContratoRoteiro;
    }
    expect(capturado?.name).toBe("ErroContratoRoteiro");
    expect(problemasDe(capturado?.problemas ?? [], REGRA_NARRACAO_FALA_VAZIA)).toBe(true);
  });

  it("rejeita roteiro com pedaco de duracao 0 mesmo com shape valido", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const estragado = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((p, i) => (i === 1 ? { ...p, duracao_segundos: 0 } : p)),
    };
    const resultado = validarRoteiro(estragado);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.some((p) => p.includes("duracao_segundos"))).toBe(true);
  });

  // ── Matriz das regras de narracao (mutacoes sobre o pedaco valido) ──
  const MUTACOES_NARRACAO: Array<[string, (p: Pedaco) => Pedaco, string]> = [
    [
      "fala vazia com narracao gerada",
      (p) => ({ ...p, fala: "", narracao: { texto: "x", origem: "tts", status: "gerado" } }),
      REGRA_NARRACAO_FALA_VAZIA,
    ],
    [
      "origem gravacao sem hash_audio",
      (p) => ({ ...p, narracao: { texto: p.fala, origem: "gravacao", status: "gerado" } }),
      REGRA_GRAVACAO_SEM_HASH,
    ],
    [
      "origem tts com hash_audio",
      (p) => ({
        ...p,
        narracao: {
          texto: p.fala,
          origem: "tts",
          hash_audio: "9f8e7d6c5b4a39281706f5e4d3c2b1a0ffeeddccbbaa99887766554433221100",
          status: "gerado",
        },
      }),
      REGRA_HASH_SEM_GRAVACAO,
    ],
    [
      "status vazio com origem tts",
      (p) => ({ ...p, narracao: { texto: p.fala, origem: "tts", status: "vazio" } }),
      REGRA_STATUS_VAZIO,
    ],
    [
      "status gerado sem origem real",
      (p) => ({ ...p, narracao: { texto: p.fala, origem: "nenhuma", status: "gerado" } }),
      REGRA_GERADO_SEM_ORIGEM,
    ],
    [
      "status gerado com texto divergente da fala (dessincronizado)",
      (p) => ({ ...p, narracao: { texto: "outro texto", origem: "tts", status: "gerado" } }),
      REGRA_GERADO_DESSINCRONIZADO,
    ],
    [
      "status editado com texto igual a fala (nada stale)",
      (p) => ({ ...p, narracao: { texto: p.fala, origem: "tts", status: "editado" } }),
      REGRA_EDITADO_SINCRONIZADO,
    ],
    [
      "tipo_visual gif sem anexo (regra anexo-exigido-para-gif-video)",
      (p) => ({ ...p, tipo_visual: "gif" }),
      REGRA_ANEXO_EXIGIDO,
    ],
    [
      "anexo_hash em pedaco de texto (anexo fora de lugar — anexo-proibido-outros)",
      (p) => ({
        ...p,
        tipo_visual: "texto",
        anexo_hash: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      }),
      REGRA_ANEXO_PROIBIDO,
    ],
  ];

  for (const [nome, mutar, regra] of MUTACOES_NARRACAO) {
    it(`rejeita com regra nomeada: ${nome}`, () => {
      const resultado = validarPedaco(mutar(pedacoBase()));
      expect(resultado.valido, resultado.problemas.join("; ")).toBe(false);
      expect(problemasDe(resultado.problemas, regra), resultado.problemas.join("; ")).toBe(true);
    });
  }

  // ── Matriz das regras de ANEXO (emendas da Onda 2: anexo do usuario) ──
  const PEDACOS_ANEXO_INVALIDOS: Array<[string, string, string]> = [
    [
      "pedaco-anexo-sem-anexo.json",
      "tipo_visual gif sem anexo_hash/anexo_meta",
      REGRA_ANEXO_EXIGIDO,
    ],
    [
      "pedaco-anexo-tipo-visual-texto.json",
      "anexo em pedaco de texto",
      REGRA_ANEXO_PROIBIDO,
    ],
    [
      "pedaco-anexo-tipo-invalido.json",
      "anexo_meta.tipo fora da allowlist",
      REGRA_ANEXO_TIPO,
    ],
    [
      "pedaco-anexo-tamanho-excedido.json",
      "anexo_meta.tamanho_bytes acima do limite",
      REGRA_ANEXO_TAMANHO,
    ],
  ];

  for (const [nome, descricao, regra] of PEDACOS_ANEXO_INVALIDOS) {
    it(`rejeita ${descricao} (${nome})`, () => {
      const resultado = validarPedaco(carregar(nome));
      expect(resultado.valido, resultado.problemas.join("; ")).toBe(false);
      expect(problemasDe(resultado.problemas, regra), resultado.problemas.join("; ")).toBe(true);
    });
  }

  it("aceita o pedaco com anexo valido (gif + hash + meta) e rejeita o par incompleto", () => {
    const comAnexo = validarPedaco(carregar("pedaco-com-anexo.json"));
    expect(comAnexo.valido, comAnexo.problemas.join("; ")).toBe(true);

    // anexo_hash sem anexo_meta (ou vice-versa) e par incompleto — a regra
    // anexo-exigido-para-gif-video exige os dois juntos.
    const pedaco = carregar("pedaco-com-anexo.json") as Pedaco;
    const soHash = { ...pedaco, anexo_meta: undefined };
    expect(problemasDe(validarPedaco(soHash).problemas, REGRA_ANEXO_EXIGIDO)).toBe(true);
    const soMeta = { ...pedaco, anexo_hash: undefined };
    expect(problemasDe(validarPedaco(soMeta).problemas, REGRA_ANEXO_EXIGIDO)).toBe(true);
  });

  it("o limite de tamanho do anexo e a constante nomeada (limite - 1 passa, limite + 1 falha)", () => {
    const pedaco = carregar("pedaco-com-anexo.json") as Pedaco;
    const noLimite = {
      ...pedaco,
      anexo_meta: { ...pedaco.anexo_meta!, tamanho_bytes: ANEXO_TAMANHO_MAXIMO_BYTES },
    };
    expect(validarPedaco(noLimite).valido, validarPedaco(noLimite).problemas.join("; ")).toBe(true);

    const acima = {
      ...pedaco,
      anexo_meta: { ...pedaco.anexo_meta!, tamanho_bytes: ANEXO_TAMANHO_MAXIMO_BYTES + 1 },
    };
    expect(problemasDe(validarPedaco(acima).problemas, REGRA_ANEXO_TAMANHO)).toBe(true);
  });

  it("EdicaoPedaco com anexo_hash/anexo_meta e rejeitada com regra edicao-anexo-proibido", () => {
    const comHash = validarEdicaoPedaco({
      fala: "ok",
      anexo_hash: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    });
    expect(comHash.valido).toBe(false);
    expect(problemasDe(comHash.problemas, REGRA_EDICAO_ANEXO_PROIBIDO)).toBe(true);

    const comMeta = validarEdicaoPedaco({
      titulo: "x",
      anexo_meta: { tipo: "image/gif", tamanho_bytes: 100, nome_original: "x.gif" },
    });
    expect(comMeta.valido).toBe(false);
    expect(problemasDe(comMeta.problemas, REGRA_EDICAO_ANEXO_PROIBIDO)).toBe(true);
  });

  // ── Semantica do roteiro (indices, ids, duracao total) ──
  const ROTEIROS_INVALIDOS: Array<[string, string, string]> = [
    ["roteiro-indices-nao-contiguos.json", "indices nao contiguos", REGRA_INDICES],
    ["roteiro-ids-duplicados.json", "ids duplicados", REGRA_IDS_DUPLICADOS],
    ["roteiro-duracao-total-errada.json", "duracao total != soma", REGRA_DURACAO_TOTAL],
  ];

  for (const [nome, descricao, regra] of ROTEIROS_INVALIDOS) {
    it(`rejeita ${descricao} (${nome})`, () => {
      const resultado = validarRoteiro(carregar(nome));
      expect(resultado.valido, resultado.problemas.join("; ")).toBe(false);
      expect(problemasDe(resultado.problemas, regra), resultado.problemas.join("; ")).toBe(true);
    });
  }

  it("rejeita id cujo sufixo nao casa o indice", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const estragado = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((p, i) => (i === 1 ? { ...p, id: "p-099" } : p)),
    };
    const resultado = validarRoteiro(estragado);
    expect(resultado.valido).toBe(false);
    expect(problemasDe(resultado.problemas, REGRA_ID_INDICE)).toBe(true);
  });

  it("rejeitarRoteiroInvalido lanca o erro nomeado", () => {
    expect(() => rejeitarRoteiroInvalido(carregar("roteiro-duracao-total-errada.json"))).toThrow(
      ErroContratoRoteiro,
    );
  });

  it("brief sem tema e rejeitado; brief valido passa", () => {
    const invalido = validarBriefRoteiro(carregar("brief-invalido-sem-tema.json"));
    expect(invalido.valido).toBe(false);
    expect(invalido.problemas.some((p) => p.includes("tema"))).toBe(true);

    const valido = validarBriefRoteiro(carregar("brief-valido.json"));
    expect(valido.valido, valido.problemas.join("; ")).toBe(true);
  });

  it("pedido sem versao_contrato e rejeitado pelo schema", () => {
    const pedido = carregar("pedido-gerar-valido.json") as Record<string, unknown>;
    const semVersao = { ...pedido };
    delete semVersao.versao_contrato;
    const resultado = validarPedidoGerarRoteiro(semVersao);
    expect(resultado.valido).toBe(false);
  });

  it("pedido com versao desconhecida e rejeitado com regra versao-incompativel (FQ-C3 no contrato)", () => {
    const pedido = carregar("pedido-gerar-valido.json") as Record<string, unknown>;
    const resultado = validarPedidoGerarRoteiro({ ...pedido, versao_contrato: "Roteiro.99" });
    expect(resultado.valido).toBe(false);
    expect(problemasDe(resultado.problemas, REGRA_VERSAO)).toBe(true);
  });

  it("aceita os pedidos validos do gerador", () => {
    const gerar = validarPedidoGerarRoteiro(carregar("pedido-gerar-valido.json"));
    expect(gerar.valido, gerar.problemas.join("; ")).toBe(true);

    const regenerar = validarPedidoRegenerarPedaco(carregar("pedido-regenerar-valido.json"));
    expect(regenerar.valido, regenerar.problemas.join("; ")).toBe(true);
  });
});

describe("emenda — record-first (juntar-fala-sem-narracao) e travas de anexo na edicao", () => {
  it("o gate de juntar lista os pedacos com fala nao narrada (record-first: nunca entrega fala muda)", () => {
    // roteiro-valido.json e o estado NORMAL recem-gerado: fala != "" com
    // origem "nenhuma" — o pedaco e VALIDO (validarRoteiro passa), so nao
    // e juntavel. O oraculo negativo do e2e e o gate, nao a validacao.
    const recemGerado = carregar("roteiro-valido.json") as Roteiro;
    expect(validarRoteiro(recemGerado).valido).toBe(true);

    const bloqueados = verificarJuntarFalaSemNarracao(recemGerado);
    expect(bloqueados.length).toBe(2); // p-001 e p-002 tem fala; p-000 e cabecalho sem fala
    expect(problemasDe(bloqueados, REGRA_JUNTAR_FALA_SEM_NARRACAO)).toBe(true);
    expect(bloqueados.some((p) => p.includes("p-001"))).toBe(true);
    expect(bloqueados.some((p) => p.includes("p-002"))).toBe(true);
    expect(bloqueados.some((p) => p.includes("p-000"))).toBe(false);
  });

  it("o gate de juntar passa quando toda fala tem narracao (tts/gravacao)", () => {
    const comNarracao = carregar("roteiro-com-narracao.json") as Roteiro;
    const bloqueados = verificarJuntarFalaSemNarracao(comNarracao);
    expect(bloqueados).toEqual([]);
  });

  it("pedaco com anexo: edicao de texto NAO mexe anexo_hash/anexo_meta (trava)", () => {
    const comAnexo = carregar("pedaco-com-anexo.json") as Pedaco;
    const editado = editarPedaco(comAnexo, { titulo: "Titulo novo" });
    expect(editado.titulo).toBe("Titulo novo");
    expect(editado.anexo_hash).toBe(comAnexo.anexo_hash);
    expect(editado.anexo_meta).toEqual(comAnexo.anexo_meta);
    expect(validarPedaco(editado).valido, validarPedaco(editado).problemas.join("; ")).toBe(true);
  });

  it("edicao de fala em pedaco COM anexo e valida (anexo preservado pela trava)", () => {
    const comAnexo = carregar("pedaco-com-anexo.json") as Pedaco;
    const editado = editarPedaco(comAnexo, { fala: "Nova fala do pedaco com anexo." });
    expect(editado.fala).toBe("Nova fala do pedaco com anexo.");
    expect(editado.anexo_hash).toBe(comAnexo.anexo_hash);
    expect(validarPedaco(editado).valido, validarPedaco(editado).problemas.join("; ")).toBe(true);
  });

  it("roteiro com pedaco de anexo valida como roteiro completo", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const comAnexo = carregar("pedaco-com-anexo.json") as Pedaco;
    // Reenumera o pedaco anexado (o fixture e p-002; no roteiro ele vira
    // p-003 — indices contiguos 0..n-1 e id casando o indice).
    const anexoReenumerado = { ...comAnexo, id: "p-003", indice: 3 };
    const comPedacoDeAnexo = {
      ...roteiro,
      duracao_total_segundos: roteiro.duracao_total_segundos + comAnexo.duracao_segundos,
      pedacos: [...roteiro.pedacos, anexoReenumerado],
    };
    const resultado = validarRoteiro(comPedacoDeAnexo);
    expect(resultado.valido, resultado.problemas.join("; ")).toBe(true);
  });
});

describe("FQ-C2 — o schema e o UNICO contrato: qualquer campo fora do schema e rejeitado", () => {
  it("campo extra no pedaco e rejeitado nomeando o campo", () => {
    const resultado = validarPedaco(carregar("pedaco-campo-extra.json"));
    expect(resultado.valido).toBe(false);
    expect(problemasDe(resultado.problemas, "cor")).toBe(true);
    // O Ajv escreve "must NOT have additional properties" (com espaco) —
    // a assercao casa o parametro additionalProperty ("cor") e o keyword.
    expect(resultado.problemas.some((p) => p.includes("additional"))).toBe(true);
  });

  it("campo extra em cada nivel do roteiro e rejeitado", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const casos: Array<[string, unknown]> = [
      ["na raiz", { ...roteiro, autor: "quem?" }],
      [
        "no pedaco",
        { ...roteiro, pedacos: [{ ...roteiro.pedacos[0]!, cor_de_fundo: "#000" }] },
      ],
      [
        "na narracao",
        {
          ...roteiro,
          pedacos: [
            {
              ...roteiro.pedacos[0]!,
              narracao: { ...roteiro.pedacos[0]!.narracao, ganho_db: 2 },
            },
          ],
        },
      ],
    ];
    for (const [nivel, valor] of casos) {
      const resultado = validarRoteiro(valor);
      expect(resultado.valido, `${nivel}: ${resultado.problemas.join("; ")}`).toBe(false);
    }
  });

  it("campo extra no brief e na edicao e rejeitado", () => {
    const brief = carregar("brief-valido.json") as Record<string, unknown>;
    expect(validarBriefRoteiro({ ...brief, emoji: "🚀" }).valido).toBe(false);

    const edicao = { fala: "ok", duracao_em_frames: 90 };
    const resultado = validarEdicaoPedaco(edicao);
    expect(resultado.valido).toBe(false);
    expect(problemasDe(resultado.problemas, "duracao_em_frames")).toBe(true);
  });

  it("o pedaco.schema.json referencia o roteiro.schema.json (alias compila e valida)", () => {
    // validarPedaco compila pedaco.schema.json; se o $ref quebrasse, o
    // Ajv lancaria na compilacao e este teste ficaria vermelho na hora.
    const valido = validarPedaco(carregar("pedaco-valido.json"));
    expect(valido.valido).toBe(true);
    const comExtra = validarPedaco(carregar("pedaco-campo-extra.json"));
    expect(comExtra.valido).toBe(false);
  });
});

describe("FQ-C4 — docs/roteiro/api.md x rotas.ts (a SPA nada inventa, o servidor nada esquece)", () => {
  const API_MD = readFileSync(
    join(__dirname, "..", "..", "docs", "roteiro", "api.md"),
    "utf-8",
  );

  function rotasDoDocumento(): string[] {
    // A secao "Rotas — lista canonica": linhas METODO path dentro do
    // bloco ```http. O restante do documento e livre (prosa, exemplos).
    const secao = API_MD.split("## Rotas — lista canonica")[1]?.split("## ")[0] ?? "";
    const dentroDoBloco = secao.split("```http")[1] ?? "";
    return dentroDoBloco
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^(GET|POST|PUT|PATCH|DELETE)\s+\S+$/.test(l))
      .map((l) => l.replace(/\s+/, " "));
  }

  it("o parser NAO pode casar zero rotas (denominador — falso verde C2)", () => {
    // Sem esta sonda, um parser quebrado que extrai lista vazia faria os
    // dois testes de cruzamento passarem de primeira.
    expect(rotasDoDocumento().length).toBeGreaterThan(0);
    expect(Object.values(ROTAS_API).length).toBeGreaterThan(0);
  });

  it("todo metodo+path documentado existe como constante em rotas.ts", () => {
    const constantes = new Set(Object.values(ROTAS_API));
    const ausentes = rotasDoDocumento().filter((rota) => !constantes.has(rota as never));
    expect(ausentes, `rotas no documento sem constante: ${ausentes.join(", ")}`).toEqual([]);
  });

  it("toda constante de rotas.ts esta documentada no api.md", () => {
    const documentadas = new Set(rotasDoDocumento());
    const esquecidas = Object.values(ROTAS_API).filter((rota) => !documentadas.has(rota));
    expect(esquecidas, `constantes sem rota no documento: ${esquecidas.join(", ")}`).toEqual([]);
  });

  it("a porta declarada no contrato (4610, S-9) aparece no api.md", () => {
    expect(API_MD).toContain("4610");
  });
});

describe("bonus — round-trip validar(editar(validar)): a edicao do usuario sobrevive no shape do contrato", () => {
  it("edicao de fala e titulo e preservada; id/indice/origem(intocados) e o roteiro revalida", () => {
    // Usa o roteiro com narracao: editar a fala de um pedaco JA narrado
    // (tts, status gerado) marca a narracao como stale.
    const roteiro = carregar("roteiro-com-narracao.json") as Roteiro;
    expect(validarRoteiro(roteiro).valido).toBe(true);

    const alvo = roteiro.pedacos[1]!;
    expect(alvo.narracao.status).toBe("gerado");
    const editado = editarPedaco(alvo, {
      fala: "Um cache guarda o resultado de uma conta para nao refaze-la, ja com a edicao do usuario.",
      titulo: "O que e um cache (editado)",
    });

    // A edicao chegou...
    expect(editado.fala).toContain("ja com a edicao do usuario");
    expect(editado.titulo).toBe("O que e um cache (editado)");
    // ...e a identidade e a origem ficaram intocados.
    expect(editado.id).toBe(alvo.id);
    expect(editado.indice).toBe(alvo.indice);
    expect(editado.narracao.origem).toBe(alvo.narracao.origem);
    // A narracao ficou stale por regra: status "editado" (a fala mudou) e
    // `narracao.texto` continua apontando para o texto antigo.
    expect(editado.narracao.status).toBe("editado");
    expect(editado.narracao.texto).toBe(alvo.narracao.texto);

    // Round-trip: roteiro com o pedaco editado continua VALIDO.
    const roteiroEditado = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((p) => (p.id === alvo.id ? editado : p)),
    };
    const resultado = validarRoteiro(roteiroEditado);
    expect(resultado.valido, resultado.problemas.join("; ")).toBe(true);
  });

  it("editar a fala de um pedaco nunca narrado NAO marca stale (status continua vazio)", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const alvo = roteiro.pedacos[1]!;
    expect(alvo.narracao.status).toBe("vazio");

    const editado = editarPedaco(alvo, { fala: "Fala nova de um pedaco que nunca foi narrado." });
    expect(editado.fala).toBe("Fala nova de um pedaco que nunca foi narrado.");
    expect(editado.narracao.status).toBe("vazio");
    expect(editado.narracao.origem).toBe("nenhuma");

    const roteiroEditado = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((p) => (p.id === alvo.id ? editado : p)),
    };
    expect(validarRoteiro(roteiroEditado).valido).toBe(true);
  });

  it("apagar a fala de um pedaco narrado limpa a narracao (volta a vazio)", () => {
    const roteiro = carregar("roteiro-com-narracao.json") as Roteiro;
    const alvo = roteiro.pedacos[1]!; // tts, gerado
    const editado = editarPedaco(alvo, { fala: "" });

    expect(editado.fala).toBe("");
    expect(editado.narracao).toEqual({ texto: "", origem: "nenhuma", status: "vazio" });
    expect(editado.narracao.hash_audio).toBeUndefined();

    const roteiroEditado = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((p) => (p.id === alvo.id ? editado : p)),
    };
    expect(validarRoteiro(roteiroEditado).valido).toBe(true);
  });

  it("edicao que nao toca a fala nao marca a narracao", () => {
    const alvo = pedacoBase();
    const editado = editarPedaco(alvo, { titulo: "So o titulo" });
    expect(editado.titulo).toBe("So o titulo");
    expect(editado.narracao.status).toBe(alvo.narracao.status);
    expect(validarPedaco(editado).valido).toBe(true);
  });

  it("edicao invalida e rejeitada (nunca merge silencioso)", () => {
    const alvo = pedacoBase();
    expect(() => editarPedaco(alvo, { duracao_segundos: -1 })).toThrow(ErroContratoRoteiro);
  });

  it("resumoDePedacos e deterministico: mesmo estado dos irmaos, mesma string; mudanca = outra string", () => {
    const roteiro = carregar("roteiro-valido.json") as Roteiro;
    const irmaos = roteiro.pedacos.slice(1);
    const primeiro = resumoDePedacos(irmaos);
    const segundo = resumoDePedacos(irmaos);
    expect(primeiro).toBe(segundo);

    const mudado = resumoDePedacos(
      irmaos.map((p, i) => (i === 0 ? { ...p, titulo: "titulo diferente" } : p)),
    );
    expect(mudado).not.toBe(primeiro);
  });

  it("validarProjetoRoteiro aceita um projeto persistido e rejeita edicao orfa invalida", () => {
    const projeto = {
      id: "proj-001",
      brief: carregar("brief-valido.json"),
      roteiro: carregar("roteiro-valido.json"),
      pedacos_editados: {
        "p-001": { fala: "fala editada", titulo: "novo titulo" },
      },
      criado_em: "2026-08-14T10:00:00.000Z",
      atualizado_em: "2026-08-14T10:05:00.000Z",
    };
    const ok = validarProjetoRoteiro(projeto);
    expect(ok.valido, ok.problemas.join("; ")).toBe(true);

    const comEdicaoRuim = {
      ...projeto,
      pedacos_editados: { "p-001": { duracao_segundos: 0 } },
    };
    const ruim = validarProjetoRoteiro(comEdicaoRuim);
    expect(ruim.valido).toBe(false);
  });
});
