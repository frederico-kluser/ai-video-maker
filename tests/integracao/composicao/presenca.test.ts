// =============================================================================
// PRESENCA — o ∅-crit da suite integrada
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// Este arquivo e o alvo do ∅-crit do PROGRAMA:
//
//   "remover um no da fixture TEM de ficar vermelho por AUSENCIA, e nao
//    passar por 'menos frames para comparar'"
//
// A assercao e sobre a PRESENCA de cada no, uma por no, no render integrado:
// para cada no do MANIFESTO CANONICO (a fonte de verdade, imutavel), existe
// um frame da timeline canonica em que o no TEM de aparecer — `data-no`
// exato no markup da arvore integrada. Remover o no da fixture integrada
// tira o `data-no` do render, e a assercao daquele no fica VERMELHA,
// NOMEANDO O NO.
//
// Nada aqui conta frames, nada compara "menos frames para comparar": a
// unidade da assercao e o no, e o motivo da falha e a ausencia do no.
//
// A lista de nos NAO e fechada a mao: ela sai do MANIFESTO CANONICO
// (fixtures/canonico, imutavel) — e cada no e cobrado individualmente, a
// presenca de UM no nunca depende da presenca dos outros.
//
// POR QUE O CANONICO, E NAO A FIXTURE INTEGRADA: a lista de presenca tem de
// vir de uma fonte INDEPENDENTE da fixture que o ∅-crit muta. Se a lista
// saisse da fixture integrada, remover um no dela removeria tambem a
// expectativa — o gate passaria com "menos nos para cobrar", exatamente o
// falso verde que o ∅-crit do PROGRAMA proibe. Com a lista ancorada no
// canonico, remover um no da fixture integrada deixa a assercao daquele no
// ORFA: o no esperado nao aparece no render, e a falha NOMEIA O NO.
// =============================================================================

import { createElement, type ImgHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import manifestoCanonicoJson from "../../../fixtures/canonico/manifesto-valido.json";
import type { Manifesto } from "../../../src/contratos/manifesto";

// ---------------------------------------------------------------------------
// <Img> do Remotion NAO renderiza em react-dom/server: ele chama
// useCurrentFrame(), que so existe dentro de uma composicao registrada
// (achado da W4, documentado em tests/composicao/no-grafico.test.ts:164).
// O no `grafico` em modo asset emite <Img> — e os frames da cena c-004
// estao exatamente no meio deste gate. Para o oraculo de PRESENCA (markup)
// o <Img> vira um <img> puro: o que este gate prova e que o no desenha
// (data-no), nao que o navegador decodifica a imagem — isso e o trabalho
// do render de verdade (provar.ts, composicao integrado-grafico-asset).
// =============================================================================
vi.mock("remotion", async (importOriginal) => {
  const original = await importOriginal<typeof import("remotion")>();
  return {
    ...original,
    Img: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
  };
});

import { calcularDuracao } from "../../../src/composicao/tempo";
import {
  ArvoreIntegrada,
  FIXTURA_INTEGRADA,
} from "./fiar";

// ---------------------------------------------------------------------------
// A janela de cada no na timeline canonica
// ---------------------------------------------------------------------------

const CANONICO = manifestoCanonicoJson as unknown as Manifesto;
const duracao = calcularDuracao(CANONICO);

/**
 * O frame em que o no TEM de aparecer: 32 frames depois do inicio da cena,
 * no relogio da cena. O deslocamento fixo dentro da cena e o que torna a
 * assercao estavel quando a timeline muda (a remocao de outro no encurta
 * cenas e desloca tudo depois dela: um frame absoluto fixo passaria a
 * cair em outro ponto da janela do no).
 *
 * 32 e valido para todos os 15 nos da fixture: cada janela de no tem pelo
 * menos 45 frames (n-007: entrada 15 + duracao 45) e comeca ate 30 frames
 * dentro da cena (n-003, n-014).
 */
const DESLOCAMENTO_DENTRO_DA_CENA = 32;

interface Expectativa {
  noId: string;
  cenaId: string;
  frameAbsoluto: number;
}

const EXPECTATIVAS: readonly Expectativa[] = CANONICO.nos.map((no) => {
  const cena = CANONICO.cenas.find((c) => c.nos.includes(no.id));
  if (cena === undefined) {
    throw new Error(`presenca: no "${no.id}" nao pertence a nenhuma cena`);
  }
  const janela = duracao.timeline.find((t) => t.cenaId === cena.id);
  if (janela === undefined) {
    throw new Error(`presenca: cena "${cena.id}" sem janela na timeline`);
  }
  return {
    noId: no.id,
    cenaId: cena.id,
    frameAbsoluto: janela.frameInicial + DESLOCAMENTO_DENTRO_DA_CENA,
  };
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderArvore(frame: number): string {
  return renderToStaticMarkup(
    createElement(ArvoreIntegrada, { fixture: FIXTURA_INTEGRADA, frame }),
  );
}

/** Todos os `data-no` presentes no markup, em ordem de aparicao. */
function nosNoMarkup(html: string): string[] {
  const achados: string[] = [];
  const re = /data-no="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    achados.push(m[1]!);
  }
  return achados;
}

// ---------------------------------------------------------------------------
// O gate — a presenca de cada no no seu frame
// ---------------------------------------------------------------------------

describe("Presenca dos nos da fixture canonica no render integrado", () => {
  it.each(EXPECTATIVAS.map((e) => [e.noId, e.cenaId, e.frameAbsoluto] as const))(
    'no "%s" (cena %s) aparece no render integrado no frame %i',
    (noId, _cenaId, frameAbsoluto) => {
      const html = renderArvore(frameAbsoluto);
      const presentes = nosNoMarkup(html);
      // A mensagem NOMEIA O NO de proposito: e ela que o ∅-crit procura
      // quando exige que a falha seja por ausencia deste no.
      expect(
        presentes,
        `no "${noId}" AUSENTE do render integrado no frame ${String(frameAbsoluto)} ` +
          `(presentes: ${presentes.join(", ") || "nenhum"})`,
      ).toContain(noId);
    },
  );

  // O denominador da assercao acima: a lista de expectativas nao pode ser
  // vazia por engano — com zero expectativas o it.each sairia VERDE sem
  // ter olhado nada (C2).
  it("a lista de presenca tem um no por no do manifesto canonico", () => {
    expect(EXPECTATIVAS.length).toBe(CANONICO.nos.length);
    expect(EXPECTATIVAS.length).toBeGreaterThan(0);
  });

  it("o no de midia e o de grafico estao na lista de presenca", () => {
    const ids = EXPECTATIVAS.map((e) => e.noId);
    // PRESENCA, nunca lista fechada de todos os nos: estes dois sao os
    // que a W4 enderecou ao join (AB-344) — se sumirem da lista, o oraculo
    // de alfa do quadro composto deixa de ser exercitado.
    expect(ids).toContain("n-005");
    expect(ids).toContain("n-009");
  });

  it("todos os nos da fixture aparecem em pelo menos um frame (presenca integral)", () => {
    const vistos = new Set<string>();
    for (const expectativa of EXPECTATIVAS) {
      const html = renderArvore(expectativa.frameAbsoluto);
      for (const no of nosNoMarkup(html)) vistos.add(no);
    }
    for (const no of CANONICO.nos) {
      expect(
        vistos.has(no.id),
        `no "${no.id}" nao apareceu em nenhum frame amostrado da timeline`,
      ).toBe(true);
    }
    // O denominador: os 15 nos da fixture canonica.
    expect(vistos.size).toBe(CANONICO.nos.length);
  });
});
