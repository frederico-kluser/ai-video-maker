/**
 * tests/render/encode/formato.test.ts
 *
 * O CONTRATO DO PERFIL (card F5-02, W7) — forma, ∅-crit e eixos.
 *
 *   1. ∅-CRIT do PROGRAMA: um perfil SEM ALVO DE QUALIDADE DECLARADO tem
 *      de falhar — `validarPerfil` devolve erro e o perfil inteiro so
 *      passa com o alvo presente.
 *
 *   2. EMENDA da W7 (contrato-w7 §6): todo perfil DECLARA se o encode e
 *      deterministico — a declaracao e obrigatoria; ausencia = invalido.
 *
 *   3. ADVERSARIAL 1: hardware e software NAO se comparam pelo mesmo
 *      eixo — um nao tem CRF. `crf` declarado num perfil de hardware e
 *      invalido; `cq`/`qp` declarados em software sao invalidos; `cq 0`
 *      (o "automatico" do NVENC) e invalido porque nao declara alvo.
 *
 *   4. PRESENCA, nunca lista completa (contrato-w7 §12): nada aqui
 *      conta perfis — as assercoes sao sobre o contrato de UM perfil.
 */

import { describe, expect, it } from "vitest";
import {
  CRF_MAX,
  CRF_MIN,
  CQ_MAX,
  CQ_MIN,
  QP_MAX,
  QP_MIN,
  validarPerfil,
  type PerfilEncode,
} from "src/render/encode/formato.js";

/** Um perfil base VALIDO — cada teste quebra um campo de cada vez. */
function perfilBase(): PerfilEncode {
  return {
    nome: "teste-software",
    motor: "libx264",
    codec: "libx264",
    deterministico: true,
    justificativaDeterminismo: "medido na cadeia pinada (teste)",
    alvoQualidade: { tipo: "crf", valor: 18 },
    preset: "medium",
    pixFmt: "yuv420p",
    argsExtra: [],
  };
}

describe("validarPerfil — ∅-crit: perfil sem alvo de qualidade declarado tem de falhar", () => {
  it("aceita o perfil base valido", () => {
    expect(validarPerfil(perfilBase())).toEqual([]);
  });

  it("FALHA quando alvoQualidade esta ausente (o ∅-crit do PROGRAMA)", () => {
    const perfil = perfilBase();
    const semAlvo = { ...perfil };
    delete (semAlvo as Partial<PerfilEncode>).alvoQualidade;
    const erros = validarPerfil(semAlvo);
    expect(erros.length).toBeGreaterThan(0);
    expect(erros.join("\n")).toMatch(/alvoQualidade/);
  });

  it("FALHA quando alvoQualidade e null", () => {
    const perfil = { ...perfilBase(), alvoQualidade: null };
    const erros = validarPerfil(perfil);
    expect(erros.length).toBeGreaterThan(0);
  });

  it("FALHA quando o valor do alvo nao e numero finito", () => {
    const perfil = perfilBase();
    expect(validarPerfil({ ...perfil, alvoQualidade: { tipo: "crf", valor: Number.NaN } }).length).toBeGreaterThan(0);
    expect(validarPerfil({ ...perfil, alvoQualidade: { tipo: "crf", valor: Number.POSITIVE_INFINITY } }).length).toBeGreaterThan(0);
  });

  it("FALHA quando o valor do alvo esta fora da faixa do eixo", () => {
    const perfil = perfilBase();
    expect(validarPerfil({ ...perfil, alvoQualidade: { tipo: "crf", valor: CRF_MIN - 1 } }).length).toBeGreaterThan(0);
    expect(validarPerfil({ ...perfil, alvoQualidade: { tipo: "crf", valor: CRF_MAX + 1 } }).length).toBeGreaterThan(0);
  });

  it("FALHA quando o tipo do alvo e desconhecido", () => {
    const perfil = perfilBase();
    const erros = validarPerfil({ ...perfil, alvoQualidade: { tipo: "bitrate", valor: 18 } });
    expect(erros.join("\n")).toMatch(/tipo/);
  });
});

describe("emenda da W7 — o perfil DECLARA se o encode e deterministico", () => {
  it("FALHA sem a declaracao de determinismo (campo obrigatorio)", () => {
    const perfil = perfilBase();
    delete (perfil as Partial<PerfilEncode>).deterministico;
    const erros = validarPerfil(perfil);
    expect(erros.length).toBeGreaterThan(0);
    expect(erros.join("\n")).toMatch(/deterministico/);
  });

  it("FALHA quando a declaracao nao e booleana", () => {
    expect(validarPerfil({ ...perfilBase(), deterministico: "sim" }).length).toBeGreaterThan(0);
  });

  it("FALHA sem a justificativa da declaracao (evidencia obrigatoria)", () => {
    const perfil = perfilBase();
    delete (perfil as Partial<PerfilEncode>).justificativaDeterminismo;
    expect(validarPerfil(perfil).join("\n")).toMatch(/justificativaDeterminismo/);
  });

  it("aceita as duas declaracoes validas: true e false", () => {
    expect(validarPerfil({ ...perfilBase(), deterministico: true })).toEqual([]);
    expect(
      validarPerfil({ ...perfilBase(), deterministico: false }),
    ).toEqual([]);
  });
});

describe("pergunta adversarial 1 — um nao tem CRF: eixos nunca se cruzam", () => {
  it("FALHA: alvo 'crf' declarado num perfil de hardware (NVENC)", () => {
    const perfil: PerfilEncode = {
      ...perfilBase(),
      nome: "teste-hardware",
      motor: "nvenc",
      codec: "h264_nvenc",
      alvoQualidade: { tipo: "crf", valor: 18 },
    };
    const erros = validarPerfil(perfil);
    expect(erros.length).toBeGreaterThan(0);
    // O erro nomeia o eixo — a mensagem da pergunta adversarial 1.
    expect(erros.join("\n")).toMatch(/nao tem CRF/);
  });

  it("FALHA: alvo 'cq'/'qp' declarado num perfil de software (libx264)", () => {
    const comCq: PerfilEncode = {
      ...perfilBase(),
      alvoQualidade: { tipo: "cq", valor: 23 },
    };
    expect(validarPerfil(comCq).join("\n")).toMatch(/libx264 declara CRF/);

    const comQp: PerfilEncode = {
      ...perfilBase(),
      alvoQualidade: { tipo: "qp", valor: 23 },
    };
    expect(validarPerfil(comQp).length).toBeGreaterThan(0);
  });

  it("FALHA: 'cq 0' no NVENC — 0 e 'automatico', ou seja, sem alvo (∅-crit)", () => {
    const perfil: PerfilEncode = {
      ...perfilBase(),
      nome: "teste-hardware",
      motor: "nvenc",
      codec: "h264_nvenc",
      alvoQualidade: { tipo: "cq", valor: 0 },
    };
    expect(validarPerfil(perfil).length).toBeGreaterThan(0);
  });

  it("aceita o alvo 'cq' no NVENC dentro da faixa [CQ_MIN..CQ_MAX]", () => {
    const perfil: PerfilEncode = {
      ...perfilBase(),
      nome: "teste-hardware",
      motor: "nvenc",
      codec: "h264_nvenc",
      deterministico: false,
      alvoQualidade: { tipo: "cq", valor: CQ_MAX },
    };
    expect(validarPerfil(perfil)).toEqual([]);
  });

  it("aceita o alvo 'qp' no NVENC dentro da faixa [QP_MIN..QP_MAX]", () => {
    const perfil: PerfilEncode = {
      ...perfilBase(),
      nome: "teste-hardware",
      motor: "nvenc",
      codec: "h264_nvenc",
      deterministico: false,
      alvoQualidade: { tipo: "qp", valor: QP_MIN },
    };
    expect(validarPerfil(perfil)).toEqual([]);
  });
});

describe("campos obrigatorios restantes", () => {
  it("FALHA sem nome, sem codec, sem preset ou sem pixFmt", () => {
    expect(validarPerfil({ ...perfilBase(), nome: "" }).length).toBeGreaterThan(0);
    expect(validarPerfil({ ...perfilBase(), codec: "" }).length).toBeGreaterThan(0);
    expect(validarPerfil({ ...perfilBase(), preset: "" }).length).toBeGreaterThan(0);
    expect(validarPerfil({ ...perfilBase(), pixFmt: "" }).length).toBeGreaterThan(0);
  });

  it("FALHA com motor desconhecido", () => {
    expect(validarPerfil({ ...perfilBase(), motor: "qsv" }).length).toBeGreaterThan(0);
  });

  it("FALHA quando argsExtra nao e array", () => {
    expect(validarPerfil({ ...perfilBase(), argsExtra: "-b:v 4M" }).length).toBeGreaterThan(0);
  });

  it("FALHA quando o perfil nao e objeto", () => {
    expect(validarPerfil(undefined).length).toBeGreaterThan(0);
    expect(validarPerfil("perfil").length).toBeGreaterThan(0);
  });
});
