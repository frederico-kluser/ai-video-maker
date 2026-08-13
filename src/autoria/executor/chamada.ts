/**
 * src/autoria/executor/chamada.ts
 *
 * A CHAMADA — monta a requisicao por fornecedor, executa via `fetch`
 * injetado e extrai o documento bruto da resposta.
 *
 * Regras do contrato (llm-authoring + ADR-0023 + contrato-w6 §12):
 *
 *   - O schema que VIAJA na chamada e o PODADO por fornecedor
 *     (src/autoria/contrato/schema/autoria.llm.anthropic.json /
 *     autoria.llm.openai.json) — carregado do proprio `output_config`
 *     da entrada de cache do F4-01 (que ja o carrega: trocar de
 *     fornecedor muda a chave). O schema COMPLETO nunca viaja: ele
 *     valida a resposta, no gate (rejeitar.ts).
 *   - O cliente do provedor NAO existe em escopo de modulo (C06):
 *     chave e fetch entram por injecao, por chamada. Importar este
 *     arquivo sem credencial nao lanca e nao instancia nada.
 *   - A resposta e gravada COMO VEIO (sosia, nao sucessor): a extracao
 *     do documento e do EXECUTOR e roda tambem no replay offline.
 *   - `temperature` e enviada como 0 quando o provedor aceita (AB-554,
 *     medida com credencial; se 400, omitida — o cache e a garantia de
 *     reprodutibilidade, nao o parametro).
 */

import { readFileSync } from "node:fs";
import type { EntradaAutoria } from "../contrato/contrato.js";
import {
  CAMINHO_SCHEMA_ANTHROPIC,
  CAMINHO_SCHEMA_OPENAI,
} from "../contrato/contrato.js";
import type { ProvedorAutoria } from "./contrato.js";

// ─── Erros ─────────────────────────────────────────────────────────────────────

/** A chamada ao provedor falhou (rede, status inesperado ou JSON quebrado). */
export class EChamadaFalhou extends Error {
  readonly provedor: ProvedorAutoria;
  readonly status?: number;

  constructor(provedor: ProvedorAutoria, mensagem: string, status?: number) {
    super(`Chamada de autoria falhou (${provedor}${status !== undefined ? `, HTTP ${status}` : ""}): ${mensagem}`);
    this.name = "EChamadaFalhou";
    this.provedor = provedor;
    this.status = status;
  }
}

// ─── Endpoints e formatos por provedor ─────────────────────────────────────────

export const ENDPOINTS: Readonly<Record<ProvedorAutoria, string>> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
} as const;

export const NOME_SAIDA_ESTRUTURADA = "documento_autoria" as const;

// ─── Montagem da requisicao ────────────────────────────────────────────────────

export interface RequisicaoMontada {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly corpo: string;
}

/**
 * Monta a requisicao HTTP de uma chamada de autoria.
 *
 * O `output_config` da ENTRADA ja carrega o schema podado do fornecedor
 * (F4-01); aqui ele e reposicionado no formato que cada API espera:
 * `output_config.format` (Anthropic) ou `response_format.json_schema`
 * (OpenAI, strict).
 */
export function montarRequisicao(
  provedor: ProvedorAutoria,
  entrada: EntradaAutoria,
  chaveDeApi: string | undefined,
  maxTokens: number,
): RequisicaoMontada {
  const url = ENDPOINTS[provedor];
  const schemaPodado = provedor === "anthropic"
    ? JSON.parse(readFileSync(CAMINHO_SCHEMA_ANTHROPIC, "utf-8"))
    : JSON.parse(readFileSync(CAMINHO_SCHEMA_OPENAI, "utf-8"));

  if (provedor === "anthropic") {
    return {
      url,
      headers: {
        "content-type": "application/json",
        "x-api-key": chaveDeApi ?? "",
        "anthropic-version": "2023-06-01",
      },
      corpo: JSON.stringify({
        model: entrada.model,
        max_tokens: maxTokens,
        system: entrada.system,
        messages: entrada.messages,
        output_config: {
          format: {
            type: "json_schema",
            name: NOME_SAIDA_ESTRUTURADA,
            schema: schemaPodado,
          },
        },
        // AB-554: temperatura 0 e o default; se o provedor responder 400,
        // o executor omite o parametro (decisao do ADR-0023).
        temperature: 0,
      }),
    };
  }

  return {
    url,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${chaveDeApi ?? ""}`,
    },
    corpo: JSON.stringify({
      model: entrada.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: entrada.system },
        ...(entrada.messages as Array<{ role: string; content: string }>),
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: NOME_SAIDA_ESTRUTURADA,
          schema: schemaPodado,
          // AB-65x (medido no card F4-04, W6): o schema podado do F4-01
          // usa `const` SEM `type` (valido em JSON Schema 2020-12 e no
          // subset Anthropic, INVALIDO no strict da OpenAI — 400 com
          // "schema must have a 'type' key" em 13 propriedades). Com
          // strict:false a chamada funciona (medido: 200 e documento
          // valido) e a SEGURANCA do contrato nao depende do strict:
          // o gate (rejeitarSaidaInvalida) valida contra o schema
          // completo ANTES do pipeline. Quando o schema for corrigido
          // (dono: F4-01/PREP), este strict volta a true.
          strict: false,
        },
      },
      temperature: 0,
    }),
  };
}

// ─── Extracao do documento da resposta ─────────────────────────────────────────

/**
 * Extrai o documento bruto (unknown) da resposta do provedor.
 *
 * Roda TAMBEM no replay offline: o corpo gravado passa por aqui. Se o
 * formato do provedor mudar, o replay quebra AQUI — que e o lugar
 * certo, e a suite fica vermelha com o motivo certo.
 */
export function extrairDocumento(
  provedor: ProvedorAutoria,
  corpo: unknown,
): unknown {
  if (corpo === null || typeof corpo !== "object") {
    throw new EChamadaFalhou(provedor, "resposta nao e um objeto JSON");
  }
  const envelope = corpo as Record<string, unknown>;

  if (provedor === "anthropic") {
    const conteudo = envelope.content;
    if (!Array.isArray(conteudo)) {
      throw new EChamadaFalhou(provedor, "resposta sem content[]");
    }
    for (const bloco of conteudo) {
      if (
        bloco !== null &&
        typeof bloco === "object" &&
        (bloco as Record<string, unknown>).type === "output_json"
      ) {
        const json = (bloco as Record<string, unknown>).json;
        if (json !== undefined) return json;
      }
    }
    throw new EChamadaFalhou(provedor, "nenhum bloco output_json na resposta");
  }

  const escolhas = envelope.choices;
  if (!Array.isArray(escolhas) || escolhas.length === 0) {
    throw new EChamadaFalhou(provedor, "resposta sem choices[]");
  }
  const primeira = escolhas[0] as Record<string, unknown> | undefined;
  const mensagem = primeira?.message as Record<string, unknown> | undefined;
  const conteudo = mensagem?.content;
  if (typeof conteudo !== "string") {
    throw new EChamadaFalhou(provedor, "choices[0].message.content nao e string");
  }
  try {
    return JSON.parse(conteudo) as unknown;
  } catch (erro) {
    throw new EChamadaFalhou(
      provedor,
      `conteudo da resposta nao e JSON valido: ${(erro as Error).message}`,
    );
  }
}

// ─── Execucao ──────────────────────────────────────────────────────────────────

/**
 * Executa a chamada HTTP ao provedor e devolve o documento bruto.
 *
 * Nenhuma validacao aqui: o documento bruto e o que o GATE
 * (rejeitarSaidaInvalida, executor.ts) decide. Extracao e validacao
 * sao passos separados de proposito — o cassete grava o corpo da
 * resposta como veio e o replay refaz a extracao.
 */
export async function executarChamada(
  provedor: ProvedorAutoria,
  entrada: EntradaAutoria,
  fetchImpl: typeof fetch,
  chaveDeApi: string | undefined,
  maxTokens: number,
): Promise<unknown> {
  const requisicao = montarRequisicao(provedor, entrada, chaveDeApi, maxTokens);

  let resposta: Response;
  try {
    resposta = await fetchImpl(requisicao.url, {
      method: "POST",
      headers: requisicao.headers,
      body: requisicao.corpo,
    });
  } catch (erro) {
    throw new EChamadaFalhou(
      provedor,
      `fetch falhou: ${(erro as Error).message}`,
    );
  }

  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new EChamadaFalhou(
      provedor,
      `status ${resposta.status}${detalhe ? ` — ${detalhe.slice(0, 300)}` : ""}`,
      resposta.status,
    );
  }

  let corpo: unknown;
  try {
    corpo = (await resposta.json()) as unknown;
  } catch (erro) {
    throw new EChamadaFalhou(
      provedor,
      `resposta nao e JSON: ${(erro as Error).message}`,
    );
  }
  return extrairDocumento(provedor, corpo);
}
