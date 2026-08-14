// =============================================================================
// no-codigo — o no de codigo desenha tokens JA COMPUTADOS e recusa improvisar
// =============================================================================
// Card: F1-08 (onda W4)
//
// O que este arquivo cobra, em ordem de importancia:
//
//   1. RECUSA. Codigo cru sem tokens nao vira destaque adivinhado. Nem no
//      markup (zero data-papel), nem no fonte (zero tabela de palavra-chave,
//      zero import de destacador — busca tambem no texto normalizado, C11).
//   2. RECUSA DURA. Um destaque que discorda do codigo do no (linha a mais,
//      texto que nao reconstroi a fonte, papel desconhecido, outro formato)
//      derruba o render em vez de exibir codigo que nao e o do manifesto.
//   3. QUADRO NAO-VAZIO. As assercoes de desenho estao em conferirDesenho(),
//      e o teste prova que ela sabe REPROVAR um quadro vazio (C1/C2).
//   4. JANELA. O componente nao desenha fora da propria duracao declarada.
//   5. COR DE TOKEN. Toda cor sai de src/design/tokens.ts (Regra 2).
//
// Sem JSX: vitest.config.ts so coleta tests/**/*.test.ts.
// =============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Codigo, {
  CORES_DA_MOLDURA,
  COR_POR_PAPEL,
  COR_SEM_DESTAQUE,
  ErroDeDestaque,
  FORMATO_DE_DESTAQUE,
  PAPEIS_DE_TOKEN,
  PAPEIS_DISTINTIVOS,
  conferirDestaque,
  lerDestaque,
  meta as metaDoNo,
  type DestaqueDeCodigo,
} from "src/composicao/nos/codigo";
import { descobrirNos, DIRETORIO_DE_NOS } from "src/composicao/descoberta";
import { SCHEMA_POR_TIPO } from "src/composicao/contrato-de-no";
import { highlight, state, text as corDeTexto } from "src/design/tokens";
import type { NoCodigo } from "src/contratos/manifesto";

import {
  CODIGO_CRU,
  DESTAQUE,
  DURACAO_FRAMES,
  FRAME_DO_STILL,
  NO_COM_DESTAQUE,
  NO_SEM_DESTAQUE,
  type NoCodigoHidratado,
} from "../../fixtures/snapshots/no-codigo/no-de-teste";

// NOTA: `import.meta.url` no MESMO arquivo que importa react-dom/server faz o
// transform SSR do vite estourar ("Cannot split a chunk that has already been
// edited"). `import.meta.dirname` passa — e e o que tests/harness ja usa.
const AQUI: string = import.meta.dirname;
const FONTE_DO_COMPONENTE = resolve(
  AQUI,
  "..",
  "..",
  "src",
  "composicao",
  "nos",
  "codigo.tsx",
);

const FPS = 30;
const LARGURA = 1920;
const ALTURA = 1080;

function desenhar(no: NoCodigoHidratado, frame: number): string {
  return renderToStaticMarkup(
    createElement(Codigo, { no, frame, fps: FPS, width: LARGURA, height: ALTURA }),
  );
}

function clonarDestaque(): DestaqueDeCodigo {
  return JSON.parse(JSON.stringify(DESTAQUE)) as DestaqueDeCodigo;
}

function comDestaque(destaque: unknown): NoCodigoHidratado {
  return { ...NO_COM_DESTAQUE, destaque_sintaxe: destaque as DestaqueDeCodigo };
}

/** Texto visivel do markup, sem tags e com as entidades que usamos desfeitas. */
function textoVisivel(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function papeisNoMarkup(html: string): string[] {
  return [...html.matchAll(/data-papel="([^"]+)"/g)].map((m) => m[1] ?? "");
}

// ---------------------------------------------------------------------------
// O oraculo de desenho — e a prova de que ele sabe reprovar
// ---------------------------------------------------------------------------
// C1: "exit 0 de um render nao prova que saiu imagem". No nivel de markup o
// equivalente e: renderizou sem estourar nao prova que desenhou o codigo.

function conferirDesenho(html: string, no: NoCodigo): string[] {
  const problemas: string[] = [];
  const visivel = textoVisivel(html);

  if (!html.includes(`data-no="${no.id}"`)) {
    problemas.push("o markup nao identifica o no (data-no)");
  }
  if (!html.includes('data-parte="bloco"')) {
    problemas.push("nao ha bloco de codigo no markup");
  }
  const linhasCruas = no.codigo.split("\n");
  const linhasNoMarkup = [...html.matchAll(/data-linha="(\d+)"/g)].length;
  if (linhasNoMarkup !== linhasCruas.length) {
    problemas.push(
      `o markup tem ${String(linhasNoMarkup)} linha(s) e o codigo tem ` +
        `${String(linhasCruas.length)}`,
    );
  }
  for (const crua of linhasCruas) {
    if (crua.trim() === "") continue;
    if (!visivel.includes(crua)) {
      problemas.push(`a linha ${JSON.stringify(crua)} nao aparece no texto visivel`);
    }
  }
  if (visivel.replace(/\s/g, "").length < no.codigo.replace(/\s/g, "").length) {
    problemas.push("o texto visivel tem menos caracteres que o codigo do no");
  }
  return problemas;
}

describe("o oraculo de desenho sabe reprovar (C1/C2)", () => {
  it("reprova quadro vazio", () => {
    expect(conferirDesenho("", NO_COM_DESTAQUE).length).toBeGreaterThan(0);
    expect(conferirDesenho("<div></div>", NO_COM_DESTAQUE).length).toBeGreaterThan(0);
  });

  it("reprova quadro com a moldura certa e nenhum codigo dentro", () => {
    const soMoldura =
      `<div data-no="${NO_COM_DESTAQUE.id}"><pre data-parte="bloco"></pre></div>`;
    const problemas = conferirDesenho(soMoldura, NO_COM_DESTAQUE);
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.join("\n")).toContain("linha");
  });

  it("aprova o quadro de verdade", () => {
    expect(conferirDesenho(desenhar(NO_COM_DESTAQUE, FRAME_DO_STILL), NO_COM_DESTAQUE))
      .toStrictEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Metadados — assercao sobre o MEU item, nunca sobre a lista completa
// ---------------------------------------------------------------------------

describe("meta do no de codigo", () => {
  it("declara tipo, schema e id — os tres preservados do stub de F1-01", () => {
    expect(metaDoNo.tipo).toBe("codigo");
    expect(metaDoNo.schema).toBe("Codigo.1");
    expect(metaDoNo.id).toBe("no-codigo");
    expect(metaDoNo.schema).toBe(SCHEMA_POR_TIPO.codigo);
  });

  it("a descoberta do disco acha O MEU tipo com O MEU id", async () => {
    // Pergunta obrigatoria da onda: nada aqui asserta a lista fechada de nos.
    // Sete irmaos escrevem no mesmo diretorio nesta onda; a unica coisa que
    // este card pode afirmar sem mentir depois do merge e a presenca do seu.
    const catalogo = await descobrirNos(DIRETORIO_DE_NOS);
    const meu = catalogo.porTipo.get("codigo");
    expect(meu, "o tipo codigo sumiu da descoberta").toBeDefined();
    expect(meu?.meta.id).toBe(metaDoNo.id);
    expect(catalogo.porId.get(metaDoNo.id)?.meta.tipo).toBe("codigo");
  });
});

// ---------------------------------------------------------------------------
// (1) A recusa de improvisar — a pergunta especifica do card
// ---------------------------------------------------------------------------

describe("codigo cru sem tokens: o componente NAO destaca", () => {
  const html = desenhar(NO_SEM_DESTAQUE, FRAME_DO_STILL);

  it("marca o estado no markup em vez de fingir que destacou", () => {
    expect(html).toContain('data-destaque="ausente"');
    expect(html).not.toContain('data-destaque="pre-computado"');
  });

  it("nao emite NENHUM token: zero data-papel", () => {
    expect(papeisNoMarkup(html)).toStrictEqual([]);
  });

  it("nenhuma cor de papel distintiva aparece no markup", () => {
    for (const papel of PAPEIS_DISTINTIVOS) {
      expect(html, `cor do papel ${papel} vazou no render sem destaque`).not.toContain(
        COR_POR_PAPEL[papel],
      );
    }
  });

  it("mesmo recusando, desenha o codigo — recusa nao e quadro vazio", () => {
    expect(conferirDesenho(html, NO_SEM_DESTAQUE)).toStrictEqual([]);
    expect(html).toContain(COR_SEM_DESTAQUE);
  });

  it("lerDestaque devolve ausente, sem estourar e sem inventar linhas", () => {
    const leitura = lerDestaque(NO_SEM_DESTAQUE);
    expect(leitura.estado).toBe("ausente");
    expect(leitura.destaque).toBeNull();
  });
});

describe("o fonte do componente nao contem destacador nenhum (C11)", () => {
  const fonte = readFileSync(FONTE_DO_COMPONENTE, "utf-8");
  // Texto normalizado: sem acento de espaco, sem quebra de linha, minusculo.
  // Uma busca so no texto cru nao e prova de ausencia em codigo gerado.
  const normalizado = fonte.toLowerCase().replace(/\s+/g, " ");

  it("nao importa nenhum destacador de sintaxe", () => {
    for (const pacote of [
      "shiki",
      "prismjs",
      "prism-react-renderer",
      "highlight.js",
      "hljs",
      "twoslash",
      "codemirror",
      "monaco",
      "@remotion/animated-emoji",
    ]) {
      expect(normalizado, `import de destacador: ${pacote}`).not.toContain(
        `from "${pacote}`,
      );
      expect(normalizado, `require de destacador: ${pacote}`).not.toContain(
        `require("${pacote}`,
      );
    }
  });

  it("nao carrega tabela de palavras-chave de linguagem nenhuma", () => {
    // Um lexer improvisado sempre precisa de uma destas listas em algum lugar.
    for (const palavra of [
      '"function"',
      '"const"',
      '"return"',
      '"import"',
      '"export"',
      '"class"',
      '"typeof"',
    ]) {
      expect(normalizado, `tabela de palavra-chave no fonte: ${palavra}`).not.toContain(
        palavra,
      );
    }
  });

  it("nao roda regex sobre o codigo do no", () => {
    // O componente le `codigo.codigo` uma unica vez, para split("\n")
    // (onda 2: a leitura unica agora alimenta tambem a caixa da sonda).
    const usos = [...fonte.matchAll(/codigo\.codigo/g)].length;
    expect(usos).toBe(1);
    expect(fonte).toContain('codigoCru.split("\\n")');
    for (const suspeito of [".match(", ".matchAll(", ".replace(", "RegExp("]) {
      expect(fonte, `manipulacao de texto do codigo: ${suspeito}`).not.toContain(
        suspeito,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// (2) A recusa dura — destaque que discorda do codigo derruba o render
// ---------------------------------------------------------------------------

describe("destaque que discorda do codigo: RECUSA, nao desenha", () => {
  it("controle positivo: o destaque da fixture e aceito", () => {
    expect(conferirDestaque(CODIGO_CRU, DESTAQUE)).toStrictEqual([]);
    expect(() => desenhar(NO_COM_DESTAQUE, FRAME_DO_STILL)).not.toThrow();
  });

  it("formato de outra versao: RECUSA", () => {
    const d = clonarDestaque();
    (d as unknown as Record<string, unknown>)["formato"] = "DestaqueCodigo.2";
    expect(() => desenhar(comDestaque(d), FRAME_DO_STILL)).toThrow(ErroDeDestaque);
    expect(conferirDestaque(CODIGO_CRU, d).join("\n")).toContain("formato");
  });

  it("uma linha a mais que o codigo do no: RECUSA", () => {
    const d = clonarDestaque();
    d.linhas.push({ numero: d.linhas.length + 1, tokens: [] });
    expect(() => desenhar(comDestaque(d), FRAME_DO_STILL)).toThrow(/linha/);
  });

  it("tokens que NAO reconstroem a linha: RECUSA (um caractere basta)", () => {
    const d = clonarDestaque();
    const token = d.linhas[3]?.tokens[0];
    expect(token).toBeDefined();
    if (token !== undefined) {
      token.texto = token.texto.slice(1);
    }
    const erros = conferirDestaque(CODIGO_CRU, d);
    expect(erros.join("\n")).toContain("nao reconstroem");
    expect(() => desenhar(comDestaque(d), FRAME_DO_STILL)).toThrow(ErroDeDestaque);
  });

  it("papel desconhecido: RECUSA em vez de pintar de cor default", () => {
    const d = clonarDestaque();
    const linha = d.linhas[1];
    expect(linha).toBeDefined();
    if (linha?.tokens[0] !== undefined) {
      (linha.tokens[0] as unknown as Record<string, unknown>)["papel"] = "macro";
    }
    expect(() => desenhar(comDestaque(d), FRAME_DO_STILL)).toThrow(/macro/);
  });

  it("numeracao fora de ordem: RECUSA", () => {
    const d = clonarDestaque();
    const linha = d.linhas[2];
    if (linha !== undefined) {
      linha.numero = 99;
    }
    expect(() => desenhar(comDestaque(d), FRAME_DO_STILL)).toThrow(/fora de ordem/);
  });

  it("destacador sem procedencia: RECUSA", () => {
    const d = clonarDestaque();
    d.destacador = "";
    expect(() => desenhar(comDestaque(d), FRAME_DO_STILL)).toThrow(/destacador/);
  });

  it("destaque que nao e objeto: RECUSA", () => {
    expect(() => desenhar(comDestaque("<pre>codigo</pre>"), FRAME_DO_STILL)).toThrow(
      ErroDeDestaque,
    );
    expect(() => desenhar(comDestaque([]), FRAME_DO_STILL)).toThrow(ErroDeDestaque);
  });

  it("o erro nomeia o no e lista TODOS os problemas, nao so o primeiro", () => {
    const d = clonarDestaque();
    (d as unknown as Record<string, unknown>)["formato"] = "DestaqueCodigo.2";
    d.destacador = "";
    try {
      desenhar(comDestaque(d), FRAME_DO_STILL);
      expect.unreachable("o componente deveria ter recusado");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeDestaque);
      expect((erro as ErroDeDestaque).erros.length).toBeGreaterThanOrEqual(2);
      expect((erro as ErroDeDestaque).message).toContain(NO_COM_DESTAQUE.id);
    }
  });
});

// ---------------------------------------------------------------------------
// (3) O desenho dos tokens pre-computados
// ---------------------------------------------------------------------------

describe("destaque pre-computado: o componente so pinta", () => {
  const html = desenhar(NO_COM_DESTAQUE, FRAME_DO_STILL);

  it("marca a procedencia do artefato no markup", () => {
    expect(html).toContain('data-destaque="pre-computado"');
    expect(html).toContain(`data-destacador="${DESTAQUE.destacador}"`);
    expect(html).toContain(`data-linguagem="${NO_COM_DESTAQUE.linguagem}"`);
  });

  it("emite um span por token, na ordem, com o papel que veio pronto", () => {
    const esperados = DESTAQUE.linhas.flatMap((l) => l.tokens.map((t) => t.papel));
    expect(papeisNoMarkup(html)).toStrictEqual(esperados);
  });

  it("os OITO papeis do meu formato aparecem no meu still", () => {
    // Assercao sobre o MEU artefato: a fixture exercita a paleta inteira.
    const vistos = new Set(papeisNoMarkup(html));
    for (const papel of PAPEIS_DE_TOKEN) {
      expect(vistos.has(papel), `papel ${papel} nao foi exercitado`).toBe(true);
    }
  });

  it("o texto visivel reconstroi o codigo do no, linha a linha", () => {
    const visivel = textoVisivel(html);
    for (const linha of CODIGO_CRU.split("\n")) {
      if (linha.trim() === "") continue;
      expect(visivel).toContain(linha);
    }
  });

  it("as linhas de linhas_destaque sao as realcadas — e so elas", () => {
    const realcadas = [...html.matchAll(/data-linha="(\d+)" data-realcada="sim"/g)].map(
      (m) => Number(m[1]),
    );
    expect(realcadas).toStrictEqual(NO_COM_DESTAQUE.linhas_destaque);
  });
});

// ---------------------------------------------------------------------------
// (4) A janela declarada
// ---------------------------------------------------------------------------

describe("o componente respeita a propria duracao declarada", () => {
  it("desenha no primeiro e no ultimo frame da janela", () => {
    expect(desenhar(NO_COM_DESTAQUE, 0).length).toBeGreaterThan(0);
    expect(desenhar(NO_COM_DESTAQUE, DURACAO_FRAMES - 1)).toContain(
      `data-frame="${String(DURACAO_FRAMES - 1)}"`,
    );
  });

  it("nao desenha NADA um frame depois do fim", () => {
    expect(desenhar(NO_COM_DESTAQUE, DURACAO_FRAMES)).toBe("");
    expect(desenhar(NO_COM_DESTAQUE, DURACAO_FRAMES * 2)).toBe("");
  });

  it("nao desenha NADA antes do inicio", () => {
    expect(desenhar(NO_COM_DESTAQUE, -1)).toBe("");
  });

  it("a opacidade e clamp nos dois lados: nunca passa de 1 nem cai abaixo de 0", () => {
    // A armadilha do dominio: interpolate() extrapola por default. Um frame
    // alem da rampa devolveria opacidade > 1 sem os extrapolate explicitos.
    for (const frame of [0, 1, 9, 45, DURACAO_FRAMES - 1]) {
      const html = desenhar(NO_COM_DESTAQUE, frame);
      const achado = /opacity:([0-9.]+)/.exec(html);
      const opacidade = achado === null ? 1 : Number(achado[1]);
      expect(opacidade).toBeGreaterThanOrEqual(0);
      expect(opacidade).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// (5) Cor de token: nada de literal redeclarado (Regra 2)
// ---------------------------------------------------------------------------

describe("toda cor de destaque vem de src/design/tokens.ts", () => {
  it("cada papel aponta para o token que o nomeia", () => {
    expect(COR_POR_PAPEL.texto).toBe(corDeTexto.primary);
    expect(COR_POR_PAPEL["palavra-chave"]).toBe(highlight.secondary);
    expect(COR_POR_PAPEL.cadeia).toBe(state.success);
    expect(COR_POR_PAPEL.numero).toBe(highlight.accent);
    expect(COR_POR_PAPEL.comentario).toBe(corDeTexto.muted);
    expect(COR_POR_PAPEL.funcao).toBe(highlight.primary);
    expect(COR_POR_PAPEL.tipo).toBe(state.info);
    expect(COR_POR_PAPEL.operador).toBe(corDeTexto.secondary);
    expect(COR_SEM_DESTAQUE).toBe(corDeTexto.primary);
  });

  it("as cores distintivas nao sao usadas por nenhuma parte da moldura", () => {
    // Esta e a premissa do teste de pixel: se uma destas cinco cores aparece
    // no quadro, houve destaque. Se a moldura usasse uma delas, o quadro
    // "sem destaque" acusaria destaque que nao existe (falso positivo).
    for (const papel of PAPEIS_DISTINTIVOS) {
      expect(
        CORES_DA_MOLDURA,
        `a cor do papel ${papel} tambem e usada pela moldura`,
      ).not.toContain(COR_POR_PAPEL[papel]);
    }
    expect(PAPEIS_DISTINTIVOS.length).toBeGreaterThanOrEqual(5);
  });

  it("todo papel tem cor, e as oito cores sao distinguiveis entre si", () => {
    const cores = PAPEIS_DE_TOKEN.map((p) => COR_POR_PAPEL[p]);
    expect(cores.filter((c) => typeof c === "string" && c.length > 0).length).toBe(
      PAPEIS_DE_TOKEN.length,
    );
    expect(new Set(cores).size).toBe(PAPEIS_DE_TOKEN.length);
  });

  it("o fonte do componente nao declara nenhuma cor literal", () => {
    const fonte = readFileSync(FONTE_DO_COMPONENTE, "utf-8");
    const semComentario = fonte
      .split("\n")
      .filter((l) => !l.trimStart().startsWith("//"))
      .join("\n");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(semComentario)).toBe(false);
    expect(/rgba?\(/.test(semComentario)).toBe(false);
    expect(/hsla?\(/.test(semComentario)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// (6) Determinismo no nivel de markup
// ---------------------------------------------------------------------------

describe("determinismo: mesmo no, mesmo frame, mesmos bytes", () => {
  it("duas passadas produzem markup identico", () => {
    for (const frame of [0, 5, FRAME_DO_STILL, DURACAO_FRAMES - 1]) {
      expect(desenhar(NO_COM_DESTAQUE, frame)).toBe(desenhar(NO_COM_DESTAQUE, frame));
      expect(desenhar(NO_SEM_DESTAQUE, frame)).toBe(desenhar(NO_SEM_DESTAQUE, frame));
    }
  });

  it("a saida depende do frame, e so dele — ordem de chamada nao muda nada", () => {
    const direto = [0, 5, 40].map((f) => desenhar(NO_COM_DESTAQUE, f));
    const invertido = [40, 5, 0].map((f) => desenhar(NO_COM_DESTAQUE, f)).reverse();
    expect(direto).toStrictEqual(invertido);
  });

  it("o formato do artefato e versionado — mudar o desenho exige mudar a versao", () => {
    expect(FORMATO_DE_DESTAQUE).toBe("DestaqueCodigo.1");
    expect(DESTAQUE.formato).toBe(FORMATO_DE_DESTAQUE);
  });
});
