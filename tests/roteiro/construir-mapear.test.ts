/**
 * tests/roteiro/construir-mapear.test.ts
 *
 * O MAPEAMENTO tipo_visual -> no (mapear.ts) em especificacoes EXTREMAS:
 *
 *   - cada tipo_visual com especificacoes de borda (so numeros, so texto,
 *     linhas de lista com espacos/CRLF, acentos);
 *   - detectarTipoGrafico/detectarCenaManim: normalizacao de acento
 *     ("área" -> area), palavras-chave variadas e a PRECEDENCIA por
 *     ORDEM_DE_BUSCA (barras -> linha -> pizza -> area -> dispersao — a
 *     primeira palavra da primeira categoria que casar decide);
 *   - extrairDados: virgula decimal pt-BR, deduplicacao, zero, numeros
 *     embutidos em texto, dados ausentes -> placeholder;
 *   - separarItens: CRLF, espacos, linhas vazias, fallback para o titulo;
 *   - ErroAnexoAusente em TODOS os caminhos (gif E video, direto e pelo
 *     construtor) — erro nomeado com o tipo_visual no nome, nunca emissao
 *     invalida nem hash fabricado (C7);
 *   - licenca declarada no NoMidia (uso-pessoal-ADR-0003) e ajuste
 *     "contain" (conteudo alheio nao e cortado por cover).
 *
 * A tabela do contrato (§3/§5 de docs/roteiro/contrato-roteiro.md) e a
 * autoridade: cada assercao verifica a linha da tabela, nao a
 * implementacao.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  detectarCenaManim,
  detectarTipoGrafico,
  ErroAnexoAusente,
  extrairDados,
  LICENCA_ANEXO_USUARIO,
  mapearPedacoParaNo,
  separarItens,
} from "../../src/roteiro/construir/mapear.js";
import {
  isNoCabecalho,
  isNoGrafico,
  isNoLista,
  isNoMidia,
  isNoTexto,
  type No,
} from "../../src/contratos/manifesto.js";
import { construirManifesto } from "../../src/roteiro/construir/construir.js";
import type { Pedaco, Roteiro } from "../../src/roteiro/contrato/contrato.js";

const FIXTURES = join(__dirname, "fixtures");

function carregarRoteiro(nome: string): Roteiro {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as Roteiro;
}

function pedacoBase(roteiro: Roteiro, indice: number): Pedaco {
  return roteiro.pedacos[indice]!;
}

// ─── A tabela do contrato §3/§5 em especificacoes extremas ───────────────────

describe("mapearPedacoParaNo — cada tipo_visual com especificacao de borda", () => {
  const roteiro = carregarRoteiro("roteiro-valido.json");

  it("cabecalho: titulo vira texto, especificacao vira subtitulo, alinhamento centro", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "cabecalho" as const,
      titulo: "Titulo curto",
      especificacao_visual: "Subtitulo longo em prosa descrevendo o slide",
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 120) as No;
    expect(no.type).toBe("cabecalho");
    if (isNoCabecalho(no)) {
      expect(no.texto).toBe("Titulo curto");
      expect(no.subtitulo).toBe("Subtitulo longo em prosa descrevendo o slide");
      expect(no.alinhamento).toBe("centro");
      expect(no.schema).toBe("Cabecalho.1");
    } else {
      throw new Error("cabecalho deveria virar NoCabecalho");
    }
    expect(no.duracao_frames).toBe(120);
    expect(no.id).toBe("n-000");
  });

  it("texto: a especificacao inteira vira o texto do no", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "texto" as const,
      especificacao_visual: "  Texto com espacos nas bordas  ",
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 90);
    expect(isNoTexto(no)).toBe(true);
    if (isNoTexto(no)) {
      expect(no.texto).toBe("  Texto com espacos nas bordas  ");
      expect(no.schema).toBe("Texto.1");
    }
  });

  it("lista: uma linha por item, CRLF e espacos podados, sem quebra = um item", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "lista" as const,
      especificacao_visual: "  Primeiro  \r\n\r\nSegundo\r\n  Terceiro  ",
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 90);
    expect(isNoLista(no)).toBe(true);
    if (isNoLista(no)) {
      expect(no.itens).toEqual(["Primeiro", "Segundo", "Terceiro"]);
      expect(no.schema).toBe("Lista.1");
    }
  });

  it("lista com especificacao so de espacos: fallback para o titulo (nunca itens vazios)", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "lista" as const,
      titulo: "Slide da lista",
      especificacao_visual: "   \n \t \n",
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 90);
    if (isNoLista(no)) {
      expect(no.itens).toEqual(["Slide da lista"]);
    } else {
      throw new Error("lista deveria virar NoLista");
    }
  });

  it("gif: NoMidia com tipo_midia gif, hash do anexo, ajuste contain, licenca declarada", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "gif" as const,
      especificacao_visual: "GIF animado mostrando o fluxo",
      anexo_hash: "ab".repeat(32),
      anexo_meta: { tipo: "image/gif" as const, tamanho_bytes: 1024, nome_original: "fluxo.gif" },
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 90);
    expect(isNoMidia(no)).toBe(true);
    if (isNoMidia(no)) {
      expect(no.tipo_midia).toBe("gif");
      expect(no.hash).toBe("ab".repeat(32));
      expect(no.ajuste).toBe("contain");
      expect(no.texto_alternativo).toBe("GIF animado mostrando o fluxo");
      expect(no.licenca).toBe(LICENCA_ANEXO_USUARIO);
      expect(no.schema).toBe("Midia.1");
    } else {
      throw new Error("gif deveria virar NoMidia");
    }
  });

  it("video: NoMidia com tipo_midia video, hash do anexo, ajuste contain", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "video" as const,
      anexo_hash: "cd".repeat(32),
      anexo_meta: { tipo: "video/mp4" as const, tamanho_bytes: 25353, nome_original: "demo.mp4" },
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 90);
    expect(isNoMidia(no)).toBe(true);
    if (isNoMidia(no)) {
      expect(no.tipo_midia).toBe("video");
      expect(no.hash).toBe("cd".repeat(32));
      expect(no.ajuste).toBe("contain");
    }
  });

  it("grafico com especificacao SO de numeros: tipo barras (default), serie dos numeros", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "grafico" as const,
      titulo: "Medicoes",
      especificacao_visual: "120, 45, 78",
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 90);
    expect(isNoGrafico(no)).toBe(true);
    if (isNoGrafico(no)) {
      expect(no.tipo_grafico).toBe("barras");
      expect(no.dados.map((d) => d.valor)).toEqual([120, 45, 78]);
      expect(no.titulo).toBe("Medicoes");
      expect(no.schema).toBe("Grafico.1");
    }
  });

  it("manim: NoGrafico com a cena do catalogo que as palavras decidem", () => {
    const pedaco = {
      ...pedacoBase(roteiro, 0),
      tipo_visual: "manim" as const,
      especificacao_visual: "parabola e soma de Riemann",
    };
    const no = mapearPedacoParaNo(pedaco, "n-000", 90);
    expect(isNoGrafico(no)).toBe(true);
    if (isNoGrafico(no)) {
      expect(no.tipo_grafico).toBe("linha");
    }
  });
});

// ─── ErroAnexoAusente em todos os caminhos ───────────────────────────────────

describe("ErroAnexoAusente — gif E video, direto e pelo construtor", () => {
  const roteiro = carregarRoteiro("roteiro-valido.json");

  for (const tipoVisual of ["gif", "video"] as const) {
    it(`${tipoVisual} sem anexo_hash direto no mapeamento: erro nomeado com o tipo`, () => {
      const pedaco = {
        ...pedacoBase(roteiro, 0),
        tipo_visual: tipoVisual,
        anexo_hash: undefined,
        anexo_meta: undefined,
      };
      let lancou = false;
      try {
        mapearPedacoParaNo(pedaco, "n-000", 90);
      } catch (erro) {
        lancou = true;
        expect(erro).toBeInstanceOf(ErroAnexoAusente);
        const e = erro as ErroAnexoAusente;
        expect(e.code).toBe("ANEXO_EXIGIDO_PARA_GIF_VIDEO");
        expect(e.regra).toBe("anexo-exigido-para-gif-video");
        expect(String(e)).toContain(`tipo_visual "${tipoVisual}"`);
        expect(String(e)).toContain("SHA-256");
      }
      expect(lancou, `${tipoVisual} sem anexo nao e mapeavel`).toBe(true);
    });

    it(`${tipoVisual} sem anexo pelo construtor: recusado no contrato antes (nunca chega ao mapeamento)`, () => {
      // O roteiro com gif/video sem anexo e rejeitado por
      // rejeitarRoteiroInvalido (regra anexo-exigido-para-gif-video) —
      // o mapeamento nem e tentado; erro nomeado de CONTRATO.
      const mutado: Roteiro = {
        ...roteiro,
        pedacos: roteiro.pedacos.map((pedaco, i) =>
          i === 0
            ? { ...pedaco, tipo_visual: tipoVisual, especificacao_visual: "sem anexo" }
            : pedaco,
        ),
      };
      expect(() => construirManifesto(mutado)).toThrow(/anexo-exigido-para-gif-video/);
    });
  }
});

// ─── Detectores: normalizacao, palavras variadas, precedencia ────────────────

describe("detectarTipoGrafico — acentos, sinonimos e precedencia", () => {
  it("acentos sao normalizados (NFD): 'Área' casa 'area', 'Distribuição' casa pizza", () => {
    expect(detectarTipoGrafico("Área empilhada")).toBe("area");
    expect(detectarTipoGrafico("Distribuição de proporções")).toBe("pizza");
  });

  it("sinonimos de cada categoria", () => {
    expect(detectarTipoGrafico("histograma de colunas")).toBe("barras");
    expect(detectarTipoGrafico("barra comparativa")).toBe("barras");
    expect(detectarTipoGrafico("curva de evolucao")).toBe("linha");
    expect(detectarTipoGrafico("serie temporal")).toBe("linha");
    expect(detectarTipoGrafico("torta de fatias")).toBe("pizza");
    expect(detectarTipoGrafico("scatter de pontos")).toBe("dispersao");
    expect(detectarTipoGrafico("relacao entre x e y")).toBe("dispersao");
    expect(detectarTipoGrafico("acumulado por mes")).toBe("area");
  });

  it("precedencia: a PRIMEIRA categoria da ORDEM_DE_BUSCA que casar decide", () => {
    // Ordem: barras -> linha -> pizza -> area -> dispersao. A palavra da
    // categoria de maior precedencia vence mesmo citada depois.
    expect(detectarTipoGrafico("barras e dispersao")).toBe("barras");
    expect(detectarTipoGrafico("pizza com linhas de tendencia")).toBe("linha");
    expect(detectarTipoGrafico("linha e pizza")).toBe("linha");
    expect(detectarTipoGrafico("dispersao com barras")).toBe("barras");
    // "curva" e palavra de LINHA (que precede area): a especificacao que
    // fala de area mas cita curva e classificada como linha — a ordem
    // decide, nao a intencao.
    expect(detectarTipoGrafico("área sob a curva")).toBe("linha");
  });

  it("sem palavra conhecida: barras (a cena mais generica)", () => {
    expect(detectarTipoGrafico("grafico generico sem nenhuma palavra da tabela")).toBe("barras");
    expect(detectarTipoGrafico("")).toBe("barras");
  });
});

describe("detectarCenaManim — palavras do catalogo e normalizacao", () => {
  it("cada cena do catalogo pelas suas palavras", () => {
    expect(detectarCenaManim("E = mc2 e energia de massa")).toBe("barras");
    expect(detectarCenaManim("einstein e a relatividade")).toBe("barras");
    expect(detectarCenaManim("soma de Riemann na parabola")).toBe("linha");
    expect(detectarCenaManim("integral e funcoes")).toBe("linha");
    expect(detectarCenaManim("identidade de Euler com exponencial")).toBe("pizza");
    expect(detectarCenaManim("serie de Taylor termo a termo")).toBe("area");
    expect(detectarCenaManim("aproximacao polinomial")).toBe("area");
    expect(detectarCenaManim("circulo unitario e cosseno")).toBe("dispersao");
    expect(detectarCenaManim("pontos no circulo e seno")).toBe("dispersao");
  });

  it("normalizacao de acento tambem vale para as palavras do catalogo", () => {
    expect(detectarCenaManim("área sob a curva")).toBe("linha");
    expect(detectarCenaManim("séries de Taylor")).toBe("area");
  });

  it("sem palavra conhecida: barras (einstein — a cena mais generica)", () => {
    expect(detectarCenaManim("animacao generica estilo 3b1b")).toBe("barras");
    expect(detectarCenaManim("")).toBe("barras");
  });
});

// ─── extrairDados: numeros reais, pt-BR, dedupe, ausencia ────────────────────

describe("extrairDados — series sinteticas deterministicas", () => {
  it("virgula decimal pt-BR vira ponto (3,14 -> 3.14)", () => {
    const serie = extrairDados("pi vale 3,14 e raiz vale 1,41", "Titulo");
    expect(serie.map((d) => d.valor)).toEqual([3.14, 1.41]);
  });

  it("ponto decimal ja valido e aceito (3.5)", () => {
    expect(extrairDados("média 3.5", "T").map((d) => d.valor)).toEqual([3.5]);
  });

  it("numeros duplicados sao deduplicados (5, 5, 5 -> [5])", () => {
    const serie = extrairDados("5, 5, 5", "T");
    expect(serie.map((d) => d.valor)).toEqual([5]);
  });

  it("zero e um numero valido (nao cai no placeholder)", () => {
    expect(extrairDados("resultado: 0", "T").map((d) => d.valor)).toEqual([0]);
  });

  it("numeros embutidos em texto sao extraidos (120ms e 45ms)", () => {
    expect(extrairDados("resposta em 120ms, depois 45ms", "T").map((d) => d.valor)).toEqual([
      120,
      45,
    ]);
  });

  it("dados ausentes (sem nenhum numero): placeholder com o titulo, valor 1", () => {
    expect(extrairDados("sem numeros nenhum nesta especificacao", "Slide de exemplo")).toEqual([
      { rotulo: "Slide de exemplo", valor: 1 },
    ]);
    expect(extrairDados("", "Slide de exemplo")).toEqual([
      { rotulo: "Slide de exemplo", valor: 1 },
    ]);
  });

  it("rotulos sao sequenciais (Dado 1..N) e o numero de itens e o da serie", () => {
    const serie = extrairDados("valores: 120, 45, 78", "T");
    expect(serie.map((d) => d.rotulo)).toEqual(["Dado 1", "Dado 2", "Dado 3"]);
  });
});

// ─── separarItens: formas de quebra e fallback ───────────────────────────────

describe("separarItens — quebras de linha e fallback", () => {
  it("CRLF e LF sao equivalentes (o \r e podado pelo trim)", () => {
    expect(separarItens("a\r\nb\nc", "t")).toEqual(["a", "b", "c"]);
  });

  it("espacos ao redor sao podados por item", () => {
    expect(separarItens("  a  \n\t b \n c  ", "t")).toEqual(["a", "b", "c"]);
  });

  it("linha unica sem quebra = um item so", () => {
    expect(separarItens("item unico", "t")).toEqual(["item unico"]);
  });

  it("especificacao vazia ou so espacos: fallback para o titulo (funcao total)", () => {
    expect(separarItens("", "fallback")).toEqual(["fallback"]);
    expect(separarItens("  \n \t ", "fallback")).toEqual(["fallback"]);
  });
});
