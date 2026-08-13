/**
 * tests/integracao/resolucao/helpers.ts
 *
 * Ajudantes da suite integrada F2-07.
 *
 * O ponto que esta suite existe para provar: os CINCO estagios da W4
 * (locucao, grafico, midia, codigo, musica) rodam de verdade, offline, a
 * partir dos cassetes commitados, com a rede bloqueada em todas as
 * camadas. Para isso cada estagio precisa do manifesto contra o qual o
 * cassete DELE foi gravado — e a W4 gravou contra TRES manifestos
 * distintos (ledger AB-500):
 *
 *   locucao, codigo, musica  → fixtures/canonico/manifesto-valido.json
 *   grafico                  → src/resolucao/grafico/manifesto-de-gravacao.ts
 *   midia                    → fixtures/cassetes/midia/manifesto-de-gravacao.json
 *
 * A chave de cache do cassete e funcao do hash do manifesto: usar o
 * manifesto errado e cache miss, e cache miss em offline e
 * ECasseteAusente (∅-crit) — nunca um resultado errado servido em
 * silencio.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Manifesto } from "src/contratos/manifesto.js";
import { hashDoManifesto } from "src/resolucao/contrato.js";
import { RAIZ_CASSETES_PADRAO } from "src/resolucao/cassete/formato.js";
import { MANIFESTO_DE_GRAVACAO } from "../../../src/resolucao/grafico/manifesto-de-gravacao.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Raiz do repositorio, resolvida a partir deste arquivo. */
export const RAIZ = resolve(__dirname, "..", "..", "..");

/** A fixture canonica — o manifesto de gravacao de locucao, codigo e musica. */
export const CAMINHO_MANIFESTO_CANONICO = resolve(
  RAIZ,
  "fixtures",
  "canonico",
  "manifesto-valido.json",
);

/** O manifesto de gravacao do estagio de midia (fica ao lado do cassete). */
export const CAMINHO_MANIFESTO_MIDIA = resolve(
  RAIZ,
  RAIZ_CASSETES_PADRAO,
  "midia",
  "manifesto-de-gravacao.json",
);

/** Le um manifesto JSON do disco. */
export function lerManifesto(caminho: string): Manifesto {
  return JSON.parse(readFileSync(caminho, "utf-8")) as Manifesto;
}

/** A fixture canonica, tipada. */
export function manifestoCanonico(): Manifesto {
  return lerManifesto(CAMINHO_MANIFESTO_CANONICO);
}

/** O manifesto de gravacao de midia, tipado. */
export function manifestoMidia(): Manifesto {
  return lerManifesto(CAMINHO_MANIFESTO_MIDIA);
}

/**
 * Manifestos de gravacao por estagio — a tabela que a W4 deixou.
 *
 * `grafico` mantem o manifesto DELE no codigo (leitura de um arquivo de
 * outro card: permitido, estagios sao so-leitura para este card); os
 * demais leem do disco. Presenca de cada estagio e per-item: nunca
 * asserte a lista completa dos cinco como unica prova (contrato-w5 §10).
 */
export function manifestoDeGravacao(nome: string): Manifesto {
  switch (nome) {
    case "grafico":
      return MANIFESTO_DE_GRAVACAO;
    case "midia":
      return manifestoMidia();
    default:
      return manifestoCanonico();
  }
}

/** Hash canonico do manifesto (o que entra na chave de cache). */
export function hashDe(nome: string): string {
  return hashDoManifesto(manifestoDeGravacao(nome));
}

/** Raiz dos cassetes, relativa a raiz do repositorio (para o orquestrador). */
export function raizCassetesRelativa(): string {
  return RAIZ_CASSETES_PADRAO;
}
