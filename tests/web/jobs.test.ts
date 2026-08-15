// =============================================================================
// GERENCIADOR DE JOBS (src/web/jobs.ts) — testes unitarios em processo
// =============================================================================
//
// O contrato (docs/roteiro/api.md §"Jobs assincronos" + §CLIs):
//   - todo job tem DOIS arquivos em <raiz>/.cache/roteiro/jobs/:
//     <jobId>.json (o ESTADO, reescrito pelo CLI) e <jobId>.meta.json
//     (o REGISTRO do servidor — o CLI nunca toca);
//   - escrita atomica (tmp+rename, S-8): o poll nunca le o arquivo pela
//     metade;
//   - estado "ok" so e terminal quando carrega artefato (FQ-S3: quem ve
//     o terminal ve o efeito concluido) — um "ok" do CLI sem artefato e
//     o estado intermediario e le como "rodando";
//   - estado ilegivel = job quebrado, nunca verde por vacuidade (C1):
//     normalizarEstado devolve "erro";
//   - jobs sao EFEMEROS: expiram por TTL (atualizado_em ou criado_em);
//     expirado vira null e os arquivos sao removidos (404 = "job
//     expirou").
//
// Anti-C2 (runner verde com filtro que nao casa nada): cada grupo fecha
// com uma sonda negativa sobre o ALVO do grupo — arquivo criado, estado
// lido do disco, artefato no terminal, expiracao removendo arquivos.
// =============================================================================

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GerenciadorDeJobs, escreverJsonAtomico } from "../../src/web/jobs.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Relogio injetavel: avancar(ms) move o agora; congelado por default. */
function relogioControlado(inicio = "2026-08-14T10:00:00.000Z") {
  let agora = new Date(inicio);
  return {
    agora: () => agora,
    avancar: (ms: number) => {
      agora = new Date(agora.getTime() + ms);
    },
  };
}

const raizes: string[] = [];

function novaRaiz(): string {
  const raiz = mkdtempSync(join(tmpdir(), "jobs-web-teste-"));
  raizes.push(raiz);
  return raiz;
}

function gerenciador(opcoes: Partial<ConstructorParameters<typeof GerenciadorDeJobs>[0]> = {}) {
  const relogio = opcoes.relogio !== undefined ? (opcoes.relogio as () => Date) : relogioControlado().agora;
  return new GerenciadorDeJobs({ raiz: novaRaiz(), relogio, ...opcoes });
}

function listarArquivos(raiz: string): string[] {
  return readdirSync(raiz, "utf-8");
}

afterEach(() => {
  for (const raiz of raizes.splice(0)) {
    rmSync(raiz, { recursive: true, force: true });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 1 — criacao e leitura (o contrato dos DOIS arquivos)
// ═════════════════════════════════════════════════════════════════════════════
describe("criar: estado pendente em dois arquivos (estado + meta), escrita atomica", () => {
  it("criar devolve JobStatus pendente com id job-<32 hex> e grava os DOIS arquivos", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    expect(status.id).toMatch(/^job-[0-9a-f]{32}$/);
    expect(status.estado).toBe("pendente");
    expect(status.progresso).toBeNull();
    expect(status.mensagem).toBe("Enfileirado.");
    expect(status.erro).toBeNull();
    expect(status.artefato).toBeNull();
    expect(status.criado_em).toBe(status.atualizado_em);
    // Sonda do grupo: os dois arquivos existem no disco.
    expect(existsSync(jobs.caminhoDoEstado(status.id))).toBe(true);
    expect(existsSync(join(jobs.raiz, `${status.id}.meta.json`))).toBe(true);
    // O estado inicial em disco e pendente (o CLI le/adiciona em cima).
    const noDisco = JSON.parse(readFileSync(jobs.caminhoDoEstado(status.id), "utf-8")) as { estado: string };
    expect(noDisco.estado).toBe("pendente");
  });

  it("criado_em vem do relogio injetado (determinismo da data)", () => {
    const relogio = relogioControlado("2026-08-14T10:00:00.000Z");
    const jobs = gerenciador({ relogio: relogio.agora });
    const status = jobs.criar("preview-pedaco", { projeto_id: "proj-01234567", pedaco_id: "p-001" });
    expect(status.criado_em).toBe("2026-08-14T10:00:00.000Z");
  });

  it("a leitura mergeia estado bruto do CLI com o registro do servidor (tipo/alvo do meta)", () => {
    const relogio = relogioControlado();
    const jobs = gerenciador({ relogio: relogio.agora });
    const status = jobs.criar("preview-pedaco", { projeto_id: "proj-01234567", pedaco_id: "p-002" });
    // O CLI escreve SO {estado, progresso, mensagem} (o preview nao sabe tipo).
    jobs.escreverEstado(status.id, {
      estado: "rodando",
      progresso: 0.45,
      mensagem: "Renderizando frames 240-480...",
      erro: null,
      atualizado_em: "2026-08-14T10:00:03.000Z",
    });
    const lido = jobs.lerStatus(status.id);
    expect(lido).not.toBeNull();
    // Sonda do grupo: o tipo e o alvo do meta sobrevivem ao merge.
    expect(lido!.tipo).toBe("preview-pedaco");
    expect(lido!.estado).toBe("rodando");
    expect(lido!.progresso).toBe(0.45);
    expect(lido!.mensagem).toBe("Renderizando frames 240-480...");
    expect(lido!.criado_em).toBe(status.criado_em);
    expect(lido!.atualizado_em).toBe("2026-08-14T10:00:03.000Z");
    expect(lido!.artefato).toBeNull();
  });

  it("progresso 0 sobrevive (nao e tratado como ausente); 1.5 e mantido como veio", () => {
    const jobs = gerenciador();
    const status = jobs.criar("juntar-video", { projeto_id: "proj-01234567" });
    jobs.escreverEstado(status.id, { estado: "rodando", progresso: 0, mensagem: "x", erro: null });
    expect(jobs.lerStatus(status.id)!.progresso).toBe(0);
    jobs.escreverEstado(status.id, { estado: "rodando", progresso: 1.5, mensagem: "x", erro: null });
    expect(jobs.lerStatus(status.id)!.progresso).toBe(1.5);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 2 — o terminal ok e o artefato (FQ-S3: terminal = efeito concluido)
// ═════════════════════════════════════════════════════════════════════════════
describe("finalizarOk: ok + artefato em UMA escrita atomica; ok sem artefato e intermediario", () => {
  it("finalizarOk grava estado ok com progresso 1, mensagem e artefato; o meta recebe o artefato", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    jobs.finalizarOk(status.id, { tipo: "roteiro-json", caminho: "/api/projetos/proj-01234567" }, "Roteiro gerado.");
    const lido = jobs.lerStatus(status.id);
    expect(lido!.estado).toBe("ok");
    expect(lido!.progresso).toBe(1);
    expect(lido!.mensagem).toBe("Roteiro gerado.");
    expect(lido!.erro).toBeNull();
    // Sonda do grupo: o artefato chega na MESMA leitura (nenhuma janela).
    expect(lido!.artefato).toEqual({ tipo: "roteiro-json", caminho: "/api/projetos/proj-01234567" });
    // O meta no disco tambem registra o artefato (fallback do GET por alvo).
    const metaNoDisco = JSON.parse(
      readFileSync(join(jobs.raiz, `${status.id}.meta.json`), "utf-8"),
    ) as { artefato: unknown };
    expect(metaNoDisco.artefato).toEqual({ tipo: "roteiro-json", caminho: "/api/projetos/proj-01234567" });
  });

  it("o CLI que grava \"ok\" SEM artefato e o estado intermediario: le como \"rodando\" (FQ-S3)", () => {
    const jobs = gerenciador();
    const status = jobs.criar("preview-pedaco", { projeto_id: "proj-01234567", pedaco_id: "p-001" });
    // O CLI terminou (exit 0) e gravou "ok" antes de o servidor aplicar os efeitos.
    jobs.escreverEstado(status.id, { estado: "ok", progresso: 1, mensagem: "pronto.", erro: null });
    const lido = jobs.lerStatus(status.id);
    // Nao-terminal: o poll NAO ve "ok" antes de o artefato existir.
    expect(lido!.estado).toBe("rodando");
    expect(lido!.artefato).toBeNull();
  });

  it("finalizarOk em job inexistente e no-op (sem lancar)", () => {
    const jobs = gerenciador();
    expect(() =>
      jobs.finalizarOk("job-00000000000000000000000000000000", { tipo: "video-mp4", caminho: "/x" }, "m"),
    ).not.toThrow();
    expect(jobs.lerStatus("job-00000000000000000000000000000000")).toBeNull();
  });

  it("registrarArtefato atualiza o meta (mantendo tipo/alvo/criado_em); inexistente e no-op", () => {
    const jobs = gerenciador();
    const status = jobs.criar("preview-pedaco", { projeto_id: "proj-01234567", pedaco_id: "p-001" });
    jobs.registrarArtefato(status.id, { tipo: "video-mp4", caminho: "/api/projetos/proj-01234567/pedacos/p-001/preview.mp4" });
    const metaNoDisco = JSON.parse(
      readFileSync(join(jobs.raiz, `${status.id}.meta.json`), "utf-8"),
    ) as { tipo: string; alvo: unknown; criado_em: string; artefato: unknown };
    expect(metaNoDisco.tipo).toBe("preview-pedaco");
    expect(metaNoDisco.alvo).toEqual({ projeto_id: "proj-01234567", pedaco_id: "p-001" });
    expect(metaNoDisco.artefato).toEqual({
      tipo: "video-mp4",
      caminho: "/api/projetos/proj-01234567/pedacos/p-001/preview.mp4",
    });
    const antes = listarArquivos(jobs.raiz).length;
    jobs.registrarArtefato("job-00000000000000000000000000000000", { tipo: "video-mp4", caminho: "/x" });
    // no-op: nenhum arquivo novo (nem estado nem meta do id inexistente).
    expect(listarArquivos(jobs.raiz).length).toBe(antes);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 3 — estado ilegivel e fail-closed (C1: nunca verde por vacuidade)
// ═════════════════════════════════════════════════════════════════════════════
describe("estado ilegivel = job quebrado (fail-closed)", () => {
  it("estado desconhecido no arquivo -> le como \"erro\"", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    jobs.escreverEstado(status.id, { estado: "completo", progresso: 1, mensagem: "x", erro: null });
    expect(jobs.lerStatus(status.id)!.estado).toBe("erro");
  });

  it("estado sem campo estado -> \"erro\"", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    jobs.escreverEstado(status.id, { progresso: 0.5, mensagem: "x" });
    expect(jobs.lerStatus(status.id)!.estado).toBe("erro");
  });

  it("arquivo de estado corrompido (JSON invalido) -> le \"erro\" (nao trava o poll)", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    writeFileSync(jobs.caminhoDoEstado(status.id), "isto nao e json", "utf-8");
    const lido = jobs.lerStatus(status.id);
    expect(lido!.estado).toBe("erro");
    expect(lido!.tipo).toBe("gerar-roteiro"); // o meta segue lendo
  });

  it("registro meta corrompido ou sem tipo/criado_em -> lerStatus null (registro nao existe)", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    writeFileSync(join(jobs.raiz, `${status.id}.meta.json`), "lixo", "utf-8");
    expect(jobs.lerStatus(status.id)).toBeNull();
    expect(jobs.lerRegistro(status.id)).toBeNull();
    // meta JSON valido mas sem tipo/criado_em -> o mesmo 404.
    writeFileSync(join(jobs.raiz, `${status.id}.meta.json`), JSON.stringify({ alvo: {} }), "utf-8");
    expect(jobs.lerStatus(status.id)).toBeNull();
    expect(jobs.lerRegistro(status.id)).toBeNull();
  });

  it("arquivo de estado SUMIDO do disco -> le \"erro\" (fail-closed, nunca verde)", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    rmSync(jobs.caminhoDoEstado(status.id));
    const lido = jobs.lerStatus(status.id);
    expect(lido).not.toBeNull();
    expect(lido!.estado).toBe("erro");
    expect(lido!.atualizado_em).toBe(status.criado_em); // fallback para o criado do meta
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 4 — expiracao (efemeros: 404 = "job expirou")
// ═════════════════════════════════════════════════════════════════════════════
describe("expiracao por TTL (atualizado_em; fallback criado_em)", () => {
  it("apos o TTL, lerStatus devolve null e REMOVE os arquivos", () => {
    const relogio = relogioControlado();
    const jobs = gerenciador({ relogio: relogio.agora, ttlMs: 1000 });
    const status = jobs.criar("juntar-video", { projeto_id: "proj-01234567" });
    relogio.avancar(1500);
    const lido = jobs.lerStatus(status.id);
    // Sonda do grupo: o 404 do poll nasce AQUI (null + arquivos removidos).
    expect(lido).toBeNull();
    expect(listarArquivos(jobs.raiz)).toHaveLength(0);
  });

  it("TTL 0: qualquer idade positiva expira o job na leitura", () => {
    const relogio = relogioControlado();
    const jobs = gerenciador({ relogio: relogio.agora, ttlMs: 0 });
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    // No instante exato da criacao a idade e 0 (0 > 0 e falso) — um ms
    // depois a idade e positiva e o TTL 0 expira (o poll real le depois).
    expect(jobs.lerStatus(status.id)).not.toBeNull();
    relogio.avancar(1);
    expect(jobs.lerStatus(status.id)).toBeNull();
  });

  it("dentro do TTL o job vive (a idade e medida pelo atualizado_em, nao pelo criado)", () => {
    const relogio = relogioControlado();
    const jobs = gerenciador({ relogio: relogio.agora, ttlMs: 1000 });
    const status = jobs.criar("preview-pedaco", { projeto_id: "proj-01234567", pedaco_id: "p-001" });
    relogio.avancar(900); // criado ha 900ms — dentro do TTL
    expect(jobs.lerStatus(status.id)).not.toBeNull();
    // O CLI avanca o estado: o relogio do ARQUIVO renova a idade.
    relogio.avancar(50_000);
    jobs.escreverEstado(status.id, {
      estado: "rodando",
      progresso: 0.5,
      mensagem: "x",
      erro: null,
      atualizado_em: relogio.agora().toISOString(),
    });
    expect(jobs.lerStatus(status.id)).not.toBeNull();
  });

  it("atualizado_em ilegivel cai para o criado_em do meta (e ilegivel nos dois = expirado)", () => {
    const relogio = relogioControlado();
    const jobs = gerenciador({ relogio: relogio.agora, ttlMs: 1000 });
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    // atualizado_em ilegivel, criado_em legivel e RECENTE -> vive (fallback).
    jobs.escreverEstado(status.id, { estado: "rodando", atualizado_em: "nao-e-data" });
    relogio.avancar(500);
    expect(jobs.lerStatus(status.id)).not.toBeNull();
    // criado_em do meta tambem ilegivel -> expirado (nenhuma data confiavel).
    const jobs2 = gerenciador({ relogio: relogio.agora, ttlMs: 1000 });
    const status2 = jobs2.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    writeFileSync(
      join(jobs2.raiz, `${status2.id}.meta.json`),
      JSON.stringify({ tipo: "gerar-roteiro", alvo: { projeto_id: "proj-01234567" }, criado_em: "lixo", artefato: null }),
      "utf-8",
    );
    jobs2.escreverEstado(status2.id, { estado: "rodando", atualizado_em: "lixo" });
    expect(jobs2.lerStatus(status2.id)).toBeNull();
  });

  it("lerRegistro: registro valido; meta ausente -> null", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-01234567" });
    expect(jobs.lerRegistro(status.id)).toEqual({
      id: status.id,
      tipo: "gerar-roteiro",
      alvo: { projeto_id: "proj-01234567" },
      criado_em: status.criado_em,
    });
    expect(jobs.lerRegistro("job-00000000000000000000000000000000")).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 5 — listarDoProjeto (o "jobs por alvo" do GET do projeto — derivado)
// ═════════════════════════════════════════════════════════════════════════════
describe("listarDoProjeto: filtra por projeto, expira, ordena; raiz ausente -> vazio", () => {
  it("lista so os registros do projeto, ordenados por criado_em (ascendente)", () => {
    const relogio = relogioControlado();
    const jobs = gerenciador({ relogio: relogio.agora });
    const a = jobs.criar("gerar-roteiro", { projeto_id: "proj-aaaa" });
    relogio.avancar(100);
    const b = jobs.criar("preview-pedaco", { projeto_id: "proj-aaaa", pedaco_id: "p-001" });
    relogio.avancar(100);
    const c = jobs.criar("preview-pedaco", { projeto_id: "proj-aaaa", pedaco_id: "p-002" });
    relogio.avancar(100);
    jobs.criar("gerar-roteiro", { projeto_id: "proj-bbbb" }); // outro projeto — fora
    const lista = jobs.listarDoProjeto("proj-aaaa");
    // Sonda do grupo: se o filtro nao funcionasse, proj-bbbb apareceria.
    expect(lista.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
    expect(lista[0]!.tipo).toBe("gerar-roteiro");
    expect(lista[1]!.alvo).toEqual({ projeto_id: "proj-aaaa", pedaco_id: "p-001" });
    expect(lista[2]!.alvo).toEqual({ projeto_id: "proj-aaaa", pedaco_id: "p-002" });
  });

  it("a raiz default e <cwd>/.cache/roteiro/jobs (quando o servidor nao injeta)", () => {
    const jobs = new GerenciadorDeJobs({ relogio: () => new Date("2026-08-14T10:00:00.000Z") });
    expect(jobs.raiz.endsWith(".cache/roteiro/jobs")).toBe(true);
    expect(jobs.ttlMs).toBe(60 * 60 * 1000); // o TTL default declarado (1 hora)
  });

  it("registro expirado nao aparece — e os arquivos saem do disco", () => {
    const relogio = relogioControlado();
    const jobs = gerenciador({ relogio: relogio.agora, ttlMs: 1000 });
    jobs.criar("gerar-roteiro", { projeto_id: "proj-aaaa" });
    relogio.avancar(2000);
    expect(jobs.listarDoProjeto("proj-aaaa")).toEqual([]);
    expect(listarArquivos(jobs.raiz)).toHaveLength(0);
  });

  it("raiz inexistente (nunca criada) -> [] sem lancar", () => {
    const jobs = new GerenciadorDeJobs({ raiz: join(tmpdir(), "nao-existe-", "jobs") });
    expect(jobs.listarDoProjeto("proj-aaaa")).toEqual([]);
  });

  it("meta corrompido no meio do diretorio e pulado em silencio (nao derruba a lista)", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-aaaa" });
    writeFileSync(join(jobs.raiz, `${status.id}.meta.json`), "lixo", "utf-8");
    jobs.criar("preview-pedaco", { projeto_id: "proj-aaaa", pedaco_id: "p-001" });
    const lista = jobs.listarDoProjeto("proj-aaaa");
    expect(lista).toHaveLength(1);
    expect(lista[0]!.tipo).toBe("preview-pedaco");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GRUPO 6 — remocao e escrita atomica
// ═════════════════════════════════════════════════════════════════════════════
describe("remover/removerDoProjeto e escreverJsonAtomico", () => {
  it("remover apaga estado e meta (force: ausente nao lanca)", () => {
    const jobs = gerenciador();
    const status = jobs.criar("gerar-roteiro", { projeto_id: "proj-aaaa" });
    jobs.remover(status.id);
    expect(listarArquivos(jobs.raiz)).toHaveLength(0);
    expect(() => jobs.remover(status.id)).not.toThrow();
    expect(jobs.lerStatus(status.id)).toBeNull();
  });

  it("removerDoProjeto remove so os jobs DO projeto", () => {
    const jobs = gerenciador();
    const doProjeto = jobs.criar("gerar-roteiro", { projeto_id: "proj-aaaa" });
    const deOutro = jobs.criar("gerar-roteiro", { projeto_id: "proj-bbbb" });
    jobs.removerDoProjeto("proj-aaaa");
    expect(listarArquivos(jobs.raiz).length).toBeGreaterThan(0);
    expect(jobs.lerStatus(doProjeto.id)).toBeNull();
    expect(jobs.lerStatus(deOutro.id)).not.toBeNull();
  });

  it("escreverJsonAtomico cria os diretorios e grava JSON + newline (tmp+rename)", () => {
    const raiz = novaRaiz();
    const caminho = join(raiz, "a", "b", "estado.json");
    escreverJsonAtomico(caminho, { estado: "ok", numero: 1 });
    const conteudo = readFileSync(caminho, "utf-8");
    expect(conteudo.endsWith("\n")).toBe(true);
    expect(JSON.parse(conteudo)).toEqual({ estado: "ok", numero: 1 });
    // Sonda negativa (C3): nenhum .tmp-* sobrou apos o rename.
    const sobras = listarArquivos(join(raiz, "a", "b")).filter((n) => n.includes(".tmp-"));
    expect(sobras).toEqual([]);
  });
});
