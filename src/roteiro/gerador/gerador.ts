/**
 * src/roteiro/gerador/gerador.ts
 *
 * O GERADOR de roteiro — a API principal do dominio (Onda 2). O coracao
 * da experiencia do usuario: "descreve o que vai fazer + contexto
 * opcional + duracao → roteiro por pedacos; cada pedaco pode ser
 * regenerado individualmente".
 *
 * Ciclo completo de uma chamada, na ordem que o contrato exige:
 *
 *   1. VALIDA o pedido (validarPedidoGerarRoteiro /
 *      validarPedidoRegenerarPedaco) — pedido invalido e REJEITADO com
 *      ErroContratoRoteiro (FQ-C1), nunca aceito em silencio, nunca
 *      cacheado;
 *   2. CACHE (chaveDoStore = chaveDeCacheGerador(pedido) composta com
 *      sha256(prompt) E com o fingerprint do schema podado — C12): HIT
 *      serve o arquivo SEM chamar o provedor (FQ-G1, sonda de chamadas);
 *      MISS chama o provedor UMA vez;
 *   3. NORMALIZA a saida bruta (record-first): TODO pedaco sai com
 *      `narracao {texto:"", origem:"nenhuma", status:"vazio"}` e NUNCA
 *      `tipo_visual` gif/video na primeira geracao (FQ-G5 + emenda da
 *      Onda 2) — anexo e decisao do usuario, e as regras
 *      anexo-exigido/anexo-proibido tornariam o pedaco invalido de
 *      qualquer forma; na PRIMEIRA geracao a IDENTIDADE (id/indice)
 *      tambem e DECISAO DO SISTEMA e e derivada da posicao (o schema
 *      podado nao carrega id/indice — o LLM nao os emite); na
 *      regeneracao, identidade e anexo sao reaplicados do pedido;
 *   4. GATE (rejeitarRoteiroInvalido / rejeitarPedacoInvalido): a saida
 *      so sai deste modulo depois de validar contra o schema completo —
 *      saida invalida do provedor (JSON malformado, campo fora do
 *      schema, gif sem anexo) lanca ErroContratoRoteiro (FQ-G4), e a
 *      saida vinda do CACHE tambem passa pelo gate (cache envenenado
 *      nao entra no pipeline);
 *   5. CACHE a saida VALIDA: uma resposta rejeitada nunca chega ao
 *      cache — a 2a tentativa com a mesma entrada faz chamada real em
 *      vez de servir o cache envenenado.
 *
 * A chamada ao provedor entra por INJECAO — este modulo nao conhece
 * rede nem credencial (a mesma disciplina do executor de autoria).
 */

import { chaveDeCacheGerador } from "../contrato/cache.js";
import type {
  NarracaoPedaco,
  Pedaco,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
  Roteiro,
} from "../contrato/contrato.js";
import {
  validarPedidoGerarRoteiro,
  validarPedidoRegenerarPedaco,
} from "../contrato/validar.js";
import {
  ErroContratoRoteiro,
  rejeitarPedacoInvalido,
  rejeitarRoteiroInvalido,
} from "../contrato/rejeitar.js";
import {
  chaveDoStore,
  definirDiretorioCache,
  escreverNoCache,
  lerDoCache,
} from "./cache.js";
import { montarPromptRegenerar, montarPromptRoteiro } from "./prompt.js";
import { criarProvedorPadrao, fingerprintDoSchemaPodado } from "./provedor.js";
import type { ProvedorRoteiro } from "./provedor.js";

/** A narracao de TODO pedaco gerado — RECORD-FIRST (emenda da Onda 2). */
export const NARRACAO_VAZIA: NarracaoPedaco = {
  texto: "",
  origem: "nenhuma",
  status: "vazio",
} as const;

/** Opcoes de UMA chamada do gerador. */
export interface OpcoesGeradorRoteiro {
  /** Provedor a usar (default: criarProvedorPadrao — env ROTEIRO_PROVEDOR, sosia). */
  readonly provedor?: ProvedorRoteiro;
  /** Diretorio do cache (default: .cache/roteiro ou env ROTEIRO_CACHE_DIR). */
  readonly diretorioCache?: string;
  /** Caminho alternativo da biblioteca de prompts (testes). */
  readonly caminhoPromptRoteirista?: string;
  /** Caminho alternativo do prompt de regeneracao (testes). */
  readonly caminhoPromptRegenerar?: string;
}

/** Resultado de UMA geracao completa: o Roteiro VALIDO + a origem. */
export interface ResultadoGerarRoteiro {
  /** O roteiro VALIDO (record-first) — o que o pipeline pode consumir. */
  readonly roteiro: Roteiro;
  /** De onde veio a saida: cache HIT ou chamada real ao provedor (FQ-G1). */
  readonly origem: "cache" | "chamada";
  /** A chave do store do cache (diagnostico). */
  readonly chave: string;
}

/** Resultado de UMA regeneracao: o Pedaco VALIDO + a origem. */
export interface ResultadoRegenerarPedaco {
  /** O pedaco VALIDO (record-first) — substitui SOMENTE o alvo (FQ-G2). */
  readonly pedaco: Pedaco;
  /** De onde veio a saida: cache HIT ou chamada real ao provedor. */
  readonly origem: "cache" | "chamada";
  /** A chave do store do cache (diagnostico). */
  readonly chave: string;
}

// ─── Normalizacao record-first ────────────────────────────────────────────────

/**
 * Aplica a politica RECORD-FIRST a um pedaco BRUTO do provedor
 * (mutacao): narracao sempre vazia, anexo sempre removido — anexo e
 * decisao do usuario via rota de anexo, nunca decisao do gerador (um
 * anexo inventado pelo provedor apontaria para bytes inexistentes, C7).
 *
 * Na PRIMEIRA geracao, a remocao do anexo e o que faz gif/video sem
 * anexo se tornarem INVALIDOS no gate (regra anexo-exigido-para-gif-video)
 * — o gerador nunca RETORNA gif/video; ou o provedor obedece o prompt,
 * ou a saida e rejeitada com erro nomeado (FQ-G4).
 */
function aplicarRecordFirstEmPedacoBruto(pedaco: Record<string, unknown>): void {
  pedaco.narracao = { ...NARRACAO_VAZIA };
  delete pedaco.anexo_hash;
  delete pedaco.anexo_meta;
}

/**
 * Normaliza a saida bruta da geracao COMPLETA. Devolve a mesma estrutura
 * com a politica record-first aplicada em cada pedaco + a IDENTIDADE
 * derivada da posicao (id p-XXX / indice 0..n-1). O schema podado por
 * fornecedor (src/roteiro/gerador/schema/) NAO carrega id/indice — o
 * LLM nao os emite; o sistema deriva, como ja fazia na regeneracao
 * (normalizarPedacoRecordFirst). Resultado: identidade nunca vem do
 * modelo (nem errada — a classe de erro id-nao-casa-indice deixa de
 * existir no caminho LLM), e a saida de qualquer provedor (sosia,
 * cassete, LLM) passa pelo mesmo crivo. O sosia e o cassete ja emitem
 * ids/indices contiguos validos: a derivacao e no-op para eles (o
 * cassete commitado reproduz byte a byte). Saida que nao e objeto com
 * `pedacos` array passa INTACTA para o gate rejeitar (FQ-G4: JSON
 * malformado nunca e aceito em silencio).
 */
function normalizarRoteiroRecordFirst(saida: unknown): unknown {
  if (saida === null || typeof saida !== "object" || Array.isArray(saida)) {
    return saida;
  }
  const roteiro = saida as Record<string, unknown>;
  if (!Array.isArray(roteiro.pedacos)) {
    return saida;
  }
  for (let i = 0; i < roteiro.pedacos.length; i++) {
    const pedaco = roteiro.pedacos[i];
    if (pedaco !== null && typeof pedaco === "object" && !Array.isArray(pedaco)) {
      const bruto = pedaco as Record<string, unknown>;
      aplicarRecordFirstEmPedacoBruto(bruto);
      // Identidade = DECISAO DO SISTEMA, derivada da posicao (o schema
      // podado nao a carrega): p-XXX com sufixo == indice, contiguo.
      bruto.id = `p-${String(i).padStart(3, "0")}`;
      bruto.indice = i;
    }
  }
  return saida;
}

/**
 * Normaliza a saida bruta da regeneracao de UM pedaco: record-first
 * (narracao vazia, anexo removido) + IDENTIDADE do sistema (id/indice do
 * alvo reaplicados — regenerar NUNCA renumera, FQ-G2) + anexo do USUARIO
 * reaplicado quando o tipo e gif/video (o anexo e estado do usuario; se
 * o provedor devolveu gif/video, o par so pode vir do pedido — um hash
 * inventado apontaria para bytes inexistentes).
 */
function normalizarPedacoRecordFirst(
  saida: unknown,
  pedido: PedidoRegenerarPedaco,
): unknown {
  if (saida === null || typeof saida !== "object" || Array.isArray(saida)) {
    return saida;
  }
  const pedaco = saida as Record<string, unknown>;
  aplicarRecordFirstEmPedacoBruto(pedaco);
  pedaco.id = pedido.pedaco_atual.id;
  pedaco.indice = pedido.pedaco_atual.indice;
  if (pedaco.tipo_visual === "gif" || pedaco.tipo_visual === "video") {
    if (pedido.pedaco_atual.anexo_hash !== undefined) {
      pedaco.anexo_hash = pedido.pedaco_atual.anexo_hash;
    }
    if (pedido.pedaco_atual.anexo_meta !== undefined) {
      pedaco.anexo_meta = { ...pedido.pedaco_atual.anexo_meta };
    }
  }
  return saida;
}

// ─── A geracao completa ───────────────────────────────────────────────────────

/**
 * Gera o roteiro COMPLETO a partir do pedido: cache primeiro (FQ-G1),
 * provedor no miss, normalizacao record-first, gate (FQ-G4) e cache da
 * saida valida.
 *
 * @throws ErroContratoRoteiro quando o PEDIDO nao valida (FQ-C1) ou a
 *   SAIDA (fresca ou cacheada) nao valida contra o schema completo.
 */
export async function gerarRoteiro(
  pedido: PedidoGerarRoteiro,
  opcoes: OpcoesGeradorRoteiro = {},
): Promise<ResultadoGerarRoteiro> {
  // ── 1. GATE do pedido — antes de qualquer cache ─────────────────────
  const validacao = validarPedidoGerarRoteiro(pedido);
  if (!validacao.valido) {
    throw new ErroContratoRoteiro(validacao.problemas);
  }

  if (opcoes.diretorioCache !== undefined) {
    definirDiretorioCache(opcoes.diretorioCache);
  }

  // ── 2. Chave do store: chave do contrato + sha256(prompt) + fingerprint
  //    do schema podado (C12 — o output_config nao faz parte do prompt) ─
  const prompt = montarPromptRoteiro(pedido, opcoes.caminhoPromptRoteirista);
  const chave = chaveDoStore(
    chaveDeCacheGerador(pedido),
    prompt,
    fingerprintDoSchemaPodado("completo"),
  );

  // ── 3. Cache HIT: serve SEM chamar o provedor (FQ-G1) ───────────────
  const cacheado = lerDoCache(chave);
  let saida: unknown;
  let origem: "cache" | "chamada";
  if (cacheado !== null) {
    saida = cacheado;
    origem = "cache";
  } else {
    const provedor = opcoes.provedor ?? criarProvedorPadrao();
    saida = await provedor.gerarRoteiroCompleto(prompt);
    origem = "chamada";
  }

  // ── 4. Normalizacao record-first + GATE (FQ-G4) ─────────────────────
  // A saida do cache TAMBEM passa pela normalizacao e pelo gate: um
  // cache envenenado (ou gravado por um caminho antigo) nao entra no
  // pipeline.
  saida = normalizarRoteiroRecordFirst(saida);
  rejeitarRoteiroInvalido(saida);

  // ── 5. Cache da saida VALIDA (resposta rejeitada nunca e persistida) ─
  if (origem === "chamada") {
    escreverNoCache(chave, saida);
  }

  return { roteiro: saida, origem, chave };
}

// ─── A regeneracao de um pedaco ───────────────────────────────────────────────

/**
 * Regenera UM pedaco: os irmaos ficam byte a byte INTACTOS no roteiro
 * (FQ-G2 — o pedido carrega `pedaco_atual` com as edicoes do usuario e o
 * resumo canonico dos irmaos; a chave inclui TUDO, inclusive anexo do
 * alvo — C12/FQ-G3). A edicao do usuario entra no prompt e na chave:
 * mudou a fala editada, mudou a saida (FQ-G3).
 *
 * @throws ErroContratoRoteiro quando o PEDIDO nao valida (FQ-C1) ou a
 *   SAIDA (fresca ou cacheada) nao valida contra o schema completo.
 */
export async function regenerarPedaco(
  pedido: PedidoRegenerarPedaco,
  opcoes: OpcoesGeradorRoteiro = {},
): Promise<ResultadoRegenerarPedaco> {
  // ── 1. GATE do pedido — antes de qualquer cache ─────────────────────
  const validacao = validarPedidoRegenerarPedaco(pedido);
  if (!validacao.valido) {
    throw new ErroContratoRoteiro(validacao.problemas);
  }

  if (opcoes.diretorioCache !== undefined) {
    definirDiretorioCache(opcoes.diretorioCache);
  }

  // ── 2. Chave do store: chave do contrato + sha256(prompt) + fingerprint
  //    do schema podado do PEDACO (C12 — o output_config nao faz parte
  //    do prompt; o alvo da regeneracao tem o SEU fingerprint) ─────────
  const prompt = montarPromptRegenerar(pedido, opcoes.caminhoPromptRegenerar);
  const chave = chaveDoStore(
    chaveDeCacheGerador(pedido),
    prompt,
    fingerprintDoSchemaPodado("pedaco"),
  );

  // ── 3. Cache HIT: serve SEM chamar o provedor ───────────────────────
  const cacheado = lerDoCache(chave);
  let saida: unknown;
  let origem: "cache" | "chamada";
  if (cacheado !== null) {
    saida = cacheado;
    origem = "cache";
  } else {
    const provedor = opcoes.provedor ?? criarProvedorPadrao();
    saida = await provedor.regenerarPedaco(prompt);
    origem = "chamada";
  }

  // ── 4. Normalizacao record-first + identidade + GATE (FQ-G4) ────────
  saida = normalizarPedacoRecordFirst(saida, pedido);
  rejeitarPedacoInvalido(saida);

  // ── 5. Cache da saida VALIDA ─────────────────────────────────────────
  if (origem === "chamada") {
    escreverNoCache(chave, saida);
  }

  return { pedaco: saida, origem, chave };
}
