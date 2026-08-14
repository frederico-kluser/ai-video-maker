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

import type { AssetResolvido } from "../../../src/resolucao/manifesto-resolvido";
import type { FixtureIntegrada } from "../../../src/composicao/pintura/fiar";
import { fiarApadrao, pintar } from "../../../src/composicao/pintura/index";
import { calcularDuracao } from "../../../src/composicao/tempo";

const AQUI = resolve(import.meta.dirname);
const RAIZ = resolve(AQUI, "..", "..", "..");

// A chave do cassete canonico de grafico (onda 1, estagio v1.2.1): derivada
// do manifesto canonico + parametros do estagio — se o cassete for
// regravado com outra chave, esta leitura acha a nova (o cassete e a
// verdade, C12).
const CHAVE_DO_CASSETE_GRAFICO =
  "6d53c3865b6c1627eeafae927accf2cd316cf00b5351fe3d24753b773451fb47";

interface AssetDoCassete extends AssetResolvido {
  duracaoSegundos?: number;
}

function fixtureDosWebmDeMatematica(): FixtureIntegrada {
  const resultado = JSON.parse(
    readFileSync(
      resolve(
        RAIZ,
        "fixtures",
        "cassetes",
        "grafico",
        CHAVE_DO_CASSETE_GRAFICO,
        "resultado.json",
      ),
      "utf8",
    ),
  ) as { assets: Record<string, AssetDoCassete>; nos_grafico: Record<string, string> };
  const manifesto = JSON.parse(
    readFileSync(resolve(RAIZ, "fixtures", "canonico", "manifesto-valido.json"), "utf8"),
  ) as FixtureIntegrada["manifesto"];

  const assets: Record<string, AssetResolvido> = {};
  for (const [hash, asset] of Object.entries(resultado.assets)) {
    const { duracaoSegundos: _duracao, ...semDuracao } = asset;
    assets[hash] = semDuracao;
  }

  return {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: "a0ae9cdd0e99d3f62bd8aecce8246e1dcfebfa56be0099854ea6fd479cb27158",
    manifesto,
    assets,
    nos_grafico: { ...resultado.nos_grafico },
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

const TIPOS_DE_TEXTO = new Set(["texto", "lista", "cabecalho", "codigo"]);

function parsearBlocos(html: string): BlocoDeTexto[] {
  const blocos: BlocoDeTexto[] = [];
  const re =
    /<div data-no="([^"]+)" data-tipo="(texto|lista|cabecalho|codigo)"[^>]*?data-bbox="([^"]+)"[^>]*?data-visibilidade="([^"]+)"/g;
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

function seIntersectam(a: BlocoDeTexto, b: BlocoDeTexto): boolean {
  return (
    a.x < b.x + b.largura &&
    b.x < a.x + a.largura &&
    a.y < b.y + b.altura &&
    b.y < a.y + a.altura
  );
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
