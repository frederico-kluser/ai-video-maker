/**
 * src/autoria/contrato/canonicalizar.ts
 *
 * Canonicalizacao JSON para a chave de cache da autoria.
 *
 * A skill llm-authoring manda canonicalizar com chaves ordenadas
 * (sort_keys=True / separators=(",",":")) — sem isso o hash muda sem o
 * conteudo mudar e, de quebra, o prompt cache e invalidado junto. Este
 * modulo implementa a mesma regra no lado TS: stringify com chaves
 * ordenadas recursivamente e compacto (sem espacos — o JSON.stringify
 * default ja usa separadores "," e ":").
 */

/** Ordena as chaves de objetos recursivamente e devolve o JSON canonico. */
export function canonicalizar(valor: unknown): string {
  return JSON.stringify(ordenar(valor));
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(ordenar);
  }
  if (valor !== null && typeof valor === "object") {
    const entrada = valor as Record<string, unknown>;
    const saida: Record<string, unknown> = {};
    for (const chave of Object.keys(entrada).sort()) {
      saida[chave] = ordenar(entrada[chave]);
    }
    return saida;
  }
  return valor;
}
