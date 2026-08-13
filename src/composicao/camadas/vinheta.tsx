// =============================================================================
// CAMADA GLOBAL: vinheta
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Papel `sobreposicao`: desenhada ACIMA do conteudo (tokens.zIndex.overlay).
// A vinheta e o caso mais perigoso do card. Uma vinheta bonita costuma
// atravessar 20 a 30 por cento do quadro em direcao ao centro — e ali dentro
// ela escurece o texto, sem erro nenhum, sem log nenhum, sem gate nenhum.
//
// Esta vinheta vive INTEIRA nas bandas de margem. A rampa vai do escuro na
// borda do quadro ate `OPACIDADE_MINIMA_VISIVEL` na fronteira da safe area —
// e nao ate zero. Terminar em zero pareceria mais elegante e destruiria a
// medicao: a ultima fatia teria exatamente o pixel de uma fatia que nunca foi
// desenhada, e o gate perderia a capacidade de separar "vinheta correta" de
// "componente que devolveu quadro vazio".
//
// Nada de radial-gradient: gradiente CSS e background-image, proibido em
// src/composicao/. A rampa e feita de fatias solidas de cor de token.
// =============================================================================

import { interpolate } from "remotion";
import { palette } from "../../design/tokens";
import {
  apenasVisiveis,
  opacidadeDaJanela,
  retanguloDoQuadro,
  retanguloSeguro,
  type CamadaComponent,
  type CamadaMeta,
  type CamadaProps,
  type PlanoDeCamada,
  type RetanguloPintado,
} from "./contrato-de-camada";
import { bandasDaMargem, fatiarBanda } from "./geometria";
import { pintarPlano } from "./_pintar";
import {
  OPACIDADE_DA_VINHETA,
  OPACIDADE_MINIMA_VISIVEL,
  PASSOS_DA_VINHETA,
} from "./tokens-de-camada";

export const meta: CamadaMeta = {
  nome: "vinheta",
  id: "camada-vinheta",
  papel: "sobreposicao",
  descricao: "Escurecimento escalonado da borda do quadro, contido nas bandas de margem",
};

export const plano: PlanoDeCamada = (props: CamadaProps): RetanguloPintado[] => {
  const envelope = opacidadeDaJanela(props);
  const quadro = retanguloDoQuadro(props.width, props.height);
  const seguro = retanguloSeguro(props.width, props.height);

  const retangulos: RetanguloPintado[] = [];

  for (const banda of bandasDaMargem(quadro, seguro)) {
    const fatias = fatiarBanda(banda, PASSOS_DA_VINHETA);
    for (let k = 0; k < fatias.length; k++) {
      const fatia = fatias[k];
      if (!fatia) continue;
      // k = 0 e sempre a fatia colada na borda do quadro (ver fatiarBanda).
      const intensidade = interpolate(
        k,
        [0, PASSOS_DA_VINHETA - 1],
        [OPACIDADE_DA_VINHETA, OPACIDADE_MINIMA_VISIVEL],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      retangulos.push({
        ...fatia,
        nome: `${banda.nome}-${String(k)}`,
        opacidade: intensidade * envelope,
        cor: palette.black,
      });
    }
  }

  return apenasVisiveis(retangulos);
};

const Vinheta: CamadaComponent = (props) => pintarPlano(meta, plano, props);

export default Vinheta;
