// =============================================================================
// SEQUENCIA COM TRANSICOES — quem poe as duas cenas na tela ao mesmo tempo
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Componente PURO: recebe `manifesto` e `frame` por prop, devolve a arvore.
// Nenhum useCurrentFrame(), nenhum relogio, nenhuma animacao CSS. O unico
// arquivo desta pasta que fala com o runtime do Remotion e `entrada.tsx`.
//
// O que este componente decide, e nada mais:
//   1. quais cenas existem no frame (uma fora da fronteira, DUAS dentro);
//   2. qual apresentacao envolve cada lado;
//   3. em que ordem elas pintam (a que sai primeiro, a que entra por cima).
//
// Quem PINTA a cena e injetado (`Cena`). Isso mantem esta camada independente
// do registro de nos, que e de outro card: nenhuma dependencia lateral.
//
// A perspectiva 3D fica no envoltorio de cada lado, nao no palco: em CSS,
// `perspective` so vale para os FILHOS DIRETOS do elemento que a declara, e o
// filho direto do envoltorio e justamente a apresentacao.
// =============================================================================

import type React from "react";
import type { Manifesto } from "../../contratos/manifesto";
import { CASAS_DECIMAIS, pixels, type LadoDaTransicao } from "./contrato";
import {
  cenasNoFrame,
  planoDeTransicoes,
  type CenaNoFrame,
  type PlanoDeTransicoes,
} from "./fronteiras";
import {
  REGISTRO_DE_APRESENTACOES,
  apresentacaoDe,
  type RegistroDeApresentacoes,
} from "./registro";

// ---------------------------------------------------------------------------
// O pintor de cena — injetado
// ---------------------------------------------------------------------------

export interface PintorDeCenaProps {
  /** Id da cena a pintar */
  cenaId: string;
  /** Frame LOCAL da cena: 0 = primeiro frame desta cena */
  frame: number;
  /** Frame absoluto da composicao — util para audio e depuracao */
  frameAbsoluto: number;
  /** Lado da fronteira, ou null quando a cena esta sozinha no frame */
  lado: LadoDaTransicao | null;
  /**
   * Progresso da fronteira ativa em [0, 1); 0 quando lado e null.
   * Consumido pelo pintor de cena para o eixo temporal de texto (a cena
   * que sai some na primeira metade; a que entra aparece na segunda).
   */
  progresso: number;
  fps: number;
  width: number;
  height: number;
}

/** Quem desenha uma cena inteira. Funcao pura das props. */
export type PintorDeCena = React.FC<PintorDeCenaProps>;

// ---------------------------------------------------------------------------
// O componente
// ---------------------------------------------------------------------------

export interface SequenciaComTransicoesProps {
  manifesto: Manifesto;
  /** Frame absoluto. Vem por prop: esta camada nao le relogio nem hook. */
  frame: number;
  /** Quem pinta cada cena */
  Cena: PintorDeCena;
  registro?: RegistroDeApresentacoes;
}

export const SequenciaComTransicoes: React.FC<SequenciaComTransicoesProps> = ({
  manifesto,
  frame,
  Cena,
  registro = REGISTRO_DE_APRESENTACOES,
}) => {
  const plano = planoDeTransicoes(manifesto);
  const presentes = cenasNoFrame(plano, frame);

  return (
    <div
      data-transicoes-palco=""
      data-frame={String(frame)}
      data-cenas={String(presentes.length)}
      style={{ position: "absolute", inset: 0 }}
    >
      {presentes.map((cena) => (
        <LadoDaCena
          key={cena.cenaId}
          cena={cena}
          plano={plano}
          frame={frame}
          Cena={Cena}
          registro={registro}
        />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Um lado da fronteira (ou uma cena sozinha)
// ---------------------------------------------------------------------------

interface LadoDaCenaProps {
  cena: CenaNoFrame;
  plano: PlanoDeTransicoes;
  frame: number;
  Cena: PintorDeCena;
  registro: RegistroDeApresentacoes;
}

const LadoDaCena: React.FC<LadoDaCenaProps> = ({
  cena,
  plano,
  frame,
  Cena,
  registro,
}) => {
  const { fronteira, lado } = cena;

  const conteudo = (
    <Cena
      cenaId={cena.cenaId}
      frame={cena.frameLocal}
      frameAbsoluto={frame}
      lado={lado}
      progresso={cena.progresso}
      fps={plano.fps}
      width={plano.width}
      height={plano.height}
    />
  );

  // Sem fronteira ativa: a cena e a tela inteira, sem envoltorio de transicao.
  if (!fronteira || !lado) {
    return (
      <div
        data-cena={cena.cenaId}
        data-lado="sozinha"
        data-transicao="nenhuma"
        style={{ position: "absolute", inset: 0 }}
      >
        {conteudo}
      </div>
    );
  }

  const Apresentacao = apresentacaoDe(fronteira.tipo, registro);

  return (
    <div
      data-cena={cena.cenaId}
      data-lado={lado}
      data-transicao={fronteira.tipo}
      data-progresso={cena.progresso.toFixed(CASAS_DECIMAIS)}
      style={{
        position: "absolute",
        inset: 0,
        perspective: pixels(plano.width),
      }}
    >
      <Apresentacao
        progresso={cena.progresso}
        lado={lado}
        direcao={fronteira.direcao}
        width={plano.width}
        height={plano.height}
      >
        {conteudo}
      </Apresentacao>
    </div>
  );
};

export default SequenciaComTransicoes;
