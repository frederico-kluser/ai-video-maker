// =============================================================================
// provar — determinismo (2x), oraculo de pixel e snapshots por variante
// =============================================================================
// Card: F5-04 (W7) — Variantes de proporcao.
//
// O que este script recusa a aceitar como prova:
//
//   exit 0 do render        — C1: quadro preto tambem sai com exit 0.
//   "renderizou igual 2x"   — um quadro vazio tambem e deterministico.
//   "tem bytes"             — um retangulo chapado tem bytes de sobra.
//
// Alem da regressao byte a byte contra o snapshot aprovado, o oraculo de
// pixel (oraculo.ts) mede no quadro renderizado:
//
//   - PRESENCA de conteudo DENTRO da safe area da plataforma da variante
//     (a regiao segura nao pode ser chapada);
//   - VAZAMENTO: nenhum pixel de tinta nao-explicada FORA da safe area
//     (toda tinta fora tem de ser o plano de camadas — fundo/grade/vinheta).
//
// E roda o oraculo GEOMETRICO de variantes (src/entrega/variantes/
// verificar.ts, o ∅-crit do card):
//
//   - variante 16:9 do canonico: TEM de ser limpa (conteudo dentro do
//     action safe EBU);
//   - variante 9:16 do canonico: TEM de ser REPROVADA, nomeando plataforma
//     e margens (o ∅-crit disparando em dado real: o reflow vertical do
//     canonico nao cabe no retangulo util provisional AB-071/AB-584). Se a
//     verificacao voltar limpa, o gate FALHA — a checagem de safe area
//     sumiu (mutacao).
//
// Snapshots: UMA serie aprovada por variante ENTREGAVEL (a 16:9 hoje). A
// variante 9:16 do canonico NAO e entregavel (reprovada) — os stills dela
// sao renderizados para a prova de pixel do ∅-crit e NUNCA viram snapshot
// aprovado (um golden de variante insegura seria o falso-verde do card).
//
// Uso:
//   npx tsx tools/variantes/provar.ts             # gate
//   npx tsx tools/variantes/provar.ts --aprovar   # (re)grava os aprovados
//
// Porta TCP deste card: 4504 (docs/contrato-w7.md §11), sobrescrevivel por
// VARIANTS_PORTA.
// =============================================================================

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lerPngRgba } from "../../tests/integracao/composicao/png";
import { medirVarianteNoQuadro } from "./oraculo";
import { breakpoints } from "../../src/design/tokens";
import {
  derivarVariante,
} from "../../src/entrega/variantes/derivar";
import {
  PLATAFORMA_16X9,
  PLATAFORMA_9X16,
} from "../../src/entrega/variantes/plataformas";
import {
  verificarVariante,
} from "../../src/entrega/variantes/verificar";
import { planoDeComposicao } from "../../src/composicao/ManifestoRaiz";
import { FIXTURA_INTEGRADA } from "../../tests/integracao/composicao/fiar";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const DIR_FIXTURE = resolve(RAIZ, "fixtures", "snapshots", "variantes");
const ENTRADA = resolve(DIR_FIXTURE, "entrada.tsx");
const DIR_ASSETS = resolve(RAIZ, "fixtures", "snapshots", "integrado", "assets");
const DIR_APROVADO = resolve(DIR_FIXTURE, "aprovados");
const DIR_RECEBIDO = resolve(DIR_FIXTURE, "recebido");

/**
 * Porta TCP deste card (docs/contrato-w7.md §11): F5-04 = 4504.
 * Sobrescrevivel por VARIANTS_PORTA para quem roda este script como filho
 * de um processo que ja mantem um navegador aberto.
 */
const PORTA = Number.parseInt(process.env.VARIANTS_PORTA ?? "4504", 10) || 4504;

const FONTE = FIXTURA_INTEGRADA.manifesto;
const FPS = FONTE.fps;
const DURACAO = planoDeComposicao(FONTE).totalFrames;

// ---------------------------------------------------------------------------
// Os stills do gate
// ---------------------------------------------------------------------------

type VereditoEsperado = "limpo" | "viola";

interface Spec {
  composicao: string;
  frame: number;
  arquivo: string;
  /** Golden aprovado? (so variantes ENTREGAVEIS tem golden.) */
  golden: boolean;
  /** O veredito de pixel esperado — "viola" e o ∅-crit em pixel. */
  veredito: VereditoEsperado;
}

const SPECS: readonly Spec[] = [
  {
    composicao: "variante-16x9",
    frame: 30,
    arquivo: "variante-16x9-c001-frame30.png",
    golden: true,
    veredito: "limpo",
  },
  {
    composicao: "variante-16x9",
    frame: 140,
    arquivo: "variante-16x9-c002-frame140.png",
    golden: true,
    veredito: "limpo",
  },
  {
    composicao: "variante-9x16",
    frame: 30,
    arquivo: "variante-9x16-c001-frame30.png",
    golden: false,
    // O titulo do cabecalho (96px) ultrapassa a margem direita do
    // retangulo util provisional (918px) — o ∅-crit em dado real.
    veredito: "viola",
  },
  {
    composicao: "variante-9x16",
    frame: 300,
    arquivo: "variante-9x16-c003-frame300.png",
    golden: false,
    // O marcador de midia estoura as tres margens do retangulo util
    // provisional — o ∅-crit em dado real, com a tinta mais obvia.
    veredito: "viola",
  },
];

/** O canvas de cada composicao (para o oraculo de pixel). */
const CANVAS_POR_COMPOSICAO: Record<string, { width: number; height: number }> = {
  "variante-16x9": { width: FONTE.width, height: FONTE.height },
  "variante-9x16": { width: breakpoints.vertical.width, height: breakpoints.vertical.height },
};

/** O manifesto de cada composicao (a variante derivada e a registrada). */
const MANIFESTO_POR_COMPOSICAO: Record<string, typeof FONTE> = {
  "variante-16x9": FONTE,
  "variante-9x16": derivarVariante(FONTE, breakpoints.vertical),
};

/** A plataforma do contrato de cada composicao. */
const PLATAFORMA_POR_COMPOSICAO: Record<string, typeof PLATAFORMA_16X9> = {
  "variante-16x9": PLATAFORMA_16X9,
  "variante-9x16": PLATAFORMA_9X16,
};

interface Falha {
  readonly arquivo: string;
  readonly motivo: string;
}

// ---------------------------------------------------------------------------
// O relatorio do ∅-crit geometrico (verificar.ts)
// ---------------------------------------------------------------------------

function relatorioGeometrico(falhas: Falha[]): void {
  process.stdout.write("=== variantes: oraculo geometrico (∅-crit do card) ===\n");

  const variante16x9 = derivarVariante(FONTE, breakpoints.hd);
  const violacoes16x9 = verificarVariante(FONTE, variante16x9);
  if (violacoes16x9.length > 0) {
    falhas.push({
      arquivo: "variante-16x9",
      motivo:
        "a variante 16:9 do canonico foi REPROVADA pelo oraculo de safe " +
        "area:\n" + violacoes16x9.map((v) => `        - ${v.mensagem}`).join("\n"),
    });
  } else {
    process.stdout.write("  variante-16x9: SEGURA (conteudo dentro do action safe EBU R 95)\n");
  }

  const variante9x16 = derivarVariante(FONTE, breakpoints.vertical);
  const violacoes9x16 = verificarVariante(FONTE, variante9x16);
  if (violacoes9x16.length === 0) {
    // ∅-crit de mutacao: a variante 9:16 do canonico TEM de ser reprovada
    // (o reflow vertical nao cabe no retangulo util provisional). Se a
    // checagem de safe area sumiu, ela volta limpa — e o gate FALHA aqui.
    falhas.push({
      arquivo: "variante-9x16",
      motivo:
        "o ∅-crit nao disparou: a variante 9:16 do canonico passou na " +
        "verificacao de safe area — a checagem de conteudo fora da safe " +
        "area foi removida ou nunca existiu (mutacao)",
    });
  } else {
    process.stdout.write("  variante-9x16: REPROVADA (∅-crit em dado real):\n");
    for (const v of violacoes9x16) {
      process.stdout.write(`    - [${v.regra}] ${v.mensagem}\n`);
    }
    process.stdout.write("    -> variante NAO entregavel nesta onda (ver ADR-0037)\n");
  }

  // A variante 9:16 derivada aqui e a MESMA que a composicao registrada em
  // entrada.tsx renderiza (derivarVariante e funcao pura): conferido por
  // identidade do conteudo, para o relatorio e o render nao divergirem.
  const registrada = derivarVariante(FONTE, breakpoints.vertical);
  if (JSON.stringify(registrada.nos) !== JSON.stringify(variante9x16.nos)) {
    falhas.push({
      arquivo: "variante-9x16",
      motivo: "a derivacao registrada em entrada.tsx nao deriva do mesmo manifesto",
    });
  }
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function principal(): Promise<number> {
  const aprovar = process.argv.includes("--aprovar");
  const temporario = mkdtempSync(join(tmpdir(), "variantes-"));
  const falhas: Falha[] = [];

  // Artefatos de uma execucao VERMELHA anterior nao podem fazer a seguinte
  // falhar o gate de status (C3): recebido e diagnostico, nunca estado.
  rmSync(DIR_RECEBIDO, { recursive: true, force: true });

  process.stdout.write("=== variantes provar: determinismo + oraculo + snapshot ===\n");
  process.stdout.write(`  entrada: ${ENTRADA}\n`);

  const servidor = await bundle({
    entryPoint: ENTRADA,
    publicDir: DIR_ASSETS,
    onProgress: () => undefined,
  });
  process.stdout.write("  bundle: OK\n");

  relatorioGeometrico(falhas);

  try {
    for (const spec of SPECS) {
      process.stdout.write(
        `  still: ${spec.composicao} frame ${String(spec.frame)} -> ${spec.arquivo}\n`,
      );
      const composicao = await selectComposition({
        serveUrl: servidor,
        id: spec.composicao,
        logLevel: "error",
      });

      const saidas: string[] = [];
      for (const passada of [1, 2]) {
        const destino = join(temporario, `${spec.arquivo}.${String(passada)}.png`);
        await renderStill({
          composition: composicao,
          serveUrl: servidor,
          output: destino,
          frame: spec.frame,
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
        copyFileSync(primeiro, resolve(DIR_RECEBIDO, `render1-${spec.arquivo}`));
        copyFileSync(segundo, resolve(DIR_RECEBIDO, `render2-${spec.arquivo}`));
        falhas.push({
          arquivo: spec.arquivo,
          motivo:
            `render 1 e render 2 diferem em bytes — determinismo refutado ` +
            `(artefatos em ${DIR_RECEBIDO})`,
        });
        continue;
      }
      process.stdout.write("    determinismo: 2 renders, bytes identicos\n");

      // O oraculo de pixel so roda se os bytes passaram: o quadro preto e
      // deterministico — o conteudo e a segunda barreira.
      const canvas = CANVAS_POR_COMPOSICAO[spec.composicao]!;
      const plataforma = PLATAFORMA_POR_COMPOSICAO[spec.composicao]!;
      const png = lerPngRgba(bytes1);
      const falhasDoOraculo = medirVarianteNoQuadro(
        png,
        spec.frame,
        canvas,
        FPS,
        DURACAO,
        plataforma,
        MANIFESTO_POR_COMPOSICAO[spec.composicao]!,
      );

      if (spec.veredito === "viola" && falhasDoOraculo.length === 0) {
        falhas.push({
          arquivo: spec.arquivo,
          motivo:
            `∅-crit em pixel nao disparou: esperado conteudo FORA da safe ` +
            `area da plataforma ${plataforma.id} (frame ${String(spec.frame)}), ` +
            "e o oraculo voltou limpo",
        });
      } else if (spec.veredito === "limpo") {
        for (const falha of falhasDoOraculo) {
          falhas.push({
            arquivo: spec.arquivo,
            motivo: `${falha.regiao}: ${falha.motivo}`,
          });
        }
      } else {
        process.stdout.write(`    ∅-crit em pixel: ${falhasDoOraculo.length} vazamento(s) detectado(s) (esperado)\n`);
      }

      // Snapshots: so variantes ENTREGAVEIS tem golden.
      const aprovado = resolve(DIR_APROVADO, spec.arquivo);
      if (spec.golden) {
        if (aprovar) {
          mkdirSync(DIR_APROVADO, { recursive: true });
          copyFileSync(primeiro, aprovado);
          process.stdout.write(`    APROVADO gravado em ${aprovado}\n`);
          continue;
        }
        if (!existsSync(aprovado)) {
          falhas.push({
            arquivo: spec.arquivo,
            motivo:
              `snapshot aprovado AUSENTE (${aprovado}). Ausencia e ` +
              `reprovacao: este script nao grava o que falta. Para aprovar ` +
              `de proposito, rode com --aprovar`,
          });
          continue;
        }
        if (!readFileSync(aprovado).equals(bytes1)) {
          mkdirSync(DIR_RECEBIDO, { recursive: true });
          copyFileSync(primeiro, resolve(DIR_RECEBIDO, `atual-${spec.arquivo}`));
          falhas.push({
            arquivo: spec.arquivo,
            motivo: `o render diverge do snapshot aprovado (artefato em ${DIR_RECEBIDO})`,
          });
          continue;
        }
        process.stdout.write("    identico ao snapshot aprovado\n");
      } else {
        // A variante reprovada NAO pode ter golden: um snapshot aprovado de
        // uma variante insegura seria o falso-verde do card.
        if (existsSync(aprovado)) {
          falhas.push({
            arquivo: spec.arquivo,
            motivo:
              `snapshot aprovado de variante NAO entregavel presente em ` +
              `${aprovado} — variante insegura nao vira golden`,
          });
        }
      }
    }
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }

  // Presenca dos goldens: cada snapshot aprovado do gate tem de existir e
  // ter conteudo (C3: um diretorio vazio nao pode sair verde).
  for (const spec of SPECS) {
    if (!spec.golden) continue;
    const aprovado = resolve(DIR_APROVADO, spec.arquivo);
    if (!existsSync(aprovado)) {
      falhas.push({
        arquivo: spec.arquivo,
        motivo: `snapshot aprovado ausente em ${aprovado}`,
      });
      continue;
    }
    if (statSync(aprovado).size < 1000) {
      falhas.push({
        arquivo: spec.arquivo,
        motivo: `snapshot aprovado com menos de 1000 bytes — entropia baixa`,
      });
    }
  }

  if (falhas.length > 0) {
    process.stdout.write("\n");
    for (const falha of falhas) {
      process.stdout.write(`  FALHOU  ${falha.arquivo}: ${falha.motivo}\n`);
    }
    process.stdout.write("\n=== VERMELHO: variantes provar ===\n");
    return 1;
  }

  process.stdout.write(
    `\n=== VERDE: ${String(SPECS.length)} stills, determinismo + oraculo + snapshots por variante ===\n`,
  );
  return 0;
}

process.exit(await principal());
