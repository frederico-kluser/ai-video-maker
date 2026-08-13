// =============================================================================
// FIACAO — o ponto onde a composicao integrada vira render
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// Este modulo e o que os oito nos da W4 declararam como suposicao (AB-364,
// AB-374, AB-383) e que nenhum card da W4 podia escrever porque so existe no
// join:
//
//   1. A FIACAO: anexa ao no `grafico` o descritor do asset que mora fora
//      dele — `assets[nos_grafico[no.id]]` — com `fonte` derivada do hash
//      pela fiacao (nunca gravada no manifesto resolvido; C7). Sem isso o
//      no desenha do manifesto em vez do que o estagio produziu, EM
//      SILENCIO — a fiacao esquecida nao quebra o render (AB-364).
//
//   2. O PINTOR DE CENA REAL: `SequenciaComTransicoes` (F1-10) recebe o
//      pintor INJETADO por prop (AB-374). O pintor de producao, o que pinta
//      os nos do registro de verdade dentro da janela de cada cena, e este
//      arquivo. A demonstracao da W4 usava pintor chapado proprio; aqui o
//      pintor real.
//
//   3. A COMPOSICAO DAS CAMADAS com a timeline de nos (AB-383): as camadas
//      globais (fundo/grade/vinheta) cobrem a composicao inteira e se
//      posicionam por z-index (fundo abaixo, sobreposicoes acima); os nos
//      cobrem a janela de cada cena, pintados pelo pintor acima.
//
// Tudo aqui e PURO (nada de hook, nada de relogio, nada de disco): o mesmo
// modulo roda dentro do bundle do Remotion (fixtures/snapshots/integrado/
// entrada.tsx) e dentro do teste de node (vitest, react-dom/server) — e e
// por isso que o gate consegue reprovar sem navegador e o render de verdade
// consegue provar o pixel.
// =============================================================================

import { createElement, type ReactElement } from "react";
import { AbsoluteFill, staticFile } from "remotion";
import type { Manifesto, No } from "../../../src/contratos/manifesto";
import { background, fontFamily } from "../../../src/design/tokens";
import {
  planoDeComposicao,
  type PlanoDeComposicao,
} from "../../../src/composicao/ManifestoRaiz";
import { REGISTRO_DE_NOS } from "../../../src/composicao/registro";
import type {
  GraficoResolvido,
  NoGraficoResolvido,
} from "../../../src/composicao/nos/grafico";
import { CAMADAS } from "../../../src/composicao/camadas/registro";
import type {
  CamadaProps,
  ModuloDeCamada,
} from "../../../src/composicao/camadas/contrato-de-camada";
import SequenciaComTransicoes, {
  type PintorDeCena,
} from "../../../src/composicao/transicoes/sequencia";
import type { AssetResolvido } from "../../../src/resolucao/manifesto-resolvido";
import fixtureIntegrado from "../../../fixtures/snapshots/integrado/manifesto-integrado.json";

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

export const FIXTURA_INTEGRADA = fixtureIntegrado as unknown as FixtureIntegrada;

/** O manifesto canonico — a lista de presenca que o gate exige. */
export function manifestoCanonico(): Manifesto {
  return FIXTURA_INTEGRADA.manifesto;
}

// ---------------------------------------------------------------------------
// O asset de grafico — endereco por conteudo (C7)
// ---------------------------------------------------------------------------

/** SHA-256 de fixtures/snapshots/integrado/assets/grafico-integrado.png. */
export const HASH_DO_GRAFICO =
  "4dd3497f7719e4aa541f1087413be1522e47f4ac75c44eaceefcc4a8e5c4878c";

/** Nome do arquivo no publicDir da fixture integrada. */
export const NOME_DO_ARQUIVO_DO_GRAFICO = "grafico-integrado.png";

/**
 * A fiacao: anexa `grafico_resolvido` a todo no de grafico que o manifesto
 * resolvido declara em `nos_grafico`.
 *
 * Regra de ouro (AB-364): TODO asset fiado TEM de ter `fonte`. Um asset
 * resolvido sem fonte e ErroDeGraficoOpaco no componente — a fiacao pela
 * metade nao vira desenho local.
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

/** A fixture integrada fiada, com o resolvedor de fonte padrao (staticFile). */
export function fiarApadrao(): Fiado {
  return fiar(FIXTURA_INTEGRADA, resolverPadrao);
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

// ---------------------------------------------------------------------------
// Fixtures pequenas — o oraculo de conteudo por no, no quadro composto
// ---------------------------------------------------------------------------
// A fixture canonica inteira tem cenas multino (o marcador de midia fica
// coberto pelo fundo opaco de nos irmaos — comportamento real da
// composicao), entao o oraculo de ALFA do quadro composto (AB-344/AB-390)
// roda nestas duas composicoes de UMA cena e UM no: o que a regiao do no
// mostra so pode ter vindo do proprio no.
//
// Os nos sao clonados da fixture canonica — os mesmos dados, isolados.

function clonar<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

const CANONICO_PARA_FIXTURAS = FIXTURA_INTEGRADA.manifesto;

const NO_MIDIA = CANONICO_PARA_FIXTURAS.nos.find((n) => n.id === "n-005");
const NO_GRAFICO = CANONICO_PARA_FIXTURAS.nos.find((n) => n.id === "n-009");
if (NO_MIDIA === undefined || NO_GRAFICO === undefined) {
  throw new Error("fiar: n-005/n-009 ausentes da fixture canonica");
}

/** Uma cena, um no de midia (imagem) — o marcador sobre o fundo da cena. */
export const FIXTURA_MIDIA: FixtureIntegrada = {
  schema_version: "ManifestoResolvido.1",
  hash_manifesto_original: FIXTURA_INTEGRADA.hash_manifesto_original,
  manifesto: {
    schema_version: CANONICO_PARA_FIXTURAS.schema_version,
    fps: CANONICO_PARA_FIXTURAS.fps,
    width: CANONICO_PARA_FIXTURAS.width,
    height: CANONICO_PARA_FIXTURAS.height,
    nos: [clonar(NO_MIDIA)],
    cenas: [{ id: "c-001", nos: ["n-005"] }],
  },
  assets: {},
  nos_grafico: {},
};

/** Uma cena, um no de grafico com o asset fiado — a prova do asset no quadro. */
export const FIXTURA_GRAFICO_ASSET: FixtureIntegrada = {
  schema_version: "ManifestoResolvido.1",
  hash_manifesto_original: FIXTURA_INTEGRADA.hash_manifesto_original,
  manifesto: {
    schema_version: CANONICO_PARA_FIXTURAS.schema_version,
    fps: CANONICO_PARA_FIXTURAS.fps,
    width: CANONICO_PARA_FIXTURAS.width,
    height: CANONICO_PARA_FIXTURAS.height,
    nos: [clonar(NO_GRAFICO)],
    cenas: [{ id: "c-001", nos: ["n-009"] }],
  },
  assets: FIXTURA_INTEGRADA.assets,
  nos_grafico: { "n-009": HASH_DO_GRAFICO },
};

// ---------------------------------------------------------------------------
// O pintor de cena REAL
// ---------------------------------------------------------------------------

/**
 * O pintor de cena de producao: pinta os nos do registro dentro da janela
 * da cena, com o frame local de cada no derivado do relogio da cena.
 *
 * `frame` chega local da CENA (0 = primeiro frame da cena). O no tem o
 * proprio relogio: `frame - entrada_frames`. Fora da janela do no, nada e
 * emitido — os proprios nos ja recusam (contrato de F1-01), e esta dupla
 * guarda e o que a pergunta adversarial 4 da W4 cobrou.
 *
 * A ordem de pintura e a ordem declarada em `cena.nos` — a mesma do plano
 * da raiz (ManifestoRaiz). Quem pinta por ultimo fica por cima.
 */
export function pintorDeCena(estado: Fiado): PintorDeCena {
  const { manifesto, porId, plano } = estado;
  const cenaPorId = new Map(manifesto.cenas.map((c) => [c.id, c] as const));

  const Pintor: PintorDeCena = ({ cenaId, frame, fps, width, height }) => {
    const cena = cenaPorId.get(cenaId);
    if (cena === undefined) {
      throw new Error(`pintorDeCena: cena "${cenaId}" nao existe no manifesto`);
    }
    return createElement(
      "div",
      { "data-cena": cenaId, "data-frame": String(frame), style: { position: "absolute", inset: 0 } },
      cena.nos.map((noId) => {
        const no = porId.get(noId);
        if (no === undefined) {
          throw new Error(
            `pintorDeCena: cena "${cenaId}" referencia no inexistente "${noId}"`,
          );
        }
        const entrada = no.entrada_frames ?? 0;
        const local = frame - entrada;
        if (local < 0 || local >= no.duracao_frames) return null;
        const modulo = REGISTRO_DE_NOS.get(no.type);
        if (modulo === undefined) {
          throw new Error(
            `pintorDeCena: tipo "${no.type}" do no "${noId}" nao tem componente ` +
              `registrado em src/composicao/registro.ts`,
          );
        }
        const Componente = modulo.componente;
        return createElement(Componente, {
          key: noId,
          no,
          frame: local,
          fps,
          width,
          height,
        });
      }),
    );
  };

  void plano;
  return Pintor;
}

// ---------------------------------------------------------------------------
// A arvore integrada — camadas + sequencia com transicoes + nos
// ---------------------------------------------------------------------------

export interface ArvoreIntegradaProps {
  fixture: FixtureIntegrada;
  frame: number;
}

/**
 * A composicao integrada, em arvore pura:
 *
 *   <AbsoluteFill bg={background.primary}>
 *     <CAMADAS.../>                    <- fundo (z 0), grade e vinheta (z 20)
 *     <SequenciaComTransicoes          <- quem decide as cenas do frame
 *        Cena={pintorDeCena(estado)}/> <- o pintor REAL, injetado
 *   </AbsoluteFill>
 *
 * As camadas se posicionam por z-index (tokens.zIndex.background/overlay);
 * o palco das transicoes fica entre as duas — e por isso que a vinheta
 * cobre o conteudo e o fundo nao.
 *
 * `fixture` e injetada de proposito: e a mesma funcao que o ∅-crit usa
 * quando muta a fixture (remove um no) para exigir que o gate fique
 * VERMELHO POR AUSENCIA.
 */
export function ArvoreIntegrada({
  fixture,
  frame,
}: ArvoreIntegradaProps): ReactElement {
  const estado = fiar(fixture, resolverPadrao);
  const propsDeCamada: CamadaProps = {
    frame,
    fps: estado.plano.fps,
    width: estado.plano.width,
    height: estado.plano.height,
    duracaoEmFrames: estado.plano.totalFrames,
  };

  return createElement(
    AbsoluteFill,
    {
      style: {
        backgroundColor: background.primary,
        fontFamily: fontFamily.sans,
      },
    },
    CAMADAS.map((modulo: ModuloDeCamada) =>
      createElement(modulo.componente, { ...propsDeCamada, key: modulo.meta.id }),
    ),
    createElement(SequenciaComTransicoes, {
      manifesto: estado.manifesto,
      frame,
      Cena: pintorDeCena(estado),
    }),
  );
}

// ---------------------------------------------------------------------------
// Geometria das regioes do oraculo de conteudo (AB-344, AB-390)
// ---------------------------------------------------------------------------

/**
 * Regiao interna da caixa do marcador de midia, no quadro composto.
 * A caixa e `inset: margem` (safeArea16x9.graphicsSafePct do menor lado); a
 * regiao usada pelo oraculo e o INTERIOR, afastada da borda para nao medir
 * o contorno tracejado — o que se mede e o alfa preservado do interior.
 */
export function regiaoInternaDaMidia(largura: number, altura: number): {
  x: number;
  y: number;
  largura: number;
  altura: number;
} {
  const margem = Math.round(Math.min(largura, altura) * 0.05);
  const afastamento = 16;
  const x = margem + afastamento;
  const y = margem + afastamento;
  return {
    x,
    y,
    largura: largura - 2 * (margem + afastamento),
    altura: altura - 2 * (margem + afastamento),
  };
}

/**
 * Regiao de desenho do no `grafico` no quadro composto — a mesma aritmetica
 * do componente (respiro = spacing["16"], titulo = typeScale.title).
 * A regiao contem a imagem do asset (objectFit contain) E as margens
 * transparentes do letterbox — os dois lados da moeda do oraculo: tinta do
 * grafico presente, fundo da cena visivel onde o grafico e transparente.
 */
export function regiaoDoGrafico(
  largura: number,
  altura: number,
  temTitulo: boolean,
): { x: number; y: number; largura: number; altura: number } {
  const respiro = 64; // spacing["16"]
  const tamanhoTitulo = Math.round(altura * 0.035); // typeScale.title
  const alturaTitulo = temTitulo ? tamanhoTitulo + 24 : 0; // spacing["6"] = 24
  const tamanhoRotulos = Math.round(altura * 0.018) + 16; // caption + spacing["4"]
  return {
    x: respiro,
    y: respiro + alturaTitulo,
    largura: largura - respiro * 2,
    altura: altura - respiro * 2 - alturaTitulo - tamanhoRotulos,
  };
}
