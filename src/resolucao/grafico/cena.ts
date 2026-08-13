/**
 * src/resolucao/grafico/cena.ts
 *
 * Geracao da cena Manim a partir de um `NoGrafico`. Card F2-02 (W4).
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
 */

import { createHash } from "node:crypto";
import type { DadoGrafico, NoGrafico } from "../../contratos/manifesto.js";
import { highlight, palette, text as corDeTexto } from "../../design/tokens.js";

// ─── Geometria do desenho, em unidades do Manim ─────────────────────────────────
// O frame default do Manim CE tem 14.22 x 8 unidades. Os valores abaixo sao
// a area util do desenho, deixando margem para titulo e rotulos.

const LARGURA_DESENHO = 10;
const ALTURA_DESENHO = 4.2;
const RAIO_PIZZA = 2.2;
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
  /** Frames que a cena deve durar — igual a `no.duracao_frames`. */
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
  const semControles = valor.replace(/[\u0000-\u001F\u007F]/g, " ");
  return JSON.stringify(semControles);
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

// ─── Geometria por tipo de grafico ──────────────────────────────────────────────

function maiorValor(dados: readonly DadoGrafico[]): number {
  const maior = dados.reduce((acc, d) => (d.valor > acc ? d.valor : acc), 0);
  return maior > 0 ? maior : 1;
}

function somaValores(dados: readonly DadoGrafico[]): number {
  const soma = dados.reduce((acc, d) => acc + Math.max(0, d.valor), 0);
  return soma > 0 ? soma : 1;
}

/** Coordenada x da coluna `i` de `n`, centrada na origem. */
function posicaoX(i: number, n: number): number {
  if (n <= 1) return 0;
  return -LARGURA_DESENHO / 2 + (LARGURA_DESENHO * i) / (n - 1);
}

function corpoBarras(dados: readonly DadoGrafico[]): string[] {
  const maior = maiorValor(dados);
  const n = dados.length;
  const largura = Math.min(1.2, LARGURA_DESENHO / Math.max(1, n * 1.6));
  const passo = n > 1 ? LARGURA_DESENHO / (n - 1 + 0.0001) : 0;
  const linhas: string[] = ["        formas = VGroup()"];
  dados.forEach((dado, i) => {
    const altura = Math.max(0.08, (ALTURA_DESENHO * Math.max(0, dado.valor)) / maior);
    const x = n > 1 ? -LARGURA_DESENHO / 2 + passo * i : 0;
    linhas.push(
      `        barra = Rectangle(width=${numeroPython(largura)}, ` +
        `height=${numeroPython(altura)}, fill_opacity=1.0, ` +
        `fill_color=${expressaoDeCor(dado.cor, i)}, stroke_width=2)`,
      `        barra.move_to([${numeroPython(x)}, ` +
        `${numeroPython(altura / 2 - ALTURA_DESENHO / 2)}, 0])`,
      `        rotulo = Text(${literalPython(dado.rotulo)}, font_size=22, ` +
        `color=${literalPython(corDeTexto.primary)})`,
      "        rotulo.next_to(barra, DOWN, buff=0.15)",
      "        formas.add(VGroup(barra, rotulo))",
    );
  });
  return linhas;
}

function pontos(dados: readonly DadoGrafico[]): string {
  const maior = maiorValor(dados);
  const n = dados.length;
  return dados
    .map((dado, i) => {
      const y =
        (ALTURA_DESENHO * Math.max(0, dado.valor)) / maior - ALTURA_DESENHO / 2;
      return `[${numeroPython(posicaoX(i, n))}, ${numeroPython(y)}, 0]`;
    })
    .join(", ");
}

function corpoLinha(dados: readonly DadoGrafico[]): string[] {
  return [
    `        vertices = [${pontos(dados)}]`,
    "        traco = VMobject(stroke_width=6)",
    `        traco.set_stroke(${expressaoDeCor(dados[0]?.cor, 0)})`,
    "        traco.set_points_as_corners(vertices)",
    "        formas = VGroup(traco)",
    "        for i, vertice in enumerate(vertices):",
    `            formas.add(Dot(vertice, radius=0.07, color=${expressaoDeCor(undefined, 1)}))`,
    ...rotulosDeEixo(dados),
  ];
}

function corpoArea(dados: readonly DadoGrafico[]): string[] {
  const n = dados.length;
  const base = numeroPython(-ALTURA_DESENHO / 2);
  const primeiroX = numeroPython(posicaoX(0, n));
  const ultimoX = numeroPython(posicaoX(Math.max(0, n - 1), n));
  return [
    `        vertices = [${pontos(dados)}]`,
    `        contorno = [[${primeiroX}, ${base}, 0], *vertices, [${ultimoX}, ${base}, 0]]`,
    `        area = Polygon(*contorno, fill_opacity=0.7, ` +
      `fill_color=${expressaoDeCor(dados[0]?.cor, 0)}, stroke_width=3)`,
    "        formas = VGroup(area)",
    ...rotulosDeEixo(dados),
  ];
}

function corpoDispersao(dados: readonly DadoGrafico[]): string[] {
  const maior = maiorValor(dados);
  const n = dados.length;
  const linhas: string[] = ["        formas = VGroup()"];
  dados.forEach((dado, i) => {
    const y = (ALTURA_DESENHO * Math.max(0, dado.valor)) / maior - ALTURA_DESENHO / 2;
    linhas.push(
      `        formas.add(Dot([${numeroPython(posicaoX(i, n))}, ${numeroPython(y)}, 0], ` +
        `radius=0.12, color=${expressaoDeCor(dado.cor, i)}))`,
    );
  });
  linhas.push(...rotulosDeEixo(dados));
  return linhas;
}

function corpoPizza(dados: readonly DadoGrafico[]): string[] {
  const soma = somaValores(dados);
  const linhas: string[] = ["        formas = VGroup()"];
  let acumulado = 0;
  dados.forEach((dado, i) => {
    const fatia = (Math.max(0, dado.valor) / soma) * Math.PI * 2;
    linhas.push(
      `        formas.add(Sector(outer_radius=${numeroPython(RAIO_PIZZA)}, ` +
        `start_angle=${numeroPython(acumulado)}, angle=${numeroPython(fatia)}, ` +
        `fill_opacity=1.0, color=${expressaoDeCor(dado.cor, i)}, stroke_width=2))`,
    );
    acumulado += fatia;
  });
  dados.forEach((dado, i) => {
    linhas.push(
      `        legenda = Text(${literalPython(dado.rotulo)}, font_size=20, ` +
        `color=${literalPython(corDeTexto.primary)})`,
      `        legenda.move_to([${numeroPython(RAIO_PIZZA + 1.6)}, ` +
        `${numeroPython(RAIO_PIZZA - 0.5 * i)}, 0])`,
      "        formas.add(legenda)",
    );
  });
  return linhas;
}

/** Rotulos sob os pontos, para linha/area/dispersao. */
function rotulosDeEixo(dados: readonly DadoGrafico[]): string[] {
  const n = dados.length;
  const y = numeroPython(-ALTURA_DESENHO / 2 - 0.4);
  return dados.map(
    (dado, i) =>
      `        formas.add(Text(${literalPython(dado.rotulo)}, font_size=20, ` +
      `color=${literalPython(corDeTexto.primary)})` +
      `.move_to([${numeroPython(posicaoX(i, n))}, ${y}, 0]))`,
  );
}

const CORPO_POR_TIPO: Record<string, (dados: readonly DadoGrafico[]) => string[]> = {
  barras: corpoBarras,
  linha: corpoLinha,
  area: corpoArea,
  dispersao: corpoDispersao,
  pizza: corpoPizza,
};

// ─── Geracao ────────────────────────────────────────────────────────────────────

/**
 * Gera a cena Manim de um no de grafico.
 *
 * Deterministica por construcao: nao le relogio, nao sorteia, e itera sobre
 * `no.dados` na ordem em que o manifesto os declarou (que e um array, nao um
 * objeto — nao ha ordem de `Object.keys` envolvida).
 */
export function gerarCenaManim(no: NoGrafico, opcoes: OpcoesDeCena): CenaGerada {
  const nomeCena = nomeDaCenaDoNo(no.id);
  const frames = Math.max(3, Math.trunc(no.duracao_frames));
  const reparticao = repartirFrames(frames);
  const fps = Math.max(1, Math.trunc(opcoes.fps));

  const dados = no.dados.length > 0 ? no.dados : [{ rotulo: "sem dados", valor: 1 }];
  const construtor = CORPO_POR_TIPO[no.tipo_grafico] ?? corpoBarras;

  const titulo = no.titulo ?? "";
  const linhasTitulo =
    titulo === ""
      ? [
          "        titulo = VGroup()",
          `        self.wait(${numeroPython(reparticao.titulo / fps)})`,
        ]
      : [
          `        titulo = Text(${literalPython(titulo)}, font_size=34, ` +
            `color=${literalPython(corDeTexto.primary)})`,
          "        titulo.next_to(formas, UP, buff=0.4)",
          // `opacity=`, e nao `fill_opacity=`: em `add_background_rectangle` o
          // segundo colide com **kwargs e o erro e "got multiple values".
          // Ver quirks.py (origem: openai_service.py:208-212).
          "        titulo.add_background_rectangle(opacity=0.6)",
          `        self.play(Write(titulo), run_time=${numeroPython(reparticao.titulo / fps)})`,
        ];

  const fonte = [
    "from manim import *",
    "",
    "",
    `class ${nomeCena}(Scene):`,
    "    def construct(self):",
    ...construtor(dados),
    "        formas.move_to(ORIGIN)",
    `        self.play(Create(formas), run_time=${numeroPython(reparticao.desenho / fps)})`,
    ...linhasTitulo,
    `        self.wait(${numeroPython(reparticao.pausa / fps)})`,
    "",
  ].join("\n");

  return {
    nomeCena,
    fonte,
    frames,
    duracaoSegundos: frames / fps,
  };
}
