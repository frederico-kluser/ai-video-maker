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
//  3. A saida de cada caso valida contra o SCHEMA REAL do contrato de
//     autoria (F4-01, src/autoria/contrato/schema/autoria.schema.json,
//     Autoria.1): AB-432 (hash de midia ADVISORY — pode omitir), AB-433
//     (texto_alternativo OBRIGATORIO em no de midia) e
//     additionalProperties:false em todo objeto.
//  4. Sonda negativa: campo de decisao do SISTEMA (fps, width, height,
//     duracao_total_frames no topo; duracao_frames, entrada_frames,
//     alinhamento, animacao em no; cor/layout em no) TEM de ser rejeitado
//     pelo validador real — o LLM decide narrativa, o sistema decide frames.
//  5. Fronteira de decisao: todo prompt declara que o modelo NAO decide
//     layout, cor, frame exato nem duracao resolvida.
//  6. Dicionario de pronuncia: fonte unica (nenhum outro arquivo define
//     termo -> pronuncia), tabela sem duplicata, frase-canario presente,
//     prompts referenciam o dicionario em vez de duplicar a tabela.
//
// Migracao do AB-570 (PREP-w6): o validador estrutural proprio desta
// suite foi substituido pelo schema real de F4-01 (validarSaidaAutoria,
// src/autoria/contrato/validar.ts). Resposta ao AB-575: o Autoria.1 NAO
// tem duracao_frames — o documento de autoria e narrativa pura; os casos
// de referencia foram migrados para esse formato.
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { validarSaidaAutoria } from "src/autoria/contrato/validar.js";

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
// Varredura da fonte unica do dicionario — em duas fases, para a corrida
// readdir→read ser testavel (sonda negativa C2).
// ---------------------------------------------------------------------------

/**
 * Fase 1 — coleta recursiva dos candidatos (.md/.ts/.json) sob `raizes`,
 * fora de docs/autoria/prompts/ e de diretorios de infraestrutura.
 * Extraida do teste de fonte unica sem mudanca de comportamento.
 */
export function coletarArquivosExternos(raizes: string[]): string[] {
  const fora: string[] = [];
  for (const base of raizes) {
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
  return fora;
}

/**
 * Fase 2 — leitura dos candidatos e apuracao das violacoes (arquivo que
 * define '| <termo> |'). Tolerante a ENOENT: um arquivo que some entre a
 * coleta (readdirSync) e esta leitura e PULADO, nunca lancado. POR QUE:
 * tests/render/encode/perfis.test.ts grava e remove AO VIVO a sonda negativa
 * src/render/encode/perfis/invalido-sem-alvo.ts na arvore de descoberta
 * (Regra 6 — a sonda NAO pode sair da arvore). Se a remocao cair na janela
 * entre o readdir desta suite e o read, a suite inteira caia com ENOENT
 * (medido: 2 de 6 execucoes). O arquivo efemero nao e conteudo estatico:
 * pular e o comportamento correto, lancar e a corrida.
 */
export function lerViolacoesDeTermos(arquivos: string[], termos: string[]): string[] {
  const violacoes: string[] = [];
  for (const arquivo of arquivos) {
    let conteudo: string;
    try {
      conteudo = readFileSync(arquivo, "utf8");
    } catch (erro) {
      if ((erro as { code?: string }).code === "ENOENT") continue;
      throw erro;
    }
    for (const termo of termos) {
      if (conteudo.includes(`| ${termo} |`)) {
        violacoes.push(`${arquivo.replace(rootDir, ".")} define '| ${termo} |'`);
      }
    }
  }
  return violacoes;
}

// ---------------------------------------------------------------------------
// Schema REAL do contrato de autoria (F4-01) — migracao do AB-570
// ---------------------------------------------------------------------------
// O CONTRATO_ALVO desta suite passou a ser o schema real de F4-01
// (src/autoria/contrato/schema/autoria.schema.json, Autoria.1), validado
// por `validarSaidaAutoria` (src/autoria/contrato/validar.ts) — a mesma
// funcao que o pipeline usa antes do reparo (rejeitar.ts). Nenhum
// validador estrutural proprio: a suite revalida as saidas de referencia
// contra o schema de producao, com AB-432 (hash advisory), AB-433
// (texto_alternativo obrigatorio) e additionalProperties:false em todo
// objeto. Resposta ao AB-575: o Autoria.1 NAO tem duracao_frames — o
// documento de autoria e narrativa pura; os casos migraram para esse
// formato e os prompts nao convertem mais segundos em frames.
// ---------------------------------------------------------------------------

type Erro = string;

/**
 * Valida uma saida de caso contra o schema REAL do contrato de autoria.
 * Retorna lista de erros (vazia = valido). Propriedade desconhecida e
 * erro — additionalProperties:false em todo objeto, entao campo de
 * layout/cor/frame inventado cai aqui.
 */
export function validarContratoV1(manifesto: unknown): Erro[] {
  return validarSaidaAutoria(manifesto).erros;
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

  it("sonda negativa: o schema REAL reprova campo de layout/cor/frame inventado", () => {
    // "cor", "layout" e "duracao_frames" nao existem no Autoria.1 — um
    // modelo que deslize a decisao para dentro do documento tem de cair
    // aqui (additionalProperties:false em todo objeto).
    const base = readJson(casos[0]!.saida) as Record<string, unknown>;
    const comCor = JSON.parse(JSON.stringify(base)) as {
      nos: Record<string, unknown>[];
    };
    comCor.nos[0] = { ...comCor.nos[0], cor: "#ffffff" };
    const comLayout = JSON.parse(JSON.stringify(base)) as {
      nos: Record<string, unknown>[];
    };
    comLayout.nos[0] = { ...comLayout.nos[0], layout: { x: 10, y: 10 } };
    const comFrame = JSON.parse(JSON.stringify(base)) as {
      nos: Record<string, unknown>[];
    };
    comFrame.nos[0] = { ...comFrame.nos[0], duracao_frames: 90 };
    const errosCor = validarContratoV1(comCor);
    const errosLayout = validarContratoV1(comLayout);
    const errosFrame = validarContratoV1(comFrame);
    expect(errosCor.some((e) => e.includes("additional"))).toBe(true);
    expect(errosLayout.some((e) => e.includes("additional"))).toBe(true);
    expect(errosFrame.some((e) => e.includes("additional"))).toBe(true);
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
      const erros = validarContratoV1(mutado);
      expect(
        erros.some((e) => e.includes("additional propert") && e.includes(campo)),
        `no com '${campo}' deveria ser rejeitado — erros: ${erros.join(" | ")}`,
      ).toBe(true);
    }
  });

  it("sonda negativa: campo de decisao do SISTEMA no topo (fps, width, height, duracao_total_frames) e rejeitado", () => {
    const base = readJson(casos[0]!.saida) as Record<string, unknown>;
    const campoTopo = ["fps", "width", "height", "duracao_total_frames"] as const;
    for (const campo of campoTopo) {
      const mutado = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
      mutado[campo] = 30;
      const erros = validarContratoV1(mutado);
      expect(
        erros.some((e) => e.includes("additional propert") && e.includes(campo)),
        `topo com '${campo}' deveria ser rejeitado — erros: ${erros.join(" | ")}`,
      ).toBe(true);
    }
  });

  it("sonda negativa: o schema REAL reprova no de midia sem texto_alternativo (AB-433)", () => {
    const base = readJson(casos[0]!.saida) as {
      nos: Record<string, unknown>[];
    };
    const mutado = JSON.parse(JSON.stringify(base)) as { nos: Record<string, unknown>[] };
    const midia = mutado.nos.find((n) => n.type === "midia");
    expect(midia, "o caso de referencia precisa ter no de midia para a sonda").toBeDefined();
    delete midia!.texto_alternativo;
    const erros = validarContratoV1(mutado);
    // AB-433: o schema exige texto_alternativo — o erro nomeia o campo.
    expect(erros.some((e) => e.includes("texto_alternativo"))).toBe(true);
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
    const violacoes = lerViolacoesDeTermos(
      coletarArquivosExternos(["docs", "src", ".agents"].map((d) => resolve(rootDir, d))),
      termos,
    );
    expect(violacoes).toEqual([]);
  });

  it("sonda negativa (C2): a varredura tolera ENOENT entre o readdir e o read", () => {
    // Reproduz a corrida real: perfis.test.ts grava e remove AO VIVO a sonda
    // src/render/encode/perfis/invalido-sem-alvo.ts (Regra 6) enquanto esta
    // suite varre src/ recursivamente. Se a remocao cair entre a coleta
    // (readdirSync) e a leitura (readFileSync), a suite inteira caia com
    // ENOENT. Aqui o mesmo padrao e exercitado em sequencia deterministica:
    // o arquivo listado e apagado antes do read — a varredura tem de seguir
    // sem lancar. Sem a tolerancia, este teste falha (sonda negativa).
    const tmp = mkdtempSync(join(tmpdir(), "prompts-varredura-"));
    try {
      const sonda = join(tmp, "sonda-efemera.ts");
      writeFileSync(sonda, "| termo-fantasma |\n");
      // Fase 1 — varredura: coleta o candidato enquanto ele existe.
      const coletados = coletarArquivosExternos([tmp]);
      expect(coletados).toContain(sonda);
      // Fase 2 — a sonda efemera some antes da leitura (a corrida real).
      rmSync(sonda, { force: true });
      // Fase 3 — leitura tolerante: nao lanca e o arquivo sumido nao vira
      // violacao.
      expect(() => lerViolacoesDeTermos(coletados, ["termo-fantasma"])).not.toThrow();
      expect(lerViolacoesDeTermos(coletados, ["termo-fantasma"])).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
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
