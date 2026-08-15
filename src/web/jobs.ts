/**
 * src/web/jobs.ts
 *
 * GERENCIA DE JOBS ASSINCRONOS (docs/roteiro/api.md §"Jobs assincronos").
 *
 * Todo job efemero do servidor tem DOIS arquivos em
 * `<raiz>/.cache/roteiro/jobs/` (S-8 — escrita atomica tmp+rename):
 *
 *   <jobId>.json      — o ESTADO: o JSON de JobStatus SEM id/artefato,
 *                       reescrito pelo CLI (--estado <path>, D11) a cada
 *                       avanco; o servidor escreve o estado inicial
 *                       "pendente" no momento da criacao;
 *   <jobId>.meta.json — o REGISTRO do servidor: tipo, alvo (projeto e
 *                       pedaco), criado_em e o artefato final. O CLI
 *                       nunca toca este arquivo — a leitura MERGEia os
 *                       dois (o estado pode nao carregar tipo nem
 *                       criado_em: o CLI do preview, por exemplo, so
 *                       escreve {estado, progresso, mensagem, erro}).
 *
 * Jobs sao EFEMEROS (REPLAN Onda 5): expiram apos um TTL — o poll que
 * recebe 404 trata como "job expirou" e re-pede a operacao. O GET do
 * projeto deriva os "jobs por alvo" varrendo os metas deste projeto;
 * nada disso e persistido no projeto (api.md: derivado, nunca
 * persistido).
 */

import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ─── Tipos ─────────────────────────────────────────────────────────────────────

/** Os quatro tipos de job da API (api.md — o campo `tipo` do JobStatus). */
export type TipoJob = "gerar-roteiro" | "regenerar-pedaco" | "preview-pedaco" | "juntar-video";

/** O alvo de um job — o que o GET do projeto agrupa (REPLAN: jobs por alvo). */
export interface AlvoDoJob {
  /** O projeto dono do job. */
  readonly projeto_id: string;
  /** O pedaco alvo — so para regenerar-pedaco e preview-pedaco. */
  readonly pedaco_id?: string;
}

/** O artefato final do job ok (api.md: o caminho PUBLICO, nunca o de disco). */
export interface ArtefatoDoJob {
  readonly tipo: "roteiro-json" | "video-mp4" | "audio-wav";
  /** Rota publica de download do artefato (C7: o caminho de disco nao vaza). */
  readonly caminho: string;
}

/** O JobStatus completo da api.md — o que o poll recebe. */
export interface JobStatus {
  readonly id: string;
  readonly tipo: TipoJob;
  readonly estado: "pendente" | "rodando" | "ok" | "erro";
  /** 0..1 — opcional (CLIs que nao reportam etapas deixam nulo). */
  readonly progresso: number | null;
  readonly mensagem: string;
  /** Estado terminal com erro SEMPRE traz a saida real do CLI (FQ-S3). */
  readonly erro: string | null;
  readonly criado_em: string;
  readonly atualizado_em: string;
  readonly artefato: ArtefatoDoJob | null;
}

/** O registro persistido do servidor (o arquivo .meta.json). */
interface RegistroMeta {
  readonly tipo: TipoJob;
  readonly alvo: AlvoDoJob;
  readonly criado_em: string;
  readonly artefato: ArtefatoDoJob | null;
}

/** O estado bruto escrito pelo CLI — mais magro que o JobStatus. */
interface EstadoBruto {
  readonly tipo?: string;
  readonly estado?: string;
  readonly progresso?: number | null;
  readonly mensagem?: string;
  readonly erro?: string | null;
  readonly criado_em?: string;
  readonly atualizado_em?: string;
  /** Presente so no estado terminal escrito pelo SERVIDOR (finalizarOk). */
  readonly artefato?: ArtefatoDoJob | null;
}

// ─── Utilitario de escrita atomica (tmp + rename, S-8) ─────────────────────────

/** Escreve um JSON atomico (tmp + rename): o poll nunca le o arquivo pela metade. */
export function escreverJsonAtomico(caminho: string, valor: unknown): void {
  mkdirSync(dirname(caminho), { recursive: true });
  const temporario = `${caminho}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  writeFileSync(temporario, `${JSON.stringify(valor)}\n`, "utf-8");
  renameSync(temporario, caminho);
}

// ─── O gerenciador ─────────────────────────────────────────────────────────────

export interface OpcoesDoGerenciadorDeJobs {
  /** Raiz dos registros (default: <projeto>/.cache/roteiro/jobs). */
  readonly raiz?: string;
  /** TTL de expiracao dos jobs em ms (default: 1 hora). */
  readonly ttlMs?: number;
  /** Relogio do criado_em/atualizado_em (testes injetam relogio fixo). */
  readonly relogio?: () => Date;
}

export class GerenciadorDeJobs {
  readonly raiz: string;
  readonly ttlMs: number;
  private readonly relogio: () => Date;

  constructor(opcoes: OpcoesDoGerenciadorDeJobs = {}) {
    this.raiz = opcoes.raiz ?? join(process.cwd(), ".cache", "roteiro", "jobs");
    this.ttlMs = opcoes.ttlMs ?? 60 * 60 * 1000;
    this.relogio = opcoes.relogio ?? (() => new Date());
  }

  // ── Caminhos ────────────────────────────────────────────────────────────────

  caminhoDoEstado(id: string): string {
    return join(this.raiz, `${id}.json`);
  }

  private caminhoDoMeta(id: string): string {
    return join(this.raiz, `${id}.meta.json`);
  }

  // ── Criacao ─────────────────────────────────────────────────────────────────

  /**
   * Cria um job: id `job-<32 hex>` (o formato do exemplo da api.md),
   * estado inicial "pendente" e meta com o alvo. Nao executa nada — o
   * servidor spawna o CLI em seguida com --estado <caminhoDoEstado>.
   */
  criar(tipo: TipoJob, alvo: AlvoDoJob): JobStatus {
    const id = `job-${randomBytes(16).toString("hex")}`;
    const agora = this.relogio().toISOString();
    const meta: RegistroMeta = { tipo, alvo, criado_em: agora, artefato: null };
    escreverJsonAtomico(this.caminhoDoMeta(id), meta);
    escreverJsonAtomico(this.caminhoDoEstado(id), {
      tipo,
      estado: "pendente",
      progresso: null,
      mensagem: "Enfileirado.",
      erro: null,
      criado_em: agora,
      atualizado_em: agora,
    });
    return {
      id,
      tipo,
      estado: "pendente",
      progresso: null,
      mensagem: "Enfileirado.",
      erro: null,
      criado_em: agora,
      atualizado_em: agora,
      artefato: null,
    };
  }

  // ── Leitura ─────────────────────────────────────────────────────────────────

  /**
   * Le o JobStatus completo (merge do estado bruto com o meta). Jobs
   * expirados — e registros cujo estado sumiu do disco — viram null e
   * os arquivos sao removidos (efemeros: 404 = "job expirou").
   */
  lerStatus(id: string): JobStatus | null {
    const meta = this.lerMeta(id);
    if (meta === null) {
      return null;
    }
    const bruto = this.lerEstado(id);
    const estado = normalizarEstado(bruto?.estado);
    const progresso = bruto?.progresso ?? null;
    const mensagem = bruto?.mensagem ?? "";
    const erro = bruto?.erro ?? null;
    const atualizadoEm =
      bruto?.atualizado_em ?? (bruto?.criado_em ?? meta.criado_em);
    if (expirado(atualizadoEm, meta.criado_em, this.relogio(), this.ttlMs)) {
      this.remover(id);
      return null;
    }
    // O artefato do terminal: o estado final ESCRITO PELO SERVIDOR
    // (finalizarOk) carrega o artefato no proprio arquivo — UMA escrita
    // atomica (FQ-S3: quem ve o terminal ve o efeito concluido). O CLI
    // tambem grava "ok" ao terminar (antes de o servidor aplicar os
    // efeitos) — um "ok" SEM artefato e esse estado intermediario e
    // NAO e terminal: trata como "rodando" ate o servidor finalizar.
    const artefato = bruto?.artefato ?? meta.artefato;
    const estadoEfetivo = estado === "ok" && artefato === null ? "rodando" : estado;
    return {
      id,
      tipo: meta.tipo,
      estado: estadoEfetivo,
      progresso: typeof progresso === "number" && Number.isFinite(progresso) ? progresso : null,
      mensagem,
      erro,
      criado_em: bruto?.criado_em ?? meta.criado_em,
      atualizado_em: atualizadoEm,
      artefato,
    };
  }

  /** O registro (sem o estado) — para o GET do projeto agrupar por alvo. */
  lerRegistro(id: string): { id: string; tipo: TipoJob; alvo: AlvoDoJob; criado_em: string } | null {
    const meta = this.lerMeta(id);
    if (meta === null) {
      return null;
    }
    return { id, tipo: meta.tipo, alvo: meta.alvo, criado_em: meta.criado_em };
  }

  /**
   * Os registros NAO expirados de um projeto — o "jobs por alvo" do GET
   * do projeto (derivado do estado dos jobs, nunca persistido).
   */
  listarDoProjeto(projetoId: string): Array<{
    id: string;
    tipo: TipoJob;
    alvo: AlvoDoJob;
    criado_em: string;
  }> {
    const saida: Array<{ id: string; tipo: TipoJob; alvo: AlvoDoJob; criado_em: string }> = [];
    let nomes: string[];
    try {
      nomes = readdirDaRaiz(this.raiz);
    } catch {
      return saida;
    }
    for (const nome of nomes) {
      if (!nome.endsWith(".meta.json")) {
        continue;
      }
      const id = nome.slice(0, -".meta.json".length);
      const registro = this.lerRegistro(id);
      if (registro === null) {
        continue;
      }
      if (registro.alvo.projeto_id !== projetoId) {
        continue;
      }
      // O registro expirado (estado antigo) nao aparece — e remove os arquivos.
      if (this.lerStatus(id) === null) {
        continue;
      }
      saida.push(registro);
    }
    return saida.sort((a, b) => (a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0));
  }

  // ── Escrita de estado (o servidor e o CLI escrevem o mesmo arquivo) ─────────

  /** Escreve o estado bruto (atomicamente). O CLI usa --estado <caminho>. */
  escreverEstado(id: string, estado: EstadoBruto): void {
    escreverJsonAtomico(this.caminhoDoEstado(id), estado);
  }

  /** Registra o artefato do job ok (atualiza o meta atomicamente). */
  registrarArtefato(id: string, artefato: ArtefatoDoJob): void {
    const meta = this.lerMeta(id);
    if (meta === null) {
      return;
    }
    escreverJsonAtomico(this.caminhoDoMeta(id), { ...meta, artefato });
  }

  /**
   * O terminal OK em UMA escrita atomica: o arquivo de estado recebe o
   * JobStatus COMPLETO (estado ok + artefato juntos) — quem le o
   * terminal le o artefato na mesma leitura (nenhuma janela entre os
   * dois, ao contrario de duas escritas separadas). O meta tambem e
   * atualizado (o fallback da leitura e a fonte do GET por alvo).
   */
  finalizarOk(id: string, artefato: ArtefatoDoJob, mensagem: string): void {
    const meta = this.lerMeta(id);
    if (meta === null) {
      return;
    }
    const agora = this.relogio().toISOString();
    escreverJsonAtomico(this.caminhoDoEstado(id), {
      tipo: meta.tipo,
      estado: "ok",
      progresso: 1,
      mensagem,
      erro: null,
      criado_em: meta.criado_em,
      atualizado_em: agora,
      artefato,
    });
    escreverJsonAtomico(this.caminhoDoMeta(id), { ...meta, artefato });
  }

  // ── Remocao ─────────────────────────────────────────────────────────────────

  /** Remove os arquivos do job (DELETE do projeto, expiracao). */
  remover(id: string): void {
    rmSync(this.caminhoDoEstado(id), { force: true });
    rmSync(this.caminhoDoMeta(id), { force: true });
  }

  /** Remove os jobs de um projeto (DELETE /api/projetos/:id). */
  removerDoProjeto(projetoId: string): void {
    for (const registro of this.listarDoProjeto(projetoId)) {
      this.remover(registro.id);
    }
  }

  // ── Privados ────────────────────────────────────────────────────────────────

  private lerMeta(id: string): RegistroMeta | null {
    try {
      const bruto = JSON.parse(readFileSync(this.caminhoDoMeta(id), "utf-8")) as RegistroMeta;
      if (typeof bruto.tipo !== "string" || typeof bruto.criado_em !== "string") {
        return null;
      }
      return bruto;
    } catch {
      return null;
    }
  }

  private lerEstado(id: string): EstadoBruto | null {
    try {
      return JSON.parse(readFileSync(this.caminhoDoEstado(id), "utf-8")) as EstadoBruto;
    } catch {
      return null;
    }
  }
}

// ─── Helpers puros ─────────────────────────────────────────────────────────────

function normalizarEstado(valor: string | undefined): JobStatus["estado"] {
  if (valor === "pendente" || valor === "rodando" || valor === "ok" || valor === "erro") {
    return valor;
  }
  // Estado ilegivel = job quebrado, nunca verde por vacuidade (C1):
  // quem le precisa ver o terminal, e o terminal seguro e "erro".
  return "erro";
}

/** Expirado = atualizado_em (ou criado_em) mais velho que o TTL. */
function expirado(atualizadoEm: string, criadoEm: string, agora: Date, ttlMs: number): boolean {
  const base = Date.parse(atualizadoEm);
  const criado = Date.parse(criadoEm);
  const referencia = Number.isFinite(base) ? base : criado;
  if (!Number.isFinite(referencia)) {
    return true;
  }
  return agora.getTime() - referencia > ttlMs;
}

function readdirDaRaiz(raiz: string): string[] {
  return readdirSync(raiz, "utf-8");
}
