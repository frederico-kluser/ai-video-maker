// =============================================================================
// FIACAO — o ponto onde o manifesto resolvido vira manifesto pintavel
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
// Promovido para src/composicao/pintura/ no PREP-w7 (AB-493).
// Wiring dos webm de matematica: onda 2 (onda2-composicao, sub-parte 2b).
//
// O que os oito nos da W4 declararam como suposicao (AB-364, AB-374, AB-383)
// e que nenhum card da W4 podia escrever porque so existe no join:
//
//   A FIACAO anexa ao no `grafico` o descritor do asset que mora fora dele —
//   `assets[nos_grafico[no.id]]` — com `fonte` derivada do hash pela fiacao
//   (nunca gravada no manifesto resolvido; C7). Sem isso o no desenha do
//   manifesto em vez do que o estagio produziu, EM SILENCIO — a fiacao
//   esquecida nao quebra o render (AB-364).
//
// Regra de ouro (AB-364): TODO asset fiado TEM de ter `fonte`. Um asset
// resolvido sem fonte e ErroDeGraficoOpaco no componente — a fiacao pela
// metade nao vira desenho local.
//
// O RESOLVEDOR (onda 2): a fonte e `staticFile("grafico/<hash>.<ext>")` —
// um caminho DERIVADO do hash e do mimeType do proprio asset, nunca um
// mapeamento hardcoded hash->arquivo. Foi o mapeamento hardcoded
// (HASH_DO_GRAFICO -> "grafico-integrado.png", a camada offline AB-501)
// que a onda 2 substituiu: o cassete canonico do estagio `grafico` grava
// CINCO webm de matematica (n-009..n-013) e o estagio de composicao do
// pipeline materializa os bytes de cada um no publicDir sob exatamente
// este nome derivado. O resolvedor e o ponto onde o runtime manda: um
// caminho escrito a mao funciona no Studio e quebra no render — o bundle
// serve os arquivos de public/ sob o prefixo de runtime e o `staticFile()`
// traduz o nome para o caminho certo do bundle.
//
// Tudo aqui e PURO (nada de hook, nada de relogio, nada de disco): o mesmo
// modulo roda dentro do bundle do Remotion e dentro do teste de node.
// =============================================================================

import { staticFile } from "remotion";
import type { Manifesto, No } from "../../contratos/manifesto";
import type { PlanoDeComposicao } from "../ManifestoRaiz";
import { planoDeComposicao } from "../ManifestoRaiz";
import type { GraficoResolvido, NoGraficoResolvido } from "../nos/grafico";
import type { AssetResolvido } from "../../resolucao/manifesto-resolvido";

// ---------------------------------------------------------------------------
// Tipos da fixture integrada
// ---------------------------------------------------------------------------

/** A fixture integrada: manifesto canonico + a camada de resolucao. */
export interface FixtureIntegrada {
  schema_version: "ManifestoResolvido.1";
  hash_manifesto_original: string;
  manifesto: Manifesto;
  assets: Record<string, AssetResolvido>;
  nos_grafico: Record<string, string>;
}

/** A fixture ja fiada: manifestos e planos prontos para render. */
export interface Fiado {
  /** O manifesto com os assets anexados aos nos de grafico. */
  manifesto: Manifesto;
  /** Os nos do manifesto, indexados por id. */
  porId: ReadonlyMap<string, No>;
  /** O plano de composicao (raiz, F1-01). */
  plano: PlanoDeComposicao;
  /** Resolvedor de hash -> caminho local servido ao navegador. */
  resolverFonte: (hash: string, asset: AssetResolvido) => string;
}

// ---------------------------------------------------------------------------
// O resolvedor hash -> caminho do publicDir
// ---------------------------------------------------------------------------

/**
 * Extensao de arquivo por mimeType — a LISTA DE PERMISSAO do publicDir de
 * grafico. Um asset sem extensao mapeada e recusado: o navegador nao
 * adivinha mime de arquivo sem extensao no render, e um nome errado
 * produziria 404 sem erro de exit.
 */
export function extensaoDeMime(mimeType: string | undefined): string {
  const m = (mimeType ?? "").split(";")[0]!.trim().toLowerCase();
  switch (m) {
    case "video/webm":
      return "webm";
    case "video/mp4":
      return "mp4";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/svg+xml":
      return "svg";
    case "image/jpeg":
      return "jpg";
    case "image/bmp":
      return "bmp";
    default:
      throw new Error(
        `fiar: mimeType "${String(mimeType)}" sem extensao mapeada — o ` +
          `publicDir nao sabe servir este asset de grafico`,
      );
  }
}

/**
 * O resolvedor padrao: hash + descritor do asset -> caminho servido ao
 * navegador. Deriva o NOME do arquivo do conteudo (hash, C7) e o mimeType
 * do proprio asset — o estagio de composicao do pipeline materializa os
 * bytes exatamente sob `grafico/<hash>.<ext>` no publicDir.
 */
export function resolverPadrao(hash: string, asset: AssetResolvido): string {
  return staticFile(`grafico/${hash}.${extensaoDeMime(asset.mimeType)}`);
}

// ---------------------------------------------------------------------------
// A fiacao
// ---------------------------------------------------------------------------

/**
 * A fiacao: anexa `grafico_resolvido` a todo no de grafico que o manifesto
 * resolvido declara em `nos_grafico`.
 *
 * O resolvedor recebe o DESCRITOR do asset junto do hash: o nome do
 * arquivo no publicDir deriva do mimeType (`grafico/<hash>.webm` vs
 * `grafico/<hash>.png`) e o resolvedor sozinho nao tem como saber qual.
 */
export function fiar(
  fixture: FixtureIntegrada,
  resolverFonte: (hash: string, asset: AssetResolvido) => string,
): Fiado {
  const manifesto = JSON.parse(JSON.stringify(fixture.manifesto)) as Manifesto;
  const porId = new Map(manifesto.nos.map((no) => [no.id, no] as const));

  for (const no of manifesto.nos) {
    if (no.type !== "grafico") continue;
    const hash = fixture.nos_grafico[no.id];
    if (hash === undefined) continue;
    const asset = fixture.assets[hash];
    if (asset === undefined) {
      throw new Error(
        `fiar: nos_grafico["${no.id}"] aponta para ${hash}, que nao existe ` +
          `em assets — referencia pendurada nao vira grafico`,
      );
    }
    const resolvido: GraficoResolvido = {
      asset,
      fonte: resolverFonte(hash, asset),
    };
    // O tipo da W4 declara o campo readonly de proposito (a fiacao e o
    // unico lugar que o preenche). A anexacao e por cast de atribuicao.
    (no as NoGraficoResolvido & { grafico_resolvido?: GraficoResolvido }).grafico_resolvido =
      resolvido;
  }

  const plano = planoDeComposicao(manifesto);

  return { manifesto, porId, plano, resolverFonte };
}

/** A fixture integrada fiada, com o resolvedor padrao (staticFile). */
export function fiarApadrao(fixture: FixtureIntegrada): Fiado {
  return fiar(fixture, resolverPadrao);
}
