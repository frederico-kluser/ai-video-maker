/**
 * tests/roteiro/juntar-erros.test.ts — cobertura dos CAMINHOS DE ERRO do
 * juntar (gaps de juntar.ts nao exercitados pela suite real).
 *
 * A suite existente (juntar.test.ts) cobre os fluxos reais com ffmpeg de
 * verdade; ESTE arquivo cobre o que ela nao exercita:
 *
 *   - cada etapa de ffmpeg falhando (concat / decode da fala / decode da
 *     musica / encode / mux) — a cadeia de ErroJuntarRender nomeada;
 *   - as conferencias do proprio juntar: versao fora do pin, zero bytes
 *     do mux, streams faltando, entregavel fora do alvo (LUFS e true
 *     peak), duracao do stream ilegivel, start_time ilegivel;
 *   - os branches de parse do ffprobe fake (fps "0/0", sample_rate
 *     numerico vs string, campos ausentes/indefinidos, consistencia de
 *     canais/layout);
 *   - o oraculo conferirEntrega com probes fake (hash errado do nome,
 *     stream faltando, parametros divergentes, chapado reprovado por
 *     conteudo);
 *   - a prioridade anexo > demais no verificarJuntavel e os offsets do
 *     gerarSrtFinal com duracoes variadas e mapa parcial.
 *
 * O executor INJETADO (ExecutorDeComando) faz o papel do ffmpeg/ffprobe:
 * nenhum binario roda aqui — os previews sao placeholders em disco (o
 * gate de presenca e do filesystem; o ffprobe e fake). Tudo que cai na
 * fronteira de determinismo e real (o mix PCM, o ganho, o sidecar).
 */

import { writeFileSync, mkdirSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { escreverWavPcm } from "../../src/audio/mix/pcm.js";
import { parseSrt } from "../../src/entrega/pos/sidecar.js";
import { sha256Hex } from "../../src/pipeline/produzir.js";
import type { ExecutorBruto, ExecutorDeComando } from "../../src/pipeline/produzir.js";
import {
  conferirEntrega,
  ErroJuntarFormatosDivergentes,
  ErroJuntarRender,
  gerarSrtFinal,
  juntar,
  verificarJuntavel,
} from "../../src/roteiro/juntar/juntar.js";
import type { OpcoesDeJuntar } from "../../src/roteiro/juntar/juntar.js";
import type { Pedaco, Roteiro } from "../../src/roteiro/contrato/contrato.js";

const DIR = mkdtempSync(join(tmpdir(), "juntar-erros-"));
const PREVIEW_A = join(DIR, "preview-a.mp4");
const PREVIEW_B = join(DIR, "preview-b.mp4");
const MUSICA = join(DIR, "musica.wav");
const DIR_TRABALHO = join(DIR, "trabalho");
const DIR_ENTREGAS = join(DIR, "entregas");

// Um WAV pcm f32le 48k estereo valido (0.5s, amplitude 0.05) — o que o
// decode fake "produz" para a fala e para a musica; o resto do pipeline
// (lerWavPcm, somar, ganho) e real e roda em cima destes bytes.
const WAV_DE_FALA = escreverWavPcm(
  { rate: 48000, canais: 2, amostras: new Float32Array(48000).fill(0.05) },
  32,
);

beforeAll(() => {
  // Placeholders: o gate de presenca e do filesystem, o ffprobe e fake.
  writeFileSync(PREVIEW_A, "placeholder-a");
  writeFileSync(PREVIEW_B, "placeholder-b");
  writeFileSync(MUSICA, "placeholder-musica");
});

// ─── O executor fake ──────────────────────────────────────────────────────────

interface ChamadaDeExecutor {
  readonly comando: string;
  readonly args: readonly string[];
}

interface FixtureDoExecutor {
  /** Devolve um erro quando o comando deve falhar (null = deixa rodar). */
  falhar?: (comando: string, args: readonly string[]) => Error | null;
  /** stdout do `ffmpeg -version` (default: o pin 6.1.1). */
  versao?: string;
  /** stdout do probe de start_time (default "0.021000" — o priming AAC). */
  startTime?: string;
  /** stdout do probe de duracao (default "2.000000"). */
  duracao?: string;
  /** stderr do ebur128 (default: dentro do alvo). */
  ebur128?: string;
  /** WAV gravado pelos decodes pcm_f32le (default WAV_DE_FALA). */
  wav?: Buffer;
  /** Bytes gravados pelo mux final; undefined = nao grava nada. */
  finalMp4?: Buffer;
  /** csv do probe de codec_type (default "video\naudio"). */
  streamsCsv?: string;
  /** JSON do ffprobe de video do preview (default: conforme). */
  videoJson?: string;
  /** JSON do ffprobe de audio do preview (default: conforme). */
  audioJson?: string;
  /** JSON do ffprobe do oraculo (streams do muxado). */
  oraculoJson?: string;
}

const VIDEO_CONFORME = JSON.stringify({
  streams: [
    { codec_name: "h264", pix_fmt: "yuv420p", width: 1920, height: 1080, avg_frame_rate: "30/1" },
  ],
});
const AUDIO_CONFORME = JSON.stringify({
  streams: [{ codec_name: "aac", sample_rate: "48000", channels: 2, channel_layout: "stereo" }],
});
const ORACULO_CONFORME = JSON.stringify({
  streams: [
    { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1920, height: 1080 },
    { codec_type: "audio", codec_name: "aac", sample_rate: "48000" },
  ],
});

function executorFake(fixture: FixtureDoExecutor = {}): {
  executor: ExecutorDeComando;
  chamadas: ChamadaDeExecutor[];
} {
  const chamadas: ChamadaDeExecutor[] = [];
  const executor: ExecutorDeComando = async (comando, args) => {
    chamadas.push({ comando, args });
    const erro = fixture.falhar?.(comando, args);
    if (erro !== null && erro !== undefined) {
      throw erro;
    }
    const linha = args.join(" ");
    if (comando === "ffmpeg" && args[0] === "-version") {
      return { stdout: fixture.versao ?? "ffmpeg version 6.1.1-3ubuntu5 Copyright", stderr: "" };
    }
    if (comando === "ffprobe" && linha.includes("stream=codec_name,pix_fmt,width,height,avg_frame_rate")) {
      return { stdout: fixture.videoJson ?? VIDEO_CONFORME, stderr: "" };
    }
    if (comando === "ffprobe" && linha.includes("stream=codec_name,sample_rate,channels,channel_layout")) {
      return { stdout: fixture.audioJson ?? AUDIO_CONFORME, stderr: "" };
    }
    if (comando === "ffprobe" && linha.includes("stream=start_time")) {
      return { stdout: `${fixture.startTime ?? "0.021000"}\n`, stderr: "" };
    }
    if (comando === "ffprobe" && linha.includes("stream=duration")) {
      return { stdout: `${fixture.duracao ?? "2.000000"}\n`, stderr: "" };
    }
    if (comando === "ffprobe" && args.includes("stream=codec_type,codec_name,pix_fmt,width,height,sample_rate")) {
      return { stdout: fixture.oraculoJson ?? ORACULO_CONFORME, stderr: "" };
    }
    if (comando === "ffprobe" && args.includes("stream=codec_type")) {
      return { stdout: `${fixture.streamsCsv ?? "video\naudio"}\n`, stderr: "" };
    }
    if (comando === "ffmpeg" && args.includes("ebur128=peak=true:framelog=quiet")) {
      return {
        stdout: "",
        stderr:
          fixture.ebur128 ??
          "  Integrated loudness:\n    I:         -23.0 LUFS\n  True peak:\n    Peak:      -19.3 dBFS\n",
      };
    }
    if (comando === "ffmpeg" && args.includes("pcm_f32le")) {
      // Decode da fala/musica: grava o WAV no ultimo argumento (a saida).
      const saida = args[args.length - 1];
      if (saida !== undefined) {
        await writeFile(saida, fixture.wav ?? WAV_DE_FALA);
      }
      return { stdout: "", stderr: "" };
    }
    if (comando === "ffmpeg" && args.includes("-use_editlist")) {
      // Mux final: grava os bytes (ou nada, quando finalMp4 e undefined).
      const saida = args[args.length - 1];
      if (saida !== undefined && fixture.finalMp4 !== undefined) {
        await writeFile(saida, fixture.finalMp4);
      }
      return { stdout: "", stderr: "" };
    }
    if (comando === "ffmpeg" && args.includes("concat") && args.includes("-safe")) {
      // Demuxer concat: nao grava nada (o mux fake e quem produz o mp4).
      return { stdout: "", stderr: "" };
    }
    return { stdout: "", stderr: "" };
  };
  return { executor, chamadas };
}

// ─── Roteiros de teste ────────────────────────────────────────────────────────

function pedacoDeTeste(espec: { id: string; origem?: "tts" | "gravacao" | "nenhuma"; duracao?: number }): Pedaco {
  const fala = `Fala do ${espec.id}`;
  const origem = espec.origem ?? "tts";
  return {
    id: espec.id,
    indice: Number(espec.id.slice(2)),
    titulo: `Titulo ${espec.id}`,
    fala,
    duracao_segundos: espec.duracao ?? 1.0,
    tipo_visual: "texto",
    especificacao_visual: "Um texto em destaque",
    detalhes_de_producao: "Como o pedaco sera feito",
    narracao:
      origem === "nenhuma"
        ? { texto: "", origem: "nenhuma", status: "vazio" }
        : { texto: fala, origem, status: "gerado" },
  };
}

function roteiroDeTeste(especs: Array<{ id: string; origem?: "tts" | "gravacao" | "nenhuma"; duracao?: number }>): Roteiro {
  const pedacos = especs.map(pedacoDeTeste);
  const soma = pedacos.reduce((acc, p) => acc + p.duracao_segundos, 0);
  return {
    schema_version: "Roteiro.1",
    pedacos,
    duracao_total_segundos: Number(soma.toFixed(2)),
  };
}

function opcoesFake(fixture: FixtureDoExecutor = {}): { opcoes: OpcoesDeJuntar; chamadas: ChamadaDeExecutor[] } {
  const { executor, chamadas } = executorFake(fixture);
  return {
    opcoes: {
      previews: { "p-000": PREVIEW_A, "p-001": PREVIEW_B },
      dirTrabalho: DIR_TRABALHO,
      dirEntregas: DIR_ENTREGAS,
      executor,
    },
    chamadas,
  };
}

/** A chamada do mux final (a que contem -use_editlist). */
function chamadaDoMux(chamadas: readonly ChamadaDeExecutor[]): ChamadaDeExecutor | undefined {
  return chamadas.find((c) => c.args.includes("-use_editlist"));
}

// ─── Pin da ferramenta e falhas de execucao em cada etapa ─────────────────────

describe("juntar — pin da ferramenta e falhas de execucao (executor fake)", () => {
  it("ffmpeg fora do pin 6.1.1 -> ErroJuntarRender antes de qualquer trabalho", async () => {
    const { opcoes } = opcoesFake({ versao: "ffmpeg version 7.0.1-whatever" });
    let erro: unknown;
    try {
      await juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroJuntarRender);
    expect((erro as ErroJuntarRender).codigo).toBe("juntar-render-falhou");
    expect((erro as ErroJuntarRender).message).toContain("pin 6.1.1");
    // 409 antes de qualquer gravacao: nada nasce do pin quebrado.
    expect(existsSync(DIR_ENTREGAS)).toBe(false);
  });

  it("versao do ffmpeg ilegivel -> falha honesta (a mensagem do probe chega ao erro)", async () => {
    const { opcoes } = opcoesFake({ versao: "saida sem a linha de versao" });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      /nao reconheci a versao do ffmpeg/,
    );
  });

  it("concat falha -> ErroJuntarRender com a etapa nomeada", async () => {
    const { opcoes } = opcoesFake({
      falhar: (comando, args) =>
        comando === "ffmpeg" && args.includes("concat") && args.includes("-safe")
          ? new Error("falsa falha no concat")
          : null,
    });
    let erro: unknown;
    try {
      await juntar(roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]), opcoes);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroJuntarRender);
    expect((erro as ErroJuntarRender).codigo).toBe("juntar-render-falhou");
    expect((erro as ErroJuntarRender).message).toContain('etapa "concat demuxer" falhou');
    expect((erro as ErroJuntarRender).message).toContain("falsa falha no concat");
  });

  it("decode da fala falha -> ErroJuntarRender com o caminho", async () => {
    const { opcoes } = opcoesFake({
      falhar: (comando, args) =>
        comando === "ffmpeg" && args.includes("pcm_f32le") && (args[args.length - 1] ?? "").endsWith("fala.wav")
          ? new Error("falsa falha no decode da fala")
          : null,
    });
    // A etapa nomeia a ENTRADA do decode (o concat, nao o wav de saida).
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      /etapa "decode de audio \(.*concatenado\.mp4\)" falhou:\nfalsa falha no decode da fala/,
    );
  });

  it("decode da musica falha -> ErroJuntarRender com o caminho da musica", async () => {
    const { executor, chamadas } = executorFake({
      falhar: (comando, args) =>
        comando === "ffmpeg" && args.includes("pcm_f32le") && (args[args.length - 1] ?? "").endsWith("musica.wav")
          ? new Error("falsa falha no decode da musica")
          : null,
    });
    const opcoes: OpcoesDeJuntar = {
      previews: { "p-000": PREVIEW_A },
      dirTrabalho: DIR_TRABALHO,
      dirEntregas: DIR_ENTREGAS,
      musica_caminho: MUSICA,
      executor,
    };
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      /etapa "decode de audio \(.*musica\.wav\)" falhou:\nfalsa falha no decode da musica/,
    );
    // A musica decodifica depois da fala (o caminho com musica existe).
    expect(chamadas.some((c) => (c.args[c.args.length - 1] ?? "").endsWith("musica.wav"))).toBe(true);
  });

  it("encode de audio falha -> ErroJuntarRender 'encode de audio'", async () => {
    const { opcoes } = opcoesFake({
      falhar: (comando, args) =>
        comando === "ffmpeg" && args.includes("-b:a") ? new Error("falsa falha no encode") : null,
    });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      /etapa "encode de audio" falhou:\nfalsa falha no encode/,
    );
  });

  it("mux final falha -> ErroJuntarRender 'mux final'", async () => {
    const { opcoes } = opcoesFake({
      falhar: (comando, args) =>
        comando === "ffmpeg" && args.includes("-use_editlist") ? new Error("falsa falha no mux") : null,
      finalMp4: Buffer.from("mp4-fake"),
    });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      /etapa "mux final" falhou:\nfalsa falha no mux/,
    );
  });

  it("mux nao escreve bytes -> ErroJuntarRender (C1)", async () => {
    const { opcoes } = opcoesFake({ finalMp4: Buffer.alloc(0) });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      "a muxagem nao escreveu bytes (C1)",
    );
  });

  it("muxado sem stream de video -> ErroJuntarRender", async () => {
    const { opcoes } = opcoesFake({ finalMp4: Buffer.from("x"), streamsCsv: "audio" });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      "nao tem video+audio",
    );
  });

  it("muxado sem stream de audio -> ErroJuntarRender", async () => {
    const { opcoes } = opcoesFake({ finalMp4: Buffer.from("x"), streamsCsv: "video" });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      "nao tem video+audio",
    );
  });

  it("entregavel fora do alvo de LUFS -> ErroJuntarRender (o juntar nunca entrega fora do alvo)", async () => {
    const { opcoes } = opcoesFake({
      ebur128:
        "  Integrated loudness:\n    I:         -10.0 LUFS\n  True peak:\n    Peak:      -5.0 dBFS\n",
    });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      "fora do alvo de LUFS",
    );
  });

  it("true peak do entregavel acima do teto -> ErroJuntarRender", async () => {
    const { opcoes } = opcoesFake({
      ebur128:
        "  Integrated loudness:\n    I:         -23.0 LUFS\n  True peak:\n    Peak:      -0.5 dBFS\n",
    });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      /true peak -0\.50 dBTP acima do teto/,
    );
  });

  it("duracao do stream ilegivel (N/A) -> ErroJuntarRender, nunca entrega sem medir (C4)", async () => {
    const { opcoes } = opcoesFake({ finalMp4: Buffer.from("x"), duracao: "N/A" });
    await expect(juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes)).rejects.toThrow(
      "duracao do stream de video nao lida",
    );
  });

  it("start_time ilegivel (N/A) -> nenhum -itsoffset inventado (0 conservador)", async () => {
    const { opcoes, chamadas } = opcoesFake({
      finalMp4: Buffer.from("x"),
      startTime: "N/A",
      duracao: "2.000000",
    });
    const resultado = await juntar(roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]), opcoes);
    expect(resultado.duracaoSegundos).toBe(2.0);
    const mux = chamadaDoMux(chamadas);
    expect(mux).toBeDefined();
    expect(mux!.args.includes("-itsoffset")).toBe(false);
  });

  it("start_time com priming (+21 ms) -> o mux reverte com -itsoffset (FQ-J1)", async () => {
    const { opcoes, chamadas } = opcoesFake({
      finalMp4: Buffer.from("x"),
      startTime: "0.021000",
      duracao: "2.000000",
    });
    const resultado = await juntar(roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]), opcoes);
    expect(resultado.duracaoSegundos).toBe(2.0);
    const mux = chamadaDoMux(chamadas);
    expect(mux).toBeDefined();
    const idx = mux!.args.indexOf("-itsoffset");
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(mux!.args[idx + 1]).toBe("-0.021");
  });

  it("fluxo feliz com executor fake: entrega por hash + sidecar + SRT com offset", async () => {
    const { opcoes, chamadas } = opcoesFake({ finalMp4: Buffer.from("mp4-final-fake") });
    const resultado = await juntar(
      roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]),
      {
        ...opcoes,
        timing_pedacos: {
          "p-000": [{ texto: "Cue do p-000", inicio_segundos: 0.1, fim_segundos: 0.6 }],
          "p-001": [{ texto: "Cue do p-001", inicio_segundos: 0.2, fim_segundos: 0.7 }],
        },
      },
    );
    expect(resultado.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(resultado.duracaoSegundos).toBe(2.0);
    expect(resultado.medicoes.musicaAplicada).toBe(false);
    expect(resultado.medicoes.alvoLufs).toBe(-23.0);
    expect(existsSync(resultado.caminho)).toBe(true);
    expect(existsSync(join(DIR_ENTREGAS, `${resultado.hash}.mp4`))).toBe(true);
    const sidecar = JSON.parse(
      readFileSync(join(DIR_ENTREGAS, `${resultado.hash}.json`), "utf-8"),
    ) as { schema_version: string; srt: { gerado: boolean }; musica: { aplicada: boolean } };
    expect(sidecar.schema_version).toBe("EntregaJuntar.1");
    expect(sidecar.srt.gerado).toBe(true);
    expect(sidecar.musica.aplicada).toBe(false);
    // SRT final em disco com os offsets acumulados (pedaco 1 a 1.0s).
    const srt = readFileSync(join(DIR_ENTREGAS, `${resultado.hash}.srt`), "utf-8");
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ inicio_s: 0.1, texto: "Cue do p-000" });
    expect(cues[1]).toMatchObject({ inicio_s: 1.2, texto: "Cue do p-001" });
    // O mux rodou com o reparo do priming (start_time default 0.021).
    expect(chamadaDoMux(chamadas)?.args.includes("-itsoffset")).toBe(true);
  });
});

// ─── Branches do parse do ffprobe (parametrosDePreview) ───────────────────────

describe("parametrosDePreview / verificarFormatosDosPreviews — branches do parse", () => {
  it("preview com TODOS os campos divergentes -> as sete divergencias nomeadas", async () => {
    const { opcoes } = opcoesFake({
      videoJson: JSON.stringify({
        streams: [
          { codec_name: "vp9", pix_fmt: "yuv444p", width: 1280, height: 720, avg_frame_rate: "24/1" },
        ],
      }),
      audioJson: JSON.stringify({
        streams: [{ codec_name: "mp3", sample_rate: "44100", channels: 1, channel_layout: "mono" }],
      }),
    });
    let erro: unknown;
    try {
      await juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroJuntarFormatosDivergentes);
    const divergencias = (erro as ErroJuntarFormatosDivergentes).divergencias.join(" ");
    for (const esperada of [
      "codec de video vp9",
      "pix_fmt yuv444p",
      "largura 1280",
      "altura 720",
      "fps 24",
      "codec de audio mp3",
      "sample rate 44100",
    ]) {
      expect(divergencias).toContain(esperada);
    }
  });

  it("ffprobe sem streams -> divergencia por campos ilegiveis (nunca concat cego)", async () => {
    const { opcoes } = opcoesFake({
      videoJson: JSON.stringify({ streams: [] }),
      audioJson: JSON.stringify({ streams: [] }),
    });
    let erro: unknown;
    try {
      await juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroJuntarFormatosDivergentes);
    // As sete mensagens entram numa unica entrada (uma por pedaco),
    // separadas por "; " — cada campo ilegivel e nomeado, nunca silencio.
    const divergencias = (erro as ErroJuntarFormatosDivergentes).divergencias.join(" ");
    for (const esperada of ["codec de video undefined", "pix_fmt undefined", "largura undefined", "altura undefined", "fps undefined", "codec de audio undefined", "sample rate undefined"]) {
      expect(divergencias).toContain(esperada);
    }
  });

  it("fps ilegivel (0/0) diverge; sample_rate NUMERICO e aceito (normalizacao do parse)", async () => {
    const { opcoes } = opcoesFake({
      videoJson: JSON.stringify({
        streams: [
          { codec_name: "h264", pix_fmt: "yuv420p", width: 1920, height: 1080, avg_frame_rate: "0/0" },
        ],
      }),
      // O ffprobe real emite sample_rate como STRING ("48000"); o parse
      // tambem aceita numero — sem essa normalizacao, um preview com
      // sample_rate numerico divergiria em falso.
      audioJson: JSON.stringify({
        streams: [{ codec_name: "aac", sample_rate: 48000, channels: 2, channel_layout: "stereo" }],
      }),
    });
    let erro: unknown;
    try {
      await juntar(roteiroDeTeste([{ id: "p-000" }]), opcoes);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroJuntarFormatosDivergentes);
    const divergencias = (erro as ErroJuntarFormatosDivergentes).divergencias.join(" ");
    expect(divergencias).toContain("fps undefined");
    expect(divergencias).not.toContain("sample rate");
  });

  it("canais e channel_layout inconsistentes entre previews -> divergencia de consistencia", async () => {
    const { executor, chamadas } = executorFake({
      audioJson: JSON.stringify({
        streams: [{ codec_name: "aac", sample_rate: "48000", channels: 2, channel_layout: "stereo" }],
      }),
    });
    // O segundo preview (p-001) responde mono — o fake diferencia pelo
    // caminho no ultimo argumento do ffprobe.
    const executorMonodirecional: ExecutorDeComando = async (comando, args) => {
      if (comando === "ffprobe" && args.join(" ").includes("stream=codec_name,sample_rate,channels")) {
        const caminho = args[args.length - 1];
        return {
          stdout:
            caminho === PREVIEW_B
              ? JSON.stringify({
                  streams: [
                    { codec_name: "aac", sample_rate: "48000", channels: 1, channel_layout: "mono" },
                  ],
                })
              : JSON.stringify({
                  streams: [
                    { codec_name: "aac", sample_rate: "48000", channels: 2, channel_layout: "stereo" },
                  ],
                }),
          stderr: "",
        };
      }
      return executor(comando, args);
    };
    const opcoes: OpcoesDeJuntar = {
      previews: { "p-000": PREVIEW_A, "p-001": PREVIEW_B },
      dirTrabalho: DIR_TRABALHO,
      dirEntregas: DIR_ENTREGAS,
      executor: executorMonodirecional,
    };
    let erro: unknown;
    try {
      await juntar(roteiroDeTeste([{ id: "p-000" }, { id: "p-001" }]), opcoes);
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroJuntarFormatosDivergentes);
    const divergencias = (erro as ErroJuntarFormatosDivergentes).divergencias.join(" ");
    expect(divergencias).toContain("canais 1 (o primeiro preview tem 2)");
    expect(divergencias).toContain("channel_layout mono (o primeiro preview tem stereo)");
    // O gate sondou o video dos DOIS previews (nunca pula um pedaco).
    expect(
      chamadas.filter((c) => c.args.includes("stream=codec_name,pix_fmt,width,height,avg_frame_rate")).length,
    ).toBe(2);
  });
});

// ─── verificarJuntavel: prioridade e ordem dos gates ──────────────────────────

describe("verificarJuntavel — prioridade dos problemas", () => {
  it("anexo invalido E outros problemas -> juntar-anexo-invalido (anexo vence)", () => {
    // p-000 gif sem anexo (regra anexo-*) E duracao_total divergente
    // (regra fora do escopo anexo): os DOIS problemas existem, e o
    // revalidacao prioriza o anexo (o estado inconsistente da rota de
    // anexo e o 409 que o catch-all nao pega).
    const roteiro = roteiroDeTeste([{ id: "p-000" }]);
    const gifSemAnexo: Pedaco = {
      ...pedacoDeTeste({ id: "p-000" }),
      tipo_visual: "gif",
    };
    const comAnexo: Pedaco = {
      ...gifSemAnexo,
      anexo_hash: undefined,
      anexo_meta: undefined,
    };
    const invalido: Roteiro = {
      schema_version: "Roteiro.1",
      pedacos: [comAnexo],
      duracao_total_segundos: 999,
    };
    const verificacao = verificarJuntavel(invalido, { previews: { "p-000": PREVIEW_A } });
    expect(verificacao.ok).toBe(false);
    if (!verificacao.ok) {
      expect(verificacao.problemas[0]?.regra).toBe("juntar-anexo-invalido");
      expect(verificacao.problemas[0]?.detalhes.join(" ")).toContain("anexo-exigido-para-gif-video");
      // O problema fora do escopo anexo NAO entra no 409 (o detalhe so
      // carrega o que o servidor pode responder).
      expect(verificacao.problemas[0]?.detalhes.join(" ")).not.toContain("duracao-total-inconsistente");
    }
  });
});

// ─── gerarSrtFinal: offsets com duracoes variadas ─────────────────────────────

describe("gerarSrtFinal — offsets acumulados e mapa parcial", () => {
  it("pedaco sem entrada no mapa e duracoes nao-inteiras", () => {
    const roteiro = roteiroDeTeste([
      { id: "p-000", duracao: 0.5 },
      { id: "p-001", duracao: 1.5 },
      { id: "p-002", duracao: 2.0 },
    ]);
    const srt = gerarSrtFinal(roteiro, {
      "p-000": [{ texto: "Cue um", inicio_segundos: 0.1, fim_segundos: 0.4 }],
      // p-001 SEM entrada no mapa: o bloco e pulado, o offset acumula.
      "p-002": [{ texto: "Cue tres", inicio_segundos: 0.2, fim_segundos: 0.8 }],
    });
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ inicio_s: 0.1, fim_s: 0.4, texto: "Cue um" });
    // Offset de p-002 = 0.5 + 1.5 = 2.0s (a duracao de p-001 conta mesmo
    // sem cues proprios) e a numeracao continua (2, nunca reinicia).
    expect(cues[1]).toMatchObject({ inicio_s: 2.2, fim_s: 2.8, texto: "Cue tres" });
  });
});

// ─── conferirEntrega: o oraculo com probes fake ───────────────────────────────

describe("conferirEntrega — o oraculo (C1 + C4) com probes fake", () => {
  const DIR_ORACULO = join(DIR, "oraculo");

  /** Grava uma entrega em <hash>.mp4 e devolve (hash, bytes). */
  async function gravarEntrega(bytes: Buffer): Promise<{ hash: string; caminho: string }> {
    mkdirSync(DIR_ORACULO, { recursive: true });
    const hash = sha256Hex(bytes);
    const caminho = join(DIR_ORACULO, `${hash}.mp4`);
    await writeFile(caminho, bytes);
    return { hash, caminho };
  }

  /** Frame de conteudo (gradiente — yavg ~139, desvio > 1: NAO reprova). */
  function frameComConteudo(): Buffer {
    const buf = Buffer.alloc(1920 * 1080);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = 40 + (i % 200);
    }
    return buf;
  }

  /** Frame chapado (yavg 16, desvio 0: o oraculo REPROVA — C1). */
  function frameChapado(): Buffer {
    return Buffer.alloc(1920 * 1080, 16);
  }

  function opcoesDeConferencia(
    fixture: FixtureDoExecutor,
    conteudo: Buffer,
  ): { opcoes: Parameters<typeof conferirEntrega>[1]; executorBruto: ExecutorBruto } {
    const { executor } = executorFake(fixture);
    const executorBruto: ExecutorBruto = async () => ({
      stdout: conteudo,
      stderr: Buffer.alloc(0),
    });
    return { opcoes: { dirEntregas: DIR_ORACULO, executor, executorBruto }, executorBruto };
  }

  it("tudo conforme -> problemas vazio e medida de conteudo viva", async () => {
    const bytes = frameComConteudo();
    const { hash } = await gravarEntrega(bytes);
    const { opcoes } = opcoesDeConferencia({}, bytes);
    const conferencia = await conferirEntrega(hash, opcoes);
    expect(conferencia.problemas).toEqual([]);
    expect(conferencia.medida.yavgMaximo).toBeGreaterThan(0);
  });

  it("bytes nao medem o hash do nome -> problema de identidade (S-8)", async () => {
    const bytes = frameComConteudo();
    // O arquivo <hash>.mp4 existe, mas o hash do NOME nao mede os bytes:
    // grava-se sob um nome trocado (conteudo identico, endereco errado).
    const hashReal = sha256Hex(bytes);
    const hashTrocado = `${hashReal.slice(0, -1)}${hashReal.endsWith("0") ? "1" : "0"}`;
    mkdirSync(DIR_ORACULO, { recursive: true });
    await writeFile(join(DIR_ORACULO, `${hashTrocado}.mp4`), bytes);
    const { opcoes } = opcoesDeConferencia({}, bytes);
    const conferencia = await conferirEntrega(hashTrocado, opcoes);
    expect(conferencia.problemas).toHaveLength(1);
    expect(conferencia.problemas[0]).toContain("nao medem o hash");
  });

  it("sem stream de video -> problema nomeado", async () => {
    const bytes = frameComConteudo();
    const { hash } = await gravarEntrega(bytes);
    const { opcoes } = opcoesDeConferencia(
      {
        oraculoJson: JSON.stringify({
          streams: [{ codec_type: "audio", codec_name: "aac", sample_rate: "48000" }],
        }),
      },
      bytes,
    );
    const conferencia = await conferirEntrega(hash, opcoes);
    expect(conferencia.problemas.some((p) => p.includes("sem stream de video"))).toBe(true);
  });

  it("sem stream de audio -> problema nomeado", async () => {
    const bytes = frameComConteudo();
    const { hash } = await gravarEntrega(bytes);
    const { opcoes } = opcoesDeConferencia(
      {
        oraculoJson: JSON.stringify({
          streams: [
            { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1920, height: 1080 },
          ],
        }),
      },
      bytes,
    );
    const conferencia = await conferirEntrega(hash, opcoes);
    expect(conferencia.problemas.some((p) => p.includes("sem stream de audio"))).toBe(true);
  });

  it("parametros de video divergentes -> 4 problemas (codec/pix_fmt/width/height)", async () => {
    const bytes = frameComConteudo();
    const { hash } = await gravarEntrega(bytes);
    const { opcoes } = opcoesDeConferencia(
      {
        oraculoJson: JSON.stringify({
          streams: [
            { codec_type: "video", codec_name: "vp9", pix_fmt: "yuv444p", width: 1280, height: 720 },
            { codec_type: "audio", codec_name: "aac", sample_rate: "48000" },
          ],
        }),
      },
      bytes,
    );
    const conferencia = await conferirEntrega(hash, opcoes);
    const problemas = conferencia.problemas.join("\n");
    for (const esperado of ["codec_name vp9", "pix_fmt yuv444p", "width 1280", "height 720"]) {
      expect(problemas).toContain(esperado);
    }
  });

  it("parametros de audio divergentes -> codec e sample_rate nomeados", async () => {
    const bytes = frameComConteudo();
    const { hash } = await gravarEntrega(bytes);
    const { opcoes } = opcoesDeConferencia(
      {
        oraculoJson: JSON.stringify({
          streams: [
            { codec_type: "video", codec_name: "h264", pix_fmt: "yuv420p", width: 1920, height: 1080 },
            { codec_type: "audio", codec_name: "mp3", sample_rate: "44100" },
          ],
        }),
      },
      bytes,
    );
    const conferencia = await conferirEntrega(hash, opcoes);
    const problemas = conferencia.problemas.join("\n");
    expect(problemas).toContain("stream de audio codec mp3 (esperado aac)");
    expect(problemas).toContain("stream de audio sample_rate 44100 (esperado 48000)");
  });

  it("conteudo chapado reprovado (C1) mesmo com streams conformes", async () => {
    const bytes = frameComConteudo();
    const { hash } = await gravarEntrega(bytes);
    // O ORACULO le os frames do arquivo pelo executorBruto — o conteudo
    // devolvido e chapado: passa na camada estrutural, reprova aqui.
    const { opcoes } = opcoesDeConferencia({}, frameChapado());
    const conferencia = await conferirEntrega(hash, opcoes);
    expect(conferencia.problemas.some((p) => p.includes("chapado"))).toBe(true);
  });
});
