/**
 * tests/roteiro/gerador.test.ts
 *
 * As perguntas falsificaveis do GERADOR de roteiro (Onda 2):
 *
 *   FQ-G1  gerar o MESMO brief 2x com cache quente = mesma saida e ZERO
 *          chamadas ao provedor (sonda de chamadas);
 *   FQ-G2  regenerar UM pedaco NAO invalida o cache dos demais pedacos
 *          (irmaos intactos byte a byte; id p-XXX com sufixo == indice
 *          preservado);
 *   FQ-G3  edicao do usuario na fala entra na chave — mudou a fala,
 *          mudou a saida (miss);
 *   FQ-G4  saida do provedor INvalida e rejeitada com erro NOMEADO
 *          (ErroContratoRoteiro) — JSON malformado nunca e aceito em
 *          silencio;
 *   FQ-G5  o provedor sosia funciona sem rede e sem credencial, pinado
 *          a tipo_visual "texto".
 *
 * Mais: a politica RECORD-FIRST (todo pedaco sai com narracao
 * {texto:"", origem:"nenhuma", status:"vazio"} e NUNCA gif/video na
 * primeira geracao — anexo e decisao do usuario), o cassete de replay
 * offline e o provedor LLM com fetch injetado (o guarda de rede do
 * vitest bloqueia fetch IN-PROCESS — nenhum teste toca a rede real).
 *
 * Sonda negativa anti-C2 por grupo: cada grupo termina com um teste que
 * FALHARIA se o comportamento testado parasse de acontecer (cache que
 * nao serve, gate que aceita tudo, sosia que emite outro tipo...).
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chaveDeCacheGerador } from "../../src/roteiro/contrato/cache.js";
import { resumoDePedacos } from "../../src/roteiro/contrato/canonicalizar.js";
import type {
  NarracaoPedaco,
  Pedaco,
  PedidoGerarRoteiro,
  PedidoRegenerarPedaco,
  Roteiro,
} from "../../src/roteiro/contrato/contrato.js";
import { gerarRoteiro, regenerarPedaco } from "../../src/roteiro/gerador/gerador.js";
import {
  caminhoDoCache,
  chaveDoStore,
  definirDiretorioCache,
  sha256,
} from "../../src/roteiro/gerador/cache.js";
import { montarPromptRoteiro } from "../../src/roteiro/gerador/prompt.js";
import {
  ECasseteRoteiroAusente,
  EProvedorRoteiroFalhou,
  ProvedorSosiaRoteiro,
  criarProvedorCasseteRoteiro,
  criarProvedorLlm,
  fingerprintDoSchemaPodado,
  gravarCasseteRoteiro,
} from "../../src/roteiro/gerador/provedor.js";
import type { ProvedorRoteiro } from "../../src/roteiro/gerador/provedor.js";
import { ErroContratoRoteiro } from "../../src/roteiro/contrato/rejeitar.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Um PedidoGerarRoteiro valido (as versoes do contrato corrente). */
function pedidoGerar(
  sobrescrita: Partial<PedidoGerarRoteiro> = {},
): PedidoGerarRoteiro {
  return {
    brief: {
      tema: "Como funciona um cache de computador",
      contexto: "Video para iniciantes",
    },
    duracao_alvo_segundos: 30,
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

/** Um pedaco valido para usar como alvo de regeneracao. */
function pedacoAlvo(sobrescrita: Partial<Pedaco> = {}): Pedaco {
  return {
    id: "p-001",
    indice: 1,
    titulo: "O que e um cache",
    fala: "Um cache guarda o resultado de uma conta para nao refaze-la.",
    duracao_segundos: 12.5,
    tipo_visual: "manim",
    especificacao_visual: "Animacao estilo 3b1b com shapes",
    detalhes_de_producao: "Cena Manim via estagio grafico",
    narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    ...sobrescrita,
  };
}

/** Um PedidoRegenerarPedaco valido. */
function pedidoRegenerar(
  sobrescrita: Partial<PedidoRegenerarPedaco> = {},
): PedidoRegenerarPedaco {
  return {
    brief: { tema: "Como funciona um cache de computador" },
    duracao_alvo_segundos: 30,
    pedaco_atual: pedacoAlvo(),
    resumo_demais_pedacos: resumoDePedacos([{ id: "p-000" }, { id: "p-002" }]),
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

/** Um diretorio de cache novo (tmp) para cada teste. */
function cacheTmp(): string {
  return mkdtempSync(join(tmpdir(), "roteiro-cache-teste-"));
}

/** Envolve um provedor com uma sonda de chamadas (FQ-G1). */
function provedorComSonda(
  provedor: ProvedorRoteiro,
  contador: { chamadas: number },
): ProvedorRoteiro {
  return {
    nome: provedor.nome,
    async gerarRoteiroCompleto(prompt: string): Promise<unknown> {
      contador.chamadas++;
      return provedor.gerarRoteiroCompleto(prompt);
    },
    async regenerarPedaco(prompt: string): Promise<unknown> {
      contador.chamadas++;
      return provedor.regenerarPedaco(prompt);
    },
  };
}

/** Um roteiro valido (forma de schema) para provedores mock. */
function roteiroValido(): Roteiro {
  return {
    schema_version: "Roteiro.1",
    pedacos: [
      {
        id: "p-000",
        indice: 0,
        titulo: "Abertura",
        fala: "",
        duracao_segundos: 4,
        tipo_visual: "cabecalho",
        especificacao_visual: "Titulo em destaque",
        detalhes_de_producao: "Composicao de cabecalho",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
      {
        id: "p-001",
        indice: 1,
        titulo: "O que e um cache",
        fala: "Um cache guarda resultados para nao recalcular.",
        duracao_segundos: 8,
        tipo_visual: "texto",
        especificacao_visual: "Texto em destaque com a definicao",
        detalhes_de_producao: "Slide de texto",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
    ],
    duracao_total_segundos: 12,
  };
}

// ─── FQ-G1: cache por hash (miss → chama → grava; hit → ZERO chamadas) ────────

describe("FQ-G1 — o cache do gerador: mesmo brief 2x = mesma saida, zero chamadas no hit", () => {
  it("1a chamada = chamada real; 2a = cache, com a sonda contando ZERO chamadas novas", async () => {
    const contador = { chamadas: 0 };
    const provedor = provedorComSonda(new ProvedorSosiaRoteiro(), contador);
    const diretorio = cacheTmp();

    const primeira = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(primeira.origem).toBe("chamada");
    expect(contador.chamadas).toBe(1);

    const segunda = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(segunda.origem).toBe("cache");
    expect(contador.chamadas).toBe(1); // a sonda: o hit NAO chamou o provedor
    expect(JSON.stringify(segunda.roteiro)).toBe(JSON.stringify(primeira.roteiro));
  });

  it("regenerar o MESMO pedido 2x: 1a = chamada, 2a = cache (zero chamadas novas)", async () => {
    const contador = { chamadas: 0 };
    const provedor = provedorComSonda(new ProvedorSosiaRoteiro(), contador);
    const diretorio = cacheTmp();
    const pedido = pedidoRegenerar();

    const primeira = await regenerarPedaco(pedido, { provedor, diretorioCache: diretorio });
    expect(primeira.origem).toBe("chamada");
    expect(contador.chamadas).toBe(1);

    const segunda = await regenerarPedaco(pedido, { provedor, diretorioCache: diretorio });
    expect(segunda.origem).toBe("cache");
    expect(contador.chamadas).toBe(1);
    expect(JSON.stringify(segunda.pedaco)).toBe(JSON.stringify(primeira.pedaco));
  });

  it("SONDA NEGATIVA: com cache quente e provedor que LANCARIA, o cache serve — um miss silencioso cairia no throw", async () => {
    const diretorio = cacheTmp();
    // Aquece o cache com o sosia.
    const resultado = await gerarRoteiro(pedidoGerar(), {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: diretorio,
    });
    // Troca o provedor por um que LANCARIA se fosse chamado.
    const provedorQueLanca: ProvedorRoteiro = {
      nome: "lancador",
      async gerarRoteiroCompleto(): Promise<unknown> {
        throw new Error("o provedor foi chamado — o cache nao serviu");
      },
      async regenerarPedaco(): Promise<unknown> {
        throw new Error("o provedor foi chamado — o cache nao serviu");
      },
    };
    const hit = await gerarRoteiro(pedidoGerar(), { provedor: provedorQueLanca, diretorioCache: diretorio });
    expect(hit.origem).toBe("cache");
    expect(JSON.stringify(hit.roteiro)).toBe(JSON.stringify(resultado.roteiro));
  });

  it("cache CORROMPIDO = MISS: a geracao regenera, nunca quebra, e o gate revalida", async () => {
    const contador = { chamadas: 0 };
    const provedor = provedorComSonda(new ProvedorSosiaRoteiro(), contador);
    const diretorio = cacheTmp();

    const primeiro = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(primeiro.origem).toBe("chamada");
    // Corrompe o arquivo de cache (JSON quebrado).
    writeFileSync(caminhoDoCache(primeiro.chave), "{ quebrado !!!", "utf-8");

    const regenerado = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(regenerado.origem).toBe("chamada");
    expect(contador.chamadas).toBe(2);
    expect(JSON.stringify(regenerado.roteiro)).toBe(JSON.stringify(primeiro.roteiro));
  });

  it("o PROMPT entra na chave do store (C12): prompt mudou sem bump de versao = chave diferente, nunca resultado velho para prompt novo", async () => {
    const diretorio = cacheTmp();
    const pedido = pedidoGerar();
    const contador = { chamadas: 0 };
    const provedor = provedorComSonda(new ProvedorSosiaRoteiro(), contador);

    // Primeira geracao com o prompt PADRAO (biblioteca commitada).
    const comPadrao = await gerarRoteiro(pedido, { provedor, diretorioCache: diretorio });
    expect(comPadrao.origem).toBe("chamada");
    expect(contador.chamadas).toBe(1);

    // Mesma entrada, prompt ALTERNATIVO (outro arquivo de prompt):
    // a chave do store muda (C12) — MISS de novo, nao cache do prompt antigo.
    const caminhoPromptAlternativo = join(cacheTmp(), "prompt-alternativo.md");
    writeFileSync(caminhoPromptAlternativo, "versao: 9.9.9\n\nOutro prompt de roteirista.\n", "utf-8");
    const comAlternativo = await gerarRoteiro(pedido, {
      provedor,
      diretorioCache: diretorio,
      caminhoPromptRoteirista: caminhoPromptAlternativo,
    });
    expect(comAlternativo.origem).toBe("chamada");
    expect(contador.chamadas).toBe(2);
    expect(comAlternativo.chave).not.toBe(comPadrao.chave);

    // A composicao e pura: mesma chave do contrato, prompts diferentes,
    // chaves do store diferentes (o fingerprint do schema entra na chave
    // desde o REPLAN P1 — mesmo fingerprint, a comparacao isola o prompt).
    const contrato = chaveDeCacheGerador(pedido);
    const fingerprint = fingerprintDoSchemaPodado("completo");
    expect(chaveDoStore(contrato, "prompt A", fingerprint)).not.toBe(
      chaveDoStore(contrato, "prompt B", fingerprint),
    );
    expect(chaveDoStore(contrato, "prompt A", fingerprint)).toBe(
      chaveDoStore(contrato, "prompt A", fingerprint),
    );
  });

  it("CACHE ENVENENADO com conteudo valido mas INVALIDO e rejeitado pelo gate (nunca entra no pipeline)", async () => {
    const diretorio = cacheTmp();
    const primeiro = await gerarRoteiro(pedidoGerar(), {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: diretorio,
    });
    // Grava por cima um roteiro invalido (tipo_visual desconhecido) sob a MESMA chave.
    const envenenado = { ...primeiro.roteiro, pedacos: [{ ...primeiro.roteiro.pedacos[0], tipo_visual: "desconhecido" }] };
    writeFileSync(caminhoDoCache(primeiro.chave), JSON.stringify(envenenado), "utf-8");

    await expect(
      gerarRoteiro(pedidoGerar(), { provedor: new ProvedorSosiaRoteiro(), diretorioCache: diretorio }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });
});

// ─── FQ-G2: regenerar UM pedaco NAO muda os irmaos ────────────────────────────

describe("FQ-G2 — regenerar um pedaco nao invalida o cache dos demais (irmaos byte a byte)", () => {
  it("regenerar UM pedaco NAO invalida o cache do roteiro: os irmaos (no roteiro cacheado) ficam HIT, id/indice preservados", async () => {
    const contador = { chamadas: 0 };
    const provedor = provedorComSonda(new ProvedorSosiaRoteiro(), contador);
    const diretorio = cacheTmp();
    const gerado = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(gerado.origem).toBe("chamada");
    expect(contador.chamadas).toBe(1);
    const roteiro = gerado.roteiro;
    expect(roteiro.pedacos.length).toBeGreaterThanOrEqual(2);

    const alvo = roteiro.pedacos[1]!;
    const irmaos = roteiro.pedacos.filter((p) => p.id !== alvo.id);
    const hashDosIrmaos = irmaos.map((p) => JSON.stringify(p));

    const regenerado = await regenerarPedaco(
      pedidoRegenerar({
        brief: pedidoGerar().brief,
        pedaco_atual: alvo,
        resumo_demais_pedacos: resumoDePedacos(irmaos),
      }),
      { provedor, diretorioCache: diretorio },
    );
    expect(regenerado.origem).toBe("chamada");
    expect(regenerado.pedaco.id).toBe(alvo.id); // p-XXX com sufixo == indice preservado
    expect(regenerado.pedaco.indice).toBe(alvo.indice);

    // "hash do roteiro anterior nos demais": o roteiro INTEIRO continua
    // em cache e o HIT nao chama o provedor — a regeneracao de um pedaco
    // nao invalidou o cache dos irmaos (FQ-G2).
    const hit = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: diretorio });
    expect(hit.origem).toBe("cache");
    expect(contador.chamadas).toBe(2); // 1 do roteiro + 1 da regeneracao, zero a mais
    expect(hit.roteiro.pedacos.filter((p) => p.id !== alvo.id).map((p) => JSON.stringify(p)))
      .toEqual(hashDosIrmaos);
  });

  it("SONDA NEGATIVA: a regeneracao FEZ algo — o pedaco novo difere do alvo (nao devolve o mesmo)", async () => {
    const diretorio = cacheTmp();
    const gerado = await gerarRoteiro(pedidoGerar(), {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: diretorio,
    });
    const alvo = gerado.roteiro.pedacos[1]!;
    const irmaos = gerado.roteiro.pedacos.filter((p) => p.id !== alvo.id);

    const regenerado = await regenerarPedaco(
      pedidoRegenerar({
        brief: pedidoGerar().brief,
        pedaco_atual: alvo,
        resumo_demais_pedacos: resumoDePedacos(irmaos),
      }),
      { provedor: new ProvedorSosiaRoteiro(), diretorioCache: diretorio },
    );
    expect(regenerado.pedaco.fala).not.toBe(alvo.fala);
  });

  it("a EDICAO do usuario no alvo sobrevive na regeneracao (pedaco_atual com edicao aplicada valida)", async () => {
    const diretorio = cacheTmp();
    const editado = pedacoAlvo({ fala: "Fala EDITADA pelo usuario no roteiro." });
    const resultado = await regenerarPedaco(
      pedidoRegenerar({ pedaco_atual: editado }),
      { provedor: new ProvedorSosiaRoteiro(), diretorioCache: diretorio },
    );
    expect(resultado.pedaco.id).toBe("p-001");
    expect(resultado.pedaco.indice).toBe(1);
  });
});

// ─── FQ-G3: a edicao do usuario entra na chave e na saida ─────────────────────

describe("FQ-G3 — edicao do usuario na fala: mudou a fala, mudou a chave (MISS) e a saida", () => {
  it("fala editada → chave diferente → MISS (sonda: o provedor foi chamado de novo)", async () => {
    const contador = { chamadas: 0 };
    const provedor = provedorComSonda(new ProvedorSosiaRoteiro(), contador);
    const diretorio = cacheTmp();
    const original = pedidoRegenerar();
    const editado = pedidoRegenerar({
      pedaco_atual: pedacoAlvo({ fala: "Fala EDITADA pelo usuario." }),
    });

    expect(chaveDeCacheGerador(editado)).not.toBe(chaveDeCacheGerador(original));

    await regenerarPedaco(original, { provedor, diretorioCache: diretorio });
    expect(contador.chamadas).toBe(1);
    const resultadoEditado = await regenerarPedaco(editado, { provedor, diretorioCache: diretorio });
    expect(resultadoEditado.origem).toBe("chamada"); // a edicao quebrou o cache (miss)
    expect(contador.chamadas).toBe(2);
  });

  it("SONDA NEGATIVA deterministica: o prompt da regeneracao CONTEM a fala editada, e a saida muda", async () => {
    const diretorio = cacheTmp();
    // Provedor que ECOA a fala editada do prompt na saida — a prova de que
    // a edicao chega ao provedor e de que saidas diferentes saem.
    const provedorEco: ProvedorRoteiro = {
      nome: "eco",
      async gerarRoteiroCompleto(): Promise<unknown> {
        return roteiroValido();
      },
      async regenerarPedaco(prompt: string): Promise<unknown> {
        const editada = prompt.includes("Fala EDITADA pelo usuario") ? "SIM" : "NAO";
        return {
          ...pedacoAlvo(),
          fala: `O provedor viu a edicao: ${editada}`,
        };
      },
    };
    const editado = pedidoRegenerar({
      pedaco_atual: pedacoAlvo({ fala: "Fala EDITADA pelo usuario." }),
    });
    const resultado = await regenerarPedaco(editado, { provedor: provedorEco, diretorioCache: diretorio });
    expect(resultado.pedaco.fala).toBe("O provedor viu a edicao: SIM");
    // E a versao sem edicao produz outra saida — a saida MUDOU com a fala.
    const semEdicao = await regenerarPedaco(
      pedidoRegenerar(),
      { provedor: provedorEco, diretorioCache: diretorio },
    );
    expect(semEdicao.pedaco.fala).toBe("O provedor viu a edicao: NAO");
    expect(semEdicao.pedaco.fala).not.toBe(resultado.pedaco.fala);
  });

  it("o ANEXO no pedaco_atual entra na chave (C12) e o regenerado gif/video recebe o anexo do USUARIO", async () => {
    const diretorio = cacheTmp();
    const comAnexo = pedidoRegenerar({
      pedaco_atual: pedacoAlvo({
        tipo_visual: "gif",
        anexo_hash: "9d7cc2b731dde14beafe804f1f52b0d3fd1c9991da9561a1b250e1ae6cbd6dd4",
        anexo_meta: { tipo: "image/gif", tamanho_bytes: 98320, nome_original: "anexo.gif" },
      }),
    });
    const semAnexo = pedidoRegenerar();
    expect(chaveDeCacheGerador(comAnexo)).not.toBe(chaveDeCacheGerador(semAnexo));

    // Provedor que devolve um pedaco gif/video SEM anexo: a normalizacao
    // reaplica o anexo do USUARIO (nunca um hash inventado pelo provedor).
    const provedorGif: ProvedorRoteiro = {
      nome: "gif",
      async gerarRoteiroCompleto(): Promise<unknown> {
        return roteiroValido();
      },
      async regenerarPedaco(): Promise<unknown> {
        return { ...pedacoAlvo(), tipo_visual: "gif", fala: "Fala nova do gif." };
      },
    };
    const resultado = await regenerarPedaco(comAnexo, { provedor: provedorGif, diretorioCache: diretorio });
    expect(resultado.pedaco.tipo_visual).toBe("gif");
    expect(resultado.pedaco.anexo_hash).toBe(comAnexo.pedaco_atual.anexo_hash);
    expect(resultado.pedaco.anexo_meta).toEqual(comAnexo.pedaco_atual.anexo_meta);
  });

  it("gif/video SEM anexo no pedido continua rejeitado pelo gate (anexo-exigido-para-gif-video)", async () => {
    const diretorio = cacheTmp();
    const pedido = pedidoRegenerar({
      pedaco_atual: pedacoAlvo({ tipo_visual: "gif" }), // gif sem anexo → pedido INVALIDO
    });
    await expect(
      regenerarPedaco(pedido, { provedor: new ProvedorSosiaRoteiro(), diretorioCache: diretorio }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });
});

// ─── FQ-G4: saida invalida do provedor e rejeitada com erro nomeado ───────────

describe("FQ-G4 — saida do provedor INvalida e rejeitada com erro NOMEADO (nunca JSON malformado em silencio)", () => {
  it("resposta que nem e objeto → ErroContratoRoteiro", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "malformado",
      async gerarRoteiroCompleto(): Promise<unknown> {
        return "isto nao e JSON de roteiro";
      },
      async regenerarPedaco(): Promise<unknown> {
        return 42;
      },
    };
    await expect(
      gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() }),
    ).rejects.toThrow(ErroContratoRoteiro);
    await expect(
      regenerarPedaco(pedidoRegenerar(), { provedor, diretorioCache: cacheTmp() }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });

  it("roteiro com pedacos fora do schema (campo extra) → erro com a regra/additionalProperties", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "campo-extra",
      async gerarRoteiroCompleto(): Promise<unknown> {
        const valido = roteiroValido();
        return {
          ...valido,
          pedacos: [{ ...valido.pedacos[0], campo_inventado: "x" }],
        };
      },
      async regenerarPedaco(): Promise<unknown> {
        return { ...pedacoAlvo(), campo_inventado: "x" };
      },
    };
    let erro: unknown;
    try {
      await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() });
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroContratoRoteiro);
    expect((erro as ErroContratoRoteiro).name).toBe("ErroContratoRoteiro");
    expect((erro as ErroContratoRoteiro).message).toContain("campo_inventado");

    await expect(
      regenerarPedaco(pedidoRegenerar(), { provedor, diretorioCache: cacheTmp() }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });

  it("gif/video na PRIMEIRA geracao e rejeitado com a regra anexo-exigido-para-gif-video (nunca emitido)", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "gif-primeira-geracao",
      async gerarRoteiroCompleto(): Promise<unknown> {
        const valido = roteiroValido();
        return {
          ...valido,
          pedacos: [
            { ...valido.pedacos[0] },
            { ...valido.pedacos[1], tipo_visual: "gif" },
          ],
        };
      },
      async regenerarPedaco(): Promise<unknown> {
        return roteiroValido();
      },
    };
    let erro: unknown;
    try {
      await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() });
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ErroContratoRoteiro);
    expect((erro as ErroContratoRoteiro).message).toContain("anexo-exigido-para-gif-video");
  });

  it("gif com ANEXO inventado pelo provedor: a normalizacao remove o anexo e o gate REJEITA (C7 — hash fake nunca entra)", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "gif-com-anexo-fake",
      async gerarRoteiroCompleto(): Promise<unknown> {
        const valido = roteiroValido();
        return {
          ...valido,
          pedacos: [
            { ...valido.pedacos[0] },
            {
              ...valido.pedacos[1],
              tipo_visual: "gif",
              anexo_hash: "9d7cc2b731dde14beafe804f1f52b0d3fd1c9991da9561a1b250e1ae6cbd6dd4",
              anexo_meta: { tipo: "image/gif", tamanho_bytes: 98320, nome_original: "fake.gif" },
            },
          ],
        };
      },
      async regenerarPedaco(): Promise<unknown> {
        return roteiroValido();
      },
    };
    await expect(
      gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() }),
    ).rejects.toThrow(ErroContratoRoteiro);
  });

  it("SONDA NEGATIVA: a saida VALIDA do provedor passa — o gate nao rejeita tudo", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "valido",
      async gerarRoteiroCompleto(): Promise<unknown> {
        return roteiroValido();
      },
      async regenerarPedaco(): Promise<unknown> {
        return pedacoAlvo({ fala: "Fala nova valida." });
      },
    };
    const resultado = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() });
    expect(resultado.roteiro.pedacos.length).toBe(2);
    const regenerado = await regenerarPedaco(pedidoRegenerar(), {
      provedor,
      diretorioCache: cacheTmp(),
    });
    expect(regenerado.pedaco.id).toBe("p-001");
  });
});

// ─── RECORD-FIRST: todo pedaco gerado sai com narracao vazia ──────────────────

describe("RECORD-FIRST — o gerador nunca emite narracao; todo pedaco sai com narracao {texto:'', origem:'nenhuma', status:'vazio'}", () => {
  const NARRACAO_ESPERADA: NarracaoPedaco = {
    texto: "",
    origem: "nenhuma",
    status: "vazio",
  };

  it("provedor que EMITE narracao (origem tts) tem a narracao zerada na saida — fala preservada", async () => {
    const provedor: ProvedorRoteiro = {
      nome: "com-narracao",
      async gerarRoteiroCompleto(): Promise<unknown> {
        const valido = roteiroValido();
        return {
          ...valido,
          pedacos: valido.pedacos.map((p) => ({
            ...p,
            fala: p.fala === "" ? "" : "Fala com narracao.",
            narracao: { texto: "Fala com narracao.", origem: "tts", status: "gerado" },
          })),
        };
      },
      async regenerarPedaco(): Promise<unknown> {
        return {
          ...pedacoAlvo(),
          fala: "Fala regenerada.",
          narracao: { texto: "Fala regenerada.", origem: "tts", status: "gerado" },
        };
      },
    };
    const resultado = await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() });
    for (const pedaco of resultado.roteiro.pedacos) {
      expect(pedaco.narracao).toEqual(NARRACAO_ESPERADA);
    }
    expect(resultado.roteiro.pedacos[1]?.fala).toBe("Fala com narracao."); // a fala nao muda

    const regenerado = await regenerarPedaco(pedidoRegenerar(), {
      provedor,
      diretorioCache: cacheTmp(),
    });
    expect(regenerado.pedaco.narracao).toEqual(NARRACAO_ESPERADA);
  });

  it("SONDA NEGATIVA: TODOS os pedacos (loop, nao amostra) saem record-first no fluxo sosia completo", async () => {
    const resultado = await gerarRoteiro(pedidoGerar(), {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: cacheTmp(),
    });
    expect(resultado.roteiro.pedacos.length).toBeGreaterThanOrEqual(2);
    for (const pedaco of resultado.roteiro.pedacos) {
      expect(pedaco.narracao).toEqual(NARRACAO_ESPERADA);
      // Anexo nunca vem do gerador (em nenhum tipo de pedaco).
      expect(pedaco.anexo_hash).toBeUndefined();
      expect(pedaco.anexo_meta).toBeUndefined();
    }
  });
});

// ─── FQ-G5: o sosia funciona sem rede e sem credencial, pinado a "texto" ──────

describe("FQ-G5 — o provedor sosia: sem rede, sem credencial, pinado a tipo_visual 'texto'", () => {
  it("gera um roteiro valido com ZERO fetch e ZERO chave (nada injetado)", async () => {
    const resultado = await gerarRoteiro(pedidoGerar(), {
      provedor: new ProvedorSosiaRoteiro(), // sem fetch, sem chaveDeApi
      diretorioCache: cacheTmp(),
    });
    expect(resultado.roteiro.pedacos.length).toBeGreaterThanOrEqual(1);
    expect(resultado.roteiro.schema_version).toBe("Roteiro.1");
  });

  it("PINADO: todo pedaco do sosia e tipo_visual 'texto' (unico renderizavel sem manim e sem anexo)", async () => {
    const resultado = await gerarRoteiro(pedidoGerar(), {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: cacheTmp(),
    });
    for (const pedaco of resultado.roteiro.pedacos) {
      expect(pedaco.tipo_visual).toBe("texto");
    }
    const regenerado = await regenerarPedaco(pedidoRegenerar(), {
      provedor: new ProvedorSosiaRoteiro(),
      diretorioCache: cacheTmp(),
    });
    expect(regenerado.pedaco.tipo_visual).toBe("texto");
  });

  it("SONDA NEGATIVA deterministica: mesmo prompt 2x = MESMA saida (o determinismo nao e coincidencia de cache)", async () => {
    const sosia = new ProvedorSosiaRoteiro();
    const prompt = montarPromptRoteiro(pedidoGerar());
    const primeira = await sosia.gerarRoteiroCompleto(prompt);
    const segunda = await sosia.gerarRoteiroCompleto(prompt);
    expect(JSON.stringify(primeira)).toBe(JSON.stringify(segunda));
  });
});

// ─── Cassete de replay (offline, deterministico) ──────────────────────────────

describe("Cassete — replay offline de roteiros gravados (padrao fixtures/cassetes/roteiro/)", () => {
  it("replay: grava num tmp e regenera — a saida do cassete volta EXATAMENTE como foi gravada", async () => {
    const raiz = cacheTmp();
    const diretorio = cacheTmp();
    const pedido = pedidoGerar();
    const prompt = montarPromptRoteiro(pedido);
    const gravado = roteiroValido();
    gravarCasseteRoteiro(raiz, prompt, gravado);

    const resultado = await gerarRoteiro(pedido, {
      provedor: criarProvedorCasseteRoteiro(raiz),
      diretorioCache: diretorio,
    });
    expect(resultado.origem).toBe("chamada");
    expect(JSON.stringify(resultado.roteiro)).toBe(JSON.stringify(gravado));
  });

  it("cassete AUSENTE → erro NOMEADO com o caminho esperado (nunca cai para a rede)", async () => {
    const raiz = cacheTmp();
    const provedor = criarProvedorCasseteRoteiro(raiz);
    let erro: unknown;
    try {
      await gerarRoteiro(pedidoGerar(), { provedor, diretorioCache: cacheTmp() });
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(ECasseteRoteiroAusente);
    expect((erro as ECasseteRoteiroAusente).code).toBe("CASSETE_ROTEIRO_AUSENTE");
  });

  it("o cassete COMMITADO existe e reproduz o roteiro gravado (chave = sha256 do prompt atual)", async () => {
    const pedido = pedidoGerar();
    const prompt = montarPromptRoteiro(pedido);
    const chave = sha256(prompt);
    const resultado = await gerarRoteiro(pedido, {
      provedor: criarProvedorCasseteRoteiro(), // raiz padrao: fixtures/cassetes
      diretorioCache: cacheTmp(),
    });
    expect(resultado.roteiro.schema_version).toBe("Roteiro.1");
    // O cassete commitado e a FONTE desta saida: conferencia direta.
    const gravado = JSON.parse(
      readFileSync(join("fixtures", "cassetes", "roteiro", chave, "resultado.json"), "utf-8"),
    ) as unknown;
    expect(JSON.stringify(resultado.roteiro)).toBe(JSON.stringify(gravado));
  });
});

// ─── Provedor LLM com fetch injetado (o guarda de rede do vitest bloqueia a rede real) ──

describe("Provedor LLM — fetch injetado, extracao por fornecedor, JSON malformado nunca aceito", () => {
  const ROTEIRO_VALIDO_JSON = JSON.stringify(roteiroValido());

  it("anthropic: monta a requisicao (url/headers/corpo) e extrai o JSON do bloco text", async () => {
    const chamadas: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      chamadas.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({ content: [{ type: "text", text: ROTEIRO_VALIDO_JSON }] }),
        { status: 200 },
      );
    };
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchMock, chaveDeApi: "chave-teste" });
    const saida = await provedor.gerarRoteiroCompleto(montarPromptRoteiro(pedidoGerar()));

    expect(chamadas.length).toBe(1);
    expect(chamadas[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    const corpo = JSON.parse(String(chamadas[0]?.init.body)) as Record<string, unknown>;
    expect(corpo.model).toBe("claude-sonnet-4-5");
    expect((corpo.system as string).includes("roteirista")).toBe(true);
    expect((corpo.messages as Array<{ content: string }>)[0]?.content).toContain("## BRIEF DO VIDEO");
    expect(JSON.stringify(saida)).toBe(ROTEIRO_VALIDO_JSON);
  });

  it("openai: extrai choices[0].message.content", async () => {
    const fetchMock = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
      expect((init?.headers as Record<string, string>).authorization).toBe("Bearer chave-teste");
      return new Response(
        JSON.stringify({ choices: [{ message: { content: ROTEIRO_VALIDO_JSON } }] }),
        { status: 200 },
      );
    };
    const provedor = criarProvedorLlm("openai", { fetch: fetchMock, chaveDeApi: "chave-teste" });
    const saida = await provedor.regenerarPedaco("PROMPT\n\n## PEDACO ALVO\n{}");
    expect(JSON.stringify(saida)).toBe(ROTEIRO_VALIDO_JSON);
  });

  it("markdown fenced (```json ... ```) e tolerado na extracao", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: `\`\`\`json\n${ROTEIRO_VALIDO_JSON}\n\`\`\`` } }] }),
        { status: 200 },
      );
    const provedor = criarProvedorLlm("openai", { fetch: fetchMock, chaveDeApi: "k" });
    const saida = await provedor.gerarRoteiroCompleto("p");
    expect(JSON.stringify(saida)).toBe(ROTEIRO_VALIDO_JSON);
  });

  it("SONDA NEGATIVA: conteudo que nao e JSON → EProvedorRoteiroFalhou (JSON malformado nunca aceito)", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(JSON.stringify({ choices: [{ message: { content: "isto nao e JSON" } }] }), {
        status: 200,
      });
    const provedor = criarProvedorLlm("openai", { fetch: fetchMock, chaveDeApi: "k" });
    await expect(provedor.gerarRoteiroCompleto("p")).rejects.toThrow(EProvedorRoteiroFalhou);
  });

  it("status != ok → EProvedorRoteiroFalhou com o status HTTP", async () => {
    const fetchMock = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: { message: "chave invalida" } }), { status: 401 });
    const provedor = criarProvedorLlm("anthropic", { fetch: fetchMock, chaveDeApi: "errada" });
    let erro: unknown;
    try {
      await provedor.gerarRoteiroCompleto("p");
    } catch (e) {
      erro = e;
    }
    expect(erro).toBeInstanceOf(EProvedorRoteiroFalhou);
    expect((erro as EProvedorRoteiroFalhou).status).toBe(401);
  });
});
