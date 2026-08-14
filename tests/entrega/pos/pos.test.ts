/**
 * tests/entrega/pos/pos.test.ts
 *
 * A SUITE DO POS — card F5-03 (W8, caminho critico). ADR-0040 +
 * contrato-w8 §2.
 *
 * Cobre o que e FUNCAO PURA e deterministica do modulo (o gate com
 * ffmpeg de verdade e a ferramenta `gate.ts`, rodada por `just pos`):
 *
 *   - a estrategia de ganho (`computarGanho`): chegar no alvo, clamp
 *     pelo teto pre-encode (-2.0 dBTP = teto - margem), UMA aplicacao;
 *   - o SRT: timecodes, a RECONCILIACAO com o mix (C1 — o sidecar
 *     descreve a timeline POS-reconciliacao: cue que cruza o corte e
 *     truncada no corte, menos de 1 frame visivel e removida, nenhuma
 *     cue sobrepoe a vizinha), serializacao do MESMO documento, parse,
 *     conferencia contra o documento pos-reconciliado (∅-crit (a) — a
 *     mutacao de um intervalo fica VERMELHA) e a coerencia da queimada
 *     (∅-crit (b) — o CASO C1 da c-004: a queimada morre na janela
 *     visual e o sidecar morre no corte do mix (18,233 s), os dois
 *     lados coincidem; o gate assere inicio_s onde a queimada existe,
 *     NUNCA duracao total);
 *   - o parse do sumario do ebur128 (parse vazio = erro, nunca valor);
 *   - o perfil de audio: mesmo contrato do F5-02, comando com os flags
 *     canonicos e a guarda deterministico: false;
 *   - o pin: versao do ffmpeg lida e conferida.
 */

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { Manifesto } from "../../../src/contratos/manifesto.js";
import { calcularDuracao } from "../../../src/composicao/tempo.js";
import type { TimingCanonico } from "../../../src/sincronia/timing/formato.js";
import { lerTimingCanonico } from "../../../src/sincronia/timing/validar.js";
import { lerLegendas } from "../../../src/sincronia/legendas/validar.js";
import type { LegendasCanonicas } from "../../../src/sincronia/legendas/formato.js";
import {
  computarGanho,
  aplicarGanhoNoMaster,
  ganhoLinearDe,
} from "../../../src/entrega/pos/normalizar.js";
import { alvoDoPos, TOLERANCIA_MEDICAO_LU, MARGEM_OVERSHOOT_DB } from "../../../src/entrega/pos/index.js";
import {
  conferirCoerenciaDaQueimada,
  conferirSidecar,
  parseSrt,
  parseTimecode,
  reconciliarComOMix,
  serializarSrt,
  spansDaQueimada,
  srtTimecode,
} from "../../../src/entrega/pos/sidecar.js";
import type { FalaReconciliada, JanelaVisualDaCena } from "../../../src/entrega/pos/sidecar.js";
import {
  EMedicaoInvalida,
  parseSumarioEbur128,
} from "../../../src/entrega/pos/medir.js";
import {
  EPerfilNaoDeterministico,
  PERFIL_AUDIO_POS,
  montarComandoAudio,
  validarPerfilAudio,
} from "../../../src/entrega/pos/perfil-audio.js";
import { FLAGS_BITEXACT } from "../../../src/render/encode/comando.js";
import { versaoDoFfmpeg } from "../../../src/entrega/pos/index.js";

// ─── Fixture canonica ─────────────────────────────────────────────────────────

const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const TIMING_CANONICO = "fixtures/canonico/timing-canono.json";
const LEGENDAS_GOLDEN = "fixtures/canonico/legendas-canono.json";

/** Carrega o contexto canonico (manifesto + timing) e o documento. */
async function contextoCanonico(): Promise<{
  manifesto: Manifesto;
  timing: TimingCanonico;
  legendas: LegendasCanonicas;
  legendasBytes: Buffer;
}> {
  const manifesto = JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
  const timing: TimingCanonico = lerTimingCanonico(await readFile(TIMING_CANONICO));
  const legendasBytes = await readFile(LEGENDAS_GOLDEN);
  const legendas = lerLegendas(legendasBytes, { manifesto, timing });
  return { manifesto, timing, legendas, legendasBytes };
}

/** As janelas visuais das cenas (F1-01) — a base da queimada. */
function janelasVisuais(manifesto: Manifesto): readonly JanelaVisualDaCena[] {
  const timeline = calcularDuracao(manifesto).timeline;
  return timeline.map((t) => ({
    cenaId: t.cenaId,
    inicio_s: t.frameInicial / manifesto.fps,
    fim_s: t.frameFinal / manifesto.fps,
  }));
}

/**
 * As falas reconciliadas do mix da fixture canonica (C1) — os MESMOS
 * numeros que o mix REAL mede (faixas.locucao do MixDocument.1; o gate
 * do pos os ancorou em tests/audio/mix.test.ts, C1): c-004 cortada em
 * 18,233 s (inicio de c-005), c-005 em [18,233..23,588].
 */
function falasReconciliadasDaFixture(): readonly FalaReconciliada[] {
  return [
    { cena: "c-004", inicio_s: 14.233333333333333, fim_s: 18.233333333333334 },
    { cena: "c-005", inicio_s: 18.233333333333334, fim_s: 23.588333333333335 },
  ];
}

// ─── Estrategia de ganho ──────────────────────────────────────────────────────

describe("computarGanho (ADR-0040: estrategia do card)", () => {
  const alvo = alvoDoPos();

  it("aplica o ganho que leva o master ao alvo", () => {
    // Master a -15.4 LUFS (o numero MEDIDO da fixture canonica) -> ganho -7.6 dB.
    const g = computarGanho(alvo, -15.4, -11.7);
    expect(g.ganhoParaAlvoDb).toBeCloseTo(-7.6, 5);
    expect(g.ganhoAplicadoDb).toBeCloseTo(-7.6, 5);
    expect(g.truePeakPreEncodeDbtp).toBeCloseTo(-19.3, 5);
    expect(g.clampadoPorTeto).toBe(false);
  });

  it("clampa pelo teto pre-encode: teto = maxTruePeak - margem (-2.0 dBTP)", () => {
    // Master silencioso em LOUDNESS (-30 LUFS) mas com pico quente
    // (-1.5 dBTP): ganhoParaAlvo = +7 dB estouraria o pico pre-encode.
    const g = computarGanho(alvo, -30.0, -1.5);
    expect(g.tetoPreEncodeDbtp).toBeCloseTo(alvo.maxTruePeakDbtp - alvo.margemOvershootDb, 5);
    expect(g.tetoPreEncodeDbtp).toBeCloseTo(-2.0, 5);
    // ganhoParaAlvo = +7 dB; o teto so permite ate -2.0 - (-1.5) = -0.5 dB.
    expect(g.ganhoMaximoPorTetoDb).toBeCloseTo(-0.5, 5);
    expect(g.ganhoAplicadoDb).toBeCloseTo(-0.5, 5);
    expect(g.truePeakPreEncodeDbtp).toBeCloseTo(-2.0, 5);
    expect(g.clampadoPorTeto).toBe(true);
  });

  it("nunca estoura o teto pre-encode, mesmo com master silencioso (ganho alto)", () => {
    const g = computarGanho(alvo, -40.0, -30.0);
    // ganhoParaAlvo = +17 dB; teto permite ate -2.0 - (-30) = +28 dB.
    expect(g.ganhoAplicadoDb).toBeCloseTo(17.0, 5);
    expect(g.truePeakPreEncodeDbtp).toBeCloseTo(-13.0, 5);
    expect(g.truePeakPreEncodeDbtp).toBeLessThanOrEqual(g.tetoPreEncodeDbtp);
    expect(g.clampadoPorTeto).toBe(false);
  });

  it("aplicar o ganho e aritmetica linear (decibeis -> fator)", () => {
    expect(ganhoLinearDe(-7.6)).toBeCloseTo(Math.pow(10, -7.6 / 20), 12);
    expect(ganhoLinearDe(0)).toBe(1);
  });

  it("aplica UMA vez nos bytes: o WAV sai com o fator linear aplicado", async () => {
    const masterBytes = await readFile(".cache/pos-calibracao/master.wav").catch(() => null);
    if (masterBytes === null) return; // o gate gera o master; aqui o caso e do normalizar
    const g = computarGanho(alvo, -15.4, -11.7);
    const r = aplicarGanhoNoMaster(masterBytes, g.ganhoAplicadoDb);
    expect(r.picoAbsoluto).toBeCloseTo(0.25969192385673523 * ganhoLinearDe(-7.6), 2);
    expect(r.wav.length).toBe(masterBytes.length);
  });
});

// ─── SRT: timecodes, serializacao, parse ─────────────────────────────────────

describe("srtTimecode (hh:mm:ss,mmm)", () => {
  it("formata segundos absolutos", () => {
    expect(srtTimecode(14.233333333333333)).toBe("00:00:14,233");
    expect(srtTimecode(19.798333333333332)).toBe("00:00:19,798");
    expect(srtTimecode(22.738333333333333)).toBe("00:00:22,738");
    expect(srtTimecode(0)).toBe("00:00:00,000");
    expect(srtTimecode(3661.5)).toBe("01:01:01,500");
  });

  it("parseTimecode inverte o formato", () => {
    expect(parseTimecode("00:00:14,233")).toBeCloseTo(14.233, 6);
    expect(parseTimecode("01:01:01,500")).toBeCloseTo(3661.5, 6);
    expect(parseTimecode("00:00:61,000")).toBeNull();
    expect(parseTimecode("14,233")).toBeNull();
  });
});

describe("serializarSrt (∅-crit (a): o sidecar nasce do MESMO documento)", () => {
  it("serializa o golden legendas-canono.json em SRT, na ordem do documento", async () => {
    const { legendas } = await contextoCanonico();
    const srt = serializarSrt(legendas);
    const esperado = [
      "1",
      "00:00:14,233 --> 00:00:19,798",
      "Nesta seção, apresentamos os dados de",
      "desempenho do pipeline. Cada tipo de nó",
      "",
      "2",
      "00:00:19,888 --> 00:00:22,738",
      "tem características de renderização",
      "distintas.",
      "",
      "3",
      "00:00:18,233 --> 00:00:23,588",
      "Concluindo, o manifesto é a peça central",
      "do pipeline. Obrigado por assistir.",
      "",
    ].join("\n");
    expect(srt).toBe(esperado);
  });

  it("parseSrt le o que serializarSrt escreveu (round-trip de tempos)", async () => {
    const { legendas } = await contextoCanonico();
    const srt = serializarSrt(legendas);
    const cues = parseSrt(srt);
    expect(cues).toHaveLength(legendas.legendas.length);
    for (let i = 0; i < legendas.legendas.length; i++) {
      const l = legendas.legendas[i]!;
      const c = cues[i]!;
      expect(c.inicio_s).toBeCloseTo(l.inicio_s, 3);
      expect(c.fim_s).toBeCloseTo(l.fim_s, 3);
      expect(c.texto).toBe((l.linhas ?? []).join("\n"));
    }
  });

  it("parseSrt rejeita SRT ilegivel (falsifiable-gates: parse vazio e erro)", () => {
    expect(() => parseSrt("1\n00:00:14,233 --> 00:00:19,798\nok")).not.toThrow();
    expect(() => parseSrt("sem timecode")).toThrow(/timecode|arrow/);
    expect(() => parseSrt("1\n00:00:14,233 00:00:19,798\nok")).toThrow(/arrow/);
  });
});

// ─── Reconciliacao com o mix (C1) ────────────────────────────────────────────

describe("reconciliarComOMix (o SRT descreve a timeline POS-reconciliacao)", () => {
  it("fixture canonica: o SRT pos-reconciliado nao tem sobreposicao e morre no corte", async () => {
    const { manifesto, legendas } = await contextoCanonico();
    const srt = serializarSrt(
      reconciliarComOMix(legendas, falasReconciliadasDaFixture(), manifesto.fps),
    );
    const esperado = [
      "1",
      "00:00:14,233 --> 00:00:18,233",
      "Nesta seção, apresentamos os dados de",
      "desempenho do pipeline. Cada tipo de nó",
      "",
      "2",
      "00:00:18,233 --> 00:00:23,588",
      "Concluindo, o manifesto é a peça central",
      "do pipeline. Obrigado por assistir.",
      "",
    ].join("\n");
    expect(srt).toBe(esperado);
  });

  it("fixture canonica: nenhuma cue cruza o ponto de corte da reconciliacao (18,233 s)", async () => {
    const { manifesto, legendas } = await contextoCanonico();
    const reconciliadas = reconciliarComOMix(
      legendas,
      falasReconciliadasDaFixture(),
      manifesto.fps,
    );
    const corte = 18.233333333333334;
    // A 2a legenda de c-004 (19,888..22,738) e inteira DEPOIS do corte:
    // some. A 1a (14,233..19,798) cruza o corte e e truncada em 18,233.
    const spans = reconciliadas.legendas.map(
      (l) => `${l.cena}:${l.inicio_s.toFixed(3)}:${l.fim_s.toFixed(3)}`,
    );
    expect(spans).toEqual(["c-004:14.233:18.233", "c-005:18.233:23.588"]);
    // Nenhuma cue de c-004 vaza alem do corte; nenhuma de c-005 nasce antes.
    for (const l of reconciliadas.legendas) {
      if (l.cena === "c-004") expect(l.fim_s).toBeLessThanOrEqual(corte + 1e-6);
      if (l.cena === "c-005") expect(l.inicio_s).toBeGreaterThanOrEqual(corte - 1e-6);
    }
  });

  it("nenhuma cue sobrepoe a vizinha (parse do SRT; zero cues = FALHA)", async () => {
    const { manifesto, legendas } = await contextoCanonico();
    const srt = serializarSrt(
      reconciliarComOMix(legendas, falasReconciliadasDaFixture(), manifesto.fps),
    );
    const cues = parseSrt(srt);
    // C2: zero cues e FALHA — um SRT vazio nao e resultado aceitavel
    // (falsifiable-gates: zero itens parseados = erro, nunca sucesso).
    expect(cues.length).toBeGreaterThan(0);
    for (let i = 1; i < cues.length; i++) {
      const anterior = cues[i - 1]!;
      const atual = cues[i]!;
      // Tolerancia de 1 ms: o parse le timecodes com precisao de
      // milissegundo; as fronteiras tocam exatamente em 18,233 s.
      expect(atual.inicio_s).toBeGreaterThanOrEqual(anterior.fim_s - 0.001);
    }
  });

  it("caso de borda: cue que cruza o corte e TRUNCADA no corte (nao some nem vaza)", () => {
    const base = documentoSintetico([cue("c-x", 0, 10)]);
    const r = reconciliarComOMix(base, [{ cena: "c-x", inicio_s: 0, fim_s: 5 }], 30);
    expect(r.legendas).toHaveLength(1);
    expect(r.legendas[0]!.inicio_s).toBeCloseTo(0, 6);
    // Truncada em 5 s — o corte do mix, exatamente. Nao some, nao vaza.
    expect(r.legendas[0]!.fim_s).toBeCloseTo(5, 6);
  });

  it("caso de borda: truncamento com menos de 1 frame visivel REMOVE a cue", () => {
    const base = documentoSintetico([cue("c-x", 0, 10)]);
    // Residuo de 0,01 s a 30 fps = 0,3 frame < 1 frame: a cue e removida.
    const r = reconciliarComOMix(base, [{ cena: "c-x", inicio_s: 0, fim_s: 0.01 }], 30);
    expect(r.legendas).toHaveLength(0);
  });

  it("caso de borda: o residuo tolerado pelo mix entre cenas nao sobrepoe a cue vizinha", () => {
    // O mix C1 tolera ate 0,1 s de cauda da cena anterior sob a
    // posterior (nao corta em 5,05 s). No SRT, a cauda e clampada ao
    // inicio da cue da cena seguinte: nunca duas caixas ao mesmo tempo.
    const base = documentoSintetico([cue("c-x", 0, 5.05), cue("c-y", 5.0, 9)]);
    const r = reconciliarComOMix(
      base,
      [
        { cena: "c-x", inicio_s: 0, fim_s: 5.05 },
        { cena: "c-y", inicio_s: 5.0, fim_s: 9 },
      ],
      30,
    );
    expect(r.legendas).toHaveLength(2);
    expect(r.legendas[0]!.fim_s).toBeCloseTo(5.0, 6);
    expect(r.legendas[1]!.inicio_s).toBeCloseTo(5.0, 6);
  });

  it("fps invalido e recusado (o frame visivel e 1/fps — nunca divisao por zero)", () => {
    const base = documentoSintetico([cue("c-x", 0, 10)]);
    expect(() => reconciliarComOMix(base, [{ cena: "c-x", inicio_s: 0, fim_s: 5 }], 0)).toThrow(/fps/);
    expect(() => reconciliarComOMix(base, [{ cena: "c-x", inicio_s: 0, fim_s: 5 }], NaN)).toThrow(/fps/);
  });
});

/** Um documento sintetico minimo para os casos de borda da reconciliacao. */
function documentoSintetico(
  legendas: readonly {
    cena: string;
    inicio_s: number;
    fim_s: number;
  }[],
): LegendasCanonicas {
  return {
    schema_version: "LegendasCanonicas.1",
    unidade: "segundos",
    legendas: legendas.map((l) => ({
      unidade: "segundos" as const,
      cena: l.cena,
      audio: "abc",
      inicio_s: l.inicio_s,
      fim_s: l.fim_s,
      linhas: ["ola"],
      texto: "ola",
      caracteres: 3,
    })),
  };
}

/** Uma cue sintetica: uma linha, um texto. */
function cue(cena: string, inicio_s: number, fim_s: number) {
  return { cena, inicio_s, fim_s };
}

// ─── ∅-crit (a): mutacao de um intervalo fica VERMELHA ───────────────────────

describe("conferirSidecar (∅-crit (a) do contrato-w8 §2)", () => {
  it("fica VERDE quando o SRT deriva do documento", async () => {
    const { legendas } = await contextoCanonico();
    const problemas = conferirSidecar(serializarSrt(legendas), legendas);
    expect(problemas).toEqual([]);
  });

  it("fica VERMELHO quando UM intervalo do sidecar diverge do golden", async () => {
    const { legendas } = await contextoCanonico();
    // Mutacao: o FIM da primeira legenda de c-004 deslocado +0,5 s.
    const mutado = {
      ...legendas,
      legendas: legendas.legendas.map((l, i) =>
        i === 0 ? { ...l, fim_s: l.fim_s + 0.5 } : l,
      ),
    };
    const srtMutado = serializarSrt(mutado);
    const problemas = conferirSidecar(srtMutado, legendas);
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.join("\n")).toMatch(/c-004/);
    expect(problemas.join("\n")).toMatch(/sem cue correspondente|nao deriva/);
  });

  it("fica VERMELHO quando um cue do SRT nao deriva de legenda nenhuma", async () => {
    const { legendas } = await contextoCanonico();
    const srt = serializarSrt(legendas);
    // Mutacao no SRT: um cue com inicio inventado.
    const srtMutado = srt.replace(
      "00:00:14,233 --> 00:00:19,798",
      "00:00:15,000 --> 00:00:19,798",
    );
    const problemas = conferirSidecar(srtMutado, legendas);
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.join("\n")).toMatch(/intervalo inventado|cue/);
  });
});

// ─── ∅-crit (b): CASO C1 — coerencia de inicio_s, nunca duracao total ─────────

describe("spansDaQueimada e conferirCoerenciaDaQueimada (∅-crit (b))", () => {
  it("o CASO C1 da fixture: c-004 tem janela visual de 4 s e fala de 8,505 s", async () => {
    const { manifesto, legendas } = await contextoCanonico();
    const janelas = janelasVisuais(manifesto);
    const c004 = janelas.find((j) => j.cenaId === "c-004")!;
    expect(c004.fim_s - c004.inicio_s).toBeCloseTo(4.0, 5);
    // A fala de c-004 (no documento) termina em 22,738 s — alem da janela.
    const c004Legendas = legendas.legendas.filter((l) => l.cena === "c-004");
    expect(c004Legendas[c004Legendas.length - 1]!.fim_s).toBeCloseTo(22.738, 3);
  });

  it("a queimada morre na janela visual; o sidecar morre no corte do mix", async () => {
    const { manifesto, legendas } = await contextoCanonico();
    const janelas = janelasVisuais(manifesto);
    const spans = spansDaQueimada(legendas, janelas);
    const c004 = spans.filter((s) => s.cena === "c-004");
    // A queimada de c-004 existe so ate o fim da janela (18,233 s).
    expect(c004.length).toBeGreaterThan(0);
    expect(Math.max(...c004.map((s) => s.fim_s))).toBeCloseTo(18.233, 3);
    // O sidecar POS-reconciliacao morre no MESMO ponto: o mix cortou a
    // fala de c-004 em 18,233 s (inicio de c-005, C1) — o SRT descreve o
    // que o espectador OUVe, e o que ele ouve de c-004 termina no corte.
    // A assercao do gate e de inicio_s onde a queimada existe
    // (∅-crit (b)) — nunca igualdade de duracao total.
    const reconciliadas = reconciliarComOMix(
      legendas,
      falasReconciliadasDaFixture(),
      manifesto.fps,
    );
    const sidecarFim = Math.max(
      ...reconciliadas.legendas.filter((l) => l.cena === "c-004").map((l) => l.fim_s),
    );
    expect(sidecarFim).toBeCloseTo(18.233, 3);
  });

  it("o gate fica VERDE no CASO C1 (a divergencia legitima de FIM nao acusa)", async () => {
    const { manifesto, legendas } = await contextoCanonico();
    const janelas = janelasVisuais(manifesto);
    const srt = serializarSrt(
      reconciliarComOMix(legendas, falasReconciliadasDaFixture(), manifesto.fps),
    );
    const problemas = conferirCoerenciaDaQueimada(srt, legendas, janelas);
    // Onde a queimada existe, o inicio_s coincide — a duracao total NAO
    // e comparada (asserir igualdade de duracao seria o falso-verde que
    // o contrato-w8 §2 existe para impedir).
    expect(problemas).toEqual([]);
  });

  it("fica VERMELHO quando o inicio_s diverge onde a queimada existe", async () => {
    const { manifesto, legendas } = await contextoCanonico();
    const janelas = janelasVisuais(manifesto);
    // Mutacao: a primeira legenda de c-004 comeca 1 s depois no SRT
    // pos-reconciliado.
    const srtMutado = serializarSrt(
      reconciliarComOMix(legendas, falasReconciliadasDaFixture(), manifesto.fps),
    ).replace(
      "00:00:14,233 --> 00:00:18,233",
      "00:00:15,233 --> 00:00:18,233",
    );
    const problemas = conferirCoerenciaDaQueimada(srtMutado, legendas, janelas);
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.join("\n")).toMatch(/c-004/);
  });
});

// ─── Parse do sumario do ebur128 ──────────────────────────────────────────────

describe("parseSumarioEbur128 (falsifiable-gates)", () => {
  const sumario =
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0] Summary:\n" +
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0] \n" +
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0]   Integrated loudness:\n" +
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0]     I:         -23.0 LUFS\n" +
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0]     Threshold: -31.2 LUFS\n" +
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0] \n" +
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0]   True peak:\n" +
    "[Parsed_ebur128_0 @ 0x5d9c1a6d26c0]     Peak:      -19.3 dBFS\n";

  it("extrai I e Peak do sumario", () => {
    const m = parseSumarioEbur128(sumario);
    expect(m.integradoLufs).toBeCloseTo(-23.0, 5);
    expect(m.truePeakDbtp).toBeCloseTo(-19.3, 5);
  });

  it("sumario sem I ou sem Peak e ERRO, nunca valor", () => {
    expect(() => parseSumarioEbur128("")).toThrow(EMedicaoInvalida);
    expect(() =>
      parseSumarioEbur128(sumario.replace("Peak:", "Pik:")),
    ).toThrow(EMedicaoInvalida);
    expect(() =>
      parseSumarioEbur128(sumario.replace("I:", "J:")),
    ).toThrow(EMedicaoInvalida);
  });
});

// ─── O perfil de audio (mesmo contrato do F5-02) ─────────────────────────────

describe("perfil de audio do pos (contrato-w8 §2, ADR-0040 decisao 5)", () => {
  it("o perfil do pos e deterministico: true com justificativa medida", () => {
    expect(PERFIL_AUDIO_POS.deterministico).toBe(true);
    expect(PERFIL_AUDIO_POS.justificativaDeterminismo.length).toBeGreaterThan(60);
    expect(validarPerfilAudio(PERFIL_AUDIO_POS)).toEqual([]);
    expect(PERFIL_AUDIO_POS.codec).toBe("aac");
    expect(PERFIL_AUDIO_POS.alvoQualidade).toEqual({ tipo: "bitrate", valor: 192 });
  });

  it("perfil sem alvo de qualidade declarado e INVALIDO (∅-crit do PROGRAMA)", () => {
    const semAlvo = { ...PERFIL_AUDIO_POS, alvoQualidade: undefined };
    const erros = validarPerfilAudio(semAlvo);
    expect(erros.some((e) => e.includes("OBRIGATORIO"))).toBe(true);
  });

  it("o comando carrega os flags canonicos do F5-02 DEPOIS das entradas", () => {
    const argv = montarComandoAudio(PERFIL_AUDIO_POS, "in.wav", "out.m4a");
    expect(argv[0]).toBe("ffmpeg");
    expect(argv.slice(1, 3)).toEqual(["-y", "-hide_banner"]);
    const iEntrada = argv.indexOf("-i");
    expect(argv[iEntrada + 1]).toBe("in.wav");
    // Os flags canonicos vem depois da entrada (NV-5).
    const posFlags = argv.indexOf("-fflags");
    expect(posFlags).toBeGreaterThan(iEntrada);
    for (const flag of FLAGS_BITEXACT) {
      expect(argv).toContain(flag);
    }
    expect(argv.slice(-3)).toEqual(["-f", "mp4", "out.m4a"]);
    expect(argv).toContain("-c:a");
    expect(argv).toContain("aac");
    expect(argv).toContain("-b:a");
    expect(argv).toContain("192k");
  });

  it("perfil deterministico: false e RECUSADO na comparacao do pos", () => {
    const nvenc = { ...PERFIL_AUDIO_POS, deterministico: false, nome: "nvda" };
    expect(() => montarComandoAudio(nvenc, "in.wav", "out.m4a")).toThrow(
      EPerfilNaoDeterministico,
    );
    expect(() => montarComandoAudio(nvenc, "in.wav", "out.m4a")).toThrow(
      /deterministico: false/,
    );
  });

  it("perfil invalido e recusado pelo construtor unico (nunca comando de lixo)", () => {
    expect(() =>
      montarComandoAudio({ ...PERFIL_AUDIO_POS, alvoQualidade: { tipo: "crf", valor: 18 } } as never, "in.wav", "out.m4a"),
    ).toThrow(/bitrate|invalido/);
  });
});

// ─── Pin de ferramentas ───────────────────────────────────────────────────────

describe("pin do pos (contrato-w8 §2: ffmpeg 6.1.1 + node)", () => {
  it("alvoDoPos le os tokens COMO ESTAO (S-5, leitura) e as constantes do ADR-0040", () => {
    const alvo = alvoDoPos();
    expect(alvo.targetLufs).toBe(-23.0);
    expect(alvo.maxTruePeakDbtp).toBe(-1.0);
    expect(alvo.toleranciaMedicaoLu).toBe(TOLERANCIA_MEDICAO_LU);
    expect(alvo.margemOvershootDb).toBe(MARGEM_OVERSHOOT_DB);
  });

  it("versaoDoFfmpeg reconhece a primeira linha do -version", async () => {
    const v = await versaoDoFfmpeg(async () => ({
      stdout: "ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023 the FFmpeg developers\n...",
      stderr: "",
    }));
    expect(v).toBe("6.1.1-3ubuntu5");
    expect(/^6\.1\.1/.test(v)).toBe(true);
  });

  it("versaoDoFfmpeg nao reconhece saida sem ffmpeg", async () => {
    await expect(
      versaoDoFfmpeg(async () => ({ stdout: "nope", stderr: "" })),
    ).rejects.toThrow(/nao reconheci/);
  });
});
