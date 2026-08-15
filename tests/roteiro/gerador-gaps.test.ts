/**
 * tests/roteiro/gerador-gaps.test.ts
 *
 * Gaps de cobertura de src/roteiro/gerador/gerador.ts e a INTEGRACAO
 * gerador -> contrato (a saida do gerador SEMPRE valida contra o schema
 * completo — nao so nos casos felizes do trio do gate):
 *
 *   GATE DO PEDIDO (FQ-C1 em processo):
 *     - gerarRoteiro com versao errada / tema vazio / duracao 0 ->
 *       ErroContratoRoteiro ANTES de qualquer chamada ao provedor
 *       (sonda: contador de chamadas fica em zero);
 *     - regenerarPedaco com resumo vazio / id que nao casa o indice ->
 *       ErroContratoRoteiro nomeado.
 *
 *   GATE DA SAIDA:
 *     - saida do provedor que e objeto SEM o array pedacos (ou com
 *       pedacos: []) -> rejeitada pelo gate, nunca aceita em silencio.
 *
 *   CACHE:
 *     - gerarRoteiro SEM a opcao diretorioCache usa o diretorio corrente
 *       do modulo (o default) — o arquivo aparece la.
 *
 *   INTEGRACAO gerador -> contrato (propriedade):
 *     - N briefs variados (duracoes 0.5..600, temas com acento e emoji):
 *       gerarRoteiro devolve roteiro que VALIDA; regenerarPedaco devolve
 *       pedaco que VALIDA; ids/indices preservados; duracao_total == soma
 *       das duracoes dentro da tolerancia do contrato (0.01s).
 */

import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resumoDePedacos } from "../../src/roteiro/contrato/canonicalizar.js";
import type { PedidoGerarRoteiro, PedidoRegenerarPedaco } from "../../src/roteiro/contrato/contrato.js";
import { ErroContratoRoteiro } from "../../src/roteiro/contrato/rejeitar.js";
import { validarPedaco, validarRoteiro } from "../../src/roteiro/contrato/validar.js";
import { definirDiretorioCache } from "../../src/roteiro/gerador/cache.js";
import { gerarRoteiro, regenerarPedaco } from "../../src/roteiro/gerador/gerador.js";
import { ProvedorSosiaRoteiro } from "../../src/roteiro/gerador/provedor.js";
import type { ProvedorRoteiro } from "../../src/roteiro/gerador/provedor.js";

function cacheTmp(): string {
  return mkdtempSync(join(tmpdir(), "roteiro-gaps-cache-"));
}

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

function pedidoRegenerar(
  sobrescrita: Partial<PedidoRegenerarPedaco> = {},
): PedidoRegenerarPedaco {
  return {
    brief: { tema: "Como funciona um cache de computador" },
    duracao_alvo_segundos: 30,
    pedaco_atual: {
      id: "p-001",
      indice: 1,
      titulo: "O que e um cache",
      fala: "Um cache guarda o resultado de uma conta para nao refaze-la.",
      duracao_segundos: 12.5,
      tipo_visual: "manim",
      especificacao_visual: "Animacao estilo 3b1b com shapes",
      detalhes_de_producao: "Cena Manim via estagio grafico",
      narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    },
    resumo_demais_pedacos: resumoDePedacos([{ id: "p-000" }, { id: "p-002" }]),
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

/** Um provedor com sonda de chamadas (a prova de que o gate do pedido roda ANTES do provedor). */
function provedorComSonda(
  contador: { chamadas: number },
): ProvedorRoteiro {
  return {
    nome: "sonda",
    async gerarRoteiroCompleto(): Promise<unknown> {
      contador.chamadas++;
      throw new Error("o provedor nao deveria ter sido chamado");
    },
    async regenerarPedaco(): Promise<unknown> {
      contador.chamadas++;
      throw new Error("o provedor nao deveria ter sido chamado");
    },
  };
}

describe("FQ-C1 em processo — pedido invalido e REJEITADO com erro nomeado, ANTES do cache e do provedor", () => {
  it("gerarRoteiro com versao errada do contrato -> ErroContratoRoteiro com a regra versao-incompativel, e ZERO chamadas ao provedor", async () => {
    const contador = { chamadas: 0 };
    await expect(
      gerarRoteiro(pedidoGerar({ versao_contrato: "Roteiro.2" }), {
        provedor: provedorComSonda(contador),
        diretorioCache: cacheTmp(),
      }),
    ).rejects.toThrow(ErroContratoRoteiro);
    await expect(
      gerarRoteiro(pedidoGerar({ versao_contrato: "Roteiro.2" }), {
        provedor: provedorComSonda(contador),
        diretorioCache: cacheTmp(),
      }),
    ).rejects.toThrow(/versao-incompativel/);
    expect(contador.chamadas).toBe(0); // a sonda: o pedido invalido nem chega ao provedor
  });

  it("gerarRoteiro com tema vazio e com duracao 0 -> ErroContratoRoteiro (schema: tema minLength 1, duracao exclusiveMinimum 0)", async () => {
    await expect(
      gerarRoteiro(pedidoGerar({ brief: { tema: "" } }), {
        provedor: new ProvedorSosiaRoteiro(),
        diretorioCache: cacheTmp(),
      }),
    ).rejects.toThrow(ErroContratoRoteiro);

    await expect(
      gerarRoteiro(pedidoGerar({ duracao_alvo_segundos: 0 }), {
        provedor: new ProvedorSosiaRoteiro(),
        diretorioCache: cacheTmp(),
      }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });

  it("regenerarPedaco com resumo vazio e com pedaco_atual violando regra semantica de narracao -> ErroContratoRoteiro nomeado", async () => {
    await expect(
      regenerarPedaco(pedidoRegenerar({ resumo_demais_pedacos: "" }), {
        provedor: new ProvedorSosiaRoteiro(),
        diretorioCache: cacheTmp(),
      }),
    ).rejects.toThrow(ErroContratoRoteiro);

    // pedaco_atual com narracao "gerado" cujo texto NAO e a fala: a regra
    // gerado-dessincronizado faz o PEDIDO ser invalido (o gerador nao
    // recebe um pedaco que o proprio contrato rejeitaria).
    await expect(
      regenerarPedaco(
        pedidoRegenerar({
          pedaco_atual: {
            ...pedidoRegenerar().pedaco_atual,
            fala: "Fala nova.",
            narracao: { texto: "Fala antiga.", origem: "tts", status: "gerado" },
          },
        }),
        { provedor: new ProvedorSosiaRoteiro(), diretorioCache: cacheTmp() },
      ),
    ).rejects.toThrow(/gerado-dessincronizado/);
  });
});

describe("FQ-G4 — saida do provedor com forma QUEBRADA e rejeitada pelo gate (nunca silencio)", () => {
  it("objeto SEM o array pedacos -> ErroContratoRoteiro (a normalizacao passa intacto e o gate rejeita)", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "sem-pedacos",
      async gerarRoteiroCompleto(): Promise<unknown> {
        return { schema_version: "Roteiro.1", duracao_total_segundos: 5 };
      },
      async regenerarPedaco(): Promise<unknown> {
        return { id: "p-001" }; // pedaco incompleto tambem e rejeitado
      },
    };
    await expect(
      gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() }),
    ).rejects.toThrow(ErroContratoRoteiro);
    await expect(
      regenerarPedaco(pedidoRegenerar(), { provedor, diretorioCache: cacheTmp() }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });

  it("pedacos: [] (minItems 1 do schema) -> ErroContratoRoteiro", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "pedacos-vazios",
      async gerarRoteiroCompleto(): Promise<unknown> {
        return { schema_version: "Roteiro.1", pedacos: [], duracao_total_segundos: 0 };
      },
      async regenerarPedaco(): Promise<unknown> {
        throw new Error("nao usado");
      },
    };
    await expect(
      gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });
});

describe("gerador -> cache: sem a opcao diretorioCache, o diretorio corrente do modulo e usado", () => {
  it("gerarRoteiro(pedido, { provedor }) grava no diretorio corrente do modulo (definido via definirDiretorioCache)", async () => {
    const diretorio = cacheTmp();
    definirDiretorioCache(diretorio);
    const resultado = await gerarRoteiro(pedidoGerar(), { provedor: new ProvedorSosiaRoteiro() });

    expect(resultado.origem).toBe("chamada");
    // A chave do store e o nome do arquivo no diretorio corrente do modulo.
    const arquivos = readdirSync(diretorio);
    expect(arquivos).toContain(`${resultado.chave}.json`);
    const gravado = JSON.parse(readFileSync(join(diretorio, `${resultado.chave}.json`), "utf-8"));
    expect(JSON.stringify(gravado)).toBe(JSON.stringify(resultado.roteiro));
  });
});

describe("gerador -> provedor: SEM a opcao provedor, o default (criarProvedorPadrao — ROTEIRO_PROVEDOR ou sosia) e usado nas duas operacoes", () => {
  it("gerarRoteiro e regenerarPedaco sem provedor injetado chamam o default e devolvem saida valida", async () => {
    // Ambiente controlado: sem ROTEIRO_PROVEDOR, o default e o sosia
    // (o unico sem rede e sem credencial — FQ-G5).
    const original = process.env.ROTEIRO_PROVEDOR;
    delete process.env.ROTEIRO_PROVEDOR;
    try {
      const diretorio = cacheTmp();
      const gerado = await gerarRoteiro(pedidoGerar(), { diretorioCache: diretorio });
      expect(gerado.origem).toBe("chamada");
      expect(validarRoteiro(gerado.roteiro).valido).toBe(true);

      const regenerado = await regenerarPedaco(pedidoRegenerar(), { diretorioCache: diretorio });
      expect(regenerado.origem).toBe("chamada");
      expect(validarPedaco(regenerado.pedaco).valido).toBe(true);
    } finally {
      if (original === undefined) delete process.env.ROTEIRO_PROVEDOR;
      else process.env.ROTEIRO_PROVEDOR = original;
    }
  });
});

describe("INTEGRACAO gerador -> contrato: a saida do gerador SEMPRE valida (propriedade sobre briefs variados)", () => {
  const CASOS = [
    { tema: "Como funciona um cache de computador", duracao: 30 },
    { tema: "Física quântica para curiosos — parte 1", duracao: 45.5 },
    { tema: "café e a economia do Brasil 🇧🇷", duracao: 1 },
    { tema: "x", duracao: 0.5 },
    { tema: "deepseek r1 vs o1 — comparativo direto", duracao: 600 },
    { tema: "Como funciona o determinismo de um render (sem URLs, sem relogio)", duracao: 120.25 },
  ];

  for (const caso of CASOS) {
    it(`gerarRoteiro("${caso.tema.slice(0, 30)}…", ${caso.duracao}s) -> roteiro VALIDO; regenerar o alvo -> pedaco VALIDO com identidade preservada`, async () => {
      const diretorio = cacheTmp();
      const pedido = pedidoGerar({
        brief: { tema: caso.tema, contexto: "Sem contexto" },
        duracao_alvo_segundos: caso.duracao,
      });
      const resultado = await gerarRoteiro(pedido, {
        provedor: new ProvedorSosiaRoteiro(),
        diretorioCache: diretorio,
      });

      // 1. O roteiro gerado SEMPRE valida contra o schema completo.
      const validacao = validarRoteiro(resultado.roteiro);
      expect(validacao.valido, validacao.problemas.join("; ")).toBe(true);

      // 2. duracao_total == soma das duracoes dentro da tolerancia do contrato (0.01s).
      const soma = resultado.roteiro.pedacos.reduce((a, p) => a + p.duracao_segundos, 0);
      expect(Math.abs(resultado.roteiro.duracao_total_segundos - soma)).toBeLessThanOrEqual(0.01);

      // 3. Regenerar UM pedaco: o pedaco devolvido VALIDA e preserva id/indice (FQ-G2).
      const alvo = resultado.roteiro.pedacos[1]!;
      const irmaos = resultado.roteiro.pedacos.filter((p) => p.id !== alvo.id);
      const regenerado = await regenerarPedaco(
        pedidoRegenerar({
          brief: pedido.brief,
          pedaco_atual: alvo,
          resumo_demais_pedacos: resumoDePedacos(irmaos),
        }),
        { provedor: new ProvedorSosiaRoteiro(), diretorioCache: diretorio },
      );
      const validacaoPedaco = validarPedaco(regenerado.pedaco);
      expect(validacaoPedaco.valido, validacaoPedaco.problemas.join("; ")).toBe(true);
      expect(regenerado.pedaco.id).toBe(alvo.id);
      expect(regenerado.pedaco.indice).toBe(alvo.indice);
    });
  }

  it("a saída do cache TAMBEM passa pelo gate (cache envenenado com forma quebrada nunca entra) — regeneracao de pedaco", async () => {
    const diretorio = cacheTmp();
    const primeiro = await regenerarPedaco(pedidoRegenerar(), {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: diretorio,
    });
    // Envenena o arquivo do cache com um pedaco INVALIDO sob a mesma chave.
    writeFileSync(
      join(diretorio, `${primeiro.chave}.json`),
      JSON.stringify({ id: "p-001" }), // incompleto
      "utf-8",
    );
    await expect(
      regenerarPedaco(pedidoRegenerar(), {
        provedor: new ProvedorSosiaRoteiro(),
        diretorioCache: diretorio,
      }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });
});
