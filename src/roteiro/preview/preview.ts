/**
 * src/roteiro/preview/preview.ts
 *
 * O PREVIEW DE PEDACO — o render de UM pedaco do roteiro (Onda 4, D5).
 *
 * Fluxo (cada etapa fail-closed, nunca sucesso com artefato errado):
 *
 *   manifesto reduzido (reduzirManifesto do construtor — API publica,
 *     reusada, nunca reimplementada; FQ-M3)
 *     -> resolucao do visual do pedaco (manim/grafico via o estagio
 *        grafico existente; gif/video via os bytes do anexo no store)
 *     -> composicao (entrada Remotion GERADA: fixture integrada embutida
 *        + publicDir com bytes por hash — o mesmo caminho do orquestrador
 *        F5-07, src/pipeline/produzir.ts estagioComposicao)
 *     -> render com cache por conteudo (C7: manifesto reduzido + bytes
 *        dos assets + tokens + versoes + pin — a chave do produzir)
 *     -> encode h264 yuv420p 1920x1080 30fps (perfil deterministico
 *        entrega-software do catalogo do F5-02)
 *     -> mux com o audio do pedaco (aac 48k — FORMATO_VIDEO)
 *     -> .cache/roteiro/previews/<hash>.mp4 (enderecado por conteudo).
 *
 * DECISAO DE CAMINHO DE RENDER (documentada — a ponte foi avaliada):
 *
 *   (a) ENTRADA REMOTION GERADA (escolhida): fixture embutida + publicDir
 *       com bytes, como o produzir faz. Evidencia: o preview resolve o
 *       visual do pedaco DIRETAMENTE — o anexo do usuario ja esta no
 *       store por hash (C7), e o manim/grafico e o MESMO estagio grafico
 *       do pipeline, executado sobre o manifesto reduzido — e a fixture
 *       integrada (manifesto + assets + nos_grafico/nos_midia) e
 *       exatamente o que o pintor integrado (ArvoreIntegrada) consome.
 *   (b) PONTE atravessarPonte -> orquestrador de resolucao: DESCARTADA.
 *       Evidencia: a ponte exige assets + procedencias RESOLVIDOS (ela
 *       atravessa o DocumentoAutoria->Manifesto da fronteira de
 *       resolucao, com cassetes — src/render/pipeline/ponte.ts); o
 *       preview nao tem cassete por pedaco, e rodar a ponte arrastaria
 *       a resolucao de locucao/musica que o preview nao consome. O fluxo
 *       de bytes do anexo e deste modulo: store.get(anexo_hash) — nunca
 *       uma URL (C7).
 *
 * VALIDACAO (decisao de escopo, documentada): este modulo valida o
 * PEDACO ALVO, nunca o roteiro inteiro. Estado transitorio de anexo e
 * normal no fluxo do site ("upload primeiro, tipo depois" — PUT anexo
 * em pedaco de qualquer tipo_visual, docs/roteiro/api.md):
 *
 *   - pedaco gif/video SEM o par (anexo_hash, anexo_meta) ou com bytes
 *     ausentes do store = visual NAO PRODUZIVEL -> ErroPreviewVisualNaoProduzivel
 *     com a regra nomeada anexo-exigido-para-gif-video (analogo FQ-P3:
 *     nunca sucesso com imagem errada);
 *   - anexo presente com tipo_visual texto/lista/cabecalho/... NAO
 *     bloqueia o preview: o anexo e removido do pedaco ANTES da
 *     construcao do manifesto (regra anexo-proibido-outros do contrato
 *     nao pode recusar o estado transitorio que a propria rota de anexo
 *     cria);
 *   - a validacao do roteiro INTEIRO (rejeitarRoteiroInvalido) e o gate
 *     do JUNTAR (irmao desta onda — REPLAN do orquestrador), nunca
 *     deste modulo. Um roteiro invalido em OUTRO pedaco nao bloqueia o
 *     preview do pedaco pedido.
 *
 * AUDIO do preview (record-first, docs/roteiro/api.md):
 *
 *   - origem "gravacao": os bytes do wav 48k estereo
 *     (FORMATO_AUDIO_GRAVADO) do store por hash_audio, convertidos para
 *     aac 48k no mux;
 *   - origem "tts": SILENCIO, documentado — o preview nunca sintetiza
 *     TTS: o provedor esta indisponivel neste ambiente (429
 *     credit_balance_exhausted, REPLAN do orquestrador) e a sintese e
 *     responsabilidade do estagio locucao do pipeline completo; quando
 *     o audio de TTS existir no store, este modulo o muxa sem mudanca
 *     de contrato;
 *   - origem "nenhuma": SILENCIO (pedaco com fala ainda nao narrada
 *     renderiza silencioso — estado normal do roteiro recem-gerado).
 *
 *   O preview SEMPRE sai com trilha de audio aac: o concat do juntar e
 *   por stream-copy e exige parametros identicos por construcao.
 *
 * DETERMINISMO (FQ-P1): mesmos bytes de entrada produzem o mesmo mp4.
 * O cache C7 (frames) usa a chave do produzir; o encode usa o perfil
 * deterministico entrega-software (libx264, FLAGS_BITEXACT); o mux usa
 * os tres flags canonicos e o encoder nativo aac (determinismo MEDIDO
 * pelo perfil de audio do pos — PERFIL_AUDIO_POS, ffmpeg 6.1.1 pinado;
 * a cadeia pinada entra na chave C7, bump de ffmpeg = miss).
 */

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  stat,
  symlink,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { construirManifesto, reduzirManifesto } from "../construir/construir.js";
import type { OpcoesConstruirManifesto } from "../construir/construir.js";
import { LICENCA_ANEXO_USUARIO } from "../construir/mapear.js";
import type { Pedaco, Roteiro } from "../contrato/contrato.js";
import { FORMATO_VIDEO } from "../contrato/contrato.js";
import { ErroContratoRoteiro } from "../contrato/rejeitar.js";
import { REGRA_ANEXO_EXIGIDO } from "../contrato/validar.js";

import type { Manifesto } from "../../contratos/manifesto.js";
import { chaveDeCache, componentesDaChave, hashDoManifesto } from "../../resolucao/contrato.js";
import type { AssetResolvido } from "../../resolucao/manifesto-resolvido.js";
import estagioGraficoPadrao from "../../resolucao/grafico/estagio.js";
import { criarEstagioGrafico } from "../../resolucao/grafico/estagio.js";
import { EMotorGraficoAusente } from "../../resolucao/grafico/executor.js";
import type { ExecutorManim } from "../../resolucao/grafico/executor.js";
import { paraProcedenciaDoStore } from "../../resolucao/cassete/formato.js";

import { Store } from "../../store/store.js";
import {
  extensaoDeMime,
  fiarApadrao,
  type FixtureIntegrada,
} from "../../composicao/pintura/fiar.js";
import { prepararRender } from "../../render/pipeline/executar.js";
import type { ContextoDoRender, RendererDeFrames } from "../../render/pipeline/executar.js";
import { calcularOrcamento } from "../../render/pipeline/orcamento.js";
import {
  calcularChaveC7,
  componentesDaChaveC7,
  lerPinDeFerramentas,
  lerVersoesDaPilha,
  RAIZ_DEFAULT_DO_CACHE,
  renderizarComCache,
} from "../../render/cache/index.js";
import {
  criarFilaDeEncode,
  executarEncode,
  listarPerfis,
  type FilaDeEncode,
} from "../../render/encode/index.js";
import {
  DESVIO_MINIMO_DE_CONTEUDO,
  medirConteudoDe,
  PISO_YAVG_MAXIMO_DE_CONTEUDO,
  reprovadoPorConteudo,
  type ExecutorBruto,
  type ExecutorDeComando,
} from "../../pipeline/produzir.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");

// ─── Identidade do preview ─────────────────────────────────────────────────────

/** Composicao registrada pela entrada gerada do preview. */
export const ID_DA_COMPOSICAO_PREVIEW = "preview-pedaco";

/**
 * Porta TCP do preview (S-9 — declarada aqui, no PREP da Onda 4):
 * 4609, na faixa do app, distinta da porta do pipeline (4510, F5-07) e
 * da do servidor web (4610, Onda 5). O numero so aparece em mensagens
 * de erro (o renderer do Remotion nao recebe porta) — a declaracao
 * existe para o mapa de portas nao ter buraco.
 */
export const PORTA_DO_PREVIEW = 4609;

// ─── Layout do cache de previews (documentado para a Onda 5) ──────────────────

/**
 * Raiz dos mp4 finais, relativa a raiz do projeto:
 * `.cache/roteiro/previews/<hash>.mp4` — o nome do arquivo E o SHA-256
 * dos bytes (C7): mesmo conteudo = mesmo arquivo, escrita atomica
 * (tmp+rename, S-8). `conferirPreview(hash)` relê exatamente este
 * caminho.
 */
export const SUBDIRETORIO_PREVIEWS = join(".cache", "roteiro", "previews");

/**
 * Diretorio da entrada gerada: `.cache/roteiro/preview/entrada/`.
 *
 * A entrada mora em SUBDIRETORIO POR CHAVE C7 (um subnivel `<chave16>`):
 * o bundler resolve os imports relativos a partir do arquivo, e dois
 * jobs concorrentes de conteudos DIFERENTES nao podem reescrever o
 * mesmo arquivo no meio do bundle do outro (C12: o bundle do job A
 * carregaria o conteudo do job B sob a chave de A). Mesmo conteudo =
 * mesma chave = mesmo diretorio = escrita idempotente (atomica).
 */
export const SUBDIRETORIO_ENTRADA = join(".cache", "roteiro", "preview", "entrada");

/**
 * Memo da resolucao do visual manim/grafico:
 * `.cache/roteiro/preview/resolucao/<chave-do-estagio>/resultado.json`.
 * A chave e a MESMA do cassete do estagio grafico
 * (chaveDeCache(componentesDaChave(estagio, hashDoManifesto(reduzido)))
 * — versao do estagio, parametros e manifestos incluidos): mudou o
 * estagio, mudou o pedaco ou mudaram os parametros => chave diferente
 * => re-render do manim. Os BYTES do webm vivem no store por hash
 * (S-8); o memo so guarda o mapa nos_grafico + descritores, nunca
 * bytes.
 */
export const SUBDIRETORIO_RESOLUCAO = join(".cache", "roteiro", "preview", "resolucao");

// ─── Erros nomeados ────────────────────────────────────────────────────────────

/** Erro nomeado: o visual do pedaco NAO e produzivel (analogo FQ-P3). */
export class ErroPreviewVisualNaoProduzivel extends Error {
  readonly code = "PREVIEW_VISUAL_NAO_PRODUZIVEL";
  /** A regra nomeada do contrato (anexo-exigido-para-gif-video). */
  readonly regra = REGRA_ANEXO_EXIGIDO;
  constructor(pedacoId: string, tipoVisual: string, motivo: string) {
    super(
      `pedaco "${pedacoId}" (tipo_visual "${tipoVisual}") nao tem visual ` +
        `produzivel: ${motivo} (regra ${REGRA_ANEXO_EXIGIDO}) — nunca sucesso ` +
        `com imagem errada (FQ-P3/C1)`,
    );
    this.name = "ErroPreviewVisualNaoProduzivel";
  }
}

/**
 * Erro nomeado: o motor grafico (Manim) esta ausente — o pedaco
 * manim/grafico nao pode ser renderizado e o preview NUNCA degrada para
 * quadro preto (C1). A mensagem carrega a instrucao de instalacao.
 */
export class ErroPreviewManimIndisponivel extends Error {
  readonly code = "PREVIEW_MANIM_INDISPONIVEL";
  constructor(detalhe: string) {
    super(
      `o visual "${detalhe}" exige o motor grafico Manim, que nao esta ` +
        `disponivel — o preview nunca desenha no lugar dele (C1). Instale o ` +
        `Manim CE 0.20.1 (versao pinada em PARAMETROS_GRAFICO) num interpretador ` +
        `python com o muxer Lavf62.12.102, ou aponte MANIM_BIN/PYTHON_BIN para ` +
        `ele; sem isso, pedacos manim/grafico nao tem preview e o servidor ` +
        `reporta este erro (FQ-P3)`,
    );
    this.name = "ErroPreviewManimIndisponivel";
  }
}

/** Erro nomeado: o render/encode/mux do preview falhou (worker morto PROPAGA). */
export class ErroPreviewRender extends Error {
  readonly code = "PREVIEW_RENDER_FALHOU";
  constructor(mensagem: string, readonly causa?: unknown) {
    super(`o preview falhou: ${mensagem}`);
    this.name = "ErroPreviewRender";
  }
}

/**
 * Erro nomeado (C1): o preview saiu vazio/chapado — exit 0 de um render
 * nao prova imagem; um video inteiro preto passa em toda a camada
 * estrutural de ffprobe. Nenhum caminho deste modulo devolve sucesso
 * com um arquivo reprovado pelo oraculo de conteudo.
 */
export class ErroPreviewVazio extends Error {
  readonly code = "PREVIEW_VAZIO";
  constructor(mensagem: string) {
    super(`o preview esta vazio/chapado (C1): ${mensagem}`);
    this.name = "ErroPreviewVazio";
  }
}

// ─── Opcoes ────────────────────────────────────────────────────────────────────

/** Opcoes do preview. Tudo opcional — os defaults sao do repositorio. */
export interface OpcoesDoPreview {
  /** Store de conteudo (default: novo Store em storeRaiz ?? raiz/.cache/store). */
  readonly store?: Store;
  /** Raiz do store (usada quando `store` nao e injetado). */
  readonly storeRaiz?: string;
  /** Raiz do cache de render C7 (default: RAIZ_DEFAULT_DO_CACHE — /tmp). */
  readonly cacheRaiz?: string;
  /**
   * Raiz dos mp4 finais (default: raiz/.cache/roteiro/previews).
   * O nome do arquivo E o SHA-256 dos bytes (C7).
   */
  readonly previewsRaiz?: string;
  /**
   * Raiz do memo da resolucao manim/grafico (default:
   * raiz/.cache/roteiro/preview/resolucao). Chaveado por conteudo — o
   * mesmo padrao de cacheRaiz; injetavel para isolamento por teste.
   */
  readonly resolucaoRaiz?: string;
  /** Raiz do projeto (resolucao de imports relativos da entrada). */
  readonly raizDoProjeto?: string;
  /** Renderer injetavel (sonda AB-685 — cache quente nao prova render). */
  readonly renderer?: RendererDeFrames;
  /** Contexto do bundle ja preparado (evita re-bundle nos testes). */
  readonly contexto?: ContextoDoRender;
  /** Executor manim injetavel (testes com mock — FQ-P3). */
  readonly executorManim?: ExecutorManim;
  /** Executor de comandos (ffmpeg/ffprobe) injetavel. */
  readonly executor?: ExecutorDeComando;
  /** Executor de stdout BRUTO (bytes) — o oraculo de conteudo. */
  readonly executorBruto?: ExecutorBruto;
  /** Fila de encode injetavel (default: a singleton com tetos do I-03). */
  readonly fila?: FilaDeEncode;
  /** Opcoes da construcao do manifesto (fps/width/height/transicao). */
  readonly opcoesDeConstrucao?: OpcoesConstruirManifesto;
}

/** O resultado do preview — tudo que o servidor (Onda 5) precisa. */
export interface ResultadoDoPreview {
  /** SHA-256 dos bytes do mp4 (o nome do arquivo em previewsRaiz). */
  readonly hash: string;
  /** Caminho absoluto do mp4 (o servidor serve os bytes por aqui). */
  readonly caminho: string;
  /** Duracao do preview em segundos — ffprobe POR STREAM (C4). */
  readonly duracaoSegundos: number;
  /** A chave C7 do conteudo renderizado (diagnostico). */
  readonly chaveC7: string;
  /** Chamadas ao renderer — 0 no acerto quente (sonda AB-685). */
  readonly chamadasDoRenderer: number;
  /** Frames servidos do cache C7. */
  readonly framesDoCache: number;
}

/** A conferencia de um preview — o oraculo do arquivo final. */
export interface ConferenciaDoPreview {
  readonly hash: string;
  readonly caminho: string;
  /** Duracao do STREAM de video em segundos (C4). */
  readonly duracaoSegundos: number;
  readonly codecVideo: string;
  readonly codecAudio: string;
  readonly largura: number;
  readonly altura: number;
  readonly fps: number;
  readonly medida: { yavgMaximo: number; desvioMaximo: number };
}

// ─── Helpers puros ─────────────────────────────────────────────────────────────

/** SHA-256 hex de um buffer. */
export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Escrita ATOMICA (tmp + rename, padrao S-8): leitor nunca ve parcial. */
async function escreverAtomico(caminho: string, bytes: Buffer): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp-${process.pid}`;
  await writeFile(temporario, bytes);
  await rename(temporario, caminho);
}

const executorPadrao: ExecutorDeComando = (comando, args) =>
  new Promise((resolve2, reject) => {
    execFile(comando, args, { timeout: 900_000, maxBuffer: 64 * 1024 * 1024 }, (erro, stdout, stderr) => {
      if (erro) {
        reject(new Error(`${comando} ${args.join(" ")}\n${String(erro)}\n${String(stderr)}`));
        return;
      }
      resolve2({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/** Executor de stdout BRUTO (bytes) — decodificar pixels (oraculo C1). */
const executorBrutoPadraoLocal: ExecutorBruto = (comando, args) =>
  new Promise((resolve2, reject) => {
    execFile(
      comando,
      args,
      { timeout: 900_000, maxBuffer: 512 * 1024 * 1024, encoding: "buffer" },
      (erro, stdout, stderr) => {
        if (erro) {
          reject(new Error(`${comando} ${args.join(" ")}\n${String(erro)}\n${String(stderr)}`));
          return;
        }
        resolve2({
          stdout: Buffer.from(stdout as unknown as Uint8Array),
          stderr: Buffer.from(stderr as unknown as Uint8Array),
        });
      },
    );
  });

// ─── Pedaco -> manifesto reduzido (tolerante ao estado transitorio) ────────────

/**
 * Remove o anexo de um pedaco cujo tipo_visual NAO e gif/video.
 *
 * POR QUE: o fluxo do site e "upload primeiro, tipo depois" (PUT anexo
 * em pedaco de qualquer tipo_visual — docs/roteiro/api.md). Enquanto o
 * usuario nao troca o tipo, o pedaco carrega anexo com tipo texto — um
 * estado TRANSITORIO que a regra anexo-proibido-outros do contrato
 * recusaria, mas que NAO pode bloquear o preview (REPLAN do
 * orquestrador). O anexo de um pedaco texto/lista/cabecalho nao
 * participa do visual: remover o par antes da construcao e a
 * interpretacao fiel do que o pedaco mostra.
 *
 * Deterministico: mesmo pedaco, mesma saida, byte a byte.
 */
export function pedacoSemAnexoIrrelevante(pedaco: Pedaco): Pedaco {
  if (pedaco.tipo_visual === "gif" || pedaco.tipo_visual === "video") {
    return pedaco;
  }
  if (pedaco.anexo_hash === undefined && pedaco.anexo_meta === undefined) {
    return pedaco;
  }
  const semAnexo = { ...pedaco } as {
    id: string;
    indice: number;
    titulo: string;
    fala: string;
    duracao_segundos: number;
    tipo_visual: Pedaco["tipo_visual"];
    especificacao_visual: string;
    detalhes_de_producao: string;
    narracao: Pedaco["narracao"];
    anexo_hash?: string;
    anexo_meta?: Pedaco["anexo_meta"];
  };
  delete semAnexo.anexo_hash;
  delete semAnexo.anexo_meta;
  return semAnexo;
}

/**
 * O manifesto REDUZIDO de UM pedaco, via as API publicas do construtor.
 *
 * O pedaco vira um Roteiro de um pedaco so (schema e duracao do proprio
 * pedaco — as regras de total do contrato valem com um item), e
 * construirManifesto + reduzirManifesto fazem o caminho canonico
 * (FQ-M1/M3). A reducao nunca e reimplementada aqui.
 *
 * Um ErroContratoRoteiro aqui significa pedaco invalido (o roteiro
 * inteiro nao e validado — ver o cabecalho). A regra
 * anexo-exigido-para-gif-video e re-mapeada para o erro nomeado do
 * preview ANTES desta chamada (validarVisualProduzivel), entao so
 * sobrevive ate aqui como fail-closed.
 */
export function manifestoReduzidoDoPedaco(
  roteiro: Roteiro,
  indicePedaco: number,
  opcoesDeConstrucao: OpcoesConstruirManifesto = {},
): Manifesto {
  const pedaco = roteiro.pedacos[indicePedaco];
  if (pedaco === undefined) {
    throw new ErroContratoRoteiro([
      `pedaco de indice ${String(indicePedaco)} nao existe — o roteiro tem ` +
        `${String(roteiro.pedacos.length)} pedaco(s) (indices 0..${String(Math.max(roteiro.pedacos.length - 1, 0))})`,
    ]);
  }
  const roteiroDoPedaco: Roteiro = {
    schema_version: roteiro.schema_version,
    pedacos: [pedacoSemAnexoIrrelevante(pedaco)],
    duracao_total_segundos: pedaco.duracao_segundos,
  };
  const completo = construirManifesto(roteiroDoPedaco, opcoesDeConstrucao);
  return reduzirManifesto(completo, 0);
}

// ─── Resolucao do visual ───────────────────────────────────────────────────────

/** O visual resolvido do pedaco: assets + camadas, so hash de conteudo. */
interface VisualResolvido {
  readonly assets: Record<string, AssetResolvido>;
  readonly nos_grafico: Record<string, string>;
  readonly nos_midia: Record<string, string>;
}

/** Descritor de asset do ANEXO do usuario (pedaco gif/video). */
function assetDoAnexo(pedaco: Pedaco, bytes: Buffer): AssetResolvido {
  const meta = pedaco.anexo_meta!;
  return {
    hash: pedaco.anexo_hash!,
    tipo: pedaco.tipo_visual === "gif" ? "gif" : "video",
    mimeType: meta.tipo,
    byteSize: meta.tamanho_bytes,
    // A licenca do anexo e o enquadramento de uso pessoal (ADR-0003,
    // LICENCA_ANEXO_USUARIO do mapeamento — o anexo e conteudo do
    // proprio usuario). Nunca digitada aqui.
    licenca: LICENCA_ANEXO_USUARIO,
    atribuicaoObrigatoria: false,
    provedor: "usuario",
  };
}

/**
 * Confere se o visual do pedaco e PRODUZIVEL (FQ-P3 / REPLAN).
 *
 * gif/video exigem o par (anexo_hash, anexo_meta) E os bytes no store
 * (C7 — o hash declara conteudo; sem bytes nao ha o que pintar). Um
 * anexo com tipo_visual texto NAO bloqueia (o anexo nao participa do
 * visual — pedacoSemAnexoIrrelevante o remove). manim/grafico sao
 * verificados na resolucao (o motor pode faltar — ErroPreviewManimIndisponivel).
 */
async function validarVisualProduzivel(
  pedaco: Pedaco,
  store: Store,
): Promise<void> {
  if (pedaco.tipo_visual !== "gif" && pedaco.tipo_visual !== "video") {
    return;
  }
  if (pedaco.anexo_hash === undefined || pedaco.anexo_meta === undefined) {
    throw new ErroPreviewVisualNaoProduzivel(
      pedaco.id,
      pedaco.tipo_visual,
      `sem anexo_hash/anexo_meta — regra ${REGRA_ANEXO_EXIGIDO}: o visual ` +
        `exige os bytes do anexo do usuario, enderecados por conteudo (C7)`,
    );
  }
  const bytes = await store.get(pedaco.anexo_hash);
  if (bytes === null) {
    throw new ErroPreviewVisualNaoProduzivel(
      pedaco.id,
      pedaco.tipo_visual,
      `anexo ${pedaco.anexo_hash.slice(0, 12)}… declarado sem bytes no store — ` +
        `o upload nao chegou ou foi removido; refaca o PUT de anexo`,
    );
  }
  if (sha256Hex(bytes) !== pedaco.anexo_hash) {
    throw new ErroPreviewVisualNaoProduzivel(
      pedaco.id,
      pedaco.tipo_visual,
      `bytes do anexo ${pedaco.anexo_hash.slice(0, 12)}… nao rehasheiam para o ` +
        `hash declarado — store corrompido (fail-closed, nunca pinta bytes errados)`,
    );
  }
}

/** O visual de um pedaco gif/video: bytes do anexo viram a camada de midia. */
async function resolverVisualMidia(
  pedaco: Pedaco,
  store: Store,
): Promise<VisualResolvido> {
  const hash = pedaco.anexo_hash!;
  const bytes = (await store.get(hash))!; // validarVisualProduzivel ja conferiu
  const noId = `n-${String(pedaco.indice).padStart(3, "0")}`;
  return {
    assets: { [hash]: assetDoAnexo(pedaco, bytes) },
    nos_grafico: {},
    nos_midia: { [noId]: hash },
  };
}

/** Procura o webm da cena sob `media/videos/`, fora de partial_movie_files. */
async function descobrirWebmDoTrabalho(
  raiz: string,
  nomeCena: string,
): Promise<string | null> {
  async function varrer(diretorio: string): Promise<string | null> {
    let entradas: Array<import("node:fs").Dirent>;
    try {
      entradas = await readdir(diretorio, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entrada of entradas) {
      const caminho = join(diretorio, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "partial_movie_files") continue;
        const achado = await varrer(caminho);
        if (achado !== null) return achado;
      } else if (entrada.name === `${nomeCena}.webm`) {
        return caminho;
      }
    }
    return null;
  }
  return varrer(raiz);
}

/**
 * O visual de um pedaco manim/grafico: o MESMO estagio grafico do
 * pipeline (src/resolucao/grafico) executado sobre o manifesto
 * reduzido. O webm produzido entra no store por hash (S-8) e o memo de
 * resolucao evita re-renderizar o Manim quando o mesmo conteudo volta
 * (a chave do memo e a do cassete do estagio: versao + parametros +
 * manifesto — mudou qualquer um, re-render).
 *
 * O estagio e o unico caminho de desenho: EMotorGraficoAusente vira
 * ErroPreviewManimIndisponivel (nunca quadro preto — C1).
 */
async function resolverVisualGrafico(
  manifestoReduzido: Manifesto,
  store: Store,
  raizDoProjeto: string,
  executorManim: ExecutorManim | undefined,
  resolucaoRaiz?: string,
): Promise<VisualResolvido> {
  const estagio =
    executorManim !== undefined
      ? criarEstagioGrafico({ executor: executorManim })
      : estagioGraficoPadrao;
  const chave = chaveDeCache(
    componentesDaChave(estagio, hashDoManifesto(manifestoReduzido)),
  );
  const memoDir = join(
    resolucaoRaiz ?? join(raizDoProjeto, SUBDIRETORIO_RESOLUCAO),
    chave,
  );
  const memoArquivo = join(memoDir, "resultado.json");

  // Acerto do memo: mesma chave (mesmo estagio/parametros/manifesto) e
  // bytes no store — nada de re-render do Manim.
  try {
    const memo = JSON.parse(await readFile(memoArquivo, "utf-8")) as {
      nos_grafico: Record<string, string>;
      assets: Record<string, AssetResolvido>;
    };
    const hashDoWebm = Object.values(memo.nos_grafico)[0];
    if (hashDoWebm !== undefined) {
      const bytes = await store.get(hashDoWebm);
      if (bytes !== null && sha256Hex(bytes) === hashDoWebm) {
        return {
          assets: memo.assets,
          nos_grafico: memo.nos_grafico,
          nos_midia: {},
        };
      }
    }
  } catch {
    // memo ausente ou invalido = miss (re-render)
  }

  const diretorioTrabalho = await mkdtemp(join(tmpdir(), "preview-grafico-"));
  try {
    let saida;
    try {
      saida = await estagio.resolver({
        manifesto: manifestoReduzido,
        parametros: estagio.parametros,
        // O estagio grafico e local (zero rede): um fetch aqui seria bug —
        // fail-closed, nunca rede no preview.
        fetch: (() => {
          throw new ErroPreviewRender(
            "o estagio grafico tentou usar a rede — o preview nunca toca a rede",
          );
        }) as typeof fetch,
        diretorioTrabalho,
      });
    } catch (erro) {
      if (erro instanceof EMotorGraficoAusente) {
        throw new ErroPreviewManimIndisponivel(erro.message);
      }
      if (erro instanceof ErroPreviewRender) throw erro;
      throw new ErroPreviewRender(
        `o estagio grafico falhou ao resolver o visual manim/grafico: ` +
          `${erro instanceof Error ? erro.message : String(erro)}`,
        erro,
      );
    }

    // Bytes do webm para o store, com a regra de sosia: so entra no
    // store o byte que REHASHEIA para o hash declarado pelo estagio.
    const nos_grafico = saida.parcial.nos_grafico ?? {};
    const assets = saida.parcial.assets ?? {};
    for (const asset of saida.procedencia.assets) {
      if (asset.idNoProvedor === undefined) {
        throw new ErroPreviewRender(
          `asset ${asset.hash.slice(0, 12)}… sem idNoProvedor — nao da para ` +
            "descobrir o webm que ele declara",
        );
      }
      const caminho = await descobrirWebmDoTrabalho(
        join(diretorioTrabalho, "media"),
        asset.idNoProvedor,
      );
      if (caminho === null) {
        throw new ErroPreviewRender(
          `o motor grafico nao produziu ${asset.idNoProvedor}.webm em ` +
            `${join(diretorioTrabalho, "media")} — render que sai sem arquivo ` +
            "e erro (C1), nunca sucesso",
        );
      }
      const bytes = await readFile(caminho);
      if (bytes.length === 0) {
        throw new ErroPreviewRender(
          `o webm ${asset.idNoProvedor} saiu com zero bytes — C1: exit 0 de ` +
            "um render nao prova imagem",
        );
      }
      if (sha256Hex(bytes) !== asset.hash) {
        throw new ErroPreviewRender(
          `o webm ${asset.idNoProvedor} rehasheia para ` +
            `${sha256Hex(bytes).slice(0, 12)}…, divergente do hash declarado ` +
            `${asset.hash.slice(0, 12)}… — bytes divergentes nunca entram no store`,
        );
      }
      await store.put(bytes, paraProcedenciaDoStore(asset, saida.procedencia));
    }
    await mkdir(memoDir, { recursive: true });
    await escreverAtomico(
      memoArquivo,
      Buffer.from(JSON.stringify({ nos_grafico, assets }), "utf-8"),
    );
    return {
      assets,
      nos_grafico,
      nos_midia: {},
    };
  } finally {
    await rm(diretorioTrabalho, { recursive: true, force: true });
  }
}

// ─── Composicao (entrada gerada) ───────────────────────────────────────────────

/** O resultado da geracao da entrada. */
interface EntradaGerada {
  readonly entrada: string;
  readonly publicDir: string;
}

/**
 * Gera a entrada Remotion do preview: fixture integrada embutida (o
 * MESMO contrato do produzir — ArvoreIntegrada + fiarApadrao) e
 * publicDir com os bytes dos assets por hash (grafico/<hash>.<ext> e
 * midia/<hash>.<ext> — os nomes que o resolvedor padrao da fiacao
 * deriva) + as fontes locais (C6).
 *
 * A entrada mora em `.cache/roteiro/preview/entrada/<chave16>/` — por
 * chave C7, para jobs concorrentes de conteudos diferentes nunca
 * reescreverem o arquivo no meio do bundle do outro (ver cabecalho). O
 * prefixo de import relativo e `../../../../../src` (5 niveis: <chave16>
 * -> entrada -> preview -> roteiro -> .cache -> raiz).
 */
async function gerarEntrada(
  raizDoProjeto: string,
  fixture: FixtureIntegrada,
  chaveC7: string,
  bytesDoStore: Map<string, Buffer>,
): Promise<EntradaGerada> {
  const dirEntrada = join(raizDoProjeto, SUBDIRETORIO_ENTRADA, chaveC7.slice(0, 16));
  const publicDir = join(dirEntrada, "public");
  await mkdir(publicDir, { recursive: true });

  // Grafico: um arquivo por hash de nos_grafico, no nome exato que o
  // resolvedor padrao da fiacao deriva (staticFile grafico/<hash>.<ext>).
  for (const hash of [...new Set(Object.values(fixture.nos_grafico))].sort()) {
    const asset = fixture.assets[hash];
    if (asset === undefined) {
      throw new ErroPreviewRender(
        `nos_grafico cita ${hash.slice(0, 12)}…, que nao existe em assets`,
      );
    }
    const bytes = bytesDoStore.get(hash);
    if (bytes === undefined) {
      throw new ErroPreviewRender(
        `asset de grafico ${hash.slice(0, 12)}… sem bytes no store`,
      );
    }
    await escreverAtomico(
      join(publicDir, "grafico", `${hash}.${extensaoDeMime(asset.mimeType)}`),
      bytes,
    );
  }

  // Midia (anexo do usuario): o mesmo contrato, prefixo midia/.
  const nosMidia = fixture.nos_midia ?? {};
  for (const hash of [...new Set(Object.values(nosMidia))].sort()) {
    const asset = fixture.assets[hash];
    if (asset === undefined) {
      throw new ErroPreviewRender(
        `nos_midia cita ${hash.slice(0, 12)}…, que nao existe em assets`,
      );
    }
    const bytes = bytesDoStore.get(hash);
    if (bytes === undefined) {
      throw new ErroPreviewRender(
        `asset de midia ${hash.slice(0, 12)}… sem bytes no store`,
      );
    }
    await escreverAtomico(
      join(publicDir, "midia", `${hash}.${extensaoDeMime(asset.mimeType)}`),
      bytes,
    );
  }

  // Fontes locais (C6): symlink para os bytes canonicos de assets/fontes.
  try {
    await symlink(
      join(raizDoProjeto, "assets", "fontes"),
      join(publicDir, "fontes"),
    );
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
  }

  // A entrada gerada: fixture embutida (determinismo — mesmo manifesto
  // gera a mesma entrada, byte a byte).
  const fixtureJson = JSON.stringify(fixture, null, 2).replaceAll("</", "<\\/");
  const entrada = `// GERADO pelo preview de pedaco (Onda 4) — nao editar.
import { Composition, registerRoot, useCurrentFrame } from "remotion";
import { registrarFontesLocais } from "../../../../../src/design/fontes/index";
import { ArvoreIntegrada, fiarApadrao, type FixtureIntegrada } from "../../../../../src/composicao/pintura/index";

const FIXTURA: FixtureIntegrada = ${fixtureJson} as FixtureIntegrada;

void registrarFontesLocais();

export const ComposicaoPreview: React.FC = () => {
  const frame = useCurrentFrame();
  return <ArvoreIntegrada fixture={FIXTURA} frame={frame} />;
};

export const RaizPreview: React.FC = () => {
  const total = fiarApadrao(FIXTURA).plano.totalFrames;
  return (
    <Composition
      id="${ID_DA_COMPOSICAO_PREVIEW}"
      component={ComposicaoPreview}
      durationInFrames={total}
      fps={FIXTURA.manifesto.fps}
      width={FIXTURA.manifesto.width}
      height={FIXTURA.manifesto.height}
    />
  );
};
registerRoot(RaizPreview);
`;
  await escreverAtomico(join(dirEntrada, "entrada.tsx"), Buffer.from(entrada, "utf-8"));
  return { entrada: join(dirEntrada, "entrada.tsx"), publicDir };
}

// ─── Render / encode / mux ─────────────────────────────────────────────────────

/** PNGs -> .mov qtrle/argb (lossless, deterministico) — o master. */
async function encodarMasterQtrle(
  dirDeFrames: string,
  totalFrames: number,
  fps: number,
  dirTrabalho: string,
  executor: ExecutorDeComando,
): Promise<string> {
  const padding = Math.max(3, String(totalFrames - 1).length);
  const dirSequencia = join(dirTrabalho, "sequencia");
  await mkdir(dirSequencia, { recursive: true });
  const nomes = await readdir(dirDeFrames);
  for (const nome of nomes) {
    if (!nome.endsWith(".png")) continue;
    const indice = Number.parseInt(nome.replace(/^frame-/, "").replace(/\.png$/, ""), 10);
    const bytes = await readFile(join(dirDeFrames, nome));
    await writeFile(
      join(dirSequencia, `frame-${String(indice).padStart(padding, "0")}.png`),
      bytes,
    );
  }

  const saida = join(dirTrabalho, "master.mov");
  await executor("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-framerate", String(fps),
    "-start_number", "0",
    "-i", join(dirSequencia, `frame-%0${padding}d.png`),
    "-c:v", "qtrle", "-pix_fmt", "argb",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    saida,
  ]);
  const bytes = await readFile(saida);
  if (bytes.length === 0) {
    throw new ErroPreviewRender("o encode qtrle do master nao escreveu bytes (C1)");
  }
  return saida;
}

/**
 * O encode h264 yuv420p — o perfil deterministico do catalogo do F5-02
 * (entrega-software, libx264 CRF 18). Fallback declarado e VERMELHO no
 * preview: o mp4 do preview tem de ser o perfil pedido, nunca um
 * substituto silencioso.
 */
async function encodarH264(
  masterMov: string,
  dirTrabalho: string,
  fila: FilaDeEncode,
  executor: ExecutorDeComando,
): Promise<string> {
  const catalogo = await listarPerfis();
  const deterministas = catalogo.filter((d) => d.perfil.deterministico === true);
  if (deterministas.length === 0) {
    throw new ErroPreviewRender(
      "nenhum perfil deterministico: true no catalogo do F5-02 — o preview so " +
        "encoda com perfis deterministicos (AB-700)",
    );
  }
  const escolhido = deterministas.find((d) => d.perfil.motor === "libx264");
  if (escolhido === undefined) {
    throw new ErroPreviewRender(
      "nenhum perfil libx264 deterministico no catalogo — o preview precisa do " +
        "eixo CRF de software (ADR-0036 decisao 8)",
    );
  }
  const saida = join(dirTrabalho, "video.mp4");
  const resultado = await executarEncode({
    perfil: escolhido.perfil,
    entrada: masterMov,
    saida,
    fila,
    executor,
  });
  if (resultado.fallback.ativo) {
    throw new ErroPreviewRender(
      `o perfil ${escolhido.perfil.nome} caiu em fallback ` +
        `(${resultado.fallback.motivo ?? "motivo nao declarado"}) — no preview o ` +
        "encode e o perfil pedido, nunca um substituto silencioso",
    );
  }
  return saida;
}

/**
 * O mux do preview: video h264 + audio aac 48k (FORMATO_VIDEO), com o
 * audio EXATAMENTE na duracao do pedaco (apad + -t) — o concat do
 * juntar e por stream-copy e exige parametros identicos por construcao.
 *
 * Determinismo: os tres flags canonicos (FLAGS_BITEXACT do F5-02)
 * depois das entradas e o encoder nativo aac 192k — o mesmo eixo do
 * PERFIL_AUDIO_POS, cujo determinismo foi MEDIDO nesta cadeia pinada.
 * A cadeia pinada entra na chave C7: bump de ffmpeg = miss.
 */
async function muxarComAudio(
  videoMp4: string,
  audioBytes: Buffer | null,
  duracaoSegundos: number,
  dirTrabalho: string,
  executor: ExecutorDeComando,
): Promise<string> {
  const saida = join(dirTrabalho, "preview-muxado.mp4");
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  if (audioBytes !== null) {
    const wav = join(dirTrabalho, "narracao.wav");
    await writeFile(wav, audioBytes);
    args.push("-i", videoMp4, "-i", wav);
  } else {
    // Silencio digital (anullsrc — deterministico por construcao): o
    // preview SEMPRE sai com trilha aac; o volume do silencio e
    // medido pelos testes (volumedetect).
    args.push("-i", videoMp4, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }
  args.push(
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-af", "apad",
    "-t", duracaoSegundos.toFixed(6),
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    saida,
  );
  await executor("ffmpeg", args);
  const bytes = await readFile(saida);
  if (bytes.length === 0) {
    throw new ErroPreviewRender("a muxagem nao escreveu bytes (C1)");
  }
  return saida;
}

// ─── Conferencia (o oraculo do arquivo final) ─────────────────────────────────

/** O esperado estrutural de um preview (derivado do manifesto reduzido). */
interface EsperadoDoPreview {
  readonly largura: number;
  readonly altura: number;
  readonly fps: number;
}

/** Le as streams do arquivo via ffprobe (JSON) — vazio e erro, nunca valor. */
async function streamsDe(
  caminho: string,
  executor: ExecutorDeComando,
): Promise<Array<Record<string, string>>> {
  const probe = await executor("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,sample_rate,duration,avg_frame_rate",
    "-of", "json",
    caminho,
  ]);
  const saida = JSON.parse(probe.stdout) as { streams?: Array<Record<string, string>> };
  const streams = saida.streams ?? [];
  if (streams.length === 0) {
    throw new ErroPreviewVazio(
      `ffprobe nao encontrou stream nenhuma em ${caminho} — o arquivo nao e ` +
        "o video esperado (parse vazio nunca vira valor)",
    );
  }
  return streams;
}

/**
 * Confere UM preview renderizado: existe, nao vazio, ffprobe ok por
 * STREAM (C4), formato (codecs/dimensoes/fps do FORMATO_VIDEO quando o
 * esperado e dado) e o oraculo de conteudo (C1 — medirConteudoDe +
 * reprovadoPorConteudo do produzir, REUSADOS). Qualquer falha e erro
 * nomeado (ErroPreviewVazio) — nunca sucesso com artefato errado.
 */
export async function conferirArquivoDoPreview(
  caminho: string,
  esperado: EsperadoDoPreview | undefined,
  opcoes: { executor?: ExecutorDeComando; executorBruto?: ExecutorBruto } = {},
): Promise<ConferenciaDoPreview> {
  const executor = opcoes.executor ?? executorPadrao;
  const executorBruto = opcoes.executorBruto ?? executorBrutoPadraoLocal;

  let info;
  try {
    info = await stat(caminho);
  } catch {
    throw new ErroPreviewVazio(`${caminho} nao existe`);
  }
  if (info.size === 0) {
    throw new ErroPreviewVazio(`${caminho} tem zero bytes`);
  }

  const streams = await streamsDe(caminho, executor);
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  if (video === undefined || audio === undefined) {
    throw new ErroPreviewVazio(
      `o mp4 nao tem video+audio (streams: ${streams.map((s) => s.codec_type).join(" | ") || "(vazio)"})`,
    );
  }
  if (video.codec_name !== "h264") {
    throw new ErroPreviewVazio(`codec de video "${video.codec_name}" — esperado h264 (FORMATO_VIDEO)`);
  }
  if (audio.codec_name !== "aac") {
    throw new ErroPreviewVazio(`codec de audio "${audio.codec_name}" — esperado aac (FORMATO_VIDEO)`);
  }
  if (esperado !== undefined) {
    if (Number(video.width) !== esperado.largura || Number(video.height) !== esperado.altura) {
      throw new ErroPreviewVazio(
        `dimensoes ${String(video.width)}x${String(video.height)} — esperado ` +
          `${String(esperado.largura)}x${String(esperado.altura)} (FORMATO_VIDEO)`,
      );
    }
    const fpsLido = fpsDe(video);
    if (fpsLido !== esperado.fps) {
      throw new ErroPreviewVazio(
        `fps ${String(fpsLido)} — esperado ${String(esperado.fps)} (FORMATO_VIDEO)`,
      );
    }
  }

  const duracaoSegundos = Number(video.duration);
  if (!Number.isFinite(duracaoSegundos) || duracaoSegundos <= 0) {
    throw new ErroPreviewVazio(
      `duracao do stream de video indefinida (${String(video.duration)}) — C4: ` +
        "leitura por stream, nunca pelo container",
    );
  }

  // Oraculo de conteudo (C1): um video inteiro preto/chapado passa em
  // toda a camada estrutural de ffprobe — a luma e o desvio por frame
  // separam (REUSE de medirConteudoDe/reprovadoPorConteudo do produzir).
  const largura = Number(video.width);
  const altura = Number(video.height);
  const medida = await medirConteudoDe(
    { executorBruto } as unknown as Parameters<typeof medirConteudoDe>[0],
    caminho,
    largura,
    altura,
  );
  if (reprovadoPorConteudo(medida)) {
    throw new ErroPreviewVazio(
      `o video e (quase) chapado: yavg maximo ${String(medida.yavgMaximo)} < ` +
        `${String(PISO_YAVG_MAXIMO_DE_CONTEUDO)} E desvio-padrao maximo ` +
        `${String(medida.desvioMaximo)} <= ${String(DESVIO_MINIMO_DE_CONTEUDO)} — ` +
        "quadro preto/chapado passa em toda a camada estrutural (C1)",
    );
  }

  return {
    hash: sha256Hex(await readFile(caminho)),
    caminho,
    duracaoSegundos,
    codecVideo: video.codec_name,
    codecAudio: audio.codec_name,
    largura,
    altura,
    fps: esperado?.fps ?? fpsDe(video),
    medida: { yavgMaximo: medida.yavgMaximo, desvioMaximo: medida.desvioMaximo },
  };
}

/** fps de uma stream via avg_frame_rate ("30/1" -> 30) — fracao, nunca string. */
function fpsDe(stream: Record<string, string>): number {
  const fracao = (stream.avg_frame_rate ?? "").split("/");
  const numerador = Number(fracao[0]);
  const denominador = Number(fracao[1]);
  const fps = denominador > 0 ? numerador / denominador : Number.NaN;
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new ErroPreviewVazio(
      `avg_frame_rate indefinido ("${stream.avg_frame_rate ?? ""}") — o fps ` +
        "do preview nao pode ser lido por stream (C4)",
    );
  }
  return fps;
}

// ─── A API principal ───────────────────────────────────────────────────────────

/** O audio do pedaco: bytes do wav gravado ou silencio (tts/nenhuma). */
async function audioDoPedaco(
  pedaco: Pedaco,
  store: Store,
): Promise<Buffer | null> {
  if (pedaco.narracao.origem !== "gravacao") {
    // "tts": silencio DOCUMENTADO (provedor indisponivel — 429, REPLAN);
    // "nenhuma": silencio (fala ainda nao narrada — record-first). O
    // preview nunca sintetiza TTS (ver cabecalho).
    return null;
  }
  const hash = pedaco.narracao.hash_audio;
  if (hash === undefined) {
    // Inalcancavel com pedaco valido (regra gravacao-sem-hash), mas
    // fail-closed: audio declarado sem endereco e erro, nunca mudo.
    throw new ErroPreviewRender(
      `pedaco "${pedaco.id}": origem "gravacao" sem hash_audio — o audio ` +
        `gravado e enderecado por conteudo (C7), nunca inventado`,
    );
  }
  const bytes = await store.get(hash);
  if (bytes === null) {
    throw new ErroPreviewRender(
      `pedaco "${pedaco.id}": audio gravado ${hash.slice(0, 12)}… ausente do ` +
        `store — o wav do usuario nao esta la; refaca a gravacao (PUT narracao/audio)`,
    );
  }
  if (sha256Hex(bytes) !== hash) {
    throw new ErroPreviewRender(
      `pedaco "${pedaco.id}": bytes do audio ${hash.slice(0, 12)}… nao rehasheiam ` +
        `para o hash declarado — fail-closed, nunca muxa bytes errados`,
    );
  }
  return bytes;
}

/**
 * Renderiza o preview de UM pedaco: manifesto reduzido -> visual ->
 * composicao -> render (cache C7) -> encode -> mux -> mp4 por hash.
 *
 * Fail-closed em cada etapa: visual nao produzivel e erro nomeado
 * (ErroPreviewVisualNaoProduzivel/ErroPreviewManimIndisponivel), render
 * falho PROPAGA (ErroPreviewRender), arquivo vazio/chapado e
 * ErroPreviewVazio (C1) — o sucesso so existe com o mp4 conferido.
 *
 * @param roteiro       o roteiro completo (o pedaco alvo e validado;
 *                      o roteiro inteiro e o gate do juntar)
 * @param indicePedaco  indice 0-based do pedaco
 * @param opcoes        store/cache/executores injetaveis
 */
export async function renderizarPreviewPedaco(
  roteiro: Roteiro,
  indicePedaco: number,
  opcoes: OpcoesDoPreview = {},
): Promise<ResultadoDoPreview> {
  const raizDoProjeto = opcoes.raizDoProjeto ?? RAIZ;
  const store = opcoes.store ?? new Store({ root: opcoes.storeRaiz ?? join(raizDoProjeto, ".cache", "store") });
  const previewsRaiz = opcoes.previewsRaiz ?? join(raizDoProjeto, SUBDIRETORIO_PREVIEWS);
  const executor = opcoes.executor ?? executorPadrao;
  const executorBruto = opcoes.executorBruto ?? executorBrutoPadraoLocal;
  const fila = opcoes.fila ?? criarFilaDeEncode();

  // 1. O pedaco alvo + o visual produzivel (FQ-P3 / anexo-exigido).
  const pedaco = roteiro.pedacos[indicePedaco];
  if (pedaco === undefined) {
    throw new ErroContratoRoteiro([
      `pedaco de indice ${String(indicePedaco)} nao existe — o roteiro tem ` +
        `${String(roteiro.pedacos.length)} pedaco(s)`,
    ]);
  }
  await validarVisualProduzivel(pedaco, store);

  // 2. O manifesto reduzido (API publica do construtor — FQ-M3).
  const manifestoReduzido = manifestoReduzidoDoPedaco(
    roteiro,
    indicePedaco,
    opcoes.opcoesDeConstrucao,
  );

  // 3. A resolucao do visual do pedaco (manim via estagio grafico;
  //    anexo via store). O id do no da cena reduzida e a chave das
  //    camadas nos_grafico/nos_midia.
  const noDaCena = manifestoReduzido.cenas[0]!.nos[0]!;
  let visual: VisualResolvido;
  if (pedaco.tipo_visual === "manim" || pedaco.tipo_visual === "grafico") {
    visual = await resolverVisualGrafico(
      manifestoReduzido,
      store,
      raizDoProjeto,
      opcoes.executorManim,
      opcoes.resolucaoRaiz,
    );
  } else if (pedaco.tipo_visual === "gif" || pedaco.tipo_visual === "video") {
    visual = await resolverVisualMidia(pedaco, store);
  } else {
    visual = { assets: {}, nos_grafico: {}, nos_midia: {} };
  }

  // 4. A fixture integrada (o contrato do pintor — o mesmo do produzir).
  const fixture: FixtureIntegrada = {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: hashDoManifesto(manifestoReduzido),
    manifesto: manifestoReduzido,
    assets: visual.assets,
    nos_grafico: visual.nos_grafico,
    nos_midia: visual.nos_midia,
  };

  // 5. A chave C7 (ADR-0041 — a MESMA composicao do produzir): bytes da
  //    fixture que o render consome + re-hash dos bytes dos assets +
  //    tokens + versoes da pilha + pin de ferramentas.
  const bytesDoStore = new Map<string, Buffer>();
  for (const hash of [
    ...Object.values(visual.nos_grafico),
    ...Object.values(visual.nos_midia),
  ].sort()) {
    const bytes = await store.get(hash);
    if (bytes === null) {
      throw new ErroPreviewRender(
        `asset ${hash.slice(0, 12)}… ausente do store na hora da chave C7`,
      );
    }
    bytesDoStore.set(hash, bytes);
  }
  const entradasDaChave = {
    manifestoResolvido: Buffer.from(JSON.stringify(fixture, null, 2), "utf-8"),
    assets: bytesDoStore,
    versoes: lerVersoesDaPilha({ raizDoProjeto }),
    pinFerramentas: lerPinDeFerramentas(),
  };
  const chaveC7 = calcularChaveC7(entradasDaChave);

  // 6. A entrada gerada + o render com cache (por faixa, unidade frame).
  const entrada = await gerarEntrada(raizDoProjeto, fixture, chaveC7, bytesDoStore);
  const totalFrames = fiarApadrao(fixture).plano.totalFrames;
  const orcamento = calcularOrcamento();
  const dirTrabalho = await mkdtemp(join(tmpdir(), "preview-pedaco-"));
  let resultadoDoRender;
  try {
    const contexto =
      opcoes.contexto ??
      (await prepararRender({
        entrada: entrada.entrada,
        publicDir: entrada.publicDir,
        composicaoId: ID_DA_COMPOSICAO_PREVIEW,
      }));
    resultadoDoRender = await renderizarComCache({
      entrada: entrada.entrada,
      publicDir: entrada.publicDir,
      composicaoId: ID_DA_COMPOSICAO_PREVIEW,
      porta: PORTA_DO_PREVIEW,
      totalFrames,
      workers: orcamento.workers,
      chaveC7,
      raizDoCache: opcoes.cacheRaiz ?? RAIZ_DEFAULT_DO_CACHE,
      renderer: opcoes.renderer,
      contexto,
      componentes: componentesDaChaveC7(entradasDaChave),
      saida: join(dirTrabalho, "render"),
    });
  } catch (erro) {
    if (erro instanceof ErroPreviewRender || erro instanceof ErroPreviewVazio) throw erro;
    throw new ErroPreviewRender(
      `o render do pedaco falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
      erro,
    );
  }

  // 7. Master deterministico (qtrle/argb) -> encode h264 yuv420p.
  let muxado: string;
  try {
    const masterMov = await encodarMasterQtrle(
      resultadoDoRender.dirDeSaida,
      totalFrames,
      manifestoReduzido.fps,
      dirTrabalho,
      executor,
    );
    const videoMp4 = await encodarH264(masterMov, dirTrabalho, fila, executor);

    // 8. Mux com o audio do pedaco (gravacao: bytes do store; tts/nenhuma:
    //    silencio — ver audioDoPedaco). A duracao do mux e a do VIDEO
    //    (frames/fps): o audio e aparado/padded para exatamente esta.
    const audioBytes = await audioDoPedaco(pedaco, store);
    muxado = await muxarComAudio(
      videoMp4,
      audioBytes,
      totalFrames / manifestoReduzido.fps,
      dirTrabalho,
      executor,
    );
  } catch (erro) {
    if (erro instanceof ErroPreviewRender || erro instanceof ErroPreviewVazio) throw erro;
    throw new ErroPreviewRender(
      `encode/mux do preview falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
      erro,
    );
  }

  // 9. Oraculo do arquivo final (C1 + C4) — so depois dele o mp4 existe
  //    no diretorio de previews, atomico, enderecado pelo proprio hash.
  try {
    const conferencia = await conferirArquivoDoPreview(
      muxado,
      {
        largura: manifestoReduzido.width,
        altura: manifestoReduzido.height,
        fps: manifestoReduzido.fps,
      },
      { executor, executorBruto },
    );
    const bytes = await readFile(muxado);
    const hash = sha256Hex(bytes);
    if (hash !== conferencia.hash) {
      throw new ErroPreviewVazio(
        `o hash do arquivo final divergiu entre a conferencia e a leitura — ` +
          "arquivo mudou durante a conferencia (fail-closed)",
      );
    }
    await mkdir(previewsRaiz, { recursive: true });
    await escreverAtomico(join(previewsRaiz, `${hash}.mp4`), bytes);
    return {
      hash,
      caminho: join(previewsRaiz, `${hash}.mp4`),
      duracaoSegundos: conferencia.duracaoSegundos,
      chaveC7,
      chamadasDoRenderer: resultadoDoRender.chamadasDoRenderer,
      framesDoCache: resultadoDoRender.framesDoCache,
    };
  } catch (erro) {
    if (erro instanceof ErroPreviewVazio || erro instanceof ErroPreviewRender) throw erro;
    throw new ErroPreviewRender(
      `a conferencia do preview falhou: ${erro instanceof Error ? erro.message : String(erro)}`,
      erro,
    );
  } finally {
    await rm(dirTrabalho, { recursive: true, force: true });
  }
}

/**
 * Confere um preview JA renderizado pelo hash (o nome do arquivo):
 * existe, nao vazio, ffprobe ok por stream (C4) e oraculo de conteudo
 * (C1). O servidor da Onda 5 pode revalidar o artefato antes de servir
 * — falha e ErroPreviewVazio, nunca sucesso com artefato errado.
 */
export async function conferirPreview(
  hash: string,
  opcoes: {
    previewsRaiz?: string;
    raizDoProjeto?: string;
    executor?: ExecutorDeComando;
    executorBruto?: ExecutorBruto;
  } = {},
): Promise<ConferenciaDoPreview> {
  const raizDoProjeto = opcoes.raizDoProjeto ?? RAIZ;
  const previewsRaiz = opcoes.previewsRaiz ?? join(raizDoProjeto, SUBDIRETORIO_PREVIEWS);
  const caminho = join(previewsRaiz, `${hash}.mp4`);
  const conferencia = await conferirArquivoDoPreview(
    caminho,
    {
      // O formato e o contrato: o preview so existe no formato congelado
      // (FORMATO_VIDEO) — conferir SEM o esperado nao teria o que falhar.
      largura: FORMATO_VIDEO.width,
      altura: FORMATO_VIDEO.height,
      fps: FORMATO_VIDEO.fps,
    },
    { executor: opcoes.executor, executorBruto: opcoes.executorBruto },
  );
  if (conferencia.hash !== hash) {
    throw new ErroPreviewVazio(
      `o arquivo ${caminho} rehasheia para ${conferencia.hash.slice(0, 12)}… — ` +
        `o nome nao e o conteudo (C7: endereco por conteudo)`,
    );
  }
  return conferencia;
}
