#!/usr/bin/env npx tsx
/**
 * tests/audio/mix.ferramenta.ts
 *
 * A FERRAMENTA DO GATE DO MIX — card F3-05 (W7). ADR-0034.
 *
 * Mora em tests/ (nao em tools/) porque o mapa da onda da a este card
 * apenas `src/audio/mix/**` e `tests/**` — a mesma convencao da
 * ducking.ferramenta.ts (F3-03). Nao e um teste (`*.ferramenta.ts` nao
 * casa o glob do vitest); e executada por `npx tsx`.
 *
 * Modos:
 *
 *   --conferir (default) — o gate completo:
 *     1. fixture CANONICA REAL (cassetes commitados + ffmpeg pinado):
 *        mix VERDE + medicoes (clip, sobreposicao, cobertura, presenca);
 *     2. caso de ESTRESSE (cadencia CORTANTE gapAlvo 0,05): a emenda
 *        difere da fonte e o ∅-crit C3 e exercitado de verdade;
 *     3. sondas ∅-crit (cada uma TEM de ficar VERMELHA, com a mensagem
 *        assertada — nunca so o exit code);
 *     4. determinismo 2x em DOIS PROCESSOS separados, com TZ/LANG
 *        propositalmente diferentes, comparando bytes e documento.
 *   --saida <dir> — constroi o mix da fixture (VERDE obrigatorio),
 *     publica as emendas no store e escreve master.wav + documento.json
 *     + medicoes.json no diretorio. E o modo dos filhos do determinismo.
 *
 * Por que ffmpeg: a trilha (F2-06) e OGG Vorbis 44,1 kHz e o master e
 * f32 48 kHz (ADR-0034, D1). A reamostragem/decodificacao e da FERRAMENTA
 * pinada (versao gravada no documento do mix); o modulo e puro.
 */

import { spawn, execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import { lerTimingCanonico } from "../../src/sincronia/timing/validar.js";
import type { TimingCanonico } from "../../src/sincronia/timing/formato.js";
import {
  calcularEnvelopeDucking,
  posicoesDaTimeline,
} from "../../src/sincronia/ducking/calcular.js";
import { cortarSilencio } from "../../src/sincronia/ritmo/cortar.js";
import { Store } from "../../src/store/store.js";
import type { Procedencia } from "../../src/store/procedencia.js";
import { lerWavPcm, escreverWavPcm, paraCanais } from "../../src/audio/mix/pcm.js";
import { mixar } from "../../src/audio/mix/mixar.js";
import type { EntradasDoMix, ResultadoDoMix } from "../../src/audio/mix/mixar.js";
import { verificarMix } from "../../src/audio/mix/verificar.js";
import type { MedicoesDoMix } from "../../src/audio/mix/verificar.js";
import { serializarMixDocumento } from "../../src/audio/mix/formato.js";
import { sha256Bytes } from "../../src/audio/mix/formato.js";

// ─── Caminhos ─────────────────────────────────────────────────────────────────

const TIMING_CANONICO = "fixtures/canonico/timing-canono.json";
const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const CASSETES_LOCUCAO = "fixtures/cassetes/locucao";
const CASSETES_MUSICA = "fixtures/cassetes/musica";
const RAIZ_SAIDA = ".cache/audio-mix";
const RAIZ_STORE = ".cache/store";

/** Versao minima do ffmpeg aceita pelo gate (mesmo piso do justfile). */
const FFMPEG_MINIMA = "6.0";

// ─── Contexto do gate ─────────────────────────────────────────────────────────

interface ContextoDoGate {
  entradas: EntradasDoMix;
  /** Bytes crus dos cassetes por hash (fonte e musica). */
  corpos: Map<string, Buffer>;
  musicaHash: string;
  store: Store;
  ffmpegVersao: string;
  dirTrabalho: string;
}

/** Sonda: o veredito esperado de uma verificacao (VERMELHO = problema). */
interface Sonda {
  nome: string;
  prefixo: string;
  trechoEsperado: RegExp;
  rodar: () => Promise<readonly string[]>;
}

// ─── Carregamento da fixture canonica ─────────────────────────────────────────

/** Indexa os corpos dos cassetes: nome do arquivo == hash do conteudo. */
async function indexarCorpos(diretorios: readonly string[]): Promise<Map<string, Buffer>> {
  const mapa = new Map<string, Buffer>();
  for (const raiz of diretorios) {
    const chaves = await readdir(raiz, { withFileTypes: true }).catch(() => []);
    for (const chave of chaves) {
      if (!chave.isDirectory()) continue;
      const corpos = await readdir(join(raiz, chave.name, "corpos")).catch(() => []);
      for (const nome of corpos) {
        if (!/^[0-9a-f]{64}$/.test(nome)) continue;
        mapa.set(nome, await readFile(join(raiz, chave.name, "corpos", nome)));
      }
    }
  }
  return mapa;
}

/** O hash da trilha de musica: trilha_sonora do resultado do cassete F2-06. */
async function hashDaTrilha(): Promise<string> {
  const cassetes = await readdir(CASSETES_MUSICA, { withFileTypes: true });
  const hashes = new Set<string>();
  for (const c of cassetes) {
    if (!c.isDirectory()) continue;
    const resultado = JSON.parse(
      await readFile(join(CASSETES_MUSICA, c.name, "resultado.json"), "utf-8"),
    ) as { trilha_sonora?: string };
    if (typeof resultado.trilha_sonora === "string") hashes.add(resultado.trilha_sonora);
  }
  if (hashes.size !== 1) {
    throw new Error(
      `trilha_sonora do cassete de musica ambiguo (${[...hashes].join(", ")})`,
    );
  }
  return [...hashes][0]!;
}

/** Versao do ffmpeg local — o pin do determinismo, gravado no documento. */
async function versaoDoFfmpeg(): Promise<string> {
  const saida = await new Promise<string>((resolve, reject) => {
    execFile("ffmpeg", ["-version"], (erro, stdout) => {
      if (erro) reject(new Error(`ffmpeg ausente: ${String(erro)}`));
      else resolve(stdout);
    });
  });
  const m = /^ffmpeg version (\S+)/.exec(saida);
  if (m === null) throw new Error("nao reconheci a versao do ffmpeg");
  return m[1]!;
}

/**
 * O decoder do gate: ffmpeg pinado -> WAV f32 estereo 48 kHz.
 *
 * `-fflags +bitexact -flags +bitexact -map_metadata -1` DEPOIS da
 * entrada (a posicao importa — ffmpeg-media-ops): o WAV sai sem
 * metadado de ferramenta, e dois decodes produzem os mesmos bytes.
 */
function criarDecoder(ffmpegVersao: string, dir: string) {
  const cache = new Map<string, ReturnType<typeof lerWavPcm>>();
  return async (bytes: Buffer) => {
    const chave = sha256Bytes(bytes);
    const pronto = cache.get(chave);
    if (pronto !== undefined) return pronto;
    const entrada = join(dir, `in-${chave.slice(0, 16)}`);
    const saida = join(dir, `out-${chave.slice(0, 16)}.wav`);
    await writeFile(entrada, bytes);
    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-hide_banner", "-loglevel", "error", "-y",
          "-i", entrada,
          "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
          "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", "-f", "wav",
          saida,
        ],
        (erro) => (erro ? reject(new Error(`ffmpeg (${ffmpegVersao}): ${String(erro)}`)) : resolve()),
      );
    });
    const pcm = lerWavPcm(await readFile(saida));
    cache.set(chave, pcm);
    return pcm;
  };
}

/** Monta as entradas do mix com a fixture canonica REAL. */
async function montarEntradas(
  gapAlvoS: number,
  dir: string,
): Promise<ContextoDoGate> {
  const ffmpegVersao = await versaoDoFfmpeg();
  const [maior, menor] = ffmpegVersao.split(".").map((n) => Number.parseInt(n, 10));
  const [minMaior, minMenor] = FFMPEG_MINIMA.split(".").map((n) => Number.parseInt(n, 10));
  if (
    (maior ?? 0) < (minMaior ?? 0) ||
    ((maior ?? 0) === (minMaior ?? 0) && (menor ?? 0) < (minMenor ?? 0))
  ) {
    throw new Error(
      `ffmpeg ${ffmpegVersao} abaixo do piso ${FFMPEG_MINIMA} — o determinismo ` +
        "do decode e declarado por pin, nunca por promessa",
    );
  }

  const timing = lerTimingCanonico(await readFile(TIMING_CANONICO, "utf-8"));
  const manifesto = JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
  const posicoes = posicoesDaTimeline(manifesto);
  const envelope = calcularEnvelopeDucking({ timing, posicoes });
  const cadencia = cortarSilencio(timing, { gapAlvoS });
  const corpos = await indexarCorpos([CASSETES_LOCUCAO, CASSETES_MUSICA]);
  const musicaHash = await hashDaTrilha();
  const store = new Store({ root: RAIZ_STORE });
  const decodificar = await criarDecoder(ffmpegVersao, dir);

  const entradas: EntradasDoMix = {
    timing,
    manifesto,
    envelope,
    cadencia,
    musicaHash,
    carregarBytes: async (hash) => {
      const doStore = await store.get(hash);
      return doStore ?? corpos.get(hash) ?? null;
    },
    decodificarPcm: async (bytes) => paraCanais(await decodificar(bytes), 2),
    opcoes: {
      rate: 48000,
      canais: 2,
      ffmpeg: ffmpegVersao,
      node: process.version,
    },
  };
  return { entradas, corpos, musicaHash, store, ffmpegVersao, dirTrabalho: dir };
}

// ─── Publicacao das emendas no store (C3) ─────────────────────────────────────

/** Procedencia da emenda: derivada do audio-fonte (CC0-1.0, sosia-local). */
function procedenciaDaEmenda(cena: string): Procedencia {
  return {
    license: "CC0-1.0",
    attributionRequired: true,
    attribution: "Audio sintetico de referencia — nao e voz humana",
    source: "local",
    acquiredAt: new Date(0).toISOString(),
    toolVersion: "mix-f3-05 (ADR-0034)",
    notes:
      `emenda da cena "${cena}": bytes do audio-fonte menos os cortes de ` +
      "silencio da cadencia (Ritmo.1). Hash NOVO enderecavel por conteudo — " +
      "proibido tratar a emenda como se fosse a fonte (C3/AB-617).",
  };
}

async function publicarEmendas(ctx: ContextoDoGate, mix: ResultadoDoMix): Promise<void> {
  for (const emenda of mix.emendas) {
    await ctx.store.put(emenda.bytes, procedenciaDaEmenda(emenda.cena));
  }
}

// ─── O rodar padrao: mix + publicacao + verificacao ───────────────────────────

async function rodarMix(
  ctx: ContextoDoGate,
  opcoesExtra?: EntradasDoMix["opcoes"],
): Promise<{ mix: ResultadoDoMix; problemas: readonly string[]; medicoes: MedicoesDoMix }> {
  const mix = await mixar({
    ...ctx.entradas,
    opcoes: { ...ctx.entradas.opcoes, ...opcoesExtra },
  });
  await publicarEmendas(ctx, mix);
  const verificacao = await verificarMix(ctx.entradas, mix);
  return { mix, problemas: verificacao.problemas, medicoes: verificacao.medicoes };
}

// ─── Sondas ∅-crit ────────────────────────────────────────────────────────────

/** Timing valido sem nenhuma cena de locucao (a sonda do ∅-crit original). */
function timingSemLocucao(timing: TimingCanonico): TimingCanonico {
  const cenas: Record<string, TimingCanonico["cenas"][string]> = {};
  for (const [id, entrada] of Object.entries(timing.cenas)) {
    cenas[id] = {
      unidade: "segundos",
      estado: "silencio",
      duracao_s: entrada.duracao_s,
    };
  }
  return { ...timing, cenas };
}

async function rodarSondas(ctx: ContextoDoGate, dir: string): Promise<number> {
  console.log("");
  console.log("=== sondas ∅-crit (cada uma TEM de ficar VERMELHA) ===");

  // P1 — mix sem locucao (∅-crit original do PROGRAMA).
  const p1: Sonda = {
    nome: "P1 mix sem locucao",
    prefixo: "V5",
    trechoEsperado: /sem locucao|NENHUMA faixa/,
    rodar: async () => {
      const timing = timingSemLocucao(ctx.entradas.timing);
      const envelope = calcularEnvelopeDucking({
        timing,
        posicoes: posicoesDaTimeline(ctx.entradas.manifesto),
      });
      const cadencia = cortarSilencio(timing);
      const mix = await mixar({
        ...ctx.entradas,
        timing,
        envelope,
        cadencia,
      });
      const v = await verificarMix({ ...ctx.entradas, timing, envelope, cadencia }, mix);
      return v.problemas;
    },
  };

  // P2 — duas locucoes simultaneas (∅-crit C1, item 4): a fixture canonica
  // sobrepoe c-004/c-005 em 4,505 s; sem a reconciliacao o mix convive.
  const p2: Sonda = {
    nome: "P2 duas locucoes simultaneas > 0,1 s",
    prefixo: "V3",
    trechoEsperado: /sobreposicao de fala/,
    rodar: async () => {
      const r = await rodarMix(ctx, { aplicarReconciliacao: false });
      return r.problemas;
    },
  };

  // P3 — emenda enderecada pelo hash do audio-fonte (∅-crit C3), com a
  // cadencia CORTANTE: a emenda difere da fonte, e endereca-la pela fonte
  // e o falso-verde que o ∅-crit persegue.
  const p3: Sonda = {
    nome: "P3 emenda enderecada pelo hash do audio-fonte",
    prefixo: "V4",
    trechoEsperado: /hash do\s*audio-FONTE|audio-FONTE/,
    rodar: async () => {
      const estresse = await montarEntradas(0.05, join(dir, "estresse"));
      const mix = await mixar(estresse.entradas);
      await publicarEmendas(estresse, mix);
      const documentoMentiroso = {
        ...mix.documento,
        faixas: {
          ...mix.documento.faixas,
          locucao: mix.documento.faixas.locucao.map((f) =>
            f.cena === "c-004" ? { ...f, emenda_hash: f.fonte_hash } : f,
          ),
        },
      };
      const v = await verificarMix(estresse.entradas, { ...mix, documento: documentoMentiroso });
      return v.problemas;
    },
  };

  // P4 — o envelope NAO aplicado (adversarial 3: a musica cobre a locucao).
  const p4: Sonda = {
    nome: "P4 envelope nao aplicado onde a fala existe",
    prefixo: "V7",
    trechoEsperado: /envelope|ducking/,
    rodar: async () => {
      const r = await rodarMix(ctx, { aplicarEnvelope: false });
      return r.problemas;
    },
  };

  // P5 — clip nos bytes (adversarial 1: a soma das faixas estoura).
  const p5: Sonda = {
    nome: "P5 mix que clipa",
    prefixo: "V6",
    trechoEsperado: /clipa/,
    rodar: async () => {
      const r = await rodarMix(ctx);
      const amostras = Float32Array.from(r.mix.pcm.amostras);
      amostras[amostras.length - 1] = 1.5;
      const v = await verificarMix(ctx.entradas, {
        ...r.mix,
        pcm: { ...r.mix.pcm, amostras },
      });
      return v.problemas;
    },
  };

  let falhas = 0;
  for (const sonda of [p1, p2, p3, p4, p5]) {
    const problemas = await sonda.rodar();
    const acusou = problemas.some((p) => p.startsWith(sonda.prefixo));
    const mensagemCerta = problemas.some((p) => sonda.trechoEsperado.test(p));
    if (acusou && mensagemCerta) {
      console.log(`  VERMELHO como esperado: ${sonda.nome}`);
      for (const p of problemas.filter((x) => x.startsWith(sonda.prefixo))) {
        console.log(`    - ${p.split("\n")[0]}`);
      }
    } else {
      console.log(`  FALHOU A SONDA: ${sonda.nome}`);
      console.log(`    acusou=${acusou} mensagemCerta=${mensagemCerta}`);
      if (problemas.length === 0) console.log("    (a verificacao saiu VERDE — o ∅-crit nao acusou)");
      falhas += 1;
    }
  }
  return falhas;
}

// ─── Determinismo 2x em dois processos ────────────────────────────────────────

async function rodarDeterminismo(): Promise<number> {
  console.log("");
  console.log("=== determinismo 2x em dois PROCESSOS, ambientes diferentes (C9) ===");
  const dirA = join(RAIZ_SAIDA, "det-a");
  const dirB = join(RAIZ_SAIDA, "det-b");
  await rm(dirA, { recursive: true, force: true });
  await rm(dirB, { recursive: true, force: true });
  await mkdir(dirA, { recursive: true });
  await mkdir(dirB, { recursive: true });

  const executar = (dir: string, env: NodeJS.ProcessEnv) =>
    new Promise<void>((resolve, reject) => {
      const filho = spawn(
        "npx",
        ["tsx", fileURLToPath(import.meta.url), "--saida", dir],
        {
          env: { ...process.env, ...env },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let saida = "";
      filho.stdout.on("data", (d: Buffer) => (saida += d.toString()));
      filho.stderr.on("data", (d: Buffer) => (saida += d.toString()));
      filho.on("close", (codigo) => {
        if (codigo === 0) resolve();
        else reject(new Error(`filho do determinismo saiu ${codigo}:\n${saida.slice(0, 2000)}`));
      });
    });

  await executar(dirA, { TZ: "UTC", LANG: "C" });
  await executar(dirB, { TZ: "America/Sao_Paulo", LANG: "pt_BR.UTF-8" });

  const arquivos = ["master.wav", "documento.json", "medicoes.json"] as const;
  let falhas = 0;
  for (const arquivo of arquivos) {
    const a = await readFile(join(dirA, arquivo));
    const b = await readFile(join(dirB, arquivo));
    if (a.equals(b)) {
      console.log(`  ${arquivo}: identico nos dois processos (${a.length} bytes)`);
    } else {
      console.log(`VERMELHO: ${arquivo} divergiu entre os dois processos.`);
      falhas += 1;
    }
  }
  console.log(`  master.wav sha256: ${sha256Bytes(await readFile(join(dirA, "master.wav")))}`);
  return falhas;
}

// ─── Modo --saida (filho do determinismo) ─────────────────────────────────────

async function saida(dir: string): Promise<number> {
  await mkdir(dir, { recursive: true });
  const dirTrabalho = join(dir, "trabalho");
  await mkdir(dirTrabalho, { recursive: true });
  const ctx = await montarEntradas(0.25, dirTrabalho);
  const { mix, problemas, medicoes } = await rodarMix(ctx);
  if (problemas.length > 0) {
    console.log("VERMELHO: o mix da fixture nao passou na verificacao:");
    for (const p of problemas) console.log(`  - ${p}`);
    return 1;
  }
  await writeFile(join(dir, "master.wav"), mix.bytes);
  await writeFile(join(dir, "documento.json"), serializarMixDocumento(mix.documento));
  await writeFile(join(dir, "medicoes.json"), JSON.stringify(medicoes, null, 2) + "\n");
  return 0;
}

// ─── Modo --conferir (o gate completo) ────────────────────────────────────────

async function conferir(): Promise<number> {
  console.log("=== audio-mix: trilha de audio composta (F3-05, W7) ===");
  await rm(RAIZ_SAIDA, { recursive: true, force: true });
  await mkdir(RAIZ_SAIDA, { recursive: true });
  const dir = join(RAIZ_SAIDA, "conferir");
  await mkdir(dir, { recursive: true });

  // 1. Fixture canonica (cadencia default 0,25 — sem cortes na fixture).
  const ctx = await montarEntradas(0.25, dir);
  const { mix, problemas, medicoes } = await rodarMix(ctx);

  if (problemas.length > 0) {
    console.log("VERMELHO: o mix da fixture canonica nao passou na verificacao:");
    for (const p of problemas) console.log(`  - ${p}`);
    return 1;
  }
  console.log("  fixture canonica: VERDE");
  console.log("  master: 48 kHz estéreo f32, " + mix.bytes.length + " bytes");
  console.log("  hash do master: " + sha256Bytes(mix.bytes));
  console.log("  pico absoluto: " + medicoes.picoAbsoluto.toFixed(4) + " (clip > 1.0)");
  console.log("  sobreposicao residual maxima: " + medicoes.sobreposicaoMaxima_s.toFixed(4) + " s (teto 0.1 s)");

  const c004 = mix.documento.faixas.locucao.find((f) => f.cena === "c-004")!;
  const c005 = mix.documento.faixas.locucao.find((f) => f.cena === "c-005")!;
  console.log("  pergunta da onda (§12): a fala de c-004 esta em [" +
    `${c004.inicio_s.toFixed(3)}..${(c004.inicio_s + 8.505).toFixed(3)}] ` +
    `com a cauda cortada no inicio de c-005 (${c005.inicio_s.toFixed(3)} s)`);
  for (const m of medicoes.cenas) {
    console.log(
      `  cena ${m.cena}: [${m.inicio_s.toFixed(3)}..${m.fim_s.toFixed(3)}]s ` +
        `rmsFala=${m.rmsFala.toFixed(4)} atenuacao=${m.atenuacaoMedida_db.toFixed(1)}dB ` +
        `(declarada ${m.atenuacaoDeclarada_db.toFixed(1)}dB) ` +
        `margemFalaMusica=${m.margemFalaMusica_db.toFixed(1)}dB`,
    );
  }
  if (c004.emenda_hash === c004.fonte_hash) {
    console.log(
      "  emenda c-004 == fonte (esperado: a cadencia default nao corta a " +
        "fixture — enderecamento por conteudo; o caso de estresse exercita o hash NOVO)",
    );
  }

  // 2. Caso de ESTRESSE (cadencia cortante): emenda com identidade nova.
  console.log("");
  console.log("=== caso de estresse: cadencia cortante (gapAlvo 0,05) ===");
  const dirEstresse = join(dir, "estresse");
  await mkdir(dirEstresse, { recursive: true });
  const estresse = await montarEntradas(0.05, dirEstresse);
  const mixEstresse = await mixar(estresse.entradas);
  await publicarEmendas(estresse, mixEstresse);
  const verEstresse = await verificarMix(estresse.entradas, mixEstresse);
  if (verEstresse.problemas.length > 0) {
    console.log("VERMELHO: o mix de estresse nao passou:");
    for (const p of verEstresse.problemas) console.log(`  - ${p}`);
    return 1;
  }
  console.log("  mix de estresse: VERDE (reconciliacao + emenda + cobertura)");
  for (const f of mixEstresse.documento.faixas.locucao) {
    const status =
      f.emenda_hash === f.fonte_hash
        ? "hash == fonte (ERRO esperado aqui)"
        : "hash NOVO, distinto da fonte";
    console.log(`  emenda ${f.cena}: ${f.emenda_hash.slice(0, 12)}… — ${status}`);
  }

  // 3. Sondas ∅-crit.
  const falhasSondas = await rodarSondas(ctx, dir);
  if (falhasSondas > 0) {
    console.log(`VERMELHO: ${falhasSondas} sonda(s) nao acusaram.`);
    return 1;
  }

  // 4. Determinismo 2x.
  const falhasDet = await rodarDeterminismo();
  if (falhasDet > 0) {
    console.log("VERMELHO: determinismo nao sustentado.");
    return 1;
  }

  console.log("");
  console.log("=== VERDE: trilha de audio composta sustentada (medida, nao escutada) ===");
  return 0;
}

// ─── Entrada ──────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const argumentos = process.argv.slice(2);
  const indiceSaida = argumentos.indexOf("--saida");
  if (indiceSaida >= 0) {
    const dir = argumentos[indiceSaida + 1];
    if (dir === undefined) {
      console.error("uso: mix.ferramenta.ts --saida <diretorio>");
      return 2;
    }
    return saida(dir);
  }
  return conferir();
}

const executadoDireto =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  main().then(
    (codigo) => process.exit(codigo),
    (erro: unknown) => {
      console.error("tests/audio/mix.ferramenta.ts: erro inesperado:", erro);
      process.exit(2);
    },
  );
}
