/**
 * src/resolucao/codigo/artefatos.ts
 *
 * Onde os BYTES do destaque ficam.
 *
 * O contrato de estagio (F2-01) devolve `parcial` + `procedencia`, e
 * mais nada. `parcial.nos_codigo[<no>]` e um SHA-256 — um ENDERECO. O
 * contrato nao tem campo por onde devolver o CONTEUDO enderecado, e o
 * orquestrador so sabe anexar procedencia a um asset que ja esteja no
 * store (`persistirNoStore` pula o que nao acha). Ou seja: quem produz
 * bytes tem de resolver sozinho onde eles moram. Item de ledger AB-455.
 *
 * A escolha deste card: os bytes vao para dentro do proprio cassete, em
 * `<cassete>/artefatos/<sha256>.json`.
 *
 * Por que nao o store (`.cache/store`): o store e `.gitignore`. Um
 * clone limpo teria o cassete e nao teria o conteudo, e `res-offline`
 * passaria assim mesmo — porque a cobertura so olha os quatro arquivos
 * obrigatorios. Verde num repositorio onde o video nao pode ser
 * montado e exatamente o falso-verde que este projeto persegue.
 *
 * Por que dentro do cassete: o cassete ja E a fonte de verdade offline,
 * ja e versionado, e ja e diffado byte a byte por `res-cassete`. Um
 * artefato que entra nele herda essas tres propriedades de graca.
 *
 * O nome do arquivo e o hash, e a leitura CONFERE o hash. Endereco de
 * conteudo que ninguem verifica e so um nome de arquivo comprido (C7).
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../cassete/formato.js";
import { FORMATO_TOKENS_DE_DESTAQUE } from "./tokens-de-destaque.js";
import type { TokensDeDestaque } from "./tokens-de-destaque.js";
import type { ArtefatoDeCodigo } from "./estagio.js";

/** Subdiretorio dos artefatos dentro de um cassete. */
export const DIRETORIO_ARTEFATOS = "artefatos";

/** Erro de artefato ausente, corrompido ou com formato incompativel. */
export class EArtefatoInvalido extends Error {
  readonly code = "ARTEFATO_INVALIDO";
  constructor(caminho: string, motivo: string) {
    super(
      `Artefato de destaque invalido em ${caminho}: ${motivo}\n` +
        `  Regrave o cassete: npx tsx src/resolucao/codigo/gravar.ts`,
    );
    this.name = "EArtefatoInvalido";
  }
}

/** Caminho de um artefato dentro de um diretorio de cassete. */
export function caminhoDoArtefato(dirCassete: string, hash: string): string {
  return join(dirCassete, DIRETORIO_ARTEFATOS, `${hash}.json`);
}

/** Escreve todos os artefatos de uma gravacao. Idempotente por hash. */
export async function escreverArtefatos(
  dirCassete: string,
  artefatos: readonly ArtefatoDeCodigo[],
): Promise<string[]> {
  if (artefatos.length === 0) return [];
  await mkdir(join(dirCassete, DIRETORIO_ARTEFATOS), { recursive: true });
  const escritos: string[] = [];
  for (const artefato of [...artefatos].sort((a, b) =>
    a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0,
  )) {
    const caminho = caminhoDoArtefato(dirCassete, artefato.hash);
    await writeFile(caminho, artefato.bytes, "utf-8");
    escritos.push(caminho);
  }
  return escritos;
}

/**
 * Le um artefato e CONFERE o endereco.
 *
 * Tres checagens, nesta ordem, e nenhuma e opcional:
 *   1. o arquivo existe;
 *   2. o SHA-256 do conteudo bate com o nome — senao o endereco mente;
 *   3. `formato` e o que este codigo sabe ler — senao um artefato de
 *      versao futura seria lido como se fosse desta, campo a campo, e
 *      os campos que faltassem virariam `undefined` silencioso.
 */
export async function lerArtefato(
  dirCassete: string,
  hash: string,
): Promise<TokensDeDestaque> {
  const caminho = caminhoDoArtefato(dirCassete, hash);
  let bruto: string;
  try {
    bruto = await readFile(caminho, "utf-8");
  } catch {
    throw new EArtefatoInvalido(caminho, "arquivo ausente");
  }

  const real = sha256(bruto);
  if (real !== hash) {
    throw new EArtefatoInvalido(
      caminho,
      `o conteudo hasheia ${real.slice(0, 16)}… e o nome diz ${hash.slice(0, 16)}…`,
    );
  }

  let dados: unknown;
  try {
    dados = JSON.parse(bruto);
  } catch (erro) {
    throw new EArtefatoInvalido(caminho, `JSON invalido: ${(erro as Error).message}`);
  }

  const tokens = dados as TokensDeDestaque;
  if (tokens.formato !== FORMATO_TOKENS_DE_DESTAQUE) {
    throw new EArtefatoInvalido(
      caminho,
      `formato "${String(tokens.formato)}" — este codigo le "${FORMATO_TOKENS_DE_DESTAQUE}"`,
    );
  }
  return tokens;
}

/** Hashes dos artefatos presentes num cassete, em ordem estavel. */
export async function listarArtefatos(dirCassete: string): Promise<string[]> {
  try {
    const entradas = await readdir(join(dirCassete, DIRETORIO_ARTEFATOS));
    return entradas
      .filter((n) => /^[0-9a-f]{64}\.json$/.test(n))
      .map((n) => n.slice(0, 64))
      .sort();
  } catch {
    return [];
  }
}
