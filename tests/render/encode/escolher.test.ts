/**
 * tests/render/encode/escolher.test.ts
 *
 * A ESCOLHA DO MOTOR COM FALLBACK DECLARADO — pergunta adversarial 3 do
 * card: "o fallback de hardware para software e SILENCIOSO?"
 *
 * Resposta testada: nunca. `escolherPerfil` devolve um objeto com a
 * declaracao estruturada (ativo/motivo/solicitado) — quem executa loga e
 * devolve a declaracao no resultado; quem consume (procedencia F5-06,
 * orquestrador F5-07) le o campo `fallback` e o reporta.
 *
 *   - libx264 solicitado: nunca ha fallback (software nao depende de
 *     hardware) — e a base do teste de ausencia.
 *   - NVENC disponivel: sem fallback.
 *   - NVENC indisponivel: fallback para o perfil de software da MESMA
 *     familia de codec, declarado — e a troca nao finge mesmo eixo
 *     (um nao tem CRF).
 *   - Sem destino no catalogo: LANCA (nunca encoda com o perfil errado
 *     em silencio).
 *
 * PRESENCA, nunca lista completa (§12): os catalogos aqui sao de teste,
 * e as assercoes sao sobre o perfil DESTE card.
 */

import { describe, expect, it } from "vitest";
import {
  escolherPerfil,
  ESemPerfilDeFallback,
} from "src/render/encode/escolher.js";
import type { PerfilEncode } from "src/render/encode/formato.js";

function perfilSoftware(nome = "teste-software"): PerfilEncode {
  return {
    nome,
    motor: "libx264",
    codec: "libx264",
    deterministico: true,
    justificativaDeterminismo: "teste",
    alvoQualidade: { tipo: "crf", valor: 18 },
    preset: "medium",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

function perfilHardware(nome = "teste-hardware"): PerfilEncode {
  return {
    nome,
    motor: "nvenc",
    codec: "h264_nvenc",
    deterministico: false,
    justificativaDeterminismo: "teste",
    alvoQualidade: { tipo: "cq", valor: 23 },
    preset: "p5",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

describe("escolherPerfil — fallback DECLARADO, nunca silencioso", () => {
  it("perfil de software nunca tem fallback (com ou sem NVENC)", () => {
    const perfil = perfilSoftware();
    const comNvenc = escolherPerfil(perfil, { nvenc: true }, []);
    expect(comNvenc.perfil).toBe(perfil);
    expect(comNvenc.fallback.ativo).toBe(false);

    const semNvenc = escolherPerfil(perfil, { nvenc: false }, []);
    expect(semNvenc.perfil).toBe(perfil);
    expect(semNvenc.fallback.ativo).toBe(false);
  });

  it("perfil de hardware com NVENC disponivel: sem fallback", () => {
    const perfil = perfilHardware();
    const resultado = escolherPerfil(perfil, { nvenc: true }, []);
    expect(resultado.perfil).toBe(perfil);
    expect(resultado.fallback.ativo).toBe(false);
  });

  it("perfil de hardware SEM NVENC: fallback DECLARADO para o software da mesma familia", () => {
    const solicitado = perfilHardware();
    const destino = perfilSoftware();
    const resultado = escolherPerfil(
      solicitado,
      { nvenc: false },
      [destino],
    );
    // O perfil efetivo e o de software...
    expect(resultado.perfil).toBe(destino);
    expect(resultado.perfil.motor).toBe("libx264");
    // ...e a troca esta DECLARADA com motivo e origem — o consumidor
    // (F5-06/F5-07) le este objeto, nunca precisa adivinhar.
    expect(resultado.fallback.ativo).toBe(true);
    expect(resultado.fallback.motivo).toMatch(/NVENC indisponivel/);
    expect(resultado.fallback.solicitado).toBe(solicitado.nome);
  });

  it("a declaracao nao finge equivalencia de eixo: o destino tem alvo CRF, nao CQ", () => {
    const solicitado = perfilHardware();
    const destino = perfilSoftware();
    const resultado = escolherPerfil(solicitado, { nvenc: false }, [destino]);
    // Um nao tem CRF — a troca muda o CONTRATO de qualidade de proposito
    // e em voz alta; quem ler o resultado sabe que o alvo mudou de eixo.
    expect(resultado.perfil.alvoQualidade.tipo).toBe("crf");
    expect(resultado.perfil.alvoQualidade.tipo).not.toBe(solicitado.alvoQualidade.tipo);
  });

  it("escolhe o software da MESMA familia (h264_nvenc -> libx264), nao qualquer software", () => {
    const hevcHardware: PerfilEncode = {
      ...perfilHardware("teste-hevc-nvenc"),
      codec: "hevc_nvenc",
    };
    const h264Software = perfilSoftware();
    const hevcSoftware: PerfilEncode = {
      ...perfilSoftware("teste-hevc-software"),
      codec: "libx265",
    };
    const resultado = escolherPerfil(
      hevcHardware,
      { nvenc: false },
      [h264Software, hevcSoftware],
    );
    expect(resultado.perfil).toBe(hevcSoftware);
    expect(resultado.fallback.solicitado).toBe("teste-hevc-nvenc");
  });

  it("LANCA ESemPerfilDeFallback quando o catalogo nao tem o destino — nunca silencioso", () => {
    const solicitado = perfilHardware();
    expect(() => escolherPerfil(solicitado, { nvenc: false }, [])).toThrow(
      ESemPerfilDeFallback,
    );
    // ...e o erro nomeia o perfil e a familia procurada.
    try {
      escolherPerfil(solicitado, { nvenc: false }, []);
      expect.unreachable("deveria lancar");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ESemPerfilDeFallback);
      const e = erro as ESemPerfilDeFallback;
      expect(e.familia).toBe("h264");
      expect(String(erro)).toMatch(/teste-hardware/);
    }
  });
});
