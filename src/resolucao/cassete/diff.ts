/**
 * src/resolucao/cassete/diff.ts
 *
 * Diff de cassetes — o oraculo de `just res:cassete`.
 *
 * A regra, escrita de forma que nao de para fugir dela:
 *
 *   Regravar um cassete tem de reproduzir cada byte. Uma diferenca so e
 *   aceitavel se estiver em CAMPOS_VOLATEIS, que e uma lista curta,
 *   fechada e citada por nome. Qualquer outra diferenca REFUTA o
 *   determinismo do estagio, e refutacao nao tem grau: e vermelho.
 *
 * O erro classico que este arquivo evita: comparar "ignorando
 * timestamps" com um regex frouxo. Um regex que come todo numero longo
 * come tambem o hash que mudou, e o diff passa a dizer "igual" para
 * cassetes que divergem no conteudo. Aqui a mascara e por caminho
 * explicito (`arquivo#/campo`), nunca por forma do valor.
 *
 * O diff tambem e testado ao contrario (sonda negativa): `res:cassete`
 * muta um byte do resultado e EXIGE que o diff fique vermelho. Um diff
 * que nunca ficou vermelho nao e evidencia de nada.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { CAMPOS_VOLATEIS } from "./formato.js";

// ─── Tipos ──────────────────────────────────────────────────────────────────────

/** Classificacao de uma diferenca entre dois cassetes. */
export type Veredito = "IDENTICO" | "EXPLICADA" | "REFUTA";

/** Uma diferenca encontrada. */
export interface Diferenca {
  readonly veredito: Exclude<Veredito, "IDENTICO">;
  /** Caminho relativo do arquivo dentro do cassete. */
  readonly arquivo: string;
  /** Ponteiro JSON dentro do arquivo, quando aplicavel. */
  readonly campo?: string;
  /** Descricao curta. */
  readonly detalhe: string;
  /** Valor no cassete A. */
  readonly antes?: string;
  /** Valor no cassete B. */
  readonly depois?: string;
}

/** Resultado da comparacao de dois cassetes. */
export interface ResultadoDiff {
  readonly veredito: Veredito;
  readonly diferencas: readonly Diferenca[];
  /** Arquivos comparados. Denominador: sem ele, "zero diferencas" e vazio. */
  readonly arquivosComparados: readonly string[];
  /** Quantas diferencas refutam o determinismo. */
  readonly refutacoes: number;
  /** Quantas diferencas estao na lista de volateis declarados. */
  readonly explicadas: number;
}

// ─── Mascara de volateis ────────────────────────────────────────────────────────

interface Mascara {
  readonly arquivo: string;
  readonly campo: string;
}

const MASCARAS: readonly Mascara[] = CAMPOS_VOLATEIS.map((entrada) => {
  const [arquivo, ponteiro] = entrada.split("#");
  return {
    arquivo: arquivo ?? "",
    campo: (ponteiro ?? "/*").replace(/^\//, ""),
  };
});

/** Se `arquivo#campo` esta na lista fechada de volateis declarados. */
export function ehVolatil(arquivo: string, campo: string): boolean {
  return MASCARAS.some(
    (m) =>
      m.arquivo === arquivo && (m.campo === "*" || m.campo === campo),
  );
}

// ─── Comparacao ─────────────────────────────────────────────────────────────────

/**
 * Compara dois diretorios de cassete.
 *
 * Total por construcao: percorre a UNIAO dos arquivos dos dois lados.
 * Arquivo que existe so de um lado e refutacao — nao "ignorado".
 * (C3: comparar so o que os dois tem e o mesmo erro de `git diff` que
 * nao enxerga arquivo novo.)
 */
export async function diffCassetes(
  dirA: string,
  dirB: string,
): Promise<ResultadoDiff> {
  const arquivosA = await listarArquivos(dirA);
  const arquivosB = await listarArquivos(dirB);
  const todos = [...new Set([...arquivosA, ...arquivosB])].sort();

  const diferencas: Diferenca[] = [];

  for (const arquivo of todos) {
    const emA = arquivosA.includes(arquivo);
    const emB = arquivosB.includes(arquivo);

    if (!emA || !emB) {
      diferencas.push({
        veredito: "REFUTA",
        arquivo,
        detalhe: emA
          ? "existe na gravacao 1 e sumiu na gravacao 2"
          : "apareceu na gravacao 2 e nao existia na 1",
      });
      continue;
    }

    const bytesA = await readFile(join(dirA, arquivo));
    const bytesB = await readFile(join(dirB, arquivo));
    if (bytesA.equals(bytesB)) continue;

    if (arquivo.endsWith(".json")) {
      diferencas.push(...compararJson(arquivo, bytesA, bytesB));
    } else {
      diferencas.push({
        veredito: "REFUTA",
        arquivo,
        detalhe: `bytes diferentes (${bytesA.length} vs ${bytesB.length})`,
      });
    }
  }

  const refutacoes = diferencas.filter((d) => d.veredito === "REFUTA").length;
  const explicadas = diferencas.filter((d) => d.veredito === "EXPLICADA").length;

  return {
    veredito: refutacoes > 0 ? "REFUTA" : explicadas > 0 ? "EXPLICADA" : "IDENTICO",
    diferencas,
    arquivosComparados: todos,
    refutacoes,
    explicadas,
  };
}

/** Compara dois JSON campo a campo, aplicando a mascara de volateis. */
function compararJson(
  arquivo: string,
  bytesA: Buffer,
  bytesB: Buffer,
): Diferenca[] {
  let a: unknown;
  let b: unknown;
  try {
    a = JSON.parse(bytesA.toString("utf-8"));
    b = JSON.parse(bytesB.toString("utf-8"));
  } catch (erro) {
    return [
      {
        veredito: "REFUTA",
        arquivo,
        detalhe: `JSON invalido em um dos lados: ${(erro as Error).message}`,
      },
    ];
  }

  const diferencas: Diferenca[] = [];
  percorrer(a, b, "", (campo, valorA, valorB) => {
    const raiz = campo.split(".")[0] ?? campo;
    const volatil = ehVolatil(arquivo, campo) || ehVolatil(arquivo, raiz);
    diferencas.push({
      veredito: volatil ? "EXPLICADA" : "REFUTA",
      arquivo,
      campo,
      detalhe: volatil
        ? "campo volatil declarado em CAMPOS_VOLATEIS"
        : "valor mudou entre duas gravacoes do mesmo cassete",
      antes: resumir(valorA),
      depois: resumir(valorB),
    });
  });

  // Duas gravacoes com o mesmo JSON logico mas bytes diferentes = formatacao
  // nao-canonica. Isso e refutacao: cassete tem de ser byte-estavel.
  if (diferencas.length === 0) {
    diferencas.push({
      veredito: "REFUTA",
      arquivo,
      detalhe:
        "JSON logicamente igual mas bytes diferentes — serializacao nao-canonica " +
        "(ordem de chave, indentacao ou fim de linha)",
    });
  }

  return diferencas;
}

/** Percorre dois valores em paralelo e reporta cada folha divergente. */
function percorrer(
  a: unknown,
  b: unknown,
  caminho: string,
  reportar: (campo: string, a: unknown, b: unknown) => void,
): void {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      reportar(caminho || "$", a, b);
      return;
    }
    for (let i = 0; i < a.length; i++) {
      percorrer(a[i], b[i], `${caminho}[${i}]`, reportar);
    }
    return;
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === "object" &&
    typeof b === "object"
  ) {
    const chaves = [
      ...new Set([
        ...Object.keys(a as Record<string, unknown>),
        ...Object.keys(b as Record<string, unknown>),
      ]),
    ].sort();
    for (const chave of chaves) {
      const subA = (a as Record<string, unknown>)[chave];
      const subB = (b as Record<string, unknown>)[chave];
      percorrer(subA, subB, caminho ? `${caminho}.${chave}` : chave, reportar);
    }
    return;
  }
  if (!Object.is(a, b)) reportar(caminho || "$", a, b);
}

function resumir(valor: unknown): string {
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor);
  if (texto === undefined) return "(ausente)";
  return texto.length > 80 ? `${texto.slice(0, 77)}…` : texto;
}

// ─── Listagem ───────────────────────────────────────────────────────────────────

/** Lista recursivamente os arquivos de um diretorio, em caminhos relativos. */
async function listarArquivos(raiz: string): Promise<string[]> {
  const saida: string[] = [];
  async function andar(dir: string): Promise<void> {
    let entradas;
    try {
      entradas = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entrada of entradas) {
      const completo = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        await andar(completo);
      } else if (entrada.isFile()) {
        saida.push(relative(raiz, completo).split(sep).join("/"));
      }
    }
  }
  const info = await stat(raiz).catch(() => null);
  if (info?.isDirectory()) await andar(raiz);
  return saida.sort();
}

// ─── Relatorio ──────────────────────────────────────────────────────────────────

/** Renderiza o resultado do diff em texto para o terminal. */
export function formatarDiff(resultado: ResultadoDiff): string {
  const linhas: string[] = [];
  linhas.push(
    `Arquivos comparados: ${resultado.arquivosComparados.length} ` +
      `(${resultado.arquivosComparados.join(", ") || "nenhum"})`,
  );
  for (const d of resultado.diferencas) {
    const alvo = d.campo ? `${d.arquivo}#/${d.campo}` : d.arquivo;
    linhas.push(`[${d.veredito}] ${alvo} — ${d.detalhe}`);
    if (d.antes !== undefined || d.depois !== undefined) {
      linhas.push(`    1: ${d.antes ?? "(ausente)"}`);
      linhas.push(`    2: ${d.depois ?? "(ausente)"}`);
    }
  }
  linhas.push(
    `Veredito: ${resultado.veredito} ` +
      `(${resultado.refutacoes} refutacao(oes), ${resultado.explicadas} explicada(s))`,
  );
  return linhas.join("\n");
}
