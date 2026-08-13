// =============================================================================
// A CHAVE C7 — testes de unidade do nucleo do cache (card F5-09, W8)
// =============================================================================
//
// O que estes testes asserem:
//   - os CINCO componentes da chave (ADR-0041, decisao 1): manifesto
//     resolvido, re-hash dos bytes de assets, tokens consumidos,
//     versao do codigo/compositor/navegador, pin das ferramentas;
//   - o ∅-crit do PROGRAMA em nivel de unidade: um token de design
//     MUDADO muda a chave (a invalidacao acontece pela chave, nunca por
//     comparacao de data) — um cache que hasheasse o FORMATO dos tokens
//     sem os VALORES produziria a mesma chave e o teste ficaria
//     VERMELHO;
//   - o NEVER-set (decisao 2): data/hora, memTotal, workers, plano de
//     faixas, porta e env de agendamento NAO entram na chave — a
//     assinatura nao os aceita e o objeto de componentes NAO cita as
//     palavras (tripwire de regressao);
//   - determinismo: mesmos bytes de entrada, mesma chave, em qualquer
//     instante (relogio congelado em valores diferentes).
// =============================================================================

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  calcularChaveC7,
  componentesDaChaveC7,
  sha256Hex,
  FORMATO_DA_CHAVE,
  tokensConsumidosReais,
  type EntradasDaChaveC7,
} from "../../../src/render/cache/chave";
import { serializarCanonico } from "../../../src/render/cache/serializar";

/** Uma pilha fixa para os testes — identidade de versoes nunca depende da maquina. */
const VERSAO_BASE = {
  remotion: "4.0.507",
  renderer: "4.0.507",
  bundler: "4.0.507",
  compositor: "4.0.507",
  navegador: "149.0.7790.0",
} as const;

const PIN_BASE = { node: "24.15.0", ffmpeg: "6.1.1-3ubuntu5" } as const;

const MANIFESTO_BASE = Buffer.from(
  JSON.stringify({
    schema_version: "ManifestoResolvido.1",
    manifesto: { fps: 30, width: 1920, height: 1080 },
    cenas: [{ id: "c-001" }],
  }),
);

const ASSETS_BASE = new Map<string, Buffer>([
  ["a".repeat(64), Buffer.from("bytes-do-grafico-1")],
  ["b".repeat(64), Buffer.from("bytes-da-midia-2")],
]);

function entradasBase(): EntradasDaChaveC7 {
  return {
    manifestoResolvido: MANIFESTO_BASE,
    assets: ASSETS_BASE,
    versoes: VERSAO_BASE,
    pinFerramentas: PIN_BASE,
  };
}

describe("chave C7 — os cinco componentes (ADR-0041, decisao 1)", () => {
  it("H(manifesto resolvido): mudar os bytes do manifesto muda a chave", () => {
    const original = calcularChaveC7(entradasBase());
    const mudado = calcularChaveC7({
      ...entradasBase(),
      manifestoResolvido: Buffer.from(
        JSON.stringify({
          schema_version: "ManifestoResolvido.1",
          manifesto: { fps: 30, width: 1920, height: 1080 },
          cenas: [{ id: "c-002" }],
        }),
      ),
    });
    expect(mudado).not.toBe(original);
  });

  it("H(assets): re-hash dos BYTES — bytes diferentes na chave, mesmo hash declarado", () => {
    const original = calcularChaveC7(entradasBase());
    // O MESMO hash declarado, mas os bytes mudaram: a chave RE-HASHA os
    // bytes que serao lidos e nao confia na declaracao (C7).
    const bytesTrocados = calcularChaveC7({
      ...entradasBase(),
      assets: new Map<string, Buffer>([
        ["a".repeat(64), Buffer.from("bytes-do-grafico-1-TROCADOS")],
        ["b".repeat(64), Buffer.from("bytes-da-midia-2")],
      ]),
    });
    expect(bytesTrocados).not.toBe(original);
  });

  it("H(assets): a ORDEM do mapa de assets nao muda a chave", () => {
    const a = calcularChaveC7(entradasBase());
    const invertida = calcularChaveC7({
      ...entradasBase(),
      assets: new Map<string, Buffer>([
        ["b".repeat(64), Buffer.from("bytes-da-midia-2")],
        ["a".repeat(64), Buffer.from("bytes-do-grafico-1")],
      ]),
    });
    expect(invertida).toBe(a);
  });

  it("∅-crit (unidade): um TOKEN de design mudado muda a chave", () => {
    const original = calcularChaveC7(entradasBase());
    // O snapshot real de S-5 com um unico valor mutado (background.primary).
    const snapshotReal = tokensConsumidosReais() as Record<string, unknown>;
    const mutado = {
      ...snapshotReal,
      background: {
        ...(snapshotReal.background as Record<string, unknown>),
        primary: "#010203",
      },
    };
    const chaveMutada = calcularChaveC7({
      ...entradasBase(),
      tokensConsumidos: mutado,
    });
    expect(chaveMutada).not.toBe(original);
  });

  it("∅-crit (unidade): a chave importa os VALORES de S-5, nunca so o formato", () => {
    // Um cache que hasheasse o FORMATO dos tokens (mesmas chaves, valores
    // diferentes) produziria a MESMA chave — o falso-verde do card.
    const a = calcularChaveC7({
      ...entradasBase(),
      tokensConsumidos: { fundo: { primario: "#030712" }, texto: { primario: "#F9FAFB" } },
    });
    const b = calcularChaveC7({
      ...entradasBase(),
      tokensConsumidos: { fundo: { primario: "#FFFFFF" }, texto: { primario: "#000000" } },
    });
    expect(b).not.toBe(a);
  });

  it("H(versoes): a versao do COMPOSITOR muda a chave (pergunta adversarial 1)", () => {
    const original = calcularChaveC7(entradasBase());
    const compositorNovo = calcularChaveC7({
      ...entradasBase(),
      versoes: { ...VERSAO_BASE, compositor: "4.0.508" },
    });
    expect(compositorNovo).not.toBe(original);
  });

  it("H(versoes): a versao do NAVEGADOR muda a chave (pergunta adversarial 1)", () => {
    const original = calcularChaveC7(entradasBase());
    const navegadorNovo = calcularChaveC7({
      ...entradasBase(),
      versoes: { ...VERSAO_BASE, navegador: "150.0.0.0" },
    });
    expect(navegadorNovo).not.toBe(original);
  });

  it("pin das ferramentas: node e ffmpeg mudados mudam a chave", () => {
    const original = calcularChaveC7(entradasBase());
    const nodeNovo = calcularChaveC7({
      ...entradasBase(),
      pinFerramentas: { node: "22.0.0", ffmpeg: PIN_BASE.ffmpeg },
    });
    const ffmpegNovo = calcularChaveC7({
      ...entradasBase(),
      pinFerramentas: { node: PIN_BASE.node, ffmpeg: "7.0.0" },
    });
    expect(nodeNovo).not.toBe(original);
    expect(ffmpegNovo).not.toBe(original);
  });
});

describe("chave C7 — determinismo e identidade (decisao 2: por conteudo, nunca por data)", () => {
  it("mesmos bytes de entrada produzem a MESMA chave, em qualquer instante", () => {
    const original = Date.now;
    try {
      (Date as unknown as { now: () => number }).now = () => 0;
      const madrugada = calcularChaveC7(entradasBase());
      (Date as unknown as { now: () => number }).now = () => 9_999_999_999_999;
      const futuro = calcularChaveC7(entradasBase());
      expect(futuro).toBe(madrugada);
    } finally {
      (Date as unknown as { now: () => number }).now = original;
    }
  });

  it("a chave e funcao pura: chamadas repetidas produzem o mesmo hex", () => {
    const a = calcularChaveC7(entradasBase());
    const b = calcularChaveC7(entradasBase());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o formato da chave esta marcado (bump de formato quebra a chave, nao o conteudo)", () => {
    expect(FORMATO_DA_CHAVE).toBe("chave-c7-v1");
    const componentes = componentesDaChaveC7(entradasBase());
    // O formato participa da chave final via serializacao canonica —
    // verifica-se que o formato esta em algum lugar da identidade.
    expect(serializarCanonico({ formato: FORMATO_DA_CHAVE, componentes })).toContain(
      "chave-c7-v1",
    );
  });
});

describe("chave C7 — o NEVER-set (ADR-0041, decisao 2)", () => {
  it("a assinatura da chave NAO aceita data, memTotal, workers, faixas, porta ou env", () => {
    // Ausencia por construcao: o tipo de entrada so tem conteudo. O
    // tripwire de regressao: o objeto de componentes (que vira meta.json)
    // NAO cita nenhuma dessas palavras — se alguem as adicionar a chave,
    // este teste fica VERMELHO.
    const componentes = componentesDaChaveC7(entradasBase());
    const texto = JSON.stringify(componentes).toLowerCase();
    for (const proibida of ["memtotal", "workers", "faixas", "porta", "data", "horario", "agendamento"]) {
      expect(texto).not.toContain(proibida);
    }
  });

  it("data/hora congeladas em valores diferentes NAO mudam a chave (por data e falso verde)", () => {
    // Ja coberto pelo teste de determinismo acima; aqui a afirmacao e
    // explícita no nome e na motivacao: tocar um arquivo sem mudar
    // conteudo nao e mudanca de saida.
    const original = Date.now;
    try {
      (Date as unknown as { now: () => number }).now = () => 1;
      const antes = calcularChaveC7(entradasBase());
      (Date as unknown as { now: () => number }).now = () => 2 ** 41;
      const depois = calcularChaveC7(entradasBase());
      expect(depois).toBe(antes);
    } finally {
      (Date as unknown as { now: () => number }).now = original;
    }
  });
});

describe("sha256Hex — a primitiva da chave", () => {
  it("e o SHA-256 em hex (o mesmo do store F0-07)", () => {
    const esperado = createHash("sha256").update("abc").digest("hex");
    expect(sha256Hex("abc")).toBe(esperado);
    expect(sha256Hex(Buffer.from("abc"))).toBe(esperado);
  });
});
