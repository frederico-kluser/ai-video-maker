/**
 * tests/roteiro/gerador-prompt.test.ts
 *
 * Gaps de cobertura de src/roteiro/gerador/prompt.ts — a composicao dos
 * prompts do gerador (fonte unica na biblioteca docs/roteiro/prompts/):
 *
 *   - carregarPrompt: (sem caminho), arquivo ausente, arquivo vazio apos
 *     o front-matter (todos EPromptRoteiroAusente NOMEADO — nunca silencio);
 *   - extrairTextoDoPrompt: com/sem linha `versao:` no front-matter;
 *   - extrairBlocoDoPrompt e os fallbacks de extrairTemaDoPrompt /
 *     extrairDuracaoDoPrompt (marcador ausente, JSON quebrado, "{" sem
 *     "}" depois, tema nao-string/vazio, duracao zero/negativa);
 *   - estrutura dos prompts compostos: marcadores na ordem que o contrato
 *     exige (PEDACO ALVO -> IRMAOS -> BRIEF na regeneracao), bloco volatil
 *     em JSON CANONICO (chaves ordenadas — o hash de cache nao depende da
 *     ordem de escrita do objeto) e resumo dos irmaos entrando como veio.
 *
 * O que o trio do gate ja cobre (montarPromptRoteiro com prompt
 * alternativo via caminho custom, C12) nao e duplicado aqui.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PedidoGerarRoteiro, PedidoRegenerarPedaco } from "../../src/roteiro/contrato/contrato.js";
import { resumoDePedacos } from "../../src/roteiro/contrato/canonicalizar.js";
import {
  EPromptRoteiroAusente,
  MARCADOR_BRIEF,
  MARCADOR_IRMAOS,
  MARCADOR_PEDACO_ALVO,
  carregarPrompt,
  extrairBlocoDoPrompt,
  extrairDuracaoDoPrompt,
  extrairTemaDoPrompt,
  extrairTextoDoPrompt,
  montarPromptRegenerar,
  montarPromptRoteiro,
} from "../../src/roteiro/gerador/prompt.js";

function tmpArquivo(conteudo: string): string {
  const caminho = join(mkdtempSync(join(tmpdir(), "roteiro-prompt-")), "prompt.md");
  writeFileSync(caminho, conteudo, "utf-8");
  return caminho;
}

function pedidoGerar(sobrescrita: Partial<PedidoGerarRoteiro> = {}): PedidoGerarRoteiro {
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

function pedidoRegenerar(
  sobrescrita: Partial<PedidoRegenerarPedaco> = {},
): PedidoRegenerarPedaco {
  return {
    brief: { tema: "Como funciona um cache de computador" },
    duracao_alvo_segundos: 30,
    pedaco_atual: {
      id: "p-001",
      indice: 1,
      titulo: "O que e um cache",
      fala: "Um cache guarda o resultado de uma conta para nao refaze-la.",
      duracao_segundos: 12.5,
      tipo_visual: "manim",
      especificacao_visual: "Animacao estilo 3b1b com shapes",
      detalhes_de_producao: "Cena Manim via estagio grafico",
      narracao: { texto: "", origem: "nenhuma", status: "vazio" },
    },
    resumo_demais_pedacos: resumoDePedacos([{ id: "p-000" }, { id: "p-002" }]),
    versao_contrato: "Roteiro.1",
    versao_contrato_gerador: "1.0.0",
    versao_gerador: "1.0.0",
    ...sobrescrita,
  };
}

describe("prompt do gerador — carregamento da biblioteca (src/roteiro/gerador/prompt.ts)", () => {
  it("carregarPrompt SEM caminho e sem padrao -> EPromptRoteiroAusente nomeado ('(sem caminho)')", () => {
    expect(() => carregarPrompt()).toThrow(EPromptRoteiroAusente);
    expect(() => carregarPrompt()).toThrow(/\(sem caminho\)/);
  });

  it("carregarPrompt em arquivo AUSENTE -> EPromptRoteiroAusente com o detalhe do erro de leitura", () => {
    const inexistente = join(tmpdir(), "prompt-que-nao-existe-aleatorio.md");
    expect(() => carregarPrompt(inexistente)).toThrow(EPromptRoteiroAusente);
    expect(() => carregarPrompt(inexistente)).toThrow(/ENOENT/);
  });

  it("carregarPrompt em arquivo VAZIO (ou so front-matter) -> EPromptRoteiroAusente ('arquivo vazio apos o front-matter')", () => {
    expect(() => carregarPrompt(tmpArquivo(""))).toThrow(EPromptRoteiroAusente);
    expect(() => carregarPrompt(tmpArquivo(""))).toThrow(/arquivo vazio/);
    expect(() => carregarPrompt(tmpArquivo("versao: 1.0.0\n\n"))).toThrow(/arquivo vazio/);
  });

  it("extrairTextoDoPrompt: linha `versao:` na primeira linha e removida, junto com a linha em branco que a segue", () => {
    expect(extrairTextoDoPrompt("versao: 1.0.0\n\nCorpo do prompt.\nMais uma linha.\n"))
      .toBe("Corpo do prompt.\nMais uma linha.");
    // Sem a linha de versao, o conteudo inteiro passa (trim nas pontas).
    expect(extrairTextoDoPrompt("\n\nCorpo sem versao.\n")).toBe("Corpo sem versao.");
  });

  it("montarPromptRoteiro: texto estavel + MARCADOR_BRIEF + bloco volatil em JSON CANONICO (chaves ordenadas)", () => {
    const caminho = tmpArquivo("versao: 1.0.0\n\nVoce e o roteirista principal.\n");
    const prompt = montarPromptRoteiro(pedidoGerar(), caminho);

    expect(prompt.startsWith("Voce e o roteirista principal.")).toBe(true);
    expect(prompt.split(MARCADOR_BRIEF).length - 1).toBe(1); // marcador exatamente uma vez
    const depoisDoMarcador = prompt.split(MARCADOR_BRIEF)[1]!;
    const bloco = JSON.parse(depoisDoMarcador) as Record<string, unknown>;
    expect(bloco).toEqual({
      brief: pedidoGerar().brief,
      duracao_alvo_segundos: 30,
    });

    // O bloco e CANONICO: chaves em ordem alfabetica no JSON bruto
    // (brief antes de duracao_alvo_segundos — a serializacao do contrato).
    // (O "1" e a quebra de linha que separa o marcador do JSON.)
    expect(depoisDoMarcador.indexOf('{"brief":')).toBe(1);
  });

  it("montarPromptRoteiro DETERMINISTICO: ordem de escrita das chaves do pedido nao muda o prompt (o hash de cache nao depende dela)", () => {
    const caminho = tmpArquivo("versao: 1.0.0\n\nVoce e o roteirista principal.\n");
    const original = pedidoGerar();
    const bagunçado = {
      versao_gerador: original.versao_gerador,
      brief: original.brief,
      duracao_alvo_segundos: original.duracao_alvo_segundos,
      versao_contrato: original.versao_contrato,
      versao_contrato_gerador: original.versao_contrato_gerador,
    } as PedidoGerarRoteiro;
    expect(montarPromptRoteiro(bagunçado, caminho)).toBe(montarPromptRoteiro(original, caminho));
  });

  it("montarPromptRegenerar: ordem dos marcadores PEDACO ALVO < IRMAOS < BRIEF, fala editada no alvo, resumo dos irmaos entrando COMO VEIO", () => {
    const caminho = tmpArquivo("versao: 1.0.0\n\nVoce regenera um pedaco.\n");
    const resumo = resumoDePedacos([{ id: "p-000" }, { id: "p-002" }]);
    const pedido = pedidoRegenerar({
      pedaco_atual: {
        id: "p-001",
        indice: 1,
        titulo: "O que e um cache",
        fala: "Fala EDITADA pelo usuario.",
        duracao_segundos: 12.5,
        tipo_visual: "manim",
        especificacao_visual: "Animacao 3b1b",
        detalhes_de_producao: "Cena Manim",
        narracao: { texto: "", origem: "nenhuma", status: "vazio" },
      },
      resumo_demais_pedacos: resumo,
    });
    const prompt = montarPromptRegenerar(pedido, caminho);

    const posAlvo = prompt.indexOf(MARCADOR_PEDACO_ALVO);
    const posIrmaos = prompt.indexOf(MARCADOR_IRMAOS);
    const posBrief = prompt.indexOf(MARCADOR_BRIEF);
    expect(posAlvo).toBeGreaterThanOrEqual(0);
    expect(posIrmaos).toBeGreaterThan(posAlvo);
    expect(posBrief).toBeGreaterThan(posIrmaos);

    expect(prompt).toContain("Fala EDITADA pelo usuario.");

    // O resumo entra como veio: a fatia entre o marcador de irmaos e o
    // marcador do brief e exatamente o JSON canonico do resumo.
    const fatiaIrmaos = prompt.slice(posIrmaos + MARCADOR_IRMAOS.length, posBrief).trimStart();
    expect(fatiaIrmaos.startsWith(resumo)).toBe(true);

    // E o bloco do alvo parseia com as edicoes aplicadas.
    const fatiaAlvo = prompt.slice(posAlvo + MARCADOR_PEDACO_ALVO.length, posIrmaos);
    const alvo = JSON.parse(fatiaAlvo) as { fala: string };
    expect(alvo.fala).toBe("Fala EDITADA pelo usuario.");
  });
});

describe("extracoes do prompt (os fallbacks deterministicos do sosia)", () => {
  it("extrairBlocoDoPrompt: marcador ausente, ausencia de '{', '}' antes de '{' e JSON quebrado -> undefined (fallback, nunca lanca)", () => {
    expect(extrairBlocoDoPrompt("prompt sem marcador", MARCADOR_BRIEF)).toBeUndefined();
    expect(extrairBlocoDoPrompt(`${MARCADOR_BRIEF}\nsem chaves`, MARCADOR_BRIEF)).toBeUndefined();
    expect(extrairBlocoDoPrompt(`${MARCADOR_BRIEF}\n} {`, MARCADOR_BRIEF)).toBeUndefined();
    expect(extrairBlocoDoPrompt(`${MARCADOR_BRIEF}\n{quebrado}`, MARCADOR_BRIEF)).toBeUndefined();
    expect(extrairBlocoDoPrompt(`${MARCADOR_BRIEF}\n{"a":1}`, MARCADOR_BRIEF)).toEqual({ a: 1 });
  });

  it("extrairTemaDoPrompt: brief ausente, tema nao-string e tema vazio -> undefined; tema valido -> o tema", () => {
    expect(extrairTemaDoPrompt("sem brief")).toBeUndefined();
    expect(extrairTemaDoPrompt(`${MARCADOR_BRIEF}\n{"brief":{}}`)).toBeUndefined();
    expect(extrairTemaDoPrompt(`${MARCADOR_BRIEF}\n{"brief":{"tema":123}}`)).toBeUndefined();
    expect(extrairTemaDoPrompt(`${MARCADOR_BRIEF}\n{"brief":{"tema":""}}`)).toBeUndefined();
    expect(extrairTemaDoPrompt(`${MARCADOR_BRIEF}\n{"brief":{"tema":"O tema"}}`)).toBe("O tema");
  });

  it("extrairDuracaoDoPrompt: ausente, zero, negativa e nao-numero -> undefined; positiva -> o numero", () => {
    expect(extrairDuracaoDoPrompt("sem brief")).toBeUndefined();
    expect(extrairDuracaoDoPrompt(`${MARCADOR_BRIEF}\n{}`)).toBeUndefined();
    expect(extrairDuracaoDoPrompt(`${MARCADOR_BRIEF}\n{"duracao_alvo_segundos":0}`)).toBeUndefined();
    expect(extrairDuracaoDoPrompt(`${MARCADOR_BRIEF}\n{"duracao_alvo_segundos":-5}`)).toBeUndefined();
    expect(extrairDuracaoDoPrompt(`${MARCADOR_BRIEF}\n{"duracao_alvo_segundos":"30"}`)).toBeUndefined();
    expect(extrairDuracaoDoPrompt(`${MARCADOR_BRIEF}\n{"duracao_alvo_segundos":30.5}`)).toBe(30.5);
  });
});
