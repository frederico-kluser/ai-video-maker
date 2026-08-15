/**
 * src/roteiro/gerador/provedor.ts
 *
 * O contrato do PROVEDOR do gerador de roteiro e suas implementacoes.
 *
 * O gerador (gerador.ts) recebe o provedor INJETADO — este modulo nao
 * decide quem chama; ele oferece as implementacoes:
 *
 *   1. ProvedorSosiaRoteiro — o STUB PINADO (REPLAN): emite SOMENTE
 *      pedacos `tipo_visual: "texto"`, com fala/resumo/detalhes
 *      DETERMINISTICOS derivados do prompt via sha256 (sem LLM, sem
 *      rede, sem manim, sem anexo). E o unico visual renderizavel sem
 *      manim e sem anexo — o e2e da Onda 7 roda inteiro em cima dele.
 *      Ativado por ROTEIRO_PROVEDOR=sosia (ou --provedor sosia).
 *
 *   2. ProvedorLlmRoteiro — a chamada REAL (Anthropic/OpenAI): monta a
 *      requisicao HTTP por fornecedor, executa via `fetch` INJETADO
 *      (nunca globalThis.fetch no caminho de teste) com chave INJETADA
 *      (nunca import de credencial — C06), extrai o JSON bruto e o
 *      devolve para o GATE do gerador. Saida estruturada
 *      (output_config) fica para quando o schema podado por fornecedor
 *      do roteiro existir — hoje o contrato e coberto pelo prompt
 *      rigoroso + gate completo (rejeitarRoteiroInvalido).
 *
 *   3. ProvedorCasseteRoteiro — REPLAY offline de roteiros gravados
 *      (padrao da autoria: fixtures/cassetes/autoria/ — aqui,
 *      fixtures/cassetes/roteiro/<chave>/): a chave e sha256(prompt), e
 *      o replay devolve `resultado.json` como veio. Para testes
 *      deterministicos; grava-se com gravarCasseteRoteiro.
 *
 * O prompt recebido pelo provedor e o UNICO input (prompt.ts o compoe):
 * a mesma entrada produz a mesma saida em qualquer provedor —
 * determinismo de cache (FQ-G1) nao depende de quem responde.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256 } from "./cache.js";
import {
  MARCADOR_BRIEF,
  MARCADOR_IRMAOS,
  MARCADOR_PEDACO_ALVO,
  extrairDuracaoDoPrompt,
  extrairTemaDoPrompt,
} from "./prompt.js";
import type {
  Pedaco,
  Roteiro,
} from "../contrato/contrato.js";

// ─── O contrato do provedor ───────────────────────────────────────────────────

/**
 * Um provedor de geracao de roteiro. Recebe o PROMPT (composto por
 * prompt.ts) e devolve o JSON bruto da resposta — sem validar nada: a
 * validacao (gate) e do gerador (rejeitarRoteiroInvalido /
 * rejeitarPedacoInvalido), o provedor so responde.
 */
export interface ProvedorRoteiro {
  /** Identificador estavel (log/diagnostico): "sosia" | "llm-anthropic" | "llm-openai" | "cassete". */
  readonly nome: string;
  /** Produz o Roteiro completo para o prompt de geracao. */
  gerarRoteiroCompleto(prompt: string): Promise<unknown>;
  /** Produz UM Pedaco para o prompt de regeneracao. */
  regenerarPedaco(prompt: string): Promise<unknown>;
}

/** Erro do provedor (rede, status inesperado, JSON quebrado na resposta). */
export class EProvedorRoteiroFalhou extends Error {
  readonly provedor: string;
  readonly status?: number;

  constructor(provedor: string, mensagem: string, status?: number) {
    super(`Provedor de roteiro falhou (${provedor}${status !== undefined ? `, HTTP ${status}` : ""}): ${mensagem}`);
    this.name = "EProvedorRoteiroFalhou";
    this.provedor = provedor;
    this.status = status;
  }
}

// ─── SOSIA — o stub pinado a "texto" (REPLAN) ────────────────────────────────

/**
 * Palavras neutras para a prosa deterministica do sosia. O conjunto e
 * FIXO: mudar a lista muda a saida do sosia para o mesmo prompt (e o
 * cassete/e2e que gravam essa saida envelhecem — trate como bump).
 */
const PALAVRAS_DO_SOSIA = [
  "ideia", "passo", "exemplo", "base", "fluxo", "ritmo", "conceito",
  "mecanismo", "resultado", "caminho", "etapa", "parte", "sentido",
  "ponto", "formato", "efeito",
] as const;

/** Bytes do sha256 do prompt — a semente de tudo que o sosia emite. */
function bytesDoPrompt(prompt: string): number[] {
  return Array.from(Buffer.from(sha256(prompt), "hex"));
}

/** n palavras deterministicas derivadas dos bytes do prompt. */
function palavras(bytes: number[], semente: number, n: number): string {
  const saida: string[] = [];
  for (let i = 0; i < n; i++) {
    const b = bytes[(semente * 7 + i * 13) % bytes.length] ?? 0;
    saida.push(PALAVRAS_DO_SOSIA[b % PALAVRAS_DO_SOSIA.length] ?? PALAVRAS_DO_SOSIA[0]!);
  }
  return saida.join(" ");
}

/**
 * O STUB PINADO: emite SOMENTE pedacos `tipo_visual: "texto"` com
 * fala/resumo/detalhes deterministicos (derivados do prompt via hash).
 *
 * Garantias que os testes exigem (FQ-G1/G2/G3/G5):
 *   - determinismo puro: mesmo prompt, mesma saida (FQ-G1);
 *   - a saida depende do prompt INTEIRO — edicao do usuario muda o
 *     prompt, muda a saida (FQ-G3);
 *   - identidade preservada na regeneracao via prompt do alvo (FQ-G2);
 *   - zero rede, zero credencial, zero manim, zero anexo (FQ-G5).
 */
export class ProvedorSosiaRoteiro implements ProvedorRoteiro {
  readonly nome = "sosia" as const;

  async gerarRoteiroCompleto(prompt: string): Promise<unknown> {
    const bytes = bytesDoPrompt(prompt);
    const tema = extrairTemaDoPrompt(prompt) ?? "o tema";
    const duracaoAlvo = extrairDuracaoDoPrompt(prompt) ?? 30;
    const nPedacos = 2 + ((bytes[0] ?? 0) % 4); // 2..5 pedacos

    // Pesos deterministicos: distribui a duracao alvo pelos pedacos.
    const pesos: number[] = [];
    let somaPesos = 0;
    for (let i = 0; i < nPedacos; i++) {
      const peso = 1 + ((bytes[(1 + i) % bytes.length] ?? 0) % 10) / 10;
      pesos.push(peso);
      somaPesos += peso;
    }
    const duracoes: number[] = pesos.map((p) =>
      Math.round(((duracaoAlvo * p) / somaPesos) * 10) / 10,
    );
    const duracaoTotal = Math.round(duracoes.reduce((a, b) => a + b, 0) * 100) / 100;

    const pedacos: Pedaco[] = duracoes.map((duracao, i) => {
      const indice = i;
      const temFala = indice > 0;
      return {
        id: `p-${String(indice).padStart(3, "0")}`,
        indice,
        titulo: `Pedaco ${indice + 1} — ${palavras(bytes, indice, 2)}`,
        fala: temFala
          ? `Fala do pedaco ${indice + 1} sobre ${tema}: ${palavras(bytes, indice + 10, 4)}.`
          : "",
        duracao_segundos: duracao,
        // PINADO a "texto": o unico visual renderizavel sem manim e sem
        // anexo (REPLAN) — nunca gif/video/manim/grafico.
        tipo_visual: "texto",
        especificacao_visual: `Texto em destaque: ${palavras(bytes, indice + 20, 3)}`,
        detalhes_de_producao:
          `Slide de texto (renderizavel sem manim e sem anexo): ${palavras(bytes, indice + 30, 3)}`,
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      };
    });

    const roteiro: Roteiro = {
      schema_version: "Roteiro.1",
      pedacos,
      duracao_total_segundos: duracaoTotal,
    };
    return roteiro;
  }

  async regenerarPedaco(prompt: string): Promise<unknown> {
    const bytes = bytesDoPrompt(prompt);
    const tema = extrairTemaDoPrompt(prompt) ?? "o tema";
    // Identidade do alvo vem do bloco PEDACO ALVO do prompt (o gerador
    // reaplica de qualquer forma — identidade e decisao do sistema).
    const blocoAlvo = extrairPedacoAlvoDoPrompt(prompt);
    const id = blocoAlvo?.id ?? "p-000";
    const indice = blocoAlvo?.indice ?? 0;
    const duracaoDoAlvo = blocoAlvo?.duracao_segundos;
    const duracaoAnterior =
      typeof duracaoDoAlvo === "number" && duracaoDoAlvo > 0 ? duracaoDoAlvo : 5;

    const pedaco: Pedaco = {
      id,
      indice,
      titulo: `Pedaco ${indice + 1} — ${palavras(bytes, indice, 2)}`,
      fala: `Fala regenerada do pedaco ${indice + 1} sobre ${tema}: ${palavras(bytes, indice + 40, 4)}.`,
      duracao_segundos: Math.round(duracaoAnterior * 10) / 10,
      // PINADO a "texto" tambem na regeneracao.
      tipo_visual: "texto",
      especificacao_visual: `Texto em destaque: ${palavras(bytes, indice + 50, 3)}`,
      detalhes_de_producao:
        `Slide de texto (renderizavel sem manim e sem anexo): ${palavras(bytes, indice + 60, 3)}`,
      narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    };
    return pedaco;
  }
}

/** Extrai o pedaco alvo do bloco MARCADOR_PEDACO_ALVO (sosia). */
function extrairPedacoAlvoDoPrompt(
  prompt: string,
): { id?: string; indice?: number; duracao_segundos?: number } | undefined {
  const indice = prompt.indexOf(MARCADOR_PEDACO_ALVO);
  if (indice < 0) {
    return undefined;
  }
  const depois = prompt.slice(indice + MARCADOR_PEDACO_ALVO.length);
  const inicio = depois.indexOf("{");
  // O bloco do alvo termina ANTES do marcador dos irmaos (o prompt
  // composto segue com ## RESUMO DOS IRMAOS e ## BRIEF DO VIDEO) —
  // lastIndexOf("}") sem o corte pegaria o fim do BRIEF e o parse
  // falharia sempre (o gerador reaplica a identidade de qualquer forma,
  // mas o texto do sosia usa o indice real).
  const fimDoBloco = depois.indexOf(`\n\n${MARCADOR_IRMAOS}`);
  const fim = fimDoBloco >= 0 ? depois.lastIndexOf("}", fimDoBloco) : depois.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) {
    return undefined;
  }
  try {
    const alvo = JSON.parse(depois.slice(inicio, fim + 1)) as Record<string, unknown>;
    return {
      id: typeof alvo.id === "string" ? alvo.id : undefined,
      indice: typeof alvo.indice === "number" ? alvo.indice : undefined,
      duracao_segundos:
        typeof alvo.duracao_segundos === "number" ? alvo.duracao_segundos : undefined,
    };
  } catch {
    return undefined;
  }
}

// ─── LLM real (Anthropic/OpenAI) ──────────────────────────────────────────────

/** Os dois fornecedores de LLM suportados. */
export type ProvedorLlm = "anthropic" | "openai";

/** Endpoints por fornecedor (os mesmos do executor de autoria). */
const ENDPOINTS_LLM: Readonly<Record<ProvedorLlm, string>> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
} as const;

/** Modelo padrao por fornecedor (os mesmos do executor de autoria). */
const MODELO_PADRAO_LLM: Readonly<Record<ProvedorLlm, string>> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o-mini",
} as const;

/** Teto de tokens de saida: 40 pedacos cabem (o roteiro e maior que o documento de autoria). */
const MAX_TOKENS_LLM = 8192;

/** Opcoes do provedor LLM real. */
export interface OpcoesProvedorLlm {
  /** fetch a usar — injetado (testes) ou o global em producao; NUNCA import de credencial. */
  readonly fetch?: typeof fetch;
  /** Chave de API do fornecedor (injecao; default: env ANTHROPIC_API_KEY/OPENAI_API_KEY). */
  readonly chaveDeApi?: string;
  /** Modelo do fornecedor (default: MODELO_PADRAO_LLM[provedor]). */
  readonly modelo?: string;
  /** Teto de tokens de saida (default: MAX_TOKENS_LLM). */
  readonly maxTokens?: number;
}

/**
 * O provedor LLM real: monta a requisicao por fornecedor, executa via
 * fetch injetado e extrai o JSON bruto da resposta.
 *
 * O prompt composto e separado em texto ESTAVEL (system) e bloco
 * VOLATIL (user message) pelo primeiro marcador — llm-authoring:
 * estavel primeiro (candidato a prompt cache), volatil depois. Sem
 * marcador (prompt custom), o prompt inteiro vai como system.
 *
 * Saida estruturada (output_config) NAO e enviada nesta versao: o
 * schema podado por fornecedor do roteiro ainda nao existe (seria bump
 * de contrato do gerador + fixtures de schema por fornecedor). O
 * contrato hoje e coberto por prompt rigoroso + gate completo no
 * gerador — e o JSON extraido daqui passa SEMPRE pelo gate.
 */
export function criarProvedorLlm(
  provedor: ProvedorLlm,
  opcoes: OpcoesProvedorLlm = {},
): ProvedorRoteiro {
  return {
    nome: `llm-${provedor}`,
    async gerarRoteiroCompleto(prompt: string): Promise<unknown> {
      return executarChamadaLlm(provedor, prompt, opcoes);
    },
    async regenerarPedaco(prompt: string): Promise<unknown> {
      return executarChamadaLlm(provedor, prompt, opcoes);
    },
  };
}

/** Separa o prompt composto em system (estavel) e user (volatil). */
function separarPrompt(prompt: string): { system: string; user: string } {
  const marcadores = [MARCADOR_BRIEF, MARCADOR_PEDACO_ALVO, MARCADOR_IRMAOS];
  let primeiro = -1;
  for (const marcador of marcadores) {
    const indice = prompt.indexOf(marcador);
    if (indice >= 0 && (primeiro < 0 || indice < primeiro)) {
      primeiro = indice;
    }
  }
  if (primeiro < 0) {
    return { system: prompt, user: "Emita a saida JSON conforme o prompt de sistema." };
  }
  return { system: prompt.slice(0, primeiro).trim(), user: prompt.slice(primeiro).trim() };
}

/** Extrai o JSON bruto do conteudo da resposta do LLM (sosia, nao sucessor). */
function extrairJsonDaResposta(provedor: ProvedorLlm, conteudo: unknown): unknown {
  if (typeof conteudo !== "string" || conteudo.trim() === "") {
    throw new EProvedorRoteiroFalhou(provedor, "conteudo da resposta nao e string");
  }
  const texto = conteudo.trim();
  // Parse direto primeiro; tolera cercas markdown removendo o que nao e JSON.
  const tentativas: string[] = [texto];
  const primeiro = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (primeiro >= 0 && fim > primeiro) {
    tentativas.push(texto.slice(primeiro, fim + 1));
  }
  for (const trecho of tentativas) {
    try {
      return JSON.parse(trecho) as unknown;
    } catch {
      // tenta a proxima
    }
  }
  throw new EProvedorRoteiroFalhou(
    provedor,
    "conteudo da resposta nao e JSON valido (JSON malformado nunca e aceito — o gate exige objeto valido)",
  );
}

async function executarChamadaLlm(
  provedor: ProvedorLlm,
  prompt: string,
  opcoes: OpcoesProvedorLlm,
): Promise<unknown> {
  const { system, user } = separarPrompt(prompt);
  const chave =
    opcoes.chaveDeApi ??
    (provedor === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY);
  const modelo = opcoes.modelo ?? MODELO_PADRAO_LLM[provedor];
  const maxTokens = opcoes.maxTokens ?? MAX_TOKENS_LLM;
  const fetchImpl = opcoes.fetch ?? globalThis.fetch;

  let url: string;
  let headers: Record<string, string>;
  let corpo: string;
  if (provedor === "anthropic") {
    url = ENDPOINTS_LLM.anthropic;
    headers = {
      "content-type": "application/json",
      "x-api-key": chave ?? "",
      "anthropic-version": "2023-06-01",
    };
    corpo = JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      // AB-554 (autoria): temperatura 0 e o default; o cache e a
      // garantia de reprodutibilidade, nao o parametro.
      temperature: 0,
    });
  } else {
    url = ENDPOINTS_LLM.openai;
    headers = { "content-type": "application/json", authorization: `Bearer ${chave ?? ""}` };
    corpo = JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
    });
  }

  let resposta: Response;
  try {
    resposta = await fetchImpl(url, { method: "POST", headers, body: corpo });
  } catch (erro) {
    throw new EProvedorRoteiroFalhou(provedor, `fetch falhou: ${(erro as Error).message}`);
  }
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new EProvedorRoteiroFalhou(
      provedor,
      `status ${resposta.status}${detalhe ? ` — ${detalhe.slice(0, 300)}` : ""}`,
      resposta.status,
    );
  }

  let envelope: unknown;
  try {
    envelope = (await resposta.json()) as unknown;
  } catch (erro) {
    throw new EProvedorRoteiroFalhou(provedor, `resposta nao e JSON: ${(erro as Error).message}`);
  }
  if (envelope === null || typeof envelope !== "object") {
    throw new EProvedorRoteiroFalhou(provedor, "resposta nao e um objeto JSON");
  }

  if (provedor === "anthropic") {
    const conteudo = (envelope as Record<string, unknown>).content;
    if (!Array.isArray(conteudo)) {
      throw new EProvedorRoteiroFalhou(provedor, "resposta sem content[]");
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
    // Sem output_json (fora de saida estruturada), o texto vem em text[].
    for (const bloco of conteudo) {
      if (
        bloco !== null &&
        typeof bloco === "object" &&
        (bloco as Record<string, unknown>).type === "text"
      ) {
        return extrairJsonDaResposta(provedor, (bloco as Record<string, unknown>).text);
      }
    }
    throw new EProvedorRoteiroFalhou(provedor, "nenhum bloco text/output_json na resposta");
  }

  const escolhas = (envelope as Record<string, unknown>).choices;
  if (!Array.isArray(escolhas) || escolhas.length === 0) {
    throw new EProvedorRoteiroFalhou(provedor, "resposta sem choices[]");
  }
  const primeira = escolhas[0] as Record<string, unknown> | undefined;
  const mensagem = primeira?.message as Record<string, unknown> | undefined;
  return extrairJsonDaResposta(provedor, mensagem?.content);
}

// ─── CASSETE — replay offline de roteiros gravados ───────────────────────────

/** Formato do cassete de roteiro (layout: fixtures/cassetes/roteiro/<chave>/). */
export const VERSAO_FORMATO_CASSETE_ROTEIRO = "cassete-roteiro.1" as const;

/** Nome do diretorio de cassetes de roteiro (padrao da autoria: fixtures/cassetes/autoria/). */
export const NOME_CASSETE_ROTEIRO = "roteiro" as const;

/** Raiz padrao dos cassetes (a mesma da autoria). */
export const RAIZ_CASSETES_ROTEIRO_PADRAO = "fixtures/cassetes";

/** Cabecalho do cassete de roteiro (auditoria: amarra o cassete ao prompt exato). */
export interface CabecalhoCasseteRoteiro {
  readonly formato: typeof VERSAO_FORMATO_CASSETE_ROTEIRO;
  readonly chave: string;
  /** SHA-256 do prompt que produziu o resultado (C12: prompt mudou = miss). */
  readonly promptSha256: string;
}

/** Um cassete de roteiro carregado do disco. */
export interface CasseteRoteiro {
  readonly cabecalho: CabecalhoCasseteRoteiro;
  readonly resultado: unknown;
}

/** O cassete do prompt nao existe. */
export class ECasseteRoteiroAusente extends Error {
  readonly code = "CASSETE_ROTEIRO_AUSENTE";
  readonly chave: string;
  readonly diretorio: string;

  constructor(chave: string, diretorio: string, detalhe?: string) {
    super(
      `Cassete de roteiro nao existe para o prompt (chave ${chave.slice(0, 16)}…)\n` +
        `  esperado: ${diretorio}\n` +
        (detalhe ? `  detalhe:  ${detalhe}\n` : "") +
        `  Um cassete ausente nunca cai para a rede: o replay e off-line por construcao.\n` +
        `  Grave com gravarCasseteRoteiro (ou use o provedor sosia).`,
    );
    this.name = "ECasseteRoteiroAusente";
    this.chave = chave;
    this.diretorio = diretorio;
  }
}

/** O cassete existe mas esta quebrado. */
export class ECasseteRoteiroInvalido extends Error {
  readonly code = "CASSETE_ROTEIRO_INVALIDO";
  readonly problemas: readonly string[];

  constructor(diretorio: string, problemas: readonly string[]) {
    super(
      `Cassete de roteiro invalido em ${diretorio}:\n` +
        problemas.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "ECasseteRoteiroInvalido";
    this.problemas = problemas;
  }
}

/** Chave de um cassete de roteiro: sha256 do prompt (o unico input do provedor). */
export function chaveDoCasseteRoteiro(prompt: string): string {
  return sha256(prompt);
}

/** Diretorio de um cassete de roteiro: `<raiz>/roteiro/<chave>`. */
export function diretorioDoCasseteRoteiro(raiz: string, chave: string): string {
  return join(raiz, NOME_CASSETE_ROTEIRO, chave);
}

/** Le um cassete de roteiro do disco (layout: cabecalho.json + resultado.json). */
export function lerCasseteRoteiro(raiz: string, chave: string): CasseteRoteiro {
  const diretorio = diretorioDoCasseteRoteiro(raiz, chave);
  const problemas: string[] = [];
  if (!existsSync(diretorio)) {
    throw new ECasseteRoteiroAusente(chave, diretorio);
  }
  const caminhoCabecalho = join(diretorio, "cabecalho.json");
  const caminhoResultado = join(diretorio, "resultado.json");
  for (const caminho of [caminhoCabecalho, caminhoResultado]) {
    if (!existsSync(caminho)) {
      problemas.push(`arquivo obrigatorio ausente: ${caminho}`);
    }
  }
  let cabecalho: CabecalhoCasseteRoteiro | undefined;
  let resultado: unknown;
  if (problemas.length === 0) {
    try {
      cabecalho = JSON.parse(readFileSync(caminhoCabecalho, "utf-8")) as CabecalhoCasseteRoteiro;
      resultado = JSON.parse(readFileSync(caminhoResultado, "utf-8")) as unknown;
    } catch (erro) {
      problemas.push(`arquivo ilegivel: ${(erro as Error).message}`);
    }
  }
  if (problemas.length === 0 && cabecalho !== undefined) {
    if (cabecalho.formato !== VERSAO_FORMATO_CASSETE_ROTEIRO) {
      problemas.push(
        `formato ${String(cabecalho.formato)} != ${VERSAO_FORMATO_CASSETE_ROTEIRO}`,
      );
    }
    if (cabecalho.chave !== chave) {
      problemas.push(
        `cabecalho.chave (${cabecalho.chave.slice(0, 16)}…) diverge do diretorio (${chave.slice(0, 16)}…)`,
      );
    }
  }
  if (problemas.length > 0) {
    throw new ECasseteRoteiroInvalido(diretorio, problemas);
  }
  return { cabecalho: cabecalho!, resultado };
}

/**
 * Grava um cassete de roteiro (para testes deterministicos e congelar
 * respostas reais): `<raiz>/roteiro/<sha256(prompt)>/cabecalho.json` +
 * `resultado.json`, escrita atomica por arquivo. O resultado deve ser o
 * JSON VALIDO (o replay devolve como veio — o gate do gerador decide).
 */
export function gravarCasseteRoteiro(
  raiz: string,
  prompt: string,
  resultado: unknown,
): { chave: string; diretorio: string } {
  const chave = chaveDoCasseteRoteiro(prompt);
  const diretorio = diretorioDoCasseteRoteiro(raiz, chave);
  mkdirSync(diretorio, { recursive: true });
  const cabecalho: CabecalhoCasseteRoteiro = {
    formato: VERSAO_FORMATO_CASSETE_ROTEIRO,
    chave,
    promptSha256: sha256(prompt),
  };
  for (const [nome, conteudo] of [
    ["cabecalho.json", JSON.stringify(cabecalho)],
    ["resultado.json", JSON.stringify(resultado)],
  ] as const) {
    const caminho = join(diretorio, nome);
    const temporario = `${caminho}.tmp-${process.pid}`;
    writeFileSync(temporario, conteudo, "utf-8");
    renameSync(temporario, caminho);
  }
  return { chave, diretorio };
}

/**
 * Cria o provedor de replay: devolve `resultado.json` do cassete cuja
 * chave casa o prompt recebido; ausencia = erro NOMEADO (nunca cai para
 * a rede, nunca devolve resultado de outro prompt).
 */
export function criarProvedorCasseteRoteiro(
  raiz: string = RAIZ_CASSETES_ROTEIRO_PADRAO,
): ProvedorRoteiro {
  async function replay(prompt: string): Promise<unknown> {
    const chave = chaveDoCasseteRoteiro(prompt);
    return lerCasseteRoteiro(raiz, chave).resultado;
  }
  return {
    nome: "cassete",
    gerarRoteiroCompleto: replay,
    regenerarPedaco: replay,
  };
}

// ─── Selecao por nome (env/flag do CLI) ──────────────────────────────────────

/** Os nomes de provedor aceitos por env/flag (ROTEIRO_PROVEDOR / --provedor). */
export type NomeProvedorRoteiro = "sosia" | "cassete" | "llm-anthropic" | "llm-openai";

/** Opcoes de criacao por nome. */
export interface OpcoesProvedorRoteiro extends OpcoesProvedorLlm {
  /** Raiz dos cassetes (so para o provedor cassete). */
  readonly raizCassetes?: string;
}

/** Nome de provedor desconhecido (env/flag invalido — erro claro, nunca silencio). */
export class EProvedorDesconhecido extends Error {
  constructor(nome: string) {
    super(
      `Provedor de roteiro desconhecido: "${nome}". ` +
        `Valores aceitos: sosia | cassete | llm-anthropic | llm-openai.`,
    );
    this.name = "EProvedorDesconhecido";
  }
}

/** Cria um provedor pelo nome (env/flag). */
export function criarProvedorRoteiroPorNome(
  nome: string,
  opcoes: OpcoesProvedorRoteiro = {},
): ProvedorRoteiro {
  switch (nome) {
    case "sosia":
      return new ProvedorSosiaRoteiro();
    case "cassete":
      return criarProvedorCasseteRoteiro(opcoes.raizCassetes);
    case "llm-anthropic":
      return criarProvedorLlm("anthropic", opcoes);
    case "llm-openai":
      return criarProvedorLlm("openai", opcoes);
    default:
      throw new EProvedorDesconhecido(nome);
  }
}

/**
 * O provedor PADRAO do gerador: o nome vem de ROTEIRO_PROVEDOR (env) e o
 * default e "sosia" — o unico que roda sem rede e sem credencial, e e o
 * que o e2e da Onda 7 usa. O servidor da Onda 4/5 troca por
 * llm-anthropic/llm-openai (com chave via env ANTHROPIC_API_KEY /
 * OPENAI_API_KEY) quando houver credencial.
 */
export function criarProvedorPadrao(opcoes: OpcoesProvedorRoteiro = {}): ProvedorRoteiro {
  return criarProvedorRoteiroPorNome(process.env.ROTEIRO_PROVEDOR ?? "sosia", opcoes);
}
