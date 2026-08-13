/**
 * tests/integracao/resolucao/vazio-crit.test.ts
 *
 * O ∅-crit do card F2-07 no nivel de INTEGRACAO: "um estagio novo SEM
 * CASSETE tem de derrubar a suite — nunca ser pulado em silencio."
 *
 * O criterio de F2-01 ja tem duas pernas (cobertura.ts com autoteste, e
 * sem-cassete.sh injetando um estagio de mentira em src/resolucao/).
 * Este arquivo e a terceira, no nivel que o orquestrador ve:
 *
 *   1. um estagio descoberto SEM cassete deixa a cobertura VERMELHA e a
 *      mensagem cita o ∅-crit E o nome do estagio;
 *   2. o orquestrador em modo offline LANCA ECasseteAusente para um
 *      estagio canonico sem cassete — nao "continua sem ele", nao vira
 *      aviso, nao vira skip;
 *   3. controle: o MESMO estagio COM cassete valido resolve em offline
 *      e a cobertura fica verde — a sonda negativa nao pode estar cega.
 *
 * Tudo em arvore temporaria: nada toca src/resolucao/ de verdade.
 *
 * Nome do estagio de mentira: CANONICO de proposito ("musica"). Um nome
 * fora da lista canonica nao chega ao orquestrador — ele o descarta em
 * silencio (ledger AB-502, caracterizacao); o ∅-crit de orquestrador so
 * prova algo com um nome que o orquestrador aceita.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, afterAll } from "vitest";
import { Orquestrador } from "src/resolucao/orquestrador.js";
import {
  ECasseteAusente,
  VERSAO_FORMATO_CASSETE,
  serializarCanonico,
} from "src/resolucao/cassete/formato.js";
import { verificarCobertura } from "src/resolucao/descoberta.js";
import {
  chaveDeCache,
  componentesDaChave,
  hashDoManifesto,
} from "src/resolucao/contrato.js";
import type { EstagioResolucao } from "src/resolucao/contrato.js";
import type { Manifesto } from "src/contratos/manifesto.js";
import { manifestoCanonico } from "./helpers.js";

const TMP = await mkdtemp(join(tmpdir(), "vazio-crit-"));

afterAll(async () => {
  await rm(TMP, { recursive: true, force: true });
});

/** Um estagio de mentira: se o orquestrador o INVOCASSE, ele lancaria. */
function estagioDeMentira(nome = "musica" as const): EstagioResolucao {
  return {
    identidade: { nome, versao: "1.0.0" },
    parametros: {},
    async resolver(): Promise<never> {
      throw new Error(
        "o estagio de mentira NAO pode ser invocado em modo offline — " +
          "isso seria a suite rodando o estagio em vez do cassete",
      );
    },
  };
}

/** Cria uma arvore temporaria com um estagio (e, opcionalmente, cassete). */
async function arvoreComEstagio(opcoes: {
  nome: string;
  comCassete?: boolean;
}): Promise<{ raizEstagios: string; raizCassetes: string; limpar: () => Promise<void> }> {
  const raiz = await mkdtemp(join(TMP, "arvore-"));
  const raizEstagios = join(raiz, "src", "resolucao");
  const raizCassetes = join(raiz, "fixtures", "cassetes");
  await mkdir(join(raizEstagios, opcoes.nome), { recursive: true });
  await writeFile(
    join(raizEstagios, opcoes.nome, "estagio.ts"),
    "export default {};\n",
    "utf-8",
  );
  if (opcoes.comCassete === true) {
    const estagio = estagioDeMentira(opcoes.nome as "musica");
    const manifesto = manifestoCanonico();
    const chave = chaveDeCache(
      componentesDaChave(estagio, hashDoManifesto(manifesto)),
    );
    const dirCassete = join(raizCassetes, opcoes.nome, chave);
    await mkdir(dirCassete, { recursive: true });
    await writeFile(
      join(dirCassete, "cassete.json"),
      serializarCanonico({
        formato: VERSAO_FORMATO_CASSETE,
        chave,
        componentes: componentesDaChave(estagio, hashDoManifesto(manifesto)),
        quantidadeChamadas: 0,
      }),
      "utf-8",
    );
    await writeFile(
      join(dirCassete, "resultado.json"),
      serializarCanonico({ assets: {}, nos_musica: { "n-000": "a".repeat(64) } }),
      "utf-8",
    );
    await writeFile(
      join(dirCassete, "procedencia.json"),
      serializarCanonico({ licenca: "CC0-1.0", provedor: "teste", assets: [] }),
      "utf-8",
    );
    await writeFile(
      join(dirCassete, "volatil.json"),
      serializarCanonico({
        gravadoEm: "2026-01-01T00:00:00.000Z",
        duracaoMs: 1,
        runtime: "teste",
      }),
      "utf-8",
    );
  }
  return {
    raizEstagios,
    raizCassetes,
    limpar: () => rm(raiz, { recursive: true, force: true }),
  };
}

describe("F2-07 — ∅-crit de integracao: estagio sem cassete derruba a suite", () => {
  it("a cobertura fica VERMELHA e cita o ∅-crit e o nome do estagio", async () => {
    const { raizEstagios, raizCassetes, limpar } = await arvoreComEstagio({
      nome: "mentira",
    });
    try {
      const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
      expect(relatorio.ok).toBe(false);
      const problemas = relatorio.cobertura.flatMap((c) => c.problemas).join("\n");
      expect(problemas).toContain("∅-crit");
      expect(problemas).toContain("mentira");
    } finally {
      await limpar();
    }
  });

  it("o orquestrador offline LANCA ECasseteAusente para estagio canonico sem cassete", async () => {
    const { raizEstagios, raizCassetes, limpar } = await arvoreComEstagio({
      nome: "musica",
    });
    try {
      const manifesto: Manifesto = manifestoCanonico();
      const orquestrador = new Orquestrador({
        estagios: [estagioDeMentira()],
        raizCassetes,
        modo: "offline",
      });
      const erro = await orquestrador.resolver(manifesto).then(
        () => null,
        (e: unknown) => e,
      );
      expect(erro).toBeInstanceOf(ECasseteAusente);
      expect(String(erro)).toContain("musica");
      expect(String(erro)).toContain("∅-crit");
    } finally {
      await limpar();
    }
  });

  it("controle: o MESMO estagio com cassete valido resolve e cobre (sonda nao-cega)", async () => {
    const { raizEstagios, raizCassetes, limpar } = await arvoreComEstagio({
      nome: "musica",
      comCassete: true,
    });
    try {
      const relatorio = await verificarCobertura({ raizEstagios, raizCassetes });
      expect(relatorio.ok).toBe(true);

      const manifesto: Manifesto = manifestoCanonico();
      const orquestrador = new Orquestrador({
        estagios: [estagioDeMentira()],
        raizCassetes,
        modo: "offline",
      });
      const { resolvido } = await orquestrador.resolver(manifesto);
      expect(resolvido.estagios[0]?.origem).toBe("cassete");
      expect(resolvido.estagios[0]?.estagio).toBe("musica");
    } finally {
      await limpar();
    }
  });
});
