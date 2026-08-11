/**
 * tests/resolucao/descoberta.test.ts
 *
 * ∅-crit no nivel do DISCO: um estagio que existe em `src/resolucao/` e
 * nao tem cassete tem de derrubar a suite.
 *
 * Por que isto e um arquivo separado do orquestrador: o orquestrador so
 * ve os estagios que alguem passou para ele. A lista passada a mao nunca
 * contem o estagio que voce esqueceu — e "estagio esquecido" e
 * exatamente o modo de falha que o ∅-crit existe para pegar. Quem
 * responde essa pergunta e o disco.
 *
 * Todo teste aqui monta a arvore num diretorio temporario. O mesmo
 * verificador roda contra a arvore de verdade em `tools/resolucao/
 * cobertura.ts`, chamado por `just res:offline`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ARQUIVO_MARCADOR,
  RAIZ_ESTAGIOS_PADRAO,
  descobrirEstagios,
  formatarCobertura,
  verificarCobertura,
} from "src/resolucao/descoberta.js";
import { ARQUIVOS_OBRIGATORIOS } from "src/resolucao/cassete/formato.js";
import { ORDEM_ESTAGIOS } from "src/resolucao/contrato.js";

const CHAVE = "0123456789abcdef".repeat(4);

describe("Descoberta de estagios por convencao", () => {
  let tmp: string;
  let raizEstagios: string;
  let raizCassetes: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "descoberta-"));
    raizEstagios = join(tmp, "src", "resolucao");
    raizCassetes = join(tmp, "fixtures", "cassetes");
    await mkdir(raizEstagios, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  /** Cria `<raiz>/<nome>/estagio.ts`. */
  async function criarEstagio(nome: string): Promise<void> {
    const dir = join(raizEstagios, nome);
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, ARQUIVO_MARCADOR),
      `export default { identidade: { nome: "${nome}", versao: "1.0.0" } };\n`,
      "utf-8",
    );
  }

  /** Cria um cassete completo (todos os arquivos obrigatorios). */
  async function criarCassete(nome: string, chave = CHAVE): Promise<void> {
    const dir = join(raizCassetes, nome, chave);
    await mkdir(dir, { recursive: true });
    for (const arquivo of ARQUIVOS_OBRIGATORIOS) {
      await writeFile(join(dir, arquivo), "{}\n", "utf-8");
    }
  }

  /** Cria um diretorio de infraestrutura (sem `estagio.ts`). */
  async function criarInfra(nome: string): Promise<void> {
    const dir = join(raizEstagios, nome);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.ts"), "export {};\n", "utf-8");
  }

  // ─── Descoberta ──────────────────────────────────────────────────────────

  it("descobre um diretorio que contem estagio.ts", async () => {
    await criarEstagio("locucao");
    const achados = await descobrirEstagios(raizEstagios);
    expect(achados.map((e) => e.nome)).toEqual(["locucao"]);
    expect(achados[0]?.canonico).toBe(true);
  });

  it("NAO confunde diretorio de infraestrutura com estagio", async () => {
    await criarInfra("cassete");
    await criarInfra("rede");
    await criarEstagio("grafico");
    const achados = await descobrirEstagios(raizEstagios);
    expect(achados.map((e) => e.nome)).toEqual(["grafico"]);
  });

  it("devolve os estagios em ordem estavel", async () => {
    await criarEstagio("musica");
    await criarEstagio("codigo");
    await criarEstagio("locucao");
    const achados = await descobrirEstagios(raizEstagios);
    expect(achados.map((e) => e.nome)).toEqual(["codigo", "locucao", "musica"]);
  });

  it("marca como nao-canonico um nome fora da lista dos cinco", async () => {
    await criarEstagio("mentira");
    const [achado] = await descobrirEstagios(raizEstagios);
    expect(achado?.canonico).toBe(false);
  });

  it("raiz inexistente devolve lista vazia, sem explodir", async () => {
    expect(await descobrirEstagios(join(tmp, "nao-existe"))).toEqual([]);
  });

  // ─── ∅-crit ──────────────────────────────────────────────────────────────

  it("∅-crit: estagio COM cassete -> cobertura OK", async () => {
    await criarEstagio("locucao");
    await criarCassete("locucao");
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(relatorio.ok).toBe(true);
    expect(relatorio.descobertos).toHaveLength(1);
  });

  it("∅-crit: estagio SEM cassete -> cobertura FALHA, com o estagio nomeado", async () => {
    await criarEstagio("locucao");
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(relatorio.ok).toBe(false);
    expect(relatorio.cobertura[0]?.nome).toBe("locucao");
    expect(relatorio.cobertura[0]?.problemas.join("\n")).toContain("∅-crit");
  });

  it("∅-crit: um estagio sem cassete no meio de tres derruba a cobertura", async () => {
    await criarEstagio("locucao");
    await criarCassete("locucao");
    await criarEstagio("grafico");
    await criarCassete("grafico");
    await criarEstagio("musica"); // este nao tem cassete
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(relatorio.ok).toBe(false);
    const falhos = relatorio.cobertura.filter((c) => c.problemas.length > 0);
    expect(falhos.map((c) => c.nome)).toEqual(["musica"]);
  });

  it("∅-crit: cassete existe mas sem procedencia.json -> FALHA", async () => {
    await criarEstagio("locucao");
    const dir = join(raizCassetes, "locucao", CHAVE);
    await mkdir(dir, { recursive: true });
    for (const arquivo of ARQUIVOS_OBRIGATORIOS) {
      if (arquivo === "procedencia.json") continue;
      await writeFile(join(dir, arquivo), "{}\n", "utf-8");
    }
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(relatorio.ok).toBe(false);
    expect(relatorio.cobertura[0]?.problemas.join("\n")).toContain(
      "procedencia.json",
    );
  });

  it("∅-crit: estagio de nome desconhecido tambem derruba, com mensagem propria", async () => {
    await criarEstagio("mentira");
    await criarCassete("mentira");
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(relatorio.ok).toBe(false);
    expect(relatorio.cobertura[0]?.problemas.join("\n")).toContain(
      "Estagio desconhecido",
    );
  });

  it("um diretorio de cassete que nao e hash nao conta como cassete", async () => {
    await criarEstagio("locucao");
    const dir = join(raizCassetes, "locucao", "rascunho");
    await mkdir(dir, { recursive: true });
    for (const arquivo of ARQUIVOS_OBRIGATORIOS) {
      await writeFile(join(dir, arquivo), "{}\n", "utf-8");
    }
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(relatorio.ok).toBe(false);
  });

  // ─── Vacuidade ───────────────────────────────────────────────────────────

  it("C2: zero estagios -> ok=true, MAS o denominador aparece no relatorio", async () => {
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(relatorio.ok).toBe(true);
    expect(relatorio.descobertos).toHaveLength(0);
    const texto = formatarCobertura(relatorio);
    // "Nenhum problema" sozinho seria uma armadilha. O relatorio diz
    // quantos estagios foram olhados e quais faltam.
    expect(texto).toContain("Estagios descobertos em disco: 0");
    expect(texto).toContain("nenhum estagio implementado ainda");
    expect(texto).toContain("Estagios canonicos pendentes");
    for (const nome of ORDEM_ESTAGIOS) expect(texto).toContain(nome);
  });

  it("--estagio filtra a checagem a um estagio so", async () => {
    await criarEstagio("locucao");
    await criarCassete("locucao");
    await criarEstagio("musica");
    const todos = await verificarCobertura({ raizEstagios, raizCassetes });
    expect(todos.ok).toBe(false);
    const so = await verificarCobertura({
      raizEstagios,
      raizCassetes,
      apenasEstagio: "locucao",
    });
    expect(so.ok).toBe(true);
    expect(so.descobertos.map((e) => e.nome)).toEqual(["locucao"]);
  });

  it("o relatorio nomeia os estagios canonicos ainda nao entregues", async () => {
    await criarEstagio("locucao");
    await criarCassete("locucao");
    const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
    expect([...relatorio.aindaNaoEntregues]).toEqual([
      "grafico",
      "midia",
      "codigo",
      "musica",
    ]);
  });
});

// ─── A arvore de verdade ───────────────────────────────────────────────────────

describe("A arvore real do repositorio", () => {
  it("a raiz padrao de estagios e src/resolucao", () => {
    expect(RAIZ_ESTAGIOS_PADRAO).toBe("src/resolucao");
  });

  it("nenhum diretorio de infraestrutura e confundido com estagio", async () => {
    const achados = await descobrirEstagios(RAIZ_ESTAGIOS_PADRAO);
    // cassete/ e rede/ existem e nao tem estagio.ts.
    expect(achados.map((e) => e.nome)).not.toContain("cassete");
    expect(achados.map((e) => e.nome)).not.toContain("rede");
  });

  it("todo estagio real que existir hoje esta coberto por cassete", async () => {
    const relatorio = await verificarCobertura({
      raizCassetes: "fixtures/cassetes",
    });
    expect(relatorio.ok, formatarCobertura(relatorio)).toBe(true);
  });
});
