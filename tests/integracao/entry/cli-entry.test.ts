/**
 * tests/integracao/entry/cli-entry.test.ts
 *
 * O ENTRY DEFAULT DO REMOTION — regressao permanente do fix da Onda 1
 * (commit "onda1-fix-entry-dev": src/index.ts importa a raiz estaticamente).
 *
 * src/index.ts e o entry que o CLI usa quando roda SEM entry explicito
 * (`npm run dev` / `just dev` → `npx remotion studio`). Antes do fix ele
 * era `export {}` e o CLI falhava com "Waiting for registerRoot() to get
 * called" — o runtime do Studio nunca via o registro da raiz.
 *
 * O que este arquivo prova, em tres camadas (falsifiable-gates: gate por
 * CONTEUDO, nunca so exit code — C2):
 *
 *   1. INTEGRACAO REAL (CLI): `npx remotion compositions src/index.ts`
 *      lista a composicao id="manifesto". Este e o oraculo ponta a ponta:
 *      a validacao textual do CLI aceita o entry por ter a palavra
 *      "registerRoot" (no comentario!), mas so o import estatico faz a
 *      raiz registar de verdade — um entry que perdesse o import sem
 *      perder o comentario listaria ZERO composicoes e este teste ficaria
 *      VERMELHO. O comando usa a MESMA pipeline de bundle do Studio
 *      (o Studio em si e processo de longa duracao, alvo ruim de teste
 *      deterministico).
 *
 *   2. MODO DE FALHA (autoteste do gate): entry vazio (`export {}` — a
 *      forma exata do placeholder antigo) faz o CLI falhar com a mensagem
 *      literal `does not contain "registerRoot"`. Assertar a MENSAGEM,
 *      nunca so o exit code: um CLI que quebra por outro motivo (bundle
 *      quebrado, Chrome ausente) tambem sai != 0 — so a mensagem
 *      distingue "acusou" de "quebrou".
 *
 *   3. WIRING (fonte, sem CLI — rapido): a cadeia src/index.ts →
 *      composicao/raiz.tsx → registerRoot(RaizRemotion) lida no fonte,
 *      com sonda negativa explicita contra a reintroducao do placeholder.
 *      Arquivo ausente ou import apagado = FALHA (nunca "verde por nao
 *      fazer nada"): readFileSync lanca, e a assercao de conteudo falha.
 *
 * Comando real que este arquivo oracula (medido nesta maquina, remotion
 * 4.0.507):
 *
 *   npx remotion compositions src/index.ts
 *   → exit 0, stdout: "manifesto    30      1920x1080      727 (24.23 sec)"
 *
 *   npx remotion compositions <entry-vazio.ts>   (conteudo: `export {};`)
 *   → exit 1, stderr: 'You passed <path> as your entry point, but this
 *     file does not contain "registerRoot". ...'
 */

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Raiz do repositorio: este arquivo vive em tests/integracao/entry/.
const RAIZ = resolve(import.meta.dirname, "..", "..", "..");
const ENTRY_DEFAULT = "src/index.ts"; // relativo ao RAIZ, como o `npm run dev`
const CAMINHO_RAIZ_COMPOSICAO = join(RAIZ, "src", "composicao", "raiz.tsx");

interface ResultadoCli {
  /** stdout + stderr concatenados (a mensagem de erro do CLI vai para stderr). */
  readonly saida: string;
  /** Exit code; null quando o processo foi morto por sinal (ex.: timeout). */
  readonly codigo: number | null;
}

// O bundle + lancamento do Chrome Headless Shell passam de 5 s (o timeout
// default do vitest) sob a suite paralela: cada `it` de CLI declara o
// proprio orcamento, como a suite ja faz para fases longas
// (tests/design/font-resolve.test.ts:60-65).
const TEMPO_CLI_INTEGRACAO = 60_000;
const TEMPO_CLI_MODO_DE_FALHA = 30_000;

/** Roda o CLI do Remotion exatamente como `npm run dev` o invoca (via npx). */
function rodarCli(args: string[]): Promise<ResultadoCli> {
  return new Promise((resolver) => {
    execFile(
      "npx",
      ["remotion", ...args],
      { cwd: RAIZ, timeout: 120_000 },
      (erro, stdout, stderr) => {
        const saida = `${stdout}${stderr}`;
        if (erro === null) {
          resolver({ saida, codigo: 0 });
          return;
        }
        // erro.code e o exit code do processo quando ele saiu sozinho;
        // null quando morreu por sinal (timeout).
        const codigo = typeof erro.code === "number" ? erro.code : null;
        resolver({ saida, codigo });
      },
    );
  });
}

// ---------------------------------------------------------------------------
// 1. Integracao real com o CLI — o oraculo de ponta a ponta
// ---------------------------------------------------------------------------

describe("entry default do Remotion: o CLI lista a composicao registrada", () => {
  it("`npx remotion compositions src/index.ts` imprime a composicao id='manifesto'", async () => {
    const resultado = await rodarCli(["compositions", ENTRY_DEFAULT]);

    // C2: parse NAO-vazio obrigatorio antes de comparar valor — uma
    // saida vazia (bundle que nem chegou a rodar) nao pode passar.
    expect(resultado.saida.length).toBeGreaterThan(0);
    expect(resultado.codigo).toBe(0);

    // O contrato do entry: a raiz registra a composicao id="manifesto"
    // (src/composicao/raiz.tsx:32, ID_COMPOSICAO). A mensagem extra da
    // assercao mostra a saida real do CLI quando o teste falhar.
    expect(resultado.saida, `saida real do CLI:\n${resultado.saida}`).toContain(
      "manifesto",
    );
  }, TEMPO_CLI_INTEGRACAO);
});

// ---------------------------------------------------------------------------
// 2. Modo de falha — o autoteste do gate asserta a MENSAGEM
// ---------------------------------------------------------------------------

describe("entry default do Remotion: o modo de falha do CLI", () => {
  it("entry vazio (`export {}`) falha com 'does not contain \"registerRoot\"'", async () => {
    const dir = await mkdtemp(join(tmpdir(), "entry-default-vazio-"));
    try {
      // A forma exata do placeholder antigo de src/index.ts.
      const entryVazio = join(dir, "entry.ts");
      await writeFile(entryVazio, "export {};\n", "utf-8");

      const resultado = await rodarCli(["compositions", entryVazio]);

      // O exit code e o sinal fraco: so a MENSAGEM distingue "o CLI
      // acusou o entry vazio" de "o CLI quebrou por outro motivo".
      expect(resultado.codigo).not.toBe(0);
      expect(resultado.saida, `saida real do CLI:\n${resultado.saida}`).toContain(
        'does not contain "registerRoot"',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, TEMPO_CLI_MODO_DE_FALHA);
});

// ---------------------------------------------------------------------------
// 3. Wiring — a cadeia lida no fonte, com sonda negativa (rapido, sem CLI)
// ---------------------------------------------------------------------------

describe("entry default do Remotion: wiring no fonte", () => {
  it("src/index.ts importa estaticamente a raiz (`import \"./composicao/raiz\"`)", () => {
    const fonte = readFileSync(resolve(RAIZ, ENTRY_DEFAULT), "utf-8");
    expect(fonte).toContain('import "./composicao/raiz"');
  });

  it("src/index.ts NAO e mais o placeholder vazio (`export {}`)", () => {
    const fonte = readFileSync(resolve(RAIZ, ENTRY_DEFAULT), "utf-8");
    // Sonda negativa: a reintroducao do placeholder derruba o
    // `npm run dev` ("Waiting for registerRoot() to get called").
    expect(fonte).not.toContain("export {}");
  });

  it("a cadeia termina em registerRoot: composicao/raiz.tsx chama registerRoot(RaizRemotion)", () => {
    const raiz = readFileSync(CAMINHO_RAIZ_COMPOSICAO, "utf-8");
    // A CHAMADA, nao a mencao textual: uma linha `// registerRoot(...)`
    // comentada tambem contem a string e registraria ZERO composicoes —
    // o teste exige a chamada no inicio da linha, fora de comentario.
    expect(raiz).toMatch(/^registerRoot\(RaizRemotion\)/m);
  });
});
