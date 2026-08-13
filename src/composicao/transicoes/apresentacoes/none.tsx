// =============================================================================
// APRESENTACAO: none — corte seco declarado
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// `none` nao e "sem transicao": e uma transicao que NAO DESENHA nada de
// especial. A distincao importa porque `none` com `duracao_frames > 0`
// continua ENCURTANDO o video em ../tempo.ts — os dois lados existem na
// arvore, empilhados, e a cena que entra cobre a que sai.
//
// Por isso `contribuicao` e "alternados", nao "sobrepostos": os dois desenham,
// mas so um e visivel. Declarar "sobrepostos" aqui derrubaria o gate de pixel,
// e e exatamente esse o ponto de o campo existir.
//
// Na fixture canonica, a fronteira c-004 -> c-005 e `none` com duracao 0: a
// janela fica vazia e nenhuma apresentacao chega a ser montada.
// =============================================================================

import type { Apresentacao, ApresentacaoMeta } from "../contrato";

export const meta: ApresentacaoMeta = {
  tipo: "none",
  id: "transicao-none",
  descricao: "Corte seco: os dois lados existem, sem nenhuma transformacao visual",
  contribuicao: "alternados",
};

const Nenhuma: Apresentacao = ({ lado, children }) => (
  <div
    data-apresentacao={meta.tipo}
    data-lado={lado}
    style={{ position: "absolute", inset: 0 }}
  >
    {children}
  </div>
);

export default Nenhuma;
