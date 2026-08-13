/**
 * tests/render/encode/perfis.test.ts
 *
 * O CATALOGO REAL — descoberta por convencao (Regra 6) e o ∅-crit sobre
 * o que esta em disco.
 *
 *   1. ∅-CRIT: `listarPerfis()` valida TODO perfil descoberto e lança
 *      `EPerfilInvalido` no primeiro invalido — um perfil sem alvo de
 *      qualidade (ou com eixo cruzado) derruba a descoberta, nunca e
 *      pulado em silencio. A sonda negativa usa um arquivo invalido
 *      temporario no diretorio canonico.
 *
 *   2. PRESENCA (contrato-w7 §12 — NUNCA lista completa): as assercoes
 *      sao "o perfil entrega-software esta la e declara deterministico:
 *      true" e "o perfil entrega-nvenc esta la e declara deterministico:
 *      false" — nunca "existem exatamente N perfis". O merge dos irmaos
 *      pode trazer mais perfis; a presenca continua verdadeira.
 *
 *   3. Emenda em forma de catalogo: todo perfil do disco declara
 *      determinismo (a declaracao e o campo obrigatorio do formato).
 */

import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DIRETORIO_DE_PERFIS,
  listarPerfis,
} from "src/render/encode/descobrir.js";
import { EPerfilInvalido } from "src/render/encode/formato.js";

describe("listarPerfis — ∅-crit sobre o catalogo real", () => {
  it("descobre e valida todos os perfis do disco (falha alto em invalido)", async () => {
    const descobertos = await listarPerfis();
    // PRESENCA, nunca lista completa (§12): o item DESTE card tem de
    // estar la; quantos perfis o merge dos irmaos trouxer nao e do card.
    const software = descobertos.find((d) => d.perfil.nome === "entrega-software");
    const nvenc = descobertos.find((d) => d.perfil.nome === "entrega-nvenc");
    expect(software).toBeDefined();
    expect(nvenc).toBeDefined();
  });

  it("∅-crit: perfil do disco sem alvo de qualidade derruba a descoberta", async () => {
    const caminho = join(DIRETORIO_DE_PERFIS, "invalido-sem-alvo.ts");
    writeFileSync(
      caminho,
      [
        "import type { PerfilEncode } from '../formato.js';",
        "const perfil: PerfilEncode = {",
        "  nome: 'invalido-sem-alvo',",
        "  motor: 'libx264',",
        "  codec: 'libx264',",
        "  deterministico: true,",
        "  justificativaDeterminismo: 'sonda negativa',",
        "  preset: 'medium',",
        "  pixFmt: 'yuv420p',",
        "  argsExtra: [],",
        "} as PerfilEncode;", // o campo alvoQualidade NAO existe
        "export default perfil;",
        "",
      ].join("\n"),
    );
    try {
      await expect(listarPerfis()).rejects.toThrow(EPerfilInvalido);
    } finally {
      // Remove a sonda — o catalogo do card volta a ser so o dele.
      const { rmSync } = await import("node:fs");
      rmSync(caminho, { force: true });
    }
  });

  it("∅-crit: perfil do disco com eixo cruzado (crf no NVENC) derruba a descoberta", async () => {
    const caminho = join(DIRETORIO_DE_PERFIS, "invalido-eixo.ts");
    writeFileSync(
      caminho,
      [
        "import type { PerfilEncode } from '../formato.js';",
        "const perfil: PerfilEncode = {",
        "  nome: 'invalido-eixo',",
        "  motor: 'nvenc',",
        "  codec: 'h264_nvenc',",
        "  deterministico: false,",
        "  justificativaDeterminismo: 'sonda negativa',",
        "  alvoQualidade: { tipo: 'crf', valor: 18 },", // eixo cruzado
        "  preset: 'p5',",
        "  pixFmt: 'yuv420p',",
        "  argsExtra: [],",
        "};",
        "export default perfil;",
        "",
      ].join("\n"),
    );
    try {
      await expect(listarPerfis()).rejects.toThrow(/eixo/);
    } finally {
      const { rmSync } = await import("node:fs");
      rmSync(caminho, { force: true });
    }
  });

  it("emenda em forma de catalogo: todo perfil do disco DECLARA determinismo", async () => {
    const descobertos = await listarPerfis();
    for (const descoberto of descobertos) {
      expect(typeof descoberto.perfil.deterministico).toBe("boolean");
      expect(descoberto.perfil.justificativaDeterminismo.length).toBeGreaterThan(0);
    }
  });

  it("presenca dos perfis deste card com as declaracoes corretas", async () => {
    const descobertos = await listarPerfis();
    const software = descobertos.find((d) => d.perfil.nome === "entrega-software");
    const nvenc = descobertos.find((d) => d.perfil.nome === "entrega-nvenc");

    // Software: deterministico — a declaracao que o gate testa ao vivo
    // (2x bytes identicos em reais.test.ts).
    expect(software?.perfil.deterministico).toBe(true);
    expect(software?.perfil.alvoQualidade.tipo).toBe("crf");

    // Hardware: NAO deterministico — goldens recusam (golden.test.ts).
    expect(nvenc?.perfil.deterministico).toBe(false);
    expect(nvenc?.perfil.alvoQualidade.tipo).toBe("cq");
  });
});
