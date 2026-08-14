/**
 * src/autoria/executor/executor.ts
 *
 * O EXECUTOR de autoria — o cliente de chamada do estagio de autoria
 * (contrato-w6 §12).
 *
 * Ciclo completo de uma chamada, na ordem que o contrato exige:
 *
 *   1. MONTA a entrada de cache do F4-01 (model + prompt de F4-02 +
 *      mensagens do brief + schema podado por fornecedor);
 *   2. CACHE (buscarOuGerar): a mesma entrada nunca chama a API duas
 *      vezes — HIT serve o arquivo, MISS chama o gerador UMA vez;
 *   3. NORMALIZA a saida bruta (normalizar.ts — P1): null -> ausente
 *      nas chaves que o subset do fornecedor autoriza como null e o
 *      schema completo rejeita (o strict da OpenAI emula opcional com
 *      `anyOf [X, null]`; o completo so aceita ausencia);
 *   4. GATE (rejeitarSaidaInvalida) ANTES do pipeline E ANTES do cache:
 *      a resposta do LLM so sai deste modulo depois de validar contra o
 *      schema completo. A saida invalida lanca ErroContratoAutoria e o
 *      pipeline NUNCA a recebe — mesmo que tenha vindo do cache;
 *   5. CACHE a saida VALIDA (P2): uma resposta rejeitada nunca chega ao
 *      cache — a 2a tentativa com a mesma entrada faz chamada real em
 *      vez de servir o cache envenenado (medido na onda 1).
 *
 * O gerador (a chamada real) entra por injecao — este modulo nao
 * conhece rede nem provedor (mesma disciplina do cache.ts do F4-01).
 * No replay offline o gerador e o cassete; em gravacao, o fetch real.
 */

import { readFileSync } from "node:fs";
import {
  definirDiretorioCache,
  escreverNoCache,
  lerDoCache,
} from "../contrato/cache.js";
import type { EntradaAutoria } from "../contrato/contrato.js";
import {
  CAMINHO_SCHEMA_ANTHROPIC,
  CAMINHO_SCHEMA_OPENAI,
} from "../contrato/contrato.js";
import { rejeitarSaidaInvalida } from "../contrato/rejeitar.js";
import { normalizarDocumentoAutoria } from "../contrato/normalizar.js";
import { executarChamada } from "./chamada.js";
import {
  MAX_TOKENS_PADRAO,
  MODELO_PADRAO,
} from "./contrato.js";
import type {
  BriefAutoria,
  OpcoesExecutorAutoria,
  ProvedorAutoria,
  ResultadoChamadaAutoria,
} from "./contrato.js";
import { carregarPromptPrincipal, montarMensagens } from "./prompt.js";

/**
 * Monta a ENTRADA de cache do F4-01 para um brief.
 *
 * Os componentes da entrada sao exatamente os do contrato (ADR-0023
 * decisao 4): model, system, tools, messages, output_config,
 * schema_version — e `tentativa` (o retry MUTA o prompt). O
 * `output_config` carrega o schema PODADO por fornecedor (lido do disco
 * a cada montagem: se o schema podado mudar, a chave muda — C12).
 *
 * Determinismo: `system` e `messages` sao produzidos de forma canonica
 * (prompt.ts ordena as chaves do brief) para que o hash de cache nao
 * dependa da ordem de escrita do objeto.
 */
export function montarEntrada(
  provedor: ProvedorAutoria,
  brief: BriefAutoria,
  opcoes: OpcoesExecutorAutoria = {},
): EntradaAutoria {
  const sistema = carregarPromptPrincipal(opcoes.caminhoPrompt);
  const schemaPodado = JSON.parse(
    readFileSync(
      provedor === "anthropic" ? CAMINHO_SCHEMA_ANTHROPIC : CAMINHO_SCHEMA_OPENAI,
      "utf-8",
    ),
  );
  return {
    model: opcoes.modelo ?? MODELO_PADRAO[provedor],
    system: sistema,
    tools: [],
    messages: montarMensagens(brief),
    output_config: {
      format: {
        type: "json_schema",
        name: "documento_autoria",
        schema: schemaPodado,
      },
    },
    schema_version: "Autoria.1",
    tentativa: 1,
  };
}

/**
 * A chamada completa de autoria: cache + normalizacao + gate + cache,
 * nesta ordem.
 *
 * O HIT/MISS replica EXATAMENTE a mecanica do buscarOuGerar do F4-01
 * (mesma chave, mesma escrita atomica, mesmo arquivo) — mas o ciclo
 * aqui e ASSINCRONO, porque a chamada ao provedor e async e o contrato
 * do gerador do F4-01 e sincrono: passar um gerador async ao
 * buscarOuGerar gravaria a PROMISE no cache (JSON.stringify(Promise) =
 * "{}"), envenenando a entrada em silencio. A semantica e a mesma:
 * HIT serve o arquivo sem chamar o provedor; MISS chama UMA vez e
 * persiste.
 *
 * A ORDEM (fix da autoria viva, onda 2): a saida bruta (fresca ou
 * cacheada) passa pela NORMALIZACAO (P1) e pelo GATE (P2) ANTES de
 * chegar ao cache e ao pipeline. Uma resposta rejeitada NUNCA e
 * persistida — o cache so guarda documentos validos, e uma resposta
 * cacheada (por um caminho antigo) tambem passa pelo gate: um cache
 * envenenado nao entra no pipeline.
 *
 * @returns o documento de autoria VALIDO (ja passou por
 *   normalizacao + rejeitarSaidaInvalida) e a origem (cache ou chamada).
 * @throws ErroContratoAutoria quando a saida (cacheada ou fresca) nao
 *   valida contra o schema completo — ANTES de devolver ao pipeline.
 */
export async function chamarAutoria(
  provedor: ProvedorAutoria,
  brief: BriefAutoria,
  opcoes: OpcoesExecutorAutoria = {},
): Promise<ResultadoChamadaAutoria> {
  if (opcoes.diretorioCache !== undefined) {
    definirDiretorioCache(opcoes.diretorioCache);
  }
  const entrada = montarEntrada(provedor, brief, opcoes);
  const maxTokens = opcoes.maxTokens ?? MAX_TOKENS_PADRAO;

  const cacheado = lerDoCache(entrada);
  let saida: unknown;
  let origem: "cache" | "chamada";
  if (cacheado !== null) {
    saida = cacheado;
    origem = "cache";
  } else {
    saida = await executarChamada(
      provedor,
      entrada,
      opcoes.fetch ?? globalThis.fetch,
      opcoes.chaveDeApi,
      maxTokens,
    );
    origem = "chamada";
  }

  // ── NORMALIZACAO (P1) — entre a extracao/cache e o gate ────────────────
  // O subset do strict da OpenAI emula opcional com `anyOf [X, null]` em
  // required; o schema completo rejeita null (opcional la e AUSENCIA).
  // Normaliza null -> ausente aqui, no ponto unico e deterministico; o
  // gate continua validacao pura e os schemas nao mudam. O documento
  // NORMALIZADO e o que o cache persiste e o pipeline consome.
  saida = normalizarDocumentoAutoria(saida, provedor);

  // ── GATE — antes do pipeline e ANTES do cache (contrato-w6 §12, ∅-crit
  // do F4-01) ────────────────────────────────────────────────────────────
  // A saida do cache tambem passa pelo gate: um cache envenenado (ou uma
  // resposta gravada de um caminho nao-estrito) nao pode entrar no
  // pipeline.
  rejeitarSaidaInvalida(saida);

  // ── CACHE (P2) — so o documento VALIDO e persistido ───────────────────
  // Resposta rejeitada nunca chega ao cache: a 2a tentativa com a mesma
  // entrada faz chamada real em vez de servir o cache envenenado
  // (medido na onda 1 — a escrita era antes do gate).
  if (origem === "chamada") {
    escreverNoCache(entrada, saida);
  }

  return { documento: saida, origem, entrada };
}
