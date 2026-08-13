/**
 * tests/resolucao/contrato-orquestrador.test.ts
 *
 * PERGUNTA ADVERSARIAL 2 — "a chave de cache do contrato inclui a versao
 * do estagio? Sem isso, mudar o codigo do estagio nao invalida o cache e
 * voce serve resultado velho para sempre."
 *
 * A prova nao e "a chave muda quando a versao muda" (isso um hash de
 * qualquer coisa satisfaz). A prova e comportamental, em tres partes:
 *
 *   a) mesma versao   -> mesma chave -> o cassete gravado e ENCONTRADO;
 *   b) versao bumpada -> outra chave -> o mesmo cassete NAO e encontrado,
 *      e o orquestrador offline lanca ECasseteAusente em vez de servir o
 *      resultado antigo;
 *   c) o mesmo vale, um parametro por vez, para TODOS os componentes da
 *      chave — versao do contrato, nome, versao do estagio, manifesto e
 *      cada parametro (C12: a chave inclui tudo que muda a saida).
 *
 * ∅-crit: um estagio sem cassete derruba a suite. Testado aqui no nivel
 * do orquestrador e em descoberta.test.ts no nivel do disco.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ORDEM_ESTAGIOS,
  VERSAO_CONTRATO,
  chaveDeCache,
  componentesDaChave,
  ehNomeEstagio,
  hashDoManifesto,
  jsonCanonico,
} from "src/resolucao/contrato.js";
import type {
  ComponentesChave,
  EntradaEstagio,
  EstagioResolucao,
  NomeEstagio,
  ParametrosEstagio,
  SaidaEstagio,
} from "src/resolucao/contrato.js";
import { Orquestrador } from "src/resolucao/orquestrador.js";
import { ECasseteAusente, ARQUIVO_RESULTADO } from "src/resolucao/cassete/formato.js";
import { EEstagioDesconhecido } from "src/resolucao/descoberta.js";
import { gravarCassete } from "src/resolucao/cassete/gravador.js";
import {
  EColisaoDeMerge,
  encontrarURLs,
  fundirParciais,
} from "src/resolucao/manifesto-resolvido.js";
import type { Manifesto } from "src/contratos/manifesto.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function manifesto(fps = 30): Manifesto {
  return {
    schema_version: "Manifesto.1",
    fps,
    width: 1920,
    height: 1080,
    nos: [
      {
        id: "n-001",
        schema: "Cabecalho.1",
        type: "cabecalho",
        duracao_frames: 60,
        texto: "Titulo",
      },
      {
        id: "n-002",
        schema: "Midia.1",
        type: "midia",
        duracao_frames: 90,
        hash: "a".repeat(64),
        tipo_midia: "gif",
        licenca: "CC0-1.0",
      },
    ],
    cenas: [
      { id: "c-001", nos: ["n-001"] },
      { id: "c-002", nos: ["n-002"] },
    ],
  };
}

/** Estagio deterministico de teste, com contador de execucoes. */
function estagio(
  nome: NomeEstagio,
  versao = "1.0.0",
  parametros: ParametrosEstagio = { p: 1 },
): EstagioResolucao & { execucoes: number } {
  const alvo = {
    identidade: { nome, versao },
    parametros,
    execucoes: 0,
    async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
      alvo.execucoes++;
      const assets: Record<string, ReturnType<typeof asset>> = {};
      const mapa: Record<string, string> = {};
      for (const no of entrada.manifesto.nos) {
        const h = hashFalso(`${nome}|${versao}|${no.id}|${jsonCanonico(parametros)}`);
        assets[h] = asset(h);
        mapa[no.id] = h;
      }
      const campo = `nos_${nome === "musica" ? "musica" : nome}` as const;
      return {
        parcial: { assets, [campo]: mapa },
        procedencia: {
          licenca: "CC0-1.0",
          provedor: "teste",
          assets: Object.keys(assets).map((h) => ({
            hash: h,
            licenca: "CC0-1.0",
            atribuicaoObrigatoria: false,
            provedor: "teste",
          })),
        },
      };
    },
  };
  return alvo;
}

function asset(hash: string) {
  return {
    hash,
    tipo: "audio" as const,
    licenca: "CC0-1.0",
    atribuicaoObrigatoria: false,
    provedor: "teste",
  };
}

function hashFalso(semente: string): string {
  // sha256 sincrono via node:crypto seria import extra; um hash estavel
  // e suficiente aqui — o que importa e ser funcao pura da semente.
  let h = 0n;
  for (const ch of semente) h = (h * 131n + BigInt(ch.codePointAt(0) ?? 0)) % (1n << 128n);
  return h.toString(16).padStart(64, "0").slice(0, 64);
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe("Contrato de estagio", () => {
  it("a ordem canonica tem exatamente os cinco estagios", () => {
    expect([...ORDEM_ESTAGIOS]).toEqual([
      "locucao",
      "grafico",
      "midia",
      "codigo",
      "musica",
    ]);
  });

  it("ehNomeEstagio aceita os canonicos e rejeita o resto", () => {
    for (const nome of ORDEM_ESTAGIOS) expect(ehNomeEstagio(nome)).toBe(true);
    expect(ehNomeEstagio("mentira")).toBe(false);
    expect(ehNomeEstagio("")).toBe(false);
  });

  it("jsonCanonico ordena chaves: mesma informacao, mesmos bytes", () => {
    expect(jsonCanonico({ b: 1, a: 2 })).toBe(jsonCanonico({ a: 2, b: 1 }));
    expect(jsonCanonico({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("hashDoManifesto independe da ordem de escrita das propriedades", () => {
    const m1 = manifesto();
    // Reconstroi o mesmo objeto com as chaves em ordem inversa: mesma
    // informacao, ordem de insercao oposta.
    const invertido: Record<string, unknown> = {};
    for (const chave of Object.keys(m1).reverse()) {
      invertido[chave] = (m1 as unknown as Record<string, unknown>)[chave];
    }
    const m2 = invertido as unknown as Manifesto;
    expect(Object.keys(m2)).not.toEqual(Object.keys(m1));
    expect(hashDoManifesto(m2)).toBe(hashDoManifesto(m1));
  });
});

// ─── Chave de cache: C12, um componente por vez ────────────────────────────────

describe("Chave de cache — C12: um componente por vez exige cache miss", () => {
  const base = (): ComponentesChave => ({
    versaoContrato: VERSAO_CONTRATO,
    nome: "locucao",
    versaoEstagio: "1.0.0",
    hashManifesto: "b".repeat(64),
    parametros: { voz: "alloy", velocidade: 1, formato: "wav" },
  });

  it("chave estavel: mesmos componentes, mesma chave", () => {
    expect(chaveDeCache(base())).toBe(chaveDeCache(base()));
  });

  const mutacoes: Array<[string, (c: ComponentesChave) => ComponentesChave]> = [
    ["versao do contrato", (c) => ({ ...c, versaoContrato: "9.9.9" })],
    ["nome do estagio", (c) => ({ ...c, nome: "grafico" })],
    ["VERSAO DO ESTAGIO", (c) => ({ ...c, versaoEstagio: "1.0.1" })],
    ["hash do manifesto", (c) => ({ ...c, hashManifesto: "c".repeat(64) })],
    [
      "parametro voz",
      (c) => ({ ...c, parametros: { ...c.parametros, voz: "echo" } }),
    ],
    [
      "parametro velocidade",
      (c) => ({ ...c, parametros: { ...c.parametros, velocidade: 1.25 } }),
    ],
    [
      "parametro formato",
      (c) => ({ ...c, parametros: { ...c.parametros, formato: "mp3" } }),
    ],
    [
      "parametro novo",
      (c) => ({ ...c, parametros: { ...c.parametros, tom: "grave" } }),
    ],
  ];

  for (const [rotulo, mutar] of mutacoes) {
    it(`muda ${rotulo} -> chave diferente (cache miss)`, () => {
      expect(chaveDeCache(mutar(base()))).not.toBe(chaveDeCache(base()));
    });
  }

  it("as mutacoes cobrem todos os componentes da chave", () => {
    // Sem esta assercao, alguem adiciona um componente novo em
    // ComponentesChave e a lista acima continua verde sem testa-lo.
    const componentes = Object.keys(base()).sort();
    expect(componentes).toEqual([
      "hashManifesto",
      "nome",
      "parametros",
      "versaoContrato",
      "versaoEstagio",
    ]);
  });

  it("a chave e um SHA-256 hexadecimal", () => {
    expect(chaveDeCache(base())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a chave nao depende da ordem de escrita dos parametros", () => {
    const a = { ...base(), parametros: { voz: "alloy", velocidade: 1, formato: "wav" } };
    const b = { ...base(), parametros: { formato: "wav", velocidade: 1, voz: "alloy" } };
    expect(chaveDeCache(a)).toBe(chaveDeCache(b));
  });
});

// ─── Orquestrador ──────────────────────────────────────────────────────────────

describe("Orquestrador", () => {
  let tmp: string;
  let raiz: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "orq-"));
    raiz = join(tmp, "cassetes");
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("ordena os estagios pela ordem canonica, nao pela ordem do chamador", () => {
    const orq = new Orquestrador({
      estagios: [
        estagio("musica"),
        estagio("codigo"),
        estagio("locucao"),
        estagio("midia"),
        estagio("grafico"),
      ],
      raizCassetes: raiz,
    });
    expect([...orq.ordem]).toEqual([...ORDEM_ESTAGIOS]);
  });

  it("recusa dois estagios com o mesmo nome (o segundo silenciaria o primeiro)", () => {
    expect(
      () =>
        new Orquestrador({
          estagios: [estagio("locucao", "1.0.0"), estagio("locucao", "2.0.0")],
          raizCassetes: raiz,
        }),
    ).toThrow(/Dois estagios com o nome/);
  });

  it("AB-502: estagio com nome fora da lista canonica lanca EEstagioDesconhecido, nunca descarta", () => {
    // Regressao: antes, ordenarPelaCanonica DESCARTABA em silencio o nome
    // fora de ORDEM_ESTAGIOS e o orquestrador resolvia um manifesto vazio
    // — verde por ausencia. Agora o erro elimina a classe inteira.
    const mentira: EstagioResolucao = {
      ...estagio("locucao"),
      identidade: { nome: "mentira" as NomeEstagio, versao: "1.0.0" },
    };
    expect(() => new Orquestrador({ estagios: [mentira], raizCassetes: raiz })).toThrow(
      EEstagioDesconhecido,
    );
    expect(
      () => new Orquestrador({ estagios: [mentira], raizCassetes: raiz }),
    ).toThrow(/mentira/);
  });

  it("o modo default e offline — nunca gravacao", async () => {
    const e = estagio("locucao");
    const orq = new Orquestrador({ estagios: [e], raizCassetes: raiz });
    await expect(orq.resolver(manifesto())).rejects.toThrow(ECasseteAusente);
    // O estagio NAO foi executado: offline nao cai para gravacao.
    expect(e.execucoes).toBe(0);
  });

  // ─── ∅-crit ──────────────────────────────────────────────────────────────

  it("∅-crit: estagio sem cassete lanca ECasseteAusente, nunca e pulado", async () => {
    const e = estagio("locucao");
    const orq = new Orquestrador({ estagios: [e], raizCassetes: raiz });
    const erro = await orq.resolver(manifesto()).then(
      () => null,
      (x: unknown) => x as ECasseteAusente,
    );
    expect(erro).toBeInstanceOf(ECasseteAusente);
    expect(erro?.code).toBe("CASSETE_AUSENTE");
    expect(erro?.message).toContain("∅-crit");
    expect(erro?.estagio).toBe("locucao");
  });

  it("∅-crit: um estagio sem cassete no meio derruba o pipeline inteiro", async () => {
    const comCassete = estagio("locucao");
    const semCassete = estagio("musica");
    const m = manifesto();
    await gravarCassete(comCassete, {
      raiz,
      manifesto: m,
      diretorioTrabalho: tmp,
    });

    const orq = new Orquestrador({
      estagios: [comCassete, semCassete],
      raizCassetes: raiz,
    });
    await expect(orq.resolver(m)).rejects.toThrow(ECasseteAusente);
  });

  it("∅-crit: cassete com arquivo obrigatorio faltando conta como ausente", async () => {
    const e = estagio("locucao");
    const m = manifesto();
    const { diretorio, chave } = await gravarCassete(e, {
      raiz,
      manifesto: m,
      diretorioTrabalho: tmp,
    });
    await rm(join(diretorio, "procedencia.json"));

    const orq = new Orquestrador({ estagios: [e], raizCassetes: raiz });
    const erro = await orq.resolver(m).then(
      () => null,
      (x: unknown) => x as ECasseteAusente,
    );
    expect(erro).toBeInstanceOf(ECasseteAusente);
    expect(erro?.message).toContain("procedencia.json");
    expect(erro?.chave).toBe(chave);
  });

  // ─── Gravacao e replay ───────────────────────────────────────────────────

  it("gravacao executa o estagio; offline reproduz sem executa-lo", async () => {
    const e = estagio("locucao");
    const m = manifesto();

    const gravador = new Orquestrador({
      estagios: [e],
      raizCassetes: raiz,
      modo: "gravacao",
    });
    const gravado = await gravador.resolver(m);
    expect(e.execucoes).toBe(1);
    expect(gravado.resolvido.estagios[0]?.origem).toBe("gravacao");

    const offline = new Orquestrador({ estagios: [e], raizCassetes: raiz });
    const reproduzido = await offline.resolver(m);
    expect(e.execucoes).toBe(1); // nao executou de novo
    expect(reproduzido.resolvido.estagios[0]?.origem).toBe("cassete");
    expect(reproduzido.resolvido.nos_locucao).toEqual(gravado.resolvido.nos_locucao);
    expect(reproduzido.resolvido.assets).toEqual(gravado.resolvido.assets);
  });

  it("pipeline completo dos cinco estagios: grava e reproduz offline", async () => {
    const estagios = ORDEM_ESTAGIOS.map((n) => estagio(n));
    const m = manifesto();

    await new Orquestrador({
      estagios,
      raizCassetes: raiz,
      modo: "gravacao",
    }).resolver(m);

    const resultado = await new Orquestrador({
      estagios,
      raizCassetes: raiz,
    }).resolver(m);

    expect(resultado.resolvido.estagios).toHaveLength(5);
    expect(resultado.resolvido.estagios.map((r) => r.estagio)).toEqual([
      ...ORDEM_ESTAGIOS,
    ]);
    for (const registro of resultado.resolvido.estagios) {
      expect(registro.origem).toBe("cassete");
      expect(registro.chave).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(Object.keys(resultado.resolvido.nos_locucao)).toHaveLength(2);
    expect(Object.keys(resultado.resolvido.nos_codigo)).toHaveLength(2);
  });

  // ─── A prova da pergunta 2, no comportamento ─────────────────────────────

  it("PERGUNTA 2: bumpar a versao do estagio invalida o cassete gravado", async () => {
    const m = manifesto();
    const v1 = estagio("locucao", "1.0.0");
    await gravarCassete(v1, { raiz, manifesto: m, diretorioTrabalho: tmp });

    // Mesma versao: encontra o cassete.
    const mesmaVersao = new Orquestrador({ estagios: [v1], raizCassetes: raiz });
    await expect(mesmaVersao.resolver(m)).resolves.toBeDefined();

    // Versao bumpada: NAO encontra — nao serve o resultado antigo.
    const v2 = estagio("locucao", "1.0.1");
    const versaoNova = new Orquestrador({ estagios: [v2], raizCassetes: raiz });
    await expect(versaoNova.resolver(m)).rejects.toThrow(ECasseteAusente);
    expect(v2.execucoes).toBe(0);
  });

  it("PERGUNTA 2: mudar o manifesto tambem invalida o cassete", async () => {
    const v1 = estagio("locucao", "1.0.0");
    await gravarCassete(v1, {
      raiz,
      manifesto: manifesto(30),
      diretorioTrabalho: tmp,
    });
    const orq = new Orquestrador({ estagios: [v1], raizCassetes: raiz });
    await expect(orq.resolver(manifesto(30))).resolves.toBeDefined();
    await expect(orq.resolver(manifesto(60))).rejects.toThrow(ECasseteAusente);
  });

  it("PERGUNTA 2: mudar um parametro tambem invalida o cassete", async () => {
    const m = manifesto();
    const antes = estagio("locucao", "1.0.0", { voz: "alloy" });
    await gravarCassete(antes, { raiz, manifesto: m, diretorioTrabalho: tmp });

    const depois = estagio("locucao", "1.0.0", { voz: "echo" });
    const orq = new Orquestrador({ estagios: [depois], raizCassetes: raiz });
    await expect(orq.resolver(m)).rejects.toThrow(ECasseteAusente);
  });

  it("cada versao grava seu proprio diretorio de cassete", async () => {
    const m = manifesto();
    await gravarCassete(estagio("locucao", "1.0.0"), {
      raiz,
      manifesto: m,
      diretorioTrabalho: tmp,
    });
    await gravarCassete(estagio("locucao", "2.0.0"), {
      raiz,
      manifesto: m,
      diretorioTrabalho: tmp,
    });
    const chaves = await readdir(join(raiz, "locucao"));
    expect(chaves).toHaveLength(2);
  });

  it("resolverEstagio roda um estagio so", async () => {
    const m = manifesto();
    const loc = estagio("locucao");
    const mus = estagio("musica");
    await gravarCassete(loc, { raiz, manifesto: m, diretorioTrabalho: tmp });

    const orq = new Orquestrador({ estagios: [loc, mus], raizCassetes: raiz });
    const resultado = await orq.resolverEstagio("locucao", m);
    expect(resultado.resolvido.estagios).toHaveLength(1);
    expect(resultado.resolvido.estagios[0]?.estagio).toBe("locucao");
  });

  it("resolverEstagio recusa estagio que nao foi passado", async () => {
    const orq = new Orquestrador({ estagios: [], raizCassetes: raiz });
    await expect(orq.resolverEstagio("locucao", manifesto())).rejects.toThrow(
      /nao foi passado ao orquestrador/,
    );
  });

  it("cassete adulterado a mao e detectado (chave do cabecalho != diretorio)", async () => {
    const m = manifesto();
    const e = estagio("locucao");
    const { diretorio } = await gravarCassete(e, {
      raiz,
      manifesto: m,
      diretorioTrabalho: tmp,
    });
    await writeFile(
      join(diretorio, ARQUIVO_RESULTADO),
      "{ isto nao e json valido",
      "utf-8",
    );
    const orq = new Orquestrador({ estagios: [e], raizCassetes: raiz });
    await expect(orq.resolver(m)).rejects.toThrow(/Cassete invalido/);
  });
});

// ─── Manifesto resolvido ───────────────────────────────────────────────────────

describe("Manifesto resolvido — merge e guarda C7", () => {
  it("o merge ordena as chaves de todos os mapas", () => {
    const resolvido = fundirParciais(manifesto(), "d".repeat(64), [
      {
        registro: {
          estagio: "locucao",
          versaoEstagio: "1.0.0",
          chave: "e".repeat(64),
          origem: "cassete",
        },
        parcial: {
          assets: {},
          nos_locucao: { "z-no": "1".repeat(64), "a-no": "2".repeat(64) },
        },
      },
    ]);
    expect(Object.keys(resolvido.nos_locucao)).toEqual(["a-no", "z-no"]);
  });

  it("colisao entre estagios com hashes diferentes e ERRO, nao ultimo-vence", () => {
    const registro = {
      versaoEstagio: "1.0.0",
      chave: "e".repeat(64),
      origem: "cassete" as const,
    };
    expect(() =>
      fundirParciais(manifesto(), "d".repeat(64), [
        {
          registro: { ...registro, estagio: "locucao" },
          parcial: { assets: {}, nos_locucao: { "n-001": "1".repeat(64) } },
        },
        {
          registro: { ...registro, estagio: "musica" },
          parcial: { assets: {}, nos_locucao: { "n-001": "2".repeat(64) } },
        },
      ]),
    ).toThrow(EColisaoDeMerge);
  });

  it("o manifesto resolvido nao contem relogio nem URL", async () => {
    const tmp2 = await mkdtemp(join(tmpdir(), "orq-c7-"));
    const raiz2 = join(tmp2, "cassetes");
    try {
      const m = manifesto();
      const estagios = ORDEM_ESTAGIOS.map((n) => estagio(n));
      await new Orquestrador({
        estagios,
        raizCassetes: raiz2,
        modo: "gravacao",
      }).resolver(m);
      const { resolvido } = await new Orquestrador({
        estagios,
        raizCassetes: raiz2,
      }).resolver(m);

      // Tripwire C11: a busca e no JSON inteiro, nao campo a campo.
      expect(encontrarURLs(resolvido)).toEqual([]);
      const texto = JSON.stringify(resolvido);
      expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(texto).not.toContain("duracaoMs");
    } finally {
      await rm(tmp2, { recursive: true, force: true });
    }
  });

  it("encontrarURLs acha URL em valor, em nome de propriedade e no fundo", () => {
    expect(encontrarURLs({ a: "https://x.test" })).toHaveLength(1);
    expect(encontrarURLs({ "https://x.test": 1 })).toHaveLength(1);
    expect(encontrarURLs({ a: { b: [{ c: "s3://balde/chave" }] } })).toHaveLength(1);
    expect(encontrarURLs({ a: "CC BY 4.0", b: 3, c: null })).toEqual([]);
  });

  it("a sonda de URL nao e vacua: sem achado, o teste acima seria verde por engano", () => {
    // Sonda negativa da sonda. Se encontrarURLs sempre devolvesse [],
    // este assert reprovaria.
    expect(encontrarURLs({ x: "http://exemplo.test" }).length).toBeGreaterThan(0);
  });
});

// ─── Componentes da chave a partir de um estagio real ──────────────────────────

describe("componentesDaChave", () => {
  it("copia identidade e parametros do estagio, mais a versao do contrato", () => {
    const e = estagio("grafico", "3.1.4", { qualidade: "alta" });
    const c = componentesDaChave(e, "f".repeat(64));
    expect(c).toEqual({
      versaoContrato: VERSAO_CONTRATO,
      nome: "grafico",
      versaoEstagio: "3.1.4",
      hashManifesto: "f".repeat(64),
      parametros: { qualidade: "alta" },
    });
  });
});
