// =============================================================================
// SERIALIZACAO CANONICA — a forma estavel de hashear objetos (cache F5-09)
// =============================================================================
//
// A chave C7 do cache (ADR-0041, decisao 1) hasheia CONTEUDO: manifesto
// resolvido, bytes de assets, valores dos tokens consumidos, versoes de
// ferramenta. Hashear objetos JavaScript exige uma serializacao que NAO
// dependa de ordem de insercao — dois objetos com os mesmos pares chave
/// valor, montados em ordens diferentes, tem de produzir os MESMOS bytes.
//
// `JSON.stringify` preserva a ordem de insercao das chaves: serializar o
// mesmo conteudo em ordem diferente mudaria a chave — o falso-verde do
// card, so que pelo motivo errado (identidade de ordem, nao de conteudo).
// `serializarCanonico` ordena as chaves recursivamente.
//
// Funcao pura: mesmo valor de entrada, mesmos bytes de saida. Nenhum
// relogio, nenhum ambiente, nenhum estado global — por isso a chave que
// dela deriva e estavel entre processos e maquinas.
// =============================================================================

/** Valor serializavel na forma canonica — o subconjunto do JSON mais tipado. */
export type ValorSerializavel =
  | string
  | number
  | boolean
  | null
  | ValorSerializavel[]
  | { readonly [chave: string]: ValorSerializavel };

function ehObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Serializa um valor na forma canonica: chaves de objeto em ordem
 * lexicografica, recursivamente. Arrays preservam a ordem (a ordem de uma
 * lista e conteudo). `undefined` nao existe na forma canonica (vira null,
 * como no JSON) — valores indisponiveis NAO podem mudar a chave por
 * presenca/ausencia de campo.
 */
export function serializarCanonico(valor: unknown): string {
  if (valor === null) {
    return "null";
  }
  switch (typeof valor) {
    case "string":
      return JSON.stringify(valor);
    case "number":
      // O JSON nunca distingue -0 de 0; a chave tambem nao pode (C12:
      // dois renders do mesmo conteudo tem de acertar a mesma chave).
      return Object.is(valor, -0) ? "0" : JSON.stringify(valor);
    case "boolean":
      return valor ? "true" : "false";
    case "undefined":
      // Fora da forma canonica: normaliza para null (indisponivel NAO e
      // conteudo diferente de ausente).
      return "null";
    case "bigint":
      throw new TypeError(
        "serializarCanonico: bigint nao e serializavel — valores nao-JSON " +
          "nao podem entrar na chave C7 (falso-verde por tipo de valor)",
      );
    case "function":
    case "symbol":
      throw new TypeError(
        "serializarCanonico: " +
          `${typeof valor === "function" ? "funcao" : "symbol"} nao e ` +
          "serializavel — a chave C7 hasheia VALORES, nunca codigo",
      );
    case "object":
      break;
    default:
      throw new TypeError(`serializarCanonico: tipo inesperado ${typeof valor}`);
  }

  if (Array.isArray(valor)) {
    return `[${valor.map((item) => serializarCanonico(item)).join(",")}]`;
  }

  if (ehObjetoPlano(valor)) {
    const chaves = Object.keys(valor).sort();
    const pares = chaves.map(
      (chave) => `${JSON.stringify(chave)}:${serializarCanonico(valor[chave])}`,
    );
    return `{${pares.join(",")}}`;
  }

  // Buffer e o caso conhecido de objeto com toJSON — mas a chave NAO
  // hasheia Buffer: quem chama hasheia os BYTES antes (H(assets) re-hasha
  // bytes, nunca objetos). Chegar aqui com um Buffer e um bug de contrato.
  throw new TypeError(
    `serializarCanonico: objeto de classe "${(valor as { constructor?: { name?: string } }).constructor?.name ?? "desconhecida"}" — ` +
      "a chave C7 hasheia somente valores planos (json-plano). Hasheie os " +
      "bytes explicitamente antes de entrar na chave (H(assets): re-hash dos bytes)",
  );
}
