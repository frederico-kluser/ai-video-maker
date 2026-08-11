// =============================================================================
// comp-pureza (∅-crit) — nada de Date.now / Math.random / setTimeout / fetch
//                        sob src/composicao/
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// Por que estes quatro nomes: o render do Remotion abre varias abas de
// navegador e renderiza faixas de frames em paralelo. Qualquer valor que venha
// do relogio de parede, do RNG global ou da rede difere entre abas — e o video
// sai cintilando, sem nenhum erro no console.
//   https://www.remotion.dev/docs/flickering (2026-08-11)
//
// Este gate nasce ANTES do codigo que ele guarda, e por isso vem com sonda
// negativa embutida: o mesmo varredor roda contra tests/composicao/impuro/,
// onde as quatro violacoes existem de proposito. Se o varredor parar de acusar
// aquele arquivo, o verde de src/composicao/ nao vale nada (C2).
// =============================================================================

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DO_REPO = resolve(AQUI, "..", "..");
const DIR_COMPOSICAO = resolve(RAIZ_DO_REPO, "src", "composicao");
const DIR_IMPURO = resolve(AQUI, "impuro");

// ---------------------------------------------------------------------------
// Os padroes proibidos
// ---------------------------------------------------------------------------

interface Padrao {
  nome: string;
  regex: RegExp;
  motivo: string;
}

const PADROES: Padrao[] = [
  {
    nome: "Date.now()",
    regex: /\bDate\s*\.\s*now\s*\(/,
    motivo: "relogio de parede — diverge entre abas do render",
  },
  {
    nome: "Math.random()",
    regex: /\bMath\s*\.\s*random\s*\(/,
    motivo: "RNG global — use random(seed) do Remotion",
  },
  {
    nome: "setTimeout()",
    regex: /\bsetTimeout\s*\(/,
    motivo: "temporizador de relogio de parede — derive de props.frame",
  },
  {
    nome: "fetch()",
    regex: /(?<!\.)\bfetch\s*\(/,
    motivo: "I/O de rede — resolva acima da fronteira de determinismo",
  },
];

/** Padroes extras: nao sao o ∅-crit do card, mas sao a mesma doenca. */
const PADROES_EXTRA: Padrao[] = [
  {
    nome: "requestAnimationFrame()",
    regex: /\brequestAnimationFrame\s*\(/,
    motivo: "relogio do navegador — derive de props.frame",
  },
  {
    nome: "new Date()",
    regex: /\bnew\s+Date\s*\(/,
    motivo: "relogio de parede",
  },
  {
    nome: "performance.now()",
    regex: /\bperformance\s*\.\s*now\s*\(/,
    motivo: "relogio de alta resolucao — ainda e relogio",
  },
];

// ---------------------------------------------------------------------------
// Varredor
// ---------------------------------------------------------------------------

/** Lista recursivamente os .ts/.tsx de um diretorio, em ordem estavel. */
function arquivosDe(diretorio: string): string[] {
  if (!existsSync(diretorio)) return [];
  const achados: string[] = [];
  for (const entrada of readdirSync(diretorio).sort()) {
    if (entrada.startsWith(".")) continue;
    const caminho = resolve(diretorio, entrada);
    if (statSync(caminho).isDirectory()) {
      achados.push(...arquivosDe(caminho));
    } else if (entrada.endsWith(".ts") || entrada.endsWith(".tsx")) {
      achados.push(caminho);
    }
  }
  return achados;
}

/**
 * Remove comentarios da linha. A proibicao e sobre CODIGO: um comentario que
 * cita `Date.now()` para explicar por que ele e proibido nao pode derrubar o
 * gate — senao a documentacao da regra viraria violacao da regra.
 */
function semComentario(linha: string): string {
  const cortada = linha.split("//")[0] ?? "";
  const aparada = cortada.trimStart();
  if (aparada.startsWith("*") || aparada.startsWith("/*")) return "";
  return cortada;
}

interface Violacao {
  arquivo: string;
  linha: number;
  padrao: string;
  texto: string;
}

function varrer(diretorio: string, padroes: Padrao[]): Violacao[] {
  const violacoes: Violacao[] = [];
  for (const caminho of arquivosDe(diretorio)) {
    const linhas = readFileSync(caminho, "utf-8").split("\n");
    for (let i = 0; i < linhas.length; i++) {
      const codigo = semComentario(linhas[i] ?? "");
      if (codigo.trim().length === 0) continue;
      for (const padrao of padroes) {
        if (padrao.regex.test(codigo)) {
          violacoes.push({
            arquivo: relative(RAIZ_DO_REPO, caminho),
            linha: i + 1,
            padrao: padrao.nome,
            texto: codigo.trim(),
          });
        }
      }
    }
  }
  return violacoes;
}

function relatar(violacoes: Violacao[]): string {
  return violacoes
    .map((v) => `  ${v.arquivo}:${String(v.linha)} [${v.padrao}] ${v.texto}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Sonda negativa — o varredor sabe reprovar?
// ---------------------------------------------------------------------------

describe("o varredor de pureza sabe reprovar (sonda negativa)", () => {
  it("acha os arquivos da fixture impura", () => {
    expect(arquivosDe(DIR_IMPURO).length).toBeGreaterThan(0);
  });

  it("acusa as QUATRO violacoes plantadas em tests/composicao/impuro/", () => {
    const violacoes = varrer(DIR_IMPURO, PADROES);
    const nomes = [...new Set(violacoes.map((v) => v.padrao))].sort();
    expect(nomes).toStrictEqual([
      "Date.now()",
      "Math.random()",
      "fetch()",
      "setTimeout()",
    ]);
  });

  it("um comentario citando Date.now() NAO conta como violacao", () => {
    expect(semComentario("// nunca use Date.now() aqui").trim()).toBe("");
    expect(semComentario(" * Date.now() e proibido").trim()).toBe("");
    expect(semComentario("const t = Date.now(); // isto conta")).toContain("Date.now()");
  });
});

// ---------------------------------------------------------------------------
// O gate
// ---------------------------------------------------------------------------

describe("pureza de src/composicao/ (comp-pureza, ∅-crit)", () => {
  it("o diretorio existe e tem arquivos — seletor vazio seria falso verde", () => {
    expect(existsSync(DIR_COMPOSICAO)).toBe(true);
    expect(arquivosDe(DIR_COMPOSICAO).length).toBeGreaterThan(0);
  });

  for (const padrao of PADROES) {
    it(`nenhum ${padrao.nome} sob src/composicao/ (${padrao.motivo})`, () => {
      const violacoes = varrer(DIR_COMPOSICAO, [padrao]);
      expect(
        violacoes.length,
        `${String(violacoes.length)} ocorrencia(s) de ${padrao.nome}:\n${relatar(violacoes)}`,
      ).toBe(0);
    });
  }

  for (const padrao of PADROES_EXTRA) {
    it(`nenhum ${padrao.nome} sob src/composicao/ (${padrao.motivo})`, () => {
      const violacoes = varrer(DIR_COMPOSICAO, [padrao]);
      expect(violacoes.length, relatar(violacoes)).toBe(0);
    });
  }

  it("nenhuma animacao CSS (o tempo e do frame, nao do navegador)", () => {
    const proibidos = ["animation:", "transition:", "animation-name", "transitionDuration:"];
    const achados: string[] = [];
    for (const caminho of arquivosDe(DIR_COMPOSICAO)) {
      const linhas = readFileSync(caminho, "utf-8").split("\n");
      for (let i = 0; i < linhas.length; i++) {
        const codigo = semComentario(linhas[i] ?? "");
        for (const termo of proibidos) {
          if (codigo.includes(termo)) {
            achados.push(`${relative(RAIZ_DO_REPO, caminho)}:${String(i + 1)}: ${termo}`);
          }
        }
      }
    }
    expect(achados.length, achados.join("\n")).toBe(0);
  });

  it("nenhum background-image nem mask-image", () => {
    const achados: string[] = [];
    for (const caminho of arquivosDe(DIR_COMPOSICAO)) {
      const linhas = readFileSync(caminho, "utf-8").split("\n");
      for (let i = 0; i < linhas.length; i++) {
        const codigo = semComentario(linhas[i] ?? "");
        if (codigo.includes("background-image") || codigo.includes("mask-image")) {
          achados.push(`${relative(RAIZ_DO_REPO, caminho)}:${String(i + 1)}`);
        }
      }
    }
    expect(achados.length, achados.join("\n")).toBe(0);
  });

  it("so descoberta.ts pode falar com o disco — o caminho de render, nunca", () => {
    const permitidos = new Set([resolve(DIR_COMPOSICAO, "descoberta.ts")]);
    const achados: string[] = [];
    for (const caminho of arquivosDe(DIR_COMPOSICAO)) {
      if (permitidos.has(caminho)) continue;
      const conteudo = readFileSync(caminho, "utf-8");
      for (const modulo of ["node:fs", "node:child_process", "node:http", "node:https"]) {
        if (conteudo.includes(`"${modulo}"`) || conteudo.includes(`'${modulo}'`)) {
          achados.push(`${relative(RAIZ_DO_REPO, caminho)}: importa ${modulo}`);
        }
      }
    }
    expect(achados.length, achados.join("\n")).toBe(0);
  });
});
