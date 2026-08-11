// =============================================================================
// MANIFESTO RAIZ — o plano de composicao e o componente que o renderiza
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// Este modulo e PURO: nenhum hook do Remotion, nenhum disco, nenhum relogio.
// Recebe `manifesto` e `frame` por props e devolve a arvore React. E por isso
// que ele pode ser renderizado de verdade (react-dom/server) dentro de um
// teste, sem navegador — o que torna o gate capaz de reprovar de fato.
//
// A raiz RECUSA manifesto torto. Nao existe "pular o no que eu nao conheco":
// um tipo desconhecido, um id pendurado ou um no orfao param a composicao.
// Ver docs/adr/0006-composicao-raiz.md.
// =============================================================================

import type React from "react";
import { AbsoluteFill } from "remotion";
import type { Manifesto, No } from "../contratos/manifesto";
import { background, fontFamily } from "../design/tokens";
import {
  SCHEMA_POR_TIPO,
  TIPOS_DE_NO,
  isTipoDeNo,
  type NoComponent,
} from "./contrato-de-no";
import { REGISTRO_DE_NOS, type RegistroDeNos } from "./registro";
import { calcularDuracao, type DuracaoResolvida, type TimelineCena } from "./tempo";

// ---------------------------------------------------------------------------
// Erro
// ---------------------------------------------------------------------------

/** Erro de composicao: manifesto que a raiz se recusa a renderizar. */
export class ErroDeComposicao extends Error {
  readonly erros: readonly string[];
  constructor(erros: readonly string[]) {
    super(
      `A raiz recusou o manifesto (${erros.length} erro(s)):\n` +
        erros.map((e) => `  - ${e}`).join("\n"),
    );
    this.name = "ErroDeComposicao";
    this.erros = erros;
  }
}

// ---------------------------------------------------------------------------
// Plano de composicao — a fiacao inteira, em dados
// ---------------------------------------------------------------------------

/** Um no posicionado em frames absolutos, com o componente que o desenha. */
export interface FaixaDeNo {
  noId: string;
  tipo: string;
  cenaId: string;
  /** Frame absoluto inicial (inclusivo) */
  inicio: number;
  /** Frame absoluto final (exclusivo) */
  fim: number;
  duracao: number;
  no: No;
  componente: NoComponent;
}

/** Tudo que a raiz precisa para renderizar, ja resolvido e conferido. */
export interface PlanoDeComposicao {
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  totalSegundos: number;
  somaCenas: number;
  somaTransicoes: number;
  timeline: readonly TimelineCena[];
  faixas: readonly FaixaDeNo[];
  duracao: DuracaoResolvida;
}

/**
 * Confere o manifesto contra o registro de componentes.
 * Devolve TODOS os problemas de uma vez (lista vazia = aprovado).
 */
export function conferirManifesto(
  manifesto: Manifesto,
  registro: RegistroDeNos = REGISTRO_DE_NOS,
): string[] {
  const erros: string[] = [];

  if (manifesto.cenas.length === 0) {
    erros.push("manifesto sem cenas");
  }
  if (manifesto.nos.length === 0) {
    erros.push("manifesto sem nos");
  }

  const porId = new Map<string, No>();
  for (const no of manifesto.nos) {
    if (porId.has(no.id)) {
      erros.push(`no com id duplicado: "${no.id}"`);
      continue;
    }
    porId.set(no.id, no);

    if (!isTipoDeNo(no.type)) {
      erros.push(
        `no "${no.id}": tipo desconhecido "${no.type}" ` +
          `(tipos do schema: ${TIPOS_DE_NO.join(", ")})`,
      );
      continue;
    }

    if (!registro.has(no.type)) {
      erros.push(
        `no "${no.id}": tipo "${no.type}" nao tem componente registrado ` +
          `(registrados: ${[...registro.keys()].sort().join(", ")})`,
      );
    }

    const schemaEsperado = SCHEMA_POR_TIPO[no.type];
    if (no.schema !== schemaEsperado) {
      erros.push(
        `no "${no.id}": schema "${no.schema}" diverge do tipo "${no.type}" ` +
          `(esperado "${schemaEsperado}")`,
      );
    }

    if (!Number.isFinite(no.duracao_frames) || no.duracao_frames <= 0) {
      erros.push(`no "${no.id}": duracao_frames invalida (${no.duracao_frames})`);
    }
    const entrada = no.entrada_frames ?? 0;
    if (!Number.isFinite(entrada) || entrada < 0) {
      erros.push(`no "${no.id}": entrada_frames invalida (${entrada})`);
    }
  }

  // Referencias das cenas e nos orfaos: os dois somem do video em silencio.
  const usados = new Set<string>();
  for (const cena of manifesto.cenas) {
    if (cena.nos.length === 0) {
      erros.push(`cena "${cena.id}": nenhum no`);
    }
    for (const noId of cena.nos) {
      if (!porId.has(noId)) {
        erros.push(`cena "${cena.id}": referencia no inexistente "${noId}"`);
        continue;
      }
      if (usados.has(noId)) {
        erros.push(`no "${noId}": usado por mais de uma cena`);
      }
      usados.add(noId);
    }
  }
  for (const no of manifesto.nos) {
    if (!usados.has(no.id)) {
      erros.push(`no "${no.id}": declarado e nunca usado por nenhuma cena`);
    }
  }

  return erros;
}

/**
 * Monta o plano de composicao. LANCA `ErroDeComposicao` se o manifesto
 * nao passar em `conferirManifesto` — recusar e o comportamento correto,
 * pular o no problematico seria um quadro preto sem erro.
 */
export function planoDeComposicao(
  manifesto: Manifesto,
  registro: RegistroDeNos = REGISTRO_DE_NOS,
): PlanoDeComposicao {
  const erros = conferirManifesto(manifesto, registro);
  if (erros.length > 0) {
    throw new ErroDeComposicao(erros);
  }

  const duracao = calcularDuracao(manifesto);
  const porId = new Map(manifesto.nos.map((no) => [no.id, no] as const));
  const porCena = new Map(duracao.timeline.map((t) => [t.cenaId, t] as const));
  const faixas: FaixaDeNo[] = [];

  for (const cena of manifesto.cenas) {
    const janela = porCena.get(cena.id)!;
    for (const noId of cena.nos) {
      const no = porId.get(noId)!;
      const entrada = no.entrada_frames ?? 0;
      const inicio = janela.frameInicial + entrada;
      faixas.push({
        noId,
        tipo: no.type,
        cenaId: cena.id,
        inicio,
        fim: inicio + no.duracao_frames,
        duracao: no.duracao_frames,
        no,
        componente: registro.get(no.type)!.componente,
      });
    }
  }

  return {
    fps: manifesto.fps,
    width: manifesto.width,
    height: manifesto.height,
    totalFrames: duracao.totalFrames,
    totalSegundos: duracao.totalSegundos,
    somaCenas: duracao.somaCenas,
    somaTransicoes: duracao.somaTransicoes,
    timeline: duracao.timeline,
    faixas: Object.freeze(faixas),
    duracao,
  };
}

/** Faixas visiveis num frame absoluto, com o frame local de cada uma. */
export function faixasVisiveis(
  plano: PlanoDeComposicao,
  frame: number,
): { faixa: FaixaDeNo; frameLocal: number }[] {
  return plano.faixas
    .filter((faixa) => frame >= faixa.inicio && frame < faixa.fim)
    .map((faixa) => ({ faixa, frameLocal: frame - faixa.inicio }));
}

// ---------------------------------------------------------------------------
// Envelope — quem decide se a faixa aparece neste frame
// ---------------------------------------------------------------------------

export interface EnvelopeProps {
  /** Frame absoluto em que a faixa comeca */
  inicio: number;
  /** Duracao da faixa em frames */
  duracao: number;
  /** Nome da faixa (id do no) — vira nome de trilha no Studio */
  nome: string;
  /** Frame absoluto atual */
  frame: number;
  children: React.ReactNode;
}

export type Envelope = React.FC<EnvelopeProps>;

/**
 * Envelope padrao: janelamento explicito, zero dependencia do Remotion.
 * E o que permite renderizar a raiz inteira num teste de node.
 */
export const EnvelopeJanela: Envelope = ({ inicio, duracao, nome, frame, children }) => {
  if (frame < inicio || frame >= inicio + duracao) {
    return null;
  }
  return (
    <div data-faixa={nome} style={{ position: "absolute", inset: 0 }}>
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Componente raiz — puro
// ---------------------------------------------------------------------------

export interface ManifestoRaizProps {
  manifesto: Manifesto;
  /** Frame absoluto. Vem por prop: a raiz nao le relogio nem hook. */
  frame: number;
  registro?: RegistroDeNos;
  Envelope?: Envelope;
}

export const ManifestoRaiz: React.FC<ManifestoRaizProps> = ({
  manifesto,
  frame,
  registro = REGISTRO_DE_NOS,
  Envelope = EnvelopeJanela,
}) => {
  const plano = planoDeComposicao(manifesto, registro);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background.primary,
        fontFamily: fontFamily.sans,
      }}
    >
      {plano.faixas.map((faixa) => {
        const Componente = faixa.componente;
        return (
          <Envelope
            key={faixa.noId}
            inicio={faixa.inicio}
            duracao={faixa.duracao}
            nome={faixa.noId}
            frame={frame}
          >
            <Componente
              no={faixa.no}
              frame={frame - faixa.inicio}
              fps={plano.fps}
              width={plano.width}
              height={plano.height}
            />
          </Envelope>
        );
      })}
    </AbsoluteFill>
  );
};
