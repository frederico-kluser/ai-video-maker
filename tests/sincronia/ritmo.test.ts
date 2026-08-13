/**
 * tests/sincronia/ritmo.test.ts
 *
 * O RITMO — corte de silencio e cadencia (card F3-04, onda W6, ADR-0029).
 *
 * O card consome o timing canonico (contrato-w6 §2: `lerTimingCanonico`,
 * unidade SEGUNDOS, silencio DECLARADO, consumo por CONTEUDO) e produz a
 * cadencia: um documento compactado em que nenhuma palavra foi cortada.
 *
 *   1. ∅-CRIT (criterio de aceitacao) — o teste que prova que NENHUMA
 *      palavra foi cortada: comparacao do timing ANTES e DEPOIS do corte
 *      (mesmo texto, mesma duracao, deslocamento = corte acumulado),
 *      reconstrucao da timeline ORIGINAL a partir da compactada + regioes
 *      de corte (round-trip), e sonda negativa: documento em que o
 *      silencio cobre o ataque da proxima palavra TEM de ser recusado.
 *
 *   2. ADVERSARIAL — as quatro perguntas do card:
 *      (1) o corte comeu o ataque de alguma palavra? Prova por comparacao
 *          antes/depois (cada palavra sobrevive com inicio/fim intactos —
 *          round-trip devolve a posicao original exata).
 *      (2) o resultado e IDEMPOTENTE (2x = 1x) e deterministico (2
 *          processos produzem os mesmos bytes)?
 *      (3) o corte muda a duracao total SEM atualizar o documento de
 *          timing? Nao: `duracao_s` do compactado = original - soma dos
 *          cortes, e o oraculo C8 (cobertura) segue valendo.
 *      (4) a cadencia respeita o timing canonico? O documento compactado
 *          passa no MESMO oraculo de `src/sincronia/timing/validar.ts` e
 *          regioes de corte estao inteiras dentro de silencio declarado.
 *
 * PERGUNTA OBRIGATORIA DA ONDA (contrato-w6 §10): nenhuma assercao abaixo
 * fala da LISTA COMPLETA de cenas — tudo e PRESENCA do item DESTE card:
 * "a cena c-004 (locucao) e a c-001 (silencio) seguem no documento
 * compactado" e invariantes por cena que valem para qualquer cena que o
 * merge dos irmaos trouxer.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Manifesto } from "src/contratos/manifesto.js";
import type { ParcialResolvido, Sha256 } from "src/resolucao/manifesto-resolvido.js";
import { reproduzirLocucao } from "src/resolucao/locucao/replay.js";
import type { UnidadeReproduzida } from "src/resolucao/locucao/replay.js";
import { RAIZ_CASSETES_PADRAO } from "src/resolucao/cassete/formato.js";
import { construirTimingCanonico } from "src/sincronia/timing/construir.js";
import type { CarregarBytes } from "src/sincronia/timing/construir.js";
import {
  EPS_S,
  ETimingCanonicoInvalido,
  lerTimingCanonico,
  validarTimingCanonico,
} from "src/sincronia/timing/validar.js";
import { serializarTimingCanonico } from "src/sincronia/timing/formato.js";
import type {
  EntradaDeCena,
  IntervaloDeSilencio,
  PalavraCanonica,
  TimingCanonico,
} from "src/sincronia/timing/formato.js";
import {
  ECorteInvalido,
  cortarSilencio,
} from "src/sincronia/ritmo/cortar.js";
import {
  FORMATO_RITMO,
  GAP_ALVO_S,
} from "src/sincronia/ritmo/formato.js";

// ─── Fixtures ───────────────────────────────────────────────────────────────────

const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";
const GOLDEN_TIMING = "fixtures/canonico/timing-canono.json";

/** A fonte dos bytes: o golden COMMITADO, lido pelo oraculo. */
function documentoCanonico(): TimingCanonico {
  return lerTimingCanonico(readFileSync(GOLDEN_TIMING, "utf-8"));
}

/**
 * A fonte dos bytes pela via do REPLAY do cassete de locucao (AB-523):
 * nunca por hash — o mesmo caminho de tools/timing/gerar.ts. Prova que o
 * corte consome o documento que o pipeline real produz.
 */
async function documentoDoReplay(): Promise<TimingCanonico> {
  const manifesto = JSON.parse(
    readFileSync(MANIFESTO_CANONICO, "utf-8"),
  ) as Manifesto;
  const reprod = await reproduzirLocucao(manifesto);
  const gravado = JSON.parse(
    readFileSync(
      join(RAIZ_CASSETES_PADRAO, "locucao", reprod.chave, "resultado.json"),
      "utf-8",
    ),
  ) as { assets: Record<string, unknown>; nos_locucao: Record<string, string> };

  const porHash = new Map<string, UnidadeReproduzida>();
  for (const u of reprod.unidades) {
    porHash.set(u.hashTiming, u);
    porHash.set(u.hashAudio, u);
  }

  const parcial: Pick<ParcialResolvido, "assets" | "nos_locucao"> = {
    assets: gravado.assets as ParcialResolvido["assets"],
    nos_locucao: gravado.nos_locucao,
  };
  const carregar: CarregarBytes = (hash) => {
    const u = porHash.get(hash);
    if (u === undefined) return null;
    return hash === u.hashTiming ? u.bytesTiming : u.audio;
  };
  return construirTimingCanonico({ manifesto, parcial, carregar });
}

// ─── Helpers de documento sintetico (para as sondas) ──────────────────────────

/**
 * Um documento valido e minimal: duas palavras, lacunas de 0,5 s —
 * todas acima do alvo default (0,25), entao o corte trabalha de verdade.
 */
function docSintetico(): TimingCanonico {
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

/** Cenas com locucao, em ordem estavel (a assercao e por cena, nunca lista). */
function cenasComLocucao(doc: TimingCanonico): Array<readonly [string, EntradaDeCena]> {
  return Object.keys(doc.cenas)
    .sort()
    .map((id) => [id, doc.cenas[id] as EntradaDeCena] as const)
    .filter(([, entrada]) => entrada.estado === "locucao");
}

/**
 * Corte acumulado antes de `t`, re-derivado no TESTE a partir das regioes
 * declaradas — a mesma semantica do mapa de compactacao, calculada do
 * lado de fora do modulo (oraculo independente).
 */
function corteAcumulado(cortes: readonly IntervaloDeSilencio[], t: number): number {
  let total = 0;
  for (const regiao of cortes) {
    if (regiao.fim_s <= t) total += regiao.fim_s - regiao.inicio_s;
  }
  return total;
}

/**
 * Round-trip: a posicao ORIGINAL de um ponto `t` da timeline compactada.
 *
 * A compactacao e novo(x) = x - corteAcumulado(x); a inversa nao e unica
 * nos pontos de colapso (fim de regiao), entao o ponto certo e o MAIOR
 * ponto fixo de x = t + corteAcumulado(x) — iterado de cima para baixo,
 * converge em poucos passos (um por regiao).
 */
function posicaoOriginal(
  cortes: readonly IntervaloDeSilencio[],
  t: number,
): number {
  const total = cortes.reduce((acc, r) => acc + (r.fim_s - r.inicio_s), 0);
  let x = t + total;
  for (let passo = 0; passo < 64; passo++) {
    const proximo = t + corteAcumulado(cortes, x);
    if (proximo === x) return x;
    x = proximo;
  }
  throw new Error(`posicaoOriginal nao convergiu para t=${t}`);
}

// ─── 1. ∅-crit: NENHUMA palavra cortada ─────────────────────────────────────────

describe("ritmo — ∅-crit: o teste que prova que NENHUMA palavra foi cortada", () => {
  it("toda palavra da fixture canonica sobrevive: mesmo texto, mesma duracao, mesma ordem", () => {
    const doc = documentoCanonico();
    // Alvo abaixo da lacuna natural (0,09 s) da fixture: o corte trabalha
    // de verdade, e a prova nao e trivial por nao haver corte nenhum.
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    for (const [id, entrada] of cenasComLocucao(doc)) {
      const compactada = resultado.documento.cenas[id] as EntradaDeCena;
      const originais = entrada.palavras as readonly PalavraCanonica[];
      const compactadas = compactada.palavras as readonly PalavraCanonica[];

      // Mesma quantidade — a transformacao nao soma nem remove palavra.
      expect(compactadas.length, `cena ${id}`).toBe(originais.length);

      // Par a par, na ordem: mesmo texto e MESMA duracao (inicio/fim
      // intactos em relacao a propria fala).
      for (let i = 0; i < originais.length; i++) {
        const antes = originais[i] as PalavraCanonica;
        const depois = compactadas[i] as PalavraCanonica;
        expect(depois.texto, `cena ${id} palavra ${i}`).toBe(antes.texto);
        const duracaoAntes = antes.fim_s - antes.inicio_s;
        const duracaoDepois = depois.fim_s - depois.inicio_s;
        expect(
          Math.abs(duracaoDepois - duracaoAntes),
          `cena ${id} palavra "${antes.texto}" teve a duracao alterada`,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it("comparacao antes/depois: o deslocamento de cada palavra e EXATAMENTE o corte acumulado antes dela", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    for (const [id, entrada] of cenasComLocucao(doc)) {
      const compactada = resultado.documento.cenas[id] as EntradaDeCena;
      const cortes = resultado.cortes[id] ?? [];
      const originais = entrada.palavras as readonly PalavraCanonica[];
      const compactadas = compactada.palavras as readonly PalavraCanonica[];

      for (let i = 0; i < originais.length; i++) {
        const antes = originais[i] as PalavraCanonica;
        const depois = compactadas[i] as PalavraCanonica;
        const esperado = antes.inicio_s - corteAcumulado(cortes, antes.inicio_s);
        expect(
          Math.abs(depois.inicio_s - esperado),
          `cena ${id} palavra "${antes.texto}": deslocamento diferente do corte acumulado`,
        ).toBeLessThan(1e-9);
        const fimEsperado = antes.fim_s - corteAcumulado(cortes, antes.fim_s);
        expect(
          Math.abs(depois.fim_s - fimEsperado),
          `cena ${id} palavra "${antes.texto}": fim deslocado diferente do corte acumulado`,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it("ROUND-TRIP: da timeline compactada + regioes de corte, cada palavra reconstroi o inicio E o fim ORIGINAIS", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    for (const [id, entrada] of cenasComLocucao(doc)) {
      const compactada = resultado.documento.cenas[id] as EntradaDeCena;
      const cortes = resultado.cortes[id] ?? [];
      const originais = entrada.palavras as readonly PalavraCanonica[];
      const compactadas = compactada.palavras as readonly PalavraCanonica[];

      for (let i = 0; i < originais.length; i++) {
        const antes = originais[i] as PalavraCanonica;
        const depois = compactadas[i] as PalavraCanonica;
        expect(
          Math.abs(posicaoOriginal(cortes, depois.inicio_s) - antes.inicio_s),
          `cena ${id} palavra "${antes.texto}": ataque nao reconstruido`,
        ).toBeLessThan(1e-9);
        expect(
          Math.abs(posicaoOriginal(cortes, depois.fim_s) - antes.fim_s),
          `cena ${id} palavra "${antes.texto}": fim nao reconstruido`,
        ).toBeLessThan(1e-9);
      }
    }
  });

  it("nenhuma regiao de corte toca palavra: toda regiao esta inteira dentro de uma lacuna DECLARADA", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    for (const [id, entrada] of cenasComLocucao(doc)) {
      const cortes = resultado.cortes[id] ?? [];
      const palavras = entrada.palavras as readonly PalavraCanonica[];
      const lacunas = entrada.silencio as readonly IntervaloDeSilencio[];

      for (const regiao of cortes) {
        const dentroDeLacuna = lacunas.some(
          (l) => regiao.inicio_s >= l.inicio_s - EPS_S && regiao.fim_s <= l.fim_s + EPS_S,
        );
        expect(
          dentroDeLacuna,
          `cena ${id}: regiao ${regiao.inicio_s}..${regiao.fim_s}s fora de lacuna declarada`,
        ).toBe(true);
        const tocaPalavra = palavras.some(
          (p) => regiao.inicio_s < p.fim_s - EPS_S && regiao.fim_s > p.inicio_s + EPS_S,
        );
        expect(
          tocaPalavra,
          `cena ${id}: regiao ${regiao.inicio_s}..${regiao.fim_s}s toca uma palavra`,
        ).toBe(false);
      }
    }
  });

  it("sonda negativa: documento em que o silencio COBRE o ataque da proxima palavra tem de ser recusado", () => {
    const doc = docSintetico();
    const entrada = doc.cenas["c-teste"] as EntradaDeCena;
    // A lacuna [1.0, 1.5] estica 0,1 s para dentro da palavra "dois"
    // (comeca em 1.5): o corte NUNCA processa esse documento — o oraculo
    // C7c (silencio sobre palavra) e reaplicado na entrada do modulo.
    const mutado: TimingCanonico = {
      ...doc,
      cenas: {
        "c-teste": {
          ...entrada,
          silencio: [
            { inicio_s: 0, fim_s: 0.5 },
            { inicio_s: 1.0, fim_s: 1.6 },
            { inicio_s: 2.5, fim_s: 3 },
          ],
        },
      },
    };
    expect(() => cortarSilencio(mutado)).toThrow(ETimingCanonicoInvalido);
  });

  it("sonda negativa: o oraculo rejeita o proprio documento do ∅-crit (o corte nao e o unico guarda)", () => {
    // Se o oraculo de entrada parar de ser reaplicado, o corte poderia
    // operar sobre geometria quebrada — o oraculo continua sendo a
    // premissa independente (a mesma pergunta adversarial 3 do F3-01).
    const doc = docSintetico();
    const entrada = doc.cenas["c-teste"] as EntradaDeCena;
    const mutado: TimingCanonico = {
      ...doc,
      cenas: {
        "c-teste": {
          ...entrada,
          silencio: [
            { inicio_s: 0, fim_s: 0.5 },
            { inicio_s: 1.0, fim_s: 1.6 },
            { inicio_s: 2.5, fim_s: 3 },
          ],
        },
      },
    };
    expect(validarTimingCanonico(mutado).length).toBeGreaterThan(0);
  });
});

// ─── 2. Adversarial (1): ataque intacto — numeros exatos em documento sintetico ──

describe("ritmo — adversarial (1): o corte NAO come o ataque de palavra nenhuma", () => {
  it("documento sintetico: numeros esperados por calculo manual, nao pela implementacao", () => {
    // Lacunas de 0,5 s, alvo 0,25: cada lacuna mantem 0,25 e corta 0,25.
    // "um": [0.5, 1.0] → [0.25, 0.75]; lacuna [0.75, 1.0]; "dois":
    // [1.5, 2.5] → [1.0, 2.0]; lacuna final [2.0, 2.25]; duracao 2.25.
    const resultado = cortarSilencio(docSintetico());
    const entrada = resultado.documento.cenas["c-teste"] as EntradaDeCena;

    expect(entrada.duracao_s).toBe(2.25);
    expect(entrada.palavras).toEqual([
      { texto: "um", inicio_s: 0.25, fim_s: 0.75 },
      { texto: "dois", inicio_s: 1.0, fim_s: 2.0 },
    ]);
    expect(entrada.silencio).toEqual([
      { inicio_s: 0, fim_s: 0.25 },
      { inicio_s: 0.75, fim_s: 1.0 },
      { inicio_s: 2.0, fim_s: 2.25 },
    ]);
    // As regioes cortadas da timeline ORIGINAL, declaradas para auditoria.
    expect(resultado.cortes["c-teste"]).toEqual([
      { inicio_s: 0.25, fim_s: 0.5 },
      { inicio_s: 1.25, fim_s: 1.5 },
      { inicio_s: 2.75, fim_s: 3 },
    ]);
    // E a politica que produziu isto esta declarada no resultado.
    expect(resultado.politica).toEqual({
      versao: FORMATO_RITMO,
      gapAlvoS: GAP_ALVO_S,
    });
  });

  it("alvo zero: toda a lacuna some e as palavras ficam CONTIGUAS, com o ataque em 0", () => {
    const resultado = cortarSilencio(docSintetico(), { gapAlvoS: 0 });
    const entrada = resultado.documento.cenas["c-teste"] as EntradaDeCena;

    expect(entrada.duracao_s).toBe(1.5);
    expect(entrada.silencio).toEqual([]);
    expect(entrada.palavras).toEqual([
      { texto: "um", inicio_s: 0, fim_s: 0.5 },
      { texto: "dois", inicio_s: 0.5, fim_s: 1.5 },
    ]);
    // Nenhuma regiao toca palavra: a regiao da lacuna inicial termina
    // exatamente onde a primeira palavra comeca (ataque em 0, intacto).
    expect(resultado.cortes["c-teste"]).toEqual([
      { inicio_s: 0, fim_s: 0.5 },
      { inicio_s: 1.0, fim_s: 1.5 },
      { inicio_s: 2.5, fim_s: 3 },
    ]);
  });

  it("alvo acima de toda lacuna: documento INTACTO (corte vazio) e ainda valido", () => {
    const doc = docSintetico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 1 });
    expect(resultado.cortes["c-teste"]).toEqual([]);
    expect(serializarTimingCanonico(resultado.documento).equals(
      serializarTimingCanonico(doc),
    )).toBe(true);
    expect(validarTimingCanonico(resultado.documento)).toEqual([]);
  });

  it("a fixture consumida pela via do REPLAY do cassete (AB-523) obedece ao mesmo ∅-crit", async () => {
    const doc = await documentoDoReplay();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    for (const [id, entrada] of cenasComLocucao(doc)) {
      const compactada = resultado.documento.cenas[id] as EntradaDeCena;
      const originais = entrada.palavras as readonly PalavraCanonica[];
      const compactadas = compactada.palavras as readonly PalavraCanonica[];
      expect(compactadas.length, `cena ${id}`).toBe(originais.length);
      for (let i = 0; i < originais.length; i++) {
        const antes = originais[i] as PalavraCanonica;
        const depois = compactadas[i] as PalavraCanonica;
        expect(depois.texto, `cena ${id} palavra ${i}`).toBe(antes.texto);
        expect(
          Math.abs(
            (depois.fim_s - depois.inicio_s) - (antes.fim_s - antes.inicio_s),
          ),
          `cena ${id} palavra "${antes.texto}": duracao alterada no replay`,
        ).toBeLessThan(1e-9);
      }
    }
  });
});

// ─── 3. Adversarial (2): idempotencia e determinismo ───────────────────────────

describe("ritmo — adversarial (2): o resultado e IDEMPOTENTE e deterministico", () => {
  it("aplicar 2x produz os MESMOS bytes (2x = 1x)", () => {
    const doc = documentoCanonico();
    const umaVez = cortarSilencio(doc, { gapAlvoS: 0.05 });
    const duasVezes = cortarSilencio(umaVez.documento, { gapAlvoS: 0.05 });

    expect(serializarTimingCanonico(duasVezes.documento).equals(
      serializarTimingCanonico(umaVez.documento),
    )).toBe(true);

    // Apos o primeiro corte nao resta lacuna acima do alvo: o segundo
    // corte nao corta nada.
    for (const [id, cortes] of Object.entries(duasVezes.cortes)) {
      expect(cortes, `cena ${id}`).toEqual([]);
    }
  });

  it("idempotente com outros alvos, em documento com corte real e em documento sem corte", () => {
    // Alvo abaixo da lacuna natural da fixture (0,09 s): corte REAL no
    // segundo passo nao resta nada para cortar.
    const fixture = cortarSilencio(documentoCanonico(), { gapAlvoS: 0.05 });
    const fixture2x = cortarSilencio(fixture.documento, { gapAlvoS: 0.05 });
    expect(
      serializarTimingCanonico(fixture2x.documento).equals(
        serializarTimingCanonico(fixture.documento),
      ),
    ).toBe(true);

    // Alvo acima de toda lacuna da fixture: sem corte no primeiro passo,
    // idempotencia e identidade.
    const identidade = cortarSilencio(documentoCanonico(), { gapAlvoS: 0.5 });
    const identidade2x = cortarSilencio(identidade.documento, { gapAlvoS: 0.5 });
    expect(
      serializarTimingCanonico(identidade2x.documento).equals(
        serializarTimingCanonico(identidade.documento),
      ),
    ).toBe(true);

    // Alvo no piso do oraculo: lacunas inteiras sao removidas (o resto
    // ficaria abaixo de EPS_S) e o segundo passo tambem estaciona.
    const piso = cortarSilencio(documentoCanonico(), { gapAlvoS: EPS_S / 2 });
    const piso2x = cortarSilencio(piso.documento, { gapAlvoS: EPS_S / 2 });
    expect(
      serializarTimingCanonico(piso2x.documento).equals(
        serializarTimingCanonico(piso.documento),
      ),
    ).toBe(true);
  });

  it("funcao pura: duas chamadas com a MESMA entrada produzem bytes identicos", () => {
    const doc = documentoCanonico();
    const primeira = cortarSilencio(doc, { gapAlvoS: 0.05 });
    const segunda = cortarSilencio(doc, { gapAlvoS: 0.05 });
    expect(serializarTimingCanonico(primeira.documento).equals(
      serializarTimingCanonico(segunda.documento),
    )).toBe(true);
  });
});

// ─── 4. Adversarial (3): duracao total SEMPRE atualizada no documento ──────────

describe("ritmo — adversarial (3): o corte muda a duracao e ATUALIZA o documento", () => {
  it("duracao_s compactada = duracao original - soma dos cortes, por cena", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    for (const [id, entrada] of cenasComLocucao(doc)) {
      const compactada = resultado.documento.cenas[id] as EntradaDeCena;
      const cortes = resultado.cortes[id] ?? [];
      const somaDosCortes = cortes.reduce(
        (acc, r) => acc + (r.fim_s - r.inicio_s),
        0,
      );
      // Exato: a mesma soma, na mesma ordem, subtraida da mesma base.
      expect(compactada.duracao_s).toBe(entrada.duracao_s - somaDosCortes);
    }
  });

  it("a cobertura do oraculo C8 segue valendo: palavras + lacunas compactadas cobrem [0, duracao_s]", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });
    // A cobertura e parte do oraculo; o modulo tambem a garante por
    // construcao — aqui ela e conferida pelo proprio oraculo (premissa
    // independente, nao derivada do modulo).
    expect(validarTimingCanonico(resultado.documento)).toEqual([]);
  });

  it("o campo audio da cadencia e o MESMO da entrada (a emenda nao tem bytes ainda — AB-617)", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });
    for (const [id, entrada] of cenasComLocucao(doc)) {
      const compactada = resultado.documento.cenas[id] as EntradaDeCena;
      expect(compactada.audio, `cena ${id}`).toBe(entrada.audio);
    }
  });

  it("uma cena sem corte nao muda de duracao; uma cena com corte encurta", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    // PRESENCA, nao lista: c-001 e uma cena silenciosa (nunca cortada) e
    // c-004 e uma cena com locucao (cortada com alvo 0,05 < lacuna 0,09).
    const c001 = resultado.documento.cenas["c-001"] as EntradaDeCena;
    expect(c001.estado).toBe("silencio");
    expect(c001.duracao_s).toBe((doc.cenas["c-001"] as EntradaDeCena).duracao_s);
    expect(resultado.cortes["c-001"]).toEqual([]);

    const c004 = resultado.documento.cenas["c-004"] as EntradaDeCena;
    expect(c004.estado).toBe("locucao");
    expect(c004.duracao_s).toBeLessThan(
      (doc.cenas["c-004"] as EntradaDeCena).duracao_s,
    );
    expect((resultado.cortes["c-004"] ?? []).length).toBeGreaterThan(0);
  });
});

// ─── 5. Adversarial (4): a cadencia respeita o timing canonico ─────────────────

describe("ritmo — adversarial (4): a cadencia respeita o timing canonico", () => {
  it("o documento compactado passa no MESMO oraculo e no MESMO schema (round-trip de bytes)", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });

    // O oraculo de F3-01, sem nenhuma adaptacao.
    expect(validarTimingCanonico(resultado.documento)).toEqual([]);

    // Os MESMOS bytes que entram no hash voltam a passar pela entrada
    // unica do contrato: lerTimingCanonico(serializarTimingCanonico(doc)).
    const relido = lerTimingCanonico(
      serializarTimingCanonico(resultado.documento),
    );
    expect(validarTimingCanonico(relido)).toEqual([]);
  });

  it("toda lacuna da cadencia tem, no maximo, o alvo (a cadencia e a politica)", () => {
    const doc = documentoCanonico();
    for (const alvo of [0.05, 0.25]) {
      const resultado = cortarSilencio(doc, { gapAlvoS: alvo });
      for (const [id, entrada] of cenasComLocucao(resultado.documento)) {
        for (const lacuna of entrada.silencio as readonly IntervaloDeSilencio[]) {
          expect(
            lacuna.fim_s - lacuna.inicio_s,
            `cena ${id}: lacuna acima do alvo ${alvo}`,
          ).toBeLessThanOrEqual(alvo + EPS_S);
        }
      }
    }
  });

  it("a politica declarada no resultado diz qual alvo foi aplicado (auditabilidade)", () => {
    const resultado = cortarSilencio(docSintetico(), { gapAlvoS: 0.125 });
    expect(resultado.politica.versao).toBe(FORMATO_RITMO);
    expect(resultado.politica.gapAlvoS).toBe(0.125);
  });

  it("opcoes invalidas sao recusadas, nunca interpretadas (alvo negativo ou nao-finito)", () => {
    const doc = docSintetico();
    expect(() => cortarSilencio(doc, { gapAlvoS: -1 })).toThrow(ECorteInvalido);
    expect(() => cortarSilencio(doc, { gapAlvoS: Number.NaN })).toThrow(
      ECorteInvalido,
    );
    expect(() => cortarSilencio(doc, { gapAlvoS: Number.POSITIVE_INFINITY })).toThrow(
      ECorteInvalido,
    );
  });
});

// ─── 6. Pergunta obrigatoria da onda: PRESENCA, nunca lista completa ───────────

describe("ritmo — pergunta da onda (contrato-w6 §10): presenca do item DESTE card", () => {
  it("c-004 (locucao) e c-001 (silencio) seguem no documento compactado", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });
    const cenas = resultado.documento.cenas;

    expect((cenas["c-004"] as EntradaDeCena).estado).toBe("locucao");
    expect((cenas["c-001"] as EntradaDeCena).estado).toBe("silencio");
  });

  it("cada cena silenciosa passa pelo corte sem estado nem duracao alterados", () => {
    const doc = documentoCanonico();
    const resultado = cortarSilencio(doc, { gapAlvoS: 0.05 });
    for (const [id, entrada] of Object.entries(doc.cenas)) {
      if (entrada.estado !== "silencio") continue;
      const compactada = resultado.documento.cenas[id] as EntradaDeCena;
      expect(compactada.estado).toBe("silencio");
      expect(compactada.duracao_s).toBe(entrada.duracao_s);
      expect(resultado.cortes[id] ?? []).toEqual([]);
    }
  });
});
