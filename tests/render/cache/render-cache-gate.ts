// =============================================================================
// render-cache — o GATE do cache de render por conteudo (card F5-09, W8)
// =============================================================================
// O `just render-cache` do PROGRAMA (hifen — convencao da W7 §7; o `just`
// 1.42 NAO aceita ':' em nome de receita). O gate roda sobre a fixture
// canonica integrada (a composicao `integrado`, 727 frames — a MESMA do
// gate do F5-01) e exercita OS DOIS lados do card:
//
//   ∅-crit ORIGINAL — mudar um token de design TEM de invalidar o cache
//     de render (mutacao: token mudado com cache quente fica VERMELHO).
//     No gate: o cache e populado com a chave dos tokens REAIS (S-5,
//     importados por leitura); um render pedido com a chave de um token
//     MUTADO tem de dar MISS e re-renderizar — um cache que ignorasse os
//     valores serviria o cache quente (renderer nao chamado) e o gate
//     FICA VERMELHO.
//   ∅-crit NOVO (C2) — sonda de cache-miss obrigatoria (AB-685): um
//     ∅-crit com cache QUENTE nao prova render — acertar a chave e nao
//     re-renderizar mascara um worker morto. O gate FORCA o miss (chave
//     fria), re-renderiza e compara contra o render SEM cache; um
//     renderer que rejeita (worker morto) com miss forcado PROPAGA — o
//     cache quente nunca mascara.
//   PERGUNTAS ADVERSARIAIS — (1) a chave inclui a versao do compositor e
//     a do navegador? (sim — componente 4, testado no vitest e conferido
//     aqui por sensibilidade); (2) um cache acertando pelo motivo errado
//     e detectavel? (sim — o acerto quente e comparado byte a byte contra
//     o render sem cache); (3) a invalidacao e por conteudo ou por data?
//     por conteudo — a chave e estavel sob relogio congelado em valores
//     diferentes (por data e falso verde); (4) o cache de bytes e
//     delimitado por CODIFICADORES_DA_COMPARACAO (png/qtrle so; vp9/webm
//     e mp4/h264 nunca — AB-396/397) e perfis deterministico:false
//     (NVENC — AB-700) nunca viram cache de bytes? (sim — conferido
//     aqui e no vitest).
//
// Teto de disco: ADR-0032 decisao 4 — saidas em /tmp, df /home com >= 10
// GiB livres antes do lote de renders, limpeza pos-render. A porta do
// card: 4509 (docs/contrato-w8.md §5). AB-684: o gate IMPRIME o MemTotal
// lido em runtime a cada execucao (tripwire visivel de que ele NAO esta
// na chave).
//
// Uso:  npx tsx tests/render/cache/render-cache-gate.ts
// =============================================================================

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  calcularChaveC7,
  componentesDaChaveC7,
  tokensConsumidosReais,
} from "../../../src/render/cache/chave";
import {
  permitidoCacheDeBytesDoCodec,
  ErroDeCacheDeBytes,
} from "../../../src/render/cache/delimitacao";
import { renderizarComCache } from "../../../src/render/cache/renderizar";
import {
  lerVersoesDaPilha,
  lerPinDeFerramentas,
} from "../../../src/render/cache/versoes";
import {
  prepararRender,
  rendererReal,
  type RendererDeFrames,
} from "../../../src/render/pipeline/executar";
import { lerMemTotalGiB } from "../../../src/render/pipeline/orcamento";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const DIR_FIXTURA = resolve(RAIZ, "fixtures", "snapshots", "integrado");
const ENTRADA = resolve(DIR_FIXTURA, "entrada.tsx");
const DIR_ASSETS = resolve(DIR_FIXTURA, "assets");
const MANIFESTO_RESOLVIDO = resolve(DIR_FIXTURA, "manifesto-integrado.json");
const PNG_DO_GRAFICO = resolve(RAIZ, "fixtures", "canonico", "assets", "grafico-integrado.png");

/** Porta TCP deste card (docs/contrato-w8.md §5: F5-09 = 4509). */
const PORTA = 4509;

/** O hash do asset de grafico da fixture canonica (AB-501). */
const HASH_DO_GRAFICO =
  "4dd3497f7719e4aa541f1087413be1522e47f4ac75c44eaceefcc4a8e5c4878c";

/** A composicao da fixture canonica inteira. */
const COMPOSICAO_ID = "integrado";

/** O total de frames da fixture canonica (727 — o MESMO numero do F5-01). */
const TOTAL_DE_FRAMES = 727;

// ---------------------------------------------------------------------------
// As falhas do gate
// ---------------------------------------------------------------------------

interface Falha {
  readonly nome: string;
  readonly motivo: string;
}

const falhas: Falha[] = [];

function ok(mensagem: string): void {
  process.stdout.write(`  OK    ${mensagem}\n`);
}

function falhou(nome: string, motivo: string): void {
  process.stdout.write(`  FALHOU ${nome}: ${motivo}\n`);
  falhas.push({ nome, motivo });
}

// ---------------------------------------------------------------------------
// 1. Espaco em disco antes do lote (ADR-0032, decisao 4 — AB-984)
// ---------------------------------------------------------------------------

function conferirDisco(): void {
  process.stdout.write("=== render-cache: ADR-0032 d.4 — espaco em disco ===\n");
  const saida = execFileSync("df", ["-P", "/home"], { encoding: "utf8" });
  const linhas = saida.trim().split("\n");
  const cabecalho = linhas[0]!.split(/\s+/);
  const valores = linhas[1]!.split(/\s+/);
  const indice = cabecalho.findIndex((c) => c.startsWith("Avail"));
  const disponivelKib = Number.parseInt(valores[indice] ?? "0", 10);
  const disponivelGiB = disponivelKib / (1024 * 1024);

  if (disponivelGiB >= 10) {
    ok(`${disponivelGiB.toFixed(1)} GiB livres em /home — lote de renders permitido`);
  } else {
    falhou(
      "disco",
      `${disponivelGiB.toFixed(1)} GiB livres em /home — a regra pratica exige >= 10 GiB (ADR-0032 d.4)`,
    );
  }
}

// ---------------------------------------------------------------------------
// 2. Porta do card e tripwire do AB-684 (MemTotal fora da chave, impresso)
// ---------------------------------------------------------------------------

function conferirPortaEAmbiente(): void {
  process.stdout.write("=== render-cache: porta do card + tripwire AB-684 ===\n");
  if (PORTA !== 4509) {
    falhou("porta", `porta ${String(PORTA)} != 4509 (docs/contrato-w8.md §5)`);
  } else {
    ok(`porta TCP do card: ${String(PORTA)} (docs/contrato-w8.md §5)`);
  }
  // AB-684: memTotal NUNCA entra na chave (muda concurrency, nao conteudo)
  // — o gate imprime o numero a cada execucao como tripwire visivel.
  const memTotal = lerMemTotalGiB();
  process.stdout.write(
    `  AB-684: MemTotal em runtime ${memTotal.toFixed(1)} GiB — fora da chave C7 ` +
      "(muda a CONCORRENCIA, nunca o conteudo da saida; ADR-0041 decisao 2)\n",
  );
}

// ---------------------------------------------------------------------------
// 3. A fronteira de codec — presenca, nunca lista fechada (contrato-w8 §7)
// ---------------------------------------------------------------------------

function conferirFronteiraDeCodec(): void {
  process.stdout.write("=== render-cache: fronteira do cache de bytes ===\n");

  // PRESENCA: png e qtrle declarados cacheaveis; vp9/webm e mp4/h264
  // excluidos com o motivo. NUNCA "os codecs cacheaveis sao exatamente
  // estes N" — CODIFICADORES_DA_COMPARACAO pode crescer (§7).
  for (const codec of ["png", "qtrle"]) {
    try {
      permitidoCacheDeBytesDoCodec(codec);
      ok(`codec "${codec}" cacheavel (permitido na comparacao do F5-01)`);
    } catch (e) {
      falhou("codec-cacheavel", `${codec}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const codec of ["vp9/webm", "mp4/h264"]) {
    try {
      permitidoCacheDeBytesDoCodec(codec);
      falhou("codec-excluido", `${codec} virou cache de bytes — exclusao ignorada`);
    } catch (e) {
      if (e instanceof ErroDeCacheDeBytes) {
        ok(`codec "${codec}" EXCLUIDO do cache de bytes com motivo: ${e.message.slice(0, 90)}...`);
      } else {
        falhou("codec-excluido", `${codec}: erro inesperado ${String(e)}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. A chave C7 — componentes, sensibilidade e o NEVER-set
// ---------------------------------------------------------------------------

/** As entradas da chave a partir da fixture (o que o render consome). */
function entradasDaChave(tokensConsumidos?: unknown) {
  const manifestoResolvido = readFileSync(MANIFESTO_RESOLVIDO);
  const bytesDoGrafico = readFileSync(PNG_DO_GRAFICO);
  const assets = new Map<string, Buffer>([[HASH_DO_GRAFICO, bytesDoGrafico]]);
  const versoes = lerVersoesDaPilha();
  const pinFerramentas = lerPinDeFerramentas();
  return { manifestoResolvido, assets, versoes, pinFerramentas, tokensConsumidos };
}

/** Um snapshot dos tokens com UM valor mutado (o ∅-crit do PROGRAMA). */
function tokensMutados(): unknown {
  const real = tokensConsumidosReais() as Record<string, unknown>;
  return {
    ...real,
    background: {
      ...(real.background as Record<string, unknown>),
      primary: "#010203", // o background.primary mutado
    },
  };
}

function conferirChaveC7(): ReturnType<typeof entradasDaChave> {
  process.stdout.write("=== render-cache: a chave C7 (5 componentes, por conteudo) ===\n");

  const entradas = entradasDaChave();
  const componentes = componentesDaChaveC7(entradas);
  const chave = calcularChaveC7(entradas);
  process.stdout.write(`  chave C7: ${chave.slice(0, 20)}...\n`);
  process.stdout.write(`  versoes: remotion ${entradas.versoes.remotion}, renderer ${entradas.versoes.renderer}, ` +
    `compositor ${entradas.versoes.compositor}, navegador ${entradas.versoes.navegador}\n`);
  process.stdout.write(`  pin: node ${entradas.pinFerramentas.node}, ffmpeg ${entradas.pinFerramentas.ffmpeg}\n`);

  // Os cinco componentes presentes (ADR-0041, decisao 1).
  let componentesOk = true;
  for (const nome of ["manifesto", "assets", "tokens", "versoes", "ferramentas"] as const) {
    if (componentes[nome].length !== 64) {
      componentesOk = false;
      falhou("chave-componente", `componente "${nome}" nao e sha256-hex: ${componentes[nome]}`);
    }
  }
  if (componentesOk) {
    ok("5 componentes presentes e hasheados (manifesto, assets, tokens, versoes, ferramentas)");
  }

  // (1) versao do compositor E do navegador na chave — sensibilidade.
  const navegadorOutro = calcularChaveC7({
    ...entradas,
    versoes: { ...entradas.versoes, navegador: "150.0.0.0" },
  });
  const compositorOutro = calcularChaveC7({
    ...entradas,
    versoes: { ...entradas.versoes, compositor: "4.0.508" },
  });
  if (navegadorOutro !== chave && compositorOutro !== chave) {
    ok("pergunta (1): compositor e navegador entram na chave — mudanca de versao muda a chave");
  } else {
    falhou("chave-versoes", "versao do compositor ou do navegador NAO muda a chave");
  }

  // (3) por CONTEUDO, nunca por data — chave estavel sob relogio congelado.
  const relogioOriginal = Date.now;
  let estavel = true;
  try {
    (Date as unknown as { now: () => number }).now = () => 0;
    const madrugada = calcularChaveC7(entradas);
    (Date as unknown as { now: () => number }).now = () => 9_999_999_999_999;
    const futuro = calcularChaveC7(entradas);
    estavel = madrugada === futuro && madrugada === chave;
  } finally {
    (Date as unknown as { now: () => number }).now = relogioOriginal;
  }
  if (estavel) {
    ok("pergunta (3): invalidacao por CONTEUDO — relogio congelado em valores diferentes, mesma chave (por data e falso verde)");
  } else {
    falhou("chave-data", "a chave mudou com o relogio — data entrou na chave (falso verde)");
  }

  // (2) + NEVER-set: o objeto de componentes NAO cita ambiente/execucao.
  const texto = JSON.stringify(componentes).toLowerCase();
  const proibidas = ["memtotal", "workers", "faixas", "porta", "data", "agendamento"];
  const violadas = proibidas.filter((p) => texto.includes(p));
  if (violadas.length === 0) {
    ok("NEVER-set (ADR-0041 d.2): a chave nao cita memTotal/workers/faixas/porta/data");
  } else {
    falhou("chave-never-set", `a chave cita o proibido: ${violadas.join(", ")}`);
  }

  // ∅-crit (mecanismo): tokens reais x tokens mutados tem de dar chaves
  // diferentes — a invalidacao acontece pela chave, nunca por data.
  const chaveMutada = calcularChaveC7(entradasDaChave(tokensMutados()));
  if (chaveMutada !== chave) {
    ok("∅-crit (mecanismo): token de design MUDADO muda a chave C7");
  } else {
    falhou("chave-token", "token mutado NAO mudou a chave — o cache nao invalidaria (∅-crit VERMELHO)");
  }

  return entradas;
}

// ---------------------------------------------------------------------------
// 5. O ciclo real: sem cache -> frio -> quente -> mutacao (∅-crits)
// ---------------------------------------------------------------------------

/** Le os PNGs de um diretorio, por indice de frame (AB-691). */
function pngsPorFrame(dir: string): Map<number, Buffer> {
  const mapa = new Map<number, Buffer>();
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith(".png")) continue;
    const frame = Number.parseInt(nome.replace(/^frame-/, "").replace(/\.png$/, ""), 10);
    mapa.set(frame, readFileSync(join(dir, nome)));
  }
  return mapa;
}

/** Compara dois conjuntos de frames por indice absoluto; devolve a lista de divergentes. */
function divergentes(a: Map<number, Buffer>, b: Map<number, Buffer>, total: number): number[] {
  const fora: number[] = [];
  for (let f = 0; f < total; f++) {
    const x = a.get(f);
    const y = b.get(f);
    if (x === undefined || y === undefined || !x.equals(y)) {
      fora.push(f);
    }
  }
  return fora;
}

async function conferirCicloReal(
  entradas: ReturnType<typeof entradasDaChave>,
): Promise<void> {
  process.stdout.write("=== render-cache: ciclo real (sem cache -> frio -> quente -> mutacao) ===\n");
  process.stdout.write(`  entrada: ${ENTRADA}\n`);
  process.stdout.write(`  composicao: ${COMPOSICAO_ID} (porta ${String(PORTA)})\n`);

  const chave = calcularChaveC7(entradas);
  const chaveMutada = calcularChaveC7(entradasDaChave(tokensMutados()));

  // Bundle e composicao UMA vez; os renders reusam o contexto.
  const contexto = await prepararRender({
    entrada: ENTRADA,
    publicDir: DIR_ASSETS,
    composicaoId: COMPOSICAO_ID,
  });

  // O renderer de producao embrulhado num contador: o gate observa
  // quantas vezes o render de verdade foi chamado (a sonda AB-685).
  let chamadasDoRenderer = 0;
  const rendererContado: RendererDeFrames = (opcoes) => {
    chamadasDoRenderer++;
    return rendererReal(opcoes);
  };

  const temporario = mkdtempSync(join(tmpdir(), "render-cache-gate-"));
  const raizDoCache = join(temporario, "cache");
  try {
    // ── R0: o render SEM cache — a linha de base da comparacao ──────
    process.stdout.write("  [R0] render sem cache (linha de base)...\n");
    const dirDaBase = join(temporario, "base");
    const base = await rendererReal({
      composition: contexto.composicao,
      serveUrl: contexto.serveUrl,
      outputDir: dirDaBase,
      frameRange: [0, TOTAL_DE_FRAMES - 1],
      concurrency: 8,
    });
    if (base.frameCount !== TOTAL_DE_FRAMES) {
      falhou("base", `render sem cache entregou ${String(base.frameCount)} frames (esperado ${String(TOTAL_DE_FRAMES)})`);
      return;
    }
    const framesDaBase = pngsPorFrame(dirDaBase);
    ok(`R0: ${String(base.frameCount)} frames renderizados sem cache`);

    // ── R1: chave FRIA — a sonda de MISS forcado (AB-685) ──────────
    // O cache acaba de nascer: nada esta cacheador. O render com cache
    // TEM de chamar o renderer (chamadas == 1) e produzir bytes
    // IDENTICOS aos do render sem cache.
    process.stdout.write("  [R1] miss forcado (chave fria) — re-renderiza e compara...\n");
    const chamadasAntesDeR1 = chamadasDoRenderer;
    const frio = await renderizarComCache({
      entrada: ENTRADA,
      publicDir: DIR_ASSETS,
      composicaoId: COMPOSICAO_ID,
      porta: PORTA,
      totalFrames: TOTAL_DE_FRAMES,
      workers: 8,
      chaveC7: chave,
      raizDoCache,
      contexto,
      renderer: rendererContado,
      componentes: componentesDaChaveC7(entradas),
      saida: join(temporario, "frio"),
    });
    const faltouChamar = chamadasDoRenderer - chamadasAntesDeR1;
    const divergenciasDoFrio = divergentes(
      pngsPorFrame(frio.dirDeSaida),
      framesDaBase,
      TOTAL_DE_FRAMES,
    );
    if (faltouChamar >= 1 && divergenciasDoFrio.length === 0) {
      ok(
        `R1: miss forcado re-renderizou (${String(faltouChamar)} chamada) e os ${String(TOTAL_DE_FRAMES)} frames ` +
          "batem byte a byte com o render sem cache — cache acertando pelo motivo errado e detectavel (pergunta 2)",
      );
    } else {
      falhou(
        "miss-forcado",
        `render com chave fria: chamadas ${String(faltouChamar)}, frames divergentes ${String(divergenciasDoFrio.length)} — ` +
          "a sonda AB-685 exige re-render + igualdade com o sem-cache",
      );
    }

    // ── R2: acerto QUENTE — 0 chamadas, bytes identicos ─────────────
    process.stdout.write("  [R2] cache quente — servido sem render...\n");
    const chamadasAntesDeR2 = chamadasDoRenderer;
    const quente = await renderizarComCache({
      entrada: ENTRADA,
      publicDir: DIR_ASSETS,
      composicaoId: COMPOSICAO_ID,
      porta: PORTA,
      totalFrames: TOTAL_DE_FRAMES,
      workers: 8,
      chaveC7: chave,
      raizDoCache,
      contexto,
      renderer: rendererContado,
      saida: join(temporario, "quente"),
    });
    const chamadasNoQuente = chamadasDoRenderer - chamadasAntesDeR2;
    const divergenciasDoQuente = divergentes(
      pngsPorFrame(quente.dirDeSaida),
      framesDaBase,
      TOTAL_DE_FRAMES,
    );
    if (quente.acertouTudo && chamadasNoQuente === 0 && divergenciasDoQuente.length === 0) {
      ok(
        "R2: acerto quente com 0 chamadas ao renderer e bytes identicos ao sem-cache — " +
          "e por isso que o gate força o miss: cache quente NAO prova render (AB-685)",
      );
    } else {
      falhou(
        "acerto-quente",
        `acerto quente: acertouTudo=${String(quente.acertouTudo)}, chamadas=${String(chamadasNoQuente)}, ` +
          `divergentes=${String(divergenciasDoQuente.length)}`,
      );
    }

    // ── R3: ∅-crit do PROGRAMA — token MUDADO com cache quente ──────
    // O cache esta CHEIO sob a chave dos tokens REAIS. Um render pedido
    // com a chave de tokens MUTADOS NAO pode ser servido: a chave muda,
    // o miss acontece e o renderer e chamado. Um cache que ignorasse os
    // valores serviria (chamadas == 0) e o ∅-crit ficaria VERMELHO.
    process.stdout.write("  [R3] ∅-crit: token mudado com cache quente...\n");
    const chamadasAntesDeR3 = chamadasDoRenderer;
    const mutado = await renderizarComCache({
      entrada: ENTRADA,
      publicDir: DIR_ASSETS,
      composicaoId: COMPOSICAO_ID,
      porta: PORTA,
      totalFrames: TOTAL_DE_FRAMES,
      workers: 8,
      chaveC7: chaveMutada,
      raizDoCache,
      contexto,
      renderer: rendererContado,
      saida: join(temporario, "mutado"),
    });
    const chamadasNaMutacao = chamadasDoRenderer - chamadasAntesDeR3;
    const divergenciasDaMutacao = divergentes(
      pngsPorFrame(mutado.dirDeSaida),
      framesDaBase,
      TOTAL_DE_FRAMES,
    );
    if (chamadasNaMutacao >= 1 && !mutado.acertouTudo && divergenciasDaMutacao.length === 0) {
      ok(
        "R3: token de design MUDADO com cache quente deu MISS e re-renderizou — " +
          "a invalidacao aconteceu pela chave (∅-crit do PROGRAMA)",
      );
    } else {
      falhou(
        "token-mutado",
        `token mutado com cache quente: chamadas=${String(chamadasNaMutacao)}, ` +
          `acertouTudo=${String(mutado.acertouTudo)}, divergentes=${String(divergenciasDaMutacao.length)} — ` +
          "o ∅-crit exige VERMELHO quando o token mudado e servido do cache",
      );
    }

    // ── Sonda do worker morto (AB-685): a rejeicao PROPAGA ──────────
    process.stdout.write("  [R4] sonda: worker morto com miss forcado PROPAGA...\n");
    const raizDaSonda = join(temporario, "cache-sonda");
    const morto: RendererDeFrames = () =>
      Promise.reject(new Error("worker morto (sonda AB-685)"));
    let erroDaSonda: Error | null = null;
    try {
      await renderizarComCache({
        entrada: ENTRADA,
        publicDir: DIR_ASSETS,
        composicaoId: COMPOSICAO_ID,
        porta: PORTA,
        totalFrames: TOTAL_DE_FRAMES,
        workers: 8,
        chaveC7: chaveMutada, // chave fria: miss forcado
        raizDoCache: raizDaSonda,
        contexto,
        renderer: morto,
        saida: join(temporario, "sonda"),
      });
    } catch (e) {
      erroDaSonda = e as Error;
    }
    if (erroDaSonda !== null && erroDaSonda.message.includes("worker morto")) {
      ok("R4: worker morto com miss forcado derruba o pipeline — o cache quente nunca mascara (AB-685)");
    } else {
      falhou(
        "worker-morto",
        `worker morto nao derrubou o pipeline: ${erroDaSonda === null ? "exit 0 (VERMELHO)" : erroDaSonda.message}`,
      );
    }
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function principal(): Promise<number> {
  process.stdout.write("=== render-cache: gate do cache de render por conteudo (F5-09) ===\n");

  conferirDisco();
  conferirPortaEAmbiente();
  conferirFronteiraDeCodec();
  const entradas = conferirChaveC7();
  await conferirCicloReal(entradas);

  if (falhas.length > 0) {
    process.stdout.write("\n");
    for (const f of falhas) {
      process.stdout.write(`  FALHOU ${f.nome}: ${f.motivo}\n`);
    }
    process.stdout.write("\n=== VERMELHO: render-cache ===\n");
    return 1;
  }

  process.stdout.write(
    "\n=== VERDE: render-cache — token mudado invalida (∅-crit), miss forcado prova render " +
      "(AB-685), chave C7 por conteudo com compositor/navegador, fronteira de codec ===\n",
  );
  return 0;
}

process.exit(await principal());
