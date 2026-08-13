/**
 * src/autoria/reparo/derivar.ts
 *
 * Conjuntos fechados e ordens canonicas DERIVADOS do schema completo de
 * F4-01 (src/autoria/contrato/schema/autoria.schema.json), nunca digitados.
 *
 * O schema e a autoridade (card F4-01, W5): a camada de reparo (F4-03, W6)
 * nao duplica os literais do schema — se o schema mudar, os conjuntos e
 * ordens deste modulo mudam junto por construcao. Duas consequencias:
 *
 *   - os 6 tipos de no, os enums de tipo_midia/tipo_grafico e a ordem
 *     canonica de campos por def sao lidos do proprio arquivo;
 *   - o vocabulario de transicao v1 vem de src/autoria/contrato/contrato.ts
 *     (VOCABULARIO_TRANSICAO — congelado pelo AB-555, testado em
 *     tests/autoria/contrato/vocabulario.test.ts contra o pacote instalado).
 */

import { readFileSync } from "node:fs";
import {
  CAMINHO_SCHEMA_COMPLETO,
  VOCABULARIO_TRANSICAO,
} from "../contrato/contrato.js";

interface Def {
  required?: string[];
  properties?: Record<string, unknown>;
  items?: unknown;
}

interface BrancoAnyOf {
  $ref?: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

interface SchemaAutoria {
  required?: string[];
  properties?: Record<string, unknown>;
  $defs?: Record<string, Def>;
}

interface SchemaNo {
  anyOf?: BrancoAnyOf[];
}

function carregarSchema(): SchemaAutoria {
  return JSON.parse(readFileSync(CAMINHO_SCHEMA_COMPLETO, "utf-8")) as SchemaAutoria;
}

const schema = carregarSchema();
const defs = schema.$defs ?? {};

/** Ordem canonica (required primeiro, depois opcionais, na ordem do schema). */
function ordemDe(required: string[] | undefined, properties: Record<string, unknown> | undefined): string[] {
  const requeridos = required ?? [];
  const nomes = Object.keys(properties ?? {});
  return [...requeridos, ...nomes.filter((n) => !requeridos.includes(n))];
}

/** Os 6 tipos de no do schema (const dos ramos de $defs.No.anyOf). */
export const TIPOS_DE_NO: ReadonlySet<string> = new Set(
  ((defs.No as SchemaNo | undefined)?.anyOf ?? [])
    .map((ramo) => {
      const ref = ramo.$ref ?? "";
      const def = defs[ref.replace(/^#\/\$defs\//, "")];
      const tipo = (def?.properties?.type as { const?: string } | undefined)?.const;
      return tipo;
    })
    .filter((t): t is string => typeof t === "string"),
);

/** Mapeia schema de no (ex.: "Cabecalho.1") para o nome do def (ex.: "NoCabecalho"). */
export const DEF_POR_SCHEMA: Readonly<Record<string, string>> = Object.fromEntries(
  ((defs.No as SchemaNo | undefined)?.anyOf ?? [])
    .map((ramo) => {
      const ref = ramo.$ref ?? "";
      const defNome = ref.replace(/^#\/\$defs\//, "");
      const constSchema = (defs[defNome]?.properties?.schema as { const?: string } | undefined)?.const;
      return [constSchema, defNome] as const;
    })
    .filter((par): par is readonly [string, string] => typeof par[0] === "string"),
);

/** Enum fechado de tipo_midia (imagem/video/gif), derivado do schema. */
export const TIPO_MIDIA_ENUM: readonly string[] =
  (defs.NoMidia?.properties?.tipo_midia as { enum?: string[] } | undefined)?.enum ?? [];

/** Enum fechado de tipo_grafico (barras/linha/pizza/area/dispersao), derivado do schema. */
export const TIPO_GRAFICO_ENUM: readonly string[] =
  (defs.NoGrafico?.properties?.tipo_grafico as { enum?: string[] } | undefined)?.enum ?? [];

/** Vocabulario fechado de transicao v1 (AB-555) — do contrato de F4-01. */
export { VOCABULARIO_TRANSICAO };

/** Ordens canonicas por def, derivadas do schema (required primeiro, ordem de declaracao). */
export const ORDEM_DEFS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.entries(defs).map(([nome, def]) => [nome, ordemDe(def.required, def.properties)]),
);

/** Ordem canonica da raiz do documento (schema_version, nos, cenas, audio). */
export const ORDEM_DOCUMENTO: readonly string[] = ordemDe(schema.required, schema.properties);

/** Ordem canonica do item de dados de grafico (rotulo, valor). */
export const ORDEM_DADO_GRAFICO: readonly string[] = (() => {
  const items = defs.NoGrafico?.properties?.dados as { items?: { required?: string[]; properties?: Record<string, unknown> } } | undefined;
  return ordemDe(items?.items?.required, items?.items?.properties);
})();

/** Campos textuais OPCIONAIS (string com minLength) por def — subtitulo, linguagem, titulo. */
export const CAMPOS_OPCIONAIS_STRING: ReadonlySet<string> = new Set(
  Object.values(defs).flatMap((def) =>
    Object.entries(def.properties ?? {})
      .filter(([nome]) => !(def.required ?? []).includes(nome))
      .filter(([, prop]) => {
        const p = prop as { type?: string; minLength?: number };
        return p.type === "string" && typeof p.minLength === "number";
      })
      .map(([nome]) => nome),
  ),
);

/**
 * Campos textuais com minLength (incluindo os itens de dados de grafico,
 * embutidos no NoGrafico): aparar qualquer um deles ate a string vazia
 * tornaria um documento VALIDO em invalido — o reparo de espaco preserva
 * o original nessas posicoes (ou remove, quando a posicao e removivel:
 * campo opcional e item de lista).
 */
export const CAMPOS_STRING_COM_MINLENGTH: ReadonlySet<string> = new Set([
  ...Object.values(defs).flatMap((def) =>
    Object.entries(def.properties ?? {})
      .filter(([, prop]) => {
        const p = prop as { type?: string; minLength?: number };
        return p.type === "string" && typeof p.minLength === "number";
      })
      .map(([nome]) => nome),
  ),
  ...(() => {
    const items = defs.NoGrafico?.properties?.dados as {
      items?: { properties?: Record<string, unknown> };
    } | undefined;
    return Object.entries(items?.items?.properties ?? {})
      .filter(([, prop]) => {
        const p = prop as { type?: string; minLength?: number };
        return p.type === "string" && typeof p.minLength === "number";
      })
      .map(([nome]) => nome);
  })(),
]);
