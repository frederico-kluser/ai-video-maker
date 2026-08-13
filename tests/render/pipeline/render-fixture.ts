// =============================================================================
// render-fixture — o GATE do pipeline de render por faixas (card F5-01, W7)
// =============================================================================
// O `just render-fixture` do PROGRAMA (hifen, convencao da W7 §7). O gate
// roda sobre a fixture canonica integrada (a composicao `integrado`, 727
// frames) e exercita OS DOIS lados do card:
//
//   ∅-crit ORIGINAL — render por faixa de frames + concatenacao TEM de
//     bater byte a byte com o render inteiro, DELIMITADO ao codec
//     deterministico (PNG/QTRLE; WebM vp9 e MP4 final excluidos por
//     declaracao — AB-396/397, codificacoes.ts). A comparacao e em duas
//     camadas:
//       (a) PNG: os bytes de cada frame renderizado por faixa tem de ser
//           IDENTICOS aos do render inteiro (o encadeamento das faixas na
//           ordem do plano e a concatenacao);
//       (b) QTRLE: cada faixa vira um .mov qtrle/argb, os trechos sao
//           concatenados com o concat demuxer (-c copy, sem reencode) e a
//           comparacao por frame DECODIFICADO (framemd5) tem de bater com
//           o .mov do render inteiro — a concatenacao real de arquivos de
//           video reproduz o render continuo.
//   ∅-crit NOVO (C2) — cena com no inexistente no manifesto resolvido fica
//     VERMELHO, com mensagem nomeando regra e caminho.
//   PERGUNTA ADVERSARIAL (2) — a concorrencia do gate nunca excede o teto
//     medido do I-03 (workers <= 8; RAM <= 24 GiB pela formula do
//     ADR-0032, com MemTotal lido em runtime — AB-986).
//   PERGUNTA ADVERSARIAL (3) — um worker que morre derruba o pipeline:
//     composicao inexistente e sonda negativa — o gate TEM de ficar
//     VERMELHO e a sonda TEM de acusar.
//   C4/C3 — o posicionamento de audio consome a cadencia (Ritmo.1) e o
//     envelope (DuckingEnvelope.1) pelos campos absolutos (a fala de c-004
//     em [14,233..22,738], o MESMO numero do contrato C1) e a emenda pelo
//     hash NOVO do mix — nunca o hash do audio-fonte.
//
// Saidas de trabalho em /tmp (AB-984) — nunca no filesystem do repo — e
// limpas ao fim. A sonda de espaco roda antes: df /home >= 10 GiB.
//
// Uso:  npx tsx tests/render/pipeline/render-fixture.ts
// Porta TCP deste card: 4501 (docs/contrato-w7.md §11).
// Faixa de ledger: AB-680..AB-699 (ledger/inbox/F5-01.json).
// =============================================================================

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Manifesto } from "../../../src/contratos/manifesto";
import type { Procedencia } from "../../../src/store/procedencia";
import { lerTimingCanonico } from "../../../src/sincronia/timing/validar";
import { cortarSilencio } from "../../../src/sincronia/ritmo/cortar";
import {
  calcularEnvelopeDucking,
  posicoesDaTimeline,
} from "../../../src/sincronia/ducking/calcular";
import { background } from "../../../src/design/tokens";
import {
  atravessarPonte,
  REGRA_INTEGRIDADE_REFERENCIAL,
  type ResultadoDaPonte,
} from "../../../src/render/pipeline/ponte";
import {
  posicionarAudio,
  type MixDeEmenda,
} from "../../../src/render/pipeline/audio";
import { calcularOrcamento } from "../../../src/render/pipeline/orcamento";
import { planejarFaixas, coberturaDasFaixas, violacoesDeTamanho } from "../../../src/render/pipeline/faixas";
import { renderizarPorFaixas, prepararRender } from "../../../src/render/pipeline/executar";
import { garantirCodecComparavel } from "../../../src/render/pipeline/codificacoes";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const DIR_FIXTURA = resolve(RAIZ, "fixtures", "snapshots", "integrado");
const ENTRADA = resolve(DIR_FIXTURA, "entrada.tsx");
const DIR_ASSETS = resolve(DIR_FIXTURA, "assets");
const MANIFESTO_RESOLVIDO = resolve(DIR_FIXTURA, "manifesto-integrado.json");
const PNG_DO_GRAFICO = resolve(RAIZ, "fixtures", "canonico", "assets", "grafico-integrado.png");
const PROCEDENCIA_DO_GRAFICO = resolve(AQUI, "grafico-procedencia.json");
const TIMING_CANONICO = resolve(RAIZ, "fixtures", "canonico", "timing-canono.json");
const MANIFESTO_CANONICO = resolve(RAIZ, "fixtures", "canonico", "manifesto-valido.json");

/** Porta TCP deste card (docs/contrato-w7.md §11: F5-01 = 4501). */
const PORTA = 4501;

/** O hash do asset de grafico da fixture canonica (AB-501). */
const HASH_DO_GRAFICO =
  "4dd3497f7719e4aa541f1087413be1522e47f4ac75c44eaceefcc4a8e5c4878c";

/** A composicao da fixture canonica inteira. */
const COMPOSICAO_ID = "integrado";

// ---------------------------------------------------------------------------
// Acoes do gate
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
// 1. A ponte AB-550 (C2) — a fixture atravessa com campos de fonte nomeada
// ---------------------------------------------------------------------------

function atravessarAFixture(): ResultadoDaPonte {
  const resolvido = JSON.parse(readFileSync(MANIFESTO_RESOLVIDO, "utf8")) as {
    manifesto: Manifesto;
    assets: Record<string, unknown>;
    nos_grafico: Record<string, string>;
  };
  const bytesDoGrafico = readFileSync(PNG_DO_GRAFICO);
  const procedencia = JSON.parse(
    readFileSync(PROCEDENCIA_DO_GRAFICO, "utf8"),
  ) as Procedencia;

  const assets = new Map<string, Buffer>();
  for (const hash of Object.keys(resolvido.assets)) {
    assets.set(hash, bytesDoGrafico);
  }

  return atravessarPonte({
    manifesto: resolvido.manifesto,
    assets,
    procedencias: new Map([[HASH_DO_GRAFICO, procedencia]]),
    nosGrafico: new Map(Object.entries(resolvido.nos_grafico)),
  });
}

function conferirPonte(): void {
  process.stdout.write("=== render-fixture: C2 — a ponte AB-550 na fixture ===\n");
  const resultado = atravessarAFixture();

  if (resultado.campos.hash.fonte.includes("F0-07")) {
    ok("hash: fonte nomeada (store F0-07), chave casa com os bytes do asset");
  } else {
    falhou("ponte-hash", `fonte do hash sem F0-07: ${resultado.campos.hash.fonte}`);
  }
  const licenca = resultado.assets.get(HASH_DO_GRAFICO)?.licenca.valor;
  if (licenca === "CC0-1.0") {
    ok("licenca: vem da procedencia (F0-07), nunca digitada na ponte");
  } else {
    falhou("ponte-licenca", `licenca esperada CC0-1.0, obtida ${String(licenca)}`);
  }
  if (resultado.plano.totalFrames === 727) {
    ok("frames: aritmetica de F1-01 deriva 727 frames da fixture canonica");
  } else {
    falhou(
      "ponte-frames",
      `plano derivou ${String(resultado.plano.totalFrames)} frames (esperado 727)`,
    );
  }
  if (resultado.campos.cores.valor === background.primary) {
    ok("cores: token de src/design/tokens.ts (S-1), fonte nomeada");
  } else {
    falhou("ponte-cores", "cor da fronteira diverge do token background.primary");
  }
}

// ---------------------------------------------------------------------------
// 2. ∅-crit NOVO (C2) — cena com no inexistente fica VERMELHO
// ---------------------------------------------------------------------------

function conferirIntegridadeReferencial(): void {
  process.stdout.write("=== render-fixture: C2 — integridade referencial (∅-crit) ===\n");
  const resolvido = JSON.parse(readFileSync(MANIFESTO_RESOLVIDO, "utf8")) as {
    manifesto: Manifesto;
    assets: Record<string, unknown>;
    nos_grafico: Record<string, string>;
  };

  // Muta a cena c-005 para referenciar um no que NAO existe no manifesto.
  const mutado = JSON.parse(JSON.stringify(resolvido.manifesto)) as Manifesto;
  const c005 = mutado.cenas.find((c) => c.id === "c-005");
  if (c005 === undefined) {
    falhou("integridade-sonda", "c-005 ausente da fixture — sonda impossivel");
    return;
  }
  c005.nos = [...c005.nos, "n-999"];

  let erro: Error | null = null;
  try {
    atravessarPonte({
      manifesto: mutado,
      assets: new Map(),
      procedencias: new Map(),
      nosGrafico: new Map(),
    });
  } catch (e) {
    erro = e as Error;
  }

  if (erro === null) {
    falhou(
      "integridade",
      "cena com no inexistente (n-999) ATRAVESSOU a ponte — o ∅-crit exige VERMELHO",
    );
    return;
  }
  const mensagem = erro.message;
  const nomeiaCena = mensagem.includes('cena "c-005"');
  const nomeiaNo = mensagem.includes('no inexistente "n-999"');
  const nomeiaRegra = mensagem.includes(REGRA_INTEGRIDADE_REFERENCIAL);
  const nomeiaCampo = mensagem.includes("campo cena.nos");
  if (nomeiaCena && nomeiaNo && nomeiaRegra && nomeiaCampo) {
    ok(
      `cena com no inexistente e VERMELHO, nomeando regra e caminho: ` +
        `"${mensagem.slice(0, 110)}..."`,
    );
  } else {
    falhou(
      "integridade",
      `erro sem a assinatura exigida (cena=${String(nomeiaCena)} no=${String(nomeiaNo)} ` +
        `regra=${String(nomeiaRegra)} campo=${String(nomeiaCampo)}): ${mensagem.slice(0, 200)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. C4/C3 — posicionamento de audio pela ancora absoluta
// ---------------------------------------------------------------------------

function conferirAudio(): void {
  process.stdout.write("=== render-fixture: C4/C3 — ancora absoluta do audio ===\n");
  const timing = lerTimingCanonico(readFileSync(TIMING_CANONICO, "utf8"));
  const manifesto = JSON.parse(readFileSync(MANIFESTO_CANONICO, "utf8")) as Manifesto;
  const posicoes = posicoesDaTimeline(manifesto);
  const cadencia = cortarSilencio(timing).documento;
  const envelope = calcularEnvelopeDucking({ timing, posicoes });

  // O mix de C3: hash NOVO da emenda por cena (o F3-05 publica os bytes).
  const mix: MixDeEmenda = {
    cenas: new Map([
      ["c-004", "e".repeat(64)],
      ["c-005", "f".repeat(64)],
    ]),
  };

  const plano = posicionarAudio({ cadencia, envelope, mix, posicoes });
  const c004 = plano.faixas.find((f) => f.cenaId === "c-004");
  const c005 = plano.faixas.find((f) => f.cenaId === "c-005");

  if (
    c004 !== undefined &&
    Math.abs(c004.inicio_s - 14.233) < 1e-3 &&
    Math.abs(c004.fim_s - 22.738) < 1e-3
  ) {
    ok("a fala de c-004 esta em [14,233..22,738] — o MESMO numero do contrato C1");
  } else {
    falhou(
      "audio-c004",
      `fala de c-004 em [${String(c004?.inicio_s)}..${String(c004?.fim_s)}] — ` +
        "esperado [14,233..22,738] (C1, mesma base do F3-05)",
    );
  }
  if (
    c005 !== undefined &&
    Math.abs(c005.inicio_s - 18.233) < 1e-3 &&
    Math.abs(c005.fim_s - 23.588) < 1e-3
  ) {
    ok("a fala de c-005 esta em [18,233..23,588] — o MESMO numero do contrato C1");
  } else {
    falhou(
      "audio-c005",
      `fala de c-005 em [${String(c005?.inicio_s)}..${String(c005?.fim_s)}] — ` +
        "esperado [18,233..23,588]",
    );
  }
  const hashDaFonte = cadencia.cenas["c-004"]?.audio;
  if (c004 !== undefined && c004.hash === "e".repeat(64) && c004.hash !== hashDaFonte) {
    ok("a emenda e posicionada pelo hash NOVO do mix (C3), nunca o da fonte");
  } else {
    falhou(
      "audio-c3",
      `hash da faixa c-004 = ${String(c004?.hash.slice(0, 12))} — esperado o hash NOVO do mix`,
    );
  }
}

// ---------------------------------------------------------------------------
// 4. Pergunta adversarial (2) — o teto medido do I-03 + MemTotal em runtime
// ---------------------------------------------------------------------------

function conferirOrcamento(): void {
  process.stdout.write("=== render-fixture: I-03 — teto de concorrencia ===\n");
  const orcamento = calcularOrcamento({
    workersDesejados: 8,
    arvoresSimultaneas: 4, // a fase de faixas: 4 arvores em paralelo
    lerMemTotalGiB: undefined,
  });
  process.stdout.write(
    `  maquina: MemTotal ${orcamento.memTotalGiB.toFixed(1)} GiB, limite ` +
      `${orcamento.limiteRamGiB.toFixed(1)} GiB, RAM estimada ` +
      `${orcamento.ramEstimadaGiB.toFixed(2)} GiB, workers ${String(orcamento.workers)}\n`,
  );

  if (orcamento.workers <= 8 && orcamento.dentroDoTeto) {
    ok(
      `workers ${String(orcamento.workers)} <= 8 e RAM ${orcamento.ramEstimadaGiB.toFixed(2)} ` +
        "GiB dentro do teto (ADR-0032, MemTotal em runtime — AB-986)",
    );
  } else {
    falhou(
      "orcamento",
      `workers ${String(orcamento.workers)} ou RAM ${orcamento.ramEstimadaGiB.toFixed(2)} ` +
        "fora do teto do ADR-0032",
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Espaco em disco antes do lote (AB-984)
// ---------------------------------------------------------------------------

function conferirDisco(): void {
  process.stdout.write("=== render-fixture: AB-984 — espaco em disco ===\n");
  const saida = execFileSync("df", ["-P", "/home"], { encoding: "utf8" });
  const linhas = saida.trim().split("\n");
  const cabecalho = linhas[0]!.split(/\s+/);
  const valores = linhas[1]!.split(/\s+/);
  // `df -P` nomeia a coluna "Available" (nao "Avail") — casa por prefixo.
  const indice = cabecalho.findIndex((c) => c.startsWith("Avail"));
  const disponivelKib = Number.parseInt(valores[indice] ?? "0", 10);
  const disponivelGiB = disponivelKib / (1024 * 1024);

  if (disponivelGiB >= 10) {
    ok(`${disponivelGiB.toFixed(1)} GiB livres em /home — lote de renders permitido`);
  } else {
    falhou(
      "disco",
      `${disponivelGiB.toFixed(1)} GiB livres em /home — a regra pratica exige >= 10 GiB (AB-984)`,
    );
  }
}

// ---------------------------------------------------------------------------
// 6. O render por faixas + a comparacao byte a byte (∅-crit)
// ---------------------------------------------------------------------------

/** Le os PNGs de um diretorio do render, por indice de frame. */
function pngsPorFrame(dir: string): Map<number, Buffer> {
  const mapa = new Map<number, Buffer>();
  for (const nome of readdirSync(dir)) {
    if (!nome.endsWith(".png")) continue;
    const frame = Number.parseInt(nome.replace(/^frame-/, "").replace(/\.png$/, ""), 10);
    mapa.set(frame, readFileSync(join(dir, nome)));
  }
  return mapa;
}

async function conferirRenderPorFaixas(): Promise<void> {
  process.stdout.write("=== render-fixture: render inteiro x faixas ===\n");
  process.stdout.write(`  entrada: ${ENTRADA}\n`);
  process.stdout.write(`  composicao: ${COMPOSICAO_ID} (porta ${String(PORTA)})\n`);

  // A delimitacao do ∅-crit: o codec da comparacao e DECLARADO — a guarda
  // recusa vp9/mp4 com o motivo (AB-396/397), nunca compara em silencio.
  garantirCodecComparavel("png");
  ok("delimitacao: comparacao byte a byte no codec deterministico (PNG/QTRLE); vp9/mp4 excluidos por declaracao (AB-396/397)");

  // A porta do card em uso (S-9): quem abrir o navegador por outra porta
  // colide com os irmaos da onda.
  if (PORTA !== 4501) {
    falhou("porta", `porta ${String(PORTA)} != 4501 (docs/contrato-w7.md §11)`);
  } else {
    ok(`porta TCP do card: ${String(PORTA)} (docs/contrato-w7.md §11)`);
  }

  const orcamento = calcularOrcamento({
    workersDesejados: 8,
    arvoresSimultaneas: 4,
  });

  // O plano de faixas: 4 faixas, cobertura total, tamanhos conforme R12-09.
  const planoDeFaixas = planejarFaixas(727, 4);
  if (
    coberturaDasFaixas(planoDeFaixas, 727).length === 0 &&
    violacoesDeTamanho(planoDeFaixas).length === 0
  ) {
    ok(
      "plano: 4 faixas cobrindo 727 frames, mesmo tamanho exceto a ultima (R12-09)",
    );
  } else {
    falhou(
      "plano",
      `faixas com buracos ou tamanhos irregulares: ${JSON.stringify(planoDeFaixas)}`,
    );
  }

  const temporario = mkdtempSync(join(tmpdir(), "render-fixture-"));
  try {
    const resultado = await renderizarPorFaixas({
      entrada: ENTRADA,
      publicDir: DIR_ASSETS,
      composicaoId: COMPOSICAO_ID,
      porta: PORTA,
      saida: temporario,
      totalFrames: 727,
      faixas: planoDeFaixas,
      workers: orcamento.workers,
    });
    process.stdout.write(
      `  render: inteiro ${String(resultado.framesDoInteiro)} frames, faixas ` +
        `${String(resultado.framesDasFaixas)} frames\n`,
    );
    if (
      resultado.framesDoInteiro !== 727 ||
      resultado.framesDasFaixas !== 727
    ) {
      falhou(
        "render-contagem",
        `inteiro ${String(resultado.framesDoInteiro)} / faixas ${String(resultado.framesDasFaixas)} — esperado 727/727`,
      );
      return;
    }
    ok("render: inteiro e faixas renderizaram os 727 frames da fixture");

    // ── ∅-crit: bytes iguais por frame entre a concatenacao das faixas e
    //    o render inteiro ────────────────────────────────────────────────
    const inteiro = pngsPorFrame(resultado.dirDoInteiro);
    const faixas = resultado.dirsDasFaixas.map((dir) => pngsPorFrame(dir));

    let divergentes = 0;
    let primeiroDivergente = -1;
    for (let frame = 0; frame < 727; frame++) {
      const dona = planoDeFaixas.findIndex(
        (f) => frame >= f.inicio && frame < f.fim,
      );
      const bytesDoInteiro = inteiro.get(frame);
      const bytesDaFaixa = faixas[dona]?.get(frame);
      if (
        bytesDoInteiro === undefined ||
        bytesDaFaixa === undefined ||
        !bytesDoInteiro.equals(bytesDaFaixa)
      ) {
        divergentes++;
        if (primeiroDivergente < 0) primeiroDivergente = frame;
      }
    }

    if (divergentes === 0) {
      ok(
        "∅-crit: 727/727 frames — a concatenacao das faixas bate byte a byte " +
          "com o render inteiro (codec deterministico PNG)",
      );
    } else {
      falhou(
        "byte-a-byte",
        `${String(divergentes)} frame(s) divergente(s); primeiro em ` +
          `${String(primeiroDivergente)} — a concatenacao NAO bate com o inteiro`,
      );
    }

    // ── Sonda QTRLE: a concatenacao REAL de arquivos de video ───────────
    conferirConcatenacaoQtrle(resultado.dirDoInteiro, resultado.dirsDasFaixas, temporario);
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }
}

/**
 * Sonda qtrle: cada faixa vira um .mov qtrle/argb (encode lossless e
 * deterministico do cassete F2-02), os trechos sao concatenados com o
 * concat demuxer (-c copy, zero reencode) e a comparacao por frame
 * DECODIFICADO (framemd5, a camada 1 da video-characterization) tem de
 * bater com o .mov do render inteiro.
 */
function conferirConcatenacaoQtrle(
  dirDoInteiro: string,
  dirsDasFaixas: readonly string[],
  temporario: string,
): void {
  process.stdout.write("=== render-fixture: sonda qtrle — concat de video real ===\n");
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    falhou("qtrle", "ffmpeg ausente — ferramenta ausente e VERMELHO");
    return;
  }

  const movs: string[] = [];
  for (let i = 0; i < dirsDasFaixas.length; i++) {
    const mov = join(temporario, `faixa-${String(i)}.mov`);
    execFileSync(
      "ffmpeg",
      [
        "-y", "-hide_banner", "-loglevel", "error",
        "-framerate", "30",
        "-pattern_type", "glob",
        "-i", join(dirsDasFaixas[i]!, "frame-*.png"),
        "-c:v", "qtrle", "-pix_fmt", "argb",
        mov,
      ],
      { stdio: "pipe" },
    );
    if (!existsSync(mov) || statSync(mov).size === 0) {
      falhou("qtrle", `encode da faixa ${String(i)} nao escreveu .mov (C1)`);
      return;
    }
    movs.push(mov);
  }

  const movDoInteiro = join(temporario, "inteiro.mov");
  execFileSync(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error",
      "-framerate", "30",
      "-pattern_type", "glob",
      "-i", join(dirDoInteiro, "frame-*.png"),
      "-c:v", "qtrle", "-pix_fmt", "argb",
      movDoInteiro,
    ],
    { stdio: "pipe" },
  );

  const lista = join(temporario, "concat-list.txt");
  writeFileSync(
    lista,
    movs.map((m) => `file '${m}'`).join("\n") + "\n",
  );
  const movConcat = join(temporario, "concat.mov");
  execFileSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", movConcat],
    { stdio: "pipe" },
  );

  const framemd5 = (caminho: string): string =>
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", caminho, "-f", "framemd5", "-"], {
      encoding: "utf8",
    });

  const md5Inteiro = framemd5(movDoInteiro);
  const md5Concat = framemd5(movConcat);
  // As linhas de frame do framemd5 comecam com "<stream>, <dts>, <pts>, ..."
  // — o cabecalho de colunas ("#stream#, dts, ...") tambem tem virgulas e
  // NAO e linha de frame (falsifiable-gates: parse nao-vazio por TIPO).
  const linhaDeFrame = /^\d+,\s*\d+,/;
  const hashesInteiro = md5Inteiro
    .trim()
    .split("\n")
    .filter((l) => linhaDeFrame.test(l))
    .map((l) => l.split(",").slice(-1)[0]!.trim());
  const hashesConcat = md5Concat
    .trim()
    .split("\n")
    .filter((l) => linhaDeFrame.test(l))
    .map((l) => l.split(",").slice(-1)[0]!.trim());

  if (
    hashesInteiro.length === 727 &&
    hashesConcat.length === 727 &&
    hashesInteiro.every((h, i) => h === hashesConcat[i])
  ) {
    ok(
      "qtrle: 727/727 frames decodificados — a concatenacao dos .mov reproduz " +
        "o render inteiro (framemd5 identico)",
    );
  } else {
    falhou(
      "qtrle",
      `framemd5 diverge (inteiro ${String(hashesInteiro.length)} linhas, ` +
        `concat ${String(hashesConcat.length)}) — a concatenacao nao reproduz o inteiro`,
    );
  }
}

// ---------------------------------------------------------------------------
// 7. Pergunta adversarial (3) — worker morto derruba o pipeline
// ---------------------------------------------------------------------------

async function conferirWorkerMorto(): Promise<void> {
  process.stdout.write("=== render-fixture: worker morto derruba o pipeline ===\n");
  let erro: Error | null = null;
  try {
    // Composicao inexistente: o renderer "morre" antes de renderizar.
    await prepararRender({
      entrada: ENTRADA,
      publicDir: DIR_ASSETS,
      composicaoId: "composicao-que-nao-existe",
    });
  } catch (e) {
    erro = e as Error;
  }

  if (erro === null) {
    falhou(
      "worker-morto",
      "composicao inexistente renderizou — um worker morto deixou o pipeline verde",
    );
  } else {
    ok("composicao inexistente derruba o pipeline (exit nao-zero) — o gate fica VERMELHO");
  }
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function principal(): Promise<number> {
  process.stdout.write("=== render-fixture: gate do pipeline de render (F5-01) ===\n");

  conferirPonte();
  conferirIntegridadeReferencial();
  conferirAudio();
  conferirOrcamento();
  conferirDisco();
  await conferirRenderPorFaixas();
  await conferirWorkerMorto();

  if (falhas.length > 0) {
    process.stdout.write("\n");
    for (const f of falhas) {
      process.stdout.write(`  FALHOU ${f.nome}: ${f.motivo}\n`);
    }
    process.stdout.write("\n=== VERMELHO: render-fixture ===\n");
    return 1;
  }

  process.stdout.write(
    "\n=== VERDE: render-fixture — faixa == inteiro byte a byte (PNG + QTRLE), " +
      "integridade referencial, teto I-03, ancora absoluta ===\n",
  );
  return 0;
}

process.exit(await principal());
