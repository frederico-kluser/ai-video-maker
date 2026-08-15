/**
 * vite.config.ts — build da SPA do Editor de Video IA (Onda 6).
 *
 * POR QUE este arquivo existe: a raiz do vite e a pasta da SPA (onde o
 * index.html mora) e o build sai em <raiz-do-repo>/dist/web — a unica
 * raiz que o servidor da Onda 5 serve (RAIZ_ESTATICA, src/web/servidor.ts
 * `tratarSpa`: /assets/* mapeia para dist/web/assets/ e o index.html e o
 * fallback de qualquer GET fora de /api/).
 *
 * POR QUE base "/": o index.html do build referencia os estaticos como
 * /assets/<arquivo> e o servidor serve exatamente esse prefixo (o
 * comentario em tratarSpa diz: "index.html os referencia como
 * /assets/<arquivo>"). base "./" produziria caminhos relativos que o
 * roteamento do servidor nao conhece.
 *
 * POR QUE o proxy: o fluxo canonico serve a SPA PELO proprio servidor
 * (same-origin, sem CORS — REPLAN Onda 6: a SPA deriva a base de
 * window.location, nunca URL absoluta). Para iterar com `npx vite` puro
 * em dev, o proxy /api -> 4610 evita CORS sem tocar o servidor; em
 * producao o proxy nao existe (o servidor serve tudo).
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: import.meta.dirname,
  base: "/",
  plugins: [react()],
  publicDir: false,
  build: {
    // Relativo a raiz do vite (src/web/ui): ../../../ = raiz do repo —
    // o servidor espera <raiz>/dist/web (RAIZ_ESTATICA default).
    outDir: "../../../dist/web",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:4610",
    },
  },
});
