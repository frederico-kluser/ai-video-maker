// =============================================================================
// SONDA DE SOBREPOSICAO DE TEXTO — o oraculo falsificavel da sub-parte 2a
// =============================================================================
// Onda 2 (onda2-composicao, sub-parte 2a): "os textos se sobrepoem".
//
// A sonda renderiza a ARVORE DE PRODUCAO (a camada de pintura — a mesma que
// o pipeline renderiza, com transicoes) nos frames de interesse e exige:
//
//   C1  nenhum par de blocos de texto VISIVEIS se sobrepoe. O bloco de
//       texto de cada no e a bounding box que o proprio no declara
//       (data-bbox) — a geometria HONESTA do que ele desenha, nao a banda
//       (se o no ignorasse a banda, a caixa vazaria e a sonda acusaria).
//       Visivel = data-visibilidade > 0.05 (o fator de transicao x a
//       opacidade propria do no).
//
//   C2  dentro de uma transicao, os blocos visiveis pertencem a UMA unica
//       cena. E a traducao da politica temporal: a cena que sai some na
//       primeira metade da transicao e a que entra aparece na segunda —
//       nunca existe um frame com texto dos DOIS lados.
//
//   C3  a montagem dos webm de grafico (sub-parte 2b): na cena c-004, cada
//       frame mostra EXATAMENTE UM video de grafico, e o video certo na
//       fatia certa — os cinco webm de matematica, um de cada vez.
//
// Frames de sonda (calculados da timeline canonica, 727 frames):
//
//   transicoes: 82 e 86  (fade  c-001 -> c-002, [75, 90))
//               275 e 283 (wipe c-002 -> c-003, [265, 285))
//               436 e 440 (clockWipe c-003 -> c-004, [427, 445))
//   intra-cena: 100, 120, 180 (c-002: texto n-002 + lista n-003)
//               300, 350, 400 (c-003: codigo n-008 + lista n-004)
//               560, 580, 600 (c-005: texto n-014 + cabecalho n-015)
//
// ANTES da correcao (onda 2), esta sonda acusava 4 frames com sobreposicao
// (82: cabecalho x texto; 275: lista x lista; 580/600: texto x cabecalho) —
// a evidencia da sonda negativa esta no handoff da onda.
// =============================================================================

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ImgHTMLAttributes, VideoHTMLAttributes } from "react";

// ---------------------------------------------------------------------------
// Mock do runtime do Remotion: <Img>, <OffthreadVideo> e <Sequence> nao
// renderizam em react-dom/server (chamam useCurrentFrame) — viram elementos
// puros, como no oraculo de presenca da suite integrada. O resto do modulo
// (interpolate, spring, staticFile) continua o original.
//
// O <Gif> do @remotion/gif (Onda 3 — o no de midia renderiza o asset real)
// tambem chama useCurrentFrame: vira um <img> puro com o src e o fit.
// ---------------------------------------------------------------------------
vi.mock("remotion", async (importOriginal) => {
  const original = await importOriginal<typeof import("remotion")>();
  return {
    ...original,
    Img: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement("img", props),
    OffthreadVideo: (props: VideoHTMLAttributes<HTMLVideoElement>) =>
      createElement("video", props),
    Sequence: (props: { from: number; children?: unknown }) =>
      createElement(
        "div",
        { "data-sequence-from": String(props.from) },
        props.children as never,
      ),
  };
});

vi.mock("@remotion/gif", async () => {
  return {
    Gif: (props: { src?: string; fit?: string; style?: unknown }) =>
      createElement("img", { src: props.src, "data-gif-fit": props.fit, style: props.style }),
  };
});

import type { AssetResolvido } from "../../../src/resolucao/manifesto-resolvido";
import type { FixtureIntegrada } from "../../../src/composicao/pintura/fiar";
import { fiarApadrao, pintar } from "../../../src/composicao/pintura/index";
import { calcularDuracao } from "../../../src/composicao/tempo";

const AQUI = resolve(import.meta.dirname);
const RAIZ = resolve(AQUI, "..", "..", "..");

// A chave do cassete canonico de grafico (onda 1, estagio v1.2.1): derivada
// do manifesto canonico + parametros do estagio — se o cassete for
// regravado com outra chave, esta leitura acha a nova (o cassete e a
// verdade, C12). A Onda 3 mudou o CONTEUDO da fixture canonica
// (texto_alternativo dos nos de midia) e o cassete foi re-chaveado para
// o hash novo (conteudo preservado, so o cabecalho).
const CHAVE_DO_CASSETE_GRAFICO =
  "0f10b3cabce5f5374e40bd46b22853231b517fd8bf4c62d460670e960e5af5e8";

// A chave do cassete canonico de MIDIA (Onda 3, estagio v1.2.0): gravado
// para a propria fixture canonica — n-005 imagem (CC0), n-006 video (CC0),
// n-007 gif (PDM). A sonda precisa da camada de midia para exercitar as
// legendas da cena c-005 no C1/C2.
const CHAVE_DO_CASSETE_MIDIA =
  "6ff203f3b562b5cfd6b461beb943b80bcbd351f3fb17b3dad4ddea864ad91150";

interface AssetDoCassete extends AssetResolvido {
  duracaoSegundos?: number;
}

function lerAssetsDoCassete(
  estagio: string,
  chave: string,
): { assets: Record<string, AssetResolvido>; nos: Record<string, string> } {
  const resultado = JSON.parse(
    readFileSync(
      resolve(RAIZ, "fixtures", "cassetes", estagio, chave, "resultado.json"),
      "utf8",
    ),
  ) as {
    assets: Record<string, AssetDoCassete>;
    nos_grafico: Record<string, string>;
    nos_midia: Record<string, string>;
  };
  const assets: Record<string, AssetResolvido> = {};
  for (const [hash, asset] of Object.entries(resultado.assets)) {
    const { duracaoSegundos: _duracao, ...semDuracao } = asset;
    assets[hash] = semDuracao;
  }
  return {
    assets,
    nos: { ...resultado.nos_grafico, ...resultado.nos_midia },
  };
}

function fixtureDosWebmDeMatematica(): FixtureIntegrada {
  const grafico = lerAssetsDoCassete("grafico", CHAVE_DO_CASSETE_GRAFICO);
  const midia = lerAssetsDoCassete("midia", CHAVE_DO_CASSETE_MIDIA);
  const manifesto = JSON.parse(
    readFileSync(resolve(RAIZ, "fixtures", "canonico", "manifesto-valido.json"), "utf8"),
  ) as FixtureIntegrada["manifesto"];

  return {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: "a0ae9cdd0e99d3f62bd8aecce8246e1dcfebfa56be0099854ea6fd479cb27158",
    manifesto,
    assets: { ...grafico.assets, ...midia.assets },
    nos_grafico: { ...grafico.nos },
    nos_midia: { ...midia.nos },
  };
}

// ---------------------------------------------------------------------------
// Geometria da sonda
// ---------------------------------------------------------------------------

interface BlocoDeTexto {
  noId: string;
  tipo: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  visibilidade: number;
}

// Onda 3: `midia` entra na sonda — a LEGENDA do no de midia (gif/video) e
// texto legivel e participa do C1/C2 como qualquer bloco de texto.
const TIPOS_DE_TEXTO = new Set(["texto", "lista", "cabecalho", "codigo", "midia"]);

function parsearBlocos(html: string): BlocoDeTexto[] {
  const blocos: BlocoDeTexto[] = [];
  const re =
    /<div data-no="([^"]+)" data-tipo="(texto|lista|cabecalho|codigo|midia)"[^>]*?data-bbox="([^"]+)"[^>]*?data-visibilidade="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const [x, y, largura, altura] = m[3]!.split(",").map(Number);
    blocos.push({
      noId: m[1]!,
      tipo: m[2]!,
      x: x!,
      y: y!,
      largura: largura!,
      altura: altura!,
      visibilidade: Number(m[4]),
    });
  }
  return blocos;
}

// ---------------------------------------------------------------------------
// A MIDIA COMO OBSTACULO (fix da Onda 3, revisao adversarial da c-005)
// ---------------------------------------------------------------------------
// O revisor refutou a Onda 3 com evidencia de PIXEL: na c-005 a midia,
// pintada DEPOIS do texto, cobria o bloco de texto n-014 e a legenda do
// video n-006 (frame 580: zero pixels de texto na regiao declarada; a
// regiao da legenda n-006 chapada de branco do globo). A sonda C1/C2
// validava so os data-bbox DECLARADOS e deixou o falso-verde passar.
//
// Duas invariantes novas, cobradas em C4 e C5:
//
//   C4  geometria — a REGIAO da midia (data-regiao-da-midia, a banda do
//       eixo onde o asset renderiza) de um gif/video NAO pode intersectar
//       o bloco de texto visivel de OUTRO no da mesma cena. A imagem
//       `cover` (n-005) e fundo de cena por design — fica de fora.
//
//   C5  ordem de pintura — no segmento DOM de cada cena, TODO no de
//       midia precede TODO bloco de texto: midia e obstaculo opaco, quem
//       pinta por ultimo fica por cima, e o texto nunca pode ficar sob a
//       midia (o `sort` estavel de pintura/cena.ts garante isso).
//
// As duas funcoes de violacao sao PURAS e EXPORTADAS de proposito: os
// testes de mutacao as chamam com os dados do BUG MEDIDO (regiao da
// midia = quadro inteiro; ordem de manifesto com texto primeiro) e
// exigem que acendam VERMELHO — sem isso elas poderiam ficar verdes por
// vazio e o falso-verde voltaria.

/** A regiao onde a midia de um no RENDERIZA (a banda do eixo). */
interface MidiaNoFrame {
  noId: string;
  tipoMidia: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Extrai as midias do markup: raiz do no + container da regiao. */
function parsearMidias(html: string): MidiaNoFrame[] {
  const midias: MidiaNoFrame[] = [];
  const re =
    /<div data-no="([^"]+)" data-tipo="midia"[^>]*?><div data-regiao-da-midia="([^"]+)" data-tipo-midia="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const [x, y, largura, altura] = m[2]!.split(",").map(Number);
    midias.push({
      noId: m[1]!,
      tipoMidia: m[3]!,
      x: x!,
      y: y!,
      largura: largura!,
      altura: altura!,
    });
  }
  return midias;
}

function seIntersectam(a: BlocoDeTexto, b: BlocoDeTexto): boolean {
  return (
    a.x < b.x + b.largura &&
    b.x < a.x + a.largura &&
    a.y < b.y + b.altura &&
    b.y < a.y + a.altura
  );
}

function seIntersectamRegioes(
  a: { x: number; y: number; largura: number; altura: number },
  b: { x: number; y: number; largura: number; altura: number },
): boolean {
  return (
    a.x < b.x + b.largura &&
    b.x < a.x + a.largura &&
    a.y < b.y + b.altura &&
    b.y < a.y + a.altura
  );
}

/**
 * C4: a regiao da midia (gif/video — a imagem cover e fundo por design)
 * NAO pode intersectar o bloco de texto visivel de outro no da MESMA
 * cena. A legenda do proprio no (mesmo noId) fica sobre a propria midia
 * por construcao — esta de fora.
 */
export function violacoesDeSobreposicaoDeMidia(
  blocos: readonly BlocoDeTexto[],
  midias: readonly MidiaNoFrame[],
  cenaDoNo: ReadonlyMap<string, string>,
): string[] {
  const violacoes: string[] = [];
  const visiveis = blocos.filter((b) => b.visibilidade > LIMIAR_DE_VISIBILIDADE);
  for (const midia of midias) {
    if (midia.tipoMidia === "imagem") continue;
    const cenaDaMidia = cenaDoNo.get(midia.noId);
    for (const bloco of visiveis) {
      if (bloco.noId === midia.noId) continue;
      if (cenaDoNo.get(bloco.noId) !== cenaDaMidia) continue;
      if (seIntersectamRegioes(midia, bloco)) {
        violacoes.push(
          `midia ${midia.noId} (${midia.tipoMidia}, regiao ` +
            `${JSON.stringify([midia.x, midia.y, midia.largura, midia.altura])}) ` +
            `cobre o bloco de texto ${bloco.noId} (${bloco.tipo}, bbox ` +
            `${JSON.stringify([bloco.x, bloco.y, bloco.largura, bloco.altura])}) ` +
            `na cena ${cenaDaMidia ?? "?"}`,
        );
      }
    }
  }
  return violacoes;
}

/**
 * C5: no segmento DOM de UMA cena, todo no de midia precede todo bloco
 * de texto. Recebe o segmento (html da cena) e devolve as violacoes.
 * O primeiro `data-no` de cada no (a raiz) e o que conta: e a raiz que
 * estabelece a ordem de pintura do bloco inteiro.
 */
export function violacoesDeOrdemDePinturaDoSegmento(segmento: string): string[] {
  const primeiraPosicao = new Map<string, number>();
  const tipo = new Map<string, string>();
  const re = /data-no="([^"]+)" data-tipo="(midia|texto|lista|cabecalho|codigo)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(segmento)) !== null) {
    const noId = m[1]!;
    if (!primeiraPosicao.has(noId)) {
      primeiraPosicao.set(noId, m.index);
      tipo.set(noId, m[2]!);
    }
  }
  const midias = [...primeiraPosicao.entries()]
    .map(([noId, pos]) => [noId, pos, tipo.get(noId)] as const)
    .filter(([, , t]) => t === "midia");
  const textos = [...primeiraPosicao.entries()]
    .map(([noId, pos]) => [noId, pos, tipo.get(noId)] as const)
    .filter(([, , t]) => t !== "midia");
  if (midias.length === 0 || textos.length === 0) return [];
  const ultimaMidia = Math.max(...midias.map(([, pos]) => pos));
  const primeiroTexto = Math.min(...textos.map(([, pos]) => pos));
  if (ultimaMidia > primeiroTexto) {
    const nomes = midias.map(([noId]) => noId).join(", ");
    return [
      `na cena, a midia (${nomes}) pinta DEPOIS de um bloco de texto — ` +
        `ordem de pintura regrediu, a midia opaca pode esconder o texto`,
    ];
  }
  return [];
}

/** Os segmentos de cena do markup (a sequencia + o pintor de cena). */
function segmentosDeCena(html: string): string[] {
  const segmentos: string[] = [];
  const re = /data-cena="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inicio = m.index;
    const fim = html.indexOf('data-cena="', m.index + m[0].length);
    segmentos.push(html.slice(inicio, fim < 0 ? html.length : fim));
  }
  return segmentos;
}

const LIMIAR_DE_VISIBILIDADE = 0.05;

// ---------------------------------------------------------------------------
// A arvore de producao (a mesma do pipeline: pintura + transicoes)
// ---------------------------------------------------------------------------

function renderizarProducao(frame: number): string {
  const estado = fiarApadrao(fixtureDosWebmDeMatematica());
  return renderToStaticMarkup(
    pintar(estado.manifesto, frame, {
      fps: estado.plano.fps,
      width: estado.plano.width,
      height: estado.plano.height,
    }),
  );
}

const noParaCena = new Map<string, string>();
{
  const manifesto = JSON.parse(
    readFileSync(resolve(RAIZ, "fixtures", "canonico", "manifesto-valido.json"), "utf8"),
  ) as { cenas: { id: string; nos: string[] }[] };
  for (const cena of manifesto.cenas) {
    for (const noId of cena.nos) noParaCena.set(noId, cena.id);
  }
}

// ---------------------------------------------------------------------------
// A sonda
// ---------------------------------------------------------------------------

const FRAMES_DE_TRANSICAO: readonly [number, string][] = [
  [82, "fade c-001->c-002 (p=0.47)"],
  [86, "fade c-001->c-002 (p=0.73)"],
  [275, "wipe c-002->c-003 (p=0.50)"],
  [283, "wipe c-002->c-003 (p=0.90)"],
  [436, "clockWipe c-003->c-004 (p=0.50)"],
  [440, "clockWipe c-003->c-004 (p=0.72)"],
];

const FRAMES_INTRA_CENA: readonly [number, string][] = [
  [110, "c-002: texto n-002 + lista n-003"],
  [150, "c-002: texto n-002 + lista n-003"],
  [180, "c-002: lista n-003 sozinha"],
  [300, "c-003: codigo n-008 + lista n-004"],
  [350, "c-003: codigo n-008 + lista n-004"],
  [400, "c-003: codigo n-008 + lista n-004"],
  [560, "c-005: cabecalho n-015 + midia"],
  [590, "c-005: texto n-014 + cabecalho n-015"],
  [600, "c-005: texto n-014 + cabecalho n-015"],
];

describe("sonda de sobreposicao de texto (C1) — blocos visiveis nunca se tocam", () => {
  for (const [frame, onde] of [...FRAMES_DE_TRANSICAO, ...FRAMES_INTRA_CENA]) {
    it(`frame ${String(frame)} (${onde}): nenhum par de blocos de texto visiveis se sobrepoe`, () => {
      const html = renderizarProducao(frame);
      const blocos = parsearBlocos(html);
      const visiveis = blocos.filter((b) => b.visibilidade > LIMIAR_DE_VISIBILIDADE);

      // A sonda TEM de exercitar pares: bloco unico nao prova nada (C2).
      if (visiveis.length < 2) return;

      for (let i = 0; i < visiveis.length; i++) {
        for (let j = i + 1; j < visiveis.length; j++) {
          const a = visiveis[i]!;
          const b = visiveis[j]!;
          expect(
            seIntersectam(a, b),
            `frame ${String(frame)}: ${a.noId} (${a.tipo}) ${JSON.stringify(
              [a.x, a.y, a.largura, a.altura],
            )} x ${b.noId} (${b.tipo}) ${JSON.stringify(
              [b.x, b.y, b.largura, b.altura],
            )}`,
          ).toBe(false);
        }
      }
    });
  }

  it("a sonda NAO passa com bloco unico: os frames intra-cena tem >= 2 nos de texto", () => {
    // Denominador da sonda (falsifiable-gates): sem este teste, um bug que
    // escondesse todos os textos deixaria a sonda verde por vazio. Frames
    // de PARe: janelas de dois nos de texto da mesma cena sobrepostas no
    // tempo (frame 560 tem so o cabecalho — n-014 entra em 577).
    const framesDePar = [110, 150, 180, 300, 350, 400, 590, 600];
    for (const frame of framesDePar) {
      const blocos = parsearBlocos(renderizarProducao(frame));
      const nosDeTexto = blocos.filter((b) => TIPOS_DE_TEXTO.has(b.tipo));
      expect(
        nosDeTexto.length,
        `frame ${String(frame)}: a cena declarada tem texto, a sonda precisa de pares`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("politica temporal da transicao (C2) — o texto visivel e de UMA cena so", () => {
  for (const [frame, onde] of FRAMES_DE_TRANSICAO) {
    it(`frame ${String(frame)} (${onde}): todos os blocos visiveis pertencem a uma unica cena`, () => {
      const html = renderizarProducao(frame);
      const visiveis = parsearBlocos(html).filter(
        (b) => b.visibilidade > LIMIAR_DE_VISIBILIDADE,
      );
      const cenas = new Set(visiveis.map((b) => noParaCena.get(b.noId)));
      expect(cenas.size, `frame ${String(frame)}: ${JSON.stringify([...cenas])}`).toBeLessThanOrEqual(1);
    });
  }

  it("no MEIO da transicao (p=0.5) nenhum texto esta visivel", () => {
    // 275 e 436 tem p exatamente 0.5: os dois lados com fator 0.
    for (const frame of [275, 436]) {
      const visiveis = parsearBlocos(renderizarProducao(frame)).filter(
        (b) => b.visibilidade > LIMIAR_DE_VISIBILIDADE,
      );
      expect(visiveis, `frame ${String(frame)}`).toHaveLength(0);
    }
  });
});

describe("montagem dos webm de grafico (C3) — um video por vez, na fatia certa", () => {
  // Fatias da cena c-004 (427..547, 120 frames): n-009 [427,451), n-010
  // [451,475), n-011 [475,499), n-012 [499,523), n-013 [523,547).
  const FATIAS: readonly [number, string, number][] = [
    [430, "n-009", 427],
    [460, "n-010", 451],
    [485, "n-011", 475],
    [510, "n-012", 499],
    [535, "n-013", 523],
  ];

  for (const [frame, esperado, inicioDaFatia] of FATIAS) {
    it(`frame ${String(frame)}: so o video ${esperado} desenha, na base ${String(inicioDaFatia)}`, () => {
      const html = renderizarProducao(frame);
      const videos = [...html.matchAll(/data-no="([^"]+)"[^>]*?data-modo="asset-video"/g)].map(
        (m) => m[1],
      );
      expect(videos).toStrictEqual([esperado]);
      expect(html).toContain(`data-video-inicio="${String(inicioDaFatia)}"`);
    });
  }

  it("fora da propria fatia o video nao desenha (nao ha empilhamento)", () => {
    // Frame 437: fatia de n-009. n-010..n-013 nao podem desenhar aqui.
    const html = renderizarProducao(437);
    for (const noId of ["n-010", "n-011", "n-012", "n-013"]) {
      expect(html).not.toContain(`data-no="${noId}"`);
    }
    expect(html).toContain('data-no="n-009"');
  });

  it("a cena c-004 mostra matematica (os cinco videos, um em cada fatia)", () => {
    const vistos = new Set<string>();
    for (const [frame] of FATIAS) {
      const html = renderizarProducao(frame);
      const m = /data-no="(n-0\d\d)"[^>]*?data-modo="asset-video"/.exec(html);
      if (m !== null) vistos.add(m[1]!);
    }
    expect([...vistos].sort()).toStrictEqual([
      "n-009",
      "n-010",
      "n-011",
      "n-012",
      "n-013",
    ]);
  });

  it("o total da composicao continua 727 (a montagem nao mexe na aritmetica)", () => {
    const duracao = calcularDuracao(fixtureDosWebmDeMatematica().manifesto);
    expect(duracao.totalFrames).toBe(727);
  });
});

describe("legendas de midia na cena c-005 (C1/C2, Onda 3) — gif e video com texto", () => {
  // c-005: 547..727. n-006 video 547..607, n-007 gif 562..607 (entrada 15),
  // n-014 texto 577..727, n-015 cabecalho 547..607. Bandas (4 nos de texto):
  // topo=54 (graphicsSafePct=0.05), alturaDeBanda=(1080-108)/4=243 —
  // n-014 banda 1 [54,297), n-006 banda 2 [297,540), n-007 banda 3
  // [540,783), n-015 banda 4 [783,1026).
  const BANDA_2 = { y: 297, altura: 243 };
  const BANDA_3 = { y: 540, altura: 243 };

  it("frame 560: a legenda do video esta presente, visivel e DENTRO da propria banda", () => {
    const html = renderizarProducao(560);
    const blocos = parsearBlocos(html);
    const video = blocos.find((b) => b.noId === "n-006");
    expect(video, "n-006 sem legenda no frame 560").toBeDefined();
    expect(video!.tipo).toBe("midia");
    expect(video!.visibilidade).toBeGreaterThan(LIMIAR_DE_VISIBILIDADE);
    expect(video!.y).toBeGreaterThanOrEqual(BANDA_2.y);
    expect(video!.y + video!.altura).toBeLessThanOrEqual(
      BANDA_2.y + BANDA_2.altura,
    );
    expect(html).toContain('data-legenda="dvorak typing"');
  });

  it("a legenda renderiza ONDE o data-bbox declara (geometria honesta — o deslocamento de margem)", () => {
    // n-006 e `contain`: a raiz do no comeca em `inset: margem` (54 px). O
    // estilo da barra tem de ser a caixa ABSOLUTA menos a margem — sem
    // isso a barra renderizaria (54,54) fora do bbox declarado e a sonda
    // C1 aprovaria uma geometria que o pixel desmente (medido no master).
    const html = renderizarProducao(590);
    const bloco = /data-no="n-007"[^>]*?data-legenda="([^"]+)"[^>]*?data-bbox="([^"]+)"[^>]*?style="([^"]*)"/.exec(
      html,
    );
    expect(bloco, "legenda do gif no frame 590").toBeDefined();
    const [x, y] = (bloco![2] ?? "").split(",").map(Number);
    expect(Number.isFinite(x) && Number.isFinite(y), "bbox mal formado").toBe(true);
    const xBbox = x as number;
    const yBbox = y as number;
    const style = bloco![3]!;
    const left = /left:(-?\d+)px/.exec(style)?.[1];
    const top = /top:(-?\d+)px/.exec(style)?.[1];
    const margem = 54; // 0.05 * 1080 — graphicsSafePct do menor lado
    expect(Number(left)).toBe(xBbox - margem);
    expect(Number(top)).toBe(yBbox - margem);
  });

  it("frame 590: as legendas do video E do gif estao presentes, em bandas distintas (gif abaixo)", () => {
    const html = renderizarProducao(590);
    const blocos = parsearBlocos(html);
    const video = blocos.find((b) => b.noId === "n-006");
    const gif = blocos.find((b) => b.noId === "n-007");
    expect(video, "n-006 sem legenda").toBeDefined();
    expect(gif, "n-007 sem legenda").toBeDefined();
    expect(html).toContain('data-legenda="dvorak typing"');
    expect(html).toContain('data-legenda="spinning globe map"');
    // As duas legendas ficam nas proprias bandas: gif (banda 3) abaixo do
    // video (banda 2), sem se tocar.
    expect(gif!.y).toBeGreaterThan(video!.y + video!.altura);
    expect(gif!.y).toBeGreaterThanOrEqual(BANDA_3.y);
    expect(gif!.y + gif!.altura).toBeLessThanOrEqual(BANDA_3.y + BANDA_3.altura);
    // O gif e asset real (fiado): o <Gif> do @remotion/gif esta no markup.
    expect(html).toContain('data-asset-hash=');
  });

  it("frame 600: a legenda do gif continua visivel (janela 562..607) e a do video tambem", () => {
    const blocos = parsearBlocos(renderizarProducao(600));
    for (const noId of ["n-006", "n-007"]) {
      const bloco = blocos.find((b) => b.noId === noId);
      expect(bloco, `${noId} sem legenda no frame 600`).toBeDefined();
      expect(bloco!.visibilidade).toBeGreaterThan(LIMIAR_DE_VISIBILIDADE);
    }
  });

  it("frame 610: fora da janela do gif e do video, nenhuma legenda de midia resta", () => {
    const blocos = parsearBlocos(renderizarProducao(610)).filter(
      (b) => b.tipo === "midia",
    );
    expect(blocos).toHaveLength(0);
  });

  it("a imagem n-005 NAO renderiza legenda (decisao documentada da Onda 3)", () => {
    const blocos = parsearBlocos(renderizarProducao(300)).filter(
      (b) => b.noId === "n-005",
    );
    expect(blocos).toHaveLength(0);
    expect(renderizarProducao(300)).not.toContain('data-legenda="code health checker"');
  });
});

// ---------------------------------------------------------------------------
// C4 — a midia como obstaculo opaco (fix da Onda 3)
// ---------------------------------------------------------------------------
// O revisor refutou a Onda 3 com pixel: na c-005 a midia pintada depois
// do texto cobria n-014 e a legenda de n-006 no frame 580. Esta sonda
// modela a REGIAO RENDERIZADA da midia (a banda do eixo, que
// data-regiao-da-midia declara) como obstaculo: gif/video confinado a
// banda nao pode intersectar o bloco de texto visivel de outro no da
// mesma cena.
describe("midia como obstaculo opaco (C4) — a regiao da midia nao cobre bloco de texto de irmao", () => {
  for (const [frame, onde] of [...FRAMES_DE_TRANSICAO, ...FRAMES_INTRA_CENA]) {
    it(`frame ${String(frame)} (${onde}): nenhuma regiao de midia intersecta bloco de texto visivel`, () => {
      const html = renderizarProducao(frame);
      const violacoes = violacoesDeSobreposicaoDeMidia(
        parsearBlocos(html),
        parsearMidias(html),
        noParaCena,
      );
      expect(violacoes, `frame ${String(frame)}`).toStrictEqual([]);
    });
  }

  it("c-005 frame 580: a midia esta CONFINADA as proprias bandas (regiao declarada != quadro inteiro)", () => {
    const midias = parsearMidias(renderizarProducao(580));
    const video = midias.find((m) => m.noId === "n-006");
    const gif = midias.find((m) => m.noId === "n-007");
    expect(video, "n-006 com regiao").toBeDefined();
    expect(gif, "n-007 com regiao").toBeDefined();
    // Bandas de c-005 (4 nos de texto): video = banda 2 [297,540), gif =
    // banda 3 [540,783). A regiao tem a ALTURA DA BANDA — nunca 1080.
    expect(video!.altura).toBeLessThan(1080);
    expect(gif!.altura).toBeLessThan(1080);
    expect(video!.y).toBe(297);
    expect(gif!.y).toBe(540);
  });

  it("MUTACAO (o bug medido): midia com regiao de QUADRO INTEIRO cobre o texto e acende VERMELHO", () => {
    // O dado do revisor, medido no frame 580 ANTES da correcao: a midia
    // ocupava o quadro inteiro (inset: margem) e a regiao declarada do
    // texto n-014 era "1306,87,517,176" — zero pixels de texto. A funcao
    // de violacao tem de acender com exatamente esta assinatura.
    const blocos: BlocoDeTexto[] = [
      { noId: "n-014", tipo: "texto", x: 1306, y: 87, largura: 517, altura: 176, visibilidade: 1 },
      { noId: "n-006", tipo: "midia", x: 851, y: 438, largura: 218, altura: 78, visibilidade: 1 },
    ];
    const midias: MidiaNoFrame[] = [
      { noId: "n-006", tipoMidia: "video", x: 0, y: 0, largura: 1920, altura: 1080 },
      { noId: "n-007", tipoMidia: "gif", x: 0, y: 0, largura: 1920, altura: 1080 },
    ];
    const violacoes = violacoesDeSobreposicaoDeMidia(blocos, midias, noParaCena);
    expect(violacoes.length).toBeGreaterThan(0);
    expect(violacoes.join("\n")).toContain("n-014");
  });

  it("controle: com a midia na banda certa, a mesma funcao nao acusa (C2)", () => {
    const blocos: BlocoDeTexto[] = [
      { noId: "n-014", tipo: "texto", x: 1306, y: 87, largura: 517, altura: 176, visibilidade: 1 },
      { noId: "n-006", tipo: "midia", x: 851, y: 438, largura: 218, altura: 78, visibilidade: 1 },
    ];
    const midias: MidiaNoFrame[] = [
      { noId: "n-006", tipoMidia: "video", x: 0, y: 297, largura: 1920, altura: 243 },
    ];
    expect(violacoesDeSobreposicaoDeMidia(blocos, midias, noParaCena)).toStrictEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C5 — a ordem de pintura (midia primeiro na pilha)
// ---------------------------------------------------------------------------
describe("ordem de pintura (C5) — midia pinta ANTES de qualquer bloco de texto", () => {
  it("em toda cena do render, todo no de midia precede todo bloco de texto no DOM", () => {
    for (const [frame] of [...FRAMES_DE_TRANSICAO, ...FRAMES_INTRA_CENA]) {
      const html = renderizarProducao(frame);
      for (const segmento of segmentosDeCena(html)) {
        expect(
          violacoesDeOrdemDePinturaDoSegmento(segmento),
          `frame ${String(frame)}`,
        ).toStrictEqual([]);
      }
    }
  });

  it("MUTACAO (a ordem declarada da c-005, sem o sort): texto antes da midia acende VERMELHO", () => {
    // A c-005 declara [n-014, n-006, n-007, n-015] — exatamente a ordem
    // que escondia o texto antes do fix. O segmento montado a mao e o
    // que o pintor emitiria SEM o sort de pintura/cena.ts.
    const segmentoDoBug =
      '<div data-no="n-014" data-tipo="texto" data-bbox="1306,87,517,176" data-visibilidade="1"></div>' +
      '<div data-no="n-006" data-tipo="midia" data-frame="33"><div data-regiao-da-midia="0,297,1920,243" data-tipo-midia="video"></div></div>' +
      '<div data-no="n-007" data-tipo="midia" data-frame="18"><div data-regiao-da-midia="0,540,1920,243" data-tipo-midia="gif"></div></div>';
    const violacoes = violacoesDeOrdemDePinturaDoSegmento(segmentoDoBug);
    expect(violacoes.length).toBeGreaterThan(0);
    expect(violacoes.join("\n")).toContain("midia");
  });

  it("controle: midia primeiro no segmento, a mesma funcao nao acusa (C2)", () => {
    const segmentoCorreto =
      '<div data-no="n-006" data-tipo="midia" data-frame="33"><div data-regiao-da-midia="0,297,1920,243" data-tipo-midia="video"></div></div>' +
      '<div data-no="n-014" data-tipo="texto" data-bbox="1306,87,517,176" data-visibilidade="1"></div>';
    expect(
      violacoesDeOrdemDePinturaDoSegmento(segmentoCorreto),
    ).toStrictEqual([]);
  });
});

describe("geometria honesta do codigo (P3, fix da onda 2) — o <pre> desenha EXATAMENTE o data-bbox", () => {
  // A sonda le a caixa declarada (data-bbox) e a usa como a geometria do
  // que o no desenha. Se o pre esticasse na regiao (com o bbox centrado),
  // a caixa ficaria deslocada do texto real — o que a correcao proibe.
  it("n-008 (frame 350): o pre declara width/height iguais ao data-bbox", () => {
    const html = renderizarProducao(350);
    const bbox = /data-no="n-008"[^>]*?data-bbox="([^"]+)"/.exec(html)?.[1];
    expect(bbox, "n-008 tem data-bbox no frame 350").toBeDefined();
    const [x, y, largura, altura] = bbox!.split(",").map(Number);
    const pre = /<pre[^>]*style="([^"]+)"/.exec(html)?.[1];
    expect(pre, "o markup tem o <pre> do bloco").toBeDefined();
    const larguraDoPre = /width:([0-9.]+)px/.exec(pre!)?.[1];
    const alturaDoPre = /height:([0-9.]+)px/.exec(pre!)?.[1];
    expect(Number(larguraDoPre)).toBe(largura);
    expect(Number(alturaDoPre)).toBe(altura);
    // O pre NAO estica na regiao: a caixa e a do texto medido, centralizada.
    const regiao = /data-no="n-008"[^>]*?data-regiao="([^"]+)"/.exec(html)?.[1]!;
    const larguraDaRegiao = Number(regiao.split(",")[2]);
    expect(largura).toBeLessThan(larguraDaRegiao);
    expect(x).toBeGreaterThan(Number(regiao.split(",")[0]));
  });

  it("n-008 (frame 350): a caixa nao invade a regiao de nenhum irmao visivel (C1 valida a geometria honesta)", () => {
    const html = renderizarProducao(350);
    const blocos = parsearBlocos(html).filter((b) => b.visibilidade > LIMIAR_DE_VISIBILIDADE);
    const codigo = blocos.find((b) => b.noId === "n-008");
    expect(codigo).toBeDefined();
    for (const outro of blocos) {
      if (outro.noId === "n-008") continue;
      expect(
        seIntersectam(codigo!, outro),
        `frame 350: n-008 x ${outro.noId} (${outro.tipo})`,
      ).toBe(false);
    }
  });
});
