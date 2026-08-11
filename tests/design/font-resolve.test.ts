// =============================================================================
// F1-03 — Fontes locais embutidas e assercao da familia resolvida
// =============================================================================
// AGENTS.md, C6: "Uma fonte que nao carregou cai para fallback sem erro."
// O video sai com a tipografia errada e o gate fica verde. Este arquivo existe
// para tornar isso impossivel, em tres frentes:
//
//  (1) LICENCA E IDENTIDADE DO BINARIO — abre cada .woff2 e le, do proprio
//      arquivo, a familia (name ID 1), a subfamilia (name ID 2), o peso
//      (OS/2.usWeightClass), o estilo (post.italicAngle) e o BIT DE PERMISSAO
//      DE EMBUTIR (OS/2.fsType). Cruza com a ficha .md e com o sha256.
//
//  (2) FAMILIA RESOLVIDA NO RENDER — renderiza um still de verdade e le, de
//      dentro do navegador do render, qual familia o motor de fontes resolveu
//      para cada sonda. O canal e um <Artifact> emitido pelo MESMO renderStill
//      que produziu o still. Nao ha comparacao de pixels em lugar nenhum: o que
//      se compara e o NOME da familia, o peso, o estilo e o estado da FontFace.
//
//  (3) SONDAS NEGATIVAS — duas, porque um oraculo que so sabe dizer "sim" nao e
//      oraculo (AGENTS.md, C2):
//        - uma sonda de controle no MESMO still, com familia nunca registrada:
//          a leitura tem de devolver "nenhuma familia resolvida";
//        - uma composicao que pede um arquivo de fonte inexistente: o render
//          TEM de morrer. Se ele sobrevivesse, uma fonte faltando cairia em
//          fallback silencioso e todo o resto seria teatro.
// =============================================================================

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import type { EmittedArtifact } from "@remotion/renderer";
import {
  ARQUIVO_DE_EVIDENCIA,
  FONTES_LOCAIS,
  SONDAS_TIPOGRAFICAS,
} from "../../src/design/fontes/index";
import type { EvidenciaDeFontes } from "../../src/design/fontes/resolucao";
import { inspecionarWoff2, FSTYPE_EMBUTIR_LIVRE } from "../../tools/woff2-inspect";

// ---------------------------------------------------------------------------
// Caminhos
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(__dirname, "..", "..");
const dirFontes = resolve(raiz, "assets", "fontes");
const pontoDeEntrada = resolve(raiz, "fixtures", "fontes", "index.tsx");
const dirSaida = resolve(raiz, "output", "fontes");

const COMPOSICAO_BOA = "fontes-locais";
const COMPOSICAO_QUEBRADA = "fontes-arquivo-ausente";

const TEMPO_DE_BUNDLE = 240_000;
const TEMPO_DE_RENDER = 120_000;

function sha256(caminho: string): string {
  return createHash("sha256").update(readFileSync(caminho)).digest("hex");
}

// =============================================================================
// (1) Licenca, identidade e direito de embutir — lidos do binario
// =============================================================================

describe("F1-03 — o que o binario da fonte declara sobre si mesmo", () => {
  it("ha fontes declaradas (sonda contra catalogo vazio)", () => {
    expect(
      FONTES_LOCAIS.length,
      "FONTES_LOCAIS vazio: o gate passaria sem olhar nenhum arquivo.",
    ).toBeGreaterThan(0);
  });

  for (const fonte of FONTES_LOCAIS) {
    const caminho = resolve(dirFontes, fonte.arquivo);

    it(`${fonte.arquivo}: existe e e um WOFF2`, () => {
      expect(existsSync(caminho), `Arquivo ausente: ${caminho}`).toBe(true);
      const buf = readFileSync(caminho);
      // Assinatura 'wOF2'
      expect(buf.subarray(0, 4).toString("latin1")).toBe("wOF2");
    });

    it(`${fonte.arquivo}: a familia do binario e "${fonte.familia}"`, () => {
      const ficha = inspecionarWoff2(caminho);
      expect(
        ficha.familia,
        `name ID 1 do arquivo diz "${ficha.familia}", o catalogo diz "${fonte.familia}". ` +
          `Carregar sob um nome que o arquivo nao tem faz o CSS nunca casar e cair em fallback.`,
      ).toBe(fonte.familia);
    });

    it(`${fonte.arquivo}: peso e estilo estao fixados e batem com o binario`, () => {
      const ficha = inspecionarWoff2(caminho);
      // "Inter" nao e uma fonte. "Inter, peso 700, normal" e.
      expect(
        ficha.usWeightClass,
        `OS/2.usWeightClass do arquivo e ${ficha.usWeightClass}, mas o catalogo ` +
          `registra a face com peso ${fonte.peso}. O CSS pediria um peso que o ` +
          `arquivo nao tem e o navegador sintetizaria (fake bold) em silencio.`,
      ).toBe(fonte.pesoNoBinario);
      expect(String(fonte.pesoNoBinario)).toBe(fonte.peso);
      expect(ficha.subfamilia).toBe(fonte.subfamiliaNoBinario);
      if (fonte.estilo === "normal") {
        expect(ficha.italicAngle, "italicAngle != 0 num estilo normal").toBe(0);
      }
    });

    it(`${fonte.arquivo}: OS/2.fsType autoriza EMBUTIR`, () => {
      const ficha = inspecionarWoff2(caminho);
      // Embutir e uma permissao separada de usar e de redistribuir, e ela mora
      // num bit dentro do proprio arquivo. 0x0000 = Installable Embedding.
      // 0x0002 (Restricted License Embedding) proibiria embutir.
      expect(
        ficha.fsType,
        `OS/2.fsType = 0x${ficha.fsType.toString(16).padStart(4, "0")} em ` +
          `${fonte.arquivo}. Apenas 0x0000 (Installable Embedding) libera ` +
          `embutir sem restricao.`,
      ).toBe(FSTYPE_EMBUTIR_LIVRE);
    });

    it(`${fonte.arquivo}: o binario declara a OFL 1.1`, () => {
      const ficha = inspecionarWoff2(caminho);
      expect(ficha.licenca).toContain("SIL Open Font License");
      expect(ficha.licenca).toContain("Version 1.1");
    });

    it(`${fonte.arquivo}: a ficha de licenca declara estes bytes`, () => {
      const fichaMd = readFileSync(resolve(dirFontes, fonte.ficha), "utf-8");
      const chave = `sha256_${fonte.arquivo}`;
      const linha = fichaMd
        .split("\n")
        .find((l) => l.trim().startsWith(`${chave}:`));
      expect(
        linha,
        `A ficha ${fonte.ficha} nao declara "${chave}". Sem isso a declaracao ` +
          `de licenca fica orfa dos bytes que ela descreve.`,
      ).toBeDefined();
      const declarado = (linha ?? "").split(":")[1]?.trim();
      expect(
        declarado,
        `Hash divergente para ${fonte.arquivo}: o arquivo foi trocado sem ` +
          `reexaminar a licenca.`,
      ).toBe(sha256(caminho));
    });
  }

  it("toda ficha .md em assets/fontes/ declara licenca e direito de embutir", () => {
    const fichas = readdirSync(dirFontes).filter((f) => f.endsWith(".md"));
    expect(
      fichas.length,
      "Nenhuma ficha .md encontrada: o seletor vazio deixaria o gate verde.",
    ).toBeGreaterThan(0);
    for (const nome of fichas) {
      const conteudo = readFileSync(resolve(dirFontes, nome), "utf-8");
      // Este e o mesmo criterio do gate `rg -L "licenca:" assets/fontes/*.md`
      expect(conteudo, `${nome} sem "licenca:"`).toContain("licenca:");
      expect(conteudo, `${nome} sem "direito_de_embutir:"`).toContain(
        "direito_de_embutir: SIM",
      );
      expect(conteudo, `${nome} sem "os2_fstype:"`).toContain("os2_fstype:");
    }
  });

  it("toda fonte do catalogo tem ficha, e toda ficha tem fonte", () => {
    const fichasNoDisco = new Set(
      readdirSync(dirFontes).filter((f) => f.endsWith(".md")),
    );
    const fichasUsadas = new Set(FONTES_LOCAIS.map((f) => f.ficha));
    for (const usada of fichasUsadas) {
      expect(fichasNoDisco.has(usada), `Ficha ausente: ${usada}`).toBe(true);
    }
    for (const noDisco of fichasNoDisco) {
      expect(
        fichasUsadas.has(noDisco),
        `Ficha ${noDisco} nao corresponde a nenhuma fonte carregada. ` +
          `Ou o arquivo sobrou, ou uma fonte foi embutida sem entrar no catalogo.`,
      ).toBe(true);
    }
  });

  it("OFL.txt acompanha os binarios com os avisos de copyright de cada familia", () => {
    // OFL clausula 2: cada copia distribuida carrega o aviso e a licenca.
    // O bundler copia o diretorio publico inteiro, entao o OFL.txt viaja junto.
    // Normaliza o "(c)" opcional: o binario da Inter grava "Copyright 2016 ..."
    // e o LICENSE.txt upstream grava "Copyright (c) 2016 ...". O titular e o
    // mesmo; o que nao pode e o OFL.txt nomear outro titular.
    const semC = (s: string) => s.replace(/\(c\)\s*/gi, "").replace(/\s+/g, " ");
    const ofl = readFileSync(resolve(dirFontes, "OFL.txt"), "utf-8");
    expect(ofl).toContain("SIL OPEN FONT LICENSE Version 1.1");
    for (const fonte of FONTES_LOCAIS) {
      const dono = inspecionarWoff2(resolve(dirFontes, fonte.arquivo)).copyright;
      const primeiraLinha = dono.split("\n")[0]?.trim() ?? "";
      expect(
        semC(ofl),
        `OFL.txt nao traz o aviso de copyright que o binario de ${fonte.familia} ` +
          `declara: "${primeiraLinha}"`,
      ).toContain(semC(primeiraLinha));
    }
  });

  it("nenhum caminho de fonte aponta para fora do projeto", () => {
    for (const fonte of FONTES_LOCAIS) {
      expect(
        /^[a-z][a-z0-9+.-]*:\/\//i.test(fonte.caminhoPublico),
        `Caminho remoto em ${fonte.arquivo}: ${fonte.caminhoPublico}`,
      ).toBe(false);
      expect(fonte.caminhoPublico.startsWith("/")).toBe(false);
    }
  });
});

// =============================================================================
// (2) e (3) O render: familia resolvida e sonda negativa
// =============================================================================

describe("F1-03 — familia efetivamente resolvida no render", () => {
  let serveUrl = "";
  let evidencia: EvidenciaDeFontes;
  let bytesDoStill = 0;

  beforeAll(async () => {
    serveUrl = await bundle({
      entryPoint: pontoDeEntrada,
      onProgress: () => undefined,
      ignoreRegisterRootWarning: true,
    });

    const composicoes = await getCompositions(serveUrl);
    const alvo = composicoes.find((c) => c.id === COMPOSICAO_BOA);
    if (alvo === undefined) {
      throw new Error(`Composicao ${COMPOSICAO_BOA} nao registrada no bundle`);
    }

    mkdirSync(dirSaida, { recursive: true });
    const artefatos: EmittedArtifact[] = [];
    const resultado = await renderStill({
      composition: alvo,
      serveUrl,
      frame: 0,
      imageFormat: "png",
      output: resolve(dirSaida, `${COMPOSICAO_BOA}.png`),
      overwrite: true,
      chromiumOptions: { gl: "swangle" },
      onArtifact: (a) => artefatos.push(a),
    });
    void resultado;

    bytesDoStill = readFileSync(resolve(dirSaida, `${COMPOSICAO_BOA}.png`)).length;

    const bruto = artefatos.find((a) => a.filename === ARQUIVO_DE_EVIDENCIA);
    if (bruto === undefined) {
      throw new Error(
        `O still saiu mas o render nao emitiu ${ARQUIVO_DE_EVIDENCIA}. ` +
          `Sem esse artefato o still nao prova nada sobre a familia resolvida. ` +
          `Artefatos vistos: ${JSON.stringify(artefatos.map((a) => a.filename))}`,
      );
    }
    const texto =
      typeof bruto.content === "string"
        ? bruto.content
        : Buffer.from(bruto.content).toString("utf-8");
    writeFileSync(resolve(dirSaida, ARQUIVO_DE_EVIDENCIA), texto);
    evidencia = JSON.parse(texto) as EvidenciaDeFontes;
  }, TEMPO_DE_BUNDLE);

  it("o still saiu do render", () => {
    expect(bytesDoStill).toBeGreaterThan(0);
  });

  it("a evidencia veio do mesmo render que produziu o still", () => {
    expect(evidencia.sondas.length).toBe(SONDAS_TIPOGRAFICAS.length);
    expect(evidencia.estadoDoConjunto).toBe("loaded");
  });

  it("o navegador do render registrou exatamente as fontes do catalogo", () => {
    const noNavegador = evidencia.registro
      .map((f) => `${f.familia}|${f.peso}|${f.estilo}|${f.estado}`)
      .sort();
    const esperado = FONTES_LOCAIS.map(
      (f) => `${f.familia}|${f.peso}|${f.estilo}|loaded`,
    ).sort();
    expect(
      noNavegador,
      "As FontFace registradas no render nao batem com FONTES_LOCAIS. " +
        "Uma face em estado != 'loaded' significa que o elemento desenhou com fallback.",
    ).toEqual(esperado);
  });

  for (const sonda of SONDAS_TIPOGRAFICAS) {
    if (sonda.familiaEsperada !== null) {
      it(`sonda "${sonda.id}": familia resolvida e "${sonda.familiaEsperada}", peso ${sonda.peso}, ${sonda.estilo}`, () => {
        const leitura = evidencia.sondas.find((s) => s.id === sonda.id);
        expect(leitura, `Sonda ${sonda.id} ausente na evidencia`).toBeDefined();
        const l = leitura!;
        expect(
          l.familiaResolvida,
          `A pilha computada foi "${l.pilhaComputada}" e o motor de fontes ` +
            `resolveu ${JSON.stringify(l.familiaResolvida)}. ` +
            `Descartadas antes: ${JSON.stringify(l.familiasDescartadas)}. ` +
            `Estado da face: ${JSON.stringify(l.estadoDaFace)}.`,
        ).toBe(sonda.familiaEsperada);
        expect(l.estadoDaFace).toBe("loaded");
        expect(l.pesoDaFace, "peso da face resolvida").toBe(sonda.peso);
        expect(l.estiloDaFace, "estilo da face resolvida").toBe(sonda.estilo);
        expect(l.pesoComputado, "peso computado no elemento").toBe(sonda.peso);
        expect(l.estiloComputado, "estilo computado no elemento").toBe(sonda.estilo);
        expect(
          l.matchDoNavegador,
          `document.fonts.check(${JSON.stringify(l.shorthand)}) devolveu false: ` +
            `o proprio motor de matching do navegador diz que a face nao serve ` +
            `para o texto da sonda.`,
        ).toBe(true);
      });
    } else {
      it(`sonda "${sonda.id}": a leitura sabe dizer NAO (sonda negativa)`, () => {
        const leitura = evidencia.sondas.find((s) => s.id === sonda.id);
        expect(leitura).toBeDefined();
        const l = leitura!;
        expect(
          l.familiaResolvida,
          "A sonda de controle usa uma familia que nunca foi registrada. " +
            "Se a leitura devolvesse um nome aqui, ela responderia 'resolveu' " +
            "para qualquer coisa e as outras sondas nao provariam nada.",
        ).toBeNull();
        expect(l.matchDoNavegador).toBe(false);
        expect(l.estadoDaFace).toBeNull();
      });
    }
  }

  it("o render foi offline: nenhuma fonte veio de endereco remoto", () => {
    expect(evidencia.urlsDasFontes.length).toBe(FONTES_LOCAIS.length);
    for (const url of evidencia.urlsDasFontes) {
      expect(
        /^[a-z][a-z0-9+.-]*:\/\//i.test(url),
        `URL de fonte com esquema remoto no render: ${url}`,
      ).toBe(false);
    }
    expect(evidencia.origem).toMatch(/^http:\/\/localhost:/);
  });

  it(
    "SONDA NEGATIVA: um arquivo de fonte ausente DERRUBA o render",
    async () => {
      const composicoes = await getCompositions(serveUrl);
      const quebrada = composicoes.find((c) => c.id === COMPOSICAO_QUEBRADA);
      expect(quebrada, `Composicao ${COMPOSICAO_QUEBRADA} nao registrada`).toBeDefined();

      let saiuStill = false;
      let erro: unknown = null;
      try {
        await renderStill({
          composition: quebrada!,
          serveUrl,
          frame: 0,
          imageFormat: "png",
          output: null,
          overwrite: true,
          chromiumOptions: { gl: "swangle" },
          timeoutInMilliseconds: 20_000,
        });
        saiuStill = true;
      } catch (e) {
        erro = e;
      }

      expect(
        saiuStill,
        "O render sobreviveu a uma fonte ausente. Isso e exatamente C6: a fonte " +
          "cai em fallback e o video sai com a tipografia errada sem nada ficar " +
          "vermelho. Se este teste passar verde com o render bem-sucedido, todas " +
          "as outras asserçoes deste arquivo sao decorativas.",
      ).toBe(false);
      expect(String(erro)).toMatch(/NetworkError|network|font/i);
    },
    TEMPO_DE_RENDER,
  );
});

// =============================================================================
// Zero fonte remota no codigo
// =============================================================================

describe("F1-03 — zero fonte remota em src/", () => {
  // Os padroes casam HOST REAL, nao a palavra solta. `/\bcdn\b/i` — a forma
  // original — reprovava qualquer arquivo que MENCIONASSE cdn, inclusive um
  // comentario que PROIBE cdn: src/resolucao/manifesto-resolvido.ts documenta
  // que URL relativa a protocolo (`//cdn...`) e proibida, e por isso ficava
  // vermelho. Um gate que pune a documentacao da propria regra fica mais
  // vermelho quanto mais o repositorio explica a proibicao, e o conserto que
  // ele convida e apagar o comentario.
  const PROIBIDOS = [
    /fonts\.googleapis/i,
    /fonts\.gstatic/i,
    /\bcdn\.[a-z0-9-]+\.[a-z]{2,}/i, // cdn.jsdelivr.net, cdn.exemplo.com
    /\b(unpkg\.com|jsdelivr\.net|cdnjs\.)/i,
  ];

  function* varrer(dir: string): Generator<string> {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = resolve(dir, entrada.name);
      if (entrada.isDirectory()) {
        yield* varrer(caminho);
      } else if (/\.(ts|tsx)$/.test(entrada.name)) {
        yield caminho;
      }
    }
  }

  it("nenhum arquivo de src/ menciona fonte remota", () => {
    const arquivos = [...varrer(resolve(raiz, "src"))];
    expect(
      arquivos.length,
      "Nenhum arquivo varrido: seletor vazio deixaria o gate verde.",
    ).toBeGreaterThan(0);
    const achados: string[] = [];
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, "utf-8");
      for (const padrao of PROIBIDOS) {
        if (padrao.test(conteudo)) {
          achados.push(`${arquivo} casa ${padrao}`);
        }
      }
    }
    expect(achados, achados.join("\n")).toEqual([]);
  });
});
