// =============================================================================
// Harness de snapshot e determinismo do no de texto — F1-05
// =============================================================================
// Uso:
//   npx tsx fixtures/snapshots/no-texto/provar.ts                 # o gate
//   npx tsx fixtures/snapshots/no-texto/provar.ts --aprovar       # (re)aprova
//   npx tsx fixtures/snapshots/no-texto/provar.ts --provar-ausencia  # ∅-crit
//
// POR QUE ESTE ARQUIVO EXISTE, se ja ha `tools/determinismo/provar.sh`:
// aquele harness e do canario e esta amarrado a ele — entry point, id de
// composicao, frame e nome de arquivo sao constantes no script. O PROGRAMA
// prometia `just det:provar --no <nome>`, que nao existe, e `tools/` nao e
// arquivo compartilhado desta onda (docs/contrato-w4.md §1). Entao F1-05 traz
// o proprio harness dentro da propria propriedade e registra AB-321 pedindo a
// generalizacao. As invariantes cobradas sao as mesmas, mais tres.
//
// O QUE ESTE HARNESS COBRA
//
//   1. Snapshot aprovado AUSENTE e VERMELHO. Nunca "primeira execucao, vou
//      gerar" — isso e o falso verde que o ∅-crit do card manda derrubar.
//   2. Render 2x do MESMO frame: qualquer byte diferente refuta o determinismo.
//   3. Render atual identico ao aprovado.
//   4. Os dois CAMINHOS produzem imagens DIFERENTES (com timing x sem timing).
//      Se sairem iguais, o componente ignorou o timing.
//   5. Frames diferentes do MESMO caminho produzem imagens DIFERENTES.
//      Se sairem iguais, o componente ignorou o frame.
//   6. Nenhum still e igual ao CONTROLE VAZIO — o quadro que sairia se o
//      componente devolvesse null. Este e o quadro preto do C1, renderizado de
//      verdade em vez de imaginado.
// =============================================================================

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";

import {
  FRAME_ALTERNATIVO,
  FRAME_ALVO,
  ID_COM_TIMING,
  ID_CONTROLE_VAZIO,
  ID_SEM_TIMING,
} from "./composicoes";

// ---------------------------------------------------------------------------
// Caminhos e alvos
// ---------------------------------------------------------------------------

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..", "..", "..");
const PONTO_DE_ENTRADA = resolve(AQUI, "index.tsx");
const DIR_APROVADO = resolve(AQUI, "aprovado");
// Os artefatos de FALHA moram fora de fixtures/, em output/ (que e ignorado
// pelo git). Se morassem ao lado dos aprovados, uma falha antiga deixaria
// arquivo nao rastreado em fixtures/snapshots/no-texto/ e o criterio de
// `git status --porcelain` do card ficaria vermelho para sempre, por um motivo
// que nao e o dele.
const DIR_RECEBIDO = resolve(RAIZ, "output", "no-texto", "recebido");

interface Alvo {
  /** Nome do arquivo, sem extensao */
  nome: string;
  composicao: string;
  frame: number;
  /** Tem snapshot aprovado no repositorio? O controle vazio nao tem. */
  aprovado: boolean;
  porque: string;
}

const ALVOS: readonly Alvo[] = [
  {
    nome: "com-timing-frame45",
    composicao: ID_COM_TIMING,
    frame: FRAME_ALVO,
    aprovado: true,
    porque: "destaque palavra a palavra, palavra 3 ativa",
  },
  {
    nome: "sem-timing-frame45",
    composicao: ID_SEM_TIMING,
    frame: FRAME_ALVO,
    aprovado: true,
    porque: "degradacao para destaque por frase, mesmo frame",
  },
  {
    nome: "com-timing-frame15",
    composicao: ID_COM_TIMING,
    frame: FRAME_ALTERNATIVO,
    aprovado: true,
    porque: "mesmo caminho, outra palavra ativa (palavra 1)",
  },
  {
    nome: "controle-vazio-frame45",
    composicao: ID_CONTROLE_VAZIO,
    frame: FRAME_ALVO,
    aprovado: false,
    porque: "controle negativo: o quadro que sairia com o componente devolvendo null",
  },
];

/** Piso de tamanho do PNG. O mesmo do harness do canario (F0-06). */
const MINIMO_DE_BYTES = 1000;

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

class ErroDeProva extends Error {}

function sha256(caminho: string): string {
  return createHash("sha256").update(readFileSync(caminho)).digest("hex");
}

function curto(hash: string): string {
  return hash.slice(0, 12);
}

function caminhoAprovado(nome: string): string {
  return resolve(DIR_APROVADO, `${nome}.png`);
}

function relativo(caminho: string): string {
  return caminho.startsWith(RAIZ) ? caminho.slice(RAIZ.length + 1) : caminho;
}

// ---------------------------------------------------------------------------
// (1) Pre-condicao: todo snapshot aprovado tem de existir
// ---------------------------------------------------------------------------

/**
 * Ausencia e VERMELHO. Esta funcao roda ANTES de qualquer render, para que a
 * prova de ausencia (∅-crit) nao precise de um render inteiro para concluir.
 */
export function exigirAprovados(): void {
  const faltando: string[] = [];
  for (const alvo of ALVOS) {
    if (!alvo.aprovado) continue;
    const caminho = caminhoAprovado(alvo.nome);
    if (!existsSync(caminho) || statSync(caminho).size === 0) {
      faltando.push(relativo(caminho));
    }
  }
  if (faltando.length > 0) {
    throw new ErroDeProva(
      "snapshot aprovado ausente ou vazio — o gate NAO gera snapshot sozinho:\n" +
        faltando.map((f) => `  - ${f}`).join("\n") +
        "\n  Para (re)aprovar de proposito: " +
        "npx tsx fixtures/snapshots/no-texto/provar.ts --aprovar",
    );
  }
}

// ---------------------------------------------------------------------------
// (2) Render
// ---------------------------------------------------------------------------

interface Passada {
  alvo: Alvo;
  caminhos: string[];
  hash: string;
}

async function renderizarTudo(destino: string, passadas: number): Promise<Passada[]> {
  process.stdout.write("Empacotando (webpack do Remotion)...\n");
  const serveUrl = await bundle({
    entryPoint: PONTO_DE_ENTRADA,
    onProgress: () => undefined,
  });

  const composicoes = await getCompositions(serveUrl);
  const disponiveis = composicoes.map((c) => c.id);

  // PRESENCA DO MEU ITEM, nunca a lista fechada: outro card desta onda pode
  // registrar composicoes proprias, e uma assercao sobre a lista inteira
  // ficaria vermelha no merge do irmao sem nenhum defeito real.
  const porId = new Map(composicoes.map((c) => [c.id, c] as const));
  for (const id of [ID_COM_TIMING, ID_SEM_TIMING, ID_CONTROLE_VAZIO]) {
    if (!porId.has(id)) {
      throw new ErroDeProva(
        `composicao "${id}" nao esta registrada no bundle ` +
          `(registradas: ${disponiveis.join(", ")})`,
      );
    }
  }

  const resultado: Passada[] = [];
  for (const alvo of ALVOS) {
    const composicao = porId.get(alvo.composicao);
    if (composicao === undefined) {
      throw new ErroDeProva(`composicao "${alvo.composicao}" sumiu do bundle`);
    }
    const caminhos: string[] = [];
    for (let i = 1; i <= passadas; i++) {
      const saida = resolve(destino, `passada-${String(i)}`, `${alvo.nome}.png`);
      mkdirSync(dirname(saida), { recursive: true });
      await renderStill({
        composition: composicao,
        serveUrl,
        frame: alvo.frame,
        imageFormat: "png",
        output: saida,
        overwrite: true,
        chromiumOptions: { gl: "swangle" },
      });
      caminhos.push(saida);
    }

    const hashes = caminhos.map(sha256);
    const primeiro = hashes[0] as string;
    for (let i = 1; i < hashes.length; i++) {
      if (hashes[i] !== primeiro) {
        mkdirSync(DIR_RECEBIDO, { recursive: true });
        for (let j = 0; j < caminhos.length; j++) {
          cpSync(
            caminhos[j] as string,
            resolve(DIR_RECEBIDO, `divergente-${alvo.nome}-passada${String(j + 1)}.png`),
          );
        }
        throw new ErroDeProva(
          `DETERMINISMO REFUTADO em ${alvo.nome}: ` +
            `passada 1 = ${curto(primeiro)}, passada ${String(i + 1)} = ` +
            `${curto(hashes[i] as string)}`,
        );
      }
    }

    const tamanho = statSync(caminhos[0] as string).size;
    process.stdout.write(
      `  ${alvo.nome.padEnd(24)} frame ${String(alvo.frame).padStart(3)}  ` +
        `${curto(primeiro)}  ${String(tamanho)} bytes  (${alvo.porque})\n`,
    );

    resultado.push({ alvo, caminhos, hash: primeiro });
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// (3) As invariantes entre stills
// ---------------------------------------------------------------------------

function porNome(passadas: readonly Passada[], nome: string): Passada {
  const achado = passadas.find((p) => p.alvo.nome === nome);
  if (achado === undefined) {
    throw new ErroDeProva(`passada "${nome}" nao foi renderizada`);
  }
  return achado;
}

function exigirDiferentes(a: Passada, b: Passada, porque: string): void {
  if (a.hash === b.hash) {
    throw new ErroDeProva(
      `${a.alvo.nome} e ${b.alvo.nome} sairam IDENTICOS (${curto(a.hash)}). ${porque}`,
    );
  }
  process.stdout.write(
    `  ${a.alvo.nome} != ${b.alvo.nome}  (${curto(a.hash)} != ${curto(b.hash)})\n`,
  );
}

function conferirInvariantes(passadas: readonly Passada[]): void {
  const com45 = porNome(passadas, "com-timing-frame45");
  const sem45 = porNome(passadas, "sem-timing-frame45");
  const com15 = porNome(passadas, "com-timing-frame15");
  const vazio = porNome(passadas, "controle-vazio-frame45");

  process.stdout.write("\nInvariantes entre stills:\n");

  exigirDiferentes(
    com45,
    sem45,
    "Os dois caminhos do card produziram o mesmo pixel: ou o timing foi ignorado, " +
      "ou os dois degradaram.",
  );
  exigirDiferentes(
    com45,
    com15,
    "O mesmo caminho em frames diferentes produziu o mesmo pixel: o componente " +
      "nao esta olhando para o frame.",
  );
  for (const still of [com45, sem45, com15]) {
    exigirDiferentes(
      still,
      vazio,
      "O still e igual ao quadro que sairia com o componente devolvendo null (C1).",
    );
  }

  // Entropia com linha de base propria: o quadro com texto comprime pior que o
  // fundo liso. O piso absoluto do canario continua valendo.
  const tamanhoVazio = statSync(vazio.caminhos[0] as string).size;
  for (const still of [com45, sem45, com15]) {
    const tamanho = statSync(still.caminhos[0] as string).size;
    if (tamanho < MINIMO_DE_BYTES) {
      throw new ErroDeProva(
        `entropia: ${still.alvo.nome} tem ${String(tamanho)} bytes ` +
          `(minimo ${String(MINIMO_DE_BYTES)})`,
      );
    }
    if (tamanho <= tamanhoVazio) {
      throw new ErroDeProva(
        `entropia: ${still.alvo.nome} (${String(tamanho)} bytes) nao e maior que ` +
          `o controle vazio (${String(tamanhoVazio)} bytes) — o quadro pode estar vazio`,
      );
    }
  }
  process.stdout.write(
    `  entropia OK (controle vazio: ${String(tamanhoVazio)} bytes)\n`,
  );
}

function conferirContraAprovado(passadas: readonly Passada[]): void {
  process.stdout.write("\nComparacao com os snapshots aprovados:\n");
  const divergentes: string[] = [];
  for (const passada of passadas) {
    if (!passada.alvo.aprovado) continue;
    const aprovado = caminhoAprovado(passada.alvo.nome);
    const hashAprovado = sha256(aprovado);
    if (hashAprovado !== passada.hash) {
      mkdirSync(DIR_RECEBIDO, { recursive: true });
      cpSync(
        passada.caminhos[0] as string,
        resolve(DIR_RECEBIDO, `${passada.alvo.nome}.png`),
      );
      divergentes.push(
        `  ${passada.alvo.nome}: aprovado ${curto(hashAprovado)} != atual ${curto(passada.hash)}`,
      );
    } else {
      process.stdout.write(`  ${passada.alvo.nome}: identico (${curto(passada.hash)})\n`);
    }
  }
  if (divergentes.length > 0) {
    throw new ErroDeProva(
      "regressao de snapshot:\n" +
        divergentes.join("\n") +
        `\n  Artefatos divergentes em ${relativo(DIR_RECEBIDO)}/`,
    );
  }
}

// ---------------------------------------------------------------------------
// Os tres modos
// ---------------------------------------------------------------------------

function comTemporario<T>(usar: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(resolve(tmpdir(), "no-texto-"));
  return usar(dir).finally(() => {
    rmSync(dir, { recursive: true, force: true });
  });
}

/** O gate. Pre-condicao, render 2x, invariantes, comparacao com o aprovado. */
export async function executarGate(): Promise<void> {
  exigirAprovados();
  await comTemporario(async (dir) => {
    const passadas = await renderizarTudo(dir, 2);
    conferirInvariantes(passadas);
    conferirContraAprovado(passadas);
  });
}

/** Reaprova: renderiza 2x, exige identidade, e so entao grava o aprovado. */
async function aprovar(): Promise<void> {
  await comTemporario(async (dir) => {
    const passadas = await renderizarTudo(dir, 2);
    conferirInvariantes(passadas);
    mkdirSync(DIR_APROVADO, { recursive: true });
    for (const passada of passadas) {
      if (!passada.alvo.aprovado) continue;
      cpSync(passada.caminhos[0] as string, caminhoAprovado(passada.alvo.nome));
      process.stdout.write(
        `  aprovado: ${relativo(caminhoAprovado(passada.alvo.nome))}\n`,
      );
    }
  });
}

/**
 * ∅-crit por MUTACAO: some com um snapshot aprovado de cada vez e exige que o
 * gate fique VERMELHO. Um gate que so foi visto passando nunca foi visto
 * funcionando.
 *
 * Nao renderiza: a pre-condicao roda antes do render de proposito, e e ela que
 * tem de reprovar. O controle positivo (com tudo no lugar, a pre-condicao
 * passa) roda no fim, para que a prova nao possa passar por estar sempre
 * vermelha.
 */
async function provarAusencia(): Promise<void> {
  process.stdout.write("∅-crit: apagar um snapshot aprovado tem de ficar VERMELHO\n\n");

  // Controle positivo ANTES: se ja estivesse vermelho, a mutacao nao provaria
  // nada.
  exigirAprovados();
  process.stdout.write("  controle positivo: com tudo no lugar, a pre-condicao passa\n");

  const abrigo = mkdtempSync(resolve(tmpdir(), "no-texto-ausencia-"));
  try {
    for (const alvo of ALVOS) {
      if (!alvo.aprovado) continue;
      const original = caminhoAprovado(alvo.nome);
      const guardado = resolve(abrigo, `${alvo.nome}.png`);
      renameSync(original, guardado);
      let ficouVermelho = false;
      let mensagem = "";
      try {
        exigirAprovados();
      } catch (erro) {
        ficouVermelho = true;
        mensagem = erro instanceof Error ? erro.message.split("\n")[0] ?? "" : String(erro);
      } finally {
        renameSync(guardado, original);
      }
      if (!ficouVermelho) {
        throw new ErroDeProva(
          `GATE CEGO: apagar ${relativo(original)} NAO deixou o gate vermelho`,
        );
      }
      process.stdout.write(`  sem ${alvo.nome}.png -> VERMELHO (${mensagem})\n`);
    }
  } finally {
    rmSync(abrigo, { recursive: true, force: true });
  }

  // Controle positivo DEPOIS: a restauracao funcionou.
  exigirAprovados();
  process.stdout.write("  restauracao conferida: a pre-condicao volta a passar\n");
  await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--aprovar")) {
    process.stdout.write("=== no-texto: APROVANDO snapshots ===\n\n");
    await aprovar();
    process.stdout.write("\n=== snapshots aprovados ===\n");
    return;
  }
  if (args.includes("--provar-ausencia")) {
    await provarAusencia();
    process.stdout.write("\n=== VERDE: a ausencia de snapshot derruba o gate ===\n");
    return;
  }
  process.stdout.write("=== no-texto: prova de snapshot e determinismo ===\n\n");
  await executarGate();
  process.stdout.write("\n=== VERDE: determinismo provado, snapshots conferem ===\n");
}

principal().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  process.stderr.write(`\nFALHOU: ${mensagem}\n\n=== VERMELHO ===\n`);
  process.exit(1);
});
