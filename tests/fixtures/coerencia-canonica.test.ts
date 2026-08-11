/**
 * tests/fixtures/coerencia-canonica.test.ts
 *
 * Amarra a fixture canonica a aritmetica que a le.
 *
 * Origem: PREP-w4. A fixture declarava `duracao_total_frames: 930` enquanto
 * `calcularDuracao()` derivava 727 dos mesmos dados -- 780 de cenas menos 53 de
 * fronteiras. Os dois numeros conviveram porque ninguem os comparava: o
 * declarado era digitado, o derivado era calculado, e nenhum teste exigia que
 * batessem.
 *
 * Oito nos da W4 e a suite integrada da W5 leem esta fixture. Um total
 * declarado que nao corresponde ao conteudo e falso oraculo: quem assertar
 * contra ele passa achando que provou alguma coisa.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calcularDuracao } from "../../src/composicao/tempo.js";
import type { Manifesto } from "../../src/contratos/manifesto.js";

const RAIZ = join(__dirname, "..", "..");
const CAMINHO = join(RAIZ, "fixtures", "canonico", "manifesto-valido.json");

function carregar(): Manifesto {
  return JSON.parse(readFileSync(CAMINHO, "utf-8")) as Manifesto;
}

describe("fixture canonica — coerencia interna", () => {
  it("duracao_total_frames declarada bate com a derivada das cenas", () => {
    const m = carregar();
    const d = calcularDuracao(m);

    expect(m.duracao_total_frames).toBe(d.totalFrames);
  });

  it("a derivada e soma das cenas menos as fronteiras, nao a soma crua", () => {
    // Guarda contra o conserto errado: alguem poderia fazer os numeros baterem
    // zerando as transicoes, e o teste acima passaria com o video errado.
    const d = calcularDuracao(carregar());

    expect(d.somaTransicoes).toBeGreaterThan(0);
    expect(d.totalFrames).toBe(d.somaCenas - d.somaTransicoes);
  });

  it("nenhuma cena declara a mesma fronteira dos dois lados", () => {
    // AB-240: a fronteira entre duas cenas e UMA coisa. Enquanto o schema
    // aceitar transicao_saida na anterior e transicao_entrada na seguinte, e
    // possivel declarar tipos e duracoes diferentes para a mesma fronteira --
    // e foi o que a fixture fazia em tres das quatro (wipe 20 x flip 12,
    // clockWipe 18 x cube 24). A precedencia adotada faz a saida mandar, o que
    // torna a entrada divergente silenciosamente inerte: ela nao muda o tempo,
    // mas mente para quem a le.
    const m = carregar();

    for (let i = 0; i < m.cenas.length - 1; i++) {
      const anterior = m.cenas[i]!;
      const seguinte = m.cenas[i + 1]!;
      const saida = anterior.transicao_saida;
      const entrada = seguinte.transicao_entrada;

      if (saida && entrada) {
        expect(
          { tipo: entrada.tipo, duracao_frames: entrada.duracao_frames },
          `fronteira ${anterior.id} -> ${seguinte.id} declarada dos dois lados`,
        ).toEqual({ tipo: saida.tipo, duracao_frames: saida.duracao_frames });
      }
    }
  });

  it("toda cena aponta para no existente e nenhum no fica orfao", () => {
    // Um no declarado que nenhuma cena usa some do video sem erro; uma cena que
    // aponta para no inexistente quebra so no render.
    const m = carregar();
    const declarados = new Set(m.nos.map((n) => n.id));
    const usados = new Set<string>();

    for (const cena of m.cenas) {
      for (const id of cena.nos) {
        expect(declarados.has(id), `cena ${cena.id} aponta para no inexistente ${id}`).toBe(true);
        usados.add(id);
      }
    }

    const orfaos = [...declarados].filter((id) => !usados.has(id)).sort();
    expect(orfaos, "nos declarados que nenhuma cena usa").toEqual([]);
  });
});
