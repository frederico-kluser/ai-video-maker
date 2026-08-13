/**
 * tests/autoria/helpers.ts
 *
 * Ajudantes da suite de autoria (card F4-04, W6) — fora de
 * tests/autoria/contrato/ (que e do F4-01 e nao muda; contrato-w6 §1).
 *
 * O ponto que esta suite existe para provar: o CASSETE de autoria — o
 * registro do caminho de chamada do executor — existe, esta gravado
 * contra a fixture canonica (contrato-w6 §12) e carrega os manifestos
 * INVALIDOS gravados (∅-crit: so os bons nao testa nada).
 *
 * A chave do cassete e computada aqui da MESMA forma que o executor
 * (componentesDoCassete + chaveDoCasseteAutoria): a suite e o replay
 * usam os mesmos arquivos de entrada que a cerimonia de gravacao
 * (brief canonico, prompt de F4-02, schema podado). Qualquer mudanca em
 * qualquer componente troca a chave e a suite fica VERMELHA por
 * ECasseteAutoriaAusente — nunca um resultado velho servido em silencio
 * (C12).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Manifesto } from "src/contratos/manifesto.js";
import { hashDoManifesto } from "src/resolucao/contrato.js";
import {
  RAIZ_CASSETES_PADRAO,
  chaveDoCasseteAutoria,
  componentesDoCassete,
  diretorioDoCasseteAutoria,
  lerCasseteAutoria,
} from "src/autoria/executor/cassete.js";
import type { CasseteAutoria } from "src/autoria/executor/cassete.js";
import { montarEntrada } from "src/autoria/executor/executor.js";
import type { BriefAutoria } from "src/autoria/executor/contrato.js";
import { MODELO_PADRAO } from "src/autoria/executor/contrato.js";
import type { ProvedorAutoria } from "src/autoria/executor/contrato.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Raiz do repositorio, resolvida a partir deste arquivo. */
export const RAIZ = resolve(__dirname, "..", "..");

/** Raiz dos cassetes (a mesma do F2-01). */
export function raizCassetes(): string {
  return RAIZ_CASSETES_PADRAO;
}

/** A fixture canonica — o manifesto contra o qual o cassete grava. */
export const CAMINHO_MANIFESTO_CANONICO = resolve(
  RAIZ,
  "fixtures",
  "canonico",
  "manifesto-valido.json",
);

/** O brief canonico da autoria (entrada da cerimonia de gravacao). */
export const CAMINHO_BRIEF_CANONICO = resolve(
  RAIZ,
  "fixtures",
  "cassetes",
  "autoria",
  "brief-canonico.json",
);

/** A fonte dos manifestos invalidos (consumida so pela gravacao). */
export const CAMINHO_INVALIDOS_FONTE = resolve(
  RAIZ,
  "fixtures",
  "cassetes",
  "autoria",
  "invalidos-fonte.json",
);

/** Le um JSON do disco. */
export function lerJson<T>(caminho: string): T {
  return JSON.parse(readFileSync(caminho, "utf-8")) as T;
}

/** A fixture canonica, tipada. */
export function manifestoCanonico(): Manifesto {
  return lerJson<Manifesto>(CAMINHO_MANIFESTO_CANONICO);
}

/** O brief canonico da autoria, tipado. */
export function briefCanonico(): BriefAutoria {
  return lerJson<BriefAutoria>(CAMINHO_BRIEF_CANONICO);
}

/** Os manifestos invalidos da fonte de gravacao. */
export function invalidosDaFonte(): Array<{ id: string; motivo: string; documento: unknown }> {
  return lerJson<Array<{ id: string; motivo: string; documento: unknown }>>(
    CAMINHO_INVALIDOS_FONTE,
  );
}

/** O texto do prompt de F4-02 (sem a linha de versao do front-matter). */
export function textoDoPrompt(): string {
  const conteudo = readFileSync(
    resolve(RAIZ, "docs", "autoria", "prompts", "prompt-autoria-principal.md"),
    "utf-8",
  );
  const linhas = conteudo.split("\n");
  const semVersao = /^versao:\s*\S/.test(linhas[0] ?? "") ? linhas.slice(1) : linhas;
  const primeiroNaoVazio = semVersao.findIndex((l) => l.trim() !== "");
  return (primeiroNaoVazio >= 0 ? semVersao.slice(primeiroNaoVazio) : semVersao)
    .join("\n")
    .trim();
}

/**
 * A chave do cassete de autoria para um provedor — a MESMA conta que o
 * executor faz em producao (entrada canonica + componentes + hash).
 */
export function chaveDoCassete(provedor: ProvedorAutoria): string {
  const entrada = montarEntrada(provedor, briefCanonico(), {});
  const componentes = componentesDoCassete(entrada, provedor, 4096, manifestoCanonico());
  return chaveDoCasseteAutoria(componentes);
}

/** O diretorio do cassete de um provedor. */
export function diretorioDoCassete(provedor: ProvedorAutoria): string {
  return diretorioDoCasseteAutoria(RAIZ_CASSETES_PADRAO, chaveDoCassete(provedor));
}

/** Le o cassete de um provedor do disco (lanca ECasseteAutoriaAusente/Invalido). */
export function lerCassete(provedor: ProvedorAutoria): CasseteAutoria {
  return lerCasseteAutoria(RAIZ_CASSETES_PADRAO, chaveDoCassete(provedor));
}

/** Hash do manifesto canonico (o que entra na chave do cassete). */
export function hashDoManifestoCanonico(): string {
  return hashDoManifesto(manifestoCanonico());
}

/** O modelo padrao do executor por provedor. */
export function modeloPadrao(provedor: ProvedorAutoria): string {
  return MODELO_PADRAO[provedor];
}
