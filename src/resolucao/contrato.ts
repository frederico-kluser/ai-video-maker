/**
 * src/resolucao/contrato.ts
 *
 * O contrato que TODO estagio de resolucao implementa.
 *
 * Este arquivo e a fronteira de determinismo vista de cima: um estagio
 * de resolucao e a unica coisa do pipeline autorizada a ser impura
 * (rede, relogio, provedor externo). Em troca disso ele aceita tres
 * obrigacoes, nesta ordem de importancia:
 *
 *   1. Toda saida sua e endereçada por hash de conteudo. Nenhuma URL
 *      atravessa a fronteira (AGENTS.md C7).
 *   2. Toda execucao sua e gravada num cassete, e o cassete e a unica
 *      fonte de verdade quando o pipeline roda offline. Estagio sem
 *      cassete NAO e pulado: ele derruba a suite (∅-crit).
 *   3. A chave de cache inclui TUDO que muda a saida — inclusive a
 *      versao do estagio e a versao deste contrato (AGENTS.md C12).
 *      Mudar o codigo do estagio sem mudar `identidade.versao` e o
 *      unico jeito de servir resultado velho para sempre; por isso a
 *      versao entra na chave e existe um teste que exige cache miss.
 *
 * Os estagios sao descobertos por convencao, nunca por registro central
 * (AGENTS.md Regra 6): `src/resolucao/<nome>/estagio.ts`.
 *
 * Leia tambem: docs/contrato-estagio-resolucao.md e docs/adr/0006-*.
 */

import { createHash } from "node:crypto";
import type { Manifesto } from "../contratos/manifesto.js";
import type { ParcialResolvido } from "./manifesto-resolvido.js";
import type { ProcedenciaCassete } from "./cassete/formato.js";

// ─── Versao do contrato ─────────────────────────────────────────────────────────

/**
 * Versao do CONTRATO de estagio (nao do estagio).
 *
 * Entra na chave de cache: se a semantica deste arquivo mudar, todo
 * cassete gravado sob a semantica antiga vira cache miss por construcao.
 * Bump obrigatorio ao mudar o formato de `EntradaEstagio`/`SaidaEstagio`,
 * a composicao da chave, ou o layout do cassete.
 */
export const VERSAO_CONTRATO = "1.0.0";

// ─── Identidade do estagio ──────────────────────────────────────────────────────

/**
 * Nome canonico de um estagio de resolucao.
 *
 * Fechado de proposito: o pipeline tem exatamente cinco sub-estagios
 * impuros (AGENTS.md, "Os cinco estagios", item 2). Um diretorio de
 * estagio com nome fora desta lista e um erro, nunca um silencio.
 */
export type NomeEstagio =
  | "locucao"
  | "grafico"
  | "midia"
  | "codigo"
  | "musica";

/** Ordem canonica de execucao. Fixa: o merge depende dela para ser estavel. */
export const ORDEM_ESTAGIOS: readonly NomeEstagio[] = [
  "locucao",
  "grafico",
  "midia",
  "codigo",
  "musica",
] as const;

/** Verifica se uma string e um nome de estagio canonico. */
export function ehNomeEstagio(nome: string): nome is NomeEstagio {
  return (ORDEM_ESTAGIOS as readonly string[]).includes(nome);
}

/** Identidade completa de um estagio: nome + versao. Ambos entram na chave. */
export interface IdentidadeEstagio {
  /** Nome canonico do estagio. */
  readonly nome: NomeEstagio;

  /**
   * Versao do estagio. Semver.
   *
   * REGRA DURA: mudou o codigo de um jeito que pode mudar a saida?
   * Bumpou a versao. Sem isso o cache serve resultado velho para sempre
   * e o teste `chave inclui versao do estagio` fica verde por acaso.
   */
  readonly versao: string;
}

// ─── Parametros ─────────────────────────────────────────────────────────────────

/**
 * Parametros de um estagio: tudo que muda a saida e nao esta no manifesto.
 *
 * Exemplos reais: voz e velocidade do TTS, qualidade do render do Manim,
 * tema de destaque de codigo, provedor de midia escolhido, versao da
 * ferramenta externa (`ffmpeg 7.1`, `manim 0.18.1`).
 *
 * Valor escalar apenas: a chave e o JSON canonico disto. Se voce precisa
 * de um objeto aninhado, achate-o (`voz.nome` → `"voz.nome"`).
 */
export type ParametrosEstagio = Readonly<
  Record<string, string | number | boolean | null>
>;

// ─── Entrada e saida ────────────────────────────────────────────────────────────

/** Entrada de uma execucao de estagio. */
export interface EntradaEstagio {
  /** Manifesto original, integro. O estagio NAO o modifica. */
  readonly manifesto: Manifesto;

  /** Parametros efetivos desta execucao (ja incluidos na chave). */
  readonly parametros: ParametrosEstagio;

  /**
   * `fetch` que o estagio DEVE usar para falar com o mundo.
   *
   * Em modo gravacao aponta para a rede real e grava cada chamada no
   * cassete. Em modo offline aponta para o cassete e lanca se a chamada
   * nao foi gravada. Um estagio que chamar `globalThis.fetch` direto
   * bate no guarda de rede e derruba a suite — que e o comportamento
   * desejado.
   */
  readonly fetch: typeof fetch;

  /**
   * Diretorio de trabalho temporario, exclusivo desta execucao.
   * Nada que sobreviva aqui atravessa a fronteira: o que importa vai
   * para o store por hash.
   */
  readonly diretorioTrabalho: string;
}

/** Saida de uma execucao de estagio. */
export interface SaidaEstagio {
  /**
   * A camada de resolucao produzida por este estagio.
   * So hash de conteudo — nenhuma URL, nenhum caminho de disco.
   */
  readonly parcial: ParcialResolvido;

  /**
   * Procedencia do que este estagio produziu.
   *
   * `licenca` e obrigatoria e nao-vazia — e o ∅-crit dos cinco cards
   * da W4 (`rg -L '"licenca"' fixtures/cassetes/<nome>/**\/procedencia.json`
   * tem de sair vazio). Um asset sem licenca registrada e um passivo
   * juridico que ninguem consegue auditar depois.
   */
  readonly procedencia: ProcedenciaCassete;
}

// ─── O contrato ─────────────────────────────────────────────────────────────────

/**
 * Contrato de um estagio de resolucao.
 *
 * Implementacao minima (copie de `fixtures/resolucao/estagio-referencia/`):
 *
 * ```ts
 * // src/resolucao/locucao/estagio.ts
 * const estagio: EstagioResolucao = {
 *   identidade: { nome: "locucao", versao: "1.0.0" },
 *   parametros: { voz: "alloy", velocidade: 1 },
 *   async resolver(entrada) { ... },
 * };
 * export default estagio;
 * ```
 */
export interface EstagioResolucao {
  /** Identidade unica: nome canonico + versao. Entra na chave. */
  readonly identidade: IdentidadeEstagio;

  /** Parametros que mudam a saida. Entram na chave. */
  readonly parametros: ParametrosEstagio;

  /**
   * Resolve a camada deste estagio.
   *
   * Chamado APENAS em modo gravacao. Em modo offline o orquestrador
   * reproduz o cassete e nunca invoca este metodo — e por isso que a
   * suite offline consegue rodar com a rede bloqueada de verdade.
   */
  resolver(entrada: EntradaEstagio): Promise<SaidaEstagio>;
}

// ─── Chave de cache ─────────────────────────────────────────────────────────────

/**
 * Componentes da chave de cache, na ordem em que sao serializados.
 *
 * C12: a chave inclui tudo que muda a saida. Omitir um componente faz
 * o cache acertar pelo motivo errado.
 */
export interface ComponentesChave {
  readonly versaoContrato: string;
  readonly nome: NomeEstagio;
  readonly versaoEstagio: string;
  readonly hashManifesto: string;
  readonly parametros: ParametrosEstagio;
}

/**
 * Serializa um valor em JSON canonico: chaves de objeto em ordem
 * lexicografica, sem espaco supérfluo.
 *
 * Sem isso a chave depende da ordem de insercao das propriedades — que
 * e ordem de escrita do codigo, nao dado — e o mesmo estagio produz
 * duas chaves diferentes em duas maquinas (AGENTS.md Regra 1: iteracao
 * sobre objeto sem ordenacao explicita e proibida).
 */
export function jsonCanonico(valor: unknown): string {
  return JSON.stringify(ordenar(valor));
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor !== null && typeof valor === "object") {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const saida: Record<string, unknown> = {};
    for (const [k, v] of entradas) saida[k] = ordenar(v);
    return saida;
  }
  return valor;
}

/** Hash SHA-256 do manifesto, em JSON canonico. */
export function hashDoManifesto(manifesto: Manifesto): string {
  return createHash("sha256").update(jsonCanonico(manifesto), "utf-8").digest("hex");
}

/** Monta os componentes da chave de um estagio para um manifesto. */
export function componentesDaChave(
  estagio: EstagioResolucao,
  hashManifesto: string,
): ComponentesChave {
  return {
    versaoContrato: VERSAO_CONTRATO,
    nome: estagio.identidade.nome,
    versaoEstagio: estagio.identidade.versao,
    hashManifesto,
    parametros: estagio.parametros,
  };
}

/**
 * Chave de cache de uma execucao de estagio: SHA-256 do JSON canonico
 * dos componentes.
 *
 * A chave e tambem o nome do diretorio do cassete:
 * `fixtures/cassetes/<nome>/<chave>/`.
 */
export function chaveDeCache(componentes: ComponentesChave): string {
  return createHash("sha256")
    .update(jsonCanonico(componentes), "utf-8")
    .digest("hex");
}

/** Atalho: chave de cache de um estagio para um manifesto. */
export function chaveDoEstagio(
  estagio: EstagioResolucao,
  manifesto: Manifesto,
): string {
  return chaveDeCache(componentesDaChave(estagio, hashDoManifesto(manifesto)));
}
