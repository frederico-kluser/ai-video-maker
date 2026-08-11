// =============================================================================
// LEITURA DA FAMILIA EFETIVAMENTE RESOLVIDA — F1-03
// =============================================================================
// Este arquivo roda DENTRO do navegador do render. Ele nao olha para pixel
// nenhum: ele interroga o subsistema de fontes do proprio navegador.
//
// O QUE ELE LE, E POR QUE ISSO NAO E COMPARAR IMAGENS
//
// 1. `document.fonts` e o FontFaceSet vivo do documento. Cada FontFace ali tem
//    `family`, `weight`, `style` e `status`. `status === "loaded"` so acontece
//    depois que o navegador BAIXOU E PARSEOU o arquivo. Um arquivo ausente,
//    corrompido ou com formato errado nunca chega em "loaded" — e loadFont()
//    ja teria derrubado o render antes disso.
//
// 2. Para cada elemento sonda, lemos `getComputedStyle(el).fontFamily`, que e a
//    pilha CSS que o elemento de fato herdou, e a percorremos NA ORDEM em que o
//    motor de matching de fonte a percorre. A primeira familia da pilha que tem
//    uma FontFace registrada e carregada e a familia que o motor usa.
//
// 3. Confirmamos com `document.fonts.check(shorthand, texto)`, passando o
//    shorthand computado do proprio elemento e o texto exato dele. Esse metodo
//    e o algoritmo de matching do navegador respondendo se a face casada esta
//    pronta para aquele texto. E a resposta do motor, nao a nossa opiniao.
//
// A diferenca em relacao a comparar pixels: comparar dois quadros so diz
// "ficou diferente", e duas fontes parecidas dao o mesmo resultado dos dois
// lados. Aqui o que sai e um NOME — "Inter", peso "700", estilo "normal",
// estado "loaded" — que a asserção compara com o que o token pediu.
//
// A sonda de controle (familia nunca registrada) existe para provar que esta
// leitura sabe dizer NAO. Sem ela, um leitor que respondesse "resolveu" para
// tudo passaria no gate (AGENTS.md, C2).
// =============================================================================

import { fontWeight } from "../tokens";
import type { SondaTipografica } from "./index";

// =============================================================================
// Tipos da evidencia
// =============================================================================

/** Uma FontFace como o navegador a registrou */
export interface FaceRegistrada {
  familia: string;
  peso: string;
  estilo: string;
  /** "unloaded" | "loading" | "loaded" | "error" */
  estado: string;
  intervaloUnicode: string;
}

/** O resultado da leitura para uma sonda */
export interface LeituraDeSonda {
  id: string;
  /** Pilha CSS computada no elemento */
  pilhaComputada: string;
  pesoComputado: string;
  estiloComputado: string;
  tamanhoComputado: string;
  /** Shorthand CSS montado a partir do computed style do elemento */
  shorthand: string;
  /** A familia que o motor de fontes resolve. null = nenhuma face registrada. */
  familiaResolvida: string | null;
  /** Estado da FontFace correspondente */
  estadoDaFace: string | null;
  /** Peso e estilo da FontFace correspondente */
  pesoDaFace: string | null;
  estiloDaFace: string | null;
  /** Resposta de document.fonts.check() para o shorthand e o texto do elemento */
  matchDoNavegador: boolean;
  /** Quantos nos da pilha foram descartados antes de achar a face */
  familiasDescartadas: string[];
}

/** Tudo que o render tem a dizer sobre fontes */
export interface EvidenciaDeFontes {
  /** Todas as faces registradas no documento */
  registro: FaceRegistrada[];
  /** Uma leitura por sonda */
  sondas: LeituraDeSonda[];
  /** URLs efetivamente usadas para carregar as fontes, como o navegador as ve */
  urlsDasFontes: string[];
  /** Origem da pagina do render — prova de que o serviço e local */
  origem: string;
  /** document.fonts.status no momento da coleta */
  estadoDoConjunto: string;
}

// =============================================================================
// Normalizacao
// =============================================================================

/** Remove aspas e espacos de um nome de familia vindo do CSS */
function limparNomeDeFamilia(nome: string): string {
  return nome.trim().replace(/^["']/, "").replace(/["']$/, "").trim();
}

/**
 * Traduz as palavras-chave de peso para numero.
 * getComputedStyle costuma devolver numero, mas FontFace.weight pode vir
 * como "normal" ou "bold" quando foi registrada assim.
 */
function normalizarPeso(peso: string): string {
  const p = peso.trim().toLowerCase();
  if (p === "normal") {
    return String(fontWeight.regular);
  }
  if (p === "bold") {
    return String(fontWeight.bold);
  }
  return p;
}

/** Estilo sem variacoes ("oblique 14deg" -> "oblique") */
function normalizarEstilo(estilo: string): string {
  return estilo.trim().toLowerCase().split(/\s+/)[0] ?? "normal";
}

// =============================================================================
// Leitura
// =============================================================================

/** Fotografa o FontFaceSet do documento */
export function lerRegistroDeFontes(): FaceRegistrada[] {
  const faces: FaceRegistrada[] = [];
  document.fonts.forEach((face) => {
    faces.push({
      familia: limparNomeDeFamilia(face.family),
      peso: face.weight,
      estilo: face.style,
      estado: face.status,
      intervaloUnicode: face.unicodeRange,
    });
  });
  faces.sort((a, b) =>
    `${a.familia} ${a.peso} ${a.estilo}`.localeCompare(
      `${b.familia} ${b.peso} ${b.estilo}`,
    ),
  );
  return faces;
}

/** Acha a FontFace registrada que casa familia + peso + estilo */
function acharFace(
  familia: string,
  peso: string,
  estilo: string,
): FontFace | null {
  let achada: FontFace | null = null;
  document.fonts.forEach((face) => {
    if (achada !== null) {
      return;
    }
    const mesmaFamilia = limparNomeDeFamilia(face.family) === familia;
    const mesmoPeso = normalizarPeso(face.weight) === normalizarPeso(peso);
    const mesmoEstilo = normalizarEstilo(face.style) === normalizarEstilo(estilo);
    if (mesmaFamilia && mesmoPeso && mesmoEstilo) {
      achada = face;
    }
  });
  return achada;
}

/**
 * Le a familia que o motor de fontes do navegador resolve para um elemento.
 *
 * Percorre a pilha CSS computada na ordem. A primeira familia com FontFace
 * registrada decide: se ela estiver "loaded", e essa a familia resolvida; se
 * estiver em qualquer outro estado, a leitura devolve esse estado e para —
 * porque nesse caso o elemento esta desenhando com fallback, que e exatamente
 * a falha que este card persegue.
 */
export function lerFamiliaResolvida(
  elemento: Element,
  sonda: SondaTipografica,
): LeituraDeSonda {
  const cs = getComputedStyle(elemento);
  const pilha = cs.fontFamily.split(",").map(limparNomeDeFamilia);
  const peso = cs.fontWeight;
  const estilo = cs.fontStyle;
  const tamanho = cs.fontSize;

  const descartadas: string[] = [];

  for (const familia of pilha) {
    const face = acharFace(familia, peso, estilo);
    if (face === null) {
      descartadas.push(familia);
      continue;
    }
    const shorthand = `${normalizarEstilo(estilo)} ${normalizarPeso(peso)} ${tamanho} "${familia}"`;
    const carregada = face.status === "loaded";
    return {
      id: sonda.id,
      pilhaComputada: cs.fontFamily,
      pesoComputado: peso,
      estiloComputado: estilo,
      tamanhoComputado: tamanho,
      shorthand,
      familiaResolvida: carregada ? familia : null,
      estadoDaFace: face.status,
      pesoDaFace: face.weight,
      estiloDaFace: face.style,
      matchDoNavegador: document.fonts.check(shorthand, sonda.texto),
      familiasDescartadas: descartadas,
    };
  }

  // Nenhuma familia da pilha tem face registrada: o elemento desenha com o que
  // o sistema oferecer. Para o projeto isso e fallback, e fallback e vermelho.
  const primeira = pilha[0] ?? "";
  const shorthand = `${normalizarEstilo(estilo)} ${normalizarPeso(peso)} ${tamanho} "${primeira}"`;
  return {
    id: sonda.id,
    pilhaComputada: cs.fontFamily,
    pesoComputado: peso,
    estiloComputado: estilo,
    tamanhoComputado: tamanho,
    shorthand,
    familiaResolvida: null,
    estadoDaFace: null,
    pesoDaFace: null,
    estiloDaFace: null,
    matchDoNavegador: false,
    familiasDescartadas: descartadas,
  };
}

/** Colhe a evidencia inteira. Chamado no navegador, antes do quadro sair. */
export function coletarEvidencia(
  sondas: readonly SondaTipografica[],
  urlsDasFontes: readonly string[],
): EvidenciaDeFontes {
  const leituras: LeituraDeSonda[] = [];
  for (const sonda of sondas) {
    const elemento = document.querySelector(`[data-sonda="${sonda.id}"]`);
    if (elemento === null) {
      throw new Error(
        `Sonda "${sonda.id}" nao esta no DOM. Sem elemento nao ha familia resolvida para ler.`,
      );
    }
    leituras.push(lerFamiliaResolvida(elemento, sonda));
  }
  return {
    registro: lerRegistroDeFontes(),
    sondas: leituras,
    urlsDasFontes: [...urlsDasFontes],
    origem: window.location.origin,
    estadoDoConjunto: document.fonts.status,
  };
}
