/**
 * src/roteiro/anexo/anexo.ts
 *
 * ANEXO DO USUARIO (gif/video) — o irmao simetrico da narracao gravada
 * (src/roteiro/narracao/narracao.ts): o navegador envia os bytes crus do
 * arquivo (gif ou video — gravacao de tela, reacao), o servidor chama
 * `receberAnexo`, que valida tipo (allowlist VOCABULARIO_TIPO_ANEXO) e
 * tamanho (ANEXO_TAMANHO_MAXIMO_BYTES), calcula o SHA-256 dos bytes e os
 * grava no store enderecado por conteudo (S-8) com procedencia — mesmo
 * conteudo 2x = mesmo hash e UMA entrada (FQ-N1, put idempotente).
 *
 * O que este modulo NAO e:
 *   - nao e a rota HTTP (Onda 5): o servidor chama `receberAnexo` e
 *     atualiza o par `anexo_hash` + `anexo_meta` do Pedaco — este modulo
 *     nao conhece pedacos;
 *   - nao decide o TIPO VISUAL: o upload NUNCA toca `tipo_visual` — o
 *     fluxo e "upload primeiro, tipo depois" (api.md §anexo): o anexo e
 *     o asset do usuario; a decisao de usa-lo (gif/video) e do PATCH;
 *   - nao remove bytes: o DELETE da rota remove SO o par do pedaco; os
 *     bytes permanecem no store (append-only por hash, S-8).
 *
 * Fronteira de impureza: so o store (S-8, local). `relogio` injetavel
 * para o determinismo da procedencia nos testes — o mesmo padrao da
 * narracao.
 */

import { ANEXO_TAMANHO_MAXIMO_BYTES, VOCABULARIO_TIPO_ANEXO } from "../contrato/contrato.js";
import type { AnexoMeta, TipoAnexo } from "../contrato/contrato.js";
import { eTipoAnexo } from "../contrato/validar.js";
import { Store } from "../../store/store.js";
import { procedenciaDoAnexo } from "./procedencia.js";

// ─── Versao ────────────────────────────────────────────────────────────────────

/** Versao do modulo de anexo — entra no toolVersion da procedencia. */
export const VERSAO_MODULO_ANEXO = "1.0.0" as const;

// ─── Erros nomeados ────────────────────────────────────────────────────────────

/**
 * O Content-Type do upload esta fora da allowlist fechada
 * (image/gif | video/mp4 | video/webm — VOCABULARIO_TIPO_ANEXO). Regra
 * anexo-tipo-permitido do contrato (validar.ts); o servidor mapeia 400.
 */
export class ErroTipoAnexoInvalido extends Error {
  readonly code = "ANEXO_TIPO_INVALIDO";
  constructor(tipo: string) {
    super(
      `tipo de anexo "${tipo}" fora da allowlist ` +
        `(${VOCABULARIO_TIPO_ANEXO.join(" | ")}) — regra anexo-tipo-permitido`,
    );
    this.name = "ErroTipoAnexoInvalido";
  }
}

/**
 * O upload excede ANEXO_TAMANHO_MAXIMO_BYTES (200 MB — regra
 * anexo-tamanho-limite do contrato). O teto e de dominio; a rota HTTP
 * tambem tem um teto proprio de buffer, acima do qual nem le o corpo.
 */
export class ErroTamanhoAnexoExcedido extends Error {
  readonly code = "ANEXO_TAMANHO_EXCEDIDO";
  constructor(tamanho: number) {
    super(
      `anexo de ${tamanho} bytes excede o limite de ` +
        `${ANEXO_TAMANHO_MAXIMO_BYTES} (ANEXO_TAMANHO_MAXIMO_BYTES) — ` +
        `regra anexo-tamanho-limite`,
    );
    this.name = "ErroTamanhoAnexoExcedido";
  }
}

/** O corpo do PUT veio vazio — nada foi enviado pelo navegador. */
export class ErroAnexoVazio extends Error {
  readonly code = "ANEXO_VAZIO";
  constructor(detalhe = "anexo vazio: o corpo do envio nao pode ser vazio") {
    super(detalhe);
    this.name = "ErroAnexoVazio";
  }
}

// ─── Validadores (API publica) ─────────────────────────────────────────────────

/**
 * Valida o tipo MIME do anexo contra a allowlist fechada e o devolve
 * estreitado para TipoAnexo.
 *
 * @throws ErroTipoAnexoInvalido se fora de VOCABULARIO_TIPO_ANEXO.
 */
export function validarTipoAnexo(tipo: string): TipoAnexo {
  if (!eTipoAnexo(tipo)) {
    throw new ErroTipoAnexoInvalido(tipo);
  }
  return tipo;
}

/**
 * Valida o tamanho do anexo contra ANEXO_TAMANHO_MAXIMO_BYTES (a
 * constante do contrato — fonte unica, nunca redigitada).
 *
 * @throws ErroTamanhoAnexoExcedido se tamanho > ANEXO_TAMANHO_MAXIMO_BYTES.
 */
export function validarTamanhoAnexo(tamanho: number): void {
  if (tamanho > ANEXO_TAMANHO_MAXIMO_BYTES) {
    throw new ErroTamanhoAnexoExcedido(tamanho);
  }
}

// ─── Tipos da API ──────────────────────────────────────────────────────────────

/** Metadado que o navegador/servidor conhece sobre o anexo enviado. */
export interface MetaDoAnexo {
  /** Nome original do arquivo (exibicao na UI — como AnexoMeta). */
  readonly nome_original?: string;
  /** MIME declarado pelo navegador (a allowlist do contrato). */
  readonly tipo: string;
}

/** Opcoes de receberAnexo — o que e impuro entra injetado. */
export interface OpcoesDeAnexo {
  /** O store onde os bytes entram (S-8, append-only por hash). Obrigatorio. */
  readonly store: Store;
  /**
   * Relogio do `acquiredAt` da procedencia (default: Date real — o
   * servidor registra o momento real da aquisicao). Testes injetam
   * relogio fixo para o determinismo da procedencia.
   */
  readonly relogio?: () => Date;
}

/** O resultado de receberAnexo — o que o servidor grava no pedaco. */
export interface ResultadoDoAnexo {
  /** SHA-256 dos bytes — o `anexo_hash` do Pedaco (C7). */
  readonly hash_anexo: string;
  /** O metadado do anexo — o `anexo_meta` do Pedaco. */
  readonly anexo_meta: AnexoMeta;
}

// ─── O caminho principal ───────────────────────────────────────────────────────

/**
 * Recebe o anexo do usuario e devolve o par (hash, meta) para o pedaco.
 *
 * Fluxo (docs/roteiro/api.md — PUT anexo):
 *   1. valida o input (nao-vazio; tipo na allowlist; tamanho <= teto);
 *   2. calcula o sha256 dos bytes e grava no store com procedencia
 *      (S-8: put idempotente — mesmo conteudo 2x = mesmo hash, UMA
 *      entrada; FQ-N1);
 *   3. devolve {hash_anexo, anexo_meta} — o servidor grava o par no
 *      Pedaco SEM tocar `tipo_visual` (upload primeiro, tipo depois).
 *
 * @throws ErroAnexoVazio           corpo vazio
 * @throws ErroTipoAnexoInvalido    tipo fora da allowlist
 * @throws ErroTamanhoAnexoExcedido tamanho acima do teto do contrato
 */
export async function receberAnexo(
  bytes: Buffer,
  meta: MetaDoAnexo,
  opcoes: OpcoesDeAnexo,
): Promise<ResultadoDoAnexo> {
  if (bytes.length === 0) {
    throw new ErroAnexoVazio();
  }
  const tipo = validarTipoAnexo(meta.tipo);
  validarTamanhoAnexo(bytes.length);

  const procedencia = procedenciaDoAnexo({
    nomeOriginal: meta.nome_original,
    tipo,
    byteSize: bytes.length,
    relogio: opcoes.relogio ?? (() => new Date()),
    toolVersion: `anexo-${VERSAO_MODULO_ANEXO}`,
  });

  const { hash } = await opcoes.store.put(bytes, procedencia);
  return {
    hash_anexo: hash,
    anexo_meta: {
      tipo,
      tamanho_bytes: bytes.length,
      nome_original: meta.nome_original ?? "",
    },
  };
}
