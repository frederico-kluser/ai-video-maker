#!/usr/bin/env npx tsx
/**
 * src/resolucao/midia/relatorio.ts
 *
 * Imprime a decisao de hotlink e a evidencia que a sustenta, e sai 1 se
 * a decisao estiver violada.
 *
 *   npx tsx src/resolucao/midia/relatorio.ts
 *
 * Existe porque um ADR que ninguem executa envelhece calado. Aqui a
 * politica de cada provedor, com citacao e data, e impressa toda vez que
 * `just res-midia` roda — e a invariante ("quem exige hotlink nao tem
 * adaptador") e verificada, nao afirmada.
 */

import {
  ADAPTADORES,
  adaptadorDe,
  violacoesDaDecisaoDeHotlink,
} from "./adaptadores.js";
import { POLITICAS_DE_PROVEDOR, ehElegivel } from "./politicas.js";

function main(): number {
  console.log("=== F2-04: decisao de hotlink (docs/adr/0013-hotlink-e-midia-externa.md) ===");
  console.log("");
  console.log("DECISAO: baixar e re-hospedar por hash. Hotlink nunca.");
  console.log("         Provedor que EXIGE hotlink e inelegivel — por arquitetura,");
  console.log("         nao por licenca. Ver o ADR para as tres razoes.");
  console.log("");
  console.log(`Provedores com politica declarada: ${POLITICAS_DE_PROVEDOR.length}`);
  console.log(`Adaptadores implementados:         ${ADAPTADORES.length} ` +
    `(${ADAPTADORES.map((a) => a.provedor).join(", ") || "nenhum"})`);
  console.log("");

  for (const politica of POLITICAS_DE_PROVEDOR) {
    const elegivel = ehElegivel(politica);
    const temAdaptador = adaptadorDe(politica.provedor) !== undefined;
    const marca = elegivel ? "ELEGIVEL " : "INELEGIVEL";
    console.log(
      `[${marca}] ${politica.provedor.padEnd(18)} hotlink=${politica.politicaHotlink.padEnd(12)} ` +
        `adaptador=${temAdaptador ? "sim" : "nao"}  fonte=${politica.fonteDaObrigacao}`,
    );
    console.log(`             doc: ${politica.documento} (consultado em ${politica.consultadoEm})`);
    console.log(`             "${politica.citacao.slice(0, 150)}${politica.citacao.length > 150 ? "…" : ""}"`);
    if (politica.ressalva !== undefined) {
      console.log(`             ressalva: ${politica.ressalva.slice(0, 150)}`);
    }
    console.log("");
  }

  const violacoes = violacoesDaDecisaoDeHotlink();
  if (violacoes.length > 0) {
    console.log("=== VERMELHO: a decisao de hotlink esta violada ===");
    for (const v of violacoes) console.log(`  ${v}`);
    return 1;
  }

  console.log(
    "=== VERDE: nenhum provedor que exige hotlink tem adaptador implementado ===",
  );
  console.log(
    "    A barreira nao e um 'if': e a ausencia de codigo capaz de baixar deles.",
  );
  return 0;
}

process.exit(main());
