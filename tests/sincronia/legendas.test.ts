/**
 * tests/sincronia/legendas.test.ts
 *
 * LEGENDAS A PARTIR DO TIMING — card F3-02 (W6). Quatro camadas:
 *
 *   1. ACEITACAO — a fixture canonica (manifesto-valido.json + cassete de
 *      locucao COMMITADO, via replay offline) produz um documento de
 *      legendas VALIDO, com o invariante de duracao em SEGUNDOS.
 *
 *   2. ∅-CRIT — APAGAR A REGRA DE CARACTERES-POR-SEGUNDO tem de ficar
 *      VERMELHO: uma legenda que passa no piso absoluto (0,833 s) mas
 *      falha em caracteres/20 TEM de ser reprovada pelo oraculo. Se a
 *      clausula `caracteres / maxCpsAdult` sumir de validar.ts, este
 *      teste falha.
 *
 *   3. SEGUNDOS, NUNCA FRAMES — o teste prova que uma conversao errada
 *      para frames fica VERMELHA: a 60 fps, "20 frames" valem 0,333 s —
 *      QUATRO VEZES abaixo do piso de 0,833 s. Uma legenda de 0,4 s que
 *      uma reescrita em frames aprovaria TEM de ser reprovada aqui.
 *
 *   4. ADVERSARIAL — as perguntas do card:
 *      (1) uma legenda viola o minimo ou o maximo de duracao da norma?
 *      (2) existe caminho em que a legenda aparece ANTES da palavra?
 *      (3) a paginacao estoura a safe area em vertical?
 *      (4) o invariante e em SEGUNDOS (provado por teste)?
 *
 * PERGUNTA OBRIGATORIA DA ONDA (contrato-w6 §10): nenhuma assercao abaixo
 * fala da LISTA COMPLETA de cenas, de legendas ou de trechos. Tudo e
 * presenca do item DESTE card: `c-004` tem legendas, `c-001` (silenciosa)
 * nao tem — o resto do pipeline pode crescer no merge dos irmaos sem
 * derrubar isto. (A igualdade byte a byte com o golden vive na receita
 * `legendas` via tools/legendas/gerar.ts --conferir, nao aqui.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import type { Manifesto, No, Cena } from "src/contratos/manifesto.js";
import type { ParcialResolvido, Sha256 } from "src/resolucao/manifesto-resolvido.js";
import { reproduzirLocucao } from "src/resolucao/locucao/replay.js";
import { join } from "node:path";
import { RAIZ_CASSETES_PADRAO } from "src/resolucao/cassete/formato.js";
import { calcularDuracao } from "src/composicao/tempo.js";
import {
  maxCharsPerLine,
  maxCpsAdult,
  maxLines,
  maxTextDurationSeconds,
  minTextDurationSeconds,
} from "src/design/tokens.js";
import { construirTimingCanonico } from "src/sincronia/timing/construir.js";
import type { CarregarBytes } from "src/sincronia/timing/construir.js";
import type { EntradaDeCena, TimingCanonico } from "src/sincronia/timing/formato.js";
import { lerTimingCanonico, validarTimingCanonico } from "src/sincronia/timing/validar.js";
import { construirLegendas } from "src/sincronia/legendas/construir.js";
import { serializarLegendas } from "src/sincronia/legendas/formato.js";
import type { LegendasCanonicas } from "src/sincronia/legendas/formato.js";
import {
  alturaDoBlocoDeLegenda,
  caixaVerticalUtil,
  validarLegendas,
} from "src/sincronia/legendas/validar.js";

const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

function manifestoCanonico(): Manifesto {
  return JSON.parse(readFileSync(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
}

/**
 * Reconstroi a parcial e o carregador a partir do cassete COMMITADO —
 * a MESMA fonte dos bytes do contrato (replay offline, AB-523): os
 * bytes do timing canonico vencem do cassete, nunca do store por hash.
 */
async function parcialDoCassete(): Promise<{
  manifesto: Manifesto;
  parcial: Pick<ParcialResolvido, "assets" | "nos_locucao">;
  carregar: CarregarBytes;
}> {
  const manifesto = manifestoCanonico();
  const reprod = await reproduzirLocucao(manifesto);
  const gravado = JSON.parse(
    readFileSync(join(RAIZ_CASSETES_PADRAO, "locucao", reprod.chave, "resultado.json"), "utf-8"),
  ) as { assets: Record<string, unknown>; nos_locucao: Record<string, string> };

  const porHash = new Map<string, { bytesTiming: Buffer; audio: Buffer; hashTiming: string; hashAudio: string }>();
  for (const u of reprod.unidades) {
    porHash.set(u.hashTiming, u);
    porHash.set(u.hashAudio, u);
  }

  return {
    manifesto,
    parcial: {
      assets: gravado.assets as ParcialResolvido["assets"],
      nos_locucao: gravado.nos_locucao,
    },
    carregar: (hash) => {
      const u = porHash.get(hash);
      if (u === undefined) return null;
      return hash === u.hashTiming ? u.bytesTiming : u.audio;
    },
  };
}

/** O timing canonico da fixture, pelos bytes do replay (contrato §2). */
async function timingDaFixture(): Promise<TimingCanonico> {
  const { manifesto, parcial, carregar } = await parcialDoCassete();
  const doc = await construirTimingCanonico({ manifesto, parcial, carregar });
  const bytes = Buffer.from(JSON.stringify(doc), "utf-8");
  return lerTimingCanonico(bytes);
}

const HASH_AUDIO = "ab".repeat(32) as Sha256;

// ─── Documentos sinteticos (para as sondas do oraculo) ────────────────────────

/** Uma palavra com tempo relativo ao audio da cena. */
interface PalavraDeTeste {
  readonly texto: string;
  readonly inicio_s: number;
  readonly fim_s: number;
}

/** Monta a entrada canonica de locucao com o silencio declarado exato. */
function entradaDeLocucao(
  palavras: readonly PalavraDeTeste[],
  duracao_s: number,
): EntradaDeCena {
  const silencio: Array<{ inicio_s: number; fim_s: number }> = [];
  let cursor = 0;
  for (const p of palavras) {
    if (p.inicio_s > cursor) {
      silencio.push({ inicio_s: cursor, fim_s: p.inicio_s });
    }
    cursor = Math.max(cursor, p.fim_s);
  }
  if (duracao_s > cursor) {
    silencio.push({ inicio_s: cursor, fim_s: duracao_s });
  }
  return {
    unidade: "segundos",
    estado: "locucao",
    audio: HASH_AUDIO,
    duracao_s,
    texto: palavras.map((p) => p.texto).join(" "),
    palavras: palavras.map((p) => ({ texto: p.texto, inicio_s: p.inicio_s, fim_s: p.fim_s })),
    silencio,
  };
}

/**
 * Contexto sintetico minimo e valido: uma cena de 30 s com um no, e uma
 * entrada de locucao de 4 s com palavras folgadas.
 */
function contextoBase(): {
  manifesto: Manifesto;
  timing: TimingCanonico;
  cenaInicioAbs: number;
} {
  const no: No = {
    id: "n-teste",
    schema: "Cabecalho.1",
    type: "cabecalho",
    texto: "teste",
    duracao_frames: 900, // 30 s a 30 fps
  };
  const cena: Cena = {
    id: "c-teste",
    nos: ["n-teste"],
    audio_cena: { hash_locucao: HASH_AUDIO, texto_locucao: "uma frase de teste" },
  };
  const manifesto: Manifesto = {
    schema_version: "Manifesto.1",
    fps: 30,
    width: 1920,
    height: 1080,
    nos: [no],
    cenas: [cena],
  };
  const timing: TimingCanonico = {
    schema_version: "TimingCanonico.1",
    unidade: "segundos",
    cenas: {
      "c-teste": entradaDeLocucao(
        [
          { texto: "uma", inicio_s: 0.5, fim_s: 1.0 },
          { texto: "frase", inicio_s: 1.5, fim_s: 2.0 },
          { texto: "de", inicio_s: 2.5, fim_s: 2.7 },
          { texto: "teste.", inicio_s: 3.0, fim_s: 4.0 },
        ],
        4,
      ),
    },
  };
  return { manifesto, timing, cenaInicioAbs: 0 };
}

/** Um documento de legendas valido e minimal (uma legenda de 3 s). */
function docBase(): LegendasCanonicas {
  return {
    schema_version: "LegendasCanonicas.1",
    unidade: "segundos",
    legendas: [
      {
        cena: "c-teste",
        unidade: "segundos",
        audio: HASH_AUDIO,
        inicio_s: 0.5,
        fim_s: 3.5,
        linhas: ["uma frase de teste."],
        texto: "uma frase de teste.",
        caracteres: "uma frase de teste.".length,
      },
    ],
  };
}

// ─── 1. Aceitacao: a fixture canonica ───────────────────────────────────────────

describe("legendas — a fixture canonica (criterio 1)", () => {
  it("produz um documento valido com o invariante em SEGUNDOS", async () => {
    const manifesto = manifestoCanonico();
    const timing = await timingDaFixture();
    const doc = construirLegendas(manifesto, timing);

    expect(validarLegendas(doc, { manifesto, timing })).toEqual([]);

    // O invariante, conferido POR LEGENDA em segundos — nunca em frames:
    //   piso = max(0,833 s; caracteres/20) ; teto = 7 s.
    for (const legenda of doc.legendas) {
      const duracao = legenda.fim_s - legenda.inicio_s;
      const piso = Math.max(minTextDurationSeconds, legenda.caracteres / maxCpsAdult);
      expect(duracao).toBeGreaterThanOrEqual(piso - 1e-6);
      expect(duracao).toBeLessThanOrEqual(maxTextDurationSeconds + 1e-6);
      expect(legenda.linhas.length).toBeLessThanOrEqual(maxLines);
      for (const linha of legenda.linhas) {
        expect(linha.length).toBeLessThanOrEqual(maxCharsPerLine);
      }
    }
  });

  it("PERGUNTA DA ONDA: presenca — c-004 (locucao) tem legendas; c-001 (silencio) nao", async () => {
    const manifesto = manifestoCanonico();
    const timing = await timingDaFixture();
    const doc = construirLegendas(manifesto, timing);

    // Presenca do item DESTE card — nunca lista completa de cenas.
    const deC004 = doc.legendas.filter((l) => l.cena === "c-004");
    expect(deC004.length).toBeGreaterThan(0);
    const deC001 = doc.legendas.filter((l) => l.cena === "c-001");
    expect(deC001).toEqual([]);

    // Consumo por CONTEUDO: a legenda carrega o mesmo `audio` da entrada
    // de timing da cena — o endereco por hash, nunca posicao.
    const entradaC004 = timing.cenas["c-004"];
    expect(entradaC004?.estado).toBe("locucao");
    for (const legenda of deC004) {
      expect(legenda.audio).toBe(entradaC004?.audio);
    }
  });

  it("a legenda nunca comeca antes da cena nem sai da FALA dela, em tempo ABSOLUTO", async () => {
    const manifesto = manifestoCanonico();
    const timing = await timingDaFixture();
    const doc = construirLegendas(manifesto, timing);

    const timeline = calcularDuracao(manifesto);
    const posicaoC004 = timeline.timeline.find((t) => t.cenaId === "c-004");
    expect(posicaoC004).toBeDefined();

    const inicioCenaAbs = (posicaoC004?.frameInicial ?? 0) / manifesto.fps;
    // O limite da legenda e o FIM DO AUDIO da cena (a legenda descreve a
    // fala — ver decisao no ADR-0027). A janela visual da composicao de
    // c-004 (4 s) e mais curta que a fala (8,505 s) — AB-58x no ledger.
    const entradaC004 = timing.cenas["c-004"];
    expect(entradaC004?.estado).toBe("locucao");
    const fimDoAudioAbs = inicioCenaAbs + (entradaC004?.duracao_s ?? 0);

    const deC004 = doc.legendas.filter((l) => l.cena === "c-004");
    for (const legenda of deC004) {
      expect(legenda.inicio_s).toBeGreaterThanOrEqual(inicioCenaAbs - 1e-6);
      expect(legenda.fim_s).toBeLessThanOrEqual(fimDoAudioAbs + 1e-6);
    }

    // A primeira palavra de c-004 comeca no byte zero do audio = inicio
    // da cena; a primeira legenda nasce exatamente ai — nunca antes.
    expect(deC004[0]?.inicio_s).toBeCloseTo(inicioCenaAbs, 6);
  });

  it("determinismo: duas construcoes produzem os MESMOS bytes", async () => {
    const manifesto = manifestoCanonico();
    const timing = await timingDaFixture();
    const a = serializarLegendas(construirLegendas(manifesto, timing));
    const b = serializarLegendas(construirLegendas(manifesto, timing));
    expect(a).toEqual(b);
  });
});

// ─── 2. ∅-crit: apagar a regra de caracteres-por-segundo fica VERMELHO ─────────

describe("legendas — ∅-crit: a regra de caracteres-por-segundo", () => {
  it("uma legenda que passa no piso absoluto mas falha em caracteres/20 e REJEITADA", () => {
    const { manifesto, timing } = contextoBase();

    // 49 caracteres => piso de leitura 49/20 = 2,45 s, bem acima do piso
    // absoluto de 0,833 s. A legenda dura 1,0 s: passa no piso absoluto,
    // falha no de leitura. Sem a clausula `caracteres / maxCpsAdult` em
    // validar.ts, este documento passaria — e o ∅-crit fica VERMELHO.
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.5,
          fim_s: 1.5,
          linhas: ["Nesta seção, apresentamos os dados de desempenho"],
          texto: "Nesta seção, apresentamos os dados de desempenho",
          caracteres: "Nesta seção, apresentamos os dados de desempenho".length,
        },
      ],
    };

    const problemas = validarLegendas(doc, { manifesto, timing });
    const doCps = problemas.filter((p) => p.includes("CPS") || p.includes("caracteres /"));
    expect(doCps.length).toBeGreaterThan(0);
    // O problema nomeia a regra: piso de leitura, nao "invalido" generico.
    expect(doCps[0]).toContain("caracteres /");
  });
});

// ─── 3. SEGUNDOS, NUNCA FRAMES — o invariante prova a conversao errada ─────────

describe("legendas — o invariante e em SEGUNDOS, nunca em frames", () => {
  it("a 60 fps, '20 frames' valem 0,333 s — quatro vezes abaixo do piso de 0,833 s", () => {
    // A armadilha que este card existe para pegar: num manifesto
    // frame-based, reescrever o piso em frames e conveniente — e 20
    // frames a 60 fps sao 0,333 s, quatro vezes abaixo do piso real.
    const pisoFramesA60Fps = 20 / 60; // 0,333... s
    expect(pisoFramesA60Fps).toBeLessThan(minTextDurationSeconds / 2);
    expect(pisoFramesA60Fps).toBeLessThan(minTextDurationSeconds);
  });

  it("legenda de 0,4 s (que uma reescrita em frames a 60 fps aprovaria) e REJEITADA", () => {
    const { manifesto, timing } = contextoBase();

    // 4 caracteres => piso de leitura 4/20 = 0,2 s. Em SEGUNDOS o piso e
    // max(0,833; 0,2) = 0,833 s: 0,4 s falha. Reescrita em frames a 60
    // fps: max(20/60; 0,2) = 0,333 s — 0,4 s passaria em silencio.
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.5,
          fim_s: 0.9, // 0,4 s de duracao
          linhas: ["sim!"],
          texto: "sim!",
          caracteres: 4,
        },
      ],
    };

    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("abaixo do piso"))).toBe(true);
    expect(problemas.some((p) => p.includes("CPS"))).toBe(true);
  });

  it("nenhum numero do invariante e literal: tudo vem dos tokens (S-5)", async () => {
    const manifesto = manifestoCanonico();
    const timing = await timingDaFixture();
    const doc = construirLegendas(manifesto, timing);
    // A suite inteira prova o invariante pelos TOKENS — um literal
    // redeclarado em validar.ts seria reprovado por design-varrer, e uma
    // troca de valores (plataforma/idioma) tem de valer aqui sem editar
    // codigo de composicao.
    expect(minTextDurationSeconds).toBe(0.833);
    expect(maxTextDurationSeconds).toBe(7);
    expect(maxCpsAdult).toBe(20);
    expect(doc.legendas.length).toBeGreaterThan(0);
  });
});

// ─── 4. Adversarial: as tres perguntas do card ─────────────────────────────────

describe("legendas — adversarial (1): minimo e maximo da norma", () => {
  it("legenda abaixo do piso absoluto e REJEITADA", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.5,
          fim_s: 1.3, // 0,8 s < 0,833 s
          linhas: ["x"],
          texto: "x",
          caracteres: 1,
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("abaixo do piso"))).toBe(true);
  });

  it("legenda acima do teto da norma e REJEITADA", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.5,
          fim_s: 8.5, // 8,0 s > 7 s
          linhas: ["uma frase de teste."],
          texto: "uma frase de teste.",
          caracteres: "uma frase de teste.".length,
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("acima do teto"))).toBe(true);
  });

  it("legenda fora da cena e REJEITADA", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 20, // a cena so vai ate 30 s, mas a fala termina em 4 s
          fim_s: 23,
          linhas: ["uma frase de teste."],
          texto: "uma frase de teste.",
          caracteres: "uma frase de teste.".length,
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("inicio de nenhuma palavra"))).toBe(true);
  });
});

describe("legendas — adversarial (2): legenda ANTES da palavra", () => {
  it("legenda que comeca antes da primeira palavra e REJEITADA", () => {
    const { manifesto, timing } = contextoBase();
    // A primeira palavra comeca em 0,5 s; a legenda comeca em 0,2 s.
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.2,
          fim_s: 3.0,
          linhas: ["uma frase de teste."],
          texto: "uma frase de teste.",
          caracteres: "uma frase de teste.".length,
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("antes da primeira palavra"))).toBe(true);
  });

  it("legenda que nasce no meio de uma palavra e REJEITADA", () => {
    const { manifesto, timing } = contextoBase();
    // 1,2 s nao e o inicio de nenhuma palavra (0,5 / 1,5 / 2,5 / 3,0).
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 1.2,
          fim_s: 3.5,
          linhas: ["frase de teste."],
          texto: "frase de teste.",
          caracteres: "frase de teste.".length,
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("inicio de nenhuma palavra"))).toBe(true);
  });

  it("o CONSTRUTOR nunca produz legenda antes da palavra (folga so no fim)", async () => {
    const manifesto = manifestoCanonico();
    const timing = await timingDaFixture();
    const doc = construirLegendas(manifesto, timing);

    const timeline = calcularDuracao(manifesto);
    const porCena = new Map(timeline.timeline.map((t) => [t.cenaId, t]));
    for (const legenda of doc.legendas) {
      const entrada = timing.cenas[legenda.cena];
      const posicao = porCena.get(legenda.cena);
      if (entrada?.estado !== "locucao" || posicao === undefined) continue;
      const inicioCenaAbs = posicao.frameInicial / manifesto.fps;
      const palavras = entrada.palavras ?? [];
      if (palavras.length === 0) continue;
      const inicioPrimeiraPalavraAbs = inicioCenaAbs + (palavras[0]?.inicio_s ?? 0);
      expect(legenda.inicio_s).toBeGreaterThanOrEqual(inicioPrimeiraPalavraAbs - 1e-6);
    }
  });
});

describe("legendas — adversarial (3): paginacao x safe area em vertical", () => {
  it("o bloco teorico de maxLines linhas cabe nas safe areas 16:9 e 9:16", () => {
    // A paginacao e limitada por construcao a `maxLines` linhas; o bloco
    // teorico (fonte caption x lineHeight normal, dos tokens) tem de
    // caber nas duas safe areas que o projeto conhece. Se `maxLines`
    // subir para 3 (a NBR 15290:2016 permite quando a edicao exigir),
    // este invariante e quem avisa.
    for (const resolucao of [
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
    ]) {
      const caixa = caixaVerticalUtil(resolucao);
      expect(caixa).not.toBeNull();
      const bloco = alturaDoBlocoDeLegenda(maxLines, resolucao);
      expect(bloco).toBeLessThanOrEqual((caixa as { altura: number }).altura);
    }
  });

  it("legenda com mais de maxLines linhas e REJEITADA (estoura em vertical)", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.5,
          fim_s: 5.0,
          linhas: ["linha um", "linha dois", "linha tres"],
          texto: "linha um\nlinha dois\nlinha tres",
          caracteres: 28,
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("estoura a safe area"))).toBe(true);
  });

  it("o CONSTRUTOR pagina em no maximo maxLines linhas", async () => {
    const manifesto = manifestoCanonico();
    const timing = await timingDaFixture();
    const doc = construirLegendas(manifesto, timing);
    for (const legenda of doc.legendas) {
      expect(legenda.linhas.length).toBeLessThanOrEqual(maxLines);
      expect(legenda.texto).toBe(legenda.linhas.join("\n"));
      expect(legenda.caracteres).toBe(legenda.linhas.join("").length);
    }
  });
});

// ─── Outras sondas do oraculo (forma, conteudo, ordem) ─────────────────────────

describe("legendas — forma, conteudo e ordem", () => {
  it("audio divergente do timing e REJEITADO (casamento por conteudo)", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          ...(docBase().legendas[0] as object),
          audio: "cd".repeat(32) as Sha256,
        } as LegendasCanonicas["legendas"][number],
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("casamento por conteudo violado"))).toBe(true);
  });

  it("legenda para cena silenciosa e REJEITADA (nada e inventado)", () => {
    const { manifesto, timing } = contextoBase();
    const timingComSilencio: TimingCanonico = {
      ...timing,
      cenas: {
        "c-teste": {
          unidade: "segundos",
          estado: "silencio",
          duracao_s: 30,
        },
      },
    };
    const problemas = validarLegendas(docBase(), { manifesto, timing: timingComSilencio });
    expect(problemas.some((p) => p.includes("sem locucao"))).toBe(true);
  });

  it("cena com locucao sem nenhuma legenda e REJEITADA (legenda que nunca aparece)", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = { ...docBase(), legendas: [] };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("sem nenhuma legenda"))).toBe(true);
  });

  it("duas legendas sobrepostas sao REJEITADAS", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.5,
          fim_s: 2.5,
          linhas: ["uma frase"],
          texto: "uma frase",
          caracteres: 9,
        },
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 2.0,
          fim_s: 4.0,
          linhas: ["de teste."],
          texto: "de teste.",
          caracteres: 9,
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("sobreposicao"))).toBe(true);
  });

  it("campo 'caracteres' mentiroso e REJEITADO (o oraculo rederiva das linhas)", () => {
    const { manifesto, timing } = contextoBase();
    const doc: LegendasCanonicas = {
      ...docBase(),
      legendas: [
        {
          cena: "c-teste",
          unidade: "segundos",
          audio: HASH_AUDIO,
          inicio_s: 0.5,
          fim_s: 5.0,
          linhas: ["uma frase de teste."],
          texto: "uma frase de teste.",
          caracteres: 1, // mentira: as linhas tem 19
        },
      ],
    };
    const problemas = validarLegendas(doc, { manifesto, timing });
    expect(problemas.some((p) => p.includes("mentiroso"))).toBe(true);
  });
});
