#!/usr/bin/env npx tsx
/**
 * tools/resolucao/chave.ts
 *
 * `just res:chave [--estagio <nome>]` — muda um parametro por vez e
 * exige cache miss em cada um (AGENTS.md C12).
 *
 * Existe aqui, no card do contrato, e nao em cada card da W4, porque os
 * cinco estagios da W4 declaram a mesma aceitacao (`just res:chave
 * --estagio <nome>`) e sao cegos entre si: cinco implementacoes
 * paralelas do mesmo verificador divergiriam, e a que divergisse para
 * menos passaria.
 *
 * O que ele faz: para cada componente da chave — versao do contrato,
 * nome, versao do estagio, hash do manifesto, e CADA parametro
 * declarado pelo estagio — muda so aquele e exige chave diferente.
 * Depois, a sonda ao contrario: nao mudar nada tem de dar a MESMA chave.
 * Sem essa segunda metade, um `chaveDeCache` que devolvesse um numero
 * aleatorio passaria em todas as mutacoes.
 *
 * Uso:
 *   npx tsx tools/resolucao/chave.ts [--estagio <nome>]
 */

import {
  VERSAO_CONTRATO,
  chaveDeCache,
  componentesDaChave,
  hashDoManifesto,
} from "../../src/resolucao/contrato.js";
import type {
  ComponentesChave,
  EstagioResolucao,
} from "../../src/resolucao/contrato.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";
import estagioReferencia from "../../fixtures/resolucao/estagio-referencia/estagio.js";

const MANIFESTO: Manifesto = {
  schema_version: "Manifesto.1",
  fps: 30,
  width: 1920,
  height: 1080,
  nos: [
    {
      id: "n-001",
      schema: "Cabecalho.1",
      type: "cabecalho",
      duracao_frames: 60,
      texto: "Chave de cache",
    },
  ],
  cenas: [{ id: "c-001", nos: ["n-001"] }],
};

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function carregarEstagio(nome: string | undefined): Promise<EstagioResolucao> {
  if (nome === undefined) return estagioReferencia;
  const modulo = (await import(`../../src/resolucao/${nome}/estagio.js`)) as {
    default?: EstagioResolucao;
  };
  if (!modulo.default) {
    throw new Error(`src/resolucao/${nome}/estagio.ts nao tem 'export default'.`);
  }
  return modulo.default;
}

/** Muda um valor escalar para outro valor do mesmo tipo. */
function alterar(valor: string | number | boolean | null): string | number | boolean {
  if (typeof valor === "number") return valor + 1;
  if (typeof valor === "boolean") return !valor;
  if (valor === null) return "nao-mais-nulo";
  return `${valor}-alterado`;
}

async function main(): Promise<number> {
  const nome = argumento("--estagio");
  const estagio = await carregarEstagio(nome);
  const base = componentesDaChave(estagio, hashDoManifesto(MANIFESTO));
  const chaveBase = chaveDeCache(base);

  console.log("=== res:chave — um parametro por vez, cache miss em cada ===");
  console.log(`Estagio: ${estagio.identidade.nome} v${estagio.identidade.versao}`);
  console.log(`Chave base: ${chaveBase}`);
  console.log("");

  const mutacoes: Array<[string, ComponentesChave]> = [
    ["versaoContrato", { ...base, versaoContrato: `${VERSAO_CONTRATO}-x` }],
    ["nome", { ...base, nome: base.nome === "locucao" ? "musica" : "locucao" }],
    ["versaoEstagio", { ...base, versaoEstagio: `${base.versaoEstagio}-x` }],
    ["hashManifesto", { ...base, hashManifesto: hashDoManifesto({ ...MANIFESTO, fps: 60 }) }],
  ];

  for (const [chaveParam, valor] of Object.entries(base.parametros)) {
    mutacoes.push([
      `parametros.${chaveParam}`,
      { ...base, parametros: { ...base.parametros, [chaveParam]: alterar(valor) } },
    ]);
  }
  mutacoes.push([
    "parametros.<novo>",
    { ...base, parametros: { ...base.parametros, __parametro_novo: 1 } },
  ]);

  let falhas = 0;
  for (const [rotulo, componentes] of mutacoes) {
    const chave = chaveDeCache(componentes);
    const miss = chave !== chaveBase;
    console.log(
      `  ${miss ? "[MISS]" : "[HIT ]"} ${rotulo.padEnd(28)} ${chave.slice(0, 16)}…`,
    );
    if (!miss) {
      falhas++;
      console.log(
        `         ^ FALHOU: mudar ${rotulo} nao mudou a chave. ` +
          `O cache vai acertar pelo motivo errado (C12).`,
      );
    }
  }
  console.log("");

  // Sonda ao contrario: sem mudanca, a chave TEM de repetir. Sem isto,
  // um gerador de chave aleatoria passaria em todas as mutacoes acima.
  const repetida = chaveDeCache(componentesDaChave(estagio, hashDoManifesto(MANIFESTO)));
  const estavel = repetida === chaveBase;
  console.log(
    `  ${estavel ? "[OK  ]" : "[FALHOU]"} sem mudanca -> mesma chave (estabilidade)`,
  );
  if (!estavel) {
    falhas++;
    console.log("         ^ a chave nao e funcao pura dos componentes.");
  }
  console.log("");

  if (falhas > 0) {
    console.log(`=== VERMELHO: ${falhas} componente(s) fora da chave ===`);
    return 1;
  }
  console.log(
    `=== VERDE: ${mutacoes.length} componente(s) testado(s), cache miss em todos ===`,
  );
  return 0;
}

main().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.error("res:chave: erro inesperado:", erro);
    process.exit(2);
  },
);
