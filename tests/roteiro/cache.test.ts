/**
 * tests/roteiro/cache.test.ts
 *
 * FQ-C3: "bump de versao do contrato invalida o cache (mesma entrada,
 * chave diferente)" — no formato da autoria (tests/autoria/contrato/
 * cache.test.ts): mutacoes UMA A UMA sobre a entrada, exigindo chave
 * diferente (C12 — a chave inclui tudo que muda a saida).
 *
 * A chave e sha256(canonical_json(pedido)) (cache.ts). O store do cache
 * (disco, atomico S-8) e do gerador da Onda 2 — este teste cobre a
 * DERIVACAO da chave, que e contrato.
 */

import { describe, expect, it } from "vitest";
import { chaveDeCacheGerador } from "../../src/roteiro/contrato/cache.js";
import type {
  EntradaGeradorRoteiro,
  Pedaco,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
} from "../../src/roteiro/contrato/contrato.js";

function pedidoGerar(sobrescrita: Partial<PedidoGerarRoteiro> = {}): PedidoGerarRoteiro {
  return {
    brief: {
      tema: "Como funciona um cache de computador",
      contexto: "Video para iniciantes",
    },
    duracao_alvo_segundos: 30,
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

function pedaco(): Pedaco {
  return {
    id: "p-001",
    indice: 1,
    titulo: "O que e um cache",
    fala: "Um cache guarda o resultado de uma conta para nao refaze-la.",
    duracao_segundos: 12.5,
    tipo_visual: "manim",
    especificacao_visual: "Animacao 3b1b com shapes",
    detalhes_de_producao: "Cena Manim via estagio grafico",
    narracao: { texto: "", origem: "nenhuma", status: "vazio" },
  };
}

function pedidoRegenerar(
  sobrescrita: Partial<PedidoRegenerarPedaco> = {},
): PedidoRegenerarPedaco {
  return {
    brief: { tema: "Como funciona um cache de computador" },
    duracao_alvo_segundos: 30,
    pedaco_atual: pedaco(),
    resumo_demais_pedacos: "[{\"id\":\"p-000\"},{\"id\":\"p-002\"}]",
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

describe("FQ-C3 — bump de versao do contrato invalida o cache do gerador", () => {
  const MUTACOES: Array<[string, Partial<PedidoGerarRoteiro>]> = [
    ["brief.tema", { brief: { ...pedidoGerar().brief, tema: "Outro tema" } }],
    [
      "brief.contexto",
      { brief: { ...pedidoGerar().brief, contexto: "Outro contexto" } },
    ],
    ["duracao_alvo_segundos", { duracao_alvo_segundos: 60 }],
    ["versao_contrato (bump do contrato = MISS)", { versao_contrato: "Roteiro.2" }],
    ["versao_contrato_gerador (bump do contrato do gerador = MISS)", { versao_contrato_gerador: "1.1.0" }],
    ["versao_gerador (bump da implementacao = MISS)", { versao_gerador: "1.1.0" }],
  ];

  for (const [nome, mutacao] of MUTACOES) {
    it(`mudar ${nome} produz chave diferente (mesma entrada, MISS)`, () => {
      const base = pedidoGerar();
      const mutada = pedidoGerar(mutacao);
      expect(chaveDeCacheGerador(base)).not.toBe(chaveDeCacheGerador(mutada));
    });
  }

  it("a mesma entrada produz SEMPRE a mesma chave (canonica, independente de ordem de chaves)", () => {
    const base = pedidoGerar();
    const chave = chaveDeCacheGerador(base);
    const bagunçado = {
      versao_gerador: base.versao_gerador,
      brief: base.brief,
      duracao_alvo_segundos: base.duracao_alvo_segundos,
      versao_contrato: base.versao_contrato,
      versao_contrato_gerador: base.versao_contrato_gerador,
    } as PedidoGerarRoteiro;
    expect(chaveDeCacheGerador(bagunçado)).toBe(chave);
  });

  it("regenerar um pedaco: mudanca no pedaco_atual muda a chave; mudanca nos irmaos (resumo) muda a chave", () => {
    const base = pedidoRegenerar();
    const chave = chaveDeCacheGerador(base);

    const falaEditada: PedidoRegenerarPedaco = {
      ...base,
      pedaco_atual: { ...base.pedaco_atual, fala: "Fala editada pelo usuario." },
    };
    expect(chaveDeCacheGerador(falaEditada)).not.toBe(chave);

    const irmaoMudou: PedidoRegenerarPedaco = {
      ...base,
      resumo_demais_pedacos: "[{\"id\":\"p-000\",\"titulo\":\"mudou\"},{\"id\":\"p-002\"}]",
    };
    expect(chaveDeCacheGerador(irmaoMudou)).not.toBe(chave);
  });

  it("o pedido de gerar e o de regenerar sao entradas distintas (chaves distintas)", () => {
    const gerar = chaveDeCacheGerador(pedidoGerar() as EntradaGeradorRoteiro);
    const regenerar = chaveDeCacheGerador(pedidoRegenerar());
    expect(gerar).not.toBe(regenerar);
  });
});
