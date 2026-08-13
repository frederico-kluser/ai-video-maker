// =============================================================================
// no-midia — o oraculo do no de midia (F1-07)
// =============================================================================
// Este arquivo nao checa se compila. Ele tenta DERRUBAR o componente:
//
//   - passa URL por sete portas diferentes e exige recusa em todas;
//   - envenena o relogio global e exige que o render nao mude um byte;
//   - renderiza o GIF no mesmo frame duas vezes e em frames diferentes;
//   - renderiza fora da janela declarada e exige que nada seja desenhado;
//   - compara a marcacao com o snapshot aprovado, e o pixel do still aprovado;
//   - e roda as MESMAS assercoes contra um componente que devolve quadro
//     vazio, exigindo que elas REPROVEM (C2: oraculo que so sabe dizer sim
//     nao e oraculo).
//
// Sem JSX: vitest.config.ts so coleta `tests/**/*.test.ts`.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Midia, {
  ErroDeMidia,
  MS_POR_QUADRO_DE_GIF,
  ajusteParaObjectFit,
  ehHashDeConteudo,
  framesPorQuadroDeGif,
  meta as metaDoNo,
  normalizarParaTripwire,
  pareceUrl,
  quadroDeGif,
  validarNoDeMidia,
} from "src/composicao/nos/midia";
import { REGISTRO_DE_NOS, tiposRegistrados } from "src/composicao/registro";
import { highlight, text as corDeTexto, transitionDuration } from "src/design/tokens";
import type { No, NoMidia } from "src/contratos/manifesto";

import {
  ALTURA,
  CASOS_DE_MARCACAO,
  CASOS_DE_STILL,
  DIR_APROVADOS,
  FPS,
  LARGURA,
  NO_GIF,
  NO_IMAGEM,
  NO_VIDEO,
  noDeMidiaDaFixture,
} from "../../fixtures/snapshots/no-midia/casos";
import { marcacaoDoCaso } from "../../tools/no-midia/marcacao";
import { analisarPng, analisarRgba, violacoesDeQuadro } from "../../tools/no-midia/pixels";

const RAIZ = resolve(import.meta.dirname, "..", "..");
const APROVADOS = resolve(RAIZ, DIR_APROVADOS);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GIF = noDeMidiaDaFixture(NO_GIF);
const IMAGEM = noDeMidiaDaFixture(NO_IMAGEM);
const VIDEO = noDeMidiaDaFixture(NO_VIDEO);

/** Um no de midia valido, com os campos que o caso quiser trocar. */
function comCampos(base: NoMidia, campos: Record<string, unknown>): No {
  return { ...base, ...campos } as unknown as No;
}

function renderizar(no: No, frame: number): string {
  return renderToStaticMarkup(
    createElement(Midia, { no, frame, fps: FPS, width: LARGURA, height: ALTURA }),
  );
}

/** O trecho da fita de cadencia do GIF — o que TEM de depender do frame. */
function trechoDaFita(html: string): string {
  const inicio = html.indexOf("<div data-quadro-gif=");
  if (inicio < 0) return "";
  return html.slice(inicio);
}

/**
 * As assercoes de conteudo, extraidas para poderem ser viradas contra um
 * componente de mentira. Devolve a lista de violacoes (vazia = aprovado).
 */
function violacoesDeConteudo(html: string, no: NoMidia): string[] {
  const erros: string[] = [];
  if (html.trim().length === 0) {
    erros.push("marcacao vazia — o quadro nao tem nada");
    return erros;
  }
  if (!html.includes(`data-no="${no.id}"`)) {
    erros.push(`marcacao sem data-no="${no.id}"`);
  }
  if (!html.includes(`data-tipo="${metaDoNo.tipo}"`)) {
    erros.push(`marcacao sem data-tipo="${metaDoNo.tipo}"`);
  }
  if (!html.includes(no.hash.slice(0, 12))) {
    erros.push("marcacao sem o prefixo do hash — o endereco nao aparece");
  }
  if (html.length < 200) {
    erros.push(`marcacao com ${String(html.length)} chars — curta demais para ter desenho`);
  }
  return erros;
}

// ---------------------------------------------------------------------------
// 0. Meta e registro — a fiacao que F1-01 cobra
// ---------------------------------------------------------------------------

describe("meta e registro", () => {
  it("o meta e o que F1-01 fixou: tipo, schema e id", () => {
    expect(metaDoNo.tipo).toBe("midia");
    expect(metaDoNo.schema).toBe("Midia.1");
    expect(metaDoNo.id).toBe("no-midia");
    expect(metaDoNo.descricao.trim().length).toBeGreaterThan(0);
  });

  it("o tipo 'midia' esta registrado (presenca do MEU item, nunca a lista toda)", () => {
    // Contrato da W4 §5: assercao sobre lista fechada e verdade contra esta
    // base e mentira depois do merge do irmao.
    expect(tiposRegistrados()).toContain("midia");
    expect(REGISTRO_DE_NOS.get("midia")?.componente).toBe(Midia);
    expect(REGISTRO_DE_NOS.get("midia")?.meta.id).toBe("no-midia");
  });
});

// ---------------------------------------------------------------------------
// 1. HASH, NUNCA URL — a pergunta especifica do card
// ---------------------------------------------------------------------------

describe("hash, nunca URL — a recusa e provada, nao presumida", () => {
  const HASH_VALIDO = GIF.hash;

  it("o detector de URL sabe dizer NAO (controle negativo, C2)", () => {
    // Um detector que devolve true para tudo reprovaria a fixture inteira e
    // ninguem notaria: os testes de recusa continuariam verdes.
    expect(pareceUrl(HASH_VALIDO)).toBe(false);
    expect(pareceUrl("CC-BY-4.0")).toBe(false);
    expect(pareceUrl("MIT")).toBe(false);
    expect(pareceUrl("Diagrama do pipeline: manifesto, validacao, timeline")).toBe(
      false,
    );
    // Falso vermelho tambem custa caro: "data:" no meio da prosa nao e URL.
    expect(pareceUrl("registrado na data: 2026-08-11")).toBe(false);
  });

  const ENDERECOS: [string, string][] = [
    ["https", "https://cdn.exemplo.com/gato.gif"],
    ["http", "http://exemplo.com/a.png"],
    ["relativo a protocolo", "//cdn.exemplo.com/a.png"],
    ["data URI", "data:image/gif;base64,R0lGODlhAQABAAAAACw="],
    ["file", "file:///home/alguem/a.gif"],
    ["blob", "blob:https://exemplo.com/9a8b"],
    ["hospedeiro nu", "www.exemplo.com/a.png"],
    ["tripwire com espacos (C11)", "h t t p s://cdn.exemplo.com/a.png"],
  ];

  for (const [nome, endereco] of ENDERECOS) {
    it(`recusa URL no hash — ${nome}`, () => {
      const no = comCampos(GIF, { hash: endereco });
      expect(validarNoDeMidia(no).join("\n")).toMatch(/URL|hash/);
      expect(() => renderizar(no, 0)).toThrow(ErroDeMidia);
    });
  }

  const HASHES_TORTOS: [string, unknown][] = [
    ["hex maiusculo (canonico e minusculo)", HASH_VALIDO.toUpperCase()],
    ["63 caracteres", HASH_VALIDO.slice(0, 63)],
    ["65 caracteres", `${HASH_VALIDO}a`],
    ["vazio", ""],
    ["ausente", undefined],
    ["numero", 12345],
    ["caminho de disco", "/var/cache/assets/gato.gif"],
    ["nome de arquivo", "gato.gif"],
  ];

  for (const [nome, valor] of HASHES_TORTOS) {
    it(`recusa endereco que nao e SHA-256 — ${nome}`, () => {
      const no = comCampos(GIF, { hash: valor });
      expect(validarNoDeMidia(no).length).toBeGreaterThan(0);
      expect(() => renderizar(no, 0)).toThrow(ErroDeMidia);
    });
  }

  it("recusa URL contrabandeada em OUTRO campo (texto_alternativo)", () => {
    const no = comCampos(GIF, {
      texto_alternativo: "veja em https://exemplo.com/original.gif",
    });
    expect(validarNoDeMidia(no).join("\n")).toContain("texto_alternativo");
    expect(() => renderizar(no, 0)).toThrow(ErroDeMidia);
  });

  it("recusa URL contrabandeada na licenca (a URL vive em `origem`, la em cima)", () => {
    const no = comCampos(GIF, { licenca: "https://creativecommons.org/licenses/by/4.0/" });
    expect(validarNoDeMidia(no).join("\n")).toContain("licenca");
    expect(() => renderizar(no, 0)).toThrow(ErroDeMidia);
  });

  const NOMES_DE_ENDERECO = ["url", "src", "href", "uri", "caminho", "path", "link"];
  for (const chave of NOMES_DE_ENDERECO) {
    it(`recusa propriedade de endereco "${chave}" mesmo com hash valido ao lado`, () => {
      const no = comCampos(GIF, { [chave]: "/qualquer/coisa" });
      expect(validarNoDeMidia(no).join("\n")).toContain(chave);
      expect(() => renderizar(no, 0)).toThrow(ErroDeMidia);
    });
  }

  it("a recusa lista TODOS os problemas de uma vez, nao so o primeiro", () => {
    const no = comCampos(GIF, {
      hash: "https://exemplo.com/a.gif",
      src: "https://exemplo.com/a.gif",
      tipo_midia: "holograma",
    });
    expect(validarNoDeMidia(no).length).toBeGreaterThanOrEqual(3);
  });

  it("controle positivo: os tres nos de midia da fixture sao aceitos", () => {
    for (const no of [IMAGEM, VIDEO, GIF]) {
      expect(validarNoDeMidia(no)).toStrictEqual([]);
      expect(() => renderizar(no, 0)).not.toThrow();
    }
  });

  it("nenhuma URL sai na marcacao — nem src, nem url(), nem esquema", () => {
    for (const no of [IMAGEM, VIDEO, GIF]) {
      const html = renderizar(no, 1);
      expect(html).not.toContain("://");
      expect(html).not.toContain("src=");
      expect(html).not.toContain("url(");
      expect(html).not.toContain("background-image");
      expect(html).not.toContain("mask-image");
      expect(normalizarParaTripwire(html)).not.toContain("://");
    }
  });

  it("recusar NAO e pular: o erro chega a quem chamou, com o id do no", () => {
    const no = comCampos(GIF, { hash: "https://exemplo.com/a.gif" });
    try {
      renderizar(no, 0);
      expect.unreachable("o componente deveria ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeMidia);
      expect((erro as ErroDeMidia).message).toContain(GIF.id);
      expect((erro as ErroDeMidia).erros.length).toBeGreaterThan(0);
    }
  });

  it("ehHashDeConteudo separa o hash canonico do resto", () => {
    expect(ehHashDeConteudo(HASH_VALIDO)).toBe(true);
    expect(ehHashDeConteudo(HASH_VALIDO.toUpperCase())).toBe(false);
    expect(ehHashDeConteudo("https://x/y")).toBe(false);
    expect(ehHashDeConteudo(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. O GIF AVANCA PELO FRAME — a outra pergunta especifica
// ---------------------------------------------------------------------------

describe("o GIF avanca pelo FRAME, nunca pelo relogio", () => {
  it("a cadencia sai de token, e a aritmetica bate a mao", () => {
    expect(MS_POR_QUADRO_DE_GIF).toBe(transitionDuration.instant);
    // 100 ms a 30 fps = 3 frames por quadro de GIF (~10 quadros/s).
    expect(framesPorQuadroDeGif(30)).toBe(3);
    expect(framesPorQuadroDeGif(60)).toBe(6);
    // Nunca zero: um GIF mais rapido que a composicao nao anda para tras.
    expect(framesPorQuadroDeGif(1)).toBe(1);
  });

  it("quadroDeGif e funcao pura de (frame, fps) — tabela calculada a mao", () => {
    const esperado: [number, number][] = [
      [0, 0], [1, 0], [2, 0],
      [3, 1], [4, 1], [5, 1],
      [6, 2], [9, 3], [44, 14],
    ];
    for (const [frame, quadro] of esperado) {
      expect(quadroDeGif(frame, 30), `frame ${String(frame)}`).toBe(quadro);
    }
  });

  it("quadroDeGif nunca anda para tras dentro da janela do no", () => {
    let anterior = -1;
    for (let frame = 0; frame < GIF.duracao_frames; frame++) {
      const atual = quadroDeGif(frame, FPS);
      expect(atual).toBeGreaterThanOrEqual(anterior);
      anterior = atual;
    }
    expect(anterior).toBeGreaterThan(0);
  });

  it("MESMO frame, duas vezes: bytes identicos", () => {
    for (const frame of [0, 6, 44]) {
      expect(renderizar(GIF, frame)).toBe(renderizar(GIF, frame));
    }
  });

  it("frames DIFERENTES (quadros diferentes): a fita muda", () => {
    const f000 = renderizar(GIF, 0);
    const f003 = renderizar(GIF, 3);
    const f006 = renderizar(GIF, 6);
    expect(trechoDaFita(f000)).not.toBe(trechoDaFita(f003));
    expect(trechoDaFita(f003)).not.toBe(trechoDaFita(f006));
    expect(f000).not.toBe(f006);
  });

  it("frames diferentes DENTRO do mesmo quadro: a fita nao muda", () => {
    // Se a fita mudasse aqui, ela estaria seguindo o frame cru e nao a
    // cadencia do GIF — a aritmetica de quadro seria decorativa.
    const fita0 = trechoDaFita(renderizar(GIF, 0));
    expect(trechoDaFita(renderizar(GIF, 1))).toBe(fita0);
    expect(trechoDaFita(renderizar(GIF, 2))).toBe(fita0);
    expect(trechoDaFita(renderizar(GIF, 3))).not.toBe(fita0);
  });

  it("a marcacao publica o quadro do GIF, para o gate poder olhar", () => {
    expect(renderizar(GIF, 0)).toContain('data-quadro-gif="0"');
    expect(renderizar(GIF, 6)).toContain('data-quadro-gif="2"');
    // Quem nao e GIF nao ganha fita nenhuma.
    expect(renderizar(IMAGEM, 6)).not.toContain("data-quadro-gif");
    expect(renderizar(VIDEO, 6)).not.toContain("data-quadro-gif");
  });
});

// ---------------------------------------------------------------------------
// 3. RELOGIO ENVENENADO — o render nao pode nem tocar no relogio
// ---------------------------------------------------------------------------

interface RelogioEnvenenado {
  restaurar: () => void;
  tocado: string[];
}

/**
 * Troca todo relogio e todo RNG global por armadilhas. Quem chamar cai.
 * Vale para a chamada DIRETA do componente (funcao pura); nao envolvemos o
 * `renderToStaticMarkup` porque as entranhas do React nao estao sob julgamento.
 */
function envenenarRelogio(): RelogioEnvenenado {
  const tocado: string[] = [];
  const dateNow = Date.now;
  const mathRandom = Math.random;
  const perfNow = globalThis.performance.now;
  const setT = globalThis.setTimeout;
  const raf = globalThis.requestAnimationFrame;

  const armadilha = (nome: string) => (): never => {
    tocado.push(nome);
    throw new Error(`o componente chamou ${nome} — relogio no caminho do render`);
  };

  Date.now = armadilha("Date.now");
  Math.random = armadilha("Math.random");
  globalThis.performance.now = armadilha("performance.now");
  (globalThis as unknown as { setTimeout: unknown }).setTimeout = armadilha("setTimeout");
  (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame =
    armadilha("requestAnimationFrame");

  return {
    tocado,
    restaurar: () => {
      Date.now = dateNow;
      Math.random = mathRandom;
      globalThis.performance.now = perfNow;
      (globalThis as unknown as { setTimeout: unknown }).setTimeout = setT;
      (globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame =
        raf;
    },
  };
}

describe("relogio envenenado — o no anda pelo frame ou nao anda", () => {
  it("o componente renderiza com o relogio inteiro em armadilha", () => {
    const veneno = envenenarRelogio();
    let arvore: ReactNode | Promise<ReactNode>;
    try {
      // O COMPONENTE executa dentro do veneno — chamada direta, sem
      // react-dom no meio. Se ele tocar em relogio/RNG, estoura antes de
      // qualquer assert. O renderToStaticMarkup fica FORA: as entranhas do
      // React chamam performance.now() e nao estao sob julgamento.
      arvore = Midia({ no: GIF, frame: 6, fps: FPS, width: LARGURA, height: ALTURA });
    } finally {
      veneno.restaurar();
    }
    expect(veneno.tocado).toStrictEqual([]);
    expect(renderToStaticMarkup(arvore as ReactNode)).toBe(renderizar(GIF, 6));
  });

  it("o mesmo frame com o relogio deslocado produz os mesmos bytes", () => {
    const antes = renderizar(GIF, 6);
    const dateNow = Date.now;
    try {
      Date.now = () => 1893456000000;
      expect(renderizar(GIF, 6)).toBe(antes);
    } finally {
      Date.now = dateNow;
    }
  });

  it("sonda negativa: um no que anda pelo relogio CAI na armadilha (C2)", () => {
    // Sem esta linha, o teste acima poderia estar verde por nao olhar nada.
    const NoDoRelogio = (): ReactNode =>
      createElement("div", { "data-quadro": String(Date.now() % 8) });
    const veneno = envenenarRelogio();
    try {
      expect(() => NoDoRelogio()).toThrow(/Date\.now/);
    } finally {
      veneno.restaurar();
    }
    expect(veneno.tocado).toStrictEqual(["Date.now"]);
  });
});

// ---------------------------------------------------------------------------
// 4. A JANELA DECLARADA — o no nao desenha fora dela
// ---------------------------------------------------------------------------

describe("a janela declarada no manifesto", () => {
  it("desenha no ultimo frame VISIVEL e some no primeiro frame de fora", () => {
    for (const no of [IMAGEM, VIDEO, GIF]) {
      const ultimo = no.duracao_frames - 1;
      expect(renderizar(no, ultimo).length).toBeGreaterThan(200);
      expect(renderizar(no, no.duracao_frames)).toBe("");
      expect(renderizar(no, no.duracao_frames + 60)).toBe("");
      expect(renderizar(no, -1)).toBe("");
    }
  });

  it("todo frame DENTRO da janela desenha alguma coisa", () => {
    for (const no of [IMAGEM, VIDEO, GIF]) {
      for (let frame = 0; frame < no.duracao_frames; frame++) {
        expect(
          violacoesDeConteudo(renderizar(no, frame), no),
          `${no.id} frame ${String(frame)}`,
        ).toStrictEqual([]);
      }
    }
  });

  it("duracao_frames invalida e RECUSA, nao quadro vazio", () => {
    for (const duracao of [0, -1, Number.NaN]) {
      const no = comCampos(GIF, { duracao_frames: duracao });
      expect(validarNoDeMidia(no).join("\n")).toContain("duracao_frames");
      expect(() => renderizar(no, 0)).toThrow(ErroDeMidia);
    }
  });

  it("o no ocupa a propria caixa e nao sai dela", () => {
    // `cover`/`fill` cobrem o quadro; `contain`/`none` deixam margem. Em
    // nenhum caso o inset e negativo — vazar sobre o irmao seria invisivel.
    const cover = renderizar(comCampos(GIF, { ajuste: "cover" }), 1);
    expect(cover).toContain("inset:0");
    const contain = renderizar(comCampos(GIF, { ajuste: "contain" }), 1);
    expect(contain).toMatch(/inset:(\d+)px/);
    const margem = Number(/inset:(\d+)px/.exec(contain)?.[1] ?? "0");
    expect(margem).toBeGreaterThan(0);
    expect(margem).toBeLessThan(Math.min(LARGURA, ALTURA) / 2);
    expect(contain).not.toContain("inset:-");
  });

  it("a entrada e a DECLARADA no manifesto, nao uma inventada", () => {
    // n-005 declara fade de 10 frames; n-006 declara "none".
    expect(IMAGEM.animacao?.tipo).toBe("fade");
    expect(renderizar(IMAGEM, 0)).toContain("opacity:0");
    expect(renderizar(IMAGEM, 10)).toContain("opacity:1");
    expect(VIDEO.animacao?.tipo).toBe("none");
    expect(renderizar(VIDEO, 0)).toContain("opacity:1");
    // O GIF nao declara animacao nenhuma: opaco desde o primeiro frame.
    expect(GIF.animacao).toBeUndefined();
    expect(renderizar(GIF, 0)).toContain("opacity:1");
  });
});

// ---------------------------------------------------------------------------
// 5. CONTRATO DE ALFA
// ---------------------------------------------------------------------------

describe("contrato de alfa — o no nao pinta fundo", () => {
  it("a raiz do no nao tem cor de fundo nenhuma", () => {
    for (const no of [IMAGEM, VIDEO, GIF]) {
      const html = renderizar(no, 1);
      const raiz = html.slice(0, html.indexOf("><") + 1);
      expect(raiz).toContain(`data-no="${no.id}"`);
      expect(raiz).not.toContain("background");
      expect(html).toContain('data-alfa="preservado"');
    }
  });

  it("nada de filtro, mistura ou imagem de fundo que achate o alfa", () => {
    for (const no of [IMAGEM, VIDEO, GIF]) {
      const html = renderizar(no, 1);
      for (const proibido of [
        "background-image",
        "mask-image",
        "mix-blend-mode",
        "filter:",
        "backdrop-filter",
        "animation:",
        "transition:",
      ]) {
        expect(html, `${no.id}: ${proibido}`).not.toContain(proibido);
      }
    }
  });

  it("ajuste -> object-fit e mapa TOTAL, com default explicito", () => {
    expect(ajusteParaObjectFit("cover")).toBe("cover");
    expect(ajusteParaObjectFit("contain")).toBe("contain");
    expect(ajusteParaObjectFit("fill")).toBe("fill");
    expect(ajusteParaObjectFit("none")).toBe("none");
    expect(ajusteParaObjectFit(undefined)).toBe("contain");
    expect(renderizar(IMAGEM, 1)).toContain('data-ajuste="cover"');
    expect(renderizar(VIDEO, 1)).toContain('data-ajuste="contain"');
  });

  it("o still aprovado tem pixel opaco E pixel transparente (o alfa sobreviveu)", () => {
    for (const caso of CASOS_DE_STILL) {
      const caminho = resolve(APROVADOS, caso.arquivo);
      expect(existsSync(caminho), `${caso.arquivo} ausente`).toBe(true);
      const analise = analisarPng(caminho);
      expect(violacoesDeQuadro(analise), caso.arquivo).toStrictEqual([]);
      expect(analise.opacos).toBeGreaterThan(0);
      expect(analise.transparentes).toBeGreaterThan(analise.opacos);
    }
  });

  it("sonda negativa: quadro vazio e quadro chapado REPROVAM no contador (C1)", () => {
    // O contador e o MESMO do gate — um contador de teste seria outra verdade.
    const pixels = 64;
    const vazio = Buffer.alloc(pixels * 4, 0);
    expect(violacoesDeQuadro(analisarRgba(vazio)).join("\n")).toContain("quadro vazio");
    const chapado = Buffer.alloc(pixels * 4, 255);
    const violacoesChapado = violacoesDeQuadro(analisarRgba(chapado)).join("\n");
    expect(violacoesChapado).toContain("alfa destruido");
    expect(violacoesChapado).toContain("chapado");
  });
});

// ---------------------------------------------------------------------------
// 6. QUADRO VAZIO — a pergunta 1 do card
// ---------------------------------------------------------------------------

describe("o smoke NAO passa com quadro vazio (C1)", () => {
  it("o componente de verdade passa nas assercoes de conteudo", () => {
    for (const no of [IMAGEM, VIDEO, GIF]) {
      expect(violacoesDeConteudo(renderizar(no, 20), no)).toStrictEqual([]);
    }
  });

  it("um componente que devolve null REPROVA nas mesmas assercoes", () => {
    const html = renderToStaticMarkup(createElement(() => null));
    expect(violacoesDeConteudo(html, GIF).length).toBeGreaterThan(0);
    expect(violacoesDeConteudo(html, GIF)[0]).toContain("vazia");
  });

  it("um componente que devolve <div/> vazia tambem REPROVA", () => {
    const html = renderToStaticMarkup(
      createElement("div", { style: { position: "absolute", inset: 0 } }),
    );
    expect(violacoesDeConteudo(html, GIF).length).toBeGreaterThan(0);
  });

  it("um componente que desenha SEM o hash reprova (o endereco tem de aparecer)", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        { "data-no": GIF.id, "data-tipo": "midia" },
        "conteudo bonito e comprido o bastante para passar do piso de tamanho ".repeat(4),
      ),
    );
    expect(violacoesDeConteudo(html, GIF).join("\n")).toContain("prefixo do hash");
  });
});

// ---------------------------------------------------------------------------
// 7. LITERAIS DE TOKEN — a pergunta 3 do card
// ---------------------------------------------------------------------------

describe("nenhum literal de token redeclarado", () => {
  const FONTE = readFileSync(
    resolve(RAIZ, "src", "composicao", "nos", "midia.tsx"),
    "utf-8",
  );

  it("o arquivo do componente nao tem cor hex escrita a mao", () => {
    const linhas = FONTE.split("\n").filter(
      (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"),
    );
    const comHex = linhas.filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l));
    expect(comHex.join("\n")).toBe("");
  });

  it("as cores que saem no render SAO as dos tokens, por identidade", () => {
    const html = renderizar(GIF, 1);
    expect(html).toContain(`border-color:${highlight.primary}`);
    expect(html).toContain(`color:${highlight.primary}`);
    expect(html).toContain(`color:${corDeTexto.secondary}`);
    expect(html).toContain(`background-color:${highlight.accent}`);
  });
});

// ---------------------------------------------------------------------------
// 8. SNAPSHOT APROVADO
// ---------------------------------------------------------------------------

describe("marcacao aprovada", () => {
  it("ha casos de snapshot — seletor vazio seria falso verde (C2)", () => {
    expect(CASOS_DE_MARCACAO.length).toBeGreaterThan(0);
    expect(CASOS_DE_STILL.length).toBeGreaterThan(0);
    expect(CASOS_DE_STILL.filter((c) => c.arquivo.includes("gif")).length)
      .toBeGreaterThanOrEqual(2);
  });

  for (const caso of CASOS_DE_MARCACAO) {
    it(`${caso.arquivo}: identico ao aprovado (${caso.porque})`, () => {
      const caminho = resolve(APROVADOS, caso.arquivo);
      expect(
        existsSync(caminho),
        `${caso.arquivo} AUSENTE — snapshot que sumiu e vermelho, nunca "nada a comparar"`,
      ).toBe(true);
      expect(marcacaoDoCaso(caso)).toBe(readFileSync(caminho, "utf-8"));
    });
  }

  it("render 2x da marcacao: bytes identicos em todos os casos", () => {
    for (const caso of CASOS_DE_MARCACAO) {
      expect(marcacaoDoCaso(caso)).toBe(marcacaoDoCaso(caso));
    }
  });
});
