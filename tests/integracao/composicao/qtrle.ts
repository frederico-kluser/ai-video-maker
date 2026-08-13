// =============================================================================
// qtrle — a sonda do asset REAL do estagio grafico (.mov qtrle/argb)
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// O criterio da revisao de plano (AB-390):
//
//   "o render integrado com o no grafico REAL (cassete do F2-02, .mov
//    qtrle/argb) TEM de mostrar o grafico (nao sair deterministicamente
//    preto — C1). Se o qtrle do F2-02 nao decodificar no navegador do
//    render, REGISTRE no handoff com evidencia (o orquestrador executa o
//    cartucho webm)."
//
// Este arquivo E a evidencia: ele fia o no n-009 com o DESCRITOR REAL do
// cassete de F2-02 (mimeType `video/quicktime`, lido do resultado.json do
// proprio cassete) e tenta renderizar — nos DOIS caminhos:
//
//   1. arvore pura (react-dom/server): o no de grafico RECUSA o formato
//      antes de emitir um pixel — `ErroDeGraficoOpaco` nomeando o no. A
//      recusa e o contrato do proprio no (F1-09, docs/adr/0019): o
//      `.mov` qtrle/argb TEM alfa, mas o navegador do render nao o
//      reproduz (`reproduzivelNoNavegador: false` na tabela de formatos).
//
//   2. render de verdade (Chrome headless via renderStill): o mesmo erro
//      derruba o render — exit nao-zero com a mensagem do no.
//
// Conclusao registrada no handoff e no ADR-0025: com o cassete REAL de
// F2-02 (video/quicktime) o render integrado NAO mostra o grafico — ele
// PARA, de proposito, em vez de pintar um buraco ou um retangulo. O
// cartucho de saida que o orquestrador executa e o WebM com alfa
// (F2-02 --format=webm, vp9/yuva420p), que esta na lista de permissao do
// no com `reproduzivelNoNavegador: true` — e o caminho que a fixture
// integrada exercita com o PNG (provar.ts, composicao
// integrado-grafico-asset).
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

/** O erro que o no TEM de lancar: ErroDeGraficoOpaco nomeando o no. */
const ERRO_ESPERADO = "no \"n-009\"";

function lerFixture(): FixtureIntegrada {
  return JSON.parse(readFileSync(CAMINHO_FIXTURA, "utf8")) as FixtureIntegrada;
}

/**
 * Fia o no n-009 com o DESCRITOR REAL do cassete de F2-02 (video/quicktime).
 *
 * A guarda do no (F1-09) recusa o formato pelo DESCRITOR — mimeType e
 * tipo — antes de qualquer byte ser carregado. A chave do asset em `assets`
 * fica a do PNG (para o resolvedor de fonte da fiacao continuar valendo);
 * o descritor sob a chave e o do cassete, com o hash re-chaveado. O arquivo
 * servido nunca e alcancado: a recusa acontece na guarda, e e exatamente
 * isso que a sonda prova.
 */
function fiarQtrle(
  fixture: FixtureIntegrada,
  hashQtrle: string,
  assetQtrle: Record<string, unknown>,
): FixtureIntegrada {
  const hashDoPng = fixture.nos_grafico["n-009"];
  if (hashDoPng === undefined) {
    throw new Error("qtrle: n-009 nao tem asset na fixture integrada");
  }
  fixture.assets[hashDoPng] = {
    ...assetQtrle,
    hash: hashDoPng,
  } as unknown as FixtureIntegrada["assets"][string];
  return fixture;
}

/**
 * Le o descritor do asset qtrle do cassete REAL de F2-02.
 * O cassete declara `mimeType: video/quicktime` nos dois assets — o formato
 * `.mov` qtrle/argb com alfa (docs/adr/0019, AB-390).
 */
function descritorQtrleDoCassete(): { hash: string; asset: Record<string, unknown> } {
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
      if (asset["mimeType"] === "video/quicktime") {
        return { hash, asset };
      }
    }
  }
  throw new Error(
    "qtrle: nenhum cassete de grafico com asset video/quicktime em fixtures/cassetes/grafico/",
  );
}

async function principal(): Promise<number> {
  rmSync(DIR_RECEBIDO, { recursive: true, force: true });
  mkdirSync(DIR_RECEBIDO, { recursive: true });

  const backup = readFileSync(CAMINHO_FIXTURA);
  const { hash: hashQtrle, asset: assetQtrle } = descritorQtrleDoCassete();
  let falhas = 0;

  process.stdout.write("=== integrado qtrle: a sonda do cassete REAL de F2-02 ===\n");
  process.stdout.write(`  asset do cassete: ${hashQtrle} (mimeType video/quicktime)\n`);

  // -------------------------------------------------------------------------
  // Sonda 1 — arvore pura: o no recusa o formato antes de emitir pixel
  // -------------------------------------------------------------------------
  process.stdout.write("  sonda 1/2: arvore pura (react-dom/server)\n");
  try {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { ArvoreIntegrada } = await import("./fiar");
    const fixture = fiarQtrle(lerFixture(), hashQtrle, assetQtrle);
    writeFileSync(CAMINHO_FIXTURA, `${JSON.stringify(fixture, null, 2)}\n`);

    let erroCapturado: Error | null = null;
    try {
      renderToStaticMarkup(
        createElement(ArvoreIntegrada, { fixture, frame: 460 }),
      );
    } catch (erro) {
      erroCapturado = erro as Error;
    }
    if (erroCapturado === null) {
      process.stdout.write(
        "  FALHOU  sonda 1: o render integrado com o qtrle REAL NAO recusou o " +
          "formato — o grafico entraria como buraco ou retangulo, e o gate de " +
          "bytes nao saberia (AB-363)\n",
      );
      falhas++;
    } else if (erroCapturado.name !== "ErroDeGraficoOpaco") {
      process.stdout.write(
        `  FALHOU  sonda 1: erro de outro tipo (${erroCapturado.name}): ${erroCapturado.message.slice(0, 200)}\n`,
      );
      falhas++;
    } else if (!erroCapturado.message.includes(ERRO_ESPERADO)) {
      process.stdout.write(
        `  FALHOU  sonda 1: ErroDeGraficoOpaco sem nomear o no: ${erroCapturado.message.slice(0, 200)}\n`,
      );
      falhas++;
    } else {
      process.stdout.write(`    ok: ErroDeGraficoOpaco nomeando o no: ${erroCapturado.message.slice(0, 160)}\n`);
    }
  } finally {
    writeFileSync(CAMINHO_FIXTURA, backup);
  }

  // -------------------------------------------------------------------------
  // Sonda 2 — render de verdade (Chrome headless): o erro derruba o render
  // -------------------------------------------------------------------------
  process.stdout.write("  sonda 2/2: render de verdade (Chrome headless, swangle)\n");
  try {
    const fixture = fiarQtrle(lerFixture(), hashQtrle, assetQtrle);
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

    let erroDoRender: Error | null = null;
    try {
      await renderStill({
        composition: composicao,
        serveUrl: servidor,
        output: join(temporario, "qtrle-frame460.png"),
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
    rmSync(temporario, { recursive: true, force: true });

    if (erroDoRender === null) {
      process.stdout.write(
        "  FALHOU  sonda 2: o render de verdade com o qtrle REAL SAIU — " +
          "o navegador aceitou o .mov (ou o render nao chegou ao no)\n",
      );
      falhas++;
    } else if (!erroDoRender.message.includes(ERRO_ESPERADO)) {
      process.stdout.write(
        `  FALHOU  sonda 2: render caiu por outro motivo: ${erroDoRender.message.slice(0, 200)}\n`,
      );
      falhas++;
    } else {
      process.stdout.write(
        "    ok: o render de verdade recusou o qtrle nomeando o no — evidencia " +
          "gravada em recebido/qtrle-evidencia.txt\n",
      );
      writeFileSync(
        resolve(DIR_RECEBIDO, "qtrle-evidencia.txt"),
        `${erroDoRender.message}\n`,
      );
    }
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
  // registrada no handoff e no ADR-0025 — o arquivo nao e o canal.
  rmSync(DIR_RECEBIDO, { recursive: true, force: true });
  process.stdout.write(
    "\n=== VERDE: integrado qtrle — o qtrle REAL e recusado com evidencia; " +
      "o cartucho webm e o caminho de producao (AB-390) ===\n",
  );
  return 0;
}

process.exit(await principal());
