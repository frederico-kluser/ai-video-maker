/**
 * tests/roteiro/gerador-cli-processo.test.ts
 *
 * O CLI do gerador (src/roteiro/gerador/cli.ts) exercitado EM PROCESSO,
 * chamando principal() com stdin/stdout/stderr FAKES — o complemento de
 * gerador-cli.test.ts, que spawna processo REAL (tsx) e, por isso, deixa
 * o modulo invisivel para a cobertura.
 *
 * O contrato e o mesmo (D11 — docs/roteiro/api.md §"CLIs de operacao
 * pesada"): stdin JSON, stdout so sucesso, erro sempre no stderr em
 * envelope { erro: { codigo, mensagem, detalhes } }, progresso em
 * arquivo de estado (--estado ou ROTEIRO_ESTADO_PATH), exit 0 | 1 | 2.
 *
 * Exit codes (sonda negativa por grupo — um CLI que "passasse" sem fazer
 * nada sai 0 e quebra o teste):
 *   0 = sucesso (stdout = artefato);
 *   2 = entrada/uso invalidos (JSON malformado, pedido invalido, flag
 *       desconhecida, --estado/--provedor/--raiz-cassetes sem valor,
 *       provedor desconhecido);
 *   1 = falha de GERACAO (cassete ausente, saida invalida do provedor,
 *       provedor falhou) — o estado terminal sai com progresso 1.
 *
 * O provedor e o sosia (zero rede, zero credencial — FQ-G5), exceto nos
 * casos que precisam de outro provedor: cassete (ausente e com saida
 * invalida) e llm-anthropic (o guarda de rede derruba o fetch -> o CLI
 * devolve provedor-falhou em vez de tocar a rede).
 */

import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { definirDiretorioCache } from "../../src/roteiro/gerador/cache.js";
import { principal } from "../../src/roteiro/gerador/cli.js";
import { montarPromptRoteiro } from "../../src/roteiro/gerador/prompt.js";
import { gravarCasseteRoteiro } from "../../src/roteiro/gerador/provedor.js";
import { validarPedaco, validarRoteiro } from "../../src/roteiro/contrato/validar.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ResultadoDoCli {
  codigo: number;
  stdout: string;
  stderr: string;
}

const PEDIDO_GERAR = {
  brief: {
    tema: "Como funciona um cache de computador",
    contexto: "Video para iniciantes",
  },
  duracao_alvo_segundos: 30,
  versao_contrato: "Roteiro.1",
  versao_contrato_gerador: "1.0.0",
  versao_gerador: "1.0.0",
};

function pedidoRegenerar(): Record<string, unknown> {
  return {
    brief: { tema: "Como funciona um cache de computador" },
    duracao_alvo_segundos: 30,
    pedaco_atual: {
      id: "p-001",
      indice: 1,
      titulo: "O que e um cache",
      fala: "Um cache guarda o resultado de uma conta para nao refaze-la.",
      duracao_segundos: 12.5,
      tipo_visual: "manim",
      especificacao_visual: "Animacao estilo 3b1b com shapes",
      detalhes_de_producao: "Cena Manim via estagio grafico",
      narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    },
    resumo_demais_pedacos: '[{"id":"p-000"},{"id":"p-002"}]',
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
  };
}

/** Um fluxo fake de stdin: emite o conteudo e fecha no proximo tick. */
function fakeStdin(conteudo: string): EventEmitter & { setEncoding: () => void } {
  const fluxo = new EventEmitter() as EventEmitter & { setEncoding: () => void };
  fluxo.setEncoding = () => {};
  queueMicrotask(() => {
    fluxo.emit("data", conteudo);
    fluxo.emit("end");
  });
  return fluxo;
}

const descritorStdinOriginal = Object.getOwnPropertyDescriptor(process, "stdin")!;
const argvOriginal = [...process.argv];

/** Roda principal() com stdin fake e stdout/stderr capturados. */
async function rodarPrincipal(
  entrada: string,
  flags: string[] = [],
): Promise<ResultadoDoCli> {
  return rodarPrincipalComFluxo(fakeStdin(entrada), flags);
}

/** Igual a rodarPrincipal, mas com um fluxo de stdin ARBITRARIO (ex.: que emite 'error'). */
async function rodarPrincipalComFluxo(
  fluxo: EventEmitter & { setEncoding: () => void },
  flags: string[] = [],
): Promise<ResultadoDoCli> {
  process.argv = ["node", "cli.ts", ...flags];
  Object.defineProperty(process, "stdin", {
    value: fluxo,
    configurable: true,
    writable: true,
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  const spyOut = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(((pedaco: string | Uint8Array) => {
      stdout.push(String(pedaco));
      return true;
    }) as never);
  const spyErr = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(((pedaco: string | Uint8Array) => {
      stderr.push(String(pedaco));
      return true;
    }) as never);
  try {
    const codigo = await principal();
    return { codigo, stdout: stdout.join(""), stderr: stderr.join("") };
  } finally {
    spyOut.mockRestore();
    spyErr.mockRestore();
  }
}

function novoEstado(): string {
  return join(mkdtempSync(join(tmpdir(), "roteiro-cli-estado-")), "estado.json");
}

function lerEstado(caminho: string): { estado: string; progresso: number; erro: string | null } {
  return JSON.parse(readFileSync(caminho, "utf-8")) as {
    estado: string;
    progresso: number;
    erro: string | null;
  };
}

beforeEach(() => {
  definirDiretorioCache(mkdtempSync(join(tmpdir(), "roteiro-cli-cache-processo-")));
  vi.stubEnv("ROTEIRO_PROVEDOR", "sosia");
});

afterEach(() => {
  Object.defineProperty(process, "stdin", descritorStdinOriginal);
  process.argv = argvOriginal;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── Sucesso (exit 0) ─────────────────────────────────────────────────────────

describe("CLI em processo — sucesso (exit 0, stdout SO o artefato)", () => {
  it("gerar roteiro: exit 0, stdout e o Roteiro VALIDO, stderr vazio e estado termina em 'ok' com progresso 1", async () => {
    const estadoPath = novoEstado();
    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--estado", estadoPath]);

    expect(resultado.codigo).toBe(0);
    expect(resultado.stderr).toBe("");
    const roteiro = JSON.parse(resultado.stdout) as { schema_version: string };
    expect(roteiro.schema_version).toBe("Roteiro.1");
    expect(validarRoteiro(roteiro).valido).toBe(true);

    const estado = lerEstado(estadoPath);
    expect(estado.estado).toBe("ok");
    expect(estado.progresso).toBe(1);
    expect(estado.erro).toBeNull();
  });

  it("regenerar pedaco: exit 0, stdout e UM Pedaco valido com id/indice preservados (FQ-G2)", async () => {
    const resultado = await rodarPrincipal(JSON.stringify(pedidoRegenerar()));
    expect(resultado.codigo).toBe(0);
    const pedaco = JSON.parse(resultado.stdout) as { id: string; indice: number };
    expect(pedaco.id).toBe("p-001");
    expect(pedaco.indice).toBe(1);
    expect(validarPedaco(pedaco).valido).toBe(true);
  });

  it("ROTEIRO_ESTADO_PATH via ENV (sem --estado): o estado e escrito la", async () => {
    const estadoPath = novoEstado();
    vi.stubEnv("ROTEIRO_ESTADO_PATH", estadoPath);
    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR));
    expect(resultado.codigo).toBe(0);
    expect(lerEstado(estadoPath).estado).toBe("ok");
  });

  it("--help: exit 0, o uso no stdout, nada no stderr", async () => {
    const resultado = await rodarPrincipal("", ["--help"]);
    expect(resultado.codigo).toBe(0);
    expect(resultado.stdout).toContain("CLI do gerador de roteiro");
    expect(resultado.stdout).toContain("--estado");
    expect(resultado.stderr).toBe("");
  });
});

// ─── Entrada/uso invalidos (exit 2) ───────────────────────────────────────────

describe("CLI em processo — entrada/uso invalidos (exit 2, envelope no stderr)", () => {
  it("stdin que nao e JSON -> exit 2, codigo entrada-invalida, stdout vazio e estado 'erro' com progresso 1", async () => {
    const estadoPath = novoEstado();
    const resultado = await rodarPrincipal("isto nao e JSON", ["--estado", estadoPath]);

    expect(resultado.codigo).toBe(2);
    expect(resultado.stdout).toBe(""); // a saida JSON e so sucesso
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string } };
    expect(envelope.erro.codigo).toBe("entrada-invalida");
    const estado = lerEstado(estadoPath);
    expect(estado.estado).toBe("erro");
    expect(estado.progresso).toBe(1);
  });

  it("falha ao LER o stdin (fluxo emite 'error') -> exit 2, codigo entrada-invalida com 'falha ao ler stdin'", async () => {
    const fluxo = new EventEmitter() as EventEmitter & { setEncoding: () => void };
    fluxo.setEncoding = () => {};
    queueMicrotask(() => fluxo.emit("error", new Error("stdin quebrado")));

    const resultado = await rodarPrincipalComFluxo(fluxo);
    expect(resultado.codigo).toBe(2);
    expect(resultado.stdout).toBe("");
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("entrada-invalida");
    expect(envelope.erro.mensagem).toContain("falha ao ler stdin");
  });

  it("stdin JSON valido mas que NAO e objeto (42, []) -> exit 2, codigo entrada-invalida", async () => {
    for (const naoObjeto of ["42", "[]"]) {
      const resultado = await rodarPrincipal(naoObjeto);
      expect(resultado.codigo).toBe(2);
      const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
      expect(envelope.erro.codigo).toBe("entrada-invalida");
      expect(envelope.erro.mensagem).toContain("objeto JSON");
    }
  });

  it("pedido INVALIDO (versao errada) -> exit 2, codigo pedido-invalido com as regras nos detalhes", async () => {
    const estadoPath = novoEstado();
    const invalido = { ...PEDIDO_GERAR, versao_contrato: "Roteiro.2" };
    const resultado = await rodarPrincipal(JSON.stringify(invalido), ["--estado", estadoPath]);

    expect(resultado.codigo).toBe(2);
    const envelope = JSON.parse(resultado.stderr) as {
      erro: { codigo: string; detalhes: string[] };
    };
    expect(envelope.erro.codigo).toBe("pedido-invalido");
    expect(envelope.erro.detalhes.join(" ")).toContain("versao-incompativel");
    expect(lerEstado(estadoPath).estado).toBe("erro");
  });

  it("pedido de REGENERACAO invalido (gif sem anexo) -> exit 2, codigo pedido-invalido", async () => {
    const invalido = pedidoRegenerar();
    (invalido.pedaco_atual as Record<string, unknown>).tipo_visual = "gif"; // sem anexo_hash/anexo_meta
    const resultado = await rodarPrincipal(JSON.stringify(invalido));
    expect(resultado.codigo).toBe(2);
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string } };
    expect(envelope.erro.codigo).toBe("pedido-invalido");
  });

  it("--estado SEM valor -> exit 2, codigo uso-invalido (nunca default silencioso)", async () => {
    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--estado"]);
    expect(resultado.codigo).toBe(2);
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("uso-invalido");
    expect(envelope.erro.mensagem).toContain("--estado exige um caminho");
  });

  it("--provedor SEM valor e --raiz-cassetes SEM valor -> exit 2, uso-invalido", async () => {
    const semProvedor = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--provedor"]);
    expect(semProvedor.codigo).toBe(2);
    expect(semProvedor.stderr).toContain("--provedor exige um nome");

    const semRaiz = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--raiz-cassetes"]);
    expect(semRaiz.codigo).toBe(2);
    expect(semRaiz.stderr).toContain("--raiz-cassetes exige um caminho");
  });

  it("--raiz-cassetes COM valor: a flag e aceita e o provedor cassete a usa (exit 0 com cassete gravado)", async () => {
    const raiz = mkdtempSync(join(tmpdir(), "roteiro-cli-raiz-cassetes-"));
    vi.stubEnv("ROTEIRO_PROVEDOR", "cassete");
    const prompt = montarPromptRoteiro(PEDIDO_GERAR);
    gravarCasseteRoteiro(raiz, prompt, {
      schema_version: "Roteiro.1",
      pedacos: [
        {
          id: "p-000",
          indice: 0,
          titulo: "Abertura",
          fala: "",
          duracao_segundos: 4,
          tipo_visual: "cabecalho",
          especificacao_visual: "Titulo",
          detalhes_de_producao: "Cabecalho",
          narracao: { texto: "", origem: "nenhuma", status: "vazio" },
        },
      ],
      duracao_total_segundos: 4,
    });

    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), [
      "--raiz-cassetes",
      raiz,
    ]);
    expect(resultado.codigo).toBe(0);
    const roteiro = JSON.parse(resultado.stdout) as { schema_version: string };
    expect(roteiro.schema_version).toBe("Roteiro.1");
  });

  it("flag desconhecida -> exit 2, uso-invalido", async () => {
    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--nao-existe"]);
    expect(resultado.codigo).toBe(2);
    expect(resultado.stderr).toContain("argumento desconhecido");
  });

  it("provedor DESCONHECIDO (--provedor nao-existe) -> exit 2, codigo configuracao-invalida", async () => {
    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), [
      "--provedor",
      "nao-existe",
    ]);
    expect(resultado.codigo).toBe(2);
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("configuracao-invalida");
    expect(envelope.erro.mensagem).toContain("desconhecido");
  });
});

// ─── Falha de geracao (exit 1) ────────────────────────────────────────────────

describe("CLI em processo — falha de GERACAO (exit 1; entrada valida, geracao falhou)", () => {
  it("cassete AUSENTE -> exit 1, codigo cassete-ausente com o caminho esperado, estado 'erro' progresso 1", async () => {
    const raizVazia = mkdtempSync(join(tmpdir(), "roteiro-cli-cassetes-vazios-"));
    vi.stubEnv("ROTEIRO_PROVEDOR", "cassete");
    vi.stubEnv("RAIZ_CASSETES", raizVazia);
    const estadoPath = novoEstado();

    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--estado", estadoPath]);
    expect(resultado.codigo).toBe(1);
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("cassete-ausente");
    expect(envelope.erro.mensagem).toContain("esperado:");
    expect(lerEstado(estadoPath).estado).toBe("erro");
    expect(lerEstado(estadoPath).progresso).toBe(1);
  });

  it("cassete com saida INVALIDA -> exit 1, codigo saida-invalida com as regras nos detalhes (o gate rejeita, nunca aceita)", async () => {
    const raiz = mkdtempSync(join(tmpdir(), "roteiro-cli-cassete-invalido-"));
    vi.stubEnv("ROTEIRO_PROVEDOR", "cassete");
    vi.stubEnv("RAIZ_CASSETES", raiz);
    // O cassete do prompt EXATO deste pedido, com um roteiro que nao valida.
    const prompt = montarPromptRoteiro(PEDIDO_GERAR);
    gravarCasseteRoteiro(raiz, prompt, {
      schema_version: "Roteiro.1",
      pedacos: [{ id: "p-000", indice: 0 }], // incompleto (faltam campos obrigatorios)
      duracao_total_segundos: 1,
    });

    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR));
    expect(resultado.codigo).toBe(1);
    const envelope = JSON.parse(resultado.stderr) as {
      erro: { codigo: string; detalhes: string[] };
    };
    expect(envelope.erro.codigo).toBe("saida-invalida");
    expect(envelope.erro.detalhes.length).toBeGreaterThan(0);
  });

  it("erro INESPERADO dentro da geracao (cache com diretorio invalido -> a escrita lanca) -> exit 1, codigo geracao-falhou (o catch generico nunca e silencio)", async () => {
    const base = mkdtempSync(join(tmpdir(), "roteiro-cli-cache-invalido-"));
    const arquivo = join(base, "arquivo");
    writeFileSync(arquivo, "x", "utf-8");
    definirDiretorioCache(join(arquivo, "roteiro")); // mkdirSync vai falhar (o pai e um arquivo)

    const estadoPath = novoEstado();
    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--estado", estadoPath]);
    expect(resultado.codigo).toBe(1);
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("geracao-falhou");
    expect(envelope.erro.mensagem.length).toBeGreaterThan(0);
    expect(lerEstado(estadoPath).estado).toBe("erro");
  });

  it("provedor LLM que FALHA (o guarda de rede derruba o fetch) -> exit 1, codigo provedor-falhou", async () => {
    // Sonda do guarda: o fetch de GLOBALthis esta bloqueado NESTE processo —
    // sem isso o teste poderia tocar a rede de verdade e o resultado
    // dependeria de credencial.
    await expect(globalThis.fetch("http://exemplo.invalido/")).rejects.toThrow(/REDE BLOQUEADA/);

    vi.stubEnv("ROTEIRO_PROVEDOR", "llm-anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", ""); // chave vazia: em qualquer mundo, falha
    const estadoPath = novoEstado();

    const resultado = await rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--estado", estadoPath]);
    expect(resultado.codigo).toBe(1);
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("provedor-falhou");
    expect(envelope.erro.mensagem).toContain("Provedor de roteiro falhou");
    expect(lerEstado(estadoPath).estado).toBe("erro");
  });
});

// ─── Estado path invalido ─────────────────────────────────────────────────────

describe("CLI em processo — --estado com caminho INVALIDO", () => {
  it("o caminho de estado cujo pai e um ARQUIVO: principal() rejeita — nunca retorna 0 em silencio (no processo real, o guard do modulo vira exit 1 com envelope erro-interno)", async () => {
    // Um arquivo no lugar do diretorio pai: mkdirSync(dirname) lanca ENOTDIR.
    const base = mkdtempSync(join(tmpdir(), "roteiro-cli-estado-invalido-"));
    const arquivoNoLugarDoPai = join(base, "arquivo");
    writeFileSync(arquivoNoLugarDoPai, "x", "utf-8");
    const estadoInvalido = join(arquivoNoLugarDoPai, "estado.json");

    await expect(
      rodarPrincipal(JSON.stringify(PEDIDO_GERAR), ["--estado", estadoInvalido]),
    ).rejects.toThrow(/not a directory|ENOTDIR|EEXIST/);
  });
});
