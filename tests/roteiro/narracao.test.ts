/**
 * tests/roteiro/narracao.test.ts
 *
 * FQ-N1..FQ-N4 + determinismo do modulo de NARRACAO GRAVADA (D4 do
 * TASK_PLAN): receberGravacao(bytes) -> wav 48 kHz estereo no store por
 * SHA-256, com procedencia e dedupe por conteudo (S-8).
 *
 * A fixture gravacao.webm (sha256 6c597bee…/8909B) e a do contrato
 * (Onda 2, criada com ffmpeg deterministico) — este teste a PINCA
 * (fechava o debito registrado no handoff da Onda 2: "fixture de midia
 * nao pinçada por teste — o hash envelhece em silencio").
 *
 * Dois tipos de executor:
 *   - MOCK (executor injetado): prova a FORMA do comando (ordem dos
 *     flags de bitexact, -ar/-ac, pcm_s16le) e o pass-through sem
 *     re-encode — zero subprocesso;
 *   - ffmpeg REAL 6.1.1 da maquina via execFile: subprocesso, fora do
 *     escopo do guarda de rede do vitest (tests/setup/rede-bloqueada.ts
 *     bloqueia fetch/socket/http/dns, nao child_process) — a mesma
 *     convencao de tests/render/encode/reais.test.ts.
 *
 * Sondas negativas (anti-C2) por grupo: cada grupo tem UM teste que TEM
 * de falhar com erro NOMEADO — nunca silencio, nunca verde por acidente.
 */

import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../../src/store/store.js";
import {
  ErroAudioInvalido,
  ErroConversaoAudio,
  ErroGravacaoVazia,
  eWavNoFormatoCanonico,
  executorPadrao,
  hashDeAudio,
  lerCabecalhoWav,
  medirDuracao,
  receberGravacao,
  conferirPinDoFfmpeg,
  PIN_FFMPEG_NARRACAO,
} from "../../src/roteiro/narracao/narracao.js";
import { procedenciaDaGravacao } from "../../src/roteiro/narracao/procedencia.js";
import type { OpcoesDeGravacao } from "../../src/roteiro/narracao/narracao.js";
import { FORMATO_AUDIO_GRAVADO } from "../../src/roteiro/contrato/contrato.js";

// ─── Constantes da fixture ─────────────────────────────────────────────────────

const CAMINHO_GRAVACAO = new URL("./fixtures/gravacao.webm", import.meta.url)
  .pathname;

/** O hash da fixture do contrato — pinado: mudou o byte, este teste grita. */
const SHA256_GRAVACAO_WEBM =
  "6c597bee314bc448b20e8f9ed76dfe63c589390bd03862216b68c42027ff7e83";

/** Relogio fixo dos testes — acquiredAt deterministico (FQ-N3). */
const RELOGIO_FIXO = () => new Date("2026-08-14T12:00:00.000Z");

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Store em diretorio temporario (limpo ao fim do teste). */
async function novoStore(): Promise<{ store: Store; limpar: () => Promise<void> }> {
  const raiz = await mkdtemp(join(tmpdir(), "narracao-store-"));
  const store = new Store({ root: raiz });
  return {
    store,
    limpar: () => rm(raiz, { recursive: true, force: true }),
  };
}

function opcoes(store: Store, extra: Partial<OpcoesDeGravacao> = {}): OpcoesDeGravacao {
  return { store, relogio: RELOGIO_FIXO, ...extra };
}

/**
 * Monta um wav PCM s16 na maozinha (cabecalho RIFF + dados zerados) —
 * puro, sem ffmpeg: os testes de pass-through e de duracao nao podem
 * depender de subprocesso. Espelha escreverWavPcm de src/audio/mix/pcm.ts.
 */
function wavS16(rate: number, canais: number, duracaoS: number): Buffer {
  const bytesPorAmostra = 2;
  const tamanhoDados = Math.round(rate * canais * duracaoS) * bytesPorAmostra;
  const cabecalho = Buffer.alloc(44);
  cabecalho.write("RIFF", 0, "ascii");
  cabecalho.writeUInt32LE(36 + tamanhoDados, 4);
  cabecalho.write("WAVE", 8, "ascii");
  cabecalho.write("fmt ", 12, "ascii");
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20); // 1 = PCM s16
  cabecalho.writeUInt16LE(canais, 22);
  cabecalho.writeUInt32LE(rate, 24);
  cabecalho.writeUInt32LE(rate * canais * bytesPorAmostra, 28);
  cabecalho.writeUInt16LE(canais * bytesPorAmostra, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write("data", 36, "ascii");
  cabecalho.writeUInt32LE(tamanhoDados, 40);
  return Buffer.concat([cabecalho, Buffer.alloc(tamanhoDados)]);
}

/** Roda um comando real (ffprobe) e devolve stdout. */
function rodar(comando: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 60_000 }, (erro, stdout) => {
      if (erro) {
        reject(erro);
        return;
      }
      resolve(String(stdout));
    });
  });
}

// ─── FQ-N1: dedupe por conteudo ────────────────────────────────────────────────

describe("FQ-N1 — mesmo conteudo 2x = mesmo hash e UMA entrada no store (S-8)", () => {
  it("wav canonico enviado 2x: mesmo hash, uma entrada, sem re-encode", async () => {
    const { store, limpar } = await novoStore();
    try {
      const wav = wavS16(FORMATO_AUDIO_GRAVADO.sample_rate, FORMATO_AUDIO_GRAVADO.canais, 1.5);
      // Executor que SEMPRE falha: se for chamado, nao houve pass-through
      // e este teste tem de ficar vermelho (sonda do re-encode).
      const executorQueFalha: OpcoesDeGravacao["executor"] = async () => {
        throw new Error("o executor foi chamado para um wav ja canonico");
      };
      const primeira = await receberGravacao(
        wav,
        { tipo: "audio/wav", nome_original: "voz.wav" },
        opcoes(store, { executor: executorQueFalha }),
      );
      const segunda = await receberGravacao(wav, {}, opcoes(store, { executor: executorQueFalha }));

      expect(segunda.hash_audio).toBe(primeira.hash_audio);
      expect(segunda.wavBytes.equals(primeira.wavBytes)).toBe(true);
      expect(primeira.wavBytes.equals(wav)).toBe(true); // pass-through byte a byte

      const entradas = await store.list();
      expect(entradas).toHaveLength(1);
      expect(entradas[0]).toBe(primeira.hash_audio);
      expect(await store.verify(primeira.hash_audio)).toBe(true);
    } finally {
      await limpar();
    }
  });

  it("a MESMA gravacao webm enviada 2x: mesmo hash, uma entrada (conversao deterministica + put idempotente)", async () => {
    const { store, limpar } = await novoStore();
    try {
      const webm = await readFile(CAMINHO_GRAVACAO);
      // Relogios DIFERENTES nas duas chamadas: o put idempotente nao
      // sobrescreve a procedencia da PRIMEIRA escrita (append-only S-8).
      const primeira = await receberGravacao(webm, { tipo: "audio/webm" }, opcoes(store));
      const segunda = await receberGravacao(
        webm,
        { tipo: "audio/webm" },
        opcoes(store, { relogio: () => new Date("2027-01-01T00:00:00.000Z") }),
      );

      expect(segunda.hash_audio).toBe(primeira.hash_audio);
      expect(await store.list()).toHaveLength(1);
      expect(await store.verify(primeira.hash_audio)).toBe(true);
      const proc = await store.getProcedencia(primeira.hash_audio);
      expect(proc?.acquiredAt).toBe("2026-08-14T12:00:00.000Z");
    } finally {
      await limpar();
    }
  });

  // Sonda negativa do grupo (anti-C2): conteudo diferente TEM de mudar
  // o hash e criar entrada nova — dedupe nao pode virar "sempre o mesmo".
  it("SONDA: conteudo diferente -> hash diferente e entrada nova (nunca colisao)", async () => {
    const { store, limpar } = await novoStore();
    try {
      const a = await receberGravacao(wavS16(48000, 2, 1.0), {}, opcoes(store));
      const b = await receberGravacao(wavS16(48000, 2, 1.25), {}, opcoes(store));
      expect(b.hash_audio).not.toBe(a.hash_audio);
      expect(await store.list()).toHaveLength(2);
    } finally {
      await limpar();
    }
  });
});

// ─── FQ-N2: webm -> wav 48 kHz estereo ─────────────────────────────────────────

describe("FQ-N2 — webm->wav 48 kHz estereo conferido pela leitura do cabecalho (ffmpeg real 6.1.1)", () => {
  it("a fixture gravacao.webm (pinada em 6c597bee…) vira wav 48 kHz / 2 canais", async () => {
    const { store, limpar } = await novoStore();
    try {
      const webm = await readFile(CAMINHO_GRAVACAO);
      // O pin da fixture: byte mudou, o teste grita (debito da Onda 2).
      expect(hashDeAudio(webm)).toBe(SHA256_GRAVACAO_WEBM);
      expect(webm.length).toBe(8909);

      const resultado = await receberGravacao(
        webm,
        { tipo: "audio/webm", nome_original: "voz.webm" },
        opcoes(store),
      );

      const cab = lerCabecalhoWav(resultado.wavBytes);
      expect(cab.sample_rate).toBe(FORMATO_AUDIO_GRAVADO.sample_rate); // 48000
      expect(cab.canais).toBe(FORMATO_AUDIO_GRAVADO.canais); // 2
      expect(cab.tamanho_dados).toBeGreaterThan(0);
      expect(resultado.duracaoSegundos).toBeCloseTo(cab.duracao_segundos, 9);
      expect(resultado.duracaoSegundos).toBeGreaterThan(0.1); // a fixture tem voz
      // hash_audio e do wav FINAL (contrato-roteiro §7) — os bytes do store.
      expect(resultado.hash_audio).toBe(hashDeAudio(resultado.wavBytes));

      // Segundo oraculo, independente (C4): o ffprobe da maquina le o
      // mesmo arquivo — se o parse proprio e o ffprobe discordarem, a
      // leitura de cabecalho esta errada.
      const dir = await mkdtemp(join(tmpdir(), "narracao-ffprobe-"));
      try {
        const caminho = join(dir, "voz.wav");
        await writeFile(caminho, resultado.wavBytes);
        const probe = await rodar("ffprobe", [
          "-v", "error",
          "-select_streams", "a:0",
          "-show_entries", "stream=sample_rate,channels,duration",
          "-of", "csv=p=0",
          caminho,
        ]);
        const campos = probe.trim().split(",");
        expect(campos).toHaveLength(3); // parse nao-vazio (falsifiable-gates)
        expect(Number(campos[0])).toBe(FORMATO_AUDIO_GRAVADO.sample_rate);
        expect(Number(campos[1])).toBe(FORMATO_AUDIO_GRAVADO.canais);
        expect(Number(campos[2])).toBeCloseTo(resultado.duracaoSegundos, 1);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } finally {
      await limpar();
    }
  });

  it("wav 48 kHz estereo ja pronto passa SEM re-encode (executor nunca e chamado)", async () => {
    const { store, limpar } = await novoStore();
    try {
      const wav = wavS16(48000, 2, 2.0);
      let chamadas = 0;
      const executor: OpcoesDeGravacao["executor"] = async () => {
        chamadas++;
        throw new Error("nao devia converter wav canonico");
      };
      const resultado = await receberGravacao(wav, { tipo: "audio/wav" }, opcoes(store, { executor }));
      expect(chamadas).toBe(0);
      expect(resultado.wavBytes.equals(wav)).toBe(true);
      expect(resultado.duracaoSegundos).toBeCloseTo(2.0, 9);
    } finally {
      await limpar();
    }
  });

  it("wav FORA do formato canonico (44.1 kHz mono) e convertido para 48 kHz estereo", async () => {
    const { store, limpar } = await novoStore();
    try {
      const wav44k = wavS16(44100, 1, 1.0);
      const resultado = await receberGravacao(wav44k, { tipo: "audio/wav" }, opcoes(store));
      const cab = lerCabecalhoWav(resultado.wavBytes);
      expect(cab.sample_rate).toBe(48000);
      expect(cab.canais).toBe(2);
      expect(resultado.duracaoSegundos).toBeCloseTo(1.0, 1);
      expect(resultado.wavBytes.equals(wav44k)).toBe(false); // foi re-encodado
    } finally {
      await limpar();
    }
  });

  // Sonda negativa do grupo (anti-C2): bytes que nao sao audio TEM de
  // falhar com erro NOMEADO e com o stderr REAL do ffmpeg preservado — o
  // requisito do contrato e "CONVERSAO_AUDIO com stderr preservado". Se o
  // executor descartar o stderr no caminho de erro, esta sonda fica
  // VERMELHA (nunca decoracao).
  it("SONDA: entrada que nao e audio -> ErroConversaoAudio nomeado, com stderr do ffmpeg preservado", async () => {
    const { store, limpar } = await novoStore();
    try {
      const lixo = Buffer.from("isto nao e audio nenhum... ".repeat(100));
      const erro = await receberGravacao(lixo, { tipo: "audio/webm" }, opcoes(store)).catch(
        (e: unknown) => e,
      );
      expect(erro).toBeInstanceOf(ErroConversaoAudio);
      expect((erro as ErroConversaoAudio).code).toBe("CONVERSAO_AUDIO");
      // O stderr do ffmpeg REAL (loglevel error, medido em 6.1.1 pinado)
      // fala do input invalido — se o executor o descartou, e undefined.
      const stderr = (erro as ErroConversaoAudio).stderr;
      expect(stderr).toBeDefined();
      expect(String(stderr)).toMatch(/Invalid data found when processing input/);
      // O detalhe do erro carrega o trecho do stderr (o servidor o loga).
      expect(String(erro)).toContain("stderr do ffmpeg");
      // Nada entra no store — falha nao deixa rastro parcial (S-8).
      expect(await store.list()).toHaveLength(0);
    } finally {
      await limpar();
    }
  });

  // Sonda C1: exit 0 do executor NAO prova bytes — um executor que
  // "converteu" sem escrever o arquivo de saida TEM de ser erro nomeado.
  it("SONDA: executor que sucede sem escrever a saida -> ErroConversaoAudio (C1)", async () => {
    const { store, limpar } = await novoStore();
    try {
      const webm = await readFile(CAMINHO_GRAVACAO);
      const executor: OpcoesDeGravacao["executor"] = async () => ({
        stdout: "",
        stderr: "",
      });
      const promessa = receberGravacao(webm, {}, opcoes(store, { executor }));
      await expect(promessa).rejects.toBeInstanceOf(ErroConversaoAudio);
      await expect(promessa).rejects.toMatchObject({ code: "CONVERSAO_AUDIO" });
      expect(await store.list()).toHaveLength(0);
    } finally {
      await limpar();
    }
  });

  // Sonda: executor que falha com Error SIMPLES (sem stderr — um mock
  // do servidor, Onda 5) continua virando ErroConversaoAudio nomeado.
  it("SONDA: executor que lanca Error simples -> ErroConversaoAudio nomeado", async () => {
    const { store, limpar } = await novoStore();
    try {
      const webm = await readFile(CAMINHO_GRAVACAO);
      const executor: OpcoesDeGravacao["executor"] = async () => {
        throw new Error("boom do executor injetado");
      };
      const promessa = receberGravacao(webm, {}, opcoes(store, { executor }));
      await expect(promessa).rejects.toBeInstanceOf(ErroConversaoAudio);
      await expect(promessa).rejects.toMatchObject({ code: "CONVERSAO_AUDIO" });
    } finally {
      await limpar();
    }
  });
});

// ─── FQ-N3: procedencia registrada ─────────────────────────────────────────────

describe("FQ-N3 — procedencia do audio do usuario registrada (licenca pessoal, origem declarada)", () => {
  it("o store guarda procedencia com licenca, origem declarada e metadados da gravacao", async () => {
    const { store, limpar } = await novoStore();
    try {
      const webm = await readFile(CAMINHO_GRAVACAO);
      const resultado = await receberGravacao(
        webm,
        { tipo: "audio/webm", nome_original: "minha-voz.webm" },
        opcoes(store),
      );

      // Denominador (falsifiable-gates): a procedencia TEM de existir.
      const proc = await store.getProcedencia(resultado.hash_audio);
      expect(proc).not.toBeNull();

      expect(proc!.license).toBe("CC0-1.0"); // convencao do pipeline (produzir.ts)
      expect(proc!.attributionRequired).toBe(false);
      expect(proc!.source).toBe("local");
      expect(proc!.notes).toContain("origem: local-usuario"); // origem declarada
      expect(proc!.notes).toContain("minha-voz.webm"); // nome original auditavel
      expect(proc!.acquiredAt).toBe("2026-08-14T12:00:00.000Z"); // relogio injetado
      expect(proc!.durationSeconds).toBe(resultado.duracaoSegundos);
      expect(proc!.mimeType).toBe("audio/wav");
      expect(proc!.byteSize).toBe(resultado.wavBytes.length);
      expect(proc!.toolVersion).toMatch(/^narracao-\d+\.\d+\.\d+$/);
    } finally {
      await limpar();
    }
  });

  it("procedenciaDaGravacao monta os campos obrigatorios do contrato (isValidProcedencia)", async () => {
    const proc = procedenciaDaGravacao({
      duracaoSegundos: 1.25,
      byteSize: 48000,
      relogio: RELOGIO_FIXO,
      toolVersion: "narracao-1.0.0",
    });
    // Validacao do proprio contrato do store — a procedencia que a
    // auditoria (F5-06) le precisa passar nela.
    const { isValidProcedencia } = await import("../../src/store/procedencia.js");
    expect(isValidProcedencia(proc)).toBe(true);
    expect(proc.license.length).toBeGreaterThan(0);
    expect(proc.source).toBe("local");
    expect(proc.notes).toContain("local-usuario");
    // Sonda do grupo: origem declarada NAO pode sumir em silencio.
    expect(proc.notes).toContain("ADR-0003");
  });
});

// ─── FQ-N4: sem audio nao quebra ───────────────────────────────────────────────

describe("FQ-N4 — caminho sem audio: erro nomeado no modulo (o caminho 'nenhuma' e do contrato)", () => {
  it("entrada vazia -> ErroGravacaoVazia nomeado, store intocado", async () => {
    const { store, limpar } = await novoStore();
    try {
      const promessa = receberGravacao(Buffer.alloc(0), {}, opcoes(store));
      await expect(promessa).rejects.toBeInstanceOf(ErroGravacaoVazia);
      await expect(promessa).rejects.toMatchObject({ code: "GRAVACAO_VAZIA" });
      expect(await store.list()).toHaveLength(0);
    } finally {
      await limpar();
    }
  });

  it("wav de duracao zero (sem dados de audio) -> ErroGravacaoVazia", async () => {
    const { store, limpar } = await novoStore();
    try {
      // Cabecalho 48k estereo valido, chunk data vazio: o navegador
      // "gravou" nada. Nunca pode virar um asset de duracao zero no store.
      const wavVazio = wavS16(48000, 2, 0);
      const promessa = receberGravacao(wavVazio, { tipo: "audio/wav" }, opcoes(store));
      await expect(promessa).rejects.toBeInstanceOf(ErroGravacaoVazia);
      expect(await store.list()).toHaveLength(0);
    } finally {
      await limpar();
    }
  });

  // Nota (anti-C2): o caminho do CONTRATO para "nenhuma" (fala vazia ->
  // narracao vazia, regra narracao-fala-vazia) e coberto por
  // tests/roteiro/contrato.test.ts; aqui o equivalente do modulo e a
  // guarda de entrada vazia acima.
});

// ─── Determinismo da conversao (bitexact) ─────────────────────────────────────

describe("determinismo — mesma entrada, mesmos bytes de saida (bitexact)", () => {
  it("o MESMO webm convertido 2x em diretorios temporarios diferentes produz bytes IDENTICOS", async () => {
    const { store: storeA, limpar: limparA } = await novoStore();
    const { store: storeB, limpar: limparB } = await novoStore();
    try {
      const webm = await readFile(CAMINHO_GRAVACAO);
      const a = await receberGravacao(webm, {}, opcoes(storeA));
      const b = await receberGravacao(webm, {}, opcoes(storeB));
      expect(b.wavBytes.equals(a.wavBytes)).toBe(true);
      expect(hashDeAudio(b.wavBytes)).toBe(hashDeAudio(a.wavBytes));
      expect(b.hash_audio).toBe(a.hash_audio);
    } finally {
      await limparA();
      await limparB();
    }
  });

  it("o comando do ffmpeg tem os flags de bitexact DEPOIS do -i e os parametros do formato congelado", async () => {
    const { store, limpar } = await novoStore();
    try {
      const webm = await readFile(CAMINHO_GRAVACAO);
      let argsCapturados: string[] | null = null;
      const executor: OpcoesDeGravacao["executor"] = async (comando, args) => {
        expect(comando).toBe("ffmpeg");
        argsCapturados = args;
        // O executor fake "converte": grava um wav canonico no caminho de
        // saida (o ultimo argumento) — o modulo le o arquivo de volta.
        await writeFile(args.at(-1)!, wavS16(48000, 2, 0.5));
        return { stdout: "", stderr: "" };
      };
      await receberGravacao(webm, {}, opcoes(store, { executor }));

      expect(argsCapturados).not.toBeNull(); // sonda: o executor rodou
      const args = argsCapturados!;
      const iDaEntrada = args.indexOf("-i");
      expect(iDaEntrada).toBeGreaterThanOrEqual(0);

      // A ORDEM e o contrato (ffmpeg-media-ops NV-5): antes do -i os
      // flags configuram o DEMUXER e a tag de versao vaza para o arquivo
      // (o hash do wav mudaria entre versoes de ffmpeg). Se alguem mover
      // os flags para o inicio, este teste fica VERMELHO.
      const indiceDoFflags = args.indexOf("-fflags");
      const indiceDoFlags = args.indexOf("-flags");
      expect(indiceDoFflags).toBeGreaterThan(iDaEntrada);
      expect(indiceDoFlags).toBeGreaterThan(iDaEntrada);
      expect(args.indexOf("+bitexact")).toBeGreaterThan(iDaEntrada);
      expect(args.indexOf("-map_metadata")).toBeGreaterThan(iDaEntrada);
      expect(args.indexOf("-1")).toBeGreaterThan(iDaEntrada);

      // O formato congelado do contrato, nunca redigitado (Regra 2).
      expect(args).toContain("-ar");
      expect(args[args.indexOf("-ar") + 1]).toBe(String(FORMATO_AUDIO_GRAVADO.sample_rate));
      expect(args).toContain("-ac");
      expect(args[args.indexOf("-ac") + 1]).toBe(String(FORMATO_AUDIO_GRAVADO.canais));
      expect(args).toContain("pcm_s16le");
      expect(args).toContain("-f");
      expect(args[args.indexOf("-f") + 1]).toBe("wav");
    } finally {
      await limpar();
    }
  });

  it("conferirPinDoFfmpeg aceita 6.1.1 e rejeita versao divergente (pin)", async () => {
    const { store, limpar } = await novoStore();
    try {
      const ok = await conferirPinDoFfmpeg(async () => ({
        stdout: "ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023 the FFmpeg developers",
        stderr: "",
      }));
      expect(ok.startsWith(PIN_FFMPEG_NARRACAO)).toBe(true);

      const divergente = conferirPinDoFfmpeg(async () => ({
        stdout: "ffmpeg version 7.0.0 Copyright (c) 2000-2024 the FFmpeg developers",
        stderr: "",
      }));
      await expect(divergente).rejects.toBeInstanceOf(ErroConversaoAudio);
      await expect(divergente).rejects.toMatchObject({ code: "CONVERSAO_AUDIO" });
    } finally {
      await limpar();
    }
  });

  // Sonda do grupo (anti-C2): o pin REAL da maquina — se o ambiente
  // divergir do pin, o determinismo declarado morre e isto fica vermelho.
  it("SONDA: o ffmpeg real da maquina obedece o pin 6.1.1", async () => {
    const versao = await conferirPinDoFfmpeg(executorPadrao);
    expect(versao.startsWith(PIN_FFMPEG_NARRACAO)).toBe(true);
  });
});

// ─── Funcoes puras: cabecalho, duracao, hash ───────────────────────────────────

describe("lerCabecalhoWav / medirDuracao / hashDeAudio — funcoes puras", () => {
  it("medirDuracao le a duracao do cabecalho (aritmetica exata, sem decodificar)", () => {
    const wav = wavS16(48000, 2, 2.0);
    expect(medirDuracao(wav)).toBeCloseTo(2.0, 9);
    expect(medirDuracao(wavS16(44100, 1, 1.5))).toBeCloseTo(1.5, 9);
    const cab = lerCabecalhoWav(wav);
    expect(cab.sample_rate).toBe(48000);
    expect(cab.canais).toBe(2);
    expect(cab.bits_por_amostra).toBe(16);
    expect(cab.formato_audio).toBe(1);
  });

  it("eWavNoFormatoCanonico separa canonico de nao-canonico e de lixo", () => {
    expect(eWavNoFormatoCanonico(wavS16(48000, 2, 1.0))).toBe(true);
    expect(eWavNoFormatoCanonico(wavS16(44100, 2, 1.0))).toBe(false); // taxa errada
    expect(eWavNoFormatoCanonico(wavS16(48000, 1, 1.0))).toBe(false); // mono
    expect(eWavNoFormatoCanonico(Buffer.from("lixo"))).toBe(false);
  });

  // Sonda do grupo: bytes malformados TEM de falhar fechado, nunca dar
  // duracao inventada (fail-closed — falsifiable-gates).
  it("SONDA: bytes que nao sao wav -> ErroAudioInvalido nomeado", () => {
    expect(() => medirDuracao(Buffer.alloc(10))).toThrow(ErroAudioInvalido);
    expect(() => medirDuracao(Buffer.from("RIFF????WAVE...."))).toThrow(ErroAudioInvalido);
    expect(() => lerCabecalhoWav(Buffer.alloc(44))).toThrow(ErroAudioInvalido);
    try {
      medirDuracao(Buffer.alloc(10));
      throw new Error("medirDuracao nao lancou — sonda morta");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroAudioInvalido);
      expect((erro as ErroAudioInvalido).code).toBe("AUDIO_INVALIDO");
    }
  });

  it("hashDeAudio e o MESMO sha256 do store (o hash do put)", () => {
    const wav = wavS16(48000, 2, 1.0);
    expect(hashDeAudio(wav)).toBe(Store.hashBuffer(wav));
    // Vetor conhecido do sha256 (sonda: a implementacao nao e um chute).
    expect(hashDeAudio(Buffer.alloc(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
