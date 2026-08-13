// =============================================================================
// CAMADA GLOBAL: fundo
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Papel `fundo`: desenhada ABAIXO do conteudo (tokens.zIndex.background).
// Por isso ela pode ocupar o quadro inteiro sem comer nada — e por isso o
// teste dela nao e geometrico, e de ordenacao: no cenario de prova, o fundo
// nao pode mudar UM pixel dentro da safe area, porque o conteudo esta na
// frente. Subir o z-index do fundo para cima do conteudo deixa o gate
// vermelho (mutacao provada em `just camadas-invasao`).
//
// Nada de background-image: o banho de cor e feito com faixas solidas de cor
// de token em opacidade escalonada. Um gradiente CSS e background-image, e
// background-image e proibido em src/composicao/ (contrato de F1-01).
// =============================================================================

import { interpolate } from "remotion";
import { background } from "../../design/tokens";
import {
  apenasVisiveis,
  opacidadeDaJanela,
  retanguloDoQuadro,
  type CamadaComponent,
  type CamadaMeta,
  type CamadaProps,
  type PlanoDeCamada,
  type RetanguloPintado,
} from "./contrato-de-camada";
import { pintarPlano } from "./_pintar";
import {
  OPACIDADE_DO_FUNDO,
  OPACIDADE_MINIMA_VISIVEL,
  PASSOS_DO_FUNDO,
} from "./tokens-de-camada";

export const meta: CamadaMeta = {
  nome: "fundo",
  id: "camada-fundo",
  papel: "fundo",
  descricao: "Cor de base do quadro com banho vertical escalonado, abaixo do conteudo",
};

/**
 * Plano do fundo: a base do quadro inteiro, mais `PASSOS_DO_FUNDO` faixas
 * horizontais de largura total com opacidade decrescente de cima para baixo.
 *
 * As faixas usam aritmetica inteira (round no inicio e no fim de cada faixa),
 * o que as faz ladrilhar a altura sem buraco e sem sobreposicao — e sem
 * coordenada fracionaria, que e onde o antialias do navegador comeca a
 * inventar pixel de borda.
 */
export const plano: PlanoDeCamada = (props: CamadaProps): RetanguloPintado[] => {
  const envelope = opacidadeDaJanela(props);
  const quadro = retanguloDoQuadro(props.width, props.height);

  const retangulos: RetanguloPintado[] = [
    { ...quadro, nome: "base", opacidade: envelope, cor: background.primary },
  ];

  for (let k = 0; k < PASSOS_DO_FUNDO; k++) {
    const inicio = Math.round((k * props.height) / PASSOS_DO_FUNDO);
    const fim = Math.round(((k + 1) * props.height) / PASSOS_DO_FUNDO);
    const intensidade = interpolate(
      k,
      [0, PASSOS_DO_FUNDO - 1],
      [OPACIDADE_DO_FUNDO, OPACIDADE_MINIMA_VISIVEL],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
    retangulos.push({
      nome: `banho-${String(k)}`,
      x: 0,
      y: inicio,
      largura: props.width,
      altura: fim - inicio,
      opacidade: intensidade * envelope,
      cor: background.secondary,
    });
  }

  return apenasVisiveis(retangulos);
};

const Fundo: CamadaComponent = (props) => pintarPlano(meta, plano, props);

export default Fundo;
