/**
 * src/resolucao/codigo/manifesto-de-gravacao.ts
 *
 * O manifesto contra o qual o cassete deste card e gravado.
 *
 * Um so lugar, importado pela gravacao E pelo gate. Se a gravacao e a
 * verificacao carregassem manifestos diferentes, a chave calculada pelo
 * gate nao bateria com o diretorio gravado e a falha diria "cassete
 * ausente" — culpando o cassete por um defeito da ferramenta.
 *
 * A fonte e a fixture canonica do repositorio, nao um manifesto
 * inventado aqui: o no `n-008` dela e TypeScript com JSX, comentario
 * nenhum, `linhas_destaque` fora de ordem util e um `nome_arquivo`. E o
 * caso que o video real vai ter.
 *
 * A fixture e lida do disco em vez de embutida em codigo de proposito.
 * Uma copia embutida congelaria em silencio quando a canonica mudasse, e
 * o cassete passaria a testar um manifesto que nao existe mais — o
 * PREP-w4 acabou de corrigir dois numeros dessa mesma fixture.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Manifesto } from "../../contratos/manifesto.js";

/** Caminho da fixture canonica, relativo a raiz do repositorio. */
export const CAMINHO_DO_MANIFESTO = "fixtures/canonico/manifesto-valido.json";

/**
 * Carrega a fixture canonica.
 *
 * `raizRepositorio` existe para o teste, que roda com o cwd do vitest.
 * Sem parametro, resolve a partir do cwd — que e como as receitas do
 * `just` e o `res-offline` chamam.
 */
export function carregarManifestoDeGravacao(raizRepositorio = "."): Manifesto {
  const caminho = resolve(raizRepositorio, CAMINHO_DO_MANIFESTO);
  return JSON.parse(readFileSync(caminho, "utf-8")) as Manifesto;
}
