// =============================================================================
// comp-unicidade — varre o disco e exige id unico por no descoberto
// =============================================================================
// Card: F1-01 — Composicao raiz
//
// A descoberta aqui IMPORTA cada modulo e le o `meta` que ele mesmo exporta.
// Nao e grep: grep acha "id:" num comentario e sai verde.
//
// E tem sonda negativa por alvo (C2): cada regra do contrato tem um diretorio
// de fixture que a viola, e o teste exige que a descoberta ESTOURE. Um gate
// que so foi visto passando nunca foi visto funcionando.
// =============================================================================

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  DIRETORIO_DE_NOS,
  ErroDeDescoberta,
  descobrirNos,
  listarTiposDescobertos,
  tipoDoCaminho,
  varrerDiretorio,
} from "src/composicao/descoberta";
import { SCHEMA_POR_TIPO, TIPOS_DE_NO, isTipoDeNo } from "src/composicao/contrato-de-no";
import { REGISTRO_DE_NOS, tiposRegistrados } from "src/composicao/registro";

const AQUI = dirname(fileURLToPath(import.meta.url));
const INVALIDOS = resolve(AQUI, "nos-invalidos");
const VALIDOS = resolve(AQUI, "nos-validos");

// ---------------------------------------------------------------------------
// Varredura do diretorio real
// ---------------------------------------------------------------------------

describe("descoberta no disco (comp-unicidade)", () => {
  it("a varredura acha arquivos — seletor vazio seria falso verde (C2)", () => {
    const caminhos = varrerDiretorio(DIRETORIO_DE_NOS);
    expect(caminhos.length).toBeGreaterThan(0);
  });

  it("a varredura e deterministica: ordenada e igual em duas passadas", () => {
    const a = varrerDiretorio(DIRETORIO_DE_NOS);
    const b = varrerDiretorio(DIRETORIO_DE_NOS);
    expect(a).toStrictEqual(b);
    expect(a).toStrictEqual([...a].sort());
  });

  it("descobre um componente para cada tipo de no do schema", async () => {
    const tipos = await listarTiposDescobertos(DIRETORIO_DE_NOS);
    expect(tipos).toStrictEqual([...TIPOS_DE_NO].sort());
  });

  it("todo id descoberto e unico", async () => {
    const catalogo = await descobrirNos(DIRETORIO_DE_NOS);
    const ids = catalogo.todos.map((n) => n.meta.id);
    expect(ids.length).toBe(TIPOS_DE_NO.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(catalogo.porId.size).toBe(ids.length);
  });

  it("todo id descoberto e nao vazio e distinto do tipo", async () => {
    const catalogo = await descobrirNos(DIRETORIO_DE_NOS);
    for (const no of catalogo.todos) {
      expect(no.meta.id.trim().length).toBeGreaterThan(0);
      expect(no.meta.id).not.toBe(no.meta.tipo);
    }
  });

  it("o tipo declarado casa com o nome do arquivo (a convencao)", async () => {
    const catalogo = await descobrirNos(DIRETORIO_DE_NOS);
    for (const no of catalogo.todos) {
      expect(no.meta.tipo).toBe(tipoDoCaminho(no.caminho));
      expect(isTipoDeNo(no.meta.tipo)).toBe(true);
    }
  });

  it("o schema declarado casa com o tipo", async () => {
    const catalogo = await descobrirNos(DIRETORIO_DE_NOS);
    for (const no of catalogo.todos) {
      expect(no.meta.schema).toBe(
        SCHEMA_POR_TIPO[no.meta.tipo as keyof typeof SCHEMA_POR_TIPO],
      );
    }
  });

  it("todo modulo descoberto exporta um componente de verdade", async () => {
    const catalogo = await descobrirNos(DIRETORIO_DE_NOS);
    for (const no of catalogo.todos) {
      expect(typeof no.componente).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// O espelho sem disco tem de bater com o disco
// ---------------------------------------------------------------------------

describe("registro x disco — o espelho nao pode divergir", () => {
  it("os tipos registrados sao exatamente os descobertos", async () => {
    const doDisco = await listarTiposDescobertos(DIRETORIO_DE_NOS);
    expect(tiposRegistrados()).toStrictEqual(doDisco);
  });

  it("cada meta registrado e identico ao meta do arquivo no disco", async () => {
    const catalogo = await descobrirNos(DIRETORIO_DE_NOS);
    for (const no of catalogo.todos) {
      const entrada = REGISTRO_DE_NOS.get(no.meta.tipo);
      expect(entrada, `tipo "${no.meta.tipo}" nao esta no registro`).toBeDefined();
      expect(entrada!.meta).toStrictEqual(no.meta);
      expect(entrada!.componente.name).toBe(no.componente.name);
    }
  });

  it("o registro nao tem tipo que o disco nao tenha", async () => {
    const doDisco = new Set(await listarTiposDescobertos(DIRETORIO_DE_NOS));
    for (const tipo of REGISTRO_DE_NOS.keys()) {
      expect(doDisco.has(tipo), `registro tem "${tipo}", o disco nao`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Sondas negativas — arquivo torto tem de ESTOURAR, nunca ser ignorado
// ---------------------------------------------------------------------------

describe("um arquivo que nao casa o contrato FALHA (nao e ignorado)", () => {
  it("controle positivo: um diretorio conforme e descoberto sem erro", async () => {
    const catalogo = await descobrirNos(VALIDOS);
    expect(catalogo.todos.length).toBe(1);
    expect(catalogo.todos[0]!.meta.id).toBe("no-texto-de-teste");
  });

  const casos: { dir: string; mensagem: RegExp }[] = [
    { dir: "sem-meta", mensagem: /nao exporta `meta`/ },
    { dir: "sem-default", mensagem: /nao exporta `default`/ },
    { dir: "tipo-divergente", mensagem: /nao casa com o nome do arquivo/ },
    { dir: "tipo-desconhecido", mensagem: /nao e um tipo de no do schema/ },
    { dir: "schema-divergente", mensagem: /diverge do schema do tipo/ },
    { dir: "id-duplicado", mensagem: /id duplicado "no-colidido"/ },
  ];

  for (const caso of casos) {
    it(`nos-invalidos/${caso.dir}: estoura ErroDeDescoberta`, async () => {
      const alvo = resolve(INVALIDOS, caso.dir);
      // A varredura ENXERGA o arquivo: se nao enxergasse, o teste passaria
      // por engano (o erro viria de diretorio vazio, nao do contrato).
      expect(varrerDiretorio(alvo).length).toBeGreaterThan(0);
      await expect(descobrirNos(alvo)).rejects.toThrow(ErroDeDescoberta);
      await expect(descobrirNos(alvo)).rejects.toThrow(caso.mensagem);
    });
  }

  it("a mensagem de erro diz QUAL arquivo esta torto", async () => {
    const alvo = resolve(INVALIDOS, "sem-meta");
    await expect(descobrirNos(alvo)).rejects.toThrow(/sem-meta[/\\]texto\.tsx/);
  });

  it("um diretorio inexistente devolve catalogo vazio, nao erro", async () => {
    const catalogo = await descobrirNos(resolve(INVALIDOS, "nao-existe"));
    expect(catalogo.todos.length).toBe(0);
  });
});
