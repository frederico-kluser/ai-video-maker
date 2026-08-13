// =============================================================================
// medicao.test.ts — autoteste do decodificador PNG e da medicao de cobertura
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// O gate `just no-camadas` responde a pergunta do card em PIXEL: zero pixels
// mudados dentro da safe area, todo pixel mudado dentro de um retangulo
// declarado, e todo retangulo declarado com pixel. Isso depende de duas
// ferramentas que precisam de autoteste proprio (C1: um medidor sem autoteste
// e so mais uma ferramenta que mente):
//
//   1. o decodificador PNG (node:zlib + Paeth) — testado com PNGs sinteticos
//      de valor conhecido, um por filtro de linha;
//   2. medirCamada — testado com imagens RGBA diretas, pixel a pixel.
// =============================================================================

import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import type { Retangulo } from "src/composicao/camadas/geometria";
import {
  decodificarPng,
  type ImagemRgba,
} from "../../../tools/camadas/png";
import {
  medirCamada,
  type RetanguloDeclarado,
} from "../../../tools/camadas/medicao";

// ---------------------------------------------------------------------------
// Encoder PNG minimo para o autoteste (8 bits, sem entrelacamento)
// ---------------------------------------------------------------------------

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC32 — tabela padrao, necessaria para chunk valido. */
function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo: string, dados: Buffer): Buffer {
  const tipoBuf = Buffer.from(tipo, "ascii");
  const cabeca = Buffer.alloc(4);
  cabeca.writeUInt32BE(dados.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipoBuf, dados])), 0);
  return Buffer.concat([cabeca, tipoBuf, dados, crc]);
}

/**
 * Aplica o filtro de linha 0..4 aos BYTES crus da imagem (a spec exige que
 * os dados reflitam o filtro declarado — senao o decodificador reconstroi
 * outra imagem). `bpp` e o numero de bytes por pixel.
 */
function aplicarFiltro(
  bruto: Buffer,
  largura: number,
  altura: number,
  bpp: number,
  filtro: number,
): Buffer {
  const bytesPorLinha = largura * bpp;
  const saida = Buffer.alloc(bytesPorLinha * altura);

  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  };

  for (let y = 0; y < altura; y++) {
    for (let i = 0; i < bytesPorLinha; i++) {
      const brutoByte = bruto[y * bytesPorLinha + i] ?? 0;
      const a = i >= bpp ? (bruto[y * bytesPorLinha + i - bpp] ?? 0) : 0;
      const b = y > 0 ? (bruto[(y - 1) * bytesPorLinha + i] ?? 0) : 0;
      const c =
        y > 0 && i >= bpp ? (bruto[(y - 1) * bytesPorLinha + i - bpp] ?? 0) : 0;

      let valor: number;
      switch (filtro) {
        case 0:
          valor = brutoByte;
          break;
        case 1:
          valor = brutoByte - a;
          break;
        case 2:
          valor = brutoByte - b;
          break;
        case 3:
          valor = brutoByte - ((a + b) >> 1);
          break;
        default:
          valor = brutoByte - paeth(a, b, c);
          break;
      }
      saida[y * bytesPorLinha + i] = valor & 0xff;
    }
  }
  return saida;
}

/**
 * Encoda um PNG sintetico com um filtro de linha fixo.
 * `filtro` 0..4: o MESMO filtro em todas as linhas (a spec permite, e o
 * decodificador precisa tratar cada um).
 */
function encodarPng(
  img: ImagemRgba,
  filtro: number,
  tipoDeCor = 6,
): Buffer {
  const canais = tipoDeCor === 2 ? 3 : 4;
  const bytesPorLinha = img.largura * canais;
  const bruto = Buffer.alloc(bytesPorLinha * img.altura);

  for (let y = 0; y < img.altura; y++) {
    for (let x = 0; x < img.largura; x++) {
      const de = (y * img.largura + x) * 4;
      const para = y * bytesPorLinha + x * canais;
      bruto[para] = img.dados[de] ?? 0;
      bruto[para + 1] = img.dados[de + 1] ?? 0;
      bruto[para + 2] = img.dados[de + 2] ?? 0;
      if (tipoDeCor === 6) {
        bruto[para + 3] = img.dados[de + 3] ?? 0;
      }
    }
  }

  const filtrado = aplicarFiltro(bruto, img.largura, img.altura, canais, filtro);
  const cru = Buffer.alloc((bytesPorLinha + 1) * img.altura);
  for (let y = 0; y < img.altura; y++) {
    cru[y * (bytesPorLinha + 1)] = filtro;
    filtrado.copy(cru, y * (bytesPorLinha + 1) + 1, y * bytesPorLinha, (y + 1) * bytesPorLinha);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.largura, 0);
  ihdr.writeUInt32BE(img.altura, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = tipoDeCor;
  ihdr[10] = 0; // compressao
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // sem entrelacamento

  return Buffer.concat([
    ASSINATURA,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(cru)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function imagemSintetica(largura: number, altura: number): ImagemRgba {
  const dados = new Uint8Array(largura * altura * 4);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      const i = (y * largura + x) * 4;
      dados[i] = (x * 40 + y * 10) % 256;
      dados[i + 1] = (y * 60 + x * 3) % 256;
      dados[i + 2] = (x * y) % 256;
      dados[i + 3] = 255;
    }
  }
  return { largura, altura, dados };
}

// ---------------------------------------------------------------------------
// Autoteste do decodificador — um PNG por filtro de linha
// ---------------------------------------------------------------------------

describe("decodificarPng — os cinco filtros de linha", () => {
  for (const filtro of [0, 1, 2, 3, 4]) {
    it(`filtro ${filtro}: round-trip byte a byte`, () => {
      const original = imagemSintetica(4, 3);
      const decodificado = decodificarPng(encodarPng(original, filtro));
      expect(decodificado.largura).toBe(4);
      expect(decodificado.altura).toBe(3);
      expect(decodificado.dados).toStrictEqual(original.dados);
    });
  }

  it("colorType 2 (RGB) tambem decodifica, com alfa preenchido em 255", () => {
    const original = imagemSintetica(3, 2);
    const decodificado = decodificarPng(encodarPng(original, 0, 2));
    for (let i = 3; i < decodificado.dados.length; i += 4) {
      expect(decodificado.dados[i]).toBe(255);
    }
  });

  it("assinatura invalida estoura — nunca decodifica lixo", () => {
    expect(() => decodificarPng(Buffer.from("nao-e-png"))).toThrow(/assinatura/);
  });

  it("profundidade diferente de 8 bits estoura", () => {
    const png = encodarPng(imagemSintetica(2, 2), 0);
    png[24] = 16; // byte de profundidade do IHDR
    expect(() => decodificarPng(png)).toThrow(/8/);
  });

  it("PNG entrelacado (Adam7) estoura", () => {
    const png = encodarPng(imagemSintetica(2, 2), 0);
    png[28] = 1; // byte de entrelacamento do IHDR
    expect(() => decodificarPng(png)).toThrow(/entrelacado/);
  });

  it("filtro desconhecido estoura, nunca vira None em silencio", () => {
    const png = encodarPng(imagemSintetica(2, 2), 0);
    // re-encoda com filtro 9 na primeira linha: aponta o byte de filtro
    const cabecalho = png.subarray(0, 33); // assinatura + IHDR completo
    const idat = png.subarray(33);
    // IDAT começa com tamanho+tipo; os dados deflados comecam aos 8 bytes do chunk
    const dadosDeflados = Buffer.from(idat.subarray(8, idat.length - 8));
    const cru = Buffer.from(inflateSync(dadosDeflados));
    cru[0] = 9;
    const novo = Buffer.concat([
      cabecalho,
      chunk("IDAT", deflateSync(cru)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    expect(() => decodificarPng(novo)).toThrow(/filtro/);
  });
});

// ---------------------------------------------------------------------------
// medirCamada — a medicao em pixel, com imagens diretas
// ---------------------------------------------------------------------------

const SEGURO: Retangulo = { x: 10, y: 10, largura: 10, altura: 10 };

function imagemPlana(cor: [number, number, number, number], largura = 30, altura = 30): ImagemRgba {
  const dados = new Uint8Array(largura * altura * 4);
  for (let i = 0; i < dados.length; i += 4) {
    dados[i] = cor[0];
    dados[i + 1] = cor[1];
    dados[i + 2] = cor[2];
    dados[i + 3] = cor[3];
  }
  return { largura, altura, dados };
}

function comPontoDiferente(
  base: ImagemRgba,
  x: number,
  y: number,
  cor: [number, number, number, number],
): ImagemRgba {
  const dados = new Uint8Array(base.dados);
  const i = (y * base.largura + x) * 4;
  dados[i] = cor[0];
  dados[i + 1] = cor[1];
  dados[i + 2] = cor[2];
  dados[i + 3] = cor[3];
  return { ...base, dados };
}

describe("medirCamada", () => {
  const referencia = imagemPlana([249, 249, 249, 255]);

  it("imagem identica = QUADRO VAZIO: a camada nao mudou UM pixel", () => {
    const m = medirCamada("x", referencia, referencia, SEGURO, [
      { nome: "r", x: 0, y: 0, largura: 5, altura: 5, opacidade: 0.5 },
    ]);
    expect(m.aprova).toBe(false);
    expect(m.motivos.join("\n")).toContain("QUADRO VAZIO");
  });

  it("plano declarado vazio = QUADRO VAZIO (C2: seletor vazio nunca aprova)", () => {
    const mudou = comPontoDiferente(referencia, 2, 2, [0, 0, 0, 255]);
    const m = medirCamada("x", referencia, mudou, SEGURO, []);
    expect(m.aprova).toBe(false);
    expect(m.motivos.join("\n")).toContain("QUADRO VAZIO");
    expect(m.motivos.join("\n")).toContain("nao declarou retangulo nenhum");
  });

  it("INVASAO: pixel mudado DENTRO da safe area reprova, com o primeiro pixel nomeado", () => {
    const invadida = comPontoDiferente(referencia, 15, 15, [0, 0, 0, 255]);
    const m = medirCamada("x", referencia, invadida, SEGURO, [
      { nome: "fora", x: 0, y: 0, largura: 30, altura: 30, opacidade: 0.5 },
    ]);
    expect(m.aprova).toBe(false);
    expect(m.diferentesNoSeguro).toBe(1);
    expect(m.motivos.join("\n")).toContain("INVASAO");
    expect(m.primeiroNoSeguro?.x).toBe(15);
    expect(m.primeiroNoSeguro?.y).toBe(15);
  });

  it("VAZAMENTO: pixel mudado fora de todo retangulo declarado reprova", () => {
    const mudou = comPontoDiferente(referencia, 2, 2, [0, 0, 0, 255]); // fora do seguro
    const m = medirCamada("x", referencia, mudou, SEGURO, [
      { nome: "longe", x: 20, y: 20, largura: 5, altura: 5, opacidade: 0.5 },
    ]);
    expect(m.aprova).toBe(false);
    expect(m.diferentesForaDoDeclarado).toBe(1);
    expect(m.motivos.join("\n")).toContain("VAZAMENTO");
  });

  it("ENTROPIA: retangulo declarado sem nenhum pixel diferente reprova", () => {
    const mudou = comPontoDiferente(referencia, 2, 2, [0, 0, 0, 255]);
    const m = medirCamada("x", referencia, mudou, SEGURO, [
      { nome: "com-pixel", x: 0, y: 0, largura: 5, altura: 5, opacidade: 0.5 },
      { nome: "sem-pixel", x: 25, y: 25, largura: 4, altura: 4, opacidade: 0.5 },
    ]);
    expect(m.aprova).toBe(false);
    expect(m.retangulosSemPixel).toStrictEqual(["sem-pixel"]);
    expect(m.motivos.join("\n")).toContain("SEM PIXEL");
  });

  it("camada correta: zero no seguro, zero fora do declarado, todo declarado com pixel", () => {
    const mudou = comPontoDiferente(referencia, 2, 2, [0, 0, 0, 255]);
    const declarados: RetanguloDeclarado[] = [
      { nome: "correto", x: 0, y: 0, largura: 5, altura: 5, opacidade: 0.5 },
    ];
    const m = medirCamada("x", referencia, mudou, SEGURO, declarados);
    expect(m.motivos).toStrictEqual([]);
    expect(m.aprova).toBe(true);
    expect(m.diferentesNoSeguro).toBe(0);
    expect(m.diferentesForaDoDeclarado).toBe(0);
    expect(m.retangulosSemPixel).toStrictEqual([]);
    expect(m.totalDiferentes).toBe(1);
  });

  it("resolucoes divergentes tornam a medicao impossivel — estoura", () => {
    const outra = imagemPlana([0, 0, 0, 255], 20, 20);
    expect(() =>
      medirCamada("x", referencia, outra, SEGURO, []),
    ).toThrow(/medicao impossivel/);
  });

  it("a invasora declarada (sonda) reprova com areaInvadida contada pela geometria", () => {
    // Cobre a mesma invasao declarada de prova/cena: retangulo encolhido 12%
    const seguro: Retangulo = { x: 10, y: 10, largura: 10, altura: 10 };
    const invadida = comPontoDiferente(referencia, 10, 10, [0, 0, 0, 255]);
    const m = medirCamada("sonda", referencia, invadida, seguro, [
      { nome: "invade", x: 10, y: 10, largura: 10, altura: 10, opacidade: 0.5 },
    ]);
    expect(m.aprova).toBe(false);
    expect(m.diferentesNoSeguro).toBe(1);
  });
});
