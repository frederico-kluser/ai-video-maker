// =============================================================================
// FRAMES POR INDICE ABSOLUTO — a unidade do cache (F5-09, ADR-0041 dec. 5)
// =============================================================================
//
// AB-691: o `renderFrames` do Remotion nomeia os frames pelo indice
// ABSOLUTO (`frame-[frame].png`); o pipeline do F5-01 fixa esse pattern
// (`imageSequencePattern: "frame-[frame].png"`). A unidade do cache
// herda isso: FRAME por indice absoluto, nunca a faixa — a faixa e
// particionamento de execucao e morre na mudanca de plano entre
// execucoes; o indice absoluto sobrevive a qualquer re-divisao.
//
// O parser extrai o indice do NOME (`frame-7.png` -> 7), robusto a
// padding entre faixas de tamanhos diferentes (`frame-007.png` -> 7,
// `frame-999.png` -> 999). Um nome que NAO casa o pattern e ERRO — se o
// Remotion mudar o naming, o cache acusa (verde vira vermelho), nunca
// compara errado em silencio (ADR-0041, decisao 5).
// =============================================================================

/** O pattern de nome dos frames — o MESMO fixado pelo pipeline (AB-691). */
export const PADRAO_DE_NOME_DE_FRAME = "frame-[frame].png";

/** A expressao do parser: prefixo, digitos (padding permitido), .png. */
const EXPRESSAO_DO_FRAME = /^frame-([0-9]+)\.png$/;

/** Erro de nome: o arquivo nao casa o pattern do frame — nunca em silencio. */
export class ErroDeNomeDeFrame extends Error {
  readonly code = "NOME_DE_FRAME_INVALIDO";
  constructor(nome: string) {
    super(
      `nome "${nome}" nao casa o pattern de frame "${PADRAO_DE_NOME_DE_FRAME}" ` +
        "(AB-691: indice absoluto extraido do nome) — nunca compara errado em " +
        "silencio; se o Remotion mudar o naming, o cache acusa",
    );
    this.name = "ErroDeNomeDeFrame";
  }
}

/** Erro de ausencia: o frame esperado nao foi entregue pelo render. */
export class ErroDeFrameAusente extends Error {
  readonly code = "FRAME_AUSENTE";
  constructor(indice: number) {
    super(
      `frame ${String(indice)} ausente — o render entregou menos frames do que ` +
        "a faixa pedia (nunca aceita render parcial)",
    );
    this.name = "ErroDeFrameAusente";
  }
}

/**
 * Extrai o indice ABSOLUTO do nome de um frame.
 *
 * @throws ErroDeNomeDeFrame para qualquer nome que nao casa o pattern.
 */
export function extrairIndiceDoFrame(nome: string): number {
  const casa = EXPRESSAO_DO_FRAME.exec(nome);
  if (casa === null) {
    throw new ErroDeNomeDeFrame(nome);
  }
  const digitos = casa[1]!;
  // Digits-only ja garante numero inteiro >= 0; o Number.parseInt so
  // poderia falhar em digitos absurdos (overflow) — e ai o parse e ERRO
  // tambem, nunca NaN silencioso.
  const indice = Number.parseInt(digitos, 10);
  if (!Number.isSafeInteger(indice)) {
    throw new ErroDeNomeDeFrame(nome);
  }
  return indice;
}
