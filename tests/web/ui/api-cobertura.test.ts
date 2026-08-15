// =============================================================================
// CLIENTE DE API — COBERTURA COMPLEMENTAR (Onda 6, sub-onda de testes)
// =============================================================================
// Completa api.test.ts nas lacunas: rotas do contrato nao exercitadas
// (listarProjetos, atualizarBrief, apagarProjeto, editarPedaco, obterAnexo,
// removerAnexo, obterJob), construtores de URL publica que faltavam,
// baseDaSpa em ambiente sem window, arestas do envelope de erro
// (parsearErroDoCorpo), erros de rede crus (fetch que rejeita — o cliente
// NAO pode engolir em erro-inesperado), 413/409/404 em verbos nao cobertos,
// arestas do pedido de job (job_id nao-string, Location fora do padrao) e
// caminhos de erro do pollarJob (rethrow de erro nao-404, teto de intervalo).
//
// O contrato e docs/roteiro/api.md + src/roteiro/contrato/rotas.ts (as 21
// rotas) — o teste verifica o CONTRATO, nunca a implementacao.
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CODIGOS_ERRO,
  ErroApi,
  criarClienteApi,
  parsearErroDoCorpo,
  pollarJob,
} from "../../../src/web/ui/src/api.js";
import { BASE_DE_TESTE, criarStubFetch, jobDe } from "./ajuda/stubs.js";
import type { ChamadaRegistrada } from "./ajuda/stubs.js";
import type { JobStatus } from "../../../src/web/jobs.js";

function clienteCom(stub: ReturnType<typeof criarStubFetch>) {
  return criarClienteApi({ baseUrl: BASE_DE_TESTE, fetchImpl: stub.fetchImpl });
}

afterEach(() => {
  vi.useRealTimers();
});

// ─── As 21 rotas do contrato: as que api.test.ts nao exercita ─────────────────

describe("rotas do contrato ainda nao exercitadas (rotas.ts)", () => {
  it("listarProjetos: GET /api/projetos devolve a lista resumida", async () => {
    const stub = criarStubFetch([
      { status: 200, corpo: { projetos: [{ id: "p1", tema: "t", criado_em: "", atualizado_em: "" }] } },
    ]);
    const cliente = clienteCom(stub);

    const resultado = await cliente.listarProjetos();

    expect(resultado.projetos).toHaveLength(1);
    expect(resultado.projetos[0]!.id).toBe("p1");
    expect(stub.chamadas[0]!.url).toBe(`${BASE_DE_TESTE}/api/projetos`);
    expect(stub.chamadas[0]!.metodo).toBe("GET");
    expect(stub.chamadas[0]!.corpo).toBeUndefined();
  });

  it("atualizarBrief: PATCH /api/projetos/:id com {brief} no corpo", async () => {
    const stub = criarStubFetch([{ status: 200, corpo: { id: "proj-001", brief: {}, pedacos_editados: {}, criado_em: "", atualizado_em: "" } }]);
    const cliente = clienteCom(stub);

    await cliente.atualizarBrief("proj-001", { tema: "novo tema", duracao_alvo_segundos: 90 });

    const chamada = stub.chamadas[0]!;
    expect(chamada.metodo).toBe("PATCH");
    expect(chamada.url).toBe(`${BASE_DE_TESTE}/api/projetos/proj-001`);
    expect(JSON.parse(String(chamada.corpo))).toEqual({ brief: { tema: "novo tema", duracao_alvo_segundos: 90 } });
  });

  it("apagarProjeto: DELETE 204 devolve undefined e nao quebra", async () => {
    const stub = criarStubFetch([{ status: 204 }]);
    const cliente = clienteCom(stub);

    await expect(cliente.apagarProjeto("proj-001")).resolves.toBeUndefined();
    expect(stub.chamadas[0]!.metodo).toBe("DELETE");
    expect(stub.chamadas[0]!.url).toBe(`${BASE_DE_TESTE}/api/projetos/proj-001`);
  });

  it("editarPedaco: PATCH envia o DELTA CRU (nao embrulhado) e devolve o pedaco", async () => {
    const delta = { titulo: "novo", fala: "fala", duracao_segundos: 12.5, tipo_visual: "grafico" as const };
    const stub = criarStubFetch([{ status: 200, corpo: { id: "p-000", indice: 0, titulo: "novo" } }]);
    const cliente = clienteCom(stub);

    const resultado = await cliente.editarPedaco("proj-001", "p-000", delta);

    expect(resultado.id).toBe("p-000");
    const chamada = stub.chamadas[0]!;
    expect(chamada.metodo).toBe("PATCH");
    expect(chamada.url).toBe(`${BASE_DE_TESTE}/api/projetos/proj-001/pedacos/p-000`);
    // O delta vai como CORPO DIRETO — o servidor valida o shape completo
    // (validarEdicaoPedaco); embrulhar em {delta} quebraria o contrato.
    expect(JSON.parse(String(chamada.corpo))).toEqual(delta);
  });

  it("editarPedaco: 409 do estado conflitante vira ErroApi nomeado", async () => {
    const stub = criarStubFetch([
      { status: 409, corpo: { erro: { codigo: "pedaco-em-uso", mensagem: "regeneracao em andamento" } } },
    ]);
    const cliente = clienteCom(stub);

    const promessa = cliente.editarPedaco("proj-001", "p-000", { titulo: "x" });
    await expect(promessa).rejects.toMatchObject({ codigo: "pedaco-em-uso", status: 409 });
  });

  it("obterAnexo: GET devolve blob com o tipo do arquivo", async () => {
    const stub = criarStubFetch([{ status: 200, corpo: "GIF89a", tipo: "image/gif" }]);
    const cliente = clienteCom(stub);

    const blob = await cliente.obterAnexo("proj-001", "p-000");

    expect(blob.type).toBe("image/gif");
    expect(await blob.text()).toBe("GIF89a");
  });

  it("obterAnexo: 404 anexo-inexistente vira ErroApi nomeado", async () => {
    const stub = criarStubFetch([{ status: 404, corpo: { erro: { codigo: "anexo-inexistente", mensagem: "sem anexo" } } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.obterAnexo("proj-001", "p-000");
    await expect(promessa).rejects.toMatchObject({ codigo: "anexo-inexistente" });
  });

  it("obterAnexo: 404 com corpo NAO-envelope vira erro-inesperado (C1 — nunca sucesso mentiroso)", async () => {
    const stub = criarStubFetch([{ status: 404, corpo: "pagina de erro HTML" }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.obterAnexo("proj-001", "p-000");
    await expect(promessa).rejects.toMatchObject({ codigo: "erro-inesperado", status: 404 });
  });

  it("removerAnexo: DELETE 204 sem corpo", async () => {
    const stub = criarStubFetch([{ status: 204 }]);
    const cliente = clienteCom(stub);

    await expect(cliente.removerAnexo("proj-001", "p-000")).resolves.toBeUndefined();
    expect(stub.chamadas[0]!.metodo).toBe("DELETE");
    expect(stub.chamadas[0]!.url).toBe(`${BASE_DE_TESTE}/api/projetos/proj-001/pedacos/p-000/anexo`);
  });

  it("obterJob: GET /api/jobs/:jobId devolve o JobStatus completo", async () => {
    const stub = criarStubFetch([{ status: 200, corpo: jobDe({ estado: "rodando", progresso: 0.4 }) }]);
    const cliente = clienteCom(stub);

    const job = await cliente.obterJob("job-abc");

    expect(job.estado).toBe("rodando");
    expect(job.progresso).toBe(0.4);
    expect(stub.chamadas[0]!.url).toBe(`${BASE_DE_TESTE}/api/jobs/job-abc`);
  });

  it("obterJob: 404 job-nao-encontrado vira ErroApi (a materia-prima do poll)", async () => {
    const stub = criarStubFetch([{ status: 404, corpo: { erro: { codigo: "job-nao-encontrado", mensagem: "job expirou" } } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.obterJob("job-morto");
    await expect(promessa).rejects.toMatchObject({ codigo: "job-nao-encontrado", status: 404 });
  });
});

// ─── URLs publicas de arquivo que faltavam ────────────────────────────────────

describe("urls publicas de arquivo — cobertura", () => {
  it("urlDeAudioNarracao monta a rota do wav", () => {
    const stub = criarStubFetch([]);
    const cliente = clienteCom(stub);
    expect(cliente.urlDeAudioNarracao("proj-001", "p-000")).toBe(
      "/api/projetos/proj-001/pedacos/p-000/narracao/audio",
    );
  });

  it("urlDeAnexo monta a rota do anexo", () => {
    const stub = criarStubFetch([]);
    const cliente = clienteCom(stub);
    expect(cliente.urlDeAnexo("proj-001", "p-000")).toBe("/api/projetos/proj-001/pedacos/p-000/anexo");
  });

  it("bust de cache ?v= passa por encodeURIComponent (o valor e a versao do artefato)", () => {
    const stub = criarStubFetch([]);
    const cliente = clienteCom(stub);
    expect(cliente.urlDePreview("proj-001", "p-000", "v 1")).toBe(
      "/api/projetos/proj-001/pedacos/p-000/preview.mp4?v=v%201",
    );
    expect(cliente.urlDeVideoFinal("proj-001", "v/2")).toBe(
      "/api/projetos/proj-001/video-final.mp4?v=v%2F2",
    );
  });

  it("baseDaSpa fora do navegador devolve '' (same-origin: a base vem do caller)", () => {
    // Em teste (sem window) a base default e "" — o contrato da SPA e
    // same-origin e quem constroi o cliente passa a base explicita.
    expect(criarClienteApi().baseUrl).toBe("");
  });
});

// ─── Arestas do envelope de erro (parsearErroDoCorpo) ─────────────────────────

describe("parsearErroDoCorpo — arestas do envelope", () => {
  it("detalhes com itens nao-string sao descartados (nunca lixo na tela)", () => {
    const erro = parsearErroDoCorpo(
      { erro: { codigo: "brief-invalido", mensagem: "m", detalhes: ["regra 1", 42, null, { x: 1 }] } },
      400,
    );
    expect(erro.detalhes).toEqual(["regra 1"]);
  });

  it("envelope sem codigo string vira erro-inesperado (o codigo e a ancora da UI)", () => {
    const erro = parsearErroDoCorpo({ erro: { codigo: 123, mensagem: "m" } }, 500);
    expect(erro.codigo).toBe(CODIGOS_ERRO.ERRO_INESPERADO);
    expect(erro.status).toBe(500);
  });

  it("mensagem ausente cai no fallback com o codigo (nunca texto vazio na tela)", () => {
    const erro = parsearErroDoCorpo({ erro: { codigo: "pedaco-sem-fala" } }, 409);
    expect(erro.mensagem).toBe("erro do servidor (pedaco-sem-fala)");
  });

  it("corpo null (resposta sem corpo com status de erro) vira erro-inesperado", () => {
    const erro = parsearErroDoCorpo(null, 500);
    expect(erro.codigo).toBe(CODIGOS_ERRO.ERRO_INESPERADO);
    expect(erro.mensagem).toContain("HTTP 500");
  });

  it("corpo primitivo (string) nunca e engolido como sucesso", () => {
    const erro = parsearErroDoCorpo("apenas texto", 502);
    expect(erro.codigo).toBe(CODIGOS_ERRO.ERRO_INESPERADO);
    expect(erro.status).toBe(502);
  });
});

// ─── Erros de rede crus: o cliente NAO pode embrulhar em erro-inesperado ──────

describe("erro de rede (fetch rejeita) propaga CRU — nunca embrulhado", () => {
  it("pedidoJson (obterProjeto) propaga o TypeError da rede", async () => {
    const fetchImpl: ReturnType<typeof criarStubFetch>["fetchImpl"] = async () => {
      throw new TypeError("Failed to fetch");
    };
    const cliente = criarClienteApi({ baseUrl: BASE_DE_TESTE, fetchImpl });

    const promessa = cliente.obterProjeto("proj-001");
    await expect(promessa).rejects.toThrow(TypeError);
    await expect(promessa).rejects.not.toBeInstanceOf(ErroApi);
  });

  it("pedidoBruto (enviarGravacao) propaga o erro da rede", async () => {
    const fetchImpl: ReturnType<typeof criarStubFetch>["fetchImpl"] = async () => {
      throw new TypeError("network down");
    };
    const cliente = criarClienteApi({ baseUrl: BASE_DE_TESTE, fetchImpl });

    const promessa = cliente.enviarGravacao("proj-001", "p-000", new Uint8Array([1]), "audio/webm");
    await expect(promessa).rejects.toThrow(TypeError);
  });

  it("pedidoBlob (obterAudioNarracao) propaga o erro da rede", async () => {
    const fetchImpl: ReturnType<typeof criarStubFetch>["fetchImpl"] = async () => {
      throw new TypeError("network down");
    };
    const cliente = criarClienteApi({ baseUrl: BASE_DE_TESTE, fetchImpl });

    const promessa = cliente.obterAudioNarracao("proj-001", "p-000");
    await expect(promessa).rejects.toThrow(TypeError);
  });

  it("pedidoJob (gerarRoteiro) propaga o erro da rede", async () => {
    const fetchImpl: ReturnType<typeof criarStubFetch>["fetchImpl"] = async () => {
      throw new TypeError("network down");
    };
    const cliente = criarClienteApi({ baseUrl: BASE_DE_TESTE, fetchImpl });

    const promessa = cliente.gerarRoteiro("proj-001", {});
    await expect(promessa).rejects.toThrow(TypeError);
  });
});

// ─── 413/409/404 nos verbos de upload e job ───────────────────────────────────

describe("status HTTP nos verbos de upload/job — envelope preservado", () => {
  it("413 do PUT anexo vira ErroApi com o codigo do envelope (upload grande)", async () => {
    const stub = criarStubFetch([
      { status: 413, corpo: { erro: { codigo: "anexo-grande-demais", mensagem: "arquivo acima do limite" } } },
    ]);
    const cliente = clienteCom(stub);

    const promessa = cliente.enviarAnexo("proj-001", "p-000", new Uint8Array([1]), "image/gif", "x.gif");
    await expect(promessa).rejects.toMatchObject({ codigo: "anexo-grande-demais", status: 413 });
  });

  it("409 do PUT narracao (pedaco-sem-fala) vira ErroApi nomeado", async () => {
    const stub = criarStubFetch([{ status: 409, corpo: { erro: { codigo: "pedaco-sem-fala", mensagem: "sem fala" } } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.enviarGravacao("proj-001", "p-000", new Uint8Array([1]), "audio/webm");
    await expect(promessa).rejects.toMatchObject({ codigo: "pedaco-sem-fala" });
  });

  it("409 do POST juntar (juntar-fala-sem-narracao) traz a LISTA de pedacos em detalhes (FQ-U4)", async () => {
    const stub = criarStubFetch([
      {
        status: 409,
        corpo: {
          erro: {
            codigo: "juntar-fala-sem-narracao",
            mensagem: "fala nao narrada",
            detalhes: ["pedacos[0].id p-000: regra juntar-fala-sem-narracao", "pedacos[2].id p-002: regra juntar-fala-sem-narracao"],
          },
        },
      },
    ]);
    const cliente = clienteCom(stub);

    const promessa = cliente.pedirJuntar("proj-001");
    await expect(promessa).rejects.toMatchObject({
      codigo: "juntar-fala-sem-narracao",
      detalhes: ["pedacos[0].id p-000: regra juntar-fala-sem-narracao", "pedacos[2].id p-002: regra juntar-fala-sem-narracao"],
    });
  });

  it("404 do DELETE narracao vira ErroApi nomeado (DELETE com erro)", async () => {
    const stub = criarStubFetch([{ status: 404, corpo: { erro: { codigo: "narracao-nao-gravada", mensagem: "sem gravacao" } } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.removerNarracao("proj-001", "p-000");
    await expect(promessa).rejects.toMatchObject({ codigo: "narracao-nao-gravada" });
  });
});

// ─── Corpos de job (pedidoJob) — arestas ──────────────────────────────────────

describe("pedidoJob — arestas do 202", () => {
  it("job_id nao-string no corpo cai para o Location (o corpo so vale quando e string)", async () => {
    const stub = criarStubFetch([{ status: 202, corpo: { job_id: 42 }, cabecalhos: { Location: "/api/jobs/job-pelo-location" } }]);
    const cliente = clienteCom(stub);

    const aceito = await cliente.pedirPreview("proj-001", "p-000");
    expect(aceito.jobId).toBe("job-pelo-location");
  });

  it("Location fora do padrao /api/jobs/:id e erro-inesperado (nunca job fantasma)", async () => {
    const stub = criarStubFetch([{ status: 202, cabecalhos: { Location: "/api/outra-coisa/job-1" } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.pedirJuntar("proj-001");
    await expect(promessa).rejects.toMatchObject({ codigo: "erro-inesperado" });
  });

  it("gerarRoteiro envia duracao_alvo_segundos quando presente (o servidor completa versoes)", async () => {
    const stub = criarStubFetch([{ status: 202, corpo: { job_id: "job-g" } }]);
    const cliente = clienteCom(stub);

    await cliente.gerarRoteiro("proj-001", { duracao_alvo_segundos: 90 });

    const chamada: ChamadaRegistrada = stub.chamadas[0]!;
    expect(JSON.parse(String(chamada.corpo))).toEqual({ duracao_alvo_segundos: 90 });
    expect(chamada.url).toBe(`${BASE_DE_TESTE}/api/projetos/proj-001/roteiro/gerar`);
  });

  it("pedirJuntar com musica envia musica_caminho no corpo", async () => {
    const stub = criarStubFetch([{ status: 202, corpo: { job_id: "job-m" } }]);
    const cliente = clienteCom(stub);

    await cliente.pedirJuntar("proj-001", "musicas/trilha.mp3");

    expect(JSON.parse(String(stub.chamadas[0]!.corpo))).toEqual({ musica_caminho: "musicas/trilha.mp3" });
  });
});

// ─── pollarJob — caminhos de erro e tetos que faltavam ───────────────────────

describe("pollarJob — erros e tetos (cobertura)", () => {
  it("erro ErroApi que NAO e 404 rethrows a MESMA instancia (o poll nao mente o codigo)", async () => {
    vi.useFakeTimers();
    const original = new ErroApi("servidor-quebrado", "500 interno", 500);
    const obter = async (): Promise<JobStatus> => {
      throw original;
    };

    const promessa = pollarJob(obter, "job-500", { intervaloInicialMs: 100 });
    await expect(promessa).rejects.toBe(original);
  });

  it("erro nao-ErroApi (rede) rethrows cru — o poll nunca embrulha em job-expirou", async () => {
    vi.useFakeTimers();
    const obter = async (): Promise<JobStatus> => {
      throw new TypeError("rede caiu");
    };

    const promessa = pollarJob(obter, "job-rede", { intervaloInicialMs: 100 });
    await expect(promessa).rejects.toThrow(TypeError);
  });

  it("404 vira job-expirou COM a mensagem do contrato e status 404", async () => {
    vi.useFakeTimers();
    const obter = async (): Promise<JobStatus> => {
      throw new ErroApi(CODIGOS_ERRO.JOB_NAO_ENCONTRADO, "job expirou", 404);
    };

    const promessa = pollarJob(obter, "job-morto", { intervaloInicialMs: 100 });
    await expect(promessa).rejects.toMatchObject({
      codigo: CODIGOS_ERRO.JOB_EXPIROU,
      mensagem: "o job expirou — refaca a operacao",
      status: 404,
    });
  });

  it("o teto do intervalo trava o backoff (nunca cresce sem limite)", async () => {
    vi.useFakeTimers();
    const vistos: string[] = [];
    const fila = [
      jobDe({ estado: "pendente" }),
      jobDe({ estado: "pendente" }),
      jobDe({ estado: "pendente" }),
      jobDe({ estado: "pendente" }),
      jobDe({ estado: "pendente" }),
      jobDe({ estado: "pendente" }),
      jobDe({ estado: "ok", artefato: { tipo: "video-mp4", caminho: "/api/x.mp4" } }),
    ];
    const obter = async (): Promise<JobStatus> => fila.shift()!;

    const promessa = pollarJob(obter, "job-cap", {
      intervaloInicialMs: 100,
      fator: 2,
      tetoDoIntervaloMs: 1000,
      aoStatus: (job) => vistos.push(job.estado),
    });

    await vi.advanceTimersByTimeAsync(0); // poll 1 (imediato)
    expect(vistos).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100); // poll 2
    await vi.advanceTimersByTimeAsync(200); // poll 3
    await vi.advanceTimersByTimeAsync(400); // poll 4
    await vi.advanceTimersByTimeAsync(800); // poll 5
    await vi.advanceTimersByTimeAsync(1000); // poll 6 (intervalo capado em 1000)
    expect(vistos).toHaveLength(6);
    // Sem o teto, o intervalo 6 seria 1600 — o poll 7 chegaria em 3100;
    // com o teto, so em 3500. Provar o CAP e a discriminacao.
    await vi.advanceTimersByTimeAsync(600); // t=3100: ainda 6 polls
    expect(vistos).toHaveLength(6);
    await vi.advanceTimersByTimeAsync(400); // t=3500: poll 7 (terminal)
    expect(vistos).toHaveLength(7);

    const final = await promessa;
    expect(final.estado).toBe("ok");
  });

  it("job terminal ok VENCE o sinal de aborto ja ligado (terminal primeiro)", async () => {
    vi.useFakeTimers();
    const sinal = { abortado: true };
    const obter = async (): Promise<JobStatus> => jobDe({ estado: "ok", artefato: { tipo: "audio-wav", caminho: "/api/wav" } });

    const promessa = pollarJob(obter, "job-ok", { intervaloInicialMs: 100, sinalAbortar: sinal });
    await vi.advanceTimersByTimeAsync(0);

    const final = await promessa;
    expect(final.estado).toBe("ok");
  });

  it("abortado: sinal ligado com job nao-terminal aborta no ciclo seguinte (nunca em loop)", async () => {
    vi.useFakeTimers();
    const sinal = { abortado: false };
    const obter = async (): Promise<JobStatus> => jobDe({ estado: "rodando", progresso: 0.1 });

    const promessa = pollarJob(obter, "job-abort", { intervaloInicialMs: 100, sinalAbortar: sinal });
    await vi.advanceTimersByTimeAsync(0);
    sinal.abortado = true;
    const assertiva = expect(promessa).rejects.toMatchObject({ codigo: CODIGOS_ERRO.ABORTADO });

    await vi.advanceTimersByTimeAsync(100);
    await assertiva;
  });
});
