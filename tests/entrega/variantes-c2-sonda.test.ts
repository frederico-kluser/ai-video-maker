// =============================================================================
// VARIANTES — sonda negativa da regra C2 (bloco de legenda x safe area)
// =============================================================================
// Card: F5-04 (W7). Pergunta 2 do card / pergunta adversarial (4):
// "O bloco de legenda estoura a safe area em vertical?"
//
// A regra C2 de verificar.ts consome F3-02 (alturaDoBlocoDeLegenda e
// caixaVerticalUtil de src/sincronia/legendas/). Com os tokens atuais o
// bloco teorico de maxLines linhas CABE nas duas plataformas — o caso feliz
// e o teste de aceitacao em variantes.test.ts. Esta sonda e o caso infeliz:
// um bloco alto demais TEM de disparar a regra.
//
// O mock troca o consumo por um bloco que estoura a caixa e exige que C2
// reprove nomeando a plataforma. Se alguem apagar a regra C2 (ou o seu
// ramo de reprovacao), este teste fica VERMELHO — a sonda e o ∅-crit da
// regra, e o F3-02 real continua coberto pela suite do proprio F3-02.
// =============================================================================

import { describe, expect, it, vi } from "vitest";

// Hoisted: o mock substitui o modulo de F3-02 ANTES de verificar.ts ser
// carregado. O resolvedor do vitest resolve a alias "src" para o mesmo
// arquivo que o import relativo de verificar.ts.
vi.mock("src/sincronia/legendas/validar", () => ({
  alturaDoBlocoDeLegenda: () => 10_000,
  caixaVerticalUtil: () => ({ y: 0, altura: 100 }),
}));

import { breakpoints } from "src/design/tokens";
import { verificarBlocoDeLegenda } from "src/entrega/variantes/verificar";

describe("variantes — sonda C2: bloco de legenda que estoura a caixa fica VERMELHO", () => {
  it("a regra dispara com um bloco maior que a caixa vertical util", () => {
    const violacoes = verificarBlocoDeLegenda(breakpoints.vertical);
    expect(violacoes.length).toBeGreaterThan(0);
    expect(violacoes[0]?.regra).toBe("C2");
    expect(violacoes[0]?.mensagem).toContain("estoura");
  });
});
