// =============================================================================
// NO: cabecalho e titulo
// =============================================================================
// Card: F1-04 — onda W4. Substitui o no de mentira escrito por F1-01.
//
// O PONTO DESTE ARQUIVO: toda mola vem de uma CONSTANTE NOMEADA dos tokens.
// Nao existe `damping: 15` nem `stiffness: 100` aqui. O que existe e
// `springPresets.snappy` — um par (zeta, T) — convertido pela formula que o
// proprio src/design/tokens.ts documenta na secao "PRESETS DE MOLA":
//
//     omega0    = ln(1/threshold) / (zeta * T)
//     stiffness = omega0^2 * m
//     damping   = 2 * zeta * omega0 * m
//
// Um numero de mola escrito a mao aqui seria literal de token redeclarado:
// ele diverge do token no primeiro merge limpo e ninguem fica sabendo
// (AGENTS.md, Regra 2).
//
// O TOKEN TEM DOIS CAMPOS E CADA UM ENTRA POR UMA PORTA:
//
//   zeta (a forma)  -> vai na `config`. O round-trip e exato:
//                      damping / (2*sqrt(stiffness*mass)) devolve o zeta do token.
//
//   T (o tempo)     -> vai em `durationInFrames`, o esticador do proprio
//                      Remotion, junto com `durationRestThreshold` (o token).
//
// Por que T NAO fica so na formula: a formula acima e uma APROXIMACAO, e o
// comentario do token ja avisa ("superestima levemente"). Medido com
// measureSpring() nesta base, o erro nao e leve para todo preset:
//
//     preset      zeta    T esperado    medido pela formula pura    razao
//     snappy      0.70    7.5 frames    7 frames                    0.93x
//     overshoot   0.45   12   frames   12 frames                    1.00x
//     suave       1.00   15   frames   22 frames                    1.47x
//
// Em zeta = 1 (amortecimento critico) o envelope e (1 + omega0*t)*e^-(omega0*t),
// nao e^-(zeta*omega0*t): o termo linear que a formula ignora e justo o que
// domina. Deixar assim faria o preset "suave" durar 47% mais que o token diz,
// em silencio. Com `durationInFrames`, a mola pousa dentro do threshold no
// frame que o token pede — e `tests/composicao/no-cabecalho.test.ts` cobra isso
// preset a preset, em 30 e em 60 fps. Ledger: AB-311.
//
// CONTRATO (cobrado por `just comp-pureza`):
//   - funcao pura de (no, frame, fps, width, height);
//   - `frame` chega por PROP — nada de useCurrentFrame() aqui;
//   - zero Date.now / Math.random / setTimeout / fetch;
//   - zero animacao CSS, zero background-image, zero mask-image;
//   - toda interpolacao com extrapolateLeft/extrapolateRight explicitos.
//
// IMPORTS RELATIVOS: o bundler do Remotion e webpack e NAO le os `paths` do
// tsconfig. `import ... from "src/design/tokens"` passa no tsc e no vitest e
// quebra so no render de verdade (docs/criterios-de-aceitacao-corrigidos.md §3).
// =============================================================================

import { interpolate, spring } from "remotion";
import type { AnimacaoTipo, NoCabecalho } from "../../contratos/manifesto";
import {
  background,
  fontFamily,
  fontWeight,
  highlight,
  lineHeight,
  msToFrames,
  safeArea16x9,
  spacing,
  springDurationRestThreshold,
  springPresets,
  text as corDeTexto,
  transitionDuration,
  typeScale,
  type SpringPreset,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";
import {
  regiaoDoQuadro,
  type NoComEixo,
  type Regiao,
} from "../layout/eixo";
import { measureTextWidth } from "../layout/medicao";

// ---------------------------------------------------------------------------
// Metadados — NAO MUDE. A descoberta por convencao e o gate de unicidade
// (`just comp-unicidade`) leem exatamente estes quatro campos.
// ---------------------------------------------------------------------------

export const meta: NoComponentMeta = {
  tipo: "cabecalho",
  schema: "Cabecalho.1",
  id: "no-cabecalho",
  descricao: "Titulo e subtitulo com alinhamento configuravel",
};

// ---------------------------------------------------------------------------
// A mola — derivada do token, nunca escrita a mao
// ---------------------------------------------------------------------------

/** Config de mola no formato que `spring()` do Remotion consome. */
export interface ConfigDeMola {
  damping: number;
  mass: number;
  stiffness: number;
  overshootClamping: boolean;
}

/**
 * Massa de referencia do oscilador.
 *
 * NAO e decisao de design e por isso nao e token: a equacao normalizada do
 * oscilador e `x'' + 2*zeta*omega0*x' + omega0^2*x = 0`, onde a massa se
 * cancela — `stiffness/m` e `damping/m` sao os unicos termos que sobram.
 * Dobrar a massa dobra stiffness e damping juntos e produz a MESMA curva.
 * O teste `mola derivada nao depende da massa` prova isso em vez de afirmar.
 * 1 e o default do Remotion (docs/spring), entao e o menos surpreendente.
 */
export const MASSA_DE_REFERENCIA = 1;

/**
 * Converte um preset de token (zeta, T) na config que `spring()` consome.
 * Esta e a unica origem de numero de mola neste arquivo.
 *
 * A config carrega a FORMA (zeta). O TEMPO vem de `duracaoDaMola()`.
 */
export function configDaMola(preset: SpringPreset): ConfigDeMola {
  const omega0 =
    Math.log(1 / springDurationRestThreshold) /
    (preset.zeta * preset.settlingTimeSeconds);
  return {
    mass: MASSA_DE_REFERENCIA,
    stiffness: omega0 * omega0 * MASSA_DE_REFERENCIA,
    damping: 2 * preset.zeta * omega0 * MASSA_DE_REFERENCIA,
    // A parada e responsabilidade do amortecimento (zeta), nao de um corte.
    overshootClamping: false,
  };
}

/**
 * Tempo de acomodacao do preset, em frames — o campo `settlingTimeSeconds`
 * do token, convertido para a grade de frames uma unica vez.
 * Vai em `spring({ durationInFrames })`.
 */
export function duracaoDaMola(preset: SpringPreset, fps: number): number {
  return Math.max(1, Math.round(preset.settlingTimeSeconds * fps));
}

/**
 * Le um preset pelo nome e ESTOURA se ele nao existir.
 *
 * Cair num default silencioso seria pior que o bug: o video sairia com outra
 * mola e nenhum gate acusaria. Se este erro aparecer, o token e que precisa
 * mudar — e `src/design/tokens.ts` e singleton (S-5), fora do alcance deste
 * card por contrato da onda.
 */
export function presetObrigatorio(nome: string): SpringPreset {
  const preset = springPresets[nome];
  if (preset === undefined) {
    throw new Error(
      `no-cabecalho: preset de mola "${nome}" nao existe em src/design/tokens.ts ` +
        `(disponiveis: ${Object.keys(springPresets).sort().join(", ")})`,
    );
  }
  return preset;
}

/**
 * O valor da mola nomeada num frame — 0 no comeco, 1 quando acomodou.
 *
 * Os tres campos que o Remotion recebe saem todos de token:
 *   config                 <- (zeta) de springPresets
 *   durationInFrames       <- (settlingTimeSeconds) de springPresets
 *   durationRestThreshold  <- springDurationRestThreshold
 */
export function molaEm(
  frame: number,
  fps: number,
  preset: SpringPreset,
  atraso = 0,
): number {
  return spring({
    frame,
    fps,
    config: configDaMola(preset),
    durationInFrames: duracaoDaMola(preset, fps),
    durationRestThreshold: springDurationRestThreshold,
    delay: atraso,
  });
}

/**
 * De que preset NOMEADO cada `animacao.tipo` do manifesto se serve.
 * O manifesto escolhe a intencao; o token escolhe os numeros.
 * `null` = sem mola, o no entra pronto (corte seco).
 */
export const NOME_DA_MOLA_POR_ANIMACAO: Record<AnimacaoTipo, string | null> = {
  none: null,
  fade: "suave",
  slide: "snappy",
  scale: "snappy",
  spring: "overshoot",
};

/** Preset usado quando o no nao declara `animacao`. */
export const NOME_DA_MOLA_PADRAO = "suave";

/** Preset do subtitulo — entra atras do titulo, sem repique. */
export const NOME_DA_MOLA_DO_SUBTITULO = "suave";

/** Resolve o preset de entrada de um no de cabecalho. `null` = corte seco. */
export function molaDoNo(cabecalho: NoCabecalho): SpringPreset | null {
  const tipo = cabecalho.animacao?.tipo;
  const nome =
    tipo === undefined ? NOME_DA_MOLA_PADRAO : NOME_DA_MOLA_POR_ANIMACAO[tipo];
  return nome === null ? null : presetObrigatorio(nome);
}

// ---------------------------------------------------------------------------
// Janela do proprio no — o componente nao desenha fora dela
// ---------------------------------------------------------------------------

/**
 * Quantos frames o no leva para sumir no fim da PROPRIA janela.
 * Vem de `transitionDuration.snap`, arredondado uma unica vez na camada de
 * token por `msToFrames()`. Nunca passa da duracao declarada.
 */
export function janelaDeSaida(duracaoDeclarada: number, fps: number): number {
  return Math.max(1, Math.min(duracaoDeclarada, msToFrames(transitionDuration.snap, fps)));
}

/** Atraso do subtitulo em relacao ao titulo (escalonamento). */
export function atrasoDoSubtitulo(fps: number): number {
  return msToFrames(transitionDuration.instant, fps);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

type Alinhado = { textAlign: "left" | "center" | "right"; alignItems: string; origem: string };

const ALINHAMENTO: Record<string, Alinhado> = {
  esquerda: { textAlign: "left", alignItems: "flex-start", origem: "left center" },
  centro: { textAlign: "center", alignItems: "center", origem: "center center" },
  direita: { textAlign: "right", alignItems: "flex-end", origem: "right center" },
};

function alinhar(alinhamento: string | undefined): Alinhado {
  return ALINHAMENTO[alinhamento ?? "centro"] ?? ALINHAMENTO["centro"]!;
}

// ---------------------------------------------------------------------------
// Geometria para a sonda — o bloco do cabecalho em numeros
// ---------------------------------------------------------------------------

/**
 * A caixa da coluna (titulo + regua + subtitulo) dentro da regiao. O bloco
 * real e a coluna flex centralizada na regiao; a caixa e o retangulo que a
 * envolve — o que a sonda de sobreposicao le do DOM (data-bbox).
 */
export function caixaDoCabecalho(
  cabecalho: NoCabecalho,
  regiao: Regiao,
  width: number,
  height: number,
): { x: number; y: number; largura: number; altura: number } {
  const tamanhoTitulo = Math.round(height * typeScale.display);
  const tamanhoSubtitulo =
    cabecalho.subtitulo === undefined ? 0 : Math.round(height * typeScale.subtitle);
  const largura = Math.max(
    measureTextWidth(cabecalho.texto, tamanhoTitulo),
    cabecalho.subtitulo === undefined
      ? 0
      : measureTextWidth(cabecalho.subtitulo, tamanhoSubtitulo),
    spacing["32"], // a regua
  );
  const altura =
    Math.ceil(tamanhoTitulo * lineHeight.tight) +
    spacing["4"] +
    spacing["1"] +
    (cabecalho.subtitulo === undefined
      ? 0
      : spacing["6"] + Math.ceil(tamanhoSubtitulo * lineHeight.normal));
  const layout = alinhar(cabecalho.alinhamento);
  const margemHorizontal = Math.round(width * safeArea16x9.graphicsSafePct);
  const x =
    layout.alignItems === "flex-start"
      ? regiao.x + margemHorizontal
      : layout.alignItems === "flex-end"
        ? regiao.x + regiao.largura - margemHorizontal - largura
        : regiao.x + Math.floor((regiao.largura - largura) / 2);
  const y = regiao.y + Math.floor((regiao.altura - altura) / 2);
  return { x, y, largura, altura };
}

// ---------------------------------------------------------------------------
// O componente
// ---------------------------------------------------------------------------

const Cabecalho: NoComponent = ({ no, frame, fps, width, height }) => {
  const cabecalho = no as NoCabecalho;
  const duracao = cabecalho.duracao_frames;

  // Recusar e o comportamento correto: um no sem janela nao tem como animar,
  // e desenhar "para sempre" seria um quadro fantasma sem erro nenhum.
  if (!Number.isFinite(duracao) || duracao <= 0) {
    throw new Error(
      `no-cabecalho: duracao_frames invalida (${String(duracao)}) no no "${cabecalho.id}"`,
    );
  }

  // A JANELA DECLARADA MANDA. Fora de [0, duracao_frames) o no nao desenha
  // nada — nem opacidade zero, nem caixa invisivel que ainda empurra layout.
  if (frame < 0 || frame >= duracao) {
    return null;
  }

  const preset = molaDoNo(cabecalho);
  const saida = janelaDeSaida(duracao, fps);

  // Progresso de entrada em [0, 1]. Sem preset (animacao "none") o no ja
  // comeca inteiro.
  const entradaTitulo = preset === null ? 1 : molaEm(frame, fps, preset);

  const presetDoSubtitulo = presetObrigatorio(NOME_DA_MOLA_DO_SUBTITULO);
  const entradaSubtitulo =
    preset === null
      ? 1
      : molaEm(frame, fps, presetDoSubtitulo, atrasoDoSubtitulo(fps));

  // Saida: some nos ultimos `saida` frames da propria janela.
  const fechamento = interpolate(frame, [duracao - saida, duracao], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacidadeTitulo =
    interpolate(entradaTitulo, [0, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * fechamento;

  const opacidadeSubtitulo =
    interpolate(entradaSubtitulo, [0, 1], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * fechamento;

  // Deslocamento vertical de entrada: o titulo sobe ate a linha de base.
  const subidaTitulo = interpolate(entradaTitulo, [0, 1], [spacing["6"], spacing["0"]], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subidaSubtitulo = interpolate(
    entradaSubtitulo,
    [0, 1],
    [spacing["4"], spacing["0"]],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // A regua de destaque cresce com a MESMA mola do titulo — inclusive o
  // repique, quando o preset tem zeta < 1.
  const escalaDaRegua = interpolate(entradaTitulo, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "extend",
  });

  const layout = alinhar(cabecalho.alinhamento);

  // Graphics safe da EBU R 95: texto de titulo nunca encosta na borda.
  const margemHorizontal = Math.round(width * safeArea16x9.graphicsSafePct);
  const margemVertical = Math.round(height * safeArea16x9.graphicsSafePct);

  // Eixo de texto (onda 2): a banda onde a coluna se centraliza e o fator
  // de transicao. O fator fica na OPACIDADE DO ENVELOPE (este container) —
  // o titulo e o subtitulo mantem a propria aritmetica (AB-312: o fade de
  // saida da propria janela do no nao e multiplicado pela transicao) — e o
  // fundo opaco do container some junto com o texto, senao a cena que sai
  // esconderia a que entra na transicao (retangulo opaco).
  const comEixo = no as NoComEixo;
  const regiao = comEixo.eixo?.regiao ?? regiaoDoQuadro(width, height);
  const fator = comEixo.eixo?.fatorTexto ?? 1;
  const visibilidadeDoTitulo = Math.round(
    opacidadeTitulo * fator * 1000,
  ) / 1000;
  const visibilidadeDoSubtitulo =
    cabecalho.subtitulo === undefined
      ? 0
      : Math.round(opacidadeSubtitulo * fator * 1000) / 1000;
  const caixa = caixaDoCabecalho(cabecalho, regiao, width, height);

  return (
    <div
      data-no={cabecalho.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      data-duracao={String(duracao)}
      data-regiao={`${String(regiao.x)},${String(regiao.y)},${String(regiao.largura)},${String(regiao.altura)}`}
      data-fator-texto={String(fator)}
      data-bbox={`${String(caixa.x)},${String(caixa.y)},${String(caixa.largura)},${String(caixa.altura)}`}
      data-visibilidade={String(Math.max(visibilidadeDoTitulo, visibilidadeDoSubtitulo))}
      style={{
        position: "absolute",
        left: regiao.x,
        top: regiao.y,
        width: regiao.largura,
        height: regiao.altura,
        display: "flex",
        flexDirection: "column",
        alignItems: layout.alignItems,
        justifyContent: "center",
        paddingLeft: margemHorizontal,
        paddingRight: margemHorizontal,
        paddingTop: margemVertical,
        paddingBottom: margemVertical,
        backgroundColor: background.primary,
        // O fator so entra no estilo quando difere de 1: fora de transicao
        // o container NAO declara opacidade (a mola do titulo e a unica
        // autoridade — o gate de opacidade do no le o maximo do markup).
        ...(fator < 1 ? { opacity: fator } : {}),
        color: corDeTexto.primary,
        fontFamily: fontFamily.sans,
      }}
    >
      <h1
        style={{
          margin: spacing["0"],
          maxWidth: "100%",
          fontFamily: fontFamily.display,
          fontSize: Math.round(height * typeScale.display),
          fontWeight: fontWeight.bold,
          lineHeight: lineHeight.tight,
          textAlign: layout.textAlign,
          color: corDeTexto.primary,
          opacity: opacidadeTitulo,
          transform: `translateY(${String(subidaTitulo)}px)`,
        }}
      >
        {cabecalho.texto}
      </h1>

      <div
        data-regua={meta.id}
        style={{
          marginTop: spacing["4"],
          width: spacing["32"],
          height: spacing["1"],
          backgroundColor: highlight.primary,
          opacity: opacidadeTitulo,
          transform: `scaleX(${String(escalaDaRegua)})`,
          transformOrigin: layout.origem,
        }}
      />

      {cabecalho.subtitulo === undefined ? null : (
        <p
          style={{
            marginTop: spacing["6"],
            marginBottom: spacing["0"],
            maxWidth: "100%",
            fontFamily: fontFamily.sans,
            fontSize: Math.round(height * typeScale.subtitle),
            fontWeight: fontWeight.regular,
            lineHeight: lineHeight.normal,
            textAlign: layout.textAlign,
            color: corDeTexto.secondary,
            opacity: opacidadeSubtitulo,
            transform: `translateY(${String(subidaSubtitulo)}px)`,
          }}
        >
          {cabecalho.subtitulo}
        </p>
      )}
    </div>
  );
};

export default Cabecalho;
