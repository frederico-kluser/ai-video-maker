/**
 * src/web/servidor.ts
 *
 * O SERVIDOR WEB do app "Editor de Video IA" — node:http nativo, ZERO
 * dependencias novas (S-1). Implementa EXATAMENTE as 21 rotas do
 * contrato congelado docs/roteiro/api.md (porta 4610, S-9) — nada a
 * menos, nada inventado: o teste FQ-C4 cruza api.md x rotas.ts e este
 * matcher serve as MESMAS constantes.
 *
 * Arquitetura (REPLAN Onda 5 / D7/D11 do TASK_PLAN):
 *   - persistencia em dados/projetos/<id>/ — projeto.json (o
 *     ProjetoRoteiro, JSON atomico tmp+rename S-8) + previews.json e
 *     entrega.json (indices derivados dos artefatos por CONTEUDO — C7:
 *     o mp4 vive em .cache/roteiro/previews/<hash>.mp4; o indice so
 *     lembra qual hash serve cada pedaco);
 *   - operacoes pesadas = jobs efemeros (src/web/jobs.ts) que spawnam
 *     os CLIs D11 via `tsx <cli> --estado <path>` com o pedido JSON em
 *     stdin; o servidor SO faz child_process (nunca o dominio em
 *     processo); a saida real do CLI (stdout JSON / stderr envelope)
 *     vira o estado terminal do job (FQ-S3);
 *   - o load do projeto NUNCA recusa (FQ-S1/REPLAN): validarProjetoRoteiro
 *     sinaliza pedacos transitarios (par anexo inconsistente — upload
 *     primeiro, tipo depois) e o GET serve o roteiro mergeado como
 *     esta; a SPA enxerga o estado e o fluxo resolve o par;
 *   - GET projeto serve o roteiro com as edicoes aplicadas
 *     (editarPedaco) e o jobs por alvo (derivado dos jobs, nunca
 *     persistido no projeto).
 *
 * Decisoes documentadas (premissas — ver handoff):
 *   - os indices de preview/entrega persistem em dados/projetos/<id>/
 *     (o artefato e content-addressed; sem o indice o GET preview.mp4
 *     nao saberia qual hash serve — re-render seria proibido);
 *   - PUT narracao "assimila" o pedaco servido na base e limpa
 *     pedacos_editados[pedacoId]: a narracao nova corresponde a FALA
 *     SERVIDA (com edicoes); sem a assimilacao o merge seguinte
 *     remarcaria a narracao como "editado" (texto != fala da base) —
 *     audio em dia vira stale por engano;
 *   - os mp4 sao servidos com suporte a Range (206) — o <video> da SPA
 *     precisa de seek; o contrato so documenta o 200, o 206 e a mesma
 *     rota;
 *   - nome_original do PUT anexo: query `?nome=` (ou header
 *     X-Nome-Original; default "anexo") — o corpo e cru, o nome nao
 *     cabe no body;
 *   - timing_pedacos do juntar: sempre OMITIDO (gravacao nao deriva
 *     legendas, D4 — hoje nao ha TTS com timing neste app).
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  receberAnexo,
  ErroAnexoVazio,
  ErroTamanhoAnexoExcedido,
  ErroTipoAnexoInvalido,
} from "../roteiro/anexo/index.js";
import type { ResultadoDoAnexo } from "../roteiro/anexo/index.js";
import { resumoDePedacos } from "../roteiro/contrato/canonicalizar.js";
import {
  ANEXO_TAMANHO_MAXIMO_BYTES,
  VERSAO_CONTRATO_GERADOR,
  VERSAO_CONTRATO_ROTEIRO,
  VERSAO_GERADOR,
} from "../roteiro/contrato/contrato.js";
import type {
  BriefRoteiro,
  EdicaoPedaco,
  Pedaco,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
  ProjetoRoteiro,
  Roteiro,
} from "../roteiro/contrato/contrato.js";
import { editarPedaco } from "../roteiro/contrato/edicao.js";
import { ROTAS_API } from "../roteiro/contrato/rotas.js";
import {
  REGRA_ANEXO_EXIGIDO,
  REGRA_EDICAO_ANEXO_PROIBIDO,
  validarBriefRoteiro,
  validarEdicaoPedaco,
  validarPedaco,
  validarProjetoRoteiro,
  validarRoteiro,
  verificarJuntarFalaSemNarracao,
} from "../roteiro/contrato/validar.js";
import { conferirEntrega } from "../roteiro/juntar/juntar.js";
import {
  conferirPinDoFfmpeg,
  ErroAudioInvalido,
  ErroConversaoAudio,
  ErroGravacaoVazia,
  receberGravacao,
} from "../roteiro/narracao/index.js";
import { conferirPreview } from "../roteiro/preview/preview.js";
import { Store } from "../store/store.js";
import { GerenciadorDeJobs, escreverJsonAtomico } from "./jobs.js";
import type { ArtefatoDoJob, JobStatus, TipoJob } from "./jobs.js";

// ─── Constantes ────────────────────────────────────────────────────────────────

/** A porta declarada do contrato (S-9 — docs/roteiro/api.md). */
export const PORTA_PADRAO = 4610;

/** Raiz do repositorio — a base de todos os defaults relativos. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL("../..", import.meta.url));

/** Teto do corpo JSON das rotas de API (briefs e pedidos sao pequenos). */
const TETO_JSON_BYTES = 5 * 1024 * 1024;

/**
 * Teto do PUT narracao/audio na CAMADA HTTP (413 acima dele — decisao
 * do REPLAN Onda 5; o modulo src/roteiro/narracao segue sem teto).
 * 100 MB cobre horas de gravacao webm do MediaRecorder com folga.
 */
const TETO_NARRACAO_BYTES = 100 * 1024 * 1024;

/** Folga do buffer do PUT anexo alem do teto de dominio (200 MB). */
const FOLGA_ANEXO_BYTES = 1024 * 1024;

/** Timeouts dos jobs (o preview/juntar renderizam; gerar e rapido). */
const TEMPO_LIMITE_JOB_MS = 30 * 60 * 1000;
const TEMPO_LIMITE_GERACAO_MS = 10 * 60 * 1000;

/**
 * O FORMATO real dos ids que o servidor gera (randomBytes — a unica
 * origem legitima): projeto `proj-<8 hex>` (criarProjeto) e job
 * `job-<32 hex>` (GerenciadorDeJobs.criar). O GET/PATCH/DELETE so
 * aceitam esse formato: qualquer outra forma e id inexistente OU
 * injecao de caminho — o matcher decodifica %2F/%2e%2e DEPOIS do split
 * (decodeURIComponent), entao um segmento "..%2F..%2Ftarget" chegaria
 * como id "../../target" e o join() sairia da raiz de projetos (leitura
 * 200, sobrescrita por PATCH, remocao recursiva por DELETE). Exportados
 * para o teste do caso "vazio" (que a rede nao produz: o matcher filtra
 * segmentos vazios antes de casar).
 */
export const FORMATO_DE_ID_DE_PROJETO = /^proj-[0-9a-f]{8}$/;
export const FORMATO_DE_ID_DE_JOB = /^job-[0-9a-f]{32}$/;

// ─── Erro HTTP interno ─────────────────────────────────────────────────────────

/** Erro mapeado 1:1 para o envelope {erro:{codigo,mensagem,detalhes}}. */
export class ErroHttp extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: readonly string[],
  ) {
    super(mensagem);
    this.name = "ErroHttp";
  }
}

/** A porta ja esta em uso — o startup sai com mensagem clara (S-9). */
export class ErroPortaEmUso extends Error {
  constructor(readonly porta: number, causa: string) {
    super(
      `Editor de Video IA: a porta ${porta} ja esta em uso (EADDRINUSE) — ` +
        `outro servidor esta rodando? (S-9). Detalhe: ${causa}`,
    );
    this.name = "ErroPortaEmUso";
  }
}

// ─── Matcher de rotas (api.md §Matcher) ────────────────────────────────────────

/** Uma rota casada: o nome da constante e os parametros capturados. */
export interface RotaCasada {
  readonly nome: string;
  readonly params: Readonly<Record<string, string>>;
}

/**
 * Casa metodo+caminho contra uma tabela "NOME" -> "METODO path" (a
 * forma das constantes de rotas.ts). Segmento literal vence :param
 * (api.md §Matcher): entre dois casamentos, vence o de MAIS segmentos
 * literais; empate = o primeiro declarado.
 */
export function casarRotaComTabela(
  metodo: string,
  caminho: string,
  tabela: Readonly<Record<string, string>>,
): RotaCasada | null {
  const segmentos = caminho.split("/").filter((s) => s !== "");
  let melhor: RotaCasada | null = null;
  let melhorLiterais = -1;
  // O wildcard ("/assets/*") so vence se nada literal casar — e a rota
  // da SPA, fora do /api/ (o api.md a documenta; o contrato inteiro
  // entra no matcher — FQ-C4).
  let melhorWildcard: RotaCasada | null = null;
  for (const [nome, definicao] of Object.entries(tabela)) {
    const [metodoDaRota, ...resto] = definicao.split(" ");
    const caminhoDaRota = resto.join(" ").replace(/\/$/, "");
    if (metodoDaRota !== metodo) {
      continue;
    }
    if (caminhoDaRota.endsWith("*")) {
      const prefixo = caminhoDaRota.slice(0, -1);
      if (caminho.startsWith(prefixo) && caminho.length > prefixo.length) {
        melhorWildcard = { nome, params: {} };
      }
      continue;
    }
    const padroes = caminhoDaRota.split("/").filter((s) => s !== "");
    if (padroes.length !== segmentos.length) {
      continue;
    }
    const params: Record<string, string> = {};
    let ok = true;
    let literais = 0;
    for (let i = 0; i < padroes.length; i++) {
      const padrao = padroes[i]!;
      const valor = segmentos[i]!;
      if (padrao.startsWith(":")) {
        try {
          params[padrao.slice(1)] = decodeURIComponent(valor);
        } catch {
          ok = false;
          break;
        }
      } else if (padrao === valor) {
        literais++;
      } else {
        ok = false;
        break;
      }
    }
    if (!ok) {
      continue;
    }
    if (melhor === null || literais > melhorLiterais) {
      melhor = { nome, params };
      melhorLiterais = literais;
    }
  }
  return melhor ?? melhorWildcard;
}

/** Casa contra o contrato real (ROTAS_API de rotas.ts — FQ-C4). */
export function casarRota(metodo: string, caminho: string): RotaCasada | null {
  return casarRotaComTabela(metodo, caminho, ROTAS_API);
}

// ─── Tipos da persistencia ─────────────────────────────────────────────────────

/** Indice de preview de um pedaco (derivado — o mp4 e content-addressed). */
interface RegistroDePreview {
  readonly hash: string;
  /** Caminho ABSOLUTO do mp4 (resolvido contra a raiz do projeto). */
  readonly caminho: string;
  readonly duracao_segundos: number;
  readonly atualizado_em: string;
}

/** Indice da entrega (video-final) — o mesmo padrao do preview. */
interface RegistroDeEntrega {
  readonly hash: string;
  readonly caminho: string;
  readonly duracao_total_segundos: number;
  readonly atualizado_em: string;
}

// ─── Helpers de dominio ────────────────────────────────────────────────────────

/** Soma arredondada a 2 casas (a mesma aritmetica do sosia). */
function somaArredondada(pedacos: readonly Pedaco[]): number {
  return Math.round(pedacos.reduce((soma, p) => soma + p.duracao_segundos, 0) * 100) / 100;
}

/**
 * O roteiro SERVIDO: os deltas de pedacos_editados aplicados via
 * editarPedaco (api.md GET projeto) com duracao_total_segundos
 * RECALCULADA — a soma dos pedacos servidos e a duracao que o
 * pipeline consome (sem o recalculo, editar duracao_segundos deixaria
 * o roteiro invalido e o juntar responderia 409 duracao-total-
 * inconsistente).
 */
function aplicarEdicoes(roteiro: Roteiro, editados: Readonly<Record<string, EdicaoPedaco>>): Roteiro {
  const pedacos = roteiro.pedacos.map((p) => {
    const edicao = editados[p.id];
    return edicao === undefined ? p : editarPedaco(p, edicao);
  });
  return {
    schema_version: roteiro.schema_version,
    pedacos,
    duracao_total_segundos: somaArredondada(pedacos),
  };
}

/** O envelope de erro do api.md — nunca texto solto. */
function envelopeDeErro(codigo: string, mensagem: string, detalhes?: readonly string[]): unknown {
  return { erro: { codigo, mensagem, ...(detalhes !== undefined ? { detalhes } : {}) } };
}

/** Extrai o envelope de erro do stderr do CLI (a saida real, FQ-S3). */
function extrairMensagemDeErroDoCli(stderr: string): string {
  for (const linha of stderr.split("\n")) {
    try {
      const envelope = JSON.parse(linha) as { erro?: { mensagem?: string } };
      if (typeof envelope.erro?.mensagem === "string" && envelope.erro.mensagem !== "") {
        return envelope.erro.mensagem;
      }
    } catch {
      // linha nao-JSON do CLI — segue a busca
    }
  }
  const limpo = stderr.trim();
  return limpo === "" ? "falha na operacao (o CLI nao imprimiu saida)" : limpo;
}

// ─── O app ─────────────────────────────────────────────────────────────────────

export interface OpcoesDoServidor {
  /** Porta (default: 4610 — o contrato, S-9; 0 = porta efemera p/ testes). */
  readonly porta?: number;
  /** Raiz do repositorio (resolucao de CLIs, cache, node_modules). */
  readonly raizDoProjeto?: string;
  /** Raiz da persistencia local (default: <raiz>/dados — gitignored). */
  readonly raizDados?: string;
  /** Diretorio dos estaticos da SPA (default: <raiz>/dist/web — Onda 6). */
  readonly raizEstatica?: string;
  /** Provedor do gerador passado ao CLI (default: env ou "sosia"). */
  readonly provedorPadrao?: string;
  /** TTL dos jobs efemeros em ms (default: 1 hora). */
  readonly ttlJobsMs?: number;
  /** Canal de log do startup (default: console). */
  readonly logar?: (mensagem: string) => void;
  /** Relogio do criado_em/atualizado_em (testes injetam relogio fixo). */
  readonly relogio?: () => Date;
}

export class ServidorApp {
  readonly raizDoProjeto: string;
  readonly raizDados: string;
  readonly raizEstatica: string;
  readonly raizStore: string;
  readonly raizPreviews: string;
  readonly raizResolucao: string;
  readonly dirEntregas: string;
  readonly provedorPadrao: string;
  readonly jobs: GerenciadorDeJobs;
  readonly store: Store;
  private readonly binTsx: string;
  /** Canal de log (banner do startup e avisos de load). */
  readonly logar: (mensagem: string) => void;
  private readonly relogio: () => Date;

  constructor(opcoes: OpcoesDoServidor = {}) {
    this.raizDoProjeto = opcoes.raizDoProjeto ?? RAIZ_DO_REPOSITORIO;
    this.raizDados = opcoes.raizDados ?? join(this.raizDoProjeto, "dados");
    this.raizEstatica = opcoes.raizEstatica ?? join(this.raizDoProjeto, "dist", "web");
    this.raizStore = join(this.raizDados, "store");
    this.raizPreviews = join(this.raizDoProjeto, ".cache", "roteiro", "previews");
    this.raizResolucao = join(this.raizDoProjeto, ".cache", "roteiro", "preview", "resolucao");
    this.dirEntregas = join(this.raizDoProjeto, ".cache", "roteiro", "entregas");
    this.provedorPadrao = opcoes.provedorPadrao ?? process.env.ROTEIRO_PROVEDOR ?? "sosia";
    this.binTsx = join(this.raizDoProjeto, "node_modules", ".bin", "tsx");
    this.logar = opcoes.logar ?? ((mensagem) => console.log(mensagem));
    this.relogio = opcoes.relogio ?? (() => new Date());
    this.jobs = new GerenciadorDeJobs({
      raiz: join(this.raizDoProjeto, ".cache", "roteiro", "jobs"),
      ttlMs: opcoes.ttlJobsMs,
      relogio: this.relogio,
    });
    this.store = new Store({ root: this.raizStore });
  }

  // ── Persistencia do projeto ─────────────────────────────────────────────────

  private diretorioDoProjeto(id: string): string {
    return join(this.raizDados, "projetos", id);
  }

  private caminhoDoProjetoJson(id: string): string {
    return join(this.diretorioDoProjeto(id), "projeto.json");
  }

  /** Le o projeto do disco. O load NUNCA recusa (REPLAN): a validacao
   *  so SINALIZA os problemas (ex.: par de anexo transitorio "upload
   *  primeiro, tipo depois"). Retorna null so se o projeto nao existe. */
  private carregarProjeto(id: string): { projeto: ProjetoRoteiro; avisos: string[] } | null {
    let bruto: string;
    try {
      bruto = readFileSync(this.caminhoDoProjetoJson(id), "utf-8");
    } catch {
      return null;
    }
    let projeto: ProjetoRoteiro;
    try {
      projeto = JSON.parse(bruto) as ProjetoRoteiro;
    } catch (erro) {
      throw new ErroHttp(
        500,
        "projeto-corrompido",
        `o projeto "${id}" nao pode ser lido (JSON invalido): ${(erro as Error).message}`,
      );
    }
    const resultado = validarProjetoRoteiro(projeto);
    if (!resultado.valido) {
      // SINALIZA, nunca recusa: o par de anexo inconsistente e estado
      // transitório legitimo do fluxo upload-primeiro-tipo-depois.
      this.logar(`projeto ${id}: load com avisos (${resultado.problemas.length}):`);
      for (const problema of resultado.problemas) {
        this.logar(`  - ${problema}`);
      }
    }
    return { projeto, avisos: resultado.problemas };
  }

  private salvarProjeto(projeto: ProjetoRoteiro): void {
    escreverJsonAtomico(this.caminhoDoProjetoJson(projeto.id), projeto);
  }

  private carregarPreviews(id: string): Record<string, RegistroDePreview> {
    try {
      return JSON.parse(
        readFileSync(join(this.diretorioDoProjeto(id), "previews.json"), "utf-8"),
      ) as Record<string, RegistroDePreview>;
    } catch {
      return {};
    }
  }

  private salvarPreviews(id: string, previews: Record<string, RegistroDePreview>): void {
    escreverJsonAtomico(join(this.diretorioDoProjeto(id), "previews.json"), previews);
  }

  private carregarEntrega(id: string): RegistroDeEntrega | null {
    try {
      return JSON.parse(
        readFileSync(join(this.diretorioDoProjeto(id), "entrega.json"), "utf-8"),
      ) as RegistroDeEntrega;
    } catch {
      return null;
    }
  }

  private salvarEntrega(id: string, entrega: RegistroDeEntrega): void {
    escreverJsonAtomico(join(this.diretorioDoProjeto(id), "entrega.json"), entrega);
  }

  // ── O roteiro servido ───────────────────────────────────────────────────────

  /** O projeto como a API serve: com o roteiro mergeado (edicoes aplicadas). */
  private projetoServido(projeto: ProjetoRoteiro): ProjetoRoteiro {
    if (projeto.roteiro === undefined) {
      return projeto;
    }
    return { ...projeto, roteiro: aplicarEdicoes(projeto.roteiro, projeto.pedacos_editados) };
  }

  /** Jobs por alvo do GET do projeto (derivado, nunca persistido). */
  private jobsPorAlvo(projetoId: string): {
    gerar_roteiro: { job_id: string; estado: JobStatus["estado"]; progresso: number | null } | null;
    previews: Record<string, { job_id: string; estado: JobStatus["estado"]; progresso: number | null }>;
    juntar: { job_id: string; estado: JobStatus["estado"]; progresso: number | null } | null;
  } {
    const resumoDe = (registro: { id: string } | null): {
      job_id: string;
      estado: JobStatus["estado"];
      progresso: number | null;
    } | null => {
      if (registro === null) {
        return null;
      }
      const status = this.jobs.lerStatus(registro.id);
      if (status === null) {
        return null;
      }
      return { job_id: status.id, estado: status.estado, progresso: status.progresso };
    };
    const registros = this.jobs.listarDoProjeto(projetoId);
    const ultimoDoTipo = (tipo: TipoJob) => {
      const doTipo = registros.filter((r) => r.tipo === tipo);
      return doTipo.length > 0 ? doTipo[doTipo.length - 1]! : null;
    };
    const previews: Record<string, { job_id: string; estado: JobStatus["estado"]; progresso: number | null }> = {};
    for (const registro of registros) {
      if (registro.tipo !== "preview-pedaco" || registro.alvo.pedaco_id === undefined) {
        continue;
      }
      const resumo = resumoDe(registro);
      if (resumo !== null) {
        previews[registro.alvo.pedaco_id] = resumo;
      }
    }
    return {
      gerar_roteiro: resumoDe(ultimoDoTipo("gerar-roteiro")),
      previews,
      juntar: resumoDe(ultimoDoTipo("juntar-video")),
    };
  }

  // ── Rodagem dos CLIs D11 ────────────────────────────────────────────────────

  /** O contrato D11: spawna `tsx <cli> --estado <path>` com o pedido em
   *  stdin; stdout JSON = sucesso; exit != 0 = erro com envelope no
   *  stderr. O estado terminal do job e SEMPRE escrito (fail-closed:
   *  o poll nunca ve o arquivo ausente). */
  private rodarJobCli(
    registro: { id: string },
    cliRelativo: string,
    pedido: unknown,
    tempoLimiteMs: number,
    aoConcluir: (stdout: string) => void,
    aoFalhar: (stderr: string) => void,
  ): void {
    const caminhoDoCli = join(this.raizDoProjeto, cliRelativo);
    const caminhoDoEstado = this.jobs.caminhoDoEstado(registro.id);
    const filho = spawn(this.binTsx, [caminhoDoCli, "--estado", caminhoDoEstado], {
      cwd: this.raizDoProjeto,
      // O provedor vem do servidor (sosia por default — zero rede, zero
      // credencial, FQ-G5); chaves de LLM, se houver, passam pelo env.
      env: { ...process.env, ROTEIRO_PROVEDOR: this.provedorPadrao },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let estourou = false;
    filho.stdout?.setEncoding("utf-8");
    filho.stdout?.on("data", (d: string) => {
      stdout += d;
    });
    filho.stderr?.setEncoding("utf-8");
    filho.stderr?.on("data", (d: string) => {
      stderr += d;
    });
    const temporizador = setTimeout(() => {
      estourou = true;
      filho.kill("SIGKILL");
    }, tempoLimiteMs);
    filho.on("error", (erro) => {
      clearTimeout(temporizador);
      this.concluirJobErro(registro, `falha ao spawnar o CLI: ${erro.message}`);
    });
    filho.on("close", (codigo) => {
      clearTimeout(temporizador);
      if (estourou) {
        this.concluirJobErro(registro, `${stderr.trim()}\n(tempo limite de ${Math.round(tempoLimiteMs / 1000)} s excedido)`);
        return;
      }
      if (codigo === 0) {
        // O CLI ja gravou "ok" no arquivo de estado — fecha a janela
        // entre esse "ok" e a APLICACAO dos efeitos do servidor (o
        // roteiro no projeto, o indice de preview...): o poll so ve o
        // terminal DEPOIS de o efeito existir (FQ-S3 — terminal =
        // efeito concluido; um poll que ve "ok" antes de o roteiro
        // existir responderia 404 no GET seguinte).
        this.jobs.escreverEstado(registro.id, {
          estado: "rodando",
          progresso: 0.99,
          mensagem: "Conferindo e aplicando o resultado...",
          erro: null,
          atualizado_em: this.relogio().toISOString(),
        });
        try {
          aoConcluir(stdout);
        } catch (erro) {
          this.concluirJobErro(registro, (erro as Error).message);
        }
        return;
      }
      aoFalhar(stderr);
    });
    filho.stdin.end(`${JSON.stringify(pedido)}\n`);
  }

  private concluirJobOk(registro: { id: string }, artefato: ArtefatoDoJob, mensagem: string): void {
    // Terminal em UMA escrita atomica (estado ok + artefato juntos):
    // o poll que ve o terminal ve o artefato na mesma leitura (FQ-S3 —
    // terminal = efeito concluido, sem janela entre "ok" e artefato).
    this.jobs.finalizarOk(registro.id, artefato, mensagem);
  }

  /** Estado terminal de erro SEMPRE com a saida real do CLI (FQ-S3). */
  private concluirJobErro(registro: { id: string }, stderr: string): void {
    const mensagem = extrairMensagemDeErroDoCli(stderr);
    this.jobs.escreverEstado(registro.id, {
      estado: "erro",
      progresso: 1,
      mensagem,
      erro: mensagem,
      atualizado_em: this.relogio().toISOString(),
    });
  }

  // ── Rotas ───────────────────────────────────────────────────────────────────

  /** O handler unico: roteia /api/ para o contrato e o resto para a SPA. */
  async tratarRequisicao(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      await this.tratarApi(req, res, url);
      return;
    }
    this.tratarSpa(req, res, url);
  }

  private async tratarApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    const metodo = req.method ?? "GET";
    const casada = casarRota(metodo, url.pathname);
    if (casada === null) {
      // 405 se a ROTA existe com outro verbo; 404 se nada casa.
      const permitidos: string[] = [];
      for (const outro of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
        if (outro !== metodo && casarRota(outro, url.pathname) !== null) {
          permitidos.push(outro);
        }
      }
      if (permitidos.length > 0) {
        responderErro(res, 405, "metodo-nao-permitido", `metodo ${metodo} nao permitido nesta rota`, undefined, { Allow: permitidos.join(", ") });
        return;
      }
      responderErro(res, 404, "rota-nao-encontrada", `rota ${metodo} ${url.pathname} nao existe`);
      return;
    }
    const { id, jobId } = casada.params;
    // Path traversal (BLOCK da revisao adversarial): o parser WHATWG do
    // `new URL` NAO normaliza %2F/%2e%2e DENTRO de um segmento e o
    // matcher decodifica apos o split (decodeURIComponent acima) — um
    // segmento "..%2F..%2Ftarget" chegaria aqui como id "../../target",
    // e o join() (diretorioDoProjeto/caminhoDoProjetoJson, o rm
    // recursivo do DELETE, caminhoDoEstado/caminhoDoMeta dos jobs)
    // sairia da raiz: leitura 200 provada, sobrescrita via PATCH,
    // remocao via DELETE. A defesa e o FORMATO: o servidor SO gera
    // proj-<8 hex> (criarProjeto) e job-<32 hex> (GerenciadorDeJobs.
    // criar) — id fora dele e o MESMO 404 do recurso inexistente
    // (nunca 500). Este e o unico ponto de entrada dos params para os
    // handlers (o switch abaixo): nenhum id chega a um caminho de disco
    // sem passar por aqui — os demais ids usados em path nascem deste
    // servidor (jobs.criar, criarProjeto) ou de projeto ja validado
    // (salvarProjeto(projeto.id), apos carregarProjeto(id) validado).
    if (id !== undefined && !FORMATO_DE_ID_DE_PROJETO.test(id)) {
      throw new ErroHttp(404, "projeto-nao-encontrado", `projeto "${id}" nao existe`);
    }
    if (jobId !== undefined && !FORMATO_DE_ID_DE_JOB.test(jobId)) {
      throw new ErroHttp(404, "job-nao-encontrado", `job "${jobId}" nao existe ou expirou`);
    }
    switch (casada.nome) {
      case "criarProjeto":
        await this.criarProjeto(req, res);
        return;
      case "listarProjetos":
        this.listarProjetos(res);
        return;
      case "obterProjeto":
        this.obterProjeto(res, id!);
        return;
      case "atualizarBrief":
        await this.atualizarBrief(req, res, id!);
        return;
      case "apagarProjeto":
        await this.apagarProjeto(res, id!);
        return;
      case "gerarRoteiro":
        await this.gerarRoteiro(req, res, id!);
        return;
      case "regenerarPedaco":
        await this.regenerarPedaco(req, res, id!, casada.params["pedacoId"]!);
        return;
      case "editarPedaco":
        await this.editarPedaco(req, res, id!, casada.params["pedacoId"]!);
        return;
      case "enviarGravacao":
        await this.enviarGravacao(req, res, url, id!, casada.params["pedacoId"]!);
        return;
      case "obterAudioNarracao":
        await this.obterAudioNarracao(res, id!, casada.params["pedacoId"]!);
        return;
      case "removerNarracao":
        await this.removerNarracao(res, id!, casada.params["pedacoId"]!);
        return;
      case "enviarAnexo":
        await this.enviarAnexo(req, res, url, id!, casada.params["pedacoId"]!);
        return;
      case "obterAnexo":
        await this.obterAnexo(res, id!, casada.params["pedacoId"]!);
        return;
      case "removerAnexo":
        await this.removerAnexo(res, id!, casada.params["pedacoId"]!);
        return;
      case "pedirPreview":
        await this.pedirPreview(res, id!, casada.params["pedacoId"]!);
        return;
      case "obterPreviewMp4":
        await this.obterPreviewMp4(req, res, id!, casada.params["pedacoId"]!);
        return;
      case "pedirJuntar":
        await this.pedirJuntar(req, res, id!);
        return;
      case "obterVideoFinal":
        await this.obterVideoFinal(req, res, id!);
        return;
      case "obterJob":
        await this.obterJob(res, casada.params["jobId"]!);
        return;
      default:
        responderErro(res, 404, "rota-nao-encontrada", `rota ${metodo} ${url.pathname} nao implementada`);
    }
  }

  // ── Projetos ────────────────────────────────────────────────────────────────

  private async criarProjeto(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const corpo = await lerJsonDoCorpo(req);
    const brief = (corpo as { brief?: unknown }).brief;
    const resultado = validarBriefRoteiro(brief);
    if (!resultado.valido) {
      throw new ErroHttp(400, "brief-invalido", "brief invalido (FQ-C1: brief sem tema e rejeitado)", resultado.problemas);
    }
    const agora = this.relogio().toISOString();
    const projeto: ProjetoRoteiro = {
      id: `proj-${randomBytes(4).toString("hex")}`,
      brief: brief as BriefRoteiro,
      pedacos_editados: {},
      criado_em: agora,
      atualizado_em: agora,
    };
    this.salvarProjeto(projeto);
    responderJson(res, 201, projeto);
  }

  private listarProjetos(res: ServerResponse): void {
    let ids: string[];
    try {
      ids = readdirSync(join(this.raizDados, "projetos"), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      ids = [];
    }
    const projetos: Array<{ id: string; tema: string; criado_em: string; atualizado_em: string }> = [];
    for (const id of ids) {
      const carregado = this.carregarProjeto(id);
      if (carregado === null) {
        continue;
      }
      projetos.push({
        id,
        tema: carregado.projeto.brief.tema,
        criado_em: carregado.projeto.criado_em,
        atualizado_em: carregado.projeto.atualizado_em,
      });
    }
    projetos.sort((a, b) => (a.criado_em < b.criado_em ? 1 : a.criado_em > b.criado_em ? -1 : 0));
    responderJson(res, 200, { projetos });
  }

  private obterProjeto(res: ServerResponse, id: string): void {
    const carregado = this.exigirProjeto(id);
    const projeto = this.projetoServido(carregado.projeto);
    responderJson(res, 200, { projeto, jobs: this.jobsPorAlvo(id) });
  }

  private async atualizarBrief(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const corpo = await lerJsonDoCorpo(req);
    const brief = (corpo as { brief?: unknown }).brief;
    const resultado = validarBriefRoteiro(brief);
    if (!resultado.valido) {
      throw new ErroHttp(400, "brief-invalido", "brief invalido", resultado.problemas);
    }
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      brief: brief as BriefRoteiro,
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    responderJson(res, 200, this.projetoServido(projeto));
  }

  private async apagarProjeto(res: ServerResponse, id: string): Promise<void> {
    this.exigirProjeto(id);
    await rm(this.diretorioDoProjeto(id), { recursive: true, force: true });
    this.jobs.removerDoProjeto(id);
    responderSemCorpo(res, 204);
  }

  // ── Roteiro ─────────────────────────────────────────────────────────────────

  private async gerarRoteiro(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const corpo = (await lerJsonDoCorpo(req)) as { brief?: unknown; duracao_alvo_segundos?: unknown };
    let brief = carregado.projeto.brief;
    if (corpo.brief !== undefined) {
      const resultado = validarBriefRoteiro(corpo.brief);
      if (!resultado.valido) {
        throw new ErroHttp(400, "brief-invalido", "brief invalido", resultado.problemas);
      }
      brief = corpo.brief as BriefRoteiro;
    }
    const duracaoAlvo = corpo.duracao_alvo_segundos;
    if (duracaoAlvo !== undefined && (typeof duracaoAlvo !== "number" || !(duracaoAlvo > 0))) {
      throw new ErroHttp(400, "corpo-invalido", "duracao_alvo_segundos precisa ser um numero positivo");
    }
    // A selecao da UI (brief e duracao alvo do pedido) e o estado do
    // projeto: persiste — regeneracoes futuras usam a mesma selecao.
    if (corpo.brief !== undefined || duracaoAlvo !== undefined) {
      const projetoAtualizado: ProjetoRoteiro = {
        ...carregado.projeto,
        brief: {
          ...brief,
          ...(duracaoAlvo !== undefined ? { duracao_alvo_segundos: duracaoAlvo } : {}),
        },
        atualizado_em: this.relogio().toISOString(),
      };
      this.salvarProjeto(projetoAtualizado);
      carregado.projeto = projetoAtualizado;
    }
    const pedido: PedidoGerarRoteiro = {
      brief,
      ...(duracaoAlvo !== undefined ? { duracao_alvo_segundos: duracaoAlvo } : {}),
      versao_contrato: VERSAO_CONTRATO_ROTEIRO,
      versao_contrato_gerador: VERSAO_CONTRATO_GERADOR,
      versao_gerador: VERSAO_GERADOR,
    };
    const registro = this.jobs.criar("gerar-roteiro", { projeto_id: id });
    this.rodarJobCli(registro, "src/roteiro/gerador/cli.ts", pedido, TEMPO_LIMITE_GERACAO_MS, (stdout) => {
      this.assimilarRoteiroGerado(id, registro, stdout);
    }, (stderr) => {
      this.concluirJobErro(registro, stderr);
    });
    responderJobAceito(res, registro.id);
  }

  /** Job gerar ok: substitui o roteiro do projeto e poda os derivados. */
  private assimilarRoteiroGerado(id: string, registro: { id: string }, stdout: string): void {
    const carregado = this.exigirProjeto(id);
    let roteiro: Roteiro;
    try {
      roteiro = JSON.parse(stdout) as Roteiro;
    } catch (erro) {
      throw new Error(`saida do gerador nao e JSON valido: ${(erro as Error).message}`);
    }
    const validacao = validarRoteiro(roteiro);
    if (!validacao.valido) {
      throw new Error(`o roteiro gerado nao valida contra o contrato: ${validacao.problemas.join("; ")}`);
    }
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      roteiro,
      // Edicoes orfas (ids que nao existem mais no roteiro novo) nao
      // sobrevivem a reescrita do roteiro inteiro (api.md §gerar).
      pedacos_editados: podarPorIds(carregado.projeto.pedacos_editados, roteiro),
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    // Previews de pedacos BYTE A BYTE identicos continuam validos (FQ-G2:
    // determinismo por conteudo); o resto e podado.
    const antigo = carregado.projeto.roteiro;
    const previews = this.carregarPreviews(id);
    const novosPreviews: Record<string, RegistroDePreview> = {};
    for (const [pedacoId, registroDePreview] of Object.entries(previews)) {
      const novoPedaco = roteiro.pedacos.find((p) => p.id === pedacoId);
      const antigoPedaco = antigo?.pedacos.find((p) => p.id === pedacoId);
      if (
        novoPedaco !== undefined &&
        antigoPedaco !== undefined &&
        JSON.stringify(novoPedaco) === JSON.stringify(antigoPedaco)
      ) {
        novosPreviews[pedacoId] = registroDePreview;
      }
    }
    this.salvarPreviews(id, novosPreviews);
    this.concluirJobOk(
      registro,
      { tipo: "roteiro-json", caminho: `/api/projetos/${id}` },
      "Roteiro gerado.",
    );
  }

  private async regenerarPedaco(
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
    pedacoId: string,
  ): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const roteiro = carregado.projeto.roteiro;
    if (roteiro === undefined) {
      throw new ErroHttp(409, "roteiro-nao-gerado", "gere o roteiro antes de regenerar pedacos");
    }
    const indiceDoAlvo = roteiro.pedacos.findIndex((p) => p.id === pedacoId);
    if (indiceDoAlvo < 0) {
      throw new ErroHttp(404, "pedaco-nao-encontrado", `pedaco "${pedacoId}" nao existe no roteiro`);
    }
    await lerCorpo(req, TETO_JSON_BYTES); // corpo vazio — so consome
    const merged = aplicarEdicoes(roteiro, carregado.projeto.pedacos_editados);
    const pedacoAtual = merged.pedacos[indiceDoAlvo]!;
    const irmaos = merged.pedacos.filter((p) => p.id !== pedacoId);
    const pedido: PedidoRegenerarPedaco = {
      brief: carregado.projeto.brief,
      ...(carregado.projeto.brief.duracao_alvo_segundos !== undefined
        ? { duracao_alvo_segundos: carregado.projeto.brief.duracao_alvo_segundos }
        : {}),
      pedaco_atual: pedacoAtual,
      resumo_demais_pedacos: resumoDePedacos(irmaos),
      versao_contrato: VERSAO_CONTRATO_ROTEIRO,
      versao_contrato_gerador: VERSAO_CONTRATO_GERADOR,
      versao_gerador: VERSAO_GERADOR,
    };
    const registro = this.jobs.criar("regenerar-pedaco", { projeto_id: id, pedaco_id: pedacoId });
    this.rodarJobCli(registro, "src/roteiro/gerador/cli.ts", pedido, TEMPO_LIMITE_GERACAO_MS, (stdout) => {
      this.assimilarPedacoRegenerado(id, registro, pedacoId, indiceDoAlvo, stdout);
    }, (stderr) => {
      this.concluirJobErro(registro, stderr);
    });
    responderJobAceito(res, registro.id);
  }

  /** Job regenerar ok: substitui SO o pedaco alvo (irmaos byte a byte
   *  intactos — FQ-G2), recalcula o total e limpa a edicao/preview. */
  private assimilarPedacoRegenerado(
    id: string,
    registro: { id: string },
    pedacoId: string,
    indice: number,
    stdout: string,
  ): void {
    const carregado = this.exigirProjeto(id);
    const roteiro = carregado.projeto.roteiro;
    if (roteiro === undefined) {
      throw new Error("roteiro sumiu do disco durante o job de regeneracao");
    }
    let pedacoNovo: Pedaco;
    try {
      pedacoNovo = JSON.parse(stdout) as Pedaco;
    } catch (erro) {
      throw new Error(`saida do gerador nao e JSON valido: ${(erro as Error).message}`);
    }
    const validacao = validarPedaco(pedacoNovo);
    if (!validacao.valido) {
      throw new Error(`o pedaco regenerado nao valida: ${validacao.problemas.join("; ")}`);
    }
    const alvo = roteiro.pedacos[indice];
    if (alvo === undefined) {
      throw new Error("o indice do pedaco regenerado sumiu do roteiro em disco");
    }
    const pedacos = [...roteiro.pedacos];
    // A identidade (id + indice) e do alvo — o gerador reaplica, mas a
    // posicao e estavel por construcao (FQ-G2).
    pedacos[indice] = { ...pedacoNovo, id: alvo.id, indice: alvo.indice };
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      roteiro: {
        schema_version: roteiro.schema_version,
        pedacos,
        duracao_total_segundos: somaArredondada(pedacos),
      },
      // A edicao foi dobrada no pedaco regenerado — limpa (api.md §regenerar).
      pedacos_editados: semChave(carregado.projeto.pedacos_editados, pedacoId),
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    // O preview do pedaco regenerado mostrava o conteudo ANTIGO — poda
    // (servir o mp4 velho mostraria o slide errado).
    const previews = this.carregarPreviews(id);
    delete previews[pedacoId];
    this.salvarPreviews(id, previews);
    this.concluirJobOk(
      registro,
      { tipo: "roteiro-json", caminho: `/api/projetos/${id}` },
      "Pedaco regenerado.",
    );
  }

  private async editarPedaco(
    req: IncomingMessage,
    res: ServerResponse,
    id: string,
    pedacoId: string,
  ): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const roteiro = carregado.projeto.roteiro;
    if (roteiro === undefined) {
      throw new ErroHttp(404, "pedaco-nao-encontrado", `pedaco "${pedacoId}" nao existe (roteiro ainda nao gerado)`);
    }
    const pedacoBase = roteiro.pedacos.find((p) => p.id === pedacoId);
    if (pedacoBase === undefined) {
      throw new ErroHttp(404, "pedaco-nao-encontrado", `pedaco "${pedacoId}" nao existe no roteiro`);
    }
    const corpo = await lerJsonDoCorpo(req);
    const resultado = validarEdicaoPedaco(corpo);
    if (!resultado.valido) {
      const anexoProibido = resultado.problemas.some((p) => p.includes(REGRA_EDICAO_ANEXO_PROIBIDO));
      throw new ErroHttp(
        400,
        anexoProibido ? "edicao-anexo-proibido" : "edicao-invalida",
        "delta de edicao invalido",
        resultado.problemas,
      );
    }
    const edicao = corpo as EdicaoPedaco;
    // Anexo NAO entra por PATCH; gif/video so com anexo ja existente
    // (regra anexo-exigido-para-gif-video — upload primeiro, tipo depois).
    if ((edicao.tipo_visual === "gif" || edicao.tipo_visual === "video") && pedacoBase.anexo_hash === undefined) {
      throw new ErroHttp(
        400,
        "anexo-exigido-para-gif-video",
        `tipo_visual "${edicao.tipo_visual}" exige anexo no pedaco — envie o anexo primeiro (PUT anexo)`,
      );
    }
    const anterior = carregado.projeto.pedacos_editados[pedacoId];
    const delta = anterior === undefined ? edicao : { ...anterior, ...edicao };
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      pedacos_editados: { ...carregado.projeto.pedacos_editados, [pedacoId]: delta },
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    // A resposta e o pedaco como o GET o servira (aplicacao sobre a base).
    responderJson(res, 200, editarPedaco(pedacoBase, delta));
  }

  // ── Narracao ────────────────────────────────────────────────────────────────

  /** O pedaco da BASE do roteiro, ou erro. O status do pedaco ausente
   *  e 409 so no PUT narracao (api.md: "409 ... ou o pedaco nao
   *  existe"); nas demais rotas e 404. */
  private pedacoBaseOuErro(projeto: ProjetoRoteiro, pedacoId: string, statusSeAusente: number): Pedaco {
    const roteiro = projeto.roteiro;
    if (roteiro === undefined) {
      throw new ErroHttp(statusSeAusente, "pedaco-nao-encontrado", `pedaco "${pedacoId}" nao existe (roteiro ainda nao gerado)`);
    }
    const pedaco = roteiro.pedacos.find((p) => p.id === pedacoId);
    if (pedaco === undefined) {
      throw new ErroHttp(statusSeAusente, "pedaco-nao-encontrado", `pedaco "${pedacoId}" nao existe no roteiro`);
    }
    return pedaco;
  }

  private async enviarGravacao(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    id: string,
    pedacoId: string,
  ): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const pedacoBase = this.pedacoBaseOuErro(carregado.projeto, pedacoId, 409);
    const roteiro = carregado.projeto.roteiro!;
    const merged = aplicarEdicoes(roteiro, carregado.projeto.pedacos_editados);
    const pedacoAtual = merged.pedacos[pedacoBase.indice]!;
    // 409: sem fala nao ha o que narrar (FQ-U3 — a rota so narra fala).
    if (pedacoAtual.fala === "") {
      throw new ErroHttp(409, "pedaco-sem-fala", `o pedaco "${pedacoId}" nao tem fala para narrar`);
    }
    // Teto na camada HTTP (413 — decisao do REPLAN; o modulo nao tem teto).
    const bytes = await lerCorpo(req, TETO_NARRACAO_BYTES);
    const tipoDeclarado = String(req.headers["content-type"] ?? "audio/webm");
    const nome = url.searchParams.get("nome") ?? "gravacao";
    let hashAudio: string;
    try {
      const resultado = await receberGravacao(bytes, { tipo: tipoDeclarado, nome_original: nome }, { store: this.store });
      hashAudio = resultado.hash_audio;
    } catch (erro) {
      if (erro instanceof ErroGravacaoVazia) {
        throw new ErroHttp(400, "gravacao-vazia", erro.message);
      }
      if (erro instanceof ErroConversaoAudio) {
        throw new ErroHttp(400, "conversao-audio", erro.message);
      }
      if (erro instanceof ErroAudioInvalido) {
        throw new ErroHttp(400, "audio-invalido", erro.message);
      }
      throw erro;
    }
    // Assimilacao: o pedaco servido (com edicoes) vira a base e a
    // narracao nova (texto == FALA SERVIDA — D4). Sem isso o merge
    // seguinte remarcaria a narracao como "editado" (texto != fala da
    // base) — audio em dia vira stale por engano.
    const pedacoNovo: Pedaco = {
      ...pedacoAtual,
      narracao: { texto: pedacoAtual.fala, origem: "gravacao", hash_audio: hashAudio, status: "gerado" },
    };
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      roteiro: {
        schema_version: roteiro.schema_version,
        pedacos: roteiro.pedacos.map((p) => (p.id === pedacoId ? pedacoNovo : p)),
        duracao_total_segundos: roteiro.duracao_total_segundos,
      },
      pedacos_editados: semChave(carregado.projeto.pedacos_editados, pedacoId),
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    responderJson(res, 201, pedacoNovo.narracao);
  }

  private async obterAudioNarracao(res: ServerResponse, id: string, pedacoId: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const pedaco = this.pedacoBaseOuErro(carregado.projeto, pedacoId, 404);
    if (pedaco.narracao.origem === "nenhuma" || pedaco.narracao.hash_audio === undefined) {
      throw new ErroHttp(404, "narracao-nao-gravada", `o pedaco "${pedacoId}" nao tem gravacao para baixar`);
    }
    const bytes = await this.store.get(pedaco.narracao.hash_audio);
    if (bytes === null) {
      throw new ErroHttp(
        500,
        "narracao-corrompida",
        `os bytes do wav do pedaco "${pedacoId}" sumiram do store (hash ${pedaco.narracao.hash_audio.slice(0, 12)}…)`,
      );
    }
    responderBytes(res, 200, bytes, "audio/wav");
  }

  private async removerNarracao(res: ServerResponse, id: string, pedacoId: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const pedaco = this.pedacoBaseOuErro(carregado.projeto, pedacoId, 404);
    if (pedaco.narracao.origem === "nenhuma") {
      throw new ErroHttp(404, "narracao-nao-gravada", `o pedaco "${pedacoId}" nao tem narracao para remover`);
    }
    const roteiro = carregado.projeto.roteiro!;
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      roteiro: {
        schema_version: roteiro.schema_version,
        pedacos: roteiro.pedacos.map((p) =>
          p.id === pedacoId
            ? { ...p, narracao: { texto: "", origem: "nenhuma", status: "vazio" } }
            : p,
        ),
        duracao_total_segundos: roteiro.duracao_total_segundos,
      },
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    responderSemCorpo(res, 204);
  }

  // ── Anexo (gif/video do usuario) ────────────────────────────────────────────

  private async enviarAnexo(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    id: string,
    pedacoId: string,
  ): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const pedaco = this.pedacoBaseOuErro(carregado.projeto, pedacoId, 404);
    const tipoBruto = String(req.headers["content-type"] ?? "");
    const tipo = tipoBruto.split(";")[0]!.trim();
    if (!VOCABULARIO_DE_TIPOS_DE_ANEXO.has(tipo)) {
      throw new ErroHttp(
        400,
        "anexo-tipo-permitido",
        `Content-Type "${tipo}" fora da allowlist (image/gif | video/mp4 | video/webm)`,
      );
    }
    const bytes = await lerCorpo(req, ANEXO_TAMANHO_MAXIMO_BYTES + FOLGA_ANEXO_BYTES);
    const nomeOriginal = url.searchParams.get("nome") ?? String(req.headers["x-nome-original"] ?? "anexo");
    let resultado: ResultadoDoAnexo;
    try {
      resultado = await receberAnexo(bytes, { tipo, nome_original: nomeOriginal }, { store: this.store });
    } catch (erro) {
      if (erro instanceof ErroTipoAnexoInvalido) {
        throw new ErroHttp(400, "anexo-tipo-permitido", erro.message);
      }
      if (erro instanceof ErroTamanhoAnexoExcedido) {
        throw new ErroHttp(400, "anexo-tamanho-limite", erro.message);
      }
      if (erro instanceof ErroAnexoVazio) {
        throw new ErroHttp(400, "anexo-vazio", erro.message);
      }
      throw erro;
    }
    // Upload primeiro, tipo depois: o par muda, `tipo_visual` NAO
    // (api.md §anexo). O par inconsistente e estado transitorio valido.
    const roteiro = carregado.projeto.roteiro!;
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      roteiro: {
        schema_version: roteiro.schema_version,
        pedacos: roteiro.pedacos.map((p) =>
          p.id === pedacoId
            ? { ...p, anexo_hash: resultado.hash_anexo, anexo_meta: resultado.anexo_meta }
            : p,
        ),
        duracao_total_segundos: roteiro.duracao_total_segundos,
      },
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    responderJson(res, 201, {
      hash: resultado.hash_anexo,
      tipo: resultado.anexo_meta.tipo,
      tamanho: resultado.anexo_meta.tamanho_bytes,
      nome_original: resultado.anexo_meta.nome_original,
    });
  }

  private async obterAnexo(res: ServerResponse, id: string, pedacoId: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const pedaco = this.pedacoBaseOuErro(carregado.projeto, pedacoId, 404);
    if (pedaco.anexo_hash === undefined || pedaco.anexo_meta === undefined) {
      throw new ErroHttp(404, "anexo-inexistente", `o pedaco "${pedacoId}" nao tem anexo para baixar`);
    }
    const bytes = await this.store.get(pedaco.anexo_hash);
    if (bytes === null) {
      throw new ErroHttp(
        500,
        "anexo-corrompido",
        `os bytes do anexo do pedaco "${pedacoId}" sumiram do store (hash ${pedaco.anexo_hash.slice(0, 12)}…)`,
      );
    }
    responderBytes(res, 200, bytes, pedaco.anexo_meta.tipo);
  }

  private async removerAnexo(res: ServerResponse, id: string, pedacoId: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const pedaco = this.pedacoBaseOuErro(carregado.projeto, pedacoId, 404);
    if (pedaco.anexo_hash === undefined || pedaco.anexo_meta === undefined) {
      throw new ErroHttp(404, "anexo-inexistente", `o pedaco "${pedacoId}" nao tem anexo para remover`);
    }
    // Remove SO o par do pedaco; os bytes permanecem no store (S-8,
    // append-only). `tipo_visual` NAO muda — se era gif/video, o pedaco
    // fica transitorio ate o usuario editar (anexo-exigido-para-gif-video).
    const roteiro = carregado.projeto.roteiro!;
    const projeto: ProjetoRoteiro = {
      ...carregado.projeto,
      roteiro: {
        schema_version: roteiro.schema_version,
        pedacos: roteiro.pedacos.map((p) => {
          if (p.id !== pedacoId) {
            return p;
          }
          const semAnexo = { ...p };
          delete semAnexo.anexo_hash;
          delete semAnexo.anexo_meta;
          return semAnexo;
        }),
        duracao_total_segundos: roteiro.duracao_total_segundos,
      },
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarProjeto(projeto);
    responderSemCorpo(res, 204);
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  private async pedirPreview(res: ServerResponse, id: string, pedacoId: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const roteiro = carregado.projeto.roteiro;
    if (roteiro === undefined) {
      throw new ErroHttp(409, "roteiro-nao-gerado", "gere o roteiro antes de pedir previews");
    }
    const merged = aplicarEdicoes(roteiro, carregado.projeto.pedacos_editados);
    const pedaco = merged.pedacos.find((p) => p.id === pedacoId);
    if (pedaco === undefined) {
      throw new ErroHttp(404, "pedaco-nao-encontrado", `pedaco "${pedacoId}" nao existe no roteiro`);
    }
    // 409: visual nao producivel (gif/video sem anexo — o anexo e o
    // asset; sem ele nao ha o que renderizar). Manim/grafico sem motor
    // cai no JOB erro com mensagem clara (FQ-P3), nunca em 409 aqui.
    if (
      (pedaco.tipo_visual === "gif" || pedaco.tipo_visual === "video") &&
      pedaco.anexo_hash === undefined
    ) {
      throw new ErroHttp(
        409,
        "anexo-exigido-para-gif-video",
        `o pedaco "${pedacoId}" tem visual ${pedaco.tipo_visual} sem anexo — envie o anexo primeiro`,
      );
    }
    const registro = this.jobs.criar("preview-pedaco", { projeto_id: id, pedaco_id: pedacoId });
    // O CLI do preview so consome o PEDACO ALVO (renderizarPreviewPedaco
    // le roteiro.pedacos[indice_pedaco]) mas revalida o ROTEIRO DO
    // PEDIDO (rejeitarRoteiroInvalido em manifestoReduzidoDoPedaco) — e
    // o roteiro reduzido carrega o alvo com id/INDICE ORIGINAIS: pedaco
    // de indice 1+ falharia "indices-nao-contiguos"/"id-nao-casa-indice"
    // (bug latente do modulo de preview para indice > 0, nunca
    // exercitado pelos testes dele, que so renderizam indice 0). O
    // servidor normaliza o pedido: um roteiro de UM pedaco com o alvo na
    // posicao 0 (id p-000/indice 0) — o manifesto reduzido e por-pedaco
    // de qualquer forma (FQ-M3) e o id do no da cena vem da posicao
    // (n-<indice>, mapear.ts), nunca do id do pedaco: o render e o cache
    // C7 ficam identicos. ACHADO para a proxima onda: o conserto de
    // verdade mora em manifestoReduzidoDoPedaco (src/roteiro/preview/).
    const pedido = {
      roteiro: {
        schema_version: merged.schema_version,
        pedacos: [{ ...pedaco, id: "p-000", indice: 0 }],
        duracao_total_segundos: pedaco.duracao_segundos,
      },
      indice_pedaco: 0,
      opcoes: {
        store_raiz: this.raizStore,
        previews_raiz: this.raizPreviews,
        resolucao_raiz: this.raizResolucao,
      },
    };
    this.rodarJobCli(registro, "src/roteiro/preview/cli.ts", pedido, TEMPO_LIMITE_JOB_MS, (stdout) => {
      this.assimilarPreview(id, registro, pedacoId, stdout);
    }, (stderr) => {
      this.concluirJobErro(registro, stderr);
    });
    responderJobAceito(res, registro.id);
  }

  private assimilarPreview(id: string, registro: { id: string }, pedacoId: string, stdout: string): void {
    let saida: { hash?: unknown; caminho?: unknown; duracao_segundos?: unknown };
    try {
      saida = JSON.parse(stdout) as typeof saida;
    } catch (erro) {
      throw new Error(`saida do preview nao e JSON valido: ${(erro as Error).message}`);
    }
    if (
      typeof saida.hash !== "string" ||
      typeof saida.caminho !== "string" ||
      typeof saida.duracao_segundos !== "number"
    ) {
      throw new Error("saida do preview sem hash/caminho/duracao_segundos");
    }
    const previews = this.carregarPreviews(id);
    previews[pedacoId] = {
      hash: saida.hash,
      caminho: isAbsolute(saida.caminho) ? saida.caminho : resolve(this.raizDoProjeto, saida.caminho),
      duracao_segundos: saida.duracao_segundos,
      atualizado_em: this.relogio().toISOString(),
    };
    this.salvarPreviews(id, previews);
    this.concluirJobOk(
      registro,
      { tipo: "video-mp4", caminho: `/api/projetos/${id}/pedacos/${pedacoId}/preview.mp4` },
      "Preview pronto.",
    );
  }

  private async obterPreviewMp4(req: IncomingMessage, res: ServerResponse, id: string, pedacoId: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const roteiro = carregado.projeto.roteiro;
    if (roteiro === undefined || !roteiro.pedacos.some((p) => p.id === pedacoId)) {
      throw new ErroHttp(404, "pedaco-nao-encontrado", `pedaco "${pedacoId}" nao existe no roteiro`);
    }
    // 409: o render esta em andamento — a UI espera o poll do job
    // (FQ-U2: nunca mostra sucesso sem resposta real).
    const registros = this.jobs
      .listarDoProjeto(id)
      .filter((r) => r.tipo === "preview-pedaco" && r.alvo.pedaco_id === pedacoId);
    const ultimo = registros.length > 0 ? registros[registros.length - 1]! : null;
    if (ultimo !== null) {
      const status = this.jobs.lerStatus(ultimo.id);
      if (status !== null && (status.estado === "pendente" || status.estado === "rodando")) {
        throw new ErroHttp(409, "preview-em-andamento", "o preview deste pedaco esta sendo renderizado");
      }
    }
    const previews = this.carregarPreviews(id);
    const registro = previews[pedacoId];
    if (registro === undefined) {
      throw new ErroHttp(404, "preview-nao-renderizado", `o pedaco "${pedacoId}" ainda nao foi renderizado`);
    }
    // Revalida ANTES de servir (C1/C4): artefato errado e 500 honesto,
    // nunca sucesso com imagem errada.
    try {
      await conferirPreview(registro.hash, { previewsRaiz: this.raizPreviews });
    } catch (erro) {
      throw new ErroHttp(
        500,
        "preview-invalido",
        `o preview do pedaco "${pedacoId}" nao passa na conferencia: ${(erro as Error).message}`,
      );
    }
    this.servirArquivo(req, res, registro.caminho, "video/mp4");
  }

  // ── Juntar / entrega ────────────────────────────────────────────────────────

  private async pedirJuntar(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    const carregado = this.exigirProjeto(id);
    const roteiro = carregado.projeto.roteiro;
    if (roteiro === undefined) {
      throw new ErroHttp(409, "roteiro-nao-gerado", "gere o roteiro antes de juntar");
    }
    const merged = aplicarEdicoes(roteiro, carregado.projeto.pedacos_editados);
    // GATE de narracao (record-first): fala sem narracao e 409 listando
    // os pedacos — nunca entrega fala muda (C1).
    const semNarracao = verificarJuntarFalaSemNarracao(merged);
    if (semNarracao.length > 0) {
      throw new ErroHttp(409, "juntar-fala-sem-narracao", "ha fala sem narracao — grave (ou gere) o audio antes de juntar", semNarracao);
    }
    // Revalidacao do roteiro servido: o par de anexo inconsistente
    // (DELETE de anexo depois do tipo gif/video) bloqueia o juntar.
    const validacao = validarRoteiro(merged);
    if (!validacao.valido) {
      const anexoInconsistente = validacao.problemas.some((p) => p.includes(REGRA_ANEXO_EXIGIDO));
      throw new ErroHttp(
        409,
        anexoInconsistente ? "anexo-exigido-para-gif-video" : "juntar-roteiro-invalido",
        "o roteiro nao esta juntavel",
        validacao.problemas,
      );
    }
    const previews = this.carregarPreviews(id);
    const semPreview = merged.pedacos.filter((p) => previews[p.id] === undefined);
    if (semPreview.length > 0) {
      throw new ErroHttp(
        409,
        "juntar-preview-ausente",
        "algum pedaco nao tem preview renderizado",
        semPreview.map((p) => `pedacos[${String(p.indice)}].id ${p.id}`),
      );
    }
    // Um job de juntar em andamento e 409 (api.md §juntar).
    const juntarEmAndamento = this.jobs
      .listarDoProjeto(id)
      .filter((r) => r.tipo === "juntar-video")
      .map((r) => this.jobs.lerStatus(r.id))
      .some((s) => s !== null && (s.estado === "pendente" || s.estado === "rodando"));
    if (juntarEmAndamento) {
      throw new ErroHttp(409, "juntar-em-andamento", "ja ha um juntar em andamento para este projeto");
    }
    const corpo = (await lerJsonDoCorpo(req)) as { musica_caminho?: unknown };
    let musicaCaminho: string | undefined;
    if (corpo.musica_caminho !== undefined) {
      if (typeof corpo.musica_caminho !== "string" || corpo.musica_caminho === "") {
        throw new ErroHttp(400, "corpo-invalido", "musica_caminho precisa ser um caminho de disco nao-vazio");
      }
      if (/^https?:\/\//i.test(corpo.musica_caminho)) {
        throw new ErroHttp(400, "corpo-invalido", "musica_caminho e caminho de disco do servidor, nunca URL (C7)");
      }
      const caminhoResolvido = isAbsolute(corpo.musica_caminho)
        ? corpo.musica_caminho
        : resolve(this.raizDoProjeto, corpo.musica_caminho);
      if (!existsSync(caminhoResolvido)) {
        throw new ErroHttp(400, "corpo-invalido", `arquivo de musica nao encontrado: ${corpo.musica_caminho}`);
      }
      musicaCaminho = caminhoResolvido;
    }
    const previewsMap: Record<string, string> = {};
    for (const pedaco of merged.pedacos) {
      previewsMap[pedaco.id] = previews[pedaco.id]!.caminho;
    }
    // timing_pedacos: OMITIDO — gravacao nao deriva legendas (D4); hoje
    // nao ha TTS com timing neste app, entao sempre omitido.
    const pedido = {
      roteiro: merged,
      opcoes: {
        previews: previewsMap,
        ...(musicaCaminho !== undefined ? { musica_caminho: musicaCaminho } : {}),
      },
    };
    const registro = this.jobs.criar("juntar-video", { projeto_id: id });
    this.rodarJobCli(registro, "src/roteiro/juntar/cli.ts", pedido, TEMPO_LIMITE_JOB_MS, (stdout) => {
      this.assimilarEntrega(id, registro, stdout);
    }, (stderr) => {
      this.concluirJobErro(registro, stderr);
    });
    responderJobAceito(res, registro.id);
  }

  private assimilarEntrega(id: string, registro: { id: string }, stdout: string): void {
    let saida: { hash?: unknown; caminho?: unknown; duracao_total_segundos?: unknown };
    try {
      saida = JSON.parse(stdout) as typeof saida;
    } catch (erro) {
      throw new Error(`saida do juntar nao e JSON valido: ${(erro as Error).message}`);
    }
    if (typeof saida.hash !== "string" || typeof saida.caminho !== "string") {
      throw new Error("saida do juntar sem hash/caminho");
    }
    this.salvarEntrega(id, {
      hash: saida.hash,
      caminho: isAbsolute(saida.caminho) ? saida.caminho : resolve(this.raizDoProjeto, saida.caminho),
      duracao_total_segundos:
        typeof saida.duracao_total_segundos === "number" ? saida.duracao_total_segundos : 0,
      atualizado_em: this.relogio().toISOString(),
    });
    this.concluirJobOk(
      registro,
      { tipo: "video-mp4", caminho: `/api/projetos/${id}/video-final.mp4` },
      "Video juntado e entregue.",
    );
  }

  private async obterVideoFinal(req: IncomingMessage, res: ServerResponse, id: string): Promise<void> {
    this.exigirProjeto(id);
    const juntarEmAndamento = this.jobs
      .listarDoProjeto(id)
      .filter((r) => r.tipo === "juntar-video")
      .map((r) => this.jobs.lerStatus(r.id))
      .some((s) => s !== null && (s.estado === "pendente" || s.estado === "rodando"));
    if (juntarEmAndamento) {
      throw new ErroHttp(409, "juntar-em-andamento", "o juntar esta em andamento — espere o poll do job");
    }
    const entrega = this.carregarEntrega(id);
    if (entrega === null) {
      throw new ErroHttp(404, "entrega-nao-existe", "o projeto ainda nao foi juntado");
    }
    // Revalida ANTES de servir (C1/C4): a entrega tem de ter video+audio
    // e conteudo real — falha e 500 honesto, nunca "ok" mentiroso.
    const conferencia = await conferirEntrega(entrega.hash, { dirEntregas: this.dirEntregas });
    if (conferencia.problemas.length > 0) {
      throw new ErroHttp(500, "entrega-invalida", "a entrega nao passa na conferencia", conferencia.problemas);
    }
    this.servirArquivo(req, res, entrega.caminho, "video/mp4");
  }

  // ── Jobs ────────────────────────────────────────────────────────────────────

  private async obterJob(res: ServerResponse, jobId: string): Promise<void> {
    const status = this.jobs.lerStatus(jobId);
    if (status === null) {
      // Jobs sao efemeros: 404 = "job expirou" — a UI re-pede a operacao.
      throw new ErroHttp(404, "job-nao-encontrado", `job "${jobId}" nao existe ou expirou`);
    }
    responderJson(res, 200, status);
  }

  // ── Estatica (a SPA — Onda 6) ───────────────────────────────────────────────

  private tratarSpa(req: IncomingMessage, res: ServerResponse, url: URL): void {
    if (req.method !== "GET") {
      responderErro(res, 405, "metodo-nao-permitido", "a SPA so responde a GET");
      return;
    }
    if (url.pathname.startsWith("/assets/")) {
      const relativo = url.pathname.slice("/assets/".length);
      if (
        relativo === "" ||
        relativo.includes("..") ||
        relativo.startsWith("/") ||
        relativo.startsWith("\\")
      ) {
        responderErro(res, 404, "rota-nao-encontrada", "caminho de asset invalido");
        return;
      }
      // O build da SPA (vite) coloca os estaticos em <raiz>/assets/ e o
      // index.html os referencia como /assets/<arquivo> — o prefixo da
      // URL corresponde ao subdiretorio "assets" da raiz estatica.
      const caminho = join(this.raizEstatica, "assets", relativo);
      if (!existeArquivo(caminho)) {
        responderErro(res, 404, "rota-nao-encontrada", `asset "${relativo}" nao existe`);
        return;
      }
      this.servirArquivo(req, res, caminho, mimeDe(extname(caminho)));
      return;
    }
    // Qualquer GET fora de /api/ e de /assets/* serve o index (fallback
    // do roteamento do cliente — api.md §GET /).
    const index = join(this.raizEstatica, "index.html");
    if (!existeArquivo(index)) {
      responderErro(
        res,
        404,
        "rota-nao-encontrada",
        `a SPA ainda nao foi construida (falta ${index} — a Onda 6 produz dist/web/)`,
      );
      return;
    }
    this.servirArquivo(req, res, index, "text/html; charset=utf-8");
  }

  /** Serve um arquivo com suporte a Range (206) — o <video> da SPA
   *  precisa de seek; o 200 completo e o caso sem Range. */
  private servirArquivo(req: IncomingMessage, res: ServerResponse, caminho: string, contentType: string): void {
    let stats: ReturnType<typeof statSync>;
    try {
      stats = statSync(caminho);
    } catch (erro) {
      throw new ErroHttp(
        500,
        "erro-interno",
        `o arquivo ${caminho} sumiu do disco ao servir: ${(erro as Error).message}`,
      );
    }
    const range = req.headers.range;
    if (typeof range === "string" && range !== "") {
      const faixa = parseRange(range, stats.size);
      if (faixa === null) {
        res.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
        res.end();
        return;
      }
      const { inicio, fim } = faixa;
      res.writeHead(206, {
        "Content-Type": contentType,
        "Content-Length": fim - inicio + 1,
        "Content-Range": `bytes ${inicio}-${fim}/${stats.size}`,
        "Accept-Ranges": "bytes",
      });
      createReadStream(caminho, { start: inicio, end: fim }).pipe(res);
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Accept-Ranges": "bytes",
    });
    createReadStream(caminho).pipe(res);
  }

  // ── Suporte ─────────────────────────────────────────────────────────────────

  private exigirProjeto(id: string): { projeto: ProjetoRoteiro; avisos: string[] } {
    const carregado = this.carregarProjeto(id);
    if (carregado === null) {
      throw new ErroHttp(404, "projeto-nao-encontrado", `projeto "${id}" nao existe`);
    }
    return carregado;
  }
}

// ─── Helpers HTTP ──────────────────────────────────────────────────────────────

const VOCABULARIO_DE_TIPOS_DE_ANEXO = new Set(["image/gif", "video/mp4", "video/webm"]);

/** Le o corpo inteiro, com teto de bytes (413 acima — a camada HTTP). */
function lerCorpo(req: IncomingMessage, limiteBytes: number): Promise<Buffer> {
  return new Promise((resolve, rejeitar) => {
    const partes: Buffer[] = [];
    let total = 0;
    let estourado = false;
    req.on("data", (parte: Buffer) => {
      total += parte.length;
      if (total > limiteBytes) {
        estourado = true;
        return;
      }
      partes.push(parte);
    });
    req.on("end", () => {
      if (estourado) {
        rejeitar(
          new ErroHttp(413, "payload-grande-demais", `corpo acima do limite de ${limiteBytes} bytes`),
        );
        return;
      }
      resolve(Buffer.concat(partes));
    });
    req.on("error", (erro) => {
      rejeitar(new ErroHttp(400, "corpo-invalido", `falha ao ler o corpo: ${erro.message}`));
    });
  });
}

/** Le o corpo e o parseia como JSON (vazio = {}; invalido = 400). */
async function lerJsonDoCorpo(req: IncomingMessage): Promise<unknown> {
  const bytes = await lerCorpo(req, TETO_JSON_BYTES);
  if (bytes.length === 0) {
    return {};
  }
  try {
    return JSON.parse(bytes.toString("utf-8")) as unknown;
  } catch (erro) {
    throw new ErroHttp(400, "corpo-invalido", `corpo nao e JSON valido: ${(erro as Error).message}`);
  }
}

function responderJson(
  res: ServerResponse,
  status: number,
  corpo: unknown,
  cabecalhosExtras: Record<string, string> = {},
): void {
  const bytes = Buffer.from(`${JSON.stringify(corpo)}\n`, "utf-8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": bytes.length,
    ...cabecalhosExtras,
  });
  res.end(bytes);
}

function responderErro(
  res: ServerResponse,
  status: number,
  codigo: string,
  mensagem: string,
  detalhes?: readonly string[],
  cabecalhosExtras?: Record<string, string>,
): void {
  responderJson(res, status, envelopeDeErro(codigo, mensagem, detalhes), cabecalhosExtras);
}

function responderSemCorpo(res: ServerResponse, status: number): void {
  res.writeHead(status, { "Content-Length": 0 });
  res.end();
}

function responderBytes(res: ServerResponse, status: number, bytes: Buffer, contentType: string): void {
  res.writeHead(status, { "Content-Type": contentType, "Content-Length": bytes.length });
  res.end(bytes);
}

function responderJobAceito(res: ServerResponse, jobId: string): void {
  const corpo = Buffer.from(`${JSON.stringify({ job_id: jobId })}\n`, "utf-8");
  res.writeHead(202, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": corpo.length,
    Location: `/api/jobs/${jobId}`,
  });
  res.end(corpo);
}

/** "bytes=inicio-fim" (uma faixa so — o suficiente para o <video>). */
function parseRange(range: string, tamanho: number): { inicio: number; fim: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m === null) {
    return null;
  }
  const inicioBruto = m[1]!;
  const fimBruto = m[2]!;
  if (inicioBruto === "" && fimBruto === "") {
    return null;
  }
  let inicio: number;
  let fim: number;
  if (inicioBruto === "") {
    // "bytes=-N": os ultimos N bytes.
    const n = Number(fimBruto);
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    inicio = Math.max(0, tamanho - n);
    fim = tamanho - 1;
  } else {
    inicio = Number(inicioBruto);
    fim = fimBruto === "" ? tamanho - 1 : Number(fimBruto);
    if (!Number.isFinite(inicio) || !Number.isFinite(fim) || inicio < 0 || inicio > fim) {
      return null;
    }
  }
  if (inicio >= tamanho) {
    return null;
  }
  return { inicio, fim: Math.min(fim, tamanho - 1) };
}

function existeArquivo(caminho: string): boolean {
  try {
    return statSync(caminho).isFile();
  } catch {
    return false;
  }
}

/** MIME por extensao — suficiente para os estaticos da SPA (C6: tudo local). */
function mimeDe(extensao: string): string {
  switch (extensao) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    case ".ttf":
      return "font/ttf";
    case ".mp4":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".map":
      return "application/json";
    default:
      return "application/octet-stream";
  }
}

function podarPorIds(
  editados: Readonly<Record<string, EdicaoPedaco>>,
  roteiro: Roteiro,
): Record<string, EdicaoPedaco> {
  const podados: Record<string, EdicaoPedaco> = {};
  for (const [id, edicao] of Object.entries(editados)) {
    if (roteiro.pedacos.some((p) => p.id === id)) {
      podados[id] = edicao;
    }
  }
  return podados;
}

function semChave(
  registro: Readonly<Record<string, EdicaoPedaco>>,
  chave: string,
): Record<string, EdicaoPedaco> {
  const restante: Record<string, EdicaoPedaco> = {};
  for (const [id, edicao] of Object.entries(registro)) {
    if (id !== chave) {
      restante[id] = edicao;
    }
  }
  return restante;
}

// ─── Startup ───────────────────────────────────────────────────────────────────

/**
 * Cria o servidor HTTP (sem listen). O handler NUNCA lanca para fora —
 * todo erro vira o envelope do api.md (FQ-S1: rota invalida nunca vira
 * 500 silencioso; 500 so com mensagem honesta).
 */
export function criarServidor(opcoes: OpcoesDoServidor = {}): { servidor: Server; app: ServidorApp } {
  const app = new ServidorApp(opcoes);
  const servidor = createServer((req, res) => {
    app
      .tratarRequisicao(req, res)
      .catch((erro: unknown) => {
        if (erro instanceof ErroHttp) {
          responderErro(res, erro.status, erro.codigo, erro.message, erro.detalhes);
          return;
        }
        responderErro(res, 500, "erro-interno", `erro interno: ${(erro as Error).message}`);
      });
  });
  return { servidor, app };
}

/**
 * Sobe o servidor e imprime o banner. Colisao de porta (S-9) e erro
 * claro, nunca silencio (FQ-S4): ErroPortaEmUso com a porta nomeada.
 */
export async function iniciarServidor(opcoes: OpcoesDoServidor = {}): Promise<{
  servidor: Server;
  porta: number;
}> {
  const { servidor, app } = criarServidor(opcoes);
  const porta = opcoes.porta ?? PORTA_PADRAO;
  await new Promise<void>((resolve, rejeitar) => {
    servidor.once("error", (erro) => {
      if ((erro as NodeJS.ErrnoException).code === "EADDRINUSE") {
        rejeitar(new ErroPortaEmUso(porta, erro.message));
        return;
      }
      rejeitar(erro);
    });
    servidor.listen(porta, "127.0.0.1", () => resolve());
  });
  const endereco = servidor.address();
  const portaReal = typeof endereco === "object" && endereco !== null ? endereco.port : porta;
  app.logar(`Editor de Vídeo IA — http://localhost:${portaReal}`);
  // O pin do ffmpeg da narracao e conferido UMA vez no startup (o mesmo
  // papel de versaoDoFfmpeg do produzir). Divergencia e AVISO, nunca
  // derruba o servidor: a conversao roda igual, o determinismo entre
  // versoes de ferramenta e que fica declarado por pin.
  void conferirPinDoFfmpeg().catch((erro: unknown) => {
    app.logar(`AVISO (ffmpeg): ${(erro as Error).message}`);
  });
  return { servidor, porta: portaReal };
}

/** O ponto de entrada do CLI (tsx src/web/servidor.ts). */
async function principal(): Promise<void> {
  const raizDoProjeto = process.env.RAIZ_PROJETO ?? RAIZ_DO_REPOSITORIO;
  const portaLida = Number(process.env.PORT ?? String(PORTA_PADRAO));
  const ttlLido = process.env.ROTEIRO_JOBS_TTL_MS === undefined ? undefined : Number(process.env.ROTEIRO_JOBS_TTL_MS);
  try {
    await iniciarServidor({
      porta: Number.isFinite(portaLida) && portaLida >= 0 ? portaLida : PORTA_PADRAO,
      raizDoProjeto,
      raizDados: process.env.RAIZ_DADOS ?? join(raizDoProjeto, "dados"),
      raizEstatica: process.env.RAIZ_ESTATICA ?? join(raizDoProjeto, "dist", "web"),
      provedorPadrao: process.env.ROTEIRO_PROVEDOR ?? "sosia",
      ttlJobsMs: ttlLido !== undefined && Number.isFinite(ttlLido) ? ttlLido : undefined,
    });
  } catch (erro) {
    if (erro instanceof ErroPortaEmUso) {
      console.error(erro.message);
      process.exitCode = 1;
      return;
    }
    throw erro;
  }
}

if (process.argv[1]?.endsWith("servidor.ts")) {
  principal().catch((erro) => {
    console.error(`Editor de Video IA: falha ao iniciar — ${(erro as Error).message}`);
    process.exitCode = 1;
  });
}
