/**
 * tests/integracao/resolucao/resolucao-integrada.test.ts
 *
 * A suite de integracao do card F2-07: os CINCO estagios da W4
 * (locucao, grafico, midia, codigo, musica) executados de verdade a
 * partir dos cassetes commitados, com o orquestrador F2-01 em modo
 * offline e a rede bloqueada pelo setup global do vitest.
 *
 * Perguntas adversariais que este arquivo responde:
 *
 *   (2) "Zero chamadas externas" tem denominador? — Sim: a suite EXECUTA
 *       os cinco estagios (nao os pula), exige contagem de chamadas
 *       gravadas > 0, exige que os assets dos cassetes rehasheiem para o
 *       SHA-256 declarado, e exige zero tentativas de saida DURANTE a
 *       execucao (delta de tentativasDeSaida()).
 *
 *   (AB-455) A ponte cassete->store existe? — A suite verifica o canal
 *       formal: enderecamento por SHA-256. Para cada asset de cada
 *       cassete, os bytes TEM de existir no cassete (corpos/<hash> ou
 *       artefatos/<hash>.json), rehasheiar para o endereco, e entrar e
 *       sair do store (F0-07) byte a byte. O cassete de GRAFICO foi a
 *       excecao medida na W4 (metadata-only, AB-501) — superada pela
 *       onda grafico-matematica (2026-08-14): a cerimonia de gravacao
 *       agora materializa os webm renderizados em corpos/<hash> com
 *       conferencia de SHA-256, e o teste abaixo exige os bytes 1:1.
 *
 * Assercoes per-item, nunca sobre listas fechadas (contrato-w5 §10): a
 * W4 gravou os cassetes contra TRES manifestos distintos (AB-500), e
 * esta suite resolve cada estagio contra o manifesto DELE.
 */

import { createHash } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterAll } from "vitest";
import { Store } from "src/store/store.js";
import { Orquestrador } from "src/resolucao/orquestrador.js";
import { ECasseteAusente } from "src/resolucao/cassete/formato.js";
import { lerCassete } from "src/resolucao/cassete/reprodutor.js";
import { fundirParciais, encontrarURLs } from "src/resolucao/manifesto-resolvido.js";
import type {
  AssetResolvido,
  ParcialComRegistro,
} from "src/resolucao/manifesto-resolvido.js";
import {
  descobrirEstagios,
  verificarCobertura,
} from "src/resolucao/descoberta.js";
import { tentativasDeSaida } from "src/resolucao/rede/bloqueio.js";
import {
  chaveDeCache,
  componentesDaChave,
  hashDoManifesto,
} from "src/resolucao/contrato.js";
import type { EstagioResolucao, NomeEstagio } from "src/resolucao/contrato.js";
import estagioLocucao from "src/resolucao/locucao/estagio.js";
import estagioGrafico from "src/resolucao/grafico/estagio.js";
import estagioMidia from "src/resolucao/midia/estagio.js";
import estagioCodigo from "src/resolucao/codigo/estagio.js";
import estagioMusica from "src/resolucao/musica/estagio.js";
import {
  CAMINHO_MANIFESTO_CANONICO,
  RAIZ,
  manifestoCanonico,
  manifestoDeGravacao,
  raizCassetesRelativa,
} from "./helpers.js";

const ESTAGIOS: Readonly<Record<NomeEstagio, EstagioResolucao>> = {
  locucao: estagioLocucao,
  grafico: estagioGrafico,
  midia: estagioMidia,
  codigo: estagioCodigo,
  musica: estagioMusica,
};

/** Todos os nomes canonicos: a lista fechada e do CONTRATO (contrato.ts). */
const NOMES = Object.keys(ESTAGIOS) as NomeEstagio[];

/** Diretorio temporario compartilhado pela suite (store de teste). */
const TMP = await mkdtemp(join(tmpdir(), "resolucao-integrada-"));
const storeDeTeste = new Store({ root: join(TMP, "store") });

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Le os bytes de um asset dentro do cassete, ou null se nao estao la. */
async function bytesDoAsset(
  nome: string,
  chave: string,
  hash: string,
): Promise<Buffer | null> {
  const candidatos = [
    join(RAIZ, raizCassetesRelativa(), nome, chave, "corpos", hash),
    join(RAIZ, raizCassetesRelativa(), nome, chave, "artefatos", `${hash}.json`),
  ];
  for (const caminho of candidatos) {
    try {
      return await readFile(caminho);
    } catch {
      // tenta o proximo
    }
  }
  return null;
}

/** Ponte formal: put no store (F0-07) e get devolve byte a byte. */
async function roundtripNoStore(
  cassete: Awaited<ReturnType<typeof lerCassete>>,
  hash: string,
  bytes: Buffer,
): Promise<void> {
  const asset = cassete.resultado.assets[hash];
  expect(asset, `asset ${hash.slice(0, 12)}… presente no resultado`).toBeDefined();
  const procedencia = cassete.procedencia.assets.find((a) => a.hash === hash);
  expect(procedencia, `procedencia de ${hash.slice(0, 12)}…`).toBeDefined();
  await storeDeTeste.put(bytes, {
    license: (asset as AssetResolvido).licenca,
    attributionRequired: (asset as AssetResolvido).atribuicaoObrigatoria,
    source: "local",
    acquiredAt: cassete.procedencia.adquiridoEm ?? new Date(0).toISOString(),
  });
  const deVolta = await storeDeTeste.get(hash);
  expect(deVolta).not.toBeNull();
  expect(Buffer.compare(deVolta as Buffer, bytes)).toBe(0);
}

// ---------------------------------------------------------------------------
// 1. Denominador: os cinco estagios no disco, todos cobertos por cassete
// ---------------------------------------------------------------------------

describe("F2-07 — denominador: estagios descobertos e cobertos", () => {
  it("cada estagio canonico existe no disco (presenca per-item)", async () => {
    const descobertos = await descobrirEstagios(join(RAIZ, "src/resolucao"));
    const nomes = new Set(descobertos.map((e) => e.nome));
    for (const nome of NOMES) {
      expect(nomes.has(nome), `estagio ${nome} descoberto em src/resolucao`).toBe(
        true,
      );
    }
  });

  it("todo estagio descoberto tem cassete valido (∅-crit de cobertura)", async () => {
    const relatorio = await verificarCobertura({
      raizCassetes: raizCassetesRelativa(),
    });
    expect(relatorio.ok).toBe(true);
    expect(relatorio.descobertos.length).toBeGreaterThan(0);
  });

  it("desde a Onda 3, midia grava contra a MESMA fixture canonica (AB-500 fechado)", () => {
    const hashes = NOMES.map((nome) => hashDoManifesto(manifestoDeGravacao(nome)));
    // O grafico mantem o manifesto DELE no codigo; os demais (locucao,
    // codigo, musica, midia) gravam contra a fixture canonica.
    expect(hashes).toContain(hashDoManifesto(manifestoDeGravacao("grafico")));
    expect(hashDoManifesto(manifestoDeGravacao("midia"))).toBe(
      hashDoManifesto(manifestoCanonico()),
    );
    expect(hashDoManifesto(manifestoDeGravacao("locucao"))).toBe(
      hashDoManifesto(manifestoCanonico()),
    );
    expect(hashes.filter((h) => h === hashDoManifesto(manifestoCanonico())).length)
      .toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// 2. Orquestrador offline contra os cassetes reais
// ---------------------------------------------------------------------------

describe("F2-07 — orquestrador offline com os estagios reais", () => {
  it("locucao + codigo + musica resolvem juntos contra a fixture canonica", async () => {
    const manifesto = manifestoDeGravacao("locucao");
    const antes = tentativasDeSaida().length;

    const orquestrador = new Orquestrador({
      estagios: [ESTAGIOS.locucao, ESTAGIOS.codigo, ESTAGIOS.musica],
      raizCassetes: raizCassetesRelativa(),
      modo: "offline",
    });
    const { resolvido, cassetes } = await orquestrador.resolver(manifesto);

    // Os tres participaram, na ordem canonica, todos vindos do cassete.
    expect(resolvido.estagios.map((e) => e.estagio)).toEqual([
      "locucao",
      "codigo",
      "musica",
    ]);
    for (const registro of resolvido.estagios) {
      expect(registro.origem).toBe("cassete");
    }
    expect(Object.keys(cassetes).sort()).toEqual(["codigo", "locucao", "musica"]);

    // Denominador por estagio: cada um produziu a SUA camada (presenca).
    expect(Object.keys(resolvido.nos_locucao).length).toBeGreaterThan(0);
    expect(Object.keys(resolvido.nos_codigo).length).toBeGreaterThan(0);
    expect(Object.keys(resolvido.nos_musica).length).toBeGreaterThan(0);
    expect(resolvido.trilha_sonora).not.toBeNull();

    // Zero chamadas externas DURANTE a reproducao — com denominador: os
    // estagios rodaram de verdade (ver rehash em 4).
    expect(tentativasDeSaida().length).toBe(antes);

    // C7: nada de URL abaixo da fronteira.
    expect(encontrarURLs(resolvido)).toEqual([]);
  });

  it("grafico resolve sozinho contra o manifesto DELE (AB-500)", async () => {
    const manifesto = manifestoDeGravacao("grafico");
    const orquestrador = new Orquestrador({
      estagios: [ESTAGIOS.grafico],
      raizCassetes: raizCassetesRelativa(),
      modo: "offline",
    });
    const { resolvido } = await orquestrador.resolverEstagio("grafico", manifesto);

    expect(resolvido.estagios[0]?.origem).toBe("cassete");
    expect(resolvido.nos_grafico["g-001"]).toMatch(/^[0-9a-f]{64}$/);
    expect(resolvido.nos_grafico["g-002"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("midia resolve sozinho contra a fixture canonica (Onda 3 — AB-500 fechado)", async () => {
    const manifesto = manifestoDeGravacao("midia");
    const orquestrador = new Orquestrador({
      estagios: [ESTAGIOS.midia],
      raizCassetes: raizCassetesRelativa(),
      modo: "offline",
    });
    const { resolvido } = await orquestrador.resolverEstagio("midia", manifesto);

    expect(resolvido.estagios[0]?.origem).toBe("cassete");
    expect(Object.keys(resolvido.nos_midia).sort()).toEqual([
      "n-005",
      "n-006",
      "n-007",
    ]);
    expect(Object.keys(resolvido.assets).length).toBe(3);
  });

  it("manifesto errado e cache miss barulhento, nunca resultado velho (C12)", async () => {
    const manifesto = manifestoDeGravacao("grafico"); // valido, mas nao o do midia
    const orquestrador = new Orquestrador({
      estagios: [ESTAGIOS.midia],
      raizCassetes: raizCassetesRelativa(),
      modo: "offline",
    });
    const erro = await orquestrador
      .resolverEstagio("midia", manifesto)
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(erro).toBeInstanceOf(ECasseteAusente);
  });
});

// ---------------------------------------------------------------------------
// 3. Merge integrado: as parciais dos cinco estagios num manifesto so
// ---------------------------------------------------------------------------

describe("F2-07 — fundirParciais integrado com as cinco camadas", () => {
  it("as cinco parciais fundem sem colisao e sem URL", async () => {
    const manifesto = manifestoDeGravacao("locucao");
    const hash = hashDoManifesto(manifesto);
    const entradas: ParcialComRegistro[] = [];

    for (const nome of NOMES) {
      const estagio = ESTAGIOS[nome];
      const chave = chaveDeCache(
        componentesDaChave(estagio, hashDoManifesto(manifestoDeGravacao(nome))),
      );
      const cassete = await lerCassete(
        raizCassetesRelativa(),
        nome,
        chave,
      );
      entradas.push({
        registro: {
          estagio: nome,
          versaoEstagio: estagio.identidade.versao,
          chave,
          origem: "cassete",
        },
        parcial: cassete.resultado,
      });
    }

    // Sem colisao: fundir nao pode lancar EColisaoDeMerge.
    const fundido = fundirParciais(manifesto, hash, entradas);

    // Os cinco participaram — presenca per-item (contrato-w5 §10: nunca
    // asserte a lista completa de estagios; asserte que o seu item esta la).
    const nomesNoMerge = new Set(fundido.estagios.map((e) => e.estagio));
    for (const nome of NOMES) {
      expect(nomesNoMerge.has(nome), `registro de ${nome} no merge integrado`).toBe(
        true,
      );
    }
    expect(Object.keys(fundido.nos_locucao).length).toBeGreaterThan(0);
    expect(Object.keys(fundido.nos_grafico).length).toBeGreaterThan(0);
    expect(Object.keys(fundido.nos_midia).length).toBeGreaterThan(0);
    expect(Object.keys(fundido.nos_codigo).length).toBeGreaterThan(0);
    expect(Object.keys(fundido.nos_musica).length).toBeGreaterThan(0);
    expect(fundido.trilha_sonora).not.toBeNull();
    expect(encontrarURLs(fundido)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. AB-455: a ponte cassete->store, enderecada por SHA-256
// ---------------------------------------------------------------------------

describe("F2-07 — ponte cassete->store (AB-455)", () => {
  /**
   * O canal formal: para cada asset do cassete, os bytes TEM de existir
   * no cassete (corpos/<hash> ou artefatos/<hash>.json), rehasheiar para
   * o endereco, e entrar e sair do store (F0-07) byte a byte.
   */
  it("todo asset de midia e musica tem os bytes no cassete e entra no store", async () => {
    for (const nome of ["midia", "musica"] as const) {
      const estagio = ESTAGIOS[nome];
      const chave = chaveDeCache(
        componentesDaChave(estagio, hashDoManifesto(manifestoDeGravacao(nome))),
      );
      const cassete = await lerCassete(raizCassetesRelativa(), nome, chave);
      const hashes = Object.keys(cassete.resultado.assets);
      expect(hashes.length, `cassete ${nome} tem assets (denominador)`).toBeGreaterThan(0);

      for (const hash of hashes) {
        const bytes = await bytesDoAsset(nome, chave, hash);
        expect(bytes, `bytes de ${nome}/${hash.slice(0, 12)}… no cassete`).not.toBeNull();
        expect(
          sha256Hex(bytes as Buffer),
          `bytes de ${nome}/${hash.slice(0, 12)}… rehasheiam para o endereco`,
        ).toBe(hash);
        await roundtripNoStore(cassete, hash, bytes as Buffer);
      }
    }
  });

  it("os artefatos computados de CODIGO estao em artefatos/<hash>.json e entram no store", async () => {
    const nome = "codigo";
    const estagio = ESTAGIOS[nome];
    const chave = chaveDeCache(
      componentesDaChave(estagio, hashDoManifesto(manifestoDeGravacao(nome))),
    );
    const cassete = await lerCassete(raizCassetesRelativa(), nome, chave);
    const hashes = Object.keys(cassete.resultado.assets);
    expect(hashes.length).toBeGreaterThan(0);

    for (const hash of hashes) {
      const bytes = await readFile(
        join(RAIZ, raizCassetesRelativa(), nome, chave, "artefatos", `${hash}.json`),
      );
      expect(sha256Hex(bytes)).toBe(hash);
      await roundtripNoStore(cassete, hash, bytes);
    }
  });

  it("os AUDIOS de LOCUCAO tem bytes no cassete; os timings computados nao (AB-503)", async () => {
    const nome = "locucao";
    const estagio = ESTAGIOS[nome];
    const chave = chaveDeCache(
      componentesDaChave(estagio, hashDoManifesto(manifestoDeGravacao(nome))),
    );
    const cassete = await lerCassete(raizCassetesRelativa(), nome, chave);

    const audio = Object.entries(cassete.resultado.assets).filter(
      ([, a]) => a.tipo === "audio",
    );
    const timing = Object.entries(cassete.resultado.assets).filter(
      ([, a]) => a.tipo === "dados",
    );
    expect(audio.length).toBeGreaterThan(0);
    expect(timing.length).toBeGreaterThan(0);

    // Os audios (respostas do provedor) tem bytes e entram no store.
    for (const [hash, ] of audio) {
      const bytes = await bytesDoAsset(nome, chave, hash);
      expect(bytes, `audio ${hash.slice(0, 12)}… tem bytes no cassete`).not.toBeNull();
      await roundtripNoStore(cassete, hash, bytes as Buffer);
    }

    // Os timings (computados pelo estagio, nao baixados) NAO tem bytes
    // commitados — caracterizacao per-item, registrada em AB-503. Nao e
    // conserto (o estagio e de outro card): e o buraco que a ponte
    // cassete->store tem de fechar (ou codigo segue o exemplo, ou o
    // gravador passa a persistir artefatos computados).
    for (const [hash] of timing) {
      const bytes = await bytesDoAsset(nome, chave, hash);
      expect(bytes, `timing ${hash.slice(0, 12)}… NAO tem bytes (AB-503)`).toBeNull();
    }
  });

  it("o cassete de GRAFICO tem bytes commitados que rehasheiam 1:1 (AB-501 superado)", async () => {
    // A caracterizacao "metadata-only" (AB-501) foi superada pela onda
    // grafico-matematica (2026-08-14): `gravar.ts` agora materializa os
    // webm renderizados em corpos/<hash> do cassete, conferindo o
    // SHA-256 antes de copiar — bytes divergentes nunca entram (regra de
    // sosia, D4/D5 do ADR-0009). Os bytes TEM de existir e rehasheiar
    // para o endereco declarado, como em qualquer outro estagio.
    const estagio = ESTAGIOS.grafico;
    const chave = chaveDeCache(
      componentesDaChave(estagio, hashDoManifesto(manifestoDeGravacao("grafico"))),
    );
    const cassete = await lerCassete(raizCassetesRelativa(), "grafico", chave);
    expect(Object.keys(cassete.resultado.assets).length).toBeGreaterThan(0);

    for (const hash of Object.keys(cassete.resultado.assets)) {
      const bytes = await bytesDoAsset("grafico", chave, hash);
      expect(
        bytes,
        `grafico/${hash.slice(0, 12)}… tem bytes no cassete (AB-501 superado)`,
      ).not.toBeNull();
      expect(sha256Hex(bytes as Buffer)).toBe(hash);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Q2: o denominador de chamadas gravadas (anti-vacuidade)
// ---------------------------------------------------------------------------

describe("F2-07 — denominador de chamadas gravadas (Q2)", () => {
  it("ha chamadas HTTP gravadas nos cassetes e os corpos rehasheiam", async () => {
    let totalChamadas = 0;
    for (const nome of NOMES) {
      const estagio = ESTAGIOS[nome];
      const chave = chaveDeCache(
        componentesDaChave(estagio, hashDoManifesto(manifestoDeGravacao(nome))),
      );
      const cassete = await lerCassete(raizCassetesRelativa(), nome, chave);
      totalChamadas += cassete.chamadas.length;
      for (const chamada of cassete.chamadas) {
        const corpo = await readFile(
          join(RAIZ, raizCassetesRelativa(), nome, chave, "corpos", chamada.hashCorpo),
        );
        expect(sha256Hex(corpo), `corpo de ${nome} chamada ${chamada.indice}`).toBe(
          chamada.hashCorpo,
        );
      }
    }
    expect(totalChamadas).toBeGreaterThan(0);
  });

  it("a fixture canonica e o manifesto que os cassetes de locucao/codigo/musica exigem", async () => {
    // Se o caminho do helper deixar de apontar para a fixture canonica,
    // o resolver vira cache miss — e este teste fica vermelho por
    // ECasseteAusente antes de qualquer assercao de conteudo.
    const manifesto = manifestoDeGravacao("locucao");
    const orquestrador = new Orquestrador({
      estagios: [ESTAGIOS.locucao],
      raizCassetes: raizCassetesRelativa(),
      modo: "offline",
    });
    const { resolvido } = await orquestrador.resolverEstagio("locucao", manifesto);
    expect(resolvido.estagios[0]?.origem).toBe("cassete");
    expect(resolvido.nos_locucao).toBeDefined();
    expect(CAMINHO_MANIFESTO_CANONICO).toContain("fixtures/canonico/manifesto-valido.json");
  });
});
