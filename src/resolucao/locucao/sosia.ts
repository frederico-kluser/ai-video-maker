/**
 * src/resolucao/locucao/sosia.ts
 *
 * SERVIDOR SOSIA — o provedor de mentira contra o qual este cassete foi
 * gravado. Roda SO na gravacao, nunca na suite.
 *
 * ─── Por que existe, dito sem maquiagem ──────────────────────────────
 *
 * A chave de API disponivel neste ambiente esta sem credito
 * (`credit_balance_exhausted`, HTTP 429). Sem credito nao ha bytes do
 * provedor real, e sem bytes nao ha cassete — e sem cassete o estagio
 * derruba `res-offline` (∅-crit). As saidas possiveis eram tres:
 *
 *   (a) nao entregar cassete e deixar o card vermelho;
 *   (b) forjar um cassete escrevendo `chamadas.json` a mao, com a URL do
 *       provedor real;
 *   (c) gravar contra um sosia local, com a URL VERDADEIRA (loopback) e
 *       a origem declarada em todo lugar.
 *
 * (b) esta descartada: seria um cassete que MENTE sobre a origem dos
 * bytes, e mentira em fixture e a divida mais cara que este repositorio
 * pode contrair — ela passa em todos os gates para sempre. Este arquivo
 * e a opcao (c).
 *
 * O que o sosia preserva, e por isso o cassete vale alguma coisa:
 *
 *   - o CODIGO do estagio e o mesmo nos dois casos. `resolver()` nao
 *     sabe que esta falando com o sosia;
 *   - a URL gravada em `chamadas.json` e `http://127.0.0.1:3203/...`,
 *     que e onde os bytes realmente nasceram. Nenhum campo do cassete
 *     afirma "isto veio do provedor X";
 *   - `endpoint_base` esta nos PARAMETROS e, portanto, na chave de
 *     cache. Regravar contra o provedor real produz outra chave e outro
 *     diretorio: o cassete de sosia NAO pode ser servido no lugar do
 *     real, nem por engano nem de proposito;
 *   - o sosia MODELA a regra documentada da ferramenta de transcricao
 *     (juncao de pontuacao ASCII, pontuacao nao-ASCII solta, palavra com
 *     espaco a esquerda), em vez de devolver uma resposta ja limpa. Um
 *     sosia que devolvesse resposta limpa esconderia o proprio bug que o
 *     estagio existe para corrigir.
 *
 * O que ele NAO substitui esta no ledger (AB-410) e no handoff: os bytes
 * de voz de verdade. Regravar com credito e um passo de uma linha —
 * trocar `endpoint_base` e `provedor` nos parametros.
 */

import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { CAMINHO_FALA, CAMINHO_TRANSCRICAO } from "./provedor.js";

// ─── Sintese: WAV deterministico ────────────────────────────────────────────────

/** Taxa de amostragem do sosia. Fixa: entra na duracao, logo no timing. */
export const TAXA_AMOSTRAGEM = 16000;

/** Milissegundos base de uma palavra, mais o incremento por caractere. */
const MS_BASE_POR_PALAVRA = 120;
const MS_POR_CARACTERE = 45;
const MS_DE_PAUSA = 90;

/**
 * Duracao que o sosia atribui a cada palavra do texto.
 *
 * Funcao pura do texto — nenhum relogio, nenhum aleatorio. E isso que
 * permite gravar duas vezes e exigir bytes identicos.
 */
export function duracoesPorPalavra(texto: string): number[] {
  return palavrasDoTexto(texto).map(
    (p) => MS_BASE_POR_PALAVRA + Array.from(p).length * MS_POR_CARACTERE,
  );
}

/** Divide o texto em tokens separados por espaco, preservando pontuacao. */
export function palavrasDoTexto(texto: string): string[] {
  return texto.trim().split(/\s+/u).filter((p) => p !== "");
}

/**
 * Sintetiza um WAV PCM 16-bit mono deterministico.
 *
 * Cada palavra vira um trecho de tom com envelope, seguido de pausa. Nao
 * e voz: e audio com estrutura, energia nao-nula e duracao aritmetica. A
 * frequencia deriva do proprio texto, entao dois textos diferentes
 * produzem audios diferentes — sem isso, duas cenas com o mesmo numero
 * de palavras colidiriam no mesmo hash e o mapa `nos_locucao` teria duas
 * cenas apontando para o mesmo asset.
 *
 * O texto vai embutido num chunk `LIST/INFO/ICMT`, ANTES do `data`: e
 * assim que o endpoint de transcricao do sosia recupera o que foi dito,
 * sem precisar de estado em memoria. De quebra, isso poe um chunk entre
 * o cabecalho e o `data` — que e exatamente o caso que `duracaoDoWavMs`
 * precisa saber atravessar.
 */
export function sintetizarWav(texto: string): Buffer {
  const duracoes = duracoesPorPalavra(texto);
  const palavras = palavrasDoTexto(texto);
  const amostras: number[] = [];

  for (let i = 0; i < palavras.length; i++) {
    const palavra = palavras[i] as string;
    const ms = duracoes[i] as number;
    const total = Math.round((ms / 1000) * TAXA_AMOSTRAGEM);
    // Frequencia derivada do conteudo: 180 Hz + soma dos pontos de codigo.
    let soma = 0;
    for (const c of palavra) soma += c.codePointAt(0) ?? 0;
    const freq = 180 + (soma % 220);

    for (let n = 0; n < total; n++) {
      const t = n / TAXA_AMOSTRAGEM;
      // Envelope trapezoidal: sem clique nas bordas.
      const rampa = Math.min(1, Math.min(n, total - n) / (TAXA_AMOSTRAGEM * 0.01));
      const valor = Math.sin(2 * Math.PI * freq * t) * 0.35 * rampa;
      amostras.push(Math.round(valor * 32767));
    }
    if (i < palavras.length - 1) {
      const pausa = Math.round((MS_DE_PAUSA / 1000) * TAXA_AMOSTRAGEM);
      for (let n = 0; n < pausa; n++) amostras.push(0);
    }
  }

  return montarWav(amostras, texto);
}

/** Escreve o RIFF: `fmt `, `LIST/INFO/ICMT` com o texto, e `data`. */
function montarWav(amostras: readonly number[], comentario: string): Buffer {
  const pcm = Buffer.alloc(amostras.length * 2);
  amostras.forEach((v, i) => pcm.writeInt16LE(Math.max(-32768, Math.min(32767, v)), i * 2));

  const textoBytes = Buffer.from(comentario, "utf-8");
  // ICMT precisa terminar em NUL e ter tamanho par.
  const icmtTamanho = textoBytes.length + 1;
  const icmtPad = icmtTamanho % 2;
  const icmt = Buffer.alloc(8 + icmtTamanho + icmtPad);
  icmt.write("ICMT", 0, "ascii");
  icmt.writeUInt32LE(icmtTamanho, 4);
  textoBytes.copy(icmt, 8);

  const list = Buffer.alloc(12 + icmt.length);
  list.write("LIST", 0, "ascii");
  list.writeUInt32LE(4 + icmt.length, 4);
  list.write("INFO", 8, "ascii");
  icmt.copy(list, 12);

  const fmt = Buffer.alloc(24);
  fmt.write("fmt ", 0, "ascii");
  fmt.writeUInt32LE(16, 4);
  fmt.writeUInt16LE(1, 8); // PCM
  fmt.writeUInt16LE(1, 10); // mono
  fmt.writeUInt32LE(TAXA_AMOSTRAGEM, 12);
  fmt.writeUInt32LE(TAXA_AMOSTRAGEM * 2, 16); // byte rate
  fmt.writeUInt16LE(2, 20); // block align
  fmt.writeUInt16LE(16, 22); // bits

  const cabecalhoData = Buffer.alloc(8);
  cabecalhoData.write("data", 0, "ascii");
  cabecalhoData.writeUInt32LE(pcm.length, 4);

  const corpo = Buffer.concat([
    Buffer.from("WAVE", "ascii"),
    fmt,
    list,
    cabecalhoData,
    pcm,
  ]);
  const riff = Buffer.alloc(8);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(corpo.length, 4);
  return Buffer.concat([riff, corpo]);
}

/** Recupera o texto embutido no chunk `LIST/INFO/ICMT` de um WAV. */
export function textoDoWav(wav: Buffer): string {
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const tamanho = wav.readUInt32LE(offset + 4);
    if (id === "LIST" && wav.toString("ascii", offset + 8, offset + 12) === "INFO") {
      let interno = offset + 12;
      const fim = offset + 8 + tamanho;
      while (interno + 8 <= fim) {
        const subId = wav.toString("ascii", interno, interno + 4);
        const subTamanho = wav.readUInt32LE(interno + 4);
        if (subId === "ICMT") {
          return wav
            .subarray(interno + 8, interno + 8 + subTamanho)
            .toString("utf-8")
            .replace(/\0+$/, "");
        }
        interno += 8 + subTamanho + (subTamanho % 2);
      }
    }
    offset += 8 + tamanho + (tamanho % 2);
  }
  throw new Error("WAV do sosia sem chunk LIST/INFO/ICMT — nao da para transcrever");
}

// ─── Transcricao: a resposta COM o defeito ──────────────────────────────────────

/**
 * Pontuacao ASCII, como a ferramenta de transcricao a define.
 *
 * E literalmente `string.punctuation` do Python, que e o conjunto usado
 * pela juncao da ferramenta. Tudo que esta FORA daqui — `…`, `—`, `«`,
 * `»`, `“`, `”` — nao e reconhecido como pontuacao e sobra como token
 * proprio. Em ingles isso quase nunca acontece; em pt-BR, acontece.
 */
const PONTUACAO_ASCII = new Set(
  Array.from("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"),
);

/**
 * Produz a resposta de transcricao no formato `verbose_json`, com
 * granularidade de palavra — e com os defeitos que a ferramenta de
 * verdade tem:
 *
 *   - `word` vem com ESPACO A ESQUERDA. E a convencao interna da
 *     ferramenta: a propria juncao dela testa `word.startswith(" ")`
 *     para decidir o que grudar.
 *   - `start`/`end` sao SEGUNDOS em ponto flutuante, com mais casas do
 *     que a saida final usa.
 *   - pontuacao NAO-ASCII vira token separado, porque a juncao da
 *     ferramenta so reconhece `string.punctuation`.
 *
 * Cada um desses tres e reparado pelo ESTAGIO (`alinhamento.ts`), nao
 * aqui. E essa a diferenca entre sosia e sucessor.
 */
export function transcrever(texto: string): {
  task: string;
  language: string;
  duration: number;
  text: string;
  words: Array<{ word: string; start: number; end: number }>;
} {
  const palavras = palavrasDoTexto(texto);
  const duracoes = duracoesPorPalavra(texto);
  const words: Array<{ word: string; start: number; end: number }> = [];

  let agoraMs = 0;
  palavras.forEach((palavra, i) => {
    const ms = duracoes[i] as number;
    const fatias = fatiarPontuacaoNaoAscii(palavra);
    // A duracao da palavra e repartida entre as fatias, proporcional ao
    // numero de caracteres — que e o que um alinhador faria.
    const totalCaracteres = fatias.reduce((s, f) => s + Array.from(f).length, 0) || 1;
    let deslocamento = 0;
    fatias.forEach((fatia, j) => {
      const parte = (ms * Array.from(fatia).length) / totalCaracteres;
      const inicio = (agoraMs + deslocamento) / 1000;
      const fim = (agoraMs + deslocamento + parte) / 1000;
      words.push({
        // Espaco a esquerda apenas na PRIMEIRA fatia: e assim que a
        // ferramenta marca fronteira de palavra.
        word: (i > 0 || j > 0) && j === 0 ? ` ${fatia}` : fatia,
        start: Number(inicio.toFixed(6)),
        end: Number(fim.toFixed(6)),
      });
      deslocamento += parte;
    });
    agoraMs += ms + (i < palavras.length - 1 ? MS_DE_PAUSA : 0);
  });

  return {
    task: "transcribe",
    language: "portuguese",
    duration: Number((agoraMs / 1000).toFixed(6)),
    text: texto,
    words,
  };
}

/**
 * Separa a pontuacao NAO-ASCII do resto do token.
 *
 * `"pipeline."` continua inteiro (o ponto e ASCII e a juncao da
 * ferramenta o grudou). `"pipeline…"` vira `["pipeline", "…"]`, porque
 * `…` nao esta em `string.punctuation` e a juncao nao o viu.
 */
function fatiarPontuacaoNaoAscii(token: string): string[] {
  const fatias: string[] = [];
  let atual = "";
  for (const c of token) {
    const naoAsciiPontuacao = /\p{P}/u.test(c) && !PONTUACAO_ASCII.has(c);
    if (naoAsciiPontuacao) {
      if (atual !== "") fatias.push(atual);
      fatias.push(c);
      atual = "";
      continue;
    }
    atual += c;
  }
  if (atual !== "") fatias.push(atual);
  return fatias.length > 0 ? fatias : [token];
}

// ─── Servidor ───────────────────────────────────────────────────────────────────

/** Um sosia em execucao. */
export interface SosiaEmExecucao {
  readonly base: string;
  readonly fechar: () => Promise<void>;
}

async function lerCorpo(req: IncomingMessage): Promise<Buffer> {
  const partes: Buffer[] = [];
  for await (const parte of req) partes.push(parte as Buffer);
  return Buffer.concat(partes);
}

/**
 * Sobe o sosia em `127.0.0.1:<porta>`.
 *
 * Porta 3203 e a faixa reservada a este card no contrato da onda — sem
 * isso, dois agentes gravando ao mesmo tempo colidiriam em porta e um
 * dos dois gravaria contra o servidor do outro.
 */
export function iniciarSosia(porta: number): Promise<SosiaEmExecucao> {
  const servidor: Server = createServer((req, res) => {
    void atender(req, res).catch((erro: unknown) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(erro) }));
    });
  });

  return new Promise((resolver, rejeitar) => {
    servidor.once("error", rejeitar);
    servidor.listen(porta, "127.0.0.1", () => {
      resolver({
        base: `http://127.0.0.1:${porta}`,
        fechar: () =>
          new Promise<void>((ok) => {
            servidor.close(() => ok());
          }),
      });
    });
  });
}

async function atender(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // `sendDate = false`: sem ele, o Node injeta um header `Date` com o
  // relogio de parede em TODA resposta, e o header e gravado em
  // chamadas.json. Duas gravacoes que cruzem um limite de segundo
  // divergiriam num campo que nada tem a ver com o audio — um flake de
  // determinismo cuja origem nem parece ser relogio. O sosia e funcao
  // pura do texto; ele nao tem relogio nenhum.
  res.sendDate = false;
  const caminho = (req.url ?? "").split("?")[0];

  if (req.method === "POST" && caminho === CAMINHO_FALA) {
    const pedido = JSON.parse((await lerCorpo(req)).toString("utf-8")) as {
      input?: string;
    };
    const wav = sintetizarWav(pedido.input ?? "");
    res.writeHead(200, {
      "content-type": "audio/wav",
      "content-length": String(wav.length),
    });
    res.end(wav);
    return;
  }

  if (req.method === "POST" && caminho === CAMINHO_TRANSCRICAO) {
    const corpo = await lerCorpo(req);
    // `Response.formData()` do runtime faz o parse de multipart. Fazer o
    // parse a mao aqui seria reimplementar um formato que o proprio
    // runtime ja le — e errar nele silenciosamente.
    const forma = await new Response(new Uint8Array(corpo), {
      headers: { "content-type": req.headers["content-type"] ?? "" },
    }).formData();
    const arquivo = forma.get("file");
    if (!(arquivo instanceof Blob)) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "campo 'file' ausente" }));
      return;
    }
    const wav = Buffer.from(await arquivo.arrayBuffer());
    const corpoResposta = Buffer.from(
      JSON.stringify(transcrever(textoDoWav(wav))),
      "utf-8",
    );
    res.writeHead(200, {
      "content-type": "application/json",
      "content-length": String(corpoResposta.length),
    });
    res.end(corpoResposta);
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: `sem rota para ${req.method} ${caminho}` }));
}
