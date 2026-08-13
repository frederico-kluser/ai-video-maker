/**
 * tests/render/encode/verificar.test.ts
 *
 * A VERIFICACAO DO ARTEFATO — a camada 0 do oraculo em forma executavel:
 *
 *   1. ESTRUTURA POR STREAM (C4): a leitura e `-select_streams v:0
 *      -count_frames`; duracao de container NAO entra na comparacao —
 *      a assercao dura e `framesLidos > 0`.
 *   2. PARSE NAO-VAZIO (falsifiable-gates): probe com saida vazia (chave
 *      com typo, arquivo ilegivel) FALHA antes de comparar valor — o
 *      exit 0 do ffprobe com saida vazia e o falso verde classico.
 *   3. CODECD/RESOLUCAO: bater com o esperado — a troca de encoder em
 *      silencio nao passa.
 *   4. ENTROPIA (C1): YAVG medio abaixo do piso (video preto) FALHA —
 *      um video 100% preto passa em toda a camada estrutural.
 *   5. ADVERSARIAL 2: `format_tags` NAO-VAZIO (encoder, creation_time)
 *      FALHA — metadado nao-deterministico presente significa comando
 *      montado errado (bitexact antes das entradas, NV-5).
 *
 * O executor e FAKE e roteado por comando (ffprobe/ffmpeg) — os encodes
 * reais vivem em `reais.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  calcularFramemd5,
  codecNameDePerfil,
  verificarSaida,
  YAVG_PISO_CONTEUDO,
} from "src/render/encode/verificar.js";

/** Roteador fake: responde por (comando, subcomando) com saidas prontas. */
function executorRoteado(respostas: Record<string, string>): {
  executor: (c: string, a: string[]) => Promise<{ stdout: string; stderr: string }>;
  chamadas: { comando: string; args: string[] }[];
} {
  const chamadas: { comando: string; args: string[] }[] = [];
  const executor = async (comando: string, args: string[]) => {
    chamadas.push({ comando, args: [...args] });
    const chave = `${comando} ${args.join(" ")}`;
    for (const [padrao, saida] of Object.entries(respostas)) {
      if (chave.startsWith(padrao)) {
        // O ffmpeg escreve LOG no stderr (o metadata=print do
        // signalstats sai no stderr, medido em 6.1.1); o framemd5 com
        // `-f framemd5 -` sai no STDOUT (medido em 6.1.1); o ffprobe
        // sai no stdout. O fake espelha o comportamento real.
        const muxerFramemd5 =
          args.indexOf("-f") >= 0 &&
          args[args.indexOf("-f") + 1] === "framemd5";
        if (comando === "ffmpeg" && !muxerFramemd5) {
          return { stdout: "", stderr: saida };
        }
        return { stdout: saida, stderr: "" };
      }
    }
    // Qualquer chamada nao roteada e um teste quebrado, nao um falso verde.
    throw new Error(`executor fake: chamada nao roteada: ${chave.slice(0, 120)}`);
  };
  return { executor, chamadas };
}

const SAIDA_PROBE_OK = [
  "codec_name=h264",
  "width=320",
  "height=180",
  "pix_fmt=yuv420p",
  "nb_read_frames=30",
  "duration=1.000000",
].join("\n") + "\n";

// O MP4 real carrega as tags estruturais de brand (DETERMINISTICAS) mesmo
// com bitexact; o que a pergunta adversarial 2 persegue e a ausencia das
// chaves VOLATEIS (encoder, creation_time, date) — medido em 6.1.1.
const SAIDA_FORMAT_SEM_TAGS =
  "duration=1.000000\nTAG:major_brand=isom\nTAG:minor_version=512\nTAG:compatible_brands=isomiso2avc1mp41\n";

const SAIDA_SIGNAL_OK = Array.from({ length: 3 }, () => "YAVG=120.8").join("\n") + "\n";

// Formato real do framemd5 (6.1.1): "N, pts, dts, size, checksum" —
// o checksum md5 SEM prefixo 0x; cabecalho com "#".
const FRAMEMD5_OK = [
  "0,         26,         26,        1,    86400, 4e43cf6b543f5a2a8ebec990248dd255",
  "1,         27,         27,        1,    86400, df319b4f1e944792ccceafb56853784a",
].join("\n") + "\n";

const SAIDA_FRAMEMD5_BRUTA = `#format: frame checksums\n#version: 2\n#hash: MD5\n#tb 0: 1/30\n#media_type 0: video\n#stream_id 0: 0\n${FRAMEMD5_OK}`;

const respostasOK: Record<string, string> = {
  "ffprobe -v error -count_frames -select_streams v:0": SAIDA_PROBE_OK,
  "ffprobe -v error -show_entries format=duration:format_tags": SAIDA_FORMAT_SEM_TAGS,
  "ffmpeg -hide_banner -i /tmp/out.mp4 -vf signalstats": SAIDA_SIGNAL_OK,
  "ffmpeg -hide_banner -fflags +bitexact -i /tmp/out.mp4 -f framemd5": SAIDA_FRAMEMD5_BRUTA,
};

describe("verificarSaida — camada 0 do oraculo", () => {
  it("aprova um artefato saudavel (codec, resolucao, frames, entropia, sem metadado)", async () => {
    const { executor } = executorRoteado(respostasOK);
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "h264", largura: 320, altura: 180 },
      { executor },
    );
    expect(resultado.ok).toBe(true);
    expect(resultado.erros).toEqual([]);
    expect(resultado.info.codec).toBe("h264");
    expect(resultado.info.framesLidos).toBe(30);
    // as tags volateis nao existem; as de brand (deterministicas) seguem
    expect(resultado.info.formatTags.encoder).toBeUndefined();
    expect(resultado.info.formatTags.major_brand).toBe("isom");
    expect(resultado.info.framemd5.length).toBeGreaterThan(0);
  });

  it("FALHA com probe vazio (parse NAO-vazio antes de comparar valor)", async () => {
    const { executor } = executorRoteado({
      ...respostasOK,
      "ffprobe -v error -count_frames -select_streams v:0": "", // chave com typo ou arquivo ilegivel
    });
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "h264", largura: 320, altura: 180 },
      { executor },
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join("\n")).toMatch(/vazio/);
  });

  it("FALHA quando o codec diverge do esperado (encoder trocou em silencio)", async () => {
    const { executor } = executorRoteado(respostasOK);
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "hevc", largura: 320, altura: 180 },
      { executor },
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join("\n")).toMatch(/codec/);
  });

  it("FALHA quando a resolucao diverge do esperado", async () => {
    const { executor } = executorRoteado(respostasOK);
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "h264", largura: 640, altura: 360 },
      { executor },
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join("\n")).toMatch(/resolucao/);
  });

  it("FALHA quando nao ha frames lidos (nb_read_frames vazio ou zero)", async () => {
    const { executor } = executorRoteado({
      ...respostasOK,
      "ffprobe -v error -count_frames -select_streams v:0":
        "codec_name=h264\nwidth=320\nheight=180\npix_fmt=yuv420p\nnb_read_frames=N/A\nduration=N/A\n",
    });
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "h264", largura: 320, altura: 180 },
      { executor },
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join("\n")).toMatch(/framesLidos/);
  });

  it("FALHA com video preto (entropia abaixo do piso — C1)", async () => {
    const { executor } = executorRoteado({
      ...respostasOK,
      "ffmpeg -hide_banner -i /tmp/out.mp4 -vf signalstats": "YAVG=16.0\nYAVG=16.0\n",
    });
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "h264", largura: 320, altura: 180 },
      { executor },
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join("\n")).toMatch(/preto/);
    // o piso usado na assercao e a constante nomeada, nao um literal.
    expect(YAVG_PISO_CONTEUDO).toBe(32);
  });

  it("FALHA quando o metadado nao-deterministico esta presente (pergunta adversarial 2)", async () => {
    const { executor } = executorRoteado({
      ...respostasOK,
      "ffprobe -v error -show_entries format=duration:format_tags":
        "duration=1.000000\nTAG:encoder=Lavf60.16.100\nTAG:creation_time=2026-08-13T00:00:00.000000Z\n",
    });
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "h264", largura: 320, altura: 180 },
      { executor },
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.erros.join("\n")).toMatch(/metadado nao-deterministico/);
  });

  it("a duracao e lida por STREAM, nao pelo container (C4)", async () => {
    const { executor, chamadas } = executorRoteado(respostasOK);
    const resultado = await verificarSaida(
      "/tmp/out.mp4",
      { codec: "h264", largura: 320, altura: 180 },
      { executor },
    );
    expect(resultado.ok).toBe(true);
    // o probe estrutural e por stream com -count_frames
    const probeStream = chamadas.find((c) => c.args.includes("-count_frames"));
    expect(probeStream).toBeDefined();
    expect(probeStream?.args).toContain("-select_streams");
    expect(resultado.info.duracaoStreamS).toBe(1);
  });

  it("codecNameDePerfil traduz o -c:v do perfil para o vocabulario do ffprobe", () => {
    expect(codecNameDePerfil("libx264")).toBe("h264");
    expect(codecNameDePerfil("h264_nvenc")).toBe("h264");
    expect(codecNameDePerfil("libx265")).toBe("hevc");
    expect(codecNameDePerfil("hevc_nvenc")).toBe("hevc");
  });
});

describe("calcularFramemd5 — o oraculo de frames decodificados (camada 1)", () => {
  it("devolve o texto das linhas de frame (uma por frame, com hash)", async () => {
    const { executor } = executorRoteado(respostasOK);
    const framemd5 = await calcularFramemd5("/tmp/out.mp4", { executor });
    expect(framemd5).toContain("4e43cf6b543f5a2a8ebec990248dd255");
    expect(framemd5).toContain("df319b4f1e944792ccceafb56853784a");
    // o muxer de hash e conferido no ambiente (build-dependente).
  });
});
