// =============================================================================
// PNG minimo — codificador e decodificador para os oraculos de pixel
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// Este arquivo existe para o oraculo de conteudo do quadro composto (AB-344,
// AB-390): o gate precisa contar cores e alfa DENTRO de regioes do PNG que o
// render de verdade produziu. Nenhuma dependencia externa: so `node:zlib`
// (deflate/inflate) e aritmetica de CRC32.
//
// O que ele sabe fazer, e nada mais:
//   - `escreverPng`  — PNG RGBA (tipo de cor 6) ou RGB (tipo de cor 2),
//                      8 bits, filtro 0 em toda scanline. Deterministico:
//                      sem metadado, sem timestamp, sem texto.
//   - `lerPngRgba`   — decodifica qualquer PNG 8-bit dos tipos de cor 2, 3
//                      (paleta) e 6, com todos os filtros (0..4). Devolve
//                      RGBA de 8 bits por pixel. Tudo o mais e recusado.
//
// A assinatura dos arquivos gerados NAO tem nada alem dos chunks essenciais
// (IHDR, IDAT, IEND) — e por isso que o hash SHA-256 do arquivo e estavel
// entre execucoes: quem regenerar o asset e conferir que o hash nao mudou e o
// proprio gate (C7 — endereco por conteudo, nunca por caminho).
// =============================================================================

import { deflateSync, inflateSync } from "node:zlib";

// ---------------------------------------------------------------------------
// CRC32 (IEEE) — obrigatorio em todo chunk PNG
// ---------------------------------------------------------------------------

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = TABELA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Um chunk PNG: tipo (4 bytes ASCII) + dados + CRC do tipo e dados. */
function chunk(tipo: string, dados: Uint8Array): Buffer {
  const corpo = Buffer.concat([
    Buffer.from(tipo, "ascii"),
    Buffer.from(dados),
  ]);
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tamanho, corpo, crc]);
}

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------------------
// Codificador — RGBA (canais 4) ou RGB (canais 3), 8 bits, filtro 0
// ---------------------------------------------------------------------------

/**
 * Escreve um PNG 8-bit. `canais` e 4 (RGBA) ou 3 (RGB); `dados` tem
 * largura * altura * canais bytes.
 */
export function escreverPng(
  largura: number,
  altura: number,
  canais: 3 | 4,
  dados: Uint8Array,
): Buffer {
  if (largura <= 0 || altura <= 0) {
    throw new Error(`escreverPng: dimensoes invalidas (${largura}x${altura})`);
  }
  const esperado = largura * altura * canais;
  if (dados.length !== esperado) {
    throw new Error(
      `escreverPng: ${String(dados.length)} bytes para ${String(esperado)} ` +
        `(${String(largura)}x${String(altura)}x${String(canais)})`,
    );
  }

  const tipoDeCor = canais === 4 ? 6 : 2;
  const bytesPorPixel = canais;

  // Filtro 0 (None) em toda scanline: sem filtragem, deterministico.
  const cru = Buffer.alloc(altura * (1 + largura * bytesPorPixel));
  for (let y = 0; y < altura; y++) {
    cru[y * (1 + largura * bytesPorPixel)] = 0;
    Buffer.from(
      dados.buffer,
      dados.byteOffset + y * largura * bytesPorPixel,
      largura * bytesPorPixel,
    ).copy(cru, y * (1 + largura * bytesPorPixel) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // profundidade de bits
  ihdr[9] = tipoDeCor;
  ihdr[10] = 0; // compressao
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // interlace: nenhum

  return Buffer.concat([
    ASSINATURA,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(cru, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Decodificador — 8 bits, tipos de cor 2 (RGB), 3 (paleta) e 6 (RGBA)
// ---------------------------------------------------------------------------

export interface PngDecodificado {
  largura: number;
  altura: number;
  /** RGBA de 8 bits, largura * altura * 4 bytes. */
  rgba: Uint8Array;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Desfaz os filtros PNG (0..4) linha a linha, devolvendo os bytes crus. */
function desfiltrar(
  largura: number,
  altura: number,
  bytesPorPixel: number,
  cru: Buffer,
): Uint8Array {
  const stride = 1 + largura * bytesPorPixel;
  const saida = new Uint8Array(largura * altura * bytesPorPixel);
  const linhaAnterior = new Uint8Array(largura * bytesPorPixel);

  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * stride]!;
    const linha = cru.subarray(y * stride + 1, (y + 1) * stride);
    const atual = new Uint8Array(largura * bytesPorPixel);

    for (let x = 0; x < largura * bytesPorPixel; x++) {
      const esquerda = x >= bytesPorPixel ? atual[x - bytesPorPixel]! : 0;
      const acima = linhaAnterior[x]!;
      const acimaEsquerda =
        x >= bytesPorPixel ? linhaAnterior[x - bytesPorPixel]! : 0;
      const cruValor = linha[x]!;

      let valor: number;
      switch (filtro) {
        case 0:
          valor = cruValor;
          break;
        case 1:
          valor = (cruValor + esquerda) & 0xff;
          break;
        case 2:
          valor = (cruValor + acima) & 0xff;
          break;
        case 3:
          valor = (cruValor + (esquerda + acima) >> 1) & 0xff;
          break;
        case 4:
          valor = (cruValor + paeth(esquerda, acima, acimaEsquerda)) & 0xff;
          break;
        default:
          throw new Error(`desfiltrar: filtro PNG desconhecido ${String(filtro)}`);
      }
      atual[x] = valor;
    }

    saida.set(atual, y * largura * bytesPorPixel);
    linhaAnterior.set(atual);
  }

  return saida;
}

/**
 * Decodifica um PNG 8-bit para RGBA.
 * Recusa: profundidade != 8, tipo de cor != 2/3/6, interlace != 0.
 */
export function lerPngRgba(arquivo: Buffer): PngDecodificado {
  if (arquivo.length < 33 || !arquivo.subarray(0, 8).equals(ASSINATURA)) {
    throw new Error("lerPngRgba: nao e um PNG");
  }

  let pos = 8;
  let largura = 0;
  let altura = 0;
  let tipoDeCor = 0;
  let profundidade = 0;
  let interlace = 0;
  const idats: Buffer[] = [];
  let paleta: Uint8Array | null = null;
  let viIhdr = false;

  while (pos < arquivo.length) {
    if (pos + 8 > arquivo.length) {
      throw new Error("lerPngRgba: arquivo truncado");
    }
    const tamanho = arquivo.readUInt32BE(pos);
    const tipo = arquivo.toString("ascii", pos + 4, pos + 8);
    const dados = arquivo.subarray(pos + 8, pos + 8 + tamanho);
    if (pos + 12 + tamanho > arquivo.length) {
      throw new Error("lerPngRgba: chunk truncado");
    }

    if (tipo === "IHDR") {
      if (dados.length !== 13) throw new Error("lerPngRgba: IHDR invalido");
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      profundidade = dados[8]!;
      tipoDeCor = dados[9]!;
      interlace = dados[12]!;
      viIhdr = true;
    } else if (tipo === "PLTE") {
      paleta = new Uint8Array(dados);
    } else if (tipo === "IDAT") {
      idats.push(Buffer.from(dados));
    }
    // tRNS e ignorado de proposito: o oraculo de alfa deste card usa
    // tipos de cor 6 (RGBA real) e 2 (RGB opaco).

    pos += 12 + tamanho;
  }

  if (!viIhdr) throw new Error("lerPngRgba: sem IHDR");
  if (profundidade !== 8) {
    throw new Error(`lerPngRgba: profundidade ${String(profundidade)} != 8`);
  }
  if (interlace !== 0) {
    throw new Error("lerPngRgba: interlace nao suportado");
  }

  const cru = inflateSync(Buffer.concat(idats));

  let bytesPorPixel: number;
  if (tipoDeCor === 6) {
    bytesPorPixel = 4;
  } else if (tipoDeCor === 2) {
    bytesPorPixel = 3;
  } else if (tipoDeCor === 3) {
    bytesPorPixel = 1;
  } else {
    throw new Error(
      `lerPngRgba: tipo de cor ${String(tipoDeCor)} nao suportado (2, 3, 6)`,
    );
  }

  const cruEsperado = altura * (1 + largura * bytesPorPixel);
  if (cru.length !== cruEsperado) {
    throw new Error(
      `lerPngRgba: dados de ${String(cru.length)} bytes, esperado ` +
        `${String(cruEsperado)} para ${String(largura)}x${String(altura)}`,
    );
  }

  const desfiltrado = desfiltrar(largura, altura, bytesPorPixel, cru);
  const rgba = new Uint8Array(largura * altura * 4);

  for (let i = 0; i < largura * altura; i++) {
    if (tipoDeCor === 6) {
      rgba[i * 4] = desfiltrado[i * 4]!;
      rgba[i * 4 + 1] = desfiltrado[i * 4 + 1]!;
      rgba[i * 4 + 2] = desfiltrado[i * 4 + 2]!;
      rgba[i * 4 + 3] = desfiltrado[i * 4 + 3]!;
    } else if (tipoDeCor === 2) {
      rgba[i * 4] = desfiltrado[i * 3]!;
      rgba[i * 4 + 1] = desfiltrado[i * 3 + 1]!;
      rgba[i * 4 + 2] = desfiltrado[i * 3 + 2]!;
      rgba[i * 4 + 3] = 255;
    } else {
      const indice = desfiltrado[i]!;
      if (paleta === null) throw new Error("lerPngRgba: tipo 3 sem PLTE");
      rgba[i * 4] = paleta[indice * 3]!;
      rgba[i * 4 + 1] = paleta[indice * 3 + 1]!;
      rgba[i * 4 + 2] = paleta[indice * 3 + 2]!;
      rgba[i * 4 + 3] = 255;
    }
  }

  return { largura, altura, rgba };
}

// ---------------------------------------------------------------------------
// Medicao — o que os oraculos contam
// ---------------------------------------------------------------------------

export interface MedidaDeRegiao {
  /** Cores RGB distintas na regiao. */
  coresDistintas: number;
  /** Fracao de pixels da cor mais comum na regiao (0..1). */
  fracaoDaCorDominante: number;
  /** Cor dominante em #rrggbb. */
  corDominante: string;
  /** Quantos pixels da regiao tem exatamente `cor`. */
  contar(cor: string): number;
}

function corDePixel(rgba: Uint8Array, largura: number, i: number): string {
  const r = rgba[i * 4]!;
  const g = rgba[i * 4 + 1]!;
  const b = rgba[i * 4 + 2]!;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Normaliza uma cor para comparacao: minuscula, 6 digitos.
 * Os tokens de src/design/tokens.ts sao maiusculos ("#3B82F6"); o
 * contador emite minusculo. Comparar o bruto seria acusar ausencia de
 * uma cor que esta na tela — falso vermelho (que custa tanto quanto o
 * falso verde).
 */
export function normalizarCor(cor: string): string {
  return cor.toLowerCase();
}

/**
 * Mede uma regiao retangular do quadro decodificado.
 * Regiao fora do quadro e recusada — medir fora da tela esconderia o
 * retangulo opaco que o oraculo existe para pegar.
 */
export function medirRegiao(
  png: PngDecodificado,
  x: number,
  y: number,
  largura: number,
  altura: number,
): MedidaDeRegiao {
  if (x < 0 || y < 0 || x + largura > png.largura || y + altura > png.altura) {
    throw new Error(
      `medirRegiao: regiao [${String(x)},${String(y)},${String(largura)},` +
        `${String(altura)}] fora do quadro ${String(png.largura)}x${String(png.altura)}`,
    );
  }

  const contagens = new Map<string, number>();
  let total = 0;
  for (let py = y; py < y + altura; py++) {
    for (let px = x; px < x + largura; px++) {
      const i = py * png.largura + px;
      const cor = corDePixel(png.rgba, png.largura, i);
      contagens.set(cor, (contagens.get(cor) ?? 0) + 1);
      total++;
    }
  }

  let dominante = "";
  let maior = 0;
  for (const [cor, n] of contagens) {
    if (n > maior) {
      maior = n;
      dominante = cor;
    }
  }

  return {
    coresDistintas: contagens.size,
    fracaoDaCorDominante: total > 0 ? maior / total : 0,
    corDominante: dominante,
    contar(cor: string): number {
      return contagens.get(normalizarCor(cor)) ?? 0;
    },
  };
}

/** Mede o quadro inteiro. */
export function medirQuadro(png: PngDecodificado): MedidaDeRegiao {
  return medirRegiao(png, 0, 0, png.largura, png.altura);
}
