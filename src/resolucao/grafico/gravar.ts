#!/usr/bin/env npx tsx
/**
 * src/resolucao/grafico/gravar.ts
 *
 * Gravacao do cassete de `grafico`. Card F2-02 (W4).
 *
 * Roda A MAO, fora da suite, com o Manim disponivel — e a unica hora em que
 * `resolver()` deste estagio e executado. `just res-grafico-gravar` chama
 * este arquivo.
 *
 *   npx tsx src/resolucao/grafico/gravar.ts
 *   MANIM_BIN=/caminho/para/python npx tsx src/resolucao/grafico/gravar.ts
 *
 * O script nao tem opcao de "gravar assim mesmo". Se o Manim faltar, se a
 * versao divergir, se o muxer divergir, ou se o video sair chapado, ele
 * falha e o cassete anterior fica intacto — `gravarCassete` so apaga o
 * diretorio depois de o estagio ter terminado e a procedencia ter sido
 * validada.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  serializarCanonico,
} from "../cassete/formato.js";
import { diffCassetes, formatarDiff } from "../cassete/diff.js";
import { gravarCassete } from "../cassete/gravador.js";
import { chaveDoEstagio } from "../contrato.js";
import estagio from "./estagio.js";
import { MANIFESTO_DE_GRAVACAO } from "./manifesto-de-gravacao.js";

/**
 * `--conferir`: grava duas vezes com relogios diferentes e prova tres coisas.
 *
 *   1. as duas gravacoes sao iguais byte a byte fora de CAMPOS_VOLATEIS —
 *      o estagio e reproduzivel, o que inclui o render do Manim;
 *   2. a gravacao nova bate com o cassete COMMITADO em `resultado.json`,
 *      `procedencia.json` e `cassete.json`. Sem isso, "reproduzivel" seria
 *      uma frase sobre dois arquivos temporarios que ninguem usa;
 *   3. sonda negativa: mutar um byte deixa o diff VERMELHO. Um diff que
 *      nunca reprovou nao e evidencia de nada.
 *
 * Nao escreve em `fixtures/`: as duas gravacoes vao para diretorio temporario.
 */
async function conferir(): Promise<number> {
  console.log("=== res-grafico-conferir — regravar, diffar e comparar com o commitado ===");
  const tmp = await mkdtemp(join(tmpdir(), "conferir-grafico-"));
  try {
    const a = await gravarCassete(estagio, {
      raiz: join(tmp, "gravacao-1"),
      manifesto: MANIFESTO_DE_GRAVACAO,
      diretorioTrabalho: join(tmp, "trabalho-1"),
      relogio: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    const b = await gravarCassete(estagio, {
      raiz: join(tmp, "gravacao-2"),
      manifesto: MANIFESTO_DE_GRAVACAO,
      diretorioTrabalho: join(tmp, "trabalho-2"),
      relogio: () => new Date("2026-12-31T23:59:59.000Z"),
    });

    if (a.chave !== b.chave) {
      console.log(`  chave 1: ${a.chave}`);
      console.log(`  chave 2: ${b.chave}`);
      console.log("=== VERMELHO: a chave mudou entre duas gravacoes ===");
      return 1;
    }
    console.log(`Fase 1 — chave estavel: ${a.chave}`);

    const diff = await diffCassetes(a.diretorio, b.diretorio);
    console.log("Fase 2 — diff das duas gravacoes");
    console.log(formatarDiff(diff));
    if (diff.refutacoes > 0) {
      console.log("=== VERMELHO: o render nao e reproduzivel ===");
      return 1;
    }

    console.log("");
    console.log("Fase 3 — comparacao com o cassete commitado");
    const commitado = diretorioDoCassete(RAIZ_CASSETES_PADRAO, "grafico", a.chave);
    const chaveEsperada = chaveDoEstagio(estagio, MANIFESTO_DE_GRAVACAO);
    if (chaveEsperada !== a.chave) {
      console.log(`  chave do estagio: ${chaveEsperada}`);
      console.log(`  chave da gravacao: ${a.chave}`);
      console.log("=== VERMELHO: a chave do estagio nao e a da gravacao ===");
      return 1;
    }
    for (const arquivo of [ARQUIVO_CABECALHO, ARQUIVO_RESULTADO, ARQUIVO_PROCEDENCIA]) {
      const novo = await readFile(join(a.diretorio, arquivo), "utf-8");
      const antigo = await readFile(join(commitado, arquivo), "utf-8");
      if (novo !== antigo) {
        console.log(`  [DIVERGE] ${arquivo}`);
        console.log("=== VERMELHO: a regravacao nao reproduz o cassete commitado ===");
        return 1;
      }
      console.log(`  [IGUAL] ${arquivo}`);
    }

    console.log("");
    console.log("Fase 4 — sonda negativa: mutar um byte tem de deixar o diff VERMELHO");
    const alvo = join(b.diretorio, ARQUIVO_RESULTADO);
    const dados = JSON.parse(await readFile(alvo, "utf-8")) as Record<string, unknown>;
    dados["__mutacao_da_sonda"] = "um byte que nao estava la";
    await writeFile(alvo, serializarCanonico(dados), "utf-8");
    const mutado = await diffCassetes(a.diretorio, b.diretorio);
    if (mutado.refutacoes === 0) {
      console.log("=== VERMELHO: o diff esta CEGO — mutamos e ele nao acusou ===");
      return 1;
    }
    console.log(`  mutacao detectada: ${mutado.refutacoes} refutacao(oes)`);
    console.log("");
    console.log("=== VERDE: render reproduzivel e cassete commitado conferido ===");
    return 0;
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  if (process.argv.includes("--conferir")) return conferir();

  console.log("=== res-grafico-gravar — gravando o cassete de `grafico` ===");
  console.log(
    `Estagio: ${estagio.identidade.nome} v${estagio.identidade.versao}`,
  );
  console.log(`Parametros: ${JSON.stringify(estagio.parametros)}`);
  console.log(
    `Manifesto: ${MANIFESTO_DE_GRAVACAO.nos.length} no(s), ` +
      `${MANIFESTO_DE_GRAVACAO.width}x${MANIFESTO_DE_GRAVACAO.height} @ ` +
      `${MANIFESTO_DE_GRAVACAO.fps}fps`,
  );
  console.log("");

  const trabalho = await mkdtemp(join(tmpdir(), "gravar-grafico-"));
  try {
    const resultado = await gravarCassete(estagio, {
      raiz: RAIZ_CASSETES_PADRAO,
      manifesto: MANIFESTO_DE_GRAVACAO,
      diretorioTrabalho: trabalho,
    });
    console.log(`chave:     ${resultado.chave}`);
    console.log(`diretorio: ${resultado.diretorio}`);
    console.log(`chamadas HTTP gravadas: ${resultado.quantidadeChamadas}`);
    console.log("");
    console.log("=== VERDE: cassete gravado ===");
    return 0;
  } finally {
    await rm(trabalho, { recursive: true, force: true });
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("");
    console.error("=== VERMELHO: a gravacao falhou ===");
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exit(1);
  },
);
