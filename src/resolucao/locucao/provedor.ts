/**
 * src/resolucao/locucao/provedor.ts
 *
 * O ADAPTADOR DO PROVEDOR — monta as chamadas e le as respostas.
 *
 * O caminho implementado tem DOIS saltos, porque nenhum provedor de TTS
 * de uso geral devolve audio e timing na mesma resposta:
 *
 *   1. sintese      texto  → audio            (endpoint de fala)
 *   2. alinhamento  audio  → palavras+tempos  (endpoint de transcricao,
 *                                              granularidade de palavra)
 *
 * O salto 2 e o "caminho local de transcricao" da armadilha do AGENTS.md,
 * na sua forma hospedada: mesmo modelo, mesma saida, mesma juncao
 * guardada por idioma. Por isso `alinhamento.ts` existe e roda sempre.
 *
 * Este arquivo NAO conserta resposta. Ele le o que veio e devolve como
 * veio; toda normalizacao mora em `alinhamento.ts` e roda tambem no
 * replay do cassete (contrato: "cassete e sosia, nao sucessor").
 */

import type { AlinhamentoPorCaractere, RespostaPalavras } from "./alinhamento.js";

// ─── Endpoints ──────────────────────────────────────────────────────────────────

/**
 * Base do provedor de fala.
 *
 * Entra em `parametros` e, portanto, na chave de cache. Nao e um detalhe
 * de configuracao: trocar a base troca o produtor dos bytes, e um
 * cassete gravado contra outra base NAO pode ser servido no lugar deste.
 * Com a base na chave isso e impossivel por construcao (C12).
 */
export const CAMINHO_FALA = "/v1/audio/speech";

/** Caminho do endpoint de transcricao com granularidade de palavra. */
export const CAMINHO_TRANSCRICAO = "/v1/audio/transcriptions";

// ─── Erros ──────────────────────────────────────────────────────────────────────

/** A resposta chegou, mas nao da para usar. */
export class ERespostaDoProvedor extends Error {
  readonly code = "RESPOSTA_DO_PROVEDOR";
  constructor(etapa: string, detalhe: string) {
    super(`Resposta invalida na etapa "${etapa}": ${detalhe}`);
    this.name = "ERespostaDoProvedor";
  }
}

// ─── Requisicoes ────────────────────────────────────────────────────────────────

/** Parametros de sintese que viajam na requisicao de fala. */
export interface PedidoDeFala {
  readonly base: string;
  readonly modelo: string;
  readonly voz: string;
  readonly velocidade: number;
  readonly formato: string;
  readonly texto: string;
  readonly credencial: string;
}

/**
 * Monta a requisicao de sintese.
 *
 * O corpo e uma string JSON de proposito: o gravador so registra
 * `corpoRequisicao` quando ele e string, e um cassete que nao guarda o
 * que foi pedido nao permite auditar por que a resposta e aquela.
 *
 * A credencial vai no header `Authorization`, que esta em
 * `HEADERS_SENSIVEIS` e e redigido antes de tocar o disco. Credencial em
 * query string seria redigida tambem (`sanitizarUrl`), mas ficaria no
 * log de qualquer proxy no caminho — entao header, sempre.
 */
export function requisicaoDeFala(pedido: PedidoDeFala): {
  url: string;
  init: RequestInit;
} {
  return {
    url: `${pedido.base}${CAMINHO_FALA}`,
    init: {
      method: "POST",
      headers: {
        authorization: `Bearer ${pedido.credencial}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input: pedido.texto,
        model: pedido.modelo,
        response_format: pedido.formato,
        speed: pedido.velocidade,
        voice: pedido.voz,
      }),
    },
  };
}

/** Parametros da requisicao de alinhamento. */
export interface PedidoDeAlinhamento {
  readonly base: string;
  readonly modelo: string;
  readonly idioma: string;
  readonly audio: Buffer;
  readonly nomeDoArquivo: string;
  readonly credencial: string;
}

/**
 * Monta a requisicao de transcricao com granularidade de PALAVRA.
 *
 * `timestamp_granularities[]=word` e o que faz a resposta trazer
 * `words[]`. Sem ele a resposta traz apenas segmentos, e segmento nao e
 * palavra: um segmento cobre uma frase inteira e nao serve para legenda
 * karaoke nem para ducking por palavra.
 *
 * `language` e enviado explicitamente. Deixar o modelo adivinhar o
 * idioma faz a saida depender do audio, e audio parecido em pt e es
 * dispara caminhos de tokenizacao diferentes — nao-determinismo na
 * origem, invisivel no diff.
 */
export function requisicaoDeAlinhamento(pedido: PedidoDeAlinhamento): {
  url: string;
  init: RequestInit;
} {
  const corpo = new FormData();
  corpo.append(
    "file",
    new Blob([new Uint8Array(pedido.audio)], { type: "audio/wav" }),
    pedido.nomeDoArquivo,
  );
  corpo.append("model", pedido.modelo);
  corpo.append("language", pedido.idioma);
  corpo.append("response_format", "verbose_json");
  corpo.append("timestamp_granularities[]", "word");

  return {
    url: `${pedido.base}${CAMINHO_TRANSCRICAO}`,
    init: {
      method: "POST",
      headers: { authorization: `Bearer ${pedido.credencial}` },
      body: corpo,
    },
  };
}

// ─── Leitura das respostas ──────────────────────────────────────────────────────

/**
 * Le a resposta de transcricao.
 *
 * Le e valida a FORMA, nada mais. Se `words[]` vier com pontuacao solta,
 * com tempo fora de ordem ou com palavra de duracao zero, isso passa
 * daqui inteiro — e o `alinhamento.ts` que corrige, no estagio, e
 * portanto tambem no replay.
 */
export function lerRespostaDeAlinhamento(texto: string): RespostaPalavras {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch (erro) {
    throw new ERespostaDoProvedor("alinhamento", `JSON invalido: ${(erro as Error).message}`);
  }
  const resposta = dados as RespostaPalavras;
  if (!Array.isArray(resposta.words)) {
    throw new ERespostaDoProvedor(
      "alinhamento",
      "a resposta nao tem 'words[]'. Faltou 'timestamp_granularities[]=word' " +
        "na requisicao? Sem ele o provedor devolve so segmentos, e segmento " +
        "nao e palavra.",
    );
  }
  if (resposta.words.length === 0) {
    throw new ERespostaDoProvedor(
      "alinhamento",
      "'words[]' vazio. Transcricao sem palavra nenhuma para um audio com " +
        "fala e o modo de falha C1 aplicado ao audio: exit 0 sem produto.",
    );
  }
  return resposta;
}

/**
 * Le uma resposta de TTS que traz alinhamento por CARACTERE junto.
 *
 * Nao e o caminho gravado, mas o formato existe e a conversao e testada
 * (`tokensDeCaracteres`). Manter o leitor aqui e mais barato do que
 * redescobrir, na W5, que "timestamps por caractere" e "timestamps por
 * palavra" sao coisas diferentes.
 */
export function lerAlinhamentoPorCaractere(dados: {
  readonly alignment?: AlinhamentoPorCaractere;
  readonly normalized_alignment?: AlinhamentoPorCaractere;
}): AlinhamentoPorCaractere {
  // `alignment` casa com o texto ORIGINAL; `normalized_alignment` casa
  // com o texto depois da normalizacao do provedor (numeros por extenso,
  // abreviacoes expandidas). Para legenda, o que o espectador le e o
  // texto original — entao `alignment` manda.
  const escolhido = dados.alignment ?? dados.normalized_alignment;
  if (escolhido === undefined) {
    throw new ERespostaDoProvedor(
      "fala",
      "resposta sem 'alignment' nem 'normalized_alignment'",
    );
  }
  return escolhido;
}

// ─── Duracao do audio (C4) ──────────────────────────────────────────────────────

/** O audio chegou, mas nao da para medir. */
export class EAudioIlegivel extends Error {
  readonly code = "AUDIO_ILEGIVEL";
  constructor(detalhe: string) {
    super(`Audio ilegivel: ${detalhe}`);
    this.name = "EAudioIlegivel";
  }
}

/**
 * Duracao de um WAV, em milissegundos, medida no proprio PCM.
 *
 * C4 do AGENTS.md: "`ffprobe` reporta duracao do container, que pode
 * divergir do stream". A defesa aqui e nao perguntar a nenhum container:
 * a duracao sai de `tamanho_do_chunk_data / byte_rate`, que e o numero
 * de amostras de verdade. E tambem por isso o formato pedido e `wav` e
 * nao `mp3`: WAV tem duracao aritmetica; MP3 tem duracao estimada por
 * varredura de frames, que difere entre decodificadores.
 *
 * Varre os chunks RIFF em vez de assumir offset 44. Um WAV com chunk
 * `LIST`/`INFO` antes do `data` — que e o que varias ferramentas
 * escrevem — quebraria o offset fixo em silencio.
 */
export function duracaoDoWavMs(wav: Buffer): number {
  if (wav.length < 12) throw new EAudioIlegivel(`${wav.length} bytes e curto demais`);
  if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new EAudioIlegivel("nao comeca com RIFF....WAVE");
  }

  let offset = 12;
  let byteRate = 0;
  let bytesDeDados = -1;

  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const tamanho = wav.readUInt32LE(offset + 4);
    const corpo = offset + 8;

    if (id === "fmt " && corpo + 16 <= wav.length) {
      byteRate = wav.readUInt32LE(corpo + 8);
    } else if (id === "data") {
      // O tamanho declarado pode passar do arquivo (gravacao truncada);
      // vale o menor dos dois, senao a duracao mente para mais.
      bytesDeDados = Math.min(tamanho, wav.length - corpo);
      break;
    }
    offset = corpo + tamanho + (tamanho % 2); // chunks sao alinhados em 2
  }

  if (byteRate <= 0) throw new EAudioIlegivel("chunk 'fmt ' ausente ou com byteRate zero");
  if (bytesDeDados < 0) throw new EAudioIlegivel("chunk 'data' ausente");
  if (bytesDeDados === 0) {
    throw new EAudioIlegivel(
      "chunk 'data' vazio — audio de zero byte. C1: o provedor respondeu 200 e " +
        "nao entregou som nenhum.",
    );
  }

  return Math.round((bytesDeDados / byteRate) * 1000);
}

/**
 * Confere se a duracao que a transcricao reporta bate com a duracao
 * medida no PCM.
 *
 * Pergunta adversarial (2) do F3-01: "o timing e o audio podem divergir
 * sem nada ficar vermelho?". Aqui nao podem. A tolerancia e generosa
 * (250 ms) porque o modelo corta silencio de borda; o que ela nao
 * tolera e o caso que importa — timing de OUTRO audio, que diverge em
 * segundos.
 */
export const TOLERANCIA_DIVERGENCIA_MS = 250;

export function conferirDuracao(
  duracaoDoAudioMs: number,
  duracaoReportadaS: number | undefined,
): void {
  if (duracaoReportadaS === undefined) return;
  const reportadaMs = Math.round(duracaoReportadaS * 1000);
  const delta = Math.abs(reportadaMs - duracaoDoAudioMs);
  if (delta > TOLERANCIA_DIVERGENCIA_MS) {
    throw new ERespostaDoProvedor(
      "alinhamento",
      `a transcricao reporta ${reportadaMs}ms e o PCM mede ${duracaoDoAudioMs}ms ` +
        `(delta ${delta}ms > ${TOLERANCIA_DIVERGENCIA_MS}ms). O timing provavelmente ` +
        "descreve outro audio.",
    );
  }
}
