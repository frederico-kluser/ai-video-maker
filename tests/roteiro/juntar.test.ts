/**
 * tests/roteiro/juntar.test.ts — FQ-J1..FQ-J5 + gates 409 + SRT + CLI (D11).
 *
 * Cada grupo fecha com uma sonda negativa (anti-C2): o teste tem de
 * ficar VERMELHO se a capacidade que ele asserta sumir — nunca verde
 * por filtro vazio ou por "o comando rodou".
 *
 * Previews de teste: gerados aqui com ffmpeg no formato EXATO do
 * FORMATO_VIDEO (1920x1080 30fps h264 yuv420p + aac 48k, 1s, bitexact) —
 * o concat exige params identicos por construcao; fixtures pequenos de
 * outra resolucao nao serviriam (o teste de formatos divergentes gera o
 * proprio preview fora do formato, de proposito).
 *
 * Tons: cada preview tem um seno de frequencia propria (440/660/880 Hz)
 * — o FQ-J2 distingue a ORDEM dos audios por janela de tempo com
 * bandpass + volumedetect (o volume por trecho nao distinguiria tons).
 *
 * ffmpeg roda em subprocesso (permitido); a guarda de rede do setup
 * bloqueia fetch em processo, nao child-process.
 */

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { medirLoudness } from "../../src/entrega/pos/medir.js";
import { alvoDoPos } from "../../src/entrega/pos/index.js";
import { parseSrt } from "../../src/entrega/pos/sidecar.js";
import { executorPadrao } from "../../src/pipeline/produzir.js";
import {
  conferirEntrega,
  gerarSrtFinal,
  juntar,
  TOLERANCIA_DURACAO_JUNTAR_SEGUNDOS,
  verificarJuntavel,
} from "../../src/roteiro/juntar/juntar.js";
import {
  ErroJuntarAnexoInvalido,
  ErroJuntarFalaSemNarracao,
  ErroJuntarFormatosDivergentes,
  ErroJuntarPreviewAusente,
  ErroJuntarRoteiroInvalido,
} from "../../src/roteiro/juntar/juntar.js";
import type { OpcoesDeJuntar } from "../../src/roteiro/juntar/juntar.js";
import type { Pedaco, Roteiro } from "../../src/roteiro/contrato/contrato.js";

const RAIZ = join(__dirname, "..", "..");
const CAMINHO_CLI = join(RAIZ, "src", "roteiro", "juntar", "cli.ts");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");

// ─── Fixtures de midia (geradas uma vez, formato exato) ───────────────────────

const DIR = mkdtempSync(join(tmpdir(), "juntar-test-"));
const PREVIEW_440 = join(DIR, "preview-440.mp4");
const PREVIEW_660 = join(DIR, "preview-660.mp4");
const PREVIEW_880 = join(DIR, "preview-880.mp4");
const PREVIEW_PEQUENO = join(DIR, "preview-320x240.mp4");
const PREVIEW_PRETO = join(DIR, "preview-preto.mp4");
const PREVIEW_MONO = join(DIR, "preview-mono.mp4");
const MUSICA = join(DIR, "musica.wav");

/** Gera um preview 1s no formato exato do FORMATO_VIDEO com um tom. */
function gerarPreview(caminho: string, frequencia: number, extra: string[] = []): void {
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=d=1:s=1920x1080:r=30",
    "-f", "lavfi", "-i", `sine=frequency=${String(frequencia)}:sample_rate=48000:duration=1,volume=0.3`,
    ...extra,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    "-t", "1",
    caminho,
  ]);
}

beforeAll(() => {
  gerarPreview(PREVIEW_440, 440);
  gerarPreview(PREVIEW_660, 660);
  gerarPreview(PREVIEW_880, 880);
  // Fora do formato, de proposito: o teste de divergencia precisa de um
  // preview que o gate de formatos tenha de recusar (nunca concat cego).
  gerarPreview(PREVIEW_PEQUENO, 440, ["-s", "320x240"]);
  // Preto chapado: passa em toda a camada estrutural — o oraculo de
  // conteudo (C1) e quem reprova.
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=black:d=1:s=1920x1080:r=30",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=1,volume=0.3",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "2",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    "-t", "1",
    PREVIEW_PRETO,
  ]);
  // MONO (1 canal) — codec/sample rate identicos ao FORMATO_VIDEO: o
  // gate de ffprobe por preview passaria; a CONSISTENCIA entre previews
  // e quem recusa o mix mono+stereo (revisao adversarial FQ-J8: o
  // concat de mono+stereo sai exit 0 com perda de canal em silencio).
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=d=1:s=1920x1080:r=30",
    "-f", "lavfi", "-i", "sine=frequency=550:sample_rate=48000:duration=1,volume=0.3",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-ac", "1",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    "-t", "1",
    PREVIEW_MONO,
  ]);
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000:duration=2",
    "-c:a", "pcm_f32le",
    MUSICA,
  ]);
}, 300_000);

// ─── Roteiros de teste ────────────────────────────────────────────────────────

interface EspecificacaoDePedaco {
  readonly id: string;
  readonly fala?: string;
  readonly origem?: "tts" | "gravacao" | "nenhuma";
  readonly duracao?: number;
  readonly tipo_visual?: "texto" | "gif" | "video";
  readonly anexo_hash?: string;
}

/** Monta um Pedaco valido contra o contrato (narracao consistente). */
function pedacoDeTeste(espec: EspecificacaoDePedaco): Pedaco {
  const fala = espec.fala ?? `Fala do ${espec.id}`;
  const origem = espec.origem ?? "tts";
  const narracao: Pedaco["narracao"] =
    origem === "nenhuma"
      ? { texto: "", origem: "nenhuma", status: "vazio" }
      : {
          texto: fala,
          origem,
          status: "gerado",
          ...(origem === "gravacao" ? { hash_audio: espec.anexo_hash ?? "a".repeat(64) } : {}),
        };
  return {
    id: espec.id,
    indice: Number(espec.id.slice(2)),
    titulo: `Titulo ${espec.id}`,
    fala,
    duracao_segundos: espec.duracao ?? 1.0,
    tipo_visual: espec.tipo_visual ?? "texto",
    especificacao_visual: "Um texto em destaque",
    detalhes_de_producao: "Como o pedaco sera feito",
    narracao,
    ...(espec.tipo_visual === "gif" || espec.tipo_visual === "video"
      ? { anexo_hash: espec.anexo_hash, anexo_meta: espec.anexo_hash === undefined ? undefined : { tipo: "image/gif", tamanho_bytes: 100, nome_original: "a.gif" } }
      : {}),
  };
}

/** Monta um Roteiro valido (duracao_total = soma, dentro da tolerancia). */
function roteiroDeTeste(especs: readonly EspecificacaoDePedaco[]): Roteiro {
  const pedacos = especs.map(pedacoDeTeste);
  const soma = pedacos.reduce((acc, p) => acc + p.duracao_segundos, 0);
  return {
    schema_version: "Roteiro.1",
    pedacos,
    duracao_total_segundos: Number(soma.toFixed(2)),
  };
}

/** Opcoes de juntar com previews reais e dirs proprios (determinismo nos testes). */
function opcoesDeTeste(
  previews: Readonly<Record<string, string>>,
  extras: Partial<OpcoesDeJuntar> = {},
): OpcoesDeJuntar {
  return {
    previews,
    dirTrabalho: join(DIR, "trabalho"),
    dirEntregas: join(DIR, "entregas"),
    ...extras,
  };
}

// ─── Helpers de medicao (FQ-J2 — ordem dos audios) ────────────────────────────

/**
 * mean_volume (dB) de uma janela de 0.5s passada por um bandpass.
 *
 * Extrai a janela para WAV ANTES do filtro: medido nesta maquina, o
 * seek de saida (`-i arquivo -ss X -t 0.5 -af filtro` numa linha so)
 * devolve janelas corrompidas (volumedetect leu 196608 amostras onde
 * 24000 eram esperadas — o -t nao cortou o audio na combinacao com o
 * filtro); extrair primeiro (`-ss` antes do `-i`, decode pcm) e depois
 * filtrar o WAV e preciso (amostras exatas da janela).
 */
async function volumeNaBanda(
  caminho: string,
  inicioSegundos: number,
  frequencia: number,
): Promise<number> {
  const janela = join(
    DIR,
    `janela-${String(inicioSegundos).replace(".", "-")}-${String(frequencia)}.wav`,
  );
  await executorPadrao("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-ss", String(inicioSegundos),
    "-t", "0.5",
    "-i", caminho,
    "-c:a", "pcm_f32le",
    janela,
  ]);
  const { stderr } = await executorPadrao("ffmpeg", [
    "-hide_banner", "-nostats",
    "-i", janela,
    "-af", `bandpass=f=${String(frequencia)}:width_type=h:w=120,volumedetect`,
    "-f", "null", "-",
  ]);
  const m = /mean_volume: (-?\d+(?:\.\d+)?) dB/.exec(stderr);
  // Parse NAO-vazio antes de comparar (falsifiable-gates): sem leitura,
  // o teste falha, nunca "passa por silencio".
  if (m === null) {
    throw new Error(`volumedetect sem mean_volume na janela ${inicioSegundos}s:\n${stderr}`);
  }
  return Number.parseFloat(m[1]!);
}

/** True quando cada janela de 1s tem como tom dominante o tom esperado. */
async function ordemDosAudiosCorreta(
  caminho: string,
  tonsPorJanela: readonly number[],
): Promise<boolean> {
  const tons = [...new Set(tonsPorJanela)];
  for (let janela = 0; janela < tonsPorJanela.length; janela++) {
    const inicio = janela + 0.25;
    const volumes: Array<[number, number]> = [];
    for (const tom of tons) {
      volumes.push([tom, await volumeNaBanda(caminho, inicio, tom)]);
    }
    const dominante = volumes.reduce(
      (a: [number, number], b: [number, number]) => (a[1] >= b[1] ? a : b),
      volumes[0] ?? [-1, -Infinity],
    );
    if (dominante[0] !== tonsPorJanela[janela] || dominante[1] < -45) {
      return false;
    }
  }
  return true;
}

// ─── FQ-J1: concat de N previews — duracao por stream == soma ─────────────────

describe("FQ-J1 — concat de N previews: duracao por stream == soma", () => {
  it("3 previews de 1s juntados = 3.0s no stream de video (C4)", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" }, { id: "p-001" }, { id: "p-002" },
    ]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_440, "p-001": PREVIEW_660, "p-002": PREVIEW_880 }),
    );
    // Tolerancia APERTADA (0.01s): sem o reparo de timestamps do mux, a
    // duracao le soma - 21 ms (o deslocamento do priming AAC) e este
    // teste fica VERMELHO — a regressao nao e absorvida pela tolerancia.
    expect(Math.abs(resultado.duracaoSegundos - 3.0)).toBeLessThan(
      TOLERANCIA_DURACAO_JUNTAR_SEGUNDOS,
    );
    // A duracao e do STREAM de video, nunca o envelope do container (C4).
    const probe = await executorPadrao("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      resultado.caminho,
    ]);
    const envelope = Number.parseFloat(probe.stdout.trim());
    expect(Math.abs(envelope - 3.0)).toBeGreaterThan(0.005);
    // Sonda de alinhamento A/V: o video entregue comeca em 0 (o mux
    // reverte o deslocamento do concat) — sem o reparo, o video
    // comecaria ~21 ms depois do audio.
    const inicio = await executorPadrao("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=start_time",
      "-of", "csv=p=0",
      resultado.caminho,
    ]);
    expect(Math.abs(Number.parseFloat(inicio.stdout.trim()))).toBeLessThan(0.005);
  }, 180_000);

  it("sonda negativa: 2 previews juntados = 2.0s (um preview sumido e detectavel)", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_440, "p-001": PREVIEW_660 }),
    );
    expect(Math.abs(resultado.duracaoSegundos - 2.0)).toBeLessThan(
      TOLERANCIA_DURACAO_JUNTAR_SEGUNDOS,
    );
    // Se o concat "esquecesse" um preview, a assercao de 3.0s pegaria:
    expect(Math.abs(resultado.duracaoSegundos - 3.0)).toBeGreaterThan(0.5);
  }, 180_000);
});

// ─── FQ-J2: audios na ordem correta no tempo ──────────────────────────────────

describe("FQ-J2 — audios dos pedacos na ordem correta no tempo", () => {
  it("cada janela de 1s tem o tom dominante do pedaco daquela janela", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" }, { id: "p-001" }, { id: "p-002" },
    ]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_440, "p-001": PREVIEW_660, "p-002": PREVIEW_880 }),
    );
    // Ordem correta: janela 0 = 440, janela 1 = 660, janela 2 = 880.
    const correto = await ordemDosAudiosCorreta(resultado.caminho, [440, 660, 880]);
    expect(correto).toBe(true);
  }, 240_000);

  it("sonda negativa: ordem trocada e pega pela janela (o teste nao passa por acaso)", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    // Ordem TROCADA: p-000 recebe o preview de 660 e p-001 o de 440.
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_660, "p-001": PREVIEW_440 }),
    );
    // A checagem correta (440 na janela 0) REPROVA a ordem trocada...
    expect(await ordemDosAudiosCorreta(resultado.caminho, [440, 660])).toBe(false);
    // ...e a expectativa trocada (660 na janela 0) e a que casa: o
    // medidor enxerga o conteudo, nao o rotulo.
    expect(await ordemDosAudiosCorreta(resultado.caminho, [660, 440])).toBe(true);
  }, 240_000);
});

// ─── FQ-J3: juntar 2x = bytes identicos ───────────────────────────────────────

describe("FQ-J3 — juntar 2x = bytes identicos (bitexact)", () => {
  it("mesma entrada, mesma saida byte a byte", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" }, { id: "p-001" }, { id: "p-002" },
    ]);
    const opcoes = opcoesDeTeste(
      { "p-000": PREVIEW_440, "p-001": PREVIEW_660, "p-002": PREVIEW_880 },
      { musica_caminho: MUSICA },
    );
    const primeiro = await juntar(roteiro, opcoes);
    const segundo = await juntar(roteiro, opcoes);
    expect(primeiro.hash).toBe(segundo.hash);
    const bytes1 = readFileSync(primeiro.caminho);
    const bytes2 = readFileSync(segundo.caminho);
    expect(bytes1.equals(bytes2)).toBe(true);

    // Sonda: o metadado do muxer (encoder, creation_time) nao pode
    // existir no arquivo — se alguem tirar os flags bitexact do caminho,
    // a tag aparece e este teste fica vermelho (ffmpeg-media-ops, NV-5).
    const probe = await executorPadrao("ffprobe", [
      "-v", "error",
      "-show_entries", "format_tags=encoder",
      "-of", "csv=p=0",
      primeiro.caminho,
    ]);
    expect(probe.stdout.trim()).toBe("");
  }, 240_000);
});

// ─── FQ-J4: saida tem video+audio e passa no oraculo de conteudo ──────────────

describe("FQ-J4 — video+audio e oraculo de conteudo (C1 + C4)", () => {
  it("a entrega tem video+audio por stream e passa no oraculo", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" }, { id: "p-001" }, { id: "p-002" },
    ]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_440, "p-001": PREVIEW_660, "p-002": PREVIEW_880 }),
    );
    const conferencia = await conferirEntrega(resultado.hash, {
      dirEntregas: join(DIR, "entregas"),
    });
    expect(conferencia.problemas).toEqual([]);
    expect(conferencia.medida.yavgMaximo).toBeGreaterThan(0);
    expect(Number.isFinite(conferencia.medida.desvioMaximo)).toBe(true);
  }, 240_000);

  it("sonda negativa (C1): um video 100% preto e reprovado pelo oraculo", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_PRETO }),
    );
    // O juntar em si produz (o audio normaliza); o ORACULO reprova — se
    // o oraculo deixar de medir conteudo, este teste fica vermelho.
    const conferencia = await conferirEntrega(resultado.hash, {
      dirEntregas: join(DIR, "entregas"),
    });
    expect(conferencia.problemas.some((p) => p.includes("chapado"))).toBe(true);
  }, 240_000);

  it("sonda negativa: hash sem arquivo = problema, nunca silencio", async () => {
    const conferencia = await conferirEntrega("0".repeat(64), {
      dirEntregas: join(DIR, "entregas"),
    });
    expect(conferencia.problemas.some((p) => p.includes("ausente"))).toBe(true);
  }, 60_000);
});

// ─── FQ-J5: loudness medida e registrada (ebur128) ────────────────────────────

describe("FQ-J5 — normalizacao EBU R128 aplicada e registrada", () => {
  it("entrega dentro do alvo ±0.3 LU com a medicao registrada no sidecar", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" }, { id: "p-001" }, { id: "p-002" },
    ]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_440, "p-001": PREVIEW_660, "p-002": PREVIEW_880 }),
    );
    const alvo = alvoDoPos();
    // Registrada no resultado (FQ-J5) e DENTRO do alvo.
    expect(Math.abs(resultado.medicoes.entregavelIntegradoLufs - alvo.targetLufs)).toBeLessThanOrEqual(
      alvo.toleranciaMedicaoLu,
    );
    expect(resultado.medicoes.entregavelTruePeakDbtp).toBeLessThanOrEqual(
      alvo.maxTruePeakDbtp + alvo.toleranciaMedicaoLu,
    );
    // Registrada no sidecar (o artefato <hash>.json)...
    const sidecar = JSON.parse(
      readFileSync(join(DIR, "entregas", `${resultado.hash}.json`), "utf-8"),
    ) as { loudness: { entregavel_integrado_lufs: number } };
    expect(sidecar.loudness.entregavel_integrado_lufs).toBe(resultado.medicoes.entregavelIntegradoLufs);
    // ...e a medicao INDEPENDENTE do entregavel (oraculo duplo: o juntar
    // nao pode ter fabricado o numero) confere o alvo.
    const remedida = await medirLoudness(resultado.caminho);
    expect(Math.abs(remedida.integradoLufs - alvo.targetLufs)).toBeLessThanOrEqual(
      alvo.toleranciaMedicaoLu,
    );
  }, 240_000);

  it("musica de fundo (volume fixo -20 dB) nao tira a entrega do alvo", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste(
        { "p-000": PREVIEW_440, "p-001": PREVIEW_660 },
        { musica_caminho: MUSICA },
      ),
    );
    expect(resultado.medicoes.musicaAplicada).toBe(true);
    const alvo = alvoDoPos();
    expect(Math.abs(resultado.medicoes.entregavelIntegradoLufs - alvo.targetLufs)).toBeLessThanOrEqual(
      alvo.toleranciaMedicaoLu,
    );
    expect(resultado.medicoes.entregavelTruePeakDbtp).toBeLessThanOrEqual(
      alvo.maxTruePeakDbtp + alvo.toleranciaMedicaoLu,
    );
    const sidecar = JSON.parse(
      readFileSync(join(DIR, "entregas", `${resultado.hash}.json`), "utf-8"),
    ) as { musica: { aplicada: boolean; ganho_db: number } };
    expect(sidecar.musica.aplicada).toBe(true);
    expect(sidecar.musica.ganho_db).toBe(-20);
  }, 240_000);
});

// ─── Gates: 409 antes de qualquer trabalho ────────────────────────────────────

describe("Gates — 409 antes de qualquer trabalho (record-first + anexo + preview)", () => {
  it("fala sem narracao -> ErroJuntarFalaSemNarracao com a lista de pedacos", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" },
      { id: "p-001", origem: "nenhuma" },
      { id: "p-002", origem: "nenhuma" },
    ]);
    const opcoes = opcoesDeTeste(
      { "p-000": PREVIEW_440, "p-001": PREVIEW_660, "p-002": PREVIEW_880 },
      { dirEntregas: join(DIR, "entregas-gates") },
    );
    const verificacao = verificarJuntavel(roteiro, opcoes);
    expect(verificacao.ok).toBe(false);
    if (!verificacao.ok) {
      expect(verificacao.problemas[0]?.regra).toBe("juntar-fala-sem-narracao");
      expect(verificacao.problemas[0]?.pedacos.map((p) => p.id).sort()).toEqual(["p-001", "p-002"]);
    }
    await expect(juntar(roteiro, opcoes)).rejects.toBeInstanceOf(ErroJuntarFalaSemNarracao);
    // Sonda negativa por alvo: nenhuma entrega nasce do gate (409 antes
    // de qualquer gravacao — REPLAN P5).
    expect(existsSync(join(DIR, "entregas-gates"))).toBe(false);
  }, 60_000);

  it("sonda: narrar UM pedaco reduz a lista do 409 ao restante", () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" },
      { id: "p-001", origem: "nenhuma" },
      { id: "p-002", origem: "nenhuma" },
    ]);
    const verificacao = verificarJuntavel(roteiro, opcoesDeTeste({}));
    expect(verificacao.ok).toBe(false);
    if (!verificacao.ok) {
      expect(verificacao.problemas[0]?.pedacos.map((p) => p.id).sort()).toEqual(["p-001", "p-002"]);
    }
    const roteiroNarrado = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }, { id: "p-002", origem: "nenhuma" }]);
    const verificacao2 = verificarJuntavel(roteiroNarrado, opcoesDeTeste({}));
    expect(verificacao2.ok).toBe(false);
    if (!verificacao2.ok) {
      expect(verificacao2.problemas[0]?.pedacos.map((p) => p.id)).toEqual(["p-002"]);
    }
  });

  it("anexo invalido -> 409 mesmo com TODOS os previews presentes (revalidacao)", async () => {
    // O estado que o catch-all "preview ausente" nao pega: um pedaco
    // gif/video sem anexo depois do DELETE da rota de anexo (REPLAN P5).
    // Todos os previews existem — se o gate de revalidacao sumir, o
    // juntar passaria e este teste fica vermelho (mutacao anti-C2).
    const roteiro = roteiroDeTeste([
      { id: "p-000" },
      { id: "p-001", tipo_visual: "gif" },
    ]);
    const opcoes = opcoesDeTeste({ "p-000": PREVIEW_440, "p-001": PREVIEW_660 });
    const verificacao = verificarJuntavel(roteiro, opcoes);
    expect(verificacao.ok).toBe(false);
    if (!verificacao.ok) {
      expect(verificacao.problemas[0]?.regra).toBe("juntar-anexo-invalido");
      expect(verificacao.problemas[0]?.detalhes.join(" ")).toContain("anexo-exigido-para-gif-video");
    }
    await expect(juntar(roteiro, opcoes)).rejects.toBeInstanceOf(ErroJuntarAnexoInvalido);
  }, 60_000);

  it("roteiro invalido fora das regras de anexo -> ErroJuntarRoteiroInvalido", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    // duracao_total divergente da soma (regra duracao-total-inconsistente).
    const roteiroInvalido: Roteiro = {
      ...roteiro,
      duracao_total_segundos: roteiro.duracao_total_segundos + 5,
    };
    const verificacao = verificarJuntavel(roteiroInvalido, opcoesDeTeste({ "p-000": PREVIEW_440 }));
    expect(verificacao.ok).toBe(false);
    if (!verificacao.ok) {
      expect(verificacao.problemas[0]?.regra).toBe("juntar-roteiro-invalido");
    }
    await expect(juntar(roteiroInvalido, opcoesDeTeste({ "p-000": PREVIEW_440 }))).rejects.toBeInstanceOf(
      ErroJuntarRoteiroInvalido,
    );
  }, 60_000);

  it("preview ausente -> 409 listando os pedacos (nao declarado E arquivo inexistente)", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }, { id: "p-002" }]);
    // p-001 sem entrada no mapa; p-002 com caminho que nao existe.
    const opcoes = opcoesDeTeste({
      "p-000": PREVIEW_440,
      "p-002": join(DIR, "nao-existe.mp4"),
    });
    const verificacao = verificarJuntavel(roteiro, opcoes);
    expect(verificacao.ok).toBe(false);
    if (!verificacao.ok) {
      expect(verificacao.problemas[0]?.regra).toBe("juntar-preview-ausente");
      expect(verificacao.problemas[0]?.pedacos.map((p) => p.id).sort()).toEqual(["p-001", "p-002"]);
    }
    await expect(juntar(roteiro, opcoes)).rejects.toBeInstanceOf(ErroJuntarPreviewAusente);
  }, 60_000);
});

// ─── SRT: so quando ha timing; gravacao nao deriva ────────────────────────────

describe("SRT final — so quando ha timing de TTS (gravacao nao deriva, D4)", () => {
  it("com timing: cues deslocadas pelo acumulo das duracoes", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste(
        { "p-000": PREVIEW_440, "p-001": PREVIEW_660 },
        {
          timing_pedacos: {
            "p-000": [{ texto: "Cue um", inicio_segundos: 0.1, fim_segundos: 0.6 }],
            "p-001": [
              { texto: "Cue dois", inicio_segundos: 0.2, fim_segundos: 0.5 },
              { texto: "Cue tres", inicio_segundos: 0.7, fim_segundos: 0.9 },
            ],
          },
        },
      ),
    );
    expect(resultado.srtCaminho).toBeDefined();
    const srt = readFileSync(resultado.srtCaminho!, "utf-8");
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(3);
    // Offsets: pedaco 0 a 0.0; pedaco 1 a 1.0 (duracao 1s de cada).
    expect(cues[0]).toMatchObject({ inicio_s: 0.1, fim_s: 0.6, texto: "Cue um" });
    expect(cues[1]).toMatchObject({ inicio_s: 1.2, fim_s: 1.5, texto: "Cue dois" });
    expect(cues[2]).toMatchObject({ inicio_s: 1.7, fim_s: 1.9, texto: "Cue tres" });
  }, 240_000);

  it("sem timing: nenhum SRT nasce (a entrega nao fabrica legendas)", async () => {
    // UM pedaco (conteudo distinto do teste com timing — o hash da
    // entrega e do conteudo, e o <hash>.srt do teste anterior nao pode
    // contaminar esta assercao).
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_880 }),
    );
    expect(resultado.srtCaminho).toBeUndefined();
    expect(existsSync(join(DIR, "entregas", `${resultado.hash}.srt`))).toBe(false);
    // E o sidecar desta entrega registra srt.gerado false.
    const sidecar = JSON.parse(
      readFileSync(join(DIR, "entregas", `${resultado.hash}.json`), "utf-8"),
    ) as { srt: { gerado: boolean } };
    expect(sidecar.srt.gerado).toBe(false);
  }, 240_000);

  it("gravacao (D4): mesmo com narracao gravada, sem timing nao ha SRT", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000", origem: "gravacao" },
      { id: "p-001", origem: "gravacao" },
    ]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_440, "p-001": PREVIEW_660 }),
    );
    expect(resultado.srtCaminho).toBeUndefined();
    expect(gerarSrtFinal(roteiro, {})).toBe("");
  }, 240_000);
});

// ─── Formatos divergentes: nunca concat cego ──────────────────────────────────

describe("Formatos divergentes — o gate de ffprobe, nunca concat cego", () => {
  it("preview fora do FORMATO_VIDEO -> ErroJuntarFormatosDivergentes", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const opcoes = opcoesDeTeste({ "p-000": PREVIEW_PEQUENO });
    // O arquivo EXISTE (o gate de presenca passa) — a divergencia e do
    // conteudo, e o ffprobe quem pega (C4).
    const verificacao = verificarJuntavel(roteiro, opcoes);
    expect(verificacao.ok).toBe(true);
    let erroCapturado: unknown;
    try {
      await juntar(roteiro, opcoes);
    } catch (erro) {
      erroCapturado = erro;
    }
    expect(erroCapturado).toBeInstanceOf(ErroJuntarFormatosDivergentes);
    expect(
      (erroCapturado as ErroJuntarFormatosDivergentes).divergencias.join(" "),
    ).toContain("largura");
  }, 120_000);

  it("canais divergentes entre previews -> erro nomeado (nunca concat cego em silencio)", async () => {
    // FQ-J8 (revisao adversarial): mono + stereo passam no gate por
    // preview (aac 48k os dois) e o demuxer concat NAO falha alto —
    // concatena com exit 0 e o segmento estereo perde um canal. A
    // consistencia entre previews (canais/layout) e o gate que recusa.
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    const opcoes = opcoesDeTeste({ "p-000": PREVIEW_MONO, "p-001": PREVIEW_660 });
    let erroCapturado: unknown;
    try {
      await juntar(roteiro, opcoes);
    } catch (erro) {
      erroCapturado = erro;
    }
    expect(erroCapturado).toBeInstanceOf(ErroJuntarFormatosDivergentes);
    expect(
      (erroCapturado as ErroJuntarFormatosDivergentes).divergencias.join(" "),
    ).toContain("canais");
  }, 120_000);

  it("sonda: preview mono SOZINHO e consistente (a entrega sai estereo pelo decode -ac 2)", async () => {
    // O contrato nao pina canais — a regra e CONSISTENCIA entre
    // previews, nao um pin de 2 canais: um unico preview mono junta e a
    // entrega sai estereo (o decode do juntar remapeia para 2 canais).
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const resultado = await juntar(
      roteiro,
      opcoesDeTeste({ "p-000": PREVIEW_MONO }),
    );
    const conferencia = await conferirEntrega(resultado.hash, {
      dirEntregas: join(DIR, "entregas"),
    });
    expect(conferencia.problemas).toEqual([]);
  }, 180_000);
});

// ─── CLI (D11 — o servidor da Onda 5 chama este executavel) ───────────────────

describe("CLI do juntar (D11)", () => {
  const cwdCli = join(DIR, "cli");
  mkdirSync(cwdCli, { recursive: true });

  function rodarCli(
    entrada: string,
    cwd: string,
  ): Promise<{ codigo: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      // spawn + stdin (execFile nao aceita `input` assincrono): o pedido
      // vai pelo stdin do processo real (tsx) — a mesma disciplina
      // anti-C2 do gerador-cli.test.ts.
      const filho = spawn(BIN_TSX, [CAMINHO_CLI, "--estado", join(cwd, "estado.json")], { cwd });
      let stdout = "";
      let stderr = "";
      filho.stdout.on("data", (d: Buffer) => {
        stdout += String(d);
      });
      filho.stderr.on("data", (d: Buffer) => {
        stderr += String(d);
      });
      filho.on("error", (erro) => {
        resolve({ codigo: 2, stdout, stderr: `falha ao spawnar: ${erro.message}` });
      });
      filho.on("close", (codigo) => {
        resolve({ codigo: codigo ?? 1, stdout, stderr });
      });
      filho.stdin.end(entrada);
    });
  }

  it("sucesso: exit 0, JSON em stdout com hash/caminho/duracao, arquivo no disco", async () => {
    const roteiro = roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_440, "p-001": PREVIEW_660 } },
    });
    const saida = await rodarCli(pedido, cwdCli);
    expect(saida.codigo).toBe(0);
    const resultado = JSON.parse(saida.stdout) as {
      hash: string;
      caminho: string;
      duracao_segundos: number;
      duracao_total_segundos: number;
      loudness: { alvo_lufs: number };
    };
    expect(resultado.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(resultado.caminho).toContain(".cache/roteiro/entregas");
    expect(Math.abs(resultado.duracao_segundos - 2.0)).toBeLessThan(0.05);
    expect(resultado.duracao_total_segundos).toBe(resultado.duracao_segundos);
    expect(existsSync(join(cwdCli, resultado.caminho))).toBe(true);
    // O arquivo de estado termina em "ok" (o poll do servidor le o terminal).
    const estado = JSON.parse(readFileSync(join(cwdCli, "estado.json"), "utf-8")) as { estado: string };
    expect(estado.estado).toBe("ok");
  }, 300_000);

  it("sonda negativa por alvo: 409 de fala sem narracao sai com exit 1 e o codigo no envelope", async () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000" },
      { id: "p-001", origem: "nenhuma" },
    ]);
    const pedido = JSON.stringify({
      roteiro,
      opcoes: { previews: { "p-000": PREVIEW_440, "p-001": PREVIEW_660 } },
    });
    const saida = await rodarCli(pedido, cwdCli);
    expect(saida.codigo).toBe(1);
    const envelope = JSON.parse(saida.stderr) as {
      erro: { codigo: string; mensagem: string; detalhes: string[] };
    };
    expect(envelope.erro.codigo).toBe("juntar-fala-sem-narracao");
    expect(envelope.erro.mensagem).toContain("p-001");
    // O 409 lista os pedacos em detalhes ESTRUTURAIS (o servidor nao
    // parseia mensagem para montar a resposta).
    expect(envelope.erro.detalhes).toEqual(["pedacos[1].id p-001"]);
    expect(saida.stdout).toBe("");
  }, 120_000);

  it("entrada invalida: exit 2 (o CLI distingue uso invalido de falha de operacao)", async () => {
    const saida = await rodarCli("isto-nao-e-json", cwdCli);
    expect(saida.codigo).toBe(2);
    const envelope = JSON.parse(saida.stderr) as { erro: { codigo: string } };
    expect(envelope.erro.codigo).toBe("entrada-invalida");
  }, 120_000);
});

// Os fixtures ficam em /tmp (mkdtemp do sistema); a suite nunca grava
// fora do DIR — as entregas do CLI vao para <cwdCli>/.cache/roteiro/.
