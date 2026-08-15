// =============================================================================
// O PREVIEW DE PEDACO — FQ-P1..P4 do TASK_PLAN (Onda 4, onda4-preview-pedaco)
// =============================================================================
//
//   FQ-P1 — render do MESMO pedaco 2x = bytes identicos (determinismo);
//           cache: 2o render com cache QUENTE = mesma saida sem re-render
//           (sonda de chamadas ao renderer — AB-685) e memo da resolucao
//           manim nao re-executa o motor (sonda no executor).
//   FQ-P2 — o preview NAO e quadro preto/chapado: o oraculo de conteudo
//           (C1 — medirConteudoDe/reprovadoPorConteudo do produzir) aprova
//           o arquivo final; sonda negativa: render de frames PRETOS e
//           ErroPreviewVazio — nunca sucesso com imagem errada.
//   FQ-P3 — pedaco gif/video sem anexo = erro nomeado com a regra
//           anexo-exigido-para-gif-video (ErroPreviewVisualNaoProduzivel);
//           manim sem motor = ErroPreviewManimIndisponivel com instrucao
//           (mock do executor — o manim nao e dependencia de teste);
//           anexo presente com tipo texto NAO bloqueia o preview.
//   FQ-P4 — duracao do preview via ffprobe POR STREAM (C4) == duracao do
//           pedaco (tolerancia de 1 frame).
//   AUDIO — pedaco com narracao gravada tem audio NAO-silencioso no
//           preview (volumedetect); sem narracao (ou tts indisponivel)
//           o preview e silencioso POR DESIGN — e sempre sai com trilha
//           aac (o concat do juntar e por stream-copy).
//   CLI   — D11: stdin JSON -> stdout JSON {hash, caminho,
//           duracao_segundos}; --estado/env com progresso; exit 0/1/2;
//           envelope de erro no stderr (processo REAL — anti-C2).
//
// Anti-C2 (runner verde com filtro que nao casa nada): cada grupo termina
// com sonda negativa que FALHA se o alvo do grupo estiver quebrado — o
// comparador de bytes reprova quando os frames mudam, o oraculo reprova
// quadro preto, a leitura de duracao reprova quando a duracao muda, o
// volumedetect reprova silencio indevido, e o CLI e testado em PROCESSO
// REAL (o estado do processo de teste nunca alcanca o filho).
//
// Renders REAIS (Remotion headless): o gate da Onda 1 provou que rodam
// neste ambiente. Os testes reais usam pedacos PEQUENOS (1.5-3s); o resto
// usa renderer fake + contexto fake (sem bundle, sem navegador) e o
// encode/mux REAIS do ffmpeg — o que os testes de determinismo e de audio
// precisam exercitar.
// =============================================================================

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Pedaco, Roteiro } from "../../src/roteiro/contrato/contrato.js";
import { REGRA_ANEXO_EXIGIDO } from "../../src/roteiro/contrato/validar.js";
import {
  conferirPreview,
  ErroPreviewManimIndisponivel,
  ErroPreviewVazio,
  ErroPreviewVisualNaoProduzivel,
  renderizarPreviewPedaco,
  type ConferenciaDoPreview,
  type OpcoesDoPreview,
} from "../../src/roteiro/preview/preview.js";
import { EMotorGraficoAusente } from "../../src/resolucao/grafico/executor.js";
import type { JobDeRender, ResultadoDeRender } from "../../src/resolucao/grafico/executor.js";
import { Store } from "../../src/store/store.js";
import type { ContextoDoRender, RendererDeFrames } from "../../src/render/pipeline/executar.js";

const RAIZ = join(__dirname, "..", "..");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const CAMINHO_CLI = join(RAIZ, "src", "roteiro", "preview", "cli.ts");

const HASH_ANEXO_GIF = "9d7cc2b731dde14beafe804f1f52b0d3fd1c9991da9561a1b250e1ae6cbd6dd4";

// ─── Helpers de roteiro ───────────────────────────────────────────────────────

/**
 * Um pedaco valido com os campos default; o teste sobrescreve o que quer.
 *
 * O id deriva do indice (p-<indice> com 3 digitos — a regra
 * id-nao-casa-indice do contrato): o preview valida o pedaco alvo e o id
 * tem de casar a posicao dele no roteiro.
 */
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

/** Um roteiro valido: soma das duracoes = duracao_total_segundos. */
function roteiroDe(pedacos: readonly Pedaco[]): Roteiro {
  return {
    schema_version: "Roteiro.1",
    pedacos,
    duracao_total_segundos: pedacos.reduce((soma, p) => soma + p.duracao_segundos, 0),
  };
}

/** O par de anexo do fixture anexo.gif (os bytes reais, hash real). */
const ANEXO_GIF = {
  anexo_hash: HASH_ANEXO_GIF,
  anexo_meta: {
    tipo: "image/gif" as const,
    tamanho_bytes: 98320,
    nome_original: "anexo.gif",
  },
};

// ─── Ambiente de teste ────────────────────────────────────────────────────────

interface Ambiente {
  /** Raiz temporaria (store/cache/previews/resolucao isolados por teste). */
  readonly raiz: string;
  readonly store: Store;
  readonly storeRaiz: string;
  readonly cacheRaiz: string;
  readonly previewsRaiz: string;
  readonly resolucaoRaiz: string;
}

function criarAmbiente(): Ambiente {
  const raiz = mkdtempSync(join(tmpdir(), "preview-teste-"));
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

/**
 * As opcoes do preview para teste: raizDoProjeto = o repositorio (a
 * entrada gerada resolve os imports relativos a partir dela) e
 * store/cache/previews TEMPORARIOS (isolamento por teste).
 */
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

// ─── Renderer fake (sem navegador — o encode/mux REAIS do ffmpeg ficam) ───────

let pngAzul: Buffer;
let pngPreto: Buffer;
let webmDeTeste: Buffer;
let webmDeTeste2: Buffer;

function gerarPng(hex: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "preview-png-"));
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
  const dir = mkdtempSync(join(tmpdir(), "preview-webm-"));
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

/** O renderer fake: escreve os bytes dados (um PNG 1920x1080) por frame. */
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

/** O contexto fake: pula o bundle — o renderer fake ignora composition. */
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

// ─── Audio de gravacao (wav 48k estereo — FORMATO_AUDIO_GRAVADO) ──────────────

/** Um wav 48k estereo com um seno de 440Hz — nao-silencioso, deterministico. */
function gerarWavDeVoz(segundos: number): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "preview-wav-"));
  const arquivo = join(dir, "voz.wav");
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", `sine=frequency=440:duration=${String(segundos)}`,
        "-ar", "48000", "-ac", "2",
        "-c:a", "pcm_s16le",
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

/**
 * mean_volume do arquivo via volumedetect — numero do proprio ffmpeg.
 *
 * O resumo do volumedetect vai para o STDERR (o stdout e a propria
 * midia, em `-f null`): spawnSync le os dois. Silencio digital e
 * reportado como "-inf dB" (o aac decodifica zeros): mapeia para -100
 * (abaixo de qualquer limiar de silencio).
 */
function volumeMedioDe(arquivo: string): number {
  const resultado = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", arquivo, "-af", "volumedetect", "-f", "null", "-"],
    { encoding: "utf-8", timeout: 120_000 },
  );
  if (resultado.status !== 0) {
    throw new Error(
      `ffmpeg volumedetect falhou (${String(resultado.status)}): ${String(resultado.stderr)}`,
    );
  }
  const saida = `${resultado.stdout ?? ""}\n${resultado.stderr ?? ""}`;
  if (/mean_volume:\s*-inf\s*dB/.test(saida)) {
    return -100;
  }
  const casa = /mean_volume:\s*(-?[\d.]+)\s*dB/.exec(saida);
  if (casa === null) {
    throw new Error(`volumedetect nao reportou mean_volume em ${arquivo}`);
  }
  return Number(casa[1]);
}

/**
 * O executor manim fake: escreve um webm por chamada e reporta o hash.
 *
 * Um webm DIFERENTE por chamada (lista de rotacao): o memo de resolucao
 * e chaveado por conteudo — dois pedacos que produziriam o MESMO webm
 * (mesmo mock, mesmos bytes) acertariam o memo legitimamente, e a sonda
 * negativa do memo ficaria indistinguivel do acerto. Com bytes
 * distintos por chamada, um pedaco novo SEMPRE tem webm novo (hash
 * novo) — o miss do memo e observavel.
 */
function executorManimFake(webms: readonly Buffer[], contador?: { chamadas: number }) {
  let proximo = 0;
  return {
    renderizar: async (job: JobDeRender): Promise<ResultadoDeRender> => {
      if (contador !== undefined) contador.chamadas++;
      const webm = webms[proximo % webms.length]!;
      proximo++;
      // O layout real do runner: media/videos/<script>/<altura>p<fps>/<cena>.webm
      // (os diretorios nao existem — o mock os cria, como o runner real).
      const dir = join(job.diretorioTrabalho, "media", "videos", "cena", "1080p30");
      mkdirSync(dir, { recursive: true });
      const nomeCena = "CenaFake";
      writeFileSync(join(dir, `${nomeCena}.webm`), webm);
      return {
        hash: sha256(webm),
        bytes: webm.length,
        largura: 320,
        altura: 240,
        framesDeclarados: 10,
        framesInspecionados: 10,
        framesChapados: 0,
        nomeCena,
        correcoes: [],
        ferramenta: "manim 0.20.1 (mock de teste)",
        muxer: "Lavf62.12.102",
      };
    },
  };
}

// ─── Grupo A — FQ-P1: determinismo + cache ────────────────────────────────────

describe("FQ-P1 — determinismo e cache por conteudo", () => {
  let pngVerde: Buffer;
  let pedacoTexto: Pedaco;

  beforeAll(() => {
    pngAzul = gerarPng("0x1E90FF");
    pngVerde = gerarPng("0x00FF00");
    pngPreto = gerarPng("0x000000");
    webmDeTeste = gerarWebmDeTeste("decimals=2");
    webmDeTeste2 = gerarWebmDeTeste("decimals=4");
    pedacoTexto = pedaco({
      tipo_visual: "texto",
      duracao_segundos: 2,
      especificacao_visual: "Determinismo do preview, byte a byte.",
    });
  });

  it(
    "render do MESMO pedaco 2x em caches frios distintos = bytes identicos (determinismo)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        const primeira = await renderizarPreviewPedaco(
          roteiroDe([pedacoTexto]),
          0,
          opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
        );
        // Cache FRIO de novo (outra raiz): o segundo render executa o
        // pipeline inteiro de novo — e tem de sair IDENTICO.
        const outroCache = mkdtempSync(join(tmpdir(), "preview-frio-"));
        try {
          const segunda = await renderizarPreviewPedaco(
            roteiroDe([pedacoTexto]),
            0,
            opcoesDe(ambiente, {
              cacheRaiz: outroCache,
              renderer: rendererComPng(pngAzul),
              contexto: contextoFake(),
            }),
          );
          expect(segunda.hash).toBe(primeira.hash);
          expect(readFileSync(segunda.caminho)).toEqual(readFileSync(primeira.caminho));
          expect(segunda.duracaoSegundos).toBe(primeira.duracaoSegundos);

          // Sonda negativa anti-C2 do grupo (a comparacao nao pode ser
          // vacua): frames de OUTRA COR (cache frio de novo) produzem
          // bytes DIFERENTES — se o comparador comparasse consigo mesmo,
          // esta assercao falharia.
          const terceiroCache = mkdtempSync(join(tmpdir(), "preview-cor-"));
          try {
            const terceira = await renderizarPreviewPedaco(
              roteiroDe([pedacoTexto]),
              0,
              opcoesDe(ambiente, {
                cacheRaiz: terceiroCache,
                renderer: rendererComPng(pngVerde),
                contexto: contextoFake(),
              }),
            );
            expect(terceira.hash).not.toBe(primeira.hash);
          } finally {
            rmSync(terceiroCache, { recursive: true, force: true });
          }
        } finally {
          rmSync(outroCache, { recursive: true, force: true });
        }
      } finally {
        removerAmbiente(ambiente);
      }
    },
    180_000,
  );

  it(
    "cache QUENTE: 2o render com a MESMA chave = mesmos bytes e ZERO chamadas ao renderer (AB-685)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        const contador = { chamadas: 0 };
        const primeiro = await renderizarPreviewPedaco(
          roteiroDe([pedacoTexto]),
          0,
          opcoesDe(ambiente, {
            renderer: rendererComPng(pngAzul, contador),
            contexto: contextoFake(),
          }),
        );
        expect(contador.chamadas).toBe(1); // frio

        const segundo = await renderizarPreviewPedaco(
          roteiroDe([pedacoTexto]),
          0,
          opcoesDe(ambiente, {
            renderer: rendererComPng(pngAzul, contador),
            contexto: contextoFake(),
          }),
        );
        expect(segundo.hash).toBe(primeiro.hash);
        expect(segundo.chamadasDoRenderer).toBe(0); // QUENTE — nao re-renderiza
        expect(segundo.framesDoCache).toBe(60); // 2s x 30fps
        expect(contador.chamadas).toBe(1); // o renderer so rodou no frio
        expect(readFileSync(segundo.caminho)).toEqual(readFileSync(primeiro.caminho));
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );

  it(
    "memo da resolucao manim: 2o render NAO re-executa o motor grafico (mesma chave do cassete)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        const contador = { chamadas: 0 };
        const pedacoManim = pedaco({
          tipo_visual: "manim",
          duracao_segundos: 2,
          especificacao_visual: "Animacao estilo 3b1b: soma de riemann",
        });
        const executor = executorManimFake([webmDeTeste, webmDeTeste2], contador);
        const primeiro = await renderizarPreviewPedaco(
          roteiroDe([pedacoManim]),
          0,
          opcoesDe(ambiente, {
            executorManim: executor,
            renderer: rendererComPng(pngAzul),
            contexto: contextoFake(),
          }),
        );
        expect(contador.chamadas).toBe(1); // miss do memo: o motor rodou

        // Cache de render FRIO (forca render de novo) — o memo de resolucao
        // (chave do cassete: estagio + parametros + manifesto) acerta e o
        // motor NAO roda de novo.
        const outroCache = mkdtempSync(join(tmpdir(), "preview-manim-"));
        try {
          const segundo = await renderizarPreviewPedaco(
            roteiroDe([pedacoManim]),
            0,
            opcoesDe(ambiente, {
              cacheRaiz: outroCache,
              executorManim: executor,
              renderer: rendererComPng(pngAzul),
              contexto: contextoFake(),
            }),
          );
          expect(segundo.hash).toBe(primeiro.hash);
          expect(contador.chamadas).toBe(1); // O MOTOR NAO RODOU DE NOVO

          // Sonda negativa anti-C2: um pedaco manim DIFERENTE (outro conteudo
          // = outra chave do cassete) e MISS do memo — o motor roda.
          const outroManim = pedaco({
            tipo_visual: "manim",
            duracao_segundos: 2,
            especificacao_visual: "Animacao estilo 3b1b: identidade de euler",
          });
          await renderizarPreviewPedaco(
            roteiroDe([outroManim]),
            0,
            opcoesDe(ambiente, {
              executorManim: executor,
              renderer: rendererComPng(pngAzul),
              contexto: contextoFake(),
            }),
          );
          expect(contador.chamadas).toBe(2);
        } finally {
          rmSync(outroCache, { recursive: true, force: true });
        }
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );
});

// ─── Grupo B — FQ-P2: o preview nunca e quadro preto (C1) ─────────────────────

describe("FQ-P2 — oraculo de conteudo (C1)", () => {
  it(
    "frames PRETOS = ErroPreviewVazio (nunca sucesso com imagem errada)",
    async () => {
      const ambiente = criarAmbiente();
      try {
        await expect(
          renderizarPreviewPedaco(
            roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]),
            0,
            opcoesDe(ambiente, {
              renderer: rendererComPng(pngPreto),
              contexto: contextoFake(),
            }),
          ),
        ).rejects.toBeInstanceOf(ErroPreviewVazio);
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );

  it(
    "preview com conteudo passa no oraculo (yavg OU desvio acima do piso) e o arquivo existe",
    async () => {
      // Ambiente proprio: o cache C7 do teste PRETO (mesmo pedaco) nao
      // pode servir frames pretos para o teste AZUL — conteudos diferentes
      // em caches compartilhados e acerto pelo motivo errado (C12).
      const ambiente = criarAmbiente();
      try {
        const resultado = await renderizarPreviewPedaco(
          roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]),
          0,
          opcoesDe(ambiente, {
            renderer: rendererComPng(pngAzul),
            contexto: contextoFake(),
          }),
        );
        const conferencia = await conferirPreview(resultado.hash, { previewsRaiz: ambiente.previewsRaiz });
        // O azul solido tem yavg ~122 (acima do piso 24) — o oraculo aprova;
        // o desvio fica ~0, mas a regra e yavg ABAIXO do piso E desvio baixo.
        expect(conferencia.medida.yavgMaximo).toBeGreaterThan(24);
        expect(conferencia.codecVideo).toBe("h264");
        expect(conferencia.codecAudio).toBe("aac");
      } finally {
        removerAmbiente(ambiente);
      }
    },
    120_000,
  );
});

// ─── Grupo C — FQ-P3: visual nao produzivel ───────────────────────────────────

describe("FQ-P3 — visual nao produzivel e erro nomeado", () => {
  let ambiente: Ambiente;

  beforeAll(() => {
    ambiente = criarAmbiente();
  });

  afterAll(() => removerAmbiente(ambiente));

  it(
    "pedaco gif sem anexo_hash = ErroPreviewVisualNaoProduzivel com a regra anexo-exigido-para-gif-video",
    async () => {
      const roteiro = roteiroDe([
        pedaco({ id: "p-000", indice: 0, tipo_visual: "texto", duracao_segundos: 2 }),
        pedaco({
          id: "p-001",
          indice: 1,
          tipo_visual: "gif",
          duracao_segundos: 3,
          especificacao_visual: "GIF anexado pelo usuario",
        }),
      ]);
      const erro = await renderizarPreviewPedaco(roteiro, 1, opcoesDe(ambiente))
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewVisualNaoProduzivel);
      const nomeado = erro as ErroPreviewVisualNaoProduzivel;
      expect(nomeado.code).toBe("PREVIEW_VISUAL_NAO_PRODUZIVEL");
      expect(nomeado.regra).toBe(REGRA_ANEXO_EXIGIDO);
      expect(nomeado.message).toContain("p-001");
    },
  );

  it(
    "pedaco video com anexo_hash declarado mas SEM bytes no store = ErroPreviewVisualNaoProduzivel",
    async () => {
      const roteiro = roteiroDe([
        pedaco({
          indice: 0,
          tipo_visual: "video",
          duracao_segundos: 3,
          anexo_hash: "e04d7728fa14d2a6c9f7b3e5a1d8c6f4b2a0e9d7c5b3f1a8e6d4c2b0a9f8e7d6",
          anexo_meta: { tipo: "video/mp4", tamanho_bytes: 25353, nome_original: "anexo.mp4" },
        }),
      ]);
      const erro = await renderizarPreviewPedaco(roteiro, 0, opcoesDe(ambiente))
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewVisualNaoProduzivel);
      expect((erro as ErroPreviewVisualNaoProduzivel).message).toContain("sem bytes no store");
    },
  );

  it(
    "pedaco manim sem o motor grafico = ErroPreviewManimIndisponivel com instrucao (nunca quadro preto)",
    async () => {
      const roteiro = roteiroDe([
        pedaco({ tipo_visual: "manim", duracao_segundos: 2 }),
      ]);
      const executor = {
        renderizar: async (): Promise<ResultadoDeRender> => {
          throw new EMotorGraficoAusente("mock: manim nao instalado (teste)");
        },
      };
      const erro = await renderizarPreviewPedaco(roteiro, 0, opcoesDe(ambiente, { executorManim: executor }))
        .then(() => null)
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroPreviewManimIndisponivel);
      const nomeado = erro as ErroPreviewManimIndisponivel;
      expect(nomeado.code).toBe("PREVIEW_MANIM_INDISPONIVEL");
      expect(nomeado.message).toMatch(/Instale o Manim CE/i);
      expect(nomeado.message).toMatch(/MANIM_BIN/i);
    },
  );

  it(
    "anexo presente com tipo_visual texto NAO bloqueia o preview (estado transitorio upload-primeiro-tipo-depois)",
    async () => {
      const bytes = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "anexo.gif"));
      expect(sha256(bytes)).toBe(HASH_ANEXO_GIF); // a fixture nao envelheceu (C12 vizinhanca)
      await ambiente.store.put(bytes, {
        license: "uso-pessoal-ADR-0003",
        attributionRequired: false,
        source: "manual",
        acquiredAt: new Date(0).toISOString(),
      });
      const roteiro = roteiroDe([
        pedaco({
          indice: 0,
          tipo_visual: "texto",
          duracao_segundos: 2,
          anexo_hash: HASH_ANEXO_GIF,
          anexo_meta: { tipo: "image/gif", tamanho_bytes: 98320, nome_original: "anexo.gif" },
        }),
      ]);
      // O anexo e do par (anexo, tipo) transitorio — o preview do TEXTO nao
      // pode ser bloqueado por ele; renderiza normalmente.
      const resultado = await renderizarPreviewPedaco(
        roteiro,
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      expect(resultado.hash.length).toBe(64);
      expect(existsSync(resultado.caminho)).toBe(true);
    },
    120_000,
  );

  it(
    "pedaco gif com anexo REAL no store renderiza (a camada de midia consome o anexo)",
    async () => {
      const bytes = readFileSync(join(RAIZ, "tests", "roteiro", "fixtures", "anexo.gif"));
      await ambiente.store.put(bytes, {
        license: "uso-pessoal-ADR-0003",
        attributionRequired: false,
        source: "manual",
        acquiredAt: new Date(0).toISOString(),
      });
      const roteiro = roteiroDe([
        pedaco({
          indice: 0,
          tipo_visual: "gif",
          duracao_segundos: 2,
          especificacao_visual: "GIF anexado pelo usuario em loop",
          ...ANEXO_GIF,
        }),
      ]);
      const resultado = await renderizarPreviewPedaco(
        roteiro,
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      const conferencia = await conferirPreview(resultado.hash, { previewsRaiz: ambiente.previewsRaiz });
      expect(conferencia.codecVideo).toBe("h264");
    },
    120_000,
  );
});

// ─── Grupo D — FQ-P4: duracao por stream (C4) ─────────────────────────────────

describe("FQ-P4 — duracao do preview por stream", () => {
  let ambiente: Ambiente;

  beforeAll(() => {
    ambiente = criarAmbiente();
  });

  afterAll(() => removerAmbiente(ambiente));

  it(
    "duracao do preview (ffprobe POR STREAM) == duracao do pedaco (tolerancia de 1 frame)",
    async () => {
      const duracao = 3;
      const resultado = await renderizarPreviewPedaco(
        roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: duracao })]),
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      const conferencia = await conferirPreview(resultado.hash, { previewsRaiz: ambiente.previewsRaiz });
      expect(conferencia.duracaoSegundos).toBeCloseTo(duracao, 1);
      expect(resultado.duracaoSegundos).toBeCloseTo(duracao, 1);
    },
    120_000,
  );

  it(
    "sonda negativa anti-C2: pedacos de duracoes DIFERENTES produzem duracoes DIFERENTES",
    async () => {
      const curto = await renderizarPreviewPedaco(
        roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 1.5 })]),
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      const longo = await renderizarPreviewPedaco(
        roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 4 })]),
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      expect(curto.duracaoSegundos).toBeLessThan(3);
      expect(longo.duracaoSegundos).toBeGreaterThan(3.5);
      expect(curto.duracaoSegundos).not.toBe(longo.duracaoSegundos);
    },
    120_000,
  );
});

// ─── Grupo E — audio do preview (volumedetect) ────────────────────────────────

describe("audio do preview (volumedetect)", () => {
  let ambiente: Ambiente;

  beforeAll(() => {
    ambiente = criarAmbiente();
  });

  afterAll(() => removerAmbiente(ambiente));

  it(
    "pedaco com narracao GRAVADA tem audio nao-silencioso no preview",
    async () => {
      const wav = gerarWavDeVoz(2);
      const hashWav = sha256(wav);
      await ambiente.store.put(wav, {
        license: "uso-pessoal-ADR-0003",
        attributionRequired: false,
        source: "manual",
        acquiredAt: new Date(0).toISOString(),
      });
      const roteiro = roteiroDe([
        pedaco({
          indice: 0,
          tipo_visual: "texto",
          duracao_segundos: 2,
          fala: "A narracao gravada do pedaco",
          narracao: { texto: "A narracao gravada do pedaco", origem: "gravacao", hash_audio: hashWav, status: "gerado" },
        }),
      ]);
      const resultado = await renderizarPreviewPedaco(
        roteiro,
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      const conferencia = await conferirPreview(resultado.hash, { previewsRaiz: ambiente.previewsRaiz });
      expect(conferencia.codecAudio).toBe("aac");
      const volume = volumeMedioDe(resultado.caminho);
      expect(volume).toBeGreaterThan(-40); // o seno de 440Hz esta audivel
    },
    120_000,
  );

  it(
    "pedaco SEM narracao e silencioso POR DESIGN — e sai com trilha aac mesmo assim",
    async () => {
      const resultado = await renderizarPreviewPedaco(
        roteiroDe([pedaco({ tipo_visual: "texto", duracao_segundos: 2 })]),
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      const conferencia = await conferirPreview(resultado.hash, { previewsRaiz: ambiente.previewsRaiz });
      expect(conferencia.codecAudio).toBe("aac"); // o concat do juntar precisa
      const volume = volumeMedioDe(resultado.caminho);
      expect(volume).toBeLessThan(-70); // silencio digital
    },
    120_000,
  );

  it(
    "pedaco com narracao tts renderiza silencioso (provedor indisponivel — 429, documentado)",
    async () => {
      const roteiro = roteiroDe([
        pedaco({
          indice: 0,
          tipo_visual: "texto",
          duracao_segundos: 2,
          fala: "A fala que seria sintetizada",
          narracao: { texto: "A fala que seria sintetizada", origem: "tts", status: "gerado" },
        }),
      ]);
      const resultado = await renderizarPreviewPedaco(
        roteiro,
        0,
        opcoesDe(ambiente, { renderer: rendererComPng(pngAzul), contexto: contextoFake() }),
      );
      const volume = volumeMedioDe(resultado.caminho);
      expect(volume).toBeLessThan(-70);
    },
    120_000,
  );
});

// ─── Grupo F — CLI D11 (processo real — anti-C2) ──────────────────────────────

interface ResultadoDoCli {
  status: number;
  stdout: string;
  stderr: string;
}

function rodarCli(
  pedido: unknown,
  extras: { flags?: string[]; env?: Record<string, string> } = {},
): ResultadoDoCli {
  try {
    const stdout = execFileSync(BIN_TSX, [CAMINHO_CLI, ...(extras.flags ?? [])], {
      input: JSON.stringify(pedido),
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

describe("CLI D11 do preview (processo real)", () => {
  let ambiente: Ambiente;

  beforeAll(() => {
    ambiente = criarAmbiente();
  });

  afterAll(() => removerAmbiente(ambiente));

  it(
    "entrada invalida: exit 2, envelope de erro no stderr, estado erro no arquivo",
    () => {
      const estado = join(ambiente.raiz, "estado-1.json");
      const cli = rodarCli({ indice_pedaco: 0 }, { flags: ["--estado", estado] });
      expect(cli.status).toBe(2);
      expect(cli.stdout).toBe("");
      const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string } };
      expect(envelope.erro.codigo).toBe("entrada-invalida");
      const estadoLido = JSON.parse(readFileSync(estado, "utf-8")) as { estado: string };
      expect(estadoLido.estado).toBe("erro");
    },
  );

  it(
    "pedaco gif sem anexo: exit 2 com a regra anexo-exigido-para-gif-video (o job nunca termina ok com imagem errada)",
    () => {
      const roteiro = roteiroDe([
        pedaco({ tipo_visual: "gif", duracao_segundos: 2 }),
      ]);
      const cli = rodarCli({ roteiro, indice_pedaco: 0, opcoes: { store_raiz: ambiente.storeRaiz, cache_raiz: ambiente.cacheRaiz, previews_raiz: ambiente.previewsRaiz } });
      expect(cli.status).toBe(2);
      const envelope = JSON.parse(cli.stderr) as { erro: { codigo: string; mensagem: string } };
      expect(envelope.erro.codigo).toBe("preview-visual-nao-produzivel");
      expect(envelope.erro.mensagem).toContain(REGRA_ANEXO_EXIGIDO);
    },
  );

  it(
    "sucesso: exit 0, stdout {hash, caminho, duracao_segundos}, mp4 real e conferido (render REAL)",
    async () => {
      const roteiro = roteiroDe([
        pedaco({
          indice: 0,
          tipo_visual: "texto",
          duracao_segundos: 1.5,
          especificacao_visual: "O CLI do preview em acao, com render real.",
        }),
      ]);
      const estado = join(ambiente.raiz, "estado-ok.json");
      const cli = rodarCli(
        { roteiro, indice_pedaco: 0, opcoes: { store_raiz: ambiente.storeRaiz, cache_raiz: ambiente.cacheRaiz, previews_raiz: ambiente.previewsRaiz } },
        { flags: ["--estado", estado] },
      );
      expect(cli.status).toBe(0);
      expect(cli.stderr).toBe("");
      const saida = JSON.parse(cli.stdout) as { hash: string; caminho: string; duracao_segundos: number };
      expect(saida.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(existsSync(saida.caminho)).toBe(true);
      expect(readFileSync(saida.caminho).length).toBeGreaterThan(0);
      expect(saida.duracao_segundos).toBeCloseTo(1.5, 1);
      const estadoLido = JSON.parse(readFileSync(estado, "utf-8")) as { estado: string; progresso: number };
      expect(estadoLido.estado).toBe("ok");
      expect(estadoLido.progresso).toBe(1);
      // O arquivo final passa no oraculo completo (C1 + C4 + formato).
      const conferencia: ConferenciaDoPreview = await conferirPreview(saida.hash, {
        previewsRaiz: ambiente.previewsRaiz,
      });
      expect(conferencia.codecVideo).toBe("h264");
      expect(conferencia.largura).toBe(1920);
      expect(conferencia.altura).toBe(1080);
      expect(conferencia.fps).toBe(30);
      expect(conferencia.medida.desvioMaximo).toBeGreaterThan(1);
    },
    300_000,
  );
});

// ─── Grupo G — render REAL do pintor integrado (FQ-P2/P4 no navegador) ────────
//
// O render REAL roda em SUBPROCESSO (o CLI — o MESMO caminho do servidor
// da Onda 5, child-process): o guarda de rede do vitest bloqueia a
// conexao de loopback que o renderer do Remotion abre com o devtools do
// navegador, e o guarda nao alcanca subprocesso. O CLI e o contrato
// publico do render real — testa-lo e testar o servidor.

describe("render REAL do pedaco (Remotion headless)", () => {
  let ambiente: Ambiente;

  beforeAll(() => {
    ambiente = criarAmbiente();
  });

  afterAll(() => removerAmbiente(ambiente));

  it(
    "o arquivo real passa no oraculo completo: h264 1920x1080 30fps + aac, duracao do pedaco, conteudo",
    async () => {
      // Um pedaco pequeno (3s = 90 frames) para nao explodir o tempo da suite.
      const roteiro = roteiroDe([
        pedaco({
          tipo_visual: "texto",
          duracao_segundos: 3,
          titulo: "Preview real",
          especificacao_visual: "Render real do pintor integrado, com as fontes locais.",
        }),
      ]);
      const cli = rodarCli({
        roteiro,
        indice_pedaco: 0,
        opcoes: {
          store_raiz: ambiente.storeRaiz,
          cache_raiz: ambiente.cacheRaiz,
          previews_raiz: ambiente.previewsRaiz,
          resolucao_raiz: ambiente.resolucaoRaiz,
        },
      });
      expect(cli.status).toBe(0);
      const saida = JSON.parse(cli.stdout) as { hash: string; caminho: string; duracao_segundos: number };
      expect(readFileSync(saida.caminho).length).toBeGreaterThan(0);

      const conferencia: ConferenciaDoPreview = await conferirPreview(saida.hash, {
        previewsRaiz: ambiente.previewsRaiz,
      });
      expect(conferencia.codecVideo).toBe("h264");
      expect(conferencia.codecAudio).toBe("aac");
      expect(conferencia.largura).toBe(1920);
      expect(conferencia.altura).toBe(1080);
      expect(conferencia.fps).toBe(30);
      expect(conferencia.duracaoSegundos).toBeCloseTo(3, 1); // FQ-P4
      expect(saida.duracao_segundos).toBeCloseTo(3, 1);
      // FQ-P2: o texto sobre o fundo escuro da cena tem desvio > 1 por frame
      // (o mesmo criterio do produzir — o yavg sozinho reprovaria falso).
      expect(conferencia.medida.desvioMaximo).toBeGreaterThan(1);
      expect(conferencia.medida.yavgMaximo).toBeGreaterThan(16); // nao e preto chapado
    },
    300_000,
  );

  it(
    "sonda anti-C2 do grupo: conferirPreview de um hash inexistente e ErroPreviewVazio (a conferencia nao e vacua)",
    async () => {
      await expect(
        conferirPreview("0".repeat(64), { previewsRaiz: ambiente.previewsRaiz }),
      ).rejects.toBeInstanceOf(ErroPreviewVazio);
    },
  );
});
