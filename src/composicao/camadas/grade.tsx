// =============================================================================
// CAMADA GLOBAL: grade
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Papel `sobreposicao`: desenhada ACIMA do conteudo (tokens.zIndex.overlay).
// Cada pixel dela apaga um pixel de conteudo.
//
// A DECISAO DE PROJETO QUE O CARD FORCA
//
// A grade de composicao "obvia" sao linhas atravessando o quadro inteiro.
// Essa grade cobre a safe area por construcao: ela risca exatamente a regiao
// onde o texto vive, e o build passa, porque tecnicamente tudo renderizou.
//
// Esta grade e desenhada como MARCA DE REGISTRO na margem: cada divisao de
// coluna vira um tracinho na banda de topo e na de base, cada divisao de
// linha vira um tracinho na banda esquerda e na direita. A grade continua
// legivel — da para ver onde cai cada coluna — e nao encosta no conteudo.
//
// A garantia nao e disciplina, e estrutura: TODO retangulo do plano sai de
// `recortar(marca, banda)` sobre uma banda de `bandasDaMargem`, e nenhuma
// banda de margem intersecta a safe area. Cobrado por teste, e conferido no
// pixel pelo gate `just no-camadas`.
// =============================================================================

import { border, spacing } from "../../design/tokens";
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
import { areaDe, bandasDaMargem, recortar, type Banda } from "./geometria";
import { pintarPlano } from "./_pintar";
import {
  COLUNAS_DA_GRADE,
  LINHAS_DA_GRADE,
  OPACIDADE_DA_GRADE,
} from "./tokens-de-camada";

export const meta: CamadaMeta = {
  nome: "grade",
  id: "camada-grade",
  papel: "sobreposicao",
  descricao: "Marcas de registro das divisoes de coluna e linha, so nas bandas de margem",
};

/** Espessura da marca — espacamento de token, nunca literal. */
const ESPESSURA = spacing["1"];

/** Acha a banda pelo nome; ausente quando a margem daquele lado e zero. */
function banda(bandas: Banda[], nome: Banda["nome"]): Banda | undefined {
  return bandas.find((b) => b.nome === nome);
}

export const plano: PlanoDeCamada = (props: CamadaProps): RetanguloPintado[] => {
  const envelope = opacidadeDaJanela(props);
  const opacidade = OPACIDADE_DA_GRADE * envelope;
  const quadro = retanguloDoQuadro(props.width, props.height);
  const seguro = retanguloSeguro(props.width, props.height);
  const bandas = bandasDaMargem(quadro, seguro);

  const retangulos: RetanguloPintado[] = [];

  // --- Divisoes de coluna: tracinho vertical nas bandas de topo e de base ---
  for (let i = 0; i <= COLUNAS_DA_GRADE; i++) {
    const centro = seguro.x + Math.round((i * seguro.largura) / COLUNAS_DA_GRADE);
    const marca = {
      x: centro - Math.round(ESPESSURA / 2),
      y: 0,
      largura: ESPESSURA,
      altura: props.height,
    };
    for (const lado of ["topo", "base"] as const) {
      const alvo = banda(bandas, lado);
      if (!alvo) continue;
      const recortado = recortar(marca, alvo);
      if (areaDe(recortado) === 0) continue;
      retangulos.push({
        ...recortado,
        nome: `coluna-${String(i)}-${lado}`,
        opacidade,
        cor: border.default,
      });
    }
  }

  // --- Divisoes de linha: tracinho horizontal nas bandas laterais ---
  for (let j = 0; j <= LINHAS_DA_GRADE; j++) {
    const centro = seguro.y + Math.round((j * seguro.altura) / LINHAS_DA_GRADE);
    const marca = {
      x: 0,
      y: centro - Math.round(ESPESSURA / 2),
      largura: props.width,
      altura: ESPESSURA,
    };
    for (const lado of ["esquerda", "direita"] as const) {
      const alvo = banda(bandas, lado);
      if (!alvo) continue;
      const recortado = recortar(marca, alvo);
      if (areaDe(recortado) === 0) continue;
      retangulos.push({
        ...recortado,
        nome: `linha-${String(j)}-${lado}`,
        opacidade,
        cor: border.default,
      });
    }
  }

  return apenasVisiveis(retangulos);
};

const Grade: CamadaComponent = (props) => pintarPlano(meta, plano, props);

export default Grade;
