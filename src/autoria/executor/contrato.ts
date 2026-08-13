/**
 * src/autoria/executor/contrato.ts
 *
 * Contrato do EXECUTOR de autoria (card F4-04, W6) — o cliente de
 * chamada do estagio de autoria.
 *
 * O estagio de AUTORIA (AGENTS.md, etapa 1) esta ACIMA da fronteira de
 * determinismo: um LLM recebe o brief e produz o Documento de Autoria
 * (Autoria.1, schema de F4-01). O executor e o caminho de chamada que
 * produz esse documento:
 *
 *   1. monta a entrada de cache (F4-01) com o schema PODADO por
 *      fornecedor (autoria.llm.anthropic.json / autoria.llm.openai.json)
 *      — nunca o schema completo (llm-authoring: o podado viaja na
 *      chamada, o completo valida a resposta);
 *   2. respeita o cache do F4-01 (buscarOuGerar — a mesma entrada nunca
 *      chama a API duas vezes);
 *   3. VALIDA via rejeitar.ts ANTES do pipeline
 *      (rejeitarSaidaInvalida, contrato-w6 §12): a resposta do LLM so
 *      entra no pipeline depois de validar contra o schema completo.
 *
 * Autoria NAO e um estagio do orquestrador de resolucao (F2-01): o
 * orquestrador executa os cinco estagios canonicos [locucao, grafico,
 * midia, codigo, musica] sobre um manifesto JA existente; a autoria e o
 * caminho SEPARADO que produz o documento que (via ponte AB-550, F5-01
 * na W7) se torna o manifesto resolvido. Decisao registrada em
 * docs/adr/0031-cassete-de-autoria-e-suite-de-rejeicao.md.
 */

import type { EntradaAutoria } from "../contrato/contrato.js";
import type { DocumentoAutoria } from "../contrato/contrato.js";

// ─── Identidade do executor ─────────────────────────────────────────────────────

/**
 * Nome do cassete de autoria — o nome do diretorio em
 * `fixtures/cassetes/autoria/`.
 *
 * NAO e um NomeEstagio de resolucao (contrato.ts da resolucao): o nome
 * daqui existe para o CASSETE de autoria, que segue o layout F2-01 mas
 * registra o caminho de chamada da autoria. O orquestrador de resolucao
 * nunca descobre este nome (descoberta por convencao varre
 * `src/resolucao/<nome>/estagio.ts`; AB-502).
 */
export const NOME_CASSETE_AUTORIA = "autoria" as const;

/**
 * Versao do CONTRATO do executor (chave de cache do cassete).
 *
 * Bump obrigatorio ao mudar a composicao da chave ou o layout do
 * cassete de autoria. Entra na chave (C12): mudar aqui invalida todos
 * os cassetes antigos.
 */
export const VERSAO_CONTRATO_EXECUTOR = "1.0.0" as const;

/**
 * Versao do EXECUTOR (chave de cache do cassete).
 *
 * REGRA DURA (mesma da resolucao): mudou o codigo de um jeito que pode
 * mudar a saida? Bumpou a versao. Sem isso o replay serve resultado
 * velho para sempre.
 */
export const VERSAO_EXECUTOR = "1.0.0" as const;

// ─── Provedores ────────────────────────────────────────────────────────────────

/** Os dois fornecedores de LLM suportados pelo executor. */
export type ProvedorAutoria = "anthropic" | "openai";

// ─── Brief ─────────────────────────────────────────────────────────────────────

/**
 * O brief da autoria — a ENTRADA do estagio (campos declarados do
 * prompt principal de F4-02; ausencia de campo nao e erro).
 */
export interface BriefAutoria {
  /** Obrigatorio, uma frase. */
  readonly tema: string;
  /** Para quem e o video (afeta ritmo e vocabulario). */
  readonly publico?: string;
  /** Duracao total desejada em segundos (o sistema resolve a final). */
  readonly duracao_alvo_segundos?: number;
  /** Registro da locucao (formal, didatico, direto...). */
  readonly tom?: string;
  /** Assuntos, termos ou figuras a evitar. */
  readonly exclusoes?: string;
  /** Tipos de no que DEVEM aparecer (ex.: ["codigo"]). */
  readonly nos_obrigatorios?: string[];
}

// ─── Opcoes ────────────────────────────────────────────────────────────────────

/** Opcoes de UMA chamada de autoria. */
export interface OpcoesExecutorAutoria {
  /** Fornecedor do LLM. Default: "openai". */
  readonly provedor?: ProvedorAutoria;

  /**
   * Modelo do fornecedor. Defaults por provedor (ver `MODELO_PADRAO`).
   * Muda a chave de cache (C12).
   */
  readonly modelo?: string;

  /**
   * `fetch` a usar. Em modo offline aponta para o cassete
   * (criarFetchDeCassete); em modo gravacao e o fetch real
   * instrumentado pelo GravadorDeChamadas. Um executor que chamasse
   * `globalThis.fetch` direto bateria no guarda de rede do vitest — que
   * e o comportamento desejado offline.
   */
  readonly fetch?: typeof fetch;

  /**
   * Chave de API do provedor. Entra por injecao, NUNCA por import em
   * escopo de modulo (C06 — llm-authoring): importar este modulo nao
   * pode exigir credencial.
   */
  readonly chaveDeApi?: string;

  /** Teto de tokens de saida. Entra na chave (muda o que o LLM pode emitir). */
  readonly maxTokens?: number;

  /**
   * Caminho do prompt principal de F4-02. Default: a biblioteca de
   * prompts do repositorio (docs/autoria/prompts/prompt-autoria-principal.md).
   */
  readonly caminhoPrompt?: string;

  /** Diretorio do cache de saida do F4-01 (default: .cache/manifests). */
  readonly diretorioCache?: string;
}

/** Defaults de modelo por provedor. */
export const MODELO_PADRAO: Readonly<Record<ProvedorAutoria, string>> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o-mini",
} as const;

/** Teto de tokens de saida padrao. */
export const MAX_TOKENS_PADRAO = 4096;

// ─── Resultado ─────────────────────────────────────────────────────────────────

/** Resultado de UMA chamada de autoria. */
export interface ResultadoChamadaAutoria {
  /** O documento de autoria VALIDO — o que o pipeline pode consumir. */
  readonly documento: DocumentoAutoria;

  /** De onde veio a saida: cache HIT ou chamada real ao provedor. */
  readonly origem: "cache" | "chamada";

  /** A entrada que gerou esta saida (a chave do cache, F4-01). */
  readonly entrada: EntradaAutoria;
}
