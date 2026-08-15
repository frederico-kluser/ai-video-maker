/**
 * src/roteiro/construir/cli.ts
 *
 * CLI D11 do CONSTRUTOR DE MANIFESTO — a convencao de CLIs de operacao
 * pesada de docs/roteiro/api.md §"CLIs de operacao pesada":
 *
 *   - entrada: JSON em stdin;
 *   - saida:   JSON em stdout, so em sucesso (exit 0);
 *   - erro:    exit != 0 com a mensagem em stderr;
 *   - progresso: arquivo de estado por `--estado <path>` ou env
 *     `ROTEIRO_ESTADO_PATH`, reescrito (JSON de JobStatus sem id/artefato)
 *     a medida que avanca — escrita atomica (tmp + rename, S-8).
 *
 * Entradas aceitas (o servidor da Onda 4 escolhe a forma):
 *
 *   { "roteiro": Roteiro, "opcoes"?: OpcoesConstruirManifesto }
 *       -> constroi o Manifesto.1 completo (stdout: { "manifesto": ... })
 *
 *   { "roteiro": Roteiro, "opcoes"?: ..., "indice_pedaco": number }
 *       -> constroi e REDUZ ao pedaco do indice (o preview da Onda 4
 *          usa exatamente esta forma: um job por pedaco)
 *
 *   { "manifesto": Manifesto, "indice_pedaco": number }
 *       -> reduz um manifesto ja construido (reuso entre jobs de preview
 *          do mesmo roteiro — o preview nao reimplementa reduzirManifesto)
 *
 * Nenhuma rede, nenhum disco alem do arquivo de estado: operacao pura
 * sobre o JSON de entrada (C7 — mídia entra por caminho/hash, nunca aqui).
 */

import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Manifesto } from "../../contratos/manifesto.js";
import type { Roteiro } from "../contrato/contrato.js";
import {
  construirManifesto,
  reduzirManifesto,
  type OpcoesConstruirManifesto,
} from "./construir.js";
import { validarManifestoConstruido } from "./validar.js";

// ─── Estado (JobStatus sem id/artefato — docs/roteiro/api.md) ────────────────

interface EstadoDoJob {
  estado: "pendente" | "rodando" | "ok" | "erro";
  progresso: number | null;
  mensagem?: string;
  erro?: string | null;
}

/**
 * Escreve o arquivo de estado (best-effort: o CLI entrega o RESULTADO pelo
 * stdout/exit code; o arquivo so alimenta o poll do servidor). Escrita
 * atomica (tmp + rename, S-8) — o poll nunca le o arquivo pela metade.
 */
function escreverEstado(caminho: string | undefined, estado: EstadoDoJob): void {
  if (caminho === undefined) return;
  try {
    const tmp = `${caminho}.tmp`;
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(estado)}\n`, "utf-8");
    renameSync(tmp, caminho);
  } catch (erro) {
    // Best-effort documentado: falha de estado nao muda o resultado da
    // operacao — o stderr carrega o erro real.
    console.error(`(estado nao gravado em ${caminho}: ${String(erro)})`);
  }
}

// ─── Entrada ──────────────────────────────────────────────────────────────────

/** O pedido aceito pelo CLI (a uniao documentada no cabecalho). */
interface PedidoDoConstrutor {
  readonly roteiro?: Roteiro;
  readonly manifesto?: Manifesto;
  readonly opcoes?: OpcoesConstruirManifesto;
  readonly indice_pedaco?: number;
}

function extrairArgumento(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--estado") {
      return argv[i + 1];
    }
  }
  return undefined;
}

// ─── Execucao ─────────────────────────────────────────────────────────────────

function executar(pedido: PedidoDoConstrutor): Manifesto {
  const temRoteiro = pedido.roteiro !== undefined;
  const temManifesto = pedido.manifesto !== undefined;
  const temIndice = pedido.indice_pedaco !== undefined;

  if (temRoteiro && temManifesto) {
    throw new Error(
      "pedido-invalido: envie OU roteiro (construir) OU manifesto (reduzir), nunca os dois",
    );
  }
  if (temManifesto) {
    // Reducao de um manifesto ja construido: valida a entrada antes de
    // reduzir (fail-closed — manifesto invalido e erro nomeado, nunca
    // reduzido em silencio).
    const validacao = validarManifestoConstruido(pedido.manifesto);
    if (!validacao.valido) {
      throw new Error(`manifesto invalido contra o schema oficial:\n- ${validacao.problemas.join("\n- ")}`);
    }
    if (!temIndice) {
      throw new Error("pedido-invalido: manifesto exige indice_pedaco (a reducao e por pedaco)");
    }
    return reduzirManifesto(pedido.manifesto, pedido.indice_pedaco as number);
  }
  if (temRoteiro) {
    const completo = construirManifesto(pedido.roteiro, pedido.opcoes ?? {});
    if (temIndice) {
      return reduzirManifesto(completo, pedido.indice_pedaco as number);
    }
    return completo;
  }
  throw new Error("pedido-invalido: campo roteiro ou manifesto obrigatorio");
}

function principal(): void {
  const caminhoEstado = extrairArgumento(process.argv) ?? process.env.ROTEIRO_ESTADO_PATH;
  let pedido: PedidoDoConstrutor;
  try {
    const bruto = readFileSync(0, "utf-8");
    if (bruto.trim() === "") {
      throw new Error("pedido-invalido: stdin vazio — envie o JSON do pedido");
    }
    pedido = JSON.parse(bruto) as PedidoDoConstrutor;
  } catch (erro) {
    const mensagem = `entrada invalida: ${erro instanceof Error ? erro.message : String(erro)}`;
    escreverEstado(caminhoEstado, { estado: "erro", progresso: 0, mensagem, erro: mensagem });
    console.error(mensagem);
    process.exitCode = 1;
    return;
  }

  try {
    escreverEstado(caminhoEstado, { estado: "rodando", progresso: 0.1, mensagem: "construindo manifesto" });
    const manifesto = executar(pedido);
    escreverEstado(caminhoEstado, { estado: "ok", progresso: 1, mensagem: "manifesto pronto" });
    process.stdout.write(`${JSON.stringify({ manifesto })}\n`);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    escreverEstado(caminhoEstado, { estado: "erro", progresso: 0, mensagem, erro: mensagem });
    console.error(mensagem);
    process.exitCode = 1;
  }
}

// Executa quando chamado como CLI (tsx src/roteiro/construir/cli.ts) — e
// inerte quando importado por teste, que prefere testar executar() direto.
if (process.argv[1]?.endsWith("cli.ts")) {
  principal();
}
