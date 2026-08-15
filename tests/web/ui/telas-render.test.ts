// =============================================================================
// Telas e roteador — App, NovoProjeto e Projeto (sem DOM, sem servidor)
// =============================================================================
// O App escuta hashchange e troca de tela; sem servidor, o fetch global e
// o guarda de rede (tests/setup/rede-bloqueada.ts) — as telas que chamam a
// API caem no caminho de ERRO HONESTO (FQ-U4), que e o que estes testes
// verificam: a tela nunca trava, nunca mostra sucesso mentiroso; o erro
// do envelope (aqui, erro-inesperado por rede bloqueada) aparece.
//
// A janela e um stub minimo (location.hash + addEventListener) — os
// fluxos de sucesso (criar projeto, abrir projeto) exigem servidor real
// e ficam fora do alcance sem DOM/servidor (documentado no handoff).
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act } from "react";
import { App } from "../../../src/web/ui/src/App.js";
import { NovoProjeto } from "../../../src/web/ui/src/telas/NovoProjeto.js";
import { Projeto } from "../../../src/web/ui/src/telas/Projeto.js";
import { existeTestId, montar, porTestId } from "./ajuda/render.js";
import { jobDe, pedacoDe, textosDa } from "./ajuda/stubs.js";

// ─── Stub minimo de window (hash + eventos) ───────────────────────────────────

interface JanelaStub {
  location: { hash: string; origin: string };
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function montarJanelaStub(hashInicial = ""): { janela: JanelaStub; dispararHash(novo: string): void } {
  const ouvintes: Array<{ tipo: string; fn: () => void }> = [];
  const janela: JanelaStub = {
    location: { hash: hashInicial, origin: "" },
    addEventListener: vi.fn((tipo: string, fn: () => void) => {
      ouvintes.push({ tipo, fn });
    }),
    removeEventListener: vi.fn((tipo: string, fn: () => void) => {
      const indice = ouvintes.findIndex((o) => o.tipo === tipo && o.fn === fn);
      if (indice >= 0) {
        ouvintes.splice(indice, 1);
      }
    }),
  };
  return {
    janela,
    dispararHash(novo: string) {
      janela.location.hash = novo;
      for (const o of [...ouvintes]) {
        if (o.tipo === "hashchange") {
          o.fn();
        }
      }
    },
  };
}

beforeEach(() => {
  const { janela } = montarJanelaStub("");
  (globalThis as { window?: unknown }).window = janela;
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  globalThis.fetch = FETCH_BLOQUEADO;
  vi.useRealTimers();
});

// ─── Stub de fetch global (a tela Projeto cria o cliente com o fetch
// global — aqui o stub e o ponto de injecao, como nos demais testes da
// suite; nenhuma rede real acontece, o guarda continua ativo para tudo
// que nao for o stub). ─────────────────────────────────────────────────────────

interface RespostaDeFetch {
  readonly status: number;
  readonly corpo?: unknown;
}

const FETCH_BLOQUEADO = globalThis.fetch;

function instalarFetchDeProjeto(rotas: Record<string, RespostaDeFetch>): void {
  globalThis.fetch = (async (entrada: RequestInfo | URL, iniciador?: RequestInit) => {
    const url = typeof entrada === "string" ? entrada : String(entrada);
    const chave = `${iniciador?.method ?? "GET"} ${url}`;
    const resposta = rotas[chave] ?? rotas[`* ${url}`];
    if (resposta === undefined) {
      throw new Error(`fetch de teste: rota inesperada ${chave}`);
    }
    // 204/205/304 nao podem carregar corpo (o Response do Node rejeita).
    const corpo = resposta.status === 204 ? null : resposta.corpo === undefined ? "" : JSON.stringify(resposta.corpo);
    return new Response(corpo, {
      status: resposta.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof globalThis.fetch;
}

function respostaProjetoFixture() {
  return {
    projeto: {
      id: "proj-001",
      brief: { tema: "como funciona um cache", contexto: "para iniciantes", duracao_alvo_segundos: 90 },
      roteiro: {
        schema_version: "1.0",
        duracao_total_segundos: 30,
        pedacos: [
          pedacoDe({ id: "p-000", fala: "fala sem narracao" }),
          pedacoDe({
            id: "p-001",
            indice: 1,
            fala: "fala narrada",
            narracao: { texto: "fala narrada", origem: "gravacao", status: "gerado", hash_audio: "h" },
          }),
          pedacoDe({ id: "p-002", indice: 2, fala: "" }),
        ],
      },
      pedacos_editados: {},
      criado_em: "2026-08-14T10:00:00.000Z",
      atualizado_em: "2026-08-14T10:00:00.000Z",
    },
    jobs: {
      gerar_roteiro: null,
      previews: { "p-001": { job_id: "jp-1", estado: "ok", progresso: 1 } },
      juntar: null,
    },
  };
}

function rotasDoProjeto(opcoes: {
  juntar?: RespostaDeFetch;
  jobJuntar?: RespostaDeFetch;
  projeto?: unknown;
  roteiroGerar?: RespostaDeFetch;
  jobGerar?: RespostaDeFetch;
} = {}): Record<string, RespostaDeFetch> {
  const projeto = opcoes.projeto ?? respostaProjetoFixture();
  return {
    "GET /api/projetos/proj-001": { status: 200, corpo: projeto },
    "POST /api/projetos/proj-001/juntar": opcoes.juntar ?? { status: 202, corpo: { job_id: "job-j" } },
    "GET /api/jobs/job-j": opcoes.jobJuntar ?? { status: 200, corpo: jobDe({ estado: "rodando", progresso: 0.5 }) },
    "DELETE /api/projetos/proj-001": { status: 204 },
    "POST /api/projetos/proj-001/roteiro/gerar": opcoes.roteiroGerar ?? { status: 202, corpo: { job_id: "job-g" } },
    "GET /api/jobs/job-g": opcoes.jobGerar ?? { status: 200, corpo: jobDe({ estado: "ok", artefato: { tipo: "roteiro-json", caminho: "/api/rot.json" } }) },
  };
}

describe("App — roteador por hash", () => {
  it("hash vazio renderiza a tela de novo projeto", () => {
    const { arvore } = montar(createElement(App));
    expect(existeTestId(arvore, "tela-novo-projeto")).toBe(true);
  });

  it("hashchange para #/projeto/<id> troca para a tela do projeto", async () => {
    const { janela, dispararHash } = montarJanelaStub("");
    (globalThis as { window?: unknown }).window = janela;

    const montada = montar(createElement(App));
    expect(existeTestId(montada.arvore, "tela-novo-projeto")).toBe(true);

    await act(async () => {
      dispararHash("#/projeto/p-001");
    });

    // Sem servidor (rede bloqueada): a tela do projeto mostra o ERRO
    // honesto — nunca uma tela congelada em "Carregando…".
    expect(existeTestId(montada.arvore, "tela-projeto")).toBe(true);
    expect(existeTestId(montada.arvore, "erro-global")).toBe(true);
    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("Não foi possível abrir o projeto");
    expect(textos).toContain("não foi possível carregar o projeto");
    // O erro honesto traz o caminho de re-tentativa e o link de volta.
    expect(existeTestId(montada.arvore, "botao-tentar-novamente-erro")).toBe(true);
    expect(existeTestId(montada.arvore, "link-voltar-inicio")).toBe(true);

    // Volta para o inicio pelo evento.
    await act(async () => {
      dispararHash("#/");
    });
    expect(existeTestId(montada.arvore, "tela-novo-projeto")).toBe(true);
    montada.desmontar();
  });

  it("desmontar remove o listener de hashchange (sem vazamento de evento)", () => {
    const { janela } = montarJanelaStub("");
    (globalThis as { window?: unknown }).window = janela;
    const montada = montar(createElement(App));
    expect(janela.addEventListener).toHaveBeenCalledWith("hashchange", expect.any(Function));
    montada.desmontar();
    expect(janela.removeEventListener).toHaveBeenCalledWith("hashchange", expect.any(Function));
  });
});

describe("NovoProjeto — validacao do tema e erro honesto", () => {
  it("submit com tema vazio recusa ANTES do envio (nunca chama a rede)", async () => {
    const { arvore } = montar(createElement(NovoProjeto));

    await act(async () => {
      const formulario = arvore.root.findAllByProps({ className: "painel-formulario" })[0]!;
      (formulario.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: vi.fn() });
    });

    const textos = textosDa(arvore.toJSON()).join("");
    expect(textos).toContain("descreva o tema do vídeo");
  });

  it("submit com tema valido, sem servidor, mostra o erro honesto do envio", async () => {
    const { arvore } = montar(createElement(NovoProjeto));

    await act(async () => {
      porTestId(arvore, "campo-tema").props.onChange({ target: { value: "como funciona um cache" } });
    });
    await act(async () => {
      const formulario = arvore.root.findAllByProps({ className: "painel-formulario" })[0]!;
      (formulario.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: vi.fn() });
    });

    // A rede esta bloqueada pelo guarda: o POST nao sai, o erro aparece.
    const textos = textosDa(arvore.toJSON()).join("");
    expect(textos).toContain("não foi possível criar o projeto — verifique se o servidor está no ar");
  });

  it("submit com servidor respondendo cria o projeto e navega para a tela dele pelo hash", async () => {
    instalarFetchDeProjeto({
      "POST /api/projetos": {
        status: 201,
        corpo: { id: "proj-novo", brief: { tema: "meu tema" }, pedacos_editados: {}, criado_em: "", atualizado_em: "" },
      },
    });
    const { arvore } = montar(createElement(NovoProjeto));

    await act(async () => {
      porTestId(arvore, "campo-tema").props.onChange({ target: { value: "meu tema" } });
    });
    await act(async () => {
      porTestId(arvore, "campo-contexto").props.onChange({ target: { value: "para iniciantes" } });
    });
    await act(async () => {
      const formulario = arvore.root.findAllByProps({ className: "painel-formulario" })[0]!;
      (formulario.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: vi.fn() });
    });

    // Navegou pelo hash (quem monta a tela do projeto e o App).
    const janela = globalThis.window as { location: { hash: string } } | undefined;
    expect(janela?.location.hash).toBe("#/projeto/proj-novo");
  });
});

describe("Projeto — tela sem servidor", () => {
  it("abre em carregando e, sem resposta real, mostra o erro honesto com re-tentativa", async () => {
    const montada = montar(createElement(Projeto, { id: "proj-001" }));

    // O efeito de carregar roda; a rede bloqueada leva ao erro.
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    expect(existeTestId(montada.arvore, "erro-global")).toBe(true);
    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("não foi possível carregar o projeto");
    expect(existeTestId(montada.arvore, "botao-tentar-novamente-erro")).toBe(true);
    montada.desmontar();
  });
});

describe("Projeto — tela com servidor (fetch stub como ponto de injecao)", () => {
  it("carrega o projeto e renderiza cabecalho, pedacos, avisos e o painel de juntar", async () => {
    instalarFetchDeProjeto(rotasDoProjeto());
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("como funciona um cache");
    expect(textos).toContain("duração alvo 1min 30s");
    expect(existeTestId(montada.arvore, "lista-pedacos")).toBe(true);
    // Aviso record-first: p-000 tem fala sem narracao (FQ-U3).
    expect(existeTestId(montada.arvore, "aviso-fala-sem-narracao")).toBe(true);
    expect(textos).toContain("1 pedaço com fala ainda sem narração");
    // Aviso parcial de preview: so p-001 tem preview ok.
    expect(existeTestId(montada.arvore, "aviso-preview-ausente")).toBe(true);
    expect(textos).toContain("2 pedaços sem preview renderizado");
    // O painel de juntar existe e o botao esta habilitado (roteiro pronto).
    expect(existeTestId(montada.arvore, "botao-juntar")).toBe(true);
    expect(porTestId(montada.arvore, "botao-juntar").props.disabled).toBe(false);
    // FQ-U3 no card: p-000 com fala tem gravador; p-002 sem fala nao tem.
    expect(existeTestId(montada.arvore, "gravador-p-000")).toBe(true);
    expect(existeTestId(montada.arvore, "gravador-p-002")).toBe(false);
    // Badge de narracao no card narrado.
    expect(textos).toContain("voz gravada");
    montada.desmontar();
  });

  it("409 do juntar (juntar-fala-sem-narracao) destaca os cards da lista de detalhes (FQ-U4)", async () => {
    instalarFetchDeProjeto(
      rotasDoProjeto({
        juntar: {
          status: 409,
          corpo: {
            erro: {
              codigo: "juntar-fala-sem-narracao",
              mensagem: "fala nao narrada",
              detalhes: ["pedacos[0].id p-000: regra juntar-fala-sem-narracao — fala nao narrada"],
            },
          },
        },
      }),
    );
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    expect(existeTestId(montada.arvore, "botao-juntar")).toBe(true);
    await act(async () => {
      (porTestId(montada.arvore, "botao-juntar").props.onClick as () => void)();
    });
    await act(async () => {});

    // O card apontado pelo detalhes ganha o destaque "falta ação".
    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("falta ação");
    expect(textos).toContain("fala nao narrada");
    expect(porTestId(montada.arvore, "pedaco-p-000").props.className).toContain("pedaco-destacado");
    montada.desmontar();
  });

  it("juntar ok exibe o video final e o download (FQ-U2: sucesso com resposta real)", async () => {
    vi.useFakeTimers();
    instalarFetchDeProjeto(
      rotasDoProjeto({
        jobJuntar: {
          status: 200,
          corpo: jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "video-mp4", caminho: "/api/projetos/proj-001/video-final.mp4" } }),
        },
      }),
    );
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    expect(existeTestId(montada.arvore, "video-final")).toBe(false);
    await act(async () => {
      (porTestId(montada.arvore, "botao-juntar").props.onClick as () => void)();
    });
    // Poll imediato (job ja ok) + aoConcluir (setVideoFinalPronto + refetch).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {});

    expect(existeTestId(montada.arvore, "video-final")).toBe(true);
    expect(existeTestId(montada.arvore, "botao-baixar-video")).toBe(true);
    const video = porTestId(montada.arvore, "botao-baixar-video");
    expect(video.props.href).toContain("/api/projetos/proj-001/video-final.mp4");
    montada.desmontar();
  });

  it("video final que falha no carregamento esconde e avisa (nunca quadro preto)", async () => {
    vi.useFakeTimers();
    instalarFetchDeProjeto(
      rotasDoProjeto({
        jobJuntar: {
          status: 200,
          corpo: jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "video-mp4", caminho: "/api/projetos/proj-001/video-final.mp4" } }),
        },
      }),
    );
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});
    await act(async () => {
      (porTestId(montada.arvore, "botao-juntar").props.onClick as () => void)();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {});
    expect(existeTestId(montada.arvore, "video-final")).toBe(true);

    await act(async () => {
      // O <video> DENTRO do bloco video-final (os cards de preview tambem
      // tem <video> — mirar o da entrega final).
      const bloco = porTestId(montada.arvore, "video-final");
      const videoFinal = bloco.findByType("video");
      (videoFinal.props.onError as () => void)();
    });

    expect(existeTestId(montada.arvore, "video-final")).toBe(false);
    expect(existeTestId(montada.arvore, "erro-video-final")).toBe(true);
    montada.desmontar();
  });

  it("projeto sem roteiro mostra o CTA 'Roteiro ainda não gerado' e o job de gerar funciona", async () => {
    vi.useFakeTimers();
    const semRoteiro = respostaProjetoFixture() as { projeto: { roteiro?: unknown; brief: { contexto?: string } } };
    semRoteiro.projeto.roteiro = undefined;
    semRoteiro.projeto.brief.contexto = undefined;
    instalarFetchDeProjeto(rotasDoProjeto({ projeto: semRoteiro }));
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    expect(existeTestId(montada.arvore, "painel-gerar-roteiro")).toBe(true);
    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("Roteiro ainda não gerado");
    // Sem roteiro o juntar fica desabilitado (nada a juntar).
    expect(porTestId(montada.arvore, "botao-juntar").props.disabled).toBe(true);

    await act(async () => {
      (porTestId(montada.arvore, "botao-gerar-roteiro").props.onClick as () => void)();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {});

    // O job de gerar concluiu: a barra mostra o estado (FQ-U2).
    const aposGerar = textosDa(montada.arvore.toJSON()).join("");
    expect(aposGerar).toContain("Gerando roteiro concluído");
    montada.desmontar();
  });

  it("recarregou no meio do gerar roteiro: o resumo retoma o poll e conclui", async () => {
    vi.useFakeTimers();
    const comGerarEmAndamento = respostaProjetoFixture() as { jobs: { gerar_roteiro: unknown } };
    comGerarEmAndamento.jobs.gerar_roteiro = { job_id: "job-g2", estado: "rodando", progresso: 0.3 };
    const rotas = rotasDoProjeto({ projeto: comGerarEmAndamento });
    rotas["GET /api/jobs/job-g2"] = {
      status: 200,
      corpo: jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "roteiro-json", caminho: "/api/rot.json" } }),
    };
    instalarFetchDeProjeto(rotas);
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("Gerando roteiro concluído");
    montada.desmontar();
  });

  it("poll do juntar que expira (404) mostra 'o job expirou — refaca a operacao' e libera re-tentar", async () => {
    vi.useFakeTimers();
    const rotas = rotasDoProjeto();
    rotas["GET /api/jobs/job-j"] = { status: 404, corpo: { erro: { codigo: "job-nao-encontrado", mensagem: "job expirou" } } };
    instalarFetchDeProjeto(rotas);
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});
    await act(async () => {
      (porTestId(montada.arvore, "botao-juntar").props.onClick as () => void)();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {});

    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("o job expirou — refaca a operacao");
    expect(existeTestId(montada.arvore, "botao-tentar-novamente-juntar")).toBe(true);
    montada.desmontar();
  });

  it("recarregou no meio do juntar: o resumo do GET projeto retoma o poll e conclui (FQ-U4)", async () => {
    vi.useFakeTimers();
    const comJuntarEmAndamento = respostaProjetoFixture() as { jobs: { juntar: unknown } };
    comJuntarEmAndamento.jobs.juntar = { job_id: "job-j2", estado: "rodando", progresso: 0.2 };
    const rotas = rotasDoProjeto({ projeto: comJuntarEmAndamento });
    rotas["GET /api/jobs/job-j2"] = {
      status: 200,
      corpo: jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "video-mp4", caminho: "/api/projetos/proj-001/video-final.mp4" } }),
    };
    instalarFetchDeProjeto(rotas);
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    // Sem clique: o efeito de retomar rodou no mount e o poll concluiu.
    expect(existeTestId(montada.arvore, "video-final")).toBe(true);
    montada.desmontar();
  });

  it("excluir que falha mostra o erro sem derrubar a tela (erro nao-fatal)", async () => {
    instalarFetchDeProjeto({ ...rotasDoProjeto(), "DELETE /api/projetos/proj-001": { status: 500, corpo: { erro: { codigo: "erro-interno", mensagem: "falha ao apagar" } } } });
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    await act(async () => {
      (porTestId(montada.arvore, "botao-excluir").props.onClick as () => void)();
    });
    await act(async () => {});

    // O projeto continua na tela; o erro do envelope aparece no aviso.
    expect(existeTestId(montada.arvore, "lista-pedacos")).toBe(true);
    const textos = textosDa(montada.arvore.toJSON()).join("");
    expect(textos).toContain("falha ao apagar");
    montada.desmontar();
  });

  it("excluir projeto apaga (DELETE 204) e navega para o inicio pelo hash", async () => {
    instalarFetchDeProjeto(rotasDoProjeto());
    const montada = montar(createElement(Projeto, { id: "proj-001" }));
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {});

    const { janela } = montarJanelaStub("");
    (globalThis as { window?: unknown }).window = janela;
    await act(async () => {
      (porTestId(montada.arvore, "botao-excluir").props.onClick as () => void)();
    });
    await act(async () => {});

    expect(janela.location.hash).toBe("#/");
    montada.desmontar();
  });
});
