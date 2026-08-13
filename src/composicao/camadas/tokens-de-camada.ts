// =============================================================================
// CONSTANTES DE CAMADA — o que a Regra 2 pede e src/design/tokens.ts nao tem
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// AGENTS.md Regra 2: "toda cor, espacamento, duracao, fonte e tamanho vive
// exclusivamente em src/design/tokens.ts". Cor, espessura e duracao deste card
// vem de la e NAO sao redeclaradas aqui — confira: este arquivo nao tem uma
// unica cor, nem um unico valor de espacamento.
//
// O que sobra sao duas familias que tokens.ts NAO define hoje:
//   1. OPACIDADE   — nao existe nenhum token de opacidade em tokens.ts;
//   2. CONTAGEM    — quantos passos tem a rampa, quantas colunas tem a grade.
//
// tokens.ts e o singleton S-5 e o contrato da W4 proibe este card de edita-lo
// (docs/contrato-w4.md §1). A regra da onda para esse caso e explicita: "ele
// para, nao faz, e escreve no handoff". Foi o que se fez — as constantes vivem
// aqui, dentro do diretorio exclusivo deste card, com o item de ledger AB-380
// registrando que o lugar delas e tokens.ts, como PREP da onda seguinte.
//
// Redeclarar NAO e o risco aqui: nenhum destes nomes existe em tokens.ts.
// O gate `just design-varrer` continua verde porque nenhum valor de cor,
// espacamento ou duracao foi copiado.
// =============================================================================

// ---------------------------------------------------------------------------
// Opacidade
// ---------------------------------------------------------------------------

/**
 * Opacidade minima que ainda MUDA um pixel de 8 bits.
 *
 * Este numero nao e estetico, e metrologico. Uma rampa que termina em
 * opacidade ZERO tem, na ultima fatia, exatamente o mesmo pixel de uma fatia
 * que nunca foi desenhada — e o teste perde a capacidade de distinguir
 * "camada decorativa correta" de "componente que devolveu quadro vazio".
 *
 * Sobre o fundo claro do cenario de prova (canal 249), 2% de preto da
 * 249 * 0.98 = 244.02 -> 244: cinco niveis de diferenca, muito acima do
 * ruido zero de um render deterministico.
 */
export const OPACIDADE_MINIMA_VISIVEL = 0.02;

/** Opacidade da vinheta na borda do quadro (o ponto mais escuro da rampa). */
export const OPACIDADE_DA_VINHETA = 0.62;

/** Opacidade das marcas da grade. Guia de composicao, nao elemento grafico. */
export const OPACIDADE_DA_GRADE = 0.45;

/** Opacidade maxima do banho do fundo sobre a cor de base. */
export const OPACIDADE_DO_FUNDO = 0.5;

// ---------------------------------------------------------------------------
// Contagem
// ---------------------------------------------------------------------------

/**
 * Passos da rampa da vinheta, por banda.
 * Oito fatias na margem vertical de 38 pixels dao fatias de 4 a 5 pixels:
 * abaixo disso o arredondamento inteiro comeca a produzir fatia de tamanho
 * zero, que `fatiarBanda` descarta e a medicao acusaria como retangulo
 * declarado sem pixel nenhum.
 */
export const PASSOS_DA_VINHETA = 8;

/** Faixas horizontais do banho do fundo. */
export const PASSOS_DO_FUNDO = 6;

/** Colunas da grade de composicao (convencao de 12 colunas). */
export const COLUNAS_DA_GRADE = 12;

/** Linhas da grade de composicao. */
export const LINHAS_DA_GRADE = 6;
