// =============================================================================
// DECODIFICADOR PNG MINIMO — para MEDIR o render, nao para olhar
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Por que decodificar em vez de comparar bytes: `cmp` responde "os arquivos
// diferem", e a pergunta do card e "ONDE eles diferem" — dentro da safe area
// ou fora dela. Sem pixel nao ha resposta, so opiniao sobre a imagem.
//
// Por que sem dependencia nova: o card nao pode tocar package.json (S-1,
// contrato da W4 §1). node:zlib basta — o PNG que sai do render do Remotion e
// 8 bits, sem entrelacamento, colorType 2 (RGB) ou 6 (RGBA).
//
// Este arquivo NAO vive em src/composicao/: ele le disco e comparacao de
// pixel nao e composicao. `just comp-pureza` so permite node:fs em
// src/composicao/descoberta.ts.
//
// O decodificador tem autoteste em tests/camadas/medicao.test.ts: ele
// decodifica PNGs sinteticos de valor conhecido, um por tipo de filtro. Um
// medidor sem autoteste e so mais uma ferramenta que mente (C1).
// =============================================================================

import { inflateSync } from "node:zlib";

/** Assinatura PNG: 89 50 4E 47 0D 0A 1A 0A */
export const ASSINATURA_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export interface ImagemRgba {
  largura: number;
  altura: number;
  /** RGBA, 4 bytes por pixel, linha a linha de cima para baixo. */
  dados: Uint8Array;
}

interface Cabecalho {
  largura: number;
  altura: number;
  profundidade: number;
  tipoDeCor: number;
  entrelacamento: number;
}

/** Canais por pixel de cada colorType do PNG que sabemos ler. */
const CANAIS_POR_TIPO: Record<number, number> = {
  0: 1, // escala de cinza
  2: 3, // RGB
  4: 2, // cinza + alfa
  6: 4, // RGBA
};

function lerCabecalho(png: Buffer): { cabecalho: Cabecalho; idat: Buffer } {
  if (png.length < ASSINATURA_PNG.length || !png.subarray(0, 8).equals(ASSINATURA_PNG)) {
    throw new Error("nao e um PNG: assinatura invalida");
  }

  let cabecalho: Cabecalho | null = null;
  const pedacosIdat: Buffer[] = [];
  let off = 8;

  while (off + 8 <= png.length) {
    const tamanho = png.readUInt32BE(off);
    const tipo = png.subarray(off + 4, off + 8).toString("ascii");
    const dados = png.subarray(off + 8, off + 8 + tamanho);

    if (tipo === "IHDR") {
      cabecalho = {
        largura: dados.readUInt32BE(0),
        altura: dados.readUInt32BE(4),
        profundidade: dados[8] ?? 0,
        tipoDeCor: dados[9] ?? 0,
        entrelacamento: dados[12] ?? 0,
      };
    } else if (tipo === "IDAT") {
      pedacosIdat.push(Buffer.from(dados));
    } else if (tipo === "IEND") {
      break;
    }

    off += 12 + tamanho;
  }

  if (!cabecalho) throw new Error("PNG sem IHDR");
  if (pedacosIdat.length === 0) throw new Error("PNG sem IDAT");
  if (cabecalho.profundidade !== 8) {
    throw new Error(
      `PNG com profundidade ${String(cabecalho.profundidade)} bits — este decodificador so le 8`,
    );
  }
  if (cabecalho.entrelacamento !== 0) {
    throw new Error("PNG entrelacado (Adam7) — este decodificador so le sequencial");
  }
  if (!(cabecalho.tipoDeCor in CANAIS_POR_TIPO)) {
    throw new Error(`PNG com colorType ${String(cabecalho.tipoDeCor)} nao suportado`);
  }

  return { cabecalho, idat: Buffer.concat(pedacosIdat) };
}

/** Preditor de Paeth (PNG spec, filtro tipo 4). */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decodifica um PNG para RGBA de 8 bits.
 *
 * Implementa os cinco filtros de linha do PNG (None, Sub, Up, Average,
 * Paeth). Um filtro desconhecido ESTOURA — nunca e tratado como None, que e
 * a forma classica de um decodificador devolver uma imagem plausivel e
 * errada.
 */
export function decodificarPng(png: Buffer): ImagemRgba {
  const { cabecalho, idat } = lerCabecalho(png);
  const canais = CANAIS_POR_TIPO[cabecalho.tipoDeCor] ?? 0;
  const bytesPorPixel = canais;
  const bytesPorLinha = cabecalho.largura * bytesPorPixel;

  const cru = inflateSync(idat);
  const esperado = (bytesPorLinha + 1) * cabecalho.altura;
  if (cru.length < esperado) {
    throw new Error(
      `IDAT descomprimido curto: ${String(cru.length)} bytes, esperado ${String(esperado)}`,
    );
  }

  const linhas = new Uint8Array(bytesPorLinha * cabecalho.altura);
  let origem = 0;

  for (let y = 0; y < cabecalho.altura; y++) {
    const filtro = cru[origem];
    origem += 1;
    const destino = y * bytesPorLinha;
    const anterior = destino - bytesPorLinha;

    for (let i = 0; i < bytesPorLinha; i++) {
      const bruto = cru[origem + i] ?? 0;
      const a = i >= bytesPorPixel ? (linhas[destino + i - bytesPorPixel] ?? 0) : 0;
      const b = y > 0 ? (linhas[anterior + i] ?? 0) : 0;
      const c =
        y > 0 && i >= bytesPorPixel ? (linhas[anterior + i - bytesPorPixel] ?? 0) : 0;

      let valor: number;
      switch (filtro) {
        case 0:
          valor = bruto;
          break;
        case 1:
          valor = bruto + a;
          break;
        case 2:
          valor = bruto + b;
          break;
        case 3:
          valor = bruto + ((a + b) >> 1);
          break;
        case 4:
          valor = bruto + paeth(a, b, c);
          break;
        default:
          throw new Error(
            `filtro PNG desconhecido (${String(filtro)}) na linha ${String(y)}`,
          );
      }
      linhas[destino + i] = valor & 0xff;
    }
    origem += bytesPorLinha;
  }

  // --- Normaliza para RGBA ---
  const dados = new Uint8Array(cabecalho.largura * cabecalho.altura * 4);
  for (let p = 0; p < cabecalho.largura * cabecalho.altura; p++) {
    const de = p * bytesPorPixel;
    const para = p * 4;
    switch (cabecalho.tipoDeCor) {
      case 0:
        dados[para] = dados[para + 1] = dados[para + 2] = linhas[de] ?? 0;
        dados[para + 3] = 0xff;
        break;
      case 2:
        dados[para] = linhas[de] ?? 0;
        dados[para + 1] = linhas[de + 1] ?? 0;
        dados[para + 2] = linhas[de + 2] ?? 0;
        dados[para + 3] = 0xff;
        break;
      case 4:
        dados[para] = dados[para + 1] = dados[para + 2] = linhas[de] ?? 0;
        dados[para + 3] = linhas[de + 1] ?? 0;
        break;
      default:
        dados[para] = linhas[de] ?? 0;
        dados[para + 1] = linhas[de + 1] ?? 0;
        dados[para + 2] = linhas[de + 2] ?? 0;
        dados[para + 3] = linhas[de + 3] ?? 0;
    }
  }

  return { largura: cabecalho.largura, altura: cabecalho.altura, dados };
}

/** Cor RGBA de um pixel, para mensagem de erro legivel. */
export function pixelEm(img: ImagemRgba, x: number, y: number): [number, number, number, number] {
  const i = (y * img.largura + x) * 4;
  return [
    img.dados[i] ?? 0,
    img.dados[i + 1] ?? 0,
    img.dados[i + 2] ?? 0,
    img.dados[i + 3] ?? 0,
  ];
}
