/**
 * tests/resolucao/cassete.test.ts
 *
 * O cassete: gravacao, reproducao, diff e as invariantes que os cinco
 * cards da W4 herdam.
 *
 * O que este arquivo prova:
 *   - o layout do cassete e o documentado (arquivos obrigatorios);
 *   - `licenca` ausente impede a gravacao — nao vira aviso (∅-crit W4);
 *   - credencial em header, URL ou corpo nao chega ao disco;
 *   - regravar produz bytes identicos, exceto os volateis DECLARADOS;
 *   - o diff nao e cego: mutar um byte do resultado o deixa vermelho;
 *   - o replay e sosia: mesma resposta, mesma ordem, sem rede.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ARQUIVOS_OBRIGATORIOS,
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  ARQUIVO_VOLATIL,
  CAMPOS_VOLATEIS,
  ECasseteAusente,
  ECasseteInvalido,
  VALOR_REDIGIDO,
  paraProcedenciaDoStore,
  procurarCredencial,
  sanitizarHeaders,
  sanitizarUrl,
  serializarCanonico,
  validarProcedencia,
} from "src/resolucao/cassete/formato.js";
import type {
  ProcedenciaCassete,
} from "src/resolucao/cassete/formato.js";
import {
  GravadorDeChamadas,
  gravarCassete,
} from "src/resolucao/cassete/gravador.js";
import {
  EChamadaNaoGravada,
  criarFetchDeCassete,
  lerCassete,
} from "src/resolucao/cassete/reprodutor.js";
import { diffCassetes, ehVolatil, formatarDiff } from "src/resolucao/cassete/diff.js";
import type {
  EntradaEstagio,
  EstagioResolucao,
  SaidaEstagio,
} from "src/resolucao/contrato.js";
import type { Manifesto } from "src/contratos/manifesto.js";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function manifesto(): Manifesto {
  return {
    schema_version: "Manifesto.1",
    fps: 30,
    width: 1920,
    height: 1080,
    nos: [
      {
        id: "n-001",
        schema: "Cabecalho.1",
        type: "cabecalho",
        duracao_frames: 60,
        texto: "Cassete",
      },
    ],
    cenas: [{ id: "c-001", nos: ["n-001"] }],
  };
}

const HASH_A = "a".repeat(64);

function procedenciaOk(): ProcedenciaCassete {
  return {
    licenca: "CC0-1.0",
    provedor: "teste",
    assets: [
      {
        hash: HASH_A,
        licenca: "CC0-1.0",
        atribuicaoObrigatoria: false,
        provedor: "teste",
      },
    ],
  };
}

/** Estagio deterministico: mesma entrada, mesmos bytes de saida. */
function estagioDeterministico(
  procedencia: ProcedenciaCassete = procedenciaOk(),
): EstagioResolucao {
  return {
    identidade: { nome: "locucao", versao: "1.0.0" },
    parametros: { voz: "alloy" },
    async resolver(): Promise<SaidaEstagio> {
      return {
        parcial: {
          assets: {
            [HASH_A]: {
              hash: HASH_A,
              tipo: "audio",
              licenca: "CC0-1.0",
              atribuicaoObrigatoria: false,
              provedor: "teste",
            },
          },
          nos_locucao: { "n-001": HASH_A },
        },
        procedencia,
      };
    },
  };
}

/** Estagio que faz chamadas HTTP atraves de `entrada.fetch`. */
function estagioComChamadas(respostas: Record<string, string>): EstagioResolucao {
  return {
    identidade: { nome: "midia", versao: "1.0.0" },
    parametros: { provedor: "falso" },
    async resolver(entrada: EntradaEstagio): Promise<SaidaEstagio> {
      for (const url of Object.keys(respostas).sort()) {
        await entrada.fetch(url, {
          headers: { authorization: "Bearer segredo-que-nao-pode-vazar-12345" },
        });
      }
      return {
        parcial: { assets: {}, nos_midia: {} },
        procedencia: { licenca: "CC0-1.0", provedor: "falso", assets: [] },
      };
    },
  };
}

/** `fetch` falso: nao toca a rede, devolve o que o mapa disser. */
function fetchFalso(respostas: Record<string, string>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : String(input);
    const corpo = respostas[url];
    if (corpo === undefined) throw new Error(`fetchFalso: sem resposta para ${url}`);
    return new Response(corpo, {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "fixo-1" },
    });
  }) as typeof fetch;
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

describe("Cassete — layout e gravacao", () => {
  let tmp: string;
  let raiz: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "cassete-"));
    raiz = join(tmp, "cassetes");
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("grava o diretorio no layout documentado", async () => {
    const { diretorio, chave } = await gravarCassete(estagioDeterministico(), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
    });
    expect(chave).toMatch(/^[0-9a-f]{64}$/);
    expect(diretorio).toBe(join(raiz, "locucao", chave));

    const arquivos = (await readdir(diretorio)).sort();
    for (const obrigatorio of ARQUIVOS_OBRIGATORIOS) {
      expect(arquivos).toContain(obrigatorio);
    }
  });

  it("o cabecalho carrega os componentes da chave, auditaveis a olho nu", async () => {
    const { diretorio } = await gravarCassete(estagioDeterministico(), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
    });
    const cabecalho = JSON.parse(
      await readFile(join(diretorio, ARQUIVO_CABECALHO), "utf-8"),
    );
    expect(cabecalho.componentes.versaoEstagio).toBe("1.0.0");
    expect(cabecalho.componentes.nome).toBe("locucao");
    expect(cabecalho.componentes.parametros).toEqual({ voz: "alloy" });
    expect(cabecalho.componentes.hashManifesto).toMatch(/^[0-9a-f]{64}$/);
  });

  it("os JSON gravados sao canonicos: chaves ordenadas", async () => {
    const { diretorio } = await gravarCassete(estagioDeterministico(), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
    });
    for (const arquivo of [ARQUIVO_CABECALHO, ARQUIVO_PROCEDENCIA]) {
      const texto = await readFile(join(diretorio, arquivo), "utf-8");
      const objeto = JSON.parse(texto);
      expect(texto).toBe(serializarCanonico(objeto));
      expect(texto.endsWith("\n")).toBe(true);
    }
  });

  // ─── ∅-crit da W4: licenca ───────────────────────────────────────────────

  it("∅-crit W4: sem licenca no topo, a gravacao falha antes de tocar o disco", async () => {
    const semLicenca = {
      provedor: "teste",
      assets: [],
    } as unknown as ProcedenciaCassete;

    await expect(
      gravarCassete(estagioDeterministico(semLicenca), {
        raiz,
        manifesto: manifesto(),
        diretorioTrabalho: tmp,
      }),
    ).rejects.toThrow(/licenca ausente ou vazia/);

    // Nada foi escrito: um cassete invalido no disco passaria no proximo
    // res:offline e a divida ficaria invisivel.
    await expect(readdir(raiz)).rejects.toThrow();
  });

  it("∅-crit W4: asset sem licenca tambem derruba a gravacao", async () => {
    const proc = {
      licenca: "CC0-1.0",
      provedor: "teste",
      assets: [{ hash: HASH_A, atribuicaoObrigatoria: false, provedor: "teste" }],
    } as unknown as ProcedenciaCassete;

    await expect(
      gravarCassete(estagioDeterministico(proc), {
        raiz,
        manifesto: manifesto(),
        diretorioTrabalho: tmp,
      }),
    ).rejects.toThrow(/assets\[0\]\.licenca ausente/);
  });

  it("licenca so com espaco em branco nao conta como licenca", () => {
    const problemas = validarProcedencia(
      { licenca: "   ", provedor: "x", assets: [] },
      "/tmp/x",
    );
    expect(problemas.map((p) => p.codigo)).toContain("LICENCA_AUSENTE");
  });

  it("todo procedencia.json gravado contem a string \"licenca\" (o rg da W4)", async () => {
    const { diretorio } = await gravarCassete(estagioDeterministico(), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
    });
    const texto = await readFile(join(diretorio, ARQUIVO_PROCEDENCIA), "utf-8");
    // Espelha `rg -L '"licenca"' fixtures/cassetes/<nome>/**/procedencia.json`
    expect(texto).toContain('"licenca"');
  });

  // ─── Credenciais ─────────────────────────────────────────────────────────

  it("headers sensiveis sao redigidos no cassete", async () => {
    const respostas = { "https://api.exemplo.test/a": '{"ok":true}' };
    const { diretorio } = await gravarCassete(estagioComChamadas(respostas), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
      fetchReal: fetchFalso(respostas),
    });
    const chamadas = JSON.parse(
      await readFile(join(diretorio, ARQUIVO_CHAMADAS), "utf-8"),
    );
    expect(chamadas[0].headersRequisicao.authorization).toBe(VALOR_REDIGIDO);
    const bruto = await readFile(join(diretorio, ARQUIVO_CHAMADAS), "utf-8");
    expect(bruto).not.toContain("segredo-que-nao-pode-vazar");
  });

  it("credencial na query string da URL e redigida", () => {
    expect(sanitizarUrl("https://a.test/x?api_key=sk-abc123&q=gato")).toBe(
      `https://a.test/x?api_key=${VALOR_REDIGIDO}&q=gato`,
    );
    expect(sanitizarUrl("https://user:senha@a.test/x")).toContain(VALOR_REDIGIDO);
  });

  it("credencial no CORPO da resposta derruba a gravacao", async () => {
    const respostas = {
      "https://api.exemplo.test/vaza": '{"token":"sk-ABCDEFGHIJKLMNOPQRSTUV"}',
    };
    await expect(
      gravarCassete(estagioComChamadas(respostas), {
        raiz,
        manifesto: manifesto(),
        diretorioTrabalho: tmp,
        fetchReal: fetchFalso(respostas),
      }),
    ).rejects.toThrow(/credencial detectada/);
  });

  it("o detector de credencial nao e vacuo", () => {
    expect(procurarCredencial("sk-ABCDEFGHIJKLMNOPQRSTUV").length).toBeGreaterThan(0);
    expect(procurarCredencial("AKIAIOSFODNN7EXAMPLE").length).toBeGreaterThan(0);
    expect(procurarCredencial("nada de segredo aqui")).toEqual([]);
  });

  it("sanitizarHeaders normaliza para minusculas e ordena", () => {
    const saida = sanitizarHeaders({ "X-Api-Key": "k", Accept: "json" });
    expect(Object.keys(saida)).toEqual(["accept", "x-api-key"]);
    expect(saida["x-api-key"]).toBe(VALOR_REDIGIDO);
    expect(saida["accept"]).toBe("json");
  });
});

// ─── Determinismo: regravar e diffar ───────────────────────────────────────────

describe("Cassete — regravar e diffar (a prova de determinismo)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "cassete-diff-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  async function gravarDuasVezes(): Promise<[string, string]> {
    const m = manifesto();
    const e = estagioDeterministico();
    const a = await gravarCassete(e, {
      raiz: join(tmp, "a"),
      manifesto: m,
      diretorioTrabalho: tmp,
      relogio: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    const b = await gravarCassete(e, {
      raiz: join(tmp, "b"),
      manifesto: m,
      diretorioTrabalho: tmp,
      relogio: () => new Date("2026-12-31T23:59:59.000Z"),
    });
    expect(a.chave).toBe(b.chave);
    return [a.diretorio, b.diretorio];
  }

  it("duas gravacoes do mesmo estagio: so o volatil declarado difere", async () => {
    const [a, b] = await gravarDuasVezes();
    const resultado = await diffCassetes(a, b);
    expect(resultado.refutacoes).toBe(0);
    expect(resultado.veredito).toBe("EXPLICADA");
    // A unica diferenca esta no arquivo volatil, e ela e reportada.
    for (const d of resultado.diferencas) {
      expect(d.arquivo).toBe(ARQUIVO_VOLATIL);
      expect(d.veredito).toBe("EXPLICADA");
    }
  });

  it("o diff compara a UNIAO dos arquivos: o denominador aparece", async () => {
    const [a, b] = await gravarDuasVezes();
    const resultado = await diffCassetes(a, b);
    expect(resultado.arquivosComparados).toEqual([
      ARQUIVO_CABECALHO,
      ARQUIVO_CHAMADAS,
      ARQUIVO_PROCEDENCIA,
      ARQUIVO_RESULTADO,
      ARQUIVO_VOLATIL,
    ]);
  });

  // ─── Sonda negativa do diff ──────────────────────────────────────────────

  it("SONDA: mutar um byte de resultado.json deixa o diff VERMELHO", async () => {
    const [a, b] = await gravarDuasVezes();
    const caminho = join(b, ARQUIVO_RESULTADO);
    const dados = JSON.parse(await readFile(caminho, "utf-8"));
    dados.nos_locucao["n-001"] = "b".repeat(64);
    await writeFile(caminho, serializarCanonico(dados), "utf-8");

    const resultado = await diffCassetes(a, b);
    expect(resultado.veredito).toBe("REFUTA");
    expect(resultado.refutacoes).toBeGreaterThan(0);
    expect(formatarDiff(resultado)).toContain("[REFUTA]");
  });

  it("SONDA: arquivo que some de um lado e refutacao, nao 'ignorado'", async () => {
    const [a, b] = await gravarDuasVezes();
    await rm(join(b, ARQUIVO_CHAMADAS));
    const resultado = await diffCassetes(a, b);
    expect(resultado.veredito).toBe("REFUTA");
    expect(
      resultado.diferencas.some((d) => d.arquivo === ARQUIVO_CHAMADAS),
    ).toBe(true);
  });

  it("SONDA: arquivo NOVO de um lado e refutacao (C3)", async () => {
    const [a, b] = await gravarDuasVezes();
    await writeFile(join(b, "extra.bin"), "surpresa");
    const resultado = await diffCassetes(a, b);
    expect(resultado.veredito).toBe("REFUTA");
  });

  it("SONDA: JSON logicamente igual mas com bytes diferentes refuta", async () => {
    const [a, b] = await gravarDuasVezes();
    const caminho = join(b, ARQUIVO_PROCEDENCIA);
    const dados = JSON.parse(await readFile(caminho, "utf-8"));
    await writeFile(caminho, JSON.stringify(dados, null, 4) + "\n", "utf-8");
    const resultado = await diffCassetes(a, b);
    expect(resultado.veredito).toBe("REFUTA");
    expect(
      resultado.diferencas.some((d) => d.detalhe.includes("nao-canonica")),
    ).toBe(true);
  });

  it("mudar procedencia.licenca refuta — nao esta na lista de volateis", async () => {
    const [a, b] = await gravarDuasVezes();
    const caminho = join(b, ARQUIVO_PROCEDENCIA);
    const dados = JSON.parse(await readFile(caminho, "utf-8"));
    dados.licenca = "Outra Licenca";
    await writeFile(caminho, serializarCanonico(dados), "utf-8");
    const resultado = await diffCassetes(a, b);
    expect(resultado.veredito).toBe("REFUTA");
  });

  it("mudar procedencia.adquiridoEm e EXPLICADA — esta na lista", async () => {
    const [a, b] = await gravarDuasVezes();
    for (const [dir, quando] of [
      [a, "2026-01-01T00:00:00.000Z"],
      [b, "2026-12-31T00:00:00.000Z"],
    ] as const) {
      const caminho = join(dir, ARQUIVO_PROCEDENCIA);
      const dados = JSON.parse(await readFile(caminho, "utf-8"));
      dados.adquiridoEm = quando;
      await writeFile(caminho, serializarCanonico(dados), "utf-8");
    }
    const resultado = await diffCassetes(a, b);
    expect(resultado.refutacoes).toBe(0);
    expect(
      resultado.diferencas.some(
        (d) => d.arquivo === ARQUIVO_PROCEDENCIA && d.veredito === "EXPLICADA",
      ),
    ).toBe(true);
  });

  it("a lista de volateis e curta e fechada", () => {
    // Cada entrada aqui e determinismo do qual abrimos mao. Se a lista
    // crescer, alguem tem de justificar cada linha num ADR.
    expect(CAMPOS_VOLATEIS.length).toBeLessThanOrEqual(3);
    expect(ehVolatil(ARQUIVO_VOLATIL, "gravadoEm")).toBe(true);
    expect(ehVolatil(ARQUIVO_PROCEDENCIA, "adquiridoEm")).toBe(true);
    expect(ehVolatil(ARQUIVO_PROCEDENCIA, "licenca")).toBe(false);
    expect(ehVolatil(ARQUIVO_RESULTADO, "assets")).toBe(false);
  });

  it("um cassete comparado consigo mesmo: veredito IDENTICO", async () => {
    // Invariante verdadeira e nao-floca: os mesmos bytes contra si mesmos.
    const a = await gravarCassete(estagioDeterministico(), {
      raiz: join(tmp, "x"),
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
      relogio: () => new Date("2026-06-15T12:00:00.000Z"),
    });
    const resultado = await diffCassetes(a.diretorio, a.diretorio);
    expect(resultado.veredito).toBe("IDENTICO");
    expect(resultado.diferencas).toEqual([]);
  });

  it("mesmo relogio: nenhuma refutacao, e o que sobra e so duracao", async () => {
    // Este teste ja foi escrito exigindo IDENTICO e flocava: mesmo com o
    // relogio congelado, `volatil.json` carrega `duracaoMs`, que e o tempo
    // real de execucao — as vezes 0 ms, as vezes 1 ms. A licao esta no
    // criterio certo: o que o determinismo exige e ZERO REFUTACOES, nao
    // byte-identidade de um arquivo que guarda duracao de proposito.
    const m = manifesto();
    const e = estagioDeterministico();
    const relogio = () => new Date("2026-06-15T12:00:00.000Z");
    const a = await gravarCassete(e, {
      raiz: join(tmp, "x"),
      manifesto: m,
      diretorioTrabalho: tmp,
      relogio,
    });
    const b = await gravarCassete(e, {
      raiz: join(tmp, "y"),
      manifesto: m,
      diretorioTrabalho: tmp,
      relogio,
    });
    const resultado = await diffCassetes(a.diretorio, b.diretorio);
    expect(resultado.refutacoes).toBe(0);
    // Toda diferenca que sobrar esta confinada ao arquivo volatil.
    for (const d of resultado.diferencas) {
      expect(d.arquivo).toBe(ARQUIVO_VOLATIL);
      expect(d.veredito).toBe("EXPLICADA");
    }
  });
});

// ─── Replay ────────────────────────────────────────────────────────────────────

describe("Cassete — reproducao offline", () => {
  let tmp: string;
  let raiz: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "cassete-replay-"));
    raiz = join(tmp, "cassetes");
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("o replay devolve a MESMA resposta, sem tocar a rede", async () => {
    const respostas = {
      "https://api.exemplo.test/a": '{"n":1}',
      "https://api.exemplo.test/b": '{"n":2}',
    };
    const { chave, diretorio } = await gravarCassete(
      estagioComChamadas(respostas),
      {
        raiz,
        manifesto: manifesto(),
        diretorioTrabalho: tmp,
        fetchReal: fetchFalso(respostas),
      },
    );

    const cassete = await lerCassete(raiz, "midia", chave);
    const fetchReplay = criarFetchDeCassete(cassete, diretorio);

    const a = await fetchReplay("https://api.exemplo.test/a");
    expect(a.status).toBe(200);
    expect(await a.json()).toEqual({ n: 1 });
    expect(a.headers.get("content-type")).toBe("application/json");

    const b = await fetchReplay("https://api.exemplo.test/b");
    expect(await b.json()).toEqual({ n: 2 });
  });

  it("chamada nao gravada lanca — nao ha fallback para a rede", async () => {
    const respostas = { "https://api.exemplo.test/a": '{"n":1}' };
    const { chave, diretorio } = await gravarCassete(
      estagioComChamadas(respostas),
      {
        raiz,
        manifesto: manifesto(),
        diretorioTrabalho: tmp,
        fetchReal: fetchFalso(respostas),
      },
    );
    const cassete = await lerCassete(raiz, "midia", chave);
    const fetchReplay = criarFetchDeCassete(cassete, diretorio);
    await expect(fetchReplay("https://api.exemplo.test/nunca-gravada")).rejects.toThrow(
      EChamadaNaoGravada,
    );
  });

  it("lerCassete de diretorio inexistente lanca ECasseteAusente", async () => {
    await expect(lerCassete(raiz, "locucao", "0".repeat(64))).rejects.toThrow(
      ECasseteAusente,
    );
  });

  it("cassete com formato incompativel e recusado", async () => {
    const { chave, diretorio } = await gravarCassete(estagioDeterministico(), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
    });
    const cabecalho = JSON.parse(
      await readFile(join(diretorio, ARQUIVO_CABECALHO), "utf-8"),
    );
    cabecalho.formato = "0.0.1";
    await writeFile(
      join(diretorio, ARQUIVO_CABECALHO),
      serializarCanonico(cabecalho),
      "utf-8",
    );
    await expect(lerCassete(raiz, "locucao", chave)).rejects.toThrow(
      ECasseteInvalido,
    );
  });

  it("cassete cuja procedencia perdeu a licenca e recusado na LEITURA tambem", async () => {
    const { chave, diretorio } = await gravarCassete(estagioDeterministico(), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
    });
    const proc = JSON.parse(
      await readFile(join(diretorio, ARQUIVO_PROCEDENCIA), "utf-8"),
    );
    delete proc.licenca;
    await writeFile(
      join(diretorio, ARQUIVO_PROCEDENCIA),
      serializarCanonico(proc),
      "utf-8",
    );
    await expect(lerCassete(raiz, "locucao", chave)).rejects.toThrow(
      /licenca ausente/,
    );
  });

  it("cassete movido a mao para outra chave e detectado", async () => {
    const { chave, diretorio } = await gravarCassete(estagioDeterministico(), {
      raiz,
      manifesto: manifesto(),
      diretorioTrabalho: tmp,
    });
    const outraChave = "9".repeat(64);
    const destino = join(raiz, "locucao", outraChave);
    await mkdir(destino, { recursive: true });
    for (const arquivo of ARQUIVOS_OBRIGATORIOS) {
      await writeFile(
        join(destino, arquivo),
        await readFile(join(diretorio, arquivo)),
      );
    }
    await expect(lerCassete(raiz, "locucao", outraChave)).rejects.toThrow(
      /diverge do diretorio/,
    );
    expect(chave).not.toBe(outraChave);
  });
});

// ─── Gravador de chamadas ──────────────────────────────────────────────────────

describe("GravadorDeChamadas", () => {
  it("grava metodo, status, hash e tamanho do corpo", async () => {
    const gravador = new GravadorDeChamadas(
      fetchFalso({ "https://x.test/a": "corpo" }),
    );
    await gravador.fetch("https://x.test/a");
    const [chamada] = gravador.gravadas;
    expect(chamada?.metodo).toBe("GET");
    expect(chamada?.status).toBe(200);
    expect(chamada?.bytesCorpo).toBe(5);
    expect(chamada?.hashCorpo).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deduplica corpos identicos por hash", async () => {
    const gravador = new GravadorDeChamadas(
      fetchFalso({ "https://x.test/a": "igual", "https://x.test/b": "igual" }),
    );
    await gravador.fetch("https://x.test/a");
    await gravador.fetch("https://x.test/b");
    expect(gravador.gravadas).toHaveLength(2);
    expect(gravador.corpos.size).toBe(1);
  });
});

// ─── Ponte com o store ─────────────────────────────────────────────────────────

describe("Ponte com o store (F0-07)", () => {
  it("paraProcedenciaDoStore traduz licenca -> license sem perder campo", () => {
    const cassete: ProcedenciaCassete = {
      licenca: "CC BY 4.0",
      provedor: "pexels",
      ferramenta: "curl 8.0",
      adquiridoEm: "2026-08-11T00:00:00.000Z",
      notas: "nota",
      assets: [],
    };
    const store = paraProcedenciaDoStore(
      {
        hash: HASH_A,
        licenca: "CC BY 4.0",
        atribuicaoObrigatoria: true,
        atribuicao: "Foto por Fulano",
        provedor: "pexels",
        idNoProvedor: "123",
        origem: "https://pexels.test/photo/123",
        termoDeBusca: "gato",
      },
      cassete,
    );
    expect(store.license).toBe("CC BY 4.0");
    expect(store.attributionRequired).toBe(true);
    expect(store.attribution).toBe("Foto por Fulano");
    expect(store.source).toBe("pexels");
    expect(store.sourceId).toBe("123");
    // A URL vive aqui, ACIMA da fronteira — nunca no manifesto resolvido.
    expect(store.fetchedFrom).toBe("https://pexels.test/photo/123");
    expect(store.acquiredAt).toBe("2026-08-11T00:00:00.000Z");
    expect(store.toolVersion).toBe("curl 8.0");
    expect(store.searchTerm).toBe("gato");
  });
});
