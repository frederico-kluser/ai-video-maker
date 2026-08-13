// =============================================================================
// MARCACAO APROVADA DO NO DE MIDIA — F1-07
// =============================================================================
// O still (tools/no-midia/provar.ts) prova o PIXEL. Este arquivo prova a
// ARVORE: o que a funcao pura emite, byte a byte, antes de qualquer navegador.
//
// Os dois existem porque falham por motivos diferentes. Uma regressao de
// atributo (`data-quadro-gif` que parou de mudar) aparece aqui na hora, com
// diff legivel; uma regressao de rasterizacao so aparece no PNG.
//
// Uso:
//   npx tsx tools/no-midia/marcacao.ts             # confere (nao escreve)
//   npx tsx tools/no-midia/marcacao.ts --aprovar   # regrava o aprovado
//
// O modo de conferencia NUNCA escreve em aprovados/. Se escrevesse, apagar um
// snapshot aprovado seria consertado em silencio pelo proprio gate — e o
// ∅-crit do card ficaria verde justamente quando devia ficar vermelho.
// =============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import Midia from "../../src/composicao/nos/midia";
import {
  ALTURA,
  CASOS_DE_MARCACAO,
  DIR_APROVADOS,
  FPS,
  LARGURA,
  noDeMidiaDaFixture,
  type CasoDeMarcacao,
} from "../../fixtures/snapshots/no-midia/casos";

const ESTE_ARQUIVO = fileURLToPath(import.meta.url);
const AQUI = dirname(ESTE_ARQUIVO);
const RAIZ = resolve(AQUI, "..", "..");
const APROVADOS = resolve(RAIZ, DIR_APROVADOS);

/** Renderiza a marcacao de um caso. Funcao pura: mesmo caso, mesmos bytes. */
export function marcacaoDoCaso(caso: CasoDeMarcacao): string {
  const no = noDeMidiaDaFixture(caso.noId);
  const html = renderToStaticMarkup(
    createElement(Midia, {
      no,
      frame: caso.frame,
      fps: FPS,
      width: LARGURA,
      height: ALTURA,
    }),
  );
  return `${html}\n`;
}

function main(): void {
  const aprovar = process.argv.includes("--aprovar");
  const problemas: string[] = [];

  if (CASOS_DE_MARCACAO.length === 0) {
    // C2: um seletor que nao casa nada sai verde sem olhar nada.
    console.error("FALHOU: nenhum caso de marcacao — seletor vazio e falso verde");
    process.exit(1);
  }

  if (aprovar) {
    mkdirSync(APROVADOS, { recursive: true });
  }

  for (const caso of CASOS_DE_MARCACAO) {
    const alvo = resolve(APROVADOS, caso.arquivo);
    const atual = marcacaoDoCaso(caso);

    if (aprovar) {
      writeFileSync(alvo, atual, "utf-8");
      console.log(`  aprovado  ${caso.arquivo}  (${caso.porque})`);
      continue;
    }

    if (!existsSync(alvo)) {
      problemas.push(
        `${caso.arquivo}: AUSENTE em ${DIR_APROVADOS}/. ` +
          `Snapshot que sumiu e VERMELHO, nunca "nada a comparar".`,
      );
      continue;
    }
    const aprovado = readFileSync(alvo, "utf-8");
    if (aprovado !== atual) {
      const posicao = primeiraDiferenca(aprovado, atual);
      problemas.push(
        `${caso.arquivo}: marcacao diverge do aprovado na posicao ${String(posicao)}\n` +
          `      aprovado: ...${trecho(aprovado, posicao)}...\n` +
          `      atual:    ...${trecho(atual, posicao)}...`,
      );
      continue;
    }
    console.log(`  confere   ${caso.arquivo}`);
  }

  if (problemas.length > 0) {
    console.error("");
    console.error(`FALHOU: ${String(problemas.length)} problema(s) de marcacao:`);
    for (const p of problemas) console.error(`  - ${p}`);
    process.exit(1);
  }

  console.log(
    aprovar
      ? `marcacao: ${String(CASOS_DE_MARCACAO.length)} caso(s) regravado(s)`
      : `marcacao: ${String(CASOS_DE_MARCACAO.length)} caso(s) identicos ao aprovado`,
  );
}

/** Indice do primeiro caractere diferente entre dois textos. */
function primeiraDiferenca(a: string, b: string): number {
  const limite = Math.min(a.length, b.length);
  for (let i = 0; i < limite; i++) {
    if (a[i] !== b[i]) return i;
  }
  return limite;
}

/** Janela de texto em volta de uma posicao, para a mensagem de erro. */
function trecho(texto: string, posicao: number): string {
  const raio = 60;
  return texto.slice(Math.max(0, posicao - raio), posicao + raio);
}

/** Caminho absoluto de um artefato aprovado deste card. */
export function caminhoAprovado(arquivo: string): string {
  return resolve(APROVADOS, arquivo);
}

// Roda so quando invocado direto. O teste importa `marcacaoDoCaso` deste
// mesmo arquivo — uma segunda copia da renderizacao seria uma segunda
// verdade, e as duas divergiriam no primeiro merge.
const invocadoDireto =
  process.argv[1] !== undefined && resolve(process.argv[1]) === ESTE_ARQUIVO;

if (invocadoDireto) {
  main();
}
