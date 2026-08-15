// =============================================================================
// O SERVIDOR WEB — FQ-S1..S4 do TASK_PLAN (Onda 5, servidor-web)
// =============================================================================
//
//   FQ-S1 — projeto inexistente -> 404; verbo errado na rota certa -> 405;
//           rota desconhecida -> 404 rota-nao-encontrada (nunca 500
//           silencioso); o envelope de erro e {erro:{codigo,mensagem}}.
//   FQ-S2 — o projeto persiste apos restart do servidor (JSON em
//           dados/projetos/<id>/ — S-8: tmp+rename), inclusive roteiro,
//           edicoes, narracao e os indices de preview/entrega.
//   FQ-S3 — job assincrono: 202 + Location; o poll ve pendente/rodando/ok
//           com progresso REAL (o arquivo de estado escrito pelo CLI);
//           estado terminal de ERRO traz a saida real do CLI; job
//           expirado (TTL) vira 404 "job expirou".
//   FQ-S4 — a porta declarada (4610) e o default; colisao de porta e erro
//           claro no startup (S-9), nunca silencio.
//
//   Fluxo feliz (sosia — zero rede, zero credencial, FQ-G5/FQ-E1):
//   criar -> gerar roteiro -> editar pedaco -> regenerar -> narrar todos
//   os pedacos com fala (PUT wav da fixture — o servidor converte) ->
//   preview de CADA pedaco (job -> mp4 real, conferido) -> juntar (job ->
//   mp4 final com video+audio, conferido) -> downloads. Renders REAIS
//   (Remotion headless) — o mesmo ambiente dos testes de preview/juntar.
//
//   Fluxos negativos: juntar sem narracao -> 409 juntar-fala-sem-narracao;
//   PATCH com anexo -> 400 edicao-anexo-proibido; gif/video sem anexo ->
//   400 anexo-exigido-para-gif-video; anexo inconsistente bloqueia o
//   juntar; upload primeiro, tipo depois funciona; 404s nomeados.
//
//   Anti-C2 (runner verde com filtro que nao casa nada): cada grupo
//   termina com sonda negativa que FALHA se o alvo do grupo estiver
//   quebrado — a porta nao sobe sem banner, o 404 carrega o envelope,
//   o restart preserva o roteiro, o job ok carrega artefato, o job erro
//   carrega saida real, o mp4 final tem video+audio POR STREAM (ffprobe
//   do proprio teste, nunca so o status HTTP).
//
//   Rede: o guarda (tests/setup/rede-bloqueada.ts) bloqueia fetch em
//   processo — este arquivo desliga e reinstala com permitirLoopback:true
//   (o mesmo mecanismo que o e2e da Onda 7 usa — REPLAN). O servidor em
//   si roda num SUBPROCESSO real (tsx), como a Onda 7 rodara.
// =============================================================================

import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ROTAS_API_LISTA } from "../../src/roteiro/contrato/rotas.js";
import {
  FORMATO_DE_ID_DE_JOB,
  FORMATO_DE_ID_DE_PROJETO,
  PORTA_PADRAO,
  casarRota,
  casarRotaComTabela,
} from "../../src/web/servidor.js";

const RAIZ = join(__dirname, "..", "..");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const CAMINHO_SERVIDOR = join(RAIZ, "src", "web", "servidor.ts");

const FIXTURE_GRAVACAO = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "gravacao.webm"));
const FIXTURE_ANEXO_GIF = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "anexo.gif"));

// ─── Rede: o guarda permite loopback neste arquivo (o servidor e local) ──────

import { bloquearRede, liberarRede } from "../../src/resolucao/rede/bloqueio.js";

let guardaRestaurada: (() => void) | null = null;

beforeAll(() => {
  liberarRede();
  guardaRestaurada = bloquearRede({ permitirLoopback: true });
});

afterAll(() => {
  if (guardaRestaurada !== null) {
    guardaRestaurada();
  }
  liberarRede();
  bloquearRede({ permitirLoopback: false });
});

// ─── O servidor de teste (subprocesso real — o guarda nao alcanca filhos) ────

interface ServidorDeTeste {
  readonly porta: number;
  readonly processo: ReturnType<typeof spawn>;
  readonly raizDados: string;
  readonly raizEstatica: string;
  parar(): Promise<void>;
}

/** Sobe o servidor num subprocesso e espera o banner (a porta real). */
async function subirServidor(opcoes: {
  readonly raizDados: string;
  readonly raizEstatica: string;
  readonly porta?: number;
  readonly provedor?: string;
  readonly ttlJobsMs?: number;
  readonly envExtras?: Record<string, string>;
}): Promise<ServidorDeTeste> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    RAIZ_DADOS: opcoes.raizDados,
    RAIZ_ESTATICA: opcoes.raizEstatica,
    ROTEIRO_PROVEDOR: opcoes.provedor ?? "sosia",
    PORT: String(opcoes.porta ?? 0),
    ...(opcoes.ttlJobsMs !== undefined ? { ROTEIRO_JOBS_TTL_MS: String(opcoes.ttlJobsMs) } : {}),
    ...(opcoes.envExtras ?? {}),
  };
  const processo = spawn(BIN_TSX, [CAMINHO_SERVIDOR], { cwd: RAIZ, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  processo.stdout?.setEncoding("utf-8");
  processo.stdout?.on("data", (d: string) => {
    stdout += d;
  });
  processo.stderr?.setEncoding("utf-8");
  processo.stderr?.on("data", (d: string) => {
    stderr += d;
  });
  const banner = /http:\/\/localhost:(\d+)/;
  const prazo = Date.now() + 30_000;
  while (Date.now() < prazo) {
    const m = banner.exec(stdout);
    if (m !== null) {
      return {
        porta: Number(m[1]),
        processo,
        raizDados: opcoes.raizDados,
        raizEstatica: opcoes.raizEstatica,
        parar: () => pararProcesso(processo),
      };
    }
    if (processo.exitCode !== null) {
      throw new Error(`servidor saiu antes do banner (exit ${processo.exitCode}): ${stderr}`);
    }
    await dormir(100);
  }
  processo.kill("SIGKILL");
  throw new Error(`servidor nao imprimiu o banner em 30 s:\nstdout: ${stdout}\nstderr: ${stderr}`);
}

function pararProcesso(processo: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve) => {
    if (processo.exitCode !== null || processo.signalCode !== null) {
      resolve();
      return;
    }
    const prazo = setTimeout(() => processo.kill("SIGKILL"), 5000);
    processo.once("close", () => {
      clearTimeout(prazo);
      resolve();
    });
    processo.kill("SIGTERM");
  });
}

/** Espera o processo sair (para o teste de colisao de porta). */
function aguardarSaida(processo: ReturnType<typeof spawn>, stderr: { valor: string }): Promise<number | null> {
  return new Promise((resolve) => {
    processo.stderr?.setEncoding("utf-8");
    processo.stderr?.on("data", (d: string) => {
      stderr.valor += d;
    });
    processo.once("close", (codigo) => resolve(codigo));
    processo.once("error", (erro) => {
      stderr.valor += `\nspawn error: ${erro.message}`;
      resolve(null);
    });
  });
}

// ─── Cliente de API (fetch real — loopback permitido pelo guarda) ────────────

interface RespostaDeApi {
  readonly status: number;
  readonly cabecalhos: Headers;
  readonly corpo: ArrayBuffer;
  json(): unknown;
  texto(): string;
}

async function api(
  porta: number,
  metodo: string,
  caminho: string,
  opcoes: { corpo?: unknown; cabecalhos?: Record<string, string> } = {},
): Promise<RespostaDeApi> {
  const cabecalhos: Record<string, string> = { ...(opcoes.cabecalhos ?? {}) };
  let corpo: BodyInit | undefined;
  if (opcoes.corpo !== undefined) {
    if (opcoes.corpo instanceof Uint8Array) {
      corpo = opcoes.corpo as unknown as BodyInit;
    } else {
      cabecalhos["Content-Type"] = "application/json";
      corpo = JSON.stringify(opcoes.corpo);
    }
  }
  const resposta = await fetch(`http://127.0.0.1:${porta}${caminho}`, {
    method: metodo,
    headers: cabecalhos,
    body: corpo,
  });
  const corpoBruto = await resposta.arrayBuffer();
  return {
    status: resposta.status,
    cabecalhos: resposta.headers,
    corpo: corpoBruto,
    json: () => JSON.parse(Buffer.from(corpoBruto).toString("utf-8")) as unknown,
    texto: () => Buffer.from(corpoBruto).toString("utf-8"),
  };
}

/** Extrai o codigo do envelope de erro — FALHA se nao houver envelope. */
function codigoDeErro(resposta: RespostaDeApi): string {
  const corpo = resposta.json() as { erro?: { codigo?: string } };
  if (typeof corpo.erro?.codigo !== "string") {
    throw new Error(`resposta ${resposta.status} sem envelope {erro:{codigo}} — corpo: ${resposta.texto()}`);
  }
  return corpo.erro.codigo;
}

/** Polla um job ate o estado terminal (ou o prazo). */
async function pollJob(
  porta: number,
  jobId: string,
  prazoMs: number,
): Promise<{
  estado: string;
  progresso: number | null;
  erro: string | null;
  artefato: { tipo: string; caminho: string } | null;
}> {
  const fim = Date.now() + prazoMs;
  let ultimo: { estado: string; progresso: number | null; erro: string | null; artefato: unknown } | null = null;
  while (Date.now() < fim) {
    const resposta = await api(porta, "GET", `/api/jobs/${jobId}`);
    if (resposta.status !== 200) {
      throw new Error(`poll do job ${jobId} devolveu ${resposta.status}: ${resposta.texto()}`);
    }
    ultimo = resposta.json() as typeof ultimo;
    if (ultimo!.estado === "ok" || ultimo!.estado === "erro") {
      return {
        estado: ultimo!.estado,
        progresso: ultimo!.progresso,
        erro: ultimo!.erro,
        artefato: ultimo!.artefato as { tipo: string; caminho: string } | null,
      };
    }
    await dormir(200);
  }
  throw new Error(
    `job ${jobId} nao terminou em ${prazoMs} ms — ultimo estado: ${JSON.stringify(ultimo)}`,
  );
}

/** Cria um projeto e devolve o id (o fluxo comum de todos os grupos). */
async function criarProjeto(
  porta: number,
  tema = "Como funciona um cache",
  duracaoAlvo = 30,
): Promise<{ id: string }> {
  const resposta = await api(porta, "POST", "/api/projetos", {
    corpo: { brief: { tema, contexto: "para iniciantes", duracao_alvo_segundos: duracaoAlvo } },
  });
  if (resposta.status !== 201) {
    throw new Error(`criar projeto falhou: ${resposta.status} ${resposta.texto()}`);
  }
  return resposta.json() as { id: string };
}

/** Gera o roteiro (job) e espera o ok. */
async function gerarRoteiro(porta: number, id: string, duracaoAlvo = 30): Promise<unknown> {
  const resposta = await api(porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
    corpo: { duracao_alvo_segundos: duracaoAlvo },
  });
  if (resposta.status !== 202) {
    throw new Error(`gerar roteiro falhou: ${resposta.status} ${resposta.texto()}`);
  }
  const { job_id } = resposta.json() as { job_id: string };
  const final = await pollJob(porta, job_id, 60_000);
  if (final.estado !== "ok") {
    throw new Error(`job de gerar falhou: ${final.erro ?? "sem erro"}`);
  }
  return final;
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ffprobeStreams(bytes: Buffer): Array<{ codec_type: string; codec_name?: string; width?: number; height?: number }> {
  const arquivo = join(mkdtempSync(join(tmpdir(), "probe-web-")), "video.mp4");
  writeFileSync(arquivo, bytes);
  const saida = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height",
    "-of", "json",
    arquivo,
  ], { encoding: "utf-8" });
  return (JSON.parse(saida) as { streams: Array<{ codec_type: string; codec_name?: string; width?: number; height?: number }> }).streams;
}

// ─── Ambiente comum (criado na COLECAO — os describes usam em load) ──────────

const raizComum = mkdtempSync(join(tmpdir(), "servidor-web-teste-"));
const raizEstatica = join(raizComum, "estatica");
mkdirSync(join(raizEstatica, "assets"), { recursive: true });
writeFileSync(join(raizEstatica, "index.html"), "<!doctype html><title>Editor de Video IA</title>\n", "utf-8");
writeFileSync(join(raizEstatica, "assets", "app.js"), "console.log('spa');\n", "utf-8");

afterAll(() => {
  rmSync(raizComum, { recursive: true, force: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 0 — o matcher de rotas (api.md §Matcher; FQ-C4 x rotas.ts)
// ═════════════════════════════════════════════════════════════════════════════
describe("matcher de rotas (FQ-C4 — o contrato inteiro entra no roteador)", () => {
  it("reconhece TODAS as 21 constantes de rotas.ts (denominador — C2)", () => {
    // Sonda negativa: um roteador que casa zero rotas passa em qualquer
    // assertao de "nao casou errado" — aqui a contagem e o alvo.
    expect(ROTAS_API_LISTA.length).toBeGreaterThanOrEqual(21);
    for (const rota of ROTAS_API_LISTA) {
      const [metodo, caminho] = rota.split(" ");
      const caminhoComParams = caminho!
        .split("/")
        .map((segmento) => (segmento.startsWith(":") ? "x" : segmento))
        .join("/");
      const casada = casarRota(metodo!, caminhoComParams);
      expect(casada, `rota ${rota} nao casou no matcher`).not.toBeNull();
    }
  });

  it("segmento literal vence :param (api.md §Matcher)", () => {
    const tabela = {
      generica: "GET /a/:param",
      literal: "GET /a/status",
      outroLiteral: "GET /a/status/x",
    } as const;
    expect(casarRotaComTabela("GET", "/a/status", tabela)?.nome).toBe("literal");
    expect(casarRotaComTabela("GET", "/a/status/x", tabela)?.nome).toBe("outroLiteral");
    expect(casarRotaComTabela("GET", "/a/qualquer", tabela)?.nome).toBe("generica");
  });

  it("captura os parametros (:id, :pedacoId, :jobId)", () => {
    const casada = casarRota("GET", "/api/projetos/proj-abc/pedacos/p-001/narracao/audio");
    expect(casada?.nome).toBe("obterAudioNarracao");
    expect(casada?.params).toEqual({ id: "proj-abc", pedacoId: "p-001" });
  });

  it("metodo errado nao casa (o 405 nasce daqui)", () => {
    expect(casarRota("PUT", "/api/projetos")).toBeNull();
    expect(casarRota("GET", "/api/projetos/x/roteiro/gerar")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 1 — FQ-S1: 404/405/400 honestos, nunca 500 silencioso
// ═════════════════════════════════════════════════════════════════════════════
describe("FQ-S1 — erros honestos (404/405/400, nunca 500 silencioso)", () => {
  let servidor: ServidorDeTeste;

  beforeAll(async () => {
    servidor = await subirServidor({
      raizDados: join(raizComum, "dados-s1"),
      raizEstatica,
    });
  });

  afterAll(async () => {
    await servidor.parar();
  });

  it("projeto inexistente -> 404 com codigo projeto-nao-encontrado", async () => {
    const resposta = await api(servidor.porta, "GET", "/api/projetos/nao-existe");
    expect(resposta.status).toBe(404);
    expect(codigoDeErro(resposta)).toBe("projeto-nao-encontrado");
  });

  it("verbo errado na rota certa -> 405 metodo-nao-permitido (com Allow)", async () => {
    const resposta = await api(servidor.porta, "PUT", "/api/projetos");
    expect(resposta.status).toBe(405);
    expect(codigoDeErro(resposta)).toBe("metodo-nao-permitido");
    expect(resposta.cabecalhos.get("allow")).toContain("POST");
  });

  it("rota inexistente -> 404 rota-nao-encontrada", async () => {
    const resposta = await api(servidor.porta, "GET", "/api/rota-que-nao-existe");
    expect(resposta.status).toBe(404);
    expect(codigoDeErro(resposta)).toBe("rota-nao-encontrada");
  });

  it("verbo errado em rota de recurso existente -> 405 (nao 404)", async () => {
    const resposta = await api(servidor.porta, "POST", "/api/projetos/qualquer/video-final.mp4");
    expect(resposta.status).toBe(405);
  });

  it("brief sem tema -> 400 com as regras do validador (FQ-C1)", async () => {
    const resposta = await api(servidor.porta, "POST", "/api/projetos", {
      corpo: { brief: { contexto: "sem tema" } },
    });
    expect(resposta.status).toBe(400);
    const corpo = resposta.json() as { erro: { codigo: string; detalhes?: string[] } };
    expect(corpo.erro.codigo).toBe("brief-invalido");
    expect(corpo.erro.detalhes?.length).toBeGreaterThan(0);
  });

  it("corpo nao-JSON -> 400 corpo-invalido", async () => {
    const resposta = await api(servidor.porta, "POST", "/api/projetos", {
      corpo: Buffer.from("isto nao e json", "utf-8"),
      cabecalhos: { "Content-Type": "application/json" },
    });
    expect(resposta.status).toBe(400);
    expect(codigoDeErro(resposta)).toBe("corpo-invalido");
  });

  it("Sonda negativa do grupo: o servidor responde 200 no GET de projetos", async () => {
    const resposta = await api(servidor.porta, "GET", "/api/projetos");
    expect(resposta.status).toBe(200);
    expect((resposta.json() as { projetos: unknown[] }).projetos).toEqual([]);
  });

  it("GET / serve o index da SPA; /assets/* serve o estatico; fallback serve o index", async () => {
    const index = await api(servidor.porta, "GET", "/");
    expect(index.status).toBe(200);
    expect(index.texto()).toContain("Editor de Video IA");
    const asset = await api(servidor.porta, "GET", "/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.texto()).toContain("spa");
    const fallback = await api(servidor.porta, "GET", "/qualquer/caminho/da/spa");
    expect(fallback.status).toBe(200);
    expect(fallback.texto()).toContain("Editor de Video IA");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 2 — FQ-S2: o projeto persiste apos restart do servidor
// ═════════════════════════════════════════════════════════════════════════════
describe("FQ-S2 — persistencia apos restart (dados/projetos/<id>/, JSON atomico)", () => {
  const raizDados = join(raizComum, "dados-s2");
  let servidor: ServidorDeTeste;
  let idDoProjeto: string;

  beforeAll(async () => {
    servidor = await subirServidor({ raizDados, raizEstatica });
    idDoProjeto = (await criarProjeto(servidor.porta, "Persistencia", 6)).id;
    await gerarRoteiro(servidor.porta, idDoProjeto, 6);
    // edita um pedaco antes do restart (a edicao tambem persiste)
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    const alvo = projeto.projeto.roteiro.pedacos[1]!;
    const editado = await api(
      servidor.porta,
      "PATCH",
      `/api/projetos/${idDoProjeto}/pedacos/${alvo.id}`,
      { corpo: { fala: "Fala editada antes do restart" } },
    );
    expect(editado.status).toBe(200);
    // restart
    await servidor.parar();
    servidor = await subirServidor({ raizDados, raizEstatica });
  });

  afterAll(async () => {
    await servidor.parar();
  });

  it("o roteiro gerado e a edicao sobrevivem ao restart", async () => {
    const resposta = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`);
    expect(resposta.status).toBe(200);
    const corpo = resposta.json() as {
      projeto: {
        roteiro: { pedacos: Array<{ id: string; fala: string }> };
        pedacos_editados: Record<string, { fala?: string }>;
      };
    };
    // Sonda negativa do grupo: roteiro vazio apos o restart = persistencia quebrada.
    expect(corpo.projeto.roteiro.pedacos.length).toBeGreaterThan(0);
    expect(corpo.projeto.pedacos_editados).toHaveProperty("p-001");
    const servido = corpo.projeto.roteiro.pedacos.find((p) => p.id === "p-001");
    expect(servido?.fala).toBe("Fala editada antes do restart");
  });

  it("o projeto listado apos o restart aparece no GET /api/projetos", async () => {
    const resposta = await api(servidor.porta, "GET", "/api/projetos");
    const projetos = (resposta.json() as { projetos: Array<{ id: string }> }).projetos;
    expect(projetos.some((p) => p.id === idDoProjeto)).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 3 — FQ-S3: jobs com estado real (progresso, erro real, expiracao)
// ═════════════════════════════════════════════════════════════════════════════
describe("FQ-S3 — jobs assincronos (202 + poll; erro com saida real; expiracao)", () => {
  let servidor: ServidorDeTeste;

  beforeAll(async () => {
    servidor = await subirServidor({
      raizDados: join(raizComum, "dados-s3"),
      raizEstatica,
    });
  });

  afterAll(async () => {
    await servidor.parar();
  });

  it("gerar roteiro: 202 + Location; o poll ve progresso real e artefato no ok", async () => {
    const id = (await criarProjeto(servidor.porta, "Jobs", 6)).id;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
      corpo: { duracao_alvo_segundos: 6 },
    });
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    expect(resposta.cabecalhos.get("location")).toBe(`/api/jobs/${job_id}`);
    const final = await pollJob(servidor.porta, job_id, 60_000);
    expect(final.estado).toBe("ok");
    expect(final.artefato).not.toBeNull();
    expect(final.artefato!.tipo).toBe("roteiro-json");
    expect(final.artefato!.caminho).toBe(`/api/projetos/${id}`);
    // Sonda: o roteiro realmente chegou ao projeto.
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro?: { pedacos: unknown[] } };
    };
    expect(projeto.projeto.roteiro?.pedacos.length).toBeGreaterThan(0);
  });

  it("o GET do projeto agrupa jobs por alvo (derivado, nunca persistido)", async () => {
    const id = (await criarProjeto(servidor.porta, "Jobs por alvo", 6)).id;
    await gerarRoteiro(servidor.porta, id, 6);
    const resposta = await api(servidor.porta, "GET", `/api/projetos/${id}`);
    const corpo = resposta.json() as { jobs: { gerar_roteiro: { job_id: string; estado: string } | null } };
    expect(corpo.jobs.gerar_roteiro).not.toBeNull();
    expect(corpo.jobs.gerar_roteiro!.estado).toBe("ok");
  });

  it("job com erro carrega a SAIDA REAL do CLI (provedor cassete ausente)", async () => {
    const raizVazia = mkdtempSync(join(tmpdir(), "cassetes-vazios-"));
    const servidorErro = await subirServidor({
      raizDados: join(raizComum, "dados-s3-erro"),
      raizEstatica,
      provedor: "cassete",
      envExtras: { RAIZ_CASSETES: raizVazia },
    });
    try {
      const id = (await criarProjeto(servidorErro.porta, "Erro", 6)).id;
      const resposta = await api(servidorErro.porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
        corpo: { duracao_alvo_segundos: 6 },
      });
      const { job_id } = resposta.json() as { job_id: string };
      const final = await pollJob(servidorErro.porta, job_id, 60_000);
      expect(final.estado).toBe("erro");
      // Sonda negativa do grupo: erro vazio = o servidor engoliu a falha.
      expect(final.erro).not.toBeNull();
      expect(final.erro!.length).toBeGreaterThan(0);
      expect(final.erro!.toLowerCase()).toContain("cassete");
    } finally {
      await servidorErro.parar();
      rmSync(raizVazia, { recursive: true, force: true });
    }
  });

  it("job inexistente -> 404 job-nao-encontrado (efemero)", async () => {
    const resposta = await api(servidor.porta, "GET", "/api/jobs/job-00000000000000000000000000000000");
    expect(resposta.status).toBe(404);
    expect(codigoDeErro(resposta)).toBe("job-nao-encontrado");
  });

  it("job expirado (TTL curto) -> 404 \"job expirou\"", async () => {
    // TTL generoso o bastante para o job ser CRIADO e visivel antes de
    // expirar (o boot do tsx leva centenas de ms; o TTL mede a idade do
    // arquivo de estado, que o progresso do CLI atualiza).
    const servidorTtl = await subirServidor({
      raizDados: join(raizComum, "dados-s3-ttl"),
      raizEstatica,
      ttlJobsMs: 1000,
    });
    try {
      const id = (await criarProjeto(servidorTtl.porta, "TTL", 6)).id;
      const resposta = await api(servidorTtl.porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
        corpo: { duracao_alvo_segundos: 6 },
      });
      const { job_id } = resposta.json() as { job_id: string };
      // Visivel logo apos a criacao (o registro existe em disco).
      const visivel = await api(servidorTtl.porta, "GET", `/api/jobs/${job_id}`);
      expect(visivel.status).toBe(200);
      // Espera o job chegar a um terminal (ok/erro) OU expirar no meio
      // da execucao — os dois desfechos levam ao mesmo ponto do teste:
      // o arquivo de estado fica velho e o poll recebe 404.
      let terminal: { estado: string } | null = null;
      for (let tentativa = 0; tentativa < 100; tentativa++) {
        const estado = await api(servidorTtl.porta, "GET", `/api/jobs/${job_id}`);
        if (estado.status === 404) {
          break; // expirou durante a execucao — tambem e o desfecho do teste
        }
        terminal = estado.json() as { estado: string };
        if (terminal.estado === "ok" || terminal.estado === "erro") {
          break;
        }
        await dormir(100);
      }
      // TTL + folga apos o ultimo atualizado_em: o registro expira.
      await dormir(1100);
      const expirado = await api(servidorTtl.porta, "GET", `/api/jobs/${job_id}`);
      expect(expirado.status).toBe(404);
      expect(codigoDeErro(expirado)).toBe("job-nao-encontrado");
      const sumido = await api(servidorTtl.porta, "GET", `/api/projetos/${id}`);
      expect(sumido.status).toBe(200); // o projeto segue vivo
    } finally {
      await servidorTtl.parar();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 4 — FQ-S4: a porta declarada e a colisao clara
// ═════════════════════════════════════════════════════════════════════════════
describe("FQ-S4 — porta 4610 e colisao de porta clara (S-9)", () => {
  it("o default declarado e 4610", () => {
    expect(PORTA_PADRAO).toBe(4610);
  });

  it("colisao de porta -> o segundo servidor sai com mensagem clara", async () => {
    const raizA = mkdtempSync(join(tmpdir(), "porta-a-"));
    const raizB = mkdtempSync(join(tmpdir(), "porta-b-"));
    const servidorA = await subirServidor({
      raizDados: raizA,
      raizEstatica,
      porta: 4711,
    });
    try {
      const stderr = { valor: "" };
      const processoB = spawn(
        BIN_TSX,
        [CAMINHO_SERVIDOR],
        {
          cwd: RAIZ,
          env: {
            ...(process.env as Record<string, string>),
            RAIZ_DADOS: raizB,
            RAIZ_ESTATICA: raizEstatica,
            ROTEIRO_PROVEDOR: "sosia",
            PORT: "4711",
          },
          stdio: ["ignore", "ignore", "pipe"],
        },
      );
      const codigo = await aguardarSaida(processoB, stderr);
      // Sonda negativa: sair 0 com silencio = colisao engolida (FQ-S4).
      expect(codigo).not.toBe(0);
      expect(stderr.valor.toLowerCase()).toContain("porta 4711");
      expect(stderr.valor.toLowerCase()).toContain("eaddrinuse");
      // O primeiro servidor continua vivo.
      const viva = await api(servidorA.porta, "GET", "/api/projetos");
      expect(viva.status).toBe(200);
    } finally {
      await servidorA.parar();
      rmSync(raizA, { recursive: true, force: true });
      rmSync(raizB, { recursive: true, force: true });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 5 — fluxo feliz completo (sosia; renders REAIS; FQ-U1 do e2e)
// ═════════════════════════════════════════════════════════════════════════════
describe("fluxo feliz: criar -> gerar -> editar -> regenerar -> narrar -> previews -> juntar -> download", () => {
  let servidor: ServidorDeTeste;
  let idDoProjeto: string;
  let pedacos: Array<{ id: string; fala: string; duracao_segundos: number }>;

  beforeAll(async () => {
    servidor = await subirServidor({
      raizDados: join(raizComum, "dados-feliz"),
      raizEstatica,
    });
    idDoProjeto = (await criarProjeto(servidor.porta, "Como funciona um cache", 4)).id;
    await gerarRoteiro(servidor.porta, idDoProjeto, 4);
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string; duracao_segundos: number }> } };
    };
    pedacos = projeto.projeto.roteiro.pedacos;
  }, 120_000);

  afterAll(async () => {
    await servidor.parar();
  });

  it("o sosia gera pedacos deterministicos tipo texto (denominador do fluxo)", () => {
    // Sonda: fluxo sem pedacos = tudo a seguir e verde por vacuidade (C2).
    expect(pedacos.length).toBeGreaterThanOrEqual(2);
    for (const pedaco of pedacos) {
      expect(pedaco.fala).toBeDefined();
    }
  });

  it("edita um pedaco (PATCH) e o GET serve o roteiro mergeado", async () => {
    const alvo = pedacos[1]!;
    const resposta = await api(servidor.porta, "PATCH", `/api/projetos/${idDoProjeto}/pedacos/${alvo.id}`, {
      corpo: { fala: "Fala editada pelo usuario" },
    });
    expect(resposta.status).toBe(200);
    const pedacoServido = resposta.json() as { fala: string; narracao: { status: string } };
    expect(pedacoServido.fala).toBe("Fala editada pelo usuario");
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> }; pedacos_editados: Record<string, unknown> };
    };
    expect(projeto.projeto.pedacos_editados).toHaveProperty(alvo.id);
    expect(projeto.projeto.roteiro.pedacos.find((p) => p.id === alvo.id)?.fala).toBe(
      "Fala editada pelo usuario",
    );
  });

  it("regenera o pedaco editado: job ok, edicao dobrada e limpa, irmaos intactos", async () => {
    const alvo = pedacos[1]!;
    const antes = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    const falaDoIrmaoAntes = antes.projeto.roteiro.pedacos.find((p) => p.id === pedacos[0]!.id)!.fala;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${idDoProjeto}/pedacos/${alvo.id}/regenerar`);
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 60_000);
    expect(final.estado).toBe("ok");
    const depois = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: {
        roteiro: { pedacos: Array<{ id: string; fala: string }> };
        pedacos_editados: Record<string, unknown>;
      };
    };
    const regenerado = depois.projeto.roteiro.pedacos.find((p) => p.id === alvo.id)!;
    // Sonda: regenerar nao trocou nada (job ok sem aplicacao) = regressao.
    expect(regenerado.fala).not.toBe("Fala editada pelo usuario");
    expect(depois.projeto.pedacos_editados[alvo.id]).toBeUndefined();
    const irmao = depois.projeto.roteiro.pedacos.find((p) => p.id === pedacos[0]!.id)!;
    expect(irmao.fala).toBe(falaDoIrmaoAntes);
  });

  it("juntar ANTES da narracao -> 409 juntar-fala-sem-narracao (record-first)", async () => {
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${idDoProjeto}/juntar`);
    expect(resposta.status).toBe(409);
    const corpo = resposta.json() as { erro: { codigo: string; detalhes?: string[] } };
    expect(corpo.erro.codigo).toBe("juntar-fala-sem-narracao");
    expect(corpo.erro.detalhes?.length).toBeGreaterThan(0);
  });

  it("narrar todos os pedacos com fala (PUT wav — o servidor converte) e baixar o wav", async () => {
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    const comFala = projeto.projeto.roteiro.pedacos.filter((p) => p.fala !== "");
    expect(comFala.length).toBeGreaterThan(0);
    for (const pedaco of comFala) {
      const resposta = await api(
        servidor.porta,
        "PUT",
        `/api/projetos/${idDoProjeto}/pedacos/${pedaco.id}/narracao/audio?nome=voz.webm`,
        {
          corpo: FIXTURE_GRAVACAO,
          cabecalhos: { "Content-Type": "audio/webm" },
        },
      );
      expect(resposta.status, `narracao do pedaco ${pedaco.id}`).toBe(201);
      const narracao = resposta.json() as { texto: string; origem: string; hash_audio: string; status: string };
      expect(narracao.texto).toBe(pedaco.fala);
      expect(narracao.origem).toBe("gravacao");
      expect(narracao.hash_audio).toMatch(/^[0-9a-f]{64}$/);
      expect(narracao.status).toBe("gerado");
      const audio = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}/pedacos/${pedaco.id}/narracao/audio`);
      expect(audio.status).toBe(200);
      expect(audio.cabecalhos.get("content-type")).toBe("audio/wav");
      const bytes = Buffer.from(audio.corpo);
      // Sonda: wav de verdade (RIFF), nao um corpo vazio com 200 mentiroso.
      expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.length).toBeGreaterThan(100);
    }
  });

  it("preview de CADA pedaco (job -> mp4 real, conferido pelo servidor) e Range 206", async () => {
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string }> } };
    };
    for (const pedaco of projeto.projeto.roteiro.pedacos) {
      const resposta = await api(servidor.porta, "POST", `/api/projetos/${idDoProjeto}/pedacos/${pedaco.id}/preview`);
      expect(resposta.status).toBe(202);
      const { job_id } = resposta.json() as { job_id: string };
      const final = await pollJob(servidor.porta, job_id, 300_000);
      expect(final.estado, `preview do pedaco ${pedaco.id}: ${final.erro ?? ""}`).toBe("ok");
      expect(final.artefato?.caminho).toBe(
        `/api/projetos/${idDoProjeto}/pedacos/${pedaco.id}/preview.mp4`,
      );
      const mp4 = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}/pedacos/${pedaco.id}/preview.mp4`);
      expect(mp4.status).toBe(200);
      expect(mp4.cabecalhos.get("content-type")).toBe("video/mp4");
      const bytes = Buffer.from(mp4.corpo);
      expect(bytes.length).toBeGreaterThan(10_000);
      // Sonda por stream: o preview tem video (o servidor conferiu C1/C4;
      // o teste confere de novo — duas oraculos, nao um).
      const streams = ffprobeStreams(bytes);
      expect(streams.some((s) => s.codec_type === "video")).toBe(true);
      // Range: o <video> da SPA precisa de seek.
      const comRange = await fetch(`http://127.0.0.1:${servidor.porta}/api/projetos/${idDoProjeto}/pedacos/${pedaco.id}/preview.mp4`, {
        headers: { Range: "bytes=0-99" },
      });
      expect(comRange.status).toBe(206);
      expect((await comRange.arrayBuffer()).byteLength).toBe(100);
    }
  }, 600_000);

  it("juntar -> job ok -> video-final.mp4 com video+audio reais (ffprobe do teste)", async () => {
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${idDoProjeto}/juntar`);
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 300_000);
    expect(final.estado, final.erro ?? "").toBe("ok");
    expect(final.artefato?.caminho).toBe(`/api/projetos/${idDoProjeto}/video-final.mp4`);
    const video = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}/video-final.mp4`);
    expect(video.status).toBe(200);
    expect(video.cabecalhos.get("content-type")).toBe("video/mp4");
    const bytes = Buffer.from(video.corpo);
    expect(bytes.length).toBeGreaterThan(10_000);
    const streams = ffprobeStreams(bytes);
    // Sonda negativa por stream: video mudo passa em tudo que so checa
    // o HTTP — aqui o oraculo e o ffprobe POR STREAM (C4).
    expect(streams.some((s) => s.codec_type === "video")).toBe(true);
    expect(streams.some((s) => s.codec_type === "audio")).toBe(true);
  }, 300_000);

  it("GET projeto final: jobs por alvo ok e roteiro com narracao gravada", async () => {
    const resposta = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`);
    const corpo = resposta.json() as {
      jobs: {
        gerar_roteiro: { estado: string } | null;
        juntar: { estado: string } | null;
        previews: Record<string, { estado: string }>;
      };
      projeto: { roteiro: { pedacos: Array<{ narracao: { origem: string } }> } };
    };
    expect(corpo.jobs.gerar_roteiro?.estado).toBe("ok");
    expect(corpo.jobs.juntar?.estado).toBe("ok");
    expect(Object.values(corpo.jobs.previews).every((j) => j.estado === "ok")).toBe(true);
    const comFala = corpo.projeto.roteiro.pedacos.filter((p) => p.narracao.origem === "gravacao");
    expect(comFala.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 6 — fluxos negativos nomeados (a SPA casa por codigo, nunca por texto)
// ═════════════════════════════════════════════════════════════════════════════
describe("fluxos negativos: anexo, narracao, 404s nomeados", () => {
  let servidor: ServidorDeTeste;
  let idDoProjeto: string;

  beforeAll(async () => {
    servidor = await subirServidor({
      raizDados: join(raizComum, "dados-negativos"),
      raizEstatica,
    });
    idDoProjeto = (await criarProjeto(servidor.porta, "Negativos", 3)).id;
    await gerarRoteiro(servidor.porta, idDoProjeto, 3);
  }, 120_000);

  afterAll(async () => {
    await servidor.parar();
  });

  it("PATCH com anexo no delta -> 400 edicao-anexo-proibido", async () => {
    const resposta = await api(servidor.porta, "PATCH", `/api/projetos/${idDoProjeto}/pedacos/p-001`, {
      corpo: { anexo_hash: "00".repeat(32) },
    });
    expect(resposta.status, `corpo: ${resposta.texto()}`).toBe(400);
    expect(codigoDeErro(resposta)).toBe("edicao-anexo-proibido");
  });

  it("PATCH tipo_visual gif sem anexo -> 400 anexo-exigido-para-gif-video", async () => {
    const resposta = await api(servidor.porta, "PATCH", `/api/projetos/${idDoProjeto}/pedacos/p-001`, {
      corpo: { tipo_visual: "gif" },
    });
    expect(resposta.status).toBe(400);
    expect(codigoDeErro(resposta)).toBe("anexo-exigido-para-gif-video");
  });

  it("PUT anexo com tipo fora da allowlist -> 400 anexo-tipo-permitido", async () => {
    const resposta = await api(servidor.porta, "PUT", `/api/projetos/${idDoProjeto}/pedacos/p-001/anexo`, {
      corpo: FIXTURE_ANEXO_GIF,
      cabecalhos: { "Content-Type": "image/png" },
    });
    expect(resposta.status).toBe(400);
    expect(codigoDeErro(resposta)).toBe("anexo-tipo-permitido");
  });

  it("fluxo upload-primeiro-tipo-depois: PUT anexo 201 (nao toca tipo_visual), PATCH tipo depois", async () => {
    // O pedaco p-001 e "texto" — o upload NAO muda o tipo_visual.
    const antes = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; tipo_visual: string }> } };
    };
    const tipoAntes = antes.projeto.roteiro.pedacos.find((p) => p.id === "p-001")!.tipo_visual;
    const upload = await api(
      servidor.porta,
      "PUT",
      `/api/projetos/${idDoProjeto}/pedacos/p-001/anexo?nome=reacao.gif`,
      { corpo: FIXTURE_ANEXO_GIF, cabecalhos: { "Content-Type": "image/gif" } },
    );
    expect(upload.status).toBe(201);
    const anexo = upload.json() as { hash: string; tipo: string; tamanho: number; nome_original: string };
    expect(anexo.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(anexo.tipo).toBe("image/gif");
    expect(anexo.tamanho).toBe(FIXTURE_ANEXO_GIF.length);
    expect(anexo.nome_original).toBe("reacao.gif");
    const baixado = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}/pedacos/p-001/anexo`);
    expect(baixado.status).toBe(200);
    expect(baixado.cabecalhos.get("content-type")).toBe("image/gif");
    expect(Buffer.from(baixado.corpo).equals(FIXTURE_ANEXO_GIF)).toBe(true);
    // Agora o PATCH de tipo passa (o par existe).
    const patch = await api(servidor.porta, "PATCH", `/api/projetos/${idDoProjeto}/pedacos/p-001`, {
      corpo: { tipo_visual: "gif" },
    });
    expect(patch.status).toBe(200);
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; tipo_visual: string }> } };
    };
    expect(projeto.projeto.roteiro.pedacos.find((p) => p.id === "p-001")?.tipo_visual).toBe("gif");
    expect(tipoAntes).not.toBe("gif"); // o upload em si nao mudou o tipo
  });

  it("narracao: pedaco sem fala -> 409 pedaco-sem-fala; sem gravacao -> 404 narracao-nao-gravada", async () => {
    // O pedaco p-000 do sosia nao tem fala.
    const semFala = await api(
      servidor.porta,
      "PUT",
      `/api/projetos/${idDoProjeto}/pedacos/p-000/narracao/audio`,
      { corpo: FIXTURE_GRAVACAO, cabecalhos: { "Content-Type": "audio/webm" } },
    );
    expect(semFala.status).toBe(409);
    expect(codigoDeErro(semFala)).toBe("pedaco-sem-fala");
    // Roda ANTES do teste de DELETE de anexo (que narra os pedacos com
    // fala) — aqui p-001 ainda nunca foi narrado.
    const semGravacao = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}/pedacos/p-001/narracao/audio`);
    expect(semGravacao.status).toBe(404);
    expect(codigoDeErro(semGravacao)).toBe("narracao-nao-gravada");
    const semRemover = await api(servidor.porta, "DELETE", `/api/projetos/${idDoProjeto}/pedacos/p-001/narracao`);
    expect(semRemover.status).toBe(404);
    expect(codigoDeErro(semRemover)).toBe("narracao-nao-gravada");
  });

  it("DELETE anexo remove SO o par e o juntar fica bloqueado (anexo-exigido)", async () => {
    const deletado = await api(servidor.porta, "DELETE", `/api/projetos/${idDoProjeto}/pedacos/p-001/anexo`);
    expect(deletado.status).toBe(204);
    const depois = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}/pedacos/p-001/anexo`);
    expect(depois.status).toBe(404);
    expect(codigoDeErro(depois)).toBe("anexo-inexistente");
    // Para chegar ao GATE de anexo do juntar, o gate de narracao
    // precisa estar satisfeito: narra todos os pedacos com fala.
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    for (const pedaco of projeto.projeto.roteiro.pedacos.filter((p) => p.fala !== "")) {
      const narrado = await api(
        servidor.porta,
        "PUT",
        `/api/projetos/${idDoProjeto}/pedacos/${pedaco.id}/narracao/audio`,
        { corpo: FIXTURE_GRAVACAO, cabecalhos: { "Content-Type": "audio/webm" } },
      );
      expect(narrado.status).toBe(201);
    }
    // O pedaco ficou gif sem anexo — o juntar recusa com a regra nomeada.
    const juntar = await api(servidor.porta, "POST", `/api/projetos/${idDoProjeto}/juntar`);
    expect(juntar.status).toBe(409);
    expect(codigoDeErro(juntar)).toBe("anexo-exigido-para-gif-video");
  });

  it("preview sem roteiro -> 409 roteiro-nao-gerado; preview.mp4 sem render -> 404", async () => {
    const idNovo = (await criarProjeto(servidor.porta, "Sem roteiro")).id;
    const semRoteiro = await api(servidor.porta, "POST", `/api/projetos/${idNovo}/pedacos/p-000/preview`);
    expect(semRoteiro.status).toBe(409);
    expect(codigoDeErro(semRoteiro)).toBe("roteiro-nao-gerado");
    const semRender = await api(servidor.porta, "GET", `/api/projetos/${idNovo}/pedacos/p-000/preview.mp4`);
    expect(semRender.status).toBe(404);
    expect(codigoDeErro(semRender)).toBe("pedaco-nao-encontrado");
    const semEntrega = await api(servidor.porta, "GET", `/api/projetos/${idNovo}/video-final.mp4`);
    expect(semEntrega.status).toBe(404);
    expect(codigoDeErro(semEntrega)).toBe("entrega-nao-existe");
  });

  it("DELETE do projeto remove o diretorio e os jobs (204)", async () => {
    const idNovo = (await criarProjeto(servidor.porta, "Apagar")).id;
    const resposta = await api(servidor.porta, "DELETE", `/api/projetos/${idNovo}`);
    expect(resposta.status).toBe(204);
    const sumido = await api(servidor.porta, "GET", `/api/projetos/${idNovo}`);
    expect(sumido.status).toBe(404);
    expect(existsSync(join(servidor.raizDados, "projetos", idNovo))).toBe(false);
  });

  it("Sonda negativa do grupo: cada 409/400 acima carregou o CODIGO do envelope", async () => {
    // Ja exercitado em cada caso acima via codigoDeErro — aqui so o
    // denominador: o servidor continua de pe e o roteiro existe.
    const resposta = await api(servidor.porta, "GET", `/api/projetos/${idDoProjeto}`);
    expect(resposta.status).toBe(200);
    const corpo = resposta.json() as { projeto: { roteiro?: { pedacos: unknown[] } } };
    expect(corpo.projeto.roteiro?.pedacos.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 7 — path traversal no :id/:jobId (BLOCK da revisao adversarial)
// ═════════════════════════════════════════════════════════════════════════════
//
// O parser WHATWG do `new URL` NAO normaliza %2F/%2e%2e DENTRO de um
// segmento; o matcher decodifica o segmento depois do split
// (decodeURIComponent) — `..%2F..%2Ftarget` chegava como id
// "../../target", usado sem validacao em join(raizDados, "projetos",
// id) (leitura 200 provada), sobrescrito via PATCH e removido
// recursivamente via DELETE. :jobId tinha a mesma classe (jobs.ts —
// caminhoDoEstado/caminhoDoMeta). A regra: so existe o formato que o
// servidor GERA (proj-<8 hex>, job-<32 hex>) — qualquer outro valor e
// 404 com o codigo do recurso inexistente, nunca 500.
describe("path traversal — :id e :jobId so aceitam o formato gerado pelo servidor", () => {
  let servidor: ServidorDeTeste;

  beforeAll(async () => {
    servidor = await subirServidor({
      raizDados: join(raizComum, "dados-traversal"),
      raizEstatica,
    });
    // Denominador: um projeto REAL existe — os 404 abaixo nao podem
    // ser explicados por "diretorio vazio".
    await criarProjeto(servidor.porta, "Traversal", 3);
  }, 120_000);

  afterAll(async () => {
    await servidor.parar();
  });

  // Um alvo FORA da raiz de projetos (raizComum/target/projeto.json):
  // antes do conserto o GET `..%2F..%2Ftarget` o LEIA com 200 e o
  // DELETE o REMOVA recursivamente. O conteudo e um marcador — se
  // qualquer resposta trouxer "fugiu", a sonda falha (codigoDeErro
  // exige o envelope; conteudo vazado nao tem envelope).
  const caminhoDoAlvoForaDaRaiz = join(raizComum, "target", "projeto.json");
  function criarAlvoForaDaRaiz(): void {
    mkdirSync(join(raizComum, "target"), { recursive: true });
    writeFileSync(
      caminhoDoAlvoForaDaRaiz,
      '{"fugiu":true,"conteudo":"fora-da-raiz-de-projetos"}\n',
      "utf-8",
    );
  }

  const variacoesDeIdInvalido: ReadonlyArray<readonly [string, string, boolean]> = [
    ["..%2F..%2Ftarget", "/api/projetos/..%2F..%2Ftarget", true],
    ["%2e%2e%2F..%2Ftarget", "/api/projetos/%2e%2e%2F..%2Ftarget", true],
    ["..%2f..%2f", "/api/projetos/..%2f..%2f", false],
    ["%2Fetc%2Fpasswd", "/api/projetos/%2Fetc%2Fpasswd", false],
    ["..%5C..%5C", "/api/projetos/..%5C..%5C", false],
    ["abc", "/api/projetos/abc", false],
    ["proj-XYZ", "/api/projetos/proj-XYZ", false],
    ["proj-", "/api/projetos/proj-", false],
    ["%20", "/api/projetos/%20", false],
    ["preview.mp4", "/api/projetos/preview.mp4", false],
  ];

  it.each(variacoesDeIdInvalido)(
    "GET /api/projetos com :id \"%s\" -> 404 projeto-nao-encontrado (nunca 200 nem conteudo)",
    async (_nome, caminho, comAlvoForaDaRaiz) => {
      if (comAlvoForaDaRaiz) {
        criarAlvoForaDaRaiz();
      }
      const resposta = await api(servidor.porta, "GET", caminho);
      // Sonda negativa: 200 OU corpo sem envelope = traversal viva.
      expect(resposta.status).toBe(404);
      expect(codigoDeErro(resposta)).toBe("projeto-nao-encontrado");
    },
  );

  it("DELETE /api/projetos/..%2F..%2Ftarget -> 404 e o alvo fora da raiz permanece (nunca rm recursivo)", async () => {
    criarAlvoForaDaRaiz();
    const resposta = await api(servidor.porta, "DELETE", "/api/projetos/..%2F..%2Ftarget");
    expect(resposta.status).toBe(404);
    expect(codigoDeErro(resposta)).toBe("projeto-nao-encontrado");
    // Sonda negativa: antes do conserto o DELETE removia o diretorio inteiro.
    expect(existsSync(caminhoDoAlvoForaDaRaiz)).toBe(true);
  });

  it("GET /api/jobs/..%2F..%2Falvo -> 404 job-nao-encontrado (a mesma classe em :jobId)", async () => {
    const resposta = await api(servidor.porta, "GET", "/api/jobs/..%2F..%2Falvo");
    expect(resposta.status).toBe(404);
    expect(codigoDeErro(resposta)).toBe("job-nao-encontrado");
  });

  it("o FORMATO real (regra): projeto proj-<8 hex> e job job-<32 hex>; vazio e invalido", () => {
    // O "vazio" nunca chega ao :id pela rede (o matcher filtra
    // segmentos vazios antes) — a regra e testada direto no formato.
    expect(FORMATO_DE_ID_DE_PROJETO.test("")).toBe(false);
    expect(FORMATO_DE_ID_DE_PROJETO.test("proj-01234567")).toBe(true);
    expect(FORMATO_DE_ID_DE_PROJETO.test("proj-012345678")).toBe(false); // 9 hex
    expect(FORMATO_DE_ID_DE_PROJETO.test("PROJ-01234567")).toBe(false); // maiusculo
    expect(FORMATO_DE_ID_DE_PROJETO.test("job-00000000000000000000000000000000")).toBe(false);
    expect(FORMATO_DE_ID_DE_JOB.test("")).toBe(false);
    expect(FORMATO_DE_ID_DE_JOB.test("job-00000000000000000000000000000000")).toBe(true);
    expect(FORMATO_DE_ID_DE_JOB.test("job-0000000000000000000000000000000")).toBe(false); // 31 hex
    expect(FORMATO_DE_ID_DE_JOB.test("proj-01234567")).toBe(false);
  });
});
