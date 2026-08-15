/**
 * src/web/ui/src/usar-job.ts
 *
 * Hook que orquestra o ciclo de vida de UM job na UI: criar (POST 202) ->
 * poll com progresso -> concluir (refetch) ou erro honesto.
 *
 * POR QUE um hook: o ciclo e identico para gerar roteiro, regenerar
 * pedaco, preview e juntar — a UI precisa do job vivo (progresso), do
 * erro tratado e do cancelamento ao desmontar (o poll aborta sem setState
 * em componente morto). FQ-U2: nunca sucesso sem resposta real — o
 * sucesso so chega ao caller via `aoConcluir` com um JobStatus terminal.
 *
 * FQ-U4: o erro da API (404, 409, 400 nomeado) chega como ErroApi ao
 * estado `erro` (e a `aoErro`, quando o caller precisa de efeito
 * lateral, ex.: destacar os cards do 409 juntar-fala-sem-narracao).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CODIGOS_ERRO, ErroApi, pollarJob } from "./api.js";
import type { ClienteApi, JobAceito } from "./api.js";
import type { JobStatus } from "../../jobs.js";

export interface OpcoesDeUsarJob {
  /** Cria o job (POST que devolve 202 + job_id). */
  criar: () => Promise<JobAceito>;
  /** Chamado com o job TERMINAL (ok ou erro) — tipicamente refetch. */
  aoConcluir: (job: JobStatus) => void | Promise<void>;
  /**
   * Efeito lateral de erro (ex.: destacar cards do 409). O segundo
   * argumento traz o jobId quando o erro veio do POLL (job expirou /
   * tempo esgotado) — o caller pode liberar a guarda de resume para
   * permitir re-poll do mesmo alvo (FQ-U4).
   */
  aoErro?: (erro: ErroApi, contexto?: { readonly jobId?: string }) => void;
}

export interface EstadoDeUsarJob {
  /** O job vivo (atualizado a cada poll) — null antes do primeiro poll. */
  readonly job: JobStatus | null;
  /** O ultimo erro de API (ou null). Exibido honestamente (FQ-U4). */
  readonly erro: ErroApi | null;
  /** true enquanto um job existe e nao terminou. */
  readonly ocupado: boolean;
  /** Cria o job e poe o poll para rodar. */
  comecar: () => Promise<void>;
  /** Retoma o poll de um job que ja existe (estado do GET projeto). */
  retomar: (jobId: string) => Promise<void>;
  /** Limpa o erro exibido (ex.: o usuario fechou o aviso). */
  limparErro: () => void;
}

export function usarJob(cliente: ClienteApi, opcoes: OpcoesDeUsarJob): EstadoDeUsarJob {
  const [job, setJob] = useState<JobStatus | null>(null);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sinalRef = useRef({ abortado: false });
  const montadoRef = useRef(true);
  const opcoesRef = useRef(opcoes);
  opcoesRef.current = opcoes;

  useEffect(() => {
    return () => {
      montadoRef.current = false;
      sinalRef.current.abortado = true;
    };
  }, []);

  const rodarPoll = useCallback(
    async (jobId: string): Promise<void> => {
      setOcupado(true);
      setErro(null);
      try {
        const final = await pollarJob(
          (id) => cliente.obterJob(id),
          jobId,
          {
            aoStatus: (status) => {
              if (montadoRef.current) {
                setJob(status);
              }
            },
            sinalAbortar: sinalRef.current,
          },
        );
        if (!montadoRef.current) {
          return;
        }
        setJob(final);
        await opcoesRef.current.aoConcluir(final);
      } catch (e) {
        if (!montadoRef.current) {
          return;
        }
        if (e instanceof ErroApi && e.codigo === CODIGOS_ERRO.ABORTADO) {
          return;
        }
        const erroFinal = e instanceof ErroApi ? e : new ErroApi(CODIGOS_ERRO.ERRO_INESPERADO, String(e), 0);
        setErro(erroFinal);
        opcoesRef.current.aoErro?.(erroFinal, { jobId });
      } finally {
        if (montadoRef.current) {
          setOcupado(false);
        }
      }
    },
    [cliente],
  );

  const comecar = useCallback(
    async (): Promise<void> => {
      setErro(null);
      try {
        const aceito = await opcoesRef.current.criar();
        await rodarPoll(aceito.jobId);
      } catch (e) {
        if (!montadoRef.current) {
          return;
        }
        const erroFinal = e instanceof ErroApi ? e : new ErroApi(CODIGOS_ERRO.ERRO_INESPERADO, String(e), 0);
        setErro(erroFinal);
        opcoesRef.current.aoErro?.(erroFinal);
      }
    },
    [rodarPoll],
  );

  const retomar = useCallback(
    async (jobId: string): Promise<void> => {
      await rodarPoll(jobId);
    },
    [rodarPoll],
  );

  const limparErro = useCallback((): void => {
    setErro(null);
  }, []);

  return { job, erro, ocupado, comecar, retomar, limparErro };
}
