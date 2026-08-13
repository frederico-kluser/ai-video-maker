// =============================================================================
// CONTRATO PUBLICO DA CAMADA DE PINTURA — `pintar(manifesto, tempo, viewport)`
// =============================================================================
// Promovida do oraculo da suite integrada no PREP-w7 (AB-493): a camada de
// pintura sai de tests/integracao/composicao/fiar.tsx e passa a viver em
// src/composicao/pintura/ como codigo de producao PURO (mesma disciplina de
// comp-pureza: zero Date.now/Math.random/setTimeout/fetch, zero disco).
//
// O contrato publico, por convencao:
//
//     pintar(manifesto, tempo, viewport) -> frame
//
// - `manifesto` — o manifesto FIADO (a fiacao `fiar` ja anexou os assets aos
//   nos de grafico; um no de grafico sem `grafico_resolvido` e
//   ErroDeGraficoOpaco no componente, nao desenho silencioso);
// - `tempo` — o tempo absoluto da composicao, em frames desde o frame zero
//   (a mesma ancoragem absoluta de AB-600 para o audio);
// - `viewport` — as dimensoes do frame: fps, largura e altura;
// - `-> frame` — a arvore React do frame composto: camadas globais por baixo
//   e por cima, sequencia com transicoes no meio, nos pintados pelo pintor de
//   cena do registro.
//
// Quem consome (F5-01 no render, F5-04/F5-05 nas variantes e thumbnail)
// importa DESTE modulo e nunca reimplementa a arvore. Imports relativos —
// o bundler do Remotion nao le os `paths` do tsconfig (armadilha 9.3).
//
// O viewport TEM de casar com o manifesto (fps/largura/altura declarados):
// a sequencia deriva as dimensoes do proprio manifesto e as camadas recebem
// as do viewport — divergencia produziria um frame incoerente em silencio,
// por isso `pintar` recusa com erro nomeando a regra.
// =============================================================================

import type { ReactElement } from "react";
import type { Manifesto } from "../../contratos/manifesto";

/** As tres dimensoes do frame que a pintura precisa. */
export interface Viewport {
  fps: number;
  width: number;
  height: number;
}

/**
 * Tempo absoluto da composicao, em frames desde o frame zero.
 * A ancoragem e a mesma de AB-600: posicoes em segundos desde o byte zero
 * para o audio; frames desde o frame zero para o video.
 */
export type TempoAbsoluto = number;

/**
 * O contrato publico da pintura:
 * `pintar(manifesto, tempo, viewport) -> frame`.
 *
 * Funcao pura: o mesmo (manifesto, tempo, viewport) produz a MESMA arvore —
 * e e por isso que ela roda dentro do bundle do Remotion e dentro do teste
 * de node (react-dom/server) sem nenhuma divergencia.
 */
export type Pintar = (
  manifesto: Manifesto,
  tempo: TempoAbsoluto,
  viewport: Viewport,
) => ReactElement;
