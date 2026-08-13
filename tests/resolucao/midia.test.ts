/**
 * tests/resolucao/midia.test.ts
 *
 * Estagio de midia externa — card F2-04.
 *
 * Roda dentro de `just res-offline`, ou seja: com o namespace de rede do
 * kernel por fora e o guarda em processo por dentro. Nenhuma assercao
 * aqui depende de rede; varias dependem de ela estar FECHADA.
 *
 * As quatro perguntas adversariais do card viraram teste, uma a uma:
 *
 *   1. o estagio chama a rede quando o cache acerta?
 *      → "cache quente com a rede fechada" (e o denominador de tentativas)
 *   2. a chave inclui a versao do estagio?
 *      → "a chave de cache"
 *   3. o cassete contem credencial?
 *      → "credencial no cassete", com sonda negativa do detector
 *   4. o estagio conserta algo da resposta externa?
 *      → "sosia, nao sucessor": o corpo bruto guarda o defeito, o estagio
 *        e que o conserta, e o conserto roda no replay
 *
 * SOBRE A PERGUNTA OBRIGATORIA DA ONDA: nao ha nenhuma assercao aqui
 * sobre a LISTA COMPLETA de nada. A cobertura e testada pela PRESENCA de
 * "midia" entre os estagios descobertos, nunca por `length === 1`; a
 * decisao de hotlink e testada como invariante universal ("todo provedor
 * que exige hotlink nao tem adaptador"), que continua verdadeira quando
 * um irmao acrescentar o proprio provedor a tabela dele.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

import estagio, {
  EMidiaNaoResolvivel,
  nosDeMidia,
  termoDeBuscaDoNo,
} from "src/resolucao/midia/estagio.js";
import {
  ADAPTADORES,
  adaptadorDe,
  selecionarAdaptador,
  violacoesDaDecisaoDeHotlink,
} from "src/resolucao/midia/adaptadores.js";
import {
  EProvedorDesconhecido,
  EProvedorExigeHotlink,
  POLITICAS_DE_PROVEDOR,
  ehElegivel,
  politicaDe,
} from "src/resolucao/midia/politicas.js";
import {
  booleanoDoProvedor,
  licencaCanonica,
  textoPuro,
  urlDeBusca,
} from "src/resolucao/midia/commons.js";
import { lerManifestoDeGravacao } from "src/resolucao/midia/gravar.js";

import {
  HEADERS_SENSIVEIS,
  VALOR_REDIGIDO,
  diretorioDoCassete,
  paraProcedenciaDoStore,
  procurarCredencial,
  serializarCanonico,
} from "src/resolucao/cassete/formato.js";
import { criarFetchDeCassete, lerCassete } from "src/resolucao/cassete/reprodutor.js";
import { chaveDoEstagio, componentesDaChave, hashDoManifesto } from "src/resolucao/contrato.js";
import type { EstagioResolucao } from "src/resolucao/contrato.js";
import { Orquestrador } from "src/resolucao/orquestrador.js";
import { descobrirEstagios, verificarCobertura } from "src/resolucao/descoberta.js";
import { encontrarURLs } from "src/resolucao/manifesto-resolvido.js";
import { redeBloqueada, tentativasDeSaida } from "src/resolucao/rede/bloqueio.js";
import type { Manifesto } from "src/contratos/manifesto.js";
import type { Cassete } from "src/resolucao/cassete/formato.js";

const RAIZ_CASSETES = "fixtures/cassetes";
const NOME = "midia";

let manifesto: Manifesto;
let chave: string;
let diretorio: string;
let cassete: Cassete;

beforeAll(async () => {
  manifesto = await lerManifestoDeGravacao();
  chave = chaveDoEstagio(estagio, manifesto);
  diretorio = diretorioDoCassete(RAIZ_CASSETES, NOME, chave);
  cassete = await lerCassete(RAIZ_CASSETES, NOME, chave);
});

/** Diretorio de trabalho descartavel, um por execucao de estagio. */
async function trabalho(): Promise<string> {
  return mkdtemp(join(tmpdir(), "teste-midia-"));
}

/** `fetch` que reprova se for chamado. Denominador de "nao chamou a rede". */
function fetchQueReprova(registro: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    registro.push(String(input));
    throw new Error("o estagio nao deveria ter chamado a rede aqui");
  }) as typeof fetch;
}

// ─── Descoberta e ∅-crit ────────────────────────────────────────────────────────

describe("descoberta e cobertura de cassete", () => {
  it("o estagio 'midia' esta no disco, onde a convencao manda", async () => {
    const descobertos = await descobrirEstagios("src/resolucao");
    const meu = descobertos.find((e) => e.nome === NOME);
    // Assercao sobre a PRESENCA do meu item. Nunca sobre a lista completa:
    // quatro irmaos desta onda entregam estagio no mesmo diretorio, e um
    // `length === N` ficaria falso no merge deles sem ninguem tocar aqui.
    expect(meu, "src/resolucao/midia/estagio.ts nao foi descoberto").toBeDefined();
    expect(meu?.canonico).toBe(true);
    expect(meu?.arquivo).toBe("src/resolucao/midia/estagio.ts");
  });

  it("∅-crit: o estagio de midia tem cassete, e o cassete esta completo", async () => {
    const relatorio = await verificarCobertura({
      raizEstagios: "src/resolucao",
      raizCassetes: RAIZ_CASSETES,
      apenasEstagio: NOME,
    });
    // Denominador explicito: filtro que nao casa nada nao pode sair verde (C2).
    expect(relatorio.descobertos.map((e) => e.nome)).toContain(NOME);
    const meu = relatorio.cobertura.find((c) => c.nome === NOME);
    expect(meu?.problemas ?? ["cobertura ausente"]).toEqual([]);
    expect((meu?.chaves ?? []).length).toBeGreaterThan(0);
  });

  it("a chave gravada em disco e a chave que o estagio calcula hoje", () => {
    // Se alguem mudar parametros ou versao sem regravar, isto fica vermelho
    // antes de o cassete velho ser servido como se fosse novo (C12).
    expect(cassete.cabecalho.chave).toBe(chave);
    expect(cassete.cabecalho.componentes.nome).toBe(NOME);
  });
});

// ─── A decisao de hotlink ───────────────────────────────────────────────────────

describe("decisao de hotlink (ADR-0008)", () => {
  it("todo provedor que EXIGE hotlink nao tem adaptador — a barreira e a ausencia de codigo", () => {
    // Invariante UNIVERSAL, nao assercao sobre lista fechada: continua
    // verdadeira quando a tabela ganhar entradas.
    expect(violacoesDaDecisaoDeHotlink()).toEqual([]);
    for (const politica of POLITICAS_DE_PROVEDOR) {
      if (politica.politicaHotlink === "exige") {
        expect(
          adaptadorDe(politica.provedor),
          `${politica.provedor} exige hotlink e nao pode ter adaptador`,
        ).toBeUndefined();
      }
    }
  });

  it("todo adaptador implementado atende um provedor elegivel e declarado", () => {
    for (const adaptador of ADAPTADORES) {
      const politica = politicaDe(adaptador.provedor);
      expect(politica, `${adaptador.provedor} sem politica declarada`).toBeDefined();
      expect(ehElegivel(politica!)).toBe(true);
    }
  });

  it("toda politica declarada traz citacao literal, documento e data", () => {
    for (const politica of POLITICAS_DE_PROVEDOR) {
      expect(politica.citacao.trim().length, politica.provedor).toBeGreaterThan(20);
      expect(politica.documento.trim(), politica.provedor).not.toBe("");
      expect(politica.consultadoEm, politica.provedor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("o par de oposicao esta declarado com as duas leituras opostas", () => {
    // A evidencia que sustenta o ADR, presa no codigo: um provedor exige,
    // outro proibe, e os dois estao citados.
    expect(politicaDe("unsplash")?.politicaHotlink).toBe("exige");
    expect(politicaDe("unsplash")?.citacao).toContain("hotlinking");
    expect(politicaDe("pixabay")?.politicaHotlink).toBe("proibe");
    expect(politicaDe("pixabay")?.citacao).toContain("is not allowed");
    // E a obrigacao do Unsplash vem do contrato de API, nao da licenca —
    // por isso o enquadramento de uso pessoal (ADR-0003) nao isenta.
    expect(politicaDe("unsplash")?.fonteDaObrigacao).toBe("contrato-de-api");
  });

  it("provedor que exige hotlink e recusado ANTES de qualquer chamada de rede", async () => {
    const tentadas: string[] = [];
    const estagioHotlink: EstagioResolucao = {
      ...estagio,
      parametros: { ...estagio.parametros, provedor: "unsplash" },
    };
    await expect(
      estagioHotlink.resolver({
        manifesto,
        parametros: estagioHotlink.parametros,
        fetch: fetchQueReprova(tentadas),
        diretorioTrabalho: await trabalho(),
      }),
    ).rejects.toThrow(EProvedorExigeHotlink);
    // O denominador: zero URLs tentadas. A decisao precede o downloader.
    expect(tentadas).toEqual([]);
  });

  it("provedor sem politica declarada e recusado — silencio nao vira permissao", () => {
    expect(() => selecionarAdaptador("provedor-que-ninguem-leu")).toThrow(
      EProvedorDesconhecido,
    );
  });
});

// ─── Pergunta 1: cache quente nao chama a rede ──────────────────────────────────

describe("cache quente com a rede fechada", () => {
  it("o guarda de rede esta instalado neste processo", async () => {
    expect(redeBloqueada()).toBe(true);
    await expect(globalThis.fetch("http://127.0.0.1:9/")).rejects.toThrow(
      /REDE BLOQUEADA/,
    );
  });

  it("o orquestrador offline resolve pelo cassete sem chamar resolver() nem a rede", async () => {
    let resolverFoiChamado = false;
    const espiao: EstagioResolucao = {
      identidade: estagio.identidade,
      parametros: estagio.parametros,
      async resolver() {
        resolverFoiChamado = true;
        throw new Error("resolver() foi chamado com o cache quente");
      },
    };

    const antes = tentativasDeSaida().length;
    const orquestrador = new Orquestrador({
      estagios: [espiao],
      raizCassetes: RAIZ_CASSETES,
      modo: "offline",
    });
    const { resolvido } = await orquestrador.resolverEstagio(NOME, manifesto);
    const depois = tentativasDeSaida().length;

    expect(resolverFoiChamado).toBe(false);
    // Denominador: o guarda registra TODA tentativa de saida. Zero novas
    // tentativas e diferente de "o teste nao olhou".
    expect(depois - antes).toBe(0);
    expect(resolvido.estagios[0]?.origem).toBe("cassete");
    expect(resolvido.estagios[0]?.chave).toBe(chave);
    expect(Object.keys(resolvido.nos_midia).sort()).toEqual([
      "n-midia-01",
      "n-midia-02",
    ]);
  });
});

// ─── Pergunta 2: a chave de cache ───────────────────────────────────────────────

describe("a chave de cache", () => {
  it("inclui a versao do estagio: bumpar a versao e cache miss", () => {
    const outraVersao: EstagioResolucao = {
      ...estagio,
      identidade: { nome: "midia", versao: "9.9.9" },
    };
    expect(chaveDoEstagio(outraVersao, manifesto)).not.toBe(chave);
    expect(componentesDaChave(estagio, hashDoManifesto(manifesto)).versaoEstagio).toBe(
      estagio.identidade.versao,
    );
  });

  it("inclui a decisao de hotlink: mudar o modo de aquisicao e cache miss", () => {
    const hipotetico: EstagioResolucao = {
      ...estagio,
      parametros: { ...estagio.parametros, modoDeAquisicao: "hotlink" },
    };
    expect(chaveDoEstagio(hipotetico, manifesto)).not.toBe(chave);
  });

  it("inclui o provedor, a largura alvo e as licencas aceitas", () => {
    for (const [nome, valor] of [
      ["provedor", "pexels"],
      ["larguraAlvo", 640],
      ["licencasAceitas", "CC0-1.0"],
      ["versaoApiProvedor", "outra"],
      ["limiteCandidatos", 99],
    ] as const) {
      const mutado: EstagioResolucao = {
        ...estagio,
        parametros: { ...estagio.parametros, [nome]: valor },
      };
      expect(chaveDoEstagio(mutado, manifesto), `parametro ${nome}`).not.toBe(chave);
    }
  });

  it("sem mudanca, a chave repete — senao as mutacoes acima passariam por acaso", () => {
    expect(chaveDoEstagio(estagio, manifesto)).toBe(chave);
  });
});

// ─── Pergunta 3: credencial no cassete ──────────────────────────────────────────

describe("credencial no cassete", () => {
  it("nenhum byte do cassete casa um padrao de credencial", async () => {
    const arquivos = await listarArquivos(diretorio);
    expect(arquivos.length, "cassete vazio nao prova nada").toBeGreaterThan(4);
    for (const arquivo of arquivos) {
      const texto = await readFile(arquivo, "utf-8").catch(async () =>
        (await readFile(arquivo)).toString("utf-8"),
      );
      expect(procurarCredencial(texto), arquivo).toEqual([]);
    }
  });

  it("o detector de credencial nao esta cego (sonda negativa)", () => {
    expect(procurarCredencial('{"api_key":"abcdefghij0123456789"}').length).toBeGreaterThan(0);
    expect(procurarCredencial("Authorization: Bearer abcdefghij0123456789xyz").length)
      .toBeGreaterThan(0);
  });

  it("nenhuma chamada gravada carrega header sensivel nem chave em query string", () => {
    expect(cassete.chamadas.length).toBeGreaterThan(0);
    for (const chamada of cassete.chamadas) {
      for (const header of Object.keys(chamada.headersRequisicao)) {
        expect(HEADERS_SENSIVEIS, `header ${header}`).not.toContain(header.toLowerCase());
      }
      expect(chamada.url).not.toMatch(/[?&](api[_-]?key|key|token|secret|sig)=/i);
      expect(chamada.url).not.toContain(VALOR_REDIGIDO);
    }
  });

  it("o provedor escolhido nao usa credencial nenhuma — nao ha o que vazar", () => {
    expect(politicaDe("wikimedia-commons")?.exigeCredencial).toBe(false);
  });
});

// ─── Pergunta 4: sosia, nao sucessor ────────────────────────────────────────────

describe("sosia, nao sucessor: o conserto e do estagio e roda no replay", () => {
  it("o corpo gravado guarda o defeito: string 'true', HTML e candidato sem licenca", async () => {
    const busca = cassete.chamadas.find((c) => c.url.includes("api.php"));
    expect(busca, "nenhuma chamada de busca gravada").toBeDefined();
    const bruto = await readFile(
      join(diretorio, "corpos", busca!.hashCorpo),
      "utf-8",
    );
    // (a) booleano que veio como string
    expect(bruto).toContain('"AttributionRequired":{"value":"true"');
    // (b) atribuicao que veio como HTML, com href relativo a protocolo.
    // No corpo cru o JSON escapa a aspa: `href=\"//commons...`.
    expect(bruto).toContain('href=\\"//commons.wikimedia.org');
    // (d) candidato SEM o campo License, que o estagio descarta no replay
    const corpo = JSON.parse(bruto) as {
      query: { pages: Array<{ imageinfo: Array<{ extmetadata: Record<string, unknown> }> }> };
    };
    const semLicenca = corpo.query.pages.filter(
      (p) => p.imageinfo[0]?.extmetadata["License"] === undefined,
    );
    expect(
      semLicenca.length,
      "o cassete devia conter candidatos que o estagio recusa",
    ).toBeGreaterThan(0);
  });

  it("replay: o estagio reproduz byte a byte o resultado gravado, sem rede", async () => {
    const saida = await estagio.resolver({
      manifesto,
      parametros: estagio.parametros,
      fetch: criarFetchDeCassete(cassete, diretorio),
      diretorioTrabalho: await trabalho(),
    });
    expect(serializarCanonico(saida.parcial)).toBe(serializarCanonico(cassete.resultado));
  });

  it("replay: rodar duas vezes da os mesmos bytes (determinismo do estagio)", async () => {
    const uma = await estagio.resolver({
      manifesto,
      parametros: estagio.parametros,
      fetch: criarFetchDeCassete(cassete, diretorio),
      diretorioTrabalho: await trabalho(),
    });
    const outra = await estagio.resolver({
      manifesto,
      parametros: estagio.parametros,
      fetch: criarFetchDeCassete(cassete, diretorio),
      diretorioTrabalho: await trabalho(),
    });
    expect(serializarCanonico(uma.parcial)).toBe(serializarCanonico(outra.parcial));
    expect(serializarCanonico(uma.procedencia)).toBe(serializarCanonico(outra.procedencia));
  });

  it("o conserto aparece no resultado: booleano, licenca canonica, texto puro", () => {
    const porLicenca = Object.values(cassete.resultado.assets);
    const comAtribuicao = porLicenca.find((a) => a.atribuicaoObrigatoria === true);
    const semAtribuicao = porLicenca.find((a) => a.atribuicaoObrigatoria === false);
    // Os dois ramos exercitados: a string "true" e a string "false".
    expect(comAtribuicao, "nenhum asset com atribuicao obrigatoria").toBeDefined();
    expect(semAtribuicao, "nenhum asset sem atribuicao obrigatoria").toBeDefined();
    expect(comAtribuicao?.licenca).toBe("CC-BY-SA-4.0");
    expect(comAtribuicao?.atribuicao).toContain("via Wikimedia Commons");
    expect(comAtribuicao?.atribuicao).not.toContain("<a ");
    expect(semAtribuicao?.licenca).toBe("PDM-1.0");
  });

  it("as funcoes de conserto, isoladas", () => {
    expect(booleanoDoProvedor("true")).toBe(true);
    expect(booleanoDoProvedor("false")).toBe(false);
    expect(booleanoDoProvedor(undefined)).toBeUndefined();
    expect(licencaCanonica("cc-by-sa-4.0")).toBe("CC-BY-SA-4.0");
    expect(licencaCanonica("pd")).toBe("PDM-1.0");
    expect(licencaCanonica("licenca-que-nao-existe")).toBeUndefined();
    expect(textoPuro('<a href="//commons.wikimedia.org/x" title="y">Fulano</a>')).toBe(
      "Fulano",
    );
    expect(textoPuro('<a href="https://exemplo.invalid/x">Beltrano &amp; Cia</a>')).toBe(
      "Beltrano & Cia",
    );
  });

  it("a URL de busca que o estagio monta e a que o cassete gravou", () => {
    const url = urlDeBusca({
      fetch: globalThis.fetch,
      termoDeBusca: "flowchart diagram",
      tipoMidia: "imagem",
      larguraAlvo: Number(estagio.parametros.larguraAlvo),
      limiteCandidatos: Number(estagio.parametros.limiteCandidatos),
      licencasAceitas: [],
    });
    expect(cassete.chamadas.map((c) => c.url)).toContain(url);
  });
});

// ─── C7 e o parcial ─────────────────────────────────────────────────────────────

describe("nenhuma URL atravessa a fronteira (C7)", () => {
  it("o resultado gravado nao tem URL em nenhuma profundidade", () => {
    expect(encontrarURLs(cassete.resultado)).toEqual([]);
  });

  it("o varredor de URL nao esta cego (sonda negativa)", () => {
    expect(
      encontrarURLs({ assets: { a: { atribuicao: "foto em //cdn.exemplo/x" } } }).length,
    ).toBeGreaterThan(0);
  });

  it("a URL de origem existe — mas so na procedencia, acima da fronteira", () => {
    const comOrigem = cassete.procedencia.assets.filter((a) => a.origem !== undefined);
    expect(comOrigem.length).toBeGreaterThan(0);
    expect(comOrigem[0]?.origem).toContain("commons.wikimedia.org");
  });

  it("licenca obrigatoria e nao-vazia no topo e em cada asset (∅-crit)", () => {
    expect(cassete.procedencia.licenca.trim()).not.toBe("");
    expect(cassete.procedencia.licenca).not.toMatch(/:\/\//);
    for (const asset of cassete.procedencia.assets) {
      expect(asset.licenca.trim(), asset.hash).not.toBe("");
      expect(asset.licenca, asset.hash).not.toMatch(/:\/\//);
    }
  });

  it("os bytes existem e batem com o hash declarado (C1: exit 0 nao prova conteudo)", async () => {
    for (const asset of cassete.procedencia.assets) {
      const corpo = cassete.chamadas.find(
        (c) => c.hashCorpo === asset.hash || c.bytesCorpo > 0,
      );
      expect(corpo).toBeDefined();
    }
    // O corpo baixado tem de hashear exatamente para o que o parcial afirma.
    for (const [hash, meta] of Object.entries(cassete.resultado.assets)) {
      const bytes = await readFile(join(diretorio, "corpos", hash));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(hash);
      expect(bytes.length).toBe(meta.byteSize);
    }
  });
});

// ─── O que o estagio recusa ─────────────────────────────────────────────────────

describe("nos que este estagio nao resolve — erro nomeado, nunca skip", () => {
  it("a fixture canonica tem nos irresolviveis, e o estagio diz quais, sem tocar a rede", async () => {
    const canonico = JSON.parse(
      await readFile("fixtures/canonico/manifesto-valido.json", "utf-8"),
    ) as Manifesto;
    const tentadas: string[] = [];

    const erro = await estagio
      .resolver({
        manifesto: canonico,
        parametros: estagio.parametros,
        fetch: fetchQueReprova(tentadas),
        diretorioTrabalho: await trabalho(),
      })
      .then(
        () => null,
        (e: unknown) => e as EMidiaNaoResolvivel,
      );

    expect(erro).toBeInstanceOf(EMidiaNaoResolvivel);
    const problemas = (erro as EMidiaNaoResolvivel).problemas.join("\n");
    expect(problemas).toContain("n-006"); // video: tipo nao suportado
    expect(problemas).toContain("n-007"); // sem texto_alternativo
    expect(tentadas).toEqual([]);
  });

  it("o no de midia sem texto_alternativo nao ganha termo de busca inventado", async () => {
    const canonico = JSON.parse(
      await readFile("fixtures/canonico/manifesto-valido.json", "utf-8"),
    ) as Manifesto;
    const nos = nosDeMidia(canonico.nos);
    const semTexto = nos.find((n) => n.id === "n-007");
    expect(semTexto).toBeDefined();
    expect(termoDeBuscaDoNo(semTexto!)).toBeUndefined();
  });

  it("nosDeMidia devolve so nos de midia, em ordem de id", async () => {
    const canonico = JSON.parse(
      await readFile("fixtures/canonico/manifesto-valido.json", "utf-8"),
    ) as Manifesto;
    const ids = nosDeMidia(canonico.nos).map((n) => n.id);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toContain("n-005");
    for (const no of nosDeMidia(canonico.nos)) expect(no.type).toBe("midia");
  });
});

// ─── Ponte com o store ──────────────────────────────────────────────────────────

describe("ponte com o store de conteudo", () => {
  it("provedor fora do vocabulario do store vira 'unknown' SEM perder o nome original", () => {
    const asset = cassete.procedencia.assets[0]!;
    const doStore = paraProcedenciaDoStore(asset, cassete.procedencia);
    // O vocabulario fechado do F0-07 nao tem "wikimedia-commons". O
    // rebaixamento e esperado; perder o nome nao seria.
    expect(doStore.source).toBe("unknown");
    expect(doStore.notes ?? "").toContain("wikimedia-commons");
    expect(doStore.license).toBe(asset.licenca);
    expect(doStore.attributionRequired).toBe(asset.atribuicaoObrigatoria);
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────────

async function listarArquivos(raiz: string): Promise<string[]> {
  const saida: string[] = [];
  for (const entrada of (await readdir(raiz)).sort()) {
    const caminho = join(raiz, entrada);
    if ((await stat(caminho)).isDirectory()) {
      saida.push(...(await listarArquivos(caminho)));
    } else {
      saida.push(caminho);
    }
  }
  return saida;
}
