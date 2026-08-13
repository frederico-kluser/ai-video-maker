/**
 * tests/autoria/executor.test.ts
 *
 * O EXECUTOR de autoria (card F4-04, W6) — o cliente de chamada:
 *
 *   - monta a chamada com o schema PODADO por fornecedor (nunca o
 *     completo) — pergunta adversarial do contrato-w6 §12;
 *   - respeita o cache do F4-01: HIT nao chama o provedor; mudar um
 *     componente da chave gera MISS (C12);
 *   - valida via rejeitar.ts ANTES do pipeline;
 *   - importa sem credencial (C06 — llm-authoring): nenhum cliente de
 *     provedor existe em escopo de modulo.
 *
 * A rede esta bloqueada pelo setup global do vitest; o caminho de
 * chamada aqui usa fetch fake ou o replay do cassete — nunca a rede.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import {
  ErroContratoAutoria,
} from "src/autoria/contrato/rejeitar.js";
import {
  CAMINHO_SCHEMA_ANTHROPIC,
  CAMINHO_SCHEMA_OPENAI,
} from "src/autoria/contrato/contrato.js";
import { definirDiretorioCache, obterDiretorioCache } from "src/autoria/contrato/cache.js";
import { montarEntrada, chamarAutoria } from "src/autoria/executor/executor.js";
import { montarRequisicao, ENDPOINTS } from "src/autoria/executor/chamada.js";
import {
  MODELO_PADRAO,
  MAX_TOKENS_PADRAO,
} from "src/autoria/executor/contrato.js";
import {
  briefCanonico,
  lerCassete,
  diretorioDoCassete,
  textoDoPrompt,
} from "./helpers.js";

const DIRETORIO_CACHE_ORIGINAL = obterDiretorioCache();
let dirCache: string;

beforeEach(() => {
  dirCache = mkdtempSync(join(tmpdir(), "autoria-executor-"));
  definirDiretorioCache(dirCache);
});

afterEach(() => {
  rmSync(dirCache, { recursive: true, force: true });
});

afterAll(() => {
  definirDiretorioCache(DIRETORIO_CACHE_ORIGINAL);
});

/** Resposta de LLM valida (minima) para os testes de cache. */
const DOCUMENTO_VALIDO_MINIMO = {
  schema_version: "Autoria.1",
  nos: [
    {
      id: "n-001",
      schema: "Cabecalho.1",
      type: "cabecalho",
      texto: "Titulo",
    },
  ],
  cenas: [{ id: "c-001", nos: ["n-001"] }],
};

function fetchQueEntrega(documento: unknown): typeof fetch {
  return async function sosia(
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> {
    const envelope = {
      id: "msg_sonda",
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
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };
    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("executor — o caminho de chamada (contrato-w6 §12)", () => {
  it("importa SEM credencial (C06): nenhum cliente de provedor em escopo de modulo", () => {
    // Este arquivo ja importou os modulos do executor acima, sem chave
    // nenhuma. O que resta provar e que montar a chamada nao exige chave:
    const entrada = montarEntrada("openai", briefCanonico(), {});
    expect(entrada.model).toBe(MODELO_PADRAO.openai);
    const req = montarRequisicao("openai", entrada, undefined, MAX_TOKENS_PADRAO);
    expect(req.headers.authorization).toBe("Bearer ");
  });

  it("monta a entrada com o prompt da biblioteca de F4-02 (fonte unica)", () => {
    const entrada = montarEntrada("openai", briefCanonico(), {});
    expect(entrada.system).toBe(textoDoPrompt());
    expect(entrada.schema_version).toBe("Autoria.1");
    expect(entrada.tentativa).toBe(1);
    expect(Array.isArray(entrada.messages)).toBe(true);
    expect((entrada.messages[0] as { role: string }).role).toBe("user");
  });

  it("a chamada usa o schema PODADO por fornecedor — nunca o schema completo", () => {
    const entradaOpenAI = montarEntrada("openai", briefCanonico(), {});
    const reqOpenAI = montarRequisicao("openai", entradaOpenAI, undefined, 4096);
    const corpoOpenAI = JSON.parse(reqOpenAI.corpo) as {
      response_format: { json_schema: { schema: unknown } };
    };
    expect(corpoOpenAI.response_format.json_schema.schema).toEqual(
      JSON.parse(readFileSync(CAMINHO_SCHEMA_OPENAI, "utf-8")),
    );

    const entradaAnthropic = montarEntrada("anthropic", briefCanonico(), {});
    const reqAnthropic = montarRequisicao("anthropic", entradaAnthropic, undefined, 4096);
    const corpoAnthropic = JSON.parse(reqAnthropic.corpo) as {
      output_config: { format: { schema: unknown } };
    };
    expect(corpoAnthropic.output_config.format.schema).toEqual(
      JSON.parse(readFileSync(CAMINHO_SCHEMA_ANTHROPIC, "utf-8")),
    );
    // Endpoints e formas corretas por fornecedor.
    expect(reqOpenAI.url).toBe(ENDPOINTS.openai);
    expect(reqAnthropic.url).toBe(ENDPOINTS.anthropic);
    expect(reqOpenAI.headers.authorization).toMatch(/^Bearer /);
    expect(reqAnthropic.headers["x-api-key"]).toBeDefined();
    expect(reqAnthropic.headers.authorization).toBeUndefined();
  });

  it("HIT nao chama o provedor; a mesma entrada nunca gera duas chamadas", async () => {
    let chamadas = 0;
    const fetchContador: typeof fetch = (async () => {
      chamadas += 1;
      return new Response(
        JSON.stringify({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: "gpt-4o-mini",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: JSON.stringify(DOCUMENTO_VALIDO_MINIMO) },
              finish_reason: "stop",
            },
          ],
          usage: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const primeira = await chamarAutoria("openai", briefCanonico(), {
      fetch: fetchContador,
      diretorioCache: dirCache,
    });
    expect(primeira.origem).toBe("chamada");
    expect(chamadas).toBe(1);

    const segunda = await chamarAutoria("openai", briefCanonico(), {
      fetch: fetchContador,
      diretorioCache: dirCache,
    });
    expect(segunda.origem).toBe("cache");
    expect(chamadas).toBe(1);
    expect(segunda.documento).toEqual(DOCUMENTO_VALIDO_MINIMO);
  });

  it("mudar UM componente da chave gera MISS (C12, um por vez)", async () => {
    const fetchContador: typeof fetch = (async () => {
      return new Response(
        JSON.stringify({
          id: "x",
          object: "chat.completion",
          created: 0,
          model: "gpt-4o-mini",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: JSON.stringify(DOCUMENTO_VALIDO_MINIMO) },
              finish_reason: "stop",
            },
          ],
          usage: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    await chamarAutoria("openai", briefCanonico(), { fetch: fetchContador, diretorioCache: dirCache });

    // model diferente → miss
    const outroModelo = await chamarAutoria("openai", briefCanonico(), {
      modelo: "gpt-4o",
      fetch: fetchContador,
      diretorioCache: dirCache,
    });
    expect(outroModelo.origem).toBe("chamada");

    // brief diferente (messages) → miss
    const outroBrief = await chamarAutoria("openai", { ...briefCanonico(), tema: "Outro tema" }, {
      fetch: fetchContador,
      diretorioCache: dirCache,
    });
    expect(outroBrief.origem).toBe("chamada");

    // provedor diferente (output_config + modelo) → miss
    const outroProvedor = await chamarAutoria("anthropic", briefCanonico(), {
      fetch: (async () => {
        return new Response(
          JSON.stringify({
            id: "x",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-4-5",
            content: [{ type: "output_json", name: "documento_autoria", json: DOCUMENTO_VALIDO_MINIMO }],
            stop_reason: "end_turn",
            usage: {},
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
      diretorioCache: dirCache,
    });
    expect(outroProvedor.origem).toBe("chamada");
  });

  it("o replay offline a partir do cassete entrega o documento gravado", async () => {
    const cassete = lerCassete("openai");
    const replay = await chamarAutoria("openai", briefCanonico(), {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        // Usa o fetch do cassete de verdade (URL gravada).
        const { criarFetchDoCasseteAutoria } = await import(
          "src/autoria/executor/cassete.js"
        );
        return criarFetchDoCasseteAutoria(cassete, diretorioDoCassete("openai"))(
          input,
          init,
        );
      }) as typeof fetch,
      diretorioCache: dirCache,
    });
    expect(replay.documento).toEqual(cassete.resultado);
  });

  it("uma saida invalida do provedor e rejeitada ANTES do pipeline (ErroContratoAutoria)", async () => {
    const invalida = { sem_campos: true };
    const chamada = chamarAutoria("openai", briefCanonico(), {
      fetch: fetchQueEntrega(invalida),
      diretorioCache: dirCache,
    });
    await expect(chamada).rejects.toBeInstanceOf(ErroContratoAutoria);
  });

  it("a saida do CACHE tambem passa pelo gate (cache nao e porta de fuga)", async () => {
    // Primeira chamada grava um documento valido; depois o arquivo de
    // cache e substituido por um documento invalido; a chamada seguinte
    // (HIT) tem de ser barrada pelo gate.
    await chamarAutoria("openai", briefCanonico(), {
      fetch: fetchQueEntrega(DOCUMENTO_VALIDO_MINIMO),
      diretorioCache: dirCache,
    });
    const { escreverNoCache } = await import("src/autoria/contrato/cache.js");
    const { montarEntrada: montar } = await import("src/autoria/executor/executor.js");
    escreverNoCache(montar("openai", briefCanonico(), {}), { invalido: true });

    const chamada = chamarAutoria("openai", briefCanonico(), {
      fetch: (async () => {
        throw new Error("o fetch nao pode ser chamado em HIT");
      }) as typeof fetch,
      diretorioCache: dirCache,
    });
    await expect(chamada).rejects.toBeInstanceOf(ErroContratoAutoria);
  });
});
