// =============================================================================
// NO: texto — destaque palavra a palavra, com degradacao declarada para frase
// =============================================================================
// Card: F1-05 (onda W4). Substitui o no de mentira escrito por F1-01. O `meta`
// e o mesmo de la de proposito: a descoberta por convencao e o gate de
// unicidade leem dele, e trocar `tipo`/`schema`/`id` quebraria os dois.
//
// O QUE ESTE COMPONENTE DECIDE
//
//   destaque PALAVRA A PALAVRA  <- exige timing por palavra
//   destaque POR FRASE          <- e o que sobra quando esse timing nao existe
//
// O timing por palavra e produto do estagio de locucao (card F2-03), que roda
// EM PARALELO com este card: no disco ele ainda nao existe. Por isso o formato
// abaixo e uma SUPOSICAO DECLARADA, validada em tempo de render, e nunca um
// import do modulo do vizinho (dependencia lateral e proibida por construcao).
//
//   no.timing_palavras: { texto: string; inicio_ms: number; fim_ms: number }[]
//
//   - Milissegundos, nao frames. A fronteira de resolucao nao conhece o fps da
//     composicao; a conversao acontece aqui, uma vez, por msToFrames().
//   - Origem do tempo: o frame LOCAL 0 deste no — o unico zero que o contrato
//     de no entrega. Se F2-03 ancorar no inicio da cena ou no inicio do audio,
//     quem reancora e o estagio de montagem, nao o componente.
//   - Uma entrada por palavra de `no.texto`, na mesma ordem.
//
// QUALQUER desvio disso degrada para frase: nao desenha torto e nao estoura.
// O motivo da degradacao sai no DOM (data-degradacao), porque "degradou" e
// "degradou pelo motivo certo" sao afirmacoes diferentes — um componente que
// degradasse sempre passaria no primeiro teste e falharia o segundo.
//
// SEM TIMING, POR QUE "FRASE" E NAO "NADA": a frase ja carrega, no proprio
// schema do manifesto, um sinal de enfase — o campo booleano `destaque`. A
// degradacao nao inventa informacao: ela troca a granularidade do realce, de
// palavra (derivada do timing) para frase (declarada no manifesto).
//
// CONTRATO (cobrado por `just comp-pureza`): funcao pura de
// (no, frame, fps, width, height); `frame` vem por prop; zero relogio, zero
// RNG, zero rede; zero animacao CSS; toda interpolacao com extrapolateLeft e
// extrapolateRight explicitos. Imports relativos: o bundler e webpack e nao le
// os `paths` do tsconfig.
// =============================================================================

import { Fragment } from "react";
import { interpolate } from "remotion";
import type { NoTexto } from "../../contratos/manifesto";
import {
  background,
  fontWeight,
  highlight,
  lineHeight,
  maxCharsPerLine,
  msToFrames,
  spacing,
  text as corDeTexto,
  transitionDuration,
  typeScale,
} from "../../design/tokens";
import type { NoComponent, NoComponentMeta } from "../contrato-de-no";

export const meta: NoComponentMeta = {
  tipo: "texto",
  schema: "Texto.1",
  id: "no-texto",
  descricao:
    "Corpo de texto com destaque palavra a palavra quando ha timing de locucao; sem timing, degrada para destaque por frase",
};

// ---------------------------------------------------------------------------
// A suposicao sobre o timing de locucao (F2-03) — declarada, nao importada
// ---------------------------------------------------------------------------

/** Nome do campo que o estagio de locucao anexa ao no. */
export const CAMPO_DE_TIMING = "timing_palavras";

/** Uma palavra locutada, em milissegundos relativos ao frame local 0 do no. */
export interface PalavraLocutada {
  texto: string;
  inicio_ms: number;
  fim_ms: number;
}

/** Granularidade do realce efetivamente usada no render. */
export type ModoDeDestaque = "palavra" | "frase";

/**
 * Por que o componente caiu para frase.
 *
 * "nenhuma" e o unico valor que acompanha o modo "palavra". Os demais sao
 * causas distintas de degradacao: um teste que so soubesse dizer "degradou"
 * nao distinguiria timing ausente de timing corrompido.
 */
export type MotivoDeDegradacao =
  | "nenhuma"
  | "ausente"
  | "nao-lista"
  | "vazio"
  | "malformado"
  | "fora-de-ordem"
  | "desalinhado";

/** Estado de uma unidade de realce no frame corrente. */
export type EstadoDeUnidade = "falada" | "ativa" | "pendente";

/** Resultado da leitura do timing: ou uma lista valida, ou o motivo da recusa. */
export interface LeituraDeTiming {
  palavras: readonly PalavraLocutada[] | null;
  motivo: MotivoDeDegradacao;
}

/**
 * Divide o texto em palavras. Deterministico e sem locale: `\s+` nao consulta
 * tabela de idioma nenhuma.
 */
export function palavrasDoTexto(texto: string): string[] {
  const aparado = texto.trim();
  if (aparado.length === 0) {
    return [];
  }
  return aparado.split(/\s+/);
}

function ehNumeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

/**
 * Le e valida o timing por palavra anexado ao no.
 *
 * Estrita de proposito: o produto de um timing meio certo nao e um video meio
 * certo, e uma palavra realcada na hora errada — que ninguem ve no gate e todo
 * mundo ve no video. Quando ha duvida, degrada.
 *
 * @param no        o no de texto, possivelmente com o campo de timing
 * @param quantidade quantas palavras `no.texto` tem (o timing tem de casar)
 */
export function lerTimingDePalavras(
  no: NoTexto,
  quantidade: number,
): LeituraDeTiming {
  const bruto = (no as unknown as Record<string, unknown>)[CAMPO_DE_TIMING];

  if (bruto === undefined || bruto === null) {
    return { palavras: null, motivo: "ausente" };
  }
  if (!Array.isArray(bruto)) {
    return { palavras: null, motivo: "nao-lista" };
  }
  if (bruto.length === 0) {
    return { palavras: null, motivo: "vazio" };
  }

  const palavras: PalavraLocutada[] = [];
  for (const entrada of bruto as unknown[]) {
    if (entrada === null || typeof entrada !== "object") {
      return { palavras: null, motivo: "malformado" };
    }
    const registro = entrada as Record<string, unknown>;
    const textoDaPalavra = registro["texto"];
    const inicio = registro["inicio_ms"];
    const fim = registro["fim_ms"];
    if (typeof textoDaPalavra !== "string" || textoDaPalavra.trim().length === 0) {
      return { palavras: null, motivo: "malformado" };
    }
    if (!ehNumeroFinito(inicio) || !ehNumeroFinito(fim)) {
      return { palavras: null, motivo: "malformado" };
    }
    if (inicio < 0 || fim <= inicio) {
      return { palavras: null, motivo: "malformado" };
    }
    palavras.push({ texto: textoDaPalavra, inicio_ms: inicio, fim_ms: fim });
  }

  // Monotonicidade: sem isso duas palavras podem estar ativas no mesmo frame,
  // e "a palavra ativa" deixa de ser uma funcao do frame.
  for (let i = 1; i < palavras.length; i++) {
    const anterior = palavras[i - 1] as PalavraLocutada;
    const atual = palavras[i] as PalavraLocutada;
    if (atual.inicio_ms < anterior.fim_ms) {
      return { palavras: null, motivo: "fora-de-ordem" };
    }
  }

  // O timing descreve OUTRA frase: nao da para saber qual palavra realcar.
  if (palavras.length !== quantidade) {
    return { palavras: null, motivo: "desalinhado" };
  }

  return { palavras, motivo: "nenhuma" };
}

/** Janela de uma palavra em frames locais. */
export interface JanelaDePalavra {
  inicio: number;
  fim: number;
}

/** Converte o timing de ms para frames. Arredondamento unico, em msToFrames. */
export function janelasEmFrames(
  palavras: readonly PalavraLocutada[],
  fps: number,
): JanelaDePalavra[] {
  return palavras.map((p) => ({
    inicio: msToFrames(p.inicio_ms, fps),
    fim: msToFrames(p.fim_ms, fps),
  }));
}

/**
 * Indice da palavra ativa no frame, ou -1 se nenhuma esta sendo dita.
 *
 * Ativa e `inicio <= frame < fim`. Nos vaos entre palavras, e depois da
 * ultima, nada fica ativo — realcar a ultima palavra ate o fim do no mentiria
 * sobre o audio.
 */
export function indiceAtivo(
  janelas: readonly JanelaDePalavra[],
  frame: number,
): number {
  for (let i = 0; i < janelas.length; i++) {
    const janela = janelas[i] as JanelaDePalavra;
    if (frame >= janela.inicio && frame < janela.fim) {
      return i;
    }
  }
  return -1;
}

/** Estado de cada palavra no frame corrente. */
export function estadosDasPalavras(
  janelas: readonly JanelaDePalavra[],
  frame: number,
): EstadoDeUnidade[] {
  const ativo = indiceAtivo(janelas, frame);
  return janelas.map((janela, i) => {
    if (i === ativo) {
      return "ativa";
    }
    return frame >= janela.fim ? "falada" : "pendente";
  });
}

// ---------------------------------------------------------------------------
// Cor e peso por estado — tudo de token, nada redeclarado
// ---------------------------------------------------------------------------

function corDaUnidade(estado: EstadoDeUnidade): string {
  if (estado === "ativa") {
    return highlight.primary;
  }
  return estado === "falada" ? corDeTexto.primary : corDeTexto.secondary;
}

function pesoDaUnidade(estado: EstadoDeUnidade, base: number): number {
  return estado === "ativa" ? fontWeight.bold : base;
}

// ---------------------------------------------------------------------------
// O componente
// ---------------------------------------------------------------------------

const Texto: NoComponent = ({ no, frame, fps, height }) => {
  const texto = no as NoTexto;

  // A janela do proprio no. Desenhar fora dela e o modo classico de um no
  // "funcionar" e mesmo assim aparecer onde nao devia: o envelope some, o
  // componente continua desenhando, e o gate de tempo nao ve nada.
  const duracao = texto.duracao_frames;
  if (!Number.isFinite(duracao) || duracao <= 0 || frame < 0 || frame >= duracao) {
    return null;
  }

  const entrada = Math.max(1, msToFrames(transitionDuration.base, fps));
  const opacidade = interpolate(frame, [0, entrada], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const palavras = palavrasDoTexto(texto.texto);
  const leitura = lerTimingDePalavras(texto, palavras.length);
  const temTiming = leitura.palavras !== null && palavras.length > 0;
  const modo: ModoDeDestaque = temTiming ? "palavra" : "frase";

  const janelas = temTiming
    ? janelasEmFrames(leitura.palavras as readonly PalavraLocutada[], fps)
    : [];
  const estados = temTiming ? estadosDasPalavras(janelas, frame) : [];
  const ativa = temTiming ? indiceAtivo(janelas, frame) : texto.destaque ? 0 : -1;

  const pesoBase = texto.destaque ? fontWeight.semibold : fontWeight.regular;
  const unidades = temTiming ? palavras.length : 1;

  const alinhamento = texto.alinhamento ?? "esquerda";
  const textAlign =
    alinhamento === "esquerda" ? "left" : alinhamento === "direita" ? "right" : "center";
  const justifyContent =
    alinhamento === "esquerda"
      ? "flex-start"
      : alinhamento === "direita"
        ? "flex-end"
        : "center";

  // Modo frase: a frase inteira e UMA unidade de realce, e quem diz se ela
  // esta realcada e o campo `destaque` do manifesto.
  const estadoDaFrase: EstadoDeUnidade = texto.destaque ? "ativa" : "pendente";

  return (
    <div
      data-no={texto.id}
      data-tipo={meta.tipo}
      data-frame={String(frame)}
      data-destaque={modo}
      data-degradacao={leitura.motivo}
      data-unidades={String(unidades)}
      data-ativa={String(ativa)}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent,
        paddingLeft: spacing["24"],
        paddingRight: spacing["24"],
        backgroundColor: background.primary,
        opacity: opacidade,
      }}
    >
      <p
        style={{
          fontSize: Math.round(height * typeScale.body),
          fontWeight: pesoBase,
          lineHeight: lineHeight.relaxed,
          maxWidth: `${String(maxCharsPerLine)}ch`,
          textAlign,
          margin: 0,
        }}
      >
        {temTiming ? (
          palavras.map((palavra, i) => {
            const estado = estados[i] as EstadoDeUnidade;
            return (
              <Fragment key={`${String(i)}-${palavra}`}>
                {i > 0 ? " " : null}
                <span
                  data-unidade={String(i)}
                  data-estado={estado}
                  style={{
                    color: corDaUnidade(estado),
                    fontWeight: pesoDaUnidade(estado, pesoBase),
                  }}
                >
                  {palavra}
                </span>
              </Fragment>
            );
          })
        ) : (
          <span
            data-unidade={String(0)}
            data-estado={estadoDaFrase}
            style={{
              color: corDaUnidade(estadoDaFrase),
              fontWeight: pesoDaUnidade(estadoDaFrase, pesoBase),
            }}
          >
            {texto.texto}
          </span>
        )}
      </p>
    </div>
  );
};

export default Texto;
