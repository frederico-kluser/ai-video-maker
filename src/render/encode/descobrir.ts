/**
 * src/render/encode/descobrir.ts
 *
 * DESCOBERTA DOS PERFIS POR CONVENCAO (AGENTS.md, Regra 6): perfis de
 * encode sao descobertos pelo caminho e nome no disco — nao existe
 * registro central.
 *
 *   src/render/encode/perfis/<nome>.ts
 *     export default: PerfilEncode
 *
 * A descoberta NAO ignora arquivo que nao casa o contrato (a mesma
 * disciplina do `src/composicao/descoberta.ts`): um arquivo no diretorio
 * com um perfil invalido e um ERRO — pular em silencio e o falso verde
 * em que o perfil some do pipeline e nenhum gate acusa.
 *
 * E o ∅-crit do PROGRAMA em forma executavel: `listarPerfis()` valida
 * TODO perfil descoberto, e um perfil SEM ALVO DE QUALIDADE DECLARADO
 * lancado daqui derruba o gate `encode-perfis`.
 */

import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  EPerfilInvalido,
  validarPerfil,
  type PerfilEncode,
} from "./formato.js";

const AQUI = dirname(fileURLToPath(import.meta.url));

/** O diretorio canonico dos perfis de encode. */
export const DIRETORIO_DE_PERFIS = resolve(AQUI, "perfis");

/** Um perfil descoberto no disco, ja validado. */
export interface PerfilDescoberto {
  /** Caminho absoluto do arquivo do perfil. */
  caminho: string;
  /** O perfil validado. */
  perfil: PerfilEncode;
}

/**
 * Lista e valida todos os perfis do diretorio canonico.
 *
 * Lanca `EPerfilInvalido` no primeiro arquivo invalido (incluindo o
 * ∅-crit: perfil sem alvo de qualidade). O vazio nunca e resultado
 * legitimo de "nenhum perfil" sem erro: diretorio ausente e erro.
 */
export async function listarPerfis(): Promise<PerfilDescoberto[]> {
  const arquivos = readdirSync(DIRETORIO_DE_PERFIS).filter((f) =>
    f.endsWith(".ts"),
  );
  const descobertos: PerfilDescoberto[] = [];
  for (const arquivo of arquivos.sort()) {
    const caminho = resolve(DIRETORIO_DE_PERFIS, arquivo);
    const modulo = (await import(pathToFileURL(caminho).href)) as {
      default?: unknown;
    };
    const bruto = modulo.default;
    const erros = validarPerfil(bruto);
    if (erros.length > 0) {
      throw new EPerfilInvalido(arquivo, erros);
    }
    descobertos.push({ caminho, perfil: bruto as PerfilEncode });
  }
  return descobertos;
}
