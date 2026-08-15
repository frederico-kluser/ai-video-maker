/**
 * tests/roteiro/construir-casos.test.ts
 *
 * Casos de borda e especificacoes extremas do CONSTRUTOR DE MANIFESTO
 * (construir.ts) — o complemento de tests/roteiro/construir.test.ts:
 *
 *   - opcoes invalidas em TODAS as combinacoes (fps/width/height/
 *     transicao, varios problemas de uma vez — ErroOpcoesInvalidas
 *     nomeado, nunca manifesto fora do schema);
 *   - defaults do FORMATO_VIDEO do contrato (fps 30, 1920x1080) quando a
 *     opcao e omitida — zero literais fora de src/design/ (Regra 2);
 *   - duracao < 1 frame (ErroDuracaoInsuficiente nomeado — o construtor
 *     nunca emite duracao_frames 0, C1); a MESMA duracao passando num
 *     fps maior (a conta e por ancora, ADR-0010);
 *   - transicao em TODOS os tipos do vocabulario (fade/slide/wipe/flip/
 *     none) com a aritmetica SUBTRATIVA do F1-01 conferida pela timeline
 *     do render (calcularDuracao);
 *   - cena mais curta que a propria transicao => corte seco (a fronteira
 *     nunca engole a cena);
 *   - roteiro vazio (schema: pedacos 1..40) e pedacos sem fala
 *     (record-first: cena silenciosa, duracao conta);
 *   - o guard fail-closed de narracao com origem real e texto vazio —
 *     o CONTRATO RECUSA antes do guard do construtor (regra
 *     origem-real-sem-texto em validar.ts, desde
 *     onda5-fix-contrato-validar): ErroContratoRoteiro nomeado, nunca
 *     manifesto invalido — o guard do construtor virou defesa em
 *     profundidade;
 *   - reduzirManifesto: cena SEM nos, cena com nos quebrada (TypeError
 *     propagado — nunca engolido), trilha sonora `audio` REMOVIDA na
 *     reducao (a musica entra no juntar, nunca no preview de um pedaco)
 *     e transicoes da cena REMOVIDAS (a transicao de saida so faria o
 *     preview terminar com um fade fantasma);
 *   - hashLocucaoTts (placeholder deterministico de conteudo, 64 hex) e
 *     duracaoEmFrames (arredondamento UMA vez, meio-frame).
 *
 * Nenhum destes casos contradiz o contrato (docs/roteiro/contrato-roteiro.md
 * §3/§5): todos verificam a regra documentada em comportamento extremo.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  construirManifesto,
  duracaoEmFrames,
  hashLocucaoTts,
  reduzirManifesto,
  ErroDuracaoInsuficiente,
  ErroOpcoesInvalidas,
  ErroReduzirManifesto,
  type OpcoesConstruirManifesto,
} from "../../src/roteiro/construir/construir.js";
import { ErroContratoRoteiro } from "../../src/roteiro/contrato/rejeitar.js";
import { FORMATO_VIDEO, type Roteiro } from "../../src/roteiro/contrato/contrato.js";
import { validarManifestoConstruido } from "../../src/roteiro/construir/validar.js";
import { calcularDuracao } from "../../src/composicao/tempo.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";

const FIXTURES = join(__dirname, "fixtures");

function carregarRoteiro(nome: string): Roteiro {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as Roteiro;
}

/** Muta o pedaco `indice` de um roteiro valido (o resto fica intacto). */
function mutarPedaco(
  roteiro: Roteiro,
  indice: number,
  delta: Partial<Roteiro["pedacos"][number]>,
): Roteiro {
  return {
    ...roteiro,
    pedacos: roteiro.pedacos.map((pedaco, i) =>
      i === indice ? { ...pedaco, ...delta } : pedaco,
    ),
  };
}

/**
 * Muda a duracao do pedaco `indice` E re-soma duracao_total_segundos
 * (a regra duracao-total-inconsistente tem tolerancia 0.01s — uma mutacao
 * de duracao sem atualizar o total e rejeitada pelo CONTRATO antes do
 * construtor, e o teste do construtor nunca chegaria a rodar).
 */
function comDuracaoMutada(roteiro: Roteiro, indice: number, segundos: number): Roteiro {
  const pedacos = roteiro.pedacos.map((pedaco, i) =>
    i === indice ? { ...pedaco, duracao_segundos: segundos } : pedaco,
  );
  const total = pedacos.reduce((acc, p) => acc + p.duracao_segundos, 0);
  return { ...roteiro, pedacos, duracao_total_segundos: total };
}

/** Roteiro com N pedacos (ids/indices contiguos, total = soma das duracoes). */
function roteiroComNPedacos(n: number): Roteiro {
  const base = carregarRoteiro("roteiro-valido.json");
  const pedacos = Array.from({ length: n }, (_, i) => {
    const origem = base.pedacos[i % base.pedacos.length]!;
    return {
      ...origem,
      id: `p-${String(i).padStart(3, "0")}`,
      indice: i,
    };
  });
  const total = pedacos.reduce((acc, p) => acc + p.duracao_segundos, 0);
  return { schema_version: "Roteiro.1", pedacos, duracao_total_segundos: total };
}

// ─── Opcoes: defaults, validas, invalidas ─────────────────────────────────────

describe("construirManifesto — opcoes (defaults e limites do schema)", () => {
  const roteiro = carregarRoteiro("roteiro-valido.json");

  it("sem opcoes: fps/width/height saem do FORMATO_VIDEO do contrato (30/1920x1080)", () => {
    const manifesto = construirManifesto(roteiro);
    expect(manifesto.fps).toBe(FORMATO_VIDEO.fps);
    expect(manifesto.width).toBe(FORMATO_VIDEO.width);
    expect(manifesto.height).toBe(FORMATO_VIDEO.height);
    expect(manifesto.fps).toBe(30);
    expect(manifesto.width).toBe(1920);
    expect(manifesto.height).toBe(1080);
  });

  it("opcoes validas propagam ao manifesto (fps muda a conta de frames)", () => {
    const manifesto = construirManifesto(roteiro, { fps: 60, width: 1280, height: 720 });
    expect(manifesto.fps).toBe(60);
    expect(manifesto.width).toBe(1280);
    expect(manifesto.height).toBe(720);
    // 24.5s a 60fps = 1470 frames; a 30fps seriam 735.
    expect(manifesto.duracao_total_frames).toBe(1470);
    expect(manifesto.cenas[0]!.nos).toHaveLength(1);
    const no = manifesto.nos.find((n) => n.id === manifesto.cenas[0]!.nos[0])!;
    expect(no.duracao_frames).toBe(240); // 4.0s a 60fps
  });

  it("fps fora de 1..120, width/height < 1 ou fracionarios: erro nomeado", () => {
    const invalidas: Array<[string, OpcoesConstruirManifesto]> = [
      ["fps 0", { fps: 0 }],
      ["fps 121", { fps: 121 }],
      ["fps fracionario", { fps: 1.5 }],
      ["width 0", { width: 0 }],
      ["width negativa", { width: -1 }],
      ["width fracionaria", { width: 1.5 }],
      ["height 0", { height: 0 }],
      ["height negativa", { height: -10 }],
      ["transicao fora do vocabulario", { transicao: "cube" as never }],
    ];
    for (const [nome, opcoes] of invalidas) {
      let lancou = false;
      try {
        construirManifesto(roteiro, opcoes);
      } catch (erro) {
        lancou = true;
        expect(erro, nome).toBeInstanceOf(ErroOpcoesInvalidas);
        expect((erro as ErroOpcoesInvalidas).code).toBe("OPCOES_INVALIDAS");
        expect(String(erro), nome).toContain("Opcoes de construcao invalidas");
      }
      expect(lancou, `${nome} tem de ser recusado`).toBe(true);
    }
  });

  it("varios problemas de uma vez: TODOS listados no erro (nunca o primeiro so)", () => {
    try {
      construirManifesto(roteiro, {
        fps: 0,
        width: 0,
        height: -1,
        transicao: "cube" as never,
      });
      throw new Error("nao deveria chegar aqui");
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroOpcoesInvalidas);
      const e = erro as ErroOpcoesInvalidas;
      expect(e.problemas).toHaveLength(4);
      expect(e.problemas.join("\n")).toContain("fps 0 fora do intervalo 1..120");
      expect(e.problemas.join("\n")).toContain("width 0 deve ser inteiro >= 1");
      expect(e.problemas.join("\n")).toContain("height -1 deve ser inteiro >= 1");
      expect(e.problemas.join("\n")).toContain("transicao \"cube\" fora do vocabulario");
    }
  });

  it("sonda negativa: opcoes invalidas sao recusadas ANTES de qualquer montagem", () => {
    // O roteiro aqui e valido; o manifesto NAO pode nem ser montado.
    let lancou = false;
    try {
      construirManifesto(roteiro, { fps: 0 });
    } catch {
      lancou = true;
    }
    expect(lancou).toBe(true);
  });
});

// ─── Duracao abaixo de um frame ───────────────────────────────────────────────

describe("construirManifesto — duracao abaixo de um frame (ErroDuracaoInsuficiente)", () => {
  const roteiro = carregarRoteiro("roteiro-valido.json");

  it("pedaco com duracao que arredonda para 0 frames: erro nomeado", () => {
    // 0.01s a 30fps = 0.3 frame -> Math.round = 0 -> o schema exige >= 1
    // (C1: o construtor nao emite duracao_frames 0, nem arredonda para
    // cima em silencio — isso alongaria o video alem do pedido).
    const mutado = comDuracaoMutada(roteiro, 1, 0.01);
    let lancou = false;
    try {
      construirManifesto(mutado);
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroDuracaoInsuficiente);
      const e = erro as ErroDuracaoInsuficiente;
      expect(e.code).toBe("DURACAO_ABAIXO_DE_UM_FRAME");
      expect(e.regra).toBe("duracao-abaixo-de-um-frame");
      expect(String(e)).toContain('pedaco "p-001"');
      expect(String(e)).toContain("30fps");
    }
    expect(lancou).toBe(true);
  });

  it("0.016s a 30fps (0.48 frame) tambem recusa; a fronteira e meio frame", () => {
    // Math.round(0.48) = 0; o limiar e duracao*fps >= 0.5.
    expect(() => construirManifesto(comDuracaoMutada(roteiro, 1, 0.016))).toThrow(
      ErroDuracaoInsuficiente,
    );
    const limite = comDuracaoMutada(roteiro, 1, 0.017); // 0.51 frame
    const manifesto = construirManifesto(limite);
    expect(manifesto.cenas[1]!.nos).toHaveLength(1);
  });

  it("a MESMA duracao num fps maior produz frame (a conta e por ancora, ADR-0010)", () => {
    // 0.01s a 120fps = 1.2 frames -> Math.round = 1 -> passa.
    const manifesto = construirManifesto(comDuracaoMutada(roteiro, 1, 0.01), { fps: 120 });
    expect(manifesto.fps).toBe(120);
    expect(validarManifestoConstruido(manifesto).valido).toBe(true);
  });

  it("sonda negativa: a soma do roteiro tem de acompanhar a mutacao (0.01s)", () => {
    // duracao_total_segundos divergente e rejeitada pelo contrato ANTES
    // do construtor — a mutacao sem atualizar o total cai no contrato.
    const semTotal = {
      ...comDuracaoMutada(roteiro, 1, 0.01),
      duracao_total_segundos: roteiro.duracao_total_segundos,
    };
    expect(() => construirManifesto(semTotal)).toThrow(ErroContratoRoteiro);
  });
});

// ─── Transicoes: todos os tipos, aritmetica subtrativa, cena curta ────────────

describe("construirManifesto — transicoes (todos os tipos do vocabulario)", () => {
  const roteiro = carregarRoteiro("roteiro-valido.json");
  // 3 pedacos: 4.0 + 12.5 + 8.0 = 24.5s -> 735 frames @30fps.
  const TOTAL_SEM_TRANSICAO = 735;
  const DURACAO_TRANSICAO = 9; // base 300ms @30fps (msToFrames do token)

  const tipos: Array<[string, string]> = [
    ["fade", "fade"],
    ["slide", "slide"],
    ["wipe", "wipe"],
    ["flip", "flip"],
  ];

  for (const [nome, tipo] of tipos) {
    it(`${nome}: transicao_saida nas cenas nao-ultimas, total subtraido (F1-01)`, () => {
      const manifesto = construirManifesto(roteiro, {
        transicao: tipo as OpcoesConstruirManifesto["transicao"],
      });
      // 3 cenas = 2 fronteiras; cada uma desconta a duracao da transicao.
      expect(manifesto.duracao_total_frames).toBe(TOTAL_SEM_TRANSICAO - 2 * DURACAO_TRANSICAO);
      expect(manifesto.duracao_total_frames).toBe(735 - 18);
      // cena 0 e 1 tem transicao_saida; a ultima (2) nao.
      expect(manifesto.cenas[0]!.transicao_saida).toEqual({
        tipo,
        duracao_frames: DURACAO_TRANSICAO,
      });
      expect(manifesto.cenas[1]!.transicao_saida).toEqual({
        tipo,
        duracao_frames: DURACAO_TRANSICAO,
      });
      expect(manifesto.cenas[2]!.transicao_saida).toBeUndefined();
      // A timeline do render (a verdade da composicao) concorda com o
      // campo declarado — o campo nunca mente para o render.
      expect(calcularDuracao(manifesto).totalFrames).toBe(manifesto.duracao_total_frames);
      // E a saida continua valida contra o schema oficial.
      expect(validarManifestoConstruido(manifesto).valido).toBe(true);
      // Determinismo por conteudo: mesma entrada, mesma saida byte a byte.
      expect(JSON.stringify(construirManifesto(roteiro, { transicao: tipo as never }))).toBe(
        JSON.stringify(manifesto),
      );
    });
  }

  it('transicao "none" explicita = corte seco (zero transicoes, zero descontos)', () => {
    const manifesto = construirManifesto(roteiro, { transicao: "none" });
    for (const cena of manifesto.cenas) {
      expect(cena.transicao_saida).toBeUndefined();
      expect(cena.transicao_entrada).toBeUndefined();
    }
    expect(manifesto.duracao_total_frames).toBe(TOTAL_SEM_TRANSICAO);
  });

  it("cena mais curta que a propria transicao: corte seco (a fronteira nunca engole a cena)", () => {
    // Pedaco 0 com 0.2s = 6 frames < 9 frames da transicao: o construtor
    // nao declara transicao de saida nessa cena (o F1-01 recusa fronteira
    // maior que a cena — a sobreposicao engoliria a cena inteira).
    const comCenaCurta = comDuracaoMutada(roteiro, 0, 0.2);
    // Total do roteiro: 0.2 + 12.5 + 8.0 = 20.7s -> 621 frames; so a
    // fronteira cena1->cena2 desconta (cena 1 = 375 frames > 9).
    const manifesto = construirManifesto(comCenaCurta, { transicao: "fade" });
    expect(manifesto.cenas[0]!.transicao_saida).toBeUndefined();
    expect(manifesto.cenas[1]!.transicao_saida).toBeDefined();
    expect(manifesto.duracao_total_frames).toBe(621 - 9);
    expect(calcularDuracao(manifesto).totalFrames).toBe(manifesto.duracao_total_frames);
    expect(validarManifestoConstruido(manifesto).valido).toBe(true);
  });

  it("transicao nao afeta a duracao dos NOS (so o total da composicao)", () => {
    const manifesto = construirManifesto(roteiro, { transicao: "fade" });
    const sem = construirManifesto(roteiro);
    expect(manifesto.nos.map((no) => no.duracao_frames)).toEqual(
      sem.nos.map((no) => no.duracao_frames),
    );
  });
});

// ─── Roteiro vazio e pedacos sem fala ─────────────────────────────────────────

describe("construirManifesto — roteiro vazio e pedacos sem fala", () => {
  it("roteiro sem pedacos: recusado pelo contrato (schema pedacos 1..40)", () => {
    const vazio = { schema_version: "Roteiro.1" as const, pedacos: [], duracao_total_segundos: 0 };
    expect(() => construirManifesto(vazio)).toThrow(ErroContratoRoteiro);
  });

  it("pedaco sem fala (fala == \"\") => cena sem audio_cena, mas a duracao conta", () => {
    // roteiro-valido p-000 tem fala "" com narracao vazia — RECORD-FIRST:
    // a cena renderiza silenciosa no preview (a UI mostra o botao).
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const manifesto = construirManifesto(roteiro);
    const cena0 = manifesto.cenas[0]!;
    expect(roteiro.pedacos[0]!.fala).toBe("");
    expect(cena0.audio_cena).toBeUndefined();
    // E a duracao da cena sem fala e contada no total (nao some em silencio).
    expect(calcularDuracao(manifesto).totalFrames).toBe(manifesto.duracao_total_frames);
    expect(manifesto.duracao_total_frames).toBe(735);
  });

  it("ids com padding de 3 digitos alem do 9 (n-009/c-009 com 10 pedacos)", () => {
    const roteiro = roteiroComNPedacos(10);
    const manifesto = construirManifesto(roteiro);
    expect(manifesto.cenas).toHaveLength(10);
    expect(manifesto.cenas[9]!.id).toBe("c-009");
    expect(manifesto.nos[9]!.id).toBe("n-009");
    const soma = roteiro.pedacos.reduce(
      (acc, p) => acc + duracaoEmFrames(p.duracao_segundos, manifesto.fps),
      0,
    );
    expect(manifesto.duracao_total_frames).toBe(soma);
    expect(validarManifestoConstruido(manifesto).valido).toBe(true);
  });
});

// ─── Guard fail-closed alcançavel: origem real com texto vazio ────────────────

describe("construirManifesto — narracao com origem real e texto vazio (guard fail-closed)", () => {
  it("contrato RECUSA origem real com texto vazio (regra origem-real-sem-texto) — nunca texto_locucao vazio", () => {
    // {texto: "", origem: "tts", status: "editado"} com fala nao-vazia
    // passava no contrato antigo e o guard do construtor era o unico que
    // pegava (ACHADO sondado em 2026-08-14). Com a regra
    // origem-real-sem-texto no contrato (onda5-fix-contrato-validar),
    // validarRoteiro rejeita o roteiro no gate de entrada: o erro sai
    // ErroContratoRoteiro NOMEADO, nunca manifesto invalido — o guard do
    // construtor virou defesa em profundidade (mesma cena coberta em
    // construir.test.ts:360).
    const roteiro = carregarRoteiro("roteiro-com-narracao.json");
    const mutado: Roteiro = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((pedaco, i) =>
        i === 1
          ? {
              ...pedaco,
              fala: "texto da fala corrente",
              narracao: { texto: "", origem: "tts", status: "editado" },
            }
          : pedaco,
      ),
    };
    let lancou = false;
    try {
      construirManifesto(mutado);
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroContratoRoteiro);
      expect(String(erro)).toContain("origem-real-sem-texto");
      expect(String(erro)).toContain("texto nao-vazio");
      expect(String(erro)).toContain("estagio locucao");
    }
    expect(lancou, "cena com texto_locucao vazio nunca pode ser emitida").toBe(true);
  });
});

// ─── reduzirManifesto: cenas quebradas e trilha sonora ────────────────────────

describe("reduzirManifesto — cena sem nos, nos quebrada, trilha removida", () => {
  const roteiro = carregarRoteiro("roteiro-valido.json");
  const manifesto = construirManifesto(roteiro);

  it("cena com lista de nos VAZIA: erro nomeado (fail-closed, nunca saida)", () => {
    const semNos: Manifesto = {
      ...manifesto,
      cenas: [{ ...manifesto.cenas[0]!, nos: [] }],
    };
    let lancou = false;
    try {
      reduzirManifesto(semNos, 0);
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroReduzirManifesto);
      expect(String(erro)).toContain('cena "c-000" nao tem nenhum no');
      expect(String(erro)).toContain("reducao-impossivel");
    }
    expect(lancou).toBe(true);
  });

  it("cena com nos NAO iteravel (null): o erro de tempo NAO e engolido — propaga", () => {
    // O catch de reduzirManifesto so converte ErroDeTempo em
    // ErroReduzirManifesto; qualquer outro erro (aqui, TypeError de
    // `for..of` sobre null) PROPAGA — nunca vira manifesto reduzido.
    const quebrada: Manifesto = {
      ...manifesto,
      cenas: [{ ...manifesto.cenas[0]!, nos: null as unknown as string[] }],
    };
    expect(() => reduzirManifesto(quebrada, 0)).toThrow(TypeError);
  });

  it("trilha sonora (audio) e REMOVIDA na reducao — a musica entra no juntar", () => {
    const comTrilha: Manifesto = {
      ...manifesto,
      audio: { trilha_sonora: "caminho/da/trilha.wav", volume: 0.5 },
    };
    const reduzido = reduzirManifesto(comTrilha, 0);
    expect(reduzido.audio).toBeUndefined();
    expect(reduzido.cenas).toHaveLength(1);
    expect(validarManifestoConstruido(reduzido).valido).toBe(true);
  });

  it("transicoes da cena sao REMOVIDAS na reducao (o preview nunca termina com fade fantasma)", () => {
    // Contrato de construir.ts:345-348: "transicoes da cena REMOVIDAS" —
    // uma cena so nao tem com o que sobrepor. Uma regressao que
    // propagasse transicao_saida passaria pelo schema (transicao_saida e
    // permitida em manifesto de 1 cena) e por duracaoDaCena (ignora
    // transicoes) — a assercao direta abaixo e a sonda da regressao.
    const comTransicao = construirManifesto(roteiro, { transicao: "fade" });
    // Sonda negativa: a cena 0 DO ORIGINAL declara saida (F1-01) — sem
    // isso o teste passaria no vacuo se o construtor parasse de emitir.
    expect(comTransicao.cenas[0]!.transicao_saida).toBeDefined();
    const reduzido = reduzirManifesto(comTransicao, 0);
    expect(reduzido.cenas[0]!.transicao_saida).toBeUndefined();
    expect(reduzido.cenas[0]!.transicao_entrada).toBeUndefined();
    // E o reduzido continua valido contra o schema oficial.
    expect(validarManifestoConstruido(reduzido).valido).toBe(true);
  });

  it("audio_cena sobrevive a reducao quando a cena narra (preview narra)", () => {
    const comNarracao = construirManifesto(carregarRoteiro("roteiro-com-narracao.json"));
    const reduzido = reduzirManifesto(comNarracao, 1);
    expect(reduzido.cenas[0]!.audio_cena?.texto_locucao).toBe(
      roteiroFalaDe(comNarracao, 1),
    );
  });
});

// ─── Helpers puros ────────────────────────────────────────────────────────────

describe("duracaoEmFrames e hashLocucaoTts (helpers puros)", () => {
  it("duracaoEmFrames: round(segundos * fps), uma vez so (ADR-0010)", () => {
    expect(duracaoEmFrames(1, 30)).toBe(30);
    expect(duracaoEmFrames(24.5, 30)).toBe(735);
    expect(duracaoEmFrames(0.5, 1)).toBe(1); // Math.round: meio-frame sobe
    expect(duracaoEmFrames(0.49, 1)).toBe(0);
    expect(duracaoEmFrames(2.5, 1)).toBe(3);
    expect(duracaoEmFrames(0, 30)).toBe(0);
  });

  it("hashLocucaoTts: SHA-256 do texto, deterministico, 64 hex", () => {
    const hash = hashLocucaoTts("texto da locucao");
    expect(hash).toBe(createHash("sha256").update("texto da locucao").digest("hex"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashLocucaoTts("texto da locucao")).toBe(hash);
    expect(hashLocucaoTts("outro texto")).not.toBe(hash);
    expect(hashLocucaoTts("")).toBe(createHash("sha256").update("").digest("hex"));
  });
});

/** Fala do pedaco no indice dado (para assercoes de texto_locucao). */
function roteiroFalaDe(manifesto: Manifesto, indice: number): string {
  const cena = manifesto.cenas[indice]!;
  return cena.audio_cena?.texto_locucao ?? "";
}
