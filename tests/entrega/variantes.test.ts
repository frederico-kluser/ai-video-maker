// =============================================================================
// VARIANTES DE PROPORCAO — suite do card F5-04 (W7)
// =============================================================================
// Card: F5-04 — Variantes de proporcao: conteudo fora da safe area de
// QUALQUER plataforma tem de ficar vermelho.
//
// O contrato congelado (docs/contrato-w7.md §6, emenda F5-04):
//   - consome o pintor promovido (src/composicao/pintura, AB-493) e as safe
//     areas dos tokens (AB-584: 9:16 provisional e a autoridade);
//   - invariante do bloco de legenda por plataforma (pergunta 2 do card);
//   - ∅-crit: conteudo fora da safe area de qualquer plataforma fica
//     VERMELHO.
//
// As perguntas adversariais do PROGRAMA + a pergunta 2 do card:
//   (1) O recorte vertical corta texto?
//   (2) A safe area usada e a da plataforma certa?
//   (3) A variante herda o MESMO timing, ou recalcula e diverge?
//   (4) O bloco de legenda estoura a safe area em vertical?
//
// Assercao de PRESENCA (contrato-w7 §12): nada aqui assere listas fechadas
// de cenas, nos, perfis ou plataformas — cada assercao cobre o SEU item
// (a presenca do no na variante, a plataforma do canvas, a reprovacao da
// variante 9:16 do canonico).
// =============================================================================

import { describe, expect, it } from "vitest";
import { breakpoints, maxLines, safeArea16x9, safeArea9x16 } from "src/design/tokens";
import { FIXTURA_INTEGRADA } from "../integracao/composicao/fiar";
import {
  derivarVariante,
  EAlvoDesconhecido,
  ehCanvasDeBreakpoint,
} from "../../src/entrega/variantes/derivar";
import {
  PLATAFORMA_16X9,
  PLATAFORMA_9X16,
  PLATAFORMAS,
  plataformaDoCanvas,
  retanguloDeConteudo,
  safeRectDaPlataforma,
} from "../../src/entrega/variantes/plataformas";
import {
  EVarianteInsegura,
  exigirVarianteSegura,
  imagemSobDerivacao,
  margensVioladas,
  verificarBlocoDeLegenda,
  verificarConteudoNaSafeArea,
  verificarHeranca,
  verificarVariante,
} from "../../src/entrega/variantes/verificar";

const CANONICO = FIXTURA_INTEGRADA.manifesto;

// =============================================================================
// A derivacao — mesmo manifesto, novo canvas
// =============================================================================

describe("variantes — derivacao", () => {
  it("deriva do MESMO manifesto: so width/height mudam, o resto e o mesmo objeto", () => {
    const variante = derivarVariante(CANONICO, breakpoints.vertical);
    expect(variante.width).toBe(breakpoints.vertical.width);
    expect(variante.height).toBe(breakpoints.vertical.height);
    expect(variante.schema_version).toBe(CANONICO.schema_version);
    expect(variante.fps).toBe(CANONICO.fps);
    // Os MESMOS objetos: a variante herda por identidade, nunca recopia.
    expect(variante.nos).toBe(CANONICO.nos);
    expect(variante.cenas).toBe(CANONICO.cenas);
  });

  it("a derivacao e funcao pura: mesma entrada, mesmas saidas", () => {
    const a = derivarVariante(CANONICO, breakpoints.vertical);
    const b = derivarVariante(CANONICO, breakpoints.vertical);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("alvo fora dos breakpoints dos tokens e RECUSADO nomeando o token (S-5)", () => {
    expect(() => derivarVariante(CANONICO, { width: 1000, height: 1000 })).toThrow(
      EAlvoDesconhecido,
    );
    expect(ehCanvasDeBreakpoint(breakpoints.hd)).toBe(true);
    expect(ehCanvasDeBreakpoint({ width: 1000, height: 1000 })).toBe(false);
  });

  it("o canvas da variante casa com o viewport que o pintor promovido exige", () => {
    // O contrato da pintura: pintar(manifesto, tempo, viewport) recusa
    // viewport != manifesto (src/composicao/pintura/contrato.ts). A
    // derivacao e o modulo que produz o manifesto que casa com o viewport
    // da plataforma — conferido aqui em dados, sem render.
    const variante = derivarVariante(CANONICO, breakpoints.vertical);
    expect(variante.width).toBe(breakpoints.vertical.width);
    expect(variante.height).toBe(breakpoints.vertical.height);
  });
});

// =============================================================================
// Pergunta adversarial (3) — a variante herda o MESMO timing
// =============================================================================

describe("variantes — heranca de timing (pergunta adversarial 3)", () => {
  it("verificarHeranca aprova a variante derivada (conteudo identico em bytes)", () => {
    const variante = derivarVariante(CANONICO, breakpoints.vertical);
    expect(verificarHeranca(CANONICO, variante)).toHaveLength(0);
  });

  it("verificarHeranca reprova uma variante que recalcula (no mutado)", () => {
    const variante = derivarVariante(CANONICO, breakpoints.vertical);
    const mutada = {
      ...variante,
      nos: variante.nos.map((no, i) =>
        i === 0 ? { ...no, duracao_frames: no.duracao_frames + 1 } : no,
      ),
    };
    const violacoes = verificarHeranca(CANONICO, mutada);
    expect(violacoes.length).toBeGreaterThan(0);
    expect(violacoes[0]?.regra).toBe("C1");
  });

  it("(1) o recorte vertical NAO corta texto: o texto de cada no chega inteiro a variante", () => {
    const variante = derivarVariante(CANONICO, breakpoints.vertical);
    for (const no of CANONICO.nos) {
      const texto = (no as { texto?: string }).texto;
      if (texto !== undefined) {
        const correspondente = variante.nos.find((n) => n.id === no.id);
        expect(
          correspondente,
          `o no "${no.id}" da variante 9:16 nao existe — o recorte o cortou`,
        ).toBeDefined();
        expect((correspondente as { texto?: string }).texto).toBe(texto);
      }
    }
  });
});

// =============================================================================
// Pergunta adversarial (2) — a safe area da plataforma certa
// =============================================================================

describe("variantes — a safe area da plataforma certa (pergunta adversarial 2)", () => {
  it("canvas 16:9 casa com a plataforma 16:9 (EBU R 95, tokens)", () => {
    const p = plataformaDoCanvas(breakpoints.hd);
    expect(p?.id).toBe(PLATAFORMA_16X9.id);
    expect(p?.provisoria).toBe(false);
  });

  it("canvas 9:16 casa com a plataforma 9:16 provisional (AB-071/AB-584)", () => {
    const p = plataformaDoCanvas(breakpoints.vertical);
    expect(p?.id).toBe(PLATAFORMA_9X16.id);
    expect(p?.provisoria).toBe(true);
  });

  it("o retangulo 16:9 em 1920x1080 bate com o action safe ABSOLUTO do token", () => {
    const r = safeRectDaPlataforma(breakpoints.hd, PLATAFORMA_16X9);
    expect(r.x).toBe(safeArea16x9.actionSafe.left);
    expect(r.y).toBe(safeArea16x9.actionSafe.top);
    expect(r.x + r.largura).toBe(safeArea16x9.actionSafe.right);
    expect(r.y + r.altura).toBe(safeArea16x9.actionSafe.bottom);
  });

  it("o retangulo 9:16 em 1080x1920 bate com o retangulo util provisional do token", () => {
    const r = safeRectDaPlataforma(breakpoints.vertical, PLATAFORMA_9X16);
    expect(r.x).toBe(safeArea9x16.safeRect.x);
    expect(r.y).toBe(safeArea9x16.safeRect.y);
    expect(r.largura).toBe(safeArea9x16.safeRect.width);
    expect(r.altura).toBe(safeArea9x16.safeRect.height);
  });

  it("PLATAFORMAS contem a 16:9 e a 9:16 (presenca, nao lista fechada)", () => {
    const ids = PLATAFORMAS.map((p) => p.id);
    expect(ids).toContain("16:9");
    expect(ids).toContain("9:16");
  });
});

// =============================================================================
// Pergunta 2 do card / adversarial (4) — bloco de legenda por plataforma
// =============================================================================

describe("variantes — bloco de legenda por plataforma (pergunta 2 do card)", () => {
  it("o bloco teorico de maxLines linhas cabe na caixa vertical util de CADA plataforma", () => {
    for (const canvas of [breakpoints.hd, breakpoints.vertical]) {
      expect(
        verificarBlocoDeLegenda(canvas),
        `canvas ${canvas.width}x${canvas.height}`,
      ).toHaveLength(0);
    }
  });
  // A sonda negativa da regra (bloco que estoura a caixa -> VERMELHO) vive
  // em tests/entrega/variantes-c2-sonda.test.ts, com o consumo de F3-02
  // mockado: la a regra tem de DISPARAR com um bloco alto demais.
});

// =============================================================================
// ∅-crit — conteudo fora da safe area de QUALQUER plataforma fica VERMELHO
// =============================================================================

describe("variantes — ∅-crit: conteudo fora da safe area fica vermelho", () => {
  it("a variante 16:9 do canonico e SEGURA (conteudo dentro do action safe EBU)", () => {
    const variante = derivarVariante(CANONICO, breakpoints.hd);
    expect(verificarVariante(CANONICO, variante)).toHaveLength(0);
    expect(() => exigirVarianteSegura(CANONICO, variante)).not.toThrow();
  });

  it("a variante 9:16 do canonico e REPROVADA nomeando a plataforma e as margens", () => {
    const variante = derivarVariante(CANONICO, breakpoints.vertical);
    const violacoes = verificarVariante(CANONICO, variante);
    const c3 = violacoes.filter((v) => v.regra === "C3");
    expect(c3.length).toBeGreaterThan(0);
    const mensagem = c3.map((v) => v.mensagem).join("\n");
    expect(c3[0]?.plataforma).toBe("9:16");
    // O reflow proporcional do action safe EBU (67..1853 x 38..1042 em
    // 1920x1080) sob o canvas 1080x1920: direita 1042 > 918, base 1852 >
    // 1536, topo 68 < 230 — as tres margens nomeadas, com os px.
    expect(mensagem).toContain("direita");
    expect(mensagem).toContain("base");
    expect(mensagem).toContain("px");
    expect(() => exigirVarianteSegura(CANONICO, variante)).toThrow(
      EVarianteInsegura,
    );
  });

  it("∅-crit de mutacao: remover a checagem de safe area deixa a 9:16 aprovada em silencio — o teste que exige a reprovacao fica VERMELHO", () => {
    // A sonda que a mutacao derruba: a variante 9:16 do canonico TEM de ser
    // reprovada. Se verificarConteudoNaSafeArea deixar de acusar (regra
    // apagada), esta assercao falha — o falso-verde exato do ∅-crit.
    const variante = derivarVariante(CANONICO, breakpoints.vertical);
    const violacoes = verificarConteudoNaSafeArea(
      CANONICO,
      variante,
      PLATAFORMA_9X16,
    );
    expect(violacoes.length).toBeGreaterThan(0);
  });

  it("sonda negativa dedicada: fonte 9:16 re-laid em 16:9 perde a protecao da margem esquerda", () => {
    // Controle positivo nas duas pontas da mesma regra: a imagem do
    // retangulo de conteudo 9:16 (x comeca em 0) sob o canvas 16:9 sai da
    // margem esquerda do EBU action safe — e o oraculo reprova nomeando a
    // margem.
    const fonte = derivarVariante(CANONICO, breakpoints.vertical);
    const variante = derivarVariante(CANONICO, breakpoints.hd);
    const violacoes = verificarConteudoNaSafeArea(
      fonte,
      variante,
      PLATAFORMA_16X9,
    );
    expect(violacoes.length).toBeGreaterThan(0);
    const margens = violacoes.flatMap((v) =>
      margensVioladas(imagemSobDerivacao(retanguloDeConteudo(fonte)!, fonte, variante), safeRectDaPlataforma(variante, PLATAFORMA_16X9)),
    );
    expect(margens.some((m) => m.margem === "esquerda")).toBe(true);
  });

  it("plataforma desconhecida para o canvas da variante e violacao nomeada", () => {
    const variante = derivarVariante(CANONICO, breakpoints.portrait);
    const violacoes = verificarVariante(CANONICO, variante);
    expect(violacoes.some((v) => v.regra === "C3" && v.mensagem.includes("plataforma"))).toBe(
      true,
    );
  });
});

// =============================================================================
// Conveniencia do relatorio — presenca das plataformas nos tokens
// =============================================================================

describe("variantes — contrato dos tokens (S-5) preservado", () => {
  it("o gate usa os MESMOS tokens (16:9 e 9:16 provisional) — pesquisa nao substitui", () => {
    // AB-584: a pesquisa de 2026 alimenta, nunca substitui, a decisao de
    // tokens. A autoridade do gate sao safeArea16x9 e safeArea9x16.
    expect(PLATAFORMA_16X9.fonte).toContain("safeArea16x9");
    expect(PLATAFORMA_9X16.fonte).toContain("safeArea9x16");
    expect(maxLines).toBeGreaterThan(0);
  });
});
