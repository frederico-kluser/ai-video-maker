/**
 * src/web/ui/src/main.tsx
 *
 * Entrada da SPA: monta o React na raiz #raiz do index.html e carrega o
 * CSS proprio da UI (design dark, sem framework — ver estilos.css).
 */

import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./estilos.css";

const raiz = document.getElementById("raiz");
if (raiz === null) {
  throw new Error("falta o elemento #raiz no index.html");
}

createRoot(raiz).render(<App />);
