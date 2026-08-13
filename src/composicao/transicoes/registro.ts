// =============================================================================
// REGISTRO DE APRESENTACOES — espelho SEM DISCO do diretorio apresentacoes/
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Mesma razao de ../registro.ts (F1-01): o bundle de render nao tem `node:fs`,
// e o gate de pureza so autoriza `../descoberta.ts` a falar com o disco. A
// VERDADE CONTINUA SENDO O DISCO — `tests/composicao/transicoes.test.ts` varre
// `apresentacoes/` e reprova se este espelho divergir do que esta la.
//
// A cobertura e cobrada contra o SCHEMA, nao contra este arquivo: cada tipo de
// `Transicao.tipo` de schema/manifesto.schema.json tem de ter apresentacao.
// Um tipo novo no schema sem apresentacao aqui deixa o gate VERMELHO em vez de
// renderizar corte seco em silencio.
// =============================================================================

import type { TransicaoTipo } from "../../contratos/manifesto";
import {
  TIPOS_DE_TRANSICAO,
  validarMetaDeApresentacao,
  type Apresentacao,
  type ApresentacaoMeta,
  type ModuloDeApresentacao,
} from "./contrato";

import clockWipe, { meta as metaClockWipe } from "./apresentacoes/clockWipe";
import cube, { meta as metaCube } from "./apresentacoes/cube";
import fade, { meta as metaFade } from "./apresentacoes/fade";
import flip, { meta as metaFlip } from "./apresentacoes/flip";
import none, { meta as metaNone } from "./apresentacoes/none";
import slide, { meta as metaSlide } from "./apresentacoes/slide";
import wipe, { meta as metaWipe } from "./apresentacoes/wipe";

/** Registro imutavel, indexado pelo tipo de transicao. */
export type RegistroDeApresentacoes = ReadonlyMap<string, ModuloDeApresentacao>;

const ENTRADAS: readonly ModuloDeApresentacao[] = [
  { meta: metaClockWipe, apresentacao: clockWipe },
  { meta: metaCube, apresentacao: cube },
  { meta: metaFade, apresentacao: fade },
  { meta: metaFlip, apresentacao: flip },
  { meta: metaNone, apresentacao: none },
  { meta: metaSlide, apresentacao: slide },
  { meta: metaWipe, apresentacao: wipe },
];

// --- Autoverificacao na carga: espelho torto e pior que espelho nenhum ------

const erros: string[] = [];
const idsVistos = new Map<string, string>();

for (const entrada of ENTRADAS) {
  erros.push(
    ...validarMetaDeApresentacao(
      entrada.meta,
      entrada.meta.tipo,
      `registro:${entrada.meta.tipo}`,
    ),
  );
  if (typeof entrada.apresentacao !== "function") {
    erros.push(`registro:${entrada.meta.tipo}: apresentacao nao e funcao`);
  }
  const jaVisto = idsVistos.get(entrada.meta.id);
  if (jaVisto) {
    erros.push(`id duplicado "${entrada.meta.id}": ${jaVisto} e ${entrada.meta.tipo}`);
  } else {
    idsVistos.set(entrada.meta.id, entrada.meta.tipo);
  }
}

// Cobertura contra o SCHEMA — o denominador nunca e este arquivo.
const registrados = new Set(ENTRADAS.map((e) => e.meta.tipo));
for (const tipo of TIPOS_DE_TRANSICAO) {
  if (!registrados.has(tipo)) {
    erros.push(
      `tipo "${tipo}" existe no schema e nao tem apresentacao registrada — ` +
        `renderizaria corte seco em silencio`,
    );
  }
}

if (erros.length > 0) {
  throw new Error(
    `Registro de apresentacoes invalido:\n` + erros.map((e) => `  - ${e}`).join("\n"),
  );
}

/** Ordem deterministica por tipo — nada de iterar objeto sem ordenar. */
const ORDENADAS = [...ENTRADAS].sort((a, b) => (a.meta.tipo < b.meta.tipo ? -1 : 1));

export const REGISTRO_DE_APRESENTACOES: RegistroDeApresentacoes = new Map(
  ORDENADAS.map((entrada) => [entrada.meta.tipo, entrada] as const),
);

/** Tipos com apresentacao disponivel, em ordem deterministica. */
export function tiposComApresentacao(): string[] {
  return [...REGISTRO_DE_APRESENTACOES.keys()].sort();
}

/**
 * A apresentacao de um tipo. LANCA se o tipo nao tiver componente: cair para
 * corte seco seria exatamente o quadro que ninguem ve faltando.
 */
export function apresentacaoDe(
  tipo: TransicaoTipo,
  registro: RegistroDeApresentacoes = REGISTRO_DE_APRESENTACOES,
): Apresentacao {
  const entrada = registro.get(tipo);
  if (!entrada) {
    throw new Error(
      `Sem apresentacao para a transicao "${tipo}" ` +
        `(registradas: ${[...registro.keys()].sort().join(", ")})`,
    );
  }
  return entrada.apresentacao;
}

/** O `meta` de um tipo. LANCA pelo mesmo motivo de `apresentacaoDe`. */
export function metaDe(
  tipo: TransicaoTipo,
  registro: RegistroDeApresentacoes = REGISTRO_DE_APRESENTACOES,
): ApresentacaoMeta {
  const entrada = registro.get(tipo);
  if (!entrada) {
    throw new Error(`Sem apresentacao para a transicao "${tipo}"`);
  }
  return entrada.meta;
}
