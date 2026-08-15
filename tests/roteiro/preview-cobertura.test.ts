// =============================================================================
// COBERTURA do preview de pedaco — os gaps do preview.test.ts (Onda 4)
// =============================================================================
//
// O preview.test.ts cobre FQ-P1..P4, audio e o CLI feliz/erro-de-entrada.
// Este arquivo fecha os GAPS de cobertura daquele arquivo:
//
//   G1 — pedacoSemAnexoIrrelevante / manifestoReduzidoDoPedaco (unidades
//        puras, diretas) e indice fora do range (ErroContratoRoteiro).
//   G2 — visual nao produzivel: bytes do anexo que NAO rehasheiam (store
//        corrompido), pedaco video com anexo real, anexo webm, anexo com
//        tipo FORA da allowlist (falha o contrato, nunca pinta).
//   G3 — memo da resolucao manim sob CORRUPCAO: JSON invalido, bytes
//        ausentes do store, bytes que nao rehasheiam, nos_grafico vazio —
//        todos MISS (o motor roda de novo, nunca reusa bytes errados).
//   G4 — estagio grafico que FALHA em cada etapa (erro generico, asset
//        sem idNoProvedor, webm ausente, webm zero bytes, bytes
//        divergentes — que nunca entram no store, partial_movie_files
//        ignorado na descoberta).
//   G5 — audio: gravacao com bytes ausentes do store / bytes que nao
//        rehasheiam (ErroPreviewRender, fail-closed).
//   G6 — render/encode/mux falhos com executores injetados: renderer que
//        lanca (worker morto), render parcial (frameCount errado), frames
//        ausentes (ErroDeFrameAusente), ffmpeg qtrle que falha, qtrle que
//        "sucede" sem escrever bytes (C1), mux que falha, ffprobe que
//        falha na conferencia.
//   G7 — conferirArquivoDoPreview com executor FAKE (ffprobe por stream
//        C4): arquivo ausente/zero bytes, zero streams, so audio, codec
//        errado, dimensoes erradas, fps errado, avg_frame_rate indefinido,
//        duracao indefinida, oraculo de conteudo (C1) aprovando/reprovando
//        — e conferirPreview com arquivo REAL de dimensao errada e com
//        hash que nao casa o conteudo (C7).
//   G8 — CLI D11: stdin malformado, stdin vazio, indice fora do range com
//        detalhes no envelope, ROTEIRO_ESTADO_PATH por env, --estado com
//        caminho invalido (best-effort), duracao-abaixo-de-1-frame = exit
//        2 duracao-insuficiente (classe 400/409 — FIX onda 6; antes caia
//        em falha-interna/500) e exit 1 INTERNO real (render com audio
//        ausente do store).
//   G9 — borda: pedaco com duracao minima (0.5s — o piso do amostrador),
//        1 frame (0.02s — duracao abaixo do piso = ErroPreviewVazio
//        NOMEANDO o piso, FIX onda 6; antes o veredito era o falso
//        "quase chapado"), abaixo de 1 frame (ErroDuracaoInsuficiente) e
//        pedaco alvo com indice > 0 em roteiro de multiplos pedacos
//        (normalizacao p-000/indice 0 — FIX onda 6).
//
// Todos os testes de render usam renderer FAKE + contexto FAKE (sem
// navegador — o guarda de rede bloqueia loopback em processo); os CLIs
// usam SUBPROCESSO real (o guarda nao alcanca filho — anti-C2).
// =============================================================================

import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Pedaco, Roteiro } from "../../src/roteiro/contrato/contrato.js";
import { ErroContratoRoteiro } from "../../src/roteiro/contrato/rejeitar.js";
import { REGRA_ANEXO_TIPO } from "../../src/roteiro/contrato/validar.js";
import { ErroDuracaoInsuficiente } from "../../src/roteiro/construir/construir.js";
import { executarPreview } from "../../src/roteiro/preview/cli.js";
import {
  conferirArquivoDoPreview,
  conferirPreview,
  ErroPreviewFormatoDivergente,
  ErroPreviewManimIndisponivel,
  ErroPreviewRender,
  ErroPreviewVazio,
  ErroPreviewVisualNaoProduzivel,
  manifestoReduzidoDoPedaco,
  pedacoSemAnexoIrrelevante,
  renderizarPreviewPedaco,
  type ConferenciaDoPreview,
  type OpcoesDoPreview,
} from "../../src/roteiro/preview/preview.js";
import type { JobDeRender, ResultadoDeRender } from "../../src/resolucao/grafico/executor.js";
import type { ContextoDoRender, RendererDeFrames } from "../../src/render/pipeline/executar.js";
import type { ExecutorBruto, ExecutorDeComando } from "../../src/pipeline/produzir.js";
import { Store } from "../../src/store/store.js";

const RAIZ = join(__dirname, "..", "..");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const CAMINHO_CLI = join(RAIZ, "src", "roteiro", "preview", "cli.ts");
const HASH_ANEXO_GIF = "9d7cc2b731dde14beafe804f1f52b0d3fd1c9991da9561a1b250e1ae6cbd6dd4";

// ─── Helpers de roteiro (mesma convencao do preview.test.ts) ─────────────────

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

const ANEXO_GIF = {
  anexo_hash: HASH_ANEXO_GIF,
  anexo_meta: { tipo: "image/gif" as const, tamanho_bytes: 98320, nome_original: "anexo.gif" },
};

// ─── Ambiente de teste ────────────────────────────────────────────────────────

interface Ambiente {
  readonly raiz: string;
  readonly store: Store;
  readonly storeRaiz: string;
  readonly cacheRaiz: string;
  readonly previewsRaiz: string;
  readonly resolucaoRaiz: string;
}

function criarAmbiente(): Ambiente {
  const raiz = mkdtempSync(join(tmpdir(), "preview-cob-"));
  return {
    raiz,
    store: new Store({ root: join(raiz, "store") }),
    storeRaiz: join(raiz, "store"),
    cacheRaiz: join(raiz, "cache"),
    previewsRaiz: join(raiz, "previews"),
    resolucaoRaiz: join(raiz, "resolucao"),
  };
}

function removerAmbiente(ambiente: Ambiente): void {
  rmSync(ambiente.raiz, { recursive: true, force: true });
}

function opcoesDe(ambiente: Ambiente, extras: OpcoesDoPreview = {}): OpcoesDoPreview {
  return {
    raizDoProjeto: RAIZ,
    store: ambiente.store,
    storeRaiz: ambiente.storeRaiz,
    cacheRaiz: ambiente.cacheRaiz,
    previewsRaiz: ambiente.previewsRaiz,
    resolucaoRaiz: ambiente.resolucaoRaiz,
    ...extras,
  };
}

// ─── Renderer fake + contexto fake ────────────────────────────────────────────

function gerarPng(hex: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "preview-cob-png-"));
  const arquivo = join(dir, "cor.png");
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", `color=c=${hex}:s=1920x1080:r=1`,
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

function gerarWebmDeTeste(variante: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "preview-cob-webm-"));
  const arquivo = join(dir, "cena.webm");
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", `testsrc=size=320x240:rate=10:${variante}`,
        "-t", "1",
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-row-mt", "0",
        "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
        arquivo,
      ],
      { timeout: 120_000 },
    );
    return readFileSync(arquivo);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function rendererComPng(png: Buffer, contador?: { chamadas: number }): RendererDeFrames {
  return (opcoes) => {
    if (contador !== undefined) contador.chamadas++;
    const [inicio, fim] = opcoes.frameRange;
    for (let f = inicio; f <= fim; f++) {
      writeFileSync(join(opcoes.outputDir, `frame-${String(f)}.png`), png);
    }
    return Promise.resolve({ frameCount: fim - inicio + 1 });
  };
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

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ─── Executor manim fake (com controle por teste) ────────────────────────────

/**
 * O executor manim fake do preview.test.ts, parametrizado: os testes de
 * falha de etapa passam um `parcial` (ResultadoDeRender) e/ou um
 * `aoRenderizar` (efeito colateral: escrever (ou nao) os arquivos do
 * layout real do runner: media/videos/<cena>/<altura>p<fps>/<cena>.webm).
 */
function executorManimDe(
  parcial?: Partial<ResultadoDeRender>,
  aoRenderizar?: (job: JobDeRender) => void,
): { executor: { renderizar(job: JobDeRender): Promise<ResultadoDeRender> }; chamadas: { chamadas: number } } {
  const contador = { chamadas: 0 };
  return {
    chamadas: contador,
    executor: {
      renderizar: async (job: JobDeRender): Promise<ResultadoDeRender> => {
        contador.chamadas++;
        if (aoRenderizar !== undefined) aoRenderizar(job);
        return {
          hash: "0".repeat(64),
          bytes: 1,
          largura: 320,
          altura: 240,
          framesDeclarados: 10,
          framesInspecionados: 10,
          framesChapados: 0,
          nomeCena: "CenaFake",
          correcoes: [],
          ferramenta: "manim 0.20.1 (mock de teste)",
          muxer: "Lavf62.12.102",
          ...parcial,
        };
      },
    },
  };
}

/** Escreve o webm no layout real do runner dentro do diretorio do job. */
function escreverWebmDoJob(job: JobDeRender, nomeCena: string, bytes: Buffer): void {
  const dir = join(job.diretorioTrabalho, "media", "videos", "cena", "1080p30");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${nomeCena}.webm`), bytes);
}

// ─── Executor de comando delegante (falha onde o teste manda) ────────────────

function executorDeleganteQue(falhar: (args: readonly string[]) => boolean): ExecutorDeComando {
  return (comando, args) =>
    new Promise((resolve2, reject) => {
      if (falhar(args)) {
        reject(new Error(`${comando} (mock de teste) falhou em ${String(args.slice(0, 6))}`));
        return;
      }
      execFile(comando, args, { timeout: 300_000, maxBuffer: 64 * 1024 * 1024 }, (erro, stdout, stderr) => {
        if (erro) {
          reject(new Error(`${comando} ${String(args.slice(0, 6))}\n${String(erro)}\n${String(stderr)}`));
          return;
        }
        resolve2({ stdout: String(stdout), stderr: String(stderr) });
      });
    });
}

// ─── Achar o memo da resolucao (glob recursivo por resultado.json) ───────────

function acharMemoResultado(resolucaoRaiz: string): string {
  function varre(dir: string): string | null {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        const achado = varre(caminho);
        if (achado !== null) return achado;
      } else if (entrada.name === "resultado.json") {
        return caminho;
      }
    }
    return null;
  }
  const achado = varre(resolucaoRaiz);
  if (achado === null) {
    throw new Error(`nenhum resultado.json em ${resolucaoRaiz} — o memo nao foi escrito`);
  }
  return achado;
}

// ─── CLI (processo real) com entrada BRUTA ────────────────────────────────────

interface ResultadoDoCli {
  status: number;
  stdout: string;
  stderr: string;
}

function rodarCliBruto(
  entradaBruta: string,
  extras: { flags?: string[]; env?: Record<string, string> } = {},
): ResultadoDoCli {
  try {
    const stdout = execFileSync(BIN_TSX, [CAMINHO_CLI, ...(extras.flags ?? [])], {
      input: entradaBruta,
      encoding: "utf-8",
      timeout: 300_000,
      ...(extras.env !== undefined ? { env: { ...process.env, ...extras.env } } : {}),
    });
    return { status: 0, stdout, stderr: "" };
  } catch (erro) {
    const e = erro as { status?: number; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

// =============================================================================
// G1 — unidades puras: pedacoSemAnexoIrrelevante e manifestoReduzidoDoPedaco
// =============================================================================

describe("G1 — helpers puros do preview", () => {
  it("pedacoSemAnexoIrrelevante: gif/video passam INTACTOS (anexo participa do visual)", () => {
    const comAnexo = pedaco({ tipo_visual: "gif", ...ANEXO_GIF });
    expect(pedacoSemAnexoIrrelevante(comAnexo)).toBe(comAnexo);
    const video = pedaco({ tipo_visual: "video", ...ANEXO_GIF });
    expect(pedacoSemAnexoIrrelevante(video)).toBe(video);
  });

  it("pedacoSemAnexoIrrelevante: texto/lista/cabecalho sem anexo passam intactos", () => {
    for (const tipo of ["texto", "lista", "cabecalho"] as const) {
      const semAnexo = pedaco({ tipo_visual: tipo });
      expect(pedacoSemAnexoIrrelevante(semAnexo)).toBe(semAnexo);
    }
  });

  it("pedacoSemAnexoIrrelevante: anexo e REMOVIDO do texto (estado transitorio) — deterministico", () => {
    const comAnexo = pedaco({ tipo_visual: "texto", ...ANEXO_GIF });
    const semAnexo = pedacoSemAnexoIrrelevante(comAnexo);
    expect(semAnexo).not.toBe(comAnexo);
    expect(semAnexo.anexo_hash).toBeUndefined();
    expect(semAnexo.anexo_meta).toBeUndefined();
    expect(semAnexo.id).toBe(comAnexo.id);
    expect(semAnexo.titulo).toBe(comAnexo.titulo);
    expect(semAnexo.especificacao_visual).toBe(comAnexo.especificacao_visual);
    // Determinismo: mesmo pedaco, mesmo resultado, byte a byte.
    expect(JSON.stringify(pedacoSemAnexoIrrelevante(comAnexo))).toBe(JSON.stringify(semAnexo));
  });

  it("manifestoReduzidoDoPedaco: reduz a 1 cena com a duracao do proprio pedaco (FQ-M3)", () => {
    const pedacoAlvo = pedaco({ tipo_visual: "texto", duracao_segundos: 2.5 });
    const manifesto = manifestoReduzidoDoPedaco(roteiroDe([pedacoAlvo]), 0);
    expect(manifesto.cenas).toHaveLength(1);
    expect(manifesto.cenas[0]!.nos).toHaveLength(1);
    // 2.5s * 30fps = 75 frames; o total do manifesto reduzido e o do pedaco.
    expect(manifesto.duracao_total_frames).toBe(75);
    // Determinismo: duas reducoes do mesmo roteiro = mesmo manifesto.
    const deNovo = manifestoReduzidoDoPedaco(roteiroDe([pedacoAlvo]), 0);
    expect(JSON.stringify(deNovo)).toBe(JSON.stringify(manifesto));
  });

  it("manifestoReduzidoDoPedaco: indice fora do range = ErroContratoRoteiro nomeado", () => {
    const roteiro = roteiroDe([pedaco({ tipo_visual: "texto" })]);
    expect(() => manifestoReduzidoDoPedaco(roteiro, 3)).toThrow(ErroContratoRoteiro);
    expect(() => manifestoReduzidoDoPedaco(roteiro, -1)).toThrow(ErroContratoRoteiro);
  });

  it(
    "manifestoReduzidoDoPedaco: pedaco alvo com indice > 0 em roteiro de MULTIPLOS pedacos e NORMALIZADO para p-000/indice 0 (FIX onda 6)",
    () => {
      // O pedaco alvo carrega id/indice ORIGINAIS (p-001/1 na posicao 0 do
      // roteiro reduzido) — sem a normalizacao, as regras
      // indices-nao-contiguos e id-nao-casa-indice rejeitariam o roteiro
      // de um pedaco so (o bug latente que so aparecia com indice > 0).
      const roteiro = roteiroDe([
        pedaco({ indice: 0, tipo_visual: "texto", duracao_segundos: 2 }),
        pedaco({ indice: 1, tipo_visual: "texto", duracao_segundos: 3 }),
        pedaco({ indice: 2, tipo_visual: "texto", duracao_segundos: 1 }),
      ]);
      const manifesto = manifestoReduzidoDoPedaco(roteiro, 1);
      expect(manifesto.cenas).toHaveLength(1);
      expect(manifesto.cenas[0]!.nos).toHaveLength(1);
      // A duracao do manifesto reduzido e a do pedaco ALVO (3s * 30fps).
      expect(manifesto.duracao_total_frames).toBe(90);
      // O pedaco do roteiro ORIGINAL nao foi mutado (clone, nunca in-place).
      expect(roteiro.pedacos[1]!.id).toBe("p-001");
      expect(roteiro.pedacos[1]!.indice).toBe(1);
      // Determinismo: a mesma reducao 2x = o mesmo manifesto.
      expect(JSON.stringify(manifestoReduzidoDoPedaco(roteiro, 1))).toBe(JSON.stringify(manifesto));
    },
  );

  it("renderizarPreviewPedaco: opcoes divergentes do FORMATO_VIDEO = ErroPreviewFormatoDivergente (nunca render fora do formato congelado)", async () => {
    const ambiente = criarAmbiente();
    try {
      // 640x360 passaria no render e seria rejeitado DEPOIS pela conferencia
      // do servidor (conferirPreview revalida com o FORMATO_VIDEO fixo) e
      // pelo juntar — a divergencia e erro na porta, nunca override.
      const erro = await renderizarPreviewPedaco(
        roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]),
        0,
        opcoesDe(ambiente, { opcoesDeConstrucao: { width: 640, height: 360 } }),
      )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewFormatoDivergente);
      expect(String(erro)).toContain("formato congelado");
      expect(String(erro)).toContain("640");
      // fps divergente tambem e recusado (o formato e o contrato inteiro).
      const erro60 = await renderizarPreviewPedaco(
        roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]),
        0,
        opcoesDe(ambiente, { opcoesDeConstrucao: { fps: 60 } }),
      )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro60).toBeInstanceOf(ErroPreviewFormatoDivergente);
      expect(String(erro60)).toContain("60");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("renderizarPreviewPedaco: indice fora do range = ErroContratoRoteiro (fail-closed)", async () => {
    const ambiente = criarAmbiente();
    try {
      const roteiro = roteiroDe([pedaco({ tipo_visual: "texto" })]);
      const erro = await renderizarPreviewPedaco(roteiro, 5, opcoesDe(ambiente))
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroContratoRoteiro);
      expect(String(erro)).toContain("nao existe");
    } finally {
      removerAmbiente(ambiente);
    }
  });
});

// =============================================================================
// G2 — visual nao produzivel: store corrompido e anexos reais
// =============================================================================

describe("G2 — store corrompido e anexos reais", () => {
  let pngAzul: Buffer;

  beforeAll(() => {
    pngAzul = gerarPng("0x1E90FF");
  });

  it("anexo cujos bytes NAO rehasheiam para o hash declarado = erro nomeado (store corrompido)", async () => {
    const ambiente = criarAmbiente();
    try {
      // Bytes errados gravados sob o caminho do hash declarado (o store e
      // append-only por hash — corromper e escrever por fora).
      const caminhoDoAnexo = ambiente.store.hashPath(HASH_ANEXO_GIF);
      mkdirSync(dirname(caminhoDoAnexo), { recursive: true });
      writeFileSync(caminhoDoAnexo, Buffer.from("bytes errados"));
      const roteiro = roteiroDe([
        pedaco({ tipo_visual: "gif", duracao_segundos: 2, ...ANEXO_GIF }),
      ]);
      const erro = await renderizarPreviewPedaco(roteiro, 0, opcoesDe(ambiente))
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewVisualNaoProduzivel);
      expect((erro as ErroPreviewVisualNaoProduzivel).message).toContain("nao rehasheiam");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("pedaco video com anexo REAL (mp4) no store renderiza (camada de midia)", async () => {
    const ambiente = criarAmbiente();
    try {
      const bytes = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "anexo.mp4"));
      const hash = sha256(bytes);
      await ambiente.store.put(bytes, {
        license: "uso-pessoal-ADR-0003",
        attributionRequired: false,
        source: "manual",
        acquiredAt: new Date(0).toISOString(),
      });
      const roteiro = roteiroDe([
        pedaco({
          tipo_visual: "video",
          duracao_segundos: 2,
          anexo_hash: hash,
          anexo_meta: { tipo: "video/mp4", tamanho_bytes: bytes.length, nome_original: "anexo.mp4" },
        }),
      ]);
      const resultado = await renderizarPreviewPedaco(
        roteiro,
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      expect(resultado.hash.length).toBe(64);
      const conferencia = await conferirPreview(resultado.hash, { previewsRaiz: ambiente.previewsRaiz });
      expect(conferencia.codecVideo).toBe("h264");
    } finally {
      removerAmbiente(ambiente);
    }
  }, 120_000);

  it("anexo webm (video/webm — o outro tipo da allowlist) renderiza", async () => {
    const ambiente = criarAmbiente();
    try {
      const bytes = gerarWebmDeTeste("decimals=6");
      const hash = sha256(bytes);
      await ambiente.store.put(bytes, {
        license: "uso-pessoal-ADR-0003",
        attributionRequired: false,
        source: "manual",
        acquiredAt: new Date(0).toISOString(),
      });
      const roteiro = roteiroDe([
        pedaco({
          tipo_visual: "video",
          duracao_segundos: 2,
          anexo_hash: hash,
          anexo_meta: { tipo: "video/webm", tamanho_bytes: bytes.length, nome_original: "cena.webm" },
        }),
      ]);
      const resultado = await renderizarPreviewPedaco(
        roteiro,
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      expect(resultado.hash.length).toBe(64);
    } finally {
      removerAmbiente(ambiente);
    }
  }, 120_000);

  it("anexo com tipo FORA da allowlist = ErroContratoRoteiro (nunca pinta bytes sem tipo valido)", async () => {
    const ambiente = criarAmbiente();
    try {
      const bytes = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "anexo.gif"));
      await ambiente.store.put(bytes, {
        license: "uso-pessoal-ADR-0003",
        attributionRequired: false,
        source: "manual",
        acquiredAt: new Date(0).toISOString(),
      });
      // image/png esta FORA da allowlist fechada do contrato (o tipo do
      // anexo so pode ser image/gif | video/mp4 | video/webm) — o cast e
      // so para o teste conseguir montar o estado invalido.
      const roteiro = roteiroDe([
        pedaco({
          tipo_visual: "gif",
          duracao_segundos: 2,
          anexo_hash: HASH_ANEXO_GIF,
          anexo_meta: {
            tipo: "image/png",
            tamanho_bytes: 98320,
            nome_original: "anexo.png",
          } as unknown as Pedaco["anexo_meta"],
        }),
      ]);
      const erro = await renderizarPreviewPedaco(roteiro, 0, opcoesDe(ambiente))
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroContratoRoteiro);
      expect(String(erro)).toContain(REGRA_ANEXO_TIPO);
    } finally {
      removerAmbiente(ambiente);
    }
  });
});

// =============================================================================
// G3 — memo da resolucao manim sob corrupcao: tudo vira MISS
// =============================================================================

describe("G3 — memo da resolucao: corrupcao nunca e reuso de bytes errados", () => {
  let pngAzul: Buffer;
  let webmDeTeste: Buffer;
  let webmDeTeste2: Buffer;
  let pedacoManim: Pedaco;

  beforeAll(() => {
    pngAzul = gerarPng("0x1E90FF");
    webmDeTeste = gerarWebmDeTeste("decimals=2");
    webmDeTeste2 = gerarWebmDeTeste("decimals=4");
    pedacoManim = pedaco({
      tipo_visual: "manim",
      duracao_segundos: 2,
      especificacao_visual: "Animacao estilo 3b1b: soma de riemann",
    });
  });

  it(
    "memo invalido/divergente = MISS: o motor roda de novo em cada caso (sonda: chamadas)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        // Webms DISTINTOS por chamada: um acerto indevido do memo nunca
        // seria confundido com o motor rodando de novo (anti-C2).
        const fake = executorManimDe(undefined, (job) =>
          escreverWebmDoJob(job, "CenaFake", webmDeTeste),
        );
        const contador = fake.chamadas;
        // A rotacao de webms precisa de DOIS bytes distintos: o executor
        // fake acima escreve sempre o mesmo — usar o fake do preview.test.ts
        // com rotacao.
        const rota = [webmDeTeste, webmDeTeste2];
        let proximo = 0;
        const executorComRotacao = {
          renderizar: async (job: JobDeRender): Promise<ResultadoDeRender> => {
            contador.chamadas++;
            const webm = rota[proximo % rota.length]!;
            proximo++;
            escreverWebmDoJob(job, "CenaFake", webm);
            return {
              hash: sha256(webm),
              bytes: webm.length,
              largura: 320,
              altura: 240,
              framesDeclarados: 10,
              framesInspecionados: 10,
              framesChapados: 0,
              nomeCena: "CenaFake",
              correcoes: [],
              ferramenta: "manim 0.20.1 (mock de teste)",
              muxer: "Lavf62.12.102",
            };
          },
        };

        const render = () =>
          renderizarPreviewPedaco(
            roteiroDe([pedacoManim]),
            0,
            opcoesDe(ambiente, {
              executorManim: executorComRotacao,
              renderer: rendererComPng(pngAzul),
              contexto: contextoFake(),
            }),
          );

        // Base: 1a execucao = miss -> o motor roda.
        await render();
        expect(contador.chamadas).toBe(1);

        const memoArquivo = acharMemoResultado(ambiente.resolucaoRaiz);
        const hashDoWebmAtual = (): string => {
          const memo = JSON.parse(readFileSync(memoArquivo, "utf-8")) as {
            nos_grafico: Record<string, string>;
          };
          const hash = Object.values(memo.nos_grafico)[0];
          if (hash === undefined) throw new Error("memo sem nos_grafico");
          return hash;
        };

        // Passo 1: memo com JSON INVALIDO = miss (catch -> re-render).
        writeFileSync(memoArquivo, "{isso-nao-e-json-valido");
        await render();
        expect(contador.chamadas).toBe(2);

        // Passo 2: memo valido mas os BYTES do webm sumiram do store = miss.
        const hash1 = hashDoWebmAtual();
        rmSync(ambiente.store.hashPath(hash1), { force: true });
        await render();
        expect(contador.chamadas).toBe(3);

        // Passo 3: memo valido mas os bytes NAO rehasheiam = miss.
        const hash2 = hashDoWebmAtual();
        writeFileSync(ambiente.store.hashPath(hash2), Buffer.from("bytes corrompidos"));
        await render();
        expect(contador.chamadas).toBe(4);

        // Passo 4: memo sem nos_grafico (hash indefinido) = miss.
        writeFileSync(memoArquivo, JSON.stringify({ nos_grafico: {}, assets: {} }));
        await render();
        expect(contador.chamadas).toBe(5);

        // Sonda negativa anti-C2 do grupo: um pedaco manim DIFERENTE (outra
        // chave do cassete) tambem e miss — o contador nao esta preso.
        await renderizarPreviewPedaco(
          roteiroDe([
            pedaco({
              tipo_visual: "manim",
              duracao_segundos: 2,
              especificacao_visual: "Animacao estilo 3b1b: identidade de euler",
            }),
          ]),
          0,
          opcoesDe(ambiente, {
            executorManim: executorComRotacao,
            renderer: rendererComPng(pngAzul),
            contexto: contextoFake(),
          }),
        );
        expect(contador.chamadas).toBe(6);
      } finally {
        removerAmbiente(ambiente);
      }
    },
    300_000,
  );
});

// =============================================================================
// G4 — estagio grafico que falha em cada etapa (nunca quadro preto, C1)
// =============================================================================

describe("G4 — falhas do estagio grafico (mock do executor)", () => {
  let pngAzul: Buffer;
  let webmDeTeste: Buffer;

  beforeAll(() => {
    pngAzul = gerarPng("0x1E90FF");
    webmDeTeste = gerarWebmDeTeste("decimals=8");
  });

  const renderManim = (ambiente: Ambiente, executor: { renderizar(job: JobDeRender): Promise<ResultadoDeRender> }) =>
    renderizarPreviewPedaco(
      roteiroDe([pedaco({ tipo_visual: "manim", duracao_segundos: 2 })]),
      0,
      opcoesDe(ambiente, { executorManim: executor, renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
    );

  it("motor lanca erro GENERICO (nao EMotorGraficoAusente) = ErroPreviewRender", async () => {
    const ambiente = criarAmbiente();
    try {
      const erro = await renderManim(ambiente, {
        renderizar: async () => {
          throw new Error("runner quebrou (mock)");
        },
      })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("o estagio grafico falhou");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("asset sem idNoProvedor (nomeCena ausente) = ErroPreviewRender — nao da para descobrir o webm", async () => {
    const ambiente = criarAmbiente();
    try {
      const fake = executorManimDe({ nomeCena: undefined });
      const erro = await renderManim(ambiente, fake.executor)
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("sem idNoProvedor");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("motor que nao produziu o webm declarado = ErroPreviewRender (C1: render sem arquivo e erro)", async () => {
    const ambiente = criarAmbiente();
    try {
      const fake = executorManimDe({ nomeCena: "CenaFantasma" });
      const erro = await renderManim(ambiente, fake.executor)
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("nao produziu CenaFantasma.webm");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("webm com ZERO bytes = ErroPreviewRender (exit 0 de render nao prova imagem)", async () => {
    const ambiente = criarAmbiente();
    try {
      const fake = executorManimDe(
        { hash: sha256(Buffer.alloc(0)) },
        (job) => escreverWebmDoJob(job, "CenaFake", Buffer.alloc(0)),
      );
      const erro = await renderManim(ambiente, fake.executor)
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("zero bytes");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("bytes DIVERGENTES do hash declarado nunca entram no store", async () => {
    const ambiente = criarAmbiente();
    try {
      const fake = executorManimDe(
        { hash: "0".repeat(64) }, // declara um hash que os bytes nao rehasheiam
        (job) => escreverWebmDoJob(job, "CenaFake", webmDeTeste),
      );
      const erro = await renderManim(ambiente, fake.executor)
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("divergente do hash declarado");
      // Sonda negativa: o store NAO ganhou o asset com os bytes reais do webm.
      expect(await ambiente.store.get(sha256(webmDeTeste))).toBeNull();
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it(
    "partial_movie_files e IGNORADO na descoberta: so o webm do layout real vale",
    async () => {
      const ambiente = criarAmbiente();
      try {
        // Um webm LIXO em partial_movie_files com o MESMO nome da cena: se
        // a descoberta nao pular o diretorio, os bytes nao rehasheiam e o
        // render falha — o teste so passa se o pulo funcionar.
        const fake = executorManimDe(
          { hash: sha256(webmDeTeste) },
          (job) => {
            const parcialDir = join(job.diretorioTrabalho, "media", "partial_movie_files");
            mkdirSync(parcialDir, { recursive: true });
            writeFileSync(join(parcialDir, "CenaFake.webm"), Buffer.from("lixo parcial"));
            escreverWebmDoJob(job, "CenaFake", webmDeTeste);
          },
        );
        const resultado = await renderManim(ambiente, fake.executor);
        expect(resultado.hash.length).toBe(64);
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );
});

// =============================================================================
// G5 — audio do pedaco: bytes ausentes / divergentes (fail-closed)
// =============================================================================

describe("G5 — audio gravado: store ausente ou corrompido", () => {
  let pngAzul: Buffer;
  let wav: Buffer;

  beforeAll(() => {
    pngAzul = gerarPng("0x1E90FF");
    const dir = mkdtempSync(join(tmpdir(), "preview-cob-wav-"));
    const arquivo = join(dir, "voz.wav");
    try {
      execFileSync(
        "ffmpeg",
        [
          "-y", "-hide_banner", "-loglevel", "error",
          "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
          "-ar", "48000", "-ac", "2",
          "-c:a", "pcm_s16le",
          "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
          arquivo,
        ],
        { timeout: 60_000 },
      );
      wav = readFileSync(arquivo);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const roteiroGravado = (hashAudio: string): Roteiro =>
    roteiroDe([
      pedaco({
        tipo_visual: "texto",
        duracao_segundos: 2,
        fala: "A narracao gravada do pedaco",
        narracao: { texto: "A narracao gravada do pedaco", origem: "gravacao", hash_audio: hashAudio, status: "gerado" },
      }),
    ]);

  it("audio gravado declarado SEM bytes no store = ErroPreviewRender (nunca mudo)", async () => {
    const ambiente = criarAmbiente();
    try {
      const hash = sha256(wav); // nunca foi feito put
      const erro = await renderizarPreviewPedaco(
        roteiroGravado(hash),
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("ausente do store");
    } finally {
      removerAmbiente(ambiente);
    }
  }, 120_000);

  it("audio gravado cujos bytes NAO rehasheiam = ErroPreviewRender (fail-closed)", async () => {
    const ambiente = criarAmbiente();
    try {
      const hash = sha256(wav);
      // Bytes divergentes gravados por fora, sob o caminho do hash.
      const caminhoDoAudio = ambiente.store.hashPath(hash);
      mkdirSync(dirname(caminhoDoAudio), { recursive: true });
      writeFileSync(caminhoDoAudio, Buffer.from("audio corrompido"));
      const erro = await renderizarPreviewPedaco(
        roteiroGravado(hash),
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("nao rehasheiam");
    } finally {
      removerAmbiente(ambiente);
    }
  }, 120_000);
});

// =============================================================================
// G6 — render/encode/mux falhos com executores injetados
// =============================================================================

describe("G6 — render/encode/mux falhos (worker morto propaga)", () => {
  let pngAzul: Buffer;

  beforeAll(() => {
    pngAzul = gerarPng("0x1E90FF");
  });

  const renderTexto = (ambiente: Ambiente, extras: OpcoesDoPreview = {}) =>
    renderizarPreviewPedaco(
      roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]),
      0,
      opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake(), ...extras }),
    );

  it("renderer que LANCA (worker morto) = ErroPreviewRender — o cache quente nao mascara", async () => {
    const ambiente = criarAmbiente();
    try {
      const renderer: RendererDeFrames = async () => {
        throw new Error("worker morto (mock)");
      };
      const erro = await renderTexto(ambiente, { renderer })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("o render do pedaco falhou");
      expect((erro as ErroPreviewRender).message).toContain("worker morto");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("renderer que entrega MENOS frames que a faixa (render parcial) = ErroPreviewRender", async () => {
    const ambiente = criarAmbiente();
    try {
      const renderer: RendererDeFrames = (opcoes) => {
        const [inicio, fim] = opcoes.frameRange;
        for (let f = inicio; f <= fim; f++) {
          writeFileSync(join(opcoes.outputDir, `frame-${String(f)}.png`), pngAzul);
        }
        // Mente sobre a contagem: 5 em vez de 60.
        return Promise.resolve({ frameCount: 5 });
      };
      const erro = await renderTexto(ambiente, { renderer })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("entregou 5 frames");
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("renderer que nao grava NENHUM arquivo (frame ausente) = ErroPreviewRender", async () => {
    const ambiente = criarAmbiente();
    try {
      const renderer: RendererDeFrames = async () => ({ frameCount: 60 });
      const erro = await renderTexto(ambiente, { renderer })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("ffmpeg do qtrle FALHA = ErroPreviewRender (encode/mux)", async () => {
    const ambiente = criarAmbiente();
    try {
      const executor = executorDeleganteQue((args) => args.includes("qtrle"));
      const erro = await renderTexto(ambiente, { executor })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toMatch(/encode\/mux do preview falhou/);
    } finally {
      removerAmbiente(ambiente);
    }
  }, 60_000);

  it("qtrle que 'sucede' sem escrever bytes = ErroPreviewRender (C1: exit 0 nao prova arquivo)", async () => {
    const ambiente = criarAmbiente();
    try {
      const executor: ExecutorDeComando = (comando, args) =>
        new Promise((resolve2, reject) => {
          if (args.includes("qtrle")) {
            // "Sucesso" sem efeito: nenhum arquivo master.mov e escrito.
            resolve2({ stdout: "", stderr: "" });
            return;
          }
          execFile(comando, args, { timeout: 300_000, maxBuffer: 64 * 1024 * 1024 }, (erro, stdout, stderr) => {
            if (erro) {
              reject(new Error(String(erro)));
              return;
            }
            resolve2({ stdout: String(stdout), stderr: String(stderr) });
          });
        });
      const erro = await renderTexto(ambiente, { executor })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
    } finally {
      removerAmbiente(ambiente);
    }
  }, 60_000);

  it("mux com audio FALHA = ErroPreviewRender (encode/mux)", async () => {
    const ambiente = criarAmbiente();
    try {
      // O mux de silencio usa anullsrc — falhar so nessa chamada (o
      // argumento completo e "anullsrc=channel_layout=...").
      const executor = executorDeleganteQue((args) => args.some((a) => a.startsWith("anullsrc")));
      const erro = await renderTexto(ambiente, { executor })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toMatch(/encode\/mux do preview falhou/);
    } finally {
      removerAmbiente(ambiente);
    }
  }, 60_000);

  it("ffprobe que FALHA na conferencia = ErroPreviewRender (a conferencia propaga)", async () => {
    const ambiente = criarAmbiente();
    try {
      // Passa qtrle/h264/mux; falha so no ffprobe da conferencia final
      // (o argumento e "stream=codec_type,codec_name,..." — prefixo).
      const executor = executorDeleganteQue((args) => args.some((a) => a.includes("codec_type")));
      const erro = await renderTexto(ambiente, { executor })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewRender);
      expect((erro as ErroPreviewRender).message).toContain("a conferencia do preview falhou");
    } finally {
      removerAmbiente(ambiente);
    }
  }, 60_000);
});

// =============================================================================
// G7 — conferirArquivoDoPreview com executor fake (ffprobe por stream, C4)
// =============================================================================

describe("G7 — oraculo do arquivo final (conferirArquivoDoPreview)", () => {
  const ARQUIVO = join(tmpdir(), "preview-cob-conferencia.mp4");

  function arquivoDummy(conteudo = "dummy"): void {
    writeFileSync(ARQUIVO, conteudo);
  }

  function streamVideo(parcial: Record<string, string> = {}): Record<string, string> {
    return {
      codec_type: "video",
      codec_name: "h264",
      width: "1920",
      height: "1080",
      sample_rate: "N/A",
      duration: "2.000000",
      avg_frame_rate: "30/1",
      ...parcial,
    };
  }

  function streamAudio(parcial: Record<string, string> = {}): Record<string, string> {
    return {
      codec_type: "audio",
      codec_name: "aac",
      sample_rate: "48000",
      duration: "2.000000",
      ...parcial,
    };
  }

  const ESPERADO = { largura: 1920, altura: 1080, fps: 30 };

  function executorProbe(streams: readonly Record<string, string>[]): ExecutorDeComando {
    return async () => ({ stdout: JSON.stringify({ streams }), stderr: "" });
  }

  function executorBrutoDePixels(valor: number): ExecutorBruto {
    return async () => ({
      stdout: Buffer.alloc(1920 * 1080 * 2, valor), // 2 frames amostrados
      stderr: Buffer.alloc(0),
    });
  }

  it("arquivo inexistente = ErroPreviewVazio", async () => {
    const caminho = join(tmpdir(), "preview-cob-nao-existe.mp4");
    await expect(conferirArquivoDoPreview(caminho, ESPERADO)).rejects.toBeInstanceOf(ErroPreviewVazio);
  });

  it("arquivo com ZERO bytes = ErroPreviewVazio", async () => {
    arquivoDummy("");
    await expect(conferirArquivoDoPreview(ARQUIVO, ESPERADO)).rejects.toBeInstanceOf(ErroPreviewVazio);
  });

  it("ffprobe sem stream nenhuma = ErroPreviewVazio (parse vazio nunca vira valor)", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, { executor: executorProbe([]) }),
    ).rejects.toThrow(/ffprobe nao encontrou stream nenhuma/);
  });

  it("so audio (sem video) = ErroPreviewVazio", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, { executor: executorProbe([streamAudio()]) }),
    ).rejects.toThrow(/nao tem video\+audio/);
  });

  it("so video (sem audio) = ErroPreviewVazio", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, { executor: executorProbe([streamVideo()]) }),
    ).rejects.toThrow(/nao tem video\+audio/);
  });

  it("codec de video errado = ErroPreviewVazio", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
        executor: executorProbe([streamVideo({ codec_name: "mpeg4" }), streamAudio()]),
      }),
    ).rejects.toThrow(/codec de video "mpeg4"/);
  });

  it("codec de audio errado = ErroPreviewVazio", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
        executor: executorProbe([streamVideo(), streamAudio({ codec_name: "mp3" })]),
      }),
    ).rejects.toThrow(/codec de audio "mp3"/);
  });

  it("dimensoes erradas = ErroPreviewVazio", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
        executor: executorProbe([streamVideo({ width: "640", height: "360" }), streamAudio()]),
      }),
    ).rejects.toThrow(/dimensoes 640x360/);
  });

  it("fps errado = ErroPreviewVazio", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
        executor: executorProbe([streamVideo({ avg_frame_rate: "25/1" }), streamAudio()]),
      }),
    ).rejects.toThrow(/fps 25/);
  });

  it("avg_frame_rate indefinido (0/0) = ErroPreviewVazio (C4: fracao nunca string)", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
        executor: executorProbe([streamVideo({ avg_frame_rate: "0/0" }), streamAudio()]),
      }),
    ).rejects.toThrow(/avg_frame_rate indefinido/);
  });

  it("duracao do stream indefinida = ErroPreviewVazio (C4: leitura por stream)", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
        executor: executorProbe([streamVideo({ duration: "0.000000" }), streamAudio()]),
      }),
    ).rejects.toThrow(/duracao do stream de video indefinida/);
  });

  it("duracao abaixo do piso do amostrador (0.5s) = ErroPreviewVazio NOMEANDO a causa (FIX onda 6)", async () => {
    arquivoDummy();
    // 0.3s com fps=2: o amostrador nao extrai bytes e mediria yavg 0/desvio
    // 0 — o video CURTO (mas vivo) seria acusado de "quase chapado"
    // (diagnostico falso). O piso e falha nomeada com a causa certa.
    const erro = await conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
      executor: executorProbe([streamVideo({ duration: "0.300000" }), streamAudio()]),
      executorBruto: executorBrutoDePixels(0xff),
    })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPreviewVazio);
    expect(String(erro)).toContain("amostrador de conteudo");
    expect(String(erro)).toContain("0.5");
    // NUNCA o diagnostico falso: o veredito antigo citava as medicoes
    // (yavg/desvio) como se o video fosse chapado — a causa real e a
    // duracao abaixo do piso, e a mensagem tem de nomea-la.
    expect(String(erro)).not.toContain("yavg");
  });

  it("duracao no PISO (0.5s) passa do piso e chega ao oraculo de conteudo (borda inclusiva)", async () => {
    arquivoDummy();
    const conferencia = await conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
      executor: executorProbe([streamVideo({ duration: "0.500000" }), streamAudio()]),
      executorBruto: executorBrutoDePixels(0xff),
    });
    expect(conferencia.duracaoSegundos).toBe(0.5);
    expect(conferencia.medida.yavgMaximo).toBe(255);
  });

  it("oraculo de conteudo (C1): pixels escuros e chapados = ErroPreviewVazio", async () => {
    arquivoDummy();
    await expect(
      conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
        executor: executorProbe([streamVideo(), streamAudio()]),
        executorBruto: executorBrutoDePixels(0x10), // yavg 16 < 24 e desvio 0
      }),
    ).rejects.toThrow(/chapado/);
  });

  it("oraculo de conteudo: pixels claros passam e a conferencia completa volta", async () => {
    arquivoDummy();
    const conferencia = await conferirArquivoDoPreview(ARQUIVO, ESPERADO, {
      executor: executorProbe([streamVideo(), streamAudio()]),
      executorBruto: executorBrutoDePixels(0xff), // yavg 255 acima do piso
    });
    expect(conferencia.codecVideo).toBe("h264");
    expect(conferencia.codecAudio).toBe("aac");
    expect(conferencia.largura).toBe(1920);
    expect(conferencia.altura).toBe(1080);
    expect(conferencia.fps).toBe(30);
    expect(conferencia.duracaoSegundos).toBe(2);
    expect(conferencia.medida.yavgMaximo).toBe(255);
    expect(conferencia.medida.desvioMaximo).toBe(0);
    expect(conferencia.hash).toBe(sha256(Buffer.from("dummy")));
  });

  it("sem o esperado, o fps sai da propria stream (fallback)", async () => {
    arquivoDummy();
    const conferencia = await conferirArquivoDoPreview(ARQUIVO, undefined, {
      executor: executorProbe([streamVideo(), streamAudio()]),
      executorBruto: executorBrutoDePixels(0xff),
    });
    expect(conferencia.fps).toBe(30);
  });
});

// =============================================================================
// G7b — conferirPreview com arquivos REAIS (dimensao errada; hash mentiroso)
// =============================================================================

describe("G7b — conferirPreview com arquivo real", () => {
  let ambiente: Ambiente;

  beforeAll(() => {
    ambiente = criarAmbiente();
    // O diretorio de previews so e criado pelo proprio preview em sucesso —
    // aqui os testes gravam os mp4 por fora, entao criam a raiz.
    mkdirSync(ambiente.previewsRaiz, { recursive: true });
  });

  afterAll(() => removerAmbiente(ambiente));

  /** Um mp4 h264+aac real e pequeno, nas dimensoes pedidas. */
  function gerarMp4Real(dimensoes: string, segundos: string): Buffer {
    const dir = mkdtempSync(join(tmpdir(), "preview-cob-mp4-"));
    const arquivo = join(dir, "real.mp4");
    try {
      execFileSync(
        "ffmpeg",
        [
          "-y", "-hide_banner", "-loglevel", "error",
          "-f", "lavfi", "-i", `testsrc=size=${dimensoes}:rate=30`,
          "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
          "-shortest", "-t", segundos,
          "-c:v", "libx264", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-ar", "48000", "-b:a", "192k",
          "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
          arquivo,
        ],
        { timeout: 120_000 },
      );
      return readFileSync(arquivo);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("arquivo real com dimensoes erradas (640x360) = ErroPreviewVazio (FORMATO_VIDEO)", async () => {
    const bytes = gerarMp4Real("640x360", "1");
    const hash = sha256(bytes);
    writeFileSync(join(ambiente.previewsRaiz, `${hash}.mp4`), bytes);
    const erro = await conferirPreview(hash, { previewsRaiz: ambiente.previewsRaiz })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPreviewVazio);
    expect((erro as ErroPreviewVazio).message).toContain("dimensoes 640x360");
  }, 120_000);

  it("arquivo real 1920x1080 cujo NOME nao e o conteudo = ErroPreviewVazio (C7)", async () => {
    const bytes = gerarMp4Real("1920x1080", "1");
    const hashFalso = "f".repeat(64); // o nome mente sobre os bytes
    writeFileSync(join(ambiente.previewsRaiz, `${hashFalso}.mp4`), bytes);
    const erro = await conferirPreview(hashFalso, { previewsRaiz: ambiente.previewsRaiz })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPreviewVazio);
    expect((erro as ErroPreviewVazio).message).toContain("o nome nao e o conteudo");
  }, 120_000);
});

// =============================================================================
// G8 — CLI D11: gaps (stdin malformado, estado por env, --estado invalido,
//      exit 1 interno)
// =============================================================================

describe("G8 — CLI D11: gaps de cobertura", () => {
  let ambiente: Ambiente;

  beforeAll(() => {
    ambiente = criarAmbiente();
  });

  afterAll(() => removerAmbiente(ambiente));

  // Funcao (nao constante): o ambiente so existe depois do beforeAll.
  const opcoesCli = () => ({
    store_raiz: ambiente.storeRaiz,
    cache_raiz: ambiente.cacheRaiz,
    previews_raiz: ambiente.previewsRaiz,
  });

  it("stdin com JSON MALFORMADO = exit 2, codigo entrada-invalida, estado erro", () => {
    const estado = join(ambiente.raiz, "estado-malformado.json");
    const cli = rodarCliBruto("{isso nao e json", { flags: ["--estado", estado] });
    expect(cli.status).toBe(2);
    expect(cli.stdout).toBe("");
    const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("entrada-invalida");
    expect(envelope.erro.mensagem).toContain("entrada invalida");
    const estadoLido = JSON.parse(readFileSync(estado, "utf-8")) as { estado: string };
    expect(estadoLido.estado).toBe("erro");
  });

  it("stdin VAZIO = exit 2, codigo entrada-invalida (stdin vazio)", () => {
    const cli = rodarCliBruto("");
    expect(cli.status).toBe(2);
    const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("entrada-invalida");
    expect(envelope.erro.mensagem).toContain("stdin vazio");
  });

  it("indice fora do range = exit 2 roteiro-invalido COM detalhes no envelope", () => {
    const roteiro = roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]);
    const cli = rodarCliBruto(JSON.stringify({ roteiro, indice_pedaco: 9, opcoes: opcoesCli() }));
    expect(cli.status).toBe(2);
    const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string; detalhes?: string[] } };
    expect(envelope.erro.codigo).toBe("roteiro-invalido");
    expect(envelope.erro.detalhes).toBeDefined();
    expect(envelope.erro.detalhes!.length).toBeGreaterThan(0);
  });

  it("ROTEIRO_ESTADO_PATH por ENV (sem --estado) escreve o estado", () => {
    const estado = join(ambiente.raiz, "estado-env.json");
    const roteiro = roteiroDe([pedaco({ tipo_visual: "gif", duracao_segundos: 2 })]);
    const cli = rodarCliBruto(JSON.stringify({ roteiro, indice_pedaco: 0, opcoes: opcoesCli() }), {
      env: { ROTEIRO_ESTADO_PATH: estado },
    });
    expect(cli.status).toBe(2);
    const estadoLido = JSON.parse(readFileSync(estado, "utf-8")) as { estado: string; progresso: number };
    expect(estadoLido.estado).toBe("erro");
    expect(estadoLido.progresso).toBe(0);
  });

  it("--estado com caminho INVALIDO = best-effort: nota no stderr, job segue (exit 2 do erro)", () => {
    const roteiro = roteiroDe([pedaco({ tipo_visual: "gif", duracao_segundos: 2 })]);
    const cli = rodarCliBruto(JSON.stringify({ roteiro, indice_pedaco: 0, opcoes: opcoesCli() }), {
      flags: ["--estado", "/dev/full/estado-invalido.json"],
    });
    expect(cli.status).toBe(2);
    expect(cli.stderr).toContain("estado nao gravado em /dev/full/estado-invalido.json");
    expect(cli.stderr).toContain('"preview-visual-nao-produzivel"');
  });

  it("duracao abaixo de 1 frame = exit 2 duracao-insuficiente (classe 400/409, FIX onda 6)", () => {
    // 0.01s * 30fps = 0.3 frames -> round = 0 -> o construtor recusa. O
    // ErroDuracaoInsuficiente e erro de ENTRADA/ESTADO (o servidor mapeia
    // 400/409, D11) — antes do fix caia em "falha-interna" exit 1 (500).
    const roteiro = roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 0.01 })]);
    const cli = rodarCliBruto(JSON.stringify({ roteiro, indice_pedaco: 0, opcoes: opcoesCli() }));
    expect(cli.status).toBe(2);
    expect(cli.stdout).toBe("");
    const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string; mensagem: string } };
    expect(envelope.erro.codigo).toBe("duracao-insuficiente");
    expect(envelope.erro.mensagem).toContain("duracao_segundos 0.01");
  });

  it(
    "exit 1 INTERNO real: audio gravado declarado sem bytes no store (render REAL) = preview-render-falhou",
    () => {
      const estado = join(ambiente.raiz, "estado-interno.json");
      const hashSemBytes = sha256(Buffer.from("wav que nunca foi gravado"));
      const roteiro = roteiroDe([
        pedaco({
          tipo_visual: "texto",
          duracao_segundos: 1.5,
          fala: "A narracao que seria gravada",
          narracao: { texto: "A narracao que seria gravada", origem: "gravacao", hash_audio: hashSemBytes, status: "gerado" },
        }),
      ]);
      const cli = rodarCliBruto(JSON.stringify({ roteiro, indice_pedaco: 0, opcoes: opcoesCli() }), {
        flags: ["--estado", estado],
      });
      expect(cli.status).toBe(1); // interno: 500 no servidor
      expect(cli.stdout).toBe(""); // o stdout JSON e so sucesso
      const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string; mensagem: string } };
      expect(envelope.erro.codigo).toBe("preview-render-falhou");
      expect(envelope.erro.mensagem).toContain("ausente do store");
      const estadoLido = JSON.parse(readFileSync(estado, "utf-8")) as { estado: string; erro: string | null };
      expect(estadoLido.estado).toBe("erro");
      expect(estadoLido.erro).not.toBeNull();
    },
    300_000,
  );
});

// =============================================================================
// G9 — borda: duracao minima (1 frame) e abaixo dela
// =============================================================================

describe("G9 — duracao minima do pedaco", () => {
  let pngAzul: Buffer;

  beforeAll(() => {
    pngAzul = gerarPng("0x1E90FF");
  });

  it(
    "duracao minima que o oraculo consegue amostrar (0.5s) renderiza e a duracao bate (FQ-P4)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        const resultado = await renderizarPreviewPedaco(
          roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 0.5 })]),
          0,
          opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
        );
        const conferencia = await conferirPreview(resultado.hash, { previewsRaiz: ambiente.previewsRaiz });
        expect(conferencia.duracaoSegundos).toBeCloseTo(0.5, 1);
        // O oraculo amostra frames de verdade (yavg do azul > piso).
        expect(conferencia.medida.yavgMaximo).toBeGreaterThan(24);
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );

  it(
    "pedaco de 1 frame (0.02s): duracao abaixo do PISO do amostrador (0.5s) = ErroPreviewVazio nomeando a causa (FIX onda 6)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        const erro = await renderizarPreviewPedaco(
          roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 0.02 })]),
          0,
          opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
        )
          .then(() => null)
          .catch((e: unknown) => e);
        expect(erro).toBeInstanceOf(ErroPreviewVazio);
        // A mensagem NOMEIA o piso do amostrador (fps=2, 0.5s) — o video
        // NAO e preto: e curto demais para a amostragem extrair bytes
        // (antes do fix, o veredito era o falso "quase chapado").
        expect(String(erro)).toContain("amostrador de conteudo");
        expect(String(erro)).toContain("0.5");
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );

  it(
    "pedaco alvo com indice > 0 em roteiro de MULTIPLOS pedacos renderiza e valida (normalizacao p-000/indice 0 — FIX onda 6)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        const roteiro = roteiroDe([
          pedaco({ indice: 0, tipo_visual: "texto", duracao_segundos: 2 }),
          pedaco({
            indice: 1,
            tipo_visual: "texto",
            duracao_segundos: 2,
            fala: "A fala do segundo pedaco",
            especificacao_visual: "O segundo pedaco, com conteudo proprio",
          }),
          pedaco({ indice: 2, tipo_visual: "texto", duracao_segundos: 2 }),
        ]);
        // indice 1: o pedaco alvo carrega id/indice ORIGINAIS (p-001/1) e
        // so a normalizacao o torna um roteiro valido de um pedaco so.
        const resultado = await renderizarPreviewPedaco(
          roteiro,
          1,
          opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
        );
        const conferencia = await conferirPreview(resultado.hash, {
          previewsRaiz: ambiente.previewsRaiz,
        });
        expect(conferencia.duracaoSegundos).toBeCloseTo(2, 1);
        expect(conferencia.medida.yavgMaximo).toBeGreaterThan(24);
        // indice 0 continua funcionando (a normalizacao e idempotente).
        const resultado0 = await renderizarPreviewPedaco(
          roteiro,
          0,
          opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
        );
        const conferencia0 = await conferirPreview(resultado0.hash, {
          previewsRaiz: ambiente.previewsRaiz,
        });
        expect(conferencia0.duracaoSegundos).toBeCloseTo(2, 1);
        // Pedacos diferentes (titulo/fala) produzem chaves C7 diferentes
        // (o endereco e por CONTEUDO — o renderer fake pinta o mesmo azul
        // nos dois, entao os bytes do mp4 sao iguais; a chave e a prova
        // de que o conteudo distinto foi enderecado distinto).
        expect(resultado.chaveC7).not.toBe(resultado0.chaveC7);
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );

  it("duracao abaixo de 1 frame = ErroDuracaoInsuficiente (nunca manifesto invalido)", async () => {
    const ambiente = criarAmbiente();
    try {
      const erro = await renderizarPreviewPedaco(
        roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 0.01 })]),
        0,
        opcoesDe(ambiente),
      )
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroDuracaoInsuficiente);
      expect(String(erro)).toContain("duracao-abaixo-de-um-frame");
    } finally {
      removerAmbiente(ambiente);
    }
  });
});

// =============================================================================
// G10 — cli.ts em processo: o wrapper executarPreview (cobertura do modulo)
// =============================================================================

describe("G10 — executarPreview importado em processo", () => {
  it("wrapper propaga o erro nomeado do visual (sem render)", async () => {
    const ambiente = criarAmbiente();
    try {
      const pedido = {
        roteiro: roteiroDe([pedaco({ tipo_visual: "gif", duracao_segundos: 2 })]),
        indice_pedaco: 0,
        opcoes: {
          store_raiz: ambiente.storeRaiz,
          cache_raiz: ambiente.cacheRaiz,
          previews_raiz: ambiente.previewsRaiz,
        },
      };
      await expect(executarPreview(pedido)).rejects.toBeInstanceOf(ErroPreviewVisualNaoProduzivel);
    } finally {
      removerAmbiente(ambiente);
    }
  });
});

// ─── G11 — o estagio grafico REAL (sem executor injetado) ────────────────────
//
// Manim NAO e dependencia de teste: se o motor estiver instalado, o render
// real rodaria por minutos — o teste e PULADO. Sem o motor (o ambiente
// documentado), o runner responde EMOTOR_AUSENTE em milissegundos e o
// preview mapeia para ErroPreviewManimIndisponivel — nunca quadro preto.

const manimPresente = (() => {
  try {
    const saida = execFileSync(
      "python3",
      ["-c", "import importlib.util; print(int(importlib.util.find_spec('manim') is not None))"],
      { encoding: "utf-8", timeout: 15_000 },
    );
    return saida.trim() === "1";
  } catch {
    return true; // nao sabe dizer -> nao arrisca um render real de minutos
  }
})();

describe("G11 — estagio grafico REAL sem o motor", () => {
  beforeAll(() => {
    ambienteDoG11 = criarAmbiente();
  });

  afterAll(() => {
    if (ambienteDoG11 !== undefined) removerAmbiente(ambienteDoG11);
  });

  (manimPresente ? it.skip : it)(
    "renderizarPreviewPedaco SEM executorManim injetado = ErroPreviewManimIndisponivel (nunca quadro preto)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        const erro = await renderizarPreviewPedaco(
          roteiroDe([pedaco({ tipo_visual: "manim", duracao_segundos: 2 })]),
          0,
          opcoesDe(ambiente),
        )
          .then(() => null)
          .catch((e: unknown) => e);
        expect(erro).toBeInstanceOf(ErroPreviewManimIndisponivel);
      } finally {
        removerAmbiente(ambiente);
      }
    },
    60_000,
  );

  (manimPresente ? it.skip : it)(
    "CLI: manim indisponivel = exit 2 preview-manim-indisponivel (classe de erro 400/409 do contrato)",
    () => {
      const roteiro = roteiroDe([pedaco({ tipo_visual: "manim", duracao_segundos: 2 })]);
      const cli = rodarCliBruto(JSON.stringify({ roteiro, indice_pedaco: 0, opcoes: opcoesCliDoG11() }));
      expect(cli.status).toBe(2);
      const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string } };
      expect(envelope.erro.codigo).toBe("preview-manim-indisponivel");
    },
    60_000,
  );
});

/** As opcoes do CLI (funcao — o ambiente do G11 e proprio). */
let ambienteDoG11: Ambiente;
function opcoesCliDoG11(): { store_raiz: string; cache_raiz: string; previews_raiz: string } {
  return {
    store_raiz: ambienteDoG11.storeRaiz,
    cache_raiz: ambienteDoG11.cacheRaiz,
    previews_raiz: ambienteDoG11.previewsRaiz,
  };
}

// ─── Sonda negativa do arquivo: nenhum teste deste arquivo e vacuo ────────────

describe("sondas negativas do arquivo", () => {
  it("conferirPreview de hash inexistente e ErroPreviewVazio (a conferencia nao e vacua)", async () => {
    const ambiente = criarAmbiente();
    try {
      await expect(
        conferirPreview("0".repeat(64), { previewsRaiz: ambiente.previewsRaiz }),
      ).rejects.toBeInstanceOf(ErroPreviewVazio);
    } finally {
      removerAmbiente(ambiente);
    }
  });

  it("fixtures de anexo nao envelheceram (C12 vizinhanca)", () => {
    const gif = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "anexo.gif"));
    expect(sha256(gif)).toBe(HASH_ANEXO_GIF);
    expect(existsSync(join(RAIZ, "tests", "roteiro", "fixtures", "anexo.mp4"))).toBe(true);
  });
});
