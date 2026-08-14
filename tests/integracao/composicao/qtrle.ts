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
//   2. A composicao CONSUME os bytes do webm, provado EM PIXEL: render de
//      verdade (Chrome headless via renderStill) da composicao
//      `integrado-grafico-asset` (UMA cena, UM no de grafico) no frame
//      FRAME_DO_WEBM — o quadro TEM de corresponder ao frame do webm do
//      cassete, medido por SSIM contra o frame decodificado pelo ffmpeg.
//      Correcao da revisao adversaria (onda 2, fix): a afirmacao antiga —
//      "o quadro do join no frame 460 e o frame 33 do webm do cassete" —
//      era FALSA. Na fixture integrada so n-009 tem asset de VIDEO (o fiado
//      aqui); n-011 e PNG e n-010/n-012/n-013 desenham do manifesto, a
//      montagem nao ativa, os graficos se sobrepoem na cena c-004 e o webm
//      fica no FUNDO do frame 460, dominado por n-013. O oraculo de
//      entropia do join passaria com o webm ausente ou preto — ele prova
//      CONTEUDO, nao o webm. A prova do webm e esta sonda de um no (SSIM),
//      mais a sonda da arvore em vitest (qtrle-arvore.test.ts: com o webm
//      fiado o no renderiza data-modo=asset-video + <video src=grafico/
//      <hash>.webm>; sem a fiacao nao ha <video> — a sonda falha se o webm
//      sumir).
//
//   3. o join (composicao `integrado`) no frame 460: renderiza e o quadro
//      tem conteudo (C1) — afirmado com a limitacao honesta: o quadro e
//      dominado pelos graficos sobrepostos, o webm de n-009 fica no fundo.
//
// A sonda e VERMELHA se: a guarda recusar o cassete real (ou aceitar o
// .mov morto), o render de um no cair, o quadro nao tiver conteudo, o SSIM
// ficar abaixo do limiar (o webm nao e o que o quadro mostra), ou o join
// cair sem conteudo.
//
// Uso:  npx tsx tests/integracao/composicao/qtrle.ts
// =============================================================================

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
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

/**
 * Frame do webm a comparar (e o frame do render da composicao de um no):
 * dentro da janela do no (120 frames) e dentro do webm do cassete (~17
 * frames a ~15 fps — o webm de 1s da gravacao de desenvolvimento). Medido
 * na correcao (2026-08-14): SSIM 0.975 entre o quadro renderizado pelo
 * Chrome e o frame 10 do webm decodificado pelo ffmpeg (upscaled 4x).
 */
const FRAME_DO_WEBM = 10;

/** SSIM minimo entre o quadro renderizado e o frame do webm do cassete. */
const LIMIAR_DE_SSIM = 0.95;

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
function descritorDoCasseteReal(): {
  hash: string;
  asset: Record<string, unknown>;
  diretorio: string;
} {
  const base = resolve(RAIZ, "fixtures", "cassetes", "grafico");
  let cassetes: string[] = [];
  try {
    // Ordenado: a escolha do cassete tem de ser DETERMINISTICA entre
    // execucoes (a ordem do readdir nao e garantida).
    cassetes = readdirSync(base)
      .sort()
      .map((d) => resolve(base, d, "resultado.json"));
  } catch {
    cassetes = [];
  }

  for (const caminho of cassetes) {
    const resultado = JSON.parse(readFileSync(caminho, "utf8")) as {
      assets: Record<string, Record<string, unknown>>;
    };
    for (const [hash, asset] of Object.entries(resultado.assets ?? {})) {
      if (asset["mimeType"] !== MIME_DO_CASSETE_REAL) continue;
      // Onda 2 (2b): a sonda 2 serve os BYTES do webm ao navegador — o
      // cassete tem de ter o CORPO commitado (os cassetes antigos de
      // gravacao sao metadata-only, sem corpos).
      if (existsSync(resolve(dirname(caminho), "corpos", hash))) {
        return { hash, asset, diretorio: dirname(caminho) };
      }
    }
  }
  throw new Error(
    "qtrle: nenhum cassete de grafico com asset video/webm E corpos commitados " +
      "em fixtures/cassetes/grafico/",
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
  const { hash: hashDoCassete, asset: assetDoCassete, diretorio: diretorioDoCassete } =
    descritorDoCasseteReal();
  let falhas = 0;

  process.stdout.write("=== integrado qtrle: a sonda do cassete REAL de F2-02 (webm v1.1.0) ===\n");
  process.stdout.write(`  asset do cassete: ${hashDoCassete} (mimeType video/webm)\n`);

  // -------------------------------------------------------------------------
  // Sonda 1 — a GUARDA julga o descritor do cassete real + controle negativo
  // -------------------------------------------------------------------------
  process.stdout.write("  sonda 1/3: a guarda do no vs o descritor do cassete real\n");
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
  // Sonda 2 — render de verdade (Chrome headless): o QUADRO e o frame do
  // webm, em pixel (SSIM) — a prova de que os bytes sao CONSUMIDOS
  // -------------------------------------------------------------------------
  process.stdout.write("  sonda 2/3: render de verdade (Chrome headless, swangle)\n");
  // O caminho do arquivo a servir: o resolvedor da fiacao (onda 2, 2b) e
  // data-driven — `grafico/<hash>.<ext do mimeType>`. Com o descritor do
  // cassete real (video/webm) sob a chave do PNG, o arquivo servido ao
  // navegador e `grafico/<hash-do-png>.webm` (OffthreadVideo). A sonda
  // materializa os bytes do webm do cassete nesse caminho e os remove ao
  // final (mesma disciplina do backup/restore da fixture).
  //
  // A composicao renderizada e a `integrado-grafico-asset` (UMA cena, UM
  // no de grafico — a mesma que a suite integrada usa para provar o asset
  // no quadro): o que o frame mostra so pode ter vindo do proprio no. No
  // frame 10, o relogio do video (base absoluta = inicio da cena, janela
  // do no = 120 frames) esta no frame 10 do webm do cassete — e o quadro
  // TEM de corresponder ao webm, medido por SSIM contra o frame 10 do
  // webm decodificado pelo ffmpeg (upscaled 4x, 480x270 -> 1920x1080).
  // CORRECAO da revisao adversaria (onda 2, fix): a afirmacao antiga
  // ("o quadro do join no frame 460 e o frame 33 do webm") era FALSA — na
  // fixture integrada o unico asset de video e o de n-009 fiado aqui, a
  // montagem nao ativa (nem todos os graficos sao video) e o webm fica no
  // fundo, dominado pelos graficos sobrepostos de n-010..n-013. A prova
  // de pixel do webm vive NESTA sonda, na composicao de um no.
  try {
    const fixture = fiarCasseteReal(lerFixture(), hashDoCassete, assetDoCassete);
    writeFileSync(CAMINHO_FIXTURA, `${JSON.stringify(fixture, null, 2)}\n`);
    const arquivoWebmTemporario = resolve(
      DIR_ASSETS,
      "grafico",
      `${fixture.nos_grafico["n-009"]}.webm`,
    );
    mkdirSync(dirname(arquivoWebmTemporario), { recursive: true });
    writeFileSync(
      arquivoWebmTemporario,
      readFileSync(resolve(diretorioDoCassete, "corpos", hashDoCassete)),
    );

    const temporario = mkdtempSync(join(tmpdir(), "integrado-qtrle-"));
    const servidor = await bundle({
      entryPoint: ENTRADA,
      publicDir: DIR_ASSETS,
      onProgress: () => undefined,
    });
    const composicaoDeUmNo = await selectComposition({
      serveUrl: servidor,
      id: "integrado-grafico-asset",
      logLevel: "error",
    });

    const saidaUmNo = join(temporario, "frame10.png");
    let erroDoRender: Error | null = null;
    try {
      await renderStill({
        composition: composicaoDeUmNo,
        serveUrl: servidor,
        output: saidaUmNo,
        frame: FRAME_DO_WEBM,
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
        `  FALHOU  sonda 2: o render da composicao de um no CAIU: ` +
          `${erroDoRender.message.slice(0, 200)}\n`,
      );
      falhas++;
    } else {
      // O quadro preto renderiza com exit 0 (C1) — a entropia e a barreira.
      const falhasDoOraculo = conferirEntropiaDoQuadro(lerPngRgba(readFileSync(saidaUmNo)));
      if (falhasDoOraculo.length > 0) {
        for (const f of falhasDoOraculo) {
          process.stdout.write(`  FALHOU  sonda 2: oraculo de conteudo: ${f.motivo}\n`);
        }
        falhas++;
      } else {
        // A prova em PIXEL: o quadro renderizado vs o frame do webm do
        // cassete. Medido na correcao: SSIM 0.975 — o limiar 0.95 deixa a
        // margem da conversao de cor do Chrome vs ffmpeg e ainda exige que
        // o conteudo do quadro SEJA o do webm (um webm preto/ausente daria
        // SSIM baixissimo e entropia reprovando).
        const referencia = join(temporario, `webm-frame${String(FRAME_DO_WEBM)}.png`);
        execFileSync("ffmpeg", [
          "-y", "-hide_banner", "-loglevel", "error",
          "-i", resolve(diretorioDoCassete, "corpos", hashDoCassete),
          "-vf", `select=eq(n\\,${String(FRAME_DO_WEBM)}),scale=1920:1080`,
          "-vframes", "1",
          referencia,
        ]);
        // O relatorio do filtro ssim sai no stderr (av_log) — o spawnSync
        // captura os dois canais (o execFileSync so devolve stdout).
        const probeSsim = spawnSync("ffmpeg", [
          "-hide_banner",
          "-i", saidaUmNo,
          "-i", referencia,
          "-lavfi", "ssim",
          "-f", "null", "-",
        ], { encoding: "utf8" });
        const m = /All:([0-9.]+)/.exec(probeSsim.stderr ?? "");
        const valor = m === null ? NaN : Number(m[1]);
        if (!Number.isFinite(valor) || valor < LIMIAR_DE_SSIM) {
          process.stdout.write(
            `  FALHOU  sonda 2: o quadro renderizado NAO corresponde ao frame ` +
              `${String(FRAME_DO_WEBM)} do webm do cassete (SSIM ${String(valor)} < ` +
              `${String(LIMIAR_DE_SSIM)}) — o webm servido nao e o que o quadro mostra\n`,
          );
          falhas++;
        } else {
          process.stdout.write(
            `    ok: o quadro do render (composicao de um no, frame ` +
              `${String(FRAME_DO_WEBM)}) e o frame ${String(FRAME_DO_WEBM)} do webm do ` +
              `cassete, em pixel — SSIM ${String(valor.toFixed(4))} >= ` +
              `${String(LIMIAR_DE_SSIM)} (o webm e CONSUMIDO: OffthreadVideo, wiring ` +
              "da onda 2/2b, servido por `grafico/<hash>.webm`)\n",
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Sonda 3 — o join (composicao integrada) no frame 460: C1 honesto
    // -----------------------------------------------------------------------
    process.stdout.write("  sonda 3/3: o join no frame 460 sai com CONTEUDO (C1)\n");
    const composicaoDoJoin = await selectComposition({
      serveUrl: servidor,
      id: "integrado",
      logLevel: "error",
    });
    const saidaJoin = join(temporario, "frame460.png");
    let erroDoJoin: Error | null = null;
    try {
      await renderStill({
        composition: composicaoDoJoin,
        serveUrl: servidor,
        output: saidaJoin,
        frame: 460,
        imageFormat: "png",
        port: PORTA,
        chromiumOptions: { gl: "swangle" },
        logLevel: "error",
        overwrite: true,
      });
    } catch (erro) {
      erroDoJoin = erro as Error;
    }

    if (erroDoJoin !== null) {
      process.stdout.write(
        `  FALHOU  sonda 3: o render do join com o cassete real CAIU: ` +
          `${erroDoJoin.message.slice(0, 200)}\n`,
      );
      falhas++;
    } else {
      const falhasDoJoin = conferirEntropiaDoQuadro(lerPngRgba(readFileSync(saidaJoin)));
      if (falhasDoJoin.length > 0) {
        for (const f of falhasDoJoin) {
          process.stdout.write(`  FALHOU  sonda 3: oraculo de conteudo: ${f.motivo}\n`);
        }
        falhas++;
      } else {
        // Afirmacao HONESTA: o join com o descritor do cassete real renderiza
        // com conteudo (C1). O quadro NAO e "o frame do webm": nesta fixture
        // a montagem nao ativa (so n-009/n-011 tem asset; n-010/n-012/n-013
        // desenham do manifesto) e os graficos se sobrepoem na cena c-004 —
        // o webm de n-009 fica no FUNDO, dominado por n-013. A prova de que
        // o webm e consumido e a sonda 2 (SSIM na composicao de um no).
        process.stdout.write(
          "    ok: o join com o cassete real SAIOU e o quadro tem conteudo (C1) — " +
            "nesta fixture o frame 460 e dominado pelos graficos sobrepostos de " +
            "n-010..n-013 (sem montagem: a fixture integrada nao tem 5 assets de " +
            "video) e o webm de n-009 fica no fundo; a prova do webm e a sonda 2\n",
        );
      }
    }

    writeFileSync(
      resolve(DIR_RECEBIDO, "webm-evidencia.txt"),
      [
        `cassete real do estagio grafico: ${hashDoCassete} (mimeType video/webm)`,
        `guarda do no n-009 aceita o descritor real (AB-397: guarda checa mimeType, nao bitstream)`,
        `controle negativo: video/quicktime (aposentado) recusado pela guarda nomeando o no (AB-490)`,
        `render de verdade (Chrome headless, swangle) da composicao integrado-grafico-asset ` +
          `(UMA cena, UM no) no frame ${String(FRAME_DO_WEBM)}: exit 0 + oraculo de entropia ` +
          `VERDE + SSIM >= ${String(LIMIAR_DE_SSIM)} vs o frame ${String(FRAME_DO_WEBM)} do webm ` +
          `do cassete decodificado pelo ffmpeg — o QUADRO e o frame do webm, em pixel ` +
          `(a composicao CONSUME os bytes do webm)`,
        `o join (composicao integrada) no frame 460: exit 0 + conteudo (C1). NESTA fixture o ` +
          `frame e dominado pelos graficos sobrepostos de n-010..n-013 (a montagem nao ativa: ` +
          `so n-009/n-011 tem asset, e o unico de video e o do cassete fiado) — o webm de n-009 ` +
          `fica no FUNDO; o oraculo de entropia do join NAO prova o webm, a sonda 2 prova`,
        `a arvore: com o webm fiado, n-009 renderiza data-modo=asset-video + ` +
          `<video src=grafico/<hash>.webm>; sem a fiacao, data-modo=dados/asset e NENHUM ` +
          `<video> — a sonda da arvore (vitest qtrle-arvore) falha se o webm sumir`,
        `a decisao do AB-397 (PNG RGBA) foi superada pelo wiring dos webm de matematica`,
        "",
      ].join("\n"),
    );
    rmSync(temporario, { recursive: true, force: true });
    rmSync(arquivoWebmTemporario, { force: true });
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
