// =============================================================================
// Identidade das composicoes de snapshot do no de texto — F1-05
// =============================================================================
// Modulo SEM EFEITO COLATERAL de proposito: e importado tanto pelo bundle do
// navegador (Root.tsx / index.tsx) quanto pelo harness que roda em Node
// (provar.ts). Root.tsx registra as fontes locais no escopo do modulo, o que
// so funciona dentro do navegador do render — importa-lo do Node quebra com
// "FontFace is not defined". Por isso o que os dois lados compartilham mora
// aqui, e nao la.
// =============================================================================

/** Destaque palavra a palavra: o no traz `timing_palavras`. */
export const ID_COM_TIMING = "no-texto-com-timing";

/** Degradacao para frase: o MESMO no, sem o campo de timing. */
export const ID_SEM_TIMING = "no-texto-sem-timing";

/** Controle negativo: o quadro que sairia com o componente devolvendo null. */
export const ID_CONTROLE_VAZIO = "no-texto-controle-vazio";

/** fps da fixture. E o mesmo da fixture canonica de F0-09. */
export const FPS = 30;

/**
 * Frames escolhidos, e por que.
 *
 * Com o timing da fixture (9 palavras, 500 ms de passo, 450 ms de fala) e
 * fps 30, as janelas em frames sao:
 *
 *   0 "O"         [  0,  14)
 *   1 "manifesto" [ 15,  29)
 *   2 "resolvido" [ 30,  44)
 *   3 "carrega"   [ 45,  59)
 *   4 "o"         [ 60,  74)
 *   5 "timing"    [ 75,  89)
 *   6 "de"        [ 90, 104)
 *   7 "cada"      [105, 119)
 *   8 "palavra."  [120, 134)
 */
export const FRAME_ALVO = 45;
export const FRAME_ALTERNATIVO = 15;
