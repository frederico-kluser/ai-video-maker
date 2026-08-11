// =============================================================================
// CONTRATO DE NO — a interface que todo componente visual implementa
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// Um no visual e uma FUNCAO PURA de (no, frame, fps, width, height).
// O frame chega por PROP, nunca por hook de contexto: e isso que torna
// cada no renderizavel e testavel sem navegador e sem runtime do Remotion
// (ver docs/adr/0006-composicao-raiz.md).
//
// REGRA: toda animacao deriva de props.frame, nunca de relogio de parede.
// =============================================================================

import type React from "react";
import type { No } from "../contratos/manifesto";

// ---------------------------------------------------------------------------
// Props padronizadas — toda implementacao de no recebe este contrato
// ---------------------------------------------------------------------------

/**
 * Props que todo componente de no recebe.
 *
 * O contrato e fechado: componentes que precisam de mais contexto
 * (ex.: o no vizinho, a cena atual) devem recebe-lo por props derivadas
 * do manifesto, nunca de estado global, modulo ou contexto ambiente.
 */
export interface NoComponentProps {
  /** Dados do no — uniao discriminada do contrato do manifesto */
  no: No;
  /** Frame LOCAL: 0 = primeiro frame visivel deste no */
  frame: number;
  /** Frames por segundo da composicao */
  fps: number;
  /** Largura do canvas em pixels */
  width: number;
  /** Altura do canvas em pixels */
  height: number;
}

/**
 * Componente de no visual.
 *
 * Contrato:
 * - Funcao pura de (no, frame, fps, width, height)
 * - Nenhum Date.now(), Math.random(), setTimeout(), fetch()
 * - Nenhuma animacao CSS (transition, animation)
 * - Nenhum background-image, mask-image
 * - Toda interpolacao usa extrapolateLeft/Right explicitos
 */
export type NoComponent = React.FC<NoComponentProps>;

// ---------------------------------------------------------------------------
// Identificacao de no — cada implementacao se auto-declara
// ---------------------------------------------------------------------------

/**
 * Metadados que toda implementacao de no DEVE exportar com o nome `meta`.
 * A descoberta le isto do proprio modulo; nao existe registro central
 * escrito a mao (AGENTS.md, Regra 6).
 */
export interface NoComponentMeta {
  /** Tipo do no que este componente renderiza (ex.: "cabecalho") */
  tipo: string;
  /** Versao do schema do no que este componente implementa */
  schema: string;
  /** Identificador unico do componente (gate de unicidade) */
  id: string;
  /** Breve descricao do que o componente renderiza */
  descricao: string;
}

/** Modulo de no ja validado: metadados + componente. */
export interface ModuloDeNo {
  meta: NoComponentMeta;
  componente: NoComponent;
}

// ---------------------------------------------------------------------------
// Catalogo fechado de tipos de no — a verdade vem do schema do manifesto
// ---------------------------------------------------------------------------

/**
 * Tipos de no validos segundo schema/manifesto.schema.json e
 * src/contratos/manifesto.ts (uniao discriminada `No`).
 * Se o schema mudar, esta lista muda junto — e o gate de descoberta
 * reprova qualquer componente cujo tipo nao esteja aqui.
 */
export const TIPOS_DE_NO = [
  "cabecalho",
  "texto",
  "lista",
  "midia",
  "codigo",
  "grafico",
] as const;

export type TipoDeNo = (typeof TIPOS_DE_NO)[number];

/** Versao de schema esperada para cada tipo (espelha `No` do contrato). */
export const SCHEMA_POR_TIPO: Record<TipoDeNo, string> = {
  cabecalho: "Cabecalho.1",
  texto: "Texto.1",
  lista: "Lista.1",
  midia: "Midia.1",
  codigo: "Codigo.1",
  grafico: "Grafico.1",
};

/** Verifica se uma string e um tipo de no valido. */
export function isTipoDeNo(valor: string): valor is TipoDeNo {
  return (TIPOS_DE_NO as readonly string[]).includes(valor);
}

// ---------------------------------------------------------------------------
// Validacao do contrato — usada pela descoberta
// ---------------------------------------------------------------------------

/** Erro lancado quando um modulo de no viola o contrato. */
export class ErroDeContrato extends Error {
  readonly erros: readonly string[];
  constructor(erros: readonly string[]) {
    super(
      `Contrato de no violado (${erros.length} erro(s)):\n` +
        erros.map((e) => `  - ${e}`).join("\n"),
    );
    this.name = "ErroDeContrato";
    this.erros = erros;
  }
}

function textoNaoVazio(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

/**
 * Valida os metadados exportados por um modulo de no.
 * Retorna a lista de erros (vazia = valido). NUNCA ignora em silencio.
 *
 * @param valor       o que o modulo exportou como `meta`
 * @param tipoDoArquivo tipo derivado do nome do arquivo (convencao)
 * @param origem      caminho do arquivo, para a mensagem de erro
 */
export function validarMeta(
  valor: unknown,
  tipoDoArquivo: string,
  origem: string,
): string[] {
  const erros: string[] = [];

  if (valor === null || typeof valor !== "object") {
    erros.push(
      `${origem}: nao exporta \`meta\` (esperado objeto NoComponentMeta, veio ${typeof valor})`,
    );
    return erros;
  }

  const meta = valor as Partial<NoComponentMeta>;

  for (const campo of ["tipo", "schema", "id", "descricao"] as const) {
    if (!textoNaoVazio(meta[campo])) {
      erros.push(`${origem}: meta.${campo} ausente ou vazio`);
    }
  }

  if (textoNaoVazio(meta.tipo)) {
    if (!isTipoDeNo(meta.tipo)) {
      erros.push(
        `${origem}: meta.tipo "${meta.tipo}" nao e um tipo de no do schema ` +
          `(validos: ${TIPOS_DE_NO.join(", ")})`,
      );
    } else {
      const schemaEsperado = SCHEMA_POR_TIPO[meta.tipo];
      if (textoNaoVazio(meta.schema) && meta.schema !== schemaEsperado) {
        erros.push(
          `${origem}: meta.schema "${meta.schema}" diverge do schema do tipo ` +
            `"${meta.tipo}" (esperado "${schemaEsperado}")`,
        );
      }
    }

    if (meta.tipo !== tipoDoArquivo) {
      erros.push(
        `${origem}: meta.tipo "${meta.tipo}" nao casa com o nome do arquivo ` +
          `"${tipoDoArquivo}" (descoberta por convencao: <tipo>.tsx)`,
      );
    }
  }

  return erros;
}

/**
 * Valida um modulo de no inteiro: `meta` + export default.
 * Retorna `{ modulo, erros }`. Se `erros` nao for vazio, `modulo` e null —
 * quem chama DEVE falhar, nunca seguir adiante.
 */
export function validarModuloDeNo(
  modulo: unknown,
  tipoDoArquivo: string,
  origem: string,
): { modulo: ModuloDeNo | null; erros: string[] } {
  const erros: string[] = [];

  if (modulo === null || typeof modulo !== "object") {
    return {
      modulo: null,
      erros: [`${origem}: modulo nao pode ser carregado (veio ${typeof modulo})`],
    };
  }

  const registro = modulo as Record<string, unknown>;

  erros.push(...validarMeta(registro["meta"], tipoDoArquivo, origem));

  const padrao = registro["default"];
  if (typeof padrao !== "function") {
    erros.push(
      `${origem}: nao exporta \`default\` como componente ` +
        `(esperado funcao, veio ${typeof padrao})`,
    );
  }

  if (erros.length > 0) {
    return { modulo: null, erros };
  }

  return {
    modulo: {
      meta: registro["meta"] as NoComponentMeta,
      componente: padrao as NoComponent,
    },
    erros: [],
  };
}
