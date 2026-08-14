// =============================================================================
// FIACAO E ORACULO DA SUITE INTEGRADA — o ponto onde a composicao vira render
// =============================================================================
// Card: F1-12 — Suite integrada de composicao (onda W5)
//
// No PREP-w7 (AB-493) o PINTOR DE CENA DE PRODUCAO foi promovido para
// src/composicao/pintura/ — a fiacao (`fiar`), o pintor de cena das
// transicoes (`pintorDeCena`) e o pintor integrado (`pintar`/
// `ArvoreIntegrada`) agora sao codigo de producao puro, e ESTE arquivo os
// IMPORT de la, reexportando-os para o resto da suite. A suite integrada
// continua o oraculo; este arquivo mantem o que e dela: os dados da fixture
// integrada e a geometria das regioes do oraculo de conteudo.
//
// O que os oito nos da W4 declararam como suposicao (AB-364, AB-374,
// AB-383) e que nenhum card da W4 podia escrever porque so existe no join:
//
//   1. A FIACAO: anexa ao no `grafico` o descritor do asset que mora fora
//      dele — `assets[nos_grafico[no.id]]` — com `fonte` derivada do hash
//      pela fiacao (nunca gravada no manifesto resolvido; C7). Sem isso o
//      no desenha do manifesto em vez do que o estagio produziu, EM
//      SILENCIO — a fiacao esquecida nao quebra o render (AB-364).
//
//   2. O PINTOR DE CENA REAL: `SequenciaComTransicoes` (F1-10) recebe o
//      pintor INJETADO por prop (AB-374). O pintor de producao, o que pinta
//      os nos do registro de verdade dentro da janela de cada cena, vive em
//      src/composicao/pintura/. A demonstracao da W4 usava pintor chapado
//      proprio; aqui o pintor real, importado.
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

import type { Manifesto } from "../../../src/contratos/manifesto";
import {
  ArvoreIntegrada,
  fiar,
  fiarApadrao,
  resolverPadrao,
  pintorDeCena,
  type ArvoreIntegradaProps,
  type Fiado,
  type FixtureIntegrada,
} from "../../../src/composicao/pintura";
import fixtureIntegrado from "../../../fixtures/snapshots/integrado/manifesto-integrado.json";

// ---------------------------------------------------------------------------
// Reexport da camada de pintura promovida (AB-493)
// ---------------------------------------------------------------------------
// A suite inteira continua importando de ./fiar; o que mudou e que a
// implementacao vive em src/composicao/pintura/ (producao pura) e este
// arquivo apenas a reexporta junto do que e do oraculo.
export {
  ArvoreIntegrada,
  fiar,
  fiarApadrao,
  resolverPadrao,
  pintorDeCena,
};
export type { ArvoreIntegradaProps, Fiado, FixtureIntegrada };

export const FIXTURA_INTEGRADA = fixtureIntegrado as unknown as FixtureIntegrada;

/**
 * O hash do asset de grafico da fixture integrada (o PNG RGBA gerado por
 * gerar-assets.ts) — derivado da propria fixture, nunca digitado: a onda 2
 * removeu o HASH_DO_GRAFICO hardcoded da camada de pintura (o resolvedor
 * agora e data-driven) e esta suite continua precisando do identificador
 * do SEU asset para as assercoes de fiacao.
 */
export const HASH_DO_GRAFICO: string = (() => {
  const hashes = Object.keys(FIXTURA_INTEGRADA.assets);
  if (hashes.length !== 1) {
    throw new Error(
      `fiar.tsx: a fixture integrada tem ${String(hashes.length)} asset(s) — ` +
        "a suite assume exatamente um (o PNG de grafico)",
    );
  }
  return hashes[0]!;
})();

/** O manifesto canonico — a lista de presenca que o gate exige. */
export function manifestoCanonico(): Manifesto {
  return FIXTURA_INTEGRADA.manifesto;
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
