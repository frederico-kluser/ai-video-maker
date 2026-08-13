/**
 * tests/render/encode/comando.test.ts
 *
 * O CONSTRUTOR UNICO de linha de comando (ADR-0036, decisao 1) — e as
 * duas armadilhas que ele existe para impedir:
 *
 *   1. ADVERSARIAL 1: a linha de um perfil de HARDWARE nao pode conter
 *      `-crf` (o encoder nao tem a opcao; a flag sobrando nao aborta o
 *      comando — exit 0 e rate control default: falso verde); a linha de
 *      um perfil de SOFTWARE nao pode conter `-cq`/`-qp`. Cada motor
 *      serializa o alvo no PROPRIO eixo.
 *
 *   2. ADVERSARIAL 2: os tres flags canonicos de reprodutibilidade
 *      (-fflags +bitexact -flags +bitexact -map_metadata -1) estao no
 *      comando e DEPOIS das entradas (NV-5: antes do -i eles configuram
 *      o demuxer, o MP4 sai com TAG:encoder=Lavf... e duas execucoes
 *      dão bytes diferentes, tudo com exit 0).
 *
 *   3. O construtor recusa perfil invalido (nunca gera comando de um
 *      perfil que violaria o eixo).
 */

import { describe, expect, it } from "vitest";
import {
  EComandoPerfilInvalido,
  FLAGS_BITEXACT,
  montarComando,
} from "src/render/encode/comando.js";
import type { PerfilEncode } from "src/render/encode/formato.js";

function perfilSoftware(): PerfilEncode {
  return {
    nome: "teste-software",
    motor: "libx264",
    codec: "libx264",
    deterministico: true,
    justificativaDeterminismo: "medido (teste)",
    alvoQualidade: { tipo: "crf", valor: 18 },
    preset: "medium",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

function perfilHardware(): PerfilEncode {
  return {
    nome: "teste-hardware",
    motor: "nvenc",
    codec: "h264_nvenc",
    deterministico: false,
    justificativaDeterminismo: "sem garantia (teste)",
    alvoQualidade: { tipo: "cq", valor: 23 },
    preset: "p5",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

describe("montarComando — o construtor unico", () => {
  it("monta o argv completo com entrada, perfil e saida", () => {
    const argv = montarComando(perfilSoftware(), "/tmp/in.mp4", "/tmp/out.mp4");
    expect(argv[0]).toBe("ffmpeg");
    expect(argv).toContain("-i");
    expect(argv[argv.indexOf("-i") + 1]).toBe("/tmp/in.mp4");
    expect(argv).toContain("-c:v");
    expect(argv[argv.indexOf("-c:v") + 1]).toBe("libx264");
    expect(argv[argv.length - 1]).toBe("/tmp/out.mp4");
    expect(argv[argv.indexOf("-f") + 1]).toBe("mp4");
  });

  it("serializa o alvo CRF no eixo do software", () => {
    const argv = montarComando(perfilSoftware(), "in", "out");
    expect(argv).toContain("-crf");
    expect(argv[argv.indexOf("-crf") + 1]).toBe("18");
    // O vocabulario do hardware NAO aparece na linha de software.
    expect(argv).not.toContain("-cq");
    expect(argv).not.toContain("-qp");
    expect(argv).not.toContain("-rc");
  });

  it("serializa o alvo CQ no eixo do hardware, sem -crf", () => {
    const argv = montarComando(perfilHardware(), "in", "out");
    expect(argv).toContain("-rc");
    expect(argv[argv.indexOf("-rc") + 1]).toBe("vbr");
    expect(argv).toContain("-cq");
    expect(argv[argv.indexOf("-cq") + 1]).toBe("23");
    // A pergunta adversarial 1 em forma executavel: NAO ha -crf na linha
    // de hardware — a flag sobrando nao aborta o ffmpeg (falso verde).
    expect(argv).not.toContain("-crf");
  });

  it("serializa o alvo QP como -rc constqp -qp N", () => {
    const perfil: PerfilEncode = {
      ...perfilHardware(),
      alvoQualidade: { tipo: "qp", valor: 20 },
    };
    const argv = montarComando(perfil, "in", "out");
    expect(argv).toContain("constqp");
    expect(argv).toContain("-qp");
    expect(argv[argv.indexOf("-qp") + 1]).toBe("20");
    expect(argv).not.toContain("-crf");
  });

  it("emite os tres flags canonicos em TODO comando (todos os perfis)", () => {
    for (const perfil of [perfilSoftware(), perfilHardware()]) {
      const argv = montarComando(perfil, "in", "out");
      for (const flag of FLAGS_BITEXACT) {
        expect(argv).toContain(flag);
      }
    }
  });

  it("coloca os flags canonicos DEPOIS das entradas (NV-5)", () => {
    // Se alguem mover os flags para antes do -i, o MP4 carrega
    // TAG:encoder=Lavf... e os bytes deixam de ser reproduziveis — com
    // exit 0. A POSICAO e parte do contrato: o indice de -fflags tem de
    // ser maior que o indice do -i.
    const argv = montarComando(perfilSoftware(), "in", "out");
    const idxEntrada = argv.indexOf("-i");
    const idxBitexact = argv.indexOf("-fflags");
    expect(idxEntrada).toBeGreaterThanOrEqual(0);
    expect(idxBitexact).toBeGreaterThan(idxEntrada);
    // E o -map_metadata -1 (o terceiro flag) tambem depois das entradas.
    expect(argv.indexOf("-map_metadata")).toBeGreaterThan(idxEntrada);
  });

  it("passa argsExtra adiante", () => {
    const perfil = { ...perfilSoftware(), argsExtra: ["-g", "60"] };
    const argv = montarComando(perfil, "in", "out");
    expect(argv).toContain("-g");
    expect(argv[argv.indexOf("-g") + 1]).toBe("60");
  });

  it("recusa perfil invalido com EComandoPerfilInvalido (eixo cruzado nunca gera comando)", () => {
    const perfilErrado: PerfilEncode = {
      ...perfilHardware(),
      alvoQualidade: { tipo: "crf", valor: 18 },
    };
    expect(() => montarComando(perfilErrado, "in", "out")).toThrow(
      EComandoPerfilInvalido,
    );
  });
});
