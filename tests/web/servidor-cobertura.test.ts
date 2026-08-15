// =============================================================================
// SERVICO WEB — cobertura EM PROCESSO (src/web/servidor.ts)
// =============================================================================
//
// Por que em processo: o trio do gate nao roda coverage, e a suite
// existente (tests/web/servidor.test.ts) sobe o servidor num
// SUBPROCESSO — o que o v8 provider nao enxerga. Este arquivo sobe o
// servidor no MESMO processo (criarServidor + listen 0) e cobre os
// branches que a suite de subprocesso nunca exercita em cobertura:
// rotas com payloads invalidos, CLIs falsos que falham em cada etapa
// (D11: exit != 0 com envelope no stderr, stdout nao-JSON, spawn
// ENOENT), expiracao no meio do poll (TTL 0), static sem index.html,
// Range 206/416, Content-Type errado nos uploads, 413, ?nome=
// malformado, 500s honestos (corrompido/nao-conferido), colisao de
// porta em processo e os gates 409 antes do trabalho.
//
// Os CLIs falsos (raizDoProjeto falsa com um tsx shim) tornam cada
// etapa do job DETERMINISTICA — nenhum teste depende do tempo do
// sosia/Remotion; o fluxo feliz real (render de preview + juntar) roda
// UMA vez com os CLIs reais para cobrir o caminho inteiro.
//
// Rede: o guarda bloqueia fetch em processo — este arquivo desliga e
// reinstala com permitirLoopback:true (o mesmo padrao de
// tests/web/servidor.test.ts).
// =============================================================================

import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { bloquearRede, liberarRede } from "../../src/resolucao/rede/bloqueio.js";
import {
  casarRota,
  casarRotaComTabela,
  criarServidor,
  ErroPortaEmUso,
  FORMATO_DE_ID_DE_JOB,
  FORMATO_DE_ID_DE_PROJETO,
  iniciarServidor,
} from "../../src/web/servidor.js";
import type { OpcoesDoServidor, ServidorApp } from "../../src/web/servidor.js";

const RAIZ = join(__dirname, "..", "..");
const TSX_REAL = join(RAIZ, "node_modules", ".bin", "tsx");

const FIXTURE_GRAVACAO = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "gravacao.webm"));
const ROTEIRO_FIXTURE = join(RAIZ, "tests", "roteiro", "fixtures", "roteiro-valido.json");
const PEDACO_FIXTURE = join(RAIZ, "tests", "roteiro", "fixtures", "pedaco-valido.json");

// ─── Rede: o guarda permite loopback neste arquivo (o servidor e local) ──────

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

// ─── Estatica comum (a SPA — com varios MIMEs para o mimeDe) ──────────────────

const raizComum = mkdtempSync(join(tmpdir(), "servidor-cobertura-"));
const raizEstatica = join(raizComum, "estatica");
mkdirSync(join(raizEstatica, "assets"), { recursive: true });
writeFileSync(join(raizEstatica, "index.html"), "<!doctype html><title>Editor de Video IA</title>\n", "utf-8");
writeFileSync(join(raizEstatica, "assets", "app.js"), "console.log('spa');\n", "utf-8");
writeFileSync(join(raizEstatica, "assets", "estilo.css"), "body { color: red }\n", "utf-8");
writeFileSync(join(raizEstatica, "assets", "dados.json"), '{"chave": 1}\n', "utf-8");
writeFileSync(join(raizEstatica, "assets", "icone.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>", "utf-8");
writeFileSync(join(raizEstatica, "assets", "imagem.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]));
writeFileSync(join(raizEstatica, "assets", "fonte.woff2"), Buffer.from("wOF2"));
writeFileSync(join(raizEstatica, "assets", "favicon.ico"), Buffer.from([0x00, 0x00, 0x01, 0x00]));

afterAll(() => {
  rmSync(raizComum, { recursive: true, force: true });
});

// ─── O servidor em processo (a cobertura enxerga este) ────────────────────────

interface ServidorEmProcesso {
  readonly porta: number;
  readonly app: ServidorApp;
  parar(): Promise<void>;
}

async function subirEmProcesso(opcoes: OpcoesDoServidor = {}): Promise<ServidorEmProcesso> {
  const { servidor, app } = criarServidor({ logar: () => {}, ...opcoes });
  await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", () => resolve()));
  const porta = (servidor.address() as AddressInfo).port;
  return {
    porta,
    app,
    parar: () =>
      new Promise<void>((resolve) => {
        servidor.close(() => resolve());
      }),
  };
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

function codigoDeErro(resposta: RespostaDeApi): string {
  const corpo = resposta.json() as { erro?: { codigo?: string } };
  if (typeof corpo.erro?.codigo !== "string") {
    throw new Error(`resposta ${resposta.status} sem envelope {erro:{codigo}} — corpo: ${resposta.texto()}`);
  }
  return corpo.erro.codigo;
}

async function pollJob(
  porta: number,
  jobId: string,
  prazoMs: number,
): Promise<{ estado: string; progresso: number | null; erro: string | null; artefato: { tipo: string; caminho: string } | null }> {
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
    await dormir(100);
  }
  throw new Error(`job ${jobId} nao terminou em ${prazoMs} ms — ultimo estado: ${JSON.stringify(ultimo)}`);
}

async function criarProjeto(porta: number, tema = "Cobertura", duracaoAlvo = 6): Promise<{ id: string }> {
  const resposta = await api(porta, "POST", "/api/projetos", {
    corpo: { brief: { tema, contexto: "para iniciantes", duracao_alvo_segundos: duracaoAlvo } },
  });
  if (resposta.status !== 201) {
    throw new Error(`criar projeto falhou: ${resposta.status} ${resposta.texto()}`);
  }
  return resposta.json() as { id: string };
}

async function gerarRoteiro(porta: number, id: string, duracaoAlvo = 6): Promise<{ job_id: string }> {
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
  return { job_id };
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ffprobeStreams(bytes: Buffer): Array<{ codec_type: string }> {
  const arquivo = join(mkdtempSync(join(tmpdir(), "probe-cob-")), "video.mp4");
  writeFileSync(arquivo, bytes);
  const saida = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "stream=codec_type", "-of", "json", arquivo],
    { encoding: "utf-8" },
  );
  return (JSON.parse(saida) as { streams: Array<{ codec_type: string }> }).streams;
}

// ─── Os CLIs falsos (D11: cada etapa deterministica) ──────────────────────────

/**
 * O CLI falso: le o pedido do stdin, escreve progresso no arquivo de
 * estado (--estado) e termina conforme CENARIO_CLI:
 *   sucesso          — imprime o conteudo de CLI_SAIDA (JSON) e sai 0
 *   dormir           — igual ao sucesso, apos CLI_DORMIR_MS
 *   erro-envelope    — stderr com envelope JSON cercado de ruido, exit 1
 *   erro-texto       — stderr texto puro, exit 1
 *   erro-vazio       — exit 1 sem saída
 *   saida-invalida   — stdout nao-JSON, exit 0
 */
const FONTE_CLI_FALSO = `
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const estadoPath = args[1];
const cenario = process.env.CENARIO_CLI ?? "sucesso";
const saidaPath = process.env.CLI_SAIDA;
const dormirMs = Number(process.env.CLI_DORMIR_MS ?? "0");

function escrever(estado) {
  writeFileSync(estadoPath, JSON.stringify(estado) + "\\n");
}

process.stdin.setEncoding("utf-8");
process.stdin.on("data", () => undefined);
process.stdin.on("end", () => {
  escrever({ estado: "rodando", progresso: 0.5, mensagem: "CLI falso trabalhando...", erro: null, atualizado_em: new Date().toISOString() });
  const terminar = () => {
    if (cenario === "erro-envelope") {
      process.stderr.write("linha de ruido\\n" + JSON.stringify({ erro: { codigo: "cli-falhou", mensagem: "cassete vazio para o pedido" } }) + "\\ntrail\\n");
      process.exit(1);
    }
    if (cenario === "erro-texto") {
      process.stderr.write("falha real do CLI: deu ruim no render\\n");
      process.exit(1);
    }
    if (cenario === "erro-vazio") {
      process.exit(1);
    }
    if (cenario === "saida-invalida") {
      process.stdout.write("isto nao e json\\n");
      process.exit(0);
    }
    if (saidaPath === undefined) {
      process.stderr.write("CLI_SAIDA nao definido\\n");
      process.exit(2);
    }
    escrever({ estado: "ok", progresso: 1, mensagem: "pronto.", erro: null, atualizado_em: new Date().toISOString() });
    process.stdout.write(readFileSync(saidaPath, "utf-8"));
    process.exit(0);
  };
  if (dormirMs > 0) {
    setTimeout(terminar, dormirMs);
  } else {
    terminar();
  }
});
`;

const CLIS_DO_SERVIDOR = [
  "src/roteiro/gerador/cli.ts",
  "src/roteiro/preview/cli.ts",
  "src/roteiro/juntar/cli.ts",
];

/** Raiz falsa de projeto com tsx shim + os tres CLIs falsos. */
function criarRaizFalsa(comTsx = true): string {
  const raiz = mkdtempSync(join(tmpdir(), "servidor-fake-"));
  if (comTsx) {
    const binDir = join(raiz, "node_modules", ".bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "tsx"), `#!/bin/sh\nexec "${TSX_REAL}" "$@"\n`, "utf-8");
    chmodSync(join(binDir, "tsx"), 0o755);
  }
  for (const cli of CLIS_DO_SERVIDOR) {
    const caminho = join(raiz, cli);
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(caminho, FONTE_CLI_FALSO, "utf-8");
  }
  return raiz;
}

function escreverSaidaFalsa(raizFalsa: string, valor: unknown): string {
  const caminho = join(raizFalsa, "saida.json");
  writeFileSync(caminho, JSON.stringify(valor), "utf-8");
  return caminho;
}

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 0 — o matcher: bordas que a rede nao produz (decode, wildcard, barra)
// ═════════════════════════════════════════════════════════════════════════════
describe("matcher de rotas — bordas do casamento (unitario, sem servidor)", () => {
  it("sequencia de percent invalida -> o segmento nao casa (decodeURIComponent lanca)", () => {
    expect(casarRota("GET", "/api/projetos/%zz")).toBeNull();
    expect(casarRota("GET", "/api/projetos/abc%zz")).toBeNull();
  });

  it("barra final e normalizada (segmentos vazios sao filtrados)", () => {
    expect(casarRota("GET", "/api/projetos/")?.nome).toBe("listarProjetos");
    expect(casarRota("GET", "/api/projetos/proj-01234567/")?.nome).toBe("obterProjeto");
  });

  it("wildcard so vence se nada literal casar (assets da SPA)", () => {
    const tabela = {
      wildcard: "GET /assets/*",
      literal: "GET /assets/app.js",
    } as const;
    expect(casarRotaComTabela("GET", "/assets/app.js", tabela)?.nome).toBe("literal");
    expect(casarRotaComTabela("GET", "/assets/outro.js", tabela)?.nome).toBe("wildcard");
    // "/assets/" nao e um asset (o wildcard exige algo depois do prefixo).
    expect(casarRotaComTabela("GET", "/assets/", tabela)).toBeNull();
  });

  it("params decodificados: %20 vira espaco no :id (o FORMATO rejeita depois)", () => {
    const casada = casarRota("GET", "/api/projetos/proj-0123%204567");
    expect(casada?.params["id"]).toBe("proj-0123 4567");
  });

  it("o FORMATO rejeita o espaco decodificado (nunca chega ao disco)", () => {
    expect(FORMATO_DE_ID_DE_PROJETO.test("proj-0123 4567")).toBe(false);
    expect(FORMATO_DE_ID_DE_JOB.test("job-00000000000000000000000000000000")).toBe(true);
    expect(FORMATO_DE_ID_DE_JOB.test("job-0000000000000000000000000000000g")).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 1 — os CLIs falsos: cada etapa de falha do D11, 404s e gates 409
// ═════════════════════════════════════════════════════════════════════════════
describe("jobs com CLI falso — falha em cada etapa (D11/FQ-S3), 404 e gates 409", () => {
  const raizFalsa = criarRaizFalsa();
  const raizDados = join(raizComum, "dados-fake");
  let servidor: ServidorEmProcesso;

  beforeAll(async () => {
    servidor = await subirEmProcesso({
      raizDoProjeto: raizFalsa,
      raizDados,
      raizEstatica,
      provedorPadrao: "sosia",
    });
  }, 30_000);

  afterAll(async () => {
    await servidor.parar();
    rmSync(raizFalsa, { recursive: true, force: true });
  });

  afterEach(() => {
    delete process.env.CENARIO_CLI;
    delete process.env.CLI_SAIDA;
    delete process.env.CLI_DORMIR_MS;
  });

  it("CLI sai != 0 com envelope JSON no stderr -> job erro com a MENSAGEM do envelope (FQ-S3)", async () => {
    process.env.CENARIO_CLI = "erro-envelope";
    const id = (await criarProjeto(servidor.porta, "Erro envelope")).id;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`);
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("erro");
    expect(final.progresso).toBe(1);
    // Sonda do grupo: a linha JSON do stderr vence o ruido ao redor.
    expect(final.erro).toBe("cassete vazio para o pedido");
  });

  it("CLI sai != 0 com texto puro -> job erro com o texto real", async () => {
    process.env.CENARIO_CLI = "erro-texto";
    const id = (await criarProjeto(servidor.porta, "Erro texto")).id;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("erro");
    expect(final.erro).toBe("falha real do CLI: deu ruim no render");
  });

  it("CLI sai != 0 sem saida -> erro honesto (nunca \"ok\" mentiroso)", async () => {
    process.env.CENARIO_CLI = "erro-vazio";
    const id = (await criarProjeto(servidor.porta, "Erro vazio")).id;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("erro");
    expect(final.erro).toBe("falha na operacao (o CLI nao imprimiu saida)");
  });

  it("CLI sai 0 com stdout nao-JSON -> erro com a causa nomeada (assimilar lanca)", async () => {
    process.env.CENARIO_CLI = "saida-invalida";
    const id = (await criarProjeto(servidor.porta, "Saida invalida")).id;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("erro");
    expect(final.erro).toContain("nao e JSON valido");
    // O roteiro NAO foi aplicado (o efeito so existe no terminal ok).
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro?: unknown };
    };
    expect(projeto.projeto.roteiro).toBeUndefined();
  });

  it("regenerar com stdout nao-JSON -> o mesmo erro nomeado (assimilarPedacoRegenerado)", async () => {
    const id = (await criarProjeto(servidor.porta, "Regenerar invalido")).id;
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    await gerarRoteiro(servidor.porta, id, 6);
    process.env.CENARIO_CLI = "saida-invalida";
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/p-001/regenerar`);
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("erro");
    expect(final.erro).toContain("nao e JSON valido");
  });

  it("spawn ENOENT (tsx ausente) -> job erro honesto, nunca ok (o processo morre antes do CLI)", async () => {
    const raizSemTsx = criarRaizFalsa(false);
    const servidorSemTsx = await subirEmProcesso({
      raizDoProjeto: raizSemTsx,
      raizDados: join(raizComum, "dados-sem-tsx"),
      raizEstatica,
    });
    try {
      const id = (await criarProjeto(servidorSemTsx.porta, "Sem tsx")).id;
      const resposta = await api(servidorSemTsx.porta, "POST", `/api/projetos/${id}/roteiro/gerar`);
      const { job_id } = resposta.json() as { job_id: string };
      const final = await pollJob(servidorSemTsx.porta, job_id, 30_000);
      // Sonda do grupo (FQ-S3): spawn morto NUNCA vira "ok" — o terminal
      // e erro com mensagem nao-vazia. NOTA: o 'error' e o 'close' do
      // spawn disparam os dois em ENOENT e a ultima escrita vence — a
      // mensagem "falha ao spawnar o CLI" e sobrescrita pela generica
      // (ver BUG reportado: src/web/servidor.ts rodarJobCli).
      expect(final.estado).toBe("erro");
      expect(final.erro).not.toBeNull();
      expect(final.erro!.length).toBeGreaterThan(0);
    } finally {
      await servidorSemTsx.parar();
      rmSync(raizSemTsx, { recursive: true, force: true });
    }
  });

  it("job sucesso: o roteiro do CLI e aplicado (assimilarRoteiroGerado)", async () => {
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    const id = (await criarProjeto(servidor.porta, "Sucesso fake")).id;
    const { job_id } = await gerarRoteiro(servidor.porta, id, 6);
    const final = await api(servidor.porta, "GET", `/api/jobs/${job_id}`);
    const corpo = final.json() as { estado: string; artefato: { tipo: string; caminho: string } };
    expect(corpo.estado).toBe("ok");
    expect(corpo.artefato).toEqual({ tipo: "roteiro-json", caminho: `/api/projetos/${id}` });
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: unknown[] } };
    };
    expect(projeto.projeto.roteiro.pedacos.length).toBe(3);
  });

  it("job com preview: saida sem hash/caminho -> erro nomeado; o mp4 nao vira 200", async () => {
    const id = (await criarProjeto(servidor.porta, "Preview shape")).id;
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    await gerarRoteiro(servidor.porta, id, 6);
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = escreverSaidaFalsa(raizFalsa, {});
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/p-001/preview`);
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("erro");
    expect(final.erro).toContain("sem hash/caminho/duracao_segundos");
  });

  it("preview em andamento -> GET preview.mp4 409 preview-em-andamento (FQ-U2)", async () => {
    const id = (await criarProjeto(servidor.porta, "Preview andamento")).id;
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    await gerarRoteiro(servidor.porta, id, 6);
    process.env.CENARIO_CLI = "dormir";
    process.env.CLI_DORMIR_MS = "4000";
    process.env.CLI_SAIDA = escreverSaidaFalsa(raizFalsa, {
      hash: "dd".repeat(32),
      caminho: join(raizEstatica, "index.html"),
      duracao_segundos: 3,
    });
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/p-001/preview`);
    const { job_id } = resposta.json() as { job_id: string };
    const emAndamento = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/p-001/preview.mp4`);
    expect(emAndamento.status).toBe(409);
    expect(codigoDeErro(emAndamento)).toBe("preview-em-andamento");
    // Apos o terminal, o mesmo GET cai na conferencia do conteudo (C1):
    // o arquivo nao existe -> 500 honesto, nunca 200 com corpo errado.
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("ok");
    const semConferir = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/p-001/preview.mp4`);
    expect(semConferir.status).toBe(500);
    expect(codigoDeErro(semConferir)).toBe("preview-invalido");
  });

  it("juntar em andamento -> POST juntar 409 e video-final 409 (FQ-U2); terminal sem conferencia -> 500", { timeout: 120_000 }, async () => {
    const id = (await criarProjeto(servidor.porta, "Juntar andamento")).id;
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    await gerarRoteiro(servidor.porta, id, 6);
    // Narrar os pedacos com fala (conversao REAL via ffmpeg — o gate de narracao).
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    for (const pedaco of projeto.projeto.roteiro.pedacos.filter((p) => p.fala !== "")) {
      const narrado = await api(
        servidor.porta,
        "PUT",
        `/api/projetos/${id}/pedacos/${pedaco.id}/narracao/audio`,
        { corpo: FIXTURE_GRAVACAO, cabecalhos: { "Content-Type": "audio/webm" } },
      );
      expect(narrado.status).toBe(201);
    }
    // Previews falsos para TODOS os pedacos (o gate de preview do juntar).
    const saidaPreview = escreverSaidaFalsa(raizFalsa, {
      hash: "cc".repeat(32),
      caminho: join(raizEstatica, "index.html"),
      duracao_segundos: 3,
    });
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = saidaPreview;
    for (const pedaco of projeto.projeto.roteiro.pedacos) {
      const pedido = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/${pedaco.id}/preview`);
      const { job_id } = pedido.json() as { job_id: string };
      const final = await pollJob(servidor.porta, job_id, 30_000);
      expect(final.estado).toBe("ok");
    }
    // Agora o juntar dorme: enquanto roda, o segundo juntar e o GET do mp4 dao 409.
    process.env.CENARIO_CLI = "dormir";
    process.env.CLI_DORMIR_MS = "4000";
    process.env.CLI_SAIDA = escreverSaidaFalsa(raizFalsa, {
      hash: "ee".repeat(32),
      caminho: "/tmp/entrega-inexistente.mp4",
      duracao_total_segundos: 9,
    });
    const primeiro = await api(servidor.porta, "POST", `/api/projetos/${id}/juntar`);
    expect(primeiro.status).toBe(202);
    const { job_id } = primeiro.json() as { job_id: string };
    const segundo = await api(servidor.porta, "POST", `/api/projetos/${id}/juntar`);
    expect(segundo.status).toBe(409);
    expect(codigoDeErro(segundo)).toBe("juntar-em-andamento");
    const mp4Durante = await api(servidor.porta, "GET", `/api/projetos/${id}/video-final.mp4`);
    expect(mp4Durante.status).toBe(409);
    expect(codigoDeErro(mp4Durante)).toBe("juntar-em-andamento");
    // Terminal: o job ok grava o indice; o GET cai na conferencia (C1/C4).
    const final = await pollJob(servidor.porta, job_id, 30_000);
    expect(final.estado).toBe("ok");
    const entregaInvalida = await api(servidor.porta, "GET", `/api/projetos/${id}/video-final.mp4`);
    expect(entregaInvalida.status).toBe(500);
    expect(codigoDeErro(entregaInvalida)).toBe("entrega-invalida");
  });

  it("DELETE do projeto remove o diretorio E os jobs (registros somem do gerenciador)", async () => {
    const id = (await criarProjeto(servidor.porta, "Delete com job")).id;
    process.env.CENARIO_CLI = "dormir";
    process.env.CLI_DORMIR_MS = "5000";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`);
    expect(servidor.app.jobs.listarDoProjeto(id).length).toBe(1);
    const resposta = await api(servidor.porta, "DELETE", `/api/projetos/${id}`);
    expect(resposta.status).toBe(204);
    expect(servidor.app.jobs.listarDoProjeto(id)).toEqual([]);
  });

  it("TTL 0: o job expira na primeira leitura e sai dos jobs por alvo", async () => {
    const servidorTtl = await subirEmProcesso({
      raizDoProjeto: raizFalsa,
      raizDados: join(raizComum, "dados-ttl0"),
      raizEstatica,
      ttlJobsMs: 0,
    });
    try {
      process.env.CENARIO_CLI = "sucesso";
      process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
      const id = (await criarProjeto(servidorTtl.porta, "TTL zero")).id;
      const resposta = await api(servidorTtl.porta, "POST", `/api/projetos/${id}/roteiro/gerar`);
      const { job_id } = resposta.json() as { job_id: string };
      const expirado = await api(servidorTtl.porta, "GET", `/api/jobs/${job_id}`);
      expect(expirado.status).toBe(404);
      expect(codigoDeErro(expirado)).toBe("job-nao-encontrado");
      // O "jobs por alvo" do projeto deriva do estado dos jobs: sem job, null.
      const projeto = (await api(servidorTtl.porta, "GET", `/api/projetos/${id}`)).json() as {
        jobs: { gerar_roteiro: unknown };
      };
      expect(projeto.jobs.gerar_roteiro).toBeNull();
    } finally {
      await servidorTtl.parar();
    }
  });

  it("preview gif/video sem anexo -> 409 anexo-exigido; o load NAO recusa o transitorio", async () => {
    const id = (await criarProjeto(servidor.porta, "Anexo transitorio")).id;
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    await gerarRoteiro(servidor.porta, id, 6);
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF\x21\xF9\x04\x01\x00\x00\x00\x00\x2C\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3B", "binary");
    const upload = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-001/anexo?nome=x.gif`, {
      corpo: gif,
      cabecalhos: { "Content-Type": "image/gif" },
    });
    expect(upload.status).toBe(201);
    const patch = await api(servidor.porta, "PATCH", `/api/projetos/${id}/pedacos/p-001`, {
      corpo: { tipo_visual: "gif" },
    });
    expect(patch.status).toBe(200);
    const deletado = await api(servidor.porta, "DELETE", `/api/projetos/${id}/pedacos/p-001/anexo`);
    expect(deletado.status).toBe(204);
    // O par ficou inconsistente: preview bloqueado com a regra nomeada...
    const preview = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/p-001/preview`);
    expect(preview.status).toBe(409);
    expect(codigoDeErro(preview)).toBe("anexo-exigido-para-gif-video");
    // ...mas o GET do projeto NAO recusa (upload primeiro, tipo depois).
    const projeto = await api(servidor.porta, "GET", `/api/projetos/${id}`);
    expect(projeto.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 2 — payloads invalidos, 400/404/413 e o juntar-roteiro-invalido
// ═════════════════════════════════════════════════════════════════════════════
describe("payloads invalidos e gates do juntar (FQ-C1: nunca aceita em silencio)", () => {
  const raizFalsa = criarRaizFalsa();
  let servidor: ServidorEmProcesso;

  beforeAll(async () => {
    servidor = await subirEmProcesso({
      raizDoProjeto: raizFalsa,
      raizDados: join(raizComum, "dados-payloads"),
      raizEstatica,
    });
  }, 30_000);

  afterAll(async () => {
    await servidor.parar();
    rmSync(raizFalsa, { recursive: true, force: true });
  });

  afterEach(() => {
    delete process.env.CENARIO_CLI;
    delete process.env.CLI_SAIDA;
  });

  it("brief invalido nas regras do validador -> 400 com as regras NOMEADAS", async () => {
    const casos = [
      { brief: {} },
      { brief: { tema: "" } },
      { brief: { tema: "x", duracao_alvo_segundos: 0 } },
      { brief: { tema: "x", duracao_alvo_segundos: -5 } },
    ] as const;
    for (const corpo of casos) {
      const resposta = await api(servidor.porta, "POST", "/api/projetos", { corpo });
      expect(resposta.status, `corpo ${JSON.stringify(corpo)}`).toBe(400);
      expect(codigoDeErro(resposta)).toBe("brief-invalido");
      const detalhes = (resposta.json() as { erro: { detalhes?: string[] } }).erro.detalhes;
      expect(detalhes!.length, `detalhes para ${JSON.stringify(corpo)}`).toBeGreaterThan(0);
    }
  });

  it("PATCH brief: invalido -> 400; valido -> 200 e persiste; sem projeto -> 404", async () => {
    const id = (await criarProjeto(servidor.porta, "Patch brief")).id;
    const invalido = await api(servidor.porta, "PATCH", `/api/projetos/${id}`, {
      corpo: { brief: { tema: "" } },
    });
    expect(invalido.status).toBe(400);
    const valido = await api(servidor.porta, "PATCH", `/api/projetos/${id}`, {
      corpo: { brief: { tema: "Novo tema", contexto: "novo contexto" } },
    });
    expect(valido.status).toBe(200);
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { brief: { tema: string } };
    };
    expect(projeto.projeto.brief.tema).toBe("Novo tema");
    const semProjeto = await api(servidor.porta, "PATCH", `/api/projetos/proj-99999999`, {
      corpo: { brief: { tema: "x" } },
    });
    expect(semProjeto.status).toBe(404);
  });

  it("gerar com brief invalido no corpo -> 400; duracao_alvo_segundos invalido -> 400", async () => {
    const id = (await criarProjeto(servidor.porta, "Gerar payloads")).id;
    const briefInvalido = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
      corpo: { brief: { tema: "" } },
    });
    expect(briefInvalido.status).toBe(400);
    expect(codigoDeErro(briefInvalido)).toBe("brief-invalido");
    for (const duracao of [0, -1, "trinta", null]) {
      const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
        corpo: { duracao_alvo_segundos: duracao },
      });
      expect(resposta.status, `duracao ${String(duracao)}`).toBe(400);
      expect(codigoDeErro(resposta)).toBe("corpo-invalido");
    }
  });

  it("a selecao do gerar (brief/duracao) PERSISTE no projeto (regeneracoes usam a mesma selecao)", async () => {
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    const id = (await criarProjeto(servidor.porta, "Selecao persistida", 5)).id;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
      corpo: { duracao_alvo_segundos: 9 },
    });
    expect(resposta.status).toBe(202);
    await pollJob(servidor.porta, (resposta.json() as { job_id: string }).job_id, 30_000);
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { brief: { duracao_alvo_segundos: number } };
    };
    expect(projeto.projeto.brief.duracao_alvo_segundos).toBe(9);
  });

  it("regenerar: sem roteiro -> 409; pedaco inexistente -> 404; sem projeto -> 404", async () => {
    const semRoteiro = (await criarProjeto(servidor.porta, "Regen sem roteiro")).id;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${semRoteiro}/pedacos/p-001/regenerar`);
    expect(resposta.status).toBe(409);
    expect(codigoDeErro(resposta)).toBe("roteiro-nao-gerado");
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    const comRoteiro = (await criarProjeto(servidor.porta, "Regen pedaco")).id;
    await gerarRoteiro(servidor.porta, comRoteiro, 6);
    const inexistente = await api(servidor.porta, "POST", `/api/projetos/${comRoteiro}/pedacos/p-999/regenerar`);
    expect(inexistente.status).toBe(404);
    expect(codigoDeErro(inexistente)).toBe("pedaco-nao-encontrado");
    const semProjeto = await api(servidor.porta, "POST", `/api/projetos/proj-99999999/pedacos/p-001/regenerar`);
    expect(semProjeto.status).toBe(404);
  });

  it("editarPedaco: sem roteiro e pedaco inexistente -> 404; delta invalido -> 400 edicao-invalida", async () => {
    const semRoteiro = (await criarProjeto(servidor.porta, "Edit sem roteiro")).id;
    const semRoteiroResposta = await api(servidor.porta, "PATCH", `/api/projetos/${semRoteiro}/pedacos/p-001`, {
      corpo: { fala: "x" },
    });
    expect(semRoteiroResposta.status).toBe(404);
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    const comRoteiro = (await criarProjeto(servidor.porta, "Edit pedaco")).id;
    await gerarRoteiro(servidor.porta, comRoteiro, 6);
    const inexistente = await api(servidor.porta, "PATCH", `/api/projetos/${comRoteiro}/pedacos/p-999`, {
      corpo: { fala: "x" },
    });
    expect(inexistente.status).toBe(404);
    const deltaInvalido = await api(servidor.porta, "PATCH", `/api/projetos/${comRoteiro}/pedacos/p-001`, {
      corpo: { fala: 123 },
    });
    expect(deltaInvalido.status).toBe(400);
    expect(codigoDeErro(deltaInvalido)).toBe("edicao-invalida");
    const comDetalhes = (deltaInvalido.json() as { erro: { detalhes?: string[] } }).erro.detalhes;
    expect(comDetalhes!.length).toBeGreaterThan(0);
  });

  it("corpo nao-JSON nas rotas de corpo -> 400 corpo-invalido (regenerar consome o corpo em silencio)", async () => {
    const id = (await criarProjeto(servidor.porta, "Corpo invalido")).id;
    const resposta = await api(servidor.porta, "POST", "/api/projetos", {
      corpo: Buffer.from("{quebrado", "utf-8"),
      cabecalhos: { "Content-Type": "application/json" },
    });
    expect(resposta.status).toBe(400);
    expect(codigoDeErro(resposta)).toBe("corpo-invalido");
  });

  it("corpo acima do teto JSON (5 MB) -> 413 payload-grande-demais, nunca 500", async () => {
    const id = (await criarProjeto(servidor.porta, "Teto json")).id;
    const gigante = Buffer.alloc(5 * 1024 * 1024 + 1, 0x61);
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/roteiro/gerar`, {
      corpo: gigante,
      cabecalhos: { "Content-Type": "application/json" },
    });
    expect(resposta.status).toBe(413);
    expect(codigoDeErro(resposta)).toBe("payload-grande-demais");
  });

  it("juntar com roteiro do disco invalido (indices quebrados) -> 409 juntar-roteiro-invalido", async () => {
    const id = (await criarProjeto(servidor.porta, "Roteiro invalido")).id;
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    await gerarRoteiro(servidor.porta, id, 6);
    // Narrar para passar o gate de narracao; depois quebrar os indices
    // DIRETO no disco (o load sinaliza, nunca recusa — FQ-S1/REPLAN).
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    for (const pedaco of projeto.projeto.roteiro.pedacos.filter((p) => p.fala !== "")) {
      await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/${pedaco.id}/narracao/audio`, {
        corpo: FIXTURE_GRAVACAO,
        cabecalhos: { "Content-Type": "audio/webm" },
      });
    }
    const caminhoDoProjeto = join(servidor.app.raizDados, "projetos", id, "projeto.json");
    const bruto = JSON.parse(readFileSync(caminhoDoProjeto, "utf-8")) as {
      roteiro: { pedacos: Array<{ indice: number }> };
    };
    bruto.roteiro.pedacos[1]!.indice = 5;
    writeFileSync(caminhoDoProjeto, JSON.stringify(bruto), "utf-8");
    // O GET segue 200 (load nunca recusa — o transitorio e sinalizado).
    const projetoApos = await api(servidor.porta, "GET", `/api/projetos/${id}`);
    expect(projetoApos.status).toBe(200);
    const juntar = await api(servidor.porta, "POST", `/api/projetos/${id}/juntar`);
    expect(juntar.status).toBe(409);
    expect(codigoDeErro(juntar)).toBe("juntar-roteiro-invalido");
    const detalhes = (juntar.json() as { erro: { detalhes?: string[] } }).erro.detalhes;
    expect(detalhes!.some((d) => d.includes("indices-nao-contiguos"))).toBe(true);
  });

  it("projeto corrompido no disco -> 500 projeto-corrompido honesto (FQ-S1), nunca 200", async () => {
    const raizDados = mkdtempSync(join(tmpdir(), "dados-corrompido-"));
    mkdirSync(join(raizDados, "projetos", "proj-01234567"), { recursive: true });
    writeFileSync(join(raizDados, "projetos", "proj-01234567", "projeto.json"), "lixo", "utf-8");
    const servidorCorrompido = await subirEmProcesso({ raizDados, raizEstatica });
    try {
      const resposta = await api(servidorCorrompido.porta, "GET", "/api/projetos/proj-01234567");
      expect(resposta.status).toBe(500);
      expect(codigoDeErro(resposta)).toBe("projeto-corrompido");
      const lista = await api(servidorCorrompido.porta, "GET", "/api/projetos");
      expect(lista.status).toBe(500);
      expect(codigoDeErro(lista)).toBe("projeto-corrompido");
    } finally {
      await servidorCorrompido.parar();
      rmSync(raizDados, { recursive: true, force: true });
    }
  });

  it("diretorio de projetos inexistente -> 200 com lista vazia (sem lanco)", async () => {
    const raizDados = mkdtempSync(join(tmpdir(), "dados-vazios-"));
    const servidorVazio = await subirEmProcesso({ raizDados, raizEstatica });
    try {
      const resposta = await api(servidorVazio.porta, "GET", "/api/projetos");
      expect(resposta.status).toBe(200);
      expect((resposta.json() as { projetos: unknown[] }).projetos).toEqual([]);
    } finally {
      await servidorVazio.parar();
      rmSync(raizDados, { recursive: true, force: true });
    }
  });

  it("diretorio de projeto sem projeto.json -> a lista o pula (nunca derruba o GET)", async () => {
    const raizDados = mkdtempSync(join(tmpdir(), "dados-lista-"));
    const servidorLista = await subirEmProcesso({ raizDados, raizEstatica });
    try {
      mkdirSync(join(raizDados, "projetos", "proj-01234567"), { recursive: true });
      const resposta = await api(servidorLista.porta, "GET", "/api/projetos");
      expect(resposta.status).toBe(200);
      expect((resposta.json() as { projetos: unknown[] }).projetos).toEqual([]);
      // O GET direto do projeto sem projeto.json e 404 (nao 500).
      const direto = await api(servidorLista.porta, "GET", "/api/projetos/proj-01234567");
      expect(direto.status).toBe(404);
    } finally {
      await servidorLista.parar();
      rmSync(raizDados, { recursive: true, force: true });
    }
  });

  it("falha imprevista (raiz de dados nao gravavel) -> 500 erro-interno honesto (nunca 200)", async () => {
    // raizDados e um ARQUIVO: salvarProjeto lanca um erro NAO-ErroHttp e
    // o catch-all do criarServidor o converte no envelope 500 honesto.
    const raizDados = join(raizComum, "dados-arquivo");
    writeFileSync(raizDados, "sou um arquivo, nao um diretorio", "utf-8");
    const servidorEstourado = await subirEmProcesso({ raizDados, raizEstatica });
    try {
      const resposta = await api(servidorEstourado.porta, "POST", "/api/projetos", {
        corpo: { brief: { tema: "Vai falhar" } },
      });
      expect(resposta.status).toBe(500);
      expect(codigoDeErro(resposta)).toBe("erro-interno");
      expect(resposta.texto()).toContain("erro interno");
    } finally {
      await servidorEstourado.parar();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 3 — narracao e anexo: Content-Type errado, vazio, 413, 500s, nome
// ═════════════════════════════════════════════════════════════════════════════
describe("narracao e anexo — uploads com payloads errados e 500s honestos", () => {
  const raizFalsa = criarRaizFalsa();
  const raizDados = join(raizComum, "dados-uploads");
  let servidor: ServidorEmProcesso;
  let id: string;

  beforeAll(async () => {
    servidor = await subirEmProcesso({
      raizDoProjeto: raizFalsa,
      raizDados,
      raizEstatica,
    });
    process.env.CENARIO_CLI = "sucesso";
    process.env.CLI_SAIDA = ROTEIRO_FIXTURE;
    id = (await criarProjeto(servidor.porta, "Uploads", 6)).id;
    await gerarRoteiro(servidor.porta, id, 6);
  }, 60_000);

  afterAll(async () => {
    await servidor.parar();
    rmSync(raizFalsa, { recursive: true, force: true });
  });

  afterEach(() => {
    delete process.env.CENARIO_CLI;
    delete process.env.CLI_SAIDA;
  });

  it("PUT narracao com bytes que nao decodificam -> 400 conversao-audio (FQ-C1: nunca aceita em silencio)", async () => {
    // A conversao SNIFA os bytes (o ffmpeg decodifica pelo conteudo, nao
    // pelo Content-Type declarado — o contrato nao define regra nomeada
    // de tipo para a narracao, ao contrario da allowlist do anexo).
    // Bytes que nenhum decodificador entende caem no 400 honesto.
    const resposta = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-001/narracao/audio`, {
      corpo: Buffer.from("isto nao e audio em formato nenhum", "utf-8"),
      cabecalhos: { "Content-Type": "audio/webm" },
    });
    expect(resposta.status).toBe(400);
    expect(codigoDeErro(resposta)).toBe("conversao-audio");
  });

  it("PUT narracao com corpo vazio -> 400 gravacao-vazia", async () => {
    const resposta = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-001/narracao/audio`, {
      corpo: new Uint8Array(0),
      cabecalhos: { "Content-Type": "audio/webm" },
    });
    expect(resposta.status).toBe(400);
    expect(codigoDeErro(resposta)).toBe("gravacao-vazia");
  });

  it("PUT narracao em pedaco inexistente -> 409 pedaco-nao-encontrado (o 409 desta rota)", async () => {
    const resposta = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-999/narracao/audio`, {
      corpo: FIXTURE_GRAVACAO,
      cabecalhos: { "Content-Type": "audio/webm" },
    });
    expect(resposta.status).toBe(409);
    expect(codigoDeErro(resposta)).toBe("pedaco-nao-encontrado");
  });

  it("PUT narracao acima do teto HTTP (100 MB) -> 413 payload-grande-demais", async () => {
    const gigante = Buffer.alloc(100 * 1024 * 1024 + 1, 0x00);
    const resposta = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-001/narracao/audio`, {
      corpo: gigante,
      cabecalhos: { "Content-Type": "audio/webm" },
    });
    expect(resposta.status).toBe(413);
    expect(codigoDeErro(resposta)).toBe("payload-grande-demais");
  }, 60_000);

  it("PUT anexo com charset no Content-Type passa a allowlist (split(';') + trim)", async () => {
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF\x21\xF9\x04\x01\x00\x00\x00\x00\x2C\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3B", "binary");
    const resposta = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo?nome=x.gif`, {
      corpo: gif,
      cabecalhos: { "Content-Type": "image/gif; charset=binary" },
    });
    expect(resposta.status, resposta.texto()).toBe(201);
    const anexo = resposta.json() as { tipo: string; tamanho: number; nome_original: string };
    expect(anexo.tipo).toBe("image/gif");
    expect(anexo.nome_original).toBe("x.gif");
  });

  it("PUT anexo vazio -> 400 anexo-vazio; tipo invalido -> 400 anexo-tipo-permitido (nao le o corpo)", async () => {
    const vazio = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo`, {
      corpo: new Uint8Array(0),
      cabecalhos: { "Content-Type": "image/gif" },
    });
    expect(vazio.status).toBe(400);
    expect(codigoDeErro(vazio)).toBe("anexo-vazio");
    const tipoInvalido = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo`, {
      corpo: Buffer.from("GIF89a"),
      cabecalhos: { "Content-Type": "image/png" },
    });
    expect(tipoInvalido.status).toBe(400);
    expect(codigoDeErro(tipoInvalido)).toBe("anexo-tipo-permitido");
  });

  it("nome do anexo: ?nome= decodifica percent; X-Nome-Original cai; default \"anexo\"", async () => {
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF\x21\xF9\x04\x01\x00\x00\x00\x00\x2C\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3B", "binary");
    const decodificado = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo?nome=r%C3%A9action%20gif.gif`, {
      corpo: gif,
      cabecalhos: { "Content-Type": "image/gif" },
    });
    expect(decodificado.status).toBe(201);
    expect((decodificado.json() as { nome_original: string }).nome_original).toBe("réaction gif.gif");
    const viaCabecalho = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo`, {
      corpo: gif,
      cabecalhos: { "Content-Type": "image/gif", "X-Nome-Original": "pelo-header.gif" },
    });
    expect((viaCabecalho.json() as { nome_original: string }).nome_original).toBe("pelo-header.gif");
    const semNome = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo`, {
      corpo: gif,
      cabecalhos: { "Content-Type": "image/gif" },
    });
    expect((semNome.json() as { nome_original: string }).nome_original).toBe("anexo");
  });

  it("PUT anexo em projeto sem roteiro -> 404 pedaco-nao-encontrado", async () => {
    const semRoteiro = (await criarProjeto(servidor.porta, "Anexo sem roteiro")).id;
    const resposta = await api(servidor.porta, "PUT", `/api/projetos/${semRoteiro}/pedacos/p-001/anexo`, {
      corpo: Buffer.from("GIF89a"),
      cabecalhos: { "Content-Type": "image/gif" },
    });
    expect(resposta.status).toBe(404);
    expect(codigoDeErro(resposta)).toBe("pedaco-nao-encontrado");
  });

  it("DELETE anexo nao apaga os bytes do store (append-only, S-8)", async () => {
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF\x21\xF9\x04\x01\x00\x00\x00\x00\x2C\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3B", "binary");
    const upload = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo`, {
      corpo: gif,
      cabecalhos: { "Content-Type": "image/gif" },
    });
    const hash = (upload.json() as { hash: string }).hash;
    const caminhoDoByte = join(servidor.app.store.root, hash.slice(0, 2), hash);
    expect(existsSync(caminhoDoByte)).toBe(true);
    const resposta = await api(servidor.porta, "DELETE", `/api/projetos/${id}/pedacos/p-002/anexo`);
    expect(resposta.status).toBe(204);
    // Sonda do grupo: o DELETE remove SO o par do pedaco — o byte fica.
    expect(existsSync(caminhoDoByte)).toBe(true);
    const depois = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/p-002/anexo`);
    expect(depois.status).toBe(404);
    expect(codigoDeErro(depois)).toBe("anexo-inexistente");
  });

  it("bytes do anexo sumidos do store -> GET 500 anexo-corrompido honesto (nunca 200 vazio)", async () => {
    const gif = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF\x21\xF9\x04\x01\x00\x00\x00\x00\x2C\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3B", "binary");
    await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/p-002/anexo`, {
      corpo: gif,
      cabecalhos: { "Content-Type": "image/gif" },
    });
    rmSync(servidor.app.store.root, { recursive: true, force: true });
    const resposta = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/p-002/anexo`);
    expect(resposta.status).toBe(500);
    expect(codigoDeErro(resposta)).toBe("anexo-corrompido");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 4 — o fluxo feliz REAL (sosia + renders + juntar) e a persistencia
// ═════════════════════════════════════════════════════════════════════════════
describe("fluxo feliz real em processo: edicao, narracao, preview, juntar, restart, poda", () => {
  const raizDados = join(raizComum, "dados-feliz-real");
  let servidor: ServidorEmProcesso;
  let id: string;
  let pedacos: Array<{ id: string; fala: string }>;
  let musicaWav: string;

  beforeAll(async () => {
    servidor = await subirEmProcesso({
      raizDados,
      raizEstatica,
      provedorPadrao: "sosia",
    });
    // A trilha manual do juntar (wav de 1 s — via ffmpeg real).
    musicaWav = join(raizComum, "trilha.wav");
    execFileSync("ffmpeg", ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", "1", "-c:a", "pcm_s16le", musicaWav]);
    id = (await criarProjeto(servidor.porta, "Fluxo feliz real", 6)).id;
    await gerarRoteiro(servidor.porta, id, 6);
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    pedacos = projeto.projeto.roteiro.pedacos;
  }, 120_000);

  afterAll(async () => {
    await servidor.parar();
  });

  it("edicao mergeada: dois PATCHes acumulam o delta e o GET serve os dois aplicados", async () => {
    const alvo = pedacos[1]!;
    const primeiro = await api(servidor.porta, "PATCH", `/api/projetos/${id}/pedacos/${alvo.id}`, {
      corpo: { fala: "Fala editada pelo usuario" },
    });
    expect(primeiro.status).toBe(200);
    const segundo = await api(servidor.porta, "PATCH", `/api/projetos/${id}/pedacos/${alvo.id}`, {
      corpo: { duracao_segundos: 5 },
    });
    expect(segundo.status).toBe(200);
    const servido = segundo.json() as { fala: string; duracao_segundos: number };
    expect(servido.fala).toBe("Fala editada pelo usuario");
    expect(servido.duracao_segundos).toBe(5);
  });

  it("regenerar: edicao dobrada e limpa, irmaos intactos (FQ-G2/G3)", async () => {
    const alvo = pedacos[1]!;
    const antes = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    const falaDoIrmao = antes.projeto.roteiro.pedacos.find((p) => p.id === pedacos[0]!.id)!.fala;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/${alvo.id}/regenerar`);
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 60_000);
    expect(final.estado).toBe("ok");
    const depois = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: {
        roteiro: { pedacos: Array<{ id: string; fala: string }> };
        pedacos_editados: Record<string, unknown>;
      };
    };
    expect(depois.projeto.pedacos_editados[alvo.id]).toBeUndefined();
    expect(depois.projeto.roteiro.pedacos.find((p) => p.id === alvo.id)!.fala).not.toBe("Fala editada pelo usuario");
    expect(depois.projeto.roteiro.pedacos.find((p) => p.id === pedacos[0]!.id)!.fala).toBe(falaDoIrmao);
  });

  it("narracao: PUT wav -> 201; GET wav real (RIFF); DELETE -> 204 e volta a vazio; DELETE de novo -> 404", async () => {
    // A fala ATUAL do servidor (o regenerar acima trocou o p-001 — o
    // texto narrado e a fala SERVIDA, D4).
    const atual = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    const alvo = atual.projeto.roteiro.pedacos.find((p) => p.fala !== "")!;
    const narrado = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/${alvo.id}/narracao/audio?nome=voz.webm`, {
      corpo: FIXTURE_GRAVACAO,
      cabecalhos: { "Content-Type": "audio/webm" },
    });
    expect(narrado.status).toBe(201);
    const narracao = narrado.json() as { texto: string; origem: string; hash_audio: string; status: string };
    expect(narracao.texto).toBe(alvo.fala);
    expect(narracao.origem).toBe("gravacao");
    expect(narracao.status).toBe("gerado");
    const audio = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/${alvo.id}/narracao/audio`);
    expect(audio.status).toBe(200);
    expect(audio.cabecalhos.get("content-type")).toBe("audio/wav");
    const bytes = Buffer.from(audio.corpo);
    expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
    const removido = await api(servidor.porta, "DELETE", `/api/projetos/${id}/pedacos/${alvo.id}/narracao`);
    expect(removido.status).toBe(204);
    const semAudio = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/${alvo.id}/narracao/audio`);
    expect(semAudio.status).toBe(404);
    expect(codigoDeErro(semAudio)).toBe("narracao-nao-gravada");
    const segundaVez = await api(servidor.porta, "DELETE", `/api/projetos/${id}/pedacos/${alvo.id}/narracao`);
    expect(segundaVez.status).toBe(404);
  });

  it("preview de CADA pedaco (render real) -> mp4 200 + Range 206 parcial/sufixo + 416", async () => {
    // record-first: o preview carrega o audio da narracao — o teste de
    // narracao acima terminou com DELETE, entao narra TUDO antes de
    // renderizar (o juntar recusa gravacao silenciosa no preview).
    const comFala = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    for (const pedaco of comFala.projeto.roteiro.pedacos.filter((p) => p.fala !== "")) {
      const narrado = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/${pedaco.id}/narracao/audio`, {
        corpo: FIXTURE_GRAVACAO,
        cabecalhos: { "Content-Type": "audio/webm" },
      });
      expect(narrado.status).toBe(201);
    }
    for (const pedaco of pedacos) {
      const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/${pedaco.id}/preview`);
      expect(resposta.status).toBe(202);
      const { job_id } = resposta.json() as { job_id: string };
      const final = await pollJob(servidor.porta, job_id, 300_000);
      expect(final.estado, `preview ${pedaco.id}: ${final.erro ?? ""}`).toBe("ok");
      expect(final.artefato?.caminho).toBe(`/api/projetos/${id}/pedacos/${pedaco.id}/preview.mp4`);
    }
    const mp4 = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/${pedacos[0]!.id}/preview.mp4`);
    expect(mp4.status).toBe(200);
    expect(mp4.cabecalhos.get("content-type")).toBe("video/mp4");
    expect(Buffer.from(mp4.corpo).length).toBeGreaterThan(10_000);
    // Range parcial (o <video> da SPA precisa de seek).
    const parcial = await fetch(`http://127.0.0.1:${servidor.porta}/api/projetos/${id}/pedacos/${pedacos[0]!.id}/preview.mp4`, {
      headers: { Range: "bytes=100-199" },
    });
    expect(parcial.status).toBe(206);
    expect((await parcial.arrayBuffer()).byteLength).toBe(100);
    expect(parcial.headers.get("content-range")).toMatch(/^bytes 100-199\//);
    // Range sufixo (bytes=-N).
    const sufixo = await fetch(`http://127.0.0.1:${servidor.porta}/api/projetos/${id}/pedacos/${pedacos[0]!.id}/preview.mp4`, {
      headers: { Range: "bytes=-50" },
    });
    expect(sufixo.status).toBe(206);
    expect((await sufixo.arrayBuffer()).byteLength).toBe(50);
    // Faixas invalidas -> 416 com Content-Range */size (nunca 200 com corpo errado).
    for (const range of ["bytes=999999999-", "bytes=50-10", "bytes=abc", "bytes=0-1,3-4", "bytes=-", "bytes=-0"]) {
      const invalida = await fetch(`http://127.0.0.1:${servidor.porta}/api/projetos/${id}/pedacos/${pedacos[0]!.id}/preview.mp4`, {
        headers: { Range: range },
      });
      expect(invalida.status, `range "${range}"`).toBe(416);
      expect(invalida.headers.get("content-range")).toMatch(/^bytes \*\//);
    }
  }, 600_000);

  it("juntar com musica: 400s do caminho; job ok -> video-final com video+audio (ffprobe)", async () => {
    // Re-narra todos os pedacos com fala (defensivo — o teste de
    // narracao acima terminou com DELETE; o gate e record-first).
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string; fala: string }> } };
    };
    for (const pedaco of projeto.projeto.roteiro.pedacos.filter((p) => p.fala !== "")) {
      const narrado = await api(servidor.porta, "PUT", `/api/projetos/${id}/pedacos/${pedaco.id}/narracao/audio`, {
        corpo: FIXTURE_GRAVACAO,
        cabecalhos: { "Content-Type": "audio/webm" },
      });
      expect(narrado.status).toBe(201);
    }
    for (const musica of ["", 123, "https://exemplo.com/x.wav", join(raizComum, "nao-existe.wav")]) {
      const invalida = await api(servidor.porta, "POST", `/api/projetos/${id}/juntar`, {
        corpo: { musica_caminho: musica },
      });
      expect(invalida.status, `musica ${String(musica)}`).toBe(400);
      expect(codigoDeErro(invalida)).toBe("corpo-invalido");
    }
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/juntar`, {
      corpo: { musica_caminho: musicaWav },
    });
    expect(resposta.status).toBe(202);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 300_000);
    expect(final.estado, final.erro ?? "").toBe("ok");
    expect(final.artefato?.caminho).toBe(`/api/projetos/${id}/video-final.mp4`);
    const video = await api(servidor.porta, "GET", `/api/projetos/${id}/video-final.mp4`);
    expect(video.status).toBe(200);
    const bytes = Buffer.from(video.corpo);
    expect(bytes.length).toBeGreaterThan(10_000);
    const streams = ffprobeStreams(bytes);
    expect(streams.some((s) => s.codec_type === "video")).toBe(true);
    expect(streams.some((s) => s.codec_type === "audio")).toBe(true);
  }, 600_000);

  it("indice de preview com caminho apontando para o vazio -> 500 erro-interno honesto", async () => {
    // A conferencia (conteudo por hash) passa — o mp4 real existe no
    // previewsRaiz — mas o caminho do INDICE foi para o nada: servir o
    // arquivo falha e o erro e honesto, nunca 200 com corpo errado.
    const alvo = pedacos[2]!;
    const caminhoDoIndice = join(raizDados, "projetos", id, "previews.json");
    const previews = JSON.parse(readFileSync(caminhoDoIndice, "utf-8")) as Record<
      string,
      { caminho: string }
    >;
    previews[alvo.id] = { ...previews[alvo.id]!, caminho: join(raizComum, "sumiu.mp4") };
    writeFileSync(caminhoDoIndice, JSON.stringify(previews), "utf-8");
    const resposta = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/${alvo.id}/preview.mp4`);
    expect(resposta.status).toBe(500);
    expect(codigoDeErro(resposta)).toBe("erro-interno");
  }, 60_000);

  it("FQ-G2: gerar com a MESMA selecao preserva previews byte a byte iguais; outra selecao poda", async () => {
    // Projeto ISOLADO: o p-001 do projeto do grupo foi regenerado (fala
    // diferente da geracao fresca) — o cache e POR CONTEUDO e a poda
    // correta remove o preview de pedaco diferente, entao o teste de
    // preservacao nao pode herdar um pedaco regenerado.
    const id2 = (await criarProjeto(servidor.porta, "FQ-G2 isolado", 6)).id;
    await gerarRoteiro(servidor.porta, id2, 6);
    const projeto2 = (await api(servidor.porta, "GET", `/api/projetos/${id2}`)).json() as {
      projeto: { roteiro: { pedacos: Array<{ id: string }> } };
    };
    const alvo2 = projeto2.projeto.roteiro.pedacos[0]!;
    const pedidoDePreview = await api(servidor.porta, "POST", `/api/projetos/${id2}/pedacos/${alvo2.id}/preview`);
    const { job_id } = pedidoDePreview.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 300_000);
    expect(final.estado).toBe("ok");
    const antes = readFileSync(join(raizDados, "projetos", id2, "previews.json"), "utf-8");
    // MESMA selecao: roteiro byte a byte identico -> o preview sobrevive.
    await gerarRoteiro(servidor.porta, id2, 6);
    const depois = readFileSync(join(raizDados, "projetos", id2, "previews.json"), "utf-8");
    expect(JSON.parse(depois)).toEqual(JSON.parse(antes));
    expect(Object.keys(JSON.parse(depois) as Record<string, unknown>)).toContain(alvo2.id);
    // OUTRA selecao: os pedacos mudam -> os previews sao podados.
    await gerarRoteiro(servidor.porta, id2, 30);
    const podado = JSON.parse(
      readFileSync(join(raizDados, "projetos", id2, "previews.json"), "utf-8"),
    ) as Record<string, unknown>;
    expect(Object.keys(podado)).toEqual([]);
  }, 600_000);

  it("restart do servidor: roteiro, edicoes, narracao e indices de preview/entrega persistem (FQ-S2)", async () => {
    await servidor.parar();
    servidor = await subirEmProcesso({ raizDados, raizEstatica, provedorPadrao: "sosia" });
    const projeto = (await api(servidor.porta, "GET", `/api/projetos/${id}`)).json() as {
      projeto: { roteiro: { pedacos: unknown[] }; pedacos_editados: Record<string, unknown> };
      jobs: { gerar_roteiro: unknown; juntar: unknown };
    };
    expect(projeto.projeto.roteiro.pedacos.length).toBeGreaterThan(0);
    expect(projeto.jobs.gerar_roteiro).not.toBeNull();
    expect(projeto.jobs.juntar).not.toBeNull();
    // O video-final (indice de entrega + bytes) sobrevive ao restart.
    const video = await api(servidor.porta, "GET", `/api/projetos/${id}/video-final.mp4`);
    expect(video.status).toBe(200);
    expect(Buffer.from(video.corpo).length).toBeGreaterThan(10_000);
    // A narracao gravada persiste.
    const comFala = pedacos.find((p) => p.fala !== "")!;
    const audio = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/${comFala.id}/narracao/audio`);
    expect(audio.status).toBe(200);
    expect(Buffer.from(audio.corpo).toString("ascii", 0, 4)).toBe("RIFF");
    // O indice de preview persiste: o GET revalida o conteudo (C1) e o
    // mp4 continua la (o registro sobreviveu e o byte tambem).
    const preview = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/${pedacos[0]!.id}/preview.mp4`);
    expect(preview.status).toBe(200);
  }, 120_000);

  it("preview corrompido (mp4 sumido) -> GET 500 preview-invalido honesto (C1/C4)", async () => {
    // Previews foram podados acima — renderiza UM pedaco de novo e
    // remove o byte: o GET revalida o conteudo e falha com 500, nunca
    // 200 com corpo errado.
    const alvo = pedacos[0]!;
    const resposta = await api(servidor.porta, "POST", `/api/projetos/${id}/pedacos/${alvo.id}/preview`);
    const { job_id } = resposta.json() as { job_id: string };
    const final = await pollJob(servidor.porta, job_id, 300_000);
    expect(final.estado).toBe("ok");
    const previews = JSON.parse(
      readFileSync(join(raizDados, "projetos", id, "previews.json"), "utf-8"),
    ) as Record<string, { hash: string }>;
    const hash = previews[alvo.id]!.hash;
    rmSync(join(servidor.app.raizPreviews, `${hash}.mp4`));
    const respostaDoMp4 = await api(servidor.porta, "GET", `/api/projetos/${id}/pedacos/${alvo.id}/preview.mp4`);
    expect(respostaDoMp4.status).toBe(500);
    expect(codigoDeErro(respostaDoMp4)).toBe("preview-invalido");
  }, 600_000);
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 5 — a SPA: MIMEs, traversal de assets, sem index, e Range no estatico
// ═════════════════════════════════════════════════════════════════════════════
describe("SPA estatica: MIMEs, traversal, sem index, 405, Range no arquivo", () => {
  let servidor: ServidorEmProcesso;

  beforeAll(async () => {
    servidor = await subirEmProcesso({
      raizDados: join(raizComum, "dados-spa"),
      raizEstatica,
    });
  });

  afterAll(async () => {
    await servidor.parar();
  });

  it("MIME por extensao nos assets (C6: tudo local)", async () => {
    writeFileSync(join(raizEstatica, "assets", "extra.gif"), Buffer.from("GIF89a"));
    writeFileSync(join(raizEstatica, "assets", "extra.webm"), Buffer.from("\x1A\x45\xDF\xA3"));
    writeFileSync(join(raizEstatica, "assets", "fonte.ttf"), Buffer.from("ttf"));
    writeFileSync(join(raizEstatica, "assets", "notas.txt"), "notas\n", "utf-8");
    writeFileSync(join(raizEstatica, "assets", "bundle.js.map"), "{}", "utf-8");
    writeFileSync(join(raizEstatica, "assets", "desconhecido.xyz"), "?", "utf-8");
    const casos: Array<[string, string]> = [
      ["/assets/app.js", "text/javascript"],
      ["/assets/estilo.css", "text/css"],
      ["/assets/dados.json", "application/json"],
      ["/assets/icone.svg", "image/svg+xml"],
      ["/assets/imagem.png", "image/png"],
      ["/assets/fonte.woff2", "font/woff2"],
      ["/assets/favicon.ico", "image/x-icon"],
      ["/assets/extra.gif", "image/gif"],
      ["/assets/extra.webm", "video/webm"],
      ["/assets/fonte.ttf", "font/ttf"],
      ["/assets/notas.txt", "text/plain"],
      ["/assets/bundle.js.map", "application/json"],
      ["/assets/desconhecido.xyz", "application/octet-stream"],
    ];
    for (const [caminho, tipo] of casos) {
      const resposta = await api(servidor.porta, "GET", caminho);
      expect(resposta.status, caminho).toBe(200);
      expect(resposta.cabecalhos.get("content-type"), caminho).toContain(tipo);
    }
  });

  it("asset inexistente -> 404; caminho de asset invalido (traversal, vazio) -> 404", async () => {
    const inexistente = await api(servidor.porta, "GET", "/assets/nao-existe.js");
    expect(inexistente.status).toBe(404);
    expect(codigoDeErro(inexistente)).toBe("rota-nao-encontrada");
    for (const caminho of [
      "/assets/",
      "/assets/..%2F..%2Fetc", // pontos LITERAIS no relativo -> bloqueado
      "/assets/..%5C..%5C",
      "/assets/%2e%2e%2Fsecret", // tudo codificado: vira segmento -> arquivo ausente -> 404
    ]) {
      const resposta = await api(servidor.porta, "GET", caminho);
      expect(resposta.status, caminho).toBe(404);
    }
  });

  it("o parser WHATWG normaliza /assets/%2e%2e/<x> para fora de /assets/ — o fallback da SPA serve o index (contrato)", async () => {
    // "%2e%2e" como SEGMENTO inteiro e um double-dot para o parser: o
    // pathname vira "/<x>" e cai no fallback do roteamento do cliente
    // (api.md §GET /) — nunca sai da raiz estatica.
    const resposta = await api(servidor.porta, "GET", "/assets/%2e%2e/qualquer");
    expect(resposta.status).toBe(200);
    expect(resposta.texto()).toContain("Editor de Video IA");
  });

  it("POST fora de /api/ -> 405 (a SPA so responde a GET)", async () => {
    const resposta = await api(servidor.porta, "POST", "/");
    expect(resposta.status).toBe(405);
    expect(codigoDeErro(resposta)).toBe("metodo-nao-permitido");
  });

  it("405 em processo no /api/: verbo errado na rota certa -> 405 com Allow (nunca 404/500)", async () => {
    const resposta = await api(servidor.porta, "PUT", "/api/projetos");
    expect(resposta.status).toBe(405);
    expect(codigoDeErro(resposta)).toBe("metodo-nao-permitido");
    expect(resposta.cabecalhos.get("allow")).toContain("POST");
    expect(resposta.cabecalhos.get("allow")).toContain("GET");
    const deletarLista = await api(servidor.porta, "DELETE", "/api/projetos");
    expect(deletarLista.status).toBe(405);
    expect(codigoDeErro(deletarLista)).toBe("metodo-nao-permitido");
  });

  it("Range no estatico: parcial 206, sufixo 206, invalido 416", async () => {
    const parcial = await fetch(`http://127.0.0.1:${servidor.porta}/assets/app.js`, {
      headers: { Range: "bytes=0-4" },
    });
    expect(parcial.status).toBe(206);
    expect((await parcial.arrayBuffer()).byteLength).toBe(5);
    const invalido = await fetch(`http://127.0.0.1:${servidor.porta}/assets/app.js`, {
      headers: { Range: "bytes=9999-" },
    });
    expect(invalido.status).toBe(416);
  });

  it("sem index.html (SPA nao construida) -> 404 honesto, nunca 500; asset idem", async () => {
    const raizSemSpa = mkdtempSync(join(tmpdir(), "sem-spa-"));
    const servidorSemSpa = await subirEmProcesso({
      raizDados: join(raizComum, "dados-sem-spa"),
      raizEstatica: raizSemSpa,
    });
    try {
      const index = await api(servidorSemSpa.porta, "GET", "/");
      expect(index.status).toBe(404);
      expect(codigoDeErro(index)).toBe("rota-nao-encontrada");
      expect(index.texto()).toContain("SPA ainda nao foi construida");
      const asset = await api(servidorSemSpa.porta, "GET", "/assets/app.js");
      expect(asset.status).toBe(404);
      expect(codigoDeErro(asset)).toBe("rota-nao-encontrada");
    } finally {
      await servidorSemSpa.parar();
      rmSync(raizSemSpa, { recursive: true, force: true });
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 6 — traversal nos params (a defesa em processo) e o startup
// ═════════════════════════════════════════════════════════════════════════════
describe("traversal em processo e startup (iniciarServidor, colisao de porta)", () => {
  let servidor: ServidorEmProcesso;

  beforeAll(async () => {
    servidor = await subirEmProcesso({
      raizDados: join(raizComum, "dados-traversal-proc"),
      raizEstatica,
    });
  });

  afterAll(async () => {
    await servidor.parar();
  });

  it(":id e :jobId com %2F/%2e%2e -> 404 do recurso (nunca 200 nem conteudo)", async () => {
    for (const caminho of [
      "/api/projetos/..%2F..%2Ftarget",
      "/api/projetos/%2e%2e%2F..%2Ftarget",
      "/api/projetos/..%5C..%5Ctarget",
    ]) {
      const resposta = await api(servidor.porta, "GET", caminho);
      expect(resposta.status, caminho).toBe(404);
      expect(codigoDeErro(resposta)).toBe("projeto-nao-encontrado");
    }
    const job = await api(servidor.porta, "GET", "/api/jobs/..%2F..%2Falvo");
    expect(job.status).toBe(404);
    expect(codigoDeErro(job)).toBe("job-nao-encontrado");
  });

  it("GET /api/projetos/%zz -> 404 rota-nao-encontrada (percent invalido nunca vira 500)", async () => {
    const resposta = await api(servidor.porta, "GET", "/api/projetos/%zz");
    expect(resposta.status).toBe(404);
    expect(codigoDeErro(resposta)).toBe("rota-nao-encontrada");
  });

  it("iniciarServidor imprime o banner e devolve a porta real (ffmpeg pin no startup)", async () => {
    const banners: string[] = [];
    const { servidor: iniciado, porta } = await iniciarServidor({
      raizDados: join(raizComum, "dados-startup"),
      raizEstatica,
      logar: (m) => banners.push(m),
    });
    try {
      expect(porta).toBeGreaterThan(0);
      expect(banners.some((b) => /http:\/\/localhost:\d+/.test(b))).toBe(true);
      const resposta = await api(porta, "GET", "/api/projetos");
      expect(resposta.status).toBe(200);
    } finally {
      await new Promise<void>((resolve) => iniciado.close(() => resolve()));
    }
  });

  it("colisao de porta -> ErroPortaEmUso com a porta nomeada (FQ-S4, em processo)", async () => {
    const primeiro = await iniciarServidor({
      porta: 4789,
      raizDados: join(raizComum, "dados-porta-a"),
      raizEstatica,
      logar: () => {},
    });
    try {
      let erro: unknown = null;
      try {
        await iniciarServidor({
          porta: 4789,
          raizDados: join(raizComum, "dados-porta-b"),
          raizEstatica,
          logar: () => {},
        });
      } catch (e) {
        erro = e;
      }
      expect(erro).toBeInstanceOf(ErroPortaEmUso);
      expect((erro as ErroPortaEmUso).message).toContain("4789");
      expect((erro as ErroPortaEmUso).message).toContain("EADDRINUSE");
    } finally {
      await new Promise<void>((resolve) => primeiro.servidor.close(() => resolve()));
    }
  });
});
