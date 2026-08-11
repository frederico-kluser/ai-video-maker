#!/usr/bin/env npx tsx
/**
 * tools/resolucao/regravar-e-diffar.ts
 *
 * `just res:cassete` — regrava um cassete e diffa.
 *
 * Criterio de aceitacao do card F2-01: "qualquer diferenca nao explicada
 * refuta o determinismo". Este script transforma isso em exit code.
 *
 * Tres fases, e a terceira e a que faz as duas primeiras valerem algo:
 *
 *   1. GRAVA duas vezes o mesmo estagio, com relogios DIFERENTES de
 *      proposito, em dois diretorios. Relogios iguais esconderiam o
 *      unico volatil que temos.
 *   2. DIFFA. Zero refutacoes = determinismo sustentado. As diferencas
 *      explicadas sao impressas uma a uma, com nome de arquivo e campo:
 *      "explicada" nao pode ser um adjetivo, tem de ser uma linha.
 *   3. SONDA NEGATIVA. Muta um byte de `resultado.json` e exige que o
 *      diff fique VERMELHO. Um diff que nunca reprovou nao e evidencia
 *      de nada — e a fase 2 verde sem a fase 3 e um verde vazio.
 *
 * Sem `--estagio`, roda contra o estagio de referencia
 * (`fixtures/resolucao/estagio-referencia/`), que e deterministico e nao
 * chama rede. Com `--estagio <nome>`, os cards da W4 apontam para o seu.
 *
 * Uso:
 *   npx tsx tools/resolucao/regravar-e-diffar.ts [--estagio <nome>]
 */

import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ARQUIVO_RESULTADO,
  serializarCanonico,
} from "../../src/resolucao/cassete/formato.js";
import { gravarCassete } from "../../src/resolucao/cassete/gravador.js";
import { diffCassetes, formatarDiff } from "../../src/resolucao/cassete/diff.js";
import type { EstagioResolucao } from "../../src/resolucao/contrato.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import estagioReferencia from "../../fixtures/resolucao/estagio-referencia/estagio.js";

const MANIFESTO: Manifesto = {
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
      texto: "Determinismo do cassete",
    },
    {
      id: "n-002",
      schema: "Texto.1",
      type: "texto",
      duracao_frames: 90,
      texto: "Regravar tem de reproduzir cada byte.",
    },
  ],
  cenas: [{ id: "c-001", nos: ["n-001", "n-002"] }],
};

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Carrega o estagio alvo: o de referencia, ou o de um card da W4. */
async function carregarEstagio(nome: string | undefined): Promise<{
  estagio: EstagioResolucao;
  rotulo: string;
}> {
  if (nome === undefined) {
    return {
      estagio: estagioReferencia,
      rotulo: "fixtures/resolucao/estagio-referencia (deterministico, sem rede)",
    };
  }
  const caminho = `../../src/resolucao/${nome}/estagio.js`;
  const modulo = (await import(caminho)) as { default?: EstagioResolucao };
  if (!modulo.default) {
    throw new Error(
      `src/resolucao/${nome}/estagio.ts nao tem 'export default'. ` +
        `Ver docs/contrato-estagio-resolucao.md.`,
    );
  }
  return { estagio: modulo.default, rotulo: `src/resolucao/${nome}/estagio.ts` };
}

async function main(): Promise<number> {
  const nome = argumento("--estagio");
  const { estagio, rotulo } = await carregarEstagio(nome);

  console.log("=== res:cassete — regravar e diffar ===");
  console.log(`Estagio: ${estagio.identidade.nome} v${estagio.identidade.versao}`);
  console.log(`Fonte:   ${rotulo}`);
  console.log("");

  const tmp = await mkdtemp(join(tmpdir(), "res-cassete-"));
  try {
    // ── 1. duas gravacoes, relogios diferentes ─────────────────────────────
    console.log("Fase 1 — gravando duas vezes (relogios propositalmente diferentes)");
    const a = await gravarCassete(estagio, {
      raiz: join(tmp, "gravacao-1"),
      manifesto: MANIFESTO,
      diretorioTrabalho: tmp,
      relogio: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    const b = await gravarCassete(estagio, {
      raiz: join(tmp, "gravacao-2"),
      manifesto: MANIFESTO,
      diretorioTrabalho: tmp,
      relogio: () => new Date("2026-12-31T23:59:59.000Z"),
    });

    if (a.chave !== b.chave) {
      console.log("");
      console.log(`  chave 1: ${a.chave}`);
      console.log(`  chave 2: ${b.chave}`);
      console.log("=== VERMELHO: a chave de cache mudou entre duas gravacoes ===");
      console.log("A chave depende de algo que nao esta nos componentes declarados.");
      return 1;
    }
    console.log(`  chave estavel: ${a.chave}`);
    console.log("");

    // ── 2. diff ────────────────────────────────────────────────────────────
    console.log("Fase 2 — diff das duas gravacoes");
    const resultado = await diffCassetes(a.diretorio, b.diretorio);
    console.log(formatarDiff(resultado));
    console.log("");

    if (resultado.refutacoes > 0) {
      console.log("=== VERMELHO: diferenca nao explicada entre duas gravacoes ===");
      console.log("O estagio nao e reproduzivel, ou o cassete carrega algo volatil");
      console.log("fora de CAMPOS_VOLATEIS (src/resolucao/cassete/formato.ts).");
      return 1;
    }

    // ── 3. sonda negativa ──────────────────────────────────────────────────
    console.log("Fase 3 — sonda negativa: mutar o resultado e exigir VERMELHO");
    const caminho = join(b.diretorio, ARQUIVO_RESULTADO);
    const dados = JSON.parse(await readFile(caminho, "utf-8")) as {
      __mutacao_da_sonda?: string;
    };
    dados.__mutacao_da_sonda = "um byte que nao estava la";
    await writeFile(caminho, serializarCanonico(dados), "utf-8");

    const mutado = await diffCassetes(a.diretorio, b.diretorio);
    if (mutado.refutacoes === 0) {
      console.log(formatarDiff(mutado));
      console.log("");
      console.log("=== VERMELHO: o diff esta CEGO ===");
      console.log("Mutamos resultado.json e o diff nao acusou. Enquanto isso for");
      console.log("verdade, a fase 2 verde nao prova determinismo nenhum.");
      return 1;
    }
    console.log(
      `  mutacao detectada: ${mutado.refutacoes} refutacao(oes) — o diff enxerga`,
    );
    console.log("");

    console.log("=== VERDE: determinismo do cassete sustentado ===");
    console.log(
      `  ${resultado.arquivosComparados.length} arquivo(s) comparado(s), ` +
        `${resultado.refutacoes} refutacao(oes), ` +
        `${resultado.explicadas} diferenca(s) explicada(s) e nomeada(s)`,
    );
    return 0;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("res:cassete: erro inesperado:", erro);
    process.exit(2);
  },
);
