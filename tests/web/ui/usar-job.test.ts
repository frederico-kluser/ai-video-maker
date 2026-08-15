// =============================================================================
// usarJob — ciclo de vida do job na UI (hook, sem DOM)
// =============================================================================
// O hook e exercitado com react-test-renderer (arvore pura, sem jsdom):
// criar (POST 202) -> poll com progresso -> concluir (aoConcluir) ou erro
// honesto (aoErro). FQ-U2: sucesso so chega via aoConcluir com JobStatus
// terminal; FQ-U4: o erro do poll (job expirou) chega com o jobId no
// contexto (a UI libera a guarda de resume); ABORTADO no desmonte nunca
// e exibido.
//
// O relogio e fake (vi.useFakeTimers) — o poll default do hook espera
// 400ms/560ms/... entre polls.
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { CODIGOS_ERRO, ErroApi } from "../../../src/web/ui/src/api.js";
import type { ClienteApi } from "../../../src/web/ui/src/api.js";
import { usarJob } from "../../../src/web/ui/src/usar-job.js";
import type { EstadoDeUsarJob, OpcoesDeUsarJob } from "../../../src/web/ui/src/usar-job.js";
import type { JobStatus } from "../../../src/web/jobs.js";
import { criarClienteStub, jobDe } from "./ajuda/stubs.js";
import { habilitarAct } from "./ajuda/render.js";

habilitarAct();

interface Presa {
  estado(): EstadoDeUsarJob;
  desmontar(): void;
}

/** Monta o hook num componente-harness e devolve acesso ao estado. */
function montarHook(cliente: ClienteApi, opcoes: OpcoesDeUsarJob): Presa {
  let estado: EstadoDeUsarJob | null = null;
  function Harness(): null {
    estado = usarJob(cliente, opcoes);
    return null;
  }
  let arvore: TestRenderer.ReactTestRenderer;
  act(() => {
    arvore = TestRenderer.create(createElement(Harness));
  });
  return {
    estado: () => estado!,
    desmontar: () => {
      act(() => {
        arvore.unmount();
      });
    },
  };
}

/** Fila de JobStatus para o obterJob do cliente stub (um por poll). */
function filaDeJobs(...jobs: JobStatus[]): (jobId: string) => Promise<JobStatus> {
  const fila = [...jobs];
  return async (): Promise<JobStatus> => {
    const proximo = fila.shift();
    if (proximo === undefined) {
      throw new Error("fila de jobs esgotada — o poll pediu mais que o previsto");
    }
    return proximo;
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("usarJob — comecar (ciclo feliz)", () => {
  it("cria o job, polla pendente -> rodando -> ok e conclui com o job TERMINAL", async () => {
    vi.useFakeTimers();
    const aoConcluir = vi.fn();
    const aoErro = vi.fn();
    const stub = criarClienteStub({
      obterJob: filaDeJobs(
        jobDe({ estado: "pendente", progresso: 0 }),
        jobDe({ estado: "rodando", progresso: 0.5 }),
        jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "video-mp4", caminho: "/api/x.mp4" } }),
      ),
    });
    const presa = montarHook(stub.cliente, {
      criar: async () => ({ jobId: "job-1" }),
      aoConcluir,
      aoErro,
    });

    expect(presa.estado().ocupado).toBe(false);
    const promessa = presa.estado().comecar();

    // Primeiro poll imediato: pendente (o hook comeca ocupado).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(presa.estado().ocupado).toBe(true);
    expect(presa.estado().job?.estado).toBe("pendente");

    // Segundo poll em 400ms: rodando (progresso atualiza).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(presa.estado().job?.estado).toBe("rodando");
    expect(presa.estado().job?.progresso).toBe(0.5);

    // Terceiro poll em 560ms (fator 1.4): ok — terminal.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(560);
    });
    await act(async () => {
      await promessa;
    });

    expect(presa.estado().ocupado).toBe(false);
    expect(presa.estado().job?.estado).toBe("ok");
    expect(aoConcluir).toHaveBeenCalledTimes(1);
    expect(aoConcluir.mock.calls[0]![0]!.estado).toBe("ok");
    expect(aoErro).not.toHaveBeenCalled();
  });

  it("terminal 'erro' do job conclui via aoConcluir com o job e a saida REAL do CLI (FQ-S3)", async () => {
    vi.useFakeTimers();
    const aoConcluir = vi.fn();
    const aoErro = vi.fn();
    const stub = criarClienteStub({
      obterJob: filaDeJobs(jobDe({ estado: "rodando", progresso: 0.2 }), jobDe({ estado: "erro", erro: "ffmpeg: falhou" })),
    });
    const presa = montarHook(stub.cliente, { criar: async () => ({ jobId: "job-1" }), aoConcluir, aoErro });

    const promessa = presa.estado().comecar();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await promessa;
    });

    // Contrato do hook: aoConcluir recebe o job TERMINAL (ok OU erro) —
    // e o caller (refetch) que decide; o terminal "erro" do JOB nao e um
    // erro de API: a mensagem real do CLI chega via JobStatus.erro.
    expect(aoConcluir).toHaveBeenCalledTimes(1);
    expect(aoConcluir.mock.calls[0]![0]!.estado).toBe("erro");
    expect(aoConcluir.mock.calls[0]![0]!.erro).toBe("ffmpeg: falhou");
    expect(aoErro).not.toHaveBeenCalled();
    expect(presa.estado().job?.estado).toBe("erro");
    expect(presa.estado().erro).toBeNull();
  });
});

describe("usarJob — erros de API honestos (FQ-U4)", () => {
  it("409 do POST criar vira erro com a mensagem do envelope; aoErro SEM jobId", async () => {
    vi.useFakeTimers();
    const aoConcluir = vi.fn();
    const aoErro = vi.fn();
    const stub = criarClienteStub();
    const presa = montarHook(stub.cliente, {
      criar: async () => {
        throw new ErroApi(CODIGOS_ERRO.ANEXO_EXIGIDO_PARA_GIF_VIDEO, "anexo obrigatorio para gif/video", 409);
      },
      aoConcluir,
      aoErro,
    });

    await act(async () => {
      await presa.estado().comecar();
    });

    expect(presa.estado().erro?.codigo).toBe(CODIGOS_ERRO.ANEXO_EXIGIDO_PARA_GIF_VIDEO);
    expect(presa.estado().erro?.mensagem).toBe("anexo obrigatorio para gif/video");
    expect(presa.estado().ocupado).toBe(false);
    expect(presa.estado().job).toBeNull();
    // Erro do POST: sem contexto de poll (a guarda de resume so precisa
    // do jobId quando o erro VEIO do poll).
    expect(aoErro).toHaveBeenCalledTimes(1);
    expect(aoErro.mock.calls[0]![1]).toBeUndefined();
    expect(aoConcluir).not.toHaveBeenCalled();
  });

  it("erro nao-ErroApi do criar vira erro-inesperado com a mensagem do erro cru", async () => {
    vi.useFakeTimers();
    const aoErro = vi.fn();
    const stub = criarClienteStub();
    const presa = montarHook(stub.cliente, {
      criar: async () => {
        throw new TypeError("criar quebrou");
      },
      aoConcluir: vi.fn(),
      aoErro,
    });

    await act(async () => {
      await presa.estado().comecar();
    });

    expect(presa.estado().erro?.codigo).toBe(CODIGOS_ERRO.ERRO_INESPERADO);
    expect(presa.estado().erro?.mensagem).toContain("criar quebrou");
  });

  it("404 do poll (job expirou) vira erro com o jobId no contexto (libera o resume)", async () => {
    vi.useFakeTimers();
    const aoErro = vi.fn();
    const stub = criarClienteStub({
      obterJob: async () => {
        throw new ErroApi(CODIGOS_ERRO.JOB_NAO_ENCONTRADO, "job expirou", 404);
      },
    });
    const presa = montarHook(stub.cliente, { criar: async () => ({ jobId: "job-1" }), aoConcluir: vi.fn(), aoErro });

    const promessa = presa.estado().comecar();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await promessa;
    });

    expect(presa.estado().erro?.codigo).toBe(CODIGOS_ERRO.JOB_EXPIROU);
    expect(presa.estado().erro?.mensagem).toBe("o job expirou — refaca a operacao");
    expect(presa.estado().ocupado).toBe(false);
    expect(aoErro).toHaveBeenCalledTimes(1);
    expect(aoErro.mock.calls[0]![1]).toEqual({ jobId: "job-1" });
  });

  it("erro nao-ErroApi do poll vira erro-inesperado (o poll nunca engole a rede)", async () => {
    vi.useFakeTimers();
    const aoErro = vi.fn();
    const stub = criarClienteStub({
      obterJob: async () => {
        throw new TypeError("rede caiu no poll");
      },
    });
    const presa = montarHook(stub.cliente, { criar: async () => ({ jobId: "job-1" }), aoConcluir: vi.fn(), aoErro });

    const promessa = presa.estado().comecar();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await promessa;
    });

    expect(presa.estado().erro?.codigo).toBe(CODIGOS_ERRO.ERRO_INESPERADO);
    expect(presa.estado().erro?.mensagem).toContain("TypeError");
  });

  it("aoConcluir que rejeita vira erro exibido (o refetch apos o terminal tambem e observado)", async () => {
    vi.useFakeTimers();
    const aoErro = vi.fn();
    const stub = criarClienteStub({
      obterJob: filaDeJobs(jobDe({ estado: "ok", artefato: { tipo: "roteiro-json", caminho: "/api/rot" } })),
    });
    const presa = montarHook(stub.cliente, {
      criar: async () => ({ jobId: "job-1" }),
      aoConcluir: async () => {
        throw new ErroApi("refetch-falhou", "o projeto mudou desde o job", 409);
      },
      aoErro,
    });

    const promessa = presa.estado().comecar();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await promessa;
    });

    expect(presa.estado().erro?.codigo).toBe("refetch-falhou");
    expect(aoErro.mock.calls[0]![1]).toEqual({ jobId: "job-1" });
  });
});

describe("usarJob — aborto no desmonte e retomar", () => {
  it("desmontar no meio do poll aborta em silencio: sem setState, sem aoConcluir, sem aoErro", async () => {
    vi.useFakeTimers();
    const aoConcluir = vi.fn();
    const aoErro = vi.fn();
    const stub = criarClienteStub({
      // Dois polls NAO-terminais: o segundo e o que encontra o sinal de
      // aborto ligado (se o segundo fosse terminal, o poll nao abortaria).
      obterJob: filaDeJobs(jobDe({ estado: "pendente" }), jobDe({ estado: "rodando", progresso: 0.2 })),
    });
    const presa = montarHook(stub.cliente, { criar: async () => ({ jobId: "job-1" }), aoConcluir, aoErro });

    const promessa = presa.estado().comecar();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(presa.estado().job?.estado).toBe("pendente");

    // Componente desmonta: cleanup liga o sinal de aborto.
    presa.desmontar();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await promessa;
    });

    // O poll ABORTOU (sinal) e o hook silenciou: o desmonte nunca exibe
    // erro nem conclui (componente morto nao tem o que atualizar).
    expect(aoConcluir).not.toHaveBeenCalled();
    expect(aoErro).not.toHaveBeenCalled();
  });

  it("criar que rejeita DEPOIS do desmonte e silencioso (nunca setState em componente morto)", async () => {
    vi.useFakeTimers();
    const aoErro = vi.fn();
    const stub = criarClienteStub();
    let liberarRejeicao!: (motivo: unknown) => void;
    const criarPendente = new Promise<{ jobId: string }>((_, rejeitar) => {
      liberarRejeicao = rejeitar;
    });
    const presa = montarHook(stub.cliente, {
      criar: async () => criarPendente,
      aoConcluir: vi.fn(),
      aoErro,
    });

    const promessa = presa.estado().comecar();
    presa.desmontar();
    await act(async () => {
      liberarRejeicao(new TypeError("tarde demais"));
    });
    await act(async () => {
      await promessa;
    });

    expect(aoErro).not.toHaveBeenCalled();
  });

  it("job TERMINAL que resolve apos o desmonte e silencioso (sem aoConcluir em componente morto)", async () => {
    vi.useFakeTimers();
    const aoConcluir = vi.fn();
    const aoErro = vi.fn();
    const stub = criarClienteStub();
    let liberarPoll!: (job: JobStatus) => void;
    stub.obterJob.mockReturnValueOnce(
      new Promise<JobStatus>((resolver) => {
        liberarPoll = resolver;
      }),
    );
    const presa = montarHook(stub.cliente, { criar: async () => ({ jobId: "job-1" }), aoConcluir, aoErro });

    const promessa = presa.estado().comecar();
    presa.desmontar();
    await act(async () => {
      liberarPoll(jobDe({ estado: "ok", artefato: { tipo: "video-mp4", caminho: "/x" } }));
    });
    await act(async () => {
      await promessa;
    });

    expect(aoConcluir).not.toHaveBeenCalled();
    expect(aoErro).not.toHaveBeenCalled();
  });

  it("retomar polla um job ja existente (estado derivado do GET projeto)", async () => {
    vi.useFakeTimers();
    const aoConcluir = vi.fn();
    const stub = criarClienteStub({
      obterJob: filaDeJobs(jobDe({ estado: "rodando", progresso: 0.7 }), jobDe({ estado: "ok", artefato: { tipo: "audio-wav", caminho: "/wav" } })),
    });
    const presa = montarHook(stub.cliente, { criar: async () => ({ jobId: "novo" }), aoConcluir });

    const promessa = presa.estado().retomar("job-resumido");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(presa.estado().ocupado).toBe(true);
    expect(presa.estado().job?.estado).toBe("rodando");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await promessa;
    });

    expect(aoConcluir).toHaveBeenCalledTimes(1);
    expect(aoConcluir.mock.calls[0]![0]!.estado).toBe("ok");
    expect(presa.estado().ocupado).toBe(false);
  });

  it("retomar apos um erro limpa o erro exibido e o ocupado volta ao fim", async () => {
    vi.useFakeTimers();
    const stub = criarClienteStub({
      obterJob: filaDeJobs(jobDe({ estado: "ok", artefato: { tipo: "video-mp4", caminho: "/x" } })),
    });
    const presa = montarHook(stub.cliente, { criar: async () => ({ jobId: "job-1" }), aoConcluir: vi.fn() });

    // Um erro previo (POST 409).
    const stubComErro = criarClienteStub();
    const presaComErro = montarHook(stubComErro.cliente, {
      criar: async () => {
        throw new ErroApi("recusado", "recusado", 409);
      },
      aoConcluir: vi.fn(),
    });
    await act(async () => {
      await presaComErro.estado().comecar();
    });
    expect(presaComErro.estado().erro).not.toBeNull();

    // Retomar limpa o erro e roda o poll normalmente.
    const promessa = presa.estado().retomar("job-2");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await promessa;
    });
    expect(presa.estado().erro).toBeNull();
    expect(presa.estado().ocupado).toBe(false);
    expect(presa.estado().job?.estado).toBe("ok");
  });
});

describe("usarJob — limparErro", () => {
  it("limparErro zera o erro exibido (o usuario fechou o aviso)", async () => {
    vi.useFakeTimers();
    const stub = criarClienteStub();
    const presa = montarHook(stub.cliente, {
      criar: async () => {
        throw new ErroApi("recusado", "recusado", 409);
      },
      aoConcluir: vi.fn(),
    });
    await act(async () => {
      await presa.estado().comecar();
    });
    expect(presa.estado().erro).not.toBeNull();

    act(() => {
      presa.estado().limparErro();
    });
    expect(presa.estado().erro).toBeNull();
  });
});
