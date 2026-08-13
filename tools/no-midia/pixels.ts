// =============================================================================
// ANALISE DE PIXEL DO STILL — F1-07
// =============================================================================
// AGENTS.md C1: "exit 0 de um render nao prova que saiu imagem. Quadro preto =
// sucesso." Um quadro 100% transparente tambem: ele e estavel, deterministico,
// pequeno, e nao mostra nada. Por isso o gate deste card nao olha so o codigo
// de saida nem so o tamanho do arquivo — ele conta pixel.
//
// Tres numeros, e cada um mata um falso-verde diferente:
//
//   opacos          — se for 0, o no nao desenhou nada (quadro vazio)
//   transparentes   — se for 0, o no pintou fundo e destruiu o alfa
//   coresDistintas  — se for 1, o quadro e chapado (preto, branco, ou vazio)
//
// A decodificacao e por FFmpeg, que ja e ferramenta declarada da toolchain
// (tools/gate.sh, etapa `versoes`). Ferramenta ausente e VERMELHO, nao pulado.
// =============================================================================

import { execFileSync } from "node:child_process";

/** O que se pode dizer sobre um quadro so olhando os pixels. */
export interface AnaliseDePixels {
  /** Pixels no total */
  total: number;
  /** Pixels com alfa 255 */
  opacos: number;
  /** Pixels com alfa 0 */
  transparentes: number;
  /** Pixels com alfa entre 1 e 254 (borda suavizada, fade em curso) */
  parciais: number;
  /** Cores RGBA distintas, ate o teto de contagem */
  coresDistintas: number;
  /** true se a contagem parou no teto */
  coresTruncadas: boolean;
}

/** Teto da contagem de cores distintas — evita Set de milhoes de entradas. */
const TETO_DE_CORES = 4096;

/**
 * Decodifica um PNG para RGBA cru, via FFmpeg.
 * Lanca se o FFmpeg nao existir ou se o arquivo nao for imagem valida —
 * as duas coisas sao VERMELHO, nunca "pulado".
 */
export function decodificarRgba(caminho: string): Buffer {
  return execFileSync(
    "ffmpeg",
    ["-v", "error", "-i", caminho, "-f", "rawvideo", "-pix_fmt", "rgba", "-"],
    { maxBuffer: 1024 * 1024 * 512 },
  );
}

/** Conta o que importa num buffer RGBA. */
export function analisarRgba(rgba: Buffer): AnaliseDePixels {
  if (rgba.length === 0 || rgba.length % 4 !== 0) {
    throw new Error(
      `buffer RGBA invalido: ${String(rgba.length)} bytes nao e multiplo de 4`,
    );
  }
  const total = rgba.length / 4;
  let opacos = 0;
  let transparentes = 0;
  let parciais = 0;
  const cores = new Set<number>();
  let truncadas = false;

  for (let i = 0; i < rgba.length; i += 4) {
    const alfa = rgba[i + 3]!;
    if (alfa === 0) {
      transparentes++;
    } else if (alfa === 255) {
      opacos++;
    } else {
      parciais++;
    }
    if (!truncadas) {
      const cor =
        (rgba[i]! << 24) | (rgba[i + 1]! << 16) | (rgba[i + 2]! << 8) | alfa;
      cores.add(cor);
      if (cores.size >= TETO_DE_CORES) {
        truncadas = true;
      }
    }
  }

  return {
    total,
    opacos,
    transparentes,
    parciais,
    coresDistintas: cores.size,
    coresTruncadas: truncadas,
  };
}

/** Decodifica e analisa em um passo. */
export function analisarPng(caminho: string): AnaliseDePixels {
  return analisarRgba(decodificarRgba(caminho));
}

// ---------------------------------------------------------------------------
// O veredito
// ---------------------------------------------------------------------------

/** Pisos exigidos de um still do no de midia. */
export interface PisosDeQuadro {
  /** Fracao minima de pixels opacos — o no TEM de desenhar */
  fracaoOpacaMinima: number;
  /** Fracao minima de pixels transparentes — o alfa TEM de sobreviver */
  fracaoTransparenteMinima: number;
  /** Cores distintas minimas — um quadro chapado tem 1 */
  coresDistintasMinimas: number;
}

/**
 * Pisos calibrados no marcador real deste card (borda tracejada + rotulo +
 * hash + fita de cadencia sobre fundo transparente). Sao pisos, nao alvos:
 * o que eles reprovam e o quadro vazio, o quadro chapado e o fundo pintado.
 */
export const PISOS: PisosDeQuadro = {
  fracaoOpacaMinima: 0.0005,
  fracaoTransparenteMinima: 0.5,
  coresDistintasMinimas: 8,
};

/** Devolve a lista de violacoes (vazia = aprovado). */
export function violacoesDeQuadro(
  analise: AnaliseDePixels,
  pisos: PisosDeQuadro = PISOS,
): string[] {
  const erros: string[] = [];
  const fracaoOpaca = analise.opacos / analise.total;
  const fracaoTransparente = analise.transparentes / analise.total;

  if (fracaoOpaca < pisos.fracaoOpacaMinima) {
    erros.push(
      `quadro sem desenho: ${(fracaoOpaca * 100).toFixed(4)}% de pixels opacos ` +
        `(piso ${(pisos.fracaoOpacaMinima * 100).toFixed(4)}%) — isto e o quadro vazio (C1)`,
    );
  }
  if (fracaoTransparente < pisos.fracaoTransparenteMinima) {
    erros.push(
      `alfa destruido: so ${(fracaoTransparente * 100).toFixed(2)}% de pixels ` +
        `transparentes (piso ${(pisos.fracaoTransparenteMinima * 100).toFixed(2)}%) — ` +
        `o no pintou fundo e apagaria os irmaos da cena`,
    );
  }
  if (analise.coresDistintas < pisos.coresDistintasMinimas) {
    erros.push(
      `quadro chapado: ${String(analise.coresDistintas)} cor(es) distinta(s) ` +
        `(piso ${String(pisos.coresDistintasMinimas)})`,
    );
  }
  return erros;
}
