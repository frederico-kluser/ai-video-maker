/**
 * tests/autoria/normalizar.test.ts
 *
 * A NORMALIZACAO da saida do LLM (P1 do fix da autoria viva, onda 2):
 *
 *   - AUDITORIA: os alvos derivados do subset OpenAI sao EXATAMENTE as
 *     chaves `anyOf [X, null]` em required que o schema completo rejeita
 *     como null (a auditoria fica visivel: se o schema ganhar uma chave
 *     nova, este teste fica vermelho, nao a cerimonia);
 *   - (i) resposta com `transicao_entrada: null` explicito PASSA pelo
 *     gate depois da normalizacao — e o documento normalizado nao
 *     contem a chave com null (raiz, nos e cenas);
 *   - (ii) o cassete antigo (chaves AUSENTES, nao null) continua
 *     passando — a normalizacao e no-op sobre a forma ausente e o
 *     replay compativel entrega o mesmo documento;
 *   - fronteira: no subset Anthropic nao existe anyOf-null — a
 *     normalizacao e no-op e um null numa resposta anthropic continua
 *     sendo rejeitado pelo gate (a normalizacao nao mascara erro de
 *     modelo).
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import {
  ErroContratoAutoria,
  rejeitarSaidaInvalida,
} from "src/autoria/contrato/rejeitar.js";
import {
  alvosDeNormalizacao,
  normalizarDocumentoAutoria,
} from "src/autoria/contrato/normalizar.js";
import { caminhoDoCache, definirDiretorioCache, obterDiretorioCache } from "src/autoria/contrato/cache.js";
import { chamarAutoria, montarEntrada } from "src/autoria/executor/executor.js";
import { criarFetchDoCasseteAutoria } from "src/autoria/executor/cassete.js";
import {
  briefCanonico,
  diretorioDoCassete,
  lerCassete,
} from "./helpers.js";

const DIRETORIO_CACHE_ORIGINAL = obterDiretorioCache();
let dirCache: string;

beforeEach(() => {
  dirCache = mkdtempSync(join(tmpdir(), "autoria-normalizar-"));
  definirDiretorioCache(dirCache);
});

afterEach(() => {
  rmSync(dirCache, { recursive: true, force: true });
});

afterAll(() => {
  definirDiretorioCache(DIRETORIO_CACHE_ORIGINAL);
});

/** Um documento que o subset OpenAI autoriza (null em required) e o completo rejeita. */
const DOCUMENTO_COM_NULLS = {
  schema_version: "Autoria.1",
  nos: [
    {
      id: "n-001",
      schema: "Cabecalho.1",
      type: "cabecalho",
      texto: "Titulo",
      subtitulo: null,
    },
    {
      id: "n-002",
      schema: "Texto.1",
      type: "texto",
      texto: "Corpo",
      destaque: null,
    },
  ],
  cenas: [
    {
      id: "c-001",
      nos: ["n-001"],
      transicao_entrada: null,
      transicao_saida: null,
      audio_cena: null,
    },
  ],
  audio: null,
};

function fetchQueEntrega(documento: unknown): typeof fetch {
  return async function sosia(
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> {
    const envelope = {
      id: "msg_normalizar",
      object: "chat.completion",
      created: 0,
      model: "gpt-4o-mini",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify(documento) },
          finish_reason: "stop",
        },
      ],
      usage: {},
    };
    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("AUDITORIA — alvos derivados do subset (P1)", () => {
  it("subset OpenAI: exatamente as 11 chaves anyOf-null em required, por nivel", () => {
    const alvos = alvosDeNormalizacao("openai");
    const porNivel = (nivel: string): string[] =>
      alvos.filter((a) => a.nivel === nivel).map((a) => a.chave).sort();
    expect(porNivel("raiz")).toEqual(["audio"]);
    expect(porNivel("nos")).toEqual([
      "destaque",
      "hash",
      "linguagem",
      "linhas_destaque",
      "ordenada",
      "subtitulo",
      "titulo",
    ]);
    expect(porNivel("cenas")).toEqual([
      "audio_cena",
      "transicao_entrada",
      "transicao_saida",
    ]);
    expect(alvos.length).toBe(11);
  });

  it("subset Anthropic: nenhum alvo (opcional la e omissao, nao null)", () => {
    expect(alvosDeNormalizacao("anthropic")).toEqual([]);
  });
});

describe("(i) null explicito -> ausente, e o documento passa pelo gate", () => {
  it("normaliza null -> ausente na raiz, nos e cenas (sem tocar o resto)", () => {
    const normalizado = normalizarDocumentoAutoria(
      JSON.parse(JSON.stringify(DOCUMENTO_COM_NULLS)),
      "openai",
    ) as {
      nos: Array<Record<string, unknown>>;
      cenas: Array<Record<string, unknown>>;
      audio?: unknown;
    };
    expect("audio" in normalizado).toBe(false);
    expect("subtitulo" in normalizado.nos[0]!).toBe(false);
    expect("destaque" in normalizado.nos[1]!).toBe(false);
    expect("transicao_entrada" in normalizado.cenas[0]!).toBe(false);
    expect("transicao_saida" in normalizado.cenas[0]!).toBe(false);
    expect("audio_cena" in normalizado.cenas[0]!).toBe(false);
    // O resto sobrevive intacto.
    expect(normalizado.nos[0]!.texto).toBe("Titulo");
    expect(normalizado.cenas[0]!.nos).toEqual(["n-001"]);
    // Nenhum valor null restante no documento inteiro.
    expect(JSON.stringify(normalizado)).not.toContain("null");
  });

  it("resposta com null PASSA pelo executor (normalizacao + gate) e o cache guarda o documento normalizado", async () => {
    const resultado = await chamarAutoria("openai", briefCanonico(), {
      fetch: fetchQueEntrega(DOCUMENTO_COM_NULLS),
      diretorioCache: dirCache,
    });
    expect(resultado.origem).toBe("chamada");
    const documento = resultado.documento as unknown as {
      cenas: Array<Record<string, unknown>>;
      audio?: unknown;
    };
    expect("transicao_entrada" in documento.cenas[0]!).toBe(false);
    expect("audio" in documento).toBe(false);
    // O que o cache persistiu e o documento NORMALIZADO (nunca o bruto com null).
    const cacheado = JSON.parse(
      readFileSync(caminhoDoCache(montarEntrada("openai", briefCanonico(), {})), "utf-8"),
    ) as string;
    expect(JSON.stringify(cacheado)).not.toContain("null");
    // E o pipeline recebe exatamente o mesmo objeto validado.
    rejeitarSaidaInvalida(documento);
  });
});

describe("(ii) cassete antigo (chaves ausentes) — replay compativel", () => {
  it("a forma AUSENTE nao e alterada pela normalizacao (no-op)", () => {
    const cassete = lerCassete("openai");
    const normalizado = normalizarDocumentoAutoria(
      JSON.parse(JSON.stringify(cassete.resultado)),
      "openai",
    );
    expect(normalizado).toEqual(cassete.resultado);
  });

  it("o replay offline do cassete antigo continua passando pelo caminho completo", async () => {
    const cassete = lerCassete("openai");
    const replay = await chamarAutoria("openai", briefCanonico(), {
      fetch: criarFetchDoCasseteAutoria(cassete, diretorioDoCassete("openai")),
      diretorioCache: dirCache,
    });
    expect(replay.origem).toBe("chamada");
    expect(replay.documento).toEqual(cassete.resultado);
  });
});

describe("fronteira — a normalizacao nao mascara erro de modelo", () => {
  it("null em resposta anthropic (subset sem anyOf-null) continua rejeitado pelo gate", () => {
    const comNull = JSON.parse(JSON.stringify(DOCUMENTO_COM_NULLS));
    const normalizado = normalizarDocumentoAutoria(comNull, "anthropic");
    expect(normalizado).toEqual(comNull); // no-op: o subset nao autoriza null
    expect(() => rejeitarSaidaInvalida(normalizado)).toThrow(ErroContratoAutoria);
  });
});
