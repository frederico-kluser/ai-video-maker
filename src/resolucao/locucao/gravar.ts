#!/usr/bin/env npx tsx
/**
 * src/resolucao/locucao/gravar.ts
 *
 * GRAVACAO E DETERMINISMO do cassete de locucao. Roda A MAO, com rede
 * (loopback), nunca dentro da suite.
 *
 * Tres subcomandos:
 *
 *   --gravar        sobe o sosia, executa o estagio de verdade contra
 *                   ele e escreve `fixtures/cassetes/locucao/<chave>/`.
 *   --determinismo  grava DUAS vezes, com relogios propositalmente
 *                   diferentes, diffa, e faz a sonda negativa (muta o
 *                   resultado e exige que o diff fique vermelho).
 *   --chave         imprime a chave de cache do manifesto canonico.
 *
 * Por que este script existe em vez de `tools/resolucao/regravar-e-diffar.ts`:
 * aquele script grava contra o manifesto DELE (dois nos, nenhuma cena com
 * `audio_cena`), e um estagio de locucao com zero unidade e um
 * determinismo provado sobre nada — C2 na veia. Aqui a prova roda sobre o
 * manifesto canonico, que tem duas cenas com locucao de verdade.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { gravarCassete } from "../cassete/gravador.js";
import { diffCassetes, formatarDiff } from "../cassete/diff.js";
import { ARQUIVO_RESULTADO, serializarCanonico } from "../cassete/formato.js";
import { chaveDeCache, componentesDaChave, hashDoManifesto } from "../contrato.js";
import type { Manifesto } from "../../contratos/manifesto.js";
import estagio, { PARAMETROS_LOCUCAO, unidadesDeLocucao } from "./estagio.js";
import { iniciarSosia } from "./sosia.js";

/** Porta reservada ao card F2-03 no contrato da onda W4. */
export const PORTA = 3203;

const RAIZ_CASSETES = "fixtures/cassetes";
const MANIFESTO_CANONICO = "fixtures/canonico/manifesto-valido.json";

/**
 * Credencial usada na gravacao contra o sosia.
 *
 * Curta de proposito: `PADROES_CREDENCIAL` do gravador acusa
 * `Bearer <20+ caracteres>`, e o objetivo aqui e que NENHUMA credencial
 * real (a do ambiente) chegue perto do caminho de gravacao. O header
 * `authorization` e redigido antes do disco de qualquer jeito; isto e a
 * segunda camada.
 */
const CREDENCIAL_DO_SOSIA = "sosia";

async function lerManifesto(): Promise<Manifesto> {
  return JSON.parse(await readFile(MANIFESTO_CANONICO, "utf-8")) as Manifesto;
}

/** Roda `acao` com o sosia no ar, e derruba o sosia aconteca o que acontecer. */
async function comSosia<T>(acao: () => Promise<T>): Promise<T> {
  const sosia = await iniciarSosia(PORTA);
  const anterior = process.env.LOCUCAO_API_KEY;
  process.env.LOCUCAO_API_KEY = CREDENCIAL_DO_SOSIA;
  try {
    return await acao();
  } finally {
    process.env.LOCUCAO_API_KEY = anterior;
    if (anterior === undefined) delete process.env.LOCUCAO_API_KEY;
    await sosia.fechar();
  }
}

function conferirParametros(): void {
  if (PARAMETROS_LOCUCAO.endpoint_base !== `http://127.0.0.1:${PORTA}`) {
    throw new Error(
      `endpoint_base dos parametros (${PARAMETROS_LOCUCAO.endpoint_base}) nao aponta ` +
        `para o sosia na porta ${PORTA}. Gravar assim produziria um cassete cuja ` +
        `chave nao corresponde ao que foi realmente chamado.`,
    );
  }
}

async function gravar(): Promise<number> {
  conferirParametros();
  const manifesto = await lerManifesto();
  const unidades = unidadesDeLocucao(manifesto);

  console.log("=== res-locucao: gravacao do cassete ===");
  console.log(`Manifesto: ${MANIFESTO_CANONICO}`);
  console.log(`Unidades de locucao: ${unidades.length}`);
  for (const u of unidades) {
    console.log(`  ${u.unidade}: ${u.texto.slice(0, 60)}…`);
  }
  if (unidades.length === 0) {
    console.log("");
    console.log("VERMELHO: zero unidades de locucao no manifesto canonico.");
    console.log("Gravar um cassete vazio seria cobertura por vacuidade (C2).");
    return 1;
  }
  console.log("");

  const resultado = await comSosia(async () => {
    const trabalho = await mkdtemp(join(tmpdir(), "locucao-gravacao-"));
    try {
      return await gravarCassete(estagio, {
        raiz: RAIZ_CASSETES,
        manifesto,
        diretorioTrabalho: trabalho,
      });
    } finally {
      await rm(trabalho, { recursive: true, force: true });
    }
  });

  console.log(`Cassete gravado: ${resultado.diretorio}`);
  console.log(`  chave:    ${resultado.chave}`);
  console.log(`  chamadas: ${resultado.quantidadeChamadas}`);
  console.log("");
  console.log("=== VERDE: cassete gravado ===");
  return 0;
}

async function determinismo(): Promise<number> {
  conferirParametros();
  const manifesto = await lerManifesto();

  console.log("=== res-locucao: determinismo do cassete ===");
  console.log(`Estagio: locucao v${estagio.identidade.versao}`);
  console.log(`Manifesto: ${MANIFESTO_CANONICO} (${unidadesDeLocucao(manifesto).length} unidades)`);
  console.log("");

  const tmp = await mkdtemp(join(tmpdir(), "locucao-determinismo-"));
  try {
    const { a, b } = await comSosia(async () => {
      const trabalho = join(tmp, "trabalho");
      // Relogios DIFERENTES de proposito: relogios iguais esconderiam o
      // unico campo volatil que existe.
      const primeira = await gravarCassete(estagio, {
        raiz: join(tmp, "gravacao-1"),
        manifesto,
        diretorioTrabalho: trabalho,
        relogio: () => new Date("2026-01-01T00:00:00.000Z"),
      });
      const segunda = await gravarCassete(estagio, {
        raiz: join(tmp, "gravacao-2"),
        manifesto,
        diretorioTrabalho: trabalho,
        relogio: () => new Date("2026-12-31T23:59:59.000Z"),
      });
      return { a: primeira, b: segunda };
    });

    if (a.chave !== b.chave) {
      console.log(`  chave 1: ${a.chave}`);
      console.log(`  chave 2: ${b.chave}`);
      console.log("=== VERMELHO: a chave mudou entre duas gravacoes ===");
      return 1;
    }
    console.log(`Fase 1 — duas gravacoes, chave estavel: ${a.chave}`);
    console.log("");

    console.log("Fase 2 — diff das duas gravacoes");
    const diff = await diffCassetes(a.diretorio, b.diretorio);
    console.log(formatarDiff(diff));
    console.log("");
    if (diff.refutacoes > 0) {
      console.log("=== VERMELHO: diferenca nao explicada entre duas gravacoes ===");
      return 1;
    }

    console.log("Fase 3 — sonda negativa: mutar o resultado e exigir VERMELHO");
    const caminho = join(b.diretorio, ARQUIVO_RESULTADO);
    const dados = JSON.parse(await readFile(caminho, "utf-8")) as Record<string, unknown>;
    dados["__mutacao_da_sonda"] = "um byte que nao estava la";
    await writeFile(caminho, serializarCanonico(dados), "utf-8");
    const mutado = await diffCassetes(a.diretorio, b.diretorio);
    if (mutado.refutacoes === 0) {
      console.log("=== VERMELHO: o diff esta CEGO — mutamos e ele nao acusou ===");
      return 1;
    }
    console.log(`  mutacao detectada: ${mutado.refutacoes} refutacao(oes)`);
    console.log("");
    console.log("=== VERDE: determinismo do cassete de locucao sustentado ===");
    return 0;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function imprimirChave(): Promise<number> {
  const manifesto = await lerManifesto();
  console.log(chaveDeCache(componentesDaChave(estagio, hashDoManifesto(manifesto))));
  return 0;
}

async function main(): Promise<number> {
  const argumentos = process.argv.slice(2);
  if (argumentos.includes("--gravar")) return gravar();
  if (argumentos.includes("--determinismo")) return determinismo();
  if (argumentos.includes("--chave")) return imprimirChave();
  console.log("uso: npx tsx src/resolucao/locucao/gravar.ts --gravar|--determinismo|--chave");
  return 2;
}

// So executa quando chamado direto. Sem esta guarda, qualquer import
// deste modulo (um teste, uma varredura de tipos) dispararia uma
// gravacao de cassete como efeito colateral.
const executadoDireto =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  main().then(
    (codigo) => process.exit(codigo),
    (erro: unknown) => {
      console.error("res-locucao: erro inesperado:", erro);
      process.exit(2);
    },
  );
}
