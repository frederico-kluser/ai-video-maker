#!/usr/bin/env npx tsx
/**
 * tools/musica/gravar.ts — card F2-06
 *
 * Grava o cassete do estagio `musica`. Roda A MAO, COM REDE, fora de
 * qualquer suite. Nenhum gate chama este arquivo: `just res-musica` e
 * `just res-offline --estagio musica` rodam com a rede bloqueada e leem
 * o que este comando deixou no disco.
 *
 * Por que a gravacao e manual e nao automatica: gravar significa sair
 * para a rede e baixar ~1,2 MB de audio de um fornecedor externo. Um
 * gate que gravasse sozinho transformaria `npm test` numa rodada
 * silenciosa de download — e, pior, esconderia a quebra do cassete:
 * regravar automaticamente e o mesmo que nunca detectar que o
 * fornecedor mudou o conteudo sob a mesma URL (C7).
 *
 * Uso:
 *   npx tsx tools/musica/gravar.ts [--manifesto <caminho>] [--raiz <dir>]
 *                                  [--pausa <ms>]
 *
 * `--pausa` controla a cortesia entre downloads (default: PAUSA_PADRAO_MS).
 * O fornecedor devolveu 429 numa rajada de requisicoes durante o
 * desenvolvimento deste card; quando o bucket do IP estiver apertado
 * (outros agentes da W4 batem no mesmo provedor), aumente o intervalo.
 * A pausa NAO entra na chave de cache: ela nao muda um byte do resultado.
 */

import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gravarCassete } from "../../src/resolucao/cassete/gravador.js";
import { RAIZ_CASSETES_PADRAO } from "../../src/resolucao/cassete/formato.js";
import { PAUSA_PADRAO_MS, criarEstagioMusica } from "../../src/resolucao/musica/estagio.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";

const MANIFESTO_PADRAO = "fixtures/canonico/manifesto-valido.json";

function argumento(nome: string, padrao: string): string {
  const i = process.argv.indexOf(nome);
  const valor = i >= 0 ? process.argv[i + 1] : undefined;
  return valor ?? padrao;
}

function argumentoNumero(nome: string, padrao: number): number {
  const i = process.argv.indexOf(nome);
  const valor = i >= 0 ? Number(process.argv[i + 1]) : Number.NaN;
  return Number.isFinite(valor) && valor >= 0 ? valor : padrao;
}

async function main(): Promise<number> {
  const caminhoManifesto = argumento("--manifesto", MANIFESTO_PADRAO);
  const raiz = argumento("--raiz", RAIZ_CASSETES_PADRAO);
  const pausaMs = argumentoNumero("--pausa", PAUSA_PADRAO_MS);

  const manifesto = JSON.parse(await readFile(caminhoManifesto, "utf-8")) as Manifesto;

  console.log("=== F2-06: gravando o cassete de `musica` (COM REDE) ===");
  console.log(`Manifesto: ${caminhoManifesto} (${manifesto.nos.length} nos)`);
  console.log(`Raiz:      ${raiz}`);
  console.log("");

  const trabalho = await mkdtemp(join(tmpdir(), "musica-gravacao-"));
  try {
    const estagio = criarEstagioMusica({ pausaEntreDownloadsMs: pausaMs });
    const resultado = await gravarCassete(estagio, {
      raiz,
      manifesto,
      diretorioTrabalho: trabalho,
    });

    console.log(`  chave:     ${resultado.chave}`);
    console.log(`  diretorio: ${resultado.diretorio}`);
    console.log(`  chamadas:  ${resultado.quantidadeChamadas}`);
    console.log("");
    console.log("=== VERDE: cassete gravado ===");
    console.log("Agora rode, com a rede bloqueada:");
    console.log("  bash tools/resolucao/offline.sh --estagio musica");
    console.log("  npx tsx tools/musica/verificar.ts");
    return 0;
  } finally {
    await rm(trabalho, { recursive: true, force: true });
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("gravar: FALHOU:", erro);
    process.exit(1);
  },
);
