/**
 * src/autoria/reparo/reparador-mecanico.ts
 *
 * O reparador DETERMINISTICO de FORMA (F4-03, W6) — default de
 * repararAutoria.
 *
 * Contrato-w6 §3: o reparo pode tocar, e so isso, cinco categorias:
 * espaco, escape, case de enum do vocabulario fechado, ordem e duplicata.
 * Este modulo implementa exatamente essas cinco, cada uma GATEADA pelo
 * escopo do pedido (a simplificacao progressiva reduz o escopo do pedido
 * de reparo — formato do prompt, nunca do documento).
 *
 * Por construcao ele nunca toca: conteudo de texto (nao inventa palavra),
 * hash (AB-432 — advisory, nao e tocado), duracao/layout/cor/licenca
 * (nao existem no Autoria.1; a ponte e AB-550, fronteira de resolucao).
 * Um reparo que "resolve" semantica seria o LLM decidindo duas vezes —
 * aqui a SEMANTICA nunca e resolvida: reparador mecanico so normaliza
 * forma, e a camada (reparar.ts) rejeita antes de qualquer chamada.
 *
 * Um reparador de chamada LLM (F4-04/F5-07) pode ser INJETADO na mesma
 * assinatura (documento, pedido) => documento; a camada o protege com
 * revalidacao e reclassificacao a cada tentativa.
 */

import { VOCABULARIO_TRANSICAO } from "../contrato/contrato.js";
import type { PedidoReparo } from "./reparar.js";
import {
  CAMPOS_OPCIONAIS_STRING,
  CAMPOS_STRING_COM_MINLENGTH,
  DEF_POR_SCHEMA,
  ORDEM_DADO_GRAFICO,
  ORDEM_DEFS,
  ORDEM_DOCUMENTO,
  TIPOS_DE_NO,
  TIPO_GRAFICO_ENUM,
  TIPO_MIDIA_ENUM,
} from "./derivar.js";

export function reparadorMecanico(documento: unknown, pedido: PedidoReparo): unknown {
  let atual = documento;
  // Ordem dos passos: decodificar primeiro (escape), depois limpar espaco
  // (o que o escape revelou), case sobre valores ja limpos, ordem, duplicata.
  if (pedido.escopo.escape) atual = decodificarEscapes(atual);
  if (pedido.escopo.espaco) atual = limparEspacos(atual);
  if (pedido.escopo.case) atual = corrigirCase(atual);
  if (pedido.escopo.ordem) atual = ordenarCampos(atual);
  if (pedido.escopo.duplicata) atual = removerDuplicatas(atual);
  return atual;
}

// ─── Caminhada generica (pos-ordem: filhos primeiro, depois o proprio) ──────

interface Ganchos {
  aoTexto?: (texto: string, campo: string, caminho: string[]) => string;
  aoObjeto?: (obj: Record<string, unknown>, caminho: string[]) => Record<string, unknown>;
  aoArray?: (arr: unknown[], caminho: string[]) => unknown[];
}

function ultimo(caminho: string[]): string | undefined {
  return caminho.at(-1);
}

function transformar(valor: unknown, caminho: string[], g: Ganchos): unknown {
  if (Array.isArray(valor)) {
    const itens = valor.map((item, i) => transformar(item, [...caminho, String(i)], g));
    return g.aoArray ? g.aoArray(itens, caminho) : itens;
  }
  if (valor !== null && typeof valor === "object") {
    const obj: Record<string, unknown> = {};
    for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
      obj[chave] = transformar(item, [...caminho, chave], g);
    }
    return g.aoObjeto ? g.aoObjeto(obj, caminho) : obj;
  }
  if (typeof valor === "string") {
    return g.aoTexto ? g.aoTexto(valor, ultimo(caminho) ?? "", caminho) : valor;
  }
  return valor;
}

// ─── 1. escape: decodifica sequencia de escape em campo textual ────────────

/**
 * Decodifica as sequencias de escape literal \n \t \r \\ \" em campos
 * textuais. O caso classico: o LLM escapa quebra de linha no codigo
 * ("replicas: 3\\nimage: ..." no texto parseado). Nunca toca `id` nem
 * `hash` (endereco por conteudo — AB-432).
 */
function decodificarEscapes(documento: unknown): unknown {
  return transformar(documento, [], {
    aoTexto: (texto, campo) => {
      if (campo === "id" || campo === "hash") return texto;
      return texto.replace(/\\([nrt\\"])/g, (_, c: string) => {
        switch (c) {
          case "n": return "\n";
          case "t": return "\t";
          case "r": return "\r";
          case "\\": return "\\";
          default: return '"';
        }
      });
    },
  });
}

// ─── 2. espaco: brancos e quebra de linha em campo textual ─────────────────

/**
 * Trim de brancos e normalizacao de \r\n -> \n em campo textual, e
 * remocao do que ficou VAZIO e era removivel (campo opcional e item de
 * lista).
 *
 * Conservador por construcao: campo com minLength no schema (texto,
 * codigo, rotulo, texto_locucao, trilha_sonora, ...) NAO e aparado ate a
 * string vazia — uma string so com brancos era VALIDA no schema, e
 * esvazia-la tornaria o documento invalido sem que o reparo possa
 * inventar conteudo (inventar texto e semantico). Campo obrigatorio
 * vazio fica como esta e a camada rejeita no fim.
 *
 * Nunca toca `hash` (AB-432 — endereco por conteudo, resolvido a
 * jusante). Ids e referencias sao aparados consistentemente (id e ref
 * com o mesmo branco casam depois do trim).
 */
function limparEspacos(documento: unknown): unknown {
  return transformar(documento, [], {
    aoTexto: (texto, campo, caminho) => {
      if (campo === "hash") return texto;
      const aparado = texto.replace(/\r\n/g, "\n").trim();
      if (aparado === "" && CAMPOS_STRING_COM_MINLENGTH.has(campo)) {
        // Posicoes removiveis (campo opcional, item de lista) viram ""
        // e sao removidas nos hooks abaixo; as demais preservam o
        // original.
        if (CAMPOS_OPCIONAIS_STRING.has(campo)) return aparado;
        const pai = caminho.length >= 2 ? caminho[caminho.length - 2] : undefined;
        if (pai === "itens") return aparado;
        return texto;
      }
      return aparado;
    },
    aoArray: (arr, caminho) => {
      if (ultimo(caminho) === "itens") {
        return arr.filter((item) => item !== "");
      }
      return arr;
    },
    aoObjeto: (obj) => {
      const saida = { ...obj };
      for (const campo of CAMPOS_OPCIONAIS_STRING) {
        if (saida[campo] === "") delete saida[campo];
      }
      return saida;
    },
  });
}

// ─── 3. case: enum do vocabulario fechado, so case ─────────────────────────

/**
 * Corrige CASE de enum do vocabulario fechado (Fade -> fade, Imagem ->
 * imagem, Barras -> barras). So reescreve quando o valor (ja sem espaco)
 * casa o vocabulario ignorando case — qualquer outro valor fica intato:
 * a classificacao o teria marcado irreparavel antes desta chamada.
 */
function corrigirCase(documento: unknown): unknown {
  return transformar(documento, [], {
    aoObjeto: (obj) => {
      const saida = { ...obj };
      if (typeof saida.type === "string") {
        const tipo = saida.type;
        const canonico = [...TIPOS_DE_NO].find(
          (t) => t.toLowerCase() === tipo.trim().toLowerCase(),
        );
        if (canonico !== undefined) saida.type = canonico;
      }
      if (typeof saida.tipo === "string") {
        const tipo = saida.tipo;
        const canonico = VOCABULARIO_TRANSICAO.find(
          (v) => v.toLowerCase() === tipo.trim().toLowerCase(),
        );
        if (canonico !== undefined) saida.tipo = canonico;
      }
      if (typeof saida.tipo_midia === "string") {
        const tipoMidia = saida.tipo_midia;
        const canonico = TIPO_MIDIA_ENUM.find(
          (v) => v.toLowerCase() === tipoMidia.trim().toLowerCase(),
        );
        if (canonico !== undefined) saida.tipo_midia = canonico;
      }
      if (typeof saida.tipo_grafico === "string") {
        const tipoGrafico = saida.tipo_grafico;
        const canonico = TIPO_GRAFICO_ENUM.find(
          (v) => v.toLowerCase() === tipoGrafico.trim().toLowerCase(),
        );
        if (canonico !== undefined) saida.tipo_grafico = canonico;
      }
      return saida;
    },
  });
}

// ─── 4. ordem: ordem canonica de campos por def ────────────────────────────

/** Ordem canonica (required primeiro, ordem de declaracao no schema). */
function defDoObjeto(obj: Record<string, unknown>, caminho: string[]): string | undefined {
  if (caminho.length === 0) return "Documento";
  if (typeof obj.schema === "string" && DEF_POR_SCHEMA[obj.schema] !== undefined) {
    return DEF_POR_SCHEMA[obj.schema];
  }
  if ("trilha_sonora" in obj) return "Audio";
  if ("texto_locucao" in obj) return "AudioCena";
  if ("tipo" in obj) return "Transicao";
  if ("rotulo" in obj && "valor" in obj) return "DadoGrafico";
  if ("nos" in obj && "id" in obj) return "Cena";
  return undefined;
}

function ordemDe(obj: Record<string, unknown>, caminho: string[]): readonly string[] | undefined {
  if (caminho.length === 0) return ORDEM_DOCUMENTO;
  const def = defDoObjeto(obj, caminho);
  if (def === "DadoGrafico") return ORDEM_DADO_GRAFICO;
  if (def !== undefined && def in ORDEM_DEFS) return ORDEM_DEFS[def];
  return undefined;
}

function ordenarCampos(documento: unknown): unknown {
  return transformar(documento, [], {
    aoObjeto: (obj, caminho) => {
      const ordem = ordemDe(obj, caminho);
      const saida: Record<string, unknown> = {};
      if (ordem !== undefined) {
        for (const chave of ordem) {
          if (chave in obj) saida[chave] = obj[chave];
        }
      }
      const restantes = Object.keys(obj)
        .filter((chave) => ordem === undefined || !ordem.includes(chave))
        .sort();
      for (const chave of restantes) saida[chave] = obj[chave];
      return saida;
    },
  });
}

// ─── 5. duplicata: id de no/cena repetido, referencia repetida ─────────────

/**
 * Id duplicado (no ou cena): mantem a PRIMEIRA ocorrencia, descarta as
 * seguintes — normalizacao deterministica (a ordem narrativa e decisao
 * do LLM; o primeiro e a ocorrencia original). Referencia repetida em
 * cena.nos: deduplicada. Nenhum conteudo e inventado nem reordenado.
 */
function removerDuplicatas(documento: unknown): unknown {
  if (documento === null || typeof documento !== "object" || Array.isArray(documento)) {
    return documento;
  }
  const copia = structuredClone(documento) as Record<string, unknown>;

  const idsDeNos = new Set<string>();
  if (Array.isArray(copia.nos)) {
    copia.nos = (copia.nos as unknown[]).filter((no) => {
      if (no !== null && typeof no === "object" && typeof (no as Record<string, unknown>).id === "string") {
        const id = (no as Record<string, unknown>).id as string;
        if (idsDeNos.has(id)) return false;
        idsDeNos.add(id);
      }
      return true;
    });
  }

  const idsDeCenas = new Set<string>();
  if (Array.isArray(copia.cenas)) {
    copia.cenas = (copia.cenas as unknown[]).filter((cena) => {
      if (cena !== null && typeof cena === "object" && typeof (cena as Record<string, unknown>).id === "string") {
        const id = (cena as Record<string, unknown>).id as string;
        if (idsDeCenas.has(id)) return false;
        idsDeCenas.add(id);
      }
      return true;
    });
    for (const cena of copia.cenas as Record<string, unknown>[]) {
      if (Array.isArray(cena.nos)) {
        const refs = new Set<string>();
        cena.nos = (cena.nos as unknown[]).filter((ref) => {
          if (typeof ref === "string") {
            if (refs.has(ref)) return false;
            refs.add(ref);
          }
          return true;
        });
      }
    }
  }

  return copia;
}
