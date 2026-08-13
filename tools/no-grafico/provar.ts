// =============================================================================
// provar — render 2x, bytes identicos, snapshot aprovado e assercao de PIXEL
// =============================================================================
// Card: F1-09 (onda W4)
//
// O que este script recusa a aceitar como prova:
//
//   exit 0 do render        — C1: quadro preto tambem sai com exit 0.
//   arquivo com bytes       — um retangulo chapado tem bytes de sobra.
//   "renderizou igual 2x"   — um quadro vazio tambem e deterministico.
//
// Entao alem de comparar bytes ele MEDE o quadro: exige tinta (nao esta vazio),
// exige transparencia (nao e retangulo opaco) e exige os quatro cantos com
// alfa 0 — que e a assinatura de pixel de "o no compoe sobre a cena".
//
// AUSENCIA E VERMELHO. Ao contrario de tools/determinismo/provar.sh, este
// script NAO cria o snapshot que falta: snapshot ausente e reprovacao, e
// gravar so acontece sob `--aprovar`, explicitamente.
//
// Uso:
//   npx tsx tools/no-grafico/provar.ts             # confere
//   npx tsx tools/no-grafico/provar.ts --aprovar   # (re)grava os aprovados
// =============================================================================

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lerCabecalhoPng, lerPngRgba, medirQuadro, TIPO_DE_COR } from "./png";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const DIR_FIXTURE = resolve(RAIZ, "fixtures", "snapshots", "no-grafico");
const ENTRADA = resolve(DIR_FIXTURE, "index.tsx");
const DIR_ASSETS = resolve(DIR_FIXTURE, "assets");
const DIR_APROVADO = resolve(DIR_FIXTURE, "aprovado");
const DIR_RECEBIDO = resolve(DIR_FIXTURE, "recebido");

/**
 * Faixa de porta do card F1-09 (docs/contrato-w4.md §4).
 *
 * Sobrescrevivel por `NO_GRAFICO_PORTA` para quem roda este script como
 * FILHO de um processo que ja mantem um navegador aberto na porta padrao
 * (e o caso de tools/no-grafico/mutar.ts, cujas sondas negativas disparam
 * provar.ts de dentro do proprio processo): um navegador do pai segurando
 * 3109 faria o filho cair com EADDRINUSE — o que aconteceu na W4 e esta
 * registrado no handoff do card.
 */
const PORTA = Number.parseInt(process.env.NO_GRAFICO_PORTA ?? "3109", 10) || 3109;

/** Frame do still. Espelha FRAME_DO_SNAPSHOT de cenario.ts. */
const FRAME = 20;

/** As composicoes que TEM de renderizar. A que tem de falhar vive em mutar.ts. */
const COMPOSICOES = ["no-grafico-dados", "no-grafico-asset"] as const;

interface Falha {
  readonly composicao: string;
  readonly motivo: string;
}

function nomeDoArquivo(composicao: string): string {
  return `${composicao}-frame${String(FRAME)}.png`;
}

/** As assercoes de pixel. Devolve os motivos de reprovacao. */
function conferirPixels(composicao: string, arquivo: Buffer): string[] {
  const motivos: string[] = [];
  const cabecalho = lerCabecalhoPng(arquivo);

  if (cabecalho.tipoDeCor !== TIPO_DE_COR.rgba) {
    motivos.push(
      `o still saiu com tipo de cor ${String(cabecalho.tipoDeCor)}, nao ${String(TIPO_DE_COR.rgba)} ` +
        `(RGBA): sem canal alfa o snapshot nao consegue distinguir "compoe ` +
        `sobre a cena" de "tapa a cena"`,
    );
    return motivos;
  }

  const medida = medirQuadro(lerPngRgba(arquivo));

  if (medida.fracaoComTinta === 0) {
    motivos.push(
      "quadro VAZIO: nenhum pixel com alfa > 0. Um quadro vazio renderiza, " +
        "sai com exit 0 e e perfeitamente deterministico (C1)",
    );
  }
  if (medida.fracaoTransparente === 0) {
    motivos.push(
      "quadro TOTALMENTE OPACO: nenhum pixel transparente. E exatamente o " +
        "retangulo por cima do fundo que este card existe para impedir",
    );
  }
  if (medida.coresDistintas < 8) {
    motivos.push(
      `so ${String(medida.coresDistintas)} cores distintas no quadro — desenho de ` +
        "verdade tem mais que isso; um bloco chapado tem uma ou duas",
    );
  }
  const cantoOpaco = medida.alfaDosCantos.findIndex((alfa) => alfa !== 0);
  if (cantoOpaco >= 0) {
    motivos.push(
      `o canto ${String(cantoOpaco)} tem alfa ${String(medida.alfaDosCantos[cantoOpaco])}, ` +
        "nao 0: o no pintou fora do proprio desenho",
    );
  }

  process.stdout.write(
    `  ${composicao}: tinta=${medida.fracaoComTinta.toFixed(4)} ` +
      `transparente=${medida.fracaoTransparente.toFixed(4)} ` +
      `cores=${String(medida.coresDistintas)} ` +
      `cantos=[${medida.alfaDosCantos.join(",")}]\n`,
  );

  return motivos;
}

async function principal(): Promise<number> {
  const aprovar = process.argv.includes("--aprovar");
  const temporario = mkdtempSync(join(tmpdir(), "no-grafico-"));
  const falhas: Falha[] = [];

  // Artefatos de uma execucao VERMELHA anterior (diagnostico em
  // fixtures/snapshots/no-grafico/recebido/) nao podem fazer uma execucao
  // VERDE seguinte falhar o gate de status (C3): recebido e diagnostico,
  // nunca estado. Limpar antes de renderizar.
  rmSync(DIR_RECEBIDO, { recursive: true, force: true });

  process.stdout.write("=== no-grafico provar: determinismo + snapshot + pixel ===\n");
  process.stdout.write(`  entrada: ${ENTRADA}\n`);

  const servidor = await bundle({
    entryPoint: ENTRADA,
    publicDir: DIR_ASSETS,
    onProgress: () => undefined,
  });
  process.stdout.write("  bundle: OK\n");

  try {
    for (const id of COMPOSICOES) {
      const composicao = await selectComposition({ serveUrl: servidor, id, logLevel: "error" });

      const saidas: string[] = [];
      for (const passada of [1, 2]) {
        const destino = join(temporario, `${id}-${String(passada)}.png`);
        await renderStill({
          composition: composicao,
          serveUrl: servidor,
          output: destino,
          frame: FRAME,
          imageFormat: "png",
          port: PORTA,
          chromiumOptions: { gl: "swangle" },
          logLevel: "error",
          overwrite: true,
        });
        saidas.push(destino);
      }

      const [primeiro, segundo] = saidas as [string, string];
      const bytes1 = readFileSync(primeiro);
      const bytes2 = readFileSync(segundo);

      if (!bytes1.equals(bytes2)) {
        mkdirSync(DIR_RECEBIDO, { recursive: true });
        copyFileSync(primeiro, resolve(DIR_RECEBIDO, `render1-${nomeDoArquivo(id)}`));
        copyFileSync(segundo, resolve(DIR_RECEBIDO, `render2-${nomeDoArquivo(id)}`));
        falhas.push({
          composicao: id,
          motivo: `render 1 e render 2 diferem em bytes — determinismo refutado (artefatos em ${DIR_RECEBIDO})`,
        });
        continue;
      }
      process.stdout.write(`  ${id}: render 2x -> bytes identicos\n`);

      for (const motivo of conferirPixels(id, bytes1)) {
        falhas.push({ composicao: id, motivo });
      }

      const aprovado = resolve(DIR_APROVADO, nomeDoArquivo(id));
      if (aprovar) {
        mkdirSync(DIR_APROVADO, { recursive: true });
        copyFileSync(primeiro, aprovado);
        process.stdout.write(`  ${id}: APROVADO gravado em ${aprovado}\n`);
        continue;
      }

      if (!existsSync(aprovado)) {
        falhas.push({
          composicao: id,
          motivo:
            `snapshot aprovado AUSENTE (${aprovado}). Ausencia e reprovacao: ` +
            `este script nao grava o que falta. Para aprovar de proposito, ` +
            `rode com --aprovar`,
        });
        continue;
      }

      if (!readFileSync(aprovado).equals(bytes1)) {
        mkdirSync(DIR_RECEBIDO, { recursive: true });
        copyFileSync(primeiro, resolve(DIR_RECEBIDO, `atual-${nomeDoArquivo(id)}`));
        falhas.push({
          composicao: id,
          motivo: `o render diverge do snapshot aprovado (artefato em ${DIR_RECEBIDO})`,
        });
        continue;
      }
      process.stdout.write(`  ${id}: identico ao snapshot aprovado\n`);
    }
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }

  if (falhas.length > 0) {
    process.stdout.write("\n");
    for (const falha of falhas) {
      process.stdout.write(`  FALHOU  ${falha.composicao}: ${falha.motivo}\n`);
    }
    process.stdout.write("\n=== VERMELHO: no-grafico provar ===\n");
    return 1;
  }

  process.stdout.write("\n=== VERDE: no-grafico provar ===\n");
  return 0;
}

process.exit(await principal());
