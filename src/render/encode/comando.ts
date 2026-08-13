/**
 * src/render/encode/comando.ts
 *
 * O CONSTRUTOR UNICO de linha de comando do encode (ADR-0036, decisao 1 e
 * decisao 4). Todo encode deste programa nasce aqui — flag de encoder nao
 * se espalha pelos cards, e perfil novo NAO pode nascer sem os flags de
 * reprodutibilidade.
 *
 * ─── Os tres flags canonicos, SEMPRE, e SEMPRE DEPOIS das entradas ──────
 *
 *   -fflags +bitexact -flags +bitexact -map_metadata -1
 *
 * Depois das entradas e a posicao que funciona: antes do -i eles configuram
 * o DEMUXER e o MP4 sai com TAG:encoder=Lavf... do mesmo jeito, exit 0, sem
 * aviso (NV-5, medido em 6.1.1). O que a posicao errada produz:
 *
 *   - metadado NAO-deterministico no arquivo (data, versao do encoder) —
 *     a pergunta adversarial 2 do card ("metadado nao-deterministico foi
 *     removido?") tem como oraculo `ffprobe -show_entries format_tags` no
 *     artefato, que tem de voltar VAZIO;
 *   - dois encodes da mesma entrada com bytes DIFERENTES — o falso verde
 *     que o gate de determinismo (2x bytes identicos) persegue.
 *
 * ─── O alvo de qualidade no eixo do motor ────────────────────────────────
 *
 *   libx264  ->  -crf N            (a flag so existe no software)
 *   nvenc    ->  -rc vbr -cq N     (qualidade constante em VBR — o mais
 *               proximo de CRF, sem ser equivalencia) ou
 *               -rc constqp -qp N  (QP fixo)
 *
 * O eixo ja e validado em `formato.ts` — aqui ele e apenas serializado. A
 * combinacao impossivel (crf num NVENC) nunca chega a este construtor: o
 * perfil invalido falha na validacao, antes do ffmpeg.
 */

import { EPerfilInvalido, validarPerfil, type PerfilEncode } from "./formato.js";

// ─── Flags canonicos de reprodutibilidade (ffmpeg-media-ops, NV-5) ───────────

/**
 * Os tres flags canonicos. O construtor os emite SEMPRE, em TODOS os
 * perfis (deterministicos ou nao) — remover metadado nao-deterministico
 * nao e opcao de perfil, e a posicao (depois das entradas) e parte do
 * contrato: quem os mover para antes do `-i` produz arquivo com metadado
 * e bytes instaveis, com exit 0 (falso verde, NV-5).
 */
export const FLAGS_BITEXACT: readonly string[] = [
  "-fflags",
  "+bitexact",
  "-flags",
  "+bitexact",
  "-map_metadata",
  "-1",
];

/** `-c:v` da saida (mp4 com h264 — o contêiner dos perfis de entrega). */
export const CONTAINER_SAIDA = "mp4";

/** Erro interno: perfil invalido tentou gerar comando (nao alcancavel por contrato). */
export class EComandoPerfilInvalido extends Error {
  readonly code = "ENCODE_COMANDO_PERFIL_INVALIDO";
  constructor(erros: string[]) {
    super(`comando de encode recusou perfil invalido:\n  - ${erros.join("\n  - ")}`);
    this.name = "EComandoPerfilInvalido";
  }
}

/**
 * Monta o argv completo do encode: ffmpeg + entradas + opcoes do perfil +
 * flags canonicos DEPOIS das entradas + saida.
 *
 * Lanca `EComandoPerfilInvalido` se o perfil nao passar em `validarPerfil`
 * — o construtor nunca gera comando de um perfil invalido (por exemplo,
 * um perfil que declare `crf` num motor de hardware: o `-crf` sobrando
 * NAO abortaria o ffmpeg — exit 0 e rate control default, o falso verde
 * da troca de contrato de qualidade).
 */
export function montarComando(
  perfil: PerfilEncode,
  entrada: string,
  saida: string,
): string[] {
  const erros = validarPerfil(perfil);
  if (erros.length > 0) {
    throw new EComandoPerfilInvalido(erros);
  }

  const argv: string[] = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"];
  argv.push("-i", entrada);
  argv.push("-c:v", perfil.codec);

  // Preset do encoder (medium..veryslow no x264; p1..p7 no NVENC).
  argv.push("-preset", perfil.preset);

  // Alvo de qualidade no eixo do motor — a pergunta adversarial 1: nunca
  // o mesmo numero nos dois eixos, nunca -crf no hardware.
  switch (perfil.alvoQualidade.tipo) {
    case "crf":
      argv.push("-crf", String(perfil.alvoQualidade.valor));
      break;
    case "cq":
      argv.push("-rc", "vbr", "-cq", String(perfil.alvoQualidade.valor));
      break;
    case "qp":
      argv.push("-rc", "constqp", "-qp", String(perfil.alvoQualidade.valor));
      break;
  }

  argv.push("-pix_fmt", perfil.pixFmt);
  argv.push(...perfil.argsExtra);

  // Os tres flags canonicos — SEMPRE depois das entradas (NV-5).
  argv.push(...FLAGS_BITEXACT);

  argv.push("-f", CONTAINER_SAIDA, saida);
  return argv;
}
