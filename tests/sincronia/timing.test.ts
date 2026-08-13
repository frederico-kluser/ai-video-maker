/**
 * tests/sincronia/timing.test.ts
 *
 * O TIMING CANONICO — card F3-01 (W5, caminho critico). Tres camadas:
 *
 *   1. ACEITACAO — a fixture canonica (manifesto-valido.json + cassete de
 *      locucao COMMITADO, via replay offline) produz um documento VALIDO e
 *      MONOTONICO, que valida contra o schema congelado.
 *
 *   2. ∅-CRIT — um documento com palavra FORA DE ORDEM, com SOBREPOSICAO
 *      ou com DURACAO NEGATIVA TEM de ser rejeitado (criterio de
 *      aceitacao), pelo oraculo (validar.ts) e pelo schema onde este o
 *      alcanca.
 *
 *   3. ADVERSARIAL — as tres perguntas do card:
 *      (1) existe caminho em que a legenda aparece ANTES de a palavra ser
 *          falada? Escreva o teste.
 *      (2) o timing e o audio podem divergir sem nada ficar vermelho?
 *          (casamento por CONTEUDO: casar errado por posicao falha).
 *      (3) o oraculo deriva da mesma premissa do produtor? (sonda
 *          negativa: timing quebrado e rejeitado; duracao medida no PCM
 *          contra a declarada; invariante de cobertura que o produtor
 *          nao calcula).
 *
 * PERGUNTA OBRIGATORIA DA ONDA (contrato-w5 §10): nenhuma assercao abaixo
 * fala da LISTA COMPLETA de cenas, de nos ou de assets. Tudo e presenca
 * do item DESTE card: `cenas["c-004"]` e locucao, `cenas["c-001"]` e
 * silencio — o mapa inteiro pode crescer no merge dos irmaos sem derrubar
 * isto. (A igualdade byte a byte com o golden vive na receita
 * `timing-testar` via tools/timing/gerar.ts --conferir, nao aqui.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import type { Manifesto } from "src/contratos/manifesto.js";
import type { ParcialResolvido, Sha256 } from "src/resolucao/manifesto-resolvido.js";
import { reproduzirLocucao } from "src/resolucao/locucao/replay.js";
import type { UnidadeReproduzida } from "src/resolucao/locucao/replay.js";
import { RAIZ_CASSETES_PADRAO } from "src/resolucao/cassete/formato.js";
import {
  MIME_TIMING_CANONICO,
  serializarTimingCanonico,
} from "src/sincronia/timing/formato.js";
import type { TimingCanonico, EntradaDeCena } from "src/sincronia/timing/formato.js";
import {
  ETimingCanonicoInvalido,
  lerTimingCanonico,
  validarTimingCanonico,
} from "src/sincronia/timing/validar.js";
import { construirTimingCanonico } from "src/sincronia/timing/construir.js";
import type { CarregarBytes } from "src/sincronia/timing/construir.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const GOLDEN_TIMING = "fixtures/canonico/timing-canono.json";
const SCHEMA_TIMING = "schema/timing.schema.json";

function manifestoCanonico(): Manifesto {
  return JSON.parse(readFileSync(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
}

/**
 * Reconstroi a parcial e o carregador a partir do cassete COMMITADO —
 * exatamente o que a receita faz. Offline: o replay le `corpos/`, o
 * guarda de rede do vitest esta ligado.
 */
async function parcialDoCassete(): Promise<{
  manifesto: Manifesto;
  parcial: Pick<ParcialResolvido, "assets" | "nos_locucao">;
  carregar: CarregarBytes;
  unidades: readonly UnidadeReproduzida[];
}> {
  const manifesto = manifestoCanonico();
  const reprod = await reproduzirLocucao(manifesto);
  const gravado = JSON.parse(
    readFileSync(join(RAIZ_CASSETES_PADRAO, "locucao", reprod.chave, "resultado.json"), "utf-8"),
  ) as { assets: Record<string, unknown>; nos_locucao: Record<string, string> };

  const porHash = new Map<string, UnidadeReproduzida>();
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
    unidades: reprod.unidades,
  };
}

async function construirDaFixture(): Promise<TimingCanonico> {
  const { manifesto, parcial, carregar } = await parcialDoCassete();
  return construirTimingCanonico({ manifesto, parcial, carregar });
}

// ─── Validacao pelo schema (ajv, draft 2020-12) ────────────────────────────────
//
// `strictRequired: false` de proposito: a regra condicional (estado
// "locucao" ⇒ audio/texto/palavras/silencio obrigatorios) declara os
// nomes no schema PAi, nao dentro do subschema `then`, e o lint do ajv
// nao enxerga alem do subschema. O comportamento e testado aqui por
// sondas (entrada de locucao sem audio ⇒ rejeitada), e a receita valida
// o mesmo schema com outra implementacao (python jsonschema).

const ajv = new Ajv2020({ strict: true, strictRequired: false });
const validaSchema = ajv.compile(
  JSON.parse(readFileSync(SCHEMA_TIMING, "utf-8")) as object,
);

// ─── Helpers de documento sintetico (para as sondas) ──────────────────────────

/** Um documento valido e minimal: uma palavra, cobertura exata. */
function docBase(): TimingCanonico {
  return {
    schema_version: "TimingCanonico.1",
    unidade: "segundos",
    cenas: {
      "c-teste": {
        unidade: "segundos",
        estado: "locucao",
        audio: "ab".repeat(32) as Sha256,
        duracao_s: 3,
        texto: "um dois",
        palavras: [
          { texto: "um", inicio_s: 0.5, fim_s: 1.0 },
          { texto: "dois", inicio_s: 1.5, fim_s: 2.5 },
        ],
        silencio: [
          { inicio_s: 0, fim_s: 0.5 },
          { inicio_s: 1.0, fim_s: 1.5 },
          { inicio_s: 2.5, fim_s: 3 },
        ],
      },
    },
  };
}

function soComPalavras(doc: TimingCanonico, palavras: EntradaDeCena["palavras"]): TimingCanonico {
  const entrada = doc.cenas["c-teste"] as EntradaDeCena;
  return {
    ...doc,
    cenas: { ...doc.cenas, "c-teste": { ...entrada, palavras } },
  };
}

// ─── 1. Aceitacao: a fixture canonica ───────────────────────────────────────────

describe("timing canonico — a fixture canonica (criterio 1)", () => {
  it("produz um documento valido e MONOTONICO", async () => {
    const doc = await construirDaFixture();
    expect(validarTimingCanonico(doc)).toEqual([]);

    // Monotonia por ENTRADA de locucao: nenhuma palavra comeca antes de
    // a anterior ter terminado; nenhuma tem duracao nao positiva.
    for (const entrada of Object.values(doc.cenas)) {
      if (entrada.estado !== "locucao") continue;
      let fimAnterior = -Infinity;
      for (const p of entrada.palavras ?? []) {
        expect(p.fim_s).toBeGreaterThan(p.inicio_s);
        expect(p.inicio_s).toBeGreaterThanOrEqual(fimAnterior);
        fimAnterior = p.fim_s;
      }
    }
  });

  it("valida contra o schema congelado (ajv)", async () => {
    const doc = await construirDaFixture();
    const valido = validaSchema(doc as unknown);
    expect(validaSchema.errors ?? []).toEqual([]);
    expect(valido).toBe(true);
  });

  it("o MIME do documento canonico nao e uma URL (guarda encontrarURLs)", () => {
    expect(MIME_TIMING_CANONICO).not.toContain("://");
  });

  it("PERGUNTA DA ONDA: presenca — c-004 e locucao ligada por CONTEUDO", async () => {
    const { parcial } = await parcialDoCassete();
    const doc = await construirDaFixture();

    const c004 = doc.cenas["c-004"];
    expect(c004).toBeDefined();
    expect(c004?.estado).toBe("locucao");
    // O campo audio da entrada e exatamente o hash do audio da cena na
    // parcial — o casamento por conteudo (nunca por posicao).
    expect(c004?.audio).toBe(parcial.nos_locucao?.["c-004"]);
  });

  it("PERGUNTA DA ONDA: presenca — c-001 e silencio DECLARADO, nao ausente", async () => {
    const doc = await construirDaFixture();

    const c001 = doc.cenas["c-001"];
    expect(c001).toBeDefined();
    expect(c001?.estado).toBe("silencio");
    expect(c001?.duracao_s).toBeGreaterThan(0);
    // Sem palavras e sem audio: a declaracao de silencio e o estado.
    expect(c001?.palavras ?? []).toHaveLength(0);
  });

  it("PERGUNTA DA ONDA: toda entrada declara a propria unidade, em segundos", async () => {
    const doc = await construirDaFixture();
    for (const [id, entrada] of Object.entries(doc.cenas)) {
      expect(entrada.unidade, `cena ${id}`).toBe("segundos");
      expect(entrada.unidade).not.toContain("frame");
    }
  });

  it("a duracao medida no PCM bate com a declarada (dentro da tolerancia)", async () => {
    // O builder ja cobra isto (C9); aqui a prova e que a fixture CANONICA
    // cruza o oraculo com folga — nada de depender de tolerancia.
    const doc = await construirDaFixture();
    for (const entrada of Object.values(doc.cenas)) {
      if (entrada.estado !== "locucao") continue;
      expect(entrada.duracao_s).toBeGreaterThan(0);
    }
  });
});

// ─── 2. ∅-crit: o oraculo reprova os tres modos de falha ───────────────────────

describe("timing canonico — ∅-crit (criterio 3)", () => {
  it("palavra FORA DE ORDEM tem de ser rejeitada", () => {
    const doc = soComPalavras(docBase(), [
      { texto: "um", inicio_s: 2.0, fim_s: 2.5 },
      { texto: "dois", inicio_s: 1.0, fim_s: 1.5 },
    ]);
    const problemas = validarTimingCanonico(doc);
    expect(problemas.join("\n")).toContain("fora de ordem");
    expect(() => lerTimingCanonico(serializarTimingCanonico(doc))).toThrow(
      ETimingCanonicoInvalido,
    );
  });

  it("palavra SOBREPOSTA tem de ser rejeitada", () => {
    const doc = soComPalavras(docBase(), [
      { texto: "um", inicio_s: 1.0, fim_s: 2.0 },
      { texto: "dois", inicio_s: 1.5, fim_s: 2.5 },
    ]);
    const problemas = validarTimingCanonico(doc);
    expect(problemas.join("\n")).toContain("sobreposicao");
    expect(() => lerTimingCanonico(serializarTimingCanonico(doc))).toThrow(
      ETimingCanonicoInvalido,
    );
  });

  it("palavra com DURACAO NEGATIVA tem de ser rejeitada", () => {
    const doc = soComPalavras(docBase(), [{ texto: "um", inicio_s: 2.0, fim_s: 1.0 }]);
    const problemas = validarTimingCanonico(doc);
    expect(problemas.join("\n")).toContain("duracao nao positiva");
    expect(() => lerTimingCanonico(serializarTimingCanonico(doc))).toThrow(
      ETimingCanonicoInvalido,
    );
  });

  it("∅-crit tambem pelo SCHEMA: duracao negativa e duracao da cena negativa", () => {
    // O schema nao expressa fim >= inicio, mas expressa minimum 0 — um
    // fim negativo e rejeitado aqui, na outra metade do oraculo.
    const comFimNegativo = {
      ...docBase(),
      cenas: {
        "c-teste": {
          ...(docBase().cenas["c-teste"] as EntradaDeCena),
          palavras: [{ texto: "um", inicio_s: 1.0, fim_s: -0.5 }],
        },
      },
    };
    expect(validaSchema(comFimNegativo)).toBe(false);

    const comDuracaoNegativa = {
      ...docBase(),
      cenas: {
        "c-teste": {
          ...(docBase().cenas["c-teste"] as EntradaDeCena),
          duracao_s: -1,
        },
      },
    };
    expect(validaSchema(comDuracaoNegativa)).toBe(false);
  });

  it("∅-crit tambem pelo SCHEMA: cena silenciosa nao carrega palavras", () => {
    const silencioComPalavras = {
      ...docBase(),
      cenas: {
        "c-teste": {
          unidade: "segundos",
          estado: "silencio",
          duracao_s: 3,
          palavras: [{ texto: "um", inicio_s: 1.0, fim_s: 1.5 }],
        },
      },
    };
    expect(validaSchema(silencioComPalavras)).toBe(false);
  });

  it("∅-crit: entrada sem unidade declarada e rejeitada pelo schema", () => {
    const semUnidade = JSON.parse(serializarTimingCanonico(docBase()).toString("utf-8")) as {
      cenas: Record<string, Record<string, unknown>>;
    };
    delete semUnidade.cenas["c-teste"]?.unidade;
    expect(validaSchema(semUnidade)).toBe(false);
  });
});

// ─── 3. Adversarial (1): a legenda pode aparecer antes da palavra? ─────────────

describe("timing canonico — adversarial (1): legenda antes da palavra", () => {
  it("a fixture canonica nunca coloca uma palavra antes do fim da anterior", async () => {
    const doc = await construirDaFixture();
    for (const entrada of Object.values(doc.cenas)) {
      if (entrada.estado !== "locucao") continue;
      let fimAnterior = -Infinity;
      for (const p of entrada.palavras ?? []) {
        // Se p comecasse antes de fimAnterior, a legenda de p poderia
        // aparecer enquanto a palavra anterior ainda esta sendo falada.
        expect(p.inicio_s).toBeGreaterThanOrEqual(fimAnterior);
        fimAnterior = p.fim_s;
      }
    }
  });

  it("palavra com inicio ANTES do byte zero do audio e rejeitada", () => {
    const doc = soComPalavras(docBase(), [
      { texto: "um", inicio_s: -0.5, fim_s: 0.5 },
    ]);
    const problemas = validarTimingCanonico(doc);
    expect(problemas.join("\n")).toContain("antes do byte zero");
  });

  it("palavra que comeca antes do fim da anterior e rejeitada (sobreposicao)", () => {
    // E a resposta escrita: se o documento disser que "dois" comeca em
    // 1.5 enquanto "um" so termina em 2.0, existe caminho para a legenda
    // de "dois" aparecer antes de "dois" ser falado — o oraculo fecha.
    const doc = soComPalavras(docBase(), [
      { texto: "um", inicio_s: 1.0, fim_s: 2.0 },
      { texto: "dois", inicio_s: 1.5, fim_s: 2.5 },
    ]);
    const problemas = validarTimingCanonico(doc);
    expect(problemas.join("\n")).toContain("sobreposicao");
  });
});

// ─── 4. Adversarial (2): timing e audio podem divergir sem vermelho? ───────────

describe("timing canonico — adversarial (2): divergencia timing <-> audio", () => {
  it("casamento por CONTEUDO: ordem trocada nao troca o par", async () => {
    const { parcial, carregar, unidades } = await parcialDoCassete();
    const esperado = new Map(
      unidades.map((u) => [u.unidade, { audio: u.hashAudio, texto: u.timing.texto }]),
    );
    expect(esperado.size).toBeGreaterThanOrEqual(2);

    // Ordem NORMAL e ordem INVERTIDA (insercao): um casamento por
    // posicao casaria c-004 com o timing de c-005 e vice-versa. Por
    // conteudo, o par tem de ser o mesmo nos dois arranjos.
    const nosInvertido = Object.fromEntries(
      Object.entries(parcial.nos_locucao ?? {}).reverse(),
    ) as Record<string, string>;
    const assetsInvertidos = Object.fromEntries(
      Object.entries(parcial.assets).reverse(),
    ) as ParcialResolvido["assets"];

    const normal = await casarPorConteudo(parcial, carregar);
    const invertido = await casarPorConteudo(
      { assets: assetsInvertidos, nos_locucao: nosInvertido },
      carregar,
    );

    for (const u of unidades) {
      const parNormal = normal.find((p) => p.unidade === u.unidade);
      const parInvertido = invertido.find((p) => p.unidade === u.unidade);
      // Por conteudo, o par e identico nos dois arranjos.
      expect(parNormal?.timing.audio).toBe(esperado.get(u.unidade)?.audio);
      expect(parInvertido?.timing.audio).toBe(esperado.get(u.unidade)?.audio);
      expect(parNormal?.timing.texto).toBe(esperado.get(u.unidade)?.texto);
      // Se alguem tivesse casado por posicao, os textos estariam
      // trocados e esta assercao falharia.
      expect(parInvertido?.timing.texto).toBe(parNormal?.timing.texto);
    }
  });

  it("timing que descreve OUTRO audio e rejeitado pelo construtor (duracao)", async () => {
    const { manifesto, parcial, carregar } = await parcialDoCassete();

    // Um documento de timing "valido para o produtor" (as palavras
    // continuam dentro da duracao declarada) mas cuja duracao mente.
    const adulterado = await adulterarDuracao(parcial, carregar, "c-004", 3000);

    // O construtor mede o PCM dos bytes DE VERDADE e acusa o delta.
    await expect(
      construirTimingCanonico({ manifesto, parcial, carregar: adulterado.carregar }),
    ).rejects.toThrow(/OUTRO audio|delta/);
  });

  it("bytes errados para um hash certo sao rejeitados (hash conferido)", async () => {
    const { manifesto, parcial, carregar, unidades } = await parcialDoCassete();
    const c004 = unidades.find((u) => u.unidade === "c-004");
    const c005 = unidades.find((u) => u.unidade === "c-005");
    expect(c004).toBeDefined();
    expect(c005).toBeDefined();

    // O carregador entrega os bytes do audio de c-005 quando pedem o
    // hash de c-004 — o timing e o audio divergem em silencio. Todo o
    // resto delega para o original (C10 tem de ser O motivo do vermelho,
    // nao um efeito colateral de um carregador incompleto).
    const carregarMentiroso: CarregarBytes = (hash) => {
      if (hash === c004!.hashAudio) return c005!.audio;
      return carregar(hash);
    };

    await expect(
      construirTimingCanonico({ manifesto, parcial, carregar: carregarMentiroso }),
    ).rejects.toThrow(ETimingCanonicoInvalido);
  });

  it("cena com locucao no manifesto SEM entrada na parcial e rejeitada", async () => {
    const { manifesto, carregar } = await parcialDoCassete();
    const parcialIncompleta: Pick<ParcialResolvido, "assets" | "nos_locucao"> = {
      assets: {},
      nos_locucao: {},
    };
    await expect(
      construirTimingCanonico({ manifesto, parcial: parcialIncompleta, carregar }),
    ).rejects.toThrow(/legenda nunca aparece/);
  });
});

// ─── 5. Adversarial (3): o oraculo deriva da premissa do produtor? ─────────────

describe("timing canonico — adversarial (3): premissa independente", () => {
  it("o oraculo NAO deriva do produtor: duracao mentirosa passa nele e cai aqui", async () => {
    const { manifesto, parcial, carregar } = await parcialDoCassete();

    const adulterado = await adulterarDuracao(parcial, carregar, "c-004", 3000);

    // Premissa 1 (produtor): o documento adulterado e VALIDO para o
    // oraculo de F2-03 — palavras dentro da duracao, monotonicas.
    const timingAdulterado = await adulterado.lerTiming();
    const { validarTiming } = await import("src/resolucao/locucao/timing.js");
    expect(validarTiming(timingAdulterado)).toEqual([]);

    // Premissa 2 (canonico): o construtor mede o PCM e acusa o delta.
    await expect(
      construirTimingCanonico({ manifesto, parcial, carregar: adulterado.carregar }),
    ).rejects.toThrow(ETimingCanonicoInvalido);
  });

  it("silencio que sobrepoe palavra e rejeitado — regra que o produtor nao tem", () => {
    // O produtor nunca calcula cobertura; este oraculo calcula. Um
    // documento com silencio em cima da fala e geometricamente mentiroso.
    const doc = docBase();
    const entrada = doc.cenas["c-teste"] as EntradaDeCena;
    const comSilencioEmCima = {
      ...doc,
      cenas: {
        "c-teste": {
          ...entrada,
          silencio: [
            { inicio_s: 0, fim_s: 0.5 },
            { inicio_s: 0.7, fim_s: 2.8 }, // sobrepoe "um" (0.5..1.0)
          ],
        },
      },
    };
    const problemas = validarTimingCanonico(comSilencioEmCima);
    expect(problemas.join("\n")).toContain("sobrepoe a palavra");
  });

  it("sonda negativa: o oraculo reprova o que o construtor produziria de quebrado", () => {
    // Se alguem deletar uma regra do oraculo, estes tres probes ficam
    // VERMELHOS — o oraculo nao e vazio por vacuidade (C2).
    const doc = soComPalavras(docBase(), [
      { texto: "um", inicio_s: 1.0, fim_s: 2.0 },
      { texto: "dois", inicio_s: 0.5, fim_s: 1.5 },
    ]);
    const problemas = validarTimingCanonico(doc);
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.join("\n")).toMatch(/fora de ordem|sobreposicao/);
  });
});

// ─── Helpers de adulteracao ─────────────────────────────────────────────────────

/** Importa casarTimings por cima para reutilizar o casamento por conteudo. */
async function casarPorConteudo(
  parcial: Pick<ParcialResolvido, "assets" | "nos_locucao">,
  carregar: CarregarBytes,
): Promise<Array<{ unidade: string; timing: { audio: string; texto: string } }>> {
  const { casarTimings } = await import("src/resolucao/locucao/timing.js");
  return casarTimings(parcial, carregar);
}

/**
 * Troca os bytes do timing de uma cena por uma versao cuja duracao_ms
 * mente (para mais), mantendo o documento valido para o oraculo do
 * produtor. O carregador devolve os bytes adulterados no MESMO hash do
 * asset de timing — e o PCM do audio continua o mesmo.
 */
async function adulterarDuracao(
  parcial: Pick<ParcialResolvido, "assets" | "nos_locucao">,
  carregar: CarregarBytes,
  cenaId: string,
  acrescimoMs: number,
): Promise<{
  carregar: CarregarBytes;
  lerTiming: () => Promise<import("src/resolucao/locucao/timing.js").TimingLocucao>;
}> {
  const { casarTimings, hashesDeTiming, lerTiming, serializarTiming } = await import(
    "src/resolucao/locucao/timing.js"
  );

  // Acha o hash do asset de timing da cena pelo CONTEUDO (o campo
  // `unidade` do documento), nunca por posicao no mapa.
  let hashDoTiming: Sha256 | undefined;
  for (const hash of hashesDeTiming(parcial)) {
    const bytes = await carregar(hash);
    if (bytes === null) continue;
    const doc = lerTiming(bytes);
    if (doc.unidade === cenaId) {
      hashDoTiming = hash;
      break;
    }
  }
  if (hashDoTiming === undefined) throw new Error(`cena ${cenaId} sem asset de timing`);

  const par = (await casarTimings(parcial, carregar)).find((p) => p.unidade === cenaId);
  if (par === undefined) throw new Error(`cena ${cenaId} sem timing na parcial`);

  const adulterado = {
    ...par.timing,
    duracao_ms: par.timing.duracao_ms + acrescimoMs,
  };
  const bytesAdulterados = serializarTiming(adulterado);

  return {
    // So o documento de timing da cena alvo muda; TODO o resto delega
    // para o carregador original (inclusive os bytes do audio, que
    // continuam medindo o PCM de verdade).
    carregar: (hash) => (hash === hashDoTiming ? bytesAdulterados : carregar(hash)),
    lerTiming: async () => adulterado,
  };
}
