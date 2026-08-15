/**
 * src/roteiro/construir/mapear.ts
 *
 * O mapeamento tipo_visual -> nos do Manifesto.1, puro e testavel.
 *
 * TABELA DO CONTRATO (docs/roteiro/contrato-roteiro.md §3/§5 — a autoridade):
 *
 *   cabecalho -> NoCabecalho
 *   texto     -> NoTexto
 *   lista     -> NoLista
 *   gif       -> NoMidia { tipo_midia: "gif",   hash: anexo_hash }
 *   video     -> NoMidia { tipo_midia: "video", hash: anexo_hash }
 *   grafico   -> NoGrafico
 *   manim     -> NoGrafico (mesmo estagio grafico — ver decisao abaixo)
 *
 * Cada pedaco vira UMA cena e UM no: o pedaco e o slide do site, e o
 * visual do slide e uma coisa so. A fala nao e no — ela vira
 * `audio_cena.texto_locucao` (responsabilidade de construir.ts, regra do
 * contrato §5: so quando narracao.origem ∈ {tts, gravacao}).
 *
 * DECISOES DE MAPEAMENTO (a tabela nao cobre o conteudo livre — o contrato
 * delega ao construtor, §3: "o construtor resolve o mapeamento — e dele"):
 *
 * 1. `manim` (animacao 3blue1brown) NAO e expressavel no vocabulario
 *    fechado de nos: nenhum No carrega uma especificacao de animacao
 *    livre. O mapeamento mais fiel e NoGrafico, porque o estagio de
 *    resolucao `grafico` (src/resolucao/grafico/estagio.ts) e o UNICO que
 *    fala com o runner Manim, e ele so consome nos do tipo `grafico`.
 *    A cena Manim renderizada e uma das cinco cenas do catalogo fixo do
 *    estagio, escolhida por `detectarCenaManim` a partir das palavras da
 *    especificacao (o estagio mapeia tipo_grafico -> cena: barras=einstein,
 *    linha=riemann, pizza=euler, area=taylor, dispersao=circulo). O texto
 *    livre da especificacao NAO sobrevive ao manifesto: o schema do
 *    NoGrafico nao tem campo de texto livre (additionalProperties:false),
 *    e fabricar um campo seria emissao invalida. A perda e deliberada e
 *    nomeada aqui: um pedaco `manim` renderiza a cena do catalogo do seu
 *    tipo, nunca a animacao descrita na especificacao — o vocabulario do
 *    Manifesto.1 nao conhece "quadrado laranja guardando o resultado".
 * 2. `grafico` NAO carrega dados: o Pedaco do contrato nao tem campo de
 *    serie. `extrairDados` sintetiza uma serie a partir dos NUMEROS da
 *    especificacao (regra deterministica, documentada na funcao); sem
 *    numeros, um unico dado placeholder valido. O gerador (irmao de onda)
 *    pode passar dados reais na especificacao ("valores: 120, 45, 78") se
 *    o grafico precisar ser real.
 * 3. `gif`/`video` exigem `anexo_hash` (regra anexo-exigido-para-gif-video
 *    do contrato — C7: endereco por conteudo, nunca URL). Pedaco gif/video
 *    sem anexo NAO e mapeavel: o NoMidia exige `hash` de 64 hex. Falha
 *    nomeada (ErroAnexoAusente), nunca emissao invalida nem fabricacao de
 *    hash. A `licenca` do NoMidia e o enquadramento de uso pessoal do
 *    ADR-0003 (o anexo e conteudo do proprio usuario); a licenca EFETIVA
 *    atravessa a ponte pela procedencia do store, nunca por este campo
 *    (REGRA_LICENCA_DE_PROCEDENCIA da ponte).
 * 4. `ajuste: "contain"` para gif/video do usuario: conteudo alheio nao
 *    e cortado por cover — o usuario precisa ver o anexo inteiro.
 * 5. `cabecalho`: o titulo do slide e o texto grande; a especificacao e o
 *    subtitulo (e o que o slide "mostra" descrito em prosa).
 * 6. `lista`: a especificacao e dividida por quebras de linha (uma linha =
 *    um item). Sem quebra de linha, um item so. Linhas vazias sao podadas.
 *
 * A funcao e TOTAL e DETERMINISTICA: mesmo pedaco + mesmo id + mesma
 * duracao produzem o mesmo no, byte a byte (a base do cache por conteudo
 * do preview, C7/FQ-P1).
 */

import type { No, TipoGrafico } from "../../contratos/manifesto.js";
import { REGRA_ANEXO_EXIGIDO } from "../contrato/validar.js";
import type { Pedaco } from "../contrato/contrato.js";

// ─── Constantes do mapeamento ─────────────────────────────────────────────────

/**
 * Identificador de licenca declarado no NoMidia de um anexo do usuario.
 *
 * O anexo e conteudo do proprio usuario (gravacao de tela, gif escolhido
 * por ele), enquadrado no uso PESSOAL do programa (ADR-0003, D1). A ponte
 * AB-550 exige licenca na procedencia do store — este identificador
 * declara o enquadramento no manifesto; a licenca efetiva vem da
 * procedencia, nunca digitada aqui.
 */
export const LICENCA_ANEXO_USUARIO = "uso-pessoal-ADR-0003";

/** Erro nomeado: gif/video sem anexo_hash nao e mapeavel (regra do contrato). */
export class ErroAnexoAusente extends Error {
  readonly code = "ANEXO_EXIGIDO_PARA_GIF_VIDEO";
  readonly regra = REGRA_ANEXO_EXIGIDO;
  constructor(pedacoId: string, tipoVisual: string) {
    super(
      `pedaco "${pedacoId}" tipo_visual "${tipoVisual}" sem anexo_hash — ` +
        `regra ${REGRA_ANEXO_EXIGIDO}: o NoMidia do Manifesto.1 exige o ` +
        `SHA-256 dos bytes (C7, endereco por conteudo, nunca URL)`,
    );
    this.name = "ErroAnexoAusente";
  }
}

// ─── Deteccao de tipo de grafico ──────────────────────────────────────────────

/**
 * Normaliza a especificacao para busca de palavra: minusculas e sem
 * acentos (NFD + remocao dos diacriticos). "area" e "área" casam a mesma
 * regra; determinismo por construcao.
 */
function normalizarEspecificacao(especificacao: string): string {
  return especificacao
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Palavras-chave por tipo de GRAFICO DE DADOS (tipo_visual "grafico"). */
const PALAVRAS_TIPO_GRAFICO: Readonly<Record<TipoGrafico, readonly string[]>> = {
  barras: ["barras", "barra", "coluna", "colunas", "histograma"],
  linha: ["linha", "linhas", "tendencia", "evolucao", "serie temporal", "curva"],
  pizza: ["pizza", "torta", "distribuicao", "proporcao", "fatias"],
  area: ["area", "areas", "empilhado", "empilhados", "acumulado"],
  dispersao: ["dispersao", "scatter", "pontos", "correlacao", "relacao entre"],
};

/**
 * Palavras-chave por cena do CATALOGO MATEMATICO do estagio grafico
 * (tipo_visual "manim" — a especificacao descreve uma animacao 3blue1brown,
 * nao um grafico de dados; as palavras buscam a cena mais proxima do
 * catalogo fixo: einstein/riemann/euler/taylor/circulo).
 */
const PALAVRAS_CENA_MANIM: Readonly<Record<TipoGrafico, readonly string[]>> = {
  barras: ["einstein", "energia", "massa", "e=mc", "relatividade"],
  linha: [
    "riemann",
    "parabola",
    "funcao",
    "funcoes",
    "integral",
    "soma de riemann",
    "soma inferior",
    "soma superior",
    "area sob",
  ],
  pizza: ["euler", "exponencial", "e^i", "identidade de euler", "pi"],
  area: ["taylor", "serie", "series", "aproximacao polinomial", "termo a termo"],
  dispersao: [
    "circulo",
    "circulo unitario",
    "seno",
    "cosseno",
    "trigonometria",
    "pontos no circulo",
  ],
};

/** Ordem de busca — a primeira palavra que casar decide (determinismo). */
const ORDEM_DE_BUSCA: readonly TipoGrafico[] = [
  "barras",
  "linha",
  "pizza",
  "area",
  "dispersao",
];

function buscarTipo(
  especificacao: string,
  tabela: Readonly<Record<TipoGrafico, readonly string[]>>,
): TipoGrafico | undefined {
  const normalizada = normalizarEspecificacao(especificacao);
  for (const tipo of ORDEM_DE_BUSCA) {
    for (const palavra of tabela[tipo]) {
      if (normalizada.includes(palavra)) {
        return tipo;
      }
    }
  }
  return undefined;
}

/**
 * Detecta o tipo_grafico de um pedaco `grafico` a partir da especificacao.
 * Sem palavra conhecida, `barras` (a cena mais generica do catalogo).
 */
export function detectarTipoGrafico(especificacao: string): TipoGrafico {
  return buscarTipo(especificacao, PALAVRAS_TIPO_GRAFICO) ?? "barras";
}

/**
 * Detecta a cena do catalogo manim de um pedaco `manim`. Sem palavra
 * conhecida, `barras` (einstein — a cena mais generica).
 */
export function detectarCenaManim(especificacao: string): TipoGrafico {
  return buscarTipo(especificacao, PALAVRAS_CENA_MANIM) ?? "barras";
}

// ─── Serie de dados sintetica ─────────────────────────────────────────────────

/**
 * Extrai os numeros da especificacao como serie de dados do NoGrafico.
 *
 * Regra (deterministica): casa `\d+([.,]\d+)?` em toda a especificacao,
 * normaliza virgula decimal pt-BR para ponto, deduplica. O esquema do
 * NoGrafico EXIGE `dados` com pelo menos um item — sem numero na
 * especificacao, um unico dado placeholder com o titulo do slide (o
 * estagio grafico usa `dados.length` para pontos e `dados[i].cor` para
 * cores; um item e a menor serie valida).
 *
 * Documentado para o gerador (irmao): para um grafico REAL, ponha os
 * valores na especificacao ("valores: 120, 45, 78") — a serie sai deles.
 */
export function extrairDados(especificacao: string, titulo: string): Array<{ rotulo: string; valor: number }> {
  const numeros: number[] = [];
  for (const casamento of especificacao.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const bruto = casamento[0] as string;
    const valor = Number(bruto.replace(",", "."));
    if (Number.isFinite(valor) && !numeros.includes(valor)) {
      numeros.push(valor);
    }
  }
  if (numeros.length === 0) {
    return [{ rotulo: titulo, valor: 1 }];
  }
  return numeros.map((valor, i) => ({ rotulo: `Dado ${i + 1}`, valor }));
}

/**
 * Divide a especificacao de um pedaco `lista` em itens: uma linha = um
 * item; linhas vazias podadas. Especificacao de uma linha so = um item.
 * Fallback para o titulo nunca dispara com especificacao nao-vazia (o
 * contrato a exige), mas o guard mantem a funcao total: uma especificacao
 * so de espacos produziria `itens: []` e o NoLista exige minItems 1.
 */
export function separarItens(especificacao: string, titulo: string): string[] {
  const itens = especificacao
    .split("\n")
    .map((linha) => linha.trim())
    .filter((linha) => linha !== "");
  return itens.length > 0 ? itens : [titulo];
}

// ─── O mapeamento ─────────────────────────────────────────────────────────────

/**
 * Mapeia UM pedaco para o no do Manifesto.1 (um pedaco = uma cena = um
 * no — decisao documentada no cabecalho).
 *
 * @param pedaco        o pedaco do roteiro (validado pelo contrato antes)
 * @param id            o id do no (construir.ts atribui n-<indice> — a
 *                      identidade e do documento, nao do mapeamento)
 * @param duracaoFrames a duracao da cena em frames (o no preenche a cena
 *                      inteira: entrada no frame 0, fim no ultimo frame)
 */
export function mapearPedacoParaNo(
  pedaco: Pedaco,
  id: string,
  duracaoFrames: number,
): No {
  const base = { id, duracao_frames: duracaoFrames };
  switch (pedaco.tipo_visual) {
    case "cabecalho":
      return {
        ...base,
        schema: "Cabecalho.1",
        type: "cabecalho",
        texto: pedaco.titulo,
        subtitulo: pedaco.especificacao_visual,
        alinhamento: "centro",
      };
    case "texto":
      return {
        ...base,
        schema: "Texto.1",
        type: "texto",
        texto: pedaco.especificacao_visual,
      };
    case "lista":
      return {
        ...base,
        schema: "Lista.1",
        type: "lista",
        itens: separarItens(pedaco.especificacao_visual, pedaco.titulo),
      };
    case "gif":
    case "video": {
      if (pedaco.anexo_hash === undefined) {
        throw new ErroAnexoAusente(pedaco.id, pedaco.tipo_visual);
      }
      return {
        ...base,
        schema: "Midia.1",
        type: "midia",
        hash: pedaco.anexo_hash,
        tipo_midia: pedaco.tipo_visual,
        ajuste: "contain",
        texto_alternativo: pedaco.especificacao_visual,
        licenca: LICENCA_ANEXO_USUARIO,
      };
    }
    case "grafico":
      return {
        ...base,
        schema: "Grafico.1",
        type: "grafico",
        tipo_grafico: detectarTipoGrafico(pedaco.especificacao_visual),
        titulo: pedaco.titulo,
        dados: extrairDados(pedaco.especificacao_visual, pedaco.titulo),
      };
    case "manim":
      return {
        ...base,
        schema: "Grafico.1",
        type: "grafico",
        tipo_grafico: detectarCenaManim(pedaco.especificacao_visual),
        titulo: pedaco.titulo,
        dados: extrairDados(pedaco.especificacao_visual, pedaco.titulo),
      };
  }
}
