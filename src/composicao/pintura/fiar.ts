// =============================================================================
// FIACAO — o ponto onde o manifesto resolvido vira manifesto pintavel
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
// Promovido para src/composicao/pintura/ no PREP-w7 (AB-493).
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
  resolverFonte: (hash: string) => string;
}

// ---------------------------------------------------------------------------
// O asset de grafico — endereco por conteudo (C7)
// ---------------------------------------------------------------------------

/**
 * SHA-256 dos bytes de grafico da fixture canonica:
 * fixtures/canonico/assets/grafico-integrado.png — o MESMO PNG RGBA
 * deterministico da fixture integrada
 * (fixtures/snapshots/integrado/assets/grafico-integrado.png), commitado no
 * PREP-w7 (AB-501). O hash e a chave do store por conteudo.
 */
export const HASH_DO_GRAFICO =
  "4dd3497f7719e4aa541f1087413be1522e47f4ac75c44eaceefcc4a8e5c4878c";

/** Nome do arquivo no publicDir da fixture integrada. */
export const NOME_DO_ARQUIVO_DO_GRAFICO = "grafico-integrado.png";

/**
 * A fiacao: anexa `grafico_resolvido` a todo no de grafico que o manifesto
 * resolvido declara em `nos_grafico`.
 */
export function fiar(
  fixture: FixtureIntegrada,
  resolverFonte: (hash: string) => string,
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
      fonte: resolverFonte(hash),
    };
    // O tipo da W4 declara o campo readonly de proposito (a fiacao e o
    // unico lugar que o preenche). A anexacao e por cast de atribuicao.
    (no as NoGraficoResolvido & { grafico_resolvido?: GraficoResolvido }).grafico_resolvido =
      resolvido;
  }

  const plano = planoDeComposicao(manifesto);

  return { manifesto, porId, plano, resolverFonte };
}

/**
 * O resolvedor de fonte padrao: hash -> caminho servido ao navegador.
 *
 * A resolucao passa por `staticFile()` do Remotion — e ISTO que a fiacao
 * da W4 declarou como suposicao (AB-364): a fonte e o caminho local JA
 * RESOLVIDO, e o resolvedor e o ponto onde o runtime manda. Um caminho
 * escrito a mao ("/grafico-integrado.png") funciona no Studio e quebra no
 * render: o bundle serve os arquivos de public/ sob o prefixo de runtime
 * (`/public/...`), e o `staticFile()` e quem traduz o nome para o caminho
 * certo do bundle. Achado da propria suite integrada — o primeiro render
 * 404ou exatamente por isso.
 *
 * No teste de node (sem `window`) o staticFile devolve a forma relativa:
 * e o mesmo valor que o markup do teste espera.
 */
export function resolverPadrao(hash: string): string {
  if (hash === HASH_DO_GRAFICO) {
    return staticFile(NOME_DO_ARQUIVO_DO_GRAFICO);
  }
  throw new Error(
    `fiar: nao existe mapeamento hash->arquivo para ${hash} no publicDir ` +
      `da fixture integrada (conhecido: ${HASH_DO_GRAFICO})`,
  );
}

/** A fixture integrada fiada, com o resolvedor de fonte padrao (staticFile). */
export function fiarApadrao(fixture: FixtureIntegrada): Fiado {
  return fiar(fixture, resolverPadrao);
}
