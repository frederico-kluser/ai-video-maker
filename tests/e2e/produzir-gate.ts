#!/usr/bin/env npx tsx
/**
 * tests/e2e/produzir-gate.ts
 *
 * O GATE DE PONTA A PONTA — card F5-07 (W9, o join). Rodado por
 * `just e2e` (o `just produzir` roda o CLI + a conferencia de presenca;
 * este gate cobre as SONDAS que o card exige). Contrato-w9 inteiro.
 *
 * O que este gate prova (e como):
 *
 *   R1  producao COMPLETA com chave C7 FRIA (cache-dir novo): o renderer
 *       e chamado (miss forcado — AB-685), todos os 11 artefatos saem e
 *       a conferencia de presenca (lida da constante) fica VERDE.
 *   R2  re-execucao INTEGRAL com a MESMA chave (retomada idempotente,
 *       contrato-w9 §4): o renderer NAO e chamado (0 chamadas — acerto
 *       quente nao prova render, mas a re-execucao e barata) e TODOS os
 *       artefatos saem byte a byte identicos aos da R1, frames
 *       incluidos (o cache serve os bytes certos).
 *   R3  chave MUTADA (tokens — o componente 3 da C7) com cache FRIO: a
 *       chave muda => MISS => re-render (C12: acertar a chave pelo
 *       motivo errado e detectavel; entrada mudou => cache velho nunca
 *       serve). Os artefatos continuam identicos (o snapshot mutado nao
 *       pinta).
 *   S0  sondas ∅-crit de PRESENCA: remover OU corromper cada um dos 11
 *       artefatos deixa o gate VERMELHO NOMEANDO o artefato.
 *   S1  AB-745: o hash da emenda citado no relatorio de procedencia e o
 *       hash NOVO (igual ao do PlanoDeAudio e do MixDocument), nunca o
 *       hash do audio-fonte; um relatorio com a fonte no lugar fica
 *       VERMELHO. Exercitado tambem com cadencia CORTANTE (0.05).
 *   S2  determinismo do perfil do estrito: 2x encodes de um trecho do
 *       mesmo master = bytes identicos + framemd5 identico.
 *   S3  escopo 16:9: a variante do estrito e 16:9; nenhum artefato 9:16
 *       existe na lista.
 *   S4  pin: relatorio-final registra ffmpeg 6.1.1 (o mux verificou) e
 *       o MixDocument.ferramentas declara o pin.
 *   S5  --cache-dir exposto: R1/R2 usam um cache nomeado e o acerto
 *       quente da R2 so existe por causa dele (a raiz default /tmp e a
 *       politica do processo sao do F5-07, AB-793).
 *
 * O veredito e por PROBLEMAS (vazio = VERDE), na mesma disciplina dos
 * gates anteriores. O gate roda 2x no CI (flake transitorio conhecido do
 * render Chrome sob carga).
 */

import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { RendererDeFrames } from "../../src/render/pipeline/executar.js";
import { criarFilaDeEncode, executarEncode, listarPerfis, verificarSaida, codecNameDePerfil } from "../../src/render/encode/index.js";
import { gerarRelatorio } from "../../src/entrega/procedencia/relatorio.js";
import { serializarRelatorio, MARCADOR_DERIVACAO } from "../../src/entrega/procedencia/formato.js";
import { adaptarStore } from "../../src/entrega/procedencia/relatorio.js";
import { Store } from "../../src/store/store.js";
import { lerTimingCanonico } from "../../src/sincronia/timing/validar.js";
import { calcularEnvelopeDucking, posicoesDaTimeline } from "../../src/sincronia/ducking/calcular.js";
import { cortarSilencio } from "../../src/sincronia/ritmo/cortar.js";
import { mixar } from "../../src/audio/mix/mixar.js";
import { lerWavPcm, paraCanais } from "../../src/audio/mix/pcm.js";
import { reproduzirLocucao } from "../../src/resolucao/locucao/replay.js";
import {
  produzir,
  conferirPresenca,
  escreverAtomico,
  sha256Hex,
  ErroDoPipeline,
  ARTEFATOS_ESPERADOS_DO_ESTRITO,
  executorPadrao,
} from "../../src/pipeline/index.js";
import type { OpcoesDaProducao, ResultadoDaProducao } from "../../src/pipeline/index.js";
import { Store as StoreReal } from "../../src/store/store.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const SAIDA = join(RAIZ, "output");

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

/** O renderer real contado — a sonda AB-685 (cache quente nao prova render). */
function rendererContado(): { renderer: RendererDeFrames; chamadas: () => number } {
  let chamadas = 0;
  return {
    renderer: (async (opcoes) => {
      chamadas++;
      const { rendererReal } = await import("../../src/render/pipeline/executar.js");
      return rendererReal(opcoes);
    }) as RendererDeFrames,
    chamadas: () => chamadas,
  };
}

/** Os artefatos em memoria, por nome (os bytes daquela execucao). */
function artefatosDe(r: ResultadoDaProducao): Map<string, Buffer[]> {
  const saida = new Map<string, Buffer[]>();
  for (const [nome, arquivos] of r.artefatos) {
    saida.set(nome, arquivos.map((a) => a.bytes));
  }
  return saida;
}

/** Todos os arquivos planos (nome -> bytes) de um resultado. */
function arquivosPlanosDe(r: ResultadoDaProducao): Map<string, Buffer> {
  const saida = new Map<string, Buffer>();
  for (const [nome, arquivos] of r.artefatos) {
    for (const a of arquivos) saida.set(`${nome}::${a.nome}`, a.bytes);
  }
  return saida;
}

/** Compara dois conjuntos de artefatos byte a byte (idempotencia). */
function divergencias(a: Map<string, Buffer>, b: Map<string, Buffer>): string[] {
  const divergentes: string[] = [];
  for (const [chave, bytesA] of a) {
    const bytesB = b.get(chave);
    if (bytesB === undefined) {
      divergentes.push(`${chave}: ausente na segunda execucao`);
      continue;
    }
    if (!bytesA.equals(bytesB)) {
      divergentes.push(`${chave}: bytes divergem (${bytesA.length}B vs ${bytesB.length}B)`);
    }
  }
  for (const chave of b.keys()) {
    if (!a.has(chave)) divergentes.push(`${chave}: presente apenas na segunda execucao`);
  }
  return divergentes;
}

/** Le os frames de um diretorio por indice absoluto (AB-691). */
async function framesPorIndice(dir: string): Promise<Map<number, Buffer>> {
  const mapa = new Map<number, Buffer>();
  for (const nome of await readdir(dir)) {
    if (!nome.endsWith(".png")) continue;
    const indice = Number.parseInt(nome.replace(/^frame-/, "").replace(/\.png$/, ""), 10);
    mapa.set(indice, await readFile(join(dir, nome)));
  }
  return mapa;
}

/** A sonda AB-745: o hash NOVO da emenda no relatorio == PlanoDeAudio. */
function conferirEmendaNova(
  relatorio: { diretos: readonly { hash: string; derivadoDe: { hash: string } | null }[] },
  planoDeAudio: { faixas: readonly { cenaId: string; hash: string }[] },
  emendasDoMix: ReadonlyMap<string, { emendaHash: string; fonteHash: string }>,
): string[] {
  const problemas: string[] = [];
  const porCena = new Map(planoDeAudio.faixas.map((f) => [f.cenaId, f.hash]));
  for (const [cena, emenda] of emendasDoMix) {
    const hashNoPlano = porCena.get(cena);
    if (hashNoPlano === undefined) {
      problemas.push(`cena ${cena}: ausente do PlanoDeAudio`);
      continue;
    }
    // O plano de audio usa o hash da EMENDA (C3) — nunca o da fonte.
    if (hashNoPlano !== emenda.emendaHash) {
      problemas.push(
        `cena ${cena}: o PlanoDeAudio cita ${hashNoPlano?.slice(0, 12)}… e a emenda ` +
          `do mix e ${emenda.emendaHash.slice(0, 12)}… — o plano nao usa a emenda`,
      );
    }
    if (hashNoPlano === emenda.fonteHash) {
      problemas.push(
        `cena ${cena}: o PlanoDeAudio cita o hash do AUDIO-FONTE no lugar da emenda ` +
          "(AB-745: o falso-verde do C3)",
      );
    }
    // O relatorio cita a emenda pelo hash NOVO (o mesmo do plano).
    const entrada = relatorio.diretos.find((d) => d.hash === emenda.emendaHash);
    if (entrada === undefined) {
      problemas.push(
        `cena ${cena}: o relatorio NAO cita a emenda ${emenda.emendaHash.slice(0, 12)}… ` +
          `(a citada no PlanoDeAudio) — o relatorio e de OUTRO mix`,
      );
      continue;
    }
    if (entrada.derivadoDe?.hash !== emenda.fonteHash) {
      problemas.push(
        `cena ${cena}: a derivacao declarada no relatorio e ` +
          `${entrada.derivadoDe?.hash.slice(0, 12) ?? "(nenhuma)"}, esperado o ` +
          `audio-fonte ${emenda.fonteHash.slice(0, 12)}… (${MARCADOR_DERIVACAO})`,
      );
    }
  }
  return problemas;
}

// ─── O gate ───────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const temporario = await mkdtemp(join(tmpdir(), "produzir-gate-"));
  const cacheFrio = join(temporario, "cache-frio");
  const cacheMutado = join(temporario, "cache-mutado");
  const saidaDaSonda = join(temporario, "saida-sonda");

  try {
    // ── R1: producao completa, chave FRIA ─────────────────────────────
    process.stdout.write("=== R1: producao completa (chave C7 fria — miss forcado, AB-685) ===\n");
    const contadoR1 = rendererContado();
    const r1 = await produzir({
      fixture: "canonico",
      estrito: true,
      cacheDir: cacheFrio,
      saida: SAIDA,
      fila: criarFilaDeEncode(),
      renderer: contadoR1.renderer,
    });
    if (r1.chamadasDoRenderer === 0 || contadoR1.chamadas() === 0) {
      falhou("R1", "renderer nao foi chamado com chave fria — o miss forcado nao aconteceu");
    } else {
      ok(`R1: renderer chamado ${String(r1.chamadasDoRenderer)}x (miss forcado)`);
    }
    const problemasR1 = await conferirPresenca(r1.relatorioFinal, SAIDA);
    if (problemasR1.length > 0) {
      falhou("R1-presenca", `a conferencia acusou: ${problemasR1.join(" | ")}`);
    } else {
      ok("R1: 11 artefatos presentes e conferidos (hash + tamanho no relatorio-final)");
    }
    const relatorioLido = JSON.parse(await readFile(join(SAIDA, "relatorio-final.json"), "utf-8"));
    if (relatorioLido.ferramentas.ffmpeg === undefined) {
      falhou("R1-pin", "relatorio-final sem ferramentas.ffmpeg");
    } else if (!/^6\.1\.1/.test(relatorioLido.ferramentas.ffmpeg)) {
      falhou("R1-pin", `ffmpeg do relatorio ${relatorioLido.ferramentas.ffmpeg} fora do pin 6.1.1`);
    } else {
      ok(`R1: pin registrado no relatorio-final (ffmpeg ${relatorioLido.ferramentas.ffmpeg})`);
    }

    // ── R2: re-execucao INTEGRAL com a MESMA chave (idempotencia) ────
    process.stdout.write("=== R2: re-execucao integral (retomada idempotente, contrato-w9 §4) ===\n");
    const contadoR2 = rendererContado();
    const r2 = await produzir({
      fixture: "canonico",
      estrito: true,
      cacheDir: cacheFrio,
      saida: SAIDA,
      fila: criarFilaDeEncode(),
      renderer: contadoR2.renderer,
    });
    if (r2.chamadasDoRenderer !== 0 || contadoR2.chamadas() !== 0) {
      falhou(
        "R2",
        `o renderer foi chamado ${String(r2.chamadasDoRenderer)}x com a MESMA chave — ` +
          "a retomada idempotente devia servir o cache (e o cache quente NAO prova render: " +
          "a prova do render e a R1)",
      );
    } else {
      ok("R2: 0 chamadas ao renderer (acerto quente na retomada)");
    }
    const divergentesR2 = divergencias(arquivosPlanosDe(r1), arquivosPlanosDe(r2));
    if (divergentesR2.length > 0) {
      falhou("R2-idempotencia", `artefatos divergiram: ${divergentesR2.join(" | ")}`);
    } else {
      ok("R2: todos os artefatos byte a byte identicos (idempotencia)");
    }
    const framesR1 = await framesPorIndice(r1.dirDeFrames);
    const framesR2 = await framesPorIndice(r2.dirDeFrames);
    const framesDivergentes: number[] = [];
    for (let f = 0; f < framesR1.size; f++) {
      const a = framesR1.get(f);
      const b = framesR2.get(f);
      if (a === undefined || b === undefined || !a.equals(b)) framesDivergentes.push(f);
    }
    if (framesDivergentes.length > 0) {
      falhou("R2-frames", `o cache serviu frames divergentes em ${framesDivergentes.slice(0, 5).join(",")}…`);
    } else {
      ok(`R2: ${String(framesR1.size)} frames servidos do cache byte a byte identicos`);
    }

    // ── R3: chave MUTADA (C12 — acertar a chave pelo motivo errado) ──
    process.stdout.write("=== R3: chave C7 mutada (token) com cache frio — MISS obrigatorio ===\n");
    const { tokensConsumidosReais } = await import("../../src/render/cache/chave.js");
    const reais = tokensConsumidosReais() as Record<string, unknown>;
    const mutados = {
      ...reais,
      background: {
        ...(reais.background as Record<string, unknown>),
        primary: "#010203",
      },
    };
    const contadoR3 = rendererContado();
    const r3 = await produzir({
      fixture: "canonico",
      estrito: true,
      cacheDir: cacheMutado,
      saida: SAIDA,
      fila: criarFilaDeEncode(),
      renderer: contadoR3.renderer,
      tokensConsumidos: mutados,
    });
    if (r3.chamadasDoRenderer === 0 || contadoR3.chamadas() === 0) {
      falhou(
        "R3",
        "o renderer NAO foi chamado com a chave mutada — a chave acertou pelo motivo " +
          "errado (C12) e a retomada serviria cache velho com entrada mudada",
      );
    } else {
      ok("R3: chave mutada => MISS => re-render (cache velho nunca serve com entrada mudada)");
    }
    const divergentesR3 = divergencias(arquivosPlanosDe(r1), arquivosPlanosDe(r3));
    if (divergentesR3.length > 0) {
      falhou("R3-bytes", `artefatos divergiram com o snapshot mutado: ${divergentesR3.join(" | ")}`);
    } else {
      ok("R3: artefatos identicos (o snapshot mutado nao pinta)");
    }

    // ── S0: sondas ∅-crit de presenca (remover/corromper por artefato) ─
    process.stdout.write("=== S0: ∅-crit de presenca (remover/corromper cada artefato) ===\n");
    for (const esperado of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
      for (const arquivo of esperado.arquivos) {
        const caminho = join(SAIDA, arquivo);
        await rm(caminho, { force: true });
        const problemas = await conferirPresenca(r1.relatorioFinal, SAIDA);
        if (!problemas.some((p) => p.includes(esperado.nome) && p.includes("AUSENTE"))) {
          falhou(
            "S0",
            `remover "${arquivo}" de "${esperado.nome}" NAO ficou VERMELHO por ausencia. ` +
              `Problemas: ${problemas.join(" | ") || "(nenhum)"}`,
          );
        }
        await writeFile(caminho, Buffer.from("corrompido", "utf-8"));
        const problemas2 = await conferirPresenca(r1.relatorioFinal, SAIDA);
        if (!problemas2.some((p) => p.includes(esperado.nome) && p.includes("corrompido"))) {
          falhou(
            "S0",
            `corromper "${arquivo}" de "${esperado.nome}" NAO ficou VERMELHO. ` +
              `Problemas: ${problemas2.join(" | ") || "(nenhum)"}`,
          );
        }
        // restaura o artefato de verdade (os bytes da R1)
        const original = r1.artefatos.get(esperado.nome)?.find((a) => a.nome === arquivo);
        if (original === undefined) {
          falhou("S0", `o artefato "${arquivo}" nao existe no resultado da R1`);
        } else {
          await escreverAtomico(caminho, original.bytes);
        }
      }
      ok(`S0: "${esperado.nome}" ausente/corrompido ficou VERMELHO nomeando o artefato`);
    }

    // ── S1: AB-745 — o hash NOVO da emenda no relatorio ───────────────
    process.stdout.write("=== S1: AB-745 — relatorio cita o hash NOVO da emenda ===\n");
    const emendasDoMix = new Map(r1.mix.emendas.map((e) => [e.cena, { emendaHash: e.emendaHash, fonteHash: e.fonteHash }]));
    const problemasS1 = conferirEmendaNova(
      JSON.parse(await readFile(join(SAIDA, "relatorio-procedencia.json"), "utf-8")),
      r1.planoDeAudio,
      emendasDoMix,
    );
    if (problemasS1.length > 0) {
      falhou("S1", problemasS1.join(" | "));
    } else {
      ok(
        "S1: para cada cena, o relatorio cita a emenda pelo hash NOVO " +
          "(igual ao PlanoDeAudio; derivacao declarada para o audio-fonte)",
      );
    }

    // O falso-verde de AB-745: um relatorio gerado com o hash da FONTE
    // no lugar da emenda TEM de ser detectado.
    const store = new StoreReal({ root: join(RAIZ, ".cache", "pipeline", "store") });
    const resolvidoComFonte = {
      ...r1.resolvido,
      nos_locucao: Object.fromEntries(r1.mix.emendas.map((e) => [e.cena, e.fonteHash])),
    };
    const relatorioComFonte = await gerarRelatorio(resolvidoComFonte, {
      raizCassetes: "fixtures/cassetes",
      store: adaptarStore(store),
      relogio: () => new Date("1970-01-01T00:00:00.000Z"),
    });
    const problemasFalsoVerde = conferirEmendaNova(
      relatorioComFonte as unknown as { diretos: readonly { hash: string; derivadoDe: { hash: string } | null }[] },
      r1.planoDeAudio,
      emendasDoMix,
    );
    if (problemasFalsoVerde.length === 0) {
      falhou("S1-falso-verde", "o relatorio com o hash da FONTE no lugar da emenda NAO foi detectado");
    } else {
      ok("S1: relatorio com o hash da fonte no lugar da emenda fica VERMELHO (AB-745)");
    }

    // Cadencia CORTANTE (gap 0.05): a emenda difere da fonte DE VERDADE
    // e o hash NOVO e distinto do antigo no relatorio.
    const rEstresse = await produzir({
      fixture: "canonico",
      estrito: true,
      cacheDir: join(temporario, "cache-estresse"),
      saida: saidaDaSonda,
      fila: criarFilaDeEncode(),
      gapAlvoS: 0.05,
    });
    const emendasEstresse = new Map(rEstresse.mix.emendas.map((e) => [e.cena, { emendaHash: e.emendaHash, fonteHash: e.fonteHash }]));
    const problemasEstresse = conferirEmendaNova(
      JSON.parse(await readFile(join(saidaDaSonda, "relatorio-procedencia.json"), "utf-8")),
      rEstresse.planoDeAudio,
      emendasEstresse,
    );
    let emendaNovaDeVerdade = true;
    for (const e of rEstresse.mix.emendas) {
      if (e.emendaHash === e.fonteHash) {
        emendaNovaDeVerdade = false;
        break;
      }
    }
    if (problemasEstresse.length > 0) {
      falhou("S1-estresse", problemasEstresse.join(" | "));
    } else if (!emendaNovaDeVerdade) {
      falhou("S1-estresse", "com a cadencia cortante as emendas NAO ganharam hash novo (C3)");
    } else {
      ok("S1: cadencia cortante — emendas com hash NOVO citadas no relatorio (AB-745)");
    }

    // ── S2: determinismo do perfil do estrito (2x encodes) ────────────
    process.stdout.write("=== S2: determinismo do perfil (2x encodes = bytes + framemd5 identicos) ===\n");
    const catalogo = await listarPerfis();
    const perfil = catalogo.find((p) => p.perfil.deterministico === true && p.perfil.motor === "libx264");
    if (perfil === undefined) {
      falhou("S2", "nenhum perfil libx264 deterministico no catalogo");
    } else {
      // Trecho de 30 frames do MESMO master (a cadeia inteira de flags —
      // a declaracao do perfil e testada ao vivo, ADR-0036 decisao 3).
      const clip = join(temporario, "clip.mov");
      await executorPadrao("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error",
        "-i", join(SAIDA, "master.mov"),
        "-frames:v", "30",
        "-c:v", "qtrle", "-pix_fmt", "argb",
        clip,
      ]);
      const det1 = join(temporario, "det1.mp4");
      const det2 = join(temporario, "det2.mp4");
      const filaDet = criarFilaDeEncode();
      await executarEncode({ perfil: perfil.perfil, entrada: clip, saida: det1, fila: filaDet });
      await executarEncode({ perfil: perfil.perfil, entrada: clip, saida: det2, fila: filaDet });
      const b1 = await readFile(det1);
      const b2 = await readFile(det2);
      const v1 = await verificarSaida(det1, {
        codec: codecNameDePerfil(perfil.perfil.codec),
        largura: 1920,
        altura: 1080,
      });
      const v2 = await verificarSaida(det2, {
        codec: codecNameDePerfil(perfil.perfil.codec),
        largura: 1920,
        altura: 1080,
      });
      if (!b1.equals(b2)) {
        falhou(
          "S2",
          `2x encodes do trecho produziram bytes diferentes (${sha256Hex(b1).slice(0, 12)} vs ${sha256Hex(b2).slice(0, 12)})`,
        );
      } else if (v1.info.framemd5 !== v2.info.framemd5) {
        falhou("S2", "2x encodes produziram framemd5 diferentes");
      } else {
        ok(
          `S2: 2x encodes = ${String(b1.length)}B identicos + framemd5 identico ` +
            `(${String(v1.info.framemd5.length)} chars de checksum)`,
        );
      }
    }

    // ── S3: escopo 16:9 (nenhum artefato 9:16 no estrito) ─────────────
    process.stdout.write("=== S3: escopo 16:9 do estrito ===\n");
    const variante = JSON.parse(await readFile(join(SAIDA, "variante-16x9.json"), "utf-8"));
    if (variante.width / variante.height !== 16 / 9) {
      falhou("S3", `a variante do estrito NAO e 16:9 (${variante.width}x${variante.height})`);
    } else {
      ok(`S3: variante unica 16:9 (${variante.width}x${variante.height})`);
    }
    if (ARTEFATOS_ESPERADOS_DO_ESTRITO.some((a) => a.nome.includes("9x16") || a.nome.includes("9-16"))) {
      falhou("S3", "a lista fechada contem artefato 9:16 — o estrito nao o entrega (AB-720..722)");
    } else {
      ok("S3: nenhum artefato 9:16 na lista fechada do estrito");
    }

    // ── S4: o MixDocument declara o pin (mix-documento.json) ──────────
    process.stdout.write("=== S4: pin declarado no MixDocument.ferramentas ===\n");
    const mixDoc = JSON.parse(await readFile(join(SAIDA, "mix-documento.json"), "utf-8"));
    if (!/^6\.1\.1/.test(mixDoc.ferramentas?.ffmpeg ?? "")) {
      falhou("S4", `MixDocument.ferramentas.ffmpeg = ${String(mixDoc.ferramentas?.ffmpeg)} fora do pin`);
    } else {
      ok(`S4: MixDocument.ferramentas.ffmpeg = ${mixDoc.ferramentas.ffmpeg} (pin)`);
    }

    process.stdout.write("");
    if (falhas.length > 0) {
      process.stdout.write(`=== e2e: VERMELHO (${String(falhas.length)} falha(s)) ===\n`);
      return 1;
    }
    process.stdout.write("=== e2e: VERDE — o pipeline de ponta a ponta esta sustentado ===\n");
    return 0;
  } finally {
    await rm(temporario, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((erro) => {
  process.stderr.write(String((erro as Error).stack ?? erro) + "\n");
  process.exit(2);
});
