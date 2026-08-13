// =============================================================================
// GEOMETRIA DE CAMADA — retangulos, intersecao e bandas de margem
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// Por que um modulo de geometria e nao "olhar o resultado": uma vinheta que
// invade a safe area COME O CONTEUDO e o build passa, porque tecnicamente
// tudo renderizou. A unica defesa e MEDIR — e para medir e preciso que a
// camada declare, em numero, o retangulo que ela pinta.
//
// Este modulo e aritmetica pura: nada de React, nada de disco, nada de relogio.
// =============================================================================

// ---------------------------------------------------------------------------
// Retangulo
// ---------------------------------------------------------------------------

/**
 * Retangulo em coordenadas de pixel do quadro.
 * Origem no canto superior esquerdo; `x` cresce para a direita, `y` para baixo.
 * As bordas sao SEMI-ABERTAS: o retangulo ocupa [x, x+largura) e [y, y+altura).
 * Dois retangulos que se encostam na borda NAO se intersectam.
 */
export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Coordenada da borda direita (exclusiva). */
export function direitaDe(r: Retangulo): number {
  return r.x + r.largura;
}

/** Coordenada da borda inferior (exclusiva). */
export function baixoDe(r: Retangulo): number {
  return r.y + r.altura;
}

/** Area em pixels. Retangulo degenerado tem area zero, nunca negativa. */
export function areaDe(r: Retangulo): number {
  return Math.max(0, r.largura) * Math.max(0, r.altura);
}

/** Retangulo vazio canonico — usado quando nao ha intersecao. */
export const RETANGULO_VAZIO: Retangulo = { x: 0, y: 0, largura: 0, altura: 0 };

/**
 * Intersecao de dois retangulos. Devolve `RETANGULO_VAZIO` quando eles apenas
 * se encostam ou nao se tocam — encostar nao e invadir.
 */
export function intersecaoDe(a: Retangulo, b: Retangulo): Retangulo {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const largura = Math.min(direitaDe(a), direitaDe(b)) - x;
  const altura = Math.min(baixoDe(a), baixoDe(b)) - y;
  if (largura <= 0 || altura <= 0) return RETANGULO_VAZIO;
  return { x, y, largura, altura };
}

/** Area da intersecao — o numero que o teste de invasao compara com zero. */
export function areaDaIntersecao(a: Retangulo, b: Retangulo): number {
  return areaDe(intersecaoDe(a, b));
}

/** `true` quando os retangulos compartilham ao menos um pixel. */
export function intersecta(a: Retangulo, b: Retangulo): boolean {
  return areaDaIntersecao(a, b) > 0;
}

/** `true` quando `interno` cabe inteiro dentro de `externo`. */
export function contem(externo: Retangulo, interno: Retangulo): boolean {
  return (
    interno.x >= externo.x &&
    interno.y >= externo.y &&
    direitaDe(interno) <= direitaDe(externo) &&
    baixoDe(interno) <= baixoDe(externo)
  );
}

/** `true` quando o ponto (px, py) cai dentro do retangulo (borda direita/inferior exclusiva). */
export function contemPonto(r: Retangulo, px: number, py: number): boolean {
  return px >= r.x && px < direitaDe(r) && py >= r.y && py < baixoDe(r);
}

/** Recorta `alvo` para dentro de `limite`. Fora do limite vira retangulo vazio. */
export function recortar(alvo: Retangulo, limite: Retangulo): Retangulo {
  return intersecaoDe(alvo, limite);
}

// ---------------------------------------------------------------------------
// Bandas de margem — o unico territorio de uma camada de sobreposicao
// ---------------------------------------------------------------------------

/** Nome de cada banda, na ordem deterministica em que sao geradas. */
export const NOMES_DAS_BANDAS = ["topo", "base", "esquerda", "direita"] as const;

export type NomeDeBanda = (typeof NOMES_DAS_BANDAS)[number];

/** Uma banda de margem: retangulo + nome, para a mensagem de erro nomear o lado. */
export interface Banda extends Retangulo {
  nome: NomeDeBanda;
}

/**
 * Divide a margem entre `quadro` e `interno` em quatro bandas que LADRILHAM
 * a margem: nao se sobrepoem entre si e nenhuma intersecta `interno`.
 *
 * topo e base ocupam a largura inteira; esquerda e direita ocupam apenas a
 * altura de `interno`. E por isso que os quatro retangulos somados dao
 * exatamente a area da margem — propriedade cobrada em teste.
 */
export function bandasDaMargem(quadro: Retangulo, interno: Retangulo): Banda[] {
  const alvo = intersecaoDe(interno, quadro);
  const bandas: Banda[] = [
    { nome: "topo", x: quadro.x, y: quadro.y, largura: quadro.largura, altura: alvo.y - quadro.y },
    {
      nome: "base",
      x: quadro.x,
      y: baixoDe(alvo),
      largura: quadro.largura,
      altura: baixoDe(quadro) - baixoDe(alvo),
    },
    { nome: "esquerda", x: quadro.x, y: alvo.y, largura: alvo.x - quadro.x, altura: alvo.altura },
    {
      nome: "direita",
      x: direitaDe(alvo),
      y: alvo.y,
      largura: direitaDe(quadro) - direitaDe(alvo),
      altura: alvo.altura,
    },
  ];
  return bandas.filter((b) => areaDe(b) > 0);
}

/**
 * Divide uma banda em `passos` fatias PERPENDICULARES a borda do quadro, da
 * borda para o miolo. Coordenadas inteiras: a fatia k vai de round(k*d/n) a
 * round((k+1)*d/n), o que ladrilha a banda sem buraco e sem sobreposicao.
 *
 * `k = 0` e sempre a fatia colada na borda do quadro — e por isso que a
 * rampa da vinheta pode ser escrita uma vez so para os quatro lados.
 */
export function fatiarBanda(banda: Banda, passos: number): Retangulo[] {
  if (passos <= 0) return [];
  const horizontal = banda.nome === "esquerda" || banda.nome === "direita";
  const extensao = horizontal ? banda.largura : banda.altura;
  // Da borda do quadro para o miolo: em "base" e "direita" a ordem se inverte.
  const daBordaParaODentro = banda.nome === "topo" || banda.nome === "esquerda";

  const fatias: Retangulo[] = [];
  for (let k = 0; k < passos; k++) {
    const inicio = Math.round((k * extensao) / passos);
    const fim = Math.round(((k + 1) * extensao) / passos);
    const tamanho = fim - inicio;
    if (tamanho <= 0) continue;
    const deslocamento = daBordaParaODentro ? inicio : extensao - fim;
    fatias.push(
      horizontal
        ? { x: banda.x + deslocamento, y: banda.y, largura: tamanho, altura: banda.altura }
        : { x: banda.x, y: banda.y + deslocamento, largura: banda.largura, altura: tamanho },
    );
  }
  return fatias;
}
