// =============================================================================
// conferir — a guarda de BUILD do no `grafico`
// =============================================================================
// Card: F1-09 (onda W4)
//
// Roda ANTES de qualquer navegador abrir e falha NOMEANDO O NO. Duas camadas,
// porque uma so nao fecha o buraco:
//
//   1. DESCRITOR — `assets[nos_grafico[no]].mimeType` contra a lista de
//      permissao de src/composicao/nos/grafico.tsx. Pega o JPEG, o MP4, o
//      formato que ninguem previu e o asset sem mimeType.
//
//   2. BYTES — o arquivo cujo SHA-256 e o hash do no, lido do disco. Pega a
//      mentira que a camada 1 nao ve: `mimeType: "image/png"` verdadeiro, com
//      um PNG de tipo de cor 2 (RGB) dentro. Nome certo, formato certo, zero
//      canal alfa, retangulo opaco no video.
//
// Uma unica regra de veredito: o que nao pode ser verificado sai VERMELHO, e
// nunca "pulado" (mesma politica de tools/gate.sh — ferramenta ausente e
// vermelho). Formatos que este leitor ainda nao sabe abrir aparecem como
// NAO-VERIFICADO e derrubam o gate; ver ledger/inbox/F1-09.json (AB-363).
//
// Uso:
//   npx tsx tools/no-grafico/conferir.ts <manifesto-resolvido.json> --loja <dir>
// =============================================================================

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  conferirGraficosResolvidos,
  type ManifestoParaConferencia,
} from "../../src/composicao/nos/grafico";
import type { AssetResolvido } from "../../src/resolucao/manifesto-resolvido";
import { lerCabecalhoPng } from "./png";

const NOME_DO_NO = "no-grafico";

// ---------------------------------------------------------------------------
// Loja de conteudo — indexada por SHA-256 do arquivo, como o store (S-8)
// ---------------------------------------------------------------------------

export function indexarLoja(diretorio: string): Map<string, string> {
  const indice = new Map<string, string>();
  for (const entrada of readdirSync(diretorio).sort()) {
    const caminho = resolve(diretorio, entrada);
    if (!statSync(caminho).isFile()) continue;
    const hash = createHash("sha256").update(readFileSync(caminho)).digest("hex");
    indice.set(hash, caminho);
  }
  return indice;
}

// ---------------------------------------------------------------------------
// Camada 2 — os bytes
// ---------------------------------------------------------------------------

/** WebP: alfa vive na flag do bloco VP8X ou na presenca do bloco ALPH. */
function alfaDoWebp(arquivo: Buffer): boolean {
  if (arquivo.subarray(8, 12).toString("latin1") !== "WEBP") {
    throw new Error("nao e um WebP");
  }
  let posicao = 12;
  while (posicao + 8 <= arquivo.length) {
    const tipo = arquivo.subarray(posicao, posicao + 4).toString("latin1");
    const tamanho = arquivo.readUInt32LE(posicao + 4);
    if (tipo === "ALPH") return true;
    if (tipo === "VP8X") return (arquivo.readUInt8(posicao + 8) & 0x10) !== 0;
    if (tipo === "VP8L") return (arquivo.readUInt8(posicao + 12) & 0x10) !== 0;
    posicao += 8 + tamanho + (tamanho % 2);
  }
  return false;
}

/**
 * Confere os BYTES de um asset de grafico.
 * Devolve a lista de problemas — vazia significa "verificado e aprovado",
 * nunca "nao deu para olhar".
 */
export function conferirBytesDeAsset(
  noId: string,
  asset: AssetResolvido,
  arquivo: Buffer,
): string[] {
  const onde = `${NOME_DO_NO}: no "${noId}"`;
  const mime = (asset.mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";

  if (mime === "image/png" || mime === "image/apng") {
    const cabecalho = lerCabecalhoPng(arquivo);
    if (!cabecalho.temAlfa) {
      return [
        `${onde}: o descritor diz "${mime}" e o arquivo E um PNG — mas o tipo ` +
          `de cor e ${String(cabecalho.tipoDeCor)}, que NAO tem canal alfa. ` +
          `Nome certo, formato certo, alfa nenhum: no video isso e um ` +
          `retangulo opaco por cima da cena`,
      ];
    }
    return [];
  }

  if (mime === "image/webp") {
    if (!alfaDoWebp(arquivo)) {
      return [
        `${onde}: WebP sem bloco ALPH e sem a flag de alfa no VP8X — o arquivo ` +
          `nao carrega canal alfa apesar do formato permitir`,
      ];
    }
    return [];
  }

  return [
    `${onde}: NAO-VERIFICADO — este conferidor ainda nao le os bytes de ` +
      `"${mime === "" ? "(sem mimeType)" : mime}". Nao verificado e VERMELHO, ` +
      `nunca pulado: um alfa que ninguem olhou nao e um alfa que existe ` +
      `(ledger AB-363)`,
  ];
}

// ---------------------------------------------------------------------------
// A conferencia completa
// ---------------------------------------------------------------------------

export interface ResultadoDaConferencia {
  readonly nosDeGrafico: number;
  readonly erros: readonly string[];
}

export function conferir(
  resolvido: ManifestoParaConferencia,
  loja: Map<string, string>,
): ResultadoDaConferencia {
  const erros: string[] = [...conferirGraficosResolvidos(resolvido)];
  const mapa = resolvido.nos_grafico ?? {};
  let nosDeGrafico = 0;

  for (const no of resolvido.manifesto.nos) {
    if (no.type !== "grafico") continue;
    nosDeGrafico++;
    const hash = mapa[no.id];
    if (hash === undefined) continue;
    const asset = resolvido.assets[hash];
    if (asset === undefined) continue;

    const caminho = loja.get(hash);
    if (caminho === undefined) {
      erros.push(
        `${NOME_DO_NO}: no "${no.id}": o hash ${hash} nao tem arquivo na loja — ` +
          `sem os bytes nao da para afirmar que ha canal alfa, e afirmar sem ` +
          `olhar e o falso verde que este card existe para impedir`,
      );
      continue;
    }
    erros.push(...conferirBytesDeAsset(no.id, asset, readFileSync(caminho)));
  }

  return { nosDeGrafico, erros };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function principal(argv: readonly string[]): number {
  const arquivo = argv[0];
  const indiceLoja = argv.indexOf("--loja");
  const dirLoja = indiceLoja >= 0 ? argv[indiceLoja + 1] : undefined;

  if (arquivo === undefined || dirLoja === undefined) {
    process.stderr.write(
      "uso: npx tsx tools/no-grafico/conferir.ts <resolvido.json> --loja <dir>\n",
    );
    return 2;
  }

  const resolvido = JSON.parse(
    readFileSync(arquivo, "utf-8"),
  ) as ManifestoParaConferencia;
  const resultado = conferir(resolvido, indexarLoja(dirLoja));

  process.stdout.write(`=== no-grafico conferir: ${arquivo} ===\n`);
  process.stdout.write(
    `  nos do tipo "grafico" conferidos: ${String(resultado.nosDeGrafico)}\n`,
  );

  if (resultado.erros.length > 0) {
    process.stdout.write("\n");
    for (const erro of resultado.erros) {
      process.stdout.write(`  FALHOU  ${erro}\n`);
    }
    process.stdout.write("\n=== VERMELHO: o grafico nao pode entrar no video ===\n");
    return 1;
  }

  process.stdout.write("=== VERDE: todo grafico deste manifesto compoe com alfa ===\n");
  return 0;
}

const ESTE_ARQUIVO = fileURLToPath(import.meta.url);
if (process.argv[1] !== undefined && resolve(process.argv[1]) === ESTE_ARQUIVO) {
  process.exit(principal(process.argv.slice(2)));
}
