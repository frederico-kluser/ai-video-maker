/**
 * tests/sincronia/ducking.test.ts
 *
 * O ENVELOPE DE DUCKING — card F3-03 (W6). Quatro camadas:
 *
 *   1. ACEITACAO — a fixture canonica (timing commitado de F3-01 +
 *      posicoes da aritmetica da composicao, F1-12) produz um envelope
 *      VALIDO que cobre TODA a locucao e bate byte a byte com o golden
 *      commitado (tests/fixtures/ducking-canono.json).
 *
 *   2. ∅-CRIT — um trecho com locucao SEM atenuacao TEM de ficar
 *      vermelho: mutacao do envelope (patamar cortado, envelope vazio,
 *      ganho zero) tem de deixar `coberturaDoEnvelope` nao-vazio, e o
 *      oraculo (validar.ts) reprova documento com degrau, patamar
 *      invertido, rampa nula ou ganho nao-negativo.
 *
 *   3. ADVERSARIAL — as perguntas do card:
 *      (1) o envelope e CALCULADO (funcao pura do timing + posicoes) ou
 *          depende de um compressor cuja saida muda entre versoes?
 *          (mesma entrada, mesmos bytes; entrada diferente, bytes
 *          diferentes; golden byte a byte contra a versao anterior).
 *      (2) a atenuacao comeca ANTES da fala, ou em cima dela? (o patamar
 *          ja vale com folga no ataque da primeira palavra; a rampa de
 *          entrada termina antes).
 *      (3) dois trechos de fala colados produzem um degrau audivel?
 *          (intervalos colados sao fundidos; a funcao ganhoEm e continua
 *          nas emendas, verificada por amostragem).
 *      (4) o envelope e deterministico 2x? (bytes identicos).
 *
 * PERGUNTA OBRIGATORIA DA ONDA (contrato-w6 §10): nenhuma assercao fala
 * da LISTA COMPLETA de cenas, trechos ou intervalos de outro card. A
 * cobertura itera o timing de F3-01 — o contrato de ENTRADA, congelado,
 * que os irmaos nao editam — e as assercoes de fixture sao de PRESENCA:
 * a fala de c-004 tem intervalo, a de c-005 tambem. O golden (fixture
 * commitada) e a igualdade byte a byte vivem em `just ducking` via
 * tests/sincronia/ducking.ferramenta.ts --conferir, e aqui pela leitura
 * do golden.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { Manifesto } from "src/contratos/manifesto.js";
import type { Sha256 } from "src/resolucao/manifesto-resolvido.js";
import { lerTimingCanonico } from "src/sincronia/timing/validar.js";
import type { EntradaDeCena, IntervaloDeSilencio, TimingCanonico } from "src/sincronia/timing/formato.js";
import {
  DUCKING_GANHO_DB,
  DUCKING_FOLGA_ENTRADA_S,
  DUCKING_FOLGA_SAIDA_S,
  DUCKING_ATAQUE_S,
  DUCKING_RELEASE_S,
} from "src/sincronia/ducking/parametros.js";
import {
  FORMATO_ENVELOPE_DUCKING,
  MIME_ENVELOPE_DUCKING,
  hashDoEnvelopeDucking,
  serializarEnvelopeDucking,
} from "src/sincronia/ducking/formato.js";
import type { DuckingEnvelope } from "src/sincronia/ducking/formato.js";
import {
  EEnvelopeDuckingInvalido,
  lerEnvelopeDucking,
  validarEnvelopeDucking,
} from "src/sincronia/ducking/validar.js";
import {
  calcularEnvelopeDucking,
  coberturaDoEnvelope,
  ganhoEm,
  posicoesDaTimeline,
} from "src/sincronia/ducking/calcular.js";
import type { PosicoesDeCenas } from "src/sincronia/ducking/calcular.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const TIMING_CANONICO = "fixtures/canonico/timing-canono.json";
const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const GOLDEN_DUCKING = "tests/fixtures/ducking-canono.json";

function timingDaFixture(): TimingCanonico {
  return lerTimingCanonico(readFileSync(TIMING_CANONICO, "utf-8"));
}

function posicoesDaFixture(): PosicoesDeCenas {
  const manifesto = JSON.parse(
    readFileSync(MANIFESTO_CANONICO, "utf-8"),
  ) as Manifesto;
  return posicoesDaTimeline(manifesto);
}

function envelopeDaFixture(): DuckingEnvelope {
  return calcularEnvelopeDucking({
    timing: timingDaFixture(),
    posicoes: posicoesDaFixture(),
  });
}

// ─── Helpers de documento sintetico (para as sondas) ──────────────────────────

/** Uma entrada de locucao valida para o oraculo: palavras + silencio cobrindo [0, duracao]. */
function entradaLocucao(
  palavras: Array<{ i: number; f: number; t: string }>,
): EntradaDeCena {
  const silencio: IntervaloDeSilencio[] = [];
  let cursor = 0;
  for (const p of palavras) {
    if (p.i > cursor) silencio.push({ inicio_s: cursor, fim_s: p.i });
    cursor = Math.max(cursor, p.f);
  }
  const duracao_s = Math.max(cursor, palavras[palavras.length - 1]!.f);
  if (duracao_s > cursor) silencio.push({ inicio_s: cursor, fim_s: duracao_s });
  return {
    unidade: "segundos",
    estado: "locucao",
    audio: "ab".repeat(32) as Sha256,
    duracao_s,
    texto: palavras.map((p) => p.t).join(" "),
    palavras: palavras.map((p) => ({ texto: p.t, inicio_s: p.i, fim_s: p.f })),
    silencio,
  };
}

function docComCenas(cenas: Record<string, EntradaDeCena>): TimingCanonico {
  return {
    schema_version: "TimingCanonico.1",
    unidade: "segundos",
    cenas,
  };
}

// ─── 1. Aceitacao: a fixture canonica ───────────────────────────────────────────

describe("envelope de ducking — a fixture canonica (criterio 1)", () => {
  it("produz um envelope VALIDO (o oraculo fica em silencio)", () => {
    const envelope = envelopeDaFixture();
    expect(validarEnvelopeDucking(envelope)).toEqual([]);
    expect(envelope.schema_version).toBe(FORMATO_ENVELOPE_DUCKING);
    expect(envelope.unidade).toBe("segundos");
  });

  it("cobre TODA a locucao da fixture (lado verde do ∅-crit)", () => {
    const envelope = envelopeDaFixture();
    expect(coberturaDoEnvelope(envelope, timingDaFixture(), posicoesDaFixture())).toEqual([]);
  });

  it("o golden commitado bate byte a byte (regressao entre versoes)", () => {
    let golden: Buffer;
    try {
      golden = readFileSync(GOLDEN_DUCKING);
    } catch {
      expect.fail(`${GOLDEN_DUCKING} ausente — o golden nao se auto-grava; ` +
        "rode `just ducking-gravar` por ato explicito");
      return;
    }
    expect(serializarEnvelopeDucking(envelopeDaFixture()).equals(golden)).toBe(true);
  });

  it("determinismo 2x: dois calculos, bytes identicos", () => {
    const primeiro = serializarEnvelopeDucking(envelopeDaFixture());
    const segundo = serializarEnvelopeDucking(envelopeDaFixture());
    expect(primeiro.equals(segundo)).toBe(true);
  });

  it("o MIME do envelope nao e uma URL (guarda encontrarURLs)", () => {
    expect(MIME_ENVELOPE_DUCKING).not.toContain("://");
  });

  it("PERGUNTA DA ONDA: presenca — a fala de c-004 tem intervalo", () => {
    const envelope = envelopeDaFixture();
    // A primeira palavra ("Nesta") comeca no inicio absoluto de c-004 —
    // posicao da aritmetica da composicao (AB-520), nunca chute deste
    // teste. O patamar do intervalo tem de cobri-la — presenca do item
    // DESTE card, nao lista completa de cenas.
    const pos004 = posicoesDaFixture().get("c-004");
    expect(pos004).toBeDefined();
    const palavra = timingDaFixture().cenas["c-004"]?.palavras?.[0]!;
    const coberta = envelope.intervalos.some(
      (iv) =>
        iv.inicio_s <= pos004! + palavra.inicio_s + 1e-6 &&
        iv.fim_s >= pos004! + palavra.fim_s - 1e-6,
    );
    expect(coberta).toBe(true);
  });

  it("PERGUNTA DA ONDA: presenca — a fala de c-005 tem intervalo", () => {
    const envelope = envelopeDaFixture();
    const pos005 = posicoesDaFixture().get("c-005");
    expect(pos005).toBeDefined();
    const c005 = timingDaFixture().cenas["c-005"];
    const ultima = c005?.palavras?.at(-1);
    expect(ultima).toBeDefined();
    const coberta = envelope.intervalos.some(
      (iv) =>
        iv.inicio_s <= pos005! + ultima!.inicio_s + 1e-6 &&
        iv.fim_s >= pos005! + ultima!.fim_s - 1e-6,
    );
    expect(coberta).toBe(true);
  });
});

// ─── 2. ∅-crit: locucao sem atenuacao TEM de ficar vermelho ────────────────────

describe("envelope de ducking — ∅-crit (criterio 3)", () => {
  it("patamar cortado fora da fala deixa a palavra descoberta (VERMELHO)", () => {
    const envelope = envelopeDaFixture();
    const pos004 = posicoesDaFixture().get("c-004")!;
    // Corte: o patamar comeca 10s depois do inicio da cena — a fala de
    // c-004 (que comeca no inicio da cena) fica sem atenuacao. O
    // documento continua "valido" para o oraculo (um intervalo so); a
    // sonda de cobertura e que acusa.
    const mutado: DuckingEnvelope = {
      ...envelope,
      intervalos: [{ ...envelope.intervalos[0]!, inicio_s: pos004 + 10.0 }],
    };
    const descobertas = coberturaDoEnvelope(mutado, timingDaFixture(), posicoesDaFixture());
    expect(descobertas.length).toBeGreaterThan(0);
    expect(descobertas.join("\n")).toContain("Nesta");
  });

  it("envelope vazio deixa toda a locucao descoberta (VERMELHO)", () => {
    const envelope = envelopeDaFixture();
    const vazio: DuckingEnvelope = { ...envelope, intervalos: [] };
    expect(coberturaDoEnvelope(vazio, timingDaFixture(), posicoesDaFixture()).length).toBeGreaterThan(0);
  });

  it("intervalo com ganho zero NAO e atenuacao (VERMELHO)", () => {
    const envelope = envelopeDaFixture();
    const comGanhoZero: DuckingEnvelope = {
      ...envelope,
      intervalos: [{ ...envelope.intervalos[0]!, ganho_db: 0 }],
    };
    const descobertas = coberturaDoEnvelope(comGanhoZero, timingDaFixture(), posicoesDaFixture());
    expect(descobertas.length).toBeGreaterThan(0);
    // E o oraculo tambem reprova: ganho zero nao e atenuacao.
    expect(validarEnvelopeDucking(comGanhoZero).join("\n")).toContain("nao e atenuacao");
  });

  it("∅-crit pelo oraculo: documento com degrau entre intervalos e rejeitado", () => {
    // Dois intervalos cujas rampas se sobrepoem — o ganho mudaria de
    // valor no meio de uma rampa. O documento nao pode existir.
    const comDegrau: DuckingEnvelope = {
      schema_version: FORMATO_ENVELOPE_DUCKING,
      unidade: "segundos",
      intervalos: [
        { inicio_s: 1.0, fim_s: 2.0, ganho_db: -12, rampa_entrada_s: 0.1, rampa_saida_s: 0.5 },
        { inicio_s: 2.2, fim_s: 3.0, ganho_db: -12, rampa_entrada_s: 0.5, rampa_saida_s: 0.2 },
      ],
    };
    const problemas = validarEnvelopeDucking(comDegrau);
    expect(problemas.join("\n")).toContain("degrau");
    expect(() => lerEnvelopeDucking(serializarEnvelopeDucking(comDegrau))).toThrow(
      EEnvelopeDuckingInvalido,
    );
  });

  it("∅-crit pelo oraculo: patamar invertido, rampa nula e ganho positivo sao rejeitados", () => {
    const base = envelopeDaFixture().intervalos[0]!;
    const casos: Array<[string, DuckingEnvelope]> = [
      [
        "patamar invertido",
        { ...base, inicio_s: 30, fim_s: 20 } as unknown as DuckingEnvelope,
      ],
      [
        "rampa de entrada nula (degrau)",
        { ...base, rampa_entrada_s: 0 } as unknown as DuckingEnvelope,
      ],
      [
        "rampa de saida nula (degrau)",
        { ...base, rampa_saida_s: 0 } as unknown as DuckingEnvelope,
      ],
      [
        "ganho positivo (nao e atenuacao)",
        { ...base, ganho_db: 3 } as unknown as DuckingEnvelope,
      ],
    ];
    for (const [nome, doc] of casos) {
      const envelope = { ...base, intervalos: [doc] } as unknown as DuckingEnvelope;
      expect(validarEnvelopeDucking(envelope).length, nome).toBeGreaterThan(0);
    }
  });

  it("∅-crit: cena silenciosa nao inventa atenuacao (e nao fica descoberta)", () => {
    // As cenas c-001..c-003 sao silencio DECLARADO: o envelope nao gera
    // intervalo para elas, e a cobertura continua vazia — silencio sem
    // atenuacao e o desenho, locucao sem atenuacao e o ∅-crit.
    const envelope = envelopeDaFixture();
    const silenciosas = ["c-001", "c-002", "c-003"];
    for (const id of silenciosas) {
      const cobertaPorIntervalo = envelope.intervalos.some((iv) => iv.cena === id);
      expect(cobertaPorIntervalo, `cena ${id}`).toBe(false);
    }
    expect(coberturaDoEnvelope(envelope, timingDaFixture(), posicoesDaFixture())).toEqual([]);
  });
});

// ─── 3. Adversarial (1): calculado, nunca compressor ───────────────────────────

describe("envelope de ducking — adversarial (1): CALCULADO, nao compressor", () => {
  it("mesma entrada, mesmos bytes — funcao pura do timing e das posicoes", () => {
    const a = serializarEnvelopeDucking(
      calcularEnvelopeDucking({ timing: timingDaFixture(), posicoes: posicoesDaFixture() }),
    );
    const b = serializarEnvelopeDucking(
      calcularEnvelopeDucking({ timing: timingDaFixture(), posicoes: posicoesDaFixture() }),
    );
    expect(a.equals(b)).toBe(true);
  });

  it("entrada diferente, bytes diferentes — a saida depende das entradas declaradas", () => {
    const base = calcularEnvelopeDucking({ timing: timingDaFixture(), posicoes: posicoesDaFixture() });
    // Deslocar c-004 em +1s na timeline absoluta tem de mudar o envelope
    // (prova de que ele e funcao das posicoes, nao de estado escondido).
    const posicoesDeslocadas = new Map(posicoesDaFixture());
    posicoesDeslocadas.set("c-004", 17.0);
    const deslocado = calcularEnvelopeDucking({ timing: timingDaFixture(), posicoes: posicoesDeslocadas });
    expect(
      serializarEnvelopeDucking(base).equals(serializarEnvelopeDucking(deslocado)),
    ).toBe(false);
  });

  it("a leitura por bytes (lerEnvelopeDucking) devolve o mesmo documento", () => {
    const envelope = envelopeDaFixture();
    const relido = lerEnvelopeDucking(serializarEnvelopeDucking(envelope));
    expect(validarEnvelopeDucking(relido)).toEqual([]);
    expect(relido.intervalos[0]!.inicio_s).toBe(envelope.intervalos[0]!.inicio_s);
  });
});

// ─── 4. Adversarial (2): a atenuacao comeca ANTES da fala ─────────────────────

describe("envelope de ducking — adversarial (2): atenuacao antes da fala", () => {
  it("o patamar ja vale com folga no ataque da primeira palavra", () => {
    const envelope = envelopeDaFixture();
    const intervalo = envelope.intervalos[0]!;
    // A primeira palavra de c-004 comeca no inicio absoluto da cena
    // (posicao da aritmetica da composicao, AB-520).
    const inicioFala = posicoesDaFixture().get("c-004")!;
    expect(intervalo.inicio_s).toBeLessThan(inicioFala);
    expect(inicioFala - intervalo.inicio_s).toBeCloseTo(DUCKING_FOLGA_ENTRADA_S, 9);

    // No instante do ataque da palavra o ganho ja e pleno.
    expect(ganhoEm(envelope, inicioFala)).toBe(DUCKING_GANHO_DB);
    // A atenuacao ativa antes da fala (meio da rampa de entrada).
    expect(ganhoEm(envelope, intervalo.inicio_s - DUCKING_ATAQUE_S / 2)).toBeLessThan(0);
    // Antes da rampa de entrada, nada.
    expect(ganhoEm(envelope, intervalo.inicio_s - DUCKING_ATAQUE_S - 1e-6)).toBe(0);
  });

  it("a rampa de entrada termina ANTES do inicio da fala (cobre o ataque)", () => {
    const envelope = envelopeDaFixture();
    const intervalo = envelope.intervalos[0]!;
    const fimDaRampa = intervalo.inicio_s; // a rampa termina no inicio do patamar
    const inicioFala = posicoesDaFixture().get("c-004")!;
    expect(fimDaRampa).toBeLessThanOrEqual(inicioFala + 1e-9);
    // No ataque da palavra a rampa ja terminou: ganho pleno.
    expect(ganhoEm(envelope, inicioFala + 1e-9)).toBe(DUCKING_GANHO_DB);
  });

  it("a folga de saida mantem o patamar depois da ultima palavra", () => {
    const envelope = envelopeDaFixture();
    const intervalo = envelope.intervalos[0]!;
    const pos005 = posicoesDaFixture().get("c-005")!;
    const ultima = timingDaFixture().cenas["c-005"]?.palavras?.at(-1)!;
    const fimFala = pos005 + ultima.fim_s; // fim absoluto da ultima palavra
    expect(intervalo.fim_s).toBeGreaterThan(fimFala);
    expect(intervalo.fim_s - fimFala).toBeCloseTo(DUCKING_FOLGA_SAIDA_S, 9);
    expect(ganhoEm(envelope, fimFala)).toBe(DUCKING_GANHO_DB);
  });
});

// ─── 5. Adversarial (3): trechos colados nao produzem degrau ───────────────────

describe("envelope de ducking — adversarial (3): sem degrau em trechos colados", () => {
  it("falas coladas da fixture fundem em UM intervalo", () => {
    const envelope = envelopeDaFixture();
    const pos004 = posicoesDaFixture().get("c-004")!;
    const pos005 = posicoesDaFixture().get("c-005")!;
    const ultimaC005 = timingDaFixture().cenas["c-005"]?.palavras?.at(-1)!;
    // c-004 (fala ate pos004 + 8.505s) e c-005 (fala a partir de pos005)
    // tem rampas sobrepostas — a fusao tem de produzir um patamar unico.
    expect(envelope.intervalos).toHaveLength(1);
    const intervalo = envelope.intervalos[0]!;
    expect(intervalo.inicio_s).toBeCloseTo(pos004 - DUCKING_FOLGA_ENTRADA_S, 9);
    expect(intervalo.fim_s).toBeCloseTo(pos005 + ultimaC005.fim_s + DUCKING_FOLGA_SAIDA_S, 9);
    // Onde o intervalo antigo de c-004 terminaria (fim da fala de c-004
    // mais folga de saida), o ganho continua pleno — nada de rampa de
    // saida no meio das falas.
    expect(ganhoEm(envelope, pos004 + 8.505 + DUCKING_FOLGA_SAIDA_S)).toBe(DUCKING_GANHO_DB);
  });

  it("a funcao ganhoEm e continua em toda a linha do tempo da fixture", () => {
    const envelope = envelopeDaFixture();
    const intervalo = envelope.intervalos[0]!;
    const pontos = [
      intervalo.inicio_s - intervalo.rampa_entrada_s, // inicio da rampa
      intervalo.inicio_s,                             // fim da rampa / patamar
      intervalo.fim_s,                                // fim do patamar
      intervalo.fim_s + intervalo.rampa_saida_s,      // fim da rampa de saida
    ];
    for (const t of pontos) {
      const antes = ganhoEm(envelope, t - 1e-6);
      const depois = ganhoEm(envelope, t + 1e-6);
      expect(Math.abs(antes - depois), `descontinuidade em ${t}s`).toBeLessThan(1e-3);
    }
  });

  it("duas falas separadas por lacuna longa: dois intervalos, emenda a 0 dB", () => {
    const doc = docComCenas({
      "c-a": entradaLocucao([
        { i: 0.5, f: 1.0, t: "um" },
        { i: 1.2, f: 1.5, t: "dois" },
      ]),
      "c-b": entradaLocucao([
        { i: 0.5, f: 1.0, t: "tres" },
        { i: 1.2, f: 1.5, t: "quatro" },
      ]),
    });
    const posicoes = new Map<string, number>([
      ["c-a", 0],
      ["c-b", 10],
    ]);
    const envelope = calcularEnvelopeDucking({ timing: doc, posicoes });
    expect(validarEnvelopeDucking(envelope)).toEqual([]);
    expect(envelope.intervalos).toHaveLength(2);

    const primeiro = envelope.intervalos[0]!;
    const segundo = envelope.intervalos[1]!;
    expect(primeiro.fim_s).toBeCloseTo(1.7, 9);
    expect(segundo.inicio_s).toBeCloseTo(10.4, 9);

    // Emenda: o fim da rampa de saida do primeiro e o inicio da rampa
    // de entrada do segundo valem os dois 0 dB — sem degrau (tolerancia
    // de ponto flutuante na fronteira exata da rampa).
    expect(ganhoEm(envelope, primeiro.fim_s + primeiro.rampa_saida_s)).toBeCloseTo(0, 9);
    expect(ganhoEm(envelope, segundo.inicio_s - segundo.rampa_entrada_s)).toBeCloseTo(0, 9);
    // A rampa e LINEAR: meio da rampa de saida = metade do ganho.
    expect(ganhoEm(envelope, primeiro.fim_s + primeiro.rampa_saida_s / 2)).toBeCloseTo(
      DUCKING_GANHO_DB / 2,
      9,
    );
    // Entre os intervalos: plataforma de 0 dB.
    expect(ganhoEm(envelope, 2.0)).toBe(0);
    expect(ganhoEm(envelope, 10.0)).toBe(0);
  });

  it("duas falas com silencio CURTO fundem em um intervalo so", () => {
    const doc = docComCenas({
      "c-a": entradaLocucao([{ i: 0.5, f: 1.0, t: "um" }]),
      "c-b": entradaLocucao([{ i: 0.3, f: 0.95, t: "dois" }]),
    });
    const posicoes = new Map<string, number>([
      ["c-a", 0],
      ["c-b", 1.05], // segunda fala comeca 0.35s apos o fim da primeira
    ]);
    const envelope = calcularEnvelopeDucking({ timing: doc, posicoes });
    expect(validarEnvelopeDucking(envelope)).toEqual([]);
    expect(envelope.intervalos).toHaveLength(1);
    const intervalo = envelope.intervalos[0]!;
    expect(intervalo.inicio_s).toBeCloseTo(0.4, 9);
    expect(intervalo.fim_s).toBeCloseTo(2.2, 9);
  });
});

// ─── 6. Adversarial (4): determinismo 2x ───────────────────────────────────────

describe("envelope de ducking — adversarial (4): determinismo 2x", () => {
  it("dois processamentos produzem bytes identicos (fixture canonica)", () => {
    const bytes1 = serializarEnvelopeDucking(envelopeDaFixture());
    const bytes2 = serializarEnvelopeDucking(envelopeDaFixture());
    expect(bytes1.equals(bytes2)).toBe(true);
    expect(bytes1.toString("utf-8")).toBe(bytes2.toString("utf-8"));
  });

  it("dois processamentos produzem bytes identicos (documento sintetico)", () => {
    const doc = docComCenas({
      "c-a": entradaLocucao([{ i: 0.5, f: 1.0, t: "um" }]),
    });
    const posicoes = new Map<string, number>([["c-a", 0]]);
    const bytes1 = serializarEnvelopeDucking(
      calcularEnvelopeDucking({ timing: doc, posicoes }),
    );
    const bytes2 = serializarEnvelopeDucking(
      calcularEnvelopeDucking({ timing: doc, posicoes }),
    );
    expect(bytes1.equals(bytes2)).toBe(true);
  });

  it("o hash do envelope e estavel entre processamentos", () => {
    // O hash e a chave de cache que o F3-05 (W7) usara.
    expect(hashDoEnvelopeDucking(envelopeDaFixture())).toMatch(/^[0-9a-f]{64}$/);
  });
});
