/**
 * src/web/ui/src/telas/NovoProjeto.tsx
 *
 * Tela inicial: o usuario descreve o que vai fazer (tema + contexto
 * opcional) e escolhe a duracao alvo; "Criar" cria o projeto (POST
 * /api/projetos — o brief ja carrega duracao_alvo_segundos) e navega
 * para a tela do projeto, onde o roteiro e gerado.
 *
 * A geracao do roteiro NAO dispara aqui: ela e um job com estado proprio
 * (FQ-U2) e o usuario a ve acontecer na tela do projeto, com progresso e
 * erro honestos. Criar != gerar — o contrato tem rotas separadas.
 *
 * Erros honestos (FQ-U4): brief invalido (tema vazio) e rejeitado antes
 * do envio; erro do servidor exibido com a mensagem do envelope.
 */

import { useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { CODIGOS_ERRO, ErroApi, criarClienteApi } from "../api.js";
import { formatarDuracao } from "../formatacao.js";
import { montarHash } from "../roteamento.js";

/** Duracoes alvo oferecidas pelo seletor (o gerador resolve a final). */
const DURACOES_DISPONIVEIS = [30, 60, 90, 120, 180, 300] as const;

export function NovoProjeto(): ReactElement {
  const [tema, setTema] = useState("");
  const [contexto, setContexto] = useState("");
  const [duracao, setDuracao] = useState<number>(60);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    const temaLimpo = tema.trim();
    if (temaLimpo === "") {
      setErro("descreva o tema do vídeo");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const cliente = criarClienteApi();
      const projeto = await cliente.criarProjeto({
        tema: temaLimpo,
        ...(contexto.trim() !== "" ? { contexto: contexto.trim() } : {}),
        duracao_alvo_segundos: duracao,
      });
      window.location.hash = montarHash({ nome: "projeto", id: projeto.id });
    } catch (e) {
      const erroApi = e instanceof ErroApi ? e : new ErroApi(CODIGOS_ERRO.ERRO_INESPERADO, "não foi possível criar o projeto — verifique se o servidor está no ar", 0);
      setErro(erroApi.mensagem);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="app-container" data-testid="tela-novo-projeto">
      <header className="app-cabecalho">
        <h1>Editor de Vídeo IA</h1>
        <p className="app-subtitulo">
          Descreva o que você vai fazer — o roteiro, os visuais e a narração saem daqui.
        </p>
      </header>

      <form className="painel-formulario" onSubmit={(e) => void criar(e)}>
        <label className="campo">
          <span className="campo-rotulo">O que o vídeo vai mostrar?</span>
          <textarea
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            rows={3}
            placeholder="Ex.: como funciona um cache de processador"
            data-testid="campo-tema"
          />
        </label>

        <label className="campo">
          <span className="campo-rotulo">Contexto (opcional)</span>
          <textarea
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            rows={2}
            placeholder="Ex.: para iniciantes, sem matemática pesada"
            data-testid="campo-contexto"
          />
        </label>

        <label className="campo">
          <span className="campo-rotulo">Duração alvo</span>
          <select value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} data-testid="campo-duracao">
            {DURACOES_DISPONIVEIS.map((valor) => (
              <option key={valor} value={valor}>
                {formatarDuracao(valor)}
              </option>
            ))}
          </select>
        </label>

        {erro !== null && (
          <p className="aviso aviso-erro" role="alert" data-testid="erro-criar">
            {erro}
          </p>
        )}

        <button type="submit" className="botao botao-primario botao-grande" disabled={enviando} data-testid="botao-criar">
          {enviando ? "Criando…" : "Criar projeto"}
        </button>
      </form>
    </main>
  );
}
