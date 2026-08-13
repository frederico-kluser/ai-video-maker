// =============================================================================
// SONDAS NEGATIVAS — camadas que existem para ser REPROVADAS
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// ADR-0001, Regra 3: nenhum estagio comeca sem oraculo CAPAZ DE REPROVA-LO.
// Um gate que so foi visto passando nunca foi visto funcionando (C2).
//
// As duas sondas sao os dois modos de falha do card, escritos de proposito:
//
//   `invasora` — a vinheta "bonita", que entra 12% do quadro em direcao ao
//                centro. Ela come conteudo, e todo render dela sai lindo e
//                sem um unico erro. O gate TEM de ficar vermelho nela.
//
//   `vazia`    — a camada que nao desenha nada. Num componente decorativo
//                este e o falso verde maximo: um fundo que nao pinta nada e
//                indistinguivel de um fundo transparente correto, e o codigo
//                de saida do render e 0 nos dois casos.
//
// Elas NAO vivem em src/composicao/camadas/: nao sao descobertas como camada,
// nao entram em `registro.ts`, nao chegam ao video.
// =============================================================================

import { interpolate } from "remotion";
import { palette, safeArea16x9 } from "../../../design/tokens";
import {
  apenasVisiveis,
  opacidadeDaJanela,
  retanguloDoQuadro,
  retanguloSeguro,
  type CamadaComponent,
  type CamadaMeta,
  type CamadaProps,
  type ModuloDeCamada,
  type PlanoDeCamada,
  type RetanguloPintado,
} from "../contrato-de-camada";
import { bandasDaMargem, fatiarBanda, type Retangulo } from "../geometria";
import { pintarPlano } from "../_pintar";
import {
  OPACIDADE_DA_VINHETA,
  OPACIDADE_MINIMA_VISIVEL,
  PASSOS_DA_VINHETA,
} from "../tokens-de-camada";

// ---------------------------------------------------------------------------
// Sonda 1 — vinheta deslocada para DENTRO da safe area
// ---------------------------------------------------------------------------

export const metaInvasora: CamadaMeta = {
  nome: "invasora",
  id: "sonda-camada-invasora",
  papel: "sobreposicao",
  descricao: "SONDA NEGATIVA: vinheta que avanca para dentro da safe area",
};

/**
 * O deslocamento da invasao: soma-se ao percentual de action safe, de modo
 * que a vinheta passe a mirar um retangulo MENOR que a safe area e a rampa
 * atravesse a fronteira. E o erro de projeto real — escolher a margem pela
 * estetica em vez de pelo retangulo protegido.
 */
export const AVANCO_DA_INVASORA = 0.12;

/** O retangulo que a sonda usa no lugar da safe area: encolhido de proposito. */
export function retanguloEncolhido(largura: number, altura: number): Retangulo {
  const dx = Math.round(largura * AVANCO_DA_INVASORA);
  const dy = Math.round(altura * AVANCO_DA_INVASORA);
  const seguro = retanguloSeguro(largura, altura);
  return {
    x: seguro.x + dx,
    y: seguro.y + dy,
    largura: seguro.largura - 2 * dx,
    altura: seguro.altura - 2 * dy,
  };
}

export const planoInvasora: PlanoDeCamada = (
  props: CamadaProps,
): RetanguloPintado[] => {
  const envelope = opacidadeDaJanela(props);
  const quadro = retanguloDoQuadro(props.width, props.height);
  const alvo = retanguloEncolhido(props.width, props.height);

  const retangulos: RetanguloPintado[] = [];
  for (const banda of bandasDaMargem(quadro, alvo)) {
    const fatias = fatiarBanda(banda, PASSOS_DA_VINHETA);
    for (let k = 0; k < fatias.length; k++) {
      const fatia = fatias[k];
      if (!fatia) continue;
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

const Invasora: CamadaComponent = (props) =>
  pintarPlano(metaInvasora, planoInvasora, props);

// ---------------------------------------------------------------------------
// Sonda 2 — a camada que nao desenha nada
// ---------------------------------------------------------------------------

export const metaVazia: CamadaMeta = {
  nome: "vazia",
  id: "sonda-camada-vazia",
  papel: "sobreposicao",
  descricao: "SONDA NEGATIVA: camada que renderiza quadro vazio",
};

export const planoVazia: PlanoDeCamada = (): RetanguloPintado[] => [];

const Vazia: CamadaComponent = (props) => pintarPlano(metaVazia, planoVazia, props);

// ---------------------------------------------------------------------------
// Catalogo das sondas
// ---------------------------------------------------------------------------

export const SONDAS: readonly ModuloDeCamada[] = Object.freeze([
  { meta: metaInvasora, componente: Invasora, plano: planoInvasora },
  { meta: metaVazia, componente: Vazia, plano: planoVazia },
]);

/**
 * A margem de action safe usada pelo card, em percentual. Reexportada aqui
 * so para a sonda documentar contra o que ela esta errando de proposito.
 */
export const PERCENTUAL_DE_ACTION_SAFE = safeArea16x9.actionSafePct;
