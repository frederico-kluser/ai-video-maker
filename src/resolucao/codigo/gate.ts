#!/usr/bin/env npx tsx
/**
 * src/resolucao/codigo/gate.ts
 *
 * O oraculo do card F2-05. `just res-codigo` chama isto.
 *
 * Cada checagem abaixo existe porque a sua ausencia produziria um verde
 * que nao significa nada. Todas imprimem denominador — "0 problemas" sem
 * "sobre N itens" e a armadilha C2 do AGENTS.md.
 *
 *   1. FRESCOR  o cassete versionado e uma gravacao do codigo de HOJE.
 *               Sem isto, mudar o destacador e esquecer de regravar
 *               deixa o repositorio servindo destaque velho para sempre.
 *   2. DETERMINISMO  duas gravacoes com relogios diferentes batem byte a
 *               byte, e a sonda negativa prova que o diff enxerga.
 *   3. ZERO REDE  o cassete tem zero chamadas gravadas, zero corpos.
 *               E a forma executavel do titulo do card: nao ha busca de
 *               tipo em host de terceiro para cachear, porque nao ha busca.
 *   4. SOSIA NAO SUCESSOR  sem chamada gravada, nao ha resposta externa
 *               para "consertar". A checagem torna isso auditavel em vez
 *               de argumentavel.
 *   5. CREDENCIAL  varredura em cada byte de cada arquivo do cassete.
 *   6. ENDERECO  cada hash de `nos_codigo` tem artefato, e o conteudo do
 *               artefato hasheia para o proprio nome.
 *   7. SEM URL  `encontrarURLs` na parcial inteira (C7).
 *   8. PRESENCA  o no de codigo da fixture canonica esta no resultado.
 *               Presenca do MEU item — nunca lista fechada (pergunta
 *               obrigatoria da W4).
 *
 * O ∅-crit da licenca NAO esta aqui: ele e um comando de shell com
 * `rg --files-without-match` e vive na receita `res-codigo-licenca`,
 * junto da checagem de denominador e da sonda negativa dele.
 *
 * Uso:
 *   npx tsx src/resolucao/codigo/gate.ts
 */

import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  ARQUIVO_RESULTADO,
  RAIZ_CASSETES_PADRAO,
  diretorioDoCassete,
  procurarCredencial,
  serializarCanonico,
} from "../cassete/formato.js";
import type { CabecalhoCassete } from "../cassete/formato.js";
import { gravarCassete } from "../cassete/gravador.js";
import { diffCassetes, formatarDiff } from "../cassete/diff.js";
import { chaveDoEstagio } from "../contrato.js";
import { encontrarURLs } from "../manifesto-resolvido.js";
import type { ParcialResolvido } from "../manifesto-resolvido.js";
import estagio, { computarArtefatos } from "./estagio.js";
import { escreverArtefatos, lerArtefato, listarArtefatos } from "./artefatos.js";
import { carregarManifestoDeGravacao } from "./manifesto-de-gravacao.js";
import { textoDaLinha } from "./tokens-de-destaque.js";

const NOME = "codigo";

// ─── Placar ─────────────────────────────────────────────────────────────────────

let falhas = 0;

function ok(mensagem: string): void {
  console.log(`  [OK]     ${mensagem}`);
}

function falhou(mensagem: string): void {
  console.log(`  [FALHOU] ${mensagem}`);
  falhas += 1;
}

function secao(titulo: string): void {
  console.log("");
  console.log(`--- ${titulo} ---`);
}

// ─── Auxiliares ─────────────────────────────────────────────────────────────────

async function existe(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

async function listarRecursivo(raiz: string): Promise<string[]> {
  const saida: string[] = [];
  async function andar(dir: string): Promise<void> {
    const entradas = await readdir(dir, { withFileTypes: true });
    for (const entrada of entradas) {
      const completo = join(dir, entrada.name);
      if (entrada.isDirectory()) await andar(completo);
      else if (entrada.isFile()) saida.push(relative(raiz, completo).split(sep).join("/"));
    }
  }
  if (await existe(raiz)) await andar(raiz);
  return saida.sort();
}

/** Grava um cassete completo (canonicos + artefatos) num diretorio raiz. */
async function gravarCompleto(
  raiz: string,
  manifesto: ReturnType<typeof carregarManifestoDeGravacao>,
  relogio: () => Date,
): Promise<{ chave: string; diretorio: string; quantidadeChamadas: number }> {
  const trabalho = await mkdtemp(join(tmpdir(), "gate-codigo-"));
  try {
    const resultado = await gravarCassete(estagio, {
      raiz,
      manifesto,
      diretorioTrabalho: trabalho,
      relogio,
    });
    await escreverArtefatos(resultado.diretorio, computarArtefatos(manifesto));
    return resultado;
  } finally {
    await rm(trabalho, { recursive: true, force: true });
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const manifesto = carregarManifestoDeGravacao();
  const chave = chaveDoEstagio(estagio, manifesto);
  const dirCassete = diretorioDoCassete(RAIZ_CASSETES_PADRAO, NOME, chave);

  console.log("=== res-codigo — destaque de codigo pre-computado (F2-05) ===");
  console.log(`Estagio:   ${estagio.identidade.nome} v${estagio.identidade.versao}`);
  console.log(`Chave:     ${chave}`);
  console.log(`Cassete:   ${dirCassete}`);
  console.log(`Parametros na chave: ${Object.keys(estagio.parametros).sort().join(", ")}`);

  // ── 1. frescor ──────────────────────────────────────────────────────────
  secao("1/8 frescor: o cassete versionado e gravacao do codigo de hoje");
  if (!(await existe(dirCassete))) {
    falhou(
      `nenhum cassete para a chave de hoje. O codigo ou os parametros mudaram ` +
        `sem regravar. Rode: npx tsx src/resolucao/codigo/gravar.ts --limpar`,
    );
    console.log("");
    console.log("=== VERMELHO: sem cassete nao ha o que verificar ===");
    return 1;
  }
  ok(`cassete presente para a chave calculada agora`);

  const tmp = await mkdtemp(join(tmpdir(), "res-codigo-gate-"));
  try {
    const a = await gravarCompleto(join(tmp, "g1"), manifesto, () =>
      new Date("2026-01-01T00:00:00.000Z"),
    );
    const b = await gravarCompleto(join(tmp, "g2"), manifesto, () =>
      new Date("2026-12-31T23:59:59.000Z"),
    );

    const frescor = await diffCassetes(dirCassete, a.diretorio);
    console.log(
      `  ${frescor.arquivosComparados.length} arquivo(s) comparado(s) com a gravacao de agora`,
    );
    if (frescor.refutacoes > 0) {
      console.log(formatarDiff(frescor));
      falhou(
        "o cassete versionado difere do que este codigo produz agora — regrave",
      );
    } else {
      ok(`versionado == recem-gravado (${frescor.explicadas} volatil(eis) explicado(s))`);
    }

    // ── 2. determinismo ───────────────────────────────────────────────────
    secao("2/8 determinismo: duas gravacoes, relogios diferentes");
    if (a.chave !== b.chave) {
      falhou(`a chave mudou entre duas gravacoes (${a.chave} vs ${b.chave})`);
    } else {
      ok(`chave estavel entre duas gravacoes`);
    }
    const det = await diffCassetes(a.diretorio, b.diretorio);
    console.log(
      `  ${det.arquivosComparados.length} arquivo(s) comparado(s): ` +
        `${det.refutacoes} refutacao(oes), ${det.explicadas} explicada(s)`,
    );
    if (det.refutacoes > 0) {
      console.log(formatarDiff(det));
      falhou("duas gravacoes do mesmo cassete divergiram");
    } else {
      ok("zero refutacoes entre duas gravacoes");
    }

    // sonda negativa: sem ela, um diff cego passaria em tudo acima
    const alvo = join(b.diretorio, ARQUIVO_RESULTADO);
    const dados = JSON.parse(await readFile(alvo, "utf-8")) as Record<string, unknown>;
    dados["__mutacao_da_sonda"] = "um byte que nao estava la";
    await writeFile(alvo, serializarCanonico(dados), "utf-8");
    const mutado = await diffCassetes(a.diretorio, b.diretorio);
    if (mutado.refutacoes === 0) {
      falhou("SONDA NEGATIVA: mutamos resultado.json e o diff nao acusou — diff cego");
    } else {
      ok(`sonda negativa: mutacao detectada (${mutado.refutacoes} refutacao(oes))`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  // ── 3 e 4. zero rede, sosia nao sucessor ──────────────────────────────
  secao("3/8 e 4/8 zero rede gravada — e portanto nada a 'consertar'");
  const cabecalho = JSON.parse(
    await readFile(join(dirCassete, ARQUIVO_CABECALHO), "utf-8"),
  ) as CabecalhoCassete;
  const chamadas = JSON.parse(
    await readFile(join(dirCassete, ARQUIVO_CHAMADAS), "utf-8"),
  ) as unknown[];

  if (cabecalho.quantidadeChamadas !== 0) {
    falhou(`cassete declara ${cabecalho.quantidadeChamadas} chamada(s) de rede`);
  } else {
    ok("cabecalho declara zero chamadas de rede");
  }
  if (chamadas.length !== 0) {
    falhou(`chamadas.json tem ${chamadas.length} entrada(s)`);
  } else {
    ok("chamadas.json vazio: nao ha resposta externa neste cassete");
  }
  if (await existe(join(dirCassete, "corpos"))) {
    falhou("existe diretorio corpos/ — algum corpo de resposta foi gravado");
  } else {
    ok("sem diretorio corpos/: sosia e sucessor coincidem por vacuidade, e isso e verificavel");
  }

  // ── 5. credencial ─────────────────────────────────────────────────────
  secao("5/8 credencial: varredura em cada byte do cassete");
  const arquivos = await listarRecursivo(dirCassete);
  let comCredencial = 0;
  for (const arquivo of arquivos) {
    const bruto = await readFile(join(dirCassete, arquivo), "utf-8");
    const achados = procurarCredencial(bruto);
    if (achados.length > 0) {
      falhou(`credencial em ${arquivo}: ${achados.join(", ")}`);
      comCredencial += 1;
    }
  }
  if (arquivos.length === 0) {
    falhou("denominador zero: nenhum arquivo no cassete para varrer");
  } else if (comCredencial === 0) {
    ok(`${arquivos.length} arquivo(s) varrido(s), zero credencial`);
  }

  // ── 6. endereco de conteudo ───────────────────────────────────────────
  secao("6/8 endereco: todo hash de nos_codigo tem artefato conferido");
  const parcial = JSON.parse(
    await readFile(join(dirCassete, ARQUIVO_RESULTADO), "utf-8"),
  ) as ParcialResolvido;
  const nosCodigo = parcial.nos_codigo ?? {};
  const enderecos = Object.entries(nosCodigo).sort(([a], [b]) => (a < b ? -1 : 1));

  if (enderecos.length === 0) {
    falhou("denominador zero: nenhum no de codigo no resultado gravado");
  } else {
    let conferidos = 0;
    for (const [no, hash] of enderecos) {
      try {
        const tokens = await lerArtefato(dirCassete, hash);
        if (tokens.no !== no) {
          falhou(`artefato ${hash.slice(0, 12)}… diz pertencer a "${tokens.no}", nao a "${no}"`);
          continue;
        }
        const linhasComTexto = tokens.linhas.filter((l) => textoDaLinha(l).length > 0);
        if (linhasComTexto.length === 0) {
          falhou(`artefato de ${no} nao tem nenhuma linha com texto`);
          continue;
        }
        conferidos += 1;
      } catch (erro) {
        falhou((erro as Error).message.split("\n")[0] ?? String(erro));
      }
    }
    if (conferidos === enderecos.length) {
      ok(`${conferidos}/${enderecos.length} artefato(s) com hash conferido e conteudo nao-vazio`);
    }
    const orfaos = (await listarArtefatos(dirCassete)).filter(
      (h) => !enderecos.some(([, hash]) => hash === h),
    );
    if (orfaos.length > 0) {
      falhou(`${orfaos.length} artefato(s) orfao(s) no cassete: ${orfaos.join(", ")}`);
    } else {
      ok("nenhum artefato orfao");
    }
  }

  // ── 7. sem URL ────────────────────────────────────────────────────────
  secao("7/8 C7: nenhuma URL atravessa a fronteira");
  const urls = encontrarURLs(parcial);
  if (urls.length > 0) {
    for (const u of urls) falhou(`URL em ${u.caminho}: ${u.valor}`);
  } else {
    ok(`parcial varrida inteira, zero URL`);
  }

  // ── 8. presenca do MEU item ───────────────────────────────────────────
  secao("8/8 presenca: o no de codigo da fixture canonica esta resolvido");
  const manifestoNos = manifesto.nos.filter((n) => n.type === "codigo").map((n) => n.id);
  if (manifestoNos.length === 0) {
    falhou("denominador zero: a fixture canonica nao tem no de codigo");
  } else {
    for (const id of manifestoNos) {
      if (nosCodigo[id] === undefined) {
        falhou(`no "${id}" e do tipo codigo e nao esta em nos_codigo`);
      } else {
        ok(`no "${id}" -> ${String(nosCodigo[id]).slice(0, 16)}…`);
      }
    }
  }

  console.log("");
  if (falhas > 0) {
    console.log(`=== VERMELHO: ${falhas} checagem(ns) falharam ===`);
    return 1;
  }
  console.log("=== VERDE: res-codigo ===");
  return 0;
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("res-codigo: erro inesperado:", erro);
    process.exit(2);
  },
);
