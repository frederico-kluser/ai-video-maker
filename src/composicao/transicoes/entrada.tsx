// =============================================================================
// ENTRADA — ponto de entrada do Remotion para as transicoes
// =============================================================================
// Card: F1-10 — Transicoes e composicao de sequencia
//
// Esta e a UNICA camada desta pasta que fala com o runtime do Remotion: e aqui
// que `useCurrentFrame()` vira a prop `frame`. Todo o resto de
// `src/composicao/transicoes/` e funcao pura de props, renderizavel em node
// com react-dom/server — e e por isso que o gate consegue reprovar de fato.
// Mesmo desenho de `../raiz.tsx` (F1-01).
//
// `tests/composicao/transicoes.test.ts` cobra essa fronteira: nenhum outro
// arquivo desta pasta pode citar `useCurrentFrame`.
//
// Uma composicao por tipo de transicao do schema. `durationInFrames` NUNCA e
// escrito a mao: sai da aritmetica subtrativa de `../tempo.ts`, via
// `planoDeTransicoes()`.
// =============================================================================

import type React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";
import type { TransicaoTipo } from "../../contratos/manifesto";
import { TIPOS_DE_TRANSICAO } from "./contrato";
import { Demonstracao, manifestoDeDemonstracao } from "./demonstracao";
import { planoDeTransicoes } from "./fronteiras";

/** Prefixo do id de composicao. `transicao-fade`, `transicao-wipe`, ... */
export const PREFIXO_COMPOSICAO = "transicao-";

/** Id de composicao de um tipo de transicao. */
export function idDaComposicao(tipo: TransicaoTipo): string {
  return `${PREFIXO_COMPOSICAO}${tipo}`;
}

// Type alias (nao interface): o <Composition> do Remotion exige props
// atribuiveis a Record<string, unknown>, e so type alias ganha index
// signature implicita.
export type DemonstracaoComposicaoProps = {
  tipo: TransicaoTipo;
};

/** Adaptador: transforma o relogio do Remotion na prop `frame`. */
export const DemonstracaoDoRemotion: React.FC<DemonstracaoComposicaoProps> = ({
  tipo,
}) => {
  const frame = useCurrentFrame();
  return <Demonstracao tipo={tipo} frame={frame} />;
};

export const RaizDasTransicoes: React.FC = () => (
  <>
    {TIPOS_DE_TRANSICAO.map((tipo) => {
      const plano = planoDeTransicoes(manifestoDeDemonstracao(tipo));
      return (
        <Composition
          key={tipo}
          id={idDaComposicao(tipo)}
          component={DemonstracaoDoRemotion}
          durationInFrames={plano.totalFrames}
          fps={plano.fps}
          width={plano.width}
          height={plano.height}
          defaultProps={{ tipo }}
        />
      );
    })}
  </>
);

registerRoot(RaizDasTransicoes);
