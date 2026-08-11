import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false,
    // Guarda de rede em processo, ligado antes de qualquer teste.
    // Ver tests/setup/rede-bloqueada.ts e src/resolucao/rede/bloqueio.ts.
    setupFiles: ["./tests/setup/rede-bloqueada.ts"],
  },
});
