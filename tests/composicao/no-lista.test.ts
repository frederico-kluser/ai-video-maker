// =============================================================================
// no-lista — o no `lista` nos dois extremos: UM item e VINTE itens
// =============================================================================
// Card: F1-06
//
// O que este arquivo cobra, em ordem de importancia:
//
//   1. NAO passa com quadro vazio (C1). O texto de cada item tem de estar no
//      markup, e a opacidade tem de ser 1 no frame cheio. Um componente que
//      devolvesse <div/> ficaria vermelho em quatro testes diferentes.
//   2. Determinismo: duas renderizacoes, bytes identicos.
//   3. Snapshot aprovado: ausencia e VERMELHO, nunca "nada a comparar".
//   4. VINTE itens: nada sai da safe area e nada encolhe abaixo do piso.
//      Os dois lados da fronteira sao exercitados — o que encolhe e cabe, e o
//      que nao cabe e LANCA.
//   5. Duracao declarada: fora de [0, duracao_frames) o no nao desenha nada.
//
// Sem JSX: vitest.config.ts so coleta `tests/**/*.test.ts`.
//
// PERGUNTA OBRIGATORIA DA ONDA — nenhuma assercao aqui e sobre a LISTA
// COMPLETA de alguma coisa compartilhada. O registro de nos e checado pela
// PRESENCA do tipo "lista" (nunca contra o conjunto fechado de tipos), e o
// unico conjunto fechado que este arquivo asserta e o de
// fixtures/snapshots/no-lista/, diretorio de propriedade exclusiva deste card.
// =============================================================================

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { planejarLista } from "src/composicao/nos/lista";
import { TextOverflowError } from "src/composicao/layout/overflow";
import { MIN_FONT_SIZE_PX } from "src/composicao/layout/ajuste";
import { REGISTRO_DE_NOS } from "src/composicao/registro";
import { msToFrames, safeArea16x9, transitionDuration } from "src/design/tokens";

import {
  CASOS,
  CASO_QUE_ENCOLHE,
  CASO_QUE_NAO_CABE,
  frameCheio,
  type CasoDeLista,
} from "../../tools/no-lista/casos";
import { markupDoCaso, planoDoCaso } from "../../tools/no-lista/render";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_DO_REPO = resolve(AQUI, "..", "..");
const DIR_SNAPSHOTS = resolve(RAIZ_DO_REPO, "fixtures", "snapshots", "no-lista");

function caso(nome: string): CasoDeLista {
  const achado = CASOS.find((c) => c.nome === nome);
  if (achado === undefined) {
    throw new Error(`caso "${nome}" nao existe em tools/no-lista/casos.ts`);
  }
  return achado;
}

function planoDe(c: CasoDeLista, frame = c.frame): ReturnType<typeof planejarLista> {
  return planejarLista(c.no, frame, c.fps, c.width, c.height);
}

/** Ids de item na ordem em que aparecem no markup. */
function ordemDosItens(markup: string): number[] {
  const achados: number[] = [];
  const re = /data-item="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup)) !== null) achados.push(Number(m[1]));
  return achados;
}

// ---------------------------------------------------------------------------
// 1. Nao passa com quadro vazio (C1)
// ---------------------------------------------------------------------------

describe("quadro vazio nao passa (C1)", () => {
  it("o markup de VINTE itens traz os vinte textos, um por um", () => {
    const c = caso("vinte-itens");
    const markup = markupDoCaso(c);
    for (const texto of c.no.itens) {
      expect(markup, `texto ausente do markup: "${texto}"`).toContain(texto);
    }
    expect(markup).toContain(`data-itens="${String(c.no.itens.length)}"`);
    expect(markup.length).toBeGreaterThan(2000);
  });

  it("o markup de UM item traz o texto do item", () => {
    const c = caso("um-item");
    const markup = markupDoCaso(c);
    expect(markup).toContain(c.no.itens[0]!);
    expect(markup).toContain('data-itens="1"');
  });

  it("no frame cheio TODA opacidade e 1 — texto presente e invisivel seria o mesmo que ausente", () => {
    for (const c of CASOS) {
      const cheio = frameCheio(c.no.duracao_frames, c.fps);
      const plano = planoDe(c, cheio);
      expect(plano.opacidadeDoNo, `${c.nome}: opacidade do no`).toBe(1);
      for (const caixa of plano.caixas) {
        expect(
          caixa.opacidade,
          `${c.nome}: item ${String(caixa.indice)} nao chegou a opacidade 1 em ${String(cheio)}`,
        ).toBe(1);
      }
    }
  });

  it("lista sem itens e RECUSADA, nao desenhada vazia", () => {
    const c = caso("um-item");
    expect(() => planejarLista({ ...c.no, itens: [] }, 0, c.fps, c.width, c.height)).toThrow(
      /itens` vazio/,
    );
  });

  it("nada de overflow:hidden nem text-overflow — cortar em silencio e o defeito", () => {
    const markup = markupDoCaso(caso("vinte-itens"));
    expect(markup).not.toContain("overflow:hidden");
    expect(markup).not.toContain("text-overflow");
    expect(markup).toContain("overflow:visible");
  });
});

// ---------------------------------------------------------------------------
// 2. Determinismo
// ---------------------------------------------------------------------------

describe("determinismo — duas renderizacoes, bytes identicos", () => {
  for (const c of CASOS) {
    it(`${c.nome}: html 2x identico byte a byte`, () => {
      const a = Buffer.from(markupDoCaso(c), "utf-8");
      const b = Buffer.from(markupDoCaso(c), "utf-8");
      expect(a.equals(b)).toBe(true);
    });

    it(`${c.nome}: plano 2x identico byte a byte`, () => {
      const a = Buffer.from(planoDoCaso(c), "utf-8");
      const b = Buffer.from(planoDoCaso(c), "utf-8");
      expect(a.equals(b)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Snapshot aprovado — ausencia e VERMELHO
// ---------------------------------------------------------------------------

describe("snapshot aprovado (∅-crit: apagar um snapshot deixa isto vermelho)", () => {
  it("o diretorio de snapshots existe e nao esta vazio (denominador zero e falso verde, C2)", () => {
    expect(
      existsSync(DIR_SNAPSHOTS),
      `fixtures/snapshots/no-lista/ nao existe — rode 'just no-lista-aprovar'`,
    ).toBe(true);
    expect(readdirSync(DIR_SNAPSHOTS).length).toBeGreaterThan(0);
  });

  for (const c of CASOS) {
    for (const [extensao, conteudo] of [
      ["html", markupDoCaso],
      ["json", planoDoCaso],
    ] as const) {
      it(`${c.nome}.${extensao}: existe e bate com o aprovado`, () => {
        const caminho = resolve(DIR_SNAPSHOTS, `${c.nome}.${extensao}`);
        if (!existsSync(caminho)) {
          expect.fail(
            `SNAPSHOT AUSENTE: fixtures/snapshots/no-lista/${c.nome}.${extensao}\n` +
              `Ausencia nao e "nada a comparar" — e regressao ate prova em contrario.\n` +
              `Se a mudanca e intencional: just no-lista-aprovar, revise o diff, commite.`,
          );
        }
        const aprovado = readFileSync(caminho);
        const atual = Buffer.from(conteudo(c), "utf-8");
        // Mensagem legivel antes da comparacao de bytes.
        expect(atual.toString("utf-8")).toBe(aprovado.toString("utf-8"));
        expect(atual.equals(aprovado)).toBe(true);
      });
    }
  }

  it("nenhum snapshot orfao: todo arquivo do diretorio pertence a um caso", () => {
    // Este e o UNICO conjunto fechado assertado neste arquivo, e ele e seguro
    // porque fixtures/snapshots/no-lista/ e propriedade exclusiva de F1-06
    // (docs/contrato-w4.md §1). Sem ele, um snapshot de um caso removido fica
    // no disco sendo revisado por ninguem.
    const esperados = new Set(
      CASOS.flatMap((c) => [`${c.nome}.html`, `${c.nome}.json`]),
    );
    const orfaos = readdirSync(DIR_SNAPSHOTS).filter((nome) => !esperados.has(nome));
    expect(orfaos, `snapshots sem caso correspondente: ${orfaos.join(", ")}`).toStrictEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------
// 4a. UM item — a grade nao pode ficar absurda
// ---------------------------------------------------------------------------

describe("UM item — a grade nao fica absurda", () => {
  const c = caso("um-item");

  it("uma coluna, uma linha — nada de grade de tres colunas com duas celulas vazias", () => {
    const plano = planoDe(c);
    expect([plano.colunas, plano.linhas]).toStrictEqual([1, 1]);
    expect(plano.caixas.length).toBe(1);
  });

  it("o bloco e justo ao conteudo, nao a safe area inteira", () => {
    const plano = planoDe(c);
    const caixa = plano.caixas[0]!;
    // Altura: exatamente uma linha de texto, nao os 1004px da safe area.
    expect(plano.bloco.altura).toBe(plano.alturaDeLinha);
    expect(plano.bloco.altura).toBeLessThan(plano.safeRect.altura / 4);
    // Largura: a do texto medido, nao a da safe area.
    expect(plano.bloco.largura).toBe(caixa.larguraMedida);
    expect(plano.bloco.largura).toBeLessThan(plano.safeRect.largura);
  });

  it("a fonte nao infla para preencher a tela — o token manda", () => {
    const plano = planoDe(c);
    expect(plano.fonte).toBe(plano.fonteBase);
  });

  it("o bloco esta dentro da safe area e centrado no eixo vertical", () => {
    const plano = planoDe(c);
    expect(plano.bloco.x).toBeGreaterThanOrEqual(plano.safeRect.x);
    expect(plano.bloco.y).toBeGreaterThanOrEqual(plano.safeRect.y);
    const folgaAcima = plano.bloco.y - plano.safeRect.y;
    const folgaAbaixo =
      plano.safeRect.y + plano.safeRect.altura - (plano.bloco.y + plano.bloco.altura);
    expect(Math.abs(folgaAcima - folgaAbaixo)).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4b. VINTE itens — safe area e piso legivel
// ---------------------------------------------------------------------------

describe("VINTE itens — nada sai da safe area, nada encolhe abaixo do piso", () => {
  it("a safe area do plano vem do token EBU R 95, nao de um numero solto", () => {
    // Oraculo INDEPENDENTE. Sem este teste, todas as assercoes de "dentro da
    // safe area" comparariam o plano contra o retangulo que o proprio plano
    // calculou: uma margem zerada passaria despercebida.
    const c = caso("vinte-itens");
    const margemH = Math.round(c.width * safeArea16x9.actionSafePct);
    const margemV = Math.round(c.height * safeArea16x9.actionSafePct);
    expect(planoDe(c).safeRect).toStrictEqual({
      x: margemH,
      y: margemV,
      largura: c.width - margemH * 2,
      altura: c.height - margemV * 2,
    });
    expect(margemH).toBeGreaterThan(0);
    expect(margemV).toBeGreaterThan(0);
  });

  for (const nome of ["vinte-itens", "vinte-itens-ordenada"]) {
    const c = caso(nome);

    it(`${nome}: os vinte itens existem e a grade e 3x7`, () => {
      const plano = planoDe(c);
      expect(plano.caixas.length).toBe(20);
      expect(plano.colunas).toBe(3);
      expect(plano.linhas).toBe(7);
    });

    it(`${nome}: TODA caixa esta dentro da safe area`, () => {
      const plano = planoDe(c);
      const s = plano.safeRect;
      for (const caixa of plano.caixas) {
        const fora: string[] = [];
        if (caixa.x < s.x) fora.push("esquerda");
        if (caixa.y < s.y) fora.push("topo");
        if (caixa.x + caixa.largura > s.x + s.largura) fora.push("direita");
        if (caixa.y + caixa.altura > s.y + s.altura) fora.push("base");
        expect(
          fora,
          `item ${String(caixa.indice)} sai da safe area por: ${fora.join(", ")}`,
        ).toStrictEqual([]);
      }
      expect(plano.bloco.x + plano.bloco.largura).toBeLessThanOrEqual(s.x + s.largura);
      expect(plano.bloco.y + plano.bloco.altura).toBeLessThanOrEqual(s.y + s.altura);
    });

    it(`${nome}: o texto medido cabe na celula — nao ha corte`, () => {
      const plano = planoDe(c);
      for (const caixa of plano.caixas) {
        expect(
          caixa.larguraMedida,
          `item ${String(caixa.indice)} mede ${String(caixa.larguraMedida)}px numa celula de ${String(caixa.largura)}px`,
        ).toBeLessThanOrEqual(caixa.largura);
      }
    });

    it(`${nome}: a fonte esta no piso legivel ou acima`, () => {
      const plano = planoDe(c);
      expect(plano.fonte).toBeGreaterThanOrEqual(plano.pisoDeFonte);
      expect(plano.pisoDeFonte).toBeGreaterThanOrEqual(MIN_FONT_SIZE_PX);
      expect(plano.fonte).toBeLessThanOrEqual(plano.fonteBase);
    });
  }

  it("com vinte itens em 4K o piso sobe junto com a resolucao", () => {
    const c = caso("vinte-itens");
    const plano = planejarLista(c.no, c.frame, c.fps, 3840, 2160);
    expect(plano.pisoDeFonte).toBeGreaterThan(MIN_FONT_SIZE_PX);
    expect(plano.fonte).toBeGreaterThanOrEqual(plano.pisoDeFonte);
    const s = plano.safeRect;
    for (const caixa of plano.caixas) {
      expect(caixa.x + caixa.largura).toBeLessThanOrEqual(s.x + s.largura);
      expect(caixa.y + caixa.altura).toBeLessThanOrEqual(s.y + s.altura);
    }
  });
});

// ---------------------------------------------------------------------------
// 4c. Encolher x falhar — os dois lados da fronteira
// ---------------------------------------------------------------------------

describe("encolher para caber e pior que falhar — qual dos dois o codigo faz", () => {
  it("acima do piso: ENCOLHE (a fonte desce e o texto continua legivel)", () => {
    const c = CASO_QUE_ENCOLHE;
    const plano = planoDe(c);
    expect(plano.fonte).toBeLessThan(plano.fonteBase);
    expect(plano.fonte).toBeGreaterThanOrEqual(plano.pisoDeFonte);
    for (const caixa of plano.caixas) {
      expect(caixa.larguraMedida).toBeLessThanOrEqual(caixa.largura);
    }
  });

  it("abaixo do piso: FALHA — TextOverflowError nomeando o no, e o build para", () => {
    const c = CASO_QUE_NAO_CABE;
    expect(() => planoDe(c)).toThrow(TextOverflowError);
    expect(() => planoDe(c)).toThrow(new RegExp(`"${c.no.id}"`));
    expect(() => planoDe(c)).toThrow(/OVERFLOW/);
  });

  it("o componente inteiro para junto — nao existe render pela metade", () => {
    expect(() => markupDoCaso(CASO_QUE_NAO_CABE)).toThrow(TextOverflowError);
  });

  it("a mensagem de erro diz o tamanho de fonte em que desistiu (o piso)", () => {
    const c = CASO_QUE_NAO_CABE;
    const piso = planejarLista(
      { ...c.no, itens: [c.no.itens[0]!] },
      c.frame,
      c.fps,
      c.width,
      c.height,
    ).pisoDeFonte;
    try {
      planoDe(c);
      expect.unreachable("deveria ter lancado TextOverflowError");
    } catch (erro) {
      expect((erro as TextOverflowError).measurement.fontSize).toBe(piso);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Duracao declarada — o no nao desenha fora da propria janela
// ---------------------------------------------------------------------------

describe("duracao declarada — fora da janela o no nao desenha nada", () => {
  const c = caso("vinte-itens");
  const duracao = c.no.duracao_frames;

  it("dentro da janela: visivel e com markup", () => {
    for (const frame of [0, 1, duracao - 1]) {
      const plano = planoDe(c, frame);
      expect(plano.visivel, `frame ${String(frame)}`).toBe(true);
    }
    expect(markupDoCaso({ ...c, frame: duracao - 1 }).trim().length).toBeGreaterThan(0);
  });

  it("no frame seguinte ao ultimo: nao visivel e markup VAZIO", () => {
    const plano = planoDe(c, duracao);
    expect(plano.visivel).toBe(false);
    expect(markupDoCaso({ ...c, frame: duracao }).trim()).toBe("");
  });

  it("antes do primeiro frame: nao visivel e markup VAZIO", () => {
    expect(planoDe(c, -1).visivel).toBe(false);
    expect(markupDoCaso({ ...c, frame: -1 }).trim()).toBe("");
  });

  it("a coreografia inteira cabe na janela: ninguem entra depois que a saida comeca", () => {
    const saida = Math.max(1, msToFrames(transitionDuration.instant, c.fps));
    const plano = planoDe(c, duracao - saida);
    for (const caixa of plano.caixas) {
      expect(
        caixa.opacidade,
        `item ${String(caixa.indice)} ainda entrava quando a saida comecou`,
      ).toBe(1);
    }
    // E no ultimo frame o no ja esta saindo, mas ainda desenha.
    const ultimo = planoDe(c, duracao - 1);
    expect(ultimo.opacidadeDoNo).toBeGreaterThan(0);
    expect(ultimo.opacidadeDoNo).toBeLessThan(1);
  });

  it("uma duracao curta encurta o escalonamento em vez de estourar a janela", () => {
    const curto = { ...c, no: { ...c.no, duracao_frames: 12 } };
    const plano = planoDe(curto, 11);
    expect(plano.visivel).toBe(true);
    expect(planoDe(curto, 12).visivel).toBe(false);
    // Com 20 itens e 12 frames nao ha orcamento: todos entram juntos (passo 0).
    const opacidades = plano.caixas.map((caixa) => caixa.opacidade);
    expect(new Set(opacidades).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 6. Ordem — Regra 1 (nada de iteracao sem ordenacao explicita)
// ---------------------------------------------------------------------------

describe("ordem dos itens e a do manifesto (Regra 1)", () => {
  it("os itens aparecem no markup na ordem do array, de 0 a n-1", () => {
    const c = caso("vinte-itens");
    const esperada = c.no.itens.map((_, i) => i);
    expect(ordemDosItens(markupDoCaso(c))).toStrictEqual(esperada);
  });

  it("inverter o array inverte a saida — se a ordem viesse de chave de objeto, nao mudaria", () => {
    const c = caso("oito-itens");
    const invertido: CasoDeLista = {
      ...c,
      no: { ...c.no, itens: [...c.no.itens].reverse() },
    };
    const original = planoDe(c).caixas.map((caixa) => caixa.texto);
    const trocado = planoDe(invertido).caixas.map((caixa) => caixa.texto);
    expect(trocado).toStrictEqual([...original].reverse());
    expect(trocado).not.toStrictEqual(original);
  });

  it("itens repetidos nao colapsam — a chave e a posicao, nao o texto", () => {
    const c = caso("um-item");
    const repetido: CasoDeLista = {
      ...c,
      no: { ...c.no, itens: ["igual", "igual", "igual"] },
    };
    const plano = planoDe(repetido);
    expect(plano.caixas.map((caixa) => caixa.indice)).toStrictEqual([0, 1, 2]);
    expect(ordemDosItens(markupDoCaso(repetido))).toStrictEqual([0, 1, 2]);
  });

  it("numeracao segue a posicao no array: 1..n, nao a ordem de nada mais", () => {
    const plano = planoDe(caso("vinte-itens-ordenada"));
    expect(plano.caixas.map((caixa) => caixa.marcador)).toStrictEqual(
      plano.caixas.map((caixa) => `${String(caixa.indice + 1)}.`),
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Fiacao — presenca do MEU item, nunca a lista fechada
// ---------------------------------------------------------------------------

describe("fiacao do no lista", () => {
  it("o tipo `lista` esta registrado e aponta para este componente", () => {
    // Assercao de PRESENCA. Nao se asserta aqui o conjunto de tipos
    // registrados: essa lista e verdade contra esta base e falsa depois do
    // merge do irmao (docs/contrato-w4.md §5).
    const modulo = REGISTRO_DE_NOS.get("lista");
    expect(modulo, "tipo `lista` sumiu do registro").toBeDefined();
    expect(modulo?.meta.id).toBe("no-lista");
    expect(modulo?.meta.schema).toBe("Lista.1");
    expect(modulo?.meta.tipo).toBe("lista");
  });
});
