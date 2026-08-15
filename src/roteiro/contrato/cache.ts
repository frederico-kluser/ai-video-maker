/**
 * src/roteiro/contrato/cache.ts
 *
 * Chave de cache do gerador de roteiro — a parte do contrato que a
 * pergunta falsificavel FQ-C3 fecha: "bump de versao do contrato invalida
 * o cache (mesma entrada, chave diferente)".
 *
 * A chave e sha256(canonical_json(pedido)) — o pedido inteiro, que ja
 * carrega `versao_contrato`, `versao_contrato_gerador` e `versao_gerador`
 * (C12: tudo que muda a saida entra na chave; bump de qualquer versao =
 * MISS).
 *
 * Este modulo e PURA derivacao de chave (sem disco e sem rede): o store
 * do cache (ler/escrever, atomico S-8) e do gerador da Onda 2
 * (src/roteiro/gerador/**), que valida o pedido contra o schema e usa
 * esta chave como nome do arquivo — o mesmo contrato da autoria, onde o
 * contrato possui a mecanica e o provedor e injetado.
 */

import { createHash } from "node:crypto";
import { canonicalizar } from "./canonicalizar.js";
import type { EntradaGeradorRoteiro } from "./contrato.js";

/** sha256 da entrada canonicalizada — a chave do cache do gerador. */
export function chaveDeCacheGerador(entrada: EntradaGeradorRoteiro): string {
  return createHash("sha256").update(canonicalizar(entrada), "utf-8").digest("hex");
}
