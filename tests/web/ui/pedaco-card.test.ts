// =============================================================================
// PedacoCard — regras de exibicao e jobs por pedaco (sem DOM)
// =============================================================================
// FQ-U3: o botao de GRAVACAO so existe quando o pedaco tem fala. Jobs de
// regenerar/preview vivem aqui (usarJob): o video do preview so aparece
// com resposta real (job ok + artefato — derivarJob confere), o 409/404
// do poll vira erro honesto, e o resumo do GET projeto retoma o poll de
// um preview em andamento.
// =============================================================================

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { CODIGOS_ERRO, ErroApi } from "../../../src/web/ui/src/api.js";
import { PedacoCard } from "../../../src/web/ui/src/componentes/PedacoCard.js";
import type { ClienteApi, StatusJobResumido } from "../../../src/web/ui/src/api.js";
import { existeTestId, montar, porTestId } from "./ajuda/render.js";
import { criarClienteStub, jobDe, pedacoDe, textosDa } from "./ajuda/stubs.js";
import type { JobStatus } from "../../../src/web/jobs.js";

function filaDeJobs(...jobs: JobStatus[]): (jobId: string) => Promise<JobStatus> {
  const fila = [...jobs];
  return async (): Promise<JobStatus> => {
    const proximo = fila.shift();
    if (proximo === undefined) {
      throw new Error("fila de jobs esgotada");
    }
    return proximo;
  };
}

function montarCard(opcoes: {
  pedaco?: ReturnType<typeof pedacoDe>;
  temEdicao?: boolean;
  resumoPreview?: StatusJobResumido | null;
  destacado?: boolean;
  obterJob?: (jobId: string) => Promise<JobStatus>;
} = {}) {
  const stub = criarClienteStub({ obterJob: opcoes.obterJob });
  stub.pedirPreview.mockResolvedValue({ jobId: "job-prev" });
  stub.regenerarPedaco.mockResolvedValue({ jobId: "job-regen" });
  const aoMudar = vi.fn(async () => undefined);
  const montada = montar(
    createElement(PedacoCard, {
      cliente: stub.cliente as ClienteApi,
      projetoId: "proj-001",
      pedaco: opcoes.pedaco ?? pedacoDe(),
      temEdicao: opcoes.temEdicao ?? false,
      resumoPreview: opcoes.resumoPreview ?? null,
      destacado: opcoes.destacado ?? false,
      aoMudar,
    }),
  );
  return { arvore: montada.arvore, stub, aoMudar, desmontar: () => montada.desmontar() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PedacoCard — FQ-U3: gravacao de voz SO com fala", () => {
  it("pedaco sem fala nao renderiza o gravador (regra do pai)", () => {
    const { arvore } = montarCard({ pedaco: pedacoDe({ fala: "" }) });
    expect(existeTestId(arvore, "gravador-p-000")).toBe(false);
    expect(existeTestId(arvore, "botao-gravar-p-000")).toBe(false);
  });

  it("pedaco com fala renderiza o gravador", () => {
    const { arvore } = montarCard({ pedaco: pedacoDe({ fala: "texto narrado" }) });
    expect(existeTestId(arvore, "gravador-p-000")).toBe(true);
  });
});

describe("PedacoCard — badges e edicao", () => {
  it("narracao gravada mostra 'voz gravada'; status editado mostra 'voz desatualizada'", () => {
    const gravada = montarCard({
      pedaco: pedacoDe({ fala: "x", narracao: { texto: "x", origem: "gravacao", status: "gerado", hash_audio: "h" } }),
    });
    expect(textosDa(gravada.arvore.toJSON()).join("")).toContain("voz gravada");

    const editada = montarCard({
      pedaco: pedacoDe({ fala: "x", narracao: { texto: "velho", origem: "gravacao", status: "editado", hash_audio: "h" } }),
    });
    expect(textosDa(editada.arvore.toJSON()).join("")).toContain("voz desatualizada");
  });

  it("temEdicao mostra badge 'editado' e troca o rotulo do regenerar", () => {
    const { arvore } = montarCard({ temEdicao: true });
    const textos = textosDa(arvore.toJSON()).join("");
    expect(textos).toContain("editado");
    expect(textos).toContain("Regenerar após edição");
  });

  it("destacado (409 do juntar) mostra badge 'falta ação' e a classe de destaque", () => {
    const { arvore } = montarCard({ destacado: true });
    expect(textosDa(arvore.toJSON()).join("")).toContain("falta ação");
    const artigo = arvore.root.findAllByProps({ className: "pedaco-card pedaco-destacado" })[0];
    expect(artigo).toBeDefined();
  });

  it("botao Editar abre o modal de edicao", async () => {
    const { arvore } = montarCard();
    expect(existeTestId(arvore, "modal-edicao")).toBe(false);

    await act(async () => {
      (porTestId(arvore, "botao-editar-p-000").props.onClick as () => void)();
    });

    expect(existeTestId(arvore, "modal-edicao")).toBe(true);
  });
});

describe("PedacoCard — preview: o video so aparece com resposta real (FQ-U2)", () => {
  it("clicar em Gerar preview cria o job e o video aparece apos o poll ok", async () => {
    vi.useFakeTimers();
    const { arvore, stub, aoMudar } = montarCard({
      pedaco: pedacoDe({ fala: "x" }),
      obterJob: filaDeJobs(
        jobDe({ estado: "pendente", progresso: 0 }),
        jobDe({ estado: "rodando", progresso: 0.5 }),
        jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "video-mp4", caminho: "/api/preview.mp4" } }),
      ),
    });

    await act(async () => {
      (porTestId(arvore, "botao-gerar-preview-p-000").props.onClick as () => void)();
    });

    expect(stub.pedirPreview).toHaveBeenCalledWith("proj-001", "p-000");
    // Job em andamento: NENHUM video (nunca sucesso sem resposta real).
    expect(existeTestId(arvore, "video-preview-p-000")).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(560);
    });
    await act(async () => {
      // flush do aoConcluir (setPreviewVisivel + aoMudar).
    });

    expect(existeTestId(arvore, "video-preview-p-000")).toBe(true);
    // A versao do bust de cache vem do job (atualizado_em do terminal).
    expect(stub.urlDePreview).toHaveBeenCalledWith("proj-001", "p-000", "2026-08-14T10:00:03.000Z");
    expect(aoMudar).toHaveBeenCalled();
  });

  it("poll do preview que expira (404) vira 'o job expirou — refaca a operacao'", async () => {
    vi.useFakeTimers();
    const { arvore } = montarCard({
      pedaco: pedacoDe({ fala: "x" }),
      obterJob: async () => {
        throw new ErroApi(CODIGOS_ERRO.JOB_NAO_ENCONTRADO, "job expirou", 404);
      },
    });

    await act(async () => {
      (porTestId(arvore, "botao-gerar-preview-p-000").props.onClick as () => void)();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // FQ-U4: o erro nomeado do poll aparece com a acao de re-tentar.
    const textos = textosDa(arvore.toJSON()).join("");
    expect(textos).toContain("o job expirou — refaca a operacao");
    expect(existeTestId(arvore, "botao-tentar-novamente-preview-p-000")).toBe(true);
    expect(existeTestId(arvore, "video-preview-p-000")).toBe(false);
  });

  it("job de preview com erro nao mostra video e a barra exibe a mensagem real", async () => {
    vi.useFakeTimers();
    const { arvore } = montarCard({
      pedaco: pedacoDe({ fala: "x" }),
      obterJob: filaDeJobs(jobDe({ estado: "erro", erro: "manim: scene inexistente" })),
    });

    await act(async () => {
      (porTestId(arvore, "botao-gerar-preview-p-000").props.onClick as () => void)();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(existeTestId(arvore, "video-preview-p-000")).toBe(false);
    const textos = textosDa(arvore.toJSON()).join("");
    expect(textos).toContain("manim: scene inexistente");
  });

  it("video que falha no carregamento (onError) esconde e avisa — nunca quadro preto", async () => {
    vi.useFakeTimers();
    const { arvore } = montarCard({
      pedaco: pedacoDe({ fala: "x" }),
      obterJob: filaDeJobs(jobDe({ estado: "ok", artefato: { tipo: "video-mp4", caminho: "/api/preview.mp4" } })),
    });

    await act(async () => {
      (porTestId(arvore, "botao-gerar-preview-p-000").props.onClick as () => void)();
    });
    await act(async () => {
      // flush do poll imediato (ok terminal) + aoConcluir.
    });

    expect(existeTestId(arvore, "video-preview-p-000")).toBe(true);

    await act(async () => {
      const video = porTestId(arvore, "video-preview-p-000");
      (video.props.onError as () => void)();
    });

    expect(existeTestId(arvore, "video-preview-p-000")).toBe(false);
    const textos = textosDa(arvore.toJSON()).join("");
    expect(textos).toContain("O preview ainda não está pronto");
  });

  it("resumo 'rodando' do GET projeto retoma o poll do preview (pagina recarregou)", async () => {
    vi.useFakeTimers();
    const { arvore } = montarCard({
      pedaco: pedacoDe({ fala: "x" }),
      resumoPreview: { job_id: "job-resumo", estado: "rodando", progresso: 0.4 },
      obterJob: filaDeJobs(jobDe({ estado: "ok", artefato: { tipo: "video-mp4", caminho: "/api/preview.mp4" } })),
    });

    // O efeito de retomar roda no mount; o poll termina em microtarefas.
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    expect(existeTestId(arvore, "video-preview-p-000")).toBe(true);
  });
});

describe("PedacoCard — regenerar (job)", () => {
  it("clicar em Regenerar cria o job de regeneracao e conclui com refetch", async () => {
    vi.useFakeTimers();
    const { arvore, stub, aoMudar } = montarCard({
      pedaco: pedacoDe({ fala: "x" }),
      obterJob: filaDeJobs(
        jobDe({ estado: "rodando", progresso: 0.3 }),
        jobDe({ estado: "ok", artefato: { tipo: "roteiro-json", caminho: "/api/rot.json" } }),
      ),
    });

    await act(async () => {
      (porTestId(arvore, "botao-regenerar-p-000").props.onClick as () => void)();
    });

    expect(stub.regenerarPedaco).toHaveBeenCalledWith("proj-001", "p-000");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      await Promise.resolve();
    });

    // aoConcluir do regenerar e o refetch do projeto (aoMudar).
    expect(aoMudar).toHaveBeenCalled();
    const textos = textosDa(arvore.toJSON()).join("");
    expect(textos).toContain("concluído");
  });
});
