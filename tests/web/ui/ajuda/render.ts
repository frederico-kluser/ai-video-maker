/**
 * tests/web/ui/ajuda/render.ts
 *
 * Renderizacao SEM DOM (react-test-renderer) para os componentes da SPA.
 * React 19 exige `IS_REACT_ACT_ENVIRONMENT` para o act() funcionar fora
 * de jsdom — este arquivo marca o ambiente e encapsula montar/atualizar/
 * desmontar em act(). Nao e coletado pelo vitest (fora do glob de teste).
 */

import { act } from "react";
import TestRenderer from "react-test-renderer";
import type { ReactElement } from "react";

/** Marca o ambiente como act-compativel (uma vez por arquivo de teste). */
export function habilitarAct(): void {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

export interface ArvoreMontada {
  readonly arvore: TestRenderer.ReactTestRenderer;
  atualizar(novo: ReactElement): void;
  desmontar(): void;
}

/** Monta um elemento com act() e devolve a arvore + atualizar/desmontar. */
export function montar(elemento: ReactElement): ArvoreMontada {
  habilitarAct();
  let arvore: TestRenderer.ReactTestRenderer;
  act(() => {
    arvore = TestRenderer.create(elemento);
  });
  return {
    arvore: arvore!,
    atualizar(novo: ReactElement) {
      act(() => {
        arvore!.update(novo);
      });
    },
    desmontar() {
      act(() => {
        arvore!.unmount();
      });
    },
  };
}

/** Encontra o primeiro no com o data-testid pedido (falha se nao houver). */
export function porTestId(arvore: TestRenderer.ReactTestRenderer, testId: string): TestRenderer.ReactTestInstance {
  const achados = arvore.root.findAllByProps({ "data-testid": testId });
  if (achados.length === 0) {
    throw new Error(`data-testid "${testId}" nao encontrado na arvore`);
  }
  return achados[0]!;
}

/** true quando existe pelo menos um no com o data-testid pedido. */
export function existeTestId(arvore: TestRenderer.ReactTestRenderer, testId: string): boolean {
  return arvore.root.findAllByProps({ "data-testid": testId }).length > 0;
}
