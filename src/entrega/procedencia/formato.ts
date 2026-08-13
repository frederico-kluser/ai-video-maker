/**
 * src/entrega/procedencia/formato.ts
 *
 * O FORMATO DO RELATORIO DE PROCEDENCIA (card F5-06, W7).
 *
 * O relatorio e a resposta a tres perguntas do card:
 *
 *   1. Cobre assets TRANSITIVOS?  Sim: alem dos assets referenciados de
 *      forma direta pelo manifesto resolvido (diretos), o relatorio
 *      inclui o que entrou DENTRO de um cassete (`assets[]` de cada
 *      estagio participante) e o que entrou DENTRO de uma emenda
 *      (a cadeia de derivacao ate o audio-fonte).
 *   2. Registra a ORIGEM com data e termos?  Sim: cada entrada carrega
 *      `licenca`, `provedor`, `adquiridoEm` (data), `atribuicao`
 *      (termos) e `origem` (URL/id no provedor), quando registrados. A
 *      ausencia de data NAO bloqueia (o campo e VOLATIL por contrato da
 *      W4) — mas e reportada em `gapsDeData`, nunca omitida.
 *   3. Permite reavaliar o ja produzido SEM re-renderizar?  Sim: o
 *      relatorio e funcao pura de (manifesto resolvido, store, cassetes,
 *      relogio injetado) — regeneravel a qualquer momento a partir do
 *      que ja esta commitado. E essa a razao de ele existir desde que o
 *      ADR-0003 liberou a licenca (AB-950).
 *
 * ∅-crit (PROGRAMA.html, card F5-06): **um asset no video final sem
 * origem declarada tem de bloquear a entrega.** "Origem declarada"
 * significa, neste formato:
 *
 *   - existe um registro de procedencia para o hash (store ou cassete);
 *   - `licenca` presente e nao-vazia;
 *   - `provedor` presente e nao-vazio;
 *   - se o asset for DERIVADO (emenda), a cadeia de derivacao termina
 *     num registro com origem declarada e nao cicla.
 *
 * Tudo que viola isso entra em `semOrigem` e o gate `just procedencia`
 * fica VERMELHO. A ausencia de DATA so entra em `gapsDeData`.
 *
 * Convencao de derivacao (a emenda do F3-05, contrato-w7 C3):
 * a procedencia do asset emendado declara a origem dos bytes no campo
 * de texto livre (store: `notes`/`sourceId`/`attribution`; cassete:
 * `notas`/`atribuicao`/`origem`) com o marcador:
 *
 *     emenda: audio-fonte=<sha256>; operacao=<nome> <versao>
 *
 * O relatorio varre o TEXTO inteiro de cada registro de procedencia em
 * busca do marcador (tripwire por texto normalizado, C11), entao a
 * escolha exata do campo pelo F3-05 nao muda o resultado — o que muda
 * e documentado no ADR-0039 e no handoff do F5-06.
 */

import type { Sha256 } from "../../resolucao/manifesto-resolvido.js";
import type { Procedencia } from "../../store/procedencia.js";

// ─── Identidade do formato ──────────────────────────────────────────────────────

/** Versao do formato do relatorio. Mudar o formato ⇒ bumpar esta constante. */
export const VERSAO_FORMATO_RELATORIO = "RelatorioProcedencia.1";

/** Raiz padrao dos cassetes, relativa a raiz do repositorio. */
export const RAIZ_CASSETES_PADRAO = "fixtures/cassetes";

// ─── Convencao de derivacao (emenda) ────────────────────────────────────────────

/**
 * Prefixo do marcador de derivacao. A cadeia completa esperada:
 * `emenda: audio-fonte=<sha256>; operacao=<nome> <versao>`.
 *
 * Escaneado por regex sobre o TEXTO inteiro de cada registro de
 * procedencia — nunca campo a campo (C11: busca em texto normalizado).
 */
export const MARCADOR_DERIVACAO = "emenda: audio-fonte=";

/** Regex do marcador: captura o hash do audio-fonte e a operacao. */
export const PADRAO_DERIVACAO = /emenda:\s*audio-fonte=([0-9a-f]{64})(?:;\s*operacao=([^;\n]+))?/g;

/** Teto de profundidade da cadeia de derivacao (protecao contra ciclo). */
export const LIMITE_PROFUNDIDADE_CADEIA = 16;

/**
 * Data registrada por `paraProcedenciaDoStore` quando o cassete nao tem
 * `adquiridoEm`: `new Date(0).toISOString()`. O relatorio trata essa
 * data como "data nao registrada na aquisicao" (gap, nao bloqueio).
 */
export const DATA_EPOCH = "1970-01-01T00:00:00.000Z";

// ─── Tipos ──────────────────────────────────────────────────────────────────────

/** Uma origem registrada: licenca + provedor + data + termos. */
export interface OrigemRegistrada {
  /** Licenca. OBRIGATORIA e nao-vazia (∅-crit). Nunca uma URL. */
  readonly licenca: string;

  /** Provedor (identificador). OBRIGATORIO e nao-vazio (∅-crit). */
  readonly provedor: string;

  /** Texto exato de atribuicao exigido pela licenca, se houver. */
  readonly atribuicao?: string;

  /** Se a licenca exige atribuicao visivel. */
  readonly atribuicaoObrigatoria: boolean;

  /** ISO-8601 da aquisicao. VOLATIL: pode faltar (vira gap, nao bloqueio). */
  readonly adquiridoEm?: string;

  /** De onde veio (URL do provedor ou descricao). Nunca caminho de leitura. */
  readonly origem?: string;

  /** Id do asset no provedor. */
  readonly idNoProvedor?: string;

  /** Termo de busca usado para encontrar o asset, se houve. */
  readonly termoDeBusca?: string;

  /** Ferramenta e versao que produziu/baixou o asset. */
  readonly ferramenta?: string;

  /** Notas de auditoria do registro. */
  readonly notas?: string;
}

/** De onde a origem de um hash foi lida. */
export type FonteDaOrigem = "store" | "cassete" | "ausente";

/** Uma derivacao declarada: estes bytes vieram de outro asset, por uma operacao. */
export interface DerivacaoDeclarada {
  /** SHA-256 do asset de origem (o audio-fonte da emenda). */
  readonly hash: Sha256;

  /** Nome e versao da operacao que produziu a derivacao (ex.: "emenda de locucao v1.0.0"). */
  readonly operacao?: string;
}

/** Uma entrada do relatorio: um hash com o registro da origem dele. */
export interface EntradaRelatorio {
  /** SHA-256 do asset. */
  readonly hash: Sha256;

  /**
   * Papeis do asset no video final. Diretos: `midia`, `locucao`,
   * `grafico`, `codigo`, `musica`, `trilha-sonora`. Transitivos:
   * `emenda` (entrou como audio-fonte de uma derivacao) e
   * `cassete-<estagio>` (entrou dentro do cassete do estagio).
   */
  readonly papeis: readonly string[];

  /** Ids de no que referenciam este asset (diretos). */
  readonly nos: readonly string[];

  /** Se entrou de forma indireta (dentro de cassete/emenda). */
  readonly transitivo: boolean;

  /** A origem registrada, ou null = SEM ORIGEM DECLARADA (bloqueia). */
  readonly origem: OrigemRegistrada | null;

  /** De onde a origem foi lida. */
  readonly fonteDaOrigem: FonteDaOrigem;

  /** Derivacao declarada (emenda), quando o registro a declara. */
  readonly derivadoDe: DerivacaoDeclarada | null;

  /** True quando a data de aquisicao falta ou e a epoch (gap, nao bloqueio). */
  readonly semData: boolean;

  /** Motivo de origem ausente — presente quando `origem === null`. */
  readonly motivoSemOrigem?: string;
}

/** Alguem sem origem declarada — o ∅-crit do card. */
export interface AusenciaDeOrigem {
  readonly hash: Sha256;
  readonly papel: string;
  readonly motivo: string;
}

/** Uma data ausente no registro — reportada, nunca bloqueante. */
export interface GapDeData {
  readonly hash: Sha256;
  readonly motivo: string;
}

/** A origem do proprio manifesto (texto gerado por modelo de lingua). */
export interface OrigemDoManifesto {
  /** Origens de autoria casadas pelo hash do manifesto original. */
  readonly origens: readonly OrigemRegistrada[];
  /** De onde veio (sempre "cassete" quando encontrado). */
  readonly fonteDaOrigem: FonteDaOrigem;
  /** Motivo de ausencia, quando `origens` esta vazio. */
  readonly motivo?: string;
}

/** O relatorio de procedencia completo do video final. */
export interface RelatorioProcedencia {
  /** Versao do formato. */
  readonly formato: string;

  /** ISO-8601 do momento da geracao (relogio INJETADO — determinismo C9). */
  readonly geradoEm: string;

  /** Identidade do manifesto resolvido a que este relatorio se refere. */
  readonly manifesto: {
    readonly schemaVersion: string;
    readonly hashManifestoOriginal: Sha256;
    readonly origem: OrigemDoManifesto;
  };

  /**
   * O enquadramento de uso sob o qual este relatorio e verdadeiro.
   * Declaracao obrigatoria do ADR-0003: "AB-950 continua fechado" —
   * a omissao e falha de gate. Se o enquadramento mudar (AB-950), este
   * relatorio e o que permite reavaliar SEM re-renderizar.
   */
  readonly enquadramento: {
    readonly uso: "pessoal";
    readonly adr: "ADR-0003";
    readonly ab950: "AB-950 continua fechado";
  };

  /** Assets referenciados diretamente pelo manifesto resolvido. */
  readonly diretos: readonly EntradaRelatorio[];

  /** Assets que entraram de forma indireta (dentro de cassete/emenda). */
  readonly transitivos: readonly EntradaRelatorio[];

  /**
   * ∅-crit: assets no video final sem origem declarada.
   * VAZIO = entrega liberada; qualquer entrada = `just procedencia`
   * fica VERMELHO e bloqueia a entrega.
   */
  readonly semOrigem: readonly AusenciaDeOrigem[];

  /** Datas ausentes — visiveis para a reavaliacao, nao bloqueantes. */
  readonly gapsDeData: readonly GapDeData[];
}

// ─── Guardas ────────────────────────────────────────────────────────────────────

/**
 * Uma origem esta "declarada" se licenca e provedor existem e nao estao
 * vazios. E a definicao executavel do ∅-crit — a mesma para store e
 * cassete, para que os dois caminhos nao divergam.
 */
export function origemDeclarada(origem: OrigemRegistrada | null): boolean {
  if (origem === null) return false;
  return (
    typeof origem.licenca === "string" &&
    origem.licenca.length > 0 &&
    typeof origem.provedor === "string" &&
    origem.provedor.length > 0
  );
}

/**
 * Data "registrada de verdade": presente e diferente da epoch que
 * `paraProcedenciaDoStore` grava quando o cassete nao tinha data.
 */
export function dataRegistrada(adquiridoEm: string | undefined): boolean {
  if (adquiridoEm === undefined || adquiridoEm.length === 0) return false;
  return !/^1970-01-01T00:00:00/.test(adquiridoEm);
}

// ─── Extracao de derivacao ──────────────────────────────────────────────────────

/**
 * Extrai as derivacoes declaradas do TEXTO inteiro de um registro de
 * procedencia (store ou cassete). O texto e a concatenacao de todos os
 * campos de texto livre do registro: o marcador pode viver em qualquer
 * um deles (o F3-05 escolhe o campo; o relatorio varre o texto todo).
 *
 * Determinista: derivacoes em ordem de aparicao no texto.
 */
export function extrairDerivacoes(...textos: (string | undefined)[]): DerivacaoDeclarada[] {
  const saida: DerivacaoDeclarada[] = [];
  for (const texto of textos) {
    if (texto === undefined) continue;
    for (const casamento of texto.matchAll(PADRAO_DERIVACAO)) {
      const hash = casamento[1];
      const operacao = casamento[2];
      if (hash === undefined) continue;
      saida.push({ hash, operacao: operacao?.trim() || undefined });
    }
  }
  return saida;
}

/**
 * Monta uma OrigemRegistrada a partir do formato do STORE (F0-07,
 * campos em ingles). `licenca` vazia vira origem nao-declarada —
 * mas a origem continua no relatorio, para auditoria, marcada pelo
 * ∅-crit.
 */
export function origemDoStore(procedencia: Procedencia): OrigemRegistrada {
  return {
    licenca: procedencia.license,
    provedor: procedencia.source,
    atribuicao: procedencia.attribution,
    atribuicaoObrigatoria: procedencia.attributionRequired,
    adquiridoEm: procedencia.acquiredAt,
    origem: procedencia.fetchedFrom,
    idNoProvedor: procedencia.sourceId,
    termoDeBusca: procedencia.searchTerm,
    ferramenta: procedencia.toolVersion,
    notas: procedencia.notes,
  };
}

/**
 * Serializa o relatorio em JSON canonico (chaves ordenadas, sem espaco
 * superfluo) — o mesmo criterio de `jsonCanonico` do contrato de
 * resolucao, para que o diff do determinismo seja byte a byte.
 */
export function serializarRelatorio(relatorio: RelatorioProcedencia): string {
  return JSON.stringify(ordenar(relatorio));
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor !== null && typeof valor === "object") {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of entradas) saida[chave] = ordenar(v);
    return saida;
  }
  return valor;
}
