#!/usr/bin/env npx tsx
/**
 * src/resolucao/codigo/gravar.ts
 *
 * Grava o cassete deste estagio. `just res-codigo-gravar`.
 *
 * Duas etapas, nesta ordem:
 *   1. `gravarCassete()` do F2-01 — valida a procedencia ANTES de tocar
 *      o disco, varre credencial e escreve os cinco arquivos canonicos;
 *   2. os artefatos de destaque, em `<cassete>/artefatos/<sha256>.json`.
 *
 * Diferente dos outros quatro estagios da W4, este comando NAO precisa
 * de rede nem de credencial: ele so tokeniza texto que ja esta no
 * manifesto. Roda em qualquer maquina, inclusive dentro do namespace
 * fechado do `res-offline` — o que e a forma mais curta de dizer o que o
 * card entrega.
 *
 * A gravacao apaga e reescreve o diretorio da chave. Chave diferente =
 * diretorio diferente: cassete de versao antiga nao e sobrescrito, fica
 * orfao. `--limpar` remove os orfaos do estagio.
 *
 * Uso:
 *   npx tsx src/resolucao/codigo/gravar.ts [--limpar]
 */

import { readdir, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gravarCassete } from "../cassete/gravador.js";
import {
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  diretorioDoEstagio,
} from "../cassete/formato.js";
import estagio, { computarArtefatos } from "./estagio.js";
import { escreverArtefatos } from "./artefatos.js";
import { carregarManifestoDeGravacao } from "./manifesto-de-gravacao.js";

const NOME = "codigo";

async function main(): Promise<number> {
  const limpar = process.argv.includes("--limpar");
  const manifesto = carregarManifestoDeGravacao();

  console.log("=== res-codigo-gravar — cassete do estagio de destaque ===");
  console.log(`Estagio: ${estagio.identidade.nome} v${estagio.identidade.versao}`);
  console.log("");

  const trabalho = await mkdtemp(join(tmpdir(), "res-codigo-"));
  try {
    const resultado = await gravarCassete(estagio, {
      raiz: RAIZ_CASSETES_PADRAO,
      manifesto,
      diretorioTrabalho: trabalho,
    });

    const artefatos = computarArtefatos(manifesto);
    const escritos = await escreverArtefatos(resultado.diretorio, artefatos);

    console.log(`Chave:     ${resultado.chave}`);
    console.log(`Diretorio: ${resultado.diretorio}`);
    console.log(`Chamadas de rede gravadas: ${resultado.quantidadeChamadas}`);
    console.log(`Artefatos: ${escritos.length}`);
    for (const artefato of artefatos) {
      console.log(
        `  ${artefato.no} -> ${artefato.hash.slice(0, 16)}… ` +
          `(${artefato.tokens.linhas.length} linha(s), ${artefato.tokens.gramatica})`,
      );
    }

    if (limpar) {
      const dirEstagio = diretorioDoEstagio(RAIZ_CASSETES_PADRAO, NOME);
      const entradas = await readdir(dirEstagio, { withFileTypes: true });
      for (const entrada of entradas) {
        if (!entrada.isDirectory()) continue;
        if (entrada.name === resultado.chave) continue;
        if (!/^[0-9a-f]{64}$/.test(entrada.name)) continue;
        await rm(diretorioDoCassete(RAIZ_CASSETES_PADRAO, NOME, entrada.name), {
          recursive: true,
          force: true,
        });
        console.log(`  orfao removido: ${entrada.name.slice(0, 16)}…`);
      }
    }

    console.log("");
    console.log("=== gravado ===");
    return 0;
  } finally {
    await rm(trabalho, { recursive: true, force: true });
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("res-codigo-gravar: erro inesperado:", erro);
    process.exit(2);
  },
);
