/**
 * tests/resolucao/musica.test.ts — card F2-06
 *
 * O estagio de musica e efeitos, testado COM A REDE BLOQUEADA. O guarda
 * em processo e instalado por `tests/setup/rede-bloqueada.ts` para a
 * suite inteira; o primeiro `describe` abaixo prova que ele esta de pe
 * neste arquivo, porque "offline" so vale alguma coisa depois que
 * alguem tenta sair e nao consegue.
 *
 * A PERGUNTA OBRIGATORIA DA ONDA — "existe assercao sobre a LISTA
 * COMPLETA de alguma coisa?" — foi respondida arquivo afora e a resposta
 * e NAO, por escolha deliberada em tres lugares que pediam o contrario:
 *
 *   1. a descoberta de estagios e assertada como `toContain("musica")`,
 *      nunca como igualdade contra uma lista. Os outros quatro estagios
 *      da W4 (F2-02..F2-05) chegam em merges irmaos que este worktree
 *      nao enxerga; uma igualdade aqui seria verdadeira contra esta base
 *      e falsa depois do primeiro merge do vizinho;
 *   2. a cobertura de cassetes roda com `apenasEstagio: "musica"`, o que
 *      torna a assercao "o MEU estagio esta coberto", nunca "estes sao
 *      todos os estagios cobertos";
 *   3. o catalogo do pacote e assertado por presenca de itens e por
 *      invariantes (toda licenca nao-vazia), nunca por contagem exata —
 *      contar itens transformaria "acrescentei um efeito" em teste
 *      vermelho sem nenhum defeito por tras.
 */

import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { descobrirEstagios, verificarCobertura } from "src/resolucao/descoberta.js";
import {
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  procurarCredencial,
} from "src/resolucao/cassete/formato.js";
import { criarFetchDeCassete, lerCassete } from "src/resolucao/cassete/reprodutor.js";
import { chaveDeCache, componentesDaChave, chaveDoEstagio, hashDoManifesto } from "src/resolucao/contrato.js";
import type { EstagioResolucao } from "src/resolucao/contrato.js";
import { encontrarURLs } from "src/resolucao/manifesto-resolvido.js";
import type { AssetResolvido } from "src/resolucao/manifesto-resolvido.js";
import { Orquestrador } from "src/resolucao/orquestrador.js";
import { Store } from "src/store/store.js";
import type { Manifesto, No } from "src/contratos/manifesto.js";

import estagioPadrao, {
  criarEstagioMusica,
  PARAMETROS,
  VERSAO_ESTAGIO,
} from "src/resolucao/musica/estagio.js";
import {
  CATALOGO,
  ID_DA_TRILHA,
  TIPO_DE_NO_PARA_EFEITO,
  efeitoDoNo,
  itemPorId,
  titulosNecessarios,
} from "src/resolucao/musica/pacote.js";
import {
  atribuicaoSemURL,
  ehAtribuicaoObrigatoria,
  limparTextoDoProvedor,
  normalizarCatalogo,
  urlDoCatalogo,
} from "src/resolucao/musica/fornecedor.js";
import type { ArquivoDoFornecedor } from "src/resolucao/musica/fornecedor.js";
import { hidratarStoreDoCassete } from "src/resolucao/musica/hidratar.js";

const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";

async function carregarManifesto(): Promise<Manifesto> {
  return JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
}

function noFalso(id: string, type: string): No {
  return { id, type, schema: "Texto.1", duracao_frames: 30, texto: "x" } as unknown as No;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("o denominador de tudo: a rede esta mesmo bloqueada nesta suite", () => {
  it("uma tentativa de sair por globalThis.fetch morre com REDE BLOQUEADA", async () => {
    // IP literal de proposito: um ENOTFOUND provaria resolvedor
    // quebrado, nao bloqueio. Sem este teste, todo "offline" abaixo
    // poderia estar passando por ninguem ter tentado usar a rede.
    await expect(globalThis.fetch("https://192.0.2.1/nada")).rejects.toThrow(
      /REDE BLOQUEADA/,
    );
  });
});

describe("descoberta e cobertura — presenca do MEU item, nunca a lista completa", () => {
  it("o estagio musica e descoberto em disco pela convencao", async () => {
    const descobertos = await descobrirEstagios("src/resolucao");
    const nomes = descobertos.map((e) => e.nome);
    // `toContain`, e nao `toEqual([...])`: F2-02..F2-05 acrescentam
    // irmaos neste mesmo diretorio em merges que este worktree nao ve.
    expect(nomes).toContain("musica");
    const meu = descobertos.find((e) => e.nome === "musica");
    expect(meu?.arquivo).toBe("src/resolucao/musica/estagio.ts");
    expect(meu?.canonico).toBe(true);
  });

  it("o estagio musica esta coberto por cassete", async () => {
    const relatorio = await verificarCobertura({
      raizEstagios: "src/resolucao",
      raizCassetes: RAIZ_CASSETES_PADRAO,
      apenasEstagio: "musica",
    });
    // Denominador antes do veredito: filtro que nao casa nada sai verde (C2).
    expect(relatorio.descobertos.length).toBe(1);
    expect(relatorio.cobertura[0]?.chaves.length).toBeGreaterThan(0);
    expect(relatorio.ok).toBe(true);
  });

  it("export default e um EstagioResolucao com nome canonico", () => {
    expect(estagioPadrao.identidade.nome).toBe("musica");
    expect(estagioPadrao.identidade.versao).toBe(VERSAO_ESTAGIO);
    expect(typeof estagioPadrao.resolver).toBe("function");
  });
});

describe("chave de cache — C12", () => {
  it("a versao do estagio entra na chave", async () => {
    const manifesto = await carregarManifesto();
    const outraVersao: EstagioResolucao = {
      ...estagioPadrao,
      identidade: { nome: "musica", versao: `${VERSAO_ESTAGIO}-x` },
    };
    expect(chaveDoEstagio(outraVersao, manifesto)).not.toBe(
      chaveDoEstagio(estagioPadrao, manifesto),
    );
  });

  it("cada parametro declarado entra na chave, um por vez", async () => {
    const manifesto = await carregarManifesto();
    const base = componentesDaChave(estagioPadrao, hashDoManifesto(manifesto));
    const chaveBase = chaveDeCache(base);

    // Um por vez: mudar todos de uma vez passaria mesmo que so um
    // deles estivesse na chave.
    const nomes = Object.keys(base.parametros).sort();
    expect(nomes.length).toBeGreaterThan(0);
    for (const nome of nomes) {
      const valor = base.parametros[nome];
      const alterado =
        typeof valor === "number"
          ? valor + 1
          : typeof valor === "boolean"
            ? !valor
            : `${String(valor)}-alterado`;
      const chave = chaveDeCache({
        ...base,
        parametros: { ...base.parametros, [nome]: alterado },
      });
      expect(chave, `parametro ${nome} nao esta na chave`).not.toBe(chaveBase);
    }
  });

  it("sem mudanca nenhuma, a chave repete (senao as mutacoes acima nao provam nada)", async () => {
    const manifesto = await carregarManifesto();
    expect(chaveDoEstagio(estagioPadrao, manifesto)).toBe(
      chaveDoEstagio(estagioPadrao, manifesto),
    );
  });

  it("a raiz do store NAO muda a chave — onde o byte mora nao muda que byte e", async () => {
    const manifesto = await carregarManifesto();
    const outroStore = criarEstagioMusica({ raizStore: "/tmp/store-qualquer" });
    expect(chaveDoEstagio(outroStore, manifesto)).toBe(
      chaveDoEstagio(estagioPadrao, manifesto),
    );
  });
});

describe("o pacote do fornecedor", () => {
  it("todo item declara licenca por vir do fornecedor, e id e titulo nao-vazios", () => {
    expect(CATALOGO.length).toBeGreaterThan(0);
    for (const item of CATALOGO) {
      expect(item.id.trim()).not.toBe("");
      expect(item.titulo.startsWith("File:")).toBe(true);
      expect(item.justificativa.trim()).not.toBe("");
    }
  });

  it("ha uma trilha, e ela e o item declarado em ID_DA_TRILHA", () => {
    const trilha = itemPorId(ID_DA_TRILHA);
    expect(trilha.papel).toBe("trilha");
  });

  it("um tipo de no sem efeito mapeado FALHA alto, nao passa mudo", () => {
    expect(() => efeitoDoNo(noFalso("n-999", "tipo-que-nao-existe"))).toThrow(
      /nao esta em TIPO_DE_NO_PARA_EFEITO/,
    );
  });

  it("cada tipo mapeado aponta para um item que existe no catalogo", () => {
    for (const [tipo, id] of Object.entries(TIPO_DE_NO_PARA_EFEITO)) {
      expect(() => itemPorId(id), `tipo ${tipo}`).not.toThrow();
    }
  });

  it("os titulos pedidos sao deduplicados, ordenados e independentes da ordem dos nos", () => {
    const nos = [
      noFalso("n-003", "grafico"),
      noFalso("n-001", "cabecalho"),
      noFalso("n-002", "grafico"),
    ];
    const a = titulosNecessarios(nos);
    const b = titulosNecessarios([...nos].reverse());
    expect(a).toEqual(b);
    expect([...a]).toEqual([...a].sort());
    expect(new Set(a).size).toBe(a.length);
    // Dois nos "grafico" compartilham um titulo: o numero de downloads
    // e o numero de efeitos DISTINTOS, nao o numero de nos.
    expect(a.length).toBeLessThan(nos.length + 1);
  });
});

describe("normalizacao da resposta do fornecedor — o conserto e do ESTAGIO", () => {
  it("tira marcacao HTML do credito", () => {
    expect(limparTextoDoProvedor('<a rel="nofollow" href="/x">Kevin MacLeod</a>')).toBe(
      "Kevin MacLeod",
    );
  });

  it("tira URL que esta no TEXTO, nao so no href — strip de tag nao basta", () => {
    const bruto = '<a href="https://freesound.org/people/rhodesmas/">https://freesound.org/people/rhodesmas/</a>';
    const limpo = limparTextoDoProvedor(bruto);
    expect(limpo).not.toMatch(/:\/\//);
    expect(limpo).toBe("");
  });

  it("tira URL relativa a protocolo (//host/...), que e o caso real do item campainha", () => {
    const limpo = limparTextoDoProvedor(
      '<a href="//commons.wikimedia.org/wiki/User:Amada44" title="User:Amada44">Amada44</a>',
    );
    expect(limpo).toBe("Amada44");
    expect(encontrarURLs({ x: limpo })).toEqual([]);
  });

  it("decodifica entidades sem criar tag por acidente", () => {
    expect(limparTextoDoProvedor("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(limparTextoDoProvedor("&amp;lt;b&amp;gt;")).toBe("&lt;b&gt;");
  });

  it("AttributionRequired chega como string e vira booleano; o default e o conservador", () => {
    expect(ehAtribuicaoObrigatoria("true")).toBe(true);
    expect(ehAtribuicaoObrigatoria("false")).toBe(false);
    expect(ehAtribuicaoObrigatoria("False")).toBe(false);
    // Ausente ou desconhecido => exige credito. Creditar demais custa uma
    // linha; creditar de menos e violacao de licenca.
    expect(ehAtribuicaoObrigatoria(undefined)).toBe(true);
    expect(ehAtribuicaoObrigatoria("talvez")).toBe(true);
  });

  it("a atribuicao montada nunca contem URL, e reprova se contivesse", () => {
    const limpo: ArquivoDoFornecedor = {
      titulo: "File:X.ogg",
      nomeDaObra: "X",
      autor: "Alguem",
      licenca: "CC BY 3.0",
      atribuicaoObrigatoria: true,
      mime: "application/ogg",
      bytes: 1,
      duracaoSegundos: 1,
      sha1Declarado: "",
      urlDownload: "https://exemplo/x.ogg",
      urlDescricao: "https://exemplo/File:X.ogg",
      urlDeed: "https://creativecommons.org/licenses/by/3.0",
    };
    expect(encontrarURLs({ a: atribuicaoSemURL(limpo) })).toEqual([]);

    // Sonda negativa: se a limpeza falhasse a montagem tem de estourar.
    expect(() =>
      atribuicaoSemURL({ ...limpo, autor: "Kevin MacLeod https://incompetech.com" }),
    ).toThrow(/contem URL/);
  });

  it("o catalogo e indexado por TITULO, nao por posicao", () => {
    // O fornecedor devolve `pages` em ordem propria: verificado em
    // producao que um pedido de tres titulos volta com o terceiro na
    // frente. Ler por posicao trocaria os efeitos de lugar.
    const pagina = (titulo: string, url: string) => ({
      title: titulo,
      imageinfo: [
        {
          url,
          descriptionurl: `https://exemplo/${titulo}`,
          mime: "application/ogg",
          size: 10,
          sha1: "abc",
          duration: 40,
          extmetadata: {
            LicenseShortName: { value: "CC0" },
            Artist: { value: "Alguem" },
            ObjectName: { value: titulo },
            AttributionRequired: { value: "false" },
          },
        },
      ],
    });
    const bruto = {
      query: { pages: [pagina("File:B.ogg", "https://x/b"), pagina("File:A.ogg", "https://x/a")] },
    };
    const mapa = normalizarCatalogo(bruto, ["File:A.ogg", "File:B.ogg"]);
    expect(mapa.get("File:A.ogg")?.urlDownload).toBe("https://x/a");
    expect(mapa.get("File:B.ogg")?.urlDownload).toBe("https://x/b");
  });

  it("um arquivo sem licenca declarada nao vira asset — o ∅-crit comeca na origem", () => {
    const bruto = {
      query: {
        pages: [
          {
            title: "File:SemLicenca.ogg",
            imageinfo: [
              {
                url: "https://x/s",
                descriptionurl: "https://x/d",
                mime: "application/ogg",
                size: 1,
                sha1: "a",
                duration: 1,
                extmetadata: { Artist: { value: "Alguem" } },
              },
            ],
          },
        ],
      },
    };
    expect(() => normalizarCatalogo(bruto, ["File:SemLicenca.ogg"])).toThrow(
      /nao declara licenca/,
    );
  });

  it("a URL de consulta e estavel e nao depende da ordem dos titulos", () => {
    const a = urlDoCatalogo(["File:B.ogg", "File:A.ogg"]);
    const b = urlDoCatalogo(["File:A.ogg", "File:B.ogg"]);
    expect(a).toBe(b);
  });
});

describe("o cassete gravado — a travessia da fronteira", () => {
  it("nenhuma URL desceu; a URL de origem continua viva na procedencia", async () => {
    const manifesto = await carregarManifesto();
    const chave = chaveDoEstagio(estagioPadrao, manifesto);
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "musica", chave);

    expect(encontrarURLs(cassete.resultado)).toEqual([]);

    // A outra metade: apagar a origem tambem passaria acima, e mataria
    // a auditoria de licenca. Entao exigimos que ela esteja la.
    expect(cassete.procedencia.assets.length).toBeGreaterThan(0);
    for (const asset of cassete.procedencia.assets) {
      expect(asset.origem, `asset ${asset.hash.slice(0, 12)}`).toMatch(/^https:\/\//);
    }
  });

  it("toda licenca do cassete e nao-vazia — o ∅-crit da W4, em codigo", async () => {
    const manifesto = await carregarManifesto();
    const chave = chaveDoEstagio(estagioPadrao, manifesto);
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "musica", chave);

    expect(cassete.procedencia.licenca.trim()).not.toBe("");
    expect(cassete.procedencia.assets.length).toBeGreaterThan(0);
    for (const asset of cassete.procedencia.assets) {
      expect(asset.licenca.trim(), `asset ${asset.hash.slice(0, 12)}`).not.toBe("");
    }
    const assets = Object.values(cassete.resultado.assets) as AssetResolvido[];
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of assets) {
      expect(asset.licenca.trim()).not.toBe("");
      // Atribuicao obrigatoria sem texto de atribuicao e um credito que
      // ninguem consegue escrever na hora de publicar.
      if (asset.atribuicaoObrigatoria) {
        expect(asset.atribuicao?.trim() ?? "").not.toBe("");
      }
    }
  });

  it("todo no do manifesto tem efeito, e todo efeito e um hash que existe em assets", async () => {
    const manifesto = await carregarManifesto();
    const chave = chaveDoEstagio(estagioPadrao, manifesto);
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "musica", chave);
    const nosMusica = cassete.resultado.nos_musica ?? {};

    expect(Object.keys(nosMusica).length).toBe(manifesto.nos.length);
    for (const no of manifesto.nos) {
      const hash = nosMusica[no.id];
      expect(hash, `no ${no.id} sem efeito`).toMatch(/^[0-9a-f]{64}$/);
      expect(cassete.resultado.assets[hash as string], `hash orfao em ${no.id}`).toBeDefined();
    }
    const trilha = cassete.resultado.trilha_sonora;
    expect(trilha).toMatch(/^[0-9a-f]{64}$/);
    expect(cassete.resultado.assets[trilha as string]).toBeDefined();
  });

  it("nenhum byte do cassete carrega credencial — e a API nem usa credencial", async () => {
    const manifesto = await carregarManifesto();
    const chave = chaveDoEstagio(estagioPadrao, manifesto);
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "musica", chave);

    expect(cassete.chamadas.length).toBeGreaterThan(0);
    for (const chamada of cassete.chamadas) {
      const cabecalhos = Object.keys(chamada.headersRequisicao).map((h) => h.toLowerCase());
      expect(cabecalhos).not.toContain("authorization");
      expect(cabecalhos).not.toContain("x-api-key");
      expect(cabecalhos).not.toContain("cookie");
      expect(chamada.url).not.toMatch(/[?&](api[_-]?key|key|token|secret)=/i);
      expect(procurarCredencial(chamada.url)).toEqual([]);
    }
    // Sonda negativa do varredor, senao o "toEqual([])" acima e vacuo.
    expect(procurarCredencial("Bearer abcdefghijklmnopqrstuvwxyz0123").length).toBeGreaterThan(0);
  });
});

describe("o efeito remoto virou hash no store", () => {
  it("todo asset do resultado existe como conteudo e rehasheia igual, offline", async () => {
    const manifesto = await carregarManifesto();
    const chave = chaveDoEstagio(estagioPadrao, manifesto);
    const dir = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "musica", chave);

    const tmp = await mkdtemp(join(tmpdir(), "musica-store-teste-"));
    try {
      const store = new Store({ root: tmp });
      const relatorio = await hidratarStoreDoCassete(dir, store);
      expect(relatorio.hashesEsperados.length).toBeGreaterThan(0);
      expect(relatorio.semCorpo).toEqual([]);
      expect(relatorio.corrompidos).toEqual([]);
      expect(relatorio.ok).toBe(true);
      // O store confirma por si: recalcula o hash do arquivo em disco.
      for (const asset of relatorio.hidratados) {
        expect(await store.verify(asset.hash), asset.hash.slice(0, 12)).toBe(true);
        expect(await store.getProcedencia(asset.hash)).not.toBeNull();
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe("cache quente com a rede bloqueada", () => {
  it("o orquestrador reproduz o cassete sem invocar resolver()", async () => {
    const manifesto = await carregarManifesto();
    // Um espiao que explode se for chamado: prova direta, e nao um
    // `expect(spy).not.toHaveBeenCalled()` que passaria tambem se o
    // orquestrador tivesse falhado silenciosamente antes de chegar la.
    const espiao: EstagioResolucao = {
      ...estagioPadrao,
      resolver() {
        throw new Error("resolver() nao pode ser chamado com cache quente");
      },
    };
    const orquestrador = new Orquestrador({
      estagios: [espiao],
      raizCassetes: RAIZ_CASSETES_PADRAO,
      modo: "offline",
    });
    const { resolvido } = await orquestrador.resolverEstagio("musica", manifesto);
    expect(resolvido.estagios[0]?.origem).toBe("cassete");
    expect(resolvido.trilha_sonora).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(resolvido.nos_musica).length).toBe(manifesto.nos.length);
  });

  it("cache FRIO offline nao cai para a rede: lanca ECasseteAusente", async () => {
    const manifesto = await carregarManifesto();
    // Sonda negativa do teste acima: sem cassete, tem de doer.
    const outraVersao: EstagioResolucao = {
      ...estagioPadrao,
      identidade: { nome: "musica", versao: "0.0.0-inexistente" },
    };
    const orquestrador = new Orquestrador({
      estagios: [outraVersao],
      raizCassetes: RAIZ_CASSETES_PADRAO,
      modo: "offline",
    });
    await expect(orquestrador.resolverEstagio("musica", manifesto)).rejects.toThrow(
      /∅-crit|nao tem cassete/,
    );
  });
});

describe("sosia, nao sucessor", () => {
  it("resolver() sobre os corpos gravados reproduz a mesma parcial", async () => {
    const manifesto = await carregarManifesto();
    const chave = chaveDoEstagio(estagioPadrao, manifesto);
    const dir = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "musica", chave);
    const cassete = await lerCassete(RAIZ_CASSETES_PADRAO, "musica", chave);

    const tmp = await mkdtemp(join(tmpdir(), "musica-sosia-"));
    try {
      const estagio = criarEstagioMusica({
        raizStore: join(tmp, "store"),
        pausaEntreDownloadsMs: 0,
      });
      const saida = await estagio.resolver({
        manifesto,
        parametros: PARAMETROS,
        fetch: criarFetchDeCassete(cassete, dir),
        diretorioTrabalho: tmp,
      });
      expect(saida.parcial).toEqual(cassete.resultado);
      // Se o gravador tivesse limpado a resposta, esta chamada teria
      // lido JSON ja normalizado e o normalizador nunca mais seria
      // exercitado. O teste de que ele AINDA e exercitado esta em
      // tools/musica/verificar.ts, fase 5, contra os bytes crus.
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
