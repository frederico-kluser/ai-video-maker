/**
 * src/autoria/contrato/normalizar.ts
 *
 * A NORMALIZACAO da saida do LLM — o ponto unico e deterministico entre
 * a extracao (ou o cache) e o gate (P1 do fix da autoria viva, onda 2).
 *
 * O problema que fecha: o subset entregue ao modelo no modo estrito da
 * OpenAI emula opcional com `anyOf [X, null]` em `required` (o strict
 * exige TODAS as propriedades presentes). O schema COMPLETO — contra o
 * qual o gate (rejeitar.ts) valida — nao aceita null nessas chaves: la,
 * opcional e AUSENCIA, nunca null. Quando o modelo emite `null` (que o
 * subset autoriza), o gate rejeita a resposta inteira e a cerimonia viva
 * cai (medido 2/2 na onda 1: ErroContratoAutoria em
 * `/cenas/0/transicao_entrada`, `/cenas/2/transicao_saida`).
 *
 * Decisao do replan: normalizar null -> ausente AQUI, em um unico ponto
 * deterministico; o gate continua validacao pura; os schemas NAO mudam.
 * A forma "ausente" ja e comprovadamente aceita (o cassete antigo
 * passava com as chaves ausentes).
 *
 * Escopo exato: as chaves que o subset do FORNECEDOR autoriza como null
 * (anyOf com ramo `{"type": "null"}` em required) E que o schema completo
 * rejeita como null — hoje TODAS se encaixam: o completo
 * (autoria.schema.json) nao usa `type: null` em lugar nenhum (conferido
 * por teste). A lista NAO e hard-coded: e derivada do subset que viajou
 * na chamada, por fornecedor, memoizada — se o schema mudar, a
 * normalizacao segue o contrato sozinha.
 *
 * No subset Anthropic nao existe anyOf-null (opcional la e omissao): a
 * normalizacao e no-op, e um null numa resposta anthropic continua sendo
 * erro de modelo que o gate rejeita — a normalizacao nao mascara erro.
 */

import { readFileSync } from "node:fs";
import {
  CAMINHO_SCHEMA_ANTHROPIC,
  CAMINHO_SCHEMA_OPENAI,
} from "./contrato.js";

/** Os dois fornecedores suportados (mesma uniao do executor). */
export type ProvedorNormalizacao = "openai" | "anthropic";

/** Onde uma chave nullable vive no documento de autoria. */
export type NivelNormalizacao = "raiz" | "nos" | "cenas";

/** Uma chave a normalizar: null -> ausente, em um nivel do documento. */
export interface AlvoNormalizacao {
  readonly nivel: NivelNormalizacao;
  readonly chave: string;
}

/** `anyOf` com um ramo `{"type": "null"}` — o "opcional" do strict OpenAI. */
function eAnyOfComNull(schema: unknown): boolean {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    return false;
  }
  const anyOf = (schema as Record<string, unknown>).anyOf;
  if (!Array.isArray(anyOf)) {
    return false;
  }
  return anyOf.some(
    (ramo) =>
      ramo !== null &&
      typeof ramo === "object" &&
      !Array.isArray(ramo) &&
      (ramo as Record<string, unknown>).type === "null",
  );
}

/**
 * Coleta os alvos de normalizacao de um subset: para cada objeto com
 * `properties` + `required` (a raiz, `$defs.Cena`, `$defs.No*`), toda
 * propriedade EM required cujo schema seja anyOf-com-null.
 *
 * A recursao desce SO por `$defs` (cada def e um nivel do documento;
 * schemas de propriedade aninhada nao definem nivel novo).
 */
function coletarAlvos(objeto: Record<string, unknown>, caminho: string, alvos: AlvoNormalizacao[]): void {
  const properties = objeto.properties;
  if (properties !== undefined && properties !== null && typeof properties === "object" && !Array.isArray(properties)) {
    const requeridas = Array.isArray(objeto.required) ? (objeto.required as unknown[]) : [];
    for (const [chave, schemaProp] of Object.entries(properties as Record<string, unknown>)) {
      if (requeridas.includes(chave) && eAnyOfComNull(schemaProp)) {
        alvos.push({ nivel: nivelDe(caminho), chave });
      }
    }
  }
  const defs = objeto.$defs;
  if (defs !== undefined && defs !== null && typeof defs === "object" && !Array.isArray(defs)) {
    for (const [nome, def] of Object.entries(defs as Record<string, unknown>)) {
      if (def !== null && typeof def === "object" && !Array.isArray(def)) {
        coletarAlvos(def as Record<string, unknown>, `$defs.${nome}`, alvos);
      }
    }
  }
}

function nivelDe(caminho: string): NivelNormalizacao {
  if (caminho === "$defs.Cena") return "cenas";
  if (caminho.startsWith("$defs.")) return "nos";
  return "raiz";
}

const CACHE_ALVOS = new Map<string, readonly AlvoNormalizacao[]>();

/**
 * Os alvos de normalizacao derivados do subset de um fornecedor.
 * Exportado para o teste de auditoria: a derivacao TEM de bater com o
 * inventario real do subset (se o schema ganhar uma chave nova, este
 * teste fica vermelho e a auditoria fica visivel).
 */
export function alvosDeNormalizacao(provedor: ProvedorNormalizacao): readonly AlvoNormalizacao[] {
  const caminhoSchema = provedor === "openai" ? CAMINHO_SCHEMA_OPENAI : CAMINHO_SCHEMA_ANTHROPIC;
  let alvos = CACHE_ALVOS.get(caminhoSchema);
  if (alvos === undefined) {
    const subset = JSON.parse(readFileSync(caminhoSchema, "utf-8")) as Record<string, unknown>;
    const coletados: AlvoNormalizacao[] = [];
    coletarAlvos(subset, "", coletados);
    alvos = coletados;
    CACHE_ALVOS.set(caminhoSchema, alvos);
  }
  return alvos;
}

function removerNull(objeto: Record<string, unknown>, chave: string): void {
  if (objeto[chave] === null) {
    delete objeto[chave];
  }
}

/**
 * Normaliza a saida bruta do LLM: em cada alvo derivado do subset do
 * provedor, null -> ausente (delete). Com objeto nao-plano (null, array,
 * nao-objeto) devolve como veio — o gate decide.
 *
 * Muta o objeto em disco (saida de JSON.parse: sempre fresca, nunca
 * compartilhada) — o documento NORMALIZADO e o que o gate valida, o que
 * o cache persiste e o que o pipeline consome.
 */
export function normalizarDocumentoAutoria(
  saida: unknown,
  provedor: ProvedorNormalizacao,
): unknown {
  if (saida === null || typeof saida !== "object" || Array.isArray(saida)) {
    return saida;
  }
  const alvos = alvosDeNormalizacao(provedor);
  if (alvos.length === 0) {
    return saida;
  }
  const documento = saida as Record<string, unknown>;

  for (const { nivel, chave } of alvos) {
    if (nivel === "raiz") {
      removerNull(documento, chave);
    }
  }

  const nos = documento.nos;
  if (Array.isArray(nos)) {
    for (const no of nos) {
      if (no !== null && typeof no === "object" && !Array.isArray(no)) {
        for (const { nivel, chave } of alvos) {
          if (nivel === "nos") {
            removerNull(no as Record<string, unknown>, chave);
          }
        }
      }
    }
  }

  const cenas = documento.cenas;
  if (Array.isArray(cenas)) {
    for (const cena of cenas) {
      if (cena !== null && typeof cena === "object" && !Array.isArray(cena)) {
        for (const { nivel, chave } of alvos) {
          if (nivel === "cenas") {
            removerNull(cena as Record<string, unknown>, chave);
          }
        }
      }
    }
  }

  return saida;
}
