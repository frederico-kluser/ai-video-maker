/**
 * src/web/ui/src/componentes/ModalEdicao.tsx
 *
 * Edicao de UM pedaco (PATCH /pedacos/:id — o delta e EdicaoPedaco do
 * contrato: titulo, fala, duracao_segundos, tipo_visual,
 * especificacao_visual, detalhes_de_producao. id/indice/narracao/anexo
 * NUNCA vem daqui — regra edicao-anexo-proibido).
 *
 * Regras do contrato aplicadas no fluxo:
 *  - editar `fala` de pedaco ja narrado vira `editado` (audio stale) —
 *    o servidor aplica; a UI re-renderiza a partir do GET (aoMudar);
 *  - apagar a fala limpa a narracao inteira (regra do servidor);
 *  - tipo_visual gif/video EXIGE anexo primeiro (upload primeiro, tipo
 *    depois — anexo-exigido-para-gif-video): o bloco de anexo fica no
 *    modal e a UI avisa quando falta o anexo antes de salvar gif/video;
 *  - o erro do servidor (400 com regra nomeada) e exibido honestamente
 *    (FQ-U4), nunca engolido.
 *
 * Anexo (PUT/GET/DELETE anexo — api.md): upload com body cru + ?nome=
 * urlencoded, allowlist de tipo e teto de 200 MB importados do contrato
 * (fonte unica — nunca redigitados).
 */

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import {
  ANEXO_TAMANHO_MAXIMO_BYTES,
  VOCABULARIO_TIPO_ANEXO,
  VOCABULARIO_TIPO_VISUAL,
} from "../../../../roteiro/contrato/contrato.js";
import type { EdicaoPedaco, Pedaco, TipoVisualPedaco } from "../../../../roteiro/contrato/contrato.js";
import { ErroApi } from "../api.js";
import type { ClienteApi } from "../api.js";
import { formatarBytes } from "../formatacao.js";

const ROTULO_TIPO_VISUAL: Readonly<Record<TipoVisualPedaco, string>> = {
  manim: "Animação (Manim)",
  grafico: "Gráfico",
  gif: "GIF anexado",
  video: "Vídeo anexado",
  texto: "Texto",
  lista: "Lista",
  cabecalho: "Cabeçalho",
};

export interface PropsDoModalEdicao {
  readonly cliente: ClienteApi;
  readonly projetoId: string;
  readonly pedaco: Pedaco;
  readonly aberto: boolean;
  readonly aoFechar: () => void;
  /** Refetch do projeto apos salvar/upload/remocao. */
  readonly aoMudar: () => Promise<void>;
}

export function ModalEdicao({ cliente, projetoId, pedaco, aberto, aoFechar, aoMudar }: PropsDoModalEdicao): ReactElement | null {
  const [titulo, setTitulo] = useState(pedaco.titulo);
  const [fala, setFala] = useState(pedaco.fala);
  const [duracao, setDuracao] = useState(String(pedaco.duracao_segundos));
  const [tipoVisual, setTipoVisual] = useState<TipoVisualPedaco>(pedaco.tipo_visual);
  const [especificacao, setEspecificacao] = useState(pedaco.especificacao_visual);
  const [detalhes, setDetalhes] = useState(pedaco.detalhes_de_producao);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anexoErro, setAnexoErro] = useState<string | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const inputAnexoRef = useRef<HTMLInputElement | null>(null);

  // Reinicia os campos a cada abertura/pedaco (o modal reutiliza o mesmo
  // componente entre cards; o estado nao pode vazar de um pedaco pro outro).
  useEffect(() => {
    if (aberto) {
      setTitulo(pedaco.titulo);
      setFala(pedaco.fala);
      setDuracao(String(pedaco.duracao_segundos));
      setTipoVisual(pedaco.tipo_visual);
      setEspecificacao(pedaco.especificacao_visual);
      setDetalhes(pedaco.detalhes_de_producao);
      setErro(null);
      setAnexoErro(null);
    }
  }, [aberto, pedaco]);

  if (!aberto) {
    return null;
  }

  const tipoExigeAnexo = tipoVisual === "gif" || tipoVisual === "video";
  const temAnexo = pedaco.anexo_hash !== undefined && pedaco.anexo_meta !== undefined;

  function construirDelta(): EdicaoPedaco {
    // Delta SEMPRE com os seis campos editaveis: o servidor valida o
    // shape completo (validarEdicaoPedaco) e aplica as regras de narracao
    // quando a fala muda — mandar so o que mudou esconderia do usuario o
    // que o servidor rejeitou.
    const duracaoNumero = Number(duracao.replace(",", "."));
    // Delta construido de uma vez: EdicaoPedaco e readonly — o campo de
    // duracao so entra quando o valor e um numero positivo valido.
    return {
      titulo,
      fala,
      tipo_visual: tipoVisual,
      especificacao_visual: especificacao,
      detalhes_de_producao: detalhes,
      ...(Number.isFinite(duracaoNumero) && duracaoNumero > 0 ? { duracao_segundos: duracaoNumero } : {}),
    } satisfies EdicaoPedaco;
  }

  async function salvar(): Promise<void> {
    setErro(null);
    if (tipoExigeAnexo && !temAnexo) {
      setErro("envie o anexo (GIF ou vídeo) antes de salvar o tipo de visual — o upload vem primeiro");
      return;
    }
    setSalvando(true);
    try {
      await cliente.editarPedaco(projetoId, pedaco.id, construirDelta());
      await aoMudar();
      aoFechar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagem : "não foi possível salvar a edição");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarAnexo(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    setAnexoErro(null);
    const arquivo = evento.target.files?.[0];
    // Limpa o input para permitir re-selecionar o mesmo arquivo.
    evento.target.value = "";
    if (arquivo === undefined) {
      return;
    }
    if (arquivo.size > ANEXO_TAMANHO_MAXIMO_BYTES) {
      setAnexoErro(`arquivo acima do limite (${formatarBytes(ANEXO_TAMANHO_MAXIMO_BYTES)})`);
      return;
    }
    const tipo = arquivo.type;
    if (!VOCABULARIO_TIPO_ANEXO.includes(tipo as (typeof VOCABULARIO_TIPO_ANEXO)[number])) {
      setAnexoErro("tipo de arquivo fora da lista permitida (GIF, MP4 ou WebM)");
      return;
    }
    setEnviandoAnexo(true);
    try {
      await cliente.enviarAnexo(projetoId, pedaco.id, arquivo, tipo, arquivo.name);
      await aoMudar();
    } catch (e) {
      setAnexoErro(e instanceof ErroApi ? e.mensagem : "não foi possível enviar o anexo");
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function removerAnexo(): Promise<void> {
    setAnexoErro(null);
    try {
      await cliente.removerAnexo(projetoId, pedaco.id);
      await aoMudar();
    } catch (e) {
      setAnexoErro(e instanceof ErroApi ? e.mensagem : "não foi possível remover o anexo");
    }
  }

  return (
    <div className="modal-fundo" role="presentation" onMouseDown={aoFechar}>
      <div
        className="modal-painel"
        role="dialog"
        aria-modal="true"
        aria-label={`Editar pedaço ${pedaco.id}`}
        data-testid="modal-edicao"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-cabecalho">
          <h2>Editar pedaço {pedaco.id}</h2>
          <button type="button" className="botao botao-secundario" onClick={aoFechar} data-testid="botao-fechar-edicao">
            Fechar
          </button>
        </header>

        <div className="modal-campos">
          <label className="campo">
            <span className="campo-rotulo">Título</span>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              data-testid="campo-titulo"
            />
          </label>

          <label className="campo">
            <span className="campo-rotulo">Fala (texto narrado)</span>
            <textarea
              value={fala}
              onChange={(e) => setFala(e.target.value)}
              rows={3}
              data-testid="campo-fala"
            />
            <span className="campo-ajuda">
              Apagar a fala limpa a narração; mudar a fala de um pedaço já narrado deixa o áudio
              antigo desatualizado até regravar ou regenerar.
            </span>
          </label>

          <div className="modal-linha">
            <label className="campo">
              <span className="campo-rotulo">Duração (segundos)</span>
              <input
                type="number"
                min={1}
                step="0.5"
                value={duracao}
                onChange={(e) => setDuracao(e.target.value)}
                data-testid="campo-duracao"
              />
            </label>

            <label className="campo">
              <span className="campo-rotulo">Tipo de visual</span>
              <select
                value={tipoVisual}
                onChange={(e) => setTipoVisual(e.target.value as TipoVisualPedaco)}
                data-testid="campo-tipo-visual"
              >
                {VOCABULARIO_TIPO_VISUAL.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ROTULO_TIPO_VISUAL[tipo]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {tipoExigeAnexo && (
            <div className="bloco-anexo" data-testid="bloco-anexo">
              <span className="campo-rotulo">Anexo (GIF ou vídeo — upload primeiro, tipo depois)</span>
              {temAnexo ? (
                <p className="anexo-atual">
                  Anexado: <strong>{pedaco.anexo_meta?.nome_original}</strong> (
                  {formatarBytes(pedaco.anexo_meta?.tamanho_bytes ?? 0)}) —{" "}
                  <button
                    type="button"
                    className="botao-link"
                    onClick={() => void removerAnexo()}
                    data-testid="botao-remover-anexo"
                  >
                    remover
                  </button>
                </p>
              ) : (
                <p className="aviso aviso-aviso">Nenhum anexo ainda — envie o arquivo abaixo antes de salvar.</p>
              )}
              <input
                ref={inputAnexoRef}
                type="file"
                accept=".gif,image/gif,video/mp4,video/webm"
                onChange={(e) => void enviarAnexo(e)}
                disabled={enviandoAnexo}
                data-testid="campo-anexo"
              />
              {anexoErro !== null && (
                <p className="aviso aviso-erro" role="alert" data-testid="erro-anexo">
                  {anexoErro}
                </p>
              )}
            </div>
          )}

          <label className="campo">
            <span className="campo-rotulo">Especificação do visual</span>
            <textarea
              value={especificacao}
              onChange={(e) => setEspecificacao(e.target.value)}
              rows={2}
              data-testid="campo-especificacao"
            />
          </label>

          <label className="campo">
            <span className="campo-rotulo">Detalhes de produção (como será feito)</span>
            <textarea
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              rows={2}
              data-testid="campo-detalhes"
            />
          </label>
        </div>

        {erro !== null && (
          <p className="aviso aviso-erro" role="alert" data-testid="erro-edicao">
            {erro}
          </p>
        )}

        <footer className="modal-rodape">
          <button
            type="button"
            className="botao botao-primario"
            onClick={() => void salvar()}
            disabled={salvando}
            data-testid="botao-salvar-edicao"
          >
            {salvando ? "Salvando…" : "Salvar edição"}
          </button>
          <span className="campo-ajuda">
            Depois de salvar, use "Regenerar após edição" no card para a edição entrar na geração.
          </span>
        </footer>
      </div>
    </div>
  );
}
