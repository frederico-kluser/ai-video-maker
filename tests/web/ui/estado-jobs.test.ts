// =============================================================================
// ESTADO DE JOBS NA UI — funcoes PURAS (transicoes e regras de derivacao)
// =============================================================================
// Onda 6 (spa-frontend): derivarJob/extrairIdsDePedacos/
// verificarFalaSemNarracao de src/web/ui/src/estado-jobs.ts.
//
// A regra dura testada aqui: "ok" SO e sucesso com artefato presente —
// ok sem artefato e ERRO (FQ-U2: a UI nunca mostra sucesso sem resposta
// real; o servidor grava estado e artefato na mesma escrita atomica e a
// UI repete a conferencia — C1).
// =============================================================================

import { describe, expect, it } from "vitest";
import { derivarJob, extrairIdsDePedacos, resumoEmAndamento, verificarFalaSemNarracao } from "../../../src/web/ui/src/estado-jobs.js";
import type { Pedaco } from "../../../src/roteiro/contrato/contrato.js";
import type { JobStatus } from "../../../src/web/jobs.js";

function jobDe(parcial: Partial<JobStatus> & { estado: JobStatus["estado"] }): JobStatus {
  return {
    id: "job-x",
    tipo: "preview-pedaco",
    estado: parcial.estado,
    progresso: parcial.progresso ?? null,
    mensagem: parcial.mensagem ?? "",
    erro: parcial.erro ?? null,
    criado_em: "2026-08-14T10:00:00.000Z",
    atualizado_em: "2026-08-14T10:00:03.000Z",
    artefato: parcial.artefato ?? null,
  };
}

function pedacoDe(parcial: Partial<Pedaco>): Pedaco {
  return {
    id: "p-000",
    indice: 0,
    titulo: "titulo",
    fala: "",
    duracao_segundos: 10,
    tipo_visual: "texto",
    especificacao_visual: "visual",
    detalhes_de_producao: "detalhes",
    narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    ...parcial,
  };
}

describe("derivarJob — transicoes pendente -> rodando -> ok/erro", () => {
  it("sem job e sem resumo = nenhum (a UI nao renderiza barra)", () => {
    expect(derivarJob(null)).toEqual({
      estado: "nenhum",
      progresso: null,
      mensagem: "",
      artefato: null,
      okSemArtefato: false,
    });
  });

  it("pendente -> rodando -> ok mantem o progresso para a barra", () => {
    const pendente = derivarJob(jobDe({ estado: "pendente", progresso: 0 }));
    expect(pendente.estado).toBe("pendente");

    const rodando = derivarJob(jobDe({ estado: "rodando", progresso: 0.45 }));
    expect(rodando.estado).toBe("rodando");
    expect(rodando.progresso).toBe(0.45);

    const ok = derivarJob(jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "video-mp4", caminho: "/api/.../preview.mp4" } }));
    expect(ok.estado).toBe("ok");
    expect(ok.artefato?.caminho).toBe("/api/.../preview.mp4");
    expect(ok.okSemArtefato).toBe(false);
  });

  it("ok SEM artefato e ERRO honesto (C1/FQ-U2 — sucesso mentiroso)", () => {
    const derivado = derivarJob(jobDe({ estado: "ok", progresso: 1 }));
    expect(derivado.estado).toBe("erro");
    expect(derivado.okSemArtefato).toBe(true);
    expect(derivado.mensagem).toContain("artefato");
  });

  it("erro terminal traz a saida REAL do CLI (FQ-S3), nunca mensagem generica", () => {
    const derivado = derivarJob(
      jobDe({ estado: "erro", erro: "manim: Scene nonexistent", mensagem: "erro interno" }),
    );
    expect(derivado.estado).toBe("erro");
    expect(derivado.mensagem).toBe("manim: Scene nonexistent");
  });

  it("erro terminal sem campo erro cai para a mensagem do job", () => {
    const derivado = derivarJob(jobDe({ estado: "erro", erro: null, mensagem: "falhou" }));
    expect(derivado.mensagem).toBe("falhou");
  });

  it("resumo do GET projeto responde quando o job vivo nao existe", () => {
    const derivado = derivarJob(null, { estado: "rodando", progresso: 0.5 });
    expect(derivado.estado).toBe("rodando");
    expect(derivado.progresso).toBe(0.5);
  });

  it("resumo com estado desconhecido vira nenhum (nunca estado inventado)", () => {
    expect(derivarJob(null, { estado: "misterioso" }).estado).toBe("nenhum");
    expect(derivarJob(null, {}).estado).toBe("nenhum");
  });

  it("o job vivo vence o resumo (o poll traz o estado mais fresco)", () => {
    const derivado = derivarJob(jobDe({ estado: "ok", artefato: { tipo: "audio-wav", caminho: "/x" } }), {
      estado: "rodando",
    });
    expect(derivado.estado).toBe("ok");
  });
});

describe("derivarJob — erro do envelope vence o derivado (FQ-U4)", () => {
  it("poll que expira (job-expirou) vira erro com a mensagem do envelope, nunca 'Em andamento…'", () => {
    const derivado = derivarJob(
      jobDe({ estado: "rodando", progresso: 0.5 }),
      { estado: "rodando", progresso: 0.5 },
      { mensagem: "o job expirou — refaca a operacao" },
    );
    expect(derivado.estado).toBe("erro");
    expect(derivado.mensagem).toBe("o job expirou — refaca a operacao");
  });

  it("409 do POST (sem job, sem resumo) vira erro com a mensagem do envelope", () => {
    const derivado = derivarJob(null, null, { mensagem: "anexo obrigatorio para gif/video" });
    expect(derivado.estado).toBe("erro");
    expect(derivado.mensagem).toBe("anexo obrigatorio para gif/video");
  });

  it("o erro da ultima acao vence o 'ok' de um job anterior (nunca sucesso mentiroso)", () => {
    const derivado = derivarJob(
      jobDe({ estado: "ok", progresso: 1, artefato: { tipo: "video-mp4", caminho: "/api/.../preview.mp4" } }),
      { estado: "ok" },
      { mensagem: "regenerar recusado: pedaco em uso" },
    );
    expect(derivado.estado).toBe("erro");
    expect(derivado.mensagem).toBe("regenerar recusado: pedaco em uso");
    expect(derivado.okSemArtefato).toBe(false);
  });

  it("o erro do poll vence o terminal 'erro' do job (a mensagem do envelope e a da ultima acao)", () => {
    const derivado = derivarJob(
      jobDe({ estado: "erro", erro: "manim: saida antiga", mensagem: "antiga" }),
      null,
      { mensagem: "o job demorou demais — verifique o servidor e tente de novo" },
    );
    expect(derivado.estado).toBe("erro");
    expect(derivado.mensagem).toBe("o job demorou demais — verifique o servidor e tente de novo");
  });

  it("sem erro de API o comportamento anterior permanece (parametro opcional)", () => {
    expect(derivarJob(jobDe({ estado: "rodando", progresso: 0.3 }), null, null).estado).toBe("rodando");
    expect(derivarJob(jobDe({ estado: "rodando", progresso: 0.3 }), null, undefined).estado).toBe("rodando");
  });
});

describe("resumoEmAndamento", () => {
  it("pendente e rodando contam como andamento; terminal e ausencia nao", () => {
    expect(resumoEmAndamento({ estado: "pendente" })).toBe(true);
    expect(resumoEmAndamento({ estado: "rodando" })).toBe(true);
    expect(resumoEmAndamento({ estado: "ok" })).toBe(false);
    expect(resumoEmAndamento({ estado: "erro" })).toBe(false);
    expect(resumoEmAndamento(null)).toBe(false);
    expect(resumoEmAndamento(undefined)).toBe(false);
  });
});

describe("extrairIdsDePedacos — a lista do 409 juntar-fala-sem-narracao", () => {
  it("extrai os ids p-XXX do formato do servidor (validar.ts)", () => {
    const detalhes = [
      "pedacos[0].id p-000: regra juntar-fala-sem-narracao — fala nao narrada (origem \"nenhuma\")",
      "pedacos[2].id p-002: regra juntar-fala-sem-narracao — fala nao narrada (origem \"nenhuma\")",
    ];
    expect(extrairIdsDePedacos(detalhes)).toEqual(["p-000", "p-002"]);
  });

  it("detalhes vazio ou ausente devolve lista vazia (sem ids fantasma)", () => {
    expect(extrairIdsDePedacos(undefined)).toEqual([]);
    expect(extrairIdsDePedacos([])).toEqual([]);
  });

  it("linha fora do formato nao produz id (extracao por forma, nunca por texto solto)", () => {
    expect(extrairIdsDePedacos(["alguma outra mensagem sem id"])).toEqual([]);
  });
});

describe("verificarFalaSemNarracao — a pre-verificacao record-first", () => {
  it("pedaco com fala e origem nenhuma entra na lista", () => {
    const pedacos = [
      pedacoDe({ id: "p-000", fala: "texto narrado", narracao: { texto: "", origem: "nenhuma", status: "vazio" } }),
      pedacoDe({ id: "p-001", fala: "", narracao: { texto: "", origem: "nenhuma", status: "vazio" } }),
      pedacoDe({ id: "p-002", fala: "gravada", narracao: { texto: "gravada", origem: "gravacao", status: "gerado", hash_audio: "h" } }),
    ];
    expect(verificarFalaSemNarracao(pedacos)).toEqual(["p-000"]);
  });

  it("fala vazia e origem tts/gravacao nunca entram (o 409 e o gate real)", () => {
    const pedacos = [
      pedacoDe({ id: "p-000", fala: "", narracao: { texto: "", origem: "nenhuma", status: "vazio" } }),
      pedacoDe({ id: "p-001", fala: "tts", narracao: { texto: "tts", origem: "tts", status: "gerado" } }),
    ];
    expect(verificarFalaSemNarracao(pedacos)).toEqual([]);
  });
});
