/**
 * src/roteiro/preview/cli.ts
 *
 * CLI D11 do PREVIEW DE PEDACO — a convencao de CLIs de operacao pesada
 * de docs/roteiro/api.md §"CLIs de operacao pesada" (REPLAN P2):
 *
 *   - entrada: JSON em stdin;
 *   - saida:   JSON em stdout, so em sucesso (exit 0);
 *   - erro:    exit != 0 com o envelope JSON do erro em stderr;
 *   - progresso: arquivo de estado por `--estado <path>` ou env
 *     `ROTEIRO_ESTADO_PATH`, reescrito (JSON de JobStatus sem id/artefato)
 *     a medida que avanca — escrita atomica (tmp + rename, S-8).
 *
 * Entrada aceita (o servidor da Onda 5 monta exatamente esta forma):
 *
 *   { "roteiro": Roteiro, "indice_pedaco": number,
 *     "opcoes"?: { "store_raiz"?, "cache_raiz"?, "previews_raiz"? } }
 *
 * Mídia entra por CAMINHO/STORE, nunca por stdin (D11 item 4): o anexo
 * e o audio gravado vivem no store por hash (C7) — o roteiro so carrega
 * os hashes. Nenhuma rede, nenhum URL (C7).
 *
 * EXIT CODES (a mesma convencao do CLI do gerador, tests/roteiro/gerador-cli.test.ts):
 *
 *   0 = sucesso (stdout JSON);
 *   2 = erro de ENTRADA/ESTADO: pedido malformado, roteiro/pedaco
 *       invalido, duracao abaixo de um frame (duracao-insuficiente),
 *       opcoes fora do formato congelado (preview-formato-divergente),
 *       visual nao produzivel (anexo-exigido-para-gif-video), manim
 *       indisponivel — o servidor mapeia 400/409;
 *   1 = falha INTERNA: render/encode/mux falhou, preview vazio/chapado
 *       (C1) — o servidor mapeia 500.
 *
 * O job NUNCA termina "ok" com imagem errada: o erro nomeado do visual
 * e exit 2 (FQ-P3 — analogo ao 409 anexo-exigido-para-gif-video da API).
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Roteiro } from "../contrato/contrato.js";
import { ErroContratoRoteiro } from "../contrato/rejeitar.js";
import { ErroDuracaoInsuficiente, ErroReduzirManifesto } from "../construir/construir.js";
import { ErroAnexoAusente } from "../construir/mapear.js";
import {
  renderizarPreviewPedaco,
  ErroPreviewFormatoDivergente,
  ErroPreviewManimIndisponivel,
  ErroPreviewRender,
  ErroPreviewVazio,
  ErroPreviewVisualNaoProduzivel,
} from "./preview.js";

// ─── Estado (JobStatus sem id/artefato — docs/roteiro/api.md) ────────────────

interface EstadoDoJob {
  estado: "pendente" | "rodando" | "ok" | "erro";
  progresso: number | null;
  mensagem?: string;
  erro?: string | null;
}

/**
 * Escreve o arquivo de estado (best-effort: o CLI entrega o RESULTADO
 * pelo stdout/exit code; o arquivo so alimenta o poll do servidor).
 * Escrita atomica (tmp + rename, S-8) — o poll nunca le pela metade.
 */
function escreverEstado(caminho: string | undefined, estado: EstadoDoJob): void {
  if (caminho === undefined) return;
  try {
    const tmp = `${caminho}.tmp`;
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(estado)}\n`, "utf-8");
    renameSync(tmp, caminho);
  } catch (erro) {
    console.error(`(estado nao gravado em ${caminho}: ${String(erro)})`);
  }
}

// ─── Envelope de erro (stderr) ────────────────────────────────────────────────

/** O envelope de erro do CLI — o shape do envelope HTTP da api.md. */
function envelopeDeErro(codigo: string, mensagem: string, detalhes?: string[]): string {
  return `${JSON.stringify({ erro: { codigo, mensagem, ...(detalhes !== undefined ? { detalhes } : {}) } })}\n`;
}

/** O codigo estavel do envelope, derivado do tipo do erro. */
function codigoDoErro(erro: unknown): string {
  if (erro instanceof ErroPreviewVisualNaoProduzivel) return "preview-visual-nao-produzivel";
  if (erro instanceof ErroPreviewManimIndisponivel) return "preview-manim-indisponivel";
  if (erro instanceof ErroContratoRoteiro) return "roteiro-invalido";
  if (erro instanceof ErroReduzirManifesto) return "reducao-impossivel";
  if (erro instanceof ErroAnexoAusente) return "anexo-exigido-para-gif-video";
  if (erro instanceof ErroDuracaoInsuficiente) return "duracao-insuficiente";
  if (erro instanceof ErroPreviewFormatoDivergente) return "preview-formato-divergente";
  if (erro instanceof ErroPreviewVazio) return "preview-vazio";
  if (erro instanceof ErroPreviewRender) return "preview-render-falhou";
  return "falha-interna";
}

/** Exit code do erro: 2 = entrada/estado (400/409), 1 = interno (500). */
function exitCodeDoErro(erro: unknown): number {
  if (
    erro instanceof ErroPreviewVisualNaoProduzivel ||
    erro instanceof ErroPreviewManimIndisponivel ||
    erro instanceof ErroContratoRoteiro ||
    erro instanceof ErroReduzirManifesto ||
    erro instanceof ErroAnexoAusente ||
    erro instanceof ErroDuracaoInsuficiente ||
    erro instanceof ErroPreviewFormatoDivergente
  ) {
    return 2;
  }
  return 1;
}

// ─── Entrada ──────────────────────────────────────────────────────────────────

/** O pedido aceito pelo CLI (a forma documentada no cabecalho). */
export interface PedidoDoPreviewCli {
  readonly roteiro: Roteiro;
  readonly indice_pedaco: number;
  readonly opcoes?: {
    /** Raiz do store de conteudo (anexo + audio gravado por hash). */
    readonly store_raiz?: string;
    /** Raiz do cache de render C7 (default: /tmp/ai-video-maker/render-cache). */
    readonly cache_raiz?: string;
    /** Raiz dos mp4 finais (default: <raiz>/.cache/roteiro/previews). */
    readonly previews_raiz?: string;
    /** Raiz do memo da resolucao manim (default: <raiz>/.cache/roteiro/preview/resolucao). */
    readonly resolucao_raiz?: string;
  };
}

function extrairArgumento(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--estado") {
      return argv[i + 1];
    }
  }
  return undefined;
}

/** O erro de entrada: JSON invalido ou pedido fora do shape. */
function entradaInvalida(erro: unknown): string {
  return `entrada invalida: ${erro instanceof Error ? erro.message : String(erro)} — ` +
    'envie {"roteiro": Roteiro, "indice_pedaco": number, "opcoes"?: {...}} em stdin';
}

// ─── Execucao ─────────────────────────────────────────────────────────────────

/** Executa o preview — a parte testavel sem processo. */
export async function executarPreview(pedido: PedidoDoPreviewCli): Promise<{
  hash: string;
  caminho: string;
  duracao_segundos: number;
}> {
  const resultado = await renderizarPreviewPedaco(pedido.roteiro, pedido.indice_pedaco, {
    storeRaiz: pedido.opcoes?.store_raiz,
    cacheRaiz: pedido.opcoes?.cache_raiz,
    previewsRaiz: pedido.opcoes?.previews_raiz,
    resolucaoRaiz: pedido.opcoes?.resolucao_raiz,
  });
  return {
    hash: resultado.hash,
    caminho: resultado.caminho,
    duracao_segundos: resultado.duracaoSegundos,
  };
}

async function principal(): Promise<void> {
  const caminhoEstado = extrairArgumento(process.argv) ?? process.env.ROTEIRO_ESTADO_PATH;

  let pedido: PedidoDoPreviewCli;
  try {
    const bruto = readFileSync(0, "utf-8");
    if (bruto.trim() === "") {
      throw new Error("stdin vazio");
    }
    const parseado = JSON.parse(bruto) as Partial<PedidoDoPreviewCli>;
    if (parseado.roteiro === undefined || typeof parseado.indice_pedaco !== "number") {
      throw new Error("campos obrigatorios ausentes: roteiro, indice_pedaco");
    }
    pedido = { roteiro: parseado.roteiro, indice_pedaco: parseado.indice_pedaco, ...(parseado.opcoes !== undefined ? { opcoes: parseado.opcoes } : {}) };
  } catch (erro) {
    const mensagem = entradaInvalida(erro);
    escreverEstado(caminhoEstado, { estado: "erro", progresso: 0, mensagem, erro: mensagem });
    process.stderr.write(envelopeDeErro("entrada-invalida", mensagem));
    process.exitCode = 2;
    return;
  }

  try {
    escreverEstado(caminhoEstado, { estado: "rodando", progresso: 0.05, mensagem: "validando pedaco e reduzindo manifesto" });
    const final = await executarPreview(pedido);
    escreverEstado(caminhoEstado, { estado: "ok", progresso: 1, mensagem: "preview pronto" });
    process.stdout.write(
      `${JSON.stringify({
        hash: final.hash,
        caminho: final.caminho,
        duracao_segundos: final.duracao_segundos,
      })}\n`,
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const codigo = codigoDoErro(erro);
    const detalhes =
      erro instanceof ErroContratoRoteiro
        ? (erro as ErroContratoRoteiro & { problemas?: string[] }).problemas
        : undefined;
    escreverEstado(caminhoEstado, { estado: "erro", progresso: 0, mensagem, erro: mensagem });
    process.stderr.write(envelopeDeErro(codigo, mensagem, detalhes));
    process.exitCode = exitCodeDoErro(erro);
  }
}

// Executa quando chamado como CLI (tsx src/roteiro/preview/cli.ts) — e
// inerte quando importado por teste.
if (process.argv[1]?.endsWith("cli.ts")) {
  void principal();
}
