// =============================================================================
// PROVA DE DETERMINISMO DO NO DE MIDIA — F1-07
// =============================================================================
// O `det:provar --no <nome>` do PROGRAMA, para o no de midia.
//
// POR QUE UM PROVER PROPRIO, e nao um `--no <nome>` em
// tools/determinismo/provar.sh: aquele script e de F0-06 e SEIS cards de no
// rodam esta onda em paralelo, cegos entre si. Seis agentes editando o mesmo
// script produzem exatamente o merge silencioso que o contrato da W4 manda
// evitar. Cada card prova o proprio no; generalizar o harness e trabalho de
// PREP, com um dono so. Registrado em ledger/inbox/F1-07.json (AB-343).
//
// O que este prover faz, por caso:
//   1. renderiza o still DUAS VEZES, em diretorios temporarios diferentes;
//   2. exige bytes identicos entre os dois renders (determinismo);
//   3. exige bytes identicos ao snapshot APROVADO (regressao);
//   4. conta pixel: opaco > 0 (nao e quadro vazio), transparente > metade
//      (o alfa sobreviveu), cores distintas > 1 (nao e quadro chapado).
//
// E, entre casos: os dois stills do GIF em frames diferentes TEM de diferir.
// Sem essa linha, um GIF que anda pelo relogio passaria em tudo que esta
// acima — cada frame, sozinho, e perfeitamente estavel.
//
// Uso:
//   npx tsx tools/no-midia/provar.ts             # confere (nao escreve)
//   npx tsx tools/no-midia/provar.ts --aprovar   # regrava o aprovado
// =============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CASOS_DE_STILL,
  DIR_APROVADOS,
  ENTRADA_DO_RENDER,
  type CasoDeStill,
} from "../../fixtures/snapshots/no-midia/casos";
import { analisarPng, violacoesDeQuadro } from "./pixels";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const APROVADOS = resolve(RAIZ, DIR_APROVADOS);
const ENTRADA = resolve(RAIZ, ENTRADA_DO_RENDER);

/**
 * `--gl=swangle` = rasterizacao por software (SwiftShader). E o mesmo flag do
 * canario de F0-06: GPU diferente entre maquinas produz bytes diferentes sem
 * nada ficar vermelho.
 */
function renderizarStill(caso: CasoDeStill, destino: string): void {
  execFileSync(
    "npx",
    [
      "remotion",
      "still",
      ENTRADA,
      caso.composicao,
      destino,
      `--frame=${String(caso.frame)}`,
      "--gl=swangle",
    ],
    { cwd: RAIZ, stdio: "pipe", timeout: 300000 },
  );
  if (!existsSync(destino)) {
    throw new Error(
      `render de ${caso.composicao}@${String(caso.frame)} saiu 0 mas nao ` +
        `escreveu arquivo — exit 0 nao e prova de imagem (C1)`,
    );
  }
}

function main(): void {
  const aprovar = process.argv.includes("--aprovar");
  const problemas: string[] = [];

  if (CASOS_DE_STILL.length === 0) {
    console.error("FALHOU: nenhum caso de still — seletor vazio e falso verde (C2)");
    process.exit(1);
  }

  // --- Presenca antes de render: apagar aprovado tem de ficar vermelho SEM
  //     que o gate gaste um render recriando o que foi apagado. -------------
  if (!aprovar) {
    for (const caso of CASOS_DE_STILL) {
      if (!existsSync(resolve(APROVADOS, caso.arquivo))) {
        problemas.push(
          `${caso.arquivo}: AUSENTE em ${DIR_APROVADOS}/. ` +
            `Snapshot que sumiu e VERMELHO, nunca "nada a comparar".`,
        );
      }
    }
    if (problemas.length > 0) {
      console.error(`FALHOU: ${String(problemas.length)} snapshot(s) ausente(s):`);
      for (const p of problemas) console.error(`  - ${p}`);
      process.exit(1);
    }
  } else {
    mkdirSync(APROVADOS, { recursive: true });
  }

  const temporario = mkdtempSync(join(tmpdir(), "no-midia-"));
  const bytesPorCaso = new Map<string, Buffer>();

  try {
    for (const caso of CASOS_DE_STILL) {
      const um = join(temporario, `1-${caso.arquivo}`);
      const dois = join(temporario, `2-${caso.arquivo}`);

      renderizarStill(caso, um);
      renderizarStill(caso, dois);

      const bytesUm = readFileSync(um);
      const bytesDois = readFileSync(dois);

      if (!bytesUm.equals(bytesDois)) {
        problemas.push(
          `${caso.arquivo}: render 1 e render 2 DIVERGEM ` +
            `(${String(bytesUm.length)} vs ${String(bytesDois.length)} bytes) — ` +
            `determinismo refutado`,
        );
        continue;
      }
      bytesPorCaso.set(caso.arquivo, bytesUm);

      // --- O quadro tem conteudo, e o alfa sobreviveu ---
      const analise = analisarPng(um);
      const violacoes = violacoesDeQuadro(analise);
      for (const v of violacoes) {
        problemas.push(`${caso.arquivo}: ${v}`);
      }

      const alvo = resolve(APROVADOS, caso.arquivo);
      if (aprovar) {
        writeFileSync(alvo, bytesUm);
        console.log(
          `  aprovado  ${caso.arquivo}  ` +
            `opacos=${String(analise.opacos)} transparentes=${String(analise.transparentes)} ` +
            `cores=${String(analise.coresDistintas)}`,
        );
        continue;
      }

      const aprovado = readFileSync(alvo);
      if (!aprovado.equals(bytesUm)) {
        problemas.push(
          `${caso.arquivo}: render atual DIVERGE do snapshot aprovado ` +
            `(${String(bytesUm.length)} vs ${String(aprovado.length)} bytes aprovados)`,
        );
        continue;
      }
      console.log(
        `  confere   ${caso.arquivo}  ` +
          `2x identico · opacos=${String(analise.opacos)} ` +
          `transparentes=${String(analise.transparentes)} cores=${String(analise.coresDistintas)}`,
      );
    }

    // --- O GIF andou? Dois frames diferentes, dois bytes diferentes. ---
    const gifs = CASOS_DE_STILL.filter((c) => c.arquivo.includes("gif"));
    if (gifs.length < 2) {
      problemas.push(
        `os casos de still tem ${String(gifs.length)} frame(s) de GIF; ` +
          `sao necessarios pelo menos 2 frames DIFERENTES para que um GIF ` +
          `que anda pelo relogio possa ser reprovado`,
      );
    } else {
      const primeiro = gifs[0]!;
      const segundo = gifs[1]!;
      const a = bytesPorCaso.get(primeiro.arquivo);
      const b = bytesPorCaso.get(segundo.arquivo);
      if (a !== undefined && b !== undefined) {
        if (a.equals(b)) {
          problemas.push(
            `${primeiro.arquivo} e ${segundo.arquivo} sao IDENTICOS: o GIF nao ` +
              `avancou entre os frames ${String(primeiro.frame)} e ` +
              `${String(segundo.frame)} — ou ele anda pelo relogio, ou nao anda`,
          );
        } else {
          console.log(
            `  avanca    ${primeiro.arquivo} != ${segundo.arquivo} ` +
              `(frames ${String(primeiro.frame)} e ${String(segundo.frame)})`,
          );
        }
      }
    }
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }

  if (problemas.length > 0) {
    console.error("");
    console.error(`FALHOU: ${String(problemas.length)} problema(s) no still:`);
    for (const p of problemas) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log(
    aprovar
      ? `still: ${String(CASOS_DE_STILL.length)} caso(s) regravado(s)`
      : `still: ${String(CASOS_DE_STILL.length)} caso(s) renderizados 2x, identicos ao aprovado`,
  );
}

main();
