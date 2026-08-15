/**
 * src/web/ui/src/componentes/GravadorVoz.tsx
 *
 * Gravacao de VOZ de um pedaco (MediaRecorder -> webm/opus -> PUT body
 * cru em narracao/audio — api.md). FQ-U3: este componente SO e renderizado
 * quando o pedaco tem fala (a regra e do pai, PedacoCard).
 *
 * Fluxo: gravar -> parar -> enviar (upload) -> ouvir (GET do wav
 * normalizado) -> substituir (gravar de novo) | remover (DELETE).
 *
 * Erros honestos (FQ-U4): permissao de microfone negada, upload 4xx/5xx
 * com a mensagem do envelope, audio que nao existe (404 narracao-nao-gravada).
 *
 * O blob vai com o mimeType REAL do MediaRecorder (audio/webm;codecs=opus
 * quando o navegador suporta) — o servidor converte para wav 48k estéreo
 * (FORMATO_AUDIO_GRAVADO) e devolve o hash; dedupe por conteudo (S-8).
 */

import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { NarracaoPedaco } from "../../../../roteiro/contrato/contrato.js";
import { ErroApi } from "../api.js";
import type { ClienteApi } from "../api.js";
import { formatarDuracao } from "../formatacao.js";

type Fase = "ocioso" | "gravando" | "enviando";

export interface PropsDoGravadorVoz {
  readonly cliente: ClienteApi;
  readonly projetoId: string;
  readonly pedacoId: string;
  /** A fala corrente do pedaco (vazia nunca chega aqui — FQ-U3). */
  readonly fala: string;
  readonly narracao: NarracaoPedaco;
  /** Refetch do projeto apos qualquer mutacao de narracao. */
  readonly aoMudar: () => Promise<void>;
}

export function GravadorVoz({ cliente, projetoId, pedacoId, narracao, aoMudar }: PropsDoGravadorVoz): ReactElement {
  const [fase, setFase] = useState<Fase>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [tempoGravando, setTempoGravando] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervaloRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Limpeza ao desmontar: para trilhas, intervalo e object URL — o
  // microfone NAO pode continuar aceso num componente morto.
  useEffect(() => {
    return () => {
      if (intervaloRef.current !== null) {
        window.clearInterval(intervaloRef.current);
      }
      streamRef.current?.getTracks().forEach((trilha) => trilha.stop());
      if (audioUrlRef.current !== null) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  function mimeDoGravador(): string {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      return "audio/webm;codecs=opus";
    }
    return "audio/webm";
  }

  async function enviar(blob: Blob): Promise<void> {
    setFase("enviando");
    setErro(null);
    try {
      await cliente.enviarGravacao(projetoId, pedacoId, blob, blob.type !== "" ? blob.type : mimeDoGravador());
      await aoMudar();
    } catch (e) {
      setErro(
        e instanceof ErroApi ? e.mensagem : "não foi possível enviar a gravação — tente de novo",
      );
    } finally {
      setFase("ocioso");
      setTempoGravando(0);
    }
  }

  function parar(): void {
    if (gravadorRef.current === null || gravadorRef.current.state !== "recording") {
      return;
    }
    gravadorRef.current.stop();
  }

  async function comecar(): Promise<void> {
    setErro(null);
    setAudioUrl(null);
    if (audioUrlRef.current !== null) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    // Contexto inseguro (http sem https) ou navegador sem suporte: a
    // tipagem DOM assume mediaDevices sempre presente — o cast documenta
    // que a ausencia e real e tratada (erro honesto, FQ-U4).
    const media = (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
    if (media === undefined) {
      setErro("este navegador não permite gravar áudio — use https ou outro navegador");
      return;
    }
    try {
      const stream = await media.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(stream, { mimeType: mimeDoGravador() });
      const partes: BlobPart[] = [];
      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) {
          partes.push(evento.data);
        }
      };
      gravador.onstop = () => {
        stream.getTracks().forEach((trilha) => trilha.stop());
        streamRef.current = null;
        void enviar(new Blob(partes, { type: gravador.mimeType }));
      };
      gravadorRef.current = gravador;
      streamRef.current = stream;
      gravador.start();
      setFase("gravando");
      setTempoGravando(0);
      intervaloRef.current = window.setInterval(() => {
        setTempoGravando((atual) => atual + 1);
      }, 1000);
    } catch {
      // getUserMedia negado ou sem dispositivo.
      setErro("não foi possível acessar o microfone — verifique a permissão do navegador");
    }
  }

  async function ouvir(): Promise<void> {
    setErro(null);
    try {
      const blob = await cliente.obterAudioNarracao(projetoId, pedacoId);
      if (audioUrlRef.current !== null) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagem : "não foi possível carregar o áudio");
    }
  }

  async function remover(): Promise<void> {
    setErro(null);
    if (audioUrlRef.current !== null) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
      setAudioUrl(null);
    }
    try {
      await cliente.removerNarracao(projetoId, pedacoId);
      await aoMudar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagem : "não foi possível remover a narração");
    }
  }

  const temAudio = narracao.origem !== "nenhuma";
  const gravando = fase === "gravando";

  return (
    <div className="gravador" data-testid={`gravador-${pedacoId}`}>
      <div className="gravador-controles">
        {gravando ? (
          <button
            type="button"
            className="botao botao-perigo"
            onClick={parar}
            data-testid={`botao-parar-gravar-${pedacoId}`}
          >
            Parar e enviar ({formatarDuracao(tempoGravando)})
          </button>
        ) : (
          <button
            type="button"
            className="botao botao-gravar"
            onClick={() => void comecar()}
            disabled={fase === "enviando"}
            data-testid={`botao-gravar-${pedacoId}`}
          >
            {temAudio ? "Regravar voz" : "Gravar voz"}
          </button>
        )}
        {fase === "enviando" && <span className="gravador-enviando">Enviando…</span>}
        {!gravando && fase !== "enviando" && temAudio && (
          <button
            type="button"
            className="botao botao-secundario"
            onClick={() => void ouvir()}
            data-testid={`botao-ouvir-${pedacoId}`}
          >
            Ouvir
          </button>
        )}
        {!gravando && fase !== "enviando" && temAudio && (
          <button
            type="button"
            className="botao botao-secundario"
            onClick={() => void remover()}
            data-testid={`botao-remover-narracao-${pedacoId}`}
          >
            Remover
          </button>
        )}
      </div>
      {audioUrl !== null && (
        <audio controls src={audioUrl} data-testid={`audio-narracao-${pedacoId}`} className="gravador-audio">
          Seu navegador não suporta áudio embutido.
        </audio>
      )}
      {erro !== null && (
        <p className="aviso aviso-erro" role="alert" data-testid={`erro-gravador-${pedacoId}`}>
          {erro}
        </p>
      )}
    </div>
  );
}
