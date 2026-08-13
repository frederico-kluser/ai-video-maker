#!/usr/bin/env npx tsx
/**
 * tests/entrega/pos/gate.ts
 *
 * O GATE DO POS — card F5-03 (W8, caminho critico). ADR-0040 +
 * contrato-w8 §2. Rodado por `just pos`.
 *
 * Mora em tests/ (nao em tools/) porque o mapa da onda da a este card
 * apenas `src/entrega/pos/**` e `tests/**` (a mesma convencao da
 * mix.ferramenta.ts, F3-05). Nao e um teste (`gate.ts` nao casa o glob
 * do vitest); e executado por `npx tsx`.
 *
 * O fluxo, com a fixture canonica REAL (cassetes commitados + ffmpeg
 * pinado 6.1.1):
 *
 *   1. pin — ffmpeg corrente tem de ser 6.1.1 (ADR-0040, decisao 4); o
 *      documento registra ffmpeg + node e a conferencia falha na
 *      divergencia (contrato-w8 §2);
 *   2. master — o mix da fixture canonica (F3-05, consumo): o MESMO
 *      master que o gate do mix produz;
 *   3. producao — mede o master, aplica o ganho da estrategia UMA vez,
 *      codifica em AAC (perfil do pos, deterministico: true, com a fila
 *      INJETADA do card — criada por criarFilaDeEncode do F5-02, nunca
 *      a compartilhada: a dona dela e a F5-07, AB-705), gera o sidecar
 *      do MESMO documento golden (∅-crit (a)) e escreve o PosDocument.1;
 *   4. conferencia — o oraculo re-mede o master e o ENTREGAVEL
 *      CODIFICADO decodificado de volta (∅-crit (c)): alvo ±0,3 LU
 *      (∅-crit original), teto -1.0 dBTP, normalizacao UMA vez
 *      (adversarial 1), overshoot dentro da margem, sidecar e queimada
 *      coerentes (∅-crits (a) e (b));
 *   5. determinismo — o perfil de audio DECLARA deterministico: true e
 *      o gate TESTA ao vivo: 2x encodes = bytes identicos;
 *   6. sondas ∅-crit — cada uma TEM de ficar VERMELHA com a mensagem
 *      assertada (nunca so o exit code);
 *   7. so depois do gate verde, os entregaveis saem em output/
 *      (entregavel.m4a, entregavel.srt, pos-documento.json).
 *
 * O veredito e deterministico em MEDIDA (loudness), nunca em bytes do
 * entregavel: o encoder muda entre versoes e bytes nao sao oraculo
 * (AB-396/397, ADR-0035 — ADR-0040 decisao 2).
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Manifesto } from "../../../src/contratos/manifesto.js";
import { lerTimingCanonico } from "../../../src/sincronia/timing/validar.js";
import {
  calcularEnvelopeDucking,
  posicoesDaTimeline,
} from "../../../src/sincronia/ducking/calcular.js";
import { cortarSilencio } from "../../../src/sincronia/ritmo/cortar.js";
import { lerWavPcm, paraCanais, escreverWavPcm } from "../../../src/audio/mix/pcm.js";
import { sha256Bytes } from "../../../src/audio/mix/formato.js";
import { mixar } from "../../../src/audio/mix/mixar.js";
import type { EntradasDoMix } from "../../../src/audio/mix/mixar.js";
import { calcularDuracao } from "../../../src/composicao/tempo.js";
import { listarPerfis, criarFilaDeEncode } from "../../../src/render/encode/index.js";
import {
  alvoDoPos,
  conferirPos,
  produzirPos,
  versaoDoFfmpeg,
  PIN_FFMPEG,
} from "../../../src/entrega/pos/index.js";
import { serializarPosDocumento } from "../../../src/entrega/pos/formato.js";
import { computarGanho, aplicarGanhoNoMaster } from "../../../src/entrega/pos/normalizar.js";
import { montarComandoAudio, PERFIL_AUDIO_POS } from "../../../src/entrega/pos/perfil-audio.js";
import type { JanelaVisualDaCena } from "../../../src/entrega/pos/sidecar.js";

// ─── Caminhos ─────────────────────────────────────────────────────────────────

const TIMING_CANONICO = "fixtures/canonico/timing-canono.json";
const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const CASSETES_LOCUCAO = "fixtures/cassetes/locucao";
const CASSETES_MUSICA = "fixtures/cassetes/musica";
const LEGENDAS_GOLDEN = "fixtures/canonico/legendas-canono.json";
const RAIZ_TRABALHO = ".cache/pos";
const RAIZ_STORE = ".cache/store-pos";
const RAIZ_SAIDA = "output";

/** Executa um comando e devolve stdout/stderr; erro aborta o gate. */
function rodar(comando: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 600_000 }, (erro, stdout, stderr) => {
      if (erro) {
        reject(new Error(`${comando} ${args.join(" ")}\n${String(erro)}${stderr}`));
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

// ─── Fixture canonica (o mesmo assembler do gate do mix, F3-05) ───────────────

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

/** O hash da trilha: trilha_sonora do resultado do cassete de musica. */
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
    throw new Error(`trilha_sonora do cassete de musica ambiguo (${[...hashes].join(", ")})`);
  }
  return [...hashes][0]!;
}

/** O decoder do gate: ffmpeg pinado -> WAV f32 estereo 48 kHz. */
async function criarDecoder() {
  const cache = new Map<string, ReturnType<typeof lerWavPcm>>();
  return async (bytes: Buffer) => {
    const chave = sha256Bytes(bytes);
    const pronto = cache.get(chave);
    if (pronto !== undefined) return pronto;
    const entrada = join(RAIZ_TRABALHO, `in-${chave.slice(0, 16)}`);
    const saida = join(RAIZ_TRABALHO, `out-${chave.slice(0, 16)}.wav`);
    await writeFile(entrada, bytes);
    await rodar("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", entrada,
      "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
      "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", "-f", "wav",
      saida,
    ]);
    const pcm = lerWavPcm(await readFile(saida));
    cache.set(chave, pcm);
    return pcm;
  };
}

/** Monta as entradas do mix com a fixture canonica REAL. */
async function montarEntradas(): Promise<EntradasDoMix> {
  const timing = lerTimingCanonico(await readFile(TIMING_CANONICO, "utf-8"));
  const manifesto = JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
  const posicoes = posicoesDaTimeline(manifesto);
  const envelope = calcularEnvelopeDucking({ timing, posicoes });
  const cadencia = cortarSilencio(timing);
  const corpos = await indexarCorpos([CASSETES_LOCUCAO, CASSETES_MUSICA]);
  const musicaHash = await hashDaTrilha();
  const decodificar = await criarDecoder();
  return {
    timing,
    manifesto,
    envelope,
    cadencia,
    musicaHash,
    carregarBytes: async (hash) => corpos.get(hash) ?? null,
    decodificarPcm: async (bytes) => paraCanais(await decodificar(bytes), 2),
    opcoes: {
      rate: 48000,
      canais: 2,
      ffmpeg: await versaoDoFfmpeg(),
      node: process.version,
    },
  };
}

/** As janelas visuais das cenas (F1-01) — a base da queimada (∅-crit (b)). */
function janelasVisuais(manifesto: Manifesto): readonly JanelaVisualDaCena[] {
  return calcularDuracao(manifesto).timeline.map((t) => ({
    cenaId: t.cenaId,
    inicio_s: t.frameInicial / manifesto.fps,
    fim_s: t.frameFinal / manifesto.fps,
  }));
}

// ─── O main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await mkdir(RAIZ_TRABALHO, { recursive: true });
  const ffmpegVersao = await versaoDoFfmpeg();
  console.log(`=== pos: gate do pos-processamento (F5-03, W8) ===`);
  console.log(`ffmpeg: ${ffmpegVersao}  node: ${process.version}`);

  // 1. PIN — o instrumento do ADR-0040 e o ffmpeg 6.1.1; divergencia
  //    derruba o gate antes de medir qualquer coisa.
  if (!/^6\.1\.1/.test(ffmpegVersao)) {
    throw new Error(
      `FALHOU: ffmpeg corrente ${ffmpegVersao} diverge do pin ${PIN_FFMPEG} ` +
        "(ADR-0040, decisao 4) — o determinismo entre versoes de ferramenta " +
        "e declarado por pin, nunca assumido",
    );
  }

  // 2. Master da fixture canonica (F3-05, consumo).
  console.log("=== master: mix da fixture canonica (F3-05) ===");
  const entradas = await montarEntradas();
  const mix = await mixar(entradas);
  const masterBytes = mix.bytes;
  console.log(
    `master: ${(masterBytes.length / 1024 / 1024).toFixed(1)} MiB, ` +
      `${mix.documento.duracao_s.toFixed(3)}s, ferramentas ` +
      `${mix.documento.ferramentas.ffmpeg} / ${mix.documento.ferramentas.node}`,
  );

  // 3. Producao: normalizacao UMA vez + encode AAC + sidecar + documento,
  //    com a FILA INJETADA do card (instancia propria — AB-705).
  console.log("=== producao: normalizar + codificar + sidecar ===");
  const contextoLegendas = {
    manifesto: entradas.manifesto,
    timing: entradas.timing,
  };
  const documentoLegendasBytes = await readFile(LEGENDAS_GOLDEN);
  const filaDoCard = criarFilaDeEncode(); // INJETADA — nunca a compartilhada (F5-07, W9)
  const resultado = await produzirPos({
    masterBytes,
    documentoLegendasBytes,
    contextoLegendas,
    dirTrabalho: RAIZ_TRABALHO,
    ffmpeg: ffmpegVersao,
    fila: filaDoCard,
  });
  console.log(
    `ganho aplicado: ${resultado.ganho.ganhoAplicadoDb.toFixed(2)} dB ` +
      `(master ${resultado.masterMedicao.integradoLufs.toFixed(1)} LUFS -> ` +
      `entregavel ${resultado.documento.medicoes.integradoLufs.toFixed(2)} LUFS)`,
  );

  // 4. Conferencia — o oraculo (problemas vazio = VERDE).
  console.log("=== conferencia: o oraculo (∅-crits original, (a), (b), (c)) ===");
  const conferencia = await conferirPos({
    dirTrabalho: RAIZ_TRABALHO,
    masterBytes,
    documentoLegendasBytes,
    contextoLegendas,
    janelasVisuais: janelasVisuais(entradas.manifesto),
    entregavel: resultado.entregavel,
    sidecar: resultado.sidecar,
    documento: resultado.documento,
    ffmpegAtual: ffmpegVersao,
    nodeAtual: process.version,
  });
  if (conferencia.problemas.length > 0) {
    throw new Error(
      "FALHOU: a conferencia do pos acusou:\n  - " +
        conferencia.problemas.join("\n  - "),
    );
  }
  console.log("conferencia: VERDE");

  // Tripwire visivel do ADR-0040 decisao 3: o overshoot real de codec.
  const m = conferencia.medicoes;
  console.log("");
  console.log("--- tripwire do ADR-0040 (medicoes reconferidas) ---");
  console.log(`master:        ${m.masterLufs.toFixed(2)} LUFS / ${m.masterTruePeakDbtp.toFixed(2)} dBTP`);
  console.log(`entregavel:    ${m.entregavelLufs.toFixed(2)} LUFS / ${m.entregavelTruePeakDbtp.toFixed(2)} dBTP`);
  console.log(
    `overshoot AAC: ${m.overshootDb.toFixed(2)} dB (margem declarada ` +
      `${alvoDoPos().margemOvershootDb.toFixed(1)} dB — acima dela a margem ` +
      "e revisada por ADR, nunca ajustada em silencio)",
  );
  console.log(
    `clamp por teto: ${m.clampadoPorTeto ? "SIM — entregavel abaixo do alvo" : "nao — entregavel no alvo"}`,
  );

  // 5. Determinismo do perfil de audio TESTADO ao vivo (declarado:
  //    deterministico: true — a disciplina do gate do F5-02).
  console.log("=== determinismo do perfil de audio (2x encodes = bytes identicos) ===");
  const normalizado = aplicarGanhoNoMaster(masterBytes, m.ganhoAplicadoDb).wav;
  const normalizadoPath = join(RAIZ_TRABALHO, "normalizado-determinismo.wav");
  await writeFile(normalizadoPath, normalizado);
  const hash1 = await encodarUmaVez(normalizadoPath, "det1.m4a");
  const hash2 = await encodarUmaVez(normalizadoPath, "det2.m4a");
  if (hash1 !== hash2) {
    throw new Error(
      `FALHOU: o perfil ${PERFIL_AUDIO_POS.nome} declara deterministico: true, ` +
        `mas 2x encodes do MESMO master produziram bytes diferentes ` +
        `(${hash1.slice(0, 12)}… vs ${hash2.slice(0, 12)}…) — a declaracao ` +
        "esta mentindo (contrato-w7 §6)",
    );
  }
  console.log(`determinismo: VERDE (sha256 ${hash1.slice(0, 16)}…)`);

  // 6. O catalogo do F5-02: so perfis deterministico: true participam da
  //    comparacao do pos (contrato-w8 §2). Assercao de PRESENCA — nunca
  //    lista fechada (a pergunta obrigatoria da W8, §7).
  console.log("=== catalogo do F5-02 (listarPerfis) ===");
  const catalogo = await listarPerfis();
  const deterministicos = catalogo.filter((d) => d.perfil.deterministico === true);
  if (deterministicos.length === 0) {
    throw new Error(
      "FALHOU: nenhum perfil deterministico: true no catalogo do F5-02 — " +
        "so perfis deterministicos participam da comparacao do pos (contrato-w8 §2)",
    );
  }
  console.log(
    `catalogo: ${catalogo.map((d) => `${d.perfil.nome}(${d.perfil.deterministico ? "det" : "ndet"})`).join(", ")}`,
  );

  // 7. Sondas ∅-crit — cada uma TEM de ficar VERMELHA com a mensagem.
  console.log("");
  console.log("=== sondas ∅-crit (cada uma TEM de ficar VERMELHA) ===");
  const alvo = alvoDoPos();
  const sondas: Sonda[] = [
    {
      nome: "S1 entregavel fora do alvo de LUFS (∅-crit original)",
      trechoEsperado: /fora do alvo de LUFS/,
      rodar: async () => {
        // Master REAL com fala inaudivel e pico quente (impulsos a
        // -1,5 dBTP sobre piso de -30 dBFS): mede ~-38,5 LUFS / -1,5 dBTP.
        // A estrategia clampa o ganho no teto pre-encode (-0,5 dB) e o
        // entregavel fica em ~-39 LUFS — fora da tolerancia do alvo: a
        // entrega TEM de falhar (∅-crit original: bloqueia).
        const rate = 48000;
        const amostras = new Float32Array(rate * 24 * 2);
        const piso = Math.pow(10, -30 / 20);
        const pico = Math.pow(10, -1.5 / 20);
        for (let i = 0; i < amostras.length; i++) amostras[i] = piso;
        for (let s = 1; s < 24; s++) {
          amostras[s * rate * 2] = pico;
          amostras[s * rate * 2 + 1] = pico;
        }
        const quente = escreverWavPcm({ rate, canais: 2, amostras }, 32);
        try {
          await produzirPos({
            masterBytes: quente,
            documentoLegendasBytes,
            contextoLegendas,
            dirTrabalho: RAIZ_TRABALHO,
            ffmpeg: ffmpegVersao,
            fila: filaDoCard,
          });
          return ["sonda nao bloqueou a entrega fora do alvo"];
        } catch (e) {
          return [String((e as Error).message)];
        }
      },
    },
    {
      nome: "S2 sidecar divergindo do golden (∅-crit (a))",
      trechoEsperado: /G7: .*NAO e o que deriva|G7: .*nao deriva|G7: sidecar/,
      rodar: async () => {
        const mutado = resultado.sidecar.replace(
          "00:00:19,798",
          "00:00:20,000",
        );
        const c = await conferirPos({
          dirTrabalho: RAIZ_TRABALHO,
          masterBytes,
          documentoLegendasBytes,
          contextoLegendas,
          janelasVisuais: janelasVisuais(entradas.manifesto),
          entregavel: resultado.entregavel,
          sidecar: mutado,
          documento: resultado.documento,
          ffmpegAtual: ffmpegVersao,
          nodeAtual: process.version,
        });
        return c.problemas;
      },
    },
    {
      nome: "S3 queimada x sidecar: inicio_s divergindo onde a queimada existe (∅-crit (b))",
      trechoEsperado: /G8: .*c-004|G8: .*sem cue/,
      rodar: async () => {
        const mutado = resultado.sidecar.replace(
          "00:00:14,233 --> 00:00:19,798",
          "00:00:15,233 --> 00:00:19,798",
        );
        const c = await conferirPos({
          dirTrabalho: RAIZ_TRABALHO,
          masterBytes,
          documentoLegendasBytes,
          contextoLegendas,
          janelasVisuais: janelasVisuais(entradas.manifesto),
          entregavel: resultado.entregavel,
          sidecar: mutado,
          documento: resultado.documento,
          ffmpegAtual: ffmpegVersao,
          nodeAtual: process.version,
        });
        return c.problemas;
      },
    },
    {
      nome: "S4 true peak acima do teto no CODIFICADO (∅-crit (c))",
      trechoEsperado: /G4: true peak/,
      rodar: async () => {
        // Entregavel com o pico pre-encode em ~-0,5 dBTP (sem margem):
        // o decodificado estoura o teto -1.0 dBTP (+ tolerancia 0,3 LU).
        const semMargem = aplicarGanhoNoMaster(masterBytes, 11.2).wav;
        const caminho = join(RAIZ_TRABALHO, "s4-sem-margem.wav");
        await writeFile(caminho, semMargem);
        const argvS4 = montarComandoAudio(PERFIL_AUDIO_POS, caminho, join(RAIZ_TRABALHO, "s4.m4a"));
        await rodar(argvS4[0]!, argvS4.slice(1));
        const c = await conferirPos({
          dirTrabalho: RAIZ_TRABALHO,
          masterBytes,
          documentoLegendasBytes,
          contextoLegendas,
          janelasVisuais: janelasVisuais(entradas.manifesto),
          entregavel: await readFile(join(RAIZ_TRABALHO, "s4.m4a")),
          sidecar: resultado.sidecar,
          documento: resultado.documento,
          ffmpegAtual: ffmpegVersao,
          nodeAtual: process.version,
        });
        return c.problemas;
      },
    },
    {
      nome: "S5 pin divergindo (contrato-w8 §2: ffmpeg 6.1.1 + node)",
      trechoEsperado: /G2: .*diverge do pin|G2: ffmpeg corrente/,
      rodar: async () => {
        const c = await conferirPos({
          dirTrabalho: RAIZ_TRABALHO,
          masterBytes,
          documentoLegendasBytes,
          contextoLegendas,
          janelasVisuais: janelasVisuais(entradas.manifesto),
          entregavel: resultado.entregavel,
          sidecar: resultado.sidecar,
          documento: resultado.documento,
          ffmpegAtual: "7.0.0",
          nodeAtual: process.version,
        });
        return c.problemas;
      },
    },
    {
      nome: "S6 perfil deterministico: false na comparacao do pos (contrato-w8 §2)",
      trechoEsperado: /deterministico: false/,
      rodar: async () => {
        const nvenc = { ...PERFIL_AUDIO_POS, deterministico: false, nome: "nvda-fake" };
        try {
          montarComandoAudio(nvenc, "in.wav", "out.m4a");
          return ["o perfil deterministico: false NAO foi recusado"];
        } catch (e) {
          return [String((e as Error).message)];
        }
      },
    },
    {
      nome: "S7 normalizacao aplicada DUAS vezes (adversarial 1)",
      trechoEsperado: /G3: entregavel medido|G5: .*mais de uma vez/,
      rodar: async () => {
        const g = computarGanho(alvo, m.masterLufs, m.masterTruePeakDbtp);
        const umaVez = aplicarGanhoNoMaster(masterBytes, g.ganhoAplicadoDb).wav;
        const duasVezes = aplicarGanhoNoMaster(umaVez, g.ganhoAplicadoDb).wav;
        const caminho = join(RAIZ_TRABALHO, "s7-duplo.wav");
        await writeFile(caminho, duasVezes);
        const argvS7 = montarComandoAudio(PERFIL_AUDIO_POS, caminho, join(RAIZ_TRABALHO, "s7.m4a"));
        await rodar(argvS7[0]!, argvS7.slice(1));
        const c = await conferirPos({
          dirTrabalho: RAIZ_TRABALHO,
          masterBytes,
          documentoLegendasBytes,
          contextoLegendas,
          janelasVisuais: janelasVisuais(entradas.manifesto),
          entregavel: await readFile(join(RAIZ_TRABALHO, "s7.m4a")),
          sidecar: resultado.sidecar,
          documento: resultado.documento,
          ffmpegAtual: ffmpegVersao,
          nodeAtual: process.version,
        });
        return c.problemas;
      },
    },
    {
      nome: "S8 sidecar com TEXTO divergindo do golden (∅-crit (a))",
      trechoEsperado: /G7:.*|parse|SRT/,
      rodar: async () => {
        const c = await conferirPos({
          dirTrabalho: RAIZ_TRABALHO,
          masterBytes,
          documentoLegendasBytes,
          contextoLegendas,
          janelasVisuais: janelasVisuais(entradas.manifesto),
          entregavel: resultado.entregavel,
          sidecar: "1\n00:00:14,233 --> 00:00:19,798\nok\n\n2\n00:00:19,888 --> 00:00:22,738\ntem características de renderização\ndistintas.\n\n3\n00:00:18,233 --> 00:00:23,588\nConcluindo, o manifesto é a peça central\ndo pipeline. Obrigado por assistir.\n",
          documento: resultado.documento,
          ffmpegAtual: ffmpegVersao,
          nodeAtual: process.version,
        });
        return c.problemas;
      },
    },
  ];

  for (const sonda of sondas) {
    const problemas = await sonda.rodar();
    const achou = problemas.some((p) => sonda.trechoEsperado.test(p));
    if (!achou) {
      throw new Error(
        `FALHOU (sonda ${sonda.nome}): o gate NAO acusou o esperado ` +
          `${sonda.trechoEsperado}. Problemas recebidos:\n  - ${problemas.join("\n  - ") || "(nenhum — sonda nao ficou vermelha)"}`,
      );
    }
    console.log(`sonda ${sonda.nome}: VERMELHO confirmado`);
  }

  // 8. Os entregaveis so saem DEPOIS do gate verde (convencao da W7).
  await mkdir(RAIZ_SAIDA, { recursive: true });
  await writeFile(join(RAIZ_SAIDA, "entregavel.m4a"), resultado.entregavel);
  await writeFile(join(RAIZ_SAIDA, "entregavel.srt"), resultado.sidecar);
  await writeFile(join(RAIZ_SAIDA, "pos-documento.json"), serializarPosDocumento(resultado.documento));
  console.log(`entregaveis: output/entregavel.m4a, output/entregavel.srt, output/pos-documento.json`);
  console.log("pos: VERDE");
}

/** Sonda: veredito esperado VERMELHO com o trecho assertado. */
interface Sonda {
  nome: string;
  trechoEsperado: RegExp;
  rodar: () => Promise<readonly string[]>;
}

/** Encode do normalizado para o teste de determinismo; devolve o sha256. */
async function encodarUmaVez(entrada: string, nomeSaida: string): Promise<string> {
  const saida = join(RAIZ_TRABALHO, nomeSaida);
  const argv = montarComandoAudio(PERFIL_AUDIO_POS, entrada, saida);
  await rodar(argv[0]!, argv.slice(1));
  const bytes = await readFile(saida);
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(bytes).digest("hex");
}

main().catch((erro) => {
  console.error(String((erro as Error).stack ?? erro));
  process.exit(1);
});
