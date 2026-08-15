/**
 * src/web/ui/src/roteamento.ts
 *
 * Roteamento por HASH da SPA — DECISAO documentada (REPLAN Onda 6: zero
 * deps alem das do PREP; o servidor serve o index.html como fallback de
 * qualquer GET fora de /api/, entao o cliente nao precisa de rotas no
 * servidor — o hash nem chega a ele).
 *
 * Rotas:
 *   #/                    -> novo projeto
 *   #/projeto/<id>        -> projeto (roteiro, pedacos, juntar)
 *
 * Funcoes puras: parsearHash testa sem DOM; App.tsx so escuta o
 * hashchange e monta a tela.
 */

export type Rota = { nome: "novo-projeto" } | { nome: "projeto"; id: string };

/** Hash -> Rota. Hash desconhecido ou projeto sem id cai em novo-projeto. */
export function parsearHash(hash: string): Rota {
  const limpa = hash.replace(/^#/, "");
  const partes = limpa.split("/").filter((parte) => parte !== "");
  if (partes[0] === "projeto" && partes[1] !== undefined && partes[1] !== "") {
    return { nome: "projeto", id: partes[1] };
  }
  return { nome: "novo-projeto" };
}

/** Rota -> hash (round-trip com parsearHash). */
export function montarHash(rota: Rota): string {
  if (rota.nome === "projeto") {
    return `#/projeto/${rota.id}`;
  }
  return "#/";
}
