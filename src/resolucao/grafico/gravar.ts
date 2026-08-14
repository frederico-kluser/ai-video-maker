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

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Manifesto } from "../../contratos/manifesto.js";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  DIRETORIO_CORPOS,
  RAIZ_CASSETES_PADRAO,
  caminhoDoCorpo,
  diretorioDoCassete,
  serializarCanonico,
} from "../cassete/formato.js";
import { diffCassetes, formatarDiff } from "../cassete/diff.js";
import { gravarCassete } from "../cassete/gravador.js";
import { lerCassete } from "../cassete/reprodutor.js";
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

// ─── Manifesto da gravacao ──────────────────────────────────────────────────────

/**
 * O manifesto contra o qual gravar: `--manifesto <caminho.json>` ou, sem a
 * flag, o `MANIFESTO_DE_GRAVACAO` (o cassete historico do F2-02).
 *
 * A chave do cassete e SHA-256 do manifesto: gravar contra a fixture canonica
 * (`fixtures/canonico/manifesto-valido.json`) produz o cassete que o replay
 * offline do pipeline procura para OS NOS do video real.
 */
async function manifestoDaGravacao(): Promise<Manifesto> {
  const flag = process.argv.indexOf("--manifesto");
  if (flag < 0) return MANIFESTO_DE_GRAVACAO;
  const caminho = process.argv[flag + 1];
  if (caminho === undefined) {
    throw new Error("--manifesto precisa de um caminho de arquivo JSON");
  }
  const bruto = await readFile(caminho, "utf-8");
  return JSON.parse(bruto) as Manifesto;
}

// ─── Bytes dos assets no cassete ────────────────────────────────────────────────

/**
 * Materializa os bytes dos webm renderizados em `corpos/<hash>` do cassete.
 *
 * O estagio e local (zero chamadas HTTP): o `gravarCassete` so grava
 * metadados, e o replay offline nao tem como servir os bytes do video para o
 * store. A convencao de `bytesDoAssetDoCassete` (src/pipeline/produzir.ts)
 * le `corpos/<hash>` — e aqui que os bytes entram.
 *
 * Regra de sosia (D4/D5 do ADR-0009): o arquivo so e copiado se o SHA-256
 * dele REPRODUZIR o hash declarado na procedencia. Bytes que nao rehasheiam
 * sao erro, nunca copia.
 *
 * Exportada para teste (a suite referencia a materializacao: remover ou
 * quebrar esta funcao tem de deixar o teste VERMELHO — Q7). `raizCassetes`
 * e injetavel para a suite gravar num diretorio temporario.
 */
export async function materializarCorpos(
  chave: string,
  diretorioTrabalho: string,
  raizCassetes: string = RAIZ_CASSETES_PADRAO,
): Promise<number> {
  const cassete = await lerCassete(raizCassetes, "grafico", chave);
  const dirCassete = diretorioDoCassete(raizCassetes, "grafico", chave);
  const media = join(diretorioTrabalho, "media");
  let gravados = 0;
  for (const asset of cassete.procedencia.assets) {
    const idNoProvedor = asset.idNoProvedor;
    if (idNoProvedor === undefined) {
      throw new Error(
        `asset ${asset.hash.slice(0, 12)}… sem idNoProvedor — nao da para ` +
          "descobrir o webm que ele declara",
      );
    }
    const caminho = await descobrirWebm(media, idNoProvedor);
    if (caminho === null) {
      throw new Error(
        `asset ${asset.hash.slice(0, 12)}… (${idNoProvedor}): webm nao encontrado ` +
          `em ${media} — o cassete nao pode servir os bytes que declara`,
      );
    }
    const bytes = await readFile(caminho);
    const hashDeFato = createHash("sha256").update(bytes).digest("hex");
    if (hashDeFato !== asset.hash) {
      throw new Error(
        `asset ${asset.hash.slice(0, 12)}…: ${caminho} rehasheia para ` +
          `${hashDeFato.slice(0, 12)}… — bytes divergentes nunca entram no cassete`,
      );
    }
    await mkdir(join(dirCassete, DIRETORIO_CORPOS), { recursive: true });
    await writeFile(caminhoDoCorpo(dirCassete, asset.hash), bytes);
    gravados++;
  }
  return gravados;
}

/** Procura o webm da cena sob `media/videos/`, fora de partial_movie_files. */
async function descobrirWebm(raiz: string, nomeCena: string): Promise<string | null> {
  async function varrer(diretorio: string): Promise<string | null> {
    let entradas: Array<import("node:fs").Dirent>;
    try {
      entradas = await readdir(diretorio, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entrada of entradas) {
      const caminho = join(diretorio, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "partial_movie_files") continue;
        const achado = await varrer(caminho);
        if (achado !== null) return achado;
      } else if (entrada.name === `${nomeCena}.webm`) {
        return caminho;
      }
    }
    return null;
  }
  return varrer(raiz);
}

async function main(): Promise<number> {
  if (process.argv.includes("--conferir")) return conferir();

  console.log("=== res-grafico-gravar — gravando o cassete de `grafico` ===");
  console.log(
    `Estagio: ${estagio.identidade.nome} v${estagio.identidade.versao}`,
  );
  console.log(`Parametros: ${JSON.stringify(estagio.parametros)}`);
  const manifesto = await manifestoDaGravacao();
  console.log(
    `Manifesto: ${manifesto.nos.length} no(s), ` +
      `${manifesto.width}x${manifesto.height} @ ` +
      `${manifesto.fps}fps`,
  );
  console.log("");

  const trabalho = await mkdtemp(join(tmpdir(), "gravar-grafico-"));
  try {
    const resultado = await gravarCassete(estagio, {
      raiz: RAIZ_CASSETES_PADRAO,
      manifesto,
      diretorioTrabalho: trabalho,
    });
    const corpos = await materializarCorpos(resultado.chave, trabalho);
    console.log(`chave:     ${resultado.chave}`);
    console.log(`diretorio: ${resultado.diretorio}`);
    console.log(`chamadas HTTP gravadas: ${resultado.quantidadeChamadas}`);
    console.log(`assets materializados em corpos/: ${corpos}`);
    console.log("");
    console.log("=== VERDE: cassete gravado ===");
    return 0;
  } finally {
    await rm(trabalho, { recursive: true, force: true });
  }
}

// A cerimonia roda so quando este arquivo e o PONTO DE ENTRADA: a suite
// importa `materializarCorpos` deste modulo (Q7), e importar nao pode
// disparar uma gravacao de cassete.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then(
    (codigo) => process.exit(codigo),
    (erro: unknown) => {
      console.error("");
      console.error("=== VERMELHO: a gravacao falhou ===");
      console.error(erro instanceof Error ? erro.message : String(erro));
      process.exit(1);
    },
  );
}
