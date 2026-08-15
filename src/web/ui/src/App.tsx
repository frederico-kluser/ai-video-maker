/**
 * src/web/ui/src/App.tsx
 *
 * Roteador por HASH da SPA (decisao documentada em roteamento.ts: zero
 * deps — sem react-router; o servidor serve o index.html como fallback
 * de qualquer GET fora de /api/, o hash nunca chega a ele).
 *
 * #/            -> NovoProjeto
 * #/projeto/<id> -> Projeto
 */

import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { parsearHash } from "./roteamento.js";
import type { Rota } from "./roteamento.js";
import { NovoProjeto } from "./telas/NovoProjeto.js";
import { Projeto } from "./telas/Projeto.js";

export function App(): ReactElement {
  const [rota, setRota] = useState<Rota>(() => parsearHash(window.location.hash));

  useEffect(() => {
    const aoMudarHash = (): void => {
      setRota(parsearHash(window.location.hash));
    };
    window.addEventListener("hashchange", aoMudarHash);
    return () => window.removeEventListener("hashchange", aoMudarHash);
  }, []);

  if (rota.nome === "projeto") {
    return <Projeto id={rota.id} />;
  }
  return <NovoProjeto />;
}
