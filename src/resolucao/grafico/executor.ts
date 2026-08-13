/**
 * src/resolucao/grafico/executor.ts
 *
 * A costura entre o estagio (TypeScript) e o motor grafico (Manim, Python).
 * Card F2-02 (W4).
 *
 * Existe uma interface aqui por um motivo so, e nao e "flexibilidade": o
 * estagio precisa ser TESTAVEL sem o Manim instalado, e o Manim NAO e
 * dependencia de teste deste repositorio (a suite roda com a rede fechada e
 * em maquina limpa). Com a costura, os testes exercitam o estagio inteiro
 * com um executor de teste, e a gravacao do cassete exercita o motor de
 * verdade.
 *
 * O que a costura NAO e: um fallback. Nao existe "se o Manim faltar, desenha
 * de outro jeito". O executor default falha com `EMotorGraficoAusente` e
 * ninguem o substitui em producao — um motor grafico que degrada em silencio
 * entrega video sem grafico com codigo de saida 0 (AGENTS.md C1).
 */

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ─── Tipos ──────────────────────────────────────────────────────────────────────

/** Formato de saida do render. */
export type FormatoDeVideo = "mp4" | "mov" | "webm";

/** Um render pedido ao motor grafico. */
export interface JobDeRender {
  /** Fonte Python da cena, ainda sem patch e sem saneamento. */
  readonly codigo: string;
  readonly larguraPx: number;
  readonly alturaPx: number;
  readonly fps: number;
  readonly formato: FormatoDeVideo;
  readonly fundoTransparente: boolean;
  /** Versao do Manim EXIGIDA. Divergencia e erro, nunca aviso. */
  readonly versaoManim: string;
  /** Versao do muxer EXIGIDA (`LavfXX.YY.ZZ`). Vai dentro dos bytes. */
  readonly versaoMuxer: string;
  /** Diretorio temporario exclusivo desta execucao. */
  readonly diretorioTrabalho: string;
}

/** O que o motor grafico devolveu. */
export interface ResultadoDeRender {
  /** SHA-256 do arquivo produzido. */
  readonly hash: string;
  readonly bytes: number;
  readonly largura: number;
  readonly altura: number;
  /** Frames declarados pelo container. */
  readonly framesDeclarados: number;
  /** Quantos frames foram efetivamente decodificados na checagem de conteudo. */
  readonly framesInspecionados: number;
  /** Quantos dos inspecionados eram chapados (C1: quadro preto sai com exit 0). */
  readonly framesChapados: number;
  /** Nome da classe de cena efetivamente renderizada. */
  readonly nomeCena: string;
  /** Correcoes de quirk aplicadas ao codigo ANTES do render, nomeadas. */
  readonly correcoes: readonly string[];
  /** Ferramenta e versao reais (`manim 0.20.1`). */
  readonly ferramenta: string;
  /** Muxer real (`Lavf62.12.102`). */
  readonly muxer: string;
}

/** O motor grafico, visto pelo estagio. */
export interface ExecutorManim {
  renderizar(job: JobDeRender): Promise<ResultadoDeRender>;
}

// ─── Erros ──────────────────────────────────────────────────────────────────────

/** Motor grafico ausente. Nunca vira aviso, nunca vira desenho alternativo. */
export class EMotorGraficoAusente extends Error {
  readonly code = "MOTOR_GRAFICO_AUSENTE";
  constructor(detalhe: string) {
    super(
      `Motor grafico ausente: ${detalhe}\n` +
        `  O estagio grafico NAO tem caminho alternativo de desenho.\n` +
        `  Instale o Manim CE ou aponte MANIM_BIN para um interpretador que o tenha.\n` +
        `  Isto so afeta a GRAVACAO do cassete: offline o estagio nao e executado.`,
    );
    this.name = "EMotorGraficoAusente";
  }
}

/** O render falhou, ou produziu algo que nao e imagem. */
export class EFalhaDeRender extends Error {
  readonly code: string;
  readonly detalhe: string;
  constructor(codigo: string, mensagem: string, detalhe: string) {
    super(`${codigo}: ${mensagem}${detalhe ? `\n--- saida do motor ---\n${detalhe}` : ""}`);
    this.name = "EFalhaDeRender";
    this.code = codigo;
    this.detalhe = detalhe;
  }
}

// ─── Executor de subprocesso ────────────────────────────────────────────────────

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Caminho do runner Python. Resolvido a partir deste arquivo, nao do cwd. */
export const CAMINHO_DO_RUNNER = join(AQUI, "manim", "runner.py");

/** Codigos de erro do runner que significam "motor ausente". */
const CODIGOS_DE_AUSENCIA = new Set(["EMOTOR_AUSENTE"]);

interface RespostaDoRunner {
  readonly ok: boolean;
  readonly codigo?: string;
  readonly mensagem?: string;
  readonly detalhe?: string;
  readonly hash?: string;
  readonly bytes?: number;
  readonly largura?: number;
  readonly altura?: number;
  readonly framesDeclarados?: number;
  readonly framesInspecionados?: number;
  readonly framesChapados?: number;
  readonly nomeCena?: string;
  readonly correcoes?: string[];
  readonly ferramenta?: string;
  readonly muxer?: string;
}

/**
 * Executor real: um processo Python por cena.
 *
 * Nao e servico, nao e pool, nao e daemon (`docs/reuso-3b1b.md` item 2.16).
 * O job vai por ARQUIVO, e nao por argumento de linha de comando: a fonte da
 * cena tem quebras de linha e aspas, e passar isso por argv e o tipo de coisa
 * que funciona ate o primeiro rotulo com acento.
 */
export class ExecutorManimSubprocesso implements ExecutorManim {
  private readonly python: string;
  private readonly runner: string;

  constructor(opcoes: { python?: string; runner?: string } = {}) {
    this.python = opcoes.python ?? process.env["PYTHON_BIN"] ?? "python3";
    this.runner = opcoes.runner ?? CAMINHO_DO_RUNNER;
  }

  async renderizar(job: JobDeRender): Promise<ResultadoDeRender> {
    const dir = await mkdtemp(join(tmpdir(), "res-grafico-job-"));
    const arquivoJob = join(dir, "job.json");
    try {
      await writeFile(arquivoJob, JSON.stringify(job), "utf-8");
      const { codigoDeSaida, stdout, stderr } = await rodar(this.python, [
        this.runner,
        arquivoJob,
      ]);

      const ultima = stdout.trim().split("\n").pop() ?? "";
      let resposta: RespostaDoRunner;
      try {
        resposta = JSON.parse(ultima) as RespostaDoRunner;
      } catch {
        throw new EFalhaDeRender(
          "ERUNNER_MUDO",
          `o runner saiu com codigo ${codigoDeSaida} e nao imprimiu JSON`,
          `${stdout}\n${stderr}`.slice(-2000),
        );
      }

      if (!resposta.ok) {
        const codigo = resposta.codigo ?? "ERENDER_FALHOU";
        if (CODIGOS_DE_AUSENCIA.has(codigo)) {
          throw new EMotorGraficoAusente(resposta.mensagem ?? "(sem detalhe)");
        }
        throw new EFalhaDeRender(
          codigo,
          resposta.mensagem ?? "(sem mensagem)",
          resposta.detalhe ?? "",
        );
      }

      return {
        hash: resposta.hash ?? "",
        bytes: resposta.bytes ?? 0,
        largura: resposta.largura ?? 0,
        altura: resposta.altura ?? 0,
        framesDeclarados: resposta.framesDeclarados ?? 0,
        framesInspecionados: resposta.framesInspecionados ?? 0,
        framesChapados: resposta.framesChapados ?? 0,
        nomeCena: resposta.nomeCena ?? "",
        correcoes: resposta.correcoes ?? [],
        ferramenta: resposta.ferramenta ?? "",
        muxer: resposta.muxer ?? "",
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function rodar(
  comando: string,
  argumentos: readonly string[],
): Promise<{ codigoDeSaida: number; stdout: string; stderr: string }> {
  return new Promise((resolver, rejeitar) => {
    const filho = spawn(comando, [...argumentos], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    filho.stdout.on("data", (pedaco: Buffer) => {
      stdout += pedaco.toString("utf-8");
    });
    filho.stderr.on("data", (pedaco: Buffer) => {
      stderr += pedaco.toString("utf-8");
    });
    filho.on("error", (erro) => {
      rejeitar(new EMotorGraficoAusente(`nao foi possivel executar ${comando}: ${erro.message}`));
    });
    filho.on("close", (codigo) => {
      resolver({ codigoDeSaida: codigo ?? -1, stdout, stderr });
    });
  });
}
