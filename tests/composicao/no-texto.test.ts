// =============================================================================
// no-texto — o no de texto prova OS DOIS caminhos: com timing e sem timing
// =============================================================================
// Card: F1-05 (onda W4)
//
// O ponto do card nao e "renderiza texto". E que o destaque palavra a palavra
// depende de um timing por palavra que vem do estagio de locucao (F2-03, card
// IRMAO desta onda, que ainda nao existe no disco) e que, quando esse timing
// nao existe, o componente DEGRADA para destaque por frase.
//
// Um teste que so exercitasse o caminho feliz deixaria a degradacao sem prova.
// Um teste que exercitasse a degradacao com uma fixture que POR ACIDENTE tem
// timing passaria sem tocar no codigo da degradacao. Por isso, aqui:
//
//   (1) as duas fixtures vivem no disco, lado a lado, e o teste CONFERE que
//       elas diferem exatamente por um campo — `timing_palavras`;
//   (2) o teste prova que a saida das duas e DIFERENTE;
//   (3) e prova a implicacao nos dois sentidos: tirar o timing da fixture com
//       timing produz, byte a byte, a saida da fixture sem timing, e por-lo na
//       fixture sem timing produz a saida da com timing.
//
// Sem JSX: vitest.config.ts so coleta `tests/**/*.test.ts`, entao os elementos
// sao criados com createElement.
// =============================================================================

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

// ATENCAO ao `meta as metaDoNo`: importar um binding chamado exatamente `meta`
// num arquivo que tambem usa `import.meta` derruba o transform SSR do vite com
// "Cannot split a chunk that has already been edited (…, \"import.meta\")". O
// reescritor de identificadores e o reescritor de `import.meta` disputam o
// mesmo trecho. O apelido resolve. Ledger: AB-322.
import Texto, {
  CAMPO_DE_TIMING,
  indiceAtivo,
  janelasEmFrames,
  lerTimingDePalavras,
  meta as metaDoNo,
  palavrasDoTexto,
  type PalavraLocutada,
} from "src/composicao/nos/texto";
import { REGISTRO_DE_NOS, tiposRegistrados } from "src/composicao/registro";
import type { No, NoTexto } from "src/contratos/manifesto";
import {
  background,
  breakpoints,
  highlight,
  msToFrames,
  text as corDeTexto,
} from "src/design/tokens";

import {
  FPS,
  FRAME_ALTERNATIVO,
  FRAME_ALVO,
} from "../../fixtures/snapshots/no-texto/composicoes";

// ---------------------------------------------------------------------------
// Fixtures do disco
// ---------------------------------------------------------------------------

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIR_FIXTURES = resolve(AQUI, "..", "..", "fixtures", "snapshots", "no-texto");

function lerFixture(nome: string): Record<string, unknown> {
  const bruto = readFileSync(resolve(DIR_FIXTURES, `${nome}.json`), "utf-8");
  return JSON.parse(bruto) as Record<string, unknown>;
}

const COM_TIMING = lerFixture("no-com-timing");
const SEM_TIMING = lerFixture("no-sem-timing");

const LARGURA = breakpoints.hd.width;
const ALTURA = breakpoints.hd.height;

/** As nove palavras da fixture, na ordem. */
const PALAVRAS = palavrasDoTexto(COM_TIMING["texto"] as string);

/** Duracao declarada do no — a janela que o componente tem de respeitar. */
const DURACAO = COM_TIMING["duracao_frames"] as number;

// ---------------------------------------------------------------------------
// Helpers de render e leitura do DOM
// ---------------------------------------------------------------------------

function comoNo(bruto: Record<string, unknown>): No {
  return bruto as unknown as No;
}

function renderizar(bruto: Record<string, unknown>, frame: number): string {
  return renderToStaticMarkup(
    createElement(Texto, {
      no: comoNo(bruto),
      frame,
      fps: FPS,
      width: LARGURA,
      height: ALTURA,
    }),
  );
}

function atributo(html: string, nome: string): string | null {
  const achado = new RegExp(`${nome}="([^"]*)"`).exec(html);
  return achado === null ? null : (achado[1] ?? null);
}

/** Estado declarado de cada unidade de realce, na ordem em que saiu no DOM. */
function estados(html: string): string[] {
  const re = /data-unidade="(\d+)"[^>]*?data-estado="([a-z]+)"/g;
  const achados: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    achados.push(m[2] as string);
  }
  return achados;
}

/** Copia rasa com um campo trocado ou removido. */
function comCampo(
  base: Record<string, unknown>,
  campo: string,
  valor: unknown,
): Record<string, unknown> {
  const copia: Record<string, unknown> = JSON.parse(JSON.stringify(base)) as Record<
    string,
    unknown
  >;
  if (valor === undefined) {
    delete copia[campo];
  } else {
    copia[campo] = valor;
  }
  return copia;
}

// ---------------------------------------------------------------------------
// (A) As fixtures — a pergunta 5 do card comeca aqui
// ---------------------------------------------------------------------------
//
// "O teste do caminho SEM timing realmente exercita a degradacao, ou passa por
//  acidente porque a fixture tem timing?"
//
// A unica forma de responder isso e assertar a fixture, nao so a saida.

describe("as duas fixtures diferem EXATAMENTE por um campo", () => {
  it("a fixture com timing declara timing por palavra, uma entrada por palavra", () => {
    const timing = COM_TIMING[CAMPO_DE_TIMING];
    expect(Array.isArray(timing)).toBe(true);
    expect((timing as unknown[]).length).toBe(PALAVRAS.length);
    expect(PALAVRAS.length).toBeGreaterThan(1);
  });

  it("a fixture sem timing NAO TEM a chave — nao e undefined, nao existe", () => {
    expect(Object.hasOwn(SEM_TIMING, CAMPO_DE_TIMING)).toBe(false);
    expect(Object.keys(SEM_TIMING)).not.toContain(CAMPO_DE_TIMING);
  });

  it("tirando o timing, as duas fixtures sao o MESMO no", () => {
    // Se divergissem em outra coisa (texto, duracao, alinhamento), o teste
    // diferencial abaixo estaria medindo essa outra coisa, e nao o timing.
    expect(comCampo(COM_TIMING, CAMPO_DE_TIMING, undefined)).toStrictEqual(SEM_TIMING);
  });

  it("cada entrada de timing casa a palavra correspondente do texto", () => {
    const timing = COM_TIMING[CAMPO_DE_TIMING] as PalavraLocutada[];
    expect(timing.map((p) => p.texto)).toStrictEqual(PALAVRAS);
  });
});

// ---------------------------------------------------------------------------
// (B) Caminho COM timing — destaque palavra a palavra
// ---------------------------------------------------------------------------

describe("caminho COM timing — destaque palavra a palavra", () => {
  const html = renderizar(COM_TIMING, FRAME_ALVO);

  it("declara o modo palavra e nenhuma degradacao", () => {
    expect(atributo(html, "data-destaque")).toBe("palavra");
    expect(atributo(html, "data-degradacao")).toBe("nenhuma");
  });

  it("uma unidade de realce por palavra", () => {
    expect(atributo(html, "data-unidades")).toBe(String(PALAVRAS.length));
    expect(estados(html).length).toBe(PALAVRAS.length);
  });

  it("no frame 45 a palavra ativa e a de indice 3 (\"carrega\")", () => {
    expect(atributo(html, "data-ativa")).toBe("3");
    expect(estados(html)).toStrictEqual([
      "falada",
      "falada",
      "falada",
      "ativa",
      "pendente",
      "pendente",
      "pendente",
      "pendente",
      "pendente",
    ]);
  });

  it("todas as palavras do texto aparecem, na ordem", () => {
    let posicao = -1;
    for (const palavra of PALAVRAS) {
      const proxima = html.indexOf(palavra, posicao + 1);
      expect(proxima, `palavra "${palavra}" ausente ou fora de ordem`).toBeGreaterThan(
        posicao,
      );
      posicao = proxima;
    }
  });

  it("a cor do realce e o TOKEN, nao uma copia com o mesmo valor", () => {
    // Pergunta 3 do card, cobrada em tempo de render: se alguem redeclarar o
    // hex aqui e o token mudar, este teste fica vermelho junto com design-varrer.
    expect(html).toContain(highlight.primary);
    expect(html).toContain(background.primary);
    expect(html).toContain(corDeTexto.primary);
    expect(html).toContain(corDeTexto.secondary);
  });
});

// ---------------------------------------------------------------------------
// (C) Caminho SEM timing — degradacao para frase
// ---------------------------------------------------------------------------

describe("caminho SEM timing — degradacao para destaque por frase", () => {
  const html = renderizar(SEM_TIMING, FRAME_ALVO);

  it("declara o modo frase e o MOTIVO da degradacao", () => {
    expect(atributo(html, "data-destaque")).toBe("frase");
    expect(atributo(html, "data-degradacao")).toBe("ausente");
  });

  it("a frase inteira e UMA unidade de realce", () => {
    expect(atributo(html, "data-unidades")).toBe("1");
    expect(estados(html)).toStrictEqual(["ativa"]);
  });

  it("o texto sai inteiro, sem quebra em palavras", () => {
    expect(html).toContain(SEM_TIMING["texto"] as string);
  });

  it("o realce por frase vem do campo `destaque` do manifesto", () => {
    const semDestaque = comCampo(SEM_TIMING, "destaque", false);
    const htmlSemDestaque = renderizar(semDestaque, FRAME_ALVO);
    expect(atributo(htmlSemDestaque, "data-destaque")).toBe("frase");
    expect(estados(htmlSemDestaque)).toStrictEqual(["pendente"]);
    expect(atributo(htmlSemDestaque, "data-ativa")).toBe("-1");
  });
});

// ---------------------------------------------------------------------------
// (D) Os dois caminhos sao DIFERENTES, e a diferenca e o timing
// ---------------------------------------------------------------------------

describe("os dois caminhos, um contra o outro", () => {
  it("mesma fixture, mesmo frame, saidas diferentes", () => {
    expect(renderizar(COM_TIMING, FRAME_ALVO)).not.toBe(
      renderizar(SEM_TIMING, FRAME_ALVO),
    );
  });

  it("tirar o timing da fixture COM timing produz a saida da SEM timing", () => {
    // Implicacao no sentido 1: o timing e SUFICIENTE para mudar o caminho.
    const mutante = comCampo(COM_TIMING, CAMPO_DE_TIMING, undefined);
    expect(renderizar(mutante, FRAME_ALVO)).toBe(renderizar(SEM_TIMING, FRAME_ALVO));
  });

  it("por o timing na fixture SEM timing produz a saida da COM timing", () => {
    // Implicacao no sentido 2: o timing e NECESSARIO — nada mais na fixture
    // esta escolhendo o caminho.
    const mutante = comCampo(
      SEM_TIMING,
      CAMPO_DE_TIMING,
      COM_TIMING[CAMPO_DE_TIMING],
    );
    expect(renderizar(mutante, FRAME_ALVO)).toBe(renderizar(COM_TIMING, FRAME_ALVO));
  });
});

// ---------------------------------------------------------------------------
// (E) O destaque ANDA — um componente que realca sempre a palavra 0 reprova
// ---------------------------------------------------------------------------

describe("o destaque avanca com o frame", () => {
  const inicios = (COM_TIMING[CAMPO_DE_TIMING] as PalavraLocutada[]).map((p) =>
    msToFrames(p.inicio_ms, FPS),
  );

  for (let i = 0; i < inicios.length; i++) {
    it(`no primeiro frame da palavra ${String(i)}, ela e a ativa`, () => {
      const html = renderizar(COM_TIMING, inicios[i] as number);
      expect(atributo(html, "data-ativa")).toBe(String(i));
    });
  }

  it("o conjunto de palavras ativas ao longo da janela tem todas as palavras", () => {
    const vistas = new Set<string>();
    for (let frame = 0; frame < DURACAO; frame++) {
      const ativa = atributo(renderizar(COM_TIMING, frame), "data-ativa");
      if (ativa !== null) vistas.add(ativa);
    }
    for (let i = 0; i < PALAVRAS.length; i++) {
      expect(vistas.has(String(i)), `palavra ${String(i)} nunca ficou ativa`).toBe(true);
    }
  });

  it("no vao entre duas palavras nao ha palavra ativa", () => {
    // frame 14: a palavra 0 terminou em 14 e a palavra 1 so comeca em 15.
    const html = renderizar(COM_TIMING, 14);
    expect(atributo(html, "data-ativa")).toBe("-1");
    expect(estados(html)[0]).toBe("falada");
    expect(estados(html)[1]).toBe("pendente");
  });

  it("depois da ultima palavra, todas ficam faladas e nenhuma ativa", () => {
    const html = renderizar(COM_TIMING, DURACAO - 1);
    expect(atributo(html, "data-ativa")).toBe("-1");
    expect(new Set(estados(html))).toStrictEqual(new Set(["falada"]));
  });

  it("no caminho SEM timing o realce NAO anda — e por frase, nao por palavra", () => {
    const inicial = atributo(renderizar(SEM_TIMING, 0), "data-ativa");
    for (const frame of [FRAME_ALTERNATIVO, FRAME_ALVO, DURACAO - 1]) {
      expect(atributo(renderizar(SEM_TIMING, frame), "data-ativa")).toBe(inicial);
    }
  });
});

// ---------------------------------------------------------------------------
// (F) Cada motivo de degradacao, um por um
// ---------------------------------------------------------------------------

describe("todo timing que nao casa o formato degrada, e diz por que", () => {
  const timingBom = COM_TIMING[CAMPO_DE_TIMING] as PalavraLocutada[];

  function comTiming(valor: unknown): Record<string, unknown> {
    return comCampo(COM_TIMING, CAMPO_DE_TIMING, valor);
  }

  const casos: { nome: string; timing: unknown; motivo: string }[] = [
    { nome: "campo ausente", timing: undefined, motivo: "ausente" },
    { nome: "campo nulo", timing: null, motivo: "ausente" },
    { nome: "nao e lista", timing: { palavras: timingBom }, motivo: "nao-lista" },
    { nome: "lista vazia", timing: [], motivo: "vazio" },
    {
      nome: "entrada sem texto",
      timing: timingBom.map((p, i) => (i === 2 ? { inicio_ms: p.inicio_ms, fim_ms: p.fim_ms } : p)),
      motivo: "malformado",
    },
    {
      nome: "texto vazio",
      timing: timingBom.map((p, i) => (i === 2 ? { ...p, texto: "   " } : p)),
      motivo: "malformado",
    },
    {
      nome: "inicio_ms nao numerico",
      timing: timingBom.map((p, i) => (i === 1 ? { ...p, inicio_ms: "500" } : p)),
      motivo: "malformado",
    },
    {
      nome: "fim_ms nao finito",
      timing: timingBom.map((p, i) => (i === 1 ? { ...p, fim_ms: Number.NaN } : p)),
      motivo: "malformado",
    },
    {
      nome: "fim antes do inicio",
      timing: timingBom.map((p, i) => (i === 4 ? { ...p, fim_ms: p.inicio_ms } : p)),
      motivo: "malformado",
    },
    {
      nome: "inicio negativo",
      timing: timingBom.map((p, i) => (i === 0 ? { ...p, inicio_ms: -1 } : p)),
      motivo: "malformado",
    },
    {
      nome: "palavras sobrepostas",
      timing: timingBom.map((p, i) => (i === 3 ? { ...p, inicio_ms: 0 } : p)),
      motivo: "fora-de-ordem",
    },
    {
      nome: "uma palavra a menos que o texto",
      timing: timingBom.slice(0, timingBom.length - 1),
      motivo: "desalinhado",
    },
    {
      nome: "uma palavra a mais que o texto",
      timing: [...timingBom, { texto: "sobra", inicio_ms: 9000, fim_ms: 9500 }],
      motivo: "desalinhado",
    },
  ];

  for (const caso of casos) {
    it(`${caso.nome} -> frase, motivo "${caso.motivo}"`, () => {
      const html = renderizar(comTiming(caso.timing), FRAME_ALVO);
      expect(atributo(html, "data-destaque")).toBe("frase");
      expect(atributo(html, "data-degradacao")).toBe(caso.motivo);
      expect(atributo(html, "data-unidades")).toBe("1");
    });
  }

  it("controle positivo: o timing bom NAO degrada", () => {
    const html = renderizar(comTiming(timingBom), FRAME_ALVO);
    expect(atributo(html, "data-destaque")).toBe("palavra");
    expect(atributo(html, "data-degradacao")).toBe("nenhuma");
  });
});

// ---------------------------------------------------------------------------
// (G) A janela declarada — pergunta 4 do card
// ---------------------------------------------------------------------------

describe("o componente respeita a propria janela", () => {
  for (const fixture of [
    { nome: "com timing", dados: COM_TIMING },
    { nome: "sem timing", dados: SEM_TIMING },
  ]) {
    it(`${fixture.nome}: desenha no ultimo frame da janela`, () => {
      expect(renderizar(fixture.dados, DURACAO - 1)).not.toBe("");
    });

    it(`${fixture.nome}: NAO desenha no primeiro frame depois da janela`, () => {
      expect(renderizar(fixture.dados, DURACAO)).toBe("");
      expect(renderizar(fixture.dados, DURACAO + 10)).toBe("");
    });

    it(`${fixture.nome}: NAO desenha antes do proprio frame 0`, () => {
      expect(renderizar(fixture.dados, -1)).toBe("");
    });
  }

  it("duracao invalida nao vira quadro: zero e negativo nao desenham", () => {
    expect(renderizar(comCampo(COM_TIMING, "duracao_frames", 0), 0)).toBe("");
    expect(renderizar(comCampo(COM_TIMING, "duracao_frames", -5), 0)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// (H) O oraculo sabe reprovar — pergunta 1 do card
// ---------------------------------------------------------------------------
//
// "O smoke passaria com o componente devolvendo um quadro vazio?"
// A resposta so vale se o proprio criterio for testado contra um componente
// vazio. Abaixo, o criterio e uma FUNCAO, e ela roda nos dois.

/** O que um render do no de texto tem de ter. Vazio = sem violacao. */
function violacoesDeConteudo(html: string): string[] {
  const violacoes: string[] = [];
  if (html.trim().length === 0) violacoes.push("html vazio");
  if (!html.includes(`data-tipo="${metaDoNo.tipo}"`)) violacoes.push("sem data-tipo");
  for (const palavra of PALAVRAS) {
    if (!html.includes(palavra)) violacoes.push(`sem a palavra "${palavra}"`);
  }
  if (html.length < 200) violacoes.push("html curto demais");
  return violacoes;
}

const ComponenteVazio: FC = () => null;

describe("sonda negativa: o criterio de conteudo reprova um quadro vazio", () => {
  it("o componente de verdade nao tem violacao", () => {
    expect(violacoesDeConteudo(renderizar(COM_TIMING, FRAME_ALVO))).toStrictEqual([]);
    expect(violacoesDeConteudo(renderizar(SEM_TIMING, FRAME_ALVO))).toStrictEqual([]);
  });

  it("um componente que devolve null acusa varias violacoes", () => {
    const vazio = renderToStaticMarkup(createElement(ComponenteVazio));
    expect(vazio).toBe("");
    expect(violacoesDeConteudo(vazio).length).toBeGreaterThan(PALAVRAS.length);
  });

  it("um html que so tem a caixa, sem texto, tambem reprova", () => {
    const soCaixa = '<div data-no="x" data-tipo="texto" data-frame="0"></div>';
    expect(violacoesDeConteudo(soCaixa).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// (I) Determinismo no nivel do HTML — pergunta 2 do card
// ---------------------------------------------------------------------------

describe("render duas vezes, mesma saida", () => {
  it("o mesmo frame produz a mesma string, nos dois caminhos", () => {
    for (const frame of [0, FRAME_ALTERNATIVO, FRAME_ALVO, DURACAO - 1]) {
      expect(renderizar(COM_TIMING, frame)).toBe(renderizar(COM_TIMING, frame));
      expect(renderizar(SEM_TIMING, frame)).toBe(renderizar(SEM_TIMING, frame));
    }
  });

  it("a saida nao carrega nada que mude entre execucoes", () => {
    const html = renderizar(COM_TIMING, FRAME_ALVO);
    expect(html).not.toMatch(/\d{13}/); // carimbo de tempo em ms
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("undefined");
  });
});

// ---------------------------------------------------------------------------
// (J) A pergunta obrigatoria da onda — presenca do MEU item, nunca a lista
// ---------------------------------------------------------------------------
//
// "Existe alguma assercao neste diff sobre a LISTA COMPLETA de alguma coisa?"
// Nao. As assercoes abaixo sao sobre a PRESENCA de "texto"/"no-texto". Um irmao
// que acrescente o proprio no ao registro nao derruba nada disto.

describe("o no de texto continua descoberto e registrado (presenca, nao lista)", () => {
  it("meta preserva tipo, schema e id — a descoberta depende deles", () => {
    expect(metaDoNo.tipo).toBe("texto");
    expect(metaDoNo.schema).toBe("Texto.1");
    expect(metaDoNo.id).toBe("no-texto");
    expect(metaDoNo.descricao.trim().length).toBeGreaterThan(0);
  });

  it("o tipo \"texto\" esta entre os registrados", () => {
    expect(tiposRegistrados()).toContain("texto");
  });

  it("o registro aponta para ESTE componente", () => {
    const entrada = REGISTRO_DE_NOS.get("texto");
    expect(entrada).toBeDefined();
    expect(entrada?.meta.id).toBe("no-texto");
    expect(entrada?.componente).toBe(Texto);
  });
});

// ---------------------------------------------------------------------------
// (K) As funcoes puras, isoladas
// ---------------------------------------------------------------------------

describe("palavrasDoTexto", () => {
  it("separa por qualquer espaco em branco e ignora as bordas", () => {
    expect(palavrasDoTexto("  um   dois\ttres\nquatro ")).toStrictEqual([
      "um",
      "dois",
      "tres",
      "quatro",
    ]);
  });

  it("texto vazio ou so espacos da lista vazia, nunca [\"\"]", () => {
    expect(palavrasDoTexto("")).toStrictEqual([]);
    expect(palavrasDoTexto("   \n ")).toStrictEqual([]);
  });
});

describe("janelasEmFrames e indiceAtivo", () => {
  const timing = COM_TIMING[CAMPO_DE_TIMING] as PalavraLocutada[];

  it("a conversao ms -> frames passa por msToFrames, sem arredondar duas vezes", () => {
    const janelas = janelasEmFrames(timing, FPS);
    expect(janelas.map((j) => j.inicio)).toStrictEqual(
      timing.map((p) => msToFrames(p.inicio_ms, FPS)),
    );
    expect(janelas.map((j) => j.fim)).toStrictEqual(
      timing.map((p) => msToFrames(p.fim_ms, FPS)),
    );
  });

  it("ativa e [inicio, fim): o primeiro frame conta, o ultimo nao", () => {
    const janelas = janelasEmFrames(timing, FPS);
    const primeira = janelas[0] as { inicio: number; fim: number };
    expect(indiceAtivo(janelas, primeira.inicio)).toBe(0);
    expect(indiceAtivo(janelas, primeira.fim - 1)).toBe(0);
    expect(indiceAtivo(janelas, primeira.fim)).toBe(-1);
  });

  it("lista vazia nunca tem palavra ativa", () => {
    expect(indiceAtivo([], 0)).toBe(-1);
  });
});

describe("lerTimingDePalavras devolve o motivo, nao so um booleano", () => {
  function comoTexto(timing: unknown): NoTexto {
    return comCampo(COM_TIMING, CAMPO_DE_TIMING, timing) as unknown as NoTexto;
  }

  it("timing bom: lista normalizada e motivo \"nenhuma\"", () => {
    const leitura = lerTimingDePalavras(
      comoTexto(COM_TIMING[CAMPO_DE_TIMING]),
      PALAVRAS.length,
    );
    expect(leitura.motivo).toBe("nenhuma");
    expect(leitura.palavras?.length).toBe(PALAVRAS.length);
  });

  it("quando recusa, devolve palavras nulas — nunca uma lista pela metade", () => {
    const leitura = lerTimingDePalavras(comoTexto([{ texto: "x" }]), PALAVRAS.length);
    expect(leitura.palavras).toBeNull();
    expect(leitura.motivo).toBe("malformado");
  });
});
