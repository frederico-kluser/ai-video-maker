/**
 * tests/web/ui/ajuda/stubs.ts
 *
 * Infraestrutura compartilhada dos testes da SPA (Onda 6, sub-onda de
 * cobertura). Este arquivo NAO e coletado pelo vitest (fora do glob
 * "tests/**\/\*.test.ts") — so os testes o importam.
 *
 * Sem jsdom (REPLAN): os componentes sao exercitados com react-test-renderer
 * (arvore pura de objetos, sem DOM) e o cliente de API com fetch INJETADO —
 * o guarda de rede (tests/setup/rede-bloqueada.ts) permanece ligado.
 */

import { vi } from "vitest";
import type { Mock } from "vitest";
import type { ClienteApi, FuncaoFetch } from "../../../../src/web/ui/src/api.js";
import type { JobStatus } from "../../../../src/web/jobs.js";
import type { Pedaco } from "../../../../src/roteiro/contrato/contrato.js";

export const BASE_DE_TESTE = "http://servidor-teste.local";

// ─── Stub de fetch por fila ───────────────────────────────────────────────────

export interface RespostaSimulada {
  readonly status: number;
  readonly corpo?: unknown;
  readonly cabecalhos?: Record<string, string>;
  readonly tipo?: string;
}

export interface ChamadaRegistrada {
  readonly url: string;
  readonly metodo: string | undefined;
  readonly corpo: unknown;
  readonly cabecalhos: HeadersInit | undefined;
}

/**
 * Stub de fetch: devolve as respostas da fila (uma por chamada) e
 * registra URL/metodo/corpo/cabecalhos. Chamada sem resposta na fila
 * FALHA alto — nunca verde por esquecimento (anti-C2).
 */
export function criarStubFetch(respostas: RespostaSimulada[]): {
  fetchImpl: FuncaoFetch;
  chamadas: ChamadaRegistrada[];
} {
  const chamadas: ChamadaRegistrada[] = [];
  const fetchImpl: FuncaoFetch = async (entrada, iniciador) => {
    const url = typeof entrada === "string" ? entrada : String(entrada);
    chamadas.push({ url, metodo: iniciador?.method, corpo: iniciador?.body, cabecalhos: iniciador?.headers });
    const simulada = respostas.shift();
    if (simulada === undefined) {
      throw new Error("stub sem resposta na fila — a chamada nao foi prevista");
    }
    // 204/205/304 nao podem carregar corpo (Response do Node rejeita).
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

// ─── Cliente de API com todos os metodos como mocks ───────────────────────────

export interface ClienteStub {
  readonly cliente: ClienteApi;
  readonly obterJob: Mock;
  readonly criarProjeto: Mock;
  readonly listarProjetos: Mock;
  readonly obterProjeto: Mock;
  readonly atualizarBrief: Mock;
  readonly apagarProjeto: Mock;
  readonly gerarRoteiro: Mock;
  readonly regenerarPedaco: Mock;
  readonly editarPedaco: Mock;
  readonly enviarGravacao: Mock;
  readonly obterAudioNarracao: Mock;
  readonly removerNarracao: Mock;
  readonly enviarAnexo: Mock;
  readonly obterAnexo: Mock;
  readonly removerAnexo: Mock;
  readonly pedirPreview: Mock;
  readonly pedirJuntar: Mock;
  readonly urlDePreview: Mock;
  readonly urlDeVideoFinal: Mock;
  readonly urlDeAudioNarracao: Mock;
  readonly urlDeAnexo: Mock;
}

/**
 * Cliente completo da SPA com todos os metodos vazios (vi.fn()) — cada
 * teste configura so o que vai exercitar. `obterJob` aceita uma fila de
 * JobStatus (o poll consome um por chamada).
 */
export function criarClienteStub(opcoes: { obterJob?: (jobId: string) => Promise<JobStatus> } = {}): ClienteStub {
  const obterJob = vi.fn(
    opcoes.obterJob ??
      (async (): Promise<JobStatus> => {
        throw new Error("obterJob sem fila configurada no stub");
      }),
  );
  const criarProjeto = vi.fn();
  const listarProjetos = vi.fn();
  const obterProjeto = vi.fn();
  const atualizarBrief = vi.fn();
  const apagarProjeto = vi.fn();
  const gerarRoteiro = vi.fn();
  const regenerarPedaco = vi.fn();
  const editarPedaco = vi.fn();
  const enviarGravacao = vi.fn();
  const obterAudioNarracao = vi.fn();
  const removerNarracao = vi.fn();
  const enviarAnexo = vi.fn();
  const obterAnexo = vi.fn();
  const removerAnexo = vi.fn();
  const pedirPreview = vi.fn();
  const pedirJuntar = vi.fn();
  const urlDePreview = vi.fn((id: string, pedacoId: string, versao?: string) => {
    return `/api/projetos/${id}/pedacos/${pedacoId}/preview.mp4${versao === undefined ? "" : `?v=${encodeURIComponent(versao)}`}`;
  });
  const urlDeVideoFinal = vi.fn((id: string, versao?: string) => {
    return `/api/projetos/${id}/video-final.mp4${versao === undefined ? "" : `?v=${encodeURIComponent(versao)}`}`;
  });
  const urlDeAudioNarracao = vi.fn((id: string, pedacoId: string) => `/api/projetos/${id}/pedacos/${pedacoId}/narracao/audio`);
  const urlDeAnexo = vi.fn((id: string, pedacoId: string) => `/api/projetos/${id}/pedacos/${pedacoId}/anexo`);

  const cliente = {
    baseUrl: BASE_DE_TESTE,
    fetchImpl: (async (): Promise<Response> => {
      throw new Error("stub: nenhum metodo de rede usado neste teste");
    }) as FuncaoFetch,
    obterJob,
    criarProjeto,
    listarProjetos,
    obterProjeto,
    atualizarBrief,
    apagarProjeto,
    gerarRoteiro,
    regenerarPedaco,
    editarPedaco,
    enviarGravacao,
    obterAudioNarracao,
    removerNarracao,
    enviarAnexo,
    obterAnexo,
    removerAnexo,
    pedirPreview,
    pedirJuntar,
    urlDePreview,
    urlDeVideoFinal,
    urlDeAudioNarracao,
    urlDeAnexo,
  } as unknown as ClienteApi;

  return {
    cliente,
    obterJob,
    criarProjeto,
    listarProjetos,
    obterProjeto,
    atualizarBrief,
    apagarProjeto,
    gerarRoteiro,
    regenerarPedaco,
    editarPedaco,
    enviarGravacao,
    obterAudioNarracao,
    removerNarracao,
    enviarAnexo,
    obterAnexo,
    removerAnexo,
    pedirPreview,
    pedirJuntar,
    urlDePreview,
    urlDeVideoFinal,
    urlDeAudioNarracao,
    urlDeAnexo,
  };
}

// ─── Fixtures de dominio ──────────────────────────────────────────────────────

/** Um JobStatus valido (api.md) — campos por cima do minimo. */
export function jobDe(parcial: Partial<JobStatus> & { estado: JobStatus["estado"] }): JobStatus {
  return {
    id: "job-x",
    tipo: parcial.tipo ?? "preview-pedaco",
    estado: parcial.estado,
    progresso: parcial.progresso ?? null,
    mensagem: parcial.mensagem ?? "",
    erro: parcial.erro ?? null,
    criado_em: parcial.criado_em ?? "2026-08-14T10:00:00.000Z",
    atualizado_em: parcial.atualizado_em ?? "2026-08-14T10:00:03.000Z",
    artefato: parcial.artefato ?? null,
  };
}

/** Um Pedaco valido do contrato — campos por cima do minimo. */
export function pedacoDe(parcial: Partial<Pedaco> = {}): Pedaco {
  return {
    id: "p-000",
    indice: 0,
    titulo: "titulo",
    fala: "",
    duracao_segundos: 10,
    tipo_visual: "texto",
    especificacao_visual: "visual",
    detalhes_de_producao: "detalhes",
    narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    ...parcial,
  };
}

/**
 * Os TEXTOS da arvore renderizada, concatenados como o DOM os concatena
 * (nos de texto adjacentes colam sem espaco: "Parar e enviar (1s)").
 * Use `textosDa(...).join("")` para o texto exato visivel.
 */
export function textosDa(arvore: unknown): string[] {
  const textos: string[] = [];
  function andar(no: unknown): void {
    if (typeof no === "string") {
      textos.push(no);
      return;
    }
    if (no !== null && typeof no === "object") {
      const filhos = (no as { children?: unknown }).children;
      if (Array.isArray(filhos)) {
        for (const filho of filhos) {
          andar(filho);
        }
      }
    }
  }
  andar(arvore);
  return textos;
}
