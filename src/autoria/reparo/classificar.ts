/**
 * src/autoria/reparo/classificar.ts
 *
 * A classificacao REPARAVEL x IRREPARAVEL dos desvios de um documento de
 * autoria (F4-03, W6). Contrato-w6 §3, congelado:
 *
 *   REPARAVEL = FORMA (o reparo pode tocar, e so isso):
 *     espaco, escape, case de enum do vocabulario fechado, ordem,
 *     duplicata.
 *
 *   REJEICAO DEFINITIVA = SEMANTICA (nunca "melhorado" ate passar):
 *     tipo de no desconhecido, texto_alternativo ausente (AB-433),
 *     qualquer violacao de AB-432/433, transicao fora do vocabulario v1
 *     fade/slide/wipe/flip/none (AB-555). O principio geral: TUDO que as
 *     cinco categorias de forma nao podem consertar e irreparavel — o
 *     reparo que "resolve" semantica e o LLM decidindo duas vezes.
 *
 * A classificacao tem duas fontes, unificadas por caminho:
 *   1. varredura estrutural propria (escaneamentoEstrutural): regras que
 *      o schema nao expressa — ids duplicados (o schema nao exige
 *      unicidade), referencia pendurada em cena.nos, AB-432/433,
 *      vocabularios fechados. Ela e a autoridade para semantica;
 *   2. os erros do validador Ajv (draft 2020-12, mesmo arquivo de schema
 *      e mesmas opcoes do validar.ts de F4-01), classificados por keyword.
 *      Um erro Ajv e COBERTO (e nao reportado duas vezes) quando um desvio
 *      estrutural ja existe num caminho que e prefixo dele (ou vice-versa)
 *      — e o caso do anyOf de tipo de no desconhecido e do required de
 *      texto_alternativo ausente.
 *
 * A validacao Ajv roda aqui com erros ESTRUTURADOS (keyword + params),
 * porque validarSaidaAutoria (F4-01) devolve so strings — a classificacao
 * precisa da keyword para decidir. Os dois compilam o MESMO arquivo de
 * schema com as mesmas opcoes; a paridade e testada em classificar.test.ts.
 */

import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { CAMINHO_SCHEMA_COMPLETO } from "../contrato/contrato.js";
import {
  CAMPOS_OPCIONAIS_STRING,
  TIPOS_DE_NO,
  TIPO_GRAFICO_ENUM,
  TIPO_MIDIA_ENUM,
  VOCABULARIO_TRANSICAO,
} from "./derivar.js";

export type ClasseDesvio = "reparavel" | "irreparavel";
export type CategoriaForma = "espaco" | "escape" | "case" | "ordem" | "duplicata";

export interface Desvio {
  /** Caminho JSON do campo que falhou (mesma disciplina do rejeitar.ts de F4-01). */
  caminho: string;
  /** A regra violada: nome estavel (ex.: "tipo_de_no_desconhecido") ou a keyword Ajv. */
  regra: string;
  classe: ClasseDesvio;
  /** Categoria de FORMA, presente quando reparavel. */
  categoria?: CategoriaForma;
  detalhe?: string;
}

// ─── Validacao Ajv estruturada (mesmo schema e opcoes do validar.ts) ───────

const ajv = new Ajv2020({ allErrors: true, strict: false });

let validador: ValidateFunction | undefined;

function carregarValidador() {
  if (validador === undefined) {
    const schemaJson = JSON.parse(readFileSync(CAMINHO_SCHEMA_COMPLETO, "utf-8"));
    validador = ajv.compile(schemaJson);
  }
  return validador;
}

function errosEstruturados(saida: unknown): ErrorObject[] {
  const fn = carregarValidador();
  fn(saida);
  return fn.errors ?? [];
}

// ─── Helpers de caminho e valor ─────────────────────────────────────────────

function segmentos(caminho: string): string[] {
  return caminho === "" ? [] : caminho.split("/").filter(Boolean);
}

/** Caminho a e prefixo (por segmento) do caminho b. */
function ehPrefixo(a: string[], b: string[]): boolean {
  if (a.length > b.length) return false;
  return a.every((seg, i) => seg === b[i]);
}

/** Desvio em A cobre erro Ajv em B quando um caminho e prefixo do outro. */
function seCobrem(a: string, b: string): boolean {
  const sa = segmentos(a);
  const sb = segmentos(b);
  return ehPrefixo(sa, sb) || ehPrefixo(sb, sa);
}

function valorNoCaminho(documento: unknown, caminho: string): unknown {
  let atual: unknown = documento;
  for (const seg of segmentos(caminho)) {
    if (atual === null || typeof atual !== "object") return undefined;
    if (Array.isArray(atual)) {
      atual = atual[Number(seg)];
    } else {
      atual = (atual as Record<string, unknown>)[seg];
    }
  }
  return atual;
}

function isObjeto(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// ─── Varredura estrutural propria (regras alem do Ajv) ─────────────────────

/**
 * As regras de SEMANTICA que o schema nao expressa (ou expressa mal):
 *   - tipo de no fora dos 6 (o Ajv emite anyOf + const; a regra nomeada
 *     e mais clara e cobre os erros Ajv no mesmo caminho);
 *   - AB-433 — texto_alternativo ausente ou so brancos em no de midia;
 *   - AB-432 — hash presente em no de midia tem de ser string;
 *   - AB-555 — transicao fora do vocabulario v1 fade/slide/wipe/flip/none;
 *   - enums de tipo_midia/tipo_grafico fora do vocabulario fechado;
 *   - referencia inexistente em cena.nos (o schema nao exige unicidade
 *     nem existencia: ids sao strings livres);
 *   - DUPLICATAS (reparavel): id de no repetido, id de cena repetido,
 *     referencia repetida dentro de cena.nos.
 */
function escaneamentoEstrutural(saida: unknown): Desvio[] {
  const desvios: Desvio[] = [];
  if (!isObjeto(saida) || !Array.isArray(saida.nos) || !Array.isArray(saida.cenas)) {
    return desvios;
  }

  const idsDeNos = new Set<string>();
  for (let i = 0; i < saida.nos.length; i++) {
    const no = saida.nos[i];
    if (!isObjeto(no)) continue;

    const tipo = no.type;
    if (typeof tipo === "string") {
      // `type` e const do vocabulario fechado: so CASE e reparavel;
      // qualquer outro valor e tipo de no desconhecido.
      const canonico = [...TIPOS_DE_NO].find((t) => t.toLowerCase() === tipo.toLowerCase());
      if (canonico === undefined) {
        desvios.push({
          caminho: `/nos/${i}/type`,
          regra: "tipo_de_no_desconhecido",
          classe: "irreparavel",
          detalhe: `tipo '${tipo}' fora dos ${TIPOS_DE_NO.size} do schema`,
        });
      } else if (canonico !== tipo) {
        desvios.push({
          caminho: `/nos/${i}/type`,
          regra: "case_de_enum",
          classe: "reparavel",
          categoria: "case",
          detalhe: `'${tipo}' -> '${canonico}'`,
        });
      }
    }
    if (typeof no.id === "string") {
      if (idsDeNos.has(no.id)) {
        desvios.push({
          caminho: `/nos/${i}/id`,
          regra: "id_de_no_duplicado",
          classe: "reparavel",
          categoria: "duplicata",
          detalhe: `id '${no.id}' ja usado — mantem-se o primeiro`,
        });
      }
      idsDeNos.add(no.id);
    }
    // AB-432/433 valem para no de midia inclusive com `type` so em case
    // errado ("Midia") — o reparo de case nao pode esconder semantica.
    const tipoMin = typeof tipo === "string" ? tipo.toLowerCase() : undefined;
    if (tipoMin === "midia") {
      const ta = no.texto_alternativo;
      if (typeof ta !== "string" || ta.trim() === "") {
        desvios.push({
          caminho: `/nos/${i}/texto_alternativo`,
          regra: "texto_alternativo_ausente",
          classe: "irreparavel",
          detalhe: "no de midia sem descricao (AB-433)",
        });
      }
      if ("hash" in no && typeof no.hash !== "string") {
        desvios.push({
          caminho: `/nos/${i}/hash`,
          regra: "hash_de_midia_invalido",
          classe: "irreparavel",
          detalhe: `hash ${JSON.stringify(no.hash)} nao e string (AB-432)`,
        });
      }
      if (typeof no.tipo_midia === "string") {
        const desvio = caseOuVocabulario(no.tipo_midia, TIPO_MIDIA_ENUM, `/nos/${i}/tipo_midia`, "enum_fora_do_vocabulario");
        if (desvio) desvios.push(desvio);
      }
    }
    if (tipoMin === "grafico" && typeof no.tipo_grafico === "string") {
      const desvio = caseOuVocabulario(no.tipo_grafico, TIPO_GRAFICO_ENUM, `/nos/${i}/tipo_grafico`, "enum_fora_do_vocabulario");
      if (desvio) desvios.push(desvio);
    }
  }

  const idsDeCenas = new Set<string>();
  for (let i = 0; i < saida.cenas.length; i++) {
    const cena = saida.cenas[i];
    if (!isObjeto(cena)) continue;

    if (typeof cena.id === "string") {
      if (idsDeCenas.has(cena.id)) {
        desvios.push({
          caminho: `/cenas/${i}/id`,
          regra: "id_de_cena_duplicado",
          classe: "reparavel",
          categoria: "duplicata",
          detalhe: `id '${cena.id}' ja usado — mantem-se o primeiro`,
        });
      }
      idsDeCenas.add(cena.id);
    }

    for (const lado of ["transicao_entrada", "transicao_saida"] as const) {
      const transicao = cena[lado];
      if (isObjeto(transicao) && typeof transicao.tipo === "string") {
        const desvio = caseOuVocabulario(
          transicao.tipo,
          VOCABULARIO_TRANSICAO,
          `/cenas/${i}/${lado}/tipo`,
          "transicao_fora_do_vocabulario",
        );
        if (desvio) desvios.push(desvio);
      }
    }

    if (Array.isArray(cena.nos)) {
      const refsVistas = new Set<string>();
      for (let j = 0; j < cena.nos.length; j++) {
        const ref = cena.nos[j];
        if (typeof ref !== "string") continue;
        if (refsVistas.has(ref)) {
          desvios.push({
            caminho: `/cenas/${i}/nos/${j}`,
            regra: "referencia_duplicada_na_cena",
            classe: "reparavel",
            categoria: "duplicata",
            detalhe: `'${ref}' repetida na cena`,
          });
        }
        refsVistas.add(ref);
        if (!idsDeNos.has(ref)) {
          desvios.push({
            caminho: `/cenas/${i}/nos/${j}`,
            regra: "referencia_inexistente",
            classe: "irreparavel",
            detalhe: `'${ref}' nao existe em nos — remover ou inventar no e decisao semantica`,
          });
        }
      }
    }
  }

  return desvios;
}

/**
 * Valor de enum do vocabulario fechado:
 *   - igual so por CASE -> reparavel (case);
 *   - igual so por ESPACO em volta -> reparavel (espaco);
 *   - diferente (mesmo descontando case e espaco) -> irreparavel
 *     (vocabulario fechado violado — AB-555 para transicao).
 */
function caseOuVocabulario(
  bruto: string,
  vocabulario: readonly string[],
  caminho: string,
  regraFora: string,
): Desvio | undefined {
  const valor = bruto.trim();
  const canonico = vocabulario.find((v) => v.toLowerCase() === valor.toLowerCase());
  if (canonico === undefined) {
    return {
      caminho,
      regra: regraFora,
      classe: "irreparavel",
      detalhe: `'${bruto}' fora do vocabulario fechado [${vocabulario.join("/")}]`,
    };
  }
  if (valor !== canonico) {
    return {
      caminho,
      regra: "case_de_enum",
      classe: "reparavel",
      categoria: "case",
      detalhe: `'${bruto}' -> '${canonico}'`,
    };
  }
  if (bruto !== valor) {
    return {
      caminho,
      regra: "espaco",
      classe: "reparavel",
      categoria: "espaco",
      detalhe: `'${bruto}' -> '${valor}'`,
    };
  }
  return undefined;
}

// ─── Classificacao dos erros Ajv (somente os nao cobertos) ──────────────────

function classificarPorKeyword(saida: unknown, erro: ErrorObject): Desvio | undefined {
  const caminho = erro.instancePath === "" ? "(raiz)" : erro.instancePath;
  const base = { caminho, classe: "irreparavel" as const, detalhe: erro.message };
  switch (erro.keyword) {
    case "enum": {
      const valor = valorNoCaminho(saida, erro.instancePath);
      const ultimo = segmentos(erro.instancePath).at(-1);
      const vocabulario =
        ultimo === "tipo" ? VOCABULARIO_TRANSICAO
        : ultimo === "tipo_midia" ? TIPO_MIDIA_ENUM
        : ultimo === "tipo_grafico" ? TIPO_GRAFICO_ENUM
        : undefined;
      if (typeof valor === "string" && vocabulario !== undefined) {
        const aparado = valor.trim();
        const canonico = vocabulario.find((v) => v.toLowerCase() === aparado.toLowerCase());
        if (canonico !== undefined && canonico !== aparado) {
          return { ...base, regra: "case_de_enum", classe: "reparavel", categoria: "case" };
        }
        if (canonico !== undefined && aparado !== valor) {
          return { ...base, regra: "espaco", classe: "reparavel", categoria: "espaco" };
        }
      }
      return { ...base, regra: "enum" };
    }
    case "const":
      return { ...base, regra: "const" };
    case "required": {
      const prop = (erro.params as { missingProperty?: string }).missingProperty ?? "?";
      return { ...base, regra: "required", detalhe: `propriedade obrigatoria ausente '${prop}'` };
    }
    case "type":
      return { ...base, regra: "type" };
    case "minLength": {
      const valor = valorNoCaminho(saida, erro.instancePath);
      const ultimo = segmentos(erro.instancePath).at(-1);
      const eItemDeItens = ultimo !== undefined && /^\d+$/.test(ultimo) &&
        segmentos(erro.instancePath).slice(0, -1).at(-1) === "itens";
      const eCampoOpcional = typeof ultimo === "string" && CAMPOS_OPCIONAIS_STRING.has(ultimo);
      const vazio = typeof valor === "string" && valor.trim() === "";
      if (eItemDeItens && vazio) {
        return { ...base, regra: "espaco", classe: "reparavel", categoria: "espaco", detalhe: "item de lista so com brancos — removivel" };
      }
      if (eCampoOpcional && vazio) {
        return { ...base, regra: "espaco", classe: "reparavel", categoria: "espaco", detalhe: "campo opcional so com brancos — removivel" };
      }
      return { ...base, regra: "minLength" };
    }
    case "minItems":
    case "maxItems":
    case "additionalProperties":
    case "anyOf":
    case "oneOf":
      return { ...base, regra: erro.keyword };
    default:
      return { ...base, regra: erro.keyword };
  }
}

// ─── API publica ────────────────────────────────────────────────────────────

/**
 * Classifica todos os desvios de um documento: estrutural primeiro
 * (autoridade para semantica e duplicatas), depois os erros Ajv nao
 * cobertos. Documento valido => lista vazia.
 */
export function classificarDesvios(saida: unknown): Desvio[] {
  const estruturais = escaneamentoEstrutural(saida);
  const desvios = [...estruturais];
  for (const erro of errosEstruturados(saida)) {
    const coberto = estruturais.some((d) => seCobrem(d.caminho, erro.instancePath));
    if (coberto) continue;
    const desvio = classificarPorKeyword(saida, erro);
    if (desvio !== undefined) desvios.push(desvio);
  }
  return desvios;
}

/** Ha algum desvio IRREPARAVEL (semantico)? */
export function temIrreparavel(desvios: readonly Desvio[]): boolean {
  return desvios.some((d) => d.classe === "irreparavel");
}
