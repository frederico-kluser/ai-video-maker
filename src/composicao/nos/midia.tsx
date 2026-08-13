// =============================================================================
// NO DE MIDIA — enderecado por HASH, com contrato de alfa, e GIF que avanca
//               pelo FRAME
// =============================================================================
// Card: F1-07 (W4). Substitui o stub de fiacao escrito por F1-01.
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
// 2. O GIF AVANCA PELO FRAME, NUNCA PELO RELOGIO. Um <img src="x.gif"> anima
//    pelo relogio do navegador: o Remotion abre varias abas e renderiza
//    faixas de frames em paralelo, entao o mesmo frame sai num quadro do GIF
//    em uma aba e noutro quadro na outra. O erro e invisivel olhando um frame
//    so. Aqui o indice do quadro e `quadroDeGif(frame, fps)` — funcao pura.
//
// 3. ALFA E PRESERVADO. Este no NAO pinta fundo: nenhuma cor opaca cobre o
//    quadro inteiro. O que ele nao desenha continua transparente e chega ao
//    compositor como alfa, nao como preto. Um fundo opaco aqui apagaria os
//    nos irmaos da mesma cena em silencio, e destruiria o alfa de qualquer
//    asset com transparencia (as armadilhas de .mov qtrle/argb e WebM alfa).
//
// CONTRATO (cobrado por `just comp-pureza`): funcao pura de
// (no, frame, fps, width, height); frame vem por PROP; zero Date.now(),
// Math.random(), setTimeout(), fetch(); zero animacao CSS; zero
// background-image; zero mask-image; interpolacao com extrapolateLeft/Right
// explicitos. Imports RELATIVOS — o bundler e webpack e nao le os `paths` do
// tsconfig (docs/criterios-de-aceitacao-corrigidos.md §3).
//
// O asset em si nao e desenhado: quem resolve hash -> bytes e o estagio de
// resolucao de midia (F2-04), que roda em paralelo a este card. Este
// componente desenha o MARCADOR do asset e ja carrega a aritmetica de quadro
// que o asset vai usar quando chegar. Ver docs/adr/0017-no-de-midia.md.
// =============================================================================

import { interpolate } from "remotion";
import type { AjusteMidia, No, NoMidia } from "../../contratos/manifesto";
import {
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
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "midia",
  schema: "Midia.1",
  id: "no-midia",
  descricao: "Marcador de midia (imagem, video ou GIF) enderecada por hash",
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
// Aritmetica de quadro do GIF — pura, e o coracao do card
// ---------------------------------------------------------------------------

/**
 * Duracao de UM quadro de GIF em milissegundos, enquanto o asset real nao
 * chegou. Vem de token (`transitionDuration.instant` = 100 ms), que e a
 * cadencia de fato dos GIFs em navegador: o campo de delay do GIF89a e
 * medido em centesimos de segundo e o piso pratico e 10 cs.
 *
 * Quando F2-04 entregar o asset resolvido, a cadencia real do arquivo entra
 * por `msPorQuadro` e NENHUMA chamada muda de forma — por isso o parametro
 * existe desde ja.
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
 * este valor que o elemento do asset vai receber quando F2-04 chegar, e e
 * dele que sai a margem transparente de `contain`/`none` (contrato de alfa).
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
// O componente
// ---------------------------------------------------------------------------

const Midia: NoComponent = ({ no, frame, fps, width, height }) => {
  const erros = validarNoDeMidia(no);
  if (erros.length > 0) {
    throw new ErroDeMidia(erros);
  }
  const midia = no as NoMidia;

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

  return (
    // CONTRATO DE ALFA: nenhuma cor de fundo aqui. O que este no nao desenha
    // continua transparente e chega ao compositor como alfa, nao como preto.
    <div
      data-no={midia.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      data-alfa="preservado"
      style={{
        position: "absolute",
        inset: margem,
        opacity: opacidade,
      }}
    >
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
    </div>
  );
};

export default Midia;
