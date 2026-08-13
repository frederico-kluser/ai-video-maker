// =============================================================================
// DELIMITACAO DA COMPARACAO BYTE A BYTE — testes de unidade (contrato-w7 §6)
// =============================================================================
// A comparacao faixa == inteiro vale onde o encoder e deterministico
// (PNG/QTRLE). O WebM vp9 e o MP4 final ficam EXCLUIDOS POR DECLARACAO, com
// o motivo (AB-396: vp9 nao-determinista; AB-397: vp9 yuv420p sem alfa; MP4
// final: encoder muda, comparacao byte a byte e falso oraculo) — a exclusao
// nunca e silenciosa: o comparador PARA com a mensagem.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  garantirCodecComparavel,
  CODIFICADORES_DA_COMPARACAO,
  ErroDeCodecIncomparavel,
} from "../../../src/render/pipeline/codificacoes";

describe("delimitacao — codecs deterministicos comparaveis", () => {
  it("PNG e QTRLE sao declarados permitidos, com motivo", () => {
    expect(CODIFICADORES_DA_COMPARACAO["png"]?.permitido).toBe(true);
    expect(CODIFICADORES_DA_COMPARACAO["qtrle"]?.permitido).toBe(true);
    expect(CODIFICADORES_DA_COMPARACAO["png"]?.motivo.length).toBeGreaterThan(0);
    expect(CODIFICADORES_DA_COMPARACAO["qtrle"]?.motivo.length).toBeGreaterThan(0);
    // A guarda nao lanca para os permitidos.
    expect(() => garantirCodecComparavel("png")).not.toThrow();
    expect(() => garantirCodecComparavel("qtrle")).not.toThrow();
  });
});

describe("delimitacao — exclusoes declaradas, nunca silenciosas", () => {
  it("vp9/webm e EXCLUIDO com o motivo dos ABs", () => {
    const declaracao = CODIFICADORES_DA_COMPARACAO["vp9/webm"]!;
    expect(declaracao.permitido).toBe(false);
    expect(declaracao.motivo).toContain("AB-396");
    expect(declaracao.motivo).toContain("AB-397");

    let erro: ErroDeCodecIncomparavel | null = null;
    try {
      garantirCodecComparavel("vp9/webm");
    } catch (e) {
      erro = e as ErroDeCodecIncomparavel;
    }
    expect(erro).not.toBeNull();
    expect(erro!.message).toContain("EXCLUIDO");
    expect(erro!.message).toContain("AB-396");
  });

  it("mp4/h264 e EXCLUIDO com o motivo do oraculo falso", () => {
    const declaracao = CODIFICADORES_DA_COMPARACAO["mp4/h264"]!;
    expect(declaracao.permitido).toBe(false);
    expect(declaracao.motivo).toContain("AB-396");
    expect(declaracao.motivo).toContain("AB-397");

    expect(() => garantirCodecComparavel("mp4/h264")).toThrow(/EXCLUIDO/);
  });

  it("codec sem declaracao PARA em vez de comparar em silencio", () => {
    expect(() => garantirCodecComparavel("av1/webm")).toThrow(
      ErroDeCodecIncomparavel,
    );
  });
});
