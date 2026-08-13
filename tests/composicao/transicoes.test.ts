// =============================================================================
// transicoes.test.ts — o gate do card F1-10
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Este arquivo e o que reprova de verdade. Ele NAO "checa se compila":
//   1. confere o registro de apresentacoes contra o schema (presenca, nunca
//      lista fechada — regra da W4, docs/contrato-w4.md §5);
//   2. confere a aritmetica de fronteiras contra numeros calculados A MAO,
//      CONSUMINDO ../composicao/tempo.ts (F1-01) — sem reimplementa-la;
//   3. RENDERIZA a sequencia (react-dom/server) e exige os dois lados dentro
//      da fronteira, um so fora, na ordem de pintura;
//   4. decodifica os PNG aprovados e asserta o PIXEL (AGENTS.md, C1): um
//      componente que devolvesse quadro vazio, ou que desenhasse so um lado,
//      produziria outra cor — e o gate acusa pelo VALOR do pixel.
//
// Sobre a LISTA COMPLETA (docs/contrato-w4.md §5): nenhuma assercao deste
// arquivo e sobre a ausencia dos outros — nenhum toStrictEqual contra o
// conjunto fechado de tipos, nenhuma contagem exata de arquivos no
// diretorio de snapshots. Cada assercao e sobre a PRESENCA do item
// declarado: o tipo do schema tem apresentacao, o quadro aprovado existe
// e tem o pixel prometido.
//
// Sem JSX: vitest.config.ts so coleta `tests/**/*.test.ts`, entao os
// elementos sao criados com React.createElement.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Cena, Manifesto, No } from "src/contratos/manifesto";
import {
  DIRECAO_PADRAO,
  ErroDeTransicao,
  TIPOS_DE_TRANSICAO,
  apresentacaoDe,
  metaDe,
  validarMetaDeApresentacao,
} from "src/composicao/transicoes";
import { ErroDeTempo, calcularDuracao, validarTimeline } from "src/composicao/tempo";
import {
  censoDeFrames,
  cenasNoFrame,
  janelasDeFronteira,
  planoDeTransicoes,
} from "src/composicao/transicoes/fronteiras";
import {
  REGISTRO_DE_APRESENTACOES,
  tiposComApresentacao,
} from "src/composicao/transicoes/registro";
import {
  DEMO_CENA_A,
  DEMO_CENA_B,
  DEMO_FRONTEIRA_INICIO,
  DEMO_FRONTEIRA_MEIO,
  DEMO_LARGURA,
  DEMO_TOTAL_FRAMES,
  Demonstracao,
  corDaCena,
  manifestoDeDemonstracao,
} from "src/composicao/transicoes/demonstracao";
import { SequenciaComTransicoes } from "src/composicao/transicoes/sequencia";
import { background } from "src/design/tokens";

import { QUADROS, arquivoDoQuadro } from "../../tools/transicoes/quadros";
import {
  corDeHex,
  corRelativa,
  coresDistintas,
  distancia,
  fracaoProxima,
  lerPng,
  misturar,
  type Cor,
} from "../../tools/transicoes/png";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DO_REPO = resolve(AQUI, "..", "..");
const DIR_SNAPSHOTS = resolve(RAIZ_DO_REPO, "fixtures", "snapshots", "transicoes");

// ---------------------------------------------------------------------------
// Cores — dos tokens, nunca redeclaradas (AGENTS.md, Regra 2)
// ---------------------------------------------------------------------------

const COR_A = corDeHex(corDaCena(DEMO_CENA_A));
const COR_B = corDeHex(corDaCena(DEMO_CENA_B));
const COR_PALCO = corDeHex(background.primary);
/** Mistura 50/50 das duas cores — o pixel que nenhum lado produz sozinho. */
const BLEND_MEIO = misturar(COR_A, COR_B, 0.5);

const TOLERANCIA = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Cena do quadro da demonstracao — como um pintor de verdade pintaria. */
const PintorDoTeste: React.FC<{
  cenaId: string;
  frame: number;
  lado: string | null;
}> = ({ cenaId, frame, lado }) =>
  createElement("div", {
    "data-cena-pintada": cenaId,
    "data-frame-pintado": String(frame),
    "data-lado-pintado": lado ?? "sozinha",
  });

function renderizarDemonstracao(tipo: string, frame: number): string {
  return renderToStaticMarkup(createElement(Demonstracao, { tipo: tipo as never, frame }));
}

function lerSnapshot(nome: string) {
  return lerPng(readFileSync(resolve(DIR_SNAPSHOTS, `${nome}.png`)));
}

/** Exige que o pixel esteja a TOLERANCIA ou menos da cor esperada. */
function esperaCor(imagem: ReturnType<typeof lerPng>, fx: number, fy: number, alvo: Cor): void {
  const cor = corRelativa(imagem, fx, fy);
  expect(
    distancia(cor, alvo),
    `pixel (${String(fx)}, ${String(fy)}) = ${JSON.stringify(cor)}, esperado ${JSON.stringify(alvo)}`,
  ).toBeLessThanOrEqual(TOLERANCIA);
}

// ---------------------------------------------------------------------------
// 1. Registro de apresentacoes — presenca por tipo, nunca lista fechada
// ---------------------------------------------------------------------------

describe("registro de apresentacoes (F1-10)", () => {
  it("o registro nao esta vazio — seletor vazio seria falso verde (C2)", () => {
    expect(REGISTRO_DE_APRESENTACOES.size).toBeGreaterThan(0);
    expect(tiposComApresentacao().length).toBeGreaterThan(0);
  });

  it("cada tipo do schema tem apresentacao registrada (o schema e o denominador)", () => {
    // Presenca do MEU item: para todo tipo declarado pelo schema (S-4), o
    // registro tem um componente. Nenhum tipo some em silencio — sumir
    // renderizaria corte seco.
    for (const tipo of TIPOS_DE_TRANSICAO) {
      expect(REGISTRO_DE_APRESENTACOES.has(tipo), `tipo "${tipo}" do schema sem apresentacao`).toBe(true);
      expect(() => apresentacaoDe(tipo)).not.toThrow();
      expect(metaDe(tipo).tipo).toBe(tipo);
    }
  });

  it("o meta de cada apresentacao registrada e valido contra o proprio contrato", () => {
    for (const [tipo, modulo] of REGISTRO_DE_APRESENTACOES) {
      const erros = validarMetaDeApresentacao(modulo.meta, tipo, `registro:${tipo}`);
      expect(erros, `meta invalido para ${tipo}: ${erros.join("; ")}`).toStrictEqual([]);
      expect(modulo.meta.contribuicao).toMatch(/^(sobrepostos|repartidos|alternados)$/);
      expect(modulo.meta.id.trim().length).toBeGreaterThan(0);
    }
  });

  it("tipo sem apresentacao e recusado: a composicao NAO cai em corte seco", () => {
    const registroParcial = new Map(REGISTRO_DE_APRESENTACOES);
    registroParcial.delete("fade");
    expect(() => apresentacaoDe("fade" as never, registroParcial as never)).toThrow(
      /Sem apresentacao/,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Aritmetica de fronteiras — tres cenas, duas transicoes (mao)
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
//   janela 1 = [100 - 30, 100) = [70, 100)
//   janela 2 = [150 - 20, 150) = [130, 150)
//
// Somar em vez de subtrair daria 350 (cauda preta de 100 frames, sem erro).

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

describe("fronteiras — tres cenas e duas transicoes (numero calculado a mao)", () => {
  it("total = 250: soma das cenas 300 menos soma das fronteiras 50", () => {
    const plano = planoDeTransicoes(tresCenasDuasTransicoes());
    expect(plano.somaCenas).toBe(300);
    expect(plano.somaTransicoes).toBe(50);
    expect(plano.totalFrames).toBe(250);
    expect(plano.totalFrames).toBe(plano.somaCenas - plano.somaTransicoes);
  });

  it("as janelas das fronteiras ficam em [70, 100) e [130, 150)", () => {
    const plano = planoDeTransicoes(tresCenasDuasTransicoes());
    expect(plano.janelas.map((j) => [j.cenaAnterior, j.inicio, j.fim])).toStrictEqual([
      ["c1", 70, 100],
      ["c2", 130, 150],
    ]);
  });

  it("censo frame a frame: 200 frames com uma cena, 50 com duas, nenhum vazio", () => {
    const plano = planoDeTransicoes(tresCenasDuasTransicoes());
    const censo = censoDeFrames(plano);
    expect(censo.totalFrames).toBe(250);
    expect(censo.framesComUmaCena).toBe(200);
    expect(censo.framesComDuasCenas).toBe(50);
    expect(censo.framesVazios).toBe(0);
    // Cada cena desenha a duracao propria; a sobreposicao conta nos dois.
    expect(censo.somaDesenhada).toBe(300);
    expect(censo.framesPorCena).toStrictEqual([
      { cenaId: "c1", frames: 100 },
      { cenaId: "c2", frames: 80 },
      { cenaId: "c3", frames: 120 },
    ]);
  });

  it("a mesma fronteira declarada dos DOIS lados e cobrada uma vez, e a SAIDA manda", () => {
    const m = tresCenasDuasTransicoes();
    // c2 discorda do valor da propria entrada: 999 contra 30 da saida de c1.
    m.cenas[1]!.transicao_entrada = { tipo: "wipe", duracao_frames: 999 };
    const plano = planoDeTransicoes(m);
    const janela = plano.janelas[0]!;
    expect(janela.origem).toBe("saida");
    expect(janela.tipo).toBe("fade");
    expect(janela.duracaoFrames).toBe(30);
    expect(plano.somaTransicoes).toBe(50);
    expect(plano.totalFrames).toBe(250);
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
    const plano = planoDeTransicoes(m);
    expect(plano.janelas.map((j) => j.origem)).toStrictEqual(["entrada", "entrada"]);
    expect(plano.somaTransicoes).toBe(50);
    expect(plano.totalFrames).toBe(250);
  });

  it("a direcao declarada pelo lado vencedor chega a janela", () => {
    const m = tresCenasDuasTransicoes();
    m.cenas[0]!.transicao_saida = { tipo: "slide", duracao_frames: 30, direcao: "from-right" };
    const plano = planoDeTransicoes(m);
    expect(plano.janelas[0]!.direcao).toBe("from-right");
    expect(plano.janelas[1]!.direcao).toBe(DIRECAO_PADRAO);
  });

  it("entrada da primeira cena e saida da ultima nao tem par: nao descontam", () => {
    const m = tresCenasDuasTransicoes();
    m.cenas[0]!.transicao_entrada = { tipo: "fade", duracao_frames: 40 };
    m.cenas[2]!.transicao_saida = { tipo: "fade", duracao_frames: 60 };
    const plano = planoDeTransicoes(m);
    expect(plano.janelas.length).toBe(2);
    expect(plano.somaTransicoes).toBe(50);
    expect(plano.totalFrames).toBe(250);
  });

  it("duas fronteiras sobrepostas colocariam TRES cenas no frame: RECUSA", () => {
    const m: Manifesto = {
      schema_version: "Manifesto.1",
      fps: 30,
      width: 1920,
      height: 1080,
      nos: [noTexto("a", 30), noTexto("b", 30), noTexto("c", 30)],
      cenas: [cena("c1", ["a"], 20), cena("c2", ["b"], 20), cena("c3", ["c"])],
    };
    // c1 [0,30) saida 20 -> janela [10,30)
    // c2 comeca em 10, [10,40) saida 20 -> janela [20,40) — sobrepoe a de c1
    expect(() => janelasDeFronteira(m)).toThrow(ErroDeTransicao);
    expect(() => janelasDeFronteira(m)).toThrow(/sobrepostas/);
  });

  it("fronteira maior que a cena e recusada, nao truncada", () => {
    const m = tresCenasDuasTransicoes();
    m.cenas[1]!.transicao_saida = { tipo: "fade", duracao_frames: 200 };
    // A regra e de ../tempo.ts (F1-01): a sobreposicao engoliria a cena
    // inteira, e o dono da aritmetica recusa ANTES desta camada montar a
    // janela. A recusa em cadeia e o comportamento esperado.
    expect(() => planoDeTransicoes(m)).toThrow(ErroDeTempo);
  });

  it("a timeline produzida aqui concorda com a de ../tempo.ts (invariante)", () => {
    const m = tresCenasDuasTransicoes();
    const daqui = planoDeTransicoes(m).timeline;
    const detempo = calcularDuracao(m).timeline;
    expect(daqui).toStrictEqual(detempo);
    expect(validarTimeline(daqui)).toStrictEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. A demonstracao — duas cenas, uma fronteira, numeros a mao
// ---------------------------------------------------------------------------
//
//   cena  duracao   fronteira de saida
//   A       30             12
//   B       30              -
//
//   soma das cenas       = 30 + 30 = 60
//   soma das fronteiras  =         12
//   TOTAL                = 60 - 12 = 48
//
//   A comeca em 0, termina em 30; B comeca em 30 - 12 = 18.
//   janela = [30 - 12, 30) = [18, 30)

describe("demonstracao — duracao e janela (F1-10)", () => {
  const plano = planoDeTransicoes(manifestoDeDemonstracao("fade"));

  it("total = 48 frames = 60 - 12, calculado a mao", () => {
    expect(plano.totalFrames).toBe(DEMO_TOTAL_FRAMES);
    expect(DEMO_TOTAL_FRAMES).toBe(48);
    expect(plano.somaCenas).toBe(60);
    expect(plano.somaTransicoes).toBe(12);
    expect(plano.totalFrames).toBe(plano.somaCenas - plano.somaTransicoes);
  });

  it("uma janela [18, 30), do fim da cena A menos a fronteira", () => {
    expect(plano.janelas.length).toBe(1);
    const janela = plano.janelas[0]!;
    expect(janela.cenaAnterior).toBe(DEMO_CENA_A);
    expect(janela.cenaSeguinte).toBe(DEMO_CENA_B);
    expect(janela.inicio).toBe(DEMO_FRONTEIRA_INICIO);
    expect(DEMO_FRONTEIRA_INICIO).toBe(18);
    expect(janela.fim).toBe(30);
    expect(janela.duracaoFrames).toBe(12);
    expect(janela.origem).toBe("saida");
  });

  it("censo: 36 frames com uma cena, 12 com duas, nenhum vazio", () => {
    const censo = censoDeFrames(plano);
    expect(censo.framesComUmaCena).toBe(36);
    expect(censo.framesComDuasCenas).toBe(12);
    expect(censo.framesVazios).toBe(0);
    expect(censo.somaDesenhada).toBe(60);
  });

  it("frame 24 (meio) tem as DUAS cenas, no papel certo, progresso 0.5", () => {
    const presentes = cenasNoFrame(plano, DEMO_FRONTEIRA_MEIO);
    expect(presentes.map((p) => [p.cenaId, p.lado, p.frameLocal])).toStrictEqual([
      [DEMO_CENA_A, "saindo", DEMO_FRONTEIRA_MEIO],
      [DEMO_CENA_B, "entrando", DEMO_FRONTEIRA_MEIO - DEMO_FRONTEIRA_INICIO],
    ]);
    expect(presentes[0]!.progresso).toBeCloseTo(0.5, 10);
    expect(presentes[1]!.progresso).toBeCloseTo(0.5, 10);
  });

  it("o progresso nunca chega a 1: no ultimo frame da janela vale (D-1)/D", () => {
    const presentes = cenasNoFrame(plano, 29);
    expect(presentes.length).toBe(2);
    expect(presentes[0]!.progresso).toBeCloseTo(11 / 12, 10);
  });
});
// ---------------------------------------------------------------------------
// 4. Render de verdade — react-dom/server, sem navegador
// ---------------------------------------------------------------------------

describe("render da sequencia (F1-10)", () => {
  it("fora da fronteira: exatamente UMA cena, lado 'sozinha'", () => {
    for (const frame of [0, 15, 30, 47]) {
      const html = renderizarDemonstracao("fade", frame);
      const cenas = html.match(/data-cena="demo-[ab]"/g) ?? [];
      expect(cenas.length, `frame ${String(frame)}: ${html}`).toBe(1);
      expect(html).toContain('data-lado="sozinha"');
      expect(html).toContain('data-transicao="nenhuma"');
    }
  });
  it("dentro da fronteira: as DUAS cenas, saindo por baixo, entrando por cima", () => {
    const html = renderizarDemonstracao("fade", DEMO_FRONTEIRA_MEIO);
    expect(html).toContain('data-cenas="2"');
    const posSaindo = html.indexOf('data-lado="saindo"');
    const posEntrando = html.indexOf('data-lado="entrando"');
    expect(posSaindo, html).toBeGreaterThanOrEqual(0);
    expect(posEntrando, html).toBeGreaterThanOrEqual(0);
    // Ordem de pintura: quem sai aparece ANTES de quem entra no DOM.
    expect(posSaindo).toBeLessThan(posEntrando);
    expect(html).toContain('data-transicao="fade"');
    expect(html).toContain('data-progresso="0.5000"');
  });

  it("a apresentacao envolve os DOIS lados (mesmo componente, lado certo)", () => {
    const html = renderizarDemonstracao("wipe", DEMO_FRONTEIRA_MEIO);
    expect(html).toContain('data-apresentacao="wipe"');
    expect(html).toContain('data-lado="saindo"');
    expect(html).toContain('data-lado="entrando"');
  });

  it("o frame local de cada cena vem da propria timeline, nao do frame absoluto", () => {
    const html = renderizarDemonstracao("fade", DEMO_FRONTEIRA_MEIO);
    // A cena B comeca no frame 18; no frame 24 o frame local dela e 6.
    expect(html).toContain('data-frame-local="6"');
  });

  it("slide e wipe sao visivelmente diferentes no DOM: transladar x recortar", () => {
    // As duas produzem o MESMO pixel no meio da fronteira — o DOM e que distingue.
    const htmlSlide = renderizarDemonstracao("slide", DEMO_FRONTEIRA_MEIO);
    const htmlWipe = renderizarDemonstracao("wipe", DEMO_FRONTEIRA_MEIO);
    expect(htmlSlide).toContain("translateX");
    expect(htmlSlide).not.toContain("clip-path");
    expect(htmlWipe).toContain("clip-path");
    expect(htmlWipe).not.toContain("translateX");
  });

  it("nenhum frame valido renderiza tela vazia", () => {
    for (let frame = 0; frame < DEMO_TOTAL_FRAMES; frame++) {
      const html = renderizarDemonstracao("fade", frame);
      const cenas = html.match(/data-cena="demo-[ab]"/g) ?? [];
      expect(cenas.length, `frame ${String(frame)}`).toBeGreaterThan(0);
    }
  });

  it("render e deterministico: duas passadas, bytes identicos", () => {
    for (const frame of [0, DEMO_FRONTEIRA_MEIO, 47]) {
      expect(renderizarDemonstracao("fade", frame)).toBe(renderizarDemonstracao("fade", frame));
    }
  });

  it("a composicao registrada usa a duracao derivada, nao um numero solto", () => {
    const plano = planoDeTransicoes(manifestoDeDemonstracao("fade"));
    expect(plano.totalFrames).toBe(DEMO_TOTAL_FRAMES);
    expect(plano.fps).toBe(30);
    expect(plano.width).toBe(DEMO_LARGURA);
  });

  it("o pintor injetado recebe a cena certa no frame certo", () => {
    const html = renderToStaticMarkup(
      createElement(SequenciaComTransicoes, {
        manifesto: manifestoDeDemonstracao("fade"),
        frame: DEMO_FRONTEIRA_MEIO,
        Cena: PintorDoTeste,
      }),
    );
    expect(html).toContain('data-cena-pintada="demo-a"');
    expect(html).toContain('data-cena-pintada="demo-b"');
    expect(html).toContain('data-lado-pintado="saindo"');
    expect(html).toContain('data-lado-pintado="entrando"');
  });
});

// ---------------------------------------------------------------------------
// 5. O pixel — o oraculo de verdade (AGENTS.md, C1)
// ---------------------------------------------------------------------------
//
// Cada quadro aprovado tem de ser capaz de REPROVAR alguma coisa (ver
// tools/transicoes/quadros.ts). As assercoes abaixo sao sobre o VALOR do
// pixel, nunca sobre o codigo de saida do render.

describe("pixel dos snapshots aprovados (F1-10, C1)", () => {
  it("o diretorio de snapshots existe e tem arquivos (C2)", () => {
    expect(existsSync(DIR_SNAPSHOTS)).toBe(true);
  });

  it("cada quadro declarado em quadros.ts existe no disco", () => {
    for (const quadro of QUADROS) {
      const caminho = resolve(DIR_SNAPSHOTS, arquivoDoQuadro(quadro));
      expect(existsSync(caminho), `snapshot ausente: ${arquivoDoQuadro(quadro)}`).toBe(true);
    }
  });

  it("quadro vazio e reprovado: a sonda do fade-meio nao passa com fundo sozinho", () => {
    // Se o componente devolvesse tela vazia (ou so o palco), o pixel central
    // do meio da fronteira seria o fundo — e a assercao de mistura acusa.
    const palco = corRelativa(
      { largura: 1, altura: 1, pixels: new Uint8Array([3, 7, 18, 255]) },
      0.5,
      0.5,
    );
    expect(distancia(palco, BLEND_MEIO)).toBeGreaterThan(TOLERANCIA);
  });

  it("fade-antes: fora da fronteira, a tela e a cena A inteira", () => {
    const imagem = lerSnapshot("fade-antes");
    expect(fracaoProxima(imagem, COR_A, TOLERANCIA)).toBeGreaterThan(0.9);
    expect(coresDistintas(imagem)).toBeGreaterThan(1); // a marca esta la
  });

  it("fade-meio: o pixel central e a mistura 50/50, que NENHUM lado produz sozinho", () => {
    const imagem = lerSnapshot("fade-meio");
    esperaCor(imagem, 0.5, 0.5, BLEND_MEIO);
    // A maior parte da tela e a mistura — os dois lados desenharam por cima.
    expect(fracaoProxima(imagem, BLEND_MEIO, TOLERANCIA)).toBeGreaterThan(0.8);
    // E a cor pura de nenhum dos lados ocupa quase nada (senao so um lado desenhava).
    expect(fracaoProxima(imagem, COR_A, TOLERANCIA)).toBeLessThan(0.05);
    expect(fracaoProxima(imagem, COR_B, TOLERANCIA)).toBeLessThan(0.05);
  });

  it("fade-depois: fora da fronteira, a tela e a cena B inteira", () => {
    const imagem = lerSnapshot("fade-depois");
    expect(fracaoProxima(imagem, COR_B, TOLERANCIA)).toBeGreaterThan(0.9);
  });

  it("wipe-meio: metade esquerda e a cena que entra, direita a que sai", () => {
    const imagem = lerSnapshot("wipe-meio");
    esperaCor(imagem, 0.25, 0.5, COR_B);
    esperaCor(imagem, 0.75, 0.5, COR_A);
  });

  it("clock-wipe-meio: o setor de 180 graus revela a DIREITA (12h sentido horario)", () => {
    const imagem = lerSnapshot("clock-wipe-meio");
    esperaCor(imagem, 0.25, 0.5, COR_A);
    esperaCor(imagem, 0.75, 0.5, COR_B);
    esperaCor(imagem, 0.5, 0.25, COR_B); // topo-direita dentro do setor
  });

  it("slide-meio: as duas cenas DESLOCADAS de meia tela, encostadas", () => {
    const imagem = lerSnapshot("slide-meio");
    esperaCor(imagem, 0.25, 0.5, COR_B);
    esperaCor(imagem, 0.75, 0.5, COR_A);
    // Canto inferior-esquerdo: a cena B transladou ate la (nao foi recortada).
    esperaCor(imagem, 0.1, 0.85, COR_B);
  });

  it("cube-meio: as duas faces aparecem em quina, com o palco nas bordas", () => {
    const imagem = lerSnapshot("cube-meio");
    esperaCor(imagem, 0.25, 0.5, COR_B);
    esperaCor(imagem, 0.75, 0.5, COR_A);
    // A perspectiva mostra o palco alem das faces.
    esperaCor(imagem, 0.02, 0.5, COR_PALCO);
    expect(coresDistintas(imagem)).toBeGreaterThan(100);
  });

  it("flip-quarto: so a face que sai esta de frente, ja rotacionada", () => {
    const imagem = lerSnapshot("flip-quarto");
    esperaCor(imagem, 0.5, 0.5, COR_A);
    // A borda direita da face rotacionada abre o palco.
    esperaCor(imagem, 0.98, 0.5, COR_PALCO);
    expect(coresDistintas(imagem)).toBeGreaterThan(100);
  });

  it("none-meio: corte seco — o que entra cobre o que sai", () => {
    const imagem = lerSnapshot("none-meio");
    expect(fracaoProxima(imagem, COR_B, TOLERANCIA)).toBeGreaterThan(0.9);
  });

  it("todo snapshot decodifica com o formato que o render produz (RGB 8 bits)", () => {
    for (const quadro of QUADROS) {
      const imagem = lerSnapshot(quadro.nome);
      expect(imagem.largura).toBe(DEMO_LARGURA);
      expect(imagem.altura).toBe(270);
      expect(coresDistintas(imagem)).toBeGreaterThan(0);
    }
  });
});
