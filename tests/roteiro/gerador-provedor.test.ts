/**
 * tests/roteiro/gerador-provedor.test.ts
 *
 * Gaps de cobertura de src/roteiro/gerador/provedor.ts nao exercitados
 * pelo trio do gate (gerador.test.ts + gerador-cli.test.ts):
 *
 *   PROVEDOR LLM (fetch injetado) — os caminhos de ERRO e extracao:
 *     - fetch que lanca (rede) -> EProvedorRoteiroFalhou "fetch falhou";
 *     - status != ok com corpo legivel e com corpo ILEGIVEL (text() que
 *       lanca — nunca derruba a extracao do status);
 *     - resposta.json() que lanca -> "resposta nao e JSON";
 *     - envelope null / nao-objeto -> "resposta nao e um objeto JSON";
 *     - anthropic: sem content[], sem bloco text/output_json (ex.: so
 *       bloco thinking), bloco output_json (saida estruturada), bloco
 *       output_json SEM o campo json caindo no text;
 *     - openai: sem choices[], choices vazio, message ausente, content
 *       nao-string, content vazio;
 *     - extracao com prosa ao redor do JSON e com chaves que nao
 *       parseiam ("{quebrado}" -> erro nomeado, nunca silencio);
 *     - separarPrompt: sem marcador (tudo system) e com marcadores
 *       (volatil no user, na ordem do primeiro marcador);
 *     - chave vinda do ENV (ANTHROPIC_API_KEY / OPENAI_API_KEY) e
 *       modelo/maxTokens sobrescritos por opcao.
 *
 *   SOSIA — os fallbacks deterministicos:
 *     - prompt sem bloco PEDACO ALVO: id p-000 / indice 0 / duracao 5;
 *     - bloco PEDACO ALVO malformado ou sem '{': mesmo fallback;
 *     - prompt sem BRIEF: tema "o tema" e duracao alvo 30;
 *     - propriedade: para N prompts distintos, 2..5 pedacos, sempre
 *       validos, sempre "texto".
 *
 *   CASSETE — o formato e os erros nomeados:
 *     - layout do diretorio apos gravarCasseteRoteiro (cabecalho.json +
 *       resultado.json, sem .tmp-* — escrita atomica);
 *     - ECasseteRoteiroInvalido: arquivo obrigatorio ausente, arquivo
 *       ilegivel, formato divergente, chave do cabecalho divergindo do
 *       diretorio.
 *
 *   SELECAO POR NOME: criarProvedorRoteiroPorNome (4 nomes + desconhecido)
 *   e criarProvedorPadrao (env ROTEIRO_PROVEDOR e default sosia).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PedidoGerarRoteiro } from "../../src/roteiro/contrato/contrato.js";
import { validarRoteiro } from "../../src/roteiro/contrato/validar.js";
import { montarPromptRegenerar, montarPromptRoteiro } from "../../src/roteiro/gerador/prompt.js";
import {
  ECasseteRoteiroInvalido,
  EProvedorDesconhecido,
  EProvedorRoteiroFalhou,
  ProvedorSosiaRoteiro,
  VERSAO_FORMATO_CASSETE_ROTEIRO,
  chaveDoCasseteRoteiro,
  criarProvedorCasseteRoteiro,
  criarProvedorLlm,
  criarProvedorPadrao,
  criarProvedorRoteiroPorNome,
  diretorioDoCasseteRoteiro,
  gravarCasseteRoteiro,
  lerCasseteRoteiro,
} from "../../src/roteiro/gerador/provedor.js";
import type { ProvedorLlm } from "../../src/roteiro/gerador/provedor.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "roteiro-provedor-"));
}

/** Um roteiro valido (forma de schema) para os mocks de LLM. */
function roteiroValidoJson(): string {
  return JSON.stringify({
    schema_version: "Roteiro.1",
    pedacos: [
      {
        id: "p-000",
        indice: 0,
        titulo: "Abertura",
        fala: "",
        duracao_segundos: 4,
        tipo_visual: "cabecalho",
        especificacao_visual: "Titulo em destaque",
        detalhes_de_producao: "Composicao de cabecalho",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
      {
        id: "p-001",
        indice: 1,
        titulo: "O que e um cache",
        fala: "Um cache guarda resultados para nao recalcular.",
        duracao_segundos: 8,
        tipo_visual: "texto",
        especificacao_visual: "Texto em destaque com a definicao",
        detalhes_de_producao: "Slide de texto",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
    ],
    duracao_total_segundos: 12,
  });
}

const ROTEIRO_VALIDO = roteiroValidoJson();

function pedidoGerar(sobreposicao?: Partial<PedidoGerarRoteiro>): PedidoGerarRoteiro {
  return {
    brief: { tema: "Como funciona um cache de computador", contexto: "Video para iniciantes" },
    duracao_alvo_segundos: 30,
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobreposicao,
  };
}

/** Uma resposta HTTP fake (so o que executarChamadaLlm usa: ok/status/text/json). */
function respostaFake(
  corpo: { ok: boolean; status: number; json?: unknown; texto?: string },
): Response {
  return {
    ok: corpo.ok,
    status: corpo.status,
    async text() {
      if (corpo.texto === undefined) throw new Error("corpo indisponivel");
      return corpo.texto;
    },
    async json() {
      if (corpo.json === undefined) throw new Error("corpo indisponivel");
      return corpo.json;
    },
  } as unknown as Response;
}

/** Captura url/init da chamada de fetch e devolve a resposta fake. */
function fetchComCaptura(
  respostas: Array<Response | ((url: string, init: RequestInit) => Response)>,
): { fetch: typeof fetch; chamadas: Array<{ url: string; init: RequestInit }> } {
  const chamadas: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fetch = (async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const u = String(url);
    chamadas.push({ url: u, init: init ?? {} });
    const resposta = respostas[Math.min(i, respostas.length - 1)]!;
    i++;
    return typeof resposta === "function" ? resposta(u, init ?? {}) : resposta;
  }) as typeof globalThis.fetch;
  return { fetch, chamadas };
}

// ─── LLM real: caminhos de erro e extracao ────────────────────────────────────

describe("Provedor LLM — caminhos de erro (fetch injetado, nunca rede real)", () => {
  it("fetch que LANCA (erro de rede) -> EProvedorRoteiroFalhou 'fetch falhou' com a mensagem da causa", async () => {
    const fetchQueLanca = (async (): Promise<Response> => {
      throw new Error("ECONNREFUSED 10.0.0.1:443");
    }) as typeof fetch;
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchQueLanca, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/fetch falhou: ECONNREFUSED/);
    await expect(provedor.regenerarPedaco("p")).rejects.toThrow(EProvedorRoteiroFalhou);
  });

  it("status 429 com corpo legivel -> EProvedorRoteiroFalhou com status e o corpo (truncado a 300 chars)", async () => {
    const corpoLongo = "rate limit: " + "x".repeat(500);
    const { fetch } = fetchComCaptura([respostaFake({ ok: false, status: 429, texto: corpoLongo })]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    let erro: unknown;
    try {
      await provedor.gerarRoteiroCompleto("p");
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(EProvedorRoteiroFalhou);
    expect((erro as EProvedorRoteiroFalhou).status).toBe(429);
    expect((erro as EProvedorRoteiroFalhou).message).toContain("rate limit");
    expect((erro as EProvedorRoteiroFalhou).message).toContain("HTTP 429");
    expect((erro as EProvedorRoteiroFalhou).message.length).toBeLessThan(500);
  });

  it("status != ok com corpo ILEGIVEL (text() lanca) -> o status sobrevive, o corpo nunca derruba o erro", async () => {
    const { fetch } = fetchComCaptura([respostaFake({ ok: false, status: 500 })]);
    const provedor = criarProvedorLlm("openai", { fetch, chaveDeApi: "k" });
    let erro: unknown;
    try {
      await provedor.gerarRoteiroCompleto("p");
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(EProvedorRoteiroFalhou);
    expect((erro as EProvedorRoteiroFalhou).status).toBe(500);
    expect((erro as EProvedorRoteiroFalhou).message).toContain("status 500");
  });

  it("resposta.json() que LANCA -> 'resposta nao e JSON'", async () => {
    const { fetch } = fetchComCaptura([
      {
        ok: true,
        status: 200,
        async json() {
          throw new Error("Unexpected token < in JSON");
        },
      } as unknown as Response,
    ]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/resposta nao e JSON/);
  });

  it("envelope null ou primitivo -> 'resposta nao e um objeto JSON' (erro nomeado, nunca silencio)", async () => {
    for (const envelope of [null, 42, "texto"]) {
      const { fetch } = fetchComCaptura([respostaFake({ ok: true, status: 200, json: envelope })]);
      const provedor = criarProvedorLlm("openai", { fetch, chaveDeApi: "k" });
      await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/nao e um objeto JSON/);
    }
  });

  it("anthropic sem content[] -> 'resposta sem content[]'", async () => {
    const { fetch } = fetchComCaptura([respostaFake({ ok: true, status: 200, json: { modelo: "x" } })]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/resposta sem content\[\]/);
  });

  it("anthropic com content[] sem bloco text/output_json (ex.: so thinking) -> 'nenhum bloco text/output_json na resposta'", async () => {
    const { fetch } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { content: [{ type: "thinking", thinking: "..." }] } }),
    ]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/nenhum bloco text\/output_json/);
  });

  it("anthropic com bloco output_json: devolve o JSON estruturado COMO VEIO (o gate do gerador decide)", async () => {
    const jsonEstruturado = { qualquer: "coisa", lista: [1, 2] };
    const { fetch } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { content: [{ type: "output_json", json: jsonEstruturado }] } }),
    ]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    const saida = await provedor.gerarRoteiroCompleto("p");
    expect(saida).toEqual(jsonEstruturado);
  });

  it("anthropic com output_json SEM o campo json + bloco text: cai no text e extrai o JSON", async () => {
    const { fetch } = fetchComCaptura([
      respostaFake({
        ok: true,
        status: 200,
        json: { content: [{ type: "output_json" }, { type: "text", text: ROTEIRO_VALIDO }] },
      }),
    ]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    const saida = await provedor.gerarRoteiroCompleto("p");
    expect(JSON.stringify(saida)).toBe(ROTEIRO_VALIDO);
  });

  it("openai sem choices[] ou com choices vazio -> 'resposta sem choices[]'", async () => {
    for (const envelope of [{}, { choices: [] }]) {
      const { fetch } = fetchComCaptura([respostaFake({ ok: true, status: 200, json: envelope })]);
      const provedor = criarProvedorLlm("openai", { fetch, chaveDeApi: "k" });
      await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/resposta sem choices\[\]/);
    }
  });

  it("openai sem message ou com content NAO-STRING -> 'conteudo da resposta nao e string'", async () => {
    for (const escolha of [{}, { message: {} }, { message: { content: 42 } }, { message: { content: "" } }]) {
      const { fetch } = fetchComCaptura([
        respostaFake({ ok: true, status: 200, json: { choices: [escolha] } }),
      ]);
      const provedor = criarProvedorLlm("openai", { fetch, chaveDeApi: "k" });
      await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/nao e string/);
    }
  });

  it("content com PROSA ao redor do JSON e tolerado (a extracao corta no primeiro '{' e no ultimo '}')", async () => {
    const { fetch } = fetchComCaptura([
      respostaFake({
        ok: true,
        status: 200,
        json: { choices: [{ message: { content: `Aqui vai o roteiro:\n${ROTEIRO_VALIDO}\nFim.` } }] },
      }),
    ]);
    const provedor = criarProvedorLlm("openai", { fetch, chaveDeApi: "k" });
    const saida = await provedor.gerarRoteiroCompleto("p");
    expect(JSON.stringify(saida)).toBe(ROTEIRO_VALIDO);
  });

  it("content com chaves que NAO parseiam -> erro nomeado 'nao e JSON valido' (JSON malformado nunca aceito)", async () => {
    const { fetch } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { choices: [{ message: { content: "{quebrado}" } }] } }),
    ]);
    const provedor = criarProvedorLlm("openai", { fetch, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(/nao e JSON valido/);
  });
});

describe("Provedor LLM — montagem da requisicao por fornecedor (separarPrompt, env, opcoes)", () => {
  it("prompt SEM marcador: o prompt inteiro vai como system e o user e a mensagem fallback", async () => {
    const { fetch, chamadas } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { content: [{ type: "text", text: ROTEIRO_VALIDO }] } }),
    ]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    await provedor.gerarRoteiroCompleto("PROMPT CUSTOM SEM MARCADOR NENHUM");

    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as {
      system: string;
      messages: Array<{ content: string }>;
    };
    expect(corpo.system).toBe("PROMPT CUSTOM SEM MARCADOR NENHUM");
    expect(corpo.messages[0]?.content).toBe("Emita a saida JSON conforme o prompt de sistema.");
  });

  it("prompt composto: o texto estavel vai sem marcador e o user comeca no PRIMEIRO marcador (PEDACO ALVO antes do BRIEF)", async () => {
    const { fetch, chamadas } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { content: [{ type: "text", text: ROTEIRO_VALIDO }] } }),
    ]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    const promptRegenerar = montarPromptRegenerar({
      brief: { tema: "t" },
      duracao_alvo_segundos: 10,
      pedaco_atual: {
        id: "p-001",
        indice: 1,
        titulo: "T",
        fala: "Fala do alvo.",
        duracao_segundos: 5,
        tipo_visual: "texto",
        especificacao_visual: "V",
        detalhes_de_producao: "D",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
      resumo_demais_pedacos: "[{\"id\":\"p-000\"}]",
      versao_contrato: "Roteiro.1",
      versao_contrato_gerador: "1.0.0",
      versao_gerador: "1.0.0",
    });
    await provedor.gerarRoteiroCompleto(promptRegenerar);

    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as {
      system: string;
      messages: Array<{ content: string }>;
    };
    expect(corpo.system).not.toContain("## PEDACO ALVO");
    expect(corpo.system).not.toContain("## BRIEF DO VIDEO");
    expect(corpo.messages[0]?.content.startsWith("## PEDACO ALVO")).toBe(true);
    expect(corpo.messages[0]?.content).toContain("Fala do alvo.");
  });

  it("a chave vem do ENV quando nao injetada (ANTHROPIC_API_KEY / OPENAI_API_KEY), e modelo/maxTokens sao sobrescritos por opcao", async () => {
    const corpoAnthropic = JSON.stringify({
      content: [{ type: "text", text: ROTEIRO_VALIDO }],
    });
    const { fetch, chamadas } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: JSON.parse(corpoAnthropic) }),
    ]);
    vi.stubEnv("ANTHROPIC_API_KEY", "chave-do-env");
    const provedor = criarProvedorLlm("anthropic", {
      fetch,
      modelo: "claude-modelo-teste",
      maxTokens: 123,
    });
    await provedor.gerarRoteiroCompleto("p");

    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as {
      model: string;
      max_tokens: number;
    };
    expect(corpo.model).toBe("claude-modelo-teste");
    expect(corpo.max_tokens).toBe(123);
    expect((chamadas[0]?.init.headers as Record<string, string>)["x-api-key"]).toBe("chave-do-env");

    // OpenAI: authorization Bearer <env>.
    const { fetch: fetchOpenai, chamadas: chamadasOpenai } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { choices: [{ message: { content: ROTEIRO_VALIDO } }] } }),
    ]);
    vi.stubEnv("OPENAI_API_KEY", "chave-openai-env");
    const provedorOpenai = criarProvedorLlm("openai", { fetch: fetchOpenai });
    await provedorOpenai.gerarRoteiroCompleto("p");
    expect((chamadasOpenai[0]?.init.headers as Record<string, string>).authorization).toBe(
      "Bearer chave-openai-env",
    );
  });

  it("SEM chave injetada e SEM env: o header de chave sai VAZIO (x-api-key '') — a requisicao e montada mesmo assim (a API e quem rejeita 401)", async () => {
    const originalAnthropic = process.env.ANTHROPIC_API_KEY;
    const originalOpenai = process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const { fetch, chamadas } = fetchComCaptura([
        respostaFake({ ok: true, status: 200, json: { content: [{ type: "text", text: ROTEIRO_VALIDO }] } }),
      ]);
      const provedor = criarProvedorLlm("anthropic", { fetch });
      await provedor.gerarRoteiroCompleto("p");
      expect((chamadas[0]?.init.headers as Record<string, string>)["x-api-key"]).toBe("");

      // OpenAI: o mesmo — authorization sai "Bearer " vazio.
      const { fetch: fetchOpenai, chamadas: chamadasOpenai } = fetchComCaptura([
        respostaFake({ ok: true, status: 200, json: { choices: [{ message: { content: ROTEIRO_VALIDO } }] } }),
      ]);
      const provedorOpenai = criarProvedorLlm("openai", { fetch: fetchOpenai });
      await provedorOpenai.gerarRoteiroCompleto("p");
      expect((chamadasOpenai[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer ");
    } finally {
      if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = originalAnthropic;
      if (originalOpenai === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalOpenai;
    }
  });

  it("o corpo anthropic carrega temperature 0 e a versao da API (montagem por fornecedor)", async () => {
    const { fetch, chamadas } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { content: [{ type: "text", text: ROTEIRO_VALIDO }] } }),
    ]);
    const provedor = criarProvedorLlm("anthropic", { fetch, chaveDeApi: "k" });
    await provedor.gerarRoteiroCompleto("p");

    expect(chamadas[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    const headers = chamadas[0]?.init.headers as Record<string, string>;
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["x-api-key"]).toBe("k");
    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as { temperature: number; model: string };
    expect(corpo.temperature).toBe(0);
    expect(corpo.model).toBe("claude-sonnet-4-5");
  });
});

// ─── SOSIA: fallbacks deterministicos e a propriedade de validade ──────────────

describe("ProvedorSosiaRoteiro — fallbacks e propriedades (sem rede, sem credencial, pinado a 'texto')", () => {
  it("gerarRoteiroCompleto com prompt SEM BRIEF: tema fallback 'o tema', duracao alvo 30, e DETERMINISTICO", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const primeiro = await sosia.gerarRoteiroCompleto("PROMPT SEM MARCADOR NENHUM");
    const segundo = await sosia.gerarRoteiroCompleto("PROMPT SEM MARCADOR NENHUM");
    expect(JSON.stringify(primeiro)).toBe(JSON.stringify(segundo));

    const roteiro = primeiro as {
      pedacos: Array<{ fala: string; tipo_visual: string }>;
      duracao_total_segundos: number;
    };
    expect(roteiro.pedacos[1]?.fala).toContain("o tema"); // indice 0 e o unico sem fala
    expect(roteiro.duracao_total_segundos).toBeGreaterThan(20); // fallback 30s distribuido
    for (const pedaco of roteiro.pedacos) {
      expect(pedaco.tipo_visual).toBe("texto");
    }
  });

  it("regenerarPedaco sem bloco PEDACO ALVO: identidade fallback p-000/0 e duracao 5 (nunca undefined no roteiro)", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const pedaco = (await sosia.regenerarPedaco("PROMPT SEM MARCADOR NENHUM")) as {
      id: string;
      indice: number;
      duracao_segundos: number;
    };
    expect(pedaco.id).toBe("p-000");
    expect(pedaco.indice).toBe(0);
    expect(pedaco.duracao_segundos).toBe(5);
  });

  it("regenerarPedaco com bloco PEDACO ALVO MALFORMADO (JSON quebrado ou sem '{'): mesmo fallback, nunca lanca", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const quebrado = (await sosia.regenerarPedaco("## PEDACO ALVO\n{quebrado}")) as {
      id: string;
      indice: number;
    };
    expect(quebrado.id).toBe("p-000");
    expect(quebrado.indice).toBe(0);

    const semChaves = (await sosia.regenerarPedaco("## PEDACO ALVO\n\n## RESUMO DOS IRMAOS\n[]")) as {
      id: string;
      indice: number;
    };
    expect(semChaves.id).toBe("p-000");
  });

  it("regenerarPedaco com bloco PEDACO ALVO de TIPOS errados (id nao-string, indice nao-numero, duracao nao-numero): campos descartados e fallback deterministico", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const pedaco = (await sosia.regenerarPedaco(
      '## PEDACO ALVO\n{"id":123,"indice":"x","duracao_segundos":"y"}',
    )) as { id: string; indice: number; duracao_segundos: number };
    expect(pedaco.id).toBe("p-000");
    expect(pedaco.indice).toBe(0);
    expect(pedaco.duracao_segundos).toBe(5);
  });

  it("regenerarPedaco com bloco VALIDO: usa id/indice/duracao do alvo, DETERMINISTICO (2x = mesmos bytes)", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const prompt = "## PEDACO ALVO\n{\"id\":\"p-002\",\"indice\":2,\"duracao_segundos\":12.5}\n\n## RESUMO DOS IRMAOS\n[]";
    const primeiro = await sosia.regenerarPedaco(prompt);
    const segundo = await sosia.regenerarPedaco(prompt);
    expect(JSON.stringify(primeiro)).toBe(JSON.stringify(segundo));
    expect((primeiro as { id: string; indice: number }).id).toBe("p-002");
    expect((primeiro as { indice: number }).indice).toBe(2);
    expect((primeiro as { duracao_segundos: number }).duracao_segundos).toBe(12.5);
  });

  it("PROPRIEDADE: para N temas/duracoes distintos, a saida do sosia SEMPRE valida, tem 2..5 pedacos 'texto' e total == soma (dentro da tolerancia)", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const casos = [
      { tema: "a", duracao: 30 },
      { tema: "Fisica quantica para curiosos — parte 1", duracao: 45.5 },
      { tema: "cafe e a economia do Brasil", duracao: 1 },
      { tema: "Como funciona um cache de computador", duracao: 300 },
      { tema: "deepseek r1 vs o1 — comparativo direto", duracao: 60 },
      { tema: "x", duracao: 0.5 },
    ];
    for (const caso of casos) {
      const prompt = montarPromptRoteiro(
        pedidoGerar({
          brief: { tema: caso.tema },
          duracao_alvo_segundos: caso.duracao,
        }),
      );
      const saida = await sosia.gerarRoteiroCompleto(prompt);
      const validacao = validarRoteiro(saida);
      expect(validacao.valido, `tema "${caso.tema}": ${validacao.problemas.join("; ")}`).toBe(true);
      const roteiro = saida as { pedacos: unknown[]; duracao_total_segundos: number };
      expect(roteiro.pedacos.length).toBeGreaterThanOrEqual(2);
      expect(roteiro.pedacos.length).toBeLessThanOrEqual(5);
    }
  });
});

// ─── CASSETE: formato no disco e erros nomeados ───────────────────────────────

describe("Cassete de roteiro — formato, escrita atomica e erros nomeados", () => {
  it("gravarCasseteRoteiro grava cabecalho.json + resultado.json (sem .tmp-*) e as chaves batem (C12: prompt -> sha256)", async () => {
    const raiz = tmpDir();
    const prompt = "prompt do cassete";
    const resultado = { roteiro: [1, 2], ok: true };
    const { chave, diretorio } = gravarCasseteRoteiro(raiz, prompt, resultado);

    expect(chave).toBe(chaveDoCasseteRoteiro(prompt));
    expect(chave).toBe(createHash("sha256").update(prompt).digest("hex"));
    expect(diretorio).toBe(diretorioDoCasseteRoteiro(raiz, chave));
    expect(existsSync(join(diretorio, "cabecalho.json"))).toBe(true);
    expect(existsSync(join(diretorio, "resultado.json"))).toBe(true);
    // Escrita atomica: nenhum .tmp-* sobreviveu.
    expect(readdirSync(diretorio).filter((n) => n.includes(".tmp-"))).toEqual([]);

    const cabecalho = JSON.parse(readFileSync(join(diretorio, "cabecalho.json"), "utf-8")) as {
      formato: string;
      chave: string;
      promptSha256: string;
    };
    expect(cabecalho.formato).toBe(VERSAO_FORMATO_CASSETE_ROTEIRO);
    expect(cabecalho.chave).toBe(chave);
    expect(cabecalho.promptSha256).toBe(createHash("sha256").update(prompt).digest("hex"));
  });

  it("regravar o MESMO cassete substitui o resultado (o replay devolve o novo)", async () => {
    const raiz = tmpDir();
    const prompt = "prompt do cassete";
    gravarCasseteRoteiro(raiz, prompt, { versao: 1 });
    gravarCasseteRoteiro(raiz, prompt, { versao: 2 });
    const lido = lerCasseteRoteiro(raiz, chaveDoCasseteRoteiro(prompt));
    expect(lido.resultado).toEqual({ versao: 2 });
    expect(lido.cabecalho.chave).toBe(chaveDoCasseteRoteiro(prompt));
  });

  it("ECasseteRoteiroInvalido: arquivo obrigatorio ausente (cabecalho e resultado), sempre com o caminho no problema", async () => {
    const raiz = tmpDir();
    const chave = "a".repeat(64);
    const diretorio = diretorioDoCasseteRoteiro(raiz, chave);
    mkdirSync(diretorio, { recursive: true });
    writeFileSync(join(diretorio, "cabecalho.json"), "{}", "utf-8");
    // so o cabecalho — o resultado falta
    let erro: unknown;
    try {
      lerCasseteRoteiro(raiz, chave);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ECasseteRoteiroInvalido);
    expect((erro as ECasseteRoteiroInvalido).code).toBe("CASSETE_ROTEIRO_INVALIDO");
    expect((erro as ECasseteRoteiroInvalido).problemas.join(" ")).toContain("resultado.json");

    // agora o resultado existe e o cabecalho e APAGADO — o problema nomeia o cabecalho
    writeFileSync(join(diretorio, "resultado.json"), "{}", "utf-8");
    // (cabecalho foi reescrito acima como '{}' valido — testa agora o caso inverso num dir novo)
    const raiz2 = tmpDir();
    const chave2 = "b".repeat(64);
    mkdirSync(diretorioDoCasseteRoteiro(raiz2, chave2), { recursive: true });
    writeFileSync(join(diretorioDoCasseteRoteiro(raiz2, chave2), "resultado.json"), "{}", "utf-8");
    try {
      lerCasseteRoteiro(raiz2, chave2);
    } catch (e) {
      erro = e;
    }
    expect((erro as ECasseteRoteiroInvalido).problemas.join(" ")).toContain("cabecalho.json");
  });

  it("ECasseteRoteiroInvalido: arquivo ILEGIVEL (JSON quebrado no cabecalho)", async () => {
    const raiz = tmpDir();
    const chave = "c".repeat(64);
    const diretorio = diretorioDoCasseteRoteiro(raiz, chave);
    mkdirSync(diretorio, { recursive: true });
    writeFileSync(join(diretorio, "cabecalho.json"), "{ quebrado", "utf-8");
    writeFileSync(join(diretorio, "resultado.json"), "{}", "utf-8");
    let erro: unknown;
    try {
      lerCasseteRoteiro(raiz, chave);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ECasseteRoteiroInvalido);
    expect((erro as ECasseteRoteiroInvalido).problemas.join(" ")).toContain("arquivo ilegivel");
  });

  it("ECasseteRoteiroInvalido: formato divergente e chave do cabecalho divergindo do diretorio", async () => {
    const raiz = tmpDir();
    const chave = "d".repeat(64);
    const diretorio = diretorioDoCasseteRoteiro(raiz, chave);
    mkdirSync(diretorio, { recursive: true });

    // Formato errado.
    writeFileSync(
      join(diretorio, "cabecalho.json"),
      JSON.stringify({ formato: "cassete-roteiro.999", chave, promptSha256: chave }),
      "utf-8",
    );
    writeFileSync(join(diretorio, "resultado.json"), "{}", "utf-8");
    let erro: unknown;
    try {
      lerCasseteRoteiro(raiz, chave);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ECasseteRoteiroInvalido);
    expect((erro as ECasseteRoteiroInvalido).problemas.join(" ")).toContain(
      "cassete-roteiro.999 != cassete-roteiro.1",
    );

    // Chave do cabecalho divergindo do diretorio (um cassete de outro prompt).
    writeFileSync(
      join(diretorio, "cabecalho.json"),
      JSON.stringify({ formato: VERSAO_FORMATO_CASSETE_ROTEIRO, chave: "e".repeat(64), promptSha256: "x" }),
      "utf-8",
    );
    try {
      lerCasseteRoteiro(raiz, chave);
    } catch (e) {
      erro = e;
    }
    expect((erro as ECasseteRoteiroInvalido).problemas.join(" ")).toContain("diverge do diretorio");
  });

  it("criarProvedorCasseteRoteiro com raiz custom: replay devolve o resultado COMO FOI GRAVADO (o gate do gerador decide)", async () => {
    const raiz = tmpDir();
    const prompt = "prompt para replay";
    const gravado = { qualquer: "coisa" };
    gravarCasseteRoteiro(raiz, prompt, gravado);
    const provedor = criarProvedorCasseteRoteiro(raiz);
    expect(provedor.nome).toBe("cassete");
    const resultado = await provedor.gerarRoteiroCompleto(prompt);
    expect(resultado).toEqual(gravado);
    const regenerado = await provedor.regenerarPedaco(prompt);
    expect(regenerado).toEqual(gravado);
  });
});

// ─── Selecao por nome (env/flag) ──────────────────────────────────────────────

describe("criarProvedorRoteiroPorNome / criarProvedorPadrao — a selecao por env/flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("os quatro nomes aceitos produzem provedores com o nome estavel correspondente", () => {
    expect(criarProvedorRoteiroPorNome("sosia").nome).toBe("sosia");
    expect(criarProvedorRoteiroPorNome("sosia")).toBeInstanceOf(ProvedorSosiaRoteiro);
    expect(criarProvedorRoteiroPorNome("cassete").nome).toBe("cassete");
    expect(criarProvedorRoteiroPorNome("llm-anthropic").nome).toBe("llm-anthropic");
    expect(criarProvedorRoteiroPorNome("llm-openai").nome).toBe("llm-openai");
  });

  it("nome DESCONHECIDO -> EProvedorDesconhecido nomeado com a lista dos aceitos (nunca default silencioso)", () => {
    expect(() => criarProvedorRoteiroPorNome("nao-existe")).toThrow(EProvedorDesconhecido);
    expect(() => criarProvedorRoteiroPorNome("nao-existe")).toThrow(/sosia \| cassete \| llm-anthropic \| llm-openai/);
  });

  it("criarProvedorPadrao: sem env -> sosia (o unico sem rede e sem credencial); com env -> o nome do env", async () => {
    const original = process.env.ROTEIRO_PROVEDOR;
    delete process.env.ROTEIRO_PROVEDOR;
    try {
      expect(criarProvedorPadrao().nome).toBe("sosia");
    } finally {
      if (original === undefined) delete process.env.ROTEIRO_PROVEDOR;
      else process.env.ROTEIRO_PROVEDOR = original;
    }
    vi.stubEnv("ROTEIRO_PROVEDOR", "llm-openai");
    expect(criarProvedorPadrao().nome).toBe("llm-openai");
    vi.stubEnv("ROTEIRO_PROVEDOR", "cassete");
    const raiz = tmpDir();
    const provedor = criarProvedorPadrao({ raizCassetes: raiz });
    expect(provedor.nome).toBe("cassete");
    // O raizCassetes passou ao provedor: um cassete gravado la e replaiado.
    const prompt = "p";
    gravarCasseteRoteiro(raiz, prompt, { ok: 1 });
    expect(await provedor.gerarRoteiroCompleto(prompt)).toEqual({ ok: 1 });
  });

  it("criarProvedorLlm delega gerar e regenerar para a MESMA chamada (ambos os metodos do contrato)", async () => {
    const { fetch, chamadas } = fetchComCaptura([
      respostaFake({ ok: true, status: 200, json: { choices: [{ message: { content: ROTEIRO_VALIDO } }] } }),
    ]);
    const provedor = criarProvedorLlm("openai", { fetch, chaveDeApi: "k" });
    const viaGerar = await provedor.gerarRoteiroCompleto("p");
    const viaRegenerar = await provedor.regenerarPedaco("p");
    expect(JSON.stringify(viaGerar)).toBe(ROTEIRO_VALIDO);
    expect(JSON.stringify(viaRegenerar)).toBe(ROTEIRO_VALIDO);
    expect(chamadas.length).toBe(2);
  });
});
