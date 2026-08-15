/**
 * src/web/ui/src/api.ts
 *
 * Cliente HTTP da SPA contra o CONTRATO CONGELADO de docs/roteiro/api.md.
 *
 * Decisoes de desenho:
 *  - FUNCOES PURAS de rede: nenhum acesso a DOM, window ou relogio fora do
 *    que for passado por parametro. `fetch` e INJETAVEL (`fetchImpl`) — os
 *    testes unitarios (tests/web/ui/api.test.ts) passam um stub e nunca
 *    tocam a rede de verdade (o guarda tests/setup/rede-bloqueada.ts
 *    bloqueia fetch em processo; a injecao torna o teste possivel sem
 *    desliga-lo).
 *  - SAME-ORIGIN (REPLAN Onda 6): a base vem de window.location.origin,
 *    NUNCA URL absoluta hardcoded — o servidor da Onda 5 nao tem CORS.
 *    Em teste (sem window) a base default e "" e o caller passa a base
 *    explicita.
 *  - ENVELOPE DE ERRO: todo erro do servidor chega como
 *    {erro:{codigo,mensagem,detalhes}} (api.md) — o cliente o converte em
 *    `ErroApi` com `codigo` nomeado (a UI casa por codigo, nunca por
 *    texto solto — FQ-U4). Corpo que nao e o envelope vira
 *    `erro-inesperado` (nunca sucesso silencioso — C1).
 *  - JOBS: POST de operacao pesada devolve 202 + Location (api.md); o
 *    cliente le o job_id do corpo `{job_id}` com fallback para o Location
 *    header. O poll vive em `pollarJob` (backoff multiplicativo, teto de
 *    tempo, sinal de aborto, 404 -> "job expirou").
 *  - UPLOADS: narracao e anexo sao PUT com o BODY CRU (audio/webm do
 *    MediaRecorder, ou o arquivo do usuario), nunca multipart; o anexo
 *    leva `?nome=<urlencoded>` (api.md).
 *
 * Restricao de varredura (tests/design/literal-scan.test.ts): nenhum
 * literal #hex nem `digito+unidade` (ms/s/px) pode aparecer em .ts/.tsx
 * sob src/ — esta camada da SPA cumpre isso por construcao.
 */

import type { BriefRoteiro, EdicaoPedaco, NarracaoPedaco, Pedaco, ProjetoRoteiro } from "../../../roteiro/contrato/contrato.js";
import type { ArtefatoDoJob, JobStatus } from "../../jobs.js";

// ─── Envelope de erro ─────────────────────────────────────────────────────────

/**
 * Codigos de erro nomeados do envelope (api.md). A UI casa por ESTE
 * codigo, nunca por texto: o servidor pode reescrever a mensagem sem
 * quebrar o tratamento. A lista e o subconjunto que a SPA trata de forma
 * especial; os demais codigos chegam como string no ErroApi.
 */
export const CODIGOS_ERRO = {
  PROJETO_NAO_ENCONTRADO: "projeto-nao-encontrado",
  ROTA_NAO_ENCONTRADA: "rota-nao-encontrada",
  JOB_NAO_ENCONTRADO: "job-nao-encontrado",
  JOB_EXPIROU: "job-expirou",
  JOB_TEMPO_ESGOTADO: "job-tempo-esgotado",
  PEDACO_SEM_FALA: "pedaco-sem-fala",
  NARRACAO_NAO_GRAVADA: "narracao-nao-gravada",
  ANEXO_INEXISTENTE: "anexo-inexistente",
  JUNTAR_FALA_SEM_NARRACAO: "juntar-fala-sem-narracao",
  JUNTAR_PREVIEW_AUSENTE: "juntar-preview-ausente",
  JUNTAR_EM_ANDAMENTO: "juntar-em-andamento",
  ROTEIRO_NAO_GERADO: "roteiro-nao-gerado",
  PREVIEW_NAO_RENDERIZADO: "preview-nao-renderizado",
  ANEXO_EXIGIDO_PARA_GIF_VIDEO: "anexo-exigido-para-gif-video",
  BRIEF_INVALIDO: "brief-invalido",
  /** O poll foi cancelado porque o componente desmontou (nunca exibir). */
  ABORTADO: "abortado",
  ERRO_INESPERADO: "erro-inesperado",
} as const;

/** Erro de API com o codigo nomeado do envelope (api.md). */
export class ErroApi extends Error {
  /** A mensagem do envelope — nome proprio (super() so seta `message`). */
  readonly mensagem: string;
  readonly codigo: string;
  readonly status: number;
  readonly detalhes: readonly string[] | undefined;

  constructor(codigo: string, mensagem: string, status: number, detalhes?: readonly string[]) {
    super(mensagem);
    this.name = "ErroApi";
    this.mensagem = mensagem;
    this.codigo = codigo;
    this.status = status;
    this.detalhes = detalhes;
  }
}

/** Forma do envelope de erro (api.md) — campos validados em parse. */
interface EnvelopePossivel {
  readonly erro?: { readonly codigo?: unknown; readonly mensagem?: unknown; readonly detalhes?: unknown };
}

/**
 * Converte um corpo de resposta (ja parseado) em ErroApi. Corpo sem o
 * envelope {erro:{codigo,mensagem,detalhes}} vira `erro-inesperado` —
 * nunca se engole uma resposta nao-ok.
 */
export function parsearErroDoCorpo(corpo: unknown, status: number): ErroApi {
  if (corpo !== null && typeof corpo === "object") {
    const erro = (corpo as EnvelopePossivel).erro;
    if (erro !== undefined && typeof erro.codigo === "string") {
      const mensagem = typeof erro.mensagem === "string" ? erro.mensagem : `erro do servidor (${erro.codigo})`;
      const detalhes = Array.isArray(erro.detalhes)
        ? erro.detalhes.filter((d): d is string => typeof d === "string")
        : undefined;
      return new ErroApi(erro.codigo, mensagem, status, detalhes);
    }
  }
  return new ErroApi(CODIGOS_ERRO.ERRO_INESPERADO, `resposta inesperada do servidor (HTTP ${status})`, status);
}

// ─── Cliente ──────────────────────────────────────────────────────────────────

/** A assinatura minima de fetch que o cliente aceita (injetavel). */
export type FuncaoFetch = (entrada: RequestInfo | URL, iniciador?: RequestInit) => Promise<Response>;

/**
 * Base da SPA: same-origin. O servidor da Onda 5 nao tem CORS — a SPA
 * so fala com a propria origem (REPLAN Onda 6: nunca URL absoluta
 * hardcoded). Fora do navegador (testes) devolve "" e o teste passa a
 * base explicita.
 */
export function baseDaSpa(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
}

function urlDo(cliente: ClienteApi, caminho: string): string {
  return `${cliente.baseUrl}${caminho}`;
}

/** Le o corpo como JSON; corpo vazio (204) devolve null. */
async function lerJsonOuNulo(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (texto === "") {
    return null;
  }
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}

/** Pedido JSON (todas as rotas de /api/ exceto bytes e jobs). */
async function pedidoJson<T>(
  cliente: ClienteApi,
  metodo: string,
  caminho: string,
  corpoJson?: unknown,
): Promise<T> {
  const resposta = await cliente.fetchImpl(urlDo(cliente, caminho), {
    method: metodo,
    headers: corpoJson === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpoJson === undefined ? undefined : JSON.stringify(corpoJson),
  });
  const corpo = await lerJsonOuNulo(resposta);
  if (!resposta.ok) {
    throw parsearErroDoCorpo(corpo, resposta.status);
  }
  return corpo as T;
}

/** Pedido que devolve bytes (audio, anexo, mp4 — endpoints de arquivo). */
async function pedidoBlob(cliente: ClienteApi, caminho: string): Promise<Blob> {
  const resposta = await cliente.fetchImpl(urlDo(cliente, caminho), { method: "GET" });
  if (!resposta.ok) {
    throw parsearErroDoCorpo(await lerJsonOuNulo(resposta), resposta.status);
  }
  return resposta.blob();
}

/**
 * Pedido de job: 202 + Location (api.md). O corpo `{job_id}` e a fonte
 * primaria (o servidor manda os dois); o Location e o fallback para
 * qualquer resposta 2xx que omita o corpo.
 */
async function pedidoJob(cliente: ClienteApi, metodo: string, caminho: string, corpoJson?: unknown): Promise<JobAceito> {
  const resposta = await cliente.fetchImpl(urlDo(cliente, caminho), {
    method: metodo,
    headers: corpoJson === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpoJson === undefined ? undefined : JSON.stringify(corpoJson),
  });
  const corpo = await lerJsonOuNulo(resposta);
  if (!resposta.ok) {
    throw parsearErroDoCorpo(corpo, resposta.status);
  }
  const comoJob = corpo as { job_id?: unknown } | null;
  if (comoJob !== null && typeof comoJob.job_id === "string") {
    return { jobId: comoJob.job_id };
  }
  const location = resposta.headers.get("location");
  if (location !== null) {
    const casado = /\/api\/jobs\/([^/]+)$/.exec(location);
    if (casado !== null) {
      return { jobId: casado[1]! };
    }
  }
  throw new ErroApi(CODIGOS_ERRO.ERRO_INESPERADO, "a resposta do job nao trouxe job_id nem Location", resposta.status);
}

/** Pedido de bytes crus (upload de narracao/anexo — body nao-JSON). */
async function pedidoBruto(
  cliente: ClienteApi,
  metodo: string,
  caminho: string,
  corpo: BodyInit,
  contentType: string,
): Promise<Response> {
  return cliente.fetchImpl(urlDo(cliente, caminho), {
    method: metodo,
    headers: { "Content-Type": contentType },
    body: corpo,
  });
}

// ─── Tipos da resposta ────────────────────────────────────────────────────────

/** Item da lista de projetos (GET /api/projetos). */
export interface ProjetoLite {
  readonly id: string;
  readonly tema: string;
  readonly criado_em: string;
  readonly atualizado_em: string;
}

/** Estado resumido de um job por alvo (o GET do projeto deriva; api.md). */
export interface StatusJobResumido {
  readonly job_id: string;
  readonly estado: JobStatus["estado"];
  readonly progresso: number | null;
}

/** O envelope do GET projeto (api.md): projeto + jobs por alvo. */
export interface RespostaProjeto {
  readonly projeto: ProjetoRoteiro;
  readonly jobs: {
    readonly gerar_roteiro: StatusJobResumido | null;
    readonly previews: Readonly<Record<string, StatusJobResumido>>;
    readonly juntar: StatusJobResumido | null;
  };
}

/** Resposta do POST de job: 202 + job_id (api.md). */
export interface JobAceito {
  readonly jobId: string;
}

/** Resposta do PUT anexo (api.md): o par hash/meta do anexo novo. */
export interface AnexoEnviado {
  readonly hash: string;
  readonly tipo: string;
  readonly tamanho: number;
  readonly nome_original: string;
}

// ─── Cliente (as 21 rotas do contrato — docs/roteiro/api.md) ─────────────────

/**
 * O cliente completo: base + fetch injetavel + UMA funcao por rota do
 * contrato. Os componentes recebem este tipo e chamam os metodos
 * diretamente — os testes constroem com `criarClienteApi({baseUrl,
 * fetchImpl})` e nunca tocam a rede (guarda de tests/setup ligado).
 */
export interface ClienteApi {
  readonly baseUrl: string;
  readonly fetchImpl: FuncaoFetch;

  /** POST /api/projetos — cria com o brief; 201 = ProjetoRoteiro. */
  criarProjeto(brief: BriefRoteiro): Promise<ProjetoRoteiro>;
  /** GET /api/projetos — lista resumida. */
  listarProjetos(): Promise<{ projetos: readonly ProjetoLite[] }>;
  /** GET /api/projetos/:id — projeto com edicoes aplicadas + jobs. */
  obterProjeto(id: string): Promise<RespostaProjeto>;
  /** PATCH /api/projetos/:id — atualiza o brief. */
  atualizarBrief(id: string, brief: BriefRoteiro): Promise<ProjetoRoteiro>;
  /** DELETE /api/projetos/:id — 204. */
  apagarProjeto(id: string): Promise<void>;
  /**
   * POST /api/projetos/:id/roteiro/gerar — job. O servidor completa as
   * versoes (o cliente nunca as envia — api.md §gerar).
   */
  gerarRoteiro(id: string, corpo: { brief?: BriefRoteiro; duracao_alvo_segundos?: number }): Promise<JobAceito>;
  /** POST /api/projetos/:id/pedacos/:pedacoId/regenerar — job (corpo vazio). */
  regenerarPedaco(id: string, pedacoId: string): Promise<JobAceito>;
  /** PATCH /api/projetos/:id/pedacos/:pedacoId — edita; 200 = pedaco servido. */
  editarPedaco(id: string, pedacoId: string, delta: EdicaoPedaco): Promise<Pedaco>;
  /** PUT narracao/audio — body CRU (webm do MediaRecorder ou wav). */
  enviarGravacao(id: string, pedacoId: string, bytes: BodyInit, tipo: string): Promise<NarracaoPedaco>;
  /** GET narracao/audio — o wav normalizado (48k stereo, FORMATO_AUDIO_GRAVADO). */
  obterAudioNarracao(id: string, pedacoId: string): Promise<Blob>;
  /** DELETE narracao — 204 (os bytes permanecem no store, S-8). */
  removerNarracao(id: string, pedacoId: string): Promise<void>;
  /** PUT anexo — body cru + ?nome=<urlencoded>. */
  enviarAnexo(id: string, pedacoId: string, bytes: BodyInit, tipo: string, nome: string): Promise<AnexoEnviado>;
  /** GET anexo — bytes do gif/video do usuario. */
  obterAnexo(id: string, pedacoId: string): Promise<Blob>;
  /** DELETE anexo — 204 (bytes permanecem no store). */
  removerAnexo(id: string, pedacoId: string): Promise<void>;
  /** POST preview — job: render do manifesto reduzido de UM pedaco. */
  pedirPreview(id: string, pedacoId: string): Promise<JobAceito>;
  /** POST juntar — job: concat + musica opcional + EBU R128 + mux + SRT. */
  pedirJuntar(id: string, musicaCaminho?: string): Promise<JobAceito>;
  /** GET /api/jobs/:jobId — o poll da UI (200 status; 404 = job expirou). */
  obterJob(jobId: string): Promise<JobStatus>;

  // ── URLs publicas de arquivo (C7: caminho publico, nunca disco) ──

  urlDePreview(id: string, pedacoId: string, versao?: string): string;
  urlDeVideoFinal(id: string, versao?: string): string;
  urlDeAudioNarracao(id: string, pedacoId: string): string;
  urlDeAnexo(id: string, pedacoId: string): string;
}

export function criarClienteApi(opcoes: { baseUrl?: string; fetchImpl?: FuncaoFetch } = {}): ClienteApi {
  const baseUrl = opcoes.baseUrl ?? baseDaSpa();
  const fetchImpl = opcoes.fetchImpl ?? fetch;
  const cliente: ClienteApi = {
    baseUrl,
    fetchImpl,

    criarProjeto(brief) {
      return pedidoJson(cliente, "POST", "/api/projetos", { brief });
    },
    listarProjetos() {
      return pedidoJson(cliente, "GET", "/api/projetos");
    },
    obterProjeto(id) {
      return pedidoJson(cliente, "GET", `/api/projetos/${id}`);
    },
    atualizarBrief(id, brief) {
      return pedidoJson(cliente, "PATCH", `/api/projetos/${id}`, { brief });
    },
    async apagarProjeto(id) {
      await pedidoJson(cliente, "DELETE", `/api/projetos/${id}`);
    },
    gerarRoteiro(id, corpo) {
      return pedidoJob(cliente, "POST", `/api/projetos/${id}/roteiro/gerar`, corpo);
    },
    regenerarPedaco(id, pedacoId) {
      return pedidoJob(cliente, "POST", `/api/projetos/${id}/pedacos/${pedacoId}/regenerar`);
    },
    editarPedaco(id, pedacoId, delta) {
      return pedidoJson(cliente, "PATCH", `/api/projetos/${id}/pedacos/${pedacoId}`, delta);
    },
    async enviarGravacao(id, pedacoId, bytes, tipo) {
      const resposta = await pedidoBruto(cliente, "PUT", `/api/projetos/${id}/pedacos/${pedacoId}/narracao/audio`, bytes, tipo);
      const corpo = await lerJsonOuNulo(resposta);
      if (!resposta.ok) {
        throw parsearErroDoCorpo(corpo, resposta.status);
      }
      return corpo as NarracaoPedaco;
    },
    obterAudioNarracao(id, pedacoId) {
      return pedidoBlob(cliente, `/api/projetos/${id}/pedacos/${pedacoId}/narracao/audio`);
    },
    async removerNarracao(id, pedacoId) {
      await pedidoJson(cliente, "DELETE", `/api/projetos/${id}/pedacos/${pedacoId}/narracao`);
    },
    async enviarAnexo(id, pedacoId, bytes, tipo, nome) {
      const resposta = await pedidoBruto(
        cliente,
        "PUT",
        `/api/projetos/${id}/pedacos/${pedacoId}/anexo?nome=${encodeURIComponent(nome)}`,
        bytes,
        tipo,
      );
      const corpo = await lerJsonOuNulo(resposta);
      if (!resposta.ok) {
        throw parsearErroDoCorpo(corpo, resposta.status);
      }
      return corpo as AnexoEnviado;
    },
    obterAnexo(id, pedacoId) {
      return pedidoBlob(cliente, `/api/projetos/${id}/pedacos/${pedacoId}/anexo`);
    },
    async removerAnexo(id, pedacoId) {
      await pedidoJson(cliente, "DELETE", `/api/projetos/${id}/pedacos/${pedacoId}/anexo`);
    },
    pedirPreview(id, pedacoId) {
      return pedidoJob(cliente, "POST", `/api/projetos/${id}/pedacos/${pedacoId}/preview`);
    },
    pedirJuntar(id, musicaCaminho) {
      return pedidoJob(cliente, "POST", `/api/projetos/${id}/juntar`, musicaCaminho === undefined ? {} : { musica_caminho: musicaCaminho });
    },
    obterJob(jobId) {
      return pedidoJson(cliente, "GET", `/api/jobs/${jobId}`);
    },

    // O ?v= e bust de cache do navegador: o servidor roteia por pathname,
    // o query nao muda a resposta (o mp4 de preview e por conteudo, C7).
    urlDePreview(id, pedacoId, versao) {
      return `/api/projetos/${id}/pedacos/${pedacoId}/preview.mp4${versao === undefined ? "" : `?v=${encodeURIComponent(versao)}`}`;
    },
    urlDeVideoFinal(id, versao) {
      return `/api/projetos/${id}/video-final.mp4${versao === undefined ? "" : `?v=${encodeURIComponent(versao)}`}`;
    },
    urlDeAudioNarracao(id, pedacoId) {
      return `/api/projetos/${id}/pedacos/${pedacoId}/narracao/audio`;
    },
    urlDeAnexo(id, pedacoId) {
      return `/api/projetos/${id}/pedacos/${pedacoId}/anexo`;
    },
  };
  return cliente;
}

// ─── Poll de jobs ─────────────────────────────────────────────────────────────

export interface OpcoesDePoll {
  /** Intervalo inicial entre polls (backoff multiplicativo). */
  intervaloInicialMs?: number;
  /** Fator de crescimento do intervalo a cada poll. */
  fator?: number;
  /** Teto do intervalo. */
  tetoDoIntervaloMs?: number;
  /** Teto total de espera; estourado vira ErroApi job-tempo-esgotado. */
  tetoTotalMs?: number;
  /** Chamado a cada status lido (a UI atualiza progresso). */
  aoStatus?: (job: JobStatus) => void;
  /** Sinal de cancelamento — o componente desmontou; vira ErroApi abortado. */
  sinalAbortar?: { abortado: boolean };
}

/**
 * Poll de um job efemero (api.md §jobs): pendente -> rodando -> ok|erro.
 * - 404 do GET job vira ErroApi `job-expirou` (jobs sao efemeros; a UI
 *   mostra "refaca a operacao" — nunca sucesso mentiroso, FQ-U2).
 * - "ok" SO e aceito com artefato presente — a conferencia mora em
 *   derivarJob (estado-jobs.ts); aqui o terminal e o que o servidor diz.
 * - Backoff multiplicativo com teto; teto total de espera.
 */
export async function pollarJob(
  obter: (jobId: string) => Promise<JobStatus>,
  jobId: string,
  opcoes: OpcoesDePoll = {},
): Promise<JobStatus> {
  const intervaloInicial = opcoes.intervaloInicialMs ?? 400;
  const fator = opcoes.fator ?? 1.4;
  const tetoIntervalo = opcoes.tetoDoIntervaloMs ?? 2500;
  const tetoTotal = opcoes.tetoTotalMs ?? 5 * 60_000;
  const inicio = Date.now();
  let intervalo = intervaloInicial;

  for (;;) {
    let job: JobStatus;
    try {
      job = await obter(jobId);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.codigo === CODIGOS_ERRO.JOB_NAO_ENCONTRADO) {
        throw new ErroApi(CODIGOS_ERRO.JOB_EXPIROU, "o job expirou — refaca a operacao", 404);
      }
      throw erro;
    }
    opcoes.aoStatus?.(job);
    if (job.estado === "ok" || job.estado === "erro") {
      return job;
    }
    if (opcoes.sinalAbortar !== undefined && opcoes.sinalAbortar.abortado) {
      throw new ErroApi(CODIGOS_ERRO.ABORTADO, "poll cancelado", 0);
    }
    if (Date.now() - inicio > tetoTotal) {
      throw new ErroApi(CODIGOS_ERRO.JOB_TEMPO_ESGOTADO, "o job demorou demais — verifique o servidor e tente de novo", 0);
    }
    await atraso(intervalo);
    intervalo = Math.min(intervalo * fator, tetoIntervalo);
  }
}

function atraso(ms: number): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

// ─── Artefato ─────────────────────────────────────────────────────────────────

/** O artefato do job ok — reexportado para quem deriva o estado da UI. */
export type { ArtefatoDoJob };
