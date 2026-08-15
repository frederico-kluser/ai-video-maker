/**
 * tests/roteiro/primeira-chamada.test.ts
 *
 * Regressao do defecto CRITICAL em src/roteiro/contrato/validar.ts:
 * validarContraDefs compilava o envelope
 * `{ $ref: ".../roteiro.schema.json#/$defs/<Nome>" }` contra um Ajv que
 * ainda nao conhecia o schema — roteiro.schema.json so era registrado por
 * obterValidadores(), que roda apenas via validarRoteiro/validarPedaco.
 * Chamadas por-defs como PRIMEIRA validacao de um processo novo lancavam
 * `can't resolve reference` em vez de devolver { valido: false } (o
 * servidor da Onda 4 responderia 500 no lugar de 400, FQ-C1). A suite de
 * 51 testes passava porque contrato.test.ts chamava validarPedaco no
 * primeiro `it`, registrando o schema antes do resto — exatamente a classe
 * C2 (teste verde com codigo quebrado).
 *
 * Anti-C2 (runner verde com filtro que nao casa nada): cada caso spawna um
 * PROCESSO LIMPO (tsx) que importa o modulo e chama a funcao como PRIMEIRA
 * chamada do processo. Nada de estado compartilhado: a ordem da suite e
 * irrelevante, e este arquivo nao importa o modulo no proprio processo.
 * O teste falha se o processo sair com exit != 0, se o stderr contiver
 * "can't resolve reference" ou se a saida verificavel ("OK", impressa so
 * quando valido com problemas vazios) nao aparecer.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const CAMINHO_VALIDAR = join(RAIZ, "src", "roteiro", "contrato", "validar.ts");
const CAMINHO_CONTRATO = join(RAIZ, "src", "roteiro", "contrato", "contrato.ts");
const BIN_TSX = join(RAIZ, "node_modules", ".bin", "tsx");

/**
 * Spawna um processo NOVO (tsx) e roda o script nele. O estado do Ajv
 * deste processo de teste nunca alcança o processo filho — e o filho que
 * tem de funcionar de primeira, do jeito que o servidor da Onda 4 chamaria.
 */
function rodarProcessoLimpo(script: string): { ok: boolean; saida: string; erro: string } {
  try {
    const saida = execFileSync(BIN_TSX, ["-e", script], {
      cwd: RAIZ,
      encoding: "utf-8",
      timeout: 60_000,
    });
    return { ok: true, saida: String(saida), erro: "" };
  } catch (e) {
    const err = e as { stdout?: unknown; stderr?: unknown; message?: string };
    return {
      ok: false,
      saida: String(err.stdout ?? ""),
      erro: `${String(err.stderr ?? "")} ${err.message ?? ""}`,
    };
  }
}

/** Sonda negativa: qualquer falha do processo filho derruba o caso. */
function assertarValidaComoPrimeiraChamada(descricao: string, script: string): void {
  const { ok, saida, erro } = rodarProcessoLimpo(script);
  expect(
    erro,
    `${descricao}: o processo limpo NAO pode lancar (sonda "can't resolve reference") — ${erro}`,
  ).not.toContain("can't resolve reference");
  expect(ok, `${descricao}: o processo limpo deve sair com exit 0 — ${erro}`).toBe(true);
  expect(saida, `${descricao}: saida verificavel esperada ("OK") — saida: ${saida}`).toContain(
    "OK",
  );
}

/** Monta o script: chama a funcao e so imprime "OK" com valido e problemas vazios. */
function scriptDe(cabecalho: string): string {
  return `${cabecalho}
if (!r.valido || r.problemas.length !== 0) {
  throw new Error("esperado { valido: true, problemas: [] }; veio: " + JSON.stringify(r));
}
console.log("OK");`;
}

const CASOS: Array<[string, string]> = [
  [
    "validarBriefRoteiro com tema minimo",
    scriptDe(`import { validarBriefRoteiro } from ${JSON.stringify(CAMINHO_VALIDAR)};
const r = validarBriefRoteiro({ tema: "x" });`),
  ],
  [
    "validarEdicaoPedaco com delta minimo",
    scriptDe(`import { validarEdicaoPedaco } from ${JSON.stringify(CAMINHO_VALIDAR)};
const r = validarEdicaoPedaco({ fala: "ola" });`),
  ],
  [
    "validarPedidoGerarRoteiro com brief minimo e versoes correntes",
    scriptDe(`import { validarPedidoGerarRoteiro } from ${JSON.stringify(CAMINHO_VALIDAR)};
import { VERSAO_CONTRATO_ROTEIRO, VERSAO_CONTRATO_GERADOR, VERSAO_GERADOR } from ${JSON.stringify(CAMINHO_CONTRATO)};
const r = validarPedidoGerarRoteiro({
  brief: { tema: "x" },
  versao_contrato: VERSAO_CONTRATO_ROTEIRO,
  versao_contrato_gerador: VERSAO_CONTRATO_GERADOR,
  versao_gerador: VERSAO_GERADOR,
});`),
  ],
  [
    "validarPedidoRegenerarPedaco com pedaco_atual minimo valido",
    scriptDe(`import { validarPedidoRegenerarPedaco } from ${JSON.stringify(CAMINHO_VALIDAR)};
import { VERSAO_CONTRATO_ROTEIRO, VERSAO_CONTRATO_GERADOR, VERSAO_GERADOR } from ${JSON.stringify(CAMINHO_CONTRATO)};
const r = validarPedidoRegenerarPedaco({
  brief: { tema: "x" },
  pedaco_atual: {
    id: "p-001",
    indice: 1,
    titulo: "Titulo",
    fala: "Fala narrada.",
    duracao_segundos: 5,
    tipo_visual: "manim",
    especificacao_visual: "Cena simples",
    detalhes_de_producao: "Render headless",
    narracao: { texto: "", origem: "nenhuma", status: "vazio" }
  },
  resumo_demais_pedacos: '[{"id":"p-000","indice":0,"titulo":"Abertura","fala":"","duracao_segundos":4.0,"tipo_visual":"cabecalho","especificacao_visual":"x","detalhes_de_producao":"x","narracao":{"texto":"","origem":"nenhuma","status":"vazio"}}]',
  versao_contrato: VERSAO_CONTRATO_ROTEIRO,
  versao_contrato_gerador: VERSAO_CONTRATO_GERADOR,
  versao_gerador: VERSAO_GERADOR,
});`),
  ],
];

describe("validacao por $defs como PRIMEIRA chamada de um processo novo (regressao C2)", () => {
  for (const [descricao, script] of CASOS) {
    it(descricao, () => {
      assertarValidaComoPrimeiraChamada(descricao, script);
    }, 30_000);
  }
});
