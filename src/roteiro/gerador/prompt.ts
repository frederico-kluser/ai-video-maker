/**
 * src/roteiro/gerador/prompt.ts
 *
 * A construcao dos prompts do gerador de roteiro — FONTE UNICA na
 * biblioteca de prompts (docs/roteiro/prompts/), lida do disco no
 * momento da chamada, nunca copiada (a mesma disciplina do executor de
 * autoria: src/autoria/executor/prompt.ts).
 *
 * Composicao de UM prompt (o provedor recebe uma string so):
 *
 *   <texto estatico do prompt-roteirista-principal.md (ou regenerar)>
 *
 *   <MARCADOR_BRIEF>
 *   <JSON canonico do bloco {brief, duracao_alvo_segundos}>
 *
 * Na regeneracao o bloco volatil e mais rico e vem ANTES do brief:
 *
 *   <texto estatico do prompt-regenerar-pedaco.md>
 *
 *   <MARCADOR_PEDACO_ALVO>
 *   <JSON canonico do pedaco_atual (com edicoes do usuario)>
 *
 *   <MARCADOR_IRMAOS>
 *   <resumo_demais_pedacos — ja canonico por construcao>
 *
 *   <MARCADOR_BRIEF>
 *   <JSON canonico do bloco {brief, duracao_alvo_segundos}>
 *
 * Os marcadores existem para o provedor LLM poder separar o texto
 * ESTAVEL (system — candidato a prompt cache) do bloco VOLATIL
 * (user message): llm-authoring — estavel primeiro, volatil depois do
 * ultimo breakpoint. O texto do prompt inteiro entra na chave do store
 * do cache (src/roteiro/gerador/cache.ts): qualquer edicao na
 * biblioteca de prompts = MISS (C12), nunca resultado velho para prompt
 * novo.
 *
 * Determinismo: o bloco volatil e serializado com chaves ordenadas
 * (canonicalizar do contrato) para que o hash de cache nao dependa da
 * ordem de escrita do objeto.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalizar } from "../contrato/canonicalizar.js";
import type {
  BriefRoteiro,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
} from "../contrato/contrato.js";

/** Caminho padrao do prompt principal (biblioteca de prompts do roteiro). */
export const CAMINHO_PROMPT_ROTEIRISTA_PADRAO = resolve(
  process.cwd(),
  "docs",
  "roteiro",
  "prompts",
  "prompt-roteirista-principal.md",
);

/** Caminho padrao do prompt de regeneracao de pedaco. */
export const CAMINHO_PROMPT_REGENERAR_PADRAO = resolve(
  process.cwd(),
  "docs",
  "roteiro",
  "prompts",
  "prompt-regenerar-pedaco.md",
);

/** Marcador que separa o texto estavel do bloco volatil (brief). */
export const MARCADOR_BRIEF = "## BRIEF DO VIDEO";

/** Marcador do pedaco alvo na regeneracao. */
export const MARCADOR_PEDACO_ALVO = "## PEDACO ALVO";

/** Marcador do resumo dos irmaos na regeneracao. */
export const MARCADOR_IRMAOS = "## RESUMO DOS IRMAOS";

/** Erro: a biblioteca de prompts do roteiro nao pode ser carregada. */
export class EPromptRoteiroAusente extends Error {
  constructor(caminho: string, detalhe?: string) {
    super(
      `Prompt do gerador de roteiro nao carregado: ${caminho}\n` +
        `  O gerador consome a biblioteca de prompts (docs/roteiro/prompts/, fonte unica).\n` +
        (detalhe ? `  detalhe: ${detalhe}\n` : "") +
        `  Rode a partir da raiz do repositorio.`,
    );
    this.name = "EPromptRoteiroAusente";
  }
}

/**
 * Remove o front-matter da biblioteca: a primeira linha (`versao:
 * X.Y.Z` — convencao dos prompts de autoria) e a linha em branco que a
 * segue. Tudo o mais e o prompt.
 */
export function extrairTextoDoPrompt(conteudo: string): string {
  const linhas = conteudo.split("\n");
  const semVersao = /^versao:\s*\S/.test(linhas[0] ?? "")
    ? linhas.slice(1)
    : linhas;
  const primeiroNaoVazio = semVersao.findIndex((l) => l.trim() !== "");
  return (primeiroNaoVazio >= 0 ? semVersao.slice(primeiroNaoVazio) : semVersao)
    .join("\n")
    .trim();
}

/** Carrega um prompt da biblioteca do disco (default: prompt principal). */
export function carregarPrompt(caminho?: string, padrao?: string): string {
  const alvo = caminho ?? padrao;
  if (alvo === undefined) {
    throw new EPromptRoteiroAusente("(sem caminho)");
  }
  let conteudo: string;
  try {
    conteudo = readFileSync(alvo, "utf-8");
  } catch (erro) {
    throw new EPromptRoteiroAusente(alvo, (erro as Error).message);
  }
  const texto = extrairTextoDoPrompt(conteudo);
  if (texto.length === 0) {
    throw new EPromptRoteiroAusente(alvo, "arquivo vazio apos o front-matter");
  }
  return texto;
}

/** Serializa o bloco volatil com chaves ordenadas (canonicalizar ja devolve a string canonica). */
function serializarBloco(valor: unknown): string {
  return canonicalizar(valor);
}

/** O bloco volatil compartilhado: brief + duracao efetiva. */
function blocoDoBrief(pedido: { readonly brief: BriefRoteiro; readonly duracao_alvo_segundos?: number }): string {
  return [
    MARCADOR_BRIEF,
    serializarBloco({
      brief: pedido.brief,
      duracao_alvo_segundos: pedido.duracao_alvo_segundos,
    }),
  ].join("\n");
}

/**
 * Monta o prompt da geracao COMPLETA do roteiro.
 *
 * @param caminhoPromptRoteirista caminho alternativo da biblioteca
 *   (testes); default: prompt-roteirista-principal.md.
 */
export function montarPromptRoteiro(
  pedido: PedidoGerarRoteiro,
  caminhoPromptRoteirista?: string,
): string {
  const texto = carregarPrompt(caminhoPromptRoteirista, CAMINHO_PROMPT_ROTEIRISTA_PADRAO);
  return [texto, blocoDoBrief(pedido)].join("\n\n");
}

/**
 * Monta o prompt da regeneracao de UM pedaco: alvo (com edicoes),
 * irmaos (resumo canonico) e brief. O resumo ja vem canonico do
 * contrato (resumoDePedacos) — entra como veio.
 */
export function montarPromptRegenerar(
  pedido: PedidoRegenerarPedaco,
  caminhoPromptRegenerar?: string,
): string {
  const texto = carregarPrompt(caminhoPromptRegenerar, CAMINHO_PROMPT_REGENERAR_PADRAO);
  return [
    texto,
    [MARCADOR_PEDACO_ALVO, serializarBloco(pedido.pedaco_atual)].join("\n"),
    [MARCADOR_IRMAOS, pedido.resumo_demais_pedacos].join("\n"),
    blocoDoBrief(pedido),
  ].join("\n\n");
}

// ─── Extracoes para o SOSIA (determinismo sem LLM) ──────────────────────────

/**
 * Extrai o bloco JSON apos um marcador do prompt composto. Usado pelo
 * provedor sosia para derivar fala/detalhes do TEMA real do brief (e nao
 * so do hash do prompt). Devolve undefined quando o marcador ou o JSON
 * nao estao presentes — o sosia tem fallback deterministico.
 */
export function extrairBlocoDoPrompt(prompt: string, marcador: string): unknown {
  const indice = prompt.indexOf(marcador);
  if (indice < 0) {
    return undefined;
  }
  const depoisDoMarcador = prompt.slice(indice + marcador.length);
  const inicio = depoisDoMarcador.indexOf("{");
  if (inicio < 0) {
    return undefined;
  }
  // Corta no ultimo "}" do bloco: o prompt pode continuar apos o JSON.
  const fim = depoisDoMarcador.lastIndexOf("}");
  if (fim <= inicio) {
    return undefined;
  }
  try {
    return JSON.parse(depoisDoMarcador.slice(inicio, fim + 1)) as unknown;
  } catch {
    return undefined;
  }
}

/** O tema do brief dentro do prompt composto (fallback: undefined). */
export function extrairTemaDoPrompt(prompt: string): string | undefined {
  const bloco = extrairBlocoDoPrompt(prompt, MARCADOR_BRIEF);
  const brief = (bloco as { brief?: { tema?: unknown } } | undefined)?.brief;
  const tema = brief?.tema;
  return typeof tema === "string" && tema.length > 0 ? tema : undefined;
}

/** A duracao alvo efetiva dentro do prompt composto (fallback: undefined). */
export function extrairDuracaoDoPrompt(prompt: string): number | undefined {
  const bloco = extrairBlocoDoPrompt(prompt, MARCADOR_BRIEF);
  const duracao = (bloco as { duracao_alvo_segundos?: unknown } | undefined)
    ?.duracao_alvo_segundos;
  return typeof duracao === "number" && duracao > 0 ? duracao : undefined;
}
