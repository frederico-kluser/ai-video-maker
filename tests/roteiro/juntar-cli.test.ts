/**
 * tests/roteiro/juntar-cli.test.ts — o CLI do juntar (D11) EM PROCESSO.
 *
 * A suite de spawn (juntar.test.ts) prova o executavel real de fora;
 * ESTE arquivo carrega `principal()` no processo do vitest — o unico
 * jeito de a cobertura de cli.ts contar (spawn nao instrumenta o
 * modulo; o trio do gate nao roda coverage).
 *
 * Stubs: process.stdin (a fonte do pedido), process.stdout/stderr.write
 * (captura do envelope), process.argv (as flags), process.env
 * (ROTEIRO_ESTADO_PATH). O filesystem e REAL: escreverEstado com
 * tmp+rename e as entregas por hash sao os mesmos artefatos que o
 * servidor da Onda 5 le. O caso de caminho de estado invalido (erro no
 * disco) roda por SPAWN real — o wrapper do executavel e quem mapeia a
 * rejeicao para o envelope `erro-interno` com exit 1.
 *
 * O que NAO e re-testado aqui: os fluxos felizes detalhados (FQ-J1..J5
 * estao na suite real). Este arquivo cobre os exit codes 0/1/2 e as
 * linhas de cli.ts que o spawn nunca toca.
 */

import { execFileSync, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { principal } from "../../src/roteiro/juntar/cli.js";
import type { Pedaco, Roteiro } from "../../src/roteiro/contrato/contrato.js";

const RAIZ = join(__dirname, "..", "..");
const CAMINHO_CLI = join(RAIZ, "src", "roteiro", "juntar", "cli.ts");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");

const DIR = mkdtempSync(join(tmpdir(), "juntar-cli-em-processo-"));
const PREVIEW_440 = join(DIR, "preview-440.mp4");
const PREVIEW_660 = join(DIR, "preview-660.mp4");
const PREVIEW_PEQUENO = join(DIR, "preview-320x240.mp4");
const PREVIEW_LIXO = join(DIR, "preview-lixo.mp4");
const MUSICA = join(DIR, "musica.wav");
const DIR_ENTREGAS = join(DIR, "entregas");

function gerarPreview(caminho: string, frequencia: number, extra: string[] = []): void {
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=d=1:s=1920x1080:r=30",
    "-f", "lavfi", "-i", `sine=frequency=${String(frequencia)}:sample_rate=48000:duration=1,volume=0.3`,
    ...extra,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    "-t", "1",
    caminho,
  ]);
}

beforeAll(() => {
  gerarPreview(PREVIEW_440, 440);
  gerarPreview(PREVIEW_660, 660);
  // Fora do formato (o gate de formatos recusa — nunca concat cego).
  gerarPreview(PREVIEW_PEQUENO, 440, ["-s", "320x240"]);
  // Nao-midia: o arquivo EXISTE (gate de presenca passa) e o ffprobe
  // falha na leitura — o caminho do erro interno (juntar-render-falhou).
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=2",
    "-c:a", "pcm_f32le",
    MUSICA,
  ]);
  execFileSync("touch", [PREVIEW_LIXO]);
}, 300_000);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pedacoDeTeste(espec: { id: string; origem?: "tts" | "gravacao" | "nenhuma" }): Pedaco {
  const fala = `Fala do ${espec.id}`;
  const origem = espec.origem ?? "tts";
  return {
    id: espec.id,
    indice: Number(espec.id.slice(2)),
    titulo: `Titulo ${espec.id}`,
    fala,
    duracao_segundos: 1.0,
    tipo_visual: "texto",
    especificacao_visual: "Um texto em destaque",
    detalhes_de_producao: "Como o pedaco sera feito",
    narracao:
      origem === "nenhuma"
        ? { texto: "", origem: "nenhuma", status: "vazio" }
        : { texto: fala, origem, status: "gerado" },
  };
}

function roteiroDeTeste(especs: Array<{ id: string; origem?: "tts" | "gravacao" | "nenhuma" }>): Roteiro {
  const pedacos = especs.map(pedacoDeTeste);
  return {
    schema_version: "Roteiro.1",
    pedacos,
    duracao_total_segundos: pedacos.length,
  };
}

/** Um stdin fake: setEncoding no-op + eventos data/end (o mesmo contrato). */
function stdinDe(conteudo: string): unknown {
  const stream = new EventEmitter();
  (stream as { setEncoding?: () => void }).setEncoding = () => {};
  setImmediate(() => {
    if (conteudo !== "") {
      stream.emit("data", conteudo);
    }
    stream.emit("end");
  });
  return stream;
}

/** Um stdin fake que FALHA na leitura (o evento 'error' do stream). */
function stdinQueErra(): unknown {
  const stream = new EventEmitter();
  (stream as { setEncoding?: () => void }).setEncoding = () => {};
  setImmediate(() => {
    stream.emit("error", new Error("falha de leitura simulada"));
  });
  return stream;
}

interface SaidaDoCli {
  codigo: number;
  stdout: string;
  stderr: string;
}

/**
 * Roda principal() em processo, com stdin/argv/stdout/stderr stubados.
 * Restaura tudo (mocks e env) ao final — os testes deste arquivo nao
 * vazam estado para os irmaos.
 */
async function principalCom(
  entrada: string,
  args: string[] = [],
  env: Record<string, string> = {},
): Promise<SaidaDoCli> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const argvSpy = vi.spyOn(process, "argv", "get").mockReturnValue(["node", "cli.ts", ...args]);
  const stdoutSpy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((d: string | Uint8Array) => {
      stdout.push(String(d));
      return true;
    });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((d: string | Uint8Array) => {
      stderr.push(String(d));
      return true;
    });
  const stdinSpy = vi.spyOn(process, "stdin", "get").mockReturnValue(
    (entrada === "__erro_na_leitura__" ? stdinQueErra() : stdinDe(entrada)) as never,
  );
  for (const [k, v] of Object.entries(env)) {
    process.env[k] = v;
  }
  let codigo: number;
  try {
    codigo = await principal();
  } finally {
    argvSpy.mockRestore();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    stdinSpy.mockRestore();
    for (const k of Object.keys(env)) {
      delete process.env[k];
    }
  }
  return { codigo, stdout: stdout.join(""), stderr: stderr.join("") };
}

/** Envelope de erro do stderr (api.md). */
interface EnvelopeDeErro {
  erro: { codigo: string; mensagem: string; detalhes: string[] };
}

function envelope(saida: SaidaDoCli): EnvelopeDeErro {
  return JSON.parse(saida.stderr) as EnvelopeDeErro;
}

const caminhoEstado = join(DIR, "estado.json");

afterEach(() => {
  // Nenhuma flag global pode sobreviver aos testes do arquivo.
  vi.restoreAllMocks();
  delete process.env.ROTEIRO_ESTADO_PATH;
});

// ─── Uso (exit 2) e ajuda (exit 0) ────────────────────────────────────────────

describe("CLI (em processo) — uso: --help e argumentos invalidos", () => {
  it("--help -> exit 0 e o texto de uso no stdout", async () => {
    const saida = await principalCom("", ["--help"]);
    expect(saida.codigo).toBe(0);
    expect(saida.stdout).toContain("Uso:");
    expect(saida.stdout).toContain("--estado <path>");
    expect(saida.stderr).toBe("");
  });

  it("-h (alias) -> exit 0", async () => {
    const saida = await principalCom("", ["-h"]);
    expect(saida.codigo).toBe(0);
    expect(saida.stdout).toContain("Uso:");
  });

  it("argumento desconhecido -> exit 2 com envelope uso-invalido", async () => {
    const saida = await principalCom("", ["--nao-existe"]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.codigo).toBe("uso-invalido");
    expect(envelope(saida).erro.mensagem).toContain("argumento desconhecido: --nao-existe");
  });

  it("--estado sem valor -> exit 2 (uso-invalido)", async () => {
    const saida = await principalCom("", ["--estado"]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.codigo).toBe("uso-invalido");
    expect(envelope(saida).erro.mensagem).toContain("--estado exige um caminho de arquivo");
  });

  it("--estado seguido de outra flag -> exit 2 (valor começa com --)", async () => {
    const saida = await principalCom("", ["--estado", "--help"]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.codigo).toBe("uso-invalido");
  });
});

// ─── Entrada invalida (exit 2) ────────────────────────────────────────────────

describe("CLI (em processo) — entrada invalida: exit 2 e estado terminal de erro", () => {
  it("falha na leitura do stdin (evento de erro do stream) -> exit 2", async () => {
    const saida = await principalCom("__erro_na_leitura__", ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.codigo).toBe("entrada-invalida");
    expect(envelope(saida).erro.mensagem).toContain("falha ao ler stdin");
    expect(envelope(saida).erro.mensagem).toContain("falha de leitura simulada");
  });

  it("stdin nao e JSON -> exit 2 + arquivo de estado em 'erro' (o poll ve o terminal)", async () => {
    const saida = await principalCom("isto-nao-e-json", ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.codigo).toBe("entrada-invalida");
    expect(envelope(saida).erro.mensagem).toContain("nao e JSON valido");
    expect(saida.stdout).toBe("");
    const estado = JSON.parse(readFileSync(caminhoEstado, "utf-8")) as {
      estado: string;
      erro: string | null;
    };
    expect(estado.estado).toBe("erro");
    expect(estado.erro).toContain("JSON");
  });

  it("stdin JSON nao-objeto (array) -> exit 2", async () => {
    const saida = await principalCom("[]", ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("objeto JSON");
  });

  it("pedido sem roteiro -> exit 2 (o juntar so roda com roteiro gerado)", async () => {
    const saida = await principalCom('{"opcoes":{}}', ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("pedido sem roteiro");
    const estado = JSON.parse(readFileSync(caminhoEstado, "utf-8")) as { estado: string };
    expect(estado.estado).toBe("erro");
  });

  it("opcoes nao-objeto (null) -> exit 2", async () => {
    const pedido = JSON.stringify({ roteiro: roteiroDeTeste([{ id: "p-000" }]), opcoes: null });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("opcoes precisa ser um objeto");
  });

  it("opcoes.previews nao-objeto -> exit 2", async () => {
    const pedido = JSON.stringify({ roteiro: roteiroDeTeste([{ id: "p-000" }]), opcoes: { previews: "x" } });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("previews precisa ser um objeto");
  });

  it("opcoes.previews com caminho vazio -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: { previews: { "p-000": "" } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain('opcoes.previews["p-000"] precisa ser um caminho nao-vazio');
  });

  it("opcoes.musica_caminho vazio -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: { previews: { "p-000": PREVIEW_440 }, musica_caminho: "" },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("musica_caminho precisa ser um caminho nao-vazio");
  });

  it("opcoes.timing_pedacos nao-objeto -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: { previews: { "p-000": PREVIEW_440 }, timing_pedacos: "x" },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("timing_pedacos precisa ser um objeto");
  });

  it("timing_pedacos[id] que nao e um array -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: { previews: { "p-000": PREVIEW_440 }, timing_pedacos: { "p-000": "nao-e-array" } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("precisa ser um array de cues");
  });

  it("cue nao-objeto -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: { previews: { "p-000": PREVIEW_440 }, timing_pedacos: { "p-000": ["x"] } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("cue nao e um objeto");
  });

  it("cue sem texto nao-vazio -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: {
        previews: { "p-000": PREVIEW_440 },
        timing_pedacos: { "p-000": [{ texto: "  ", inicio_segundos: 0.1, fim_segundos: 0.5 }] },
      },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("cue sem texto nao-vazio");
  });

  it("cue com fim < inicio -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: {
        previews: { "p-000": PREVIEW_440 },
        timing_pedacos: { "p-000": [{ texto: "Cue", inicio_segundos: 0.8, fim_segundos: 0.2 }] },
      },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("cue com tempo invalido");
  });

  it("cue com tempo nao-numerico -> exit 2", async () => {
    const pedido = JSON.stringify({
      roteiro: roteiroDeTeste([{ id: "p-000" }]),
      opcoes: {
        previews: { "p-000": PREVIEW_440 },
        timing_pedacos: { "p-000": [{ texto: "Cue", inicio_segundos: "abc", fim_segundos: 0.5 }] },
      },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(2);
    expect(envelope(saida).erro.mensagem).toContain("cue com tempo invalido");
  });
});

// ─── A operacao: exit 0 e exit 1 (409s + falha de render) ─────────────────────

describe("CLI (em processo) — a operacao: exit 0/1 com envelope e estado", () => {
  it(
    "sucesso: exit 0, JSON com hash/duracao/srt/loudness, estado 'ok'",
    async () => {
      const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
      const pedido = JSON.stringify({
        roteiro,
        opcoes: {
          previews: { "p-000": PREVIEW_440, "p-001": PREVIEW_660 },
          musica_caminho: MUSICA,
          timing_pedacos: {
            "p-000": [{ texto: "Cue um", inicio_segundos: 0.1, fim_segundos: 0.5 }],
          },
        },
      });
      const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
      expect(saida.codigo).toBe(0);
      expect(saida.stderr).toBe("");
      const saidaJson = JSON.parse(saida.stdout) as {
        hash: string;
        caminho: string;
        duracao_segundos: number;
        duracao_total_segundos: number;
        srt_caminho: string | null;
        loudness: { alvo_lufs: number; musica_aplicada: boolean };
      };
      expect(saidaJson.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(Math.abs(saidaJson.duracao_segundos - 2.0)).toBeLessThan(0.05);
      expect(saidaJson.duracao_total_segundos).toBe(saidaJson.duracao_segundos);
      expect(saidaJson.srt_caminho).toBeTruthy();
      expect(existsSync(saidaJson.srt_caminho!)).toBe(true);
      expect(saidaJson.loudness.alvo_lufs).toBe(-23.0);
      expect(saidaJson.loudness.musica_aplicada).toBe(true);
      // A entrega por hash existe em disco (S-8) e o estado termina em ok.
      expect(existsSync(saidaJson.caminho)).toBe(true);
      const estado = JSON.parse(readFileSync(caminhoEstado, "utf-8")) as {
        estado: string;
        progresso: number;
      };
      expect(estado.estado).toBe("ok");
      expect(estado.progresso).toBe(1);
    },
    300_000,
  );

  it("ROTEIRO_ESTADO_PATH (env) substitui a falta de --estado", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_660 } },
    });
    const caminhoEnv = join(DIR, "estado-env.json");
    const saida = await principalCom(pedido, [], { ROTEIRO_ESTADO_PATH: caminhoEnv });
    expect(saida.codigo).toBe(0);
    const estado = JSON.parse(readFileSync(caminhoEnv, "utf-8")) as { estado: string };
    expect(estado.estado).toBe("ok");
  }, 300_000);

  it("gate 409: fala sem narracao -> exit 1, codigo no envelope e detalhes estruturais", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" },
      { id: "p-001", origem: "nenhuma" },
    ]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_440, "p-001": PREVIEW_660 } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(1);
    expect(saida.stdout).toBe("");
    const e = envelope(saida);
    expect(e.erro.codigo).toBe("juntar-fala-sem-narracao");
    expect(e.erro.mensagem).toContain("p-001");
    // O 409 lista os pedacos em detalhes ESTRUTURAIS.
    expect(e.erro.detalhes).toEqual(["pedacos[1].id p-001"]);
    const estado = JSON.parse(readFileSync(caminhoEstado, "utf-8")) as { estado: string };
    expect(estado.estado).toBe("erro");
  });

  it("gate 409: pedido sem opcoes -> validarOpcoes(undefined) e juntar-preview-ausente com TODOS os ids", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    const saida = await principalCom(JSON.stringify({ roteiro }), ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(1);
    const e = envelope(saida);
    expect(e.erro.codigo).toBe("juntar-preview-ausente");
    expect(e.erro.detalhes).toEqual(["pedacos[0].id p-000", "pedacos[1].id p-001"]);
  });

  it("sem --estado e sem ROTEIRO_ESTADO_PATH: nenhum arquivo de estado nasce (early return)", async () => {
    // escreverEstado(undefined) e no-op — o CLI roda sem progresso. O
    // roteiro cai no gate 409 (nao chega ao juntar real, teste rapido).
    const roteiro = roteiroDeTeste([
      { id: "p-000" },
      { id: "p-001", origem: "nenhuma" },
    ]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_440, "p-001": PREVIEW_660 } },
    });
    const saida = await principalCom(pedido, []);
    expect(saida.codigo).toBe(1); // gate 409 (nao chega ao juntar)
    expect(envelope(saida).erro.codigo).toBe("juntar-fala-sem-narracao");
  });

  it("gate 409: preview ausente com caminho declarado inexistente -> detalhes com o id", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": join(DIR, "nao-existe.mp4") } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(1);
    const e = envelope(saida);
    expect(e.erro.codigo).toBe("juntar-preview-ausente");
    expect(e.erro.detalhes).toEqual(["pedacos[0].id p-000"]);
  });

  it("roteiro invalido (fora das regras de anexo) -> exit 1 com os problemas do validador em detalhes", async () => {
    // duracao_total divergente da soma: a regra duracao-total-inconsistente
    // cai fora do escopo anexo e o CLI carrega os problemas do validador
    // nos detalhes estruturais (o servidor nao parseia a mensagem).
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    const invalido = { ...roteiro, duracao_total_segundos: 99 };
    const pedido = JSON.stringify({
      roteiro: invalido,
      opcoes: { previews: { "p-000": PREVIEW_440, "p-001": PREVIEW_660 } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(1);
    const e = envelope(saida);
    expect(e.erro.codigo).toBe("juntar-roteiro-invalido");
    expect(e.erro.detalhes.join(" ")).toContain("duracao-total-inconsistente");
  });

  it("409 de formatos divergentes -> exit 1 com as divergencias estruturais", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_PEQUENO } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(1);
    const e = envelope(saida);
    expect(e.erro.codigo).toBe("juntar-formatos-divergentes");
    expect(e.erro.detalhes.join(" ")).toContain("largura");
    expect(e.erro.mensagem).toContain("previews divergem");
  }, 120_000);

  it("preview nao-midia -> exit 1 com codigo juntar-render-falhou (falha interna honesta, nunca 'ok' mentiroso)", async () => {
    // O arquivo EXISTE (o gate de presenca passa); o ffprobe falha na
    // leitura — o erro nao e da familia ErroJuntar e o CLI o mapeia
    // para juntar-render-falhou (FQ-S1: falha honesta).
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_LIXO } },
    });
    const saida = await principalCom(pedido, ["--estado", caminhoEstado]);
    expect(saida.codigo).toBe(1);
    expect(envelope(saida).erro.codigo).toBe("juntar-render-falhou");
    expect(saida.stdout).toBe("");
  }, 120_000);
});

// ─── Caminho de estado invalido (via spawn real: o wrapper do executavel) ─────

describe("CLI (spawn real) — caminho de estado invalido", () => {
  function rodarCli(entrada: string, args: string[]): Promise<{ codigo: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const filho = spawn(BIN_TSX, [CAMINHO_CLI, ...args]);
      let stdout = "";
      let stderr = "";
      filho.stdout.on("data", (d: Buffer) => {
        stdout += String(d);
      });
      filho.stderr.on("data", (d: Buffer) => {
        stderr += String(d);
      });
      filho.on("error", (erro: Error) => {
        resolve({ codigo: 2, stdout, stderr: `falha ao spawnar: ${erro.message}` });
      });
      filho.on("close", (codigo: number | null) => {
        resolve({ codigo: codigo ?? 1, stdout, stderr });
      });
      filho.stdin.end(entrada);
    });
  }

  it("--estado apontando para /proc -> erro-interno com exit 1 (o estado e obrigatorio antes do trabalho)", async () => {
    // O estado e escrito ANTES do trabalho (o poll do servidor precisa
    // do arquivo); um caminho que o disco recusa derruba o CLI com o
    // envelope erro-interno — nunca um exit 0 mentiroso.
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_440 } },
    });
    const saida = await rodarCli(pedido, ["--estado", join("/proc", "estado-invalido.json")]);
    expect(saida.codigo).toBe(1);
    const e = JSON.parse(saida.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(e.erro.codigo).toBe("erro-interno");
    expect(e.erro.mensagem.length).toBeGreaterThan(0);
    expect(saida.stdout).toBe("");
  }, 120_000);
});
