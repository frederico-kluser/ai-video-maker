// =============================================================================
// fiar — o oraculo da suite integrada: fiacao, duracao, pintor e contratos
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// O que este arquivo prova, sem navegador (react-dom/server), em cima da
// arvore integrada de fixtures/snapshots/integrado:
//
//   1. A fixture integrada NAO divergiu do manifesto canonico (a copia tem
//      de ser fiel — a divergencia seria a fonte de um oraculo cego).
//   2. A DURACAO total bate com a aritmetica SUBTRATIVA calculada a mao
//      (soma das cenas menos soma das fronteiras), e a timeline e coerente
//      (pergunta adversarial 2 do PROGRAMA: o teste nao olha so exit code).
//   3. O PINTOR DE CENA REAL: dentro de uma fronteira, as DUAS cenas
//      desenham; fora, so uma. O pintor injetado no SequenciaComTransicoes
//      e o pintor do registro de nos (pergunta adversarial 4).
//   4. AB-312: o fade de saida do cabecalho NAO e multiplicado pela
//      transicao de cena — o valor renderizado e exatamente o da propria
//      janela do no, em frames de fronteira.
//   5. AB-364: todo asset de grafico fiado tem `fonte`; asset fiado sem
//      fonte e ErroDeGraficoOpaco nomeando o no.
//   6. AB-313: a entrada do render integrado registra as fontes locais.
// =============================================================================

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { calcularDuracao, validarTimeline } from "../../../src/composicao/tempo";
import { ErroDeGraficoOpaco } from "../../../src/composicao/nos/grafico";
import type { NoGraficoResolvido } from "../../../src/composicao/nos/grafico";
import { background } from "../../../src/design/tokens";
import {
  ArvoreIntegrada,
  FIXTURA_INTEGRADA,
  HASH_DO_GRAFICO,
  fiar,
  manifestoCanonico,
  pintorDeCena,
  resolverPadrao,
} from "./fiar";
import { SequenciaComTransicoes } from "../../../src/composicao/transicoes/sequencia";

const CANONICO = manifestoCanonico();
const AQUI = resolve(import.meta.dirname);

// ---------------------------------------------------------------------------
// 1. A fixture integrada e fiel ao manifesto canonico
// ---------------------------------------------------------------------------

describe("A fixture integrada e o manifesto canonico", () => {
  it("o bloco manifesto da fixture e deep-equal ao canonico (nos e cenas)", () => {
    expect(FIXTURA_INTEGRADA.manifesto).toEqual(CANONICO);
  });

  it("o hash_manifesto_original e o SHA-256 dos bytes do canonico", () => {
    const bytes = readFileSync(
      resolve(AQUI, "..", "..", "..", "fixtures", "canonico", "manifesto-valido.json"),
    );
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(FIXTURA_INTEGRADA.hash_manifesto_original).toBe(hash);
  });

  it("todo asset de grafico declarado em nos_grafico existe em assets (AB-364)", () => {
    for (const [noId, hash] of Object.entries(FIXTURA_INTEGRADA.nos_grafico)) {
      const asset = FIXTURA_INTEGRADA.assets[hash];
      expect(asset, `asset de ${noId} ausente em assets`).toBeDefined();
      expect(asset?.hash).toBe(hash);
    }
  });

  it("todo no de grafico da fixture tem asset fiado com fonte (AB-364)", () => {
    const estado = fiar(FIXTURA_INTEGRADA, resolverPadrao);
    const graficos = estado.manifesto.nos.filter((n) => n.type === "grafico");
    const fiados = graficos.filter(
      (n) => (n as NoGraficoResolvido).grafico_resolvido !== undefined,
    );

    // A fiacao anexou o asset a pelo menos um no (o caminho de producao
    // tem de renderizar) e deixou pelo menos um no no caminho "dados"
    // (o desenho do manifesto tem de continuar funcionando).
    expect(fiados.length).toBeGreaterThan(0);
    expect(fiados.length).toBeLessThan(graficos.length);

    for (const no of fiados) {
      const resolvido = (no as NoGraficoResolvido).grafico_resolvido!;
      expect(resolvido.fonte, `no grafico "${no.id}" sem fonte`).toBeTruthy();
      expect(resolvido.asset.hash).toBe(HASH_DO_GRAFICO);
    }

    // TODO asset fiado TEM de ter fonte: a regra de AB-364.
    for (const no of graficos) {
      const resolvido = (no as NoGraficoResolvido).grafico_resolvido;
      if (resolvido !== undefined) {
        expect(resolvido.fonte, `no grafico "${no.id}" sem fonte`).toBeTruthy();
      }
    }
  });

  it("asset fiado SEM fonte e ErroDeGraficoOpaco nomeando o no (AB-364)", () => {
    const fixture = JSON.parse(JSON.stringify(FIXTURA_INTEGRADA)) as typeof FIXTURA_INTEGRADA;
    const estado = fiar(fixture, resolverPadrao);
    const no = estado.manifesto.nos.find((n) => n.id === "n-009");
    expect(no, "n-009 existe na fixture").toBeDefined();
    const grafico = no as NoGraficoResolvido & {
      grafico_resolvido?: NoGraficoResolvido["grafico_resolvido"];
    };
    // A fiacao que entrega o asset mas esquece o caminho local.
    grafico.grafico_resolvido = { asset: grafico.grafico_resolvido!.asset };

    const renderizar = () =>
      renderToStaticMarkup(
        createElement(pintorDeCena(estado), {
          cenaId: "c-004",
          frame: 32,
          frameAbsoluto: 427 + 32,
          lado: null,
          fps: 30,
          width: 1920,
          height: 1080,
        }),
      );
    expect(renderizar).toThrow(ErroDeGraficoOpaco);
    try {
      renderizar();
    } catch (erro) {
      const mensagem = (erro as Error).message;
      expect(mensagem).toContain("n-009");
      expect(mensagem).toContain("caminho local");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. A duracao total — a aritmetica subtraTIVA calculada a mao
// ---------------------------------------------------------------------------

describe("A duracao da composicao integrada", () => {
  // Calculado a mao a partir da fixture canonica (fixtures/canonico/
  // manifesto-valido.json), sem rodar o motor:
  //
  //   cena      nos (duracao)                     duracao da cena
  //   c-001     n-001 cabecalho (90)                    90
  //   c-002     n-002 texto (120), n-003 lista (30+180) 210
  //   c-003     n-005 midia (90), n-008 codigo (180),
  //             n-004 lista (150)                      180
  //   c-004     n-009..n-013 graficos (120/90x4)       120
  //   c-005     n-014 texto (30+150), n-006 (60),
  //             n-007 (15+45), n-015 (60)              180
  //
  //   soma das cenas      = 90 + 210 + 180 + 120 + 180 = 780
  //   fronteiras (saida)  = c-001 fade 15, c-002 wipe 20,
  //                         c-003 clockWipe 18, c-004 -> c-005 none 0
  //                       = 53
  //   TOTAL               = 780 - 53 = 727
  //
  //   727 e o numero que a propria fixture declara em duracao_total_frames.
  const SOMA_CENAS = 780;
  const SOMA_FRONTEIRAS = 53;
  const TOTAL = 727;

  const JANELAS_ESPERADAS: readonly [string, number, number][] = [
    ["c-001", 0, 90],
    ["c-002", 75, 285],
    ["c-003", 265, 445],
    ["c-004", 427, 547],
    ["c-005", 547, 727],
  ];

  it("total = soma das cenas - soma das fronteiras (subtrativa, 727)", () => {
    const duracao = calcularDuracao(CANONICO);
    expect(duracao.somaCenas).toBe(SOMA_CENAS);
    expect(duracao.somaTransicoes).toBe(SOMA_FRONTEIRAS);
    expect(duracao.totalFrames).toBe(TOTAL);
    expect(duracao.totalFrames).toBe(SOMA_CENAS - SOMA_FRONTEIRAS);
    expect(duracao.totalSegundos).toBeCloseTo(TOTAL / 30, 6);
  });

  it("a fixture integrada declara o mesmo total que a aritmetica", () => {
    const duracao = calcularDuracao(FIXTURA_INTEGRADA.manifesto);
    expect(duracao.totalFrames).toBe(TOTAL);
    expect((CANONICO as { duracao_total_frames?: number }).duracao_total_frames).toBe(
      TOTAL,
    );
  });

  it("a timeline posiciona cada cena na janela esperada (calculada a mao)", () => {
    const duracao = calcularDuracao(CANONICO);
    for (const [cenaId, inicio, fim] of JANELAS_ESPERADAS) {
      const janela = duracao.timeline.find((t) => t.cenaId === cenaId);
      expect(janela, `cena ${cenaId} sem janela`).toBeDefined();
      expect(janela?.frameInicial).toBe(inicio);
      expect(janela?.frameFinal).toBe(fim);
    }
    // A ultima janela fecha o video: nenhuma cauda preta por construcao.
    const ultima = duracao.timeline[duracao.timeline.length - 1]!;
    expect(ultima.frameFinal).toBe(TOTAL);
  });

  it("a timeline passa na validacao de coerencia", () => {
    const duracao = calcularDuracao(CANONICO);
    expect(validarTimeline(duracao.timeline)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. O pintor de cena REAL — quem pinta dentro de uma fronteira
// ---------------------------------------------------------------------------

describe("O pintor de cena injetado no SequenciaComTransicoes", () => {
  it("em frame de fronteira as DUAS cenas desenham ao mesmo tempo", () => {
    // Fronteira c-001 -> c-002: fade de 15 frames, janela [75, 90).
    // Frame 82: progresso 7/15. As duas cenas existem na arvore.
    const html = renderToStaticMarkup(
      createElement(ArvoreIntegrada, { fixture: FIXTURA_INTEGRADA, frame: 82 }),
    );
    expect(html).toContain('data-cena="c-001"');
    expect(html).toContain('data-cena="c-002"');
    expect(html).toContain('data-transicao="fade"');
    // E cada lado desenha os SEUS nos: o cabecalho que sai, o texto que entra.
    expect(html).toContain('data-no="n-001"');
    expect(html).toContain('data-no="n-002"');
  });

  it("fora de fronteira so a cena do frame desenha", () => {
    const html = renderToStaticMarkup(
      createElement(ArvoreIntegrada, { fixture: FIXTURA_INTEGRADA, frame: 300 }),
    );
    expect(html).toContain('data-cena="c-003"');
    expect(html).not.toContain('data-cena="c-002"');
    expect(html).not.toContain('data-cena="c-004"');
    // O pintor real: os tres nos da cena, com o frame local de cada um.
    expect(html).toContain('data-no="n-005"');
    expect(html).toContain('data-no="n-008"');
    expect(html).toContain('data-no="n-004"');
  });

  it("o pintor injetado usa o REGISTRO DE NOS de producao, nao um pintor chapado", () => {
    // O SequenciaComTransicoes recebe o pintor por prop (AB-374). O pintor
    // deste modulo devolve os mesmos componentes que a raiz (ManifestoRaiz)
    // usaria: os `data-no` so existem porque o registro de producao foi
    // consultado — um pintor chapado nao emitiria nenhum data-no.
    const html = renderToStaticMarkup(
      createElement(SequenciaComTransicoes, {
        manifesto: FIXTURA_INTEGRADA.manifesto,
        frame: 300,
        Cena: pintorDeCena(fiar(FIXTURA_INTEGRADA, resolverPadrao)),
      }),
    );
    expect(html).toContain('data-no="n-005"');
    expect(html).toContain('data-no="n-008"');
  });

  it("nenhum no desenha fora da propria janela, mesmo dentro da cena", () => {
    // n-003 (lista) comeca em entrada_frames 30 da cena c-002. No frame 10
    // da cena ele NAO pode desenhar; no frame 45, desenha.
    const estado = fiar(FIXTURA_INTEGRADA, resolverPadrao);
    const pintor = pintorDeCena(estado);
    const cedo = renderToStaticMarkup(
      createElement(pintor, {
        cenaId: "c-002",
        frame: 10,
        frameAbsoluto: 75 + 10,
        lado: null,
        fps: 30,
        width: 1920,
        height: 1080,
      }),
    );
    const tarde = renderToStaticMarkup(
      createElement(pintor, {
        cenaId: "c-002",
        frame: 45,
        frameAbsoluto: 75 + 45,
        lado: null,
        fps: 30,
        width: 1920,
        height: 1080,
      }),
    );
    expect(cedo).not.toContain('data-no="n-003"');
    expect(tarde).toContain('data-no="n-003"');
  });
});

// ---------------------------------------------------------------------------
// 4. AB-312 — o fade de saida do cabecalho nao e multiplicado pela transicao
// ---------------------------------------------------------------------------

describe("AB-312: o fade de saida do cabecalho nao e multiplicado pela transicao", () => {
  // O cabecalho n-001 (c-001, duracao 90) some nos ultimos frames da
  // PROPRIA janela: saida = msToFrames(snap = 200 ms, 30 fps) = 6 frames,
  // fade em [84, 90). A fronteira c-001 -> c-002 (fade de 15) ocupa
  // [75, 90) — os dois fades COEXISTEM nos frames [84, 90).
  //
  // A regra de AB-312: o valor do no e exatamente o da propria janela,
  // nunca multiplicado pelo progresso da transicao. O markup do titulo
  // carrega `opacity` — a expectativa e escrita a mao, da aritmetica do no:
  //   frame 82 -> fade do no ainda nao comecou        -> opacidade 1
  //   frame 88 -> (90 - 88) / (90 - 84) = 0.3333...   -> opacidade 1/3
  // Se um bug multiplicasse pelo progresso da cena (82: 7/15, 88: 13/15),
  // o valor renderizado seria menor — e o teste ficaria VERMELHO.
  function opacidadeDoTituloDoCabecalho(frame: number): number | null {
    const html = renderToStaticMarkup(
      createElement(ArvoreIntegrada, { fixture: FIXTURA_INTEGRADA, frame }),
    );
    // O h1 do cabecalho e o primeiro <h1> do markup.
    const m = /<h1[^>]*style="([^"]*)"/.exec(html);
    if (!m) return null;
    const estilo = m[1]!;
    const opacity = /opacity:([0-9.]+)/.exec(estilo);
    return opacity ? Number(opacity[1]) : null;
  }

  it("em frame de fronteira antes do fade do no, a opacidade do titulo e 1", () => {
    const opacidade = opacidadeDoTituloDoCabecalho(82);
    expect(opacidade).not.toBeNull();
    expect(opacidade).toBeCloseTo(1, 6);
  });

  it("em frame de fronteira dentro do fade do no, a opacidade e a da propria janela", () => {
    const opacidade = opacidadeDoTituloDoCabecalho(88);
    expect(opacidade).not.toBeNull();
    // 1/3: a aritmetica linear do no em [84, 90]. Um fade multiplicado
    // pela transicao (13/15) daria 0.2889 — fora da precisao de 6 casas.
    expect(opacidade).toBeCloseTo(1 / 3, 6);
  });

  it("fora da fronteira o titulo nao carrega fade algum (opacidade 1)", () => {
    const opacidade = opacidadeDoTituloDoCabecalho(30);
    expect(opacidade).toBeCloseTo(1, 6);
  });
});

// ---------------------------------------------------------------------------
// 5. AB-313 — as fontes locais estao registradas no render integrado
// ---------------------------------------------------------------------------

describe("AB-313: fontes locais registradas na entrada do render integrado", () => {
  it("a entrada do render integrado chama registrarFontesLocais no escopo de modulo", () => {
    const entrada = readFileSync(
      resolve(AQUI, "..", "..", "..", "fixtures", "snapshots", "integrado", "entrada.tsx"),
      "utf8",
    );
    expect(entrada).toContain("registrarFontesLocais");
    // No escopo de modulo: a chamada aparece ANTES do registerRoot, fora de
    // qualquer funcao — o comentario que a precede nomeia o por que (C6).
    const posChamada = entrada.indexOf("registrarFontesLocais");
    const posRoot = entrada.indexOf("registerRoot");
    expect(posChamada).toBeGreaterThanOrEqual(0);
    expect(posRoot).toBeGreaterThan(posChamada);
  });

  it("a entrada serve as fontes pelo publicDir da fixture (symlink fontes)", () => {
    const entrada = readFileSync(
      resolve(AQUI, "..", "..", "..", "fixtures", "snapshots", "integrado", "entrada.tsx"),
      "utf8",
    );
    expect(entrada).toContain("publicDir");
  });
});

// ---------------------------------------------------------------------------
// 6. O contrato de alfa do no de midia na arvore integrada (AB-344)
// ---------------------------------------------------------------------------

describe("AB-344: o no de midia preserva o alfa na arvore integrada", () => {
  it("a raiz do marcador de midia nao pinta cor de fundo nenhuma", () => {
    const html = renderToStaticMarkup(
      createElement(ArvoreIntegrada, { fixture: FIXTURA_INTEGRADA, frame: 577 }),
    );
    // O marcador de midia (n-006) emite data-alfa="preservado" e NAO tem
    // backgroundColor na raiz — o fundo opaco no compositor sairia do
    // contrato do no (F1-07) e o alfa do asset sumiria.
    const marcador = html.match(/data-no="n-006"[\s\S]{0,400}/)?.[0] ?? "";
    expect(marcador).toContain('data-alfa="preservado"');
    expect(marcador).not.toContain("background");
    // A cor de fundo da composicao e a do token, aplicada pela RAIZ e pelas
    // camadas — nunca pelo no de midia.
    expect(html).toContain(background.primary);
  });
});
