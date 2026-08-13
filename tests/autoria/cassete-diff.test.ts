/**
 * tests/autoria/cassete-diff.test.ts
 *
 * O DETERMINISMO do cassete de autoria (card F4-04, W6) — o espelho do
 * `res:cassete` do F2-01 para o caminho de chamada da autoria:
 *
 *   Regravar o cassete tem de reproduzir cada byte. Uma diferenca so e
 *   aceitavel se estiver em CAMPOS_VOLATEIS (a lista fechada do F2-01:
 *   todo volatil.json + procedencia.adquiridoEm). Qualquer outra
 *   diferenca REFUTA o determinismo — e o diff tem de ficar VERMELHO.
 *
 * Tres fases (mesma disciplina do regravar-e-diffar do F2-01):
 *   1. GRAVA duas vezes, com relogios DIFERENTES de proposito (o unico
 *      volatil que temos e o relogio);
 *   2. DIFFA com o diffCassetes do F2-01: zero refutacoes;
 *   3. SONDA NEGATIVA: muta um byte do resultado.json e exige que o
 *      diff fique VERMELHO — um diff que nunca reprovou nao e
 *      evidencia de nada.
 *
 * A gravacao aqui usa o fetch GRAVADO do proprio cassete (sosia): o
 * determinismo e provado sobre a resposta registrada, nunca com uma
 * segunda chamada real (que nao e deterministica — ADR-0023).
 *
 * O diff compara o DIRETORIO DO CASSETE (raiz/autoria/<chave>/), como o
 * diffCassetes do F2-01 espera — comparar a raiz inteira quebraria a
 * mascara de volateis (o arquivo relativo seria autoria/<chave>/volatil.json).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { diffCassetes } from "src/resolucao/cassete/diff.js";
import {
  gravarCasseteAutoria,
  ARQUIVO_INVALIDOS,
} from "src/autoria/executor/cassete.js";
import {
  briefCanonico,
  chaveDoCassete,
  lerCassete,
  manifestoCanonico,
  raizCassetes,
} from "./helpers.js";

const PROVEDORES = ["openai", "anthropic"] as const;

const TMP = mkdtempSync(join(tmpdir(), "autoria-diff-"));

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("determinismo do cassete de autoria (regravar reproduz cada byte)", () => {
  for (const provedor of PROVEDORES) {
    describe(`provedor ${provedor}`, () => {
      const cassete = lerCassete(provedor);
      const corposFonte = join(raizCassetes(), "autoria", chaveDoCassete(provedor), "corpos");
      // Raizes da gravacao: o gravador escreve em <raiz>/autoria/<chave>.
      const dirA = join(TMP, `cassete-A-${provedor}`);
      const dirB = join(TMP, `cassete-B-${provedor}`);
      // A chave usada pelo gravador (devolvida na gravacao) — a mesma
      // conta da cerimonia: entrada + componentes + manifesto.
      let chave = "";

      beforeAll(() => {
        // Grava duas vezes com relogios DIFERENTES, no formato canonico
        // (a mesma funcao da cerimonia de gravacao).
        const base = {
          documento: cassete.resultado,
          entrada: {
            model: cassete.cabecalho.componentes.parametros.modelo as string,
            system: "",
            tools: [] as unknown[],
            messages: [{ role: "user", content: "brief" }],
            output_config: {},
            schema_version: "Autoria.1",
          },
          provedor,
          maxTokens: 4096,
          manifesto: manifestoCanonico(),
          chamadas: cassete.chamadas,
          corpos: new Map(
            cassete.chamadas.map((c) => [
              c.hashCorpo,
              readFileSync(join(corposFonte, c.hashCorpo)),
            ]),
          ),
          procedencia: cassete.procedencia,
          invalidos: cassete.invalidos,
        };
        const relogioA = (): Date => new Date("2026-01-01T00:00:00.000Z");
        const relogioB = (): Date => new Date("2026-06-15T12:30:00.000Z");
        chave = gravarCasseteAutoria({ ...base, raiz: dirA, relogio: relogioA }).chave;
        const chaveB = gravarCasseteAutoria({ ...base, raiz: dirB, relogio: relogioB }).chave;
        expect(chaveB).toBe(chave); // mesma entrada => mesma chave (C12)
      });

      it("duas gravacoes com relogios diferentes diferem SO nos volateis declarados", async () => {
        const resultado = await diffCassetes(
          join(dirA, "autoria", chave),
          join(dirB, "autoria", chave),
        );
        expect(resultado.refutacoes).toBe(0);
        // A diferenca de relogio TEM de aparecer como explicada (volatil):
        // relogios iguais esconderiam o unico volatil que temos.
        expect(resultado.explicadas).toBeGreaterThan(0);
        // Denominador: o diff comparou os arquivos do cassete, incluindo
        // o invalidos.json (o ∅-crit tem de estar na comparacao).
        expect(resultado.arquivosComparados).toContain(ARQUIVO_INVALIDOS);
      });

      it("SONDA NEGATIVA: mutar um byte do resultado.json deixa o diff VERMELHO", async () => {
        // Muta um byte do resultado na gravacao B (e restaura depois).
        const resultadoB = join(dirB, "autoria", chave, "resultado.json");
        const original = readFileSync(resultadoB, "utf-8");
        const mutado = original.replace('"Autoria.1"', '"Autoria.9"');
        expect(mutado).not.toBe(original);
        writeFileSync(resultadoB, mutado, "utf-8");

        const resultado = await diffCassetes(
          join(dirA, "autoria", chave),
          join(dirB, "autoria", chave),
        );
        expect(resultado.refutacoes).toBeGreaterThan(0);

        writeFileSync(resultadoB, original, "utf-8");
      });
    });
  }

  it("o brief canonico usado na gravacao tem os campos do prompt (entrada da cerimonia)", () => {
    const brief = briefCanonico();
    expect(typeof brief.tema).toBe("string");
  });
});
