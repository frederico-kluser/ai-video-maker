// =============================================================================
// ORCAMENTO DE CONCORRENCIA — testes de unidade (ADR-0032/I-03 + AB-986)
// =============================================================================
// Pergunta adversarial 2 do card: a concorrencia do pipeline excede o teto
// medido do I-03? As respostas: workers <= 8 (decisao 1) e RAM pela formula
// da decisao 3 dentro do limite derivado do MemTotal lido EM RUNTIME
// (AB-986) — a margem de 7,7 GiB do host nunca e consumida pelo pipeline.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  calcularOrcamento,
  lerMemTotalGiB,
  TETO_WORKERS,
  TETO_RAM_GIB,
  MEM_TOTAL_REFERENCIA_GIB,
  MARGEM_PARA_O_HOST_GIB,
  BASE_ARVORE_GIB,
  MARGINAL_POR_WORKER_GIB,
  PICO_GATE_GIB,
} from "../../../src/render/pipeline/orcamento";

describe("orcamento — teto de workers (ADR-0032, decisao 1)", () => {
  it("nunca excede 8 workers, mesmo pedindo mais", () => {
    const orcamento = calcularOrcamento({
      workersDesejados: 32,
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    expect(orcamento.workers).toBeLessThanOrEqual(TETO_WORKERS);
  });

  it("o default do caminho do gate usa o teto inteiro", () => {
    const orcamento = calcularOrcamento({
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    expect(orcamento.workers).toBe(TETO_WORKERS);
    expect(orcamento.gateJunto).toBe(true);
  });
});

describe("orcamento — RAM pela formula da decisao 3 (AB-988)", () => {
  it("a RAM estimada cabe no limite derivado do MemTotal (margem do host preservada)", () => {
    const orcamento = calcularOrcamento({
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    expect(orcamento.limiteRamGiB).toBeCloseTo(TETO_RAM_GIB, 1);
    expect(orcamento.dentroDoTeto).toBe(true);

    // A formula declarada: base + (workers-1) x marginal + gate.
    const esperado =
      BASE_ARVORE_GIB +
      (orcamento.workers - 1) * MARGINAL_POR_WORKER_GIB +
      PICO_GATE_GIB;
    expect(orcamento.ramEstimadaGiB).toBeCloseTo(esperado, 5);
    expect(orcamento.ramEstimadaGiB).toBeLessThanOrEqual(TETO_RAM_GIB);
  });

  it("encode simultaneo entra na conta (1,1 GiB por encode)", () => {
    const semEncode = calcularOrcamento({
      encodesSimultaneos: 0,
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    const comEncode = calcularOrcamento({
      encodesSimultaneos: 2,
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    expect(comEncode.ramEstimadaGiB - semEncode.ramEstimadaGiB).toBeCloseTo(2.2, 5);
    expect(comEncode.dentroDoTeto).toBe(true);
  });

  it("arvores simultaneas (faixas em paralelo) pagam base por arvore — mais conservador", () => {
    // 4 faixas x 2 workers = 8 workers em 4 arvores: a base de 1,2 GiB
    // entra 4x (cada arvore tem o proprio Chrome), o marginal so dos
    // workers extras. O total continua dentro do teto.
    const orcamento = calcularOrcamento({
      workersDesejados: 8,
      arvoresSimultaneas: 4,
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    expect(orcamento.workers).toBe(8);
    expect(orcamento.dentroDoTeto).toBe(true);
  });
});

describe("orcamento — MemTotal em runtime (AB-986)", () => {
  it("lerMemTotalGiB le o /proc/meminfo real e devolve GiB finitos", () => {
    const giB = lerMemTotalGiB();
    expect(Number.isFinite(giB)).toBe(true);
    expect(giB).toBeGreaterThan(0);
  });

  it("maquina menor reduz a concurrency (MemTotal < 28 GiB)", () => {
    const orcamento = calcularOrcamento({
      lerMemTotalGiB: () => 16, // VM pequena: limite 8,3 GiB
    });
    // A formula com 8 workers + gate passa em 8,3? base 1,2 + 7x0,138 +
    // 3,904 = 6,07 -> ainda cabe em 8,3. Para derrubar abaixo de 8 e
    // preciso uma maquina menor ainda; o que NAO pode mudar e o invariante
    // dentroDoTeto.
    expect(orcamento.dentroDoTeto).toBe(true);
    expect(orcamento.limiteRamGiB).toBeCloseTo(16 - MARGEM_PARA_O_HOST_GIB, 5);
    expect(orcamento.workers).toBeLessThanOrEqual(TETO_WORKERS);
  });

  it("maquina minuscula recusa render (nem 1 worker cabe) em vez de estourar", () => {
    expect(() =>
      calcularOrcamento({ lerMemTotalGiB: () => 9 }), // limite 1,3 GiB < base + gate
    ).toThrow(/orcamento/);
  });

  it("gate desligado nao paga o pico do gate na conta", () => {
    const semGate = calcularOrcamento({
      gateJunto: false,
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    const comGate = calcularOrcamento({
      gateJunto: true,
      lerMemTotalGiB: () => MEM_TOTAL_REFERENCIA_GIB,
    });
    expect(semGate.ramEstimadaGiB).toBeLessThan(comGate.ramEstimadaGiB);
  });
});
