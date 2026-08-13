// =============================================================================
// mutar — as sondas negativas do card F1-09
// =============================================================================
// Card: F1-09 (onda W4)
//
// Um gate que so foi visto passando nunca foi visto funcionando (C2). Aqui
// cada garantia deste card e QUEBRADA de proposito e o gate tem de ficar
// VERMELHO — pelo motivo certo, com o nome do no na mensagem.
//
//   ∅-1  snapshot aprovado APAGADO          -> provar VERMELHO ("AUSENTE")
//   ∅-2  snapshot aprovado TROCADO          -> provar VERMELHO ("diverge")
//   ∅-3  formato sem alfa no descritor      -> RENDER falha nomeando o no
//   ∅-4  formato sem alfa no manifesto      -> conferir VERMELHO nomeando o no
//   ∅-5  bytes sem alfa, mimeType honesto   -> conferir VERMELHO nomeando o no
//   ∅-6  no de grafico sem asset resolvido  -> conferir VERMELHO nomeando o no
//   +1   controle positivo                  -> conferir VERDE no caso bom
//
// O controle positivo existe porque um conferidor que reprova TUDO tambem
// passaria nas seis sondas acima sem verificar nada.
//
// Uso:  npx tsx tools/no-grafico/mutar.ts
// =============================================================================

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..");
const DIR_FIXTURE = resolve(RAIZ, "fixtures", "snapshots", "no-grafico");
const DIR_APROVADO = resolve(DIR_FIXTURE, "aprovado");
const DIR_ASSETS = resolve(DIR_FIXTURE, "assets");
const PORTA = 3109;
const FRAME = 20;

const APROVADO_DADOS = resolve(DIR_APROVADO, "no-grafico-dados-frame20.png");
const APROVADO_ASSET = resolve(DIR_APROVADO, "no-grafico-asset-frame20.png");

interface Execucao {
  readonly codigo: number;
  readonly saida: string;
}

function rodar(argumentos: readonly string[]): Execucao {
  // O filho usa OUTRA porta: quando a sonda de render (s-3) roda, o processo
  // pai mantem o navegador do Remotion aberto na porta 3109 — e um filho que
  // pedisse a mesma porta cairia com EADDRINUSE antes de renderizar, e o
  // VERMELHO sairia pelo motivo errado (ou nem sairia). A porta do filho vem
  // do env, com default proprio em provar.ts.
  const resultado = spawnSync("npx", ["tsx", ...argumentos], {
    cwd: RAIZ,
    encoding: "utf-8",
    env: { ...process.env, NO_GRAFICO_PORTA: "3110" },
  });
  return {
    codigo: resultado.status ?? -1,
    saida: `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`,
  };
}

function provar(): Execucao {
  return rodar(["tools/no-grafico/provar.ts"]);
}

function conferir(fixture: string): Execucao {
  return rodar([
    "tools/no-grafico/conferir.ts",
    resolve(DIR_FIXTURE, fixture),
    "--loja",
    DIR_ASSETS,
  ]);
}

/** Exige VERMELHO e a frase que prova o motivo certo. */
function exigirVermelho(
  execucao: Execucao,
  trechos: readonly string[],
): string[] {
  const problemas: string[] = [];
  if (execucao.codigo === 0) {
    problemas.push("saiu VERDE, e tinha de sair VERMELHO");
  }
  for (const trecho of trechos) {
    if (!execucao.saida.includes(trecho)) {
      problemas.push(`a mensagem nao contem "${trecho}"`);
    }
  }
  return problemas;
}

// ---------------------------------------------------------------------------
// ∅-3 — o render tem de FALHAR quando o formato nao tem alfa
// ---------------------------------------------------------------------------

async function sondaDeRender(): Promise<string[]> {
  const servidor = await bundle({
    entryPoint: resolve(DIR_FIXTURE, "index.tsx"),
    publicDir: DIR_ASSETS,
    onProgress: () => undefined,
  });
  const composicao = await selectComposition({
    serveUrl: servidor,
    id: "no-grafico-formato-sem-alfa",
    logLevel: "error",
  });
  const temporario = mkdtempSync(join(tmpdir(), "no-grafico-mutar-"));
  try {
    await renderStill({
      composition: composicao,
      serveUrl: servidor,
      output: join(temporario, "opaco.png"),
      frame: FRAME,
      imageFormat: "png",
      port: PORTA,
      chromiumOptions: { gl: "swangle" },
      logLevel: "error",
      overwrite: true,
    });
    return [
      "o render TERMINOU: um asset em formato sem canal alfa chegou ao " +
        "arquivo de saida. E exatamente a falha que este card existe para " +
        "impedir — o video sairia com um retangulo opaco e o build diria OK",
    ];
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const problemas: string[] = [];
    for (const trecho of ["no-grafico", 'no "g-asset"', "image/jpeg", "canal alfa"]) {
      if (!mensagem.includes(trecho)) {
        problemas.push(
          `o render falhou, mas a mensagem nao contem "${trecho}" — um erro ` +
            `que nao nomeia o no manda alguem procurar no lugar errado`,
        );
      }
    }
    return problemas;
  } finally {
    rmSync(temporario, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// ∅-1 e ∅-2 — o snapshot aprovado
// ---------------------------------------------------------------------------

function sondaDeSnapshotAusente(): string[] {
  if (!existsSync(APROVADO_DADOS)) {
    return [
      `pre-condicao falhou: ${APROVADO_DADOS} nao existe, entao nao ha o que ` +
        "apagar. Rode `just no-grafico-aprovar` antes",
    ];
  }
  const guardado = join(mkdtempSync(join(tmpdir(), "no-grafico-backup-")), "guardado.png");
  copyFileSync(APROVADO_DADOS, guardado);
  try {
    rmSync(APROVADO_DADOS);
    const problemas = exigirVermelho(provar(), ["AUSENTE", "no-grafico-dados"]);
    renameSync(guardado, APROVADO_DADOS);
    const depois = provar();
    if (depois.codigo !== 0) {
      problemas.push(
        "com o snapshot de volta o gate continuou VERMELHO — a sonda deixou " +
          "estrago, ou o vermelho anterior tinha outra causa",
      );
    }
    return problemas;
  } finally {
    if (!existsSync(APROVADO_DADOS) && existsSync(guardado)) {
      copyFileSync(guardado, APROVADO_DADOS);
    }
  }
}

function sondaDeSnapshotTrocado(): string[] {
  if (!existsSync(APROVADO_DADOS) || !existsSync(APROVADO_ASSET)) {
    return ["pre-condicao falhou: os dois snapshots aprovados precisam existir"];
  }
  const guardado = join(mkdtempSync(join(tmpdir(), "no-grafico-backup-")), "guardado.png");
  copyFileSync(APROVADO_DADOS, guardado);
  try {
    // Troca por um PNG valido e diferente: o gate tem de reprovar por
    // CONTEUDO, nao por arquivo corrompido.
    copyFileSync(APROVADO_ASSET, APROVADO_DADOS);
    return exigirVermelho(provar(), ["diverge do snapshot aprovado", "no-grafico-dados"]);
  } finally {
    copyFileSync(guardado, APROVADO_DADOS);
  }
}

// ---------------------------------------------------------------------------
// Execucao
// ---------------------------------------------------------------------------

interface Sonda {
  readonly nome: string;
  readonly executar: () => string[] | Promise<string[]>;
}

const SONDAS: readonly Sonda[] = [
  {
    nome: "+1  controle positivo: o caso bom sai VERDE",
    executar: () => {
      const execucao = conferir("resolvido-com-alfa.json");
      return execucao.codigo === 0
        ? []
        : [`saiu VERMELHO no caso bom:\n${execucao.saida}`];
    },
  },
  {
    nome: "∅-4 formato sem alfa no manifesto resolvido",
    executar: () =>
      exigirVermelho(conferir("resolvido-formato-sem-alfa.json"), [
        'no "g-asset"',
        "image/jpeg",
        "retangulo opaco",
      ]),
  },
  {
    nome: "∅-5 bytes sem alfa com mimeType honesto (image/png tipo de cor 2)",
    executar: () =>
      exigirVermelho(conferir("resolvido-bytes-sem-alfa.json"), [
        'no "g-asset"',
        "tipo de cor e 2",
      ]),
  },
  {
    nome: "∅-6 no de grafico sem asset resolvido",
    executar: () =>
      exigirVermelho(conferir("resolvido-sem-estagio.json"), [
        'no "g-asset"',
        "nao tem hash em nos_grafico",
      ]),
  },
  // ∅-1 e ∅-2 ANTES da sonda de render, de proposito: renderStill deixa o
  // navegador do Remotion aberto no processo pai, e um provar filho a seguir
  // tombaria com a porta 3109 ocupada. O filho usa a porta do env, mas a
  // ordem aqui economiza o erro inteiro.
  { nome: "∅-1 snapshot aprovado apagado", executar: sondaDeSnapshotAusente },
  { nome: "∅-2 snapshot aprovado trocado", executar: sondaDeSnapshotTrocado },
  { nome: "∅-3 render com formato sem alfa TEM de falhar", executar: sondaDeRender },
];

async function principal(): Promise<number> {
  process.stdout.write("=== no-grafico mutar: sondas negativas ===\n");
  let reprovadas = 0;

  for (const sonda of SONDAS) {
    const problemas = await sonda.executar();
    if (problemas.length === 0) {
      process.stdout.write(`  OK      ${sonda.nome}\n`);
      continue;
    }
    reprovadas++;
    process.stdout.write(`  FALHOU  ${sonda.nome}\n`);
    for (const problema of problemas) {
      process.stdout.write(`            ${problema}\n`);
    }
  }

  if (reprovadas > 0) {
    process.stdout.write(
      `\n=== VERMELHO: ${String(reprovadas)} sonda(s) negativa(s) nao reprovaram ===\n`,
    );
    return 1;
  }
  process.stdout.write("\n=== VERDE: toda garantia deste card sabe ficar vermelha ===\n");
  return 0;
}

process.exit(await principal());
