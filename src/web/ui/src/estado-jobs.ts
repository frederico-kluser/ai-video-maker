/**
 * src/web/ui/src/estado-jobs.ts
 *
 * Derivacao pura do estado de JOBS para a UI. Nenhum DOM, nenhum relogio:
 * entrada (JobStatus | resumo do GET projeto) -> saida (JobDerivado).
 *
 * POR QUE esta camada existe: a UI nunca confia no verbo do servidor —
 * "ok" SO e sucesso com `artefato.caminho` presente (FQ-U2/FQ-S3: o
 * servidor grava artefato e estado na MESMA escrita atomica, e a UI
 * repete a conferencia: ok sem artefato = erro honesto, nunca quadro
 * preto — C1). Estado terminal com `erro` SEMPRE traz a saida real do
 * CLI (FQ-S3) — a UI exibe `job.erro`, nao uma mensagem generica.
 *
 * Tambem mora aqui a extracao dos ids de pedaco do 409 do juntar
 * (juntar-fala-sem-narracao lista os pedacos em `detalhes` — api.md) e a
 * pre-verificacao da regra record-first (a UI avisa antes do clique; o
 * gate real e o 409 do servidor).
 */

import type { Pedaco } from "../../../roteiro/contrato/contrato.js";
import type { ArtefatoDoJob, JobStatus } from "../../jobs.js";

/** Estado que a UI exibe — derivado, nunca o estado cru do servidor. */
export type EstadoUi = "nenhum" | "pendente" | "rodando" | "ok" | "erro";

/** A visao da UI sobre um job (ou ausencia dele). */
export interface JobDerivado {
  readonly estado: EstadoUi;
  readonly progresso: number | null;
  readonly mensagem: string;
  readonly artefato: ArtefatoDoJob | null;
  /**
   * true quando o servidor disse "ok" SEM artefato — o sucesso e
   * mentiroso (C1) e a UI tem de trata-lo como erro (FQ-U2).
   */
  readonly okSemArtefato: boolean;
}

/** Resumo derivado que o GET projeto entrega (api.md §GET projeto). */
export interface ResumoDeJob {
  readonly estado?: string;
  readonly progresso?: number | null;
}

/**
 * A menor forma de erro de API que a derivacao consome (FQ-U4): so a
 * `mensagem` do envelope importa aqui. O `ErroApi` de api.ts satisfaz
 * estruturalmente — estado-jobs nao precisa conhecer a camada de rede.
 */
export interface ErroDeApiNaDerivacao {
  readonly mensagem: string;
}

/**
 * Deriva a visao de UI de um job. `resumo` cobre o caso do GET projeto
 * (job efemero ja expirou mas o resumo sobrevive no envelope): o job
 * vivo vence o resumo; sem job, o resumo responde sozinho.
 *
 * `erroDeApi` e o erro do envelope (FQ-U4): 409/400 do POST ou o poll
 * que falhou (job expirou / tempo esgotado). Ele VENCE o derivado — a
 * ultima acao falhou, e a barra presa em "Em andamento…" para sempre e
 * exatamente o sintoma que este ramo elimina. A mensagem exibida e a
 * real do servidor, nunca generica.
 */
export function derivarJob(
  job: JobStatus | null,
  resumo?: ResumoDeJob | null,
  erroDeApi?: ErroDeApiNaDerivacao | null,
): JobDerivado {
  if (erroDeApi !== null && erroDeApi !== undefined) {
    return {
      estado: "erro",
      progresso: null,
      mensagem: erroDeApi.mensagem,
      artefato: null,
      okSemArtefato: false,
    };
  }
  if (job !== null) {
    if (job.estado === "ok") {
      if (job.artefato === null) {
        // ok sem artefato: o job nao tem o que entregar — erro honesto.
        return {
          estado: "erro",
          progresso: job.progresso,
          mensagem: "o job terminou sem artefato — refaca a operacao",
          artefato: null,
          okSemArtefato: true,
        };
      }
      return {
        estado: "ok",
        progresso: job.progresso,
        mensagem: job.mensagem,
        artefato: job.artefato,
        okSemArtefato: false,
      };
    }
    if (job.estado === "erro") {
      // FQ-S3: erro terminal SEMPRE traz a saida real do CLI.
      return {
        estado: "erro",
        progresso: job.progresso,
        mensagem: job.erro ?? job.mensagem,
        artefato: job.artefato,
        okSemArtefato: false,
      };
    }
    return {
      estado: job.estado,
      progresso: job.progresso,
      mensagem: job.mensagem,
      artefato: job.artefato,
      okSemArtefato: false,
    };
  }

  if (resumo === null || resumo === undefined || resumo.estado === undefined) {
    return { estado: "nenhum", progresso: null, mensagem: "", artefato: null, okSemArtefato: false };
  }
  const estado = resumo.estado === "pendente" || resumo.estado === "rodando" || resumo.estado === "ok" || resumo.estado === "erro" ? resumo.estado : "nenhum";
  const progresso = typeof resumo.progresso === "number" ? resumo.progresso : null;
  return { estado, progresso, mensagem: "", artefato: null, okSemArtefato: false };
}

/** true quando o resumo aponta um job ainda em andamento. */
export function resumoEmAndamento(resumo: ResumoDeJob | null | undefined): boolean {
  return resumo !== null && resumo !== undefined && (resumo.estado === "pendente" || resumo.estado === "rodando");
}

/**
 * Extrai os ids de pedaco do campo `detalhes` do 409 do juntar. O
 * servidor lista os pedacos como "pedacos[<indice>].id <p-XXX>: regra
 * ..." (validar.ts, verificarJuntarFalaSemNarracao) — o id tem formato
 * FECHADO (PADRAO_ID_PEDACO), entao a extracao e por forma, nunca por
 * texto solto.
 */
export function extrairIdsDePedacos(detalhes: readonly string[] | undefined): string[] {
  const ids: string[] = [];
  for (const linha of detalhes ?? []) {
    const casado = /\.id (p-[0-9]{3})\b/.exec(linha);
    if (casado !== null) {
      ids.push(casado[1]!);
    }
  }
  return ids;
}

/**
 * Pre-verificacao record-first (espelho da regra juntar-fala-sem-narracao
 * de src/roteiro/contrato/validar.ts): pedaco com fala e origem
 * "nenhuma" precisa de narracao antes do juntar. A UI usa para avisar
 * ANTES do clique; o gate real e o 409 do servidor (se os dois
 * divergirem, o 409 e a fonte — a lista dele e que destaca os cards).
 */
export function verificarFalaSemNarracao(pedacos: readonly Pedaco[]): string[] {
  return pedacos
    .filter((pedaco) => pedaco.fala !== "" && pedaco.narracao.origem === "nenhuma")
    .map((pedaco) => pedaco.id);
}
