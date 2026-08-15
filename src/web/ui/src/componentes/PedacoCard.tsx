/**
 * src/web/ui/src/componentes/PedacoCard.tsx
 *
 * Card de UM pedaco do roteiro: titulo, fala, duracao, badge de
 * tipo_visual, especificacao_visual, detalhes_de_producao, status de
 * narracao — e as acoes: Regenerar ("apos edicao" quando ha edicao
 * salva), Editar (modal), GRAVACAO DE VOZ (so quando tem fala — FQ-U3),
 * e PREVIEW (job + video com Range nativo do <video>).
 *
 * Jobs por pedaco: regenerar e preview vivem aqui (usarJob) com
 * progresso e erro honestos (FQ-U2/FQ-U4). O sucesso do preview so vira
 * video com resposta real (job ok com artefato — derivarJob confere).
 *
 * Estados de narracao (contrato): origem tts/gravacao/nenhuma + status
 * vazio/gerado/editado — o badge "voz desatualizada" sinaliza fala
 * editada depois da gravacao (audio stale — regra editado-dessincronizado).
 */

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { Pedaco, TipoVisualPedaco } from "../../../../roteiro/contrato/contrato.js";
import { CODIGOS_ERRO } from "../api.js";
import type { ClienteApi, StatusJobResumido } from "../api.js";
import { derivarJob, resumoEmAndamento } from "../estado-jobs.js";
import { formatarDuracao } from "../formatacao.js";
import { usarJob } from "../usar-job.js";
import { GravadorVoz } from "./GravadorVoz.js";
import { JobBar } from "./JobBar.js";
import { ModalEdicao } from "./ModalEdicao.js";

const ROTULO_TIPO_VISUAL: Readonly<Record<TipoVisualPedaco, string>> = {
  manim: "Manim",
  grafico: "Gráfico",
  gif: "GIF",
  video: "Vídeo",
  texto: "Texto",
  lista: "Lista",
  cabecalho: "Cabeçalho",
};

export interface PropsDoPedacoCard {
  readonly cliente: ClienteApi;
  readonly projetoId: string;
  readonly pedaco: Pedaco;
  /** true quando pedacos_editados[id] existe (ha edicao salva). */
  readonly temEdicao: boolean;
  /** Resumo do job de preview deste pedaco (GET projeto). */
  readonly resumoPreview: StatusJobResumido | null;
  /** Card destacado apos um 409 do juntar (falta narracao/preview). */
  readonly destacado: boolean;
  /** Refetch do projeto apos qualquer mutacao. */
  readonly aoMudar: () => Promise<void>;
}

export function PedacoCard({ cliente, projetoId, pedaco, temEdicao, resumoPreview, destacado, aoMudar }: PropsDoPedacoCard): ReactElement {
  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [previewVisivel, setPreviewVisivel] = useState(false);
  const [previewComErro, setPreviewComErro] = useState(false);
  const resumidosRef = useRef(new Set<string>());

  const regenerar = usarJob(cliente, {
    criar: async () => cliente.regenerarPedaco(projetoId, pedaco.id),
    aoConcluir: aoMudar,
  });

  const preview = usarJob(cliente, {
    criar: async () => cliente.pedirPreview(projetoId, pedaco.id),
    aoConcluir: async (job) => {
      if (job.estado === "ok") {
        setPreviewVisivel(true);
        setPreviewComErro(false);
      }
      await aoMudar();
    },
    aoErro: (e, contexto) => {
      // O poll expirou (job efemero): libera a guarda de resume para
      // que o refetch posterior possa re-pollar o preview sem ser
      // bloqueado pelo job antigo (FQ-U4).
      if ((e.codigo === CODIGOS_ERRO.JOB_EXPIROU || e.codigo === CODIGOS_ERRO.JOB_TEMPO_ESGOTADO) && contexto?.jobId !== undefined) {
        resumidosRef.current.delete(contexto.jobId);
      }
    },
  });

  // Retoma o poll de um preview em andamento (estado derivado do GET
  // projeto, ex.: apos recarregar a pagina no meio do render). O guarda
  // impede dois polls sobre o mesmo job.
  useEffect(() => {
    if (resumoPreview !== null && resumoEmAndamento(resumoPreview) && !resumidosRef.current.has(resumoPreview.job_id)) {
      resumidosRef.current.add(resumoPreview.job_id);
      void preview.retomar(resumoPreview.job_id);
    }
  }, [resumoPreview, preview]);

  const previewDerivado = derivarJob(preview.job, resumoPreview);
  const temFala = pedaco.fala !== "";
  const narracaoOk =
    pedaco.narracao.origem !== "nenhuma" && pedaco.narracao.status !== "editado" && pedaco.narracao.status !== "vazio";
  const narracaoEditada = pedaco.narracao.status === "editado";

  const versaoPreview = preview.job?.atualizado_em ?? resumoPreview?.job_id ?? undefined;
  // Video visivel so com resposta real: preview concluido nesta sessao
  // (previewVisivel) ou resumo "ok" do GET projeto; se o <video> falhar
  // (404/409), o onError esconde e avisa — nunca sucesso mentiroso.
  const mostrarVideo = previewVisivel || previewDerivado.estado === "ok";

  return (
    <article
      className={destacado ? "pedaco-card pedaco-destacado" : "pedaco-card"}
      data-testid={`pedaco-${pedaco.id}`}
    >
      <header className="pedaco-cabecalho">
        <span className="pedaco-indice">{pedaco.indice + 1}</span>
        <h3 className="pedaco-titulo">{pedaco.titulo}</h3>
        <span className="badge">{ROTULO_TIPO_VISUAL[pedaco.tipo_visual]}</span>
        <span className="pedaco-duracao">{formatarDuracao(pedaco.duracao_segundos)}</span>
        {narracaoOk && <span className="badge badge-ok">voz gravada</span>}
        {narracaoEditada && <span className="badge badge-aviso">voz desatualizada</span>}
        {temEdicao && <span className="badge badge-aviso">editado</span>}
        {destacado && <span className="badge badge-perigo">falta ação</span>}
      </header>

      {pedaco.fala !== "" && (
        <p className="pedaco-fala" data-testid={`fala-${pedaco.id}`}>
          {pedaco.fala}
        </p>
      )}

      <dl className="pedaco-detalhes">
        <div className="pedaco-detalhe">
          <dt>Visual</dt>
          <dd>{pedaco.especificacao_visual}</dd>
        </div>
        <div className="pedaco-detalhe">
          <dt>Como será feito</dt>
          <dd>{pedaco.detalhes_de_producao}</dd>
        </div>
      </dl>

      <div className="pedaco-acoes">
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() => void regenerar.comecar()}
          disabled={regenerar.ocupado}
          data-testid={`botao-regenerar-${pedaco.id}`}
          title={temEdicao ? "Regenera usando a edição salva como ponto de partida" : "Regenera este pedaço mantendo os irmãos intactos"}
        >
          {temEdicao ? "Regenerar após edição" : "Regenerar"}
        </button>
        <button
          type="button"
          className="botao botao-secundario"
          onClick={() => setEdicaoAberta(true)}
          data-testid={`botao-editar-${pedaco.id}`}
        >
          Editar
        </button>
        <button
          type="button"
          className="botao botao-primario"
          onClick={() => void preview.comecar()}
          disabled={preview.ocupado}
          data-testid={`botao-gerar-preview-${pedaco.id}`}
        >
          Gerar preview
        </button>
      </div>

      <JobBar
        job={regenerar.job}
        rotulo={`Regenerando ${pedaco.id}`}
        erro={regenerar.erro}
        aoTentarDeNovo={() => void regenerar.comecar()}
        testId={`barra-regenerar-${pedaco.id}`}
        testIdTentarDeNovo={`botao-tentar-novamente-regenerar-${pedaco.id}`}
      />

      {/* FQ-U3: gravacao de voz SO quando o pedaco tem fala. */}
      {temFala && (
        <GravadorVoz
          cliente={cliente}
          projetoId={projetoId}
          pedacoId={pedaco.id}
          fala={pedaco.fala}
          narracao={pedaco.narracao}
          aoMudar={aoMudar}
        />
      )}

      <JobBar
        job={preview.job}
        resumo={resumoPreview}
        rotulo={`Renderizando preview de ${pedaco.id}`}
        erro={preview.erro}
        aoTentarDeNovo={() => void preview.comecar()}
        testId={`barra-preview-${pedaco.id}`}
        testIdTentarDeNovo={`botao-tentar-novamente-preview-${pedaco.id}`}
      />

      {mostrarVideo && !previewComErro && (
        <video
          className="pedaco-preview"
          controls
          preload="metadata"
          src={cliente.urlDePreview(projetoId, pedaco.id, versaoPreview)}
          onError={() => setPreviewComErro(true)}
          data-testid={`video-preview-${pedaco.id}`}
        >
          Seu navegador não suporta vídeo embutido.
        </video>
      )}
      {previewComErro && (
        <p className="aviso aviso-aviso" data-testid={`erro-video-${pedaco.id}`}>
          O preview ainda não está pronto — gere o preview acima.
        </p>
      )}

      <ModalEdicao
        cliente={cliente}
        projetoId={projetoId}
        pedaco={pedaco}
        aberto={edicaoAberta}
        aoFechar={() => setEdicaoAberta(false)}
        aoMudar={aoMudar}
      />
    </article>
  );
}
