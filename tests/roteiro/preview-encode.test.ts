// =============================================================================
// COBERTURA do preview — os caminhos de erro de encodarH264 (F5-02)
// =============================================================================
//
// O preview so encoda com perfis DETERMINISTICOS do catalogo (AB-700) e,
// entre eles, o eixo libx264 (ADR-0036 decisao 8). Os tres modos de falha
// de `encodarH264` em preview.ts sao:
//
//   1. catalogo SEM nenhum perfil deterministico:true;
//   2. catalogo com deterministico:true mas sem libx264;
//   3. o encode caiu em FALLBACK declarado (o preview nunca aceita um
//      substituto silencioso — o mp4 tem de ser o perfil pedido).
//
// O catalogo e lido por `listarPerfis()` DENTRO de encodarH264 (sem
// injecao) — estes testes mockam o modulo `src/render/encode` com
// vi.mock, mantendo o resto real (vi.importActual). Arquivo isolado de
// proposito: o mock do modulo vale para o arquivo INTEIRO, e o
// preview.test.ts/preview-cobertura.test.ts usam o catalogo REAL.
// =============================================================================

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Pedaco, Roteiro } from "../../src/roteiro/contrato/contrato.js";
import { ErroPreviewRender, renderizarPreviewPedaco } from "../../src/roteiro/preview/preview.js";
import type { PerfilEncode } from "../../src/render/encode/formato.js";
import type { PerfilDescoberto } from "../../src/render/encode/descobrir.js";
import type { ContextoDoRender, RendererDeFrames } from "../../src/render/pipeline/executar.js";
import { Store } from "../../src/store/store.js";

const mocks = vi.hoisted(() => ({
  listarPerfis: vi.fn<() => Promise<PerfilDescoberto[]>>(),
  executarEncode: vi.fn(),
}));

vi.mock("../../src/render/encode/index.js", async (importActual) => {
  const real = await importActual<typeof import("../../src/render/encode/index.js")>();
  return {
    ...real,
    listarPerfis: mocks.listarPerfis,
    executarEncode: mocks.executarEncode,
  };
});

// ─── Helpers (o mesmo desenho do preview-cobertura.test.ts) ───────────────────

const RAIZ = join(__dirname, "..", "..");

function pedaco(parcial: Partial<Pedaco> & { tipo_visual: Pedaco["tipo_visual"] }): Pedaco {
  const indice = parcial.indice ?? 0;
  return {
    id: parcial.id ?? `p-${String(indice).padStart(3, "0")}`,
    indice,
    titulo: parcial.titulo ?? "Pedaco de teste",
    fala: parcial.fala ?? "",
    duracao_segundos: parcial.duracao_segundos ?? 2,
    tipo_visual: parcial.tipo_visual,
    especificacao_visual: parcial.especificacao_visual ?? "Conteudo de teste do pedaco",
    detalhes_de_producao: parcial.detalhes_de_producao ?? "Detalhes de producao",
    narracao: parcial.narracao ?? { texto: "", origem: "nenhuma", status: "vazio" },
    ...(parcial.anexo_hash !== undefined ? { anexo_hash: parcial.anexo_hash } : {}),
    ...(parcial.anexo_meta !== undefined ? { anexo_meta: parcial.anexo_meta } : {}),
  };
}

function roteiroDe(pedacos: readonly Pedaco[]): Roteiro {
  return {
    schema_version: "Roteiro.1",
    pedacos,
    duracao_total_segundos: pedacos.reduce((soma, p) => soma + p.duracao_segundos, 0),
  };
}

interface Ambiente {
  readonly raiz: string;
  readonly store: Store;
  readonly cacheRaiz: string;
  readonly previewsRaiz: string;
  readonly resolucaoRaiz: string;
}

function criarAmbiente(): Ambiente {
  const raiz = mkdtempSync(join(tmpdir(), "preview-enc-"));
  return {
    raiz,
    store: new Store({ root: join(raiz, "store") }),
    cacheRaiz: join(raiz, "cache"),
    previewsRaiz: join(raiz, "previews"),
    resolucaoRaiz: join(raiz, "resolucao"),
  };
}

function removerAmbiente(ambiente: Ambiente): void {
  rmSync(ambiente.raiz, { recursive: true, force: true });
}

function contextoFake(): ContextoDoRender {
  return {
    serveUrl: "file:///fake-serve",
    composicao: {
      id: "preview-pedaco",
      durationInFrames: 90,
      fps: 30,
      width: 1920,
      height: 1080,
      defaultProps: {},
      props: {},
    } as unknown as ContextoDoRender["composicao"],
  };
}

/** Renderer fake: um PNG 1920x1080 por frame (encode real depois). */
function rendererComPng(png: Buffer): RendererDeFrames {
  return (opcoes) => {
    const [inicio, fim] = opcoes.frameRange;
    for (let f = inicio; f <= fim; f++) {
      writeFileSync(join(opcoes.outputDir, `frame-${String(f)}.png`), png);
    }
    return Promise.resolve({ frameCount: fim - inicio + 1 });
  };
}

function gerarPngAzul(): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "preview-enc-png-"));
  const arquivo = join(dir, "cor.png");
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", "color=c=0x1E90FF:s=1920x1080:r=1",
        "-frames:v", "1",
        "-c:v", "png",
        "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
        arquivo,
      ],
      { timeout: 60_000 },
    );
    return readFileSync(arquivo);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function perfil(motor: string, deterministico: boolean): PerfilEncode {
  return {
    nome: `perfil-mock-${motor}-${String(deterministico)}`,
    motor: motor as PerfilEncode["motor"],
    codec: motor === "libx264" ? "libx264" : "h264_nvenc",
    deterministico,
    justificativaDeterminismo: "mock de teste — o catalogo real nao e tocado",
    alvoQualidade: { tipo: "crf", valor: 18 },
    preset: "medium",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

/** O shape real de listarPerfis: um perfil VALIDADO por arquivo descoberto. */
function perfilDescoberto(p: PerfilEncode): PerfilDescoberto {
  return { caminho: `/mock/perfis/${p.nome}.ts`, perfil: p };
}

// ─── Os testes ────────────────────────────────────────────────────────────────

describe("encodarH264 — caminhos de erro do catalogo (vi.mock do modulo)", () => {
  let pngAzul: Buffer;

  beforeAll(() => {
    pngAzul = gerarPngAzul();
  });

  const renderTexto = (ambiente: Ambiente) =>
    renderizarPreviewPedaco(
      roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]),
      0,
      {
        raizDoProjeto: RAIZ,
        store: ambiente.store,
        storeRaiz: join(ambiente.raiz, "store"),
        cacheRaiz: ambiente.cacheRaiz,
        previewsRaiz: ambiente.previewsRaiz,
        resolucaoRaiz: ambiente.resolucaoRaiz,
        renderer: rendererComPng(pngAzul),
        contexto: contextoFake(),
      },
    );

  it("catalogo SEM perfil deterministico:true = ErroPreviewRender (AB-700)", async () => {
    const ambiente = criarAmbiente();
    try {
      mocks.listarPerfis.mockResolvedValue([perfilDescoberto(perfil("nvenc", false))]);
      const erro = await renderTexto(ambiente)
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("nenhum perfil deterministico");
    } finally {
      removerAmbiente(ambiente);
    }
  }, 120_000);

  it("catalogo sem perfil libx264 deterministico = ErroPreviewRender (ADR-0036 dec. 8)", async () => {
    const ambiente = criarAmbiente();
    try {
      mocks.listarPerfis.mockResolvedValue([perfilDescoberto(perfil("nvenc", true))]);
      const erro = await renderTexto(ambiente)
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("nenhum perfil libx264 deterministico");
    } finally {
      removerAmbiente(ambiente);
    }
  }, 120_000);

  it("encode caiu em FALLBACK declarado = ErroPreviewRender (nunca substituto silencioso)", async () => {
    const ambiente = criarAmbiente();
    try {
      mocks.listarPerfis.mockResolvedValue([perfilDescoberto(perfil("libx264", true))]);
      mocks.executarEncode.mockResolvedValue({
        solicitado: perfil("libx264", true),
        perfil: perfil("nvenc", false),
        fallback: { ativo: true, solicitado: "libx264", motivo: "mock: driver ausente" },
        duracaoMs: 0,
      });
      const erro = await renderTexto(ambiente)
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("caiu em fallback");
      expect((erro as ErroPreviewRender).message).toContain("mock: driver ausente");
    } finally {
      removerAmbiente(ambiente);
    }
  }, 120_000);
});
