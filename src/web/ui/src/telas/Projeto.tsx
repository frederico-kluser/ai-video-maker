/**
 * src/web/ui/src/telas/Projeto.tsx
 *
 * Tela do projeto: gera o roteiro (job), lista os pedacos em cards
 * (cada um com regenerar/editar/gravar/preview — PedacoCard), e ao final
 * JUNTA e entrega o video final (job + player + download).
 *
 * Fluxo canonico (api.md): GET projeto (estado + jobs por alvo) ->
 * gerar/regenerar/preview/juntar como jobs -> poll -> refetch. Nenhum
 * sucesso sem resposta real (FQ-U2): o video final so aparece com o job
 * de juntar ok (e o <video> confere o proprio src via Range/onError).
 *
 * 409 do juntar (record-first): juntar-fala-sem-narracao lista os
 * pedacos em `detalhes` — a UI destaca os cards faltosos (FQ-U4 mostra a
 * mensagem do servidor, nunca uma generica). A pre-verificacao
 * verificarFalaSemNarracao avisa antes do clique, mas o gate REAL e o
 * 409 — os dois caminhos existem.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { CODIGOS_ERRO, ErroApi, criarClienteApi } from "../api.js";
import type { ClienteApi, RespostaProjeto } from "../api.js";
import { derivarJob, extrairIdsDePedacos, resumoEmAndamento, verificarFalaSemNarracao } from "../estado-jobs.js";
import { formatarDuracao } from "../formatacao.js";
import { montarHash } from "../roteamento.js";
import { usarJob } from "../usar-job.js";
import { PedacoCard } from "../componentes/PedacoCard.js";
import { JobBar } from "../componentes/JobBar.js";

export interface PropsDoProjeto {
  readonly id: string;
}

export function Projeto({ id }: PropsDoProjeto): ReactElement {
  const clienteRef = useRef<ClienteApi | null>(null);
  if (clienteRef.current === null) {
    clienteRef.current = criarClienteApi();
  }
  const cliente = clienteRef.current;

  const [projeto, setProjeto] = useState<RespostaProjeto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [destacar, setDestacar] = useState<readonly string[]>([]);
  const [videoFinalPronto, setVideoFinalPronto] = useState(false);
  const [videoFinalComErro, setVideoFinalComErro] = useState(false);
  const resumidosRef = useRef(new Set<string>());

  const carregar = useCallback(
    async (): Promise<void> => {
      setCarregando(true);
      try {
        const resposta = await cliente.obterProjeto(id);
        setProjeto(resposta);
        setErro(null);
      } catch (e) {
        setProjeto(null);
        setErro(e instanceof ErroApi ? e : new ErroApi(CODIGOS_ERRO.ERRO_INESPERADO, "não foi possível carregar o projeto", 0));
      } finally {
        setCarregando(false);
      }
    },
    [cliente, id],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const gerar = usarJob(cliente, {
    criar: async () => {
      const alvo = projeto?.projeto.brief.duracao_alvo_segundos;
      return cliente.gerarRoteiro(id, alvo === undefined ? {} : { duracao_alvo_segundos: alvo });
    },
    aoConcluir: carregar,
    aoErro: (e, contexto) => {
      // FQ-U4: o poll expirou (job efemero) — libera a guarda de resume
      // para que um refetch posterior (ou o re-tentar) possa re-pollar
      // o alvo sem ser bloqueado pelo job antigo.
      if ((e.codigo === CODIGOS_ERRO.JOB_EXPIROU || e.codigo === CODIGOS_ERRO.JOB_TEMPO_ESGOTADO) && contexto?.jobId !== undefined) {
        resumidosRef.current.delete(contexto.jobId);
      }
    },
  });

  const juntar = usarJob(cliente, {
    criar: async () => cliente.pedirJuntar(id),
    aoConcluir: async (job) => {
      if (job.estado === "ok") {
        setVideoFinalPronto(true);
        setVideoFinalComErro(false);
      }
      await carregar();
    },
    aoErro: (e, contexto) => {
      // 409 nomeado do juntar: a lista de pedacos vem no detalhes — a UI
      // destaca os cards para o usuario agir (FQ-U4).
      if (e.codigo === CODIGOS_ERRO.JUNTAR_FALA_SEM_NARRACAO || e.codigo === CODIGOS_ERRO.JUNTAR_PREVIEW_AUSENTE) {
        setDestacar(extrairIdsDePedacos(e.detalhes));
      }
      // O poll expirou (job efemero): libera a guarda de resume para
      // que o refetch posterior possa re-pollar o alvo.
      if ((e.codigo === CODIGOS_ERRO.JOB_EXPIROU || e.codigo === CODIGOS_ERRO.JOB_TEMPO_ESGOTADO) && contexto?.jobId !== undefined) {
        resumidosRef.current.delete(contexto.jobId);
      }
    },
  });

  // Retoma polls de jobs nao-terminais que o GET projeto derivou (a
  // pagina recarregou no meio de um gerar/juntar). Guarda de id evita
  // dois polls sobre o mesmo job.
  useEffect(() => {
    if (projeto === null) {
      return;
    }
    const resumeGerar = projeto.jobs.gerar_roteiro;
    if (resumeGerar !== null && resumoEmAndamento(resumeGerar) && !resumidosRef.current.has(resumeGerar.job_id)) {
      resumidosRef.current.add(resumeGerar.job_id);
      void gerar.retomar(resumeGerar.job_id);
    }
    const resumeJuntar = projeto.jobs.juntar;
    if (resumeJuntar !== null && resumoEmAndamento(resumeJuntar) && !resumidosRef.current.has(resumeJuntar.job_id)) {
      resumidosRef.current.add(resumeJuntar.job_id);
      void juntar.retomar(resumeJuntar.job_id);
    }
  }, [projeto, gerar, juntar]);

  async function excluir(): Promise<void> {
    try {
      await cliente.apagarProjeto(id);
      window.location.hash = montarHash({ nome: "novo-projeto" });
    } catch (e) {
      setErro(e instanceof ErroApi ? e : new ErroApi(CODIGOS_ERRO.ERRO_INESPERADO, "não foi possível excluir o projeto", 0));
    }
  }

  if (erro !== null && projeto === null) {
    return (
      <main className="app-container" data-testid="tela-projeto">
        <div className="painel aviso aviso-erro" role="alert" data-testid="erro-global">
          <h2>Não foi possível abrir o projeto</h2>
          <p>{erro.mensagem}</p>
          <div className="linha-acoes">
            <button
              type="button"
              className="botao botao-primario"
              onClick={() => void carregar()}
              data-testid="botao-tentar-novamente-erro"
            >
              Tentar de novo
            </button>
            <a
              className="botao botao-secundario"
              href={montarHash({ nome: "novo-projeto" })}
              data-testid="link-voltar-inicio"
            >
              Voltar ao início
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (carregando && projeto === null) {
    return (
      <main className="app-container" data-testid="tela-projeto">
        <p className="carregando">Carregando projeto…</p>
      </main>
    );
  }

  if (projeto === null) {
    return <main className="app-container" data-testid="tela-projeto" />;
  }

  const roteiro = projeto.projeto.roteiro;
  const pedacos = roteiro?.pedacos ?? [];
  const semNarracao = roteiro === undefined ? [] : verificarFalaSemNarracao(pedacos);
  const semPreview = roteiro === undefined ? [] : pedacos.filter((p) => (projeto.jobs.previews[p.id]?.estado ?? null) !== "ok");
  const juntarDerivado = derivarJob(juntar.job, projeto.jobs.juntar);
  const versaoFinal = juntar.job?.atualizado_em ?? projeto.jobs.juntar?.job_id ?? undefined;
  const mostrarVideoFinal = videoFinalPronto || juntarDerivado.estado === "ok";

  return (
    <main className="app-container" data-testid="tela-projeto">
      <header className="app-cabecalho projeto-cabecalho">
        <div>
          <h1>{projeto.projeto.brief.tema}</h1>
          <p className="app-subtitulo">
            {projeto.projeto.brief.contexto !== undefined && projeto.projeto.brief.contexto !== ""
              ? `${projeto.projeto.brief.contexto} — `
              : ""}
            {projeto.projeto.brief.duracao_alvo_segundos !== undefined
              ? `duração alvo ${formatarDuracao(projeto.projeto.brief.duracao_alvo_segundos)}`
              : ""}{" "}
            · <span className="mono">{projeto.projeto.id}</span>
          </p>
        </div>
        <div className="linha-acoes">
          <button type="button" className="botao botao-secundario" onClick={() => void carregar()} disabled={carregando} data-testid="botao-atualizar">
            Atualizar
          </button>
          <button type="button" className="botao botao-perigo" onClick={() => void excluir()} data-testid="botao-excluir">
            Excluir projeto
          </button>
        </div>
      </header>

      {erro !== null && (
        <p className="aviso aviso-erro" role="alert" data-testid="erro-global">
          {erro.mensagem}
        </p>
      )}

      <JobBar
        job={gerar.job}
        resumo={projeto.jobs.gerar_roteiro}
        rotulo="Gerando roteiro"
        erro={gerar.erro}
        aoTentarDeNovo={() => void gerar.comecar()}
        testId="barra-gerar-roteiro"
        testIdTentarDeNovo="botao-tentar-novamente-gerar-roteiro"
      />

      {roteiro === undefined ? (
        <section className="painel painel-cta" data-testid="painel-gerar-roteiro">
          <h2>Roteiro ainda não gerado</h2>
          <p>
            O roteiro divide o vídeo em pedaços — cada um com a fala, o visual e os detalhes de
            produção. Depois de gerado, você edita, grava a voz e gera o preview de cada pedaço.
          </p>
          <button
            type="button"
            className="botao botao-primario botao-grande"
            onClick={() => void gerar.comecar()}
            disabled={gerar.ocupado}
            data-testid="botao-gerar-roteiro"
          >
            Gerar roteiro
          </button>
        </section>
      ) : (
        <section data-testid="lista-pedacos">
          <h2 className="secao-titulo">Roteiro · {pedacos.length} pedaços</h2>
          <div className="lista-pedacos">
            {pedacos.map((pedaco) => (
              <PedacoCard
                key={pedaco.id}
                cliente={cliente}
                projetoId={id}
                pedaco={pedaco}
                temEdicao={projeto.projeto.pedacos_editados[pedaco.id] !== undefined}
                resumoPreview={projeto.jobs.previews[pedaco.id] ?? null}
                destacado={destacar.includes(pedaco.id)}
                aoMudar={carregar}
              />
            ))}
          </div>
        </section>
      )}

      <section className="painel painel-juntar" data-testid="painel-juntar">
        <h2 className="secao-titulo">Juntar e entregar</h2>
        {semNarracao.length > 0 && (
          <p className="aviso aviso-aviso" data-testid="aviso-fala-sem-narracao">
            {semNarracao.length} pedaço{semNarracao.length > 1 ? "s" : ""} com fala ainda sem narração —
            grave a voz antes de juntar (nunca entregamos fala muda).
          </p>
        )}
        {semPreview.length > 0 && semPreview.length < pedacos.length && (
          <p className="aviso aviso-aviso" data-testid="aviso-preview-ausente">
            {semPreview.length} pedaço{semPreview.length > 1 ? "s" : ""} sem preview renderizado — gere os
            previews antes de juntar.
          </p>
        )}
        <p className="campo-ajuda">
          O juntar concatena os previews, normaliza o volume (EBU R128) e gera o vídeo final.
        </p>
        <div className="linha-acoes">
          <button
            type="button"
            className="botao botao-primario botao-grande"
            onClick={() => void juntar.comecar()}
            disabled={roteiro === undefined || juntar.ocupado || gerar.ocupado}
            data-testid="botao-juntar"
          >
            {juntar.ocupado ? "Juntando…" : "Juntar e entregar"}
          </button>
        </div>

        <JobBar
          job={juntar.job}
          resumo={projeto.jobs.juntar}
          rotulo="Juntando o vídeo"
          erro={juntar.erro}
          aoTentarDeNovo={() => void juntar.comecar()}
          testId="barra-juntar"
          testIdTentarDeNovo="botao-tentar-novamente-juntar"
        />

        {mostrarVideoFinal && !videoFinalComErro && (
          <div className="video-final" data-testid="video-final">
            <video
              controls
              preload="metadata"
              src={cliente.urlDeVideoFinal(id, versaoFinal)}
              onError={() => setVideoFinalComErro(true)}
            >
              Seu navegador não suporta vídeo embutido.
            </video>
            <a
              className="botao botao-primario"
              href={cliente.urlDeVideoFinal(id, versaoFinal)}
              download="video-final.mp4"
              data-testid="botao-baixar-video"
            >
              Baixar vídeo final
            </a>
          </div>
        )}
        {videoFinalComErro && (
          <p className="aviso aviso-aviso" data-testid="erro-video-final">
            O vídeo final ainda não está pronto — junte e entregue acima.
          </p>
        )}
      </section>
    </main>
  );
}
