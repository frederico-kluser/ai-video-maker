// =============================================================================
// ausencia — o ∅-crit da suite integrada
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// O criterio do PROGRAMA, na forma executavel:
//
//   "remover um no da fixture TEM de ficar vermelho por AUSENCIA, e nao
//    passar por 'menos frames para comparar'"
//
// Procedimento, para CADA no do manifesto canonico:
//
//   1. MUTA a fixture integrada (manifesto-integrado.json): remove o no de
//      `nos`, remove a referencia da sua cena, remove a cena se ficou vazia,
//      remove a entrada de `nos_grafico`. O manifesto resultante continua
//      VALIDO — o que muda e que o no nao esta mais la.
//   2. RODA O GATE de verdade (vitest em tests/integracao/composicao/
//      presenca.test.ts — o mesmo arquivo que `just int-composicao` roda).
//      Exige: exit != 0 E a saida NOMEIA O NO removido.
//   3. RESTAURA a fixture byte a byte do backup e exige que o gate volte ao
//      VERDE (controle positivo nas duas pontas).
//
// O que o script REPROVA de proposito:
//   - gate que passa com a mutacao         (o no sumiu e nada acusou);
//   - gate que falha por outro motivo      (a falha tem de ser AUSENCIA do
//     no, nomeando o id — nao "menos frames", nao "exit code", nao um erro
//     generico de render);
//   - restauracao que nao devolve o verde  (a mutacao vazou).
//
// Uso:  npx tsx tests/integracao/composicao/ausencia.ts
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Manifesto } from "../../../src/contratos/manifesto";
import { manifestoCanonico } from "./fiar";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const CAMINHO_FIXTURA = resolve(
  RAIZ,
  "fixtures",
  "snapshots",
  "integrado",
  "manifesto-integrado.json",
);

/** O gate: o arquivo de presenca que `just int-composicao` tambem roda. */
const GATE = ["npx", "vitest", "run", "tests/integracao/composicao/presenca.test.ts"];

interface ResultadoDoGate {
  exit: number;
  saida: string;
}

function rodarGate(): ResultadoDoGate {
  try {
    const saida = execFileSync("npx", GATE.slice(1), {
      cwd: RAIZ,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exit: 0, saida };
  } catch (erro) {
    const e = erro as { status?: number; stdout?: string; stderr?: string };
    return { exit: e.status ?? 1, saida: `${e.stdout ?? ""}\n${e.stderr ?? ""}` };
  }
}

interface FixtureCompleta {
  schema_version: string;
  hash_manifesto_original: string;
  manifesto: Manifesto;
  assets: Record<string, unknown>;
  nos_grafico: Record<string, string>;
}

function lerFixture(): FixtureCompleta {
  return JSON.parse(readFileSync(CAMINHO_FIXTURA, "utf8")) as FixtureCompleta;
}

function escreverFixture(fixture: FixtureCompleta): void {
  writeFileSync(CAMINHO_FIXTURA, `${JSON.stringify(fixture, null, 2)}\n`);
}

/** Remove um no da fixture, mantendo o manifesto valido. */
function removerNo(fixture: FixtureCompleta, noId: string): void {
  fixture.manifesto.nos = fixture.manifesto.nos.filter((n) => n.id !== noId);
  for (const cena of fixture.manifesto.cenas) {
    cena.nos = cena.nos.filter((id) => id !== noId);
  }
  fixture.manifesto.cenas = fixture.manifesto.cenas.filter(
    (cena) => cena.nos.length > 0,
  );
  delete fixture.nos_grafico[noId];
}

function principal(): number {
  const backup = readFileSync(CAMINHO_FIXTURA);
  const canonico = manifestoCanonico();
  let falhas = 0;

  process.stdout.write("=== integrado ausencia (∅-crit) ===\n");
  process.stdout.write(`  gate: ${GATE.join(" ")}\n`);
  process.stdout.write(
    `  mutando a fixture integrada no por no (${String(canonico.nos.length)} nos)\n`,
  );

  // Controle positivo ANTES: a fixture intacta tem de estar verde.
  process.stdout.write("  controle positivo inicial: gate com a fixture intacta\n");
  const verdeInicial = rodarGate();
  if (verdeInicial.exit !== 0) {
    process.stdout.write(
      `  FALHOU: o gate nao esta verde com a fixture intacta (exit ${String(verdeInicial.exit)})\n`,
    );
    return 1;
  }
  process.stdout.write("    verde\n");

  try {
    for (const no of canonico.nos) {
      const fixture = lerFixture();
      removerNo(fixture, no.id);
      escreverFixture(fixture);

      const resultado = rodarGate();

      // A mutacao TEM de ficar VERMELHA...
      if (resultado.exit === 0) {
        process.stdout.write(
          `  FALHOU  no "${no.id}": o gate FICOU VERDE com o no removido — ` +
            `a ausencia nao acusou (falso verde do ∅-crit)\n`,
        );
        falhas++;
      } else if (!resultado.saida.includes(no.id)) {
        // ...E VERMELHA POR AUSENCIA DESTE NO: a falha tem de nomear o no.
        process.stdout.write(
          `  FALHOU  no "${no.id}": o gate ficou VERMELHO mas a saida nao ` +
            `nomeia o no — a falha nao e por presenca (pode ser "menos ` +
            `frames", exit generico ou erro de outra natureza)\n`,
        );
        falhas++;
      } else {
        process.stdout.write(`  no "${no.id}": removido -> VERMELHO por ausencia (nomeado)\n`);
      }

      // Restaura byte a byte e exige o verde de volta.
      writeFileSync(CAMINHO_FIXTURA, backup);
    }
  } finally {
    // A restauracao e garantida mesmo se algo acima estourar: a fixture
    // integrada nunca pode ficar mutada em disco.
    writeFileSync(CAMINHO_FIXTURA, backup);
  }

  const restaurou = readFileSync(CAMINHO_FIXTURA).equals(backup);
  if (!restaurou) {
    process.stdout.write("  FALHOU: a fixture nao voltou byte a byte do backup\n");
    return 1;
  }

  // Controle positivo DEPOIS: restaurada, o gate tem de estar verde.
  process.stdout.write("  controle positivo final: gate com a fixture restaurada\n");
  const verdeFinal = rodarGate();
  if (verdeFinal.exit !== 0) {
    process.stdout.write(
      `  FALHOU: o gate nao voltou ao VERDE apos a restauracao (exit ${String(verdeFinal.exit)})\n`,
    );
    return 1;
  }
  process.stdout.write("    verde\n");

  if (falhas > 0) {
    process.stdout.write(`\n=== VERMELHO: ${String(falhas)} no(s) com ∅-crit violado ===\n`);
    return 1;
  }

  process.stdout.write(
    `\n=== VERDE: ${String(canonico.nos.length)} nos removidos um a um, ` +
      `todos acusados por ausencia, fixture restaurada ===\n`,
  );
  return 0;
}

process.exit(principal());
