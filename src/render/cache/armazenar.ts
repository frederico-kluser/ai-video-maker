// =============================================================================
// O ARMAZEM DE BYTES DO CACHE — frames por indice absoluto em disco
// =============================================================================
//
// O cache de bytes de frame: um diretorio por CHAVE C7, frames por
// indice ABSOLUTO (AB-691), escrita atomica (tmp + rename — o mesmo
// padrao do store de F0-07). Estrutura:
//
//   <raiz>/<chaveC7>/<codec>/frame-<N>.png   (bytes do frame N)
//   <raiz>/<chaveC7>/<codec>/meta.json        (componentes da chave —
//                                              diagnostico SEM data)
//
// O codec e um nivel do caminho, NAO da chave: o mesmo conteudo em
// codecs diferentes produz bytes diferentes e diretorios diferentes —
// nunca colidem. Antes de gravar ou ler, a fronteira de
// `delimitacao.ts` recusa codec fora de `CODIFICADORES_DA_COMPARACAO`
// (png/qtrle somente; vp9/webm e mp4/h264 excluidos com o motivo).
//
// Teto de disco: ADR-0032 decisao 4 — saidas em /tmp (fora do
// filesystem do repo), `df /home` com >= 10 GiB livres antes de lotes
// de render, limpeza pos-render. A raiz default e em /tmp; o gate do
// card roda a sonda de disco antes de qualquer lote.
//
// NENHUMA data participa: nem no caminho, nem no meta.json, nem na
// decisao de acerto. Acertar = chave C7 igual + frame presente. Tocar
// um arquivo sem mudar conteudo nao muda a chave (por data e falso
// verde — ADR-0041, decisao 2).
// =============================================================================

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ComponentesDaChaveC7 } from "./chave";
import { permitidoCacheDeBytesDoCodec } from "./delimitacao";
import { ErroDeNomeDeFrame, extrairIndiceDoFrame } from "./frames";

/** A raiz default do cache — em /tmp, fora do filesystem do repo (ADR-0032 d.4). */
export const RAIZ_DEFAULT_DO_CACHE = join(tmpdir(), "ai-video-maker", "render-cache");

/** O meta do cache — diagnostico do POR QUE a chave existe, sem data. */
export interface MetaDoCache {
  readonly formato: "render-cache-meta-v1";
  readonly chave: string;
  readonly codec: string;
  readonly componentes: ComponentesDaChaveC7;
  /** Total de frames esperado — o render que NAO entrega todos acusa. */
  readonly totalFrames: number;
}

/** Opcoes do armazem. */
export interface OpcoesDoArmazem {
  /** Raiz do cache em disco (default: /tmp/ai-video-maker/render-cache). */
  readonly raiz?: string;
  /** A chave C7 (conteudo) — um diretorio por chave. */
  readonly chave: string;
  /** O codec dos bytes (png | qtrle) — a fronteira recusa os demais. */
  readonly codec: string;
}

/**
 * O armazem de bytes de um render cacheado, indexado por frame ABSOLUTO.
 *
 * O construtor JA aplica a fronteira de codec: um cache de bytes para
 * codec fora de `CODIFICADORES_DA_COMPARACAO` nao existe — a exclusao e
 * dita em voz alta, com o motivo (AB-396/397, ADR-0035).
 */
export class ArmazemDeCache {
  readonly raiz: string;
  readonly chave: string;
  readonly codec: string;
  /** O diretorio dos frames: <raiz>/<chave>/<codec>/frames. */
  readonly dirDosFrames: string;

  constructor(opcoes: OpcoesDoArmazem) {
    permitidoCacheDeBytesDoCodec(opcoes.codec);
    this.raiz = opcoes.raiz ?? RAIZ_DEFAULT_DO_CACHE;
    this.chave = opcoes.chave;
    this.codec = opcoes.codec;
    this.dirDosFrames = join(this.raiz, opcoes.chave, opcoes.codec, "frames");
  }

  /** Caminho do arquivo do frame na chave deste armazem. */
  caminhoDoFrame(indice: number): string {
    return join(this.dirDosFrames, `frame-${String(indice)}.png`);
  }

  /**
   * Os indices ABSOLUTOS presentes nesta chave. Um nome que nao casa o
   * pattern de frame PROPAGA ErroDeNomeDeFrame — o cache nunca ignora
   * um arquivo estranho em silencio (verde vira vermelho, nunca compara
   * errado).
   */
  indicesPresentes(): Set<number> {
    const indices = new Set<number>();
    if (!existsSync(this.dirDosFrames)) {
      return indices;
    }
    for (const nome of readdirSync(this.dirDosFrames)) {
      if (!nome.endsWith(".png")) {
        continue;
      }
      indices.add(extrairIndiceDoFrame(nome));
    }
    return indices;
  }

  /** `true` quando TODOS os frames [0, totalFrames) estao presentes. */
  temTodos(totalFrames: number): boolean {
    if (!Number.isInteger(totalFrames) || totalFrames < 1) {
      return false;
    }
    const presentes = this.indicesPresentes();
    for (let f = 0; f < totalFrames; f++) {
      if (!presentes.has(f)) {
        return false;
      }
    }
    return true;
  }

  /** Le os bytes do frame, ou `null` quando ausente (nunca lanca). */
  ler(indice: number): Buffer | null {
    const caminho = this.caminhoDoFrame(indice);
    try {
      return readFileSync(caminho);
    } catch {
      return null;
    }
  }

  /**
   * Grava os bytes do frame — escrita atomica (tmp + rename): um leitor
   * concorrente nunca ve arquivo parcial.
   */
  gravar(indice: number, bytes: Buffer): void {
    mkdirSync(this.dirDosFrames, { recursive: true });
    const caminho = this.caminhoDoFrame(indice);
    const temporario = `${caminho}.tmp-${process.pid}`;
    writeFileSync(temporario, bytes);
    renameSync(temporario, caminho);
  }

  /** O meta.json do cache (diagnostico), ou `null` quando ausente. */
  meta(): MetaDoCache | null {
    const caminho = join(this.raiz, this.chave, this.codec, "meta.json");
    try {
      const documento = JSON.parse(readFileSync(caminho, "utf8")) as MetaDoCache;
      return documento;
    } catch {
      return null;
    }
  }

  /** Grava o meta.json — atomico, como os frames. */
  gravarMeta(meta: MetaDoCache): void {
    const dir = join(this.raiz, this.chave, this.codec);
    mkdirSync(dir, { recursive: true });
    const caminho = join(dir, "meta.json");
    const temporario = `${caminho}.tmp-${process.pid}`;
    writeFileSync(temporario, JSON.stringify(meta, null, 2));
    renameSync(temporario, caminho);
  }

  /** Apaga os frames desta chave (a sonda de miss forcado do gate). */
  limpar(): void {
    rmSync(join(this.raiz, this.chave), { recursive: true, force: true });
  }
}
