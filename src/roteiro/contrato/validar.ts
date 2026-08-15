/**
 * src/roteiro/contrato/validar.ts
 *
 * Validacao do dominio de roteiro contra o schema COMPLETO (draft 2020-12)
 * + checagens semanticas com REGRA NOMEADA. Imita o estilo de
 * `validarManifestoDaFixture` (src/pipeline/produzir.ts:457 — devolve
 * `problemas: string[]`) e de `rejeitar.ts` da autoria (erro nomeado).
 *
 * Ordem: schema primeiro (erros de forma, com o caminho JSON do campo),
 * semantica depois (so quando a forma passa — validar forma quebrada
 * produz ruido, nao diagnostico). FQ-C1: pedaco invalido e REJEITADO com
 * erro nomeado, nunca aceito em silencio — o consumidor chama
 * rejeitar.ts, que lanca ErroContratoRoteiro com estes problemas.
 */

import { readFileSync } from "node:fs";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import {
  CAMINHO_SCHEMA_PEDACO,
  CAMINHO_SCHEMA_ROTEIRO,
  PADRAO_ID_PEDACO,
  TOLERANCIA_DURACAO_TOTAL_SEGUNDOS,
  VERSAO_CONTRATO_GERADOR,
  VERSAO_CONTRATO_ROTEIRO,
  VERSAO_GERADOR,
  VOCABULARIO_ORIGEM_NARRACAO,
  VOCABULARIO_STATUS_NARRACAO,
  VOCABULARIO_TIPO_VISUAL,
} from "./contrato.js";
import type {
  BriefRoteiro,
  EdicaoPedaco,
  Pedaco,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
  Roteiro,
} from "./contrato.js";

export interface ResultadoValidacaoRoteiro {
  valido: boolean;
  problemas: string[];
}

// ─── Regras nomeadas (o nome aparece na mensagem de erro — FQ-C1) ─────────────

/** fala vazia exige narracao completamente vazia (sem fala = sem audio). */
export const REGRA_NARRACAO_FALA_VAZIA = "narracao-fala-vazia";
/** origem "nenhuma" exige status "vazio" e texto "". */
export const REGRA_ORIGEM_NENHUMA = "origem-nenhuma-com-estado";
/** status "vazio" exige origem "nenhuma". */
export const REGRA_STATUS_VAZIO = "status-vazio-com-origem";
/** origem "gravacao" exige hash_audio (o wav 48k estéreo no store). */
export const REGRA_GRAVACAO_SEM_HASH = "gravacao-sem-hash";
/** hash_audio so existe com origem "gravacao" (TTS nao tem hash aqui). */
export const REGRA_HASH_SEM_GRAVACAO = "hash-sem-gravacao";
/** status "gerado" exige origem real (tts ou gravacao). */
export const REGRA_GERADO_SEM_ORIGEM = "gerado-sem-origem";
/** status "gerado" exige texto da narracao == fala (audio em dia). */
export const REGRA_GERADO_DESSINCRONIZADO = "gerado-dessincronizado";
/** status "editado" exige texto da narracao != fala (audio stale). */
export const REGRA_EDITADO_SINCRONIZADO = "editado-sincronizado";
/** tipo_visual gif/video exige anexo_hash, e vice-versa (C7). */
export const REGRA_ANEXO_VISUAL = "anexo-visual-incompativel";
/** indices contiguos 0..n-1 na ordem do array. */
export const REGRA_INDICES = "indices-nao-contiguos";
/** ids de pedaco unicos no roteiro. */
export const REGRA_IDS_DUPLICADOS = "ids-duplicados";
/** o sufixo numerico do id casa o indice (p-002 => indice 2). */
export const REGRA_ID_INDICE = "id-nao-casa-indice";
/** duracao_total_segundos == soma das duracoes (dentro de TOLERANCIA_DURACAO_TOTAL_SEGUNDOS). */
export const REGRA_DURACAO_TOTAL = "duracao-total-inconsistente";
/** as versoes do pedido precisam ser as do contrato corrente. */
export const REGRA_VERSAO = "versao-incompativel";

// ─── Validadores de schema (memoizados) ───────────────────────────────────────

const ajv = new Ajv2020({ allErrors: true, strict: false });

let validadores: { roteiro: ValidateFunction; pedaco: ValidateFunction } | undefined;

function obterValidadores(): { roteiro: ValidateFunction; pedaco: ValidateFunction } {
  if (validadores === undefined) {
    // Compilar o roteiro registra o schema sob o $id; o pedaco o
    // referencia por $ref absoluto (pedaco.schema.json nao duplica nada).
    // $ref nao resolvido e erro de COMPILACAO no Ajv — se o alias quebrar,
    // o teste FQ-C2 fica vermelho na hora, nunca em silencio.
    const schemaRoteiro = JSON.parse(readFileSync(CAMINHO_SCHEMA_ROTEIRO, "utf-8"));
    const fnRoteiro = ajv.compile(schemaRoteiro);
    const schemaPedaco = JSON.parse(readFileSync(CAMINHO_SCHEMA_PEDACO, "utf-8"));
    const fnPedaco = ajv.compile(schemaPedaco);
    validadores = { roteiro: fnRoteiro, pedaco: fnPedaco };
  }
  return validadores;
}

// Registro no CARREGAMENTO do modulo (side-effect do import): compilar
// roteiro.schema.json o registra no Ajv sob o $id, e o pedaco.schema.json
// (alias $ref) exige o roteiro resolvivel ja na compilacao. Sem isto,
// validarContraDefs compilava um envelope `{ $ref: ".../roteiro.schema.json
// #/$defs/<Nome>" }` contra um Ajv que ainda nao conhecia o schema quando
// chamado como PRIMEIRA validacao de um processo novo (validarBriefRoteiro,
// validarEdicaoPedaco, validarPedidoGerarRoteiro, validarPedidoRegenerarPedaco
// e validarProjetoRoteiro por composicao): lancava `can't resolve reference`
// em vez de devolver { valido: false } — o servidor da Onda 4 responderia
// 500 no lugar de 400 (FQ-C1). A memoizacao torna esta chamada um no-op
// barato para quem ja validou qualquer coisa antes (validarRoteiro/
// validarPedaco continuam identicos para chamadas subsequentes).
obterValidadores();

function errosDeSchema(fn: ValidateFunction, valor: unknown): string[] {
  if (fn(valor) === true) {
    return [];
  }
  return (fn.errors ?? []).map((e) => {
    const onde = e.instancePath === "" ? "(raiz)" : e.instancePath;
    const detalhe = e.params && "additionalProperty" in e.params
      ? ` ${String(e.params.additionalProperty)}`
      : "";
    return `${onde}: ${e.message ?? "invalido"}${detalhe}`;
  });
}

// ─── Semantica do pedaco (regras narracao-* e anexo) ──────────────────────────

function semanticaDoPedaco(pedaco: Pedaco, caminho: string): string[] {
  const problemas: string[] = [];
  const { fala, narracao, tipo_visual } = pedaco;

  if (fala === "") {
    if (narracao.origem !== "nenhuma" || narracao.status !== "vazio" || narracao.texto !== "") {
      problemas.push(
        `${caminho}.narracao: regra ${REGRA_NARRACAO_FALA_VAZIA} — ` +
          `fala vazia exige narracao {texto: "", origem: "nenhuma", status: "vazio"}`,
      );
    }
  } else {
    if (narracao.origem === "nenhuma") {
      if (narracao.status !== "vazio" || narracao.texto !== "") {
        problemas.push(
          `${caminho}.narracao: regra ${REGRA_ORIGEM_NENHUMA} — ` +
            `origem "nenhuma" exige status "vazio" e texto ""`,
        );
      }
    } else if (narracao.origem === "gravacao") {
      if (narracao.hash_audio === undefined) {
        problemas.push(
          `${caminho}.narracao: regra ${REGRA_GRAVACAO_SEM_HASH} — ` +
            `origem "gravacao" exige hash_audio (o sha256 do wav 48k estéreo)`,
        );
      }
    }
    if (narracao.hash_audio !== undefined && narracao.origem !== "gravacao") {
      problemas.push(
        `${caminho}.narracao: regra ${REGRA_HASH_SEM_GRAVACAO} — ` +
          `hash_audio so existe com origem "gravacao" (audio de tts nao tem hash aqui)`,
      );
    }
    if (narracao.status === "vazio" && narracao.origem !== "nenhuma") {
      problemas.push(
        `${caminho}.narracao: regra ${REGRA_STATUS_VAZIO} — ` +
          `status "vazio" exige origem "nenhuma"`,
      );
    }
    if (narracao.status === "gerado") {
      if (narracao.origem === "nenhuma") {
        problemas.push(
          `${caminho}.narracao: regra ${REGRA_GERADO_SEM_ORIGEM} — ` +
            `status "gerado" exige origem "tts" ou "gravacao"`,
        );
      }
      if (narracao.texto !== fala) {
        problemas.push(
          `${caminho}.narracao: regra ${REGRA_GERADO_DESSINCRONIZADO} — ` +
            `status "gerado" exige narracao.texto == fala (o audio corresponde ` +
            `ao texto de que foi gerado; texto divergente e status "editado")`,
        );
      }
    }
    if (narracao.status === "editado" && narracao.texto === fala) {
      problemas.push(
        `${caminho}.narracao: regra ${REGRA_EDITADO_SINCRONIZADO} — ` +
          `status "editado" exige narracao.texto != fala (a fala mudou depois ` +
          `da geracao; texto igual e status "gerado")`,
      );
    }
  }

  const precisaAnexo = tipo_visual === "gif" || tipo_visual === "video";
  if (precisaAnexo && pedaco.anexo_hash === undefined) {
    problemas.push(
      `${caminho}: regra ${REGRA_ANEXO_VISUAL} — ` +
        `tipo_visual "${tipo_visual}" exige anexo_hash (o anexo do usuario, por conteudo C7)`,
    );
  }
  if (!precisaAnexo && pedaco.anexo_hash !== undefined) {
    problemas.push(
      `${caminho}: regra ${REGRA_ANEXO_VISUAL} — ` +
        `anexo_hash so existe com tipo_visual "gif" ou "video" (aqui: "${tipo_visual}")`,
    );
  }

  return problemas;
}

// ─── Semantica do roteiro ─────────────────────────────────────────────────────

function semanticaDoRoteiro(roteiro: Roteiro): string[] {
  const problemas: string[] = [];
  const pedacos = roteiro.pedacos;

  const vistos = new Set<string>();
  let soma = 0;
  for (let i = 0; i < pedacos.length; i++) {
    const pedaco = pedacos[i];
    if (pedaco === undefined) {
      // Nunca acontece (array denso), mas noUncheckedIndexedAccess exige o guard.
      continue;
    }
    const caminho = `pedacos[${i}]`;
    if (pedaco.indice !== i) {
      problemas.push(
        `${caminho}: regra ${REGRA_INDICES} — indice ${String(pedaco.indice)} ` +
          `esperado ${String(i)} (indices contiguos 0..n-1 na ordem do array)`,
      );
    }
    if (vistos.has(pedaco.id)) {
      problemas.push(`${caminho}: regra ${REGRA_IDS_DUPLICADOS} — id "${pedaco.id}" duplicado`);
    }
    vistos.add(pedaco.id);
    const sufixo = PADRAO_ID_PEDACO.exec(pedaco.id)?.[1];
    const indiceDoId = sufixo === undefined ? -1 : Number(sufixo);
    if (indiceDoId !== pedaco.indice) {
      problemas.push(
        `${caminho}: regra ${REGRA_ID_INDICE} — o sufixo do id "${pedaco.id}" ` +
          `nao casa o indice ${String(pedaco.indice)}`,
      );
    }
    soma += pedaco.duracao_segundos;
    problemas.push(...semanticaDoPedaco(pedaco, caminho));
  }

  const total = roteiro.duracao_total_segundos;
  if (Math.abs(total - soma) > TOLERANCIA_DURACAO_TOTAL_SEGUNDOS) {
    problemas.push(
      `(raiz): regra ${REGRA_DURACAO_TOTAL} — duracao_total_segundos ` +
        `${String(total)} diverge da soma das duracoes ${String(soma)} ` +
        `(tolerancia ${String(TOLERANCIA_DURACAO_TOTAL_SEGUNDOS)}s)`,
    );
  }

  return problemas;
}

// ─── API publica ──────────────────────────────────────────────────────────────

function resultado(problemas: string[]): ResultadoValidacaoRoteiro {
  return { valido: problemas.length === 0, problemas };
}

/** Valida um BriefRoteiro contra o schema (tema obrigatorio e nao vazio). */
export function validarBriefRoteiro(valor: unknown): ResultadoValidacaoRoteiro {
  return resultado(validarContraDefs(valor, "BriefRoteiro"));
}

/** Valida um Pedaco (schema + regras de narracao e anexo). */
export function validarPedaco(valor: unknown): ResultadoValidacaoRoteiro {
  const problemas = errosDeSchema(obterValidadores().pedaco, valor);
  if (problemas.length > 0) {
    return resultado(problemas);
  }
  return resultado(semanticaDoPedaco(valor as Pedaco, "(raiz)"));
}

/** Valida um Roteiro completo (schema + semantica). */
export function validarRoteiro(valor: unknown): ResultadoValidacaoRoteiro {
  const problemas = errosDeSchema(obterValidadores().roteiro, valor);
  if (problemas.length > 0) {
    return resultado(problemas);
  }
  return resultado(semanticaDoRoteiro(valor as Roteiro));
}

/** Valida um delta de edicao do usuario (EdicaoPedaco). */
export function validarEdicaoPedaco(valor: unknown): ResultadoValidacaoRoteiro {
  return resultado(validarContraDefs(valor, "EdicaoPedaco"));
}

/** Valida um PedidoGerarRoteiro (schema + versoes correntes). */
export function validarPedidoGerarRoteiro(valor: unknown): ResultadoValidacaoRoteiro {
  const defs = validarContraDefs(valor, "PedidoGerarRoteiro");
  const problemasTotais = [...defs];
  if (defs.length === 0) {
    problemasTotais.push(...versoesDoPedido(valor as PedidoGerarRoteiro));
  }
  return resultado(problemasTotais);
}

/** Valida um PedidoRegenerarPedaco (schema + versoes correntes + semantica do pedaco_atual). */
export function validarPedidoRegenerarPedaco(valor: unknown): ResultadoValidacaoRoteiro {
  const defs = validarContraDefs(valor, "PedidoRegenerarPedaco");
  const problemasTotais = [...defs];
  if (defs.length === 0) {
    const pedido = valor as PedidoRegenerarPedaco;
    problemasTotais.push(...versoesDoPedido(pedido));
    // O pedaco_atual (com edicoes aplicadas) tem de respeitar as regras
    // semanticas de narracao e anexo — o gerador nao pode receber um
    // pedaco que o proprio contrato rejeitaria (FQ-G4/FQ-C1).
    problemasTotais.push(...semanticaDoPedaco(pedido.pedaco_atual, "(raiz).pedaco_atual"));
  }
  return resultado(problemasTotais);
}

/** Valida um ProjetoRoteiro por composicao (sem schema proprio — o contrato
 *  de schema cobre brief/roteiro/edicao; este validador e a soma deles). */
export function validarProjetoRoteiro(valor: unknown): ResultadoValidacaoRoteiro {
  const problemas: string[] = [];
  if (valor === null || typeof valor !== "object" || Array.isArray(valor)) {
    return resultado(["(raiz): nao e um objeto de projeto"]);
  }
  const projeto = valor as Record<string, unknown>;
  if (typeof projeto.id !== "string" || projeto.id === "") {
    problemas.push("(raiz).id: regra id-vazio — id do projeto nao pode ser vazio");
  }
  for (const chave of ["criado_em", "atualizado_em"]) {
    const data = projeto[chave];
    if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(data)) {
      problemas.push(`(raiz).${chave}: data ISO-8601 invalida`);
    }
  }
  if (projeto.brief !== undefined) {
    problemas.push(...validarBriefRoteiro(projeto.brief).problemas.map((p) => `(raiz).brief: ${p}`));
  }
  if (projeto.roteiro !== undefined) {
    problemas.push(...validarRoteiro(projeto.roteiro).problemas.map((p) => `(raiz).roteiro: ${p}`));
  }
  const editados = projeto.pedacos_editados;
  if (editados !== undefined && editados !== null && typeof editados === "object" && !Array.isArray(editados)) {
    for (const [id, edicao] of Object.entries(editados as Record<string, unknown>)) {
      if (!PADRAO_ID_PEDACO.test(id)) {
        problemas.push(`(raiz).pedacos_editados["${id}"]: id fora do formato p-[0-9]{3}`);
      }
      const r = validarEdicaoPedaco(edicao);
      if (!r.valido) {
        problemas.push(
          `(raiz).pedacos_editados["${id}"]: ${r.problemas.join("; ")}`,
        );
      }
    }
  } else if (editados !== undefined) {
    problemas.push("(raiz).pedacos_editados: deve ser um objeto chaveado por id de pedaco");
  } else {
    problemas.push("(raiz).pedacos_editados: campo obrigatorio do projeto (vazio = {})");
  }
  return resultado(problemas);
}

// ─── Validacao contra um $defs do schema do roteiro ──────────────────────────

/**
 * Valida um valor contra um $defs de roteiro.schema.json usando o
 * compilador do schema do roteiro (registrado sob o $id). Como o Ajv nao
 * compila $defs isolados de graca, monta um envelope minimo
 * `{ "$ref": "<$id>#/$defs/<nome>" }` — a mesma tecnica do
 * pedaco.schema.json.
 */
const validadoresDeDefs = new Map<string, ValidateFunction>();

function validarContraDefs(valor: unknown, nome: string): string[] {
  let fn = validadoresDeDefs.get(nome);
  if (fn === undefined) {
    fn = ajv.compile({
      $id: `https://ai-video-maker/schema/defs-${nome}.json`,
      $ref: `https://ai-video-maker/schema/roteiro.schema.json#/$defs/${nome}`,
    });
    validadoresDeDefs.set(nome, fn);
  }
  return errosDeSchema(fn, valor);
}

function versoesDoPedido(pedido: PedidoGerarRoteiro | PedidoRegenerarPedaco): string[] {
  const problemas: string[] = [];
  const pares: Array<[string, string, string]> = [
    ["versao_contrato", pedido.versao_contrato, VERSAO_CONTRATO_ROTEIRO],
    ["versao_contrato_gerador", pedido.versao_contrato_gerador, VERSAO_CONTRATO_GERADOR],
    ["versao_gerador", pedido.versao_gerador, VERSAO_GERADOR],
  ];
  for (const [campo, valor, esperado] of pares) {
    if (valor !== esperado) {
      problemas.push(
        `(raiz).${campo}: regra ${REGRA_VERSAO} — "${String(valor)}" != "${esperado}" ` +
          `(o servidor preenche as versoes correntes do contrato)`,
      );
    }
  }
  return problemas;
}

// ─── Guards de vocabulario para os consumidores (sem depender do Ajv) ─────────

export function eTipoVisual(valor: string): valor is (typeof VOCABULARIO_TIPO_VISUAL)[number] {
  return (VOCABULARIO_TIPO_VISUAL as readonly string[]).includes(valor);
}

export function eOrigemNarracao(valor: string): valor is (typeof VOCABULARIO_ORIGEM_NARRACAO)[number] {
  return (VOCABULARIO_ORIGEM_NARRACAO as readonly string[]).includes(valor);
}

export function eStatusNarracao(valor: string): valor is (typeof VOCABULARIO_STATUS_NARRACAO)[number] {
  return (VOCABULARIO_STATUS_NARRACAO as readonly string[]).includes(valor);
}
