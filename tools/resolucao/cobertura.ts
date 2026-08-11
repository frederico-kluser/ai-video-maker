#!/usr/bin/env npx tsx
/**
 * tools/resolucao/cobertura.ts
 *
 * ∅-crit executavel: todo estagio em `src/resolucao/<nome>/estagio.ts`
 * tem de ter cassete em `fixtures/cassetes/<nome>/<chave>/`.
 *
 * Chamado por `just res:offline`. Sai 1 se algum estagio nao estiver
 * coberto.
 *
 * O AUTOTESTE e a parte que importa. Hoje a W4 ainda nao entregou
 * estagio nenhum, entao a varredura de producao encontra zero estagios e
 * passa por vacuidade — que e exatamente a armadilha C2 ("filtro que nao
 * casa nada sai verde"). Para que "coberto" signifique alguma coisa
 * mesmo com zero estagios, este script monta, a cada execucao, duas
 * arvores temporarias:
 *
 *   A) um estagio COM cassete   -> o verificador tem de dizer OK
 *   B) um estagio SEM cassete   -> o verificador tem de dizer FALHOU
 *
 * Se qualquer um dos dois responder errado, o verificador esta cego e
 * este script sai 1 — mesmo que a arvore de producao esteja limpa.
 *
 * Uso:
 *   npx tsx tools/resolucao/cobertura.ts [--estagio <nome>]
 */

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ARQUIVO_MARCADOR,
  formatarCobertura,
  verificarCobertura,
} from "../../src/resolucao/descoberta.js";
import { ARQUIVOS_OBRIGATORIOS } from "../../src/resolucao/cassete/formato.js";

const RAIZ_ESTAGIOS = "src/resolucao";
const RAIZ_CASSETES = "fixtures/cassetes";
const CHAVE_FALSA = "0123456789abcdef".repeat(4);

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ─── Autoteste do verificador ───────────────────────────────────────────────────

interface ResultadoAutoteste {
  readonly ok: boolean;
  readonly linhas: readonly string[];
}

async function autoteste(): Promise<ResultadoAutoteste> {
  const linhas: string[] = [];
  const tmp = await mkdtemp(join(tmpdir(), "cobertura-autoteste-"));
  try {
    const raizEstagios = join(tmp, "src", "resolucao");
    const raizCassetes = join(tmp, "fixtures", "cassetes");

    // Cenario A: estagio COM cassete
    await mkdir(join(raizEstagios, "locucao"), { recursive: true });
    await writeFile(
      join(raizEstagios, "locucao", ARQUIVO_MARCADOR),
      "export default {};\n",
      "utf-8",
    );
    const dirCassete = join(raizCassetes, "locucao", CHAVE_FALSA);
    await mkdir(dirCassete, { recursive: true });
    for (const arquivo of ARQUIVOS_OBRIGATORIOS) {
      await writeFile(join(dirCassete, arquivo), "{}\n", "utf-8");
    }

    const a = await verificarCobertura({ raizEstagios, raizCassetes });
    const aOk = a.ok && a.descobertos.length === 1;
    linhas.push(
      aOk
        ? "  [OK] autoteste A: estagio com cassete e reconhecido como coberto"
        : "  [FALHOU] autoteste A: o verificador nao reconheceu um estagio COBERTO",
    );

    // Cenario B: estagio SEM cassete
    await mkdir(join(raizEstagios, "musica"), { recursive: true });
    await writeFile(
      join(raizEstagios, "musica", ARQUIVO_MARCADOR),
      "export default {};\n",
      "utf-8",
    );
    const b = await verificarCobertura({ raizEstagios, raizCassetes });
    const bOk =
      !b.ok &&
      b.cobertura.some(
        (c) => c.nome === "musica" && c.problemas.join("\n").includes("∅-crit"),
      );
    linhas.push(
      bOk
        ? "  [OK] autoteste B: estagio SEM cassete derruba a cobertura"
        : "  [FALHOU] autoteste B: o verificador PULOU um estagio sem cassete",
    );

    return { ok: aOk && bOk, linhas };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const apenasEstagio = argumento("--estagio");

  console.log("=== res: cobertura de cassetes (∅-crit) ===");
  console.log("");
  console.log("Autoteste do verificador (C2: sem isto, zero estagios = verde vazio):");
  const auto = await autoteste();
  for (const linha of auto.linhas) console.log(linha);
  console.log("");

  if (!auto.ok) {
    console.log("VERMELHO: o verificador de cobertura esta cego.");
    console.log("Conserte o verificador antes de confiar em qualquer resultado abaixo.");
    return 1;
  }

  const relatorio = await verificarCobertura({
    raizEstagios: RAIZ_ESTAGIOS,
    raizCassetes: RAIZ_CASSETES,
    ...(apenasEstagio !== undefined ? { apenasEstagio } : {}),
  });

  console.log("Varredura da arvore de producao:");
  console.log(formatarCobertura(relatorio));
  console.log("");

  if (apenasEstagio !== undefined && relatorio.descobertos.length === 0) {
    console.log(
      `VERMELHO: --estagio ${apenasEstagio} nao casou nenhum estagio em ` +
        `${RAIZ_ESTAGIOS}/${apenasEstagio}/${ARQUIVO_MARCADOR}.`,
    );
    console.log("Filtro que nao casa nada nao pode sair verde (C2).");
    return 1;
  }

  if (!relatorio.ok) {
    console.log("=== VERMELHO: ha estagio sem cassete ===");
    return 1;
  }

  console.log("=== VERDE: todo estagio descoberto tem cassete ===");
  return 0;
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("cobertura: erro inesperado:", erro);
    process.exit(2);
  },
);
