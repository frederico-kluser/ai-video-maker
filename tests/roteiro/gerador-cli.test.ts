/**
 * tests/roteiro/gerador-cli.test.ts
 *
 * O CLI do gerador de roteiro (D11 — docs/roteiro/api.md §"CLIs de
 * operacao pesada"): o servidor da Onda 4 chama `npx tsx
 * src/roteiro/gerador/cli.ts` via child-process com o pedido em stdin e
 * le o resultado do stdout, o erro do stderr (envelope JSON) e o
 * progresso do arquivo de estado.
 *
 * Cada teste spawna um PROCESSO REAL (tsx) — a mesma disciplina anti-C2
 * da primeira-chamada.test.ts: o estado do processo de teste nunca
 * alcança o filho, e o exit code + stdout + stderr + arquivo de estado
 * sao a prova inteira. O provedor e o sosia (ROTEIRO_PROVEDOR=sosia):
 * zero rede, zero credencial (FQ-G5).
 *
 * Exit codes: 0 = sucesso; 2 = entrada/uso invalidos; 1 = falha de
 * geracao. Sonda negativa por grupo: cada caso de erro asserta o exit
 * code DIFERENTE de zero — um CLI que "passasse" sem fazer nada sai 0 e
 * quebra o teste.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validarRoteiro, validarPedaco } from "../../src/roteiro/contrato/validar.js";

const RAIZ = join(__dirname, "..", "..");
const CAMINHO_CLI = join(RAIZ, "src", "roteiro", "gerador", "cli.ts");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");

/** Um PedidoGerarRoteiro valido (as versoes do contrato corrente). */
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

/** Um PedidoRegenerarPedaco valido. */
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

interface ResultadoDoCli {
  status: number;
  stdout: string;
  stderr: string;
}

/** Roda o CLI em processo real com o JSON dado em stdin. */
function rodarCli(
  pedido: unknown,
  extras: { flags?: string[]; env?: Record<string, string> } = {},
): ResultadoDoCli {
  try {
    const stdout = execFileSync(BIN_TSX, [CAMINHO_CLI, ...(extras.flags ?? [])], {
      input: JSON.stringify(pedido),
      env: {
        ...process.env,
        ROTEIRO_PROVEDOR: "sosia",
        ROTEIRO_CACHE_DIR: mkdtempSync(join(tmpdir(), "roteiro-cli-cache-")),
        ...extras.env,
      },
      encoding: "utf-8",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (erro) {
    const e = erro as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

describe("CLI do gerador — D11: stdin JSON, stdout JSON, progresso em arquivo, exit codes claros", () => {
  it("gerar roteiro: exit 0, stdout JSON valido (Roteiro.1) e arquivo de estado termina em 'ok'", () => {
    const estadoPath = join(mkdtempSync(join(tmpdir(), "roteiro-cli-estado-")), "estado.json");
    const resultado = rodarCli(PEDIDO_GERAR, { flags: ["--estado", estadoPath] });

    expect(resultado.status).toBe(0);
    expect(resultado.stderr).toBe("");
    const roteiro = JSON.parse(resultado.stdout) as { schema_version: string; pedacos: unknown[] };
    expect(roteiro.schema_version).toBe("Roteiro.1");
    expect(validarRoteiro(roteiro).valido).toBe(true);

    const estadoFinal = JSON.parse(readFileSync(estadoPath, "utf-8")) as {
      estado: string;
      progresso: number;
    };
    expect(estadoFinal.estado).toBe("ok");
    expect(estadoFinal.progresso).toBe(1);
  });

  it("regenerar pedaco: exit 0, stdout e UM Pedaco valido com id/indice preservados (FQ-G2)", () => {
    const resultado = rodarCli(pedidoRegenerar());
    expect(resultado.status).toBe(0);
    const pedaco = JSON.parse(resultado.stdout) as {
      id: string;
      indice: number;
      tipo_visual: string;
    };
    expect(pedaco.id).toBe("p-001");
    expect(pedaco.indice).toBe(1);
    expect(validarPedaco(pedaco).valido).toBe(true);
  });

  it("o provedor vem do env ROTEIRO_PROVEDOR (o servidor da Onda 4 troca o sosia pelo LLM sem tocar no CLI)", () => {
    const resultado = rodarCli(PEDIDO_GERAR, {
      env: { ROTEIRO_PROVEDOR: "cassete", RAIZ_CASSETES: join(RAIZ, "fixtures", "cassetes") },
    });
    // O cassete commitado cobre exatamente este pedido+prompt: o replay
    // serve o roteiro gravado (a prova de que o env foi respeitado).
    expect(resultado.status).toBe(0);
    const roteiro = JSON.parse(resultado.stdout) as { schema_version: string };
    expect(roteiro.schema_version).toBe("Roteiro.1");
  });

  it("SONDA NEGATIVA: stdin que nao e JSON → exit 2 com envelope no stderr e estado 'erro'", () => {
    const estadoPath = join(mkdtempSync(join(tmpdir(), "roteiro-cli-estado-")), "estado.json");
    let resultado: ResultadoDoCli;
    try {
      execFileSync(BIN_TSX, [CAMINHO_CLI, "--estado", estadoPath], {
        input: "isto nao e JSON",
        env: { ...process.env, ROTEIRO_PROVEDOR: "sosia" },
        encoding: "utf-8",
      });
      resultado = { status: 0, stdout: "", stderr: "" };
    } catch (erro) {
      const e = erro as { status?: number; stdout?: string; stderr?: string };
      resultado = { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    }
    expect(resultado.status).toBe(2);
    expect(resultado.stdout).toBe("");
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string } };
    expect(envelope.erro.codigo).toBe("entrada-invalida");
    const estado = JSON.parse(readFileSync(estadoPath, "utf-8")) as { estado: string };
    expect(estado.estado).toBe("erro");
  });

  it("pedido INVALIDO (versao errada do contrato) → exit 2 com codigo 'pedido-invalido' e as regras", () => {
    const pedidoInvalido = { ...PEDIDO_GERAR, versao_contrato: "Roteiro.2" };
    const resultado = rodarCli(pedidoInvalido);
    expect(resultado.status).toBe(2);
    const envelope = JSON.parse(resultado.stderr) as {
      erro: { codigo: string; detalhes: string[] };
    };
    expect(envelope.erro.codigo).toBe("pedido-invalido");
    expect(envelope.erro.detalhes.join(" ")).toContain("versao-incompativel");
  });

  it("provedor desconhecido → exit 2 com mensagem clara (nunca cai em default silencioso)", () => {
    const resultado = rodarCli(PEDIDO_GERAR, { env: { ROTEIRO_PROVEDOR: "nao-existe" } });
    expect(resultado.status).toBe(2);
    expect(resultado.stderr).toContain("desconhecido");
  });

  it("flag desconhecida → exit 2 (uso invalido)", () => {
    const resultado = rodarCli(PEDIDO_GERAR, { flags: ["--nao-existe"] });
    expect(resultado.status).toBe(2);
    expect(resultado.stderr).toContain("argumento desconhecido");
  });

  it("SONDA NEGATIVA: cassete AUSENTE → exit 1 com o caminho esperado no stderr (geracao falhou, nao entrada)", () => {
    const raizVazia = mkdtempSync(join(tmpdir(), "roteiro-cli-cassetes-vazios-"));
    const resultado = rodarCli(PEDIDO_GERAR, {
      env: { ROTEIRO_PROVEDOR: "cassete", RAIZ_CASSETES: raizVazia },
    });
    expect(resultado.status).toBe(1);
    const envelope = JSON.parse(resultado.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("cassete-ausente");
    expect(envelope.erro.mensagem).toContain("esperado:");
  });

  it("--help imprime o uso e sai 0", () => {
    const resultado = rodarCli(null, { flags: ["--help"] });
    expect(resultado.status).toBe(0);
    expect(resultado.stdout).toContain("CLI do gerador de roteiro");
  });
});
