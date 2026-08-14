// =============================================================================
// provar — determinismo (2x), oraculo de conteudo e snapshot do render
//             integrado
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// O que este script recusa a aceitar como prova:
//
//   exit 0 do render        — C1: quadro preto tambem sai com exit 0.
//   "renderizou igual 2x"   — um quadro vazio tambem e deterministico.
//   "tem bytes"             — um retangulo chapado tem bytes de sobra.
//
// Entao, alem de comparar bytes, ele MEDE o quadro composto com o oraculo de
// conteudo (AB-344/AB-390): cores distintas no quadro inteiro (C1), tinta do
// marcador de midia + cor de base dentro da regiao do marcador (o alfa
// sobreviveu ao compositor), cores das barras do asset + cor de base na
// regiao do grafico (o grafico real esta no quadro, nao saiu preto), e a
// serie dos dados na cena de graficos.
//
// O render e o do RENDER (webpack + Chrome headless, --gl=swangle), nunca do
// Studio (C5): o snapshot aprovado nasce aqui, e so aqui.
//
// AUSENCIA E VERMELHO: snapshot aprovado ausente e reprovacao — este script
// nao grava o que falta. Gravar so sob `--aprovar`, explicitamente.
//
// Uso:
//   npx tsx tests/integracao/composicao/provar.ts             # gate
//   npx tsx tests/integracao/composicao/provar.ts --aprovar   # (re)grava
//
// O `just det:provar --integrado` do PROGRAMA e `just det-provar-integrado`
// (just 1.42 nao aceita argumento em receita sem parametro — AB-284).
// =============================================================================

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { lerPngRgba } from "./png";
import {
  conferirCoresDaSerieNoQuadro,
  conferirEntropiaDoQuadro,
  conferirRegiaoDaMidia,
  conferirRegiaoDoGrafico,
  conferirTintaDeTexto,
  type BlocoDeclarado,
  type FalhaDoOraculo,
} from "./oraculo";
import {
  FIXTURA_INTEGRADA,
  regiaoDoGrafico,
  regiaoInternaDaMidia,
} from "./fiar";
import { regioesDeTextoDaCena } from "../../../src/composicao/layout/eixo";
import { caixaDoTexto } from "../../../src/composicao/nos/texto";
import { caixaDaLegenda } from "../../../src/composicao/nos/midia";
import type { No, NoMidia, NoTexto } from "../../../src/contratos/manifesto";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const DIR_FIXTURE = resolve(RAIZ, "fixtures", "snapshots", "integrado");
const ENTRADA = resolve(DIR_FIXTURE, "entrada.tsx");
const DIR_ASSETS = resolve(DIR_FIXTURE, "assets");
const DIR_APROVADO = resolve(DIR_FIXTURE, "aprovados");
const DIR_RECEBIDO = resolve(DIR_FIXTURE, "recebido");

/**
 * Porta TCP deste card (docs/contrato-w5.md §9): F1-12 = 4112.
 * Sobrescrevivel por INTEGRADO_PORTA para quem roda este script como filho
 * de um processo que ja mantem um navegador aberto (o mesmo caso que a W4
 * registrou em AB-361 para o irmão grafico).
 */
const PORTA = Number.parseInt(process.env.INTEGRADO_PORTA ?? "4112", 10) || 4112;

/**
 * Os stills do gate. Cada um e (composicao, frame, arquivo, oraculo).
 * Os frames sao escolhidos para cruzar os estados da composicao integrada:
 * cena sozinha, fronteira com as DUAS cenas, cena com midia+codigo+lista,
 * cena de graficos, cena final e o ULTIMO frame (a prova de que nao existe
 * cauda preta depois da ultima cena).
 */
interface Spec {
  composicao: string;
  frame: number;
  arquivo: string;
  oraculo: (png: ReturnType<typeof lerPngRgba>) => FalhaDoOraculo[];
}

const LARGURA = 1920;
const ALTURA = 1080;

// ---------------------------------------------------------------------------
// TINTA DE TEXTO DA C-005 (fix da Onda 3) — o oraculo de pixel do texto
// ---------------------------------------------------------------------------
// O revisor refutou a Onda 3 medindo o frame 580 real: o texto n-014
// (bbox "1306,87,517,176", visibilidade 1) com ZERO pixels de texto e a
// legenda do video n-006 ("851,438,218,78") chapada de branco do globo —
// a midia, pintada depois do texto, cobria ambos. Este oraculo exige
// tinta de texto nas regioes declaradas do render REAL (conferirTintaDeTexto
// em ./oraculo.ts).
//
// A geometria vem das MESMAS funcoes puras que os componentes usam
// (regioesDeTextoDaCena + caixaDoTexto + caixaDaLegenda) — o bloco e o
// que o no declara (data-bbox), e o pixel do render de verdade tem de
// conter tinta de texto ali.
function blocosDeTextoDaCena005(): BlocoDeclarado[] {
  const manifesto = FIXTURA_INTEGRADA.manifesto;
  const cena = manifesto.cenas.find((c) => c.id === "c-005");
  if (cena === undefined) throw new Error("provar: cena c-005 ausente da fixture");
  const porId = new Map(manifesto.nos.map((no) => [no.id, no] as const));
  const regioes = regioesDeTextoDaCena(cena, porId, LARGURA, ALTURA);

  const bloco = (noId: string, rotulo: string): BlocoDeclarado => {
    const regiao = regioes.get(noId);
    const no = porId.get(noId);
    if (regiao === undefined || no === undefined) {
      throw new Error(`provar: bloco "${noId}" sem banda no frame 580 da c-005`);
    }
    const caixa =
      no.type === "texto"
        ? caixaDoTexto(no as NoTexto, regiao, LARGURA, ALTURA)
        : caixaDaLegenda(
            (no as NoMidia).texto_alternativo ?? "",
            regiao,
            ALTURA,
          );
    return {
      noId,
      rotulo,
      x: Math.round(caixa.x),
      y: Math.round(caixa.y),
      largura: Math.round(caixa.largura),
      altura: Math.round(caixa.altura),
    };
  };

  // Janelas no frame 590 (c-005 = 547..727, transicao_entrada none):
  // n-014 [577,727), n-006 [547,607), n-007 [562,607) — os tres blocos
  // que o revisor mediu, com o fade de entrada do texto JÁ concluido
  // (n-014 entra em 577 com fade de 9 frames: so a partir de 586 o texto
  // fica 100% opaco e o branco puro #F9FAFB aparece — no frame 580 da
  // refutacao o texto esta a 33% de opacidade e o "branco" nao existe
  // nem com a correcao; por isso a sonda de pixel roda aqui, em 590, no
  // meio exato da janela 577-607 que o revisor mediu). (n-015 cabecalho
  // tambem esta, mas ficou sempre por cima da midia — nao e a evidencia.)
  return [
    bloco("n-014", "texto n-014 (banda 1)"),
    bloco("n-006", "legenda do video n-006 (banda 2)"),
    bloco("n-007", "legenda do gif n-007 (banda 3)"),
  ];
}

const SPECS: readonly Spec[] = [
  {
    composicao: "integrado",
    frame: 30,
    arquivo: "integrado-c001-frame30.png",
    oraculo: (png) => conferirEntropiaDoQuadro(png),
  },
  {
    composicao: "integrado",
    frame: 82,
    arquivo: "integrado-fronteira-frame82.png",
    oraculo: (png) => conferirEntropiaDoQuadro(png),
  },
  {
    composicao: "integrado",
    frame: 300,
    arquivo: "integrado-c003-frame300.png",
    oraculo: (png) => conferirEntropiaDoQuadro(png),
  },
  {
    composicao: "integrado",
    frame: 460,
    arquivo: "integrado-c004-frame460.png",
    oraculo: (png) => [
      ...conferirEntropiaDoQuadro(png),
      ...conferirCoresDaSerieNoQuadro(png, regiaoDoGrafico(LARGURA, ALTURA, true)),
    ],
  },
  {
    composicao: "integrado",
    frame: 580,
    arquivo: "integrado-c005-frame580.png",
    oraculo: (png) => conferirEntropiaDoQuadro(png),
  },
  {
    composicao: "integrado",
    frame: 590,
    arquivo: "integrado-c005-frame590.png",
    oraculo: (png) => [
      ...conferirEntropiaDoQuadro(png),
      ...conferirTintaDeTexto(png, blocosDeTextoDaCena005()),
    ],
  },
  {
    composicao: "integrado",
    frame: 726,
    arquivo: "integrado-fim-frame726.png",
    oraculo: (png) => conferirEntropiaDoQuadro(png),
  },
  {
    composicao: "integrado-grafico-asset",
    frame: 20,
    arquivo: "integrado-grafico-asset-frame20.png",
    oraculo: (png) => [
      ...conferirEntropiaDoQuadro(png),
      ...conferirRegiaoDoGrafico(png, regiaoDoGrafico(LARGURA, ALTURA, true)),
    ],
  },
  {
    composicao: "integrado-midia",
    frame: 20,
    arquivo: "integrado-midia-frame20.png",
    oraculo: (png) => [
      ...conferirEntropiaDoQuadro(png),
      ...conferirRegiaoDaMidia(png, regiaoInternaDaMidia(LARGURA, ALTURA)),
    ],
  },
];

interface Falha {
  readonly arquivo: string;
  readonly motivo: string;
}

async function principal(): Promise<number> {
  const aprovar = process.argv.includes("--aprovar");
  const temporario = mkdtempSync(join(tmpdir(), "integrado-"));
  const falhas: Falha[] = [];

  // Artefatos de uma execucao VERMELHA anterior (diagnostico em recebido/)
  // nao podem fazer uma execucao VERDE seguinte falhar o gate de status
  // (C3): recebido e diagnostico, nunca estado. Limpar antes de renderizar.
  rmSync(DIR_RECEBIDO, { recursive: true, force: true });

  process.stdout.write("=== integrado provar: determinismo + oraculo + snapshot ===\n");
  process.stdout.write(`  entrada: ${ENTRADA}\n`);

  const servidor = await bundle({
    entryPoint: ENTRADA,
    publicDir: DIR_ASSETS,
    onProgress: () => undefined,
  });
  process.stdout.write("  bundle: OK\n");

  try {
    for (const spec of SPECS) {
      process.stdout.write(`  still: ${spec.composicao} frame ${String(spec.frame)} -> ${spec.arquivo}\n`);
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
      process.stdout.write(`    determinismo: 2 renders, bytes identicos\n`);

      // O oraculo de conteudo so roda se os bytes passaram: o quadro preto
      // e deterministico — a entropia e a segunda barreira, nao a primeira.
      for (const falha of spec.oraculo(lerPngRgba(bytes1))) {
        falhas.push({ arquivo: spec.arquivo, motivo: `${falha.regiao}: ${falha.motivo}` });
      }

      const aprovado = resolve(DIR_APROVADO, spec.arquivo);
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
            `snapshot aprovado AUSENTE (${aprovado}). Ausencia e reprovacao: ` +
            `este script nao grava o que falta. Para aprovar de proposito, ` +
            `rode com --aprovar`,
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
      process.stdout.write(`    identico ao snapshot aprovado\n`);
    }
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }

  // O denominador: a lista de stills do gate nao pode encolher por engano.
  // O diretorio aprovado tem de ter EXATAMENTE os arquivos deste gate —
  // nem sobra nem falta (mesma disciplina de no-cabecalho/F1-04).
  const esperados = SPECS.map((s) => s.arquivo).sort();
  const noDisco = existsSync(DIR_APROVADO)
    ? readdirSync(DIR_APROVADO).filter((f) => f.endsWith(".png")).sort()
    : [];
  if (esperados.join("\n") !== noDisco.join("\n")) {
    falhas.push({
      arquivo: "aprovados/",
      motivo:
        `o diretorio aprovado diverge da lista de stills deste gate: ` +
        `esperado [${esperados.join(", ")}], no disco [${noDisco.join(", ")}]`,
    });
  }

  if (falhas.length > 0) {
    process.stdout.write("\n");
    for (const falha of falhas) {
      process.stdout.write(`  FALHOU  ${falha.arquivo}: ${falha.motivo}\n`);
    }
    process.stdout.write("\n=== VERMELHO: integrado provar ===\n");
    return 1;
  }

  process.stdout.write(`\n=== VERDE: ${String(SPECS.length)} stills, determinismo + oraculo + snapshot ===\n`);
  return 0;
}

process.exit(await principal());
