// =============================================================================
// CLIENTE DE API DA SPA — funcoes PURAS (sem DOM, sem rede real)
// =============================================================================
// Onda 6 (spa-frontend): o cliente de api.ts e testado com `fetch`
// INJETADO — o guarda de rede (tests/setup/rede-bloqueada.ts) continua
// ligado e nenhum teste toca a rede de verdade.
//
// Cobertura: montagem de URLs (base + query ?nome=), envelope de erro
// {erro:{codigo,mensagem,detalhes}}, uploads com body CRU (nunca
// multipart), 202 + Location, GET de blob, e o poll de jobs (transicoes
// pendente->rodando->ok, backoff, 404 = "job expirou", teto de tempo,
// aborto). "ok" so com artefato e conferido em estado-jobs.test.ts.
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";
import { CODIGOS_ERRO, ErroApi, criarClienteApi, pollarJob } from "../../../src/web/ui/src/api.js";
import type { FuncaoFetch } from "../../../src/web/ui/src/api.js";
import type { JobStatus } from "../../../src/web/jobs.js";

const BASE = "http://servidor-teste.local";

/** Resposta simulada do stub — corpo JSON ou string; cabecalhos extras. */
interface RespostaSimulada {
  readonly status: number;
  readonly corpo?: unknown;
  readonly cabecalhos?: Record<string, string>;
  readonly tipo?: string;
}

/** Chamada registrada pelo stub. */
interface ChamadaRegistrada {
  readonly url: string;
  readonly metodo: string | undefined;
  readonly corpo: unknown;
  readonly cabecalhos: HeadersInit | undefined;
}

/**
 * Stub de fetch: devolve as respostas da fila, uma por chamada, e
 * registra URL/metodo/corpo/cabecalhos para as assercoes. Chamada sem
 * resposta na fila FALHA alto (nunca verde por esquecimento — anti-C2).
 */
function criarStub(respostas: RespostaSimulada[]): { fetchImpl: FuncaoFetch; chamadas: ChamadaRegistrada[] } {
  const chamadas: ChamadaRegistrada[] = [];
  const fetchImpl: FuncaoFetch = async (entrada, iniciador) => {
    const url = typeof entrada === "string" ? entrada : String(entrada);
    chamadas.push({
      url,
      metodo: iniciador?.method,
      corpo: iniciador?.body,
      cabecalhos: iniciador?.headers,
    });
    const simulada = respostas.shift();
    if (simulada === undefined) {
      throw new Error("stub sem resposta na fila — a chamada nao foi prevista");
    }
    // 204/205/304 nao podem carregar corpo (o Response do Node rejeita
    // body nao-nulo com esses status) — DELETE sem corpo e o caso real.
    const corpo =
      simulada.status === 204
        ? null
        : simulada.corpo === undefined
          ? ""
          : typeof simulada.corpo === "string"
            ? simulada.corpo
            : JSON.stringify(simulada.corpo);
    return new Response(corpo, {
      status: simulada.status,
      headers: { "Content-Type": simulada.tipo ?? "application/json", ...simulada.cabecalhos },
    });
  };
  return { fetchImpl, chamadas };
}

function clienteCom(stub: ReturnType<typeof criarStub>) {
  return criarClienteApi({ baseUrl: BASE, fetchImpl: stub.fetchImpl });
}

afterEach(() => {
  vi.useRealTimers();
});

// ─── Montagem de URLs e corpo ────────────────────────────────────────────────

describe("criarProjeto", () => {
  it("faz POST /api/projetos com o brief em JSON e devolve o projeto", async () => {
    const projeto = { id: "proj-001", brief: { tema: "cache" }, pedacos_editados: {}, criado_em: "", atualizado_em: "" };
    const stub = criarStub([{ status: 201, corpo: projeto }]);
    const cliente = clienteCom(stub);

    const resultado = await cliente.criarProjeto({ tema: "como funciona um cache", duracao_alvo_segundos: 60 });

    expect(resultado.id).toBe("proj-001");
    expect(stub.chamadas).toHaveLength(1);
    expect(stub.chamadas[0]!.url).toBe(`${BASE}/api/projetos`);
    expect(stub.chamadas[0]!.metodo).toBe("POST");
    expect(JSON.parse(String(stub.chamadas[0]!.corpo))).toEqual({
      brief: { tema: "como funciona um cache", duracao_alvo_segundos: 60 },
    });
  });
});

describe("montagem de URLs", () => {
  it("base + caminho para GET projeto (same-origin derivado da base)", async () => {
    const stub = criarStub([{ status: 200, corpo: { projeto: null, jobs: null } }]);
    const cliente = clienteCom(stub);
    await cliente.obterProjeto("proj-abc");
    expect(stub.chamadas[0]!.url).toBe(`${BASE}/api/projetos/proj-abc`);
    expect(stub.chamadas[0]!.metodo).toBe("GET");
  });

  it("upload de anexo leva ?nome= urlencoded (espacos e acentos)", async () => {
    const stub = criarStub([{ status: 201, corpo: { hash: "h", tipo: "image/gif", tamanho: 10, nome_original: "x" } }]);
    const cliente = clienteCom(stub);
    await cliente.enviarAnexo("proj-001", "p-000", new Uint8Array([1, 2]), "image/gif", "reação legal.gif");
    const url = stub.chamadas[0]!.url;
    expect(url).toContain(`?nome=${encodeURIComponent("reação legal.gif")}`);
    expect(url).not.toContain("reação legal.gif");
  });
});

// ─── Envelope de erro ────────────────────────────────────────────────────────

describe("envelope de erro (api.md)", () => {
  it("404 projeto-nao-encontrado vira ErroApi com codigo nomeado", async () => {
    const stub = criarStub([
      { status: 404, corpo: { erro: { codigo: "projeto-nao-encontrado", mensagem: "projeto \"x\" nao existe" } } },
    ]);
    const cliente = clienteCom(stub);

    const erro = await cliente.obterProjeto("x").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    // `mensagem` de Error nao e enumeravel (toMatchObject nao a ve) —
    // as assertivas sao por propriedade, e a mensagem do envelope tem de
    // chegar ao usuario, nunca texto generico (FQ-U4).
    expect((erro as ErroApi).codigo).toBe("projeto-nao-encontrado");
    expect((erro as ErroApi).status).toBe(404);
    expect((erro as ErroApi).mensagem).toBe('projeto "x" nao existe');
  });

  it("400 com detalhes (regras nomeadas do validador) preserva os detalhes", async () => {
    const stub = criarStub([
      {
        status: 400,
        corpo: { erro: { codigo: "brief-invalido", mensagem: "brief invalido", detalhes: ["(raiz).brief.tema: campo ausente"] } },
      },
    ]);
    const cliente = clienteCom(stub);

    const promessa = cliente.criarProjeto({ tema: "" });
    await expect(promessa).rejects.toMatchObject({ codigo: "brief-invalido", detalhes: ["(raiz).brief.tema: campo ausente"] });
  });

  it("corpo que nao e o envelope vira erro-inesperado (nunca sucesso silencioso — C1)", async () => {
    const stub = criarStub([{ status: 500, corpo: "internal server error sem envelope" }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.obterProjeto("proj-001");
    await expect(promessa).rejects.toMatchObject({ codigo: "erro-inesperado", status: 500 });
  });

  it("204 (DELETE narracao) nao quebra — corpo vazio e sucesso", async () => {
    const stub = criarStub([{ status: 204 }]);
    const cliente = clienteCom(stub);
    await expect(cliente.removerNarracao("proj-001", "p-000")).resolves.toBeUndefined();
  });
});

// ─── Uploads com body cru ────────────────────────────────────────────────────

describe("uploads (narracao e anexo — body CRU, nunca multipart)", () => {
  it("PUT narracao/audio envia os bytes com Content-Type do MediaRecorder", async () => {
    const stub = criarStub([{ status: 201, corpo: { texto: "fala", origem: "gravacao", status: "gerado", hash_audio: "h" } }]);
    const cliente = clienteCom(stub);
    const bytes = new Uint8Array([0x1f, 0xf6, 0x75, 0x78]);

    await cliente.enviarGravacao("proj-001", "p-000", bytes, "audio/webm;codecs=opus");

    const chamada = stub.chamadas[0]!;
    expect(chamada.metodo).toBe("PUT");
    expect(chamada.url).toBe(`${BASE}/api/projetos/proj-001/pedacos/p-000/narracao/audio`);
    expect(chamada.corpo).toBe(bytes);
    const cabecalhos = chamada.cabecalhos as Record<string, string>;
    expect(cabecalhos["Content-Type"]).toBe("audio/webm;codecs=opus");
    // Sem multipart: o Content-Type e o tipo REAL do blob, nunca
    // boundary/multipart/form-data (api.md: uploads falam bytes crus).
    expect(String(chamada.cabecalhos)).not.toContain("multipart");
    expect(String(chamada.cabecalhos)).not.toContain("boundary");
  });

  it("409 pedaco-sem-fala do upload de narracao vira ErroApi nomeado", async () => {
    const stub = criarStub([{ status: 409, corpo: { erro: { codigo: "pedaco-sem-fala", mensagem: "sem fala nao ha o que narrar" } } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.enviarGravacao("proj-001", "p-000", new Uint8Array([1]), "audio/webm");
    await expect(promessa).rejects.toMatchObject({ codigo: "pedaco-sem-fala" });
  });

  it("GET narracao/audio devolve blob com tipo audio/wav", async () => {
    const stub = criarStub([{ status: 200, corpo: "RIFFxxxx", tipo: "audio/wav" }]);
    const cliente = clienteCom(stub);

    const blob = await cliente.obterAudioNarracao("proj-001", "p-000");

    expect(blob.type).toBe("audio/wav");
    expect(await blob.text()).toBe("RIFFxxxx");
  });

  it("404 narracao-nao-gravada do GET de audio vira ErroApi nomeado", async () => {
    const stub = criarStub([{ status: 404, corpo: { erro: { codigo: "narracao-nao-gravada", mensagem: "sem gravacao" } } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.obterAudioNarracao("proj-001", "p-000");
    await expect(promessa).rejects.toMatchObject({ codigo: "narracao-nao-gravada" });
  });
});

// ─── 202 + Location (jobs) ───────────────────────────────────────────────────

describe("aceite de job (202 + Location)", () => {
  it("le o job_id do corpo {job_id} (a fonte primaria do servidor)", async () => {
    const stub = criarStub([{ status: 202, corpo: { job_id: "job-abc" }, cabecalhos: { Location: "/api/jobs/job-abc" } }]);
    const cliente = clienteCom(stub);

    const aceito = await cliente.pedirPreview("proj-001", "p-000");

    expect(aceito.jobId).toBe("job-abc");
  });

  it("cai para o Location header quando o corpo nao traz job_id", async () => {
    const stub = criarStub([{ status: 202, cabecalhos: { Location: "/api/jobs/job-pelo-location" } }]);
    const cliente = clienteCom(stub);

    const aceito = await cliente.gerarRoteiro("proj-001", {});

    expect(aceito.jobId).toBe("job-pelo-location");
  });

  it("resposta 2xx sem job_id nem Location e erro-inesperado (nunca job fantasma)", async () => {
    const stub = criarStub([{ status: 200, corpo: { outra_coisa: true } }]);
    const cliente = clienteCom(stub);

    const promessa = cliente.regenerarPedaco("proj-001", "p-000");
    await expect(promessa).rejects.toMatchObject({ codigo: "erro-inesperado" });
  });

  it("pedirJuntar envia corpo vazio (musica opcional ausente)", async () => {
    const stub = criarStub([{ status: 202, corpo: { job_id: "job-j" } }]);
    const cliente = clienteCom(stub);
    await cliente.pedirJuntar("proj-001");
    expect(JSON.parse(String(stub.chamadas[0]!.corpo))).toEqual({});
  });
});

// ─── Poll de jobs ────────────────────────────────────────────────────────────

function jobDe(parcial: Partial<JobStatus> & { estado: JobStatus["estado"] }): JobStatus {
  return {
    id: "job-poll",
    tipo: "gerar-roteiro",
    estado: parcial.estado,
    progresso: parcial.progresso ?? null,
    mensagem: parcial.mensagem ?? "",
    erro: parcial.erro ?? null,
    criado_em: "2026-08-14T10:00:00.000Z",
    atualizado_em: "2026-08-14T10:00:03.000Z",
    artefato: parcial.artefato ?? null,
  };
}

describe("pollarJob", () => {
  it("polla pendente -> rodando -> ok com backoff multiplicativo e reporta cada status", async () => {
    vi.useFakeTimers();
    const vistos: string[] = [];
    const fila = [
      jobDe({ estado: "pendente", progresso: 0 }),
      jobDe({ estado: "rodando", progresso: 0.5 }),
      jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "roteiro-json", caminho: "/api/projetos/proj-001" } }),
    ];
    const obter = async (): Promise<JobStatus> => fila.shift()!;

    const promessa = pollarJob(obter, "job-poll", {
      intervaloInicialMs: 100,
      fator: 2,
      tetoDoIntervaloMs: 1000,
      aoStatus: (job) => vistos.push(job.estado),
    });

    // Primeiro poll imediato (sem timer).
    await vi.advanceTimersByTimeAsync(0);
    expect(vistos).toEqual(["pendente"]);
    // Segundo poll apos 100 ms.
    await vi.advanceTimersByTimeAsync(100);
    expect(vistos).toEqual(["pendente", "rodando"]);
    // Terceiro poll apos 200 ms (fator 2) — terminal.
    await vi.advanceTimersByTimeAsync(200);

    const final = await promessa;
    expect(final.estado).toBe("ok");
    expect(final.artefato?.caminho).toBe("/api/projetos/proj-001");
    expect(vistos).toEqual(["pendente", "rodando", "ok"]);
  });

  it("404 do GET job vira ErroApi job-expirou (jobs efemeros — api.md)", async () => {
    vi.useFakeTimers();
    const obter = async (): Promise<JobStatus> => {
      throw new ErroApi(CODIGOS_ERRO.JOB_NAO_ENCONTRADO, "job expirou", 404);
    };

    const promessa = pollarJob(obter, "job-morto", { intervaloInicialMs: 100 });

    await expect(promessa).rejects.toMatchObject({ codigo: "job-expirou" });
  });

  it("estoura o teto total de espera com job-tempo-esgotado (nunca pendura para sempre)", async () => {
    vi.useFakeTimers();
    const obter = async (): Promise<JobStatus> => jobDe({ estado: "rodando", progresso: 0.1 });

    const promessa = pollarJob(obter, "job-lento", { intervaloInicialMs: 100, fator: 1.2, tetoTotalMs: 500 });
    // A assertiva PRECISA estar amarrada antes de avancar os timers: a
    // rejeicao nasce dentro do flush e, sem handler ja preso, vira
    // unhandled rejection em vez de falha de teste (C2 nao vale aqui —
    // o sinal tem de ser a assertiva).
    const assertiva = expect(promessa).rejects.toMatchObject({ codigo: "job-tempo-esgotado" });

    await vi.advanceTimersByTimeAsync(600);
    await assertiva;
  });

  it("sinal de aborto encerra o poll com codigo abortado (componente desmontou)", async () => {
    vi.useFakeTimers();
    const sinal = { abortado: false };
    const obter = async (): Promise<JobStatus> => jobDe({ estado: "pendente" });

    const promessa = pollarJob(obter, "job-abort", { intervaloInicialMs: 100, sinalAbortar: sinal });
    await vi.advanceTimersByTimeAsync(0);
    sinal.abortado = true;
    const assertiva = expect(promessa).rejects.toMatchObject({ codigo: "abortado" });

    await vi.advanceTimersByTimeAsync(100);
    await assertiva;
  });

  it("estado terminal de erro devolve o job (a mensagem real vem do JobStatus)", async () => {
    vi.useFakeTimers();
    const obter = async (): Promise<JobStatus> =>
      jobDe({ estado: "erro", erro: "ffmpeg: arquivo nao encontrado (saida real do CLI)" });

    const promessa = pollarJob(obter, "job-erro", { intervaloInicialMs: 100 });
    await vi.advanceTimersByTimeAsync(0);

    const final = await promessa;
    expect(final.estado).toBe("erro");
    expect(final.erro).toContain("ffmpeg");
  });
});

// ─── URLs publicas de arquivo ────────────────────────────────────────────────

describe("urls publicas de arquivo (C7: caminho publico, nunca disco)", () => {
  it("urlDePreview monta a rota do mp4 e aceita bust de cache ?v=", () => {
    const stub = criarStub([]);
    const cliente = clienteCom(stub);
    expect(cliente.urlDePreview("proj-001", "p-002")).toBe("/api/projetos/proj-001/pedacos/p-002/preview.mp4");
    expect(cliente.urlDePreview("proj-001", "p-002", "v1")).toBe(
      "/api/projetos/proj-001/pedacos/p-002/preview.mp4?v=v1",
    );
  });

  it("urlDeVideoFinal monta a rota do video final", () => {
    const stub = criarStub([]);
    const cliente = clienteCom(stub);
    expect(cliente.urlDeVideoFinal("proj-001")).toBe("/api/projetos/proj-001/video-final.mp4");
  });
});
