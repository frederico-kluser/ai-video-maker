/**
 * src/resolucao/grafico/cena.ts
 *
 * Geracao da cena Manim a partir de um `NoGrafico`. Card F2-02 (W4),
 * onda "grafico-matematica" (2026-08-14).
 *
 * Esta e a metade PURA do estagio: `(no, opcoes) -> fonte Python`, funcao
 * total, sem relogio, sem sorteio, sem disco e sem rede. Toda a geometria e
 * calculada aqui, em TypeScript, e a cena emitida so desenha o que ja foi
 * decidido. Duas razoes:
 *
 *   1. o que e calculado aqui e testavel sem o Manim instalado -- e o Manim
 *      NAO e uma dependencia de teste deste repositorio;
 *   2. o subprocesso fica com uma unica responsabilidade (desenhar), o que
 *      torna "o render falhou" distinguivel de "a conta estava errada".
 *
 * O texto e as cores vem do manifesto, que foi escrito por um LLM. Nada
 * dele entra na fonte Python sem passar por `literalPython()` ou
 * `expressaoDeCor()`: uma string do manifesto interpolada crua em codigo
 * seria injecao de codigo com autoria de modelo de linguagem.
 *
 * As cores default vem de `src/design/tokens.ts` por IMPORT (AGENTS.md
 * Regra 2: literal de cor duplicado diverge num merge limpo). Nomes de cor
 * do NAMESPACE DO MANIM (`TEAL`, `BLUE`) nao sao tokens de design deste
 * repositorio -- sao identificadores do `from manim import *`, e e
 * exatamente por isso que `CYAN` precisa do quirk de fallback.
 *
 * # O que mudou na onda grafico-matematica (2026-08-14)
 *
 * O estagio deixou de desenhar graficos de dados (barras/linha/pizza/area/
 * dispersao) e passou a renderizar ESQUEMAS MATEMATICOS estilo 3blue1brown:
 * equacoes LaTeX (MathTex), graficos de funcoes com Axes (parabola + soma
 * de Riemann), derivacao por TransformMatchingTex e geometria de circulo
 * unitario. O video do no `grafico` passa a ser matematica real.
 *
 * O contrato `NoGrafico` NAO tem campo de expressao/funcao: so
 * `tipo_grafico`, `titulo` e `dados`. A escolha da cena e entao:
 *
 *   - um CATALOGO FIXO de cinco cenas matematicas, na ordem em que os
 *     tipos do contrato aparecem (barras, linha, pizza, area, dispersao);
 *   - cada tipo recebe a cena do seu indice no catalogo;
 *   - dois nos com o MESMO tipo recebem cenas distintas por ordem
 *     lexicografica de id: o enesimo no de um tipo avanca `n` posicoes no
 *     catalogo (ciclico). O estagio processa os nos em ordem lexicografica
 *     (nosDeGrafico) e passa `deslocamentoEntreIguais` a esta funcao.
 *
 * Os `dados` e o `titulo` do no continuam parametrizando a cena: as cores
 * de serie colorem as partes das equacoes e dos graficos (mantendo vivo o
 * call-site do quirk COLOR_FALLBACKS -- `CYAN` -> `TEAL`), o numero de
 * pontos do circulo unitario e o de termos da serie de Taylor saem de
 * `dados.length`, e o titulo do no aparece como legenda no topo.
 *
 * A geracao e TOTAL para QUALQUER `duracao_frames >= 1` (o contrato
 * `NoGrafico` so exige isso; ver src/contratos/manifesto.ts): os mobjects
 * sao definidos TODOS no inicio da `construct`, ANTES do primeiro
 * `self.play`, e os passos so animam. Com poucos frames (menos do que o
 * numero de passos), os passos sem frame proprio ANEXAM as animacoes ao
 * play do grupo anterior (nunca as descartam) — nenhuma duracao gera
 * referencia a variavel nao definida, para nenhuma das cinco cenas.
 * `distribuirFrames` e o lugar da disciplina; os testes de
 * "duracao pequena" (tests/resolucao/estagio-grafico.test.ts) validam o
 * Python emitido com ast e checam definicoes antes de referencias.
 *
 * O RENDER (nao a geracao) depende de LaTeX/TinyTeX para as equacoes
 * MathTex, e de um interpretador com o Manim 0.20.1 + PyAV para o
 * subprocesso — ver o cabecalho de `estagio.ts`, o documento canônico.
 */

import { createHash } from "node:crypto";
import type { DadoGrafico, NoGrafico, TipoGrafico } from "../../contratos/manifesto.js";
import { highlight, palette, text as corDeTexto } from "../../design/tokens.js";

// ─── Constantes de geometria e estilo (unidades do Manim) ───────────────────────
// O frame default do Manim CE tem 14.22 x 8 unidades. Os valores abaixo
// cabem com folga em 1920x1080 (e em 480x270, o cassete de gravacao).

const RAIO_CIRCULO = 2.2;
const CASAS_DECIMAIS = 4;

/** Cores de serie, em ordem fixa. Importadas dos tokens, nunca redigitadas. */
const CORES_DE_SERIE: readonly string[] = [
  highlight.primary,
  highlight.secondary,
  highlight.accent,
  palette.green[500],
  palette.red[500],
];

/** Fracao da duracao gasta em cada etapa da animacao. Soma 1. */
const FRACAO_DESENHO = 0.6;
const FRACAO_TITULO = 0.2;

// ─── O catalogo de cenas matematicas ────────────────────────────────────────────

/**
 * As cinco cenas matematicas do catalogo, na ordem em que os tipos do
 * contrato as pedem.
 *
 *   barras     -> "einstein":  E = mc^2, escrito parte a parte (MathTex).
 *   linha      -> "riemann":   parabola + soma de Riemann (Axes).
 *   pizza      -> "euler":     derivacao de e^{i*pi} + 1 = 0
 *                              (TransformMatchingTex).
 *   area       -> "taylor":    serie de Taylor de e^x, termo a termo.
 *   dispersao  -> "circulo":   pontos dos dados no circulo unitario,
 *                              geometria + cos^2 + sin^2 = 1.
 */
export type CenaMatematica = "einstein" | "riemann" | "euler" | "taylor" | "circulo";

const INDICE_POR_TIPO: Record<TipoGrafico, number> = {
  barras: 0,
  linha: 1,
  pizza: 2,
  area: 3,
  dispersao: 4,
};

const CATALOGO: readonly CenaMatematica[] = [
  "einstein",
  "riemann",
  "euler",
  "taylor",
  "circulo",
];

/**
 * Escolhe a cena matematica de um no.
 *
 * Deterministica e documentada: o indice do tipo no catalogo, deslocado
 * por `deslocamentoEntreIguais` (o ordinal do no entre os nos do MESMO
 * tipo, em ordem lexicografica de id — ver cabecalho deste arquivo).
 */
export function cenaMatematicaDoNo(
  no: NoGrafico,
  deslocamentoEntreIguais = 0,
): CenaMatematica {
  const base = INDICE_POR_TIPO[no.tipo_grafico] ?? 0;
  return CATALOGO[(base + deslocamentoEntreIguais) % CATALOGO.length] as CenaMatematica;
}

// ─── Tipos ──────────────────────────────────────────────────────────────────────

/** Opcoes de render que vem do manifesto (nunca dos parametros do estagio). */
export interface OpcoesDeCena {
  readonly fps: number;
  readonly larguraPx: number;
  readonly alturaPx: number;
}

/** Uma cena pronta para o runner. */
export interface CenaGerada {
  /** Nome da classe Python. Unico por no, deterministico. */
  readonly nomeCena: string;
  /** Fonte Python da cena, sem o patch de BackgroundRectangle. */
  readonly fonte: string;
  /** Frames que a cena deve durar — `no.duracao_frames` com piso de 3. */
  readonly frames: number;
  /** Duracao em segundos, derivada de frames/fps. */
  readonly duracaoSegundos: number;
}

// ─── Emissao segura de literais ─────────────────────────────────────────────────

/**
 * Serializa uma string do manifesto como literal Python.
 *
 * `JSON.stringify` produz aspas duplas e escapa `"`, `\` e controles em
 * `\uXXXX` — todos validos em Python 3. Os controles crus sao removidos
 * antes, porque um `\r` no meio de uma linha de codigo e um erro de sintaxe
 * que so aparece dentro do subprocesso.
 */
export function literalPython(valor: string): string {
  const semControles = valor.replace(
    new RegExp("[\\u0000-\\u001F\\u007F]", "g"),
    " ",
  );
  return JSON.stringify(semControles);
}

/**
 * Emite um literal Python CRU de LaTeX (`r"..."`).
 *
 * Os conteudos sao CONSTANTES deste arquivo — nunca dados do manifesto —
 * e nao contem aspas nem quebra de linha: o backslash viaja cru, que e o
 * que um raw string quer. `JSON.stringify` aqui seria um bug: ele escaparia
 * o backslash e o LaTeX receberia `\\frac` (quebra de linha) em vez de
 * `\frac`.
 */
function latexPython(latex: string): string {
  return `r"${latex}"`;
}

/** Formata um numero com casas fixas: `0.1+0.2` nao pode virar cena diferente. */
export function numeroPython(valor: number): string {
  if (!Number.isFinite(valor)) return "0.0";
  return valor.toFixed(CASAS_DECIMAIS);
}

/**
 * Traduz a cor declarada no manifesto para uma expressao Python.
 *
 * Tres caminhos, nesta ordem:
 *   - `#rrggbb`            → string literal (o Manim aceita hex em string);
 *   - `NOME_EM_MAIUSCULA`  → identificador do namespace do Manim. E POR AQUI
 *     que `CYAN` entra — e o quirk de `COLOR_FALLBACKS` (quirks.py) o troca
 *     por `TEAL` antes do subprocesso. Sem isso, `NameError` dentro do
 *     render, com mensagem que nao menciona cor;
 *   - qualquer outra coisa → a cor de serie por posicao, dos tokens.
 *
 * Nao existe caminho "confia na string": um valor livre interpolado em
 * codigo Python e injecao.
 */
export function expressaoDeCor(cor: string | undefined, posicao: number): string {
  if (cor !== undefined) {
    if (/^#[0-9a-fA-F]{6}$/.test(cor)) return literalPython(cor);
    if (/^[A-Z][A-Z0-9_]{0,31}$/.test(cor)) return cor;
  }
  const padrao = CORES_DE_SERIE[posicao % CORES_DE_SERIE.length] as string;
  return literalPython(padrao);
}

// ─── Nome da cena ───────────────────────────────────────────────────────────────

/**
 * Nome da classe Python da cena: deterministico e unico por no.
 *
 * O sufixo de hash existe porque a sanitizacao de `id` nao e injetora
 * (`n-1` e `n.1` colapsariam no mesmo nome) e duas cenas com o mesmo nome no
 * mesmo render entregariam o video de uma para as duas.
 */
export function nomeDaCenaDoNo(idNo: string): string {
  const base = idNo.replace(/[^A-Za-z0-9_]/g, "_");
  const sufixo = createHash("sha256").update(idNo, "utf-8").digest("hex").slice(0, 8);
  return `Cena_${base}_${sufixo}`;
}

// ─── Reparticao da duracao ──────────────────────────────────────────────────────

/**
 * Divide os frames do no entre desenho, titulo e pausa.
 *
 * Em frames inteiros, e nao em segundos: somar tres decimais arredondados
 * erra o total por um frame, e um frame a mais faz o hash do video mudar.
 */
export function repartirFrames(frames: number): {
  desenho: number;
  titulo: number;
  pausa: number;
} {
  const total = Math.max(3, Math.trunc(frames));
  const desenho = Math.max(1, Math.floor(total * FRACAO_DESENHO));
  const titulo = Math.max(1, Math.floor(total * FRACAO_TITULO));
  const pausa = Math.max(1, total - desenho - titulo);
  return { desenho, titulo, pausa };
}

// ─── Passos de cena e distribuicao de frames ────────────────────────────────────

/**
 * Um passo de cena: as linhas que constroem os mobjects e as animacoes do
 * `self.play` correspondente, com um peso relativo de duracao.
 *
 * As LINHAS saem SEMPRE no inicio da `construct` (ver `gerarCenaManim`),
 * antes do primeiro `self.play`: todo mobject existe antes de qualquer
 * animacao, e um passo nunca depende de o play anterior ter definido
 * alguma coisa. Os passos so animam — e por isso que uma duracao pequena
 * (menos frames do que passos) nunca gera `NameError`.
 *
 * A divisao da duracao em passos acontece AQUI, em TypeScript, em frames
 * inteiros — o Python so recebe `run_time` ja decididos. Somar duracao em
 * segundos decimal por decimal e a receita classica de perder um frame e
 * mudar o hash do video sem mudar a cena.
 */
interface PassoDaCena {
  readonly linhas: readonly string[];
  readonly animacoes: readonly string[];
  readonly peso: number;
}

/** Esboco de uma cena matematica: passos + linhas de preludio (titulo etc.). */
interface EsbocoDaCena {
  readonly preludio: readonly string[];
  readonly passos: readonly PassoDaCena[];
}

/**
 * Distribui `framesDePlay` frames entre as ANIMACOES dos passos.
 *
 * Regra geral (orcamento >= numero de passos): piso de 1 frame por passo,
 * proporcional aos pesos. O total distribuido e EXATAMENTE `framesDePlay`:
 * o resto sobra para o ultimo passo, e o excedente (soma dos pisos acima
 * do orcamento) e devolvido ao ultimo play elegivel.
 *
 * Orcamento MENOR que o numero de passos (duracao pequena): nao ha frame
 * para todos. Os `framesDePlay` primeiros passos ganham 1 frame cada, e
 * os demais ANEXAM as animacoes ao play do grupo anterior — a ordem das
 * animacoes nunca muda e NENHUMA e descartada. Isso e seguro porque os
 * passos nao definem mobject nenhum (as definicoes saem antes, em
 * `gerarCenaManim`): anexar uma animacao ao play anterior nunca deixa uma
 * referencia pendente. O total continua exato e a cena e total para
 * qualquer duracao >= 1.
 */
function distribuirFrames(
  passos: readonly PassoDaCena[],
  framesDePlay: number,
): Array<{ animacoes: readonly string[]; frames: number }> {
  if (framesDePlay < passos.length) {
    const grupos: Array<{ animacoes: string[]; frames: number }> = [];
    for (let i = 0; i < passos.length; i++) {
      const passo = passos[i] as PassoDaCena;
      if (i < framesDePlay) {
        grupos.push({ animacoes: [...passo.animacoes], frames: 1 });
      } else {
        const alvo = grupos[grupos.length - 1];
        if (alvo !== undefined) alvo.animacoes.push(...passo.animacoes);
      }
    }
    return grupos;
  }

  const somaPesos = passos.reduce((acc, p) => acc + p.peso, 0);
  const brutos = passos.map((p) => (framesDePlay * p.peso) / somaPesos);
  const frames: number[] = brutos.map((b) => Math.max(1, Math.floor(b)));

  let excedente = frames.reduce((a, b) => a + b, 0) - framesDePlay;
  for (let i = frames.length - 1; i >= 0 && excedente > 0; i--) {
    if ((frames[i] ?? 0) > 1) {
      frames[i] = (frames[i] ?? 1) - 1;
      excedente -= 1;
    }
  }
  let resto = framesDePlay - frames.reduce((a, b) => a + b, 0);
  if (resto > 0 && frames.length > 0) {
    frames[frames.length - 1] = (frames[frames.length - 1] ?? 0) + resto;
  }

  return passos.map((passo, i) => ({
    animacoes: [...passo.animacoes],
    frames: frames[i] ?? 0,
  }));
}

// ─── As cinco cenas matematicas ─────────────────────────────────────────────────

/**
 * Preludio comum: o titulo do no, se existir, como legenda no topo.
 *
 * O titulo vem do manifesto (LLM) e so entra via `literalPython`. A cor e
 * o token de texto dos design tokens, por import. `add_background_rectangle`
 * usa `opacity=` (a forma correta — o quirk 2.7 conserta `fill_opacity=`
 * quando o LLM escreve errado; ver quirks.py, origem
 * manim-api/services/openai_service.py:208-212).
 */
function preludioComTitulo(titulo: string): string[] {
  if (titulo === "") return [];
  return [
    `        titulo = Text(${literalPython(titulo)}, font_size=28, ` +
      `color=${literalPython(corDeTexto.primary)})`,
    "        titulo.to_edge(UP, buff=0.5)",
    "        titulo.add_background_rectangle(opacity=0.5)",
    "        self.add(titulo)",
  ];
}

/** cena 0 — `E = mc^2`, escrita parte a parte (padrao EinsteinEquation do 3b1b). */
function esbocoEinstein(dados: readonly DadoGrafico[]): EsbocoDaCena {
  const cor = (i: number) => expressaoDeCor(dados[i % Math.max(1, dados.length)]?.cor, i);
  return {
    preludio: [],
    passos: [
      {
        linhas: [
          '        equacao = MathTex("E", "=", "m", "c^2")',
          "        equacao.scale(2.4)",
          `        equacao[0].set_color(${cor(0)})`,
          `        equacao[1].set_color(${cor(1)})`,
          `        equacao[2].set_color(${cor(2)})`,
          `        equacao[3].set_color(${cor(3)})`,
        ],
        animacoes: ["Write(equacao[0])"],
        peso: 1.0,
      },
      { linhas: [], animacoes: ["Write(equacao[1])"], peso: 0.8 },
      { linhas: [], animacoes: ["Write(equacao[2])"], peso: 1.0 },
      { linhas: [], animacoes: ["Write(equacao[3])"], peso: 1.3 },
      { linhas: [], animacoes: ["Indicate(equacao[3])"], peso: 0.9 },
    ],
  };
}

/** cena 1 — parabola + soma de Riemann (padrao RiemannSum do 3b1b). */
function esbocoRiemann(dados: readonly DadoGrafico[]): EsbocoDaCena {
  // `dx` deriva do numero de dados do no: mais dados, retangulos mais finos.
  const dx = (3.7 - 0.3) / (Math.max(1, dados.length) + 1);
  return {
    preludio: [],
    passos: [
      {
        linhas: [
          "        eixos = Axes(x_range=[0, 5], y_range=[0, 6], tips=False, " +
            'axis_config={"color": WHITE})',
          "        curva = eixos.plot(lambda x: 4*x - x**2, x_range=[0, 4], " +
            `color=${expressaoDeCor(dados[0]?.cor, 0)})`,
          "        area = eixos.get_riemann_rectangles(curva, x_range=[0.3, 3.7], " +
            `dx=${numeroPython(dx)}, color=${expressaoDeCor(dados[1]?.cor, 1)}, fill_opacity=0.5)`,
        ],
        animacoes: ["Create(eixos)"],
        peso: 1.0,
      },
      { linhas: [], animacoes: ["Create(curva)"], peso: 1.2 },
      { linhas: [], animacoes: ["Create(area)"], peso: 1.3 },
      {
        linhas: [
          "        rotulo_da_curva = MathTex(" +
            latexPython("f(x) = 4x - x^2") + ").next_to(curva, RIGHT, buff=0.2)",
        ],
        animacoes: ["Write(rotulo_da_curva)"],
        peso: 0.9,
      },
    ],
  };
}

/** cena 2 — identidade de Euler, por TransformMatchingTex (padrao EquationDerivation). */
function esbocoEuler(dados: readonly DadoGrafico[]): EsbocoDaCena {
  const cor = (i: number) => expressaoDeCor(dados[i % Math.max(1, dados.length)]?.cor, i);
  return {
    preludio: [],
    passos: [
      {
        linhas: [
          "        passo1 = MathTex(" +
            latexPython("e^{i\\theta}") + ', "=", ' +
            latexPython("\\cos\\theta") + ', "+", ' +
            latexPython("i\\sin\\theta") + ")",
          "        passo1.scale(1.6)",
          `        passo1.set_color_by_tex("e", ${cor(0)})`,
        ],
        animacoes: ["Write(passo1)"],
        peso: 1.2,
      },
      {
        linhas: [
          "        passo2 = MathTex(" +
            latexPython("e^{i\\pi}") + ', "+", "1", "=", "0")',
          "        passo2.scale(1.6)",
          `        passo2.set_color_by_tex("e", ${cor(1)})`,
          `        passo2.get_part_by_tex("0").set_color(${cor(2)})`,
        ],
        animacoes: ["TransformMatchingTex(passo1, passo2)"],
        peso: 1.4,
      },
      {
        linhas: ['        zero = passo2.get_part_by_tex("0")'],
        animacoes: ["Indicate(zero)"],
        peso: 0.9,
      },
    ],
  };
}

/**
 * cena 3 — serie de Taylor de e^x, termo a termo por TransformMatchingTex.
 *
 * O numero de termos vem de `dados.length` (piso 2, teto 5): o no grafico
 * decide quanta serie aparece na tela. O padrao e o do 3b1b — uma equacao
 * que cresce por transformacao, nunca por reescrita.
 */
function esbocoTaylor(dados: readonly DadoGrafico[]): EsbocoDaCena {
  const termos = Math.min(5, Math.max(2, dados.length));
  const cor = (i: number) => expressaoDeCor(dados[i % Math.max(1, dados.length)]?.cor, i);
  const termosLatex: readonly string[] = [
    "1",
    "x",
    "\\frac{x^2}{2!}",
    "\\frac{x^3}{3!}",
    "\\frac{x^4}{4!}",
  ];
  const pecas = (n: number): string => {
    const partes: string[] = [latexPython("e^x"), '"="'];
    termosLatex.slice(0, n).forEach((t, i) => {
      if (i > 0) partes.push('"+"');
      partes.push(latexPython(t));
    });
    return partes.join(", ");
  };
  const escala = numeroPython(Math.max(1.0, 1.4 - 0.1 * (termos - 2)));

  const passos: PassoDaCena[] = [];
  for (let k = 1; k <= termos; k++) {
    passos.push({
      linhas: [
        `        passo${k} = MathTex(${pecas(k)})`,
        `        passo${k}.scale(${escala})`,
      ],
      animacoes: [k === 1 ? "Write(passo1)" : `TransformMatchingTex(passo${k - 1}, passo${k})`],
      peso: 1.0,
    });
  }
  passos.push({
    linhas: [],
    animacoes: [`passo${termos}.animate.set_color(${cor(0)})`],
    peso: 0.8,
  });
  return { preludio: [], passos };
}

/** cena 4 — pontos dos dados no circulo unitario + identidade trigonometrica. */
function esbocoCirculo(dados: readonly DadoGrafico[]): EsbocoDaCena {
  const soma = dados.reduce((acc, d) => acc + Math.max(0, d.valor), 0) || 1;
  const linhasDosPontos: string[] = ["        pontos = VGroup()"];
  let acumulado = 0;
  dados.forEach((dado, i) => {
    const fatia = (Math.max(0, dado.valor) / soma) * Math.PI * 2;
    const angulo = acumulado + fatia / 2; // ponto no meio do seu setor
    acumulado += fatia;
    linhasDosPontos.push(
      `        pontos.add(Dot([${numeroPython(RAIO_CIRCULO * Math.cos(angulo))}, ` +
        `${numeroPython(RAIO_CIRCULO * Math.sin(angulo))}, 0], ` +
        `radius=0.09, color=${expressaoDeCor(dado.cor, i)}))`,
    );
  });
  return {
    preludio: [],
    passos: [
      {
        linhas: [
          "        eixo_x = Line(LEFT * 3, RIGHT * 3, color=GRAY)",
          "        eixo_y = Line(DOWN * 3, UP * 3, color=GRAY)",
        ],
        animacoes: ["Create(eixo_x)", "Create(eixo_y)"],
        peso: 0.7,
      },
      {
        linhas: ["        circulo = Circle(radius=2.2, color=WHITE)"],
        animacoes: ["Create(circulo)"],
        peso: 1.0,
      },
      { linhas: linhasDosPontos, animacoes: ["FadeIn(pontos)"], peso: 0.9 },
      {
        linhas: [
          "        formula = MathTex(" +
            latexPython("\\cos^2\\theta + \\sin^2\\theta = 1") +
            ").next_to(circulo, DOWN, buff=0.5)",
          "        formula.scale(1.2)",
        ],
        animacoes: ["Write(formula)"],
        peso: 1.1,
      },
    ],
  };
}

const ESBOCOS: Record<CenaMatematica, (dados: readonly DadoGrafico[]) => EsbocoDaCena> = {
  einstein: esbocoEinstein,
  riemann: esbocoRiemann,
  euler: esbocoEuler,
  taylor: esbocoTaylor,
  circulo: esbocoCirculo,
};

// ─── Geracao ────────────────────────────────────────────────────────────────────

/** Opcoes adicionais, decididas pelo estagio (nunca pelo manifesto). */
export interface OpcoesExtrasDeCena {
  /**
   * Ordinal do no entre os nos do MESMO tipo, em ordem lexicografica de id.
   * Desloca a cena no catalogo (ver `cenaMatematicaDoNo`).
   */
  readonly deslocamentoEntreIguais?: number;
}

/**
 * Gera a cena Manim de um no de grafico.
 *
 * Deterministica por construcao: nao le relogio, nao sorteia, e itera sobre
 * `no.dados` na ordem em que o manifesto os declarou (que e um array, nao um
 * objeto — nao ha ordem de `Object.keys` envolvida). A cena e escolhida por
 * `cenaMatematicaDoNo` e as duracoes sao divididas em frames inteiros por
 * `distribuirFrames`.
 */
export function gerarCenaManim(
  no: NoGrafico,
  opcoes: OpcoesDeCena,
  extras: OpcoesExtrasDeCena = {},
): CenaGerada {
  const nomeCena = nomeDaCenaDoNo(no.id);
  const frames = Math.max(3, Math.trunc(no.duracao_frames));
  const reparticao = repartirFrames(frames);
  const fps = Math.max(1, Math.trunc(opcoes.fps));

  const dados = no.dados.length > 0 ? no.dados : [{ rotulo: "sem dados", valor: 1 }];
  const cenaMatematica = cenaMatematicaDoNo(no, extras.deslocamentoEntreIguais ?? 0);
  const esboco = ESBOCOS[cenaMatematica](dados);

  // Todos os mobjects saem ANTES do primeiro `self.play`, na ordem dos
  // passos do esboco (funcao total: `distribuirFrames` anexa apenas
  // ANIMACOES ao play do grupo anterior, nunca linhas que um play usaria
  // depois — nenhuma duracao >= 1 gera referencia a variavel nao
  // definida).
  const linhas = [
    "from manim import *",
    "",
    "",
    `class ${nomeCena}(Scene):`,
    "    def construct(self):",
    ...preludioComTitulo(no.titulo ?? ""),
    ...esboco.preludio,
    ...esboco.passos.flatMap((passo) => passo.linhas),
  ];
  const framesDePlay = reparticao.desenho + reparticao.titulo;
  for (const grupo of distribuirFrames(esboco.passos, framesDePlay)) {
    linhas.push(
      `        self.play(${grupo.animacoes.join(", ")}, ` +
        `run_time=${numeroPython(grupo.frames / fps)})`,
    );
  }
  linhas.push(`        self.wait(${numeroPython(reparticao.pausa / fps)})`);
  linhas.push("");

  return {
    nomeCena,
    fonte: linhas.join("\n"),
    frames,
    duracaoSegundos: frames / fps,
  };
}
