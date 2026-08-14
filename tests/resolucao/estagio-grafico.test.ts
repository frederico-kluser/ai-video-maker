/**
 * tests/resolucao/estagio-grafico.test.ts
 *
 * Oraculo do card F2-02 — estagio de resolucao `grafico` (Manim headless).
 *
 * Roda com a rede bloqueada: o setup do vitest instala o guarda em processo
 * (tests/setup/rede-bloqueada.ts) e `res-offline` ainda poe o namespace de
 * rede do kernel por fora. Nenhum teste aqui renderiza: o Manim nao e
 * dependencia de teste deste repositorio, e o cassete existe justamente para
 * que ele nao precise ser.
 *
 * NOTA SOBRE ASSERCOES DE LISTA COMPLETA (pergunta obrigatoria da W4):
 * nenhum teste deste arquivo asserta a lista fechada de estagios, de
 * cassetes ou de arquivos. Toda assercao e sobre a PRESENCA do item deste
 * card. Quatro irmaos estao entregando estagios em paralelo, cegos entre si:
 * um `toEqual(["grafico"])` seria verdade contra esta base e falso na
 * primeira hora depois do merge do vizinho.
 *
 * SECAO Q7 (revisao adversarial da onda grafico-matematica, 2026-08-14):
 * o bug de `distribuirFrames` — com poucos frames o piso virava 0, as
 * definicoes dos mobjects eram descartadas e o Python gerado referenciava
 * variaveis nunca definidas (NameError dentro do subprocesso). As secoes
 * "duracao pequena" validam o Python gerado com ast (sintaxe + definicoes
 * antes de referencias) para as 5 cenas em duracoes 1/3/5/7/10; a secao
 * "materializacao dos corpos" referencia a materializacao de gravar.ts
 * (remover a funcao deixa o teste VERMELHO); e o replay do cassete da
 * fixture canonica via orquestrador offline cobre o cassete que antes so
 * era lido por fora do orquestrador.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { chaveDoEstagio, hashDoManifesto } from "../../src/resolucao/contrato.js";
import type { EntradaEstagio, EstagioResolucao } from "../../src/resolucao/contrato.js";
import { descobrirEstagios } from "../../src/resolucao/descoberta.js";
import { Orquestrador } from "../../src/resolucao/orquestrador.js";
import { encontrarURLs } from "../../src/resolucao/manifesto-resolvido.js";
import {
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  procurarCredencial,
  validarProcedencia,
} from "../../src/resolucao/cassete/formato.js";
import { lerCassete } from "../../src/resolucao/cassete/reprodutor.js";
import { gravarCassete } from "../../src/resolucao/cassete/gravador.js";
import { redeBloqueada, tentativasDeSaida } from "../../src/resolucao/rede/bloqueio.js";

import estagioGrafico, {
  LICENCA_DA_SAIDA,
  criarEstagioGrafico,
  nosDeGrafico,
} from "../../src/resolucao/grafico/estagio.js";
import { MANIFESTO_DE_GRAVACAO } from "../../src/resolucao/grafico/manifesto-de-gravacao.js";
import { materializarCorpos } from "../../src/resolucao/grafico/gravar.js";
import {
  expressaoDeCor,
  gerarCenaManim,
  literalPython,
  nomeDaCenaDoNo,
  repartirFrames,
} from "../../src/resolucao/grafico/cena.js";
import type {
  ExecutorManim,
  JobDeRender,
  ResultadoDeRender,
} from "../../src/resolucao/grafico/executor.js";
import type { Manifesto, NoGrafico, TipoGrafico } from "../../src/contratos/manifesto.js";

// ─── Auxiliares ─────────────────────────────────────────────────────────────────

const NO_DE_TESTE: NoGrafico = {
  id: "g-teste",
  schema: "Grafico.1",
  type: "grafico",
  duracao_frames: 30,
  tipo_grafico: "barras",
  titulo: "Titulo com acentuacao: cao, coracao",
  dados: [
    { rotulo: "um", valor: 3, cor: "CYAN" },
    { rotulo: "dois", valor: 7 },
  ],
};

const OPCOES = { fps: 30, larguraPx: 1920, alturaPx: 1080 };

/**
 * Executor de teste: devolve um resultado fixo e registra os jobs.
 *
 * Nao renderiza. Isto NAO e o executor de producao disfarcado: o estagio
 * real e construido com `ExecutorManimSubprocesso` no `export default`, e e
 * essa instancia que a descoberta por convencao encontra.
 */
class ExecutorDeTeste implements ExecutorManim {
  readonly jobs: JobDeRender[] = [];
  constructor(private readonly hashes: readonly string[]) {}

  renderizar(job: JobDeRender): Promise<ResultadoDeRender> {
    const hash = this.hashes[this.jobs.length % this.hashes.length] as string;
    this.jobs.push(job);
    return Promise.resolve({
      hash,
      bytes: 1234,
      largura: job.larguraPx,
      altura: job.alturaPx,
      framesDeclarados: 30,
      framesInspecionados: 12,
      framesChapados: 1,
      nomeCena: "CenaDeTeste",
      correcoes: ["cor: CYAN -> TEAL"],
      ferramenta: `manim ${job.versaoManim}`,
      muxer: job.versaoMuxer,
    });
  }
}

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function entradaDe(estagio: EstagioResolucao, manifesto = MANIFESTO_DE_GRAVACAO): EntradaEstagio {
  return {
    manifesto,
    parametros: estagio.parametros,
    fetch: (() => {
      throw new Error("o estagio grafico nao deve chamar fetch");
    }) as unknown as typeof fetch,
    diretorioTrabalho: "/tmp/nao-usado-por-este-teste",
  };
}

const RAIZ_REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR_QUIRKS = join(RAIZ_REPO, "src", "resolucao", "grafico", "manim");

/**
 * Roda um trecho Python com o modulo de quirks no path.
 *
 * Nao ha `skip` se o python3 faltar: ferramenta ausente e VERMELHO
 * (tools/gate.sh). Um teste de ponte entre linguagens que se pula sozinho
 * quando a outra linguagem some prova exatamente nada.
 */
function python(codigo: string): string {
  return execFileSync("python3", ["-c", codigo], {
    encoding: "utf-8",
    cwd: RAIZ_REPO,
  }).trim();
}

/**
 * Valida o Python gerado com `ast` — comportamento-pinado, nao
 * artefato-pinado (Q7). Regras, no espirito da correcao de
 * `distribuirFrames`:
 *
 *   1. sintaxe valida (`ast.parse`);
 *   2. TODAS as atribuicoes da `construct` precedem o primeiro
 *      `self.play` — os mobjects sao criados no inicio da cena;
 *   3. todo nome em posicao de VALOR dentro de um `self.play` esta
 *      definido antes, ou e constante MAIUSCULA do namespace do manim
 *      (`CYAN`, `WHITE`, ...) — nenhum `NameError` possivel;
 *   4. nenhuma definicao usa nome ainda nao definido (a ordem dos passos
 *      do esboco e respeitada na emissao).
 *
 * Nomes em posicao de funcao (`Write`, `Indicate`, `MathTex`, ...) sao
 * identificadores do `from manim import *` e nunca mobjects — nao sao
 * checados. Parametros de `lambda` sao locais e nao pendencias.
 */
function validarPythonGerado(fonte: string): { ok: boolean; problemas: string[] } {
  const script = [
    "import ast, json",
    "",
    "fonte = " + JSON.stringify(fonte),
    "arvore = ast.parse(fonte)",
    "",
    "construct = None",
    "for no in ast.walk(arvore):",
    "    if isinstance(no, ast.FunctionDef) and no.name == 'construct':",
    "        construct = no",
    "        break",
    "if construct is None:",
    "    print(json.dumps({'ok': False, 'problemas': ['sem def construct']}))",
    "    raise SystemExit(0)",
    "",
    "def e_play(stmt):",
    "    return (",
    "        isinstance(stmt, ast.Expr)",
    "        and isinstance(stmt.value, ast.Call)",
    "        and isinstance(stmt.value.func, ast.Attribute)",
    "        and isinstance(stmt.value.func.value, ast.Name)",
    "        and stmt.value.func.value.id == 'self'",
    "        and stmt.value.func.attr == 'play'",
    "    )",
    "",
    "def alvos_de(stmt):",
    "    if isinstance(stmt, ast.Assign):",
    "        alvos = stmt.targets",
    "    elif isinstance(stmt, ast.AnnAssign):",
    "        alvos = [stmt.target]",
    "    elif isinstance(stmt, ast.AugAssign):",
    "        alvos = [stmt.target]",
    "    else:",
    "        alvos = []",
    "    for alvo in alvos:",
    "        for no in ast.walk(alvo):",
    "            if isinstance(no, ast.Name) and isinstance(no.ctx, ast.Store):",
    "                yield no.id",
    "",
    "def cargas_de(no, cargas, locais):",
    "    if isinstance(no, ast.Name):",
    "        if isinstance(no.ctx, ast.Load) and no.id != 'self' and no.id not in locais:",
    "            cargas.add(no.id)",
    "        return",
    "    if isinstance(no, ast.Call):",
    "        # Callee em posicao de funcao e do namespace do manim (Write,",
    "        # Indicate, ...); a BASE de um Attribute (passo5 em",
    "        # passo5.animate.set_color) e um mobject do cenario.",
    "        if not isinstance(no.func, ast.Name):",
    "            cargas_de(no.func, cargas, locais)",
    "        for arg in no.args:",
    "            cargas_de(arg, cargas, locais)",
    "        for kw in no.keywords:",
    "            cargas_de(kw.value, cargas, locais)",
    "        return",
    "    if isinstance(no, ast.Lambda):",
    "        for a in no.args.args:",
    "            locais.add(a.arg)",
    "        cargas_de(no.body, cargas, locais)",
    "        return",
    "    for filho in ast.iter_child_nodes(no):",
    "        cargas_de(filho, cargas, locais)",
    "",
    "problemas = []",
    "definidos = set()",
    "primeiro_play = None",
    "for i, stmt in enumerate(construct.body):",
    "    if e_play(stmt):",
    "        primeiro_play = i",
    "        break",
    "    for alvo in alvos_de(stmt):",
    "        definidos.add(alvo)",
    "",
    "if primeiro_play is None:",
    "    problemas.append('sem self.play nenhum')",
    "else:",
    "    for stmt in construct.body[primeiro_play:]:",
    "        for alvo in alvos_de(stmt):",
    "            problemas.append('definicao de %r depois do primeiro play' % alvo)",
    "    # Nomes usados em plays: definidos antes, ou constantes MAIUSCULAS.",
    "    for stmt in construct.body:",
    "        if not e_play(stmt):",
    "            continue",
    "        cargas = set()",
    "        locais = set()",
    "        for arg in stmt.value.args:",
    "            cargas_de(arg, cargas, locais)",
    "        cargas -= locais",
    "        for nome in sorted(cargas):",
    "            if nome not in definidos and not nome.isupper():",
    "                problemas.append('%r usado em self.play sem definicao anterior' % nome)",
    "    # Definicoes: ordem dos passos do esboco — nada usa nome pendente.",
    "    vistos = set()",
    "    for stmt in construct.body[:primeiro_play]:",
    "        cargas = set()",
    "        locais = set()",
    "        corpo = stmt.value if isinstance(stmt, ast.Expr) else stmt",
    "        cargas_de(corpo, cargas, locais)",
    "        cargas -= locais",
    "        for nome in sorted(cargas):",
    "            if nome not in vistos and nome not in definidos and not nome.isupper():",
    "                problemas.append('%r usado antes de ser definido' % nome)",
    "        for alvo in alvos_de(stmt):",
    "            vistos.add(alvo)",
    "",
    "print(json.dumps({'ok': not problemas, 'problemas': problemas}))",
  ].join("\n");
  return JSON.parse(python(script)) as { ok: boolean; problemas: string[] };
}

// ─── 1. Geracao de cena: pura e deterministica ──────────────────────────────────

describe("F2-02 — geracao da cena Manim", () => {
  it("e deterministica: duas chamadas produzem a MESMA fonte", () => {
    const a = gerarCenaManim(NO_DE_TESTE, OPCOES);
    const b = gerarCenaManim(NO_DE_TESTE, OPCOES);
    expect(b.fonte).toBe(a.fonte);
    expect(b.nomeCena).toBe(a.nomeCena);
  });

  it("reparte os frames sem perder nem inventar frame", () => {
    for (const frames of [3, 15, 30, 31, 90, 137]) {
      const r = repartirFrames(frames);
      expect(r.desenho + r.titulo + r.pausa).toBe(Math.max(3, frames));
      expect(r.desenho).toBeGreaterThan(0);
      expect(r.titulo).toBeGreaterThan(0);
      expect(r.pausa).toBeGreaterThan(0);
    }
  });

  it("da nomes de cena distintos a ids que colapsam na sanitizacao", () => {
    // `n-1` e `n.1` viram o mesmo `n_1` sem o sufixo de hash — e duas cenas
    // com o mesmo nome no mesmo render entregam o video de uma para as duas.
    expect(nomeDaCenaDoNo("n-1")).not.toBe(nomeDaCenaDoNo("n.1"));
  });

  it("cobre os cinco tipos de grafico do contrato do manifesto", () => {
    const tipos = ["barras", "linha", "pizza", "area", "dispersao"] as const;
    for (const tipo of tipos) {
      const cena = gerarCenaManim({ ...NO_DE_TESTE, tipo_grafico: tipo }, OPCOES);
      expect(cena.fonte).toContain("class ");
      expect(cena.fonte).toContain("def construct(self)");
    }
  });
});

// ─── 1b. Q7: duracoes pequenas — Python valido e TOTAL ──────────────────────────

describe("F2-02 — duracao pequena: Python valido para QUALQUER duracao >= 1 (Q7)", () => {
  // Seis dados de proposito: o numero de termos da serie de Taylor e o de
  // pontos do circulo saem de dados.length, e o bug original (piso 0 em
  // `distribuirFrames`) descartava as definicoes quando o orcamento era
  // menor que o numero de passos — a cena inteira colapsava no ultimo play.
  const DADOS_DE_SERIE = [
    { rotulo: "um", valor: 3, cor: "CYAN" },
    { rotulo: "dois", valor: 7 },
    { rotulo: "tres", valor: 2 },
    { rotulo: "quatro", valor: 5 },
    { rotulo: "cinco", valor: 4 },
    { rotulo: "seis", valor: 6 },
  ];
  // 1 e o minimo do contrato (produzir.ts rejeita < 1); 3/5/7/10 sao as
  // duracoes pequenas do achado do revisor (barras 3-6, linha 3-6, pizza 3,
  // area 3-8, dispersao 3-5). O bug original explodia exatamente aqui.
  const DURACOES = [1, 3, 5, 7, 10];

  it("as 5 cenas em duracoes pequenas: ast valido e nenhuma referencia pendente", () => {
    const tipos = ["barras", "linha", "pizza", "area", "dispersao"] as const;
    for (const tipo of tipos) {
      for (const duracao of DURACOES) {
        const cena = gerarCenaManim(
          {
            ...NO_DE_TESTE,
            tipo_grafico: tipo,
            duracao_frames: duracao,
            dados: DADOS_DE_SERIE,
          },
          OPCOES,
        );
        const v = validarPythonGerado(cena.fonte);
        expect(v.problemas, `${tipo} @ ${duracao} frames`).toEqual([]);
      }
    }
  });

  it("nenhuma animacao e descartada: todo passo toca, anexado ou proprio (Q7)", () => {
    // `distribuirFrames` com orcamento menor que o numero de passos anexa
    // as animacoes ao play do grupo anterior — nunca as perde. Contar as
    // animacoes emitidas contra as animacoes dos esbocos e o comportamento
    // observavel: para 3 frames, todos os passos das 5 cenas tocam.
    const animacoes = ["Write(", "Indicate(", "Create(", "FadeIn(", "TransformMatchingTex("];
    for (const tipo of ["barras", "linha", "pizza", "area", "dispersao"] as const) {
      const cena = gerarCenaManim(
        { ...NO_DE_TESTE, tipo_grafico: tipo, duracao_frames: 3, dados: DADOS_DE_SERIE },
        OPCOES,
      );
      const plays = cena.fonte.split("\n").filter((l) => l.includes("self.play"));
      // Nenhum play vazio e nenhuma linha de definicao depois do primeiro play.
      expect(plays.length, `${tipo}: ha play para tocar`).toBeGreaterThan(0);
      for (const p of plays) {
        const anims = animacoes.filter((a) => p.includes(a));
        expect(anims.length, `${tipo}: play sem animacao: ${p}`).toBeGreaterThan(0);
      }
    }
  });

  it("referencia o CATALOGO: cada tipo resolve para a cena do seu indice (Q7)", () => {
    // Comportamento-pinado: estas assinaturas SAO o catalogo (CATALOGO +
    // INDICE_POR_TIPO em cena.ts) expresso em comportamento. Remover
    // "einstein" do catalogo desloca os indices e pelo menos uma destas
    // assercoes deixa de bater — o teste fica VERMELHO nomeando o tipo.
    const assinaturas: ReadonlyArray<readonly [TipoGrafico, string]> = [
      ["barras", 'MathTex("E", "=", "m", "c^2")'], // einstein
      ["linha", "get_riemann_rectangles"], // riemann
      ["pizza", "TransformMatchingTex(passo1, passo2)"], // euler
      ["area", 'r"\\frac{x^2}{2!}"'], // taylor
      ["dispersao", 'r"\\cos^2\\theta + \\sin^2\\theta = 1"'], // circulo
    ];
    for (const [tipo, assinatura] of assinaturas) {
      const cena = gerarCenaManim(
        { ...NO_DE_TESTE, tipo_grafico: tipo, dados: DADOS_DE_SERIE },
        OPCOES,
      );
      expect(cena.fonte, `cena do tipo ${tipo}`).toContain(assinatura);
    }
  });
});

// ─── 2. A ponte TS -> Python: a fonte gerada e aceita pelos quirks ──────────────

describe("F2-02 — a fonte gerada atravessa o pipeline de quirks", () => {
  it("passa por preparar_cena() e sai com o patch de BackgroundRectangle", () => {
    const cena = gerarCenaManim(NO_DE_TESTE, OPCOES);
    const saida = python(
      [
        "import json, sys",
        `sys.path.insert(0, ${JSON.stringify(DIR_QUIRKS)})`,
        "from quirks import preparar_cena",
        `p = preparar_cena(${JSON.stringify(cena.fonte)})`,
        'print(json.dumps({"nome": p.nome_cena, "correcoes": p.correcoes,' +
          ' "tem_patch": "BackgroundRectangle.tex_string" in p.codigo}))',
      ].join("\n"),
    );
    const resultado = JSON.parse(saida) as {
      nome: string;
      correcoes: string[];
      tem_patch: boolean;
    };
    expect(resultado.nome).toBe(cena.nomeCena);
    expect(resultado.tem_patch).toBe(true);
    // `cor: "CYAN"` no manifesto e o call-site VIVO do quirk COLOR_FALLBACKS.
    expect(resultado.correcoes).toContain("cor: CYAN -> TEAL");
  });

  it("emite texto do manifesto como literal Python, e nao como codigo", () => {
    // Um rotulo hostil escrito por um LLM. Se `literalPython` falhar, isto
    // vira codigo executavel dentro do subprocesso de render.
    const hostil = '"); import os; os.system("id"); x = ("';
    const literal = literalPython(hostil);
    const devolvido = python(
      `import ast; print(ast.literal_eval(${JSON.stringify(literal)}))`,
    );
    expect(devolvido).toBe(hostil);
  });

  it("nao deixa uma cor livre virar identificador Python", () => {
    // Nome de cor valido -> identificador (e por aqui que CYAN entra).
    expect(expressaoDeCor("CYAN", 0)).toBe("CYAN");
    // Hexadecimal -> string entre aspas.
    expect(expressaoDeCor("#00FF88", 0).startsWith('"')).toBe(true);
    // Qualquer outra coisa -> cor de serie dos tokens, entre aspas.
    expect(expressaoDeCor("os.system('id')", 0).startsWith('"')).toBe(true);
    expect(expressaoDeCor("azul bonito", 0).startsWith('"')).toBe(true);
  });
});

// ─── 3. O estagio: contrato, e nada de "consertar" a saida ─────────────────────

describe("F2-02 — o estagio", () => {
  it("declara identidade `grafico` e parametros escalares", () => {
    expect(estagioGrafico.identidade.nome).toBe("grafico");
    expect(estagioGrafico.identidade.versao).toMatch(/^\d+\.\d+\.\d+$/);
    for (const [chave, valor] of Object.entries(estagioGrafico.parametros)) {
      expect(["string", "number", "boolean"], `parametro ${chave}`).toContain(typeof valor);
    }
  });

  it("declara a versao da ferramenta externa nos parametros (C12)", () => {
    expect(estagioGrafico.parametros["versaoManim"]).toBeTruthy();
    // O container carrega a tag `encoder=Lavf...`: o muxer muda o hash do
    // asset sem mudar uma linha do nosso codigo.
    expect(estagioGrafico.parametros["versaoMuxer"]).toBeTruthy();
  });

  it("entrega o hash do motor INTACTO — nao normaliza, nao conserta", async () => {
    const executor = new ExecutorDeTeste([HASH_A, HASH_B]);
    const estagio = criarEstagioGrafico({ executor });
    const saida = await estagio.resolver(entradaDe(estagio));

    expect(saida.parcial.nos_grafico).toEqual({ "g-001": HASH_A, "g-002": HASH_B });
    expect(Object.keys(saida.parcial.assets).sort()).toEqual([HASH_A, HASH_B].sort());
    expect(saida.parcial.assets[HASH_A]?.hash).toBe(HASH_A);
  });

  it("preenche SO o mapa `nos_grafico` — nao invade a camada do irmao", async () => {
    const estagio = criarEstagioGrafico({ executor: new ExecutorDeTeste([HASH_A]) });
    const saida = await estagio.resolver(entradaDe(estagio));
    const parcial = saida.parcial as unknown as Record<string, unknown>;
    for (const alheio of ["nos_locucao", "nos_midia", "nos_codigo", "nos_musica"]) {
      expect(parcial[alheio], `${alheio} nao e deste estagio`).toBeUndefined();
    }
    expect(parcial["trilha_sonora"]).toBeUndefined();
  });

  it("nao deixa passar URL nenhuma para a parcial (C7)", async () => {
    const estagio = criarEstagioGrafico({ executor: new ExecutorDeTeste([HASH_A]) });
    const saida = await estagio.resolver(entradaDe(estagio));
    expect(encontrarURLs(saida.parcial)).toEqual([]);
  });

  it("declara licenca nao-vazia no topo e em cada asset", async () => {
    const estagio = criarEstagioGrafico({ executor: new ExecutorDeTeste([HASH_A, HASH_B]) });
    const saida = await estagio.resolver(entradaDe(estagio));
    expect(validarProcedencia(saida.procedencia, "(em memoria)")).toEqual([]);
    expect(saida.procedencia.licenca).toBe(LICENCA_DA_SAIDA);
    expect(saida.procedencia.assets.length).toBe(2);
    for (const asset of saida.procedencia.assets) {
      expect(asset.licenca.trim().length).toBeGreaterThan(0);
    }
  });

  it("nomeia as correcoes de quirk na procedencia — conserto anonimo e conserto invisivel", async () => {
    const estagio = criarEstagioGrafico({ executor: new ExecutorDeTeste([HASH_A]) });
    const saida = await estagio.resolver(entradaDe(estagio));
    expect(saida.procedencia.notas).toContain("CYAN -> TEAL");
  });

  it("com manifesto sem no de grafico, devolve mapa vazio e NAO renderiza", async () => {
    const executor = new ExecutorDeTeste([HASH_A]);
    const estagio = criarEstagioGrafico({ executor });
    const semGraficos = { ...MANIFESTO_DE_GRAVACAO, nos: [], cenas: [] };
    const saida = await estagio.resolver(entradaDe(estagio, semGraficos));
    expect(executor.jobs.length).toBe(0);
    expect(saida.parcial.nos_grafico).toEqual({});
  });

  it("ordena os nos por id, e nao pela ordem do array do manifesto", () => {
    const desordenado = {
      ...MANIFESTO_DE_GRAVACAO,
      nos: [...MANIFESTO_DE_GRAVACAO.nos].reverse(),
    };
    expect(nosDeGrafico(desordenado).map((n) => n.id)).toEqual(["g-001", "g-002"]);
  });
});

// ─── 4. Chave de cache: bump de versao TEM de dar miss ─────────────────────────

describe("F2-02 — chave de cache (C12)", () => {
  it("muda quando a versao do estagio muda", () => {
    const base = chaveDoEstagio(estagioGrafico, MANIFESTO_DE_GRAVACAO);
    const bumpado = criarEstagioGrafico({ versao: "9.9.9" });
    expect(chaveDoEstagio(bumpado, MANIFESTO_DE_GRAVACAO)).not.toBe(base);
  });

  it("o cassete do bump NAO existe — o miss e barulhento, nao silencioso", async () => {
    const bumpado = criarEstagioGrafico({ versao: "9.9.9" });
    const chave = chaveDoEstagio(bumpado, MANIFESTO_DE_GRAVACAO);
    await expect(lerCassete(RAIZ_CASSETES_PADRAO, "grafico", chave)).rejects.toThrow(
      /ECasseteAusente|nao tem cassete/,
    );
  });

  it("muda quando um parametro muda, e repete quando nada muda", () => {
    const base = chaveDoEstagio(estagioGrafico, MANIFESTO_DE_GRAVACAO);
    expect(chaveDoEstagio(estagioGrafico, MANIFESTO_DE_GRAVACAO)).toBe(base);
    const outroFormato: EstagioResolucao = {
      ...estagioGrafico,
      parametros: { ...estagioGrafico.parametros, formato: "mp4" },
    };
    expect(chaveDoEstagio(outroFormato, MANIFESTO_DE_GRAVACAO)).not.toBe(base);
  });

  it("muda quando o manifesto muda", () => {
    const base = hashDoManifesto(MANIFESTO_DE_GRAVACAO);
    expect(hashDoManifesto({ ...MANIFESTO_DE_GRAVACAO, fps: 60 })).not.toBe(base);
  });
});

// ─── 5. Cache quente + rede bloqueada ──────────────────────────────────────────

describe("F2-02 — cache quente com a rede bloqueada", () => {
  const chave = chaveDoEstagio(estagioGrafico, MANIFESTO_DE_GRAVACAO);
  const dirCassete = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "grafico", chave);

  it("o guarda de rede esta de pe durante estes testes", () => {
    expect(redeBloqueada()).toBe(true);
  });

  it("resolve pelo cassete SEM executar o estagio e SEM tentar sair", async () => {
    // O estagio passado ao orquestrador explode se `resolver()` for chamado.
    // Se o orquestrador tocasse no estagio em modo offline, este teste
    // ficaria vermelho com a mensagem exata do motivo.
    let chamou = false;
    const estagioQueExplode: EstagioResolucao = {
      identidade: estagioGrafico.identidade,
      parametros: estagioGrafico.parametros,
      resolver(): never {
        chamou = true;
        throw new Error("resolver() foi chamado com o cache quente");
      },
    };

    const antes = tentativasDeSaida().length;
    const orquestrador = new Orquestrador({
      estagios: [estagioQueExplode],
      raizCassetes: RAIZ_CASSETES_PADRAO,
      modo: "offline",
    });
    const resultado = await orquestrador.resolverEstagio("grafico", MANIFESTO_DE_GRAVACAO);
    const depois = tentativasDeSaida().length;

    expect(chamou).toBe(false);
    expect(depois - antes).toBe(0);
    expect(resultado.resolvido.estagios[0]?.origem).toBe("cassete");
    expect(Object.keys(resultado.resolvido.nos_grafico)).toContain("g-001");
    expect(Object.keys(resultado.resolvido.nos_grafico)).toContain("g-002");
  });

  it("replay do cassete da fixture canonica (3cca1e09…) SEM executar resolver() (Q7)", async () => {
    // Q7: o cassete NOVO (gravado contra a fixture canonica) so era lido
    // por fora do orquestrador. O replay pelo orquestrador com um estagio
    // que explode se resolver() for chamado cobre o caminho que o pipeline
    // usa de verdade — resolver() nunca e chamado com o cache quente.
    const canonico = JSON.parse(
      readFileSync(
        join(RAIZ_REPO, "fixtures", "canonico", "manifesto-valido.json"),
        "utf-8",
      ),
    ) as Manifesto;
    let chamou = false;
    const estagioQueExplode: EstagioResolucao = {
      identidade: estagioGrafico.identidade,
      parametros: estagioGrafico.parametros,
      resolver(): never {
        chamou = true;
        throw new Error("resolver() foi chamado com o cache quente");
      },
    };

    const antes = tentativasDeSaida().length;
    const orquestrador = new Orquestrador({
      estagios: [estagioQueExplode],
      raizCassetes: RAIZ_CASSETES_PADRAO,
      modo: "offline",
    });
    const resultado = await orquestrador.resolverEstagio("grafico", canonico);
    const depois = tentativasDeSaida().length;

    expect(chamou).toBe(false);
    expect(depois - antes).toBe(0);
    expect(resultado.resolvido.estagios[0]?.origem).toBe("cassete");
    expect(Object.keys(resultado.resolvido.nos_grafico).sort()).toEqual([
      "n-009",
      "n-010",
      "n-011",
      "n-012",
      "n-013",
    ]);
  });

  it("o cassete gravado tem os quatro arquivos obrigatorios e licenca", async () => {
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "grafico", chave);
    expect(cassete.procedencia.licenca.trim().length).toBeGreaterThan(0);
    expect(cassete.cabecalho.componentes.nome).toBe("grafico");
    // Estagio local: zero chamadas HTTP. O cassete e o retrato fiel disso.
    expect(cassete.chamadas.length).toBe(0);
    expect(cassete.cabecalho.quantidadeChamadas).toBe(0);
  });

  it("o cassete gravado contra a fixture canonica cobre os CINCO nos grafico do video real", async () => {
    // O cassete novo foi gravado COM a fixture canonica como entrada
    // (gravar.ts --manifesto): a chave deriva do hash dela, entao o replay
    // offline do pipeline procura exatamente este diretorio. Os cinco nos
    // grafico da fixture (n-009..n-013) tem de resolver para CINCO assets
    // distintos, em 1920x1080 — nunca um PNG estatico compartilhado.
    const canonico = JSON.parse(
      readFileSync(
        join(RAIZ_REPO, "fixtures", "canonico", "manifesto-valido.json"),
        "utf-8",
      ),
    ) as Manifesto;
    const chave = chaveDoEstagio(estagioGrafico, canonico);
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "grafico", chave);

    const nos = Object.keys(cassete.resultado.nos_grafico ?? {}).sort();
    expect(nos).toEqual(["n-009", "n-010", "n-011", "n-012", "n-013"]);

    const hashes = [...new Set(Object.values(cassete.resultado.nos_grafico ?? {}))];
    expect(hashes.length).toBe(5); // um asset por no — nunca o mesmo video
    for (const hash of hashes) {
      const asset = cassete.resultado.assets?.[hash];
      expect(asset, `asset ${hash.slice(0, 12)}…`).toBeDefined();
      expect(asset?.mimeType).toBe("video/webm");
      expect(asset?.largura).toBeGreaterThanOrEqual(1280);
      expect(asset?.altura).toBeGreaterThanOrEqual(720);
    }
  });

  it("os bytes dos assets do cassete canonico estao materializados em corpos/ (1:1)", async () => {
    // O estagio e local: o cassete so carrega metadados. Sem os bytes em
    // corpos/<hash> o replay offline nao tem como servir o video ao store
    // (bytesDoAssetDoCassete em src/pipeline/produzir.ts). Cada byte
    // materializado TEM de rehashear para o hash declarado — bytes que
    // divergem nunca entram (regra de sosia, D4/D5 do ADR-0009).
    const canonico = JSON.parse(
      readFileSync(
        join(RAIZ_REPO, "fixtures", "canonico", "manifesto-valido.json"),
        "utf-8",
      ),
    ) as Manifesto;
    const chave = chaveDoEstagio(estagioGrafico, canonico);
    const dirCassete = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "grafico", chave);
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "grafico", chave);

    const hashes = Object.keys(cassete.resultado.assets ?? {});
    expect(hashes.length).toBe(5);
    for (const hash of hashes) {
      const bytes = readFileSync(join(dirCassete, "corpos", hash));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
    }
  });

  it("nenhum byte do cassete casa padrao de credencial", () => {
    const arquivos = listarRecursivo(dirCassete);
    // Denominador a vista: `--files-without-match` (e uma varredura vazia)
    // saem vazios tanto quando tudo passa quanto quando nada foi olhado.
    expect(arquivos.length).toBeGreaterThan(0);
    for (const arquivo of arquivos) {
      const achados = procurarCredencial(readFileSync(arquivo, "utf-8"));
      expect(achados, `credencial em ${arquivo}`).toEqual([]);
    }
  });
});

// ─── 5b. Q7: a materializacao dos corpos (gravar.ts) e referenciada ────────────

describe("F2-02 — materializacao dos corpos do cassete (gravar.ts, Q7)", () => {
  /** Executor de teste que devolve um hash REAL por job (bytes materializaveis). */
  class ExecutorDeMaterializacao implements ExecutorManim {
    readonly hashes: string[] = [];

    async renderizar(job: JobDeRender): Promise<ResultadoDeRender> {
      const bytes = Buffer.from(`webm falso ${this.hashes.length}`);
      const hash = createHash("sha256").update(bytes).digest("hex");
      this.hashes.push(hash);
      return {
        hash,
        bytes: bytes.length,
        largura: job.larguraPx,
        altura: job.alturaPx,
        framesDeclarados: 30,
        framesInspecionados: 12,
        framesChapados: 0,
        nomeCena: `Cena_Sonda_${this.hashes.length}`,
        correcoes: [],
        ferramenta: `manim ${job.versaoManim}`,
        muxer: job.versaoMuxer,
      };
    }
  }

  it("os webm renderizados entram em corpos/<hash> SO quando rehasheiam (Q7)", async () => {
    // Remover ou quebrar `materializarCorpos` em gravar.ts deixa este
    // teste VERMELHO: a suite referencia a materializacao, e nao apenas o
    // resultado materializado que a cerimonia gravou.
    const tmp = await mkdtemp(join(tmpdir(), "grafico-materializar-"));
    try {
      const raiz = join(tmp, "cassetes");
      const trabalho = join(tmp, "trabalho");
      const videos = join(trabalho, "media", "videos", "1080p15");
      await mkdir(videos, { recursive: true });

      const executor = new ExecutorDeMaterializacao();
      const estagio = criarEstagioGrafico({ executor });
      const { chave } = await gravarCassete(estagio, {
        raiz,
        manifesto: MANIFESTO_DE_GRAVACAO,
        diretorioTrabalho: trabalho,
      });
      // Dois nos (g-001, g-002) -> dois assets -> dois webm no media dir.
      for (let i = 0; i < executor.hashes.length; i++) {
        const bytes = Buffer.from(`webm falso ${i}`);
        await writeFile(join(videos, `Cena_Sonda_${i + 1}.webm`), bytes);
      }

      const gravados = await materializarCorpos(chave, trabalho, raiz);
      expect(gravados).toBe(2);
      for (let i = 0; i < executor.hashes.length; i++) {
        const hash = executor.hashes[i] as string;
        const bytes = await readFile(join(raiz, "grafico", chave, "corpos", hash));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
      }

      // Sonda negativa (regra de sosia, D4/D5 do ADR-0009): bytes que NAO
      // rehasheiam para o hash declarado sao erro — nunca copia.
      await writeFile(join(videos, "Cena_Sonda_1.webm"), Buffer.from("bytes divergentes"));
      await expect(materializarCorpos(chave, trabalho, raiz)).rejects.toThrow(
        /divergentes/,
      );
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

// ─── 6. Descoberta: presenca do MEU item, nunca lista fechada ──────────────────

describe("F2-02 — descoberta por convencao", () => {
  it("encontra `grafico` no disco (assercao de PRESENCA, nao de lista)", async () => {
    const descobertos = await descobrirEstagios("src/resolucao");
    const meu = descobertos.find((e) => e.nome === "grafico");
    expect(meu, "src/resolucao/grafico/estagio.ts deveria ser descoberto").toBeDefined();
    expect(meu?.canonico).toBe(true);
  });

  it("`grafico` tem pelo menos um cassete gravado", () => {
    const dir = join(RAIZ_CASSETES_PADRAO, "grafico");
    const chaves = readdirSync(dir).filter((n) => /^[0-9a-f]{64}$/.test(n));
    expect(chaves.length).toBeGreaterThan(0);
  });
});

// ─── Utilitario ─────────────────────────────────────────────────────────────────

function listarRecursivo(raiz: string): string[] {
  const saida: string[] = [];
  for (const entrada of readdirSync(raiz).sort()) {
    const caminho = join(raiz, entrada);
    if (statSync(caminho).isDirectory()) saida.push(...listarRecursivo(caminho));
    else saida.push(caminho);
  }
  return saida;
}
