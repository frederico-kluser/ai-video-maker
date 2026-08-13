/**
 * tests/entrega/procedencia/relatorio.test.ts
 *
 * Testes do GERADOR do relatorio de procedencia (card F5-06, W7).
 *
 * As tres perguntas adversariais do card, respondidas por teste:
 *
 *   1. TRANSITIVOS — o relatorio cobre o que entrou DENTRO de um
 *      cassete (assets[] do estagio) e DENTRO de uma emenda (cadeia de
 *      derivacao ate o audio-fonte, contrato-w7 C3).
 *   2. ORIGEM COM DATA E TERMOS — cada entrada registra licenca,
 *      provedor, data (adquiridoEm) e termos (atribuicao/termoDeBusca)
 *      quando existem; a ausencia de data vira gap reportado.
 *   3. REAVALIAR SEM RE-RENDERIZAR — o relatorio e determinista
 *      (relogio injetado): regeneravel byte a byte dos mesmos inputs.
 *
 * Convencao do test: TODAS as assercoes sao de PRESENCA per-item
 * (contrato-w7 §12) — nunca sobre listas fechadas.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ManifestoResolvido, Sha256 } from "src/resolucao/manifesto-resolvido.js";
import type { Procedencia } from "src/store/procedencia.js";
import { Store } from "src/store/store.js";
import {
  MARCADOR_DERIVACAO,
  serializarRelatorio,
} from "src/entrega/procedencia/formato.js";
import { adaptarStore, gerarRelatorio } from "src/entrega/procedencia/relatorio.js";
import type { LeitorDeProcedencia } from "src/entrega/procedencia/relatorio.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sha256Hex(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

function procedencia(overrides?: Partial<Procedencia>): Procedencia {
  return {
    license: "CC0-1.0",
    attributionRequired: false,
    source: "local",
    acquiredAt: "2026-08-13T12:09:52.576Z",
    ...overrides,
  };
}

/** Store sintetico em memoria — so o que o teste colocar. */
class StoreSintetico implements LeitorDeProcedencia {
  private readonly registros = new Map<Sha256, Procedencia>();
  constructor(registros: Readonly<Record<string, Procedencia>> = {}) {
    for (const [hash, p] of Object.entries(registros)) this.registros.set(hash, p);
  }
  async lerProcedencia(hash: Sha256): Promise<Procedencia | null> {
    return this.registros.get(hash) ?? null;
  }
}

/** Manifesto resolvido minimo para os testes. */
function manifestoResolvido(opcoes: {
  readonly hashManifestoOriginal?: Sha256;
  readonly nos_midia?: Readonly<Record<string, Sha256>>;
  readonly nos_locucao?: Readonly<Record<string, Sha256>>;
  readonly nos_grafico?: Readonly<Record<string, Sha256>>;
  readonly nos_codigo?: Readonly<Record<string, Sha256>>;
  readonly nos_musica?: Readonly<Record<string, Sha256>>;
  readonly trilha_sonora?: Sha256 | null;
  readonly estagios?: ManifestoResolvido["estagios"];
}): ManifestoResolvido {
  const hashManifestoOriginal =
    opcoes.hashManifestoOriginal ?? sha256Hex("manifesto-original");
  return {
    schema_version: "ManifestoResolvido.1",
    hash_manifesto_original: hashManifestoOriginal,
    manifesto: {
      schema_version: "Manifesto.1",
      fps: 30,
      width: 1920,
      height: 1080,
      nos: [],
      cenas: [],
    },
    assets: {},
    nos_midia: opcoes.nos_midia ?? {},
    nos_locucao: opcoes.nos_locucao ?? {},
    nos_grafico: opcoes.nos_grafico ?? {},
    nos_codigo: opcoes.nos_codigo ?? {},
    nos_musica: opcoes.nos_musica ?? {},
    trilha_sonora: opcoes.trilha_sonora ?? null,
    estagios: opcoes.estagios ?? [],
  };
}

/** Grava um cassete minimo (os quatro arquivos obrigatorios) num tmp. */
async function gravarCassete(opcoes: {
  readonly raiz: string;
  readonly estagio: string;
  readonly chave: string;
  readonly assets: readonly {
    readonly hash: Sha256;
    readonly licenca: string;
    readonly atribuicaoObrigatoria: boolean;
    readonly atribuicao?: string;
    readonly provedor: string;
    readonly origem?: string;
  }[];
  readonly adquiridoEm?: string;
  readonly notas?: string;
}): Promise<string> {
  const dir = join(opcoes.raiz, opcoes.estagio, opcoes.chave);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "cassete.json"),
    JSON.stringify({
      chave: opcoes.chave,
      componentes: {
        hashManifesto: sha256Hex("manifesto"),
        nome: opcoes.estagio,
        parametros: {},
        versaoContrato: "1.0.0",
        versaoEstagio: "1.0.0",
      },
      formato: "1.0.0",
      quantidadeChamadas: 0,
    }),
    "utf-8",
  );
  const assets: Record<string, unknown> = {};
  const procedenciaAssets: unknown[] = [];
  for (const asset of opcoes.assets) {
    assets[asset.hash] = {
      hash: asset.hash,
      tipo: "audio",
      licenca: asset.licenca,
      atribuicaoObrigatoria: asset.atribuicaoObrigatoria,
      ...(asset.atribuicao !== undefined ? { atribuicao: asset.atribuicao } : {}),
      provedor: asset.provedor,
    };
    procedenciaAssets.push({
      hash: asset.hash,
      licenca: asset.licenca,
      atribuicaoObrigatoria: asset.atribuicaoObrigatoria,
      ...(asset.atribuicao !== undefined ? { atribuicao: asset.atribuicao } : {}),
      provedor: asset.provedor,
      ...(asset.origem !== undefined ? { origem: asset.origem } : {}),
    });
  }
  await writeFile(
    join(dir, "resultado.json"),
    JSON.stringify({ assets, nos_musica: {}, trilha_sonora: null }, null, 2),
    "utf-8",
  );
  await writeFile(
    join(dir, "procedencia.json"),
    JSON.stringify(
      {
        licenca: "CC0-1.0",
        provedor: "local",
        assets: procedenciaAssets,
        ...(opcoes.adquiridoEm !== undefined ? { adquiridoEm: opcoes.adquiridoEm } : {}),
        ...(opcoes.notas !== undefined ? { notas: opcoes.notas } : {}),
      },
      null,
      2,
    ),
    "utf-8",
  );
  await writeFile(
    join(dir, "volatil.json"),
    JSON.stringify({ gravadoEm: "2026-08-13T00:00:00.000Z", duracaoMs: 1 }),
    "utf-8",
  );
  return dir;
}

/** Diretorio temporario por teste. */
async function comTmp<T>(fn: (tmp: string) => Promise<T>): Promise<T> {
  const tmp = await mkdtemp(join(tmpdir(), "procedencia-teste-"));
  try {
    return await fn(tmp);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

const RELOGIO_FIXO = (): Date => new Date("2026-08-13T12:00:00.000Z");

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe("relatorio de procedencia — diretos", () => {
  it("registra a origem de um asset direto com licenca, provedor, data e termos", async () => {
    const hash = sha256Hex("asset-direto");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_midia: { "n-001": hash } }),
      {
        store: new StoreSintetico({
          [hash]: procedencia({
            license: "CC BY 4.0",
            attributionRequired: true,
            attribution: "Autor do asset",
            source: "pexels",
            acquiredAt: "2026-08-13T12:09:52.576Z",
            fetchedFrom: "https://pexels.com/photo/1",
            searchTerm: "diagrama",
          }),
        }),
      },
    );

    const entrada = relatorio.diretos.find((e) => e.hash === hash);
    expect(entrada).toBeDefined();
    expect(entrada?.origem?.licenca).toBe("CC BY 4.0");
    expect(entrada?.origem?.provedor).toBe("pexels");
    expect(entrada?.origem?.adquiridoEm).toBe("2026-08-13T12:09:52.576Z");
    expect(entrada?.origem?.atribuicao).toBe("Autor do asset");
    expect(entrada?.origem?.termoDeBusca).toBe("diagrama");
    expect(entrada?.origem?.origem).toBe("https://pexels.com/photo/1");
    expect(entrada?.fonteDaOrigem).toBe("store");
    expect(entrada?.semData).toBe(false);
    expect(relatorio.semOrigem).toHaveLength(0);
  });

  it("papel do mapa e o tipo do asset no video (presenca per-item)", async () => {
    const midia = sha256Hex("m");
    const locucao = sha256Hex("l");
    const trilha = sha256Hex("t");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({
        nos_midia: { "n-001": midia },
        nos_locucao: { "c-001": locucao },
        trilha_sonora: trilha,
      }),
      {
        store: new StoreSintetico({
          [midia]: procedencia(),
          [locucao]: procedencia(),
          [trilha]: procedencia(),
        }),
      },
    );

    expect(relatorio.diretos.find((e) => e.hash === midia)?.papeis).toContain("midia");
    expect(relatorio.diretos.find((e) => e.hash === locucao)?.papeis).toContain("locucao");
    expect(relatorio.diretos.find((e) => e.hash === trilha)?.papeis).toContain("trilha-sonora");
  });
});

describe("relatorio de procedencia — ∅-crit (origem nao declarada bloqueia)", () => {
  it("hash do video final sem registro nenhum entra em semOrigem", async () => {
    const hash = sha256Hex("sem-registro");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_midia: { "n-001": hash } }),
      { store: new StoreSintetico({}) },
    );

    const falta = relatorio.semOrigem.find((f) => f.hash === hash);
    expect(falta).toBeDefined();
    expect(falta?.motivo).toMatch(/sem registro/);
    const entrada = relatorio.diretos.find((e) => e.hash === hash);
    expect(entrada?.origem).toBeNull();
    expect(entrada?.fonteDaOrigem).toBe("ausente");
  });

  it("registro com licenca vazia entra em semOrigem", async () => {
    const hash = sha256Hex("licenca-vazia");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_midia: { "n-001": hash } }),
      { store: new StoreSintetico({ [hash]: procedencia({ license: "" }) }) },
    );

    const falta = relatorio.semOrigem.find((f) => f.hash === hash);
    expect(falta).toBeDefined();
    expect(falta?.motivo).toMatch(/licenca/);
  });

  it("registro com provedor vazio entra em semOrigem", async () => {
    const hash = sha256Hex("provedor-vazio");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_midia: { "n-001": hash } }),
      {
        store: new StoreSintetico({
          [hash]: procedencia({ source: "" as Procedencia["source"] }),
        }),
      },
    );

    expect(relatorio.semOrigem.some((f) => f.hash === hash)).toBe(true);
  });
});

describe("relatorio de procedencia — transitivos dentro de cassete", () => {
  it("o que entrou DENTRO do cassete aparece como transitivo com origem", async () => {
    await comTmp(async (tmp) => {
      const direto = sha256Hex("asset-referenciado");
      const dentro = sha256Hex("asset-dentro-do-cassete");
      const chave = sha256Hex("chave-cassete");
      await gravarCassete({
        raiz: tmp,
        estagio: "musica",
        chave,
        adquiridoEm: "2026-08-13T12:09:52.576Z",
        assets: [
          {
            hash: direto,
            licenca: "CC0-1.0",
            atribuicaoObrigatoria: false,
            provedor: "local",
          },
          {
            hash: dentro,
            licenca: "CC BY 3.0",
            atribuicaoObrigatoria: true,
            atribuicao: "Autor — CC BY 3.0",
            provedor: "wikimedia-commons",
            origem: "https://commons.wikimedia.org/wiki/File:X.ogg",
          },
        ],
      });

      const relatorio = await gerarRelatorio(
        manifestoResolvido({
          trilha_sonora: direto,
          estagios: [{ estagio: "musica", versaoEstagio: "1.0.0", chave, origem: "cassete" }],
        }),
        { raizCassetes: tmp, relogio: RELOGIO_FIXO },
      );

      const entradaDireta = relatorio.diretos.find((e) => e.hash === direto);
      expect(entradaDireta?.origem?.licenca).toBe("CC0-1.0");
      expect(entradaDireta?.fonteDaOrigem).toBe("cassete");

      const entradaTransitiva = relatorio.transitivos.find((e) => e.hash === dentro);
      expect(entradaTransitiva).toBeDefined();
      expect(entradaTransitiva?.transitivo).toBe(true);
      expect(entradaTransitiva?.papeis).toContain("cassete-musica");
      expect(entradaTransitiva?.origem?.licenca).toBe("CC BY 3.0");
      expect(entradaTransitiva?.origem?.atribuicao).toBe("Autor — CC BY 3.0");
      expect(entradaTransitiva?.origem?.adquiridoEm).toBe("2026-08-13T12:09:52.576Z");
      expect(entradaTransitiva?.origem?.origem).toContain("commons.wikimedia.org");
    });
  });

  it("cassete com asset sem licenca bloqueia pelo ∅-crit da W4 (cassete ilegivel)", async () => {
    await comTmp(async (tmp) => {
      const dentro = sha256Hex("asset-sem-licenca");
      const chave = sha256Hex("chave");
      await gravarCassete({
        raiz: tmp,
        estagio: "musica",
        chave,
        assets: [
          {
            hash: dentro,
            licenca: "",
            atribuicaoObrigatoria: false,
            provedor: "local",
          },
        ],
      });

      const relatorio = await gerarRelatorio(
        manifestoResolvido({
          estagios: [{ estagio: "musica", versaoEstagio: "1.0.0", chave, origem: "cassete" }],
        }),
        { raizCassetes: tmp, relogio: RELOGIO_FIXO },
      );

      // A guarda da W4 (lerCassete/validarProcedencia) ja rejeita o
      // cassete inteiro — o relatorio nao silencia a rejeicao: bloqueia
      // no nivel do cassete, nomeando o estagio (nunca pula em silencio).
      const falta = relatorio.semOrigem.find((f) => f.hash.startsWith("cassete:"));
      expect(falta).toBeDefined();
      expect(falta?.papel).toBe("cassete-musica");
      expect(falta?.motivo).toMatch(/cassete ilegivel|LICENCA/);
    });
  });
});

describe("relatorio de procedencia — emenda (C3): origem dos bytes emendados", () => {
  it("a derivacao declara audio-fonte + operacao, e a fonte entra como transitiva", async () => {
    const audioFonte = sha256Hex("audio-fonte");
    const emenda = sha256Hex("emenda");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_locucao: { "c-001": emenda } }),
      {
        store: new StoreSintetico({
          [emenda]: procedencia({
            notes: `${MARCADOR_DERIVACAO}${audioFonte}; operacao=emenda de locucao v1.0.0`,
          }),
          [audioFonte]: procedencia({
            license: "CC0-1.0",
            attributionRequired: true,
            attribution: "Audio sintetico de referencia — nao e voz humana",
            source: "local",
          }),
        }),
      },
    );

    const entradaDaEmenda = relatorio.diretos.find((e) => e.hash === emenda);
    expect(entradaDaEmenda?.derivadoDe?.hash).toBe(audioFonte);
    expect(entradaDaEmenda?.derivadoDe?.operacao).toBe("emenda de locucao v1.0.0");

    const fonte = relatorio.transitivos.find((e) => e.hash === audioFonte);
    expect(fonte).toBeDefined();
    expect(fonte?.papeis).toContain("emenda");
    expect(fonte?.origem?.licenca).toBe("CC0-1.0");
    expect(relatorio.semOrigem).toHaveLength(0);
  });

  it("emenda cujo audio-fonte nao tem origem declarada bloqueia", async () => {
    const audioFonte = sha256Hex("fonte-sumida");
    const emenda = sha256Hex("emenda");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_locucao: { "c-001": emenda } }),
      {
        store: new StoreSintetico({
          [emenda]: procedencia({ notes: `${MARCADOR_DERIVACAO}${audioFonte}` }),
        }),
      },
    );

    const falta = relatorio.semOrigem.find((f) => f.hash === emenda);
    expect(falta).toBeDefined();
    expect(falta?.motivo).toMatch(/audio-fonte/);
  });

  it("cadeia de derivacao com 2 saltos e coberta ate a origem", async () => {
    const origem = sha256Hex("origem-verdadeira");
    const intermediaria = sha256Hex("emenda-1");
    const final = sha256Hex("emenda-2");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_locucao: { "c-001": final } }),
      {
        store: new StoreSintetico({
          [final]: procedencia({ notes: `${MARCADOR_DERIVACAO}${intermediaria}` }),
          [intermediaria]: procedencia({ notes: `${MARCADOR_DERIVACAO}${origem}` }),
          [origem]: procedencia(),
        }),
      },
    );

    expect(relatorio.diretos.find((e) => e.hash === final)?.derivadoDe?.hash).toBe(
      intermediaria,
    );
    const intermediariaNoRelatorio = relatorio.transitivos.find(
      (e) => e.hash === intermediaria,
    );
    expect(intermediariaNoRelatorio?.derivadoDe?.hash).toBe(origem);
    expect(relatorio.transitivos.find((e) => e.hash === origem)?.origem?.licenca).toBe(
      "CC0-1.0",
    );
    expect(relatorio.semOrigem).toHaveLength(0);
  });

  it("cadeia de derivacao ciclica bloqueia com motivo nomeado", async () => {
    const a = sha256Hex("a");
    const b = sha256Hex("b");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_locucao: { "c-001": a } }),
      {
        store: new StoreSintetico({
          [a]: procedencia({ notes: `${MARCADOR_DERIVACAO}${b}` }),
          [b]: procedencia({ notes: `${MARCADOR_DERIVACAO}${a}` }),
        }),
      },
    );

    const falta = relatorio.semOrigem.find((f) => f.hash === a);
    expect(falta).toBeDefined();
    expect(falta?.motivo).toMatch(/ciclica/);
  });
});

describe("relatorio de procedencia — data e termos", () => {
  it("data epoch (paraProcedenciaDoStore sem adquiridoEm) vira gap, nao bloqueio", async () => {
    const hash = sha256Hex("epoch");
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ nos_midia: { "n-001": hash } }),
      {
        store: new StoreSintetico({
          [hash]: procedencia({ acquiredAt: "1970-01-01T00:00:00.000Z" }),
        }),
      },
    );

    expect(relatorio.semOrigem).toHaveLength(0);
    const gap = relatorio.gapsDeData.find((g) => g.hash === hash);
    expect(gap).toBeDefined();
    expect(relatorio.diretos.find((e) => e.hash === hash)?.semData).toBe(true);
  });

  it("data ausente no cassete vira gap reportado", async () => {
    await comTmp(async (tmp) => {
      const hash = sha256Hex("sem-data");
      const chave = sha256Hex("chave");
      await gravarCassete({
        raiz: tmp,
        estagio: "musica",
        chave,
        assets: [
          { hash, licenca: "CC0-1.0", atribuicaoObrigatoria: false, provedor: "local" },
        ],
      });

      const relatorio = await gerarRelatorio(
        manifestoResolvido({
          estagios: [{ estagio: "musica", versaoEstagio: "1.0.0", chave, origem: "cassete" }],
        }),
        { raizCassetes: tmp, relogio: RELOGIO_FIXO },
      );

      expect(relatorio.gapsDeData.some((g) => g.hash === hash)).toBe(true);
      expect(relatorio.semOrigem.some((f) => f.hash === hash)).toBe(false);
    });
  });
});

describe("relatorio de procedencia — manifesto (autoria)", () => {
  it("a origem do texto do manifesto e casada pelo hash do manifesto original", async () => {
    await comTmp(async (tmp) => {
      const hashManifesto = sha256Hex("manifesto-original");
      const chave = sha256Hex("chave-autoria");
      const dir = join(tmp, "autoria", chave);
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(dir, "cassete.json"),
        JSON.stringify({
          chave,
          componentes: { hashManifesto, nome: "autoria", parametros: {} },
          formato: "1.0.0",
          quantidadeChamadas: 1,
        }),
        "utf-8",
      );
      await writeFile(
        join(dir, "procedencia.json"),
        JSON.stringify({
          licenca: "Termos de uso do provedor de modelo (uso pessoal — ADR-0003)",
          provedor: "openai",
          assets: [],
          notas: "Texto gerado por modelo; o projeto nao o redistribui.",
        }),
        "utf-8",
      );

      const relatorio = await gerarRelatorio(
        manifestoResolvido({ hashManifestoOriginal: hashManifesto }),
        { raizCassetes: tmp, relogio: RELOGIO_FIXO },
      );

      expect(relatorio.manifesto.origem.origens).toHaveLength(1);
      expect(relatorio.manifesto.origem.origens[0]?.licenca).toContain("ADR-0003");
      expect(relatorio.manifesto.origem.origens[0]?.provedor).toBe("openai");
      expect(relatorio.manifesto.origem.fonteDaOrigem).toBe("cassete");
    });
  });

  it("sem cassete de autoria casado, o motivo e reportado sem bloquear", async () => {
    const relatorio = await gerarRelatorio(
      manifestoResolvido({ hashManifestoOriginal: sha256Hex("sem-cassete") }),
      { store: new StoreSintetico({}), relogio: RELOGIO_FIXO },
    );

    expect(relatorio.manifesto.origem.origens).toHaveLength(0);
    expect(relatorio.manifesto.origem.fonteDaOrigem).toBe("ausente");
    expect(relatorio.manifesto.origem.motivo).toMatch(/nenhum cassete de autoria/);
  });
});

describe("relatorio de procedencia — determinismo (C9) e enquadramento", () => {
  it("duas geracoes com relogios diferentes diferem SO em geradoEm", async () => {
    const hash = sha256Hex("asset");
    const base = manifestoResolvido({
      nos_midia: { "n-001": hash },
      hashManifestoOriginal: sha256Hex("manifesto"),
    });

    const a = await gerarRelatorio(base, {
      store: new StoreSintetico({ [hash]: procedencia() }),
      relogio: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    const b = await gerarRelatorio(base, {
      store: new StoreSintetico({ [hash]: procedencia() }),
      relogio: () => new Date("2026-12-31T23:59:59.000Z"),
    });

    const jsonA = JSON.parse(serializarRelatorio(a)) as Record<string, unknown>;
    const jsonB = JSON.parse(serializarRelatorio(b)) as Record<string, unknown>;
    delete jsonA["geradoEm"];
    delete jsonB["geradoEm"];
    expect(JSON.stringify(jsonA)).toBe(JSON.stringify(jsonB));

    const c = await gerarRelatorio(base, {
      store: new StoreSintetico({ [hash]: procedencia() }),
      relogio: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(serializarRelatorio(a)).toBe(serializarRelatorio(c));
  });

  it("declara o enquadramento de uso pessoal e AB-950 continua fechado", async () => {
    const relatorio = await gerarRelatorio(
      manifestoResolvido({}),
      { store: new StoreSintetico({}), relogio: RELOGIO_FIXO },
    );

    expect(relatorio.enquadramento.uso).toBe("pessoal");
    expect(relatorio.enquadramento.adr).toBe("ADR-0003");
    expect(relatorio.enquadramento.ab950).toBe("AB-950 continua fechado");
  });

  it("o store real (F0-07) e leitavel pelo relatorio (contrato de consumo)", async () => {
    await comTmp(async (tmp) => {
      const store = new Store({ root: join(tmp, "store") });
      const hash = sha256Hex("bytes");
      await store.put(Buffer.from("bytes"), procedencia({ license: "MIT" }));

      const relatorio = await gerarRelatorio(
        manifestoResolvido({ nos_midia: { "n-001": hash } }),
        { store: adaptarStore(store), relogio: RELOGIO_FIXO },
      );

      expect(relatorio.diretos.find((e) => e.hash === hash)?.origem?.licenca).toBe("MIT");
      expect(relatorio.diretos.find((e) => e.hash === hash)?.fonteDaOrigem).toBe("store");
    });
  });
});
