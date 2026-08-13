/**
 * src/render/encode/golden.ts
 *
 * O GOLDEN DE BYTES — e a EMENDA DA W7 (contrato-w7 §6): goldens so
 * existem em perfis DETERMINISTICOS. Um perfil nao-determinista nunca
 * vira linha de base de bytes.
 *
 * A emenda existe porque a comparacao byte a byte de um encode e um
 * oraculo BOM quando o encode e reproduzivel e um oraculo FALSO quando
 * nao e: um golden gravado de um perfil nao-determinista pisca vermelho
 * por motivo irrelevante (a sessao do encoder mudou), e a reacao humana
 * a um gate que pisca a toa e desliga-lo — o pior desfecho
 * (video-characterization, "o limiar afrouxado e o mecanismo pelo qual
 * um oraculo morre").
 *
 * Este modulo nao decide ONDE o golden mora (fixtures/gm e do F5-07):
 * ele e a GUARDA — quem registrar um golden por bytes de um perfil
 * nao-deterministico recebe um erro nominal, e o teste da emenda exige
 * exatamente isso.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { PerfilEncode } from "./formato.js";

/** Golden recusado: o perfil nao e deterministico (emenda da W7, §6). */
export class EGoldenEmPerfilNaoDeterministico extends Error {
  readonly code = "ENCODE_GOLDEN_PERFIL_NAO_DETERMINISTICO";
  constructor(readonly perfil: PerfilEncode) {
    super(
      `golden de bytes recusado para o perfil "${perfil.nome}": o perfil declara ` +
        `deterministico: false — goldens so existem em perfis deterministicos ` +
        `(contrato-w7 §6, emenda F5-02)`,
    );
    this.name = "EGoldenEmPerfilNaoDeterministico";
  }
}

/** Verdadeiro quando o perfil pode ser linha de base de bytes. */
export function podeTerGolden(perfil: PerfilEncode): boolean {
  return perfil.deterministico === true;
}

export interface GoldenRegistrado {
  /** O nome do perfil que produziu os bytes. */
  perfil: string;
  /** SHA-256 dos bytes — a identidade do golden. */
  sha256: string;
  /** Tamanho em bytes. */
  tamanhoBytes: number;
}

/**
 * Registra o golden de bytes de um artefato produzido pelo perfil.
 *
 * Lanca `EGoldenEmPerfilNaoDeterministico` quando o perfil declara
 * `deterministico: false` — a recusa e o ∅-crit da emenda, testada.
 */
export async function registrarGolden(
  perfil: PerfilEncode,
  caminhoDoArtefato: string,
): Promise<GoldenRegistrado> {
  if (!podeTerGolden(perfil)) {
    throw new EGoldenEmPerfilNaoDeterministico(perfil);
  }
  const bytes = await readFile(caminhoDoArtefato);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { perfil: perfil.nome, sha256, tamanhoBytes: bytes.length };
}
