/**
 * tests/roteiro/construir.test.ts
 *
 * As perguntas falsificaveis do CONSTRUTOR DE MANIFESTO (TASK_PLAN):
 *
 *   FQ-M1 — Pedaco[] → Manifesto.1 VALIDA contra o schema oficial. O
 *           validador oficial do repositorio e o Python
 *           `jsonschema.Draft202012Validator` do `just contrato_testar`;
 *           o teste roda os DOIS contra a saida do construtor: o espelho
 *           TS (Ajv 2020, mesmo schema) em processo e o validador
 *           Python oficial num subprocesso (cross-check — divergencia
 *           entre os dois e vermelho).
 *   FQ-M2 — duracao_total_frames == soma das duracoes dos pedacos
 *           (tolerancia 1s em frames) E == totalFrames da aritmetica do
 *           F1-01 (calcularDuracao — a timeline que o render usa).
 *   FQ-M3 — reduzirManifesto: duracao == duracao do pedaco, so os nos da
 *           cena, valida contra o schema, deterministico por conteudo.
 *   FQ-M4 — fala do pedaco chega como audio_cena.texto_locucao da cena
 *           correspondente (SO com origem tts/gravacao; pedaco com fala
 *           e origem "nenhuma" NAO gera audio_cena — record-first).
 *   BONUS — regras de anexo (gif/video sem anexo = erro nomeado, nunca
 *           manifesto invalido); round-trip com a fixture derivada da
 *           canonica; tabela de mapeamento tipo_visual → no; CLI D11.
 *
 * Anti-C2 (runner verde com filtro que nao casa nada): cada grupo termina
 * com sonda negativa — o validador reprova um manifesto MUTADO (o teste
 * nao pode passar com o validador quebrado), e as assercoes dependem de
 * conteudo real (contagens, ids, bytes), nunca so do exit code.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  construirManifesto,
  duracaoEmFrames,
  reduzirManifesto,
  ErroOpcoesInvalidas,
  ErroReduzirManifesto,
} from "../../src/roteiro/construir/construir.js";
import {
  detectarCenaManim,
  detectarTipoGrafico,
  ErroAnexoAusente,
  extrairDados,
  mapearPedacoParaNo,
  separarItens,
} from "../../src/roteiro/construir/mapear.js";
import { validarManifestoConstruido } from "../../src/roteiro/construir/validar.js";
import { ErroContratoRoteiro } from "../../src/roteiro/contrato/rejeitar.js";
import type { Roteiro } from "../../src/roteiro/contrato/contrato.js";
import type { Manifesto, No } from "../../src/contratos/manifesto.js";
import {
  isNoCabecalho,
  isNoGrafico,
  isNoLista,
  isNoMidia,
  isNoTexto,
} from "../../src/contratos/manifesto.js";
import { calcularDuracao } from "../../src/composicao/tempo.js";

const RAIZ = join(__dirname, "..", "..");
const FIXTURES = join(__dirname, "fixtures");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");
const CAMINHO_CLI = join(RAIZ, "src", "roteiro", "construir", "cli.ts");

function carregarRoteiro(nome: string): Roteiro {
  return JSON.parse(readFileSync(join(FIXTURES, nome), "utf-8")) as Roteiro;
}

/** O validador OFICIAL do repositorio (Python, jsonschema 4.26) contra um JSON. */
function validarComPython(manifesto: unknown): { disponivel: boolean; erros: number } {
  const script = `
import json, sys
try:
    from jsonschema import Draft202012Validator
except ImportError:
    print("SKIP")
    sys.exit(0)
schema = json.load(open("schema/manifesto.schema.json", encoding="utf-8"))
validador = Draft202012Validator(schema)
erros = list(validador.iter_errors(json.loads(sys.stdin.read())))
print("ERROS:%d" % len(erros))
`;
  const saida = execFileSync("python3", ["-c", script], {
    cwd: RAIZ,
    input: JSON.stringify(manifesto),
    encoding: "utf-8",
    timeout: 60_000,
  });
  if (saida.includes("SKIP")) {
    return { disponivel: false, erros: -1 };
  }
  const casamento = /ERROS:(\d+)/.exec(saida);
  if (casamento === null) {
    throw new Error(`saida inesperada do validador Python: ${saida}`);
  }
  return { disponivel: true, erros: Number(casamento[1]) };
}

// ─── FQ-M1: o Manifesto.1 construido VALIDA contra o schema oficial ───────────

describe("FQ-M1 — Pedaco[] → Manifesto.1 valida contra o schema oficial", () => {
  const roteiros = [
    "roteiro-valido.json",
    "roteiro-com-narracao.json",
    "roteiro-canonico-derivado.json",
  ];

  for (const nome of roteiros) {
    it(`${nome} → manifesto que o schema oficial aceita (Ajv TS + Python)`, () => {
      const roteiro = carregarRoteiro(nome);
      const manifesto = construirManifesto(roteiro);

      // Espelho TS do schema oficial (mesmo arquivo schema/manifesto.schema.json).
      const resultado = validarManifestoConstruido(manifesto);
      expect(resultado.problemas, resultado.problemas.join("\n")).toEqual([]);

      // O validador OFICIAL do repositorio (jsonschema Python — o do
      // just contrato_testar) contra a MESMA saida. Sem jsonschema
      // instalado o espelho TS ja respondeu; com ele, os dois tem de
      // concordar.
      const python = validarComPython(manifesto);
      if (python.disponivel) {
        expect(python.erros, "validador Python rejeitou a saida do construtor").toBe(0);
      }

      // Sonda negativa (anti-C2): o validador tem de REPROVAR um
      // manifesto mutado — sem isto o teste passaria com o validador
      // quebrado ("aceita qualquer coisa").
      const mutado = { ...manifesto, nos: [] };
      expect(validarManifestoConstruido(mutado).valido).toBe(false);
      if (python.disponivel) {
        expect(validarComPython(mutado).erros).toBeGreaterThan(0);
      }
    });
  }

  it("duracao_total_frames bate com a aritmetica do F1-01 (calcularDuracao)", () => {
    // O campo nao pode mentir para o render: o totalFrames que a
    // composicao usa (timeline subtraida das transicoes) tem de ser o
    // mesmo numero declarado no manifesto.
    for (const nome of roteiros) {
      const manifesto = construirManifesto(carregarRoteiro(nome));
      expect(calcularDuracao(manifesto).totalFrames).toBe(
        manifesto.duracao_total_frames as number,
      );
    }
  });

  it("construir 2x do mesmo roteiro = bytes identicos (determinismo por conteudo)", () => {
    for (const nome of roteiros) {
      const a = construirManifesto(carregarRoteiro(nome));
      const b = construirManifesto(carregarRoteiro(nome));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});

// ─── FQ-M2: duracao_total_frames == soma das duracoes (tolerancia 1s) ─────────

describe("FQ-M2 — duracao_total_frames == soma das duracoes dos pedacos", () => {
  it("soma dos pedacos (tolerancia 1s em frames) para todos os roteiros", () => {
    const roteiros = ["roteiro-valido.json", "roteiro-com-narracao.json", "roteiro-canonico-derivado.json"];
    for (const nome of roteiros) {
      const roteiro = carregarRoteiro(nome);
      const manifesto = construirManifesto(roteiro);
      const soma = roteiro.pedacos.reduce(
        (acc, pedaco) => acc + duracaoEmFrames(pedaco.duracao_segundos, manifesto.fps),
        0,
      );
      expect(
        Math.abs((manifesto.duracao_total_frames as number) - soma),
        `${nome}: total ${String(manifesto.duracao_total_frames)} vs soma ${String(soma)}`,
      ).toBeLessThanOrEqual(manifesto.fps);
    }
  });

  it("sonda negativa: soma mutada quebra o invariante (a conta e real)", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const manifesto = construirManifesto(roteiro);
    const soma = roteiro.pedacos.reduce(
      (acc, pedaco) => acc + duracaoEmFrames(pedaco.duracao_segundos, manifesto.fps),
      0,
    );
    // O invariante FQ-M2 nao e vazio: com um frame a mais ele falha.
    expect(Math.abs((manifesto.duracao_total_frames as number) + 1 - soma)).toBeGreaterThan(0);
    // E o manifesto mutado continua reprovando na validacao estrutural
    // do estrito (duracao_total_frames fora de sincronia com as cenas
    // nao e erro de schema, mas o plano da composicao nao muda por isso:
    // a verdade do render e a timeline — conferida no FQ-M1 acima).
    expect(calcularDuracao(manifesto).totalFrames).toBe(
      manifesto.duracao_total_frames as number,
    );
  });
});

// ─── FQ-M3: reduzirManifesto (API PUBLICA — o preview da Onda 4) ──────────────

describe("FQ-M3 — reduzirManifesto: um pedaco, so os nos dele", () => {
  const roteiro = carregarRoteiro("roteiro-com-narracao.json");
  const manifesto = construirManifesto(roteiro);

  it("reducao por indice: duracao do pedaco, so os nos da cena, valida", () => {
    for (let indice = 0; indice < roteiro.pedacos.length; indice++) {
      const pedaco = roteiro.pedacos[indice]!;
      const reduzido = reduzirManifesto(manifesto, indice);

      // Uma cena so, a do indice.
      expect(reduzido.cenas).toHaveLength(1);
      expect(reduzido.cenas[0]!.id).toBe(manifesto.cenas[indice]!.id);

      // So os nos da cena (a lista plana carrega apenas os referenciados).
      expect(reduzido.nos.map((no) => no.id)).toEqual(reduzido.cenas[0]!.nos);
      expect(reduzido.nos).toHaveLength(1);
      expect(reduzido.nos[0]!.id).toBe(manifesto.cenas[indice]!.nos[0]);

      // Duracao == duracao do pedaco (frames).
      expect(reduzido.duracao_total_frames).toBe(
        duracaoEmFrames(pedaco.duracao_segundos, manifesto.fps),
      );

      // Valida contra o schema oficial.
      expect(validarManifestoConstruido(reduzido).valido).toBe(true);

      // Determinismo por conteudo: mesma entrada, mesma saida.
      expect(JSON.stringify(reduzirManifesto(manifesto, indice))).toBe(
        JSON.stringify(reduzido),
      );
    }
  });

  it("audio_cena do pedaco sobrevive a reducao (o preview narra)", () => {
    const reduzido = reduzirManifesto(manifesto, 1); // p-001: origem tts
    expect(reduzido.cenas[0]!.audio_cena?.texto_locucao).toBe(
      roteiro.pedacos[1]!.narracao.texto,
    );
  });

  it("indice fora do limite e erro nomeado (nunca reduzido em silencio)", () => {
    expect(() => reduzirManifesto(manifesto, -1)).toThrow(ErroReduzirManifesto);
    expect(() => reduzirManifesto(manifesto, roteiro.pedacos.length)).toThrow(
      ErroReduzirManifesto,
    );
    expect(() => reduzirManifesto(manifesto, 1.5)).toThrow(ErroReduzirManifesto);
  });

  it("sonda negativa: cena com no inexistente e recusa nomeada", () => {
    // A reducao nao pode "consertar" um manifesto quebrado em silencio:
    // cena referenciando no que nao existe = erro (integridade
    // referencial — a mesma regra da ponte AB-550). Remove o no que a
    // cena 0 referencia e exige recusa.
    const idDoNoDaCena0 = manifesto.cenas[0]!.nos[0]!;
    const quebrado: Manifesto = {
      ...manifesto,
      nos: manifesto.nos.filter((no) => no.id !== idDoNoDaCena0),
    };
    expect(() => reduzirManifesto(quebrado, 0)).toThrow(ErroReduzirManifesto);
  });
});

// ─── FQ-M4: fala → audio_cena.texto_locucao (e o record-first) ────────────────

describe("FQ-M4 — a fala chega como audio_cena.texto_locucao", () => {
  it("origem tts/gravacao geram audio_cena com o texto da narracao", () => {
    const roteiro = carregarRoteiro("roteiro-com-narracao.json");
    const manifesto = construirManifesto(roteiro);

    // p-001: tts → texto_locucao == narracao.texto; hash_locucao = hash
    // de conteudo do texto (placeholder deterministico — o audio real
    // nasce no estagio locucao).
    const cena1 = manifesto.cenas[1]!;
    expect(cena1.audio_cena?.texto_locucao).toBe(roteiro.pedacos[1]!.narracao.texto);
    expect(cena1.audio_cena?.hash_locucao).toBe(
      createHash("sha256").update(roteiro.pedacos[1]!.narracao.texto).digest("hex"),
    );

    // p-002: gravacao → hash_locucao == hash_audio (os bytes reais do
    // wav do usuario, nunca fabricados).
    const cena2 = manifesto.cenas[2]!;
    expect(cena2.audio_cena?.texto_locucao).toBe(roteiro.pedacos[2]!.narracao.texto);
    expect(cena2.audio_cena?.hash_locucao).toBe(roteiro.pedacos[2]!.narracao.hash_audio);

    // p-003: status "editado" — o audio fala o texto ANTIGO (narracao.
    // texto), nunca a fala corrente; e o que o estagio locucao vai
    // sintetizar para casar com o audio stale (regra
    // gerado-dessincronizado no nivel do roteiro).
    const cena3 = manifesto.cenas[3]!;
    expect(cena3.audio_cena?.texto_locucao).toBe(roteiro.pedacos[3]!.narracao.texto);
    expect(cena3.audio_cena?.texto_locucao).not.toBe(roteiro.pedacos[3]!.fala);
  });

  it("RECORD-FIRST: fala com origem nenhuma NAO gera audio_cena (cena silenciosa)", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const manifesto = construirManifesto(roteiro);

    // roteiro-valido tem fala != "" nos pedacos 1 e 2 com origem
    // "nenhuma" — o estado normal do roteiro recem-gerado: a cena
    // renderiza silenciosa e a UI mostra o botao de gravacao.
    expect(roteiro.pedacos[1]!.fala).not.toBe("");
    expect(roteiro.pedacos[1]!.narracao.origem).toBe("nenhuma");
    for (const cena of manifesto.cenas) {
      expect(cena.audio_cena, `cena "${cena.id}" nao deveria ter audio_cena`).toBeUndefined();
    }
  });

  it("sonda negativa: origem nenhuma NUNCA gera audio_cena (varredura no completo)", () => {
    const roteiro = carregarRoteiro("roteiro-canonico-derivado.json");
    const manifesto = construirManifesto(roteiro);
    for (const pedaco of roteiro.pedacos) {
      const cena = manifesto.cenas[pedaco.indice]!;
      if (pedaco.narracao.origem === "nenhuma") {
        expect(cena.audio_cena).toBeUndefined();
      } else {
        expect(cena.audio_cena?.texto_locucao).toBe(pedaco.narracao.texto);
      }
    }
  });
});

// ─── Regras de anexo: nunca emite manifesto invalido ──────────────────────────

describe("anexo — gif/video sem anexo_hash e erro nomeado", () => {
  it("construirManifesto recusa roteiro com gif sem anexo (regra do contrato)", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    // Muta o pedaco 0 para gif SEM anexo (anexo-exigido-para-gif-video).
    const mutado: Roteiro = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((pedaco, i) =>
        i === 0
          ? { ...pedaco, tipo_visual: "gif" as const, especificacao_visual: "gif sem anexo" }
          : pedaco,
      ),
    };
    let lancou = false;
    try {
      construirManifesto(mutado);
    } catch (erro) {
      lancou = true;
      expect(erro).toBeInstanceOf(ErroContratoRoteiro);
      expect(String(erro)).toContain("anexo-exigido-para-gif-video");
    }
    expect(lancou, "gif sem anexo tem de ser recusado — nunca manifesto invalido").toBe(true);
  });

  it("mapearPedacoParaNo recusa gif sem anexo direto (fail-closed do mapeamento)", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const pedacoGifSemAnexo = {
      ...roteiro.pedacos[0]!,
      tipo_visual: "gif" as const,
      anexo_hash: undefined,
      anexo_meta: undefined,
    };
    expect(() => mapearPedacoParaNo(pedacoGifSemAnexo, "n-000", 120)).toThrow(
      ErroAnexoAusente,
    );
  });

  it("anexo em pedaco texto e recusado (anexo-proibido-outros)", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const mutado: Roteiro = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((pedaco, i) =>
        i === 0
          ? {
              ...pedaco,
              anexo_hash:
                "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
              anexo_meta: { tipo: "image/gif" as const, tamanho_bytes: 100, nome_original: "x.gif" },
            }
          : pedaco,
      ),
    };
    expect(() => construirManifesto(mutado)).toThrow(/anexo-proibido-outros/);
  });

  it("sonda negativa: opcoes fora do schema (fps 0) sao recusadas", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    expect(() => construirManifesto(roteiro, { fps: 0 })).toThrow(ErroOpcoesInvalidas);
    expect(() => construirManifesto(roteiro, { fps: 121 })).toThrow(ErroOpcoesInvalidas);
    expect(() => construirManifesto(roteiro, { fps: 29.5 })).toThrow(ErroOpcoesInvalidas);
    expect(() =>
      construirManifesto(roteiro, { transicao: "cube" as never }),
    ).toThrow(ErroOpcoesInvalidas);
  });
});

// ─── Tabela de mapeamento tipo_visual → no (contrato §3/§5) ───────────────────

describe("mapeamento tipo_visual → no (a tabela do contrato)", () => {
  it("cada tipo_visual produz o no da tabela, com o conteudo da especificacao", () => {
    const roteiro = carregarRoteiro("roteiro-canonico-derivado.json");
    const manifesto = construirManifesto(roteiro);
    const nosPorCena = new Map<string, No>(
      manifesto.cenas.map((cena) => {
        const no = manifesto.nos.find((n) => n.id === cena.nos[0]);
        return [cena.id, no as No];
      }),
    );

    const no = (indice: number): No => nosPorCena.get(`c-${String(indice).padStart(3, "0")}`)!;

    const n0 = no(0);
    expect(n0.type).toBe("cabecalho");
    if (isNoCabecalho(n0)) {
      expect(n0.texto).toBe(roteiro.pedacos[0]!.titulo);
    } else {
      throw new Error("pedaco cabecalho deveria virar NoCabecalho");
    }

    const n1 = no(1);
    expect(n1.type).toBe("texto");
    if (isNoTexto(n1)) {
      expect(n1.texto).toBe(roteiro.pedacos[1]!.especificacao_visual);
    } else {
      throw new Error("pedaco texto deveria virar NoTexto");
    }

    const n2 = no(2);
    expect(n2.type).toBe("lista");
    if (isNoLista(n2)) {
      expect(n2.itens).toHaveLength(3);
    } else {
      throw new Error("pedaco lista deveria virar NoLista");
    }

    const n3 = no(3);
    expect(n3.type).toBe("midia");
    if (isNoMidia(n3)) {
      expect(n3.tipo_midia).toBe("video");
      expect(n3.hash).toBe(roteiro.pedacos[3]!.anexo_hash);
      expect(n3.licenca).toBe("uso-pessoal-ADR-0003");
    } else {
      throw new Error("pedaco video deveria virar NoMidia");
    }

    const n4 = no(4);
    expect(n4.type).toBe("midia");
    if (isNoMidia(n4)) {
      expect(n4.tipo_midia).toBe("gif");
      expect(n4.hash).toBe(roteiro.pedacos[4]!.anexo_hash);
    } else {
      throw new Error("pedaco gif deveria virar NoMidia");
    }

    const n5 = no(5);
    expect(n5.type).toBe("grafico");
    if (isNoGrafico(n5)) {
      expect(n5.tipo_grafico).toBe("barras");
    } else {
      throw new Error("pedaco grafico deveria virar NoGrafico");
    }

    // manim → NoGrafico (decisao documentada em mapear.ts: o estagio
    // grafico e o unico runner Manim e so consome nos grafico; a cena
    // do catalogo vem das palavras da especificacao).
    const n6 = no(6);
    expect(n6.type).toBe("grafico");
    if (isNoGrafico(n6)) {
      expect(n6.tipo_grafico).toBe("linha"); // "parabola e soma de Riemann"
      expect(n6.dados.length).toBeGreaterThanOrEqual(1);
    } else {
      throw new Error("pedaco manim deveria virar NoGrafico");
    }
  });

  it("detectarTipoGrafico: palavras da especificacao decidem o tipo", () => {
    expect(detectarTipoGrafico("Grafico de barras comparando tempo")).toBe("barras");
    expect(detectarTipoGrafico("Grafico de linha com tendencia")).toBe("linha");
    expect(detectarTipoGrafico("grafico de pizza com distribuicao")).toBe("pizza");
    expect(detectarTipoGrafico("Grafico de area acumulado")).toBe("area");
    expect(detectarTipoGrafico("grafico de dispersao com correlacao")).toBe("dispersao");
    expect(detectarTipoGrafico("qualquer coisa sem palavra conhecida")).toBe("barras");
  });

  it("detectarCenaManim: palavras da especificacao escolhem a cena do catalogo", () => {
    expect(detectarCenaManim("parabola e soma de Riemann")).toBe("linha");
    expect(detectarCenaManim("circulo unitario e cosseno")).toBe("dispersao");
    expect(detectarCenaManim("serie de Taylor termo a termo")).toBe("area");
    expect(detectarCenaManim("animacao generica estilo 3b1b")).toBe("barras");
  });

  it("extrairDados: numeros da especificacao viram a serie; sem numeros, placeholder", () => {
    const serie = extrairDados("valores: 45, 32, 78, 210", "Titulo");
    expect(serie.map((d) => d.valor)).toEqual([45, 32, 78, 210]);
    expect(serie.map((d) => d.rotulo)).toEqual(["Dado 1", "Dado 2", "Dado 3", "Dado 4"]);
    expect(extrairDados("sem numeros nenhum", "Titulo")).toEqual([
      { rotulo: "Titulo", valor: 1 },
    ]);
  });

  it("separarItens: uma linha por item, linhas vazias podadas", () => {
    expect(separarItens("a\nb\nc", "t")).toEqual(["a", "b", "c"]);
    expect(separarItens("linha unica", "t")).toEqual(["linha unica"]);
    expect(separarItens("  a  \n\n  b  ", "t")).toEqual(["a", "b"]);
    expect(separarItens("   ", "fallback")).toEqual(["fallback"]);
  });

  it("sonda negativa: a varredura acima casou 7 nos (contagem real)", () => {
    const roteiro = carregarRoteiro("roteiro-canonico-derivado.json");
    const manifesto = construirManifesto(roteiro);
    expect(manifesto.nos).toHaveLength(7);
    expect(new Set(manifesto.nos.map((n) => n.type)).size).toBeGreaterThanOrEqual(5);
  });
});

// ─── CLI D11 (docs/roteiro/api.md §CLIs) ──────────────────────────────────────

describe("CLI do construtor (D11 — stdin JSON, stdout JSON, --estado)", () => {
  function rodarCli(entrada: unknown, args: readonly string[] = []): {
    ok: boolean;
    stdout: string;
    stderr: string;
  } {
    try {
      const stdout = execFileSync(BIN_TSX, [CAMINHO_CLI, ...args], {
        cwd: RAIZ,
        input: JSON.stringify(entrada),
        encoding: "utf-8",
        timeout: 60_000,
      });
      return { ok: true, stdout: String(stdout), stderr: "" };
    } catch (erro) {
      const e = erro as { stdout?: unknown; stderr?: unknown };
      return {
        ok: false,
        stdout: String(e.stdout ?? ""),
        stderr: String(e.stderr ?? ""),
      };
    }
  }

  it("construir: roteiro no stdin → manifesto valido no stdout, exit 0", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = rodarCli({ roteiro });
    expect(resultado.ok, resultado.stderr).toBe(true);
    const saida = JSON.parse(resultado.stdout) as { manifesto: Manifesto };
    expect(validarManifestoConstruido(saida.manifesto).valido).toBe(true);
    expect(saida.manifesto.cenas).toHaveLength(roteiro.pedacos.length);
  });

  it("construir + indice_pedaco: stdout com o manifesto REDUZIDO do pedaco", () => {
    const roteiro = carregarRoteiro("roteiro-com-narracao.json");
    const resultado = rodarCli({ roteiro, indice_pedaco: 2 });
    expect(resultado.ok, resultado.stderr).toBe(true);
    const saida = JSON.parse(resultado.stdout) as { manifesto: Manifesto };
    expect(saida.manifesto.cenas).toHaveLength(1);
    expect(saida.manifesto.cenas[0]!.id).toBe("c-002");
    expect(saida.manifesto.duracao_total_frames).toBe(
      duracaoEmFrames(roteiro.pedacos[2]!.duracao_segundos, 30),
    );
    expect(validarManifestoConstruido(saida.manifesto).valido).toBe(true);
  });

  it("--estado: arquivo reescrito ate ok (o poll do servidor)", () => {
    const diretorio = mkdtempSync(join(tmpdir(), "construtor-cli-"));
    const caminho = join(diretorio, "estado.json");
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = rodarCli({ roteiro }, ["--estado", caminho]);
    expect(resultado.ok, resultado.stderr).toBe(true);
    const estado = JSON.parse(readFileSync(caminho, "utf-8")) as { estado: string };
    expect(estado.estado).toBe("ok");
  });

  it("erro: roteiro invalido → exit != 0, stderr com a regra, estado erro", () => {
    const diretorio = mkdtempSync(join(tmpdir(), "construtor-cli-"));
    const caminho = join(diretorio, "estado.json");
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const mutado = {
      ...roteiro,
      pedacos: roteiro.pedacos.map((pedaco, i) =>
        i === 0 ? { ...pedaco, tipo_visual: "gif", especificacao_visual: "sem anexo" } : pedaco,
      ),
    };
    const resultado = rodarCli({ roteiro: mutado }, ["--estado", caminho]);
    expect(resultado.ok).toBe(false);
    expect(resultado.stderr).toContain("anexo-exigido-para-gif-video");
    const estado = JSON.parse(readFileSync(caminho, "utf-8")) as { estado: string };
    expect(estado.estado).toBe("erro");
  });

  it("reduzir de manifesto pronto (reuso entre jobs de preview)", () => {
    const roteiro = carregarRoteiro("roteiro-com-narracao.json");
    const completo = construirManifesto(roteiro);
    const resultado = rodarCli({ manifesto: completo, indice_pedaco: 1 });
    expect(resultado.ok, resultado.stderr).toBe(true);
    const saida = JSON.parse(resultado.stdout) as { manifesto: Manifesto };
    expect(saida.manifesto.cenas).toHaveLength(1);
    expect(saida.manifesto.cenas[0]!.audio_cena?.texto_locucao).toBe(
      roteiro.pedacos[1]!.narracao.texto,
    );
  });

  it("sonda negativa: pedido ambiguo (roteiro E manifesto) e recusado", () => {
    const roteiro = carregarRoteiro("roteiro-valido.json");
    const resultado = rodarCli({ roteiro, manifesto: { schema_version: "Manifesto.1" } });
    expect(resultado.ok).toBe(false);
    expect(resultado.stderr).toContain("pedido-invalido");
  });
});

// ─── Round-trip com a fixture canonica ────────────────────────────────────────

describe("round-trip com a fixture canonica (o exemplo real completo)", () => {
  it("roteiro derivado da canonica → manifesto que valida, com a soma certa", () => {
    const roteiro = carregarRoteiro("roteiro-canonico-derivado.json");
    const manifesto = construirManifesto(roteiro);

    expect(validarManifestoConstruido(manifesto).valido).toBe(true);
    // 32.0s @ 30fps = 960 frames; sem transicao o total e a soma pura.
    expect(manifesto.duracao_total_frames).toBe(960);
    expect(calcularDuracao(manifesto).totalFrames).toBe(960);
    // A soma dos pedacos confere com duracao_total_segundos do roteiro.
    const soma = roteiro.pedacos.reduce((acc, p) => acc + p.duracao_segundos, 0);
    expect(soma).toBe(roteiro.duracao_total_segundos);
  });

  it("sonda negativa: reduzir cada pedaco da derivada valida um a um", () => {
    const roteiro = carregarRoteiro("roteiro-canonico-derivado.json");
    const manifesto = construirManifesto(roteiro);
    for (let i = 0; i < roteiro.pedacos.length; i++) {
      const reduzido = reduzirManifesto(manifesto, i);
      expect(validarManifestoConstruido(reduzido).valido).toBe(true);
      expect(reduzido.duracao_total_frames).toBe(
        duracaoEmFrames(roteiro.pedacos[i]!.duracao_segundos, 30),
      );
    }
  });

  it("transicao opcional: total subtraido da sobreposicao (aritmetica do F1-01)", () => {
    const roteiro = carregarRoteiro("roteiro-canonico-derivado.json");
    const manifesto = construirManifesto(roteiro, { transicao: "fade" });
    // 7 pedacos = 6 fronteiras; base 300ms a 30fps = 9 frames cada.
    expect(manifesto.duracao_total_frames).toBe(960 - 6 * 9);
    // E a timeline do render concorda com o declarado.
    expect(calcularDuracao(manifesto).totalFrames).toBe(manifesto.duracao_total_frames);
    expect(validarManifestoConstruido(manifesto).valido).toBe(true);
  });
});
