// =============================================================================
// ORACULO DE CONTEUDO DO PIPELINE (C1) — o desvio-padrao, nao so o YAVG
// =============================================================================
// Onda 2 (fix adversario, 2026-08-14): o piso de YAVG MAXIMO (24) reprovava
// FALSO-VERMELHO um video cujo unico conteudo fosse matematica 3blue1brown
// (traco fino sobre preto): a cena c-004 isolada mede YAVG maximo 21.01, e
// preto puro mede 16.0 — as distribuicoes se sobrepoem. O oraculo novo
// reprova so o que nao tem conteudo NENHUM: escuro (yavg < 24) E chapado
// (desvio <= 1.0) em todo frame amostrado.
//
// A medicao pura (medirConteudoDeBytes) e testada com bytes sinteticos
// deterministicos; o criterio (reprovadoPorConteudo) e testado com os
// NUMEROS MEDIDOS no entregavel real e nos videos sinteticos da correcao.
// =============================================================================

import { describe, expect, it } from "vitest";
import type { ExecutorBruto } from "../../src/pipeline/produzir.js";
import {
  AMOSTRAGEM_DE_FRAMES,
  DESVIO_MINIMO_DE_CONTEUDO,
  PISO_YAVG_MAXIMO_DE_CONTEUDO,
  medirConteudoDe,
  medirConteudoDeBytes,
  reprovadoPorConteudo,
} from "../../src/pipeline/produzir.js";

/** Um frame cinza chapado (todos os pixels iguais) — preto limitado = 16. */
function frameChapado(valor: number, largura = 8, altura = 8): Buffer {
  return Buffer.alloc(largura * altura, valor);
}

/** Um frame com conteudo: uma linha clara sobre fundo preto. */
function frameComLinhaClara(largura = 8, altura = 8): Buffer {
  const frame = Buffer.alloc(largura * altura, 16);
  for (let x = 0; x < largura; x++) frame[x] = 235;
  return frame;
}

const LARGURA = 8;
const ALTURA = 8;

describe("medirConteudoDeBytes — a medicao pura", () => {
  it("preto puro: yavg 16 e desvio 0.0000 em todo frame", () => {
    const bytes = Buffer.concat([frameChapado(16), frameChapado(16), frameChapado(16)]);
    const medida = medirConteudoDeBytes(bytes, LARGURA, ALTURA);
    expect(medida.yavgMaximo).toBe(16);
    expect(medida.desvioMaximo).toBe(0);
  });

  it("conteudo: a linha clara da desvio > 1.0 em qualquer frame", () => {
    const bytes = Buffer.concat([frameChapado(16), frameComLinhaClara(), frameChapado(16)]);
    const medida = medirConteudoDeBytes(bytes, LARGURA, ALTURA);
    expect(medida.yavgMaximo).toBeGreaterThan(16);
    expect(medida.desvioMaximo).toBeGreaterThan(DESVIO_MINIMO_DE_CONTEUDO);
  });

  it("bytes truncados (frame pela metade) sao ignorados, nao estouram", () => {
    const bytes = Buffer.concat([frameComLinhaClara(), Buffer.from([1, 2, 3])]);
    const medida = medirConteudoDeBytes(bytes, LARGURA, ALTURA);
    expect(Number.isFinite(medida.yavgMaximo)).toBe(true);
    expect(Number.isFinite(medida.desvioMaximo)).toBe(true);
  });
});

describe("reprovadoPorConteudo — o criterio, com os NUMEROS MEDIDOS da correcao", () => {
  // Medido em 2026-08-14 (ffmpeg 6.1.1, luma do range limitado via
  // extractplanes — a mesma escala do YAVG do signalstats).
  it("entregavel FINAL (727 frames, cache frio): yavg max 22.49, desvio max 19.71 — PASSA (o yavg sozinho reprovaria o proprio entregavel)", () => {
    // A geometria honesta do bloco de codigo (fix P3) encolheu o bloco
    // claro: o YAVG maximo 22.49 fica ABAIXO do piso 24 — o YAVG sozinho
    // reprovaria o proprio entregavel; o desvio maximo 19.71 (48/48
    // amostras > 1.0 na leitura do oraculo) e quem o reconhece.
    expect(PISO_YAVG_MAXIMO_DE_CONTEUDO).toBe(24);
    expect(22.49).toBeLessThan(PISO_YAVG_MAXIMO_DE_CONTEUDO);
    expect(reprovadoPorConteudo({ yavgMaximo: 22.49, desvioMaximo: 19.71 })).toBe(false);
  });

  it("so-matematica (c-004 isolada, 102 frames): yavg max 21.01, desvio max 18.61 — PASSA (o piso de yavg sozinho reprovava falso-vermelho)", () => {
    // A cena c-004 inteira fica ABAIXO do piso de yavg (21.01 < 24); e o
    // desvio maximo (18.61, minimo por frame 2.39) esta MUITO acima do
    // piso de desvio — o conteudo escuro por desenho e reconhecido.
    expect(PISO_YAVG_MAXIMO_DE_CONTEUDO).toBe(24);
    expect(21.01).toBeLessThan(PISO_YAVG_MAXIMO_DE_CONTEUDO);
    expect(reprovadoPorConteudo({ yavgMaximo: 21.01, desvioMaximo: 18.61 })).toBe(false);
  });

  it("preto puro (727 frames): yavg 16.0 chapado, desvio 0.0000 — REPROVA (C1)", () => {
    expect(reprovadoPorConteudo({ yavgMaximo: 16.0, desvioMaximo: 0.0 })).toBe(true);
  });

  it("o desvio carrega a separacao: conteudo escuro + chapado e a UNICA combinacao que reprova", () => {
    // yavg baixo mas textura (matematica) -> passa.
    expect(reprovadoPorConteudo({ yavgMaximo: 21.0, desvioMaximo: 2.39 })).toBe(false);
    // yavg alto mas chapado (fundo claro solido) -> passa (nao e preto).
    expect(reprovadoPorConteudo({ yavgMaximo: 200.0, desvioMaximo: 0.0 })).toBe(false);
    // escuro E chapado (preto) -> reprova.
    expect(reprovadoPorConteudo({ yavgMaximo: 16.0, desvioMaximo: 0.0 })).toBe(true);
  });
});

describe("medirConteudoDe — o executor BRUTO e o contrato da leitura", () => {
  it("decodifica a luma SEM conversao de range (fps=2, extractplanes=y) e devolve a medida dos bytes", async () => {
    const bytes = Buffer.concat([frameChapado(16), frameComLinhaClara()]);
    let comandoVisto = "";
    let argsVistos: string[] = [];
    const executorBruto: ExecutorBruto = async (comando, args) => {
      comandoVisto = comando;
      argsVistos = args;
      return { stdout: bytes, stderr: Buffer.alloc(0) };
    };
    const medida = await medirConteudoDe(
      { executorBruto } as never,
      "/tmp/video.mp4",
      LARGURA,
      ALTURA,
    );
    expect(comandoVisto).toBe("ffmpeg");
    expect(argsVistos.join(" ")).toContain(`fps=${String(AMOSTRAGEM_DE_FRAMES)}`);
    expect(argsVistos.join(" ")).toContain("extractplanes=y");
    expect(argsVistos.join(" ")).toContain("rawvideo");
    expect(medida.desvioMaximo).toBeGreaterThan(DESVIO_MINIMO_DE_CONTEUDO);
  });
});
