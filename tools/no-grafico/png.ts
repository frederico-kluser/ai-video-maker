// =============================================================================
// PNG — leitor e escritor minimos, sem dependencia nova
// =============================================================================
// Card: F1-09 (onda W4)
//
// Por que existe: o criterio deste card e sobre CANAL ALFA, e canal alfa e uma
// propriedade dos BYTES, nao do nome do arquivo nem do mimeType declarado. Um
// arquivo chamado `.png`, com `mimeType: "image/png"` no manifesto resolvido,
// pode ter tipo de cor 2 (RGB) e nenhum alfa — e ai o grafico entra no video
// como retangulo opaco exatamente como entraria um JPEG.
//
// Tambem e o que permite responder "o smoke passaria com um quadro vazio?" com
// pixel, e nao com exit code: `medirQuadro()` conta cobertura de tinta e cores
// distintas (AGENTS.md C1).
//
// Escopo deliberadamente pequeno: profundidade de 8 bits, sem entrelacamento,
// tipos de cor 2 (RGB) e 6 (RGBA) decodificados por inteiro; os demais tem
// cabecalho lido e decodificacao recusada em voz alta.
// =============================================================================

import { deflateSync, inflateSync } from "node:zlib";

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tipos de cor do PNG (spec 11.2.2). */
export const TIPO_DE_COR = {
  cinza: 0,
  rgb: 2,
  paleta: 3,
  cinzaComAlfa: 4,
  rgba: 6,
} as const;

export interface CabecalhoPng {
  readonly largura: number;
  readonly altura: number;
  readonly profundidade: number;
  readonly tipoDeCor: number;
  readonly entrelacado: boolean;
  /** Ha bloco tRNS? E como um PNG de paleta carrega transparencia. */
  readonly temTrns: boolean;
  /** Canal alfa por pixel (4 ou 6) ou transparencia por indice (3 + tRNS). */
  readonly temAlfa: boolean;
}

export interface QuadroRgba {
  readonly largura: number;
  readonly altura: number;
  /** RGBA de 8 bits, linha a linha. */
  readonly pixels: Uint8Array;
}

// ---------------------------------------------------------------------------
// CRC-32 (spec, anexo D)
// ---------------------------------------------------------------------------

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const byte of dados) {
    c = (TABELA_CRC[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

interface Bloco {
  readonly tipo: string;
  readonly dados: Buffer;
}

function blocos(arquivo: Buffer): Bloco[] {
  if (!arquivo.subarray(0, 8).equals(ASSINATURA)) {
    throw new Error("nao e um PNG: assinatura ausente");
  }
  const achados: Bloco[] = [];
  let posicao = 8;
  while (posicao + 8 <= arquivo.length) {
    const tamanho = arquivo.readUInt32BE(posicao);
    const tipo = arquivo.subarray(posicao + 4, posicao + 8).toString("latin1");
    const dados = arquivo.subarray(posicao + 8, posicao + 8 + tamanho);
    achados.push({ tipo, dados });
    posicao += 12 + tamanho;
    if (tipo === "IEND") break;
  }
  return achados;
}

/** Le so o cabecalho — barato, e ja responde "tem canal alfa?". */
export function lerCabecalhoPng(arquivo: Buffer): CabecalhoPng {
  const lista = blocos(arquivo);
  const ihdr = lista.find((b) => b.tipo === "IHDR");
  if (ihdr === undefined) throw new Error("PNG sem bloco IHDR");
  const tipoDeCor = ihdr.dados.readUInt8(9);
  const temTrns = lista.some((b) => b.tipo === "tRNS");
  return {
    largura: ihdr.dados.readUInt32BE(0),
    altura: ihdr.dados.readUInt32BE(4),
    profundidade: ihdr.dados.readUInt8(8),
    tipoDeCor,
    entrelacado: ihdr.dados.readUInt8(12) !== 0,
    temTrns,
    temAlfa:
      tipoDeCor === TIPO_DE_COR.rgba ||
      tipoDeCor === TIPO_DE_COR.cinzaComAlfa ||
      (tipoDeCor === TIPO_DE_COR.paleta && temTrns),
  };
}

function desfiltrar(
  cru: Buffer,
  largura: number,
  altura: number,
  bytesPorPixel: number,
): Buffer {
  const passo = largura * bytesPorPixel;
  const saida = Buffer.alloc(passo * altura);
  let origem = 0;
  for (let linha = 0; linha < altura; linha++) {
    const filtro = cru.readUInt8(origem);
    origem += 1;
    const inicio = linha * passo;
    const anterior = inicio - passo;
    for (let i = 0; i < passo; i++) {
      const bruto = cru.readUInt8(origem + i);
      const a = i >= bytesPorPixel ? saida.readUInt8(inicio + i - bytesPorPixel) : 0;
      const b = linha > 0 ? saida.readUInt8(anterior + i) : 0;
      const c =
        linha > 0 && i >= bytesPorPixel
          ? saida.readUInt8(anterior + i - bytesPorPixel)
          : 0;
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
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          valor = bruto + pred;
          break;
        }
        default:
          throw new Error(`filtro de linha desconhecido: ${String(filtro)}`);
      }
      saida.writeUInt8(valor & 0xff, inicio + i);
    }
    origem += passo;
  }
  return saida;
}

/** Decodifica para RGBA. So tipos de cor 2 e 6, 8 bits, sem entrelacamento. */
export function lerPngRgba(arquivo: Buffer): QuadroRgba {
  const cabecalho = lerCabecalhoPng(arquivo);
  if (cabecalho.profundidade !== 8 || cabecalho.entrelacado) {
    throw new Error(
      `PNG fora do escopo deste leitor: profundidade ${String(cabecalho.profundidade)}, ` +
        `entrelacado=${String(cabecalho.entrelacado)}`,
    );
  }
  if (
    cabecalho.tipoDeCor !== TIPO_DE_COR.rgb &&
    cabecalho.tipoDeCor !== TIPO_DE_COR.rgba
  ) {
    throw new Error(
      `PNG fora do escopo deste leitor: tipo de cor ${String(cabecalho.tipoDeCor)}`,
    );
  }

  const canais = cabecalho.tipoDeCor === TIPO_DE_COR.rgba ? 4 : 3;
  const comprimido = Buffer.concat(
    blocos(arquivo)
      .filter((b) => b.tipo === "IDAT")
      .map((b) => b.dados),
  );
  const cru = desfiltrar(
    inflateSync(comprimido),
    cabecalho.largura,
    cabecalho.altura,
    canais,
  );

  if (canais === 4) {
    return { largura: cabecalho.largura, altura: cabecalho.altura, pixels: cru };
  }

  const pixels = new Uint8Array(cabecalho.largura * cabecalho.altura * 4);
  for (let i = 0; i < cabecalho.largura * cabecalho.altura; i++) {
    pixels[i * 4] = cru.readUInt8(i * 3);
    pixels[i * 4 + 1] = cru.readUInt8(i * 3 + 1);
    pixels[i * 4 + 2] = cru.readUInt8(i * 3 + 2);
    pixels[i * 4 + 3] = 255;
  }
  return { largura: cabecalho.largura, altura: cabecalho.altura, pixels };
}

// ---------------------------------------------------------------------------
// Medicao de conteudo — a resposta a "o smoke passaria com quadro vazio?"
// ---------------------------------------------------------------------------

export interface MedidaDoQuadro {
  readonly pixels: number;
  /** Fracao de pixels com alfa > 0. 0 = quadro vazio; 1 = retangulo opaco. */
  readonly fracaoComTinta: number;
  /** Fracao de pixels totalmente transparentes. */
  readonly fracaoTransparente: number;
  /** Cores RGBA distintas — um bloco de cor unica tem 1 ou 2. */
  readonly coresDistintas: number;
  /** Alfa dos quatro cantos, em ordem: NO, NE, SO, SE. */
  readonly alfaDosCantos: readonly number[];
}

export function medirQuadro(quadro: QuadroRgba): MedidaDoQuadro {
  const total = quadro.largura * quadro.altura;
  const cores = new Set<number>();
  let comTinta = 0;
  let transparente = 0;
  for (let i = 0; i < total; i++) {
    const r = quadro.pixels[i * 4] ?? 0;
    const g = quadro.pixels[i * 4 + 1] ?? 0;
    const b = quadro.pixels[i * 4 + 2] ?? 0;
    const a = quadro.pixels[i * 4 + 3] ?? 0;
    if (a > 0) comTinta++;
    else transparente++;
    cores.add(((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
  }
  const alfaEm = (x: number, y: number): number =>
    quadro.pixels[(y * quadro.largura + x) * 4 + 3] ?? 0;
  return {
    pixels: total,
    fracaoComTinta: comTinta / total,
    fracaoTransparente: transparente / total,
    coresDistintas: cores.size,
    alfaDosCantos: [
      alfaEm(0, 0),
      alfaEm(quadro.largura - 1, 0),
      alfaEm(0, quadro.altura - 1),
      alfaEm(quadro.largura - 1, quadro.altura - 1),
    ],
  };
}

// ---------------------------------------------------------------------------
// Escrita — usada so para gerar as fixtures de asset
// ---------------------------------------------------------------------------

function bloco(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, "latin1"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tamanho, corpo, crc]);
}

/**
 * Escreve um PNG de 8 bits sem entrelacamento.
 * `canais` = 4 escreve tipo de cor 6 (RGBA); 3 escreve tipo de cor 2 (RGB),
 * que e o PNG SEM canal alfa — a fixture do asset opaco.
 */
export function escreverPng(
  largura: number,
  altura: number,
  canais: 3 | 4,
  amostras: Uint8Array,
): Buffer {
  const esperado = largura * altura * canais;
  if (amostras.length !== esperado) {
    throw new Error(
      `amostras com ${String(amostras.length)} bytes; esperado ${String(esperado)}`,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(canais === 4 ? TIPO_DE_COR.rgba : TIPO_DE_COR.rgb, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const passo = largura * canais;
  const cru = Buffer.alloc((passo + 1) * altura);
  for (let linha = 0; linha < altura; linha++) {
    cru.writeUInt8(0, linha * (passo + 1));
    Buffer.from(amostras.subarray(linha * passo, (linha + 1) * passo)).copy(
      cru,
      linha * (passo + 1) + 1,
    );
  }

  return Buffer.concat([
    ASSINATURA,
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(cru, { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}
