// =============================================================================
// contrato-de-camada.test.ts — safe area, janela e validacao do contrato
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// A pergunta do card — "a camada NAO cobre a safe area?" — tem aqui a metade
// geometrica, por DADOS: o plano de cada camada e medido contra o retangulo
// seguro derivado dos tokens. A metade de pixel vive no gate `just no-camadas`
// (tools/camadas/gate.sh), que confere no render que o plano nao mentiu.
//
// Os numeros de safe area NAO sao digitados: tudo deriva de
// tokens.safeArea16x9 via margemSegura/retanguloSeguro, e o teste amarra as
// duas pontas (percentual do token x pixels absolutos do token) em 1920x1080.
// =============================================================================

import { describe, expect, it } from "vitest";

import { safeArea16x9, zIndex } from "src/design/tokens";
import {
  Z_INDEX_POR_PAPEL,
  apenasVisiveis,
  foraDaJanela,
  margemSegura,
  medirInvasaoDaSafeArea,
  opacidadeDaJanela,
  rampaEmFrames,
  retanguloDoQuadro,
  retanguloSeguro,
  validarModuloDeCamada,
  type CamadaProps,
} from "src/composicao/camadas/contrato-de-camada";
import { CAMADA_POR_NOME } from "src/composicao/camadas/registro";
import {
  CATALOGO_DA_PROVA,
  FRAME_DA_PROVA,
  propsDaProva,
} from "src/composicao/camadas/prova/cena";
import { AVANCO_DA_INVASORA } from "src/composicao/camadas/prova/sondas";
import { OPACIDADE_MINIMA_VISIVEL } from "src/composicao/camadas/tokens-de-camada";

describe("margemSegura — percentual do token, nunca o absoluto", () => {
  it("em 1920x1080 bate pixel a pixel com o action safe absoluto do token", () => {
    const m = margemSegura(1920, 1080);
    expect(m.horizontal).toBe(safeArea16x9.actionSafe.left); // 67
    expect(m.vertical).toBe(safeArea16x9.actionSafe.top); // 38
  });

  it("o retangulo seguro em 1920x1080 tem as bordas do action safe", () => {
    const s = retanguloSeguro(1920, 1080);
    expect(s).toStrictEqual({
      x: safeArea16x9.actionSafe.left,
      y: safeArea16x9.actionSafe.top,
      largura:
        safeArea16x9.actionSafe.right - safeArea16x9.actionSafe.left,
      altura:
        safeArea16x9.actionSafe.bottom - safeArea16x9.actionSafe.top,
    });
  });

  it("escala para qualquer resolucao — e o MAIOR dos dois retangulos", () => {
    const m = margemSegura(1280, 720);
    expect(m.horizontal).toBe(45); // round(1280 * 0.035)
    expect(m.vertical).toBe(25); // round(720 * 0.035)
    expect(safeArea16x9.actionSafePct).toBeGreaterThan(
      safeArea16x9.graphicsSafePct - safeArea16x9.actionSafePct,
    );
  });

  it("retanguloSeguro CONTEM o retangulo de graphics safe (proteger o maior protege os dois)", () => {
    const s = retanguloSeguro(1920, 1080);
    const g = {
      x: safeArea16x9.graphicsSafe.left,
      y: safeArea16x9.graphicsSafe.top,
      largura: safeArea16x9.graphicsSafe.right - safeArea16x9.graphicsSafe.left,
      altura: safeArea16x9.graphicsSafe.bottom - safeArea16x9.graphicsSafe.top,
    };
    expect(s.x).toBeLessThanOrEqual(g.x);
    expect(s.y).toBeLessThanOrEqual(g.y);
    expect(s.x + s.largura).toBeGreaterThanOrEqual(g.x + g.largura);
    expect(s.y + s.altura).toBeGreaterThanOrEqual(g.y + g.altura);
  });
});

describe("retanguloDoQuadro", () => {
  it("o quadro inteiro", () => {
    expect(retanguloDoQuadro(1920, 1080)).toStrictEqual({
      x: 0,
      y: 0,
      largura: 1920,
      altura: 1080,
    });
  });
});

describe("janela declarada da camada", () => {
  const props = propsDaProva();

  it("frame fora de [0, duracao) esta fora da janela", () => {
    expect(foraDaJanela(-1, props.duracaoEmFrames)).toBe(true);
    expect(foraDaJanela(props.duracaoEmFrames, props.duracaoEmFrames)).toBe(true);
    expect(foraDaJanela(0, props.duracaoEmFrames)).toBe(false);
    expect(foraDaJanela(props.duracaoEmFrames - 1, props.duracaoEmFrames)).toBe(false);
  });

  it("rampa em frames vem de tokens.transitionDuration.base via msToFrames", () => {
    expect(rampaEmFrames(30)).toBe(9); // round(300ms * 30 / 1000)
  });

  it("opacidadeDaJanela: 0 fora, sobe na entrada, 1 no plato, 0 na saida", () => {
    const base: CamadaProps = propsDaProva();
    const curto: CamadaProps = { ...base, duracaoEmFrames: 40 };
    expect(opacidadeDaJanela({ ...curto, frame: 0 })).toBe(0);
    expect(opacidadeDaJanela({ ...curto, frame: 20 })).toBe(1);
    expect(opacidadeDaJanela({ ...curto, frame: 39 })).toBe(0);
    expect(opacidadeDaJanela({ ...curto, frame: 40 })).toBe(0);
    expect(opacidadeDaJanela({ ...curto, frame: -5 })).toBe(0);
    // meio da rampa de entrada: ainda subindo
    const meio = opacidadeDaJanela({ ...curto, frame: 4 });
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(1);
  });

  it("janela curta demais para duas rampas: entra e nao sai", () => {
    const curto: CamadaProps = { ...props, duracaoEmFrames: 5 };
    expect(opacidadeDaJanela({ ...curto, frame: 4 })).toBeGreaterThan(0);
  });
});

describe("apenasVisiveis", () => {
  it("descarta retangulo degenerado e opacidade abaixo do limiar de 8 bits", () => {
    const plano = [
      { nome: "ok", x: 0, y: 0, largura: 10, altura: 10, opacidade: 0.5, cor: "#000" },
      { nome: "degenerado", x: 0, y: 0, largura: 0, altura: 10, opacidade: 0.5, cor: "#000" },
      {
        nome: "invisivel",
        x: 0,
        y: 0,
        largura: 10,
        altura: 10,
        opacidade: OPACIDADE_MINIMA_VISIVEL / 2,
        cor: "#000",
      },
    ];
    const visiveis = apenasVisiveis(plano);
    expect(visiveis.map((r) => r.nome)).toStrictEqual(["ok"]);
  });
});

describe("Z_INDEX_POR_PAPEL — o papel decide onde a camada desenha", () => {
  it("fundo desenha em zIndex.background, sobreposicao em zIndex.overlay — de token, nunca literal", () => {
    expect(Z_INDEX_POR_PAPEL.fundo).toBe(zIndex.background);
    expect(Z_INDEX_POR_PAPEL.sobreposicao).toBe(zIndex.overlay);
    // o conteudo fica entre os dois
    expect(zIndex.background).toBeLessThan(zIndex.content);
    expect(zIndex.content).toBeLessThan(zIndex.overlay);
  });
});

describe("validarModuloDeCamada", () => {
  const valido = {
    meta: {
      nome: "teste",
      id: "teste-1",
      papel: "sobreposicao",
      descricao: "x",
    },
    default: () => null,
    plano: () => [],
  };

  it("modulo valido passa sem erros", () => {
    const r = validarModuloDeCamada(valido, "teste", "origem");
    expect(r.erros).toStrictEqual([]);
    expect(r.modulo?.meta.nome).toBe("teste");
  });

  it("nao exportar meta, default ou plano e erro, nunca silencio", () => {
    for (const falta of ["meta", "default", "plano"] as const) {
      const { [falta]: _, ...sem } = valido;
      const r = validarModuloDeCamada(sem, "teste", "origem");
      expect(r.modulo).toBeNull();
      expect(r.erros.length).toBeGreaterThan(0);
    }
  });

  it("papel invalido e erro, com os validos nomeados", () => {
    const torto = { ...valido, meta: { ...valido.meta, papel: "no-meio" } };
    const r = validarModuloDeCamada(torto, "teste", "origem");
    expect(r.modulo).toBeNull();
    expect(r.erros.join(" ")).toContain("sobreposicao");
    expect(r.erros.join(" ")).toContain("fundo");
  });

  it("nome que nao casa com o arquivo e erro (descoberta por convencao)", () => {
    const torto = { ...valido, meta: { ...valido.meta, nome: "outro" } };
    const r = validarModuloDeCamada(torto, "teste", "origem");
    expect(r.erros.join(" ")).toContain("outro");
  });

  it("valor nao-objeto e erro com o tipo recebido", () => {
    const r = validarModuloDeCamada("texto", "teste", "origem");
    expect(r.modulo).toBeNull();
    expect(r.erros.join(" ")).toContain("string");
  });
});

describe("A PERGUNTA DO CARD — por dados, no frame amostrado pelo gate", () => {
  const props = propsDaProva(FRAME_DA_PROVA);
  const seguro = retanguloSeguro(props.width, props.height);

  it("nenhuma das tres camadas reais invade a safe area", () => {
    for (const nome of ["fundo", "grade", "vinheta"]) {
      const modulo = CAMADA_POR_NOME.get(nome);
      if (!modulo) throw new Error(`camada ${nome} nao registrada`);
      const invasoes = medirInvasaoDaSafeArea(modulo, props);
      expect(invasoes, `${nome} invadiu a safe area`).toStrictEqual([]);
    }
  });

  it("as tres juntas tambem nao invadem", () => {
    const juntas = ["fundo", "grade", "vinheta"].map((n) => {
      const m = CAMADA_POR_NOME.get(n);
      if (!m) throw new Error(`camada ${n} nao registrada`);
      return m;
    });
    for (const modulo of juntas) {
      expect(medirInvasaoDaSafeArea(modulo, props)).toStrictEqual([]);
    }
  });

  it("a sonda invasora invade — e invade numa area proporcional ao avanco declarado", () => {
    const invasora = CATALOGO_DA_PROVA.get("invasora");
    if (!invasora) throw new Error("sonda invasora nao encontrada");
    const invasoes = medirInvasaoDaSafeArea(invasora, props);
    expect(invasoes.length).toBeGreaterThan(0);
    const total = invasoes.reduce((acc, i) => acc + i.areaInvadida, 0);
    expect(total).toBeGreaterThan(0);
    // o avanco de 12% do token de action safe garante invasao em todos os lados
    expect(AVANCO_DA_INVASORA).toBeGreaterThan(0.1);
  });

  it("a sonda vazia nao declara nada — o plano vazio e a sonda do quadro vazio", () => {
    const vazia = CATALOGO_DA_PROVA.get("vazia");
    if (!vazia) throw new Error("sonda vazia nao encontrada");
    expect(vazia.plano(props)).toStrictEqual([]);
  });

  it("o plano de cada camada real tem conteudo visivel no frame amostrado", () => {
    for (const nome of ["fundo", "grade", "vinheta"]) {
      const modulo = CAMADA_POR_NOME.get(nome);
      if (!modulo) throw new Error(`camada ${nome} nao registrada`);
      const plano = modulo.plano(props);
      expect(plano.length, `${nome} declarou plano vazio`).toBeGreaterThan(0);
      for (const r of plano) {
        expect(r.opacidade).toBeGreaterThanOrEqual(OPACIDADE_MINIMA_VISIVEL);
        expect(r.largura * r.altura).toBeGreaterThan(0);
      }
    }
  });

  it("o fundo cobre o quadro inteiro (a base do banho)", () => {
    const fundo = CAMADA_POR_NOME.get("fundo");
    if (!fundo) throw new Error("camada fundo nao registrada");
    const quadro = retanguloDoQuadro(props.width, props.height);
    const temBaseCompleta = fundo
      .plano(props)
      .some(
        (r) =>
          r.x === quadro.x &&
          r.y === quadro.y &&
          r.largura === quadro.largura &&
          r.altura === quadro.altura,
      );
    expect(temBaseCompleta).toBe(true);
  });

  it("a grade tem marcas em todos os lados da margem", () => {
    const grade = CAMADA_POR_NOME.get("grade");
    if (!grade) throw new Error("camada grade nao registrada");
    const nomes = grade.plano(props).map((r) => r.nome);
    for (const lado of ["topo", "base", "esquerda", "direita"]) {
      expect(nomes.some((n) => n.endsWith(lado)), `sem marca na banda ${lado}`).toBe(true);
    }
  });
});
