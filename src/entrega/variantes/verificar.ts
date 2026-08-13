// =============================================================================
// VERIFICAR — o oraculo das variantes de proporcao
// =============================================================================
// Card: F5-04 (W7) — Variantes de proporcao.
//
// O ∅-crit do PROGRAMA: "conteudo fora da safe area de QUALQUER plataforma
// tem de ficar vermelho". Este modulo e o que fica vermelho.
//
// Tres familias de regra, cada uma respondendo uma pergunta do card:
//
//   C1 — HERANCA (pergunta adversarial (3)): a variante herda o MESMO
//        timing, ou recalcula e diverge? A derivacao troca so width/height;
//        aqui isso e conferido em BYTES: schema, fps, cenas e nos identicos.
//
//   C2 — BLOCO DE LEGENDA POR PLATAFORMA (pergunta adversarial (4), a
//        pergunta 2 do card): o bloco teorico de `maxLines` linhas de
//        legenda (F3-02, src/sincronia/legendas/) cabe na caixa vertical
//        util da plataforma, ancorado na base da caixa — em vertical, a
//        legenda queimada nunca estoura a safe area.
//
//   C3 — CONTEUDO NA SAFE AREA (o ∅-crit): o retangulo de CONTEUDO da
//        variante — a imagem do retangulo de conteudo da FONTE sob a
//        derivacao (o reflow proporcional do canvas) — tem de caber no
//        retangulo seguro da plataforma da variante. Fora de qualquer
//        plataforma conhecida, vermelho nomeando a plataforma e a margem.
//
// O oraculo NAO confia no que a derivacao diz: verificarHeranca confere os
// bytes, verificarConteudoNaSafeArea recomputa a imagem do retangulo de
// conteudo do zero (geometria pura, sem o manifesto da variante como
// premissa — so o canvas dela).
//
// A parte de PIXEL (o snapshot renderizado confere com o plano de camadas
// fora da safe area) vive no gate `just variantes` (tools/variantes/), que
// importa deste modulo o retangulo seguro por plataforma.
//
// PURO: aritmetica pura — zero disco, relogio, rede, RNG.
// =============================================================================

import { maxLines } from "../../design/tokens";
import type { Manifesto } from "../../contratos/manifesto";
import {
  alturaDoBlocoDeLegenda,
  caixaVerticalUtil,
} from "../../sincronia/legendas/validar";
import type { Retangulo } from "../../composicao/camadas/geometria";
import { baixoDe, contem, direitaDe } from "../../composicao/camadas/geometria";
import {
  PLATAFORMA_16X9,
  PLATAFORMA_9X16,
  PLATAFORMAS,
  plataformaDoCanvas,
  retanguloDeConteudo,
  safeRectDaPlataforma,
  type Plataforma,
} from "./plataformas";

// ---------------------------------------------------------------------------
// Violacao
// ---------------------------------------------------------------------------

/** Uma violacao do contrato de variante, com a regra e a plataforma. */
export interface Violacao {
  /** Id estavel da regra (C1/C2/C3). */
  readonly regra: string;
  /** Plataforma envolvida (quando a regra e por plataforma). */
  readonly plataforma?: string;
  /** Mensagem nomeando o que violou e quanto. */
  readonly mensagem: string;
}

/** Erro de variante insegura — carrega TODAS as violacoes. */
export class EVarianteInsegura extends Error {
  readonly code = "VARIANTE_INSEGURA";
  readonly violacoes: readonly Violacao[];
  constructor(violacoes: readonly Violacao[]) {
    super(
      `Variante insegura (${violacoes.length} violacao(ões)):\n` +
        violacoes.map((v) => `  - [${v.regra}] ${v.mensagem}`).join("\n"),
    );
    this.name = "EVarianteInsegura";
    this.violacoes = violacoes;
  }
}

// ---------------------------------------------------------------------------
// C1 — heranca (pergunta adversarial (3))
// ---------------------------------------------------------------------------

/**
 * Os campos de conteudo e tempo do manifesto, serializados de forma canonica
 * para comparacao de bytes: schema, fps, cenas e nos. width/height ficam de
 * fora de proposito — sao o unico delta que a derivacao pode ter.
 */
function camposDeConteudo(manifesto: Manifesto): string {
  return JSON.stringify({
    schema_version: manifesto.schema_version,
    fps: manifesto.fps,
    cenas: manifesto.cenas,
    nos: manifesto.nos,
  });
}

/**
 * C1 — a variante herda o MESMO timing e conteudo da fonte, em bytes.
 * A unica diferenca permitida e width/height (o canvas da plataforma).
 * Violacao = a derivacao recalcular, reordenar ou reancorar algo.
 */
export function verificarHeranca(
  fonte: Manifesto,
  variante: Manifesto,
): Violacao[] {
  const violacoes: Violacao[] = [];
  if (camposDeConteudo(fonte) !== camposDeConteudo(variante)) {
    violacoes.push({
      regra: "C1",
      mensagem:
        "a variante nao herda o conteudo da fonte em bytes: schema_version, " +
        "fps, cenas ou nos divergem — a derivacao recalcula (regra heranca, " +
        "pergunta (3) do card)",
    });
  }
  return violacoes;
}

// ---------------------------------------------------------------------------
// C2 — bloco de legenda por plataforma (pergunta adversarial (4))
// ---------------------------------------------------------------------------

/**
 * C2 — o bloco teorico de `maxLines` linhas de legenda cabe na caixa
 * vertical util da plataforma, ancorado na BASE da caixa. A regra roda para
 * CADA plataforma conhecida do contrato (16:9 e 9:16) — a pergunta 2 do
 * card, com o bloco consumido de F3-02 (src/sincronia/legendas/, dono F3-02
 * — aqui so se consome, nunca se edita).
 *
 * A ancoragem na base e parte da regra: o topo do bloco nao pode subir
 * acima do topo da caixa. Com o bloco cabendo na altura (<=), ancorar na
 * base mantem o bloco inteiro dentro — a desigualdade so tem DOIS lados
 * quando o bloco tambem e testado contra a altura, e e exatamente o que a
 * regra faz (a mesma invariante que AB-584 pede para reconferir quando o
 * retangulo 9:16 mudar).
 */
export function verificarBlocoDeLegenda(canvas: {
  width: number;
  height: number;
}): Violacao[] {
  const violacoes: Violacao[] = [];
  for (const plataforma of PLATAFORMAS) {
    if (
      Math.abs(canvas.width / canvas.height - plataforma.aspecto) >= 1e-6
    ) {
      continue;
    }
    const caixa = caixaVerticalUtil(canvas);
    if (caixa === null) {
      violacoes.push({
        regra: "C2",
        plataforma: plataforma.id,
        mensagem:
          `canvas ${canvas.width}x${canvas.height} sem caixa vertical util ` +
          `para a plataforma ${plataforma.id} (caixaVerticalUtil de F3-02 ` +
          "devolveu null) — o bloco de legenda nao pode ser ancorado",
      });
      continue;
    }
    const bloco = alturaDoBlocoDeLegenda(maxLines, canvas);
    if (bloco > caixa.altura) {
      violacoes.push({
        regra: "C2",
        plataforma: plataforma.id,
        mensagem:
          `bloco de legenda de ${maxLines} linhas (${bloco.toFixed(1)}px) ` +
          `estoura a caixa vertical util da plataforma ${plataforma.id} ` +
          `(${caixa.altura.toFixed(1)}px) em ${(bloco - caixa.altura).toFixed(1)}px ` +
          "— a legenda queimada sai da safe area em vertical",
      });
      continue;
    }
    // Ancoragem na base: o topo do bloco dentro da caixa.
    const topoDoBloco = caixa.y + caixa.altura - bloco;
    if (topoDoBloco < caixa.y) {
      violacoes.push({
        regra: "C2",
        plataforma: plataforma.id,
        mensagem: `bloco de legenda ancorado na base ultrapassa o topo da caixa ` +
          `da plataforma ${plataforma.id} — ancoragem invalida`,
      });
    }
  }
  return violacoes;
}

// ---------------------------------------------------------------------------
// C3 — conteudo na safe area (o ∅-crit)
// ---------------------------------------------------------------------------

/**
 * A imagem de um retangulo da fonte sob a derivacao: o reflow proporcional
 * do canvas. Cada eixo escala pela razao dos canvas (largura e altura sao
 * escalas INDEPENDENTES — e isso que muda o aspecto). Bordas arredondadas
 * UMA vez, no resultado — aritmetica inteira no resultado, como as camadas.
 */
export function imagemSobDerivacao(
  retangulo: Retangulo,
  fonte: { width: number; height: number },
  variante: { width: number; height: number },
): Retangulo {
  const sx = variante.width / fonte.width;
  const sy = variante.height / fonte.height;
  return {
    x: Math.round(retangulo.x * sx),
    y: Math.round(retangulo.y * sy),
    largura: Math.round(direitaDe(retangulo) * sx) - Math.round(retangulo.x * sx),
    altura: Math.round(baixoDe(retangulo) * sy) - Math.round(retangulo.y * sy),
  };
}

/** As margens violadas de um retangulo contra outro, em px (nomes estaveis). */
export function margensVioladas(
  conteudo: Retangulo,
  seguro: Retangulo,
): { margem: string; px: number }[] {
  const violadas: { margem: string; px: number }[] = [];
  if (conteudo.x < seguro.x) {
    violadas.push({ margem: "esquerda", px: seguro.x - conteudo.x });
  }
  if (direitaDe(conteudo) > direitaDe(seguro)) {
    violadas.push({
      margem: "direita",
      px: direitaDe(conteudo) - direitaDe(seguro),
    });
  }
  if (conteudo.y < seguro.y) {
    violadas.push({ margem: "topo", px: seguro.y - conteudo.y });
  }
  if (baixoDe(conteudo) > baixoDe(seguro)) {
    violadas.push({
      margem: "base",
      px: baixoDe(conteudo) - baixoDe(seguro),
    });
  }
  return violadas;
}

/**
 * C3 — o ∅-crit: o retangulo de CONTEUDO da variante tem de caber no
 * retangulo seguro da plataforma da variante. Conteudo = a imagem do
 * retangulo de conteudo da FONTE (o retangulo que a composicao fonte
 * declara proteger — o action safe EBU na 16:9, o retangulo util
 * provisional na 9:16) sob a derivacao.
 *
 * Roda para a plataforma da variante E para qualquer outra plataforma do
 * contrato com o MESMO aspecto — "de QUALQUER plataforma": um canvas 9:16
 * e verificado contra a plataforma 9:16 do contrato, seja ela qual for.
 *
 * Violacao nomeia a plataforma e CADA margem violada com os px.
 */
export function verificarConteudoNaSafeArea(
  fonte: { width: number; height: number },
  variante: { width: number; height: number },
  plataforma: Plataforma,
): Violacao[] {
  const violacoes: Violacao[] = [];

  const conteudoDaFonte = retanguloDeConteudo(fonte);
  if (conteudoDaFonte === null) {
    return [
      {
        regra: "C3",
        plataforma: plataforma.id,
        mensagem:
          `fonte ${fonte.width}x${fonte.height} sem retangulo de conteudo ` +
          "(nenhuma plataforma conhecida do contrato casa o aspecto) — " +
          "nao da para saber o que a variante deve proteger",
      },
    ];
  }

  const seguro = safeRectDaPlataforma(variante, plataforma);
  const imagem = imagemSobDerivacao(conteudoDaFonte, fonte, variante);

  if (!contem(seguro, imagem)) {
    const violadas = margensVioladas(imagem, seguro);
    violacoes.push({
      regra: "C3",
      plataforma: plataforma.id,
      mensagem:
        `conteudo da variante fora da safe area da plataforma ` +
        `${plataforma.id}: imagem do retangulo de conteudo da fonte ` +
        `[${imagem.x}..${direitaDe(imagem)})x[${imagem.y}..${baixoDe(imagem)}) ` +
        `nao cabe no retangulo seguro ` +
        `[${seguro.x}..${direitaDe(seguro)})x[${seguro.y}..${baixoDe(seguro)})` +
        (violadas.length > 0
          ? ` — margem(ões): ${violadas
              .map((v) => `${v.margem} ${v.px}px`)
              .join(", ")}`
          : ""),
    });
  }

  return violacoes;
}

// ---------------------------------------------------------------------------
// A verificacao completa
// ---------------------------------------------------------------------------

/**
 * Verifica a variante inteira contra o contrato: heranca (C1), bloco de
 * legenda por plataforma (C2) e conteudo na safe area (C3) para TODAS as
 * plataformas do contrato com o aspecto da variante.
 *
 * Devolve a lista de violacoes; vazia = variante entregavel. Quem entrega
 * (o gate e o F5-07) chama `exigirVarianteSegura` para transformar em erro.
 */
export function verificarVariante(
  fonte: Manifesto,
  variante: Manifesto,
): Violacao[] {
  const violacoes: Violacao[] = [...verificarHeranca(fonte, variante)];

  violacoes.push(...verificarBlocoDeLegenda(variante));

  const plataforma = plataformaDoCanvas(variante);
  if (plataforma === null) {
    violacoes.push({
      regra: "C3",
      mensagem:
        `canvas da variante ${variante.width}x${variante.height} nao casa ` +
        "nenhuma plataforma do contrato (plataformas.ts) — a variante nao " +
        "tem destino de safe area",
    });
  } else {
    for (const alvo of PLATAFORMAS) {
      if (Math.abs(alvo.aspecto - plataforma.aspecto) < 1e-6) {
        violacoes.push(
          ...verificarConteudoNaSafeArea(fonte, variante, alvo),
        );
      }
    }
  }

  return violacoes;
}

/**
 * Exige a variante segura: lança EVarianteInsegura com todas as violacoes.
 * O ponto de consumo do gate — "conteudo fora da safe area fica vermelho".
 */
export function exigirVarianteSegura(
  fonte: Manifesto,
  variante: Manifesto,
): void {
  const violacoes = verificarVariante(fonte, variante);
  if (violacoes.length > 0) {
    throw new EVarianteInsegura(violacoes);
  }
}

/** Conveniencia para relatorios: plataforma do canvas (ou null). */
export function plataformaDe(
  manifesto: { width: number; height: number },
): Plataforma | null {
  return plataformaDoCanvas(manifesto);
}

export { PLATAFORMA_16X9, PLATAFORMA_9X16, PLATAFORMAS };
