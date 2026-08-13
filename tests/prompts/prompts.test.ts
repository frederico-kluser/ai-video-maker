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
//  3. A saida de cada caso valida contra o CONTRATO DE AUTORIA v1
//     (contrato-w5 §3): estrutura do schema/manifesto.llm.schema.json com
//     AB-432 (hash de midia ADVISORY — pode omitir) e AB-433
//     (texto_alternativo OBRIGATORIO em no de midia).
//  4. Fronteira de decisao: todo prompt declara que o modelo NAO decide
//     layout, cor, frame exato nem duracao resolvida.
//  5. Dicionario de pronuncia: fonte unica (nenhum outro arquivo define
//     termo -> pronuncia), tabela sem duplicata, frase-canario presente,
//     prompts referenciam o dicionario em vez de duplicar a tabela.
//
// Dependencia lateral registrada (AB-570): o schema real de autoria
// (F4-01, src/autoria/contrato/**) nao estava na base desta worktree.
// O validador estrutural abaixo implementa o contrato v1 descrito no
// contrato-w5 §3; quando F4-01 mergear, este arquivo deve passar a usar o
// schema real (mudanca de um ponto, no objeto CONTRATO_ALVO).
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

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
// Contrato de autoria v1 (descrito em contrato-w5 §3) — validador estrutural
// ---------------------------------------------------------------------------

const TIPOS_NO = ["cabecalho", "texto", "lista", "midia", "codigo", "grafico"] as const;

const SCHEMAS_NO: Record<string, string> = {
  cabecalho: "Cabecalho.1",
  texto: "Texto.1",
  lista: "Lista.1",
  midia: "Midia.1",
  codigo: "Codigo.1",
  grafico: "Grafico.1",
};

const CHAVES_BASE = new Set(["id", "schema", "type", "duracao_frames", "entrada_frames", "animacao"]);
const CHAVES_POR_TIPO: Record<string, Set<string>> = {
  cabecalho: new Set([...CHAVES_BASE, "texto", "subtitulo", "alinhamento"]),
  texto: new Set([...CHAVES_BASE, "texto", "destaque", "alinhamento"]),
  lista: new Set([...CHAVES_BASE, "itens", "ordenada", "alinhamento"]),
  midia: new Set([...CHAVES_BASE, "hash", "tipo_midia", "ajuste", "texto_alternativo", "licenca"]),
  codigo: new Set([...CHAVES_BASE, "codigo", "linguagem", "linhas_destaque", "nome_arquivo"]),
  grafico: new Set([...CHAVES_BASE, "tipo_grafico", "titulo", "dados"]),
};

const CHAVES_CENA = new Set(["id", "nos", "transicao_entrada", "transicao_saida", "audio_cena"]);
const CHAVES_TOPO = new Set([
  "schema_version",
  "fps",
  "width",
  "height",
  "duracao_total_frames",
  "nos",
  "cenas",
  "audio",
]);

const TIPOS_GRAFICO = ["barras", "linha", "pizza", "area", "dispersao"];
const TIPOS_MIDIA = ["imagem", "video", "gif"];

type Erro = string;

/**
 * Valida um manifesto contra o contrato de autoria v1 descrito:
 * estrutura de schema/manifesto.llm.schema.json + AB-432 (hash advisory)
 * + AB-433 (texto_alternativo obrigatorio). Retorna lista de erros
 * (vazia = valido). Propriedade desconhecida e erro — o schema tem
 * additionalProperties/unevaluatedProperties false, entao campo de
 * layout/cor inventado cai aqui.
 */
export function validarContratoV1(manifesto: unknown): Erro[] {
  const erros: Erro[] = [];
  if (typeof manifesto !== "object" || manifesto === null || Array.isArray(manifesto)) {
    return ["topo do manifesto nao e um objeto"];
  }
  const m = manifesto as Record<string, unknown>;

  for (const chave of Object.keys(m)) {
    if (!CHAVES_TOPO.has(chave)) erros.push(`propriedade desconhecida no topo: '${chave}'`);
  }
  if (m["schema_version"] !== "Manifesto.1") erros.push(`schema_version deve ser 'Manifesto.1'`);
  for (const campo of ["fps", "width", "height"] as const) {
    if (!Number.isInteger(m[campo])) erros.push(`${campo} deve ser inteiro`);
  }
  if ("duracao_total_frames" in m && !Number.isInteger(m["duracao_total_frames"])) {
    erros.push("duracao_total_frames deve ser inteiro");
  }

  const nos = m["nos"];
  if (!Array.isArray(nos) || nos.length === 0) {
    erros.push("'nos' deve ser um array nao-vazio");
    return erros;
  }

  const idsNos = new Set<string>();
  nos.forEach((no, i) => {
    if (typeof no !== "object" || no === null) {
      erros.push(`nos[${i}] nao e um objeto`);
      return;
    }
    const n = no as Record<string, unknown>;
    const tipo = (n["type"] as string) ?? "";
    for (const chave of Object.keys(n)) {
      if (!CHAVES_POR_TIPO[tipo]?.has(chave)) {
        erros.push(`nos[${i}]: propriedade desconhecida para type '${tipo}': '${chave}'`);
      }
    }
    for (const campo of ["id", "schema", "type", "duracao_frames"] as const) {
      if (n[campo] === undefined) erros.push(`nos[${i}]: campo obrigatorio '${campo}' ausente`);
    }
    if (!TIPOS_NO.includes(tipo as (typeof TIPOS_NO)[number])) {
      erros.push(`nos[${i}]: type '${tipo}' fora do enum do schema`);
    }
    if (n["schema"] !== SCHEMAS_NO[tipo]) {
      erros.push(`nos[${i}]: schema '${n["schema"]}' nao casa o type '${tipo}'`);
    }
    const id = n["id"] as string;
    if (typeof id === "string") {
      if (idsNos.has(id)) erros.push(`nos[${i}]: id duplicado '${id}'`);
      idsNos.add(id);
    }
    if (!Number.isInteger(n["duracao_frames"]) || (n["duracao_frames"] as number) < 1) {
      erros.push(`nos[${i}]: duracao_frames invalida`);
    }
    if (
      "entrada_frames" in n &&
      (!Number.isInteger(n["entrada_frames"]) || (n["entrada_frames"] as number) < 0)
    ) {
      erros.push(`nos[${i}]: entrada_frames invalida`);
    }

    if (tipo === "cabecalho" && typeof n["texto"] !== "string") {
      erros.push(`nos[${i}]: no cabecalho sem 'texto'`);
    }
    if (tipo === "texto" && typeof n["texto"] !== "string") {
      erros.push(`nos[${i}]: no texto sem 'texto'`);
    }
    if (tipo === "lista" && (!Array.isArray(n["itens"]) || n["itens"].length === 0)) {
      erros.push(`nos[${i}]: no lista sem 'itens' nao-vazio`);
    }
    if (tipo === "midia") {
      if (!TIPOS_MIDIA.includes(n["tipo_midia"] as string)) {
        erros.push(`nos[${i}]: no midia sem 'tipo_midia' valido`);
      }
      // AB-433: texto_alternativo OBRIGATORIO e nao-vazio
      const alt = n["texto_alternativo"];
      if (typeof alt !== "string" || alt.trim().length === 0) {
        erros.push(`nos[${i}]: no midia sem 'texto_alternativo' (AB-433 — obrigatorio)`);
      }
      // AB-432: hash ADVISORY — presente tem de ser string, ausente e valido
      if ("hash" in n && typeof n["hash"] !== "string") {
        erros.push(`nos[${i}]: 'hash' de midia, quando presente, deve ser string (AB-432)`);
      }
    }
    if (tipo === "codigo") {
      for (const campo of ["codigo", "linguagem"] as const) {
        if (typeof n[campo] !== "string") erros.push(`nos[${i}]: no codigo sem '${campo}'`);
      }
    }
    if (tipo === "grafico") {
      if (!TIPOS_GRAFICO.includes(n["tipo_grafico"] as string)) {
        erros.push(`nos[${i}]: no grafico sem 'tipo_grafico' valido`);
      }
      if (!Array.isArray(n["dados"]) || n["dados"].length === 0) {
        erros.push(`nos[${i}]: no grafico sem 'dados' nao-vazio`);
      } else {
        (n["dados"] as unknown[]).forEach((d, j) => {
          if (typeof d !== "object" || d === null) {
            erros.push(`nos[${i}].dados[${j}] nao e um objeto`);
            return;
          }
          const item = d as Record<string, unknown>;
          if (typeof item["rotulo"] !== "string" || typeof item["valor"] !== "number") {
            erros.push(`nos[${i}].dados[${j}] sem 'rotulo' string e 'valor' number`);
          }
        });
      }
    }
  });

  const cenas = m["cenas"];
  if (!Array.isArray(cenas) || cenas.length === 0) {
    erros.push("'cenas' deve ser um array nao-vazio");
    return erros;
  }

  const idsCenas = new Set<string>();
  let temTransicao = false;
  cenas.forEach((cena, i) => {
    if (typeof cena !== "object" || cena === null) {
      erros.push(`cenas[${i}] nao e um objeto`);
      return;
    }
    const c = cena as Record<string, unknown>;
    for (const chave of Object.keys(c)) {
      if (!CHAVES_CENA.has(chave)) erros.push(`cenas[${i}]: propriedade desconhecida: '${chave}'`);
    }
    const id = c["id"] as string;
    if (typeof id === "string") {
      if (idsCenas.has(id)) erros.push(`cenas[${i}]: id de cena duplicado '${id}'`);
      idsCenas.add(id);
    }
    if ("transicao_entrada" in c || "transicao_saida" in c) temTransicao = true;
    if (!Array.isArray(c["nos"]) || c["nos"].length === 0) {
      erros.push(`cenas[${i}]: 'nos' deve ser array nao-vazio`);
    } else {
      (c["nos"] as unknown[]).forEach((nid) => {
        if (!idsNos.has(nid as string)) {
          erros.push(`cenas[${i}]: referencia a no '${nid}' que nao existe em 'nos'`);
        }
      });
    }
    if ("audio_cena" in c && c["audio_cena"] !== null) {
      const ac = c["audio_cena"] as Record<string, unknown>;
      const texto = ac["texto_locucao"];
      if (typeof texto !== "string" || texto.trim().length === 0) {
        erros.push(`cenas[${i}]: audio_cena sem 'texto_locucao' nao-vazio`);
      }
    }
  });

  // Invariante de composicao (panorama §9.2, Camada 4): sem transicao,
  // soma das duracoes dos nos == duracao_total_frames.
  if (!temTransicao && Number.isInteger(m["duracao_total_frames"])) {
    const soma = (nos as Record<string, unknown>[]).reduce(
      (acc, n) => acc + (n["duracao_frames"] as number),
      0,
    );
    if (soma !== m["duracao_total_frames"]) {
      erros.push(
        `duracao_total_frames (${m["duracao_total_frames"]}) != soma das duracoes dos nos (${soma})`,
      );
    }
  }

  return erros;
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

describe("F4-02 — saida de referencia valida contra o contrato de autoria v1", () => {
  it("cada saida de referencia e um manifesto valido (contrato v1 descrito)", () => {
    expect(casos.length).toBeGreaterThanOrEqual(3);
    for (const { caso, saida } of casos) {
      const manifesto = readJson(saida);
      const erros = validarContratoV1(manifesto);
      expect(erros, `${caso}: ${saida.replace(rootDir, ".")}`).toEqual([]);
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

  it("sonda negativa: o validador reprova campo de layout/cor inventado (autoteste do verificador)", () => {
    // "cor" e "layout" nao existem no schema — um modelo que deslize a
    // decisao para dentro do manifesto tem de cair aqui.
    const base = readJson(casos[0]!.saida) as Record<string, unknown>;
    const comCor = JSON.parse(JSON.stringify(base)) as {
      nos: Record<string, unknown>[];
    };
    comCor.nos[0] = { ...comCor.nos[0], cor: "#ffffff" };
    const comLayout = JSON.parse(JSON.stringify(base)) as {
      nos: Record<string, unknown>[];
    };
    comLayout.nos[0] = { ...comLayout.nos[0], layout: { x: 10, y: 10 } };
    const errosCor = validarContratoV1(comCor);
    const errosLayout = validarContratoV1(comLayout);
    expect(errosCor.some((e) => e.includes("propriedade desconhecida"))).toBe(true);
    expect(errosLayout.some((e) => e.includes("propriedade desconhecida"))).toBe(true);
  });

  it("sonda negativa: o validador reprova no de midia sem texto_alternativo (AB-433)", () => {
    const base = readJson(casos[0]!.saida) as {
      nos: Record<string, unknown>[];
    };
    const mutado = JSON.parse(JSON.stringify(base)) as { nos: Record<string, unknown>[] };
    const midia = mutado.nos.find((n) => n.type === "midia");
    expect(midia, "o caso de referencia precisa ter no de midia para a sonda").toBeDefined();
    delete midia!.texto_alternativo;
    const erros = validarContratoV1(mutado);
    expect(erros.some((e) => e.includes("AB-433"))).toBe(true);
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
