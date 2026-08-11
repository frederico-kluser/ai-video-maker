/**
 * src/resolucao/descoberta.ts
 *
 * Descoberta de estagios por convencao (AGENTS.md Regra 6: nunca
 * registro central).
 *
 * A convencao, em uma linha:
 *
 *   src/resolucao/<nome>/estagio.ts  →  export default EstagioResolucao
 *
 * O arquivo `estagio.ts` E o registro. Um diretorio de infraestrutura
 * (`cassete/`, `rede/`) nao tem `estagio.ts` e por isso nao e confundido
 * com estagio — sem precisar de lista de excecoes que alguem esquece de
 * atualizar.
 *
 * Por que isto vive num arquivo proprio e nao dentro do orquestrador:
 * o ∅-crit do card e "um estagio sem cassete tem de derrubar
 * `just res:offline`, e nao ser pulado em silencio". Para isso ser
 * verdade, alguem tem de olhar o DISCO — nao a lista de estagios que
 * alguem lembrou de passar para o orquestrador. Uma lista passada a mao
 * nunca contem o estagio que voce esqueceu; o diretorio, sim.
 *
 * Ordem das checagens, e ela importa:
 *   1. o diretorio tem cassete?  nao → ECasseteAusente
 *   2. o nome e canonico?        nao → EEstagioDesconhecido
 *
 * Cassete primeiro de proposito: um estagio novo, ainda sem nome
 * canonico, falha pela razao mais util ("nao tem cassete") antes de
 * falhar pela mais burocratica.
 */

import { readdir, access } from "node:fs/promises";
import { join } from "node:path";
import { ehNomeEstagio, ORDEM_ESTAGIOS } from "./contrato.js";
import type { NomeEstagio } from "./contrato.js";
import { ARQUIVOS_OBRIGATORIOS, diretorioDoEstagio } from "./cassete/formato.js";
import { ECasseteAusente } from "./cassete/formato.js";

// ─── Constantes ─────────────────────────────────────────────────────────────────

/** Raiz onde os estagios sao procurados. */
export const RAIZ_ESTAGIOS_PADRAO = "src/resolucao";

/** O arquivo cuja presenca marca um diretorio como estagio. */
export const ARQUIVO_MARCADOR = "estagio.ts";

// ─── Tipos ──────────────────────────────────────────────────────────────────────

/** Um estagio encontrado no disco. */
export interface EstagioDescoberto {
  /** Nome do diretorio — que e o nome do estagio. */
  readonly nome: string;
  /** Caminho do `estagio.ts`. */
  readonly arquivo: string;
  /** Se o nome esta na lista canonica de cinco. */
  readonly canonico: boolean;
}

/** Cobertura de cassetes de um estagio. */
export interface CoberturaEstagio {
  readonly nome: string;
  readonly arquivo: string;
  /** Chaves de cassete encontradas para este estagio. */
  readonly chaves: readonly string[];
  /** Problemas que derrubam a suite. Vazio = coberto. */
  readonly problemas: readonly string[];
}

/** Relatorio completo de cobertura. */
export interface RelatorioCobertura {
  /** Estagios encontrados no disco. Denominador explicito. */
  readonly descobertos: readonly EstagioDescoberto[];
  /** Cobertura por estagio. */
  readonly cobertura: readonly CoberturaEstagio[];
  /** Estagios canonicos ainda nao entregues (informativo, nao erro). */
  readonly aindaNaoEntregues: readonly NomeEstagio[];
  /** Se tudo que existe esta coberto. */
  readonly ok: boolean;
}

// ─── Erros ──────────────────────────────────────────────────────────────────────

/** Um diretorio de estagio com nome fora da lista canonica. */
export class EEstagioDesconhecido extends Error {
  readonly code = "ESTAGIO_DESCONHECIDO";
  constructor(nome: string, arquivo: string) {
    super(
      `Estagio desconhecido: "${nome}" (${arquivo}).\n` +
        `  Nomes canonicos: ${ORDEM_ESTAGIOS.join(", ")}.\n` +
        `  Um estagio fora da lista nao e ignorado: ou ele entra no contrato\n` +
        `  (src/resolucao/contrato.ts, tipo NomeEstagio, + ADR), ou ele nao existe.`,
    );
    this.name = "EEstagioDesconhecido";
  }
}

// ─── Descoberta ─────────────────────────────────────────────────────────────────

async function existe(caminho: string): Promise<boolean> {
  try {
    await access(caminho);
    return true;
  } catch {
    return false;
  }
}

/**
 * Varre a raiz procurando diretorios que contenham `estagio.ts`.
 *
 * @param raiz diretorio onde procurar (default: `src/resolucao`).
 */
export async function descobrirEstagios(
  raiz: string = RAIZ_ESTAGIOS_PADRAO,
): Promise<EstagioDescoberto[]> {
  let entradas;
  try {
    entradas = await readdir(raiz, { withFileTypes: true });
  } catch {
    return [];
  }

  const encontrados: EstagioDescoberto[] = [];
  for (const entrada of entradas) {
    if (!entrada.isDirectory()) continue;
    if (entrada.name.startsWith(".") || entrada.name.startsWith("_")) continue;
    const arquivo = join(raiz, entrada.name, ARQUIVO_MARCADOR);
    if (!(await existe(arquivo))) continue;
    encontrados.push({
      nome: entrada.name,
      arquivo,
      canonico: ehNomeEstagio(entrada.name),
    });
  }
  return encontrados.sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
}

// ─── Cobertura ──────────────────────────────────────────────────────────────────

/**
 * Verifica que todo estagio no disco tem pelo menos um cassete valido.
 *
 * Nao "avisa": devolve problemas, e quem chama transforma em vermelho.
 * `just res:offline` chama isto e falha se `ok === false`.
 */
export async function verificarCobertura(opcoes: {
  readonly raizEstagios?: string;
  readonly raizCassetes: string;
  /** Restringe a checagem a um estagio (`just res:offline --estagio X`). */
  readonly apenasEstagio?: string;
}): Promise<RelatorioCobertura> {
  const raizEstagios = opcoes.raizEstagios ?? RAIZ_ESTAGIOS_PADRAO;
  let descobertos = await descobrirEstagios(raizEstagios);
  if (opcoes.apenasEstagio !== undefined) {
    descobertos = descobertos.filter((e) => e.nome === opcoes.apenasEstagio);
  }

  const cobertura: CoberturaEstagio[] = [];

  for (const estagio of descobertos) {
    const problemas: string[] = [];
    const dirEstagio = diretorioDoEstagio(opcoes.raizCassetes, estagio.nome);
    const chaves = await listarChaves(dirEstagio);

    if (chaves.length === 0) {
      problemas.push(
        new ECasseteAusente(
          estagio.nome,
          "(qualquer)",
          dirEstagio,
          "nenhum cassete gravado para este estagio",
        ).message,
      );
    }

    for (const chave of chaves) {
      const dirCassete = join(dirEstagio, chave);
      for (const arquivo of ARQUIVOS_OBRIGATORIOS) {
        if (!(await existe(join(dirCassete, arquivo)))) {
          problemas.push(
            `cassete ${estagio.nome}/${chave.slice(0, 16)}… sem ${arquivo} ` +
              `(arquivo obrigatorio)`,
          );
        }
      }
    }

    if (!estagio.canonico) {
      problemas.push(new EEstagioDesconhecido(estagio.nome, estagio.arquivo).message);
    }

    cobertura.push({
      nome: estagio.nome,
      arquivo: estagio.arquivo,
      chaves,
      problemas,
    });
  }

  const nomesDescobertos = new Set(descobertos.map((e) => e.nome));
  const aindaNaoEntregues = ORDEM_ESTAGIOS.filter((n) => !nomesDescobertos.has(n));

  return {
    descobertos,
    cobertura,
    aindaNaoEntregues,
    ok: cobertura.every((c) => c.problemas.length === 0),
  };
}

async function listarChaves(dirEstagio: string): Promise<string[]> {
  try {
    const entradas = await readdir(dirEstagio, { withFileTypes: true });
    return entradas
      .filter((e) => e.isDirectory() && /^[0-9a-f]{64}$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// ─── Relatorio ──────────────────────────────────────────────────────────────────

/**
 * Renderiza o relatorio de cobertura.
 *
 * Imprime o DENOMINADOR sempre — "0 estagios descobertos" e uma
 * informacao, "nenhum problema" sozinho e uma armadilha (C2: filtro que
 * nao casa nada sai verde).
 */
export function formatarCobertura(relatorio: RelatorioCobertura): string {
  const linhas: string[] = [];
  linhas.push(
    `Estagios descobertos em disco: ${relatorio.descobertos.length}` +
      (relatorio.descobertos.length === 0
        ? " — nenhum estagio implementado ainda (W4 entrega F2-02..F2-06)"
        : ` (${relatorio.descobertos.map((e) => e.nome).join(", ")})`),
  );
  if (relatorio.aindaNaoEntregues.length > 0) {
    linhas.push(
      `Estagios canonicos pendentes: ${relatorio.aindaNaoEntregues.join(", ")}`,
    );
  }
  for (const c of relatorio.cobertura) {
    if (c.problemas.length === 0) {
      linhas.push(`  [OK] ${c.nome} — ${c.chaves.length} cassete(s)`);
    } else {
      linhas.push(`  [FALHOU] ${c.nome}`);
      for (const p of c.problemas) {
        for (const linha of p.split("\n")) linhas.push(`      ${linha}`);
      }
    }
  }
  linhas.push(relatorio.ok ? "Cobertura: OK" : "Cobertura: FALHOU");
  return linhas.join("\n");
}
