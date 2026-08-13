/**
 * src/render/encode/escolher.ts
 *
 * A ESCOLHA DO MOTOR COM FALLBACK DECLARADO (pergunta adversarial 3 do
 * card: "o fallback de hardware para software e SILENCIOSO?")
 *
 * A resposta do card: nunca. O fallback e um objeto estruturado que
 * declara que aconteceu, por que aconteceu e o que foi trocado por o que —
 * e o executor o devolve no resultado e o loga em voz alta.
 *
 * ─── A troca NAO e pelo mesmo eixo ────────────────────────────────────────
 *
 * Quando o NVENC esta indisponivel, o perfil de hardware NAO pode ser
 * "reescrito" como software com o mesmo alvo: os eixos nao se comparam
 * (um nao tem CRF — pergunta adversarial 1). O que o fallback faz e
 * escolher, no catalogo, o perfil de software da MESMA FAMILIA DE CODEC
 * (h264_nvenc -> o libx264 de entrega) — uma troca de contrato de
 * qualidade DELIBERADA, declarada no resultado, nunca disfarçada de
 * mesma coisa.
 *
 * Se o catalogo nao tiver o perfil de software da familia, `escolherPerfil`
 * LANCA em vez de encodar com o perfil errado: um fallback sem destino e
 * um erro declarado, nao um encode silenciosamente diferente.
 */

import type { PerfilEncode } from "./formato.js";

/** A declaracao do fallback — a pergunta adversarial 3, respondida por tipo. */
export interface DeclaracaoDeFallback {
  /** true quando o motor solicitado foi substituido por outro. */
  ativo: boolean;
  /** O motivo do fallback (preenchido quando `ativo`). */
  motivo?: string;
  /** O nome do perfil solicitado que foi substituido (preenchido quando `ativo`). */
  solicitado?: string;
}

/** Fallback sem destino no catalogo — nunca encodar com o perfil errado. */
export class ESemPerfilDeFallback extends Error {
  readonly code = "ENCODE_SEM_PERFIL_DE_FALLBACK";
  constructor(
    readonly solicitado: PerfilEncode,
    readonly familia: string,
  ) {
    super(
      `fallback de hardware para software sem destino: perfil "${solicitado.nome}" ` +
        `(motor ${solicitado.motor}, codec ${solicitado.codec}) precisa de um perfil ` +
        `de software da familia "${familia}" no catalogo`,
    );
    this.name = "ESemPerfilDeFallback";
  }
}

export interface ResultadoEscolha {
  /** O perfil que de fato vai encodar (o solicitado ou o fallback). */
  perfil: PerfilEncode;
  /** A declaracao do fallback — `ativo: false` quando nao houve troca. */
  fallback: DeclaracaoDeFallback;
}

/**
 * A familia de codec de um perfil — o MESMO vocabulario para os dois
 * motores: libx264 e h264_nvenc sao da familia h264; libx265 e
 * hevc_nvenc, da familia h265. O fallback casa por familia: hardware
 * h264 so cai no software h264, nunca em h265.
 */
const MAPA_FAMILIA: Record<string, string> = {
  libx264: "h264",
  libx265: "h265",
  h264_nvenc: "h264",
  hevc_nvenc: "h265",
  av1_nvenc: "av1",
  libvpx: "vp8",
  "libvpx-vp9": "vp9",
};

/** A familia de codec de um perfil (h264, h265, av1, vp9...). */
export function familiaDeCodec(perfil: PerfilEncode): string {
  return MAPA_FAMILIA[perfil.codec] ?? perfil.codec;
}

/** Familia de codec que um perfil NVENC cobre (h264_nvenc -> h264). */
export function familiaDeCodecNvenc(codec: string): string {
  return codec.replace(/_nvenc$/, "");
}

/**
 * Escolhe o perfil efetivo a partir do solicitado e da disponibilidade.
 *
 * Regras:
 * - motor libx264: nunca ha fallback (software nao depende de hardware);
 * - motor nvenc com NVENC disponivel: sem fallback;
 * - motor nvenc SEM NVENC: fallback para o perfil de software da mesma
 *   familia de codec do catalogo, declarado no resultado. Sem destino no
 *   catalogo, lança `ESemPerfilDeFallback` — nunca silencioso.
 */
export function escolherPerfil(
  solicitado: PerfilEncode,
  disponibilidade: { nvenc: boolean },
  catalogo: readonly PerfilEncode[],
): ResultadoEscolha {
  if (solicitado.motor === "libx264") {
    return { perfil: solicitado, fallback: { ativo: false } };
  }
  if (disponibilidade.nvenc) {
    return { perfil: solicitado, fallback: { ativo: false } };
  }

  const familia = familiaDeCodec(solicitado);
  const destino = catalogo.find(
    (p) => p.motor === "libx264" && familiaDeCodec(p) === familia,
  );
  if (destino === undefined) {
    throw new ESemPerfilDeFallback(solicitado, familia);
  }

  return {
    perfil: destino,
    fallback: {
      ativo: true,
      motivo: `NVENC indisponivel — perfil "${solicitado.nome}" (${solicitado.codec}) ` +
        `substituido pelo perfil de software "${destino.nome}" (${destino.codec}) da ` +
        `mesma familia; os eixos de qualidade nao sao comparaveis (um nao tem CRF)`,
      solicitado: solicitado.nome,
    },
  };
}
