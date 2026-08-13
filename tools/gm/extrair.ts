#!/usr/bin/env npx tsx
/**
 * tools/gm/extrair.ts
 *
 * O NUCLEO COMUM do golden master de ponta a ponta — card F5-08 (W10).
 * Consumido por tools/gm/capturar.ts (captura) e tools/gm/gate.ts (gate):
 * os DOIS usam exatamente estas mesmas funcoes, para o golden nunca
 * nascer de um caminho e ser conferido por outro.
 *
 * O que o golden captura (e o que o gate confere), item a item:
 *
 *   1. manifestos/manifesto-resolvido.json — o artefato 1 do pipeline
 *      (JSON deterministico, chaves na ordem do contrato);
 *   2. manifestos/mix-documento.json — MixDocument.1 (ADR-0034), com o
 *      pin de ferramentas declarado;
 *   3. manifestos/pos-documento.json — PosDocument.1 (ADR-0040);
 *   4. manifestos/relatorio-final.json — RelatorioFinal.1: o INDICE de
 *      hashes do proprio pipeline sobre os 11 artefatos. Ele participa
 *      do golden de proposito: se QUALQUER artefato da lista fechada
 *      mudar (entregavel.m4a, thumbnail, variante...), o relatorio-final
 *      muda junto — o golden acende sem capturar cada arquivo.
 *   5. frames/frame-<N>.png — frames-chave extraidos do master.mov
 *      (QTRLE/argb — o master deterministico da chave C7, ADR-0041/0035)
 *      pelo MESMO ffmpeg pinado (6.1.1) que o pipeline usa. O MP4 final
 *      NUNCA entra no golden (o encoder muda — oraculo falso); o QTRLE
 *      e lossless e deterministico.
 *   6. audio/envelope.json — projecao do envelope do master.wav do mix
 *      (RMS por janela de 100 ms, por canal): uma regressao de AUDIO
 *      sem regressao de VIDEO muda o envelope e o golden acende.
 *
 * O frame-chave e extraido do master.mov (NUNCA do MP4 final): o
 * master.mov e o render deterministico da chave C7; o MP4 carrega a
 * versao do encoder. A lista de frames e DERIVADA do manifesto da
 * fixture pelas mesmas funcoes que o render usa (planoDeComposicao) —
 * nunca digitada — e gravada no indice do golden com o motivo de cada
 * escolha (inicio, fronteiras de transicao, meio de cenas
 * representativas, fim).
 */

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { lerWavPcm } from "../../src/audio/mix/pcm.js";
import { planoDeComposicao, type PlanoDeComposicao } from "../../src/composicao/ManifestoRaiz.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import {
  calcularChaveC7,
  componentesDaChaveC7,
  lerVersoesDaPilha,
  lerPinDeFerramentas,
  type ComponentesDaChaveC7,
} from "../../src/render/cache/index.js";

/** Formato do indice do golden (fixtures/gm/manifesto.json). */
export const FORMATO_DO_INDICE = "GoldenMaster.1" as const;

/** Formato do envelope projetado do master do mix. */
export const FORMATO_DO_ENVELOPE = "EnvelopeGolden.1" as const;

/** Janela do envelope do audio em segundos (RMS por janela, por canal). */
export const JANELA_DO_ENVELOPE_S = 0.1;

/** Um frame escolhido, com o motivo (documentado no indice do golden). */
export interface FrameEscolhido {
  readonly frame: number;
  readonly motivo: string;
}

/** Uma linha do indice: arquivo -> sha256 + tamanho. */
export interface ItemDoIndice {
  readonly arquivo: string;
  readonly sha256: string;
  readonly tamanho: number;
}

/**
 * DERIVA a lista de frames-chave do manifesto da fixture — pela MESMA
 * aritmetica do render (planoDeComposicao), nunca digitada:
 *
 *   1. frame 0 — inicio do video;
 *   2. primeira moldura de cada cena seguinte (fronteiras de transicao —
 *      onde a interpolacao esta exercida);
 *   3. meio da cena que contem um no tipo "grafico" (a camada visual
 *      mais rica da fixture canonica);
 *   4. meio da cena que contem um no tipo "codigo" (o outro layer
 *      representativo);
 *   5. ultima moldura (fim do video).
 *
 * Regras GENERICAS: se a fixture mudar de forma (cena nova, cena
 * removida), a lista acompanha — mas a lista de um golden ja capturado
 * permanece FIXA (o gate usa a gravada no indice; so extrai as que ela
 * nomeia). Uma fixture cujo total de frames encolher abaixo de um frame
 * gravado falha a extracao — o golden acende por ausencia.
 */
export function derivarFramesDoManifesto(manifesto: Manifesto): FrameEscolhido[] {
  const plano = planoDeComposicao(manifesto);
  const escolhidos: FrameEscolhido[] = [];
  const motivosPorFrame = new Map<number, string>();
  const marcar = (frame: number, motivo: string): void => {
    if (frame < 0 || frame >= plano.totalFrames) {
      throw new Error(
        `frame ${String(frame)} fora da composicao (totalFrames ${String(plano.totalFrames)})`,
      );
    }
    if (!motivosPorFrame.has(frame)) motivosPorFrame.set(frame, motivo);
  };

  marcar(0, "inicio do video — primeira moldura da cena 1");

  const porCena = new Map(
    plano.timeline.map((t) => [t.cenaId, { inicio: t.frameInicial, duracao: t.duracao }]),
  );
  for (let i = 1; i < plano.timeline.length; i++) {
    const cena = plano.timeline[i];
    if (cena === undefined) continue;
    marcar(
      cena.frameInicial,
      `primeira moldura da cena ${cena.cenaId} — fronteira de transicao com a cena anterior (interpolacao exercida)`,
    );
  }

  const nosPorCena = new Map<string, string[]>();
  for (const cena of manifesto.cenas) {
    nosPorCena.set(cena.id, cena.nos);
  }
  const meioDaCenaCom = (tipo: string): void => {
    for (const cena of manifesto.cenas) {
      const ids = nosPorCena.get(cena.id) ?? [];
      const tem = manifesto.nos.some(
        (n) => ids.includes(n.id) && (n as { type?: string }).type === tipo,
      );
      if (tem) {
        const janela = porCena.get(cena.id);
        if (janela !== undefined) {
          marcar(
            janela.inicio + Math.floor(janela.duracao / 2),
            `meio da cena ${cena.id} — cena representativa (contem no tipo "${tipo}")`,
          );
        }
        return;
      }
    }
  };
  meioDaCenaCom("grafico");
  meioDaCenaCom("codigo");

  marcar(plano.totalFrames - 1, "ultima moldura do video (fim)");

  return [...motivosPorFrame.entries()]
    .map(([frame, motivo]) => ({ frame, motivo }))
    .sort((a, b) => a.frame - b.frame);
}

/** Padding do nome do arquivo de frame (4 digitos para < 10k frames). */
export function nomeDoFrame(frame: number, totalFrames: number): string {
  const digitos = Math.max(4, String(totalFrames - 1).length);
  return `frame-${String(frame).padStart(digitos, "0")}.png`;
}

/** SHA-256 em hex de um buffer (a primitiva do indice). */
export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Envelope do audio: RMS por janela (100 ms) por canal, dos BYTES do master. */
export interface EnvelopeDoGolden {
  readonly schema_version: typeof FORMATO_DO_ENVELOPE;
  readonly rate: number;
  readonly canais: number;
  readonly janelaS: number;
  readonly duracaoS: number;
  readonly sha256DoMaster: string;
  /** Uma linha por janela; cada linha tem `canais` valores RMS (>= 0). */
  readonly janelas: readonly (readonly number[])[];
}

/**
 * A projecao do envelope — funcao PURA dos bytes do master.wav do mix.
 * Janela fixa de 100 ms: mudanca de ganho, de ducking ou dos bytes da
 * emenda muda o RMS por janela e o golden acende. Aritmetica exata em
 * f32 (o mesmo lerWavPcm do F3-05) — deterministica para os mesmos
 * bytes, com o mesmo node.
 */
export function calcularEnvelope(bytes: Buffer): EnvelopeDoGolden {
  const pcm = lerWavPcm(bytes);
  const janela = Math.max(1, Math.round(pcm.rate * JANELA_DO_ENVELOPE_S));
  const n = pcm.canais;
  const totalJanelas = Math.ceil(pcm.amostras.length / n / janela);
  const janelas: number[][] = [];
  for (let j = 0; j < totalJanelas; j++) {
    const acumulados = new Array<number>(n).fill(0);
    const inicio = j * janela * n;
    const fim = Math.min(pcm.amostras.length, inicio + janela * n);
    for (let i = inicio; i < fim; i++) {
      const amostra = pcm.amostras[i] ?? 0;
      const indice = i % n;
      acumulados[indice] = (acumulados[indice] ?? 0) + amostra * amostra;
    }
    let contagem = Math.floor((fim - inicio) / n);
    if (contagem < 1) contagem = 1;
    janelas.push(acumulados.map((soma) => Math.sqrt(soma / contagem)));
  }
  return {
    schema_version: FORMATO_DO_ENVELOPE,
    rate: pcm.rate,
    canais: pcm.canais,
    janelaS: JANELA_DO_ENVELOPE_S,
    duracaoS: pcm.amostras.length / pcm.canais / pcm.rate,
    sha256DoMaster: sha256Hex(bytes),
    janelas,
  };
}

export interface ExecutorDeFfmpeg {
  (args: readonly string[]): Promise<{ stdout: string; stderr: string }>;
}

/**
 * Extrai um frame-chave do master.mov (QTRLE lossless) como PNG —
 * determinismo verificado no proprio card: duas extracoes do mesmo
 * frame com o mesmo ffmpeg pinado produzem bytes identicos (o encoder
 * de PNG do ffmpeg 6.1.1-3ubuntu5 nao grava metadado volatil).
 */
export async function extrairFramePng(
  executor: ExecutorDeFfmpeg,
  masterMov: string,
  frame: number,
): Promise<Buffer> {
  const saida = join("/tmp", `gm-frame-${process.pid}-${frame}.png`);
  await executor([
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", masterMov,
    "-vf", `select=eq(n\\,${String(frame)})`,
    "-vframes", "1",
    "-f", "image2",
    "-fflags", "+bitexact", "-flags", "+bitexact", "-map_metadata", "-1",
    saida,
  ]);
  const bytes = await readFile(saida);
  if (bytes.length === 0) {
    throw new Error(`extracao do frame ${String(frame)} nao escreveu bytes (C1)`);
  }
  return bytes;
}

/** Os arquivos de texto que o golden cobre, na ordem do indice. */
export const ARQUIVOS_MANIFESTOS: readonly string[] = [
  "manifesto-resolvido.json",
  "mix-documento.json",
  "pos-documento.json",
  "relatorio-final.json",
];

/**
 * EXTRAI os itens do golden de um diretorio de saida de uma execucao do
 * pipeline (`--saida <dir>`): os 4 manifestos, os frames-chave e o
 * envelope. Devolve caminho relativo (o mesmo do indice) -> bytes.
 * FALHA se um arquivo de entrada nao existir — ausencia e VERMELHO
 * (∅-crit por presenca, nunca "nada a comparar").
 */
export async function extrairItens(
  executor: ExecutorDeFfmpeg,
  saida: string,
  frames: readonly FrameEscolhido[],
  totalFrames: number,
): Promise<Map<string, Buffer>> {
  const itens = new Map<string, Buffer>();
  for (const nome of ARQUIVOS_MANIFESTOS) {
    const bytes = await readFile(join(saida, nome));
    itens.set(`manifestos/${nome}`, bytes);
  }
  const masterMov = join(saida, "master.mov");
  const masterWav = join(saida, "master.wav");
  for (const f of frames) {
    const png = await extrairFramePng(executor, masterMov, f.frame);
    itens.set(`frames/${nomeDoFrame(f.frame, totalFrames)}`, png);
  }
  const wav = await readFile(masterWav);
  itens.set(
    "audio/envelope.json",
    Buffer.from(JSON.stringify(calcularEnvelope(wav), null, 2), "utf-8"),
  );
  return itens;
}

/** Hasheia os itens na forma do indice (ordenados pelo nome). */
export function itensParaIndice(itens: Map<string, Buffer>): ItemDoIndice[] {
  return [...itens.keys()]
    .sort()
    .map((arquivo) => ({
      arquivo,
      sha256: sha256Hex(itens.get(arquivo) as Buffer),
      tamanho: (itens.get(arquivo) as Buffer).length,
    }));
}

/**
 * A chave C7 recomputada FORA do pipeline — o MESMO calculo do F5-09
 * (calcularChaveC7): os bytes do manifesto resolvido, os bytes do
 * grafico da fixture (a unica camada de asset do render — o mesmo
 * arquivo que o estagio de render embute na chave, AB-501), o agregado
 * de tokens real (importado por leitura) e as versoes/pins da maquina.
 */
export function chaveC7DaCaptura(
  raiz: string,
  manifestoResolvidoBytes: Buffer,
): { chave: string; componentes: ComponentesDaChaveC7 } {
  const grafico = readFileSync(join(raiz, "fixtures", "canonico", "assets", "grafico-integrado.png"));
  const assets = new Map<string, Buffer>([[sha256Hex(grafico), grafico]]);
  const entradas = {
    manifestoResolvido: manifestoResolvidoBytes,
    assets,
    versoes: lerVersoesDaPilha(),
    pinFerramentas: lerPinDeFerramentas(),
  };
  return {
    chave: calcularChaveC7(entradas),
    componentes: componentesDaChaveC7(entradas),
  };
}

/** Escreve um arquivo do golden (criando os diretorios do caminho). */
export async function escreverItem(
  raizDoGolden: string,
  arquivo: string,
  bytes: Buffer,
): Promise<void> {
  const caminho = join(raizDoGolden, arquivo);
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, bytes);
}

/** Executor real do ffmpeg pinado (o mesmo do pipeline, 6.1.1). */
export const executorDoFfmpeg: ExecutorDeFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout: 120_000, maxBuffer: 64 * 1024 * 1024 }, (erro, stdout, stderr) => {
      if (erro) {
        reject(new Error(`ffmpeg ${args.join(" ")}\n${String(erro)}\n${String(stderr)}`));
        return;
      }
      resolve({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/** Plano da composicao da fixture canonica (para nomes de frame). */
export function planoDaFixture(raiz: string): PlanoDeComposicao {
  const manifesto = JSON.parse(
    readFileSync(join(raiz, "fixtures", "canonico", "manifesto-valido.json"), "utf-8"),
  ) as Manifesto;
  return planoDeComposicao(manifesto);
}
