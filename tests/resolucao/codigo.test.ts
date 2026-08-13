/**
 * tests/resolucao/codigo.test.ts
 *
 * Oraculo do card F2-05 — destaque de codigo pre-computado.
 *
 * Roda dentro de `tests/resolucao/`, que e o alvo do `res-offline`: ou
 * seja, cada asserção aqui e feita com o guarda de rede em processo
 * instalado (`tests/setup/rede-bloqueada.ts`) e, quando `unshare` existe
 * na maquina, tambem dentro de um namespace de rede fechado do kernel.
 * Um teste que precisasse da rede ficaria vermelho aqui, nao verde por
 * sorte.
 *
 * Este arquivo mora FORA de `src/resolucao/codigo/` de proposito: ele
 * varre aquele diretorio atras de vocabulario de rede, e um varredor que
 * morasse dentro do proprio alvo casaria consigo mesmo e precisaria de
 * uma excecao. Excecao em tripwire e por onde o tripwire morre.
 *
 * PERGUNTA OBRIGATORIA DA W4 — assercao sobre LISTA COMPLETA:
 * nenhuma. Quatro estagios irmaos (F2-02, F2-03, F2-04, F2-06) estao
 * sendo escritos em paralelo e cegos para este; qualquer assercao sobre
 * "os estagios descobertos sao X" seria verdade contra esta base e falsa
 * depois do merge deles. Onde a tentacao existia, a assercao e de
 * PRESENCA do item deste card (`toContain("codigo")`), nunca de
 * igualdade de lista.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { Orquestrador } from "../../src/resolucao/orquestrador.js";
import {
  chaveDeCache,
  chaveDoEstagio,
  componentesDaChave,
  hashDoManifesto,
} from "../../src/resolucao/contrato.js";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  procurarCredencial,
  validarProcedencia,
} from "../../src/resolucao/cassete/formato.js";
import { lerCassete } from "../../src/resolucao/cassete/reprodutor.js";
import { descobrirEstagios, verificarCobertura } from "../../src/resolucao/descoberta.js";
import { encontrarURLs } from "../../src/resolucao/manifesto-resolvido.js";
import { tentativasDeSaida } from "../../src/resolucao/rede/bloqueio.js";

import estagio, { PARAMETROS, computarArtefatos } from "../../src/resolucao/codigo/estagio.js";
import { destacar, normalizarCodigo } from "../../src/resolucao/codigo/destacador.js";
import { gramaticaDe, nomesDeGramatica } from "../../src/resolucao/codigo/gramaticas.js";
import {
  HASH_DO_TEMA_PADRAO,
  TEMA_PADRAO,
  classesSemCor,
  hashDoTema,
} from "../../src/resolucao/codigo/tema.js";
import {
  CLASSES_DE_TOKEN,
  FORMATO_TOKENS_DE_DESTAQUE,
  textoDaLinha,
} from "../../src/resolucao/codigo/tokens-de-destaque.js";
import { lerArtefato } from "../../src/resolucao/codigo/artefatos.js";
import { carregarManifestoDeGravacao } from "../../src/resolucao/codigo/manifesto-de-gravacao.js";
import { palette, contrastRatio } from "../../src/design/tokens.js";
import type { EntradaEstagio } from "../../src/resolucao/contrato.js";
import type { Manifesto, NoCodigo } from "../../src/contratos/manifesto.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(__dirname, "..", "..");
const DIR_ESTAGIO = join(RAIZ, "src", "resolucao", "codigo");

const MANIFESTO = carregarManifestoDeGravacao(RAIZ);
const CHAVE = chaveDoEstagio(estagio, MANIFESTO);
const DIR_CASSETE = resolve(RAIZ, diretorioDoCassete(RAIZ_CASSETES_PADRAO, "codigo", CHAVE));

/** Um `fetch` que explode. Serve para provar que ninguem o chama. */
function redeQueExplode(): typeof fetch {
  return (() => {
    throw new Error("O estagio de destaque tentou sair para a rede.");
  }) as unknown as typeof fetch;
}

function entradaSemRede(manifesto: Manifesto): EntradaEstagio {
  return {
    manifesto,
    parametros: estagio.parametros,
    fetch: redeQueExplode(),
    diretorioTrabalho: "/tmp/nao-usado-por-este-estagio",
  };
}

// ─── 1. Tripwire: nenhum vocabulario de rede no subtree ─────────────────────────

describe("F2-05 ∅ — nada de busca de tipos em CDN em tempo de execucao", () => {
  /**
   * Termos proibidos em `src/resolucao/codigo/**`.
   *
   * A busca e no TEXTO, inclusive comentario (C11: busca vazia so vale
   * como prova se for no texto normalizado, nao na intencao declarada).
   * Por isso o subtree inteiro evita ate MENCIONAR estes termos: a
   * discussao sobre twoslash e sobre a alternativa que fala com um host
   * de terceiro vive no ADR, em `docs/`, onde nao pode virar codigo por
   * acidente de copiar-e-colar.
   */
  const PROIBIDOS = [
    "fetch",
    "http",
    "cdn",
    "unpkg",
    "jsdelivr",
    "esm.sh",
    "twoslash",
    "://",
    "XMLHttpRequest",
    "WebSocket",
    "node:https",
    "node:net",
    "node:dns",
  ];

  function arquivosDoEstagio(): string[] {
    const saida: string[] = [];
    const andar = (dir: string): void => {
      for (const entrada of readdirSync(dir)) {
        const completo = join(dir, entrada);
        if (statSync(completo).isDirectory()) andar(completo);
        else if (completo.endsWith(".ts")) saida.push(completo);
      }
    };
    andar(DIR_ESTAGIO);
    return saida.sort();
  }

  const arquivos = arquivosDoEstagio();

  it("o denominador nao e zero (senao a varredura sai verde por vacuidade)", () => {
    expect(arquivos.length, "nenhum arquivo em src/resolucao/codigo/").toBeGreaterThan(3);
  });

  for (const termo of PROIBIDOS) {
    it(`nenhum arquivo de src/resolucao/codigo/ menciona "${termo}"`, () => {
      const achados: string[] = [];
      for (const arquivo of arquivos) {
        const texto = readFileSync(arquivo, "utf-8").toLowerCase();
        if (texto.includes(termo.toLowerCase())) {
          achados.push(relative(RAIZ, arquivo));
        }
      }
      expect(
        achados,
        `"${termo}" aparece em: ${achados.join(", ")}. O destaque deste card e local; ` +
          `qualquer chamada externa teria de ser gravada no cassete e justificada no ADR.`,
      ).toEqual([]);
    });
  }

  it("SONDA NEGATIVA: o varredor acha o termo quando ele existe de verdade", () => {
    // Sem isto, um varredor quebrado (regex errada, lista vazia, arquivo
    // que nao foi lido) passaria em todos os casos acima.
    const isca = `este texto contem ${"ht" + "tp"} de proposito`;
    expect(isca.toLowerCase().includes("http")).toBe(true);
  });

  it("o cassete versionado nao tem NENHUMA chamada de rede gravada", async () => {
    const cassete = await lerCassete(resolve(RAIZ, RAIZ_CASSETES_PADRAO), "codigo", CHAVE);
    expect(cassete.cabecalho.quantidadeChamadas).toBe(0);
    expect(cassete.chamadas).toEqual([]);
  });
});

// ─── 2. Pergunta adversarial 1: rede com cache quente e com cache frio ──────────

describe("F2-05 adversarial 1 — o estagio chama a rede?", () => {
  it("cache QUENTE, rede bloqueada: o orquestrador resolve pelo cassete", async () => {
    const antes = tentativasDeSaida().length;
    const orquestrador = new Orquestrador({
      estagios: [estagio],
      raizCassetes: resolve(RAIZ, RAIZ_CASSETES_PADRAO),
      modo: "offline",
    });
    const { resolvido } = await orquestrador.resolverEstagio("codigo", MANIFESTO);

    const registro = resolvido.estagios.find((e) => e.estagio === "codigo");
    expect(registro?.origem).toBe("cassete");
    expect(registro?.chave).toBe(CHAVE);
    // O guarda de rede registra QUALQUER tentativa de saida. Zero novas.
    expect(tentativasDeSaida().length - antes).toBe(0);
  });

  it("cache FRIO, com um fetch que explode: resolver() entrega assim mesmo", async () => {
    // Esta e a metade que o teste offline sozinho nao prova. Offline o
    // orquestrador nem chama resolver(); aqui chamamos direto, com a
    // unica porta de saida do contrato armada para lancar. Se o estagio
    // dependesse de rede em qualquer caminho, este teste seria vermelho.
    const saida = await estagio.resolver(entradaSemRede(MANIFESTO));
    expect(Object.keys(saida.parcial.nos_codigo ?? {})).toContain("n-008");
    expect(Object.keys(saida.parcial.assets).length).toBeGreaterThan(0);
  });

  it("cache frio e cache quente produzem o MESMO hash de artefato", async () => {
    const frio = await estagio.resolver(entradaSemRede(MANIFESTO));
    const cassete = await lerCassete(resolve(RAIZ, RAIZ_CASSETES_PADRAO), "codigo", CHAVE);
    expect(frio.parcial.nos_codigo).toEqual(cassete.resultado.nos_codigo);
  });
});

// ─── 3. Pergunta adversarial 2: a chave cobre versao, gramatica e tema ──────────

describe("F2-05 adversarial 2 — a chave de cache cobre o que muda o pixel", () => {
  const base = componentesDaChave(estagio, hashDoManifesto(MANIFESTO));
  const chaveBase = chaveDeCache(base);

  it("a versao do ESTAGIO esta na chave", () => {
    const outra = chaveDeCache({ ...base, versaoEstagio: "9.9.9" });
    expect(outra).not.toBe(chaveBase);
  });

  it("a versao do DESTACADOR esta na chave", () => {
    expect(Object.keys(estagio.parametros)).toContain("versaoDoDestacador");
    const outra = chaveDeCache({
      ...base,
      parametros: { ...base.parametros, versaoDoDestacador: "9.9.9" },
    });
    expect(outra).not.toBe(chaveBase);
  });

  it("a versao das GRAMATICAS esta na chave", () => {
    expect(Object.keys(estagio.parametros)).toContain("versaoDasGramaticas");
    const outra = chaveDeCache({
      ...base,
      parametros: { ...base.parametros, versaoDasGramaticas: "9.9.9" },
    });
    expect(outra).not.toBe(chaveBase);
  });

  it("mudar UMA COR do tema muda o hash do tema — sem ninguem bumpar versao", () => {
    // Este e o ponto: `versaoDoTema` depende de alguem lembrar; o hash
    // deriva do valor real das cores e acompanha sozinho. Um humano que
    // troque um token em src/design/tokens.ts invalida o cassete mesmo
    // sem tocar em nenhuma versao.
    const alterado = {
      ...TEMA_PADRAO,
      cores: { ...TEMA_PADRAO.cores, "palavra-chave": palette.green[300] },
    };
    expect(hashDoTema(alterado)).not.toBe(HASH_DO_TEMA_PADRAO);

    const outra = chaveDeCache({
      ...base,
      parametros: { ...base.parametros, hashDoTema: hashDoTema(alterado) },
    });
    expect(outra).not.toBe(chaveBase);
  });

  it("mudar a cor do tema muda tambem o hash do ARTEFATO (o pixel mudou de verdade)", () => {
    const artefatos = computarArtefatos(MANIFESTO);
    const original = artefatos[0];
    expect(original).toBeDefined();

    const no = MANIFESTO.nos.find((n) => n.type === "codigo") as NoCodigo;
    const comOutroTema = destacar(no.codigo, no.linguagem, {
      tema: {
        ...TEMA_PADRAO,
        cores: { ...TEMA_PADRAO.cores, "palavra-chave": palette.green[300] },
      },
      larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
      linhasDestacadas: no.linhas_destaque ?? [],
    });
    const coresOriginais = original!.tokens.linhas.flatMap((l) => l.tokens.map((t) => t.cor));
    const coresNovas = comOutroTema.linhas.flatMap((l) => l.tokens.map((t) => t.cor));
    expect(coresNovas).not.toEqual(coresOriginais);
  });

  it("a largura da tabulacao esta na chave e muda o texto normalizado", () => {
    expect(Object.keys(estagio.parametros)).toContain("larguraDaTabulacao");
    expect(normalizarCodigo("\tx", 2)).not.toBe(normalizarCodigo("\tx", 4));
  });
});

// ─── 4. Pergunta adversarial 3: credencial no cassete ───────────────────────────

describe("F2-05 adversarial 3 — o cassete contem credencial?", () => {
  function arquivosDoCassete(): string[] {
    const saida: string[] = [];
    const andar = (dir: string): void => {
      for (const entrada of readdirSync(dir)) {
        const completo = join(dir, entrada);
        if (statSync(completo).isDirectory()) andar(completo);
        else saida.push(completo);
      }
    };
    andar(DIR_CASSETE);
    return saida.sort();
  }

  const arquivos = arquivosDoCassete();

  it("o denominador nao e zero", () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it("nenhum byte de nenhum arquivo do cassete casa padrao de credencial", () => {
    const achados: string[] = [];
    for (const arquivo of arquivos) {
      const encontrados = procurarCredencial(readFileSync(arquivo, "utf-8"));
      if (encontrados.length > 0) {
        achados.push(`${relative(RAIZ, arquivo)}: ${encontrados.join(", ")}`);
      }
    }
    expect(achados).toEqual([]);
  });

  it("SONDA NEGATIVA: o varredor de credencial acha uma chave plantada", () => {
    const plantada = `{"api_key": "${"A".repeat(24)}"}`;
    expect(procurarCredencial(plantada).length).toBeGreaterThan(0);
  });

  it("o estagio nao tem por onde receber credencial: zero parametro secreto", () => {
    for (const [nome, valor] of Object.entries(estagio.parametros)) {
      expect(procurarCredencial(`${nome}=${String(valor)}`)).toEqual([]);
    }
  });
});

// ─── 5. Pergunta adversarial 4: sosia, nao sucessor ─────────────────────────────

describe("F2-05 adversarial 4 — o estagio 'conserta' algo da resposta externa?", () => {
  it("nao ha resposta externa: chamadas.json vazio e sem diretorio de corpos", () => {
    const chamadas = JSON.parse(
      readFileSync(join(DIR_CASSETE, ARQUIVO_CHAMADAS), "utf-8"),
    ) as unknown[];
    expect(chamadas).toEqual([]);
    const cabecalho = JSON.parse(
      readFileSync(join(DIR_CASSETE, ARQUIVO_CABECALHO), "utf-8"),
    ) as { quantidadeChamadas: number };
    expect(cabecalho.quantidadeChamadas).toBe(0);
    expect(readdirSync(DIR_CASSETE)).not.toContain("corpos");
  });

  it("a normalizacao que o estagio faz roda no REPLAY, nao so na gravacao", () => {
    // O conserto que este estagio faz e sobre a ENTRADA (CRLF, BOM, tab),
    // nao sobre uma resposta de terceiro — e ele e parte de resolver(),
    // que e o mesmo codigo dos dois lados. Um conserto feito na hora de
    // gravar esconderia o defeito; aqui nao existe "hora de gravar"
    // separada.
    expect(normalizarCodigo("a\r\nb", 4)).toBe("a\nb");
    expect(normalizarCodigo("﻿a", 4)).toBe("a");
    expect(normalizarCodigo("\tx", 4)).toBe("    x");
  });
});

// ─── 6. O tema sai de src/design/tokens.ts ──────────────────────────────────────

describe("F2-05 — Regra 2: toda cor do destaque vem de src/design/tokens.ts", () => {
  function todasAsCoresDoDesignSystem(): Set<string> {
    const cores = new Set<string>();
    for (const escala of Object.values(palette)) {
      if (typeof escala === "string") cores.add(escala);
      else for (const cor of Object.values(escala)) cores.add(cor);
    }
    return cores;
  }

  const doDesign = todasAsCoresDoDesignSystem();

  it("o tema cobre TODAS as classes de token declaradas", () => {
    expect(classesSemCor(TEMA_PADRAO)).toEqual([]);
    expect(Object.keys(TEMA_PADRAO.cores).sort()).toEqual([...CLASSES_DE_TOKEN].sort());
  });

  it("cada cor do tema e um valor que existe em src/design/tokens.ts", () => {
    const forasteiras: string[] = [];
    const usadas = [
      TEMA_PADRAO.corDeFundo,
      TEMA_PADRAO.corDeFundoDaLinhaDestacada,
      TEMA_PADRAO.corDeTextoPadrao,
      ...Object.values(TEMA_PADRAO.cores),
    ];
    for (const cor of usadas) if (!doDesign.has(cor)) forasteiras.push(cor);
    expect(usadas.length).toBeGreaterThan(0);
    expect(forasteiras).toEqual([]);
  });

  it("cada cor de classe passa AA (4.5:1) contra os DOIS fundos possiveis", () => {
    // O fundo da linha destacada e mais claro que o do bloco. Testar so
    // contra o fundo escuro deixaria ilegivel exatamente a linha para a
    // qual o video quer chamar atencao.
    const reprovadas: string[] = [];
    for (const classe of CLASSES_DE_TOKEN) {
      const cor = TEMA_PADRAO.cores[classe];
      const noBloco = contrastRatio(cor, TEMA_PADRAO.corDeFundo);
      const naLinha = contrastRatio(cor, TEMA_PADRAO.corDeFundoDaLinhaDestacada);
      if (noBloco < 4.5 || naLinha < 4.5) {
        reprovadas.push(`${classe} ${cor}: ${noBloco.toFixed(2)} / ${naLinha.toFixed(2)}`);
      }
    }
    expect(reprovadas).toEqual([]);
  });

  it("as classes que carregam significado a olho tem cores distintas entre si", () => {
    const cromaticas = [
      "palavra-chave",
      "tipo",
      "funcao",
      "cadeia",
      "numero",
      "comentario",
    ] as const;
    const cores = cromaticas.map((c) => TEMA_PADRAO.cores[c]);
    expect(new Set(cores).size).toBe(cromaticas.length);
  });
});

// ─── 7. O destacador nao perde nem inventa caractere ────────────────────────────

describe("F2-05 — o invariante do destacador", () => {
  const casos: Array<[string, string]> = [
    ["typescript", "const x = 1; // comentario\nfunction f() { return `a${x}b`; }"],
    ["python", '@dec\ndef f(a, b=2):\n    """doc"""\n    return a + b  # soma'],
    ["json", '{"a": 1, "b": [true, null], "c": "texto"}'],
    ["rust", "fn main() { println!(\"oi\"); }"],
    ["typescript", ""],
    ["typescript", "\n\n\n"],
    ["typescript", "linha unica sem quebra"],
    ["typescript", "/* bloco\n   em duas linhas */\nx"],
    ["typescript", "\tcom tab\n\t\tcom dois tabs"],
    ["typescript", "acentuacao: ção, ñ, 日本語, 🎬"],
  ];

  for (const [linguagem, codigo] of casos) {
    it(`concatenar os tokens reproduz o texto normalizado: ${linguagem} ${JSON.stringify(codigo.slice(0, 24))}`, () => {
      const r = destacar(codigo, linguagem, {
        tema: TEMA_PADRAO,
        larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
        linhasDestacadas: [],
      });
      expect(r.linhas.map(textoDaLinha).join("\n")).toBe(r.codigoNormalizado);
    });
  }

  it("destacar duas vezes da exatamente o mesmo resultado", () => {
    const opcoes = {
      tema: TEMA_PADRAO,
      larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
      linhasDestacadas: [1, 3],
    };
    const codigo = casos[0]![1];
    expect(destacar(codigo, "typescript", opcoes)).toEqual(
      destacar(codigo, "typescript", opcoes),
    );
  });

  it("toda classe emitida esta no vocabulario fechado", () => {
    const permitidas = new Set<string>(CLASSES_DE_TOKEN);
    for (const [linguagem, codigo] of casos) {
      const r = destacar(codigo, linguagem, {
        tema: TEMA_PADRAO,
        larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
        linhasDestacadas: [],
      });
      for (const linha of r.linhas) {
        for (const token of linha.tokens) {
          expect(permitidas.has(token.classe), `classe fora do vocabulario: ${token.classe}`).toBe(
            true,
          );
          expect(token.texto).not.toBe("");
          expect(token.texto).not.toContain("\n");
        }
      }
    }
  });

  it("linguagem sem gramatica local NAO falha em silencio: o motivo vai no artefato", () => {
    const r = destacar("fn main() {}", "rust", {
      tema: TEMA_PADRAO,
      larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
      linhasDestacadas: [],
    });
    expect(r.gramaticaExata).toBe(false);
    expect(r.gramatica).toContain("rust");
    expect(r.gramatica).toContain("queda");
  });

  it("linha_destaque fora do intervalo nao vira linha fantasma nem excecao", () => {
    const r = destacar("a\nb", "typescript", {
      tema: TEMA_PADRAO,
      larguraDaTabulacao: PARAMETROS.larguraDaTabulacao,
      linhasDestacadas: [0, 2, 99, -1],
    });
    expect(r.linhas.length).toBe(2);
    expect(r.linhas.map((l) => l.destacada)).toEqual([false, true]);
  });

  it("a gramatica deste card esta disponivel (presenca, nao lista fechada)", () => {
    expect(nomesDeGramatica()).toContain("typescript");
    expect(gramaticaDe("TSX").gramatica.nome).toBe("typescript");
    expect(gramaticaDe("ts").exata).toBe(true);
  });
});

// ─── 8. O artefato publicado e o que F1-08 vai consumir ─────────────────────────

describe("F2-05 — o artefato publicado", () => {
  it("o formato declarado e o que o leitor confere", async () => {
    const cassete = await lerCassete(resolve(RAIZ, RAIZ_CASSETES_PADRAO), "codigo", CHAVE);
    const hash = (cassete.resultado.nos_codigo ?? {})["n-008"];
    expect(hash).toBeDefined();
    const tokens = await lerArtefato(DIR_CASSETE, hash as string);
    expect(tokens.formato).toBe(FORMATO_TOKENS_DE_DESTAQUE);
    expect(tokens.no).toBe("n-008");
    expect(tokens.linguagem).toBe("typescript");
    expect(tokens.hashDoTema).toBe(HASH_DO_TEMA_PADRAO);
    expect(tokens.linhas.length).toBeGreaterThan(0);
  });

  it("o artefato reproduz o codigo do manifesto, linha a linha", async () => {
    const no = MANIFESTO.nos.find((n) => n.id === "n-008") as NoCodigo;
    const cassete = await lerCassete(resolve(RAIZ, RAIZ_CASSETES_PADRAO), "codigo", CHAVE);
    const hash = (cassete.resultado.nos_codigo ?? {})["n-008"] as string;
    const tokens = await lerArtefato(DIR_CASSETE, hash);
    const reconstruido = tokens.linhas.map(textoDaLinha).join("\n");
    expect(reconstruido).toBe(
      normalizarCodigo(no.codigo, PARAMETROS.larguraDaTabulacao),
    );
  });

  it("as linhas destacadas do manifesto chegam marcadas no artefato", async () => {
    const no = MANIFESTO.nos.find((n) => n.id === "n-008") as NoCodigo;
    const cassete = await lerCassete(resolve(RAIZ, RAIZ_CASSETES_PADRAO), "codigo", CHAVE);
    const hash = (cassete.resultado.nos_codigo ?? {})["n-008"] as string;
    const tokens = await lerArtefato(DIR_CASSETE, hash);
    const marcadas = tokens.linhas.filter((l) => l.destacada).map((l) => l.numero);
    expect(marcadas).toEqual(no.linhas_destaque ?? []);
  });

  it("ler um artefato com hash trocado FALHA — endereco de conteudo e conferido", async () => {
    const cassete = await lerCassete(resolve(RAIZ, RAIZ_CASSETES_PADRAO), "codigo", CHAVE);
    const hash = (cassete.resultado.nos_codigo ?? {})["n-008"] as string;
    const mentiroso = `${hash.slice(0, 63)}${hash.endsWith("0") ? "1" : "0"}`;
    await expect(lerArtefato(DIR_CASSETE, mentiroso)).rejects.toThrow(/ausente|hasheia/);
  });
});

// ─── 9. Contrato de estagio e cobertura ─────────────────────────────────────────

describe("F2-05 — o contrato de estagio, cumprido", () => {
  it("identidade canonica e versao semver", () => {
    expect(estagio.identidade.nome).toBe("codigo");
    expect(estagio.identidade.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("todo parametro e escalar (a chave e o JSON canonico disto)", () => {
    for (const valor of Object.values(estagio.parametros)) {
      expect(["string", "number", "boolean"]).toContain(typeof valor);
    }
  });

  it("a procedencia declara licenca nao-vazia no topo e em cada asset", async () => {
    const cassete = await lerCassete(resolve(RAIZ, RAIZ_CASSETES_PADRAO), "codigo", CHAVE);
    expect(validarProcedencia(cassete.procedencia, DIR_CASSETE)).toEqual([]);
    expect(cassete.procedencia.assets.length).toBeGreaterThan(0);
    for (const asset of cassete.procedencia.assets) {
      expect(asset.licenca.trim()).not.toBe("");
    }
  });

  it("C7: nenhuma URL na parcial, em nenhuma profundidade", async () => {
    const saida = await estagio.resolver(entradaSemRede(MANIFESTO));
    expect(encontrarURLs(saida.parcial)).toEqual([]);
  });

  it("a descoberta em disco ENCONTRA este estagio (presenca, nao lista fechada)", async () => {
    const achados = await descobrirEstagios(join(RAIZ, "src", "resolucao"));
    expect(achados.map((e) => e.nome)).toContain("codigo");
    expect(achados.find((e) => e.nome === "codigo")?.canonico).toBe(true);
  });

  it("a cobertura de cassete deste estagio esta OK", async () => {
    const relatorio = await verificarCobertura({
      raizEstagios: join(RAIZ, "src", "resolucao"),
      raizCassetes: join(RAIZ, RAIZ_CASSETES_PADRAO),
      apenasEstagio: "codigo",
    });
    expect(relatorio.descobertos.map((e) => e.nome)).toContain("codigo");
    expect(relatorio.ok, JSON.stringify(relatorio.cobertura, null, 2)).toBe(true);
  });
});
