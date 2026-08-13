// =============================================================================
// Testes da biblioteca de prompts de autoria (card F4-02, W5)
// =============================================================================
// O que este arquivo prova:
//
//  1. ∅-crit do front-matter: todo .md em docs/autoria/prompts/ comeca com
//     `versao:` (forma corrigida da armadilha 9.2: nunca `rg -L`, que em
//     ripgrep e `--follow`).
//  2. Cada prompt tem caso de referencia (campo `caso_de_referencia` na
//     secao Controle), com entrada e saida no diretorio declarado.
//  3. A saida de cada caso valida contra o SCHEMA REAL de autoria v1
//     (F4-01: src/autoria/contrato/schema/autoria.schema.json via
//     src/autoria/contrato/validar.ts) — AB-570 resolvido: nao existe mais
//     copia estrutural do contrato neste arquivo.
//  4. Sonda negativa: campo de decisao do SISTEMA (fps, width, height,
//     duracao_total_frames no topo; duracao_frames, entrada_frames,
//     alinhamento, animacao em no) TEM de ser rejeitado pelo validador
//     real — o LLM decide narrativa, o sistema decide frames.
//  5. Fronteira de decisao: todo prompt declara que o modelo NAO decide
//     layout, cor, frame exato nem duracao resolvida.
//  6. Dicionario de pronuncia: fonte unica (nenhum outro arquivo define
//     termo -> pronuncia), tabela sem duplicata, frase-canario presente,
//     prompts referenciam o dicionario em vez de duplicar a tabela.
//
// AB-432 (hash de midia ADVISORY) e AB-433 (texto_alternativo OBRIGATORIO)
// sao demonstrados sobre as saidas reais de referencia.
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validarSaidaAutoria } from "src/autoria/contrato/validar";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..", "..");
const promptsDir = resolve(rootDir, "docs", "autoria", "prompts");

// ---------------------------------------------------------------------------
// Descoberta
// ---------------------------------------------------------------------------

function listMarkdown(dir: string, recursive: boolean): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive && entry.name !== "casos") out.push(...listMarkdown(full, true));
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function listPromptFiles(): string[] {
  return listMarkdown(promptsDir, false)
    .filter((f) => basename(f).startsWith("prompt-"))
    .sort();
}

function listAllMarkdown(): string[] {
  return listMarkdown(promptsDir, true).sort();
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

// ---------------------------------------------------------------------------
// Front-matter e Controle dos prompts
// ---------------------------------------------------------------------------

function primeiroConteudoLinha(conteudo: string): string {
  return conteudo.split("\n").find((l) => l.trim().length > 0) ?? "";
}

function secaoFronteira(conteudo: string): string {
  const inicio = conteudo.indexOf("## Fronteira de decisao");
  if (inicio === -1) return "";
  const resto = conteudo.slice(inicio);
  const fim = resto.indexOf("\n## ", 10);
  return fim === -1 ? resto : resto.slice(0, fim);
}

function campoControle(conteudo: string, campo: string): string | null {
  const re = new RegExp(`- ${campo}:\\s*(\\S+)`);
  const m = conteudo.match(re);
  return m ? (m[1] ?? null) : null;
}

// Casos de referencia descobertos (usado por varias suites)
const casos: { prompt: string; caso: string; entrada: string; saida: string }[] = [];
for (const arquivo of listPromptFiles()) {
  const conteudo = readFileSync(arquivo, "utf8");
  const caso = campoControle(conteudo, "caso_de_referencia");
  if (!caso) continue;
  const dirCaso = resolve(promptsDir, caso);
  if (!existsSync(dirCaso)) continue;
  const saidas = readdirSync(dirCaso).filter((f) => f.startsWith("saida-") && f.endsWith(".json"));
  const entradas = readdirSync(dirCaso).filter((f) => f.startsWith("entrada"));
  for (const s of saidas) {
    casos.push({
      prompt: basename(arquivo),
      caso,
      entrada: resolve(dirCaso, entradas[0] ?? ""),
      saida: resolve(dirCaso, s),
    });
  }
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe("F4-02 — ∅-crit do front-matter (versao:)", () => {
  it("existe ao menos um .md na biblioteca (denominador)", () => {
    const todos = listAllMarkdown();
    expect(todos.length).toBeGreaterThanOrEqual(5);
  });

  it("todo .md (recursivo) comeca com a linha 'versao:' (forma corrigida da armadilha 9.2)", () => {
    const semVersao = listAllMarkdown().filter(
      (f) => !primeiroConteudoLinha(readFileSync(f, "utf8")).startsWith("versao:"),
    );
    expect(semVersao.map((f) => f.replace(rootDir, "."))).toEqual([]);
  });

  it("o espelho do ∅-crit literal (rg --files-without-match) sai vazio", () => {
    // Espelho do criterio do card com a forma corrigida do contrato-w5 §4.
    const topLevel = listMarkdown(promptsDir, false);
    const semVersao = topLevel.filter(
      (f) => !primeiroConteudoLinha(readFileSync(f, "utf8")).startsWith("versao:"),
    );
    expect(semVersao.map((f) => basename(f))).toEqual([]);
  });
});

describe("F4-02 — cada prompt tem caso de referencia", () => {
  it("existem prompts (prompt-*.md) na biblioteca", () => {
    expect(listPromptFiles().length).toBeGreaterThanOrEqual(3);
  });

  it("todo prompt declara caso_de_referencia e o caso existe com entrada e saida", () => {
    for (const arquivo of listPromptFiles()) {
      const conteudo = readFileSync(arquivo, "utf8");
      const caso = campoControle(conteudo, "caso_de_referencia");
      expect(
        caso,
        `${basename(arquivo)} deve declarar '- caso_de_referencia: casos/<slug>/' no Controle`,
      ).not.toBeNull();
      const dirCaso = resolve(promptsDir, caso as string);
      expect(existsSync(dirCaso), `caso_de_referencia '${caso}' nao existe`).toBe(true);
      const entradas = readdirSync(dirCaso).filter((f) => f.startsWith("entrada"));
      const saidas = readdirSync(dirCaso).filter((f) => f.startsWith("saida-") && f.endsWith(".json"));
      expect(
        entradas.length,
        `caso '${caso}' precisa de ao menos um arquivo de entrada`,
      ).toBeGreaterThanOrEqual(1);
      expect(
        saidas.length,
        `caso '${caso}' precisa de exatamente um arquivo saida-*.json`,
      ).toBe(1);
    }
  });
});

describe("F4-02 — saida de referencia valida contra o schema REAL de autoria v1", () => {
  it("cada saida de referencia e um manifesto valido (schema real F4-01)", () => {
    expect(casos.length).toBeGreaterThanOrEqual(3);
    for (const { caso, saida } of casos) {
      const manifesto = readJson(saida);
      const resultado = validarSaidaAutoria(manifesto);
      expect(
        resultado.valido,
        `${caso}: ${saida.replace(rootDir, ".")} — ${resultado.erros.slice(0, 5).join(" | ")}`,
      ).toBe(true);
    }
  });

  it("AB-432 demonstrado: ha no de midia SEM hash nas saidas (hash e advisory)", () => {
    const algumaMidiaSemHash = casos.some(({ saida }) => {
      const m = readJson(saida) as { nos?: { type?: string; hash?: string }[] };
      return (m.nos ?? []).some((n) => n.type === "midia" && n.hash === undefined);
    });
    expect(algumaMidiaSemHash, "nenhuma saida tem no de midia sem hash — AB-432 nao demonstrado").toBe(true);
  });

  it("AB-433: todo no de midia de toda saida tem texto_alternativo nao-vazio", () => {
    for (const { caso, saida } of casos) {
      const m = readJson(saida) as { nos?: { type?: string; texto_alternativo?: string }[] };
      const midias = (m.nos ?? []).filter((n) => n.type === "midia");
      for (const n of midias) {
        expect(
          n.texto_alternativo !== undefined && n.texto_alternativo.trim().length > 0,
          `${caso}: no de midia sem texto_alternativo (AB-433)`,
        ).toBe(true);
      }
    }
  });

  it("AB-433 sonda negativa: o validador real reprova no de midia sem texto_alternativo", () => {
    const base = readJson(casos[0]!.saida) as { nos: Record<string, unknown>[] };
    const mutado = JSON.parse(JSON.stringify(base)) as { nos: Record<string, unknown>[] };
    const midia = mutado.nos.find((n) => n.type === "midia");
    expect(midia, "o caso de referencia precisa ter no de midia para a sonda").toBeDefined();
    delete midia!.texto_alternativo;
    const resultado = validarSaidaAutoria(mutado);
    expect(resultado.valido).toBe(false);
    expect(
      resultado.erros.some((e) => e.includes("must have required property 'texto_alternativo'")),
    ).toBe(true);
  });

  it("sonda negativa: campo de decisao do SISTEMA em no (duracao_frames, entrada_frames, alinhamento, animacao) e rejeitado", () => {
    const base = readJson(casos[0]!.saida) as { nos: Record<string, unknown>[] };
    const campoNo = [
      "duracao_frames",
      "entrada_frames",
      "alinhamento",
      "animacao",
    ] as const;
    for (const campo of campoNo) {
      const mutado = JSON.parse(JSON.stringify(base)) as { nos: Record<string, unknown>[] };
      mutado.nos[0] = { ...mutado.nos[0]!, [campo]: campo === "animacao" ? { tipo: "fade" } : 30 };
      const resultado = validarSaidaAutoria(mutado);
      expect(resultado.valido, `no com '${campo}' deveria ser rejeitado`).toBe(false);
      expect(
        resultado.erros.some((e) => e.includes("additional propert") && e.includes(campo)),
        `erro de '${campo}' ausente: ${resultado.erros.join(" | ")}`,
      ).toBe(true);
    }
  });

  it("sonda negativa: campo de decisao do SISTEMA no topo (fps, width, height, duracao_total_frames) e rejeitado", () => {
    const base = readJson(casos[0]!.saida) as Record<string, unknown>;
    const campoTopo = ["fps", "width", "height", "duracao_total_frames"] as const;
    for (const campo of campoTopo) {
      const mutado = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
      mutado[campo] = 30;
      const resultado = validarSaidaAutoria(mutado);
      expect(resultado.valido, `topo com '${campo}' deveria ser rejeitado`).toBe(false);
      expect(
        resultado.erros.some((e) => e.includes("additional propert") && e.includes(campo)),
        `erro de '${campo}' ausente: ${resultado.erros.join(" | ")}`,
      ).toBe(true);
    }
  });

  it("sonda negativa: o validador real reprova campo de layout/cor inventado (autoteste do verificador)", () => {
    // "cor" e "layout" nao existem no schema — um modelo que deslize a
    // decisao para dentro do manifesto tem de cair aqui.
    const base = readJson(casos[0]!.saida) as { nos: Record<string, unknown>[] };
    const comCor = JSON.parse(JSON.stringify(base)) as { nos: Record<string, unknown>[] };
    comCor.nos[0] = { ...comCor.nos[0]!, cor: "#ffffff" };
    const comLayout = JSON.parse(JSON.stringify(base)) as { nos: Record<string, unknown>[] };
    comLayout.nos[0] = { ...comLayout.nos[0]!, layout: { x: 10, y: 10 } };
    const errosCor = validarSaidaAutoria(comCor);
    const errosLayout = validarSaidaAutoria(comLayout);
    expect(errosCor.valido).toBe(false);
    expect(errosLayout.valido).toBe(false);
    expect(errosCor.erros.some((e) => e.includes("additional propert"))).toBe(true);
    expect(errosLayout.erros.some((e) => e.includes("additional propert"))).toBe(true);
  });
});

describe("F4-02 — fronteira de decisao: o modelo NAO decide o que o sistema decide", () => {
  const PROIBIDO = ["layout", "cor", "frame exato", "duracao resolvida"];

  it("todo prompt declara a secao '## Fronteira de decisao'", () => {
    for (const arquivo of listPromptFiles()) {
      const conteudo = readFileSync(arquivo, "utf8");
      expect(
        conteudo.includes("## Fronteira de decisao"),
        `${basename(arquivo)} precisa da secao '## Fronteira de decisao'`,
      ).toBe(true);
    }
  });

  it("toda secao de fronteira nomeia as quatro decisoes do sistema como NAO-deciveis", () => {
    for (const arquivo of listPromptFiles()) {
      const secao = secaoFronteira(readFileSync(arquivo, "utf8"));
      expect(secao, `${basename(arquivo)} sem secao de fronteira`).not.toBe("");
      expect(secao).toMatch(/NAO.*decide/s);
      for (const termo of PROIBIDO) {
        expect(
          secao.includes(termo),
          `${basename(arquivo)}: secao de fronteira nao nomeia '${termo}' como decisao do sistema`,
        ).toBe(true);
      }
    }
  });
});

describe("F4-02 — dicionario de pronuncia e fonte unica", () => {
  const dicionario = resolve(promptsDir, "dicionario-pronuncia.md");

  function termosDoDicionario(): string[] {
    const conteudo = readFileSync(dicionario, "utf8");
    const linhas = conteudo.split("\n").filter((l) => l.startsWith("| ") && l.includes("|"));
    // ignora o cabecalho da tabela (| Termo | Pronuncia ... |)
    return linhas
      .filter((l) => !l.includes("Termo") && !l.includes("Pronuncia"))
      .map((l) => (l.split("|")[1] ?? "").trim())
      .filter((t) => t.length > 0);
  }

  it("dicionario existe, comeca com versao: e tem ao menos 8 termos", () => {
    expect(existsSync(dicionario)).toBe(true);
    const conteudo = readFileSync(dicionario, "utf8");
    expect(primeiroConteudoLinha(conteudo)).toMatch(/^versao:/);
    expect(termosDoDicionario().length).toBeGreaterThanOrEqual(8);
  });

  it("frase-canario de R13 esta presente no dicionario", () => {
    const conteudo = readFileSync(dicionario, "utf8");
    expect(conteudo).toContain("O Kubernetes orquestra containers e o PostgreSQL usa async/await");
  });

  it("tabela nao tem termo duplicado", () => {
    const termos = termosDoDicionario();
    const duplicados = termos.filter((t, i) => termos.indexOf(t) !== i);
    expect([...new Set(duplicados)]).toEqual([]);
  });

  it("nenhum arquivo FORA de docs/autoria/prompts/ define '| <termo> |' (fonte unica)", () => {
    const termos = termosDoDicionario();
    const dirsExternos = ["docs", "src", ".agents"];
    const fora: string[] = [];
    for (const d of dirsExternos) {
      const base = resolve(rootDir, d);
      if (!existsSync(base)) continue;
      const pilha = [base];
      while (pilha.length) {
        const atual = pilha.pop() as string;
        if (atual.startsWith(promptsDir)) continue;
        for (const entry of readdirSync(atual, { withFileTypes: true })) {
          const full = resolve(atual, entry.name);
          if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
            pilha.push(full);
          } else if (
            entry.name.endsWith(".md") ||
            entry.name.endsWith(".ts") ||
            entry.name.endsWith(".json")
          ) {
            fora.push(full);
          }
        }
      }
    }

    const violacoes: string[] = [];
    for (const arquivo of fora) {
      const conteudo = readFileSync(arquivo, "utf8");
      for (const termo of termos) {
        if (conteudo.includes(`| ${termo} |`)) {
          violacoes.push(`${arquivo.replace(rootDir, ".")} define '| ${termo} |'`);
        }
      }
    }
    expect(violacoes).toEqual([]);
  });

  it("prompts citam o dicionario por caminho e nao duplicam a tabela", () => {
    for (const arquivo of listPromptFiles()) {
      const conteudo = readFileSync(arquivo, "utf8");
      if (conteudo.includes("pronuncia") || conteudo.includes("Pronuncia")) {
        expect(
          conteudo.includes("dicionario-pronuncia.md"),
          `${basename(arquivo)} menciona pronuncia sem referenciar dicionario-pronuncia.md`,
        ).toBe(true);
      }
      const termos = termosDoDicionario();
      const linhasDeTabela = conteudo
        .split("\n")
        .filter((l) => l.startsWith("| "))
        .filter((l) => termos.some((t) => l.includes(`| ${t} |`)));
      expect(
        linhasDeTabela,
        `${basename(arquivo)} duplica a tabela do dicionario (fonte unica violada)`,
      ).toEqual([]);
    }
  });
});
