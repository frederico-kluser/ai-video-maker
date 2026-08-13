// =============================================================================
// THUMBNAIL — escolha do frame (card F5-05, W7)
// =============================================================================
// Qual frame do MESMO manifesto vira thumbnail. A regra, em funcao pura:
//
//   o meio da janela do PRIMEIRO no `cabecalho` da timeline.
//
// Por que o primeiro cabecalho: e o titulo do video (na fixture canonica,
// a cena de abertura), o conteudo mais reconhecivel de um thumbnail, e o no
// em que a mola de entrada ja acomodou (spring "suave" pousa em ~22 frames
// a 30 fps; o meio de uma janela de 90 frames e o frame 45 — mola = 1.0,
// medido, ver tests/entrega/thumbnail/frame.test.ts).
//
// A escolha sai do MESMO plano que o render usa (planoDeComposicao, F1-01):
// a janela do no vem da aritmetica de composicao, nunca recalculada por
// este modulo — um no com janela diferente aqui divergiria do video em
// silencio (a armadilha que o contrato-w7 §12 nomeia).
//
// RECUSA, nao quadro vazio: um manifesto sem nenhum no `cabecalho` nao tem
// titulo, e um thumbnail sem titulo nao e thumbnail (ThumbnailSemTitulo).
// A mesma disciplina da raiz de F1-01: manifesto torto e erro, nunca quadro
// torto.
// =============================================================================

import { planoDeComposicao } from "../../composicao/ManifestoRaiz";
import type { Manifesto } from "../../contratos/manifesto";
import { ThumbnailSemTitulo } from "./contrato";
import type { FrameDoThumbnail } from "./contrato";

/**
 * O tipo de no cujo texto vira o titulo do thumbnail.
 * E o `tipo` do contrato-de-no (src/composicao/contrato-de-no.ts), nao uma
 * lista deste modulo — o registro de nos continua a unica fonte dos tipos.
 */
export const TIPO_DO_TITULO = "cabecalho";

/**
 * Escolhe o frame do thumbnail: o meio da janela do primeiro no `cabecalho`.
 *
 * `planoDeComposicao` confere o manifesto inteiro (ErroDeComposicao em
 * manifesto torto) e devolve as faixas na ordem das cenas — o primeiro
 * cabecalho da lista e o primeiro da timeline. O meio da janela e o frame
 * de maxima visibilidade: entrada acomodada e saida ainda longe.
 */
export function escolherFrameDoThumbnail(manifesto: Manifesto): FrameDoThumbnail {
  const plano = planoDeComposicao(manifesto);
  const primeiroCabecalho = plano.faixas.find(
    (faixa) => faixa.tipo === TIPO_DO_TITULO,
  );
  if (primeiroCabecalho === undefined) {
    throw new ThumbnailSemTitulo();
  }
  return primeiroCabecalho.inicio + Math.floor(primeiroCabecalho.duracao / 2);
}
