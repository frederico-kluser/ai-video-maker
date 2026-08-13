/**
 * Perfil de entrega em SOFTWARE — libx264, eixo CRF.
 *
 * Descoberto por convencao (Regra 6): src/render/encode/perfis/<nome>.ts
 * com `export default`. Nome do arquivo = nome do perfil.
 *
 * DETERMINISMO (declaracao da emenda, contrato-w7 §6): `true` — medido
 * nesta maquina (ffmpeg 6.1.1-3ubuntu5): o mesmo comando, duas execucoes,
 * bytes do arquivo IDENTICOS (md5 igual) com os tres flags canonicos
 * depois das entradas (ffmpeg-media-ops, NV-5/R10-25/R11-11). O gate
 * `encode-perfis` testa a declaracao ao vivo: 2x encodes = bytes
 * identicos, nesta cadeia pinada. Bump de versao do ffmpeg invalida a
 * declaracao — ver ledger AB-703.
 *
 * ALVO DE QUALIDADE: CRF 18 — o valor de entrega classico do x264
 * (qualidade visual alta com tamanho razoavel). Eixo: CRF existe SOMENTE
 * em encoder de software; nenhum numero de CRF se compara a nenhum
 * numero de CQ de hardware (pergunta adversarial 1).
 */

import type { PerfilEncode } from "../formato.js";

const perfil: PerfilEncode = {
  nome: "entrega-software",
  motor: "libx264",
  codec: "libx264",
  deterministico: true,
  justificativaDeterminismo:
    "medido em ffmpeg 6.1.1-3ubuntu5: 2x execucoes do mesmo comando (com -fflags +bitexact -flags +bitexact -map_metadata -1 apos as entradas) produzem bytes de arquivo identicos (md5 igual); x264 nao tem modo nao-deterministico ligado por default (R11-12); vale para a cadeia pinada — bump de ffmpeg invalida (AB-703)",
  alvoQualidade: { tipo: "crf", valor: 18 },
  preset: "medium",
  pixFmt: "yuv420p",
  argsExtra: [],
};

export default perfil;
