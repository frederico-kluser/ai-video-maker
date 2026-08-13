// =============================================================================
// no-cabecalho — o oraculo do card F1-04
// =============================================================================
// Este arquivo nao verifica "se renderiza". Ele cobra as quatro coisas que
// fariam o card ser teatro:
//
//   1. A MOLA VEM DO TOKEN. Nao basta importar `springPresets` e ignorar:
//      o teste mede a mola resultante e exige que ela pouse no tempo que o
//      token declara, com o zeta que o token declara, em 30 e em 60 fps.
//      E varre o proprio arquivo atras de numero de mola escrito a mao —
//      com sonda negativa, porque um varredor que so sabe dizer "achei nada"
//      nao e varredor (C2).
//
//   2. O SMOKE NAO PASSA COM QUADRO VAZIO. As mesmas assercoes do caminho
//      feliz sao rodadas contra um render vazio de verdade (o componente
//      fora da propria janela) e TEM de reprovar.
//
//   3. A JANELA DECLARADA MANDA. Fora de [0, duracao_frames) o componente
//      nao desenha nada.
//
//   4. PRESENCA, NAO LISTA FECHADA. A assercao de descoberta e sobre o
//      cabecalho estar la — nunca sobre quem mais esta ou deixa de estar
//      (docs/contrato-w4.md §5).
//
// Sem JSX: o vitest so coleta `tests/**/*.test.ts`, entao os elementos sao
// criados com React.createElement.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Cabecalho, {
  MASSA_DE_REFERENCIA,
  NOME_DA_MOLA_DO_SUBTITULO,
  NOME_DA_MOLA_PADRAO,
  NOME_DA_MOLA_POR_ANIMACAO,
  atrasoDoSubtitulo,
  configDaMola,
  duracaoDaMola,
  janelaDeSaida,
  meta as metaDoCabecalho,
  molaDoNo,
  molaEm,
  presetObrigatorio,
} from "src/composicao/nos/cabecalho";
import { descobrirNos } from "src/composicao/descoberta";
import { REGISTRO_DE_NOS } from "src/composicao/registro";
import { SCHEMA_POR_TIPO, isTipoDeNo } from "src/composicao/contrato-de-no";
import type { AnimacaoTipo, NoCabecalho } from "src/contratos/manifesto";
import {
  msToFrames,
  springDurationRestThreshold,
  springPresets,
  transitionDuration,
} from "src/design/tokens";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const FONTE = resolve(RAIZ, "src", "composicao", "nos", "cabecalho.tsx");
const DIR_SNAPSHOT = resolve(RAIZ, "fixtures", "snapshots", "no-cabecalho");
const APROVADOS = resolve(DIR_SNAPSHOT, "aprovados");

const FPS = 30;
const LARGURA = 1920;
const ALTURA = 1080;
const DURACAO = 90;

const TITULO = "Editor de Video IA";
const SUBTITULO = "Da ideia ao frame final, sem edicao manual";

function noDeTeste(extra: Partial<NoCabecalho> = {}): NoCabecalho {
  return {
    id: "n-teste-cabecalho",
    schema: "Cabecalho.1",
    type: "cabecalho",
    duracao_frames: DURACAO,
    texto: TITULO,
    subtitulo: SUBTITULO,
    alinhamento: "centro",
    animacao: { tipo: "spring" },
    ...extra,
  };
}

function renderizar(no: NoCabecalho, frame: number): string {
  return renderToStaticMarkup(
    createElement(Cabecalho, { no, frame, fps: FPS, width: LARGURA, height: ALTURA }),
  );
}

/** As assercoes que o smoke faz. Devolve a lista do que FALHOU. */
function reprovacoesDoSmoke(html: string): string[] {
  const falhas: string[] = [];
  if (html.length === 0) falhas.push("html vazio");
  if (!html.includes(TITULO)) falhas.push("sem o titulo");
  if (!html.includes(SUBTITULO)) falhas.push("sem o subtitulo");
  if (!html.includes(`data-no="n-teste-cabecalho"`)) falhas.push("sem data-no");
  return falhas;
}

// ---------------------------------------------------------------------------
// 1. Metadados — a fiacao de F1-01 nao pode ter sido quebrada
// ---------------------------------------------------------------------------

describe("meta — preservado como F1-01 escreveu", () => {
  it("tipo, schema e id sao exatamente os do stub", () => {
    expect(metaDoCabecalho.tipo).toBe("cabecalho");
    expect(metaDoCabecalho.schema).toBe("Cabecalho.1");
    expect(metaDoCabecalho.id).toBe("no-cabecalho");
    expect(metaDoCabecalho.descricao.trim().length).toBeGreaterThan(0);
  });

  it("o schema declarado casa com o do contrato, sem copia local", () => {
    expect(isTipoDeNo(metaDoCabecalho.tipo)).toBe(true);
    expect(metaDoCabecalho.schema).toBe(SCHEMA_POR_TIPO["cabecalho"]);
  });

  it("PRESENCA do meu no na descoberta — nunca a lista fechada (contrato-w4 §5)", async () => {
    const catalogo = await descobrirNos();
    const meu = catalogo.porTipo.get("cabecalho");
    expect(meu, "o tipo cabecalho sumiu da descoberta").toBeDefined();
    expect(meu!.meta).toStrictEqual(metaDoCabecalho);
    expect(catalogo.porId.get("no-cabecalho")).toBeDefined();
  });

  it("PRESENCA do meu no no registro — idem", () => {
    const entrada = REGISTRO_DE_NOS.get("cabecalho");
    expect(entrada).toBeDefined();
    expect(entrada!.meta).toStrictEqual(metaDoCabecalho);
    expect(entrada!.componente).toBe(Cabecalho);
  });
});

// ---------------------------------------------------------------------------
// 2. A mola vem do token — e o teste mede, nao acredita
// ---------------------------------------------------------------------------

const NOMES_DE_PRESET = Object.keys(springPresets).sort();

describe("a mola sai de springPresets, com zeta e tempo do token", () => {
  it("ha presets para medir — seletor vazio seria falso verde (C2)", () => {
    expect(NOMES_DE_PRESET.length).toBeGreaterThan(0);
  });

  for (const nome of NOMES_DE_PRESET) {
    const preset = springPresets[nome]!;

    it(`${nome}: zeta do round-trip e exatamente o do token`, () => {
      const config = configDaMola(preset);
      const zeta = config.damping / (2 * Math.sqrt(config.stiffness * config.mass));
      expect(zeta).toBeCloseTo(preset.zeta, 12);
    });

    for (const fps of [30, 60]) {
      it(`${nome} @ ${String(fps)}fps: acomoda no frame que settlingTimeSeconds manda`, () => {
        const d = duracaoDaMola(preset, fps);
        expect(d).toBe(Math.round(preset.settlingTimeSeconds * fps));

        // No frame de acomodacao ja esta dentro do threshold do token...
        expect(Math.abs(molaEm(d, fps, preset) - 1)).toBeLessThanOrEqual(
          springDurationRestThreshold,
        );
        // ...e depois dele nao se mexe mais.
        expect(molaEm(d + 1, fps, preset)).toBe(1);
        // Antes, ainda nao chegou: uma mola que ja nascesse pronta passaria
        // em tudo acima sem animar nada.
        expect(molaEm(0, fps, preset)).toBe(0);
        // A um quarto do tempo declarado a mola AINDA esta longe do repouso.
        // (Nao vale exigir `< 1`: com zeta < 1 ela passa de 1 no repique, que
        // e exatamente o que o preset overshoot compra.)
        const quarto = Math.max(1, Math.floor(d / 4));
        expect(molaEm(quarto, fps, preset)).toBeGreaterThan(0);
        expect(Math.abs(molaEm(quarto, fps, preset) - 1)).toBeGreaterThan(
          springDurationRestThreshold,
        );

        // Todo frame da janela da um valor DIFERENTE: uma mola que pulasse de
        // 0 para 1 passaria em tudo acima sem animar coisa nenhuma.
        const valores = new Set(
          Array.from({ length: d + 1 }, (_, f) => molaEm(f, fps, preset)),
        );
        expect(valores.size).toBe(d + 1);
      });
    }
  }

  it("a massa de referencia nao e decisao de design: dobrar nao muda a curva", () => {
    const preset = presetObrigatorio(NOME_DA_MOLA_PADRAO);
    const base = configDaMola(preset);
    const fator = 2.5;
    const escalada = {
      mass: base.mass * fator,
      stiffness: base.stiffness * fator,
      damping: base.damping * fator,
      overshootClamping: base.overshootClamping,
    };
    const zetaBase = base.damping / (2 * Math.sqrt(base.stiffness * base.mass));
    const zetaEscalado =
      escalada.damping / (2 * Math.sqrt(escalada.stiffness * escalada.mass));
    expect(zetaEscalado).toBeCloseTo(zetaBase, 12);
    expect(MASSA_DE_REFERENCIA).toBeGreaterThan(0);
  });

  it("preset que nao existe ESTOURA — nunca cai num default silencioso", () => {
    expect(() => presetObrigatorio("preset-que-nao-existe")).toThrow(
      /nao existe em src\/design\/tokens\.ts/,
    );
  });

  it("cada animacao.tipo aponta para um preset NOMEADO do token (ou para nenhum)", () => {
    const tipos = Object.keys(NOME_DA_MOLA_POR_ANIMACAO) as AnimacaoTipo[];
    expect(tipos.length).toBeGreaterThan(0);
    for (const tipo of tipos) {
      const nome = NOME_DA_MOLA_POR_ANIMACAO[tipo];
      if (nome === null) continue;
      expect(springPresets[nome], `preset "${nome}" nao existe no token`).toBeDefined();
      expect(molaDoNo(noDeTeste({ animacao: { tipo } }))).toBe(springPresets[nome]);
    }
  });

  it('animacao "none" desliga a mola; sem animacao usa o preset padrao', () => {
    expect(molaDoNo(noDeTeste({ animacao: { tipo: "none" } }))).toBeNull();
    expect(molaDoNo(noDeTeste({ animacao: undefined }))).toBe(
      springPresets[NOME_DA_MOLA_PADRAO],
    );
    expect(springPresets[NOME_DA_MOLA_DO_SUBTITULO]).toBeDefined();
  });

  it("o atraso do subtitulo sai de transitionDuration, nao de um numero solto", () => {
    expect(atrasoDoSubtitulo(FPS)).toBe(msToFrames(transitionDuration.instant, FPS));
    expect(janelaDeSaida(DURACAO, FPS)).toBe(
      msToFrames(transitionDuration.snap, FPS),
    );
    // A saida nunca e maior que a propria janela declarada.
    expect(janelaDeSaida(2, FPS)).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Zero numero de mola escrito a mao no arquivo — com sonda negativa
// ---------------------------------------------------------------------------

/**
 * Acha `damping: 15`, `stiffness = 100`, `mass:0.5` e afins — literal NUMERICO
 * fechado. `damping: 2 * preset.zeta * omega0` nao casa de proposito: ali o
 * numero e coeficiente da formula do token, nao valor de mola escrito a mao.
 */
const MOLA_INLINE =
  /\b(damping|stiffness|mass|zeta|settlingTimeSeconds)\s*[:=]\s*-?\d+(?:\.\d+)?\s*(?:[,;)}]|$)/g;

function semComentario(linha: string): string {
  const cortada = linha.split("//")[0] ?? "";
  const aparada = cortada.trimStart();
  if (aparada.startsWith("*") || aparada.startsWith("/*")) return "";
  return cortada;
}

/** O arquivo sem nenhuma linha de comentario. */
function soCodigo(fonte: string): string {
  return fonte
    .split("\n")
    .map(semComentario)
    .join("\n");
}

function molasInline(fonte: string): string[] {
  const achados: string[] = [];
  const linhas = fonte.split("\n");
  for (let i = 0; i < linhas.length; i++) {
    const codigo = semComentario(linhas[i] ?? "");
    MOLA_INLINE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MOLA_INLINE.exec(codigo)) !== null) {
      achados.push(`linha ${String(i + 1)}: ${m[0]}`);
    }
  }
  return achados;
}

describe("nenhum numero de mola escrito a mao (o ∅ do card)", () => {
  it("sonda negativa: o varredor acusa uma mola inline plantada (C2)", () => {
    const plantado = [
      "const config = { damping: 15, mass: 0.5, stiffness: 100 };",
      "  const zeta = 0.7;",
    ].join("\n");
    expect(molasInline(plantado).length).toBe(4);
  });

  it("sonda negativa: comentario citando damping: 15 NAO conta", () => {
    expect(molasInline("// nunca escreva damping: 15 aqui").length).toBe(0);
  });

  it("src/composicao/nos/cabecalho.tsx nao tem nenhuma", () => {
    const fonte = readFileSync(FONTE, "utf-8");
    expect(fonte.length).toBeGreaterThan(0);
    const achados = molasInline(fonte);
    expect(achados.length, achados.join("\n")).toBe(0);
  });

  it("o arquivo importa springPresets — o token entra de verdade", () => {
    const fonte = readFileSync(FONTE, "utf-8");
    expect(fonte).toContain("springPresets");
    expect(fonte).toContain("springDurationRestThreshold");
    expect(fonte).toContain("../../design/tokens");
  });

  it("imports de design/composicao sao RELATIVOS (o webpack nao le os paths)", () => {
    // So o CODIGO conta: o cabecalho deste arquivo cita `from "src/..."`
    // justamente para explicar por que ele e proibido.
    const codigo = soCodigo(readFileSync(FONTE, "utf-8"));
    expect(codigo).toContain("from");
    expect(codigo).not.toMatch(/from\s+["']src\//);
  });

  it("nenhum useCurrentFrame: o frame chega por prop", () => {
    const codigo = soCodigo(readFileSync(FONTE, "utf-8"));
    expect(codigo).not.toContain("useCurrentFrame");
  });

  it("toda interpolate() do arquivo declara os dois extrapolate", () => {
    const fonte = readFileSync(FONTE, "utf-8");
    const chamadas = fonte.match(/\binterpolate\s*\(/g) ?? [];
    expect(chamadas.length).toBeGreaterThan(0);
    expect((fonte.match(/extrapolateLeft:/g) ?? []).length).toBe(chamadas.length);
    expect((fonte.match(/extrapolateRight:/g) ?? []).length).toBe(chamadas.length);
  });
});

// ---------------------------------------------------------------------------
// 4. O smoke reprovaria um quadro vazio?
// ---------------------------------------------------------------------------

describe("o smoke nao passa com quadro vazio", () => {
  it("controle positivo: no frame assentado, o smoke aprova", () => {
    expect(reprovacoesDoSmoke(renderizar(noDeTeste(), 45))).toStrictEqual([]);
  });

  it("o mesmo smoke REPROVA o render vazio (fora da janela)", () => {
    const vazio = renderizar(noDeTeste(), DURACAO);
    expect(vazio).toBe("");
    expect(reprovacoesDoSmoke(vazio).length).toBeGreaterThan(0);
  });

  it("o HTML tem texto de verdade, nao so caixa (C1)", () => {
    const html = renderizar(noDeTeste(), 45);
    expect(html).toContain(TITULO);
    expect(html).toContain(SUBTITULO);
    expect(html.length).toBeGreaterThan(400);
  });

  it("sem subtitulo declarado, o paragrafo nao existe (nao vem vazio)", () => {
    const html = renderizar(noDeTeste({ subtitulo: undefined }), 45);
    expect(html).toContain(TITULO);
    expect(html).not.toContain("<p");
  });

  it("o alinhamento do manifesto chega ao pixel", () => {
    expect(renderizar(noDeTeste({ alinhamento: "esquerda" }), 45)).toContain(
      "text-align:left",
    );
    expect(renderizar(noDeTeste({ alinhamento: "direita" }), 45)).toContain(
      "text-align:right",
    );
    expect(renderizar(noDeTeste({ alinhamento: "centro" }), 45)).toContain(
      "text-align:center",
    );
  });
});

// ---------------------------------------------------------------------------
// 5. A janela declarada manda
// ---------------------------------------------------------------------------

/** Extrai os valores de `opacity:` do HTML, em ordem de aparicao. */
function opacidades(html: string): number[] {
  return [...html.matchAll(/opacity:([0-9.]+)/g)].map((m) => Number(m[1]));
}

describe("o componente respeita a duracao declarada", () => {
  it("ultimo frame da janela desenha; o primeiro de fora nao", () => {
    expect(renderizar(noDeTeste(), DURACAO - 1).length).toBeGreaterThan(0);
    expect(renderizar(noDeTeste(), DURACAO)).toBe("");
    expect(renderizar(noDeTeste(), DURACAO + 60)).toBe("");
    expect(renderizar(noDeTeste(), -1)).toBe("");
  });

  it("o no anuncia a propria duracao no DOM (evidencia para o gate)", () => {
    expect(renderizar(noDeTeste(), 10)).toContain(`data-duracao="${String(DURACAO)}"`);
  });

  it("a saida acontece DENTRO da janela, nao depois dela", () => {
    const saida = janelaDeSaida(DURACAO, FPS);
    const assentado = Math.max(...opacidades(renderizar(noDeTeste(), 45)));
    const antesDaSaida = Math.max(
      ...opacidades(renderizar(noDeTeste(), DURACAO - saida)),
    );
    const noFim = Math.max(...opacidades(renderizar(noDeTeste(), DURACAO - 1)));
    expect(assentado).toBeCloseTo(1, 6);
    expect(antesDaSaida).toBeCloseTo(1, 6);
    expect(noFim).toBeLessThan(antesDaSaida);
    expect(noFim).toBeGreaterThan(0);
  });

  it("uma janela de duracao invalida e RECUSADA, nao desenhada", () => {
    expect(() => renderizar(noDeTeste({ duracao_frames: 0 }), 0)).toThrow(
      /duracao_frames invalida/,
    );
    expect(() => renderizar(noDeTeste({ duracao_frames: -5 }), 0)).toThrow(
      /duracao_frames invalida/,
    );
  });

  it("nos frames de entrada a opacidade cresce — a mola esta viva no DOM", () => {
    const cedo = Math.max(...opacidades(renderizar(noDeTeste(), 1)));
    const meio = Math.max(...opacidades(renderizar(noDeTeste(), 6)));
    const tarde = Math.max(...opacidades(renderizar(noDeTeste(), 45)));
    expect(cedo).toBeLessThan(meio);
    expect(meio).toBeLessThanOrEqual(tarde);
  });
});

// ---------------------------------------------------------------------------
// 6. Determinismo do caminho puro
// ---------------------------------------------------------------------------

describe("determinismo (a prova de bytes esta em tools/no-cabecalho/provar.sh)", () => {
  it("mesmas props, duas passadas, HTML identico", () => {
    for (const frame of [0, 3, 45, DURACAO - 1]) {
      expect(renderizar(noDeTeste(), frame)).toBe(renderizar(noDeTeste(), frame));
    }
  });

  it("a mola e funcao pura do frame: mesma entrada, mesmo numero", () => {
    const preset = presetObrigatorio(NOME_DA_MOLA_PADRAO);
    for (const frame of [0, 1, 7, 30]) {
      expect(molaEm(frame, FPS, preset)).toBe(molaEm(frame, FPS, preset));
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Os snapshots aprovados existem (∅-crit barato, sem ffmpeg)
// ---------------------------------------------------------------------------

describe("snapshots aprovados de fixtures/snapshots/no-cabecalho/", () => {
  it("o ponto de entrada do render existe", () => {
    expect(existsSync(resolve(DIR_SNAPSHOT, "entrada.tsx"))).toBe(true);
  });

  const ESPERADOS = [
    "centro-frame3.png",
    "centro-frame45.png",
    "esquerda-frame20.png",
  ];

  for (const arquivo of ESPERADOS) {
    it(`aprovados/${arquivo} existe (apagar tem de ficar vermelho)`, () => {
      expect(
        existsSync(resolve(APROVADOS, arquivo)),
        `snapshot aprovado ausente: fixtures/snapshots/no-cabecalho/aprovados/${arquivo}`,
      ).toBe(true);
    });
  }
});
