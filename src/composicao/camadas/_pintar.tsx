// =============================================================================
// PINTAR — o unico lugar do card que transforma plano em DOM
// =============================================================================
// Card: F1-11 — Camadas globais (fundo, grade, vinheta)
//
// As tres camadas compartilham ESTE renderizador. Nenhuma delas escreve JSX
// proprio. A razao e o modo de falha que o card persegue:
//
//   se o componente pudesse desenhar um <div> que o plano nao declara, o
//   teste geometrico mediria o plano e o video mostraria outra coisa — e as
//   duas metades ficariam verdes, cada uma contra a sua propria base.
//
// Com um renderizador unico e `plano.map(...)` literal, "o plano descreve o
// que e desenhado" deixa de ser disciplina e vira estrutura. O gate de pixel
// confirma no render de verdade: todo pixel que mudou cai dentro de algum
// retangulo declarado, e todo retangulo declarado mudou ao menos um pixel.
// =============================================================================

import type { ReactElement } from "react";
import {
  Z_INDEX_POR_PAPEL,
  foraDaJanela,
  type CamadaMeta,
  type CamadaProps,
  type PlanoDeCamada,
} from "./contrato-de-camada";

/**
 * Desenha o plano de uma camada.
 *
 * Devolve `null` — nao um `<div>` vazio — quando o frame esta fora da janela
 * declarada ou quando o plano esta vazio. `null` e verificavel no DOM; um
 * `<div>` vazio e indistinguivel de uma camada que deveria estar desenhando.
 */
export function pintarPlano(
  meta: CamadaMeta,
  plano: PlanoDeCamada,
  props: CamadaProps,
): ReactElement | null {
  if (foraDaJanela(props.frame, props.duracaoEmFrames)) return null;

  const retangulos = plano(props);
  if (retangulos.length === 0) return null;

  return (
    <div
      data-camada={meta.nome}
      data-papel={meta.papel}
      data-frame={String(props.frame)}
      data-retangulos={String(retangulos.length)}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: Z_INDEX_POR_PAPEL[meta.papel],
        pointerEvents: "none",
      }}
    >
      {retangulos.map((r) => (
        <div
          key={r.nome}
          data-retangulo={r.nome}
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: r.largura,
            height: r.altura,
            backgroundColor: r.cor,
            opacity: r.opacidade,
          }}
        />
      ))}
    </div>
  );
}
