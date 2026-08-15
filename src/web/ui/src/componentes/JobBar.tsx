/**
 * src/web/ui/src/componentes/JobBar.tsx
 *
 * Barra de estado de UM job: pendente (enfileirado), rodando (progresso),
 * ok (concluido), erro (mensagem honesta + tentar de novo). FQ-U2/FQ-U4:
 * o erro vem do ErroApi/JobStatus — nunca se engole; "ok" so chega aqui
 * derivado com artefato (derivarJob confere ok-sem-artefato).
 */

import type { ReactElement } from "react";
import type { JobStatus } from "../../../jobs.js";
import { derivarJob } from "../estado-jobs.js";
import type { ErroDeApiNaDerivacao, ResumoDeJob } from "../estado-jobs.js";
import { formatarProgresso } from "../formatacao.js";

export interface PropsDaJobBar {
  /** O job vivo (poll) — pode ser null quando so existe o resumo. */
  readonly job: JobStatus | null;
  /** Resumo do GET projeto (job efemero ja expirado). */
  readonly resumo?: ResumoDeJob | null;
  /** Rotulo da operacao ("Gerando roteiro", "Juntando..."). */
  readonly rotulo: string;
  /**
   * Erro do envelope (FQ-U4): 409/400 do POST ou poll que falhou (job
   * expirou / tempo esgotado). VENCE o derivado — a ultima acao falhou
   * e a barra mostra o erro com re-tentativa, nunca "Em andamento…".
   */
  readonly erro?: ErroDeApiNaDerivacao | null;
  /** Reexecuta a operacao apos um erro. */
  readonly aoTentarDeNovo?: () => void;
  /** Seletor estavel para o e2e (Onda 7). */
  readonly testId?: string;
  /** Seletor estavel do botao "Tentar de novo" (Onda 7). */
  readonly testIdTentarDeNovo?: string;
}

export function JobBar({ job, resumo, rotulo, erro, aoTentarDeNovo, testId, testIdTentarDeNovo }: PropsDaJobBar): ReactElement | null {
  const derivado = derivarJob(job, resumo, erro);

  if (derivado.estado === "nenhum") {
    return null;
  }

  if (derivado.estado === "erro") {
    return (
      <div className="job-erro" role="alert" data-testid={testId}>
        <p className="job-erro-rotulo">{rotulo}</p>
        <p className="job-erro-mensagem">{derivado.mensagem}</p>
        {aoTentarDeNovo !== undefined && (
          <button
            type="button"
            className="botao botao-secundario"
            onClick={aoTentarDeNovo}
            data-testid={testIdTentarDeNovo}
          >
            Tentar de novo
          </button>
        )}
      </div>
    );
  }

  if (derivado.estado === "ok") {
    return (
      <div className="job-ok" data-testid={testId}>
        <span className="ponto-ok" aria-hidden="true" />
        {rotulo} concluído{derivado.mensagem !== "" ? ` — ${derivado.mensagem}` : ""}
      </div>
    );
  }

  const emAndamento = derivado.estado === "pendente" ? "Enfileirado…" : "Em andamento…";
  return (
    <div className="job-andamento" data-testid={testId} aria-live="polite">
      <div className="job-andamento-rotulo">
        <span>{rotulo}</span>
        <span className="job-andamento-pct">{formatarProgresso(derivado.progresso)}</span>
      </div>
      <div
        className="job-andamento-barra"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={derivado.progresso === null ? undefined : Math.round(derivado.progresso * 100)}
      >
        <div
          className="job-andamento-preenchimento"
          style={{ width: derivado.progresso === null ? undefined : `${Math.round(derivado.progresso * 100)}%` }}
        />
      </div>
      <p className="job-andamento-mensagem">
        {emAndamento}
        {derivado.mensagem !== "" ? ` ${derivado.mensagem}` : ""}
      </p>
    </div>
  );
}
