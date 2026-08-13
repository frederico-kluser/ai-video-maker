/**
 * src/autoria/executor/prompt.ts
 *
 * O prompt do executor — FONTE UNICA em F4-02, lida no momento da
 * chamada, nunca copiada.
 *
 * A biblioteca de prompts e do card F4-02 (docs/autoria/prompts/**, W5,
 * fechado). O executor a CONSUME: a chamada real carrega
 * `prompt-autoria-principal.md` do disco, tira a linha de versao do
 * front-matter (o ∅-crit do F4-02 exige `^versao:` como primeira linha)
 * e usa o resto como prompt de sistema. Consequencia C12 de proposito:
 * o texto do prompt entra na entrada de cache, entao QUALQUER mudanca
 * no prompt de F4-02 troca a chave, troca o diretorio do cassete e o
 * replay offline vira miss — nunca um resultado velho servido em
 * silencio para um prompt novo.
 *
 * Offline (suite), o caminho e hermetico: o texto do prompt vem da
 * ENTRADA gravada no cassete, nao do disco. O disco so e lido pelo
 * default de producao.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BriefAutoria } from "./contrato.js";

/** Caminho padrao do prompt principal (biblioteca de F4-02). */
export const CAMINHO_PROMPT_PRINCIPAL_PADRAO = resolve(
  process.cwd(),
  "docs",
  "autoria",
  "prompts",
  "prompt-autoria-principal.md",
);

/** Erro: o prompt de F4-02 nao pode ser carregado. */
export class EPromptAusente extends Error {
  constructor(caminho: string, detalhe?: string) {
    super(
      `Prompt principal de autoria nao carregado: ${caminho}\n` +
        `  O executor consome a biblioteca de prompts do F4-02 (fonte unica).\n` +
        (detalhe ? `  detalhe: ${detalhe}\n` : "") +
        `  Rode a partir da raiz do repositorio (just autoria-gravar).`,
    );
    this.name = "EPromptAusente";
  }
}

/**
 * Remove o front-matter da biblioteca de F4-02: a primeira linha
 * (`versao: X.Y.Z` — ∅-crit do F4-02) e a linha em branco que a segue.
 * Tudo o mais e o prompt.
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

/** Carrega o prompt principal do disco (default: biblioteca de F4-02). */
export function carregarPromptPrincipal(caminho?: string): string {
  const alvo = caminho ?? CAMINHO_PROMPT_PRINCIPAL_PADRAO;
  let conteudo: string;
  try {
    conteudo = readFileSync(alvo, "utf-8");
  } catch (erro) {
    throw new EPromptAusente(alvo, (erro as Error).message);
  }
  const texto = extrairTextoDoPrompt(conteudo);
  if (texto.length === 0) {
    throw new EPromptAusente(alvo, "arquivo vazio apos o front-matter");
  }
  return texto;
}

/**
 * Monta as mensagens da chamada a partir do brief.
 *
 * O brief e a entrada declarada do prompt principal de F4-02 (campos
 * com ausencia permitida); a serializacao e canonica para que o hash de
 * cache nao dependa da ordem de escrita do objeto (llm-authoring:
 * canonicalize com chaves ordenadas).
 */
export function montarMensagens(brief: BriefAutoria): unknown[] {
  const canonicas = (objeto: Record<string, unknown>): Record<string, unknown> => {
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(objeto).sort()) {
      const v = objeto[chave];
      if (v === undefined) continue;
      saida[chave] = v;
    }
    return saida;
  };
  return [
    {
      role: "user",
      content: `Brief:\n${JSON.stringify(canonicas(brief as unknown as Record<string, unknown>), null, 2)}`,
    },
  ];
}
