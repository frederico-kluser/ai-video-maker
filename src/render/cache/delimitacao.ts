// =============================================================================
// A FRONTEIRA DO CACHE DE BYTES — onde o byte a byte vale (F5-09, ADR-0041)
// =============================================================================
//
// ADR-0041, decisoes 3 e 4: o cache de BYTES de frame so existe onde a
// comparacao byte a byte vale. A fronteira NAO e uma lista fechada deste
// card — e `CODIFICADORES_DA_COMPARACAO` de `src/render/pipeline/
// codificacoes.ts` (F5-01, W7), consumida POR LEITURA: se o pipeline
// declarar um codec novo como permitido, o cache o aceita sem tocar
// neste arquivo (contrato-w8 §7: presenca do SEU item, nunca lista
// completa de codecs cacheaveis).
//
//   1. Codec de frame: somente os declarados com `permitido: true`
//      (hoje png e qtrle). vp9/webm e mp4/h264 sao EXCLUIDOS por
//      declaracao, com o motivo (AB-396: vp9 nao-determinista; AB-397:
//      vp9 sai yuv420p sem alfa; MP4: encoder muda — ADR-0035) — a
//      exclusao e dita em voz alta, nunca silenciosa.
//   2. Perfil de encode: `deterministico: false` NUNCA vira cache de
//      bytes (NVENC — AB-700, ADR-0036 decisao 3): sem garantia de
//      determinismo, sem golden, sem cache de bytes do frame. Cache de
//      metadado/derivado pode existir; cache de BYTES do frame, nao.
//
// Quem pergunta a fronteira recebe o MOTIVO na resposta — um erro sem
// motivo seria o falso-verde de uma exclusao silenciosa.
// =============================================================================

import {
  CODIFICADORES_DA_COMPARACAO,
  ErroDeCodecIncomparavel,
  garantirCodecComparavel,
} from "../pipeline/codificacoes";
import type { PerfilEncode } from "../encode";

/** Erro da fronteira: o cache de bytes NAO vale para este codec/perfil. */
export class ErroDeCacheDeBytes extends Error {
  readonly code = "CACHE_DE_BYTES_EXCLUIDO";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeCacheDeBytes";
  }
}

/**
 * A fronteira do codec de frame: o cache de bytes so existe onde a
 * comparacao byte a byte vale — a MESMA delimitacao do pipeline (F5-01).
 *
 * A exclusao vem de `CODIFICADORES_DA_COMPARACAO`, com o motivo
 * declarado ao lado: `permitido: false` (vp9/webm, mp4/h264) ou codec
 * sem declaracao nenhuma — PARAM, nunca comparam nem cacheiam em
 * silencio. A guarda do pipeline lanca `ErroDeCodecIncomparavel` com o
 * motivo; este modulo traduz para `ErroDeCacheDeBytes` (o erro do
 * dominio do cache) SEM perder o motivo — quem consome a fronteira ve o
 * POR QUE, nunca um "nao" nu.
 *
 * @throws ErroDeCacheDeBytes com o motivo do ADR/AB quando o codec nao
 *   pode virar cache de bytes.
 */
export function permitidoCacheDeBytesDoCodec(codec: string): void {
  try {
    garantirCodecComparavel(codec);
  } catch (erro) {
    if (erro instanceof ErroDeCodecIncomparavel) {
      throw new ErroDeCacheDeBytes(
        `cache de bytes nao existe para o codec "${codec}": ${erro.message}`,
      );
    }
    throw erro;
  }
}

/**
 * A fronteira do perfil de encode: `deterministico: false` nunca vira
 * cache de bytes (ADR-0041, decisao 4). Uma amostra unica de bytes
 * identicos nao e garantia (AB-700) — sem garantia, sem golden, sem
 * cache de bytes do frame.
 *
 * @throws ErroDeCacheDeBytes com o motivo quando o perfil nao declara
 *   determinismo.
 */
export function permitidoCacheDeBytesDoPerfil(perfil: PerfilEncode): void {
  if (!perfil.deterministico) {
    throw new ErroDeCacheDeBytes(
      `perfil "${perfil.nome}" (${perfil.codec}) declara deterministico: false — ` +
        "o cache de BYTES de frame NAO existe para perfil nao-determinista " +
        "(ADR-0041 decisao 4, AB-700: uma amostra unica de bytes identicos nao e " +
        "garantia; cache de metadado/derivado pode existir, cache de bytes nao)",
    );
  }
}

/**
 * A propriedade aberta da fronteira (contrato-w8 §7): TODO codec que o
 * pipeline declara como permitido na comparacao byte a byte e cacheavel
 * em bytes por este card. A assercao e de PRESENCA da regra, nunca de
 * lista fechada — `CODIFICADORES_DA_COMPARACAO` pode crescer sem tocar
 * neste arquivo.
 */
export function codecsCacheaveisEmBytes(): string[] {
  return Object.entries(CODIFICADORES_DA_COMPARACAO)
    .filter(([, declaracao]) => declaracao.permitido)
    .map(([codec]) => codec)
    .sort();
}
