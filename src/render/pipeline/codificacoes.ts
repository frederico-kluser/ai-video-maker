// =============================================================================
// DELIMITACAO DA COMPARACAO BYTE A BYTE — contrato-w7 §6 (emenda de F5-01)
// =============================================================================
//
// O ∅-crit do card — "render por faixa de frames + concatenacao tem de bater
// byte a byte com o render inteiro" — vale SOMENTE onde o encoder e
// deterministico. A delimitacao e DECLARADA aqui, com o motivo ao lado de
// cada codec: uma exclusao silenciosa seria um oraculo falso verde.
//
//   png    — codificacao intra-frame lossless, sem metadado de container:
//            bytes iguais por frame entre o render por faixa e o render
//            inteiro provam a propriedade que o card persegue.
//   qtrle  — o codec deterministico do cassete de grafico (F2-02):
//            .mov qtrle/argb, lossless e intra-only — a mesma classe de
//            determinismo do PNG para a ponte F2-02/F5-01.
//   vp9    — EXCLUIDO por declaracao (AB-396: vp9 nao-determinista; AB-397:
//            vp9 sai yuv420p sem alfa): comparar bytes de vp9 e medir
//            ruido do encoder, nao regressao da composicao.
//   mp4    — EXCLUIDO por declaracao (AB-396/AB-397: o encoder muda — versao,
//            parametros, metadado — e a comparacao byte a byte contra o
//            render inteiro e falso oraculo; o destino e o cartucho F2-02).
//
// O pipeline CHAMA `garantirCodecComparavel` antes de comparar qualquer
// byte: um codec sem declaracao (ou declarado excluido) PARA, nunca
// compara em silencio.
// =============================================================================

/** Estado declarado de um codec na delimitacao da comparacao. */
export interface DeclaracaoDeCodec {
  /** `true` = a comparacao byte a byte vale; `false` = excluido. */
  readonly permitido: boolean;
  /** O motivo da declaracao — obrigatorio, nunca silencioso. */
  readonly motivo: string;
}

/**
 * A delimitacao, por codec. Um codec que NAO consta aqui nao existe para a
 * comparacao: `garantirCodecComparavel` recusa com o motivo da ausencia.
 *
 * A chave de cada entrada e o nome do codec/container como o pipeline o
 * nomeia (a chave faz parte do contrato: o comparador e os testes citam as
 * MESMAS chaves).
 */
export const CODIFICADORES_DA_COMPARACAO: Readonly<Record<string, DeclaracaoDeCodec>> =
  Object.freeze({
    png: {
      permitido: true,
      motivo:
        "PNG: codificacao intra-frame lossless sem metadado de container — " +
        "a comparacao byte a byte (faixa == inteiro) vale onde o encoder e " +
        "deterministico (contrato-w7 §6)",
    },
    qtrle: {
      permitido: true,
      motivo:
        "QTRLE: codec deterministico do cassete de grafico (F2-02) — .mov " +
        "qtrle/argb, lossless e intra-only: comparacao byte a byte valida",
    },
    "vp9/webm": {
      permitido: false,
      motivo:
        "AB-396: vp9 nao-determinista; AB-397: vp9 sai yuv420p sem alfa — " +
        "comparacao byte a byte e oraculo falso, EXCLUIDA por declaracao",
    },
    "mp4/h264": {
      permitido: false,
      motivo:
        "AB-396/AB-397: o encoder muda (versao, parametros, metadado) — " +
        "comparacao byte a byte contra o render inteiro e falso oraculo " +
        "(destino do cartucho F2-02), EXCLUIDA por declaracao",
    },
  });

/** Erro do comparador: codec fora da delimitacao (ausente ou excluido). */
export class ErroDeCodecIncomparavel extends Error {
  readonly code = "CODEC_INCOMPARAVEL";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeCodecIncomparavel";
  }
}

/**
 * A guarda que o comparador chama antes de comparar bytes.
 *
 * @throws ErroDeCodecIncomparavel se o codec nao estiver declarado ou
 *   estiver declarado como excluido — a exclusao e dita em voz alta, com o
 *   motivo do ADR/AB, nunca silenciosa.
 */
export function garantirCodecComparavel(codec: string): void {
  const declaracao = CODIFICADORES_DA_COMPARACAO[codec];
  if (declaracao === undefined) {
    throw new ErroDeCodecIncomparavel(
      `codec "${codec}" sem declaracao na delimitacao da comparacao byte a ` +
        "byte (declarados: " +
        `${Object.keys(CODIFICADORES_DA_COMPARACAO).join(", ")}) — comparar ` +
        "bytes com um codec nao declarado e falso oraculo",
    );
  }
  if (!declaracao.permitido) {
    throw new ErroDeCodecIncomparavel(
      `codec "${codec}" EXCLUIDO da comparacao byte a byte: ${declaracao.motivo}`,
    );
  }
}
