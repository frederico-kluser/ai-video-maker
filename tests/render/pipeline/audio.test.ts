// =============================================================================
// POSICIONAMENTO DE AUDIO — testes de unidade (C4, AB-600; C3, AB-617)
// =============================================================================
// A ancora e ABSOLUTA: posicoes em segundos desde o byte zero, consumindo
// DuckingEnvelope.1 e Ritmo.1 pelos campos absolutos — NUNCA recomputando
// da janela visual da cena (a c-004 da fixture canonica prova que as duas
// divergem: janela visual de 4 s com fala de 8,505 s).
//
// Os numeros de presenca sao os MESMOS do contrato C1, derivados dos MESMOS
// inputs que o F3-05 usa (contrato-w7 §12): a fala de c-004 esta em
// [14,233..22,738] e a de c-005 em [18,233..23,588] — a assercao e de
// presenca, nunca de lista fechada.
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerTimingCanonico } from "../../../src/sincronia/timing/validar";
import { cortarSilencio } from "../../../src/sincronia/ritmo/cortar";
import {
  calcularEnvelopeDucking,
  posicoesDaTimeline,
} from "../../../src/sincronia/ducking/calcular";
import type { Manifesto } from "../../../src/contratos/manifesto";
import {
  posicionarAudio,
  ErroDePosicionamento,
  type MixDeEmenda,
} from "../../../src/render/pipeline/audio";

const RAIZ = join(__dirname, "..", "..", "..");
const TIMING = join(RAIZ, "fixtures", "canonico", "timing-canono.json");
const MANIFESTO = join(RAIZ, "fixtures", "canonico", "manifesto-valido.json");

function carregar() {
  const timing = lerTimingCanonico(readFileSync(TIMING, "utf8"));
  const manifesto = JSON.parse(readFileSync(MANIFESTO, "utf8")) as Manifesto;
  const posicoes = posicoesDaTimeline(manifesto);
  const cadencia = cortarSilencio(timing).documento;
  const envelope = calcularEnvelopeDucking({ timing, posicoes });
  return { timing, manifesto, posicoes, cadencia, envelope };
}

/** O mix de C3: hash NOVO por cena (o F3-05 publica quando materializar). */
function mixNovo(): MixDeEmenda {
  return {
    cenas: new Map([
      ["c-004", "e".repeat(64)],
      ["c-005", "f".repeat(64)],
    ]),
  };
}

describe("posicionarAudio — ancora absoluta (C4, AB-600)", () => {
  it("a fala de c-004 esta em [14,233..22,738] — o MESMO numero do contrato C1", () => {
    const { cadencia, envelope, posicoes } = carregar();
    const plano = posicionarAudio({ cadencia, envelope, mix: mixNovo(), posicoes });

    const c004 = plano.faixas.find((f) => f.cenaId === "c-004");
    expect(c004).toBeDefined();
    expect(c004!.inicio_s).toBeCloseTo(14.233, 3);
    expect(c004!.fim_s).toBeCloseTo(22.738, 3);
    // Presenca: a primeira e a ultima palavra da cadencia estao nos
    // extremos declarados pelo contrato.
    expect(c004!.palavras[0]!.inicio_s).toBeCloseTo(14.233, 3);
    expect(c004!.palavras[c004!.palavras.length - 1]!.fim_s).toBeCloseTo(22.738, 3);
  });

  it("a fala de c-005 esta em [18,233..23,588] — o MESMO numero do contrato C1", () => {
    const { cadencia, envelope, posicoes } = carregar();
    const plano = posicionarAudio({ cadencia, envelope, mix: mixNovo(), posicoes });

    const c005 = plano.faixas.find((f) => f.cenaId === "c-005");
    expect(c005).toBeDefined();
    expect(c005!.inicio_s).toBeCloseTo(18.233, 3);
    expect(c005!.fim_s).toBeCloseTo(23.588, 3);
  });

  it("NUNCA recomputa da janela visual: cena curta com fala longa continua no lugar", () => {
    // A c-004 da fixture: janela visual curta (4 s), fala de 8,505 s.
    // Se o modulo recomputasse da janela visual, a fala encolheria ou
    // deslizaria — o contrato C1 manda o contrario. A prova em duas camadas:
    //   (a) estrutural — o modulo NAO recebe o manifesto nem a janela
    //       visual; so a cadencia, o envelope, o mix e as posicoes;
    //   (b) comportamental — encolher a janela visual de c-004 para 1 s e
    //       rederivar as posicoes pela aritmetica (o frameInicial de c-004
    //       NAO muda: so a propria duracao encolheu) NAO move nem encurta
    //       a fala posicionada.
    const { cadencia, envelope, posicoes, manifesto } = carregar();

    const antes = posicionarAudio({ cadencia, envelope, mix: mixNovo(), posicoes });
    const c004Antes = antes.faixas.find((f) => f.cenaId === "c-004")!;
    expect(c004Antes.fim_s - c004Antes.inicio_s).toBeCloseTo(8.505, 3);
    // A fala NAO cabe na janela visual de 4 s — e fica inteira mesmo assim.
    expect(c004Antes.fim_s - c004Antes.inicio_s).toBeGreaterThan(4);

    // Encolhe a janela visual de c-004 para 1 s.
    const copia = JSON.parse(JSON.stringify(manifesto)) as Manifesto;
    const cena = copia.cenas.find((c) => c.id === "c-004")!;
    for (const no of copia.nos) {
      if (cena.nos.includes(no.id)) {
        no.duracao_frames = 30;
      }
    }

    // Posicoes rederivadas da aritmetica da composicao sobre o manifesto
    // mutado: frameInicial de c-004 (427) nao mudou — a janela visual de
    // c-004 so afeta a duracao dela e o inicio de c-005.
    const posicoesMutadas = posicoesDaTimeline(copia);
    expect(posicoesMutadas.get("c-004")).toBeCloseTo(14.233, 3);

    const depois = posicionarAudio({
      cadencia,
      envelope,
      mix: mixNovo(),
      posicoes: posicoesMutadas,
    });
    const c004Depois = depois.faixas.find((f) => f.cenaId === "c-004")!;
    expect(c004Depois.inicio_s).toBeCloseTo(c004Antes.inicio_s, 6);
    expect(c004Depois.fim_s).toBeCloseTo(c004Antes.fim_s, 6);
    expect(c004Depois.palavras.length).toBe(c004Antes.palavras.length);
  });
});

describe("posicionarAudio — envelope consumido pelos campos absolutos (C4)", () => {
  it("a atenuacao vem dos intervalos absolutos do envelope, verbatim", () => {
    const { cadencia, envelope, posicoes } = carregar();
    const plano = posicionarAudio({ cadencia, envelope, mix: mixNovo(), posicoes });

    const c004 = plano.faixas.find((f) => f.cenaId === "c-004")!;
    // O intervalo do envelope que toca a fala de c-004: a fala esta em
    // [14,233..22,738] e o envelope cobre ela com folga — o trecho usado
    // tem que tocar o inicio da fala.
    const tocante = envelope.intervalos.filter(
      (iv) => iv.inicio_s <= c004.inicio_s && c004.fim_s <= iv.fim_s,
    );
    expect(tocante.length).toBeGreaterThan(0);
    expect(c004.atenuacao.length).toBeGreaterThan(0);
    // Os valores do plano sao EXATAMENTE os do documento (verbatim).
    for (const trecho of c004.atenuacao) {
      const origem = envelope.intervalos.find(
        (iv) => iv.inicio_s === trecho.inicio_s && iv.fim_s === trecho.fim_s,
      );
      expect(origem).toBeDefined();
      expect(trecho.ganho_db).toBe(origem!.ganho_db);
    }
  });
});

describe("posicionarAudio — emenda pelo hash NOVO (C3, AB-617)", () => {
  it("usa o hash do MIX (emenda), nunca o hash do audio-fonte da cadencia", () => {
    const { cadencia, envelope, posicoes } = carregar();
    const hashFonte = cadencia.cenas["c-004"]!.audio;
    expect(hashFonte).toBeDefined();

    const plano = posicionarAudio({ cadencia, envelope, mix: mixNovo(), posicoes });
    const c004 = plano.faixas.find((f) => f.cenaId === "c-004")!;
    expect(c004.hash).toBe("e".repeat(64));
    expect(c004.hash).not.toBe(hashFonte);
  });

  it("cena com locucao SEM emenda no mix fica OMITIDA — nunca cai para o hash da fonte", () => {
    const { cadencia, envelope, posicoes } = carregar();
    const mixVazio: MixDeEmenda = { cenas: new Map() };

    const plano = posicionarAudio({ cadencia, envelope, mix: mixVazio, posicoes });
    expect(plano.faixas).toEqual([]);
  });
});

describe("posicionarAudio — recusas", () => {
  it("cena com locucao SEM posicao absoluta e ERRO", () => {
    const { cadencia, envelope } = carregar();
    const posicoes = new Map<string, number>(); // sem c-004/c-005

    expect(() =>
      posicionarAudio({ cadencia, envelope, mix: mixNovo(), posicoes }),
    ).toThrow(ErroDePosicionamento);
  });
});
