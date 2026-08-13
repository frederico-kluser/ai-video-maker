// =============================================================================
// F1-06 — grava os snapshots do no `lista` num diretorio
// =============================================================================
// Uso:
//   npx tsx tools/no-lista/gravar.ts <diretorio>
//
// `just no-lista-snapshot` grava por cima do diretorio aprovado e depois exige
// `git diff --exit-code` E `git status --porcelain` limpos: o primeiro pega o
// snapshot que mudou, o segundo pega o snapshot que NASCEU e nunca foi
// rastreado (AGENTS.md C3 — `git diff` nao enxerga arquivo nao rastreado).
//
// `just no-lista-determinismo` grava em dois diretorios temporarios, em dois
// processos diferentes, e compara byte a byte.
// =============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { CASOS } from "./casos.js";
import { markupDoCaso, planoDoCaso } from "./render.js";

const destino = process.argv[2];
if (destino === undefined || destino.length === 0) {
  console.error("uso: npx tsx tools/no-lista/gravar.ts <diretorio>");
  process.exit(2);
}

const dir = resolve(destino);
mkdirSync(dir, { recursive: true });

for (const caso of CASOS) {
  writeFileSync(resolve(dir, `${caso.nome}.html`), markupDoCaso(caso), "utf-8");
  writeFileSync(resolve(dir, `${caso.nome}.json`), planoDoCaso(caso), "utf-8");
  console.log(`  ${caso.nome} — ${caso.descricao}`);
}

console.log(`${String(CASOS.length)} caso(s) gravado(s) em ${dir}`);
