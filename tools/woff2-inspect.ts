// =============================================================================
// woff2-inspect — leitor minimo de WOFF2 (sem dependencia nova)
// =============================================================================
// Card: F1-03 — fontes locais embutidas.
//
// Por que existe: a ficha de licenca de uma fonte declara o direito de embutir.
// Uma declaracao em Markdown que ninguem executa nao vale nada — ela envelhece
// junto com o arquivo que descreve. Este leitor abre o .woff2 e le, do proprio
// binario:
//
//   - name ID 1 / ID 2  -> a familia e o estilo que o arquivo diz ser
//   - OS/2.fsType       -> o bit de PERMISSAO DE EMBUTIR (0x0000 = liberado)
//   - OS/2.usWeightClass-> o peso real, nao o peso que o CSS pediu
//   - post.italicAngle  -> o estilo real
//
// Assim "Inter, peso 700, normal, com direito de embutir" vira asserção, nao
// comentario.
//
// Formato: W3C WOFF File Format 2.0 — https://www.w3.org/TR/WOFF2/
// Tabelas sfnt: Microsoft OpenType spec (OS/2, name, head, post).
//
// Escopo deliberadamente pequeno: le apenas tabelas NAO transformadas
// (OS/2, name, head, post nunca sao transformadas na pratica). glyf/loca sao
// puladas — o leitor so precisa dos offsets delas para chegar nas outras.
// =============================================================================

import { brotliDecompressSync } from "node:zlib";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Constantes do formato
// ---------------------------------------------------------------------------

/** Assinatura 'wOF2' */
const ASSINATURA_WOFF2 = 0x774f4632;

/** Tamanho do cabecalho WOFF2 em bytes */
const TAMANHO_CABECALHO = 48;

/** Indice de tag "arbitraria" — o tag de 4 bytes vem logo depois do flags */
const TAG_ARBITRARIA = 63;

/**
 * Os 63 tags conhecidos, na ordem do indice (W3C WOFF2, "Known Table Tags").
 * A posicao no array E o indice codificado nos bits 0..5 do byte de flags.
 */
const TAGS_CONHECIDOS: readonly string[] = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post",
  "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar",
  "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop",
  "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Uma tabela sfnt localizada dentro do fluxo descomprimido */
interface TabelaWoff2 {
  tag: string;
  /** Offset dentro do fluxo descomprimido */
  offset: number;
  /** Comprimento armazenado (transformado, se houver transformacao) */
  comprimento: number;
  /** Se a tabela sofreu transformacao WOFF2 (nao e sfnt cru) */
  transformada: boolean;
}

/** O que o binario diz sobre si mesmo */
export interface FichaDoBinario {
  /** name ID 1 — familia tipografica */
  familia: string;
  /** name ID 2 — subfamilia (Regular, Bold, Italic...) */
  subfamilia: string;
  /** name ID 0 — aviso de copyright */
  copyright: string;
  /** name ID 5 — versao */
  versao: string;
  /** name ID 13 — descricao da licenca */
  licenca: string;
  /** OS/2.fsType — bits de permissao de EMBUTIR */
  fsType: number;
  /** OS/2.usWeightClass — o peso real do arquivo */
  usWeightClass: number;
  /** post.italicAngle — 0 significa estilo normal */
  italicAngle: number;
  /** head.unitsPerEm */
  unitsPerEm: number;
}

// ---------------------------------------------------------------------------
// Primitivas de leitura
// ---------------------------------------------------------------------------

/**
 * Le um UIntBase128 (W3C WOFF2 "Data Types").
 * Ate cinco bytes de sete bits; o bit mais significativo marca continuacao.
 */
function lerUIntBase128(buf: Buffer, pos: number): [valor: number, novaPos: number] {
  let acumulado = 0;
  let i = pos;
  const limiteDeBytes = 5;
  for (let n = 0; n < limiteDeBytes; n += 1) {
    const octeto = buf[i];
    if (octeto === undefined) {
      throw new Error(`woff2: UIntBase128 truncado na posicao ${pos}`);
    }
    i += 1;
    // Zero a esquerda e proibido pela spec (nao-canonico)
    if (n === 0 && octeto === 0x80) {
      throw new Error("woff2: UIntBase128 nao-canonico");
    }
    acumulado = acumulado * 128 + (octeto & 0x7f);
    if ((octeto & 0x80) === 0) {
      return [acumulado, i];
    }
  }
  throw new Error("woff2: UIntBase128 excede cinco bytes");
}

/**
 * Decodifica uma string da tabela name conforme a plataforma.
 * Windows (3) e Unicode (0) usam UTF-16BE; Macintosh (1) usa MacRoman,
 * aproximado aqui por latin1 (os nomes que lemos sao ASCII).
 */
function decodificarNome(bytes: Buffer, platformID: number): string {
  const PLATAFORMA_UNICODE = 0;
  const PLATAFORMA_WINDOWS = 3;
  if (platformID === PLATAFORMA_WINDOWS || platformID === PLATAFORMA_UNICODE) {
    return bufferUtf16BeParaString(bytes);
  }
  return bytes.toString("latin1");
}

/** UTF-16BE -> string (Node so tem utf16le nativo) */
function bufferUtf16BeParaString(bytes: Buffer): string {
  const trocado = Buffer.from(bytes);
  for (let i = 0; i + 1 < trocado.length; i += 2) {
    const a = trocado[i] as number;
    trocado[i] = trocado[i + 1] as number;
    trocado[i + 1] = a;
  }
  return trocado.toString("utf16le");
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/** Le o diretorio de tabelas e devolve o fluxo sfnt descomprimido */
function abrirWoff2(buf: Buffer): { tabelas: Map<string, TabelaWoff2>; fluxo: Buffer } {
  if (buf.length < TAMANHO_CABECALHO) {
    throw new Error("woff2: arquivo menor que o cabecalho");
  }
  if (buf.readUInt32BE(0) !== ASSINATURA_WOFF2) {
    throw new Error("woff2: assinatura wOF2 ausente");
  }

  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);

  let pos = TAMANHO_CABECALHO;
  const tabelas = new Map<string, TabelaWoff2>();
  let offsetNoFluxo = 0;

  for (let i = 0; i < numTables; i += 1) {
    const flags = buf[pos];
    if (flags === undefined) {
      throw new Error("woff2: diretorio de tabelas truncado");
    }
    pos += 1;

    const indiceDoTag = flags & 0x3f;
    const versaoDaTransformacao = (flags >> 6) & 0x03;

    let tag: string;
    if (indiceDoTag === TAG_ARBITRARIA) {
      tag = buf.subarray(pos, pos + 4).toString("latin1");
      pos += 4;
    } else {
      const conhecido = TAGS_CONHECIDOS[indiceDoTag];
      if (conhecido === undefined) {
        throw new Error(`woff2: indice de tag desconhecido ${indiceDoTag}`);
      }
      tag = conhecido;
    }

    const [origLength, posDepoisDoOrig] = lerUIntBase128(buf, pos);
    pos = posDepoisDoOrig;

    // Regra de transformacao (W3C WOFF2, "Table Directory Format"):
    //   glyf/loca -> transformada quando versao == 0 (versao 3 e o null transform)
    //   demais    -> transformada quando versao != 0
    const ehGlyfOuLoca = tag === "glyf" || tag === "loca";
    const transformada = ehGlyfOuLoca
      ? versaoDaTransformacao === 0
      : versaoDaTransformacao !== 0;

    let comprimento = origLength;
    if (transformada) {
      const [transformLength, posDepoisDoTransform] = lerUIntBase128(buf, pos);
      pos = posDepoisDoTransform;
      comprimento = transformLength;
    }

    tabelas.set(tag, { tag, offset: offsetNoFluxo, comprimento, transformada });
    offsetNoFluxo += comprimento;
  }

  const comprimido = buf.subarray(pos, pos + totalCompressedSize);
  const fluxo = brotliDecompressSync(comprimido);

  return { tabelas, fluxo };
}

/** Extrai uma tabela sfnt nao-transformada do fluxo */
function pegarTabela(
  tabelas: Map<string, TabelaWoff2>,
  fluxo: Buffer,
  tag: string,
): Buffer {
  const entrada = tabelas.get(tag);
  if (entrada === undefined) {
    throw new Error(`woff2: tabela '${tag}' ausente`);
  }
  if (entrada.transformada) {
    throw new Error(`woff2: tabela '${tag}' esta transformada; leitor nao suporta`);
  }
  const fim = entrada.offset + entrada.comprimento;
  if (fim > fluxo.length) {
    throw new Error(`woff2: tabela '${tag}' excede o fluxo descomprimido`);
  }
  return fluxo.subarray(entrada.offset, fim);
}

/** Le a tabela name e devolve um mapa nameID -> texto */
function lerTabelaName(name: Buffer): Map<number, string> {
  const count = name.readUInt16BE(2);
  const stringOffset = name.readUInt16BE(4);
  const inicioDosRegistros = 6;
  const tamanhoDoRegistro = 12;

  const preferencia = new Map<number, { texto: string; peso: number }>();

  for (let i = 0; i < count; i += 1) {
    const base = inicioDosRegistros + i * tamanhoDoRegistro;
    const platformID = name.readUInt16BE(base);
    const nameID = name.readUInt16BE(base + 6);
    const comprimento = name.readUInt16BE(base + 8);
    const offset = name.readUInt16BE(base + 10);

    const inicio = stringOffset + offset;
    const bytes = name.subarray(inicio, inicio + comprimento);
    if (bytes.length === 0) {
      continue;
    }
    const texto = decodificarNome(bytes, platformID);

    // Windows (3) tem precedencia sobre Mac (1) quando ambos existem
    const PLATAFORMA_WINDOWS = 3;
    const peso = platformID === PLATAFORMA_WINDOWS ? 2 : 1;
    const anterior = preferencia.get(nameID);
    if (anterior === undefined || peso > anterior.peso) {
      preferencia.set(nameID, { texto, peso });
    }
  }

  const saida = new Map<number, string>();
  for (const [nameID, { texto }] of preferencia) {
    saida.set(nameID, texto);
  }
  return saida;
}

/** Le um Fixed 16.16 com sinal */
function lerFixed(buf: Buffer, offset: number): number {
  return buf.readInt32BE(offset) / 65536;
}

/**
 * Abre um .woff2 e devolve o que o binario declara sobre si mesmo.
 * Lanca se o arquivo nao for um WOFF2 valido.
 */
export function inspecionarWoff2(caminho: string): FichaDoBinario {
  const buf = readFileSync(caminho);
  const { tabelas, fluxo } = abrirWoff2(buf);

  const name = lerTabelaName(pegarTabela(tabelas, fluxo, "name"));
  const os2 = pegarTabela(tabelas, fluxo, "OS/2");
  const head = pegarTabela(tabelas, fluxo, "head");
  const post = pegarTabela(tabelas, fluxo, "post");

  // Offsets fixos do OpenType:
  //   OS/2: usWeightClass em 4, fsType em 8
  //   head: unitsPerEm em 18
  //   post: italicAngle (Fixed) em 4
  return {
    familia: name.get(1) ?? "",
    subfamilia: name.get(2) ?? "",
    copyright: name.get(0) ?? "",
    versao: name.get(5) ?? "",
    licenca: name.get(13) ?? "",
    fsType: os2.readUInt16BE(8),
    usWeightClass: os2.readUInt16BE(4),
    italicAngle: lerFixed(post, 4),
    unitsPerEm: head.readUInt16BE(18),
  };
}

/**
 * fsType == 0 e o unico valor que significa "Installable Embedding":
 * nenhuma restricao de embutir. Qualquer bit ligado restringe.
 * Referencia: OpenType spec, OS/2 fsType.
 */
export const FSTYPE_EMBUTIR_LIVRE = 0;
