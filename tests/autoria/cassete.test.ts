/**
 * tests/autoria/cassete.test.ts
 *
 * O CASSETE de autoria (card F4-04, W6) — presenca, formato, procedencia
 * e credencial.
 *
 * A pergunta obrigatoria desta onda (contrato-w6 §10) exige assercao de
 * PRESENCA do proprio estagio/cassete, nunca sobre listas fechadas:
 * este arquivo pergunta "o cassete do MEU estagio existe, esta no
 * formato F2-01, tem licenca, nao vaza credencial e tem os manifestos
 * INVALIDOS gravados?" — nada sobre a ausencia dos outros.
 *
 * O ∅-crit do card (um manifesto invalido que passa derruba a suite) e
 * da suite de REJEICAO (tests/autoria/rejeicao.test.ts); aqui mora o
 * denominador dele: o cassete tem de EXISTIR, estar completo e carregar
 * invalidos gravados de verdade (nao so os bons).
 */

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  ARQUIVO_CABECALHO,
  ARQUIVO_CHAMADAS,
  ARQUIVO_PROCEDENCIA,
  ARQUIVO_RESULTADO,
  ARQUIVO_VOLATIL,
  VERSAO_FORMATO_CASSETE,
  procurarCredencial,
} from "src/resolucao/cassete/formato.js";
import {
  ARQUIVO_INVALIDOS,
  ECasseteAutoriaAusente,
  diretorioDoCasseteAutoria,
  lerCasseteAutoria,
} from "src/autoria/executor/cassete.js";
import {
  RAIZ,
  briefCanonico,
  chaveDoCassete,
  hashDoManifestoCanonico,
  invalidosDaFonte,
  lerCassete,
  manifestoCanonico,
  raizCassetes,
  textoDoPrompt,
} from "./helpers.js";

/** Os dois provedores com cassete gravado (presenca por item, nunca lista fechada). */
const PROVEDORES = ["openai", "anthropic"] as const;

function todosOsBytes(diretorio: string): string[] {
  const arquivos: string[] = [];
  const lista = (dir: string): void => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) {
        lista(caminho);
      } else {
        arquivos.push(readFileSync(caminho, "utf-8"));
      }
    }
  };
  lista(diretorio);
  return arquivos;
}

describe("cassete de autoria — presenca do MEU estagio (contrato-w6 §10)", () => {
  for (const provedor of PROVEDORES) {
    describe(`provedor ${provedor}`, () => {
      it("existe para a chave computada pela MESMA conta do executor (C12)", () => {
        // Se qualquer componente da chave divergir (prompt, brief, modelo,
        // manifesto), a chave muda e este teste fica VERMELHO por ausencia —
        // nunca um resultado velho servido em silencio.
        const cassete = lerCassete(provedor);
        expect(cassete.cabecalho.formato).toBe(VERSAO_FORMATO_CASSETE);
        expect(cassete.cabecalho.chave).toBe(chaveDoCassete(provedor));
      });

      it("grava contra a fixture canonica (contrato-w6 §12)", () => {
        const cassete = lerCassete(provedor);
        expect(cassete.cabecalho.componentes.hashManifesto).toBe(
          hashDoManifestoCanonico(),
        );
        expect(cassete.cabecalho.componentes.nome).toBe("autoria");
      });

      it("tem o prompt e o modelo gravados na chave (C12: mudar qualquer um e miss)", () => {
        const cassete = lerCassete(provedor);
        const parametros = cassete.cabecalho.componentes.parametros;
        // O hash do prompt da biblioteca de F4-02 esta na chave: se o
        // prompt mudar, o cassete antigo nao e servido em silencio.
        const esperadoPrompt = createHash("sha256")
          .update(textoDoPrompt(), "utf-8")
          .digest("hex");
        expect(parametros.promptSha256).toBe(esperadoPrompt);
        // O modelo padrao do executor esta na chave.
        expect(parametros.modelo).toBe(
          provedor === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-5",
        );
        expect(parametros.tentativa).toBe(1);
      });

      it("tem o layout F2-01 completo (cassete, resultado, procedencia, volatil, chamadas)", () => {
        const diretorio = diretorioDoCasseteAutoria(raizCassetes(), chaveDoCassete(provedor));
        for (const arquivo of [
          ARQUIVO_CABECALHO,
          ARQUIVO_RESULTADO,
          ARQUIVO_PROCEDENCIA,
          ARQUIVO_VOLATIL,
          ARQUIVO_CHAMADAS,
          ARQUIVO_INVALIDOS,
        ]) {
          expect(existsSync(join(diretorio, arquivo))).toBe(true);
        }
        const cassete = lerCassete(provedor);
        expect(cassete.chamadas.length).toBeGreaterThan(0);
      });

      it("tem licenca nao-vazia na procedencia (∅-crit herdado da W4)", () => {
        const cassete = lerCassete(provedor);
        expect(cassete.procedencia.licenca.trim().length).toBeGreaterThan(0);
        expect(cassete.procedencia.provedor.trim().length).toBeGreaterThan(0);
      });

      it("nao contem a chave da API em NENHUM byte (C11: busca no texto inteiro)", () => {
        const diretorio = diretorioDoCasseteAutoria(raizCassetes(), chaveDoCassete(provedor));
        const bytes = todosOsBytes(diretorio);
        expect(bytes.length).toBeGreaterThan(0);
        for (const [i, texto] of bytes.entries()) {
          const achados = procurarCredencial(texto);
          expect(achados, `credencial no byte ${i}`).toEqual([]);
        }
        // O header de autorizacao, quando gravado, so existe redigido.
        const cassete = lerCassete(provedor);
        for (const chamada of cassete.chamadas) {
          for (const [nome, valor] of Object.entries(chamada.headersRequisicao)) {
            if (/authorization|x-api-key|api-key|token/i.test(nome)) {
              expect(valor).toBe("[REDIGIDO]");
            }
          }
        }
      });

      it("TEM manifestos INVALIDOS gravados — e nao so os bons (∅-crit do F4-04)", () => {
        const cassete = lerCassete(provedor);
        expect(cassete.invalidos.length).toBeGreaterThanOrEqual(3);
        for (const invalido of cassete.invalidos) {
          expect(typeof invalido.id).toBe("string");
          expect(invalido.id.length).toBeGreaterThan(0);
          expect(typeof invalido.motivo).toBe("string");
          expect(invalido.motivo.length).toBeGreaterThan(0);
          expect(invalido.documento).toBeTruthy();
          expect(typeof invalido.documento).toBe("object");
        }
        // Os invalidos gravados sao os mesmos da fonte de gravacao
        // (o cassete e o registro; a fonte so existe para a cerimonia).
        const idsGravados = cassete.invalidos.map((i) => i.id).sort();
        const idsDaFonte = invalidosDaFonte()
          .map((i) => i.id)
          .sort();
        expect(idsGravados).toEqual(idsDaFonte);
      });

      it("resultado.json e o documento de autoria gravado pela chamada", () => {
        const cassete = lerCassete(provedor);
        const resultado = cassete.resultado as unknown as Record<string, unknown>;
        expect(resultado.schema_version).toBe("Autoria.1");
        expect(Array.isArray(resultado.nos)).toBe(true);
        expect(Array.isArray(resultado.cenas)).toBe(true);
      });
    });
  }

  it("o brief canonico existe e tem os campos declarados do prompt de F4-02", () => {
    const brief = briefCanonico();
    expect(typeof brief.tema).toBe("string");
    expect(brief.tema.length).toBeGreaterThan(0);
  });

  it("o manifesto canonico e o que o resto do pipeline usa (hash na chave)", () => {
    const manifesto = manifestoCanonico();
    expect(manifesto.schema_version).toBe("Manifesto.1");
    expect(hashDoManifestoCanonico()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a raiz dos cassetes e a do F2-01 (fixtures/cassetes)", () => {
    expect(existsSync(join(RAIZ, raizCassetes(), "autoria"))).toBe(true);
  });

  it("um cassete SEM invalidos.json gravados e REJEITADO pelo leitor (∅-crit estrutural)", () => {
    // Copia o cassete commitado para uma arvore temporaria, tira o
    // invalidos.json, e exige que o leitor acuse — um cassete so com os
    // bons nao testa nada, e tem de ser VERMELHO, nunca "continuar sem".
    const tmp = mkdtempSync(join(tmpdir(), "autoria-sem-invalidos-"));
    try {
      const chave = chaveDoCassete("openai");
      cpSync(
        join(raizCassetes(), "autoria", chave),
        join(tmp, "autoria", chave),
        { recursive: true },
      );
      const semInvalidos = join(tmp, "autoria", chave);
      rmSync(join(semInvalidos, ARQUIVO_INVALIDOS));
      // Arquivo obrigatorio ausente = ECasseteAutoriaAusente (∅-crit):
      // meio cassete nao reproduz meio estagio.
      expect(() => lerCasseteAutoria(tmp, chave)).toThrow(ECasseteAutoriaAusente);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
