// =============================================================================
// DESCOBERTA DE NOS — varredura do disco por convencao
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// Convencao (AGENTS.md, Regra 6 — descoberta por convencao, nunca registro
// central escrito a mao):
//
//   src/composicao/nos/<tipo>.tsx
//     export const meta: NoComponentMeta   // tipo, schema, id, descricao
//     export default: NoComponent          // o componente
//
// A descoberta NAO ignora arquivo que nao casa o contrato. Um arquivo que
// esta no diretorio e nao implementa o contrato e um ERRO — a alternativa
// (pular em silencio) e exatamente o falso verde que este projeto persegue:
// o componente some do video e nenhum gate acusa.
//
// Este modulo LE DISCO e por isso vive na fronteira de REGISTRO, nao na de
// RENDER. O caminho de render usa src/composicao/registro.ts, que nao toca
// disco nenhum. Ver docs/adr/0006-composicao-raiz.md.
// =============================================================================

import { readdirSync, existsSync, statSync } from "node:fs";
import { resolve, basename, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  validarModuloDeNo,
  type ModuloDeNo,
  type NoComponentMeta,
  type NoComponent,
} from "./contrato-de-no";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Diretorio canonico dos componentes de no. */
export const DIRETORIO_DE_NOS = resolve(AQUI, "nos");

/** Extensoes consideradas modulo de no. */
const EXTENSOES = new Set([".tsx", ".ts"]);

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Um no encontrado no disco e ja validado contra o contrato. */
export interface NoDescoberto {
  /** Caminho absoluto do arquivo do componente */
  caminho: string;
  /** Tipo derivado do nome do arquivo (a convencao) */
  tipoDoArquivo: string;
  /** Metadados exportados pelo proprio modulo */
  meta: NoComponentMeta;
  /** O componente exportado como default */
  componente: NoComponent;
}

/** Catalogo imutavel do que foi descoberto. */
export interface CatalogoDeNos {
  /** Ordenado por tipo — a ordem e deterministica */
  todos: readonly NoDescoberto[];
  porTipo: ReadonlyMap<string, NoDescoberto>;
  porId: ReadonlyMap<string, NoDescoberto>;
}

/** Erro de descoberta: agrega TODOS os problemas antes de estourar. */
export class ErroDeDescoberta extends Error {
  readonly erros: readonly string[];
  constructor(diretorio: string, erros: readonly string[]) {
    super(
      `Descoberta de nos falhou em ${diretorio} (${erros.length} erro(s)):\n` +
        erros.map((e) => `  - ${e}`).join("\n"),
    );
    this.name = "ErroDeDescoberta";
    this.erros = erros;
  }
}

// ---------------------------------------------------------------------------
// Varredura
// ---------------------------------------------------------------------------

/**
 * Lista os arquivos de componente de um diretorio, em ordem deterministica.
 * Ignora somente o que nao e candidato a componente: subdiretorios,
 * arquivos ocultos e arquivos com prefixo `_` (auxiliares por convencao).
 * Qualquer outro arquivo .ts/.tsx e candidato — e sera cobrado pelo contrato.
 */
export function varrerDiretorio(diretorio: string = DIRETORIO_DE_NOS): string[] {
  if (!existsSync(diretorio)) {
    return [];
  }

  return readdirSync(diretorio)
    .filter((arquivo) => EXTENSOES.has(extname(arquivo)))
    .filter((arquivo) => !arquivo.startsWith("_") && !arquivo.startsWith("."))
    .map((arquivo) => resolve(diretorio, arquivo))
    .filter((caminho) => statSync(caminho).isFile())
    .sort();
}

/**
 * Extrai o tipo de no do nome do arquivo.
 * Convencao: `<tipo>.tsx` -> `<tipo>`.
 */
export function tipoDoCaminho(caminho: string): string {
  return basename(caminho, extname(caminho));
}

// ---------------------------------------------------------------------------
// Descoberta
// ---------------------------------------------------------------------------

async function carregarModulo(caminho: string): Promise<unknown> {
  const url = pathToFileURL(caminho).href;
  return (await import(/* @vite-ignore */ url)) as unknown;
}

/**
 * Varre o disco, importa cada modulo, valida contra o contrato e devolve
 * o catalogo. LANCA `ErroDeDescoberta` se qualquer arquivo:
 *
 * - nao exportar `meta` valido
 * - nao exportar `default` como componente
 * - declarar tipo que nao existe no schema
 * - declarar tipo diferente do nome do arquivo
 * - repetir um `meta.id` ja usado por outro arquivo
 * - repetir um `meta.tipo` ja usado por outro arquivo
 *
 * Um diretorio vazio NAO e erro aqui (o gate de composicao e que exige
 * cobertura dos tipos); um arquivo torto SEMPRE e.
 */
export async function descobrirNos(
  diretorio: string = DIRETORIO_DE_NOS,
): Promise<CatalogoDeNos> {
  const caminhos = varrerDiretorio(diretorio);
  const erros: string[] = [];
  const descobertos: NoDescoberto[] = [];

  for (const caminho of caminhos) {
    const tipoDoArquivo = tipoDoCaminho(caminho);
    let modulo: unknown;

    try {
      modulo = await carregarModulo(caminho);
    } catch (causa) {
      erros.push(
        `${caminho}: falhou ao importar — ${
          causa instanceof Error ? causa.message : String(causa)
        }`,
      );
      continue;
    }

    const validado: { modulo: ModuloDeNo | null; erros: string[] } =
      validarModuloDeNo(modulo, tipoDoArquivo, caminho);

    if (validado.modulo === null) {
      erros.push(...validado.erros);
      continue;
    }

    descobertos.push({
      caminho,
      tipoDoArquivo,
      meta: validado.modulo.meta,
      componente: validado.modulo.componente,
    });
  }

  // --- Unicidade: id e tipo sao chaves; colisao e erro, nao "ultimo vence" ---
  const porTipo = new Map<string, NoDescoberto>();
  const porId = new Map<string, NoDescoberto>();

  for (const no of descobertos) {
    const jaTipo = porTipo.get(no.meta.tipo);
    if (jaTipo) {
      erros.push(
        `tipo duplicado "${no.meta.tipo}": ${jaTipo.caminho} e ${no.caminho}`,
      );
    } else {
      porTipo.set(no.meta.tipo, no);
    }

    const jaId = porId.get(no.meta.id);
    if (jaId) {
      erros.push(`id duplicado "${no.meta.id}": ${jaId.caminho} e ${no.caminho}`);
    } else {
      porId.set(no.meta.id, no);
    }
  }

  if (erros.length > 0) {
    throw new ErroDeDescoberta(diretorio, erros);
  }

  descobertos.sort((a, b) => (a.meta.tipo < b.meta.tipo ? -1 : 1));

  return {
    todos: Object.freeze(descobertos),
    porTipo,
    porId,
  };
}

/** Lista os tipos descobertos, em ordem deterministica. */
export async function listarTiposDescobertos(
  diretorio: string = DIRETORIO_DE_NOS,
): Promise<string[]> {
  const catalogo = await descobrirNos(diretorio);
  return catalogo.todos.map((n) => n.meta.tipo).sort();
}
