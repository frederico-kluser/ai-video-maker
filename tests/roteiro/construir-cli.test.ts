/**
 * tests/roteiro/construir-cli.test.ts
 *
 * O CLI D11 do construtor (cli.ts) em PROCESSO — complemento do teste por
 * subprocesso em construir.test.ts. O modulo executa `principal()` na
 * importacao quando `process.argv[1]` termina em "cli.ts"; o teste
 * manipula argv, simula o stdin (readFileSync(0) interceptado) e captura
 * stdout/exitCode — cobrindo o codigo inteiro do CLI:
 *
 *   - as tres formas de pedido (roteiro; roteiro+indice_pedaco;
 *     manifesto+indice_pedaco) e o stdout JSON so-em-sucesso;
 *   - pedidos malformados (stdin vazio, JSON invalido, pedido null,
 *     nenhum campo, roteiro E manifesto, manifesto sem indice);
 *   - opcoes invalidas (fps 0) com exit 1 e mensagem no stderr;
 *   - reducao com indice fora do limite (exit 1, stderr);
 *   - arquivo de estado: escrito por --estado E por ROTEIRO_ESTADO_PATH,
 *     "erro" quando a operacao falha; escrita best-effort (falha de
 *     estado nao muda o resultado — o stderr carrega o erro real);
 *   - manifesto invalido como ENTRADA e recusado antes de reduzir
 *     (fail-closed: nunca reduzido em silencio).
 *
 * Nenhuma rede e nenhum disco alem do arquivo de estado (C7).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validarManifestoConstruido } from "../../src/roteiro/construir/validar.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import type { Roteiro } from "../../src/roteiro/contrato/contrato.js";

const RAIZ = join(__dirname, "..", "..");
const FIXTURES = join(__dirname, "fixtures");
const CAMINHO_CLI = join(RAIZ, "src", "roteiro", "construir", "cli.ts");

/** Estado compartilhado com o mock de node:fs (stdin + falha de mkdir). */
const estadoFs = vi.hoisted(() => ({ stdin: "", falharMkdir: false }));

vi.mock("node:fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:fs")>();
  return {
    ...real,
    // readFileSync(0) = stdin do CLI; os demais caminhos passam ao disco
    // (o schema oficial e lido de verdade — validar.ts).
    readFileSync: ((caminho: unknown, ...args: unknown[]) => {
      if (caminho === 0) {
        return estadoFs.stdin;
      }
      return real.readFileSync(
        caminho as Parameters<typeof real.readFileSync>[0],
        ...(args as []),
      );
    }) as typeof real.readFileSync,
    // Falha de diretorio simulada para o caminho best-effort do estado.
    mkdirSync: ((caminho: unknown, ...args: unknown[]) => {
      if (estadoFs.falharMkdir) {
        throw new Error("mkdir simulada: diretorio nao criaavel");
      }
      return real.mkdirSync(caminho as Parameters<typeof real.mkdirSync>[0], ...(args as []));
    }) as typeof real.mkdirSync,
  };
});

function carregarRoteiro(nome: string): Roteiro {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as Roteiro;
}

let contadorDeImport = 0;

interface ResultadoDoCli {
  ok: boolean;
  stdout: string;
  stderr: string;
  // process.exitCode em Node aceita number | string; o CLI seta 1 ou
  // deixa undefined (normalizado para null).
  exitCode: number | string | null;
}

/**
 * Executa o CLI em processo: monta argv para terminar em "cli.ts" e
 * importa o modulo com cache-buster (cada import re-executa principal()).
 */
async function rodarCli(
  pedido: unknown,
  opcoes: { argv?: readonly string[]; env?: string; falharMkdir?: boolean } = {},
): Promise<ResultadoDoCli> {
  estadoFs.stdin = typeof pedido === "string" ? pedido : JSON.stringify(pedido);
  estadoFs.falharMkdir = opcoes.falharMkdir ?? false;

  const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
  const argvAnterior = process.argv;
  const envAnterior = process.env.ROTEIRO_ESTADO_PATH;
  process.argv = ["node", CAMINHO_CLI, ...(opcoes.argv ?? [])];
  if (opcoes.env !== undefined) {
    process.env.ROTEIRO_ESTADO_PATH = opcoes.env;
  }

  try {
    // Import com query unica: o ESM trata cada URL como modulo novo e o
    // guard `argv[1].endsWith("cli.ts")` dispara principal() na avaliacao.
    const url = `${CAMINHO_CLI}?run=${contadorDeImport++}`;
    await import(url);
  } finally {
    const saida = stdout.mock.calls.map((c) => String(c[0])).join("");
    const erros = stderr.mock.calls.map((c) => String(c[0])).join("");
    // Sucesso nunca seta process.exitCode (undefined = exit 0); normaliza
    // para null para o teste poder assertar "nenhum erro".
    const exitCode = process.exitCode ?? null;
    stdout.mockRestore();
    stderr.mockRestore();
    process.argv = argvAnterior;
    if (opcoes.env !== undefined) {
      if (envAnterior === undefined) {
        delete process.env.ROTEIRO_ESTADO_PATH;
      } else {
        process.env.ROTEIRO_ESTADO_PATH = envAnterior;
      }
    }
    process.exitCode = null;
    return { ok: exitCode !== 1, stdout: saida, stderr: erros, exitCode };
  }
}

function lerEstado(caminho: string): { estado: string; progresso: number | string | null; mensagem?: string } {
  return JSON.parse(readFileSync(caminho, "utf-8")) as {
    estado: string;
    progresso: number | string | null;
    mensagem?: string;
  };
}

afterEach(() => {
  process.exitCode = null;
});

// ─── As tres formas de pedido ────────────────────────────────────────────────

describe("CLI D11 (em processo) — pedidos validos", () => {
  it("roteiro no stdin: manifesto completo no stdout, exit 0", async () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro });
    expect(resultado.ok, resultado.stderr).toBe(true);
    expect(resultado.exitCode).toBeNull();
    const saida = JSON.parse(resultado.stdout) as { manifesto: Manifesto };
    expect(validarManifestoConstruido(saida.manifesto).valido).toBe(true);
    expect(saida.manifesto.cenas).toHaveLength(roteiro.pedacos.length);
  });

  it("roteiro + indice_pedaco: manifesto REDUZIDO do pedaco", async () => {
    const roteiro = carregarRoteiro("roteiro-com-narracao.json");
    const resultado = await rodarCli({ roteiro, indice_pedaco: 2 });
    expect(resultado.ok, resultado.stderr).toBe(true);
    const saida = JSON.parse(resultado.stdout) as { manifesto: Manifesto };
    expect(saida.manifesto.cenas).toHaveLength(1);
    expect(saida.manifesto.cenas[0]!.id).toBe("c-002");
    expect(saida.manifesto.cenas[0]!.audio_cena?.texto_locucao).toBe(
      roteiro.pedacos[2]!.narracao.texto,
    );
  });

  it("manifesto + indice_pedaco: reducao de um manifesto ja construido (reuso)", async () => {
    const roteiro = carregarRoteiro("roteiro-com-narracao.json");
    // Usa o construtor do proprio modulo para ter um manifesto valido.
    const { construirManifesto } = await import("../../src/roteiro/construir/construir.js");
    const valido = construirManifesto(roteiro);
    const resultado = await rodarCli({ manifesto: valido, indice_pedaco: 1 });
    expect(resultado.ok, resultado.stderr).toBe(true);
    const saida = JSON.parse(resultado.stdout) as { manifesto: Manifesto };
    expect(saida.manifesto.cenas).toHaveLength(1);
    expect(saida.manifesto.duracao_total_frames).toBe(
      Math.round(roteiro.pedacos[1]!.duracao_segundos * 30),
    );
  });
});

// ─── Pedidos malformados ─────────────────────────────────────────────────────

describe("CLI D11 (em processo) — pedidos malformados", () => {
  it("stdin vazio: erro nomeado no stderr, exit 1", async () => {
    const resultado = await rodarCli("");
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stdout).toBe("");
    expect(resultado.stderr).toContain("entrada invalida");
    expect(resultado.stderr).toContain("stdin vazio");
  });

  it("JSON invalido: erro com a mensagem do parse, exit 1", async () => {
    const resultado = await rodarCli("{isto nao e json");
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stderr).toContain("entrada invalida");
  });

  it("pedido null: exit 1 (nunca crash silencioso nem saida)", async () => {
    const resultado = await rodarCli("null");
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
  });

  it("sem roteiro nem manifesto: pedido-invalido nomeado", async () => {
    const resultado = await rodarCli({ opcoes: {} });
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stderr).toContain("pedido-invalido: campo roteiro ou manifesto obrigatorio");
  });

  it("roteiro E manifesto juntos: ambiguidade recusada", async () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro, manifesto: { schema_version: "Manifesto.1" } });
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stderr).toContain("pedido-invalido: envie OU roteiro");
  });

  it("manifesto sem indice_pedaco: recusado (a reducao e por pedaco)", async () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const { construirManifesto } = await import("../../src/roteiro/construir/construir.js");
    const resultado = await rodarCli({ manifesto: construirManifesto(roteiro) });
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stderr).toContain("pedido-invalido: manifesto exige indice_pedaco");
  });

  it("manifesto INVALIDO como entrada: recusado antes de reduzir (fail-closed)", async () => {
    const invalido = { schema_version: "Manifesto.1", nos: [], cenas: [] };
    const resultado = await rodarCli({ manifesto: invalido, indice_pedaco: 0 });
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stderr).toContain("manifesto invalido contra o schema oficial");
  });

  it("opcoes invalidas (fps 0): exit 1 com o problema no stderr", async () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro, opcoes: { fps: 0 } });
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stderr).toContain("fps 0 fora do intervalo 1..120");
  });

  it("indice_pedaco fora do limite na reducao: exit 1 com a regra", async () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro, indice_pedaco: 99 });
    expect(resultado.ok).toBe(false);
    expect(resultado.exitCode).toBe(1);
    expect(resultado.stderr).toContain("fora do limite");
  });
});

// ─── Arquivo de estado ───────────────────────────────────────────────────────

describe("CLI D11 (em processo) — arquivo de estado", () => {
  it("--estado <path>: reescrito ate 'ok' (o poll do servidor)", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "construtor-cli-estado-"));
    const caminho = join(diretorio, "estado.json");
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro }, { argv: ["--estado", caminho] });
    expect(resultado.ok, resultado.stderr).toBe(true);
    const estado = lerEstado(caminho);
    expect(estado.estado).toBe("ok");
    expect(estado.progresso).toBe(1);
  });

  it("ROTEIRO_ESTADO_PATH (env) tambem e aceito", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "construtor-cli-estado-"));
    const caminho = join(diretorio, "estado.json");
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro }, { env: caminho });
    expect(resultado.ok, resultado.stderr).toBe(true);
    expect(lerEstado(caminho).estado).toBe("ok");
  });

  it("erro de operacao: estado 'erro' com a mensagem", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "construtor-cli-estado-"));
    const caminho = join(diretorio, "estado.json");
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro, indice_pedaco: 99 }, { argv: ["--estado", caminho] });
    expect(resultado.ok).toBe(false);
    const estado = lerEstado(caminho);
    expect(estado.estado).toBe("erro");
    expect(estado.mensagem).toContain("fora do limite");
  });

  it("falha ao escrever o estado: best-effort — o resultado nao muda, stderr avisa", async () => {
    const diretorio = mkdtempSync(join(tmpdir(), "construtor-cli-estado-"));
    const caminho = join(diretorio, "estado.json");
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli(
      { roteiro },
      { argv: ["--estado", caminho], falharMkdir: true },
    );
    expect(resultado.ok, "a falha de estado nao pode derrubar a operacao").toBe(true);
    expect(resultado.stderr).toContain("estado nao gravado");
    expect(JSON.parse(resultado.stdout)).toBeDefined();
  });

  it("--estado sem valor no fim do argv: sem arquivo, operacao normal", async () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = await rodarCli({ roteiro }, { argv: ["--estado"] });
    expect(resultado.ok, resultado.stderr).toBe(true);
    // Nenhum arquivo de estado criado (sem caminho valido).
    expect(resultado.stderr).not.toContain("estado nao gravado");
    expect(existsSync("estado.json")).toBe(false);
  });
});
