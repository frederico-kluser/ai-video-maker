// =============================================================================
// O GATE DO THUMBNAIL — determinismo + conteudo + contraste + ∅-crit
// =============================================================================
// Card: F5-05 — Thumbnail gerado do MESMO manifesto (W7)
// Receita: `just thumb`
//
// O que este script recusa a aceitar como prova:
//
//   exit 0 do render       — C1: um thumbnail preto tambem sai com exit 0.
//   "renderizou igual 2x"  — um quadro vazio tambem e deterministico.
//   "contraste declarado"  — o token certo com pixel errado passa em
//                            silencio; aqui o contraste e MEDIDO no pixel.
//
// Entao, alem de comparar bytes, ele:
//
//   1. determina o plano do thumbnail pelo MESMO manifesto (frame escolhido
//      pelo modulo, escala de saida, titulo) — nada digitado;
//   2. renderiza 2x o MESMO frame (Chrome headless, --gl=swangle) e exige
//      bytes identicos (determinismo);
//   3. mede o conteudo (C1): o fundo tem de ser o fundo dos tokens e as
//      tintas do titulo do manifesto tem de estar na tela — o texto do
//      thumbnail so pode ter vindo do manifesto;
//   4. mede o contraste dos PIXELS (WCAG, formula dos tokens) e exige que
//      passe — o par declarado em tokens.ts manda na tinta que o casa;
//   5. ∅-crit: repinta a tinta mais frequente com uma cor de contraste
//      ABAIXO do minimo (gray 600 sobre o fundo, 2.68:1 < 3:1) nos PIXELS
//      do thumbnail real e exige que a medicao FALHE — um thumbnail com
//      contraste abaixo do minimo tem de derrubar o gate;
//   6. so entao grava o entregavel em output/thumbnail.png (o F5-07, W9,
//      consome de la).
//
// Ausencia e VERMELHO: se qualquer etapa faltar ou falhar, o script sai 1
// e nada e gravado. Este script nao "aproveita" nada — o entregavel e
// produzido so depois do gate verde.
// =============================================================================

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  background,
  palette,
  text as corDeTexto,
} from "../../../src/design/tokens";
import {
  conferirContraste,
  conferirLegibilidadeDoTitulo,
  medirContrasteDoThumbnail,
  PISO_DE_LEGIBILIDADE_PX,
  planoDoThumbnail,
} from "../../../src/entrega/thumbnail";
import { lerPngRgba } from "../../integracao/composicao/png";
import { FIXTURA_INTEGRADA } from "../../integracao/composicao/fiar";
import { ID_DA_COMPOSICAO } from "../../../src/entrega/thumbnail/especificacao";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const ENTRADA = resolve(AQUI, "entrada.tsx");
const DIR_ASSETS = resolve(RAIZ, "fixtures", "snapshots", "integrado", "assets");
const DIR_SAIDA = resolve(RAIZ, "output");
const ARQUIVO_ENTREGUE = resolve(DIR_SAIDA, "thumbnail.png");

/**
 * Porta TCP deste card (docs/contrato-w7.md §11): F5-05 = 4505.
 * Sobrescrivel por THUMB_PORTA para quem roda este script como filho de um
 * processo que ja mantem um navegador aberto (o mesmo caso da W4, AB-361).
 */
const PORTA = Number.parseInt(process.env.THUMB_PORTA ?? "4505", 10) || 4505;

interface Falha {
  readonly etapa: string;
  readonly motivo: string;
}

async function principal(): Promise<number> {
  const falhas: Falha[] = [];
  const temporario = mkdtempSync(join(tmpdir(), "thumb-"));
  process.stdout.write("=== thumb: determinismo + conteudo + contraste + ∅-crit ===\n");

  // 0. O plano — do MESMO manifesto, nunca digitado.
  const plano = planoDoThumbnail(FIXTURA_INTEGRADA.manifesto);
  process.stdout.write(
    `  plano: frame ${String(plano.frame)} (${plano.titulo.slice(0, 40)}...) ` +
      `-> ${String(plano.largura)}x${String(plano.altura)} (escala ${plano.escala})\n`,
  );

  // 1. Legibilidade no tamanho em que o texto aparece de fato.
  const falhaLegibilidade = conferirLegibilidadeDoTitulo(
    FIXTURA_INTEGRADA.manifesto,
    plano.escala,
  );
  if (falhaLegibilidade !== null) {
    falhas.push({ etapa: "legibilidade", motivo: falhaLegibilidade });
  } else {
    process.stdout.write(
      `  legibilidade: titulo a ${String(plano.alturaDoTitulo)}px no thumbnail ` +
        `(piso ${String(PISO_DE_LEGIBILIDADE_PX)}px, WCAG large)\n`,
    );
  }

  // 2. Bundle + render 2x do MESMO frame.
  const servidor = await bundle({
    entryPoint: ENTRADA,
    publicDir: DIR_ASSETS,
    onProgress: () => undefined,
  });
  process.stdout.write("  bundle: OK\n");

  try {
    const composicao = await selectComposition({
      serveUrl: servidor,
      id: ID_DA_COMPOSICAO,
      logLevel: "error",
    });
    process.stdout.write(`  composicao "${ID_DA_COMPOSICAO}": presente\n`);

    const saidas: string[] = [];
    for (const passada of [1, 2]) {
      const destino = join(temporario, `thumbnail.${String(passada)}.png`);
      await renderStill({
        composition: composicao,
        serveUrl: servidor,
        output: destino,
        frame: plano.frame,
        scale: plano.escala,
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
      copyFileSync(primeiro, resolve(DIR_SAIDA, "determinismo-render1.png"));
      copyFileSync(segundo, resolve(DIR_SAIDA, "determinismo-render2.png"));
      falhas.push({
        etapa: "determinismo",
        motivo:
          `render 1 e render 2 do thumbnail diferem em bytes — determinismo ` +
          `refutado (artefatos em output/determinismo-render*.png)`,
      });
    } else {
      process.stdout.write("  determinismo: 2 renders, bytes identicos\n");
    }

    const png = lerPngRgba(bytes1);
    if (png.largura !== plano.largura || png.altura !== plano.altura) {
      falhas.push({
        etapa: "dimensoes",
        motivo:
          `thumbnail veio ${String(png.largura)}x${String(png.altura)}, ` +
          `plano pediu ${String(plano.largura)}x${String(plano.altura)}`,
      });
    }

    // 3. Conteudo (C1) — o que o pintor promovido pintou, medido no pixel.
    const medida = medirContrasteDoThumbnail(png.largura, png.altura, png.rgba);
    const fundoEsperado = background.primary.toLowerCase();
    if (medida.fundo !== fundoEsperado) {
      falhas.push({
        etapa: "conteudo",
        motivo:
          `fundo medido ${medida.fundo}, esperado ${fundoEsperado} (o fundo ` +
          `dos tokens) — um quadro preto ou errado tambem e deterministico (C1)`,
      });
    }
    const tintasNaTela = medida.tintas.map((t) => t.cor);
    for (const corEsperada of [
      corDeTexto.primary.toLowerCase(),
      corDeTexto.secondary.toLowerCase(),
    ]) {
      if (!tintasNaTela.includes(corEsperada)) {
        falhas.push({
          etapa: "conteudo",
          motivo:
            `tinta ${corEsperada} (cor do titulo/subtitulo do manifesto) ` +
            `ausente dos pixels do thumbnail — o texto do thumbnail so pode ` +
            `ter vindo do manifesto`,
        });
      }
    }
    if (falhas.some((f) => f.etapa === "conteudo")) {
      process.stdout.write(
        `  tintas medidas: ${tintasNaTela.join(", ") || "(nenhuma)"}\n`,
      );
    } else {
      process.stdout.write(
        `  conteudo: fundo ${medida.fundo}, tintas do manifesto presentes ` +
          `(${tintasNaTela.join(", ") || "(nenhuma)"})\n`,
      );
    }

    // 4. Contraste MEDIDO nos pixels do thumbnail real.
    const falhasDeContraste = conferirContraste(medida);
    for (const falha of falhasDeContraste) {
      falhas.push({ etapa: "contraste", motivo: falha.motivo });
    }
    if (falhasDeContraste.length === 0) {
      process.stdout.write(
        `  contraste: ${String(medida.tintas.length)} tinta(s) medidas, ` +
          `todas acima do minimo (fundo ${medida.fundo})\n`,
      );
    }

    // 5. ∅-crit: o MESMO thumbnail com uma tinta de contraste abaixo do
    // minimo TEM de falhar a medicao. Mutacao nos pixels reais: a tinta
    // mais frequente (o titulo) vira gray 600, razao 2.68:1 < 3:1.
    if (falhas.length === 0) {
      const tintaDoTitulo = medida.tintas[0]?.cor;
      if (tintaDoTitulo === undefined) {
        falhas.push({
          etapa: "∅-crit",
          motivo: "nenhuma tinta medida no thumbnail — sem titulo na tela",
        });
      } else {
        const mutado = Uint8Array.from(png.rgba);
        let pintados = 0;
        for (let py = medida.regiao.y; py < medida.regiao.y + medida.regiao.altura; py++) {
          for (let px = medida.regiao.x; px < medida.regiao.x + medida.regiao.largura; px++) {
            const i = (py * png.largura + px) * 4;
            const cor = `#${[
              mutado[i]!.toString(16).padStart(2, "0"),
              mutado[i + 1]!.toString(16).padStart(2, "0"),
              mutado[i + 2]!.toString(16).padStart(2, "0"),
            ].join("")}`;
            if (cor === tintaDoTitulo) {
              mutado[i] = parseInt(palette.gray[600].slice(1, 3), 16);
              mutado[i + 1] = parseInt(palette.gray[600].slice(3, 5), 16);
              mutado[i + 2] = parseInt(palette.gray[600].slice(5, 7), 16);
              pintados++;
            }
          }
        }
        const medidaMutada = medirContrasteDoThumbnail(
          png.largura,
          png.altura,
          mutado,
        );
        const falhasMutadas = conferirContraste(medidaMutada);
        if (pintados === 0) {
          falhas.push({
            etapa: "∅-crit",
            motivo: `a tinta ${tintaDoTitulo} nao apareceu na regiao para mutar`,
          });
        } else if (falhasMutadas.length === 0) {
          falhas.push({
            etapa: "∅-crit",
            motivo:
              `thumbnail com ${String(pintados)}px repintados de ` +
              `${palette.gray[600]} (2.68:1 sobre o fundo, abaixo do minimo) ` +
              `PASSOU na medicao — o ∅-crit "contraste abaixo do minimo tem de ` +
              `falhar" foi refutado`,
          });
        } else {
          process.stdout.write(
            `  ∅-crit: ${String(pintados)}px de ${tintaDoTitulo} repintados de ` +
              `${palette.gray[600]} -> medicao FALHOU (${falhasMutadas[0]!.motivo})\n`,
          );
        }
      }
    }

    // 6. O entregavel — so depois do gate verde.
    if (falhas.length === 0) {
      mkdirSync(DIR_SAIDA, { recursive: true });
      copyFileSync(primeiro, ARQUIVO_ENTREGUE);
      process.stdout.write(`  entregue: ${ARQUIVO_ENTREGUE}\n`);
    }
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }

  if (falhas.length > 0) {
    process.stdout.write("\n");
    for (const falha of falhas) {
      process.stdout.write(`  FALHOU  ${falha.etapa}: ${falha.motivo}\n`);
    }
    process.stdout.write("\n=== VERMELHO: thumb ===\n");
    return 1;
  }

  process.stdout.write("\n=== VERDE: thumb (determinismo + conteudo + contraste) ===\n");
  return 0;
}

process.exit(await principal());
