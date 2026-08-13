// =============================================================================
// THUMBNAIL — o plano de entrega, derivado do MESMO manifesto
// (card F5-05, W7)
// =============================================================================
// Pergunta adversarial (2) do card: "E gerado do MESMO manifesto (consome o
// pintor promovido — src/composicao/pintura — com um viewport de
// thumbnail), ou digitado a parte e divergindo?"
//
// A resposta: o plano abaixo e a UNICA ponte entre o manifesto e o
// thumbnail. Nada aqui re-digita texto, cor ou geometria — o texto e o do
// primeiro no `cabecalho` do manifesto, as dimensoes sao as do manifesto
// vezes uma escala, e o pixel e o do pintor promovido (`pintar`/Arvore
// Integrada, AB-493) renderizado no frame escolhido.
//
// O pintor promovido RECUSA viewport que nao case com o manifesto (regra
// viewport==manifesto, contrato da pintura — o frame pintado tem uma
// geometria so, e camadas globais e nos dividem a MESMA). Por isso a
// escala nao entra no pintor: o pintor pinta no tamanho do manifesto e o
// thumbnail e o MESMO quadro em escala menor. A divergencia de "thumbnail
// re-digitado" e impossivel por construcao: o pixel so pode ter vindo do
// pintor, e o texto do thumbnail so pode ter vindo do manifesto.
// =============================================================================

import { planoDeComposicao } from "../../composicao/ManifestoRaiz";
import { isNoCabecalho, type Manifesto } from "../../contratos/manifesto";
import { ThumbnailSemTitulo, type PlanoDoThumbnail } from "./contrato";
import { TIPO_DO_TITULO, escolherFrameDoThumbnail } from "./frame";
import { alturaDoTituloNoThumbnail } from "./legibilidade";

/**
 * Escala de saida do thumbnail: 2/3 das dimensoes do manifesto.
 * Em 1920x1080 entrega 1280x720 — o tamanho padrao de thumbnail do
 * YouTube:
 *   https://support.google.com/youtube/answer/72431 (2026-08-13)
 * A escala e um NUMERO do produto, nao um token de design (S-5, dono
 * unico) — a decisao de a promover a token fica no ledger (AB-735).
 */
export const ESCALA_DO_THUMBNAIL = 2 / 3;

/**
 * O id da composicao do thumbnail no bundle do Remotion. Vive aqui, no
 * modulo puro, para que o gate (Node) e a entrada do render (Chrome)
 * asserte a MESMA composicao — o gate importa o id sem carregar o runtime
 * do Remotion (FontFace so existe no navegador).
 */
export const ID_DA_COMPOSICAO = "thumb";

/**
 * O plano do thumbnail: frame escolhido, escala, dimensoes de saida e o
 * titulo do manifesto que o thumbnail mostra — tudo derivado, nada
 * digitado. Arredondamentos no mesmo lugar, uma unica vez: o gate renderiza
 * exatamente o que este plano diz.
 */
export function planoDoThumbnail(manifesto: Manifesto): PlanoDoThumbnail {
  const frame = escolherFrameDoThumbnail(manifesto);
  return {
    frame,
    escala: ESCALA_DO_THUMBNAIL,
    largura: Math.round(manifesto.width * ESCALA_DO_THUMBNAIL),
    altura: Math.round(manifesto.height * ESCALA_DO_THUMBNAIL),
    titulo: tituloDoThumbnail(manifesto),
    alturaDoTitulo: alturaDoTituloNoThumbnail(manifesto, ESCALA_DO_THUMBNAIL),
  };
}

/**
 * O titulo do thumbnail: o texto do primeiro no `cabecalho` do manifesto,
 * pelo MESMO plano de composicao que o render usa. Cabecalho sem texto e
 * erro nomeando o no — thumbnail sem titulo nunca e quadro vazio.
 */
export function tituloDoThumbnail(manifesto: Manifesto): string {
  const plano = planoDeComposicao(manifesto);
  const faixa = plano.faixas.find((f) => f.tipo === TIPO_DO_TITULO);
  if (faixa === undefined) {
    throw new ThumbnailSemTitulo();
  }
  if (!isNoCabecalho(faixa.no)) {
    throw new Error(
      `thumbnail: o primeiro no do tipo "${TIPO_DO_TITULO}" ("${faixa.noId}") ` +
        `nao e um cabecalho valido (schema ${faixa.no.schema})`,
    );
  }
  if (faixa.no.texto === "") {
    throw new Error(
      `thumbnail: o primeiro cabecalho ("${faixa.noId}") nao tem texto — ` +
        `thumbnail sem titulo e erro, nunca quadro vazio`,
    );
  }
  return faixa.no.texto;
}
