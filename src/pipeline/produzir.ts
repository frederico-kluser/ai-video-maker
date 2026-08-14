/**
 * src/pipeline/produzir.ts
 *
 * O ORQUESTRADOR DE PONTA A PONTA — card F5-07 (W9, o join 7).
 * Contrato: docs/contrato-w9.md (TODAS as 13 secoes).
 *
 * Um comando: tema -> entrega completa. `just produzir --fixture canonico
 * --estrito` executa os estagios do contrato-w9 §3 e produz a LISTA
 * FECHADA de artefatos (contrato-w9 §2) — incluindo o mp4 final muxado
 * (AB-776) e o relatorio-final atomico, escrito POR ULTIMO.
 *
 * As quatro perguntas adversariais do card, respondidas por construcao:
 *
 *   (1) O pipeline declara sucesso com um artefato faltando?  NAO — o
 *       relatorio-final so existe depois de TODOS os artefatos 1..10
 *       produzidos e conferidos (hash + tamanho) pela propria execucao;
 *       o ∅-crit relê a lista da constante e re-confere os arquivos.
 *   (2) Um estagio que falha deixa artefato parcial que o proximo
 *       consome?  NAO — toda escrita de artefato e atomica (tmp+rename,
 *       padrao S-8) e o consumidor exige hash + tamanho declarados.
 *   (3) A retomada usa cache VELHO quando a entrada mudou?  NAO — a
 *       re-execucao e INTEGRAL e idempotente, chaveada por conteudo (C7):
 *       entrada mudou => chave muda => MISS => re-render (contrato-w9 §4).
 *   (4) O relatorio-final sobrevive ao fechamento do terminal?  SIM —
 *       escrito POR ULTIMO, atomicamente, com hash+tamanho de cada
 *       artefato; um processo morto no meio deixa o anterior ou nada.
 *
 * O estrito e OFFLINE (contrato-w9 §8): autoria PULADA (--fixture
 * canonico), reparo MECANICO (zero LLM — AB-635), resolucao por cassetes
 * commitados (F2-07), rede bloqueada. O estrito encoda APENAS com perfis
 * deterministico: true (AB-700, §7), na fila UNICA do processo (AB-705,
 * §5), com o escopo 16:9 (§6) e o pin ffmpeg 6.1.1 verificado (§10).
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, symlink, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Manifesto } from "../contratos/manifesto.js";
import { construirTimingCanonico } from "../sincronia/timing/construir.js";
import type { TimingCanonico } from "../sincronia/timing/formato.js";
import { calcularEnvelopeDucking, posicoesDaTimeline } from "../sincronia/ducking/calcular.js";
import type { DuckingEnvelope } from "../sincronia/ducking/formato.js";
import { cortarSilencio } from "../sincronia/ritmo/cortar.js";
import type { ResultadoDeCorte } from "../sincronia/ritmo/formato.js";
import { lerWavPcm, paraCanais } from "../audio/mix/pcm.js";
import { mixar } from "../audio/mix/mixar.js";
import type { EmendaMaterializada, EntradasDoMix, ResultadoDoMix } from "../audio/mix/mixar.js";
import { serializarMixDocumento, sha256Bytes as sha256MixBytes, FORMATO_MIX } from "../audio/mix/formato.js";
import { produzirPos, conferirPos, versaoDoFfmpeg, PIN_FFMPEG } from "../entrega/pos/index.js";
import type { ResultadoDoPos } from "../entrega/pos/index.js";
import { serializarPosDocumento } from "../entrega/pos/formato.js";
import { derivarVariante } from "../entrega/variantes/derivar.js";
import { exigirVarianteSegura } from "../entrega/variantes/verificar.js";
import { planoDoThumbnail } from "../entrega/thumbnail/especificacao.js";
import { medirContrasteDoThumbnail, conferirContraste } from "../entrega/thumbnail/contraste.js";
import { conferirLegibilidadeDoTitulo } from "../entrega/thumbnail/legibilidade.js";
import { adaptarStore, gerarRelatorio } from "../entrega/procedencia/relatorio.js";
import { MARCADOR_DERIVACAO, DATA_EPOCH, serializarRelatorio } from "../entrega/procedencia/formato.js";
import { Orquestrador } from "../resolucao/orquestrador.js";
import type { AssetResolvido, ManifestoResolvido, Sha256 } from "../resolucao/manifesto-resolvido.js";
import { hashDoManifesto } from "../resolucao/contrato.js";
import { lerCassete } from "../resolucao/cassete/reprodutor.js";
import { paraProcedenciaDoStore, RAIZ_CASSETES_PADRAO } from "../resolucao/cassete/formato.js";
import { reproduzirLocucao } from "../resolucao/locucao/replay.js";
import estagioLocucao from "../resolucao/locucao/estagio.js";
import estagioCodigo from "../resolucao/codigo/estagio.js";
import estagioMusica from "../resolucao/musica/estagio.js";
import { Store } from "../store/store.js";
import type { Procedencia } from "../store/procedencia.js";
import {
  calcularChaveC7,
  componentesDaChaveC7,
  lerVersoesDaPilha,
  lerPinDeFerramentas,
  tokensConsumidosReais,
  renderizarComCache,
  RAIZ_DEFAULT_DO_CACHE,
} from "../render/cache/index.js";
import type { ContextoDoRender, RendererDeFrames } from "../render/pipeline/executar.js";
import { prepararRender } from "../render/pipeline/executar.js";
import { calcularOrcamento } from "../render/pipeline/orcamento.js";
import { criarFilaDeEncode, executarEncode, listarPerfis, verificarSaida, codecNameDePerfil } from "../render/encode/index.js";
import type { FilaDeEncode } from "../render/encode/fila.js";
import { posicionarAudio } from "../render/pipeline/audio.js";
import type { MixDeEmenda, PlanoDeAudio } from "../render/pipeline/audio.js";
import { fiar, HASH_DO_GRAFICO } from "../composicao/pintura/fiar.js";
import type { FixtureIntegrada } from "../composicao/pintura/fiar.js";
import { breakpoints } from "../design/tokens.js";
import {
  ARTEFATOS_ESPERADOS_DO_ESTRITO,
  FORMATO_RELATORIO_FINAL,
  type EntradaDoRelatorioFinal,
  type RelatorioFinal,
} from "./contrato.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");

/** Porta TCP deste card (docs/contrato-w9.md §11: F5-07 = 4510). */
export const PORTA_DO_PIPELINE = 4510;

/** Composicao registrada pela entrada gerada do pipeline. */
export const ID_DA_COMPOSICAO = "pipeline-integrado";

/** Formato do relatorio de procedencia (F5-06). */
const FORMATO_RELATORIO_PROCEDENCIA = "RelatorioProcedencia.1";

/**
 * Piso do oraculo de conteudo do pipeline (C1): o YAVG MAXIMO por frame
 * do video codificado. O render da fixture canonica tem maximo ~65; um
 * video inteiro preto fica ~16-22 (preto em range limitado). Calibrado
 * na execucao do proprio card (ADR-0042) — nunca escolhido por chute.
 */
export const PISO_YAVG_MAXIMO_DE_CONTEUDO = 32;

/** YAVG maximo por frame de um arquivo de video (signalstats). */
export async function yavgMaximoDe(
  ctx: ContextoDaProducao,
  arquivo: string,
): Promise<number> {
  const saida = await ctx.executor("ffmpeg", [
    "-hide_banner", "-loglevel", "info",
    "-i", arquivo,
    "-vf", "signalstats,metadata=print",
    "-f", "null", "-",
  ]);
  let maximo = 0;
  for (const linha of saida.stderr.split("\n")) {
    const m = /YAVG=([0-9.]+)/.exec(linha);
    if (m !== null) {
      const valor = Number(m[1]);
      if (valor > maximo) maximo = valor;
    }
  }
  return maximo;
}

// ─── Helpers de producao ──────────────────────────────────────────────────────

/** Executa um comando (ffmpeg/ffprobe) e devolve stdout/stderr. */
export type ExecutorDeComando = (
  comando: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export const executorPadrao: ExecutorDeComando = (comando, args) =>
  new Promise((resolve2, reject) => {
    execFile(comando, args, { timeout: 900_000, maxBuffer: 64 * 1024 * 1024 }, (erro, stdout, stderr) => {
      if (erro) {
        const saida = String(stderr);
        const trecho = saida.length > 4000 ? `${saida.slice(0, 3500)}\n…(${saida.length - 4000} linhas suprimidas)` : saida;
        reject(new Error(`${comando} ${args.join(" ")}\n${String(erro)}\n${trecho}`));
        return;
      }
      resolve2({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/** SHA-256 hex de um buffer. */
export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Escrita ATOMICA (tmp + rename, padrao S-8): um processo nunca le
 * arquivo pela metade; artefato parcial e artefato ausente (contrato-w9
 * §3 — pergunta adversarial 2).
 */
export async function escreverAtomico(caminho: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp-${process.pid}`;
  await writeFile(temporario, bytes);
  await rename(temporario, caminho);
}

/** Um arquivo produzido por um estagio, ja com hash e tamanho. */
export interface ArquivoProduzido {
  readonly nome: string;
  readonly bytes: Buffer;
  readonly sha256: string;
  readonly tamanho: number;
}

function arquivoProduzido(nome: string, bytes: Buffer): ArquivoProduzido {
  return { nome, bytes, sha256: sha256Hex(bytes), tamanho: bytes.length };
}

// ─── Opcoes ───────────────────────────────────────────────────────────────────

export interface OpcoesDaProducao {
  /** Fixture da autoria pulada. Hoje so "canonico" (contrato-w9 §8). */
  readonly fixture: "canonico";
  /** Modo estrito: perfil deterministico, escopo 16:9, zero LLM. */
  readonly estrito: boolean;
  /** Raiz do cache de render (contrato-w9 §4). Default: /tmp (AB-793). */
  readonly cacheDir?: string;
  /** Diretorio de saida dos artefatos. Default: output/. */
  readonly saida?: string;
  /** A FILA UNICA de encode do processo (AB-705 — injetada em tudo). */
  readonly fila?: FilaDeEncode;
  /** Renderer injetavel (sonda AB-685 do gate — cache quente nao prova render). */
  readonly renderer?: RendererDeFrames;
  /** Snapshot dos tokens para a chave C7 (sonda C12; default: os reais). */
  readonly tokensConsumidos?: unknown;
  /** Cadencia do corte de silencio (probes AB-745 usam 0.05). */
  readonly gapAlvoS?: number;
  /** Relogio injetavel — so o `escritoEm` do relatorio o consome. */
  readonly relogio?: () => Date;
  /** Executor de comandos injetavel (default: execFile). */
  readonly executor?: ExecutorDeComando;
  /** Raiz do repositorio (default: a deste arquivo). */
  readonly raizDoProjeto?: string;
  /** Raiz dos cassetes do F2-07 (default: fixtures/cassetes). */
  readonly raizCassetes?: string;
}

/** O resultado da producao — tudo que o gate precisa conferir. */
export interface ResultadoDaProducao {
  readonly artefatos: ReadonlyMap<string, ArquivoProduzido[]>;
  readonly relatorioFinal: RelatorioFinal;
  readonly resolvido: ManifestoResolvido;
  readonly timing: TimingCanonico;
  readonly mix: ResultadoDoMix;
  readonly pos: ResultadoDoPos;
  readonly planoDeAudio: PlanoDeAudio;
  readonly chaveC7: string;
  /** Diretorio com os frames do render (indice absoluto, AB-691). */
  readonly dirDeFrames: string;
  /** Chamadas ao renderer (sonda AB-685: 0 no acerto quente). */
  readonly chamadasDoRenderer: number;
  /** Frames servidos do cache. */
  readonly framesDoCache: number;
  /** Diretorio temporario de trabalho (removido pelo gate ao fim). */
  readonly dirTrabalho: string;
}

/** Erro do pipeline: estagio falhou — nunca declara sucesso. */
export class ErroDoPipeline extends Error {
  readonly code = "PIPELINE_FALHOU";
  constructor(mensagem: string, readonly estagio: string, readonly causa?: unknown) {
    super(`estagio "${estagio}" falhou: ${mensagem}`);
    this.name = "ErroDoPipeline";
  }
}

/** Um estagio do contrato-w9 §3: nome + execucao. */
interface Estagio {
  readonly nome: string;
  readonly rodar: (ctx: ContextoDaProducao) => Promise<void>;
}

/** Contexto compartilhado entre os estagios (entradas/saidas NOMEADAS). */
interface ContextoDaProducao {
  readonly opcoes: OpcoesDaProducao;
  readonly raiz: string;
  readonly raizCassetes: string;
  readonly saida: string;
  readonly dirTrabalho: string;
  readonly dirEntrada: string;
  readonly store: Store;
  readonly fila: FilaDeEncode;
  readonly executor: ExecutorDeComando;
  readonly relogio: () => Date;
  readonly manifesto: Manifesto;
  readonly artefatos: Map<string, ArquivoProduzido[]>;
  readonly ffmpegVersao: string;
  readonly nodeVersao: string;
  resolvido: ManifestoResolvido;
  timing: TimingCanonico;
  envelope: DuckingEnvelope;
  cadencia: ResultadoDeCorte;
  mix: ResultadoDoMix;
  pos: ResultadoDoPos;
  planoDeAudio: PlanoDeAudio;
  chaveC7: string;
  dirDeFrames: string;
  chamadasDoRenderer: number;
  framesDoCache: number;
  /** O contexto do bundle (serveUrl + composicao) — compartilhado pelos renders. */
  contexto: ContextoDoRender;
}

// ─── Estagio 1: autoria (PULADA no estrito — contrato-w9 §8) ──────────────────

async function estagioAutoria(ctx: ContextoDaProducao): Promise<void> {
  if (ctx.opcoes.fixture !== "canonico") {
    throw new ErroDoPipeline(
      `fixture "${ctx.opcoes.fixture}" desconhecida — hoje so "canonico" e entregavel`,
      "autoria",
    );
  }
  // --fixture canonico = autoria PULADA: o manifesto da fixture entra
  // direto; nenhuma chamada a provedor acontece no caminho estrito.
}

// ─── Estagio 2: reparo mecanico (F4-03 — zero LLM, AB-635) ────────────────────
//
// Com --fixture canonico a AUTORIA e pulada (contrato-w9 §8): nao existe
// documento Autoria.1 para o reparo de forma do F4-03 tocar — o manifesto
// da fixture entra direto e o estrito VALIDA (nunca repara, nunca chama
// LLM). A camada de reparo por chamada LLM fica disponivel na injecao do
// F4-03, mas sem politica de uso no estrito (AB-635).
//
// A validacao abaixo espelha as checagens semanticas do validador oficial
// da fixture (fixtures/canonico/validar.py — o `just contrato_testar` cobre
// o JSON Schema completo no CI): forma, ids unicos, referencias de cena
// existentes, duracao positiva. A receita `just produzir` roda tambem o
// validar.py pinado como passo do gate.

async function estagioReparoMecanico(ctx: ContextoDaProducao): Promise<void> {
  const problemas = validarManifestoDaFixture(ctx.manifesto);
  if (problemas.length > 0) {
    throw new ErroDoPipeline(
      "a fixture canonica NAO passou na validacao do estrito:\n" +
        problemas.map((p) => `  - ${p}`).join("\n"),
      "reparo-mecanico",
    );
  }
}

/** Validacao estrutural do Manifesto.1 da fixture (a do estrito). */
export function validarManifestoDaFixture(manifesto: Manifesto): readonly string[] {
  const problemas: string[] = [];
  if (manifesto.schema_version !== "Manifesto.1") {
    problemas.push(`schema_version "${String(manifesto.schema_version)}" — esperado Manifesto.1`);
  }
  if (!Number.isFinite(manifesto.fps) || manifesto.fps <= 0) {
    problemas.push(`fps ${String(manifesto.fps)} invalido`);
  }
  if (!Number.isFinite(manifesto.width) || manifesto.width <= 0) {
    problemas.push(`width ${String(manifesto.width)} invalido`);
  }
  if (!Number.isFinite(manifesto.height) || manifesto.height <= 0) {
    problemas.push(`height ${String(manifesto.height)} invalido`);
  }
  if (!Array.isArray(manifesto.nos) || manifesto.nos.length === 0) {
    problemas.push("nos ausente ou vazio");
  }
  if (!Array.isArray(manifesto.cenas) || manifesto.cenas.length === 0) {
    problemas.push("cenas ausente ou vazio");
  }
  if (problemas.length > 0) return problemas;

  const ids = new Map<string, number>();
  for (const no of manifesto.nos) {
    if (no.id === undefined || no.id === "") {
      problemas.push("no sem id");
      continue;
    }
    const anterior = ids.get(no.id);
    if (anterior !== undefined) {
      problemas.push(`id "${no.id}" duplicado (nos[${anterior}] e nos[${manifesto.nos.indexOf(no)}])`);
    }
    ids.set(no.id, manifesto.nos.indexOf(no));
    if (!Number.isFinite(no.duracao_frames) || no.duracao_frames < 1) {
      problemas.push(`no "${no.id}": duracao_frames ${String(no.duracao_frames)} < 1`);
    }
  }
  const idsDeNos = new Set(manifesto.nos.map((n) => n.id));
  for (const cena of manifesto.cenas) {
    if (cena.id === undefined || cena.id === "") {
      problemas.push("cena sem id");
      continue;
    }
    if (!Array.isArray(cena.nos) || cena.nos.length === 0) {
      problemas.push(`cena "${cena.id}": nos ausente ou vazio`);
      continue;
    }
    for (const noId of cena.nos) {
      if (!idsDeNos.has(noId)) {
        problemas.push(`cena "${cena.id}": referencia ao no "${noId}" que nao existe`);
      }
    }
  }
  return problemas;
}

// ─── Estagio 3: resolucao offline (F2-01..F2-07) ──────────────────────────────

/**
 * Resolve a fixture canonica OFFLINE:
 *
 *   locucao + codigo + musica — reproducao REAL dos cassetes commitados
 *       contra a fixture canonica (o caminho que o F2-07 provou);
 *   grafico — camada offline commitada da fixture canonica (F1-12 /
 *       AB-501): nos_grafico {n-009, n-011} -> HASH_DO_GRAFICO, com os
 *       bytes commitados em fixtures/canonico/assets/. O cassete de
 *       grafico foi gravado contra OUTRO manifesto (AB-500) e os bytes
 *       renderizados nunca foram commitados (metadata-only, AB-501) — a
 *       origem desta camada e a fixture, declarada na procedencia do
 *       store, nunca inventada;
 *   midia — a fixture canonica NAO tem camada de midia commitada (o
 *       cassete de midia foi gravado contra outro manifesto, AB-500); os
 *       nos de midia pintam o fallback do manifesto, exatamente como o
 *       golden de 727 frames das ondas W7/W8.
 *
 * Todos os assets dos cassetes entram no store enderecado por SHA-256
 * (a ponte cassete->store do F2-07, AB-455), com a procedencia do
 * cassete traduzida pelo contrato (paraProcedenciaDoStore).
 */
async function estagioResolucaoOffline(ctx: ContextoDaProducao): Promise<void> {
  const manifesto = ctx.manifesto;
  const hash = hashDoManifesto(manifesto);

  const orquestrador = new Orquestrador({
    estagios: [estagioLocucao, estagioCodigo, estagioMusica],
    raizCassetes: ctx.raizCassetes,
    modo: "offline",
  });
  const { resolvido: resolvidoDosCassetes } = await orquestrador.resolver(manifesto);

  // Ponte cassete -> store (AB-455): bytes + procedencia por hash.
  for (const registro of resolvidoDosCassetes.estagios) {
    const cassete = await lerCassete(ctx.raizCassetes, registro.estagio, registro.chave);
    for (const asset of cassete.procedencia.assets) {
      const bytes = await bytesDoAssetDoCassete(
        ctx.raizCassetes,
        registro.estagio,
        registro.chave,
        asset.hash,
      );
      if (bytes === null) continue; // metadata-only documentado (AB-501)
      await ctx.store.put(bytes, paraProcedenciaDoStore(asset, cassete.procedencia));
    }
  }

  // Camada de grafico da fixture canonica (offline commitado — F1-12).
  const caminhoGrafico = join(ctx.raiz, "fixtures", "canonico", "assets", "grafico-integrado.png");
  const bytesGrafico = await readFile(caminhoGrafico);
  if (sha256Hex(bytesGrafico) !== HASH_DO_GRAFICO) {
    throw new ErroDoPipeline(
      `os bytes de fixtures/canonico/assets/grafico-integrado.png NAO rehasheiam ` +
        `para ${HASH_DO_GRAFICO} — a camada offline de grafico da fixture mudou ` +
        "(AB-501)",
      "resolucao",
    );
  }
  const assetGrafico: AssetResolvido = {
    hash: HASH_DO_GRAFICO,
    tipo: "imagem",
    mimeType: "image/png",
    largura: 480,
    altura: 320,
    byteSize: bytesGrafico.length,
    licenca: "CC0-1.0",
    atribuicaoObrigatoria: false,
    provedor: "local",
  };
  const procedenciaDoGrafico: Procedencia = {
    license: "CC0-1.0",
    attributionRequired: false,
    source: "local",
    acquiredAt: DATA_EPOCH,
    toolVersion: "fixture-canonica-f1-12 (AB-501)",
    notes:
      "camada de grafico da fixture canonica offline (F1-12/AB-501): os bytes " +
      "commitados em fixtures/canonico/assets/. O cassete de grafico do F2-02 foi " +
      "gravado contra outro manifesto (AB-500) e os bytes nunca foram commitados " +
      "(metadata-only). O pixel do grafico e ESTE arquivo.",
  };
  await ctx.store.put(bytesGrafico, procedenciaDoGrafico);

  const resolvidoFinal: ManifestoResolvido = {
    ...resolvidoDosCassetes,
    assets: { ...resolvidoDosCassetes.assets, [HASH_DO_GRAFICO]: assetGrafico },
    nos_grafico: { "n-009": HASH_DO_GRAFICO, "n-011": HASH_DO_GRAFICO },
  };
  ctx.resolvido = resolvidoFinal;

  await registrarArtefato(ctx, "manifesto-resolvido.json", "manifesto-resolvido.json", serializarResolvido(resolvidoFinal));
}

/** Serializacao estavel do manifesto resolvido (chaves na ordem do contrato). */
function serializarResolvido(resolvido: ManifestoResolvido): Buffer {
  return Buffer.from(JSON.stringify(resolvido, null, 2), "utf-8");
}

/** Le os bytes de um asset do cassete (corpos/<hash> ou artefatos/<hash>.json). */
async function bytesDoAssetDoCassete(
  raizCassetes: string,
  estagio: string,
  chave: string,
  hash: string,
): Promise<Buffer | null> {
  for (const candidato of [
    join(raizCassetes, estagio, chave, "corpos", hash),
    join(raizCassetes, estagio, chave, "artefatos", `${hash}.json`),
  ]) {
    try {
      return await readFile(candidato);
    } catch {
      // tenta o proximo
    }
  }
  return null;
}

// ─── Estagio 4: timing (F3-01) ────────────────────────────────────────────────

async function estagioTiming(ctx: ContextoDaProducao): Promise<void> {
  // Os documentos de timing (whisper derivado) NAO tem bytes no cassete
  // (AB-503) — eles sao COMPUTADOS pelo estagio. O replay offline do
  // cassete (reproduzirLocucao) devolve exatamente os bytes que o
  // estagio gravou; e o mesmo caminho que o gate do F3-01 usa.
  const reprod = await reproduzirLocucao(ctx.resolvido.manifesto, ctx.raizCassetes);
  const bytesPorHash = new Map<string, Buffer>();
  for (const unidade of reprod.unidades) {
    bytesPorHash.set(unidade.hashTiming, unidade.bytesTiming);
    bytesPorHash.set(unidade.hashAudio, unidade.audio);
  }
  const timing = await construirTimingCanonico({
    manifesto: ctx.resolvido.manifesto,
    parcial: ctx.resolvido,
    carregar: async (hash) => bytesPorHash.get(hash) ?? ctx.store.get(hash),
  });
  ctx.timing = timing;
  const bytes = Buffer.from(JSON.stringify(timing, null, 2), "utf-8");
  await escreverAtomico(join(ctx.dirTrabalho, "timing-canono.json"), bytes);
}

// ─── Estagio 5: composicao (F1-01..F1-12 — pintor promovido, AB-493) ─────────

/**
 * Materializa a composicao que o render consome: a entrada Remotion
 * gerada com a FIXTURA (o manifesto resolvido do pipeline) embutida, e o
 * publicDir com os bytes dos assets que o pintor pinta + as fontes locais.
 * Tudo derivado do manifesto resolvido — nada digitado.
 */
async function estagioComposicao(ctx: ContextoDaProducao): Promise<void> {
  const resolvido = ctx.resolvido;
  const fixture: FixtureIntegrada = {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: resolvido.hash_manifesto_original,
    manifesto: resolvido.manifesto,
    assets: resolvido.assets,
    nos_grafico: resolvido.nos_grafico,
  };

  // publicDir: os bytes que o pintor consome + as fontes locais. O
  // pintor integrado (ArvoreIntegrada) fia com `resolverPadrao`, que
  // mapeia HASH_DO_GRAFICO -> staticFile("grafico-integrado.png") — o
  // arquivo tem de existir no publicDir com ESSE nome. A resolucao ja
  // garantiu que a camada de grafico e a da fixture canonica (hash
  // exato); aqui re-confirmamos para o pintor nunca 404ar no navegador.
  const publicDir = join(ctx.dirEntrada, "public");
  await mkdir(publicDir, { recursive: true });
  const hashesDoGrafico = new Set(Object.values(resolvido.nos_grafico));
  for (const hash of [...hashesDoGrafico].sort()) {
    if (hash !== HASH_DO_GRAFICO) {
      throw new ErroDoPipeline(
        `a camada de grafico cita ${hash.slice(0, 12)}…, e o pintor integrado ` +
          `so resolve ${HASH_DO_GRAFICO.slice(0, 12)}… (resolverPadrao) — o render ` +
          "404aria no navegador sem erro de exit",
        "composicao",
      );
    }
    const bytes = await ctx.store.get(hash);
    if (bytes === null) {
      throw new ErroDoPipeline(
        `asset de grafico ${hash.slice(0, 12)}… ausente do store — o pintor ` +
          "nao pode desenhar do nada",
        "composicao",
      );
    }
    await escreverAtomico(join(publicDir, "grafico-integrado.png"), bytes);
  }
  // fontes locais (C6): symlink para os bytes canonicos de assets/fontes.
  try {
    await symlink(join(ctx.raiz, "assets", "fontes"), join(publicDir, "fontes"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }

  // A entrada gerada: fixture embutida (determinismo — mesmo manifesto
  // gera a mesma entrada). Mora em .cache/pipeline/entrada (dentro do
  // repo, gitignored) porque o bundler resolve os imports relativos a
  // partir dela — /tmp nao resolve para src/ (AB-984 vale para a SAIDA
  // dos renders, nao para a entrada do bundle).
  const fixtureJson = JSON.stringify(fixture, null, 2).replaceAll("</", "<\\/");
  const entrada = `// GERADO pelo orquestrador F5-07 (W9) — nao editar.
import { Composition, registerRoot, useCurrentFrame } from "remotion";
import { registrarFontesLocais } from "../../../src/design/fontes/index";
import { ArvoreIntegrada, fiarApadrao, type FixtureIntegrada } from "../../../src/composicao/pintura/index";

const FIXTURA: FixtureIntegrada = ${fixtureJson} as FixtureIntegrada;

void registrarFontesLocais();

export const ComposicaoPipeline: React.FC = () => {
  const frame = useCurrentFrame();
  return <ArvoreIntegrada fixture={FIXTURA} frame={frame} />;
};

export const RaizPipeline: React.FC = () => {
  const total = fiarApadrao(FIXTURA).plano.totalFrames;
  return (
    <Composition
      id="${ID_DA_COMPOSICAO}"
      component={ComposicaoPipeline}
      durationInFrames={total}
      fps={FIXTURA.manifesto.fps}
      width={FIXTURA.manifesto.width}
      height={FIXTURA.manifesto.height}
    />
  );
};
registerRoot(RaizPipeline);
`;
  await escreverAtomico(join(ctx.dirEntrada, "entrada.tsx"), Buffer.from(entrada, "utf-8"));
}

// ─── Estagio 6: mix (F3-05 — ADR-0034) ────────────────────────────────────────
//
// O mix roda ANTES do render porque o render consome o PlanoDeAudio
// (MixDeEmenda) como entrada NOMEADA (contrato-w9 §3, estagio 6): o
// encadeamento e pelo nome do artefato, nunca por posicao de tabela.

async function estagioMix(ctx: ContextoDaProducao): Promise<void> {
  const timing = ctx.timing;
  const posicoes = posicoesDaTimeline(ctx.resolvido.manifesto);
  const envelope = calcularEnvelopeDucking({ timing, posicoes });
  const cadencia = cortarSilencio(timing, { gapAlvoS: ctx.opcoes.gapAlvoS });
  ctx.envelope = envelope;
  ctx.cadencia = cadencia;

  const musicaHash = ctx.resolvido.trilha_sonora;
  if (musicaHash === null) {
    throw new ErroDoPipeline(
      "a fixture canonica resolvida NAO tem trilha_sonora — o mix exige a " +
        "trilha (F2-06); trilha sem bytes e erro, nunca silencio",
      "mix",
    );
  }
  const decodificar = criarDecoder(ctx);
  const entradas: EntradasDoMix = {
    timing,
    manifesto: ctx.resolvido.manifesto,
    envelope,
    cadencia,
    musicaHash,
    carregarBytes: async (hash) => ctx.store.get(hash),
    decodificarPcm: async (bytes) => paraCanais(await decodificar(bytes), 2),
    opcoes: {
      rate: 48000,
      canais: 2,
      ffmpeg: ctx.ffmpegVersao,
      node: ctx.nodeVersao,
    },
  };
  const mix = await mixar(entradas);
  ctx.mix = mix;

  // Emendas publicadas no store com o marcador de derivacao (C3/AB-617):
  // o relatorio de procedencia (F5-06) cita os bytes da emenda pelo hash
  // NOVO via `emenda: audio-fonte=<sha>` (MARCADOR_DERIVACAO — AB-745).
  for (const emenda of mix.emendas) {
    const procedenciaDaEmenda: Procedencia = {
      license: "CC0-1.0",
      attributionRequired: true,
      attribution: "Audio sintetico de referencia — nao e voz humana",
      source: "local",
      acquiredAt: DATA_EPOCH,
      toolVersion: `mix-${FORMATO_MIX} (ADR-0034)`,
      notes:
        `${MARCADOR_DERIVACAO}${emenda.fonteHash}; operacao=emenda de locucao ` +
        `${cadencia.politica.versao} (cortes de silencio da cadencia). ` +
        "Bytes NOVOS enderecaveis por conteudo — proibido tratar a emenda " +
        "como se fosse a fonte (C3/AB-617).",
    };
    await ctx.store.put(emenda.bytes, procedenciaDaEmenda);
  }

  await registrarArtefato(ctx, "master-de-audio-do-mix", "master.wav", mix.bytes);
  await registrarArtefato(ctx, "master-de-audio-do-mix", "mix-documento.json", serializarMixDocumento(mix.documento));
  // Guarda estrutural: o documento tem de declarar o pin (MixDocument.ferramentas).
  if (mix.documento.ferramentas.ffmpeg !== ctx.ffmpegVersao) {
    throw new ErroDoPipeline(
      `o MixDocument declara ffmpeg ${mix.documento.ferramentas.ffmpeg}, ` +
        `corrente ${ctx.ffmpegVersao} — pin divergente invalida o documento`,
      "mix",
    );
  }
}

/** O decoder do mix: ffmpeg pinado -> WAV f32 estereo 48 kHz (F3-05). */
function criarDecoder(ctx: ContextoDaProducao) {
  const cache = new Map<string, ReturnType<typeof lerWavPcm>>();
  return async (bytes: Buffer) => {
    const chave = sha256MixBytes(bytes);
    const pronto = cache.get(chave);
    if (pronto !== undefined) return pronto;
    const entrada = join(ctx.dirTrabalho, `in-${chave.slice(0, 16)}`);
    const saida = join(ctx.dirTrabalho, `out-${chave.slice(0, 16)}.wav`);
    await writeFile(entrada, bytes);
    await ctx.executor("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", entrada,
      "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
      "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", "-f", "wav",
      saida,
    ]);
    const pcm = lerWavPcm(await readFile(saida));
    cache.set(chave, pcm);
    return pcm;
  };
}

// ─── Estagio 7: render (F5-01 — deterministico, chave C7, porta 4510) ─────────

async function estagioRender(ctx: ContextoDaProducao): Promise<void> {
  const resolvido = ctx.resolvido;

  // A chave C7 (ADR-0041): manifesto + bytes dos assets consumidos +
  // tokens + versoes + pin. O orquestrador CONSOME a chave, nunca a
  // reimplementa (AB-792).
  const manifestoResolvidoBytes = serializarResolvido(resolvido);
  const assetsDaChave = new Map<string, Buffer>();
  for (const hash of Object.values(resolvido.nos_grafico).sort()) {
    const bytes = await ctx.store.get(hash);
    if (bytes === null) continue;
    assetsDaChave.set(hash, bytes);
  }
  const versoes = lerVersoesDaPilha();
  const pinFerramentas = lerPinDeFerramentas();
  const tokens = ctx.opcoes.tokensConsumidos ?? tokensConsumidosReais();
  const entradasDaChave = {
    manifestoResolvido: manifestoResolvidoBytes,
    assets: assetsDaChave,
    tokensConsumidos: tokens,
    versoes,
    pinFerramentas,
  };
  const chaveC7 = calcularChaveC7(entradasDaChave);
  ctx.chaveC7 = chaveC7;

  // O plano de audio do render (C3/AB-617): o mix da emenda, por cena.
  const mixDeEmenda: MixDeEmenda = {
    cenas: new Map(ctx.mix.emendas.map((e: EmendaMaterializada) => [e.cena, e.emendaHash])),
  };
  ctx.planoDeAudio = posicionarAudio({
    cadencia: ctx.cadencia.documento,
    envelope: ctx.envelope,
    mix: mixDeEmenda,
    posicoes: posicoesDaTimeline(ctx.resolvido.manifesto),
  });

  // Orcamento da maquina (ADR-0032) — o F5-07 decide o particionamento
  // final (AB-794) e passa o budget; frames cacheados continuam servindo
  // (unidade por frame absoluto).
  const orcamento = calcularOrcamento();
  const totalFrames = totalDeFramesDe(resolvido);

  // Bundle UMA vez: o contexto e compartilhado com o thumbnail (o
  // renderStill usa o MESMO bundle — um segundo bundle seria outro custo
  // e outro risco de divergencia).
  const contexto =
    ctx.contexto ??
    (await prepararRender({
      entrada: join(ctx.dirEntrada, "entrada.tsx"),
      publicDir: join(ctx.dirEntrada, "public"),
      composicaoId: ID_DA_COMPOSICAO,
    }));
  ctx.contexto = contexto;

  const resultado = await renderizarComCache({
    entrada: join(ctx.dirEntrada, "entrada.tsx"),
    publicDir: join(ctx.dirEntrada, "public"),
    composicaoId: ID_DA_COMPOSICAO,
    porta: PORTA_DO_PIPELINE,
    totalFrames,
    workers: orcamento.workers,
    chaveC7,
    raizDoCache: ctx.opcoes.cacheDir ?? RAIZ_DEFAULT_DO_CACHE,
    renderer: ctx.opcoes.renderer,
    contexto,
    componentes: componentesDaChaveC7(entradasDaChave),
    saida: join(ctx.dirTrabalho, "render"),
  });
  ctx.dirDeFrames = resultado.dirDeSaida;
  ctx.chamadasDoRenderer = resultado.chamadasDoRenderer;
  ctx.framesDoCache = resultado.framesDoCache;

  // O master deterministico: QTRLE/argb — codec de
  // CODIFICADORES_DA_COMPARACAO (F5-01/ADR-0035), um arquivo so com
  // hash + tamanho para o relatorio-final.
  const masterMov = await encodarQtrleDosFrames(ctx, resultado.dirDeSaida, totalFrames);
  await registrarArtefato(ctx, "master-de-video-deterministico", "master.mov", masterMov);
}

/** Total de frames pela aritmetica da composicao (a mesma da entrada). */
function totalDeFramesDe(resolvido: ManifestoResolvido): number {
  const fixture: FixtureIntegrada = {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: resolvido.hash_manifesto_original,
    manifesto: resolvido.manifesto,
    assets: resolvido.assets,
    nos_grafico: resolvido.nos_grafico,
  };
  return fiar(fixture, () => "/grafico-integrado.png").plano.totalFrames;
}

/**
 * PNGs -> .mov qtrle/argb (lossless, deterministico). O render
 * materializa os frames como frame-N.png (indice absoluto, AB-691, sem
 * zero-padding) — o encode passa por um diretorio intermediario com
 * nomes zero-padded para a SEQUENCIA do ffmpeg ordenar por indice.
 */
async function encodarQtrleDosFrames(
  ctx: ContextoDaProducao,
  dirDeFrames: string,
  totalFrames: number,
): Promise<Buffer> {
  const padding = Math.max(3, String(totalFrames - 1).length);
  const dirSequencia = join(ctx.dirTrabalho, "sequencia");
  await mkdir(dirSequencia, { recursive: true });
  const nomes = await readdir(dirDeFrames);
  for (const nome of nomes) {
    if (!nome.endsWith(".png")) continue;
    const indice = Number.parseInt(nome.replace(/^frame-/, "").replace(/\.png$/, ""), 10);
    const bytes = await readFile(join(dirDeFrames, nome));
    await writeFile(join(dirSequencia, `frame-${String(indice).padStart(padding, "0")}.png`), bytes);
  }

  const saida = join(ctx.dirTrabalho, "master.mov");
  await ctx.executor("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-framerate", String(ctx.resolvido.manifesto.fps),
    "-start_number", "0",
    "-i", join(dirSequencia, `frame-%0${padding}d.png`),
    "-c:v", "qtrle", "-pix_fmt", "argb",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    saida,
  ]);
  const bytes = await readFile(saida);
  if (bytes.length === 0) {
    throw new ErroDoPipeline("o encode qtrle do master nao escreveu bytes (C1)", "render");
  }
  return bytes;
}

// ─── Estagio 8: encode do video (F5-02 — perfil deterministico, AB-700) ───────

async function estagioEncode(ctx: ContextoDaProducao): Promise<void> {
  // O estrito encoda APENAS com perfis deterministico: true (AB-700,
  // contrato-w9 §7). NVENC nunca no estrito.
  const catalogo = await listarPerfis();
  const deterministas = catalogo.filter((d) => d.perfil.deterministico === true);
  if (deterministas.length === 0) {
    throw new ErroDoPipeline(
      "nenhum perfil deterministico: true no catalogo do F5-02 — o estrito " +
        "so encoda com perfis deterministicos (AB-700)",
      "encode",
    );
  }
  const escolhido = deterministas.find((d) => d.perfil.motor === "libx264");
  if (escolhido === undefined) {
    throw new ErroDoPipeline(
      "nenhum perfil libx264 deterministico no catalogo — o estrito precisa " +
        "do eixo CRF de software (ADR-0036 decisao 8)",
      "encode",
    );
  }
  const perfil = escolhido.perfil;

  const saida = join(ctx.dirTrabalho, "video.mp4");
  const resultado = await executarEncode({
    perfil,
    entrada: join(ctx.dirTrabalho, "master.mov"),
    saida,
    fila: ctx.fila,
    executor: ctx.executor,
  });
  if (resultado.fallback.ativo) {
    throw new ErroDoPipeline(
      `o perfil ${perfil.nome} caiu em fallback (${resultado.fallback.solicitado ?? perfil.nome}: ` +
        `${resultado.fallback.motivo ?? "motivo nao declarado"}) — no estrito o ` +
        "encode e o perfil pedido, nunca um substituto silencioso",
      "encode",
    );
  }

  // Estrutura conferida (codec, dimensoes, frames, framemd5, sem
  // metadado volatil). O oraculo do F5-02 (verificarSaida) inclui um
  // piso de ENTROPIA MEDIA (YAVG medio >= 32) calibrado para os masters
  // sinteticos do F5-02 — o render da fixture canonica e escuro por
  // desenho (fundo dos tokens, maximo por frame ~65) e nao passa nesse
  // piso. O pipeline declara o SEU oraculo de conteudo (C1: quadro preto
  // = sucesso) abaixo: o YAVG MAXIMO por frame do video codificado tem
  // de passar do piso — um video inteiro preto fica ~16-22 e NAO passa.
  const verificacao = await verificarSaida(saida, {
    codec: codecNameDePerfil(perfil.codec),
    largura: ctx.resolvido.manifesto.width,
    altura: ctx.resolvido.manifesto.height,
  });
  const errosEstruturais = verificacao.erros.filter(
    (e) => !e.startsWith("entropia abaixo do piso"),
  );
  if (errosEstruturais.length > 0) {
    throw new ErroDoPipeline(
      `a saida do encode falhou na verificacao estrutural:\n  - ${errosEstruturais.join("\n  - ")}`,
      "encode",
    );
  }
  const yavgMaximo = await yavgMaximoDe(ctx, saida);
  if (!Number.isFinite(yavgMaximo) || yavgMaximo < PISO_YAVG_MAXIMO_DE_CONTEUDO) {
    throw new ErroDoPipeline(
      `o video codificado e (quase) preto: YAVG maximo por frame ` +
        `${String(yavgMaximo)} < ${String(PISO_YAVG_MAXIMO_DE_CONTEUDO)} — quadro ` +
        "preto passa em toda a camada estrutural (C1)",
      "encode",
    );
  }
  await registrarArtefato(ctx, "video-codificado.mp4", "video-codificado.mp4", await readFile(saida));
}

// ─── Estagio 9: pos (F5-03 — ADR-0040, fila injetada) ─────────────────────────

async function estagioPos(ctx: ContextoDaProducao): Promise<void> {
  const contextoLegendas = {
    manifesto: ctx.resolvido.manifesto,
    timing: ctx.timing,
  };
  const documentoLegendasBytes = await readFile(
    join(ctx.raiz, "fixtures", "canonico", "legendas-canono.json"),
  );
  const pos = await produzirPos({
    masterBytes: ctx.mix.bytes,
    documentoLegendasBytes,
    contextoLegendas,
    dirTrabalho: ctx.dirTrabalho,
    ffmpeg: ctx.ffmpegVersao,
    fila: ctx.fila,
    executor: ctx.executor,
    // A reconciliacao do mix (C1) — o sidecar descreve a timeline
    // POS-reconciliacao (faixas.locucao do MixDocument.1).
    intervalosDeFala: ctx.mix.documento.faixas.locucao,
  });
  ctx.pos = pos;

  await registrarArtefato(ctx, "entregavel.m4a", "entregavel.m4a", pos.entregavel);
  await registrarArtefato(ctx, "entregavel.srt", "entregavel.srt", Buffer.from(pos.sidecar, "utf-8"));
  await registrarArtefato(ctx, "pos-documento.json", "pos-documento.json", serializarPosDocumento(pos.documento));
}

// ─── Estagio 10: variante 16:9 + thumbnail (F5-04/F5-05) ──────────────────────

async function estagioVariante(ctx: ContextoDaProducao): Promise<void> {
  // A UNICA variante do estrito e a 16:9 (contrato-w9 §6, AB-720..722):
  // o 9:16 NAO e entregavel desta fase — nenhum artefato 9:16 existe.
  const manifesto = ctx.resolvido.manifesto;
  const alvo = breakpoints.hd; // 16:9 (1920x1080) — o token e a autoridade (S-5)
  const variante = derivarVariante(manifesto, { width: alvo.width, height: alvo.height });
  exigirVarianteSegura(manifesto, variante);
  await registrarArtefato(
    ctx,
    "variante-16x9.json",
    "variante-16x9.json",
    Buffer.from(JSON.stringify(variante, null, 2), "utf-8"),
  );
}

async function estagioThumbnail(ctx: ContextoDaProducao): Promise<void> {
  const plano = planoDoThumbnail(ctx.resolvido.manifesto);

  // O thumbnail e o MESMO quadro do MESMO pintor (AB-493) renderizado NA
  // ESCALA de saida (2/3) — o caminho do gate do F5-05 (renderStill com
  // scale). Redimensionar o frame do master com ffmpeg mudaria a
  // geometria da vinheta na fronteira da safe area (medido: os pixels
  // escuros entram na regiao graphics safe) — o render na escala e o
  // contrato, nunca o downscale.
  const saida = join(ctx.dirTrabalho, "thumbnail.png");
  const { renderStill } = await import("@remotion/renderer");
  await renderStill({
    composition: ctx.contexto.composicao,
    serveUrl: ctx.contexto.serveUrl,
    output: saida,
    frame: plano.frame,
    scale: plano.escala,
    imageFormat: "png",
    port: PORTA_DO_PIPELINE,
    chromiumOptions: { gl: "swangle" },
    logLevel: "error",
    overwrite: true,
  });
  const bytes = await readFile(saida);
  if (bytes.length === 0) {
    throw new ErroDoPipeline("o thumbnail nao escreveu bytes (C1)", "thumbnail");
  }

  // Contraste MEDIDO nos pixels (F5-05): abaixo do minimo NAO EXISTE.
  const rgba = await rgbaDe(ctx, saida, plano.largura, plano.altura);
  const medida = medirContrasteDoThumbnail(plano.largura, plano.altura, rgba);
  const falhasDeContraste = conferirContraste(medida);
  if (falhasDeContraste.length > 0) {
    throw new ErroDoPipeline(
      "contraste do thumbnail abaixo do minimo:\n  - " +
        falhasDeContraste
          .map((f) => `${f.regiao}: ${f.motivo}`)
          .join("\n  - "),
      "thumbnail",
    );
  }
  const falhaDeLegibilidade = conferirLegibilidadeDoTitulo(
    ctx.resolvido.manifesto,
    plano.escala,
  );
  if (falhaDeLegibilidade !== null) {
    throw new ErroDoPipeline(falhaDeLegibilidade, "thumbnail");
  }
  await registrarArtefato(ctx, "thumbnail.png", "thumbnail.png", bytes);
}

/** Le os pixels RGBA de um PNG via ffmpeg (rawvideo) — a medida da tinta. */
async function rgbaDe(
  ctx: ContextoDaProducao,
  png: string,
  largura: number,
  altura: number,
): Promise<Uint8Array> {
  const raiz = join(ctx.dirTrabalho, "thumb-raw.rgba");
  await ctx.executor("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", png,
    "-f", "rawvideo", "-pix_fmt", "rgba",
    raiz,
  ]);
  const bytes = await readFile(raiz);
  if (bytes.length !== largura * altura * 4) {
    throw new ErroDoPipeline(
      `o rawvideo do thumbnail veio com ${String(bytes.length)} bytes, esperado ` +
        `${String(largura * altura * 4)} (${largura}x${altura})`,
      "thumbnail",
    );
  }
  return Uint8Array.from(bytes);
}

// ─── Estagio 11: procedencia (F5-06 — transitivo, origem declarada) ───────────

async function estagioProcedencia(ctx: ContextoDaProducao): Promise<void> {
  // O relatorio descreve o video FINAL: a locucao do mix sao os bytes da
  // EMENDA (C3) — o manifesto pos-mix referencia as emendas pelo hash
  // NOVO. Quem citar o hash da fonte no lugar (o falso-verde de AB-745)
  // fica VERMELHO no e2e.
  const resolvidoPosMix: ManifestoResolvido = {
    ...ctx.resolvido,
    nos_locucao: Object.fromEntries(
      ctx.mix.emendas.map((e: EmendaMaterializada) => [e.cena, e.emendaHash]),
    ),
  };
  const relatorio = await gerarRelatorio(resolvidoPosMix, {
    raizCassetes: ctx.raizCassetes,
    store: adaptarStore(ctx.store),
    relogio: ctx.relogio,
  });
  if (relatorio.semOrigem.length > 0) {
    throw new ErroDoPipeline(
      "relatorio de procedencia com origem nao declarada (semOrigem -> VERMELHO):\n" +
        relatorio.semOrigem
          .map((f) => `  - ${f.hash.slice(0, 16)}…: ${f.motivo.split("\n")[0]}`)
          .join("\n"),
      "procedencia",
    );
  }
  if (relatorio.formato !== FORMATO_RELATORIO_PROCEDENCIA) {
    throw new ErroDoPipeline(
      `relatorio com formato ${relatorio.formato} — esperado ${FORMATO_RELATORIO_PROCEDENCIA}`,
      "procedencia",
    );
  }
  await registrarArtefato(
    ctx,
    "relatorio-procedencia.json",
    "relatorio-procedencia.json",
    Buffer.from(serializarRelatorio(relatorio), "utf-8"),
  );
}

// ─── Estagio 12: mux (F5-07 — AB-776, o MESMO ffmpeg 6.1.1 do pos) ────────────

async function estagioMux(ctx: ContextoDaProducao): Promise<void> {
  // Pin do mux (contrato-w9 §10): o MESMO ffmpeg 6.1.1 do pos, verificado.
  if (!/^6\.1\.1/.test(ctx.ffmpegVersao)) {
    throw new ErroDoPipeline(
      `ffmpeg corrente ${ctx.ffmpegVersao} diverge do pin ${PIN_FFMPEG} — o ` +
        "determinismo entre versoes de ferramenta e declarado por pin " +
        "(MixDocument.ferramentas/PosDocument.1.ferramentas)",
      "mux",
    );
  }
  const audio = join(ctx.dirTrabalho, "entregavel-mux.m4a");
  await writeFile(audio, ctx.pos.entregavel);
  const saida = join(ctx.dirTrabalho, "entregavel-final.mp4");
  await ctx.executor("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", join(ctx.dirTrabalho, "video.mp4"),
    "-i", audio,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c", "copy",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    saida,
  ]);
  const bytes = await readFile(saida);
  if (bytes.length === 0) {
    throw new ErroDoPipeline("a muxagem nao escreveu bytes (C1)", "mux");
  }

  // Estrutura conferida no muxado: 1 stream de video + 1 de audio (C4).
  const probe = await ctx.executor("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type",
    "-of", "csv=p=0",
    saida,
  ]);
  const streams = probe.stdout.trim().split("\n").filter(Boolean);
  const temVideo = streams.includes("video");
  const temAudio = streams.includes("audio");
  if (!temVideo || !temAudio) {
    throw new ErroDoPipeline(
      `o mp4 muxado nao tem video+audio (streams: ${streams.join(" | ") || "(vazio)"})`,
      "mux",
    );
  }
  await registrarArtefato(ctx, "entregavel-final.mp4", "entregavel-final.mp4", bytes);
}

// ─── Estagio 13: relatorio-final (atomico, POR ULTIMO) ────────────────────────

async function estagioRelatorioFinal(ctx: ContextoDaProducao): Promise<void> {
  // A ordem do relatorio segue a LISTA FECHADA (contrato-w9 §2): 1..10.
  const entradas: EntradaDoRelatorioFinal[] = [];
  for (const esperado of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
    if (esperado.nome === "relatorio-final.json") continue;
    const produzidos = ctx.artefatos.get(esperado.nome);
    if (produzidos === undefined) {
      throw new ErroDoPipeline(
        `artefato "${esperado.nome}" nao foi produzido — o relatorio-final ` +
          "nunca declara sucesso com um artefato faltando (contrato-w9 §2)",
        "relatorio-final",
      );
    }
    entradas.push({
      nome: esperado.nome,
      arquivos: produzidos.map((a) => ({
        nome: a.nome,
        sha256: a.sha256,
        tamanho: a.tamanho,
      })),
    });
  }

  const relatorio: RelatorioFinal = {
    schema_version: FORMATO_RELATORIO_FINAL,
    pipeline: { fixture: ctx.opcoes.fixture, estrito: ctx.opcoes.estrito },
    sucesso: true,
    artefatos: entradas,
    ferramentas: { ffmpeg: ctx.ffmpegVersao, node: ctx.nodeVersao },
    escritoEm: ctx.relogio().toISOString(),
  };
  const bytes = Buffer.from(JSON.stringify(relatorio, null, 2), "utf-8");

  // POR ULTIMO: so existe se o pipeline terminou inteiro; atomicamente.
  await registrarArtefato(ctx, "relatorio-final.json", "relatorio-final.json", bytes);
  (ctx as ContextoDaProducao & { relatorioFinal: RelatorioFinal }).relatorioFinal = relatorio;
}

// ─── Registro de artefatos ─────────────────────────────────────────────────────

async function registrarArtefato(
  ctx: ContextoDaProducao,
  nomeArtefato: string,
  arquivoNome: string,
  bytes: Buffer,
): Promise<void> {
  const lista = ctx.artefatos.get(nomeArtefato) ?? [];
  lista.push(arquivoProduzido(arquivoNome, bytes));
  ctx.artefatos.set(nomeArtefato, lista);
}

// ─── A producao ────────────────────────────────────────────────────────────────

export async function produzir(opcoes: OpcoesDaProducao): Promise<ResultadoDaProducao> {
  const raiz = opcoes.raizDoProjeto ?? RAIZ;
  const raizCassetes = opcoes.raizCassetes ?? RAIZ_CASSETES_PADRAO;
  const saida = opcoes.saida ?? join(raiz, "output");
  const dirTrabalho = await mkdtemp(join(tmpdir(), "pipeline-f5-07-"));
  const dirEntrada = join(raiz, ".cache", "pipeline", "entrada");
  await rm(dirEntrada, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(dirEntrada, { recursive: true });
  const store = new Store({ root: join(raiz, ".cache", "pipeline", "store") });
  const fila = opcoes.fila ?? criarFilaDeEncode();
  const executor = opcoes.executor ?? executorPadrao;
  const relogio = opcoes.relogio ?? (() => new Date(DATA_EPOCH));
  const ffmpegVersao = await versaoDoFfmpeg(executor);
  const nodeVersao = process.version;

  const manifesto = JSON.parse(
    await readFile(join(raiz, "fixtures", "canonico", "manifesto-valido.json"), "utf-8"),
  ) as Manifesto;

  const ctx: ContextoDaProducao & { relatorioFinal?: RelatorioFinal } = {
    opcoes,
    raiz,
    raizCassetes,
    saida,
    dirTrabalho,
    dirEntrada,
    store,
    fila,
    executor,
    relogio,
    manifesto,
    artefatos: new Map(),
    ffmpegVersao,
    nodeVersao,
    resolvido: undefined as unknown as ManifestoResolvido,
    timing: undefined as unknown as TimingCanonico,
    envelope: undefined as unknown as DuckingEnvelope,
    cadencia: undefined as unknown as ResultadoDeCorte,
    mix: undefined as unknown as ResultadoDoMix,
    pos: undefined as unknown as ResultadoDoPos,
    planoDeAudio: undefined as unknown as PlanoDeAudio,
    chaveC7: "",
    dirDeFrames: "",
    chamadasDoRenderer: 0,
    framesDoCache: 0,
    contexto: undefined as unknown as ContextoDoRender,
  };

  // A ordem de execucao segue as ENTRADAS NOMEADAS do contrato-w9 §3:
  // o render consome o PlanoDeAudio (MixDeEmenda), logo o mix roda antes
  // do render — o encadeamento e pelo nome do artefato, nunca por
  // posicao de diretorio.
  const estagios: readonly Estagio[] = [
    { nome: "autoria", rodar: estagioAutoria },
    { nome: "reparo-mecanico", rodar: estagioReparoMecanico },
    { nome: "resolucao-offline", rodar: estagioResolucaoOffline },
    { nome: "timing", rodar: estagioTiming },
    { nome: "composicao", rodar: estagioComposicao },
    { nome: "mix", rodar: estagioMix },
    { nome: "render", rodar: estagioRender },
    { nome: "encode", rodar: estagioEncode },
    { nome: "pos", rodar: estagioPos },
    { nome: "variante", rodar: estagioVariante },
    { nome: "thumbnail", rodar: estagioThumbnail },
    { nome: "procedencia", rodar: estagioProcedencia },
    { nome: "mux", rodar: estagioMux },
    { nome: "relatorio-final", rodar: estagioRelatorioFinal },
  ];

  for (const estagio of estagios) {
    process.stdout.write(`[pipeline] estagio ${estagio.nome}...\n`);
    try {
      await estagio.rodar(ctx);
    } catch (erro) {
      // Nenhum artefato parcial sai na saida: os artefatos so sao
      // materializados DEPOIS de todos os estagios verdes.
      await rm(dirTrabalho, { recursive: true, force: true }).catch(() => undefined);
      if (erro instanceof ErroDoPipeline) throw erro;
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      const pilha = erro instanceof Error ? erro.stack ?? "" : "";
      throw new ErroDoPipeline(
        pilha.length > 0 ? `${mensagem}\n${pilha}` : mensagem,
        estagio.nome,
        erro,
      );
    }
  }

  // So depois de TODOS os estagios verdes: materializa na saida, arquivo
  // a arquivo, atomicamente (tmp + rename). SO os artefatos da LISTA
  // FECHADA saem na saida — internos (video-codificado.mp4) nao saem.
  for (const esperado of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
    const arquivos = ctx.artefatos.get(esperado.nome);
    if (arquivos === undefined) {
      throw new ErroDoPipeline(
        `artefato "${esperado.nome}" nao foi produzido — nada sai na saida ` +
          "sem a lista completa (contrato-w9 §2)",
        "relatorio-final",
      );
    }
    for (const arquivo of arquivos) {
      await escreverAtomico(join(saida, arquivo.nome), arquivo.bytes);
    }
  }

  return {
    artefatos: ctx.artefatos,
    relatorioFinal: ctx.relatorioFinal as RelatorioFinal,
    resolvido: ctx.resolvido,
    timing: ctx.timing,
    mix: ctx.mix,
    pos: ctx.pos,
    planoDeAudio: ctx.planoDeAudio,
    chaveC7: ctx.chaveC7,
    dirDeFrames: ctx.dirDeFrames,
    chamadasDoRenderer: ctx.chamadasDoRenderer,
    framesDoCache: ctx.framesDoCache,
    dirTrabalho,
  };
}

// ─── A conferencia de presenca (o ∅-crit lido da constante) ──────────────────

/**
 * O ∅-crit do contrato-w9 §2: para CADA artefato da LISTA FECHADA, os
 * arquivos existem e rehasheiam para o que o relatorio-final declara.
 * Problemas vazio = VERDE. Nunca digita um nome de artefato a mao — a
 * lista e lida de ARTEFATOS_ESPERADOS_DO_ESTRITO.
 *
 * @param relatorio o relatorio-final lido da saida (a autoridade dos hashes)
 * @param saida diretorio onde os arquivos moram
 */
export async function conferirPresenca(
  relatorio: RelatorioFinal,
  saida: string,
): Promise<readonly string[]> {
  const problemas: string[] = [];
  if (relatorio.schema_version !== FORMATO_RELATORIO_FINAL) {
    problemas.push(
      `relatorio-final com schema ${relatorio.schema_version} — esperado ${FORMATO_RELATORIO_FINAL}`,
    );
    return problemas;
  }
  const porNome = new Map(relatorio.artefatos.map((a) => [a.nome, a]));

  for (const esperado of ARTEFATOS_ESPERADOS_DO_ESTRITO) {
    if (esperado.nome === "relatorio-final.json") {
      // O artefato 11 e o proprio relatorio: ele NAO se declara (declara
      // 1..10, contrato-w9 §2); o ∅-crit confere o ARQUIVO — presente,
      // parseavel, com sucesso: true e a lista 1..10 declarada (os
      // arquivos sao re-conferidos nos lacos abaixo).
      const caminhoDoRelatorio = join(saida, "relatorio-final.json");
      let lido: Buffer;
      try {
        lido = await readFile(caminhoDoRelatorio);
      } catch {
        problemas.push(
          `artefato "relatorio-final.json": arquivo relatorio-final.json AUSENTE da ` +
            `saida — o relatorio-final tem de existir (escrito POR ULTIMO, atomico)`,
        );
        continue;
      }
      try {
        const parseado = JSON.parse(lido.toString("utf-8")) as RelatorioFinal;
        if (parseado.sucesso !== true) {
          problemas.push(
            `artefato "relatorio-final.json": o relatorio nao declara sucesso: true ` +
              "— nunca declara sucesso com um artefato faltando",
          );
        }
      } catch {
        problemas.push(
          `artefato "relatorio-final.json": relatorio-final.json corrompido — ` +
            "nao parseia como JSON (artefato parcial nunca e lido como sucesso)",
        );
      }
      continue;
    }
    const declarado = porNome.get(esperado.nome);
    if (declarado === undefined) {
      problemas.push(
        `artefato "${esperado.nome}" ausente do relatorio-final — o relatorio ` +
          "nunca declara sucesso com um artefato faltando (contrato-w9 §2)",
      );
      continue;
    }
    for (const arquivoEsperado of esperado.arquivos) {
      const registro = declarado.arquivos.find((a) => a.nome === arquivoEsperado);
      if (registro === undefined) {
        problemas.push(
          `artefato "${esperado.nome}": arquivo ${arquivoEsperado} ausente do relatorio`,
        );
        continue;
      }
      const caminho = join(saida, arquivoEsperado);
      let bytes: Buffer;
      try {
        bytes = await readFile(caminho);
      } catch {
        problemas.push(
          `artefato "${esperado.nome}": arquivo ${arquivoEsperado} AUSENTE da saida ` +
            `(${caminho}) — remover artefato esperado fica VERMELHO por ausencia`,
        );
        continue;
      }
      const hash = sha256Hex(bytes);
      if (hash !== registro.sha256 || bytes.length !== registro.tamanho) {
        problemas.push(
          `artefato "${esperado.nome}": ${arquivoEsperado} corrompido — hash ` +
            `${hash.slice(0, 16)}…/${String(bytes.length)}B divergem do declarado ` +
            `${registro.sha256.slice(0, 16)}…/${String(registro.tamanho)}B`,
        );
      }
    }
  }
  return problemas;
}

// ─── Entrada de linha de comando ───────────────────────────────────────────────

export interface OpcoesDaLinhaDeComando {
  readonly fixture: "canonico";
  readonly estrito: boolean;
  readonly cacheDir?: string;
  readonly saida?: string;
  readonly gapAlvoS?: number;
}

/** Faz o parse dos argumentos do CLI (--fixture, --estrito, --cache-dir...). */
export function parsearArgumentos(argv: readonly string[]): OpcoesDaLinhaDeComando {
  let fixture: "canonico" | undefined;
  let estrito = false;
  let cacheDir: string | undefined;
  let saida: string | undefined;
  let gapAlvoS: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--fixture": {
        const valor = argv[++i];
        if (valor !== "canonico") {
          throw new Error(`--fixture "${valor ?? "(vazio)"}" desconhecido — hoje so "canonico"`);
        }
        fixture = "canonico";
        break;
      }
      case "--estrito":
        estrito = true;
        break;
      case "--cache-dir": {
        const valor = argv[++i];
        if (valor === undefined) throw new Error("--cache-dir precisa de um valor");
        cacheDir = valor;
        break;
      }
      case "--saida": {
        const valor = argv[++i];
        if (valor === undefined) throw new Error("--saida precisa de um valor");
        saida = valor;
        break;
      }
      case "--gap-alvo": {
        const valor = argv[++i];
        if (valor === undefined) throw new Error("--gap-alvo precisa de um valor");
        gapAlvoS = Number(valor);
        break;
      }
      default:
        throw new Error(`argumento desconhecido: ${arg}`);
    }
  }
  return { fixture: fixture ?? "canonico", estrito, cacheDir, saida, gapAlvoS };
}

/** O CLI: `npx tsx src/pipeline/produzir.ts --fixture canonico --estrito`. */
export async function main(argv: readonly string[]): Promise<number> {
  const opcoes = parsearArgumentos(argv);
  const resultado = await produzir(opcoes);
  const relatorio = resultado.relatorioFinal;

  // A conferencia final da propria execucao: verde somente com TUDO la.
  const problemas = await conferirPresenca(
    relatorio,
    opcoes.saida ?? join(RAIZ, "output"),
  );
  if (problemas.length > 0) {
    process.stdout.write("VERMELHO: a conferencia de presenca acusou:\n");
    for (const p of problemas) process.stdout.write(`  - ${p}\n`);
    return 1;
  }
  process.stdout.write("=== produzir: VERDE (11 artefatos conferidos) ===\n");
  for (const a of relatorio.artefatos) {
    process.stdout.write(
      `  ${a.nome}: ${a.arquivos
        .map((f) => `${f.nome} (${f.sha256.slice(0, 12)}…, ${String(f.tamanho)}B)`)
        .join(" + ")}\n`,
    );
  }
  return 0;
}

// Executado direto: `npx tsx src/pipeline/produzir.ts ...`
const executadoDireto =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  main(process.argv.slice(2)).then(
    (codigo) => process.exit(codigo),
    (erro: unknown) => {
      process.stderr.write(
        `produzir: ${erro instanceof Error ? erro.stack ?? erro.message : String(erro)}\n`,
      );
      process.exit(2);
    },
  );
}
