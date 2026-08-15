/**
 * playwright.config.ts — config do E2E web (Onda 7, S-6)
 *
 * Playwright dirigindo um navegador REAL contra o servidor REAL e a SPA
 * REAL (dist/web). NUNCA entra no vitest (a suite do vitest inclui so os
 * arquivos *.test.ts sob tests/ — vitest.config.ts; os .spec.ts rodam
 * SOMENTE aqui, no runner do Playwright — N-1 do REPLAN).
 *
 * POR QUE na raiz (e nao em tests/web/e2e/): o comando canonico da
 * receita `just e2e-web` e `npx playwright test tests/web/e2e` — o
 * Playwright NAO procura o config abaixo do cwd (medido: config em
 * tests/web/e2e/ com testDir quebrado listava testes do mesmo jeito).
 * Na raiz o config e achado, como o vitest.config.ts. O tsconfig do
 * projeto inclui "playwright.config.ts" (ver tsconfig.json) para o tsc
 * o compilar junto com os .spec.ts — config que nao compila e falha
 * visivel, nunca escrita esquecida.
 *
 * Decisoes (todas com PORQUE):
 *  - workers:1 + retries:0 + fullyParallel:false — o fluxo feliz monta
 *    um projeto inteiro e os previews sao renders Remotion reais e
 *    pesados; paralelismo nao acelera e so disputa CPU com o servidor.
 *  - webServer: o app com PORT dedicada (4621 — REPLAN N-3: nunca a
 *    4610 do contrato, que um servidor manual de dev pode ocupar; S-9),
 *    raiz de dados FRESCA por execucao sob .tmp-e2e (gitignorado — o
 *    webServer a remove no inicio do comando) e ROTEIRO_PROVEDOR=sosia
 *    (zero rede, zero LLM — FQ-E1). O build da SPA e pre-condicao: a
 *    receita `just e2e-web` roda `just build:web` antes (N-2); sem
 *    dist/web o servidor 503a no index (nunca "ok" mentiroso).
 *  - FQ-E2 (sonda negativa): o proprio webServer e a prova — se o
 *    servidor nao subir dentro do timeout, o Playwright FALHA o run
 *    INTEIRO (nenhum teste fica verde com servidor morto; anti-C2). A
 *    sonda de launch por CONTEUDO (GET / com id="raiz") mora no primeiro
 *    teste de fluxo-completo.spec.ts — status 200 sozinho nao prova o
 *    build.
 *  - reuseExistingServer:false — determinismo: cada execucao sobe o
 *    proprio servidor com raiz de dados fresca; um servidor orfao na
 *    porta e erro CLARO de startup (FQ-S4), nunca reuso de estado velho.
 *  - trace: retain-on-failure — diagnostico de teste vermelho sem custo
 *    quando verde.
 */

import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

/** A raiz do repositorio — o config mora nela. */
const RAIZ_DO_REPOSITORIO = fileURLToPath(new URL(".", import.meta.url));

/** Porta dedicada do e2e (REPLAN N-3): nunca a 4610 do contrato. */
export const PORTA_E2E = 4621;

/** Raiz de dados FRESCA por execucao (o webServer a remove no inicio). */
const RAIZ_DADOS_E2E = `${RAIZ_DO_REPOSITORIO}.tmp-e2e/playwright`;

/** A SPA buildada — o servidor 503a sem ela (por isso `just build:web` antes). */
const RAIZ_ESTATICA_E2E = `${RAIZ_DO_REPOSITORIO}dist/web`;

export default defineConfig({
  testDir: "tests/web/e2e",
  // workers:1 — os testes dirigem UM projeto compartilhado por fluxo e os
  // previews renderizam Remotion real: paralelo so disputa a maquina.
  workers: 1,
  retries: 0,
  fullyParallel: false,
  // Os jobs (gerar/preview/juntar) podem levar minutos — o poll da SPA
  // tem teto de 5 min e o teste tem de cobrir o pior caso sem flaky.
  timeout: 600_000,
  expect: {
    timeout: 30_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORTA_E2E}`,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    // rm -rf garante raiz de dados FRESCA por execucao (nunca estado de
    // um run anterior). O servidor em si: npx tsx src/web/servidor.ts.
    command: `rm -rf ${RAIZ_DADOS_E2E} && npx tsx src/web/servidor.ts`,
    url: `http://localhost:${PORTA_E2E}/`,
    timeout: 120_000,
    reuseExistingServer: false,
    cwd: RAIZ_DO_REPOSITORIO,
    env: {
      ...process.env,
      // NODE_ENV=test e OBRIGATORIO para o preview renderizar (ACHADO da
      // Onda 7, MEDIDO): com NODE_ENV ausente o render do Remotion falha
      // com delayRender de fonte nunca limpa (28s) — o mesmo valor com
      // que o vitest roda (por isso os testes de render da Onda 4/5
      // sempre passaram e o e2e pegou a diferenca). O NODE_ENV entra na
      // injecao de env do bundle (setup-environment.js do bundler).
      NODE_ENV: "test",
      PORT: String(PORTA_E2E),
      RAIZ_DADOS: RAIZ_DADOS_E2E,
      RAIZ_ESTATICA: RAIZ_ESTATICA_E2E,
      ROTEIRO_PROVEDOR: "sosia",
    },
  },
});
