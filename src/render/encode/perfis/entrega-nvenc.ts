/**
 * Perfil de entrega em HARDWARE — h264_nvenc, eixo CQ (VBR).
 *
 * Descoberto por convencao (Regra 6): src/render/encode/perfis/<nome>.ts
 * com `export default`. Nome do arquivo = nome do perfil.
 *
 * ALVO DE QUALIDADE: `-rc vbr -cq 23` — o "mais proximo de CRF" do
 * vocabulario NVENC, SEM ser equivalencia (ffmpeg-media-ops, matriz por
 * API): o NVENC NAO TEM CRF (placar 3-0); declarar `-crf` num encoder de
 * hardware nao aborta o comando — exit 0, aviso no log, rate control
 * default (o falso verde da troca de contrato de qualidade). O preset
 * p5 e o medido na maquina (I-03, docs/medicao/maquina.md M3).
 *
 * DETERMINISMO (declaracao da emenda, contrato-w7 §6): `false` — o
 * resultado do NVENC depende da sessao do encoder e do driver; nao ha
 * garantia de bytes identicos entre execucoes. Amostra unica em
 * 2026-08-13 (um segundo, 320x180) saiu identica, mas amostra nao e garantia —
 * ver ledger AB-700. Consequencia: este perfil NUNCA vira linha de base
 * de bytes (`golden.ts` recusa; o teste da emenda exige a recusa).
 */

import type { PerfilEncode } from "../formato.js";

const perfil: PerfilEncode = {
  nome: "entrega-nvenc",
  motor: "nvenc",
  codec: "h264_nvenc",
  deterministico: false,
  justificativaDeterminismo:
    "NVENC nao declara determinismo: o encode depende da sessao do encoder e do driver NVIDIA (AB-700/AB-981); uma amostra unica identica (2026-08-13, um segundo) nao garante bytes identicos entre execucoes — sem garantia, sem golden (contrato-w7 §6)",
  alvoQualidade: { tipo: "cq", valor: 23 },
  preset: "p5",
  pixFmt: "yuv420p",
  argsExtra: [],
};

export default perfil;
