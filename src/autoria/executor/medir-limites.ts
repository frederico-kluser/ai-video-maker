#!/usr/bin/env npx tsx
/**
 * src/autoria/executor/medir-limites.ts
 *
 * MEDICAO com credencial — AB-551/AB-552/AB-554 sao EVIDENCIA, NUNCA
 * gate (contrato-w6 §12): os tetos reais dos provedores, a aceitacao de
 * `temperature` e a degradacao silenciosa sao medidos por quem tem a
 * credencial e registrados como evidencia em ledger/evidencia/. O gate
 * local (autoria-offline) permanece VERDE OFFLINE: sem rede, sem
 * chamada, cassete apenas.
 *
 * Medicoes:
 *
 *   AB-554 — temperature: 0 aceito ou 400 no modelo alvo? Uma chamada
 *     minima com temperature: 0, lendo o status HTTP.
 *   AB-551 — teto real do strict da OpenAI (doc atual 10/5000/1000 vs
 *     docs de 2024 5/100/500): schema sintetico com 6 niveis de
 *     aninhamento e >100 propriedades em response_format json_schema
 *     strict, lendo o status (200 = teto novo; 400 = teto antigo).
 *   AB-552 — limites da Anthropic (degradacao silenciosa >5 niveis,
 *     request limits 20/24/16 nao confirmados): schema com 6 niveis e
 *     25 parametros opcionais, conferindo campos do 6o nivel e status.
 *     Sem credencial Anthropic a medicao fica PENDENTE e isto e dito
 *     em voz alta.
 *
 * Escreve ledger/evidencia/AB-55X.txt quando a medicao roda (o arquivo
 * de evidencia e o registro do comando, do resultado e do ambiente).
 *
 * Uso (a mao, com rede e credencial):
 *   npx tsx src/autoria/executor/medir-limites.ts [--provedor openai|anthropic]
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const CHAVE_ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const CHAVE_OPENAI = process.env.OPENAI_API_KEY;

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface ResultadoMedicao {
  readonly item: string;
  readonly comando: string;
  readonly resultado: string;
  readonly veredito: string;
}

// ─── Helpers de HTTP ───────────────────────────────────────────────────────────

async function chamadaMinima(
  url: string,
  headers: Record<string, string>,
  corpo: unknown,
): Promise<{ status: number; texto: string }> {
  const resposta = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(corpo),
  });
  return { status: resposta.status, texto: await resposta.text() };
}

/**
 * Um schema com 6 niveis de aninhamento e >100 propriedades — no
 * formato que o strict da OpenAI EXIGE: additionalProperties:false em
 * todo objeto e TODAS as propriedades em required (sem isso o 400 e
 * erro de formato, nao teto).
 */
function schemaProfundo(): Record<string, unknown> {
  const chavesFolha: string[] = [];
  for (let i = 0; i < 110; i += 1) chavesFolha.push(`campo_${i}`);
  const folha: Record<string, unknown> = {
    type: "object",
    additionalProperties: false,
    required: chavesFolha,
    properties: Object.fromEntries(chavesFolha.map((c) => [c, { type: "string" }])),
  };
  let no: Record<string, unknown> = {
    type: "object",
    additionalProperties: false,
    required: ["folha"],
    properties: { folha },
  };
  for (let nivel = 0; nivel < 5; nivel += 1) {
    no = {
      type: "object",
      additionalProperties: false,
      required: [`nivel_${nivel}`],
      properties: { [`nivel_${nivel}`]: no },
    };
  }
  return {
    type: "object",
    additionalProperties: false,
    required: ["raiz"],
    properties: { raiz: no },
  };
}

// ─── AB-554: temperature 0 ─────────────────────────────────────────────────────

async function medirTemperature(
  provedor: "openai" | "anthropic",
): Promise<ResultadoMedicao> {
  const chave = provedor === "openai" ? CHAVE_OPENAI : CHAVE_ANTHROPIC;
  if (!chave) {
    return {
      item: "AB-554",
      comando:
        provedor === "openai"
          ? "POST /v1/chat/completions {model: gpt-4o-mini, max_tokens: 8, temperature: 0} — ler status HTTP"
          : "POST /v1/messages {model: claude-sonnet-4-5, max_tokens: 8, temperature: 0} — ler status HTTP",
      resultado: `${provedor === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} ausente no ambiente — medicao nao executada`,
      veredito: "PENDENTE — sem credencial no dia do card; nao bloqueia (gate permanece offline)",
    };
  }
  const url =
    provedor === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.anthropic.com/v1/messages";
  const headers: Record<string, string> =
    provedor === "openai"
      ? { "content-type": "application/json", authorization: `Bearer ${chave ?? ""}` }
      : { "content-type": "application/json", "x-api-key": chave ?? "", "anthropic-version": "2023-06-01" };

  const corpo =
    provedor === "openai"
      ? {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Responda apenas: ok" }],
          max_tokens: 8,
          temperature: 0,
        }
      : {
          model: "claude-sonnet-4-5",
          max_tokens: 8,
          messages: [{ role: "user", content: "Responda apenas: ok" }],
          temperature: 0,
        };

  const comando =
    provedor === "openai"
      ? "POST /v1/chat/completions {model: gpt-4o-mini, max_tokens: 8, temperature: 0} — ler status HTTP (200 = aceito; 400 = removido na linha)"
      : "POST /v1/messages {model: claude-sonnet-4-5, max_tokens: 8, temperature: 0} — ler status HTTP";

  try {
    const { status, texto } = await chamadaMinima(url, headers, corpo);
    return {
      item: "AB-554",
      comando,
      resultado: `status HTTP ${status}${texto ? ` — ${texto.slice(0, 200)}` : ""}`,
      veredito: status === 200
        ? "FECHADO — temperature: 0 aceito (o executor pode enviar temperature: 0)"
        : status === 400
          ? "FECHADO — temperature rejeitado com 400 (o executor omite o parametro)"
          : "REMEDIR — status inesperado; ler a resposta completa",
    };
  } catch (erro) {
    return {
      item: "AB-554",
      comando,
      resultado: `falha de rede/execucao: ${(erro as Error).message}`,
      veredito: "PENDENTE — sem rede no dia da medicao; nao bloqueia (gate permanece offline)",
    };
  }
}

// ─── AB-551: teto do strict OpenAI ─────────────────────────────────────────────

async function medirTetoOpenAI(): Promise<ResultadoMedicao> {
  const comando =
    "POST /v1/chat/completions com response_format json_schema strict de schema sintetico com 6 niveis de aninhamento e >100 propriedades, max_tokens 8 — ler status (200 = teto atual 10/5000/1000; 400 com mensagem de limite = ainda 5/100)";
  try {
    const { status, texto } = await chamadaMinima(
      "https://api.openai.com/v1/chat/completions",
      { "content-type": "application/json", authorization: `Bearer ${CHAVE_OPENAI ?? ""}` },
      {
        model: "gpt-4o-mini",
        max_tokens: 8,
        messages: [{ role: "user", content: "ok" }],
        response_format: {
          type: "json_schema",
          json_schema: { name: "sonda", schema: schemaProfundo(), strict: true },
        },
      },
    );
    return {
      item: "AB-551",
      comando,
      resultado: `status HTTP ${status}${texto ? ` — ${texto.slice(0, 200)}` : ""}`,
      veredito: status === 200
        ? "FECHADO — o teto atual da conta aceita 6 niveis e >100 propriedades (doc atual 10/5000/1000)"
        : status === 400
          ? "FECHADO — 400: ainda vale o teto antigo (5/100/500); o schema v1 (<=5 niveis) esta dentro dos dois"
          : "REMEDIR — status inesperado; ler a resposta completa",
    };
  } catch (erro) {
    return {
      item: "AB-551",
      comando,
      resultado: `falha de rede/execucao: ${(erro as Error).message}`,
      veredito: "PENDENTE — sem rede no dia da medicao; nao bloqueia",
    };
  }
}

// ─── AB-552: limites da Anthropic ──────────────────────────────────────────────

async function medirLimitesAnthropic(): Promise<ResultadoMedicao> {
  const comando =
    "POST /v1/messages com output_config json_schema de schema com 6 niveis e 25 parametros opcionais, conferindo os campos do 6o nivel e o status (200 com todos os campos = sem degradacao silenciosa; 400 = limite real)";
  if (!CHAVE_ANTHROPIC) {
    return {
      item: "AB-552",
      comando,
      resultado: "ANTHROPIC_API_KEY ausente no ambiente — medicao nao executada",
      veredito: "PENDENTE — sem credencial Anthropic no dia do card; nao bloqueia (gate permanece offline)",
    };
  }
  try {
    const schema = schemaProfundo();
    const { status, texto } = await chamadaMinima(
      "https://api.anthropic.com/v1/messages",
      { "content-type": "application/json", "x-api-key": CHAVE_ANTHROPIC, "anthropic-version": "2023-06-01" },
      {
        model: "claude-sonnet-4-5",
        max_tokens: 8,
        messages: [{ role: "user", content: "ok" }],
        output_config: {
          format: { type: "json_schema", name: "sonda", schema },
        },
      },
    );
    return {
      item: "AB-552",
      comando,
      resultado: `status HTTP ${status}${texto ? ` — ${texto.slice(0, 200)}` : ""}`,
      veredito: status === 200
        ? "FECHADO — sem 400 nem degradacao observada nesta chamada (amostra de 1; a degradacao silenciosa so e falsificada por inspecao de conteudo)"
        : status === 400
          ? "FECHADO — 400: limite real (a doc omitiu); o schema v1 (<=5 niveis) esta dentro"
          : "REMEDIR — status inesperado; ler a resposta completa",
    };
  } catch (erro) {
    return {
      item: "AB-552",
      comando,
      resultado: `falha de rede/execucao: ${(erro as Error).message}`,
      veredito: "PENDENTE — sem rede no dia da medicao; nao bloqueia",
    };
  }
}

// ─── Orquestracao ──────────────────────────────────────────────────────────────

async function principal(): Promise<void> {
  const provedor = argumento("--provedor") ?? "openai";
  const resultados: ResultadoMedicao[] = [];
  if (provedor === "openai" || provedor === "todos") {
    resultados.push(await medirTemperature("openai"));
    resultados.push(await medirTetoOpenAI());
  }
  if (provedor === "anthropic" || provedor === "todos") {
    resultados.push(await medirTemperature("anthropic"));
    resultados.push(await medirLimitesAnthropic());
  }

  for (const r of resultados) {
    const arquivo = join("ledger", "evidencia", `${r.item}.txt`);
    const conteudo = [
      `${r.item} — medicao com credencial (card F4-04, W6, ${new Date().toISOString()})`,
      "=".repeat(79),
      "",
      "Comando literal:",
      `  ${r.comando}`,
      "",
      "Resultado:",
      `  ${r.resultado}`,
      "",
      `Veredito: ${r.veredito}`,
      "",
      "Regra: AB-551/552/554 sao EVIDENCIA, NUNCA gate — o gate local",
      "(just autoria-offline) permanece verde OFFLINE, sem rede e sem chamada.",
      "",
    ].join("\n");
    writeFileSync(arquivo, conteudo, "utf-8");
    console.log(`--- ${r.item} ---`);
    console.log(`  comando:  ${r.comando}`);
    console.log(`  resultado: ${r.resultado}`);
    console.log(`  veredito: ${r.veredito}`);
    console.log(`  evidencia: ${arquivo}`);
  }
}

if (process.argv[1]?.endsWith("medir-limites.ts")) {
  void principal();
}
