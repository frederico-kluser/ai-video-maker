/**
 * tests/audio/mix.test.ts
 *
 * A SUITE DO MIX — card F3-05 (W7). ADR-0034.
 *
 * Tudo aqui e puro e sintetico (zero ffmpeg, zero rede): o audio de
 * locucao e uma onda senoidal deterministicamente gerada na mesma forma
 * dos cassetes (WAV s16 mono 16 kHz) e a musica uma senoide estereo. A
 * fixture sintetica espelha a canonica em tudo que importa para o
 * contrato: MESMO timing canonico commitado (F3-01), MESMAS posicoes
 * (aritmetica F1-01), MESMO envelope (calcularEnvelopeDucking do F3-03),
 * MESMA cadencia (cortarSilencio do F3-04) — o audio e sintetico, o
 * CONTRATO e o real. O gate (mix.ferramenta.ts) repete a prova com os
 * bytes reais dos cassetes e o ffmpeg pinado.
 *
 *   1. ∅-CRITS (os tres do card, por mutacao):
 *      - mix sem locucao tem de ficar VERMELHO (V5);
 *      - duas locucoes simultaneas > 0,1 s tem de ficar VERMELHO (V3 —
 *        a fixture canonica sobrepoe c-004/c-005 em 4,505 s no timing;
 *        a RECONCILIACAO do C1 e o que deixa o mix verde);
 *      - emenda enderecada pelo hash do audio-fonte tem de ficar
 *        VERMELHO (V4 — exercitado com a cadencia CORTANTE gapAlvo 0,05,
 *        onde a emenda difere da fonte de verdade).
 *   2. ADVERSARIAIS: clip medido nos bytes (V6); determinismo 2x;
 *      cobertura medida (V7 — o envelope aplicado onde a fala existe);
 *      reconciliacao C1 aplicada (pergunta 4: fala carrega alem da
 *      janela, cena posterior manda, sobreposicao residual = 0).
 *   3. PERGUNTA DA ONDA (§12): assercao de PRESENCA com os MESMOS
 *      numeros que o F5-01 derivara dos MESMOS inputs: "a fala de
 *      c-004 esta em [14,233..22,738] com a cauda cortada no inicio de
 *      c-005". Nenhuma lista completa de cenas, faixas ou assets.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { Manifesto } from "src/contratos/manifesto.js";
import { lerTimingCanonico } from "src/sincronia/timing/validar.js";
import type { TimingCanonico } from "src/sincronia/timing/formato.js";
import {
  calcularEnvelopeDucking,
  posicoesDaTimeline,
} from "src/sincronia/ducking/calcular.js";
import { cortarSilencio } from "src/sincronia/ritmo/cortar.js";
import { escreverWavPcm, lerWavPcm } from "src/audio/mix/pcm.js";
import { emendar, hashDaEmenda } from "src/audio/mix/emenda.js";
import { derivarComponentes, mixar } from "src/audio/mix/mixar.js";
import { verificarMix, spansEsperados } from "src/audio/mix/verificar.js";
import type { EntradasDoMix } from "src/audio/mix/mixar.js";

const TIMING_CANONICO = "fixtures/canonico/timing-canono.json";
const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";

// ─── Audio sintetico deterministico ────────────────────────────────────────────

/** Senoide deterministica (fase do indice da amostra — zero estado). */
function senoide(
  rate: number,
  canais: number,
  duracaoS: number,
  freqHz: number,
  amplitude: number,
  bits: 16 | 32 = 16,
): Buffer {
  const total = Math.ceil(duracaoS * rate) * canais;
  const amostras = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / canais / rate;
    const v = amplitude * Math.sin(2 * Math.PI * freqHz * t);
    amostras[i] = v;
  }
  return escreverWavPcm({ rate, canais, amostras }, bits);
}

/** A locucao sintetica na forma dos cassetes: WAV s16 mono 16 kHz. */
function locucaoSintetica(duracaoS: number): Buffer {
  return senoide(16000, 1, duracaoS, 220, 0.5);
}

/** A musica sintetica: WAV f32 estereo 16 kHz (o mix do teste roda a 16k). */
function musicaSintetica(duracaoS: number): Buffer {
  return senoide(16000, 2, duracaoS, 110, 0.4, 32);
}

// ─── A fixture do teste (mesmo contrato, audio sintetico) ─────────────────────

function timingCanonico(): TimingCanonico {
  return lerTimingCanonico(readFileSync(TIMING_CANONICO, "utf-8"));
}

function manifestoCanonico(): Manifesto {
  return JSON.parse(readFileSync(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
}

/** Hash sintetico determinístico para cada cena com locucao do timing. */
function hashesDoTiming(timing: TimingCanonico): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const [id, entrada] of Object.entries(timing.cenas)) {
    if (entrada.estado === "locucao") mapa.set(id, entrada.audio!);
  }
  return mapa;
}

/** O decoder do teste: parse WAV e confere a taxa do mix (mono sobe a estereo no mix). */
function decodificarNaTaxa(rate: number, _canais: number) {
  return (bytes: Buffer) => {
    const pcm = lerWavPcm(bytes);
    if (pcm.rate !== rate) {
      throw new Error(
        `decoder de teste: ${pcm.rate} Hz, esperado ${rate} Hz`,
      );
    }
    return pcm;
  };
}

interface FixtureDoTeste {
  entradas: EntradasDoMix;
  /** Hashes da locucao (do timing) -> bytes sinteticos. */
  porHash: Map<string, Buffer>;
  musicaHash: string;
  rate: number;
  canais: number;
}

/**
 * Monta as entradas do mix com o contrato REAL e audio sintetico.
 *
 * @param gapAlvoS alvo de lacuna da cadencia (0.25 = sem cortes na
 *   fixture; 0.05 = cortante, exercita a emenda de verdade)
 */
function fixtureDoTeste(gapAlvoS = 0.25, rate = 16000, canais = 2): FixtureDoTeste {
  const timing = timingCanonico();
  const manifesto = manifestoCanonico();
  const posicoes = posicoesDaTimeline(manifesto);
  const envelope = calcularEnvelopeDucking({ timing, posicoes });
  const cadencia = cortarSilencio(timing, { gapAlvoS });

  const porHash = new Map<string, Buffer>();
  for (const [id, entrada] of Object.entries(timing.cenas)) {
    if (entrada.estado !== "locucao") continue;
    porHash.set(entrada.audio!, locucaoSintetica(entrada.duracao_s));
  }
  const musicaHash = "m".repeat(64);
  porHash.set(musicaHash, musicaSintetica(40));

  const entradas: EntradasDoMix = {
    timing,
    manifesto,
    envelope,
    cadencia,
    musicaHash,
    carregarBytes: async (hash) => porHash.get(hash) ?? null,
    decodificarPcm: decodificarNaTaxa(rate, canais),
    opcoes: { rate, canais, ffmpeg: "sintetico", node: "teste" },
  };
  return { entradas, porHash, musicaHash, rate, canais };
}

// ─── 1. Emenda (C3) ────────────────────────────────────────────────────────────

describe("mix — emenda (C3)", () => {
  it("sem cortes na cadencia, a emenda e a fonte byte a byte (e o hash coincide — enderecamento por conteudo)", () => {
    const timing = timingCanonico();
    const c004 = timing.cenas["c-004"]!;
    const fonte = locucaoSintetica(c004.duracao_s);
    const emendada = emendar(fonte, c004, []);

    expect(emendada.bytes.equals(fonte)).toBe(true);
    expect(hashDaEmenda(emendada.bytes)).toBe(hashDaEmenda(fonte));
  });

  it("com cortes, a emenda e a fonte menos as regioes, byte a byte", () => {
    const timing = timingCanonico();
    const c004 = timing.cenas["c-004"]!;
    const fonte = locucaoSintetica(c004.duracao_s);
    // Cortes dentro das lacunas DECLARADAS (0.09s): a lacuna [1.575, 1.665]
    // perde o rabo [1.575+0.02, 1.665] e a [2.61, 2.7] idem.
    const regioes = [
      { inicio_s: 1.595, fim_s: 1.665 },
      { inicio_s: 2.63, fim_s: 2.7 },
    ];
    const emendada = emendar(fonte, c004, regioes);

    const esperado = manualSplice(fonte, 16000, regioes);
    expect(emendada.bytes.equals(esperado)).toBe(true);
    expect(hashDaEmenda(emendada.bytes)).not.toBe(hashDaEmenda(fonte));
  });

  it("∅-crit do F3-04 rededuzido: regiao fora de silencio DECLARADO e ERRO", () => {
    const timing = timingCanonico();
    const c004 = timing.cenas["c-004"]!;
    const fonte = locucaoSintetica(c004.duracao_s);
    const regiaoFora = [{ inicio_s: 0.1, fim_s: 0.5 }]; // sobre "Nesta" [0, 0.345]

    expect(() => emendar(fonte, c004, regiaoFora)).toThrow(/fora de silencio DECLARADO/);
  });

  it("∅-crit do F3-04 rededuzido: regiao que toca palavra e ERRO, nunca corte silencioso", () => {
    // Entrada invalida de proposito: lacuna DECLARADA sobre uma palavra
    // (o oraculo C7c nunca permitiria; a guarda existe para a regressao
    // da politica de corte, e e exercitada aqui com a mutacao).
    const fonte = locucaoSintetica(3);
    const entrada = {
      palavras: [{ texto: "um", inicio_s: 0.5, fim_s: 1.0 }],
      silencio: [
        { inicio_s: 0, fim_s: 0.8 }, // lacuna mentirosa: cobre a palavra
        { inicio_s: 1.0, fim_s: 3 },
      ],
    };
    const regiaoSobrePalavra = [{ inicio_s: 0.2, fim_s: 0.7 }]; // dentro da lacuna, sobre a palavra

    expect(() => emendar(fonte, entrada, regiaoSobrePalavra)).toThrow(
      /toca uma palavra/,
    );
  });

  it("determinismo: dois processamentos produzem os mesmos bytes", () => {
    const timing = timingCanonico();
    const c004 = timing.cenas["c-004"]!;
    const fonte = locucaoSintetica(c004.duracao_s);
    const regioes = [{ inicio_s: 1.595, fim_s: 1.665 }];
    const a = emendar(fonte, c004, regioes).bytes;
    const b = emendar(fonte, c004, regioes).bytes;
    expect(a.equals(b)).toBe(true);
  });
});

/** Reimplementacao independente da emenda (o oraculo do oraculo). */
function manualSplice(
  fonte: Buffer,
  rate: number,
  regioes: readonly { inicio_s: number; fim_s: number }[],
): Buffer {
  const pcm = lerWavPcm(fonte);
  const trechos: Float32Array[] = [];
  let cursor = 0;
  for (const r of [...regioes].sort((a, b) => a.inicio_s - b.inicio_s)) {
    const a = Math.round(r.inicio_s * rate);
    const b = Math.round(r.fim_s * rate);
    trechos.push(pcm.amostras.subarray(cursor, a));
    cursor = b;
  }
  trechos.push(pcm.amostras.subarray(cursor));
  const total = trechos.reduce((acc, t) => acc + t.length, 0);
  const out = new Float32Array(total);
  let pos = 0;
  for (const t of trechos) {
    out.set(t, pos);
    pos += t.length;
  }
  return escreverWavPcm({ rate: pcm.rate, canais: pcm.canais, amostras: out }, 16);
}

// ─── 2. Mixar ──────────────────────────────────────────────────────────────────

describe("mix — o construtor (C1 + C3 + envelope)", () => {
  it("PERGUNTA DA ONDA (§12): a fala de c-004 esta em [14,233..22,738] com a cauda cortada no inicio de c-005 — os MESMOS numeros que o F5-01 derivara", async () => {
    const f = fixtureDoTeste();
    const mix = await mixar(f.entradas);

    const c004 = mix.spans.find((s) => s.cena === "c-004");
    const c005 = mix.spans.find((s) => s.cena === "c-005");
    expect(c004).toBeDefined();
    expect(c005).toBeDefined();

    // Inicio absoluto da cena (aritmetica F1-01): 427/30 = 14,2333...
    expect(Math.abs(c004!.inicio_s - 427 / 30)).toBeLessThan(1e-6);
    // A fala (8,505 s, sem cortes na cadencia default) estende alem da
    // janela visual de 4 s — e a CAUDA e cortada no inicio de c-005:
    expect(Math.abs(c004!.fim_s - c005!.inicio_s)).toBeLessThan(1e-6);
    expect(Math.abs(c005!.inicio_s - 547 / 30)).toBeLessThan(1e-6);
    // A duracao da locucao e a do timing (8,505 s), nunca a janela (C1.1).
    expect(c004!.duracaoEmendada_s).toBeCloseTo(8.505, 3);
  });

  it("reconciliacao C1: sobreposicao residual no mix = 0 (as caudas nao convivem)", async () => {
    const f = fixtureDoTeste();
    const mix = await mixar(f.entradas);
    const spans = [...mix.spans].sort((a, b) => a.inicio_s - b.inicio_s);
    for (let i = 1; i < spans.length; i++) {
      const anterior = spans[i - 1]!;
      const atual = spans[i]!;
      expect(Math.max(0, anterior.fim_s - atual.inicio_s)).toBeLessThanOrEqual(0.1);
    }
  });

  it("sem a reconciliacao (sonda do gate), as duas locucoes convivem no mix", async () => {
    const f = fixtureDoTeste();
    const mix = await mixar({
      ...f.entradas,
      opcoes: { ...f.entradas.opcoes, aplicarReconciliacao: false },
    });
    const c004 = mix.spans.find((s) => s.cena === "c-004")!;
    const c005 = mix.spans.find((s) => s.cena === "c-005")!;
    expect(c004.fim_s - c005.inicio_s).toBeGreaterThan(0.1); // 4,505 s sem corte
  });

  it("o envelope tem efeito onde a fala existe: a musica no mix difere da crua dentro dos spans", async () => {
    const f = fixtureDoTeste();
    const com = await derivarComponentes(f.entradas);
    const sem = await derivarComponentes(f.entradas, { aplicarEnvelope: false });

    for (const span of com.spans) {
      const difere = regiaoDiferente(
        com.musica,
        sem.musica,
        span.inicio_s,
        span.fim_s,
        f.rate,
      );
      expect(difere, `cena ${span.cena}`).toBe(true);
    }
  });

  it("clip e erro estrutural: volumes que estouram 0 dBFS nao produzem mix", async () => {
    const f = fixtureDoTeste();
    const manifesto = {
      ...f.entradas.manifesto,
      cenas: f.entradas.manifesto.cenas.map((c) =>
        c.id === "c-004"
          ? { ...c, audio_cena: { ...(c.audio_cena ?? {}), volume: 5 } }
          : c,
      ),
    } as Manifesto;

    await expect(
      mixar({ ...f.entradas, manifesto }),
    ).rejects.toThrow(/clipa|CLIPADO/i);
  });

  it("determinismo: dois processamentos produzem os mesmos bytes e o mesmo documento", async () => {
    const f = fixtureDoTeste();
    const a = await mixar(f.entradas);
    const b = await mixar(f.entradas);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(JSON.stringify(a.documento)).toBe(JSON.stringify(b.documento));
  });
});

// ─── 3. Verificar — os tres ∅-crits por mutacao ────────────────────────────────

describe("mix — o oraculo (mede, nao escuta)", () => {
  it("fixture: VERDE, com as medicoes do contrato (atenuacao ~ -12 dB, margem fala/musica >= 6 dB)", async () => {
    const f = fixtureDoTeste();
    const mix = await mixar(f.entradas);
    const resultado = await verificarMix(f.entradas, mix);

    expect(resultado.problemas).toEqual([]);
    expect(resultado.medicoes.cenas.length).toBeGreaterThanOrEqual(1);
    for (const cena of resultado.medicoes.cenas) {
      expect(cena.atenuacaoMedida_db).toBeLessThanOrEqual(-11); // ~ -12 dB
      expect(Math.abs(cena.atenuacaoMedida_db - cena.atenuacaoDeclarada_db)).toBeLessThanOrEqual(1);
      expect(cena.margemFalaMusica_db).toBeGreaterThanOrEqual(6);
      expect(cena.rmsFala).toBeGreaterThan(1e-3);
    }
    expect(resultado.medicoes.picoAbsoluto).toBeLessThanOrEqual(1.0);
    expect(resultado.medicoes.sobreposicaoMaxima_s).toBeLessThanOrEqual(0.1);
  });

  it("∅-crit original: um mix SEM locucao fica VERMELHO (V5)", async () => {
    const f = fixtureDoTeste();
    // Timing sem nenhuma cena de locucao (todas silenciosas) — valido.
    const timing: TimingCanonico = {
      ...f.entradas.timing,
      cenas: Object.fromEntries(
        Object.entries(f.entradas.timing.cenas).map(([id, entrada]) => [
          id,
          { ...entrada, estado: "silencio" as const, palavras: undefined, silencio: undefined, audio: undefined, texto: undefined },
        ]),
      ),
    };
    const envelope = calcularEnvelopeDucking({
      timing,
      posicoes: posicoesDaTimeline(f.entradas.manifesto),
    });
    const cadencia = cortarSilencio(timing);
    const mix = await mixar({ ...f.entradas, timing, envelope, cadencia });

    const resultado = await verificarMix(
      { ...f.entradas, timing, envelope, cadencia },
      mix,
    );
    expect(resultado.problemas.some((p) => p.startsWith("V5"))).toBe(true);
    expect(resultado.problemas.join("\n")).toMatch(/sem locucao/);
  });

  it("∅-crit C1: duas locucoes simultaneas por mais de 0,1 s ficam VERMELHO (V3)", async () => {
    const f = fixtureDoTeste();
    const mix = await mixar({
      ...f.entradas,
      opcoes: { ...f.entradas.opcoes, aplicarReconciliacao: false },
    });
    const resultado = await verificarMix(f.entradas, mix);

    expect(resultado.problemas.some((p) => p.startsWith("V3"))).toBe(true);
    expect(resultado.problemas.join("\n")).toMatch(/sobreposicao de fala/);
    expect(resultado.problemas.join("\n")).toMatch(/c-004/);
  });

  it("∅-crit C3: emenda enderecada pelo hash do audio-fonte fica VERMELHO (V4)", async () => {
    // Cadencia CORTANTE (gapAlvo 0.05): a emenda difere da fonte de
    // verdade, e endereca-la pelo hash da fonte e o falso-verde.
    const f = fixtureDoTeste(0.05);
    const mix = await mixar(f.entradas);

    // A emenda REAL ja difere da fonte (o caso legitimo).
    const c004 = mix.documento.faixas.locucao.find((x) => x.cena === "c-004")!;
    expect(c004.emenda_hash).not.toBe(c004.fonte_hash);

    // Mutacao: o documento passa a enderecar a emenda pelo hash da fonte.
    const documentoMentiroso = {
      ...mix.documento,
      faixas: {
        ...mix.documento.faixas,
        locucao: mix.documento.faixas.locucao.map((x) =>
          x.cena === "c-004" ? { ...x, emenda_hash: x.fonte_hash } : x,
        ),
      },
    };
    const resultado = await verificarMix(f.entradas, {
      ...mix,
      documento: documentoMentiroso,
    });

    expect(resultado.problemas.some((p) => p.startsWith("V4"))).toBe(true);
    expect(resultado.problemas.join("\n")).toMatch(/hash do\s*audio-FONTE|audio-FONTE/);
  });

  it("∅-crit C3: a emenda publicada precisa ser ENDERECAVEL (bytes novos no store)", async () => {
    const f = fixtureDoTeste(0.05);
    const mix = await mixar(f.entradas);
    // Remove os bytes da emenda do loader (nada publicado) — mas o
    // documento a endereca: os bytes "novos" nao existem.
    const porHash = new Map(f.porHash);
    for (const e of mix.emendas) {
      if (e.emendaHash !== e.fonteHash) porHash.delete(e.emendaHash);
    }
    const entradas = { ...f.entradas, carregarBytes: async (h: string) => porHash.get(h) ?? null };
    const resultado = await verificarMix(entradas, mix);

    expect(resultado.problemas.some((p) => p.startsWith("V4"))).toBe(true);
    expect(resultado.problemas.join("\n")).toMatch(/nao e enderecavel/);
  });

  it("∅-crit adversarial: o envelope NAO aplicado deixa a musica cobrir a locucao (V7)", async () => {
    const f = fixtureDoTeste();
    const mix = await mixar({
      ...f.entradas,
      opcoes: { ...f.entradas.opcoes, aplicarEnvelope: false },
    });
    const resultado = await verificarMix(f.entradas, mix);

    expect(resultado.problemas.some((p) => p.startsWith("V7"))).toBe(true);
    expect(resultado.problemas.join("\n")).toMatch(/envelope|ducking/);
  });

  it("∅-crit adversarial: mix que clipa nos bytes fica VERMELHO (V6)", async () => {
    const f = fixtureDoTeste();
    const mix = await mixar(f.entradas);
    const amostras = Float32Array.from(mix.pcm.amostras);
    amostras[100] = 1.5; // um sample acima de 0 dBFS
    const resultado = await verificarMix(f.entradas, {
      ...mix,
      pcm: { ...mix.pcm, amostras },
    });
    expect(resultado.problemas.some((p) => p.startsWith("V6"))).toBe(true);
    expect(resultado.problemas.join("\n")).toMatch(/clipa/);
  });

  it("reconciliacao C1 (pergunta 4): cena posterior manda — a rededucao do oraculo corta a cauda da anterior", () => {
    const f = fixtureDoTeste();
    const esperados = spansEsperados(f.entradas);
    const c004 = esperados.find((s) => s.cena === "c-004")!;
    const c005 = esperados.find((s) => s.cena === "c-005")!;
    expect(c004.fim_s).toBeCloseTo(c005.inicio_s, 6);
    expect(c004.inicio_s).toBeCloseTo(427 / 30, 6);
    expect(c005.inicio_s).toBeCloseTo(547 / 30, 6);
  });

  it("D3: com cadencia cortante, o envelope acompanha a fala EMENDADA (posicaoOriginal)", async () => {
    const f = fixtureDoTeste(0.05);
    const mix = await mixar(f.entradas);
    const c004 = mix.spans.find((s) => s.cena === "c-004")!;

    // A ultima palavra emendada de c-004 comeca em ~7,135 s locais
    // (fonte 7,935 - 0,68 de corte acumulado); o ganho nesse instante
    // emendado tem de ser o do instante FONTE correspondente (7,935),
    // nao o de 7,135 — a atenuacao acompanha a fala.
    const inicioUltimaPalavraEmendada = 7.935 - 0.68;
    const ganhoEmendado = ganhoAplicadoNo(
      f.entradas,
      mix,
      c004.inicio_s + inicioUltimaPalavraEmendada,
    );
    expect(ganhoEmendado).toBeLessThan(-11); // pleno ducking onde a fala existe
  });
});

// ─── Helpers do suite ──────────────────────────────────────────────────────────

function regiaoDiferente(
  a: { amostras: Float32Array; canais: number },
  b: { amostras: Float32Array; canais: number },
  aS: number,
  bS: number,
  rate: number,
): boolean {
  const inicio = Math.max(0, Math.floor(aS * rate)) * a.canais;
  const fim = Math.min(a.amostras.length, Math.ceil(bS * rate) * a.canais);
  for (let i = inicio; i < fim; i++) {
    if ((a.amostras[i] ?? 0) !== (b.amostras[i] ?? 0)) return true;
  }
  return false;
}

import { ganhoAplicado as ganhoAplicadoImpl } from "src/audio/mix/mixar.js";

function ganhoAplicadoNo(
  entradas: EntradasDoMix,
  mix: Awaited<ReturnType<typeof mixar>>,
  t: number,
): number {
  return ganhoAplicadoImpl(t, entradas.envelope, mix.spans);
}
