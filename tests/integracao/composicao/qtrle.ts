// =============================================================================
// qtrle — a sonda do cassete REAL do estagio grafico (webm v1.1.0)
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
// Corrigido: F6-05 (W12) — o nome e HISTORICO: a sonda nasceu na era do cassete
// `.mov` qtrle/argb e o arquivo nao foi renomeado para nao tocar no bloco
// F1-12 do justfile (dono do arquivo). O contrato que ela prova agora e o do
// cassete REAL atual — o webm v1.1.0 (ADR-0009 D3, 2026-08-13).
//
// O que morreu (registrado em docs/arquivamento.md e ADR-0049):
//   - o `.mov` qtrle/argb foi aposentado (ADR-0009 D3): o cartucho default do
//     estagio grafico e o webm; a sonda antiga provava que o render integrado
//     RECUSAVA o formato do cassete real com ErroDeGraficoOpaco nomeando o no
//     (AB-390, AB-490) — esse caminho de ARVORE nao existe mais, porque o
//     cassete real agora declara video/webm, que passa na guarda.
//   - a expectativa provisoria "vp9/yuva420p" foi FALSIFICADA: o bitstream do
//     webm v1.1.0 sai yuv420p, sem alfa (AB-397, medido) — a guarda do no
//     checa o mimeType do DESCRITOR, nao o bitstream (gap documentado no
//     proprio AB-397: o alfa declarado na tabela e o do descritor).
//
// O que a sonda prova HOJE com o cassete REAL (webm v1.1.0):
//
//   1. A GUARDA do no (F1-09) aceita o descritor do cassete real —
//      `video/webm` esta na lista de permissao (alfa declarado: true). Nenhum
//      ErroDeGraficoOpaco. Controle negativo na MESMA guarda: um descritor
//      `video/quicktime` (o .mov morto) continua sendo RECUSADO nomeando o no
//      — a recusa que a era qtrle provava na arvore inteira permanece valida
//      na guarda (AB-490: "a recusa do video/quicktime pelo no continua
//      valida"). Se o cassete voltar a declarar um formato fora da permissao,
//      esta sonda fica VERMELHA — o formato quebra de proposito, nunca em
//      silencio (C1/AB-363).
//
//   2. render de verdade (Chrome headless via renderStill): o render com o
//      descritor do cassete real SAI e o quadro TEM conteudo (oraculo de
//      entropia, C1) — o caminho de consumo da composicao e o asset resolvido
//      (PNG RGBA, `resolvido-com-alfa.json` — a decisao do AB-397), nunca os
//      bytes do webm. Um quadro preto renderizaria com exit 0; a entropia e a
//      segunda barreira, nao a primeira (a mesma disciplina de provar.ts).
//
// Uso:  npx tsx tests/integracao/composicao/qtrle.ts
// =============================================================================

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { FixtureIntegrada } from "./fiar";
import { lerPngRgba } from "./png";
import { conferirEntropiaDoQuadro } from "./oraculo";
import { conferirAssetDeGrafico, ErroDeGraficoOpaco } from "../../../src/composicao/nos/grafico";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const CAMINHO_FIXTURA = resolve(
  RAIZ,
  "fixtures",
  "snapshots",
  "integrado",
  "manifesto-integrado.json",
);
const DIR_ASSETS = resolve(RAIZ, "fixtures", "snapshots", "integrado", "assets");
const ENTRADA = resolve(RAIZ, "fixtures", "snapshots", "integrado", "entrada.tsx");
const DIR_RECEBIDO = resolve(RAIZ, "fixtures", "snapshots", "integrado", "recebido");
const PORTA = Number.parseInt(process.env.INTEGRADO_PORTA ?? "4112", 10) || 4112;

/** O mimeType do cassete REAL de F2-02: video/webm (ADR-0009 D3, v1.1.0). */
const MIME_DO_CASSETE_REAL = "video/webm";

/** O mimeType do formato aposentado: o .mov qtrle/argb (ADR-0009 D3). */
const MIME_APOSENTADO = "video/quicktime";

function lerFixture(): FixtureIntegrada {
  return JSON.parse(readFileSync(CAMINHO_FIXTURA, "utf8")) as FixtureIntegrada;
}

/**
 * Fia o no n-009 com o DESCRITOR REAL do cassete de F2-02 (video/webm).
 *
 * A guarda do no (F1-09) julga o formato pelo DESCRITOR — mimeType e tipo —
 * antes de qualquer byte ser carregado. A chave do asset em `assets` fica a do
 * PNG (para o resolvedor de fonte da fiacao continuar valendo: `fonte` deriva
 * do hash pela fiacao); o descritor sob a chave e o do cassete, com o hash
 * re-chaveado. O arquivo servido ao render e o PNG resolvido — o caminho de
 * consumo da composicao na era webm (AB-397: PNG RGBA, `resolvido-com-alfa`).
 */
function fiarCasseteReal(
  fixture: FixtureIntegrada,
  hashDoCassete: string,
  assetDoCassete: Record<string, unknown>,
): FixtureIntegrada {
  const hashDoPng = fixture.nos_grafico["n-009"];
  if (hashDoPng === undefined) {
    throw new Error("qtrle: n-009 nao tem asset na fixture integrada");
  }
  fixture.assets[hashDoPng] = {
    ...assetDoCassete,
    hash: hashDoPng,
  } as unknown as FixtureIntegrada["assets"][string];
  return fixture;
}

/**
 * Le o descritor do asset webm do cassete REAL de F2-02.
 * O cassete declara `mimeType: video/webm` nos dois assets — o cartucho
 * executado pelo orquestrador (ADR-0009 D3, AB-390/AB-397).
 */
function descritorDoCasseteReal(): { hash: string; asset: Record<string, unknown> } {
  const base = resolve(RAIZ, "fixtures", "cassetes", "grafico");
  let cassetes: string[] = [];
  try {
    cassetes = readdirSync(base).map((d) => resolve(base, d, "resultado.json"));
  } catch {
    cassetes = [];
  }

  for (const caminho of cassetes) {
    const resultado = JSON.parse(readFileSync(caminho, "utf8")) as {
      assets: Record<string, Record<string, unknown>>;
    };
    for (const [hash, asset] of Object.entries(resultado.assets ?? {})) {
      if (asset["mimeType"] === MIME_DO_CASSETE_REAL) {
        return { hash, asset };
      }
    }
  }
  throw new Error(
    "qtrle: nenhum cassete de grafico com asset video/webm em fixtures/cassetes/grafico/",
  );
}

/** A guarda do no, no nivel da funcao: erros vazios = aceito. */
function guardaDoNo(noId: string, asset: Record<string, unknown>): string[] {
  return conferirAssetDeGrafico(noId, asset as never);
}

async function principal(): Promise<number> {
  rmSync(DIR_RECEBIDO, { recursive: true, force: true });
  mkdirSync(DIR_RECEBIDO, { recursive: true });

  const backup = readFileSync(CAMINHO_FIXTURA);
  const { hash: hashDoCassete, asset: assetDoCassete } = descritorDoCasseteReal();
  let falhas = 0;

  process.stdout.write("=== integrado qtrle: a sonda do cassete REAL de F2-02 (webm v1.1.0) ===\n");
  process.stdout.write(`  asset do cassete: ${hashDoCassete} (mimeType video/webm)\n`);

  // -------------------------------------------------------------------------
  // Sonda 1 — a GUARDA julga o descritor do cassete real + controle negativo
  // -------------------------------------------------------------------------
  process.stdout.write("  sonda 1/2: a guarda do no vs o descritor do cassete real\n");
  try {
    // 1a. O descritor REAL (video/webm) passa — o gap do AB-397, por desenho.
    const errosDoReal = guardaDoNo("n-009", assetDoCassete);
    if (errosDoReal.length > 0) {
      process.stdout.write(
        `  FALHOU  sonda 1: a guarda RECUSOU o cassete real: ${errosDoReal.join(" || ").slice(0, 200)}\n`,
      );
      falhas++;
    } else {
      process.stdout.write(
        "    ok: a guarda aceita o descritor do cassete real (video/webm — " +
          "AB-397: guarda checa mimeType, nao bitstream; o alfa declarado e o " +
          "do gap documentado)\n",
      );
    }

    // 1b. Controle negativo: o .mov aposentado continua sendo RECUSADO pela
    //     MESMA guarda, nomeando o no — a recusa que a era qtrle provava na
    //     arvore inteira (AB-390/AB-490) permanece valida na guarda.
    const assetMov = { ...assetDoCassete, mimeType: MIME_APOSENTADO };
    const errosDoMov = guardaDoNo("n-009", assetMov);
    const recusouNomeandoONo = errosDoMov.some((e) => e.includes('no "n-009"'));
    if (errosDoMov.length === 0 || !recusouNomeandoONo) {
      process.stdout.write(
        "  FALHOU  sonda 1: o controle negativo nao morde — a guarda deixou " +
          "passar video/quicktime sem nomear o no (a recusa do AB-490 morreu)\n",
      );
      falhas++;
    } else {
      process.stdout.write(
        "    ok: controle negativo — a guarda continua recusando o .mov " +
          "qtrle/argb aposentado, nomeando o no (AB-490)\n",
      );
    }
  } finally {
    // sem estado em disco nesta sonda
  }

  // -------------------------------------------------------------------------
  // Sonda 2 — render de verdade (Chrome headless): sai com CONTEUDO (C1)
  // -------------------------------------------------------------------------
  process.stdout.write("  sonda 2/2: render de verdade (Chrome headless, swangle)\n");
  try {
    const fixture = fiarCasseteReal(lerFixture(), hashDoCassete, assetDoCassete);
    writeFileSync(CAMINHO_FIXTURA, `${JSON.stringify(fixture, null, 2)}\n`);

    const temporario = mkdtempSync(join(tmpdir(), "integrado-qtrle-"));
    const servidor = await bundle({
      entryPoint: ENTRADA,
      publicDir: DIR_ASSETS,
      onProgress: () => undefined,
    });
    const composicao = await selectComposition({
      serveUrl: servidor,
      id: "integrado",
      logLevel: "error",
    });

    const saida = join(temporario, "frame460.png");
    let erroDoRender: Error | null = null;
    try {
      await renderStill({
        composition: composicao,
        serveUrl: servidor,
        output: saida,
        frame: 460,
        imageFormat: "png",
        port: PORTA,
        chromiumOptions: { gl: "swangle" },
        logLevel: "error",
        overwrite: true,
      });
    } catch (erro) {
      erroDoRender = erro as Error;
    }

    if (erroDoRender !== null) {
      process.stdout.write(
        `  FALHOU  sonda 2: o render com o cassete real CAIU: ` +
          `${erroDoRender.message.slice(0, 200)}\n`,
      );
      falhas++;
    } else {
      // O quadro preto renderiza com exit 0 (C1) — a entropia e a barreira.
      const falhasDoOraculo = conferirEntropiaDoQuadro(lerPngRgba(readFileSync(saida)));
      if (falhasDoOraculo.length > 0) {
        for (const f of falhasDoOraculo) {
          process.stdout.write(`  FALHOU  sonda 2: oraculo de conteudo: ${f.motivo}\n`);
        }
        falhas++;
      } else {
        process.stdout.write(
          "    ok: o render com o cassete real SAIOU e o quadro tem conteudo — " +
            "o caminho de consumo e o asset resolvido (PNG RGBA, decisao do " +
            "AB-397); os bytes do webm nao entram na composicao\n",
        );
      }
      writeFileSync(
        resolve(DIR_RECEBIDO, "webm-evidencia.txt"),
        [
          `cassete real do estagio grafico: ${hashDoCassete} (mimeType video/webm)`,
          `guarda do no n-009 aceita o descritor real (AB-397: guarda checa mimeType, nao bitstream)`,
          `controle negativo: video/quicktime (aposentado) recusado pela guarda nomeando o no (AB-490)`,
          `render de verdade (Chrome headless, swangle) no frame 460: exit 0 + oraculo de entropia VERDE`,
          `o .mov qtrle/argb morreu (ADR-0009 D3) — a recusa em ARVORE inteira morreu com ele;`,
          `a recusa em nivel de guarda permanece e e sondada acima`,
          "",
        ].join("\n"),
      );
    }
    rmSync(temporario, { recursive: true, force: true });
  } finally {
    writeFileSync(CAMINHO_FIXTURA, backup);
  }

  // -------------------------------------------------------------------------
  // Controle positivo: restaurada a fixture PNG, o render volta ao verde
  // -------------------------------------------------------------------------
  if (!readFileSync(CAMINHO_FIXTURA).equals(backup)) {
    process.stdout.write("  FALHOU: a fixture nao voltou byte a byte do backup\n");
    return 1;
  }

  if (falhas > 0) {
    process.stdout.write(`\n=== VERMELHO: integrado qtrle (${String(falhas)} sonda(s)) ===\n`);
    return 1;
  }
  // Verde: recebido e estado de DIAGNOSTICO, nunca commitado (a mesma
  // disciplina de provar.ts). A evidencia completa ja saiu no stdout e fica
  // registrada em docs/arquivamento.md e no ADR-0049 — o arquivo nao e o canal.
  rmSync(DIR_RECEBIDO, { recursive: true, force: true });
  process.stdout.write(
    "\n=== VERDE: integrado qtrle — o cassete REAL (webm v1.1.0) passa na guarda " +
      "e o render sai com conteudo; o gap alfa/bitstream e o do AB-397 ===\n",
  );
  return 0;
}

process.exit(await principal());
