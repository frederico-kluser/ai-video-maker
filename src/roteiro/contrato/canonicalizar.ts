/**
 * src/roteiro/contrato/canonicalizar.ts
 *
 * Canonicalizacao JSON para a chave de cache do gerador de roteiro.
 *
 * Espelho de src/autoria/contrato/canonicalizar.ts (a mesma regra da
 * skill llm-authoring: canonicalizar com chaves ordenadas e compacto —
 * sem isso o hash muda sem o conteudo mudar). Fonte unica do dominio:
 * `resumoDePedacos` deriva daqui, entao a serializacao dos irmaos de um
 * pedaco e deterministica por construcao.
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

/**
 * O "resumo dos demais pedacos" de um PedidoRegenerarPedaco: os irmaos
 * serializados em JSON canonico. Deterministico por construcao — o mesmo
 * estado dos irmaos produz exatamente a mesma string, e qualquer mudanca
 * em qualquer irmao produz outra string (a chave do gerador muda, C12).
 * O SERVIDOR usa esta funcao ao montar o pedido; o gerador (Onda 2) usa
 * o valor como contexto do prompt.
 */
export function resumoDePedacos(pedacos: readonly unknown[]): string {
  return canonicalizar(pedacos);
}
