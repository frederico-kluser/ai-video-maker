// =============================================================================
// comp-testar — a raiz renderiza a fixture canonica com nos de mentira
//               e o timing bate
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// Este arquivo nao "checa se compila". Ele:
//   1. confere a aritmetica de tempo contra numeros calculados A MAO;
//   2. RENDERIZA a arvore inteira (react-dom/server) em frames escolhidos e
//      exige o conjunto exato de nos visiveis, com o frame local de cada um;
//   3. exige que a raiz RECUSE manifesto torto, em vez de pular o no ruim.
//
// Sem JSX: vitest.config.ts so coleta `tests/**/*.test.ts`, entao os
// elementos sao criados com React.createElement.
// =============================================================================

import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ErroDeComposicao,
  ManifestoRaiz,
  faixasVisiveis,
  planoDeComposicao,
} from "src/composicao/ManifestoRaiz";
import { REGISTRO_DE_NOS } from "src/composicao/registro";
import { ErroDeTempo, calcularDuracao, validarTimeline } from "src/composicao/tempo";
import {
  EnvelopeSequence,
  ID_COMPOSICAO,
  MANIFESTO_CANONICO,
  RaizRemotion,
} from "src/composicao/raiz";
import type { Cena, Manifesto, No } from "src/contratos/manifesto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clonar(manifesto: Manifesto): Manifesto {
  return JSON.parse(JSON.stringify(manifesto)) as Manifesto;
}

/** Extrai (id do no, frame local) de cada no que apareceu no HTML. */
function nosRenderizados(html: string): { no: string; frame: number }[] {
  const achados: { no: string; frame: number }[] = [];
  const re = /data-no="([^"]+)"[^>]*?data-frame="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    achados.push({ no: m[1]!, frame: Number(m[2]!) });
  }
  return achados;
}

function renderizar(manifesto: Manifesto, frame: number): string {
  return renderToStaticMarkup(createElement(ManifestoRaiz, { manifesto, frame }));
}

// ---------------------------------------------------------------------------
// O caso de tres cenas e duas transicoes — calculado a mao
// ---------------------------------------------------------------------------
//
//   cena  duracao   fronteira de saida
//   c1      100            30
//   c2       80            20
//   c3      120             -
//
//   soma das cenas       = 100 + 80 + 120 = 300
//   soma das fronteiras  =        30 + 20 =  50
//   TOTAL                =       300 - 50 = 250
//
//   c1 comeca em   0, termina em 100
//   c2 comeca em 100 - 30 =  70, termina em  70 +  80 = 150
//   c3 comeca em 150 - 20 = 130, termina em 130 + 120 = 250
//
// Somar em vez de subtrair daria 350 (cauda preta de 100 frames, sem erro).
// Cobrar os dois lados da mesma fronteira daria 250 - 50 = 200 (video curto).

function noTexto(id: string, duracao: number): No {
  return {
    id,
    schema: "Texto.1",
    type: "texto",
    duracao_frames: duracao,
    texto: `no ${id}`,
  };
}

function cena(id: string, nos: string[], saida?: number, entrada?: number): Cena {
  const c: Cena = { id, nos };
  if (saida !== undefined) {
    c.transicao_saida = { tipo: "fade", duracao_frames: saida };
  }
  if (entrada !== undefined) {
    c.transicao_entrada = { tipo: "wipe", duracao_frames: entrada };
  }
  return c;
}

function tresCenasDuasTransicoes(): Manifesto {
  return {
    schema_version: "Manifesto.1",
    fps: 30,
    width: 1920,
    height: 1080,
    nos: [noTexto("a", 100), noTexto("b", 80), noTexto("c", 120)],
    cenas: [cena("c1", ["a"], 30), cena("c2", ["b"], 20), cena("c3", ["c"])],
  };
}

describe("tempo — tres cenas e duas transicoes (numero calculado a mao)", () => {
  it("soma das cenas = 300, soma das fronteiras = 50, total = 250", () => {
    const d = calcularDuracao(tresCenasDuasTransicoes());
    expect(d.somaCenas).toBe(100 + 80 + 120);
    expect(d.somaCenas).toBe(300);
    expect(d.somaTransicoes).toBe(30 + 20);
    expect(d.somaTransicoes).toBe(50);
    expect(d.totalFrames).toBe(250);
    expect(d.totalFrames).toBe(d.somaCenas - d.somaTransicoes);
  });

  it("a transicao ENCURTA: 250 != 350 (soma) e != 300 (ignorar transicao)", () => {
    const d = calcularDuracao(tresCenasDuasTransicoes());
    expect(d.totalFrames).toBeLessThan(d.somaCenas);
    expect(d.totalFrames).not.toBe(350);
    expect(d.totalFrames).not.toBe(300);
  });

  it("a linha do tempo bate cena a cena: 0-100, 70-150, 130-250", () => {
    const d = calcularDuracao(tresCenasDuasTransicoes());
    expect(
      d.timeline.map((t) => [t.cenaId, t.frameInicial, t.frameFinal]),
    ).toStrictEqual([
      ["c1", 0, 100],
      ["c2", 70, 150],
      ["c3", 130, 250],
    ]);
    expect(validarTimeline(d.timeline)).toStrictEqual([]);
  });

  it("duas fronteiras para tres cenas — uma por PAR, nunca uma por campo", () => {
    const d = calcularDuracao(tresCenasDuasTransicoes());
    expect(d.fronteiras.length).toBe(2);
    expect(d.fronteiras.map((f) => [f.cenaAnterior, f.cenaSeguinte, f.duracaoFrames]))
      .toStrictEqual([
        ["c1", "c2", 30],
        ["c2", "c3", 20],
      ]);
  });

  it("mesma fronteira declarada dos DOIS lados nao e cobrada duas vezes", () => {
    const m = tresCenasDuasTransicoes();
    // c2 tambem declara a entrada de 30 que c1 ja declarou como saida,
    // e c3 tambem declara a entrada de 20 que c2 declarou como saida.
    m.cenas[1]!.transicao_entrada = { tipo: "fade", duracao_frames: 30 };
    m.cenas[2]!.transicao_entrada = { tipo: "wipe", duracao_frames: 20 };
    const d = calcularDuracao(m);
    expect(d.somaTransicoes).toBe(50);
    expect(d.totalFrames).toBe(250);
  });

  it("quando os dois lados discordam, a saida da cena anterior manda", () => {
    const m = tresCenasDuasTransicoes();
    m.cenas[1]!.transicao_entrada = { tipo: "wipe", duracao_frames: 999 };
    const d = calcularDuracao(m);
    expect(d.fronteiras[0]!.origem).toBe("saida");
    expect(d.fronteiras[0]!.duracaoFrames).toBe(30);
    expect(d.totalFrames).toBe(250);
  });

  it("sem saida declarada, a entrada da cena seguinte vale", () => {
    const m: Manifesto = {
      schema_version: "Manifesto.1",
      fps: 30,
      width: 1920,
      height: 1080,
      nos: [noTexto("a", 100), noTexto("b", 80), noTexto("c", 120)],
      cenas: [
        cena("c1", ["a"]),
        cena("c2", ["b"], undefined, 30),
        cena("c3", ["c"], undefined, 20),
      ],
    };
    const d = calcularDuracao(m);
    expect(d.fronteiras.map((f) => f.origem)).toStrictEqual(["entrada", "entrada"]);
    expect(d.somaTransicoes).toBe(50);
    expect(d.totalFrames).toBe(250);
  });

  it("entrada da primeira cena e saida da ultima nao tem par: nao descontam", () => {
    const m = tresCenasDuasTransicoes();
    m.cenas[0]!.transicao_entrada = { tipo: "fade", duracao_frames: 40 };
    m.cenas[2]!.transicao_saida = { tipo: "fade", duracao_frames: 60 };
    const d = calcularDuracao(m);
    expect(d.fronteiras.length).toBe(2);
    expect(d.somaTransicoes).toBe(50);
    expect(d.totalFrames).toBe(250);
  });

  it("fronteira maior que a cena e recusada, nao truncada", () => {
    const m = tresCenasDuasTransicoes();
    m.cenas[1]!.transicao_saida = { tipo: "fade", duracao_frames: 200 };
    expect(() => calcularDuracao(m)).toThrow(ErroDeTempo);
  });
});

// ---------------------------------------------------------------------------
// A fixture canonica (F0-09) — numeros calculados a mao
// ---------------------------------------------------------------------------
//
//   cena    nos (entrada + duracao)                          duracao da cena
//   c-001   n-001 (0+90)                                                  90
//   c-002   n-002 (0+120), n-003 (30+180)                                210
//   c-003   n-005 (0+90), n-008 (0+180), n-004 (0+150)                   180
//   c-004   n-009 (0+120), n-010..n-013 (0+90)                           120
//   c-005   n-014 (30+150), n-006 (0+60), n-007 (15+45), n-015 (0+60)    180
//   -------------------------------------------------------------------------
//   soma das cenas = 90 + 210 + 180 + 120 + 180 = 780
//
//   fronteiras (saida da anterior manda):
//     c-001 -> c-002 : saida fade      = 15
//     c-002 -> c-003 : saida wipe      = 20
//     c-003 -> c-004 : saida clockWipe = 18
//     c-004 -> c-005 : sem saida; entrada "none" = 0
//   soma das fronteiras = 15 + 20 + 18 + 0 = 53
//
//   TOTAL = 780 - 53 = 727 frames = 727/30 s

const SOMA_CENAS = 780;
const SOMA_FRONTEIRAS = 53;
const TOTAL = 727;

describe("fixture canonica — timing (comp-testar)", () => {
  it("a fixture embutida na raiz e a fixture do disco", () => {
    expect(MANIFESTO_CANONICO.schema_version).toBe("Manifesto.1");
    expect(MANIFESTO_CANONICO.nos.length).toBe(15);
    expect(MANIFESTO_CANONICO.cenas.length).toBe(5);
  });

  it("duracao de cada cena bate com o maximo de (entrada + duracao) dos nos", () => {
    const d = calcularDuracao(MANIFESTO_CANONICO);
    expect(d.timeline.map((t) => [t.cenaId, t.duracao])).toStrictEqual([
      ["c-001", 90],
      ["c-002", 210],
      ["c-003", 180],
      ["c-004", 120],
      ["c-005", 180],
    ]);
    expect(d.somaCenas).toBe(SOMA_CENAS);
  });

  it("quatro fronteiras para cinco cenas, somando 53", () => {
    const d = calcularDuracao(MANIFESTO_CANONICO);
    expect(
      d.fronteiras.map((f) => [f.cenaAnterior, f.cenaSeguinte, f.duracaoFrames, f.origem]),
    ).toStrictEqual([
      ["c-001", "c-002", 15, "saida"],
      ["c-002", "c-003", 20, "saida"],
      ["c-003", "c-004", 18, "saida"],
      ["c-004", "c-005", 0, "entrada"],
    ]);
    expect(d.somaTransicoes).toBe(SOMA_FRONTEIRAS);
  });

  it("total = 780 - 53 = 727 frames", () => {
    const d = calcularDuracao(MANIFESTO_CANONICO);
    expect(d.totalFrames).toBe(TOTAL);
    expect(d.totalFrames).toBe(SOMA_CENAS - SOMA_FRONTEIRAS);
    expect(d.totalSegundos).toBeCloseTo(TOTAL / 30, 10);
  });

  it("linha do tempo absoluta das cinco cenas", () => {
    const d = calcularDuracao(MANIFESTO_CANONICO);
    expect(
      d.timeline.map((t) => [t.cenaId, t.frameInicial, t.frameFinal]),
    ).toStrictEqual([
      ["c-001", 0, 90],
      ["c-002", 75, 285],
      ["c-003", 265, 445],
      ["c-004", 427, 547],
      ["c-005", 547, 727],
    ]);
    expect(validarTimeline(d.timeline)).toStrictEqual([]);
  });

  it("cada no vira uma faixa com janela absoluta conhecida", () => {
    const plano = planoDeComposicao(MANIFESTO_CANONICO);
    expect(plano.faixas.map((f) => [f.noId, f.inicio, f.fim])).toStrictEqual([
      ["n-001", 0, 90],
      ["n-002", 75, 195],
      ["n-003", 105, 285],
      ["n-005", 265, 355],
      ["n-008", 265, 445],
      ["n-004", 265, 415],
      ["n-009", 427, 547],
      ["n-010", 427, 517],
      ["n-011", 427, 517],
      ["n-012", 427, 517],
      ["n-013", 427, 517],
      ["n-014", 577, 727],
      ["n-006", 547, 607],
      ["n-007", 562, 607],
      ["n-015", 547, 607],
    ]);
    // Nenhuma faixa passa do fim da composicao.
    for (const faixa of plano.faixas) {
      expect(faixa.fim).toBeLessThanOrEqual(plano.totalFrames);
    }
  });
});

// ---------------------------------------------------------------------------
// Render de verdade
// ---------------------------------------------------------------------------

describe("fixture canonica — render com nos de mentira (comp-testar)", () => {
  const casos: { frame: number; esperado: [string, number][] }[] = [
    { frame: 0, esperado: [["n-001", 0]] },
    // 80 esta dentro da transicao c-001 -> c-002: os dois lados renderizam.
    { frame: 80, esperado: [["n-001", 80], ["n-002", 5]] },
    { frame: 100, esperado: [["n-002", 25]] },
    { frame: 300, esperado: [["n-005", 35], ["n-008", 35], ["n-004", 35]] },
    // 430 esta na transicao c-003 -> c-004.
    {
      frame: 430,
      esperado: [
        ["n-008", 165],
        ["n-009", 3],
        ["n-010", 3],
        ["n-011", 3],
        ["n-012", 3],
        ["n-013", 3],
      ],
    },
    {
      frame: 600,
      esperado: [["n-014", 23], ["n-006", 53], ["n-007", 38], ["n-015", 53]],
    },
    { frame: TOTAL - 1, esperado: [["n-014", 149]] },
  ];

  for (const caso of casos) {
    it(`frame ${String(caso.frame)}: renderiza exatamente os nos esperados`, () => {
      const html = renderizar(MANIFESTO_CANONICO, caso.frame);
      expect(nosRenderizados(html).map((r) => [r.no, r.frame])).toStrictEqual(
        caso.esperado,
      );
    });

    it(`frame ${String(caso.frame)}: o plano concorda com o que foi renderizado`, () => {
      const plano = planoDeComposicao(MANIFESTO_CANONICO);
      const visiveis = faixasVisiveis(plano, caso.frame).map((v) => [
        v.faixa.noId,
        v.frameLocal,
      ]);
      expect(visiveis).toStrictEqual(caso.esperado);
    });
  }

  it("o HTML tem conteudo de verdade, nao so <div> vazia (C1)", () => {
    const html = renderizar(MANIFESTO_CANONICO, 0);
    expect(html).toContain("Editor de V");
    expect(html.length).toBeGreaterThan(200);
  });

  it("nenhum frame valido renderiza tela vazia", () => {
    const plano = planoDeComposicao(MANIFESTO_CANONICO);
    for (let frame = 0; frame < plano.totalFrames; frame++) {
      expect(
        faixasVisiveis(plano, frame).length,
        `frame ${String(frame)} nao tem nenhum no visivel`,
      ).toBeGreaterThan(0);
    }
  });

  it("render e deterministico: duas passadas, bytes identicos", () => {
    for (const frame of [0, 300, 600]) {
      expect(renderizar(MANIFESTO_CANONICO, frame)).toBe(
        renderizar(MANIFESTO_CANONICO, frame),
      );
    }
  });

  it("os seis tipos de no aparecem em algum frame", () => {
    const plano = planoDeComposicao(MANIFESTO_CANONICO);
    const tipos = new Set(plano.faixas.map((f) => f.tipo));
    expect([...tipos].sort()).toStrictEqual([
      "cabecalho",
      "codigo",
      "grafico",
      "lista",
      "midia",
      "texto",
    ]);
  });
});

// ---------------------------------------------------------------------------
// A fiacao com <Sequence>, que e o que roda no render de verdade
// ---------------------------------------------------------------------------

interface ElementoSequence {
  props: { from: number; durationInFrames: number; name: string };
}

describe("envelope de producao — <Sequence> recebe a mesma janela do plano", () => {
  it("cada faixa vira um <Sequence> com from/durationInFrames do plano", () => {
    const plano = planoDeComposicao(MANIFESTO_CANONICO);
    const arvore = ManifestoRaiz({
      manifesto: MANIFESTO_CANONICO,
      frame: 0,
      Envelope: EnvelopeSequence,
    }) as ReactElement<{ children: ReactElement[] }>;

    const envelopes = arvore.props.children;
    expect(envelopes.length).toBe(plano.faixas.length);

    const janelas = envelopes.map((envelope) => {
      const seq = EnvelopeSequence(
        envelope.props as unknown as Parameters<typeof EnvelopeSequence>[0],
      ) as unknown as ElementoSequence;
      return [seq.props.name, seq.props.from, seq.props.durationInFrames];
    });

    expect(janelas).toStrictEqual(
      plano.faixas.map((f) => [f.noId, f.inicio, f.duracao]),
    );
  });

  it("a composicao registrada usa a duracao derivada, nao um numero solto", () => {
    const plano = planoDeComposicao(MANIFESTO_CANONICO);
    const elemento = RaizRemotion({}) as ReactElement<{
      id: string;
      durationInFrames: number;
      fps: number;
      width: number;
      height: number;
    }>;
    expect(elemento.props.id).toBe(ID_COMPOSICAO);
    expect(elemento.props.durationInFrames).toBe(plano.totalFrames);
    expect(elemento.props.durationInFrames).toBe(TOTAL);
    expect(elemento.props.fps).toBe(MANIFESTO_CANONICO.fps);
    expect(elemento.props.width).toBe(MANIFESTO_CANONICO.width);
    expect(elemento.props.height).toBe(MANIFESTO_CANONICO.height);
  });
});

// ---------------------------------------------------------------------------
// Recusa — a raiz nao pula o no que nao entende
// ---------------------------------------------------------------------------

describe("recusa de manifesto torto (comp-testar)", () => {
  it("tipo de no desconhecido: RECUSA, nao pula", () => {
    const m = clonar(MANIFESTO_CANONICO);
    (m.nos[0] as { type: string }).type = "holograma";
    expect(() => planoDeComposicao(m)).toThrow(ErroDeComposicao);
    expect(() => planoDeComposicao(m)).toThrow(/tipo desconhecido "holograma"/);
    expect(() => renderizar(m, 0)).toThrow(ErroDeComposicao);
  });

  it("tipo valido no schema mas sem componente registrado: RECUSA", () => {
    const registroParcial = new Map(REGISTRO_DE_NOS);
    registroParcial.delete("grafico");
    expect(() => planoDeComposicao(MANIFESTO_CANONICO, registroParcial)).toThrow(
      /nao tem componente registrado/,
    );
  });

  it("cena que aponta para no inexistente: RECUSA", () => {
    const m = clonar(MANIFESTO_CANONICO);
    m.cenas[0]!.nos = ["n-nao-existe"];
    expect(() => planoDeComposicao(m)).toThrow(/referencia no inexistente/);
  });

  it("no declarado e nunca usado por cena nenhuma: RECUSA", () => {
    const m = clonar(MANIFESTO_CANONICO);
    m.nos.push(noTexto("n-orfao", 30));
    expect(() => planoDeComposicao(m)).toThrow(/nunca usado/);
  });

  it("no com id duplicado: RECUSA", () => {
    const m = clonar(MANIFESTO_CANONICO);
    m.nos.push({ ...m.nos[0]! });
    expect(() => planoDeComposicao(m)).toThrow(/id duplicado/);
  });

  it("schema do no divergente do tipo: RECUSA", () => {
    const m = clonar(MANIFESTO_CANONICO);
    (m.nos[0] as { schema: string }).schema = "Cabecalho.2";
    expect(() => planoDeComposicao(m)).toThrow(/diverge do tipo/);
  });

  it("duracao de no negativa ou zero: RECUSA", () => {
    const m = clonar(MANIFESTO_CANONICO);
    m.nos[0]!.duracao_frames = 0;
    expect(() => planoDeComposicao(m)).toThrow(/duracao_frames invalida/);
  });

  it("manifesto sem cenas: RECUSA", () => {
    const m = clonar(MANIFESTO_CANONICO);
    m.cenas = [];
    expect(() => planoDeComposicao(m)).toThrow(ErroDeComposicao);
  });

  it("a recusa lista TODOS os problemas de uma vez, nao so o primeiro", () => {
    const m = clonar(MANIFESTO_CANONICO);
    (m.nos[0] as { type: string }).type = "holograma";
    (m.nos[1] as { type: string }).type = "fantasma";
    try {
      planoDeComposicao(m);
      expect.unreachable("planoDeComposicao deveria ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeComposicao);
      expect((erro as ErroDeComposicao).erros.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("controle positivo: a fixture canonica NAO e recusada", () => {
    expect(() => planoDeComposicao(MANIFESTO_CANONICO)).not.toThrow();
  });
});
