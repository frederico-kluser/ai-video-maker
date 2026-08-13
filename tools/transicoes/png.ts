// =============================================================================
// PNG — leitor minimo, para o gate poder olhar o PIXEL
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// AGENTS.md, C1: "`exit 0` de um render nao prova que saiu imagem. Quadro
// preto = sucesso." Sem decodificar o PNG, o gate so consegue afirmar que o
// arquivo existe e tem tamanho — que e exatamente o que um quadro vazio
// tambem tem.
//
// Suporta o que o Chrome do render produz: bit depth 8, cor RGB (tipo 2) ou
// RGBA (tipo 6), sem entrelacamento. Qualquer outra combinacao LANCA, em vez
// de devolver pixel errado em silencio.
//
// Fonte: https://www.w3.org/TR/png-3/ (2026-08-11) — §5 estrutura de chunk,
//        §9 filtros de linha (None, Sub, Up, Average, Paeth).
// =============================================================================

import { inflateSync } from "node:zlib";

/** Uma imagem decodificada: RGBA, 8 bits por canal, linha a linha. */
export interface Imagem {
  largura: number;
  altura: number;
  /** RGBA intercalado, tamanho = largura * altura * 4 */
  pixels: Uint8Array;
}

/** Um pixel RGBA. */
export interface Cor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decodifica um PNG. LANCA em qualquer formato que nao saiba ler. */
export function lerPng(bytes: Buffer): Imagem {
  if (bytes.length < ASSINATURA.length || !bytes.subarray(0, 8).equals(ASSINATURA)) {
    throw new Error("nao e um PNG (assinatura ausente)");
  }

  let offset = 8;
  let largura = 0;
  let altura = 0;
  let canais = 0;
  const partes: Buffer[] = [];

  while (offset + 8 <= bytes.length) {
    const tamanho = bytes.readUInt32BE(offset);
    const tipo = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const dados = bytes.subarray(offset + 8, offset + 8 + tamanho);
    offset += 12 + tamanho; // 4 tamanho + 4 tipo + dados + 4 CRC

    if (tipo === "IHDR") {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      const profundidade = dados.readUInt8(8);
      const tipoDeCor = dados.readUInt8(9);
      const entrelacado = dados.readUInt8(12);
      if (profundidade !== 8) {
        throw new Error(`profundidade ${String(profundidade)} nao suportada (esperado 8)`);
      }
      if (entrelacado !== 0) {
        throw new Error("PNG entrelacado nao suportado");
      }
      if (tipoDeCor === 2) canais = 3;
      else if (tipoDeCor === 6) canais = 4;
      else throw new Error(`tipo de cor ${String(tipoDeCor)} nao suportado (esperado 2 ou 6)`);
    } else if (tipo === "IDAT") {
      partes.push(Buffer.from(dados));
    } else if (tipo === "IEND") {
      break;
    }
  }

  if (largura === 0 || altura === 0 || canais === 0) {
    throw new Error("PNG sem IHDR utilizavel");
  }

  const cru = inflateSync(Buffer.concat(partes));
  const porLinha = largura * canais;
  const esperado = altura * (porLinha + 1);
  if (cru.length < esperado) {
    throw new Error(
      `dados insuficientes: ${String(cru.length)} bytes, esperado ${String(esperado)}`,
    );
  }

  const linhas = new Uint8Array(altura * porLinha);
  let origem = 0;

  for (let y = 0; y < altura; y++) {
    const filtro = cru[origem]!;
    origem += 1;
    const base = y * porLinha;
    const anterior = base - porLinha;

    for (let x = 0; x < porLinha; x++) {
      const bruto = cru[origem + x]!;
      const a = x >= canais ? linhas[base + x - canais]! : 0;
      const b = y > 0 ? linhas[anterior + x]! : 0;
      const c = y > 0 && x >= canais ? linhas[anterior + x - canais]! : 0;

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
          throw new Error(`filtro de linha ${String(filtro)} desconhecido`);
      }
      linhas[base + x] = valor & 0xff;
    }
    origem += porLinha;
  }

  // Normaliza para RGBA
  const pixels = new Uint8Array(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) {
    pixels[i * 4] = linhas[i * canais]!;
    pixels[i * 4 + 1] = linhas[i * canais + 1]!;
    pixels[i * 4 + 2] = linhas[i * canais + 2]!;
    pixels[i * 4 + 3] = canais === 4 ? linhas[i * canais + 3]! : 255;
  }

  return { largura, altura, pixels };
}

// ---------------------------------------------------------------------------
// Consultas de pixel
// ---------------------------------------------------------------------------

/** Cor do pixel em coordenadas RELATIVAS (0..1), para nao depender do tamanho. */
export function corRelativa(imagem: Imagem, fx: number, fy: number): Cor {
  const x = Math.min(imagem.largura - 1, Math.max(0, Math.round(fx * imagem.largura)));
  const y = Math.min(imagem.altura - 1, Math.max(0, Math.round(fy * imagem.altura)));
  const i = (y * imagem.largura + x) * 4;
  return {
    r: imagem.pixels[i]!,
    g: imagem.pixels[i + 1]!,
    b: imagem.pixels[i + 2]!,
    a: imagem.pixels[i + 3]!,
  };
}

/** Converte "#RRGGBB" em Cor opaca. */
export function corDeHex(hex: string): Cor {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: 255,
  };
}

/** Distancia maxima por canal entre duas cores (ignora alpha). */
export function distancia(a: Cor, b: Cor): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

/** Mistura linear de duas cores: `(1 - t) * a + t * b`, por canal. */
export function misturar(a: Cor, b: Cor, t: number): Cor {
  return {
    r: Math.round(a.r * (1 - t) + b.r * t),
    g: Math.round(a.g * (1 - t) + b.g * t),
    b: Math.round(a.b * (1 - t) + b.b * t),
    a: 255,
  };
}

/** Quantos pixels da imagem estao a `tolerancia` ou menos de `alvo`. */
export function contarProximos(imagem: Imagem, alvo: Cor, tolerancia: number): number {
  let total = 0;
  for (let i = 0; i < imagem.largura * imagem.altura; i++) {
    const cor: Cor = {
      r: imagem.pixels[i * 4]!,
      g: imagem.pixels[i * 4 + 1]!,
      b: imagem.pixels[i * 4 + 2]!,
      a: imagem.pixels[i * 4 + 3]!,
    };
    if (distancia(cor, alvo) <= tolerancia) total++;
  }
  return total;
}

/** Fracao da imagem ocupada por cores a `tolerancia` de `alvo` (0..1). */
export function fracaoProxima(imagem: Imagem, alvo: Cor, tolerancia: number): number {
  return contarProximos(imagem, alvo, tolerancia) / (imagem.largura * imagem.altura);
}

/** Quantas cores RGB distintas a imagem tem — entropia crua (AGENTS.md, C1). */
export function coresDistintas(imagem: Imagem): number {
  const vistas = new Set<number>();
  for (let i = 0; i < imagem.largura * imagem.altura; i++) {
    vistas.add(
      (imagem.pixels[i * 4]! << 16) |
        (imagem.pixels[i * 4 + 1]! << 8) |
        imagem.pixels[i * 4 + 2]!,
    );
  }
  return vistas.size;
}
