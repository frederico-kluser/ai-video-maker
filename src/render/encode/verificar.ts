/**
 * src/render/encode/verificar.ts
 *
 * A VERIFICACAO DO ARTEFATO ENCODADO — a camada 0 do oraculo (ffprobe
 * estrutural) + a prova de determinismo (framemd5) + o conteudo minimo
 * (entropia), na disciplina do video-characterization.
 *
 * O que cada checagem responde (e a mentira que ela desarma):
 *
 *   - estrutura por STREAM, nunca por container (C4): um MP4 com
 *     duracao de container divergente do stream passa por "o mesmo
 *     video"; aqui a leitura e `-select_streams v:0 -count_frames` e a
 *     duracao e lida por stream, com a divergencia container x stream
 *     reportada no resultado.
 *   - parse NAO-vazio antes de comparar valor (falsifiable-gates): uma
 *     chave de ffprobe com typo devolve saida vazia com exit 0 — o
 *     verificador falha quando o probe volta vazio, antes de qualquer
 *     comparacao.
 *   - codec/resolucao: o artefato tem de bater com o perfil que o
 *     produziu (o falso verde da troca de encoder em silencio).
 *   - metadado nao-deterministico AUSENTE (pergunta adversarial 2):
 *     `format_tags` (encoder, creation_time) tem de voltar VAZIO — se
 *     voltar a tag `encoder=Lavf...`, o comando foi montado errado
 *     (flags de bitexact antes das entradas), nao o baseline.
 *   - entropia (C1): um video 100% preto passa em toda a camada
 *     estrutural; `signalstats` YAVG por frame tem de ficar acima do
 *     piso (preto mede 16 em luma limitada; conteudo real mede >100 —
 *     o piso 32 e a separacao, medido em 6.1.1 nesta maquina).
 *   - framemd5: o hash de frames decodificados, imune a container — o
 *     oraculo de "mudou alguma coisa? e em qual frame?" (camada 1).
 */

import { execFile } from "node:child_process";

export type ExecutorDeComando = (
  comando: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

const executorPadrao: ExecutorDeComando = (comando, args) =>
  new Promise((resolve, reject) => {
    execFile(comando, args, { timeout: 120_000 }, (erro, stdout, stderr) => {
      if (erro) {
        reject(erro);
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/** O piso de luma media (YAVG) para o conteudo nao ser preto. */
export const YAVG_PISO_CONTEUDO = 32;

/**
 * Chaves de metadado NAO-deterministicas (pergunta adversarial 2): a
 * data de criacao, a versao/string do encoder e o timecode. O MP4
 * carrega TAMBEM tags estruturais DETERMINISTICAS (major_brand,
 * minor_version, compatible_brands — os atomos de brand do container),
 * que sao sempre as mesmas e nao entram na lista: o oraculo persegue o
 * metadado que MUDA entre execucoes, nao o container.
 */
export const CHAVES_METADADO_NAO_DETERMINISTICO: readonly string[] = [
  "encoder",
  "creation_time",
  "date",
  "timecode",
];

export interface EsperadoDeSaida {
  /**
   * O codec esperado — o `codec_name` que o ffprobe vai reportar
   * (h264, hevc...). Use `codecNameDePerfil()` para derivar do perfil:
   * o campo `codec` do perfil e o valor de `-c:v` ("libx264",
   * "h264_nvenc"), o ffprobe reporta outro vocabulario ("h264").
   */
  codec: string;
  /** Largura esperada (a do master de entrada). */
  largura: number;
  /** Altura esperada (a do master de entrada). */
  altura: number;
}

/** `-c:v` do perfil -> `codec_name` do ffprobe (vocabularios diferentes). */
const MAPA_CODEC_NAME: Record<string, string> = {
  libx264: "h264",
  libx265: "hevc",
  h264_nvenc: "h264",
  hevc_nvenc: "hevc",
  av1_nvenc: "av1",
  libvpx: "vp8",
  "libvpx-vp9": "vp9",
};

/**
 * Deriva o `codec_name` do ffprobe a partir do valor de `-c:v` do
 * perfil: libx264/h264_nvenc -> h264; libx265/hevc_nvenc -> hevc.
 */
export function codecNameDePerfil(codecDeCv: string): string {
  return MAPA_CODEC_NAME[codecDeCv] ?? codecDeCv;
}

export interface InfoDaSaida {
  codec: string;
  largura: number;
  altura: number;
  pixFmt: string;
  framesLidos: number;
  duracaoStreamS: number;
  duracaoContainerS: number;
  yavgMedio: number;
  formatTags: Record<string, string>;
  framemd5: string;
}

export interface ResultadoDeVerificacao {
  ok: boolean;
  erros: string[];
  info: InfoDaSaida;
}

export interface OpcoesDeVerificacao {
  executor?: ExecutorDeComando;
}

/** Extrai a duracao em segundos de um numero "N/M" ou "N.M" do ffprobe. */
function parseDuracao(valor: string): number {
  const limpo = valor.trim();
  if (limpo === "N/A") {
    return Number.NaN;
  }
  const partes = limpo.split("/");
  if (partes.length === 2) {
    const num = Number(partes[0]);
    const den = Number(partes[1]);
    if (den !== 0 && !Number.isNaN(num)) {
      return num / den;
    }
  }
  return Number(limpo);
}

function extrairFramemd5(saida: string): string {
  // framemd5 (6.1.1): cabecalho "#..." + N linhas de frame no formato
  // "N, pts, dts, size, checksum" (o checksum md5 SEM prefixo 0x) — o
  // texto inteiro das linhas de frame e o oraculo (o hash de cada frame
  // responde "mudou? e em qual?"). O filtro casa a forma de linha de
  // frame e descarta o cabecalho.
  const linhas = saida
    .split("\n")
    .filter((l) => /^\d+,\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*[0-9a-f]{32}/.test(l));
  return linhas.join("\n");
}

/**
 * Verifica o artefato encodado. `ok: false` com `erros` nomeados quando
 * qualquer checagem falha; `info` carrega tudo o que foi lido (o
 * consumidor do F5-07 pode reportar sem re-probar).
 */
export async function verificarSaida(
  saida: string,
  esperado: EsperadoDeSaida,
  opcoes: OpcoesDeVerificacao = {},
): Promise<ResultadoDeVerificacao> {
  const executor = opcoes.executor ?? executorPadrao;

  // 1. Estrutura por STREAM (C4) + parse nao-vazio obrigatorio.
  const probe = await executor("ffprobe", [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,width,height,pix_fmt,nb_read_frames,duration",
    "-of",
    "default=nw=1",
    saida,
  ]);
  const linhasProbe = probe.stdout.split("\n");
  const campo = (chave: string): string => {
    const linha = linhasProbe.find((l) => l.startsWith(`${chave}=`));
    return linha !== undefined ? linha.slice(chave.length + 1).trim() : "";
  };

  const codec = campo("codec_name");
  const largura = Number(campo("width"));
  const altura = Number(campo("height"));
  const pixFmt = campo("pix_fmt");
  const framesLidos = Number(campo("nb_read_frames"));
  const duracaoStreamS = parseDuracao(campo("duration"));

  // 2. Duracao do CONTAINER (para reportar a divergencia — C4).
  const probeContainer = await executor("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:format_tags",
    "-of",
    "default=nw=1",
    saida,
  ]);
  const tags: Record<string, string> = {};
  for (const linha of probeContainer.stdout.split("\n")) {
    const m = /^TAG:([^=]+)=(.*)$/.exec(linha);
    if (m !== null) {
      tags[m[1] ?? ""] = m[2] ?? "";
    }
  }
  const duracaoContainerS = Number(
    (probeContainer.stdout.match(/^duration=(.+)$/m) ?? [])[1] ?? "NaN",
  );

  // 3. Entropia (C1): YAVG por frame via signalstats.
  const signal = await executor("ffmpeg", [
    "-hide_banner",
    "-i",
    saida,
    "-vf",
    "signalstats,metadata=print:key=lavfi.signalstats.YAVG",
    "-f",
    "null",
    "-",
  ]);
  const yavgs = [...signal.stderr.matchAll(/YAVG=([0-9.]+)/g)].map((m) =>
    Number(m[1]),
  );
  const yavgMedio =
    yavgs.length > 0
      ? yavgs.reduce((a, b) => a + b, 0) / yavgs.length
      : Number.NaN;

  // 4. framemd5 — o oraculo de frames decodificados (camada 1).
  const framemd5Bruto = await executor("ffmpeg", [
    "-hide_banner",
    "-fflags",
    "+bitexact",
    "-i",
    saida,
    "-f",
    "framemd5",
    "-",
  ]);
  const framemd5 = extrairFramemd5(framemd5Bruto.stdout);

  const info: InfoDaSaida = {
    codec,
    largura,
    altura,
    pixFmt,
    framesLidos,
    duracaoStreamS,
    duracaoContainerS,
    yavgMedio,
    formatTags: tags,
    framemd5,
  };

  // 5. As assercoes — parse nao-vazio ANTES de comparar valor.
  const erros: string[] = [];
  if (codec === "") {
    erros.push("ffprobe voltou vazio para codec_name (parse NAO-vazio obrigatorio — chave errada ou arquivo ilegivel)");
  } else if (codec !== esperado.codec) {
    erros.push(`codec esperado "${esperado.codec}" mas encontrado "${codec}" — encoder trocou em silencio?`);
  }
  if (!Number.isFinite(largura) || !Number.isFinite(altura)) {
    erros.push("ffprobe voltou vazio para width/height (parse NAO-vazio obrigatorio)");
  } else if (largura !== esperado.largura || altura !== esperado.altura) {
    erros.push(`resolucao esperada ${esperado.largura}x${esperado.altura} mas encontrada ${largura}x${altura}`);
  }
  if (!Number.isFinite(framesLidos) || framesLidos <= 0) {
    erros.push(`framesLidos deve ser > 0 (encontrado: ${campo("nb_read_frames") || "vazio"})`);
  }
  if (!Number.isFinite(yavgMedio)) {
    erros.push("signalstats nao produziu YAVG (arquivo ilegivel?)");
  } else if (yavgMedio < YAVG_PISO_CONTEUDO) {
    erros.push(
      `entropia abaixo do piso: YAVG medio ${yavgMedio.toFixed(1)} < ${YAVG_PISO_CONTEUDO} — video preto passa em toda a camada estrutural (C1)`,
    );
  }
  // Pergunta adversarial 2: metadado nao-deterministico (encoder, data)
  // removido — o oraculo e a AUSENCIA das chaves volateis em format_tags
  // (as tags estruturais de brand do MP4 sao deterministicas e seguem no
  // arquivo — nao sao o que o card persegue).
  const volateisPresentes = Object.keys(tags).filter((chave) =>
    CHAVES_METADADO_NAO_DETERMINISTICO.includes(chave),
  );
  if (volateisPresentes.length > 0) {
    erros.push(
      `metadado nao-deterministico presente no arquivo: ${volateisPresentes.join(", ")} — os flags de bitexact precisam ficar DEPOIS das entradas (NV-5)`,
    );
  }
  // C4: a divergencia container x stream viaja no resultado (reportada,
  // nunca aprovada em silencio) — a assercao dura de duracao e
  // `framesLidos > 0`, acima.

  return { ok: erros.length === 0, erros, info };
}

/**
 * Calcula o framemd5 de um arquivo — o oraculo da camada 1 (determinismo
 * por frame decodificado, imune a container). Usado pelo teste de
 * determinismo 2x.
 */
export async function calcularFramemd5(
  arquivo: string,
  opcoes: OpcoesDeVerificacao = {},
): Promise<string> {
  const executor = opcoes.executor ?? executorPadrao;
  const resultado = await executor("ffmpeg", [
    "-hide_banner",
    "-fflags",
    "+bitexact",
    "-i",
    arquivo,
    "-f",
    "framemd5",
    "-",
  ]);
  return extrairFramemd5(resultado.stdout);
}
