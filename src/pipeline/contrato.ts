/**
 * src/pipeline/contrato.ts
 *
 * O CONTRATO DO ORQUESTRADOR DE PONTA A PONTA — card F5-07 (W9, o join).
 *
 * A LISTA FECHADA E NOMEADA de artefatos do estrito (contrato-w9 §2, C1).
 * Ela vive neste arquivo como UMA unica constante nomeada e e lida pelo
 * ∅-crit por LEITURA — o teste nunca a reescreve e nunca digita um nome
 * de artefato a mao (contrato-w9 §2, AB-790).
 *
 * Esta e a UNICA lista fechada deste diff (contrato-w9 §12): nenhuma
 * assercao de modulo, estagio ou faixa e fechada em lugar nenhum — os
 * testes asserem PRESENCA per-item.
 */

/** Formato do relatorio-final do pipeline (artefato 11, contrato-w9 §2). */
export const FORMATO_RELATORIO_FINAL = "RelatorioFinal.1" as const;

/** Um item da lista fechada: nome (o que o ∅-crit imprime) + arquivos. */
export interface ArtefatoEsperado {
  /** Nome do artefato — o identificador que o ∅-crit nomeia. */
  readonly nome: string;
  /** Arquivos no diretorio de saida que materializam o artefato. */
  readonly arquivos: readonly string[];
  /** Identidade do artefato (formato/documento que ele declara). */
  readonly identidade: string;
}

/**
 * A LISTA FECHADA do contrato-w9 §2 — os 11 artefatos de entrega do
 * `just produzir --fixture canonico --estrito`. O ∅-crit itera ESTA
 * constante; remover, renomear ou corromper qualquer um dos arquivos
 * tem de deixar o gate VERMELHO nomeando o artefato.
 *
 * Nunca reescrever esta lista "para arrumar": mudanca de contrato e
 * PREP + ADR, nunca edicao do gate.
 */
export const ARTEFATOS_ESPERADOS_DO_ESTRITO: readonly ArtefatoEsperado[] =
  Object.freeze([
    {
      nome: "manifesto-resolvido.json",
      arquivos: ["manifesto-resolvido.json"],
      identidade:
        "ManifestoResolvido.1 (schema ManifestoResolvido.1) — F2-01..F2-07",
    },
    {
      nome: "master-de-video-deterministico",
      arquivos: ["master.mov"],
      identidade:
        "QTRLE (.mov qtrle/argb) — codec deterministico de CODIFICADORES_DA_COMPARACAO (F5-01, ADR-0035); frames por indice ABSOLUTO (AB-691)",
    },
    {
      nome: "master-de-audio-do-mix",
      arquivos: ["master.wav", "mix-documento.json"],
      identidade:
        "MixDocument.1 (ADR-0034) + bytes WAV f32le do master, com MixDocument.ferramentas (pins) — F3-05",
    },
    {
      nome: "entregavel.m4a",
      arquivos: ["entregavel.m4a"],
      identidade:
        "AAC 192 kbps 48 kHz estereo, -23.0 LUFS, teto -1.0 dBTP conferido no CODIFICADO (ADR-0040) — F5-03",
    },
    {
      nome: "entregavel.srt",
      arquivos: ["entregavel.srt"],
      identidade:
        "serializado do MESMO LegendasCanonicas.1 (ADR-0027, ADR-0040) — F5-03",
    },
    {
      nome: "pos-documento.json",
      arquivos: ["pos-documento.json"],
      identidade:
        "PosDocument.1 (alvo, ganho, medicoes, hashes, pins — PosDocument.1.ferramentas) — F5-03",
    },
    {
      nome: "variante-16x9.json",
      arquivos: ["variante-16x9.json"],
      identidade:
        "unica variante do estrito (16:9, AB-720..722) — derivada do mesmo manifesto (pintor promovido, AB-493) — F5-04",
    },
    {
      nome: "thumbnail.png",
      arquivos: ["thumbnail.png"],
      identidade:
        "do mesmo manifesto, com contraste e piso de legibilidade (F5-05)",
    },
    {
      nome: "relatorio-procedencia.json",
      arquivos: ["relatorio-procedencia.json"],
      identidade:
        "transitivo, origem declarada; semOrigem -> VERMELHO (F5-06)",
    },
    {
      nome: "entregavel-final.mp4",
      arquivos: ["entregavel-final.mp4"],
      identidade:
        "mp4 final muxado: video (perfil deterministico do pipeline) + audio (entregavel.m4a do pos) num so container (AB-776) — F5-07",
    },
    {
      nome: "relatorio-final.json",
      arquivos: ["relatorio-final.json"],
      identidade:
        "declaracao de sucesso com hash+tamanho de CADA artefato (1..10), escrita POR ULTIMO e atomica (tmp + rename, padrao S-8) — F5-07",
    },
  ]);

/** Entrada do relatorio-final: um artefato produzido, com hash + tamanho. */
export interface EntradaDoRelatorioFinal {
  /** Nome do artefato (da lista fechada). */
  readonly nome: string;
  /** Arquivos que o materializam, cada um com hash e tamanho. */
  readonly arquivos: ReadonlyArray<{
    readonly nome: string;
    readonly sha256: string;
    readonly tamanho: number;
  }>;
}

/** O relatorio-final — artefato 11, escrito por ultimo e atomicamente. */
export interface RelatorioFinal {
  readonly schema_version: typeof FORMATO_RELATORIO_FINAL;
  /** O que o pipeline produziu (fixture + modo). */
  readonly pipeline: { readonly fixture: string; readonly estrito: boolean };
  /** `true` somente depois de TODOS os artefatos 1..10 conferirem. */
  readonly sucesso: boolean;
  /** Os artefatos 1..10 com hash + tamanho de cada arquivo. */
  readonly artefatos: readonly EntradaDoRelatorioFinal[];
  /** A toolchain com que os artefatos foram produzidos (contrato-w9 §10). */
  readonly ferramentas: { readonly ffmpeg: string; readonly node: string };
  /** Data fixa (determinismo — nunca o relogio de parede). */
  readonly escritoEm: string;
}
