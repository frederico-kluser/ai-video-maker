// =============================================================================
// NO DE MIDIA — enderecado por HASH, com contrato de alfa, GIF que avanca
//               pelo FRAME, e o asset REAL + legenda (overlay) sobre a midia
// =============================================================================
// Card: F1-07 (W4) + Onda 3 (onda3-midia-gif-texto): o asset de verdade.
//
// Tres invariantes, e as tres sao de determinismo:
//
// 1. HASH, NUNCA URL (AGENTS.md C7). Um asset da rede muda de conteudo
//    mantendo a URL: dois renders do mesmo manifesto sairiam diferentes sem
//    nada ficar vermelho. Aqui o endereco e SHA-256 e ponto. A recusa e
//    ativa: `validarNoDeMidia()` estoura `ErroDeMidia` para qualquer coisa
//    que nao seja hash canonico — inclusive URL escondida em outro campo ou
//    em nome de propriedade (`src`, `href`, `caminho`...). Nao existe "ignora
//    o campo estranho": ignorar e como o quadro preto entra em producao.
//
// 2. O GIF AVANCA PELO FRAME, NUNCA PELO RELOGIO. O `<Gif>` do
//    @remotion/gif decodifica o arquivo e pinta em `<canvas>` com o indice
//    `f(frame, fps, delays)` — os delays REAIS do arquivo, sem Date.now()
//    (asset-acquisition SKILL.md §4). Um `<img src="x.gif">` animaria pelo
//    relogio do navegador e o render paralelo divergiria frame a frame.
//    A aritmetica `quadroDeGif` continua exportada para o MARCADOR
//    (estado nao-resolvido) e para a sonda do gate.
//
// 3. ALFA E PRESERVADO. Este no NAO pinta fundo: nenhuma cor opaca cobre o
//    quadro inteiro. O que ele nao desenha continua transparente e chega ao
//    compositor como alfa, nao como preto. Um fundo opaco aqui apagaria os
//    nos irmaos da mesma cena em silencio, e destruiria o alfa de qualquer
//    asset com transparencia (as armadilhas de .mov qtrle/argb e WebM alfa).
//    A LEGENDA (overlay) e uma barra opaca SOBRE a midia — o estilo meme —
//    mas ela e conteudo do proprio no, nunca o fundo do no.
//
// O ASSET REAL (Onda 3): quando a fiacao anexa `midia_resolvida` (o
// descritor de `assets[nos_midia[no.id]]` + a `fonte` local derivada do
// hash), este componente desenha a midia DE VERDADE: Img para imagem,
// <Gif> para gif, OffthreadVideo (com `<Sequence>` na base do eixo) para
// video. Sem `midia_resolvida` ele desenha o MARCADOR da W4 — o estado
// nao-resolvido que as fixtures da suite ainda exercitam.
//
// A LEGENDA (Onda 3): `texto_alternativo` e tambem a legenda sobre a
// midia — gif com texto = meme, o pedido do usuario. Ela respeita o eixo
// da Onda 2 (src/composicao/layout/eixo.ts): a banda (regiao) onde o no
// participa e o fator de transicao (fatorTexto) que apaga o texto da cena
// que sai na primeira metade da transicao — sem isso o C2 da sonda
// quebraria na cena c-005. A sonda le data-bbox/data-visibilidade do
// overlay, o mesmo contrato dos nos de texto.
//
// CONTRATO (cobrado por `just comp-pureza`): funcao pura de
// (no, frame, fps, width, height); frame vem por PROP; zero Date.now(),
// Math.random(), setTimeout(), fetch(); zero animacao CSS; zero
// background-image; zero mask-image; interpolacao com extrapolateLeft/Right
// explicitos. Imports RELATIVOS — o bundler e webpack e nao le os `paths` do
// tsconfig (docs/criterios-de-aceitacao-corrigidos.md §3).
// =============================================================================

import { Gif } from "@remotion/gif";
import { Img, OffthreadVideo, Sequence, interpolate } from "remotion";
import type { AjusteMidia, No, NoMidia } from "../../contratos/manifesto";
import {
  background,
  border,
  borderRadius,
  fontFamily,
  fontWeight,
  highlight,
  lineHeight,
  msToFrames,
  safeArea16x9,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { AssetResolvido } from "../../resolucao/manifesto-resolvido";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";
import { measureTextWidth } from "../layout/medicao";
import type { NoComEixo, Regiao } from "../layout/eixo";
import { regiaoDoQuadro } from "../layout/eixo";

export const meta: NoComponentMeta = {
  tipo: "midia",
  schema: "Midia.1",
  id: "no-midia",
  descricao:
    "Midia (imagem, video ou GIF) enderecada por hash, com legenda sobre a midia e alfa preservado",
};

// ---------------------------------------------------------------------------
// Enderecamento por conteudo — o que e um endereco valido
// ---------------------------------------------------------------------------

/** Hash de conteudo canonico: SHA-256 em hex MINUSCULO, 64 caracteres. */
const HASH_DE_CONTEUDO = /^[0-9a-f]{64}$/;

/** Quantos caracteres do hash aparecem no marcador. */
const PREFIXO_DO_HASH = 12;

/** Rotulo do algoritmo mostrado junto do prefixo. */
const ALGORITMO = "sha256";

/**
 * Separador de esquema. `://` cobre http, https, ftp, s3, gs e o que mais
 * inventarem, em qualquer posicao do texto — e o sinal mais forte de URL.
 */
const SEPARADOR_DE_ESQUEMA = "://";

/**
 * Esquemas sem barras, que passariam batido numa busca por "//".
 * Ancorados no INICIO do valor de proposito: um campo que E um endereco
 * comeca pelo esquema. Procurar "data:" no meio de prosa reprovaria
 * "na data: 2026" — falso vermelho, que custa tanto quanto o falso verde.
 */
const ESQUEMA_NO_INICIO =
  /^\s*(https?|data|blob|file|javascript|mailto|ftp|ftps|s3|gs|ws|wss):/;

/** Endereco relativo a protocolo: `//cdn.exemplo/x.png` tambem e URL. */
const PROTOCOLO_RELATIVO = /^\s*\/\//;

/** Hospedeiro escrito sem esquema: `www.exemplo.com/x.png`. */
const HOSPEDEIRO_NU = /(^|[^a-z0-9])www\./i;

/**
 * Fragmentos que denunciam nome de propriedade de ENDERECO.
 * Uma URL nao precisa vir em `hash` para envenenar o render: basta vir em
 * `src`, `href`, `caminho`... e alguem, um dia, le esse campo.
 */
const NOMES_DE_ENDERECO = [
  "url",
  "uri",
  "src",
  "href",
  "link",
  "path",
  "caminho",
  "endereco",
];

/**
 * Normalizacao de tripwire (AGENTS.md C11): busca vazia no texto cru nao e
 * prova de ausencia. Tira espaco, caracteres de largura zero e controle, e
 * baixa a caixa — `h t t p s://x` e `HTTPS://x` viram a mesma coisa.
 */
export function normalizarParaTripwire(valor: string): string {
  return valor
    .replace(/[\s\u00ad\u200b-\u200f\u2028\u2029\ufeff\u0000-\u001f]/g, "")
    .toLowerCase();
}

/** Diz se um texto qualquer parece endereco de rede. Cru E normalizado. */
export function pareceUrl(valor: string): boolean {
  const formas = [valor.toLowerCase(), normalizarParaTripwire(valor)];
  for (const forma of formas) {
    if (forma.includes(SEPARADOR_DE_ESQUEMA)) return true;
    if (ESQUEMA_NO_INICIO.test(forma)) return true;
    if (PROTOCOLO_RELATIVO.test(forma)) return true;
    if (HOSPEDEIRO_NU.test(forma)) return true;
  }
  return false;
}

/** Diz se o valor e um hash de conteudo canonico (SHA-256 hex minusculo). */
export function ehHashDeConteudo(valor: unknown): valor is string {
  return typeof valor === "string" && HASH_DE_CONTEUDO.test(valor);
}

/** Rotulo visivel por tipo de midia. Map: ordem estavel e busca explicita. */
const ROTULO_POR_TIPO_DE_MIDIA = new Map<string, string>([
  ["imagem", "Imagem"],
  ["video", "Video"],
  ["gif", "GIF"],
]);

// ---------------------------------------------------------------------------
// Recusa — o no torto para o render, nunca vira quadro vazio
// ---------------------------------------------------------------------------

/** Erro de midia: no que este componente se RECUSA a desenhar. */
export class ErroDeMidia extends Error {
  readonly erros: readonly string[];
  constructor(erros: readonly string[]) {
    super(
      `No de midia recusado (${erros.length} erro(s)):\n` +
        erros.map((e) => `  - ${e}`).join("\n"),
    );
    this.name = "ErroDeMidia";
    this.erros = erros;
  }
}

/**
 * Confere um no de midia. Devolve TODOS os problemas de uma vez; lista vazia
 * quer dizer aprovado. Quem chama DEVE estourar — seguir adiante com um no
 * torto e o falso-verde de sempre.
 */
export function validarNoDeMidia(no: No | NoMidia): string[] {
  const erros: string[] = [];
  const bruto = no as unknown as Record<string, unknown>;
  const id = typeof bruto["id"] === "string" ? bruto["id"] : "<sem id>";

  if (bruto["type"] !== meta.tipo) {
    erros.push(
      `no "${id}": type "${String(bruto["type"])}" nao e "${meta.tipo}" ` +
        `— este componente nao desenha no de outro tipo`,
    );
  }
  if (bruto["schema"] !== meta.schema) {
    erros.push(
      `no "${id}": schema "${String(bruto["schema"])}" diverge de "${meta.schema}"`,
    );
  }

  // --- O endereco ---
  const hash = bruto["hash"];
  if (typeof hash !== "string" || hash.length === 0) {
    erros.push(`no "${id}": hash ausente (esperado SHA-256 hex de 64 chars)`);
  } else if (pareceUrl(hash)) {
    erros.push(
      `no "${id}": hash e URL ("${hash}"). Abaixo da fronteira de determinismo ` +
        `so passa endereco de CONTEUDO — resolva a URL no estagio de resolucao ` +
        `e passe o SHA-256 (AGENTS.md C7)`,
    );
  } else if (!HASH_DE_CONTEUDO.test(hash)) {
    erros.push(
      `no "${id}": hash "${hash}" nao e SHA-256 hex minusculo de 64 chars`,
    );
  }

  // --- Nenhuma URL entra por outra porta ---
  // Ordenacao explicita: iterar objeto sem ordenar e nao-determinismo
  // (AGENTS.md, Regra 1) e mudaria a ORDEM das mensagens de erro.
  for (const chave of Object.keys(bruto).sort()) {
    const chaveNormalizada = normalizarParaTripwire(chave);
    for (const suspeita of NOMES_DE_ENDERECO) {
      if (chaveNormalizada.includes(suspeita)) {
        erros.push(
          `no "${id}": propriedade "${chave}" e nome de ENDERECO. ` +
            `Um no de midia se endereca por hash, e por mais nada`,
        );
        break;
      }
    }
    const valor = bruto[chave];
    if (typeof valor === "string" && chave !== "hash" && pareceUrl(valor)) {
      erros.push(
        `no "${id}": campo "${chave}" carrega URL ("${valor}") — nenhuma URL ` +
          `atravessa a fronteira, nem de contrabando em campo de texto`,
      );
    }
  }

  // --- A janela ---
  const duracao = bruto["duracao_frames"];
  if (typeof duracao !== "number" || !Number.isFinite(duracao) || duracao <= 0) {
    erros.push(
      `no "${id}": duracao_frames invalida (${String(duracao)}) — um no que ` +
        `dura zero frames nao e desenhavel, e desenhar nada seria o quadro vazio`,
    );
  }

  // --- O tipo de midia ---
  const tipoMidia = bruto["tipo_midia"];
  if (!ROTULO_POR_TIPO_DE_MIDIA.has(String(tipoMidia))) {
    erros.push(
      `no "${id}": tipo_midia "${String(tipoMidia)}" desconhecido ` +
        `(este componente desenha: ${[...ROTULO_POR_TIPO_DE_MIDIA.keys()].join(", ")})`,
    );
  }

  return erros;
}

// ---------------------------------------------------------------------------
// O ASSET RESOLVIDO (Onda 3) — o que a fiacao anexa, e a guarda de formato
// ---------------------------------------------------------------------------

/** O asset de midia ja resolvido, do jeito que a fiacao o entrega ao no. */
export interface MidiaResolvida {
  /** Descritor de `assets[nos_midia[no.id]]` do manifesto resolvido. */
  readonly asset: AssetResolvido;
  /** Caminho local derivado do hash pela fiacao. Nunca vem do manifesto. */
  readonly fonte?: string;
}

/** O no de midia depois da fiacao do manifesto resolvido. */
export type NoMidiaResolvido = NoMidia & {
  readonly midia_resolvida?: MidiaResolvida;
};

/**
 * Lista de PERMISSAO de mimeType por tipo de midia. Quem nao esta aqui e
 * recusado — formato desconhecido nunca e aprovado por omissao.
 */
export const FORMATOS_DE_MIDIA: Readonly<Record<string, readonly string[]>> = {
  imagem: ["image/png", "image/jpeg", "image/webp"],
  gif: ["image/gif"],
  video: ["video/webm", "video/mp4"],
};

/** Normaliza o mimeType para comparacao (`image/png; charset=x` -> `image/png`). */
export function normalizarMimeDeMidia(mime: string | undefined): string {
  return (mime ?? "").split(";")[0]!.trim().toLowerCase();
}

/**
 * Confere UM asset de midia contra o tipo do no. Devolve TODOS os problemas
 * (vazia = aprovado). Nao lanca: quem chama decide se acumula ou estoura.
 */
export function conferirAssetDeMidia(
  noId: string,
  tipoMidia: string,
  asset: AssetResolvido,
): string[] {
  const erros: string[] = [];
  const onde = `${meta.id}: no "${noId}"`;
  const aceitos = FORMATOS_DE_MIDIA[tipoMidia] ?? [];

  if (asset.tipo !== tipoMidia) {
    erros.push(
      `${onde}: o no declara tipo_midia "${tipoMidia}" mas o asset ` +
        `${asset.hash.slice(0, 12)}… e do tipo "${asset.tipo}" — o estagio ` +
        `"midia" adquiriu outra coisa`,
    );
  }

  const mime = normalizarMimeDeMidia(asset.mimeType);
  if (mime === "") {
    erros.push(
      `${onde}: asset ${asset.hash.slice(0, 12)}… sem mimeType — formato ` +
        `desconhecido NAO e aprovado por omissao`,
    );
    return erros;
  }
  if (!aceitos.includes(mime)) {
    erros.push(
      `${onde}: formato "${mime}" nao esta na lista de permissao para ` +
        `tipo_midia "${tipoMidia}" (aceitos: ${aceitos.join(", ") || "(nenhum)"})`,
    );
  }
  return erros;
}

/** Como `conferirAssetDeMidia`, mas estoura. Usada pelo componente. */
export function exigirAssetDeMidiaUtilizavel(
  noId: string,
  tipoMidia: string,
  asset: AssetResolvido,
): void {
  const erros = conferirAssetDeMidia(noId, tipoMidia, asset);
  if (erros.length > 0) {
    throw new ErroDeMidia(erros);
  }
}

// ---------------------------------------------------------------------------
// Aritmetica de quadro do GIF — pura, e o coracao do card
// ---------------------------------------------------------------------------

/**
 * Duracao de UM quadro de GIF em milissegundos, enquanto o asset real nao
 * chegou. Vem de token (`transitionDuration.instant` = 100 ms), que e a
 * cadencia de fato dos GIFs em navegador: o campo de delay do GIF89a e
 * medido em centesimos de segundo e o piso pratico e 10 cs.
 *
 * Com o asset REAL o `<Gif>` do @remotion/gif usa os delays do proprio
 * arquivo (a Onda 3 conferiu o do cassete: "Spinning globe map.gif", 25
 * quadros a 100 ms uniformes) — `msPorQuadro` continua como fallback do
 * marcador e da sonda.
 */
export const MS_POR_QUADRO_DE_GIF = transitionDuration.instant;

/**
 * Quantos frames da composicao duram um quadro do GIF. Nunca menos de 1:
 * um GIF mais rapido que a composicao nao pode "pular para tras".
 */
export function framesPorQuadroDeGif(
  fps: number,
  msPorQuadro: number = MS_POR_QUADRO_DE_GIF,
): number {
  return Math.max(1, msToFrames(msPorQuadro, fps));
}

/**
 * O indice do quadro do GIF neste frame. FUNCAO PURA de (frame, fps):
 * nenhum relogio, nenhum estado, nenhum efeito. Renderizar o mesmo frame
 * duas vezes devolve o mesmo indice por construcao — e e isso que dois
 * renders paralelos do Remotion precisam para concordar.
 */
export function quadroDeGif(
  frame: number,
  fps: number,
  msPorQuadro: number = MS_POR_QUADRO_DE_GIF,
): number {
  return Math.floor(Math.max(0, frame) / framesPorQuadroDeGif(fps, msPorQuadro));
}

// ---------------------------------------------------------------------------
// Geometria e rotulos
// ---------------------------------------------------------------------------

/**
 * `ajuste` do manifesto -> `object-fit` do CSS. Mapa TOTAL e explicito: e
 * este valor que o elemento do asset recebe quando a fiacao entrega o
 * arquivo, e e dele que sai a margem transparente de `contain`/`none`
 * (contrato de alfa).
 */
export function ajusteParaObjectFit(ajuste: AjusteMidia | undefined): AjusteMidia {
  switch (ajuste) {
    case "cover":
    case "contain":
    case "fill":
    case "none":
      return ajuste;
    default:
      return "contain";
  }
}

/** `cover` e `fill` ocupam o quadro inteiro; `contain` e `none` deixam margem. */
function ocupaQuadroInteiro(ajuste: AjusteMidia): boolean {
  return ajuste === "cover" || ajuste === "fill";
}

/** Numero de celulas da fita de cadencia do GIF. */
const CELULAS_DA_CADENCIA = 8;

// ---------------------------------------------------------------------------
// A LEGENDA (overlay) — o texto_alternativo sobre a midia, no eixo da Onda 2
// ---------------------------------------------------------------------------

/**
 * Quais tipos de midia recebem a legenda.
 *
 * DECISAO DA ONDA 3 (documentada no handoff): gif e video ganham a
 * legenda (o pedido do usuario foi "gif com texto"); IMAGEM nao — o n-005
 * da fixture canonica e `cover` (fundo de cena cheio) e a legenda
 * colidiria com o conteudo da propria imagem (um diagrama). A imagem nao
 * participa do eixo de texto por isso (ver eDeTexto em layout/eixo.ts).
 */
export function temLegenda(tipoMidia: string): boolean {
  return tipoMidia === "gif" || tipoMidia === "video";
}

/** Tamanho da fonte da legenda: typeScale.subtitle (~2.5% da altura). */
export function tamanhoDaLegenda(height: number): number {
  return Math.round(height * typeScale.subtitle);
}

/** Padding interno da barra da legenda. */
const PADDING_DA_LEGENDA = spacing["6"];
const PADDING_INFERIOR_DA_LEGENDA = spacing["6"];

/**
 * A caixa HONESTA da legenda: texto medido + padding, ancorada na base da
 * regiao (banda do eixo). E o data-bbox que a sonda de sobreposicao le —
 * se a legenda vazasse da banda, a sonda acusaria.
 */
export function caixaDaLegenda(
  texto: string,
  regiao: Regiao,
  height: number,
): Regiao {
  const fontSize = tamanhoDaLegenda(height);
  const larguraMaxima = Math.max(regiao.largura - PADDING_DA_LEGENDA * 2, 1);
  const larguraDoTexto = measureTextWidth(texto, fontSize);
  const linhas = Math.max(1, Math.ceil(larguraDoTexto / larguraMaxima));
  const largura = Math.min(larguraDoTexto, larguraMaxima) + PADDING_DA_LEGENDA * 2;
  const altura =
    Math.ceil(linhas * fontSize * lineHeight.tight) + PADDING_DA_LEGENDA * 2;
  const x = regiao.x + Math.floor((regiao.largura - largura) / 2);
  const y = Math.max(
    regiao.y,
    regiao.y + regiao.altura - altura - PADDING_INFERIOR_DA_LEGENDA,
  );
  return { x, y, largura: Math.round(largura), altura: Math.round(altura) };
}

// ---------------------------------------------------------------------------
// O componente
// ---------------------------------------------------------------------------

const Midia: NoComponent = ({ no, frame, fps, width, height }) => {
  const erros = validarNoDeMidia(no);
  if (erros.length > 0) {
    throw new ErroDeMidia(erros);
  }
  const midia = no as NoMidiaResolvido;

  // A janela e a do MANIFESTO. Fora dela este no nao desenha nada — nem meio
  // pixel de vazamento sobre o no seguinte.
  if (frame < 0 || frame >= midia.duracao_frames) {
    return null;
  }

  // Entrada declarada no manifesto. `none` (ou ausente) = opaco desde o
  // frame 0; nada de fade "porque fica bonito", que mudaria o quadro 0.
  const framesDeFade =
    midia.animacao?.tipo === "fade"
      ? Math.min(
          midia.duracao_frames,
          midia.animacao.duracao_frames ??
            Math.max(1, msToFrames(transitionDuration.snap, fps)),
        )
      : 0;
  const opacidade =
    framesDeFade > 0
      ? interpolate(frame, [0, framesDeFade], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const ajuste = ajusteParaObjectFit(midia.ajuste);
  const margem = ocupaQuadroInteiro(ajuste)
    ? 0
    : Math.round(Math.min(width, height) * safeArea16x9.graphicsSafePct);
  const rotulo = ROTULO_POR_TIPO_DE_MIDIA.get(midia.tipo_midia) ?? midia.tipo_midia;
  const quadroGif = midia.tipo_midia === "gif" ? quadroDeGif(frame, fps) : null;
  const celulaAtiva = quadroGif === null ? -1 : quadroGif % CELULAS_DA_CADENCIA;
  const celulas: number[] = [];
  for (let i = 0; i < CELULAS_DA_CADENCIA; i++) celulas.push(i);

  // O ASSET RESOLVIDO (Onda 3): a fiacao anexou `midia_resolvida` com a
  // fonte local. Sem ela, o marcador da W4 (estado nao-resolvido).
  const resolvido = midia.midia_resolvida;
  if (resolvido !== undefined) {
    exigirAssetDeMidiaUtilizavel(midia.id, midia.tipo_midia, resolvido.asset);
    if (resolvido.fonte === undefined || resolvido.fonte.trim().length === 0) {
      throw new ErroDeMidia([
        `${meta.id}: no "${midia.id}": o asset ${resolvido.asset.hash.slice(
          0,
          12,
        )}… foi resolvido, mas a fiacao nao entregou o caminho local`,
      ]);
    }
  }

  // O EIXO (Onda 2): a banda onde o no participa e o fator de transicao.
  // Fora da fiacao da cena (render direto, Studio) o default e quadro
  // inteiro e fator 1.
  const comEixo = no as NoComEixo;
  const regiao = comEixo.eixo?.regiao ?? regiaoDoQuadro(width, height);
  const fator = comEixo.eixo?.fatorTexto ?? 1;

  // A LEGENDA: so gif/video com texto_alternativo. A visibilidade e a
  // opacidade propria (fade) vezes o fator da transicao — o mesmo contrato
  // dos nos de texto. A caixa sai da banda (data-bbox honesto para a
  // sonda C1/C2).
  const legenda =
    temLegenda(midia.tipo_midia) &&
    midia.texto_alternativo !== undefined &&
    midia.texto_alternativo.trim().length > 0
      ? midia.texto_alternativo.trim()
      : null;
  const caixa = legenda === null ? null : caixaDaLegenda(legenda, regiao, height);
  const visibilidade =
    caixa === null ? 0 : Math.round(opacidade * fator * 1000) / 1000;

  // VIDEO: o relogio do OffthreadVideo comeca na base absoluta que o eixo
  // anexa (a mesma disciplina do video de grafico da Onda 2) — fora de um
  // `<Sequence>`, o OffthreadVideo veria o frame ABSOLUTO da composicao.
  const videoInicio = comEixo.eixo?.videoInicioAbsoluto;
  const media =
    resolvido === undefined ? null : (
      <>
        {midia.tipo_midia === "gif" ? (
          <Gif
            src={resolvido.fonte ?? ""}
            fit={ajuste === "none" ? "contain" : ajuste}
            loopBehavior="loop"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
          />
        ) : midia.tipo_midia === "video" ? (
          <OffthreadVideo
            src={resolvido.fonte ?? ""}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: ajuste,
            }}
          />
        ) : (
          <Img
            src={resolvido.fonte ?? ""}
            alt={midia.texto_alternativo ?? midia.id}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: ajuste,
            }}
          />
        )}
      </>
    );

  return (
    // CONTRATO DE ALFA: nenhuma cor de fundo aqui. O que este no nao desenha
    // continua transparente e chega ao compositor como alfa, nao como preto.
    <div
      data-no={midia.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      data-alfa="preservado"
      data-modo={resolvido === undefined ? "marcador" : "asset"}
      style={{
        position: "absolute",
        inset: margem,
        opacity: opacidade,
      }}
    >
      {resolvido === undefined ? (
        <div
          data-caixa-midia={midia.tipo_midia}
          data-ajuste={ajuste}
          style={{
            position: "absolute",
            inset: 0,
            borderStyle: "dashed",
            borderWidth: spacing["1"],
            borderColor: highlight.primary,
            borderRadius: borderRadius.lg,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing["4"],
          }}
        >
          <div
            data-rotulo={midia.tipo_midia}
            style={{
              fontSize: Math.round(height * typeScale.title),
              lineHeight: lineHeight.tight,
              color: highlight.primary,
              fontFamily: fontFamily.display,
              fontWeight: fontWeight.semibold,
            }}
          >
            [{rotulo}]
          </div>
          <div
            data-hash={midia.hash.slice(0, PREFIXO_DO_HASH)}
            style={{
              fontSize: Math.round(height * typeScale.caption),
              lineHeight: lineHeight.tight,
              color: corDeTexto.secondary,
              fontFamily: fontFamily.mono,
            }}
          >
            {ALGORITMO}:{midia.hash.slice(0, PREFIXO_DO_HASH)}
          </div>
          {quadroGif === null ? null : (
            // A FITA DE CADENCIA. A celula acesa e funcao do frame, e de mais
            // nada: e a prova visual de que o GIF anda pelo frame. Um GIF que
            // andasse pelo relogio deixaria esta fita parada e o quadro do
            // asset andando — divergencia invisivel em um frame so.
            <div
              data-quadro-gif={String(quadroGif)}
              style={{
                display: "flex",
                flexDirection: "row",
                gap: spacing["2"],
                alignItems: "center",
              }}
            >
              {celulas.map((celula) => (
                <div
                  key={celula}
                  data-celula={String(celula)}
                  data-acesa={celula === celulaAtiva ? "sim" : "nao"}
                  style={{
                    width: spacing["8"],
                    height: spacing["8"],
                    borderRadius: borderRadius.sm,
                    backgroundColor:
                      celula === celulaAtiva ? highlight.accent : border.default,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // O ASSET REAL. O video ganha o <Sequence> na base absoluta do
        // eixo; imagem e gif sao estaticos no tempo do proprio no.
        //
        // A REGIAO DA MIDIA (fix da Onda 3, revisao adversarial da c-005):
        // o asset renderiza DENTRO da banda que o eixo deu ao no
        // (src/composicao/layout/eixo.ts) — NUNCA no quadro inteiro. O bug
        // medido: com `inset: 0` (o antigo `data-caixa-midia` na raiz em
        // `inset: margem`), a midia ocupava o quadro cheio e, pintada
        // depois do texto, cobria os blocos de texto dos irmaos (c-005:
        // n-014 e a legenda n-006 invisiveis no frame 580 — zero pixels
        // de texto). O container vive na raiz do no (que comeca em
        // `inset: margem`): left/top sao a banda ABSOLUTA menos a margem
        // da raiz, e width/height sao os da banda — a caixa absoluta do
        // asset e EXATAMENTE a regiao. Sem eixo (render direto, Studio) a
        // regiao e o quadro inteiro — o comportamento historico.
        // `data-regiao-da-midia` e o que a sonda C4 le para modelar a
        // midia como obstaculo opaco.
        <div
          data-regiao-da-midia={`${String(regiao.x)},${String(regiao.y)},${String(regiao.largura)},${String(regiao.altura)}`}
          data-tipo-midia={midia.tipo_midia}
          style={{
            position: "absolute",
            left: regiao.x - margem,
            top: regiao.y - margem,
            width: regiao.largura,
            height: regiao.altura,
          }}
        >
          <div
            data-caixa-midia={midia.tipo_midia}
            data-ajuste={ajuste}
            data-asset-hash={resolvido.asset.hash.slice(0, PREFIXO_DO_HASH)}
            style={{ position: "absolute", inset: 0 }}
          >
            {midia.tipo_midia === "video" && videoInicio !== undefined ? (
              <Sequence from={videoInicio}>{media}</Sequence>
            ) : (
              media
            )}
          </div>
        </div>
      )}

      {caixa === null || legenda === null ? null : (
        // A LEGENDA SOBRE a midia: barra opaca (estilo meme), branca, na
        // base da banda do eixo. O fator de transicao vai na opacidade da
        // propria barra; a opacidade propria (fade do no) ja esta na raiz.
        //
        // GEOMETRIA HONESTA: a caixa e calculada em coordenadas ABSOLUTAS
        // do canvas, mas este div vive DENTRO da raiz do no, que em
        // `contain`/`none` comeca em `inset: margem` — sem descontar a
        // margem, a barra renderizaria deslocada (margem, margem) do
        // data-bbox declarado e a sonda C1 aprovaria uma geometria que o
        // pixel desmente (medido no master da Onda 3: deslocamento de
        // 54 px com contain).
        <div
          data-no={midia.id}
          data-tipo={meta.tipo}
          data-legenda={legenda}
          data-regiao={`${String(regiao.x)},${String(regiao.y)},${String(regiao.largura)},${String(regiao.altura)}`}
          data-bbox={`${String(caixa.x)},${String(caixa.y)},${String(caixa.largura)},${String(caixa.altura)}`}
          data-fator-texto={String(fator)}
          data-visibilidade={String(visibilidade)}
          style={{
            position: "absolute",
            left: Math.max(0, caixa.x - margem),
            top: Math.max(0, caixa.y - margem),
            width: caixa.largura,
            height: caixa.altura,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: PADDING_DA_LEGENDA,
            paddingRight: PADDING_DA_LEGENDA,
            boxSizing: "border-box",
            backgroundColor: background.primary,
            borderRadius: borderRadius.md,
            color: corDeTexto.primary,
            fontFamily: fontFamily.display,
            fontWeight: fontWeight.semibold,
            fontSize: tamanhoDaLegenda(height),
            lineHeight: lineHeight.tight,
            textAlign: "center",
            ...(fator < 1 ? { opacity: fator } : {}),
          }}
        >
          {legenda}
        </div>
      )}
    </div>
  );
};

export default Midia;
