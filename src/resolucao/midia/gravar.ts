#!/usr/bin/env npx tsx
/**
 * src/resolucao/midia/gravar.ts
 *
 * Grava o cassete do estagio de midia. RODA A MAO, COM REDE — nunca
 * dentro da suite (docs/contrato-estagio-resolucao.md, secao 6).
 *
 *   npx tsx src/resolucao/midia/gravar.ts
 *
 * O manifesto gravado e `fixtures/cassetes/midia/manifesto-de-gravacao.json`,
 * ao lado do cassete que ele produziu. Ele fica ali, e nao num diretorio
 * de fixture generico, por dois motivos:
 *
 *   - a chave do cassete e funcao do hash deste manifesto; guardar os
 *     dois juntos torna a chave conferivel a mao;
 *   - `verificarCobertura` so enxerga diretorios com nome de 64 hex, e
 *     um arquivo solto ali e ignorado por construcao.
 *
 * Por que este manifesto e nao `fixtures/canonico/manifesto-valido.json`:
 * a fixture canonica tem tres nos de midia, e dois deles este estagio
 * NAO resolve — `n-006` e video (fora dos tipos suportados) e `n-007`
 * nao tem `texto_alternativo` (sem termo de busca). Isso nao e um
 * contorno: e uma assercao do teste offline, que exige o erro nomeado
 * `EMidiaNaoResolvivel` com os dois nos citados. Ver ledger AB-433/434.
 */

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gravarCassete } from "../cassete/gravador.js";
import { RAIZ_CASSETES_PADRAO } from "../cassete/formato.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import estagio from "./estagio.js";

/** Manifesto usado na gravacao. Fica ao lado do cassete. */
export const CAMINHO_MANIFESTO = join(
  RAIZ_CASSETES_PADRAO,
  "midia",
  "manifesto-de-gravacao.json",
);

/** Le o manifesto de gravacao do disco. */
export async function lerManifestoDeGravacao(
  caminho: string = CAMINHO_MANIFESTO,
): Promise<Manifesto> {
  return JSON.parse(await readFile(caminho, "utf-8")) as Manifesto;
}

async function main(): Promise<number> {
  const manifesto = await lerManifestoDeGravacao();
  const trabalho = await mkdtemp(join(tmpdir(), "gravar-midia-"));

  console.log("=== gravacao do cassete de midia (COM REDE, a mao) ===");
  console.log(`Estagio:   ${estagio.identidade.nome} v${estagio.identidade.versao}`);
  console.log(`Provedor:  ${String(estagio.parametros.provedor)}`);
  console.log(`Aquisicao: ${String(estagio.parametros.modoDeAquisicao)}`);
  console.log(`Manifesto: ${CAMINHO_MANIFESTO}`);
  console.log("");

  const resultado = await gravarCassete(estagio, {
    raiz: RAIZ_CASSETES_PADRAO,
    manifesto,
    diretorioTrabalho: trabalho,
  });

  console.log(`chave:     ${resultado.chave}`);
  console.log(`diretorio: ${resultado.diretorio}`);
  console.log(`chamadas:  ${resultado.quantidadeChamadas}`);
  console.log("");
  console.log("Confira antes de commitar:");
  console.log("  - procedencia.json tem 'licenca' no topo e em cada asset");
  console.log("  - chamadas.json nao tem credencial (este provedor nao usa nenhuma)");
  console.log("  - corpos/ tem o corpo bruto, com o HTML e a string 'true' do provedor");
  return 0;
}

// So executa quando chamado direto, nunca quando importado por um teste.
if (process.argv[1] !== undefined && process.argv[1].endsWith("gravar.ts")) {
  main().then(
    (codigo) => process.exit(codigo),
    (erro: unknown) => {
      console.error("gravar midia: falhou:", erro);
      process.exit(1);
    },
  );
}
