// =============================================================================
// A FRONTEIRA DO CACHE DE BYTES — testes de unidade (F5-09, ADR-0041 d.3/d.4)
// =============================================================================
//
// O cache de bytes de frame so existe onde a comparacao byte a byte
// vale. A fronteira e `CODIFICADORES_DA_COMPARACAO` do pipeline (F5-01)
// consumida POR LEITURA — nunca uma segunda lista:
//
//   - png e qtrle: declarados permitidos na comparacao -> cacheaveis;
//   - vp9/webm e mp4/h264: EXCLUIDOS com o motivo (AB-396: vp9
//     nao-determinista; AB-397: vp9 sai yuv420p sem alfa; MP4: encoder
//     muda — ADR-0035) -> o cache de bytes PARA, com o motivo;
//   - codec sem declaracao nenhuma -> PARA, com o motivo da ausencia;
//   - perfil deterministico: false (NVENC) -> nunca vira cache de bytes
//     (AB-700, ADR-0036 decisao 3).
//
// Contrato-w8 §7 (pergunta obrigatoria): a assercao e de PRESENCA do
// item — "o codec X esta declarado cacheavel / excluido com motivo" —
// nunca "os codecs cacheaveis sao exatamente estes N". A propriedade
// aberta cobre o crescimento de CODIFICADORES_DA_COMPARACAO.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  permitidoCacheDeBytesDoCodec,
  permitidoCacheDeBytesDoPerfil,
  codecsCacheaveisEmBytes,
  ErroDeCacheDeBytes,
} from "../../../src/render/cache/delimitacao";
import {
  CODIFICADORES_DA_COMPARACAO,
  type DeclaracaoDeCodec,
} from "../../../src/render/pipeline/codificacoes";
import type { PerfilEncode } from "../../../src/render/encode";

/** Um perfil deterministico valido, para os testes de perfil. */
const PERFIL_DETERMINISTICO: PerfilEncode = {
  nome: "entrega-software",
  motor: "libx264",
  codec: "libx264",
  deterministico: true,
  justificativaDeterminismo: "medido (teste)",
  alvoQualidade: { tipo: "crf", valor: 18 },
  preset: "medium",
  pixFmt: "yuv420p",
  argsExtra: [],
};

/** O perfil NVENC de verdade (deterministico: false) — AB-700. */
const PERFIL_NVENC: PerfilEncode = {
  nome: "entrega-nvenc",
  motor: "nvenc",
  codec: "h264_nvenc",
  deterministico: false,
  justificativaDeterminismo:
    "NVENC nao declara determinismo: o encode depende da sessao do encoder e do driver (AB-700)",
  alvoQualidade: { tipo: "cq", valor: 23 },
  preset: "p5",
  pixFmt: "yuv420p",
  argsExtra: [],
};

describe("fronteira de codec — cache de bytes onde a comparacao vale", () => {
  it("png e qtrle sao cacheaveis (permitidos na comparacao do F5-01)", () => {
    expect(() => permitidoCacheDeBytesDoCodec("png")).not.toThrow();
    expect(() => permitidoCacheDeBytesDoCodec("qtrle")).not.toThrow();
    const cacheaveis = codecsCacheaveisEmBytes();
    expect(cacheaveis).toContain("png");
    expect(cacheaveis).toContain("qtrle");
  });

  it("vp9/webm e mp4/h264 sao EXCLUIDOS do cache de bytes, com o motivo", () => {
    for (const codec of ["vp9/webm", "mp4/h264"]) {
      let erro: ErroDeCacheDeBytes | null = null;
      try {
        permitidoCacheDeBytesDoCodec(codec);
      } catch (e) {
        erro = e as ErroDeCacheDeBytes;
      }
      expect(erro).not.toBeNull();
      // O motivo dos ABs e dito em voz alta, nunca silencioso.
      expect(erro!.message).toMatch(/AB-396|AB-397|ADR-0035/);
      expect(erro!.code).toBe("CACHE_DE_BYTES_EXCLUIDO");
    }
  });

  it("codec sem declaracao nenhuma PARA, com o motivo da ausencia", () => {
    let erro: ErroDeCacheDeBytes | null = null;
    try {
      permitidoCacheDeBytesDoCodec("codec-que-o-pipeline-nao-declara");
    } catch (e) {
      erro = e as ErroDeCacheDeBytes;
    }
    expect(erro).not.toBeNull();
    expect(erro!.message).toMatch(/sem declaracao|nao declarad/i);
  });

  it("contrato-w8 §7: a fronteira e PRESENCA, nunca lista fechada", () => {
    // Se o pipeline declarar um codec novo como permitido, o cache o
    // aceita sem tocar neste arquivo — a propriedade e aberta.
    for (const [codec, declaracao] of Object.entries(
      CODIFICADORES_DA_COMPARACAO as Record<string, DeclaracaoDeCodec>,
    )) {
      if (declaracao.permitido) {
        expect(() => permitidoCacheDeBytesDoCodec(codec)).not.toThrow();
      } else {
        expect(() => permitidoCacheDeBytesDoCodec(codec)).toThrow(
          ErroDeCacheDeBytes,
        );
      }
    }
  });

  it("a lista de cacheaveis deriva do pipeline (ordem estavel)", () => {
    const esperados = Object.entries(CODIFICADORES_DA_COMPARACAO)
      .filter(([, d]) => d.permitido)
      .map(([c]) => c)
      .sort();
    expect(codecsCacheaveisEmBytes()).toEqual(esperados);
  });
});

describe("fronteira de perfil — deterministico: false nunca vira cache de bytes", () => {
  it("perfil deterministico passa", () => {
    expect(() => permitidoCacheDeBytesDoPerfil(PERFIL_DETERMINISTICO)).not.toThrow();
  });

  it("NVENC (deterministico: false) e recusado, com o motivo do AB-700", () => {
    let erro: ErroDeCacheDeBytes | null = null;
    try {
      permitidoCacheDeBytesDoPerfil(PERFIL_NVENC);
    } catch (e) {
      erro = e as ErroDeCacheDeBytes;
    }
    expect(erro).not.toBeNull();
    expect(erro!.message).toContain("entrega-nvenc");
    expect(erro!.message).toMatch(/AB-700|nao-determinista/);
  });
});
