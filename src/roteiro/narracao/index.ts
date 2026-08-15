/**
 * src/roteiro/narracao/index.ts
 *
 * Barrel export do modulo de narracao gravada (D4) — o caminho do botao
 * de gravacao de voz: receberGravacao converte webm->wav 48 kHz estereo
 * (FORMATO_AUDIO_GRAVADO), grava no store por SHA-256 com procedencia e
 * devolve o hash para o Pedaco.narracao (contrato-roteiro.md §7).
 */

export {
  receberGravacao,
  medirDuracao,
  hashDeAudio,
  lerCabecalhoWav,
  eWavNoFormatoCanonico,
  conferirPinDoFfmpeg,
  executorPadrao,
  VERSAO_MODULO_NARRACAO,
  PIN_FFMPEG_NARRACAO,
  ErroGravacaoVazia,
  ErroConversaoAudio,
  ErroAudioInvalido,
} from "./narracao.js";
export type {
  CabecalhoWav,
  ExecutorDeComando,
  MetaDaGravacao,
  OpcoesDeGravacao,
  ResultadoDaGravacao,
} from "./narracao.js";
export { procedenciaDaGravacao } from "./procedencia.js";
export type { DadosDaProcedenciaDaGravacao } from "./procedencia.js";
