/**
 * tests/autoria/rejeicao.test.ts
 *
 * A SUITE DE REJEICAO do card F4-04 — o ∅-crit:
 *
 *   "um manifesto invalido que passa tem de derrubar a suite"
 *
 * A suite le os manifestos INVALIDOS GRAVADOS do cassete (dados
 * estaticos — nao fabricados pelo teste) e exige, para CADA um, que o
 * caminho de rejeicao do executor os rejeite:
 *
 *   1. validacao (validarSaidaAutoria): valido === false;
 *   2. gate (rejeitarSaidaInvalida): lanca ErroContratoAutoria;
 *   3. executor (chamarAutoria com um fetch que entrega o documento):
 *      o documento invalido nao sai do executor — a resposta do LLM so
 *      entra no pipeline depois de validar contra o schema completo
 *      (contrato-w6 §12; a pergunta adversarial 4 do card).
 *
 * Se QUALQUER manifestos invalido gravado passar por qualquer um dos
 * tres niveis, este arquivo fica VERMELHO — e a suite cai. O inverso
 * tambem e coberto: o manifesto BOM gravado (resultado.json) passa pelo
 * gate e chega ao pipeline tipado.
 *
 * Pergunta adversarial 2 do card ("a fixture alimenta a propria
 * assercao?"): a assercao e sobre DADOS GRAVADOS no cassete, avaliados
 * pelo VALIDADOR DO F4-01 (externo a este card). Nada aqui e mutado nem
 * re-derivado do documento bom — os invalidos sao documentos completos,
 * gravados como vieram, um por classe de rejeicao do contrato (AB-432,
 * AB-433, AB-555, decisao-do-sistema).
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import {
  ErroContratoAutoria,
  rejeitarSaidaInvalida,
} from "src/autoria/contrato/rejeitar.js";
import { validarSaidaAutoria } from "src/autoria/contrato/validar.js";
import { definirDiretorioCache, obterDiretorioCache } from "src/autoria/contrato/cache.js";
import { chamarAutoria } from "src/autoria/executor/executor.js";
import { criarFetchDoCasseteAutoria, lerCasseteAutoria } from "src/autoria/executor/cassete.js";
import {
  briefCanonico,
  chaveDoCassete,
  diretorioDoCassete,
  lerCassete,
  raizCassetes,
} from "./helpers.js";

const DIRETORIO_CACHE_ORIGINAL = obterDiretorioCache();
let dirCache: string;

beforeEach(() => {
  dirCache = mkdtempSync(join(tmpdir(), "autoria-rejeicao-"));
  definirDiretorioCache(dirCache);
});

afterEach(() => {
  rmSync(dirCache, { recursive: true, force: true });
});

afterAll(() => {
  definirDiretorioCache(DIRETORIO_CACHE_ORIGINAL);
});

/**
 * Um fetch que entrega um documento como se fosse a resposta do LLM —
 * no formato do envelope de cada provedor, para que a EXTRACAO rode
 * (o que se testa aqui e o gate, nao o parser).
 */
function fetchQueEntrega(provedor: "openai" | "anthropic", documento: unknown): typeof fetch {
  const envelope =
    provedor === "openai"
      ? {
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
        }
      : {
          id: "msg_sonda",
          type: "message",
          role: "assistant",
          model: "claude-sonnet-4-5",
          content: [
            { type: "output_json", name: "documento_autoria", json: documento },
          ],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 10 },
        };
  return async function sosia(
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> {
    return new Response(JSON.stringify(envelope), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

describe("∅-crit — um manifesto invalido que passa derruba a suite", () => {
  for (const provedor of ["openai", "anthropic"] as const) {
    describe(`provedor ${provedor}`, () => {
      const cassete = lerCassete(provedor);

      it("tem invalidos gravados (denominador: a suite nao esta verde por vazio)", () => {
        expect(cassete.invalidos.length).toBeGreaterThanOrEqual(3);
      });

      it("cada manifesto invalido GRAVADO e rejeitado pela validacao do schema completo", () => {
        for (const invalido of cassete.invalidos) {
          const resultado = validarSaidaAutoria(invalido.documento);
          expect(
            resultado.valido,
            `${invalido.id}: ${invalido.motivo} — a validacao aceitou o documento`,
          ).toBe(false);
          expect(resultado.erros.length).toBeGreaterThan(0);
        }
      });

      it("cada manifesto invalido GRAVADO e rejeitado pelo gate (rejeitarSaidaInvalida)", () => {
        for (const invalido of cassete.invalidos) {
          let erro: unknown = null;
          try {
            rejeitarSaidaInvalida(invalido.documento);
          } catch (e) {
            erro = e;
          }
          expect(
            erro,
            `${invalido.id}: ${invalido.motivo} — o gate deixou o documento passar`,
          ).toBeInstanceOf(ErroContratoAutoria);
        }
      });

      it("cada manifesto invalido GRAVADO e barrado pelo EXECUTOR (gate antes do pipeline)", async () => {
        for (const invalido of cassete.invalidos) {
          // Cache proprio por invalido: cada um passa DE VERDADE pelo
          // caminho de chamada (um cache compartilhado serviria o
          // primeiro invalido para os demais).
          const chamada = chamarAutoria(provedor, briefCanonico(), {
            fetch: fetchQueEntrega(provedor, invalido.documento),
            diretorioCache: join(dirCache, invalido.id),
          });
          await expect(
            chamada,
            `${invalido.id}: ${invalido.motivo} — o executor devolveu o documento ao pipeline`,
          ).rejects.toBeInstanceOf(ErroContratoAutoria);
        }
      });

      it("o manifesto BOM gravado (resultado.json) passa pelo gate e chega ao pipeline", async () => {
        let recebido: unknown = null;
        try {
          rejeitarSaidaInvalida(cassete.resultado);
          recebido = cassete.resultado;
        } catch (e) {
          expect.unreachable(
            `resultado.json nao deveria ter sido rejeitado: ${String(e)}`,
          );
        }
        expect((recebido as { schema_version: string }).schema_version).toBe("Autoria.1");

        // E pelo executor: o replay offline do cassete entrega o mesmo
        // documento validado.
        const replay = await chamarAutoria(provedor, briefCanonico(), {
          fetch: criarFetchDoCasseteAutoria(
            cassete,
            diretorioDoCassete(provedor),
          ),
          diretorioCache: dirCache,
        });
        expect(replay.documento).toEqual(cassete.resultado);
      });

      it("o replay offline do cassete passa pelo GATE antes de sair (origem da chamada)", async () => {
        const replay = await chamarAutoria(provedor, briefCanonico(), {
          fetch: criarFetchDoCasseteAutoria(
            cassete,
            diretorioDoCassete(provedor),
          ),
          diretorioCache: dirCache,
        });
        expect(replay.origem).toBe("chamada");
      });
    });
  }

  it("uma resposta rejeitada NUNCA e cacheada — a 2a chamada faz chamada real (P2)", async () => {
    const cassete = lerCassete("openai");
    const primeiroInvalido = cassete.invalidos[0]!;
    // A resposta invalida e barrada pelo gate...
    const primeira = await chamarAutoria("openai", briefCanonico(), {
      fetch: fetchQueEntrega("openai", primeiroInvalido.documento),
      diretorioCache: dirCache,
    }).catch((e: unknown) => e);
    expect(primeira).toBeInstanceOf(ErroContratoAutoria);
    // ...e NUNCA chega ao cache (P2: gate ANTES da escrita — sonda por
    // ausencia do arquivo com a chave da entrada rejeitada).
    const { caminhoDoCache } = await import("src/autoria/contrato/cache.js");
    const { montarEntrada } = await import("src/autoria/executor/executor.js");
    expect(existsSync(caminhoDoCache(montarEntrada("openai", briefCanonico(), {})))).toBe(
      false,
    );
    // A 2a chamada (MESMA entrada) NAO serve do cache: faz chamada real.
    // O cache nao e porta de fuga do gate — e a resposta rejeitada nao
    // envenena a tentativa seguinte.
    let chamadas = 0;
    const segunda = await chamarAutoria("openai", briefCanonico(), {
      fetch: (async () => {
        chamadas += 1;
        const envelope = {
          id: "msg_sonda",
          object: "chat.completion",
          created: 0,
          model: "gpt-4o-mini",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
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
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: {},
        };
        return new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch,
      diretorioCache: dirCache,
    });
    expect(segunda.origem).toBe("chamada");
    expect(chamadas).toBe(1);
  });
});

describe("replay offline a partir do cassete (mesmo fetch do executor)", () => {
  for (const provedor of ["openai", "anthropic"] as const) {
    it(`o provedor ${provedor} reproduz a chamada gravada pela URL e pelo corpo`, async () => {
      const chave = chaveDoCassete(provedor);
      const cassete = lerCasseteAutoria(raizCassetes(), chave);
      const fetchReplay = criarFetchDoCasseteAutoria(
        cassete,
        diretorioDoCassete(provedor),
      );
      // A chamada gravada tem de ser reproduzida (sosia, nao sucessor):
      // uma URL fora do cassete LANCA em vez de cair para a rede.
      await expect(
        fetchReplay("https://api.exemplo.com/nao-gravado", { method: "POST" }),
      ).rejects.toThrow(/nao gravada/);
    });
  }
});
